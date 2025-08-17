import SwiftUI
import Charts

/// Enhanced performance visualization using the new EnhancedUIComponents
struct PerformanceVisualizationView: View {
    let performanceData: [PerformanceDataPoint]
    let title: String
    let color: Color
    @State private var selectedDataPoint: PerformanceDataPoint?
    @State private var showingDetail = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header with enhanced status badge
            HStack {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                EnhancedUIComponents.EnhancedStatusBadge(
                    status: performanceStatus,
                    type: statusBadgeType
                )
            }
            
            // Enhanced metric visualization
            EnhancedUIComponents.MetricVisualization(
                metrics: performanceData.map { point in
                    MetricDataPoint(
                        timestamp: point.timestamp,
                        value: point.value
                    )
                },
                color: color
            )
            .frame(height: 200)
            .onTapGesture { location in
                // Handle tap for data point selection
                selectDataPoint(at: location)
            }
            
            // Performance summary cards
            HStack(spacing: 12) {
                EnhancedUIComponents.ParticleDataCard(
                    title: "Current",
                    value: String(format: "%.1f", currentValue),
                    trend: currentTrend,
                    color: color
                )
                
                EnhancedUIComponents.ParticleDataCard(
                    title: "Average",
                    value: String(format: "%.1f", averageValue),
                    trend: .stable,
                    color: .blue
                )
                
                EnhancedUIComponents.ParticleDataCard(
                    title: "Peak",
                    value: String(format: "%.1f", peakValue),
                    trend: .rising,
                    color: .red
                )
            }
            
            // Action buttons
            HStack {
                Spacer()
                
                EnhancedUIComponents.EnhancedActionButton(
                    title: "Details",
                    icon: "chart.bar.doc.horizontal",
                    action: { showingDetail = true },
                    style: .secondary
                )
                
                EnhancedUIComponents.EnhancedActionButton(
                    title: "Export",
                    icon: "square.and.arrow.up",
                    action: { exportData() },
                    style: .primary
                )
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(16)
        .sheet(isPresented: $showingDetail) {
            PerformanceDetailView(data: performanceData, title: title)
        }
    }
    
    // MARK: - Computed Properties
    
    private var currentValue: Double {
        performanceData.last?.value ?? 0.0
    }
    
    private var averageValue: Double {
        guard !performanceData.isEmpty else { return 0.0 }
        return performanceData.map(\.value).reduce(0, +) / Double(performanceData.count)
    }
    
    private var peakValue: Double {
        performanceData.map(\.value).max() ?? 0.0
    }
    
    private var currentTrend: TrendDirection {
        guard performanceData.count >= 2 else { return .stable }
        let recent = Array(performanceData.suffix(2))
        if recent[1].value > recent[0].value * 1.05 {
            return .rising
        } else if recent[1].value < recent[0].value * 0.95 {
            return .falling
        } else {
            return .stable
        }
    }
    
    private var performanceStatus: String {
        if currentValue > averageValue * 1.2 {
            return "High Performance"
        } else if currentValue < averageValue * 0.8 {
            return "Low Performance"
        } else {
            return "Normal"
        }
    }
    
    private var statusBadgeType: EnhancedUIComponents.EnhancedStatusBadge.BadgeType {
        if currentValue > averageValue * 1.2 {
            return .success
        } else if currentValue < averageValue * 0.8 {
            return .warning
        } else {
            return .info
        }
    }
    
    // MARK: - Helper Functions
    
    private func selectDataPoint(at location: CGPoint) {
        // Simple implementation - in a real app, you'd calculate the exact data point
        let index = min(Int(location.x / 50), performanceData.count - 1)
        if index >= 0 && index < performanceData.count {
            selectedDataPoint = performanceData[index]
        }
    }
    
    private func exportData() {
        // Implementation for data export
        print("Exporting performance data for \(title)")
    }
}

// MARK: - Supporting Types

struct PerformanceDataPoint: Identifiable {
    let id = UUID()
    let timestamp: Date
    let value: Double
    let category: String?
    
    init(timestamp: Date, value: Double, category: String? = nil) {
        self.timestamp = timestamp
        self.value = value
        self.category = category
    }
}

// MARK: - Detail View

struct PerformanceDetailView: View {
    let data: [PerformanceDataPoint]
    let title: String
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                // Enhanced loading indicator while processing
                if data.isEmpty {
                    EnhancedUIComponents.EnhancedLoadingIndicator(
                        message: "Loading performance data..."
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            // Detailed metrics
                            ForEach(data) { point in
                                PerformanceDetailRow(dataPoint: point)
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("\(title) Details")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    EnhancedUIComponents.EnhancedActionButton(
                        title: "Done",
                        icon: "xmark",
                        action: { dismiss() },
                        style: .secondary
                    )
                }
            }
        }
        .frame(minWidth: 600, minHeight: 400)
    }
}

struct PerformanceDetailRow: View {
    let dataPoint: PerformanceDataPoint
    
    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .medium
        return formatter
    }
    
    var body: some View {
        HStack {
            Text(timeFormatter.string(from: dataPoint.timestamp))
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 100, alignment: .leading)
            
            Text(String(format: "%.2f", dataPoint.value))
                .font(.body)
                .fontWeight(.medium)
                .frame(width: 80, alignment: .trailing)
            
            if let category = dataPoint.category {
                EnhancedUIComponents.EnhancedStatusBadge(
                    status: category,
                    type: .info
                )
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 12)
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}

// MARK: - Preview

#Preview {
    let sampleData = [
        PerformanceDataPoint(timestamp: Date().addingTimeInterval(-3600), value: 45.2),
        PerformanceDataPoint(timestamp: Date().addingTimeInterval(-3000), value: 52.1),
        PerformanceDataPoint(timestamp: Date().addingTimeInterval(-2400), value: 48.7),
        PerformanceDataPoint(timestamp: Date().addingTimeInterval(-1800), value: 61.3),
        PerformanceDataPoint(timestamp: Date().addingTimeInterval(-1200), value: 55.8),
        PerformanceDataPoint(timestamp: Date().addingTimeInterval(-600), value: 58.9),
        PerformanceDataPoint(timestamp: Date(), value: 62.4)
    ]
    
    return PerformanceVisualizationView(
        performanceData: sampleData,
        title: "CPU Usage",
        color: .blue
    )
    .frame(width: 400, height: 500)
    .padding()
}