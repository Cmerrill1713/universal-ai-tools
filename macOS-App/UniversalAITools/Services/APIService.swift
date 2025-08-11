import Foundation
import Combine
import Network
import OSLog
import Security

@MainActor
class APIService: ObservableObject {
    static let shared = APIService()

    @Published var isConnected = false
    @Published var authToken: String?

    let baseURL: String
    private var websocket: URLSessionWebSocketTask?
    private var session: URLSession
    private var cancellables = Set<AnyCancellable>()
    private var reconnectTimer: Timer?
    private let pathMonitor = NWPathMonitor()
    private let pathQueue = DispatchQueue(label: "APIService.NetworkPath")
    private var reconnectAttempt = 0
    private let maxReconnectDelay: TimeInterval = 60

    init() {
        self.baseURL = UserDefaults.standard.string(forKey: "BackendURL") ?? "http://localhost:9999"
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        loadAuthToken()
        startNetworkMonitoring()

        // Initial connection attempt
        Task {
            await connectToBackend()
        }
    }

    // MARK: - Authentication

    private func loadAuthToken() {
        authToken = KeychainService.shared.getToken()
    }

    func setBackendURL(_ url: String) {
        UserDefaults.standard.set(url, forKey: "BackendURL")
        Task {
            await connectToBackend()
        }
    }

    // MARK: - Connection Management

    func connectToBackend() async {
        do {
            // Try status endpoint first (most reliable)
            let statusEndpoint = "\(baseURL)/api/v1/status"
            guard let url = URL(string: statusEndpoint) else {
                throw APIError.invalidURL
            }

                let (data, httpURLResponse) = try await session.data(from: url)

                guard let httpResponse = httpURLResponse as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if httpResponse.statusCode == 200 {
                // Parse status response
                struct StatusResponse: Codable {
                    let success: Bool
                    let data: StatusData

                    struct StatusData: Codable {
                        let status: String
                        let services: ServiceStatus

                        struct ServiceStatus: Codable {
                            let backend: String
                            let websocket: String
                        }
                    }
                }

                let status = try JSONDecoder().decode(StatusResponse.self, from: data)
                let isHealthy = status.data.status == "operational" &&
                               status.data.services.backend == "healthy"

                await MainActor.run {
                    self.isConnected = isHealthy
                    if isHealthy {
                        NotificationCenter.default.post(name: .backendConnected, object: nil)
                        self.reconnectAttempt = 0
                        self.connectWebSocket()
                    } else {
                        self.handleConnectionFailure()
                    }
                }
            } else {
                throw APIError.httpError(statusCode: httpResponse.statusCode)
            }
        } catch {
            await MainActor.run {
                self.isConnected = false
                self.handleConnectionFailure()
            }
        }
    }

    private func handleConnectionFailure() {
        isConnected = false
        NotificationCenter.default.post(name: .backendDisconnected, object: nil)
        scheduleReconnect()
    }

    private func connectWebSocket() {
        let wsURL = baseURL.replacingOccurrences(of: "http", with: "ws") + "/api/v1/ws"
        guard let url = URL(string: wsURL) else { return }

        var request = URLRequest(url: url)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        websocket = session.webSocketTask(with: request)
        websocket?.resume()

        NotificationCenter.default.post(name: .websocketConnected, object: nil)
        receiveWebSocketMessage()
        sendWebSocketPing()
    }

