import Foundation
import SwiftUI

// MARK: - Log Level
public enum LogLevel: Int, CaseIterable, Codable {
    case debug = 0
    case info = 1
    case warning = 2
    case error = 3
    case critical = 4
    
    public var description: String {
        switch self {
        case .debug: return "Debug"
        case .info: return "Info"
        case .warning: return "Warning"
        case .error: return "Error"
        case .critical: return "Critical"
        }
    }
    
    public var emoji: String {
        switch self {
        case .debug: return "🔍"
        case .info: return "ℹ️"
        case .warning: return "⚠️"
        case .error: return "❌"
        case .critical: return "🚨"
        }
    }
    
    public var color: Color {
        switch self {
        case .debug: return .blue
        case .info: return .primary
        case .warning: return .orange
        case .error: return .red
        case .critical: return .purple
        }
    }
}

// MARK: - Log Category
public enum LogCategory: String, CaseIterable, Codable {
    case app = "app"
    case network = "network"
    case errors = "errors"
    case performance = "performance"
    case security = "security"
    case monitoring = "monitoring"
    case voice = "voice"
    case conversation = "conversation"
    case agent = "agent"
    case ui = "ui"
    case integration = "integration"
    case backup = "backup"
    
    public var displayName: String {
        switch self {
        case .app: return "Application"
        case .network: return "Network"
        case .errors: return "Errors"
        case .performance: return "Performance"
        case .security: return "Security"
        case .monitoring: return "Monitoring"
        case .voice: return "Voice"
        case .conversation: return "Conversation"
        case .agent: return "Agent"
        case .ui: return "User Interface"
        case .integration: return "Integration"
        case .backup: return "Backup"
        }
    }
    
    public var color: Color {
        switch self {
        case .app: return .blue
        case .network: return .green
        case .errors: return .red
        case .performance: return .orange
        case .security: return .purple
        case .monitoring: return .cyan
        case .voice: return .mint
        case .conversation: return .indigo
        case .agent: return .teal
        case .ui: return .pink
        case .integration: return .yellow
        case .backup: return .brown
        }
    }
}

// MARK: - Log Entry
public struct LogEntry: Identifiable, Codable {
    public let id: UUID
    public let timestamp: Date
    public let level: LogLevel
    public let category: LogCategory
    public let message: String
    public let file: String
    public let line: Int
    public let function: String
    public let metadata: [String: String]
    
    public init(
        id: UUID = UUID(),
        timestamp: Date = Date(),
        level: LogLevel,
        category: LogCategory,
        message: String,
        file: String = #file,
        line: Int = #line,
        function: String = #function,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.timestamp = timestamp
        self.level = level
        self.category = category
        self.message = message
        self.file = URL(fileURLWithPath: file).lastPathComponent
        self.line = line
        self.function = function
        self.metadata = metadata
    }
    
    // MARK: - Helper Properties
    public var detailedMessage: String {
        let timestamp = ISO8601DateFormatter().string(from: self.timestamp)
        let metadataString = metadata.isEmpty ? "" : " | \(metadata.map { "\($0.key)=\($0.value)" }.joined(separator: ", "))"
        return "[\(timestamp)] \(level.emoji) [\(category.displayName)] \(message) (\(file):\(line) in \(function))\(metadataString)"
    }
}

// MARK: - Health Check Result
public struct HealthCheckResult: Identifiable, Codable {
    public let id: UUID
    public let name: String
    public let status: HealthCheckStatus
    public let message: String
    public let duration: TimeInterval
    public let category: String
    public let timestamp: Date
    public let details: [String: String]
    
    public init(
        id: UUID = UUID(),
        name: String,
        status: HealthCheckStatus,
        message: String,
        duration: TimeInterval,
        category: String,
        timestamp: Date = Date(),
        details: [String: String] = [:]
    ) {
        self.id = id
        self.name = name
        self.status = status
        self.message = message
        self.duration = duration
        self.category = category
        self.timestamp = timestamp
        self.details = details
    }
}

// MARK: - Health Status
public enum HealthStatus: String, Codable, CaseIterable {
    case healthy = "healthy"
    case warning = "warning"
    case critical = "critical"
    case unknown = "unknown"
    
