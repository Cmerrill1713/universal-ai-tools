import Foundation
import Combine
import Network
import SwiftUI
import os.log

// MARK: - WebSocket Connection Manager
@MainActor
class WebSocketConnectionManager: ObservableObject {
    static let shared = WebSocketConnectionManager()
    
    // MARK: - Published Properties
    @Published var isConnected: Bool = false
    @Published var connectionStatus: WSConnectionStatus = .disconnected
    @Published var activeConnections: [String: WebSocketConnection] = [:]
    @Published var connectionHealth: ConnectionHealth = ConnectionHealth()
    @Published var bandwidthUsage: BandwidthMetrics = BandwidthMetrics()
    
    // MARK: - Private Properties
    private var connectionPool: [String: WebSocketConnection] = [:]
    private var reconnectionAttempts: [String: Int] = [:]
    private var maxReconnectionAttempts: Int = 5
    private var baseReconnectionDelay: TimeInterval = 1.0
    private var networkMonitor: NWPathMonitor
    private var monitorQueue = DispatchQueue(label: "NetworkMonitor")
    private var healthCheckTimer: Timer?
    private var bandwidthTimer: Timer?
    
    // MARK: - Logging
    private let logger = Logger(subsystem: "UniversalAITools", category: "WebSocketConnectionManager")
    
    // MARK: - Cancellables
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Connection Endpoints
    enum Endpoint: String, CaseIterable {
        case graph = "/api/realtime/graph"
        case agents = "/api/realtime/agents"
        case analytics = "/api/realtime/analytics"
        case context = "/api/realtime/context"
        case flashAttention = "/api/realtime/flash-attention"
        
        var baseURL: String {
            // Use environment variable or default
            return ProcessInfo.processInfo.environment["WEBSOCKET_BASE_URL"] ?? "ws://localhost:3001"
        }
        
        var fullURL: URL? {
            return URL(string: "\(baseURL)\(rawValue)")
        }
    }
    
    // MARK: - Initialization
    private init() {
        self.networkMonitor = NWPathMonitor()
        setupNetworkMonitoring()
        startHealthChecking()
        startBandwidthMonitoring()
    }
    
    deinit {
        networkMonitor.cancel()
        healthCheckTimer?.invalidate()
        bandwidthTimer?.invalidate()
        disconnectAll()
    }
    
    // MARK: - Connection Management
    func connect(to endpoint: Endpoint, delegate: WebSocketDelegate? = nil) async -> Bool {
        logger.info("Attempting to connect to endpoint: \(endpoint.rawValue)")
        
        guard let url = endpoint.fullURL else {
            logger.error("Invalid URL for endpoint: \(endpoint.rawValue)")
            return false
        }
        
        // Check if already connected
        if let existingConnection = connectionPool[endpoint.rawValue],
           existingConnection.isConnected {
            logger.info("Already connected to endpoint: \(endpoint.rawValue)")
            return true
        }
        
        let connection = WebSocketConnection(
            url: url,
            endpoint: endpoint,
            delegate: delegate
        )
        
        connectionPool[endpoint.rawValue] = connection
        
        do {
            let success = try await connection.connect()
            if success {
                activeConnections[endpoint.rawValue] = connection
                reconnectionAttempts[endpoint.rawValue] = 0
                updateOverallConnectionStatus()
                logger.info("Successfully connected to endpoint: \(endpoint.rawValue)")
            }
            return success
        } catch {
            logger.error("Failed to connect to endpoint \(endpoint.rawValue): \(error.localizedDescription)")
            return false
        }
    }
    
    func disconnect(from endpoint: Endpoint) {
        logger.info("Disconnecting from endpoint: \(endpoint.rawValue)")
        
        connectionPool[endpoint.rawValue]?.disconnect()
        connectionPool.removeValue(forKey: endpoint.rawValue)
        activeConnections.removeValue(forKey: endpoint.rawValue)
        reconnectionAttempts.removeValue(forKey: endpoint.rawValue)
        
        updateOverallConnectionStatus()
    }
    
    func disconnectAll() {
        logger.info("Disconnecting all connections")
        
        for endpoint in Endpoint.allCases {
            disconnect(from: endpoint)
        }
    }
    
