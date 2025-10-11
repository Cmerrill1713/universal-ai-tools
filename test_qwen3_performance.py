#!/usr/bin/env python3
"""
Qwen3 30B Performance Test Script
Tests the new Qwen3-Coder-30B model performance
"""

import requests
import json
import time
import sys

def test_qwen3_performance():
    """Test Qwen3 30B model performance"""
    print("🧪 TESTING QWEN3 30B PERFORMANCE")
    print("================================")
    
    # Test endpoint
    url = "http://localhost:8001/v1/chat/completions"
    
    # Test payload
    payload = {
        "model": "qwen3-coder-30b",
        "messages": [
            {"role": "user", "content": "Write a Python function to calculate fibonacci numbers efficiently"}
        ],
        "max_tokens": 200,
        "temperature": 0.7
    }
    
    try:
        print("📡 Sending request to Qwen3 30B...")
        start_time = time.time()
        
        response = requests.post(url, json=payload, timeout=60)
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response.status_code == 200:
            result = response.json()
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            print(f"✅ SUCCESS!")
            print(f"⏱️  Response time: {duration:.2f} seconds")
            print(f"📝 Generated content:")
            print("-" * 50)
            print(content)
            print("-" * 50)
            
            # Calculate tokens per second (rough estimate)
            word_count = len(content.split())
            estimated_tokens = word_count * 1.3  # rough conversion
            tokens_per_second = estimated_tokens / duration if duration > 0 else 0
            
            print(f"📊 Estimated tokens/second: {tokens_per_second:.0f}")
            
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - MLX service not ready yet")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    test_qwen3_performance()
