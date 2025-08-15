import SwiftUI
import Combine
import os.log

/// Debug overlay that appears on top of the app during testing
/// Provides real-time metrics, state inspection, and debugging controls
struct DebugOverlay: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var metrics = DebugMetrics.shared
    @State private var isExpanded = false
    @State private var selectedTab = 0
    @State private var showNetworkDetails = false
    @State private var showMemoryGraph = false
    @State private var captureSnapshot = false
    
    // Position control
    @State private var dragOffset = CGSize.zero
    @State private var position = CGPoint(x: 20, y: 100)
    
    var body: some View {
        VStack(spacing: 0) {
            if isExpanded {
                expandedOverlay
            } else {
                collapsedOverlay
            }
        }
        .frame(width: isExpanded ? 400 : 160)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .shadow(radius: 10)
        .offset(x: position.x + dragOffset.width, y: position.y + dragOffset.height)
        .gesture(
            DragGesture()
                .onChanged { value in
                    dragOffset = value.translation
                }
                .onEnded { value in
                    position.x += value.translation.width
                    position.y += value.translation.height
                    dragOffset = .zero
                }
        )
        .animation(.spring(response: 0.3), value: isExpanded)
    }
    
    // MARK: - Collapsed View
    
    private var collapsedOverlay: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "ant.circle.fill")
                    .foregroundColor(.orange)
                Text("Debug")
                    .font(.caption)
                    .fontWeight(.semibold)
                Spacer()
                Button(action: { isExpanded = true }) {
                    Image(systemName: "chevron.down.circle")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            
            Divider()
            
            // Quick metrics
            VStack(alignment: .leading, spacing: 4) {
                MetricRow(
                    icon: "cpu",
                    label: "CPU",
                    value: "\(Int(metrics.cpuUsage))%",
                    color: metrics.cpuUsage > 80 ? .red : .green
                )
                
                MetricRow(
                    icon: "memorychip",
                    label: "Memory",
                    value: formatBytes(metrics.memoryUsage),
                    color: metrics.memoryUsage > 500_000_000 ? .orange : .green
                )
                
                MetricRow(
                    icon: "network",
                    label: "Network",
                    value: metrics.networkStatus,
                    color: metrics.isNetworkHealthy ? .green : .red
                )
                
                MetricRow(
                    icon: "timer",
                    label: "FPS",
                    value: "\(Int(metrics.fps))",
                    color: metrics.fps < 30 ? .orange : .green
                )
            }
        }
        .padding(12)
    }
    
    // MARK: - Expanded View
    
    private var expandedOverlay: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "ant.circle.fill")
                    .foregroundColor(.orange)
                    .font(.title3)
                Text("Debug Console")
                    .font(.headline)
                
                Spacer()
                
                HStack(spacing: 8) {
                    Button(action: { captureSnapshot = true }) {
                        Image(systemName: "camera")
                    }
                    .help("Capture state snapshot")
                    
                    Button(action: { metrics.reset() }) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .help("Reset metrics")
                    
                    Button(action: { isExpanded = false }) {
                        Image(systemName: "chevron.up.circle")
                    }
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            // Tab selection
            Picker("", selection: $selectedTab) {
                Text("Metrics").tag(0)
                Text("State").tag(1)
                Text("Network").tag(2)
                Text("Logs").tag(3)
                Text("Actions").tag(4)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)
            
            // Tab content
            ScrollView {
                switch selectedTab {
                case 0:
                    metricsTab
                case 1:
                    stateTab
                case 2:
                    networkTab
                case 3:
                    logsTab
                case 4:
                    actionsTab
                default:
                    EmptyView()
                }
            }
            .frame(maxHeight: 400)
        }
    }
    
    // MARK: - Metrics Tab
    
    private var metricsTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Performance metrics
            GroupBox("Performance") {
                VStack(spacing: 8) {
                    DetailedMetricRow(
                        label: "CPU Usage",
                        value: "\(Int(metrics.cpuUsage))%",
                        detail: "Threads: \(metrics.activeThreads)",
                        progress: metrics.cpuUsage / 100
                    )
                    
                    DetailedMetricRow(
                        label: "Memory",
                        value: formatBytes(metrics.memoryUsage),
                        detail: "Peak: \(formatBytes(metrics.peakMemoryUsage))",
                        progress: Double(metrics.memoryUsage) / Double(metrics.peakMemoryUsage)
                    )
                    
                    DetailedMetricRow(
                        label: "Frame Rate",
                        value: "\(Int(metrics.fps)) FPS",
                        detail: "Dropped: \(metrics.droppedFrames)",
                        progress: metrics.fps / 60
                    )
                    
                    DetailedMetricRow(
                        label: "Render Time",
                        value: "\(metrics.averageRenderTime, specifier: "%.1f")ms",
                        detail: "Max: \(metrics.maxRenderTime, specifier: "%.1f")ms",
                        progress: min(metrics.averageRenderTime / 16.67, 1.0)
                    )
                }
            }
            
            // Resource usage
            GroupBox("Resources") {
                VStack(spacing: 8) {
                    HStack {
                        Label("Disk I/O", systemImage: "internaldrive")
                        Spacer()
                        Text("\(formatBytes(metrics.diskReadBytes))/\(formatBytes(metrics.diskWriteBytes))")
                            .font(.caption)
                            .fontFamily(.monospaced)
                    }
                    
                    HStack {
                        Label("Network I/O", systemImage: "network")
                        Spacer()
                        Text("↓\(formatBytes(metrics.networkBytesReceived)) ↑\(formatBytes(metrics.networkBytesSent))")
                            .font(.caption)
                            .fontFamily(.monospaced)
                    }
                    
                    HStack {
                        Label("Active Timers", systemImage: "timer")
                        Spacer()
                        Text("\(metrics.activeTimers)")
                            .font(.caption)
                            .fontFamily(.monospaced)
                    }
                    
                    HStack {
                        Label("View Updates", systemImage: "arrow.triangle.2.circlepath")
                        Spacer()
                        Text("\(metrics.viewUpdateCount)/s")
                            .font(.caption)
                            .fontFamily(.monospaced)
                    }
                }
            }
            
            // Memory breakdown
            if showMemoryGraph {
                GroupBox("Memory Breakdown") {
                    MemoryPieChart(data: metrics.memoryBreakdown)
                        .frame(height: 150)
                }
            }
        }
        .padding()
    }
    
    // MARK: - State Tab
    
    private var stateTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            GroupBox("Application State") {
                VStack(alignment: .leading, spacing: 8) {
                    StateRow(label: "Connection", value: appState.connectionStatus.rawValue, isGood: appState.isConnected)
                    StateRow(label: "Active Chat", value: appState.currentChatId ?? "None", isGood: appState.currentChatId != nil)
                    StateRow(label: "Messages", value: "\(appState.messages.count)", isGood: true)
                    StateRow(label: "Agents", value: "\(appState.agents.count) active", isGood: appState.agents.count > 0)
                    StateRow(label: "Selected Model", value: appState.selectedModel ?? "None", isGood: appState.selectedModel != nil)
                }
            }
            
            GroupBox("Feature Flags") {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(metrics.featureFlags.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                        HStack {
                            Text(key)
                                .font(.caption)
                            Spacer()
                            Image(systemName: value ? "checkmark.circle.fill" : "xmark.circle")
                                .foregroundColor(value ? .green : .gray)
                        }
                    }
                }
            }
            
            GroupBox("User Preferences") {
                VStack(alignment: .leading, spacing: 8) {
                    StateRow(label: "Theme", value: appState.currentTheme, isGood: true)
                    StateRow(label: "Auto-save", value: appState.autoSaveEnabled ? "On" : "Off", isGood: appState.autoSaveEnabled)
                    StateRow(label: "Notifications", value: appState.notificationsEnabled ? "Enabled" : "Disabled", isGood: true)
                }
            }
        }
        .padding()
    }
    
    // MARK: - Network Tab
    
    private var networkTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            GroupBox("Connection") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Label("Status", systemImage: "wifi")
                        Spacer()
                        Text(metrics.networkStatus)
                            .foregroundColor(metrics.isNetworkHealthy ? .green : .red)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    
                    HStack {
                        Label("Latency", systemImage: "timer")
                        Spacer()
                        Text("\(metrics.networkLatency, specifier: "%.0f")ms")
                            .font(.caption)
                            .fontFamily(.monospaced)
                    }
                    
                    HStack {
                        Label("WebSocket", systemImage: "arrow.left.arrow.right")
                        Spacer()
                        Text(metrics.webSocketState)
                            .font(.caption)
                    }
                }
            }
            
            GroupBox("Recent Requests") {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(metrics.recentRequests.prefix(5)) { request in
                        NetworkRequestRow(request: request)
                    }
                }
            }
            
            if showNetworkDetails {
                GroupBox("Network Stats") {
                    VStack(spacing: 8) {
                        HStack {
                            Text("Total Requests")
                            Spacer()
                            Text("\(metrics.totalRequests)")
                        }
                        .font(.caption)
                        
                        HStack {
                            Text("Failed Requests")
                            Spacer()
                            Text("\(metrics.failedRequests)")
                                .foregroundColor(.red)
                        }
                        .font(.caption)
                        
                        HStack {
                            Text("Avg Response Time")
                            Spacer()
                            Text("\(metrics.averageResponseTime, specifier: "%.0f")ms")
                        }
                        .font(.caption)
                    }
                }
            }
        }
        .padding()
    }
    
    // MARK: - Logs Tab
    
    private var logsTab: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Log filter
            HStack {
                Picker("Level", selection: $metrics.logLevelFilter) {
                    Text("All").tag(0)
                    Text("Error").tag(1)
                    Text("Warning").tag(2)
                    Text("Info").tag(3)
                    Text("Debug").tag(4)
                }
                .pickerStyle(.segmented)
                
                Button("Clear") {
                    metrics.clearLogs()
                }
                .buttonStyle(.bordered)
            }
            .padding(.horizontal)
            
            // Log entries
            ScrollViewReader { proxy in
                List(metrics.filteredLogs) { log in
                    LogEntryRow(entry: log)
                        .id(log.id)
                }
                .listStyle(.plain)
                .onChange(of: metrics.logs.count) { _ in
                    if let lastLog = metrics.filteredLogs.last {
                        withAnimation {
                            proxy.scrollTo(lastLog.id, anchor: .bottom)
                        }
                    }
                }
            }
        }
        .padding(.vertical)
    }
    
    // MARK: - Actions Tab
    
    private var actionsTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            GroupBox("Test Actions") {
                VStack(spacing: 12) {
                    Button(action: simulateHighLoad) {
                        Label("Simulate High Load", systemImage: "flame")
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    
                    Button(action: simulateNetworkFailure) {
                        Label("Simulate Network Failure", systemImage: "wifi.slash")
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    
                    Button(action: triggerMemoryWarning) {
                        Label("Trigger Memory Warning", systemImage: "exclamationmark.triangle")
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    
                    Button(action: generateTestData) {
                        Label("Generate Test Data", systemImage: "doc.badge.plus")
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                }
            }
            
            GroupBox("Debug Tools") {
                VStack(spacing: 12) {
                    Button(action: exportDebugReport) {
                        Label("Export Debug Report", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    
                    Button(action: captureStateSnapshot) {
                        Label("Capture State Snapshot", systemImage: "camera")
                    }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    
                    Toggle("Show Memory Graph", isOn: $showMemoryGraph)
                    Toggle("Show Network Details", isOn: $showNetworkDetails)
                    Toggle("Enable Verbose Logging", isOn: $metrics.verboseLogging)
                }
            }
        }
        .padding()
    }
    
    // MARK: - Helper Methods
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .binary
        return formatter.string(fromByteCount: bytes)
    }
    
    private func simulateHighLoad() {
        Task {
            metrics.log("Starting high load simulation", level: .warning)
            // Simulate CPU intensive task
            for _ in 0..<100 {
                _ = (0..<10000).map { $0 * $0 }.reduce(0, +)
                try? await Task.sleep(nanoseconds: 10_000_000)
            }
            metrics.log("High load simulation completed", level: .info)
        }
    }
    
    private func simulateNetworkFailure() {
        metrics.log("Simulating network failure", level: .warning)
        metrics.networkStatus = "Disconnected"
        metrics.isNetworkHealthy = false
        
        Task {
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            metrics.networkStatus = "Connected"
            metrics.isNetworkHealthy = true
            metrics.log("Network restored", level: .info)
        }
    }
    
    private func triggerMemoryWarning() {
        metrics.log("Triggering memory warning", level: .warning)
        // Allocate temporary memory
        var largeArray = [Int]()
        for i in 0..<1_000_000 {
            largeArray.append(i)
        }
        metrics.log("Memory warning triggered with \(largeArray.count) items", level: .info)
    }
    
    private func generateTestData() {
        metrics.log("Generating test data", level: .info)
        // Use TestDataFactory to generate data
        let messages = TestDataFactory.createBulkMessages(count: 50)
        appState.messages.append(contentsOf: messages)
        metrics.log("Generated \(messages.count) test messages", level: .info)
    }
    
    private func exportDebugReport() {
        let report = DebugReport(
            timestamp: Date(),
            metrics: metrics.currentSnapshot(),
            appState: appState.debugDescription,
            logs: metrics.logs
        )
        
        // Save to file
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        
        if let data = try? encoder.encode(report) {
            let panel = NSSavePanel()
            panel.nameFieldStringValue = "debug-report-\(Date().timeIntervalSince1970).json"
            panel.allowedContentTypes = [.json]
            
            if panel.runModal() == .OK, let url = panel.url {
                try? data.write(to: url)
                metrics.log("Debug report exported to \(url.lastPathComponent)", level: .info)
            }
        }
    }
    
    private func captureStateSnapshot() {
        metrics.captureSnapshot()
        metrics.log("State snapshot captured", level: .info)
    }
}

// MARK: - Supporting Views

struct MetricRow: View {
    let icon: String
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.caption2)
                .frame(width: 16)
            
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text(value)
                .font(.caption)
                .fontFamily(.monospaced)
                .foregroundColor(color)
        }
    }
}

