#!/usr/bin/env python3
"""
Test the REAL system - Go/Rust/Node.js services
Not the fake Python HTTP servers I was testing before
"""

import requests
import json
import time
from datetime import datetime

class RealSystemTester:
    def __init__(self):
        # Real service ports based on the health check response
        self.services = {
            "api-gateway": {"port": 8081, "url": "http://localhost:8081"},
            "analytics": {"port": 8019, "url": "http://localhost:8019"},
            "assistantd": {"port": "unknown", "url": ""},
            "chat": {"port": 8016, "url": "http://localhost:8016"},
            "kcontext": {"port": 8083, "url": "http://localhost:8083"},
            "knowledge": {"port": 8088, "url": "http://localhost:8088"},
            "llm": {"port": 3033, "url": "http://localhost:3033"},
            "memory": {"port": 8017, "url": "http://localhost:8017"},
            "mlx": {"port": 8001, "url": "http://localhost:8001"},
            "vision": {"port": 8084, "url": "http://localhost:8084"},
            "websocket": {"port": 8082, "url": "http://localhost:8082"}
        }
        
        self.results = []
        self.failures = []
        
    def test_service(self, name, service):
        """Test a single service"""
        if not service["url"]:
            self.failures.append({
                "service": name,
                "error": "No URL configured",
                "status": "unhealthy"
            })
            return False
            
        try:
            response = requests.get(f"{service['url']}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.results.append({
                    "service": name,
                    "status": "healthy",
                    "response": data,
                    "port": service["port"]
                })
                return True
            else:
                self.failures.append({
                    "service": name,
                    "error": f"HTTP {response.status_code}",
                    "status": "unhealthy",
                    "port": service["port"]
                })
                return False
        except requests.exceptions.ConnectionError:
            self.failures.append({
                "service": name,
                "error": "Connection refused",
                "status": "unhealthy",
                "port": service["port"]
            })
            return False
        except Exception as e:
            self.failures.append({
                "service": name,
                "error": str(e),
                "status": "unhealthy",
                "port": service["port"]
            })
            return False
    
    def test_api_gateway_detailed(self):
        """Test the API gateway in detail"""
        print("\n🔍 TESTING API GATEWAY DETAILS")
        print("=" * 40)
        
        try:
            response = requests.get("http://localhost:8081/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API Gateway Status: {data.get('status', 'unknown')}")
                print(f"📊 Service Health Summary:")
                
                services = data.get('services', {})
                healthy_count = 0
                total_count = len(services)
                
                for service_name, service_data in services.items():
                    status = service_data.get('status', 'unknown')
                    url = service_data.get('url', 'no url')
                    if status == 'healthy':
                        healthy_count += 1
                        print(f"  ✅ {service_name}: {status} ({url})")
                    else:
                        print(f"  ❌ {service_name}: {status} ({url})")
                
                print(f"\n📈 Overall Health: {healthy_count}/{total_count} services healthy")
                return healthy_count, total_count
            else:
                print(f"❌ API Gateway returned HTTP {response.status_code}")
                return 0, 0
        except Exception as e:
            print(f"❌ API Gateway error: {e}")
            return 0, 0
    
    def test_all_services(self):
        """Test all services"""
        print("🧪 TESTING REAL SYSTEM - Go/Rust/Node.js Services")
        print("=" * 60)
        print(f"Started at: {datetime.now().isoformat()}")
        
        # First test the API gateway to get the real service list
        healthy_count, total_count = self.test_api_gateway_detailed()
        
        print(f"\n🔍 TESTING INDIVIDUAL SERVICES")
        print("=" * 40)
        
        # Test each service individually
        for name, service in self.services.items():
            if service["url"]:  # Only test services with URLs
                print(f"Testing {name} on port {service['port']}...")
                self.test_service(name, service)
        
        # Generate report
        self.generate_report(healthy_count, total_count)
    
    def generate_report(self, gateway_healthy, gateway_total):
        """Generate test report"""
        total_tests = len(self.results) + len(self.failures)
        success_rate = (len(self.results) / total_tests * 100) if total_tests > 0 else 0
        
        print(f"\n📊 REAL SYSTEM TEST RESULTS")
        print("=" * 40)
        print(f"API Gateway Health: {gateway_healthy}/{gateway_total} services")
        print(f"Individual Tests: {len(self.results)} passed, {len(self.failures)} failed")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.results:
            print(f"\n✅ WORKING SERVICES:")
            for result in self.results:
                print(f"  - {result['service']} (port {result['port']})")
        
        if self.failures:
            print(f"\n❌ FAILED SERVICES:")
            for failure in self.failures:
                print(f"  - {failure['service']} (port {failure.get('port', 'unknown')}): {failure['error']}")
        
        # Save detailed report
        report = {
            "timestamp": datetime.now().isoformat(),
            "api_gateway_health": f"{gateway_healthy}/{gateway_total}",
            "individual_tests": {
                "total": total_tests,
                "passed": len(self.results),
                "failed": len(self.failures),
                "success_rate": success_rate
            },
            "working_services": self.results,
            "failed_services": self.failures
        }
        
        with open("/workspace/real-system-test-report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Detailed report saved to: /workspace/real-system-test-report.json")

def main():
    tester = RealSystemTester()
    tester.test_all_services()

if __name__ == "__main__":
    main()