import Foundation
import SwiftUI
import Combine

// MARK: - Agent WebSocket Service
class AgentWebSocketObserver: ObservableObject {
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var agentNetwork = AgentNetwork.empty
    @Published var agentPerformanceMetrics: [String: AgentPerformanceMetric] = [:]
    @Published var activeWorkflows: [AgentWorkflow] = []
    @Published var realtimeAgentUpdates: [AgentStatusUpdate] = []
    @Published var abmctsTree: ABMCTSNode?
    @Published var lastError: String?
    
    var isConnected: Bool {
        connectionStatus == .connected
    }
    
    init() {
        // Initialize with sample data
        loadSampleData()
    }
    
    func connect() async {
        connectionStatus = .connecting
        // Simulate connection
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        connectionStatus = .connected
        loadSampleData()
    }
    
    func disconnect() {
        connectionStatus = .disconnected
    }
    
    func sendAgentCommand(_ agentId: String, command: AgentCommand) async {
        // Simulate command
    }
    
    func requestTreeExpansion(_ nodeId: String) async {
        // Simulate tree expansion
    }
    
    private func loadSampleData() {
        // Sample data to prevent crashes
        agentNetwork = AgentNetwork.sample
        agentPerformanceMetrics = AgentPerformanceMetric.sampleMetrics
        activeWorkflows = AgentWorkflow.sampleWorkflows
        realtimeAgentUpdates = AgentStatusUpdate.sampleUpdates
        abmctsTree = ABMCTSNode.sampleTree
    }
}

// MARK: - Agent Network
struct AgentNetwork: Codable {
    let nodes: [AgentNode]
    let connections: [AgentConnection]
    let topology: NetworkTopologyType
    let healthScore: Double
    let averageLatency: Double
    let lastUpdated: Date
    
    var activeConnectionCount: Int {
        connections.filter(\.isActive).count
    }
    
    static let empty = AgentNetwork(
        nodes: [],
        connections: [],
        topology: NetworkTopologyType.hierarchical,
        healthScore: 0.0,
        averageLatency: 0.0,
        lastUpdated: Date()
    )
    
    static let sample = AgentNetwork(
        nodes: AgentNode.sampleNodes,
        connections: AgentConnection.sampleConnections,
        topology: NetworkTopologyType.hierarchical,
        healthScore: 0.85,
        averageLatency: 12.5,
        lastUpdated: Date()
    )
}

// MARK: - Agent Node
struct AgentNode: Identifiable, Codable {
    let id: String
    let agentId: String
    let position: CGPoint
    let nodeType: AgentNodeType
    let layer: Int
    let isRoot: Bool
    
    init(agentId: String, position: CGPoint, nodeType: AgentNodeType = .worker, layer: Int = 0, isRoot: Bool = false) {
        self.id = agentId
        self.agentId = agentId
        self.position = position
        self.nodeType = nodeType
        self.layer = layer
        self.isRoot = isRoot
    }
    
    static let sampleNodes = [
        AgentNode(agentId: "orchestrator-1", position: CGPoint(x: 400, y: 200), nodeType: .root, isRoot: true),
        AgentNode(agentId: "coordinator-1", position: CGPoint(x: 200, y: 350), nodeType: .coordinator, layer: 1),
        AgentNode(agentId: "coordinator-2", position: CGPoint(x: 600, y: 350), nodeType: .coordinator, layer: 1),
        AgentNode(agentId: "worker-1", position: CGPoint(x: 100, y: 500), nodeType: .worker, layer: 2),
        AgentNode(agentId: "worker-2", position: CGPoint(x: 300, y: 500), nodeType: .worker, layer: 2),
        AgentNode(agentId: "worker-3", position: CGPoint(x: 500, y: 500), nodeType: .worker, layer: 2),
        AgentNode(agentId: "worker-4", position: CGPoint(x: 700, y: 500), nodeType: .worker, layer: 2)
    ]
}

