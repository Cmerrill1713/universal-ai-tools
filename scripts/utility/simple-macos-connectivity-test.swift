#!/usr/bin/env swift

import SwiftUI
import Foundation
import Combine

// Simple connectivity test app
@main
struct UniversalAIConnectionTest: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @StateObject private var connectionTester = ConnectionTester()
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Universal AI Tools")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("Backend Connectivity Test")
                .font(.headline)
                .foregroundColor(.secondary)
            
            // Connection Status
            HStack {
                Circle()
                    .fill(connectionTester.isConnected ? Color.green : Color.red)
                    .frame(width: 12, height: 12)
                
                Text(connectionTester.isConnected ? "Connected" : "Disconnected")
                    .foregroundColor(connectionTester.isConnected ? .green : .red)
                    .fontWeight(.medium)
            }
            
            // Backend URL
            Text("Backend: http://localhost:9999")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Divider()
            
            // Test Results
            VStack(alignment: .leading, spacing: 8) {
                Text("Test Results:")
                    .font(.headline)
                
                ForEach(connectionTester.testResults, id: \.endpoint) { result in
                    HStack {
                        Image(systemName: result.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(result.success ? .green : .red)
                        
                        VStack(alignment: .leading) {
                            Text(result.endpoint)
                                .font(.caption)
                                .foregroundColor(.primary)
                            Text(result.message)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                    }
                }
            }
            
            Spacer()
            
            // Test Button
            Button("Test Connection") {
                Task {
                    await connectionTester.testConnection()
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(connectionTester.isTesting)
            
            if connectionTester.isTesting {
                ProgressView("Testing...")
                    .progressViewStyle(CircularProgressViewStyle())
            }
        }
        .padding()
        .frame(width: 400, height: 500)
        .onAppear {
            Task {
                await connectionTester.testConnection()
            }
        }
    }
}

// Test result model
struct TestResult {
    let endpoint: String
    let success: Bool
    let message: String
}

// Connection tester service
@MainActor
class ConnectionTester: ObservableObject {
    @Published var isConnected = false
    @Published var isTesting = false
    @Published var testResults: [TestResult] = []
    
    private let baseURL = "http://localhost:9999"
    private let session = URLSession.shared
    
    func testConnection() async {
        isTesting = true
        testResults = []
        
        let endpoints = [
            "/health",
            "/api/v1/status", 
            "/api/v1/agent-orchestration/status",
            "/api/v1/health/detailed"
        ]
        
        var successCount = 0
        
        for endpoint in endpoints {
            let result = await testEndpoint(endpoint)
            testResults.append(result)
            if result.success {
                successCount += 1
            }
        }
        
        isConnected = successCount > 0
        isTesting = false
        
        print("✅ Connection test completed: \(successCount)/\(endpoints.count) endpoints accessible")
    }
    
    private func testEndpoint(_ endpoint: String) async -> TestResult {
        guard let url = URL(string: baseURL + endpoint) else {
            return TestResult(endpoint: endpoint, success: false, message: "Invalid URL")
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                return TestResult(endpoint: endpoint, success: false, message: "Invalid response")
            }
            
            let success = httpResponse.statusCode == 200 || httpResponse.statusCode == 401
            let dataString = String(data: data, encoding: .utf8)?.prefix(100) ?? "No data"
            
            return TestResult(
                endpoint: endpoint,
                success: success,
                message: "HTTP \(httpResponse.statusCode) - \(dataString)"
            )
            
        } catch {
            return TestResult(
                endpoint: endpoint, 
                success: false, 
                message: "Error: \(error.localizedDescription)"
            )
        }
    }
}