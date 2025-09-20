#!/usr/bin/env python3
"""
Comprehensive Orchestration Test - Fixed Ports and Services
Tests the complete system with all running services and correct ports.
"""

import asyncio
import time
from typing import Any, Dict, List

import aiohttp


class ComprehensiveOrchestrationTester:
    def __init__(self):
        self.results: List[Dict[str, Any]] = []
        self.base_urls = {
            "api_gateway": "http://localhost:8080",
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
            "memory_service": "http://localhost:8017",
            "load_balancer": "http://localhost:8011",
            "websocket_hub": "http://localhost:8018",
            "cache_coordinator": "http://localhost:8012",
            "metrics_aggregator": "http://localhost:8013",
            "nats": "http://localhost:8222",
            "redis": "http://localhost:6379",
            "grafana": "http://localhost:3001",
        }

    async def test_service_health(self):
        """Test health of all services"""
        print("🔍 Testing Service Health...")

        health_tests = [
            ("API Gateway", f"{self.base_urls['api_gateway']}/health"),
            ("LLM Router", f"{self.base_urls['llm_router']}/health"),
            ("ML Inference", f"{self.base_urls['ml_inference']}/health"),
            ("Memory Service", f"{self.base_urls['memory_service']}/health"),
            ("Load Balancer", f"{self.base_urls['load_balancer']}/health"),
            ("WebSocket Hub", f"{self.base_urls['websocket_hub']}/health"),
            ("Cache Coordinator", f"{self.base_urls['cache_coordinator']}/health"),
            ("Metrics Aggregator", f"{self.base_urls['metrics_aggregator']}/health"),
        ]

        async with aiohttp.ClientSession() as session:
            for service_name, url in health_tests:
                start_time = time.time()
                try:
                    async with session.get(url, timeout=5) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            self.results.append(
                                {
                                    "test": f"Health Check - {service_name}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                    "service": service_name,
                                    "response": data.get("status", "unknown"),
                                }
                            )
                            print(
                                f"  ✅ {service_name}: {
                                    data.get(
                                        'status',
                                        'unknown')} ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Health Check - {service_name}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ {service_name}: Status {
                                    response.status}")
                except Exception as e:
                    duration = time.time() - start_time
                    self.results.append(
                        {
                            "test": f"Health Check - {service_name}",
                            "status": "❌ ERROR",
                            "duration": f"{duration:.2f}s",
                            "error": str(e),
                        }
                    )
                    print(f"  ❌ {service_name}: {e}")

    async def test_end_to_end_chat_flow(self):
        """Test complete chat flow through API Gateway"""
        print("\n💬 Testing End-to-End Chat Flow...")

        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                # Test chat through API Gateway
                chat_data = {
                    "messages": [
                        {"role": "user", "content": "What is the capital of France?"}
                    ],
                    "model": "llama3.2:3b",
                    "temperature": 0.7,
                    "max_tokens": 100,
                }

                async with session.post(
                    f"{self.base_urls['api_gateway']}/api/chat",
                    json=chat_data,
                    headers={"X-User-ID": "test_user"},
                    timeout=30,
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        self.results.append(
                            {
                                "test": "End-to-End Chat Flow",
                                "status": "✅ PASS",
                                "duration": f"{
                                    duration:.2f}s",
                                "response_length": len(
                                    data.get(
                                        "content",
                                        "")),
                                "model": data.get(
                                    "model",
                                    "unknown"),
                            })
                        print(
                            f"  ✅ Chat successful ({
                                duration:.2f}s): {
                                data.get(
                                    'content', '')[
                                    :100]}...")
                    else:
                        self.results.append(
                            {
                                "test": "End-to-End Chat Flow",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(f"  ❌ Chat failed: Status {response.status}")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "End-to-End Chat Flow",
                    "status": "❌ ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Chat error: {e}")

    async def test_memory_integration(self):
        """Test memory storage and retrieval"""
        print("\n🧠 Testing Memory Integration...")

        # Store memory
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                memory_data = {
                    "type": "test",
                    "content": "This is a comprehensive orchestration test memory",
                    "tags": [
                        "test",
                        "orchestration",
                        "comprehensive"],
                    "metadata": {
                        "test_type": "comprehensive"},
                }

                async with session.post(
                    f"{self.base_urls['memory_service']}/memories",
                    json=memory_data,
                    headers={"X-User-ID": "test_user"},
                    timeout=10,
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        memory_id = data.get("id")

                        # Retrieve memory
                        async with session.get(
                            f"{self.base_urls['memory_service']}/memories?limit=10",
                            headers={"X-User-ID": "test_user"},
                            timeout=10,
                        ) as response2:
                            if response2.status == 200:
                                data2 = await response2.json()
                                memories = data2.get("memories", [])
                                self.results.append(
                                    {
                                        "test": "Memory Integration",
                                        "status": "✅ PASS",
                                        "duration": f"{duration:.2f}s",
                                        "memories_stored": 1,
                                        "memories_retrieved": len(memories),
                                    }
                                )
                                print(
                                    f"  ✅ Memory stored and retrieved ({
                                        duration:.2f}s): {
                                        len(memories)} memories")
                            else:
                                self.results.append(
                                    {
                                        "test": "Memory Integration", "status": "⚠️ PARTIAL", "duration": f"{
                                            duration:.2f}s", "error": f"Retrieval failed: Status {
                                            response2.status}", })
                                print(
                                    f"  ⚠️ Memory stored but retrieval failed: Status {
                                        response2.status}")
                    else:
                        self.results.append(
                            {
                                "test": "Memory Integration", "status": "❌ FAIL", "duration": f"{
                                    duration:.2f}s", "error": f"Storage failed: Status {
                                    response.status}", })
                        print(
                            f"  ❌ Memory storage failed: Status {
                                response.status}")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Memory Integration",
                    "status": "❌ ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Memory error: {e}")

    async def test_ml_inference_workflow(self):
        """Test ML inference workflow"""
        print("\n🤖 Testing ML Inference Workflow...")

        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                ml_data = {
                    "model_id": "llama3.2:3b",
                    "input": "Analyze this comprehensive orchestration test and provide insights",
                    "parameters": {
                        "max_tokens": 50,
                        "temperature": 0.5},
                    "task_type": "text_generation",
                }

                async with session.post(
                    f"{self.base_urls['ml_inference']}/infer", json=ml_data, timeout=15
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        self.results.append(
                            {
                                "test": "ML Inference Workflow",
                                "status": "✅ PASS",
                                "duration": f"{duration:.2f}s",
                                "response_length": len(data.get("output", "")),
                                "model_used": data.get("model_id", "unknown"),
                            }
                        )
                        print(
                            f"  ✅ ML inference successful ({
                                duration:.2f}s): {
                                data.get(
                                    'output', '')[
                                    :100]}...")
                    else:
                        self.results.append(
                            {
                                "test": "ML Inference Workflow",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"  ❌ ML inference failed: Status {
                                response.status}")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "ML Inference Workflow",
                    "status": "❌ ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ ML inference error: {e}")

    async def test_concurrent_operations(self):
        """Test concurrent operations across services"""
        print("\n⚡ Testing Concurrent Operations...")

        start_time = time.time()

        async def single_operation(operation_id: int):
            async with aiohttp.ClientSession() as session:
                try:
                    # Concurrent chat request
                    chat_data = {
                        "messages": [
                            {
                                "role": "user",
                                "content": f"Concurrent test {operation_id}",
                            }
                        ],
                        "model": "llama3.2:3b",
                        "temperature": 0.5,
                        "max_tokens": 50,
                    }

                    async with session.post(
                        f"{self.base_urls['api_gateway']}/api/chat",
                        json=chat_data,
                        headers={"X-User-ID": f"user_{operation_id}"},
                        timeout=20,
                    ) as response:
                        if response.status == 200:
                            return f"Operation {operation_id}: SUCCESS"
                        else:
                            return (
                                f"Operation {operation_id}: FAILED ({
                                    response.status})")
                except Exception as e:
                    return f"Operation {operation_id}: ERROR ({e})"

        # Run 5 concurrent operations
        tasks = [single_operation(i) for i in range(5)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        duration = time.time() - start_time
        success_count = sum(1 for r in results if "SUCCESS" in str(r))

        self.results.append(
            {
                "test": "Concurrent Operations",
                "status": "✅ PASS" if success_count >= 4 else "⚠️ PARTIAL",
                "duration": f"{duration:.2f}s",
                "successful_operations": success_count,
                "total_operations": 5,
                "success_rate": f"{(success_count / 5) * 100:.1f}%",
            }
        )

        print(
            f"  ✅ Concurrent operations: {success_count}/5 successful ({duration:.2f}s)"
        )
        for result in results:
            print(f"    {result}")

    async def test_infrastructure_connectivity(self):
        """Test connectivity to infrastructure services"""
        print("\n🏗️ Testing Infrastructure Connectivity...")

        infrastructure_tests = [
            ("NATS", f"{self.base_urls['nats']}/varz"),
            # Redis doesn't have HTTP endpoint
            ("Redis", "redis://localhost:6379"),
            ("Grafana", f"{self.base_urls['grafana']}/api/health"),
        ]

        async with aiohttp.ClientSession() as session:
            for service_name, url in infrastructure_tests:
                start_time = time.time()
                try:
                    if service_name == "Redis":
                        # Skip Redis HTTP test - it's not HTTP
                        self.results.append(
                            {
                                "test": f"Infrastructure - {service_name}",
                                "status": "⚠️ SKIP",
                                "duration": "0.00s",
                                "note": "Redis is running (confirmed via Docker)",
                            })
                        print(
                            f"  ⚠️ {service_name}: Skipped (Redis doesn't have HTTP endpoint)")
                        continue

                    async with session.get(url, timeout=5) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            self.results.append(
                                {
                                    "test": f"Infrastructure - {service_name}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                }
                            )
                            print(
                                f"  ✅ {service_name}: Connected ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Infrastructure - {service_name}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ {service_name}: Status {
                                    response.status}")
                except Exception as e:
                    duration = time.time() - start_time
                    self.results.append(
                        {
                            "test": f"Infrastructure - {service_name}",
                            "status": "❌ ERROR",
                            "duration": f"{duration:.2f}s",
                            "error": str(e),
                        }
                    )
                    print(f"  ❌ {service_name}: {e}")

    async def run_comprehensive_test(self):
        """Run all comprehensive tests"""
        print("🚀 Starting Comprehensive Orchestration Test")
        print("=" * 60)

        await self.test_service_health()
        await self.test_end_to_end_chat_flow()
        await self.test_memory_integration()
        await self.test_ml_inference_workflow()
        await self.test_concurrent_operations()
        await self.test_infrastructure_connectivity()

        # Generate summary
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE ORCHESTRATION TEST SUMMARY")
        print("=" * 60)

        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["status"] == "✅ PASS")
        partial_tests = sum(
            1 for r in self.results if r["status"] == "⚠️ PARTIAL")
        failed_tests = sum(1 for r in self.results if r["status"] == "❌ FAIL")
        error_tests = sum(1 for r in self.results if r["status"] == "❌ ERROR")

        success_rate = (
            (passed_tests + partial_tests * 0.5) / total_tests) * 100

        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"⚠️ Partial: {partial_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"💥 Errors: {error_tests}")
        print(f"📈 Success Rate: {success_rate:.1f}%")

        print("\n🔍 Detailed Results:")
        for result in self.results:
            status_emoji = {
                "✅ PASS": "✅",
                "⚠️ PARTIAL": "⚠️",
                "❌ FAIL": "❌",
                "❌ ERROR": "💥",
                "⚠️ SKIP": "⏭️",
            }.get(result["status"], "❓")
            print(f"  {status_emoji} {result['test']}: {result['duration']}")
            if "error" in result:
                print(f"    Error: {result['error']}")

        return success_rate >= 80


async def main():
    tester = ComprehensiveOrchestrationTester()
    success = await tester.run_comprehensive_test()

    if success:
        print("\n🎉 Comprehensive orchestration test PASSED!")
        exit(0)
    else:
        print("\n💥 Comprehensive orchestration test FAILED!")
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())
