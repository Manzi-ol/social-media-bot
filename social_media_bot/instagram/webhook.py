"""
instagram/webhook.py — Flask webhook server for Instagram Graph API events.

HOW TO SET UP THE META WEBHOOK
───────────────────────────────
1. Go to https://developers.facebook.com/apps/ → your app → Webhooks.
2. Click "Add Subscription" for the Instagram object.
3. Set Callback URL to:  https://<your-public-domain>/webhook
   (Use ngrok during development: `ngrok http 8000` gives you a public URL)
4. Set Verify Token to the same value as INSTAGRAM_WEBHOOK_VERIFY_TOKEN in .env
5. Subscribe to the field:  comments
6. Click "Verify and Save".

The webhook will then fire a POST request here for every new comment.
"""

import hashlib
import hmac
import json
import logging

from flask import Flask, request, jsonify, abort

import config
from instagram.dm import send_dm, like_comment

logger = logging.getLogger(__name__)

app = Flask(__name__)

# ── Track processed comment IDs to prevent duplicate DMs ──────────────────────
# In production replace this with a Redis set or a small SQLite table.
_processed_comments: set[str] = set()


def _verify_signature(payload: bytes, sig_header: str) -> bool:
    """
    Validate that the incoming request really came from Meta by checking
    the X-Hub-Signature-256 HMAC header.
    """
    if not sig_header or not sig_header.startswith("sha256="):
        return False
    expected = hmac.new(
        config.INSTAGRAM_APP_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    received = sig_header[len("sha256="):]
    return hmac.compare_digest(expected, received)


@app.route("/webhook", methods=["GET"])
def webhook_verify():
    """
    Meta sends a GET request to verify the webhook endpoint.
    We must echo back hub.challenge when hub.verify_token matches.
    """
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token == config.INSTAGRAM_WEBHOOK_VERIFY_TOKEN:
        logger.info("Webhook verified successfully.")
        return challenge, 200

    logger.warning("Webhook verification failed (bad token or mode).")
    abort(403)


@app.route("/webhook", methods=["POST"])
def webhook_receive():
    """
    Receive real-time comment events from Meta.
    For each comment that contains a trigger keyword:
      1. Send the commenter a pre-written DM.
      2. Like their comment.
    """
    # Verify the request signature for security
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_signature(request.data, sig):
        logger.warning("Rejected webhook POST: invalid signature.")
        abort(403)

    payload = request.get_json(force=True)
    logger.debug("Webhook payload received: %s", json.dumps(payload, indent=2))

    # Walk the nested Meta webhook envelope
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "comments":
                continue

            value = change.get("value", {})
            comment_id = value.get("id")
            comment_text: str = value.get("text", "")
            commenter_id = value.get("from", {}).get("id")

            if not comment_id or not commenter_id:
                continue

            # Skip already-handled comments (idempotency guard)
            if comment_id in _processed_comments:
                logger.debug("Comment %s already processed, skipping.", comment_id)
                continue

            # Check whether the comment contains any trigger keyword
            upper_text = comment_text.upper()
            triggered = any(kw in upper_text for kw in config.TRIGGER_KEYWORDS)

            if triggered:
                logger.info(
                    "Trigger keyword found in comment %s by user %s.",
                    comment_id, commenter_id,
                )
                send_dm(recipient_id=commenter_id, message=config.DM_MESSAGE)
                like_comment(comment_id=comment_id)
                _processed_comments.add(comment_id)

    # Always return 200 quickly — Meta will retry if we return anything else
    return jsonify({"status": "ok"}), 200


def run_webhook_server():
    """Start the Flask development server (use gunicorn/uwsgi in production)."""
    logger.info("Starting webhook server on port %d ...", config.WEBHOOK_PORT)
    # debug=False and use_reloader=False are important for production safety
    app.run(host="0.0.0.0", port=config.WEBHOOK_PORT, debug=False, use_reloader=False)
