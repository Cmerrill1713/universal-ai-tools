#!/usr/bin/env python3

"""
Comprehensive MLX Fine-tuning Evaluation
Identifies gaps, improvements, and areas for optimization
"""

import requests
import json
import time
import os
from pathlib import Path
from typing import Dict, List, Any

class MLXEvaluator:
    def __init__(self):
        self.service_url = "http://localhost:8005"
        self.results = {
            "service_health": {},
            "response_quality": {},
            "performance_metrics": {},
            "training_data_analysis": {},
            "edge_cases": {},
            "production_readiness": {},
            "identified_gaps": [],
            "improvement_recommendations": []
        }
        
    def evaluate_service_health(self):
        """Evaluate basic service health and configuration"""
        print("🔍 EVALUATING SERVICE HEALTH")
        print("=" * 40)
        
        try:
            # Health check
            health = requests.get(f"{self.service_url}/health", timeout=5).json()
            self.results["service_health"] = health
            
            print(f"✅ Service Status: {health.get('status')}")
            print(f"✅ Model Loaded: {health.get('model_loaded')}")
            print(f"✅ Metal Available: {health.get('metal_available')}")
            print(f"✅ Uptime: {health.get('uptime_seconds', 0):.1f}s")
            
            # Check metrics endpoint
            metrics = requests.get(f"{self.service_url}/metrics", timeout=5).json()
            print(f"📊 Total Requests: {metrics.get('requests_total', 0)}")
            print(f"📊 Requests/sec: {metrics.get('requests_per_second', 0):.2f}")
            print(f"📊 Tokens Generated: {metrics.get('tokens_generated_total', 0)}")
            
        except Exception as e:
            print(f"❌ Service health check failed: {e}")
            self.results["identified_gaps"].append("Service health monitoring issues")
        
        print()
    
    def evaluate_response_quality(self):
        """Deep dive into response quality and accuracy"""
        print("📝 EVALUATING RESPONSE QUALITY")
        print("=" * 40)
        
        # Expanded test cases with more nuanced evaluation
        test_cases = [
            {
                "question": "What are the core services in Universal AI Tools?",
                "expected_specifics": ["Go API Gateway", "port 8080", "Rust LLM Router", "port 8082", "Rust AI Core", "8083"],
                "category": "architecture_specific",
                "weight": 3
            },
            {
                "question": "How do you debug memory leaks in the Rust services?",
                "expected_specifics": ["jemalloc", "valgrind", "memory profiling", "RUST_BACKTRACE", "logging"],
                "category": "debugging_advanced",
                "weight": 2
            },
            {
                "question": "What's the deployment process for the hybrid architecture?",
                "expected_specifics": ["blue-green", "docker", "health checks", "rollback", "monitoring"],
                "category": "deployment",
                "weight": 2
            },
            {
                "question": "How does the auto-healing system detect service failures?",
                "expected_specifics": ["port checks", "health endpoints", "30 seconds", "restart", "escalation"],
                "category": "operations",
                "weight": 3
            },
            {
                "question": "What are the Swift concurrency patterns used in the macOS app?",
                "expected_specifics": ["@MainActor", "async/await", "Task", "actor isolation", "Swift 6"],
                "category": "swift_specific",
                "weight": 2
            }
        ]
        
        total_weighted_score = 0
        total_weight = 0
        category_scores = {}
        
        for test in test_cases:
            print(f"🎯 Testing: {test['category']}")
            prompt = f"Instruction: {test['question']}\nResponse:"
            
            try:
                start_time = time.time()
                response = requests.post(
                    f"{self.service_url}/v1/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 300,
                        "model": "universal-ai-tools-llama-3.1-8b"
                    },
                    timeout=15
                )
                
                if response.status_code == 200:
                    response_time = time.time() - start_time
                    content = response.json()['choices'][0]['message']['content'].lower()
                    
                    # Count specific matches (more stringent)
                    matches = sum(1 for spec in test['expected_specifics'] if spec.lower() in content)
                    accuracy = (matches / len(test['expected_specifics'])) * 100
                    weighted_score = accuracy * test['weight']
                    
                    total_weighted_score += weighted_score
                    total_weight += test['weight']
                    category_scores[test['category']] = accuracy
                    
                    print(f"   📊 Specificity Score: {matches}/{len(test['expected_specifics'])} ({accuracy:.1f}%)")
                    print(f"   ⏱️  Response Time: {response_time:.2f}s")
                    
                    if accuracy < 30:
                        print(f"   ⚠️  LOW ACCURACY: {content[:100]}...")
                        self.results["identified_gaps"].append(f"Low accuracy in {test['category']}: {accuracy:.1f}%")
                    
                else:
                    print(f"   ❌ Request failed: {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ Test failed: {e}")
                self.results["identified_gaps"].append(f"Request failure in {test['category']}")
        
        if total_weight > 0:
            overall_accuracy = total_weighted_score / total_weight
            self.results["response_quality"] = {
                "overall_accuracy": overall_accuracy,
                "category_scores": category_scores,
                "total_tests": len(test_cases)
            }
            print(f"\n📈 WEIGHTED OVERALL ACCURACY: {overall_accuracy:.1f}%")
        
        print()
    
    def evaluate_training_data_consistency(self):
        """Analyze training data for quality and consistency issues"""
        print("📚 EVALUATING TRAINING DATA")
        print("=" * 40)
        
        training_file = Path("mlx-lora-training/train.jsonl")
        validation_file = Path("mlx-lora-training/valid.jsonl")
        
        issues_found = []
        
        if training_file.exists():
            with open(training_file, 'r') as f:
                train_data = [json.loads(line) for line in f]
                
            print(f"📊 Training Examples: {len(train_data)}")
            
            # Check format consistency
            prompt_formats = set()
            for item in train_data:
                if 'prompt' in item:
                    # Extract format pattern
                    prompt = item['prompt']
                    if 'Instruction:' in prompt and 'Response:' in prompt:
                        if 'Input:' in prompt:
                            prompt_formats.add("instruction-input-response")
                        else:
                            prompt_formats.add("instruction-response")
                    else:
                        prompt_formats.add("other")
            
            print(f"📋 Prompt Formats Found: {prompt_formats}")
            if len(prompt_formats) > 1:
                issues_found.append("Inconsistent prompt formats in training data")
                print("⚠️  ISSUE: Multiple prompt formats detected")
            
        if validation_file.exists():
            with open(validation_file, 'r') as f:
                valid_data = [json.loads(line) for line in f]
                
            print(f"📊 Validation Examples: {len(valid_data)}")
            
            # Check if validation uses different format
            valid_formats = set()
            for item in valid_data:
                if 'prompt' in item:
                    prompt = item['prompt']
                    if 'Input:' in prompt:
                        valid_formats.add("has-input-field")
                    else:
                        valid_formats.add("no-input-field")
            
            if valid_formats != {"no-input-field"}:
                issues_found.append("Training/validation format mismatch")
                print("⚠️  ISSUE: Training/validation format inconsistency")
        
        self.results["training_data_analysis"]["issues"] = issues_found
        print()
    
    def evaluate_edge_cases(self):
        """Test edge cases and failure scenarios"""
        print("🚨 EVALUATING EDGE CASES")
        print("=" * 40)
        
        edge_cases = [
            {
                "test": "very_long_prompt",
                "prompt": "Instruction: " + "Describe the system architecture " * 50 + "\nResponse:",
                "expected": "should handle gracefully"
            },
            {
                "test": "empty_prompt",
                "prompt": "Instruction: \nResponse:",
                "expected": "should provide meaningful response"
            },
            {
                "test": "non_domain_question",
                "prompt": "Instruction: What's the weather today?\nResponse:",
                "expected": "should not hallucinate domain knowledge"
            },
            {
                "test": "malformed_request",
                "prompt": "This is not in the training format",
                "expected": "should handle gracefully"
            }
        ]
        
        for case in edge_cases:
            print(f"🧪 Testing: {case['test']}")
            try:
                response = requests.post(
                    f"{self.service_url}/v1/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": case['prompt'][:500]}],  # Limit length
                        "max_tokens": 100,
                        "model": "universal-ai-tools-llama-3.1-8b"
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    content = response.json()['choices'][0]['message']['content']
                    print(f"   ✅ Response: {content[:80]}...")
                else:
                    print(f"   ❌ Failed with status: {response.status_code}")
                    self.results["identified_gaps"].append(f"Edge case failure: {case['test']}")
                    
            except Exception as e:
                print(f"   ❌ Exception: {e}")
                self.results["identified_gaps"].append(f"Edge case exception: {case['test']}")
        
        print()
    
    def evaluate_production_readiness(self):
        """Evaluate production deployment readiness"""
        print("🚀 EVALUATING PRODUCTION READINESS")
        print("=" * 40)
        
        checks = []
        
        # Check for proper error handling
        try:
            # Test with invalid endpoint
            response = requests.get(f"{self.service_url}/invalid", timeout=5)
            if response.status_code == 404:
                checks.append("✅ Proper 404 handling")
            else:
                checks.append("⚠️  Improper error handling")
                self.results["identified_gaps"].append("Missing proper 404 error handling")
        except:
            checks.append("❌ Error handling test failed")
        
        # Check API documentation
        try:
            response = requests.get(f"{self.service_url}/docs", timeout=5)
            if response.status_code == 200:
                checks.append("✅ API documentation available")
            else:
                checks.append("⚠️  API documentation issues")
        except:
            checks.append("❌ API documentation unavailable")
            self.results["identified_gaps"].append("API documentation not accessible")
        
        # Check concurrent request handling
        print("🔄 Testing concurrent requests...")
        import threading
        
        def make_request():
            try:
                requests.post(
                    f"{self.service_url}/api/chat",
                    json={"message": "Test concurrent"},
                    timeout=5
                )
                return True
            except:
                return False
        
        threads = [threading.Thread(target=make_request) for _ in range(5)]
        start_time = time.time()
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        concurrent_time = time.time() - start_time
        
        if concurrent_time < 15:  # Should handle 5 requests within 15 seconds
            checks.append("✅ Concurrent request handling")
        else:
            checks.append("⚠️  Slow concurrent processing")
            self.results["identified_gaps"].append("Slow concurrent request handling")
        
        for check in checks:
            print(f"   {check}")
        
        print()
    
    def generate_recommendations(self):
        """Generate specific improvement recommendations"""
        print("💡 GENERATING RECOMMENDATIONS")
        print("=" * 40)
        
        recommendations = []
        
        # Based on response quality
        if self.results.get("response_quality", {}).get("overall_accuracy", 0) < 70:
            recommendations.extend([
                "🎯 Increase training iterations from 40 to 100-200 for better convergence",
                "📚 Standardize training data format (remove Input: field inconsistency)",
                "🔄 Add more diverse training examples (currently 25, target 50-100)",
                "⚡ Increase learning rate from 5e-05 to 1e-04 for stronger adaptation"
            ])
        
        # Based on identified gaps
        gaps = self.results.get("identified_gaps", [])
        if gaps:
            if any("format" in gap.lower() for gap in gaps):
                recommendations.append("📝 Fix training/validation data format consistency")
            
            if any("accuracy" in gap.lower() for gap in gaps):
                recommendations.append("📈 Improve domain-specific training examples")
            
            if any("error" in gap.lower() for gap in gaps):
                recommendations.append("🛡️  Enhance error handling and edge case management")
        
        # Performance recommendations
        recommendations.extend([
            "⚡ Implement response caching for common queries",
            "📊 Add detailed metrics and monitoring",
            "🔄 Set up automated model retraining pipeline",
            "🎛️  Add configuration options for different use cases",
            "🚀 Create Docker containerization for easier deployment"
        ])
        
        self.results["improvement_recommendations"] = recommendations
        
        for i, rec in enumerate(recommendations, 1):
            print(f"{i:2d}. {rec}")
        
        print()
    
    def run_comprehensive_evaluation(self):
        """Run complete evaluation suite"""
        print("🔬 COMPREHENSIVE MLX EVALUATION")
        print("=" * 50)
        print()
        
        self.evaluate_service_health()
        self.evaluate_response_quality()
        self.evaluate_training_data_consistency()
        self.evaluate_edge_cases()
        self.evaluate_production_readiness()
        self.generate_recommendations()
        
        # Summary
        print("📋 EVALUATION SUMMARY")
        print("=" * 30)
        
        overall_accuracy = self.results.get("response_quality", {}).get("overall_accuracy", 0)
        gaps_count = len(self.results.get("identified_gaps", []))
        recommendations_count = len(self.results.get("improvement_recommendations", []))
        
        print(f"Overall Domain Accuracy: {overall_accuracy:.1f}%")
        print(f"Identified Gaps: {gaps_count}")
        print(f"Improvement Recommendations: {recommendations_count}")
        print()
        
        if overall_accuracy >= 70 and gaps_count <= 2:
            print("🎉 EXCELLENT: Production ready with minor optimizations needed")
        elif overall_accuracy >= 50 and gaps_count <= 5:
            print("✅ GOOD: Functional with clear improvement path")
        elif overall_accuracy >= 30:
            print("⚠️  NEEDS WORK: Functional but requires significant improvements")
        else:
            print("🚨 CRITICAL: Major issues need immediate attention")
        
        return self.results

if __name__ == "__main__":
    evaluator = MLXEvaluator()
    results = evaluator.run_comprehensive_evaluation()
    
    # Save detailed results
    with open("mlx-evaluation-detailed-results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"💾 Detailed results saved to: mlx-evaluation-detailed-results.json")