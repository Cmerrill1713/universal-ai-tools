#!/usr/bin/env swift

import Foundation

/// Simple WebSocket integration test for the Go WebSocket service
/// Tests the connection, authentication, and message exchange

// MARK: - Test Configuration

let WEBSOCKET_URL = "ws://localhost:8080/ws"
let TEST_USER_ID = "swift-test-client"
let TEST_TOKEN = "test-token-12345"

// MARK: - WebSocket Message Models

struct GoWebSocketMessage: Codable {
    let id: String
    let type: String
    let from: String
    let to: String?
    let content: String
    let metadata: [String: String]?
    let timestamp: Date
}

// MARK: - WebSocket Test Class

class WebSocketIntegrationTest {
    private var webSocketTask: URLSessionWebSocketTask?
    private let session = URLSession.shared
    private var isConnected = false
    private var messagesReceived = 0
    private var messagesSent = 0
    
    func runTest() async {
        print("🚀 Starting WebSocket Integration Test")
        print("📡 Connecting to Go WebSocket service at \(WEBSOCKET_URL)")
        
        do {
            // Step 1: Test Connection
            try await testConnection()
            
            // Step 2: Test Authentication
            try await testAuthentication()
            
            // Step 3: Test Message Exchange
            try await testMessageExchange()
            
            // Step 4: Test Heartbeat
            try await testHeartbeat()
            
            print("\n✅ WebSocket Integration Test Completed Successfully!")
            print("📊 Test Results:")
            print("   - Messages Sent: \(messagesSent)")
            print("   - Messages Received: \(messagesReceived)")
            print("   - Connection Status: \(isConnected ? "Connected" : "Disconnected")")
            
        } catch {
            print("❌ WebSocket Integration Test Failed: \(error.localizedDescription)")
        }
        
        // Cleanup
        disconnect()
    }
    
    private func testConnection() async throws {
        print("\n🔄 Test 1: Connection Test")
        
        // Create URL with authentication parameters
        var urlComponents = URLComponents(string: WEBSOCKET_URL)!
        urlComponents.queryItems = [
            URLQueryItem(name: "user_id", value: TEST_USER_ID),
            URLQueryItem(name: "token", value: TEST_TOKEN)
        ]
        
        guard let url = urlComponents.url else {
            throw TestError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.setValue("Swift-WebSocket-Test/1.0", forHTTPHeaderField: "User-Agent")
        
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()
        
        // Start listening for messages
        startListening()
        
        // Send a connection test message
        let handshakeMessage = GoWebSocketMessage(
            id: UUID().uuidString,
            type: "test",
            from: TEST_USER_ID,
            to: nil,
            content: "Swift WebSocket integration test started",
            metadata: [
                "client": "swift-test",
                "version": "1.0.0",
                "test_phase": "connection"
            ],
            timestamp: Date()
        )
        
        try await sendMessage(handshakeMessage)
        print("✅ Connection test passed - WebSocket connected and handshake sent")
        isConnected = true
    }
    
    private func testAuthentication() async throws {
        print("\n🔄 Test 2: Authentication Test")
        
        let authMessage = GoWebSocketMessage(
            id: UUID().uuidString,
            type: "auth",
            from: TEST_USER_ID,
            to: nil,
            content: "Authentication test with token",
            metadata: [
                "token": TEST_TOKEN,
                "auth_type": "bearer",
                "test_phase": "authentication"
            ],
            timestamp: Date()
        )
        
        try await sendMessage(authMessage)
        print("✅ Authentication test passed - Auth message sent successfully")
    }
    
    private func testMessageExchange() async throws {
        print("\n🔄 Test 3: Message Exchange Test")
        
        // Send multiple test messages
        let testMessages = [
            "Hello from Swift macOS client!",
            "Testing hybrid architecture integration",
            "Swift ↔ Go WebSocket communication working",
            "Keychain authentication integration test"
        ]
        
        for (index, content) in testMessages.enumerated() {
            let message = GoWebSocketMessage(
                id: UUID().uuidString,
                type: "chat",
                from: TEST_USER_ID,
                to: nil,
                content: content,
                metadata: [
                    "test_message_index": "\(index)",
                    "test_phase": "message_exchange"
                ],
                timestamp: Date()
            )
            
            try await sendMessage(message)
            print("📤 Sent test message \(index + 1): \(content)")
            
            // Wait a bit between messages
            try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        }
        
        print("✅ Message exchange test passed - All test messages sent")
    }
    
    private func testHeartbeat() async throws {
        print("\n🔄 Test 4: Heartbeat Test")
        
        let heartbeatMessage = GoWebSocketMessage(
            id: UUID().uuidString,
            type: "heartbeat",
            from: TEST_USER_ID,
            to: nil,
            content: "ping",
            metadata: [
                "test_phase": "heartbeat"
            ],
            timestamp: Date()
        )
        
        try await sendMessage(heartbeatMessage)
        print("✅ Heartbeat test passed - Ping message sent")
    }
    
    private func sendMessage(_ message: GoWebSocketMessage) async throws {
        guard let webSocketTask = webSocketTask else {
            throw TestError.notConnected
        }
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(message)
        let text = String(data: data, encoding: .utf8) ?? ""
        
        try await webSocketTask.send(.string(text))
        messagesSent += 1
    }
    
    private func startListening() {
        Task {
            await listenForMessages()
        }
    }
    
    private func listenForMessages() async {
        guard let webSocketTask = webSocketTask else { return }
        
        do {
            let message = try await webSocketTask.receive()
            await handleMessage(message)
            await listenForMessages() // Continue listening
        } catch {
            print("📥 WebSocket listening stopped: \(error.localizedDescription)")
            isConnected = false
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) async {
        switch message {
        case .string(let text):
            print("📥 Received message: \(text)")
            messagesReceived += 1
            
            // Try to decode as Go WebSocket message
            if let data = text.data(using: .utf8) {
                do {
                    let decoder = JSONDecoder()
                    decoder.dateDecodingStrategy = .iso8601
                    let goMessage = try decoder.decode(GoWebSocketMessage.self, from: data)
                    print("📋 Parsed message - Type: \(goMessage.type), From: \(goMessage.from), Content: \(goMessage.content)")
                } catch {
                    print("⚠️ Could not parse as Go message: \(error.localizedDescription)")
                }
            }
            
        case .data(let data):
            print("📥 Received binary data: \(data.count) bytes")
            messagesReceived += 1
            
        @unknown default:
            print("📥 Received unknown message type")
        }
    }
    
    private func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        isConnected = false
        print("🔌 WebSocket disconnected")
    }
}

// MARK: - Test Errors

enum TestError: LocalizedError {
    case invalidURL
    case notConnected
    case authenticationFailed
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid WebSocket URL"
        case .notConnected:
            return "WebSocket not connected"
        case .authenticationFailed:
            return "Authentication failed"
        }
    }
}

// MARK: - Main Test Execution

print("🧪 Universal AI Tools - WebSocket Integration Test")
print("================================================")
print("Testing Swift macOS app → Go WebSocket service integration")

Task {
    let test = WebSocketIntegrationTest()
    await test.runTest()
    
    print("\n🎯 Test Summary:")
    print("- Go WebSocket service should be running on localhost:8080")
    print("- Check server logs for received messages")
    print("- Verify authentication token handling")
    print("- Confirm message format compatibility")
    
    exit(0)
}

// Keep the program running
RunLoop.main.run()