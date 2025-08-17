import SwiftUI
import Combine

/// Enhanced Error Recovery System with step-by-step guided assistance
@MainActor
struct GuidedErrorRecoveryView: View {
    let error: AppError
    let onRecoveryComplete: () -> Void
    let onDismiss: () -> Void
    
    @StateObject private var recoveryManager = ErrorRecoveryManager()
    @State private var currentStep = 0
    @State private var isRecovering = false
    @State private var showAdvancedOptions = false
    @State private var userChosenStrategy: RecoveryStrategy?
    
    var body: some View {
        VStack(spacing: 24) {
            // Header
            recoveryHeader
            
            // Progress indicator
            if isRecovering {
                progressIndicator
            } else {
                // Recovery options selector
                recoveryOptionsSection
                
                // Step-by-step guide
                if let strategy = userChosenStrategy {
                    recoveryStepsSection(for: strategy)
                }
                
                // Action buttons
                actionButtonsSection
                
                // Advanced options
                advancedOptionsSection
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 20)
        .background(.regularMaterial)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 12, x: 0, y: 6)
        .frame(maxWidth: 600)
        .onReceive(recoveryManager.$recoveryStatus) { status in
            handleRecoveryStatusChange(status)
        }
    }
    
    // MARK: - Header Section
    
    private var recoveryHeader: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "wrench.and.screwdriver.fill")
                    .font(.title)
                    .foregroundColor(.orange)
                    .background(
                        Circle()
                            .fill(.orange.opacity(0.1))
                            .frame(width: 44, height: 44)
                    )
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Error Recovery Assistant")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    Text("Let's fix this together")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .help("Close recovery assistant")
            }
            
            // Error summary
            ErrorSummaryCard(error: error)
        }
    }
    
    // MARK: - Progress Indicator
    
    private var progressIndicator: some View {
        VStack(spacing: 16) {
            ProgressView(value: recoveryManager.recoveryProgress)
                .progressViewStyle(LinearProgressViewStyle(tint: .orange))
            
            HStack {
                Text(recoveryManager.currentStatusMessage)
                    .font(.body)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text("\(Int(recoveryManager.recoveryProgress * 100))%")
                    .font(.caption)
                    .fontDesign(.monospaced)
                    .foregroundColor(.secondary)
            }
            
            if let currentAction = recoveryManager.currentAction {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    
                    Text(currentAction)
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Recovery Options Section
    
    private var recoveryOptionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Choose a Recovery Method")
                .font(.headline)
                .fontWeight(.semibold)
            
            let suggestedStrategies = recoveryManager.getSuggestedStrategies(for: error)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                ForEach(suggestedStrategies, id: \.self) { strategy in
                    RecoveryOptionCard(
                        strategy: strategy,
                        isSelected: userChosenStrategy == strategy,
                        onSelect: { userChosenStrategy = strategy }
                    )
                }
            }
        }
    }
    
    // MARK: - Recovery Steps Section
    
    private func recoveryStepsSection(for strategy: RecoveryStrategy) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Recovery Steps")
                .font(.headline)
                .fontWeight(.semibold)
            
            let steps = recoveryManager.getRecoverySteps(for: strategy, error: error)
            
            VStack(spacing: 12) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    RecoveryStepRow(
                        step: step,
                        stepNumber: index + 1,
                        isActive: index == currentStep,
                        isCompleted: index < currentStep
                    )
                }
            }
        }
    }
    
    // MARK: - Action Buttons Section
    
    private var actionButtonsSection: some View {
        HStack(spacing: 12) {
            // Manual recovery
            if userChosenStrategy != nil {
                Button("Start Manual Recovery") {
                    startManualRecovery()
                }
                .buttonStyle(.bordered)
                .controlSize(.regular)
            }
            
            // Automatic recovery
            if let strategy = userChosenStrategy {
                Button("Start Automatic Recovery") {
                    startAutomaticRecovery(strategy: strategy)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)
                .disabled(isRecovering)
            }
            
            Spacer()
            
            // Help button
            Button("Get Help") {
                openHelpResources()
            }
            .buttonStyle(.bordered)
            .controlSize(.regular)
        }
    }
    
    // MARK: - Advanced Options Section
    
    private var advancedOptionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: { showAdvancedOptions.toggle() }) {
                HStack {
                    Text("Advanced Options")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Image(systemName: showAdvancedOptions ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .buttonStyle(.plain)
            
            if showAdvancedOptions {
                VStack(alignment: .leading, spacing: 12) {
                    // Reset to defaults
                    Button("Reset All Settings to Default") {
                        resetToDefaults()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    
                    // Export error report
                    Button("Export Error Report") {
                        exportErrorReport()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    
                    // Contact support
                    Button("Contact Support") {
                        contactSupport()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    
                    // Error details
                    DisclosureGroup("Technical Details") {
                        ErrorDetailsView(error: error)
                    }
                    .font(.caption)
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(8)
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
        .animation(.easeInOut(duration: 0.3), value: showAdvancedOptions)
    }
    
    // MARK: - Helper Functions
    
    private func startManualRecovery() {
        guard let strategy = userChosenStrategy else { return }
        
        // Show step-by-step manual process
        let steps = recoveryManager.getRecoverySteps(for: strategy, error: error)
        
        // Start guided manual recovery
        recoveryManager.startManualRecovery(strategy: strategy, steps: steps)
    }
    
    private func startAutomaticRecovery(strategy: RecoveryStrategy) {
        isRecovering = true
        
        Task {
            await recoveryManager.executeAutomaticRecovery(
                strategy: strategy,
                error: error
            )
        }
    }
    
    private func handleRecoveryStatusChange(_ status: RecoveryStatus) {
        switch status {
        case .completed:
            isRecovering = false
            onRecoveryComplete()
            
        case .failed(let errorMessage):
            isRecovering = false
            // Show failure message and suggest alternative approaches
            showRecoveryFailure(errorMessage)
            
        case .inProgress:
            isRecovering = true
            
        case .idle:
            isRecovering = false
        }
    }
    
    private func showRecoveryFailure(_ message: String) {
        ErrorHandler.shared.logError(AppError(
            type: .recoveryFailed,
            message: message,
            category: .system,
            severity: .high,
            timestamp: Date(),
            metadata: ["originalError": error.message]
        ))
    }
    
    private func resetToDefaults() {
        Task {
            await recoveryManager.resetToDefaults()
        }
    }
    
    private func exportErrorReport() {
        let report = generateErrorReport()
        
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = "error-report-\(Date().timeIntervalSince1970).json"
        savePanel.allowedContentTypes = [.json]
        
        if savePanel.runModal() == .OK {
            guard let url = savePanel.url else { return }
            
            do {
                try report.write(to: url, atomically: true, encoding: .utf8)
            } catch {
                ErrorHandler.shared.logError(AppError(
                    type: .systemFailure,
                    message: "Failed to export error report: \(error.localizedDescription)",
                    category: .system,
                    severity: .medium,
                    timestamp: Date(),
                    metadata: [:]
                ))
            }
        }
    }
    
    private func generateErrorReport() -> String {
        let report = [
            "timestamp": Date().timeIntervalSince1970,
            "error": [
                "id": error.id.uuidString,
                "type": error.type.rawValue,
                "message": error.message,
                "category": error.category.rawValue,
                "severity": error.severity.rawValue,
                "metadata": error.metadata
            ],
            "system": [
                "platform": "macOS",
                "version": ProcessInfo.processInfo.operatingSystemVersionString,
                "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
            ]
        ]
        
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: .prettyPrinted),
              let jsonString = String(data: data, encoding: .utf8) else {
            return "Error generating report"
        }
        
        return jsonString
    }
    
    private func contactSupport() {
        let supportEmail = "support@universal-ai-tools.com"
        let subject = "Error Report: \(error.userFriendlyTitle)"
        let body = generateErrorReport()
        
        if let url = URL(string: "mailto:\(supportEmail)?subject=\(subject.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")&body=\(body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
            NSWorkspace.shared.open(url)
        }
    }
    
    private func openHelpResources() {
        if let url = URL(string: "https://docs.universal-ai-tools.com/troubleshooting/\(error.type.rawValue)") {
            NSWorkspace.shared.open(url)
        }
    }
}

// MARK: - Supporting Views

struct ErrorSummaryCard: View {
    let error: AppError
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: error.severity.icon)
                .font(.title2)
                .foregroundColor(error.severity.color)
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(error.severity.color.opacity(0.1))
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text(error.userFriendlyTitle)
                    .font(.headline)
                    .fontWeight(.medium)
                
                Text(error.userFriendlyMessage)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(error.severity.rawValue.uppercased())
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(error.severity.color)
                
                Text(formatRelativeTime(error.timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct RecoveryOptionCard: View {
    let strategy: RecoveryStrategy
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: strategy.icon)
                        .font(.title3)
                        .foregroundColor(isSelected ? .orange : .primary)
                    
                    Spacer()
                    
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.body)
                            .foregroundColor(.orange)
                    }
                }
                
                Text(strategy.displayName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.leading)
                
                Text(strategy.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? .orange.opacity(0.1) : .clear)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? .orange : .gray.opacity(0.3), lineWidth: isSelected ? 2 : 1)
            )
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

struct RecoveryStepRow: View {
    let step: RecoveryStep
    let stepNumber: Int
    let isActive: Bool
    let isCompleted: Bool
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Step indicator
            ZStack {
                Circle()
                    .fill(stepBackgroundColor)
                    .frame(width: 24, height: 24)
                
                if isCompleted {
                    Image(systemName: "checkmark")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                } else {
                    Text("\(stepNumber)")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(stepTextColor)
                }
            }
            
            VStack(alignment: .leading, spacing: 6) {
                Text(step.title)
                    .font(.subheadline)
                    .fontWeight(isActive ? .semibold : .regular)
                    .foregroundColor(isActive ? .primary : .secondary)
                
                Text(step.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                
                if isActive && !step.userActions.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(step.userActions, id: \.self) { action in
                            Text("• \(action)")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                    }
                    .padding(.top, 4)
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(isActive ? .orange.opacity(0.05) : .clear)
        .cornerRadius(8)
        .animation(.easeInOut(duration: 0.3), value: isActive)
    }
    
    private var stepBackgroundColor: Color {
        if isCompleted {
            return .green
        } else if isActive {
            return .orange
        } else {
            return .gray.opacity(0.3)
        }
    }
    
    private var stepTextColor: Color {
        if isCompleted || isActive {
            return .white
        } else {
            return .secondary
        }
    }
}

struct ErrorDetailsView: View {
    let error: AppError
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            DetailRow(label: "Error ID", value: error.id.uuidString.prefix(8).description)
            DetailRow(label: "Type", value: error.type.rawValue)
            DetailRow(label: "Category", value: error.category.rawValue)
            DetailRow(label: "Severity", value: error.severity.rawValue)
            DetailRow(label: "Timestamp", value: DateFormatter.localizedString(from: error.timestamp, dateStyle: .short, timeStyle: .medium))
            
            if !error.metadata.isEmpty {
                Text("Metadata:")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .padding(.top, 4)
                
                ForEach(Array(error.metadata.keys.sorted()), id: \.self) { key in
                    DetailRow(label: key, value: error.metadata[key] ?? "")
                }
            }
            
            Text("Original Message:")
                .font(.caption2)
                .fontWeight(.semibold)
                .padding(.top, 4)
            
            Text(error.message)
                .font(.caption2)
                .fontFamily(.monospaced)
                .padding(6)
                .background(.quaternary)
                .cornerRadius(4)
        }
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text("\(label):")
                .font(.caption2)
                .fontWeight(.medium)
                .frame(width: 80, alignment: .leading)
            
            Text(value)
                .font(.caption2)
                .fontFamily(.monospaced)
                .foregroundColor(.secondary)
            
            Spacer()
        }
    }
}

// MARK: - Extensions

extension RecoveryStrategy {
    var icon: String {
        switch self {
        case .retry: return "arrow.clockwise"
        case .reconnect: return "antenna.radiowaves.left.and.right"
        case .clearCache: return "trash"
        case .resetComponent: return "arrow.uturn.backward"
        case .restartService: return "power"
        case .fallbackMode: return "shield"
        }
    }
    
    var description: String {
        switch self {
        case .retry: return "Attempt the failed operation again"
        case .reconnect: return "Reconnect to all services"
        case .clearCache: return "Clear cached data and start fresh"
        case .resetComponent: return "Reset the affected component"
        case .restartService: return "Restart the affected service"
        case .fallbackMode: return "Switch to backup systems"
        }
    }
}

#Preview {
    GuidedErrorRecoveryView(
        error: AppError(
            type: .networkError,
            message: "Failed to connect to backend API",
            category: .network,
            severity: .high,
            timestamp: Date(),
            metadata: ["endpoint": "/api/chat", "statusCode": "404"]
        ),
        onRecoveryComplete: { print("Recovery completed") },
        onDismiss: { print("Dismissed") }
    )
    .frame(width: 700, height: 800)
}