import Foundation
import SwiftUI

// MARK: - Agent Orchestration Data Models

/// Core agent representation in the orchestration system
struct OrchestrationAgent: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let type: AgentType
    var status: AgentStatus
    let capabilities: [String]
    var performanceMetrics: AgentPerformanceMetric
    var currentTask: String?
    var progress: Double?
    var startTime: Date?
    let version: String
    var configuration: AgentConfiguration
    
    init(
        id: String = UUID().uuidString,
        name: String,
        type: AgentType,
        status: AgentStatus = .inactive,
        capabilities: [String] = [],
        performanceMetrics: AgentPerformanceMetric = AgentPerformanceMetric(),
        currentTask: String? = nil,
        progress: Double? = nil,
        startTime: Date? = nil,
        version: String = "1.0.0",
        configuration: AgentConfiguration = AgentConfiguration()
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.status = status
        self.capabilities = capabilities
        self.performanceMetrics = performanceMetrics
        self.currentTask = currentTask
        self.progress = progress
        self.startTime = startTime
        self.version = version
        self.configuration = configuration
    }
    
    static func == (lhs: OrchestrationAgent, rhs: OrchestrationAgent) -> Bool {
        lhs.id == rhs.id
    }
}

// AgentType is defined in Agent.swift - import that definition

// AgentStatus is defined in Agent.swift and SharedTypes.swift - use those definitions

/// Agent configuration settings
struct AgentConfiguration: Codable {
    var maxConcurrentTasks: Int
    var timeoutSeconds: Double
    var retryCount: Int
    var memoryLimit: Int64 // bytes
    var cpuLimit: Double // percentage
    var loggingLevel: LogLevel
    var autoRestart: Bool
    
    init(
        maxConcurrentTasks: Int = 5,
        timeoutSeconds: Double = 30.0,
        retryCount: Int = 3,
        memoryLimit: Int64 = 512 * 1024 * 1024, // 512MB
        cpuLimit: Double = 80.0,
        loggingLevel: LogLevel = .info,
        autoRestart: Bool = true
    ) {
        self.maxConcurrentTasks = maxConcurrentTasks
        self.timeoutSeconds = timeoutSeconds
        self.retryCount = retryCount
        self.memoryLimit = memoryLimit
        self.cpuLimit = cpuLimit
        self.loggingLevel = loggingLevel
        self.autoRestart = autoRestart
    }
}

enum LogLevel: String, Codable, CaseIterable {
    case debug = "Debug"
    case info = "Info"
    case warning = "Warning"
    case error = "Error"
}

/// Real-time performance metrics for agents
struct AgentPerformanceMetric: Codable {
    var latency: Double // milliseconds
    var successRate: Double // 0.0 to 1.0
    var memoryUsage: Int64 // bytes
    var cpuUsage: Double // percentage
    var throughput: Double // tasks per minute
    var errorCount: Int
    var lastUpdated: Date
    var responseTimeHistory: [TimePoint]
    var memoryHistory: [MemoryPoint]
    var throughputHistory: [ThroughputPoint]
    
    init(
        latency: Double = 0.0,
        successRate: Double = 1.0,
        memoryUsage: Int64 = 0,
        cpuUsage: Double = 0.0,
        throughput: Double = 0.0,
        errorCount: Int = 0,
        lastUpdated: Date = Date(),
        responseTimeHistory: [TimePoint] = [],
        memoryHistory: [MemoryPoint] = [],
        throughputHistory: [ThroughputPoint] = []
    ) {
        self.latency = latency
        self.successRate = successRate
        self.memoryUsage = memoryUsage
        self.cpuUsage = cpuUsage
        self.throughput = throughput
        self.errorCount = errorCount
        self.lastUpdated = lastUpdated
        self.responseTimeHistory = responseTimeHistory
        self.memoryHistory = memoryHistory
        self.throughputHistory = throughputHistory
    }
}

/// Agent network topology representation
struct AgentNetwork: Codable {
    let id: String
    var nodes: [AgentNode]
    var connections: [AgentConnection]
    var topology: NetworkTopology
    var swarmConfig: AgentSwarmConfig
    var healthScore: Double
    var lastUpdated: Date
    
    init(
        id: String = UUID().uuidString,
        nodes: [AgentNode] = [],
        connections: [AgentConnection] = [],
        topology: NetworkTopology = .hierarchical,
        swarmConfig: AgentSwarmConfig = AgentSwarmConfig(),
        healthScore: Double = 1.0,
        lastUpdated: Date = Date()
    ) {
        self.id = id
        self.nodes = nodes
        self.connections = connections
        self.topology = topology
        self.swarmConfig = swarmConfig
        self.healthScore = healthScore
        self.lastUpdated = lastUpdated
    }
}

