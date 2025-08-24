#!/usr/bin/env swift

import Foundation
import CoreFoundation

struct IntegrationTest {
    
    // Test configuration
    static let goAPIGatewayURL = "http://localhost:8081"
    static let rustAICoreURL = "http://localhost:8009"
    
    // Test results tracking
    struct TestResult {
        let name: String
        let success: Bool
        let responseTime: TimeInterval
        let details: String
    }
    
    var results: [TestResult] = []
    
    // MARK: - Main test runner
    
    mutating func runAllTests() async {
        print("🚀 Starting End-to-End Integration Tests for Universal AI Tools")
        print("=" * 80)
        
        // Test 1: Backend Services Health Check
        await testBackendHealth()
        
        // Test 2: Go API Gateway Agents Endpoint  
        await testAgentsEndpoint()
        
        // Test 3: Chat API Integration
        await testChatAPI()
        
        // Test 4: News API Integration
        await testNewsAPI()
        
        // Test 5: Rust AI Core Integration
        await testRustAICore()
        
        // Test 6: Service Discovery
        await testServiceDiscovery()
        
        // Generate test report
        generateReport()
    }
    
    // MARK: - Individual Tests
    
    mutating func testBackendHealth() async {
        print("🔍 Testing Backend Services Health...")
        
        let startTime = Date()
        
        do {
            let goHealthURL = URL(string: "\(Self.goAPIGatewayURL)/api/v1/health")!
            let (_, goResponse) = try await URLSession.shared.data(from: goHealthURL)
            
            let rustHealthURL = URL(string: "\(Self.rustAICoreURL)/health")!
            let (_, rustResponse) = try await URLSession.shared.data(from: rustHealthURL)
            
            let responseTime = Date().timeIntervalSince(startTime)
            
            if let goHTTPResponse = goResponse as? HTTPURLResponse, goHTTPResponse.statusCode == 200,
               let rustHTTPResponse = rustResponse as? HTTPURLResponse, rustHTTPResponse.statusCode == 200 {
                
                results.append(TestResult(
                    name: "Backend Health Check",
                    success: true,
                    responseTime: responseTime,
                    details: "✅ Both Go API Gateway and Rust AI Core are healthy"
                ))
                print("✅ Backend services are healthy (\(Int(responseTime * 1000))ms)")
                
            } else {
                results.append(TestResult(
                    name: "Backend Health Check", 
                    success: false,
                    responseTime: responseTime,
                    details: "❌ One or both backend services are unhealthy"
                ))
                print("❌ Backend services health check failed")
            }
            
        } catch {
            results.append(TestResult(
                name: "Backend Health Check",
                success: false, 
                responseTime: Date().timeIntervalSince(startTime),
                details: "❌ Error: \(error.localizedDescription)"
            ))
            print("❌ Backend health check error: \(error)")
        }
    }
    