    private func receiveWebSocketMessage() {
        websocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                Task { @MainActor in
                    self?.handleWebSocketMessage(message)
                    self?.receiveWebSocketMessage()
                }
            case .failure:
                Task { @MainActor in
                    self?.handleWebSocketDisconnection()
                }
            }
        }
    }

    private func handleWebSocketMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            if let data = text.data(using: .utf8) {
                do {
                    let wsMessage = try JSONDecoder().decode(WebSocketMessage.self, from: data)
                    handleIncomingMessage(wsMessage)
                } catch {
                    Log.network.error("Failed to decode WebSocket message: \(String(describing: error))")
                }
            }
        default:
            break
        }
    }

    private func handleIncomingMessage(_ message: WebSocketMessage) {
        switch message.type {
        case "agent_update":
            NotificationCenter.default.post(
                name: .agentUpdate,
                object: nil,
                userInfo: ["data": message.data]
            )
        case "metrics_update":
            NotificationCenter.default.post(
                name: .metricsUpdate,
                object: nil,
                userInfo: ["data": message.data]
            )
        case "chat_response":
            NotificationCenter.default.post(
                name: .chatResponse,
                object: nil,
                userInfo: ["data": message.data]
            )
        default:
            break
        }
    }

    // MARK: - Web API bridge used by WebContainerView
    func handleWebAPICall(_ data: [String: Any]) async {
        // Minimal stub for now to avoid build error; extend as needed
        // Expected keys: endpoint, method, params, requestId
        // You can route to real API calls here and then dispatch back via JS bridge
        Log.network.debug("Received web API call: \(data)")
    }

    private func sendWebSocketPing() {
        websocket?.sendPing { [weak self] error in
            if error != nil {
                Task { @MainActor in
                    self?.handleWebSocketDisconnection()
                }
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
                    self?.sendWebSocketPing()
                }
            }
        }
    }

    private func handleWebSocketDisconnection() {
        websocket = nil
        NotificationCenter.default.post(name: .websocketDisconnected, object: nil)
        scheduleReconnect()
    }

    private func scheduleReconnect() {
        reconnectTimer?.invalidate()
        let delay = nextReconnectDelay()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            Task {
                await self?.connectToBackend()
            }
        }
    }

    private func nextReconnectDelay() -> TimeInterval {
        let exp = min(pow(2.0, Double(reconnectAttempt)), maxReconnectDelay)
        let jitter = Double.random(in: 0...1)
        reconnectAttempt += 1
        return min(exp + jitter, maxReconnectDelay)
    }

    private func startNetworkMonitoring() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            if path.status == .satisfied {
                DispatchQueue.main.async {
                    if let self = self, self.websocket == nil && !self.isConnected {
                        self.reconnectAttempt = 0
                        Task {
                            await self.connectToBackend()
                        }
                    }
                }
            }
        }
        pathMonitor.start(queue: pathQueue)
    }

    // MARK: - API Calls

    func sendChatMessage(_ message: String, chatId: String) async throws -> Message {
        let endpoint = "\(baseURL)/api/v1/chat"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let body: [String: Any] = [
            "message": message,
            "conversationId": chatId.isEmpty ? nil : chatId,
            "agentName": "personal_assistant"
        ].compactMapValues { $0 }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            if let errorData = String(data: data, encoding: .utf8) {
                Log.network.error("Chat API error: \(errorData)")
            }
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        // Parse the response and extract the message
        let apiResponse = try JSONDecoder().decode(ChatResponse.self, from: data)

        // Create a Message from the response
        return Message(
            id: apiResponse.data.message.id,
            content: apiResponse.data.message.content,
            role: MessageRole(rawValue: apiResponse.data.message.role) ?? .assistant,
            timestamp: Date()
        )
    }

    func getAgents() async throws -> [Agent] {
        let endpoint = "\(baseURL)/api/v1/agents/registry"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        struct AgentsResponse: Codable {
            let success: Bool
            let data: AgentData

            struct AgentData: Codable {
                let total: Int
                let loaded: Int
                let agents: [Agent]
            }
        }

        let decoded = try JSONDecoder().decode(AgentsResponse.self, from: data)
        return decoded.data.agents
    }

    func getDetailedHealth() async throws -> SystemMetrics {
        let endpoint = "\(baseURL)/api/v1/health/detailed"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        return try JSONDecoder().decode(SystemMetrics.self, from: data)
    }

    func getMetrics() async throws -> SystemMetrics {
        let endpoint = "\(baseURL)/api/v1/monitoring/metrics"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        return try JSONDecoder().decode(SystemMetrics.self, from: data)
    }

    // MARK: - Compatibility helpers for existing views
    func performHealthProbe() async throws -> Bool {
        let statusEndpoint = "\(baseURL)/api/v1/status"
        guard let url = URL(string: statusEndpoint) else { throw APIError.invalidURL }
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return false }
        struct StatusResponse: Codable { let success: Bool }
        let decoded = try? JSONDecoder().decode(StatusResponse.self, from: data)
        return decoded?.success ?? false
    }

    func getSystemMetrics() async throws -> SystemMetrics {
        try await getMetrics()
    }
}

