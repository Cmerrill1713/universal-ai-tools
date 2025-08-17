import Foundation
import Combine
import OSLog

// MARK: - Service Error Handling Protocol

/// Protocol that services should implement for consistent error handling
public protocol ErrorHandlingServiceProtocol: ObservableObject {
    /// The error handling system instance
    var errorSystem: UnifiedErrorHandlingSystem { get }
    
    /// Current error state
    var currentError: AppError? { get set }
    
    /// Whether the service is in an error state
    var hasError: Bool { get }
    
    /// Reports an error with context
    func reportError(
        _ error: Error,
        context: ErrorContext?,
        userAction: String?
    )
    
    /// Clears the current error
    func clearError()
    
    /// Attempts to recover from the current error
    func attemptRecovery() async -> Bool
}

// MARK: - Default Implementation

extension ErrorHandlingServiceProtocol {
    public var hasError: Bool {
        currentError != nil
    }
    
    public func reportError(
        _ error: Error,
        context: ErrorContext? = nil,
        userAction: String? = nil
    ) {
        let errorContext = context ?? ErrorContext(
            feature: String(describing: type(of: self)),
            userAction: userAction
        )
        
        errorSystem.reportError(
            error,
            context: errorContext,
            source: #file,
            function: #function,
            line: #line
        )
        
        // Update local error state
        currentError = errorSystem.currentError
    }
    
    public func clearError() {
        currentError = nil
        errorSystem.dismissCurrentError()
    }
    
    public func attemptRecovery() async -> Bool {
        guard let error = currentError else { return true }
        
        let success = await errorSystem.attemptRecovery(for: error)
        
        if success {
            clearError()
        }
        
        return success
    }
}

// MARK: - Service Error Handling Mixin

/// A mixin class that provides error handling functionality to services
@MainActor
public final class ServiceErrorHandler: ObservableObject {
    @Published public var currentError: AppError?
    
    public let errorSystem = UnifiedErrorHandlingSystem.shared
    private let serviceName: String
    private let logger: Logger
    
    public init(serviceName: String) {
        self.serviceName = serviceName
        self.logger = Logger(subsystem: "com.universalai.tools", category: serviceName)
        
        // Observe error system changes
        setupErrorObservation()
    }
    
