import SwiftUI
import Combine
import UniformTypeIdentifiers

// MARK: - Debug Tools View
public struct DebugToolsView: View {
    @StateObject private var loggingService = LoggingService.shared
    @StateObject private var monitoringService = MonitoringService.shared
    @StateObject private var changeTracker = ChangeTracker.shared
    @StateObject private var failurePreventionService = FailurePreventionService.shared
    
    @State private var selectedTab: DebugTab = .logs
    @State private var selectedLogLevel: LogLevel = .debug
    @State private var selectedLogCategory: LogCategory = .app
    @State private var logSearchText = ""
    @State private var showingLogExportSheet = false
    @State private var showingSettingsSheet = false
    @State private var autoScrollLogs = true
    @State private var isRealTimeMode = true
    
    // Export
    @State private var exportedLogData: Data?
    @State private var exportedAnalyticsData: Data?
    
    // Filters
    @State private var logLevelFilter: LogLevel? = nil
    @State private var logCategoryFilter: LogCategory? = nil
    @State private var showOnlyErrors = false
    @State private var timeRangeFilter: TimeRange = .all
    
    public init() {}
    
    public var body: some View {
        NavigationView {
            // Sidebar
            VStack(spacing: 0) {
                debugTabSidebar
                Divider()
                quickActionsSection
            }
            .frame(width: 200)
            .background(Color(NSColor.controlBackgroundColor))
            
            // Main Content
            VStack(spacing: 0) {
                debugToolbar
                Divider()
                
                switch selectedTab {
                case .logs:
                    logViewerContent
                case .monitoring:
                    monitoringContent
                case .analytics:
                    analyticsContent
                case .failures:
                    failurePreventionContent
                case .performance:
                    performanceContent
                case .exports:
                    exportContent
                }
            }
            .navigationTitle("Debug Tools")
            .navigationBarTitleDisplayMode(.inline)
        }
        .sheet(isPresented: $showingLogExportSheet) {
            LogExportSheet(
                loggingService: loggingService,
                changeTracker: changeTracker
            )
        }
        .sheet(isPresented: $showingSettingsSheet) {
            DebugSettingsSheet(
                loggingService: loggingService,
                monitoringService: monitoringService,
                changeTracker: changeTracker,
                failurePreventionService: failurePreventionService
            )
        }
        .onAppear {
            changeTracker.trackViewNavigation(
                fromView: "unknown",
                toView: "debug_tools",
                navigationMethod: "manual"
            )
        }
    }
    
    // MARK: - Sidebar
    
    private var debugTabSidebar: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Debug Tools")
                .font(.headline)
                .padding(.horizontal, 16)
                .padding(.top, 16)
            
