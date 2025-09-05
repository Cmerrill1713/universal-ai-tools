import Foundation
import Combine

/// WebSocket service for real-time communication with backend
@MainActor
class WebSocketService: ObservableObject {
    static let shared = WebSocketService()

    private var webSocketTask: URLSessionWebSocketTask?
    private let session = URLSession(configuration: .default)
    private var pingTimer: Timer?

    // Published properties for UI updates
    @Published var isConnected: Bool = false
    @Published var connectionStatus: String = "Disconnected"

    // Message publishers
    let chatMessageReceived = PassthroughSubject<String, Never>()
    let conversationUpdated = PassthroughSubject<String, Never>()
    let systemStatusUpdated = PassthroughSubject<String, Never>()

    // Configuration
    private let baseURL: URL
    private let reconnectDelay: TimeInterval = 5.0
    private var isReconnecting = false

    init() {
        // Default to localhost:9999 websocket for minimal server (more stable)
        let port = ProcessInfo.processInfo.environment["BACKEND_PORT"] ?? "9999"
        let host = ProcessInfo.processInfo.environment["BACKEND_HOST"] ?? "localhost"

        guard let url = URL(string: "ws://\(host):\(port)/ws") else {
            fatalError("Invalid WebSocket URL configuration")
        }

        self.baseURL = url
    }

    // MARK: - Connection Management

    func connect() async {
        guard !isConnected else { return }

        do {
            webSocketTask = session.webSocketTask(with: baseURL)
            webSocketTask?.resume()

            await MainActor.run {
                connectionStatus = "Connecting..."
            }

            try await receiveMessages()

        } catch {
            await MainActor.run {
                connectionStatus = "Connection failed: \(error.localizedDescription)"
                isConnected = false
            }
            print("WebSocket connection failed: \(error)")

            // Schedule reconnection
            scheduleReconnection()
        }
    }

    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        pingTimer?.invalidate()
        pingTimer = nil

