"""
main.py — Entry point for the Social Media Bot.

USAGE
─────
  Run everything (webhook + scheduler):
      python main.py

  Run only the webhook server:
      python main.py --mode webhook

  Run only the scheduler (no webhook):
      python main.py --mode scheduler

  Manually trigger today's analytics report:
      python main.py --mode analytics

  Schedule a post right now (example):
      python main.py --mode schedule \
          --platform instagram \
          --video-url "https://your-cdn.com/video.mp4" \
          --caption "Check this out! #reels" \
          --run-date "2026-04-22 18:00:00" \
          --timezone "Africa/Kigali"

PRODUCTION DEPLOYMENT
──────────────────────
  Replace the Flask development server with:
      gunicorn -w 1 -b 0.0.0.0:8000 "instagram.webhook:app"

  Run the scheduler as a separate process or systemd service.
  Use nginx as a reverse proxy with HTTPS (Meta requires HTTPS for webhooks).
"""

import argparse
import logging
import sys
import time
import threading

# ── Logging setup (do this before importing any project module) ───────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("logs/bot.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ── Project imports (after logging is configured) ─────────────────────────────
from analytics_reporter import run_daily_report
from instagram.webhook import run_webhook_server
from scheduler import cancel_post, list_scheduled_posts, schedule_post, start_scheduler, stop_scheduler


def _run_all():
    """Start the scheduler and the webhook server in the same process."""
    start_scheduler()

    # Run the webhook server in a daemon thread so it doesn't block shutdown
    webhook_thread = threading.Thread(
        target=run_webhook_server,
        name="WebhookServer",
        daemon=True,
    )
    webhook_thread.start()
    logger.info("Bot is running. Press Ctrl+C to stop.")

    # Keep the main thread alive; handle Ctrl+C cleanly on Windows + Unix
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received. Stopping …")
        stop_scheduler()
        sys.exit(0)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Social Media Automation Bot")
    parser.add_argument(
        "--mode",
        choices=["all", "webhook", "scheduler", "analytics", "schedule", "list", "cancel"],
        default="all",
        help="Operating mode (default: all)",
    )
    # Schedule-mode arguments
    parser.add_argument("--platform", choices=["instagram", "tiktok"])
    parser.add_argument("--video-url",  dest="video_url",  default="")
    parser.add_argument("--video-path", dest="video_path", default="")
    parser.add_argument("--caption",    default="")
    parser.add_argument("--run-date",   dest="run_date",   default="")
    parser.add_argument("--timezone",   default="UTC")
    # Cancel-mode argument
    parser.add_argument("--job-id", dest="job_id", default="")
    return parser.parse_args()


def main():
    args = _parse_args()

    if args.mode == "all":
        _run_all()

    elif args.mode == "webhook":
        run_webhook_server()

    elif args.mode == "scheduler":
        start_scheduler()
        logger.info("Scheduler running. Press Ctrl+C to stop.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            stop_scheduler()

    elif args.mode == "analytics":
        logger.info("Running daily analytics report …")
        run_daily_report()
        logger.info("Done. Check analytics/daily_report.csv")

    elif args.mode == "schedule":
        if not args.platform or not args.caption or not args.run_date:
            logger.error("--platform, --caption, and --run-date are required for schedule mode.")
            sys.exit(1)
        start_scheduler()
        job_id = schedule_post(
            platform=args.platform,
            caption=args.caption,
            run_date=args.run_date,
            timezone=args.timezone,
            public_video_url=args.video_url,
            local_video_path=args.video_path,
        )
        logger.info("Post scheduled. Job ID: %s", job_id)
        logger.info("Keep this process running until the scheduled time, or use --mode scheduler.")

        # Wait for the job to fire
        try:
            while True:
                time.sleep(5)
        except KeyboardInterrupt:
            stop_scheduler()

    elif args.mode == "list":
        start_scheduler()
        jobs = list_scheduled_posts()
        if jobs:
            for job in jobs:
                print(f"  {job['id']}  —  {job['name']}  —  next: {job['next_run_time']}")
        else:
            print("No scheduled posts found.")
        stop_scheduler()

    elif args.mode == "cancel":
        if not args.job_id:
            logger.error("--job-id is required for cancel mode.")
            sys.exit(1)
        start_scheduler()
        removed = cancel_post(args.job_id)
        print("Cancelled." if removed else "Job not found.")
        stop_scheduler()


if __name__ == "__main__":
    main()
