import SwiftUI
import Combine

/// Comprehensive Error Management Interface with guided recovery and analytics
struct EnhancedErrorManagementView: View {
    @StateObject private var errorHandler = ErrorHandler.shared
    @State private var selectedError: AppError?
    @State private var showGuidedRecovery = false
    @State private var showErrorAnalytics = false
    @State private var filterSeverity: ErrorSeverity?
    @State private var filterCategory: ErrorCategory?
    @State private var searchText = ""
    
    var body: some View {
        NavigationSplitView {
            // Sidebar with error filters and analytics
            errorSidebar
        } detail: {
            // Main error management area
            errorDetailView
        }
        .navigationTitle("Error Management")
        .toolbar {
            toolbarContent
        }
        .sheet(isPresented: $showGuidedRecovery) {
            if let error = selectedError {
                GuidedErrorRecoveryView(
                    error: error,
                    onRecoveryComplete: {
                        errorHandler.removeError(error.id)
                        showGuidedRecovery = false
                        selectedError = nil
                    },
                    onDismiss: {
                        showGuidedRecovery = false
                        selectedError = nil
                    }
                )
            }
        }
        .sheet(isPresented: $showErrorAnalytics) {
            ErrorAnalyticsView(errorHandler: errorHandler)
        }
    }
    
    // MARK: - Sidebar
    
    private var errorSidebar: some View {
        VStack(spacing: 0) {
            // System status header
            systemStatusHeader
            
            Divider()
            
            // Error filters
            errorFiltersSection
            
            Divider()
            
            // Error list
            errorListSection
        }
        .frame(minWidth: 280)
    }
    
