import SwiftUI
import Charts
import Combine

/// **Phase 2: Flash Attention Analytics Hub**
/// 
/// Sophisticated performance analytics dashboard that visualizes advanced memory optimization
/// and attention mechanisms running in the backend. Provides real-time insights into:
/// - Memory attention heatmaps with interactive exploration
/// - Token processing pipeline efficiency analysis
/// - Multi-model performance comparison
/// - Flash attention optimization recommendations
/// - Real-time memory usage with pressure indicators
/// - Attention pattern analysis with head visualization

struct FlashAttentionAnalytics: View {
    @StateObject private var metricsService = PerformanceMetricsService()
    @StateObject private var appState = AppState()
    @State private var selectedTab: AnalyticsTab = .overview
    @State private var selectedTimeRange: TimeRange = .last1Hour
    @State private var autoRefresh = true
    @State private var refreshTimer: Timer?
    @State private var showExportSheet = false
    @State private var showOptimizationRecommendations = false
    
    var body: some View {
        NavigationSplitView {
            // Sidebar with analytics sections
            VStack(alignment: .leading, spacing: 0) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "brain.head.profile")
                            .font(.title2)
                            .foregroundColor(.purple)
                        Text("Flash Attention")
                            .font(.title2)
                            .fontWeight(.semibold)
                    }
                    
                    Text("Performance Analytics Hub")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                
                Divider()
                
                // Analytics Categories
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(AnalyticsTab.allCases, id: \.self) { tab in
                            AnalyticsCategoryRow(
                                tab: tab,
                                isSelected: selectedTab == tab,
                                metricsService: metricsService
                            ) {
                                selectedTab = tab
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
                
                Spacer()
                
                // Connection Status & Controls
                VStack(spacing: 12) {
                    ConnectionStatusIndicator(
                        isConnected: metricsService.isConnected,
                        lastUpdate: metricsService.lastUpdate
                    )
                    
                    // Time Range Selector
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Time Range")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Picker("Time Range", selection: $selectedTimeRange) {
                            ForEach(TimeRange.allCases, id: \.self) { range in
                                Text(range.displayName).tag(range)
                            }
                        }
                        .pickerStyle(.menu)
                        .onChange(of: selectedTimeRange) { _ in
                            Task { await metricsService.loadMetrics(for: selectedTimeRange) }
                        }
                    }
                    
                    // Auto-refresh Toggle
                    Toggle("Auto-refresh", isOn: $autoRefresh)
                        .font(.caption)
                        .onChange(of: autoRefresh) { enabled in
                            if enabled {
                                startAutoRefresh()
                            } else {
                                stopAutoRefresh()
                            }
                        }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
            .frame(minWidth: 250, maxWidth: 300)
            .background(Color(NSColor.controlBackgroundColor))
        } detail: {
            // Main analytics content
            VStack(spacing: 0) {
                // Toolbar
                AnalyticsToolbar(
                    selectedTab: selectedTab,
                    metricsService: metricsService,
                    onRefresh: { Task { await metricsService.refreshData() } },
                    onExport: { showExportSheet = true },
                    onOptimize: { showOptimizationRecommendations = true }
                )
                
                Divider()
                
                // Analytics Content
                TabView(selection: $selectedTab) {
                    OverviewTab(metricsService: metricsService)
                        .tag(AnalyticsTab.overview)
                    
                    AttentionHeatmapView(metricsService: metricsService)
                        .tag(AnalyticsTab.heatmaps)
                    
                    TokenProcessingWaterfall(metricsService: metricsService)
                        .tag(AnalyticsTab.pipeline)
                    
                    ModelPerformanceChart(metricsService: metricsService)
                        .tag(AnalyticsTab.performance)
                    
                    MemoryOptimizationPanel(metricsService: metricsService)
                        .tag(AnalyticsTab.memory)
                    
                    AdvancedAnalyticsTab(metricsService: metricsService)
                        .tag(AnalyticsTab.advanced)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
        }
        .sheet(isPresented: $showExportSheet) {
            AnalyticsExportSheet(metricsService: metricsService)
        }
        .sheet(isPresented: $showOptimizationRecommendations) {
            OptimizationRecommendationsSheet(metricsService: metricsService)
        }
        .onAppear {
            Task {
                await metricsService.initialize()
                await metricsService.connectToRealTimeStream()
                if autoRefresh {
                    startAutoRefresh()
                }
            }
        }
        .onDisappear {
            stopAutoRefresh()
        }
    }
    
    private func startAutoRefresh() {
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
            Task { await metricsService.refreshData() }
        }
    }
    
