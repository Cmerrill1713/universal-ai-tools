#!/usr/bin/env python3
"""
Comprehensive Integration Test for Universal AI Tools
Tests all services end-to-end functionality
"""

import concurrent.futures
import json
import sys
from dataclasses import dataclass
from typing import Dict, List, Tuple

import requests


@dataclass
class ServiceConfig:
    name: str
    port: int
    health_endpoint: str
    test_endpoints: List[str]
    expected_status: str = "healthy"


class IntegrationTester:
    def __init__(self):
        self.services = [
            ServiceConfig("LLM Router", 3033, "/health", ["/providers/health"]),
            ServiceConfig("Assistantd", 3032, "/health", []),
            ServiceConfig("Vector DB", 3034, "/health", ["/collections"]),
            ServiceConfig("API Gateway", 8080, "/health", ["/api/chat"]),
            ServiceConfig("Auth Service", 8015, "/health", []),
            ServiceConfig("Chat Service", 8016, "/health", []),
            ServiceConfig("Memory Service", 8017, "/health", []),
            ServiceConfig("Cache Coordinator", 8012, "/health", []),
            ServiceConfig("Load Balancer", 8011, "/health", []),
            ServiceConfig("Metrics Aggregator", 8013, "/health", []),
            ServiceConfig("WebSocket Hub", 8018, "/health", []),
            ServiceConfig("ML Inference", 8084, "/health", []),
            ServiceConfig("Legacy Bridge", 9999, "/health", []),
        ]
        self.results = {}

    def test_service_health(self, service: ServiceConfig) -> Tuple[bool, str]:
        """Test individual service health"""
        try:
            url = f"http://localhost:{service.port}{service.health_endpoint}"
            response = requests.get(url, timeout=5)

            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "unknown")
                return True, f"✅ {service.name}: {status}"
            else:
                return False, f"❌ {service.name}: HTTP {response.status_code}"

        except requests.exceptions.RequestException as e:
            return False, f"❌ {service.name}: {str(e)}"

    def test_service_endpoints(self, service: ServiceConfig) -> List[str]:
        """Test additional service endpoints"""
        results = []

        for endpoint in service.test_endpoints:
            try:
                url = f"http://localhost:{service.port}{endpoint}"
                # Use POST for chat endpoint, GET for others
                if endpoint == "/api/chat":
                    headers = {
                        "Content-Type": "application/json",
                        "X-API-Key": "test-key",
                        "X-User-ID": "test-user",
                    }
                    response = requests.post(
                        url,
                        json={"messages": [{"role": "user", "content": "test"}]},
                        headers=headers,
                        timeout=5,
                    )
                else:
                    response = requests.get(url, timeout=5)

                if response.status_code == 200:
                    results.append(f"✅ {service.name}{endpoint}: OK")
                else:
                    results.append(
                        f"❌ {service.name}{endpoint}: HTTP {response.status_code}"
                    )

            except requests.exceptions.RequestException as e:
                results.append(f"❌ {service.name}{endpoint}: {str(e)}")

        return results

    def test_chat_flow(self) -> Tuple[bool, str]:
        """Test end-to-end chat functionality"""
        try:
            # Test API Gateway chat endpoint
            chat_data = {
                "messages": [
                    {"role": "user", "content": "Hello, this is a test message"}
                ],
                "model": "llama2:latest",
                "stream": False,
            }

            headers = {
                "Content-Type": "application/json",
                "X-API-Key": "test-key",
                "X-User-ID": "test-user",
            }

            response = requests.post(
                "http://localhost:8080/api/chat",
                json=chat_data,
                headers=headers,
                timeout=10,
            )

            if response.status_code == 200:
                data = response.json()
                if "response" in data or "content" in data:
                    return True, "✅ Chat Flow: End-to-end working"
                else:
                    return False, f"❌ Chat Flow: Unexpected response format: {data}"
            else:
                return False, f"❌ Chat Flow: HTTP {response.status_code}"

        except requests.exceptions.RequestException as e:
            return False, f"❌ Chat Flow: {str(e)}"

    def test_concurrent_operations(self) -> Tuple[bool, str]:
        """Test concurrent operations across services"""
        try:

            def make_request(service):
                try:
                    url = f"http://localhost:{service.port}{service.health_endpoint}"
                    response = requests.get(url, timeout=5)
                    return response.status_code == 200
                except:
                    return False

            # Test concurrent health checks
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                futures = [
                    executor.submit(make_request, service) for service in self.services
                ]
                results = [
                    future.result()
                    for future in concurrent.futures.as_completed(futures)
                ]

            success_count = sum(results)
            total_count = len(results)

            if success_count >= total_count * 0.8:  # 80% success rate
                return (
                    True,
                    f"✅ Concurrent Operations: {success_count}/{total_count} services responding",
                )
            else:
                return (
                    False,
                    f"❌ Concurrent Operations: Only {success_count}/{total_count} services responding",
                )

        except Exception as e:
            return False, f"❌ Concurrent Operations: {str(e)}"

    def test_service_dependencies(self) -> Tuple[bool, str]:
        """Test service dependency relationships"""
        try:
            # Test API Gateway service discovery
            response = requests.get("http://localhost:8080/health", timeout=5)

            if response.status_code == 200:
                data = response.json()
                services_status = data.get("services", {})

                # Check if key services are detected
                key_services = ["llm-router", "auth-service-legacy", "memory-service"]
                detected_services = [
                    svc for svc in key_services if services_status.get(svc, False)
                ]

                if (
                    len(detected_services) >= len(key_services) * 0.7
                ):  # 70% detection rate
                    return (
                        True,
                        f"✅ Service Dependencies: {len(detected_services)}/{len(key_services)} key services detected",
                    )
                else:
                    return (
                        False,
                        f"❌ Service Dependencies: Only {len(detected_services)}/{len(key_services)} key services detected",
                    )
            else:
                return False, "❌ Service Dependencies: API Gateway not responding"

        except Exception as e:
            return False, f"❌ Service Dependencies: {str(e)}"

    def run_all_tests(self) -> Dict:
        """Run all integration tests"""
        print("🚀 Starting Comprehensive Integration Tests")
        print("=" * 60)

        results = {
            "service_health": [],
            "service_endpoints": [],
            "chat_flow": None,
            "concurrent_operations": None,
            "service_dependencies": None,
            "summary": {},
        }

        # Test individual service health
        print("\n📊 Testing Service Health...")
        for service in self.services:
            success, message = self.test_service_health(service)
            results["service_health"].append((success, message))
            print(f"  {message}")

        # Test additional endpoints
        print("\n🔗 Testing Service Endpoints...")
        for service in self.services:
            endpoint_results = self.test_service_endpoints(service)
            results["service_endpoints"].extend(endpoint_results)
            for result in endpoint_results:
                print(f"  {result}")

        # Test chat flow
        print("\n💬 Testing Chat Flow...")
        success, message = self.test_chat_flow()
        results["chat_flow"] = (success, message)
        print(f"  {message}")

        # Test concurrent operations
        print("\n⚡ Testing Concurrent Operations...")
        success, message = self.test_concurrent_operations()
        results["concurrent_operations"] = (success, message)
        print(f"  {message}")

        # Test service dependencies
        print("\n🔗 Testing Service Dependencies...")
        success, message = self.test_service_dependencies()
        results["service_dependencies"] = (success, message)
        print(f"  {message}")

        # Calculate summary
        health_success = sum(1 for success, _ in results["service_health"] if success)
        health_total = len(results["service_health"])

        endpoint_success = sum(
            1 for result in results["service_endpoints"] if result.startswith("✅")
        )
        endpoint_total = len(results["service_endpoints"])

        integration_tests = [
            results["chat_flow"][0] if results["chat_flow"] else False,
            (
                results["concurrent_operations"][0]
                if results["concurrent_operations"]
                else False
            ),
            (
                results["service_dependencies"][0]
                if results["service_dependencies"]
                else False
            ),
        ]

        integration_success = sum(integration_tests)
        integration_total = len(integration_tests)

        results["summary"] = {
            "health_success_rate": (
                health_success / health_total if health_total > 0 else 0
            ),
            "endpoint_success_rate": (
                endpoint_success / endpoint_total if endpoint_total > 0 else 0
            ),
            "integration_success_rate": (
                integration_success / integration_total if integration_total > 0 else 0
            ),
            "overall_success_rate": (
                (health_success + endpoint_success + integration_success)
                / (health_total + endpoint_total + integration_total)
                if (health_total + endpoint_total + integration_total) > 0
                else 0
            ),
        }

        return results

    def print_summary(self, results: Dict):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📈 INTEGRATION TEST SUMMARY")
        print("=" * 60)

        summary = results["summary"]

        print(f"Service Health: {summary['health_success_rate']:.1%}")
        print(f"Endpoint Tests: {summary['endpoint_success_rate']:.1%}")
        print(f"Integration Tests: {summary['integration_success_rate']:.1%}")
        print(f"Overall Success: {summary['overall_success_rate']:.1%}")

        if summary["overall_success_rate"] >= 0.9:
            print("\n🎉 EXCELLENT: System is fully operational!")
        elif summary["overall_success_rate"] >= 0.7:
            print("\n✅ GOOD: System is mostly operational with minor issues")
        elif summary["overall_success_rate"] >= 0.5:
            print("\n⚠️  FAIR: System has significant issues that need attention")
        else:
            print("\n❌ POOR: System has critical issues requiring immediate attention")

        print("=" * 60)


def main():
    """Main test runner"""
    tester = IntegrationTester()

    try:
        results = tester.run_all_tests()
        tester.print_summary(results)

        # Save results to file
        with open("integration_test_results.json", "w") as f:
            json.dump(results, f, indent=2, default=str)

        print("\n📄 Results saved to: integration_test_results.json")

        # Exit with appropriate code
        if results["summary"]["overall_success_rate"] >= 0.7:
            sys.exit(0)  # Success
        else:
            sys.exit(1)  # Failure

    except KeyboardInterrupt:
        print("\n\n⏹️  Tests interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\n💥 Test runner error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
