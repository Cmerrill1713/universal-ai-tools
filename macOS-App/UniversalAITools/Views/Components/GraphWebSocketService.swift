import Foundation
import Combine
import OSLog
import Network

/// Service for real-time graph data streaming via WebSocket
@MainActor
class GraphWebSocketService: ObservableObject {
    private let logger = Logger(subsystem: "com.universalai.tools", category: "GraphWebSocket")
    
    @Published var isConnected = false
    @Published var connectionState: ConnectionState = .disconnected
    @Published var lastError: String?
    @Published var latency: TimeInterval = 0
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession
    private var baseURL: String
    private var authToken: String?
    private var cancellables = Set<AnyCancellable>()
    private var reconnectTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private var pingTimer: Timer?
    private var lastPingTime: Date?
    
    // Data processing
    private let dataQueue = DispatchQueue(label: "graph.websocket.data", qos: .userInitiated)
    private var pendingUpdates: [GraphUpdate] = []
    private var updateBatchTimer: Timer?
    private let batchInterval: TimeInterval = 0.1 // Batch updates every 100ms
    
    enum ConnectionState: Equatable {
        case disconnected
        case connecting
        case connected
        case reconnecting
        case error(String)
        
        static func == (lhs: ConnectionState, rhs: ConnectionState) -> Bool {
            switch (lhs, rhs) {
            case (.disconnected, .disconnected), (.connecting, .connecting), (.connected, .connected), (.reconnecting, .reconnecting):
                return true
            case (.error(let lhsMessage), .error(let rhsMessage)):
                return lhsMessage == rhsMessage
            default:
                return false
            }
        }
    }
    
    enum GraphUpdate {
        case nodeAdded(GraphNode)
        case nodeUpdated(GraphNode)
        case nodeRemoved(String)
        case edgeAdded(GraphEdge)
        case edgeUpdated(GraphEdge)
        case edgeRemoved(String)
        case clusterUpdated(GraphCluster)
        case queryResult(GraphQueryResult)
        case layoutUpdate([String: SIMD3<Float>]) // Node positions
    }
    
    // Callbacks for graph updates
    var onNodeUpdate: ((GraphNode) -> Void)?
    var onEdgeUpdate: ((GraphEdge) -> Void)?
    var onClusterUpdate: ((GraphCluster) -> Void)?
    var onQueryResult: ((GraphQueryResult) -> Void)?
    var onLayoutUpdate: (([String: SIMD3<Float>]) -> Void)?
    var onBulkUpdate: (([GraphUpdate]) -> Void)?
    
    init(baseURL: String, authToken: String? = nil) {
        self.baseURL = baseURL
        self.authToken = authToken
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.urlSession = URLSession(configuration: config)
        
        setupBatchProcessing()
    }
    
    // MARK: - Connection Management
    
    func connect() {
        guard connectionState != .connecting && connectionState != .connected else {
            logger.debug("Already connecting or connected")
            return
        }
        
        connectionState = .connecting
        reconnectAttempts = 0
        
        let wsURL = baseURL.replacingOccurrences(of: "http", with: "ws") + "/api/v1/graph/ws"
        
        guard let url = URL(string: wsURL) else {
            logger.error("Invalid WebSocket URL: \(wsURL)")
            connectionState = .error("Invalid WebSocket URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.setValue("graph-client", forHTTPHeaderField: "User-Agent")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        logger.info("Connecting to graph WebSocket: \(wsURL)")
        
        webSocketTask = urlSession.webSocketTask(with: request)
        webSocketTask?.resume()
        
        // Start receiving messages
        receiveMessage()
        
        // Start ping timer
        startPingTimer()
        
        // Connection timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            if self?.connectionState == .connecting {
                self?.logger.warning("Connection timeout")
                self?.handleConnectionError("Connection timeout")
            }
        }
    }
    
    func disconnect() {
        logger.info("Disconnecting from graph WebSocket")
        
        connectionState = .disconnected
        isConnected = false
        
        stopTimers()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        reconnectAttempts = 0
    }
    
    private func handleConnectionError(_ error: String) {
        logger.error("WebSocket connection error: \(error)")
        
        connectionState = .error(error)
        lastError = error
        isConnected = false
        
        stopTimers()
        webSocketTask = nil
        
        scheduleReconnect()
    }
    