/// Individual node in the agent network
struct AgentNode: Identifiable, Codable {
    let id: String
    let agentId: String
    var position: CGPoint
    var radius: Double
    var layer: Int
    var isRoot: Bool
    var childNodes: [String]
    var parentNode: String?
    var nodeType: NodeType
    
    init(
        id: String = UUID().uuidString,
        agentId: String,
        position: CGPoint = .zero,
        radius: Double = 30.0,
        layer: Int = 0,
        isRoot: Bool = false,
        childNodes: [String] = [],
        parentNode: String? = nil,
        nodeType: NodeType = .worker
    ) {
        self.id = id
        self.agentId = agentId
        self.position = position
        self.radius = radius
        self.layer = layer
        self.isRoot = isRoot
        self.childNodes = childNodes
        self.parentNode = parentNode
        self.nodeType = nodeType
    }
}

enum NodeType: String, Codable, CaseIterable {
    case root = "Root"
    case coordinator = "Coordinator"
    case worker = "Worker"
    case monitor = "Monitor"
    
    var color: Color {
        switch self {
        case .root: return .red
        case .coordinator: return .orange
        case .worker: return .blue
        case .monitor: return .purple
        }
    }
    
    var icon: String {
        switch self {
        case .root: return "crown.fill"
        case .coordinator: return "person.3.fill"
        case .worker: return "person.fill"
        case .monitor: return "eye.fill"
        }
    }
}

/// Connection between agents in the network
struct AgentConnection: Identifiable, Codable {
    let id: String
    let fromAgentId: String
    let toAgentId: String
    var connectionType: ConnectionType
    var strength: Double // 0.0 to 1.0
    var latency: Double // milliseconds
    var bandwidth: Double // messages per second
    var isActive: Bool
    var lastActivity: Date
    
    init(
        id: String = UUID().uuidString,
        fromAgentId: String,
        toAgentId: String,
        connectionType: ConnectionType = .bidirectional,
        strength: Double = 1.0,
        latency: Double = 0.0,
        bandwidth: Double = 100.0,
        isActive: Bool = true,
        lastActivity: Date = Date()
    ) {
        self.id = id
        self.fromAgentId = fromAgentId
        self.toAgentId = toAgentId
        self.connectionType = connectionType
        self.strength = strength
        self.latency = latency
        self.bandwidth = bandwidth
        self.isActive = isActive
        self.lastActivity = lastActivity
    }
}

enum ConnectionType: String, Codable, CaseIterable {
    case bidirectional = "Bidirectional"
    case unidirectional = "Unidirectional"
    case broadcast = "Broadcast"
    case multicast = "Multicast"
}

enum NetworkTopology: String, Codable, CaseIterable {
    case hierarchical = "Hierarchical"
    case mesh = "Mesh"
    case star = "Star"
    case ring = "Ring"
    case tree = "Tree"
    case hybrid = "Hybrid"
}

/// AB-MCTS Decision Tree Node
struct ABMCTSNode: Identifiable, Codable {
    let id: String
    var state: AgentState
    var visits: Int
    var reward: Double
    var children: [ABMCTSNode]
    var parent: String?
    var action: AgentAction?
    var depth: Int
    var isExpanded: Bool
    var confidence: Double
    var timestamp: Date
    
    init(
        id: String = UUID().uuidString,
        state: AgentState,
        visits: Int = 0,
        reward: Double = 0.0,
        children: [ABMCTSNode] = [],
        parent: String? = nil,
        action: AgentAction? = nil,
        depth: Int = 0,
        isExpanded: Bool = false,
        confidence: Double = 0.0,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.state = state
        self.visits = visits
        self.reward = reward
        self.children = children
        self.parent = parent
        self.action = action
        self.depth = depth
        self.isExpanded = isExpanded
        self.confidence = confidence
        self.timestamp = timestamp
    }
    
    var averageReward: Double {
        visits > 0 ? reward / Double(visits) : 0.0
    }
    
    var ucbValue: Double {
        guard visits > 0 else { return Double.infinity }
        let exploitation = averageReward
        let exploration = sqrt(2.0 * log(Double(parent != nil ? 1 : visits)) / Double(visits))
        return exploitation + exploration
    }
}

/// Agent state representation for decision making
struct AgentState: Codable {
    let agentId: String
    var context: [String: String]
    var resources: AgentResources
    var objectives: [String]
    var constraints: [String]
    var timestamp: Date
    