// MARK: - Agent Node Type
enum AgentNodeType: String, CaseIterable, Codable {
    case root = "root"
    case coordinator = "coordinator"
    case worker = "worker"
    case monitor = "monitor"
    
    var color: Color {
        switch self {
        case .root: return .purple
        case .coordinator: return .blue
        case .worker: return .green
        case .monitor: return .orange
        }
    }
    
    var icon: String {
        switch self {
        case .root: return "crown.fill"
        case .coordinator: return "person.2.fill"
        case .worker: return "gearshape.fill"
        case .monitor: return "eye.fill"
        }
    }
}

// MARK: - Agent Connection
struct AgentConnection: Identifiable, Codable {
    let id: String
    let fromAgentId: String
    let toAgentId: String
    let connectionType: ConnectionType
    let strength: Double
    let latency: Double
    let bandwidth: Double
    let isActive: Bool
    let lastActivity: Date
    
    init(fromAgentId: String, toAgentId: String, strength: Double = 1.0, latency: Double = 10.0) {
        self.id = "\(fromAgentId)-\(toAgentId)"
        self.fromAgentId = fromAgentId
        self.toAgentId = toAgentId
        self.connectionType = .bidirectional
        self.strength = strength
        self.latency = latency
        self.bandwidth = 50.0
        self.isActive = true
        self.lastActivity = Date()
    }
    
    static let sampleConnections = [
        AgentConnection(fromAgentId: "orchestrator-1", toAgentId: "coordinator-1", strength: 1.0, latency: 5.2),
        AgentConnection(fromAgentId: "orchestrator-1", toAgentId: "coordinator-2", strength: 1.0, latency: 4.8),
        AgentConnection(fromAgentId: "coordinator-1", toAgentId: "worker-1", strength: 0.8, latency: 12.3),
        AgentConnection(fromAgentId: "coordinator-1", toAgentId: "worker-2", strength: 0.9, latency: 8.7),
        AgentConnection(fromAgentId: "coordinator-2", toAgentId: "worker-3", strength: 0.7, latency: 15.1),
        AgentConnection(fromAgentId: "coordinator-2", toAgentId: "worker-4", strength: 0.9, latency: 9.2)
    ]
}

// MARK: - Connection Type
enum ConnectionType: String, CaseIterable, Codable {
    case unidirectional = "unidirectional"
    case bidirectional = "bidirectional"
}

// MARK: - Network Topology
enum NetworkTopologyType: String, CaseIterable, Codable {
    case hierarchical = "hierarchical"
    case mesh = "mesh"
    case star = "star"
    case ring = "ring"
}

// MARK: - Agent Performance Metric
struct AgentPerformanceMetric: Codable {
    let latency: Double
    let successRate: Double
    let throughput: Double
    let cpuUsage: Double
    let memoryUsage: Int64
    let errorCount: Int
    
    init(latency: Double = 100.0, successRate: Double = 0.95, throughput: Double = 10.0, 
         cpuUsage: Double = 50.0, memoryUsage: Int64 = 1024 * 1024 * 100, errorCount: Int = 0) {
        self.latency = latency
        self.successRate = successRate
        self.throughput = throughput
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.errorCount = errorCount
    }
    
    static let sampleMetrics: [String: AgentPerformanceMetric] = [
        "orchestrator-1": AgentPerformanceMetric(latency: 5.0, successRate: 0.98, throughput: 150.0),
        "coordinator-1": AgentPerformanceMetric(latency: 8.2, successRate: 0.95, throughput: 85.0),
        "coordinator-2": AgentPerformanceMetric(latency: 7.1, successRate: 0.97, throughput: 92.0),
        "worker-1": AgentPerformanceMetric(latency: 12.5, successRate: 0.89, throughput: 45.0),
        "worker-2": AgentPerformanceMetric(latency: 15.2, successRate: 0.91, throughput: 38.0),
        "worker-3": AgentPerformanceMetric(latency: 11.8, successRate: 0.93, throughput: 52.0),
        "worker-4": AgentPerformanceMetric(latency: 9.7, successRate: 0.96, throughput: 58.0)
    ]
}

