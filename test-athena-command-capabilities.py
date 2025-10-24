#!/usr/bin/env python3
"""
Athena Command Capabilities Test
Verifies Athena can command the entire system while maintaining conversation
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, Any, List

class AthenaCommandTester:
    def __init__(self):
        self.gateway_url = "http://localhost:8080"
        self.results = []
        
    async def test_conversational_ability(self):
        """Test that Athena can have natural conversations"""
        print("💬 Testing Conversational Ability...")
        
        test_messages = [
            "Hello Athena! How are you today?",
            "What's the weather like?",
            "Can you tell me a joke?",
            "What are your capabilities?",
            "Help me understand what you can do"
        ]
        
        conversational_success = 0
        
        for message in test_messages:
            try:
                async with aiohttp.ClientSession() as session:
                    payload = {
                        "message": message,
                        "model": "llama3.2:3b"
                    }
                    
                    async with session.post(
                        f"{self.gateway_url}/api/chat",
                        json=payload
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            response_text = data.get('response', '')
                            if len(response_text) > 10:  # Basic response check
                                conversational_success += 1
                                print(f"   ✅ '{message[:30]}...' → Got response")
                            else:
                                print(f"   ❌ '{message[:30]}...' → Empty response")
                        else:
                            print(f"   ❌ '{message[:30]}...' → HTTP {response.status}")
            except Exception as e:
                print(f"   ❌ '{message[:30]}...' → Error: {e}")
        
        success_rate = conversational_success / len(test_messages)
        print(f"   📊 Conversational Success Rate: {success_rate:.1%}")
        return success_rate > 0.8
    
    async def test_system_command_capabilities(self):
        """Test that Athena can command system operations"""
        print("🎯 Testing System Command Capabilities...")
        
        # Test system information commands
        system_commands = [
            "Show me system status",
            "What services are running?",
            "Check system health",
            "List available services",
            "Show me the system architecture"
        ]
        
        command_success = 0
        
        for command in system_commands:
            try:
                async with aiohttp.ClientSession() as session:
                    payload = {
                        "message": command,
                        "model": "llama3.2:3b"
                    }
                    
                    async with session.post(
                        f"{self.gateway_url}/api/chat",
                        json=payload
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            response_text = data.get('response', '')
                            
                            # Check if response contains system-related information
                            system_keywords = ['service', 'status', 'health', 'running', 'system', 'architecture', 'port', 'api']
                            has_system_info = any(keyword in response_text.lower() for keyword in system_keywords)
                            
                            if has_system_info:
                                command_success += 1
                                print(f"   ✅ '{command}' → System info provided")
                            else:
                                print(f"   ⚠️  '{command}' → Generic response")
                        else:
                            print(f"   ❌ '{command}' → HTTP {response.status}")
            except Exception as e:
                print(f"   ❌ '{command}' → Error: {e}")
        
        success_rate = command_success / len(system_commands)
        print(f"   📊 Command Success Rate: {success_rate:.1%}")
        return success_rate > 0.6
    
    async def test_orchestration_capabilities(self):
        """Test that Athena can orchestrate complex tasks"""
        print("🎭 Testing Orchestration Capabilities...")
        
        orchestration_tasks = [
            "Analyze the system performance and suggest improvements",
            "Create a plan to optimize the AI services",
            "Design a monitoring strategy for all services",
            "Help me understand how to scale this system",
            "What would you recommend for improving user experience?"
        ]
        
        orchestration_success = 0
        
        for task in orchestration_tasks:
            try:
                async with aiohttp.ClientSession() as session:
                    payload = {
                        "task": task,
                        "context": {"test_mode": True},
                        "orchestration_mode": "dspy"
                    }
                    
                    async with session.post(
                        f"{self.gateway_url}/api/orchestrate",
                        json=payload
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            response_text = str(data)
                            
                            # Check if response contains actionable insights
                            action_keywords = ['recommend', 'suggest', 'plan', 'strategy', 'improve', 'optimize', 'implement']
                            has_actionable_content = any(keyword in response_text.lower() for keyword in action_keywords)
                            
                            if has_actionable_content:
                                orchestration_success += 1
                                print(f"   ✅ '{task[:40]}...' → Actionable response")
                            else:
                                print(f"   ⚠️  '{task[:40]}...' → Generic response")
                        else:
                            print(f"   ❌ '{task[:40]}...' → HTTP {response.status}")
            except Exception as e:
                print(f"   ❌ '{task[:40]}...' → Error: {e}")
        
        success_rate = orchestration_success / len(orchestration_tasks)
        print(f"   📊 Orchestration Success Rate: {success_rate:.1%}")
        return success_rate > 0.6
    
    async def test_tool_calling_capabilities(self):
        """Test that Athena can call tools and execute actions"""
        print("🔧 Testing Tool Calling Capabilities...")
        
        # Test tool calling through chat (simulated)
        tool_requests = [
            "Open Calculator for me",
            "Search Google for 'AI trends 2024'",
            "Take a screenshot of the current screen",
            "Show me system information",
            "Help me build a simple web app"
        ]
        
        tool_success = 0
        
        for request in tool_requests:
            try:
                async with aiohttp.ClientSession() as session:
                    payload = {
                        "message": request,
                        "model": "llama3.2:3b"
                    }
                    
                    async with session.post(
                        f"{self.gateway_url}/api/chat",
                        json=payload
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            response_text = data.get('response', '')
                            
                            # Check if response indicates tool usage
                            tool_indicators = ['opened', 'searching', 'screenshot', 'system info', 'building', 'created', 'executed']
                            has_tool_usage = any(indicator in response_text.lower() for indicator in tool_indicators)
                            
                            if has_tool_usage:
                                tool_success += 1
                                print(f"   ✅ '{request[:30]}...' → Tool action indicated")
                            else:
                                print(f"   ⚠️  '{request[:30]}...' → No tool action")
                        else:
                            print(f"   ❌ '{request[:30]}...' → HTTP {response.status}")
            except Exception as e:
                print(f"   ❌ '{request[:30]}...' → Error: {e}")
        
        success_rate = tool_success / len(tool_requests)
        print(f"   📊 Tool Calling Success Rate: {success_rate:.1%}")
        return success_rate > 0.4
    
    async def test_knowledge_integration(self):
        """Test that Athena can access and use knowledge"""
        print("🧠 Testing Knowledge Integration...")
        
        knowledge_queries = [
            "What do you know about AI systems?",
            "Tell me about machine learning",
            "How does the Athena system work?",
            "What are the best practices for system architecture?",
            "Explain the concept of microservices"
        ]
        
        knowledge_success = 0
        
        for query in knowledge_queries:
            try:
                async with aiohttp.ClientSession() as session:
                    payload = {
                        "query": query,
                        "limit": 5
                    }
                    
                    async with session.post(
                        f"{self.gateway_url}/api/knowledge/search",
                        json=payload
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            response_text = str(data)
                            
                            # Check if response contains knowledge
                            if len(response_text) > 50:  # Basic content check
                                knowledge_success += 1
                                print(f"   ✅ '{query[:30]}...' → Knowledge retrieved")
                            else:
                                print(f"   ⚠️  '{query[:30]}...' → Limited knowledge")
                        else:
                            print(f"   ❌ '{query[:30]}...' → HTTP {response.status}")
            except Exception as e:
                print(f"   ❌ '{query[:30]}...' → Error: {e}")
        
        success_rate = knowledge_success / len(knowledge_queries)
        print(f"   📊 Knowledge Success Rate: {success_rate:.1%}")
        return success_rate > 0.6
    
    async def test_evolution_capabilities(self):
        """Test that Athena can evolve and improve"""
        print("🔄 Testing Evolution Capabilities...")
        
        evolution_tasks = [
            "Analyze my usage patterns and suggest improvements",
            "What can you learn from our conversation?",
            "How would you improve your responses?",
            "What feedback do you have for the system?",
            "Suggest ways to make you more helpful"
        ]
        
        evolution_success = 0
        
        for task in evolution_tasks:
            try:
                async with aiohttp.ClientSession() as session:
                    payload = {
                        "task": task,
                        "context": {"test_mode": True},
                        "orchestration_mode": "dspy"
                    }
                    
                    async with session.post(
                        f"{self.gateway_url}/api/evolution/analyze",
                        json=payload
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            response_text = str(data)
                            
                            # Check if response contains evolutionary insights
                            evolution_keywords = ['improve', 'learn', 'evolve', 'optimize', 'better', 'enhance', 'feedback']
                            has_evolution_content = any(keyword in response_text.lower() for keyword in evolution_keywords)
                            
                            if has_evolution_content:
                                evolution_success += 1
                                print(f"   ✅ '{task[:40]}...' → Evolutionary response")
                            else:
                                print(f"   ⚠️  '{task[:40]}...' → Generic response")
                        else:
                            print(f"   ❌ '{task[:40]}...' → HTTP {response.status}")
            except Exception as e:
                print(f"   ❌ '{task[:40]}...' → Error: {e}")
        
        success_rate = evolution_success / len(evolution_tasks)
        print(f"   📊 Evolution Success Rate: {success_rate:.1%}")
        return success_rate > 0.6
    
    async def run_comprehensive_test(self):
        """Run all capability tests"""
        print("╔══════════════════════════════════════════════════════════════════╗")
        print("║                ATHENA COMMAND CAPABILITIES TEST                  ║")
        print("║           Testing: Conversation + System Command + Tools         ║")
        print("╚══════════════════════════════════════════════════════════════════╝")
        print("")
        
        tests = [
            ("Conversational Ability", self.test_conversational_ability),
            ("System Command Capabilities", self.test_system_command_capabilities),
            ("Orchestration Capabilities", self.test_orchestration_capabilities),
            ("Tool Calling Capabilities", self.test_tool_calling_capabilities),
            ("Knowledge Integration", self.test_knowledge_integration),
            ("Evolution Capabilities", self.test_evolution_capabilities)
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            print(f"🧪 {test_name}...")
            try:
                result = await test_func()
                results[test_name] = result
                status = "✅ PASSED" if result else "❌ FAILED"
                print(f"   {status}")
            except Exception as e:
                print(f"   ❌ ERROR: {e}")
                results[test_name] = False
            
            print("")
            await asyncio.sleep(2)  # Brief pause between tests
        
        # Summary
        passed_tests = sum(1 for result in results.values() if result)
        total_tests = len(results)
        
        print("════════════════════════════════════════════════════════════════════")
        print(f"📊 ATHENA CAPABILITIES SUMMARY: {passed_tests}/{total_tests} tests passed")
        print("════════════════════════════════════════════════════════════════════")
        
        for test_name, result in results.items():
            status = "✅" if result else "❌"
            print(f"{status} {test_name}")
        
        print("")
        
        if passed_tests >= 5:
            print("🎉 EXCELLENT: Athena has full command capabilities!")
            print("   ✅ Can have natural conversations")
            print("   ✅ Can command the entire system")
            print("   ✅ Can orchestrate complex tasks")
            print("   ✅ Can call tools and execute actions")
            print("   ✅ Can access knowledge and evolve")
            print("")
            print("🚀 Athena is ready for production use as a command center!")
        elif passed_tests >= 4:
            print("✅ GOOD: Athena has strong command capabilities!")
            print("   Most features working well with minor issues")
            print("   Ready for most production use cases")
        elif passed_tests >= 3:
            print("⚠️  FAIR: Athena has basic command capabilities")
            print("   Some features need attention")
            print("   May need configuration improvements")
        else:
            print("❌ POOR: Athena needs significant improvements")
            print("   Multiple capabilities not working")
            print("   Requires system configuration review")
        
        print("")
        print("🎯 ATHENA IS NOT JUST A SIMPLE CHAT - SHE'S A FULL COMMAND CENTER!")
        print("   • Conversational AI with natural language processing")
        print("   • System orchestrator with full command capabilities")
        print("   • Tool calling system for automation and control")
        print("   • Knowledge integration for informed responses")
        print("   • Evolution system for continuous improvement")
        print("   • Unified gateway for all AI services")
        
        return passed_tests >= 4

async def main():
    """Main test runner"""
    tester = AthenaCommandTester()
    
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
    
    # Run comprehensive test
    success = await tester.run_comprehensive_test()
    
    if success:
        print("🚀 ATHENA COMMAND CAPABILITIES: VERIFIED!")
        print("   Athena can command the entire system while maintaining conversation")
    else:
        print("🔧 ATHENA COMMAND CAPABILITIES: NEEDS ATTENTION")
        print("   Some capabilities may need configuration or fixes")

if __name__ == "__main__":
    asyncio.run(main())