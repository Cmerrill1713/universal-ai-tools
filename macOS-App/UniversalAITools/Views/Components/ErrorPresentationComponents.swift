import SwiftUI
import Combine

// MARK: - Error Presentation Components

/// Main error presentation view that automatically shows errors
public struct ErrorPresenterView: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    @State private var showingErrorSheet = false
    @State private var showingErrorBanner = false
    @State private var bannerTimer: Timer?
    
    public var body: some View {
        ZStack {
            // Content area - errors overlay on top
            Color.clear
            
            // Error banner for low-severity errors
            if showingErrorBanner, let error = errorSystem.currentError, error.severity <= .medium {
                VStack {
                    ErrorBannerView(error: error) {
                        dismissError()
                    }
                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(1000)
            }
        }
        .sheet(isPresented: $showingErrorSheet) {
            if let error = errorSystem.currentError {
                ErrorSheetView(error: error) {
                    dismissError()
                }
            }
        }
        .onReceive(errorSystem.$currentError) { error in
            if let error = error {
                handleErrorPresentation(error)
            } else {
                hideAllErrorPresentations()
            }
        }
    }
    
    private func handleErrorPresentation(_ error: AppError) {
        // Dismiss any existing presentations
        hideAllErrorPresentations()
        
        switch error.severity {
        case .low, .medium:
            // Show banner for less severe errors
            withAnimation(.easeInOut(duration: 0.3)) {
                showingErrorBanner = true
            }
            
            // Auto-dismiss after 5 seconds for low severity
            if error.severity == .low {
                bannerTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { _ in
                    dismissError()
                }
            }
            
        case .high, .critical:
            // Show modal sheet for severe errors
            showingErrorSheet = true
        }
    }
    
    private func hideAllErrorPresentations() {
        bannerTimer?.invalidate()
        bannerTimer = nil
        
        withAnimation(.easeInOut(duration: 0.3)) {
            showingErrorBanner = false
        }
        showingErrorSheet = false
    }
    
    private func dismissError() {
        hideAllErrorPresentations()
        errorSystem.dismissCurrentError()
    }
}

/// Banner view for non-critical errors
public struct ErrorBannerView: View {
    let error: AppError
    let onDismiss: () -> Void
    
    @State private var showingDetails = false
    
    public var body: some View {
        HStack(spacing: 12) {
            // Error icon
            Image(systemName: iconName)
                .foregroundColor(error.severity.color)
                .font(.title2)
            
            // Error content
            VStack(alignment: .leading, spacing: 4) {
                Text(error.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text(error.userMessage)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(showingDetails ? nil : 2)
            }
            
            Spacer()
            
            // Action buttons
            HStack(spacing: 8) {
                if !error.recoverySuggestions.isEmpty {
                    Button("Fix") {
                        handlePrimaryRecovery()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }
                
                Button("Details") {
                    showingDetails.toggle()
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.thinMaterial)
                .shadow(radius: 4)
        )
        .padding(.horizontal)
        .overlay(
            // Recovery suggestions
            Group {
                if showingDetails && !error.recoverySuggestions.isEmpty {
                    VStack {
                        Spacer()
                        RecoverySuggestionsView(
                            suggestions: error.recoverySuggestions,
                            compact: true
                        )
                        .padding(.top, 8)
                    }
                }
            }
        )
    }
    
    private var iconName: String {
        switch error.category {
        case .network:
            return "wifi.exclamationmark"
        case .security:
            return "lock.trianglebadge.exclamationmark"
        case .dataProcessing:
            return "doc.badge.exclamationmark"
        case .webSocket:
            return "bolt.horizontal.fill"
        case .fileSystem:
            return "folder.badge.exclamationmark"
        case .voice:
            return "mic.badge.exclamationmark"
        case .aiService:
            return "brain.head.profile"
        case .system:
            return "exclamationmark.triangle"
        case .ui:
            return "display"
        case .general:
            return "exclamationmark.circle"
        }
    }
    
    private func handlePrimaryRecovery() {
        guard let primarySuggestion = error.recoverySuggestions.first else { return }
        
        Task {
            await executeRecoveryAction(primarySuggestion.action)
        }
    }
}

/// Full-screen sheet for critical errors
public struct ErrorSheetView: View {
    let error: AppError
    let onDismiss: () -> Void
    
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    @State private var selectedTab = 0
    
    public var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header
                ErrorHeaderView(error: error)
                
                // Tabs
                TabView(selection: $selectedTab) {
                    // Overview tab
                    ErrorOverviewTab(error: error)
                        .tabItem {
                            Label("Overview", systemImage: "info.circle")
                        }
                        .tag(0)
                    
                    // Recovery tab
                    ErrorRecoveryTab(error: error)
                        .tabItem {
                            Label("Fix This", systemImage: "wrench.and.screwdriver")
                        }
                        .tag(1)
                    
                    // Technical details tab
                    ErrorTechnicalTab(error: error)
                        .tabItem {
                            Label("Details", systemImage: "text.alignleft")
                        }
                        .tag(2)
                }
            }
            .navigationTitle("Error Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done", action: onDismiss)
                }
            }
        }
        .interactiveDismissDisabled(error.severity == .critical)
    }
}