    private func stopAutoRefresh() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
}

// MARK: - Analytics Tabs

enum AnalyticsTab: String, CaseIterable {
    case overview = "Overview"
    case heatmaps = "Attention Heatmaps"
    case pipeline = "Token Pipeline"
    case performance = "Model Performance"
    case memory = "Memory Optimization"
    case advanced = "Advanced Analysis"
    
    var icon: String {
        switch self {
        case .overview: return "chart.bar.doc.horizontal"
        case .heatmaps: return "grid.circle"
        case .pipeline: return "flowchart"
        case .performance: return "speedometer"
        case .memory: return "memorychip"
        case .advanced: return "brain.head.profile"
        }
    }
    
    var description: String {
        switch self {
        case .overview: return "Key metrics and system health"
        case .heatmaps: return "Attention weight visualizations"
        case .pipeline: return "Token processing analysis"
        case .performance: return "Model comparison metrics"
        case .memory: return "Memory usage optimization"
        case .advanced: return "Deep attention analysis"
        }
    }
}

enum TimeRange: String, CaseIterable {
    case last15Min = "15m"
    case last1Hour = "1h"
    case last4Hours = "4h"
    case last24Hours = "24h"
    case last7Days = "7d"
    
    var displayName: String {
        switch self {
        case .last15Min: return "Last 15 minutes"
        case .last1Hour: return "Last hour"
        case .last4Hours: return "Last 4 hours"
        case .last24Hours: return "Last 24 hours"
        case .last7Days: return "Last 7 days"
        }
    }
    
    var seconds: TimeInterval {
        switch self {
        case .last15Min: return 15 * 60
        case .last1Hour: return 60 * 60
        case .last4Hours: return 4 * 60 * 60
        case .last24Hours: return 24 * 60 * 60
        case .last7Days: return 7 * 24 * 60 * 60
        }
    }
}

// MARK: - Supporting Views

struct AnalyticsCategoryRow: View {
    let tab: AnalyticsTab
    let isSelected: Bool
    let metricsService: PerformanceMetricsService
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Image(systemName: tab.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(isSelected ? .white : .primary)
                    .frame(width: 20)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(tab.rawValue)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(isSelected ? .white : .primary)
                    
                    Text(tab.description)
                        .font(.caption)
                        .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
                }
                
                Spacer()
                
                // Live indicator for active metrics
                if hasLiveData {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 6, height: 6)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected ? Color.accentColor : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
    
    private var hasLiveData: Bool {
        switch tab {
        case .overview: return metricsService.hasLiveOverviewData
        case .heatmaps: return metricsService.hasLiveAttentionData
        case .pipeline: return metricsService.hasLiveTokenData
        case .performance: return metricsService.hasLivePerformanceData
        case .memory: return metricsService.hasLiveMemoryData
        case .advanced: return metricsService.hasAdvancedAnalytics
        }
    }
}

struct ConnectionStatusIndicator: View {
    let isConnected: Bool
    let lastUpdate: Date?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Circle()
                    .fill(isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                
                Text(isConnected ? "Connected" : "Disconnected")
                    .font(.caption)
                    .fontWeight(.medium)
            }
            
