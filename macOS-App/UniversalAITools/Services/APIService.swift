import Foundation
import Combine
import Network

@MainActor
class APIService: ObservableObject {
    @Published var isConnected = false
    @Published var authToken: String?

    private var baseURL: String = UserDefaults.standard.string(forKey: "BackendURL") ?? "http://localhost:9999"
    private var websocket: URLSessionWebSocketTask?
    private var session: URLSession
    private var cancellables = Set<AnyCancellable>()
    private var reconnectTimer: Timer?
    private let pathMonitor = NWPathMonitor()
    private let pathQueue = DispatchQueue(label: "APIService.NetworkPath")
    private var reconnectAttempt = 0
    private let maxReconnectDelay: TimeInterval = 60

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        loadAuthToken()
        startNetworkMonitoring()
    }

    // MARK: - Authentication

    private func loadAuthToken() {
        authToken = KeychainService.shared.getToken()
    }

    func setBackendURL(_ url: String) {
        UserDefaults.standard.set(url, forKey: "BackendURL")
        baseURL = url
    }

    func authenticate(username: String, password: String) async throws -> Bool {
        let endpoint = "\(baseURL)/api/v1/auth/login"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["username": username, "password": password]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        authToken = authResponse.token

        // Save to keychain
        KeychainService.shared.saveToken(authResponse.token)

        // Reconnect backend with new auth token
        Task { [weak self] in
            await self?.connectToBackend()
        }

        return true
    }

    // MARK: - Connection Management

    func connectToBackend() async {
        // Check health endpoint
        do {
            let healthy = try await checkHealth()
            isConnected = healthy

            if healthy {
                connectWebSocket()
                NotificationCenter.default.post(name: .backendConnected, object: nil)
                reconnectAttempt = 0
            }
        } catch {
            print("Failed to connect to backend: \(error)")
            isConnected = false
            scheduleReconnect()
        }
    }

    private func checkHealth() async throws -> Bool {
        // Try rich health, then fallback
        let candidates = [
            "\(baseURL)/api/v1/fast-coordinator/health",
            "\(baseURL)/api/v1/status",
            "\(baseURL)/health",
        ]

        for endpoint in candidates {
            guard let url = URL(string: endpoint) else { continue }
            do {
                let (_, response) = try await session.data(from: url)
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    return true
                }
            } catch {
                // try next
                continue
            }
        }
        return false
    }

    // Public probe for SettingsView
    func performHealthProbe() async throws -> Bool {
        return try await checkHealth()
    }

    private func connectWebSocket() {
        let wsURL = baseURL.replacingOccurrences(of: "http", with: "ws") + "/ws"
        guard let url = URL(string: wsURL) else { return }

        var request = URLRequest(url: url)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        websocket = session.webSocketTask(with: request)
        websocket?.resume()

        receiveWebSocketMessage()
        sendWebSocketPing()
    }

    private func receiveWebSocketMessage() {
        websocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                self?.handleWebSocketMessage(message)
                self?.receiveWebSocketMessage()
            case .failure(let error):
                print("WebSocket receive error: \(error)")
                self?.handleWebSocketDisconnection()
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
                    print("Failed to decode WebSocket message: \(error)")
                }
            }
        case .data(let data):
            // Handle binary data if needed
            break
        @unknown default:
            break
        }
    }

    private func handleIncomingMessage(_ message: WebSocketMessage) {
        DispatchQueue.main.async {
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
    }

    private func sendWebSocketPing() {
        websocket?.sendPing { [weak self] error in
            if let error = error {
                print("WebSocket ping error: \(error)")
                self?.handleWebSocketDisconnection()
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
                    self?.sendWebSocketPing()
                }
            }
        }
    }

    private func handleWebSocketDisconnection() {
        DispatchQueue.main.async {
            self.websocket = nil
            NotificationCenter.default.post(name: .backendDisconnected, object: nil)
            self.scheduleReconnect()
        }
    }

    private func scheduleReconnect() {
        reconnectTimer?.invalidate()
        let delay = nextReconnectDelay()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { _ in
            Task {
                await self.connectToBackend()
            }
        }
    }

    private func nextReconnectDelay() -> TimeInterval {
        // Exponential backoff with jitter
        let exp = min(pow(2.0, Double(reconnectAttempt)), maxReconnectDelay)
        let jitter = Double.random(in: 0...1)
        reconnectAttempt += 1
        return min(exp + jitter, maxReconnectDelay)
    }

    private func startNetworkMonitoring() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            if path.status == .satisfied {
                DispatchQueue.main.async {
                    if self.websocket == nil && !self.isConnected {
                        self.reconnectAttempt = 0
                        self.scheduleReconnect()
                    }
                }
            }
        }
        pathMonitor.start(queue: pathQueue)
    }

    // MARK: - API Calls

    func sendChatMessage(_ message: String, chatId: String) async throws -> Message {
        let endpoint = "\(baseURL)/api/v1/chat/message"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let body = [
            "message": message,
            "chatId": chatId
        ]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        return try JSONDecoder().decode(Message.self, from: data)
    }

    func getAgents() async throws -> [Agent] {
        let endpoint = "\(baseURL)/api/v1/agents"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let apiResponse = try JSONDecoder().decode(APIResponse<[Agent]>.self, from: data)
        return apiResponse.data ?? []
    }

    func executeAgent(_ agentId: String, with params: [String: Any]) async throws -> [String: Any] {
        let endpoint = "\(baseURL)/api/v1/agents/\(agentId)/execute"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: params)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }

    func getSystemMetrics() async throws -> SystemMetrics {
        let endpoint = "\(baseURL)/api/v1/monitoring/metrics"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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

    func handleWebAPICall(_ data: [String: Any]) async {
        guard let endpoint = data["endpoint"] as? String,
              let params = data["params"] as? [String: Any] else { return }

        do {
            let url = URL(string: "\(baseURL)\(endpoint)")!
            var request = URLRequest(url: url)
            request.httpMethod = data["method"] as? String ?? "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            if !params.isEmpty {
                request.httpBody = try JSONSerialization.data(withJSONObject: params)
            }

            let (responseData, _) = try await session.data(for: request)

            // Send response back to WebView
            if let json = try JSONSerialization.jsonObject(with: responseData) as? [String: Any] {
                NotificationCenter.default.post(
                    name: .webAPIResponse,
                    object: nil,
                    userInfo: ["response": json, "requestId": data["requestId"] ?? ""]
                )
            }
        } catch {
            print("Web API call failed: \(error)")
        }
    }
}

