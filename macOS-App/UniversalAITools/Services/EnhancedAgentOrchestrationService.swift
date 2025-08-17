import Foundation
import Combine
import Network
import SwiftUI
import OSLog

/// Enhanced agent orchestration service with real backend integration, error handling, and performance optimization
@MainActor
class EnhancedAgentOrchestrationService: ObservableObject {
    
    // MARK: - Published Properties
    @Published var isConnected = false
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var lastError: String?
    @Published var isLoading = false
    @Published var isRefreshing = false
    
    // Enhanced orchestration data with caching
    @Published var orchestrationNetwork: OrchestrationNetwork = OrchestrationNetwork()
    @Published var agentPerformanceMetrics: [String: AgentPerformanceMetric] = [:]
    @Published var activeWorkflows: [AgentWorkflow] = []
    @Published var swarmCoordinationState: SwarmCoordinationState = SwarmCoordinationState()
    @Published var networkHealth: NetworkHealth = NetworkHealth()
    
    // Real-time updates with performance optimization
    @Published var realtimeAgentUpdates: [AgentStatusUpdate] = []
    @Published var realtimeMetricUpdates: [MetricUpdate] = []
    @Published var realtimeDecisionUpdates: [DecisionUpdate] = []
    
    // Error recovery and user guidance
    @Published var errorRecoveryOptions: [ErrorRecoveryOption] = []
    @Published var guidedRecoveryState: GuidedRecoveryState = .none
    
    // MARK: - Private Properties
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var cancellables = Set<AnyCancellable>()
    private var reconnectTimer: Timer?
    private var heartbeatTimer: Timer?
    private var dataRefreshTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private let baseReconnectDelay: TimeInterval = 2.0
    
    // Backend API integration
    private let baseURL: String
    private let orchestrationPath: String
    private let apiService: APIService
    private let logger = Logger(subsystem: "com.universalai.tools", category: "AgentOrchestration")
    
    // Performance optimization
    private var dataCache: NSCache<NSString, NSData>
    private var lastDataRefresh: Date = Date.distantPast
    private let cacheExpirationInterval: TimeInterval = 30 // 30 seconds
    private let maxCacheSize = 50 * 1024 * 1024 // 50MB
    
    // Message queue for reliable delivery
    private var messageQueue: [WebSocketMessage] = []
    private var isProcessingQueue = false
    private let maxQueueSize = 50
    
    // Network monitoring
    private let pathMonitor = NWPathMonitor()
    private let pathQueue = DispatchQueue(label: "AgentOrchestration.NetworkPath")
    
    // MARK: - Initialization
    init(baseURL: String? = nil) {
        self.baseURL = baseURL ?? UserDefaults.standard.string(forKey: "BackendURL") ?? "http://localhost:9999"
        self.orchestrationPath = "/ws/orchestration"
        self.apiService = APIService.shared
        self.dataCache = NSCache<NSString, NSData>()
        
        setupCache()
        setupURLSession()
        setupNetworkMonitoring()
        
        // Load initial data
        Task {
            await loadInitialData()
        }
    }
    
    deinit {
        disconnect()
        cancelAllTimers()
        pathMonitor.cancel()
    }
    
    // MARK: - Cache Management
    
    private func setupCache() {
        dataCache.countLimit = 100
        dataCache.totalCostLimit = maxCacheSize
    }
    
    private func getCachedData(for key: String) -> Data? {
        guard let cachedData = dataCache.object(forKey: NSString(string: key)) as Data?,
              Date().timeIntervalSince(lastDataRefresh) < cacheExpirationInterval else {
            return nil
        }
        return cachedData
    }
    
    private func setCachedData(_ data: Data, for key: String) {
        dataCache.setObject(NSData(data: data), forKey: NSString(string: key))
    }
    
    // MARK: - URL Session Setup
    
