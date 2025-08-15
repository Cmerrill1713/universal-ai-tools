import SwiftUI
import Charts

/// **Token Processing Waterfall Chart**
/// 
/// Advanced visualization component that displays token processing pipeline efficiency
/// with waterfall-style charts. Features:
/// - Timeline visualization of token processing stages
/// - Bottleneck identification with performance alerts
/// - Pipeline efficiency metrics and optimization suggestions
/// - Real-time processing updates with smooth animations
/// - Interactive stage selection with detailed breakdowns
/// - Performance comparison across different sequences

struct TokenProcessingWaterfall: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    @State private var selectedSequence: String? = nil
    @State private var selectedStage: ProcessingStage? = nil
    @State private var timeRange: WaterfallTimeRange = .last100Tokens
    @State private var viewMode: WaterfallViewMode = .timeline
    @State private var showBottlenecks = true
    @State private var animateChart = true
    @State private var autoScroll = true
    
    var body: some View {
        VStack(spacing: 0) {
            // Waterfall Controls
            WaterfallControls(
                selectedSequence: $selectedSequence,
                timeRange: $timeRange,
                viewMode: $viewMode,
                showBottlenecks: $showBottlenecks,
                animateChart: $animateChart,
                autoScroll: $autoScroll,
                metricsService: metricsService
            )
            
            Divider()
            
            // Main Content
            HStack(spacing: 0) {
                // Waterfall Chart Area
                VStack(spacing: 0) {
                    // Chart Header
                    WaterfallChartHeader(
                        viewMode: viewMode,
                        selectedSequence: selectedSequence,
                        metricsService: metricsService
                    )
                    
                    // Main Chart
                    GeometryReader { geometry in
                        ScrollViewReader { proxy in
                            ScrollView([.horizontal, .vertical], showsIndicators: true) {
                                ZStack(alignment: .topLeading) {
                                    // Background grid
                                    WaterfallGrid(
                                        geometry: geometry,
                                        timeRange: timeRange,
                                        viewMode: viewMode
                                    )
                                    
                                    // Waterfall visualization
                                    switch viewMode {
                                    case .timeline:
                                        TimelineWaterfallChart(
                                            processingData: currentProcessingData,
                                            selectedSequence: $selectedSequence,
                                            selectedStage: $selectedStage,
                                            showBottlenecks: showBottlenecks,
                                            animateChart: animateChart,
                                            geometry: geometry
                                        )
                                        
                                    case .gantt:
                                        GanttWaterfallChart(
                                            processingData: currentProcessingData,
                                            selectedSequence: $selectedSequence,
                                            selectedStage: $selectedStage,
                                            geometry: geometry
                                        )
                                        
                                    case .flow:
                                        FlowWaterfallChart(
                                            processingData: currentProcessingData,
                                            selectedSequence: $selectedSequence,
                                            selectedStage: $selectedStage,
                                            geometry: geometry
                                        )
                                    }
                                    
                                    // Bottleneck indicators
                                    if showBottlenecks {
                                        BottleneckOverlay(
                                            bottlenecks: metricsService.identifiedBottlenecks,
                                            geometry: geometry
                                        )
                                    }
                                }
                                .frame(
                                    width: max(geometry.size.width, chartContentWidth),
                                    height: max(geometry.size.height, chartContentHeight)
                                )
                            }
                            .onChange(of: metricsService.latestTokenSequence) { sequence in
                                if autoScroll, let sequence = sequence {
                                    withAnimation(.easeOut(duration: 0.5)) {
                                        proxy.scrollTo(sequence, anchor: .trailing)
                                    }
                                }
                            }
                        }
                    }
                    
                    // Timeline scrubber
                    if viewMode == .timeline {
                        TimelineScrubber(
                            timeRange: timeRange,
                            selectedTime: Binding(
                                get: { selectedSequence },
                                set: { selectedSequence = $0 }
                            ),
                            metricsService: metricsService
                        )
                        .frame(height: 40)
                    }
                }
                
                // Details Panel
                if selectedStage != nil {
                    StageDetailsPanel(
                        selectedStage: $selectedStage,
                        selectedSequence: selectedSequence,
                        metricsService: metricsService
                    )
                    .frame(width: 320)
                    .background(Color(NSColor.controlBackgroundColor))
                }
            }
            
            // Status and Metrics Bar
            WaterfallStatusBar(
                selectedSequence: selectedSequence,
                selectedStage: selectedStage,
                metricsService: metricsService
            )
        }
        .onAppear {
            Task {
                await metricsService.loadTokenProcessingData(timeRange: timeRange)
            }
        }
        .onChange(of: timeRange) { _ in
            Task {
                await metricsService.loadTokenProcessingData(timeRange: timeRange)
            }
        }
    }
    
    private var currentProcessingData: [TokenProcessingSequence] {
        metricsService.getTokenProcessingData(for: timeRange)
    }
    
    private var chartContentWidth: CGFloat {
        CGFloat(currentProcessingData.count) * 120 // Adjust based on data
    }
    
    private var chartContentHeight: CGFloat {
        CGFloat(ProcessingStage.allCases.count) * 60 // Adjust based on stages
    }
}

