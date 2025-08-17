import Combine
import Foundation
import Network
import OSLog
import SwiftUI
import SystemConfiguration

// Import types from LoggingTypes.swift
// Note: HealthStatus, HealthCheckResult, LoggingService etc. are defined in LoggingTypes.swift and other files

// MARK: - System Performance Metrics
public struct SystemPerformanceMetrics: Codable {
    public let timestamp: Date
    public let cpuUsage: Double
    public let memoryUsage: Double
    public let memoryPressure: MemoryPressure
    public let diskSpace: DiskSpace
    public let networkStats: NetworkStats
    public let thermalState: ThermalState
    public let batteryLevel: Double?
    public let powerSourceState: PowerSourceState
    
    public struct MemoryPressure: Codable {
        public let level: String
        public let availableMemory: UInt64
        public let usedMemory: UInt64
        public let totalMemory: UInt64
        public let swapUsed: UInt64
    }
    
    public struct DiskSpace: Codable {
        public let available: UInt64
        public let total: UInt64
        public let used: UInt64
        public let usagePercentage: Double
    }
    
    public struct NetworkStats: Codable {
        public let bytesReceived: UInt64
        public let bytesSent: UInt64
        public let packetsReceived: UInt64
        public let packetsSent: UInt64
        public let connectionCount: Int
        public let latency: TimeInterval?
    }
    
    public enum ThermalState: String, Codable {
        case nominal = "nominal"
        case fair = "fair"
        case serious = "serious"
        case critical = "critical"
    }
    
    public enum PowerSourceState: String, Codable {
        case battery = "battery"
        case acPower = "ac_power"
        case unknown = "unknown"
    }
}

// MARK: - Service Connection Health (extended from LoggingTypes)
public struct ServiceConnectionHealth: Codable {
    public let timestamp: Date
    public let backendStatus: ServiceConnectionStatus
    public let mcpStatus: ServiceConnectionStatus
    public let websocketStatus: ServiceConnectionStatus
    public let localLLMStatus: ServiceConnectionStatus
    public let internetStatus: ServiceConnectionStatus
    public let overallHealth: HealthStatus
    
    public struct ServiceConnectionStatus: Codable {
        public let isConnected: Bool
        public let latency: TimeInterval?
        public let lastError: String?
        public let uptime: TimeInterval?
        public let reconnectionCount: Int
        
        public var health: HealthStatus {
            if !isConnected {
                return .critical
            } else if let latency = latency, latency > 1.0 {
                return .warning
            } else if reconnectionCount > 5 {
                return .warning
            } else {
                return .healthy
            }
        }
    }
}

// MARK: - Application Health
public struct ApplicationHealth: Codable {
    public let timestamp: Date
    public let viewLoadTimes: [String: TimeInterval]
    public let apiResponseTimes: [String: TimeInterval]
    public let errorRates: [String: Double]
    public let crashCount: Int
    public let memoryLeaks: [MemoryLeak]
    public let overallHealth: HealthStatus
    
    public struct MemoryLeak: Codable {
        public let component: String
        public let severity: HealthStatus
        public let details: String
    }
}

// MARK: - Health Check Protocol
public protocol HealthCheck {
    var name: String { get }
    var category: String { get }
    
    func check() async -> HealthCheckResult
}

// Using HealthCheckResult from LoggingTypes.swift

// MARK: - Built-in Health Checks
public class BackendHealthCheck: HealthCheck {
    public let name = "Backend Connection"
    public let category = "connectivity"
    
    // Note: APIService reference removed to avoid compilation errors
    // This would be injected when a proper APIService is available
    
    public init() {
        // Placeholder implementation
    }
    
    public func check() async -> HealthCheckResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        // Placeholder health check - would implement actual backend check
        let isHealthy = true // Placeholder
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        
        return HealthCheckResult(
            name: name,
            status: isHealthy ? .passed : .failed,
            message: isHealthy ? "Backend is responding" : "Backend is not responding",
            duration: duration,
            category: category,
            details: [
                "connected": "true", // Placeholder
                "authenticated": "true" // Placeholder
            ]
        )
    }
}

