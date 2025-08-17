import Foundation
import Combine
import SwiftUI

// MARK: - Service Container for Lazy Initialization
@MainActor
class ServiceContainer: ObservableObject {
    private var _conversationAnalytics: ConversationAnalytics?
    private var _conversationManager: ConversationManager?
    private var _agentService: AgentConversationService?
    private var _voiceInterface: EnhancedVoiceInterface?
    private var _conversationIntegration: ConversationMonitoringIntegration?
    
    // Lazy getters that initialize services only when needed
    func conversationAnalytics() -> ConversationAnalytics {
        if _conversationAnalytics == nil {
            _conversationAnalytics = ConversationAnalytics(
                loggingService: LoggingService.shared,
                monitoringService: MonitoringService.shared
            )
        }
        return _conversationAnalytics!
    }
    
    func conversationManager() -> ConversationManager {
        if _conversationManager == nil {
            _conversationManager = ConversationManager(
                apiService: APIService.shared,
                loggingService: LoggingService.shared,
                monitoringService: MonitoringService.shared
            )
        }
        return _conversationManager!
    }
    
    func agentService() -> AgentConversationService {
        if _agentService == nil {
            _agentService = AgentConversationService(
                apiService: APIService.shared,
                loggingService: LoggingService.shared,
                monitoringService: MonitoringService.shared
            )
        }
        return _agentService!
    }
    
    func voiceInterface() -> EnhancedVoiceInterface {
        if _voiceInterface == nil {
            _voiceInterface = EnhancedVoiceInterface(
                conversationManager: conversationManager(),
                agentService: agentService(),
                loggingService: LoggingService.shared
            )
        }
        return _voiceInterface!
    }
    
    func conversationIntegration() -> ConversationMonitoringIntegration {
        if _conversationIntegration == nil {
            _conversationIntegration = ConversationMonitoringIntegration(
                conversationAnalytics: conversationAnalytics()
            )
        }
        return _conversationIntegration!
    }
}

// MARK: - Real-Time Data Protocol
protocol RealTimeUpdatable: ObservableObject {
    var lastUpdated: Date { get set }
    var isConnected: Bool { get }
    func handleUpdate(_ data: Data)
}

// MARK: - Unified Context Models
struct UnifiedContext: Codable, Identifiable {
    let id: String
    let sessionId: String
    let timestamp: Date
    let data: ContextData
    let metadata: ContextMetadata
    
    init(id: String = UUID().uuidString, sessionId: String, data: ContextData, metadata: ContextMetadata = ContextMetadata()) {
        self.id = id
        self.sessionId = sessionId
        self.timestamp = Date()
        self.data = data
        self.metadata = metadata
    }
}

struct ContextData: Codable {
    let graphData: GraphContextData?
    let agentData: AgentContextData?
    let analyticsData: AnalyticsContextData?
    let ragData: RAGContextData?
    
    init(graphData: GraphContextData? = nil, agentData: AgentContextData? = nil, analyticsData: AnalyticsContextData? = nil, ragData: RAGContextData? = nil) {
        self.graphData = graphData
        self.agentData = agentData
        self.analyticsData = analyticsData
        self.ragData = ragData
    }
}

struct ContextMetadata: Codable {
    let priority: ContextPriority
    let ttl: TimeInterval
    let tags: [String]
    let version: String
    
    init(priority: ContextPriority = .normal, ttl: TimeInterval = 3600, tags: [String] = [], version: String = "1.0") {
        self.priority = priority
        self.ttl = ttl
        self.tags = tags
        self.version = version
    }
}

enum ContextPriority: String, Codable, CaseIterable {
    case low = "low"
    case normal = "normal"
    case high = "high"
    case critical = "critical"
}

// MARK: - Graph Context Data
struct GraphContextData: Codable {
    let nodes: [ContextGraphNode]
    let edges: [GraphEdge]
    let clusters: [GraphCluster]
    let metadata: GraphMetadata
    
    struct ContextGraphNode: Codable, Identifiable {
        let id: String
        let label: String
        let type: String
        let properties: [String: AnyHashable]
        let position: GraphPosition?
        let weight: Double
        let connections: Int
        
        private enum CodingKeys: String, CodingKey {
            case id, label, type, position, weight, connections
        }
        
