import SwiftUI

/// User-friendly error handling with guided recovery flows
struct ErrorRecoveryView: View {
    let error: AppError
    let onRetry: () -> Void
    let onDismiss: () -> Void
    
    @State private var showTechnicalDetails = false
    @State private var isRetrying = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Error icon
            Image(systemName: error.iconName)
                .font(.system(size: 48))
                .foregroundColor(error.color)
                .background(
                    Circle()
                        .fill(error.color.opacity(0.1))
                        .frame(width: 80, height: 80)
                )
            
            // User-friendly title
            Text(error.friendlyTitle)
                .font(.title2)
                .fontWeight(.semibold)
                .multilineTextAlignment(.center)
            
            // User-friendly description
            Text(error.friendlyDescription)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            // Recovery suggestions
            if !error.recoverySuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("What you can try:")
                        .font(.headline)
                        .fontWeight(.medium)
                    
                    ForEach(error.recoverySuggestions, id: \.self) { suggestion in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "lightbulb.fill")
                                .font(.caption)
                                .foregroundColor(.yellow)
                                .frame(width: 16)
                            
                            Text(suggestion)
                                .font(.callout)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(12)
            }
            
            // Action buttons
            HStack(spacing: 16) {
                // Secondary action (dismiss)
                Button("Not Now") {
                    onDismiss()
                }
                .buttonStyle(.bordered)
                
                // Primary action (retry)
                Button(action: {
                    Task {
                        isRetrying = true
                        onRetry()
                        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
                        isRetrying = false
                    }
                }) {
                    HStack {
                        if isRetrying {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        Text(isRetrying ? "Retrying..." : error.retryButtonText)
                    }
                    .frame(minWidth: 100)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isRetrying)
            }
            
            // Technical details toggle
            DisclosureGroup("Technical Details", isExpanded: $showTechnicalDetails) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Error Code: \(error.code)")
                        .font(.caption)
                        .fontFamily(.monospaced)
                    
                    Text("Technical Description:")
                        .font(.caption)
                        .fontWeight(.medium)
                    
                    Text(error.technicalDescription)
                        .font(.caption)
                        .fontFamily(.monospaced)
                        .foregroundColor(.secondary)
                        .textSelection(.enabled)
                    
                    if let underlyingError = error.underlyingError {
                        Text("Underlying Error:")
                            .font(.caption)
                            .fontWeight(.medium)
                            .padding(.top, 4)
                        
                        Text(underlyingError.localizedDescription)
                            .font(.caption)
                            .fontFamily(.monospaced)
                            .foregroundColor(.secondary)
                            .textSelection(.enabled)
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(8)
            }
            .padding(.top)
        }
        .padding(24)
        .frame(maxWidth: 400)
        .background(.regularMaterial)
        .cornerRadius(16)
        .shadow(radius: 20)
    }
}

/// Comprehensive error type with user-friendly messaging
enum AppError: Error, Identifiable {
    case networkConnection(Error?)
    case serverUnavailable(Error?)
    case authenticationFailed(Error?)
    case dataCorrupted(Error?)
    case agentOrchestrationFailed(Error?)
    case webSocketConnectionFailed(Error?)
    case insufficientPermissions(Error?)
    case resourceUnavailable(Error?)
    case configurationError(Error?)
    case unknown(Error?)
    
    var id: String {
        code
    }
    
    var code: String {
        switch self {
        case .networkConnection: return "NET_001"
        case .serverUnavailable: return "SRV_001"
        case .authenticationFailed: return "AUTH_001"
        case .dataCorrupted: return "DATA_001"
        case .agentOrchestrationFailed: return "AGENT_001"
        case .webSocketConnectionFailed: return "WS_001"
        case .insufficientPermissions: return "PERM_001"
        case .resourceUnavailable: return "RES_001"
        case .configurationError: return "CFG_001"
        case .unknown: return "UNK_001"
        }
    }
    
