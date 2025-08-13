import Combine
import Foundation
import Network
import OSLog
import Security
import SwiftUI

// MARK: - API Types
// These match the backend API responses

private struct APISystemMetrics: Codable {
    let cpuUsage: Double
    let memoryUsage: Double
    let uptime: Double
    let requestsPerMinute: Int
    let activeConnections: Int
}

private let logger = Logger(subsystem: "com.universalai.tools", category: "APIService")

class APIService: ObservableObject {
    static let shared = APIService()

    @Published var isConnected = false
    @Published var authToken: String?
    @Published var isAuthenticated = false

    private var baseURL: String
    private var websocket: URLSessionWebSocketTask?
    private var session: URLSession
    private var cancellables = Set<AnyCancellable>()
    private var reconnectTimer: Timer?
    private let pathMonitor = NWPathMonitor()
    private let pathQueue = DispatchQueue(label: "APIService.NetworkPath")
    private var reconnectAttempt = 0
    private let maxReconnectDelay: TimeInterval = 60
    private let reconnectBackoff = [1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 60.0]
    private let keyManager = SecureKeyManager.shared

    init() {
        self.baseURL = UserDefaults.standard.string(forKey: "BackendURL") ?? "http://localhost:9999"
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        startNetworkMonitoring()

        // Initial connection attempt with secure authentication
        Task {
            await loadSecureAuthToken()
            await connectToBackend()
        }
    }

    // MARK: - Authentication

    private func loadSecureAuthToken() async {
        logger.debug("🔐 Loading secure authentication token")

        // Try to get backend API key from secure storage
        if let backendKey = await keyManager.getBackendAPIKey() {
            await MainActor.run {
                authToken = backendKey
                isAuthenticated = true
            }
            logger.debug("✅ Loaded backend API key from secure storage")
            return
        }

        // Fallback: check if user needs to set up authentication
        logger.warning("⚠️ No secure API key found - user needs to configure authentication")
        await MainActor.run {
            isAuthenticated = false
        }

        // For development only - try environment variable
        if let envKey = ProcessInfo.processInfo.environment["UNIVERSAL_AI_API_KEY"],
           !envKey.isEmpty && envKey != "your-api-key-here" {
            await MainActor.run {
                authToken = envKey
                isAuthenticated = true
            }
            logger.debug("⚠️ Using environment API key for development")

            // Store it securely for next time
            _ = await keyManager.setBackendAPIKey(envKey)
        }
    }

    func setAuthToken(_ token: String) async -> Bool {
        let success = await keyManager.setBackendAPIKey(token)
        if success {
            await MainActor.run {
                authToken = token
                isAuthenticated = true
            }
            logger.info("✅ Authentication token updated securely")
        }
        return success
    }

    func clearAuthToken() async {
        _ = await keyManager.removeKey(for: "universal_ai_backend")
        await MainActor.run {
            authToken = nil
            isAuthenticated = false
        }
        logger.info("🗑️ Authentication token cleared")
    }

    func setBackendURL(_ url: String) {
        self.baseURL = url
        UserDefaults.standard.set(url, forKey: "BackendURL")
        Task {
            await connectToBackend()
        }
    }

    // MARK: - Connection Management

