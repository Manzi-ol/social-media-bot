"""
tiktok/analytics.py — Fetch TikTok account analytics via the
                       TikTok Research API / Business API.

Metrics collected:
  • Follower count
  • Profile views (video_views as a proxy; TikTok does not expose profile
    views directly in the public API)
  • Per-video: likes, comments, shares, views, engagement rate

NOTE: The Research API requires your app to be approved as a Research API
partner.  Apply at: https://developers.tiktok.com/products/research-api/
If you only have a regular developer app, the user.info.stats endpoint
returns aggregate follower/like counts for your own account.
"""

import logging
from datetime import datetime, timedelta, timezone

import requests

import config
from rate_limiter import api_call
from tiktok.auth import _auth_headers

logger = logging.getLogger(__name__)


def get_user_info() -> dict:
    """
    Fetch basic account stats: follower_count, following_count,
    likes_count, video_count.
    """
    url = f"{config.TIKTOK_API_BASE}/user/info/"
    params = {
        "fields": "follower_count,following_count,likes_count,video_count",
    }
    response = api_call(requests.get, url, headers=_auth_headers(), params=params)
    data = response.json().get("data", {}).get("user", {})
    logger.info("TikTok user info: %s", data)
    return data


def get_recent_video_stats(max_count: int = 5) -> list[dict]:
    """
    Return engagement stats for the most recent `max_count` videos.

    Each dict contains:
        video_id, title, create_time, view_count, like_count,
        comment_count, share_count, engagement_rate_pct
    """
    url = f"{config.TIKTOK_API_BASE}/video/list/"
    params = {
        "fields": (
            "id,title,create_time,"
            "statistics.view_count,statistics.like_count,"
            "statistics.comment_count,statistics.share_count"
        ),
        "max_count": max_count,
    }
    response = api_call(requests.get, url, headers=_auth_headers(), params=params)
    videos = response.json().get("data", {}).get("videos", [])

    results = []
    for v in videos:
        stats = v.get("statistics", {})
        views = stats.get("view_count", 0)
        likes = stats.get("like_count", 0)
        comments = stats.get("comment_count", 0)
        shares = stats.get("share_count", 0)

        engagement_rate = (
            round((likes + comments + shares) / views * 100, 2) if views else 0.0
        )

        results.append({
            "video_id": v.get("id"),
            "title": v.get("title", ""),
            "create_time": v.get("create_time"),
            "view_count": views,
            "like_count": likes,
            "comment_count": comments,
            "share_count": shares,
            "engagement_rate_pct": engagement_rate,
        })

    logger.debug("Fetched stats for %d TikTok videos.", len(results))
    return results
