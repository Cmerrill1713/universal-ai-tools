import Foundation
import Combine

/// Backend communication service for macOS frontend
/// Connects to the Universal AI Tools TypeScript/Express backend
@MainActor
class MacOSBackendService: ObservableObject {
    // WebSocket integration
    private let webSocketService = WebSocketService.shared
    private var cancellables = Set<AnyCancellable>()
    static let shared = MacOSBackendService()

    // Base configuration
    private let baseURL: URL
    private let session: URLSession

    // API endpoints
    private enum Endpoint {
        static let chat = "/api/v1/chat"
        static let vision = "/api/v1/vision"
        static let speech = "/api/v1/speech"
        static let memory = "/api/v1/memory"
        static let analytics = "/api/v1/analytics"
        static let health = "/api/test"
    }

    // Published properties for UI updates
    @Published var isConnected: Bool = false
    @Published var lastError: String?

    // Real-time event publishers
    let chatMessageReceived = PassthroughSubject<String, Never>()
    let conversationUpdated = PassthroughSubject<String, Never>()
    let systemStatusUpdated = PassthroughSubject<String, Never>()

    init() {
        // Default to localhost:9999 for minimal server (more stable), can be configured via environment
        let port = ProcessInfo.processInfo.environment["BACKEND_PORT"] ?? "9999"
        let host = ProcessInfo.processInfo.environment["BACKEND_HOST"] ?? "localhost"

        guard let url = URL(string: "http://\(host):\(port)") else {
            fatalError("Invalid backend URL configuration")
        }

        self.baseURL = url

        // Configure URL session with proper headers
        let config = URLSessionConfiguration.default
        config.httpAdditionalHeaders = [
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "UniversalAITools-macOS/1.0"
        ]
        config.timeoutIntervalForRequest = 30.0
        config.timeoutIntervalForResource = 300.0

        self.session = URLSession(configuration: config)

        // Set up WebSocket event handling
        setupWebSocketObservers()

        // Test connection on initialization
        Task {
            await testConnection()
            await connectWebSocket()
        }
    }

    private func setupWebSocketObservers() {
        // Observe chat messages
        webSocketService.chatMessageReceived
            .receive(on: DispatchQueue.main)
            .sink { [weak self] message in
                self?.handleChatMessageReceived(message)
            }
            .store(in: &cancellables)

        // Observe conversation updates
        webSocketService.conversationUpdated
            .receive(on: DispatchQueue.main)
            .sink { [weak self] conversation in
                self?.handleConversationUpdated(conversation)
            }
            .store(in: &cancellables)

        // Observe system status updates
        webSocketService.systemStatusUpdated
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                self?.handleSystemStatusUpdated(status)
            }
            .store(in: &cancellables)