    public var color: Color {
        switch self {
        case .healthy: return .green
        case .warning: return .orange
        case .critical: return .red
        case .unknown: return .gray
        }
    }
    
    public var icon: String {
        switch self {
        case .healthy: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .critical: return "xmark.circle.fill"
        case .unknown: return "questionmark.circle.fill"
        }
    }
}

// MARK: - Health Check Status
public enum HealthCheckStatus: String, CaseIterable, Codable {
    case passed = "passed"
    case warning = "warning"
    case failed = "failed"
    case error = "error"
    
    public var icon: String {
        switch self {
        case .passed: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .failed: return "xmark.circle.fill"
        case .error: return "exclamationmark.octagon.fill"
        }
    }
    
    public var color: Color {
        switch self {
        case .passed: return .green
        case .warning: return .orange
        case .failed: return .red
        case .error: return .purple
        }
    }
}

// MARK: - Performance Metrics
public struct PerformanceMetrics: Codable {
    public let cpuUsage: Double
    public let memoryUsage: Double
    public let diskSpace: DiskSpaceInfo
    public let thermalState: ThermalState
    public let powerSourceState: PowerSourceState
    public let batteryLevel: Double?
    public let memoryPressure: MemoryPressureInfo
    public let networkStats: NetworkStatistics
    public let timestamp: Date
    
    public init(
        cpuUsage: Double,
        memoryUsage: Double,
        diskSpace: DiskSpaceInfo,
        thermalState: ThermalState = .nominal,
        powerSourceState: PowerSourceState = .unknown,
        batteryLevel: Double? = nil,
        memoryPressure: MemoryPressureInfo,
        networkStats: NetworkStatistics,
        timestamp: Date = Date()
    ) {
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.diskSpace = diskSpace
        self.thermalState = thermalState
        self.powerSourceState = powerSourceState
        self.batteryLevel = batteryLevel
        self.memoryPressure = memoryPressure
        self.networkStats = networkStats
        self.timestamp = timestamp
    }
    
    // MARK: - Nested Types
    public enum ThermalState: String, CaseIterable, Codable {
        case nominal = "nominal"
        case fair = "fair"
        case serious = "serious"
        case critical = "critical"
    }
    
    public enum PowerSourceState: String, CaseIterable, Codable {
        case battery = "battery"
        case acPower = "ac_power"
        case unknown = "unknown"
    }
}

// MARK: - Disk Space Info
public struct DiskSpaceInfo: Codable {
    public let total: UInt64
    public let used: UInt64
    public let available: UInt64
    
    public var usagePercentage: Double {
        guard total > 0 else { return 0.0 }
        return Double(used) / Double(total) * 100.0
    }
    
    public init(total: UInt64, used: UInt64, available: UInt64) {
        self.total = total
        self.used = used
        self.available = available
    }
}

// MARK: - Memory Pressure Info
public struct MemoryPressureInfo: Codable {
    public let level: String
    public let totalMemory: UInt64
    public let usedMemory: UInt64
    public let availableMemory: UInt64
    public let swapUsed: UInt64
    
    public init(
        level: String,
        totalMemory: UInt64,
        usedMemory: UInt64,
        availableMemory: UInt64,
        swapUsed: UInt64
    ) {
        self.level = level
        self.totalMemory = totalMemory
        self.usedMemory = usedMemory
        self.availableMemory = availableMemory
        self.swapUsed = swapUsed
    }
}

// MARK: - Network Statistics
public struct NetworkStatistics: Codable {
    public let bytesSent: UInt64
    public let bytesReceived: UInt64
    public let packetsSent: UInt64
    public let packetsReceived: UInt64
    public let latency: Double?
    
    public init(
        bytesSent: UInt64,
        bytesReceived: UInt64,
        packetsSent: UInt64,
        packetsReceived: UInt64,
        latency: Double? = nil
    ) {
        self.bytesSent = bytesSent
        self.bytesReceived = bytesReceived
        self.packetsSent = packetsSent
        self.packetsReceived = packetsReceived
        self.latency = latency
    }
}

// MARK: - Connection Health
public struct ConnectionHealth: Codable {
    public let backendStatus: ConnectionStatus
    public let websocketStatus: ConnectionStatus
    public let localLLMStatus: ConnectionStatus
    
