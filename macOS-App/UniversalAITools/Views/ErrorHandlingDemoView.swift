import SwiftUI
import Combine

// MARK: - Error Handling Demo View

/// Comprehensive demo view showing how to integrate the unified error handling system
struct ErrorHandlingDemoView: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    @StateObject private var sttService = EnhancedSTTService()
    @StateObject private var monitoringService = MonitoringServiceEnhanced()
    
    @State private var showingAnalytics = false
    @State private var selectedTab = 0
    
    var body: some View {
        NavigationView {
            TabView(selection: $selectedTab) {
                // Service Integration Demo
                ServiceIntegrationTab(
                    sttService: sttService,
                    monitoringService: monitoringService
                )
                .tabItem {
                    Label("Services", systemImage: "gear")
                }
                .tag(0)
                
                // Error Testing Tab
                ErrorTestingTab()
                .tabItem {
                    Label("Test Errors", systemImage: "exclamationmark.triangle")
                }
                .tag(1)
                
                // Analytics Tab
                ErrorAnalyticsTab()
                .tabItem {
                    Label("Analytics", systemImage: "chart.bar")
                }
                .tag(2)
                
                // Recovery Demo Tab
                RecoveryDemoTab()
                .tabItem {
                    Label("Recovery", systemImage: "wrench.and.screwdriver")
                }
                .tag(3)
            }
            .navigationTitle("Error Handling Demo")
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button("Clear All Errors") {
                        clearAllErrors()
                    }
                    .disabled(!errorSystem.hasError)
                    
                    Button("Analytics") {
                        showingAnalytics = true
                    }
                }
            }
        }
        .overlay {
            // Error presentation overlay
            ErrorPresenterView()
        }
        .sheet(isPresented: $showingAnalytics) {
            ErrorAnalyticsDetailView()
        }
    }
    
    private func clearAllErrors() {
        errorSystem.dismissCurrentError()
        sttService.clearError()
        monitoringService.clearError()
    }
}

// MARK: - Service Integration Tab

private struct ServiceIntegrationTab: View {
    @ObservedObject var sttService: EnhancedSTTService
    @ObservedObject var monitoringService: MonitoringServiceEnhanced
    
    @State private var isRecording = false
    @State private var transcription = ""
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // STT Service Demo
                ServiceDemoCard(
                    title: "Speech-to-Text Service",
                    status: sttService.getStatusMessage(),
                    hasError: sttService.hasError,
                    currentError: sttService.currentError
                ) {
                    VStack(spacing: 16) {
                        // Voice recording controls
                        VoiceRecordingSection(
                            sttService: sttService,
                            isRecording: $isRecording,
                            transcription: $transcription
                        )
                        
                        // Service controls
                        ServiceControlsSection(sttService: sttService)
                    }
                }
                
                // Monitoring Service Demo
                ServiceDemoCard(
                    title: "System Monitoring Service",
                    status: monitoringService.getHealthSummary(),
                    hasError: monitoringService.hasError,
                    currentError: monitoringService.currentError
                ) {
                    MonitoringControlsSection(monitoringService: monitoringService)
                }
                
                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Service Demo Card

private struct ServiceDemoCard<Content: View>: View {
    let title: String
    let status: String
    let hasError: Bool
    let currentError: AppError?
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                    
                    Text(status)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                // Status indicator
                Circle()
                    .fill(hasError ? Color.red : Color.green)
                    .frame(width: 12, height: 12)
            }
            
            // Error banner if present
            if let error = currentError {
                ErrorBannerView(error: error) {
                    // Error will be handled by the service
                }
            }
            
            Divider()
            
            // Content
            content
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.thinMaterial)
        )
    }
}

// MARK: - Voice Recording Section

private struct VoiceRecordingSection: View {
    @ObservedObject var sttService: EnhancedSTTService
    @Binding var isRecording: Bool
    @Binding var transcription: String
    
