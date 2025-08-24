#!/usr/bin/env python3
"""
WebSocket Health Check for DSPy Service
Tests WebSocket connectivity and basic functionality
"""

import asyncio
import json
import sys
import time
import websockets
import requests
from typing import Dict, Any, Optional

async def test_dspy_websocket_health(host: str = "localhost", port: int = 8766) -> Dict[str, Any]:
    """
    Test DSPy WebSocket service health
    Returns comprehensive health status
    """
    results = {
        "service": "dspy-orchestrator",
        "endpoint": f"ws://{host}:{port}",
        "status": "unknown",
        "response_time_ms": 0,
        "connectivity": False,
        "functionality": False,
        "error": None,
        "tests_passed": 0,
        "tests_total": 3
    }
    
    start_time = time.time()
    
    try:
        # Test 1: WebSocket Connectivity
        print(f"🔌 Testing WebSocket connectivity to {host}:{port}")
        websocket_uri = f"ws://{host}:{port}"
        async with websockets.connect(websocket_uri) as websocket:
            results["connectivity"] = True
            results["tests_passed"] += 1
            print("  ✅ WebSocket connection established")
            
            # Test 2: Basic Protocol Test
            print("📡 Testing basic WebSocket protocol")
            test_request = {
                "requestId": "health-check",
                "method": "get_model_info",
                "params": {}
            }
            
            await websocket.send(json.dumps(test_request))
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            
            response_data = json.loads(response)
            if response_data.get("requestId") == "health-check":
                results["tests_passed"] += 1
                print("  ✅ Basic protocol test passed")
                
                # Test 3: Functionality Test
                print("🧠 Testing DSPy orchestration functionality")
                orchestration_request = {
                    "requestId": "orchestration-test",
                    "method": "orchestrate", 
                    "params": {
                        "userRequest": "Test system health",
                        "context": {"test": True}
                    }
                }
                
                await websocket.send(json.dumps(orchestration_request))
                orchestration_response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                
                orchestration_data = json.loads(orchestration_response)
                if (orchestration_data.get("success") and 
                    orchestration_data.get("requestId") == "orchestration-test"):
                    results["functionality"] = True
                    results["tests_passed"] += 1
                    print("  ✅ Orchestration functionality test passed")
                    
                    # Extract some useful metrics
                    data = orchestration_data.get("data", {})
                    print(f"    🎯 Intent: {data.get('intent', 'N/A')}")
                    print(f"    📊 Complexity: {data.get('complexity', 'N/A')}")
                    print(f"    🤖 Agents: {data.get('selected_agents', 'N/A')}")
                else:
                    print("  ❌ Orchestration functionality test failed")
            else:
                print("  ❌ Basic protocol test failed")
                
    except asyncio.TimeoutError:
        results["error"] = "WebSocket connection timeout"
        print(f"  ❌ Connection timeout after 5 seconds")
        
    except ConnectionRefusedError:
        results["error"] = "Connection refused - service may not be running"
        print(f"  ❌ Connection refused to {host}:{port}")
        
    except Exception as e:
        results["error"] = str(e)
        print(f"  ❌ Unexpected error: {e}")
    
    # Calculate final metrics
    end_time = time.time()
    results["response_time_ms"] = int((end_time - start_time) * 1000)
    
    # Determine overall status
    if results["tests_passed"] == results["tests_total"]:
        results["status"] = "healthy"
    elif results["tests_passed"] > 0:
        results["status"] = "partial"
    else:
        results["status"] = "unhealthy"
    
    return results

def test_port_accessibility(host: str, port: int) -> bool:
    """Test if port is accessible via HTTP first (fallback check)"""
    try:
        response = requests.get(f"http://{host}:{port}/health", timeout=2)
        return response.status_code in [200, 400]  # 400 is fine for WebSocket endpoint
    except:
        return False

async def main():
    """Main health check execution"""
    print("🩺 DSPy WebSocket Service Health Check")
    print("=" * 40)
    
    # Quick port check first
    if test_port_accessibility("localhost", 8766):
        print("📍 Port 8766 is accessible")
    else:
        print("⚠️ Port 8766 not accessible via HTTP (normal for WebSocket-only service)")
    
    # Run comprehensive WebSocket health check
    results = await test_dspy_websocket_health()
    
    # Print results
    print(f"\n📊 Health Check Results:")
    print(f"   Status: {results['status'].upper()}")
    print(f"   Connectivity: {'✅' if results['connectivity'] else '❌'}")
    print(f"   Functionality: {'✅' if results['functionality'] else '❌'}")
    print(f"   Response Time: {results['response_time_ms']}ms")
    print(f"   Tests Passed: {results['tests_passed']}/{results['tests_total']}")
    
    if results['error']:
        print(f"   Error: {results['error']}")
    
    # Determine exit code
    if results['status'] == 'healthy':
        print(f"\n🎉 DSPy WebSocket Service: HEALTHY ✅")
        return 0
    elif results['status'] == 'partial':
        print(f"\n⚠️ DSPy WebSocket Service: PARTIALLY FUNCTIONAL")
        return 1
    else:
        print(f"\n❌ DSPy WebSocket Service: UNHEALTHY")
        return 2

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)