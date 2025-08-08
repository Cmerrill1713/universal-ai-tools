import SwiftUI
import Charts

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    @State private var systemMetrics: SystemMetrics?
    @State private var isLoadingMetrics = false
    @State private var selectedTimeRange = TimeRange.hour
    
    enum TimeRange: String, CaseIterable {
        case hour = "1H"
        case day = "24H"
        case week = "7D"
        case month = "30D"
        
        var displayName: String {
            switch self {
            case .hour: return "Last Hour"
            case .day: return "Last 24 Hours"
            case .week: return "Last Week"
            case .month: return "Last Month"
            }
        }
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header
                headerSection
                
                // Quick Stats
                statsGrid
                
                // Performance Charts
                if let metrics = systemMetrics {
                    performanceCharts(metrics)
                }
                
                // Agent Status
                agentStatusSection
                
                // Recent Activity
                recentActivitySection
            }
            .padding()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(NSColor.windowBackgroundColor))
        .onAppear {
            loadMetrics()
        }
        .refreshable {
            await loadMetricsAsync()
        }
    }
    
    // MARK: - Header Section
    
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Universal AI Tools")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("System Dashboard")
                    .font(.headline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Time Range Picker
            Picker("Time Range", selection: $selectedTimeRange) {
                ForEach(TimeRange.allCases, id: \.self) { range in
                    Text(range.rawValue).tag(range)
                }
            }
            .pickerStyle(SegmentedPickerStyle())
            .frame(width: 200)
            .onChange(of: selectedTimeRange) { _ in
                loadMetrics()
            }
            
            // Refresh Button
            Button(action: { loadMetrics() }) {
                Image(systemName: "arrow.clockwise")
                    .foregroundColor(isLoadingMetrics ? .gray : .accentColor)
            }
            .disabled(isLoadingMetrics)
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.bottom)
    }
    
    // MARK: - Stats Grid
    
    private var statsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            StatCard(
                title: "Active Agents",
                value: "\(appState.activeAgents.count)",
                icon: "cpu",
                color: .blue,
                trend: .up(12)
            )
            
            StatCard(
                title: "API Calls",
                value: formatNumber(systemMetrics?.apiCalls ?? 0),
                icon: "network",
                color: .green,
                trend: .up(8)
            )
            
            StatCard(
                title: "Memory Usage",
                value: formatMemory(systemMetrics?.memoryUsage ?? 0),
                icon: "memorychip",
                color: .orange,
                trend: .stable
            )
            
            StatCard(
                title: "Response Time",
                value: "\(systemMetrics?.avgResponseTime ?? 0)ms",
                icon: "timer",
                color: .purple,
                trend: .down(15)
            )
        }
    }
    
    // MARK: - Performance Charts
    
    private func performanceCharts(_ metrics: SystemMetrics) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Performance Metrics")
                .font(.headline)
                .padding(.top)
            
            HStack(spacing: 16) {
                // CPU Usage Chart
                ChartCard(title: "CPU Usage") {
                    Chart(metrics.cpuHistory) { point in
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("CPU %", point.value)
                        )
                        .foregroundStyle(.blue)
                        
                        AreaMark(
                            x: .value("Time", point.timestamp),
                            y: .value("CPU %", point.value)
                        )
                        .foregroundStyle(.blue.opacity(0.1))
                    }
                    .frame(height: 150)
                }
                
                // Memory Usage Chart
                ChartCard(title: "Memory Usage") {
                    Chart(metrics.memoryHistory) { point in
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Memory MB", point.value / 1024 / 1024)
                        )
                        .foregroundStyle(.orange)
                        
                        AreaMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Memory MB", point.value / 1024 / 1024)
                        )
                        .foregroundStyle(.orange.opacity(0.1))
                    }
                    .frame(height: 150)
                }
            }
            
            HStack(spacing: 16) {
                // Request Rate Chart
                ChartCard(title: "Request Rate") {
                    Chart(metrics.requestHistory) { point in
                        BarMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Requests/min", point.value)
                        )
                        .foregroundStyle(.green)
                    }
                    .frame(height: 150)
                }
                
                // Response Time Chart
                ChartCard(title: "Response Time") {
                    Chart(metrics.responseTimeHistory) { point in
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Time (ms)", point.value)
                        )
                        .foregroundStyle(.purple)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        
                        PointMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Time (ms)", point.value)
                        )
                        .foregroundStyle(.purple)
                    }
                    .frame(height: 150)
                }
            }
        }
    }
    
    // MARK: - Agent Status Section
    
    private var agentStatusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Agent Status")
                .font(.headline)
                .padding(.top)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(appState.activeAgents) { agent in
                        AgentStatusCard(agent: agent)
                    }
                }
            }
        }
    }
    
    // MARK: - Recent Activity
    
    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Activity")
                    .font(.headline)
                
                Spacer()
                
                Button("View All") {
                    appState.selectedSidebarItem = .activity
                }
                .buttonStyle(LinkButtonStyle())
            }
            
            VStack(spacing: 8) {
                ForEach(appState.recentActivities.prefix(5)) { activity in
                    ActivityRow(activity: activity)
                }
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)
        }
    }
    
    // MARK: - Helper Methods
    
    private func loadMetrics() {
        isLoadingMetrics = true
        
        Task {
            do {
                systemMetrics = try await apiService.getSystemMetrics()
                isLoadingMetrics = false
            } catch {
                print("Failed to load metrics:", error)
                isLoadingMetrics = false
            }
        }
    }
    
    private func loadMetricsAsync() async {
        do {
            systemMetrics = try await apiService.getSystemMetrics()
        } catch {
            print("Failed to load metrics:", error)
        }
    }
    
    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }
    
    private func formatMemory(_ bytes: Int) -> String {
        let mb = Double(bytes) / 1024 / 1024
        if mb < 1024 {
            return String(format: "%.1f MB", mb)
        } else {
            let gb = mb / 1024
            return String(format: "%.2f GB", gb)
        }
    }
}

// MARK: - Supporting Views

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    let trend: Trend
    
    enum Trend {
        case up(Int)
        case down(Int)
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
        
        var text: String {
            switch self {
            case .up(let percent): return "+\(percent)%"
            case .down(let percent): return "-\(percent)%"
            case .stable: return "0%"
            }
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title2)
                
                Spacer()
                
                HStack(spacing: 2) {
                    Image(systemName: trend.icon)
                        .font(.caption)
                    Text(trend.text)
                        .font(.caption)
                }
                .foregroundColor(trend.color)
            }
            
            Text(value)
                .font(.title)
                .fontWeight(.semibold)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
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
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            content
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
        .frame(maxWidth: .infinity)
    }
}

struct AgentStatusCard: View {
    let agent: Agent
    
    var statusColor: Color {
        switch agent.status {
        case "active": return .green
        case "idle": return .orange
        case "error": return .red
        default: return .gray
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                
                Text(agent.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            
            Text(agent.type)
                .font(.caption)
                .foregroundColor(.secondary)
            
            HStack {
                Image(systemName: "clock")
                    .font(.caption2)
                Text(agent.lastActive)
                    .font(.caption2)
            }
            .foregroundColor(.secondary)
        }
        .padding()
        .frame(width: 150)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

struct ActivityRow: View {
    let activity: Activity
    
    var body: some View {
        HStack {
            Image(systemName: activity.icon)
                .foregroundColor(Color(activity.color))
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(activity.title)
                    .font(.subheadline)
                
                Text(activity.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(activity.timestamp)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct LinkButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(.accentColor)
            .font(.subheadline)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}