    var body: some View {
        VStack(spacing: 12) {
            // Recording button
            Button(action: toggleRecording) {
                VStack(spacing: 8) {
                    Image(systemName: isRecording ? "mic.fill" : "mic")
                        .font(.system(size: 32))
                        .foregroundColor(.white)
                        .frame(width: 64, height: 64)
                        .background(isRecording ? Color.red.gradient : Color.blue.gradient)
                        .clipShape(Circle())
                        .scaleEffect(isRecording ? 1.1 : 1.0)
                        .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: isRecording)
                    
                    Text(isRecording ? "Recording..." : "Tap to Record")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .buttonStyle(.plain)
            .disabled(!sttService.canStartListening() && !isRecording)
            
            // Transcription display
            if !transcription.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Transcription:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text(transcription)
                        .font(.body)
                        .padding()
                        .background(.gray.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            
            // Partial transcription
            if !sttService.partialTranscription.isEmpty && isRecording {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Listening:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text(sttService.partialTranscription)
                        .font(.body)
                        .foregroundColor(.blue)
                        .padding()
                        .background(.blue.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
    }
    
    private func toggleRecording() {
        if isRecording {
            sttService.stopListening()
            isRecording = false
        } else {
            isRecording = true
            
            Task {
                do {
                    try await sttService.startListening(
                        onComplete: { [transcription] result in
                            Task { @MainActor in
                                self.transcription = result
                                self.isRecording = false
                            }
                        },
                        onPartial: { _ in
                            // Partial results are automatically updated via @Published
                        }
                    )
                } catch {
                    await MainActor.run {
                        isRecording = false
                    }
                }
            }
        }
    }
}

// MARK: - Service Controls Section

private struct ServiceControlsSection: View {
    @ObservedObject var sttService: EnhancedSTTService
    
    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Service Controls")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
            }
            
            VStack(spacing: 8) {
                Toggle("Service Enabled", isOn: $sttService.isEnabled)
                
                if !sttService.isAuthorized {
                    Button("Request Permission") {
                        Task {
                            await sttService.requestAuthorization()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }
                
                if sttService.hasError {
                    Button("Retry Last Operation") {
                        Task {
                            await sttService.retryLastOperation()
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }
}

// MARK: - Monitoring Controls Section

private struct MonitoringControlsSection: View {
    @ObservedObject var monitoringService: MonitoringServiceEnhanced
    
    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Monitoring Controls")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Text(monitoringService.monitoringStatus.rawValue.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor.opacity(0.2))
                    .foregroundColor(statusColor)
                    .clipShape(Capsule())
            }
            
            HStack {
                Button(monitoringService.isMonitoring ? "Stop Monitoring" : "Start Monitoring") {
                    Task {
                        if monitoringService.isMonitoring {
                            monitoringService.stopMonitoring()
                        } else {
                            await monitoringService.startMonitoring()
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                
                Button("Manual Health Check") {
                    Task {
                        await monitoringService.performManualHealthCheck()
                    }
                }
                .buttonStyle(.bordered)
            }
            
            if monitoringService.hasError {
                Button("Attempt Recovery") {
                    Task {
                        await monitoringService.attemptRecovery()
                    }
                }
                .buttonStyle(.bordered)
            }
        }
    }
    
    private var statusColor: Color {
        switch monitoringService.monitoringStatus {
        case .running:
            return .green
        case .paused:
            return .orange
        case .error:
            return .red
        case .stopped:
            return .gray
        }
    }
}

// MARK: - Error Testing Tab

private struct ErrorTestingTab: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("Error Testing")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("Test different error scenarios to see the error handling system in action")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                    ForEach(TestErrorScenario.allCases, id: \.self) { scenario in
                        ErrorTestButton(scenario: scenario)
                    }
                }
                
                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Error Test Button

private struct ErrorTestButton: View {
    let scenario: TestErrorScenario
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        Button(action: { triggerError() }) {
            VStack(spacing: 8) {
                Image(systemName: scenario.iconName)
                    .font(.title2)
                    .foregroundColor(scenario.color)
                
                Text(scenario.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.center)
                
                Text(scenario.severity.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(.thinMaterial)
            )
        }
        .buttonStyle(.plain)
    }
    
    private func triggerError() {
        errorSystem.reportError(
            type: scenario.errorType,
            title: scenario.title,
            message: scenario.message,
            context: ErrorContext(
                feature: "ErrorTestingDemo",
                userAction: "Test Error Button"
            )
        )
    }
}

// MARK: - Test Error Scenarios

private enum TestErrorScenario: CaseIterable {
    case networkConnection
    case authenticationFailure
    case voiceProcessing
    case dataProcessing
    case systemError
    case criticalError
    
    var title: String {
        switch self {
        case .networkConnection:
            return "Network Error"
        case .authenticationFailure:
            return "Auth Error"
        case .voiceProcessing:
            return "Voice Error"
        case .dataProcessing:
            return "Data Error"
        case .systemError:
            return "System Error"
        case .criticalError:
            return "Critical Error"
        }
    }
    
    var message: String {
        switch self {
        case .networkConnection:
            return "This is a test network connection error to demonstrate error handling."
        case .authenticationFailure:
            return "This is a test authentication error to show auth error handling."
        case .voiceProcessing:
            return "This is a test voice processing error with recovery suggestions."
        case .dataProcessing:
            return "This is a test data processing error to demonstrate data error handling."
        case .systemError:
            return "This is a test system error to show system-level error handling."
        case .criticalError:
            return "This is a test critical error that requires immediate attention."
        }
    }
    
    var errorType: AppErrorType {
        switch self {
        case .networkConnection:
            return .networkConnection
        case .authenticationFailure:
            return .authenticationFailure
        case .voiceProcessing:
            return .voiceProcessing
        case .dataProcessing:
            return .dataProcessing
        case .systemError:
            return .systemError
        case .criticalError:
            return .systemError
        }
    }
    
    var severity: ErrorSeverity {
        switch self {
        case .networkConnection, .voiceProcessing, .dataProcessing:
            return .medium
        case .authenticationFailure, .systemError:
            return .high
        case .criticalError:
            return .critical
        }
    }
    
    var color: Color {
        return severity.color
    }
    
    var iconName: String {
        switch self {
        case .networkConnection:
            return "wifi.exclamationmark"
        case .authenticationFailure:
            return "lock.trianglebadge.exclamationmark"
        case .voiceProcessing:
            return "mic.badge.exclamationmark"
        case .dataProcessing:
            return "doc.badge.exclamationmark"
        case .systemError:
            return "exclamationmark.triangle"
        case .criticalError:
            return "xmark.octagon"
        }
    }
}

// MARK: - Error Analytics Tab

private struct ErrorAnalyticsTab: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("Error Analytics")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                AnalyticsStatsView()
                
                ErrorHistoryView()
                
                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Analytics Stats View

private struct AnalyticsStatsView: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        let analytics = errorSystem.errorAnalytics
        
        VStack(spacing: 16) {
            Text("Statistics")
                .font(.headline)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                StatCard(
                    title: "Total Errors",
                    value: "\(analytics.totalErrors)",
                    color: .red
                )
                
                StatCard(
                    title: "Recovery Rate",
                    value: "\(Int(analytics.recoverySuccessRate * 100))%",
                    color: .green
                )
                
                StatCard(
                    title: "Recovery Attempts",
                    value: "\(analytics.recoveryAttempts)",
                    color: .blue
                )
                
                StatCard(
                    title: "Successful Recoveries",
                    value: "\(analytics.successfulRecoveries)",
                    color: .green
                )
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.thinMaterial)
        )
    }
}

// MARK: - Stat Card

private struct StatCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(color.opacity(0.1))
        )
    }
}

// MARK: - Error History View

private struct ErrorHistoryView: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Errors")
                    .font(.headline)
                
                Spacer()
                
                Button("Export Data") {
                    exportErrorData()
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            
            if errorSystem.errorHistory.isEmpty {
                Text("No errors recorded")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(errorSystem.errorHistory.suffix(5), id: \.id) { error in
                    ErrorHistoryRow(error: error)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.thinMaterial)
        )
    }
    
    private func exportErrorData() {
        let exportData = errorSystem.exportErrorData()
        // In a real app, you would save this data or share it
        print("Error data exported: \(exportData)")
    }
}

// MARK: - Error History Row

private struct ErrorHistoryRow: View {
    let error: AppError
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(error.severity.color)
                .frame(width: 8, height: 8)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(error.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(error.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(error.category.rawValue)
                .font(.caption)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.gray.opacity(0.2))
                .clipShape(Capsule())
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Recovery Demo Tab

private struct RecoveryDemoTab: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    @State private var selectedError: AppError?
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("Recovery Demo")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("Demonstrates error recovery flows and user guidance")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                
                if let currentError = errorSystem.currentError {
                    RecoveryDemoCard(error: currentError)
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 48))
                            .foregroundColor(.green)
                        
