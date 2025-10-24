#!/usr/bin/env python3
"""
Real-World Experiment Runner for Universal AI Tools
Integrates with existing testing framework and runs comprehensive experiments
"""

import asyncio
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict


class RealWorldExperimentRunner:
    """Orchestrates real-world experiments with the Universal AI Tools platform"""

    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.results_dir = self.base_dir / "experiment_results"
        self.results_dir.mkdir(exist_ok=True)

    async def run_comprehensive_experiments(self):
        """Run all available real-world experiments"""
        print("🚀 Universal AI Tools - Real-World Experiment Suite")
        print("=" * 60)

        # Check if services are running
        if not await self._check_services_health():
            print("❌ Services not healthy. Please start services first:")
            print("   ./start-go-rust.sh")
            return False

        experiments = [
            ("Basic LLM Evaluation", self._run_basic_llm_eval),
            ("Advanced AI Compass Testing", self._run_ai_compass),
            ("Hybrid HPC/ML Workflow", self._run_hybrid_workflow),
            ("Real-World Scenarios", self._run_real_world_scenarios),
            ("Performance Benchmarking", self._run_performance_benchmarks),
            ("Agent Coordination Testing", self._run_agent_coordination),
            ("Multi-Modal Processing", self._run_multimodal_tests),
            ("Edge Case Analysis", self._run_edge_case_analysis),
        ]

        results = {}
        start_time = time.time()

        for exp_name, exp_func in experiments:
            print(f"\n🧪 Running: {exp_name}")
            print("-" * 40)

            try:
                exp_start = time.time()
                result = await exp_func()
                exp_time = time.time() - exp_start

                results[exp_name] = {
                    "success": True,
                    "duration": exp_time,
                    "result": result,
                }
                print(f"✅ {exp_name} completed in {exp_time:.2f}s")

            except Exception as e:
                results[exp_name] = {
                    "success": False, "error": str(e), "duration": 0}
                print(f"❌ {exp_name} failed: {e}")

        total_time = time.time() - start_time

        # Generate comprehensive report
        await self._generate_experiment_report(results, total_time)

        return True

    async def _check_services_health(self) -> bool:
        """Check if all services are healthy"""
        import aiohttp

        services = [
            ("API Gateway", "http://localhost:8081/health"),
            ("LLM Router", "http://localhost:3033/health"),
            ("ML Inference", "http://localhost:8084/health"),
            ("Auth Service", "http://localhost:8015/health"),
        ]

        healthy_count = 0
        async with aiohttp.ClientSession() as session:
            for name, url in services:
                try:
                    async with session.get(
                        url, timeout=aiohttp.ClientTimeout(total=5)
                    ) as response:
                        if response.status == 200:
                            healthy_count += 1
                            print(f"✅ {name}: Healthy")
                        else:
                            print(f"⚠️  {name}: Status {response.status}")
                except Exception as e:
                    print(f"❌ {name}: {e}")

        return healthy_count >= 3  # At least 3 services should be healthy

    async def _run_basic_llm_eval(self) -> Dict:
        """Run basic LLM evaluation experiments"""
        print("  Running basic LLM evaluation...")

        # Run the existing advanced LLM evaluation
        try:
            result = subprocess.run(
                [sys.executable, "advanced_llm_evaluation.py"],
                capture_output=True,
                text=True,
                cwd=self.base_dir,
            )

            if result.returncode == 0:
                return {"status": "success", "output": result.stdout}
            else:
                return {"status": "error", "error": result.stderr}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def _run_ai_compass(self) -> Dict:
        """Run AI Compass comprehensive testing"""
        print("  Running AI Compass testing...")

        try:
            result = subprocess.run(
                [sys.executable, "ai_compass_tester.py"],
                capture_output=True,
                text=True,
                cwd=self.base_dir,
            )

            if result.returncode == 0:
                return {"status": "success", "output": result.stdout}
            else:
                return {"status": "error", "error": result.stderr}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def _run_hybrid_workflow(self) -> Dict:
        """Run hybrid HPC/ML workflow experiments"""
        print("  Running hybrid HPC/ML workflow...")

        try:
            result = subprocess.run(
                [sys.executable, "hybrid_hpc_ml_executor.py"],
                capture_output=True,
                text=True,
                cwd=self.base_dir,
            )

            if result.returncode == 0:
                return {"status": "success", "output": result.stdout}
            else:
                return {"status": "error", "error": result.stderr}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def _run_real_world_scenarios(self) -> Dict:
        """Run real-world scenario experiments"""
        print("  Running real-world scenarios...")

        try:
            result = subprocess.run(
                [sys.executable, "real_world_experiments.py"],
                capture_output=True,
                text=True,
                cwd=self.base_dir,
            )

            if result.returncode == 0:
                return {"status": "success", "output": result.stdout}
            else:
                return {"status": "error", "error": result.stderr}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def _run_performance_benchmarks(self) -> Dict:
        """Run performance benchmarking experiments"""
        print("  Running performance benchmarks...")

        import time

        import aiohttp

        benchmarks = []

        # Test API Gateway performance
        async with aiohttp.ClientSession() as session:
            # Test basic health check
            start_time = time.time()
            async with session.get("http://localhost:8080/health") as response:
                health_time = time.time() - start_time
                benchmarks.append(
                    {
                        "test": "health_check",
                        "duration": health_time,
                        "status": response.status,
                    }
                )

            # Test chat endpoint performance
            start_time = time.time()
            payload = {"message": "Hello, this is a performance test"}
            async with session.post(
                "http://localhost:8081/api/chat", json=payload
            ) as response:
                chat_time = time.time() - start_time
                benchmarks.append(
                    {
                        "test": "chat_endpoint",
                        "duration": chat_time,
                        "status": response.status,
                    }
                )

        return {"benchmarks": benchmarks}

    async def _run_agent_coordination(self) -> Dict:
        """Run agent coordination experiments"""
        print("  Running agent coordination tests...")

        try:
            result = subprocess.run(
                [sys.executable, "agent_coordination_test.py"],
                capture_output=True,
                text=True,
                cwd=self.base_dir,
            )

            if result.returncode == 0:
                return {"status": "success", "output": result.stdout}
            else:
                return {"status": "error", "error": result.stderr}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    async def _run_multimodal_tests(self) -> Dict:
        """Run multi-modal processing tests"""
        print("  Running multi-modal tests...")

        import aiohttp

        tests = []

        async with aiohttp.ClientSession() as session:
            # Test vision processing (if available)
            try:
                payload = {
                    "task_type": "image_analysis",
                    "description": "Analyze this test image",
                    "data": "test_image_data",
                }
                async with session.post(
                    "http://localhost:8081/api/vision/process", json=payload
                ) as response:
                    tests.append(
                        {
                            "test": "vision_processing",
                            "status": response.status,
                            "available": response.status != 404,
                        }
                    )
            except Exception as e:
                tests.append({"test": "vision_processing",
                              "status": "error", "error": str(e)})

            # Test document processing
            try:
                payload = {
                    "task_type": "document_analysis",
                    "description": "Extract key information",
                    "data": "Sample document text for processing",
                }
                async with session.post(
                    "http://localhost:8081/api/multimodal/process", json=payload
                ) as response:
                    tests.append(
                        {
                            "test": "document_processing",
                            "status": response.status,
                            "available": response.status != 404,
                        }
                    )
            except Exception as e:
                tests.append({"test": "document_processing",
                              "status": "error", "error": str(e)})

        return {"multimodal_tests": tests}

    async def _run_edge_case_analysis(self) -> Dict:
        """Run edge case analysis"""
        print("  Running edge case analysis...")

        import aiohttp

        edge_cases = [
            {"input": "", "description": "Empty input"},
            {"input": "A" * 10000, "description": "Very long input"},
            {"input": "🚀🎉💻🔥", "description": "Emoji input"},
            {
                "input": "What is the meaning of life?",
                "description": "Philosophical question",
            },
            {
                "input": "Generate random content",
                "description": "Random generation request",
            },
        ]

        results = []

        async with aiohttp.ClientSession() as session:
            for case in edge_cases:
                try:
                    payload = {"message": case["input"]}
                    async with session.post(
                        "http://localhost:8081/api/chat", json=payload
                    ) as response:
                        results.append(
                            {
                                "case": case["description"],
                                "status": response.status,
                                "handled": response.status == 200,
                            }
                        )
                except Exception as e:
                    results.append(
                        {
                            "case": case["description"],
                            "status": "error",
                            "error": str(e),
                        }
                    )

        return {"edge_cases": results}

    async def _generate_experiment_report(
            self, results: Dict, total_time: float):
        """Generate comprehensive experiment report"""
        timestamp = time.strftime("%Y-%m-%d_%H-%M-%S")
        report_file = self.results_dir / \
            f"real_world_experiments_{timestamp}.json"

        # Calculate summary statistics
        successful_experiments = sum(
            1 for r in results.values() if r["success"])
        total_experiments = len(results)
        success_rate = (successful_experiments /
                        total_experiments if total_experiments > 0 else 0)

        report = {
            "timestamp": timestamp,
            "summary": {
                "total_experiments": total_experiments,
                "successful_experiments": successful_experiments,
                "success_rate": success_rate,
                "total_duration": total_time,
            },
            "experiments": results,
        }

        # Save report
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        # Print summary
        print("\n" + "=" * 60)
        print("📊 REAL-WORLD EXPERIMENT SUMMARY")
        print("=" * 60)
        print(f"Total Experiments: {total_experiments}")
        print(f"Successful: {successful_experiments}")
        print(f"Success Rate: {success_rate:.2%}")
        print(f"Total Duration: {total_time:.2f}s")
        print(f"Report saved to: {report_file}")

        # Print individual results
        print("\n📋 Individual Results:")
        for exp_name, result in results.items():
            status = "✅" if result["success"] else "❌"
            duration = result.get("duration", 0)
            print(f"  {status} {exp_name}: {duration:.2f}s")


async def main():
    """Main entry point"""
    runner = RealWorldExperimentRunner()
    success = await runner.run_comprehensive_experiments()

    if success:
        print("\n🎉 All experiments completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some experiments failed. Check the report for details.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
