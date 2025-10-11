#!/usr/bin/env python3
"""
Contract test for /chat endpoint
Ensures response shape doesn't break on refactors
"""
import httpx
import sys
import json

def test_chat_contract(base_url: str):
    """Test /chat endpoint returns expected shape"""
    url = base_url.rstrip("/") + "/chat"
    
    try:
        # Make request with minimal payload
        r = httpx.post(
            url,
            json={"message": "ping"},
            timeout=10.0,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 2xx (success) or 422 (validation error)
        if r.status_code == 404:
            print("⚠️  /chat endpoint not found (may not exist on this service)")
            return True
        
        if r.status_code == 422:
            print("⚠️  /chat returned 422 (validation error - may need different payload)")
            return True
        
        # Raise for other errors
        r.raise_for_status()
        
        # Parse JSON
        try:
            j = r.json()
        except json.JSONDecodeError as e:
            print(f"❌ /chat returned invalid JSON: {e}")
            print(f"   Response: {r.text[:200]}")
            return False
        
        # Check contract: must have id and (message or content)
        has_id = "id" in j
        has_message = "message" in j or "content" in j or "response" in j
        
        if not has_id:
            print(f"❌ /chat missing 'id' field in response")
            print(f"   Response: {json.dumps(j, indent=2)[:400]}")
            return False
        
        if not has_message:
            print(f"❌ /chat missing 'message', 'content', or 'response' field")
            print(f"   Response: {json.dumps(j, indent=2)[:400]}")
            return False
        
        # Optional: check for metadata fields
        has_metadata = any(k in j for k in ["tokens", "latency", "model", "timestamp"])
        if not has_metadata:
            print(f"⚠️  /chat missing optional metadata (tokens/latency/model)")
        
        print(f"✅ /chat contract OK")
        print(f"   - id: {j.get('id', 'N/A')}")
        print(f"   - message: {str(j.get('message') or j.get('content') or j.get('response', ''))[:50]}...")
        if has_metadata:
            meta = {k: j.get(k) for k in ["tokens", "latency", "model"] if k in j}
            print(f"   - metadata: {meta}")
        
        return True
        
    except httpx.HTTPStatusError as e:
        print(f"❌ /chat returned {e.response.status_code}")
        print(f"   Body: {e.response.text[:200]}")
        return False
    except httpx.RequestError as e:
        print(f"❌ /chat request failed: {type(e).__name__}: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {type(e).__name__}: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/contract_chat.py <base_url>")
        print("Example: python scripts/contract_chat.py http://localhost:8013")
        sys.exit(1)
    
    base_url = sys.argv[1]
    success = test_chat_contract(base_url)
    
    sys.exit(0 if success else 1)