// MARK: - Enums and Types

enum WaterfallTimeRange: String, CaseIterable {
    case last50Tokens = "50"
    case last100Tokens = "100"
    case last500Tokens = "500"
    case last1000Tokens = "1000"
    case currentSession = "session"
    
    var displayName: String {
        switch self {
        case .last50Tokens: return "Last 50 tokens"
        case .last100Tokens: return "Last 100 tokens"
        case .last500Tokens: return "Last 500 tokens"
        case .last1000Tokens: return "Last 1000 tokens"
        case .currentSession: return "Current session"
        }
    }
    
    var tokenCount: Int {
        switch self {
        case .last50Tokens: return 50
        case .last100Tokens: return 100
        case .last500Tokens: return 500
        case .last1000Tokens: return 1000
        case .currentSession: return Int.max
        }
    }
}

enum WaterfallViewMode: String, CaseIterable {
    case timeline = "timeline"
    case gantt = "gantt"
    case flow = "flow"
    
    var displayName: String {
        switch self {
        case .timeline: return "Timeline"
        case .gantt: return "Gantt"
        case .flow: return "Flow"
        }
    }
    
    var icon: String {
        switch self {
        case .timeline: return "timeline.selection"
        case .gantt: return "chart.bar.horizontal"
        case .flow: return "flowchart"
        }
    }
}

enum ProcessingStage: String, CaseIterable {
    case tokenization = "Tokenization"
    case embedding = "Embedding"
    case attention = "Attention"
    case feedforward = "Feed Forward"
    case normalization = "Normalization"
    case output = "Output"
    
    var color: Color {
        switch self {
        case .tokenization: return .blue
        case .embedding: return .purple
        case .attention: return .orange
        case .feedforward: return .green
        case .normalization: return .mint
        case .output: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .tokenization: return "textformat.abc"
        case .embedding: return "point.3.connected.trianglepath.dotted"
        case .attention: return "brain.head.profile"
        case .feedforward: return "arrow.right.circle"
        case .normalization: return "slider.horizontal.3"
        case .output: return "arrow.up.doc"
        }
    }
}

// MARK: - Waterfall Controls