    init(
        agentId: String,
        context: [String: String] = [:],
        resources: AgentResources = AgentResources(),
        objectives: [String] = [],
        constraints: [String] = [],
        timestamp: Date = Date()
    ) {
        self.agentId = agentId
        self.context = context
        self.resources = resources
        self.objectives = objectives
        self.constraints = constraints
        self.timestamp = timestamp
    }
}

/// Agent action for decision tree
struct AgentAction: Codable {
    let id: String
    let type: ActionType
    let parameters: [String: String]
    let estimatedCost: Double
    let estimatedBenefit: Double
    var executed: Bool
    var result: ActionResult?
    
    init(
        id: String = UUID().uuidString,
        type: ActionType,
        parameters: [String: String] = [:],
        estimatedCost: Double = 0.0,
        estimatedBenefit: Double = 0.0,
        executed: Bool = false,
        result: ActionResult? = nil
    ) {
        self.id = id
        self.type = type
        self.parameters = parameters
        self.estimatedCost = estimatedCost
        self.estimatedBenefit = estimatedBenefit
        self.executed = executed
        self.result = result
    }
}

enum ActionType: String, Codable, CaseIterable {
    case allocateResource = "Allocate Resource"
    case executeTask = "Execute Task"
    case communicateAgent = "Communicate with Agent"
    case optimizeParameter = "Optimize Parameter"
    case scaleUp = "Scale Up"
    case scaleDown = "Scale Down"
    case restart = "Restart"
    case migrate = "Migrate"
}

struct ActionResult: Codable {
    let success: Bool
    let duration: Double
    let output: String
    let metrics: [String: Double]
    let timestamp: Date
    
    init(
        success: Bool,
        duration: Double = 0.0,
        output: String = "",
        metrics: [String: Double] = [:],
        timestamp: Date = Date()
    ) {
        self.success = success
        self.duration = duration
        self.output = output
        self.metrics = metrics
        self.timestamp = timestamp
    }
}

// MARK: - Workflow Types (Reference AgentWorkflowService.swift for canonical definitions)
// AgentWorkflow, WorkflowStep, StepStatus are defined in AgentWorkflowService.swift

struct WorkflowDependency: Identifiable, Codable {
    let id: String
    let fromStepId: String
    let toStepId: String
    let dependencyType: DependencyType
    
    enum DependencyType: String, Codable, CaseIterable {
        case sequential = "Sequential"
        case conditional = "Conditional"
        case parallel = "Parallel"
    }
}

// WorkflowExecutionState and WorkflowPriority are defined in AgentWorkflowService.swift

struct WorkflowResult: Codable {
    let stepId: String
    let success: Bool
    let output: String
    let metrics: [String: Double]
    let duration: Double
    let timestamp: Date
}

/// Swarm coordination configuration
struct AgentSwarmConfig: Codable {
    var coordinationRules: [CoordinationRule]
    var communicationProtocols: [CommunicationProtocol]
    var objectives: [SwarmObjective]
    var consensusThreshold: Double
    var maxSwarmSize: Int
    var replicationFactor: Int
    
    init(
        coordinationRules: [CoordinationRule] = [],
        communicationProtocols: [CommunicationProtocol] = [],
        objectives: [SwarmObjective] = [],
        consensusThreshold: Double = 0.67,
        maxSwarmSize: Int = 100,
        replicationFactor: Int = 3
    ) {
        self.coordinationRules = coordinationRules
        self.communicationProtocols = communicationProtocols
        self.objectives = objectives
        self.consensusThreshold = consensusThreshold
        self.maxSwarmSize = maxSwarmSize
        self.replicationFactor = replicationFactor
    }
}

struct CoordinationRule: Identifiable, Codable {
    let id: String
    var name: String
    var condition: String
    var action: String
    var priority: Int
    var isActive: Bool
    
    init(
        id: String = UUID().uuidString,
        name: String,
        condition: String,
        action: String,
        priority: Int = 0,
        isActive: Bool = true
    ) {
        self.id = id
        self.name = name
        self.condition = condition
        self.action = action
        self.priority = priority
        self.isActive = isActive
    }
}

struct CommunicationProtocol: Identifiable, Codable {
    let id: String
    var name: String
    var messageFormat: MessageFormat
    var reliability: ProtocolReliability
    var encryptionEnabled: Bool
    
    enum MessageFormat: String, Codable, CaseIterable {
        case json = "JSON"
        case binary = "Binary"
        case protobuf = "Protocol Buffers"
    }
    
