#!/usr/bin/env python3
"""Quick 500 detector for critical pages with retry backoff"""
import httpx, time, os, sys

BASE = os.getenv("BASE", "http://localhost:8013")
PAGES = ["/openapi.json", "/health", "/api/unified-chat/health"]
MAX_RETRIES = 3
BACKOFF = [1, 2, 4]  # seconds

def fetch_with_retry(client, url, retries=MAX_RETRIES):
    """Fetch with exponential backoff to handle startup blips"""
    for attempt in range(retries):
        try:
            r = client.get(url)
            if r.status_code < 500:
                return r
            # 500+ error, maybe transient
            if attempt < retries - 1:
                time.sleep(BACKOFF[attempt])
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            # Connection errors during startup
            if attempt < retries - 1:
                time.sleep(BACKOFF[attempt])
            else:
                raise
    return r  # Return last response

with httpx.Client(timeout=4) as c:
    errs = []
    for p in PAGES:
        try:
            r = fetch_with_retry(c, BASE + p)
            if r.status_code >= 500:
                errs.append((p, r.status_code, r.text[:100]))
        except Exception as e:
            errs.append((p, "ERROR", f"{type(e).__name__}: {e}"))

if errs:
    for path, code, detail in errs:
        print(f"❌ {path} → {code}: {detail}", file=sys.stderr)
    raise SystemExit(f"500s detected after {MAX_RETRIES} retries: {len(errs)} endpoints failed")