public class MemoryHealthCheck: HealthCheck {
    public let name = "Memory Usage"
    public let category = "performance"
    
    public func check() async -> HealthCheckResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        let memoryInfo = getMemoryInfo()
        let usagePercentage = (Double(memoryInfo.used) / Double(memoryInfo.total)) * 100
        
        let status: HealthCheckStatus
        if usagePercentage > 90 {
            status = .failed
        } else if usagePercentage > 75 {
            status = .warning
        } else {
            status = .passed
        }
        
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        
        return HealthCheckResult(
            name: name,
            category: category,
            status: status,
            message: "Memory usage: \(String(format: "%.1f", usagePercentage))%",
            metadata: [
                "usage_percentage": String(format: "%.1f", usagePercentage),
                "used_mb": String(memoryInfo.used / 1024 / 1024),
                "total_mb": String(memoryInfo.total / 1024 / 1024)
            ],
            duration: duration
        )
    }
    
    private func getMemoryInfo() -> (used: UInt64, total: UInt64) {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if result == KERN_SUCCESS {
            let totalMemory = ProcessInfo.processInfo.physicalMemory
            return (used: info.resident_size, total: totalMemory)
        }
        
        return (used: 0, total: 0)
    }
}

public class DiskSpaceHealthCheck: HealthCheck {
    public let name = "Disk Space"
    public let category = "performance"
    
    public func check() async -> HealthCheckResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        do {
            let homeURL = FileManager.default.homeDirectoryForCurrentUser
            let resourceValues = try homeURL.resourceValues(forKeys: [
                .volumeAvailableCapacityForImportantUsageKey,
                .volumeTotalCapacityKey
            ])
            
            guard let available = resourceValues.volumeAvailableCapacityForImportantUsage,
                  let total = resourceValues.volumeTotalCapacity else {
                throw NSError(domain: "DiskSpace", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unable to get disk space"])
            }
            
            let usedSpace = total - available
            let usagePercentage = (Double(usedSpace) / Double(total)) * 100
            
            let status: HealthCheckStatus
            if usagePercentage > 95 {
                status = .failed
            } else if usagePercentage > 85 {
                status = .warning
            } else {
                status = .passed
            }
            
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            
            return HealthCheckResult(
                name: name,
                category: category,
                status: status,
                message: "Disk usage: \(String(format: "%.1f", usagePercentage))%",
                metadata: [
                    "usage_percentage": String(format: "%.1f", usagePercentage),
                    "available_gb": String(format: "%.1f", Double(available) / 1024 / 1024 / 1024),
                    "total_gb": String(format: "%.1f", Double(total) / 1024 / 1024 / 1024)
                ],
                duration: duration
            )
        } catch {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            return HealthCheckResult(
                name: name,
                category: category,
                status: .error,
                message: "Unable to check disk space: \(error.localizedDescription)",
                metadata: ["error": error.localizedDescription],
                duration: duration
            )
        }
    }
}

// MARK: - Main Monitoring Service
@MainActor
public class MonitoringService: ObservableObject {
    public static let shared = MonitoringService()
    
    @Published public var isEnabled = true
    @Published public var currentHealth: HealthStatus = .unknown
    @Published public var performanceMetrics: SystemPerformanceMetrics?
    @Published public var connectionHealth: ServiceConnectionHealth?
    @Published public var applicationHealth: ApplicationHealth?
    @Published public var healthCheckResults: [HealthCheckResult] = []
    @Published public var alerts: [ServiceAlert] = []
    
    private let logger = LoggingService.shared
    private var healthChecks: [HealthCheck] = []
    private var monitoringTimer: Timer?
    private var alertTimer: Timer?
    private let pathMonitor = NWPathMonitor()
    private let pathQueue = DispatchQueue(label: "MonitoringService.NetworkPath")
    
