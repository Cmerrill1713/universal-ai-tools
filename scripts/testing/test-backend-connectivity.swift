#!/usr/bin/env swift

import Foundation

// Test connectivity to Go API Gateway from Swift
class BackendConnectivityTest {
    let apiGatewayURL = "http://localhost:8082"
    
    func testHealth() async throws {
        print("🔍 Testing health endpoint...")
        let url = URL(string: "\(apiGatewayURL)/health")!
        let (data, response) = try await URLSession.shared.data(from: url)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("✅ Health Status: \(httpResponse.statusCode)")
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                print("   Response: \(json)")
            }
        }
    }
    
    func testNewsCategories() async throws {
        print("\n📰 Testing news categories...")
        let url = URL(string: "\(apiGatewayURL)/api/v1/news/categories")!
        let (data, response) = try await URLSession.shared.data(from: url)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("✅ News Categories Status: \(httpResponse.statusCode)")
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let success = json["success"] as? Bool {
                print("   Success: \(success)")
                if let data = json["data"] as? [String: Any],
                   let total = data["total"] as? Int {
                    print("   Total Categories: \(total)")
                }
            }
        }
    }
    
    func testChat() async throws {
        print("\n💬 Testing chat endpoint...")
        let url = URL(string: "\(apiGatewayURL)/api/v1/chat/")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "message": "Test from Swift connectivity check",
            "agentName": "test"
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            print("✅ Chat Status: \(httpResponse.statusCode)")
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let success = json["success"] as? Bool {
                print("   Success: \(success)")
                if let data = json["data"] as? [String: Any],
                   let message = data["message"] as? String {
                    print("   Response: \(message.prefix(100))...")
                }
            }
        }
    }
    
    func runTests() async {
        print("🚀 Testing Backend Connectivity from Swift\n")
        print("Target: \(apiGatewayURL)")
        print(String(repeating: "=", count: 50))
        
        do {
            try await testHealth()
            try await testNewsCategories()
            try await testChat()
            
            print("\n✨ All connectivity tests passed!")
        } catch {
            print("\n❌ Error: \(error)")
        }
    }
}

// Run the tests
let tester = BackendConnectivityTest()
await tester.runTests()