    enum ProtocolReliability: String, Codable, CaseIterable {
        case bestEffort = "Best Effort"
        case atLeastOnce = "At Least Once"
        case exactlyOnce = "Exactly Once"
    }
}

struct SwarmObjective: Identifiable, Codable {
    let id: String
    var name: String
    var description: String
    var targetMetric: String
    var targetValue: Double
    var currentValue: Double
    var progress: Double
    var isActive: Bool
    
    init(
        id: String = UUID().uuidString,
        name: String,
        description: String,
        targetMetric: String,
        targetValue: Double,
        currentValue: Double = 0.0,
        progress: Double = 0.0,
        isActive: Bool = true
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.targetMetric = targetMetric
        self.targetValue = targetValue
        self.currentValue = currentValue
        self.progress = progress
        self.isActive = isActive
    }
}

/// Resource management
struct AgentResources: Codable {
    var cpuQuota: Double // percentage
    var memoryQuota: Int64 // bytes
    var storageQuota: Int64 // bytes
    var networkBandwidth: Double // mbps
    var availableCapabilities: [String]
    var utilizationHistory: [ResourceUtilization]
    
    init(
        cpuQuota: Double = 100.0,
        memoryQuota: Int64 = 1024 * 1024 * 1024, // 1GB
        storageQuota: Int64 = 10 * 1024 * 1024 * 1024, // 10GB
        networkBandwidth: Double = 100.0,
        availableCapabilities: [String] = [],
        utilizationHistory: [ResourceUtilization] = []
    ) {
        self.cpuQuota = cpuQuota
        self.memoryQuota = memoryQuota
        self.storageQuota = storageQuota
        self.networkBandwidth = networkBandwidth
        self.availableCapabilities = availableCapabilities
        self.utilizationHistory = utilizationHistory
    }
}

struct ResourceUtilization: Identifiable, Codable {
    let id: String
    let timestamp: Date
    let cpuUsage: Double
    let memoryUsage: Int64
    let storageUsage: Int64
    let networkUsage: Double
    
    init(
        id: String = UUID().uuidString,
        timestamp: Date = Date(),
        cpuUsage: Double,
        memoryUsage: Int64,
        storageUsage: Int64,
        networkUsage: Double
    ) {
        self.id = id
        self.timestamp = timestamp
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.storageUsage = storageUsage
        self.networkUsage = networkUsage
    }
}

// MARK: - Time Series Data Points

struct TimePoint: Identifiable, Codable {
    let id: String
    let timestamp: Date
    let value: Double
    
    init(id: String = UUID().uuidString, timestamp: Date = Date(), value: Double) {
        self.id = id
        self.timestamp = timestamp
        self.value = value
    }
}

struct MemoryPoint: Identifiable, Codable {
    let id: String
    let timestamp: Date
    let bytes: Int64
    
    init(id: String = UUID().uuidString, timestamp: Date = Date(), bytes: Int64) {
        self.id = id
        self.timestamp = timestamp
        self.bytes = bytes
    }
}

struct ThroughputPoint: Identifiable, Codable {
    let id: String
    let timestamp: Date
    let tasksPerMinute: Double
    
    init(id: String = UUID().uuidString, timestamp: Date = Date(), tasksPerMinute: Double) {
        self.id = id
        self.timestamp = timestamp
        self.tasksPerMinute = tasksPerMinute
    }
}

// MARK: - Helper Extensions

extension AgentNetwork {
    var activeAgentCount: Int {
        nodes.count
    }
    
    var activeConnectionCount: Int {
        connections.filter { $0.isActive }.count
    }
    
    var averageLatency: Double {
        let activeConnections = connections.filter { $0.isActive }
        guard !activeConnections.isEmpty else { return 0.0 }
        return activeConnections.map { $0.latency }.reduce(0, +) / Double(activeConnections.count)
    }
}

extension ABMCTSNode {
    var isLeaf: Bool {
        children.isEmpty
    }
    
    var bestChild: ABMCTSNode? {
        children.max { $0.ucbValue < $1.ucbValue }
    }
}

extension AgentWorkflow {
    var completedSteps: Int {
        steps.filter { $0.status == .completed }.count
    }
    
    var totalSteps: Int {
        steps.count
    }
    
    var progressPercentage: Double {
        guard totalSteps > 0 else { return 0.0 }
        return Double(completedSteps) / Double(totalSteps) * 100.0
    }
    
    var estimatedDuration: Double {
        guard let start = startTime else { return 0.0 }
        if let end = endTime {
            return end.timeIntervalSince(start)
        } else {
            return Date().timeIntervalSince(start)
        }
    }
}