            ForEach(DebugTab.allCases, id: \.self) { tab in
                Button(action: {
                    selectedTab = tab
                    changeTracker.trackUserInteraction(
                        type: .click,
                        component: "debug_tab",
                        details: tab.rawValue
                    )
                }) {
                    HStack {
                        Image(systemName: tab.icon)
                            .frame(width: 20)
                        
                        Text(tab.title)
                            .font(.system(size: 14))
                        
                        Spacer()
                        
                        if tab.hasNotificationBadge {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 8, height: 8)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        selectedTab == tab ? Color.accentColor.opacity(0.15) : Color.clear
                    )
                    .foregroundColor(
                        selectedTab == tab ? .accentColor : .primary
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            Spacer()
        }
    }
    
    // MARK: - Quick Actions
    
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Quick Actions")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.horizontal, 16)
            
            Group {
                quickActionButton(
                    title: "Clear Logs",
                    icon: "trash",
                    action: clearLogs
                )
                
                quickActionButton(
                    title: "Export Data",
                    icon: "square.and.arrow.up",
                    action: { showingLogExportSheet = true }
                )
                
                quickActionButton(
                    title: "Settings",
                    icon: "gear",
                    action: { showingSettingsSheet = true }
                )
                
                quickActionButton(
                    title: "Force GC",
                    icon: "memorychip",
                    action: forceGarbageCollection
                )
            }
            
            Spacer()
        }
        .padding(.vertical, 12)
    }
    
    private func quickActionButton(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .frame(width: 16)
                Text(title)
                    .font(.system(size: 12))
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(Color.clear)
            .foregroundColor(.secondary)
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            // Add hover effect if needed
        }
    }
    
    // MARK: - Toolbar
    
    private var debugToolbar: some View {
        HStack {
            // Tab-specific controls
            switch selectedTab {
            case .logs:
                logToolbarControls
            case .monitoring:
                monitoringToolbarControls
            case .analytics:
                analyticsToolbarControls
            case .failures:
                failureToolbarControls
            case .performance:
                performanceToolbarControls
            case .exports:
                exportToolbarControls
            }
            
            Spacer()
            
            // Common controls
            Toggle("Real-time", isOn: $isRealTimeMode)
                .toggleStyle(SwitchToggleStyle())
                .scaleEffect(0.8)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor))
    }
    
    private var logToolbarControls: some View {
        HStack {
            // Log level filter
            Picker("Level", selection: $logLevelFilter) {
                Text("All Levels").tag(LogLevel?.none)
                ForEach(LogLevel.allCases, id: \.self) { level in
                    Text(level.description).tag(LogLevel?.some(level))
                }
            }
            .pickerStyle(MenuPickerStyle())
            .frame(width: 120)
            
            // Category filter
            Picker("Category", selection: $logCategoryFilter) {
                Text("All Categories").tag(LogCategory?.none)
                ForEach(LogCategory.allCases, id: \.self) { category in
                    Text(category.rawValue).tag(LogCategory?.some(category))
                }
            }
            .pickerStyle(MenuPickerStyle())
            .frame(width: 120)
            
            // Search field
            TextField("Search logs...", text: $logSearchText)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .frame(width: 200)
            
            // Clear search
            if !logSearchText.isEmpty {
                Button(action: { logSearchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
    }
    
    private var monitoringToolbarControls: some View {
        HStack {
            Button("Run Health Checks") {
                Task {
                    await monitoringService.runHealthChecks()
                }
            }
            
            Button("Clear Alerts") {
                monitoringService.clearAlerts()
            }
        }
    }
    
    private var analyticsToolbarControls: some View {
        HStack {
            Button("Refresh Analytics") {
                Task {
                    await changeTracker.generateAnalyticsSnapshot()
                }
            }
            
            Picker("Time Range", selection: $timeRangeFilter) {
                ForEach(TimeRange.allCases, id: \.self) { range in
                    Text(range.description).tag(range)
                }
            }
            .pickerStyle(MenuPickerStyle())
        }
    }
    
    private var failureToolbarControls: some View {
        HStack {
            Button("Run Prediction") {
                Task {
                    await failurePreventionService.runFailurePrediction()
                }
            }
            
            Toggle("Auto Recovery", isOn: .constant(failurePreventionService.automaticRecoveryEnabled))
                .disabled(true) // Show state but don't allow changes here
        }
    }
    
    private var performanceToolbarControls: some View {
        HStack {
            Button("Collect Metrics") {
                // Trigger performance metrics collection
                changeTracker.trackPerformanceEvent(
                    metric: "manual_collection",
                    value: Date().timeIntervalSince1970,
                    source: "debug_tools"
                )
            }
        }
    }
    
    private var exportToolbarControls: some View {
        HStack {
            Button("Export All") {
                exportAllData()
            }
        }
    }
    
    // MARK: - Content Views
    
    private var logViewerContent: some View {
        VStack(spacing: 0) {
            // Log list
            LogListView(
                logs: filteredLogs,
                searchText: logSearchText,
                autoScroll: autoScrollLogs
            )
        }
    }
    
    private var monitoringContent: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                // Health status overview
                HealthStatusOverview(
                    currentHealth: monitoringService.currentHealth,
                    healthCheckResults: monitoringService.healthCheckResults
                )
                
                // Performance metrics
                if let metrics = monitoringService.performanceMetrics {
                    PerformanceMetricsView(metrics: metrics)
                }
                
                // Connection health
                if let connectionHealth = monitoringService.connectionHealth {
                    ConnectionHealthView(connectionHealth: connectionHealth)
                }
                
                // Alerts
                AlertsListView(alerts: monitoringService.alerts)
            }
            .padding()
        }
    }
    
    private var analyticsContent: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                // Analytics snapshot
                if let snapshot = changeTracker.analyticsSnapshot {
                    AnalyticsSnapshotView(snapshot: snapshot)
                }
                
                // Recent events
                ChangeEventsListView(
                    events: changeTracker.recentEvents,
                    timeRange: timeRangeFilter
                )
                
                // Detected patterns
                PatternDetectionView(patterns: changeTracker.detectedPatterns)
            }
            .padding()
        }
    }
    
    private var failurePreventionContent: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                // Active predictions
                FailurePredictionsView(
                    predictions: failurePreventionService.activePredictions,
                    onDismiss: { prediction in
                        failurePreventionService.dismissPrediction(prediction)
                    },
                    onManualRecovery: { prediction in
                        Task {
                            await failurePreventionService.manualRecovery(for: prediction)
                        }
                    }
                )
                
                // Health trends
                HealthTrendsView(trends: failurePreventionService.healthTrends)
                
                // Statistics
                FailurePreventionStatsView(
                    preventedFailures: failurePreventionService.preventedFailures,
                    automaticRecoveries: failurePreventionService.automaticRecoveries
                )
            }
            .padding()
        }
    }
    
    private var performanceContent: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                // Real-time performance charts
                PerformanceChartsView()
                
                // Memory usage details
                MemoryUsageDetailView()
                
                // Network performance
                NetworkPerformanceView()
                
                // CPU usage breakdown
                CPUUsageDetailView()
            }
            .padding()
        }
    }
    
    private var exportContent: some View {
        VStack(spacing: 20) {
            Text("Export Debug Data")
                .font(.title2)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                ExportOptionCard(
                    title: "Logs",
                    description: "Export all application logs",
                    icon: "doc.text",
                    action: exportLogs
                )
                
                ExportOptionCard(
                    title: "Analytics",
                    description: "Export usage analytics data",
                    icon: "chart.bar",
                    action: exportAnalytics
                )
                
                ExportOptionCard(
                    title: "Monitoring",
                    description: "Export monitoring metrics",
                    icon: "heart.text.square",
                    action: exportMonitoringData
                )
                
                ExportOptionCard(
                    title: "Full Report",
                    description: "Export comprehensive debug report",
                    icon: "doc.richtext",
                    action: exportFullReport
                )
            }
            
            Spacer()
        }
        .padding()
    }
    
    // MARK: - Computed Properties
    
    private var filteredLogs: [LogEntry] {
        var logs = loggingService.recentLogs
        
        // Apply level filter
        if let levelFilter = logLevelFilter {
            logs = logs.filter { $0.level.rawValue >= levelFilter.rawValue }
        }
        
        // Apply category filter
        if let categoryFilter = logCategoryFilter {
            logs = logs.filter { $0.category == categoryFilter }
        }
        
        // Apply search filter
        if !logSearchText.isEmpty {
            logs = logs.filter { log in
                log.message.localizedCaseInsensitiveContains(logSearchText) ||
                log.category.rawValue.localizedCaseInsensitiveContains(logSearchText) ||
                log.file.localizedCaseInsensitiveContains(logSearchText)
            }
        }
        
        // Apply time range filter
        if timeRangeFilter != .all {
            let cutoffDate = Date().addingTimeInterval(-timeRangeFilter.timeInterval)
            logs = logs.filter { $0.timestamp >= cutoffDate }
        }
        
        return logs.sorted { $0.timestamp > $1.timestamp }
    }
    
    // MARK: - Actions
    
    private func clearLogs() {
        Task {
            await loggingService.clearLogs()
            await changeTracker.clearData()
        }
        
        changeTracker.trackUserInteraction(
            type: .click,
            component: "debug_tools",
            details: "clear_logs"
        )
    }
    
    private func forceGarbageCollection() {
        // This would trigger garbage collection in a real implementation
        changeTracker.trackUserInteraction(
            type: .click,
            component: "debug_tools",
            details: "force_gc"
        )
        
        loggingService.info("Forced garbage collection triggered", category: .performance)
    }
    
    private func exportLogs() {
        Task {
            exportedLogData = await loggingService.exportLogs()
            if exportedLogData != nil {
                showSavePanel(for: exportedLogData!, fileName: "debug-logs.txt")
            }
        }
    }
    
    private func exportAnalytics() {
        Task {
            exportedAnalyticsData = await changeTracker.exportData()
            if exportedAnalyticsData != nil {
                showSavePanel(for: exportedAnalyticsData!, fileName: "analytics-data.json")
            }
        }
    }
    
    private func exportMonitoringData() {
        // Export monitoring data
        let report = """
        Universal AI Tools - Monitoring Report
        Generated: \(Date())
        
        Current Health: \(monitoringService.currentHealth.rawValue)
        Active Alerts: \(monitoringService.alerts.count)
        Health Checks: \(monitoringService.healthCheckResults.count)
        
        \(failurePreventionService.getHealthReport())
        """
        
        if let data = report.data(using: .utf8) {
            showSavePanel(for: data, fileName: "monitoring-report.txt")
        }
    }
    
    private func exportFullReport() {
        Task {
            let logsData = await loggingService.exportLogs()
            let analyticsData = await changeTracker.exportData()
            
            let fullReport = """
            Universal AI Tools - Full Debug Report
            ====================================
            Generated: \(Date())
            
            LOGS:
            \(logsData != nil ? String(data: logsData!, encoding: .utf8) ?? "Unable to export logs" : "No logs available")
            
            ANALYTICS:
            \(analyticsData != nil ? String(data: analyticsData!, encoding: .utf8) ?? "Unable to export analytics" : "No analytics available")
            
            MONITORING:
            \(failurePreventionService.getHealthReport())
            """
            
            if let data = fullReport.data(using: .utf8) {
                showSavePanel(for: data, fileName: "debug-report-full.txt")
            }
        }
    }
    
    private func exportAllData() {
        exportFullReport()
    }
    
    private func showSavePanel(for data: Data, fileName: String) {
        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.plainText, .json]
        savePanel.nameFieldStringValue = fileName
        
        savePanel.begin { result in
            if result == .OK, let url = savePanel.url {
                do {
                    try data.write(to: url)
                    loggingService.info("Exported debug data to: \(url.path)", category: .monitoring)
                } catch {
                    loggingService.error("Failed to export debug data: \(error.localizedDescription)", 
                                       category: .monitoring)
                }
            }
        }
    }
}

