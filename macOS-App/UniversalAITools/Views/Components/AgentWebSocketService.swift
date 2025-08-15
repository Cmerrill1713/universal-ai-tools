import Foundation
import Combine
import Network
import SwiftUI

/// Real-time WebSocket service for agent orchestration data streaming
@MainActor
class AgentWebSocketService: NSObject, ObservableObject {
    
    // MARK: - Published Properties
    @Published var isConnected = false
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var lastError: String?
    
    // Agent orchestration data
    @Published var agentNetwork: AgentNetwork = AgentNetwork()
    @Published var agentPerformanceMetrics: [String: AgentPerformanceMetric] = [:]
    @Published var abmctsTree: ABMCTSNode?
    @Published var activeWorkflows: [AgentWorkflowService.AgentWorkflow] = []
    @Published var swarmCoordinationState: SwarmCoordinationState = SwarmCoordinationState()
    
    // Real-time updates
    @Published var realtimeAgentUpdates: [AgentStatusUpdate] = []
    @Published var realtimeMetricUpdates: [MetricUpdate] = []
    @Published var realtimeDecisionUpdates: [DecisionUpdate] = []
    
    // MARK: - Private Properties
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var cancellables = Set<AnyCancellable>()
    private var reconnectTimer: Timer?
    private var heartbeatTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private let baseReconnectDelay: TimeInterval = 2.0
    
    // Connection configuration
    private let serverURL: URL
    private let apiKey: String?
    
    // Message queue for reliable delivery
    private var messageQueue: [WebSocketMessage] = []
    private var isProcessingQueue = false
    
    // MARK: - Initialization
    init(serverURL: URL = URL(string: "ws://localhost:3001/agents/orchestration")!, apiKey: String? = nil) {
        self.serverURL = serverURL
        self.apiKey = apiKey
        super.init()
        setupURLSession()
        setupNetworkMonitoring()
    }
    
    deinit {
        Task { @MainActor in
            disconnect()
            cancelReconnectTimer()
            cancelHeartbeatTimer()
        }
    }
    
    // MARK: - Connection Management
    
    /// Establish WebSocket connection to backend orchestration service
    func connect() {
        guard !isConnected else { return }
        
        connectionStatus = .connecting
        lastError = nil
        
        var request = URLRequest(url: serverURL)
        request.timeoutInterval = 10.0
        
        // Add authentication if available
        if let apiKey = apiKey {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        
        // Add custom headers for orchestration service
        request.setValue("agent-orchestration", forHTTPHeaderField: "X-Service-Type")
        request.setValue("1.0", forHTTPHeaderField: "X-API-Version")
        
        webSocketTask = urlSession?.webSocketTask(with: request)
        webSocketTask?.resume()
        
        // Start listening for messages
        receiveMessage()
        
        // Start heartbeat
        startHeartbeat()
        
        Log.info("Agent orchestration WebSocket connecting to: \(serverURL)", log: Log.network)
    }
    
    /// Disconnect from WebSocket
    func disconnect() {
        connectionStatus = .disconnecting
        
        webSocketTask?.cancel(with: .goingAway, reason: "Client disconnect".data(using: .utf8))
        webSocketTask = nil
        
        isConnected = false
        connectionStatus = .disconnected
        
        cancelHeartbeatTimer()
        cancelReconnectTimer()
        
        Log.info("Agent orchestration WebSocket disconnected", log: Log.network)
    }
    
    /// Reconnect with exponential backoff
    private func reconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            lastError = "Max reconnection attempts reached"
            connectionStatus = .failed
            return
        }
        
        reconnectAttempts += 1
        let delay = baseReconnectDelay * pow(2.0, Double(reconnectAttempts - 1))
        