struct WaterfallControls: View {
    @Binding var selectedSequence: String?
    @Binding var timeRange: WaterfallTimeRange
    @Binding var viewMode: WaterfallViewMode
    @Binding var showBottlenecks: Bool
    @Binding var animateChart: Bool
    @Binding var autoScroll: Bool
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 16) {
            // Time Range Selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Time Range")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Time Range", selection: $timeRange) {
                    ForEach(WaterfallTimeRange.allCases, id: \.self) { range in
                        Text(range.displayName).tag(range)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 140)
            }
            
            // View Mode Selector
            VStack(alignment: .leading, spacing: 4) {
                Text("View Mode")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("View Mode", selection: $viewMode) {
                    ForEach(WaterfallViewMode.allCases, id: \.self) { mode in
                        Label(mode.displayName, systemImage: mode.icon).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 180)
            }
            
            Divider()
                .frame(height: 30)
            
            // Display Options
            VStack(alignment: .leading, spacing: 8) {
                Toggle("Show Bottlenecks", isOn: $showBottlenecks)
                    .font(.caption)
                
                HStack(spacing: 12) {
                    Toggle("Animate", isOn: $animateChart)
                        .font(.caption)
                    
                    Toggle("Auto-scroll", isOn: $autoScroll)
                        .font(.caption)
                }
            }
            
            Spacer()
            
            // Performance Summary
            VStack(alignment: .trailing, spacing: 2) {
                Text("Avg Processing Time")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text("\(String(format: "%.1f", metricsService.averageProcessingTime))ms")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("Throughput")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text("\(metricsService.currentThroughput) tok/s")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            
            // Refresh button
            Button(action: {
                Task {
                    await metricsService.refreshTokenProcessingData()
                }
            }) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 14, weight: .medium))
            }
            .buttonStyle(.borderless)
            .disabled(metricsService.isLoading)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

// MARK: - Chart Components

struct WaterfallChartHeader: View {
    let viewMode: WaterfallViewMode
    let selectedSequence: String?
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack {
            // Stage legend
            HStack(spacing: 16) {
                ForEach(ProcessingStage.allCases, id: \.self) { stage in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(stage.color)
                            .frame(width: 8, height: 8)
                        
                        Text(stage.rawValue)
                            .font(.caption)
                    }
                }
            }
            
            Spacer()
            
            // Current selection info
            if let selectedSequence = selectedSequence {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Selected Sequence")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Text(selectedSequence)
                        .font(.caption)
                        .fontWeight(.medium)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
    }
}

struct WaterfallGrid: View {
    let geometry: GeometryProxy
    let timeRange: WaterfallTimeRange
    let viewMode: WaterfallViewMode
    
    var body: some View {
        Canvas { context, size in
            // Draw grid lines
            let gridColor = Color.gray.opacity(0.2)
            
            // Vertical grid lines (time)
            let timeSteps = 10
            for i in 0...timeSteps {
                let x = (size.width / CGFloat(timeSteps)) * CGFloat(i)
                context.stroke(
                    Path { path in
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: size.height))
                    },
                    with: .color(gridColor),
                    lineWidth: 0.5
                )
            }
            
            // Horizontal grid lines (stages)
            let stageCount = ProcessingStage.allCases.count
            for i in 0...stageCount {
                let y = (size.height / CGFloat(stageCount)) * CGFloat(i)
                context.stroke(
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: size.width, y: y))
                    },
                    with: .color(gridColor),
                    lineWidth: 0.5
                )
            }
        }
    }
}

struct TimelineWaterfallChart: View {
    let processingData: [TokenProcessingSequence]
    @Binding var selectedSequence: String?
    @Binding var selectedStage: ProcessingStage?
    let showBottlenecks: Bool
    let animateChart: Bool
    let geometry: GeometryProxy
    
    var body: some View {
        Chart {
            ForEach(processingData, id: \.id) { sequence in
                ForEach(sequence.stages, id: \.stage) { stageData in
                    RectangleMark(
                        xStart: .value("Start", stageData.startTime),
                        xEnd: .value("End", stageData.endTime),
                        y: .value("Stage", stageData.stage.rawValue),
                        height: .value("Height", 0.8)
                    )
                    .foregroundStyle(stageData.stage.color.opacity(0.8))
                    .opacity(selectedSequence == nil || selectedSequence == sequence.id ? 1.0 : 0.3)
                }
            }
        }
        .chartXScale(domain: .automatic)
        .chartYScale(type: .band)
        .frame(width: geometry.size.width, height: geometry.size.height)
        .animation(animateChart ? .easeInOut(duration: 0.5) : .none, value: processingData)
        .onTapGesture { location in
            // Handle tap to select sequence/stage
            if let tappedSequence = findSequence(at: location) {
                selectedSequence = selectedSequence == tappedSequence.id ? nil : tappedSequence.id
            }
        }
    }
    
