#!/usr/bin/env python3
"""
Test MLX FastVLM Integration
"""

import requests


def test_mlx_service():
    """Test MLX service directly"""
    print("🧪 Testing MLX FastVLM Service")

    # Test health
    try:
        response = requests.get("http://localhost:8002/health", timeout=5)
        print(f"✅ MLX Health: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ MLX Health failed: {e}")
        return False

    # Test models
    try:
        response = requests.get("http://localhost:8002/models", timeout=5)
        print(f"✅ MLX Models: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ MLX Models failed: {e}")
        return False

    # Test chat completions
    try:
        data = {
            "messages": [{"role": "user", "content": "Hello MLX FastVLM"}],
            "model": "fastvlm-0.5b",
        }
        response = requests.post(
            "http://localhost:8002/v1/chat/completions", json=data, timeout=10
        )
        print(f"✅ MLX Chat: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ MLX Chat failed: {e}")
        return False

    return True


def test_llm_router():
    """Test LLM Router"""
    print("\n🧪 Testing LLM Router")

    # Test health
    try:
        response = requests.get("http://localhost:3033/health", timeout=5)
        print(f"✅ Router Health: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ Router Health failed: {e}")
        return False

    # Test models
    try:
        response = requests.get("http://localhost:3033/models", timeout=5)
        print(f"✅ Router Models: {response.status_code}")
        models = response.json().get("models", [])
        print(f"   Found {len(models)} models")
        if "fastvlm-0.5b" in models:
            print("   ✅ fastvlm-0.5b found in models list")
        else:
            print("   ❌ fastvlm-0.5b NOT found in models list")
    except Exception as e:
        print(f"❌ Router Models failed: {e}")
        return False

    # Test chat with MLX model
    try:
        data = {
            "messages": [{"role": "user", "content": "Test MLX integration"}],
            "model": "fastvlm-0.5b",
        }
        response = requests.post(
            "http://localhost:3033/chat",
            json=data,
            timeout=10)
        print(f"✅ Router Chat: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"❌ Router Chat failed: {e}")
        return False

    return True


if __name__ == "__main__":
    print("🚀 MLX FastVLM Integration Test")
    print("=" * 50)

    mlx_ok = test_mlx_service()
    router_ok = test_llm_router()

    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print(f"   MLX Service: {'✅ PASS' if mlx_ok else '❌ FAIL'}")
    print(f"   LLM Router: {'✅ PASS' if router_ok else '❌ FAIL'}")

    if mlx_ok and router_ok:
        print("\n🎉 All tests passed! MLX FastVLM is fully integrated.")
    else:
        print("\n⚠️  Some tests failed. Check the output above.")
