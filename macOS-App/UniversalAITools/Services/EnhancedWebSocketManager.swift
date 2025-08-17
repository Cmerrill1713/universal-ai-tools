import Foundation
import Combine
import Network
import Compression
import CryptoKit
import OSLog
import SwiftUI

// MARK: - Enhanced WebSocket Connection Manager
/// Highly reliable WebSocket manager with automatic reconnection, message queuing, and compression
@MainActor
public final class EnhancedWebSocketManager: ObservableObject {
    static let shared = EnhancedWebSocketManager()
    
    // MARK: - Published Properties
    @Published public var connectionState: ConnectionState = .disconnected
    @Published public var activeConnections: [String: WSConnection] = [:]
    @Published public var connectionMetrics: ConnectionMetrics = ConnectionMetrics()
    @Published public var messageQueue: MessageQueue = MessageQueue()
    @Published public var healthStatus: HealthStatus = HealthStatus()
    
    // MARK: - Configuration
    public var config = WebSocketConfiguration()
    
    // MARK: - Private Properties
    private var connections: [String: WSConnection] = [:]
    private var reconnectionTimers: [String: Timer] = [:]
    private var heartbeatTimers: [String: Timer] = [:]
    private var messageBuffers: [String: [QueuedMessage]] = [:]
    
    // Network monitoring
    private let networkMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "WSNetworkMonitor", qos: .utility)
    private var isNetworkAvailable = true
    
    // Message handling
    private let messageProcessor = MessageProcessor()
    private let compressionEngine = CompressionEngine()
    
    // Metrics
    private var metricsCollector = MetricsCollector()
    private var performanceMonitor: Timer?
    
    // Logging
    private let logger = Logger(subsystem: "com.universalai.tools", category: "EnhancedWebSocket")
    
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    private init() {
        setupNetworkMonitoring()
        startPerformanceMonitoring()
    }
    
    // MARK: - Connection Management
    
    /// Connect to WebSocket endpoint
    public func connect(to endpoint: String, options: ConnectionOptions = .default) async throws -> String {
        let connectionId = UUID().uuidString
        
        guard let url = URL(string: endpoint) else {
            throw WebSocketError.invalidURL
        }
        
        // Check network availability
        guard isNetworkAvailable else {
            throw WebSocketError.noNetwork
        }
        
        logger.info("🔌 Connecting to: \(endpoint)")
        
        // Create connection
        let connection = WSConnection(
            id: connectionId,
            url: url,
            options: options
        )
        
        // Setup WebSocket
        let session = URLSession(configuration: options.sessionConfiguration)
        let webSocket = session.webSocketTask(with: url)
        
        connection.webSocket = webSocket
        connection.session = session
        
        // Configure connection
        configureConnection(connection, options: options)
        
        // Store connection
        connections[connectionId] = connection
        activeConnections[connectionId] = connection
        
        // Start connection
        webSocket.resume()
        connection.state = .connecting
        
        // Start receiving messages
        Task {
            await receiveMessages(for: connectionId)
        }
        
        // Send connection request
        try await sendConnectionRequest(connection)
        
        // Start heartbeat
        startHeartbeat(for: connectionId)
        
        // Update metrics
        connectionMetrics.totalConnections += 1
        connectionMetrics.activeConnections = connections.count
        
        logger.info("✅ Connected: \(connectionId)")
        return connectionId
    }
    
    /// Disconnect from WebSocket
    public func disconnect(_ connectionId: String) async {
        guard let connection = connections[connectionId] else { return }
        
        logger.info("🔌 Disconnecting: \(connectionId)")
        
        // Stop heartbeat
        stopHeartbeat(for: connectionId)
        
        // Cancel reconnection
        cancelReconnection(for: connectionId)
        
        // Send disconnect message
        try? await sendDisconnectMessage(connection)
        
        // Close WebSocket
        connection.webSocket?.cancel(with: .goingAway, reason: nil)
        
        // Update state
        connection.state = .disconnected
        
        // Flush message buffer
        await flushMessageBuffer(for: connectionId)
        
        // Remove connection
        connections.removeValue(forKey: connectionId)
        activeConnections.removeValue(forKey: connectionId)
        
        // Update metrics
        connectionMetrics.activeConnections = connections.count
        
        logger.info("✅ Disconnected: \(connectionId)")
    }
    
    /// Send message through WebSocket
    public func send(_ message: WSMessage, to connectionId: String) async throws {
        guard let connection = connections[connectionId] else {
            throw WebSocketError.connectionNotFound
        }
        
        // Check connection state
        switch connection.state {
        case .connected:
            // Send immediately
            try await sendMessage(message, through: connection)
            
        case .connecting, .reconnecting:
            // Queue message
            queueMessage(message, for: connectionId)
            logger.debug("📦 Message queued for: \(connectionId)")
            
        case .disconnected, .failed:
            // Attempt reconnection and queue
            queueMessage(message, for: connectionId)
            await reconnect(connectionId)
            
        case .suspended:
            // Queue for later
            queueMessage(message, for: connectionId)
        }
    }
    
    /// Broadcast message to all connections
    public func broadcast(_ message: WSMessage) async {
        await withTaskGroup(of: Void.self) { group in
            for connectionId in connections.keys {
                group.addTask {
                    try? await self.send(message, to: connectionId)
                }
            }
        }
    }
    
    // MARK: - Reconnection Logic
    
    private func reconnect(_ connectionId: String) async {
        guard let connection = connections[connectionId] else { return }
        
        // Check if already reconnecting
        guard connection.state != .reconnecting else { return }
        
        connection.state = .reconnecting
        connection.reconnectAttempts += 1
        
        logger.info("🔄 Reconnecting (\(connection.reconnectAttempts)/\(config.maxReconnectAttempts)): \(connectionId)")
        
        // Check max attempts
        guard connection.reconnectAttempts <= config.maxReconnectAttempts else {
            logger.error("❌ Max reconnection attempts reached: \(connectionId)")
            connection.state = .failed
            handleConnectionFailure(connection)
            return
        }
        
        // Calculate backoff delay
        let delay = calculateBackoffDelay(attempts: connection.reconnectAttempts)
        
        // Schedule reconnection
        scheduleReconnection(connectionId, delay: delay)
    }
    
    private func scheduleReconnection(_ connectionId: String, delay: TimeInterval) {
        reconnectionTimers[connectionId]?.invalidate()
        
        reconnectionTimers[connectionId] = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { _ in
            Task {
                await self.performReconnection(connectionId)
            }
        }
    }
    
    private func performReconnection(_ connectionId: String) async {
        guard let connection = connections[connectionId] else { return }
        
        do {
            // Create new WebSocket
            let webSocket = connection.session?.webSocketTask(with: connection.url)
            connection.webSocket = webSocket
            
            // Start connection
            webSocket?.resume()
            
            // Start receiving
            Task {
                await receiveMessages(for: connectionId)
            }
            
            // Send reconnection request
            try await sendReconnectionRequest(connection)
            
            // Mark as connected
            connection.state = .connected
            connection.reconnectAttempts = 0
            
            // Process queued messages
            await processQueuedMessages(for: connectionId)
            
            logger.info("✅ Reconnected successfully: \(connectionId)")
        } catch {
            logger.error("❌ Reconnection failed: \(error)")
            await reconnect(connectionId)
        }
    }
    
    private func calculateBackoffDelay(attempts: Int) -> TimeInterval {
        let baseDelay = config.reconnectBaseDelay
        let maxDelay = config.reconnectMaxDelay
        
        // Exponential backoff with jitter
        let exponentialDelay = min(baseDelay * pow(2.0, Double(attempts - 1)), maxDelay)
        let jitter = Double.random(in: 0...1) * exponentialDelay * 0.3
        
        return exponentialDelay + jitter
    }
    
    private func cancelReconnection(for connectionId: String) {
        reconnectionTimers[connectionId]?.invalidate()
        reconnectionTimers.removeValue(forKey: connectionId)
    }
    
    // MARK: - Message Handling
    
    private func receiveMessages(for connectionId: String) async {
        guard let connection = connections[connectionId] else { return }
        guard let webSocket = connection.webSocket else { return }
        
        do {
            while true {
                let message = try await webSocket.receive()
                
                switch message {
                case .string(let text):
                    await handleTextMessage(text, from: connectionId)
                    
                case .data(let data):
                    await handleBinaryMessage(data, from: connectionId)
                    
                @unknown default:
                    break
                }
                
                // Update metrics
                connectionMetrics.messagesReceived += 1
                connection.lastMessageTime = Date()
            }
        } catch {
            logger.error("❌ Receive error: \(error)")
            handleReceiveError(error, for: connectionId)
        }
    }
    
    private func handleTextMessage(_ text: String, from connectionId: String) async {
        guard let connection = connections[connectionId] else { return }
        
        // Update metrics
        connectionMetrics.bytesReceived += UInt64(text.count)
        
        // Parse message
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            logger.error("Failed to parse message")
            return
        }
        
        // Process message
        let processed = await messageProcessor.process(json, from: connectionId)
        
        // Handle special messages
        if let type = processed["type"] as? String {
            switch type {
            case "ping":
                await handlePing(from: connectionId)
            case "pong":
                handlePong(from: connectionId)
            case "error":
                handleErrorMessage(processed, from: connectionId)
            default:
                // Deliver to subscribers
                connection.messageSubject.send(processed)
            }
        } else {
            // Regular message
            connection.messageSubject.send(processed)
        }
    }
    
    private func handleBinaryMessage(_ data: Data, from connectionId: String) async {
        guard let connection = connections[connectionId] else { return }
        
        // Update metrics
        connectionMetrics.bytesReceived += UInt64(data.count)
        
        // Decompress if needed
        let decompressed = compressionEngine.decompress(data) ?? data
        
        // Process binary data
        let processed = await messageProcessor.processBinary(decompressed, from: connectionId)
        
        // Deliver to subscribers
        connection.dataSubject.send(processed)
    }
    
    private func sendMessage(_ message: WSMessage, through connection: WSConnection) async throws {
        guard let webSocket = connection.webSocket else {
            throw WebSocketError.connectionClosed
        }
        
        // Prepare message
        let data = try prepareMessage(message)
        
        // Compress if enabled
        let finalData = config.enableCompression ? 
            (compressionEngine.compress(data) ?? data) : data
        
        // Send based on type
        switch message.type {
        case .text:
            if let text = String(data: finalData, encoding: .utf8) {
                try await webSocket.send(.string(text))
            }
        case .binary:
            try await webSocket.send(.data(finalData))
        }
        
        // Update metrics
        connectionMetrics.messagesSent += 1
        connectionMetrics.bytesSent += UInt64(finalData.count)
        connection.lastMessageTime = Date()
    }
    
    private func prepareMessage(_ message: WSMessage) throws -> Data {
        var payload = message.payload
        
        // Add metadata
        payload["id"] = message.id
        payload["timestamp"] = Date().timeIntervalSince1970
        
        // Add authentication if needed
        if let token = config.authToken {
            payload["auth"] = token
        }
        
        return try JSONSerialization.data(withJSONObject: payload)
    }
    
    // MARK: - Message Queueing
    
    private func queueMessage(_ message: WSMessage, for connectionId: String) {
        let queued = QueuedMessage(
            message: message,
            connectionId: connectionId,
            timestamp: Date(),
            retryCount: 0
        )
        
        messageBuffers[connectionId, default: []].append(queued)
        messageQueue.pendingCount += 1
        
        // Trim queue if needed
        if messageBuffers[connectionId]!.count > config.maxQueueSize {
            let removed = messageBuffers[connectionId]!.removeFirst()
            messageQueue.droppedCount += 1
            logger.warning("⚠️ Message dropped from queue: \(removed.message.id)")
        }
    }
    
    private func processQueuedMessages(for connectionId: String) async {
        guard let queued = messageBuffers[connectionId], !queued.isEmpty else { return }
        
        logger.info("📤 Processing \(queued.count) queued messages")
        
        for queuedMessage in queued {
            do {
                try await send(queuedMessage.message, to: connectionId)
                messageQueue.pendingCount -= 1
                messageQueue.processedCount += 1
            } catch {
                logger.error("Failed to send queued message: \(error)")
                queuedMessage.retryCount += 1
                
                if queuedMessage.retryCount < config.maxMessageRetries {
                    // Re-queue for retry
                    queueMessage(queuedMessage.message, for: connectionId)
                } else {
                    // Drop message
                    messageQueue.droppedCount += 1
                }
            }
        }
        
        messageBuffers[connectionId]?.removeAll()
    }
    
    private func flushMessageBuffer(for connectionId: String) async {
        if let count = messageBuffers[connectionId]?.count, count > 0 {
            logger.warning("⚠️ Flushing \(count) messages from buffer")
            messageQueue.droppedCount += count
        }
        messageBuffers.removeValue(forKey: connectionId)
    }
    
    // MARK: - Heartbeat
    
    private func startHeartbeat(for connectionId: String) {
        guard config.enableHeartbeat else { return }
        
        heartbeatTimers[connectionId]?.invalidate()
        
        heartbeatTimers[connectionId] = Timer.scheduledTimer(
            withTimeInterval: config.heartbeatInterval,
            repeats: true
        ) { _ in
            Task {
                await self.sendHeartbeat(to: connectionId)
            }
        }
    }
    
    private func stopHeartbeat(for connectionId: String) {
        heartbeatTimers[connectionId]?.invalidate()
        heartbeatTimers.removeValue(forKey: connectionId)
    }
    
    private func sendHeartbeat(to connectionId: String) async {
        let ping = WSMessage(
            type: .text,
            payload: ["type": "ping", "timestamp": Date().timeIntervalSince1970]
        )
        
        do {
            try await send(ping, to: connectionId)
            connections[connectionId]?.lastPingTime = Date()
        } catch {
            logger.warning("⚠️ Heartbeat failed: \(connectionId)")
            checkConnectionHealth(connectionId)
        }
    }
    
    private func handlePing(from connectionId: String) async {
        let pong = WSMessage(
            type: .text,
            payload: ["type": "pong", "timestamp": Date().timeIntervalSince1970]
        )
        
        try? await send(pong, to: connectionId)
    }
    
    private func handlePong(from connectionId: String) {
        guard let connection = connections[connectionId] else { return }
        
        connection.lastPongTime = Date()
        
        // Calculate latency
        if let pingTime = connection.lastPingTime {
            let latency = Date().timeIntervalSince(pingTime) * 1000 // ms
            connection.latency = latency
            connectionMetrics.averageLatency = (connectionMetrics.averageLatency + latency) / 2
        }
    }
    
    // MARK: - Health Monitoring
    
    private func checkConnectionHealth(_ connectionId: String) {
        guard let connection = connections[connectionId] else { return }
        
        let now = Date()
        let timeSinceLastMessage = now.timeIntervalSince(connection.lastMessageTime ?? now)
        let timeSinceLastPong = now.timeIntervalSince(connection.lastPongTime ?? now)
        
        // Check if connection is stale
        if timeSinceLastMessage > config.staleConnectionTimeout ||
           timeSinceLastPong > config.heartbeatTimeout {
            logger.warning("⚠️ Connection unhealthy: \(connectionId)")
            
            // Mark as unhealthy
            connection.isHealthy = false
            healthStatus.unhealthyConnections.insert(connectionId)
            
            // Attempt reconnection
            Task {
                await reconnect(connectionId)
            }
        } else {
            connection.isHealthy = true
            healthStatus.unhealthyConnections.remove(connectionId)
        }
    }
    
    private func startPerformanceMonitoring() {
        performanceMonitor = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { _ in
            self.updatePerformanceMetrics()
        }
    }
    
    private func updatePerformanceMetrics() {
        // Update health status
        healthStatus.totalConnections = connections.count
        healthStatus.healthyConnections = connections.values.filter { $0.isHealthy }.count
        healthStatus.messagesInQueue = messageQueue.pendingCount
        
        // Update connection metrics
        connectionMetrics.updateThroughput()
        
        // Check overall health
        let healthRatio = Double(healthStatus.healthyConnections) / Double(max(1, healthStatus.totalConnections))
        healthStatus.overallHealth = healthRatio > 0.8 ? .good : (healthRatio > 0.5 ? .warning : .critical)
        
        // Log status
        if healthStatus.overallHealth != .good {
            logger.warning("⚠️ System health: \(healthStatus.overallHealth)")
        }
    }
    
    // MARK: - Network Monitoring
    
    private func setupNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.handleNetworkChange(path)
            }
        }
        
        networkMonitor.start(queue: monitorQueue)
    }
    
    private func handleNetworkChange(_ path: NWPath) {
        let wasAvailable = isNetworkAvailable
        isNetworkAvailable = path.status == .satisfied
        
        if !wasAvailable && isNetworkAvailable {
            logger.info("📶 Network restored, reconnecting all connections")
            
            // Reconnect all connections
            for connectionId in connections.keys {
                Task {
                    await reconnect(connectionId)
                }
            }
        } else if wasAvailable && !isNetworkAvailable {
            logger.warning("📵 Network lost, suspending connections")
            
            // Suspend all connections
            for connection in connections.values {
                connection.state = .suspended
            }
        }
        
        // Update connection state
        connectionState = isNetworkAvailable ? 
            (connections.isEmpty ? .disconnected : .connected) : .suspended
    }
    
    // MARK: - Error Handling
    
    private func handleReceiveError(_ error: Error, for connectionId: String) {
        logger.error("❌ Receive error for \(connectionId): \(error)")
        
        guard let connection = connections[connectionId] else { return }
        
        // Update error metrics
        connectionMetrics.errorCount += 1
        connection.errorCount += 1
        
        // Check if recoverable
        if isRecoverableError(error) {
            Task {
                await reconnect(connectionId)
            }
        } else {
            connection.state = .failed
            handleConnectionFailure(connection)
        }
    }
    
    private func handleErrorMessage(_ message: [String: Any], from connectionId: String) {
        logger.error("❌ Error message from \(connectionId): \(message)")
        
        // Notify subscribers
        connections[connectionId]?.errorSubject.send(
            WebSocketError.serverError(message["error"] as? String ?? "Unknown error")
        )
    }
    
    private func handleConnectionFailure(_ connection: WSConnection) {
        logger.error("❌ Connection failed: \(connection.id)")
        
        // Notify subscribers
        connection.errorSubject.send(WebSocketError.connectionFailed)
        
        // Clean up
        Task {
            await disconnect(connection.id)
        }
    }
    
    private func isRecoverableError(_ error: Error) -> Bool {
        // Determine if error is recoverable
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut, .networkConnectionLost, .notConnectedToInternet:
                return true
            default:
                return false
            }
        }
        return true
    }
    
    // MARK: - Helper Methods
    
    private func configureConnection(_ connection: WSConnection, options: ConnectionOptions) {
        // Set socket options
        if options.enableCompression {
            // Enable per-message deflate
        }
        
        if let timeout = options.timeout {
            connection.timeout = timeout
        }
        
        // Setup message subjects
        connection.messageSubject = PassthroughSubject<[String: Any], Never>()
        connection.dataSubject = PassthroughSubject<Data, Never>()
        connection.errorSubject = PassthroughSubject<Error, Never>()
    }
    
    private func sendConnectionRequest(_ connection: WSConnection) async throws {
        let request = WSMessage(
            type: .text,
            payload: [
                "type": "connect",
                "clientId": connection.id,
                "version": "1.0.0",
                "capabilities": config.capabilities
            ]
        )
        
        try await sendMessage(request, through: connection)
    }
    
    private func sendReconnectionRequest(_ connection: WSConnection) async throws {
        let request = WSMessage(
            type: .text,
            payload: [
                "type": "reconnect",
                "clientId": connection.id,
                "lastMessageId": connection.lastMessageId ?? "",
                "missedMessages": true
            ]
        )
        
        try await sendMessage(request, through: connection)
    }
    
    private func sendDisconnectMessage(_ connection: WSConnection) async throws {
        let message = WSMessage(
            type: .text,
            payload: [
                "type": "disconnect",
                "clientId": connection.id,
                "reason": "client_disconnect"
            ]
        )
        
        try await sendMessage(message, through: connection)
    }
}

