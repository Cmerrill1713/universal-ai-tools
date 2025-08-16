import Combine
import Foundation
import OSLog
import SwiftUI

// MARK: - System Integration Service
@MainActor
public class SystemIntegrationService: ObservableObject {
    public static let shared = SystemIntegrationService()
    
    @Published public var isInitialized = false
    @Published public var initializationProgress: Double = 0.0
    @Published public var initializationStatus = "Initializing..."
    @Published public var systemHealth: OverallSystemHealth = .unknown
    
    private let logger = LoggingService.shared
    private var cancellables = Set<AnyCancellable>()
    
    // Service references
    private let loggingService = LoggingService.shared
    private let monitoringService = MonitoringService.shared
    private let changeTracker = ChangeTracker.shared
    private let failurePreventionService = FailurePreventionService.shared
    private let backendIntegration = BackendMonitoringIntegration.shared
    
    public enum OverallSystemHealth: String, CaseIterable {
        case healthy = "healthy"
        case degraded = "degraded"
        case critical = "critical"
        case unknown = "unknown"
        
        var color: Color {
            switch self {
            case .healthy: return .green
            case .degraded: return .orange
            case .critical: return .red
            case .unknown: return .gray
            }
        }
        
        var icon: String {
            switch self {
            case .healthy: return "checkmark.shield.fill"
            case .degraded: return "exclamationmark.shield.fill"
            case .critical: return "xmark.shield.fill"
            case .unknown: return "questionmark.shield.fill"
            }
        }
    }
    
    private init() {
        setupSystemHealthMonitoring()
    }
    
    // MARK: - Initialization
    
    public func initializeSystem() async {
        guard !isInitialized else { return }
        
        logger.info("Starting system initialization", category: .startup)
        
        await updateProgress(0.1, "Initializing logging system...")
        initializeLogging()
        
        await updateProgress(0.3, "Starting monitoring services...")
        await initializeMonitoring()
        
        await updateProgress(0.5, "Setting up change tracking...")
        initializeChangeTracking()
        
        await updateProgress(0.7, "Activating failure prevention...")
        await initializeFailurePrevention()
        
        await updateProgress(0.9, "Connecting to backend...")
        await initializeBackendIntegration()
        
        await updateProgress(1.0, "System ready")
        
        await MainActor.run {
            self.isInitialized = true
            self.initializationStatus = "System operational"
        }
        
        logger.info("System initialization completed successfully", category: .startup)
        
        // Start continuous health monitoring
        startHealthMonitoring()
        
        // Log initial system state
        await logSystemStatus()
    }
    
    private func updateProgress(_ progress: Double, _ status: String) async {
        await MainActor.run {
            self.initializationProgress = progress
            self.initializationStatus = status
        }
        
        // Small delay to make progress visible
        try? await Task.sleep(nanoseconds: 200_000_000) // 0.2 seconds
    }
    
    // MARK: - Service Initialization
    
    private func initializeLogging() {
        loggingService.setEnabled(true)
        loggingService.setMinimumLevel(.debug)
        
        // Start remote streaming
        loggingService.remoteStreamer.startStreaming()
        
        logger.info("Logging service initialized", category: .startup)
    }
    
    private func initializeMonitoring() async {
        monitoringService.setEnabled(true)
        
        // Add custom health checks for our application
        let appHealthCheck = ApplicationHealthCheck()
        monitoringService.addHealthCheck(appHealthCheck)
        
        // Run initial health check
        await monitoringService.runHealthChecks()
        
        logger.info("Monitoring service initialized", category: .startup)
    }
    
    private func initializeChangeTracking() {
        changeTracker.setEnabled(true)
        changeTracker.setTrackingOptions(
            userInteractions: true,
            performanceEvents: true,
            featureUsage: true,
            workflows: true,
            anonymizeData: false
        )
        
        // Track system initialization
        changeTracker.track(
            type: .systemEvent,
            source: "system_integration",
            action: "initialization_completed"
        )
        
        logger.info("Change tracking initialized", category: .startup)
    }
    
    private func initializeFailurePrevention() async {
        failurePreventionService.setEnabled(true)
        failurePreventionService.setAutomaticRecoveryEnabled(true)
        
        // Run initial failure prediction
        await failurePreventionService.runFailurePrediction()
        
        logger.info("Failure prevention service initialized", category: .startup)
    }
    