        init(id: String, label: String, type: String, properties: [String: AnyHashable] = [:], position: GraphPosition? = nil, weight: Double = 1.0, connections: Int = 0) {
            self.id = id
            self.label = label
            self.type = type
            self.properties = properties
            self.position = position
            self.weight = weight
            self.connections = connections
        }
        
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(String.self, forKey: .id)
            label = try container.decode(String.self, forKey: .label)
            type = try container.decode(String.self, forKey: .type)
            properties = [:]
            position = try container.decodeIfPresent(GraphPosition.self, forKey: .position)
            weight = try container.decodeIfPresent(Double.self, forKey: .weight) ?? 1.0
            connections = try container.decodeIfPresent(Int.self, forKey: .connections) ?? 0
        }
        
        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(id, forKey: .id)
            try container.encode(label, forKey: .label)
            try container.encode(type, forKey: .type)
            try container.encodeIfPresent(position, forKey: .position)
            try container.encode(weight, forKey: .weight)
            try container.encode(connections, forKey: .connections)
        }
    }
    
    struct GraphEdge: Codable, Identifiable {
        let id: String
        let source: String
        let target: String
        let type: String
        let weight: Double
        let properties: [String: String]
        
        init(id: String = UUID().uuidString, source: String, target: String, type: String, weight: Double = 1.0, properties: [String: String] = [:]) {
            self.id = id
            self.source = source
            self.target = target
            self.type = type
            self.weight = weight
            self.properties = properties
        }
    }
    
    struct GraphPosition: Codable {
        let x: Double
        let y: Double
        let z: Double
        
        init(x: Double, y: Double, z: Double = 0) {
            self.x = x
            self.y = y
            self.z = z
        }
    }
    
    struct GraphCluster: Codable, Identifiable {
        let id: String
        let label: String
        let nodeIds: [String]
        let centerPosition: GraphPosition
        let radius: Double
        let color: String
        
        init(id: String = UUID().uuidString, label: String, nodeIds: [String], centerPosition: GraphPosition, radius: Double, color: String = "#3B82F6") {
            self.id = id
            self.label = label
            self.nodeIds = nodeIds
            self.centerPosition = centerPosition
            self.radius = radius
            self.color = color
        }
    }
    
    struct GraphMetadata: Codable {
        let totalNodes: Int
        let totalEdges: Int
        let totalClusters: Int
        let graphDensity: Double
        let averageClusteringCoefficient: Double
        let lastProcessingTime: TimeInterval
        
        init(totalNodes: Int, totalEdges: Int, totalClusters: Int, graphDensity: Double = 0.0, averageClusteringCoefficient: Double = 0.0, lastProcessingTime: TimeInterval = 0.0) {
            self.totalNodes = totalNodes
            self.totalEdges = totalEdges
            self.totalClusters = totalClusters
            self.graphDensity = graphDensity
            self.averageClusteringCoefficient = averageClusteringCoefficient
            self.lastProcessingTime = lastProcessingTime
        }
    }
}

// MARK: - Agent Context Data
struct AgentContextData: Codable {
    let agents: [RealTimeAgent]
    let orchestration: OrchestrationData
    let swarmMetrics: SwarmMetrics
    
    struct RealTimeAgent: Codable, Identifiable {
        let id: String
        let name: String
        let type: String
        let status: AgentStatus
        let capabilities: [String]
        let performance: AgentPerformance
        let currentTask: String?
        let connections: [String]
        let specialization: AgentSpecialization
        
        init(id: String, name: String, type: String, status: AgentStatus, capabilities: [String], performance: AgentPerformance, currentTask: String? = nil, connections: [String] = [], specialization: AgentSpecialization = .general) {
            self.id = id
            self.name = name
            self.type = type
            self.status = status
            self.capabilities = capabilities
            self.performance = performance
            self.currentTask = currentTask
            self.connections = connections
            self.specialization = specialization
        }
    }
    
    struct AgentPerformance: Codable {
        let successRate: Double
        let averageResponseTime: TimeInterval
        let throughput: Double
        let reliability: Double
        let lastUpdated: Date
        
        init(successRate: Double = 0.0, averageResponseTime: TimeInterval = 0.0, throughput: Double = 0.0, reliability: Double = 0.0, lastUpdated: Date = Date()) {
            self.successRate = successRate
            self.averageResponseTime = averageResponseTime
            self.throughput = throughput
            self.reliability = reliability
            self.lastUpdated = lastUpdated
        }
    }
    