        // Observe connection status
        webSocketService.$isConnected
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isConnected in
                self?.isConnected = isConnected
            }
            .store(in: &cancellables)
    }

    private func connectWebSocket() async {
        await webSocketService.connect()
    }

    // MARK: - Connection Management

    func testConnection() async {
        do {
            let url = baseURL.appendingPathComponent(Endpoint.health)
            let (data, response) = try await session.data(from: url)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }

            let result = try JSONDecoder().decode(TestResponse.self, from: data)
            await MainActor.run {
                self.isConnected = result.success
                self.lastError = nil
            }

            print("✅ Backend connection successful: \(result.message)")
        } catch {
            await MainActor.run {
                self.isConnected = false
                self.lastError = "Connection failed: \(error.localizedDescription)"
            }
            print("❌ Backend connection failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Chat API

    func getConversations(userId: String = "default") async throws -> [Conversation] {
        let url = baseURL.appendingPathComponent("\(Endpoint.chat)/conversations")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        // Add user context (simplified for now)
        let queryItems = [URLQueryItem(name: "userId", value: userId)]
        if var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            components.queryItems = queryItems
            request.url = components.url
        }

        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(ChatConversationsResponse.self, from: data)

        guard response.success else {
            throw BackendError.apiError(response.error?.message ?? "Unknown error")
        }

        return response.data.conversations.map { conv in
            Conversation(
                id: conv.id,
                title: conv.title,
                messageCount: conv.messageCount,
                lastMessage: conv.lastMessage,
                createdAt: ISO8601DateFormatter().date(from: conv.createdAt) ?? Date(),
                updatedAt: ISO8601DateFormatter().date(from: conv.updatedAt) ?? Date()
            )
        }
    }

    func sendChatMessage(conversationId: String, message: String, agent: String = "default") async throws -> BackendChatMessage {
        let url = baseURL.appendingPathComponent("\(Endpoint.chat)/message")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try JSONEncoder().encode([
            "conversationId": conversationId,
            "message": message,
            "agent": agent
        ])

        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(ChatMessageResponse.self, from: data)

        guard response.success else {
            throw BackendError.apiError(response.error?.message ?? "Unknown error")
        }

        return BackendChatMessage(
            id: response.data.message.id,
            role: response.data.message.role,
            content: response.data.message.content,
            timestamp: ISO8601DateFormatter().date(from: response.data.message.timestamp) ?? Date(),
            agentName: response.data.message.metadata?.agentName,
            confidence: response.data.message.metadata?.confidence,
            tokens: response.data.message.metadata?.tokens
        )
    }

    // MARK: - Vision API

    func analyzeImage(imageData: Data, options: VisionOptions = VisionOptions()) async throws -> VisionAnalysis {
        let url = baseURL.appendingPathComponent("\(Endpoint.vision)/analyze")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        let base64String = imageData.base64EncodedString()
        let payload: [String: Any] = [
            "imageBase64": base64String,
            "options": [
                "extractText": options.extractText,
                "generateEmbedding": options.generateEmbedding,
                "detailed": options.detailed
            ]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(VisionAnalysisResponse.self, from: data)

        guard response.success else {
            throw BackendError.apiError(response.error?.message ?? "Analysis failed")
        }

        return VisionAnalysis(
            description: response.data.description,
            objects: response.data.objects ?? [],
            text: response.data.text,
            confidence: response.data.confidence ?? 0.0,
            processingTime: response.data.processingTime ?? 0.0
        )
    }

    // MARK: - Speech API

    func textToSpeech(text: String, voice: String = "default") async throws -> Data {
        let url = baseURL.appendingPathComponent("\(Endpoint.speech)/tts")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try JSONEncoder().encode([
            "text": text,
            "voice": voice,
            "format": "wav"
        ])

        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(SpeechResponse.self, from: data)

        guard response.success, let audioBase64 = response.data.audioBase64, let audioData = Data(base64Encoded: audioBase64) else {
            throw BackendError.apiError(response.error?.message ?? "TTS failed - no audio data")
        }

        return audioData
    }

    func speechToText(audioData: Data) async throws -> String {
        let url = baseURL.appendingPathComponent("\(Endpoint.speech)/stt")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        let base64String = audioData.base64EncodedString()
        request.httpBody = try JSONEncoder().encode([
            "audioBase64": base64String,
            "format": "wav"
        ])

        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(SpeechResponse.self, from: data)

        guard response.success else {
            throw BackendError.apiError(response.error?.message ?? "STT failed")
        }

        return response.data.text
    }

    // MARK: - Analytics API

    func getUsageStats(userId: String = "default") async throws -> UsageStats {
        let url = baseURL.appendingPathComponent("\(Endpoint.analytics)/stats")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let queryItems = [URLQueryItem(name: "userId", value: userId)]
        if var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            components.queryItems = queryItems
            request.url = components.url
        }

        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(UsageStatsResponse.self, from: data)

        guard response.success else {
            throw BackendError.apiError(response.error?.message ?? "Stats failed")
        }

        return UsageStats(
            totalConversations: response.data.totalConversations,
            totalImagesAnalyzed: response.data.totalImagesAnalyzed,
            totalVoiceCommands: response.data.totalVoiceCommands,
            totalTokens: response.data.totalTokens,
            period: response.data.period
        )
    }
}

// MARK: - Data Models

struct TestResponse: Codable {
    let success: Bool
    let message: String
    let timestamp: String
}

