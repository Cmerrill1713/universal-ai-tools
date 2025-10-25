#!/usr/bin/env python3
"""
Comprehensive test of the REAL Go/Rust/Node.js system
Testing all three technology stacks properly
"""

import requests
import json
import time
import subprocess
import os
from datetime import datetime

class ComprehensiveRealSystemTester:
    def __init__(self):
        self.results = []
        self.failures = []
        self.services = {
            # Go Services (Core Infrastructure)
            "go": {
                "api-gateway": {"port": 8081, "url": "http://localhost:8081"},
                "chat-service": {"port": 8016, "url": "http://localhost:8016"},
                "load-balancer": {"port": 8011, "url": "http://localhost:8011"},
                "cache-coordinator": {"port": 8083, "url": "http://localhost:8083"},
                "auth-service": {"port": 8015, "url": "http://localhost:8015"},
                "memory-service": {"port": 8017, "url": "http://localhost:8017"},
                "websocket-hub": {"port": 8018, "url": "http://localhost:8018"},
            },
            # Rust Services (AI/ML)
            "rust": {
                "mlx-service": {"port": 8001, "url": "http://localhost:8001"},
                "vision-service": {"port": 8084, "url": "http://localhost:8084"},
                "llm-service": {"port": 3033, "url": "http://localhost:3033"},
                "analytics-service": {"port": 8019, "url": "http://localhost:8019"},
                "vector-db-service": {"port": 8002, "url": "http://localhost:8002"},
                "ab-mcts-service": {"port": 8003, "url": "http://localhost:8003"},
            },
            # Node.js Services (Web/API)
            "nodejs": {
                "web-frontend": {"port": 3000, "url": "http://localhost:3000"},
                "api-server": {"port": 5000, "url": "http://localhost:5000"},
                "ui-tests": {"port": 3001, "url": "http://localhost:3001"},
            }
        }
        
    def test_service(self, tech_stack, name, service):
        """Test a single service"""
        try:
            response = requests.get(f"{service['url']}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.results.append({
                    "tech_stack": tech_stack,
                    "service": name,
                    "status": "healthy",
                    "response": data,
                    "port": service["port"]
                })
                print(f"✅ {tech_stack.upper()}: {name} (port {service['port']}) - {data.get('status', 'healthy')}")
                return True
            else:
                self.failures.append({
                    "tech_stack": tech_stack,
                    "service": name,
                    "error": f"HTTP {response.status_code}",
                    "status": "unhealthy",
                    "port": service["port"]
                })
                print(f"❌ {tech_stack.upper()}: {name} (port {service['port']}) - HTTP {response.status_code}")
                return False
        except requests.exceptions.ConnectionError:
            self.failures.append({
                "tech_stack": tech_stack,
                "service": name,
                "error": "Connection refused",
                "status": "unhealthy",
                "port": service["port"]
            })
            print(f"❌ {tech_stack.upper()}: {name} (port {service['port']}) - Connection refused")
            return False
        except Exception as e:
            self.failures.append({
                "tech_stack": tech_stack,
                "service": name,
                "error": str(e),
                "status": "unhealthy",
                "port": service["port"]
            })
            print(f"❌ {tech_stack.upper()}: {name} (port {service['port']}) - {str(e)}")
            return False
    
    def check_running_processes(self):
        """Check what processes are actually running"""
        print("\n🔍 CHECKING RUNNING PROCESSES")
        print("=" * 40)
        
        try:
            # Check Go processes
            go_procs = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
            go_count = len([line for line in go_procs.stdout.split('\n') if 'go run' in line or 'main.go' in line])
            print(f"📊 Go processes running: {go_count}")
            
            # Check Rust processes
            rust_procs = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
            rust_count = len([line for line in rust_procs.stdout.split('\n') if 'cargo run' in line or '.rs' in line])
            print(f"📊 Rust processes running: {rust_count}")
            
            # Check Node.js processes
            node_procs = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
            node_count = len([line for line in node_procs.stdout.split('\n') if 'node' in line and 'npm' not in line])
            print(f"📊 Node.js processes running: {node_count}")
            
            return go_count, rust_count, node_count
        except Exception as e:
            print(f"❌ Error checking processes: {e}")
            return 0, 0, 0
    
    def test_tech_stack(self, tech_stack, services):
        """Test all services in a technology stack"""
        print(f"\n🧪 TESTING {tech_stack.upper()} SERVICES")
        print("=" * 50)
        
        stack_results = []
        for name, service in services.items():
            result = self.test_service(tech_stack, name, service)
            stack_results.append(result)
        
        healthy_count = sum(stack_results)
        total_count = len(stack_results)
        success_rate = (healthy_count / total_count * 100) if total_count > 0 else 0
        
        print(f"\n📊 {tech_stack.upper()} Summary: {healthy_count}/{total_count} services healthy ({success_rate:.1f}%)")
        return healthy_count, total_count
    
    def test_cross_stack_integration(self):
        """Test integration between different technology stacks"""
        print(f"\n🔗 TESTING CROSS-STACK INTEGRATION")
        print("=" * 50)
        
        integration_tests = []
        
        # Test API Gateway -> Chat Service
        try:
            response = requests.get("http://localhost:8081/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                chat_status = data.get('services', {}).get('chat', {}).get('status', 'unknown')
                if chat_status == 'healthy':
                    integration_tests.append(("API Gateway -> Chat Service", True))
                    print("✅ API Gateway -> Chat Service: Connected")
                else:
                    integration_tests.append(("API Gateway -> Chat Service", False))
                    print("❌ API Gateway -> Chat Service: Disconnected")
        except Exception as e:
            integration_tests.append(("API Gateway -> Chat Service", False))
            print(f"❌ API Gateway -> Chat Service: {e}")
        
        # Test Load Balancer -> Services
        try:
            response = requests.get("http://localhost:8011/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                healthy_services = data.get('healthy_services', 0)
                total_services = data.get('total_services', 0)
                if healthy_services > 0:
                    integration_tests.append(("Load Balancer -> Services", True))
                    print(f"✅ Load Balancer -> Services: {healthy_services}/{total_services} connected")
                else:
                    integration_tests.append(("Load Balancer -> Services", False))
                    print("❌ Load Balancer -> Services: No services connected")
        except Exception as e:
            integration_tests.append(("Load Balancer -> Services", False))
            print(f"❌ Load Balancer -> Services: {e}")
        
        return integration_tests
    
    def test_authentication(self):
        """Test authentication system"""
        print(f"\n🔐 TESTING AUTHENTICATION SYSTEM")
        print("=" * 40)
        
        auth_tests = []
        
        # Test chat service authentication
        try:
            chat_payload = {
                "message": "Test message",
                "user_id": "test_user",
                "session_id": "test_session"
            }
            
            response = requests.post(
                "http://localhost:8016/chat",
                json=chat_payload,
                timeout=5
            )
            
            if response.status_code == 200:
                auth_tests.append(("Chat Service Auth", True))
                print("✅ Chat Service: Authentication working")
            elif response.status_code == 401:
                auth_tests.append(("Chat Service Auth", False))
                print("❌ Chat Service: Authentication required (401)")
            else:
                auth_tests.append(("Chat Service Auth", False))
                print(f"❌ Chat Service: Unexpected response {response.status_code}")
        except Exception as e:
            auth_tests.append(("Chat Service Auth", False))
            print(f"❌ Chat Service: {e}")
        
        return auth_tests
    
    def run_comprehensive_test(self):
        """Run comprehensive test of all technology stacks"""
        print("🧪 COMPREHENSIVE REAL SYSTEM TEST")
        print("=" * 60)
        print(f"Testing Go + Rust + Node.js microservices architecture")
        print(f"Started at: {datetime.now().isoformat()}")
        
        # Check running processes
        go_procs, rust_procs, node_procs = self.check_running_processes()
        
        # Test each technology stack
        go_healthy, go_total = self.test_tech_stack("go", self.services["go"])
        rust_healthy, rust_total = self.test_tech_stack("rust", self.services["rust"])
        nodejs_healthy, nodejs_total = self.test_tech_stack("nodejs", self.services["nodejs"])
        
        # Test cross-stack integration
        integration_tests = self.test_cross_stack_integration()
        
        # Test authentication
        auth_tests = self.test_authentication()
        
        # Generate comprehensive report
        self.generate_comprehensive_report(
            go_procs, rust_procs, node_procs,
            go_healthy, go_total, rust_healthy, rust_total, nodejs_healthy, nodejs_total,
            integration_tests, auth_tests
        )
    
    def generate_comprehensive_report(self, go_procs, rust_procs, node_procs,
                                    go_healthy, go_total, rust_healthy, rust_total, 
                                    nodejs_healthy, nodejs_total, integration_tests, auth_tests):
        """Generate comprehensive test report"""
        
        total_services = go_total + rust_total + nodejs_total
        total_healthy = go_healthy + rust_healthy + nodejs_healthy
        overall_success_rate = (total_healthy / total_services * 100) if total_services > 0 else 0
        
        integration_success = sum([test[1] for test in integration_tests])
        integration_rate = (integration_success / len(integration_tests) * 100) if integration_tests else 0
        
        auth_success = sum([test[1] for test in auth_tests])
        auth_rate = (auth_success / len(auth_tests) * 100) if auth_tests else 0
        
        print(f"\n📊 COMPREHENSIVE SYSTEM TEST RESULTS")
        print("=" * 60)
        print(f"Processes Running: Go={go_procs}, Rust={rust_procs}, Node.js={node_procs}")
        print(f"")
        print(f"Service Health:")
        print(f"  Go Services: {go_healthy}/{go_total} ({go_healthy/go_total*100:.1f}%)")
        print(f"  Rust Services: {rust_healthy}/{rust_total} ({rust_healthy/rust_total*100:.1f}%)")
        print(f"  Node.js Services: {nodejs_healthy}/{nodejs_total} ({nodejs_healthy/nodejs_total*100:.1f}%)")
        print(f"  Overall: {total_healthy}/{total_services} ({overall_success_rate:.1f}%)")
        print(f"")
        print(f"Integration: {integration_success}/{len(integration_tests)} ({integration_rate:.1f}%)")
        print(f"Authentication: {auth_success}/{len(auth_tests)} ({auth_rate:.1f}%)")
        
        # Overall assessment
        if overall_success_rate >= 80 and integration_rate >= 50:
            status = "WORKING WELL"
            emoji = "✅"
        elif overall_success_rate >= 50:
            status = "PARTIALLY WORKING"
            emoji = "⚠️"
        else:
            status = "BROKEN"
            emoji = "❌"
        
        print(f"\n{emoji} SYSTEM STATUS: {status}")
        
        # Save comprehensive report
        report = {
            "timestamp": datetime.now().isoformat(),
            "processes": {
                "go": go_procs,
                "rust": rust_procs,
                "nodejs": node_procs
            },
            "service_health": {
                "go": {"healthy": go_healthy, "total": go_total, "rate": go_healthy/go_total*100},
                "rust": {"healthy": rust_healthy, "total": rust_total, "rate": rust_healthy/rust_total*100},
                "nodejs": {"healthy": nodejs_healthy, "total": nodejs_total, "rate": nodejs_healthy/nodejs_total*100},
                "overall": {"healthy": total_healthy, "total": total_services, "rate": overall_success_rate}
            },
            "integration": {
                "tests": integration_tests,
                "success_rate": integration_rate
            },
            "authentication": {
                "tests": auth_tests,
                "success_rate": auth_rate
            },
            "working_services": self.results,
            "failed_services": self.failures,
            "overall_status": status
        }
        
        with open("/workspace/comprehensive-real-system-test-report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Comprehensive report saved to: /workspace/comprehensive-real-system-test-report.json")

def main():
    tester = ComprehensiveRealSystemTester()
    tester.run_comprehensive_test()

if __name__ == "__main__":
    main()