        Log.warning("Agent orchestration WebSocket reconnecting in \(delay)s (attempt \(reconnectAttempts))", log: Log.network)
        
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.connect()
            }
        }
    }
    
    // MARK: - Message Handling
    
    /// Receive messages from WebSocket
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let message):
                    await self?.handleMessage(message)
                    self?.receiveMessage() // Continue listening
                    
                case .failure(let error):
                    self?.handleConnectionError(error)
                }
            }
        }
    }
    
    /// Handle incoming WebSocket messages
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) async {
        switch message {
        case .string(let text):
            await processTextMessage(text)
        case .data(let data):
            await processBinaryMessage(data)
        @unknown default:
            Log.warning("Unknown WebSocket message type received", log: Log.network)
        }
    }
    
    /// Process text-based messages (JSON)
    private func processTextMessage(_ text: String) async {
        guard let data = text.data(using: .utf8) else { return }
        
        do {
            let message = try JSONDecoder().decode(WebSocketMessage.self, from: data)
            await handleOrchestrationMessage(message)
        } catch {
            Log.error("Failed to decode WebSocket message: \(error, log: Log.network)", log: Log.network)
        }
    }
    
    /// Process binary messages
    private func processBinaryMessage(_ data: Data) async {
        do {
            let message = try JSONDecoder().decode(WebSocketMessage.self, from: data)
            await handleOrchestrationMessage(message)
        } catch {
            Log.error("Failed to decode binary WebSocket message: \(error, log: Log.network)", log: Log.network)
        }
    }
    
    /// Handle orchestration-specific messages
    private func handleOrchestrationMessage(_ message: WebSocketMessage) async {
        switch message.type {
        case "agent_status_update":
            await handleAgentStatusUpdate(message)
        case "network_topology_update":
            await handleNetworkTopologyUpdate(message)
        case "performance_metrics_update":
            await handlePerformanceMetricsUpdate(message)
        case "abmcts_tree_update":
            await handleABMCTSTreeUpdate(message)
        case "workflow_update":
            await handleWorkflowUpdate(message)
        case "swarm_coordination_update":
            await handleSwarmCoordinationUpdate(message)
        case "heartbeat":
            await handleHeartbeat(message)
        case "error":
            await handleErrorMessage(message)
        case "connection_established":
            await handleConnectionEstablished(message)
        default:
            Log.warning("Unknown message type: \(message.type, log: Log.network)", log: Log.network)
        }
    }
    
    // MARK: - Message Type Handlers
    
    private func handleAgentStatusUpdate(_ message: WebSocketMessage) async {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message.data)
            let update = try JSONDecoder().decode(AgentStatusUpdate.self, from: jsonData)
            realtimeAgentUpdates.insert(update, at: 0)
            
            // Update agent network with new status
            if let _ = agentNetwork.nodes.firstIndex(where: { $0.agentId == update.agentId }) {
                // Update would be applied here based on the update data
                Log.info("Updated agent status for: \(update.agentId, log: Log.network)", log: Log.orchestration)
            }
            
            // Keep only recent updates (last 100)
            if realtimeAgentUpdates.count > 100 {
                realtimeAgentUpdates = Array(realtimeAgentUpdates.prefix(100))
            }
            
        } catch {
            Log.error("Failed to decode agent status update: \(error, log: Log.network)", log: Log.network)
        }
    }
    
    private func handleNetworkTopologyUpdate(_ message: WebSocketMessage) async {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message.data)
            let networkUpdate = try JSONDecoder().decode(AgentNetwork.self, from: jsonData)
            
            // Smooth transition for network updates
            withAnimation(.easeInOut(duration: 0.5)) {
                agentNetwork = networkUpdate
            }
            
            Log.info("Updated agent network topology: \(networkUpdate.nodes.count, log: Log.network) nodes, \(networkUpdate.connections.count) connections", log: Log.orchestration)
            
        } catch {
            Log.error("Failed to decode network topology update: \(error, log: Log.network)", log: Log.network)
        }
    }
    
    private func handlePerformanceMetricsUpdate(_ message: WebSocketMessage) async {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message.data)
            let metricsUpdate = try JSONDecoder().decode(MetricUpdate.self, from: jsonData)
            realtimeMetricUpdates.insert(metricsUpdate, at: 0)
            
            // Update performance metrics for specific agent
            agentPerformanceMetrics[metricsUpdate.agentId] = metricsUpdate.metrics
            
            // Keep only recent updates
            if realtimeMetricUpdates.count > 100 {
                realtimeMetricUpdates = Array(realtimeMetricUpdates.prefix(100))
            }
            
            Log.debug("Updated performance metrics for agent: \(metricsUpdate.agentId, log: Log.network)")
            
        } catch {
            Log.error("Failed to decode performance metrics update: \(error, log: Log.network)")
        }
    }
    
    private func handleABMCTSTreeUpdate(_ message: WebSocketMessage) async {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message.data)
            let treeUpdate = try JSONDecoder().decode(ABMCTSNode.self, from: jsonData)
            
            withAnimation(.easeInOut(duration: 0.3)) {
                abmctsTree = treeUpdate
            }
            
            Log.info("Updated AB-MCTS decision tree: depth \(treeUpdate.depth, log: Log.network), visits \(treeUpdate.visits)")
            
        } catch {
            Log.error("Failed to decode AB-MCTS tree update: \(error, log: Log.network)")
        }
    }
    
    private func handleWorkflowUpdate(_ message: WebSocketMessage) async {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message.data)
            let workflow = try JSONDecoder().decode(AgentWorkflowService.AgentWorkflow.self, from: jsonData)
            
            // Update or add workflow
            if let index = activeWorkflows.firstIndex(where: { $0.id == workflow.id }) {
                activeWorkflows[index] = workflow
            } else {
                activeWorkflows.append(workflow)
            }
            
            Log.info("Updated workflow: \(workflow.name, log: Log.network) (\(workflow.executionState.rawValue))")
            
        } catch {
            Log.error("Failed to decode workflow update: \(error, log: Log.network)")
        }
    }
    
    private func handleSwarmCoordinationUpdate(_ message: WebSocketMessage) async {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message.data)
            let coordination = try JSONDecoder().decode(SwarmCoordinationState.self, from: jsonData)
            swarmCoordinationState = coordination
            
            Log.info("Updated swarm coordination state", log: Log.network)
            
        } catch {
            Log.error("Failed to decode swarm coordination update: \(error, log: Log.network)")
        }
    }
    
    private func handleHeartbeat(_ message: WebSocketMessage) async {
        // Reset connection timeout
        isConnected = true
        connectionStatus = .connected
        reconnectAttempts = 0
        
        // Send heartbeat response
        await sendHeartbeatResponse()
    }
    
    private func handleErrorMessage(_ message: WebSocketMessage) async {
        if let errorMessage = message.data["message"] as? String {
            lastError = errorMessage
            Log.error("Orchestration service error: \(errorMessage, log: Log.network)")
        }
    }
    
    private func handleConnectionEstablished(_ message: WebSocketMessage) async {
        isConnected = true
        connectionStatus = .connected
        reconnectAttempts = 0
        lastError = nil
        
        Log.info("Agent orchestration WebSocket connection established", log: Log.network)
        
        // Request initial data
        await requestInitialData()
    }
    
    // MARK: - Outgoing Messages
    
    /// Send message to orchestration service
    func sendMessage(_ message: WebSocketMessage) async {
        guard isConnected else {
            messageQueue.append(message)
            return
        }
        
        do {
            let data = try JSONEncoder().encode(message)
            let wsMessage = URLSessionWebSocketTask.Message.data(data)
            
            webSocketTask?.send(wsMessage) { [weak self] error in
                if let error = error {
                    Task { @MainActor in
                        self?.handleConnectionError(error)
                    }
                }
            }
        } catch {
            Log.error("Failed to encode outgoing message: \(error, log: Log.network)")
        }
    }
    
    /// Execute agent workflow
    func executeWorkflow(_ workflow: AgentWorkflowService.AgentWorkflow) async {
        do {
            let workflowData = try JSONEncoder().encode(workflow)
            let jsonObject = try JSONSerialization.jsonObject(with: workflowData) as? [String: Any] ?? [:]
            let message = WebSocketMessage(type: "workflow_execute", data: jsonObject)
            await sendMessage(message)
        } catch {
            Log.error("Failed to encode workflow: \(error, log: Log.network)")
        }
    }
    
    /// Send agent command
    func sendAgentCommand(_ agentId: String, command: AgentCommand) async {
        let commandMessage = AgentCommandMessage(agentId: agentId, command: command)
        do {
            let commandData = try JSONEncoder().encode(commandMessage)
            let jsonObject = try JSONSerialization.jsonObject(with: commandData) as? [String: Any] ?? [:]
            let message = WebSocketMessage(type: "agent_command", data: jsonObject)
            await sendMessage(message)
        } catch {
            Log.error("Failed to encode agent command: \(error, log: Log.network)")
        }
    }
    
    /// Request AB-MCTS tree expansion
    func requestTreeExpansion(_ nodeId: String) async {
        let request = TreeExpansionRequest(nodeId: nodeId)
        do {
            let requestData = try JSONEncoder().encode(request)
            let jsonObject = try JSONSerialization.jsonObject(with: requestData) as? [String: Any] ?? [:]
            let message = WebSocketMessage(type: "abmcts_expand", data: jsonObject)
            await sendMessage(message)
        } catch {
            Log.error("Failed to encode tree expansion request: \(error, log: Log.network)")
        }
    }
    
    /// Update agent configuration
    func updateAgentConfiguration(_ agentId: String, configuration: AgentConfiguration) async {
        let update = AgentConfigurationUpdate(agentId: agentId, configuration: configuration)
        do {
            let updateData = try JSONEncoder().encode(update)
            let jsonObject = try JSONSerialization.jsonObject(with: updateData) as? [String: Any] ?? [:]
            let message = WebSocketMessage(type: "agent_config_update", data: jsonObject)
            await sendMessage(message)
        } catch {
            Log.error("Failed to encode agent configuration update: \(error, log: Log.network)")
        }
    }
    
    // MARK: - Private Helper Methods
    
    private func setupURLSession() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10.0
        config.timeoutIntervalForResource = 30.0
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }
    
    private func setupNetworkMonitoring() {
        // Monitor network connectivity
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                if path.status == .satisfied && !(self?.isConnected ?? false) {
                    self?.connect()
                }
            }
        }
        let queue = DispatchQueue(label: "NetworkMonitor")
        monitor.start(queue: queue)
    }
    
    private func startHeartbeat() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.sendHeartbeat()
            }
        }
    }
    
    private func sendHeartbeat() async {
        let message = WebSocketMessage(type: "heartbeat", data: [:])
        await sendMessage(message)
    }
    
    private func sendHeartbeatResponse() async {
        let message = WebSocketMessage(type: "heartbeat_response", data: [:])
        await sendMessage(message)
    }
    
    private func requestInitialData() async {
        let message = WebSocketMessage(type: "request_initial_data", data: [:])
        await sendMessage(message)
    }
    
    private func cancelReconnectTimer() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
    }
    
    private func cancelHeartbeatTimer() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }
    
    private func handleConnectionError(_ error: Error) {
        isConnected = false
        lastError = error.localizedDescription
        
        if connectionStatus != .disconnecting {
            connectionStatus = .reconnecting
            reconnect()
        }
        
        Log.error("Agent orchestration WebSocket error: \(error, log: Log.network)")
    }
    
    private func processMessageQueue() async {
        guard !isProcessingQueue && isConnected else { return }
        
        isProcessingQueue = true
        
        while !messageQueue.isEmpty && isConnected {
            let message = messageQueue.removeFirst()
            await sendMessage(message)
        }
        
        isProcessingQueue = false
    }
}

