#!/usr/bin/env python3
"""
Advanced Parallel Test Runner
Integrates AI-Compass, Hybrid HPC/ML Executor, and AI-Powered Test Generation
"""

import asyncio
import os
import subprocess
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

# Import our advanced testing modules
from ai_compass_tester import AICompassTester
from ai_powered_test_generator import (AIPoweredTestGenerator,
                                       TestGenerationConfig)
from hybrid_hpc_ml_executor import (HybridHPCMLExecutor, ResourceAllocation,
                                    Task, TaskType)


@dataclass
class TestSuiteConfig:
    """Configuration for the advanced test suite"""

    enable_ai_compass: bool = True
    enable_hybrid_executor: bool = True
    enable_ai_generation: bool = True
    enable_parallel_services: bool = True
    max_concurrent_tests: int = 10
    test_timeout: float = 300.0
    target_url: str = "http://localhost:3033"


@dataclass
class TestSuiteResult:
    """Results from the advanced test suite"""

    ai_compass_results: Optional[Dict] = None
    hybrid_executor_results: Optional[Dict] = None
    ai_generation_results: Optional[Dict] = None
    parallel_test_results: Optional[Dict] = None
    overall_score: float = 0.0
    execution_time: float = 0.0
    recommendations: List[str] = None


class AdvancedParallelTestRunner:
    """Advanced parallel test runner with AI-powered capabilities"""

    def __init__(self, config: TestSuiteConfig):
        self.config = config
        self.services = {}
        self.test_results = {}
        self.recommendations = []

    async def run_comprehensive_test_suite(self) -> TestSuiteResult:
        """Run comprehensive test suite with all advanced features"""
        print("🚀 Advanced Parallel Test Suite with AI-Powered Capabilities")
        print("=" * 70)

        start_time = time.time()
        results = TestSuiteResult()

        try:
            # Start services in parallel if enabled
            if self.config.enable_parallel_services:
                await self._start_services_parallel()

            # Run AI-Compass evaluation
            if self.config.enable_ai_compass:
                print("\n🧭 Running AI-Compass Evaluation...")
                ai_compass = AICompassTester()
                results.ai_compass_results = (
                    await ai_compass.run_comprehensive_evaluation(
                        self.config.target_url
                    )
                )
                print(
                    f"✅ AI-Compass Score: {results.ai_compass_results.get('overall_score', 0):.2f}/1.0"
                )

            # Run Hybrid HPC/ML Executor tests
            if self.config.enable_hybrid_executor:
                print("\n⚡ Running Hybrid HPC/ML Executor Tests...")
                hybrid_results = await self._run_hybrid_executor_tests()
                results.hybrid_executor_results = hybrid_results
                print(
                    f"✅ Hybrid Executor: {
                        len(hybrid_results)} tasks completed")

            # Run AI-Powered Test Generation
            if self.config.enable_ai_generation:
                print("\n🧬 Running AI-Powered Test Generation...")
                generation_results = await self._run_ai_test_generation()
                results.ai_generation_results = generation_results
                print(f"✅ Generated {len(generation_results)} test cases")

            # Run parallel functional tests
            print("\n🧪 Running Parallel Functional Tests...")
            parallel_results = await self._run_parallel_functional_tests()
            results.parallel_test_results = parallel_results
            print(
                f"✅ Parallel Tests: {
                    parallel_results.get(
                        'success_rate',
                        0):.1f}% success rate")

            # Calculate overall score
            results.overall_score = self._calculate_overall_score(results)

            # Generate recommendations
            results.recommendations = self._generate_recommendations(results)

            # Set execution time
            results.execution_time = time.time() - start_time

            # Generate comprehensive report
            await self._generate_comprehensive_report(results)

            print(
                f"\n🎯 Overall Test Suite Score: {
                    results.overall_score:.2f}/1.0")
            print(f"⏱️  Total Execution Time: {results.execution_time:.2f}s")

            return results

        except Exception as e:
            print(f"❌ Test suite failed: {e}")
            results.execution_time = time.time() - start_time
            return results
        finally:
            # Cleanup services
            await self._cleanup_services()

    async def _start_services_parallel(self):
        """Start all required services in parallel"""
        print("🚀 Starting Services in Parallel...")

        service_commands = {
            "ollama": ["ollama", "serve"],
            "hrm-service": ["python3", "python-services/hrm-service.py", "--port", "8002"],
            "llm-router": ["cargo", "run", "-p", "llm-router"],
        }

        for service_name, command in service_commands.items():
            try:
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

                self.services[service_name] = process
                print(f"  ✅ {service_name} started (PID: {process.pid})")

            except Exception as e:
                print(f"  ❌ Failed to start {service_name}: {e}")

        # Wait for services to initialize
        print("⏳ Waiting for services to initialize...")
        await asyncio.sleep(10)

    async def _run_hybrid_executor_tests(self) -> Dict:
        """Run hybrid HPC/ML executor tests"""
        executor = HybridHPCMLExecutor(max_workers=4)

        # Create test tasks
        tasks = [
            Task(
                task_id="ml_inference_1",
                task_type=TaskType.ML_INFERENCE,
                function=self._mock_ml_inference,
                args=("Test ML inference",),
                kwargs={},
                resource_requirements=ResourceAllocation(cpu_cores=2, memory_gb=1.0),
                priority=1,
            ),
            Task(
                task_id="hpc_computation_1",
                task_type=TaskType.HPC_COMPUTATION,
                function=self._mock_hpc_computation,
                args=(1000,),
                kwargs={},
                resource_requirements=ResourceAllocation(cpu_cores=4, memory_gb=2.0),
                priority=2,
            ),
            Task(
                task_id="data_processing_1",
                task_type=TaskType.DATA_PROCESSING,
                function=self._mock_data_processing,
                args=([1, 2, 3, 4, 5],),
                kwargs={},
                resource_requirements=ResourceAllocation(cpu_cores=1, memory_gb=0.5),
                priority=3,
            ),
        ]

        # Execute tasks
        results = await executor.execute_workflow(tasks)

        # Analyze results
        successful_tasks = sum(
            1 for result in results.values() if result.success)
        total_tasks = len(results)
        success_rate = successful_tasks / total_tasks if total_tasks > 0 else 0

        return {
            "total_tasks": total_tasks,
            "successful_tasks": successful_tasks,
            "success_rate": success_rate,
            "results": results,
        }

    async def _run_ai_test_generation(self) -> List[Dict]:
        """Run AI-powered test generation"""
        config = TestGenerationConfig(
            population_size=20,
            generations=30,
            mutation_rate=0.1,
            crossover_rate=0.8,
            elite_size=5,
            max_test_cases=50,
        )

        generator = AIPoweredTestGenerator(config)
        test_suite = await generator.generate_test_suite(self.config.target_url)

        # Convert to dictionary format
        test_data = []
        for test in test_suite:
            test_data.append(
                {
                    "test_id": test.test_id,
                    "test_type": test.test_type.value,
                    "prompt": test.prompt,
                    "expected_behavior": test.expected_behavior,
                    "parameters": test.parameters,
                    "priority": test.priority,
                    "complexity": test.complexity,
                }
            )

        return test_data

    async def _run_parallel_functional_tests(self) -> Dict:
        """Run parallel functional tests"""
        # Import and run the existing functional test suite
        from test_smart_system import SmartSystemTester

        tester = SmartSystemTester()

        # Run tests
        routing_results = await tester.test_smart_routing()
        cache_results = await tester.test_cache_performance()
        metrics_data = await tester.test_performance_metrics()

        # Calculate success rate
        total_tests = len(routing_results) + len(cache_results)
        successful_tests = len([r for r in routing_results if r.success]) + \
            len([r for r in cache_results if r.success])
        success_rate = (
            successful_tests /
            total_tests *
            100) if total_tests > 0 else 0

        return {
            "total_tests": total_tests,
            "successful_tests": successful_tests,
            "success_rate": success_rate,
            "routing_results": routing_results,
            "cache_results": cache_results,
            "metrics_data": metrics_data,
        }

    def _mock_ml_inference(self, data: str) -> str:
        """Mock ML inference function"""
        time.sleep(0.1)  # Simulate processing time
        return f"ML inference result for: {data}"

    def _mock_hpc_computation(self, size: int) -> List[float]:
        """Mock HPC computation function"""
        time.sleep(0.2)  # Simulate processing time
        return [i * 2 for i in range(size)]

    def _mock_data_processing(self, data: List[float]) -> List[float]:
        """Mock data processing function"""
        time.sleep(0.05)  # Simulate processing time
        return [x * 1.5 for x in data]

    def _calculate_overall_score(self, results: TestSuiteResult) -> float:
        """Calculate overall test suite score"""
        scores = []

        # AI-Compass score
        if results.ai_compass_results and "overall_score" in results.ai_compass_results:
            scores.append(results.ai_compass_results["overall_score"])

        # Hybrid executor score
        if (
            results.hybrid_executor_results
            and "success_rate" in results.hybrid_executor_results
        ):
            scores.append(results.hybrid_executor_results["success_rate"])

        # Parallel test score
        if (
            results.parallel_test_results
            and "success_rate" in results.parallel_test_results
        ):
            scores.append(
                results.parallel_test_results["success_rate"] / 100.0)

        # AI generation score (based on number of generated tests)
        if results.ai_generation_results:
            generation_score = min(
                len(results.ai_generation_results) / 100.0, 1.0)
            scores.append(generation_score)

        return sum(scores) / len(scores) if scores else 0.0

    def _generate_recommendations(self, results: TestSuiteResult) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []

        # AI-Compass recommendations
        if results.ai_compass_results:
            overall_score = results.ai_compass_results.get("overall_score", 0)
            if overall_score < 0.7:
                recommendations.append(
                    "Improve AI system robustness and security")

            # Check specific vulnerabilities
            adversarial = results.ai_compass_results.get(
                "adversarial_robustness", {})
            for test_type, result in adversarial.items():
                if (
                    hasattr(result, "robustness_score")
                    and result.robustness_score < 0.8
                ):
                    recommendations.append(
                        f"Strengthen {test_type.replace('_', ' ')} defenses"
                    )

        # Hybrid executor recommendations
        if results.hybrid_executor_results:
            success_rate = results.hybrid_executor_results.get(
                "success_rate", 0)
            if success_rate < 0.8:
                recommendations.append("Optimize hybrid HPC/ML execution")

        # Parallel test recommendations
        if results.parallel_test_results:
            success_rate = results.parallel_test_results.get("success_rate", 0)
            if success_rate < 90:
                recommendations.append("Improve parallel test reliability")

        # AI generation recommendations
        if results.ai_generation_results:
            test_count = len(results.ai_generation_results)
            if test_count < 50:
                recommendations.append("Increase AI-generated test coverage")

        return recommendations

    async def _generate_comprehensive_report(self, results: TestSuiteResult):
        """Generate comprehensive test report"""
        report = []
        report.append("# Advanced Parallel Test Suite Report")
        report.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        # Overall Score
        report.append(f"## Overall Score: {results.overall_score:.2f}/1.0")
        report.append(f"Execution Time: {results.execution_time:.2f}s")
        report.append("")

        # AI-Compass Results
        if results.ai_compass_results:
            report.append("## AI-Compass Evaluation")
            report.append(
                f"Overall Score: {
                    results.ai_compass_results.get(
                        'overall_score',
                        0):.2f}/1.0")
            report.append("")

            # Adversarial robustness
            adversarial = results.ai_compass_results.get(
                "adversarial_robustness", {})
            if adversarial:
                report.append("### Adversarial Robustness")
                for test_type, result in adversarial.items():
                    if hasattr(result, "robustness_score"):
                        report.append(
                            f"- **{test_type.replace('_', ' ').title()}**: {result.robustness_score:.2f}"
                        )
                report.append("")

        # Hybrid Executor Results
        if results.hybrid_executor_results:
            report.append("## Hybrid HPC/ML Executor")
            report.append(
                f"Success Rate: {
                    results.hybrid_executor_results.get(
                        'success_rate',
                        0):.1%}")
            report.append(
                f"Total Tasks: {
                    results.hybrid_executor_results.get(
                        'total_tasks', 0)}")
            report.append("")

        # AI Generation Results
        if results.ai_generation_results:
            report.append("## AI-Powered Test Generation")
            report.append(
                f"Generated Tests: {len(results.ai_generation_results)}")

            # Group by test type
            by_type = {}
            for test in results.ai_generation_results:
                test_type = test.get("test_type", "unknown")
                if test_type not in by_type:
                    by_type[test_type] = 0
                by_type[test_type] += 1

            report.append("### Test Distribution")
            for test_type, count in by_type.items():
                report.append(f"- **{test_type.title()}**: {count}")
            report.append("")

        # Parallel Test Results
        if results.parallel_test_results:
            report.append("## Parallel Functional Tests")
            report.append(
                f"Success Rate: {
                    results.parallel_test_results.get(
                        'success_rate',
                        0):.1f}%")
            report.append(
                f"Total Tests: {
                    results.parallel_test_results.get(
                        'total_tests', 0)}")
            report.append("")

        # Recommendations
        if results.recommendations:
            report.append("## Recommendations")
            for i, rec in enumerate(results.recommendations, 1):
                report.append(f"{i}. {rec}")
            report.append("")

        # Save report
        report_content = "\n".join(report)
        with open("advanced_test_suite_report.md", "w") as f:
            f.write(report_content)

        print("📄 Comprehensive report saved to: advanced_test_suite_report.md")

    async def _cleanup_services(self):
        """Cleanup running services"""
        print("\n🧹 Cleaning up services...")

        for service_name, process in self.services.items():
            try:
                process.terminate()
                process.wait(timeout=5)
                print(f"  ✅ {service_name} stopped")
            except Exception as e:
                print(f"  ❌ Error stopping {service_name}: {e}")

        self.services.clear()


async def main():
    """Main execution of advanced test suite"""
    config = TestSuiteConfig(
        enable_ai_compass=True,
        enable_hybrid_executor=True,
        enable_ai_generation=True,
        enable_parallel_services=True,
        max_concurrent_tests=10,
        test_timeout=300.0,
        target_url="http://localhost:3033",
    )

    runner = AdvancedParallelTestRunner(config)
    results = await runner.run_comprehensive_test_suite()

    print("\n🎯 Test Suite Complete!")
    print(f"Overall Score: {results.overall_score:.2f}/1.0")
    print(f"Execution Time: {results.execution_time:.2f}s")

    if results.recommendations:
        print("\n💡 Recommendations:")
        for i, rec in enumerate(results.recommendations, 1):
            print(f"  {i}. {rec}")


if __name__ == "__main__":
    asyncio.run(main())
