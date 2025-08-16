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

// LogLevel is defined in Models/LoggingTypes.swift

// AgentPerformanceMetric is defined in AgentTypes.swift

/// Agent orchestration network topology representation
struct OrchestrationNetwork: Codable {
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

// Note: AgentNode, AgentConnection, NetworkTopology, and NodeType are defined in Models/AgentTypes.swift

// Note: ABMCTSNode is defined in Models/AgentTypes.swift

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

// Note: AgentAction is defined in Models/AgentTypes.swift

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

extension OrchestrationNetwork {
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
        // Since AgentWorkflow doesn't have startTime/endTime properties,
        // we'll calculate based on creation date and current time
        return Date().timeIntervalSince(createdAt)
    }
}