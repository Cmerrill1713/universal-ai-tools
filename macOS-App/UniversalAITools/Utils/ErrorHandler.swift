import Foundation
import SwiftUI
import Combine
import OSLog

/// Comprehensive error handling and monitoring system for Enhanced UI
@MainActor
class ErrorHandler: ObservableObject {
    static let shared = ErrorHandler()
    
    @Published var currentErrors: [AppError] = []
    @Published var systemStatus: SystemStatus = .healthy
    @Published var showErrorAlert = false
    
    private let logger = Logger(subsystem: "com.universalaitools.app", category: "ErrorHandler")
    private var errorSubject = PassthroughSubject<AppError, Never>()
    private var cancellables = Set<AnyCancellable>()
    
    // Error analytics
    @Published var errorStats = ErrorStatistics()
    
    private init() {
        setupErrorMonitoring()
        setupPeriodicHealthCheck()
    }
    
    // MARK: - Error Logging
    
    func logError(_ error: AppError) {
        logger.error("App Error: \(error.localizedDescription)")
        
        DispatchQueue.main.async {
            self.currentErrors.append(error)
            self.updateSystemStatus()
            self.updateErrorStatistics(error)
            
            if error.severity == .critical {
                self.showErrorAlert = true
            }
            
            // Auto-remove non-critical errors after 30 seconds
            if error.severity != .critical {
                self.scheduleErrorRemoval(error)
            }
        }
        
        errorSubject.send(error)
    }
    
    func logWarning(_ message: String, category: ErrorCategory = .general) {
        let warning = AppError(
            type: .warning,
            message: message,
            category: category,
            severity: .low,
            timestamp: Date(),
            metadata: [:]
        )
        logError(warning)
    }
    
    func logInfo(_ message: String, category: ErrorCategory = .general) {
        logger.info("Info: \(message)")
    }
    
    // MARK: - Error Recovery
    
    func recoverFromError(_ errorId: UUID, with strategy: RecoveryStrategy) {
        guard let errorIndex = currentErrors.firstIndex(where: { $0.id == errorId }) else {
            return
        }
        
        let error = currentErrors[errorIndex]
        
        Task {
            do {
                try await executeRecoveryStrategy(strategy, for: error)
                removeError(errorId)
                logInfo("Successfully recovered from error: \(error.message)")
            } catch {
                logError(AppError(
                    type: .recoveryFailed,
                    message: "Failed to recover from error: \(error.localizedDescription)",
                    category: .system,
                    severity: .high,
                    timestamp: Date(),
                    metadata: ["originalError": error.localizedDescription]
                ))
            }
        }
    }
    
    func removeError(_ errorId: UUID) {
        currentErrors.removeAll { $0.id == errorId }
        updateSystemStatus()
    }
    
    func clearAllErrors() {
        currentErrors.removeAll()
        systemStatus = .healthy
        showErrorAlert = false
    }
    
    // MARK: - System Health Monitoring
    
