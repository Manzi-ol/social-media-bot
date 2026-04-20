"""
config.py — Centralised configuration loader.
All secrets come from the .env file; nothing is hardcoded here.
"""

import os
from dotenv import load_dotenv

# Load variables from .env into os.environ
load_dotenv()


def _require(key: str) -> str:
    """Return env variable or raise a clear error if it is missing."""
    value = os.getenv(key)
    if not value:
        raise EnvironmentError(
            f"Missing required environment variable: '{key}'. "
            "Check your .env file against .env.example."
        )
    return value


# ── Instagram ────────────────────────────────────────────────
INSTAGRAM_APP_ID = _require("INSTAGRAM_APP_ID")
INSTAGRAM_APP_SECRET = _require("INSTAGRAM_APP_SECRET")
INSTAGRAM_PAGE_ACCESS_TOKEN = _require("INSTAGRAM_PAGE_ACCESS_TOKEN")
INSTAGRAM_BUSINESS_ACCOUNT_ID = _require("INSTAGRAM_BUSINESS_ACCOUNT_ID")
INSTAGRAM_WEBHOOK_VERIFY_TOKEN = _require("INSTAGRAM_WEBHOOK_VERIFY_TOKEN")

# Instagram Graph API base URL (always pin a version)
IG_API_BASE = "https://graph.facebook.com/v20.0"

# ── TikTok ───────────────────────────────────────────────────
TIKTOK_CLIENT_KEY = _require("TIKTOK_CLIENT_KEY")
TIKTOK_CLIENT_SECRET = _require("TIKTOK_CLIENT_SECRET")
TIKTOK_ACCESS_TOKEN = _require("TIKTOK_ACCESS_TOKEN")
TIKTOK_OPEN_ID = _require("TIKTOK_OPEN_ID")

TIKTOK_API_BASE = "https://open.tiktokapis.com/v2"

# ── Bot behaviour ────────────────────────────────────────────
TRIGGER_KEYWORDS = [
    kw.strip().upper()
    for kw in os.getenv("TRIGGER_KEYWORDS", "LINK").split(",")
    if kw.strip()
]
DM_MESSAGE = os.getenv(
    "DM_MESSAGE",
    "Hey! Here is the link you asked for: https://your-link.com"
)
RATE_LIMIT_RETRY_SECONDS = int(os.getenv("RATE_LIMIT_RETRY_SECONDS", "60"))
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "8000"))