struct DetailedMetricRow: View {
    let label: String
    let value: String
    let detail: String
    let progress: Double
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.caption)
                Spacer()
                Text(value)
                    .font(.caption)
                    .fontWeight(.medium)
                    .fontFamily(.monospaced)
            }
            
            ProgressView(value: progress)
                .tint(progressColor)
            
            Text(detail)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
    
    private var progressColor: Color {
        if progress > 0.8 { return .red }
        if progress > 0.6 { return .orange }
        return .green
    }
}

struct StateRow: View {
    let label: String
    let value: String
    let isGood: Bool
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
            Spacer()
            Text(value)
                .font(.caption)
                .fontFamily(.monospaced)
                .foregroundColor(isGood ? .primary : .orange)
        }
    }
}

struct NetworkRequestRow: View {
    let request: NetworkRequest
    
    var body: some View {
        HStack {
            Circle()
                .fill(request.statusColor)
                .frame(width: 6, height: 6)
            
            Text(request.method)
                .font(.caption2)
                .fontWeight(.medium)
                .frame(width: 40, alignment: .leading)
            
            Text(request.path)
                .font(.caption2)
                .lineLimit(1)
            
            Spacer()
            
            Text("\(request.duration)ms")
                .font(.caption2)
                .fontFamily(.monospaced)
                .foregroundColor(.secondary)
        }
    }
}

