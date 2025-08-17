import Foundation
import SwiftUI
import Combine
import OSLog

// MARK: - Unified Error Handling System

/// A comprehensive error handling system that provides standardized error types,
/// user-friendly messages, recovery suggestions, and analytics tracking
@MainActor
public final class UnifiedErrorHandlingSystem: ObservableObject {
    static let shared = UnifiedErrorHandlingSystem()
    
    // MARK: - Published Properties
    @Published public var currentError: AppError?
    @Published public var errorHistory: [AppError] = []
    @Published public var recoveryInProgress: Bool = false
    @Published public var errorAnalytics: ErrorAnalytics = ErrorAnalytics()
    
    // MARK: - Private Properties
    private let logger = Logger(subsystem: "com.universalai.tools", category: "ErrorHandling")
    private let maxErrorHistory: Int = 100
    private var errorRecoveryManager: ErrorRecoveryManager?
    
    // Analytics tracking
    private let analytics = ContextAnalyticsService.shared
    
    private init() {
        setupErrorRecoveryManager()
    }
    
    // MARK: - Error Reporting
    
    /// Reports an error with automatic categorization and user-friendly messaging
    public func reportError(
        _ error: Error,
        context: ErrorContext = ErrorContext(),
        source: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        let appError = createAppError(
            from: error,
            context: context,
            source: source,
            function: function,
            line: line
        )
        
        handleAppError(appError)
    }
    
    /// Reports an error with custom details
    public func reportError(
        type: AppErrorType,
        title: String,
        message: String,
        context: ErrorContext = ErrorContext(),
        recoverySuggestions: [RecoverySuggestion] = [],
        source: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        let appError = AppError(
            id: UUID().uuidString,
            type: type,
            category: type.category,
            title: title,
            userMessage: message,
            technicalDetails: "Reported from \(source):\(function):\(line)",
            severity: type.defaultSeverity,
            context: context,
            recoverySuggestions: recoverySuggestions.isEmpty ? type.defaultRecoverySuggestions : recoverySuggestions,
            timestamp: Date(),
            metadata: [
                "source": source,
                "function": function,
                "line": "\(line)"
            ]
        )
        
        handleAppError(appError)
    }
    
    // MARK: - Error Presentation
    
    /// Presents an error to the user with appropriate UI
    public func presentError(_ error: AppError) {
        currentError = error
        trackErrorAnalytics(error)
        
        // Log error details
        logger.error("Error presented: \(error.title) - \(error.userMessage)")
        
        // Send notification for UI updates
        NotificationCenter.default.post(
            name: .errorPresented,
            object: error
        )
    }
    
    /// Dismisses the current error
    public func dismissCurrentError() {
        currentError = nil
        NotificationCenter.default.post(name: .errorDismissed, object: nil)
    }
    
    // MARK: - Recovery Management
    
    /// Attempts automatic recovery for an error
    public func attemptRecovery(for error: AppError) async -> Bool {
        guard let recoveryManager = errorRecoveryManager else {
            logger.warning("Error recovery manager not available")
            return false
        }
        
        recoveryInProgress = true
        
        defer {
            recoveryInProgress = false
        }
        
        do {
            // Get the best recovery strategy
            let strategies = recoveryManager.getSuggestedStrategies(for: error)
            
            guard let primaryStrategy = strategies.first else {
                logger.warning("No recovery strategies available for error: \(error.id)")
                return false
            }
            
            // Attempt recovery
            await recoveryManager.executeAutomaticRecovery(
                strategy: primaryStrategy,
                error: error
            )
            
            // Check if recovery was successful
            let recoverySuccessful = recoveryManager.recoveryStatus == .completed
            
            if recoverySuccessful {
                logger.info("Automatic recovery successful for error: \(error.id)")
                trackRecoverySuccess(error: error, strategy: primaryStrategy)
            } else {
                logger.warning("Automatic recovery failed for error: \(error.id)")
                trackRecoveryFailure(error: error, strategy: primaryStrategy)
            }
            
            return recoverySuccessful
            
        } catch {
            logger.error("Recovery attempt failed: \(error)")
            return false
        }
    }
    
