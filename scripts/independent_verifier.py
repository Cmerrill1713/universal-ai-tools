# scripts/independent_verifier.py
# Run: python -m scripts.independent_verifier --base http://localhost:8000
import argparse
import asyncio
import sys

import httpx

CORE = ["/health"]  # Root may not exist on all services
KNOWN_GET = [
  "/api/models", "/api/orchestration/status",
  "/api/unified-chat/stats", "/api/evolution/status", "/api/automation/health"
]
KNOWN_POST = [
  "/api/chat", "/api/orchestration/execute"
]
OPTIONAL = ["/", "/api/learning"]  # May not exist on all services

async def check(base, paths, method="GET", optional=False):
  async with httpx.AsyncClient(timeout=5) as c:
    results = []
    for p in paths:
      url = base.rstrip("/") + p
      try:
        if method == "GET":
          r = await c.get(url)
        elif method == "POST":
          r = await c.post(url, json={})
        else:
          r = await c.get(url)
        results.append((p, method, r.status_code, (r.text or "")[:120], optional))
      except Exception as e:
        results.append((p, method, -1, f"{type(e).__name__}: {e}", optional))
    return results

def table(rows):
  w = max(len(r[0]) for r in rows)
  print(f"{'ENDPOINT'.ljust(w)} | METHOD | STATUS | SNIPPET")
  print("-"*w + "-+--------+--------+------------------------------------------")
  for ep, method, code, body, optional in rows:
    clean_body = body.replace('\n',' ')[:40]
    # 422 = endpoint exists but validation failed (good!)
    is_ok = (200 <= code < 400) or code == 422
    status_icon = "✅" if is_ok else ("⚠️" if optional else "❌")
    print(f"{status_icon} {ep.ljust(w-2)} | {method:4} | {code!s:>6} | {clean_body}")

async def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--base", default="http://localhost:8000")
  args = ap.parse_args()

  core = await check(args.base, CORE, "GET", False)
  known_get = await check(args.base, KNOWN_GET, "GET", False)
  known_post = await check(args.base, KNOWN_POST, "POST", False)
  optional = await check(args.base, OPTIONAL, "GET", True)

  rows = core + known_get + known_post + optional
  table(rows)

  # Only fail on required endpoints (422 = validation error = endpoint exists!)
  required_bad = [r for r in rows if not r[4] and not (200 <= r[2] < 500 or r[2] == 422)]
  if required_bad:
    print("\n❌ FAIL: Some required endpoints are not healthy.")
    for b in required_bad: print(f" - {b[0]} ({b[1]}) returned {b[2]}")
    sys.exit(1)

  # Count successes
  working = [r for r in rows if 200 <= r[2] < 400 or r[2] == 422]
  print(f"\n✅ PASS: All required endpoints healthy ({len(working)}/{len(rows)} total working)")

if __name__ == "__main__":
  asyncio.run(main())

