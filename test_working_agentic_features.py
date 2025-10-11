#!/usr/bin/env python3
"""
Test Working Agentic Features in Universal AI Tools
Demonstrates the agentic capabilities that are currently operational
"""

import asyncio
import json
import time
from typing import Any, Dict

import aiohttp


class WorkingAgenticFeaturesTester:
    def __init__(self):
        self.results = []

    async def test_smart_model_routing(self):
        """Test intelligent model selection and routing"""
        print("🧠 Testing Smart Model Routing...")

        async with aiohttp.ClientSession() as session:
            # Test different types of requests to see model selection
            test_cases = [
                {
                    "name": "Simple Question",
                    "messages": [{"role": "user", "content": "What is 2+2?"}],
                    "expected_behavior": "Should route to fast model like gemma3:1b"
                },
                {
                    "name": "Complex Analysis",
                    "messages": [{"role": "user", "content": "Analyze the economic impact of AI on global markets and provide a detailed 1000-word analysis with citations"}],
                    "expected_behavior": "Should route to more capable model like llama2:latest"
                },
                {
                    "name": "Code Generation",
                    "messages": [{"role": "user", "content": "Write a Python function to implement a binary search algorithm with error handling and unit tests"}],
                    "expected_behavior": "Should route to code-capable model"
                }
            ]

            for i, test_case in enumerate(test_cases):
                start_time = time.time()
                try:
                    async with session.post(
                        "http://localhost:3033/chat",
                        json={"messages": test_case["messages"], "model": None},
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        duration = (time.time() - start_time) * 1000

                        if response.status == 200:
                            data = await response.json()
                            model_used = data.get("model", "unknown")
                            response_preview = data.get("response", "")[:100] + "..."

                            print(f"  ✅ {test_case['name']}: {duration:.0f}ms")
                            print(f"    Model: {model_used}")
                            print(f"    Response: {response_preview}")
                            print(f"    Expected: {test_case['expected_behavior']}")

                            self.results.append({
                                "test": "smart_routing",
                                "case": test_case["name"],
                                "success": True,
                                "model": model_used,
                                "duration": duration,
                                "response_length": len(data.get("response", ""))
                            })
                        else:
                            print(f"  ❌ {test_case['name']}: HTTP {response.status}")
                            self.results.append({
                                "test": "smart_routing",
                                "case": test_case["name"],
                                "success": False,
                                "error": f"HTTP {response.status}"
                            })
                except Exception as e:
                    print(f"  ❌ {test_case['name']}: {str(e)}")
                    self.results.append({
                        "test": "smart_routing",
                        "case": test_case["name"],
                        "success": False,
                        "error": str(e)
                    })

    async def test_concurrent_agent_execution(self):
        """Test multiple concurrent agent-like operations"""
        print("\n⚡ Testing Concurrent Agent Execution...")

        async def single_agent_task(task_id: int, task_type: str) -> Dict[str, Any]:
            """Simulate a single agent task"""
            start_time = time.time()

            async with aiohttp.ClientSession() as session:
                try:
                    # Different types of agent tasks
                    if task_type == "analysis":
                        prompt = f"Analyze the pros and cons of task {task_id} in detail"
                    elif task_type == "generation":
                        prompt = f"Generate a creative solution for task {task_id}"
                    elif task_type == "evaluation":
                        prompt = f"Evaluate the quality and feasibility of task {task_id}"
                    else:
                        prompt = f"Process task {task_id} with intelligent reasoning"

                    async with session.post(
                        "http://localhost:3033/chat",
                        json={"messages": [{"role": "user", "content": prompt}], "model": None},
                        timeout=aiohttp.ClientTimeout(total=20)
                    ) as response:
                        duration = (time.time() - start_time) * 1000

                        if response.status == 200:
                            data = await response.json()
                            return {
                                "task_id": task_id,
                                "task_type": task_type,
                                "success": True,
                                "duration": duration,
                                "model": data.get("model", "unknown"),
                                "response_length": len(data.get("response", ""))
                            }
                        else:
                            return {
                                "task_id": task_id,
                                "task_type": task_type,
                                "success": False,
                                "duration": duration,
                                "error": f"HTTP {response.status}"
                            }
                except Exception as e:
                    duration = (time.time() - start_time) * 1000
                    return {
                        "task_id": task_id,
                        "task_type": task_type,
                        "success": False,
                        "duration": duration,
                        "error": str(e)
                    }

        # Create multiple concurrent agent tasks
        tasks = []
        for i in range(10):
            task_type = ["analysis", "generation", "evaluation", "reasoning"][i % 4]
            tasks.append(single_agent_task(i, task_type))

        # Execute all tasks concurrently
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        total_time = time.time() - start_time

        successful_tasks = [r for r in results if r["success"]]
        failed_tasks = [r for r in results if not r["success"]]

        print(f"  📊 Total Tasks: {len(results)}")
        print(f"  ✅ Successful: {len(successful_tasks)}")
        print(f"  ❌ Failed: {len(failed_tasks)}")
        print(f"  ⏱️ Total Time: {total_time:.2f}s")
        print(f"  🚀 Throughput: {len(results)/total_time:.1f} tasks/sec")

        if successful_tasks:
            avg_duration = sum(r["duration"] for r in successful_tasks) / len(successful_tasks)
            print(f"  📈 Avg Response Time: {avg_duration:.0f}ms")

            # Show model distribution
            models = {}
            for r in successful_tasks:
                model = r["model"]
                models[model] = models.get(model, 0) + 1

            print("  🤖 Model Distribution:")
            for model, count in models.items():
                print(f"    {model}: {count} tasks")

        self.results.extend(results)

    async def test_memory_integration(self):
        """Test memory and context persistence"""
        print("\n🧠 Testing Memory Integration...")

        async with aiohttp.ClientSession() as session:
            # Test storing context
            context_data = {
                "type": "agent_session",
                "content": "User is testing agentic features and wants to understand AI orchestration",
                "metadata": {
                    "session_id": "agentic_test_001",
                    "test_type": "agentic_features",
                    "timestamp": time.time()
                },
                "tags": ["agentic", "orchestration", "testing", "memory"]
            }

            try:
                # Try to store memory
                async with session.post(
                    "http://localhost:8017/memories",
                    json=context_data,
                    headers={"X-User-ID": "agentic_tester"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        print("  ✅ Memory storage successful")
                        self.results.append({
                            "test": "memory_storage",
                            "success": True,
                            "status": response.status
                        })
                    else:
                        print(f"  ⚠️ Memory storage returned status {response.status}")
                        self.results.append({
                            "test": "memory_storage",
                            "success": False,
                            "status": response.status
                        })
            except Exception as e:
                print(f"  ❌ Memory storage failed: {str(e)}")
                self.results.append({
                    "test": "memory_storage",
                    "success": False,
                    "error": str(e)
                })

    async def test_assistant_service_agentic_features(self):
        """Test assistant service's agentic capabilities"""
        print("\n🤖 Testing Assistant Service Agentic Features...")

        async with aiohttp.ClientSession() as session:
            # Test complex reasoning task
            complex_task = {
                "messages": [{
                    "role": "user",
                    "content": "I need to plan a software development project. Help me break down the tasks, identify dependencies, estimate timelines, and suggest an optimal execution strategy. Consider resource constraints and potential risks."
                }],
                "model": None
            }

            start_time = time.time()
            try:
                async with session.post(
                    "http://localhost:8017/chat",
                    json=complex_task,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    duration = (time.time() - start_time) * 1000

                    if response.status == 200:
                        data = await response.json()
                        content = data.get("content", "")

                        print(f"  ✅ Complex reasoning task completed: {duration:.0f}ms")
                        print(f"  📝 Response length: {len(content)} characters")
                        print(f"  🔍 Response preview: {content[:200]}...")

                        # Analyze response quality
                        quality_indicators = {
                            "structured": "1. " in content or "•" in content or "- " in content,
                            "detailed": len(content) > 500,
                            "actionable": any(word in content.lower() for word in ["steps", "tasks", "timeline", "strategy", "plan"])
                        }

                        quality_score = sum(quality_indicators.values()) / len(quality_indicators)
                        print(f"  📊 Quality Score: {quality_score:.1%}")
                        print(f"  ✅ Structured: {quality_indicators['structured']}")
                        print(f"  ✅ Detailed: {quality_indicators['detailed']}")
                        print(f"  ✅ Actionable: {quality_indicators['actionable']}")

                        self.results.append({
                            "test": "assistant_agentic",
                            "success": True,
                            "duration": duration,
                            "response_length": len(content),
                            "quality_score": quality_score,
                            "quality_indicators": quality_indicators
                        })
                    else:
                        print(f"  ❌ Assistant service error: HTTP {response.status}")
                        self.results.append({
                            "test": "assistant_agentic",
                            "success": False,
                            "error": f"HTTP {response.status}"
                        })
            except Exception as e:
                print(f"  ❌ Assistant service error: {str(e)}")
                self.results.append({
                    "test": "assistant_agentic",
                    "success": False,
                    "error": str(e)
                })

    async def run_all_tests(self):
        """Run all agentic feature tests"""
        print("🚀 Universal AI Tools - Working Agentic Features Test")
        print("=" * 60)

        await self.test_smart_model_routing()
        await self.test_concurrent_agent_execution()
        await self.test_memory_integration()
        await self.test_assistant_service_agentic_features()

        # Generate summary
        print("\n" + "=" * 60)
        print("📊 AGENTIC FEATURES TEST SUMMARY")
        print("=" * 60)

        total_tests = len(self.results)
        successful_tests = len([r for r in self.results if r.get("success", False)])
        success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0

        print(f"Total Tests: {total_tests}")
        print(f"✅ Successful: {successful_tests}")
        print(f"❌ Failed: {total_tests - successful_tests}")
        print(f"📈 Success Rate: {success_rate:.1f}%")

        # Save results
        with open("agentic_features_test_results.json", "w") as f:
            json.dump({
                "timestamp": time.time(),
                "summary": {
                    "total_tests": total_tests,
                    "successful_tests": successful_tests,
                    "success_rate": success_rate
                },
                "results": self.results
            }, f, indent=2)

        print("💾 Results saved to: agentic_features_test_results.json")


async def main():
    tester = WorkingAgenticFeaturesTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
