import SwiftUI
import Charts
import Foundation
import AppKit

/// Performance Monitoring Dashboard for Agent Orchestration
struct PerformanceMonitoringView: View {
    @ObservedObject var webSocketService: AgentWebSocketService
    @State private var selectedAgent: String?
    @State private var timeRange: TimeRange = .last1Hour
    @State private var selectedMetricType: MetricType = .all
    @State private var showAlerts = false
    @State private var autoRefresh = true
    @State private var refreshTimer: Timer?
    @State private var errorState: ErrorState?
    @State private var isLoading = false
    @State private var retryCount = 0
    private let maxRetries = 3
    
    var body: some View {
        Group {
            if let error = errorState {
                ErrorStateView(
                    error: error,
                    retry: {
                        retryOperation()
                    },
                    canRetry: retryCount < maxRetries
                )
            } else if isLoading {
                LoadingStateView(message: "Loading performance data...")
            } else {
                mainContent
            }
        }
        .onAppear {
            setupComponent()
        }
        .onDisappear {
            cleanup()
        }
        .onChange(of: autoRefresh) {
            setupAutoRefresh()
        }
    }
    
    private var mainContent: some View {
        VStack(spacing: 0) {
            // Header with controls
            performanceHeader
            
            Divider()
            
            HSplitView {
                // Left side - Agent list and filters
                VStack(spacing: 0) {
                    agentListHeader
                    Divider()
                    agentList
                }
                .frame(minWidth: 280, maxWidth: 350)
                
                Divider()
                
                // Right side - Performance metrics and charts
                VStack(spacing: 0) {
                    metricsHeader
                    Divider()
                    metricsContent
                }
                .frame(minWidth: 500)
            }
        }
    }
    
    // MARK: - Header
    