// MARK: - Supporting Types

public class WSConnection: ObservableObject {
    public let id: String
    public let url: URL
    public let options: ConnectionOptions
    
    @Published public var state: ConnectionState = .disconnected
    @Published public var isHealthy: Bool = true
    
    var webSocket: URLSessionWebSocketTask?
    var session: URLSession?
    
    var messageSubject = PassthroughSubject<[String: Any], Never>()
    var dataSubject = PassthroughSubject<Data, Never>()
    var errorSubject = PassthroughSubject<Error, Never>()
    
    var reconnectAttempts: Int = 0
    var errorCount: Int = 0
    var lastMessageTime: Date?
    var lastPingTime: Date?
    var lastPongTime: Date?
    var lastMessageId: String?
    var latency: TimeInterval = 0
    var timeout: TimeInterval = 30
    
    init(id: String, url: URL, options: ConnectionOptions) {
        self.id = id
        self.url = url
        self.options = options
    }
}

public struct WSMessage {
    public let id: String = UUID().uuidString
    public let type: MessageType
    public var payload: [String: Any]
    
    public enum MessageType {
        case text
        case binary
    }
}

public enum ConnectionState: String {
    case disconnected
    case connecting
    case connected
    case reconnecting
    case suspended
    case failed
}

public struct ConnectionOptions {
    public let sessionConfiguration: URLSessionConfiguration
    public let enableCompression: Bool
    public let enableEncryption: Bool
    public let timeout: TimeInterval?
    public let headers: [String: String]
    
