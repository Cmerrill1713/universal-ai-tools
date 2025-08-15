import Foundation
import Combine
import SwiftUI
import os.log

// MARK: - Real-Time Data Service
@MainActor
class RealTimeDataService: ObservableObject, WebSocketDelegate {
    static let shared = RealTimeDataService()
    
    // MARK: - Published Properties
    @Published var isConnected: Bool = false
    @Published var connectionStatus: WSConnectionStatus = .disconnected
    @Published var lastUpdate: Date = Date()
    
    // Unified data streams
    @Published var graphData: GraphContextData?
    @Published var agentData: AgentContextData?
    @Published var analyticsData: AnalyticsContextData?
    @Published var ragData: RAGContextData?
    @Published var contextData: UnifiedContext?
    
    // Connection diagnostics
    @Published var diagnostics: ConnectionDiagnostics = ConnectionDiagnostics()
    @Published var dataStreamMetrics: [String: StreamMetrics] = [:]
    
    // MARK: - Private Properties
    private let connectionManager = WebSocketConnectionManager.shared
    private let dataCache = DataCache(maxSize: 500, defaultTTL: 300)
    
    // Session ID for tracking
    var currentSessionId: String = UUID().uuidString
    private let messageQueue = MessageQueue()
    private var dataProcessingQueue = DispatchQueue(label: "RealTimeDataProcessing", qos: .userInitiated)
    private var reconnectionTimer: Timer?
    private let logger = Logger(subsystem: "UniversalAITools", category: "RealTimeDataService")
    
    // MARK: - Delegates
    weak var dataSharingDelegate: DataSharingDelegate?
    
    // MARK: - Cancellables
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Session Management
    private var isInitialized: Bool = false
    
    // MARK: - Initialization
    private init() {
        setupConnectionObservers()
        setupDataProcessing()
    }
    
    deinit {
        disconnectAll()
        reconnectionTimer?.invalidate()
    }
    
    // MARK: - Public Interface
    func initialize() async {
        guard !isInitialized else { return }
        
        logger.info("Initializing RealTimeDataService")
        currentSessionId = UUID().uuidString
        
        await connectToAllEndpoints()
        setupReconnectionLogic()
        
        isInitialized = true
        logger.info("RealTimeDataService initialized with session: \(currentSessionId)")
    }
    
    func shutdown() {
        logger.info("Shutting down RealTimeDataService")
        
        disconnectAll()
        reconnectionTimer?.invalidate()
        messageQueue.clear()
        dataCache.clear()
        
        isInitialized = false
    }
    
    func refreshData() async {
        logger.info("Refreshing all data streams")
        
        await sendRefreshRequest(to: .graph)
        await sendRefreshRequest(to: .agents)
        await sendRefreshRequest(to: .analytics)
        await sendRefreshRequest(to: .context)
        await sendRefreshRequest(to: .flashAttention)
    }
    
    // MARK: - Connection Management
    private func connectToAllEndpoints() async {
        logger.info("Connecting to all endpoints")
        
        let endpoints: [WebSocketConnectionManager.Endpoint] = [.graph, .agents, .analytics, .context, .flashAttention]
        
        await withTaskGroup(of: Void.self) { group in
            for endpoint in endpoints {
                group.addTask {
                    let success = await self.connectionManager.connect(to: endpoint, delegate: self)
                    if success {
                        await self.initializeDataStream(for: endpoint)
                    }
                }
            }
        }
        
        updateConnectionStatus()
    }
    
    private func disconnectAll() {
        logger.info("Disconnecting all endpoints")
        connectionManager.disconnectAll()
        updateConnectionStatus()
    }
    
    private func initializeDataStream(for endpoint: WebSocketConnectionManager.Endpoint) async {
        let initMessage = WebSocketMessage(
            type: "initialize",
            data: try! JSONEncoder().encode(InitializationData(sessionId: currentSessionId)),
            sessionId: currentSessionId
        )
        
        do {
            try await connectionManager.sendMessage(initMessage, to: endpoint)
            logger.info("Initialized data stream for endpoint: \(endpoint.rawValue)")
        } catch {
            logger.error("Failed to initialize data stream for \(endpoint.rawValue): \(error.localizedDescription)")
        }
    }
    