    /// Gets recovery suggestions for an error
    public func getRecoverySuggestions(for error: AppError) -> [RecoverySuggestion] {
        return error.recoverySuggestions
    }
    
    // MARK: - Analytics
    
    /// Gets error analytics data
    public func getErrorAnalytics() -> ErrorAnalytics {
        return errorAnalytics
    }
    
    /// Exports error data for analysis
    public func exportErrorData() -> ErrorExportData {
        return ErrorExportData(
            errors: errorHistory,
            analytics: errorAnalytics,
            exportDate: Date()
        )
    }
    
    // MARK: - Private Methods
    
    private func setupErrorRecoveryManager() {
        // The ErrorRecoveryManager is already defined in the codebase
        // We'll integrate with it
        errorRecoveryManager = ErrorRecoveryManager()
    }
    
    private func createAppError(
        from error: Error,
        context: ErrorContext,
        source: String,
        function: String,
        line: Int
    ) -> AppError {
        
        // Check if it's already an AppError
        if let appError = error as? AppError {
            return appError
        }
        
        // Determine error type from the error
        let errorType = determineErrorType(from: error)
        
        return AppError(
            id: UUID().uuidString,
            type: errorType,
            category: errorType.category,
            title: errorType.userFriendlyTitle,
            userMessage: createUserFriendlyMessage(for: error, type: errorType),
            technicalDetails: error.localizedDescription,
            severity: errorType.defaultSeverity,
            context: context,
            recoverySuggestions: errorType.defaultRecoverySuggestions,
            timestamp: Date(),
            metadata: [
                "originalError": error.localizedDescription,
                "source": source,
                "function": function,
                "line": "\(line)",
                "errorType": String(describing: type(of: error))
            ]
        )
    }
    
    private func handleAppError(_ error: AppError) {
        // Add to history
        errorHistory.append(error)
        
        // Maintain history limit
        if errorHistory.count > maxErrorHistory {
            errorHistory.removeFirst(errorHistory.count - maxErrorHistory)
        }
        
        // Update analytics
        trackErrorAnalytics(error)
        
        // Log the error
        logger.error("Error handled: [\(error.category)] \(error.title) - \(error.userMessage)")
        
        // Present the error if it's severe enough
        if error.severity >= .medium {
            presentError(error)
        }
        
        // Attempt automatic recovery for certain types
        if error.type.supportsAutomaticRecovery {
            Task {
                await attemptRecovery(for: error)
            }
        }
    }
    
    private func determineErrorType(from error: Error) -> AppErrorType {
        // Map common error types to our unified types
        switch error {
        case is URLError:
            return .networkConnection
        case is DecodingError:
            return .dataProcessing
        case is AuthenticationError:
            return .authenticationFailure
        case is WebSocketError:
            return .webSocketConnection
        default:
            // Check error domain and code for more specific mapping
            let nsError = error as NSError
            
            switch nsError.domain {
            case NSURLErrorDomain:
                switch nsError.code {
                case NSURLErrorNotConnectedToInternet:
                    return .networkUnavailable
                case NSURLErrorTimedOut:
                    return .requestTimeout
                default:
                    return .networkConnection
                }
            case NSOSStatusErrorDomain:
                return .systemError
            default:
                return .unknown
            }
        }
    }
    
    private func createUserFriendlyMessage(for error: Error, type: AppErrorType) -> String {
        // Create user-friendly messages based on error type
        switch type {
        case .networkConnection:
            return "Unable to connect to the server. Please check your internet connection and try again."
        case .networkUnavailable:
            return "No internet connection available. Please connect to the internet and try again."
        case .requestTimeout:
            return "The request took too long to complete. Please try again."
        case .authenticationFailure:
            return "Authentication failed. Please check your credentials and try again."
        case .webSocketConnection:
            return "Real-time connection lost. Attempting to reconnect..."
        case .dataProcessing:
            return "Unable to process the received data. This might be a temporary issue."
        case .fileSystem:
            return "Unable to access or save files. Please check file permissions."
        case .voiceProcessing:
            return "Voice processing encountered an issue. Please try speaking again."
        case .aiService:
            return "AI service is temporarily unavailable. Please try again in a moment."
        case .systemError:
            return "A system error occurred. Please restart the application if the problem persists."
        case .uiError:
            return "A display error occurred. The interface will refresh automatically."
        case .unknown:
            return "An unexpected error occurred. Please try again or contact support if the problem persists."
        }
    }
    