    func reconnect(to endpoint: Endpoint) async {
        logger.info("Reconnecting to endpoint: \(endpoint.rawValue)")
        
        disconnect(from: endpoint)
        
        let currentAttempts = reconnectionAttempts[endpoint.rawValue] ?? 0
        if currentAttempts >= maxReconnectionAttempts {
            logger.warning("Max reconnection attempts reached for endpoint: \(endpoint.rawValue)")
            return
        }
        
        reconnectionAttempts[endpoint.rawValue] = currentAttempts + 1
        
        // Exponential backoff
        let delay = baseReconnectionDelay * pow(2.0, Double(currentAttempts))
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        
        await connect(to: endpoint)
    }
    
    // MARK: - Message Sending
    func sendMessage(_ message: WebSocketMessage, to endpoint: Endpoint) async throws {
        guard let connection = activeConnections[endpoint.rawValue] else {
            throw WebSocketError.notConnected
        }
        
        try await connection.sendMessage(message)
        let dataSize = try JSONSerialization.data(withJSONObject: message.data).count
        updateBandwidthUsage(sent: dataSize)
    }
    
    func broadcastMessage(_ message: WebSocketMessage) async {
        await withTaskGroup(of: Void.self) { group in
            for (_, connection) in activeConnections {
                group.addTask {
                    do {
                        try await connection.sendMessage(message)
                    } catch {
                        self.logger.error("Failed to broadcast message: \(error.localizedDescription)")
                    }
                }
            }
        }
        let dataSize = (try? JSONSerialization.data(withJSONObject: message.data).count) ?? 0
        updateBandwidthUsage(sent: dataSize * activeConnections.count)
    }
    
    // MARK: - Network Monitoring
    private func setupNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.handleNetworkPathUpdate(path)
            }
        }
        networkMonitor.start(queue: monitorQueue)
    }
    
    private func handleNetworkPathUpdate(_ path: NWPath) {
        let wasConnected = isConnected
        let isNetworkAvailable = path.status == .satisfied
        
        if !isNetworkAvailable && wasConnected {
            logger.warning("Network connection lost")
            connectionStatus = .disconnected
        } else if isNetworkAvailable && !wasConnected {
            logger.info("Network connection restored")
            Task {
                await reconnectAll()
            }
        }
    }
    
    private func reconnectAll() async {
        logger.info("Reconnecting all endpoints after network restoration")
        
        await withTaskGroup(of: Void.self) { group in
            for endpoint in Endpoint.allCases {
                if connectionPool[endpoint.rawValue] != nil {
                    group.addTask {
                        await self.reconnect(to: endpoint)
                    }
                }
            }
        }
    }
    
    // MARK: - Health Monitoring
    private func startHealthChecking() {
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performHealthCheck()
            }
        }
    }
    
    private func performHealthCheck() async {
        var healthyConnections = 0
        var totalConnections = 0
        var avgLatency: TimeInterval = 0
        var totalBandwidth = 0
        
        for (endpoint, connection) in activeConnections {
            totalConnections += 1
            
            let health = await connection.checkHealth()
            if health.isHealthy {
                healthyConnections += 1
                avgLatency += health.latency
                totalBandwidth += health.throughput
            } else {
                logger.warning("Connection to \(endpoint) is unhealthy")
                Task {
                    await reconnect(to: Endpoint(rawValue: endpoint) ?? .graph)
                }
            }
        }
        
        if totalConnections > 0 {
            avgLatency /= Double(totalConnections)
        }
        
        connectionHealth = ConnectionHealth(
            healthyConnections: healthyConnections,
            totalConnections: totalConnections,
            averageLatency: avgLatency,
            totalThroughput: totalBandwidth
        )
        
        updateOverallConnectionStatus()
    }
    
    // MARK: - Bandwidth Monitoring
    private func startBandwidthMonitoring() {
        bandwidthTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updateBandwidthMetrics()
        }
    }
    
    private func updateBandwidthUsage(sent: Int = 0, received: Int = 0) {
        bandwidthUsage.bytesSent += sent
        bandwidthUsage.bytesReceived += received
        bandwidthUsage.lastUpdated = Date()
    }
    
    private func updateBandwidthMetrics() {
        let now = Date()
        let timeDiff = now.timeIntervalSince(bandwidthUsage.lastUpdated)
        
        if timeDiff > 0 {
            bandwidthUsage.uploadSpeed = Double(bandwidthUsage.bytesSent) / timeDiff
            bandwidthUsage.downloadSpeed = Double(bandwidthUsage.bytesReceived) / timeDiff
        }
        
        // Reset counters for next interval
        bandwidthUsage.bytesSent = 0
        bandwidthUsage.bytesReceived = 0
        bandwidthUsage.lastUpdated = now
    }
    
    // MARK: - Status Updates
    private func updateOverallConnectionStatus() {
        let connectedCount = activeConnections.count
        let totalEndpoints = Endpoint.allCases.count
        
        if connectedCount == 0 {
            connectionStatus = .disconnected
            isConnected = false
        } else if connectedCount == totalEndpoints {
            connectionStatus = .connected
            isConnected = true
        } else {
            connectionStatus = .degraded
            isConnected = true
        }
        
        // Post notification for AppState
        if isConnected {
            NotificationCenter.default.post(name: .init("websocketConnected"), object: nil)
        } else {
            NotificationCenter.default.post(name: .init("websocketDisconnected"), object: nil)
        }
    }
}