    private func findSequence(at location: CGPoint) -> TokenProcessingSequence? {
        // Simplified tap detection - would need more sophisticated logic
        return processingData.first
    }
}

struct GanttWaterfallChart: View {
    let processingData: [TokenProcessingSequence]
    @Binding var selectedSequence: String?
    @Binding var selectedStage: ProcessingStage?
    let geometry: GeometryProxy
    
    var body: some View {
        Chart {
            ForEach(processingData, id: \.id) { sequence in
                ForEach(sequence.stages, id: \.stage) { stageData in
                    BarMark(
                        x: .value("Duration", stageData.duration),
                        y: .value("Sequence", sequence.id),
                        stacking: .center
                    )
                    .foregroundStyle(stageData.stage.color)
                    .opacity(selectedSequence == nil || selectedSequence == sequence.id ? 1.0 : 0.3)
                }
            }
        }
        .frame(width: geometry.size.width, height: geometry.size.height)
    }
}

struct FlowWaterfallChart: View {
    let processingData: [TokenProcessingSequence]
    @Binding var selectedSequence: String?
    @Binding var selectedStage: ProcessingStage?
    let geometry: GeometryProxy
    
    var body: some View {
        // Flow visualization showing data movement between stages
        Canvas { context, size in
            // Draw flow connections between stages
            for sequence in processingData {
                for (index, stage) in sequence.stages.enumerated() {
                    if index < sequence.stages.count - 1 {
                        let nextStage = sequence.stages[index + 1]
                        
                        // Draw flow arrow from current stage to next
                        let fromPoint = CGPoint(
                            x: size.width * 0.1 + CGFloat(index) * (size.width * 0.8 / CGFloat(sequence.stages.count)),
                            y: size.height * 0.5
                        )
                        let toPoint = CGPoint(
                            x: size.width * 0.1 + CGFloat(index + 1) * (size.width * 0.8 / CGFloat(sequence.stages.count)),
                            y: size.height * 0.5
                        )
                        
                        // Draw arrow
                        context.stroke(
                            Path { path in
                                path.move(to: fromPoint)
                                path.addLine(to: toPoint)
                            },
                            with: .color(stage.stage.color),
                            style: StrokeStyle(lineWidth: 3, lineCap: .round)
                        )
                        
                        // Draw stage circles
                        context.fill(
                            Path(ellipseIn: CGRect(
                                x: fromPoint.x - 15,
                                y: fromPoint.y - 15,
                                width: 30,
                                height: 30
                            )),
                            with: .color(stage.stage.color)
                        )
                    }
                }
            }
        }
        .frame(width: geometry.size.width, height: geometry.size.height)
    }
}

struct BottleneckOverlay: View {
    let bottlenecks: [ProcessingBottleneck]
    let geometry: GeometryProxy
    
    var body: some View {
        ForEach(bottlenecks, id: \.id) { bottleneck in
            BottleneckIndicator(bottleneck: bottleneck)
                .position(
                    x: geometry.size.width * bottleneck.relativePosition.x,
                    y: geometry.size.height * bottleneck.relativePosition.y
                )
        }
    }
}

struct BottleneckIndicator: View {
    let bottleneck: ProcessingBottleneck
    
