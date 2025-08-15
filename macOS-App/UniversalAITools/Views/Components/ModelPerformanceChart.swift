import SwiftUI
import Charts

/// **Model Performance Comparison Chart**
/// 
/// Professional chart component using Swift Charts for multi-model performance analysis.
/// Features:
/// - Multi-model performance comparison with historical data
/// - Throughput, latency, and memory usage metrics
/// - Model efficiency scoring with optimization recommendations
/// - Interactive chart controls with zoom and filter capabilities
/// - Export functionality for performance reports

struct ModelPerformanceChart: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    @State private var selectedModels: Set<String> = []
    @State private var selectedMetric: PerformanceMetric = .throughput
    @State private var chartTimeRange: ChartTimeRange = .last24Hours
    @State private var chartType: ChartType = .line
    @State private var showComparison = true
    @State private var showPredictions = false
    @State private var normalizeData = false
    @State private var selectedDataPoint: ModelDataPoint? = nil
    @State private var showExportSheet = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Chart Controls
            ModelPerformanceControls(
                selectedModels: $selectedModels,
                selectedMetric: $selectedMetric,
                chartTimeRange: $chartTimeRange,
                chartType: $chartType,
                showComparison: $showComparison,
                showPredictions: $showPredictions,
                normalizeData: $normalizeData,
                onExport: { showExportSheet = true },
                metricsService: metricsService
            )
            
            Divider()
            
            // Main Chart Area
            HStack(spacing: 0) {
                // Chart Container
                VStack(spacing: 0) {
                    // Chart Header with live metrics
                    ChartHeader(
                        selectedMetric: selectedMetric,
                        selectedModels: selectedModels,
                        metricsService: metricsService
                    )
                    
                    // Main Chart
                    GeometryReader { geometry in
                        ZStack {
                            // Background
                            Color(NSColor.controlBackgroundColor)
                            
                            // Performance Chart
                            Group {
                                switch chartType {
                                case .line:
                                    LinePerformanceChart(
                                        data: filteredPerformanceData,
                                        selectedMetric: selectedMetric,
                                        selectedDataPoint: $selectedDataPoint,
                                        showPredictions: showPredictions,
                                        normalizeData: normalizeData,
                                        geometry: geometry
                                    )
                                    
                                case .bar:
                                    BarPerformanceChart(
                                        data: filteredPerformanceData,
                                        selectedMetric: selectedMetric,
                                        selectedDataPoint: $selectedDataPoint,
                                        geometry: geometry
                                    )
                                    
                                case .scatter:
                                    ScatterPerformanceChart(
                                        data: filteredPerformanceData,
                                        selectedMetric: selectedMetric,
                                        selectedDataPoint: $selectedDataPoint,
                                        geometry: geometry
                                    )
                                    
                                case .heatmap:
                                    HeatmapPerformanceChart(
                                        data: filteredPerformanceData,
                                        selectedDataPoint: $selectedDataPoint,
                                        geometry: geometry
                                    )
                                }
                            }
                            .clipped()
                            
                            // Chart interactions overlay
                            ChartInteractionOverlay(
                                data: filteredPerformanceData,
                                selectedDataPoint: $selectedDataPoint,
                                geometry: geometry
                            )
                            
                            // Loading overlay
                            if metricsService.isLoadingPerformanceData {
                                LoadingOverlay()
                            }
                        }
                    }
                    
                    // Chart legends and annotations
                    ChartLegend(
                        selectedModels: selectedModels,
                        selectedMetric: selectedMetric,
                        showComparison: showComparison,
                        metricsService: metricsService
                    )
                }
                
                // Side panel for detailed analysis
                if selectedDataPoint != nil || showComparison {
                    ModelAnalysisPanel(
                        selectedDataPoint: $selectedDataPoint,
                        selectedModels: selectedModels,
                        selectedMetric: selectedMetric,
                        showComparison: $showComparison,
                        metricsService: metricsService
                    )
                    .frame(width: 350)
                    .background(Color(NSColor.controlBackgroundColor))
                }
            }
            
            // Chart status bar
            ChartStatusBar(
                selectedModels: selectedModels,
                selectedDataPoint: selectedDataPoint,
                chartTimeRange: chartTimeRange,
                metricsService: metricsService
            )
        }
        .sheet(isPresented: $showExportSheet) {
            PerformanceExportSheet(
                selectedModels: selectedModels,
                selectedMetric: selectedMetric,
                chartTimeRange: chartTimeRange,
                metricsService: metricsService
            )
        }
        .onAppear {
            loadInitialData()
        }
        .onChange(of: chartTimeRange) { _ in
            Task {
                await metricsService.loadModelPerformanceData(timeRange: chartTimeRange)
            }
        }
        .onChange(of: selectedModels) { _ in
            Task {
                await metricsService.loadModelPerformanceData(models: Array(selectedModels))
            }
        }
    }
    
    private var filteredPerformanceData: [ModelPerformanceData] {
        metricsService.getModelPerformanceData(
            models: Array(selectedModels),
            metric: selectedMetric,
            timeRange: chartTimeRange
        )
    }
    
    private func loadInitialData() {
        // Load available models and set default selection
        let availableModels = metricsService.availableModels
        selectedModels = Set(availableModels.prefix(3).map { $0.id })
        
        Task {
            await metricsService.loadModelPerformanceData(timeRange: chartTimeRange)
        }
    }
}