// MARK: - WebSocket Connection
class WebSocketConnection: NSObject, ObservableObject {
    @Published var isConnected: Bool = false
    @Published var lastPingTime: TimeInterval = 0
    
    private let url: URL
    private let endpoint: WebSocketConnectionManager.Endpoint
    private weak var delegate: WebSocketDelegate?
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession
    private let logger = Logger(subsystem: "UniversalAITools", category: "WebSocketConnection")
    private var pingTimer: Timer?
    private var messageQueue: [WebSocketMessage] = []
    private var isProcessingQueue = false
    
    init(url: URL, endpoint: WebSocketConnectionManager.Endpoint, delegate: WebSocketDelegate? = nil) {
        self.url = url
        self.endpoint = endpoint
        self.delegate = delegate
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.urlSession = URLSession(configuration: config)
        
        super.init()
    }
    
    deinit {
        disconnect()
    }
    
    func connect() async throws -> Bool {
        logger.info("Connecting to: \(url.absoluteString)")
        
        webSocketTask = urlSession.webSocketTask(with: url)
        webSocketTask?.resume()
        
        startListening()
        startPingTimer()
        
        // Wait a moment to establish connection
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        
        isConnected = webSocketTask?.state == .running
        return isConnected
    }
    
    func disconnect() {
        logger.info("Disconnecting from: \(url.absoluteString)")
        
        pingTimer?.invalidate()
        pingTimer = nil
        
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        isConnected = false
    }
    
    func sendMessage(_ message: WebSocketMessage) async throws {
        guard isConnected, let task = webSocketTask else {
            // Queue message for later if not connected
            messageQueue.append(message)
            throw WebSocketError.notConnected
        }
        
        let data = try JSONEncoder().encode(message)
        let webSocketMessage = URLSessionWebSocketTask.Message.data(data)
        
        try await task.send(webSocketMessage)
        logger.debug("Sent message to \(endpoint.rawValue): \(message.type)")
    }
    
    func checkHealth() async -> ConnectionHealth.EndpointHealth {
        let startTime = Date()
        
        do {
            let pingMessage = WebSocketMessage(
                type: "ping",
                data: [:]
            )
            try await sendMessage(pingMessage)
            
            let latency = Date().timeIntervalSince(startTime)
            return ConnectionHealth.EndpointHealth(
                isHealthy: true,
                latency: latency,
                throughput: calculateThroughput()
            )
        } catch {
            return ConnectionHealth.EndpointHealth(
                isHealthy: false,
                latency: -1,
                throughput: 0
            )
        }
    }
    
    private func startListening() {
        guard let task = webSocketTask else { return }
        
        task.receive { [weak self] result in
            switch result {
            case .success(let message):
                self?.handleMessage(message)
                self?.startListening() // Continue listening
                
            case .failure(let error):
                self?.logger.error("WebSocket receive error: \(error.localizedDescription)")
                self?.handleDisconnection()
            }
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .data(let data):
            handleDataMessage(data)
        case .string(let string):
            if let data = string.data(using: .utf8) {
                handleDataMessage(data)
            }
        @unknown default:
            logger.warning("Unknown message type received")
        }
    }
    
    private func handleDataMessage(_ data: Data) {
        do {
            let message = try JSONDecoder().decode(WebSocketMessage.self, from: data)
            
            // Update bandwidth tracking
            Task { @MainActor in
                WebSocketConnectionManager.shared.bandwidthUsage.bytesReceived += data.count
            }
            
            // Handle ping/pong
            if message.type == "pong" {
                lastPingTime = Date().timeIntervalSince1970 - (message.data["timestamp"] as? TimeInterval ?? 0)
                return
            }
            
            // Forward to delegate
            delegate?.webSocketDidReceiveMessage(message, from: endpoint)
            
        } catch {
            logger.error("Failed to decode message: \(error.localizedDescription)")
        }
    }
    