    private func trackErrorAnalytics(_ error: AppError) {
        // Update error analytics
        errorAnalytics.totalErrors += 1
        errorAnalytics.errorsByCategory[error.category, default: 0] += 1
        errorAnalytics.errorsBySeverity[error.severity, default: 0] += 1
        errorAnalytics.lastError = error
        
        // Track in context analytics service
        analytics.trackError(
            type: error.type.rawValue,
            message: error.userMessage,
            context: error.context.additionalData
        )
    }
    
    private func trackRecoverySuccess(error: AppError, strategy: RecoveryStrategy) {
        errorAnalytics.recoveryAttempts += 1
        errorAnalytics.successfulRecoveries += 1
        
        analytics.trackRecovery(
            errorType: error.type.rawValue,
            strategy: strategy.rawValue,
            success: true
        )
    }
    
    private func trackRecoveryFailure(error: AppError, strategy: RecoveryStrategy) {
        errorAnalytics.recoveryAttempts += 1
        
        analytics.trackRecovery(
            errorType: error.type.rawValue,
            strategy: strategy.rawValue,
            success: false
        )
    }
}

// MARK: - Error Types

/// Comprehensive error type enumeration covering all application domains
public enum AppErrorType: String, CaseIterable {
    // Network related
    case networkConnection = "network_connection"
    case networkUnavailable = "network_unavailable"
    case requestTimeout = "request_timeout"
    case serverError = "server_error"
    
    // Authentication & Security
    case authenticationFailure = "authentication_failure"
    case authorizationDenied = "authorization_denied"
    case tokenExpired = "token_expired"
    
    // Data & Processing
    case dataProcessing = "data_processing"
    case dataCorruption = "data_corruption"
    case invalidInput = "invalid_input"
    
    // WebSocket & Real-time
    case webSocketConnection = "websocket_connection"
    case webSocketTimeout = "websocket_timeout"
    case realtimeSync = "realtime_sync"
    
    // File & Storage
    case fileSystem = "file_system"
    case diskSpace = "disk_space"
    case permissions = "permissions"
    
    // Voice & Audio
    case voiceProcessing = "voice_processing"
    case audioInput = "audio_input"
    case speechRecognition = "speech_recognition"
    
    // AI & ML Services
    case aiService = "ai_service"
    case modelLoading = "model_loading"
    case inferenceFailure = "inference_failure"
    
    // System & Performance
    case systemError = "system_error"
    case memoryError = "memory_error"
    case performanceIssue = "performance_issue"
    
    // UI & Display
    case uiError = "ui_error"
    case renderingError = "rendering_error"
    
    // General
    case unknown = "unknown"
    case configurationError = "configuration_error"
    
    var category: ErrorCategory {
        switch self {
        case .networkConnection, .networkUnavailable, .requestTimeout, .serverError:
            return .network
        case .authenticationFailure, .authorizationDenied, .tokenExpired:
            return .security
        case .dataProcessing, .dataCorruption, .invalidInput:
            return .dataProcessing
        case .webSocketConnection, .webSocketTimeout, .realtimeSync:
            return .webSocket
        case .fileSystem, .diskSpace, .permissions:
            return .fileSystem
        case .voiceProcessing, .audioInput, .speechRecognition:
            return .voice
        case .aiService, .modelLoading, .inferenceFailure:
            return .aiService
        case .systemError, .memoryError, .performanceIssue:
            return .system
        case .uiError, .renderingError:
            return .ui
        case .unknown, .configurationError:
            return .general
        }
    }
    
    var defaultSeverity: ErrorSeverity {
        switch self {
        case .networkUnavailable, .authenticationFailure, .systemError, .memoryError:
            return .high
        case .networkConnection, .webSocketConnection, .aiService, .voiceProcessing:
            return .medium
        case .requestTimeout, .dataProcessing, .uiError:
            return .low
        default:
            return .medium
        }
    }
    