// MARK: - Enums and Types

enum PerformanceMetric: String, CaseIterable {
    case throughput = "Throughput"
    case latency = "Latency"
    case memoryUsage = "Memory Usage"
    case efficiency = "Efficiency"
    case accuracy = "Accuracy"
    case powerConsumption = "Power"
    
    var unit: String {
        switch self {
        case .throughput: return "tokens/sec"
        case .latency: return "ms"
        case .memoryUsage: return "GB"
        case .efficiency: return "%"
        case .accuracy: return "%"
        case .powerConsumption: return "W"
        }
    }
    
    var icon: String {
        switch self {
        case .throughput: return "speedometer"
        case .latency: return "clock"
        case .memoryUsage: return "memorychip"
        case .efficiency: return "gauge"
        case .accuracy: return "target"
        case .powerConsumption: return "bolt"
        }
    }
    
    var color: Color {
        switch self {
        case .throughput: return .green
        case .latency: return .orange
        case .memoryUsage: return .blue
        case .efficiency: return .purple
        case .accuracy: return .mint
        case .powerConsumption: return .red
        }
    }
}

enum ChartTimeRange: String, CaseIterable {
    case last1Hour = "1h"
    case last6Hours = "6h"
    case last24Hours = "24h"
    case last7Days = "7d"
    case last30Days = "30d"
    
    var displayName: String {
        switch self {
        case .last1Hour: return "Last hour"
        case .last6Hours: return "Last 6 hours"
        case .last24Hours: return "Last 24 hours"
        case .last7Days: return "Last 7 days"
        case .last30Days: return "Last 30 days"
        }
    }
    
    var seconds: TimeInterval {
        switch self {
        case .last1Hour: return 3600
        case .last6Hours: return 6 * 3600
        case .last24Hours: return 24 * 3600
        case .last7Days: return 7 * 24 * 3600
        case .last30Days: return 30 * 24 * 3600
        }
    }
}

enum ChartType: String, CaseIterable {
    case line = "Line"
    case bar = "Bar"
    case scatter = "Scatter"
    case heatmap = "Heatmap"
    
    var icon: String {
        switch self {
        case .line: return "chart.xyaxis.line"
        case .bar: return "chart.bar"
        case .scatter: return "chart.dots.scatter"
        case .heatmap: return "grid"
        }
    }
}

// MARK: - Model Performance Controls