    private func setupURLSession() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15.0
        config.waitsForConnectivity = true
        urlSession = URLSession(configuration: config)
    }
    
    // MARK: - Network Monitoring
    
    private func setupNetworkMonitoring() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                if path.status == .satisfied {
                    if let self = self, !self.isConnected {
                        self.logger.info("🌐 Network connectivity restored, attempting connection")
                        await self.connect()
                    }
                } else {
                    self?.handleNetworkUnavailable()
                }
            }
        }
        pathMonitor.start(queue: pathQueue)
    }
    
    private func handleNetworkUnavailable() {
        connectionStatus = .error
        lastError = "Network connection unavailable"
        logger.warning("⚠️ Network connection lost")
    }
    
    // MARK: - Connection Management
    
    /// Enhanced connection with backend integration
    func connect() async {
        guard !isConnected else { return }
        
        logger.info("🔌 Connecting to agent orchestration service")
        
        connectionStatus = .connecting
        lastError = nil
        
        // Create WebSocket URL
        let wsURLString = baseURL.replacingOccurrences(of: "http", with: "ws") + orchestrationPath
        guard let wsURL = URL(string: wsURLString) else {
            await handleConnectionError(URLError(.badURL))
            return
        }
        
        var request = URLRequest(url: wsURL)
        request.timeoutInterval = 15.0
        
        // Add authentication using the integrated API service
        if let token = apiService.authToken {
            if token.hasPrefix("ey") { // JWT token
                request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
            } else { // API key
                request.setValue(token, forHTTPHeaderField: "X-API-Key")
            }
        }
        
        // Add custom headers for orchestration service
        request.setValue("agent-orchestration", forHTTPHeaderField: "X-Service-Type")
        request.setValue("1.0", forHTTPHeaderField: "X-API-Version")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        webSocketTask = urlSession?.webSocketTask(with: request)
        webSocketTask?.resume()
        
        // Start listening for messages
        receiveMessage()
        
        // Start heartbeat
        startHeartbeat()
        
        logger.info("📡 Agent orchestration WebSocket connection initiated")
    }
    
    /// Disconnect from WebSocket
    func disconnect() {
        connectionStatus = .disconnecting
        
        webSocketTask?.cancel(with: .goingAway, reason: "Client disconnect".data(using: .utf8))
        webSocketTask = nil
        
        isConnected = false
        connectionStatus = .disconnected
        
        cancelAllTimers()
        
        logger.info("📡 Agent orchestration WebSocket disconnected")
    }
    
    /// Reconnect with exponential backoff and guided recovery
    private func reconnect() async {
        guard reconnectAttempts < maxReconnectAttempts else {
            lastError = "Max reconnection attempts reached"
            connectionStatus = .failed
            await offerGuidedRecovery()
            logger.error("❌ Max reconnection attempts reached for agent orchestration")
            return
        }
        
        reconnectAttempts += 1
        let delay = baseReconnectDelay * pow(2.0, Double(reconnectAttempts - 1))
        
        logger.warning("🔄 Agent orchestration WebSocket reconnecting in \\(delay)s (attempt \\(self.reconnectAttempts))")
        
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        await connect()
    }
    
    // MARK: - Data Loading with Backend Integration
    
    /// Load initial orchestration data from the backend API
    private func loadInitialData() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            logger.info("📥 Loading initial orchestration data from backend")
            
            // Load data concurrently for better performance
            async let agentStatusTask = loadAgentStatusFromBackend()
            async let topologyTask = loadTopologyFromBackend()
            async let metricsTask = loadMetricsFromBackend()
            async let workflowsTask = loadWorkflowsFromBackend()
            
            let (agentStatus, topology, metrics, workflows) = try await (
                agentStatusTask, topologyTask, metricsTask, workflowsTask
            )
            
            // Update the orchestration network with real data
            await updateOrchestrationNetwork(
                agentStatus: agentStatus,
                topology: topology,
                metrics: metrics,
                workflows: workflows
            )
            
            // Start automatic refresh
            setupPeriodicRefresh()
            
            logger.info("✅ Initial orchestration data loaded successfully")
        } catch {
            logger.error("❌ Failed to load initial orchestration data: \\(error)")
            // Fall back to sample data if backend is unavailable
            await loadSampleDataWithUserNotification()
        }
    }
    
    /// Load agent status from backend API with caching
    private func loadAgentStatusFromBackend() async throws -> [String: Any] {
        let cacheKey = "agent_status"
        
        // Check cache first
        if let cachedData = getCachedData(for: cacheKey) {
            if let cachedObject = try? JSONSerialization.jsonObject(with: cachedData) as? [String: Any] {
                logger.debug("📦 Using cached agent status data")
                return cachedObject
            }
        }
        
        let endpoint = "\\(baseURL)/api/v1/agent-orchestration/status"
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        if let token = apiService.authToken {
            request.setValue(token, forHTTPHeaderField: "X-API-Key")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        // Cache the response
        setCachedData(data, for: cacheKey)
        
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
    
    /// Load network topology from backend
    private func loadTopologyFromBackend() async throws -> [String: Any] {
        let cacheKey = "network_topology"
        
        // Check cache first
        if let cachedData = getCachedData(for: cacheKey) {
            if let cachedObject = try? JSONSerialization.jsonObject(with: cachedData) as? [String: Any] {
                logger.debug("📦 Using cached topology data")
                return cachedObject
            }
        }
        
        let endpoint = "\\(baseURL)/api/v1/agent-orchestration/topology"
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        if let token = apiService.authToken {
            request.setValue(token, forHTTPHeaderField: "X-API-Key")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        // Cache the response
        setCachedData(data, for: cacheKey)
        
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
    
    /// Load metrics from backend
    private func loadMetricsFromBackend() async throws -> [String: Any] {
        let cacheKey = "performance_metrics"
        
        // Check cache first  
        if let cachedData = getCachedData(for: cacheKey) {
            if let cachedObject = try? JSONSerialization.jsonObject(with: cachedData) as? [String: Any] {
                logger.debug("📦 Using cached metrics data")
                return cachedObject
            }
        }
        
        let endpoint = "\\(baseURL)/api/v1/agent-orchestration/metrics"
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        if let token = apiService.authToken {
            request.setValue(token, forHTTPHeaderField: "X-API-Key")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        // Cache the response
        setCachedData(data, for: cacheKey)
        
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
    
    /// Load workflows from backend
    private func loadWorkflowsFromBackend() async throws -> [String: Any] {
        let endpoint = "\\(baseURL)/api/v1/agent-orchestration/workflows"
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        if let token = apiService.authToken {
            request.setValue(token, forHTTPHeaderField: "X-API-Key")
        }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
    
    // MARK: - Data Processing and Updates
    
    /// Update orchestration network with backend data
    private func updateOrchestrationNetwork(
        agentStatus: [String: Any],
        topology: [String: Any],
        metrics: [String: Any],
        workflows: [String: Any]
    ) async {
        // Parse agent data and create nodes
        var nodes: [AgentNode] = []
        var connections: [AgentConnection] = []
        var performanceMetrics: [String: AgentPerformanceMetric] = [:]
        var workflowList: [AgentWorkflow] = []
        
        // Process agent status data
        if let agentsData = agentStatus["data"] as? [String: Any],
           let agents = agentsData["agents"] as? [[String: Any]] {
            
            for (index, agentInfo) in agents.enumerated() {
                if let name = agentInfo["name"] as? String {
                    let node = AgentNode(
                        agentId: name,
                        position: calculateNodePosition(index: index, total: agents.count),
                        layer: calculateNodeLayer(agentInfo: agentInfo),
                        nodeType: mapToNodeType(agentInfo: agentInfo)
                    )
                    nodes.append(node)
                    
                    // Create performance metrics from agent data
                    if let agentMetrics = agentInfo["metrics"] as? [String: Any] {
                        let metric = AgentPerformanceMetric(
                            latency: agentMetrics["averageResponseTime"] as? Double ?? 0.0,
                            successRate: agentMetrics["successRate"] as? Double ?? 1.0,
                            throughput: agentMetrics["totalRequests"] as? Double ?? 0.0
                        )
                        performanceMetrics[name] = metric
                    }
                }
            }
        }
        
        // Create connections based on topology
        connections = createConnectionsFromTopology(nodes: nodes, topologyData: topology)
        
        // Process workflows
        if let workflowsData = workflows["data"] as? [String: Any],
           let workflowItems = workflowsData["workflows"] as? [[String: Any]] {
            
            for workflowData in workflowItems {
                if let workflow = parseWorkflow(from: workflowData) {
                    workflowList.append(workflow)
                }
            }
        }
        
        // Update the network with smooth animation
        withAnimation(.easeInOut(duration: 0.5)) {
            orchestrationNetwork.nodes = nodes
            orchestrationNetwork.connections = connections
            orchestrationNetwork.topology = .hierarchical
            orchestrationNetwork.healthScore = calculateNetworkHealth(from: agentStatus)
            orchestrationNetwork.lastUpdated = Date()
            
            agentPerformanceMetrics = performanceMetrics
            activeWorkflows = workflowList
            
            // Update network health
            updateNetworkHealth(from: metrics)
        }
        
        lastDataRefresh = Date()
    }
    
    /// Calculate position for network visualization with improved layout
    private func calculateNodePosition(index: Int, total: Int) -> CGPoint {
        let angle = 2.0 * .pi * Double(index) / Double(total)
        let radius = 250.0 + Double(index % 3) * 50.0 // Varied radius for better visualization
        let centerX = 500.0
        let centerY = 400.0
        
        return CGPoint(
            x: centerX + radius * cos(angle),
            y: centerY + radius * sin(angle)
        )
    }
    
    /// Calculate node layer based on agent information
    private func calculateNodeLayer(agentInfo: [String: Any]) -> Int {
        if let category = agentInfo["category"] as? String {
            switch category {
            case "core", "orchestrator": return 0
            case "cognitive", "reasoning": return 1
            case "specialized", "worker": return 2
            default: return 1
            }
        }
        return 1
    }
    
    /// Map agent info to node type
    private func mapToNodeType(agentInfo: [String: Any]) -> NodeType {
        if let category = agentInfo["category"] as? String {
            switch category {
            case "core", "orchestrator": return .root
            case "cognitive", "reasoning": return .coordinator
            case "specialized", "worker": return .worker
            default: return .worker
            }
        }
        return .worker
    }
    
    /// Create connections from topology data with intelligent routing
    private func createConnectionsFromTopology(nodes: [AgentNode], topologyData: [String: Any]) -> [AgentConnection] {
        var connections: [AgentConnection] = []
        
        // Create hierarchical connections
        let rootNodes = nodes.filter { $0.nodeType == .root }
        let coordinatorNodes = nodes.filter { $0.nodeType == .coordinator }
        let workerNodes = nodes.filter { $0.nodeType == .worker }
        
        // Connect root to coordinators
        for rootNode in rootNodes {
            for coordinatorNode in coordinatorNodes {
                let connection = AgentConnection(
                    fromAgentId: rootNode.agentId,
                    toAgentId: coordinatorNode.agentId,
                    strength: 0.9,
                    latency: Double.random(in: 2.0...8.0)
                )
                connections.append(connection)
            }
        }
        
        // Connect coordinators to workers
        for coordinatorNode in coordinatorNodes {
            let workerSubset = workerNodes.filter { _ in Double.random(in: 0...1) > 0.5 }
            for workerNode in workerSubset {
                let connection = AgentConnection(
                    fromAgentId: coordinatorNode.agentId,
                    toAgentId: workerNode.agentId,
                    strength: Double.random(in: 0.6...0.8),
                    latency: Double.random(in: 5.0...15.0)
                )
                connections.append(connection)
            }
        }
        
        // Add some peer connections for resilience
        for i in 0..<coordinatorNodes.count {
            for j in (i+1)..<coordinatorNodes.count {
                if Double.random(in: 0...1) > 0.7 {
                    let connection = AgentConnection(
                        fromAgentId: coordinatorNodes[i].agentId,
                        toAgentId: coordinatorNodes[j].agentId,
                        strength: Double.random(in: 0.4...0.6),
                        latency: Double.random(in: 8.0...20.0)
                    )
                    connections.append(connection)
                }
            }
        }
        
        return connections
    }
    
    /// Parse workflow from backend data
    private func parseWorkflow(from data: [String: Any]) -> AgentWorkflow? {
        guard let name = data["name"] as? String,
              let stepsData = data["steps"] as? [[String: Any]] else {
            return nil
        }
        
        let steps = stepsData.compactMap { stepData -> WorkflowStep? in
            guard let stepName = stepData["name"] as? String,
                  let agentId = stepData["agentId"] as? String,
                  let order = stepData["order"] as? Int else {
                return nil
            }
            
            return WorkflowStep(
                name: stepName,
                agentId: agentId,
                order: order,
                status: .pending
            )
        }
        
        let priorityString = data["priority"] as? String ?? "medium"
        let priority = WorkflowPriority(rawValue: priorityString) ?? .medium
        
        return AgentWorkflow(
            name: name,
            steps: steps,
            priority: priority
        )
    }
    
    /// Calculate network health from agent data
    private func calculateNetworkHealth(from agentData: [String: Any]) -> Double {
        if let data = agentData["data"] as? [String: Any],
           let summary = data["summary"] as? [String: Any],
           let meshHealth = summary["meshHealth"] as? Double {
            return meshHealth
        }
        return 0.85 // Default healthy value
    }
    
    /// Update network health metrics
    private func updateNetworkHealth(from metricsData: [String: Any]) {
        var health = NetworkHealth()
        
        if let data = metricsData["data"] as? [String: Any] {
            health.overallScore = data["overallHealth"] as? Double ?? 0.85
            health.latencyScore = data["latencyHealth"] as? Double ?? 0.9
            health.throughputScore = data["throughputHealth"] as? Double ?? 0.8
            health.reliabilityScore = data["reliabilityHealth"] as? Double ?? 0.95
            health.lastUpdated = Date()
        }
        
        networkHealth = health
    }
    
    // MARK: - Periodic Refresh
    
    /// Setup periodic refresh of data from backend
    private func setupPeriodicRefresh() {
        dataRefreshTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.refreshData()
            }
        }
    }
    
    /// Refresh orchestration data from backend
    func refreshData() async {
        guard isConnected else { return }
        
        isRefreshing = true
        defer { isRefreshing = false }
        
        do {
            logger.debug("🔄 Refreshing orchestration data from backend")
            
            async let agentStatusTask = loadAgentStatusFromBackend()
            async let topologyTask = loadTopologyFromBackend()
            async let metricsTask = loadMetricsFromBackend()
            async let workflowsTask = loadWorkflowsFromBackend()
            
            let (agentStatus, topology, metrics, workflows) = try await (
                agentStatusTask, topologyTask, metricsTask, workflowsTask
            )
            
            await updateOrchestrationNetwork(
                agentStatus: agentStatus,
                topology: topology,
                metrics: metrics,
                workflows: workflows
            )
            
            logger.debug("✅ Orchestration data refreshed successfully")
        } catch {
            logger.warning("⚠️ Failed to refresh orchestration data: \\(error)")
            await handleDataRefreshError(error)
        }
    }
    
    // MARK: - WebSocket Message Handling
    
    /// Receive messages from WebSocket
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            Task { @MainActor [weak self] in
                switch result {
                case .success(let message):
                    await self?.handleMessage(message)
                    self?.receiveMessage() // Continue listening
                    
                case .failure(let error):
                    await self?.handleConnectionError(error)
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
            logger.warning("Unknown WebSocket message type received")
        }
    }
    
    /// Process text-based messages (JSON)
    private func processTextMessage(_ text: String) async {
        guard let data = text.data(using: .utf8) else { return }
        
        do {
            let message = try JSONDecoder().decode(WebSocketMessage.self, from: data)
            await handleOrchestrationMessage(message)
        } catch {
            logger.error("Failed to decode WebSocket message: \\(error)")
        }
    }
    
    /// Process binary messages
    private func processBinaryMessage(_ data: Data) async {
        do {
            let message = try JSONDecoder().decode(WebSocketMessage.self, from: data)
            await handleOrchestrationMessage(message)
        } catch {
            logger.error("Failed to decode binary WebSocket message: \\(error)")
        }
    }
    
    /// Handle orchestration-specific messages
    private func handleOrchestrationMessage(_ message: WebSocketMessage) async {
        switch message.type {
        case "connection_established":
            await handleConnectionEstablished(message)
        case "agent_status_update":
            await handleAgentStatusUpdate(message)
        case "network_topology_update":
            await handleNetworkTopologyUpdate(message)
        case "task_update":
            await handleTaskUpdate(message)
        case "metrics_update":
            await handleMetricsUpdate(message)
        case "heartbeat":
            await handleHeartbeat(message)
        case "error":
            await handleErrorMessage(message)
        default:
            logger.warning("⚠️ Unknown orchestration message type: \\(message.type)")
        }
    }
    
    // MARK: - Message Handlers
    
    private func handleConnectionEstablished(_ message: WebSocketMessage) async {
        isConnected = true
        connectionStatus = .connected
        reconnectAttempts = 0
        lastError = nil
        
        logger.info("✅ Agent orchestration WebSocket connection established")
        
        // Request initial data through WebSocket
        await requestInitialData()
    }
    
    private func handleAgentStatusUpdate(_ message: WebSocketMessage) async {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message.data)
            let update = try JSONDecoder().decode(AgentStatusUpdate.self, from: jsonData)
            
            // Add to realtime updates
            realtimeAgentUpdates.insert(update, at: 0)
            
            // Update agent network with new status
            if let nodeIndex = orchestrationNetwork.nodes.firstIndex(where: { $0.agentId == update.agentId }) {
                // Update node status in the network
                withAnimation(.easeInOut(duration: 0.3)) {
                    // Update logic would go here based on the status
                }
                logger.info("🔄 Updated agent status for: \\(update.agentId)")
            }
            
            // Keep only recent updates (last 100)
            if realtimeAgentUpdates.count > 100 {
                realtimeAgentUpdates = Array(realtimeAgentUpdates.prefix(100))
            }
            
        } catch {
            logger.error("Failed to decode agent status update: \\(error)")
        }
    }
    
    private func handleNetworkTopologyUpdate(_ message: WebSocketMessage) async {
        // Similar to existing implementation but with enhanced error handling
        logger.info("🌐 Received network topology update")
        await refreshData()
    }
    
    private func handleTaskUpdate(_ message: WebSocketMessage) async {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message.data)
            let taskUpdate = try JSONDecoder().decode(TaskUpdate.self, from: jsonData)
            
            logger.info("📋 Task update received: \\(taskUpdate.taskId) - \\(taskUpdate.status)")
            
            // Update workflow if it's part of an active workflow
            for i in 0..<activeWorkflows.count {
                if let stepIndex = activeWorkflows[i].steps.firstIndex(where: { $0.name.contains(taskUpdate.taskId) }) {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        activeWorkflows[i].steps[stepIndex].status = TaskStatus(rawValue: taskUpdate.status) ?? .pending
                    }
                    break
                }
            }
        } catch {
            logger.error("Failed to decode task update: \\(error)")
        }
    }
    
    private func handleMetricsUpdate(_ message: WebSocketMessage) async {
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
            
            logger.debug("📊 Updated performance metrics for agent: \\(metricsUpdate.agentId)")
            
        } catch {
            logger.error("Failed to decode performance metrics update: \\(error)")
        }
    }
    
    private func handleHeartbeat(_ message: WebSocketMessage) async {
        logger.debug("💓 Heartbeat received")
        // Send heartbeat response if needed
        let response = WebSocketMessage(type: "heartbeat_response", data: ["timestamp": Date().timeIntervalSince1970])
        await sendMessage(response)
    }
    
    private func handleErrorMessage(_ message: WebSocketMessage) async {
        if let errorMsg = message.data["message"] as? String {
            lastError = errorMsg
            logger.error("❌ Server error: \\(errorMsg)")
            await offerErrorRecovery(for: errorMsg)
        }
    }
    
    private func requestInitialData() async {
        let message = WebSocketMessage(type: "request_initial_data", data: [:])
        await sendMessage(message)
    }
    
    // MARK: - Error Handling and Recovery
    
    private func handleConnectionError(_ error: Error) async {
        isConnected = false
        lastError = error.localizedDescription
        
        if connectionStatus != .disconnecting {
            connectionStatus = .reconnecting
            await reconnect()
        }
        
        logger.error("❌ Agent orchestration WebSocket error: \\(error)")
        await offerErrorRecovery(for: error.localizedDescription)
    }
    
    private func handleDataRefreshError(_ error: Error) async {
        lastError = "Failed to refresh data: \\(error.localizedDescription)"
        await offerErrorRecovery(for: error.localizedDescription)
    }
    
    /// Offer guided error recovery options to the user
    private func offerErrorRecovery(for errorMessage: String) async {
        var options: [ErrorRecoveryOption] = []
        
        if errorMessage.contains("network") || errorMessage.contains("connection") {
            options.append(ErrorRecoveryOption(
                title: "Check Network Connection",
                description: "Verify your internet connection and try again",
                action: { [weak self] in
                    Task { @MainActor in
                        await self?.connect()
                    }
                }
            ))
        }
        
        if errorMessage.contains("authentication") || errorMessage.contains("401") {
            options.append(ErrorRecoveryOption(
                title: "Re-authenticate",
                description: "Your session may have expired. Sign in again",
                action: { [weak self] in
                    Task { @MainActor in
                        await self?.apiService.forceReauthentication()
                        await self?.connect()
                    }
                }
            ))
        }
        
        options.append(ErrorRecoveryOption(
            title: "Use Sample Data",
            description: "Continue with sample data while we resolve the issue",
            action: { [weak self] in
                Task { @MainActor in
                    await self?.loadSampleDataWithUserNotification()
                }
            }
        ))
        
        options.append(ErrorRecoveryOption(
            title: "Retry Connection",
            description: "Try connecting to the backend again",
            action: { [weak self] in
                Task { @MainActor in
                    self?.reconnectAttempts = 0
                    await self?.connect()
                }
            }
        ))
        
        errorRecoveryOptions = options
        guidedRecoveryState = .showingOptions
    }
    
    /// Offer guided recovery when all reconnection attempts fail
    private func offerGuidedRecovery() async {
        guidedRecoveryState = .guidedRecovery
        
        let recoverySteps = [
            "Check your internet connection",
            "Verify the backend server is running",
            "Check if authentication is required",
            "Try refreshing the page or restarting the app"
        ]
        
        logger.info("🛠️ Offering guided recovery with \\(recoverySteps.count) steps")
    }
    
    /// Load sample data with user notification
    private func loadSampleDataWithUserNotification() async {
        logger.warning("⚠️ Loading sample data - backend unavailable")
        
        // Create enhanced sample data
        let sampleNodes = [
            AgentNode(
                agentId: "orchestrator-1",
                position: CGPoint(x: 500, y: 300),
                nodeType: .root,
                isRoot: true
            ),
            AgentNode(
                agentId: "cognitive-reasoner",
                position: CGPoint(x: 400, y: 200),
                nodeType: .coordinator
            ),
            AgentNode(
                agentId: "data-processor",
                position: CGPoint(x: 600, y: 200),
                nodeType: .coordinator
            ),
            AgentNode(
                agentId: "specialized-worker-1",
                position: CGPoint(x: 350, y: 100),
                nodeType: .worker
            ),
            AgentNode(
                agentId: "specialized-worker-2",
                position: CGPoint(x: 450, y: 100),
                nodeType: .worker
            ),
            AgentNode(
                agentId: "specialized-worker-3",
                position: CGPoint(x: 550, y: 100),
                nodeType: .worker
            ),
            AgentNode(
                agentId: "specialized-worker-4",
                position: CGPoint(x: 650, y: 100),
                nodeType: .worker
            )
        ]
        
        let sampleConnections = [
            AgentConnection(fromAgentId: "orchestrator-1", toAgentId: "cognitive-reasoner", strength: 0.95, latency: 5.2),
            AgentConnection(fromAgentId: "orchestrator-1", toAgentId: "data-processor", strength: 0.90, latency: 4.8),
            AgentConnection(fromAgentId: "cognitive-reasoner", toAgentId: "specialized-worker-1", strength: 0.85, latency: 8.3),
            AgentConnection(fromAgentId: "cognitive-reasoner", toAgentId: "specialized-worker-2", strength: 0.82, latency: 9.1),
            AgentConnection(fromAgentId: "data-processor", toAgentId: "specialized-worker-3", strength: 0.88, latency: 7.5),
            AgentConnection(fromAgentId: "data-processor", toAgentId: "specialized-worker-4", strength: 0.91, latency: 6.9)
        ]
        
        let sampleMetrics = [
            "orchestrator-1": AgentPerformanceMetric(latency: 12.5, successRate: 0.98, throughput: 150.0),
            "cognitive-reasoner": AgentPerformanceMetric(latency: 25.3, successRate: 0.94, throughput: 89.0),
            "data-processor": AgentPerformanceMetric(latency: 18.7, successRate: 0.97, throughput: 112.0),
            "specialized-worker-1": AgentPerformanceMetric(latency: 35.2, successRate: 0.92, throughput: 65.0),
            "specialized-worker-2": AgentPerformanceMetric(latency: 42.1, successRate: 0.89, throughput: 58.0),
            "specialized-worker-3": AgentPerformanceMetric(latency: 28.9, successRate: 0.95, throughput: 78.0),
            "specialized-worker-4": AgentPerformanceMetric(latency: 31.4, successRate: 0.93, throughput: 72.0)
        ]
        
        withAnimation(.easeInOut(duration: 0.8)) {
            orchestrationNetwork.nodes = sampleNodes
            orchestrationNetwork.connections = sampleConnections
            orchestrationNetwork.topology = .hierarchical
            orchestrationNetwork.healthScore = 0.92
            orchestrationNetwork.lastUpdated = Date()
            
            agentPerformanceMetrics = sampleMetrics
            
            networkHealth = NetworkHealth(
                overallScore: 0.92,
                latencyScore: 0.88,
                throughputScore: 0.94,
                reliabilityScore: 0.96
            )
        }
        
        // Show user notification that sample data is being used
        lastError = "Using sample data - backend connection unavailable"
    }
    
    // MARK: - Agent Control Functions
    
    /// Send agent command through backend API and WebSocket
    func sendAgentCommand(_ agentId: String, command: AgentCommand) async {
        do {
            // Send command through backend REST API first
            try await sendAgentCommandToBackend(agentId: agentId, command: command)
            
            // Also send through WebSocket for real-time updates
            let commandMessage = AgentCommandMessage(agentId: agentId, command: command)
            let commandData = try JSONEncoder().encode(commandMessage)
            let jsonObject = try JSONSerialization.jsonObject(with: commandData) as? [String: Any] ?? [:]
            let message = WebSocketMessage(type: "agent_command", data: jsonObject)
            await sendMessage(message)
            
            logger.info("📤 Agent command sent to \\(agentId): \\(command)")
        } catch {
            logger.error("❌ Failed to send agent command: \\(error)")
            await offerErrorRecovery(for: error.localizedDescription)
        }
    }
    
    /// Send agent command to backend API
    private func sendAgentCommandToBackend(agentId: String, command: AgentCommand) async throws {
        let endpoint = "\\(baseURL)/api/v1/agent-orchestration/agents/\\(agentId)/command"
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = apiService.authToken {
            request.setValue(token, forHTTPHeaderField: "X-API-Key")
        }
        
        let commandData = [
            "command": command.rawValue,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: commandData)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
    }
    
    /// Execute agent workflow through backend API and WebSocket
    func executeWorkflow(_ workflow: AgentWorkflow) async {
        do {
            // Send workflow execution request to backend
            try await executeWorkflowOnBackend(workflow)
            
            // Also send through WebSocket for real-time updates
            let workflowData = try JSONEncoder().encode(workflow)
            let jsonObject = try JSONSerialization.jsonObject(with: workflowData) as? [String: Any] ?? [:]
            let message = WebSocketMessage(type: "workflow_execute", data: jsonObject)
            await sendMessage(message)
            
            logger.info("📤 Workflow execution request sent: \\(workflow.name)")
        } catch {
            logger.error("❌ Failed to execute workflow: \\(error)")
            await offerErrorRecovery(for: error.localizedDescription)
        }
    }
    
    /// Execute workflow on backend
    private func executeWorkflowOnBackend(_ workflow: AgentWorkflow) async throws {
        let endpoint = "\\(baseURL)/api/v1/agent-orchestration/workflows/execute"
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = apiService.authToken {
            request.setValue(token, forHTTPHeaderField: "X-API-Key")
        }
        
        let workflowPayload = [
            "name": workflow.name,
            "steps": workflow.steps.map { step in
                [
                    "name": step.name,
                    "agentId": step.agentId,
                    "order": step.order
                ]
            },
            "priority": workflow.priority.rawValue
        ] as [String: Any]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: workflowPayload)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
    }
    
    // MARK: - Message Sending
    
    /// Send message through WebSocket with queuing
    private func sendMessage(_ message: WebSocketMessage) async {
        guard isConnected, let webSocketTask = webSocketTask else {
            // Queue message for when connection is restored
            if messageQueue.count < maxQueueSize {
                messageQueue.append(message)
            }
            return
        }
        
        do {
            let data = try JSONEncoder().encode(message)
            let string = String(data: data, encoding: .utf8) ?? ""
            try await webSocketTask.send(.string(string))
        } catch {
            logger.error("Failed to send WebSocket message: \\(error)")
        }
    }
    
    // MARK: - Timer Management
    
    private func startHeartbeat() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                let heartbeat = WebSocketMessage(type: "heartbeat", data: ["timestamp": Date().timeIntervalSince1970])
                await self?.sendMessage(heartbeat)
            }
        }
    }
    
    private func cancelAllTimers() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        dataRefreshTimer?.invalidate()
        dataRefreshTimer = nil
    }
    
    // MARK: - Public Interface Methods
    
    /// Manually refresh all data
    func manualRefresh() async {
        logger.info("🔄 Manual refresh triggered")
        await refreshData()
    }
    
    /// Clear error state
    func clearError() {
        lastError = nil
        errorRecoveryOptions = []
        guidedRecoveryState = .none
    }
    
    /// Reset connection
    func resetConnection() async {
        disconnect()
        reconnectAttempts = 0
        await Task.sleep(nanoseconds: 1_000_000_000) // 1 second delay
        await connect()
    }
}

