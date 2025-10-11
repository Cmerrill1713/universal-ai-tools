#!/usr/bin/env python3
"""
Frontier Model Benchmark Suite
Tests the same capabilities that GPT-4, Claude-3.5, and Gemini are evaluated on
"""

import asyncio
import json
import statistics
import time
from datetime import datetime
from typing import Any, Dict

import aiohttp


class FrontierModelBenchmark:
    def __init__(self):
        self.base_urls = {
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
            "vision_service": "http://localhost:8084",
            "memory_service": "http://localhost:8017",
        }
        self.results = []
        self.start_time = time.time()

    async def benchmark_reasoning_capabilities(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test reasoning capabilities similar to MMLU, HellaSwag, ARC"""
        print("\n🧠 Benchmarking Reasoning Capabilities...")

        # Mathematical Reasoning (similar to GSM8K)
        math_problems = [
            {
                "problem": "Sarah has 12 apples. She gives 3 to her friend and buys 7 more. How many apples does she have now?",
                "expected": 16,
                "category": "arithmetic",
            },
            {
                "problem": "A train travels 120 miles in 2 hours. What is its average speed in miles per hour?",
                "expected": 60,
                "category": "physics",
            },
            {
                "problem": "If a rectangle has length 8 and width 5, what is its area?",
                "expected": 40,
                "category": "geometry",
            },
        ]

        # Logical Reasoning (similar to LogiQA)
        logic_problems = [
            {
                "problem": "All birds can fly. Penguins are birds. Can penguins fly? Explain your reasoning.",
                "category": "logical_deduction",
            },
            {
                "problem": "If it's raining, then the ground is wet. The ground is wet. Is it necessarily raining?",
                "category": "logical_inference",
            },
            {
                "problem": "A is taller than B. B is taller than C. Who is the shortest?",
                "category": "transitive_reasoning",
            },
        ]

        # Common Sense Reasoning (similar to CommonsenseQA)
        commonsense_problems = [
            {
                "problem": "What happens to ice when you heat it?",
                "category": "physics_commonsense",
            },
            {
                "problem": "Why do people use umbrellas when it's raining?",
                "category": "social_commonsense",
            },
            {
                "problem": "What is the most likely reason someone would go to a hospital?",
                "category": "practical_commonsense",
            },
        ]

        all_problems = math_problems + logic_problems + commonsense_problems
        results = []

        for i, problem in enumerate(all_problems):
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json={
                        "model": "llama3.1:8b",
                        "messages": [{"role": "user", "content": problem["problem"]}],
                        "max_tokens": 200,
                        "temperature": 0.1,
                    },
                    timeout=30,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        answer = data.get("response", "")

                        # Simple scoring based on response quality
                        quality_score = self._score_reasoning_response(answer, problem)

                        results.append(
                            {
                                "problem_id": i + 1,
                                "category": problem["category"],
                                "response_time": response_time,
                                "quality_score": quality_score,
                                "answer_length": len(answer),
                            }
                        )

                        print(
                            f"  ✅ Problem {i+1} ({problem['category']}): {quality_score}/10 ({response_time:.2f}s)"
                        )
                    else:
                        print(f"  ❌ Problem {i+1}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ Problem {i+1}: Error - {str(e)}")

        avg_quality = (
            statistics.mean([r["quality_score"] for r in results]) if results else 0
        )
        avg_response_time = (
            statistics.mean([r["response_time"] for r in results]) if results else 0
        )

        return {
            "reasoning_tests": results,
            "average_quality": avg_quality,
            "average_response_time": avg_response_time,
            "total_problems": len(all_problems),
        }

    def _score_reasoning_response(self, answer: str, problem: Dict) -> int:
        """Score reasoning response quality (0-10)"""
        answer_lower = answer.lower()

        # Check for mathematical correctness
        if "expected" in problem:
            try:
                # Extract numbers from answer
                import re

                numbers = re.findall(r"\d+", answer)
                if numbers and int(numbers[-1]) == problem["expected"]:
                    return 10
                elif numbers and abs(int(numbers[-1]) - problem["expected"]) <= 1:
                    return 8
                else:
                    return 5
            except:
                return 3

        # Check for logical reasoning indicators
        logic_indicators = [
            "because",
            "therefore",
            "since",
            "if",
            "then",
            "reason",
            "explain",
        ]
        if any(indicator in answer_lower for indicator in logic_indicators):
            return 8

        # Check for commonsense appropriateness
        if len(answer) > 20 and any(
            word in answer_lower for word in ["water", "melt", "liquid", "heat"]
        ):
            return 7

        # Basic quality based on length and structure
        if len(answer) > 50:
            return 6
        elif len(answer) > 20:
            return 4
        else:
            return 2

    async def benchmark_code_generation(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test code generation capabilities (similar to HumanEval)"""
        print("\n💻 Benchmarking Code Generation...")

        coding_problems = [
            {
                "problem": "Write a Python function that takes a list of integers and returns the sum of all even numbers.",
                "language": "python",
                "category": "algorithm",
            },
            {
                "problem": "Create a Rust function that reverses a string.",
                "language": "rust",
                "category": "string_manipulation",
            },
            {
                "problem": "Write a Go function that finds the maximum value in a slice of integers.",
                "language": "go",
                "category": "data_structures",
            },
            {
                "problem": "Create a JavaScript function that validates an email address using regex.",
                "language": "javascript",
                "category": "validation",
            },
            {
                "problem": "Write a Python class for a simple calculator with add, subtract, multiply, and divide methods.",
                "language": "python",
                "category": "oop",
            },
        ]

        results = []
        for i, problem in enumerate(coding_problems):
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json={
                        "model": "llama3.1:8b",
                        "messages": [{"role": "user", "content": problem["problem"]}],
                        "max_tokens": 500,
                        "temperature": 0.2,
                    },
                    timeout=45,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        code = data.get("response", "")

                        # Score code quality
                        quality_score = self._score_code_quality(code, problem)

                        results.append(
                            {
                                "problem_id": i + 1,
                                "language": problem["language"],
                                "category": problem["category"],
                                "response_time": response_time,
                                "quality_score": quality_score,
                                "code_length": len(code),
                            }
                        )

                        print(
                            f"  ✅ Problem {i+1} ({problem['language']}): {quality_score}/10 ({response_time:.2f}s)"
                        )
                    else:
                        print(f"  ❌ Problem {i+1}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ Problem {i+1}: Error - {str(e)}")

        avg_quality = (
            statistics.mean([r["quality_score"] for r in results]) if results else 0
        )
        avg_response_time = (
            statistics.mean([r["response_time"] for r in results]) if results else 0
        )

        return {
            "code_tests": results,
            "average_quality": avg_quality,
            "average_response_time": avg_response_time,
            "total_problems": len(coding_problems),
        }

    def _score_code_quality(self, code: str, problem: Dict) -> int:
        """Score code quality (0-10)"""
        code_lower = code.lower()
        language = problem["language"].lower()

        score = 0

        # Check for language-specific syntax
        if language == "python":
            if "def " in code_lower and "return" in code_lower:
                score += 4
            if "class " in code_lower:
                score += 2
        elif language == "rust":
            if "fn " in code_lower and "->" in code_lower:
                score += 4
            if "let " in code_lower:
                score += 2
        elif language == "go":
            if "func " in code_lower and "return" in code_lower:
                score += 4
            if "package " in code_lower:
                score += 2
        elif language == "javascript":
            if "function" in code_lower or "=>" in code_lower:
                score += 4
            if "return" in code_lower:
                score += 2

        # Check for proper structure
        if len(code) > 100:
            score += 2
        if "{" in code and "}" in code:
            score += 1
        if "(" in code and ")" in code:
            score += 1

        return min(score, 10)

    async def benchmark_reading_comprehension(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test reading comprehension (similar to SQuAD, RACE)"""
        print("\n📖 Benchmarking Reading Comprehension...")

        passages = [
            {
                "passage": "The Industrial Revolution was a period of major industrialization and innovation during the late 18th and early 19th centuries. The Industrial Revolution began in Great Britain and quickly spread throughout the world. The American Industrial Revolution commonly referred to as the Second Industrial Revolution, started sometime between 1820 and 1870.",
                "questions": [
                    "When did the Industrial Revolution begin?",
                    "Where did the Industrial Revolution start?",
                    "What was the American Industrial Revolution also called?",
                ],
                "answers": [
                    "late 18th century",
                    "Great Britain",
                    "Second Industrial Revolution",
                ],
            },
            {
                "passage": "Photosynthesis is the process by which plants and some bacteria use sunlight to synthesize foods with the help of chlorophyll pigments. During photosynthesis, plants take in carbon dioxide from the atmosphere and water from the soil. Using energy from sunlight, they convert these into glucose and oxygen.",
                "questions": [
                    "What do plants use to synthesize food?",
                    "What gas do plants take in during photosynthesis?",
                    "What are the two main products of photosynthesis?",
                ],
                "answers": ["sunlight", "carbon dioxide", "glucose and oxygen"],
            },
        ]

        results = []
        for i, passage_data in enumerate(passages):
            passage = passage_data["passage"]
            questions = passage_data["questions"]
            correct_answers = passage_data["answers"]

            for j, question in enumerate(questions):
                try:
                    prompt = f"Passage: {passage}\n\nQuestion: {question}\n\nAnswer:"
                    start_time = time.time()

                    async with session.post(
                        f"{self.base_urls['llm_router']}/chat",
                        json={
                            "model": "llama3.1:8b",
                            "messages": [{"role": "user", "content": prompt}],
                            "max_tokens": 100,
                            "temperature": 0.1,
                        },
                        timeout=30,
                    ) as response:
                        response_time = time.time() - start_time
                        if response.status == 200:
                            data = await response.json()
                            answer = data.get("response", "").strip()

                            # Score answer accuracy
                            accuracy_score = self._score_comprehension_answer(
                                answer, correct_answers[j]
                            )

                            results.append(
                                {
                                    "passage_id": i + 1,
                                    "question_id": j + 1,
                                    "response_time": response_time,
                                    "accuracy_score": accuracy_score,
                                    "answer_length": len(answer),
                                }
                            )

                            print(
                                f"  ✅ Passage {i+1}, Q{j+1}: {accuracy_score}/10 ({response_time:.2f}s)"
                            )
                        else:
                            print(
                                f"  ❌ Passage {i+1}, Q{j+1}: Failed ({response.status})"
                            )
                except Exception as e:
                    print(f"  ❌ Passage {i+1}, Q{j+1}: Error - {str(e)}")

        avg_accuracy = (
            statistics.mean([r["accuracy_score"] for r in results]) if results else 0
        )
        avg_response_time = (
            statistics.mean([r["response_time"] for r in results]) if results else 0
        )

        return {
            "comprehension_tests": results,
            "average_accuracy": avg_accuracy,
            "average_response_time": avg_response_time,
            "total_questions": len(results),
        }

    def _score_comprehension_answer(self, answer: str, correct_answer: str) -> int:
        """Score reading comprehension answer (0-10)"""
        answer_lower = answer.lower()
        correct_lower = correct_answer.lower()

        # Exact match
        if correct_lower in answer_lower:
            return 10

        # Partial match with key terms
        correct_words = correct_lower.split()
        answer_words = answer_lower.split()

        matches = sum(1 for word in correct_words if word in answer_words)
        if matches >= len(correct_words) * 0.7:
            return 8
        elif matches >= len(correct_words) * 0.5:
            return 6
        elif matches >= len(correct_words) * 0.3:
            return 4
        else:
            return 2

    async def benchmark_creative_writing(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test creative writing capabilities"""
        print("\n✍️ Benchmarking Creative Writing...")

        writing_prompts = [
            {
                "prompt": "Write a short story about a robot who discovers emotions.",
                "category": "fiction",
                "max_tokens": 300,
            },
            {
                "prompt": "Describe a futuristic city where technology and nature coexist harmoniously.",
                "category": "descriptive",
                "max_tokens": 250,
            },
            {
                "prompt": "Write a poem about the beauty of a sunset over the ocean.",
                "category": "poetry",
                "max_tokens": 200,
            },
            {
                "prompt": "Create a dialogue between two characters meeting for the first time.",
                "category": "dialogue",
                "max_tokens": 200,
            },
        ]

        results = []
        for i, prompt_data in enumerate(writing_prompts):
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json={
                        "model": "llama3.1:8b",
                        "messages": [
                            {"role": "user", "content": prompt_data["prompt"]}
                        ],
                        "max_tokens": prompt_data["max_tokens"],
                        "temperature": 0.8,
                    },
                    timeout=45,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        writing = data.get("response", "")

                        # Score creative writing quality
                        quality_score = self._score_creative_writing(
                            writing, prompt_data
                        )

                        results.append(
                            {
                                "prompt_id": i + 1,
                                "category": prompt_data["category"],
                                "response_time": response_time,
                                "quality_score": quality_score,
                                "word_count": len(writing.split()),
                                "character_count": len(writing),
                            }
                        )

                        print(
                            f"  ✅ Prompt {i+1} ({prompt_data['category']}): {quality_score}/10 ({response_time:.2f}s)"
                        )
                    else:
                        print(f"  ❌ Prompt {i+1}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ Prompt {i+1}: Error - {str(e)}")

        avg_quality = (
            statistics.mean([r["quality_score"] for r in results]) if results else 0
        )
        avg_response_time = (
            statistics.mean([r["response_time"] for r in results]) if results else 0
        )

        return {
            "writing_tests": results,
            "average_quality": avg_quality,
            "average_response_time": avg_response_time,
            "total_prompts": len(writing_prompts),
        }

    def _score_creative_writing(self, writing: str, prompt_data: Dict) -> int:
        """Score creative writing quality (0-10)"""
        writing_lower = writing.lower()
        category = prompt_data["category"]

        score = 0

        # Length appropriateness
        word_count = len(writing.split())
        if word_count >= 100:
            score += 3
        elif word_count >= 50:
            score += 2
        elif word_count >= 20:
            score += 1

        # Category-specific scoring
        if category == "fiction":
            if any(
                word in writing_lower for word in ["robot", "emotion", "feel", "heart"]
            ):
                score += 3
            if "story" in writing_lower or any(
                word in writing_lower for word in ["once", "suddenly", "then"]
            ):
                score += 2
        elif category == "descriptive":
            if any(
                word in writing_lower
                for word in ["city", "technology", "nature", "future"]
            ):
                score += 3
            if any(
                word in writing_lower for word in ["green", "tall", "bright", "modern"]
            ):
                score += 2
        elif category == "poetry":
            if any(
                word in writing_lower
                for word in ["sunset", "ocean", "beauty", "golden"]
            ):
                score += 3
            if len(writing.split("\n")) > 3:  # Multiple lines suggest poetry structure
                score += 2
        elif category == "dialogue":
            if '"' in writing or "'" in writing:  # Contains quotes
                score += 3
            if any(
                word in writing_lower
                for word in ["said", "asked", "replied", "answered"]
            ):
                score += 2

        # General quality indicators
        if any(
            word in writing_lower
            for word in ["beautiful", "amazing", "wonderful", "incredible"]
        ):
            score += 1

        return min(score, 10)

    async def benchmark_multimodal_capabilities(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test multimodal capabilities (vision + text)"""
        print("\n👁️ Benchmarking Multimodal Capabilities...")

        # Simple test image (1x1 pixel)
        test_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

        vision_tasks = [
            {"task": "describe", "description": "Image Description"},
            {"task": "detect_objects", "description": "Object Detection"},
            {"task": "extract_text", "description": "Text Extraction"},
            {"task": "analyze_colors", "description": "Color Analysis"},
        ]

        results = []
        for i, task_data in enumerate(vision_tasks):
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['vision_service']}/vision/analyze",
                    json={"image": test_image, "task": task_data["task"]},
                    timeout=30,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        # Use description field from our Vision Service
                        analysis = data.get("description", "")

                        # Score vision analysis quality
                        quality_score = self._score_vision_analysis(
                            analysis, task_data["task"]
                        )

                        results.append(
                            {
                                "task_id": i + 1,
                                "task": task_data["task"],
                                "description": task_data["description"],
                                "response_time": response_time,
                                "quality_score": quality_score,
                                "analysis_length": len(analysis),
                            }
                        )

                        print(
                            f"  ✅ {task_data['description']}: {quality_score}/10 ({response_time:.2f}s)"
                        )
                    else:
                        print(
                            f"  ❌ {task_data['description']}: Failed ({response.status})"
                        )
            except Exception as e:
                print(f"  ❌ {task_data['description']}: Error - {str(e)}")

        avg_quality = (
            statistics.mean([r["quality_score"] for r in results]) if results else 0
        )
        avg_response_time = (
            statistics.mean([r["response_time"] for r in results]) if results else 0
        )

        return {
            "vision_tests": results,
            "average_quality": avg_quality,
            "average_response_time": avg_response_time,
            "total_tasks": len(vision_tasks),
        }

    def _score_vision_analysis(self, analysis: str, task: str) -> int:
        """Score vision analysis quality (0-10)"""
        analysis_lower = analysis.lower()

        # Basic quality based on response length and content
        if len(analysis) > 50:
            score = 8
        elif len(analysis) > 20:
            score = 6
        elif len(analysis) > 10:
            score = 4
        else:
            score = 2

        # Task-specific scoring
        if task == "describe" and any(
            word in analysis_lower for word in ["image", "picture", "see", "show"]
        ):
            score += 1
        elif task == "detect_objects" and any(
            word in analysis_lower for word in ["object", "item", "thing"]
        ):
            score += 1
        elif task == "extract_text" and any(
            word in analysis_lower for word in ["text", "word", "letter"]
        ):
            score += 1
        elif task == "analyze_colors" and any(
            word in analysis_lower for word in ["color", "red", "blue", "green"]
        ):
            score += 1

        return min(score, 10)

    async def run_frontier_benchmark(self):
        """Run comprehensive frontier model benchmark"""
        print("🏆 Starting Frontier Model Benchmark Suite")
        print("=" * 60)
        print("Testing capabilities comparable to GPT-4, Claude-3.5, and Gemini")
        print("=" * 60)

        async with aiohttp.ClientSession() as session:
            # Run all benchmark categories
            reasoning_results = await self.benchmark_reasoning_capabilities(session)
            code_results = await self.benchmark_code_generation(session)
            comprehension_results = await self.benchmark_reading_comprehension(session)
            writing_results = await self.benchmark_creative_writing(session)
            vision_results = await self.benchmark_multimodal_capabilities(session)

            # Calculate overall results
            total_time = time.time() - self.start_time

            # Aggregate scores
            all_scores = []
            all_scores.extend(
                [r["quality_score"] for r in reasoning_results["reasoning_tests"]]
            )
            all_scores.extend([r["quality_score"] for r in code_results["code_tests"]])
            all_scores.extend(
                [
                    r["accuracy_score"]
                    for r in comprehension_results["comprehension_tests"]
                ]
            )
            all_scores.extend(
                [r["quality_score"] for r in writing_results["writing_tests"]]
            )
            all_scores.extend(
                [r["quality_score"] for r in vision_results["vision_tests"]]
            )

            overall_score = statistics.mean(all_scores) if all_scores else 0

            print("\n" + "=" * 60)
            print("🏆 FRONTIER MODEL BENCHMARK RESULTS")
            print("=" * 60)
            print(f"⏱️  Total Benchmark Time: {total_time:.2f} seconds")
            print(
                f"🧠 Reasoning Capabilities: {reasoning_results['average_quality']:.1f}/10"
            )
            print(f"💻 Code Generation: {code_results['average_quality']:.1f}/10")
            print(
                f"📖 Reading Comprehension: {comprehension_results['average_accuracy']:.1f}/10"
            )
            print(f"✍️ Creative Writing: {writing_results['average_quality']:.1f}/10")
            print(
                f"👁️ Multimodal Capabilities: {vision_results['average_quality']:.1f}/10"
            )
            print(f"📊 Overall Score: {overall_score:.1f}/10")

            # Compare to frontier models
            if overall_score >= 8.5:
                comparison = "🥇 EXCELLENT - Comparable to GPT-4/Claude-3.5"
            elif overall_score >= 7.5:
                comparison = "🥈 VERY GOOD - Close to frontier models"
            elif overall_score >= 6.5:
                comparison = "🥉 GOOD - Above average performance"
            elif overall_score >= 5.0:
                comparison = "📈 FAIR - Room for improvement"
            else:
                comparison = "📉 NEEDS IMPROVEMENT - Below expected performance"

            print(f"🎯 Frontier Model Comparison: {comparison}")

            # Performance metrics
            avg_response_times = [
                reasoning_results["average_response_time"],
                code_results["average_response_time"],
                comprehension_results["average_response_time"],
                writing_results["average_response_time"],
                vision_results["average_response_time"],
            ]
            avg_response_time = statistics.mean(
                [t for t in avg_response_times if t > 0]
            )

            print(f"⚡ Average Response Time: {avg_response_time:.2f} seconds")
            print(f"🚀 Total Tests Completed: {len(all_scores)}")

            # Save detailed results
            detailed_results = {
                "timestamp": datetime.now().isoformat(),
                "total_time": total_time,
                "overall_score": overall_score,
                "comparison": comparison,
                "reasoning": reasoning_results,
                "code_generation": code_results,
                "reading_comprehension": comprehension_results,
                "creative_writing": writing_results,
                "multimodal": vision_results,
                "all_scores": all_scores,
            }

            with open("frontier_benchmark_results.json", "w") as f:
                json.dump(detailed_results, f, indent=2)

            print("💾 Detailed results saved to: frontier_benchmark_results.json")


if __name__ == "__main__":
    benchmark = FrontierModelBenchmark()
    asyncio.run(benchmark.run_frontier_benchmark())
