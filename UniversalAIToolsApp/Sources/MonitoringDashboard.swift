import SwiftUI

struct MonitoringDashboard: View {
    @StateObject private var groundingManager = GroundingSystemManager()
    @State private var selectedTab = 0
    @State private var showingAlerts = false
    @State private var isRefreshing = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Enhanced Header with gradient background
            VStack(spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("System Monitoring")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundStyle(.primary)
                        
                        Text("Real-time system health and performance")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    Spacer()
                    
                    // Refresh button with animation
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            isRefreshing.toggle()
                        }
                        Task {
                            await groundingManager.checkAllServices()
                            await groundingManager.loadAIMetrics()
                            await groundingManager.checkAlerts()
                            
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    isRefreshing = false
                                }
                            }
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .font(.title3)
                            .foregroundColor(.blue)
                            .rotationEffect(.degrees(isRefreshing ? 360 : 0))
                            .animation(.linear(duration: 1.0).repeatForever(autoreverses: false), value: isRefreshing)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .padding(8)
                    .background(Color.blue.opacity(0.1))
                    .clipShape(Circle())
                    .scaleEffect(isRefreshing ? 1.1 : 1.0)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 12)
                
                // Tab Picker with enhanced styling
                Picker("Monitoring Category", selection: $selectedTab) {
                    Text("Overview").tag(0)
                    Text("AI Metrics").tag(1)
                    Text("Services").tag(2)
                    Text("Alerts").tag(3)
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding(.horizontal, 20)
                .padding(.bottom, 16)
            }
            .background(
                ZStack {
                    // Base gradient
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.blue.opacity(0.08),
                            Color.purple.opacity(0.05),
                            Color.clear
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    
                    // Glassmorphism overlay
                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .background(
                            Rectangle()
                                .fill(.ultraThinMaterial)
                        )
                }
            )
            
            // Content with smooth transitions
            TabView(selection: $selectedTab) {
                OverviewTab(groundingManager: groundingManager)
                    .tag(0)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                
                AIMetricsTab(groundingManager: groundingManager)
                    .tag(1)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                
                ServicesTab(groundingManager: groundingManager)
                    .tag(2)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                
                AlertsTab(groundingManager: groundingManager)
                    .tag(3)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
            .tabViewStyle(DefaultTabViewStyle())
            .animation(.easeInOut(duration: 0.3), value: selectedTab)
        }
        .frame(minWidth: 800, minHeight: 600)
        .background(Color(.windowBackgroundColor))
        .sheet(isPresented: $showingAlerts) {
            AlertsView(groundingManager: groundingManager)
        }
    }
}

// MARK: - Overview Tab

struct OverviewTab: View {
    @ObservedObject var groundingManager: GroundingSystemManager
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // System Status Summary
                VStack(alignment: .leading, spacing: 16) {
                    Text("System Status Summary")
                        .font(.headline)
                        .padding(.bottom, 4)
                    
                    HStack(spacing: 16) {
                        StatusCard(
                            title: "Healthy Services",
                            value: "\(healthyServicesCount)",
                            color: .green,
                            icon: "checkmark.circle.fill"
                        )
                        
                        StatusCard(
                            title: "Total Metrics",
                            value: "\(groundingManager.aiMetrics.count)",
                            color: .blue,
                            icon: "chart.line.uptrend.xyaxis"
                        )
                        
                        StatusCard(
                            title: "Active Alerts",
                            value: "\(groundingManager.systemAlerts.count)",
                            color: groundingManager.systemAlerts.isEmpty ? .green : .red,
                            icon: "exclamationmark.triangle.fill"
                        )
                    }
                    .padding(.horizontal, 4)
                }
                
