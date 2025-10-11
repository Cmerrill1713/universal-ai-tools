#!/usr/bin/env python3
# Run: python -m scripts.independent_verifier_v2 --base http://localhost:8000
import argparse, sys, asyncio, importlib, json, time
from typing import Dict, List, Tuple
import httpx

SAFE_POST_SAMPLES: Dict[str, dict] = {
    "/chat": {
        "message": "ping",
        "metadata": {"source": "verifier"}
    },
    "/orchestration/plan": {"task": "hello world"},
    "/orchestration/status": {"id": "test-status-id"},
    "/learning": {"query": "what models are loaded?"}
}

# Optional module existence checks (tweak to your repo)
MODULE_CHECKS = [
    "api",                        # should import after PYTHONPATH/sitecustomize fix
    "src.core.training.grade_record",  # ensures GradeRecord is no longer commented-out
    "src.core.unified_orchestration.unified_chat_orchestrator",
    "src.core.optimization.optimized_api_server",
]

def ok(b: bool) -> str: return "✅" if b else "❌"

async def fetch_openapi(base: str) -> dict:
    url = base.rstrip("/") + "/openapi.json"
    async with httpx.AsyncClient(timeout=6) as c:
        r = await c.get(url)
        r.raise_for_status()
        return r.json()

async def hit(client: httpx.AsyncClient, base: str, method: str, path: str) -> Tuple[int, str]:
    url = base.rstrip("/") + path
    try:
        if method == "get":
            r = await client.get(url)
        elif method == "post":
            payload = SAFE_POST_SAMPLES.get(path, {})
            r = await client.post(url, json=payload)
        else:
            return (-2, f"SKIP {method.upper()}")
        return (r.status_code, (r.text or "")[:140].replace("\n", " "))
    except Exception as e:
        return (-1, f"{type(e).__name__}: {e}")

def import_checks() -> List[Tuple[str, bool, str]]:
    out = []
    for mod in MODULE_CHECKS:
        try:
            m = importlib.import_module(mod)
            out.append((mod, True, "import ok"))
        except Exception as e:
            out.append((mod, False, f"{type(e).__name__}: {e}"))
    # Deep attribute sanity for GradeRecord if present
    try:
        gr = importlib.import_module("src.core.training.grade_record")
        has_cls = hasattr(gr, "GradeRecord")
        out.append(("GradeRecord class", has_cls, "present" if has_cls else "MISSING"))
    except Exception as e:
        out.append(("GradeRecord module", False, f"{type(e).__name__}: {e}"))
    return out

def summarize_http(results: List[Tuple[str, str, int, str]]) -> None:
    w = max(len(p) for _, p, _, _ in results) if results else 20
    print(f"\nHTTP CHECKS")
    print(f"{'METHOD'.ljust(7)} {'PATH'.ljust(w)} STATUS  SNIPPET")
    print("-" * (7 + 1 + w + 1 + 7 + 2 + 40))
    for m, p, code, snip in results:
        print(f"{m.upper():7} {p.ljust(w)} {str(code).rjust(6)}  {snip}")

def pct(a: int, b: int) -> float:
    return round(100.0 * a / max(b, 1), 1)

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--include-posts", action="store_true", help="Also test safe POST routes with tiny payloads")
    args = ap.parse_args()

    base = args.base
    start = time.time()

    # 1) Import / module sanity
    mod_rows = import_checks()
    print("IMPORT CHECKS")
    for name, passed, msg in mod_rows:
        print(f" - {name}: {ok(passed)} {msg}")
    if not all(p for _, p, _ in mod_rows):
        print("\n❌ Import failures detected. Fix imports before HTTP checks.")
        # Continue anyway to show HTTP status, but exit non-zero at the end.

    # 2) OpenAPI discovery
    discovered = []
    openapi_errors = []
    try:
        spec = await fetch_openapi(base)
        paths = spec.get("paths", {})
        for path, methods in paths.items():
            for method in list(methods.keys()):
                if method.lower() not in ("get", "post"):
                    continue
                if method.lower() == "post" and not args.include_posts:
                    continue
                discovered.append((method.lower(), path))
    except Exception as e:
        openapi_errors.append(f"OpenAPI fetch failed: {type(e).__name__}: {e}")

    # Always include a core set even if OpenAPI fails
    core_gets = [("/",), ("/health",), ("/models",), ("/learning",)]
    for (p,) in core_gets:
        if ("get", p) not in discovered:
            discovered.append(("get", p))
    if args.include_posts:
        for p in SAFE_POST_SAMPLES.keys():
            if ("post", p) not in discovered:
                discovered.append(("post", p))

    # 3) HTTP checks
    results = []
    async with httpx.AsyncClient(timeout=6) as c:
        for method, path in discovered:
            code, snip = await hit(c, base, method, path)
            results.append((method, path, code, snip))

    summarize_http(results)

    # 4) Scoring
    total = len(results)
    oks = sum(1 for _, _, code, _ in results if code >= 200 and code < 400)
    posts = [r for r in results if r[0] == "post"]
    gets = [r for r in results if r[0] == "get"]

    print("\nSUMMARY")
    print(f" - GETs: {len(gets)} paths -> {oks if not posts else sum(1 for r in gets if 200 <= r[2] < 400)} OK")
    if posts:
        ok_posts = sum(1 for r in posts if 200 <= r[2] < 400)
        print(f" - POSTs: {len(posts)} paths -> {ok_posts} OK")
    print(f" - Overall: {oks}/{total} ({pct(oks,total)}%)")
    if openapi_errors:
        print(" - OpenAPI:", "; ".join(openapi_errors))

    duration = round(time.time() - start, 2)
    print(f"\nDuration: {duration}s")

    # Exit code rules:
    all_imports_ok = all(p for _, p, _ in mod_rows)
    all_http_ok = oks == total and total > 0
    sys.exit(0 if (all_imports_ok and all_http_ok) else 1)

if __name__ == "__main__":
    asyncio.run(main())