    private var performanceHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Performance Monitoring")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text("Real-time agent performance metrics and analytics")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                // Time range selector
                Picker("Time Range", selection: $timeRange) {
                    ForEach(TimeRange.allCases, id: \.self) { range in
                        Text(range.displayName).tag(range)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 120)
                
                // Metric type filter
                Picker("Metrics", selection: $selectedMetricType) {
                    ForEach(MetricType.allCases, id: \.self) { type in
                        Text(type.displayName).tag(type)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 100)
                
                // Auto refresh toggle
                Button(action: { autoRefresh.toggle() }) {
                    Image(systemName: autoRefresh ? "arrow.clockwise.circle.fill" : "arrow.clockwise.circle")
                        .foregroundColor(autoRefresh ? .green : .gray)
                }
                .help("Toggle auto-refresh")
                
                // Alerts button
                Button(action: { showAlerts.toggle() }) {
                    Image(systemName: "bell")
                        .foregroundColor(hasActiveAlerts ? .red : .gray)
                }
                .help("Performance alerts")
            }
        }
        .padding()
    }
    
    // MARK: - Agent List
    
    private var agentListHeader: some View {
        HStack {
            Text("Agents")
                .font(.headline)
                .fontWeight(.semibold)
            
            Spacer()
            
            Text("\(webSocketService.agentNetwork.nodes.count)")
                .font(.caption)
                .fontDesign(.monospaced)
                .foregroundColor(.secondary)
        }
        .padding()
    }
    
    private var agentList: some View {
        ScrollView {
            LazyVStack(spacing: 4) {
                ForEach(webSocketService.agentNetwork.nodes) { node in
                    AgentPerformanceRow(
                        node: node,
                        metrics: webSocketService.agentPerformanceMetrics[node.agentId],
                        isSelected: selectedAgent == node.agentId,
                        onSelect: { selectedAgent = node.agentId }
                    )
                }
            }
            .padding(.vertical, 8)
        }
    }
    
    // MARK: - Metrics Content
    
    private var metricsHeader: some View {
        HStack {
            if let selectedAgent = selectedAgent {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Agent: \(selectedAgent)")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    if let metrics = webSocketService.agentPerformanceMetrics[selectedAgent] {
                        Text("Last updated: \(formatTime(metrics.lastUpdated))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            } else {
                Text("Select an agent to view performance metrics")
                    .font(.headline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            if selectedAgent != nil {
                Button("Export Data") {
                    exportPerformanceData()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }
    
    private var metricsContent: some View {
        ScrollView {
            if let selectedAgent = selectedAgent,
               let metrics = webSocketService.agentPerformanceMetrics[selectedAgent] {
                
                LazyVStack(spacing: 20) {
                    // Key performance indicators
                    performanceKPIs(metrics: metrics)
                    
                    // Performance charts
                    performanceCharts(metrics: metrics)
                    
                    // Historical trends
                    historicalTrends(metrics: metrics)
                }
                .padding()
            } else {
                // Overall system performance when no agent is selected
                systemOverviewMetrics
            }
        }
    }
    
    // MARK: - Performance KPIs
    
    private func performanceKPIs(metrics: AgentPerformanceMetric) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Key Performance Indicators")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
                KPICard(
                    title: "Success Rate",
                    value: "\(metrics.successRate * 100, specifier: "%.1f")%",
                    icon: "checkmark.circle.fill",
                    color: successRateColor(metrics.successRate),
                    trend: calculateTrend(for: metrics.successRate, target: 0.95)
                )
                
                KPICard(
                    title: "Avg Latency",
                    value: "\(metrics.latency, specifier: "%.1f")ms",
                    icon: "speedometer",
                    color: latencyColor(metrics.latency),
                    trend: calculateLatencyTrend(metrics.latency)
                )
                
                KPICard(
                    title: "Throughput",
                    value: "\(metrics.throughput, specifier: "%.0f")/min",
                    icon: "arrow.up.circle.fill",
                    color: throughputColor(metrics.throughput),
                    trend: .neutral
                )
                
                KPICard(
                    title: "CPU Usage",
                    value: "\(metrics.cpuUsage, specifier: "%.1f")%",
                    icon: "cpu",
                    color: cpuUsageColor(metrics.cpuUsage),
                    trend: calculateResourceTrend(metrics.cpuUsage, threshold: 80.0)
                )
                
                KPICard(
                    title: "Memory",
                    value: formatBytes(metrics.memoryUsage),
                    icon: "memorychip",
                    color: memoryColor(metrics.memoryUsage),
                    trend: .neutral
                )
                
                KPICard(
                    title: "Error Count",
                    value: "\(metrics.errorCount)",
                    icon: "exclamationmark.triangle.fill",
                    color: errorCountColor(metrics.errorCount),
                    trend: calculateErrorTrend(metrics.errorCount)
                )
            }
        }
    }
    
    // MARK: - Performance Charts
    
    private func performanceCharts(metrics: AgentPerformanceMetric) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Performance Trends")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 16) {
                // Response time chart
                if !metrics.responseTimeHistory.isEmpty {
                    ChartCard(title: "Response Time") {
                        Chart(metrics.responseTimeHistory) { point in
                            LineMark(
                                x: .value("Time", point.timestamp),
                                y: .value("Response Time", point.value)
                            )
                            .foregroundStyle(.blue)
                        }
                        .chartYAxisLabel("Milliseconds")
                        .frame(height: 150)
                    }
                }
                
                // Memory usage chart
                if !metrics.memoryHistory.isEmpty {
                    ChartCard(title: "Memory Usage") {
                        Chart(metrics.memoryHistory) { point in
                            AreaMark(
                                x: .value("Time", point.timestamp),
                                y: .value("Memory", Double(point.bytes) / 1024 / 1024) // Convert to MB
                            )
                            .foregroundStyle(.green.opacity(0.6))
                        }
                        .chartYAxisLabel("MB")
                        .frame(height: 150)
                    }
                }
                
                // Throughput chart
                if !metrics.throughputHistory.isEmpty {
                    ChartCard(title: "Throughput") {
                        Chart(metrics.throughputHistory) { point in
                            BarMark(
                                x: .value("Time", point.timestamp),
                                y: .value("Tasks/Min", point.tasksPerMinute)
                            )
                            .foregroundStyle(.orange)
                        }
                        .chartYAxisLabel("Tasks per Minute")
                        .frame(height: 150)
                    }
                }
            }
        }
    }
    
    // MARK: - Historical Trends
    
    private func historicalTrends(metrics: AgentPerformanceMetric) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Historical Analysis")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                TrendRow(
                    label: "Average Response Time",
                    current: "\(metrics.latency, specifier: "%.1f")ms",
                    previous: "12.3ms", // This would come from historical data
                    trend: .improving
                )
                
                TrendRow(
                    label: "Peak Memory Usage",
                    current: formatBytes(metrics.memoryUsage),
                    previous: "456MB",
                    trend: .declining
                )
                
                TrendRow(
                    label: "Success Rate",
                    current: "\(metrics.successRate * 100, specifier: "%.1f")%",
                    previous: "94.2%",
                    trend: .improving
                )
                
                TrendRow(
                    label: "Error Rate",
                    current: "\(metrics.errorCount)",
                    previous: "12",
                    trend: .improving
                )
            }
            .padding()
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
    }
    
    // MARK: - System Overview
    
    private var systemOverviewMetrics: some View {
        VStack(spacing: 20) {
            Text("System Overview")
                .font(.title2)
                .fontWeight(.bold)
            
            // System-wide KPIs
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 2), spacing: 16) {
                SystemKPICard(
                    title: "Total Agents",
                    value: "\(webSocketService.agentNetwork.nodes.count)",
                    subtitle: "Active in network",
                    icon: "brain.head.profile",
                    color: .blue
                )
                
                SystemKPICard(
                    title: "Network Health",
                    value: "\(webSocketService.agentNetwork.healthScore * 100, specifier: "%.0f")%",
                    subtitle: "Overall system health",
                    icon: "heart.fill",
                    color: healthColor(webSocketService.agentNetwork.healthScore)
                )
                
                SystemKPICard(
                    title: "Active Connections",
                    value: "\(webSocketService.agentNetwork.activeConnectionCount)",
                    subtitle: "Inter-agent connections",
                    icon: "network",
                    color: .green
                )
                
                SystemKPICard(
                    title: "Avg Latency",
                    value: "\(webSocketService.agentNetwork.averageLatency, specifier: "%.1f")ms",
                    subtitle: "Network-wide average",
                    icon: "speedometer",
                    color: latencyColor(webSocketService.agentNetwork.averageLatency)
                )
            }
            
            Spacer()
        }
        .padding()
    }
    
    // MARK: - Helper Functions
    
    private func setupAutoRefresh() {
        refreshTimer?.invalidate()
        
        if autoRefresh {
            refreshTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
                // The WebSocket service handles real-time updates automatically
                // This could trigger additional data requests if needed
                Task { @MainActor in
                    if webSocketService.agentNetwork.nodes.isEmpty {
                        // Load sample data if no real data is available
                        loadSampleDataIfNeeded()
                    }
                }
            }
        }
    }
    
    private func loadSampleDataIfNeeded() {
        // Load sample data for demonstration when real data isn't available
        // This prevents UI from appearing empty during development/testing
    }
    
    private func exportPerformanceData() {
        // Implementation for exporting performance data
    }
    
    private var hasActiveAlerts: Bool {
        // Check if there are any active performance alerts
        return false // Placeholder
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter.string(from: date)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
    
    // MARK: - Color Functions
    
    private func successRateColor(_ rate: Double) -> Color {
        if rate > 0.95 { return .green }
        else if rate > 0.85 { return .yellow }
        else { return .red }
    }
    
    private func latencyColor(_ latency: Double) -> Color {
        if latency < 10 { return .green }
        else if latency < 50 { return .yellow }
        else { return .red }
    }
    
    private func throughputColor(_ throughput: Double) -> Color {
        if throughput > 100 { return .green }
        else if throughput > 50 { return .yellow }
        else { return .red }
    }
    
    private func cpuUsageColor(_ usage: Double) -> Color {
        if usage < 60 { return .green }
        else if usage < 80 { return .yellow }
        else { return .red }
    }
    
    private func memoryColor(_ bytes: Int64) -> Color {
        let gb = Double(bytes) / 1024 / 1024 / 1024
        if gb < 1.0 { return .green }
        else if gb < 2.0 { return .yellow }
        else { return .red }
    }
    
    private func errorCountColor(_ count: Int) -> Color {
        if count == 0 { return .green }
        else if count < 5 { return .yellow }
        else { return .red }
    }
    
    private func healthColor(_ score: Double) -> Color {
        if score > 0.8 { return .green }
        else if score > 0.5 { return .yellow }
        else { return .red }
    }
    
    // MARK: - Trend Calculation
    
    private func calculateTrend(for value: Double, target: Double) -> TrendDirection {
        if value >= target { return .improving }
        else if value >= target * 0.9 { return .neutral }
        else { return .declining }
    }
    
    private func calculateLatencyTrend(_ latency: Double) -> TrendDirection {
        if latency < 20 { return .improving }
        else if latency < 50 { return .neutral }
        else { return .declining }
    }
    
    private func calculateResourceTrend(_ usage: Double, threshold: Double) -> TrendDirection {
        if usage < threshold * 0.7 { return .improving }
        else if usage < threshold { return .neutral }
        else { return .declining }
    }
    
    private func calculateErrorTrend(_ errorCount: Int) -> TrendDirection {
        if errorCount == 0 { return .improving }
        else if errorCount < 3 { return .neutral }
        else { return .declining }
    }
    
    // MARK: - Error Handling
    
    private func setupComponent() {
        isLoading = true
        errorState = nil
        
        Task {
            do {
                try await initializePerformanceData()
                await MainActor.run {
                    isLoading = false
                    setupAutoRefresh()
                    DebugService.logInfo("Performance monitoring initialized successfully", category: .ui)
                }
            } catch {
                await MainActor.run {
                    handleError(error)
                }
            }
        }
    }
    
    private func initializePerformanceData() async throws {
        // Simulate initialization with potential failure
        try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        
        // Simulate random failure for demo
        if Bool.random() && retryCount == 0 {
            throw PerformanceError.connectionFailed
        }
        
        // Reset retry count on success
        retryCount = 0
    }
    
    private func handleError(_ error: Error) {
        isLoading = false
        
        let errorState: ErrorState
        
        if let performanceError = error as? PerformanceError {
            errorState = ErrorState(
                title: performanceError.title,
                message: performanceError.message,
                suggestion: performanceError.suggestion
            )
        } else {
            errorState = ErrorState(
                title: "Performance Monitoring Error",
                message: error.localizedDescription,
                suggestion: "Please try again or check your connection settings."
            )
        }
        
        self.errorState = errorState
        DebugService.logError("Performance monitoring error: \(error)", category: .ui, details: error.localizedDescription)
    }
    
    private func retryOperation() {
        retryCount += 1
        errorState = nil
        setupComponent()
    }
    
    private func cleanup() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
}

