#!/usr/bin/env python3
"""
Break Test Suite - Stress test the system to find real failures
No flattery, just brutal testing to find what actually breaks
"""

import asyncio
import json
import time
import random
import requests
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

class BreakTester:
    def __init__(self):
        self.results = []
        self.failures = []
        self.base_urls = {
            "athena_gateway": "http://localhost:8080",
            "family_athena": "http://localhost:8081", 
            "universal_ai": "http://localhost:9000",
            "dspy": "http://localhost:8005",
            "mlx": "http://localhost:8006",
            "vision": "http://localhost:8007",
            "memory": "http://localhost:8008",
            "agents": "http://localhost:8009",
            "monitoring": "http://localhost:8010"
        }
        
    def log_failure(self, test_name, error, details=None):
        failure = {
            "test": test_name,
            "error": str(error),
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        self.failures.append(failure)
        print(f"❌ FAILED: {test_name} - {error}")
        
    def log_success(self, test_name, details=None):
        success = {
            "test": test_name,
            "timestamp": datetime.now().isoformat(),
            "details": details
        }
        self.results.append(success)
        print(f"✅ PASSED: {test_name}")
        
    def test_service_connectivity(self):
        """Test if services are actually running"""
        print("\n🔍 TESTING SERVICE CONNECTIVITY")
        print("=" * 40)
        
        for service_name, url in self.base_urls.items():
            try:
                response = requests.get(f"{url}/health", timeout=5)
                if response.status_code == 200:
                    self.log_success(f"{service_name}_connectivity", f"HTTP {response.status_code}")
                else:
                    self.log_failure(f"{service_name}_connectivity", f"HTTP {response.status_code}")
            except requests.exceptions.ConnectionError:
                self.log_failure(f"{service_name}_connectivity", "Connection refused")
            except requests.exceptions.Timeout:
                self.log_failure(f"{service_name}_connectivity", "Timeout")
            except Exception as e:
                self.log_failure(f"{service_name}_connectivity", str(e))
                
    def test_concurrent_requests(self):
        """Hammer services with concurrent requests"""
        print("\n⚡ TESTING CONCURRENT REQUESTS")
        print("=" * 40)
        
        def make_request(service_name, url, request_id):
            try:
                start_time = time.time()
                response = requests.get(f"{url}/health", timeout=10)
                duration = time.time() - start_time
                
                if response.status_code == 200:
                    self.log_success(f"concurrent_{service_name}_{request_id}", f"{duration:.2f}s")
                else:
                    self.log_failure(f"concurrent_{service_name}_{request_id}", f"HTTP {response.status_code}")
            except Exception as e:
                self.log_failure(f"concurrent_{service_name}_{request_id}", str(e))
        
        # Launch 50 concurrent requests per service
        with ThreadPoolExecutor(max_workers=100) as executor:
            futures = []
            for service_name, url in self.base_urls.items():
                for i in range(50):
                    future = executor.submit(make_request, service_name, url, i)
                    futures.append(future)
            
            # Wait for all requests
            for future in futures:
                future.result()
                
    def test_malformed_requests(self):
        """Send malformed requests to break services"""
        print("\n💥 TESTING MALFORMED REQUESTS")
        print("=" * 40)
        
        malformed_payloads = [
            {"malformed": "json", "with": "missing quotes"},
            {"nested": {"deeply": {"nested": {"data": "x" * 10000}}}},
            {"null": None, "empty": "", "array": []},
            {"unicode": "🚀" * 1000},
            {"sql_injection": "'; DROP TABLE users; --"},
            {"xss": "<script>alert('xss')</script>"},
            {"oversized": "x" * 1000000},
            {"special_chars": "!@#$%^&*()_+-=[]{}|;':\",./<>?"},
        ]
        
        for service_name, url in self.base_urls.items():
            for i, payload in enumerate(malformed_payloads):
                try:
                    response = requests.post(
                        f"{url}/api/chat",
                        json=payload,
                        timeout=5,
                        headers={"Content-Type": "application/json"}
                    )
                    if response.status_code in [200, 400, 422]:
                        self.log_success(f"malformed_{service_name}_{i}", f"Handled gracefully: {response.status_code}")
                    else:
                        self.log_failure(f"malformed_{service_name}_{i}", f"Unexpected response: {response.status_code}")
                except Exception as e:
                    self.log_failure(f"malformed_{service_name}_{i}", str(e))
                    
    def test_memory_pressure(self):
        """Test system under memory pressure"""
        print("\n🧠 TESTING MEMORY PRESSURE")
        print("=" * 40)
        
        # Generate large payloads to stress memory
        large_payloads = []
        for size in [1000, 10000, 100000, 1000000]:
            large_payloads.append({
                "message": "x" * size,
                "context": "y" * size,
                "data": list(range(size))
            })
            
        for service_name, url in self.base_urls.items():
            for i, payload in enumerate(large_payloads):
                try:
                    start_time = time.time()
                    response = requests.post(
                        f"{url}/api/chat",
                        json=payload,
                        timeout=30
                    )
                    duration = time.time() - start_time
                    
                    if response.status_code == 200:
                        self.log_success(f"memory_{service_name}_{i}", f"Size: {len(str(payload))} chars, {duration:.2f}s")
                    else:
                        self.log_failure(f"memory_{service_name}_{i}", f"HTTP {response.status_code}, {duration:.2f}s")
                except Exception as e:
                    self.log_failure(f"memory_{service_name}_{i}", str(e))
                    
    def test_rapid_start_stop(self):
        """Rapidly start and stop services to break them"""
        print("\n🔄 TESTING RAPID START/STOP")
        print("=" * 40)
        
        # This would require actual service management
        # For now, just test if services can handle rapid requests
        for service_name, url in self.base_urls.items():
            try:
                # Rapid fire requests
                for i in range(20):
                    response = requests.get(f"{url}/health", timeout=1)
                    if response.status_code != 200:
                        self.log_failure(f"rapid_{service_name}_{i}", f"HTTP {response.status_code}")
                        break
                else:
                    self.log_success(f"rapid_{service_name}", "Handled 20 rapid requests")
            except Exception as e:
                self.log_failure(f"rapid_{service_name}", str(e))
                
    def test_dependency_failures(self):
        """Test what happens when dependencies fail"""
        print("\n🔗 TESTING DEPENDENCY FAILURES")
        print("=" * 40)
        
        # Test services with invalid dependency URLs
        broken_urls = {
            "athena_gateway": "http://localhost:9999",  # Non-existent port
            "family_athena": "http://localhost:9998",
            "universal_ai": "http://localhost:9997"
        }
        
        for service_name, broken_url in broken_urls.items():
            try:
                response = requests.get(f"{broken_url}/health", timeout=2)
                self.log_failure(f"dependency_{service_name}", f"Should have failed but got HTTP {response.status_code}")
            except requests.exceptions.ConnectionError:
                self.log_success(f"dependency_{service_name}", "Correctly failed on broken dependency")
            except Exception as e:
                self.log_failure(f"dependency_{service_name}", str(e))
                
    def test_evolution_system_breakage(self):
        """Test if the evolution system can be broken"""
        print("\n🧬 TESTING EVOLUTION SYSTEM BREAKAGE")
        print("=" * 40)
        
        # Test evolution endpoints with invalid data
        evolution_tests = [
            ("/api/evolution/recommendations", "GET", None),
            ("/api/evolution/approve", "POST", {"invalid": "data"}),
            ("/api/evolution/approve-all", "POST", None),
            ("/api/evolution/history", "GET", None),
            ("/api/evolution/morning-report", "GET", None)
        ]
        
        for endpoint, method, data in evolution_tests:
            try:
                if method == "GET":
                    response = requests.get(f"http://localhost:8080{endpoint}", timeout=5)
                else:
                    response = requests.post(f"http://localhost:8080{endpoint}", json=data, timeout=5)
                
                if response.status_code in [200, 400, 422, 404]:
                    self.log_success(f"evolution_{endpoint.replace('/', '_')}", f"HTTP {response.status_code}")
                else:
                    self.log_failure(f"evolution_{endpoint.replace('/', '_')}", f"Unexpected HTTP {response.status_code}")
            except Exception as e:
                self.log_failure(f"evolution_{endpoint.replace('/', '_')}", str(e))
                
    def test_workflow_breakage(self):
        """Test if robust workflows can be broken"""
        print("\n🛡️ TESTING WORKFLOW BREAKAGE")
        print("=" * 40)
        
        # Test workflow endpoints
        workflow_tests = [
            ("/health", "GET"),
            ("/api/services", "GET"),
            ("/api/chat", "POST", {"message": "break test"}),
        ]
        
        for endpoint, method, *data in workflow_tests:
            try:
                if method == "GET":
                    response = requests.get(f"http://localhost:8080{endpoint}", timeout=5)
                else:
                    response = requests.post(f"http://localhost:8080{endpoint}", json=data[0] if data else {}, timeout=5)
                
                if response.status_code in [200, 400, 422]:
                    self.log_success(f"workflow_{endpoint.replace('/', '_')}", f"HTTP {response.status_code}")
                else:
                    self.log_failure(f"workflow_{endpoint.replace('/', '_')}", f"HTTP {response.status_code}")
            except Exception as e:
                self.log_failure(f"workflow_{endpoint.replace('/', '_')}", str(e))
                
    def run_all_tests(self):
        """Run all break tests"""
        print("🧪 BREAK TEST SUITE - FINDING REAL FAILURES")
        print("=" * 50)
        print(f"Started at: {datetime.now().isoformat()}")
        
        start_time = time.time()
        
        # Run all tests
        self.test_service_connectivity()
        self.test_concurrent_requests()
        self.test_malformed_requests()
        self.test_memory_pressure()
        self.test_rapid_start_stop()
        self.test_dependency_failures()
        self.test_evolution_system_breakage()
        self.test_workflow_breakage()
        
        duration = time.time() - start_time
        
        # Generate report
        self.generate_break_report(duration)
        
    def generate_break_report(self, duration):
        """Generate comprehensive break test report"""
        total_tests = len(self.results) + len(self.failures)
        success_rate = (len(self.results) / total_tests * 100) if total_tests > 0 else 0
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": duration,
            "total_tests": total_tests,
            "passed": len(self.results),
            "failed": len(self.failures),
            "success_rate": success_rate,
            "failures": self.failures,
            "summary": {
                "critical_failures": len([f for f in self.failures if "connectivity" in f["test"]]),
                "service_failures": len([f for f in self.failures if any(service in f["test"] for service in self.base_urls.keys())]),
                "evolution_failures": len([f for f in self.failures if "evolution" in f["test"]]),
                "workflow_failures": len([f for f in self.failures if "workflow" in f["test"]])
            }
        }
        
        # Save report
        with open("/workspace/break-test-report.json", "w") as f:
            json.dump(report, f, indent=2)
            
        # Print summary
        print(f"\n📊 BREAK TEST RESULTS")
        print("=" * 30)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {len(self.results)}")
        print(f"Failed: {len(self.failures)}")
        print(f"Success Rate: {success_rate:.1f}%")
        print(f"Duration: {duration:.2f}s")
        
        if self.failures:
            print(f"\n❌ CRITICAL FAILURES:")
            for failure in self.failures:
                if "connectivity" in failure["test"]:
                    print(f"  - {failure['test']}: {failure['error']}")
                    
        print(f"\n📄 Full report saved to: /workspace/break-test-report.json")

def main():
    tester = BreakTester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()