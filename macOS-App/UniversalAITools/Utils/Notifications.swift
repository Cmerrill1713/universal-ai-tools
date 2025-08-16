import Foundation

extension Notification.Name {
    // MARK: - Connection Events
    static let backendConnected = Notification.Name("backendConnected")
    static let backendDisconnected = Notification.Name("backendDisconnected")
    static let websocketConnected = Notification.Name("websocketConnected")
    static let websocketDisconnected = Notification.Name("websocketDisconnected")
    
    // MARK: - System Events
    static let systemWillSleep = Notification.Name("systemWillSleep")
    static let systemDidWake = Notification.Name("systemDidWake")

    // MARK: - API / WebSocket Events
    static let agentUpdate = Notification.Name("agentUpdate")
    static let metricsUpdate = Notification.Name("metricsUpdate")
    static let chatResponse = Notification.Name("chatResponse")
    static let webAPIResponse = Notification.Name("webAPIResponse")

    // MARK: - Authentication Events
    static let authTokenChanged = Notification.Name("authTokenChanged")
    static let credentialsUpdated = Notification.Name("credentialsUpdated")

    // MARK: - MCP Events
    static let mcpResourceUpdated = Notification.Name("mcpResourceUpdated")
    static let mcpToolListChanged = Notification.Name("mcpToolListChanged")
    
    // MARK: - Voice Events
    static let voiceTranscriptionUpdate = Notification.Name("voiceTranscriptionUpdate")
    static let voiceSynthesisComplete = Notification.Name("voiceSynthesisComplete")
    static let voiceInteractionStarted = Notification.Name("voiceInteractionStarted")
    static let voiceInteractionEnded = Notification.Name("voiceInteractionEnded")
    
    // MARK: - Monitoring and Logging Events
    static let criticalMonitoringAlert = Notification.Name("criticalMonitoringAlert")
    static let monitoringStatusChanged = Notification.Name("monitoringStatusChanged")
    static let performanceMetricsUpdated = Notification.Name("performanceMetricsUpdated")
    static let healthCheckCompleted = Notification.Name("healthCheckCompleted")
    static let systemHealthChanged = Notification.Name("systemHealthChanged")
    
    // MARK: - Logging Events
    static let logLevelChanged = Notification.Name("logLevelChanged")
    static let logExported = Notification.Name("logExported")
    static let logStorageFull = Notification.Name("logStorageFull")
    static let remoteLoggingConnected = Notification.Name("remoteLoggingConnected")
    static let remoteLoggingDisconnected = Notification.Name("remoteLoggingDisconnected")
    
    // MARK: - Change Tracking Events
    static let changePatternDetected = Notification.Name("changePatternDetected")
    static let analyticsSnapshotUpdated = Notification.Name("analyticsSnapshotUpdated")
    static let featureUsageTracked = Notification.Name("featureUsageTracked")
    static let workflowCompleted = Notification.Name("workflowCompleted")
    static let userInteractionTracked = Notification.Name("userInteractionTracked")
    
    // MARK: - Failure Prevention Events
    static let failurePredicted = Notification.Name("failurePredicted")
    static let automaticRecoveryTriggered = Notification.Name("automaticRecoveryTriggered")
    static let recoveryCompleted = Notification.Name("recoveryCompleted")
    static let preventiveActionTaken = Notification.Name("preventiveActionTaken")
    static let healthTrendDetected = Notification.Name("healthTrendDetected")
    
    // MARK: - Performance Events
    static let memoryPressureHigh = Notification.Name("memoryPressureHigh")
    static let cpuUsageHigh = Notification.Name("cpuUsageHigh")
    static let diskSpaceLow = Notification.Name("diskSpaceLow")
    static let thermalStateChanged = Notification.Name("thermalStateChanged")
    static let batteryLevelLow = Notification.Name("batteryLevelLow")
    static let networkLatencyHigh = Notification.Name("networkLatencyHigh")
    
    // MARK: - Debug and Development Events
    static let debugModeToggled = Notification.Name("debugModeToggled")
    static let debugDataExported = Notification.Name("debugDataExported")
    static let debugConsoleOpened = Notification.Name("debugConsoleOpened")
    static let debugSettingsChanged = Notification.Name("debugSettingsChanged")
}

// MARK: - Notification Payload Keys
public struct NotificationPayloadKeys {
    // MARK: - Monitoring Payload Keys
    public static let alertData = "alertData"
    public static let healthStatus = "healthStatus"
    public static let metricsData = "metricsData"
    public static let checkResults = "checkResults"
    
    // MARK: - Logging Payload Keys
    public static let logLevel = "logLevel"
    public static let logCategory = "logCategory"
    public static let logData = "logData"
    public static let exportPath = "exportPath"
    public static let storageUsage = "storageUsage"
    
    // MARK: - Change Tracking Payload Keys
    public static let patternData = "patternData"
    public static let analyticsData = "analyticsData"
    public static let featureData = "featureData"
    public static let workflowData = "workflowData"
    public static let interactionData = "interactionData"
    
    // MARK: - Failure Prevention Payload Keys
    public static let predictionData = "predictionData"
    public static let recoveryData = "recoveryData"
    public static let actionData = "actionData"
    public static let trendData = "trendData"
    