// MARK: - Supporting Types

enum TimeRange: String, CaseIterable {
    case last15Minutes = "15m"
    case last1Hour = "1h"
    case last6Hours = "6h"
    case last24Hours = "24h"
    case last7Days = "7d"
    
    var displayName: String {
        switch self {
        case .last15Minutes: return "15 minutes"
        case .last1Hour: return "1 hour"
        case .last6Hours: return "6 hours"
        case .last24Hours: return "24 hours"
        case .last7Days: return "7 days"
        }
    }
}

enum MetricType: String, CaseIterable {
    case all = "all"
    case performance = "performance"
    case resources = "resources"
    case errors = "errors"
    
    var displayName: String {
        switch self {
        case .all: return "All"
        case .performance: return "Performance"
        case .resources: return "Resources"
        case .errors: return "Errors"
        }
    }
}

enum TrendDirection {
    case improving
    case neutral
    case declining
    
    var color: Color {
        switch self {
        case .improving: return .green
        case .neutral: return .yellow
        case .declining: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .improving: return "arrow.up.circle.fill"
        case .neutral: return "minus.circle.fill"
        case .declining: return "arrow.down.circle.fill"
        }
    }
}

// MARK: - Component Views

struct AgentPerformanceRow: View {
    let node: AgentNode
    let metrics: AgentPerformanceMetric?
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            // Agent type icon
            Image(systemName: node.nodeType.icon)
                .foregroundColor(node.nodeType.color)
                .frame(width: 20)
            
