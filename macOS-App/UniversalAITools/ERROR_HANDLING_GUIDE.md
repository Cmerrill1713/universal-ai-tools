# Unified Error Handling System Guide

This guide explains how to use the new comprehensive error handling system implemented across the Universal AI Tools macOS application.

## Overview

The Unified Error Handling System provides:

- **Standardized error types and categories** - Consistent error classification across all services
- **User-friendly error descriptions with recovery suggestions** - Clear, actionable messages for users
- **Error context and analytics tracking** - Detailed error tracking for improvement insights
- **Consistent error presentation UI components** - Unified error display throughout the app
- **Automatic error recovery flows** - Smart recovery attempts with user guidance
- **Error analytics for monitoring** - Comprehensive error tracking and reporting

## Core Components

### 1. UnifiedErrorHandlingSystem

The central error handling service that manages all errors across the application.

```swift
@StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared

// Report an error
errorSystem.reportError(
    type: .networkConnection,
    title: "Connection Failed",
    message: "Unable to connect to the server",
    context: ErrorContext(feature: "ChatService", userAction: "Send Message")
)

// Attempt recovery
let success = await errorSystem.attemptRecovery(for: error)
```

### 2. ErrorHandlingServiceProtocol

Protocol that services should implement for consistent error handling.

```swift
class MyService: ObservableObject, ErrorHandlingServiceProtocol {
    public let errorSystem = UnifiedErrorHandlingSystem.shared
    @Published public var currentError: AppError?
    
    func performOperation() async {
        do {
            try await riskyOperation()
        } catch {
            reportError(
                error,
                context: ErrorContext(feature: "MyService", userAction: "Perform Operation")
            )
        }
    }
}
```

### 3. ServiceErrorHandler

A mixin class that provides error handling functionality to services.

```swift
class MyService: ObservableObject {
    private let serviceErrorHandler: ServiceErrorHandler
    
    init() {
        self.serviceErrorHandler = ServiceErrorHandler(serviceName: "MyService")
    }
    
    func performNetworkRequest() async {
        let result = await serviceErrorHandler.operation(userAction: "Network Request") {
            try await networkCall()
        }.executeWithRetry(maxRetries: 3)
    }
}
```

### 4. ErrorPresenterView

UI component that automatically displays errors to users.

```swift
var body: some View {
    ContentView()
        .overlay {
            ErrorPresenterView()
        }
}
```

## Error Types and Categories

### Error Types

The system defines comprehensive error types:

- **Network**: `networkConnection`, `networkUnavailable`, `requestTimeout`, `serverError`
- **Authentication**: `authenticationFailure`, `authorizationDenied`, `tokenExpired`
- **Data**: `dataProcessing`, `dataCorruption`, `invalidInput`
- **WebSocket**: `webSocketConnection`, `webSocketTimeout`, `realtimeSync`
- **Voice**: `voiceProcessing`, `audioInput`, `speechRecognition`
- **AI Services**: `aiService`, `modelLoading`, `inferenceFailure`
- **System**: `systemError`, `memoryError`, `performanceIssue`
- **UI**: `uiError`, `renderingError`

### Error Categories

Errors are grouped into categories for better organization:

- `network` - Network-related issues
- `security` - Authentication and authorization
- `dataProcessing` - Data handling and processing
- `webSocket` - Real-time communication
- `voice` - Voice processing and audio
- `aiService` - AI and ML services
- `system` - System-level issues
- `ui` - User interface problems

### Error Severity

Four severity levels determine how errors are presented:

- **Low** - Minor issues, shown as temporary banners
- **Medium** - Important issues, shown as dismissible banners
- **High** - Serious issues, shown as modal dialogs
- **Critical** - Critical issues, shown as non-dismissible modals

## Error Context

Provide rich context information with every error:

```swift
let context = ErrorContext(
    userId: currentUser?.id,
    sessionId: sessionManager.currentSessionId,
    feature: "ChatInterface",
    userAction: "Send Message",
    additionalData: [
        "messageLength": message.count,
        "conversationId": conversation.id
    ]
)
```

## Recovery Suggestions

Every error type includes contextual recovery suggestions:

```swift
let suggestions = [
    RecoverySuggestion(
        id: "retry",
        title: "Try Again",
        description: "Retry the failed operation",
        action: .retry,
        priority: .high
    ),
    RecoverySuggestion(
        id: "check_connection",
        title: "Check Connection",
        description: "Verify your internet connection",
        action: .checkNetworkConnection,
        priority: .medium
    )
]
```

## Integration Patterns

### 1. Service Integration

For new services, implement the `ErrorHandlingServiceProtocol`:

```swift
@MainActor
class MyNewService: ObservableObject, ErrorHandlingServiceProtocol {
    public let errorSystem = UnifiedErrorHandlingSystem.shared
    @Published public var currentError: AppError?
    
    private let serviceErrorHandler: ServiceErrorHandler
    
    init() {
        self.serviceErrorHandler = ServiceErrorHandler(serviceName: "MyNewService")
        setupErrorHandling()
    }
    
    private func setupErrorHandling() {
        serviceErrorHandler.$currentError
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.currentError = error
            }
            .store(in: &cancellables)
    }
    
    func performOperation() async {
        await serviceErrorHandler.operation(userAction: "Perform Operation") {
            try await self.riskyOperation()
        }.executeWithRetry(maxRetries: 2)
    }
}
```

### 2. Existing Service Enhancement

For existing services, add error handling gradually:

```swift
class ExistingService: ObservableObject {
    private let serviceErrorHandler = ServiceErrorHandler(serviceName: "ExistingService")
    
    func enhancedMethod() async {
        // Wrap existing operations with error handling
        let result = await serviceErrorHandler.operation(userAction: "Enhanced Method") {
            return try await existingRiskyOperation()
        }.execute()
        
        if let result = result {
            // Handle success
        }
        // Error handling is automatic
    }
}
```

### 3. UI Integration

In SwiftUI views, observe error states and show recovery options:

```swift
struct MyView: View {
    @ObservedObject var service: MyService
    
    var body: some View {
        VStack {
            // Your content
            
            if service.hasError, let error = service.currentError {
                ErrorBannerView(error: error) {
                    service.clearError()
                }
            }
        }
        .overlay {
            ErrorPresenterView() // Global error handling
        }
    }
}
```

## Error Analytics

Track and analyze errors for improvement:

```swift
// Get analytics data
let analytics = errorSystem.getErrorAnalytics()

print("Total errors: \(analytics.totalErrors)")
print("Recovery rate: \(analytics.recoverySuccessRate)")

// Export error data
let exportData = errorSystem.exportErrorData()
// Save or share the export data
```

## Best Practices

### 1. Error Reporting

- **Always provide context**: Include feature, user action, and relevant metadata
- **Use appropriate error types**: Choose the most specific error type available
- **Include recovery suggestions**: Provide actionable steps for users
- **Set correct severity**: Match severity to the impact on user experience

### 2. Error Messages

- **User-friendly language**: Avoid technical jargon
- **Actionable guidance**: Tell users what they can do
- **Contextual information**: Explain what was happening when the error occurred
- **Consistent tone**: Maintain a helpful, non-blaming tone

### 3. Recovery Strategies

- **Automatic recovery first**: Try to resolve issues without user intervention
- **Progressive disclosure**: Start with simple solutions, offer more complex ones if needed
- **Clear instructions**: Make recovery steps easy to follow
- **Feedback on recovery**: Let users know if recovery attempts succeed or fail

### 4. Testing

- **Test error scenarios**: Verify error handling works correctly
- **Test recovery flows**: Ensure recovery suggestions actually work
- **Test UI presentation**: Verify errors are displayed appropriately
- **Test analytics**: Confirm error tracking works as expected

## Error Presentation Guidelines

### Banner Errors (Low/Medium Severity)

- Appear at the top of the screen
- Include dismiss button
- Show primary recovery action
- Auto-dismiss for low severity after 5 seconds

### Modal Errors (High/Critical Severity)

- Block user interaction until addressed
- Show multiple recovery options
- Include detailed information tabs
- Critical errors prevent dismissal

### Recovery UI

- Prioritize suggestions by effectiveness
- Group related suggestions
- Provide progress feedback for recovery attempts
- Clear success/failure indicators

## Migration Guide

### For Existing Services

1. **Add error handler**: Create `ServiceErrorHandler` instance
2. **Wrap operations**: Use `operation()` method for error-prone code
3. **Update error handling**: Replace try/catch with error handler methods
4. **Add recovery**: Implement service-specific recovery methods
5. **Update UI**: Use new error presentation components

### For New Services

1. **Implement protocol**: Conform to `ErrorHandlingServiceProtocol`
2. **Use error handler**: Utilize `ServiceErrorHandler` for operations
3. **Define error types**: Use appropriate error types and categories
4. **Add context**: Provide rich error context information
5. **Test thoroughly**: Verify error handling and recovery flows

## Example Implementation

See `ErrorHandlingDemoView` for a comprehensive example showing:

- Service integration with error handling
- Error testing scenarios
- Analytics visualization
- Recovery flow demonstrations
- Error presentation patterns

## Troubleshooting

### Common Issues

1. **Errors not appearing**: Check if `ErrorPresenterView` is added to view hierarchy
2. **Recovery not working**: Verify recovery actions are implemented correctly
3. **Analytics not tracking**: Ensure `ContextAnalyticsService` integration is complete
4. **Performance issues**: Check if error handling is causing UI lag

### Debugging

- Enable detailed logging in error handlers
- Use error analytics to identify patterns
- Test error scenarios in isolation
- Verify error context information is complete

## Future Enhancements

Planned improvements to the error handling system:

- **Machine learning error prediction**: Predict and prevent errors before they occur
- **Advanced analytics**: More detailed error analysis and reporting
- **Custom recovery workflows**: User-defined recovery procedures
- **Error clustering**: Group related errors for better insights
- **Integration with external monitoring**: Connect to crash reporting services

## API Reference

### UnifiedErrorHandlingSystem

- `reportError()` - Report an error with context
- `presentError()` - Present an error to the user
- `dismissCurrentError()` - Dismiss the current error
- `attemptRecovery()` - Attempt automatic recovery
- `getErrorAnalytics()` - Get analytics data
- `exportErrorData()` - Export error data

### ErrorHandlingServiceProtocol

- `reportError()` - Report error with context
- `clearError()` - Clear current error
- `attemptRecovery()` - Attempt recovery

### ServiceErrorHandler

- `operation()` - Wrap operations with error handling
- `reportNetworkError()` - Report network-specific errors
- `reportAuthError()` - Report authentication errors
- `reportVoiceError()` - Report voice processing errors
- `reportAIServiceError()` - Report AI service errors

### Error UI Components

- `ErrorPresenterView` - Automatic error presentation
- `ErrorBannerView` - Error banner for non-critical errors
- `ErrorSheetView` - Modal error sheet for critical errors
- `RecoverySuggestionsView` - Recovery options display

This comprehensive error handling system ensures a consistent, user-friendly experience while providing valuable insights for improving application reliability and user satisfaction.