    private func setupErrorObservation() {
        errorSystem.$currentError
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                // Only update if the error is related to this service
                if let error = error,
                   error.context.feature == self?.serviceName {
                    self?.currentError = error
                }
            }
            .store(in: &cancellables)
    }
    
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Error Reporting Methods
    
    /// Reports a network error with automatic categorization
    public func reportNetworkError(
        _ error: Error,
        endpoint: String? = nil,
        userAction: String? = nil
    ) {
        let context = ErrorContext(
            feature: serviceName,
            userAction: userAction,
            additionalData: endpoint.map { ["endpoint": $0] } ?? [:]
        )
        
        let appError = createNetworkError(from: error, context: context)
        errorSystem.handleAppError(appError)
        currentError = appError
        
        logger.error("Network error in \(serviceName): \(error.localizedDescription)")
    }
    
    /// Reports an authentication error
    public func reportAuthError(
        _ error: Error,
        userAction: String? = nil
    ) {
        let context = ErrorContext(
            feature: serviceName,
            userAction: userAction
        )
        
        let appError = AppError(
            id: UUID().uuidString,
            type: .authenticationFailure,
            category: .security,
            title: "Authentication Required",
            userMessage: "Please sign in to continue using this feature.",
            technicalDetails: error.localizedDescription,
            severity: .high,
            context: context,
            recoverySuggestions: AppErrorType.authenticationFailure.defaultRecoverySuggestions,
            timestamp: Date(),
            metadata: ["service": serviceName]
        )
        
        errorSystem.handleAppError(appError)
        currentError = appError
        
        logger.error("Authentication error in \(serviceName): \(error.localizedDescription)")
    }
    
    /// Reports a WebSocket error
    public func reportWebSocketError(
        _ error: Error,
        endpoint: String? = nil,
        userAction: String? = nil
    ) {
        let context = ErrorContext(
            feature: serviceName,
            userAction: userAction,
            additionalData: endpoint.map { ["endpoint": $0] } ?? [:]
        )
        
        let appError = AppError(
            id: UUID().uuidString,
            type: .webSocketConnection,
            category: .webSocket,
            title: "Connection Lost",
            userMessage: "Real-time connection was lost. Attempting to reconnect...",
            technicalDetails: error.localizedDescription,
            severity: .medium,
            context: context,
            recoverySuggestions: AppErrorType.webSocketConnection.defaultRecoverySuggestions,
            timestamp: Date(),
            metadata: [
                "service": serviceName,
                "endpoint": endpoint ?? "unknown"
            ]
        )
        
        errorSystem.handleAppError(appError)
        currentError = appError
        
        logger.error("WebSocket error in \(serviceName): \(error.localizedDescription)")
    }
    
    /// Reports a voice processing error
    public func reportVoiceError(
        _ error: Error,
        operation: String? = nil,
        userAction: String? = nil
    ) {
        let context = ErrorContext(
            feature: serviceName,
            userAction: userAction,
            additionalData: operation.map { ["operation": $0] } ?? [:]
        )
        
        let appError = AppError(
            id: UUID().uuidString,
            type: .voiceProcessing,
            category: .voice,
            title: "Voice Processing Error",
            userMessage: "Unable to process voice input. Please check your microphone and try again.",
            technicalDetails: error.localizedDescription,
            severity: .medium,
            context: context,
            recoverySuggestions: AppErrorType.voiceProcessing.defaultRecoverySuggestions,
            timestamp: Date(),
            metadata: [
                "service": serviceName,
                "operation": operation ?? "unknown"
            ]
        )
        
        errorSystem.handleAppError(appError)
        currentError = appError
        
        logger.error("Voice processing error in \(serviceName): \(error.localizedDescription)")
    }
    
    /// Reports an AI service error
    public func reportAIServiceError(
        _ error: Error,
        model: String? = nil,
        userAction: String? = nil
    ) {
        let context = ErrorContext(
            feature: serviceName,
            userAction: userAction,
            additionalData: model.map { ["model": $0] } ?? [:]
        )
        
        let appError = AppError(
            id: UUID().uuidString,
            type: .aiService,
            category: .aiService,
            title: "AI Service Unavailable",
            userMessage: "AI service is temporarily unavailable. Please try again in a moment.",
            technicalDetails: error.localizedDescription,
            severity: .medium,
            context: context,
            recoverySuggestions: AppErrorType.aiService.defaultRecoverySuggestions,
            timestamp: Date(),
            metadata: [
                "service": serviceName,
                "model": model ?? "unknown"
            ]
        )
        
        errorSystem.handleAppError(appError)
        currentError = appError
        
        logger.error("AI service error in \(serviceName): \(error.localizedDescription)")
    }
    
    /// Reports a data processing error
    public func reportDataError(
        _ error: Error,
        operation: String? = nil,
        userAction: String? = nil
    ) {
        let context = ErrorContext(
            feature: serviceName,
            userAction: userAction,
            additionalData: operation.map { ["operation": $0] } ?? [:]
        )
        
        let appError = AppError(
            id: UUID().uuidString,
            type: .dataProcessing,
            category: .dataProcessing,
            title: "Data Processing Error",
            userMessage: "Unable to process the data. This might be a temporary issue.",
            technicalDetails: error.localizedDescription,
            severity: .medium,
            context: context,
            recoverySuggestions: AppErrorType.dataProcessing.defaultRecoverySuggestions,
            timestamp: Date(),
            metadata: [
                "service": serviceName,
                "operation": operation ?? "unknown"
            ]
        )
        
        errorSystem.handleAppError(appError)
        currentError = appError
        
        logger.error("Data processing error in \(serviceName): \(error.localizedDescription)")
    }
    
    /// Reports a generic error with automatic type detection
    public func reportError(
        _ error: Error,
        userAction: String? = nil,
        additionalContext: [String: Any] = [:]
    ) {
        let context = ErrorContext(
            feature: serviceName,
            userAction: userAction,
            additionalData: additionalContext
        )
        
        errorSystem.reportError(error, context: context)
        currentError = errorSystem.currentError
        
        logger.error("Error in \(serviceName): \(error.localizedDescription)")
    }
    
    /// Clears the current error
    public func clearError() {
        currentError = nil
        errorSystem.dismissCurrentError()
    }
    
    /// Attempts recovery for the current error
    public func attemptRecovery() async -> Bool {
        guard let error = currentError else { return true }
        
        let success = await errorSystem.attemptRecovery(for: error)
        
        if success {
            clearError()
        }
        
        return success
    }
    
    // MARK: - Private Helpers
    
    private func createNetworkError(from error: Error, context: ErrorContext) -> AppError {
        let errorType: AppErrorType
        let userMessage: String
        
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet:
                errorType = .networkUnavailable
                userMessage = "No internet connection available. Please connect to the internet and try again."
            case .timedOut:
                errorType = .requestTimeout
                userMessage = "The request took too long to complete. Please try again."
            case .cannotFindHost, .cannotConnectToHost:
                errorType = .networkConnection
                userMessage = "Unable to connect to the server. Please check your connection and try again."
            default:
                errorType = .networkConnection
                userMessage = "A network error occurred. Please check your connection and try again."
            }
        } else {
            errorType = .networkConnection
            userMessage = "A network error occurred. Please check your connection and try again."
        }
        
        return AppError(
            id: UUID().uuidString,
            type: errorType,
            category: errorType.category,
            title: errorType.userFriendlyTitle,
            userMessage: userMessage,
            technicalDetails: error.localizedDescription,
            severity: errorType.defaultSeverity,
            context: context,
            recoverySuggestions: errorType.defaultRecoverySuggestions,
            timestamp: Date(),
            metadata: [
                "service": serviceName,
                "errorCode": "\((error as NSError).code)",
                "errorDomain": (error as NSError).domain
            ]
        )
    }
}