                // Last Update Times
                VStack(alignment: .leading, spacing: 8) {
                    Text("Last Updates")
                        .font(.headline)
                    
                    HStack {
                        Text("Health Check:")
                        Spacer()
                        Text(groundingManager.lastHealthUpdate?.formatted(date: .omitted, time: .shortened) ?? "Never")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Metrics Update:")
                        Spacer()
                        Text(groundingManager.lastMetricsUpdate?.formatted(date: .omitted, time: .shortened) ?? "Never")
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
                
                // Quick Actions
                VStack(alignment: .leading, spacing: 16) {
                    Text("Quick Actions")
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundStyle(.primary)
                        .padding(.bottom, 4)
                    
                    HStack(spacing: 16) {
                        EnhancedActionButton(
                            title: "Refresh All",
                            icon: "arrow.clockwise",
                            color: .blue,
                            action: {
                                Task {
                                    await groundingManager.checkAllServices()
                                    await groundingManager.loadAIMetrics()
                                    await groundingManager.checkAlerts()
                                }
                            }
                        )
                        
                        EnhancedActionButton(
                            title: "Open Grafana",
                            icon: "chart.line.uptrend.xyaxis",
                            color: .orange,
                            action: {
                                if let url = URL(string: "http://localhost:3000") {
                                    NSWorkspace.shared.open(url)
                                }
                            }
                        )
                        
                        EnhancedActionButton(
                            title: "Open Prometheus",
                            icon: "speedometer",
                            color: .red,
                            action: {
                                if let url = URL(string: "http://localhost:9091") {
                                    NSWorkspace.shared.open(url)
                                }
                            }
                        )
                    }
                    .padding(.horizontal, 4)
                }
            }
            .padding()
        }
    }
    
    private var healthyServicesCount: Int {
        groundingManager.serviceStatuses.filter { $0.status == .healthy }.count
    }
}

// MARK: - AI Metrics Tab

struct AIMetricsTab: View {
    @ObservedObject var groundingManager: GroundingSystemManager
    @State private var selectedMetricType = "all"
    @State private var sortOrder = "name"
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Enhanced header with controls
                VStack(alignment: .leading, spacing: 12) {
                    Text("AI Metrics Dashboard")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(.primary)
                    
                    HStack {
                        // Metric type filter
                        Picker("Metric Type", selection: $selectedMetricType) {
                            Text("All Metrics").tag("all")
                            Text("Requests").tag("requests")
                            Text("Response Time").tag("response_time")
                            Text("Accuracy").tag("accuracy")
                            Text("Health").tag("health")
                        }
                        .pickerStyle(MenuPickerStyle())
                        .frame(maxWidth: 150)
                        
                        Spacer()
                        
                        // Sort order
                        Picker("Sort", selection: $sortOrder) {
                            Text("Name").tag("name")
                            Text("Value").tag("value")
                            Text("Type").tag("type")
                        }
                        .pickerStyle(MenuPickerStyle())
                        .frame(maxWidth: 100)
                    }
                }
                .padding(.horizontal, 20)
                