struct ModelPerformanceControls: View {
    @Binding var selectedModels: Set<String>
    @Binding var selectedMetric: PerformanceMetric
    @Binding var chartTimeRange: ChartTimeRange
    @Binding var chartType: ChartType
    @Binding var showComparison: Bool
    @Binding var showPredictions: Bool
    @Binding var normalizeData: Bool
    let onExport: () -> Void
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 16) {
            // Model selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Models")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                ModelSelectorButton(
                    selectedModels: $selectedModels,
                    availableModels: metricsService.availableModels
                )
            }
            
            // Metric selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Metric")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Metric", selection: $selectedMetric) {
                    ForEach(PerformanceMetric.allCases, id: \.self) { metric in
                        Label(metric.rawValue, systemImage: metric.icon).tag(metric)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 130)
            }
            
            // Time range selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Time Range")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Time Range", selection: $chartTimeRange) {
                    ForEach(ChartTimeRange.allCases, id: \.self) { range in
                        Text(range.displayName).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
            }
            
            // Chart type selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Chart Type")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Chart Type", selection: $chartType) {
                    ForEach(ChartType.allCases, id: \.self) { type in
                        Label(type.rawValue, systemImage: type.icon).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 180)
            }
            
            Spacer()
            
            // Chart options
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    Toggle("Compare", isOn: $showComparison)
                        .font(.caption)
                    
                    Toggle("Predict", isOn: $showPredictions)
                        .font(.caption)
                    
                    Toggle("Normalize", isOn: $normalizeData)
                        .font(.caption)
                }
            }
            
            // Actions
            HStack(spacing: 8) {
                Button(action: {
                    Task { await metricsService.refreshModelPerformanceData() }
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
                .disabled(metricsService.isLoadingPerformanceData)
                
                Button(action: onExport) {
                    Image(systemName: "square.and.arrow.up")
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

// MARK: - Model Selector

struct ModelSelectorButton: View {
    @Binding var selectedModels: Set<String>
    let availableModels: [ModelInfo]
    @State private var showPopover = false
    
    var body: some View {
        Button(action: { showPopover.toggle() }) {
            HStack {
                Text(selectionText)
                    .font(.system(size: 13))
                    .lineLimit(1)
                
                Spacer()
                
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color(NSColor.separatorColor), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .frame(width: 140)
        .popover(isPresented: $showPopover, arrowEdge: .bottom) {
            ModelSelectionPopover(
                selectedModels: $selectedModels,
                availableModels: availableModels
            )
        }
    }
    
    private var selectionText: String {
        if selectedModels.isEmpty {
            return "Select models..."
        } else if selectedModels.count == 1 {
            return selectedModels.first ?? ""
        } else {
            return "\(selectedModels.count) models"
        }
    }
}

struct ModelSelectionPopover: View {
    @Binding var selectedModels: Set<String>
    let availableModels: [ModelInfo]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Select Models")
                .font(.headline)
                .padding(.bottom, 8)
            
            ForEach(availableModels, id: \.id) { model in
                Toggle(isOn: Binding(
                    get: { selectedModels.contains(model.id) },
                    set: { isSelected in
                        if isSelected {
                            selectedModels.insert(model.id)
                        } else {
                            selectedModels.remove(model.id)
                        }
                    }
                )) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(model.name)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text(model.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }
                .toggleStyle(.checkbox)
            }
            
            Divider()
            
            HStack {
                Button("Select All") {
                    selectedModels = Set(availableModels.map { $0.id })
                }
                .font(.caption)
                
                Spacer()
                
                Button("Clear All") {
                    selectedModels.removeAll()
                }
                .font(.caption)
            }
        }
        .padding()
        .frame(width: 300, maxHeight: 400)
    }
}

// MARK: - Chart Header

struct ChartHeader: View {
    let selectedMetric: PerformanceMetric
    let selectedModels: Set<String>
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(spacing: 12) {
            // Current metric summary
            HStack {
                // Metric info
                HStack(spacing: 8) {
                    Image(systemName: selectedMetric.icon)
                        .font(.title2)
                        .foregroundColor(selectedMetric.color)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedMetric.rawValue)
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        Text("Live performance metrics")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                // Live statistics
                LiveMetricsSummary(
                    selectedMetric: selectedMetric,
                    selectedModels: selectedModels,
                    metricsService: metricsService
                )
            }
            
            // Model comparison bar (if multiple models selected)
            if selectedModels.count > 1 {
                ModelComparisonBar(
                    selectedMetric: selectedMetric,
                    selectedModels: selectedModels,
                    metricsService: metricsService
                )
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

struct LiveMetricsSummary: View {
    let selectedMetric: PerformanceMetric
    let selectedModels: Set<String>
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 20) {
            // Current value
            VStack(alignment: .trailing, spacing: 2) {
                Text("Current")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(currentValue)
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(selectedMetric.color)
            }
            
            // Average value
            VStack(alignment: .trailing, spacing: 2) {
                Text("Average")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(averageValue)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            
            // Trend indicator
            VStack(alignment: .trailing, spacing: 2) {
                Text("Trend")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                TrendIndicator(trend: currentTrend)
            }
        }
    }
    
    private var currentValue: String {
        let value = metricsService.getCurrentMetricValue(selectedMetric, models: Array(selectedModels))
        return formatMetricValue(value, metric: selectedMetric)
    }
    
    private var averageValue: String {
        let value = metricsService.getAverageMetricValue(selectedMetric, models: Array(selectedModels))
        return formatMetricValue(value, metric: selectedMetric)
    }
    
    private var currentTrend: TrendDirection {
        metricsService.getMetricTrend(selectedMetric, models: Array(selectedModels))
    }
    
    private func formatMetricValue(_ value: Double, metric: PerformanceMetric) -> String {
        switch metric {
        case .throughput:
            return String(format: "%.0f", value)
        case .latency:
            return String(format: "%.1f", value)
        case .memoryUsage:
            return String(format: "%.2f", value)
        case .efficiency, .accuracy:
            return String(format: "%.1f%%", value * 100)
        case .powerConsumption:
            return String(format: "%.1f", value)
        }
    }
}

struct ModelComparisonBar: View {
    let selectedMetric: PerformanceMetric
    let selectedModels: Set<String>
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 12) {
            ForEach(Array(selectedModels), id: \.self) { modelId in
                if let modelInfo = metricsService.getModelInfo(modelId) {
                    ModelComparisonItem(
                        model: modelInfo,
                        metric: selectedMetric,
                        value: metricsService.getCurrentMetricValue(selectedMetric, models: [modelId]),
                        rank: metricsService.getModelRank(modelId, metric: selectedMetric)
                    )
                }
            }
        }
    }
}

struct ModelComparisonItem: View {
    let model: ModelInfo
    let metric: PerformanceMetric
    let value: Double
    let rank: Int
    
    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Circle()
                    .fill(model.color)
                    .frame(width: 8, height: 8)
                
                Text(model.name)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)
                
                if rank <= 3 {
                    Image(systemName: rankIcon)
                        .font(.caption2)
                        .foregroundColor(rankColor)
                }
            }
            
            Text(formattedValue)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(6)
    }
    
    private var formattedValue: String {
        switch metric {
        case .throughput:
            return String(format: "%.0f %@", value, metric.unit)
        case .latency:
            return String(format: "%.1f %@", value, metric.unit)
        case .memoryUsage:
            return String(format: "%.2f %@", value, metric.unit)
        case .efficiency, .accuracy:
            return String(format: "%.1f%@", value * 100, metric.unit)
        case .powerConsumption:
            return String(format: "%.1f %@", value, metric.unit)
        }
    }
    
    private var rankIcon: String {
        switch rank {
        case 1: return "1.circle.fill"
        case 2: return "2.circle.fill"
        case 3: return "3.circle.fill"
        default: return ""
        }
    }
    
    private var rankColor: Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .clear
        }
    }
}