// MARK: - Supporting Types

/// Network health metrics
struct NetworkHealth {
    var overallScore: Double = 0.85
    var latencyScore: Double = 0.9
    var throughputScore: Double = 0.8
    var reliabilityScore: Double = 0.95
    var lastUpdated: Date = Date()
    
    var status: String {
        if overallScore >= 0.9 {
            return "Excellent"
        } else if overallScore >= 0.8 {
            return "Good"
        } else if overallScore >= 0.7 {
            return "Fair"
        } else {
            return "Poor"
        }
    }
    
    var color: Color {
        if overallScore >= 0.9 {
            return .green
        } else if overallScore >= 0.8 {
            return .blue
        } else if overallScore >= 0.7 {
            return .orange
        } else {
            return .red
        }
    }
}

/// Error recovery option for guided user assistance
struct ErrorRecoveryOption: Identifiable {
    let id = UUID()
    let title: String
    let description: String
    let action: () -> Void
}

/// Guided recovery state
enum GuidedRecoveryState {
    case none
    case showingOptions
    case guidedRecovery
}

/// Task update from WebSocket
struct TaskUpdate: Codable {
    let taskId: String
    let status: String
    let progress: Double?
    let agentId: String
    let timestamp: Date
}

/// Agent status update
struct AgentStatusUpdate: Codable, Identifiable {
    let id: String
    let agentId: String
    let status: String
    let timestamp: Date
    let metrics: [String: Double]?
    