                // Metrics summary cards
                if !groundingManager.aiMetrics.isEmpty {
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 16) {
                        MetricSummaryCard(
                            title: "Total Metrics",
                            value: "\(groundingManager.aiMetrics.count)",
                            icon: "chart.bar.fill",
                            color: .blue
                        )
                        
                        MetricSummaryCard(
                            title: "Active Services",
                            value: "\(Set(groundingManager.aiMetrics.map { $0.labels["service"] ?? "unknown" }).count)",
                            icon: "server.rack",
                            color: .green
                        )
                        
                        MetricSummaryCard(
                            title: "Avg Response Time",
                            value: "\(String(format: "%.2f", averageResponseTime))ms",
                            icon: "clock.fill",
                            color: .orange
                        )
                    }
                    .padding(.horizontal, 20)
                }
                
                // Enhanced metrics list
                LazyVStack(spacing: 12) {
                    ForEach(filteredMetrics.prefix(25)) { metric in
                        EnhancedMetricRow(metric: metric)
                    }
                }
                .padding(.horizontal, 20)
                
                if groundingManager.aiMetrics.count > 25 {
                    Text("Showing first 25 of \(groundingManager.aiMetrics.count) metrics")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 20)
                        .padding(.top, 8)
                }
            }
            .padding(.vertical, 20)
        }
    }
    
    private var filteredMetrics: [AIMetric] {
        let filtered = groundingManager.aiMetrics.filter { metric in
            switch selectedMetricType {
            case "requests":
                return metric.name.contains("requests")
            case "response_time":
                return metric.name.contains("response_time") || metric.name.contains("latency")
            case "accuracy":
                return metric.name.contains("accuracy") || metric.name.contains("precision")
            case "health":
                return metric.name.contains("health") || metric.name.contains("status")
            default:
                return true
            }
        }
        
        return filtered.sorted { metric1, metric2 in
            switch sortOrder {
            case "value":
                return metric1.value > metric2.value
            case "type":
                return metric1.name < metric2.name
            default:
                return metric1.name < metric2.name
            }
        }
    }
    
    private var averageResponseTime: Double {
        let responseTimeMetrics = groundingManager.aiMetrics.filter { $0.name.contains("response_time") }
        guard !responseTimeMetrics.isEmpty else { return 0.0 }
        let sum = responseTimeMetrics.reduce(0.0) { $0 + $1.value }
        return (sum / Double(responseTimeMetrics.count)) * 1000 // Convert to milliseconds
    }
}

struct MetricSummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    @State private var isHovered = false
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
                .scaleEffect(isHovered ? 1.1 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHovered)
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(.primary)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(color.opacity(0.3), lineWidth: 1)
                )
        )
        .shadow(color: color.opacity(0.1), radius: 4, x: 0, y: 2)
        .scaleEffect(isHovered ? 1.02 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isHovered)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
    }
}

struct EnhancedMetricRow: View {
    let metric: AIMetric
    
    @State private var isHovered = false
    @State private var isVisible = false
    
    var body: some View {
        HStack(spacing: 16) {
            // Metric icon based on type
            ZStack {
                Circle()
                    .fill(metricColor.opacity(0.2))
                    .frame(width: 40, height: 40)
                
                Image(systemName: metricIcon)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(metricColor)
            }
            .scaleEffect(isHovered ? 1.1 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHovered)
            
            // Metric info
            VStack(alignment: .leading, spacing: 4) {
                Text(metric.name)
                    .font(.system(.body, design: .monospaced))
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                
                if !metric.labels.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(Array(metric.labels.keys.sorted()), id: \.self) { key in
                                HStack(spacing: 4) {
                                    Text(key)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                    Text(metric.labels[key] ?? "")
                                        .font(.caption2)
                                        .fontWeight(.medium)
                                        .foregroundColor(metricColor)
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(
                                    Capsule()
                                        .fill(metricColor.opacity(0.1))
                                        .overlay(
                                            Capsule()
                                                .stroke(metricColor.opacity(0.3), lineWidth: 1)
                                        )
                                )
                            }
                        }
                        .padding(.horizontal, 4)
                    }
                }
            }
            
            Spacer()
            
