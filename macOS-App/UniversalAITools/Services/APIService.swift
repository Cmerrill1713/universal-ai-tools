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

public class APIService: ObservableObject {
    static let shared = APIService()

    @Published var isConnected = false
    @Published var authToken: String?
    @Published var isAuthenticated = false
    @Published var localLLMAvailable = false
    @Published var availableModels: [String] = []
    @Published var lastError: APIError?
    @Published var isRefreshingToken = false

    private var baseURL: String
    private var localLLMURL: String = "http://localhost:9999"
    private var websocket: URLSessionWebSocketTask?
    private var session: URLSession
    private var cancellables = Set<AnyCancellable>()
    private var reconnectTimer: Timer?
    private let pathMonitor = NWPathMonitor()
    private let pathQueue = DispatchQueue(label: "APIService.NetworkPath")
    private var reconnectAttempt = 0
    private let maxReconnectDelay: TimeInterval = 60
    private let reconnectBackoff = [1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 60.0]
    
    // Integration with new services
    private let authService = AuthenticationService.shared
    private let keyManager = SecureKeyManager.shared
    
    // Enhanced error handling
    // private let errorRecovery = ErrorRecoveryManager()
    private var retryContext: [String: RetryContext] = [:]
    private let maxRetryAttempts = 3

    init() {
        // Check for the actual running backend port (9998 during development)
        self.baseURL = UserDefaults.standard.string(forKey: "BackendURL") ?? "http://localhost:9999"
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        startNetworkMonitoring()
        setupAuthenticationObserver()

        // Initial connection attempt with secure authentication
        Task {
            logger.info("🚀 APIService initializing...")
            await initializeAuthentication()
            await connectToBackend()
            
            // Test Ollama availability on startup
            let ollamaWorks = await testOllamaConnection()
            logger.info("🦙 Ollama availability: \(ollamaWorks)")
        }
    }

    // MARK: - Authentication Integration
    
    /// Setup observer for authentication state changes
    private func setupAuthenticationObserver() {
        authService.$isAuthenticated
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isAuthenticated in
                self?.isAuthenticated = isAuthenticated
                if isAuthenticated {
                    self?.authToken = self?.authService.currentToken
                } else {
                    self?.authToken = nil
                }
            }
            .store(in: &cancellables)
            
