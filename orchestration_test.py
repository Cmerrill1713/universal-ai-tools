#!/usr/bin/env python3
"""
Comprehensive Orchestration Test for Universal AI Tools
Tests how well services work together in real-world scenarios
"""

import asyncio
import json
import statistics
import time
import uuid

import aiohttp


class OrchestrationTester:
    def __init__(self):
        self.results = []
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def test_end_to_end_chat_with_memory(self):
        """Test complete chat flow with memory storage and retrieval"""
        print("🔄 Testing End-to-End Chat with Memory...")
        start_time = time.time()

        try:
            # Step 1: Store context in memory
            memory_data = {
                "type": "conversation_context",
                "content": "User is asking about AI orchestration and system performance",
                "metadata": {
                    "topic": "orchestration",
                    "test": True},
                "tags": [
                    "ai",
                    "orchestration",
                    "performance"],
            }

            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": "orchestration_test_user"},
                json=memory_data,
                timeout=10,
            ) as response:
                if response.status != 200:
                    raise Exception(
                        f"Memory storage failed: {
                            response.status}")
                memory_result = await response.json()
                memory_id = memory_result.get("id")
                print(f"  ✅ Context stored (ID: {memory_id[:8]}...)")

            # Step 2: Retrieve context for chat
            async with self.session.get(
                "http://localhost:8017/memories?limit=5",
                headers={"X-User-ID": "orchestration_test_user"},
                timeout=10,
            ) as response:
                if response.status != 200:
                    raise Exception(
                        f"Memory retrieval failed: {
                            response.status}")
                memories = await response.json()
                context_count = memories.get("count", 0)
                print(f"  ✅ Retrieved {context_count} memories")

            # Step 3: Chat with context awareness
            chat_data = {
                "messages": [
                    {
                        "role": "user",
                        "content": "Based on our previous conversation about AI orchestration, what are the key performance metrics I should monitor?",
                    }],
                "model": "llama2:latest",
                "temperature": 0.7,
                "max_tokens": 150,
            }

            async with self.session.post(
                "http://localhost:3033/chat", json=chat_data, timeout=30
            ) as response:
                if response.status != 200:
                    raise Exception(f"Chat failed: {response.status}")
                chat_result = await response.json()
                response_text = chat_result.get("response", "")
                print(
                    f"  ✅ Chat response received ({
                        len(response_text)} chars)")

            # Step 4: Store the conversation result
            conversation_data = {
                "type": "conversation_result",
                "content": f"AI Response: {response_text[:100]}...",
                "metadata": {"chat_id": str(uuid.uuid4()), "model": "llama2:latest"},
                "tags": ["conversation", "ai-response", "orchestration"],
            }

            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": "orchestration_test_user"},
                json=conversation_data,
                timeout=10,
            ) as response:
                if response.status != 200:
                    raise Exception(
                        f"Conversation storage failed: {
                            response.status}")
                print("  ✅ Conversation result stored")

            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "End-to-End Chat with Memory",
                    "status": "✅ PASS",
                    "duration": f"{duration:.2f}s",
                    "memory_id": memory_id,
                    "context_count": context_count,
                    "response_length": len(response_text),
                }
            )
            print(f"  ✅ End-to-end flow completed ({duration:.2f}s)")

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "End-to-End Chat with Memory",
                    "status": "❌ FAIL",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ End-to-end flow failed: {e}")

    async def test_concurrent_operations(self):
        """Test concurrent operations across multiple services"""
        print("⚡ Testing Concurrent Operations...")
        start_time = time.time()

        try:
            # Create multiple concurrent tasks
            tasks = []

            # Task 1: Multiple memory operations
            for i in range(3):
                task = self._concurrent_memory_operation(i)
                tasks.append(task)

            # Task 2: Multiple chat operations
            for i in range(2):
                task = self._concurrent_chat_operation(i)
                tasks.append(task)

            # Task 3: ML inference operations
            for i in range(2):
                task = self._concurrent_ml_operation(i)
                tasks.append(task)

            # Execute all tasks concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Analyze results
            successful_ops = sum(
                1 for r in results if not isinstance(
                    r, Exception))
            failed_ops = len(results) - successful_ops

            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Concurrent Operations",
                    "status": "✅ PASS" if failed_ops == 0 else "⚠️ PARTIAL",
                    "duration": f"{duration:.2f}s",
                    "total_operations": len(results),
                    "successful": successful_ops,
                    "failed": failed_ops,
                    "throughput": f"{len(results) / duration:.1f} ops/sec",
                }
            )

            status = "✅ PASS" if failed_ops == 0 else "⚠️ PARTIAL"
            print(
                f"  {status} Concurrent operations: {successful_ops}/{
                    len(results)} successful ({
                    duration:.2f}s)")

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Concurrent Operations",
                    "status": "❌ FAIL",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Concurrent operations failed: {e}")

    async def _concurrent_memory_operation(self, index: int):
        """Helper for concurrent memory operations"""
        memory_data = {
            "type": "concurrent_test",
            "content": f"Concurrent memory operation #{index}",
            "metadata": {"index": index, "timestamp": time.time()},
            "tags": ["concurrent", f"test-{index}"],
        }

        async with self.session.post(
            "http://localhost:8017/memories",
            headers={"X-User-ID": f"concurrent_user_{index}"},
            json=memory_data,
            timeout=10,
        ) as response:
            return response.status == 200

    async def _concurrent_chat_operation(self, index: int):
        """Helper for concurrent chat operations"""
        chat_data = {
            "messages": [
                {
                    "role": "user",
                    "content": f"Concurrent chat test #{index}: What is AI orchestration?",
                }],
            "model": "llama2:latest",
            "temperature": 0.7,
            "max_tokens": 100,
        }

        async with self.session.post(
            "http://localhost:3033/chat", json=chat_data, timeout=30
        ) as response:
            return response.status == 200

    async def _concurrent_ml_operation(self, index: int):
        """Helper for concurrent ML operations"""
        ml_data = {
            "prompt": f"Concurrent ML test #{index}: The future of AI orchestration is",
            "max_tokens": 50,
            "temperature": 0.7,
        }

        async with self.session.post(
            "http://localhost:8084/infer", json=ml_data, timeout=15
        ) as response:
            return response.status == 200

    async def test_error_resilience(self):
        """Test how well the system handles errors and recovers"""
        print("🛡️ Testing Error Resilience...")
        start_time = time.time()

        try:
            # Test 1: Invalid memory data
            invalid_memory = {"invalid": "data"}
            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": "resilience_test"},
                json=invalid_memory,
                timeout=10,
            ) as response:
                memory_error_handled = response.status in [
                    400,
                    422,
                ]  # Expected error codes

            # Test 2: Invalid chat data
            invalid_chat = {"invalid": "chat_data"}
            async with self.session.post(
                "http://localhost:3033/chat", json=invalid_chat, timeout=10
            ) as response:
                chat_error_handled = response.status in [400, 422]

            # Test 3: Service recovery after error
            valid_memory = {
                "type": "recovery_test",
                "content": "Testing service recovery",
                "metadata": {"test": "resilience"},
                "tags": ["recovery", "test"],
            }

            async with self.session.post(
                "http://localhost:8017/memories",
                headers={"X-User-ID": "resilience_test"},
                json=valid_memory,
                timeout=10,
            ) as response:
                service_recovered = response.status == 200

            duration = time.time() - start_time
            resilience_score = sum(
                [memory_error_handled, chat_error_handled, service_recovered]
            )

            self.results.append(
                {
                    "test": "Error Resilience",
                    "status": "✅ PASS" if resilience_score == 3 else "⚠️ PARTIAL",
                    "duration": f"{
                        duration:.2f}s",
                    "memory_error_handled": memory_error_handled,
                    "chat_error_handled": chat_error_handled,
                    "service_recovered": service_recovered,
                    "resilience_score": f"{resilience_score}/3",
                })

            status = "✅ PASS" if resilience_score == 3 else "⚠️ PARTIAL"
            print(
                f"  {status} Error resilience: {resilience_score}/3 tests passed ({duration:.2f}s)"
            )

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Error Resilience",
                    "status": "❌ FAIL",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Error resilience test failed: {e}")

    async def test_performance_metrics(self):
        """Test performance metrics and response times"""
        print("📊 Testing Performance Metrics...")
        start_time = time.time()

        try:
            # Test response times for different operations
            operations = []

            # Memory operations
            memory_times = []
            for i in range(5):
                op_start = time.time()
                memory_data = {
                    "type": "performance_test",
                    "content": f"Performance test memory #{i}",
                    "metadata": {"test": "performance"},
                    "tags": ["performance", f"test-{i}"],
                }

                async with self.session.post(
                    "http://localhost:8017/memories",
                    headers={"X-User-ID": "performance_test"},
                    json=memory_data,
                    timeout=10,
                ) as response:
                    if response.status == 200:
                        memory_times.append(time.time() - op_start)

            # Chat operations
            chat_times = []
            for i in range(3):
                op_start = time.time()
                chat_data = {
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Performance test chat #{i}: What is AI?",
                        }],
                    "model": "llama2:latest",
                    "temperature": 0.7,
                    "max_tokens": 50,
                }

                async with self.session.post(
                    "http://localhost:3033/chat", json=chat_data, timeout=30
                ) as response:
                    if response.status == 200:
                        chat_times.append(time.time() - op_start)

            # ML operations
            ml_times = []
            for i in range(3):
                op_start = time.time()
                ml_data = {
                    "prompt": f"Performance test ML #{i}: AI orchestration",
                    "max_tokens": 30,
                    "temperature": 0.7,
                }

                async with self.session.post(
                    "http://localhost:8084/infer", json=ml_data, timeout=15
                ) as response:
                    if response.status == 200:
                        ml_times.append(time.time() - op_start)

            # Calculate statistics
            duration = time.time() - start_time

            metrics = {
                "memory_avg": statistics.mean(memory_times) if memory_times else 0,
                "memory_p95": (
                    statistics.quantiles(
                        memory_times,
                        n=20)[18] if len(memory_times) >= 5 else 0),
                "chat_avg": statistics.mean(chat_times) if chat_times else 0,
                "chat_p95": (
                    statistics.quantiles(
                        chat_times,
                        n=20)[18] if len(chat_times) >= 5 else 0),
                "ml_avg": statistics.mean(ml_times) if ml_times else 0,
                "ml_p95": (
                    statistics.quantiles(
                        ml_times,
                        n=20)[18] if len(ml_times) >= 5 else 0),
            }

            self.results.append(
                {
                    "test": "Performance Metrics",
                    "status": "✅ PASS",
                    "duration": f"{duration:.2f}s",
                    "metrics": metrics,
                    "memory_operations": len(memory_times),
                    "chat_operations": len(chat_times),
                    "ml_operations": len(ml_times),
                }
            )

            print(f"  ✅ Performance metrics collected ({duration:.2f}s)")
            print(
                f"    Memory: avg={
                    metrics['memory_avg']:.3f}s, p95={
                    metrics['memory_p95']:.3f}s")
            print(
                f"    Chat: avg={
                    metrics['chat_avg']:.3f}s, p95={
                    metrics['chat_p95']:.3f}s")
            print(
                f"    ML: avg={
                    metrics['ml_avg']:.3f}s, p95={
                    metrics['ml_p95']:.3f}s")

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Performance Metrics",
                    "status": "❌ FAIL",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Performance metrics failed: {e}")

    async def run_all_tests(self):
        """Run all orchestration tests"""
        print("🚀 Universal AI Tools - Orchestration Test Suite")
        print("=" * 60)

        await self.test_end_to_end_chat_with_memory()
        await self.test_concurrent_operations()
        await self.test_error_resilience()
        await self.test_performance_metrics()

        # Print summary
        print("\n" + "=" * 60)
        print("📊 ORCHESTRATION TEST RESULTS")
        print("=" * 60)

        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["status"] == "✅ PASS")
        partial_tests = sum(
            1 for r in self.results if r["status"] == "⚠️ PARTIAL")
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
            elif "metrics" in result:
                metrics = result["metrics"]
                print(f"    Memory avg: {metrics['memory_avg']:.3f}s")
                print(f"    Chat avg: {metrics['chat_avg']:.3f}s")
                print(f"    ML avg: {metrics['ml_avg']:.3f}s")

        # Save results
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"orchestration_test_results_{timestamp}.json"

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
                            (passed_tests + partial_tests * 0.5) / total_tests * 100),
                    },
                    "results": self.results,
                },
                f,
                indent=2,
            )

        print(f"\n💾 Results saved to: {filename}")


async def main():
    async with OrchestrationTester() as tester:
        await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
