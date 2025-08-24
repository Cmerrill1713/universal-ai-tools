#!/usr/bin/env swift

import Foundation

// Test script for macOS app authentication and API connectivity

struct TestResult: Codable {
    let endpoint: String
    let success: Bool
    let statusCode: Int?
    let message: String
}

class APITester {
    let baseURL = "http://localhost:8090"
    var authToken: String?
    
    func runTests() async {
        print("🔧 Universal AI Tools - macOS Authentication & API Test")
        print("=" * 60)
        
        var results: [TestResult] = []
        
        // Test 1: Health Check (no auth required)
        print("\n1️⃣ Testing health endpoint...")
        results.append(await testHealthEndpoint())
        
        // Test 2: Generate Demo Token
        print("\n2️⃣ Generating demo token...")
        let tokenResult = await generateDemoToken()
        results.append(tokenResult)
        
        if tokenResult.success {
            print("✅ Token obtained successfully")
            
            // Test 3: Validate Token
            print("\n3️⃣ Validating token...")
            results.append(await validateToken())
            
            // Test 4: Test Protected Endpoint
            print("\n4️⃣ Testing protected endpoint...")
            results.append(await testProtectedEndpoint())
            
            // Test 5: Test Chat Endpoint
            print("\n5️⃣ Testing chat endpoint...")
            results.append(await testChatEndpoint())
        }
        
        // Print Summary
        print("\n" + "=" * 60)
        print("📊 Test Summary:")
        print("=" * 60)
        
        for result in results {
            let status = result.success ? "✅" : "❌"
            print("\(status) \(result.endpoint): \(result.message)")
        }
        
        let successCount = results.filter { $0.success }.count
        let totalCount = results.count
        let successRate = Double(successCount) / Double(totalCount) * 100
        
        print("\n🎯 Success Rate: \(successCount)/\(totalCount) (\(String(format: "%.1f", successRate))%)")
    }
    
    func testHealthEndpoint() async -> TestResult {
        let url = URL(string: "\(baseURL)/api/health")!
        
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            let httpResponse = response as! HTTPURLResponse
            
            if httpResponse.statusCode == 200 {
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let status = json["status"] as? String {
                    return TestResult(
                        endpoint: "/api/health",
                        success: true,
                        statusCode: 200,
                        message: "Service is \(status)"
                    )
                }
            }
            
            return TestResult(
                endpoint: "/api/health",
                success: false,
                statusCode: httpResponse.statusCode,
                message: "Unexpected response"
            )
        } catch {
            return TestResult(
                endpoint: "/api/health",
                success: false,
                statusCode: nil,
                message: "Connection failed: \(error.localizedDescription)"
            )
        }
    }
    
    func generateDemoToken() async -> TestResult {
        let url = URL(string: "\(baseURL)/api/v1/auth/demo-token")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload = ["name": "macOS-test", "duration": "1h"]
        request.httpBody = try! JSONSerialization.data(withJSONObject: payload)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as! HTTPURLResponse
            
            if httpResponse.statusCode == 200 {
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = json["success"] as? Bool,
                   success,
                   let data = json["data"] as? [String: Any],
                   let token = data["token"] as? String {
                    self.authToken = token
                    return TestResult(
                        endpoint: "/api/v1/auth/demo-token",
                        success: true,
                        statusCode: 200,
                        message: "Token generated (expires in 1h)"
                    )
                }
            }
            
            return TestResult(
                endpoint: "/api/v1/auth/demo-token",
                success: false,
                statusCode: httpResponse.statusCode,
                message: "Failed to generate token"
            )
        } catch {
            return TestResult(
                endpoint: "/api/v1/auth/demo-token",
                success: false,
                statusCode: nil,
                message: "Request failed: \(error.localizedDescription)"
            )
        }
    }
    
    func validateToken() async -> TestResult {
        guard let token = authToken else {
            return TestResult(
                endpoint: "/api/v1/auth/validate",
                success: false,
                statusCode: nil,
                message: "No token available"
            )
        }
        
        let url = URL(string: "\(baseURL)/api/v1/auth/validate")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as! HTTPURLResponse
            
            if httpResponse.statusCode == 200 {
                return TestResult(
                    endpoint: "/api/v1/auth/validate",
                    success: true,
                    statusCode: 200,
                    message: "Token is valid"
                )
            }
            
            return TestResult(
                endpoint: "/api/v1/auth/validate",
                success: false,
                statusCode: httpResponse.statusCode,
                message: "Token validation failed"
            )
        } catch {
            return TestResult(
                endpoint: "/api/v1/auth/validate",
                success: false,
                statusCode: nil,
                message: "Validation request failed"
            )
        }
    }
    
    func testProtectedEndpoint() async -> TestResult {
        guard let token = authToken else {
            return TestResult(
                endpoint: "/api/v1/agents",
                success: false,
                statusCode: nil,
                message: "No token available"
            )
        }
        
        let url = URL(string: "\(baseURL)/api/v1/agents")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as! HTTPURLResponse
            
            if httpResponse.statusCode == 200 {
                return TestResult(
                    endpoint: "/api/v1/agents",
                    success: true,
                    statusCode: 200,
                    message: "Protected endpoint accessible"
                )
            }
            
            return TestResult(
                endpoint: "/api/v1/agents",
                success: false,
                statusCode: httpResponse.statusCode,
                message: "Access denied (code: \(httpResponse.statusCode))"
            )
        } catch {
            return TestResult(
                endpoint: "/api/v1/agents",
                success: false,
                statusCode: nil,
                message: "Request failed"
            )
        }
    }
    
    func testChatEndpoint() async -> TestResult {
        guard let token = authToken else {
            return TestResult(
                endpoint: "/api/v1/chat",
                success: false,
                statusCode: nil,
                message: "No token available"
            )
        }
        
        let url = URL(string: "\(baseURL)/api/v1/chat")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let payload = [
            "message": "Hello from macOS test",
            "model": "gemma2:2b",
            "stream": false
        ] as [String : Any]
        request.httpBody = try! JSONSerialization.data(withJSONObject: payload)
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let httpResponse = response as! HTTPURLResponse
            
            if httpResponse.statusCode == 200 {
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let response = json["response"] as? String {
                    return TestResult(
                        endpoint: "/api/v1/chat",
                        success: true,
                        statusCode: 200,
                        message: "Chat response received: \(response.prefix(50))..."
                    )
                }
                return TestResult(
                    endpoint: "/api/v1/chat",
                    success: true,
                    statusCode: 200,
                    message: "Chat endpoint working"
                )
            }
            
            return TestResult(
                endpoint: "/api/v1/chat",
                success: false,
                statusCode: httpResponse.statusCode,
                message: "Chat request failed"
            )
        } catch {
            return TestResult(
                endpoint: "/api/v1/chat",
                success: false,
                statusCode: nil,
                message: "Request error: \(error.localizedDescription)"
            )
        }
    }
}

// Extension for string multiplication
extension String {
    static func *(lhs: String, rhs: Int) -> String {
        return String(repeating: lhs, count: rhs)
    }
}

// Main execution
Task {
    let tester = APITester()
    await tester.runTests()
    exit(0)
}

RunLoop.main.run()