    // MARK: - Message Sending
    func sendMessage(_ message: WebSocketMessage, to endpoint: WebSocketConnectionManager.Endpoint) async throws {
        try await connectionManager.sendMessage(message, to: endpoint)
        updateStreamMetrics(for: endpoint.rawValue, bytesSent: message.data.count)
    }
    
    private func sendRefreshRequest(to endpoint: WebSocketConnectionManager.Endpoint) async {
        let refreshMessage = WebSocketMessage(
            type: "refresh",
            data: Data(),
            sessionId: currentSessionId
        )
        
        do {
            try await sendMessage(refreshMessage, to: endpoint)
        } catch {
            logger.error("Failed to send refresh request to \(endpoint.rawValue): \(error.localizedDescription)")
        }
    }
    
    // MARK: - WebSocketDelegate Implementation
    nonisolated func webSocketDidReceiveMessage(_ message: WebSocketMessage, from endpoint: WebSocketConnectionManager.Endpoint) {
        Task { @MainActor in
            await self.handleReceivedMessage(message, from: endpoint)
        }
    }
    
    nonisolated func webSocketDidConnect(to endpoint: WebSocketConnectionManager.Endpoint) {
        Task { @MainActor in
            self.logger.info("Connected to endpoint: \(endpoint.rawValue)")
            self.updateConnectionStatus()
            self.updateStreamMetrics(for: endpoint.rawValue, connected: true)
        }
    }
    
    nonisolated func webSocketDidDisconnect(from endpoint: WebSocketConnectionManager.Endpoint, error: Error?) {
        Task { @MainActor in
            self.logger.warning("Disconnected from endpoint: \(endpoint.rawValue)")
            if let error = error {
                self.logger.error("Disconnection error: \(error.localizedDescription)")
            }
            self.updateConnectionStatus()
            self.updateStreamMetrics(for: endpoint.rawValue, connected: false)
        }
    }
    
    // MARK: - Message Processing
    private func handleReceivedMessage(_ message: WebSocketMessage, from endpoint: WebSocketConnectionManager.Endpoint) async {
        updateStreamMetrics(for: endpoint.rawValue, bytesReceived: message.data.count)
        
        // Queue message for processing
        messageQueue.enqueue(message, from: endpoint)
        
        // Process message based on type
        switch message.type {
        case "data_update":
            await processDataUpdate(message, from: endpoint)
        case "error":
            await processError(message, from: endpoint)
        case "ping":
            await processPing(message, from: endpoint)
        case "status":
            await processStatus(message, from: endpoint)
        default:
            logger.warning("Unknown message type: \(message.type) from \(endpoint.rawValue)")
        }
        
        lastUpdate = Date()
    }
    
    private func processDataUpdate(_ message: WebSocketMessage, from endpoint: WebSocketConnectionManager.Endpoint) async {
        do {
            switch endpoint {
            case .graph:
                let data = try JSONDecoder().decode(GraphContextData.self, from: message.data)
                graphData = data
                cacheData(data, key: "graph_\(currentSessionId)")
                logger.debug("Updated graph data: \(data.metadata.totalNodes) nodes, \(data.metadata.totalEdges) edges")
                
            case .agents:
                let data = try JSONDecoder().decode(AgentContextData.self, from: message.data)
                agentData = data
                cacheData(data, key: "agents_\(currentSessionId)")
                logger.debug("Updated agent data: \(data.agents.count) agents")
                
            case .analytics:
                let data = try JSONDecoder().decode(AnalyticsContextData.self, from: message.data)
                analyticsData = data
                cacheData(data, key: "analytics_\(currentSessionId)")
                logger.debug("Updated analytics data")
                
            case .context:
                let data = try JSONDecoder().decode(UnifiedContext.self, from: message.data)
                contextData = data
                cacheData(data, key: "context_\(currentSessionId)")
                logger.debug("Updated context data")
                
            case .flashAttention:
                let data = try JSONDecoder().decode(RAGContextData.self, from: message.data)
                ragData = data
                cacheData(data, key: "rag_\(currentSessionId)")
                logger.debug("Updated RAG data: \(data.contextSources.count) sources")
            }
            
            // Notify delegates of data update
            if let contextData = createUnifiedContext() {
                dataSharingDelegate?.dataDidUpdate(contextData)
            }
            
        } catch {
            logger.error("Failed to process data update from \(endpoint.rawValue): \(error.localizedDescription)")
            dataSharingDelegate?.dataUpdateFailed(error)
        }
    }
    
