#!/usr/bin/env python3
"""
Comprehensive Performance Comparison Test
Compares our Universal AI Tools system against frontier models
"""

import asyncio
import aiohttp
import time
import json
import statistics
from typing import List, Dict, Any
from dataclasses import dataclass
import concurrent.futures
import sys

@dataclass
class TestResult:
    model: str
    provider: str
    response_time: float
    tokens_per_second: float
    response_length: int
    success: bool
    error: str = None
    response_quality_score: float = 0.0

class PerformanceTester:
    def __init__(self):
        self.base_url = "http://localhost:3033"
        self.test_prompts = [
            {
                "name": "Simple Question",
                "prompt": "What is the capital of France?",
                "expected_complexity": "simple"
            },
            {
                "name": "Code Generation",
                "prompt": "Write a Python function to calculate the Fibonacci sequence up to n terms.",
                "expected_complexity": "medium"
            },
            {
                "name": "Complex Reasoning",
                "prompt": "Explain the philosophical implications of quantum entanglement on our understanding of causality and free will.",
                "expected_complexity": "complex"
            },
            {
                "name": "Creative Writing",
                "prompt": "Write a short story about a robot who discovers emotions, but only when it's raining.",
                "expected_complexity": "creative"
            },
            {
                "name": "Technical Analysis",
                "prompt": "Compare the performance characteristics of Rust vs Go for concurrent web services, including memory management, error handling, and ecosystem maturity.",
                "expected_complexity": "technical"
            }
        ]
        
        # Frontier models for comparison
        self.frontier_models = [
            "llama3.1:8b",
            "devstral:24b", 
            "deepseek-r1:14b",
            "qwen2.5:7b",
            "nous-hermes:13b-llama2-q4_K_M"
        ]
        
        # Our specialized models
        self.our_models = [
            "hrm-mlx",
            "fastvlm-0.5b",
            "fastvlm-7b"
        ]
        
        # Efficient models
        self.efficient_models = [
            "llama3.2:3b",
            "gemma3:1b",
            "phi:2.7b-chat-v2-q4_0"
        ]

    async def test_model(self, session: aiohttp.ClientSession, model: str, prompt: Dict[str, str]) -> TestResult:
        """Test a single model with a prompt"""
        start_time = time.time()
        
        try:
            payload = {
                "model": model,
                "messages": [
                    {"role": "user", "content": prompt["prompt"]}
                ],
                "stream": False,
                "max_tokens": 1000,
                "temperature": 0.7
            }
            
            async with session.post(f"{self.base_url}/chat/completions", json=payload) as response:
                end_time = time.time()
                response_time = end_time - start_time
                
                if response.status == 200:
                    data = await response.json()
                    
                    # Handle both OpenAI format and our custom format
                    if "choices" in data:
                        # OpenAI format
                        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    elif "response" in data:
                        # Our custom format
                        content = data.get("response", "")
                    else:
                        content = str(data)
                    
                    # Calculate tokens per second (rough estimate)
                    tokens_approx = len(content.split()) * 1.3  # Rough token estimation
                    tokens_per_second = tokens_approx / response_time if response_time > 0 else 0
                    
                    return TestResult(
                        model=model,
                        provider=self._get_provider(model),
                        response_time=response_time,
                        tokens_per_second=tokens_per_second,
                        response_length=len(content),
                        success=True,
                        response_quality_score=self._score_response(content, prompt)
                    )
                else:
                    error_text = await response.text()
                    return TestResult(
                        model=model,
                        provider=self._get_provider(model),
                        response_time=response_time,
                        tokens_per_second=0,
                        response_length=0,
                        success=False,
                        error=f"HTTP {response.status}: {error_text}"
                    )
                    
        except Exception as e:
            end_time = time.time()
            return TestResult(
                model=model,
                provider=self._get_provider(model),
                response_time=end_time - start_time,
                tokens_per_second=0,
                response_length=0,
                success=False,
                error=str(e)
            )

    def _get_provider(self, model: str) -> str:
        """Determine provider based on model name"""
        if model.startswith("hrm-mlx"):
            return "HRM-MLX"
        elif model.startswith("fastvlm"):
            return "FastVLM"
        elif model in self.frontier_models:
            return "Ollama-Frontier"
        elif model in self.efficient_models:
            return "Ollama-Efficient"
        else:
            return "Ollama-Standard"

    def _score_response(self, content: str, prompt: Dict[str, str]) -> float:
        """Score response quality (0-10) based on prompt complexity"""
        if not content:
            return 0.0
            
        score = 5.0  # Base score
        
        # Length appropriateness
        if len(content) < 50:
            score -= 2.0
        elif len(content) > 1000:
            score += 1.0
            
        # Complexity-specific scoring
        complexity = prompt["expected_complexity"]
        if complexity == "simple" and len(content.split()) > 20:
            score += 1.0
        elif complexity == "complex" and any(word in content.lower() for word in ["quantum", "entanglement", "causality", "philosophical"]):
            score += 2.0
        elif complexity == "technical" and any(word in content.lower() for word in ["rust", "go", "concurrent", "memory", "performance"]):
            score += 2.0
        elif complexity == "creative" and len(content.split()) > 100:
            score += 1.5
            
        return min(10.0, max(0.0, score))

    async def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive performance tests"""
        print("🚀 Starting Comprehensive Performance Comparison Test")
        print("=" * 60)
        
        results = {
            "timestamp": time.time(),
            "test_prompts": self.test_prompts,
            "results_by_prompt": {},
            "summary": {}
        }
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=120)) as session:
            for prompt in self.test_prompts:
                print(f"\n📝 Testing: {prompt['name']}")
                print(f"Complexity: {prompt['expected_complexity']}")
                
                prompt_results = []
                
                # Test all model categories
                all_models = self.frontier_models + self.our_models + self.efficient_models
                
                # Run tests concurrently for speed
                tasks = []
                for model in all_models:
                    task = self.test_model(session, model, prompt)
                    tasks.append(task)
                
                # Execute all tests
                model_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for result in model_results:
                    if isinstance(result, TestResult):
                        prompt_results.append(result)
                        status = "✅" if result.success else "❌"
                        print(f"  {status} {result.model} ({result.provider}): {result.response_time:.2f}s, {result.tokens_per_second:.1f} tok/s, Quality: {result.response_quality_score:.1f}")
                    else:
                        print(f"  ❌ Error: {result}")
                
                results["results_by_prompt"][prompt["name"]] = prompt_results
        
        # Generate summary statistics
        results["summary"] = self._generate_summary(results["results_by_prompt"])
        
        return results

    def _generate_summary(self, results_by_prompt: Dict[str, List[TestResult]]) -> Dict[str, Any]:
        """Generate summary statistics"""
        summary = {
            "by_provider": {},
            "by_complexity": {},
            "performance_rankings": {},
            "recommendations": []
        }
        
        # Aggregate by provider
        provider_stats = {}
        for prompt_name, results in results_by_prompt.items():
            for result in results:
                if result.success:
                    provider = result.provider
                    if provider not in provider_stats:
                        provider_stats[provider] = {
                            "response_times": [],
                            "tokens_per_second": [],
                            "quality_scores": [],
                            "success_count": 0,
                            "total_tests": 0
                        }
                    
                    provider_stats[provider]["response_times"].append(result.response_time)
                    provider_stats[provider]["tokens_per_second"].append(result.tokens_per_second)
                    provider_stats[provider]["quality_scores"].append(result.response_quality_score)
                    provider_stats[provider]["success_count"] += 1
                
                provider_stats[provider]["total_tests"] += 1
        
        # Calculate averages
        for provider, stats in provider_stats.items():
            summary["by_provider"][provider] = {
                "avg_response_time": statistics.mean(stats["response_times"]) if stats["response_times"] else 0,
                "avg_tokens_per_second": statistics.mean(stats["tokens_per_second"]) if stats["tokens_per_second"] else 0,
                "avg_quality_score": statistics.mean(stats["quality_scores"]) if stats["quality_scores"] else 0,
                "success_rate": stats["success_count"] / stats["total_tests"] if stats["total_tests"] > 0 else 0
            }
        
        # Generate recommendations
        self._generate_recommendations(summary)
        
        return summary

    def _generate_recommendations(self, summary: Dict[str, Any]):
        """Generate performance recommendations"""
        recommendations = []
        
        # Find fastest provider
        fastest_provider = min(summary["by_provider"].items(), 
                             key=lambda x: x[1]["avg_response_time"])
        recommendations.append(f"🏃 Fastest Provider: {fastest_provider[0]} ({fastest_provider[1]['avg_response_time']:.2f}s avg)")
        
        # Find highest quality provider
        best_quality_provider = max(summary["by_provider"].items(), 
                                  key=lambda x: x[1]["avg_quality_score"])
        recommendations.append(f"🎯 Best Quality: {best_quality_provider[0]} ({best_quality_provider[1]['avg_quality_score']:.1f}/10)")
        
        # Find most efficient provider
        most_efficient_provider = max(summary["by_provider"].items(), 
                                    key=lambda x: x[1]["avg_tokens_per_second"])
        recommendations.append(f"⚡ Most Efficient: {most_efficient_provider[0]} ({most_efficient_provider[1]['avg_tokens_per_second']:.1f} tok/s)")
        
        # Check if our models are competitive
        our_models = ["HRM-MLX", "FastVLM"]
        for provider in our_models:
            if provider in summary["by_provider"]:
                our_stats = summary["by_provider"][provider]
                avg_quality = our_stats["avg_quality_score"]
                avg_speed = our_stats["avg_response_time"]
                
                if avg_quality >= 7.0:
                    recommendations.append(f"🌟 {provider} shows excellent quality ({avg_quality:.1f}/10)")
                if avg_speed <= 2.0:
                    recommendations.append(f"🚀 {provider} shows excellent speed ({avg_speed:.2f}s)")
        
        summary["recommendations"] = recommendations

    def print_summary(self, results: Dict[str, Any]):
        """Print comprehensive summary"""
        print("\n" + "=" * 60)
        print("📊 PERFORMANCE COMPARISON SUMMARY")
        print("=" * 60)
        
        summary = results["summary"]
        
        print("\n🏆 PROVIDER PERFORMANCE RANKINGS:")
        print("-" * 40)
        
        # Sort providers by overall performance score
        provider_scores = []
        for provider, stats in summary["by_provider"].items():
            # Composite score: 40% quality, 30% speed, 30% efficiency
            composite_score = (
                stats["avg_quality_score"] * 0.4 +
                (10 - min(stats["avg_response_time"] * 2, 10)) * 0.3 +  # Invert time (lower is better)
                min(stats["avg_tokens_per_second"] / 10, 10) * 0.3
            )
            provider_scores.append((provider, composite_score, stats))
        
        provider_scores.sort(key=lambda x: x[1], reverse=True)
        
        for i, (provider, score, stats) in enumerate(provider_scores, 1):
            print(f"{i}. {provider}")
            print(f"   Quality: {stats['avg_quality_score']:.1f}/10")
            print(f"   Speed: {stats['avg_response_time']:.2f}s avg")
            print(f"   Efficiency: {stats['avg_tokens_per_second']:.1f} tok/s")
            print(f"   Success Rate: {stats['success_rate']:.1%}")
            print(f"   Overall Score: {score:.1f}/10")
            print()
        
        print("\n💡 RECOMMENDATIONS:")
        print("-" * 20)
        for rec in summary["recommendations"]:
            print(f"  {rec}")
        
        print(f"\n📈 TOTAL MODELS TESTED: {len(summary['by_provider'])}")
        print(f"📝 TOTAL PROMPTS TESTED: {len(results['test_prompts'])}")

async def main():
    """Main execution function"""
    tester = PerformanceTester()
    
    try:
        results = await tester.run_comprehensive_test()
        
        # Save detailed results
        with open("performance_comparison_results.json", "w") as f:
            json.dump(results, f, indent=2, default=str)
        
        # Print summary
        tester.print_summary(results)
        
        print(f"\n💾 Detailed results saved to: performance_comparison_results.json")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
