"""
tiktok/auth.py — TikTok OAuth 2.0 authorisation helpers.

HOW TO GET YOUR FIRST ACCESS TOKEN
────────────────────────────────────
TikTok uses the OAuth 2.0 Authorization Code flow.

Step 1 — Direct the user to TikTok's auth page:
    https://www.tiktok.com/v2/auth/authorize/
        ?client_key=<TIKTOK_CLIENT_KEY>
        &scope=user.info.basic,video.publish,video.upload
        &response_type=code
        &redirect_uri=<YOUR_REDIRECT_URI>
        &state=<RANDOM_CSRF_TOKEN>

Step 2 — TikTok redirects back to YOUR_REDIRECT_URI with ?code=<auth_code>

Step 3 — Exchange the code for tokens by calling exchange_code_for_token()
          below, and save the resulting access_token and refresh_token to .env.

Step 4 — Tokens expire; call refresh_access_token() before they do
          (TikTok access tokens last 24 hours; refresh tokens last 365 days).

Official docs: https://developers.tiktok.com/doc/oauth-user-access-token-management
"""

import logging

import requests

import config
from rate_limiter import api_call

logger = logging.getLogger(__name__)

_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"


def exchange_code_for_token(auth_code: str, redirect_uri: str) -> dict:
    """
    Exchange a one-time authorisation code for access + refresh tokens.

    Call this ONCE after the user completes the OAuth consent screen.
    Store the returned tokens in your .env file.

    Returns a dict with:  access_token, refresh_token, open_id, expires_in, etc.
    """
    response = api_call(
        requests.post,
        _TOKEN_URL,
        data={
            "client_key": config.TIKTOK_CLIENT_KEY,
            "client_secret": config.TIKTOK_CLIENT_SECRET,
            "code": auth_code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    data = response.json()
    logger.info("Token exchange successful. open_id: %s", data.get("open_id"))
    return data


def refresh_access_token(refresh_token: str) -> dict:
    """
    Use a refresh token to get a new access token.

    Call this before the access token expires (check expires_in from the
    original token response).  Update TIKTOK_ACCESS_TOKEN in .env afterward.

    Returns a new token dict with updated access_token, refresh_token, etc.
    """
    response = api_call(
        requests.post,
        _TOKEN_URL,
        data={
            "client_key": config.TIKTOK_CLIENT_KEY,
            "client_secret": config.TIKTOK_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    data = response.json()
    logger.info("Token refreshed successfully.")
    return data


def _auth_headers() -> dict:
    """Return the Authorization header dict used by all TikTok API calls."""
    return {"Authorization": f"Bearer {config.TIKTOK_ACCESS_TOKEN}"}
