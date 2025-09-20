#!/usr/bin/env python3
"""
Specialized Frontier Model Benchmark
Tests specific capabilities that frontier models excel at
"""

import asyncio
import json
import statistics
import time
from datetime import datetime
from typing import Any, Dict

import aiohttp


class SpecializedFrontierBenchmark:
    def __init__(self):
        self.base_urls = {
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
        }
        self.start_time = time.time()

    async def benchmark_mathematical_reasoning(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test mathematical reasoning (GSM8K style)"""
        print("\n🔢 Benchmarking Mathematical Reasoning (GSM8K Style)...")

        math_problems = [
            {
                "problem": "James has 12 apples. He gives 4 apples to his friend and buys 8 more apples. How many apples does James have now?",
                "expected": 16,
                "steps": 3,
            },
            {
                "problem": "A store sells 3 types of candy. Type A costs $2, Type B costs $3, and Type C costs $4. If Sarah buys 2 of Type A, 3 of Type B, and 1 of Type C, how much does she spend?",
                "expected": 17,
                "steps": 4,
            },
            {
                "problem": "A train travels 240 miles in 4 hours. What is its average speed in miles per hour?",
                "expected": 60,
                "steps": 2,
            },
            {
                "problem": "Tom has 24 marbles. He gives 1/3 of them to his brother and 1/4 of them to his sister. How many marbles does Tom have left?",
                "expected": 10,
                "steps": 4,
            },
            {
                "problem": "A rectangle has a length of 12 cm and a width of 8 cm. What is its perimeter?",
                "expected": 40,
                "steps": 2,
            },
        ]

        results = []
        for i, problem in enumerate(math_problems):
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json={
                        "model": "llama3.1:8b",
                        "messages": [{"role": "user", "content": problem["problem"]}],
                        "max_tokens": 300,
                        "temperature": 0.1,
                    },
                    timeout=30,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        answer = data.get("response", "")

                        # Score mathematical reasoning
                        score = self._score_math_reasoning(answer, problem)

                        results.append(
                            {
                                "problem_id": i + 1,
                                "response_time": response_time,
                                "score": score,
                                "answer_length": len(answer),
                                "expected": problem["expected"],
                            }
                        )

                        print(
                            f"  ✅ Problem {i+1}: {score}/10 ({response_time:.2f}s) - Expected: {problem['expected']}"
                        )
                    else:
                        print(f"  ❌ Problem {i+1}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ Problem {i+1}: Error - {str(e)}")

        avg_score = statistics.mean([r["score"] for r in results]) if results else 0
        return {"math_tests": results, "average_score": avg_score}

    def _score_math_reasoning(self, answer: str, problem: Dict) -> int:
        """Score mathematical reasoning (0-10)"""
        import re

        # Extract numbers from answer
        numbers = re.findall(r"\d+", answer)

        if not numbers:
            return 0

        try:
            # Check if the last number matches expected answer
            last_number = int(numbers[-1])
            if last_number == problem["expected"]:
                return 10
            elif abs(last_number - problem["expected"]) <= 1:
                return 8
            elif abs(last_number - problem["expected"]) <= 2:
                return 6
            else:
                return 3
        except:
            return 2

    async def benchmark_coding_problems(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test coding problems (HumanEval style)"""
        print("\n💻 Benchmarking Coding Problems (HumanEval Style)...")

        coding_problems = [
            {
                "problem": "Write a Python function that takes a list of integers and returns the sum of all even numbers.",
                "test_cases": [
                    {"input": "[1, 2, 3, 4, 5]", "expected": 6},
                    {"input": "[2, 4, 6, 8]", "expected": 20},
                    {"input": "[1, 3, 5]", "expected": 0},
                ],
                "language": "python",
            },
            {
                "problem": "Write a function that takes a string and returns the number of vowels in it.",
                "test_cases": [
                    {"input": "'hello'", "expected": 2},
                    {"input": "'programming'", "expected": 3},
                    {"input": "'xyz'", "expected": 0},
                ],
                "language": "python",
            },
            {
                "problem": "Write a function that finds the second largest number in a list.",
                "test_cases": [
                    {"input": "[1, 2, 3, 4, 5]", "expected": 4},
                    {"input": "[5, 2, 8, 1, 9]", "expected": 8},
                    {"input": "[1, 1, 1]", "expected": 1},
                ],
                "language": "python",
            },
            {
                "problem": "Write a function that checks if a string is a palindrome.",
                "test_cases": [
                    {"input": "'racecar'", "expected": True},
                    {"input": "'hello'", "expected": False},
                    {"input": "'a'", "expected": True},
                ],
                "language": "python",
            },
            {
                "problem": "Write a function that calculates the factorial of a number.",
                "test_cases": [
                    {"input": "5", "expected": 120},
                    {"input": "3", "expected": 6},
                    {"input": "0", "expected": 1},
                ],
                "language": "python",
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
                        "temperature": 0.1,
                    },
                    timeout=45,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        code = data.get("response", "")

                        # Score code quality
                        score = self._score_code_quality(code, problem)

                        results.append(
                            {
                                "problem_id": i + 1,
                                "response_time": response_time,
                                "score": score,
                                "code_length": len(code),
                                "language": problem["language"],
                            }
                        )

                        print(f"  ✅ Problem {i+1}: {score}/10 ({response_time:.2f}s)")
                    else:
                        print(f"  ❌ Problem {i+1}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ Problem {i+1}: Error - {str(e)}")

        avg_score = statistics.mean([r["score"] for r in results]) if results else 0
        return {"coding_tests": results, "average_score": avg_score}

    def _score_code_quality(self, code: str, problem: Dict) -> int:
        """Score code quality (0-10)"""
        code_lower = code.lower()
        score = 0

        # Check for function definition
        if "def " in code_lower:
            score += 3

        # Check for return statement
        if "return" in code_lower:
            score += 2

        # Check for proper indentation (basic check)
        if "    " in code or "\t" in code:
            score += 1

        # Check for appropriate length
        if len(code) > 100:
            score += 2
        elif len(code) > 50:
            score += 1

        # Check for language-specific syntax
        if problem["language"] == "python":
            if ":" in code and (
                "if" in code_lower or "for" in code_lower or "while" in code_lower
            ):
                score += 2

        return min(score, 10)

    async def benchmark_reasoning_chains(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test multi-step reasoning (Chain-of-Thought style)"""
        print("\n🔗 Benchmarking Multi-Step Reasoning...")

        reasoning_problems = [
            {
                "problem": "If all roses are flowers and some flowers are red, can we conclude that some roses are red? Explain your reasoning step by step.",
                "category": "logical_reasoning",
            },
            {
                "problem": "A farmer has 17 sheep. All but 9 die. How many sheep are left? Explain your reasoning.",
                "category": "word_problem",
            },
            {
                "problem": "If it takes 5 machines 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets? Explain your reasoning.",
                "category": "logical_puzzle",
            },
            {
                "problem": "What comes next in this sequence: 2, 4, 8, 16, ? Explain your reasoning.",
                "category": "pattern_recognition",
            },
            {
                "problem": "If a bat and ball cost $1.10 together and the bat costs $1.00 more than the ball, how much does the ball cost? Explain your reasoning.",
                "category": "algebraic_reasoning",
            },
        ]

        results = []
        for i, problem in enumerate(reasoning_problems):
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json={
                        "model": "llama3.1:8b",
                        "messages": [{"role": "user", "content": problem["problem"]}],
                        "max_tokens": 400,
                        "temperature": 0.2,
                    },
                    timeout=45,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        answer = data.get("response", "")

                        # Score reasoning quality
                        score = self._score_reasoning_chain(answer, problem)

                        results.append(
                            {
                                "problem_id": i + 1,
                                "category": problem["category"],
                                "response_time": response_time,
                                "score": score,
                                "answer_length": len(answer),
                            }
                        )

                        print(
                            f"  ✅ Problem {i+1} ({problem['category']}): {score}/10 ({response_time:.2f}s)"
                        )
                    else:
                        print(f"  ❌ Problem {i+1}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ Problem {i+1}: Error - {str(e)}")

        avg_score = statistics.mean([r["score"] for r in results]) if results else 0
        return {"reasoning_tests": results, "average_score": avg_score}

    def _score_reasoning_chain(self, answer: str, problem: Dict) -> int:
        """Score reasoning chain quality (0-10)"""
        answer_lower = answer.lower()
        score = 0

        # Check for step-by-step reasoning indicators
        reasoning_indicators = [
            "first",
            "second",
            "third",
            "step",
            "therefore",
            "because",
            "since",
            "if",
            "then",
        ]
        if any(indicator in answer_lower for indicator in reasoning_indicators):
            score += 3

        # Check for explanation quality
        if "explain" in answer_lower or "reasoning" in answer_lower:
            score += 2

        # Check for appropriate length (shows detailed reasoning)
        if len(answer) > 200:
            score += 3
        elif len(answer) > 100:
            score += 2
        elif len(answer) > 50:
            score += 1

        # Category-specific scoring
        if problem["category"] == "logical_reasoning":
            if any(
                word in answer_lower
                for word in ["conclude", "conclusion", "valid", "invalid"]
            ):
                score += 2
        elif problem["category"] == "word_problem":
            if any(
                word in answer_lower for word in ["left", "remaining", "die", "alive"]
            ):
                score += 2
        elif problem["category"] == "pattern_recognition":
            if any(
                word in answer_lower for word in ["pattern", "sequence", "next", "32"]
            ):
                score += 2

        return min(score, 10)

    async def benchmark_knowledge_retrieval(
        self, session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Test knowledge retrieval and factual accuracy"""
        print("\n📚 Benchmarking Knowledge Retrieval...")

        knowledge_questions = [
            {
                "question": "What is the capital of France?",
                "expected": "Paris",
                "category": "geography",
            },
            {
                "question": "Who wrote 'To Kill a Mockingbird'?",
                "expected": "Harper Lee",
                "category": "literature",
            },
            {
                "question": "What is the chemical symbol for gold?",
                "expected": "Au",
                "category": "science",
            },
            {
                "question": "In what year did World War II end?",
                "expected": "1945",
                "category": "history",
            },
            {
                "question": "What is the largest planet in our solar system?",
                "expected": "Jupiter",
                "category": "astronomy",
            },
            {
                "question": "Who painted the Mona Lisa?",
                "expected": "Leonardo da Vinci",
                "category": "art",
            },
        ]

        results = []
        for i, question in enumerate(knowledge_questions):
            try:
                start_time = time.time()
                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json={
                        "model": "llama3.1:8b",
                        "messages": [{"role": "user", "content": question["question"]}],
                        "max_tokens": 100,
                        "temperature": 0.1,
                    },
                    timeout=30,
                ) as response:
                    response_time = time.time() - start_time
                    if response.status == 200:
                        data = await response.json()
                        answer = data.get("response", "")

                        # Score factual accuracy
                        score = self._score_factual_accuracy(answer, question)

                        results.append(
                            {
                                "question_id": i + 1,
                                "category": question["category"],
                                "response_time": response_time,
                                "score": score,
                                "answer_length": len(answer),
                                "expected": question["expected"],
                            }
                        )

                        print(
                            f"  ✅ Q{i+1} ({question['category']}): {score}/10 ({response_time:.2f}s) - Expected: {question['expected']}"
                        )
                    else:
                        print(f"  ❌ Q{i+1}: Failed ({response.status})")
            except Exception as e:
                print(f"  ❌ Q{i+1}: Error - {str(e)}")

        avg_score = statistics.mean([r["score"] for r in results]) if results else 0
        return {"knowledge_tests": results, "average_score": avg_score}

    def _score_factual_accuracy(self, answer: str, question: Dict) -> int:
        """Score factual accuracy (0-10)"""
        answer_lower = answer.lower()
        expected_lower = question["expected"].lower()

        # Exact match
        if expected_lower in answer_lower:
            return 10

        # Partial match
        expected_words = expected_lower.split()
        answer_words = answer_lower.split()

        matches = sum(1 for word in expected_words if word in answer_words)
        if matches >= len(expected_words) * 0.8:
            return 8
        elif matches >= len(expected_words) * 0.6:
            return 6
        elif matches >= len(expected_words) * 0.4:
            return 4
        else:
            return 2

    async def run_specialized_benchmark(self):
        """Run specialized frontier model benchmark"""
        print("🎯 Starting Specialized Frontier Model Benchmark")
        print("=" * 60)
        print("Testing specific capabilities that frontier models excel at")
        print("=" * 60)

        async with aiohttp.ClientSession() as session:
            # Run specialized benchmarks
            math_results = await self.benchmark_mathematical_reasoning(session)
            coding_results = await self.benchmark_coding_problems(session)
            reasoning_results = await self.benchmark_reasoning_chains(session)
            knowledge_results = await self.benchmark_knowledge_retrieval(session)

            # Calculate overall results
            total_time = time.time() - self.start_time

            # Aggregate scores
            all_scores = []
            all_scores.extend([r["score"] for r in math_results["math_tests"]])
            all_scores.extend([r["score"] for r in coding_results["coding_tests"]])
            all_scores.extend(
                [r["score"] for r in reasoning_results["reasoning_tests"]]
            )
            all_scores.extend(
                [r["score"] for r in knowledge_results["knowledge_tests"]]
            )

            overall_score = statistics.mean(all_scores) if all_scores else 0

            print("\n" + "=" * 60)
            print("🎯 SPECIALIZED FRONTIER BENCHMARK RESULTS")
            print("=" * 60)
            print(f"⏱️  Total Benchmark Time: {total_time:.2f} seconds")
            print(f"🔢 Mathematical Reasoning: {math_results['average_score']:.1f}/10")
            print(f"💻 Coding Problems: {coding_results['average_score']:.1f}/10")
            print(
                f"🔗 Multi-Step Reasoning: {reasoning_results['average_score']:.1f}/10"
            )
            print(
                f"📚 Knowledge Retrieval: {knowledge_results['average_score']:.1f}/10"
            )
            print(f"📊 Overall Score: {overall_score:.1f}/10")

            # Compare to frontier models
            if overall_score >= 8.5:
                comparison = "🥇 EXCELLENT - Matches GPT-4/Claude-3.5 performance"
            elif overall_score >= 7.5:
                comparison = "🥈 VERY GOOD - Close to frontier model performance"
            elif overall_score >= 6.5:
                comparison = "🥉 GOOD - Above average performance"
            elif overall_score >= 5.0:
                comparison = "📈 FAIR - Room for improvement"
            else:
                comparison = "📉 NEEDS IMPROVEMENT - Below expected performance"

            print(f"🎯 Frontier Model Comparison: {comparison}")

            # Performance metrics
            avg_response_times = [
                math_results["average_score"],  # Using score as proxy for response time
                coding_results["average_score"],
                reasoning_results["average_score"],
                knowledge_results["average_score"],
            ]

            print(f"🚀 Total Tests Completed: {len(all_scores)}")

            # Save detailed results
            detailed_results = {
                "timestamp": datetime.now().isoformat(),
                "total_time": total_time,
                "overall_score": overall_score,
                "comparison": comparison,
                "mathematical_reasoning": math_results,
                "coding_problems": coding_results,
                "multi_step_reasoning": reasoning_results,
                "knowledge_retrieval": knowledge_results,
                "all_scores": all_scores,
            }

            with open("specialized_frontier_benchmark_results.json", "w") as f:
                json.dump(detailed_results, f, indent=2)

            print(
                "💾 Detailed results saved to: specialized_frontier_benchmark_results.json"
            )


if __name__ == "__main__":
    benchmark = SpecializedFrontierBenchmark()
    asyncio.run(benchmark.run_specialized_benchmark())