    var userFriendlyTitle: String {
        switch self {
        case .networkConnection:
            return "Connection Issue"
        case .networkUnavailable:
            return "No Internet Connection"
        case .requestTimeout:
            return "Request Timed Out"
        case .serverError:
            return "Server Error"
        case .authenticationFailure:
            return "Authentication Failed"
        case .authorizationDenied:
            return "Access Denied"
        case .tokenExpired:
            return "Session Expired"
        case .dataProcessing:
            return "Data Processing Error"
        case .dataCorruption:
            return "Data Corruption"
        case .invalidInput:
            return "Invalid Input"
        case .webSocketConnection:
            return "Connection Lost"
        case .webSocketTimeout:
            return "Connection Timeout"
        case .realtimeSync:
            return "Sync Issue"
        case .fileSystem:
            return "File Access Error"
        case .diskSpace:
            return "Insufficient Storage"
        case .permissions:
            return "Permission Denied"
        case .voiceProcessing:
            return "Voice Processing Error"
        case .audioInput:
            return "Audio Input Error"
        case .speechRecognition:
            return "Speech Recognition Error"
        case .aiService:
            return "AI Service Unavailable"
        case .modelLoading:
            return "Model Loading Error"
        case .inferenceFailure:
            return "AI Processing Error"
        case .systemError:
            return "System Error"
        case .memoryError:
            return "Memory Error"
        case .performanceIssue:
            return "Performance Issue"
        case .uiError:
            return "Display Error"
        case .renderingError:
            return "Rendering Error"
        case .unknown:
            return "Unexpected Error"
        case .configurationError:
            return "Configuration Error"
        }
    }
    
    var supportsAutomaticRecovery: Bool {
        switch self {
        case .networkConnection, .webSocketConnection, .requestTimeout, .realtimeSync:
            return true
        case .systemError, .memoryError, .performanceIssue:
            return false
        default:
            return true
        }
    }
    
    var defaultRecoverySuggestions: [RecoverySuggestion] {
        switch self {
        case .networkConnection, .networkUnavailable:
            return [
                RecoverySuggestion(
                    id: "check_connection",
                    title: "Check Your Connection",
                    description: "Verify that you're connected to the internet",
                    action: .checkNetworkConnection,
                    priority: .high
                ),
                RecoverySuggestion(
                    id: "retry_request",
                    title: "Try Again",
                    description: "Retry the failed operation",
                    action: .retry,
                    priority: .medium
                )
            ]
        case .authenticationFailure:
            return [
                RecoverySuggestion(
                    id: "reauth",
                    title: "Sign In Again",
                    description: "Re-authenticate to restore access",
                    action: .reauthenticate,
                    priority: .high
                )
            ]
        case .webSocketConnection:
            return [
                RecoverySuggestion(
                    id: "reconnect",
                    title: "Reconnect",
                    description: "Reconnect to real-time services",
                    action: .reconnect,
                    priority: .high
                )
            ]
        case .voiceProcessing:
            return [
                RecoverySuggestion(
                    id: "check_mic",
                    title: "Check Microphone",
                    description: "Ensure microphone permissions are granted",
                    action: .checkPermissions,
                    priority: .high
                ),
                RecoverySuggestion(
                    id: "try_again",
                    title: "Speak Again",
                    description: "Try speaking your request again",
                    action: .retry,
                    priority: .medium
                )
            ]
        default:
            return [
                RecoverySuggestion(
                    id: "retry",
                    title: "Try Again",
                    description: "Retry the operation",
                    action: .retry,
                    priority: .medium
                ),
                RecoverySuggestion(
                    id: "refresh",
                    title: "Refresh",
                    description: "Refresh the current view",
                    action: .refresh,
                    priority: .low
                )
            ]
        }
    }
}

/// Error categories for grouping and handling
public enum ErrorCategory: String, CaseIterable {
    case network = "network"
    case security = "security"
    case dataProcessing = "data_processing"
    case webSocket = "websocket"
    case fileSystem = "file_system"
    case voice = "voice"
    case aiService = "ai_service"
    case system = "system"
    case ui = "ui"
    case general = "general"
}

/// Error severity levels
public enum ErrorSeverity: Int, CaseIterable, Comparable {
    case low = 1
    case medium = 2
    case high = 3
    case critical = 4
    
    public static func < (lhs: ErrorSeverity, rhs: ErrorSeverity) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
    