// MARK: - URLSessionWebSocketDelegate

extension AgentWebSocketService: URLSessionWebSocketDelegate {
    nonisolated func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol communicationProtocol: String?) {
        Task { @MainActor in
            isConnected = true
            connectionStatus = .connected
            reconnectAttempts = 0
            
            // Process any queued messages
            await processMessageQueue()
        }
    }
    
    nonisolated func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        Task { @MainActor in
            isConnected = false
            
            if connectionStatus != .disconnecting {
                connectionStatus = .disconnected
                reconnect()
            }
        }
    }
}

// MARK: - Supporting Types
// ConnectionStatus and WebSocketMessage are defined in SharedTypes.swift

// MessageType enum removed - using string literals with unified WebSocketMessage

struct AgentStatusUpdate: Codable, Identifiable {
    let id: String
    let agentId: String
    let status: AgentStatus
    let currentTask: String?
    let progress: Double?
    let timestamp: Date
    
    init(id: String = UUID().uuidString, agentId: String, status: AgentStatus, currentTask: String? = nil, progress: Double? = nil, timestamp: Date = Date()) {
        self.id = id
        self.agentId = agentId
        self.status = status
        self.currentTask = currentTask
        self.progress = progress
        self.timestamp = timestamp
    }
}

struct MetricUpdate: Codable, Identifiable {
    let id: String
    let agentId: String
    let metrics: AgentPerformanceMetric
    let timestamp: Date
    
