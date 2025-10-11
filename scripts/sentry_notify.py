#!/usr/bin/env python3
"""
Telegram notification wrapper for error_sentry.py
Sends alert when 500 errors are detected
"""
import os
import subprocess
import sys

BASE = os.getenv("BASE", "http://localhost:8013")

# Run error_sentry.py
rc = subprocess.call(
    ["python3", "scripts/error_sentry.py"],
    env={"BASE": BASE, **os.environ}
)

# If failed (500s detected), send Telegram notification
if rc != 0:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    
    if token and chat:
        try:
            import requests
            
            message = f"""
❌ *500 Errors Detected*

Service: `{BASE}`
Status: FAILED

Investigate immediately:
```
BASE={BASE} make sentry
```
            """.strip()
            
            requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={
                    "chat_id": chat,
                    "text": message,
                    "parse_mode": "Markdown"
                },
                timeout=5
            )
            print(f"📱 Telegram alert sent to chat {chat}")
        except Exception as e:
            print(f"⚠️  Failed to send Telegram alert: {e}", file=sys.stderr)
    else:
        print("⚠️  TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set", file=sys.stderr)
    
    sys.exit(rc)

print("✅ No 500 errors detected")
sys.exit(0)

