"""
tiktok/publisher.py — Upload and publish a local video to TikTok
                       via the official Content Posting API v2.

Official docs: https://developers.tiktok.com/doc/content-posting-api-get-started

FLOW (FILE_UPLOAD method — supports local files up to 4 GB)
────
Step 1: POST /v2/post/publish/video/init/
        → Receive upload_url and publish_id
Step 2: PUT the video bytes to upload_url (chunked if large)
Step 3: Poll /v2/post/publish/status/fetch/ until status = "PUBLISH_COMPLETE"

Required scope: video.publish, video.upload
"""

import logging
import math
import os
import time

import requests

import config
from rate_limiter import api_call
from tiktok.auth import _auth_headers

logger = logging.getLogger(__name__)

# TikTok's maximum chunk size per PUT request
_CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB
_POLL_INTERVAL = 10             # seconds between status checks
_MAX_POLL_ATTEMPTS = 30         # 5 minutes total


def publish_video(local_video_path: str, caption: str, **privacy_kwargs) -> str:
    """
    Upload a local video file to TikTok and publish it.

    Args:
        local_video_path: Absolute path to the video file on disk.
        caption:          Post caption (hashtags allowed, max 2 200 chars).
        **privacy_kwargs: Optional overrides, e.g.:
                            privacy_level="SELF_ONLY"  (for testing)
                            disable_comment=True
                            disable_duet=False

    Returns:
        The publish_id string on success.

    Raises:
        FileNotFoundError: If the video file does not exist.
        RuntimeError:      If publishing fails or times out.
    """
    if not os.path.isfile(local_video_path):
        raise FileNotFoundError(f"Video not found: {local_video_path}")

    file_size = os.path.getsize(local_video_path)
    chunk_count = math.ceil(file_size / _CHUNK_SIZE)

    # ── Step 1: Initialise the upload ─────────────────────────────────────────
    logger.info("Initialising TikTok video upload for '%s' …", local_video_path)

    post_info = {
        "title": caption,
        "privacy_level": privacy_kwargs.get("privacy_level", "PUBLIC_TO_EVERYONE"),
        "disable_comment": privacy_kwargs.get("disable_comment", False),
        "disable_duet": privacy_kwargs.get("disable_duet", False),
        "disable_stitch": privacy_kwargs.get("disable_stitch", False),
    }

    source_info = {
        "source": "FILE_UPLOAD",
        "video_size": file_size,
        "chunk_size": _CHUNK_SIZE,
        "total_chunk_count": chunk_count,
    }

    init_resp = api_call(
        requests.post,
        f"{config.TIKTOK_API_BASE}/post/publish/video/init/",
        headers=_auth_headers(),
        json={"post_info": post_info, "source_info": source_info},
    )
    init_data = init_resp.json().get("data", {})
    publish_id = init_data["publish_id"]
    upload_url = init_data["upload_url"]
    logger.info("Upload initialised. publish_id=%s", publish_id)

    # ── Step 2: Upload video in chunks ────────────────────────────────────────
    with open(local_video_path, "rb") as video_file:
        for chunk_index in range(chunk_count):
            chunk_data = video_file.read(_CHUNK_SIZE)
            start_byte = chunk_index * _CHUNK_SIZE
            end_byte = start_byte + len(chunk_data) - 1

            headers = {
                **_auth_headers(),
                "Content-Range": f"bytes {start_byte}-{end_byte}/{file_size}",
                "Content-Type": "video/mp4",
            }

            logger.info(
                "Uploading chunk %d/%d (bytes %d-%d) …",
                chunk_index + 1, chunk_count, start_byte, end_byte,
            )
            api_call(requests.put, upload_url, headers=headers, data=chunk_data)

    logger.info("All chunks uploaded. Waiting for TikTok to process video …")

    # ── Step 3: Poll until published ──────────────────────────────────────────
    for attempt in range(1, _MAX_POLL_ATTEMPTS + 1):
        status_resp = api_call(
            requests.post,
            f"{config.TIKTOK_API_BASE}/post/publish/status/fetch/",
            headers=_auth_headers(),
            json={"publish_id": publish_id},
        )
        status_data = status_resp.json().get("data", {})
        status = status_data.get("status", "UNKNOWN")
        logger.info("Publish status (attempt %d): %s", attempt, status)

        if status == "PUBLISH_COMPLETE":
            logger.info("TikTok video published! publish_id=%s", publish_id)
            return publish_id

        if status in ("FAILED", "PUBLISH_FAILED"):
            fail_reason = status_data.get("fail_reason", "unknown")
            raise RuntimeError(
                f"TikTok publish failed for publish_id={publish_id}: {fail_reason}"
            )

        time.sleep(_POLL_INTERVAL)

    raise TimeoutError(
        f"TikTok video did not publish within "
        f"{_MAX_POLL_ATTEMPTS * _POLL_INTERVAL} seconds. "
        f"publish_id={publish_id}"
    )
