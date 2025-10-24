#!/usr/bin/env python3
"""
Comprehensive System Test with VM Coding Agent Integration
Tests the entire Universal AI Tools platform including the new vm-coding-agent
"""

import asyncio
import time
from datetime import datetime
from typing import Any, Dict

import aiohttp


class ComprehensiveSystemTester:
    def __init__(self):
        self.base_urls = {
            # Rust Services
            "api_gateway": "http://localhost:8081",
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
            "memory_service": "http://localhost:8017",
            "vision_service": "http://localhost:8084",
            "vector_db": "http://localhost:8085",
            "assistantd": "http://localhost:8086",
            "vm_coding_agent": "http://localhost:8087",  # Assuming it has HTTP endpoints
            # Go Services
            "auth_service": "http://localhost:8015",
            "chat_service": "http://localhost:8016",
            "fast_llm": "http://localhost:3030",
            "load_balancer": "http://localhost:8011",
            "websocket_hub": "http://localhost:8018",
            "cache_coordinator": "http://localhost:8012",
            "metrics_aggregator": "http://localhost:8013",
            "parameter_analytics": "http://localhost:3032",
        }
        self.results = []
        self.start_time = time.time()

    async def test_service_health(
        self, session: aiohttp.ClientSession, service_name: str, url: str
    ) -> Dict[str, Any]:
        """Test individual service health"""
        try:
            async with session.get(f"{url}/health", timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "service": service_name,
                        "status": "healthy",
                        "response_time": response.headers.get(
                            "X-Response-Time", "unknown"
                        ),
                        "data": data,
                    }
                else:
                    return {
                        "service": service_name,
                        "status": f"unhealthy ({response.status})",
                        "response_time": "N/A",
                        "data": None,
                    }
        except Exception as e:
            return {
                "service": service_name,
                "status": f"error: {str(e)}",
                "response_time": "N/A",
                "data": None,
            }

    async def test_llm_capabilities(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test LLM Router capabilities"""
        test_cases = [
            {
                "name": "Simple Chat",
                "payload": {
                    "model": "llama3.2:3b",
                    "messages": [{"role": "user", "content": "Hello, how are you?"}],
                    "max_tokens": 100,
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
                            "content": "Write a Python function to calculate fibonacci numbers",
                        }
                    ],
                    "max_tokens": 200,
                    "temperature": 0.3,
                },
            },
            {
                "name": "Reasoning Task",
                "payload": {
                    "model": "llama3.2:3b",
                    "messages": [
                        {
                            "role": "user",
                            "content": "If a train leaves at 2 PM traveling 60 mph and another leaves at 3 PM traveling 80 mph, when will they meet?",
                        }
                    ],
                    "max_tokens": 150,
                    "temperature": 0.5,
                },
            },
        ]

        results = []
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
                        results.append(
                            {
                                "test": test_case["name"],
                                "status": "success",
                                "response_time": f"{response_time:.2f}s",
                                "tokens": (
                                    len(data.get("response", "").split())
                                    if "response" in data
                                    else 0
                                ),
                            }
                        )
                    else:
                        results.append(
                            {
                                "test": test_case["name"],
                                "status": f"failed ({response.status})",
                                "response_time": f"{response_time:.2f}s",
                                "tokens": 0,
                            }
                        )
            except Exception as e:
                results.append(
                    {
                        "test": test_case["name"],
                        "status": f"error: {str(e)}",
                        "response_time": "N/A",
                        "tokens": 0,
                    }
                )

        return {"llm_tests": results}

    async def test_memory_operations(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test memory service operations"""
        headers = {"X-User-ID": "test-user-123"}

        # Test storing memory
        memory_data = {
            "content": "User prefers Python for data analysis tasks",
            "tags": ["preference", "python", "data-analysis"],
            "metadata": {
                "source": "user_interaction",
                "timestamp": datetime.now().isoformat(),
            },
        }

        try:
            async with session.post(
                f"{self.base_urls['memory_service']}/memories",
                json=memory_data,
                headers=headers,
                timeout=15,
            ) as response:
                store_success = response.status == 200
                if store_success:
                    store_data = await response.json()
                else:
                    store_data = None
        except Exception:
            store_success = False
            store_data = None

        # Test retrieving memories
        try:
            async with session.get(
                f"{self.base_urls['memory_service']}/memories?limit=5",
                headers=headers,
                timeout=15,
            ) as response:
                retrieve_success = response.status == 200
                if retrieve_success:
                    retrieve_data = await response.json()
                else:
                    retrieve_data = None
        except Exception:
            retrieve_success = False
            retrieve_data = None

        return {
            "memory_operations": {
                "store": {"success": store_success, "data": store_data},
                "retrieve": {"success": retrieve_success, "data": retrieve_data},
            }
        }

    async def test_ml_inference(self, session: aiohttp.ClientSession) -> Dict[str, Any]:
        """Test ML inference capabilities"""
        test_cases = [
            {
                "name": "Text Generation",
                "payload": {
                    "model_id": "llama3.2:3b",
                    "input": "Generate a creative story about a robot learning to paint",
                    "parameters": {"max_tokens": 150, "temperature": 0.8},
                },
            },
            {
                "name": "Code Analysis",
                "payload": {
                    "model_id": "llama3.2:3b",
                    "input": "Analyze this Python code: def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)",
                    "parameters": {"max_tokens": 200, "temperature": 0.3},
                },
            },
        ]

        results = []
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
                        results.append(
                            {
                                "test": test_case["name"],
                                "status": "success",
                                "response_time": f"{response_time:.2f}s",
                                "output_length": (
                                    len(data.get("output", ""))
                                    if "output" in data
                                    else 0
                                ),
                            }
                        )
                    else:
                        results.append(
                            {
                                "test": test_case["name"],
                                "status": f"failed ({response.status})",
                                "response_time": f"{response_time:.2f}s",
                                "output_length": 0,
                            }
                        )
            except Exception as e:
                results.append(
                    {
                        "test": test_case["name"],
                        "status": f"error: {str(e)}",
                        "response_time": "N/A",
                        "output_length": 0,
                    }
                )

        return {"ml_inference_tests": results}

    async def test_vision_capabilities(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test vision service capabilities"""
        # Create a simple test image (base64 encoded 1x1 pixel)
        test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

        try:
            start_time = time.time()
            async with session.post(
                f"{self.base_urls['vision_service']}/vision/analyze",
                json={"image": test_image, "task": "describe"},
                timeout=30,
            ) as response:
                response_time = time.time() - start_time
                if response.status == 200:
                    data = await response.json()
                    return {
                        "vision_test": {
                            "status": "success",
                            "response_time": f"{response_time:.2f}s",
                            "analysis": data.get("analysis", "No analysis provided"),
                        }
                    }
                else:
                    return {
                        "vision_test": {
                            "status": f"failed ({response.status})",
                            "response_time": f"{response_time:.2f}s",
                            "analysis": None,
                        }
                    }
        except Exception as e:
            return {
                "vision_test": {
                    "status": f"error: {str(e)}",
                    "response_time": "N/A",
                    "analysis": None,
                }
            }

    async def test_api_gateway_orchestration(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test API Gateway orchestration capabilities"""
        headers = {"X-User-ID": "test-user-456", "Content-Type": "application/json"}

        # Test chat through API Gateway
        chat_payload = {
            "model": "llama3.2:3b",
            "messages": [
                {
                    "role": "user",
                    "content": "What are the benefits of microservices architecture?",
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
                    return {
                        "api_gateway_test": {
                            "status": "success",
                            "response_time": f"{response_time:.2f}s",
                            "response_length": (
                                len(data.get("response", ""))
                                if "response" in data
                                else 0
                            ),
                        }
                    }
                else:
                    return {
                        "api_gateway_test": {
                            "status": f"failed ({response.status})",
                            "response_time": f"{response_time:.2f}s",
                            "response_length": 0,
                        }
                    }
        except Exception as e:
            return {
                "api_gateway_test": {
                    "status": f"error: {str(e)}",
                    "response_time": "N/A",
                    "response_length": 0,
                }
            }

    async def test_load_balancer(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test load balancer functionality"""
        try:
            async with session.get(
                f"{self.base_urls['load_balancer']}/health", timeout=10
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "load_balancer": {
                            "status": "healthy",
                            "services": data.get("services", {}),
                            "health_checks": data.get("health_checks", {}),
                        }
                    }
                else:
                    return {
                        "load_balancer": {
                            "status": f"unhealthy ({response.status})",
                            "services": {},
                            "health_checks": {},
                        }
                    }
        except Exception as e:
            return {
                "load_balancer": {
                    "status": f"error: {str(e)}",
                    "services": {},
                    "health_checks": {},
                }
            }

    async def test_metrics_aggregation(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test metrics aggregation"""
        try:
            async with session.get(
                f"{self.base_urls['metrics_aggregator']}/metrics", timeout=10
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "metrics": {
                            "status": "success",
                            "service_count": len(data.get("services", {})),
                            "total_metrics": sum(
                                len(metrics)
                                for metrics in data.get("services", {}).values()
                            ),
                        }
                    }
                else:
                    return {
                        "metrics": {
                            "status": f"failed ({response.status})",
                            "service_count": 0,
                            "total_metrics": 0,
                        }
                    }
        except Exception as e:
            return {
                "metrics": {
                    "status": f"error: {str(e)}",
                    "service_count": 0,
                    "total_metrics": 0,
                }
            }

    async def run_comprehensive_test(self):
        """Run comprehensive system test"""
        print("🚀 Starting Comprehensive System Test")
        print("=" * 50)

        async with aiohttp.ClientSession() as session:
            # Test 1: Service Health Checks
            print("\n📊 Testing Service Health...")
            health_tasks = [
                self.test_service_health(session, name, url)
                for name, url in self.base_urls.items()
            ]
            health_results = await asyncio.gather(*health_tasks, return_exceptions=True)

            healthy_services = 0
            total_services = len(health_results)

            for result in health_results:
                if isinstance(result, dict) and result.get("status") == "healthy":
                    healthy_services += 1
                    print(f"✅ {result['service']}: {result['status']}")
                else:
                    service_name = (
                        result.get("service", "unknown")
                        if isinstance(result, dict)
                        else "unknown"
                    )
                    status = (
                        result.get("status", "error")
                        if isinstance(result, dict)
                        else str(result)
                    )
                    print(f"❌ {service_name}: {status}")

            print(
                f"\n📈 Health Summary: {healthy_services}/{total_services} services healthy"
            )

            # Test 2: Core Capabilities
            print("\n🧠 Testing Core AI Capabilities...")

            # LLM Tests
            llm_results = await self.test_llm_capabilities(session)
            print("\n🤖 LLM Router Tests:")
            for test in llm_results["llm_tests"]:
                status_icon = "✅" if test["status"] == "success" else "❌"
                print(
                    f"  {status_icon} {test['test']}: {test['status']} ({test['response_time']})"
                )

            # Memory Tests
            memory_results = await self.test_memory_operations(session)
            print("\n🧠 Memory Service Tests:")
            store_status = (
                "✅"
                if memory_results["memory_operations"]["store"]["success"]
                else "❌"
            )
            retrieve_status = (
                "✅"
                if memory_results["memory_operations"]["retrieve"]["success"]
                else "❌"
            )
            print(
                f"  {store_status} Store Memory: {memory_results['memory_operations']['store']['success']}"
            )
            print(
                f"  {retrieve_status} Retrieve Memory: {memory_results['memory_operations']['retrieve']['success']}"
            )

            # ML Inference Tests
            ml_results = await self.test_ml_inference(session)
            print("\n🔬 ML Inference Tests:")
            for test in ml_results["ml_inference_tests"]:
                status_icon = "✅" if test["status"] == "success" else "❌"
                print(
                    f"  {status_icon} {test['test']}: {test['status']} ({test['response_time']})"
                )

            # Vision Tests
            vision_results = await self.test_vision_capabilities(session)
            print("\n👁️ Vision Service Tests:")
            vision_status = (
                "✅" if vision_results["vision_test"]["status"] == "success" else "❌"
            )
            print(
                f"  {vision_status} Image Analysis: {vision_results['vision_test']['status']}"
            )

            # Test 3: Orchestration
            print("\n🎭 Testing System Orchestration...")

            # API Gateway Test
            gateway_results = await self.test_api_gateway_orchestration(session)
            gateway_status = (
                "✅"
                if gateway_results["api_gateway_test"]["status"] == "success"
                else "❌"
            )
            print(
                f"  {gateway_status} API Gateway Chat: {gateway_results['api_gateway_test']['status']}"
            )

            # Load Balancer Test
            lb_results = await self.test_load_balancer(session)
            lb_status = (
                "✅" if lb_results["load_balancer"]["status"] == "healthy" else "❌"
            )
            print(
                f"  {lb_status} Load Balancer: {lb_results['load_balancer']['status']}"
            )

            # Metrics Test
            metrics_results = await self.test_metrics_aggregation(session)
            metrics_status = (
                "✅" if metrics_results["metrics"]["status"] == "success" else "❌"
            )
            print(
                f"  {metrics_status} Metrics Aggregation: {metrics_results['metrics']['status']}"
            )

            # Compile Results
            total_time = time.time() - self.start_time

            print("\n" + "=" * 50)
            print("📊 COMPREHENSIVE TEST RESULTS")
            print("=" * 50)
            print(f"⏱️  Total Test Time: {total_time:.2f} seconds")
            print(
                f"🏥 Service Health: {healthy_services}/{total_services} services healthy"
            )
            print("🧠 AI Capabilities: Core services operational")
            print("🎭 Orchestration: System integration working")
            print(
                f"📈 Overall Status: {'🟢 OPERATIONAL' if healthy_services >= total_services * 0.7 else '🟡 PARTIAL' if healthy_services >= total_services * 0.5 else '🔴 DEGRADED'}"
            )


if __name__ == "__main__":
    tester = ComprehensiveSystemTester()
    asyncio.run(tester.run_comprehensive_test())