    private func processError(_ message: WebSocketMessage, from endpoint: WebSocketConnectionManager.Endpoint) async {
        do {
            let errorData = try JSONDecoder().decode(ErrorMessage.self, from: message.data)
            logger.error("Received error from \(endpoint.rawValue): \(errorData.message)")
            
            diagnostics.errors.append(ConnectionError(
                endpoint: endpoint.rawValue,
                message: errorData.message,
                timestamp: Date()
            ))
            
            // Limit error history
            if diagnostics.errors.count > 100 {
                diagnostics.errors = Array(diagnostics.errors.suffix(100))
            }
            
        } catch {
            logger.error("Failed to process error message from \(endpoint.rawValue): \(error.localizedDescription)")
        }
    }
    
    private func processPing(_ message: WebSocketMessage, from endpoint: WebSocketConnectionManager.Endpoint) async {
        // Respond with pong
        let pongMessage = WebSocketMessage(
            type: "pong",
            data: message.data,
            timestamp: Date(),
            sessionId: currentSessionId
        )
        
        do {
            try await sendMessage(pongMessage, to: endpoint)
        } catch {
            logger.error("Failed to send pong to \(endpoint.rawValue): \(error.localizedDescription)")
        }
    }
    
    private func processStatus(_ message: WebSocketMessage, from endpoint: WebSocketConnectionManager.Endpoint) async {
        do {
            let statusData = try JSONDecoder().decode(StatusMessage.self, from: message.data)
            logger.info("Status from \(endpoint.rawValue): \(statusData.status)")
            
            updateStreamMetrics(for: endpoint.rawValue, status: statusData.status)
            
        } catch {
            logger.error("Failed to process status message from \(endpoint.rawValue): \(error.localizedDescription)")
        }
    }
    
    // MARK: - Data Management
    private func createUnifiedContext() -> UnifiedContext? {
        let contextDataObj = ContextData(
            graphData: graphData,
            agentData: agentData,
            analyticsData: analyticsData,
            ragData: ragData
        )
        
        return UnifiedContext(
            sessionId: currentSessionId,
            data: contextDataObj
        )
    }
    
    private func cacheData<T: Codable>(_ data: T, key: String) {
        dataCache.store(data, key: key, ttl: 600) // 10 minutes TTL
    }
    
    func getCachedData<T: Codable>(_ type: T.Type, key: String) -> T? {
        return dataCache.retrieve(type, key: key)
    }
    
    // MARK: - Connection Status Management
    private func updateConnectionStatus() {
        let connectedEndpoints = connectionManager.activeConnections.count
        let totalEndpoints = WebSocketConnectionManager.Endpoint.allCases.count
        
        if connectedEndpoints == 0 {
            connectionStatus = .disconnected
            isConnected = false
        } else if connectedEndpoints == totalEndpoints {
            connectionStatus = .connected
            isConnected = true
        } else {
            connectionStatus = .degraded
            isConnected = true
        }
        
        diagnostics.lastStatusUpdate = Date()
        diagnostics.connectedEndpoints = connectedEndpoints
        diagnostics.totalEndpoints = totalEndpoints
    }
    
    private func updateStreamMetrics(for endpoint: String, bytesSent: Int = 0, bytesReceived: Int = 0, connected: Bool? = nil, status: String? = nil) {
        var metrics = dataStreamMetrics[endpoint] ?? StreamMetrics(endpoint: endpoint)
        
        if bytesSent > 0 {
            metrics.bytesSent += bytesSent
            metrics.messagesSent += 1
        }
        
        if bytesReceived > 0 {
            metrics.bytesReceived += bytesReceived
            metrics.messagesReceived += 1
        }
        
        if let connected = connected {
            metrics.isConnected = connected
            if connected {
                metrics.lastConnected = Date()
            } else {
                metrics.lastDisconnected = Date()
            }
        }
        
        if let status = status {
            metrics.lastStatus = status
        }
        
        metrics.lastUpdate = Date()
        dataStreamMetrics[endpoint] = metrics
    }
    