    enum AgentSpecialization: String, Codable, CaseIterable {
        case general = "general"
        case research = "research"
        case analysis = "analysis"
        case creative = "creative"
        case technical = "technical"
        case coordination = "coordination"
    }
    
    struct OrchestrationData: Codable {
        let coordinationMetrics: CoordinationMetrics
        let taskQueue: [OrchestrationTask]
        let resourceAllocation: ResourceAllocation
        
        struct CoordinationMetrics: Codable {
            let totalTasks: Int
            let activeTasks: Int
            let completedTasks: Int
            let failedTasks: Int
            let averageTaskTime: TimeInterval
            let coordinationEfficiency: Double
            
            init(totalTasks: Int = 0, activeTasks: Int = 0, completedTasks: Int = 0, failedTasks: Int = 0, averageTaskTime: TimeInterval = 0.0, coordinationEfficiency: Double = 0.0) {
                self.totalTasks = totalTasks
                self.activeTasks = activeTasks
                self.completedTasks = completedTasks
                self.failedTasks = failedTasks
                self.averageTaskTime = averageTaskTime
                self.coordinationEfficiency = coordinationEfficiency
            }
        }
        
        struct OrchestrationTask: Codable, Identifiable {
            let id: String
            let type: String
            let priority: TaskPriority
            let assignedAgents: [String]
            let status: TaskStatus
            let createdAt: Date
            let estimatedDuration: TimeInterval
            
            enum TaskPriority: String, Codable, CaseIterable {
                case low = "low"
                case normal = "normal"
                case high = "high"
                case urgent = "urgent"
            }
            
            init(id: String = UUID().uuidString, type: String, priority: TaskPriority = .normal, assignedAgents: [String] = [], status: TaskStatus = .pending, createdAt: Date = Date(), estimatedDuration: TimeInterval = 0.0) {
                self.id = id
                self.type = type
                self.priority = priority
                self.assignedAgents = assignedAgents
                self.status = status
                self.createdAt = createdAt
                self.estimatedDuration = estimatedDuration
            }
        }
        
        struct ResourceAllocation: Codable {
            let cpuUsage: Double
            let memoryUsage: Double
            let activeConnections: Int
            let queueDepth: Int
            
            init(cpuUsage: Double = 0.0, memoryUsage: Double = 0.0, activeConnections: Int = 0, queueDepth: Int = 0) {
                self.cpuUsage = cpuUsage
                self.memoryUsage = memoryUsage
                self.activeConnections = activeConnections
                self.queueDepth = queueDepth
            }
        }
    }
    
    struct SwarmMetrics: Codable {
        let totalAgents: Int
        let activeAgents: Int
        let swarmCoherence: Double
        let communicationEfficiency: Double
        let emergentBehaviors: [EmergentBehavior]
        
        struct EmergentBehavior: Codable, Identifiable {
            let id: String
            let type: String
            let description: String
            let strength: Double
            let participants: [String]
            
            init(id: String = UUID().uuidString, type: String, description: String, strength: Double, participants: [String]) {
                self.id = id
                self.type = type
                self.description = description
                self.strength = strength
                self.participants = participants
            }
        }
        
        init(totalAgents: Int = 0, activeAgents: Int = 0, swarmCoherence: Double = 0.0, communicationEfficiency: Double = 0.0, emergentBehaviors: [EmergentBehavior] = []) {
            self.totalAgents = totalAgents
            self.activeAgents = activeAgents
            self.swarmCoherence = swarmCoherence
            self.communicationEfficiency = communicationEfficiency
            self.emergentBehaviors = emergentBehaviors
        }
    }
}

// MARK: - Analytics Context Data
struct AnalyticsContextData: Codable {
    let performance: UnifiedPerformanceMetrics
    let usage: UsageMetrics
    let insights: AnalyticsInsights
    
    struct UnifiedPerformanceMetrics: Codable {
        let historical: [HistoricalDataPoint]
        let realTime: RealTimeMetrics
        let predictions: [PredictionDataPoint]
        
        struct HistoricalDataPoint: Codable, Identifiable {
            let id: String
            let timestamp: Date
            let cpu: Double
            let memory: Double
            let throughput: Double
            let latency: Double
            
