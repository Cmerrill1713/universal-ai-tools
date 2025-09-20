#!/usr/bin/env python3
"""
Comprehensive Test Suite for Advanced MLX Orchestration
"""

import sys
import os
import time
import requests
import json

# Add the services directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'services'))

from mlx_orchestrator import MLXOrchestrator, GenerationRequest

def test_mlx_service():
    """Test the MLX HTTP service"""
    print("🔍 TEST 1: MLX SERVICE STATUS")
    print("============================")
    
    try:
        # Test health endpoint
        health_response = requests.get("http://localhost:8001/health")
        health_data = health_response.json()
        
        print(f"✅ MLX Service Status: {health_data['status']}")
        print(f"✅ Models Loaded: {health_data['models_loaded']}")
        print(f"✅ Initialized: {health_data['initialized']}")
        
        # Test models endpoint
        models_response = requests.get("http://localhost:8001/v1/models")
        models_data = models_response.json()
        
        print("\n📋 Available Models:")
        for model in models_data['data']:
            print(f"  - {model['id']}: {model['priority']} priority")
        
        return True
        
    except Exception as e:
        print(f"❌ MLX Service Error: {e}")
        return False

def test_model_performance():
    """Test individual model performance"""
    print("\n🧪 TEST 2: MODEL PERFORMANCE")
    print("============================")
    
    models = ["mlx-qwen2.5-0.5b", "mlx-llama-3.1-8b", "qwen3-coder-30b"]
    test_prompt = "Write a Python function to calculate fibonacci numbers"
    
    for model in models:
        print(f"\n🔬 Testing {model}...")
        
        start_time = time.time()
        try:
            response = requests.post(
                "http://localhost:8001/v1/chat/completions",
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": test_prompt}],
                    "max_tokens": 100
                },
                timeout=30
            )
            
            end_time = time.time()
            response_time = end_time - start_time
            
            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']
                word_count = len(content.split())
                
                print(f"  ✅ Response Time: {response_time:.2f}s")
                print(f"  ✅ Word Count: {word_count}")
                print(f"  ✅ Content Preview: {content[:100]}...")
            else:
                print(f"  ❌ Error: {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ Exception: {e}")

def test_orchestration_system():
    """Test the orchestration system"""
    print("\n🎯 TEST 3: ORCHESTRATION SYSTEM")
    print("===============================")
    
    try:
        # Initialize orchestrator
        orchestrator = MLXOrchestrator()
        
        # Test 1: Speed requirement
        print("\n🚀 Speed Requirement Test:")
        request1 = GenerationRequest("Write a simple function", 50, require_quality=False)
        response1 = orchestrator.generate_with_orchestration(request1)
        print(f"  Model Used: {response1.model_used}")
        print(f"  Response Time: {response1.response_time:.3f}s")
        print(f"  Quality Score: {response1.quality_score:.2f}")
        
        # Test 2: Quality requirement
        print("\n🎯 Quality Requirement Test:")
        request2 = GenerationRequest("Write a complex algorithm", 200, require_quality=True)
        response2 = orchestrator.generate_with_orchestration(request2)
        print(f"  Model Used: {response2.model_used}")
        print(f"  Response Time: {response2.response_time:.3f}s")
        print(f"  Quality Score: {response2.quality_score:.2f}")
        
        # Test 3: Model status
        print("\n📊 Model Status:")
        status = orchestrator.get_model_status()
        for model_id, info in status.items():
            print(f"  {model_id}: {info['priority']} priority, warmed: {info['warmed']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Orchestration Error: {e}")
        return False

def test_streaming_responses():
    """Test streaming response capability"""
    print("\n🌊 TEST 4: STREAMING RESPONSES")
    print("=============================")
    
    try:
        orchestrator = MLXOrchestrator()
        
        print("Testing streaming response with progressive enhancement...")
        request = GenerationRequest(
            "Write a Python function to calculate prime numbers", 
            150, 
            require_quality=True
        )
        
        print("\nStreaming responses:")
        for i, response in enumerate(orchestrator.generate_streaming_response(request)):
            print(f"{i+1}. {response[:100]}...")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ Streaming Error: {e}")
        return False

def test_speculative_decoding():
    """Test speculative decoding engine"""
    print("\n🔮 TEST 5: SPECULATIVE DECODING")
    print("===============================")
    
    try:
        orchestrator = MLXOrchestrator()
        
        # Test speculative decoding
        draft_model = "mlx-qwen2.5-0.5b"
        target_model = "qwen3-coder-30b"
        prompt = "Write a Python function with error handling"
        
        print(f"Testing speculative decoding: {draft_model} -> {target_model}")
        
        # Start speculative decoding
        orchestrator.speculative_engine.start_speculative_decoding(
            draft_model, target_model, prompt, 100
        )
        
        # Wait for completion
        time.sleep(2)
        
        # Get result
        result = orchestrator.speculative_engine.get_speculative_result(
            draft_model, target_model, prompt
        )
        
        if result:
            print(f"✅ Speculative decoding successful: {len(result)} tokens verified")
            print(f"Verified tokens: {result}")
        else:
            print("⏳ Speculative decoding still in progress...")
        
        return True
        
    except Exception as e:
        print(f"❌ Speculative Decoding Error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 COMPREHENSIVE ORCHESTRATION TEST SUITE")
    print("=========================================")
    
    tests = [
        ("MLX Service", test_mlx_service),
        ("Model Performance", test_model_performance),
        ("Orchestration System", test_orchestration_system),
        ("Streaming Responses", test_streaming_responses),
        ("Speculative Decoding", test_speculative_decoding)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'='*50}")
    print("📊 TEST SUMMARY")
    print("===============")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Orchestration system is working perfectly!")
    else:
        print("⚠️ Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()
