#!/usr/bin/env python3
"""
Agent Coordination and System Integration Test
"""

import time

import requests


def test_api_gateway():
    """Test API Gateway functionality"""
    print("🌐 Testing API Gateway...")

    try:
        # Test health endpoint
        response = requests.get("http://localhost:8080/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print("  ✅ API Gateway healthy")
            print(
                f"  📊 Services monitored: {len(health_data.get('services', {}))}")
            return True
        else:
            print(f"  ❌ API Gateway unhealthy: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ API Gateway error: {e}")
        return False


def test_llm_router_models():
    """Test LLM Router model discovery"""
    print("\n🧠 Testing LLM Router Model Discovery...")

    try:
        response = requests.get("http://localhost:3033/models", timeout=10)
        if response.status_code == 200:
            models = response.json().get("models", [])
            print(f"  ✅ Found {len(models)} models")
            print(f"  📋 Sample models: {models[:5]}")
            return models
        else:
            print(f"  ❌ Model discovery failed: {response.status_code}")
            return []
    except Exception as e:
        print(f"  ❌ Model discovery error: {e}")
        return []


def test_agent_coordination():
    """Test Agent Coordination Service"""
    print("\n🤖 Testing Agent Coordination Service...")

    try:
        response = requests.get("http://localhost:3034/health", timeout=10)
        if response.status_code == 200:
            print("  ✅ Agent Coordination Service healthy")
            return True
        else:
            print(
                f"  ❌ Agent Coordination Service unhealthy: {
                    response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ Agent Coordination Service error: {e}")
        return False


def test_memory_service():
    """Test Memory Service functionality"""
    print("\n💾 Testing Memory Service...")

    try:
        response = requests.get("http://localhost:8017/health", timeout=10)
        if response.status_code == 200:
            print("  ✅ Memory Service healthy")
            return True
        else:
            print(f"  ❌ Memory Service unhealthy: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ Memory Service error: {e}")
        return False


def test_ml_inference():
    """Test ML Inference Service"""
    print("\n⚡ Testing ML Inference Service...")

    try:
        response = requests.get("http://localhost:8084/health", timeout=10)
        if response.status_code == 200:
            print("  ✅ ML Inference Service healthy")
            return True
        else:
            print(
                f"  ❌ ML Inference Service unhealthy: {
                    response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ ML Inference Service error: {e}")
        return False


def test_llm_performance_comparison():
    """Compare performance across different models"""
    print("\n📊 Testing LLM Performance Comparison...")

    models = ["llama2:latest", "gemma3:1b", "llava:7b"]
    test_prompt = "Explain the concept of machine learning in one paragraph."

    results = []

    for model in models:
        print(f"  Testing {model}...")

        payload = {
            "messages": [{"role": "user", "content": test_prompt}],
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
                result = {
                    "model": model,
                    "response_time": response_time,
                    "tokens": data.get("usage", {}).get("total_tokens", 0),
                    "response_length": len(data.get("content", "")),
                    "success": True,
                }
                results.append(result)
                print(f"    ✅ {response_time:.2f}s, {result['tokens']} tokens")
            else:
                print(f"    ❌ HTTP {response.status_code}")

        except Exception as e:
            print(f"    ❌ Error: {e}")

        time.sleep(1)

    return results


def test_stress_scenarios():
    """Test system under stress scenarios"""
    print("\n🔥 Testing Stress Scenarios...")

    stress_prompts = [
        "Write a 1000-word essay about artificial intelligence.",
        "Generate a complex mathematical proof.",
        "Create a detailed business plan for a tech startup.",
        "Explain the entire history of computing in detail.",
    ]

    results = []

    for i, prompt in enumerate(stress_prompts):
        print(f"  Stress test {i + 1}: {prompt[:50]}...")

        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "model": "llama2:latest",
            "temperature": 0.7,
        }

        start_time = time.time()
        try:
            response = requests.post(
                "http://localhost:3033/chat",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=60,  # Longer timeout for stress tests
            )
            response_time = time.time() - start_time

            if response.status_code == 200:
                data = response.json()
                result = {
                    "prompt": prompt,
                    "response_time": response_time,
                    "tokens": data.get("usage", {}).get("total_tokens", 0),
                    "success": True,
                }
                results.append(result)
                print(f"    ✅ Completed in {response_time:.2f}s")
            else:
                print(f"    ❌ Failed: HTTP {response.status_code}")

        except Exception as e:
            print(f"    ❌ Error: {e}")

        time.sleep(2)  # Longer pause between stress tests

    return results


def generate_evaluation_report(
        service_results,
        performance_results,
        stress_results):
    """Generate comprehensive evaluation report"""
    report = []
    report.append("# Universal AI Tools - Agent & LLM Evaluation Report")
    report.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("")

    # Service Health Summary
    report.append("## Service Health Summary")
    report.append("")
    for service, status in service_results.items():
        status_icon = "✅" if status else "❌"
        report.append(f"- {service}: {status_icon}")
    report.append("")

    # Performance Comparison
    if performance_results:
        report.append("## LLM Performance Comparison")
        report.append("")
        report.append(
            "| Model | Response Time (s) | Tokens | Response Length |")
        report.append(
            "|-------|------------------|--------|-----------------|")

        for result in performance_results:
            if result["success"]:
                report.append(
                    f"| {
                        result['model']} | {
                        result['response_time']:.2f} | {
                        result['tokens']} | {
                        result['response_length']} |")
        report.append("")

        # Find fastest and most efficient
        successful_results = [r for r in performance_results if r["success"]]
        if successful_results:
            fastest = min(successful_results, key=lambda x: x["response_time"])
            most_tokens = max(successful_results, key=lambda x: x["tokens"])

            report.append(
                f"**Fastest Model:** {fastest['model']} ({fastest['response_time']:.2f}s)"
            )
            report.append(
                f"**Most Productive:** {most_tokens['model']} ({most_tokens['tokens']} tokens)"
            )
            report.append("")

    # Stress Test Results
    if stress_results:
        report.append("## Stress Test Results")
        report.append("")
        successful_stress = [r for r in stress_results if r["success"]]
        report.append(
            f"**Stress Tests Passed:** {len(successful_stress)}/{len(stress_results)}"
        )

        if successful_stress:
            avg_stress_time = sum(
                r["response_time"] for r in successful_stress) / len(successful_stress)
            total_stress_tokens = sum(r["tokens"] for r in successful_stress)
            report.append(
                f"**Average Stress Response Time:** {avg_stress_time:.2f}s")
            report.append(
                f"**Total Stress Tokens Generated:** {total_stress_tokens}")
        report.append("")

    # Overall Assessment
    report.append("## Overall Assessment")
    report.append("")

    healthy_services = sum(1 for status in service_results.values() if status)
    total_services = len(service_results)
    health_percentage = (healthy_services / total_services) * 100

    report.append(
        f"**System Health:** {health_percentage:.1f}% ({healthy_services}/{total_services} services)"
    )

    if performance_results:
        successful_perf = [r for r in performance_results if r["success"]]
        if successful_perf:
            avg_perf_time = sum(r["response_time"]
                                for r in successful_perf) / len(successful_perf)
            report.append(
                f"**Average LLM Response Time:** {avg_perf_time:.2f}s")

    if stress_results:
        successful_stress = [r for r in stress_results if r["success"]]
        stress_success_rate = (
            len(successful_stress) / len(stress_results)) * 100
        report.append(
            f"**Stress Test Success Rate:** {stress_success_rate:.1f}%")

    return "\n".join(report)


def main():
    """Run comprehensive agent and LLM evaluation"""
    print("🚀 Universal AI Tools - Agent & LLM Evaluation")
    print("=" * 60)

    # Test service health
    service_results = {
        "API Gateway": test_api_gateway(),
        "LLM Router": len(test_llm_router_models()) > 0,
        "Agent Coordination": test_agent_coordination(),
        "Memory Service": test_memory_service(),
        "ML Inference": test_ml_inference(),
    }

    # Test LLM performance
    performance_results = test_llm_performance_comparison()

    # Test stress scenarios
    stress_results = test_stress_scenarios()

    # Generate report
    report = generate_evaluation_report(
        service_results, performance_results, stress_results
    )

    # Save report
    with open("agent_evaluation_report.md", "w") as f:
        f.write(report)

    print("\n📊 Evaluation complete!")
    print("📄 Report saved to: agent_evaluation_report.md")

    # Print quick summary
    healthy_services = sum(1 for status in service_results.values() if status)
    print("\n🎯 Quick Summary:")
    print(f"  Services Healthy: {healthy_services}/{len(service_results)}")
    print(
        f"  LLM Tests: {len([r for r in performance_results if r['success']])}")
    print(
        f"  Stress Tests: {len([r for r in stress_results if r['success']])}")


if __name__ == "__main__":
    main()
