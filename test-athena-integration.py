#!/usr/bin/env python3
"""
Athena Integration Test
Tests all services through Athena Gateway
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, Any

class AthenaIntegrationTest:
    def __init__(self):
        self.gateway_url = "http://localhost:8080"
        self.results = []
        
    async def test_health_check(self):
        """Test Athena Gateway health check"""
        print("🔍 Testing Athena Gateway Health Check...")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.gateway_url}/health") as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"   ✅ Gateway Status: {data['status']}")
                        print(f"   📊 Services:")
                        for service, status in data['services'].items():
                            emoji = "✅" if status == "healthy" else "❌"
                            print(f"      {emoji} {service}: {status}")
                        return True
                    else:
                        print(f"   ❌ Health check failed: {response.status}")
                        return False
        except Exception as e:
            print(f"   ❌ Health check error: {e}")
            return False
    
    async def test_chat_endpoint(self):
        """Test chat through Athena Gateway"""
        print("💬 Testing Chat Endpoint...")
        
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "message": "Hello Athena! Can you help me test the integration?",
                    "model": "llama3.2:3b"
                }
                
                async with session.post(
                    f"{self.gateway_url}/api/chat",
                    json=payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"   ✅ Chat Response: {data.get('response', 'No response')[:100]}...")
                        return True
                    else:
                        text = await response.text()
                        print(f"   ❌ Chat failed: {response.status} - {text}")
                        return False
        except Exception as e:
            print(f"   ❌ Chat error: {e}")
            return False
    
    async def test_evolution_endpoint(self):
        """Test evolution through Athena Gateway"""
        print("🧬 Testing Evolution Endpoint...")
        
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "task": "Analyze system performance and suggest improvements",
                    "context": {"test_mode": True},
                    "orchestration_mode": "dspy"
                }
                
                async with session.post(
                    f"{self.gateway_url}/api/evolution/analyze",
                    json=payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"   ✅ Evolution Response: {str(data)[:100]}...")
                        return True
                    else:
                        text = await response.text()
                        print(f"   ❌ Evolution failed: {response.status} - {text}")
                        return False
        except Exception as e:
            print(f"   ❌ Evolution error: {e}")
            return False
    
    async def test_knowledge_search(self):
        """Test knowledge search through Athena Gateway"""
        print("🔍 Testing Knowledge Search...")
        
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "query": "What is Athena?",
                    "limit": 5
                }
                
                async with session.post(
                    f"{self.gateway_url}/api/knowledge/search",
                    json=payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"   ✅ Knowledge Response: {str(data)[:100]}...")
                        return True
                    else:
                        text = await response.text()
                        print(f"   ❌ Knowledge search failed: {response.status} - {text}")
                        return False
        except Exception as e:
            print(f"   ❌ Knowledge search error: {e}")
            return False
    
    async def test_orchestration(self):
        """Test unified orchestration through Athena Gateway"""
        print("🎯 Testing Unified Orchestration...")
        
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "task": "Help me understand how to use the Athena system",
                    "context": {"user_level": "beginner"},
                    "orchestration_mode": "dspy"
                }
                
                async with session.post(
                    f"{self.gateway_url}/api/orchestrate",
                    json=payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"   ✅ Orchestration Response: {str(data)[:100]}...")
                        return True
                    else:
                        text = await response.text()
                        print(f"   ❌ Orchestration failed: {response.status} - {text}")
                        return False
        except Exception as e:
            print(f"   ❌ Orchestration error: {e}")
            return False
    
    async def test_services_list(self):
        """Test services discovery through Athena Gateway"""
        print("📋 Testing Services Discovery...")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.gateway_url}/api/services") as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"   ✅ Services: {len(data.get('services', {}))} available")
                        for service, url in data.get('services', {}).items():
                            print(f"      • {service}: {url}")
                        return True
                    else:
                        text = await response.text()
                        print(f"   ❌ Services list failed: {response.status} - {text}")
                        return False
        except Exception as e:
            print(f"   ❌ Services list error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all integration tests"""
        print("╔══════════════════════════════════════════════════════════════════╗")
        print("║                    ATHENA INTEGRATION TEST                       ║")
        print("║              Testing All Services Through Gateway                ║")
        print("╚══════════════════════════════════════════════════════════════════╝")
        print("")
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Chat Endpoint", self.test_chat_endpoint),
            ("Evolution Endpoint", self.test_evolution_endpoint),
            ("Knowledge Search", self.test_knowledge_search),
            ("Unified Orchestration", self.test_orchestration),
            ("Services Discovery", self.test_services_list)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"🧪 {test_name}...")
            try:
                result = await test_func()
                if result:
                    passed += 1
                    print(f"   ✅ {test_name}: PASSED")
                else:
                    print(f"   ❌ {test_name}: FAILED")
            except Exception as e:
                print(f"   ❌ {test_name}: ERROR - {e}")
            
            print("")
            await asyncio.sleep(1)  # Brief pause between tests
        
        print("════════════════════════════════════════════════════════════════════")
        print(f"📊 TEST RESULTS: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! Athena Gateway is working perfectly!")
            print("✅ All services are successfully routed through Athena")
        elif passed > total // 2:
            print("⚠️  MOSTLY WORKING: Some tests failed, but core functionality is operational")
            print("🔧 Check failed services and try again")
        else:
            print("❌ MULTIPLE FAILURES: Athena Gateway needs attention")
            print("🔧 Check service health and configuration")
        
        print("════════════════════════════════════════════════════════════════════")
        
        return passed == total

async def main():
    """Main test runner"""
    tester = AthenaIntegrationTest()
    
    # Check if gateway is running
    print("🔍 Checking if Athena Gateway is running...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8080/health", timeout=5) as response:
                if response.status == 200:
                    print("✅ Athena Gateway is running!")
                else:
                    print("❌ Athena Gateway is not responding properly")
                    return
    except Exception as e:
        print(f"❌ Cannot connect to Athena Gateway: {e}")
        print("💡 Make sure to run: ./start-athena-unified.sh")
        return
    
    print("")
    
    # Run all tests
    success = await tester.run_all_tests()
    
    if success:
        print("🚀 Athena-Centric Integration: SUCCESS!")
        print("   All AI services are now routed through Athena")
        print("   Use port 8080 for all API calls")
    else:
        print("🔧 Athena-Centric Integration: NEEDS ATTENTION")
        print("   Some services may need configuration")

if __name__ == "__main__":
    asyncio.run(main())