"""
instagram/publisher.py — Publish a video (Reel) to Instagram via the
                          official Graph API two-step upload process.

Official docs:
  https://developers.facebook.com/docs/instagram-api/guides/content-publishing

FLOW
────
Step 1 — Create a media container (POST /{ig-user-id}/media)
          Instagram fetches the video from a public URL you provide.
Step 2 — Publish the container  (POST /{ig-user-id}/media_publish)

IMPORTANT: The video must be publicly accessible at a URL while Instagram
fetches it.  Options: S3, Cloudinary, GitHub Releases, etc.
If you only have a local file path, this module uploads it first using the
Resumable Upload API (for videos > 100 MB) or a direct public URL.
For simplicity this implementation expects a public_video_url argument.
"""

import logging
import time

import requests

import config
from rate_limiter import api_call

logger = logging.getLogger(__name__)

# Polling interval in seconds while waiting for Instagram to process the video
_POLL_INTERVAL = 10
_MAX_POLL_ATTEMPTS = 30  # 5 minutes total


def _get_container_status(container_id: str) -> str:
    """Return the status_code of an Instagram media container."""
    url = f"{config.IG_API_BASE}/{container_id}"
    params = {
        "fields": "status_code,status",
        "access_token": config.INSTAGRAM_PAGE_ACCESS_TOKEN,
    }
    data = api_call(requests.get, url, params=params).json()
    return data.get("status_code", "UNKNOWN")


def publish_reel(public_video_url: str, caption: str) -> str:
    """
    Publish a video as an Instagram Reel.

    Args:
        public_video_url: Publicly accessible URL of the video file.
        caption:          Post caption text (hashtags allowed).

    Returns:
        The published media ID as a string.
    """
    ig_user_id = config.INSTAGRAM_BUSINESS_ACCOUNT_ID
    access_token = config.INSTAGRAM_PAGE_ACCESS_TOKEN

    # ── Step 1: Create media container ────────────────────────────────────────
    logger.info("Creating Instagram media container …")
    container_resp = api_call(
        requests.post,
        f"{config.IG_API_BASE}/{ig_user_id}/media",
        params={
            "media_type": "REELS",
            "video_url": public_video_url,
            "caption": caption,
            "share_to_feed": "true",
            "access_token": access_token,
        },
    )
    container_id = container_resp.json()["id"]
    logger.info("Container created: %s", container_id)

    # ── Step 2: Poll until Instagram finishes processing the video ────────────
    for attempt in range(1, _MAX_POLL_ATTEMPTS + 1):
        status = _get_container_status(container_id)
        logger.info("Container status (attempt %d): %s", attempt, status)

        if status == "FINISHED":
            break
        if status == "ERROR":
            raise RuntimeError(
                f"Instagram video processing failed for container {container_id}."
            )
        time.sleep(_POLL_INTERVAL)
    else:
        raise TimeoutError(
            f"Instagram video processing did not finish within "
            f"{_MAX_POLL_ATTEMPTS * _POLL_INTERVAL} seconds."
        )

    # ── Step 3: Publish the container ─────────────────────────────────────────
    logger.info("Publishing container %s …", container_id)
    publish_resp = api_call(
        requests.post,
        f"{config.IG_API_BASE}/{ig_user_id}/media_publish",
        params={
            "creation_id": container_id,
            "access_token": access_token,
        },
    )
    media_id = publish_resp.json()["id"]
    logger.info("Published! Instagram media ID: %s", media_id)
    return media_id
