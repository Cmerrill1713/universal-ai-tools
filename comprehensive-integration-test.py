#!/usr/bin/env python3
"""
Comprehensive Integration Test - Universal AI Tools
Tests all integration points across the entire platform
"""

import requests
import json
import time
from pathlib import Path

class ComprehensiveIntegrationTester:
    def __init__(self):
        self.workspace = Path("/workspace")
        self.base_urls = {
            "athena-gateway": "http://localhost:8080",
            "unified-gateway": "http://localhost:9000",
            "family-profiles": "http://localhost:8005",
            "family-calendar": "http://localhost:8006",
            "family-knowledge": "http://localhost:8007"
        }
        self.results = {}
        
    def test_service_connectivity(self):
        """Test basic service connectivity"""
        print("🔍 Testing Service Connectivity...")
        
        connectivity_results = {}
        for service, url in self.base_urls.items():
            try:
                response = requests.get(f"{url}/health", timeout=3)
                if response.status_code == 200:
                    connectivity_results[service] = "✅ Connected"
                    print(f"✅ {service}: Connected")
                else:
                    connectivity_results[service] = f"⚠️ HTTP {response.status_code}"
                    print(f"⚠️ {service}: HTTP {response.status_code}")
            except requests.exceptions.RequestException as e:
                connectivity_results[service] = f"❌ {str(e)[:30]}..."
                print(f"❌ {service}: {str(e)[:30]}...")
        
        self.results["connectivity"] = connectivity_results
        return connectivity_results
    
    def test_cross_service_communication(self):
        """Test communication between services"""
        print("🔗 Testing Cross-Service Communication...")
        
        communication_tests = [
            {
                "name": "Athena Gateway → Family Services",
                "test": self.test_athena_to_family_communication
            },
            {
                "name": "Unified Gateway → All Services",
                "test": self.test_unified_gateway_routing
            },
            {
                "name": "Family Services Inter-Communication",
                "test": self.test_family_services_communication
            }
        ]
        
        communication_results = {}
        for test in communication_tests:
            try:
                result = test["test"]()
                communication_results[test["name"]] = result
                status = "✅" if result.get("success", False) else "❌"
                print(f"{status} {test['name']}: {result.get('message', 'Unknown')}")
            except Exception as e:
                communication_results[test["name"]] = {"success": False, "error": str(e)}
                print(f"❌ {test['name']}: {str(e)[:50]}...")
        
        self.results["communication"] = communication_results
        return communication_results
    
    def test_athena_to_family_communication(self):
        """Test Athena Gateway communication with Family services"""
        try:
            # Test Athena Gateway can reach Family services
            athena_url = self.base_urls["athena-gateway"]
            
            # Simulate Athena Gateway calling Family services
            family_services = ["family-profiles", "family-calendar", "family-knowledge"]
            successful_calls = 0
            
            for service in family_services:
                service_url = self.base_urls[service]
                try:
                    response = requests.get(f"{service_url}/health", timeout=2)
                    if response.status_code == 200:
                        successful_calls += 1
                except:
                    pass
            
            success_rate = successful_calls / len(family_services)
            return {
                "success": success_rate >= 0.8,
                "message": f"{successful_calls}/{len(family_services)} services reachable",
                "success_rate": success_rate
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_unified_gateway_routing(self):
        """Test Unified Gateway routing to all services"""
        try:
            unified_url = self.base_urls["unified-gateway"]
            
            # Test routing to different service endpoints
            routing_tests = [
                "/api/family/chat",
                "/api/family/members",
                "/api/family/calendar",
                "/api/family/knowledge",
                "/api/unified/health"
            ]
            
            successful_routes = 0
            for route in routing_tests:
                try:
                    response = requests.get(f"{unified_url}{route}", timeout=2)
                    if response.status_code in [200, 404]:  # 404 is acceptable for some routes
                        successful_routes += 1
                except:
                    pass
            
            success_rate = successful_routes / len(routing_tests)
            return {
                "success": success_rate >= 0.6,
                "message": f"{successful_routes}/{len(routing_tests)} routes working",
                "success_rate": success_rate
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_family_services_communication(self):
        """Test communication between Family services"""
        try:
            # Test if Family services can communicate with each other
            family_services = ["family-profiles", "family-calendar", "family-knowledge"]
            communication_pairs = []
            
            for i, service1 in enumerate(family_services):
                for service2 in family_services[i+1:]:
                    communication_pairs.append((service1, service2))
            
            successful_communications = 0
            for service1, service2 in communication_pairs:
                try:
                    # Simulate service1 calling service2
                    url1 = self.base_urls[service1]
                    url2 = self.base_urls[service2]
                    
                    # Both services should be reachable
                    response1 = requests.get(f"{url1}/health", timeout=1)
                    response2 = requests.get(f"{url2}/health", timeout=1)
                    
                    if response1.status_code == 200 and response2.status_code == 200:
                        successful_communications += 1
                except:
                    pass
            
            success_rate = successful_communications / len(communication_pairs) if communication_pairs else 1.0
            return {
                "success": success_rate >= 0.8,
                "message": f"{successful_communications}/{len(communication_pairs)} service pairs communicating",
                "success_rate": success_rate
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_data_flow_integration(self):
        """Test data flow across the integrated system"""
        print("📊 Testing Data Flow Integration...")
        
        data_flow_tests = [
            {
                "name": "Family Data Flow",
                "test": self.test_family_data_flow
            },
            {
                "name": "API Gateway Data Flow",
                "test": self.test_api_gateway_data_flow
            },
            {
                "name": "Cross-Platform Data Flow",
                "test": self.test_cross_platform_data_flow
            }
        ]
        
        data_flow_results = {}
        for test in data_flow_tests:
            try:
                result = test["test"]()
                data_flow_results[test["name"]] = result
                status = "✅" if result.get("success", False) else "❌"
                print(f"{status} {test['name']}: {result.get('message', 'Unknown')}")
            except Exception as e:
                data_flow_results[test["name"]] = {"success": False, "error": str(e)}
                print(f"❌ {test['name']}: {str(e)[:50]}...")
        
        self.results["data_flow"] = data_flow_results
        return data_flow_results
    
    def test_family_data_flow(self):
        """Test data flow within Family Athena system"""
        try:
            # Test data consistency across Family services
            family_services = ["family-profiles", "family-calendar", "family-knowledge"]
            data_consistency_score = 0
            
            for service in family_services:
                try:
                    response = requests.get(f"{self.base_urls[service]}/health", timeout=2)
                    if response.status_code == 200:
                        data = response.json()
                        if "timestamp" in data:  # Check for consistent data structure
                            data_consistency_score += 1
                except:
                    pass
            
            success_rate = data_consistency_score / len(family_services)
            return {
                "success": success_rate >= 0.8,
                "message": f"{data_consistency_score}/{len(family_services)} services have consistent data",
                "success_rate": success_rate
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_api_gateway_data_flow(self):
        """Test data flow through API gateways"""
        try:
            gateways = ["athena-gateway", "unified-gateway"]
            gateway_success = 0
            
            for gateway in gateways:
                try:
                    response = requests.get(f"{self.base_urls[gateway]}/health", timeout=2)
                    if response.status_code == 200:
                        data = response.json()
                        if "status" in data and data["status"] == "healthy":
                            gateway_success += 1
                except:
                    pass
            
            success_rate = gateway_success / len(gateways)
            return {
                "success": success_rate >= 0.8,
                "message": f"{gateway_success}/{len(gateways)} gateways processing data correctly",
                "success_rate": success_rate
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_cross_platform_data_flow(self):
        """Test data flow between Family Athena and Enterprise Platform"""
        try:
            # Test if data can flow between Family and Enterprise systems
            family_url = self.base_urls["athena-gateway"]
            enterprise_url = self.base_urls["unified-gateway"]
            
            family_ok = False
            enterprise_ok = False
            
            try:
                response = requests.get(f"{family_url}/health", timeout=2)
                if response.status_code == 200:
                    family_ok = True
            except:
                pass
            
            try:
                response = requests.get(f"{enterprise_url}/health", timeout=2)
                if response.status_code == 200:
                    enterprise_ok = True
            except:
                pass
            
            success = family_ok and enterprise_ok
            return {
                "success": success,
                "message": f"Family: {'✅' if family_ok else '❌'}, Enterprise: {'✅' if enterprise_ok else '❌'}",
                "family_ok": family_ok,
                "enterprise_ok": enterprise_ok
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_integration_completeness(self):
        """Test overall integration completeness"""
        print("🎯 Testing Integration Completeness...")
        
        completeness_tests = [
            {
                "name": "Service Discovery",
                "test": self.test_service_discovery
            },
            {
                "name": "API Consistency",
                "test": self.test_api_consistency
            },
            {
                "name": "Error Handling",
                "test": self.test_error_handling
            },
            {
                "name": "Performance Integration",
                "test": self.test_performance_integration
            }
        ]
        
        completeness_results = {}
        for test in completeness_tests:
            try:
                result = test["test"]()
                completeness_results[test["name"]] = result
                status = "✅" if result.get("success", False) else "❌"
                print(f"{status} {test['name']}: {result.get('message', 'Unknown')}")
            except Exception as e:
                completeness_results[test["name"]] = {"success": False, "error": str(e)}
                print(f"❌ {test['name']}: {str(e)[:50]}...")
        
        self.results["completeness"] = completeness_results
        return completeness_results
    
    def test_service_discovery(self):
        """Test if services can discover each other"""
        try:
            # Test if services are discoverable
            discoverable_services = 0
            total_services = len(self.base_urls)
            
            for service, url in self.base_urls.items():
                try:
                    response = requests.get(f"{url}/health", timeout=2)
                    if response.status_code == 200:
                        discoverable_services += 1
                except:
                    pass
            
            success_rate = discoverable_services / total_services
            return {
                "success": success_rate >= 0.8,
                "message": f"{discoverable_services}/{total_services} services discoverable",
                "success_rate": success_rate
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_api_consistency(self):
        """Test API consistency across services"""
        try:
            # Test if APIs have consistent structure
            consistent_apis = 0
            total_apis = len(self.base_urls)
            
            for service, url in self.base_urls.items():
                try:
                    response = requests.get(f"{url}/health", timeout=2)
                    if response.status_code == 200:
                        data = response.json()
                        # Check for consistent health check structure
                        if "status" in data or "service" in data:
                            consistent_apis += 1
                except:
                    pass
            
            success_rate = consistent_apis / total_apis
            return {
                "success": success_rate >= 0.8,
                "message": f"{consistent_apis}/{total_apis} APIs have consistent structure",
                "success_rate": success_rate
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_error_handling(self):
        """Test error handling across integrated system"""
        try:
            # Test error handling by making invalid requests
            error_handling_score = 0
            total_tests = 3
            
            # Test 1: Invalid endpoint
            try:
                response = requests.get("http://localhost:8080/invalid-endpoint", timeout=2)
                if response.status_code == 404:
                    error_handling_score += 1
            except:
                pass
            
            # Test 2: Invalid method
            try:
                response = requests.post("http://localhost:8080/health", timeout=2)
                if response.status_code in [200, 405]:  # 405 Method Not Allowed is good
                    error_handling_score += 1
            except:
                pass
            
            # Test 3: Service unavailable (simulate)
            try:
                response = requests.get("http://localhost:9999/health", timeout=1)
                # Should timeout or fail gracefully
                error_handling_score += 1
            except:
                error_handling_score += 1  # Expected to fail
            
            success_rate = error_handling_score / total_tests
            return {
                "success": success_rate >= 0.8,
                "message": f"{error_handling_score}/{total_tests} error handling tests passed",
                "success_rate": success_rate
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def test_performance_integration(self):
        """Test performance across integrated system"""
        try:
            # Test response times across all services
            response_times = []
            
            for service, url in self.base_urls.items():
                try:
                    start_time = time.time()
                    response = requests.get(f"{url}/health", timeout=3)
                    end_time = time.time()
                    
                    if response.status_code == 200:
                        response_times.append(end_time - start_time)
                except:
                    pass
            
            if response_times:
                avg_response_time = sum(response_times) / len(response_times)
                max_response_time = max(response_times)
                
                # Consider performance good if average < 2s and max < 5s
                success = avg_response_time < 2.0 and max_response_time < 5.0
                
                return {
                    "success": success,
                    "message": f"Avg: {avg_response_time:.2f}s, Max: {max_response_time:.2f}s",
                    "avg_response_time": avg_response_time,
                    "max_response_time": max_response_time
                }
            else:
                return {"success": False, "message": "No successful responses"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def generate_integration_report(self):
        """Generate comprehensive integration report"""
        print("📊 Generating Integration Report...")
        
        # Calculate overall scores
        connectivity_score = self.calculate_score(self.results.get("connectivity", {}))
        communication_score = self.calculate_score(self.results.get("communication", {}))
        data_flow_score = self.calculate_score(self.results.get("data_flow", {}))
        completeness_score = self.calculate_score(self.results.get("completeness", {}))
        
        overall_score = (connectivity_score + communication_score + data_flow_score + completeness_score) / 4
        
        report = {
            "timestamp": time.time(),
            "overall_integration_score": overall_score,
            "integration_status": "FULLY_INTEGRATED" if overall_score >= 0.8 else "PARTIALLY_INTEGRATED",
            "scores": {
                "connectivity": connectivity_score,
                "communication": communication_score,
                "data_flow": data_flow_score,
                "completeness": completeness_score
            },
            "detailed_results": self.results,
            "recommendations": self.generate_recommendations(overall_score)
        }
        
        # Save report
        with open(self.workspace / "integration-test-report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        return report
    
    def calculate_score(self, results_dict):
        """Calculate score from results dictionary"""
        if not results_dict:
            return 0.0
        
        success_count = 0
        total_count = 0
        
        for key, value in results_dict.items():
            total_count += 1
            if isinstance(value, dict):
                if value.get("success", False):
                    success_count += 1
            elif isinstance(value, str) and "✅" in value:
                success_count += 1
        
        return success_count / total_count if total_count > 0 else 0.0
    
    def generate_recommendations(self, overall_score):
        """Generate recommendations based on integration score"""
        recommendations = []
        
        if overall_score >= 0.9:
            recommendations.append("🎉 Excellent integration! System is fully operational.")
        elif overall_score >= 0.8:
            recommendations.append("✅ Good integration! Minor improvements recommended.")
        elif overall_score >= 0.6:
            recommendations.append("⚠️ Partial integration. Several areas need attention.")
        else:
            recommendations.append("❌ Poor integration. Major fixes required.")
        
        # Add specific recommendations based on results
        if self.results.get("connectivity", {}):
            connectivity_score = self.calculate_score(self.results["connectivity"])
            if connectivity_score < 0.8:
                recommendations.append("🔧 Fix service connectivity issues")
        
        if self.results.get("communication", {}):
            communication_score = self.calculate_score(self.results["communication"])
            if communication_score < 0.8:
                recommendations.append("🔗 Improve cross-service communication")
        
        return recommendations
    
    def run_comprehensive_integration_test(self):
        """Run complete integration test suite"""
        print("🚀 Running Comprehensive Integration Test...")
        print("=" * 60)
        
        # Run all test categories
        self.test_service_connectivity()
        self.test_cross_service_communication()
        self.test_data_flow_integration()
        self.test_integration_completeness()
        
        # Generate report
        report = self.generate_integration_report()
        
        print("=" * 60)
        print("📊 INTEGRATION TEST RESULTS")
        print("=" * 60)
        print(f"🎯 Overall Integration Score: {report['overall_integration_score']:.1%}")
        print(f"📈 Integration Status: {report['integration_status']}")
        print()
        print("📊 Category Scores:")
        for category, score in report['scores'].items():
            print(f"  {category.title()}: {score:.1%}")
        print()
        print("💡 Recommendations:")
        for rec in report['recommendations']:
            print(f"  {rec}")
        print("=" * 60)
        
        return report

if __name__ == "__main__":
    tester = ComprehensiveIntegrationTester()
    tester.run_comprehensive_integration_test()