    public static let `default` = ConnectionOptions(
        sessionConfiguration: .default,
        enableCompression: true,
        enableEncryption: false,
        timeout: 30,
        headers: [:]
    )
}

public struct WebSocketConfiguration {
    public var maxReconnectAttempts: Int = 5
    public var reconnectBaseDelay: TimeInterval = 1.0
    public var reconnectMaxDelay: TimeInterval = 60.0
    public var enableHeartbeat: Bool = true
    public var heartbeatInterval: TimeInterval = 30.0
    public var heartbeatTimeout: TimeInterval = 60.0
    public var staleConnectionTimeout: TimeInterval = 120.0
    public var maxQueueSize: Int = 1000
    public var maxMessageRetries: Int = 3
    public var enableCompression: Bool = true
    public var authToken: String?
    public var capabilities: [String] = ["compression", "heartbeat", "reconnect"]
}

public struct ConnectionMetrics {
    public var totalConnections: Int = 0
    public var activeConnections: Int = 0
    public var messagesReceived: UInt64 = 0
    public var messagesSent: UInt64 = 0
    public var bytesReceived: UInt64 = 0
    public var bytesSent: UInt64 = 0
    public var errorCount: Int = 0
    public var averageLatency: TimeInterval = 0
    
    private var lastThroughputCheck = Date()
    private var lastBytesReceived: UInt64 = 0
    private var lastBytesSent: UInt64 = 0
    