// MARK: - Supporting Types

struct ChatResponse: Codable {
    let success: Bool
    let data: ChatResponseData
    let metadata: ChatResponseMetadata
}

struct ChatResponseData: Codable {
    let conversationId: String
    let message: APIChatMessage
    let usage: ChatUsage?
}

struct APIChatMessage: Codable {
    let id: String
    let role: String
    let content: String
    let timestamp: String
    let metadata: ChatMessageMetadata?
}

struct ChatMessageMetadata: Codable {
    let agentName: String?
    let confidence: Double?
    let tokens: Int?
    let error: String?
}

struct ChatUsage: Codable {
    let tokens: Int
    let executionTime: String
}

struct ChatResponseMetadata: Codable {
    let timestamp: String
    let requestId: String
    let agentName: String?
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    case decodingError(Error)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode):
            return "HTTP error: \(statusCode)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

struct WebSocketMessage: Codable {
    let type: String
    let data: [String: Any]

    enum CodingKeys: String, CodingKey {
        case type
        case data
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)

        // Be resilient: accept either a dictionary payload or any JSON value
        if let dataDict = try? container.decode([String: JSONValue].self, forKey: .data) {
            data = dataDict.mapValues { $0.value }
        } else if let anyValue = try? container.decode(JSONValue.self, forKey: .data) {
            // Wrap non-dictionary payloads under a standard key
            data = ["value": anyValue.value]
        } else {
            data = [:]
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)

        // Always encode as a dictionary of JSONValue for consistency
        let jsonData = data.mapValues { JSONValue(value: $0) }
        try container.encode(jsonData, forKey: .data)
    }
}

enum JSONValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case null
    case array([JSONValue])
    case dictionary([String: JSONValue])

    var value: Any {
        switch self {
        case .string(let stringValue): return stringValue
        case .int(let intValue): return intValue
        case .double(let doubleValue): return doubleValue
        case .bool(let boolValue): return boolValue
        case .null: return NSNull()
        case .array(let arrayValue): return arrayValue.map { $0.value }
        case .dictionary(let dictValue): return dictValue.mapValues { $0.value }
        }
    }

    init(value: Any) {
        if let stringValue = value as? String {
            self = .string(stringValue)
        } else if let intValue = value as? Int {
            self = .int(intValue)
        } else if let doubleValue = value as? Double {
            self = .double(doubleValue)
        } else if let boolValue = value as? Bool {
            self = .bool(boolValue)
        } else if value is NSNull {
            self = .null
        } else if let arrayValue = value as? [Any] {
            self = .array(arrayValue.map { JSONValue(value: $0) })
        } else if let dictValue = value as? [String: Any] {
            self = .dictionary(dictValue.mapValues { JSONValue(value: $0) })
        } else {
            self = .null
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let int = try? container.decode(Int.self) {
            self = .int(int)
        } else if let double = try? container.decode(Double.self) {
            self = .double(double)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if container.decodeNil() {
            self = .null
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else if let dict = try? container.decode([String: JSONValue].self) {
            self = .dictionary(dict)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .string(let stringValue): try container.encode(stringValue)
        case .int(let intValue): try container.encode(intValue)
        case .double(let doubleValue): try container.encode(doubleValue)
        case .bool(let boolValue): try container.encode(boolValue)
        case .null: try container.encodeNil()
        case .array(let arrayValue): try container.encode(arrayValue)
        case .dictionary(let dictValue): try container.encode(dictValue)
        }
    }
}

// MARK: - Notification Names
// All Notification.Name constants are defined in Utils/Notifications.swift
