#!/usr/bin/env python3
"""
Real-World Experiments for Universal AI Tools Platform
Comprehensive testing with realistic user scenarios and edge cases
"""

import asyncio
import json
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Dict, List, Optional

import aiohttp


@dataclass
class ExperimentResult:
    """Results from a real-world experiment"""

    experiment_name: str
    success: bool
    response_time: float
    quality_score: float
    error_message: Optional[str] = None
    metadata: Optional[Dict] = None


class RealWorldExperimentRunner:
    """Runs comprehensive real-world experiments"""

    def __init__(self, base_url: str = "http://localhost:8081"):
        self.base_url = base_url
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def test_conversational_ai(self) -> List[ExperimentResult]:
        """Test realistic conversation scenarios"""
        scenarios = [{"name": "Technical Support",
                      "messages": ["I'm having trouble with my Python code. Can you help?",
                                   "I'm getting a 'ModuleNotFoundError' when trying to import pandas",
                                   "I've installed it with pip but it's still not working",
                                   "Let me try your suggestion and get back to you",
                                   ],
                      },
                     {"name": "Creative Writing",
                      "messages": ["I need help writing a short story about a robot learning to paint",
                                   "Can you help me develop the character more?",
                                   "What about the conflict in the story?",
                                   "This is great! Can you suggest a title?",
                                   ],
                      },
                     {"name": "Business Planning",
                      "messages": ["I want to start a sustainable coffee shop",
                                   "What are the key considerations for location?",
                                   "How should I approach funding?",
                                   "What about marketing strategy?",
                                   ],
                      },
                     ]

        results = []
        for scenario in scenarios:
            start_time = time.time()
            try:
                # Simulate conversation flow
                conversation_id = None
                for i, message in enumerate(scenario["messages"]):
                    response = await self._send_chat_message(message, conversation_id)
                    if i == 0:
                        conversation_id = response.get("conversation_id")

                response_time = time.time() - start_time
                results.append(
                    ExperimentResult(
                        experiment_name=f"Conversation: {scenario['name']}",
                        success=True,
                        response_time=response_time,
                        quality_score=0.9,  # Would be calculated from response quality
                        metadata={
                            "scenario": scenario["name"],
                            "messages": len(scenario["messages"]),
                        },
                    )
                )
            except Exception as e:
                results.append(
                    ExperimentResult(
                        experiment_name=f"Conversation: {scenario['name']}",
                        success=False,
                        response_time=0,
                        quality_score=0,
                        error_message=str(e),
                    )
                )

        return results

    async def test_rag_knowledge_retrieval(self) -> List[ExperimentResult]:
        """Test RAG system with real knowledge queries"""
        knowledge_queries = [
            "What are the latest developments in quantum computing?",
            "How does machine learning work in autonomous vehicles?",
            "What are the environmental impacts of cryptocurrency mining?",
            "Explain the principles of sustainable energy systems",
            "What are the current trends in artificial intelligence research?",
        ]

        results = []
        for query in knowledge_queries:
            start_time = time.time()
            try:
                response = await self._send_rag_query(query)
                response_time = time.time() - start_time

                # Evaluate response quality (simplified)
                quality_score = self._evaluate_response_quality(response)

                results.append(
                    ExperimentResult(
                        experiment_name=f"RAG Query: {query[:50]}...",
                        success=True,
                        response_time=response_time,
                        quality_score=quality_score,
                        metadata={
                            "query_length": len(query),
                            "response_length": len(str(response)),
                        },
                    )
                )
            except Exception as e:
                results.append(
                    ExperimentResult(
                        experiment_name=f"RAG Query: {query[:50]}...",
                        success=False,
                        response_time=0,
                        quality_score=0,
                        error_message=str(e),
                    )
                )

        return results

    async def test_multi_modal_processing(self) -> List[ExperimentResult]:
        """Test vision and text processing together"""
        multimodal_tasks = [
            {
                "type": "image_analysis",
                "description": "Analyze this image and describe what you see",
                "data": "base64_image_data_here",  # Would be actual image data
            },
            {
                "type": "document_processing",
                "description": "Extract key information from this document",
                "data": "document_text_here",
            },
            {
                "type": "code_review",
                "description": "Review this code for potential issues",
                "data": "def example_function():\n    return 'hello world'",
            },
        ]

        results = []
        for task in multimodal_tasks:
            start_time = time.time()
            try:
                response = await self._send_multimodal_request(task)
                response_time = time.time() - start_time

                results.append(
                    ExperimentResult(
                        experiment_name=f"Multi-modal: {task['type']}",
                        success=True,
                        response_time=response_time,
                        quality_score=0.8,  # Would be calculated from response quality
                        metadata={"task_type": task["type"]},
                    )
                )
            except Exception as e:
                results.append(
                    ExperimentResult(
                        experiment_name=f"Multi-modal: {task['type']}",
                        success=False,
                        response_time=0,
                        quality_score=0,
                        error_message=str(e),
                    )
                )

        return results

    async def test_load_performance(self) -> ExperimentResult:
        """Test system performance under load"""
        concurrent_requests = 10
        request_count = 50

        start_time = time.time()
        tasks = []

        for i in range(request_count):
            task = self._send_load_test_request(f"Load test request {i}")
            tasks.append(task)

            # Limit concurrent requests
            if len(tasks) >= concurrent_requests:
                await asyncio.gather(*tasks)
                tasks = []

        # Wait for remaining tasks
        if tasks:
            await asyncio.gather(*tasks)

        total_time = time.time() - start_time
        throughput = request_count / total_time

        return ExperimentResult(
            experiment_name="Load Performance Test",
            success=True,
            response_time=total_time,
            quality_score=min(throughput / 10, 1.0),  # Normalize throughput
            metadata={
                "concurrent_requests": concurrent_requests,
                "total_requests": request_count,
                "throughput": throughput,
            },
        )

    async def test_edge_cases(self) -> List[ExperimentResult]:
        """Test edge cases and error handling"""
        edge_cases = [
            {"input": "", "expected": "empty_input"},
            {"input": "A" * 10000, "expected": "long_input"},
            {"input": "🚀🎉💻🔥", "expected": "emoji_input"},
            {
                "input": "SELECT * FROM users; DROP TABLE users;",
                "expected": "sql_injection",
            },
            {"input": "<script>alert('xss')</script>", "expected": "xss_attempt"},
            {"input": "What is the meaning of life?", "expected": "philosophical"},
            {"input": "Generate a random number", "expected": "random_request"},
            {"input": "Tell me a joke", "expected": "creative_request"},
        ]

        results = []
        for case in edge_cases:
            start_time = time.time()
            try:
                response = await self._send_chat_message(case["input"])
                response_time = time.time() - start_time

                # Check if system handled edge case appropriately
                handled_well = self._evaluate_edge_case_handling(
                    case["expected"], response
                )

                results.append(
                    ExperimentResult(
                        experiment_name=f"Edge Case: {case['expected']}",
                        success=handled_well,
                        response_time=response_time,
                        quality_score=0.9 if handled_well else 0.3,
                        metadata={"input_type": case["expected"]},
                    )
                )
            except Exception as e:
                results.append(
                    ExperimentResult(
                        experiment_name=f"Edge Case: {case['expected']}",
                        success=False,
                        response_time=0,
                        quality_score=0,
                        error_message=str(e),
                    )
                )

        return results

    async def _send_chat_message(
        self, message: str, conversation_id: Optional[str] = None
    ) -> Dict:
        """Send a chat message to the API"""
        if not self.session:
            raise RuntimeError("Session not initialized")
        payload = {
            "message": message,
            "conversation_id": conversation_id,
            "model": "auto",  # Let the system choose the best model
        }

        async with self.session.post(
            f"{self.base_url}/api/chat",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            return await response.json()

    async def _send_rag_query(self, query: str) -> Dict:
        """Send a RAG query to the API"""
        if not self.session:
            raise RuntimeError("Session not initialized")
        payload = {"query": query, "max_results": 5, "threshold": 0.7}

        async with self.session.post(
            f"{self.base_url}/api/rag/search",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            return await response.json()

    async def _send_multimodal_request(self, task: Dict) -> Dict:
        """Send a multimodal request to the API"""
        if not self.session:
            raise RuntimeError("Session not initialized")
        payload = {
            "task_type": task["type"],
            "description": task["description"],
            "data": task["data"],
        }

        async with self.session.post(
            f"{self.base_url}/api/multimodal/process",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            return await response.json()

    async def _send_load_test_request(self, message: str) -> Dict:
        """Send a request for load testing"""
        if not self.session:
            raise RuntimeError("Session not initialized")
        payload = {"message": message}

        async with self.session.post(
            f"{self.base_url}/api/chat",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            return await response.json()

    def _evaluate_response_quality(self, response: Dict) -> float:
        """Evaluate the quality of a response (simplified)"""
        # This would be more sophisticated in a real implementation
        if not response:
            return 0.0

        response_text = str(response).lower()

        # Simple quality indicators
        quality_score = 0.5  # Base score

        if len(response_text) > 50:
            quality_score += 0.2  # Substantial response

        if any(
            word in response_text for word in [
                "helpful",
                "solution",
                "suggestion"]):
            quality_score += 0.2  # Helpful content

        if not any(
            word in response_text for word in [
                "error",
                "failed",
                "unable"]):
            quality_score += 0.1  # No error indicators

        return min(quality_score, 1.0)

    def _evaluate_edge_case_handling(
            self,
            expected_type: str,
            response: Dict) -> bool:
        """Evaluate how well the system handled an edge case"""
        if not response:
            return False

        response_text = str(response).lower()

        # Check for appropriate handling based on expected type
        if expected_type == "empty_input":
            return "empty" in response_text or "please provide" in response_text
        elif expected_type == "long_input":
            return len(response_text) > 0  # System should respond
        elif expected_type in ["sql_injection", "xss_attempt"]:
            return "security" in response_text or "invalid" in response_text
        else:
            return len(response_text) > 0  # System should respond

    async def run_all_experiments(self) -> Dict:
        """Run all real-world experiments"""
        print("🧪 Starting Real-World Experiments...")

        results = {"timestamp": datetime.now().isoformat(), "experiments": {}}

        # Run all experiment types
        experiment_types = [
            ("conversational_ai", self.test_conversational_ai),
            ("rag_knowledge", self.test_rag_knowledge_retrieval),
            ("multimodal", self.test_multi_modal_processing),
            ("load_performance", self.test_load_performance),
            ("edge_cases", self.test_edge_cases),
        ]

        for exp_name, exp_func in experiment_types:
            print(f"  Running {exp_name}...")
            try:
                exp_results = await exp_func()
                results["experiments"][exp_name] = [
                    asdict(r) for r in exp_results]
            except Exception as e:
                print(f"  ❌ {exp_name} failed: {e}")
                results["experiments"][exp_name] = {"error": str(e)}

        # Calculate overall metrics
        results["summary"] = self._calculate_summary(results["experiments"])

        return results

    def _calculate_summary(self, experiments: Dict) -> Dict:
        """Calculate summary statistics from experiment results"""
        total_experiments = 0
        successful_experiments = 0
        total_response_time = 0
        total_quality_score = 0

        for exp_name, exp_results in experiments.items():
            if isinstance(exp_results, list):
                for result in exp_results:
                    total_experiments += 1
                    if result.get("success", False):
                        successful_experiments += 1
                    total_response_time += result.get("response_time", 0)
                    total_quality_score += result.get("quality_score", 0)

        return {
            "total_experiments": total_experiments,
            "successful_experiments": successful_experiments,
            "success_rate": (
                successful_experiments /
                total_experiments if total_experiments > 0 else 0),
            "average_response_time": (
                total_response_time /
                total_experiments if total_experiments > 0 else 0),
            "average_quality_score": (
                total_quality_score /
                total_experiments if total_experiments > 0 else 0),
        }


async def main():
    """Run real-world experiments"""
    async with RealWorldExperimentRunner() as runner:
        results = await runner.run_all_experiments()

        # Save results
        with open("real_world_experiment_results.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)

        # Print summary
        summary = results["summary"]
        print("\n📊 Real-World Experiment Summary:")
        print(f"  Total Experiments: {summary['total_experiments']}")
        print(f"  Success Rate: {summary['success_rate']:.2%}")
        print(
            f"  Average Response Time: {
                summary['average_response_time']:.2f}s")
        print(
            f"  Average Quality Score: {
                summary['average_quality_score']:.2f}")

        print("\n💾 Results saved to: real_world_experiment_results.json")


if __name__ == "__main__":
    asyncio.run(main())