    public var receiveThroughput: Double = 0 // bytes/sec
    public var sendThroughput: Double = 0 // bytes/sec
    
    mutating func updateThroughput() {
        let now = Date()
        let elapsed = now.timeIntervalSince(lastThroughputCheck)
        
        if elapsed > 0 {
            receiveThroughput = Double(bytesReceived - lastBytesReceived) / elapsed
            sendThroughput = Double(bytesSent - lastBytesSent) / elapsed
            
            lastBytesReceived = bytesReceived
            lastBytesSent = bytesSent
            lastThroughputCheck = now
        }
    }
}

public struct MessageQueue {
    public var pendingCount: Int = 0
    public var processedCount: Int = 0
    public var droppedCount: Int = 0
}

public struct HealthStatus {
    public var totalConnections: Int = 0
    public var healthyConnections: Int = 0
    public var unhealthyConnections: Set<String> = []
    public var messagesInQueue: Int = 0
    public var overallHealth: HealthLevel = .good
    
    public enum HealthLevel {
        case good
        case warning
        case critical
    }
}

class QueuedMessage {
    let message: WSMessage
    let connectionId: String
    let timestamp: Date
    var retryCount: Int
    
    init(message: WSMessage, connectionId: String, timestamp: Date, retryCount: Int) {
        self.message = message
        self.connectionId = connectionId
        self.timestamp = timestamp
        self.retryCount = retryCount
    }
}