    var iconName: String {
        switch self {
        case .networkConnection: return "wifi.exclamationmark"
        case .serverUnavailable: return "server.rack"
        case .authenticationFailed: return "person.crop.circle.badge.exclamationmark"
        case .dataCorrupted: return "externaldrive.badge.exclamationmark"
        case .agentOrchestrationFailed: return "brain.head.profile.fill"
        case .webSocketConnectionFailed: return "antenna.radiowaves.left.and.right.slash"
        case .insufficientPermissions: return "lock.fill"
        case .resourceUnavailable: return "exclamationmark.triangle.fill"
        case .configurationError: return "gearshape.fill"
        case .unknown: return "questionmark.circle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .networkConnection: return .orange
        case .serverUnavailable: return .red
        case .authenticationFailed: return .purple
        case .dataCorrupted: return .red
        case .agentOrchestrationFailed: return .blue
        case .webSocketConnectionFailed: return .orange
        case .insufficientPermissions: return .yellow
        case .resourceUnavailable: return .orange
        case .configurationError: return .blue
        case .unknown: return .gray
        }
    }
    
    var friendlyTitle: String {
        switch self {
        case .networkConnection: return "Connection Problem"
        case .serverUnavailable: return "Service Temporarily Unavailable"
        case .authenticationFailed: return "Sign-In Required"
        case .dataCorrupted: return "Data Issue Detected"
        case .agentOrchestrationFailed: return "Agent System Unavailable"
        case .webSocketConnectionFailed: return "Real-Time Updates Unavailable"
        case .insufficientPermissions: return "Permission Required"
        case .resourceUnavailable: return "Feature Temporarily Unavailable"
        case .configurationError: return "Configuration Issue"
        case .unknown: return "Something Went Wrong"
        }
    }
    
    var friendlyDescription: String {
        switch self {
        case .networkConnection:
            return "We're having trouble connecting to the internet. Please check your network connection and try again."
        case .serverUnavailable:
            return "Our servers are currently experiencing high traffic. We're working to resolve this quickly."
        case .authenticationFailed:
            return "Your session has expired or authentication failed. Please sign in again to continue."
        case .dataCorrupted:
            return "Some data appears to be corrupted or incomplete. We'll try to recover it automatically."
        case .agentOrchestrationFailed:
            return "The AI agent system is currently unavailable. This might be temporary - please try again in a moment."
        case .webSocketConnectionFailed:
            return "Real-time updates aren't working right now. You can still use the app, but some data might not be live."
        case .insufficientPermissions:
            return "This feature requires additional permissions. Please check your account settings or contact support."
        case .resourceUnavailable:
            return "This feature is temporarily unavailable due to high demand. Please try again later."
        case .configurationError:
            return "There's an issue with the app configuration. Try restarting the app or checking your settings."
        case .unknown:
            return "An unexpected error occurred. Don't worry - this has been reported and we're looking into it."
        }
    }
    
    var technicalDescription: String {
        switch self {
        case .networkConnection(let error):
            return error?.localizedDescription ?? "Network connectivity failure"
        case .serverUnavailable(let error):
            return error?.localizedDescription ?? "HTTP 503 or connection timeout"
        case .authenticationFailed(let error):
            return error?.localizedDescription ?? "Authentication token invalid or expired"
        case .dataCorrupted(let error):
            return error?.localizedDescription ?? "JSON decode failure or data validation error"
        case .agentOrchestrationFailed(let error):
            return error?.localizedDescription ?? "Agent orchestration service connection failure"
        case .webSocketConnectionFailed(let error):
            return error?.localizedDescription ?? "WebSocket connection establishment failed"
        case .insufficientPermissions(let error):
            return error?.localizedDescription ?? "HTTP 403 or insufficient API key permissions"
        case .resourceUnavailable(let error):
            return error?.localizedDescription ?? "HTTP 429 or resource limit exceeded"
        case .configurationError(let error):
            return error?.localizedDescription ?? "Invalid configuration parameters"
        case .unknown(let error):
            return error?.localizedDescription ?? "Unhandled exception"
        }
    }
    
