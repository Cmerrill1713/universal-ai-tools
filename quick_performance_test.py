#!/usr/bin/env python3
"""
Quick Performance Test - Test a few models to verify the system works
"""

import asyncio
import time

import aiohttp


async def quick_test():
    """Quick test of a few models"""
    base_url = "http://localhost:3033"

    test_models = ["llama3.2:3b", "hrm-mlx", "fastvlm-0.5b"]
    test_prompt = "What is the capital of France?"

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60)) as session:
        for model in test_models:
            print(f"\n🧪 Testing {model}...")

            payload = {
                "model": model,
                "messages": [{"role": "user", "content": test_prompt}],
                "stream": False,
                "max_tokens": 100,
                "temperature": 0.7
            }

            start_time = time.time()
            try:
                async with session.post(f"{base_url}/chat/completions", json=payload) as response:
                    end_time = time.time()
                    response_time = end_time - start_time

                    if response.status == 200:
                        data = await response.json()

                        # Handle both formats
                        if "response" in data:
                            content = data["response"]
                        elif "choices" in data:
                            content = data["choices"][0]["message"]["content"]
                        else:
                            content = str(data)

                        tokens_approx = len(content.split()) * 1.3
                        tokens_per_second = tokens_approx / response_time if response_time > 0 else 0

                        print(f"✅ {model}:")
                        print(f"   Time: {response_time:.2f}s")
                        print(f"   Tokens/s: {tokens_per_second:.1f}")
                        print(f"   Response: {content[:100]}...")
                    else:
                        error_text = await response.text()
                        print(f"❌ {model}: HTTP {response.status} - {error_text}")

            except Exception as e:
                print(f"❌ {model}: Error - {e}")

if __name__ == "__main__":
    asyncio.run(quick_test())
