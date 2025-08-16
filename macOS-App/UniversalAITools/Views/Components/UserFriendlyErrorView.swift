import SwiftUI

/// User-friendly error display component that shows errors in a non-technical way
struct UserFriendlyErrorView: View {
    let error: AppError
    let onRetry: (() -> Void)?
    let onDismiss: (() -> Void)?
    @State private var showTechnicalDetails = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Error icon with animation
            errorIcon
                .font(.system(size: 48))
                .foregroundColor(error.severity.color)
                .scaleEffect(showTechnicalDetails ? 1.1 : 1.0)
                .animation(.easeInOut(duration: 0.3), value: showTechnicalDetails)
            
            // User-friendly content
            VStack(spacing: 12) {
                Text(error.userFriendlyTitle)
                    .font(.title2)
                    .fontWeight(.semibold)
                    .multilineTextAlignment(.center)
                
                Text(error.userFriendlyMessage)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                
                if let suggestion = error.actionSuggestion {
                    Text(suggestion)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                        .padding(.top, 4)
                }
            }
            
            // Action buttons
            actionButtons
            
            // Technical details toggle (for advanced users)
            technicalDetailsSection
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
        .frame(maxWidth: 400)
    }
    
    private var errorIcon: some View {
        Group {
            switch error.type {
            case .networkError:
                Image(systemName: "wifi.slash")
            case .webSocketError:
                Image(systemName: "antenna.radiowaves.left.and.right.slash")
            case .dataProcessingError:
                Image(systemName: "gearshape.fill")
            case .systemFailure:
                Image(systemName: "exclamationmark.triangle.fill")
            case .uiError:
                Image(systemName: "display.trianglebadge.exclamationmark")
            case .recoveryFailed:
                Image(systemName: "arrow.clockwise.circle.fill")
            case .warning:
                Image(systemName: "info.circle.fill")
            }
        }
    }
    
    private var actionButtons: some View {
        HStack(spacing: 12) {
            // Retry button (if available)
            if let onRetry = onRetry {
                Button(action: onRetry) {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.clockwise")
                        Text("Try Again")
                    }
                    .font(.subheadline)
                    .fontWeight(.medium)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)
            }
            
            // Dismiss button (if available)
            if let onDismiss = onDismiss {
                Button(action: onDismiss) {
                    Text("Dismiss")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .buttonStyle(.bordered)
                .controlSize(.regular)
            }
            
            // Help button for critical errors
            if error.severity == .critical || error.severity == .high {
                Button(action: showHelpResources) {
                    HStack(spacing: 6) {
                        Image(systemName: "questionmark.circle")
                        Text("Help")
                    }
                    .font(.subheadline)
                    .fontWeight(.medium)
                }
                .buttonStyle(.bordered)
                .controlSize(.regular)
            }
        }
    }
    
    private var technicalDetailsSection: some View {
        VStack(spacing: 8) {
            Button(action: { showTechnicalDetails.toggle() }) {
                HStack {
                    Text("Technical Details")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Image(systemName: showTechnicalDetails ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .buttonStyle(.plain)
            
            if showTechnicalDetails {
                VStack(alignment: .leading, spacing: 6) {
                    technicalDetailRow("Error ID", error.id.uuidString.prefix(8).description)
                    technicalDetailRow("Type", error.type.rawValue)
                    technicalDetailRow("Category", error.category.rawValue)
                    technicalDetailRow("Severity", error.severity.rawValue)
                    technicalDetailRow("Time", formatTimestamp(error.timestamp))
                    
                    if !error.metadata.isEmpty {
                        Text("Metadata:")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .padding(.top, 4)
                        
                        ForEach(Array(error.metadata.keys.sorted()), id: \.self) { key in
                            if let value = error.metadata[key] {
                                technicalDetailRow(key, value)
                            }
                        }
                    }
                    
                    Text("Original Message:")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                    
                    Text(error.message)
                        .font(.caption2)
                        .fontFamily(.monospaced)
                        .foregroundColor(.secondary)
                        .padding(8)
                        .background(.quaternary)
                        .cornerRadius(6)
                }
                .padding()
                .background(.thinMaterial)
                .cornerRadius(8)
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: showTechnicalDetails)
    }
    
    private func technicalDetailRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text("\(label):")
                .font(.caption2)
                .foregroundColor(.secondary)
                .frame(width: 60, alignment: .leading)
            
            Text(value)
                .font(.caption2)
                .fontFamily(.monospaced)
                .foregroundColor(.secondary)
            
            Spacer()
        }
    }
    
    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
    
    private func showHelpResources() {
        // Open help documentation or support resources
        if let url = URL(string: "https://docs.universal-ai-tools.com/troubleshooting") {
            #if os(macOS)
            NSWorkspace.shared.open(url)
            #else
            UIApplication.shared.open(url)
            #endif
        }
    }
}

// MARK: - Error Banner for Non-Blocking Errors

struct ErrorBannerView: View {
    let error: AppError
    let onDismiss: () -> Void
    @State private var isVisible = true
    
    var body: some View {
        if isVisible {
            HStack {
                errorIcon
                    .font(.system(size: 20))
                    .foregroundColor(error.severity.color)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(error.userFriendlyTitle)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(error.userFriendlyMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                Spacer()
                
                Button(action: dismissBanner) {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .help("Dismiss")
            }
            .padding()
            .background(bannerBackgroundColor)
            .cornerRadius(8)
            .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
            .transition(.opacity.combined(with: .slide))
            .onAppear {
                // Auto-dismiss non-critical errors after 5 seconds
                if error.severity != .critical && error.severity != .high {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                        dismissBanner()
                    }
                }
            }
        }
    }
    
    private var errorIcon: some View {
        Group {
            switch error.type {
            case .networkError:
                Image(systemName: "wifi.slash")
            case .webSocketError:
                Image(systemName: "antenna.radiowaves.left.and.right.slash")
            case .dataProcessingError:
                Image(systemName: "gearshape")
            case .systemFailure:
                Image(systemName: "exclamationmark.triangle")
            case .uiError:
                Image(systemName: "display")
            case .recoveryFailed:
                Image(systemName: "arrow.clockwise")
            case .warning:
                Image(systemName: "info.circle")
            }
        }
    }
    
    private var bannerBackgroundColor: Color {
        switch error.severity {
        case .critical:
            return .red.opacity(0.1)
        case .high:
            return .orange.opacity(0.1)
        case .medium:
            return .yellow.opacity(0.1)
        case .low:
            return .blue.opacity(0.1)
        }
    }
    
    private func dismissBanner() {
        withAnimation(.easeInOut(duration: 0.3)) {
            isVisible = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            onDismiss()
        }
    }
}

// MARK: - Error Recovery Guidance View

struct ErrorRecoveryGuideView: View {
    let error: AppError
    let onStartRecovery: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "wrench.and.screwdriver")
                    .font(.title2)
                    .foregroundColor(.orange)
                
                Text("Recovery Options")
                    .font(.title3)
                    .fontWeight(.semibold)
            }
            
            Text("Here are some steps that might help resolve this issue:")
                .font(.body)
                .foregroundColor(.secondary)
            
            VStack(alignment: .leading, spacing: 12) {
                ForEach(recoverySteps, id: \.self) { step in
                    HStack(alignment: .top, spacing: 8) {
                        Circle()
                            .fill(.blue)
                            .frame(width: 6, height: 6)
                            .padding(.top, 6)
                        
                        Text(step)
                            .font(.subheadline)
                            .foregroundColor(.primary)
                    }
                }
            }
            
            HStack {
                Button("Start Automatic Recovery") {
                    onStartRecovery()
                }
                .buttonStyle(.borderedProminent)
                
                Spacer()
                
                Button("Contact Support") {
                    openSupportDialog()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(12)
    }
    
    private var recoverySteps: [String] {
        switch error.type {
        case .networkError:
            return [
                "Check your internet connection",
                "Try switching to a different network",
                "Restart your router if the problem persists",
                "Contact your network administrator if using corporate network"
            ]
        case .webSocketError:
            return [
                "Wait for automatic reconnection (usually takes 10-30 seconds)",
                "Check if the server is accessible",
                "Try refreshing the application",
                "Check firewall settings if the problem continues"
            ]
        case .dataProcessingError:
            return [
                "Try your request again with different data",
                "Reduce the complexity of your request",
                "Wait a moment and try again",
                "Clear application cache if available"
            ]
        default:
            return [
                "Try restarting the application",
                "Check for available updates",
                "Review system requirements",
                "Contact support if the problem persists"
            ]
        }
    }
    
    private func openSupportDialog() {
        // Open support contact options
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        UserFriendlyErrorView(
            error: AppError(
                type: .networkError,
                message: "URLSessionTask failed with error: The Internet connection appears to be offline.",
                category: .network,
                severity: .high,
                timestamp: Date(),
                metadata: ["endpoint": "/api/chat", "statusCode": "0"]
            ),
            onRetry: { print("Retry tapped") },
            onDismiss: { print("Dismiss tapped") }
        )
        
        ErrorBannerView(
            error: AppError(
                type: .warning,
                message: "WebSocket connection unstable",
                category: .webSocket,
                severity: .medium,
                timestamp: Date(),
                metadata: [:]
            ),
            onDismiss: { print("Banner dismissed") }
        )
    }
    .padding()
    .frame(width: 500, height: 600)
}