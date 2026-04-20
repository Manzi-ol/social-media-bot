# Social Media Bot

> Automate Instagram & TikTok engagement using **official APIs only** — no scraping, no headless browsers.

![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=flat&logo=flask&logoColor=white)
![Instagram](https://img.shields.io/badge/Instagram_API-E4405F?style=flat&logo=instagram&logoColor=white)
![TikTok](https://img.shields.io/badge/TikTok_API-000000?style=flat&logo=tiktok&logoColor=white)

---

## What it does

| Feature | Description |
|---------|-------------|
| **Keyword Auto-DM** | When someone comments "LINK" on your post, the bot instantly sends them a DM with your URL and likes their comment |
| **Daily Analytics** | Pulls follower growth, profile views & engagement rate for your last 5 posts — saves to CSV |
| **Scheduled Publishing** | Upload a local video + caption and publish it to both platforms at any date/time you choose |

---

## Project Structure

```
social_media_bot/
├── main.py                 ← CLI entry point
├── config.py               ← Loads secrets from .env
├── rate_limiter.py         ← Auto-retry on HTTP 429
├── analytics_reporter.py   ← Combined daily CSV report
├── scheduler.py            ← APScheduler + SQLite job store
├── instagram/
│   ├── webhook.py          ← Flask server + HMAC verification
│   ├── dm.py               ← send_dm() + like_comment()
│   ├── analytics.py        ← Insights API
│   └── publisher.py        ← Two-step Reels upload
└── tiktok/
    ├── auth.py             ← OAuth 2.0 helpers
    ├── analytics.py        ← Video stats
    └── publisher.py        ← Chunked FILE_UPLOAD
```

---

## Quick Start

```bash
git clone https://github.com/Manzi-ol/social-media-bot
cd social-media-bot/social_media_bot
pip install -r requirements.txt
cp .env.example .env          # fill in your API keys
python main.py                # starts webhook server + scheduler
```

---

## All Commands

```bash
python main.py                          # Run everything
python main.py --mode analytics         # Pull today's stats → CSV
python main.py --mode list              # See scheduled posts
python main.py --mode schedule \
  --platform instagram \
  --video-url "https://cdn.example.com/clip.mp4" \
  --caption "Check this out! #reels" \
  --run-date "2026-05-01 18:00:00" \
  --timezone "Africa/Kigali"
```

---

## Security

- Secrets stored in `.env` — never hardcoded
- Webhook requests verified with HMAC-SHA256
- Rate limiting with exponential back-off (reads `Retry-After` header)
- `.env` is in `.gitignore`

---

## Tech Stack

- **Flask** — Webhook HTTP server
- **APScheduler** — Cron-style post scheduling with SQLite persistence
- **requests** — HTTP client for all API calls
- **python-dotenv** — Secret management

---

*Part of [Manzi's 100 GitHub Projects Roadmap](https://github.com/Manzi-ol) · Project #23*