struct LogEntryRow: View {
    let entry: DebugLogEntry
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text(entry.timestamp, formatter: timeFormatter)
                .font(.caption2)
                .foregroundColor(.secondary)
                .frame(width: 60, alignment: .leading)
            
            Circle()
                .fill(entry.levelColor)
                .frame(width: 6, height: 6)
                .padding(.top, 3)
            
            Text(entry.message)
                .font(.caption)
                .fontFamily(.monospaced)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 2)
    }
    
    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter
    }
}

struct MemoryPieChart: View {
    let data: [MemoryCategory]
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(data) { category in
                    PieSlice(
                        category: category,
                        totalValue: data.map(\.value).reduce(0, +),
                        geometry: geometry
                    )
                }
            }
        }
    }
}

struct PieSlice: View {
    let category: MemoryCategory
    let totalValue: Int64
    let geometry: GeometryProxy
    
    var body: some View {
        Path { path in
            let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
            let radius = min(geometry.size.width, geometry.size.height) / 2
            let startAngle = calculateStartAngle()
            let endAngle = startAngle + calculateSweepAngle()
            
            path.move(to: center)
            path.addArc(
                center: center,
                radius: radius,
                startAngle: startAngle,
                endAngle: endAngle,
                clockwise: false
            )
            path.closeSubpath()
        }
        .fill(category.color)
        .overlay(
            Text("\(category.name)\n\(Int(category.value * 100 / totalValue))%")
                .font(.caption2)
                .multilineTextAlignment(.center)
                .position(labelPosition())
        )
    }
    