            // Value with enhanced styling
            VStack(alignment: .trailing, spacing: 2) {
                Text(formattedValue)
                    .font(.system(.title3, design: .monospaced))
                    .fontWeight(.bold)
                    .foregroundColor(metricColor)
                
                if metric.value > 1000 {
                    Text("High")
                        .font(.caption2)
                        .foregroundColor(.orange)
                        .fontWeight(.medium)
                } else if metric.value > 100 {
                    Text("Medium")
                        .font(.caption2)
                        .foregroundColor(.blue)
                        .fontWeight(.medium)
                } else {
                    Text("Low")
                        .font(.caption2)
                        .foregroundColor(.green)
                        .fontWeight(.medium)
                }
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    metricColor.opacity(isHovered ? 0.4 : 0.2),
                                    metricColor.opacity(isHovered ? 0.2 : 0.1)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: isHovered ? 1.5 : 1
                        )
                )
        )
        .shadow(
            color: metricColor.opacity(isHovered ? 0.15 : 0.08),
            radius: isHovered ? 6 : 3,
            x: 0,
            y: isHovered ? 3 : 1
        )
        .scaleEffect(isVisible ? (isHovered ? 1.02 : 1.0) : 0.8)
        .opacity(isVisible ? 1.0 : 0.0)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isVisible)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8).delay(0.1)) {
                isVisible = true
            }
        }
    }
    
    private var metricColor: Color {
        if metric.name.contains("error") || metric.name.contains("failure") {
            return .red
        } else if metric.name.contains("warning") {
            return .orange
        } else if metric.name.contains("success") || metric.name.contains("healthy") {
            return .green
        } else if metric.name.contains("response_time") || metric.name.contains("latency") {
            return .blue
        } else {
            return .purple
        }
    }
    
    private var metricIcon: String {
        if metric.name.contains("requests") {
            return "arrow.up.circle.fill"
        } else if metric.name.contains("response_time") || metric.name.contains("latency") {
            return "clock.fill"
        } else if metric.name.contains("error") {
            return "exclamationmark.triangle.fill"
        } else if metric.name.contains("health") {
            return "heart.fill"
        } else {
            return "chart.line.uptrend.xyaxis"
        }
    }
    
    private var formattedValue: String {
        if metric.value >= 1000000 {
            return String(format: "%.1fM", metric.value / 1000000)
        } else if metric.value >= 1000 {
            return String(format: "%.1fK", metric.value / 1000)
        } else if metric.value < 0.01 {
            return String(format: "%.4f", metric.value)
        } else {
            return String(format: "%.2f", metric.value)
        }
    }
}

// MARK: - Services Tab

struct ServicesTab: View {
    @ObservedObject var groundingManager: GroundingSystemManager
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Service Status")
                    .font(.headline)
                    .padding(.horizontal)
                
                LazyVStack(spacing: 8) {
                    ForEach(groundingManager.serviceStatuses) { service in
                        ServiceRow(service: service)
                    }
                }
                .padding(.horizontal)
            }
        }
    }
}

struct ServiceRow: View {
    let service: ServiceStatus
    
    var body: some View {
        HStack {
            Image(systemName: service.status == .healthy ? "checkmark.circle.fill" : 
                  service.status == .warning ? "exclamationmark.triangle.fill" : "xmark.circle.fill")
                .foregroundColor(service.statusColor)
                .font(.title3)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(service.name)
                    .font(.headline)
                
                Text(service.url)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("Last check: \(service.lastCheck.formatted(date: .omitted, time: .shortened))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(service.status.rawValue)
                .font(.caption)
                .foregroundColor(service.statusColor)
                .fontWeight(.medium)
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Alerts Tab

struct AlertsTab: View {
    @ObservedObject var groundingManager: GroundingSystemManager
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("System Alerts")
                    .font(.headline)
                    .padding(.horizontal)
                
                if groundingManager.systemAlerts.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.green)
                        
                        Text("No Active Alerts")
                            .font(.title2)
                            .fontWeight(.medium)
                        
                        Text("All systems are running normally")
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(groundingManager.systemAlerts) { alert in
                            AlertRow(alert: alert)
                        }
                    }
                    .padding(.horizontal)
                }
            }
        }
    }
}

struct AlertRow: View {
    let alert: SystemAlert
    
