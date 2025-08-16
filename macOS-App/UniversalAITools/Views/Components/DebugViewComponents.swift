import SwiftUI
import Combine

// MARK: - Log List View
struct LogListView: View {
    let logs: [LogEntry]
    let searchText: String
    let autoScroll: Bool
    
    @State private var selectedLog: LogEntry?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Time")
                    .frame(width: 80, alignment: .leading)
                Text("Level")
                    .frame(width: 60, alignment: .leading)
                Text("Category")
                    .frame(width: 80, alignment: .leading)
                Text("Message")
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("File")
                    .frame(width: 100, alignment: .leading)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))
            .font(.caption)
            .foregroundColor(.secondary)
            
            Divider()
            
            // Log entries
            ScrollViewReader { proxy in
                List(logs, id: \.id, selection: $selectedLog) { log in
                    LogRowView(log: log, searchText: searchText)
                        .id(log.id)
                }
                .listStyle(PlainListStyle())
                .onChange(of: logs.count) { _ in
                    if autoScroll, let lastLog = logs.first {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            proxy.scrollTo(lastLog.id, anchor: .top)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Log Row View
struct LogRowView: View {
    let log: LogEntry
    let searchText: String
    
    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        formatter.dateStyle = .none
        return formatter
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Timestamp
            Text(timeFormatter.string(from: log.timestamp))
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.secondary)
                .frame(width: 80, alignment: .leading)
            
            // Level
            HStack(spacing: 4) {
                Text(log.level.emoji)
                    .font(.caption)
                Text(log.level.description)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .frame(width: 60, alignment: .leading)
            .foregroundColor(levelColor(for: log.level))
            
            // Category
            Text(log.category.rawValue)
                .font(.caption)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(categoryColor(for: log.category).opacity(0.2))
                .cornerRadius(4)
                .frame(width: 80, alignment: .leading)
            
            // Message
            VStack(alignment: .leading, spacing: 2) {
                highlightedText(log.message, searchText: searchText)
                    .font(.system(.caption, design: .monospaced))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                
                if !log.metadata.isEmpty {
                    Text("Metadata: \(log.metadata.map { "\($0.key)=\($0.value)" }.joined(separator: ", "))")
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // File info
            VStack(alignment: .trailing, spacing: 2) {
                Text(log.file)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text(":\(log.line)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(width: 100, alignment: .trailing)
        }
        .padding(.vertical, 4)
        .background(backgroundColorForLevel(log.level))
    }
    
    private func levelColor(for level: LogLevel) -> Color {
        switch level {
        case .debug: return .blue
        case .info: return .primary
        case .warning: return .orange
        case .error: return .red
        case .critical: return .purple
        }
    }
    
    private func categoryColor(for category: LogCategory) -> Color {
        switch category {
        case .app: return .blue
        case .network: return .green
        case .errors: return .red
        case .performance: return .orange
        case .security: return .purple
        case .monitoring: return .cyan
        default: return .gray
        }
    }
    
    private func backgroundColorForLevel(_ level: LogLevel) -> Color {
        switch level {
        case .error, .critical:
            return Color.red.opacity(0.05)
        case .warning:
            return Color.orange.opacity(0.05)
        default:
            return Color.clear
        }
    }
    
    private func highlightedText(_ text: String, searchText: String) -> Text {
        guard !searchText.isEmpty else {
            return Text(text)
        }
        
        let parts = text.components(separatedBy: searchText)
        var result = Text("")
        
        for (index, part) in parts.enumerated() {
            result = result + Text(part)
            if index < parts.count - 1 {
                result = result + Text(searchText).bold().foregroundColor(.yellow)
            }
        }
        
        return result
    }
}

// MARK: - Health Status Overview
struct HealthStatusOverview: View {
    let currentHealth: HealthStatus
    let healthCheckResults: [HealthCheckResult]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("System Health")
                    .font(.headline)
                
                Spacer()
                
                HStack(spacing: 8) {
                    Circle()
                        .fill(currentHealth.color)
                        .frame(width: 12, height: 12)
                    
                    Text(currentHealth.rawValue.capitalized)
                        .fontWeight(.medium)
                        .foregroundColor(currentHealth.color)
                }
            }
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(healthCheckResults, id: \.name) { result in
                    HealthCheckCard(result: result)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Health Check Card
struct HealthCheckCard: View {
    let result: HealthCheckResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: result.status.icon)
                    .foregroundColor(result.status.color)
                
                Text(result.name)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Spacer()
            }
            
            Text(result.message)
                .font(.caption2)
                .foregroundColor(.secondary)
                .lineLimit(2)
            
            HStack {
                Text("\(String(format: "%.3f", result.duration))s")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text(result.category)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(4)
            }
        }
        .padding(8)
        .background(Color.white.opacity(0.5))
        .cornerRadius(6)
    }
}

// MARK: - Performance Metrics View
struct PerformanceMetricsView: View {
    let metrics: PerformanceMetrics
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Performance Metrics")
                .font(.headline)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                MetricCard(
                    title: "CPU Usage",
                    value: "\(String(format: "%.1f", metrics.cpuUsage))%",
                    icon: "cpu",
                    color: metrics.cpuUsage > 80 ? .red : .blue
                )
                
                MetricCard(
                    title: "Memory Usage",
                    value: "\(String(format: "%.1f", metrics.memoryUsage))%",
                    icon: "memorychip",
                    color: metrics.memoryUsage > 85 ? .red : .green
                )
                
                MetricCard(
                    title: "Disk Usage",
                    value: "\(String(format: "%.1f", metrics.diskSpace.usagePercentage))%",
                    icon: "internaldrive",
                    color: metrics.diskSpace.usagePercentage > 90 ? .red : .orange
                )
                
                MetricCard(
                    title: "Thermal State",
                    value: metrics.thermalState.rawValue.capitalized,
                    icon: "thermometer",
                    color: thermalStateColor(metrics.thermalState)
                )
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
    
    private func thermalStateColor(_ state: PerformanceMetrics.ThermalState) -> Color {
        switch state {
        case .nominal: return .green
        case .fair: return .yellow
        case .serious: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - Metric Card
struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Connection Health View
struct ConnectionHealthView: View {
    let connectionHealth: ConnectionHealth
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connection Health")
                .font(.headline)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ConnectionStatusCard(
                    title: "Backend",
                    status: connectionHealth.backendStatus
                )
                
                ConnectionStatusCard(
                    title: "WebSocket",
                    status: connectionHealth.websocketStatus
                )
                
                ConnectionStatusCard(
                    title: "Local LLM",
                    status: connectionHealth.localLLMStatus
                )
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Connection Status Card
struct ConnectionStatusCard: View {
    let title: String
    let status: ConnectionHealth.ConnectionStatus
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle()
                    .fill(status.isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            
            if let latency = status.latency {
                Text("Latency: \(String(format: "%.0f", latency * 1000))ms")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            if let error = status.lastError {
                Text("Error: \(error)")
                    .font(.caption2)
                    .foregroundColor(.red)
                    .lineLimit(2)
            }
            
            if status.reconnectionCount > 0 {
                Text("Reconnections: \(status.reconnectionCount)")
                    .font(.caption2)
                    .foregroundColor(.orange)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(Color.white.opacity(0.5))
        .cornerRadius(6)
    }
}

// MARK: - Alerts List View
struct AlertsListView: View {
    let alerts: [MonitoringAlert]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Active Alerts")
                    .font(.headline)
                
                Spacer()
                
                Text("\(alerts.count) alerts")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if alerts.isEmpty {
                Text("No active alerts")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(alerts.prefix(5), id: \.id) { alert in
                    AlertRowView(alert: alert)
                }
                
                if alerts.count > 5 {
                    Text("... and \(alerts.count - 5) more")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Alert Row View
struct AlertRowView: View {
    let alert: MonitoringAlert
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(alert.severity.color)
                .frame(width: 8, height: 8)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.title)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(alert.message)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Text(timeAgo(from: alert.timestamp))
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
    
    private func timeAgo(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "\(Int(interval))s ago"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else {
            return "\(Int(interval / 3600))h ago"
        }
    }
}

// MARK: - Analytics Snapshot View
struct AnalyticsSnapshotView: View {
    let snapshot: AnalyticsSnapshot
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Analytics Snapshot")
                .font(.headline)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                AnalyticsCard(
                    title: "Session Duration",
                    value: formatDuration(snapshot.sessionDuration),
                    icon: "clock"
                )
                
                AnalyticsCard(
                    title: "Total Events",
                    value: "\(snapshot.eventCounts.values.reduce(0, +))",
                    icon: "chart.bar"
                )
                
                AnalyticsCard(
                    title: "Features Used",
                    value: "\(snapshot.featureUsage.count)",
                    icon: "star"
                )
            }
            
            // Most used features
            if !snapshot.mostUsedFeatures.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Most Used Features")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    ForEach(snapshot.mostUsedFeatures.prefix(5), id: \.self) { feature in
                        HStack {
                            Text(feature)
                                .font(.caption)
                            
                            Spacer()
                            
                            if let usage = snapshot.featureUsage[feature] {
                                Text("\(usage.usageCount) times")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        let hours = Int(duration) / 3600
        let minutes = (Int(duration) % 3600) / 60
        
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}

// MARK: - Analytics Card
struct AnalyticsCard: View {
    let title: String
    let value: String
    let icon: String
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.blue.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Change Events List View
struct ChangeEventsListView: View {
    let events: [ChangeEvent]
    let timeRange: TimeRange
    
    private var filteredEvents: [ChangeEvent] {
        if timeRange == .all {
            return events
        }
        
        let cutoffDate = Date().addingTimeInterval(-timeRange.timeInterval)
        return events.filter { $0.timestamp >= cutoffDate }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Changes")
                    .font(.headline)
                
                Spacer()
                
                Text("\(filteredEvents.count) events")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if filteredEvents.isEmpty {
                Text("No events in the selected time range")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(filteredEvents.prefix(10), id: \.id) { event in
                    ChangeEventRowView(event: event)
                }
                
                if filteredEvents.count > 10 {
                    Text("... and \(filteredEvents.count - 10) more")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Change Event Row View
struct ChangeEventRowView: View {
    let event: ChangeEvent
    
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(event.type.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text(event.source)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.2))
                        .cornerRadius(4)
                }
                
                Text(event.action)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                if let newValue = event.newValue {
                    Text("Value: \(newValue)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            Text(timeAgo(from: event.timestamp))
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
    
    private func timeAgo(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "\(Int(interval))s ago"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else {
            return "\(Int(interval / 3600))h ago"
        }
    }
}

// MARK: - Pattern Detection View
struct PatternDetectionView: View {
    let patterns: [ChangePattern]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Detected Patterns")
                .font(.headline)
            
            if patterns.isEmpty {
                Text("No patterns detected")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(patterns, id: \.name) { pattern in
                    PatternCard(pattern: pattern)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Pattern Card
struct PatternCard: View {
    let pattern: ChangePattern
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(pattern.name)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Spacer()
                
                Text("Confidence: \(String(format: "%.0f", pattern.confidence * 100))%")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Text(pattern.description)
                .font(.caption2)
                .foregroundColor(.secondary)
            
            HStack {
                Text("Occurrences: \(pattern.occurrenceCount)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if let lastDetected = pattern.lastDetected {
                    Text("Last: \(timeAgo(from: lastDetected))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(8)
        .background(Color.orange.opacity(0.1))
        .cornerRadius(6)
    }
    
    private func timeAgo(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "\(Int(interval))s ago"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else {
            return "\(Int(interval / 3600))h ago"
        }
    }
}

// MARK: - Export Option Card
struct ExportOptionCard: View {
    let title: String
    let description: String
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.largeTitle)
                    .foregroundColor(.blue)
                
                Text(title)
                    .font(.headline)
                    .fontWeight(.medium)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Failure Predictions View
struct FailurePredictionsView: View {
    let predictions: [FailurePrediction]
    let onDismiss: (FailurePrediction) -> Void
    let onManualRecovery: (FailurePrediction) -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Failure Predictions")
                    .font(.headline)
                
                Spacer()
                
                Text("\(predictions.count) active")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            if predictions.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.shield")
                        .font(.title)
                        .foregroundColor(.green)
                    
                    Text("No failure predictions")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text("System is operating normally")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding()
            } else {
                ForEach(predictions, id: \.id) { prediction in
                    FailurePredictionCard(
                        prediction: prediction,
                        onDismiss: { onDismiss(prediction) },
                        onManualRecovery: { onManualRecovery(prediction) }
                    )
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Failure Prediction Card
struct FailurePredictionCard: View {
    let prediction: FailurePrediction
    let onDismiss: () -> Void
    let onManualRecovery: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(prediction.failureType.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(prediction.failureType.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    HStack {
                        Circle()
                            .fill(prediction.severity.color)
                            .frame(width: 8, height: 8)
                        
                        Text(prediction.severity.rawValue.capitalized)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    
                    Text("\(String(format: "%.0f", prediction.confidence * 100))% confidence")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            if !prediction.indicators.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Indicators:")
                        .font(.caption)
                        .fontWeight(.medium)
                    
                    ForEach(prediction.indicators, id: \.self) { indicator in
                        HStack {
                            Circle()
                                .fill(Color.orange)
                                .frame(width: 4, height: 4)
                            
                            Text(indicator)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            
            if !prediction.recommendedActions.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recommended Actions:")
                        .font(.caption)
                        .fontWeight(.medium)
                    
                    ForEach(prediction.recommendedActions, id: \.self) { action in
                        HStack {
                            Image(systemName: "arrow.right")
                                .font(.caption2)
                                .foregroundColor(.blue)
                            
                            Text(action)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            
            if let timeToFailure = prediction.timeToFailure {
                HStack {
                    Image(systemName: "clock")
                        .foregroundColor(.orange)
                    
                    Text("Estimated time to failure: \(formatTimeInterval(timeToFailure))")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.orange)
                }
                .padding(.top, 4)
            }
            
            HStack {
                Button("Dismiss") {
                    onDismiss()
                }
                .buttonStyle(.bordered)
                
                Spacer()
                
                Button("Manual Recovery") {
                    onManualRecovery()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(prediction.severity.color.opacity(0.1))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(prediction.severity.color, lineWidth: 1)
        )
    }
    
    private func formatTimeInterval(_ interval: TimeInterval) -> String {
        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60
        
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else if minutes > 0 {
            return "\(minutes)m"
        } else {
            return "<1m"
        }
    }
}

struct HealthTrendsView: View {
    let trends: [HealthTrend]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Health Trends")
                .font(.headline)
            
            if trends.isEmpty {
                Text("No trend data available")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 12) {
                    ForEach(trends, id: \.metric) { trend in
                        HealthTrendCard(trend: trend)
                    }
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Health Trend Card
struct HealthTrendCard: View {
    let trend: HealthTrend
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(trend.metric.capitalized)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Spacer()
                
                Image(systemName: trendIcon)
                    .foregroundColor(trendColor)
            }
            
            if let latestValue = trend.values.last {
                Text("\(String(format: "%.1f", latestValue.value))%")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(trendColor)
            }
            
            HStack {
                Circle()
                    .fill(trend.severity.color)
                    .frame(width: 6, height: 6)
                
                Text(trend.trend.rawValue.capitalized)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            if let prediction = trend.prediction {
                Text(prediction)
                    .font(.caption2)
                    .foregroundColor(.orange)
                    .lineLimit(2)
            }
        }
        .padding()
        .background(trend.severity.color.opacity(0.1))
        .cornerRadius(6)
    }
    
    private var trendIcon: String {
        switch trend.trend {
        case .improving: return "arrow.up.right"
        case .stable: return "arrow.right"
        case .degrading: return "arrow.down.right"
        case .critical: return "exclamationmark.triangle"
        }
    }
    
    private var trendColor: Color {
        switch trend.trend {
        case .improving: return .green
        case .stable: return .blue
        case .degrading: return .orange
        case .critical: return .red
        }
    }
}

struct FailurePreventionStatsView: View {
    let preventedFailures: Int
    let automaticRecoveries: Int
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Failure Prevention Statistics")
                .font(.headline)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                StatCard(
                    title: "Prevented Failures",
                    value: "\(preventedFailures)",
                    icon: "shield.checkered",
                    color: .green
                )
                
                StatCard(
                    title: "Auto Recoveries",
                    value: "\(automaticRecoveries)",
                    icon: "arrow.clockwise",
                    color: .blue
                )
                
                StatCard(
                    title: "Success Rate",
                    value: successRate,
                    icon: "percent",
                    color: .purple
                )
            }
            
            if preventedFailures > 0 || automaticRecoveries > 0 {
                VStack(alignment: .leading, spacing: 8) {
                    Text("System Reliability")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    HStack {
                        Text("Total interventions: \(preventedFailures + automaticRecoveries)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text("System protected")
                            .font(.caption)
                            .foregroundColor(.green)
                            .fontWeight(.medium)
                    }
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
    
    private var successRate: String {
        let total = preventedFailures + automaticRecoveries
        if total == 0 {
            return "N/A"
        }
        
        // Assume all interventions were successful for now
        return "100%"
    }
}

// MARK: - Stat Card
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct PerformanceChartsView: View {
    @StateObject private var monitoringService = MonitoringService.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Real-time Performance")
                .font(.headline)
            
            if let metrics = monitoringService.performanceMetrics {
                VStack(spacing: 16) {
                    // CPU and Memory Chart Placeholder
                    VStack(alignment: .leading, spacing: 8) {
                        Text("System Resources")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        HStack(spacing: 16) {
                            ProgressView("CPU", value: metrics.cpuUsage / 100)
                                .progressViewStyle(LinearProgressViewStyle(tint: .blue))
                            
                            ProgressView("Memory", value: metrics.memoryUsage / 100)
                                .progressViewStyle(LinearProgressViewStyle(tint: .green))
                        }
                        
                        HStack {
                            Text("CPU: \(String(format: "%.1f", metrics.cpuUsage))%")
                                .font(.caption)
                            
                            Spacer()
                            
                            Text("Memory: \(String(format: "%.1f", metrics.memoryUsage))%")
                                .font(.caption)
                        }
                        .foregroundColor(.secondary)
                    }
                    
                    // Disk Usage
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Storage")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        ProgressView("Disk", value: metrics.diskSpace.usagePercentage / 100)
                            .progressViewStyle(LinearProgressViewStyle(tint: .orange))
                        
                        HStack {
                            Text("Used: \(formatBytes(metrics.diskSpace.used))")
                                .font(.caption)
                            
                            Spacer()
                            
                            Text("Available: \(formatBytes(metrics.diskSpace.available))")
                                .font(.caption)
                        }
                        .foregroundColor(.secondary)
                    }
                }
            } else {
                Text("No performance data available")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
    
    private func formatBytes(_ bytes: UInt64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useGB, .useMB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

struct MemoryUsageDetailView: View {
    @StateObject private var monitoringService = MonitoringService.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Memory Usage Details")
                .font(.headline)
            
            if let metrics = monitoringService.performanceMetrics {
                VStack(spacing: 12) {
                    // Memory Overview
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Memory Pressure")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Spacer()
                            
                            Text(metrics.memoryPressure.level.capitalized)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(memoryPressureColor(metrics.memoryPressure.level).opacity(0.2))
                                .cornerRadius(4)
                        }
                        
                        ProgressView(value: Double(metrics.memoryPressure.usedMemory) / Double(metrics.memoryPressure.totalMemory))
                            .progressViewStyle(LinearProgressViewStyle(tint: memoryPressureColor(metrics.memoryPressure.level)))
                    }
                    
                    // Memory Breakdown
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 12) {
                        MemoryDetailCard(
                            title: "Used Memory",
                            value: formatBytes(metrics.memoryPressure.usedMemory),
                            icon: "memorychip.fill",
                            color: .red
                        )
                        
                        MemoryDetailCard(
                            title: "Available Memory",
                            value: formatBytes(metrics.memoryPressure.availableMemory),
                            icon: "memorychip",
                            color: .green
                        )
                        
                        MemoryDetailCard(
                            title: "Total Memory",
                            value: formatBytes(metrics.memoryPressure.totalMemory),
                            icon: "server.rack",
                            color: .blue
                        )
                        
                        MemoryDetailCard(
                            title: "Swap Used",
                            value: formatBytes(metrics.memoryPressure.swapUsed),
                            icon: "arrow.left.arrow.right",
                            color: .orange
                        )
                    }
                    
                    // Memory Usage Percentage
                    HStack {
                        Text("Memory Usage: \(String(format: "%.1f", metrics.memoryUsage))%")
                            .font(.caption)
                            .fontWeight(.medium)
                        
                        Spacer()
                        
                        if metrics.memoryUsage > 85 {
                            HStack {
                                Image(systemName: "exclamationmark.triangle")
                                Text("High Usage")
                            }
                            .font(.caption)
                            .foregroundColor(.red)
                        }
                    }
                }
            } else {
                Text("No memory data available")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
    
    private func memoryPressureColor(_ level: String) -> Color {
        switch level.lowercased() {
        case "normal": return .green
        case "warn", "warning": return .orange
        case "urgent", "critical": return .red
        default: return .blue
        }
    }
    
    private func formatBytes(_ bytes: UInt64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useGB, .useMB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

// MARK: - Memory Detail Card
struct MemoryDetailCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
            
            Text(value)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(color.opacity(0.1))
        .cornerRadius(6)
    }
}

struct NetworkPerformanceView: View {
    @StateObject private var monitoringService = MonitoringService.shared
    @StateObject private var backendIntegration = BackendMonitoringIntegration.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Network Performance")
                .font(.headline)
            
            VStack(spacing: 12) {
                // Connection Status
                VStack(alignment: .leading, spacing: 8) {
                    Text("Backend Connection")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    HStack {
                        Circle()
                            .fill(backendIntegration.isConnected ? .green : .red)
                            .frame(width: 12, height: 12)
                        
                        Text(backendIntegration.isConnected ? "Connected" : "Disconnected")
                            .font(.caption)
                            .fontWeight(.medium)
                        
                        Spacer()
                        
                        Text(backendIntegration.syncStatus.rawValue.capitalized)
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(syncStatusColor.opacity(0.2))
                            .cornerRadius(4)
                    }
                    
                    if let lastSync = backendIntegration.lastSyncTime {
                        Text("Last sync: \(formatLastSync(lastSync))")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                
                // Network Statistics
                if let metrics = monitoringService.performanceMetrics {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Network Statistics")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 12) {
                            NetworkStatCard(
                                title: "Bytes Sent",
                                value: formatBytes(metrics.networkStats.bytesSent),
                                icon: "arrow.up",
                                color: .blue
                            )
                            
                            NetworkStatCard(
                                title: "Bytes Received",
                                value: formatBytes(metrics.networkStats.bytesReceived),
                                icon: "arrow.down",
                                color: .green
                            )
                            
                            NetworkStatCard(
                                title: "Packets Sent",
                                value: "\(metrics.networkStats.packetsSent)",
                                icon: "paperplane",
                                color: .orange
                            )
                            
                            NetworkStatCard(
                                title: "Packets Received",
                                value: "\(metrics.networkStats.packetsReceived)",
                                icon: "tray.and.arrow.down",
                                color: .purple
                            )
                        }
                        
                        if let latency = metrics.networkStats.latency {
                            HStack {
                                Image(systemName: "speedometer")
                                    .foregroundColor(.blue)
                                
                                Text("Latency: \(String(format: "%.0f", latency * 1000))ms")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                
                                Spacer()
                                
                                if latency > 1.0 {
                                    HStack {
                                        Image(systemName: "exclamationmark.triangle")
                                        Text("High Latency")
                                    }
                                    .font(.caption)
                                    .foregroundColor(.orange)
                                }
                            }
                        }
                    }
                }
                
                // Endpoint Health
                if !backendIntegration.endpointHealth.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Endpoint Health")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        ForEach(Array(backendIntegration.endpointHealth.keys), id: \.self) { endpoint in
                            if let health = backendIntegration.endpointHealth[endpoint] {
                                EndpointHealthRow(endpoint: endpoint, health: health)
                            }
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
    
    private var syncStatusColor: Color {
        switch backendIntegration.syncStatus {
        case .connected: return .green
        case .syncing: return .blue
        case .error: return .red
        case .disconnected: return .gray
        default: return .orange
        }
    }
    
    private func formatLastSync(_ date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "\(Int(interval))s ago"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else {
            return "\(Int(interval / 3600))h ago"
        }
    }
    
    private func formatBytes(_ bytes: UInt64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

// MARK: - Network Stat Card
struct NetworkStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
            
            Text(value)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(color.opacity(0.1))
        .cornerRadius(6)
    }
}

// MARK: - Endpoint Health Row
struct EndpointHealthRow: View {
    let endpoint: String
    let health: EndpointHealth
    
    var body: some View {
        HStack {
            Circle()
                .fill(health.isHealthy ? .green : .red)
                .frame(width: 8, height: 8)
            
            Text(endpoint)
                .font(.caption)
                .fontWeight(.medium)
            
            Spacer()
            
            if health.responseTime > 0 {
                Text("\(String(format: "%.0f", health.responseTime * 1000))ms")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            if health.errorCount > 0 {
                Text("\(health.errorCount) errors")
                    .font(.caption2)
                    .foregroundColor(.red)
            }
        }
        .padding(.vertical, 2)
    }
}

struct CPUUsageDetailView: View {
    @StateObject private var monitoringService = MonitoringService.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("CPU Usage Details")
                .font(.headline)
            
            if let metrics = monitoringService.performanceMetrics {
                VStack(spacing: 12) {
                    // CPU Overview
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("CPU Usage")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Spacer()
                            
                            Text("\(String(format: "%.1f", metrics.cpuUsage))%")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(cpuUsageColor(metrics.cpuUsage))
                        }
                        
                        ProgressView(value: metrics.cpuUsage / 100)
                            .progressViewStyle(LinearProgressViewStyle(tint: cpuUsageColor(metrics.cpuUsage)))
                    }
                    
                    // Thermal State
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Thermal State")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        HStack {
                            Image(systemName: "thermometer")
                                .foregroundColor(thermalStateColor(metrics.thermalState))
                            
                            Text(metrics.thermalState.rawValue.capitalized)
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(thermalStateColor(metrics.thermalState))
                            
                            Spacer()
                            
                            if metrics.thermalState != .nominal {
                                HStack {
                                    Image(systemName: "exclamationmark.triangle")
                                    Text(thermalWarningText(metrics.thermalState))
                                }
                                .font(.caption)
                                .foregroundColor(.orange)
                            }
                        }
                    }
                    
                    // CPU Information
                    VStack(alignment: .leading, spacing: 8) {
                        Text("System Information")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 12) {
                            CPUInfoCard(
                                title: "Processor",
                                value: getProcessorInfo(),
                                icon: "cpu"
                            )
                            
                            CPUInfoCard(
                                title: "Architecture",
                                value: getArchitectureInfo(),
                                icon: "memorychip"
                            )
                            
                            CPUInfoCard(
                                title: "Core Count",
                                value: "\(ProcessInfo.processInfo.processorCount)",
                                icon: "circle.grid.2x2"
                            )
                            
                            CPUInfoCard(
                                title: "Power State",
                                value: metrics.powerSourceState.rawValue.replacingOccurrences(of: "_", with: " ").capitalized,
                                icon: powerSourceIcon(metrics.powerSourceState)
                            )
                        }
                    }
                    
                    // Battery Information (if available)
                    if let batteryLevel = metrics.batteryLevel {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Battery")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            HStack {
                                Image(systemName: batteryIcon(batteryLevel))
                                    .foregroundColor(batteryColor(batteryLevel))
                                
                                Text("\(String(format: "%.0f", batteryLevel * 100))%")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                
                                Spacer()
                                
                                if batteryLevel < 0.2 {
                                    Text("Low Battery")
                                        .font(.caption)
                                        .foregroundColor(.red)
                                }
                            }
                            
                            ProgressView(value: batteryLevel)
                                .progressViewStyle(LinearProgressViewStyle(tint: batteryColor(batteryLevel)))
                        }
                    }
                }
            } else {
                Text("No CPU data available")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
    
    private func cpuUsageColor(_ usage: Double) -> Color {
        if usage > 90 {
            return .red
        } else if usage > 70 {
            return .orange
        } else {
            return .blue
        }
    }
    
    private func thermalStateColor(_ state: PerformanceMetrics.ThermalState) -> Color {
        switch state {
        case .nominal: return .green
        case .fair: return .yellow
        case .serious: return .orange
        case .critical: return .red
        }
    }
    
    private func thermalWarningText(_ state: PerformanceMetrics.ThermalState) -> String {
        switch state {
        case .fair: return "Warm"
        case .serious: return "Hot"
        case .critical: return "Overheating"
        default: return ""
        }
    }
    
    private func powerSourceIcon(_ state: PerformanceMetrics.PowerSourceState) -> String {
        switch state {
        case .battery: return "battery.100"
        case .acPower: return "bolt"
        case .unknown: return "questionmark"
        }
    }
    
    private func batteryIcon(_ level: Double) -> String {
        if level > 0.75 {
            return "battery.100"
        } else if level > 0.5 {
            return "battery.75"
        } else if level > 0.25 {
            return "battery.25"
        } else {
            return "battery.0"
        }
    }
    
    private func batteryColor(_ level: Double) -> Color {
        if level > 0.5 {
            return .green
        } else if level > 0.2 {
            return .orange
        } else {
            return .red
        }
    }
    
    private func getProcessorInfo() -> String {
        return ProcessInfo.processInfo.machineHardwareName ?? "Unknown"
    }
    
    private func getArchitectureInfo() -> String {
        #if arch(arm64)
        return "Apple Silicon"
        #elseif arch(x86_64)
        return "Intel x86_64"
        #else
        return "Unknown"
        #endif
    }
}

// MARK: - CPU Info Card
struct CPUInfoCard: View {
    let title: String
    let value: String
    let icon: String
    
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.blue)
            
            Text(value)
                .font(.caption)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)
                .lineLimit(2)
            
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(Color.blue.opacity(0.1))
        .cornerRadius(6)
    }
}

// Extension to get machine hardware name
extension ProcessInfo {
    var machineHardwareName: String? {
        var size = 0
        sysctlbyname("hw.model", nil, &size, nil, 0)
        var model = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.model", &model, &size, nil, 0)
        return String(cString: model)
    }
}

struct LogExportSheet: View {
    let loggingService: LoggingService
    let changeTracker: ChangeTracker
    
    @State private var exportType: ExportType = .logs
    @State private var exportFormat: ExportFormat = .text
    @State private var timeRange: ExportTimeRange = .lastHour
    @State private var isExporting = false
    @Environment(\.presentationMode) var presentationMode
    
    enum ExportType: String, CaseIterable {
        case logs = "Logs"
        case analytics = "Analytics"
        case monitoring = "Monitoring"
        case full = "Full Report"
    }
    
    enum ExportFormat: String, CaseIterable {
        case text = "Text (.txt)"
        case json = "JSON (.json)"
        case csv = "CSV (.csv)"
    }
    
    enum ExportTimeRange: String, CaseIterable {
        case lastHour = "Last Hour"
        case last24Hours = "Last 24 Hours"
        case lastWeek = "Last Week"
        case all = "All Time"
        
        var timeInterval: TimeInterval? {
            switch self {
            case .lastHour: return 3600
            case .last24Hours: return 86400
            case .lastWeek: return 604800
            case .all: return nil
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Export Debug Data")
                .font(.title2)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 16) {
                // Export Type
                VStack(alignment: .leading, spacing: 8) {
                    Text("Export Type")
                        .font(.headline)
                    
                    Picker("Export Type", selection: $exportType) {
                        ForEach(ExportType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                // Export Format
                VStack(alignment: .leading, spacing: 8) {
                    Text("Format")
                        .font(.headline)
                    
                    Picker("Format", selection: $exportFormat) {
                        ForEach(ExportFormat.allCases, id: \.self) { format in
                            Text(format.rawValue).tag(format)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                }
                
                // Time Range
                VStack(alignment: .leading, spacing: 8) {
                    Text("Time Range")
                        .font(.headline)
                    
                    Picker("Time Range", selection: $timeRange) {
                        ForEach(ExportTimeRange.allCases, id: \.self) { range in
                            Text(range.rawValue).tag(range)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                }
            }
            
            Spacer()
            
            HStack {
                Button("Cancel") {
                    presentationMode.wrappedValue.dismiss()
                }
                .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button("Export") {
                    exportData()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(isExporting)
            }
        }
        .padding()
        .frame(width: 400, height: 300)
    }
    
    private func exportData() {
        isExporting = true
        
        Task {
            let data = await generateExportData()
            let fileName = generateFileName()
            
            DispatchQueue.main.async {
                self.isExporting = false
                self.showSavePanel(for: data, fileName: fileName)
                self.presentationMode.wrappedValue.dismiss()
            }
        }
    }
    
    private func generateExportData() async -> Data? {
        switch exportType {
        case .logs:
            return await loggingService.exportLogs()
        case .analytics:
            return await changeTracker.exportData()
        case .monitoring:
            let report = MonitoringService.shared.healthCheckResults.map { $0.description }.joined(separator: "\n")
            return report.data(using: .utf8)
        case .full:
            // Combine all data sources
            let logs = await loggingService.exportLogs()
            let analytics = await changeTracker.exportData()
            
            let fullReport = """
            Universal AI Tools - Full Debug Report
            ====================================
            Generated: \(Date())
            
            LOGS:
            \(logs != nil ? String(data: logs!, encoding: .utf8) ?? "Unable to export logs" : "No logs available")
            
            ANALYTICS:
            \(analytics != nil ? String(data: analytics!, encoding: .utf8) ?? "Unable to export analytics" : "No analytics available")
            """
            
            return fullReport.data(using: .utf8)
        }
    }
    
    private func generateFileName() -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        let timestamp = dateFormatter.string(from: Date())
        
        let baseName = "\(exportType.rawValue.lowercased().replacingOccurrences(of: " ", with: "-"))-\(timestamp)"
        
        switch exportFormat {
        case .text:
            return "\(baseName).txt"
        case .json:
            return "\(baseName).json"
        case .csv:
            return "\(baseName).csv"
        }
    }
    
    private func showSavePanel(for data: Data?, fileName: String) {
        guard let data = data else { return }
        
        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.plainText, .json]
        savePanel.nameFieldStringValue = fileName
        
        savePanel.begin { result in
            if result == .OK, let url = savePanel.url {
                do {
                    try data.write(to: url)
                    LoggingService.shared.info("Exported debug data to: \(url.path)", category: .monitoring)
                } catch {
                    LoggingService.shared.error("Failed to export debug data: \(error.localizedDescription)", category: .monitoring)
                }
            }
        }
    }
}

struct DebugSettingsSheet: View {
    let loggingService: LoggingService
    let monitoringService: MonitoringService
    let changeTracker: ChangeTracker
    let failurePreventionService: FailurePreventionService
    
    @State private var loggingEnabled: Bool
    @State private var minimumLogLevel: LogLevel
    @State private var monitoringEnabled: Bool
    @State private var changeTrackingEnabled: Bool
    @State private var failurePreventionEnabled: Bool
    @State private var automaticRecoveryEnabled: Bool
    @State private var remoteLoggingEnabled: Bool
    
    @Environment(\.presentationMode) var presentationMode
    
    init(
        loggingService: LoggingService,
        monitoringService: MonitoringService,
        changeTracker: ChangeTracker,
        failurePreventionService: FailurePreventionService
    ) {
        self.loggingService = loggingService
        self.monitoringService = monitoringService
        self.changeTracker = changeTracker
        self.failurePreventionService = failurePreventionService
        
        // Initialize state from current settings
        self._loggingEnabled = State(initialValue: loggingService.isEnabled)
        self._minimumLogLevel = State(initialValue: loggingService.minimumLevel)
        self._monitoringEnabled = State(initialValue: monitoringService.isEnabled)
        self._changeTrackingEnabled = State(initialValue: changeTracker.isEnabled)
        self._failurePreventionEnabled = State(initialValue: failurePreventionService.isEnabled)
        self._automaticRecoveryEnabled = State(initialValue: failurePreventionService.automaticRecoveryEnabled)
        self._remoteLoggingEnabled = State(initialValue: loggingService.remoteStreamer.isConnected)
    }
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Debug Settings")
                .font(.title2)
                .fontWeight(.semibold)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Logging Settings
                    SettingsSection(title: "Logging") {
                        VStack(alignment: .leading, spacing: 12) {
                            Toggle("Enable Logging", isOn: $loggingEnabled)
                            
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Minimum Log Level")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                Picker("Log Level", selection: $minimumLogLevel) {
                                    ForEach(LogLevel.allCases, id: \.self) { level in
                                        Text(level.description).tag(level)
                                    }
                                }
                                .pickerStyle(MenuPickerStyle())
                                .disabled(!loggingEnabled)
                            }
                            
                            Toggle("Remote Logging", isOn: $remoteLoggingEnabled)
                                .disabled(!loggingEnabled)
                        }
                    }
                    
                    // Monitoring Settings
                    SettingsSection(title: "Monitoring") {
                        VStack(alignment: .leading, spacing: 12) {
                            Toggle("Enable System Monitoring", isOn: $monitoringEnabled)
                            
                            Text("Monitors system health, performance metrics, and connection status.")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    // Change Tracking Settings
                    SettingsSection(title: "Change Tracking") {
                        VStack(alignment: .leading, spacing: 12) {
                            Toggle("Enable Change Tracking", isOn: $changeTrackingEnabled)
                            
                            Text("Tracks user interactions, feature usage, and app state changes for analytics.")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    // Failure Prevention Settings
                    SettingsSection(title: "Failure Prevention") {
                        VStack(alignment: .leading, spacing: 12) {
                            Toggle("Enable Failure Prevention", isOn: $failurePreventionEnabled)
                            
                            Toggle("Automatic Recovery", isOn: $automaticRecoveryEnabled)
                                .disabled(!failurePreventionEnabled)
                            
                            Text("Proactively detects potential failures and attempts automatic recovery.")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
            }
            
            HStack {
                Button("Reset to Defaults") {
                    resetToDefaults()
                }
                
                Spacer()
                
                Button("Cancel") {
                    presentationMode.wrappedValue.dismiss()
                }
                .keyboardShortcut(.cancelAction)
                
                Button("Save") {
                    saveSettings()
                    presentationMode.wrappedValue.dismiss()
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 500, height: 600)
    }
    
    private func saveSettings() {
        loggingService.setEnabled(loggingEnabled)
        loggingService.setMinimumLevel(minimumLogLevel)
        
        monitoringService.setEnabled(monitoringEnabled)
        
        changeTracker.setEnabled(changeTrackingEnabled)
        
        failurePreventionService.setEnabled(failurePreventionEnabled)
        failurePreventionService.setAutomaticRecoveryEnabled(automaticRecoveryEnabled)
        
        if remoteLoggingEnabled {
            loggingService.remoteStreamer.startStreaming()
        } else {
            loggingService.remoteStreamer.stopStreaming()
        }
        
        LoggingService.shared.info("Debug settings updated", category: .monitoring)
    }
    
    private func resetToDefaults() {
        loggingEnabled = true
        minimumLogLevel = .debug
        monitoringEnabled = true
        changeTrackingEnabled = true
        failurePreventionEnabled = true
        automaticRecoveryEnabled = true
        remoteLoggingEnabled = false
    }
}

// MARK: - Settings Section
struct SettingsSection<Content: View>: View {
    let title: String
    let content: Content
    
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .fontWeight(.medium)
            
            content
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Notification Extensions
extension Notification.Name {
    static let remoteLoggingConnected = Notification.Name("RemoteLoggingConnected")
    static let remoteLoggingDisconnected = Notification.Name("RemoteLoggingDisconnected")
    static let failurePredicted = Notification.Name("FailurePredicted")
}

// MARK: - Notification Payload Keys
struct NotificationPayloadKeys {
    static let alertData = "alertData"
    static let predictionData = "predictionData"
}