    init(id: String = UUID().uuidString, agentId: String, metrics: AgentPerformanceMetric, timestamp: Date = Date()) {
        self.id = id
        self.agentId = agentId
        self.metrics = metrics
        self.timestamp = timestamp
    }
}

struct DecisionUpdate: Codable, Identifiable {
    let id: String
    let nodeId: String
    let action: AgentAction
    let result: ActionResult?
    let timestamp: Date
    
    init(id: String = UUID().uuidString, nodeId: String, action: AgentAction, result: ActionResult? = nil, timestamp: Date = Date()) {
        self.id = id
        self.nodeId = nodeId
        self.action = action
        self.result = result
        self.timestamp = timestamp
    }
}

struct SwarmCoordinationState: Codable {
    var activeAgents: Int
    var consensusLevel: Double
    var coordinationEfficiency: Double
    var lastCoordinationAction: Date
    var pendingDecisions: Int
    
    init(activeAgents: Int = 0, consensusLevel: Double = 0.0, coordinationEfficiency: Double = 0.0, lastCoordinationAction: Date = Date(), pendingDecisions: Int = 0) {
        self.activeAgents = activeAgents
        self.consensusLevel = consensusLevel
        self.coordinationEfficiency = coordinationEfficiency
        self.lastCoordinationAction = lastCoordinationAction
        self.pendingDecisions = pendingDecisions
    }
}