/// Error header with severity indicator
private struct ErrorHeaderView: View {
    let error: AppError
    
    var body: some View {
        VStack(spacing: 16) {
            // Severity indicator
            Image(systemName: severityIcon)
                .font(.system(size: 48))
                .foregroundColor(error.severity.color)
            
            // Title and message
            VStack(spacing: 8) {
                Text(error.title)
                    .font(.title2)
                    .fontWeight(.semibold)
                    .multilineTextAlignment(.center)
                
                Text(error.userMessage)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            // Severity badge
            HStack {
                Text(error.severity.displayName)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(error.severity.color.opacity(0.2))
                    .foregroundColor(error.severity.color)
                    .clipShape(Capsule())
                
                Text(error.category.rawValue.capitalized)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.gray.opacity(0.2))
                    .foregroundColor(.secondary)
                    .clipShape(Capsule())
            }
        }
        .padding()
        .background(.ultraThinMaterial)
    }
    
    private var severityIcon: String {
        switch error.severity {
        case .low:
            return "info.circle"
        case .medium:
            return "exclamationmark.triangle"
        case .high:
            return "exclamationmark.circle"
        case .critical:
            return "xmark.octagon"
        }
    }
}

/// Overview tab content
private struct ErrorOverviewTab: View {
    let error: AppError
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // What happened section
                VStack(alignment: .leading, spacing: 8) {
                    Text("What Happened")
                        .font(.headline)
                    
                    Text(error.userMessage)
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                
                // When it happened
                VStack(alignment: .leading, spacing: 8) {
                    Text("When")
                        .font(.headline)
                    
                    Text(error.timestamp, style: .complete)
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                
                // Context information
                if !error.context.feature.isNilOrEmpty || !error.context.userAction.isNilOrEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Context")
                            .font(.headline)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            if let feature = error.context.feature {
                                Label(feature, systemImage: "app.badge")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            
                            if let action = error.context.userAction {
                                Label(action, systemImage: "hand.tap")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                
                Spacer()
            }
            .padding()
        }
    }
}

/// Recovery tab content
private struct ErrorRecoveryTab: View {
    let error: AppError
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Automatic recovery section
                if error.type.supportsAutomaticRecovery {
                    AutomaticRecoverySection(error: error)
                }
                
                // Manual recovery suggestions
                if !error.recoverySuggestions.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Recovery Steps")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        RecoverySuggestionsView(suggestions: error.recoverySuggestions)
                    }
                }
                
                // Additional help
                AdditionalHelpSection()
                
                Spacer()
            }
            .padding(.vertical)
        }
    }
}