// MARK: - Agent Command
enum AgentCommand: String, CaseIterable, Codable {
    case start = "start"
    case stop = "stop"
    case restart = "restart"
    case pause = "pause"
    case resume = "resume"
}

// MARK: - Agent Status Update
struct AgentStatusUpdate: Identifiable, Codable {
    let id: String
    let agentId: String
    let status: AgentStatus
    let message: String
    let timestamp: Date
    
    init(agentId: String, status: AgentStatus, message: String = "") {
        self.id = UUID().uuidString
        self.agentId = agentId
        self.status = status
        self.message = message
        self.timestamp = Date()
    }
    
    static let sampleUpdates = [
        AgentStatusUpdate(agentId: "orchestrator-1", status: .active, message: "System monitoring active"),
        AgentStatusUpdate(agentId: "coordinator-1", status: .busy, message: "Processing workflow batch"),
        AgentStatusUpdate(agentId: "worker-1", status: .active, message: "Task completed successfully"),
        AgentStatusUpdate(agentId: "worker-2", status: .error, message: "Connection timeout"),
        AgentStatusUpdate(agentId: "worker-3", status: .active, message: "Ready for new tasks")
    ]
}

// MARK: - Agent Workflow
struct AgentWorkflow: Identifiable, Codable {
    let id: String
    let name: String
    let steps: [AgentWorkflowStep]
    var executionState: AgentWorkflowExecutionState
    let priority: AgentWorkflowPriority
    let createdAt: Date
    var estimatedDuration: TimeInterval = 0
    
    init(name: String, steps: [AgentWorkflowStep], executionState: AgentWorkflowExecutionState, priority: AgentWorkflowPriority) {
        self.id = UUID().uuidString
        self.name = name
        self.steps = steps
        self.executionState = executionState
        self.priority = priority
        self.createdAt = Date()
    }
    
    static let sampleWorkflows = [
        AgentWorkflow(
            name: "Data Processing Pipeline",
            steps: [
                AgentWorkflowStep(name: "Data Ingestion", agentId: "worker-1", action: AgentAction(type: .executeTask), order: 1),
                AgentWorkflowStep(name: "Data Validation", agentId: "worker-2", action: AgentAction(type: .executeTask), order: 2),
                AgentWorkflowStep(name: "Data Analysis", agentId: "worker-3", action: AgentAction(type: .executeTask), order: 3)
            ],
            executionState: .running,
            priority: .high
        ),
        AgentWorkflow(
            name: "Model Training",
            steps: [
                AgentWorkflowStep(name: "Feature Engineering", agentId: "worker-4", action: AgentAction(type: .executeTask), order: 1),
                AgentWorkflowStep(name: "Model Training", agentId: "coordinator-1", action: AgentAction(type: .executeTask), order: 2)
            ],
            executionState: .pending,
            priority: .normal
        )
    ]
}

// MARK: - Agent Workflow Step
struct AgentWorkflowStep: Identifiable, Codable {
    let id: String
    let name: String
    let agentId: String
    let action: AgentAction
    let order: Int
    let status: AgentWorkflowStepStatus
    
    init(name: String, agentId: String, action: AgentAction, order: Int) {
        self.id = UUID().uuidString
        self.name = name
        self.agentId = agentId
        self.action = action
        self.order = order
        self.status = .pending
    }
}

// MARK: - Agent Workflow Execution State
enum AgentWorkflowExecutionState: String, CaseIterable, Codable {
    case pending = "pending"
    case running = "running"
    case completed = "completed"
    case failed = "failed"
    case paused = "paused"
    case cancelled = "cancelled"
}