    func connectToBackend() async {
        logger.debug("🔌 Starting backend connection to: \(self.baseURL)")
        do {
            // Try status endpoint first (most reliable)
            let statusEndpoint = "\(self.baseURL)/api/v1/status"
            logger.debug("Status endpoint: \(statusEndpoint)")
            guard let url = URL(string: statusEndpoint) else {
                logger.error("❌ Invalid URL: \(statusEndpoint)")
                throw APIError.invalidURL
            }

                logger.debug("Making status request...")
                let (data, httpURLResponse) = try await session.data(from: url)
                logger.debug("Status response received - Data size: \(data.count) bytes")

                guard let httpResponse = httpURLResponse as? HTTPURLResponse else {
                logger.error("❌ Invalid HTTP response type")
                throw APIError.invalidResponse
            }

            logger.debug("HTTP Status: \(httpResponse.statusCode)")
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
                logger.debug("Status response parsed - Status: \(status.data.status), Backend: \(status.data.services.backend)")
                let isHealthy = status.data.status == "operational" &&
                               status.data.services.backend == "healthy"

                await MainActor.run {
                    self.isConnected = isHealthy
                    if isHealthy {
                        logger.info("✅ Backend connected successfully!")
                        NotificationCenter.default.post(name: .backendConnected, object: nil)
                        self.reconnectAttempt = 0
                        self.connectWebSocket()
                    } else {
                        self.handleConnectionFailure()
                    }
                }
            } else {
                logger.error("❌ HTTP Error - Status: \(httpResponse.statusCode)")
                throw APIError.httpError(statusCode: httpResponse.statusCode)
            }
        } catch {
            logger.error("❌ Backend connection failed: \(error.localizedDescription)")
            if let urlError = error as? URLError {
                logger.error("URL Error details: \(urlError.localizedDescription) (Code: \(urlError.code.rawValue))")
            }
            await MainActor.run {
                self.isConnected = false
                self.handleConnectionFailure()
            }
        }
    }

    @MainActor
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
        let endpoint = "\(baseURL)/api/v1/assistant/chat"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        } else {
            logger.warning("⚠️ No authentication token available for request")
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

        // Parse the assistant/chat endpoint response
        struct AssistantChatResponse: Codable {
            let success: Bool
            let data: AssistantData
            let metadata: AssistantMetadata
        }

        struct AssistantData: Codable {
            let response: String
            let contextUsed: Int?
            let conversationStored: Bool?
        }

        struct AssistantMetadata: Codable {
            let requestId: String
            let timestamp: String
        }

        let apiResponse = try JSONDecoder().decode(AssistantChatResponse.self, from: data)

        // Create a Message from the response
        return Message(
            id: UUID().uuidString,
            content: apiResponse.data.response,
            role: .assistant,
            timestamp: Date()
        )
    }

    // MARK: - Voice Methods

    func getAgents() async throws -> [Agent] {
        let endpoint = "\(baseURL)/api/v1/agents"
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
            let agents: [BackendAgent]
        }

        struct BackendAgent: Codable {
            let name: String
            let category: String
            let description: String
            let capabilities: [String]
        }

        let decoded = try JSONDecoder().decode(AgentsResponse.self, from: data)
        return decoded.agents.map { backendAgent in
            Agent(
                id: backendAgent.name,
                name: backendAgent.name,
                type: backendAgent.category,
                description: backendAgent.description,
                capabilities: backendAgent.capabilities,
                status: .active
            )
        }
    }

    func getObjectives() async throws -> [Objective] {
        // For now, return sample objectives since the backend doesn't support this yet
        [
            Objective(
                id: "obj-1",
                title: "Create iOS Photo Organizer App",
                description: "Build a comprehensive photo organization app with AI-powered tagging and smart albums",
                type: "Development",
                status: .active,
                progress: 65,
                tasks: ["Design UI mockups", "Implement photo import", "Add AI tagging", "Create album system"]
            ),
            Objective(
                id: "obj-2",
                title: "Organize Family Photo Collection",
                description: "Sort and categorize 10,000+ family photos by date, location, and people",
                type: "Organization",
                status: .planning,
                progress: 15,
                tasks: ["Scan for duplicates", "Extract metadata", "Group by events", "Create timeline"]
            ),
            Objective(
                id: "obj-3",
                title: "Research AI Pricing Models",
                description: "Analyze current AI service pricing and create cost optimization strategy",
                type: "Research",
                status: .completed,
                progress: 100,
                tasks: ["Compare OpenAI vs Claude", "Calculate usage costs", "Identify optimization opportunities"]
            )
        ]
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

        let apiMetrics = try JSONDecoder().decode(APISystemMetrics.self, from: data)
        return SystemMetrics(
            cpuUsage: apiMetrics.cpuUsage,
            memoryUsage: apiMetrics.memoryUsage,
            uptime: apiMetrics.uptime,
            requestsPerMinute: apiMetrics.requestsPerMinute,
            activeConnections: apiMetrics.activeConnections
        )
    }

    func getMetrics() async throws -> SystemMetrics {
        let endpoint = "\(baseURL)/api/v1/system/metrics"
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

        struct MetricsResponse: Codable {
            let success: Bool
            let data: MetricsData
        }

        struct MetricsData: Codable {
            let system: SystemData
            let agents: AgentData
            let performance: PerformanceData
        }

        struct SystemData: Codable {
            let cpu: Double
            let memory: Double
            let uptime: Double
        }

        struct AgentData: Codable {
            let active: Int
        }

        struct PerformanceData: Codable {
            let totalRequests: Int
        }

        let metricsResponse = try JSONDecoder().decode(MetricsResponse.self, from: data)
        return SystemMetrics(
            cpuUsage: metricsResponse.data.system.cpu,
            memoryUsage: metricsResponse.data.system.memory,
            uptime: metricsResponse.data.system.uptime,
            requestsPerMinute: metricsResponse.data.performance.totalRequests,
            activeConnections: metricsResponse.data.agents.active
        )
    }

    // MARK: - Agent Lifecycle
    func activateAgent(id: String) async throws {
        let endpoint = "\(baseURL)/api/v1/agents/\(id)/activate"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
    }

    func deactivateAgent(id: String) async throws {
        let endpoint = "\(baseURL)/api/v1/agents/\(id)/deactivate"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let (_, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
    }

    // MARK: - Chat Cancellation (best-effort)
    func cancelChat(conversationId: String) async {
        let endpoint = "\(baseURL)/api/v1/chat/cancel"
        guard let url = URL(string: endpoint) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let body: [String: Any] = ["conversationId": conversationId]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        _ = try? await session.data(for: request)
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

    // MARK: - MLX Methods
    func getMLXHealth() async throws -> Bool {
        let endpoint = "\(baseURL)/api/v1/mlx/health"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            return false
        }

        struct HealthResponse: Codable {
            let success: Bool
            let status: String?
        }

        let healthResponse = try? JSONDecoder().decode(HealthResponse.self, from: data)
        return healthResponse?.success ?? false
    }

    func getMLXModels() async throws -> [String] {
        let endpoint = "\(baseURL)/api/v1/mlx/models"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }

        struct ModelsResponse: Codable {
            let success: Bool
            let models: [String]
        }

        let modelsResponse = try JSONDecoder().decode(ModelsResponse.self, from: data)
        return modelsResponse.models
    }

    func getMLXMetrics() async throws -> [String: Any] {
        let endpoint = "\(baseURL)/api/v1/mlx/metrics"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }

        let json = try JSONSerialization.jsonObject(with: data, options: [])
        return json as? [String: Any] ?? [:]
    }

    deinit {
        // Clean up resources to prevent crashes
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        pathMonitor.cancel()
        websocket?.cancel(with: .normalClosure, reason: nil)
        websocket = nil
        logger.debug("APIService deinitialized and resources cleaned up")
    }
}

