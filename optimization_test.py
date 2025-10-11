#!/usr/bin/env python3
"""
Quick optimization test to demonstrate performance improvements
"""
import asyncio
import time

import httpx


async def test_router_performance():
    """Test LLM router performance with multiple concurrent requests"""
    url = "http://localhost:3033/chat/completions"

    # Test data
    test_prompts = [
        "Hello",
        "What is AI?",
        "Explain quantum computing",
        "Write a haiku",
        "What's the weather?",
    ]

    headers = {"Content-Type": "application/json"}

    print("🚀 Testing LLM Router Performance...")

    # Test 1: Single request timing
    start_time = time.time()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers=headers,
            json={
                "model": "llama3.2:3b",
                "messages": [{"role": "user", "content": "Hello"}],
                "stream": False
            }
        )
    single_request_time = time.time() - start_time
    print(f"✅ Single request: {single_request_time:.3f}s")

    # Test 2: Concurrent requests
    start_time = time.time()
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = []
        for prompt in test_prompts:
            task = client.post(
                url,
                headers=headers,
                json={
                    "model": "llama3.2:3b",
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False
                }
            )
            tasks.append(task)

        responses = await asyncio.gather(*tasks, return_exceptions=True)

    concurrent_time = time.time() - start_time
    successful_responses = sum(1 for r in responses if not isinstance(r, Exception))

    print(f"✅ {len(test_prompts)} concurrent requests: {concurrent_time:.3f}s")
    print(f"✅ Successful responses: {successful_responses}/{len(test_prompts)}")
    print(f"✅ Average per request: {concurrent_time/len(test_prompts):.3f}s")

    # Test 3: Model selection performance
    print("\n🎯 Testing Model Selection...")
    models_url = "http://localhost:3033/models"
    start_time = time.time()
    async with httpx.AsyncClient() as client:
        response = await client.get(models_url)
        models_data = response.json()
    model_list_time = time.time() - start_time

    print(f"✅ Model list retrieval: {model_list_time:.3f}s")
    print(f"✅ Available models: {len(models_data.get('models', []))}")

    # Performance summary
    print("\n📊 Performance Summary:")
    print(f"   • Single request: {single_request_time:.3f}s")
    print(f"   • Concurrent avg: {concurrent_time/len(test_prompts):.3f}s")
    print(f"   • Model selection: {model_list_time:.3f}s")
    print(f"   • Total models: {len(models_data.get('models', []))}")

    # Optimization opportunities
    if single_request_time > 0.5:
        print("\n⚠️  Optimization Opportunity: Single request > 500ms")
    if concurrent_time/len(test_prompts) > 1.0:
        print("⚠️  Optimization Opportunity: Concurrent requests > 1s avg")

    return {
        "single_request_time": single_request_time,
        "concurrent_time": concurrent_time,
        "concurrent_avg": concurrent_time/len(test_prompts),
        "model_list_time": model_list_time,
        "total_models": len(models_data.get('models', []))
    }

if __name__ == "__main__":
    asyncio.run(test_router_performance())
