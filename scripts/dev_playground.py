#!/usr/bin/env python3
"""
Dev Playground - Quick API testing
Poke the API and see immediate results
"""
import httpx
import json
import sys

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8013"

print(f"🎮 Dev Playground - Testing {BASE}")
print("=" * 80)

# Test 1: Health check
print("\n1. Health Check")
try:
    r = httpx.get(f"{BASE}/health", timeout=5)
    print(f"   ✅ GET /health → {r.status_code}")
    print(f"   Response: {r.text[:120]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: OpenAPI spec
print("\n2. OpenAPI Spec")
try:
    r = httpx.get(f"{BASE}/openapi.json", timeout=5)
    print(f"   ✅ GET /openapi.json → {r.status_code}")
    if r.status_code == 200:
        spec = r.json()
        print(f"   Endpoints: {len(spec.get('paths', {}))}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Chat endpoint
print("\n3. Chat Endpoint")
try:
    r = httpx.post(
        f"{BASE}/chat",
        json={"message": "hello from dev playground"},
        timeout=10
    )
    print(f"   ✅ POST /chat → {r.status_code}")
    print(f"   Response: {r.text[:200]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Custom test
print("\n4. Custom Test (modify as needed)")
try:
    # Add your own test here
    r = httpx.get(f"{BASE}/api/models", timeout=5)
    print(f"   ✅ GET /api/models → {r.status_code}")
    if r.status_code == 200:
        print(f"   Response: {r.text[:200]}")
except Exception as e:
    print(f"   ⚠️  Endpoint may not exist: {e}")

print("\n" + "=" * 80)
print("🎮 Playground complete. Edit this script to add your own tests!")