            // Agent info
            VStack(alignment: .leading, spacing: 2) {
                Text(node.agentId)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)
                
                Text(node.nodeType.rawValue)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Performance indicators
            if let metrics = metrics {
                VStack(alignment: .trailing, spacing: 2) {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(successRateColor(metrics.successRate))
                            .frame(width: 6, height: 6)
                        
                        Text("\(metrics.successRate * 100, specifier: "%.0f")%")
                            .font(.caption2)
                            .fontDesign(.monospaced)
                    }
                    
                    Text("\(metrics.latency, specifier: "%.0f")ms")
                        .font(.caption2)
                        .fontDesign(.monospaced)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(isSelected ? AppTheme.accentOrange.opacity(0.2) : .clear)
        .cornerRadius(8)
        .contentShape(Rectangle())
        .onTapGesture {
            onSelect()
        }
    }
    
    private func successRateColor(_ rate: Double) -> Color {
        if rate > 0.95 { return .green }
        else if rate > 0.85 { return .yellow }
        else { return .red }
    }
}

struct KPICard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    let trend: TrendDirection
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title3)
                
                Spacer()
                
                Image(systemName: trend.icon)
                    .foregroundColor(trend.color)
                    .font(.caption)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)
                    .fontDesign(.monospaced)
                
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