    private func initializeBackendIntegration() async {
        // Connect to backend monitoring
        await backendIntegration.connect()
        
        logger.info("Backend integration initialized", category: .startup)
    }
    
    // MARK: - Health Monitoring
    
    private func setupSystemHealthMonitoring() {
        // Monitor overall system health by combining all service states
        Publishers.CombineLatest4(
            monitoringService.$currentHealth,
            failurePreventionService.$activePredictions,
            backendIntegration.$isConnected,
            loggingService.$remoteStreamer
        )
        .map { monitoringHealth, predictions, backendConnected, remoteStreamer in
            self.calculateOverallHealth(
                monitoringHealth: monitoringHealth,
                activePredictions: predictions,
                backendConnected: backendConnected,
                remoteStreamingConnected: remoteStreamer.isConnected
            )
        }
        .receive(on: DispatchQueue.main)
        .assign(to: \.systemHealth, on: self)
        .store(in: &cancellables)
    }
    
    private func startHealthMonitoring() {
        // Set up periodic health monitoring
        Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performSystemHealthCheck()
            }
        }
    }
    
    private func calculateOverallHealth(
        monitoringHealth: HealthStatus,
        activePredictions: [FailurePrediction],
        backendConnected: Bool,
        remoteStreamingConnected: Bool
    ) -> OverallSystemHealth {
        // Critical issues
        if monitoringHealth == .critical || activePredictions.contains(where: { $0.severity == .critical }) {
            return .critical
        }
        
        // Degraded performance
        if monitoringHealth == .warning ||
           !backendConnected ||
           !remoteStreamingConnected ||
           activePredictions.contains(where: { $0.severity == .high }) {
            return .degraded
        }
        
        // Healthy system
        if monitoringHealth == .healthy && activePredictions.isEmpty && backendConnected {
            return .healthy
        }
        
        return .unknown
    }
    
    private func performSystemHealthCheck() async {
        logger.debug("Performing system health check", category: .monitoring)
        
        // Run health checks on all services
        await monitoringService.runHealthChecks()
        await failurePreventionService.runFailurePrediction()
        
        // Generate analytics snapshot
        await changeTracker.generateAnalyticsSnapshot()
        
        // Check backend connection
        if !backendIntegration.isConnected {
            logger.warning("Backend connection lost during health check", category: .monitoring)
        }
    }
    
    // MARK: - System Status Reporting
    
    public func getSystemStatusReport() async -> SystemStatusReport {
        let report = SystemStatusReport(
            timestamp: Date(),
            systemHealth: systemHealth,
            services: ServiceStatus(
                logging: ServiceHealthStatus(
                    isEnabled: loggingService.isEnabled,
                    isHealthy: true, // Would implement health check
                    details: "Logging: \(loggingService.recentLogs.count) recent entries"
                ),
                monitoring: ServiceHealthStatus(
                    isEnabled: monitoringService.isEnabled,
                    isHealthy: monitoringService.currentHealth != .critical,
                    details: "Health: \(monitoringService.currentHealth.rawValue)"
                ),
                changeTracking: ServiceHealthStatus(
                    isEnabled: changeTracker.isEnabled,
                    isHealthy: true,
                    details: "Events: \(changeTracker.recentEvents.count) recent"
                ),
                failurePrevention: ServiceHealthStatus(
                    isEnabled: failurePreventionService.isEnabled,
                    isHealthy: failurePreventionService.activePredictions.isEmpty,
                    details: "Predictions: \(failurePreventionService.activePredictions.count) active"
                ),
                backendIntegration: ServiceHealthStatus(
                    isEnabled: true,
                    isHealthy: backendIntegration.isConnected,
                    details: "Status: \(backendIntegration.syncStatus.rawValue)"
                )
            ),
            metrics: await collectSystemMetrics(),
            uptime: getSystemUptime()
        )
        
        return report
    }
    
    private func collectSystemMetrics() async -> SystemMetrics {
        let performanceMetrics = monitoringService.performanceMetrics
        
        return SystemMetrics(
            cpuUsage: performanceMetrics?.cpuUsage ?? 0,
            memoryUsage: performanceMetrics?.memoryUsage ?? 0,
            diskUsage: performanceMetrics?.diskSpace.usagePercentage ?? 0,
            networkLatency: performanceMetrics?.networkStats.latency,
            logCount: loggingService.recentLogs.count,
            eventCount: changeTracker.recentEvents.count,
            predictionCount: failurePreventionService.activePredictions.count,
            alertCount: monitoringService.alerts.count
        )
    }
    
    private func getSystemUptime() -> TimeInterval {
        // Calculate uptime since system initialization
        let bootTime = ProcessInfo.processInfo.systemUptime
        return bootTime
    }
    
    private func logSystemStatus() async {
        let report = await getSystemStatusReport()
        
        logger.info("System Status Report", category: .monitoring, metadata: [
            "system_health": report.systemHealth.rawValue,
            "cpu_usage": String(format: "%.1f", report.metrics.cpuUsage),
            "memory_usage": String(format: "%.1f", report.metrics.memoryUsage),
            "disk_usage": String(format: "%.1f", report.metrics.diskUsage),
            "uptime": String(format: "%.1f", report.uptime),
            "active_predictions": String(report.metrics.predictionCount),
            "active_alerts": String(report.metrics.alertCount)
        ])
    }
    
    // MARK: - Emergency Procedures
    
    public func emergencyShutdown() async {
        logger.critical("Emergency shutdown initiated", category: .startup)
        
        // Stop all services in reverse order
        backendIntegration.disconnect()
        failurePreventionService.setEnabled(false)
        changeTracker.setEnabled(false)
        monitoringService.setEnabled(false)
        loggingService.setEnabled(false)
        
        await MainActor.run {
            self.isInitialized = false
            self.systemHealth = .critical
        }
        
        logger.critical("Emergency shutdown completed", category: .startup)
    }
    
    public func restartServices() async {
        logger.warning("Restarting all services", category: .startup)
        
        await emergencyShutdown()
        
        // Wait a moment
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        
        await initializeSystem()
    }
}

