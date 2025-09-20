#!/usr/bin/env python3
"""
Quick LLM Evaluation Test
"""

import time

import requests


def test_model(model, prompt):
    """Test a single model with a prompt"""
    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "model": model,
        "temperature": 0.7,
    }

    start_time = time.time()
    try:
        response = requests.post(
            "http://localhost:3033/chat",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response_time = time.time() - start_time

        if response.status_code == 200:
            data = response.json()
            return {
                "success": True,
                "model": model,
                "response": data.get("content", ""),
                "response_time": response_time,
                "tokens": data.get("usage", {}).get("total_tokens", 0),
            }
        else:
            return {
                "success": False,
                "model": model,
                "error": f"HTTP {response.status_code}",
                "response_time": response_time,
            }
    except Exception as e:
        return {
            "success": False,
            "model": model,
            "error": str(e),
            "response_time": time.time() - start_time,
        }


def main():
    models = ["llama2:latest", "gemma3:1b", "llava:7b"]
    prompts = [
        "What is artificial intelligence?",
        "Write a haiku about technology.",
        "Explain quantum computing simply.",
    ]

    print("🧪 Quick LLM Evaluation Test")
    print("=" * 40)

    results = []

    for model in models:
        print(f"\n📊 Testing {model}:")

        for prompt in prompts:
            print(f"  Q: {prompt}")
            result = test_model(model, prompt)

            if result["success"]:
                print(f"  ✅ A: {result['response'][:100]}...")
                print(
                    f"     Time: {
                        result['response_time']:.2f}s, Tokens: {
                        result['tokens']}")
                results.append(result)
            else:
                print(f"  ❌ Error: {result['error']}")

            time.sleep(1)

    print(
        f"\n📈 Summary: {len([r for r in results if r['success']])} successful tests")

    # Quick analysis
    successful_results = [r for r in results if r["success"]]
    if successful_results:
        avg_time = sum(r["response_time"] for r in successful_results) / len(
            successful_results
        )
        total_tokens = sum(r["tokens"] for r in successful_results)
        print(f"Average response time: {avg_time:.2f}s")
        print(f"Total tokens generated: {total_tokens}")


if __name__ == "__main__":
    main()