    public init(
        backendStatus: ConnectionStatus,
        websocketStatus: ConnectionStatus,
        localLLMStatus: ConnectionStatus
    ) {
        self.backendStatus = backendStatus
        self.websocketStatus = websocketStatus
        self.localLLMStatus = localLLMStatus
    }
    
    // MARK: - Connection Status
    public struct ConnectionStatus: Codable {
        public let isConnected: Bool
        public let latency: Double?
        public let lastError: String?
        public let reconnectionCount: Int
        public let lastConnected: Date?
        
        public init(
            isConnected: Bool,
            latency: Double? = nil,
            lastError: String? = nil,
            reconnectionCount: Int = 0,
            lastConnected: Date? = nil
        ) {
            self.isConnected = isConnected
            self.latency = latency
            self.lastError = lastError
            self.reconnectionCount = reconnectionCount
            self.lastConnected = lastConnected
        }
    }
}

// MARK: - Monitoring Alert
public struct MonitoringAlert: Identifiable, Codable {
    public let id: UUID
    public let title: String
    public let message: String
    public let severity: AlertSeverity
    public let category: String
    public let timestamp: Date
    public let source: String
    public let metadata: [String: String]
    
    public init(
        id: UUID = UUID(),
        title: String,
        message: String,
        severity: AlertSeverity,
        category: String,
        timestamp: Date = Date(),
        source: String,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.title = title
        self.message = message
        self.severity = severity
        self.category = category
        self.timestamp = timestamp
        self.source = source
        self.metadata = metadata
    }
    
    // MARK: - Alert Severity
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
            case .critical: return .purple
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
    }
}

// MARK: - Analytics Snapshot
public struct AnalyticsSnapshot: Codable {
    public let sessionDuration: TimeInterval
    public let eventCounts: [String: Int]
    public let featureUsage: [String: FeatureUsage]
    public let mostUsedFeatures: [String]
    public let timestamp: Date
    
    public init(
        sessionDuration: TimeInterval,
        eventCounts: [String: Int],
        featureUsage: [String: FeatureUsage],
        mostUsedFeatures: [String],
        timestamp: Date = Date()
    ) {
        self.sessionDuration = sessionDuration
        self.eventCounts = eventCounts
        self.featureUsage = featureUsage
        self.mostUsedFeatures = mostUsedFeatures
        self.timestamp = timestamp
    }
}

// MARK: - Feature Usage
public struct FeatureUsage: Codable {
    public let usageCount: Int
    public let totalTime: TimeInterval
    public let lastUsed: Date
    public let averageSessionLength: TimeInterval
    
    public init(
        usageCount: Int,
        totalTime: TimeInterval,
        lastUsed: Date,
        averageSessionLength: TimeInterval
    ) {
        self.usageCount = usageCount
        self.totalTime = totalTime
        self.lastUsed = lastUsed
        self.averageSessionLength = averageSessionLength
    }
}

// MARK: - Change Event
public struct ChangeEvent: Identifiable, Codable {
    public let id: UUID
    public let type: ChangeEventType
    public let action: String
    public let source: String
    public let timestamp: Date
    public let oldValue: String?
    public let newValue: String?
    public let metadata: [String: String]
    
    public init(
        id: UUID = UUID(),
        type: ChangeEventType,
        action: String,
        source: String,
        timestamp: Date = Date(),
        oldValue: String? = nil,
        newValue: String? = nil,
        metadata: [String: String] = [:]
    ) {
        self.id = id
        self.type = type
        self.action = action
        self.source = source
        self.timestamp = timestamp
        self.oldValue = oldValue
        self.newValue = newValue
        self.metadata = metadata
    }
}

// MARK: - Change Event Type
public enum ChangeEventType: String, CaseIterable, Codable {
    case userInteraction = "user_interaction"
    case stateChange = "state_change"
    case systemEvent = "system_event"
    case navigation = "navigation"
    case apiCall = "api_call"
    case error = "error"
    case performance = "performance"
}

// MARK: - Change Pattern
public struct ChangePattern: Codable {
    public let name: String
    public let description: String
    public let confidence: Double
    public let occurrenceCount: Int
    public let lastDetected: Date?
    public let relatedEvents: [String]
    