// MARK: - Agent Workflow Priority
enum AgentWorkflowPriority: String, CaseIterable, Codable {
    case low = "low"
    case normal = "normal"
    case high = "high"
    case critical = "critical"
    
    var color: Color {
        switch self {
        case .low: return .gray
        case .normal: return .blue
        case .high: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - Agent Workflow Step Status
enum AgentWorkflowStepStatus: String, CaseIterable, Codable {
    case pending = "pending"
    case running = "running"
    case completed = "completed"
    case failed = "failed"
}

// MARK: - Agent Action
struct AgentAction: Codable {
    let type: AgentActionType
    let estimatedCost: Double
    let estimatedBenefit: Double
    
    init(type: AgentActionType) {
        self.type = type
        self.estimatedCost = Double.random(in: 1.0...10.0)
        self.estimatedBenefit = Double.random(in: 5.0...20.0)
    }
}

// MARK: - Agent Action Type
enum AgentActionType: String, CaseIterable, Codable {
    case executeTask = "executeTask"
    case analyzeData = "analyzeData"
    case processWorkflow = "processWorkflow"
    case monitorSystem = "monitorSystem"
    case optimizePerformance = "optimizePerformance"
}

// MARK: - AB-MCTS Node
struct ABMCTSNode: Identifiable, Codable {
    let id: String
    let depth: Int
    let visits: Int
    let averageReward: Double
    let confidence: Double
    let ucbValue: Double
    let isExpanded: Bool
    let children: [ABMCTSNode]
    let state: ABMCTSAgentState
    let action: AgentAction?
    
    init(id: String? = nil, depth: Int = 0, visits: Int = 1, averageReward: Double = 0.5, 
         confidence: Double = 0.8, ucbValue: Double = 0.6, isExpanded: Bool = false, 
         children: [ABMCTSNode] = [], state: ABMCTSAgentState? = nil, action: AgentAction? = nil) {
        self.id = id ?? UUID().uuidString
        self.depth = depth
        self.visits = visits
        self.averageReward = averageReward
        self.confidence = confidence
        self.ucbValue = ucbValue
        self.isExpanded = isExpanded
        self.children = children
        self.state = state ?? ABMCTSAgentState.sample
        self.action = action
    }
    
    static let sampleTree = ABMCTSNode(
        id: "root",
        depth: 0,
        visits: 100,
        averageReward: 0.75,
        confidence: 0.9,
        ucbValue: 0.8,
        isExpanded: true,
        children: [
            ABMCTSNode(id: "child1", depth: 1, visits: 50, averageReward: 0.8, confidence: 0.85),
            ABMCTSNode(id: "child2", depth: 1, visits: 30, averageReward: 0.6, confidence: 0.7),
            ABMCTSNode(id: "child3", depth: 1, visits: 20, averageReward: 0.9, confidence: 0.95)
        ]
    )
}

// MARK: - Agent State (ABMCTSAgentState to avoid conflict with AgentDataModels.AgentState)
struct ABMCTSAgentState: Codable {
    let agentId: String
    let context: [String: String]
    
    static let sample = ABMCTSAgentState(
        agentId: "sample-agent",
        context: ["status": "active", "task": "processing", "workload": "medium"]
    )
}

// Note: OrchestrationAgent is defined in AgentDataModels.swift to avoid conflicts

// Note: View implementations are located in their respective files in Views/Components/
// - ConnectionSettingsView: Views/Components/ConnectionSettingsView.swift
// - WorkflowCreatorView: Views/Components/WorkflowCreatorView.swift
// - AgentConfiguratorView: Views/Components/AgentConfiguratorView.swift
// - WorkflowManagementView: Views/Components/WorkflowManagementView.swift
// - PerformanceMonitoringView: Views/Components/PerformanceMonitoringView.swift
// - SwarmCoordinationView: Views/Components/SwarmCoordinationView.swift