    mutating func testAgentsEndpoint() async {
        print("🤖 Testing Agents API Endpoint...")
        
        let startTime = Date()
        
        do {
            let url = URL(string: "\(Self.goAPIGatewayURL)/api/v1/agents/")!
            let (data, response) = try await URLSession.shared.data(from: url)
            
            let responseTime = Date().timeIntervalSince(startTime)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TestError.invalidResponse
            }
            
            if httpResponse.statusCode == 200 {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = json["success"] as? Bool, success == true,
                   let responseData = json["data"] as? [String: Any],
                   let agents = responseData["agents"] as? [[String: Any]] {
                    
                    results.append(TestResult(
                        name: "Agents Endpoint",
                        success: true,
                        responseTime: responseTime,
                        details: "✅ Retrieved \(agents.count) agents successfully"
                    ))
                    print("✅ Agents endpoint working: \(agents.count) agents (\(Int(responseTime * 1000))ms)")
                    
                } else {
                    results.append(TestResult(
                        name: "Agents Endpoint",
                        success: false,
                        responseTime: responseTime,
                        details: "❌ Invalid response format"
                    ))
                    print("❌ Invalid agents response format")
                }
                
            } else {
                results.append(TestResult(
                    name: "Agents Endpoint", 
                    success: false,
                    responseTime: responseTime,
                    details: "❌ HTTP \(httpResponse.statusCode)"
                ))
                print("❌ Agents endpoint failed: HTTP \(httpResponse.statusCode)")
            }
            
        } catch {
            results.append(TestResult(
                name: "Agents Endpoint",
                success: false,
                responseTime: Date().timeIntervalSince(startTime),
                details: "❌ Error: \(error.localizedDescription)"
            ))
            print("❌ Agents endpoint error: \(error)")
        }
    }
    
    mutating func testChatAPI() async {
        print("💬 Testing Chat API...")
        
        let startTime = Date()
        
        do {
            let url = URL(string: "\(Self.goAPIGatewayURL)/api/v1/chat/")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let payload: [String: Any] = [
                "message": "Hello, this is an integration test. Please respond briefly.",
                "agentName": "claude-assistant",
                "includeCodeContext": false,
                "forceRealAI": false
            ]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            
            let (data, response) = try await URLSession.shared.data(for: request)
            let responseTime = Date().timeIntervalSince(startTime)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TestError.invalidResponse
            }
            
            if httpResponse.statusCode == 200 {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = json["success"] as? Bool, success == true,
                   let responseData = json["data"] as? [String: Any],
                   let message = responseData["message"] as? String {
                    
                    results.append(TestResult(
                        name: "Chat API",
                        success: true,
                        responseTime: responseTime,
                        details: "✅ Chat response received: '\(String(message.prefix(50)))...'"
                    ))
                    print("✅ Chat API working: response received (\(Int(responseTime * 1000))ms)")
                    
                } else {
                    results.append(TestResult(
                        name: "Chat API",
                        success: false,
                        responseTime: responseTime,
                        details: "❌ Invalid chat response format"
                    ))
                    print("❌ Invalid chat response format")
                }
                
            } else {
                results.append(TestResult(
                    name: "Chat API",
                    success: false,
                    responseTime: responseTime,
                    details: "❌ HTTP \(httpResponse.statusCode)"
                ))
                print("❌ Chat API failed: HTTP \(httpResponse.statusCode)")
            }
            
        } catch {
            results.append(TestResult(
                name: "Chat API",
                success: false,
                responseTime: Date().timeIntervalSince(startTime),
                details: "❌ Error: \(error.localizedDescription)"
            ))
            print("❌ Chat API error: \(error)")
        }
    }
    
    mutating func testNewsAPI() async {
        print("📰 Testing News API...")
        
        let startTime = Date()
        
        do {
            let url = URL(string: "\(Self.goAPIGatewayURL)/api/v1/news?limit=5")!
            let (data, response) = try await URLSession.shared.data(from: url)
            
            let responseTime = Date().timeIntervalSince(startTime)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TestError.invalidResponse
            }
            
            if httpResponse.statusCode == 200 {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = json["success"] as? Bool, success == true,
                   let responseData = json["data"] as? [String: Any],
                   let newsItems = responseData["items"] as? [[String: Any]] {
                    
                    results.append(TestResult(
                        name: "News API",
                        success: true,
                        responseTime: responseTime,
                        details: "✅ Retrieved \(newsItems.count) news items"
                    ))
                    print("✅ News API working: \(newsItems.count) items (\(Int(responseTime * 1000))ms)")
                    
                } else {
                    results.append(TestResult(
                        name: "News API",
                        success: false,
                        responseTime: responseTime,
                        details: "❌ Invalid news response format"
                    ))
                    print("❌ Invalid news response format")
                }
                
            } else {
                results.append(TestResult(
                    name: "News API",
                    success: false,
                    responseTime: responseTime,
                    details: "❌ HTTP \(httpResponse.statusCode)"
                ))
                print("❌ News API failed: HTTP \(httpResponse.statusCode)")
            }
            
        } catch {
            results.append(TestResult(
                name: "News API",
                success: false,
                responseTime: Date().timeIntervalSince(startTime),
                details: "❌ Error: \(error.localizedDescription)"
            ))
            print("❌ News API error: \(error)")
        }
    }
    
    mutating func testRustAICore() async {
        print("🦀 Testing Rust AI Core Service...")
        
        let startTime = Date()
        
        do {
            let statusURL = URL(string: "\(Self.rustAICoreURL)/status")!
            let (data, response) = try await URLSession.shared.data(from: statusURL)
            
            let responseTime = Date().timeIntervalSince(startTime)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TestError.invalidResponse
            }
            
            if httpResponse.statusCode == 200 {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let status = json["status"] as? String,
                   let providersActive = json["providers_active"] as? Int {
                    
                    results.append(TestResult(
                        name: "Rust AI Core",
                        success: true,
                        responseTime: responseTime,
                        details: "✅ Status: \(status), \(providersActive) providers active"
                    ))
                    print("✅ Rust AI Core working: \(status), \(providersActive) providers (\(Int(responseTime * 1000))ms)")
                    
                } else {
                    results.append(TestResult(
                        name: "Rust AI Core",
                        success: false,
                        responseTime: responseTime,
                        details: "❌ Invalid status response format"
                    ))
                    print("❌ Invalid Rust AI Core status format")
                }
                
            } else {
                results.append(TestResult(
                    name: "Rust AI Core",
                    success: false,
                    responseTime: responseTime,
                    details: "❌ HTTP \(httpResponse.statusCode)"
                ))
                print("❌ Rust AI Core failed: HTTP \(httpResponse.statusCode)")
            }
            
        } catch {
            results.append(TestResult(
                name: "Rust AI Core",
                success: false,
                responseTime: Date().timeIntervalSince(startTime),
                details: "❌ Error: \(error.localizedDescription)"
            ))
            print("❌ Rust AI Core error: \(error)")
        }
    }
    
    mutating func testServiceDiscovery() async {
        print("🔍 Testing Service Discovery...")
        
        let startTime = Date()
        let services = [
            ("Go API Gateway", Self.goAPIGatewayURL),
            ("Rust AI Core", Self.rustAICoreURL)
        ]
        
        var discoveredServices: [String] = []
        
        for (name, baseURL) in services {
            do {
                let healthURL = baseURL == Self.goAPIGatewayURL 
                    ? URL(string: "\(baseURL)/api/v1/health")!
                    : URL(string: "\(baseURL)/health")!
                
                let (_, response) = try await URLSession.shared.data(from: healthURL)
                
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    discoveredServices.append(name)
                }
            } catch {
                // Service not discoverable
            }
        }
        
        let responseTime = Date().timeIntervalSince(startTime)
        
        if discoveredServices.count == services.count {
            results.append(TestResult(
                name: "Service Discovery",
                success: true,
                responseTime: responseTime,
                details: "✅ All \(services.count) services discovered: \(discoveredServices.joined(separator: ", "))"
            ))
            print("✅ Service discovery: All services found (\(Int(responseTime * 1000))ms)")
        } else {
            results.append(TestResult(
                name: "Service Discovery",
                success: false,
                responseTime: responseTime,
                details: "❌ Only \(discoveredServices.count)/\(services.count) services discovered"
            ))
            print("❌ Service discovery: Only \(discoveredServices.count)/\(services.count) services")
        }
    }
    
    // MARK: - Report Generation
    
    func generateReport() {
        print("\n" + "=" * 80)
        print("📊 INTEGRATION TEST RESULTS")
        print("=" * 80)
        
        let successfulTests = results.filter { $0.success }
        let failedTests = results.filter { !$0.success }
        
        print("✅ Successful Tests: \(successfulTests.count)/\(results.count)")
        print("❌ Failed Tests: \(failedTests.count)/\(results.count)")
        
        let avgResponseTime = results.map { $0.responseTime }.reduce(0, +) / Double(results.count)
        print("⏱️  Average Response Time: \(Int(avgResponseTime * 1000))ms")
        
        print("\n📋 DETAILED RESULTS:")
        print("-" * 80)
        
        for result in results {
            let status = result.success ? "✅ PASS" : "❌ FAIL"
            print("\(status) \(result.name) (\(Int(result.responseTime * 1000))ms)")
            print("   \(result.details)")
            print()
        }
        
        // Overall system assessment
        print("🎯 SYSTEM ASSESSMENT:")
        print("-" * 80)
        
        let successRate = Double(successfulTests.count) / Double(results.count) * 100
        
        if successRate >= 90 {
            print("🚀 EXCELLENT: System is fully operational and ready for production use")
        } else if successRate >= 70 {
            print("⚠️  GOOD: System is mostly operational with minor issues")
        } else if successRate >= 50 {
            print("🔧 NEEDS ATTENTION: System has significant issues requiring fixes")
        } else {
            print("🚨 CRITICAL: System has major failures preventing normal operation")
        }
        
        print("📈 Success Rate: \(String(format: "%.1f", successRate))%")
        print("🔗 Integration Status: \(successfulTests.count > 0 ? "Connected" : "Disconnected")")
        
        if !failedTests.isEmpty {
            print("\n🔧 RECOMMENDED ACTIONS:")
            for failed in failedTests {
                print("• Fix \(failed.name): \(failed.details)")
            }
        }
        
        print("\n✅ End-to-end integration test completed!")
    }
}

// MARK: - Error Types

enum TestError: Error {
    case invalidResponse
    case serviceUnavailable
}

// MARK: - String Extension for Formatting

extension String {
    static func * (left: String, right: Int) -> String {
        return String(repeating: left, count: right)
    }
}

// MARK: - Main Execution

var tester = IntegrationTest()
await tester.runAllTests()