    var body: some View {
        ZStack {
            Circle()
                .fill(Color.red.opacity(0.2))
                .frame(width: 30, height: 30)
            
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 14))
                .foregroundColor(.red)
        }
        .overlay(
            Text("\(String(format: "%.1f", bottleneck.severity * 100))%")
                .font(.caption2)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.red)
                .cornerRadius(4)
                .offset(y: -20)
        )
    }
}

// MARK: - Timeline Scrubber

struct TimelineScrubber: View {
    let timeRange: WaterfallTimeRange
    @Binding var selectedTime: String?
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(spacing: 4) {
            // Time markers
            HStack {
                ForEach(timeMarkers, id: \.self) { marker in
                    VStack(spacing: 2) {
                        Text(marker)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        Rectangle()
                            .fill(Color.secondary)
                            .frame(width: 1, height: 8)
                    }
                    
                    if marker != timeMarkers.last {
                        Spacer()
                    }
                }
            }
            
            // Scrubber bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background track
                    Rectangle()
                        .fill(Color.secondary.opacity(0.3))
                        .frame(height: 4)
                        .cornerRadius(2)
                    
                    // Progress track
                    Rectangle()
                        .fill(Color.accentColor)
                        .frame(width: currentProgress * geometry.size.width, height: 4)
                        .cornerRadius(2)
                    
                    // Current position indicator
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 12, height: 12)
                        .offset(x: currentProgress * geometry.size.width - 6)
                }
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            let progress = max(0, min(1, value.location.x / geometry.size.width))
                            updateSelectedTime(for: progress)
                        }
                )
            }
            .frame(height: 12)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor))
    }
    
    private var timeMarkers: [String] {
        // Generate time markers based on the current time range
        switch timeRange {
        case .last50Tokens:
            return Array(stride(from: 0, through: 50, by: 10)).map { "\($0)" }
        case .last100Tokens:
            return Array(stride(from: 0, through: 100, by: 20)).map { "\($0)" }
        case .last500Tokens:
            return Array(stride(from: 0, through: 500, by: 100)).map { "\($0)" }
        case .last1000Tokens:
            return Array(stride(from: 0, through: 1000, by: 200)).map { "\($0)" }
        case .currentSession:
            return ["Start", "25%", "50%", "75%", "Now"]
        }
    }
    
    private var currentProgress: CGFloat {
        // Calculate current progress based on selected time
        0.5 // Placeholder
    }
    
    private func updateSelectedTime(for progress: Double) {
        // Update selected time based on scrubber position
        // Implementation would depend on actual data structure
    }
}

// MARK: - Stage Details Panel

struct StageDetailsPanel: View {
    @Binding var selectedStage: ProcessingStage?
    let selectedSequence: String?
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                if let stage = selectedStage {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: stage.icon)
                                .font(.title2)
                                .foregroundColor(stage.color)
                            
                            Text(stage.rawValue)
                                .font(.headline)
                                .fontWeight(.semibold)
                        }
                        
                        if let sequence = selectedSequence {
                            Text("Sequence: \(sequence)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                Spacer()
                
                Button(action: { selectedStage = nil }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .medium))
                }
                .buttonStyle(.borderless)
            }
            
            if let stage = selectedStage {
                // Stage metrics
                StageMetrics(
                    stage: stage,
                    sequence: selectedSequence,
                    metricsService: metricsService
                )
                
                // Performance chart
                StagePerformanceChart(
                    stage: stage,
                    metricsService: metricsService
                )
                
                // Optimization suggestions
                StageOptimizationSuggestions(
                    stage: stage,
                    metricsService: metricsService
                )
            }
            
            Spacer()
        }
        .padding()
    }
}

struct StageMetrics: View {
    let stage: ProcessingStage
    let sequence: String?
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Performance Metrics")
                .font(.subheadline)
                .fontWeight(.medium)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                MetricItem(
                    title: "Duration",
                    value: "\(String(format: "%.1f", stageMetrics.averageDuration))ms",
                    trend: stageMetrics.durationTrend
                )
                