    var body: some View {
        HStack(alignment: .top) {
            Image(systemName: alert.severity == .critical ? "exclamationmark.triangle.fill" : 
                  alert.severity == .warning ? "exclamationmark.triangle" : "info.circle.fill")
                .foregroundColor(alert.severityColor)
                .font(.title3)
                .padding(.top, 2)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(alert.title)
                    .font(.headline)
                
                Text(alert.message)
                    .font(.body)
                    .foregroundColor(.secondary)
                
                Text("Since: \(alert.activeSince.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(alert.severity.rawValue)
                .font(.caption)
                .foregroundColor(alert.severityColor)
                .fontWeight(.medium)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(alert.severityColor.opacity(0.2))
                .cornerRadius(4)
        }
        .padding()
        .background(alert.severityColor.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Supporting Views

struct EnhancedActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    @State private var isHovered = false
    @State private var isPressed = false
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(color)
                    .scaleEffect(isHovered ? 1.1 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHovered)
                
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.primary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(PlainButtonStyle())
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            color.opacity(isHovered ? 0.15 : 0.08),
                            color.opacity(isHovered ? 0.08 : 0.04)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    color.opacity(isHovered ? 0.4 : 0.2),
                                    color.opacity(isHovered ? 0.2 : 0.1)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: isHovered ? 1.5 : 1
                        )
                )
        )
        .shadow(
            color: color.opacity(0.1),
            radius: isHovered ? 6 : 3,
            x: 0,
            y: isHovered ? 3 : 1
        )
        .scaleEffect(isPressed ? 0.95 : (isHovered ? 1.02 : 1.0))
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
        .animation(.spring(response: 0.2, dampingFraction: 0.8), value: isPressed)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            withAnimation(.easeInOut(duration: 0.1)) {
                isPressed = pressing
            }
        }, perform: {})
    }
}

struct StatusCard: View {
    let title: String
    let value: String
    let color: Color
    let icon: String
    
    @State private var isHovered = false
    
    var body: some View {
        VStack(spacing: 10) {
            // Icon with subtle animation
            ZStack {
                Circle()
                    .fill(color.opacity(0.2))
                    .frame(width: 48, height: 48)
                
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                    .scaleEffect(isHovered ? 1.1 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHovered)
            }
            
            // Value with emphasis
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(color)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .scaleEffect(isHovered ? 1.05 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
            
            // Title with better typography
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, minHeight: 120)
        .padding(.vertical, 20)
        .padding(.horizontal, 16)
        .background(
            ZStack {
                // Glassmorphism base
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
                    .opacity(0.8)
                
                // Dynamic gradient overlay
                LinearGradient(
                    gradient: Gradient(colors: [
                        color.opacity(isHovered ? 0.2 : 0.12),
                        color.opacity(isHovered ? 0.12 : 0.06),
                        color.opacity(isHovered ? 0.08 : 0.04)
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .animation(.easeInOut(duration: 0.3), value: isHovered)
                
                // Subtle noise texture
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        RadialGradient(
                            gradient: Gradient(colors: [
                                Color.white.opacity(0.1),
                                Color.clear
                            ]),
                            center: .topLeading,
                            startRadius: 0,
                            endRadius: 100
                        )
                    )
                    .blendMode(.overlay)
            }
        )
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            color.opacity(0.4),
                            color.opacity(0.2)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: isHovered ? 2 : 1
                )
                .animation(.easeInOut(duration: 0.2), value: isHovered)
        )
        .shadow(
            color: color.opacity(0.15),
            radius: isHovered ? 8 : 4,
            x: 0,
            y: isHovered ? 4 : 2
        )
        .scaleEffect(isHovered ? 1.02 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isHovered)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
    }
}

struct AlertsView: View {
    @ObservedObject var groundingManager: GroundingSystemManager
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack {
            HStack {
                Text("System Alerts")
                    .font(.headline)
                
                Spacer()
                
                Button("Done") {
                    dismiss()
                }
            }
            .padding()
            
            if groundingManager.systemAlerts.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.green)
                    
                    Text("No Active Alerts")
                        .font(.title2)
                        .fontWeight(.medium)
                    
                    Text("All systems are running normally")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(groundingManager.systemAlerts) { alert in
                    AlertRow(alert: alert)
                }
            }
        }
        .frame(width: 600, height: 400)
    }
}
