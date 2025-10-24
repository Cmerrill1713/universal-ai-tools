#!/usr/bin/env python3
"""
Focused Test on Currently Running Services
Tests the services that are actually running and available
"""

import asyncio
import time
from datetime import datetime

import aiohttp


class FocusedServiceTester:
    def __init__(self):
        self.base_urls = {
            "api_gateway": "http://localhost:8081",
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
            "memory_service": "http://localhost:8017",
            "vision_service": "http://localhost:8084",
            "fast_llm": "http://localhost:3030",
            "parameter_analytics": "http://localhost:3032",
        }
        self.results = []
        self.start_time = time.time()

    async def test_llm_router_comprehensive(
        self, session: aiohttp.ClientSession
    ) -> dict:
        """Comprehensive LLM Router testing"""
        print("\n🤖 Testing LLM Router Comprehensive...")

        # Test 1: Health Check
        try:
            async with session.get(
                f"{self.base_urls['llm_router']}/health", timeout=10
            ) as response:
                health_status = (
                    "✅ Healthy"
                    if response.status == 200
                    else f"❌ Unhealthy ({response.status})"
                )
                print(f"  {health_status} Health Check")
        except Exception as e:
            print(f"  ❌ Health Check Error: {str(e)}")

        # Test 2: Models List
        try:
            async with session.get(
                f"{self.base_urls['llm_router']}/models", timeout=10
            ) as response:
                if response.status == 200:
                    models_data = await response.json()
                    models = models_data.get("models", [])
                    print(f"  ✅ Models Available: {len(models)} models")
                    for model in models[:3]:  # Show first 3 models
                        print(f"    - {model}")
                else:
                    print(f"  ❌ Models List Failed ({response.status})")
        except Exception as e:
            print(f"  ❌ Models List Error: {str(e)}")

        # Test 3: Chat Capabilities
        test_cases = [
            {
                "name": "Simple Greeting",
                "payload": {
                    "model": "llama3.2:3b",
                    "messages": [
                        {"role": "user", "content": "Hello! How are you today?"}
                    ],
                    "max_tokens": 50,
                    "temperature": 0.7,
                },
            },
            {
                "name": "Code Generation",
                "payload": {
                    "model": "llama3.2:3b",
                    "messages": [
                        {
                            "role": "user",
                            "content": "Write a simple Python function to reverse a string",
                        }
                    ],
                    "max_tokens": 100,
                    "temperature": 0.3,
                },
            },
            {
                "name": "Math Problem",
                "payload": {
                    "model": "llama3.2:3b",
                    "messages": [{"role": "user", "content": "What is 15 * 23 + 47?"}],
                    "max_tokens": 50,
                    "temperature": 0.1,
                },
            },
        ]

        successful_tests = 0
        for test_case in test_cases:
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json=test_case["payload"],
                    timeout=30,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        response_text = data.get("response", "")
                        print(
                            f"  ✅ {test_case['name']}: {response_time:.2f}s - {len(response_text)} chars"
                        )
                        successful_tests += 1
                    else:
                        print(f"  ❌ {test_case['name']}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ {test_case['name']}: Error - {str(e)}")

        return {"llm_tests": successful_tests, "total_tests": len(test_cases)}

    async def test_ml_inference_comprehensive(
        self, session: aiohttp.ClientSession
    ) -> dict:
        """Comprehensive ML Inference testing"""
        print("\n🔬 Testing ML Inference Comprehensive...")

        # Test 1: Health Check
        try:
            async with session.get(
                f"{self.base_urls['ml_inference']}/health", timeout=10
            ) as response:
                health_status = (
                    "✅ Healthy"
                    if response.status == 200
                    else f"❌ Unhealthy ({response.status})"
                )
                print(f"  {health_status} Health Check")
        except Exception as e:
            print(f"  ❌ Health Check Error: {str(e)}")

        # Test 2: Inference Capabilities
        test_cases = [
            {
                "name": "Creative Writing",
                "payload": {
                    "model_id": "llama3.2:3b",
                    "input": "Write a short story about a robot who discovers emotions",
                    "parameters": {"max_tokens": 150, "temperature": 0.8},
                },
            },
            {
                "name": "Code Analysis",
                "payload": {
                    "model_id": "llama3.2:3b",
                    "input": "Explain this code: def quicksort(arr): return arr if len(arr) <= 1 else quicksort([x for x in arr[1:] if x <= arr[0]]) + [arr[0]] + quicksort([x for x in arr[1:] if x > arr[0]])",
                    "parameters": {"max_tokens": 200, "temperature": 0.3},
                },
            },
            {
                "name": "Data Processing",
                "payload": {
                    "model_id": "llama3.2:3b",
                    "input": "How would you process a large CSV file with 1 million rows efficiently in Python?",
                    "parameters": {"max_tokens": 180, "temperature": 0.4},
                },
            },
        ]

        successful_tests = 0
        for test_case in test_cases:
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['ml_inference']}/infer",
                    json=test_case["payload"],
                    timeout=30,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        output = data.get("output", "")
                        print(
                            f"  ✅ {test_case['name']}: {response_time:.2f}s - {len(output)} chars"
                        )
                        successful_tests += 1
                    else:
                        print(f"  ❌ {test_case['name']}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ {test_case['name']}: Error - {str(e)}")

        return {"ml_tests": successful_tests, "total_tests": len(test_cases)}

    async def test_vision_service_comprehensive(
        self, session: aiohttp.ClientSession
    ) -> dict:
        """Comprehensive Vision Service testing"""
        print("\n👁️ Testing Vision Service Comprehensive...")

        # Test 1: Health Check
        try:
            async with session.get(
                f"{self.base_urls['vision_service']}/health", timeout=10
            ) as response:
                health_status = (
                    "✅ Healthy"
                    if response.status == 200
                    else f"❌ Unhealthy ({response.status})"
                )
                print(f"  {health_status} Health Check")
        except Exception as e:
            print(f"  ❌ Health Check Error: {str(e)}")

        # Test 2: Vision Analysis (using a simple test image)
        test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

        test_cases = [
            {
                "name": "Image Description",
                "payload": {"image": test_image, "task": "describe"},
            },
            {
                "name": "Object Detection",
                "payload": {"image": test_image, "task": "detect_objects"},
            },
            {
                "name": "Text Extraction",
                "payload": {"image": test_image, "task": "extract_text"},
            },
        ]

        successful_tests = 0
        for test_case in test_cases:
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['vision_service']}/vision/analyze",
                    json=test_case["payload"],
                    timeout=30,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        analysis = data.get("analysis", "")
                        print(
                            f"  ✅ {test_case['name']}: {response_time:.2f}s - {len(analysis)} chars"
                        )
                        successful_tests += 1
                    else:
                        print(f"  ❌ {test_case['name']}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ {test_case['name']}: Error - {str(e)}")

        return {"vision_tests": successful_tests, "total_tests": len(test_cases)}

    async def test_memory_service_comprehensive(
        self, session: aiohttp.ClientSession
    ) -> dict:
        """Comprehensive Memory Service testing"""
        print("\n🧠 Testing Memory Service Comprehensive...")

        headers = {"X-User-ID": "test-user-focused"}

        # Test 1: Store Multiple Memories
        memories = [
            {
                "content": "User prefers Python for data analysis and machine learning tasks",
                "tags": ["preference", "python", "data-analysis", "ml"],
                "metadata": {
                    "source": "user_interaction",
                    "timestamp": datetime.now().isoformat(),
                },
            },
            {
                "content": "User is working on a microservices architecture project",
                "tags": ["project", "microservices", "architecture"],
                "metadata": {
                    "source": "project_context",
                    "timestamp": datetime.now().isoformat(),
                },
            },
            {
                "content": "User has experience with Rust, Go, and Python programming languages",
                "tags": ["skills", "rust", "go", "python", "programming"],
                "metadata": {
                    "source": "skill_assessment",
                    "timestamp": datetime.now().isoformat(),
                },
            },
        ]

        successful_stores = 0
        for i, memory in enumerate(memories):
            try:
                async with session.post(
                    f"{self.base_urls['memory_service']}/memories",
                    json=memory,
                    headers=headers,
                    timeout=15,
                ) as response:
                    if response.status == 200:
                        print(f"  ✅ Store Memory {i+1}: Success")
                        successful_stores += 1
                    else:
                        print(f"  ❌ Store Memory {i+1}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ Store Memory {i+1}: Error - {str(e)}")

        # Test 2: Retrieve Memories
        try:
            async with session.get(
                f"{self.base_urls['memory_service']}/memories?limit=10",
                headers=headers,
                timeout=15,
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    memories_retrieved = len(data.get("memories", []))
                    print(
                        f"  ✅ Retrieve Memories: {memories_retrieved} memories found"
                    )
                else:
                    print(f"  ❌ Retrieve Memories: Failed ({response.status})")
        except Exception as e:
            print(f"  ❌ Retrieve Memories: Error - {str(e)}")

        return {"memory_tests": successful_stores, "total_tests": len(memories)}

    async def test_api_gateway_orchestration(
        self, session: aiohttp.ClientSession
    ) -> dict:
        """Test API Gateway orchestration"""
        print("\n🎭 Testing API Gateway Orchestration...")

        headers = {
            "X-User-ID": "test-user-orchestration",
            "Content-Type": "application/json",
        }

        # Test chat through API Gateway
        chat_payload = {
            "model": "llama3.2:3b",
            "messages": [
                {
                    "role": "user",
                    "content": "Explain the benefits of using microservices architecture in modern applications",
                }
            ],
            "max_tokens": 200,
            "temperature": 0.7,
        }

        try:
            start_time = time.time()
            async with session.post(
                f"{self.base_urls['api_gateway']}/api/chat",
                json=chat_payload,
                headers=headers,
                timeout=30,
            ) as response:
                response_time = time.time() - start_time
                if response.status == 200:
                    data = await response.json()
                    response_text = data.get("response", "")
                    print(
                        f"  ✅ Chat Orchestration: {response_time:.2f}s - {len(response_text)} chars"
                    )
                    return {"orchestration_success": True}
                else:
                    print(f"  ❌ Chat Orchestration: Failed ({response.status})")
                    return {"orchestration_success": False}
        except Exception as e:
            print(f"  ❌ Chat Orchestration: Error - {str(e)}")
            return {"orchestration_success": False}

    async def test_parameter_analytics(self, session: aiohttp.ClientSession) -> dict:
        """Test Parameter Analytics service"""
        print("\n📊 Testing Parameter Analytics...")

        try:
            async with session.get(
                f"{self.base_urls['parameter_analytics']}/health", timeout=10
            ) as response:
                if response.status == 200:
                    print("  ✅ Health Check: Healthy")
                else:
                    print(f"  ❌ Health Check: Failed ({response.status})")
        except Exception as e:
            print(f"  ❌ Health Check: Error - {str(e)}")

        try:
            async with session.get(
                f"{self.base_urls['parameter_analytics']}/metrics", timeout=10
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    print("  ✅ Metrics: Available")
                    return {"analytics_success": True}
                else:
                    print(f"  ❌ Metrics: Failed ({response.status})")
                    return {"analytics_success": False}
        except Exception as e:
            print(f"  ❌ Metrics: Error - {str(e)}")
            return {"analytics_success": False}

    async def run_focused_test(self):
        """Run focused test on running services"""
        print("🎯 Starting Focused Test on Running Services")
        print("=" * 60)

        async with aiohttp.ClientSession() as session:
            # Test each service comprehensively
            llm_results = await self.test_llm_router_comprehensive(session)
            ml_results = await self.test_ml_inference_comprehensive(session)
            vision_results = await self.test_vision_service_comprehensive(session)
            memory_results = await self.test_memory_service_comprehensive(session)
            orchestration_results = await self.test_api_gateway_orchestration(session)
            analytics_results = await self.test_parameter_analytics(session)

            # Calculate overall results
            total_time = time.time() - self.start_time

            print("\n" + "=" * 60)
            print("📊 FOCUSED TEST RESULTS")
            print("=" * 60)
            print(f"⏱️  Total Test Time: {total_time:.2f} seconds")
            print(
                f"🤖 LLM Router: {llm_results['llm_tests']}/{llm_results['total_tests']} tests passed"
            )
            print(
                f"🔬 ML Inference: {ml_results['ml_tests']}/{ml_results['total_tests']} tests passed"
            )
            print(
                f"👁️ Vision Service: {vision_results['vision_tests']}/{vision_results['total_tests']} tests passed"
            )
            print(
                f"🧠 Memory Service: {memory_results['memory_tests']}/{memory_results['total_tests']} tests passed"
            )
            print(
                f"🎭 API Gateway: {'✅ Working' if orchestration_results['orchestration_success'] else '❌ Failed'}"
            )
            print(
                f"📊 Parameter Analytics: {'✅ Working' if analytics_results['analytics_success'] else '❌ Failed'}"
            )

            # Overall assessment
            total_tests = (
                llm_results["total_tests"]
                + ml_results["total_tests"]
                + vision_results["total_tests"]
                + memory_results["total_tests"]
            )
            passed_tests = (
                llm_results["llm_tests"]
                + ml_results["ml_tests"]
                + vision_results["vision_tests"]
                + memory_results["memory_tests"]
            )

            success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

            if success_rate >= 80:
                status = "🟢 EXCELLENT"
            elif success_rate >= 60:
                status = "🟡 GOOD"
            elif success_rate >= 40:
                status = "🟠 FAIR"
            else:
                status = "🔴 POOR"

            print(
                f"📈 Overall Success Rate: {success_rate:.1f}% ({passed_tests}/{total_tests})"
            )
            print(f"🎯 System Status: {status}")


if __name__ == "__main__":
    tester = FocusedServiceTester()
    asyncio.run(tester.run_focused_test())
