#!/usr/bin/env python3
# scripts/error_sentry.py (lightweight)
import httpx, time, os

BASE=os.getenv("BASE","http://localhost:8013")
PAGES=["/openapi.json","/health","/api/unified-chat/health"]

with httpx.Client(timeout=4) as c:
    errs=[]
    for p in PAGES:
        r=c.get(BASE+p)
        if r.status_code>=500: errs.append((p,r.status_code))
    if errs: raise SystemExit(f"500s: {errs}")

