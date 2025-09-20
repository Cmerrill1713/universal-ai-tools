#!/usr/bin/env python3
"""
Advanced Orchestration Test - Complex Multi-Service Workflows
Tests sophisticated orchestration scenarios with multiple services
"""

import asyncio
import json
import time
import uuid

import aiohttp


class AdvancedOrchestrationTester:
    def __init__(self):
        self.results = []
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def test_ai_workflow_orchestration(self):
        """Test a complete AI workflow: Memory → Chat → ML → Store Results"""
        print("🤖 Testing AI Workflow Orchestration...")
        start_time = time.time()

        try:
            workflow_id = str(uuid.uuid4())

            # Step 1: Store initial context
            context_data = {
                "type": "workflow_context",
                "content": "User is working on AI orchestration testing and wants to understand system performance",
                "metadata": {"workflow_id": workflow_id, "step": "initialization"},
                "tags": ["workflow", "ai", "orchestration", "testing"],
            }

            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": f"workflow_user_{workflow_id[:8]}"},
                json=context_data,
                timeout=10,
            ) as response:
                if response.status != 200:
                    raise Exception(
                        f"Context storage failed: {
                            response.status}"
                    )
                context_result = await response.json()
                print(
                    f"  ✅ Workflow context stored (ID: {context_result['id'][:8]}...)"
                )

            # Step 2: Chat about the workflow
            chat_data = {
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            f"Based on our AI orchestration workflow (ID: {workflow_id[:8]}), "
                            "what are the key performance indicators I should monitor for system health?"
                        ),
                    }
                ],
                "model": "llama2:latest",
                "temperature": 0.7,
                "max_tokens": 200,
            }

            async with self.session.post(
                "http://localhost:3033/chat", json=chat_data, timeout=30
            ) as response:
                if response.status != 200:
                    raise Exception(f"Chat failed: {response.status}")
                chat_result = await response.json()
                chat_response = chat_result.get("response", "")
                print(f"  ✅ AI chat completed ({len(chat_response)} chars)")

            # Step 3: ML inference on the chat response
            ml_data = {
                "model_id": "llama3.2:3b",
                "input": f"Analyze this AI orchestration response and extract key metrics: {chat_response[:100]}...",
                "parameters": {"max_tokens": 100, "temperature": 0.5},
                "task_type": "text_generation",
            }

            async with self.session.post(
                "http://localhost:8084/infer", json=ml_data, timeout=15
            ) as response:
                if response.status != 200:
                    raise Exception(f"ML inference failed: {response.status}")
                ml_result = await response.json()
                ml_response = ml_result.get("text", "")
                print(f"  ✅ ML analysis completed ({len(ml_response)} chars)")

            # Step 4: Store workflow results
            results_data = {
                "type": "workflow_results",
                "content": f"Workflow {workflow_id[:8]} completed. Chat: {chat_response[:50]}... ML: {ml_response[:50]}...",
                "metadata": {
                    "workflow_id": workflow_id,
                    "step": "completion",
                    "chat_length": len(chat_response),
                    "ml_length": len(ml_response),
                    "total_chars": len(chat_response) + len(ml_response),
                },
                "tags": ["workflow", "results", "ai-analysis", "completed"],
            }

            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": f"workflow_user_{workflow_id[:8]}"},
                json=results_data,
                timeout=10,
            ) as response:
                if response.status != 200:
                    raise Exception(
                        f"Results storage failed: {
                            response.status}"
                    )
                print("  ✅ Workflow results stored")

            # Step 5: Retrieve complete workflow history
            async with self.session.get(
                "http://localhost:8017/memories?limit=10",
                headers={"X-User-ID": f"workflow_user_{workflow_id[:8]}"},
                timeout=10,
            ) as response:
                if response.status != 200:
                    raise Exception(
                        f"History retrieval failed: {
                            response.status}"
                    )
                history = await response.json()
                workflow_memories = history.get("memories", [])
                print(
                    f"  ✅ Retrieved {
                        len(workflow_memories)} workflow memories"
                )

            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "AI Workflow Orchestration",
                    "status": "✅ PASS",
                    "duration": f"{
                        duration:.2f}s",
                    "workflow_id": workflow_id,
                    "context_stored": True,
                    "chat_completed": True,
                    "ml_completed": True,
                    "results_stored": True,
                    "memories_retrieved": len(workflow_memories),
                    "total_chars_processed": len(chat_response) + len(ml_response),
                }
            )
            print(f"  ✅ Complete AI workflow orchestrated ({duration:.2f}s)")

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "AI Workflow Orchestration",
                    "status": "❌ FAIL",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ AI workflow failed: {e}")

    async def test_api_gateway_orchestration(self):
        """Test orchestration through API Gateway"""
        print("🌐 Testing API Gateway Orchestration...")
        start_time = time.time()

        try:
            # Test multiple API Gateway endpoints
            gateway_tests = []

            # Test 1: Chat through API Gateway
            chat_data = {
                "messages": [
                    {
                        "role": "user",
                        "content": "Test API Gateway orchestration: What is the role of an API Gateway in microservices?",
                    }
                ],
                "model": "llama2:latest",
                "temperature": 0.7,
                "max_tokens": 150,
            }

            async with self.session.post(
                "http://localhost:8080/api/chat",
                headers={"X-User-ID": "gateway_test_user"},
                json=chat_data,
                timeout=30,
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    gateway_tests.append(
                        {
                            "endpoint": "chat",
                            "success": True,
                            "response_length": len(result.get("response", "")),
                            "provider": result.get("provider", "unknown"),
                        }
                    )
                    print(
                        f"  ✅ API Gateway chat successful ({len(result.get('response', ''))} chars)"
                    )
                else:
                    gateway_tests.append(
                        {
                            "endpoint": "chat",
                            "success": False,
                            "status": response.status,
                        }
                    )
                    print(f"  ❌ API Gateway chat failed: {response.status}")

            # Test 2: Health check through API Gateway
            async with self.session.get(
                "http://localhost:8080/health", timeout=10
            ) as response:
                if response.status == 200:
                    health = await response.json()
                    gateway_tests.append(
                        {
                            "endpoint": "health",
                            "success": True,
                            "status": health.get("status", "unknown"),
                        }
                    )
                    print("  ✅ API Gateway health check successful")
                else:
                    gateway_tests.append(
                        {
                            "endpoint": "health",
                            "success": False,
                            "status": response.status,
                        }
                    )
                    print(
                        f"  ❌ API Gateway health check failed: {
                            response.status}"
                    )

            # Calculate success rate
            successful_tests = sum(1 for test in gateway_tests if test["success"])
            total_tests = len(gateway_tests)

            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "API Gateway Orchestration",
                    "status": (
                        "✅ PASS" if successful_tests == total_tests else "⚠️ PARTIAL"
                    ),
                    "duration": f"{
                        duration:.2f}s",
                    "tests": gateway_tests,
                    "success_rate": f"{successful_tests}/{total_tests}",
                }
            )

            status = "✅ PASS" if successful_tests == total_tests else "⚠️ PARTIAL"
            print(
                f"  {status} API Gateway orchestration: {successful_tests}/{total_tests} tests passed ({duration:.2f}s)"
            )

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "API Gateway Orchestration",
                    "status": "❌ FAIL",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ API Gateway orchestration failed: {e}")

    async def test_multi_user_orchestration(self):
        """Test orchestration with multiple concurrent users"""
        print("👥 Testing Multi-User Orchestration...")
        start_time = time.time()

        try:
            # Create multiple user workflows concurrently
            user_tasks = []

            for user_id in range(5):
                task = self._user_workflow(f"user_{user_id}")
                user_tasks.append(task)

            # Execute all user workflows concurrently
            user_results = await asyncio.gather(*user_tasks, return_exceptions=True)

            # Analyze results
            successful_users = sum(
                1
                for r in user_results
                if not isinstance(r, Exception) and r.get("success", False)
            )
            failed_users = len(user_results) - successful_users

            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Multi-User Orchestration",
                    "status": "✅ PASS" if failed_users == 0 else "⚠️ PARTIAL",
                    "duration": f"{
                        duration:.2f}s",
                    "total_users": len(user_results),
                    "successful_users": successful_users,
                    "failed_users": failed_users,
                    "concurrent_throughput": f"{
                        len(user_results) /
                        duration:.1f} users/sec",
                }
            )

            status = "✅ PASS" if failed_users == 0 else "⚠️ PARTIAL"
            print(
                f"  {status} Multi-user orchestration: {successful_users}/{
                    len(user_results)} users successful ({
                    duration:.2f}s)"
            )

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Multi-User Orchestration",
                    "status": "❌ FAIL",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Multi-user orchestration failed: {e}")

    async def _user_workflow(self, user_id: str):
        """Individual user workflow"""
        try:
            # Store user context
            context_data = {
                "type": "user_context",
                "content": f"User {user_id} is testing orchestration",
                "metadata": {"user_id": user_id, "test": "multi_user"},
                "tags": ["user", "orchestration", "test"],
            }

            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": user_id},
                json=context_data,
                timeout=10,
            ) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"Context storage failed: {response.status}",
                    }

            # Simple chat
            chat_data = {
                "messages": [
                    {
                        "role": "user",
                        "content": f"Hello from {user_id}, what is AI orchestration?",
                    }
                ],
                "model": "llama2:latest",
                "temperature": 0.7,
                "max_tokens": 50,
            }

            async with self.session.post(
                "http://localhost:3033/chat", json=chat_data, timeout=30
            ) as response:
                if response.status != 200:
                    return {
                        "success": False,
                        "error": f"Chat failed: {response.status}",
                    }

            return {"success": True, "user_id": user_id}

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def test_service_resilience_orchestration(self):
        """Test orchestration resilience when services have issues"""
        print("🛡️ Testing Service Resilience Orchestration...")
        start_time = time.time()

        try:
            resilience_tests = []

            # Test 1: Memory service with invalid data (should handle
            # gracefully)
            invalid_memory = {"invalid": "data", "missing_required_fields": True}
            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": "resilience_test"},
                json=invalid_memory,
                timeout=10,
            ) as response:
                resilience_tests.append(
                    {
                        "test": "invalid_memory_data",
                        "handled_gracefully": response.status in [400, 422],
                        "status": response.status,
                    }
                )

            # Test 2: Chat with invalid model (should handle gracefully)
            invalid_chat = {
                "messages": [{"role": "user", "content": "Test"}],
                "model": "nonexistent_model",
                "temperature": 0.7,
            }
            async with self.session.post(
                "http://localhost:3033/chat", json=invalid_chat, timeout=10
            ) as response:
                resilience_tests.append(
                    {
                        "test": "invalid_chat_model",
                        "handled_gracefully": response.status in [400, 422, 500],
                        "status": response.status,
                    }
                )

            # Test 3: ML service with invalid parameters
            invalid_ml = {
                "model_id": "llama3.2:3b",
                "input": "Test",
                "parameters": {
                    "max_tokens": -1,  # Invalid
                    "temperature": 2.0,  # Invalid
                },
                "task_type": "text_generation",
            }
            async with self.session.post(
                "http://localhost:8084/infer", json=invalid_ml, timeout=10
            ) as response:
                resilience_tests.append(
                    {
                        "test": "invalid_ml_params",
                        "handled_gracefully": response.status in [400, 422, 500],
                        "status": response.status,
                    }
                )

            # Test 4: Recovery - valid operation after errors
            valid_memory = {
                "type": "recovery_test",
                "content": "Testing service recovery after errors",
                "metadata": {"test": "resilience"},
                "tags": ["recovery", "test"],
            }
            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": "resilience_test"},
                json=valid_memory,
                timeout=10,
            ) as response:
                resilience_tests.append(
                    {
                        "test": "service_recovery",
                        "recovered": response.status == 200,
                        "status": response.status,
                    }
                )

            # Calculate resilience score
            graceful_handling = sum(
                1 for test in resilience_tests if test.get("handled_gracefully", False)
            )
            service_recovery = sum(
                1 for test in resilience_tests if test.get("recovered", False)
            )
            total_tests = len(resilience_tests)

            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Service Resilience Orchestration",
                    "status": (
                        "✅ PASS"
                        if graceful_handling >= 3 and service_recovery >= 1
                        else "⚠️ PARTIAL"
                    ),
                    "duration": f"{duration:.2f}s",
                    "tests": resilience_tests,
                    "graceful_handling": f"{graceful_handling}/{total_tests}",
                    "service_recovery": f"{service_recovery}/1",
                }
            )

            status = (
                "✅ PASS"
                if graceful_handling >= 3 and service_recovery >= 1
                else "⚠️ PARTIAL"
            )
            print(
                f"  {status} Service resilience: {graceful_handling}/{total_tests} graceful, {service_recovery}/1 recovery ({duration:.2f}s)"
            )

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Service Resilience Orchestration",
                    "status": "❌ FAIL",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Service resilience failed: {e}")

    async def run_all_tests(self):
        """Run all advanced orchestration tests"""
        print("🚀 Universal AI Tools - Advanced Orchestration Test Suite")
        print("=" * 70)

        await self.test_ai_workflow_orchestration()
        await self.test_api_gateway_orchestration()
        await self.test_multi_user_orchestration()
        await self.test_service_resilience_orchestration()

        # Print summary
        print("\n" + "=" * 70)
        print("📊 ADVANCED ORCHESTRATION TEST RESULTS")
        print("=" * 70)

        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["status"] == "✅ PASS")
        partial_tests = sum(1 for r in self.results if r["status"] == "⚠️ PARTIAL")
        failed_tests = sum(1 for r in self.results if r["status"] == "❌ FAIL")

        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"⚠️ Partial: {partial_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(
            f"Success Rate: {((passed_tests + partial_tests * 0.5) / total_tests * 100):.1f}%"
        )

        print("\n📋 Detailed Results:")
        for result in self.results:
            status = result["status"]
            test_name = result["test"]
            duration = result["duration"]
            print(f"  {status} {test_name}: {duration}")

            if "error" in result:
                print(f"    Error: {result['error']}")
            elif "workflow_id" in result:
                print(f"    Workflow ID: {result['workflow_id'][:8]}...")
                print(f"    Memories: {result['memories_retrieved']}")
                print(
                    f"    Chars processed: {
                        result['total_chars_processed']}"
                )
            elif "success_rate" in result:
                print(f"    Success rate: {result['success_rate']}")
            elif "concurrent_throughput" in result:
                print(f"    Throughput: {result['concurrent_throughput']}")

        # Save results
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"advanced_orchestration_results_{timestamp}.json"

        with open(filename, "w") as f:
            json.dump(
                {
                    "timestamp": timestamp,
                    "summary": {
                        "total_tests": total_tests,
                        "passed": passed_tests,
                        "partial": partial_tests,
                        "failed": failed_tests,
                        "success_rate": (
                            (passed_tests + partial_tests * 0.5) / total_tests * 100
                        ),
                    },
                    "results": self.results,
                },
                f,
                indent=2,
            )

        print(f"\n💾 Results saved to: {filename}")


async def main():
    async with AdvancedOrchestrationTester() as tester:
        await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