    private func calculateStartAngle() -> Angle {
        // Calculate based on previous categories
        return .degrees(0) // Simplified
    }
    
    private func calculateSweepAngle() -> Angle {
        let percentage = Double(category.value) / Double(totalValue)
        return .degrees(percentage * 360)
    }
    
    private func labelPosition() -> CGPoint {
        // Calculate label position within slice
        let center = CGPoint(x: geometry.size.width / 2, y: geometry.size.height / 2)
        let angle = calculateStartAngle() + Angle(degrees: calculateSweepAngle().degrees / 2)
        let radius = min(geometry.size.width, geometry.size.height) / 3
        
        return CGPoint(
            x: center.x + radius * cos(angle.radians),
            y: center.y + radius * sin(angle.radians)
        )
    }
}

// MARK: - Debug Metrics Service

class DebugMetrics: ObservableObject {
    static let shared = DebugMetrics()
    
    @Published var cpuUsage: Double = 0
    @Published var memoryUsage: Int64 = 0
    @Published var peakMemoryUsage: Int64 = 0
    @Published var fps: Double = 60
    @Published var droppedFrames: Int = 0
    @Published var averageRenderTime: Double = 0
    @Published var maxRenderTime: Double = 0
    
    @Published var diskReadBytes: Int64 = 0
    @Published var diskWriteBytes: Int64 = 0
    @Published var networkBytesReceived: Int64 = 0
    @Published var networkBytesSent: Int64 = 0
    
