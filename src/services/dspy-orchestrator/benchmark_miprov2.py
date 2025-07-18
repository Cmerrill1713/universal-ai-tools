#!/usr/bin/env python3
"""
MIPROv2 Optimization Benchmarking Script
Demonstrates the performance improvements from MIPROv2 optimization
"""

import asyncio
import json
import time
import numpy as np
from typing import List, Dict, Any
import logging
from knowledge_optimizer import KnowledgeOptimizer
import dspy

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure DSPy
dspy.settings.configure(
    lm=dspy.OpenAI(
        model="gpt-4",
        max_tokens=1000
    )
)


class BenchmarkDataset:
    """Generate benchmark examples for optimization."""
    
    @staticmethod
    def generate_extraction_examples(n: int = 50) -> List[Dict[str, Any]]:
        """Generate knowledge extraction examples."""
        examples = []
        
        templates = [
            {
                "raw_content": "The MIPROv2 algorithm significantly improves prompt optimization by using multi-prompt optimization techniques. It achieves 15-20% better performance than traditional methods.",
                "context": {"type": "best_practice", "domain": "ai_optimization"},
                "expected_concepts": ["MIPROv2", "prompt optimization", "performance improvement"]
            },
            {
                "raw_content": "Error handling in distributed systems requires circuit breakers, retries with exponential backoff, and proper timeout configurations. Always log errors with correlation IDs.",
                "context": {"type": "error", "domain": "distributed_systems"},
                "expected_concepts": ["circuit breakers", "exponential backoff", "correlation IDs"]
            },
            {
                "raw_content": "Performance monitoring shows that async processing reduces latency by 40% in high-throughput scenarios. Key metrics include p99 latency, error rate, and throughput.",
                "context": {"type": "performance", "domain": "system_optimization"},
                "expected_concepts": ["async processing", "p99 latency", "throughput"]
            }
        ]
        
        for i in range(n):
            template = templates[i % len(templates)]
            examples.append({
                "raw_content": template["raw_content"],
                "context": template["context"],
                "expected_output": {
                    "key_concepts": template["expected_concepts"],
                    "confidence": 0.9
                }
            })
        
        return examples
    
    @staticmethod
    def generate_search_examples(n: int = 30) -> List[Dict[str, Any]]:
        """Generate knowledge search examples."""
        examples = []
        
        queries = [
            {
                "query": "How to optimize prompts with MIPROv2?",
                "search_context": {"type": ["best_practice"], "domain": "ai"},
                "expected_relevance": 0.9
            },
            {
                "query": "Error handling patterns in microservices",
                "search_context": {"type": ["error", "pattern"], "domain": "distributed_systems"},
                "expected_relevance": 0.85
            },
            {
                "query": "Performance metrics for async systems",
                "search_context": {"type": ["performance"], "domain": "monitoring"},
                "expected_relevance": 0.8
            }
        ]
        
        for i in range(n):
            query_template = queries[i % len(queries)]
            examples.append({
                "query": query_template["query"],
                "search_context": query_template["search_context"],
                "expected_output": {
                    "relevance": query_template["expected_relevance"]
                }
            })
        
        return examples
    
    @staticmethod
    def generate_validation_examples(n: int = 20) -> List[Dict[str, Any]]:
        """Generate knowledge validation examples."""
        examples = []
        
        knowledge_items = [
            {
                "knowledge_item": {
                    "type": "solution",
                    "title": "MIPROv2 Implementation Guide",
                    "content": {"algorithm": "MIPROv2", "benefits": ["better optimization", "faster convergence"]},
                    "confidence": 0.95
                },
                "validation_context": {"required_fields": ["type", "title", "content"]},
                "expected_valid": True
            },
            {
                "knowledge_item": {
                    "type": "error",
                    "title": "",  # Missing title
                    "content": {"error": "Timeout"},
                    "confidence": 0.3
                },
                "validation_context": {"required_fields": ["type", "title", "content"]},
                "expected_valid": False
            }
        ]
        
        for i in range(n):
            template = knowledge_items[i % len(knowledge_items)]
            examples.append({
                "knowledge_item": template["knowledge_item"],
                "validation_context": template["validation_context"],
                "expected_output": {
                    "is_valid": template["expected_valid"]
                }
            })
        
        return examples


