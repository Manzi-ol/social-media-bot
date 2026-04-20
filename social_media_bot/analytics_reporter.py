"""
analytics_reporter.py — Aggregate daily analytics from Instagram and TikTok
                         and append them to a CSV file.

Output file: analytics/daily_report.csv
Columns:
    date, platform, metric, value
"""

import csv
import logging
import os
from datetime import date

from instagram.analytics import (
    get_daily_insights,
    get_follower_count,
    get_last_n_posts_engagement,
)
from tiktok.analytics import get_recent_video_stats, get_user_info

logger = logging.getLogger(__name__)

CSV_DIR = os.path.join(os.path.dirname(__file__), "analytics")
CSV_PATH = os.path.join(CSV_DIR, "daily_report.csv")

_CSV_HEADERS = [
    "date", "platform", "metric_type", "identifier", "metric_name", "value"
]


def _ensure_csv_exists():
    """Create the CSV with headers if it does not already exist."""
    os.makedirs(CSV_DIR, exist_ok=True)
    if not os.path.isfile(CSV_PATH):
        with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(_CSV_HEADERS)
        logger.info("Created new analytics CSV at %s", CSV_PATH)


def _append_rows(rows: list[list]):
    """Append data rows to the CSV."""
    with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)


def run_daily_report():
    """
    Pull analytics from both platforms and append today's data to the CSV.
    Designed to be called once per day (e.g. via APScheduler cron trigger).
    """
    _ensure_csv_exists()
    today = date.today().isoformat()
    rows = []

    # ── Instagram account-level metrics ───────────────────────────────────────
    try:
        ig_followers = get_follower_count()
        rows.append([today, "instagram", "account", "self", "follower_count", ig_followers])

        ig_insights = get_daily_insights()
        for metric_name, value in ig_insights.items():
            rows.append([today, "instagram", "account", "self", metric_name, value])

        logger.info("Instagram account metrics collected.")
    except Exception as exc:
        logger.error("Failed to collect Instagram account metrics: %s", exc)

    # ── Instagram post-level engagement ───────────────────────────────────────
    try:
        ig_posts = get_last_n_posts_engagement(n=5)
        for post in ig_posts:
            media_id = post["media_id"]
            for metric in ["likes", "comments", "reach", "engagement_rate_pct"]:
                rows.append([
                    today, "instagram", "post", media_id, metric, post[metric]
                ])
        logger.info("Instagram post engagement collected for %d posts.", len(ig_posts))
    except Exception as exc:
        logger.error("Failed to collect Instagram post engagement: %s", exc)

    # ── TikTok account-level metrics ──────────────────────────────────────────
    try:
        tt_user = get_user_info()
        for metric_name in ["follower_count", "following_count", "likes_count", "video_count"]:
            rows.append([
                today, "tiktok", "account", "self", metric_name, tt_user.get(metric_name, 0)
            ])
        logger.info("TikTok account metrics collected.")
    except Exception as exc:
        logger.error("Failed to collect TikTok account metrics: %s", exc)

    # ── TikTok post-level engagement ──────────────────────────────────────────
    try:
        tt_videos = get_recent_video_stats(max_count=5)
        for video in tt_videos:
            vid_id = video["video_id"]
            for metric in ["view_count", "like_count", "comment_count", "share_count", "engagement_rate_pct"]:
                rows.append([
                    today, "tiktok", "post", vid_id, metric, video[metric]
                ])
        logger.info("TikTok video stats collected for %d videos.", len(tt_videos))
    except Exception as exc:
        logger.error("Failed to collect TikTok video stats: %s", exc)

    # ── Write to CSV ──────────────────────────────────────────────────────────
    if rows:
        _append_rows(rows)
        logger.info("Appended %d rows to %s", len(rows), CSV_PATH)
    else:
        logger.warning("No analytics data collected today.")