    private func handleDisconnection() {
        isConnected = false
        logger.warning("WebSocket disconnected: \(url.absoluteString)")
        
        // Attempt reconnection
        Task {
            await WebSocketConnectionManager.shared.reconnect(to: endpoint)
        }
    }
    
    private func startPingTimer() {
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.sendPing()
        }
    }
    
    private func sendPing() {
        Task {
            do {
                let pingMessage = WebSocketMessage(
                    type: "ping",
                    data: [:]
                )
                try await sendMessage(pingMessage)
            } catch {
                logger.error("Failed to send ping: \(error.localizedDescription)")
            }
        }
    }
    
    private func calculateThroughput() -> Int {
        // Simple throughput calculation based on recent message history
        // This is a placeholder - implement based on your specific needs
        return messageQueue.count * 100 // Rough estimate
    }
    
    private func processMessageQueue() async {
        guard !isProcessingQueue && isConnected else { return }
        
        isProcessingQueue = true
        defer { isProcessingQueue = false }
        
        while !messageQueue.isEmpty && isConnected {
            let message = messageQueue.removeFirst()
            do {
                try await sendMessage(message)
            } catch {
                logger.error("Failed to send queued message: \(error.localizedDescription)")
                messageQueue.insert(message, at: 0) // Put it back
                break
            }
        }
    }
}

// MARK: - Supporting Types
enum WSConnectionStatus: String, CaseIterable {
    case connected = "Connected"
    case connecting = "Connecting"
    case disconnected = "Disconnected"
    case degraded = "Degraded"
    case error = "Error"
    
    var color: Color {
        switch self {
        case .connected: return .green
        case .connecting: return .yellow
        case .disconnected: return .red
        case .degraded: return .orange
        case .error: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .connected: return "wifi"
        case .connecting: return "wifi.slash"
        case .disconnected: return "wifi.exclamationmark"
        case .degraded: return "wifi.exclamationmark"
        case .error: return "exclamationmark.triangle"
        }
    }
}

struct ConnectionHealth {
    var healthyConnections: Int = 0
    var totalConnections: Int = 0
    var averageLatency: TimeInterval = 0
    var totalThroughput: Int = 0
    var lastChecked: Date = Date()
    
    var healthPercentage: Double {
        guard totalConnections > 0 else { return 0 }
        return Double(healthyConnections) / Double(totalConnections)
    }
    
    struct EndpointHealth {
        let isHealthy: Bool
        let latency: TimeInterval
        let throughput: Int
    }
}

struct BandwidthMetrics {
    var bytesSent: Int = 0
    var bytesReceived: Int = 0
    var uploadSpeed: Double = 0 // bytes per second
    var downloadSpeed: Double = 0 // bytes per second
    var lastUpdated: Date = Date()
    
    var totalBytes: Int {
        return bytesSent + bytesReceived
    }
    
    var formattedUploadSpeed: String {
        return ByteCountFormatter.string(fromByteCount: Int64(uploadSpeed), countStyle: .binary) + "/s"
    }
    
    var formattedDownloadSpeed: String {
        return ByteCountFormatter.string(fromByteCount: Int64(downloadSpeed), countStyle: .binary) + "/s"
    }
}

// WebSocketMessage is defined in SharedTypes.swift

enum WebSocketError: Error, LocalizedError {
    case notConnected
    case invalidURL
    case connectionFailed
    case messageSendFailed
    case messageDecodeFailed
    
    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "WebSocket is not connected"
        case .invalidURL:
            return "Invalid WebSocket URL"
        case .connectionFailed:
            return "Failed to establish WebSocket connection"
        case .messageSendFailed:
            return "Failed to send WebSocket message"
        case .messageDecodeFailed:
            return "Failed to decode WebSocket message"
        }
    }
}

protocol WebSocketDelegate: AnyObject {
    func webSocketDidReceiveMessage(_ message: WebSocketMessage, from endpoint: WebSocketConnectionManager.Endpoint)
    func webSocketDidConnect(to endpoint: WebSocketConnectionManager.Endpoint)
    func webSocketDidDisconnect(from endpoint: WebSocketConnectionManager.Endpoint, error: Error?)
}

// MARK: - Extensions
extension WebSocketConnectionManager.Endpoint: Identifiable {
    var id: String { rawValue }
}