struct SystemKPICard: View {
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title2)
                
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(value)
                    .font(.title)
                    .fontWeight(.bold)
                    .fontDesign(.monospaced)
                
                Text(title)
                    .font(.headline)
                    .fontWeight(.medium)
                
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

struct ChartCard<Content: View>: View {
    let title: String
    let content: Content
    
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
            
            content
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

struct TrendRow: View {
    let label: String
    let current: String
    let previous: String
    let trend: TrendDirection
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .fontWeight(.medium)
            
            Spacer()
            
            HStack(spacing: 8) {
                Text(current)
                    .font(.caption)
                    .fontDesign(.monospaced)
                
                Image(systemName: trend.icon)
                    .foregroundColor(trend.color)
                    .font(.caption2)
                
                Text("(\(previous))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    PerformanceMonitoringView(webSocketService: AgentWebSocketService())
        .frame(width: 1200, height: 800)
}

// MARK: - Error Handling Types

enum PerformanceError: LocalizedError {
    case connectionFailed
    case dataLoadingFailed
    case websocketDisconnected
    case metricsCalculationFailed
    
    var title: String {
        switch self {
        case .connectionFailed: return "Connection Failed"
        case .dataLoadingFailed: return "Data Loading Failed"
        case .websocketDisconnected: return "WebSocket Disconnected"
        case .metricsCalculationFailed: return "Metrics Calculation Failed"
        }
    }
    
    var message: String {
        switch self {
        case .connectionFailed: return "Unable to connect to the performance monitoring service."
        case .dataLoadingFailed: return "Failed to load performance data from the backend."
        case .websocketDisconnected: return "Real-time connection to the monitoring service was lost."
        case .metricsCalculationFailed: return "An error occurred while calculating performance metrics."
        }
    }
    
    var suggestion: String {
        switch self {
        case .connectionFailed: return "Check your network connection and try again."
        case .dataLoadingFailed: return "Verify the backend service is running and accessible."
        case .websocketDisconnected: return "The connection will automatically retry. Check your network if issues persist."
        case .metricsCalculationFailed: return "This might be a temporary issue. Try refreshing the data."
        }
    }
    
    var errorDescription: String? {
        return message
    }
}

struct ErrorState {
    let title: String
    let message: String
    let suggestion: String
}

// MARK: - Error State Views

struct ErrorStateView: View {
    let error: ErrorState
    let retry: () -> Void
    let canRetry: Bool
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.red)
            
            VStack(spacing: 8) {
                Text(error.title)
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text(error.message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                
                Text(error.suggestion)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
            }
            
            if canRetry {
                Button("Try Again") {
                    retry()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

struct LoadingStateView: View {
    let message: String
    @State private var isAnimating = false
    
    var body: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
                .opacity(isAnimating ? 1.0 : 0.5)
                .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isAnimating)
            
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            isAnimating = true
        }
    }
}