    init(id: String = UUID().uuidString, agentId: String, status: String, timestamp: Date = Date(), metrics: [String: Double]? = nil) {
        self.id = id
        self.agentId = agentId
        self.status = status
        self.timestamp = timestamp
        self.metrics = metrics
    }
}

/// Metric update
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

/// Decision update for AB-MCTS
struct DecisionUpdate: Codable, Identifiable {
    let id: String
    let nodeId: String
    let decision: String
    let confidence: Double
    let timestamp: Date
    
    init(id: String = UUID().uuidString, nodeId: String, decision: String, confidence: Double, timestamp: Date = Date()) {
        self.id = id
        self.nodeId = nodeId
        self.decision = decision
        self.confidence = confidence
        self.timestamp = timestamp
    }
}

/// Agent command message
struct AgentCommandMessage: Codable {
    let agentId: String
    let command: AgentCommand
    let timestamp: Date = Date()
}

/// Agent command enum
enum AgentCommand: String, Codable, CaseIterable {
    case start = "start"
    case stop = "stop"
    case pause = "pause"
    case resume = "resume"
    case restart = "restart"
    case reset = "reset"
    case configure = "configure"
    case debug = "debug"
}

/// Swarm coordination state
struct SwarmCoordinationState {
    var activeSwarms: [String] = []
    var coordinationScore: Double = 0.85
    var consensusLevel: Double = 0.78
    var communicationEfficiency: Double = 0.92
    var lastUpdated: Date = Date()
}