    private var systemStatusHeader: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: errorHandler.systemStatus.icon)
                    .font(.title2)
                    .foregroundColor(errorHandler.systemStatus.color)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("System Status")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Text(errorHandler.systemStatus.rawValue.capitalized)
                        .font(.subheadline)
                        .foregroundColor(errorHandler.systemStatus.color)
                }
                
                Spacer()
            }
            
            // Quick stats
            HStack(spacing: 16) {
                StatBadge(
                    label: "Active",
                    value: "\(errorHandler.currentErrors.count)",
                    color: errorHandler.currentErrors.isEmpty ? .green : .orange
                )
                
                StatBadge(
                    label: "Critical",
                    value: "\(errorHandler.currentErrors.filter { $0.severity == .critical }.count)",
                    color: .red
                )
                
                StatBadge(
                    label: "Rate/min",
                    value: String(format: "%.1f", errorHandler.errorStats.errorRate),
                    color: errorHandler.errorStats.errorRate > 5 ? .red : .gray
                )
            }
        }
        .padding()
        .background(.ultraThinMaterial)
    }
    
    private var errorFiltersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Filters")
                .font(.headline)
                .fontWeight(.semibold)
                .padding(.horizontal)
            
            VStack(spacing: 8) {
                // Search
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    
                    TextField("Search errors...", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(8)
                .background(.quaternary)
                .cornerRadius(8)
                .padding(.horizontal)
                
                // Severity filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterPill(
                            title: "All Severities",
                            isSelected: filterSeverity == nil,
                            action: { filterSeverity = nil }
                        )
                        
                        ForEach(ErrorSeverity.allCases, id: \.self) { severity in
                            FilterPill(
                                title: severity.rawValue.capitalized,
                                isSelected: filterSeverity == severity,
                                action: { filterSeverity = severity }
                            )
                        }
                    }
                    .padding(.horizontal)
                }
                
                // Category filter
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterPill(
                            title: "All Categories",
                            isSelected: filterCategory == nil,
                            action: { filterCategory = nil }
                        )
                        
                        ForEach(ErrorCategory.allCases, id: \.self) { category in
                            FilterPill(
                                title: category.rawValue.capitalized,
                                isSelected: filterCategory == category,
                                action: { filterCategory = category }
                            )
                        }
                    }
                    .padding(.horizontal)
                }
            }
        }
        .padding(.vertical)
    }
    
    private var errorListSection: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(filteredErrors) { error in
                    ErrorListRow(
                        error: error,
                        isSelected: selectedError?.id == error.id,
                        onSelect: { selectedError = error },
                        onRecover: { 
                            selectedError = error
                            showGuidedRecovery = true
                        },
                        onDismiss: { errorHandler.removeError(error.id) }
                    )
                }
                
                if filteredErrors.isEmpty {
                    EmptyErrorsView(hasFilters: hasActiveFilters)
                }
            }
            .padding(.horizontal)
        }
    }
    
    // MARK: - Detail View
    
    private var errorDetailView: some View {
        Group {
            if let error = selectedError {
                ErrorDetailView(
                    error: error,
                    onStartRecovery: {
                        showGuidedRecovery = true
                    },
                    onDismissError: {
                        errorHandler.removeError(error.id)
                        selectedError = nil
                    }
                )
            } else {
                ErrorManagementPlaceholder()
            }
        }
    }
    
    // MARK: - Toolbar
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button(action: { showErrorAnalytics = true }) {
                Label("Analytics", systemImage: "chart.bar.fill")
            }
            .help("View error analytics")
            
            Button(action: { errorHandler.clearAllErrors() }) {
                Label("Clear All", systemImage: "trash")
            }
            .help("Clear all errors")
            .disabled(errorHandler.currentErrors.isEmpty)
            
            Menu {
                Button("Export Error Report") {
                    exportErrorReport()
                }
                
                Button("Import Error Report") {
                    importErrorReport()
                }
                
                Divider()
                
                Button("Reset Error Statistics") {
                    resetErrorStatistics()
                }
            } label: {
                Label("More", systemImage: "ellipsis.circle")
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var filteredErrors: [AppError] {
        var errors = errorHandler.currentErrors
        
        // Apply search filter
        if !searchText.isEmpty {
            errors = errors.filter { error in
                error.message.localizedCaseInsensitiveContains(searchText) ||
                error.userFriendlyTitle.localizedCaseInsensitiveContains(searchText) ||
                error.type.rawValue.localizedCaseInsensitiveContains(searchText)
            }
        }
        
        // Apply severity filter
        if let severity = filterSeverity {
            errors = errors.filter { $0.severity == severity }
        }
        
        // Apply category filter
        if let category = filterCategory {
            errors = errors.filter { $0.category == category }
        }
        
        // Sort by severity and timestamp
        return errors.sorted { lhs, rhs in
            if lhs.severity != rhs.severity {
                let severityOrder: [ErrorSeverity] = [.critical, .high, .medium, .low]
                let lhsIndex = severityOrder.firstIndex(of: lhs.severity) ?? 0
                let rhsIndex = severityOrder.firstIndex(of: rhs.severity) ?? 0
                return lhsIndex < rhsIndex
            }
            return lhs.timestamp > rhs.timestamp
        }
    }
    
    private var hasActiveFilters: Bool {
        !searchText.isEmpty || filterSeverity != nil || filterCategory != nil
    }
    
    // MARK: - Helper Functions
    
    private func exportErrorReport() {
        let report = generateErrorReport()
        
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = "universal-ai-tools-error-report-\(Date().timeIntervalSince1970).json"
        savePanel.allowedContentTypes = [.json]
        
        if savePanel.runModal() == .OK {
            guard let url = savePanel.url else { return }
            
            do {
                try report.write(to: url, atomically: true, encoding: .utf8)
            } catch {
                errorHandler.logError(AppError(
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
    
    private func importErrorReport() {
        let openPanel = NSOpenPanel()
        openPanel.allowedContentTypes = [.json]
        openPanel.allowsMultipleSelection = false
        
        if openPanel.runModal() == .OK {
            guard let url = openPanel.url else { return }
            
            do {
                let data = try Data(contentsOf: url)
                // Process imported error report
                // Implementation would depend on report format
            } catch {
                errorHandler.logError(AppError(
                    type: .systemFailure,
                    message: "Failed to import error report: \(error.localizedDescription)",
                    category: .system,
                    severity: .medium,
                    timestamp: Date(),
                    metadata: [:]
                ))
            }
        }
    }
    
    private func resetErrorStatistics() {
        errorHandler.errorStats = ErrorStatistics()
    }
    
    private func generateErrorReport() -> String {
        let report = [
            "timestamp": Date().timeIntervalSince1970,
            "systemStatus": errorHandler.systemStatus.rawValue,
            "statistics": [
                "totalErrors": errorHandler.errorStats.totalErrors,
                "errorRate": errorHandler.errorStats.errorRate,
                "lastErrorTime": errorHandler.errorStats.lastErrorTime?.timeIntervalSince1970 ?? 0
            ],
            "currentErrors": errorHandler.currentErrors.map { error in
                [
                    "id": error.id.uuidString,
                    "type": error.type.rawValue,
                    "message": error.message,
                    "category": error.category.rawValue,
                    "severity": error.severity.rawValue,
                    "timestamp": error.timestamp.timeIntervalSince1970,
                    "metadata": error.metadata
                ]
            }
        ] as [String: Any]
        
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: .prettyPrinted),
              let jsonString = String(data: data, encoding: .utf8) else {
            return "Error generating report"
        }
        
        return jsonString
    }
}

// MARK: - Supporting Views

struct StatBadge: View {
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(color)
            
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct FilterPill: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? .blue : .quaternary)
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(12)
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

struct ErrorListRow: View {
    let error: AppError
    let isSelected: Bool
    let onSelect: () -> Void
    let onRecover: () -> Void
    let onDismiss: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            // Error severity indicator
            RoundedRectangle(cornerRadius: 2)
                .fill(error.severity.color)
                .frame(width: 4)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(error.userFriendlyTitle)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    Text(formatRelativeTime(error.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                Text(error.userFriendlyMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                HStack {
                    Text(error.severity.rawValue.uppercased())
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(error.severity.color)
                    
                    Text("•")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Text(error.category.rawValue.uppercased())
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    if error.severity == .critical || error.severity == .high {
                        Button("Recover") {
                            onRecover()
                        }
                        .buttonStyle(.borderless)
                        .controlSize(.mini)
                    }
                    
                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(.caption)
                    }
                    .buttonStyle(.borderless)
                    .controlSize(.mini)
                }
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(isSelected ? .blue.opacity(0.1) : .clear)
        .cornerRadius(8)
        .onTapGesture {
            onSelect()
        }
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct EmptyErrorsView: View {
    let hasFilters: Bool
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: hasFilters ? "line.3.horizontal.decrease.circle" : "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(hasFilters ? .orange : .green)
            
            Text(hasFilters ? "No matching errors" : "All Clear!")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text(hasFilters ? "Try adjusting your filters" : "No errors detected. System is running smoothly.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorDetailView: View {
    let error: AppError
    let onStartRecovery: () -> Void
    let onDismissError: () -> Void
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Error header
                errorHeader
                
                // Error details
                errorDetailsSection
                
                // Recovery options
                recoveryOptionsSection
                
                // Metadata and technical info
                technicalDetailsSection
            }
            .padding()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    
    private var errorHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: error.severity.icon)
                    .font(.largeTitle)
                    .foregroundColor(error.severity.color)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(error.userFriendlyTitle)
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("Occurred \(formatRelativeTime(error.timestamp))")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                HStack(spacing: 8) {
                    Button("Start Recovery") {
                        onStartRecovery()
                    }
                    .buttonStyle(.borderedProminent)
                    
                    Button("Dismiss") {
                        onDismissError()
                    }
                    .buttonStyle(.bordered)
                }
            }
            
            Text(error.userFriendlyMessage)
                .font(.body)
                .foregroundColor(.secondary)
            
            if let suggestion = error.actionSuggestion {
                HStack(spacing: 8) {
                    Image(systemName: "lightbulb")
                        .foregroundColor(.orange)
                    
                    Text(suggestion)
                        .font(.subheadline)
                        .foregroundColor(.orange)
                }
                .padding()
                .background(.orange.opacity(0.1))
                .cornerRadius(8)
            }
        }
    }
    
    private var errorDetailsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Error Details")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                DetailCard(title: "Type", value: error.type.rawValue, icon: "doc.text")
                DetailCard(title: "Category", value: error.category.rawValue, icon: "folder")
                DetailCard(title: "Severity", value: error.severity.rawValue, icon: "exclamationmark.triangle")
                DetailCard(title: "ID", value: error.id.uuidString.prefix(8).description, icon: "number")
            }
        }
    }
    
    private var recoveryOptionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Recovery Options")
                .font(.headline)
                .fontWeight(.semibold)
            
            let recoveryManager = ErrorRecoveryManager()
            let strategies = recoveryManager.getSuggestedStrategies(for: error)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                ForEach(strategies.prefix(4), id: \.self) { strategy in
                    QuickRecoveryCard(strategy: strategy) {
                        // Quick recovery action
                        Task {
                            await recoveryManager.executeAutomaticRecovery(strategy: strategy, error: error)
                        }
                    }
                }
            }
        }
    }
    
    private var technicalDetailsSection: some View {
        DisclosureGroup("Technical Details") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Original Message:")
                    .font(.caption)
                    .fontWeight(.semibold)
                
                Text(error.message)
                    .font(.caption)
                    .fontFamily(.monospaced)
                    .padding()
                    .background(.quaternary)
                    .cornerRadius(8)
                
                if !error.metadata.isEmpty {
                    Text("Metadata:")
                        .font(.caption)
                        .fontWeight(.semibold)
                    
                    ForEach(Array(error.metadata.keys.sorted()), id: \.self) { key in
                        HStack {
                            Text("\(key):")
                                .font(.caption)
                                .fontWeight(.medium)
                                .frame(width: 100, alignment: .leading)
                            
                            Text(error.metadata[key] ?? "")
                                .font(.caption)
                                .fontFamily(.monospaced)
                            
                            Spacer()
                        }
                    }
                }
            }
            .padding()
            .background(.ultraThinMaterial)
            .cornerRadius(8)
        }
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct ErrorManagementPlaceholder: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 64))
                .foregroundColor(.secondary)
            
            Text("Select an Error")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Choose an error from the sidebar to view details and recovery options")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct DetailCard: View {
    let title: String
    let value: String
    let icon: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.blue)
                
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)
            }
            
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}

struct QuickRecoveryCard: View {
    let strategy: RecoveryStrategy
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: strategy.icon)
                        .foregroundColor(.orange)
                    
                    Spacer()
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
            .background(.orange.opacity(0.05))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(.orange.opacity(0.3), lineWidth: 1)
            )
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    EnhancedErrorManagementView()
        .frame(width: 1000, height: 700)
}