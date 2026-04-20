"""
scheduler.py — Schedule posts and the daily analytics job using APScheduler.

APScheduler supports cron-style expressions, timezone-aware scheduling,
and persistent job stores (SQLite shown below so jobs survive restarts).

HOW TO SCHEDULE A POST
────────────────────────
From main.py or an interactive Python session:

    from scheduler import schedule_post, start_scheduler

    start_scheduler()

    schedule_post(
        platform="instagram",
        public_video_url="https://your-cdn.com/video.mp4",  # or local path for TikTok
        local_video_path="/path/to/video.mp4",              # only needed for TikTok
        caption="Check this out! #reels",
        run_date="2026-04-22 18:00:00",   # local time string, ISO 8601
        timezone="Africa/Kigali",         # your local timezone
    )
"""

import logging
import os
from datetime import datetime

import pytz
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.background import BackgroundScheduler

from analytics_reporter import run_daily_report
from instagram.publisher import publish_reel
from tiktok.publisher import publish_video

logger = logging.getLogger(__name__)

# ── Persistent job store so scheduled posts survive a process restart ─────────
_DB_PATH = os.path.join(os.path.dirname(__file__), "scheduler_jobs.sqlite")

_scheduler = BackgroundScheduler(
    jobstores={
        "default": SQLAlchemyJobStore(url=f"sqlite:///{_DB_PATH}"),
    },
    executors={
        "default": ThreadPoolExecutor(max_workers=5),
    },
    job_defaults={
        "coalesce": True,   # run a missed job once, not multiple times
        "max_instances": 1,
    },
    timezone=pytz.utc,
)


def start_scheduler():
    """
    Start the background scheduler and register the daily analytics job.
    Call this once at application startup.
    """
    if not _scheduler.running:
        _scheduler.start()
        logger.info("APScheduler started.")

        # Daily analytics report at 08:00 UTC
        _scheduler.add_job(
            run_daily_report,
            trigger="cron",
            hour=8,
            minute=0,
            id="daily_analytics",
            replace_existing=True,
            name="Daily Analytics Report",
        )
        logger.info("Daily analytics job registered (runs at 08:00 UTC).")


def stop_scheduler():
    """Gracefully shut down the scheduler (call on app exit)."""
    if _scheduler.running:
        _scheduler.shutdown(wait=True)
        logger.info("APScheduler stopped.")


def schedule_post(
    platform: str,
    caption: str,
    run_date: str,
    timezone: str = "UTC",
    public_video_url: str = "",
    local_video_path: str = "",
    **kwargs,
) -> str:
    """
    Schedule a video post to Instagram or TikTok at a specific date/time.

    Args:
        platform:         "instagram" or "tiktok"
        caption:          Post caption / description.
        run_date:         When to publish, as an ISO 8601 string
                          e.g. "2026-04-22 18:00:00"
        timezone:         Timezone name for run_date (e.g. "Africa/Kigali").
        public_video_url: (Instagram) Publicly accessible video URL.
        local_video_path: (TikTok) Local file path to the video.
        **kwargs:         Extra args forwarded to the publisher
                          (e.g. privacy_level="SELF_ONLY" for TikTok testing).

    Returns:
        The APScheduler job ID.

    Raises:
        ValueError: For unknown platform or missing required arguments.
    """
    platform = platform.lower()
    if platform not in ("instagram", "tiktok"):
        raise ValueError(f"Unknown platform: '{platform}'. Use 'instagram' or 'tiktok'.")

    # Parse run_date in the given timezone, then convert to UTC
    tz = pytz.timezone(timezone)
    local_dt = tz.localize(datetime.fromisoformat(run_date))
    utc_dt = local_dt.astimezone(pytz.utc)

    if platform == "instagram":
        if not public_video_url:
            raise ValueError("public_video_url is required for Instagram posts.")
        job_func = publish_reel
        job_args = [public_video_url, caption]
        job_id = f"ig_post_{utc_dt.strftime('%Y%m%d%H%M%S')}"

    else:  # tiktok
        if not local_video_path:
            raise ValueError("local_video_path is required for TikTok posts.")
        job_func = publish_video
        job_args = [local_video_path, caption]
        job_id = f"tt_post_{utc_dt.strftime('%Y%m%d%H%M%S')}"

    _scheduler.add_job(
        job_func,
        trigger="date",
        run_date=utc_dt,
        args=job_args,
        kwargs=kwargs,
        id=job_id,
        name=f"Post to {platform} at {run_date} {timezone}",
        replace_existing=True,
    )

    logger.info(
        "Scheduled %s post for %s %s (UTC: %s). Job ID: %s",
        platform, run_date, timezone, utc_dt.isoformat(), job_id,
    )
    return job_id


def list_scheduled_posts() -> list[dict]:
    """Return a list of pending scheduled jobs for review."""
    jobs = []
    for job in _scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": str(job.next_run_time),
        })
    return jobs


def cancel_post(job_id: str) -> bool:
    """
    Cancel a previously scheduled post by its job ID.
    Returns True if the job was found and removed, False otherwise.
    """
    job = _scheduler.get_job(job_id)
    if job:
        job.remove()
        logger.info("Cancelled scheduled job: %s", job_id)
        return True
    logger.warning("Job not found: %s", job_id)
    return False