            init(id: String = UUID().uuidString, timestamp: Date = Date(), cpu: Double, memory: Double, throughput: Double, latency: Double) {
                self.id = id
                self.timestamp = timestamp
                self.cpu = cpu
                self.memory = memory
                self.throughput = throughput
                self.latency = latency
            }
        }
        
        struct RealTimeMetrics: Codable {
            let cpu: Double
            let memory: Double
            let throughput: Double
            let latency: Double
            let activeConnections: Int
            let requestsPerSecond: Double
            let timestamp: Date
            
            init(cpu: Double = 0.0, memory: Double = 0.0, throughput: Double = 0.0, latency: Double = 0.0, activeConnections: Int = 0, requestsPerSecond: Double = 0.0, timestamp: Date = Date()) {
                self.cpu = cpu
                self.memory = memory
                self.throughput = throughput
                self.latency = latency
                self.activeConnections = activeConnections
                self.requestsPerSecond = requestsPerSecond
                self.timestamp = timestamp
            }
        }
        
        struct PredictionDataPoint: Codable, Identifiable {
            let id: String
            let timestamp: Date
            let metric: String
            let predictedValue: Double
            let confidence: Double
            
            init(id: String = UUID().uuidString, timestamp: Date, metric: String, predictedValue: Double, confidence: Double) {
                self.id = id
                self.timestamp = timestamp
                self.metric = metric
                self.predictedValue = predictedValue
                self.confidence = confidence
            }
        }
        
        init(historical: [HistoricalDataPoint] = [], realTime: RealTimeMetrics = RealTimeMetrics(), predictions: [PredictionDataPoint] = []) {
            self.historical = historical
            self.realTime = realTime
            self.predictions = predictions
        }
    }
    
    struct UsageMetrics: Codable {
        let sessionMetrics: SessionMetrics
        let featureUsage: [FeatureUsage]
        let userPatterns: [UserPattern]
        
        struct SessionMetrics: Codable {
            let totalSessions: Int
            let activeSessions: Int
            let averageSessionDuration: TimeInterval
            let peakConcurrency: Int
            let sessionGrowthRate: Double
            
            init(totalSessions: Int = 0, activeSessions: Int = 0, averageSessionDuration: TimeInterval = 0.0, peakConcurrency: Int = 0, sessionGrowthRate: Double = 0.0) {
                self.totalSessions = totalSessions
                self.activeSessions = activeSessions
                self.averageSessionDuration = averageSessionDuration
                self.peakConcurrency = peakConcurrency
                self.sessionGrowthRate = sessionGrowthRate
            }
        }
        
        struct FeatureUsage: Codable, Identifiable {
            let id: String
            let featureName: String
            let usageCount: Int
            let lastUsed: Date
            let popularity: Double
            
            init(id: String = UUID().uuidString, featureName: String, usageCount: Int, lastUsed: Date = Date(), popularity: Double = 0.0) {
                self.id = id
                self.featureName = featureName
                self.usageCount = usageCount
                self.lastUsed = lastUsed
                self.popularity = popularity
            }
        }
        
        struct UserPattern: Codable, Identifiable {
            let id: String
            let patternType: String
            let description: String
            let frequency: Double
            let confidence: Double
            
            init(id: String = UUID().uuidString, patternType: String, description: String, frequency: Double, confidence: Double) {
                self.id = id
                self.patternType = patternType
                self.description = description
                self.frequency = frequency
                self.confidence = confidence
            }
        }
        
        init(sessionMetrics: SessionMetrics = SessionMetrics(), featureUsage: [FeatureUsage] = [], userPatterns: [UserPattern] = []) {
            self.sessionMetrics = sessionMetrics
            self.featureUsage = featureUsage
            self.userPatterns = userPatterns
        }
    }
    
    struct AnalyticsInsights: Codable {
        let recommendations: [Recommendation]
        let anomalies: [Anomaly]
        let trends: [Trend]
        
        struct Recommendation: Codable, Identifiable {
            let id: String
            let type: String
            let title: String
            let description: String
            let priority: ContextPriority
            let impact: Double
            
            init(id: String = UUID().uuidString, type: String, title: String, description: String, priority: ContextPriority = .normal, impact: Double = 0.0) {
                self.id = id
                self.type = type
                self.title = title
                self.description = description
                self.priority = priority
                self.impact = impact
            }
        }
        
