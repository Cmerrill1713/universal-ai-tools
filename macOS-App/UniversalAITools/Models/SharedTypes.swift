import Foundation
import SwiftUI


// MARK: - Content Type (Unified)
enum ContentType: String, CaseIterable, Codable, Identifiable {
    // Search/Filter content types
    case chat = "chat"
    case visualization = "visualization" 
    case data = "data"
    case workflow = "workflow"
    case setting = "setting"
    
    // Performance content types
    case images = "images"
    case videos = "videos"
    case documents = "documents"
    
    var id: String { rawValue }
    
    public var displayName: String {
        switch self {
        case .chat: return "Chat"
        case .visualization: return "Visualization"
        case .data: return "Data"
        case .workflow: return "Workflow"
        case .setting: return "Setting"
        case .images: return "Images"
        case .videos: return "Videos"
        case .documents: return "Documents"
        }
    }
    
    var icon: String {
        switch self {
        case .chat: return "text.bubble"
        case .visualization: return "chart.bar"
        case .data: return "tablecells"
        case .workflow: return "arrow.triangle.branch"
        case .setting: return "gear"
        case .images: return "photo"
        case .videos: return "video"
        case .documents: return "doc.text"
        }
    }
}

// MARK: - View Navigation Mode (Unified)
enum ViewNavigationMode: String, CaseIterable, Codable {
    case standard = "standard"
    case orbit = "orbit"
    case free = "free"
    case guided = "guided"
    
    public var displayName: String {
        switch self {
        case .standard: return "Standard"
        case .orbit: return "Orbit"
        case .free: return "Free Navigation"
        case .guided: return "Guided"
        }
    }
    
    var icon: String {
        switch self {
        case .standard: return "arrow.up.down.and.arrow.left.right"
        case .orbit: return "rotate.3d"
        case .free: return "hand.draw"
        case .guided: return "map"
        }
    }
}

// MARK: - Memory Pressure Level (Unified)
public enum MemoryPressureLevel: String, CaseIterable, Codable {
    case normal = "normal"
    case warning = "warning"
    case high = "high"
    case critical = "critical"
    