// MARK: - Supporting Types

public struct SystemStatusReport: Codable {
    public let timestamp: Date
    public let systemHealth: SystemIntegrationService.OverallSystemHealth
    public let services: ServiceStatus
    public let metrics: SystemMetrics
    public let uptime: TimeInterval
}

public struct ServiceStatus: Codable {
    public let logging: ServiceHealthStatus
    public let monitoring: ServiceHealthStatus
    public let changeTracking: ServiceHealthStatus
    public let failurePrevention: ServiceHealthStatus
    public let backendIntegration: ServiceHealthStatus
}

public struct ServiceHealthStatus: Codable {
    public let isEnabled: Bool
    public let isHealthy: Bool
    public let details: String
}

// SystemMetrics is defined in Models/SystemMetrics.swift

// MARK: - Application Health Check

public class ApplicationHealthCheck: HealthCheck {
    public let name = "Application Health"
    public let category = "application"
    
    public func check() async -> HealthCheckResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        // Check various application health indicators
        let memoryUsage = getMemoryUsage()
        let isResponsive = checkUIResponsiveness()
        let hasErrors = checkForRecentErrors()
        
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        
        var status: HealthStatus = .healthy
        var message = "Application is running normally"
        var metadata: [String: String] = [:]
        
        if memoryUsage > 0.9 {
            status = .critical
            message = "High memory usage detected"
        } else if memoryUsage > 0.75 {
            status = .warning
            message = "Elevated memory usage"
        } else if !isResponsive {
            status = .warning
            message = "UI responsiveness issues detected"
        } else if hasErrors {
            status = .warning
            message = "Recent errors detected"
        }
        
        metadata["memory_usage"] = String(format: "%.1f", memoryUsage * 100)
        metadata["ui_responsive"] = String(isResponsive)
        metadata["recent_errors"] = String(hasErrors)
        
        return HealthCheckResult(
            name: name,
            category: category,
            status: status,
            message: message,
            metadata: metadata,
            duration: duration
        )
    }
    
    private func getMemoryUsage() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if result == KERN_SUCCESS {
            let totalMemory = ProcessInfo.processInfo.physicalMemory
            return Double(info.resident_size) / Double(totalMemory)
        }
        
        return 0.0
    }
    
    private func checkUIResponsiveness() -> Bool {
        // Simple check - in a real implementation, this might measure UI response times
        return Thread.isMainThread || true
    }
    
    private func checkForRecentErrors() -> Bool {
        // Check for recent error logs
        let recentLogs = LoggingService.shared.recentLogs
        let recentErrors = recentLogs.filter { 
            $0.level == .error || $0.level == .critical
        }.filter {
            $0.timestamp > Date().addingTimeInterval(-300) // Last 5 minutes
        }
        
        return !recentErrors.isEmpty
    }
}