// MARK: - Chart Implementations

struct LinePerformanceChart: View {
    let data: [ModelPerformanceData]
    let selectedMetric: PerformanceMetric
    @Binding var selectedDataPoint: ModelDataPoint?
    let showPredictions: Bool
    let normalizeData: Bool
    let geometry: GeometryProxy
    
    var body: some View {
        Chart {
            ForEach(data, id: \.modelId) { modelData in
                ForEach(modelData.dataPoints, id: \.timestamp) { point in
                    LineMark(
                        x: .value("Time", point.timestamp),
                        y: .value(selectedMetric.rawValue, normalizeData ? point.normalizedValue : point.value)
                    )
                    .foregroundStyle(modelData.color)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                    .interpolationMethod(.catmullRom)
                    
                    // Data points
                    PointMark(
                        x: .value("Time", point.timestamp),
                        y: .value(selectedMetric.rawValue, normalizeData ? point.normalizedValue : point.value)
                    )
                    .foregroundStyle(modelData.color)
                    .symbolSize(selectedDataPoint?.id == point.id ? 80 : 20)
                }
                
                // Prediction line (if enabled)
                if showPredictions {
                    ForEach(modelData.predictions, id: \.timestamp) { prediction in
                        LineMark(
                            x: .value("Time", prediction.timestamp),
                            y: .value(selectedMetric.rawValue, prediction.value)
                        )
                        .foregroundStyle(modelData.color.opacity(0.5))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
                    }
                }
            }
        }
        .chartLegend(.hidden)
        .chartXAxis {
            AxisMarks(values: .automatic) { value in
                AxisGridLine()
                AxisTick()
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        Text(formatAxisDate(date))
                            .font(.caption2)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(values: .automatic) { value in
                AxisGridLine()
                AxisTick()
                AxisValueLabel {
                    if let doubleValue = value.as(Double.self) {
                        Text(formatAxisValue(doubleValue))
                            .font(.caption2)
                    }
                }
            }
        }
        .frame(width: geometry.size.width, height: geometry.size.height)
        .animation(.easeInOut(duration: 0.5), value: data)
    }
    
    private func formatAxisDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
    
    private func formatAxisValue(_ value: Double) -> String {
        if normalizeData {
            return String(format: "%.1f", value)
        } else {
            switch selectedMetric {
            case .throughput:
                return String(format: "%.0f", value)
            case .latency:
                return String(format: "%.0f", value)
            case .memoryUsage:
                return String(format: "%.1f", value)
            case .efficiency, .accuracy:
                return String(format: "%.0f%%", value * 100)
            case .powerConsumption:
                return String(format: "%.0f", value)
            }
        }
    }
}

struct BarPerformanceChart: View {
    let data: [ModelPerformanceData]
    let selectedMetric: PerformanceMetric
    @Binding var selectedDataPoint: ModelDataPoint?
    let geometry: GeometryProxy
    