    private func setupErrorMonitoring() {
        errorSubject
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleErrorEscalation(error)
            }
            .store(in: &cancellables)
    }
    
    private func setupPeriodicHealthCheck() {
        Timer.publish(every: 30, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.performHealthCheck()
            }
            .store(in: &cancellables)
    }
    
    private func performHealthCheck() {
        Task {
            let health = await SystemHealthChecker.checkSystemHealth()
            
            if health.hasIssues {
                for issue in health.issues {
                    logWarning(issue.description, category: .performance)
                }
            }
            
            if health.overallStatus != systemStatus {
                systemStatus = health.overallStatus
                logger.info("System status changed to: \(health.overallStatus)")
            }
        }
    }
    
    // MARK: - Error Analytics
    
    private func updateErrorStatistics(_ error: AppError) {
        errorStats.totalErrors += 1
        
        switch error.severity {
        case .low:
            errorStats.lowSeverityCount += 1
        case .medium:
            errorStats.mediumSeverityCount += 1
        case .high:
            errorStats.highSeverityCount += 1
        case .critical:
            errorStats.criticalErrorCount += 1
        }
        
        errorStats.errorsByCategory[error.category, default: 0] += 1
        errorStats.lastErrorTime = error.timestamp
        
        // Update error rate (errors per minute)
        updateErrorRate()
    }
    
    private func updateErrorRate() {
        let now = Date()
        let oneMinuteAgo = now.addingTimeInterval(-60)
        
        let recentErrors = currentErrors.filter { $0.timestamp > oneMinuteAgo }
        errorStats.errorRate = Double(recentErrors.count)
    }
    
    // MARK: - Error Recovery Strategies
    
    private func executeRecoveryStrategy(_ strategy: RecoveryStrategy, for error: AppError) async throws {
        switch strategy {
        case .retry:
            try await retryFailedOperation(error)
            
        case .reconnect:
            try await reconnectServices(for: error)
            
        case .clearCache:
            try await clearCache(for: error)
            
        case .resetComponent:
            try await resetComponent(for: error)
            
        case .restartService:
            try await restartService(for: error)
            
        case .fallbackMode:
            try await enableFallbackMode(for: error)
        }
    }
    
    private func retryFailedOperation(_ error: AppError) async throws {
        // Implement retry logic based on error metadata
        if let operation = error.metadata["operation"] as? String {
            logger.info("Retrying operation: \(operation)")
            // Add specific retry logic here
        }
    }
    
    private func reconnectServices(for error: AppError) async throws {
        if error.category == .webSocket || error.category == .network {
            logger.info("Attempting to reconnect services")
            NotificationCenter.default.post(name: .reconnectAllServices, object: nil)
        }
    }
    
    private func clearCache(for error: AppError) async throws {
        if error.category == .dataProcessing || error.category == .performance {
            logger.info("Clearing application cache")
            NotificationCenter.default.post(name: .clearApplicationCache, object: nil)
        }
    }
    
    private func resetComponent(for error: AppError) async throws {
        if let component = error.metadata["component"] as? String {
            logger.info("Resetting component: \(component)")
            NotificationCenter.default.post(
                name: .resetComponent,
                object: nil,
                userInfo: ["component": component]
            )
        }
    }
    
    private func restartService(for error: AppError) async throws {
        if let service = error.metadata["service"] as? String {
            logger.info("Restarting service: \(service)")
            NotificationCenter.default.post(
                name: .restartService,
                object: nil,
                userInfo: ["service": service]
            )
        }
    }
    
    private func enableFallbackMode(for error: AppError) async throws {
        logger.info("Enabling fallback mode for category: \(error.category)")
        NotificationCenter.default.post(
            name: .enableFallbackMode,
            object: nil,
            userInfo: ["category": error.category.rawValue]
        )
    }
    
    // MARK: - Private Helpers
    
    private func updateSystemStatus() {
        let criticalErrors = currentErrors.filter { $0.severity == .critical }
        let highErrors = currentErrors.filter { $0.severity == .high }
        
        if !criticalErrors.isEmpty {
            systemStatus = .critical
        } else if !highErrors.isEmpty {
            systemStatus = .degraded
        } else if currentErrors.isEmpty {
            systemStatus = .healthy
        } else {
            systemStatus = .warning
        }
    }
    
    private func handleErrorEscalation(_ error: AppError) {
        // Escalate errors based on frequency and severity
        let recentSimilarErrors = currentErrors.filter { existingError in
            existingError.category == error.category &&
            existingError.timestamp.timeIntervalSince(Date().addingTimeInterval(-300)) < 0 // Last 5 minutes
        }
        
        if recentSimilarErrors.count > 5 {
            let escalatedError = AppError(
                type: .systemFailure,
                message: "Multiple \(error.category) errors detected",
                category: .system,
                severity: .critical,
                timestamp: Date(),
                metadata: ["originalErrorCount": recentSimilarErrors.count]
            )
            
            currentErrors.append(escalatedError)
            showErrorAlert = true
        }
    }
    
    private func scheduleErrorRemoval(_ error: AppError) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
            self.removeError(error.id)
        }
    }
}

// MARK: - Data Models

struct AppError: Identifiable, Codable {
    let id = UUID()
    let type: ErrorType
    let message: String
    let category: ErrorCategory
    let severity: ErrorSeverity
    let timestamp: Date
    let metadata: [String: String]
    
    var localizedDescription: String {
        return "[\(category.rawValue.uppercased())] \(message)"
    }
    
    var userFriendlyMessage: String {
        switch type {
        case .networkError:
            return "Unable to connect to the server. Please check your internet connection and try again."
        case .webSocketError:
            return "Lost connection to the real-time service. Attempting to reconnect automatically."
        case .dataProcessingError:
            return "There was a problem processing your request. Please try again in a moment."
        case .systemFailure:
            return "Something went wrong with the system. We're working to fix this automatically."
        case .uiError:
            return "There was a display issue. Refreshing the interface should help."
        case .recoveryFailed:
            return "We couldn't automatically fix the problem. You may need to restart the app."
        case .warning:
            return message // Warnings are usually already user-friendly
        }
    }
    
    var userFriendlyTitle: String {
        switch type {
        case .networkError:
            return "Connection Problem"
        case .webSocketError:
            return "Connection Lost"
        case .dataProcessingError:
            return "Processing Error"
        case .systemFailure:
            return "System Issue"
        case .uiError:
            return "Display Issue"
        case .recoveryFailed:
            return "Recovery Failed"
        case .warning:
            return "Notice"
        }
    }
    
    var actionSuggestion: String? {
        switch type {
        case .networkError:
            return "Check your internet connection and try again"
        case .webSocketError:
            return "The connection will retry automatically"
        case .dataProcessingError:
            return "Try your request again in a moment"
        case .systemFailure:
            return "The system will attempt to recover automatically"
        case .uiError:
            return "Try refreshing or switching views"
        case .recoveryFailed:
            return "Consider restarting the application"
        case .warning:
            return nil
        }
    }
}