public enum WebSocketError: LocalizedError {
    case invalidURL
    case connectionNotFound
    case connectionClosed
    case connectionFailed
    case noNetwork
    case serverError(String)
    case encodingError
    case decodingError
    
    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid WebSocket URL"
        case .connectionNotFound:
            return "Connection not found"
        case .connectionClosed:
            return "Connection is closed"
        case .connectionFailed:
            return "Connection failed"
        case .noNetwork:
            return "No network connection"
        case .serverError(let message):
            return "Server error: \(message)"
        case .encodingError:
            return "Failed to encode message"
        case .decodingError:
            return "Failed to decode message"
        }
    }
}

// MARK: - Helper Classes

class MessageProcessor {
    func process(_ json: [String: Any], from connectionId: String) async -> [String: Any] {
        // Process and validate message
        var processed = json
        processed["_connectionId"] = connectionId
        processed["_processedAt"] = Date().timeIntervalSince1970
        return processed
    }
    
    func processBinary(_ data: Data, from connectionId: String) async -> Data {
        // Process binary data
        return data
    }
}

class CompressionEngine {
    func compress(_ data: Data) -> Data? {
        guard data.count > 1024 else { return nil } // Don't compress small data
        
        return data.withUnsafeBytes { bytes in
            guard let compressed = try? (bytes.bindMemory(to: UInt8.self).compressed(using: .zlib)) else {
                return nil
            }
            return Data(compressed)
        }
    }
    