            if let lastUpdate = lastUpdate {
                Text("Updated \(timeAgoString(from: lastUpdate))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(NSColor.controlBackgroundColor))
                .stroke(Color(NSColor.separatorColor), lineWidth: 0.5)
        )
    }
    
    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 {
            return "now"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else {
            return "\(Int(interval / 3600))h ago"
        }
    }
}

struct AnalyticsToolbar: View {
    let selectedTab: AnalyticsTab
    let metricsService: PerformanceMetricsService
    let onRefresh: () -> Void
    let onExport: () -> Void
    let onOptimize: () -> Void
    
    var body: some View {
        HStack {
            // Title and description
            VStack(alignment: .leading, spacing: 2) {
                Text(selectedTab.rawValue)
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text(selectedTab.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Toolbar actions
            HStack(spacing: 8) {
                // Performance indicator
                if metricsService.isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                }
                
                // Refresh button
                Button(action: onRefresh) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
                .disabled(metricsService.isLoading)
                
                // Export button
                Button(action: onExport) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
                
                // Optimization button
                Button(action: onOptimize) {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

// MARK: - Overview Tab

struct OverviewTab: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Key Metrics Cards
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 3), spacing: 16) {
                    MetricCard(
                        title: "Attention Efficiency",
                        value: String(format: "%.1f%%", metricsService.currentMetrics.attentionEfficiency * 100),
                        trend: metricsService.attentionEfficiencyTrend,
                        icon: "brain.head.profile",
                        color: .purple
                    )
                    
                    MetricCard(
                        title: "Memory Utilization",
                        value: formatBytes(metricsService.currentMetrics.memoryUsage),
                        trend: metricsService.memoryUsageTrend,
                        icon: "memorychip",
                        color: .blue
                    )
                    
                    MetricCard(
                        title: "Token Throughput",
                        value: "\(metricsService.currentMetrics.tokensPerSecond)/s",
                        trend: metricsService.throughputTrend,
                        icon: "speedometer",
                        color: .green
                    )
                }
                
                // Real-time Charts Section
                VStack(alignment: .leading, spacing: 16) {
                    Text("Real-Time Performance")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    HStack(spacing: 16) {
                        // Attention Efficiency Chart
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Attention Efficiency")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Chart(metricsService.attentionEfficiencyHistory) { point in
                                LineMark(
                                    x: .value("Time", point.timestamp),
                                    y: .value("Efficiency", point.value)
                                )
                                .foregroundStyle(.purple)
                                .lineStyle(StrokeStyle(lineWidth: 2))
                            }
                            .frame(height: 120)
                            .chartYScale(domain: 0...1)
                            .chartXAxis(.hidden)
                        }
                        .padding()
                        .background(Color(NSColor.controlBackgroundColor))
                        .cornerRadius(12)
                        
                        // Memory Usage Chart
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Memory Usage")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Chart(metricsService.memoryUsageHistory) { point in
                                AreaMark(
                                    x: .value("Time", point.timestamp),
                                    y: .value("Memory", point.value)
                                )
                                .foregroundStyle(.blue.opacity(0.3))
                                
                                LineMark(
                                    x: .value("Time", point.timestamp),
                                    y: .value("Memory", point.value)
                                )
                                .foregroundStyle(.blue)
                                .lineStyle(StrokeStyle(lineWidth: 2))
                            }
                            .frame(height: 120)
                            .chartXAxis(.hidden)
                        }
                        .padding()
                        .background(Color(NSColor.controlBackgroundColor))
                        .cornerRadius(12)
                    }
                }
                
                // System Health Overview
                SystemHealthOverview(metricsService: metricsService)
                
                // Recent Optimizations
                RecentOptimizationsView(metricsService: metricsService)
            }
            .padding(20)
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Metric Card

struct MetricCard: View {
    let title: String
    let value: String
    let trend: TrendDirection
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                
                Spacer()
                
                TrendIndicator(trend: trend)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(value)
                    .font(.title)
                    .fontWeight(.bold)
                
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
}