                        Text("No Active Errors")
                            .font(.headline)
                        
                        Text("Trigger an error in the Test Errors tab to see recovery options")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(.thinMaterial)
                    )
                }
                
                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Recovery Demo Card

private struct RecoveryDemoCard: View {
    let error: AppError
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Error Info
            VStack(alignment: .leading, spacing: 8) {
                Text("Current Error")
                    .font(.headline)
                
                HStack {
                    Circle()
                        .fill(error.severity.color)
                        .frame(width: 12, height: 12)
                    
                    Text(error.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text(error.severity.displayName)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(error.severity.color.opacity(0.2))
                        .foregroundColor(error.severity.color)
                        .clipShape(Capsule())
                }
                
                Text(error.userMessage)
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            
            Divider()
            
            // Recovery Options
            VStack(alignment: .leading, spacing: 12) {
                Text("Recovery Options")
                    .font(.headline)
                
                if error.type.supportsAutomaticRecovery {
                    AutomaticRecoverySection(error: error)
                }
                
                if !error.recoverySuggestions.isEmpty {
                    RecoverySuggestionsView(suggestions: error.recoverySuggestions)
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.thinMaterial)
        )
    }
}

// MARK: - Error Analytics Detail View

private struct ErrorAnalyticsDetailView: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    AnalyticsStatsView()
                    