// MARK: - Debug Tab Enum
enum DebugTab: String, CaseIterable {
    case logs = "logs"
    case monitoring = "monitoring"
    case analytics = "analytics"
    case failures = "failures"
    case performance = "performance"
    case exports = "exports"
    
    var title: String {
        switch self {
        case .logs: return "Logs"
        case .monitoring: return "Monitoring"
        case .analytics: return "Analytics"
        case .failures: return "Failures"
        case .performance: return "Performance"
        case .exports: return "Export"
        }
    }
    
    var icon: String {
        switch self {
        case .logs: return "doc.text"
        case .monitoring: return "heart.text.square"
        case .analytics: return "chart.bar"
        case .failures: return "exclamationmark.triangle"
        case .performance: return "speedometer"
        case .exports: return "square.and.arrow.up"
        }
    }
    
    var hasNotificationBadge: Bool {
        // This would be computed based on actual state
        return false
    }
}

// MARK: - Time Range Enum
enum TimeRange: CaseIterable {
    case all
    case lastHour
    case last24Hours
    case lastWeek
    
    var description: String {
        switch self {
        case .all: return "All Time"
        case .lastHour: return "Last Hour"
        case .last24Hours: return "Last 24 Hours"
        case .lastWeek: return "Last Week"
        }
    }
    
    var timeInterval: TimeInterval {
        switch self {
        case .all: return .greatestFiniteMagnitude
        case .lastHour: return 3600
        case .last24Hours: return 86400
        case .lastWeek: return 604800
        }
    }
}

// MARK: - Preview
struct DebugToolsView_Previews: PreviewProvider {
    static var previews: some View {
        DebugToolsView()
            .frame(width: 1200, height: 800)
    }
}