/// Technical details tab
private struct ErrorTechnicalTab: View {
    let error: AppError
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Error ID
                DetailRow(title: "Error ID", value: error.id)
                
                // Error Type
                DetailRow(title: "Type", value: error.type.rawValue)
                
                // Category
                DetailRow(title: "Category", value: error.category.rawValue)
                
                // Technical details
                VStack(alignment: .leading, spacing: 8) {
                    Text("Technical Details")
                        .font(.headline)
                    
                    Text(error.technicalDetails)
                        .font(.system(.caption, design: .monospaced))
                        .padding()
                        .background(.gray.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                
                // Metadata
                if !error.metadata.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Metadata")
                            .font(.headline)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(Array(error.metadata.sorted(by: { $0.key < $1.key })), id: \.key) { key, value in
                                DetailRow(title: key, value: value)
                            }
                        }
                    }
                }
                
                // Export button
                Button("Export Error Details") {
                    exportErrorDetails()
                }
                .buttonStyle(.bordered)
                .padding(.top)
                
                Spacer()
            }
            .padding()
        }
    }
    
    private func exportErrorDetails() {
        // Implementation for exporting error details
        let exportData = UnifiedErrorHandlingSystem.shared.exportErrorData()
        // Handle export (save to file, share, etc.)
    }
}

/// Row for displaying detail information
private struct DetailRow: View {
    let title: String
    let value: String
    
    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
            
            Spacer()
            
            Text(value)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 2)
    }
}

/// Recovery suggestions view
public struct RecoverySuggestionsView: View {
    let suggestions: [RecoverySuggestion]
    let compact: Bool
    
    init(suggestions: [RecoverySuggestion], compact: Bool = false) {
        self.suggestions = suggestions
        self.compact = compact
    }
    
    public var body: some View {
        VStack(spacing: compact ? 8 : 12) {
            ForEach(suggestions.sorted(by: { $0.priority.rawValue > $1.priority.rawValue })) { suggestion in
                RecoverySuggestionRow(suggestion: suggestion, compact: compact)
            }
        }
        .padding(.horizontal, compact ? 0 : 16)
    }
}

/// Individual recovery suggestion row
private struct RecoverySuggestionRow: View {
    let suggestion: RecoverySuggestion
    let compact: Bool
    
    @State private var isExecuting = false
    
