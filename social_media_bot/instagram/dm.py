"""
instagram/dm.py — Send Instagram Direct Messages and like comments
               via the Instagram Graph API (Messaging API).

PREREQUISITE: Your app must be approved for "Instagram Messaging" advanced
permission AND your Page must be connected to the Instagram Business account.
Apply at: https://developers.facebook.com/docs/messenger-platform/instagram
"""

import logging

import requests

import config
from rate_limiter import api_call

logger = logging.getLogger(__name__)


def send_dm(recipient_id: str, message: str) -> dict:
    """
    Send a Direct Message to an Instagram user.

    Args:
        recipient_id: The Instagram-scoped user ID of the message recipient.
        message:      The text to send.

    Returns:
        The parsed JSON response from the API.

    Raises:
        requests.HTTPError: On non-429 API errors.
        RuntimeError:       If rate-limit retries are exhausted.

    NOTE: Users must have previously messaged your account OR commented on
    your post within the last 7 days for the message to be deliverable
    (per Meta's policy).  The API itself enforces this — we cannot bypass it.
    """
    url = f"{config.IG_API_BASE}/me/messages"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": message},
        "messaging_type": "RESPONSE",
        "access_token": config.INSTAGRAM_PAGE_ACCESS_TOKEN,
    }

    response = api_call(requests.post, url, json=payload)
    data = response.json()
    logger.info("DM sent to user %s. Response: %s", recipient_id, data)
    return data


def like_comment(comment_id: str) -> dict:
    """
    Like a comment on an Instagram media object.

    Args:
        comment_id: The ID of the comment to like.

    Returns:
        The parsed JSON response ({"success": true} on success).
    """
    url = f"{config.IG_API_BASE}/{comment_id}/likes"
    params = {"access_token": config.INSTAGRAM_PAGE_ACCESS_TOKEN}

    response = api_call(requests.post, url, params=params)
    data = response.json()
    logger.info("Liked comment %s. Response: %s", comment_id, data)
    return data