    public init(
        name: String,
        description: String,
        confidence: Double,
        occurrenceCount: Int,
        lastDetected: Date? = nil,
        relatedEvents: [String] = []
    ) {
        self.name = name
        self.description = description
        self.confidence = confidence
        self.occurrenceCount = occurrenceCount
        self.lastDetected = lastDetected
        self.relatedEvents = relatedEvents
    }
}

// MARK: - Failure Prediction
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

// MARK: - Failure Type
public enum FailureType: String, CaseIterable, Codable {
    case memoryExhaustion = "memory_exhaustion"
    case diskSpaceLow = "disk_space_low"
    case networkDisconnection = "network_disconnection"
    case cpuOverload = "cpu_overload"
    case thermalThrottling = "thermal_throttling"
    case serviceUnavailable = "service_unavailable"
    case dataCorruption = "data_corruption"
    case configurationError = "configuration_error"
    
    public var description: String {
        switch self {
        case .memoryExhaustion: return "System running out of memory"
        case .diskSpaceLow: return "Low disk space detected"
        case .networkDisconnection: return "Network connectivity issues"
        case .cpuOverload: return "High CPU usage detected"
        case .thermalThrottling: return "System overheating"
        case .serviceUnavailable: return "External service unavailable"
        case .dataCorruption: return "Data integrity issues"
        case .configurationError: return "Configuration validation failed"
        }
    }
}

// MARK: - Health Trend
public struct HealthTrend: Codable {
    public let metric: String
    public let trend: TrendDirection
    public let severity: AlertSeverity
    public let values: [TrendValue]
    public let prediction: String?
    
    public init(
        metric: String,
        trend: TrendDirection,
        severity: AlertSeverity,
        values: [TrendValue],
        prediction: String? = nil
    ) {
        self.metric = metric
        self.trend = trend
        self.severity = severity
        self.values = values
        self.prediction = prediction
    }
    
    // MARK: - Trend Value
    public struct TrendValue: Codable {
        public let timestamp: Date
        public let value: Double
        
        public init(timestamp: Date, value: Double) {
            self.timestamp = timestamp
            self.value = value
        }
    }
    
    // MARK: - Trend Direction (for Health Trend)
    public enum TrendDirection: String, CaseIterable, Codable {
        case improving = "improving"
        case stable = "stable"
        case degrading = "degrading"
        case critical = "critical"
    }
}


// MARK: - Sync Status
public enum SyncStatus: String, CaseIterable, Codable {
    case idle = "idle"
    case connected = "connected"
    case syncing = "syncing"
    case error = "error"
    case disconnected = "disconnected"
    
    public var displayName: String {
        switch self {
        case .idle: return "Idle"
        case .connected: return "Connected"
        case .syncing: return "Syncing"
        case .error: return "Error"
        case .disconnected: return "Disconnected"
        }
    }
    
    public var color: Color {
        switch self {
        case .idle: return .gray
        case .connected: return .green
        case .syncing: return .blue
        case .error: return .red
        case .disconnected: return .orange
        }
    }
}

// MARK: - Endpoint Health
public struct EndpointHealth: Codable {
    public let isHealthy: Bool
    public let responseTime: Double
    public let errorCount: Int
    public let lastCheck: Date
    
    public init(
        isHealthy: Bool,
        responseTime: Double,
        errorCount: Int,
        lastCheck: Date = Date()
    ) {
        self.isHealthy = isHealthy
        self.responseTime = responseTime
        self.errorCount = errorCount
        self.lastCheck = lastCheck
    }
}

// MARK: - Time Range for Debug Tools
public enum TimeRange: String, CaseIterable {
    case all = "all"
    case lastHour = "1h"
    case last24Hours = "24h"
    case lastWeek = "7d"
    
    public var description: String {
        switch self {
        case .all: return "All Time"
        case .lastHour: return "Last Hour"
        case .last24Hours: return "Last 24 Hours"
        case .lastWeek: return "Last Week"
        }
    }
    
    public var timeInterval: TimeInterval {
        switch self {
        case .all: return .greatestFiniteMagnitude
        case .lastHour: return 3600
        case .last24Hours: return 86400
        case .lastWeek: return 604800
        }
    }
}