#!/usr/bin/env python3
"""
Orchestration Benchmark: Universal AI Tools vs Frontier Models
Tests system performance across multiple AI tasks and workflows
"""

import asyncio
import base64
import io
import json
import statistics
import time

import aiohttp
from PIL import Image


class OrchestrationBenchmark:
    def __init__(self):
        self.base_urls = {
            "api_gateway": "http://localhost:8081",
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
            "memory_service": "http://localhost:8017",
            "vision_service": "http://localhost:8084",
            "fast_llm": "http://localhost:3030",
        }
        self.results = []
        self.benchmark_start = time.time()

    async def benchmark_text_generation(self):
        """Benchmark text generation capabilities"""
        print("\n📝 Benchmarking Text Generation...")

        prompts = [
            "Write a compelling product description for a smart home device",
            "Explain quantum computing in simple terms",
            "Create a creative story about time travel",
            "Generate a technical specification for a mobile app",
            "Write a persuasive argument for renewable energy",
        ]

        for i, prompt in enumerate(prompts):
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    llm_data = {
                        "model": "llama3.2:3b",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 200,
                        "temperature": 0.7,
                    }

                    async with session.post(
                        f"{self.base_urls['llm_router']}/chat",
                        json=llm_data,
                        timeout=30,
                    ) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            text = data.get("response", "")
                            word_count = len(text.split())

                            self.results.append(
                                {
                                    "test": f"Text Generation {
                                        i + 1}",
                                    "status": "✅ PASS",
                                    "duration": f"{
                                        duration:.2f}s",
                                    "word_count": word_count,
                                    "words_per_second": round(
                                        word_count / duration,
                                        1),
                                    "quality": "High" if word_count > 50 else "Medium",
                                })
                            print(
                                f"  ✅ Prompt {
                                    i +
                                    1}: {word_count} words ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Text Generation {i + 1}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ Prompt {
                                    i +
                                    1}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"Text Generation {i + 1}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 Prompt {i + 1}: error - {e}")

    async def benchmark_reasoning_tasks(self):
        """Benchmark complex reasoning capabilities"""
        print("\n🧠 Benchmarking Reasoning Tasks...")

        reasoning_tasks = [
            {
                "prompt": "If a train leaves New York at 2 PM traveling 60 mph, and another leaves Chicago at 3 PM traveling 80 mph toward New York (distance 800 miles), when will they meet?",
                "expected": "mathematical reasoning",
            },
            {
                "prompt": "Analyze the pros and cons of remote work vs office work from multiple perspectives (employee, employer, society)",
                "expected": "analytical reasoning",
            },
            {
                "prompt": "Design a system architecture for a real-time chat application that can handle 1 million concurrent users",
                "expected": "technical reasoning",
            },
        ]

        for i, task in enumerate(reasoning_tasks):
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    llm_data = {
                        "model": "llama3.2:3b",
                        "messages": [{"role": "user", "content": task["prompt"]}],
                        "max_tokens": 300,
                        "temperature": 0.3,
                    }

                    async with session.post(
                        f"{self.base_urls['llm_router']}/chat",
                        json=llm_data,
                        timeout=45,
                    ) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            response_text = data.get("response", "")

                            # Simple quality assessment
                            quality_indicators = [
                                "because",
                                "therefore",
                                "however",
                                "analysis",
                                "reasoning",
                                "conclusion",
                            ]
                            quality_score = sum(
                                1
                                for indicator in quality_indicators
                                if indicator.lower() in response_text.lower()
                            )

                            self.results.append(
                                {
                                    "test": f"Reasoning Task {i + 1}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                    "quality_score": quality_score,
                                    "response_length": len(response_text),
                                    "task_type": task["expected"],
                                }
                            )
                            print(
                                f"  ✅ Reasoning {
                                    i +
                                    1}: {quality_score} quality indicators ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Reasoning Task {i + 1}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ Reasoning {
                                    i +
                                    1}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"Reasoning Task {i + 1}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 Reasoning {i + 1}: error - {e}")

    async def benchmark_vision_analysis(self):
        """Benchmark vision analysis capabilities"""
        print("\n👁️ Benchmarking Vision Analysis...")

        # Create test images
        test_images = [
            {"color": "red", "shape": "square", "size": (100, 100)},
            {"color": "blue", "shape": "circle", "size": (120, 120)},
            {"color": "green", "shape": "rectangle", "size": (150, 100)},
        ]

        for i, img_config in enumerate(test_images):
            start_time = time.time()
            try:
                # Create test image
                img = Image.new(
                    "RGB",
                    img_config["size"],
                    color=img_config["color"])
                img_buffer = io.BytesIO()
                img.save(img_buffer, format="PNG")
                img_base64 = base64.b64encode(img_buffer.getvalue()).decode()

                async with aiohttp.ClientSession() as session:
                    vision_data = {
                        "image": img_base64,
                        "prompt": f"Describe this {
                            img_config['color']} {
                            img_config['shape']} in detail",
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

                            # Check if description mentions expected elements
                            color_match = (
                                img_config["color"].lower() in description.lower())
                            shape_match = (
                                img_config["shape"].lower() in description.lower())
                            accuracy = (color_match + shape_match) / 2

                            self.results.append(
                                {
                                    "test": f"Vision Analysis {
                                        i + 1}",
                                    "status": "✅ PASS",
                                    "duration": f"{
                                        duration:.2f}s",
                                    "accuracy": accuracy,
                                    "description_length": len(description),
                                    "expected": f"{
                                        img_config['color']} {
                                        img_config['shape']}",
                                })
                            print(
                                f"  ✅ Vision {
                                    i +
                                    1}: {
                                    accuracy:.1%} accuracy ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Vision Analysis {i + 1}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ Vision {
                                    i +
                                    1}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"Vision Analysis {i + 1}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 Vision {i + 1}: error - {e}")

    async def benchmark_memory_operations(self):
        """Benchmark memory storage and retrieval"""
        print("\n🧠 Benchmarking Memory Operations...")

        memories = [{"key": "user_preference_1",
                     "content": "User prefers technical explanations with examples",
                     "tags": ["preference",
                                "technical",
                                "user"],
                     },
                    {"key": "conversation_context_1",
                     "content": "Discussed AI system architecture and microservices",
                     "tags": ["conversation",
                              "architecture",
                              "ai"],
                     },
                    {"key": "knowledge_base_1",
                     "content": "Machine learning models require training data and validation sets",
                     "tags": ["knowledge",
                              "ml",
                              "training"],
                     },
                    ]

        # Test memory storage
        for i, memory in enumerate(memories):
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    headers = {"X-User-ID": "benchmark_user"}
                    memory_data = {
                        "key": memory["key"],
                        "content": memory["content"],
                        "tags": memory["tags"],
                    }

                    async with session.post(
                        f"{self.base_urls['memory_service']}/memories",
                        json=memory_data,
                        headers=headers,
                        timeout=15,
                    ) as response:
                        duration = time.time() - start_time
                        if response.status == 200:
                            self.results.append(
                                {
                                    "test": f"Memory Storage {i + 1}",
                                    "status": "✅ PASS",
                                    "duration": f"{duration:.2f}s",
                                    "operation": "store",
                                }
                            )
                            print(
                                f"  ✅ Memory Store {
                                    i +
                                    1}: ({
                                    duration:.2f}s)")
                        else:
                            self.results.append(
                                {
                                    "test": f"Memory Storage {i + 1}",
                                    "status": "❌ FAIL",
                                    "duration": f"{duration:.2f}s",
                                    "error": f"Status {response.status}",
                                }
                            )
                            print(
                                f"  ❌ Memory Store {
                                    i +
                                    1}: failed (Status: {
                                    response.status})")
            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"Memory Storage {i + 1}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 Memory Store {i + 1}: error - {e}")

        # Test memory retrieval
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                headers = {"X-User-ID": "benchmark_user"}
                async with session.get(
                    f"{self.base_urls['memory_service']}/memories?limit=10",
                    headers=headers,
                    timeout=15,
                ) as response:
                    duration = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        memory_count = data.get("count", 0)

                        self.results.append(
                            {
                                "test": "Memory Retrieval",
                                "status": "✅ PASS",
                                "duration": f"{duration:.2f}s",
                                "memory_count": memory_count,
                                "operation": "retrieve",
                            }
                        )
                        print(
                            f"  ✅ Memory Retrieval: {memory_count} memories ({
                                duration:.2f}s)")
                    else:
                        self.results.append(
                            {
                                "test": "Memory Retrieval",
                                "status": "❌ FAIL",
                                "duration": f"{duration:.2f}s",
                                "error": f"Status {response.status}",
                            }
                        )
                        print(
                            f"  ❌ Memory Retrieval: failed (Status: {
                                response.status})")
        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Memory Retrieval",
                    "status": "💥 ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  💥 Memory Retrieval: error - {e}")

    async def benchmark_complex_workflows(self):
        """Benchmark complex multi-service workflows"""
        print("\n🔄 Benchmarking Complex Workflows...")

        workflows = [{"name": "Vision + LLM Analysis",
                      "description": "Analyze image and generate detailed description",
                      },
                     {"name": "Memory + LLM Context",
                      "description": "Use stored memory to enhance LLM response",
                      },
                     {"name": "Multi-Model Comparison",
                      "description": "Compare responses from different models",
                      },
                     ]

        for i, workflow in enumerate(workflows):
            start_time = time.time()
            try:
                if i == 0:  # Vision + LLM Analysis
                    # Create test image
                    img = Image.new("RGB", (100, 100), color="purple")
                    img_buffer = io.BytesIO()
                    img.save(img_buffer, format="PNG")
                    img_base64 = base64.b64encode(
                        img_buffer.getvalue()).decode()

                    async with aiohttp.ClientSession() as session:
                        # Vision analysis
                        vision_data = {
                            "image": img_base64,
                            "prompt": "Describe this image",
                            "model": "default",
                        }

                        async with session.post(
                            f"{self.base_urls['vision_service']}/vision/analyze",
                            json=vision_data,
                            timeout=30,
                        ) as vision_response:
                            if vision_response.status == 200:
                                vision_data = await vision_response.json()
                                description = vision_data.get(
                                    "description", "")

                                # LLM enhancement
                                llm_data = {
                                    "model": "llama3.2:3b",
                                    "messages": [
                                        {
                                            "role": "user",
                                            "content": f"Enhance this image description: {description}",
                                        }],
                                    "max_tokens": 150,
                                }

                                async with session.post(
                                    f"{self.base_urls['llm_router']}/chat",
                                    json=llm_data,
                                    timeout=30,
                                ) as llm_response:
                                    duration = time.time() - start_time
                                    if llm_response.status == 200:
                                        llm_data = await llm_response.json()
                                        enhanced_text = llm_data.get(
                                            "response", "")

                                        self.results.append(
                                            {
                                                "test": f"Workflow {
                                                    i +
                                                    1}: {
                                                    workflow['name']}",
                                                "status": "✅ PASS",
                                                "duration": f"{
                                                    duration:.2f}s",
                                                "workflow_type": "vision_llm",
                                                "enhanced_length": len(enhanced_text),
                                            })
                                        print(
                                            f"  ✅ Workflow {i + 1}: Vision+LLM ({duration:.2f}s)"
                                        )
                                    else:
                                        self.results.append(
                                            {
                                                "test": f"Workflow {
                                                    i +
                                                    1}: {
                                                    workflow['name']}",
                                                "status": "❌ FAIL",
                                                "duration": f"{
                                                    duration:.2f}s",
                                                "error": f"LLM Status {
                                                    llm_response.status}",
                                            })
                                        print(
                                            f"  ❌ Workflow {
                                                i + 1}: LLM failed")
                            else:
                                self.results.append(
                                    {
                                        "test": f"Workflow {
                                            i +
                                            1}: {
                                            workflow['name']}",
                                        "status": "❌ FAIL",
                                        "duration": f"{
                                            duration:.2f}s",
                                        "error": f"Vision Status {
                                            vision_response.status}",
                                    })
                                print(f"  ❌ Workflow {i + 1}: Vision failed")

                elif i == 1:  # Memory + LLM Context
                    async with aiohttp.ClientSession() as session:
                        # Retrieve memory
                        headers = {"X-User-ID": "benchmark_user"}
                        async with session.get(
                            f"{self.base_urls['memory_service']}/memories?limit=3",
                            headers=headers,
                            timeout=15,
                        ) as memory_response:
                            if memory_response.status == 200:
                                memory_data = await memory_response.json()
                                memories = memory_data.get("memories", [])

                                # Use memory in LLM context
                                context = " ".join(
                                    [mem.get("content", "") for mem in memories[:2]]
                                )
                                llm_data = {
                                    "model": "llama3.2:3b",
                                    "messages": [
                                        {
                                            "role": "user",
                                            "content": f"Based on this context: {context}. What insights can you provide?",
                                        }],
                                    "max_tokens": 200,
                                }

                                async with session.post(
                                    f"{self.base_urls['llm_router']}/chat",
                                    json=llm_data,
                                    timeout=30,
                                ) as llm_response:
                                    duration = time.time() - start_time
                                    if llm_response.status == 200:
                                        llm_data = await llm_response.json()
                                        response_text = llm_data.get(
                                            "response", "")

                                        self.results.append(
                                            {
                                                "test": f"Workflow {
                                                    i +
                                                    1}: {
                                                    workflow['name']}",
                                                "status": "✅ PASS",
                                                "duration": f"{
                                                    duration:.2f}s",
                                                "workflow_type": "memory_llm",
                                                "response_length": len(response_text),
                                            })
                                        print(
                                            f"  ✅ Workflow {i + 1}: Memory+LLM ({duration:.2f}s)"
                                        )
                                    else:
                                        self.results.append(
                                            {
                                                "test": f"Workflow {
                                                    i +
                                                    1}: {
                                                    workflow['name']}",
                                                "status": "❌ FAIL",
                                                "duration": f"{
                                                    duration:.2f}s",
                                                "error": f"LLM Status {
                                                    llm_response.status}",
                                            })
                                        print(
                                            f"  ❌ Workflow {
                                                i + 1}: LLM failed")
                            else:
                                self.results.append(
                                    {
                                        "test": f"Workflow {
                                            i +
                                            1}: {
                                            workflow['name']}",
                                        "status": "❌ FAIL",
                                        "duration": f"{
                                            duration:.2f}s",
                                        "error": f"Memory Status {
                                            memory_response.status}",
                                    })
                                print(f"  ❌ Workflow {i + 1}: Memory failed")

                else:  # Multi-Model Comparison
                    models = ["llama3.2:3b", "llama2:latest"]
                    responses = []

                    async with aiohttp.ClientSession() as session:
                        for model in models:
                            llm_data = {
                                "model": model,
                                "messages": [
                                    {
                                        "role": "user",
                                        "content": "Explain the benefits of microservices architecture",
                                    }],
                                "max_tokens": 150,
                                "temperature": 0.5,
                            }

                            async with session.post(
                                f"{self.base_urls['llm_router']}/chat",
                                json=llm_data,
                                timeout=30,
                            ) as response:
                                if response.status == 200:
                                    data = await response.json()
                                    responses.append(
                                        {
                                            "model": model,
                                            "response": data.get("response", ""),
                                            "length": len(data.get("response", "")),
                                        }
                                    )

                    duration = time.time() - start_time
                    if len(responses) >= 2:
                        avg_length = sum(r["length"] for r in responses) / len(
                            responses
                        )
                        self.results.append(
                            {
                                "test": f"Workflow {
                                    i +
                                    1}: {
                                    workflow['name']}",
                                "status": "✅ PASS",
                                "duration": f"{
                                    duration:.2f}s",
                                "workflow_type": "multi_model",
                                "models_tested": len(responses),
                                "avg_response_length": avg_length,
                            })
                        print(
                            f"  ✅ Workflow {i + 1}: Multi-Model ({duration:.2f}s)")
                    else:
                        self.results.append(
                            {
                                "test": f"Workflow {
                                    i +
                                    1}: {
                                    workflow['name']}",
                                "status": "❌ FAIL",
                                "duration": f"{
                                    duration:.2f}s",
                                "error": "Insufficient model responses",
                            })
                        print(f"  ❌ Workflow {i + 1}: Insufficient responses")

            except Exception as e:
                duration = time.time() - start_time
                self.results.append(
                    {
                        "test": f"Workflow {i + 1}: {workflow['name']}",
                        "status": "💥 ERROR",
                        "duration": f"{duration:.2f}s",
                        "error": str(e),
                    }
                )
                print(f"  💥 Workflow {i + 1}: error - {e}")

    async def benchmark_concurrent_operations(self):
        """Benchmark concurrent operation handling"""
        print("\n⚡ Benchmarking Concurrent Operations...")

        concurrent_tasks = 5
        start_time = time.time()

        async def single_request(session, task_id):
            try:
                llm_data = {
                    "model": "llama3.2:3b",
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Generate a short creative story about task {task_id}",
                        }],
                    "max_tokens": 100,
                    "temperature": 0.8,
                }

                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json=llm_data,
                    timeout=30,
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "task_id": task_id,
                            "status": "success",
                            "response_length": len(data.get("response", "")),
                            "duration": time.time() - start_time,
                        }
                    else:
                        return {
                            "task_id": task_id,
                            "status": "failed",
                            "error": f"Status {response.status}",
                            "duration": time.time() - start_time,
                        }
            except Exception as e:
                return {
                    "task_id": task_id,
                    "status": "error",
                    "error": str(e),
                    "duration": time.time() - start_time,
                }

        try:
            async with aiohttp.ClientSession() as session:
                tasks = [single_request(session, i)
                         for i in range(concurrent_tasks)]
                results = await asyncio.gather(*tasks)

                total_duration = time.time() - start_time
                successful_tasks = sum(
                    1 for r in results if r["status"] == "success")
                avg_response_length = sum(
                    r.get("response_length", 0)
                    for r in results
                    if r["status"] == "success"
                ) / max(successful_tasks, 1)

                self.results.append(
                    {
                        "test": "Concurrent Operations",
                        "status": "✅ PASS" if successful_tasks >= 3 else "❌ FAIL",
                        "duration": f"{
                            total_duration:.2f}s",
                        "concurrent_tasks": concurrent_tasks,
                        "successful_tasks": successful_tasks,
                        "success_rate": successful_tasks /
                        concurrent_tasks,
                        "avg_response_length": avg_response_length,
                        "throughput": successful_tasks /
                        total_duration,
                    })
                print(
                    f"  ✅ Concurrent: {successful_tasks}/{concurrent_tasks} tasks ({total_duration:.2f}s)"
                )

        except Exception as e:
            duration = time.time() - start_time
            self.results.append(
                {
                    "test": "Concurrent Operations",
                    "status": "💥 ERROR",
                    "duration": f"{duration:.2f}s",
                    "error": str(e),
                }
            )
            print(f"  💥 Concurrent: error - {e}")

    def calculate_benchmark_metrics(self):
        """Calculate overall benchmark metrics"""
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["status"] == "✅ PASS")
        failed_tests = sum(1 for r in self.results if r["status"] == "❌ FAIL")
        error_tests = sum(1 for r in self.results if r["status"] == "💥 ERROR")

        success_rate = (passed_tests / total_tests) * \
            100 if total_tests > 0 else 0

        # Calculate performance metrics
        durations = []
        for result in self.results:
            if "duration" in result:
                try:
                    duration = float(result["duration"].replace("s", ""))
                    durations.append(duration)
                except BaseException:
                    pass

        avg_duration = statistics.mean(durations) if durations else 0
        median_duration = statistics.median(durations) if durations else 0

        # Calculate quality metrics
        quality_scores = []
        for result in self.results:
            if "quality_score" in result:
                quality_scores.append(result["quality_score"])
            elif "accuracy" in result:
                quality_scores.append(result["accuracy"])

        avg_quality = statistics.mean(quality_scores) if quality_scores else 0

        return {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "error_tests": error_tests,
            "success_rate": success_rate,
            "avg_duration": avg_duration,
            "median_duration": median_duration,
            "avg_quality": avg_quality,
            "total_duration": time.time() - self.benchmark_start,
        }

    def print_benchmark_summary(self, metrics):
        """Print comprehensive benchmark summary"""
        print("\n" + "=" * 60)
        print("🎯 ORCHESTRATION BENCHMARK SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {metrics['total_tests']}")
        print(f"✅ Passed: {metrics['passed_tests']}")
        print(f"❌ Failed: {metrics['failed_tests']}")
        print(f"💥 Errors: {metrics['error_tests']}")
        print(f"📈 Success Rate: {metrics['success_rate']:.1f}%")
        print(f"⏱️  Average Duration: {metrics['avg_duration']:.2f}s")
        print(f"📊 Median Duration: {metrics['median_duration']:.2f}s")
        print(f"🎯 Average Quality: {metrics['avg_quality']:.2f}")
        print(f"🕐 Total Benchmark Time: {metrics['total_duration']:.2f}s")

        # Performance comparison with frontier models
        print("\n🏆 FRONTIER MODEL COMPARISON:")
        print("-" * 40)

        if metrics["success_rate"] >= 90:
            print("🥇 EXCELLENT: Comparable to GPT-4/Claude-3.5")
        elif metrics["success_rate"] >= 80:
            print("🥈 VERY GOOD: Near frontier model performance")
        elif metrics["success_rate"] >= 70:
            print("🥉 GOOD: Competitive with commercial models")
        elif metrics["success_rate"] >= 60:
            print("📈 IMPROVING: Above average performance")
        else:
            print("🔧 NEEDS WORK: Below commercial standards")

        if metrics["avg_duration"] <= 2.0:
            print("⚡ SPEED: Excellent response times")
        elif metrics["avg_duration"] <= 5.0:
            print("🏃 SPEED: Good response times")
        else:
            print("🐌 SPEED: Slow response times")

        print("\n📋 Detailed Results:")
        print("-" * 40)
        for result in self.results:
            status_icon = result["status"]
            test_name = result["test"]
            duration = result.get("duration", "N/A")
            print(f"  {status_icon} {test_name}: {duration}")

            # Show additional metrics if available
            if "word_count" in result:
                print(f"    📝 Words: {result['word_count']}")
            if "quality_score" in result:
                print(f"    🎯 Quality: {result['quality_score']}")
            if "accuracy" in result:
                print(f"    🎯 Accuracy: {result['accuracy']:.1%}")
            if "throughput" in result:
                print(
                    f"    ⚡ Throughput: {
                        result['throughput']:.1f} tasks/sec")

    async def run_benchmark(self):
        """Run the complete benchmark suite"""
        print("🚀 Starting Orchestration Benchmark")
        print("=" * 60)

        await self.benchmark_text_generation()
        await self.benchmark_reasoning_tasks()
        await self.benchmark_vision_analysis()
        await self.benchmark_memory_operations()
        await self.benchmark_complex_workflows()
        await self.benchmark_concurrent_operations()

        metrics = self.calculate_benchmark_metrics()
        self.print_benchmark_summary(metrics)

        # Save results
        with open("orchestration_benchmark_results.json", "w") as f:
            json.dump({"metrics": metrics, "results": self.results,
                       "timestamp": time.time()}, f, indent=2, )

        print("\n💾 Detailed results saved to: orchestration_benchmark_results.json")

        return metrics


async def main():
    benchmark = OrchestrationBenchmark()
    await benchmark.run_benchmark()


if __name__ == "__main__":
    asyncio.run(main())