    public var displayName: String {
        switch self {
        case .normal: return "Normal"
        case .warning: return "Warning"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }
    
    public var color: Color {
        switch self {
        case .normal: return .green
        case .warning: return .orange
        case .high: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - JSON Value Helper
enum JSONValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null
    
    var value: Any {
        switch self {
        case .string(let str): return str
        case .int(let num): return num
        case .double(let num): return num
        case .bool(let bool): return bool
        case .object(let dict): return dict.mapValues { $0.value }
        case .array(let arr): return arr.map { $0.value }
        case .null: return NSNull()
        }
    }
    
    init(from value: Any) {
        if let str = value as? String {
            self = .string(str)
        } else if let num = value as? Int {
            self = .int(num)
        } else if let num = value as? Double {
            self = .double(num)
        } else if let bool = value as? Bool {
            self = .bool(bool)
        } else if let dict = value as? [String: Any] {
            self = .object(dict.mapValues { JSONValue(from: $0) })
        } else if let arr = value as? [Any] {
            self = .array(arr.map { JSONValue(from: $0) })
        } else {
            self = .null
        }
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) {
            self = .string(str)
        } else if let num = try? container.decode(Int.self) {
            self = .int(num)
        } else if let num = try? container.decode(Double.self) {
            self = .double(num)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let dict = try? container.decode([String: JSONValue].self) {
            self = .object(dict)
        } else if let arr = try? container.decode([JSONValue].self) {
            self = .array(arr)
        } else if container.decodeNil() {
            self = .null
        } else {
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Invalid JSON value"))
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let str): try container.encode(str)
        case .int(let num): try container.encode(num)
        case .double(let num): try container.encode(num)
        case .bool(let bool): try container.encode(bool)
        case .object(let dict): try container.encode(dict)
        case .array(let arr): try container.encode(arr)
        case .null: try container.encodeNil()
        }
    }
}

// MARK: - WebSocket Message (Unified)
struct WebSocketMessage: Codable {
    let type: String
    let data: [String: Any]
    
    enum CodingKeys: String, CodingKey {
        case type
        case data
    }
    
    init(type: String, data: [String: Any]) {
        self.type = type
        self.data = data
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        
        // Be resilient: accept either a dictionary payload or any JSON value
        if let dataDict = try? container.decode([String: JSONValue].self, forKey: .data) {
            data = dataDict.mapValues { $0.value }
        } else {
            data = [:]
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        
        // Convert data to JSONValue for encoding
        let jsonData = data.mapValues { JSONValue(from: $0) }
        try container.encode(jsonData, forKey: .data)
    }
}

// MARK: - Connection Status (Unified)
enum ConnectionStatus: String, CaseIterable, Codable {
    case connected = "connected"
    case connecting = "connecting"
    case disconnected = "disconnected"
    case reconnecting = "reconnecting"
    case disconnecting = "disconnecting"
    case failed = "failed"
    case error = "error"
    
    public var displayName: String {
        switch self {
        case .connected: return "Connected"
        case .connecting: return "Connecting"
        case .disconnected: return "Disconnected"
        case .reconnecting: return "Reconnecting"
        case .disconnecting: return "Disconnecting"
        case .failed: return "Failed"
        case .error: return "Error"
        }
    }
    
    public var color: Color {
        switch self {
        case .connected: return .green
        case .connecting: return .orange
        case .disconnected: return .gray
        case .reconnecting: return .orange
        case .disconnecting: return .yellow
        case .failed: return .red
        case .error: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .connected: return "wifi"
        case .connecting: return "wifi.slash"
        case .disconnected: return "wifi.exclamationmark"
        case .reconnecting: return "arrow.clockwise"
        case .disconnecting: return "arrow.down.circle"
        case .failed: return "xmark.circle"
        case .error: return "xmark.circle"
        }
    }
}

// Note: AgentStatus moved to Agent.swift to avoid conflicts

// Note: ChartDataPoint moved to ChartDataPoint.swift to avoid conflicts

// MARK: - Accessibility Role (for compatibility)
enum AccessibilityRole: String, CaseIterable {
    case button = "button"
    case chart = "chart"
    case image = "image"
    case text = "text"
    case list = "list"
    case tab = "tab"
    case header = "header"
}

// MARK: - Optimization Priority (Unified)
enum OptimizationPriority: String, CaseIterable, Codable {
    case low = "low"
    case medium = "medium" 
    case high = "high"
    case critical = "critical"
    
    public var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }
    
    public var color: Color {
        switch self {
        case .low: return .gray
        case .medium: return .blue
        case .high: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - Performance Trend Direction (Unified)
public enum PerformanceTrendDirection: String, CaseIterable, Codable {
    case improving = "improving"
    case stable = "stable"
    case declining = "declining"
    case neutral = "neutral"
    
    public var displayName: String {
        switch self {
        case .improving: return "Improving"
        case .stable: return "Stable"
        case .declining: return "Declining"
        case .neutral: return "Neutral"
        }
    }
    
    public var color: Color {
        switch self {
        case .improving: return .green
        case .stable: return .blue
        case .declining: return .red
        case .neutral: return .gray
        }
    }
    
    public var icon: String {
        switch self {
        case .improving: return "arrow.up.right"
        case .stable: return "arrow.right"
        case .declining: return "arrow.down.right"
        case .neutral: return "minus"
        }
    }
}

// MARK: - Analytics Time Range (Unified)
enum AnalyticsTimeRange: String, CaseIterable, Codable {
    case lastHour = "1h"
    case last24Hours = "24h"
    case lastWeek = "7d"
    case lastMonth = "30d"
    case lastYear = "1y"
    
    public var displayName: String {
        switch self {
        case .lastHour: return "Last Hour"
        case .last24Hours: return "Last 24 Hours"
        case .lastWeek: return "Last Week"
        case .lastMonth: return "Last Month"
        case .lastYear: return "Last Year"
        }
    }
    
    var duration: TimeInterval {
        switch self {
        case .lastHour: return 3600
        case .last24Hours: return 86400
        case .lastWeek: return 604800
        case .lastMonth: return 2592000
        case .lastYear: return 31536000
        }
    }
}

// MARK: - Task History
struct TaskHistory: Identifiable, Codable, Hashable {
    let id: UUID
    let name: String
    let description: String
    let status: TaskStatus
    let startTime: Date
    let endTime: Date?
    let duration: TimeInterval?
    let agentId: String?
    let result: String?
    
    init(
        id: UUID = UUID(),
        name: String,
        description: String = "",
        status: TaskStatus = .pending,
        startTime: Date = Date(),
        endTime: Date? = nil,
        agentId: String? = nil,
        result: String? = nil
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.status = status
        self.startTime = startTime
        self.endTime = endTime
        self.duration = endTime?.timeIntervalSince(startTime)
        self.agentId = agentId
        self.result = result
    }
}

// MARK: - Task Status
enum TaskStatus: String, CaseIterable, Codable {
    case pending = "pending"
    case running = "running"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
    
    public var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .running: return "Running"
        case .completed: return "Completed"
        case .failed: return "Failed"
        case .cancelled: return "Cancelled"
        }
    }
    
    public var color: Color {
        switch self {
        case .pending: return .gray
        case .running: return .blue
        case .completed: return .green
        case .failed: return .red
        case .cancelled: return .orange
        }
    }
    
    var icon: String {
        switch self {
        case .pending: return "clock"
        case .running: return "arrow.clockwise"
        case .completed: return "checkmark.circle"
        case .failed: return "xmark.circle"
        case .cancelled: return "stop.circle"
        }
    }
}

// MARK: - Health Status is defined in HealthTypes.swift

// MARK: - Alert Severity (Unified)
public enum AlertSeverity: String, CaseIterable, Codable {
    case info = "info"
    case warning = "warning"
    case error = "error"
    case critical = "critical"
    
    public var color: Color {
        switch self {
        case .info: return .blue
        case .warning: return .orange
        case .error: return .red
        case .critical: return .red
        }
    }
    
    public var icon: String {
        switch self {
        case .info: return "info.circle"
        case .warning: return "exclamationmark.triangle"
        case .error: return "xmark.circle"
        case .critical: return "exclamationmark.octagon"
        }
    }
    
    public var displayName: String {
        switch self {
        case .info: return "Info"
        case .warning: return "Warning"
        case .error: return "Error"
        case .critical: return "Critical"
        }
    }
}

// MARK: - Failure Type (Unified)
public enum FailureType: String, CaseIterable, Codable {
    case memoryExhaustion = "memory_exhaustion"
    case diskSpaceLow = "disk_space_low"
    case networkDisconnection = "network_disconnection"
    case cpuOverload = "cpu_overload"
    case serviceTimeout = "service_timeout"
    case databaseError = "database_error"
    case authenticationFailure = "authentication_failure"
    case unknown = "unknown"
    
    public var displayName: String {
        switch self {
        case .memoryExhaustion: return "Memory Exhaustion"
        case .diskSpaceLow: return "Low Disk Space"
        case .networkDisconnection: return "Network Disconnection"
        case .cpuOverload: return "CPU Overload"
        case .serviceTimeout: return "Service Timeout"
        case .databaseError: return "Database Error"
        case .authenticationFailure: return "Authentication Failure"
        case .unknown: return "Unknown"
        }
    }
    
    public var severity: AlertSeverity {
        switch self {
        case .memoryExhaustion, .cpuOverload: return .critical
        case .diskSpaceLow, .serviceTimeout: return .warning
        case .networkDisconnection, .databaseError, .authenticationFailure: return .error
        case .unknown: return .info
        }
    }
}

// MARK: - Health Status (Unified)
public enum HealthStatus: String, Codable, CaseIterable {
    case healthy = "healthy"
    case warning = "warning"
    case critical = "critical"
    case unknown = "unknown"
    
    public var displayName: String {
        switch self {
        case .healthy: return "Healthy"
        case .warning: return "Warning"
        case .critical: return "Critical"
        case .unknown: return "Unknown"
        }
    }
    
    public var color: Color {
        switch self {
        case .healthy: return .green
        case .warning: return .orange
        case .critical: return .red
        case .unknown: return .gray
        }
    }
}

// MARK: - Analytics Snapshot (Unified)
public struct AnalyticsSnapshot: Codable {
    public let timestamp: Date
    public let metrics: [String: Double]
    public let events: [String]
    public let healthStatus: HealthStatus
    public let sessionDuration: TimeInterval
    public let eventCounts: [String: Int]
    
    public init(
        timestamp: Date = Date(),
        metrics: [String: Double] = [:],
        events: [String] = [],
        healthStatus: HealthStatus = .unknown,
        sessionDuration: TimeInterval = 0,
        eventCounts: [String: Int] = [:]
    ) {
        self.timestamp = timestamp
        self.metrics = metrics
        self.events = events
        self.healthStatus = healthStatus
        self.sessionDuration = sessionDuration
        self.eventCounts = eventCounts
    }
}

// MARK: - Change Event Type (Unified)
public enum ChangeEventType: String, CaseIterable, Codable {
    case userInteraction = "user_interaction"
    case stateChange = "state_change"
    case systemEvent = "system_event"
    case navigation = "navigation"
    case apiCall = "api_call"
    case error = "error"
    case performance = "performance"
    case featureUsage = "feature_usage"
    case workflowStep = "workflow_step"
    case performanceEvent = "performance_event"
    case errorEvent = "error_event"
}

// MARK: - Change Event (Unified)
public struct ChangeEvent: Identifiable, Codable {
    public let id: UUID
    public let type: ChangeEventType
    public let description: String
    public let timestamp: Date
    public let metadata: [String: String]
    public let source: String
    public let action: String
    
    public init(
        id: UUID = UUID(),
        type: ChangeEventType,
        description: String,
        timestamp: Date = Date(),
        metadata: [String: String] = [:],
        source: String = "",
        action: String = ""
    ) {
        self.id = id
        self.type = type
        self.description = description
        self.timestamp = timestamp
        self.metadata = metadata
        self.source = source
        self.action = action
    }
}

// MARK: - Change Pattern (Unified)
public struct ChangePattern: Codable {
    public let pattern: String
    public let frequency: Int
    public let confidence: Double
    public let lastSeen: Date
    
    public init(
        pattern: String,
        frequency: Int,
        confidence: Double,
        lastSeen: Date = Date()
    ) {
        self.pattern = pattern
        self.frequency = frequency
        self.confidence = confidence
        self.lastSeen = lastSeen
    }
}

// MARK: - Health Trend (Unified)
public struct HealthTrend: Codable {
    public let metric: String
    public let direction: PerformanceTrendDirection
    public let changeRate: Double
    public let period: TimeInterval
    public let confidence: Double
    
    public init(
        metric: String,
        direction: PerformanceTrendDirection,
        changeRate: Double,
        period: TimeInterval,
        confidence: Double
    ) {
        self.metric = metric
        self.direction = direction
        self.changeRate = changeRate
        self.period = period
        self.confidence = confidence
    }
}

// MARK: - Sync Status (Unified)
public enum SyncStatus: String, CaseIterable, Codable {
    case idle = "idle"
    case connecting = "connecting"
    case connected = "connected"
    case syncing = "syncing"
    case synced = "synced"
    case error = "error"
    case disconnected = "disconnected"
    case paused = "paused"
    
    public var color: Color {
        switch self {
        case .idle: return .gray
        case .connecting: return .yellow
        case .connected: return .green
        case .syncing: return .blue
        case .synced: return .green
        case .error: return .red
        case .disconnected: return .red
        case .paused: return .orange
        }
    }
    
    public var icon: String {
        switch self {
        case .idle: return "pause.circle"
        case .connecting: return "wifi.circle"
        case .connected: return "checkmark.circle"
        case .syncing: return "arrow.triangle.2.circlepath"
        case .synced: return "checkmark.circle.fill"
        case .error: return "xmark.circle"
        case .disconnected: return "wifi.slash"
        case .paused: return "pause.circle.fill"
        }
    }
}

// MARK: - Failure Prediction (Unified)
public struct FailurePrediction: Identifiable, Codable {
    public let id: UUID
    public let failureType: FailureType
    public let severity: AlertSeverity
    public let confidence: Double
    public let timeToFailure: TimeInterval?
    public let indicators: [String]
    public let recommendedActions: [String]
    public let timestamp: Date
    
    public init(
        id: UUID = UUID(),
        failureType: FailureType,
        severity: AlertSeverity,
        confidence: Double,
        timeToFailure: TimeInterval? = nil,
        indicators: [String] = [],
        recommendedActions: [String] = [],
        timestamp: Date = Date()
    ) {
        self.id = id
        self.failureType = failureType
        self.severity = severity
        self.confidence = confidence
        self.timeToFailure = timeToFailure
        self.indicators = indicators
        self.recommendedActions = recommendedActions
        self.timestamp = timestamp
    }
}

// MARK: - Objective
struct Objective: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var description: String
    var type: ObjectiveType
    var status: ObjectiveStatus
    var priority: Priority
    let createdAt: Date
    var updatedAt: Date
    var dueDate: Date?
    var progress: Double // 0.0 to 1.0
    var tags: [String]
    
    init(
        id: UUID = UUID(),
        title: String,
        description: String = "",
        type: ObjectiveType = .task,
        status: ObjectiveStatus = .active,
        priority: Priority = .medium,
        dueDate: Date? = nil,
        progress: Double = 0.0,
        tags: [String] = []
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.type = type
        self.status = status
        self.priority = priority
        self.createdAt = Date()
        self.updatedAt = Date()
        self.dueDate = dueDate
        self.progress = progress
        self.tags = tags
    }
}

// MARK: - Objective Supporting Types
enum ObjectiveStatus: String, Codable, CaseIterable {
    case planning = "planning"
    case active = "active"
    case paused = "paused"
    case completed = "completed"
    case cancelled = "cancelled"
    
    public var displayName: String {
        switch self {
        case .planning: return "Planning"
        case .active: return "Active"
        case .paused: return "Paused"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }
    
    public var color: Color {
        switch self {
        case .planning: return .purple
        case .active: return .blue
        case .paused: return .orange
        case .completed: return .green
        case .cancelled: return .red
        }
    }
}

enum ObjectiveType: String, Codable, CaseIterable {
    case task = "task"
    case goal = "goal"
    case milestone = "milestone"
    case research = "research"
    case maintenance = "maintenance"
    case optimization = "optimization"
    
    public var displayName: String {
        switch self {
        case .task: return "Task"
        case .goal: return "Goal"
        case .milestone: return "Milestone"
        case .research: return "Research"
        case .maintenance: return "Maintenance"
        case .optimization: return "Optimization"
        }
    }
    
    var icon: String {
        switch self {
        case .task: return "checkmark.circle"
        case .goal: return "target"
        case .milestone: return "flag"
        case .research: return "magnifyingglass"
        case .maintenance: return "wrench"
        case .optimization: return "speedometer"
        }
    }
}

// MARK: - Tool Category (Defined in SidebarItem.swift)
// ToolCategory is defined in SidebarItem.swift with comprehensive cases specific to this app

// MARK: - Priority
enum Priority: String, CaseIterable, Identifiable, Codable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case critical = "critical"
    
    var id: String { rawValue }
    
    public var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }
    
    public var color: Color {
        switch self {
        case .low: return .gray
        case .medium: return .blue
        case .high: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - System Performance Metrics (Unified)
public struct SystemPerformanceMetrics: Codable {
    public let cpuUsage: Double
    public let memoryUsage: Double
    public let diskUsage: Double
    public let networkLatency: Double
    public let activeConnections: Int
    public let uptime: TimeInterval
    public let timestamp: Date
    
    public init(
        cpuUsage: Double,
        memoryUsage: Double,
        diskUsage: Double,
        networkLatency: Double,
        activeConnections: Int,
        uptime: TimeInterval,
        timestamp: Date = Date()
    ) {
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.diskUsage = diskUsage
        self.networkLatency = networkLatency
        self.activeConnections = activeConnections
        self.uptime = uptime
        self.timestamp = timestamp
    }
}

// MARK: - Monitoring Alert (Unified)
public struct MonitoringAlert: Identifiable, Codable {
    public let id: UUID
    public let title: String
    public let message: String
    public let severity: AlertSeverity
    public let timestamp: Date
    public let source: String
    public let isResolved: Bool
    
    public init(
        id: UUID = UUID(),
        title: String,
        message: String,
        severity: AlertSeverity,
        timestamp: Date = Date(),
        source: String = "System",
        isResolved: Bool = false
    ) {
        self.id = id
        self.title = title
        self.message = message
        self.severity = severity
        self.timestamp = timestamp
        self.source = source
        self.isResolved = isResolved
    }
}
