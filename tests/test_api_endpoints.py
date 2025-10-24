#!/usr/bin/env python3
"""
Basic API endpoint tests
"""
import requests
import json
import time

def test_health_endpoint():
    """Test health endpoint"""
    try:
        response = requests.get('http://localhost:8004/health', timeout=5)
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        print("✅ Health endpoint test passed")
        return True
    except Exception as e:
        print(f"❌ Health endpoint test failed: {e}")
        return False

def test_chat_endpoint():
    """Test chat endpoint"""
    try:
        response = requests.post(
            'http://localhost:8004/api/chat',
            json={'message': 'Hello Athena!'},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert 'response' in data or 'message' in data
        print("✅ Chat endpoint test passed")
        return True
    except Exception as e:
        print(f"❌ Chat endpoint test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Running basic API tests...")
    
    tests = [
        test_health_endpoint,
        test_chat_endpoint
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        exit(0)
    else:
        print("❌ Some tests failed!")
        exit(1)
