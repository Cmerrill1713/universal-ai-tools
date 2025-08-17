#!/usr/bin/env swift

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

// Simple backend connectivity test
print("🔍 Testing Universal AI Tools Backend Connection")
print("Testing connection to: http://localhost:9999")

func testEndpoint(_ endpoint: String, completion: @escaping (Bool, String) -> Void) {
    guard let url = URL(string: endpoint) else {
        completion(false, "Invalid URL")
        return
    }
    
    var request = URLRequest(url: url)
    request.timeoutInterval = 10
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    
    let task = URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
            completion(false, "Network Error: \(error.localizedDescription)")
            return
        }
        
        guard let httpResponse = response as? HTTPURLResponse else {
            completion(false, "Invalid HTTP Response")
            return
        }
        
        if httpResponse.statusCode == 200 || httpResponse.statusCode == 401 {
            // 401 is expected for auth-protected endpoints
            let dataString = data.map { String(data: $0, encoding: .utf8) ?? "No data" } ?? "No response body"
            completion(true, "Status: \(httpResponse.statusCode) - \(dataString)")
        } else {
            completion(false, "HTTP \(httpResponse.statusCode)")
        }
    }
    
    task.resume()
}

// Test endpoints from your backend
let endpoints = [
    "http://localhost:9999/health",
    "http://localhost:9999/api/v1/status", 
    "http://localhost:9999/api/v1/agent-orchestration/status",
    "http://localhost:9999/api/v1/health/detailed"
]

let semaphore = DispatchSemaphore(value: 0)
var completedTests = 0

for endpoint in endpoints {
    print("\n🔗 Testing: \(endpoint)")
    
    testEndpoint(endpoint) { success, message in
        let status = success ? "✅ SUCCESS" : "❌ FAILED"
        print("   \(status): \(message)")
        
        completedTests += 1
        if completedTests == endpoints.count {
            semaphore.signal()
        }
    }
}

semaphore.wait()

print("\n🏁 Backend connection test completed!")
print("If you see SUCCESS for any endpoint, the backend is reachable.")
print("401 errors on auth-protected endpoints are expected and indicate the backend is working.")