    var displayName: String {
        switch self {
        case .low:
            return "Low"
        case .medium:
            return "Medium"
        case .high:
            return "High"
        case .critical:
            return "Critical"
        }
    }
    
    var color: Color {
        switch self {
        case .low:
            return .blue
        case .medium:
            return .orange
        case .high:
            return .red
        case .critical:
            return .purple
        }
    }
}

// MARK: - Error Data Structures

/// Comprehensive error information
public struct AppError: Identifiable, Equatable {
    public let id: String
    public let type: AppErrorType
    public let category: ErrorCategory
    public let title: String
    public let userMessage: String
    public let technicalDetails: String
    public let severity: ErrorSeverity
    public let context: ErrorContext
    public let recoverySuggestions: [RecoverySuggestion]
    public let timestamp: Date
    public let metadata: [String: String]
    
    public static func == (lhs: AppError, rhs: AppError) -> Bool {
        lhs.id == rhs.id
    }
    
    /// Create an AppError from a connection error
    public static func fromConnectionError(_ error: Error) -> AppError {
        let nsError = error as NSError
        
        let errorType: AppErrorType
        let title: String
        let message: String
        
        switch nsError.code {
        case NSURLErrorNotConnectedToInternet,
             NSURLErrorNetworkConnectionLost:
            errorType = .networkConnection
            title = "Network Connection Lost"
            message = "Please check your internet connection and try again."
        case NSURLErrorTimedOut:
            errorType = .requestTimeout
            title = "Connection Timeout"
            message = "The connection timed out. Please try again."
        case NSURLErrorCannotConnectToHost,
             NSURLErrorCannotFindHost:
            errorType = .networkUnavailable
            title = "Cannot Connect to Server"
            message = "Unable to connect to the server. Please try again later."
        default:
            errorType = .networkConnection
            title = "Connection Error"
            message = "A network error occurred: \(error.localizedDescription)"
        }
        
        return AppError(
            id: UUID().uuidString,
            type: errorType,
            category: errorType.category,
            title: title,
            userMessage: message,
            technicalDetails: "NSError code: \(nsError.code), description: \(nsError.localizedDescription)",
            severity: .medium,
            context: ErrorContext(),
            recoverySuggestions: errorType.defaultRecoverySuggestions,
            timestamp: Date(),
            metadata: [
                "error_code": "\(nsError.code)",
                "error_domain": nsError.domain
            ]
        )
    }
}

/// Context information for errors
public struct ErrorContext {
    public let userId: String?
    public let sessionId: String?
    public let feature: String?
    public let userAction: String?
    public let deviceInfo: DeviceInfo
    public let appVersion: String
    public let additionalData: [String: Any]
    
    public init(
        userId: String? = nil,
        sessionId: String? = nil,
        feature: String? = nil,
        userAction: String? = nil,
        additionalData: [String: Any] = [:]
    ) {
        self.userId = userId
        self.sessionId = sessionId
        self.feature = feature
        self.userAction = userAction
        self.deviceInfo = DeviceInfo.current
        self.appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
        self.additionalData = additionalData
    }
}

/// Device information for error context
public struct DeviceInfo {
    public let model: String
    public let osVersion: String
    public let locale: String
    
    public static var current: DeviceInfo {
        DeviceInfo(
            model: ProcessInfo.processInfo.hostName,
            osVersion: ProcessInfo.processInfo.operatingSystemVersionString,
            locale: Locale.current.identifier
        )
    }
}

/// Recovery suggestion for users
public struct RecoverySuggestion: Identifiable, Equatable {
    public let id: String
    public let title: String
    public let description: String
    public let action: RecoveryAction
    public let priority: RecoveryPriority
    
    public static func == (lhs: RecoverySuggestion, rhs: RecoverySuggestion) -> Bool {
        lhs.id == rhs.id
    }
}

/// Priority levels for recovery suggestions
public enum RecoveryPriority: Int, CaseIterable {
    case low = 1
    case medium = 2
    case high = 3
    
    var displayName: String {
        switch self {
        case .low:
            return "Try This"
        case .medium:
            return "Recommended"
        case .high:
            return "Try First"
        }
    }
}