struct TrendIndicator: View {
    let trend: TrendDirection
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: trend.icon)
                .font(.caption)
                .foregroundColor(trend.color)
            
            Text(trend.description)
                .font(.caption2)
                .foregroundColor(trend.color)
        }
    }
}

enum TrendDirection {
    case up(Double)
    case down(Double)
    case stable
    
    var icon: String {
        switch self {
        case .up: return "arrow.up.right"
        case .down: return "arrow.down.right"
        case .stable: return "minus"
        }
    }
    
    var color: Color {
        switch self {
        case .up: return .green
        case .down: return .red
        case .stable: return .gray
        }
    }
    
    var description: String {
        switch self {
        case .up(let percent): return "+\(String(format: "%.1f", percent))%"
        case .down(let percent): return "-\(String(format: "%.1f", percent))%"
        case .stable: return "stable"
        }
    }
}

// MARK: - System Health Overview

struct SystemHealthOverview: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("System Health")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 2), spacing: 12) {
                HealthIndicator(
                    title: "Flash Attention",
                    status: metricsService.flashAttentionHealth,
                    icon: "brain.head.profile"
                )
                
                HealthIndicator(
                    title: "Memory Optimization",
                    status: metricsService.memoryOptimizationHealth,
                    icon: "memorychip"
                )
                
                HealthIndicator(
                    title: "Token Processing",
                    status: metricsService.tokenProcessingHealth,
                    icon: "flowchart"
                )
                
                HealthIndicator(
                    title: "Model Performance",
                    status: metricsService.modelPerformanceHealth,
                    icon: "speedometer"
                )
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
}

struct HealthIndicator: View {
    let title: String
    let status: HealthStatus
    let icon: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(status.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(status.description)
                    .font(.caption)
                    .foregroundColor(status.color)
            }
            
            Spacer()
            
            Circle()
                .fill(status.color)
                .frame(width: 8, height: 8)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

enum HealthStatus {
    case excellent
    case good
    case fair
    case poor
    case critical
    
    var color: Color {
        switch self {
        case .excellent: return .green
        case .good: return .mint
        case .fair: return .yellow
        case .poor: return .orange
        case .critical: return .red
        }
    }
    
    var description: String {
        switch self {
        case .excellent: return "Excellent"
        case .good: return "Good"
        case .fair: return "Fair"
        case .poor: return "Poor"
        case .critical: return "Critical"
        }
    }
}

// MARK: - Recent Optimizations

struct RecentOptimizationsView: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Recent Optimizations")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("View All") {
                    // Show detailed optimizations
                }
                .font(.caption)
            }
            
            if metricsService.recentOptimizations.isEmpty {
                Text("No recent optimizations")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 8)
            } else {
                ForEach(metricsService.recentOptimizations.prefix(3), id: \.id) { optimization in
                    OptimizationRow(optimization: optimization)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
}

struct OptimizationRow: View {
    let optimization: OptimizationSuggestion
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: optimization.type.icon)
                .font(.title3)
                .foregroundColor(optimization.type.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(optimization.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(optimization.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("+\(String(format: "%.1f", optimization.expectedImprovement * 100))%")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.green)
                
                Text(optimization.timestamp.formatted(.relative(presentation: .named)))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Export and Optimization Sheets

struct AnalyticsExportSheet: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Export Analytics Data")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                // Export options would go here
                Text("Export functionality coming soon...")
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            .padding()
            .navigationTitle("Export Data")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .frame(width: 500, height: 400)
    }
}

struct OptimizationRecommendationsSheet: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Optimization Recommendations")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                // Recommendations would go here
                Text("Optimization recommendations coming soon...")
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            .padding()
            .navigationTitle("Optimize Performance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .frame(width: 600, height: 500)
    }
}

#Preview {
    FlashAttentionAnalytics()
        .frame(width: 1200, height: 800)
}