    private func scheduleReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            logger.error("Max reconnect attempts reached")
            connectionState = .error("Max reconnect attempts reached")
            return
        }
        
        reconnectAttempts += 1
        let delay = min(pow(2.0, Double(reconnectAttempts)), 30.0) // Exponential backoff, max 30s
        
        logger.info("Scheduling reconnect in \(delay)s (attempt \(self.reconnectAttempts))")
        connectionState = .reconnecting
        
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.connect()
        }
    }
    
    // MARK: - Message Handling
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                Task { @MainActor in
                    self?.handleMessage(message)
                    self?.receiveMessage() // Continue receiving
                }
            case .failure(let error):
                Task { @MainActor in
                    self?.handleConnectionError("Receive error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            handleTextMessage(text)
        case .data(let data):
            handleBinaryMessage(data)
        @unknown default:
            logger.warning("Unknown message type received")
        }
    }
    
    private func handleTextMessage(_ text: String) {
        guard let data = text.data(using: .utf8) else {
            logger.error("Failed to convert message to data")
            return
        }
        
        do {
            let message = try JSONDecoder().decode(GraphWebSocketMessage.self, from: data)
            processGraphMessage(message)
        } catch {
            logger.error("Failed to decode WebSocket message: \(error)")
        }
    }
    
    private func handleBinaryMessage(_ data: Data) {
        // Handle binary messages if needed (e.g., compressed data)
        logger.debug("Received binary message of \(data.count) bytes")
    }
    
    private func processGraphMessage(_ message: GraphWebSocketMessage) {
        switch message.type {
        case "connection_established":
            handleConnectionEstablished(message.data)
        case "pong":
            handlePong()
        case "node_added":
            if let node = decodeNode(from: message.data) {
                queueUpdate(.nodeAdded(node))
            }
        case "node_updated":
            if let node = decodeNode(from: message.data) {
                queueUpdate(.nodeUpdated(node))
            }
        case "node_removed":
            if let nodeId = message.data["nodeId"] as? String {
                queueUpdate(.nodeRemoved(nodeId))
            }
        case "edge_added":
            if let edge = decodeEdge(from: message.data) {
                queueUpdate(.edgeAdded(edge))
            }
        case "edge_updated":
            if let edge = decodeEdge(from: message.data) {
                queueUpdate(.edgeUpdated(edge))
            }
        case "edge_removed":
            if let edgeId = message.data["edgeId"] as? String {
                queueUpdate(.edgeRemoved(edgeId))
            }
        case "cluster_updated":
            if let cluster = decodeCluster(from: message.data) {
                queueUpdate(.clusterUpdated(cluster))
            }
        case "query_result":
            if let result = decodeQueryResult(from: message.data) {
                queueUpdate(.queryResult(result))
            }
        case "layout_update":
            if let positions = decodePositions(from: message.data) {
                queueUpdate(.layoutUpdate(positions))
            }
        case "bulk_update":
            handleBulkUpdate(message.data)
        case "error":
            if let errorMessage = message.data["message"] as? String {
                lastError = errorMessage
                logger.error("Server error: \(errorMessage)")
            }
        default:
            logger.debug("Unknown message type: \(message.type)")
        }
    }
    
    private func handleConnectionEstablished(_ data: [String: Any]) {
        logger.info("Graph WebSocket connection established")
        connectionState = .connected
        isConnected = true
        reconnectAttempts = 0
        
        if let serverInfo = data["server"] as? [String: Any] {
            logger.debug("Server info: \(serverInfo)")
        }
    }
    
    private func handlePong() {
        if let pingTime = lastPingTime {
            self.latency = Date().timeIntervalSince(pingTime)
            logger.debug("Ping latency: \(self.latency * 1000)ms")
        }
    }
    
    // MARK: - Data Decoding
    
    private func decodeNode(from data: [String: Any]) -> GraphNode? {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data)
            return try JSONDecoder().decode(GraphNode.self, from: jsonData)
        } catch {
            logger.error("Failed to decode node: \(error)")
            return nil
        }
    }
    
    private func decodeEdge(from data: [String: Any]) -> GraphEdge? {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data)
            return try JSONDecoder().decode(GraphEdge.self, from: jsonData)
        } catch {
            logger.error("Failed to decode edge: \(error)")
            return nil
        }
    }
    
    private func decodeCluster(from data: [String: Any]) -> GraphCluster? {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data)
            return try JSONDecoder().decode(GraphCluster.self, from: jsonData)
        } catch {
            logger.error("Failed to decode cluster: \(error)")
            return nil
        }
    }
    
    private func decodeQueryResult(from data: [String: Any]) -> GraphQueryResult? {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data)
            return try JSONDecoder().decode(GraphQueryResult.self, from: jsonData)
        } catch {
            logger.error("Failed to decode query result: \(error)")
            return nil
        }
    }
    
    private func decodePositions(from data: [String: Any]) -> [String: SIMD3<Float>]? {
        guard let positions = data["positions"] as? [String: [Float]] else {
            return nil
        }
        
        var result: [String: SIMD3<Float>] = [:]
        for (nodeId, coords) in positions {
            if coords.count >= 3 {
                result[nodeId] = SIMD3<Float>(coords[0], coords[1], coords[2])
            }
        }
        
        return result
    }
    
    private func handleBulkUpdate(_ data: [String: Any]) {
        // Handle efficient bulk updates
        if let updates = data["updates"] as? [[String: Any]] {
            var bulkUpdates: [GraphUpdate] = []
            
            for updateData in updates {
                if let type = updateData["type"] as? String,
                   let payload = updateData["data"] as? [String: Any] {
                    
                    switch type {
                    case "node_added":
                        if let node = decodeNode(from: payload) {
                            bulkUpdates.append(.nodeAdded(node))
                        }
                    case "edge_added":
                        if let edge = decodeEdge(from: payload) {
                            bulkUpdates.append(.edgeAdded(edge))
                        }
                    default:
                        break
                    }
                }
            }
            
            if !bulkUpdates.isEmpty {
                onBulkUpdate?(bulkUpdates)
            }
        }
    }
    
    // MARK: - Update Batching
    
    private func setupBatchProcessing() {
        updateBatchTimer = Timer.scheduledTimer(withTimeInterval: batchInterval, repeats: true) { [weak self] _ in
            self?.processBatchedUpdates()
        }
    }
    
    private func queueUpdate(_ update: GraphUpdate) {
        dataQueue.async { [weak self] in
            self?.pendingUpdates.append(update)
        }
    }
    
    private func processBatchedUpdates() {
        dataQueue.async { [weak self] in
            guard let self = self, !self.pendingUpdates.isEmpty else { return }
            
            let updates = self.pendingUpdates
            self.pendingUpdates.removeAll()
            
            Task { @MainActor in
                self.applyUpdates(updates)
            }
        }
    }
    
    private func applyUpdates(_ updates: [GraphUpdate]) {
        for update in updates {
            switch update {
            case .nodeAdded(let node), .nodeUpdated(let node):
                onNodeUpdate?(node)
            case .edgeAdded(let edge), .edgeUpdated(let edge):
                onEdgeUpdate?(edge)
            case .clusterUpdated(let cluster):
                onClusterUpdate?(cluster)
            case .queryResult(let result):
                onQueryResult?(result)
            case .layoutUpdate(let positions):
                onLayoutUpdate?(positions)
            case .nodeRemoved, .edgeRemoved:
                // Handle removals if needed
                break
            }
        }
    }
    
    // MARK: - Outgoing Messages
    
    func sendQuery(_ query: String, parameters: [String: Any] = [:]) {
        let message = GraphWebSocketMessage(
            type: "graph_query",
            data: [
                "query": query,
                "parameters": parameters,
                "timestamp": Date().timeIntervalSince1970
            ]
        )
        
        sendMessage(message)
    }
    
    func subscribeToNodeUpdates(nodeIds: [String]) {
        let message = GraphWebSocketMessage(
            type: "subscribe_nodes",
            data: [
                "nodeIds": nodeIds
            ]
        )
        
        sendMessage(message)
    }
    
    func requestLayoutUpdate(algorithm: GraphLayout, parameters: [String: Any] = [:]) {
        let message = GraphWebSocketMessage(
            type: "layout_request",
            data: [
                "algorithm": algorithm.rawValue,
                "parameters": parameters
            ]
        )
        
        sendMessage(message)
    }
    
    private func sendMessage(_ message: GraphWebSocketMessage) {
        guard isConnected else {
            logger.warning("Cannot send message: not connected")
            return
        }
        
        do {
            let data = try JSONEncoder().encode(message)
            let text = String(data: data, encoding: .utf8) ?? ""
            
            webSocketTask?.send(.string(text)) { error in
                if let error = error {
                    Task { @MainActor in
                        self.logger.error("Failed to send message: \(error)")
                    }
                }
            }
        } catch {
            logger.error("Failed to encode message: \(error)")
        }
    }
    
    // MARK: - Ping/Pong
    
    private func startPingTimer() {
        stopPingTimer()
        
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.sendPing()
            }
        }
    }
    
    private func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
    }
    
    private func sendPing() {
        guard isConnected else { return }
        
        lastPingTime = Date()
        let message = GraphWebSocketMessage(type: "ping", data: [:])
        sendMessage(message)
    }
    
    private func stopTimers() {
        stopPingTimer()
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        updateBatchTimer?.invalidate()
        updateBatchTimer = nil
    }
    
    deinit {
        Task { @MainActor in
            self.disconnect()
            self.stopTimers()
        }
    }
}