// MARK: - Supporting Types

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

struct AuthResponse: Codable {
    let token: String
    let user: User?
}

struct User: Codable {
    let id: String
    let username: String
    let email: String?
}

struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: String?
    let message: String?
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

        let dataDict = try container.decode([String: JSONValue].self, forKey: .data)
        data = dataDict.mapValues { $0.value }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)

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
        case .string(let s): return s
        case .int(let i): return i
        case .double(let d): return d
        case .bool(let b): return b
        case .null: return NSNull()
        case .array(let a): return a.map { $0.value }
        case .dictionary(let d): return d.mapValues { $0.value }
        }
    }

    init(value: Any) {
        if let s = value as? String {
            self = .string(s)
        } else if let i = value as? Int {
            self = .int(i)
        } else if let d = value as? Double {
            self = .double(d)
        } else if let b = value as? Bool {
            self = .bool(b)
        } else if value is NSNull {
            self = .null
        } else if let a = value as? [Any] {
            self = .array(a.map { JSONValue(value: $0) })
        } else if let d = value as? [String: Any] {
            self = .dictionary(d.mapValues { JSONValue(value: $0) })
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
        case .string(let s): try container.encode(s)
        case .int(let i): try container.encode(i)
        case .double(let d): try container.encode(d)
        case .bool(let b): try container.encode(b)
        case .null: try container.encodeNil()
        case .array(let a): try container.encode(a)
        case .dictionary(let d): try container.encode(d)
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let agentUpdate = Notification.Name("agentUpdate")
    static let metricsUpdate = Notification.Name("metricsUpdate")
    static let chatResponse = Notification.Name("chatResponse")
    static let webAPIResponse = Notification.Name("webAPIResponse")
}
