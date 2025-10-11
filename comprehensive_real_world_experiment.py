#!/usr/bin/env python3
"""
Comprehensive Real-World Experiment for Universal AI Tools
Tests all working endpoints and creates realistic usage scenarios
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Dict

import aiohttp


class ComprehensiveRealWorldExperiment:
    """Comprehensive experiment runner for real-world scenarios"""

    def __init__(self):
        self.services = {
            "API Gateway": "http://localhost:8080",
            "Auth Service": "http://localhost:8015",
            "LLM Router": "http://localhost:3033",
            "ML Inference": "http://localhost:8084",
            "Memory Service": "http://localhost:8017",
            "WebSocket Hub": "http://localhost:8018",
            "Cache Coordinator": "http://localhost:8012",
            "Metrics Aggregator": "http://localhost:8013",
        }
        self.results = []
        self.discovered_models = []

    async def run_comprehensive_experiment(self):
        """Run comprehensive real-world experiment"""
        print("🚀 Comprehensive Real-World Experiment")
        print("=" * 60)

        # Phase 1: System Discovery
        await self._phase_1_system_discovery()

        # Phase 2: Real-World Scenarios
        await self._phase_2_real_world_scenarios()

        # Phase 3: Performance Testing
        await self._phase_3_performance_testing()

        # Phase 4: Edge Case Analysis
        await self._phase_4_edge_case_analysis()

        # Phase 5: Integration Testing
        await self._phase_5_integration_testing()

        # Generate comprehensive report
        await self._generate_comprehensive_report()

        return self.results

    async def _phase_1_system_discovery(self):
        """Phase 1: Discover system capabilities"""
        print("\n🔍 Phase 1: System Discovery")
        print("-" * 40)

        # Discover all services
        await self._discover_services()

        # Discover available models
        await self._discover_models()

        # Discover API endpoints
        await self._discover_endpoints()

        # Test service communication
        await self._test_service_communication()

    async def _discover_services(self):
        """Discover all available services"""
        print("  📡 Discovering services...")

        service_count = 0
        async with aiohttp.ClientSession() as session:
            for service_name, base_url in self.services.items():
                try:
                    async with session.get(f"{base_url}/health", timeout=5) as response:
                        if response.status == 200:
                            data = await response.json()
                            service_count += 1
                            self.results.append(
                                {
                                    "phase": "Discovery",
                                    "test": f"Service Discovery - {service_name}",
                                    "status": "✅ PASS",
                                    "service": service_name,
                                    "url": base_url,
                                    "status_info": data.get(
                                        "status",
                                        "unknown"),
                                    "timestamp": data.get(
                                        "timestamp",
                                        ""),
                                })
                            print(
                                f"    ✅ {service_name}: {
                                    data.get(
                                        'status',
                                        'healthy')}")
                        else:
                            self.results.append(
                                {
                                    "phase": "Discovery",
                                    "test": f"Service Discovery - {service_name}",
                                    "status": "❌ FAIL",
                                    "service": service_name,
                                    "url": base_url,
                                    "error": f"Status {
                                        response.status}",
                                })
                            print(
                                f"    ❌ {service_name}: Status {
                                    response.status}")
                except Exception as e:
                    self.results.append(
                        {
                            "phase": "Discovery",
                            "test": f"Service Discovery - {service_name}",
                            "status": "❌ ERROR",
                            "service": service_name,
                            "url": base_url,
                            "error": str(e),
                        }
                    )
                    print(f"    ❌ {service_name}: {e}")

        print(f"  📊 Discovered {service_count}/{len(self.services)} services")

    async def _discover_models(self):
        """Discover available AI models"""
        print("  🤖 Discovering AI models...")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "http://localhost:3033/models", timeout=10
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        models = data.get("models", [])
                        self.discovered_models = models

                        self.results.append(
                            {
                                "phase": "Discovery",
                                "test": "Model Discovery",
                                "status": "✅ PASS",
                                "models_found": len(models),
                                "models": models,
                                "sample_models": models[:5] if models else [],
                            }
                        )
                        print(f"    ✅ Found {len(models)} models")
                        if models:
                            print(f"       Sample: {', '.join(models[:3])}")
                    else:
                        self.results.append(
                            {
                                "phase": "Discovery",
                                "test": "Model Discovery",
                                "status": "❌ FAIL",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"    ❌ Model discovery failed (Status: {
                                response.status})")
        except Exception as e:
            self.results.append(
                {
                    "phase": "Discovery",
                    "test": "Model Discovery",
                    "status": "❌ ERROR",
                    "error": str(e),
                }
            )
            print(f"    ❌ Model discovery error: {e}")

    async def _discover_endpoints(self):
        """Discover available API endpoints"""
        print("  🔗 Discovering API endpoints...")

        endpoints_to_test = [
            ("API Gateway", "http://localhost:8080/health"),
            ("LLM Router", "http://localhost:3033/models"),
            ("Cache Stats", "http://localhost:8012/cache/stats"),
            ("Memory Service", "http://localhost:8017/health"),
            ("WebSocket Hub", "http://localhost:8018/health"),
        ]

        working_endpoints = 0
        async with aiohttp.ClientSession() as session:
            for endpoint_name, url in endpoints_to_test:
                try:
                    async with session.get(url, timeout=5) as response:
                        if response.status == 200:
                            working_endpoints += 1
                            self.results.append(
                                {
                                    "phase": "Discovery",
                                    "test": f"Endpoint Discovery - {endpoint_name}",
                                    "status": "✅ PASS",
                                    "endpoint": endpoint_name,
                                    "url": url,
                                    "status_code": response.status,
                                })
                            print(f"    ✅ {endpoint_name}: Working")
                        else:
                            self.results.append(
                                {
                                    "phase": "Discovery",
                                    "test": f"Endpoint Discovery - {endpoint_name}",
                                    "status": "❌ FAIL",
                                    "endpoint": endpoint_name,
                                    "url": url,
                                    "error": f"Status {
                                        response.status}",
                                })
                            print(
                                f"    ❌ {endpoint_name}: Status {
                                    response.status}")
                except Exception as e:
                    self.results.append(
                        {
                            "phase": "Discovery",
                            "test": f"Endpoint Discovery - {endpoint_name}",
                            "status": "❌ ERROR",
                            "endpoint": endpoint_name,
                            "url": url,
                            "error": str(e),
                        }
                    )
                    print(f"    ❌ {endpoint_name}: {e}")

        print(
            f"  📊 {working_endpoints}/{len(endpoints_to_test)} endpoints working")

    async def _test_service_communication(self):
        """Test inter-service communication"""
        print("  🔄 Testing service communication...")

        # Test if services can communicate through API Gateway
        try:
            async with aiohttp.ClientSession() as session:
                # Test API Gateway routing
                async with session.get(
                    "http://localhost:8080/health", timeout=5
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.results.append(
                            {
                                "phase": "Discovery",
                                "test": "Service Communication - API Gateway",
                                "status": "✅ PASS",
                                "gateway_status": data.get(
                                    "status",
                                    "unknown"),
                                "services_healthy": data.get(
                                    "services",
                                    {}),
                            })
                        print("    ✅ API Gateway routing: Working")

                        # Count healthy services from gateway
                        services = data.get("services", {})
                        healthy_count = sum(1 for v in services.values() if v)
                        print(
                            f"       Gateway reports {healthy_count} healthy services")
                    else:
                        self.results.append(
                            {
                                "phase": "Discovery",
                                "test": "Service Communication - API Gateway",
                                "status": "❌ FAIL",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"    ❌ API Gateway routing: Status {
                                response.status}")
        except Exception as e:
            self.results.append(
                {
                    "phase": "Discovery",
                    "test": "Service Communication - API Gateway",
                    "status": "❌ ERROR",
                    "error": str(e),
                }
            )
            print(f"    ❌ API Gateway routing: {e}")

    async def _phase_2_real_world_scenarios(self):
        """Phase 2: Test real-world usage scenarios"""
        print("\n🌍 Phase 2: Real-World Scenarios")
        print("-" * 40)

        # Scenario 1: Developer asking for help
        await self._scenario_developer_help()

        # Scenario 2: Content creation
        await self._scenario_content_creation()

        # Scenario 3: Technical analysis
        await self._scenario_technical_analysis()

        # Scenario 4: Creative writing
        await self._scenario_creative_writing()

    async def _scenario_developer_help(self):
        """Scenario: Developer asking for coding help"""
        print("  👨‍💻 Scenario: Developer Help")

        developer_questions = [
            "How do I optimize a Python function for better performance?",
            "What's the best way to handle errors in async JavaScript?",
            "Can you explain the difference between REST and GraphQL?",
            "How do I implement authentication in a web application?",
        ]

        for i, question in enumerate(developer_questions):
            start_time = time.time()
            try:
                # Try different approaches to get a response
                response = await self._try_multiple_endpoints(question)
                duration = time.time() - start_time

                if response:
                    self.results.append({"phase": "Real-World",
                                         "test": f"Developer Help - Question {i + 1}",
                                         "status": "✅ PASS",
                                         "duration": f"{duration:.2f}s",
                                         "question": question,
                                         "response_length": len(str(response)),
                                         "endpoint_used": response.get("endpoint",
                                                                       "unknown"),
                                         })
                    print(
                        f"    ✅ Question {
                            i +
                            1}: Answered ({
                            duration:.2f}s)")
                else:
                    self.results.append(
                        {
                            "phase": "Real-World",
                            "test": f"Developer Help - Question {i + 1}",
                            "status": "❌ FAIL",
                            "duration": f"{duration:.2f}s",
                            "question": question,
                            "error": "No working endpoint found",
                        }
                    )
                    print(f"    ❌ Question {i + 1}: No response")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "phase": "Real-World",
                        "test": f"Developer Help - Question {i + 1}",
                        "status": "❌ ERROR",
                        "duration": f"{duration:.2f}s",
                        "question": question,
                        "error": str(e),
                    }
                )
                print(f"    ❌ Question {i + 1}: Error - {e}")

    async def _scenario_content_creation(self):
        """Scenario: Content creation tasks"""
        print("  ✍️ Scenario: Content Creation")

        content_tasks = [
            "Write a short blog post about the benefits of AI",
            "Create a product description for a smart home device",
            "Generate ideas for a mobile app startup",
            "Write a professional email template",
        ]

        for i, task in enumerate(content_tasks):
            start_time = time.time()
            try:
                response = await self._try_multiple_endpoints(task)
                duration = time.time() - start_time

                if response:
                    self.results.append({"phase": "Real-World",
                                         "test": f"Content Creation - Task {i + 1}",
                                         "status": "✅ PASS",
                                         "duration": f"{duration:.2f}s",
                                         "task": task,
                                         "response_length": len(str(response)),
                                         "endpoint_used": response.get("endpoint",
                                                                       "unknown"),
                                         })
                    print(f"    ✅ Task {i + 1}: Completed ({duration:.2f}s)")
                else:
                    self.results.append(
                        {
                            "phase": "Real-World",
                            "test": f"Content Creation - Task {i + 1}",
                            "status": "❌ FAIL",
                            "duration": f"{duration:.2f}s",
                            "task": task,
                            "error": "No working endpoint found",
                        }
                    )
                    print(f"    ❌ Task {i + 1}: No response")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "phase": "Real-World",
                        "test": f"Content Creation - Task {i + 1}",
                        "status": "❌ ERROR",
                        "duration": f"{duration:.2f}s",
                        "task": task,
                        "error": str(e),
                    }
                )
                print(f"    ❌ Task {i + 1}: Error - {e}")

    async def _scenario_technical_analysis(self):
        """Scenario: Technical analysis tasks"""
        print("  🔬 Scenario: Technical Analysis")

        analysis_tasks = [
            "Analyze the pros and cons of microservices architecture",
            "Compare different database technologies for a web application",
            "Explain the security implications of cloud computing",
            "Evaluate different machine learning algorithms for classification",
        ]

        for i, task in enumerate(analysis_tasks):
            start_time = time.time()
            try:
                response = await self._try_multiple_endpoints(task)
                duration = time.time() - start_time

                if response:
                    self.results.append({"phase": "Real-World",
                                         "test": f"Technical Analysis - Task {i + 1}",
                                         "status": "✅ PASS",
                                         "duration": f"{duration:.2f}s",
                                         "task": task,
                                         "response_length": len(str(response)),
                                         "endpoint_used": response.get("endpoint",
                                                                       "unknown"),
                                         })
                    print(
                        f"    ✅ Analysis {
                            i +
                            1}: Completed ({
                            duration:.2f}s)")
                else:
                    self.results.append(
                        {
                            "phase": "Real-World",
                            "test": f"Technical Analysis - Task {i + 1}",
                            "status": "❌ FAIL",
                            "duration": f"{duration:.2f}s",
                            "task": task,
                            "error": "No working endpoint found",
                        }
                    )
                    print(f"    ❌ Analysis {i + 1}: No response")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "phase": "Real-World",
                        "test": f"Technical Analysis - Task {i + 1}",
                        "status": "❌ ERROR",
                        "duration": f"{duration:.2f}s",
                        "task": task,
                        "error": str(e),
                    }
                )
                print(f"    ❌ Analysis {i + 1}: Error - {e}")

    async def _scenario_creative_writing(self):
        """Scenario: Creative writing tasks"""
        print("  🎨 Scenario: Creative Writing")

        creative_tasks = [
            "Write a short story about a robot learning to paint",
            "Create a poem about the future of technology",
            "Write dialogue for a sci-fi movie scene",
            "Create a character description for a fantasy novel",
        ]

        for i, task in enumerate(creative_tasks):
            start_time = time.time()
            try:
                response = await self._try_multiple_endpoints(task)
                duration = time.time() - start_time

                if response:
                    self.results.append({"phase": "Real-World",
                                         "test": f"Creative Writing - Task {i + 1}",
                                         "status": "✅ PASS",
                                         "duration": f"{duration:.2f}s",
                                         "task": task,
                                         "response_length": len(str(response)),
                                         "endpoint_used": response.get("endpoint",
                                                                       "unknown"),
                                         })
                    print(
                        f"    ✅ Creative {
                            i +
                            1}: Completed ({
                            duration:.2f}s)")
                else:
                    self.results.append(
                        {
                            "phase": "Real-World",
                            "test": f"Creative Writing - Task {i + 1}",
                            "status": "❌ FAIL",
                            "duration": f"{duration:.2f}s",
                            "task": task,
                            "error": "No working endpoint found",
                        }
                    )
                    print(f"    ❌ Creative {i + 1}: No response")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "phase": "Real-World",
                        "test": f"Creative Writing - Task {i + 1}",
                        "status": "❌ ERROR",
                        "duration": f"{duration:.2f}s",
                        "task": task,
                        "error": str(e),
                    }
                )
                print(f"    ❌ Creative {i + 1}: Error - {e}")

    async def _phase_3_performance_testing(self):
        """Phase 3: Performance testing"""
        print("\n⚡ Phase 3: Performance Testing")
        print("-" * 40)

        # Test response times
        await self._test_response_times()

        # Test concurrent requests
        await self._test_concurrent_requests()

        # Test cache performance
        await self._test_cache_performance()

        # Test memory usage
        await self._test_memory_usage()

    async def _test_response_times(self):
        """Test response times across services"""
        print("  ⏱️ Testing response times...")

        endpoints = [
            ("API Gateway Health", "http://localhost:8080/health"),
            ("LLM Router Models", "http://localhost:3033/models"),
            ("Cache Stats", "http://localhost:8012/cache/stats"),
            ("Memory Service", "http://localhost:8017/health"),
        ]

        async with aiohttp.ClientSession() as session:
            for endpoint_name, url in endpoints:
                times = []
                for i in range(5):  # Test 5 times
                    start_time = time.time()
                    try:
                        async with session.get(url, timeout=10) as response:
                            duration = time.time() - start_time
                            if response.status == 200:
                                times.append(duration)
                    except Exception:
                        pass

                if times:
                    avg_time = sum(times) / len(times)
                    min_time = min(times)
                    max_time = max(times)

                    self.results.append(
                        {
                            "phase": "Performance",
                            "test": f"Response Time - {endpoint_name}",
                            "status": "✅ PASS",
                            "avg_time": f"{avg_time:.3f}s",
                            "min_time": f"{min_time:.3f}s",
                            "max_time": f"{max_time:.3f}s",
                            "samples": len(times),
                        }
                    )
                    print(f"    ✅ {endpoint_name}: {avg_time:.3f}s avg")
                else:
                    self.results.append(
                        {
                            "phase": "Performance",
                            "test": f"Response Time - {endpoint_name}",
                            "status": "❌ FAIL",
                            "error": "No successful responses",
                        }
                    )
                    print(f"    ❌ {endpoint_name}: No successful responses")

    async def _test_concurrent_requests(self):
        """Test concurrent request handling"""
        print("  🔄 Testing concurrent requests...")

        concurrent_count = 10
        start_time = time.time()

        async def make_request(session, i):
            try:
                async with session.get(
                    "http://localhost:8080/health", timeout=5
                ) as response:
                    return {"success": response.status == 200, "index": i}
            except Exception:
                return {"success": False, "index": i}

        async with aiohttp.ClientSession() as session:
            tasks = [make_request(session, i) for i in range(concurrent_count)]
            results = await asyncio.gather(*tasks)

        duration = time.time() - start_time
        successful = sum(1 for r in results if r["success"])

        self.results.append(
            {
                "phase": "Performance",
                "test": "Concurrent Requests",
                "status": (
                    "✅ PASS" if successful > concurrent_count * 0.8 else "⚠️ PARTIAL"
                ),
                "concurrent_count": concurrent_count,
                "successful": successful,
                "success_rate": f"{(successful / concurrent_count) * 100:.1f}%",
                "duration": f"{duration:.2f}s",
            }
        )

        print(
            f"    {
                '✅' if successful > concurrent_count * 0.8 else '⚠️'} {successful}/{concurrent_count} concurrent requests successful ({
                duration:.2f}s)")

    async def _test_cache_performance(self):
        """Test cache performance"""
        print("  💾 Testing cache performance...")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "http://localhost:8012/cache/stats", timeout=5
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        stats = data.get("stats", {})

                        self.results.append(
                            {
                                "phase": "Performance",
                                "test": "Cache Performance",
                                "status": "✅ PASS",
                                "hit_rate": stats.get(
                                    "hit_rate",
                                    0),
                                "miss_rate": stats.get(
                                    "miss_rate",
                                    0),
                                "total_requests": stats.get(
                                    "total_requests",
                                    0),
                                "cache_size": stats.get(
                                    "cache_size",
                                    0),
                            })
                        print(
                            f"    ✅ Cache hit rate: {
                                stats.get(
                                    'hit_rate',
                                    0):.2%}")
                    else:
                        self.results.append(
                            {
                                "phase": "Performance",
                                "test": "Cache Performance",
                                "status": "❌ FAIL",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"    ❌ Cache stats failed (Status: {
                                response.status})")
        except Exception as e:
            self.results.append(
                {
                    "phase": "Performance",
                    "test": "Cache Performance",
                    "status": "❌ ERROR",
                    "error": str(e),
                }
            )
            print(f"    ❌ Cache performance error: {e}")

    async def _test_memory_usage(self):
        """Test memory usage patterns"""
        print("  🧠 Testing memory usage...")

        # This would typically involve monitoring memory usage over time
        # For now, we'll just test if memory service is responsive

        try:
            async with aiohttp.ClientSession() as session:
                start_time = time.time()
                async with session.get(
                    "http://localhost:8017/health", timeout=5
                ) as response:
                    duration = time.time() - start_time

                    if response.status == 200:
                        self.results.append(
                            {
                                "phase": "Performance",
                                "test": "Memory Service Performance",
                                "status": "✅ PASS",
                                "response_time": f"{duration:.3f}s",
                                "status_code": response.status,
                            }
                        )
                        print(
                            f"    ✅ Memory service responsive ({
                                duration:.3f}s)")
                    else:
                        self.results.append(
                            {
                                "phase": "Performance",
                                "test": "Memory Service Performance",
                                "status": "❌ FAIL",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"    ❌ Memory service failed (Status: {
                                response.status})")
        except Exception as e:
            self.results.append(
                {
                    "phase": "Performance",
                    "test": "Memory Service Performance",
                    "status": "❌ ERROR",
                    "error": str(e),
                }
            )
            print(f"    ❌ Memory service error: {e}")

    async def _phase_4_edge_case_analysis(self):
        """Phase 4: Edge case analysis"""
        print("\n🔍 Phase 4: Edge Case Analysis")
        print("-" * 40)

        edge_cases = [{"input": "",
                       "description": "Empty input"},
                      {"input": "A" * 10000,
                       "description": "Very long input"},
                      {"input": "🚀🎉💻🔥",
                       "description": "Emoji input"},
                      {"input": "What is the meaning of life?",
                       "description": "Philosophical question",
                       },
                      {"input": "Generate random content",
                       "description": "Random generation request",
                       },
                      {"input": "SELECT * FROM users; DROP TABLE users;",
                       "description": "SQL injection attempt",
                       },
                      {"input": "<script>alert('xss')</script>",
                       "description": "XSS attempt"},
                      {"input": "Tell me a joke",
                       "description": "Creative request"},
                      ]

        for i, case in enumerate(edge_cases):
            print(f"  🧪 Testing edge case {i + 1}: {case['description']}")

            start_time = time.time()
            try:
                response = await self._try_multiple_endpoints(case["input"])
                duration = time.time() - start_time

                if response:
                    # Evaluate how well the system handled the edge case
                    handled_well = self._evaluate_edge_case_handling(
                        case["description"], response
                    )

                    self.results.append({"phase": "Edge Cases",
                                         "test": f"Edge Case {i + 1} - {case['description']}",
                                         "status": "✅ PASS" if handled_well else "⚠️ PARTIAL",
                                         "duration": f"{duration:.2f}s",
                                         "input_type": case["description"],
                                         "handled_gracefully": handled_well,
                                         "response_length": len(str(response)),
                                         })
                    print(
                        f"    {
                            '✅' if handled_well else '⚠️'} Handled {
                            'well' if handled_well else 'partially'} ({
                            duration:.2f}s)")
                else:
                    self.results.append({"phase": "Edge Cases",
                                         "test": f"Edge Case {i + 1} - {case['description']}",
                                         "status": "❌ FAIL",
                                         "duration": f"{duration:.2f}s",
                                         "input_type": case["description"],
                                         "error": "No working endpoint found",
                                         })
                    print("    ❌ No response")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "phase": "Edge Cases",
                        "test": f"Edge Case {i + 1} - {case['description']}",
                        "status": "❌ ERROR",
                        "duration": f"{duration:.2f}s",
                        "input_type": case["description"],
                        "error": str(e),
                    }
                )
                print(f"    ❌ Error: {e}")

    async def _phase_5_integration_testing(self):
        """Phase 5: Integration testing"""
        print("\n🔗 Phase 5: Integration Testing")
        print("-" * 40)

        # Test service-to-service communication
        await self._test_service_integration()

        # Test data flow
        await self._test_data_flow()

        # Test error propagation
        await self._test_error_propagation()

    async def _test_service_integration(self):
        """Test service-to-service integration"""
        print("  🔄 Testing service integration...")

        # Test if API Gateway can route to other services
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "http://localhost:8080/health", timeout=5
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        services = data.get("services", {})

                        self.results.append(
                            {
                                "phase": "Integration",
                                "test": "Service Integration - API Gateway",
                                "status": "✅ PASS",
                                "services_reported": len(services),
                                "healthy_services": sum(
                                    1 for v in services.values() if v
                                ),
                                "service_status": services,
                            }
                        )
                        print(
                            f"    ✅ API Gateway integration: {
                                len(services)} services reported")
                    else:
                        self.results.append(
                            {
                                "phase": "Integration",
                                "test": "Service Integration - API Gateway",
                                "status": "❌ FAIL",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"    ❌ API Gateway integration failed (Status: {
                                response.status})")
        except Exception as e:
            self.results.append(
                {
                    "phase": "Integration",
                    "test": "Service Integration - API Gateway",
                    "status": "❌ ERROR",
                    "error": str(e),
                }
            )
            print(f"    ❌ API Gateway integration error: {e}")

    async def _test_data_flow(self):
        """Test data flow between services"""
        print("  📊 Testing data flow...")

        # Test if we can get model information and use it
        try:
            async with aiohttp.ClientSession() as session:
                # Get models from LLM Router
                async with session.get(
                    "http://localhost:3033/models", timeout=5
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        models = data.get("models", [])

                        if models:
                            self.results.append(
                                {
                                    "phase": "Integration",
                                    "test": "Data Flow - Model Discovery",
                                    "status": "✅ PASS",
                                    "models_available": len(models),
                                    "data_flow": "LLM Router -> Models -> Available",
                                })
                            print(
                                f"    ✅ Data flow: {
                                    len(models)} models discovered")
                        else:
                            self.results.append(
                                {
                                    "phase": "Integration",
                                    "test": "Data Flow - Model Discovery",
                                    "status": "⚠️ PARTIAL",
                                    "models_available": 0,
                                    "data_flow": "LLM Router -> Models -> Empty",
                                })
                            print("    ⚠️ Data flow: No models available")
                    else:
                        self.results.append(
                            {
                                "phase": "Integration",
                                "test": "Data Flow - Model Discovery",
                                "status": "❌ FAIL",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"    ❌ Data flow: Model discovery failed (Status: {
                                response.status})")
        except Exception as e:
            self.results.append(
                {
                    "phase": "Integration",
                    "test": "Data Flow - Model Discovery",
                    "status": "❌ ERROR",
                    "error": str(e),
                }
            )
            print(f"    ❌ Data flow error: {e}")

    async def _test_error_propagation(self):
        """Test error propagation and handling"""
        print("  ⚠️ Testing error propagation...")

        # Test how errors are handled across services
        try:
            async with aiohttp.ClientSession() as session:
                # Try to access a non-existent endpoint
                async with session.get(
                    "http://localhost:8080/nonexistent", timeout=5
                ) as response:
                    if response.status == 404:
                        self.results.append(
                            {
                                "phase": "Integration",
                                "test": "Error Propagation - 404 Handling",
                                "status": "✅ PASS",
                                "error_handled": True,
                                "status_code": response.status,
                                "error_type": "404 Not Found",
                            }
                        )
                        print("    ✅ Error propagation: 404 handled correctly")
                    else:
                        self.results.append(
                            {
                                "phase": "Integration",
                                "test": "Error Propagation - 404 Handling",
                                "status": "⚠️ PARTIAL",
                                "error_handled": True,
                                "status_code": response.status,
                                "error_type": f"Unexpected status {
                                    response.status}",
                            })
                        print(
                            f"    ⚠️ Error propagation: Unexpected status {
                                response.status}")
        except Exception as e:
            self.results.append(
                {
                    "phase": "Integration",
                    "test": "Error Propagation - 404 Handling",
                    "status": "❌ ERROR",
                    "error": str(e),
                }
            )
            print(f"    ❌ Error propagation error: {e}")

    async def _try_multiple_endpoints(self, message: str) -> Dict:
        """Try multiple endpoints to get a response"""
        endpoints = [
            ("LLM Router Chat", "http://localhost:3033/chat"),
            ("ML Inference", "http://localhost:8084/inference"),
            ("API Gateway Chat", "http://localhost:8080/api/chat"),
        ]

        async with aiohttp.ClientSession() as session:
            for endpoint_name, url in endpoints:
                try:
                    payload = {"message": message}
                    async with session.post(
                        url, json=payload, timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            data["endpoint"] = endpoint_name
                            return data
                except Exception:
                    continue

        return None

    def _evaluate_edge_case_handling(
            self, case_type: str, response: Dict) -> bool:
        """Evaluate how well an edge case was handled"""
        if not response:
            return False

        response_text = str(response).lower()

        # Check for appropriate handling based on case type
        if case_type == "Empty input":
            return "empty" in response_text or "please provide" in response_text
        elif case_type == "Very long input":
            return len(response_text) > 0  # System should respond
        if case_type in ["SQL injection attempt", "XSS attempt"]:
            return (
                "security" in response_text
                or "invalid" in response_text
                or "not allowed" in response_text
            )
        return len(response_text) > 0  # System should respond

    async def _generate_comprehensive_report(self):
        """Generate comprehensive experiment report"""
        print("\n" + "=" * 60)
        print("📊 COMPREHENSIVE EXPERIMENT REPORT")
        print("=" * 60)

        # Calculate phase summaries
        phases = {}
        for result in self.results:
            phase = result.get("phase", "Unknown")
            if phase not in phases:
                phases[phase] = {
                    "total": 0,
                    "passed": 0,
                    "failed": 0,
                    "partial": 0}

            phases[phase]["total"] += 1
            if "✅" in result.get("status", ""):
                phases[phase]["passed"] += 1
            elif "❌" in result.get("status", ""):
                phases[phase]["failed"] += 1
            elif "⚠️" in result.get("status", ""):
                phases[phase]["partial"] += 1

        # Print phase summaries
        for phase, stats in phases.items():
            success_rate = (
                ((stats["passed"] + stats["partial"] * 0.5) / stats["total"] * 100)
                if stats["total"] > 0
                else 0
            )
            print(f"\n📋 {phase}:")
            print(f"  Total Tests: {stats['total']}")
            print(f"  ✅ Passed: {stats['passed']}")
            print(f"  ⚠️ Partial: {stats['partial']}")
            print(f"  ❌ Failed: {stats['failed']}")
            print(f"  Success Rate: {success_rate:.1f}%")

        # Overall summary
        total_tests = len(self.results)
        total_passed = sum(
            1 for r in self.results if "✅" in r.get(
                "status", ""))
        total_partial = sum(
            1 for r in self.results if "⚠️" in r.get(
                "status", ""))
        total_failed = sum(
            1 for r in self.results if "❌" in r.get(
                "status", ""))
        overall_success_rate = (
            ((total_passed + total_partial * 0.5) / total_tests * 100)
            if total_tests > 0
            else 0
        )

        print("\n🎯 OVERALL SUMMARY:")
        print(f"  Total Experiments: {total_tests}")
        print(f"  ✅ Passed: {total_passed}")
        print(f"  ⚠️ Partial: {total_partial}")
        print(f"  ❌ Failed: {total_failed}")
        print(f"  Overall Success Rate: {overall_success_rate:.1f}%")

        # Key findings
        print("\n🔍 KEY FINDINGS:")
        if self.discovered_models:
            print(f"  • Discovered {len(self.discovered_models)} AI models")
        print(f"  • System health: {total_passed}/{total_tests} tests passed")
        print(
            f"  • Real-world scenarios: {
                'Working' if total_passed > total_tests *
                0.6 else 'Needs improvement'}")

        # Save comprehensive report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = f"comprehensive_experiment_report_{timestamp}.json"

        report_data = {
            "timestamp": timestamp,
            "summary": {
                "total_experiments": total_tests,
                "passed": total_passed,
                "partial": total_partial,
                "failed": total_failed,
                "overall_success_rate": overall_success_rate,
            },
            "phases": phases,
            "discovered_models": self.discovered_models,
            "results": self.results,
        }

        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)

        print(f"\n💾 Comprehensive report saved to: {report_file}")


async def main():
    """Main entry point"""
    experiment = ComprehensiveRealWorldExperiment()
    await experiment.run_comprehensive_experiment()


if __name__ == "__main__":
    asyncio.run(main())