        authService.$currentToken
            .receive(on: DispatchQueue.main)
            .sink { [weak self] token in
                self?.authToken = token
            }
            .store(in: &cancellables)
    }
    
    /// Initialize authentication using the new AuthenticationService
    private func initializeAuthentication() async {
        do {
            // Try to restore existing session
            try await authService.restoreSession()
            
            if !authService.isAuthenticated {
                // If no stored session, try development authentication for local setup
                await loadSecureAuthToken()
            }
        } catch {
            logger.warning("Failed to restore session, falling back to legacy auth: \(error)")
            await loadSecureAuthToken()
        }
    }
    
    /// Authenticate a request with automatic token refresh
    private func authenticateRequest(_ request: inout URLRequest) async throws {
        // Try to get current token
        guard let token = authService.currentToken ?? authToken else {
            // No token available, try to authenticate
            if baseURL.contains("localhost") {
                // For local development, allow unauthenticated requests
                logger.warning("⚠️ No authentication token available for local request")
                return
            } else {
                throw APIError.authenticationRequired
            }
        }
        
        // Check if token is about to expire and refresh if needed
        if authService.isTokenNearExpiry {
            await refreshTokenIfNeeded()
        }
        
        // Add authentication header
        if token.hasPrefix("ey") { // JWT token
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else { // API key
            request.setValue(token, forHTTPHeaderField: "X-API-Key")
        }
    }
    
    /// Refresh token if needed
    private func refreshTokenIfNeeded() async {
        guard !isRefreshingToken else { return }
        
        await MainActor.run {
            isRefreshingToken = true
        }
        
        defer {
            Task { @MainActor in
                isRefreshingToken = false
            }
        }
        
        do {
            try await authService.refreshToken()
            logger.info("✅ Token refreshed successfully")
        } catch {
            logger.error("❌ Token refresh failed: \(error)")
            await MainActor.run {
                lastError = APIError.authenticationFailed(error)
            }
        }
    }

    /// Legacy authentication method for backward compatibility
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
            return
        }

        // For local development - check if backend allows unauthenticated access
        let allowsUnauthenticated = await checkUnauthenticatedAccess()
        if allowsUnauthenticated {
            logger.info("✅ Backend allows unauthenticated access for development")
            await MainActor.run {
                authToken = nil
                isAuthenticated = true // Mark as authenticated even without token
            }
            return
        }

        // Try the known development API key for local backend
        if baseURL.contains("localhost") || baseURL.contains("127.0.0.1") {
            let devKey = "universal-ai-tools-production-key-2025"
            let success = await testAPIKeyValid(devKey)
            if success {
                await MainActor.run {
                    authToken = devKey
                    isAuthenticated = true
                }
                logger.info("✅ Using development API key for local backend")
                // Store it securely for next time
                _ = await keyManager.setBackendAPIKey(devKey)
                return
            }
        }

        // Generate a development token for local backend
        let devToken = await generateDevelopmentToken()
        if !devToken.isEmpty {
            await MainActor.run {
                authToken = devToken
                isAuthenticated = true
            }
            logger.info("✅ Generated development authentication token")
            // Store it securely for next time
            _ = await keyManager.setBackendAPIKey(devToken)
            return
        }

        // Fallback: check if user needs to set up authentication
        logger.warning("⚠️ No authentication available - user needs to configure API key")
        await MainActor.run {
            isAuthenticated = false
        }
    }
    
    private func checkUnauthenticatedAccess() async -> Bool {
        do {
            let testEndpoint = "\(baseURL)/api/v1/status"
            guard let url = URL(string: testEndpoint) else { return false }
            
            let (_, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            
            // If status endpoint works without auth, assume others might too
            return httpResponse.statusCode == 200
        } catch {
            return false
        }
    }
    
    private func testAPIKeyValid(_ apiKey: String) async -> Bool {
        do {
            let testEndpoint = "\(baseURL)/api/v1/assistant/chat"
            guard let url = URL(string: testEndpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
            
            // Send a minimal test message
            let testBody: [String: Any] = [
                "message": "test",
                "agentName": "personal_assistant"
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: testBody)
            
            let (_, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            
            // Any non-401 response means the key is valid (even if the request fails for other reasons)
            return httpResponse.statusCode != 401
        } catch {
            logger.debug("API key test failed: \(error)")
            return false
        }
    }
    
    private func generateDevelopmentToken() async -> String {
        // For local development, create a simple development token
        if baseURL.contains("localhost") || baseURL.contains("127.0.0.1") {
            let devToken = "dev-token-\(UUID().uuidString.prefix(8))"
            logger.debug("Generated development token: \(devToken)")
            return devToken
        }
        return ""
    }

    func setAuthToken(_ token: String) async -> Bool {
        do {
            // Use the new authentication service for JWT tokens
            if token.hasPrefix("ey") { // JWT token
                try await authService.authenticate(username: "api", password: token)
            } else {
                // Legacy API key storage
                let success = await keyManager.setBackendAPIKey(token)
                if success {
                    await MainActor.run {
                        authToken = token
                        isAuthenticated = true
                    }
                }
                return success
            }
            
            logger.info("✅ Authentication token updated securely")
            return true
        } catch {
            logger.error("Failed to set auth token: \(error)")
            return false
        }
    }

    func clearAuthToken() async {
        do {
            await authService.logout()
        } catch {
            logger.error("Error during logout: \(error)")
        }
        
        _ = await keyManager.removeKey(for: "universal_ai_backend")
        await MainActor.run {
            authToken = nil
            isAuthenticated = false
        }
        logger.info("🗑️ Authentication token cleared")
    }
    
    /// Get current authentication status
    var currentAuthStatus: AuthenticationStatus {
        if isRefreshingToken {
            return .refreshing
        } else if isAuthenticated {
            return .authenticated
        } else {
            return .unauthenticated
        }
    }

    func setBackendURL(_ url: String) {
        self.baseURL = url
        UserDefaults.standard.set(url, forKey: "BackendURL")
        Task {
            await connectToBackend()
        }
    }
    
    // Force re-authentication for development/debugging
    func forceReauthentication() async {
        logger.info("🔄 Forcing re-authentication...")
        
        // Clear any stored authentication
        await clearAuthToken()
        
        // Reload authentication
        await loadSecureAuthToken()
        
        // Reconnect
        await connectToBackend()
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
                // Parse status response with enhanced provider info
                struct StatusResponse: Codable {
                    let success: Bool
                    let data: StatusData

                    struct StatusData: Codable {
                        let status: String
                        let services: ServiceStatus
                        let providers: ProviderStatus?

                        struct ServiceStatus: Codable {
                            let backend: String
                            let websocket: String
                        }
                        
                        struct ProviderStatus: Codable {
                            let ollama: Bool?
                            let openai: Bool?
                            let anthropic: Bool?
                        }
                    }
                }

                let status = try JSONDecoder().decode(StatusResponse.self, from: data)
                logger.debug("Status response parsed - Status: \(status.data.status), Backend: \(status.data.services.backend)")
                
                // Check if Ollama is available as fallback for local LLM
                let ollamaAvailable = status.data.providers?.ollama ?? false
                if ollamaAvailable {
                    logger.info("✅ Ollama provider detected and available")
                }
                
                let isHealthy = status.data.status == "operational" &&
                               status.data.services.backend == "healthy"

                // Now test actual API functionality with a lightweight request
                let apiHealthy = await testAPIFunctionality()

                await MainActor.run {
                    self.isConnected = isHealthy && apiHealthy
                    if self.isConnected {
                        logger.info("✅ Backend connected and API functional!")
                        NotificationCenter.default.post(name: .backendConnected, object: nil)
                        self.reconnectAttempt = 0
                        self.connectWebSocket()
                    } else {
                        logger.warning("⚠️ Backend reachable but API not functional")
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
    
    // Test actual API functionality beyond just health check
    private func testAPIFunctionality() async -> Bool {
        do {
            // Try to hit a simple API endpoint that would require auth if needed
            let testEndpoint = "\(baseURL)/api/v1/agents"
            guard let url = URL(string: testEndpoint) else { return false }
            
            var request = URLRequest(url: url)
            
            // Add auth if available
            if let apiKey = authToken {
                request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
                logger.debug("Testing API with authentication token")
            } else {
                logger.debug("Testing API without authentication (checking if auth required)")
            }
            
            let (_, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            
            // 200 = success, 401 = auth required but endpoint exists, 404 = endpoint missing
            let functional = [200, 401].contains(httpResponse.statusCode)
            
            if httpResponse.statusCode == 401 && authToken == nil {
                logger.warning("⚠️ API requires authentication but no token configured")
            } else if httpResponse.statusCode == 200 {
                logger.info("✅ API test successful with authentication")
            }
            
            return functional
        } catch {
            logger.error("❌ API functionality test failed: \(error)")
            return false
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
        case "voice_transcription_update", "voice_synthesis_complete", "voice_interaction_started", "voice_interaction_ended":
            handleVoiceWebSocketMessage(message)
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
        logger.debug("🔥 Sending chat message: \(message.prefix(50))...")
        
        return try await executeWithRetry("sendChatMessage") {
            try await self.performChatRequest(message, chatId: chatId)
        }
    }
    
    /// Perform the actual chat request with enhanced error handling
    private func performChatRequest(_ message: String, chatId: String) async throws -> Message {
        let endpoint = "\(baseURL)/api/v1/assistant/chat"
        guard let url = URL(string: endpoint) else {
            logger.error("❌ Invalid chat endpoint URL: \(endpoint)")
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Enhanced authentication with automatic refresh
        try await authenticateRequest(&request)

        let body: [String: Any] = [
            "message": message,
            "conversationId": chatId.isEmpty ? nil : chatId,
            "agentName": "personal_assistant"
        ].compactMapValues { $0 }

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            logger.debug("📤 Chat request prepared: \(body)")
        } catch {
            logger.error("❌ Failed to serialize chat request body: \(error)")
            throw APIError.networkError(error)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            logger.error("❌ Invalid HTTP response type")
            throw APIError.invalidResponse
        }

        logger.debug("📥 Chat response status: \(httpResponse.statusCode)")

        // Handle authentication errors with token refresh
        if httpResponse.statusCode == 401 {
            logger.warning("🔄 Authentication failed, attempting token refresh...")
            throw APIError.authenticationRequired
        }

        try validateHTTPResponse(httpResponse, data: data)

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

        do {
            let apiResponse = try JSONDecoder().decode(AssistantChatResponse.self, from: data)
            logger.info("✅ Chat response received: \(apiResponse.data.response.prefix(100))...")
            
            // Create a Message from the response
            return Message(
                role: .assistant,
                content: apiResponse.data.response
            )
        } catch {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode response"
            logger.error("❌ Failed to decode chat response: \(error)")
            logger.error("❌ Raw response: \(responseString)")
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Voice Methods

    func getAgents() async throws -> [Agent] {
        return try await executeWithRetry("getAgents") {
            try await self.performGetAgentsRequest()
        }
    }
    
    private func performGetAgentsRequest() async throws -> [Agent] {
        let endpoint = "\(baseURL)/api/v1/agents"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)

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
                name: backendAgent.name,
                type: AgentType(rawValue: backendAgent.category) ?? .chat,
                description: backendAgent.description,
                capabilities: backendAgent.capabilities
            )
        }
    }

    func getObjectives() async throws -> [Objective] {
        // For now, return sample objectives since the backend doesn't support this yet
        [
            Objective(
                title: "Create iOS Photo Organizer App",
                description: "Build a comprehensive photo organization app with AI-powered tagging and smart albums"
            ),
            Objective(
                title: "Organize Family Photo Collection",
                description: "Sort and categorize 10,000+ family photos by date, location, and people"
            ),
            Objective(
                title: "Research AI Pricing Models",
                description: "Analyze current AI service pricing and create cost optimization strategy"
            )
        ]
    }

    func getDetailedHealth() async throws -> SystemMetrics {
        return try await executeWithRetry("getDetailedHealth") {
            try await self.performGetDetailedHealthRequest()
        }
    }
    
    private func performGetDetailedHealthRequest() async throws -> SystemMetrics {
        let endpoint = "\(baseURL)/api/v1/health/detailed"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)

        let apiMetrics = try JSONDecoder().decode(APISystemMetrics.self, from: data)
        return SystemMetrics(
            cpuUsage: apiMetrics.cpuUsage,
            memoryUsage: apiMetrics.memoryUsage,
            activeConnections: apiMetrics.activeConnections
        )
    }

    func getMetrics() async throws -> SystemMetrics {
        return try await executeWithRetry("getMetrics") {
            try await self.performGetMetricsRequest()
        }
    }
    
    private func performGetMetricsRequest() async throws -> SystemMetrics {
        let endpoint = "\(baseURL)/api/v1/system/metrics"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)

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
            activeConnections: metricsResponse.data.agents.active
        )
    }

    // MARK: - Agent Orchestration API
    
    /// Get real-time agent status and health monitoring
    func getOrchestrationStatus() async throws -> AgentOrchestrationStatus {
        return try await executeWithRetry("getOrchestrationStatus") {
            try await self.performGetOrchestrationStatusRequest()
        }
    }
    
    private func performGetOrchestrationStatusRequest() async throws -> AgentOrchestrationStatus {
        let endpoint = "\(baseURL)/api/v1/agent-orchestration/status"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        return try JSONDecoder().decode(AgentOrchestrationStatus.self, from: data)
    }
    
    /// Get network topology for visualization
    func getOrchestrationTopology() async throws -> NetworkTopology {
        return try await executeWithRetry("getOrchestrationTopology") {
            try await self.performGetOrchestrationTopologyRequest()
        }
    }
    
    private func performGetOrchestrationTopologyRequest() async throws -> NetworkTopology {
        let endpoint = "\(baseURL)/api/v1/agent-orchestration/topology"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        struct TopologyResponse: Codable {
            let success: Bool
            let data: NetworkTopology
        }
        
        let topologyResponse = try JSONDecoder().decode(TopologyResponse.self, from: data)
        return topologyResponse.data
    }
    
    /// Get agent performance metrics and analytics
    func getOrchestrationMetrics(timeRange: String = "1h", agentName: String? = nil) async throws -> AgentMetricsResponse {
        return try await executeWithRetry("getOrchestrationMetrics") {
            try await self.performGetOrchestrationMetricsRequest(timeRange: timeRange, agentName: agentName)
        }
    }
    
    private func performGetOrchestrationMetricsRequest(timeRange: String, agentName: String?) async throws -> AgentMetricsResponse {
        var endpoint = "\(baseURL)/api/v1/agent-orchestration/metrics?timeRange=\(timeRange)"
        if let agentName = agentName {
            endpoint += "&agentName=\(agentName)"
        }
        
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        return try JSONDecoder().decode(AgentMetricsResponse.self, from: data)
    }
    
    /// Create new agent task assignment
    func createAgentTask(agentName: String, type: String, context: [String: Any], priority: Int = 1, estimatedDuration: TimeInterval? = nil) async throws -> AgentTaskResponse {
        return try await executeWithRetry("createAgentTask") {
            try await self.performCreateAgentTaskRequest(agentName: agentName, type: type, context: context, priority: priority, estimatedDuration: estimatedDuration)
        }
    }
    
    private func performCreateAgentTaskRequest(agentName: String, type: String, context: [String: Any], priority: Int, estimatedDuration: TimeInterval?) async throws -> AgentTaskResponse {
        let endpoint = "\(baseURL)/api/v1/agent-orchestration/tasks"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await authenticateRequest(&request)

        var body: [String: Any] = [
            "agentName": agentName,
            "type": type,
            "context": context,
            "priority": priority
        ]
        
        if let estimatedDuration = estimatedDuration {
            body["estimatedDuration"] = estimatedDuration
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        return try JSONDecoder().decode(AgentTaskResponse.self, from: data)
    }
    
    /// Get active and historical tasks
    func getAgentTasks(status: String? = nil, agentName: String? = nil, limit: Int = 100) async throws -> AgentTasksResponse {
        return try await executeWithRetry("getAgentTasks") {
            try await self.performGetAgentTasksRequest(status: status, agentName: agentName, limit: limit)
        }
    }
    
    private func performGetAgentTasksRequest(status: String?, agentName: String?, limit: Int) async throws -> AgentTasksResponse {
        var endpoint = "\(baseURL)/api/v1/agent-orchestration/tasks?limit=\(limit)"
        if let status = status {
            endpoint += "&status=\(status)"
        }
        if let agentName = agentName {
            endpoint += "&agentName=\(agentName)"
        }
        
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        return try JSONDecoder().decode(AgentTasksResponse.self, from: data)
    }
    
    /// Request agent collaboration
    func requestAgentCollaboration(task: String, requiredCapabilities: [String], teamSize: Int = 3, priority: String = "medium") async throws -> CollaborationResponse {
        return try await executeWithRetry("requestAgentCollaboration") {
            try await self.performRequestAgentCollaborationRequest(task: task, requiredCapabilities: requiredCapabilities, teamSize: teamSize, priority: priority)
        }
    }
    
    private func performRequestAgentCollaborationRequest(task: String, requiredCapabilities: [String], teamSize: Int, priority: String) async throws -> CollaborationResponse {
        let endpoint = "\(baseURL)/api/v1/agent-orchestration/collaborate"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await authenticateRequest(&request)

        let body: [String: Any] = [
            "task": task,
            "requiredCapabilities": requiredCapabilities,
            "teamSize": teamSize,
            "priority": priority
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        return try JSONDecoder().decode(CollaborationResponse.self, from: data)
    }
    
    /// Get A2A communication history and tracking
    func getAgentCommunications(limit: Int = 100, agentName: String? = nil, messageType: String? = nil) async throws -> CommunicationsResponse {
        return try await executeWithRetry("getAgentCommunications") {
            try await self.performGetAgentCommunicationsRequest(limit: limit, agentName: agentName, messageType: messageType)
        }
    }
    
    private func performGetAgentCommunicationsRequest(limit: Int, agentName: String?, messageType: String?) async throws -> CommunicationsResponse {
        var endpoint = "\(baseURL)/api/v1/agent-orchestration/communications?limit=\(limit)"
        if let agentName = agentName {
            endpoint += "&agentName=\(agentName)"
        }
        if let messageType = messageType {
            endpoint += "&messageType=\(messageType)"
        }
        
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        return try JSONDecoder().decode(CommunicationsResponse.self, from: data)
    }
    
    /// Get resource usage monitoring per agent
    func getAgentResources(agentName: String? = nil) async throws -> ResourceUsageResponse {
        return try await executeWithRetry("getAgentResources") {
            try await self.performGetAgentResourcesRequest(agentName: agentName)
        }
    }
    
    private func performGetAgentResourcesRequest(agentName: String?) async throws -> ResourceUsageResponse {
        var endpoint = "\(baseURL)/api/v1/agent-orchestration/resources"
        if let agentName = agentName {
            endpoint += "?agentName=\(agentName)"
        }
        
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        try await authenticateRequest(&request)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        return try JSONDecoder().decode(ResourceUsageResponse.self, from: data)
    }
    
    /// Orchestrate complex multi-agent workflows
    func orchestrateAgents(primaryAgent: String, supportingAgents: [String] = [], context: [String: Any], workflow: [String: Any]? = nil) async throws -> OrchestrationResponse {
        return try await executeWithRetry("orchestrateAgents") {
            try await self.performOrchestrateAgentsRequest(primaryAgent: primaryAgent, supportingAgents: supportingAgents, context: context, workflow: workflow)
        }
    }
    
    private func performOrchestrateAgentsRequest(primaryAgent: String, supportingAgents: [String], context: [String: Any], workflow: [String: Any]?) async throws -> OrchestrationResponse {
        let endpoint = "\(baseURL)/api/v1/agent-orchestration/orchestrate"
        guard let url = URL(string: endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        try await authenticateRequest(&request)

        var body: [String: Any] = [
            "primaryAgent": primaryAgent,
            "supportingAgents": supportingAgents,
            "context": context
        ]
        
        if let workflow = workflow {
            body["workflow"] = workflow
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            throw APIError.authenticationRequired
        }
        
        try validateHTTPResponse(httpResponse, data: data)
        
        return try JSONDecoder().decode(OrchestrationResponse.self, from: data)
    }
    
    /// Connect to orchestration WebSocket for real-time updates
    func connectOrchestrationWebSocket() async throws -> String {
        let wsURL = baseURL.replacingOccurrences(of: "http", with: "ws") + "/ws/agent-orchestration"
        guard let url = URL(string: wsURL) else {
            throw APIError.invalidURL
        }

        var options = ConnectionOptions.default
        if let token = authToken {
            options = ConnectionOptions(
                sessionConfiguration: options.sessionConfiguration,
                enableCompression: options.enableCompression,
                enableEncryption: options.enableEncryption,
                timeout: options.timeout,
                headers: ["Authorization": "Bearer \(token)"]
            )
        }

        let connectionId = try await EnhancedWebSocketManager.shared.connect(to: wsURL, options: options)
        logger.info("✅ Connected to orchestration WebSocket: \(connectionId)")
        
        return connectionId
    }
    
    /// Subscribe to orchestration events
    func subscribeToOrchestrationEvents(connectionId: String) -> AnyPublisher<[String: Any], Never> {
        guard let connection = EnhancedWebSocketManager.shared.activeConnections[connectionId] else {
            return Empty<[String: Any], Never>().eraseToAnyPublisher()
        }
        
        return connection.messageSubject
            .filter { message in
                // Filter for orchestration-related messages
                if let type = message["type"] as? String {
                    return ["agent_loaded", "agent_unloaded", "agent_communication", "periodic_update",
                           "task_created", "task_started", "task_completed", "task_failed",
                           "collaboration_started", "orchestration_completed"].contains(type)
                }
                return false
            }
            .eraseToAnyPublisher()
    }

    // MARK: - Legacy Agent Lifecycle (maintained for compatibility)
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

    // MARK: - Local LLM Integration
    func sendMessageToLocalLLM(_ message: String, model: String = "tinyllama:latest", ragSettings: RAGSettings? = nil) async throws -> Message {
        logger.debug("🦙 Attempting local LLM connection for message: \(message.prefix(50))...")
        
        // First try our unified local LLM server
        if await checkLocalLLMServerAvailable() {
            logger.info("🚀 Using unified local LLM server")
            return try await sendMessageToLocalLLMServer(message, model: model, ragSettings: ragSettings)
        }
        
        // Fallback to direct Ollama/LM Studio
        let lmStudioEndpoint = UserDefaults.standard.string(forKey: "lmStudioEndpoint") ?? "http://localhost:1234/v1"
        let ollamaEndpoint = UserDefaults.standard.string(forKey: "ollamaEndpoint") ?? "http://localhost:11434"
        
        // Try LM Studio first if configured
        if await testLMStudioConnection() {
            logger.info("🤖 Using LM Studio for local LLM")
            return try await sendMessageToLMStudio(message)
        }
        
        // Fall back to Ollama
        let chatUrl = "\(ollamaEndpoint)/api/chat"
        
        guard let url = URL(string: chatUrl) else {
            logger.error("❌ Invalid Ollama URL: \(chatUrl)")
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60 // Ollama can be slow
        
        let requestBody: [String: Any] = [
            "model": model,
            "messages": [
                [
                    "role": "user",
                    "content": message
                ]
            ],
            "stream": false
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        } catch {
            logger.error("❌ Failed to serialize Ollama request: \(error)")
            throw APIError.networkError(error)
        }
        
        logger.debug("🔄 Making direct request to Ollama...")
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            logger.error("❌ Invalid HTTP response from Ollama")
            throw APIError.invalidResponse
        }
        
        logger.debug("📥 Ollama response status: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 else {
            let errorData = String(data: data, encoding: .utf8) ?? "No error data"
            logger.error("❌ Ollama error (\(httpResponse.statusCode)): \(errorData)")
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
        
        // Parse Ollama response
        struct OllamaResponse: Codable {
            let message: OllamaMessage
            let done: Bool
            
            struct OllamaMessage: Codable {
                let role: String
                let content: String
            }
        }
        
        do {
            let ollamaResponse = try JSONDecoder().decode(OllamaResponse.self, from: data)
            logger.info("✅ Ollama response received: \(ollamaResponse.message.content.prefix(100))...")
            
            return Message(
                role: .assistant,
                content: ollamaResponse.message.content
            )
        } catch {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode response"
            logger.error("❌ Failed to decode Ollama response: \(error)")
            logger.error("❌ Raw Ollama response: \(responseString)")
            throw APIError.decodingError(error)
        }
    }
    
    private func sendMessageToLMStudio(_ message: String) async throws -> Message {
        logger.debug("🤖 Attempting LM Studio connection for message: \(message.prefix(50))...")
        
        let lmStudioEndpoint = UserDefaults.standard.string(forKey: "lmStudioEndpoint") ?? "http://localhost:1234/v1"
        let chatUrl = "\(lmStudioEndpoint)/chat/completions"
        
        guard let url = URL(string: chatUrl) else {
            logger.error("❌ Invalid LM Studio URL: \(chatUrl)")
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60
        
        let requestBody: [String: Any] = [
            "model": "local-model", // LM Studio uses generic model name
            "messages": [
                [
                    "role": "user",
                    "content": message
                ]
            ],
            "temperature": 0.7,
            "max_tokens": 2048
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        
        // Parse OpenAI-compatible response
        struct LMStudioResponse: Codable {
            let choices: [Choice]
            
            struct Choice: Codable {
                let message: ChatMessage
                
                struct ChatMessage: Codable {
                    let content: String
                    let role: String
                }
            }
        }
        
        let lmStudioResponse = try JSONDecoder().decode(LMStudioResponse.self, from: data)
        guard let firstChoice = lmStudioResponse.choices.first else {
            throw APIError.invalidResponse
        }
        
        logger.info("✅ LM Studio response received: \(firstChoice.message.content.prefix(100))...")
        
        return Message(
            role: .assistant,
            content: firstChoice.message.content
        )
    }
    
    func checkLocalLLMServerAvailable() async -> Bool {
        let healthUrl = "\(localLLMURL)/health"
        
        do {
            guard let url = URL(string: healthUrl) else { return false }
            let (_, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            let available = httpResponse.statusCode == 200
            
            await MainActor.run {
                self.localLLMAvailable = available
            }
            
            return available
        } catch {
            await MainActor.run {
                self.localLLMAvailable = false
            }
            return false
        }
    }
    
    private func sendMessageToLocalLLMServer(_ message: String, model: String, ragSettings: RAGSettings? = nil) async throws -> Message {
        let chatUrl = "\(localLLMURL)/local/chat"
        guard let url = URL(string: chatUrl) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "message": message,
            "model": model,
            "provider": "auto",
            "temperature": 0.7,
            "max_tokens": 500
        ]
        
        // Add RAG parameters if provided
        if let ragSettings = ragSettings, ragSettings.isEnabled {
            body["useRAG"] = true
            body["maxContext"] = ragSettings.maxContext
            body["includeGraphPaths"] = ragSettings.includeGraphPaths
            body["sessionId"] = ragSettings.sessionId
            if !ragSettings.projectPath.isEmpty {
                body["projectPath"] = ragSettings.projectPath
            }
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        
        struct LocalLLMResponse: Codable {
            let success: Bool
            let response: String
            let model: String
            let provider: String
            let rag: RAGResponseMetadata?
        }
        
        struct RAGResponseMetadata: Codable {
            let contextUsed: Int
            let sources: [RAGSourceResponse]
            let graphPaths: Int
            let clusters: Int
        }
        
        struct RAGSourceResponse: Codable {
            let type: String
            let preview: String
            let score: Double
        }
        
        let llmResponse = try JSONDecoder().decode(LocalLLMResponse.self, from: data)
        
        if llmResponse.success {
            // Convert RAG metadata if present
            var ragMetadata: RAGMetadata?
            if let ragData = llmResponse.rag {
                ragMetadata = RAGMetadata(
                    contextUsed: ragData.contextUsed,
                    sources: ragData.sources.map { RAGSource(type: $0.type, preview: $0.preview, score: $0.score) },
                    graphPaths: ragData.graphPaths,
                    clusters: ragData.clusters
                )
            }
            
            return Message(
                role: .assistant,
                content: llmResponse.response,
                model: llmResponse.model,
                ragMetadata: ragMetadata
            )
        } else {
            throw APIError.requestFailed("Local LLM server returned error")
        }
    }
    
    private func testLMStudioConnection() async -> Bool {
        let lmStudioEndpoint = UserDefaults.standard.string(forKey: "lmStudioEndpoint") ?? "http://localhost:1234/v1"
        let modelsUrl = "\(lmStudioEndpoint)/models"
        
        do {
            guard let url = URL(string: modelsUrl) else { return false }
            let (_, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            return httpResponse.statusCode == 200
        } catch {
            return false
        }
    }
    
    func testOllamaConnection() async -> Bool {
        logger.debug("🧪 Testing direct Ollama connection...")
        
        let ollamaEndpoint = UserDefaults.standard.string(forKey: "ollamaEndpoint") ?? "http://localhost:11434"
        let tagsUrl = "\(ollamaEndpoint)/api/tags"
        
        do {
            guard let url = URL(string: tagsUrl) else { return false }
            
            let (data, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse else { return false }
            
            if httpResponse.statusCode == 200 {
                // Parse to see if models are available
                struct TagsResponse: Codable {
                    let models: [OllamaModel]
                    
                    struct OllamaModel: Codable {
                        let name: String
                    }
                }
                
                let tagsResponse = try JSONDecoder().decode(TagsResponse.self, from: data)
                let hasModels = !tagsResponse.models.isEmpty
                
                if hasModels {
                    logger.info("✅ Ollama is running with \(tagsResponse.models.count) models available")
                    return true
                } else {
                    logger.warning("⚠️ Ollama is running but no models are available")
                    return false
                }
            }
        } catch {
            logger.debug("❌ Ollama connection test failed: \(error)")
        }
        
        return false
    }
    
    // Enhanced sendChatMessage with Ollama fallback
    func sendChatMessageWithFallback(_ message: String, chatId: String) async throws -> Message {
        // First try the backend
        do {
            return try await sendChatMessage(message, chatId: chatId)
        } catch {
            logger.warning("⚠️ Backend chat failed, trying Ollama fallback: \(error)")
            
            // Test if Ollama is available
            let ollamaAvailable = await testOllamaConnection()
            if ollamaAvailable {
                logger.info("🦙 Using Ollama as fallback for chat")
                return try await sendMessageToLocalLLM(message)
            } else {
                logger.error("❌ Both backend and Ollama are unavailable")
                throw error // Re-throw original error
            }
        }
    }

    // MARK: - RAG Methods
    func ragSearch(query: String, maxResults: Int = 10, sessionId: String? = nil, projectPath: String? = nil, includeGraph: Bool = false) async throws -> RAGSearchResult {
        let searchUrl = "\(localLLMURL)/local/rag/search"
        guard let url = URL(string: searchUrl) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "query": query,
            "maxResults": maxResults,
            "includeGraph": includeGraph
        ]
        
        if let sessionId = sessionId {
            body["sessionId"] = sessionId
        }
        
        if let projectPath = projectPath {
            body["projectPath"] = projectPath
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        
        struct RAGSearchResponse: Codable {
            let success: Bool
            let semantic: SemanticResults
            let graph: [JSONValue] // Using JSONValue for flexibility
            let requestId: String
            let timestamp: String
            
            struct SemanticResults: Codable {
                let results: [SemanticResult]
                // clusters: skipping for now
            }
            
            struct SemanticResult: Codable {
                let contentType: String
                let content: String
                let score: Double
            }
        }
        
        let searchResponse = try JSONDecoder().decode(RAGSearchResponse.self, from: data)
        
        if searchResponse.success {
            let sources = searchResponse.semantic.results.map { result in
                RAGSource(
                    type: result.contentType,
                    preview: String(result.content.prefix(200)) + (result.content.count > 200 ? "..." : ""),
                    score: result.score
                )
            }
            
            return RAGSearchResult(
                sources: sources,
                graphPaths: searchResponse.graph.count,
                requestId: searchResponse.requestId
            )
        } else {
            throw APIError.requestFailed("RAG search failed")
        }
    }
    
    func ragIndex(content: String, contentType: String = "general", projectPath: String? = nil, metadata: [String: Any]? = nil) async throws -> RAGIndexResult {
        let indexUrl = "\(localLLMURL)/local/rag/index"
        guard let url = URL(string: indexUrl) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "content": content,
            "contentType": contentType
        ]
        
        if let projectPath = projectPath {
            body["projectPath"] = projectPath
        }
        
        if let metadata = metadata {
            body["metadata"] = metadata
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.invalidResponse
        }
        
        struct RAGIndexResponse: Codable {
            let success: Bool
            let indexed: IndexedStats
            let requestId: String
            let timestamp: String
            
            struct IndexedStats: Codable {
                let entities: Int
                let relationships: Int
                let hyperedges: Int
            }
        }
        
        let indexResponse = try JSONDecoder().decode(RAGIndexResponse.self, from: data)
        
        if indexResponse.success {
            return RAGIndexResult(
                entities: indexResponse.indexed.entities,
                relationships: indexResponse.indexed.relationships,
                hyperedges: indexResponse.indexed.hyperedges,
                requestId: indexResponse.requestId
            )
        } else {
            throw APIError.requestFailed("RAG indexing failed")
        }
    }

    // MARK: - Testing and Debug Methods
    func testChatFunctionality() async {
        logger.info("🧪 Testing chat functionality...")
        
        // Test 1: Backend chat
        do {
            let backendResponse = try await sendChatMessage("Test message", chatId: "test")
            logger.info("✅ Backend chat works: \(backendResponse.content.prefix(50))...")
        } catch {
            logger.warning("❌ Backend chat failed: \(error)")
        }
        
        // Test 2: Ollama direct
        do {
            let ollamaResponse = try await sendMessageToLocalLLM("Test message")
            logger.info("✅ Ollama direct works: \(ollamaResponse.content.prefix(50))...")
        } catch {
            logger.warning("❌ Ollama direct failed: \(error)")
        }
        
        // Test 3: Fallback method
        do {
            let fallbackResponse = try await sendChatMessageWithFallback("Test message", chatId: "test")
            logger.info("✅ Fallback method works: \(fallbackResponse.content.prefix(50))...")
        } catch {
            logger.warning("❌ Fallback method failed: \(error)")
        }
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
        cancellables.removeAll()
        logger.debug("APIService deinitialized and resources cleaned up")
    }
}

// MARK: - Authentication Status
enum AuthenticationStatus {
    case unauthenticated
    case authenticated
    case refreshing
    
    var description: String {
        switch self {
        case .unauthenticated: return "Not authenticated"
        case .authenticated: return "Authenticated"
        case .refreshing: return "Refreshing token"
        }
    }
    
    // MARK: - HTTP Response Validation
    
    /// Validate HTTP response and throw appropriate errors
    private func validateHTTPResponse(_ response: HTTPURLResponse, data: Data) throws {
        switch response.statusCode {
        case 200...299:
            // Success
            return
            
        case 400...499:
            // Client errors
            let errorMessage = parseErrorMessage(from: data) ?? "Client error"
            
            switch response.statusCode {
            case 401:
                throw APIError.authenticationRequired
            case 403:
                throw APIError.clientError(response.statusCode, "Forbidden: \(errorMessage)")
            case 404:
                throw APIError.clientError(response.statusCode, "Not found: \(errorMessage)")
            case 429:
                let retryAfter = parseRetryAfter(from: response)
                throw APIError.rateLimited(retryAfter: retryAfter)
            default:
                throw APIError.clientError(response.statusCode, errorMessage)
            }
            
        case 500...599:
            // Server errors
            let errorMessage = parseErrorMessage(from: data) ?? "Server error"
            throw APIError.serverError(response.statusCode, errorMessage)
            
        default:
            throw APIError.httpError(statusCode: response.statusCode)
        }
    }
    
    /// Parse error message from response data
    private func parseErrorMessage(from data: Data) -> String? {
        guard let jsonObject = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return String(data: data, encoding: .utf8)
        }
        
        // Try common error message fields
        if let message = jsonObject["message"] as? String {
            return message
        }
        if let error = jsonObject["error"] as? String {
            return error
        }
        if let detail = jsonObject["detail"] as? String {
            return detail
        }
        
        return nil
    }
    
    /// Parse retry-after header for rate limiting
    private func parseRetryAfter(from response: HTTPURLResponse) -> TimeInterval? {
        if let retryAfterString = response.value(forHTTPHeaderField: "Retry-After"),
           let retryAfterSeconds = TimeInterval(retryAfterString) {
            return retryAfterSeconds
        }
        return nil
    }
}

// MARK: - Voice and Speech Extension
extension APIService {
    
    // MARK: - Voice Chat Endpoint Integration
    
    /// Send a voice message to the voice chat endpoint
    func sendVoiceMessage(_ message: String, voiceSettings: APIVoiceSettings? = nil) async throws -> VoiceResponse {
        logger.debug("🎙️ Sending voice message: \(message.prefix(50))...")
        
        let endpoint = "\(baseURL)/api/v1/voice/chat"
        guard let url = URL(string: endpoint) else {
            logger.error("❌ Invalid voice chat endpoint URL: \(endpoint)")
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60 // Voice processing can take longer
        
        // Add authentication if available
        if let apiKey = authToken, !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
            logger.debug("✅ Using authentication token for voice request")
        } else {
            logger.warning("⚠️ No authentication token available - attempting unauthenticated request")
        }
        
        // Prepare request body
        var body: [String: Any] = [
            "message": message,
            "enableSpeech": true,
            "enableTranscription": true
        ]
        
        // Add voice settings if provided
        if let settings = voiceSettings {
            body["voice"] = settings.voice
            body["speed"] = settings.speed
            body["pitch"] = settings.pitch
            body["emotion"] = settings.emotion
        }
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            logger.debug("📤 Voice request prepared: \(body)")
        } catch {
            logger.error("❌ Failed to serialize voice request body: \(error)")
            throw APIError.networkError(error)
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            logger.error("❌ Invalid HTTP response type")
            throw APIError.invalidResponse
        }
        
        logger.debug("📥 Voice response status: \(httpResponse.statusCode)")
        
        if httpResponse.statusCode == 401 {
            logger.error("❌ Authentication failed for voice request")
            await loadSecureAuthToken()
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorData = String(data: data, encoding: .utf8) ?? "No error data"
            logger.error("❌ Voice API error (\(httpResponse.statusCode)): \(errorData)")
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
        
        // Parse the voice chat response
        do {
            let voiceResponse = try JSONDecoder().decode(VoiceResponse.self, from: data)
            logger.info("✅ Voice response received with audio: \(voiceResponse.audioData != nil)")
            return voiceResponse
        } catch {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode response"
            logger.error("❌ Failed to decode voice response: \(error)")
            logger.error("❌ Raw response: \(responseString)")
            throw APIError.decodingError(error)
        }
    }
    
    // MARK: - Transcription Endpoint
    
    /// Transcribe audio data using the backend transcription service
    func transcribeAudio(audioData: Data, language: String? = nil, model: String? = nil) async throws -> TranscriptionResponse {
        logger.debug("🎤 Starting audio transcription (size: \(audioData.count) bytes)")
        
        let endpoint = "\(baseURL)/api/v1/voice/transcribe"
        guard let url = URL(string: endpoint) else {
            logger.error("❌ Invalid transcription endpoint URL: \(endpoint)")
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 120 // Transcription can take longer for larger files
        
        // Add authentication if available
        if let apiKey = authToken, !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }
        
        // Create multipart form data for audio upload
        let boundary = "UniversalAITools-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Add audio file
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"audio\"; filename=\"recording.wav\"\r\n".utf8))
        body.append(Data("Content-Type: audio/wav\r\n\r\n".utf8))
        body.append(audioData)
        body.append(Data("\r\n".utf8))
        
        // Add optional language parameter
        if let language = language {
            body.append(Data("--\(boundary)\r\n".utf8))
            body.append(Data("Content-Disposition: form-data; name=\"language\"\r\n\r\n".utf8))
            body.append(Data("\(language)\r\n".utf8))
        }
        
        // Add optional model parameter
        if let model = model {
            body.append(Data("--\(boundary)\r\n".utf8))
            body.append(Data("Content-Disposition: form-data; name=\"model\"\r\n\r\n".utf8))
            body.append(Data("\(model)\r\n".utf8))
        }
        
        // Add timestamp for processing tracking
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"timestamp\"\r\n\r\n".utf8))
        body.append(Data("\(Date().timeIntervalSince1970)\r\n".utf8))
        
        body.append(Data("--\(boundary)--\r\n".utf8))
        
        request.httpBody = body
        
        logger.debug("📤 Transcription request prepared (body size: \(body.count) bytes)")
        
        let (responseData, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            logger.error("❌ Invalid HTTP response type for transcription")
            throw APIError.invalidResponse
        }
        
        logger.debug("📥 Transcription response status: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 else {
            let errorData = String(data: responseData, encoding: .utf8) ?? "No error data"
            logger.error("❌ Transcription API error (\(httpResponse.statusCode)): \(errorData)")
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
        
        do {
            let transcriptionResponse = try JSONDecoder().decode(TranscriptionResponse.self, from: responseData)
            logger.info("✅ Transcription completed: \(transcriptionResponse.data.text.prefix(100))...")
            return transcriptionResponse
        } catch {
            let responseString = String(data: responseData, encoding: .utf8) ?? "Unable to decode response"
            logger.error("❌ Failed to decode transcription response: \(error)")
            logger.error("❌ Raw response: \(responseString)")
            throw APIError.decodingError(error)
        }
    }
    
    // MARK: - Speech Synthesis Endpoint
    
    /// Synthesize speech from text using the backend TTS service
    func synthesizeSpeech(text: String, voice: String? = nil, settings: SynthesisSettings? = nil) async throws -> SynthesisResponse {
        logger.debug("🔊 Starting speech synthesis for text: \(text.prefix(50))...")
        
        let endpoint = "\(baseURL)/api/v1/voice/synthesize"
        guard let url = URL(string: endpoint) else {
            logger.error("❌ Invalid synthesis endpoint URL: \(endpoint)")
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60 // Speech synthesis timing
        
        // Add authentication if available
        if let apiKey = authToken, !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }
        
        // Prepare request body
        var body: [String: Any] = [
            "text": text,
            "voice": voice ?? "default",
            "format": "wav" // Default to WAV format
        ]
        
        // Add synthesis settings if provided
        if let settings = settings {
            body["speed"] = settings.speed
            body["pitch"] = settings.pitch
            body["volume"] = settings.volume
            body["emotion"] = settings.emotion
            body["format"] = settings.format
            body["sampleRate"] = settings.sampleRate
        }
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            logger.debug("📤 Synthesis request prepared: \(body)")
        } catch {
            logger.error("❌ Failed to serialize synthesis request body: \(error)")
            throw APIError.networkError(error)
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            logger.error("❌ Invalid HTTP response type for synthesis")
            throw APIError.invalidResponse
        }
        
        logger.debug("📥 Synthesis response status: \(httpResponse.statusCode)")
        
        guard httpResponse.statusCode == 200 else {
            let errorData = String(data: data, encoding: .utf8) ?? "No error data"
            logger.error("❌ Synthesis API error (\(httpResponse.statusCode)): \(errorData)")
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
        
        do {
            let synthesisResponse = try JSONDecoder().decode(SynthesisResponse.self, from: data)
            logger.info("✅ Speech synthesis completed (duration: \(synthesisResponse.data.duration)s)")
            return synthesisResponse
        } catch {
            let responseString = String(data: data, encoding: .utf8) ?? "Unable to decode response"
            logger.error("❌ Failed to decode synthesis response: \(error)")
            logger.error("❌ Raw response: \(responseString)")
            throw APIError.decodingError(error)
        }
    }
    
    // MARK: - Audio Playback Helper
    
    /// Play synthesized audio from the synthesis response
    func playSynthesizedAudio(from response: SynthesisResponse) async throws {
        logger.debug("🎵 Playing synthesized audio")
        
        // If audio data is provided directly (base64)
        if let audioBase64 = response.data.audioData {
            guard let audioData = Data(base64Encoded: audioBase64) else {
                logger.error("❌ Failed to decode base64 audio data")
                throw APIError.decodingError(NSError(domain: "AudioDecoding", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid base64 audio data"]))
            }
            
            try await playAudioData(audioData)
            return
        }
        
        // If audio URL is provided, download and play
        if let audioURLString = response.data.audioUrl,
           let audioURL = URL(string: audioURLString) {
            
            logger.debug("📥 Downloading audio from URL: \(audioURLString)")
            
            do {
                let (audioData, _) = try await session.data(from: audioURL)
                try await playAudioData(audioData)
            } catch {
                logger.error("❌ Failed to download audio from URL: \(error)")
                throw APIError.networkError(error)
            }
            return
        }
        
        logger.error("❌ No audio data or URL provided in synthesis response")
        throw APIError.invalidResponse
    }
    
    /// Play audio data using AVAudioPlayer
    private func playAudioData(_ audioData: Data) async throws {
        logger.debug("🎵 Playing audio data (size: \(audioData.count) bytes)")
        
        // This would integrate with AVAudioPlayer or the TTS service
        // For now, we'll delegate to the TTS service if available
        // In a real implementation, you might use AVAudioPlayer directly here
        
        logger.info("✅ Audio playback initiated")
    }
    
    // MARK: - WebSocket Voice Events
    
    /// Handle voice-specific WebSocket events
    private func handleVoiceWebSocketMessage(_ message: WebSocketMessage) {
        logger.debug("🌐 Handling voice WebSocket message: \(message.type)")
        
        switch message.type {
        case "voice_transcription_update":
            NotificationCenter.default.post(
                name: .voiceTranscriptionUpdate,
                object: nil,
                userInfo: ["data": message.data]
            )
        case "voice_synthesis_complete":
            NotificationCenter.default.post(
                name: .voiceSynthesisComplete,
                object: nil,
                userInfo: ["data": message.data]
            )
        case "voice_interaction_started":
            NotificationCenter.default.post(
                name: .voiceInteractionStarted,
                object: nil,
                userInfo: ["data": message.data]
            )
        case "voice_interaction_ended":
            NotificationCenter.default.post(
                name: .voiceInteractionEnded,
                object: nil,
                userInfo: ["data": message.data]
            )
        default:
            logger.debug("🔄 Unhandled voice WebSocket message type: \(message.type)")
        }
    }
    
    // MARK: - Voice Service Health Check
    
    /// Check if voice services are available on the backend
    func checkVoiceServicesHealth() async throws -> VoiceServicesHealth {
        logger.debug("🩺 Checking voice services health")
        
        let endpoint = "\(baseURL)/api/v1/voice/health"
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
        
        let healthResponse = try JSONDecoder().decode(VoiceServicesHealth.self, from: data)
        logger.info("✅ Voice services health check completed")
        return healthResponse
    }
    
    // MARK: - Error Handling & Retry Logic
    
    /// Retry voice operations with exponential backoff
    private func retryVoiceOperation<T>(
        operation: () async throws -> T,
        maxRetries: Int = 3,
        baseDelay: TimeInterval = 1.0
    ) async throws -> T {
        var lastError: Error?
        
        for attempt in 0..<maxRetries {
            do {
                return try await operation()
            } catch {
                lastError = error
                
                // Don't retry authentication errors or client errors (4xx)
                if let apiError = error as? APIError,
                   case .httpError(let statusCode) = apiError,
                   statusCode >= 400 && statusCode < 500 {
                    throw error
                }
                
                if attempt < maxRetries - 1 {
                    let delay = baseDelay * pow(2.0, Double(attempt))
                    logger.warning("⏳ Voice operation failed (attempt \(attempt + 1)/\(maxRetries)), retrying in \(delay)s: \(error)")
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        logger.error("❌ Voice operation failed after \(maxRetries) attempts")
        throw lastError ?? APIError.requestFailed("Maximum retries exceeded")
    }
    
    /// Record error for analytics and recovery
    private func recordError(_ error: Error, for operation: String) async {
        let context = RetryContext(
            operation: operation,
            lastError: error,
            attemptCount: (retryContext[operation]?.attemptCount ?? 0) + 1,
            lastAttempt: Date()
        )
        
        retryContext[operation] = context
        
        await MainActor.run {
            if let apiError = error as? APIError {
                self.lastError = apiError
            } else {
                self.lastError = APIError.networkError(error)
            }
        }
        
        // Log error for monitoring
        logger.error("❌ \(operation) failed: \(error)")
    }
}

// MARK: - Voice Response Types

/// Voice settings for API communication
struct APIVoiceSettings: Codable {
    let voice: String
    let speed: Double
    let pitch: Double
    let emotion: String?
    
    init(voice: String = "default", speed: Double = 1.0, pitch: Double = 1.0, emotion: String? = nil) {
        self.voice = voice
        self.speed = speed
        self.pitch = pitch
        self.emotion = emotion
    }
}

/// Settings for speech synthesis
struct SynthesisSettings: Codable {
    let speed: Double
    let pitch: Double
    let volume: Double
    let emotion: String?
    let format: String
    let sampleRate: Int?
    
    init(speed: Double = 1.0, pitch: Double = 1.0, volume: Double = 1.0, emotion: String? = nil, format: String = "wav", sampleRate: Int? = nil) {
        self.speed = speed
        self.pitch = pitch
        self.volume = volume
        self.emotion = emotion
        self.format = format
        self.sampleRate = sampleRate
    }
}

/// Response from voice chat endpoint
struct VoiceResponse: Codable {
    let success: Bool
    let data: VoiceResponseData
    let metadata: VoiceResponseMetadata
    
    /// Direct access to audio data for convenience
    var audioData: String? {
        return data.audioData
    }
}

struct VoiceResponseData: Codable {
    let message: String
    let audioData: String? // Base64 encoded audio
    let audioUrl: String? // URL to download audio
    let duration: Double
    let voiceUsed: String
    let transcription: VoiceTranscription?
}

struct VoiceResponseMetadata: Codable {
    let requestId: String
    let timestamp: String
    let processingTime: Double
    let model: String?
}

/// Response from transcription endpoint
struct TranscriptionResponse: Codable {
    let success: Bool
    let data: TranscriptionData
    let metadata: TranscriptionMetadata
}

struct TranscriptionData: Codable {
    let text: String
    let language: String
    let confidence: Double
    let segments: [TranscriptionSegment]?
    let words: [TranscriptionWord]?
}

struct TranscriptionSegment: Codable {
    let start: Double
    let end: Double
    let text: String
    let confidence: Double
}

struct TranscriptionWord: Codable {
    let start: Double
    let end: Double
    let word: String
    let confidence: Double
}

struct TranscriptionMetadata: Codable {
    let requestId: String
    let timestamp: String
    let processingTime: Double
    let model: String
    let audioLength: Double
}

/// Enhanced voice transcription details
struct VoiceTranscription: Codable {
    let text: String
    let confidence: Double
    let language: String?
    let processingTime: Double?
}

/// Response from synthesis endpoint
struct SynthesisResponse: Codable {
    let success: Bool
    let data: SynthesisData
    let metadata: SynthesisMetadata
}

struct SynthesisData: Codable {
    let audioData: String? // Base64 encoded audio
    let audioUrl: String? // URL to download audio
    let duration: Double
    let format: String
    let sampleRate: Int
    let voiceUsed: String
}

struct SynthesisMetadata: Codable {
    let requestId: String
    let timestamp: String
    let processingTime: Double
    let charactersProcessed: Int
}

/// Voice services health status
struct VoiceServicesHealth: Codable {
    let success: Bool
    let services: VoiceServicesStatus
    let capabilities: VoiceCapabilities
    let metadata: HealthMetadata
}

struct VoiceServicesStatus: Codable {
    let transcription: ServiceHealth
    let synthesis: ServiceHealth
    let voiceChat: ServiceHealth
}

struct ServiceHealth: Codable {
    let available: Bool
    let status: String
    let latency: Double?
    let errorRate: Double?
}

struct VoiceCapabilities: Codable {
    let supportedLanguages: [String]
    let supportedVoices: [String]
    let supportedFormats: [String]
    let maxAudioLength: Double
    let maxTextLength: Int
}

struct HealthMetadata: Codable {
    let timestamp: String
    let version: String
    let uptime: Double
}

// MARK: - RAG Result Types
struct RAGSearchResult {
    let sources: [RAGSource]
    let graphPaths: Int
    let requestId: String
}

struct RAGIndexResult {
    let entities: Int
    let relationships: Int
    let hyperedges: Int
    let requestId: String
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

    // MARK: - Enhanced Error Handling & Retry Logic
    
    /// Execute a request with automatic retry and error recovery
    private func executeWithRetry<T>(
        _ operationName: String,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        var lastError: Error?
        
        for attempt in 0..<maxRetryAttempts {
            do {
                let result = try await operation()
                
                // Success - clear any previous retry context
                retryContext.removeValue(forKey: operationName)
                
                return result
            } catch {
                lastError = error
                
                // Check if error is retryable
                guard isRetryableError(error) else {
                    await recordError(error, for: operationName)
                    throw error
                }
                
                // Handle specific errors
                if let apiError = error as? APIError {
                    switch apiError {
                    case .authenticationRequired:
                        // Attempt token refresh before retrying
                        await refreshTokenIfNeeded()
                        
                    case .rateLimited(let retryAfter):
                        // Respect rate limit delay
                        let delay = retryAfter ?? calculateBackoffDelay(attempt: attempt)
                        logger.info("⏳ Rate limited, waiting \(delay)s before retry")
                        try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                        
                    default:
                        break
                    }
                }
                
                // Wait before retrying (except for last attempt)
                if attempt < maxRetryAttempts - 1 {
                    let delay = calculateBackoffDelay(attempt: attempt)
                    logger.warning("⚠️ \(operationName) failed (attempt \(attempt + 1)/\(maxRetryAttempts)), retrying in \(delay)s: \(error)")
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        // All retries failed
        let finalError = lastError ?? APIError.requestFailed("Unknown error")
        await recordError(finalError, for: operationName)
        throw finalError
    }
    
    /// Determine if an error is retryable
    private func isRetryableError(_ error: Error) -> Bool {
        if let apiError = error as? APIError {
            switch apiError {
            case .networkError, .serverError, .rateLimited, .authenticationRequired:
                return true
            case .invalidURL, .invalidResponse, .decodingError, .clientError, .authenticationFailed:
                return false
            case .httpError(let statusCode):
                // Retry on server errors (5xx) and some client errors
                return statusCode >= 500 || statusCode == 408 || statusCode == 429
            case .requestFailed:
                return true
            }
        }
        
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut, .networkConnectionLost, .notConnectedToInternet, .cannotConnectToHost:
                return true
            default:
                return false
            }
        }
        
        return false
    }
    
    /// Calculate exponential backoff delay
    private func calculateBackoffDelay(attempt: Int) -> TimeInterval {
        let baseDelay = 1.0
        let maxDelay = 60.0
        let exponentialDelay = min(baseDelay * pow(2.0, Double(attempt)), maxDelay)
        let jitter = Double.random(in: 0...1) * exponentialDelay * 0.1
        return exponentialDelay + jitter
    }

// MARK: - Agent Orchestration Response Types

/// Agent orchestration status response
struct AgentOrchestrationStatus: Codable {
    let success: Bool
    let data: AgentOrchestrationData
    let message: String
}

struct AgentOrchestrationData: Codable {
    let agents: [APIAgentStatus]
    let meshStatus: MeshStatus
    let summary: AgentSummary
}

struct APIAgentStatus: Codable {
    let name: String
    let category: String
    let description: String
    let priority: Double
    let capabilities: [String]
    let isLoaded: Bool
    let status: String
    let lastSeen: String?
    let trustLevel: Double
    let collaborationScore: Double
    let queueLength: Int
    let metrics: AgentMetrics?
    let dependencies: [String]
    let maxLatencyMs: Int
    let retryAttempts: Int
}

struct MeshStatus: Codable {
    let activeConnections: Int
    let totalMessages: Int
    let activeCollaborations: Int
    let meshHealth: Double
}

struct AgentSummary: Codable {
    let totalAgents: Int
    let loadedAgents: Int
    let onlineAgents: Int
    let busyAgents: Int
    let offlineAgents: Int
    let totalCollaborations: Int
    let meshHealth: Double
}

struct AgentMetrics: Codable {
    let agentName: String
    let totalRequests: Int
    let averageResponseTime: Double
    let successRate: Double
    let errorCount: Int
    let lastActive: String
    let cpuUsage: Double
    let memoryUsage: Double
    let queueLength: Int
    let collaborationCount: Int
}

/// Network topology response
struct NetworkTopology: Codable {
    let nodes: [NetworkNode]
    let edges: [NetworkEdge]
}

struct NetworkNode: Codable, Identifiable {
    let id: String
    let name: String
    let category: String
    let status: String
    let capabilities: [String]
    let trustLevel: Double
    let collaborationScore: Double
    let position: NodePosition?
}

struct NodePosition: Codable {
    let x: Double
    let y: Double
}

struct NetworkEdge: Codable, Identifiable {
    let id: String
    let source: String
    let target: String
    let type: String
    let weight: Double
    let lastActive: String
    
    enum CodingKeys: String, CodingKey {
        case source, target, type, weight, lastActive
    }
    
    // Custom decoder to generate ID from source and target
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        source = try container.decode(String.self, forKey: .source)
        target = try container.decode(String.self, forKey: .target)
        type = try container.decode(String.self, forKey: .type)
        weight = try container.decode(Double.self, forKey: .weight)
        lastActive = try container.decode(String.self, forKey: .lastActive)
        id = "\(source)-\(target)-\(type)"
    }
}

/// Agent metrics response
struct AgentMetricsResponse: Codable {
    let success: Bool
    let data: AgentMetricsData
    let message: String
}

struct AgentMetricsData: Codable {
    let metrics: [AgentMetrics]
    let aggregates: AgentAggregates
    let timeRange: String
    let timestamp: String
}

struct AgentAggregates: Codable {
    let totalRequests: Int
    let averageResponseTime: Double
    let averageSuccessRate: Double
    let totalErrors: Int
    let averageCpuUsage: Double
    let averageMemoryUsage: Double
    let totalActiveAgents: Int
}

/// Agent task response
struct AgentTaskResponse: Codable {
    let success: Bool
    let data: AgentTaskData
    let message: String
}

struct AgentTaskData: Codable {
    let taskId: String
    let task: AgentTask
}

struct AgentTask: Codable, Identifiable {
    let id: String
    let agentName: String
    let type: String
    let status: String
    let priority: Int
    let startTime: String?
    let endTime: String?
    let estimatedDuration: Double?
    let context: [String: AnyHashable]
    let result: [String: AnyHashable]?
    let error: String?
    
    private enum CodingKeys: String, CodingKey {
        case id, agentName, type, status, priority, startTime, endTime, estimatedDuration, context, result, error
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        agentName = try container.decode(String.self, forKey: .agentName)
        type = try container.decode(String.self, forKey: .type)
        status = try container.decode(String.self, forKey: .status)
        priority = try container.decode(Int.self, forKey: .priority)
        startTime = try container.decodeIfPresent(String.self, forKey: .startTime)
        endTime = try container.decodeIfPresent(String.self, forKey: .endTime)
        estimatedDuration = try container.decodeIfPresent(Double.self, forKey: .estimatedDuration)
        
        // Handle dynamic context and result as AnyHashable
        if let contextData = try? container.decode(Data.self, forKey: .context) {
            context = (try? JSONSerialization.jsonObject(with: contextData) as? [String: AnyHashable]) ?? [:]
        } else {
            context = [:]
        }
        
        if let resultData = try? container.decodeIfPresent(Data.self, forKey: .result) {
            result = (try? JSONSerialization.jsonObject(with: resultData) as? [String: AnyHashable])
        } else {
            result = nil
        }
        
        error = try container.decodeIfPresent(String.self, forKey: .error)
    }
}

/// Agent tasks response
struct AgentTasksResponse: Codable {
    let success: Bool
    let data: AgentTasksData
    let message: String
}

struct AgentTasksData: Codable {
    let tasks: [AgentTask]
    let summary: TaskSummary
}

struct TaskSummary: Codable {
    let total: Int
    let pending: Int
    let running: Int
    let completed: Int
    let failed: Int
}

/// Collaboration response
struct CollaborationResponse: Codable {
    let success: Bool
    let data: CollaborationData
    let message: String
}

struct CollaborationData: Codable {
    let sessionId: String
}

/// Communications response
struct CommunicationsResponse: Codable {
    let success: Bool
    let data: CommunicationsData
    let message: String
}

struct CommunicationsData: Codable {
    let communications: [Communication]
    let meshStatus: MeshStatus
    let summary: CommunicationSummary
}

struct Communication: Codable, Identifiable {
    let id: String
    let participants: [String]
    let task: String
    let status: String
    let startTime: String
    let messageCount: Int
    let type: String
}

struct CommunicationSummary: Codable {
    let totalCommunications: Int
    let activeSessions: Int
    let completedSessions: Int
    let failedSessions: Int
}

/// Resource usage response
struct ResourceUsageResponse: Codable {
    let success: Bool
    let data: ResourceUsageData
    let message: String
}

struct ResourceUsageData: Codable {
    let resources: [AgentResource]
    let systemResources: SystemResources
    let timestamp: String
}

struct AgentResource: Codable {
    let agentName: String
    let status: String
    let cpuUsage: Double
    let memoryUsage: Double
    let queueLength: Int
    let lastActive: String
    let collaborationScore: Double
    let trustLevel: Double
}

struct SystemResources: Codable {
    let totalAgents: Int
    let totalCpuUsage: Double
    let totalMemoryUsage: Double
    let averageCpuUsage: Double
    let averageMemoryUsage: Double
    let totalQueueLength: Int
    let meshHealth: Double
}

/// Orchestration response
struct OrchestrationResponse: Codable {
    let success: Bool
    let data: OrchestrationData
    let message: String
}

struct OrchestrationData: Codable {
    let result: OrchestrationResult
    let executionTime: Double
    let participatingAgents: [String]
}

struct OrchestrationResult: Codable {
    let primary: AgentResult?
    let supporting: [AgentResult]
}

struct AgentResult: Codable {
    let agentName: String
    let result: [String: AnyHashable]?
    let error: String?
    let executionTime: Double
    
    private enum CodingKeys: String, CodingKey {
        case agentName, result, error, executionTime
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        agentName = try container.decode(String.self, forKey: .agentName)
        error = try container.decodeIfPresent(String.self, forKey: .error)
        executionTime = try container.decode(Double.self, forKey: .executionTime)
        
        // Handle dynamic result as AnyHashable
        if let resultData = try? container.decodeIfPresent(Data.self, forKey: .result) {
            result = (try? JSONSerialization.jsonObject(with: resultData) as? [String: AnyHashable])
        } else {
            result = nil
        }
    }
}

// MARK: - Supporting Types

/// Context for tracking retry attempts
struct RetryContext {
    let operation: String
    let lastError: Error
    let attemptCount: Int
    let lastAttempt: Date
}

/// Error recovery manager
class ErrorRecoveryManager {
    func shouldRetry(_ error: Error, attempt: Int) -> Bool {
        // Implement sophisticated retry logic based on error patterns
        return attempt < 3
    }
    
    func suggestRecoveryAction(for error: Error) -> String? {
        if error is URLError {
            return "Check your internet connection"
        }
        if let apiError = error as? APIError {
            switch apiError {
            case .authenticationRequired:
                return "Please sign in again"
            case .rateLimited:
                return "Too many requests, please wait"
            default:
                return nil
            }
        }
        return nil
    }
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    case clientError(Int, String)
    case serverError(Int, String)
    case decodingError(Error)
    case networkError(Error)
    case requestFailed(String)
    case authenticationRequired
    case authenticationFailed(Error)
    case rateLimited(retryAfter: TimeInterval?)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode):
            return "HTTP error: \(statusCode)"
        case .clientError(let statusCode, let message):
            return "Client error (\(statusCode)): \(message)"
        case .serverError(let statusCode, let message):
            return "Server error (\(statusCode)): \(message)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .requestFailed(let message):
            return "Request failed: \(message)"
        case .authenticationRequired:
            return "Authentication required"
        case .authenticationFailed(let error):
            return "Authentication failed: \(error.localizedDescription)"
        case .rateLimited(let retryAfter):
            if let delay = retryAfter {
                return "Rate limited. Try again in \(Int(delay)) seconds"
            } else {
                return "Rate limited. Please try again later"
            }
        }
    }
    
    var isRecoverable: Bool {
        switch self {
        case .networkError, .serverError, .rateLimited, .authenticationRequired:
            return true
        case .invalidURL, .decodingError, .clientError, .authenticationFailed:
            return false
        case .httpError(let statusCode):
            return statusCode >= 500
        case .invalidResponse, .requestFailed:
            return true
        }
    }
}

// MARK: - Notification Names
// All Notification.Name constants are defined in Utils/Notifications.swift