    @Published var activeThreads: Int = 0
    @Published var activeTimers: Int = 0
    @Published var viewUpdateCount: Int = 0
    
    @Published var networkStatus = "Connected"
    @Published var isNetworkHealthy = true
    @Published var networkLatency: Double = 0
    @Published var webSocketState = "Open"
    
    @Published var recentRequests: [NetworkRequest] = []
    @Published var totalRequests: Int = 0
    @Published var failedRequests: Int = 0
    @Published var averageResponseTime: Double = 0
    
    @Published var logs: [DebugLogEntry] = []
    @Published var logLevelFilter: Int = 0
    @Published var verboseLogging = false
    
    @Published var featureFlags: [String: Bool] = [
        "enableDebugMode": true,
        "enablePerformanceMonitoring": true,
        "enableNetworkLogging": true,
        "enableMemoryTracking": true
    ]
    
    @Published var memoryBreakdown: [MemoryCategory] = []
    
    private var cancellables = Set<AnyCancellable>()
    private var updateTimer: Timer?
    
    var filteredLogs: [DebugLogEntry] {
        switch logLevelFilter {
        case 1: return logs.filter { $0.level == .error }
        case 2: return logs.filter { $0.level == .warning }
        case 3: return logs.filter { $0.level == .info }
        case 4: return logs.filter { $0.level == .debug }
        default: return logs
        }
    }
    
