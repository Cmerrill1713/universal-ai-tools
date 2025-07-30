#!/usr/bin/env python3
"""
Test script to demonstrate iOS app backend connectivity
This simulates the exact same requests the iOS app would make
"""

import requests
import json
import time

def test_backend_connectivity():
    """Test the backend connectivity that the iOS app uses"""
    
    print("🧪 Testing Universal AI Tools Backend Connectivity")
    print("=" * 50)
    
    # Test 1: Health Check (same as iOS app initialization)
    print("\n1. Testing Health Check (iOS app initialization)...")
    try:
        response = requests.get("http://localhost:9999/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"   ✅ Health check successful")
            print(f"   📊 Status: {health_data['status']}")
            print(f"   🕒 Uptime: {health_data['uptime']:.1f}s")
            print(f"   🤖 Agents available: {health_data['agents']['total']}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Health check error: {e}")
        return False
    
    # Test 2: Chat Message (same as iOS app chat functionality)
    print("\n2. Testing Chat Endpoint (iOS app chat functionality)...")
    try:
        chat_payload = {
            "message": "Hello from iOS Simulator test!",
            "user_id": "ios_simulator_test_user"
        }
        
        response = requests.post(
            "http://localhost:9999/api/v1/chat",
            headers={"Content-Type": "application/json"},
            json=chat_payload,
            timeout=10
        )
        
        if response.status_code == 200:
            chat_data = response.json()
            if chat_data.get("success"):
                ai_response = chat_data["data"]["message"]["content"]
                agent_name = chat_data["metadata"]["agentName"]
                print(f"   ✅ Chat request successful")
                print(f"   🤖 Agent: {agent_name}")
                print(f"   💬 AI Response: {ai_response}")
                print(f"   ⏱️  Execution time: {chat_data['data']['usage']['executionTime']}")
            else:
                print(f"   ❌ Chat request failed: {chat_data}")
                return False
        else:
            print(f"   ❌ Chat request failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Chat request error: {e}")
        return False
    
    # Test 3: Multiple Chat Messages (iOS app conversation flow)
    print("\n3. Testing Conversation Flow (multiple messages)...")
    test_messages = [
        "What can you help me with?",
        "Can you tell me about Universal AI Tools?",
        "How does the iOS companion app work?"
    ]
    
    for i, message in enumerate(test_messages, 1):
        try:
            chat_payload = {
                "message": message,
                "user_id": "ios_simulator_conversation_test"
            }
            
            response = requests.post(
                "http://localhost:9999/api/v1/chat",
                headers={"Content-Type": "application/json"},
                json=chat_payload,
                timeout=10
            )
            
            if response.status_code == 200:
                chat_data = response.json()
                if chat_data.get("success"):
                    ai_response = chat_data["data"]["message"]["content"]
                    print(f"   {i}. User: {message}")
                    print(f"      AI: {ai_response[:100]}...")
                    time.sleep(0.5)  # Simulate user typing delay
                else:
                    print(f"   ❌ Message {i} failed: {chat_data}")
                    return False
            else:
                print(f"   ❌ Message {i} failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"   ❌ Message {i} error: {e}")
            return False
    
    print("\n" + "=" * 50)
    print("🎉 ALL TESTS PASSED!")
    print("\n📱 iOS App Backend Connectivity Status:")
    print("   ✅ Health checks working")
    print("   ✅ Chat functionality working") 
    print("   ✅ Conversation flow working")
    print("   ✅ All endpoints responding correctly")
    print("\n🚀 The iOS app can successfully connect to and communicate with the backend!")
    
    return True

if __name__ == "__main__":
    success = test_backend_connectivity()
    exit(0 if success else 1)