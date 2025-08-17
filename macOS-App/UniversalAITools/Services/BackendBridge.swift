import Foundation
import Combine
import Network

// MARK: - Backend Bridge Service
/// Comprehensive service layer that bridges Swift frontend with Node.js/TypeScript backend
/// Handles all backend communication with proper error handling, retry logic, and caching
@MainActor
public final class BackendBridge: ObservableObject {
    static let shared = BackendBridge()
    
    // MARK: - Published Properties
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastError: BackendError?
    @Published var activeRequests: Set<UUID> = []
    
    // MARK: - Configuration
    private let baseURL: URL
    private let wsURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    
    // MARK: - Services
    private var webSocketManager: WebSocketManager?
    private var authManager: AuthenticationManager?
    private var cacheManager: CacheManager
    private var retryManager: RetryManager
    private var metricsCollector: MetricsCollector
    
    // MARK: - Combine
    private var cancellables = Set<AnyCancellable>()
    private let requestSubject = PassthroughSubject<APIRequest, Never>()
    private let responseSubject = PassthroughSubject<APIResponse, Never>()
    
    // MARK: - Initialization
    private init() {
        // Configure URLs
        let config = BackendConfiguration.current
        self.baseURL = URL(string: config.apiBaseURL)!
        self.wsURL = URL(string: config.wsBaseURL)!
        
        // Configure URLSession
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        configuration.waitsForConnectivity = true
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        
        self.session = URLSession(configuration: configuration)
        
        // Initialize services
        self.cacheManager = CacheManager()
        self.retryManager = RetryManager()
        self.metricsCollector = MetricsCollector()
        
        // Setup decoders
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
        
        setupBindings()
        setupNetworkMonitoring()
    }
    
    // MARK: - Setup
    private func setupBindings() {
        // Process API requests
        requestSubject
            .sink { [weak self] request in
                Task {
                    await self?.processRequest(request)
                }
            }
            .store(in: &cancellables)
        
        // Handle responses
        responseSubject
            .sink { [weak self] response in
                self?.handleResponse(response)
            }
            .store(in: &cancellables)
    }
    