// MARK: - WebSocket Message Structure

struct GraphWebSocketMessage: Codable {
    let type: String
    let data: [String: Any]
    let timestamp: TimeInterval
    
    init(type: String, data: [String: Any]) {
        self.type = type
        self.data = data
        self.timestamp = Date().timeIntervalSince1970
    }
    
    enum CodingKeys: String, CodingKey {
        case type, data, timestamp
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        timestamp = try container.decodeIfPresent(TimeInterval.self, forKey: .timestamp) ?? Date().timeIntervalSince1970
        
        // Decode data as flexible JSON
        if let dataDict = try? container.decode([String: JSONValue].self, forKey: .data) {
            data = dataDict.mapValues { $0.value }
        } else {
            data = [:]
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        try container.encode(timestamp, forKey: .timestamp)
        
        let jsonData = data.mapValues { JSONValue(value: $0) }
        try container.encode(jsonData, forKey: .data)
    }
}

// MARK: - Connection Monitoring

extension GraphWebSocketService {
    func startMonitoring() {
        // Monitor network connectivity
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                if path.status == .satisfied && self?.connectionState == .error("Network unavailable") {
                    self?.connect()
                } else if path.status != .satisfied {
                    self?.handleConnectionError("Network unavailable")
                }
            }
        }
        
        let queue = DispatchQueue(label: "network.monitor")
        monitor.start(queue: queue)
    }
}