        struct Anomaly: Codable, Identifiable {
            let id: String
            let metric: String
            let description: String
            let severity: AnomalySeverity
            let detectedAt: Date
            let expectedValue: Double
            let actualValue: Double
            
            enum AnomalySeverity: String, Codable, CaseIterable {
                case low = "low"
                case medium = "medium"
                case high = "high"
                case critical = "critical"
            }
            
            init(id: String = UUID().uuidString, metric: String, description: String, severity: AnomalySeverity = .medium, detectedAt: Date = Date(), expectedValue: Double, actualValue: Double) {
                self.id = id
                self.metric = metric
                self.description = description
                self.severity = severity
                self.detectedAt = detectedAt
                self.expectedValue = expectedValue
                self.actualValue = actualValue
            }
        }
        
        struct Trend: Codable, Identifiable {
            let id: String
            let metric: String
            let direction: TrendDirection
            let strength: Double
            let timespan: TimeInterval
            
            enum TrendDirection: String, Codable, CaseIterable {
                case increasing = "increasing"
                case decreasing = "decreasing"
                case stable = "stable"
                case volatile = "volatile"
            }
            
            init(id: String = UUID().uuidString, metric: String, direction: TrendDirection, strength: Double, timespan: TimeInterval) {
                self.id = id
                self.metric = metric
                self.direction = direction
                self.strength = strength
                self.timespan = timespan
            }
        }
        
        init(recommendations: [Recommendation] = [], anomalies: [Anomaly] = [], trends: [Trend] = []) {
            self.recommendations = recommendations
            self.anomalies = anomalies
            self.trends = trends
        }
    }
    
    init(performance: UnifiedPerformanceMetrics = UnifiedPerformanceMetrics(), usage: UsageMetrics = UsageMetrics(), insights: AnalyticsInsights = AnalyticsInsights()) {
        self.performance = performance
        self.usage = usage
        self.insights = insights
    }
}

// MARK: - RAG Context Data
struct RAGContextData: Codable {
    let contextSources: [ContextSource]
    let retrievalMetrics: RetrievalMetrics
    let vectorSpace: VectorSpaceMetrics
    
    struct ContextSource: Codable, Identifiable {
        let id: String
        let type: SourceType
        let content: String
        let relevanceScore: Double
        let retrievalTime: TimeInterval
        let embedding: [Double]?
        
        enum SourceType: String, Codable, CaseIterable {
            case document = "document"
            case graph = "graph"
            case memory = "memory"
            case web = "web"
            case database = "database"
        }
        
        init(id: String = UUID().uuidString, type: SourceType, content: String, relevanceScore: Double, retrievalTime: TimeInterval = 0.0, embedding: [Double]? = nil) {
            self.id = id
            self.type = type
            self.content = content
            self.relevanceScore = relevanceScore
            self.retrievalTime = retrievalTime
            self.embedding = embedding
        }
    }
    
    struct RetrievalMetrics: Codable {
        let queryTime: TimeInterval
        let totalSources: Int
        let relevantSources: Int
        let averageRelevance: Double
        let precision: Double
        let recall: Double
        
        init(queryTime: TimeInterval = 0.0, totalSources: Int = 0, relevantSources: Int = 0, averageRelevance: Double = 0.0, precision: Double = 0.0, recall: Double = 0.0) {
            self.queryTime = queryTime
            self.totalSources = totalSources
            self.relevantSources = relevantSources
            self.averageRelevance = averageRelevance
            self.precision = precision
            self.recall = recall
        }
    }
    
    struct VectorSpaceMetrics: Codable {
        let dimensions: Int
        let indexSize: Int
        let searchLatency: TimeInterval
        let indexUtilization: Double
        
        init(dimensions: Int = 0, indexSize: Int = 0, searchLatency: TimeInterval = 0.0, indexUtilization: Double = 0.0) {
            self.dimensions = dimensions
            self.indexSize = indexSize
            self.searchLatency = searchLatency
            self.indexUtilization = indexUtilization
        }
    }
    
