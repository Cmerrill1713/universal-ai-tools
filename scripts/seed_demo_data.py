#!/usr/bin/env python3
"""
Seed Demo Data - Populate database with sample data for development
"""
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8013"

print(f"🌱 Seeding demo data to {BASE}")
print("=" * 80)

# Sample users
users = [
    {"name": "Alice Developer", "email": "alice@example.com", "role": "developer"},
    {"name": "Bob Manager", "email": "bob@example.com", "role": "manager"},
    {"name": "Charlie Analyst", "email": "charlie@example.com", "role": "analyst"},
]

# Sample tasks
tasks = [
    {"title": "Implement feature X", "description": "Build the new feature", "priority": "high"},
    {"title": "Fix bug in router", "description": "Router returning 500", "priority": "critical"},
    {"title": "Write documentation", "description": "Document the API", "priority": "medium"},
]

print("\n📝 Creating users...")
for user in users:
    try:
        r = httpx.post(f"{BASE}/api/users/", json=user, timeout=5)
        if r.status_code in [200, 201]:
            print(f"   ✅ Created: {user['name']}")
        elif r.status_code == 404:
            print("   ⚠️  Endpoint /api/users/ not found (may not exist)")
            break
        else:
            print(f"   ⚠️  {user['name']} → {r.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        break

print("\n📋 Creating tasks...")
for task in tasks:
    try:
        r = httpx.post(f"{BASE}/api/tasks/", json=task, timeout=5)
        if r.status_code in [200, 201]:
            print(f"   ✅ Created: {task['title']}")
        elif r.status_code == 404:
            print("   ⚠️  Endpoint /api/tasks/ not found (may not exist)")
            break
        else:
            print(f"   ⚠️  {task['title']} → {r.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        break

print("\n" + "=" * 80)
print("🌱 Seeding complete!")

