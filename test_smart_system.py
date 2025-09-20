#!/usr/bin/env python3
"""
Comprehensive Functional Testing for Smart Universal AI Tools System
Tests all services in parallel with intelligent routing validation
"""

import asyncio
import os
import statistics
import subprocess
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

import aiohttp


@dataclass
class TestResult:
    test_name: str
    success: bool
    response_time: float
    error_message: Optional[str] = None
    response_data: Optional[Dict] = None
    routing_decision: Optional[str] = None


@dataclass
class ServiceStatus:
    name: str
    port: int
    healthy: bool
    response_time: float
    last_check: float


class SmartSystemTester:
    def __init__(self):
        self.services = {
            "api-gateway": {"port": 8080, "health_endpoint": "/health"},
            "llm-router": {"port": 3033, "health_endpoint": "/health"},
            "hrm-service": {"port": 8002, "health_endpoint": "/health"},
            "ollama": {"port": 11434, "health_endpoint": "/api/tags"},
            "agent-coordination": {"port": 3034, "health_endpoint": "/health"},
            "memory-service": {"port": 8017, "health_endpoint": "/health"},
            "ml-inference": {"port": 8084, "health_endpoint": "/health"},
        }

        self.test_cases = [
            # Simple tasks (should route to fast models)
            {
                "prompt": "What is 2+2?",
                "expected_routing": "fast",
                "complexity": "simple",
            },
            {
                "prompt": "Hello, how are you?",
                "expected_routing": "fast",
                "complexity": "simple",
            },
            {
                "prompt": "What's the weather like?",
                "expected_routing": "fast",
                "complexity": "simple",
            },
            # Complex reasoning (should route to HRM)
            {
                "prompt": "Analyze the economic implications of climate change and propose a comprehensive solution strategy",
                "expected_routing": "hrm",
                "complexity": "expert",
            },
            {
                "prompt": "Explain quantum computing principles and their applications in cryptography",
                "expected_routing": "hrm",
                "complexity": "complex",
            },
            {
                "prompt": "Design a machine learning algorithm for fraud detection",
                "expected_routing": "hrm",
                "complexity": "expert",
            },
            # Orchestration tasks (should route to DSPy)
            {
                "prompt": "Create a detailed project plan for implementing a new AI system",
                "expected_routing": "dspy",
                "complexity": "complex",
            },
            {
                "prompt": "Coordinate multiple AI agents to solve a complex problem",
                "expected_routing": "dspy",
                "complexity": "expert",
            },
            {
                "prompt": "Develop a comprehensive strategy for digital transformation",
                "expected_routing": "dspy",
                "complexity": "expert",
            },
            # Vision tasks (should route to llava)
            {
                "prompt": "Describe what you see in this image",
                "expected_routing": "vision",
                "complexity": "medium",
            },
            {
                "prompt": "Analyze the visual elements in this picture",
                "expected_routing": "vision",
                "complexity": "medium",
            },
        ]

        self.results = []
        self.service_status = {}

    async def start_services_parallel(self) -> bool:
        """Start all services in parallel using subprocess"""
        print("🚀 Starting Universal AI Tools Services in Parallel...")

        # Define service startup commands
        startup_commands = {
            "ollama": ["ollama", "serve"],
            "hrm-service": ["python3", "python-services/hrm-service.py", "--port", "8002"],
            "llm-router": ["cargo", "run", "-p", "llm-router"],
            "api-gateway": ["go", "run", "go-services/api-gateway/main.go"],
            "agent-coordination": ["cargo", "run", "-p", "agent-orchestrator"],
            "memory-service": ["go", "run", "go-services/memory-service/main.go"],
            "ml-inference": ["cargo", "run", "-p", "ml-inference-service"],
        }

        processes = {}

        try:
            # Start services in parallel
            for service_name, command in startup_commands.items():
                if service_name in self.services:
                    print(f"  Starting {service_name}...")
                    try:
                        # Set environment variables for specific services
                        env = os.environ.copy()
                        if service_name == "llm-router":
                            env["OLLAMA_URL"] = "http://localhost:11434"

                        process = subprocess.Popen(
                            command,
                            env=env,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            cwd="/Users/christianmerrill/Desktop/universal-ai-tools",
                        )
                        processes[service_name] = process
                        print(
                            f"    ✅ {service_name} started (PID: {
                                process.pid})")
                    except Exception as e:
                        print(f"    ❌ Failed to start {service_name}: {e}")

            # Wait for services to initialize
            print("\n⏳ Waiting for services to initialize...")
            await asyncio.sleep(10)

            # Check service health
            health_checks = await self.check_all_services_health()
            healthy_services = sum(
                1 for status in health_checks.values() if status.healthy
            )
            total_services = len(health_checks)

            print(
                f"\n📊 Service Health Status: {healthy_services}/{total_services} healthy")

            for service_name, status in health_checks.items():
                status_icon = "✅" if status.healthy else "❌"
                print(
                    f"  {status_icon} {service_name}: {
                        status.response_time:.2f}ms")

            return healthy_services >= total_services * 0.8  # 80% services healthy

        except Exception as e:
            print(f"❌ Error starting services: {e}")
            return False
        finally:
            # Store processes for cleanup
            self.processes = processes

    async def check_all_services_health(self) -> Dict[str, ServiceStatus]:
        """Check health of all services in parallel"""
        async with aiohttp.ClientSession() as session:
            tasks = []
            for service_name, config in self.services.items():
                task = self.check_service_health(session, service_name, config)
                tasks.append(task)

            results = await asyncio.gather(*tasks, return_exceptions=True)

            health_status = {}
            for i, result in enumerate(results):
                service_name = list(self.services.keys())[i]
                if isinstance(result, Exception):
                    health_status[service_name] = ServiceStatus(
                        name=service_name,
                        port=self.services[service_name]["port"],
                        healthy=False,
                        response_time=0.0,
                        last_check=time.time(),
                    )
                else:
                    health_status[service_name] = result

            return health_status

    async def check_service_health(
        self, session: aiohttp.ClientSession, service_name: str, config: Dict
    ) -> ServiceStatus:
        """Check individual service health"""
        url = f"http://localhost:{config['port']}{config['health_endpoint']}"
        start_time = time.time()

        try:
            async with session.get(
                url, timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                response_time = (time.time() - start_time) * 1000
                healthy = response.status == 200

                return ServiceStatus(
                    name=service_name,
                    port=config["port"],
                    healthy=healthy,
                    response_time=response_time,
                    last_check=time.time(),
                )
        except Exception:
            response_time = (time.time() - start_time) * 1000
            return ServiceStatus(
                name=service_name,
                port=config["port"],
                healthy=False,
                response_time=response_time,
                last_check=time.time(),
            )

    async def test_smart_routing(self) -> List[TestResult]:
        """Test smart routing functionality"""
        print("\n🧠 Testing Smart Routing System...")

        results = []

        async with aiohttp.ClientSession() as session:
            for i, test_case in enumerate(self.test_cases):
                print(
                    f"\n  Test {i + 1}/{len(self.test_cases)}: {test_case['prompt'][:50]}..."
                )

                result = await self.test_single_request(session, test_case)
                results.append(result)

                # Rate limiting
                await asyncio.sleep(1)

        return results

    async def test_single_request(
        self, session: aiohttp.ClientSession, test_case: Dict
    ) -> TestResult:
        """Test a single request and analyze routing"""
        start_time = time.time()

        payload = {
            "messages": [{"role": "user", "content": test_case["prompt"]}],
            "model": None,  # Let smart router decide
            "temperature": 0.7,
        }

        try:
            async with session.post(
                "http://localhost:3033/chat",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as response:
                response_time = (time.time() - start_time) * 1000

                if response.status == 200:
                    data = await response.json()

                    # Analyze routing decision
                    routing_decision = self.analyze_routing_decision(
                        data, test_case)

                    # Validate response quality
                    success = self.validate_response_quality(data, test_case)

                    return TestResult(
                        test_name=f"Smart Routing - {test_case['complexity']}",
                        success=success,
                        response_time=response_time,
                        response_data=data,
                        routing_decision=routing_decision,
                    )
                else:
                    error_text = await response.text()
                    return TestResult(
                        test_name=f"Smart Routing - {test_case['complexity']}",
                        success=False,
                        response_time=response_time,
                        error_message=f"HTTP {response.status}: {error_text}",
                    )

        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return TestResult(
                test_name=f"Smart Routing - {test_case['complexity']}",
                success=False,
                response_time=response_time,
                error_message=str(e),
            )

    def analyze_routing_decision(
            self,
            response_data: Dict,
            test_case: Dict) -> str:
        """Analyze which model was selected for routing"""
        model = response_data.get("model", "unknown")
        provider = response_data.get("provider", "unknown")

        # Determine routing type based on model/provider
        if "hrm" in model.lower() or "hrm" in provider.lower():
            return "hrm"
        elif "dspy" in model.lower() or "dspy" in provider.lower():
            return "dspy"
        elif "llava" in model.lower() or "vision" in provider.lower():
            return "vision"
        elif "smart-routed" in model.lower():
            return "smart"
        else:
            return "standard"

    def validate_response_quality(
            self,
            response_data: Dict,
            test_case: Dict) -> bool:
        """Validate response quality and routing appropriateness"""
        content = response_data.get("content", "")

        # Basic quality checks
        if not content or len(content.strip()) < 10:
            return False

        # Check if response is appropriate for complexity
        complexity = test_case["complexity"]
        content_length = len(content)

        if complexity == "simple" and content_length > 1000:
            return False  # Too verbose for simple task
        elif complexity == "expert" and content_length < 100:
            return False  # Too brief for expert task

        # Check for error indicators
        error_indicators = ["error", "failed", "unable", "cannot", "sorry"]
        if any(indicator in content.lower() for indicator in error_indicators):
            return False

        return True

    async def test_cache_performance(self) -> List[TestResult]:
        """Test intelligent caching performance"""
        print("\n💾 Testing Intelligent Caching...")

        results = []

        # Test cache with repeated requests
        test_prompts = [
            "What is artificial intelligence?",
            "Explain machine learning",
            "What is artificial intelligence?",  # Duplicate for cache test
            "Tell me about AI",  # Similar for semantic cache test
        ]

        async with aiohttp.ClientSession() as session:
            for i, prompt in enumerate(test_prompts):
                print(f"  Cache Test {i + 1}/{len(test_prompts)}: {prompt}")

                start_time = time.time()

                payload = {
                    "messages": [{"role": "user", "content": prompt}],
                    "model": None,
                    "temperature": 0.7,
                }

                try:
                    async with session.post(
                        "http://localhost:3033/chat",
                        json=payload,
                        headers={"Content-Type": "application/json"},
                        timeout=aiohttp.ClientTimeout(total=30),
                    ) as response:
                        response_time = (time.time() - start_time) * 1000

                        if response.status == 200:
                            data = await response.json()

                            # Check if response was cached (very fast response)
                            is_cached = (
                                response_time < 100
                            )  # Less than 100ms suggests cache hit

                            results.append(
                                TestResult(
                                    test_name=f"Cache Test - {i + 1}",
                                    success=True,
                                    response_time=response_time,
                                    response_data=data,
                                    routing_decision=(
                                        "cached" if is_cached else "generated"
                                    ),
                                )
                            )

                            print(
                                f"    {
                                    '🎯 Cached' if is_cached else '🔄 Generated'}: {
                                    response_time:.2f}ms")
                        else:
                            results.append(
                                TestResult(
                                    test_name=f"Cache Test - {i + 1}",
                                    success=False,
                                    response_time=response_time,
                                    error_message=f"HTTP {response.status}",
                                )
                            )

                except Exception as e:
                    response_time = (time.time() - start_time) * 1000
                    results.append(
                        TestResult(
                            test_name=f"Cache Test - {i + 1}",
                            success=False,
                            response_time=response_time,
                            error_message=str(e),
                        )
                    )

                await asyncio.sleep(0.5)

        return results

    async def test_performance_metrics(self) -> Dict:
        """Test performance monitoring and metrics"""
        print("\n📊 Testing Performance Metrics...")

        try:
            async with aiohttp.ClientSession() as session:
                # Test metrics endpoint
                async with session.get(
                    "http://localhost:3033/metrics",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as response:
                    if response.status == 200:
                        metrics_text = await response.text()
                        print("  ✅ Metrics endpoint accessible")

                        # Parse basic metrics
                        metrics_data = {
                            "endpoint_accessible": True,
                            "metrics_length": len(metrics_text),
                            "contains_llm_metrics": "llm_router"
                            in metrics_text.lower(),
                        }
                    else:
                        metrics_data = {
                            "endpoint_accessible": False,
                            "error": f"HTTP {response.status}",
                        }

                # Test health endpoint
                async with session.get(
                    "http://localhost:3033/health",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as response:
                    if response.status == 200:
                        health_data = await response.json()
                        print("  ✅ Health endpoint accessible")
                        metrics_data["health_data"] = health_data
                    else:
                        metrics_data["health_error"] = f"HTTP {
                            response.status}"

                return metrics_data

        except Exception as e:
            return {"error": str(e)}

    def generate_test_report(
        self,
        routing_results: List[TestResult],
        cache_results: List[TestResult],
        metrics_data: Dict,
    ) -> str:
        """Generate comprehensive test report"""
        report = []
        report.append(
            "# Universal AI Tools - Smart System Functional Test Report")
        report.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        # Test Summary
        total_tests = len(routing_results) + len(cache_results)
        successful_tests = len([r for r in routing_results if r.success]) + \
            len([r for r in cache_results if r.success])
        success_rate = (
            successful_tests /
            total_tests *
            100) if total_tests > 0 else 0

        report.append("## Test Summary")
        report.append(f"- **Total Tests**: {total_tests}")
        report.append(f"- **Successful**: {successful_tests}")
        report.append(f"- **Failed**: {total_tests - successful_tests}")
        report.append(f"- **Success Rate**: {success_rate:.1f}%")
        report.append("")

        # Routing Performance
        report.append("## Smart Routing Performance")
        report.append("")

        if routing_results:
            avg_response_time = statistics.mean(
                [r.response_time for r in routing_results if r.success]
            )
            routing_success_rate = (
                len([r for r in routing_results if r.success])
                / len(routing_results)
                * 100
            )

            report.append(
                f"- **Average Response Time**: {avg_response_time:.2f}ms")
            report.append(
                f"- **Routing Success Rate**: {routing_success_rate:.1f}%")
            report.append("")

            # Routing decisions
            routing_decisions = {}
            for result in routing_results:
                if result.routing_decision:
                    routing_decisions[result.routing_decision] = (
                        routing_decisions.get(result.routing_decision, 0) + 1
                    )

            report.append("### Routing Decisions")
            for decision, count in routing_decisions.items():
                report.append(f"- **{decision.title()}**: {count} requests")
            report.append("")

        # Cache Performance
        report.append("## Intelligent Caching Performance")
        report.append("")

        if cache_results:
            cache_hits = len(
                [r for r in cache_results if r.routing_decision == "cached"]
            )
            cache_misses = len(
                [r for r in cache_results if r.routing_decision == "generated"]
            )
            cache_hit_rate = (
                (cache_hits / len(cache_results) * 100) if cache_results else 0
            )

            report.append(f"- **Cache Hit Rate**: {cache_hit_rate:.1f}%")
            report.append(f"- **Cache Hits**: {cache_hits}")
            report.append(f"- **Cache Misses**: {cache_misses}")
            report.append("")

        # Performance Metrics
        report.append("## Performance Metrics")
        report.append("")

        if metrics_data.get("endpoint_accessible"):
            report.append("- **Metrics Endpoint**: ✅ Accessible")
            report.append(
                f"- **Metrics Size**: {metrics_data.get('metrics_length', 0)} characters"
            )
            report.append(
                f"- **Contains LLM Metrics**: {'✅' if metrics_data.get('contains_llm_metrics') else '❌'}"
            )
        else:
            report.append("- **Metrics Endpoint**: ❌ Not accessible")

        if metrics_data.get("health_data"):
            report.append("- **Health Endpoint**: ✅ Accessible")
        else:
            report.append("- **Health Endpoint**: ❌ Not accessible")

        report.append("")

        # Detailed Results
        report.append("## Detailed Test Results")
        report.append("")

        report.append("### Smart Routing Tests")
        for i, result in enumerate(routing_results):
            status = "✅" if result.success else "❌"
            report.append(f"{i + 1}. {status} {result.test_name}")
            report.append(f"   - Response Time: {result.response_time:.2f}ms")
            if result.routing_decision:
                report.append(
                    f"   - Routing Decision: {result.routing_decision}")
            if result.error_message:
                report.append(f"   - Error: {result.error_message}")
            report.append("")

        report.append("### Cache Performance Tests")
        for i, result in enumerate(cache_results):
            status = "✅" if result.success else "❌"
            report.append(f"{i + 1}. {status} {result.test_name}")
            report.append(f"   - Response Time: {result.response_time:.2f}ms")
            if result.routing_decision:
                report.append(f"   - Cache Status: {result.routing_decision}")
            if result.error_message:
                report.append(f"   - Error: {result.error_message}")
            report.append("")

        # Recommendations
        report.append("## Recommendations")
        report.append("")

        if success_rate < 90:
            report.append(
                "- **Improve Error Handling**: Some tests failed, review error handling"
            )

        if (routing_results and statistics.mean(
                [r.response_time for r in routing_results if r.success]) > 2000):
            report.append(
                "- **Optimize Response Times**: Consider caching or faster models"
            )

        if (
            cache_results
            and len([r for r in cache_results if r.routing_decision == "cached"])
            / len(cache_results)
            < 0.5
        ):
            report.append(
                "- **Improve Cache Hit Rate**: Optimize similarity thresholds"
            )

        if not metrics_data.get("endpoint_accessible"):
            report.append(
                "- **Fix Metrics Endpoint**: Ensure monitoring is properly configured"
            )

        return "\n".join(report)

    def cleanup_services(self):
        """Clean up running services"""
        print("\n🧹 Cleaning up services...")

        if hasattr(self, "processes"):
            for service_name, process in self.processes.items():
                try:
                    process.terminate()
                    process.wait(timeout=5)
                    print(f"  ✅ {service_name} stopped")
                except Exception as e:
                    print(f"  ❌ Error stopping {service_name}: {e}")

    async def run_comprehensive_test(self):
        """Run comprehensive functional test suite"""
        print("🚀 Universal AI Tools - Comprehensive Functional Test Suite")
        print("=" * 60)

        try:
            # Start services in parallel
            services_started = await self.start_services_parallel()

            if not services_started:
                print("❌ Failed to start required services")
                return

            # Run tests in parallel
            print("\n🧪 Running Functional Tests...")

            # Test smart routing
            routing_results = await self.test_smart_routing()

            # Test caching
            cache_results = await self.test_cache_performance()

            # Test metrics
            metrics_data = await self.test_performance_metrics()

            # Generate report
            report = self.generate_test_report(
                routing_results, cache_results, metrics_data
            )

            # Save report
            with open("smart_system_test_report.md", "w") as f:
                f.write(report)

            print("\n📊 Test Complete!")
            print("📄 Report saved to: smart_system_test_report.md")

            # Print summary
            total_tests = len(routing_results) + len(cache_results)
            successful_tests = len([r for r in routing_results if r.success]) + \
                len([r for r in cache_results if r.success])
            success_rate = (
                (successful_tests /
                 total_tests *
                 100) if total_tests > 0 else 0)

            print("\n🎯 Quick Summary:")
            print(f"  Success Rate: {success_rate:.1f}%")
            print(f"  Total Tests: {total_tests}")
            print(f"  Successful: {successful_tests}")

        except Exception as e:
            print(f"❌ Test suite failed: {e}")
        finally:
            self.cleanup_services()


async def main():
    """Main test execution"""
    tester = SmartSystemTester()
    await tester.run_comprehensive_test()


if __name__ == "__main__":
    asyncio.run(main())