    init(contextSources: [ContextSource] = [], retrievalMetrics: RetrievalMetrics = RetrievalMetrics(), vectorSpace: VectorSpaceMetrics = VectorSpaceMetrics()) {
        self.contextSources = contextSources
        self.retrievalMetrics = retrievalMetrics
        self.vectorSpace = vectorSpace
    }
}

// MARK: - Data Transformation Utilities
struct DataTransformationUtils {
    static func transformForUI<T: Codable>(_ data: T) -> [String: Any] {
        do {
            let encoded = try JSONEncoder().encode(data)
            let json = try JSONSerialization.jsonObject(with: encoded) as? [String: Any]
            return json ?? [:]
        } catch {
            print("Failed to transform data for UI: \(error)")
            return [:]
        }
    }
    
    static func extractChartData(from metrics: AnalyticsContextData.UnifiedPerformanceMetrics) -> ChartData {
        let cpuData = metrics.historical.map { ChartDataPoint(x: $0.timestamp.timeIntervalSince1970, y: $0.cpu) }
        let memoryData = metrics.historical.map { ChartDataPoint(x: $0.timestamp.timeIntervalSince1970, y: $0.memory) }
        let throughputData = metrics.historical.map { ChartDataPoint(x: $0.timestamp.timeIntervalSince1970, y: $0.throughput) }
        
        return ChartData(
            cpu: cpuData,
            memory: memoryData,
            throughput: throughputData
        )
    }
    
    static func generateGraphLayout(from graphData: GraphContextData) -> GraphLayoutData {
        let positions = graphData.nodes.compactMap { node -> (String, GraphContextData.GraphPosition)? in
            guard let position = node.position else { return nil }
            return (node.id, position)
        }
        
        return GraphLayoutData(
            nodePositions: Dictionary(uniqueKeysWithValues: positions),
            clusters: graphData.clusters
        )
    }
}

// MARK: - Supporting Types for UI
struct ChartData {
    let cpu: [ChartDataPoint]
    let memory: [ChartDataPoint]
    let throughput: [ChartDataPoint]
}

struct GraphLayoutData {
    let nodePositions: [String: GraphContextData.GraphPosition]
    let clusters: [GraphContextData.GraphCluster]
}

// MARK: - Data Caching Strategy
class DataCache {
    private var cache: [String: CacheEntry] = [:]
    private let maxSize: Int
    private let defaultTTL: TimeInterval
    
    init(maxSize: Int = 1000, defaultTTL: TimeInterval = 300) {
        self.maxSize = maxSize
        self.defaultTTL = defaultTTL
    }
    
    func store<T: Codable>(_ data: T, key: String, ttl: TimeInterval? = nil) {
        let expiry = Date().addingTimeInterval(ttl ?? defaultTTL)
        let entry = CacheEntry(data: data, expiry: expiry)
        
        if cache.count >= maxSize {
            evictOldest()
        }
        
        cache[key] = entry
    }
    
    func retrieve<T: Codable>(_ type: T.Type, key: String) -> T? {
        guard let entry = cache[key],
              entry.expiry > Date(),
              let data = entry.data as? T else {
            cache.removeValue(forKey: key)
            return nil
        }
        
        return data
    }
    
    private func evictOldest() {
        let oldestKey = cache.min { $0.value.expiry < $1.value.expiry }?.key
        if let key = oldestKey {
            cache.removeValue(forKey: key)
        }
    }
    
    private struct CacheEntry {
        let data: Any
        let expiry: Date
    }
    
    func clear() {
        cache.removeAll()
    }
}

// MARK: - Cross-Component Data Sharing Protocol
protocol DataSharingDelegate: AnyObject {
    func dataDidUpdate(_ data: UnifiedContext)
    func dataUpdateFailed(_ error: Error)
}

// MARK: - Real-Time Event Types
enum RealTimeEvent: String, CaseIterable {
    case graphUpdate = "graph_update"
    case agentStatusChange = "agent_status_change"
    case metricsUpdate = "metrics_update"
    case ragUpdate = "rag_update"
    case systemAlert = "system_alert"
    case userAction = "user_action"
}

struct RealTimeEventData: Codable {
    let event: RealTimeEvent
    let timestamp: Date
    let data: Data
    let sessionId: String
    
    init(event: RealTimeEvent, data: Data, sessionId: String) {
        self.event = event
        self.timestamp = Date()
        self.data = data
        self.sessionId = sessionId
    }
}