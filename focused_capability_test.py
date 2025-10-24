#!/usr/bin/env python3
"""
Focused Capability Test - Test Key Working Features
Tests the core capabilities that are confirmed to be working.
"""

import asyncio
import base64
import io
import json
import time
from typing import Any, Dict, List

import aiohttp
from PIL import Image


class FocusedCapabilityTester:
    def __init__(self):
        self.results: List[Dict[str, Any]] = []
        self.base_urls = {
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
            "vision_service": "http://localhost:8084",
            "memory_service": "http://localhost:8017",
            "fast_llm": "http://localhost:3030",
            "api_gateway": "http://localhost:8081",
        }

    async def run_focused_tests(self):
        """Run focused tests on working capabilities"""
        print("🎯 Starting Focused Capability Test")
        print("=" * 50)

        # Test core AI capabilities
        await self._test_llm_models()
        await self._test_ml_inference_advanced()
        await self._test_vision_analysis()
        await self._test_fast_llm_service()

        # Test memory and persistence
        await self._test_memory_operations()

        # Test API Gateway orchestration
        await self._test_api_gateway_orchestration()

        # Test advanced workflows
        await self._test_complex_workflows()

        # Generate focused report
        self._generate_report()

    async def _test_llm_models(self):
        """Test different LLM models"""
        print("🤖 Testing LLM Models...")

        models_to_test = [{"name": "llama3.2:3b",
                           "prompt": "Write a haiku about technology"},
                          {"name": "llama2:latest",
                           "prompt": "Explain quantum computing in simple terms",
                           },
                          {"name": "gemma3:1b",
                           "prompt": "Create a short story about a robot"},
                          ]

        for model_test in models_to_test:
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    chat_data = {
                        "messages": [{"role": "user", "content": model_test["prompt"]}],
                        "model": model_test["name"],
                        "temperature": 0.7,
                        "max_tokens": 150,
                    }

                    async with session.post(
                        f"{self.base_urls['llm_router']}/chat",
                        json=chat_data,
                        timeout=30,
                    ) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            response_text = data.get("response", "")
                            self.results.append(
                                {
                                    "test": f"LLM - {model_test['name']}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                    "model": model_test["name"],
                                    "response_length": len(response_text),
                                    "response_preview": (
                                        response_text[:100] + "..."
                                        if len(response_text) > 100
                                        else response_text
                                    ),
                                }
                            )
                            print(
                                f"  ✅ {
                                    model_test['name']}: {
                                    len(response_text)} chars ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"LLM - {model_test['name']}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ {
                                    model_test['name']}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"LLM - {model_test['name']}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 {model_test['name']}: error - {e}")

    async def _test_ml_inference_advanced(self):
        """Test advanced ML inference capabilities"""
        print("\n🧠 Testing Advanced ML Inference...")

        inference_tasks = [
            {
                "name": "Creative Writing",
                "data": {
                    "model_id": "llama3.2:3b",
                    "input": "Write a creative story about a time-traveling detective",
                    "parameters": {"max_tokens": 200, "temperature": 0.8},
                    "task_type": "text_generation",
                },
            },
            {
                "name": "Code Generation",
                "data": {
                    "model_id": "llama3.2:3b",
                    "input": "Write a Python function to calculate fibonacci numbers",
                    "parameters": {"max_tokens": 150, "temperature": 0.3},
                    "task_type": "text_generation",
                },
            },
            {
                "name": "Data Analysis",
                "data": {
                    "model_id": "llama3.2:3b",
                    "input": "Analyze this data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] and provide insights",
                    "parameters": {"max_tokens": 100, "temperature": 0.1},
                    "task_type": "text_generation",
                },
            },
        ]

        for task in inference_tasks:
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_urls['ml_inference']}/infer",
                        json=task["data"],
                        timeout=30,
                    ) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            output = data.get("output", "")
                            self.results.append(
                                {
                                    "test": f"ML Inference - {task['name']}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                    "task": task["name"],
                                    "output_length": len(output),
                                    "output_preview": (
                                        output[:100] + "..."
                                        if len(output) > 100
                                        else output
                                    ),
                                }
                            )
                            print(
                                f"  ✅ {
                                    task['name']}: {
                                    len(output)} chars ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"ML Inference - {task['name']}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ {
                                    task['name']}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"ML Inference - {task['name']}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 {task['name']}: error - {e}")

    async def _test_vision_analysis(self):
        """Test Vision Service capabilities"""
        print("\n👁️ Testing Vision Analysis...")

        # Create different test images
        test_images = [
            {"name": "Red Square", "color": "red", "size": (100, 100)},
            {"name": "Blue Circle", "color": "blue", "size": (150, 150)},
            {"name": "Green Rectangle", "color": "green", "size": (200, 100)},
        ]

        for img_test in test_images:
            start_time = time.time()
            try:
                # Create test image
                img = Image.new(
                    "RGB",
                    img_test["size"],
                    color=img_test["color"])
                img_buffer = io.BytesIO()
                img.save(img_buffer, format="PNG")
                img_base64 = base64.b64encode(img_buffer.getvalue()).decode()

                async with aiohttp.ClientSession() as session:
                    vision_data = {
                        "image": img_base64,
                        "prompt": f"Describe this {
                            img_test['name']} image in detail",
                        "model": "default",
                    }

                    async with session.post(
                        f"{self.base_urls['vision_service']}/vision/analyze",
                        json=vision_data,
                        timeout=30,
                    ) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            description = data.get("description", "")
                            self.results.append(
                                {
                                    "test": f"Vision - {img_test['name']}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                    "image_type": img_test["name"],
                                    "description": (
                                        description[:100] + "..."
                                        if len(description) > 100
                                        else description
                                    ),
                                }
                            )
                            print(
                                f"  ✅ {
                                    img_test['name']}: analyzed ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Vision - {img_test['name']}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ {
                                    img_test['name']}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"Vision - {img_test['name']}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 {img_test['name']}: error - {e}")

    async def _test_fast_llm_service(self):
        """Test Fast LLM Service capabilities"""
        print("\n⚡ Testing Fast LLM Service...")

        fast_llm_tests = [
            {"model": "fast-llm-v1", "prompt": "Quick response test"},
            {"model": "fast-llm-v2", "prompt": "Speed test prompt"},
            {"model": "fast-llm-turbo", "prompt": "Turbo mode test"},
        ]

        for test in fast_llm_tests:
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    llm_data = {
                        "model": test["model"],
                        "prompt": test["prompt"],
                        "max_tokens": 50,
                        "temperature": 0.5,
                    }

                    async with session.post(
                        f"{self.base_urls['fast_llm']}/api/v1/inference",
                        json=llm_data,
                        timeout=15,
                    ) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            text = data.get("text", "")
                            self.results.append(
                                {
                                    "test": f"Fast LLM - {test['model']}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                    "model": test["model"],
                                    "response_length": len(text),
                                    "response_preview": (
                                        text[:50] + "..." if len(text) > 50 else text
                                    ),
                                }
                            )
                            print(
                                f"  ✅ {
                                    test['model']}: {
                                    len(text)} chars ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Fast LLM - {test['model']}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ {
                                    test['model']}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"Fast LLM - {test['model']}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 {test['model']}: error - {e}")

    async def _test_memory_operations(self):
        """Test Memory Service operations"""
        print("\n🧠 Testing Memory Operations...")

        memory_tests = [{"name": "Conversation Memory",
                         "data": {"user_id": "test_user",
                                  "type": "conversation",
                                  "content": "This is a test conversation about AI capabilities",
                                  "tags": ["test",
                                           "conversation",
                                           "ai"],
                                  "metadata": {"test_type": "conversation"},
                                  },
                         },
                        {"name": "Knowledge Memory",
                         "data": {"user_id": "test_user",
                                  "type": "knowledge",
                                  "content": "AI systems can process natural language and generate responses",
                                  "tags": ["knowledge",
                                           "ai",
                                           "nlp"],
                                  "metadata": {"test_type": "knowledge"},
                                  },
                         },
                        {"name": "Experience Memory",
                         "data": {"user_id": "test_user",
                                  "type": "experience",
                                  "content": "Successfully tested multiple AI services working together",
                                  "tags": ["experience",
                                           "testing",
                                           "success"],
                                  "metadata": {"test_type": "experience"},
                                  },
                         },
                        ]

        for test in memory_tests:
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_urls['memory_service']}/memories",
                        json=test["data"],
                        headers={"X-User-ID": "test_user"},
                        timeout=10,
                    ) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            memory_id = data.get("id", "unknown")
                            self.results.append(
                                {
                                    "test": f"Memory - {test['name']}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                    "memory_type": test["name"],
                                    "memory_id": memory_id,
                                }
                            )
                            print(
                                f"  ✅ {
                                    test['name']}: stored ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Memory - {test['name']}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ {
                                    test['name']}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"Memory - {test['name']}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 {test['name']}: error - {e}")

    async def _test_api_gateway_orchestration(self):
        """Test API Gateway orchestration capabilities"""
        print("\n🌐 Testing API Gateway Orchestration...")

        # Test API Gateway chat endpoint
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                chat_data = {
                    "messages": [
                        {
                            "role": "user",
                            "content": "Test API Gateway orchestration with multiple services",
                        }],
                    "model": "llama3.2:3b",
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
                        response_text = data.get("response", "")
                        self.results.append(
                            {
                                "test": "API Gateway Orchestration",
                                "status": "✅ PASS",
                                "duration": f"{duration:.2f}s",
                                "response_length": len(response_text),
                                "response_preview": (
                                    response_text[:100] + "..."
                                    if len(response_text) > 100
                                    else response_text
                                ),
                            }
                        )
                        print(
                            f"  ✅ API Gateway: orchestrated ({
                                duration:.2f}s)")
                    else:
                        self.results.append(
                            {
                                "test": "API Gateway Orchestration",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"  ❌ API Gateway: failed (Status: {
                                response.status})")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "API Gateway Orchestration",
                    "status": "💥 ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  💥 API Gateway: error - {e}")

    async def _test_complex_workflows(self):
        """Test complex multi-service workflows"""
        print("\n🔄 Testing Complex Workflows...")

        # Test AI + Vision + Memory workflow
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                # Step 1: Create and analyze an image
                img = Image.new("RGB", (100, 100), color="purple")
                img_buffer = io.BytesIO()
                img.save(img_buffer, format="PNG")
                img_base64 = base64.b64encode(img_buffer.getvalue()).decode()

                vision_data = {
                    "image": img_base64,
                    "prompt": "Describe this image for AI processing",
                    "model": "default",
                }

                async with session.post(
                    f"{self.base_urls['vision_service']}/vision/analyze",
                    json=vision_data,
                    timeout=30,
                ) as response:
                    if response.status == 200:
                        vision_result = await response.json()
                        vision_description = vision_result.get(
                            "description", "")

                        # Step 2: Process with LLM
                        chat_data = {
                            "messages": [
                                {
                                    "role": "user",
                                    "content": f"Based on this vision analysis: '{vision_description}', provide insights and recommendations",
                                }],
                            "model": "llama3.2:3b",
                        }

                        async with session.post(
                            f"{self.base_urls['llm_router']}/chat",
                            json=chat_data,
                            timeout=30,
                        ) as response:
                            if response.status == 200:
                                chat_result = await response.json()
                                llm_response = chat_result.get("response", "")

                                # Step 3: Store in memory
                                memory_data = {
                                    "user_id": "workflow_test",
                                    "type": "workflow",
                                    "content": f"Vision: {vision_description[:100]}... LLM: {llm_response[:100]}...",
                                    "tags": ["workflow", "vision", "llm", "complex"],
                                    "metadata": {"workflow_type": "vision_llm_memory"},
                                }

                                async with session.post(
                                    f"{self.base_urls['memory_service']}/memories",
                                    json=memory_data,
                                    headers={"X-User-ID": "workflow_test"},
                                    timeout=10,
                                ) as response:
                                    duration = time.time() - start_time
                                    if response.status == 200:
                                        memory_result = await response.json()
                                        self.results.append(
                                            {
                                                "test": "Complex Vision-LLM-Memory Workflow",
                                                "status": "✅ PASS",
                                                "duration": f"{duration:.2f}s",
                                                "steps_completed": 3,
                                                "vision_description": vision_description[
                                                    :50
                                                ]
                                                + "...",
                                                "llm_response": llm_response[:50]
                                                + "...",
                                                "memory_id": memory_result.get(
                                                    "id", "unknown"
                                                ),
                                            }
                                        )
                                        print(
                                            f"  ✅ Complex Workflow: completed ({
                                                duration:.2f}s)")
                                    else:
                                        self.results.append(
                                            {
                                                "test": "Complex Vision-LLM-Memory Workflow",
                                                "status": "❌ FAIL",
                                                "duration": f"{
                                                    duration:.2f}s",
                                                "error": f"Memory storage failed: {
                                                    response.status}",
                                            })
                                        print(
                                            "  ❌ Complex Workflow: Memory storage failed"
                                        )
                            else:
                                duration = time.time() - start_time
                                self.results.append(
                                    {
                                        "test": "Complex Vision-LLM-Memory Workflow",
                                        "status": "❌ FAIL",
                                        "duration": f"{
                                            duration:.2f}s",
                                        "error": f"LLM processing failed: {
                                            response.status}",
                                    })
                                print("  ❌ Complex Workflow: LLM processing failed")
                    else:
                        duration = time.time() - start_time
                        self.results.append(
                            {
                                "test": "Complex Vision-LLM-Memory Workflow",
                                "status": "❌ FAIL",
                                "duration": f"{
                                    duration:.2f}s",
                                "error": f"Vision analysis failed: {
                                    response.status}",
                            })
                        print("  ❌ Complex Workflow: Vision analysis failed")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Complex Vision-LLM-Memory Workflow",
                    "status": "💥 ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  💥 Complex Workflow: error - {e}")

    def _generate_report(self):
        """Generate focused test report"""
        print("\n" + "=" * 50)
        print("📊 FOCUSED CAPABILITY TEST SUMMARY")
        print("=" * 50)

        total_tests = len(self.results)
        passed = len([r for r in self.results if r["status"] == "✅ PASS"])
        failed = len([r for r in self.results if r["status"] == "❌ FAIL"])
        errors = len([r for r in self.results if r["status"] == "💥 ERROR"])

        success_rate = (passed / total_tests) * 100

        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"💥 Errors: {errors}")
        print(f"📈 Success Rate: {success_rate:.1f}%")

        print("\n🔍 Detailed Results:")
        for result in self.results:
            status_icon = result["status"]
            test_name = result["test"]
            duration = result["duration"]
            print(f"  {status_icon} {test_name}: {duration}")
            if "error" in result:
                print(f"    Error: {result['error']}")

        # Save detailed results
        with open("focused_capability_results.json", "w") as f:
            json.dump(self.results, f, indent=2)

        print("\n💾 Detailed results saved to: focused_capability_results.json")

        if success_rate >= 80:
            print("\n🎉 Focused capability test PASSED!")
        elif success_rate >= 60:
            print("\n⚠️ Focused capability test PARTIAL SUCCESS!")
        else:
            print("\n💥 Focused capability test FAILED!")


async def main():
    tester = FocusedCapabilityTester()
    await tester.run_focused_tests()


if __name__ == "__main__":
    asyncio.run(main())
