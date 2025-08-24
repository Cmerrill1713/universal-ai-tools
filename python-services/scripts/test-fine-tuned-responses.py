#!/usr/bin/env python3

"""
Quick validation test for fine-tuned MLX model responses
Tests domain-specific accuracy improvements
"""

import requests
import json
import time

# Test questions and expected keywords
test_cases = [
    {
        "question": "Describe the Universal AI Tools system architecture",
        "expected_keywords": ["hybrid", "Rust", "Go", "Swift", "port", "8080", "8082", "8083"],
        "category": "architecture"
    },
    {
        "question": "How do you troubleshoot 503 Service Unavailable errors?",
        "expected_keywords": ["service", "restart", "health", "check", "logs", "monitoring"],
        "category": "debugging"
    },
    {
        "question": "What are the key performance improvements in the hybrid architecture?", 
        "expected_keywords": ["60%", "memory", "response", "throughput", "concurrent", "consolidation"],
        "category": "performance"
    }
]

def test_fine_tuned_model():
    """Test fine-tuned model responses"""
    print("🧪 Testing Fine-tuned MLX Model Responses")
    print("=" * 50)
    
    service_url = "http://localhost:8005"
    
    # Test service availability
    try:
        health_response = requests.get(f"{service_url}/health", timeout=5)
        if health_response.status_code != 200:
            print("❌ MLX service not available")
            return False
            
        health_data = health_response.json()
        print(f"✅ Service Status: {health_data.get('status', 'unknown')}")
        print(f"✅ Model Loaded: {health_data.get('model_loaded', False)}")
        print(f"✅ Metal Available: {health_data.get('metal_available', False)}")
        print()
        
    except Exception as e:
        print(f"❌ Service health check failed: {e}")
        return False
    
    total_keywords_found = 0
    total_keywords_expected = 0
    results = []
    
    for test_case in test_cases:
        print(f"🔍 Testing: {test_case['category'].title()}")
        print(f"   Question: {test_case['question']}")
        
        # Format in training style
        prompt = f"Instruction: {test_case['question']}\nResponse:"
        
        try:
            # Test with fine-tuned model
            start_time = time.time()
            response = requests.post(
                f"{service_url}/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 200,
                    "model": "universal-ai-tools-llama-3.1-8b"
                },
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"   ❌ Request failed: {response.status_code}")
                continue
                
            response_time = time.time() - start_time
            data = response.json()
            content = data['choices'][0]['message']['content']
            
            # Count keyword matches
            keywords_found = 0
            content_lower = content.lower()
            
            for keyword in test_case['expected_keywords']:
                if keyword.lower() in content_lower:
                    keywords_found += 1
                    
            total_keywords_found += keywords_found
            total_keywords_expected += len(test_case['expected_keywords'])
            
            accuracy = (keywords_found / len(test_case['expected_keywords'])) * 100
            
            print(f"   📊 Keywords Found: {keywords_found}/{len(test_case['expected_keywords'])} ({accuracy:.1f}%)")
            print(f"   ⏱️  Response Time: {response_time:.2f}s")
            print(f"   💬 Response Preview: {content[:150]}...")
            print()
            
            results.append({
                'category': test_case['category'],
                'accuracy': accuracy,
                'response_time': response_time,
                'keywords_found': keywords_found,
                'total_keywords': len(test_case['expected_keywords'])
            })
            
        except Exception as e:
            print(f"   ❌ Test failed: {e}")
            print()
    
    # Calculate overall accuracy
    if total_keywords_expected > 0:
        overall_accuracy = (total_keywords_found / total_keywords_expected) * 100
        print("📈 RESULTS SUMMARY")
        print("=" * 30)
        print(f"Overall Domain Accuracy: {overall_accuracy:.1f}%")
        print(f"Keywords Matched: {total_keywords_found}/{total_keywords_expected}")
        print()
        
        for result in results:
            print(f"{result['category'].title()}: {result['accuracy']:.1f}% accuracy, {result['response_time']:.2f}s")
        
        print()
        if overall_accuracy >= 70:
            print("🎉 SUCCESS: Domain accuracy target achieved (≥70%)")
        elif overall_accuracy >= 50:
            print("⚡ GOOD: Significant improvement, approaching target")
        elif overall_accuracy >= 30:
            print("📈 PROGRESS: Noticeable domain knowledge improvement") 
        else:
            print("⚠️  NEEDS WORK: Domain accuracy below expectations")
            
        return overall_accuracy >= 50  # Consider 50%+ as success
    
    return False

if __name__ == "__main__":
    success = test_fine_tuned_model()
    print(f"\n{'✅ VALIDATION PASSED' if success else '❌ VALIDATION NEEDS IMPROVEMENT'}")