        Task { @MainActor in
            isConnected = false
            connectionStatus = "Disconnected"
        }
    }

    private func scheduleReconnection() {
        guard !isReconnecting else { return }
        isReconnecting = true

        DispatchQueue.main.asyncAfter(deadline: .now() + reconnectDelay) {
            self.isReconnecting = false
            Task {
                await self.connect()
            }
        }
    }

    // MARK: - Message Handling

    private func receiveMessages() async throws {
        while let webSocketTask = webSocketTask, webSocketTask.state == .running {
            do {
                let message = try await webSocketTask.receive()

                switch message {
                case .data(let data):
                    try await handleDataMessage(data)
                case .string(let string):
                    try await handleStringMessage(string)
                @unknown default:
                    print("Unknown message type received")
                }
            } catch {
                print("Error receiving WebSocket message: \(error)")
                throw error
            }
        }
    }

    private func handleDataMessage(_ data: Data) async throws {
        // Handle binary data messages if needed
        print("Received binary data: \(data.count) bytes")
    }

    private func handleStringMessage(_ message: String) async throws {
        print("Received WebSocket message: \(message)")

        // Parse JSON message
        guard let data = message.data(using: .utf8) else { return }

        do {
            let envelope = try JSONDecoder().decode(WebSocketEnvelope.self, from: data)

            switch envelope.type {
            case "chat_message":
                if let messageString = String(data: envelope.payload, encoding: .utf8) {
                    chatMessageReceived.send(messageString)
                }

            case "conversation_update":
                if let conversationString = String(data: envelope.payload, encoding: .utf8) {
                    conversationUpdated.send(conversationString)
                }

            case "system_status":
                if let statusString = String(data: envelope.payload, encoding: .utf8) {
                    systemStatusUpdated.send(statusString)
                    await updateConnectionStatus(statusString)
                }

            case "ping":
                // Respond to ping
                try await sendPong()

            default:
                print("Unknown message type: \(envelope.type)")
            }

        } catch {
            print("Failed to parse WebSocket message: \(error)")
        }
    }

    private func updateConnectionStatus(_ statusString: String) async {
        await MainActor.run {
            // Parse connection status from string (simplified - could be enhanced)
            let isConnectedStatus = statusString.lowercased().contains("connected") || statusString.lowercased().contains("true")
            isConnected = isConnectedStatus
            connectionStatus = isConnectedStatus ? "Connected" : "Disconnected"
        }
    }

    // MARK: - Sending Messages

    func sendMessage(_ message: WebSocketMessage) async throws {
        guard let webSocketTask = webSocketTask, webSocketTask.state == .running else {
            throw WebSocketError.notConnected
        }

        let envelope = WebSocketEnvelope(
            type: message.type,
            payload: message.payload.data(using: .utf8) ?? Data()
        )

        let data = try JSONEncoder().encode(envelope)
        try await webSocketTask.send(.data(data))
    }

    func sendChatMessage(_ message: String, conversationId: String) async throws {
        let payloadDict = [
            "conversationId": conversationId,
            "message": message,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        let payload = try JSONSerialization.data(withJSONObject: payloadDict, options: [])
        let payloadString = String(data: payload, encoding: .utf8) ?? "{}"

        try await sendMessage(WebSocketMessage(type: "send_chat_message", payload: payloadString))
    }

    func subscribeToConversation(_ conversationId: String) async throws {
        let payloadDict = ["conversationId": conversationId]
        let payload = try JSONSerialization.data(withJSONObject: payloadDict, options: [])
        let payloadString = String(data: payload, encoding: .utf8) ?? "{}"
        try await sendMessage(WebSocketMessage(type: "subscribe_conversation", payload: payloadString))
    }

    func unsubscribeFromConversation(_ conversationId: String) async throws {
        let payloadDict = ["conversationId": conversationId]
        let payload = try JSONSerialization.data(withJSONObject: payloadDict, options: [])
        let payloadString = String(data: payload, encoding: .utf8) ?? "{}"
        try await sendMessage(WebSocketMessage(type: "unsubscribe_conversation", payload: payloadString))
    }

    private func sendPong() async throws {
        let payloadDict = ["timestamp": Date().timeIntervalSince1970]
        let payload = try JSONSerialization.data(withJSONObject: payloadDict, options: [])
        let payloadString = String(data: payload, encoding: .utf8) ?? "{}"
        try await sendMessage(WebSocketMessage(type: "pong", payload: payloadString))
    }

    // MARK: - Ping/Pong for Connection Health

    func startPingTimer() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task {
                do {
                    let pingPayload = "{}"
                    try await self?.sendMessage(WebSocketMessage(type: "ping", payload: pingPayload))
                } catch {
                    print("Failed to send ping: \(error)")
                }
            }
        }
    }

    func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
    }
}

// MARK: - Data Models

struct WebSocketEnvelope: Codable {
    let type: String
    let payload: Data

    init(type: String, payload: Data) {
        self.type = type
        self.payload = payload
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)

        // Handle payload as either Data or base64-encoded string
        if let dataPayload = try? container.decode(Data.self, forKey: .payload) {
            payload = dataPayload
        } else if let stringPayload = try? container.decode(String.self, forKey: .payload),
                  let dataPayload = Data(base64Encoded: stringPayload) {
            payload = dataPayload
        } else {
            payload = Data()
        }
    }
}

struct WebSocketMessage {
    let type: String
    let payload: String

    init(type: String, payload: String) {
        self.type = type
        self.payload = payload
    }
}

struct SystemStatus: Codable {
    let connected: Bool
    let serverVersion: String?
    let uptime: TimeInterval?
    let activeConnections: Int?

    enum CodingKeys: String, CodingKey {
        case connected
        case serverVersion = "server_version"
        case uptime
        case activeConnections = "active_connections"
    }
}

// MARK: - Error Handling

enum WebSocketError: LocalizedError {
    case notConnected
    case connectionFailed
    case invalidMessage

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "WebSocket is not connected"
        case .connectionFailed:
            return "Failed to connect to WebSocket server"
        case .invalidMessage:
            return "Received invalid message format"
        }
    }
}

// MARK: - Extensions for JSON Encoding

extension WebSocketMessage {
    func toJSONData() throws -> Data {
        // Convert payload to JSON data
        return try JSONSerialization.data(withJSONObject: payload)
    }
}