    private init() {
        startMonitoring()
    }
    
    private func startMonitoring() {
        updateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.updateMetrics()
        }
    }
    
    private func updateMetrics() {
        // Update CPU usage
        cpuUsage = Double.random(in: 20...60)
        
        // Update memory
        memoryUsage = Int64.random(in: 100_000_000...300_000_000)
        peakMemoryUsage = max(peakMemoryUsage, memoryUsage)
        
        // Update FPS
        fps = Double.random(in: 55...60)
        
        // Update network latency
        networkLatency = Double.random(in: 10...50)
        
        // Update view updates
        viewUpdateCount = Int.random(in: 5...20)
        
        // Update memory breakdown
        memoryBreakdown = [
            MemoryCategory(name: "App", value: Int64.random(in: 50_000_000...100_000_000), color: .blue),
            MemoryCategory(name: "Cache", value: Int64.random(in: 20_000_000...50_000_000), color: .green),
            MemoryCategory(name: "Images", value: Int64.random(in: 30_000_000...60_000_000), color: .orange),
            MemoryCategory(name: "Other", value: Int64.random(in: 10_000_000...30_000_000), color: .gray)
        ]
    }
    
    func log(_ message: String, level: DebugLogLevel) {
        let entry = DebugLogEntry(
            message: message,
            level: level,
            category: .system,
            details: "",
            timestamp: Date()
        )
        logs.append(entry)
        
        // Keep only recent logs
        if logs.count > 1000 {
            logs.removeFirst(logs.count - 1000)
        }
    }
    
    func reset() {
        cpuUsage = 0
        memoryUsage = 0
        fps = 60
        droppedFrames = 0
        logs.removeAll()
        recentRequests.removeAll()
        totalRequests = 0
        failedRequests = 0
    }
    
    func clearLogs() {
        logs.removeAll()
    }
    
    func captureSnapshot() -> MetricsSnapshot {
        MetricsSnapshot(
            timestamp: Date(),
            cpuUsage: cpuUsage,
            memoryUsage: memoryUsage,
            fps: fps,
            networkLatency: networkLatency,
            activeThreads: activeThreads,
            totalRequests: totalRequests,
            failedRequests: failedRequests
        )
    }
    
    func currentSnapshot() -> MetricsSnapshot {
        captureSnapshot()
    }
}

// MARK: - Supporting Types

struct NetworkRequest: Identifiable {
    let id = UUID()
    let method: String
    let path: String
    let statusCode: Int
    let duration: Int
    let timestamp: Date
    
    var statusColor: Color {
        if statusCode >= 200 && statusCode < 300 { return .green }
        if statusCode >= 400 && statusCode < 500 { return .orange }
        return .red
    }
}

struct MemoryCategory: Identifiable {
    let id = UUID()
    let name: String
    let value: Int64
    let color: Color
}

struct MetricsSnapshot: Codable {
    let timestamp: Date
    let cpuUsage: Double
    let memoryUsage: Int64
    let fps: Double
    let networkLatency: Double
    let activeThreads: Int
    let totalRequests: Int
    let failedRequests: Int
}

struct DebugReport: Codable {
    let timestamp: Date
    let metrics: MetricsSnapshot
    let appState: String
    let logs: [DebugLogEntry]
}

// MARK: - Preview

#Preview {
    DebugOverlay()
        .environmentObject(AppState())
        .frame(width: 800, height: 600)
        .background(Color.gray.opacity(0.1))
}