    var body: some View {
        Chart {
            ForEach(data, id: \.modelId) { modelData in
                BarMark(
                    x: .value("Model", modelData.modelName),
                    y: .value(selectedMetric.rawValue, modelData.averageValue)
                )
                .foregroundStyle(modelData.color)
                .opacity(0.8)
            }
        }
        .chartLegend(.hidden)
        .frame(width: geometry.size.width, height: geometry.size.height)
        .animation(.easeInOut(duration: 0.5), value: data)
    }
}

struct ScatterPerformanceChart: View {
    let data: [ModelPerformanceData]
    let selectedMetric: PerformanceMetric
    @Binding var selectedDataPoint: ModelDataPoint?
    let geometry: GeometryProxy
    
    var body: some View {
        Chart {
            ForEach(data, id: \.modelId) { modelData in
                ForEach(modelData.dataPoints, id: \.timestamp) { point in
                    PointMark(
                        x: .value("Memory Usage", point.memoryUsage),
                        y: .value("Throughput", point.throughput)
                    )
                    .foregroundStyle(modelData.color)
                    .symbolSize(point.efficiency * 100) // Size based on efficiency
                }
            }
        }
        .chartLegend(.hidden)
        .frame(width: geometry.size.width, height: geometry.size.height)
        .animation(.easeInOut(duration: 0.5), value: data)
    }
}

struct HeatmapPerformanceChart: View {
    let data: [ModelPerformanceData]
    @Binding var selectedDataPoint: ModelDataPoint?
    let geometry: GeometryProxy
    
    var body: some View {
        // Custom heatmap implementation using Canvas
        Canvas { context, size in
            let cellWidth = size.width / CGFloat(data.count)
            let cellHeight = size.height / CGFloat(PerformanceMetric.allCases.count)
            
            for (modelIndex, modelData) in data.enumerated() {
                for (metricIndex, metric) in PerformanceMetric.allCases.enumerated() {
                    let value = getMetricValue(from: modelData, metric: metric)
                    let normalizedValue = normalizeValue(value, metric: metric)
                    let color = heatmapColor(for: normalizedValue)
                    
                    let rect = CGRect(
                        x: CGFloat(modelIndex) * cellWidth,
                        y: CGFloat(metricIndex) * cellHeight,
                        width: cellWidth - 1,
                        height: cellHeight - 1
                    )
                    
                    context.fill(Path(rect), with: .color(color))
                }
            }
        }
        .frame(width: geometry.size.width, height: geometry.size.height)
    }
    
    private func getMetricValue(from modelData: ModelPerformanceData, metric: PerformanceMetric) -> Double {
        // Get the latest value for the metric
        guard let latestPoint = modelData.dataPoints.last else { return 0 }
        
        switch metric {
        case .throughput: return latestPoint.throughput
        case .latency: return latestPoint.latency
        case .memoryUsage: return latestPoint.memoryUsage
        case .efficiency: return latestPoint.efficiency
        case .accuracy: return latestPoint.accuracy ?? 0
        case .powerConsumption: return latestPoint.powerConsumption ?? 0
        }
    }
    
