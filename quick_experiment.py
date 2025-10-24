#!/usr/bin/env python3
"""
Quick Real-World Experiment for Universal AI Tools
Fast test to verify system functionality with realistic scenarios
"""

import asyncio
import json
import time
from datetime import datetime

import aiohttp


class QuickExperiment:
    """Quick experiment runner for immediate testing"""

    def __init__(self, base_url="http://localhost:8081"):
        self.base_url = base_url
        self.results = []

    async def run_quick_test(self):
        """Run a quick comprehensive test"""
        print("🚀 Quick Real-World Experiment")
        print("=" * 40)

        # Test 1: Basic Health Check
        await self._test_health()

        # Test 2: Simple Chat
        await self._test_simple_chat()

        # Test 3: Technical Question
        await self._test_technical_question()

        # Test 4: Creative Task
        await self._test_creative_task()

        # Test 5: Edge Case
        await self._test_edge_case()

        # Print results
        self._print_results()

        return self.results

    async def _test_health(self):
        """Test basic health endpoint"""
        print("🔍 Testing health endpoint...")
        start_time = time.time()

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/health", timeout=5
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        self.results.append(
                            {
                                "test": "Health Check",
                                "status": "✅ PASS",
                                "duration": f"{duration:.2f}s",
                                "response": data.get("status", "unknown"),
                            }
                        )
                        print(f"  ✅ Health check passed ({duration:.2f}s)")
                    else:
                        self.results.append(
                            {
                                "test": "Health Check",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"  ❌ Health check failed (Status: {
                                response.status})")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Health Check",
                    "status": "❌ ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Health check error: {e}")

    async def _test_simple_chat(self):
        """Test simple chat functionality"""
        print("💬 Testing simple chat...")
        start_time = time.time()

        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "message": "Hello! Can you tell me what you are?",
                    "model": "auto",
                }
                async with session.post(
                    f"{self.base_url}/api/chat", json=payload, timeout=30
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        response_text = data.get("response", "")
                        self.results.append(
                            {
                                "test": "Simple Chat",
                                "status": "✅ PASS",
                                "duration": f"{duration:.2f}s",
                                "response_length": len(response_text),
                                "preview": (
                                    response_text[:100] + "..."
                                    if len(response_text) > 100
                                    else response_text
                                ),
                            }
                        )
                        print(f"  ✅ Chat response received ({duration:.2f}s)")
                        print(f"     Preview: {response_text[:100]}...")
                    else:
                        self.results.append(
                            {
                                "test": "Simple Chat",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(f"  ❌ Chat failed (Status: {response.status})")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Simple Chat",
                    "status": "❌ ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Chat error: {e}")

    async def _test_technical_question(self):
        """Test technical question handling"""
        print("🔧 Testing technical question...")
        start_time = time.time()

        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "message": "How do I optimize a Python function for better performance?",
                    "model": "auto",
                }
                async with session.post(
                    f"{self.base_url}/api/chat", json=payload, timeout=30
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        response_text = data.get("response", "")
                        # Check if response contains technical terms
                        technical_terms = [
                            "performance",
                            "optimize",
                            "algorithm",
                            "complexity",
                            "profiling",
                        ]
                        has_technical_content = any(
                            term in response_text.lower() for term in technical_terms)

                        self.results.append(
                            {
                                "test": "Technical Question",
                                "status": (
                                    "✅ PASS" if has_technical_content else "⚠️ PARTIAL"
                                ),
                                "duration": f"{duration:.2f}s",
                                "response_length": len(response_text),
                                "technical_content": has_technical_content,
                                "preview": (
                                    response_text[:100] + "..."
                                    if len(response_text) > 100
                                    else response_text
                                ),
                            }
                        )
                        print(
                            f"  {
                                '✅' if has_technical_content else '⚠️'} Technical response received ({
                                duration:.2f}s)")
                    else:
                        self.results.append(
                            {
                                "test": "Technical Question",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"  ❌ Technical question failed (Status: {
                                response.status})")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Technical Question",
                    "status": "❌ ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Technical question error: {e}")

    async def _test_creative_task(self):
        """Test creative task handling"""
        print("🎨 Testing creative task...")
        start_time = time.time()

        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "message": "Write a short haiku about artificial intelligence",
                    "model": "auto",
                }
                async with session.post(
                    f"{self.base_url}/api/chat", json=payload, timeout=30
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        response_text = data.get("response", "")
                        # Check if response looks like a haiku (rough check)
                        lines = response_text.strip().split("\n")
                        is_haiku_like = len(lines) >= 3 and any(
                            "ai" in line.lower()
                            or "artificial" in line.lower()
                            or "intelligence" in line.lower()
                            for line in lines
                        )

                        self.results.append(
                            {
                                "test": "Creative Task",
                                "status": "✅ PASS" if is_haiku_like else "⚠️ PARTIAL",
                                "duration": f"{duration:.2f}s",
                                "response_length": len(response_text),
                                "creative_content": is_haiku_like,
                                "preview": (
                                    response_text[:100] + "..."
                                    if len(response_text) > 100
                                    else response_text
                                ),
                            }
                        )
                        print(
                            f"  {
                                '✅' if is_haiku_like else '⚠️'} Creative response received ({
                                duration:.2f}s)")
                    else:
                        self.results.append(
                            {
                                "test": "Creative Task",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"  ❌ Creative task failed (Status: {
                                response.status})")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Creative Task",
                    "status": "❌ ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Creative task error: {e}")

    async def _test_edge_case(self):
        """Test edge case handling"""
        print("🔍 Testing edge case...")
        start_time = time.time()

        try:
            async with aiohttp.ClientSession() as session:
                payload = {"message": "", "model": "auto"}  # Empty message
                async with session.post(
                    f"{self.base_url}/api/chat", json=payload, timeout=10
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        response_text = data.get("response", "")
                        # Check if system handled empty input gracefully
                        handled_gracefully = len(response_text) > 0 and (
                            "empty" in response_text.lower()
                            or "please" in response_text.lower()
                            or "provide" in response_text.lower()
                        )

                        self.results.append(
                            {
                                "test": "Edge Case (Empty Input)",
                                "status": (
                                    "✅ PASS" if handled_gracefully else "⚠️ PARTIAL"
                                ),
                                "duration": f"{duration:.2f}s",
                                "response_length": len(response_text),
                                "handled_gracefully": handled_gracefully,
                                "preview": (
                                    response_text[:100] + "..."
                                    if len(response_text) > 100
                                    else response_text
                                ),
                            }
                        )
                        print(
                            f"  {
                                '✅' if handled_gracefully else '⚠️'} Edge case handled ({
                                duration:.2f}s)")
                    else:
                        self.results.append(
                            {
                                "test": "Edge Case (Empty Input)",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"  ❌ Edge case failed (Status: {
                                response.status})")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Edge Case (Empty Input)",
                    "status": "❌ ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  ❌ Edge case error: {e}")

    def _print_results(self):
        """Print experiment results"""
        print("\n" + "=" * 40)
        print("📊 EXPERIMENT RESULTS")
        print("=" * 40)

        passed = sum(1 for r in self.results if "✅" in r["status"])
        partial = sum(1 for r in self.results if "⚠️" in r["status"])
        failed = sum(1 for r in self.results if "❌" in r["status"])
        total = len(self.results)

        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"⚠️ Partial: {partial}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {((passed + partial * 0.5) / total * 100):.1f}%")

        print("\n📋 Detailed Results:")
        for result in self.results:
            print(
                f"  {
                    result['status']} {
                    result['test']}: {
                    result['duration']}")
            if "error" in result:
                print(f"    Error: {result['error']}")
            elif "preview" in result:
                print(f"    Preview: {result['preview']}")

        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        results_file = f"quick_experiment_results_{timestamp}.json"
        with open(results_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "timestamp": timestamp,
                    "summary": {
                        "total": total,
                        "passed": passed,
                        "partial": partial,
                        "failed": failed,
                        "success_rate": (
                            ((passed + partial * 0.5) / total * 100) if total > 0 else 0),
                    },
                    "results": self.results,
                },
                f,
                indent=2,
            )

        print(f"\n💾 Results saved to: {results_file}")


async def main():
    """Main entry point"""
    experiment = QuickExperiment()
    await experiment.run_quick_test()


if __name__ == "__main__":
    asyncio.run(main())