    private func setupNetworkMonitoring() {
        let monitor = NWPathMonitor()
        let queue = DispatchQueue(label: "NetworkMonitor")
        
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.updateConnectionStatus(for: path)
            }
        }
        
        monitor.start(queue: queue)
    }
    
    // MARK: - Public API
    
    /// Connect to backend services
    public func connect() async {
        connectionStatus = .connecting
        
        // Initialize WebSocket
        webSocketManager = WebSocketManager(url: wsURL)
        await webSocketManager?.connect()
        
        // Initialize authentication
        authManager = AuthenticationManager()
        await authManager?.initialize()
        
        // Update status
        connectionStatus = .connected
        
        // Start sync
        await startSync()
    }
    
    /// Disconnect from backend services
    public func disconnect() async {
        connectionStatus = .disconnecting
        
        // Close WebSocket
        await webSocketManager?.disconnect()
        
        // Clear auth
        await authManager?.logout()
        
        // Update status
        connectionStatus = .disconnected
    }
    
    /// Execute API request with automatic retry and caching
    public func request<T: Codable>(_ endpoint: APIEndpoint, 
                                    parameters: [String: Any]? = nil,
                                    cachePolicy: CachePolicy = .networkFirst) async throws -> T {
        let requestId = UUID()
        activeRequests.insert(requestId)
        defer { activeRequests.remove(requestId) }
        
        // Check cache first if policy allows
        if let cached: T = cacheManager.get(for: endpoint.cacheKey, policy: cachePolicy) {
            metricsCollector.recordCacheHit(endpoint: endpoint.path)
            return cached
        }
        
        // Build request
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add authentication
        if let token = await authManager?.currentToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add body if needed
        if let parameters = parameters, endpoint.method != .get {
            request.httpBody = try JSONSerialization.data(withJSONObject: parameters)
        }
        
        // Execute with retry
        let response = try await retryManager.execute {
            try await self.performRequest(request)
        }
        
        // Decode response
        let decoded: T = try decoder.decode(T.self, from: response)
        
        // Cache if successful
        cacheManager.set(decoded, for: endpoint.cacheKey)
        
        // Record metrics
        metricsCollector.recordRequest(endpoint: endpoint.path, success: true)
        
        return decoded
    }
    
    /// Send real-time message via WebSocket
    public func sendRealtimeMessage(_ message: RealtimeMessage) async {
        await webSocketManager?.send(message)
    }
    
    /// Subscribe to real-time updates
    public func subscribeToUpdates<T: Codable>(_ type: T.Type, 
                                               handler: @escaping (T) -> Void) -> AnyCancellable {
        webSocketManager?.messagePublisher
            .compactMap { message in
                try? self.decoder.decode(T.self, from: message)
            }
            .sink(receiveValue: handler)
            .store(in: &cancellables)
        
        return AnyCancellable { }
    }
    
    // MARK: - Agent Integration
    
    /// Execute agent task
    public func executeAgentTask(_ task: AgentTask) async throws -> AgentResponse {
        let endpoint = APIEndpoint.agents(.execute)
        let parameters = try encoder.encode(task)
        let jsonObject = try JSONSerialization.jsonObject(with: parameters) as? [String: Any]
        
        return try await request(endpoint, parameters: jsonObject)
    }
    
    /// Stream agent responses
    public func streamAgentResponse(_ agentId: String) -> AsyncStream<AgentStreamEvent> {
        AsyncStream { continuation in
            Task {
                await webSocketManager?.subscribeToAgent(agentId) { event in
                    continuation.yield(event)
                }
            }
        }
    }
    
    // MARK: - GraphRAG Integration
    
    /// Query knowledge graph
    public func queryKnowledgeGraph(_ query: GraphQuery) async throws -> GraphResponse {
        let endpoint = APIEndpoint.graphrag(.query)
        let parameters = try encoder.encode(query)
        let jsonObject = try JSONSerialization.jsonObject(with: parameters) as? [String: Any]
        
        return try await request(endpoint, parameters: jsonObject)
    }
    
    /// Update graph node
    public func updateGraphNode(_ node: GraphNode) async throws {
        let endpoint = APIEndpoint.graphrag(.updateNode)
        let parameters = try encoder.encode(node)
        let jsonObject = try JSONSerialization.jsonObject(with: parameters) as? [String: Any]
        
        let _: EmptyResponse = try await request(endpoint, parameters: jsonObject)
    }
    
    // MARK: - Supabase Integration
    
    /// Sync with Supabase
    public func syncWithSupabase() async throws {
        syncStatus = .syncing
        
        do {
            // Fetch latest data
            let endpoint = APIEndpoint.supabase(.sync)
            let syncData: SupabaseSyncData = try await request(endpoint)
            
            // Process sync data
            await processSyncData(syncData)
            
            syncStatus = .synced
        } catch {
            syncStatus = .error(error)
            throw error
        }
    }
    
    /// Subscribe to Supabase realtime
    public func subscribeToSupabaseRealtime(table: String, 
                                           filter: String? = nil) -> AnyCancellable {
        let subscription = RealtimeSubscription(table: table, filter: filter)
        sendRealtimeMessage(.subscribe(subscription))
        
        return webSocketManager?.messagePublisher
            .compactMap { message in
                try? self.decoder.decode(SupabaseRealtimeEvent.self, from: message)
            }
            .filter { $0.table == table }
            .sink { event in
                self.handleSupabaseEvent(event)
            }
            .store(in: &cancellables)
        
        return AnyCancellable { }
    }
    
    // MARK: - Voice Integration
    
    /// Send voice for transcription
    public func transcribeVoice(_ audioData: Data) async throws -> TranscriptionResult {
        let endpoint = APIEndpoint.voice(.transcribe)
        
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = "POST"
        request.setValue("audio/wav", forHTTPHeaderField: "Content-Type")
        request.httpBody = audioData
        
        if let token = await authManager?.currentToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let response = try await performRequest(request)
        return try decoder.decode(TranscriptionResult.self, from: response)
    }
    
    /// Generate speech from text
    public func generateSpeech(_ text: String, voice: String = "default") async throws -> Data {
        let endpoint = APIEndpoint.voice(.synthesize)
        let parameters = ["text": text, "voice": voice]
        
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: parameters)
        
        if let token = await authManager?.currentToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        return try await performRequest(request)
    }
    
    // MARK: - Monitoring & Telemetry
    
    /// Send telemetry data
    public func sendTelemetry(_ event: TelemetryEvent) {
        Task {
            let endpoint = APIEndpoint.monitoring(.telemetry)
            let parameters = try encoder.encode(event)
            let jsonObject = try JSONSerialization.jsonObject(with: parameters) as? [String: Any]
            
            // Fire and forget - don't wait for response
            try? await request(endpoint, parameters: jsonObject, cachePolicy: .skipCache)
        }
    }
    
    /// Get system health
    public func getSystemHealth() async throws -> SystemHealth {
        let endpoint = APIEndpoint.monitoring(.health)
        return try await request(endpoint, cachePolicy: .networkOnly)
    }
    
    // MARK: - Private Methods
    
    private func performRequest(_ request: URLRequest) async throws -> Data {
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw BackendError.invalidResponse
            }
            
            switch httpResponse.statusCode {
            case 200...299:
                return data
            case 401:
                // Token expired, refresh and retry
                await authManager?.refreshToken()
                throw BackendError.unauthorized
            case 429:
                throw BackendError.rateLimited
            case 500...599:
                throw BackendError.serverError(httpResponse.statusCode)
            default:
                throw BackendError.httpError(httpResponse.statusCode)
            }
        } catch {
            metricsCollector.recordError(error)
            throw error
        }
    }
    
    private func processRequest(_ request: APIRequest) async {
        // Log request
        logger.debug("Processing request: \(request.endpoint) [\(request.method)]")
        
        // Update metrics
        metricsCollector.recordRequest(endpoint: request.endpoint, success: false)
        
        // Add to active requests
        activeRequests.insert(request.id)
        
        // Queue request if offline
        if connectionStatus != .connected {
            offlineStore.queueRequest(request)
            return
        }
        
        // Process based on priority
        if request.priority == .high {
            requestSubject.send(request)
        } else {
            // Add to queue for batch processing
            Task {
                await messageQueue.enqueue(request)
            }
        }
    }
    
    private func handleResponse(_ response: APIResponse) {
        // Log response
        logger.debug("Handling response: \(response.statusCode) for \(response.requestId)")
        
        // Update metrics
        metricsCollector.recordResponse(requestId: response.requestId, statusCode: response.statusCode)
        
        // Remove from active requests
        activeRequests.remove(response.requestId)
        
        // Cache response if cacheable
        if response.isCacheable {
            cacheManager.cache(response)
        }
        
        // Notify subscribers
        responseSubject.send(response)
        
        // Handle special responses
        switch response.statusCode {
        case 401:
            Task { await authManager?.refreshToken() }
        case 429:
            // Rate limited - implement backoff
            Task { await handleRateLimiting(response) }
        case 500...599:
            // Server error - queue for retry
            Task { await retryManager.scheduleRetry(response.originalRequest) }
        default:
            break
        }
    }
    
    private func updateConnectionStatus(for path: NWPath) {
        switch path.status {
        case .satisfied:
            if connectionStatus == .disconnected {
                Task {
                    await connect()
                }
            }
        case .unsatisfied, .requiresConnection:
            connectionStatus = .disconnected
        @unknown default:
            break
        }
    }
    
    private func startSync() async {
        // Start periodic sync
        Timer.publish(every: 30, on: .main, in: .common)
            .autoconnect()
            .sink { _ in
                Task {
                    try? await self.syncWithSupabase()
                }
            }
            .store(in: &cancellables)
    }
    
    private func processSyncData(_ data: SupabaseSyncData) async {
        logger.info("Processing sync data: \(data.tables.count) tables, \(data.records.count) records")
        
        // Update local cache
        for record in data.records {
            cacheManager.updateRecord(record)
        }
        
        // Process changes
        for change in data.changes {
            switch change.type {
            case .insert:
                await handleInsert(change.record)
            case .update:
                await handleUpdate(change.record)
            case .delete:
                await handleDelete(change.recordId)
            }
        }
        
        // Update sync status
        syncStatus = .synced
        lastSyncDate = Date()
        
        // Notify observers
        await MainActor.run {
            NotificationCenter.default.post(
                name: .dataDidSync,
                object: self,
                userInfo: ["data": data]
            )
        }
    }
    
    private func handleSupabaseEvent(_ event: SupabaseRealtimeEvent) {
        logger.debug("Handling Supabase event: \(event.type) on \(event.table)")
        
        switch event.type {
        case .insert:
            // Handle new record
            if let record = event.record {
                cacheManager.addRecord(record)
                NotificationCenter.default.post(
                    name: .recordInserted,
                    object: self,
                    userInfo: ["record": record, "table": event.table]
                )
            }
            
        case .update:
            // Handle updated record
            if let record = event.record {
                cacheManager.updateRecord(record)
                NotificationCenter.default.post(
                    name: .recordUpdated,
                    object: self,
                    userInfo: ["record": record, "table": event.table]
                )
            }
            
        case .delete:
            // Handle deleted record
            if let recordId = event.recordId {
                cacheManager.removeRecord(recordId)
                NotificationCenter.default.post(
                    name: .recordDeleted,
                    object: self,
                    userInfo: ["recordId": recordId, "table": event.table]
                )
            }
            
        case .truncate:
            // Handle table truncation
            cacheManager.clearTable(event.table)
            NotificationCenter.default.post(
                name: .tableCleared,
                object: self,
                userInfo: ["table": event.table]
            )
        }
    }
}

// MARK: - Supporting Types

public enum ConnectionStatus {
    case connected
    case connecting
    case disconnected
    case disconnecting
    case error(Error)
}

public enum SyncStatus {
    case idle
    case syncing
    case synced
    case error(Error)
}

public enum BackendError: LocalizedError {
    case invalidResponse
    case unauthorized
    case rateLimited
    case serverError(Int)
    case httpError(Int)
    case networkError(Error)
    
    public var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Authentication required"
        case .rateLimited:
            return "Too many requests. Please try again later"
        case .serverError(let code):
            return "Server error: \(code)"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

public struct BackendConfiguration {
    let apiBaseURL: String
    let wsBaseURL: String
    let supabaseURL: String
    let supabaseAnonKey: String
    
    static let current = BackendConfiguration(
        apiBaseURL: ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:9999/api/v1",
        wsBaseURL: ProcessInfo.processInfo.environment["WS_BASE_URL"] ?? "ws://localhost:9999/ws",
        supabaseURL: ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? "http://localhost:54321",
        supabaseAnonKey: ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? ""
    )
}