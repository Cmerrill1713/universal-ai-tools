#!/usr/bin/env python3
# scripts/db_health.py
import os, sys
import psycopg

url = os.environ.get("DATABASE_URL")
try:
    with psycopg.connect(url, connect_timeout=3) as conn:
        with conn.cursor() as cur: cur.execute("SELECT 1")
    print("DB OK"); sys.exit(0)
except Exception as e:
    print(f"DB FAIL: {e}"); sys.exit(1)

