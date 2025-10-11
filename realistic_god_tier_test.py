#!/usr/bin/env python3
"""
Realistic God Tier Test - Testing what actually works
Focus on the capabilities that are operational
"""
import asyncio
import time

import httpx


class RealisticGodTierTester:
    def __init__(self):
        self.llm_router_url = "http://127.0.0.1:3033"
        self.assistantd_url = "http://127.0.0.1:8086"
        self.session = None

    async def __aenter__(self):
        self.session = httpx.AsyncClient(timeout=60.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.aclose()

    async def test_basic_chat(self, message: str):
        """Test basic chat functionality"""
        payload = {"messages": [{"role": "user", "content": message}]}

        start_time = time.time()
        response = await self.session.post(f"{self.assistantd_url}/chat", json=payload)
        response_time = time.time() - start_time

        if response.status_code == 200:
            result = response.json()
            return {
                "success": True,
                "response_time": response_time,
                "model": result.get("model", "unknown"),
                "response_length": len(result.get("content", "")),
                "content_preview": result.get("content", "")[:100] + "..." if len(result.get("content", "")) > 100 else result.get("content", "")
            }
        else:
            return {"success": False, "error": f"HTTP {response.status_code}", "response_time": response_time}

    async def test_streaming_chat(self, message: str):
        """Test streaming chat functionality"""
        payload = {"messages": [{"role": "user", "content": message}]}

        start_time = time.time()
        chunks = []

        try:
            async with self.session.stream('POST', f"{self.assistantd_url}/chat/stream", json=payload) as response:
                if response.status_code == 200:
                    async for chunk in response.aiter_text():
                        if chunk.strip():
                            chunks.append(chunk)
                    response_time = time.time() - start_time

                    return {
                        "success": True,
                        "response_time": response_time,
                        "chunks_received": len(chunks),
                        "streaming_quality": "excellent" if len(chunks) > 10 else "good" if len(chunks) > 5 else "poor"
                    }
        except Exception as e:
            return {"success": False, "error": str(e), "response_time": time.time() - start_time}

    async def test_agentic_chat(self, message: str):
        """Test agentic chat functionality"""
        payload = {"messages": [{"role": "user", "content": message}]}

        start_time = time.time()
        response = await self.session.post(f"{self.assistantd_url}/chat/agentic", json=payload)
        response_time = time.time() - start_time

        if response.status_code == 200:
            result = response.json()
            return {
                "success": True,
                "response_time": response_time,
                "response_length": len(result.get("content", "")),
                "content_preview": result.get("content", "")[:100] + "..." if len(result.get("content", "")) > 100 else result.get("content", "")
            }
        else:
            return {"success": False, "error": f"HTTP {response.status_code}", "response_time": response_time}

    async def test_llm_router_smart_routing(self, message: str):
        """Test LLM router smart routing"""
        payload = {"messages": [{"role": "user", "content": message}]}

        start_time = time.time()
        response = await self.session.post(f"{self.llm_router_url}/smart", json=payload)
        response_time = time.time() - start_time

        if response.status_code == 200:
            result = response.json()
            return {
                "success": True,
                "response_time": response_time,
                "model": result.get("model", "unknown"),
                "provider": result.get("provider", "unknown"),
                "routing_method": result.get("routing_method", "unknown"),
                "response_length": len(result.get("response", ""))
            }
        else:
            return {"success": False, "error": f"HTTP {response.status_code}", "response_time": response_time}

    async def test_batch_processing(self, messages: list):
        """Test batch processing capabilities"""
        requests = [{"messages": [{"role": "user", "content": msg}]} for msg in messages]
        payload = {"requests": requests, "parallel": True}

        start_time = time.time()
        response = await self.session.post(f"{self.llm_router_url}/batch", json=payload)
        response_time = time.time() - start_time

        if response.status_code == 200:
            result = response.json()
            return {
                "success": True,
                "response_time": response_time,
                "responses_count": len(result.get("responses", [])),
                "parallel_processing": result.get("parallel_processing", False),
                "total_time_ms": result.get("total_time_ms", 0),
                "efficiency": "high" if result.get("total_time_ms", 0) < 10000 else "medium"
            }
        else:
            return {"success": False, "error": f"HTTP {response.status_code}", "response_time": response_time}

    async def run_god_tier_scenarios(self):
        """Run realistic God Tier scenarios"""
        print("🌟 REALISTIC GOD TIER TESTING")
        print("=" * 50)

        scenarios = [
            {
                "name": "Simple Question",
                "message": "What is the capital of France?",
                "expected_capabilities": ["basic_chat", "streaming"]
            },
            {
                "name": "Technical Analysis",
                "message": "Explain the differences between microservices and monolithic architectures, including pros, cons, and when to use each approach.",
                "expected_capabilities": ["complex_reasoning", "technical_analysis"]
            },
            {
                "name": "Creative Task",
                "message": "Write a short story about an AI that discovers emotions. Include character development and a meaningful ending.",
                "expected_capabilities": ["creative_writing", "narrative_structure"]
            },
            {
                "name": "Problem Solving",
                "message": "I have a web application that's experiencing slow load times. Help me diagnose potential causes and suggest solutions.",
                "expected_capabilities": ["problem_solving", "technical_diagnosis"]
            },
            {
                "name": "Strategic Planning",
                "message": "Design a comprehensive digital transformation strategy for a traditional retail company moving to e-commerce.",
                "expected_capabilities": ["strategic_planning", "complex_reasoning"]
            }
        ]

        results = []

        for i, scenario in enumerate(scenarios, 1):
            print(f"\n🎯 Scenario {i}: {scenario['name']}")
            print(f"📝 Task: {scenario['message'][:80]}...")

            scenario_results = {}
            total_time = 0

            # Test basic chat
            print("  💬 Testing basic chat...")
            basic_result = await self.test_basic_chat(scenario["message"])
            scenario_results["basic_chat"] = basic_result
            total_time += basic_result["response_time"]

            # Test streaming chat
            print("  📡 Testing streaming chat...")
            stream_result = await self.test_streaming_chat(scenario["message"])
            scenario_results["streaming_chat"] = stream_result
            total_time += stream_result["response_time"]

            # Test agentic chat
            print("  🤖 Testing agentic chat...")
            agentic_result = await self.test_agentic_chat(scenario["message"])
            scenario_results["agentic_chat"] = agentic_result
            total_time += agentic_result["response_time"]

            # Test smart routing
            print("  🧠 Testing smart routing...")
            routing_result = await self.test_llm_router_smart_routing(scenario["message"])
            scenario_results["smart_routing"] = routing_result
            total_time += routing_result["response_time"]

            # Calculate success metrics
            successful_tests = sum(1 for r in scenario_results.values() if r.get("success", False))
            total_tests = len(scenario_results)
            success_rate = successful_tests / total_tests if total_tests > 0 else 0

            # Determine if this is God Tier capable
            is_god_tier = (
                success_rate >= 0.8 and  # High success rate
                total_time < 30.0 and    # Reasonable response time
                basic_result.get("success") and  # Basic functionality works
                stream_result.get("success") and  # Streaming works
                agentic_result.get("success")    # Agentic capabilities work
            )

            results.append({
                "scenario": scenario["name"],
                "success_rate": success_rate,
                "total_time": total_time,
                "is_god_tier": is_god_tier,
                "details": scenario_results
            })

            status = "✅ GOD TIER" if is_god_tier else "❌ Needs Work"
            print(f"  📊 Result: {success_rate:.1%} success, {total_time:.2f}s total - {status}")

        # Test batch processing
        print("\n⚡ Testing Batch Processing...")
        batch_messages = [
            "What is machine learning?",
            "Explain quantum computing basics",
            "Describe the benefits of cloud computing"
        ]
        batch_result = await self.test_batch_processing(batch_messages)
        print(f"  📦 Batch result: {'✅' if batch_result['success'] else '❌'} {batch_result.get('response_time', 0):.2f}s")

        # Overall assessment
        print("\n🏆 OVERALL GOD TIER ASSESSMENT:")
        print("=" * 40)

        god_tier_scenarios = sum(1 for r in results if r["is_god_tier"])
        total_scenarios = len(results)
        avg_success_rate = sum(r["success_rate"] for r in results) / total_scenarios
        avg_response_time = sum(r["total_time"] for r in results) / total_scenarios

        print("📊 Performance Metrics:")
        print(f"   • Scenarios Tested: {total_scenarios}")
        print(f"   • God Tier Capable: {god_tier_scenarios}/{total_scenarios}")
        print(f"   • Average Success Rate: {avg_success_rate:.1%}")
        print(f"   • Average Response Time: {avg_response_time:.2f}s")
        print(f"   • Batch Processing: {'✅' if batch_result['success'] else '❌'}")

        print("\n🎯 Capability Breakdown:")
        for result in results:
            status = "✅" if result["is_god_tier"] else "❌"
            print(f"   {status} {result['scenario']}: {result['success_rate']:.1%} success, {result['total_time']:.2f}s")

        # Final verdict
        if god_tier_scenarios >= total_scenarios * 0.8 and avg_success_rate >= 0.8:
            print("\n🌟 VERDICT: GOD TIER ACHIEVED!")
            print(f"   ✅ {god_tier_scenarios}/{total_scenarios} scenarios are God Tier capable")
            print(f"   ✅ High success rate: {avg_success_rate:.1%}")
            print(f"   ✅ Fast response times: {avg_response_time:.2f}s average")
            print("   ✅ Multiple capabilities working: Chat, Streaming, Agentic, Smart Routing")
            if batch_result['success']:
                print("   ✅ Batch processing operational")
        else:
            print("\n⚠️ VERDICT: APPROACHING GOD TIER")
            print(f"   📈 {god_tier_scenarios}/{total_scenarios} scenarios are God Tier capable")
            print(f"   📈 Success rate: {avg_success_rate:.1%}")
            print(f"   📈 Response times: {avg_response_time:.2f}s average")
            print("   🔧 Areas for improvement identified")

        return results

async def main():
    async with RealisticGodTierTester() as tester:
        await tester.run_god_tier_scenarios()

if __name__ == "__main__":
    asyncio.run(main())