    // MARK: - Reconnection Logic
    private func setupReconnectionLogic() {
        reconnectionTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.checkAndReconnect()
            }
        }
    }
    
    private func checkAndReconnect() async {
        let connectedCount = connectionManager.activeConnections.count
        let totalCount = WebSocketConnectionManager.Endpoint.allCases.count
        
        if connectedCount < totalCount {
            logger.info("Checking for disconnected endpoints to reconnect...")
            
            for endpoint in WebSocketConnectionManager.Endpoint.allCases {
                if connectionManager.activeConnections[endpoint.rawValue] == nil {
                    logger.info("Attempting to reconnect to \(endpoint.rawValue)")
                    await connectionManager.reconnect(to: endpoint)
                }
            }
        }
    }
    
    // MARK: - Setup Methods
    private func setupConnectionObservers() {
        connectionManager.$isConnected
            .sink { [weak self] connected in
                self?.isConnected = connected
            }
            .store(in: &cancellables)
        
        connectionManager.$connectionStatus
            .sink { [weak self] status in
                self?.connectionStatus = status
            }
            .store(in: &cancellables)
    }
    
    private func setupDataProcessing() {
        // Process queued messages periodically
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.processMessageQueue()
            }
        }
    }
    
    private func processMessageQueue() async {
        while let (message, endpoint) = messageQueue.dequeue() {
            await handleReceivedMessage(message, from: endpoint)
        }
    }
}

// MARK: - Supporting Types
private struct InitializationData: Codable {
    let sessionId: String
    let timestamp: Date = Date()
    let clientVersion: String = "1.0.0"
}

private struct ErrorMessage: Codable {
    let message: String
    let code: String?
    let details: [String: String]?
}

private struct StatusMessage: Codable {
    let status: String
    let timestamp: Date
    let details: [String: String]?
}

struct ConnectionDiagnostics {
    var lastStatusUpdate: Date = Date()
    var connectedEndpoints: Int = 0
    var totalEndpoints: Int = 0
    var errors: [ConnectionError] = []
    var reconnectionAttempts: Int = 0
    
    var connectionHealth: Double {
        guard totalEndpoints > 0 else { return 0 }
        return Double(connectedEndpoints) / Double(totalEndpoints)
    }
}

struct ConnectionError: Identifiable {
    let id = UUID()
    let endpoint: String
    let message: String
    let timestamp: Date
}

struct StreamMetrics {
    let endpoint: String
    var isConnected: Bool = false
    var bytesSent: Int = 0
    var bytesReceived: Int = 0
    var messagesSent: Int = 0
    var messagesReceived: Int = 0
    var lastConnected: Date?
    var lastDisconnected: Date?
    var lastUpdate: Date = Date()
    var lastStatus: String = "unknown"
    
    var totalBytes: Int {
        return bytesSent + bytesReceived
    }
    
    var totalMessages: Int {
        return messagesSent + messagesReceived
    }
}

// MARK: - Message Queue
private class MessageQueue {
    private var queue: [(WebSocketMessage, WebSocketConnectionManager.Endpoint)] = []
    private let lock = NSLock()
    
    func enqueue(_ message: WebSocketMessage, from endpoint: WebSocketConnectionManager.Endpoint) {
        lock.lock()
        defer { lock.unlock() }
        
        queue.append((message, endpoint))
        
        // Limit queue size
        if queue.count > 1000 {
            queue.removeFirst(queue.count - 1000)
        }
    }
    
    func dequeue() -> (WebSocketMessage, WebSocketConnectionManager.Endpoint)? {
        lock.lock()
        defer { lock.unlock() }
        
        return queue.isEmpty ? nil : queue.removeFirst()
    }
    
    func clear() {
        lock.lock()
        defer { lock.unlock() }
        
        queue.removeAll()
    }
    
    var count: Int {
        lock.lock()
        defer { lock.unlock() }
        
        return queue.count
    }
}