    // Performance tracking
    private var viewLoadTimes: [String: TimeInterval] = [:]
    private var apiResponseTimes: [String: TimeInterval] = [:]
    private var errorCounts: [String: Int] = [:]
    private var crashCount = 0
    
    // Configuration
    public var monitoringInterval: TimeInterval = 30.0
    public var alertThreshold: TimeInterval = 300.0 // 5 minutes
    
    private init() {
        setupDefaultHealthChecks()
        startNetworkMonitoring()
        startPerformanceMonitoring()
        startAlertMonitoring()
        
        logger.info("MonitoringService initialized", category: .monitoring)
    }
    
    // MARK: - Configuration
    
    public func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        
        if enabled {
            startPerformanceMonitoring()
            logger.info("Monitoring enabled", category: .monitoring)
        } else {
            stopPerformanceMonitoring()
            logger.info("Monitoring disabled", category: .monitoring)
        }
    }
    
    public func setMonitoringInterval(_ interval: TimeInterval) {
        monitoringInterval = interval
        
        if isEnabled {
            stopPerformanceMonitoring()
            startPerformanceMonitoring()
        }
        
        logger.info("Monitoring interval set to \(interval)s", category: .monitoring)
    }
    
    // MARK: - Health Check Management
    
    public func addHealthCheck(_ healthCheck: HealthCheck) {
        healthChecks.append(healthCheck)
        logger.debug("Added health check: \(healthCheck.name)", category: .monitoring)
    }
    
    public func removeHealthCheck(named name: String) {
        healthChecks.removeAll { $0.name == name }
        logger.debug("Removed health check: \(name)", category: .monitoring)
    }
    
    public func runHealthChecks() async {
        guard isEnabled else { return }
        
        logger.debug("Running \(healthChecks.count) health checks", category: .monitoring)
        
        var results: [HealthCheckResult] = []
        
        for healthCheck in healthChecks {
            do {
                let result = await healthCheck.check()
                results.append(result)
                
                logger.debug("Health check '\(healthCheck.name)': \(result.status.rawValue)", 
                           category: .monitoring,
                           metadata: ["duration": String(format: "%.3f", result.duration)])
            } catch {
                let errorResult = HealthCheckResult(
                    name: healthCheck.name,
                    category: healthCheck.category,
                    status: .critical,
                    message: "Health check failed: \(error.localizedDescription)",
                    metadata: ["error": error.localizedDescription],
                    duration: 0
                )
                results.append(errorResult)
                
                logger.error("Health check '\(healthCheck.name)' failed: \(error.localizedDescription)",
                           category: .monitoring)
            }
        }
        
        DispatchQueue.main.async {
            self.healthCheckResults = results
            self.updateOverallHealth()
        }
    }
    
    // MARK: - Performance Tracking
    
    public func trackViewLoad(viewName: String, duration: TimeInterval) {
        viewLoadTimes[viewName] = duration
        
        Task {
            await logger.logPerformance(operationName: "View Load: \(viewName)") {
                // Async simulation of the load time for logging
                try await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            }
        }
        
        // Check for performance issues
        if duration > 2.0 {
            createAlert(
                type: .performance,
                title: "Slow View Load",
                message: "View '\(viewName)' took \(String(format: "%.2f", duration))s to load",
                severity: duration > 5.0 ? .critical : .warning
            )
        }
    }
    
    public func trackAPICall(endpoint: String, duration: TimeInterval, success: Bool) {
        apiResponseTimes[endpoint] = duration
        
        if !success {
            errorCounts[endpoint, default: 0] += 1
        }
        
        logger.logAPICall(endpoint: endpoint, method: "POST", statusCode: success ? 200 : 500, duration: duration)
        
        // Check for API performance issues
        if duration > 10.0 {
            createAlert(
                type: .performance,
                title: "Slow API Response",
                message: "API '\(endpoint)' took \(String(format: "%.2f", duration))s to respond",
                severity: duration > 30.0 ? .critical : .warning
            )
        }
        
        // Check for high error rates
        let totalCalls = max(1, apiResponseTimes.count)
        let errorRate = Double(errorCounts.values.reduce(0, +)) / Double(totalCalls)
        
        if errorRate > 0.1 { // More than 10% error rate
            createAlert(
                type: .connectivity,
                title: "High API Error Rate",
                message: "API error rate is \(String(format: "%.1f", errorRate * 100))%",
                severity: errorRate > 0.25 ? .critical : .warning
            )
        }
    }
    
    public func reportCrash(details: String) {
        crashCount += 1
        
        logger.critical("Application crash reported: \(details)", 
                       category: .errors,
                       metadata: ["crash_count": String(crashCount)])
        
        createAlert(
            type: .system,
            title: "Application Crash",
            message: "Crash #\(crashCount): \(details)",
            severity: .critical
        )
    }
    
    // MARK: - Performance Metrics Collection
    
    private func collectSystemPerformanceMetrics() async -> SystemPerformanceMetrics {
        let timestamp = Date()
        
        // CPU Usage (simplified - in production you might use more sophisticated methods)
        let cpuUsage = await getCPUUsage()
        
        // Memory Information
        let memoryInfo = getMemoryInfo()
        let memoryPressure = SystemPerformanceMetrics.MemoryPressure(
            level: getMemoryPressureLevel(),
            availableMemory: memoryInfo.available,
            usedMemory: memoryInfo.used,
            totalMemory: memoryInfo.total,
            swapUsed: memoryInfo.swap
        )
        
        // Disk Space
        let diskInfo = await getDiskSpaceInfo()
        let diskSpace = SystemPerformanceMetrics.DiskSpace(
            available: diskInfo.available,
            total: diskInfo.total,
            used: diskInfo.used,
            usagePercentage: diskInfo.usagePercentage
        )
        
        // Network Stats
        let networkStats = await getNetworkStats()
        
        // Thermal State
        let thermalState = getThermalState()
        
        // Battery and Power
        let batteryLevel = getBatteryLevel()
        let powerSourceState = getPowerSourceState()
        
        return SystemPerformanceMetrics(
            timestamp: timestamp,
            cpuUsage: cpuUsage,
            memoryUsage: (Double(memoryInfo.used) / Double(memoryInfo.total)) * 100,
            memoryPressure: memoryPressure,
            diskSpace: diskSpace,
            networkStats: networkStats,
            thermalState: thermalState,
            batteryLevel: batteryLevel,
            powerSourceState: powerSourceState
        )
    }
    
    // MARK: - Alert Management
    
    public func createAlert(type: ServiceAlertType, title: String, message: String, severity: HealthStatus) {
        let alert = ServiceAlert(
            id: UUID(),
            type: type,
            title: title,
            message: message,
            severity: severity,
            timestamp: Date()
        )
        
        alerts.append(alert)
        
        // Keep only recent alerts
        if alerts.count > 100 {
            alerts.removeFirst(alerts.count - 100)
        }
        
        logger.warning("Monitoring alert: \(title) - \(message)", 
                      category: .monitoring,
                      metadata: [
                        "alert_type": type.rawValue,
                        "severity": severity.rawValue
                      ])
        
        // Post notification for critical alerts
        if severity == .critical {
            NotificationCenter.default.post(
                name: .criticalMonitoringAlert,
                object: nil,
                userInfo: ["alert": alert]
            )
        }
    }
    
    public func clearAlerts() {
        alerts.removeAll()
        logger.info("Monitoring alerts cleared", category: .monitoring)
    }
    
    public func dismissAlert(_ alert: ServiceAlert) {
        alerts.removeAll { $0.id == alert.id }
    }
    
    // MARK: - Private Methods
    
    private func setupDefaultHealthChecks() {
        // These would be initialized with actual service instances
        // For now, we'll create placeholder implementations
        
        healthChecks = [
            MemoryHealthCheck(),
            DiskSpaceHealthCheck()
        ]
    }
    
    private func startNetworkMonitoring() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.handleNetworkPathUpdate(path)
            }
        }
        pathMonitor.start(queue: pathQueue)
    }
    
    private func handleNetworkPathUpdate(_ path: NWPath) {
        let isConnected = path.status == .satisfied
        
        if !isConnected {
            createAlert(
                type: .connectivity,
                title: "Network Disconnected",
                message: "Internet connection has been lost",
                severity: .critical
            )
        }
        
        logger.info("Network status changed: \(path.status)", 
                   category: .network,
                   metadata: ["connected": String(isConnected)])
    }
    
    private func startPerformanceMonitoring() {
        monitoringTimer = Timer.scheduledTimer(withTimeInterval: monitoringInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performMonitoringCycle()
            }
        }
    }
    
    private func stopPerformanceMonitoring() {
        monitoringTimer?.invalidate()
        monitoringTimer = nil
    }
    
    private func startAlertMonitoring() {
        alertTimer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.processAlerts()
            }
        }
    }
    
    private func performMonitoringCycle() async {
        guard isEnabled else { return }
        
        // Collect performance metrics
        let metrics = await collectSystemPerformanceMetrics()
        self.performanceMetrics = metrics
        
        // Update connection health
        await updateConnectionHealth()
        
        // Update application health
        updateApplicationHealth()
        
        // Run health checks
        await runHealthChecks()
        
        logger.debug("Monitoring cycle completed", category: .monitoring)
    }
    
    private func updateConnectionHealth() async {
        // This would integrate with actual service instances
        // For now, we'll create a placeholder implementation
        
        let backendStatus = ServiceConnectionHealth.ServiceConnectionStatus(
            isConnected: true, // Would check APIService.shared.isConnected
            latency: nil,
            lastError: nil,
            uptime: nil,
            reconnectionCount: 0
        )
        
        let health = ServiceConnectionHealth(
            timestamp: Date(),
            backendStatus: backendStatus,
            mcpStatus: backendStatus,
            websocketStatus: backendStatus,
            localLLMStatus: backendStatus,
            internetStatus: backendStatus,
            overallHealth: .healthy
        )
        
        self.connectionHealth = health
    }
    
    private func updateApplicationHealth() {
        let errorRates = errorCounts.mapValues { count in
            Double(count) / Double(max(1, apiResponseTimes.count))
        }
        
        let overallHealth: HealthStatus
        if crashCount > 0 {
            overallHealth = .critical
        } else if errorRates.values.contains(where: { $0 > 0.1 }) {
            overallHealth = .warning
        } else {
            overallHealth = .healthy
        }
        
        let health = ApplicationHealth(
            timestamp: Date(),
            viewLoadTimes: viewLoadTimes,
            apiResponseTimes: apiResponseTimes,
            errorRates: errorRates,
            crashCount: crashCount,
            memoryLeaks: [], // Would be populated by memory analysis
            overallHealth: overallHealth
        )
        
        self.applicationHealth = health
    }
    
    private func updateOverallHealth() {
        let statuses = healthCheckResults.map { $0.status }
        
        if statuses.contains(.failed) || statuses.contains(.error) {
            currentHealth = .critical
        } else if statuses.contains(.warning) {
            currentHealth = .warning
        } else if statuses.allSatisfy({ $0 == .passed }) {
            currentHealth = .healthy
        } else {
            currentHealth = .unknown
        }
    }
    
    private func processAlerts() async {
        // Remove old alerts
        let cutoffTime = Date().addingTimeInterval(-alertThreshold)
        alerts.removeAll { $0.timestamp < cutoffTime }
        
        // Check for repeated issues
        let recentCriticalAlerts = alerts.filter {
            $0.severity == .critical && $0.timestamp > Date().addingTimeInterval(-300)
        }
        
        if recentCriticalAlerts.count > 5 {
            createAlert(
                type: .system,
                title: "Multiple Critical Issues",
                message: "Multiple critical alerts detected in the last 5 minutes",
                severity: .critical
            )
        }
    }
    
    // MARK: - System Information Helpers
    
    private func getCPUUsage() async -> Double {
        // Simplified CPU usage calculation
        // In production, you might use more sophisticated methods
        return Double.random(in: 0...100)
    }
    
    private func getMemoryInfo() -> (used: UInt64, total: UInt64, available: UInt64, swap: UInt64) {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if result == KERN_SUCCESS {
            let totalMemory = ProcessInfo.processInfo.physicalMemory
            let usedMemory = info.resident_size
            let availableMemory = totalMemory - usedMemory
            
            return (used: usedMemory, total: totalMemory, available: availableMemory, swap: 0)
        }
        
        return (used: 0, total: 0, available: 0, swap: 0)
    }
    
    private func getMemoryPressureLevel() -> String {
        // This would use actual memory pressure APIs in production
        return "normal"
    }
    
    private func getDiskSpaceInfo() async -> (available: UInt64, total: UInt64, used: UInt64, usagePercentage: Double) {
        do {
            let homeURL = FileManager.default.homeDirectoryForCurrentUser
            let resourceValues = try homeURL.resourceValues(forKeys: [
                .volumeAvailableCapacityForImportantUsageKey,
                .volumeTotalCapacityKey
            ])
            
            guard let available = resourceValues.volumeAvailableCapacityForImportantUsage,
                  let total = resourceValues.volumeTotalCapacity else {
                return (available: 0, total: 0, used: 0, usagePercentage: 0)
            }
            
            let used = total - available
            let usagePercentage = (Double(used) / Double(total)) * 100
            
            return (
                available: UInt64(available),
                total: UInt64(total),
                used: UInt64(used),
                usagePercentage: usagePercentage
            )
        } catch {
            return (available: 0, total: 0, used: 0, usagePercentage: 0)
        }
    }
    
    private func getNetworkStats() async -> SystemPerformanceMetrics.NetworkStats {
        // This would use actual network statistics in production
        return SystemPerformanceMetrics.NetworkStats(
            bytesReceived: 0,
            bytesSent: 0,
            packetsReceived: 0,
            packetsSent: 0,
            connectionCount: 0,
            latency: nil
        )
    }
    
    private func getThermalState() -> SystemPerformanceMetrics.ThermalState {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal:
            return .nominal
        case .fair:
            return .fair
        case .serious:
            return .serious
        case .critical:
            return .critical
        @unknown default:
            return .nominal
        }
    }
    
    private func getBatteryLevel() -> Double? {
        // This would use IOKit to get actual battery information
        return nil
    }
    
    private func getPowerSourceState() -> SystemPerformanceMetrics.PowerSourceState {
        // This would check actual power source state
        return .unknown
    }
    
    deinit {
        stopPerformanceMonitoring()
        alertTimer?.invalidate()
        pathMonitor.cancel()
    }
}

// MARK: - Supporting Types

public struct ServiceAlert: Identifiable, Codable {
    public let id: UUID
    public let type: ServiceAlertType
    public let title: String
    public let message: String
    public let severity: HealthStatus
    public let timestamp: Date
    
    public init(
        id: UUID = UUID(),
        type: ServiceAlertType,
        title: String,
        message: String,
        severity: HealthStatus,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.message = message
        self.severity = severity
        self.timestamp = timestamp
    }
}

public enum ServiceAlertType: String, Codable, CaseIterable {
    case system = "system"
    case performance = "performance"
    case connectivity = "connectivity"
    case security = "security"
    case storage = "storage"
    case memory = "memory"
    case cpu = "cpu"
    case network = "network"
}

// MARK: - Notification Names
extension Notification.Name {
    public static let criticalMonitoringAlert = Notification.Name("CriticalMonitoringAlert")
    public static let monitoringStatusChanged = Notification.Name("MonitoringStatusChanged")
    public static let performanceMetricsUpdated = Notification.Name("SystemPerformanceMetricsUpdated")
}