    // MARK: - Performance Payload Keys
    public static let memoryUsage = "memoryUsage"
    public static let cpuUsage = "cpuUsage"
    public static let diskUsage = "diskUsage"
    public static let thermalState = "thermalState"
    public static let batteryLevel = "batteryLevel"
    public static let networkLatency = "networkLatency"
    
    // MARK: - Debug Payload Keys
    public static let debugMode = "debugMode"
    public static let exportData = "exportData"
    public static let settingsData = "settingsData"
}

// MARK: - Notification Helper Extensions
extension NotificationCenter {
    
    /// Post a monitoring alert notification
    public func postMonitoringAlert(_ alert: MonitoringAlert) {
        post(
            name: .criticalMonitoringAlert,
            object: nil,
            userInfo: [NotificationPayloadKeys.alertData: alert]
        )
    }
    
    /// Post a health status change notification
    public func postHealthStatusChange(_ status: HealthStatus) {
        post(
            name: .systemHealthChanged,
            object: nil,
            userInfo: [NotificationPayloadKeys.healthStatus: status.rawValue]
        )
    }
    
    /// Post a performance metrics update notification
    public func postPerformanceMetricsUpdate(_ metrics: PerformanceMetrics) {
        post(
            name: .performanceMetricsUpdated,
            object: nil,
            userInfo: [NotificationPayloadKeys.metricsData: metrics]
        )
    }
    
    /// Post a failure prediction notification
    public func postFailurePrediction(_ prediction: FailurePrediction) {
        post(
            name: .failurePredicted,
            object: nil,
            userInfo: [NotificationPayloadKeys.predictionData: prediction]
        )
    }
    
    /// Post a change pattern detection notification
    public func postChangePatternDetection(_ pattern: ChangePattern) {
        post(
            name: .changePatternDetected,
            object: nil,
            userInfo: [NotificationPayloadKeys.patternData: pattern]
        )
    }
    
    /// Post a log level change notification
    public func postLogLevelChange(_ level: LogLevel) {
        post(
            name: .logLevelChanged,
            object: nil,
            userInfo: [NotificationPayloadKeys.logLevel: level.rawValue]
        )
    }
    
    /// Post a debug mode toggle notification
    public func postDebugModeToggle(_ enabled: Bool) {
        post(
            name: .debugModeToggled,
            object: nil,
            userInfo: [NotificationPayloadKeys.debugMode: enabled]
        )
    }
}

// MARK: - Notification Observer Helper
public class NotificationObserverHelper: ObservableObject {
    private var observers: [NSObjectProtocol] = []
    
    public init() {}
    
    /// Add an observer for monitoring alerts
    public func observeMonitoringAlerts(_ handler: @escaping (MonitoringAlert) -> Void) {
        let observer = NotificationCenter.default.addObserver(
            forName: .criticalMonitoringAlert,
            object: nil,
            queue: .main
        ) { notification in
            if let alert = notification.userInfo?[NotificationPayloadKeys.alertData] as? MonitoringAlert {
                handler(alert)
            }
        }
        observers.append(observer)
    }
    
    /// Add an observer for health status changes
    public func observeHealthStatusChanges(_ handler: @escaping (String) -> Void) {
        let observer = NotificationCenter.default.addObserver(
            forName: .systemHealthChanged,
            object: nil,
            queue: .main
        ) { notification in
            if let status = notification.userInfo?[NotificationPayloadKeys.healthStatus] as? String {
                handler(status)
            }
        }
        observers.append(observer)
    }
    
    /// Add an observer for performance metrics updates
    public func observePerformanceMetrics(_ handler: @escaping (PerformanceMetrics) -> Void) {
        let observer = NotificationCenter.default.addObserver(
            forName: .performanceMetricsUpdated,
            object: nil,
            queue: .main
        ) { notification in
            if let metrics = notification.userInfo?[NotificationPayloadKeys.metricsData] as? PerformanceMetrics {
                handler(metrics)
            }
        }
        observers.append(observer)
    }
    
    /// Add an observer for failure predictions
    public func observeFailurePredictions(_ handler: @escaping (FailurePrediction) -> Void) {
        let observer = NotificationCenter.default.addObserver(
            forName: .failurePredicted,
            object: nil,
            queue: .main
        ) { notification in
            if let prediction = notification.userInfo?[NotificationPayloadKeys.predictionData] as? FailurePrediction {
                handler(prediction)
            }
        }
        observers.append(observer)
    }
    
    /// Add an observer for change pattern detections
    public func observeChangePatterns(_ handler: @escaping (ChangePattern) -> Void) {
        let observer = NotificationCenter.default.addObserver(
            forName: .changePatternDetected,
            object: nil,
            queue: .main
        ) { notification in
            if let pattern = notification.userInfo?[NotificationPayloadKeys.patternData] as? ChangePattern {
                handler(pattern)
            }
        }
        observers.append(observer)
    }
    
    /// Add an observer for debug mode changes
    public func observeDebugModeChanges(_ handler: @escaping (Bool) -> Void) {
        let observer = NotificationCenter.default.addObserver(
            forName: .debugModeToggled,
            object: nil,
            queue: .main
        ) { notification in
            if let enabled = notification.userInfo?[NotificationPayloadKeys.debugMode] as? Bool {
                handler(enabled)
            }
        }
        observers.append(observer)
    }
    
    /// Remove all observers
    public func removeAllObservers() {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers.removeAll()
    }
    
    deinit {
        removeAllObservers()
    }
}
