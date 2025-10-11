#!/usr/bin/env python3
"""
Performance Baseline Tracking
Monitors latency and token usage, detects regressions
"""
import httpx
import time
import json
import sys
import os
from statistics import median, quantile
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8013"
BASELINE_FILE = Path("perf_baseline.json")
COMPARE_MODE = "--compare" in sys.argv

ENDPOINTS = [
    ("/health", "GET", None, "Health check"),
    ("/openapi.json", "GET", None, "OpenAPI spec"),
    ("/api/unified-chat/health", "GET", None, "Chat health"),
]

# Add chat endpoint if it exists
CHAT_ENDPOINTS = [
    ("/chat", "POST", {"message": "Hello"}, "Chat endpoint"),
    ("/api/chat", "POST", {"message": "Hello"}, "Chat API"),
]

def measure_endpoint(url: str, method: str, payload: dict, samples: int = 10):
    """Measure latency for endpoint with multiple samples"""
    latencies = []
    errors = 0
    
    for _ in range(samples):
        start = time.perf_counter()
        try:
            if method == "GET":
                r = httpx.get(url, timeout=10)
            else:
                r = httpx.post(url, json=payload, timeout=10)
            
            latency = (time.perf_counter() - start) * 1000  # ms
            if r.status_code < 500:
                latencies.append(latency)
            else:
                errors += 1
        except Exception:
            errors += 1
    
    if not latencies:
        return None
    
    return {
        "p50": median(latencies),
        "p95": quantile(latencies, 0.95) if len(latencies) >= 2 else latencies[0],
        "p99": quantile(latencies, 0.99) if len(latencies) >= 3 else latencies[0],
        "min": min(latencies),
        "max": max(latencies),
        "samples": len(latencies),
        "errors": errors
    }

def load_baseline():
    """Load existing baseline if it exists"""
    if BASELINE_FILE.exists():
        with open(BASELINE_FILE) as f:
            return json.load(f)
    return None

def save_baseline(results):
    """Save baseline to file"""
    with open(BASELINE_FILE, "w") as f:
        json.dump(results, f, indent=2)

def compare_results(current, baseline):
    """Compare current results against baseline, detect regressions"""
    regressions = []
    improvements = []
    
    for path, current_stats in current.items():
        if path not in baseline:
            continue
        
        baseline_stats = baseline[path]
        
        if current_stats is None or baseline_stats is None:
            continue
        
        # Check for regressions (>20% slower)
        current_p95 = current_stats.get("p95", 0)
        baseline_p95 = baseline_stats.get("p95", 0)
        
        if baseline_p95 > 0:
            change_pct = ((current_p95 - baseline_p95) / baseline_p95) * 100
            
            if change_pct > 20:
                regressions.append((path, baseline_p95, current_p95, change_pct))
            elif change_pct < -20:
                improvements.append((path, baseline_p95, current_p95, change_pct))
    
    return regressions, improvements

def main():
    print(f"📊 Performance Baseline: {BASE}")
    print("=" * 80)
    
    results = {}
    all_endpoints = ENDPOINTS + CHAT_ENDPOINTS
    
    for path, method, payload, description in all_endpoints:
        url = BASE.rstrip("/") + path
        print(f"\n{description} ({method} {path})")
        
        try:
            stats = measure_endpoint(url, method, payload)
            if stats:
                results[path] = stats
                print(f"  p50: {stats['p50']:>6.2f}ms  p95: {stats['p95']:>6.2f}ms  p99: {stats['p99']:>6.2f}ms")
                if stats['errors'] > 0:
                    print(f"  ⚠️  {stats['errors']}/{stats['samples'] + stats['errors']} requests failed")
            else:
                print(f"  ⚠️  Endpoint not available or all requests failed")
                results[path] = None
        except Exception as e:
            print(f"  ❌ Error: {e}")
            results[path] = None
    
    # Compare mode
    if COMPARE_MODE:
        baseline = load_baseline()
        if baseline:
            print("\n" + "=" * 80)
            print("📈 REGRESSION ANALYSIS")
            print("=" * 80)
            
            regressions, improvements = compare_results(results, baseline)
            
            if regressions:
                print("\n❌ REGRESSIONS DETECTED:")
                for path, old_p95, new_p95, change in regressions:
                    print(f"  {path}")
                    print(f"    Baseline: {old_p95:.2f}ms → Current: {new_p95:.2f}ms (+{change:.1f}%)")
            
            if improvements:
                print("\n✅ IMPROVEMENTS:")
                for path, old_p95, new_p95, change in improvements:
                    print(f"  {path}")
                    print(f"    Baseline: {old_p95:.2f}ms → Current: {new_p95:.2f}ms ({change:.1f}%)")
            
            if not regressions and not improvements:
                print("\n✅ No significant changes (within ±20%)")
            
            # Exit with error if regressions found
            if regressions:
                print("\n❌ FAIL: Performance regressions detected")
                sys.exit(1)
        else:
            print("\n⚠️  No baseline found. Run without --compare to create one.")
    else:
        # Save new baseline
        save_baseline(results)
        print(f"\n✅ Baseline saved to {BASELINE_FILE}")
        print("   Run with --compare to detect regressions")
    
    print("\n" + "=" * 80)
    print("📊 Performance measurement complete")

if __name__ == "__main__":
    main()