enum ErrorType: String, Codable, CaseIterable {
    case warning = "warning"
    case networkError = "network_error"
    case dataProcessingError = "data_processing_error"
    case uiError = "ui_error"
    case webSocketError = "websocket_error"
    case systemFailure = "system_failure"
    case recoveryFailed = "recovery_failed"
}

enum ErrorCategory: String, Codable, CaseIterable {
    case general = "general"
    case network = "network"
    case webSocket = "websocket"
    case dataProcessing = "data_processing"
    case ui = "ui"
    case performance = "performance"
    case security = "security"
    case system = "system"
}

enum ErrorSeverity: String, Codable, CaseIterable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case critical = "critical"
    
    var color: Color {
        switch self {
        case .low: return .gray
        case .medium: return .orange
        case .high: return .red
        case .critical: return .purple
        }
    }
    
    var icon: String {
        switch self {
        case .low: return "info.circle"
        case .medium: return "exclamationmark.triangle"
        case .high: return "xmark.circle"
        case .critical: return "flame"
        }
    }
}

enum SystemStatus: String, Codable, CaseIterable {
    case healthy = "healthy"
    case warning = "warning"
    case degraded = "degraded"
    case critical = "critical"
    
    var color: Color {
        switch self {
        case .healthy: return .green
        case .warning: return .yellow
        case .degraded: return .orange
        case .critical: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .healthy: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .degraded: return "minus.circle.fill"
        case .critical: return "xmark.circle.fill"
        }
    }
}

enum RecoveryStrategy: String, CaseIterable {
    case retry = "retry"
    case reconnect = "reconnect"
    case clearCache = "clear_cache"
    case resetComponent = "reset_component"
    case restartService = "restart_service"
    case fallbackMode = "fallback_mode"
    
    var displayName: String {
        switch self {
        case .retry: return "Retry Operation"
        case .reconnect: return "Reconnect Services"
        case .clearCache: return "Clear Cache"
        case .resetComponent: return "Reset Component"
        case .restartService: return "Restart Service"
        case .fallbackMode: return "Enable Fallback Mode"
        }
    }
}

struct ErrorStatistics: Codable {
    var totalErrors: Int = 0
    var lowSeverityCount: Int = 0
    var mediumSeverityCount: Int = 0
    var highSeverityCount: Int = 0
    var criticalErrorCount: Int = 0
    var errorsByCategory: [ErrorCategory: Int] = [:]
    var errorRate: Double = 0.0 // Errors per minute
    var lastErrorTime: Date?
}

struct SystemHealth {
    let overallStatus: SystemStatus
    let hasIssues: Bool
    let issues: [HealthIssue]
}

struct HealthIssue {
    let description: String
    let severity: ErrorSeverity
    let category: ErrorCategory
}

// MARK: - System Health Checker

actor SystemHealthChecker {
    static func checkSystemHealth() async -> SystemHealth {
        var issues: [HealthIssue] = []
        
        // Check memory usage
        let memoryUsage = await checkMemoryUsage()
        if memoryUsage > 0.8 {
            issues.append(HealthIssue(
                description: "High memory usage: \(Int(memoryUsage * 100))%",
                severity: .high,
                category: .performance
            ))
        }
        
        // Check WebSocket connections
        let webSocketHealth = await checkWebSocketConnections()
        if !webSocketHealth.allConnected {
            issues.append(HealthIssue(
                description: "WebSocket connections degraded",
                severity: .medium,
                category: .network
            ))
        }
        
        // Check UI responsiveness
        let uiResponsive = await checkUIResponsiveness()
        if !uiResponsive {
            issues.append(HealthIssue(
                description: "UI responsiveness degraded",
                severity: .medium,
                category: .ui
            ))
        }
        
        // Determine overall status
        let overallStatus: SystemStatus
        if issues.contains(where: { $0.severity == .critical }) {
            overallStatus = .critical
        } else if issues.contains(where: { $0.severity == .high }) {
            overallStatus = .degraded
        } else if !issues.isEmpty {
            overallStatus = .warning
        } else {
            overallStatus = .healthy
        }
        
        return SystemHealth(
            overallStatus: overallStatus,
            hasIssues: !issues.isEmpty,
            issues: issues
        )
    }
    
    private static func checkMemoryUsage() async -> Double {
        // Simulate memory usage check
        return Double.random(in: 0.3...0.9)
    }
    
    private static func checkWebSocketConnections() async -> (allConnected: Bool) {
        // Simulate WebSocket health check
        return (allConnected: Bool.random())
    }
    
    private static func checkUIResponsiveness() async -> Bool {
        // Simulate UI responsiveness check
        return Bool.random()
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let reconnectAllServices = Notification.Name("reconnectAllServices")
    static let clearApplicationCache = Notification.Name("clearApplicationCache")
    static let resetComponent = Notification.Name("resetComponent")
    static let restartService = Notification.Name("restartService")
    static let enableFallbackMode = Notification.Name("enableFallbackMode")
}