    private func normalizeValue(_ value: Double, metric: PerformanceMetric) -> Double {
        // Normalize values to 0-1 range for consistent heatmap coloring
        // This would use actual min/max values from the dataset
        return max(0, min(1, value / 100.0)) // Simplified normalization
    }
    
    private func heatmapColor(for normalizedValue: Double) -> Color {
        // Create a color gradient from blue (low) to red (high)
        let red = normalizedValue
        let blue = 1.0 - normalizedValue
        return Color(red: red, green: 0.2, blue: blue)
    }
}

// MARK: - Chart Interaction Overlay

struct ChartInteractionOverlay: View {
    let data: [ModelPerformanceData]
    @Binding var selectedDataPoint: ModelDataPoint?
    let geometry: GeometryProxy
    
    var body: some View {
        Rectangle()
            .fill(Color.clear)
            .contentShape(Rectangle())
            .gesture(
                TapGesture()
                    .onEnded { location in
                        if let dataPoint = findDataPoint(at: location) {
                            selectedDataPoint = selectedDataPoint?.id == dataPoint.id ? nil : dataPoint
                        }
                    }
            )
    }
    
    private func findDataPoint(at location: CGPoint) -> ModelDataPoint? {
        // Simplified data point detection
        // In a real implementation, this would use chart coordinate conversion
        return data.first?.dataPoints.first
    }
}

// MARK: - Chart Legend

struct ChartLegend: View {
    let selectedModels: Set<String>
    let selectedMetric: PerformanceMetric
    let showComparison: Bool
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack {
            // Model legends
            HStack(spacing: 12) {
                ForEach(Array(selectedModels), id: \.self) { modelId in
                    if let modelInfo = metricsService.getModelInfo(modelId) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(modelInfo.color)
                                .frame(width: 10, height: 10)
                            
                            Text(modelInfo.name)
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                    }
                }
            }
            
            Spacer()
            
            // Chart info
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(selectedModels.count) models")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text("Updated \(metricsService.lastUpdateTime?.formatted(.relative(presentation: .named)) ?? "never")")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
    }
}

// MARK: - Model Analysis Panel

struct ModelAnalysisPanel: View {
    @Binding var selectedDataPoint: ModelDataPoint?
    let selectedModels: Set<String>
    let selectedMetric: PerformanceMetric
    @Binding var showComparison: Bool
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Panel header
            HStack {
                Text(selectedDataPoint != nil ? "Data Point Analysis" : "Model Comparison")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: {
                    selectedDataPoint = nil
                    showComparison = false
                }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .medium))
                }
                .buttonStyle(.borderless)
            }
            
            if let dataPoint = selectedDataPoint {
                // Individual data point analysis
                DataPointAnalysis(
                    dataPoint: dataPoint,
                    metric: selectedMetric,
                    metricsService: metricsService
                )
            } else if showComparison {
                // Model comparison analysis
                ModelComparisonAnalysis(
                    selectedModels: selectedModels,
                    selectedMetric: selectedMetric,
                    metricsService: metricsService
                )
            }
            
            Spacer()
        }
        .padding()
    }
}

struct DataPointAnalysis: View {
    let dataPoint: ModelDataPoint
    let metric: PerformanceMetric
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Timestamp and model info
            VStack(alignment: .leading, spacing: 4) {
                Text(dataPoint.timestamp.formatted(.dateTime.hour().minute().second()))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                if let modelInfo = metricsService.getModelInfo(dataPoint.modelId) {
                    Text(modelInfo.name)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            // All metrics for this data point
            VStack(alignment: .leading, spacing: 12) {
                Text("All Metrics")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                    MetricValueCard(title: "Throughput", value: dataPoint.throughput, unit: "tok/s")
                    MetricValueCard(title: "Latency", value: dataPoint.latency, unit: "ms")
                    MetricValueCard(title: "Memory", value: dataPoint.memoryUsage, unit: "GB")
                    MetricValueCard(title: "Efficiency", value: dataPoint.efficiency * 100, unit: "%")
                }
            }
            
            // Performance insights
            PerformanceInsights(dataPoint: dataPoint, metricsService: metricsService)
        }
    }
}

struct MetricValueCard: View {
    let title: String
    let value: Double
    let unit: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text("\(String(format: "%.1f", value)) \(unit)")
                .font(.subheadline)
                .fontWeight(.semibold)
        }
        .padding(8)
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(6)
    }
}

