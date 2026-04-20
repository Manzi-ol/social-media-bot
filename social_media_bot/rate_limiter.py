"""
rate_limiter.py — Retry logic with exponential back-off for HTTP 429 errors.

Usage:
    from rate_limiter import api_call
    response = api_call(requests.get, url, params=params)
"""

import time
import logging
from typing import Callable

import requests

logger = logging.getLogger(__name__)

# Maximum number of retry attempts before giving up
MAX_RETRIES = 5

# Initial wait in seconds; doubles each retry (1 → 2 → 4 → 8 → 16 → give up)
BASE_BACKOFF_SECONDS = 1


def api_call(
    method: Callable,
    url: str,
    max_retries: int = MAX_RETRIES,
    **kwargs,
) -> requests.Response:
    """
    Wrap any requests method (get, post, etc.) with automatic rate-limit
    handling.  On HTTP 429 the function reads the Retry-After header (if
    present) or uses exponential back-off, then retries up to max_retries
    times.

    Raises requests.HTTPError for non-429 HTTP errors after the final attempt.
    """
    backoff = BASE_BACKOFF_SECONDS

    for attempt in range(1, max_retries + 1):
        response = method(url, **kwargs)

        if response.status_code == 429:
            # Honour the server's Retry-After hint when available
            retry_after = int(response.headers.get("Retry-After", backoff))
            logger.warning(
                "Rate limit hit (attempt %d/%d). "
                "Waiting %d seconds before retry. URL: %s",
                attempt, max_retries, retry_after, url,
            )
            time.sleep(retry_after)
            backoff = min(backoff * 2, 300)  # cap at 5 minutes
            continue

        # Raise immediately for non-rate-limit HTTP errors
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            logger.error("HTTP error on %s: %s", url, exc)
            raise

        return response

    # All retries exhausted
    raise RuntimeError(
        f"API call to {url} failed after {max_retries} retries due to rate limiting."
    )