                MetricItem(
                    title: "Memory",
                    value: formatBytes(stageMetrics.memoryUsage),
                    trend: stageMetrics.memoryTrend
                )
                
                MetricItem(
                    title: "Throughput",
                    value: "\(stageMetrics.throughput) tok/s",
                    trend: stageMetrics.throughputTrend
                )
                
                MetricItem(
                    title: "Efficiency",
                    value: "\(String(format: "%.1f", stageMetrics.efficiency * 100))%",
                    trend: stageMetrics.efficiencyTrend
                )
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
    
    private var stageMetrics: StagePerformanceMetrics {
        metricsService.getStageMetrics(for: stage, sequence: sequence)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct MetricItem: View {
    let title: String
    let value: String
    let trend: TrendDirection
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                TrendIndicator(trend: trend)
            }
            
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
    }
}

struct StagePerformanceChart: View {
    let stage: ProcessingStage
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Performance History")
                .font(.subheadline)
                .fontWeight(.medium)
            
            Chart(performanceHistory) { point in
                LineMark(
                    x: .value("Time", point.timestamp),
                    y: .value("Duration", point.duration)
                )
                .foregroundStyle(stage.color)
                .lineStyle(StrokeStyle(lineWidth: 2))
                
                AreaMark(
                    x: .value("Time", point.timestamp),
                    y: .value("Duration", point.duration)
                )
                .foregroundStyle(stage.color.opacity(0.2))
            }
            .frame(height: 100)
            .chartXAxis(.hidden)
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
    
    private var performanceHistory: [StagePerformancePoint] {
        metricsService.getStagePerformanceHistory(for: stage)
    }
}

struct StageOptimizationSuggestions: View {
    let stage: ProcessingStage
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Optimization Suggestions")
                .font(.subheadline)
                .fontWeight(.medium)
            
            if optimizationSuggestions.isEmpty {
                Text("No optimization suggestions available")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 8)
            } else {
                ForEach(optimizationSuggestions, id: \.id) { suggestion in
                    OptimizationSuggestionRow(suggestion: suggestion)
                }
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
    
    private var optimizationSuggestions: [OptimizationSuggestion] {
        metricsService.getOptimizationSuggestions(for: stage)
    }
}

struct OptimizationSuggestionRow: View {
    let suggestion: OptimizationSuggestion
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: suggestion.type.icon)
                .font(.caption)
                .foregroundColor(suggestion.type.color)
                .frame(width: 16)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(suggestion.title)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(suggestion.description)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
            
            Text("+\(String(format: "%.0f", suggestion.expectedImprovement * 100))%")
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundColor(.green)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(6)
    }
}

// MARK: - Status Bar

struct WaterfallStatusBar: View {
    let selectedSequence: String?
    let selectedStage: ProcessingStage?
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 16) {
            // Current status
            if let sequence = selectedSequence {
                Text("Selected: \(sequence)")
                    .font(.caption)
                    .foregroundColor(.primary)
            }
            
            if let stage = selectedStage {
                Text("Stage: \(stage.rawValue)")
                    .font(.caption)
                    .foregroundColor(.primary)
            }
            
            if selectedSequence == nil && selectedStage == nil {
                Text("Click on chart elements to view details")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Performance indicators
            HStack(spacing: 12) {
                StatusIndicator(
                    title: "Processing",
                    value: "\(metricsService.activeProcessingCount)",
                    color: .blue
                )
                
                StatusIndicator(
                    title: "Queue",
                    value: "\(metricsService.queuedTokenCount)",
                    color: .orange
                )
                
                StatusIndicator(
                    title: "Completed",
                    value: "\(metricsService.completedTokenCount)",
                    color: .green
                )
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

struct StatusIndicator: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            
            Text("\(title): \(value)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    TokenProcessingWaterfall(metricsService: PerformanceMetricsService())
        .frame(width: 1200, height: 800)
}