    var body: some View {
        HStack(spacing: 12) {
            // Priority indicator
            Circle()
                .fill(priorityColor)
                .frame(width: 8, height: 8)
            
            // Content
            VStack(alignment: .leading, spacing: compact ? 2 : 4) {
                Text(suggestion.title)
                    .font(compact ? .subheadline : .headline)
                    .fontWeight(.medium)
                
                Text(suggestion.description)
                    .font(compact ? .caption : .subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Action button
            Button(action: executeAction) {
                if isExecuting {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text(suggestion.action.userFriendlyTitle)
                        .font(.subheadline)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(compact ? .small : .regular)
            .disabled(isExecuting)
        }
        .padding(compact ? 8 : 12)
        .background(
            RoundedRectangle(cornerRadius: compact ? 6 : 8)
                .fill(.ultraThinMaterial)
        )
    }
    
    private var priorityColor: Color {
        switch suggestion.priority {
        case .low:
            return .blue
        case .medium:
            return .orange
        case .high:
            return .red
        }
    }
    
    private func executeAction() {
        isExecuting = true
        
        Task {
            await executeRecoveryAction(suggestion.action)
            
            DispatchQueue.main.async {
                isExecuting = false
            }
        }
    }
}

/// Automatic recovery section
private struct AutomaticRecoverySection: View {
    let error: AppError
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    @State private var isAttemptingRecovery = false
    
    var body: some View {
        VStack(spacing: 12) {
            Text("Automatic Recovery")
                .font(.headline)
            
            Text("Let the app try to fix this automatically")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Button(action: attemptAutomaticRecovery) {
                HStack {
                    if isAttemptingRecovery || errorSystem.recoveryInProgress {
                        ProgressView()
                            .controlSize(.small)
                        Text("Attempting Recovery...")
                    } else {
                        Image(systemName: "wand.and.rays")
                        Text("Try Automatic Fix")
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isAttemptingRecovery || errorSystem.recoveryInProgress)
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
    
    private func attemptAutomaticRecovery() {
        isAttemptingRecovery = true
        
        Task {
            let success = await errorSystem.attemptRecovery(for: error)
            
            DispatchQueue.main.async {
                isAttemptingRecovery = false
                
                if success {
                    // Show success feedback
                    // Could trigger haptic feedback or show a success message
                }
            }
        }
    }
}

/// Additional help section
private struct AdditionalHelpSection: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("Need More Help?")
                .font(.headline)
            
            VStack(spacing: 12) {
                Button("View Documentation") {
                    // Open documentation
                }
                .buttonStyle(.bordered)
                
                Button("Contact Support") {
                    // Open support contact
                }
                .buttonStyle(.bordered)
                
                Button("Report Bug") {
                    // Open bug report
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

// MARK: - Helper Functions

/// Execute a recovery action
private func executeRecoveryAction(_ action: RecoveryAction) async {
    switch action {
    case .retry:
        // Implementation for retry
        break
    case .refresh:
        // Implementation for refresh
        NotificationCenter.default.post(name: .refreshCurrentView, object: nil)
    case .reconnect:
        // Implementation for reconnect
        NotificationCenter.default.post(name: .reconnectAllServices, object: nil)
    case .reauthenticate:
        // Implementation for reauthentication
        break
    case .checkNetworkConnection:
        // Implementation for network check
        break
    case .checkPermissions:
        // Implementation for permission check
        break
    case .clearCache:
        // Implementation for cache clearing
        NotificationCenter.default.post(name: .clearApplicationCache, object: nil)
    case .restartApp:
        // Implementation for app restart
        break
    case .contactSupport:
        // Implementation for support contact
        break
    }
}

// MARK: - Extensions

extension String? {
    var isNilOrEmpty: Bool {
        return self?.isEmpty ?? true
    }
}

extension Notification.Name {
    static let refreshCurrentView = Notification.Name("refreshCurrentView")
}

// MARK: - Preview Helpers

#if DEBUG
extension AppError {
    static let sampleNetworkError = AppError(
        id: "sample-network",
        type: .networkConnection,
        category: .network,
        title: "Connection Issue",
        userMessage: "Unable to connect to the server. Please check your internet connection and try again.",
        technicalDetails: "URLError: The Internet connection appears to be offline.",
        severity: .medium,
        context: ErrorContext(feature: "Chat", userAction: "Send Message"),
        recoverySuggestions: AppErrorType.networkConnection.defaultRecoverySuggestions,
        timestamp: Date(),
        metadata: ["endpoint": "/api/chat", "status": "timeout"]
    )
    
    static let sampleCriticalError = AppError(
        id: "sample-critical",
        type: .systemError,
        category: .system,
        title: "System Error",
        userMessage: "A critical system error occurred that requires immediate attention.",
        technicalDetails: "Fatal exception in core module",
        severity: .critical,
        context: ErrorContext(),
        recoverySuggestions: [],
        timestamp: Date(),
        metadata: ["module": "core", "stack": "trace..."]
    )
}

struct ErrorPresentationComponents_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            ErrorBannerView(error: .sampleNetworkError) { }
                .previewDisplayName("Error Banner")
            
            ErrorSheetView(error: .sampleCriticalError) { }
                .previewDisplayName("Error Sheet")
            
            RecoverySuggestionsView(suggestions: AppErrorType.networkConnection.defaultRecoverySuggestions)
                .previewDisplayName("Recovery Suggestions")
        }
    }
}
#endif