                    CategoryBreakdownView()
                    
                    SeverityBreakdownView()
                    
                    ErrorHistoryView()
                }
                .padding()
            }
            .navigationTitle("Error Analytics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Category Breakdown View

private struct CategoryBreakdownView: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        let analytics = errorSystem.errorAnalytics
        
        VStack(alignment: .leading, spacing: 12) {
            Text("Errors by Category")
                .font(.headline)
            
            if analytics.errorsByCategory.isEmpty {
                Text("No error data available")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                ForEach(Array(analytics.errorsByCategory.sorted(by: { $0.value > $1.value })), id: \.key) { category, count in
                    HStack {
                        Text(category.rawValue.capitalized)
                            .font(.subheadline)
                        
                        Spacer()
                        
                        Text("\(count)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.thinMaterial)
        )
    }
}

// MARK: - Severity Breakdown View

private struct SeverityBreakdownView: View {
    @StateObject private var errorSystem = UnifiedErrorHandlingSystem.shared
    
    var body: some View {
        let analytics = errorSystem.errorAnalytics
        
        VStack(alignment: .leading, spacing: 12) {
            Text("Errors by Severity")
                .font(.headline)
            
            if analytics.errorsBySeverity.isEmpty {
                Text("No error data available")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                ForEach(Array(analytics.errorsBySeverity.sorted(by: { $0.key.rawValue > $1.key.rawValue })), id: \.key) { severity, count in
                    HStack {
                        Circle()
                            .fill(severity.color)
                            .frame(width: 8, height: 8)
                        
                        Text(severity.displayName)
                            .font(.subheadline)
                        
                        Spacer()
                        
                        Text("\(count)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.thinMaterial)
        )
    }
}

// MARK: - Preview

#if DEBUG
struct ErrorHandlingDemoView_Previews: PreviewProvider {
    static var previews: some View {
        ErrorHandlingDemoView()
    }
}
#endif