// MARK: - Service Extension Helpers

/// Extension to add error handling to existing services
extension UnifiedErrorHandlingSystem {
    /// Creates a service-specific error handler
    public func createServiceHandler(for serviceName: String) -> ServiceErrorHandler {
        return ServiceErrorHandler(serviceName: serviceName)
    }
    
    /// Handles an app error from any service
    internal func handleAppError(_ error: AppError) {
        // Add to history
        errorHistory.append(error)
        
        // Maintain history limit
        if errorHistory.count > maxErrorHistory {
            errorHistory.removeFirst(errorHistory.count - maxErrorHistory)
        }
        
        // Update analytics
        trackErrorAnalytics(error)
        
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
}

// MARK: - Convenience Extensions

extension ErrorHandlingServiceProtocol {
    /// Reports a network error with context
    public func reportNetworkError(
        _ error: Error,
        endpoint: String? = nil,
        userAction: String? = nil
    ) {
        let context = ErrorContext(
            feature: String(describing: type(of: self)),
            userAction: userAction,
            additionalData: endpoint.map { ["endpoint": $0] } ?? [:]
        )
        reportError(error, context: context, userAction: userAction)
    }
    
    /// Reports an authentication error
    public func reportAuthError(_ error: Error, userAction: String? = nil) {
        let context = ErrorContext(
            feature: String(describing: type(of: self)),
            userAction: userAction
        )
        reportError(error, context: context, userAction: userAction)
    }
    
    /// Reports a WebSocket error
    public func reportWebSocketError(
        _ error: Error,
        endpoint: String? = nil,
        userAction: String? = nil
    ) {
        let context = ErrorContext(
            feature: String(describing: type(of: self)),
            userAction: userAction,
            additionalData: endpoint.map { ["endpoint": $0] } ?? [:]
        )
        reportError(error, context: context, userAction: userAction)
    }
}

// MARK: - Error Handling Decorators

/// A decorator for wrapping service operations with error handling
@MainActor
public struct ServiceOperation<T> {
    private let operation: () async throws -> T
    private let errorHandler: ServiceErrorHandler
    private let userAction: String?
    private let context: [String: Any]
    
    public init(
        errorHandler: ServiceErrorHandler,
        userAction: String? = nil,
        context: [String: Any] = [:],
        operation: @escaping () async throws -> T
    ) {
        self.errorHandler = errorHandler
        self.userAction = userAction
        self.context = context
        self.operation = operation
    }
    
    /// Executes the operation with automatic error handling
    public func execute() async -> T? {
        do {
            let result = try await operation()
            errorHandler.clearError() // Clear any previous errors on success
            return result
        } catch {
            errorHandler.reportError(
                error,
                userAction: userAction,
                additionalContext: context
            )
            return nil
        }
    }
    
    /// Executes the operation with automatic error handling and retry
    public func executeWithRetry(maxRetries: Int = 3) async -> T? {
        var lastError: Error?
        
        for attempt in 1...maxRetries {
            do {
                let result = try await operation()
                errorHandler.clearError() // Clear any previous errors on success
                return result
            } catch {
                lastError = error
                
                if attempt < maxRetries {
                    // Wait before retry with exponential backoff
                    let delay = TimeInterval(pow(2.0, Double(attempt - 1)))
                    try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        // Report the final error after all retries failed
        if let error = lastError {
            errorHandler.reportError(
                error,
                userAction: userAction,
                additionalContext: context.merging(["retries": maxRetries]) { _, new in new }
            )
        }
        
        return nil
    }
}

// MARK: - Service Operation Builder

extension ServiceErrorHandler {
    /// Creates a wrapped operation with error handling
    public func operation<T>(
        userAction: String? = nil,
        context: [String: Any] = [:],
        _ operation: @escaping () async throws -> T
    ) -> ServiceOperation<T> {
        return ServiceOperation(
            errorHandler: self,
            userAction: userAction,
            context: context,
            operation: operation
        )
    }
}