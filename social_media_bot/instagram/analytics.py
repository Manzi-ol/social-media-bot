"""
instagram/analytics.py — Fetch daily Instagram analytics via Graph API Insights.

Metrics collected:
  • Follower count (current snapshot)
  • Daily new followers (follower_count insight)
  • Profile views (profile_views insight)
  • Engagement rate for the last 5 posts
    = (likes + comments) / reach  × 100
"""

import logging
from datetime import datetime, timezone

import requests

import config
from rate_limiter import api_call

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get(url: str, params: dict) -> dict:
    """Shorthand GET with the page access token injected."""
    params["access_token"] = config.INSTAGRAM_PAGE_ACCESS_TOKEN
    return api_call(requests.get, url, params=params).json()


# ── Public functions ──────────────────────────────────────────────────────────

def get_follower_count() -> int:
    """Return the current total follower count for the business account."""
    url = f"{config.IG_API_BASE}/{config.INSTAGRAM_BUSINESS_ACCOUNT_ID}"
    data = _get(url, {"fields": "followers_count"})
    count = data.get("followers_count", 0)
    logger.info("Current followers: %d", count)
    return count


def get_daily_insights() -> dict:
    """
    Fetch account-level insights for today.
    Returns a dict with keys: follower_count_delta, profile_views.

    The Insights API uses a 1-day period ending now.
    """
    url = f"{config.IG_API_BASE}/{config.INSTAGRAM_BUSINESS_ACCOUNT_ID}/insights"

    # Unix timestamps for a 24-hour window ending now
    now = int(datetime.now(timezone.utc).timestamp())
    since = now - 86_400  # 24 hours ago

    params = {
        "metric": "follower_count,profile_views",
        "period": "day",
        "since": since,
        "until": now,
    }

    data = _get(url, params)
    result = {}

    for item in data.get("data", []):
        name = item["name"]
        values = item.get("values", [])
        # Take the most recent value
        latest = values[-1]["value"] if values else 0
        result[name] = latest

    logger.info("Daily insights: %s", result)
    return result


def get_last_n_posts_engagement(n: int = 5) -> list[dict]:
    """
    Return engagement stats for the last `n` Instagram posts.

    Each dict contains:
        media_id, timestamp, likes, comments, reach, engagement_rate_pct
    """
    # Step 1: list recent media
    media_url = f"{config.IG_API_BASE}/{config.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media"
    media_data = _get(media_url, {"fields": "id,timestamp", "limit": n})
    posts = media_data.get("data", [])[:n]

    results = []
    for post in posts:
        media_id = post["id"]
        timestamp = post.get("timestamp", "")

        # Step 2: fetch like count and comments count
        media_detail = _get(
            f"{config.IG_API_BASE}/{media_id}",
            {"fields": "like_count,comments_count"},
        )
        likes = media_detail.get("like_count", 0)
        comments = media_detail.get("comments_count", 0)

        # Step 3: fetch reach insight for the post
        insights = _get(
            f"{config.IG_API_BASE}/{media_id}/insights",
            {"metric": "reach"},
        )
        reach = 0
        for metric in insights.get("data", []):
            if metric["name"] == "reach":
                reach = metric.get("values", [{}])[0].get("value", 0)

        engagement_rate = round((likes + comments) / reach * 100, 2) if reach else 0.0

        results.append({
            "media_id": media_id,
            "timestamp": timestamp,
            "likes": likes,
            "comments": comments,
            "reach": reach,
            "engagement_rate_pct": engagement_rate,
        })
        logger.debug("Post %s — engagement %.2f%%", media_id, engagement_rate)

    return results