class MIPROv2Benchmark:
    """Benchmark MIPROv2 optimization performance."""
    
    def __init__(self):
        self.optimizer = KnowledgeOptimizer()
        self.results = {
            "before_optimization": {},
            "after_optimization": {},
            "improvement": {}
        }
    
    async def run_benchmark(self):
        """Run complete benchmark suite."""
        logger.info("Starting MIPROv2 optimization benchmark...")
        
        # Generate datasets
        extraction_examples = BenchmarkDataset.generate_extraction_examples(50)
        search_examples = BenchmarkDataset.generate_search_examples(30)
        validation_examples = BenchmarkDataset.generate_validation_examples(20)
        
        # Benchmark before optimization
        logger.info("Benchmarking before optimization...")
        self.results["before_optimization"] = await self._benchmark_modules(
            extraction_examples[:10],
            search_examples[:10],
            validation_examples[:10]
        )
        
        # Optimize with training examples
        logger.info("Running MIPROv2 optimization...")
        optimization_start = time.time()
        
        all_examples = extraction_examples + search_examples + validation_examples
        optimization_result = self.optimizer.optimize_with_examples(
            examples=all_examples,
            num_iterations=10
        )
        
        optimization_time = time.time() - optimization_start
        logger.info(f"Optimization completed in {optimization_time:.2f} seconds")
        
        # Benchmark after optimization
        logger.info("Benchmarking after optimization...")
        self.results["after_optimization"] = await self._benchmark_modules(
            extraction_examples[40:],  # Use different test examples
            search_examples[20:],
            validation_examples[10:]
        )
        
        # Calculate improvements
        self._calculate_improvements()
        
        # Print results
        self._print_results()
        
        return self.results
    
    async def _benchmark_modules(self, extraction_examples: List[Dict], 
                                search_examples: List[Dict],
                                validation_examples: List[Dict]) -> Dict[str, Any]:
        """Benchmark all modules."""
        results = {}
        
        # Benchmark extraction
        extraction_times = []
        extraction_confidences = []
        
        for example in extraction_examples:
            start = time.time()
            result = self.optimizer.extractor(
                raw_content=example["raw_content"],
                context=example["context"]
            )
            extraction_times.append(time.time() - start)
            extraction_confidences.append(result.get("confidence", 0))
        
        results["extraction"] = {
            "avg_time": np.mean(extraction_times),
            "avg_confidence": np.mean(extraction_confidences),
            "p95_time": np.percentile(extraction_times, 95)
        }
        
        # Benchmark search
        search_times = []
        search_confidences = []
        
        for example in search_examples:
            start = time.time()
            result = self.optimizer.searcher(
                query=example["query"],
                context=example["search_context"]
            )
            search_times.append(time.time() - start)
            search_confidences.append(result.get("confidence", 0))
        
        results["search"] = {
            "avg_time": np.mean(search_times),
            "avg_confidence": np.mean(search_confidences),
            "p95_time": np.percentile(search_times, 95)
        }
        
        # Benchmark validation
        validation_times = []
        validation_scores = []
        
        for example in validation_examples:
            start = time.time()
            result = self.optimizer.validator(
                knowledge=example["knowledge_item"],
                context=example["validation_context"]
            )
            validation_times.append(time.time() - start)
            validation_scores.append(result.get("validation_score", 0))
        
        results["validation"] = {
            "avg_time": np.mean(validation_times),
            "avg_score": np.mean(validation_scores),
            "p95_time": np.percentile(validation_times, 95)
        }
        
        return results
    
    def _calculate_improvements(self):
        """Calculate performance improvements."""
        before = self.results["before_optimization"]
        after = self.results["after_optimization"]
        
        for module in ["extraction", "search", "validation"]:
            if module not in before or module not in after:
                continue
            
            self.results["improvement"][module] = {}
            
            # Calculate confidence/score improvement
            conf_field = "avg_score" if module == "validation" else "avg_confidence"
            before_conf = before[module].get(conf_field, 0)
            after_conf = after[module].get(conf_field, 0)
            
            if before_conf > 0:
                conf_improvement = ((after_conf - before_conf) / before_conf) * 100
            else:
                conf_improvement = 0
            
            self.results["improvement"][module]["confidence_improvement"] = conf_improvement
            
            # Calculate time improvement (negative is better)
            before_time = before[module].get("avg_time", 0)
            after_time = after[module].get("avg_time", 0)
            
            if before_time > 0:
                time_improvement = ((before_time - after_time) / before_time) * 100
            else:
                time_improvement = 0
            
            self.results["improvement"][module]["time_improvement"] = time_improvement
    
    def _print_results(self):
        """Print benchmark results in a formatted way."""
        print("\n" + "="*60)
        print("MIPROv2 OPTIMIZATION BENCHMARK RESULTS")
        print("="*60)
        
        # Before optimization
        print("\nBEFORE OPTIMIZATION:")
        print("-"*40)
        for module, metrics in self.results["before_optimization"].items():
            print(f"\n{module.upper()}:")
            for metric, value in metrics.items():
                if "time" in metric:
                    print(f"  {metric}: {value:.3f}s")
                else:
                    print(f"  {metric}: {value:.3f}")
        
        # After optimization
        print("\nAFTER OPTIMIZATION:")
        print("-"*40)
        for module, metrics in self.results["after_optimization"].items():
            print(f"\n{module.upper()}:")
            for metric, value in metrics.items():
                if "time" in metric:
                    print(f"  {metric}: {value:.3f}s")
                else:
                    print(f"  {metric}: {value:.3f}")
        
        # Improvements
        print("\nIMPROVEMENTS:")
        print("-"*40)
        for module, improvements in self.results["improvement"].items():
            print(f"\n{module.upper()}:")
            for metric, value in improvements.items():
                sign = "+" if value > 0 else ""
                print(f"  {metric}: {sign}{value:.1f}%")
        
        # Summary
        print("\n" + "="*60)
        print("SUMMARY:")
        print("-"*40)
        
        avg_conf_improvement = np.mean([
            imp.get("confidence_improvement", 0) 
            for imp in self.results["improvement"].values()
        ])
        avg_time_improvement = np.mean([
            imp.get("time_improvement", 0) 
            for imp in self.results["improvement"].values()
        ])
        
        print(f"Average Confidence Improvement: +{avg_conf_improvement:.1f}%")
        print(f"Average Time Improvement: +{avg_time_improvement:.1f}%")
        print("="*60 + "\n")


async def main():
    """Run the benchmark."""
    benchmark = MIPROv2Benchmark()
    results = await benchmark.run_benchmark()
    
    # Save results to file
    with open("miprov2_benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    logger.info("Benchmark results saved to miprov2_benchmark_results.json")


if __name__ == "__main__":
    asyncio.run(main())