/// Available recovery actions
public enum RecoveryAction: String, CaseIterable {
    case retry = "retry"
    case refresh = "refresh"
    case reconnect = "reconnect"
    case reauthenticate = "reauthenticate"
    case checkNetworkConnection = "check_network"
    case checkPermissions = "check_permissions"
    case clearCache = "clear_cache"
    case restartApp = "restart_app"
    case contactSupport = "contact_support"
    
    var userFriendlyTitle: String {
        switch self {
        case .retry:
            return "Try Again"
        case .refresh:
            return "Refresh"
        case .reconnect:
            return "Reconnect"
        case .reauthenticate:
            return "Sign In Again"
        case .checkNetworkConnection:
            return "Check Connection"
        case .checkPermissions:
            return "Check Permissions"
        case .clearCache:
            return "Clear Cache"
        case .restartApp:
            return "Restart App"
        case .contactSupport:
            return "Contact Support"
        }
    }
}

// MARK: - Analytics

/// Error analytics data
public struct ErrorAnalytics {
    public var totalErrors: Int = 0
    public var errorsByCategory: [ErrorCategory: Int] = [:]
    public var errorsBySeverity: [ErrorSeverity: Int] = [:]
    public var recoveryAttempts: Int = 0
    public var successfulRecoveries: Int = 0
    public var lastError: AppError?
    
    public var recoverySuccessRate: Double {
        guard recoveryAttempts > 0 else { return 0 }
        return Double(successfulRecoveries) / Double(recoveryAttempts)
    }
}

/// Export data structure for error analysis
public struct ErrorExportData: Codable {
    public let errors: [AppErrorExport]
    public let analytics: ErrorAnalyticsExport
    public let exportDate: Date
    
    init(errors: [AppError], analytics: ErrorAnalytics, exportDate: Date) {
        self.errors = errors.map { AppErrorExport(from: $0) }
        self.analytics = ErrorAnalyticsExport(from: analytics)
        self.exportDate = exportDate
    }
}

/// Simplified app error for export
public struct AppErrorExport: Codable {
    public let id: String
    public let type: String
    public let category: String
    public let title: String
    public let severity: String
    public let timestamp: Date
    
    init(from appError: AppError) {
        self.id = appError.id
        self.type = appError.type.rawValue
        self.category = appError.category.rawValue
        self.title = appError.title
        self.severity = appError.severity.displayName
        self.timestamp = appError.timestamp
    }
}

/// Simplified analytics for export
public struct ErrorAnalyticsExport: Codable {
    public let totalErrors: Int
    public let recoveryAttempts: Int
    public let successfulRecoveries: Int
    public let recoverySuccessRate: Double
    
    init(from analytics: ErrorAnalytics) {
        self.totalErrors = analytics.totalErrors
        self.recoveryAttempts = analytics.recoveryAttempts
        self.successfulRecoveries = analytics.successfulRecoveries
        self.recoverySuccessRate = analytics.recoverySuccessRate
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let errorPresented = Notification.Name("errorPresented")
    static let errorDismissed = Notification.Name("errorDismissed")
}

// MARK: - Custom Errors

/// WebSocket specific errors
public enum WebSocketError: Error, LocalizedError {
    case connectionFailed
    case connectionLost
    case invalidURL
    case authenticationRequired
    case messageEncodingFailed
    case messageDecodingFailed
    
    public var errorDescription: String? {
        switch self {
        case .connectionFailed:
            return "Failed to establish WebSocket connection"
        case .connectionLost:
            return "WebSocket connection was lost"
        case .invalidURL:
            return "Invalid WebSocket URL"
        case .authenticationRequired:
            return "WebSocket authentication required"
        case .messageEncodingFailed:
            return "Failed to encode WebSocket message"
        case .messageDecodingFailed:
            return "Failed to decode WebSocket message"
        }
    }
}

// MARK: - Extensions

extension ContextAnalyticsService {
    func trackError(type: String, message: String, context: [String: Any]) {
        // Implementation would be added to track errors in analytics
        // This is a placeholder for the analytics integration
    }
    
    func trackRecovery(errorType: String, strategy: String, success: Bool) {
        // Implementation would be added to track recovery attempts
        // This is a placeholder for the analytics integration
    }
}