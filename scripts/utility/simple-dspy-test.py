#!/usr/bin/env python3
"""
Simple DSPy WebSocket Test
"""

import asyncio
import json
import websockets

async def test_dspy_simple():
    """Simple DSPy functionality test"""
    try:
        async with websockets.connect("ws://localhost:8766") as websocket:
            print("✅ Connected to DSPy WebSocket")
            
            # Test basic request
            request = {
                "requestId": "test-123",
                "method": "get_model_info",
                "params": {}
            }
            
            print("📤 Sending request:", json.dumps(request, indent=2))
            await websocket.send(json.dumps(request))
            
            print("📥 Waiting for response...")
            response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
            
            response_data = json.loads(response)
            print("✅ Got response:", json.dumps(response_data, indent=2))
            
            if response_data.get("success"):
                print("🎉 DSPy WebSocket service is working correctly!")
                return True
            else:
                print("❌ DSPy returned error:", response_data.get("error"))
                return False
                
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_dspy_simple())
    exit(0 if success else 1)