struct Conversation: Identifiable {
    let id: String
    let title: String
    let messageCount: Int
    let lastMessage: String
    let createdAt: Date
    let updatedAt: Date
}

struct BackendChatMessage: Identifiable {
    let id: String
    let role: String
    let content: String
    let timestamp: Date
    let agentName: String?
    let confidence: Double?
    let tokens: Int?
}

struct VisionOptions {
    var extractText: Bool = true
    var generateEmbedding: Bool = false
    var detailed: Bool = false
}

struct VisionAnalysis {
    let description: String
    let objects: [String]
    let text: String?
    let confidence: Double
    let processingTime: Double
}

struct UsageStats {
    let totalConversations: Int
    let totalImagesAnalyzed: Int
    let totalVoiceCommands: Int
    let totalTokens: Int
    let period: String
}

// MARK: - API Response Models

struct ChatConversationsResponse: Codable {
    let success: Bool
    let data: ConversationsData
    let error: APIError?

    struct ConversationsData: Codable {
        let conversations: [ConversationData]
        let total: Int
    }

    struct ConversationData: Codable {
        let id: String
        let title: String
        let messageCount: Int
        let lastMessage: String
        let createdAt: String
        let updatedAt: String
    }
}

struct ChatMessageResponse: Codable {
    let success: Bool
    let data: MessageData
    let error: APIError?

    struct MessageData: Codable {
        let message: MessageContent
        let conversationId: String
    }

    struct MessageContent: Codable {
        let id: String
        let role: String
        let content: String
        let timestamp: String
        let metadata: MessageMetadata?
    }

    struct MessageMetadata: Codable {
        let agentName: String?
        let confidence: Double?
        let tokens: Int?
        let error: String?
    }
}

struct VisionAnalysisResponse: Codable {
    let success: Bool
    let data: VisionData
    let error: APIError?

    struct VisionData: Codable {
        let description: String
        let objects: [String]?
        let text: String?
        let confidence: Double?
        let processingTime: Double?
    }
}

struct SpeechResponse: Codable {
    let success: Bool
    let data: SpeechData
    let error: APIError?

    struct SpeechData: Codable {
        let audioBase64: String?
        let text: String
        let duration: Double?
        let confidence: Double?
    }
}

struct UsageStatsResponse: Codable {
    let success: Bool
    let data: StatsData
    let error: APIError?

    struct StatsData: Codable {
        let totalConversations: Int
        let totalImagesAnalyzed: Int
        let totalVoiceCommands: Int
        let totalTokens: Int
        let period: String
    }
}

struct APIError: Codable {
    let code: String
    let message: String
}

// MARK: - Error Handling

enum BackendError: LocalizedError {
    case connectionFailed
    case apiError(String)
    case decodingFailed
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .connectionFailed:
            return "Failed to connect to backend service"
        case .apiError(let message):
            return "API Error: \(message)"
        case .decodingFailed:
            return "Failed to decode response from server"
        case .invalidResponse:
            return "Received invalid response from server"
        }
    }
}

// MARK: - Real-time Event Handling Extension

extension MacOSBackendService {
    func handleChatMessageReceived(_ message: String) {
        chatMessageReceived.send(message)
    }

    func handleConversationUpdated(_ conversation: String) {
        conversationUpdated.send(conversation)
    }

    func handleSystemStatusUpdated(_ status: String) {
        systemStatusUpdated.send(status)
    }

    // MARK: - WebSocket Subscription Management

    func subscribeToConversation(_ conversationId: String) async throws {
        try await webSocketService.subscribeToConversation(conversationId)
    }

    func unsubscribeFromConversation(_ conversationId: String) async throws {
        try await webSocketService.unsubscribeFromConversation(conversationId)
    }

    func sendChatMessageViaWebSocket(_ message: String, conversationId: String) async throws {
        try await webSocketService.sendChatMessage(message, conversationId: conversationId)
    }

    // MARK: - Cleanup

    func disconnect() {
        webSocketService.disconnect()
        cancellables.forEach { $0.cancel() }
    }
}