    var recoverySuggestions: [String] {
        switch self {
        case .networkConnection:
            return [
                "Check your Wi-Fi or ethernet connection",
                "Try switching between Wi-Fi and cellular data",
                "Restart your network adapter",
                "Contact your network administrator if on a corporate network"
            ]
        case .serverUnavailable:
            return [
                "Wait a few minutes and try again",
                "Check our status page for known issues",
                "Try refreshing the page or restarting the app"
            ]
        case .authenticationFailed:
            return [
                "Sign out and sign back in",
                "Check if your account is still active",
                "Clear your browser cache if using the web version"
            ]
        case .dataCorrupted:
            return [
                "Try refreshing the data",
                "Clear the app cache and restart",
                "Check if you have sufficient storage space"
            ]
        case .agentOrchestrationFailed:
            return [
                "Wait a moment and try connecting again",
                "Check if the backend service is running",
                "Verify your connection settings"
            ]
        case .webSocketConnectionFailed:
            return [
                "Check your firewall settings",
                "Try using a different network",
                "The app will work without real-time updates"
            ]
        case .insufficientPermissions:
            return [
                "Contact your administrator for access",
                "Check your account subscription level",
                "Verify your API key has the right permissions"
            ]
        case .resourceUnavailable:
            return [
                "Try again in a few minutes",
                "Use the feature during off-peak hours",
                "Consider upgrading your plan for priority access"
            ]
        case .configurationError:
            return [
                "Check your app settings",
                "Try resetting to default configuration",
                "Reinstall the app if the problem persists"
            ]
        case .unknown:
            return [
                "Try restarting the app",
                "Check for app updates",
                "Contact support if the problem persists"
            ]
        }
    }
    
    var retryButtonText: String {
        switch self {
        case .networkConnection: return "Try Again"
        case .serverUnavailable: return "Retry"
        case .authenticationFailed: return "Sign In"
        case .dataCorrupted: return "Refresh"
        case .agentOrchestrationFailed: return "Reconnect"
        case .webSocketConnectionFailed: return "Reconnect"
        case .insufficientPermissions: return "Check Settings"
        case .resourceUnavailable: return "Try Again"
        case .configurationError: return "Reset"
        case .unknown: return "Try Again"
        }
    }
    
    var underlyingError: Error? {
        switch self {
        case .networkConnection(let error): return error
        case .serverUnavailable(let error): return error
        case .authenticationFailed(let error): return error
        case .dataCorrupted(let error): return error
        case .agentOrchestrationFailed(let error): return error
        case .webSocketConnectionFailed(let error): return error
        case .insufficientPermissions(let error): return error
        case .resourceUnavailable(let error): return error
        case .configurationError(let error): return error
        case .unknown(let error): return error
        }
    }
}

/// Error recovery helper that converts system errors to user-friendly ones
extension AppError {
    static func fromConnectionError(_ error: Error) -> AppError {
        let nsError = error as NSError
        
        switch nsError.code {
        case NSURLErrorNotConnectedToInternet,
             NSURLErrorNetworkConnectionLost:
            return .networkConnection(error)
        case NSURLErrorTimedOut,
             NSURLErrorCannotConnectToHost:
            return .serverUnavailable(error)
        case NSURLErrorUserAuthenticationRequired:
            return .authenticationFailed(error)
        case NSURLErrorCannotDecodeContentData,
             NSURLErrorBadServerResponse:
            return .dataCorrupted(error)
        default:
            return .unknown(error)
        }
    }
    
    static func fromWebSocketError(_ error: Error) -> AppError {
        return .webSocketConnectionFailed(error)
    }
    
    static func fromDecodingError(_ error: Error) -> AppError {
        return .dataCorrupted(error)
    }
}

#Preview {
    ErrorRecoveryView(
        error: .agentOrchestrationFailed(nil),
        onRetry: { print("Retry") },
        onDismiss: { print("Dismiss") }
    )
    .frame(width: 500, height: 600)
    .background(.ultraThinMaterial)
}