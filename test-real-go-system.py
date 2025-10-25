#!/usr/bin/env python3
"""
Test the REAL Go/Rust/Node.js system properly
"""

import requests
import json
import time
from datetime import datetime

class RealGoSystemTester:
    def __init__(self):
        # Real services based on what's actually running
        self.services = {
            "api-gateway": {"port": 8081, "url": "http://localhost:8081"},
            "chat-service": {"port": 8016, "url": "http://localhost:8016"},
            "load-balancer": {"port": 8011, "url": "http://localhost:8011"},
            "cache-coordinator": {"port": 8083, "url": "http://localhost:8083"},
            "message-broker": {"port": 8081, "url": "http://localhost:8081"},  # Same as api-gateway
        }
        
        self.results = []
        self.failures = []
        
    def test_service(self, name, service):
        """Test a single service"""
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
                print(f"✅ {name} (port {service['port']}): {data.get('status', 'unknown')}")
                return True
            else:
                self.failures.append({
                    "service": name,
                    "error": f"HTTP {response.status_code}",
                    "status": "unhealthy",
                    "port": service["port"]
                })
                print(f"❌ {name} (port {service['port']}): HTTP {response.status_code}")
                return False
        except requests.exceptions.ConnectionError:
            self.failures.append({
                "service": name,
                "error": "Connection refused",
                "status": "unhealthy",
                "port": service["port"]
            })
            print(f"❌ {name} (port {service['port']}): Connection refused")
            return False
        except Exception as e:
            self.failures.append({
                "service": name,
                "error": str(e),
                "status": "unhealthy",
                "port": service["port"]
            })
            print(f"❌ {name} (port {service['port']}): {str(e)}")
            return False
    
    def test_api_gateway_services(self):
        """Test the services that the API gateway knows about"""
        print("\n🔍 TESTING API GATEWAY SERVICE DISCOVERY")
        print("=" * 50)
        
        try:
            response = requests.get("http://localhost:8081/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ API Gateway Status: {data.get('status', 'unknown')}")
                
                services = data.get('services', {})
                healthy_count = 0
                total_count = len(services)
                
                print(f"\n📊 Service Health from API Gateway:")
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
    
    def test_load_balancer_services(self):
        """Test the services that the load balancer knows about"""
        print("\n🔍 TESTING LOAD BALANCER SERVICE DISCOVERY")
        print("=" * 50)
        
        try:
            response = requests.get("http://localhost:8011/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Load Balancer Status: {data.get('status', 'unknown')}")
                print(f"📊 Healthy Services: {data.get('healthy_services', 0)}/{data.get('total_services', 0)}")
                return data.get('healthy_services', 0), data.get('total_services', 0)
            else:
                print(f"❌ Load Balancer returned HTTP {response.status_code}")
                return 0, 0
        except Exception as e:
            print(f"❌ Load Balancer error: {e}")
            return 0, 0
    
    def test_chat_functionality(self):
        """Test actual chat functionality"""
        print("\n💬 TESTING CHAT FUNCTIONALITY")
        print("=" * 40)
        
        try:
            # Test chat endpoint
            chat_payload = {
                "message": "Hello, test message",
                "user_id": "test_user",
                "session_id": "test_session"
            }
            
            response = requests.post(
                "http://localhost:8016/chat",
                json=chat_payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Chat Service: Message processed successfully")
                print(f"📝 Response: {data.get('response', 'No response')[:100]}...")
                return True
            else:
                print(f"❌ Chat Service: HTTP {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Chat Service error: {e}")
            return False
    
    def test_all_services(self):
        """Test all services"""
        print("🧪 TESTING REAL GO/RUST/NODE.JS SYSTEM")
        print("=" * 60)
        print(f"Started at: {datetime.now().isoformat()}")
        
        # Test API Gateway service discovery
        gateway_healthy, gateway_total = self.test_api_gateway_services()
        
        # Test Load Balancer service discovery
        lb_healthy, lb_total = self.test_load_balancer_services()
        
        # Test individual services
        print(f"\n🔍 TESTING INDIVIDUAL SERVICES")
        print("=" * 40)
        
        for name, service in self.services.items():
            self.test_service(name, service)
        
        # Test chat functionality
        chat_working = self.test_chat_functionality()
        
        # Generate report
        self.generate_report(gateway_healthy, gateway_total, lb_healthy, lb_total, chat_working)
    
    def generate_report(self, gateway_healthy, gateway_total, lb_healthy, lb_total, chat_working):
        """Generate test report"""
        total_tests = len(self.results) + len(self.failures)
        success_rate = (len(self.results) / total_tests * 100) if total_tests > 0 else 0
        
        print(f"\n📊 REAL GO SYSTEM TEST RESULTS")
        print("=" * 50)
        print(f"API Gateway Health: {gateway_healthy}/{gateway_total} services")
        print(f"Load Balancer Health: {lb_healthy}/{lb_total} services")
        print(f"Individual Tests: {len(self.results)} passed, {len(self.failures)} failed")
        print(f"Chat Functionality: {'✅ Working' if chat_working else '❌ Broken'}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.results:
            print(f"\n✅ WORKING SERVICES:")
            for result in self.results:
                print(f"  - {result['service']} (port {result['port']})")
        
        if self.failures:
            print(f"\n❌ FAILED SERVICES:")
            for failure in self.failures:
                print(f"  - {failure['service']} (port {failure.get('port', 'unknown')}): {failure['error']}")
        
        # Overall assessment
        if success_rate >= 80 and chat_working:
            print(f"\n🎯 SYSTEM STATUS: WORKING WELL")
        elif success_rate >= 50:
            print(f"\n⚠️  SYSTEM STATUS: PARTIALLY WORKING")
        else:
            print(f"\n❌ SYSTEM STATUS: BROKEN")
        
        # Save detailed report
        report = {
            "timestamp": datetime.now().isoformat(),
            "api_gateway_health": f"{gateway_healthy}/{gateway_total}",
            "load_balancer_health": f"{lb_healthy}/{lb_total}",
            "chat_functionality": chat_working,
            "individual_tests": {
                "total": total_tests,
                "passed": len(self.results),
                "failed": len(self.failures),
                "success_rate": success_rate
            },
            "working_services": self.results,
            "failed_services": self.failures,
            "overall_status": "WORKING WELL" if success_rate >= 80 and chat_working else "PARTIALLY WORKING" if success_rate >= 50 else "BROKEN"
        }
        
        with open("/workspace/real-go-system-test-report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Detailed report saved to: /workspace/real-go-system-test-report.json")

def main():
    tester = RealGoSystemTester()
    tester.test_all_services()

if __name__ == "__main__":
    main()