// MARK: - Speech and Voice Extension
extension APIService {
    func startVoiceRecording(completion: @escaping (String) -> Void) async {
        // Start recording audio and transcribe it
        // This would integrate with the backend speech/transcribe endpoint
        logger.debug("🎤 Starting voice recording")

        // For now, simulate recording
        try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds

        // Send to backend for transcription
        do {
            let transcription = try await transcribeAudio(data: Data())
            completion(transcription)
        } catch {
            logger.error("Voice recording failed: \(error)")
            completion("")
        }
    }

    func stopVoiceRecording() async {
        logger.debug("🛑 Stopping voice recording")
        // Stop the audio recording
    }

    func synthesizeSpeech(text: String, voice: String, completion: @escaping (Bool) -> Void) async {
        let endpoint = "\(baseURL)/api/speech/synthesize"
        guard let url = URL(string: endpoint) else {
            completion(false)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        } else {
            logger.warning("⚠️ No authentication token available for request")
        }

        let body: [String: Any] = [
            "text": text,
            "voice": voice,
            "speed": 1.0,
            "format": "wav"
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                completion(false)
                return
            }

            // Parse response and play audio
            struct SynthesisResponse: Codable {
                let success: Bool
                let data: SynthesisData

                struct SynthesisData: Codable {
                    let audioUrl: String
                    let duration: Double
                }
            }

            let synthesisResponse = try JSONDecoder().decode(SynthesisResponse.self, from: data)

            // Play the audio (would use AVFoundation or similar)
            logger.info("🔊 Playing synthesized speech: \(synthesisResponse.data.audioUrl)")
            completion(true)
        } catch {
            logger.error("Speech synthesis failed: \(error)")
            completion(false)
        }
    }

    private func transcribeAudio(data: Data) async throws -> String {
        let endpoint = "\(baseURL)/api/speech/transcribe"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        if let apiKey = authToken {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        // Create multipart form data for audio upload
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"audio\"; filename=\"recording.wav\"\r\n".utf8))
        body.append(Data("Content-Type: audio/wav\r\n\r\n".utf8))
        body.append(data)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))

        request.httpBody = body

        let (responseData, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }

        struct TranscriptionResponse: Codable {
            let success: Bool
            let data: TranscriptionData

            struct TranscriptionData: Codable {
                let text: String
                let language: String
                let confidence: Double
            }
        }

        let transcriptionResponse = try JSONDecoder().decode(TranscriptionResponse.self, from: responseData)
        return transcriptionResponse.data.text
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