    func decompress(_ data: Data) -> Data? {
        return data.withUnsafeBytes { bytes in
            guard let decompressed = try? (bytes.bindMemory(to: UInt8.self).decompressed(using: .zlib)) else {
                return nil
            }
            return Data(decompressed)
        }
    }
}

class MetricsCollector {
    private var events: [(Date, String, Any)] = []
    private let maxEvents = 10000
    
    func recordEvent(_ event: String, data: Any) {
        events.append((Date(), event, data))
        
        // Trim old events
        if events.count > maxEvents {
            events.removeFirst(events.count - maxEvents)
        }
    }
    
    func getMetrics(since: Date) -> [String: Any] {
        let recentEvents = events.filter { $0.0 > since }
        
        return [
            "eventCount": recentEvents.count,
            "timeRange": Date().timeIntervalSince(since),
            "events": recentEvents.map { ["time": $0.0, "event": $0.1] }
        ]
    }
}

// MARK: - Extensions for Data Compression

extension Data {
    func compressed(using algorithm: NSData.CompressionAlgorithm) throws -> Data {
        return try (self as NSData).compressed(using: algorithm) as Data
    }
    
    func decompressed(using algorithm: NSData.CompressionAlgorithm) throws -> Data {
        return try (self as NSData).decompressed(using: algorithm) as Data
    }
}

extension NSData.CompressionAlgorithm {
    static let zlib = NSData.CompressionAlgorithm(rawValue: 0)
    static let lzfse = NSData.CompressionAlgorithm(rawValue: 1)
    static let lz4 = NSData.CompressionAlgorithm(rawValue: 2)
    static let lzma = NSData.CompressionAlgorithm(rawValue: 3)
}