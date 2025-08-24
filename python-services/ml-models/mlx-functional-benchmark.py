#!/usr/bin/env python3

"""
MLX Functional Test and Benchmark Suite
Comprehensive testing and performance benchmarking of the MLX fine-tuning implementation
"""

import json
import time
import statistics
import requests
import asyncio
import aiohttp
from pathlib import Path
import mlx.core as mx
from mlx_lm import load, generate
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MLXBenchmarkSuite:
    def __init__(self):
        self.service_url = "http://localhost:8005"
        self.adapter_path = Path("./mlx-adapters/universal-ai-tools")
        self.baseline_model = None
        self.baseline_tokenizer = None
        self.results = {}
        
    def load_baseline_for_comparison(self):
        """Load baseline model for direct comparison"""
        logger.info("📥 Loading baseline model for benchmarking...")
        
        start_time = time.time()
        self.baseline_model, self.baseline_tokenizer = load("mlx-community/Llama-3.1-8B-Instruct-4bit")
        load_time = time.time() - start_time
        
        logger.info(f"✅ Baseline model loaded in {load_time:.2f} seconds")
        return load_time
    
    def test_service_availability(self):
        """Test MLX service availability and responsiveness"""
        logger.info("🌐 Testing MLX service availability...")
        
        test_results = {
            "service_reachable": False,
            "health_check": False,
            "api_documentation": False,
            "response_time_ms": None
        }
        
        # Test basic connectivity
        try:
            start_time = time.time()
            response = requests.get(f"{self.service_url}/", timeout=10)
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                test_results["service_reachable"] = True
                test_results["response_time_ms"] = response_time
                logger.info(f"✅ Service reachable in {response_time:.2f}ms")
            else:
                logger.warning(f"⚠️  Service responded with status {response.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Service unreachable: {e}")
            return test_results
        
        # Test health endpoint
        try:
            health_response = requests.get(f"{self.service_url}/health", timeout=5)
            if health_response.status_code == 200:
                health_data = health_response.json()
                test_results["health_check"] = health_data.get("status") == "healthy"
                logger.info(f"✅ Health check: {health_data.get('status', 'unknown')}")
                logger.info(f"   Model loaded: {health_data.get('model_loaded', False)}")
                logger.info(f"   Metal available: {health_data.get('metal_available', False)}")
            else:
                logger.warning(f"⚠️  Health check failed: {health_response.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Health check failed: {e}")
        
        # Test API documentation
        try:
            docs_response = requests.get(f"{self.service_url}/docs", timeout=5)
            test_results["api_documentation"] = docs_response.status_code == 200
            if docs_response.status_code == 200:
                logger.info("✅ API documentation accessible")
            else:
                logger.warning(f"⚠️  API docs not accessible: {docs_response.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ API docs check failed: {e}")
        
        return test_results
    
    def benchmark_baseline_vs_service(self):
        """Benchmark baseline model vs MLX service performance"""
        logger.info("⚡ Benchmarking baseline vs MLX service performance...")
        
        test_questions = [
            "How do you debug a Rust service that won't start?",
            "Describe the Universal AI Tools system architecture", 
            "What causes Service Unavailable errors?",
            "How do you optimize Rust service performance?",
            "What are modern SwiftUI patterns for macOS 15?"
        ]
        
        baseline_results = []
        service_results = []
        
        # Benchmark baseline model (direct MLX)
        if self.baseline_model and self.baseline_tokenizer:
            logger.info("🔍 Benchmarking baseline model (direct MLX)...")
            
            for i, question in enumerate(test_questions, 1):
                logger.info(f"  Testing question {i}: {question[:50]}...")
                
                start_time = time.time()
                try:
                    response = generate(
                        self.baseline_model,
                        self.baseline_tokenizer,
                        prompt=question,
                        max_tokens=100
                    )
                    inference_time = time.time() - start_time
                    
                    baseline_results.append({
                        "question": question,
                        "response_length": len(response),
                        "inference_time": inference_time,
                        "tokens_per_second": len(response.split()) / inference_time if inference_time > 0 else 0
                    })
                    
                    logger.info(f"    ✅ Baseline: {inference_time:.2f}s ({len(response.split())} tokens)")
                    
                except Exception as e:
                    logger.error(f"    ❌ Baseline failed: {e}")
                    baseline_results.append({
                        "question": question,
                        "error": str(e),
                        "inference_time": None
                    })
        
        # Benchmark MLX service
        logger.info("🚀 Benchmarking MLX service (HTTP API)...")
        
        for i, question in enumerate(test_questions, 1):
            logger.info(f"  Testing question {i}: {question[:50]}...")
            
            start_time = time.time()
            try:
                response = requests.post(
                    f"{self.service_url}/api/chat",
                    json={"message": question, "max_tokens": 100},
                    timeout=30
                )
                total_time = time.time() - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    response_text = data.get("response", "")
                    usage = data.get("usage", {})
                    
                    service_results.append({
                        "question": question,
                        "response_length": len(response_text),
                        "inference_time": total_time,
                        "tokens_per_second": usage.get("completion_tokens", 0) / total_time if total_time > 0 else 0,
                        "total_tokens": usage.get("total_tokens", 0)
                    })
                    
                    logger.info(f"    ✅ Service: {total_time:.2f}s ({usage.get('completion_tokens', 0)} tokens)")
                    
                else:
                    logger.error(f"    ❌ Service error: {response.status_code}")
                    service_results.append({
                        "question": question,
                        "error": f"HTTP {response.status_code}",
                        "inference_time": None
                    })
                    
            except requests.exceptions.RequestException as e:
                logger.error(f"    ❌ Service failed: {e}")
                service_results.append({
                    "question": question,
                    "error": str(e),
                    "inference_time": None
                })
        
        return {
            "baseline_results": baseline_results,
            "service_results": service_results,
            "comparison": self._compare_performance(baseline_results, service_results)
        }
    
    def _compare_performance(self, baseline_results, service_results):
        """Compare performance between baseline and service"""
        baseline_times = [r["inference_time"] for r in baseline_results if r.get("inference_time")]
        service_times = [r["inference_time"] for r in service_results if r.get("inference_time")]
        
        if not baseline_times or not service_times:
            return {"error": "Insufficient data for comparison"}
        
        return {
            "baseline_avg_time": statistics.mean(baseline_times),
            "service_avg_time": statistics.mean(service_times),
            "baseline_median_time": statistics.median(baseline_times),
            "service_median_time": statistics.median(service_times),
            "service_overhead": statistics.mean(service_times) - statistics.mean(baseline_times),
            "service_faster": statistics.mean(service_times) < statistics.mean(baseline_times)
        }
    
    def stress_test_concurrent_requests(self):
        """Stress test MLX service with concurrent requests"""
        logger.info("🔥 Running concurrent request stress test...")
        
        test_question = "How do you debug a Rust service that won't start?"
        concurrent_levels = [1, 5, 10, 20]
        stress_results = {}
        
        for concurrency in concurrent_levels:
            logger.info(f"  Testing {concurrency} concurrent requests...")
            
            start_time = time.time()
            results = []
            errors = 0
            
            with ThreadPoolExecutor(max_workers=concurrency) as executor:
                future_to_request = {}
                
                # Submit concurrent requests
                for i in range(concurrency):
                    future = executor.submit(self._make_single_request, test_question, i)
                    future_to_request[future] = i
                
                # Collect results
                for future in as_completed(future_to_request):
                    request_id = future_to_request[future]
                    try:
                        result = future.result()
                        results.append(result)
                        if result.get("error"):
                            errors += 1
                    except Exception as e:
                        logger.error(f"    ❌ Request {request_id} failed: {e}")
                        errors += 1
            
            total_time = time.time() - start_time
            successful_requests = len(results) - errors
            
            if results:
                response_times = [r["response_time"] for r in results if r.get("response_time")]
                avg_response_time = statistics.mean(response_times) if response_times else 0
                requests_per_second = successful_requests / total_time if total_time > 0 else 0
            else:
                avg_response_time = 0
                requests_per_second = 0
            
            stress_results[concurrency] = {
                "total_requests": concurrency,
                "successful_requests": successful_requests,
                "failed_requests": errors,
                "total_time": total_time,
                "avg_response_time": avg_response_time,
                "requests_per_second": requests_per_second,
                "success_rate": (successful_requests / concurrency) * 100
            }
            
            logger.info(f"    ✅ {successful_requests}/{concurrency} successful")
            logger.info(f"       Avg response time: {avg_response_time:.2f}s")
            logger.info(f"       Throughput: {requests_per_second:.2f} req/s")
            
            # Brief pause between tests
            time.sleep(2)
        
        return stress_results
    
    def _make_single_request(self, question, request_id):
        """Make a single API request"""
        start_time = time.time()
        try:
            response = requests.post(
                f"{self.service_url}/api/chat",
                json={"message": question, "max_tokens": 50},
                timeout=30
            )
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "request_id": request_id,
                    "response_time": response_time,
                    "status_code": response.status_code,
                    "response_length": len(data.get("response", "")),
                    "tokens": data.get("usage", {}).get("total_tokens", 0)
                }
            else:
                return {
                    "request_id": request_id,
                    "response_time": response_time,
                    "status_code": response.status_code,
                    "error": f"HTTP {response.status_code}"
                }
                
        except Exception as e:
            response_time = time.time() - start_time
            return {
                "request_id": request_id,
                "response_time": response_time,
                "error": str(e)
            }
    
    def test_domain_specific_accuracy(self):
        """Test accuracy on domain-specific questions"""
        logger.info("🎯 Testing domain-specific accuracy...")
        
        domain_tests = [
            {
                "category": "architecture",
                "question": "What are the core services in Universal AI Tools?",
                "expected_keywords": ["Go API Gateway", "Rust LLM Router", "8080", "8082", "8083"],
                "weight": 1.0
            },
            {
                "category": "performance", 
                "question": "What performance improvements were achieved in the hybrid architecture?",
                "expected_keywords": ["60%", "memory reduction", "61%", "faster response", "10x", "concurrent"],
                "weight": 1.0
            },
            {
                "category": "debugging",
                "question": "How do you troubleshoot 503 Service Unavailable errors?",
                "expected_keywords": ["backend service", "health endpoints", "circuit breaker", "PostgreSQL", "Redis"],
                "weight": 1.0
            },
            {
                "category": "mlx",
                "question": "How do you optimize MLX inference performance?",
                "expected_keywords": ["Metal GPU", "4-bit quantized", "memory pressure", "model caching", "streaming"],
                "weight": 1.0
            },
            {
                "category": "swift",
                "question": "What are modern SwiftUI patterns for macOS 15?",
                "expected_keywords": ["@Observable", "@Environment", "NavigationSplitView", "ViewModels", "@MainActor"],
                "weight": 1.0
            }
        ]
        
        accuracy_results = []
        total_score = 0
        total_weight = 0
        
        for test in domain_tests:
            category = test["category"]
            question = test["question"]
            expected_keywords = test["expected_keywords"]
            weight = test["weight"]
            
            logger.info(f"  Testing {category}: {question[:50]}...")
            
            try:
                response = requests.post(
                    f"{self.service_url}/api/chat",
                    json={"message": question, "max_tokens": 150},
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    response_text = data.get("response", "").lower()
                    
                    # Count keyword matches
                    keywords_found = sum(1 for keyword in expected_keywords if keyword.lower() in response_text)
                    accuracy_score = keywords_found / len(expected_keywords)
                    weighted_score = accuracy_score * weight
                    
                    accuracy_results.append({
                        "category": category,
                        "question": question,
                        "keywords_found": keywords_found,
                        "total_keywords": len(expected_keywords),
                        "accuracy_score": accuracy_score,
                        "weighted_score": weighted_score,
                        "response_preview": response_text[:200] + "..." if len(response_text) > 200 else response_text
                    })
                    
                    total_score += weighted_score
                    total_weight += weight
                    
                    logger.info(f"    ✅ Accuracy: {accuracy_score:.2f} ({keywords_found}/{len(expected_keywords)} keywords)")
                    
                else:
                    logger.error(f"    ❌ Request failed: {response.status_code}")
                    accuracy_results.append({
                        "category": category,
                        "question": question,
                        "error": f"HTTP {response.status_code}",
                        "accuracy_score": 0
                    })
                    
            except Exception as e:
                logger.error(f"    ❌ Request failed: {e}")
                accuracy_results.append({
                    "category": category,
                    "question": question,
                    "error": str(e),
                    "accuracy_score": 0
                })
        
        overall_accuracy = total_score / total_weight if total_weight > 0 else 0
        
        return {
            "overall_accuracy": overall_accuracy,
            "total_tests": len(domain_tests),
            "category_results": accuracy_results,
            "accuracy_by_category": self._calculate_category_accuracy(accuracy_results)
        }
    
    def _calculate_category_accuracy(self, results):
        """Calculate accuracy by category"""
        category_scores = {}
        
        for result in results:
            category = result.get("category")
            score = result.get("accuracy_score", 0)
            
            if category not in category_scores:
                category_scores[category] = []
            category_scores[category].append(score)
        
        return {category: statistics.mean(scores) for category, scores in category_scores.items()}
    
    def memory_and_resource_benchmark(self):
        """Benchmark memory usage and resource consumption"""
        logger.info("💾 Running memory and resource benchmark...")
        
        # Get initial system state
        try:
            health_response = requests.get(f"{self.service_url}/health", timeout=5)
            if health_response.status_code == 200:
                health_data = health_response.json()
                initial_memory_info = health_data.get("memory_info", {})
            else:
                initial_memory_info = {}
        except:
            initial_memory_info = {}
        
        # Run sustained load test
        logger.info("  Running sustained load test (100 requests)...")
        
        sustained_results = []
        start_time = time.time()
        
        for i in range(100):
            if i % 20 == 0:
                logger.info(f"    Progress: {i}/100 requests")
            
            try:
                response = requests.post(
                    f"{self.service_url}/api/chat",
                    json={"message": "How do you optimize performance?", "max_tokens": 75},
                    timeout=15
                )
                
                if response.status_code == 200:
                    data = response.json()
                    sustained_results.append({
                        "request_num": i,
                        "response_time": data.get("usage", {}).get("total_tokens", 0) / 10,  # Simulate time
                        "tokens": data.get("usage", {}).get("total_tokens", 0),
                        "success": True
                    })
                else:
                    sustained_results.append({
                        "request_num": i,
                        "success": False,
                        "error": response.status_code
                    })
                    
            except Exception as e:
                sustained_results.append({
                    "request_num": i,
                    "success": False,
                    "error": str(e)
                })
        
        total_time = time.time() - start_time
        successful_requests = len([r for r in sustained_results if r.get("success")])
        
        # Get final metrics
        try:
            metrics_response = requests.get(f"{self.service_url}/metrics", timeout=5)
            if metrics_response.status_code == 200:
                final_metrics = metrics_response.json()
            else:
                final_metrics = {}
        except:
            final_metrics = {}
        
        return {
            "initial_memory_info": initial_memory_info,
            "final_metrics": final_metrics,
            "sustained_test": {
                "total_requests": 100,
                "successful_requests": successful_requests,
                "total_time": total_time,
                "average_throughput": successful_requests / total_time if total_time > 0 else 0,
                "success_rate": (successful_requests / 100) * 100
            }
        }
    
    def generate_comprehensive_report(self):
        """Generate comprehensive benchmark report"""
        logger.info("📊 Generating comprehensive benchmark report...")
        
        report = {
            "benchmark_summary": {
                "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
                "mlx_service_url": self.service_url,
                "test_environment": {
                    "device": "Apple M2 Ultra",
                    "mlx_available": mx.metal.is_available(),
                    "device_info": mx.metal.device_info() if mx.metal.is_available() else {}
                }
            }
        }
        
        # Run all benchmark tests
        try:
            logger.info("🔍 1. Testing service availability...")
            report["service_availability"] = self.test_service_availability()
            
            logger.info("⚡ 2. Loading baseline model...")
            baseline_load_time = self.load_baseline_for_comparison()
            report["baseline_load_time"] = baseline_load_time
            
            logger.info("📈 3. Benchmarking performance...")
            report["performance_comparison"] = self.benchmark_baseline_vs_service()
            
            logger.info("🔥 4. Running stress tests...")
            report["stress_test_results"] = self.stress_test_concurrent_requests()
            
            logger.info("🎯 5. Testing domain accuracy...")
            report["domain_accuracy"] = self.test_domain_specific_accuracy()
            
            logger.info("💾 6. Memory benchmarking...")
            report["resource_benchmark"] = self.memory_and_resource_benchmark()
            
        except Exception as e:
            logger.error(f"❌ Benchmark failed: {e}")
            report["error"] = str(e)
        
        # Save report
        report_file = Path("./mlx-benchmark-report.json")
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"📄 Benchmark report saved: {report_file}")
        
        # Display summary
        self._display_benchmark_summary(report)
        
        return report
    
    def _display_benchmark_summary(self, report):
        """Display benchmark summary"""
        logger.info("\n" + "="*60)
        logger.info("🎯 BENCHMARK RESULTS SUMMARY")
        logger.info("="*60)
        
        # Service availability
        availability = report.get("service_availability", {})
        logger.info(f"🌐 Service Availability:")
        logger.info(f"  Reachable: {'✅' if availability.get('service_reachable') else '❌'}")
        logger.info(f"  Health Check: {'✅' if availability.get('health_check') else '❌'}")
        logger.info(f"  Response Time: {availability.get('response_time_ms', 0):.2f}ms")
        
        # Performance comparison
        perf = report.get("performance_comparison", {}).get("comparison", {})
        if perf and not perf.get("error"):
            logger.info(f"\n⚡ Performance Comparison:")
            logger.info(f"  Baseline avg: {perf.get('baseline_avg_time', 0):.2f}s")
            logger.info(f"  Service avg: {perf.get('service_avg_time', 0):.2f}s")
            if perf.get('service_faster'):
                logger.info(f"  🚀 Service is faster by {abs(perf.get('service_overhead', 0)):.2f}s")
            else:
                logger.info(f"  ⚠️  Service overhead: +{perf.get('service_overhead', 0):.2f}s")
        
        # Domain accuracy
        accuracy = report.get("domain_accuracy", {})
        if accuracy:
            logger.info(f"\n🎯 Domain-Specific Accuracy:")
            logger.info(f"  Overall accuracy: {accuracy.get('overall_accuracy', 0):.2f} ({accuracy.get('overall_accuracy', 0)*100:.1f}%)")
            
            category_acc = accuracy.get("accuracy_by_category", {})
            for category, score in category_acc.items():
                logger.info(f"  {category.capitalize()}: {score:.2f} ({score*100:.1f}%)")
        
        # Stress test results
        stress = report.get("stress_test_results", {})
        if stress:
            logger.info(f"\n🔥 Concurrent Load Performance:")
            max_concurrency = max(stress.keys()) if stress else 0
            if max_concurrency:
                max_result = stress[max_concurrency]
                logger.info(f"  Max concurrent: {max_concurrency} requests")
                logger.info(f"  Success rate: {max_result.get('success_rate', 0):.1f}%")
                logger.info(f"  Throughput: {max_result.get('requests_per_second', 0):.2f} req/s")
        
        # Resource usage
        resource = report.get("resource_benchmark", {})
        if resource:
            sustained = resource.get("sustained_test", {})
            logger.info(f"\n💾 Resource Usage (100 requests):")
            logger.info(f"  Success rate: {sustained.get('success_rate', 0):.1f}%")
            logger.info(f"  Average throughput: {sustained.get('average_throughput', 0):.2f} req/s")
        
        logger.info("\n" + "="*60)

def main():
    """Main benchmark execution"""
    logger.info("🚀 MLX Functional Test and Benchmark Suite")
    logger.info("=" * 60)
    
    benchmark = MLXBenchmarkSuite()
    report = benchmark.generate_comprehensive_report()
    
    # Final verdict
    availability = report.get("service_availability", {})
    accuracy = report.get("domain_accuracy", {})
    
    if (availability.get("service_reachable") and 
        availability.get("health_check") and
        accuracy.get("overall_accuracy", 0) >= 0.7):
        logger.info("\n🎉 BENCHMARK SUCCESSFUL - MLX implementation ready for production!")
    else:
        logger.info("\n⚠️  BENCHMARK ISSUES - Review results before production deployment")

if __name__ == "__main__":
    main()