struct ModelComparisonAnalysis: View {
    let selectedModels: Set<String>
    let selectedMetric: PerformanceMetric
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Comparison summary
            Text("Comparing \(selectedModels.count) models")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            // Model rankings
            ModelRankings(
                selectedModels: selectedModels,
                selectedMetric: selectedMetric,
                metricsService: metricsService
            )
            
            // Performance gaps
            PerformanceGaps(
                selectedModels: selectedModels,
                selectedMetric: selectedMetric,
                metricsService: metricsService
            )
        }
    }
}

struct ModelRankings: View {
    let selectedModels: Set<String>
    let selectedMetric: PerformanceMetric
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Rankings")
                .font(.subheadline)
                .fontWeight(.medium)
            
            ForEach(rankedModels, id: \.0) { modelId, rank in
                if let modelInfo = metricsService.getModelInfo(modelId) {
                    HStack {
                        Text("#\(rank)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(rankColor(rank))
                            .frame(width: 24)
                        
                        Circle()
                            .fill(modelInfo.color)
                            .frame(width: 8, height: 8)
                        
                        Text(modelInfo.name)
                            .font(.caption)
                            .fontWeight(.medium)
                        
                        Spacer()
                        
                        Text(formatMetricValue(modelId))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
    
    private var rankedModels: [(String, Int)] {
        metricsService.getRankedModels(Array(selectedModels), metric: selectedMetric)
    }
    
    private func rankColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .secondary
        }
    }
    
    private func formatMetricValue(_ modelId: String) -> String {
        let value = metricsService.getCurrentMetricValue(selectedMetric, models: [modelId])
        
        switch selectedMetric {
        case .throughput:
            return String(format: "%.0f tok/s", value)
        case .latency:
            return String(format: "%.1f ms", value)
        case .memoryUsage:
            return String(format: "%.2f GB", value)
        case .efficiency, .accuracy:
            return String(format: "%.1f%%", value * 100)
        case .powerConsumption:
            return String(format: "%.1f W", value)
        }
    }
}

struct PerformanceGaps: View {
    let selectedModels: Set<String>
    let selectedMetric: PerformanceMetric
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Performance Gaps")
                .font(.subheadline)
                .fontWeight(.medium)
            
            if let gap = metricsService.getPerformanceGap(Array(selectedModels), metric: selectedMetric) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Best vs Worst:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text("\(String(format: "%.1f", gap.percentage))% difference")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(gap.isSignificant ? .red : .green)
                    }
                    
                    Text(gap.recommendation)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(3)
                }
                .padding(8)
                .background(Color(NSColor.textBackgroundColor))
                .cornerRadius(6)
            }
        }
    }
}

struct PerformanceInsights: View {
    let dataPoint: ModelDataPoint
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Insights")
                .font(.subheadline)
                .fontWeight(.medium)
            
            ForEach(insights, id: \.id) { insight in
                InsightRow(insight: insight)
            }
        }
    }
    
    private var insights: [PerformanceInsight] {
        metricsService.getPerformanceInsights(for: dataPoint)
    }
}

struct InsightRow: View {
    let insight: PerformanceInsight
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: insight.type.icon)
                .font(.caption)
                .foregroundColor(insight.type.color)
                .frame(width: 16)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(insight.title)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(insight.description)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(6)
    }
}

// MARK: - Chart Status Bar

struct ChartStatusBar: View {
    let selectedModels: Set<String>
    let selectedDataPoint: ModelDataPoint?
    let chartTimeRange: ChartTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 16) {
            // Selection info
            if let dataPoint = selectedDataPoint {
                Text("Selected: \(dataPoint.timestamp.formatted(.dateTime.hour().minute()))")
                    .font(.caption)
                    .foregroundColor(.primary)
            } else {
                Text("\(selectedModels.count) models selected")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            // Time range
            Text("Range: \(chartTimeRange.displayName)")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            // Data stats
            HStack(spacing: 12) {
                Text("Data points: \(metricsService.totalDataPoints)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("Last update: \(metricsService.lastUpdateTime?.formatted(.relative(presentation: .named)) ?? "Never")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

// MARK: - Export Sheet

struct PerformanceExportSheet: View {
    let selectedModels: Set<String>
    let selectedMetric: PerformanceMetric
    let chartTimeRange: ChartTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Export Performance Data")
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

#Preview {
    ModelPerformanceChart(metricsService: PerformanceMetricsService())
        .frame(width: 1200, height: 800)
}