enum AgentCommand: String, Codable, CaseIterable {
    case start = "start"
    case stop = "stop"
    case pause = "pause"
    case resume = "resume"
    case restart = "restart"
    case updateConfig = "update_config"
    case scaleUp = "scale_up"
    case scaleDown = "scale_down"
}

struct AgentCommandMessage: Codable {
    let agentId: String
    let command: AgentCommand
    let parameters: [String: String]
    
    init(agentId: String, command: AgentCommand, parameters: [String: String] = [:]) {
        self.agentId = agentId
        self.command = command
        self.parameters = parameters
    }
}

struct TreeExpansionRequest: Codable {
    let nodeId: String
    let expansionDepth: Int
    
    init(nodeId: String, expansionDepth: Int = 1) {
        self.nodeId = nodeId
        self.expansionDepth = expansionDepth
    }
}

struct AgentConfigurationUpdate: Codable {
    let agentId: String
    let configuration: AgentConfiguration
}

// MARK: - Logging Extension
import os.log

struct Log {
    static let userInterface = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "UniversalAITools", category: "UserInterface")
    static let orchestration = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "UniversalAITools", category: "AgentOrchestration")
    static let network = OSLog(subsystem: Bundle.main.bundleIdentifier ?? "UniversalAITools", category: "Network")
    
    static func info(_ message: String, log: OSLog = Log.network) {
        os_log("%@", log: log, type: .info, message)
    }
    
    static func debug(_ message: String, log: OSLog = Log.network) {
        os_log("%@", log: log, type: .debug, message)
    }
    
    static func error(_ message: String, log: OSLog = Log.network) {
        os_log("%@", log: log, type: .error, message)
    }
    
    static func warning(_ message: String, log: OSLog = Log.network) {
        os_log("%@", log: log, type: .default, message)
    }
}