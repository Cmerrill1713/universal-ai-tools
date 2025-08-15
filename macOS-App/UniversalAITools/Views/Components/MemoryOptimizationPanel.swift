import SwiftUI
import Charts

/// **Memory Optimization Panel**
/// 
/// Advanced memory usage and optimization interface that provides comprehensive
/// insights into flash attention memory optimizations. Features:
/// - Real-time memory pressure indicators with alerts
/// - Memory allocation patterns with optimization suggestions
/// - Cache hit/miss ratios with efficiency recommendations
/// - Memory leak detection and cleanup suggestions
/// - Flash attention memory savings visualization
/// - System resource usage monitoring

struct MemoryOptimizationPanel: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    @State private var selectedMemoryView: MemoryViewType = .overview
    @State private var memoryTimeRange: MemoryTimeRange = .last1Hour
    @State private var showOptimizationRecommendations = false
    @State private var showMemoryLeaks = false
    @State private var enableMemoryAlerts = true
    @State private var selectedMemorySegment: MemorySegment? = nil
    @State private var autoOptimizeMemory = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Memory Panel Controls
            MemoryOptimizationControls(
                selectedView: $selectedMemoryView,
                timeRange: $memoryTimeRange,
                showOptimizations: $showOptimizationRecommendations,
                showLeaks: $showMemoryLeaks,
                enableAlerts: $enableMemoryAlerts,
                autoOptimize: $autoOptimizeMemory,
                metricsService: metricsService
            )
            
            Divider()
            
            // Main Content Area
            HStack(spacing: 0) {
                // Memory Visualization Area
                VStack(spacing: 0) {
                    // Memory Status Header
                    MemoryStatusHeader(
                        selectedView: selectedMemoryView,
                        timeRange: memoryTimeRange,
                        metricsService: metricsService
                    )
                    
                    // Main Memory Content
                    TabView(selection: $selectedMemoryView) {
                        MemoryOverviewTab(
                            timeRange: memoryTimeRange,
                            selectedSegment: $selectedMemorySegment,
                            metricsService: metricsService
                        )
                        .tag(MemoryViewType.overview)
                        
                        MemoryAllocationTab(
                            timeRange: memoryTimeRange,
                            selectedSegment: $selectedMemorySegment,
                            metricsService: metricsService
                        )
                        .tag(MemoryViewType.allocation)
                        
                        CachePerformanceTab(
                            timeRange: memoryTimeRange,
                            metricsService: metricsService
                        )
                        .tag(MemoryViewType.cache)
                        
                        FlashAttentionMemoryTab(
                            timeRange: memoryTimeRange,
                            metricsService: metricsService
                        )
                        .tag(MemoryViewType.flashAttention)
                        
                        MemoryLeaksTab(
                            timeRange: memoryTimeRange,
                            metricsService: metricsService
                        )
                        .tag(MemoryViewType.leaks)
                        
                        SystemResourcesTab(
                            timeRange: memoryTimeRange,
                            metricsService: metricsService
                        )
                        .tag(MemoryViewType.system)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    
                    // Memory pressure indicator
                    MemoryPressureIndicator(metricsService: metricsService)
                }
                
                // Optimization Panel (if enabled)
                if showOptimizationRecommendations || selectedMemorySegment != nil {
                    MemoryOptimizationSidePanel(
                        selectedSegment: $selectedMemorySegment,
                        showOptimizations: $showOptimizationRecommendations,
                        enableAlerts: enableMemoryAlerts,
                        autoOptimize: autoOptimizeMemory,
                        metricsService: metricsService
                    )
                    .frame(width: 320)
                    .background(Color(NSColor.controlBackgroundColor))
                }
            }
        }
        .onAppear {
            Task {
                await metricsService.loadMemoryOptimizationData(timeRange: memoryTimeRange)
            }
        }
        .onChange(of: memoryTimeRange) { _ in
            Task {
                await metricsService.loadMemoryOptimizationData(timeRange: memoryTimeRange)
            }
        }
    }
}

// MARK: - Enums and Types

enum MemoryViewType: String, CaseIterable {
    case overview = "Overview"
    case allocation = "Allocation"
    case cache = "Cache"
    case flashAttention = "Flash Attention"
    case leaks = "Leaks"
    case system = "System"
    
    var icon: String {
        switch self {
        case .overview: return "chart.pie"
        case .allocation: return "square.stack.3d.up"
        case .cache: return "externaldrive.connected.to.line.below"
        case .flashAttention: return "brain.head.profile"
        case .leaks: return "drop"
        case .system: return "cpu"
        }
    }
    
    var description: String {
        switch self {
        case .overview: return "Memory usage overview"
        case .allocation: return "Memory allocation patterns"
        case .cache: return "Cache performance metrics"
        case .flashAttention: return "Flash attention optimizations"
        case .leaks: return "Memory leak detection"
        case .system: return "System resource monitoring"
        }
    }
}

enum MemoryTimeRange: String, CaseIterable {
    case last15Min = "15m"
    case last1Hour = "1h"
    case last6Hours = "6h"
    case last24Hours = "24h"
    case last7Days = "7d"
    
    var displayName: String {
        switch self {
        case .last15Min: return "Last 15 minutes"
        case .last1Hour: return "Last hour"
        case .last6Hours: return "Last 6 hours"
        case .last24Hours: return "Last 24 hours"
        case .last7Days: return "Last 7 days"
        }
    }
    
    var seconds: TimeInterval {
        switch self {
        case .last15Min: return 15 * 60
        case .last1Hour: return 60 * 60
        case .last6Hours: return 6 * 60 * 60
        case .last24Hours: return 24 * 60 * 60
        case .last7Days: return 7 * 24 * 60 * 60
        }
    }
}

// MARK: - Memory Optimization Controls

struct MemoryOptimizationControls: View {
    @Binding var selectedView: MemoryViewType
    @Binding var timeRange: MemoryTimeRange
    @Binding var showOptimizations: Bool
    @Binding var showLeaks: Bool
    @Binding var enableAlerts: Bool
    @Binding var autoOptimize: Bool
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 16) {
            // View selector
            VStack(alignment: .leading, spacing: 4) {
                Text("View")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Memory View", selection: $selectedView) {
                    ForEach(MemoryViewType.allCases, id: \.self) { view in
                        Label(view.rawValue, systemImage: view.icon).tag(view)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 140)
            }
            
            // Time range selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Time Range")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Time Range", selection: $timeRange) {
                    ForEach(MemoryTimeRange.allCases, id: \.self) { range in
                        Text(range.displayName).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 220)
            }
            
            Divider()
                .frame(height: 30)
            
            // Memory options
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    Toggle("Show Optimizations", isOn: $showOptimizations)
                        .font(.caption)
                    
                    Toggle("Show Leaks", isOn: $showLeaks)
                        .font(.caption)
                }
                
                HStack(spacing: 12) {
                    Toggle("Memory Alerts", isOn: $enableAlerts)
                        .font(.caption)
                    
                    Toggle("Auto-optimize", isOn: $autoOptimize)
                        .font(.caption)
                }
            }
            
            Spacer()
            
            // Current memory stats
            VStack(alignment: .trailing, spacing: 2) {
                Text("Current Usage")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(formatBytes(metricsService.currentMemoryUsage))
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(memoryUsageColor)
            }
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("Flash Savings")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text("\(String(format: "%.1f", metricsService.flashAttentionSavings * 100))%")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.green)
            }
            
            // Actions
            HStack(spacing: 8) {
                Button(action: {
                    Task { await metricsService.runMemoryGarbageCollection() }
                }) {
                    Image(systemName: "trash")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
                
                Button(action: {
                    Task { await metricsService.refreshMemoryData() }
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
                .disabled(metricsService.isLoadingMemoryData)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(NSColor.controlBackgroundColor))
    }
    
    private var memoryUsageColor: Color {
        let pressure = metricsService.memoryPressureLevel
        switch pressure {
        case .normal: return .green
        case .warning: return .orange
        case .critical: return .red
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Memory Status Header

struct MemoryStatusHeader: View {
    let selectedView: MemoryViewType
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(spacing: 12) {
            // View title and description
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Image(systemName: selectedView.icon)
                            .font(.title2)
                            .foregroundColor(.blue)
                        
                        Text(selectedView.rawValue)
                            .font(.title2)
                            .fontWeight(.semibold)
                    }
                    
                    Text(selectedView.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                // Real-time memory metrics
                MemoryMetricsSummary(metricsService: metricsService)
            }
            
            // Memory pressure warning (if applicable)
            if metricsService.memoryPressureLevel != .normal {
                MemoryPressureWarning(
                    level: metricsService.memoryPressureLevel,
                    metricsService: metricsService
                )
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

struct MemoryMetricsSummary: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 20) {
            // Total usage
            VStack(alignment: .trailing, spacing: 2) {
                Text("Total")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(formatBytes(metricsService.totalMemoryUsage))
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }
            
            // Available
            VStack(alignment: .trailing, spacing: 2) {
                Text("Available")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(formatBytes(metricsService.availableMemory))
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.green)
            }
            
            // Pressure
            VStack(alignment: .trailing, spacing: 2) {
                Text("Pressure")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(metricsService.memoryPressureLevel.displayName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(metricsService.memoryPressureLevel.color)
            }
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct MemoryPressureWarning: View {
    let level: MemoryPressureLevel
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: level.icon)
                .font(.title3)
                .foregroundColor(level.color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Memory Pressure: \(level.displayName)")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(level.color)
                
                Text(level.recommendation)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
            
            Button("Optimize Now") {
                Task { await metricsService.runMemoryOptimization() }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding()
        .background(level.color.opacity(0.1))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(level.color.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Memory Overview Tab

struct MemoryOverviewTab: View {
    let timeRange: MemoryTimeRange
    @Binding var selectedSegment: MemorySegment?
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Memory usage breakdown pie chart
                VStack(alignment: .leading, spacing: 16) {
                    Text("Memory Usage Breakdown")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    HStack(spacing: 20) {
                        // Pie chart
                        Chart(memoryBreakdown, id: \.type) { segment in
                            SectorMark(
                                angle: .value("Usage", segment.usage),
                                innerRadius: .ratio(0.5),
                                angularInset: 2
                            )
                            .foregroundStyle(segment.color)
                            .opacity(selectedSegment?.type == segment.type ? 1.0 : 0.8)
                        }
                        .frame(width: 200, height: 200)
                        .chartAngleSelection(value: .constant(nil))
                        .onTapGesture { location in
                            // Handle segment selection
                        }
                        
                        // Legend and details
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(memoryBreakdown, id: \.type) { segment in
                                MemorySegmentRow(
                                    segment: segment,
                                    isSelected: selectedSegment?.type == segment.type,
                                    onSelect: { selectedSegment = segment }
                                )
                            }
                        }
                    }
                }
                .padding()
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(12)
                
                // Memory usage over time
                VStack(alignment: .leading, spacing: 16) {
                    Text("Memory Usage Over Time")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Chart(memoryHistory) { point in
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Usage", point.totalUsage)
                        )
                        .foregroundStyle(.blue)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        
                        AreaMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Usage", point.totalUsage)
                        )
                        .foregroundStyle(.blue.opacity(0.2))
                        
                        // Flash attention savings
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Without Flash", point.usageWithoutFlash)
                        )
                        .foregroundStyle(.red.opacity(0.6))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
                    }
                    .frame(height: 150)
                    .chartXAxis {
                        AxisMarks(values: .automatic) { _ in
                            AxisGridLine()
                            AxisTick()
                            AxisValueLabel(format: .dateTime.hour().minute())
                        }
                    }
                    .chartYAxis {
                        AxisMarks(values: .automatic) { value in
                            AxisGridLine()
                            AxisTick()
                            AxisValueLabel {
                                if let bytes = value.as(Int64.self) {
                                    Text(formatBytes(bytes))
                                }
                            }
                        }
                    }
                }
                .padding()
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(12)
                
                // Memory efficiency metrics
                MemoryEfficiencyMetrics(
                    timeRange: timeRange,
                    metricsService: metricsService
                )
            }
            .padding(20)
        }
    }
    
    private var memoryBreakdown: [MemorySegment] {
        metricsService.getMemoryBreakdown()
    }
    
    private var memoryHistory: [MemoryUsagePoint] {
        metricsService.getMemoryHistory(for: timeRange)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct MemorySegmentRow: View {
    let segment: MemorySegment
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Circle()
                    .fill(segment.color)
                    .frame(width: 12, height: 12)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(segment.type.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                    
                    Text(formatBytes(segment.usage))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Text("\(String(format: "%.1f", segment.percentage))%")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(segment.color)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.accentColor.opacity(0.1) : Color.clear)
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Memory Allocation Tab

struct MemoryAllocationTab: View {
    let timeRange: MemoryTimeRange
    @Binding var selectedSegment: MemorySegment?
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Allocation patterns
                AllocationPatternsChart(
                    timeRange: timeRange,
                    metricsService: metricsService
                )
                
                // Memory pools
                MemoryPoolsVisualization(
                    selectedSegment: $selectedSegment,
                    metricsService: metricsService
                )
                
                // Allocation hotspots
                AllocationHotspotsView(
                    timeRange: timeRange,
                    metricsService: metricsService
                )
            }
            .padding(20)
        }
    }
}

struct AllocationPatternsChart: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Memory Allocation Patterns")
                .font(.headline)
                .fontWeight(.semibold)
            
            Chart(allocationData) { allocation in
                BarMark(
                    x: .value("Type", allocation.type.displayName),
                    y: .value("Allocations", allocation.count)
                )
                .foregroundStyle(allocation.type.color)
                
                LineMark(
                    x: .value("Type", allocation.type.displayName),
                    y: .value("Average Size", allocation.averageSize / 1024) // Convert to KB for scale
                )
                .foregroundStyle(.red)
                .lineStyle(StrokeStyle(lineWidth: 2))
            }
            .frame(height: 200)
            .chartForegroundStyleScale([
                "Allocations": .blue,
                "Average Size": .red
            ])
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var allocationData: [AllocationPattern] {
        metricsService.getAllocationPatterns(for: timeRange)
    }
}

struct MemoryPoolsVisualization: View {
    @Binding var selectedSegment: MemorySegment?
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Memory Pools")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 2), spacing: 12) {
                ForEach(memoryPools, id: \.id) { pool in
                    MemoryPoolCard(
                        pool: pool,
                        onSelect: { selectedSegment = pool.segment }
                    )
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var memoryPools: [MemoryPool] {
        metricsService.getMemoryPools()
    }
}

struct MemoryPoolCard: View {
    let pool: MemoryPool
    let onSelect: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Pool header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pool.name)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    
                    Text(pool.type.displayName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Circle()
                    .fill(pool.healthStatus.color)
                    .frame(width: 8, height: 8)
            }
            
            // Usage bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Usage")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text("\(String(format: "%.1f", pool.utilizationPercentage))%")
                        .font(.caption2)
                        .fontWeight(.semibold)
                }
                
                ProgressView(value: pool.utilizationPercentage / 100.0)
                    .progressViewStyle(LinearProgressViewStyle(tint: pool.healthColor))
            }
            
            // Pool stats
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Allocated")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Text(formatBytes(pool.allocatedSize))
                        .font(.caption)
                        .fontWeight(.medium)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Total")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Text(formatBytes(pool.totalSize))
                        .font(.caption)
                        .fontWeight(.medium)
                }
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
        .onTapGesture {
            onSelect()
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct AllocationHotspotsView: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Allocation Hotspots")
                .font(.headline)
                .fontWeight(.semibold)
            
            if allocationHotspots.isEmpty {
                Text("No allocation hotspots detected")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                ForEach(allocationHotspots, id: \.id) { hotspot in
                    AllocationHotspotRow(hotspot: hotspot)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var allocationHotspots: [AllocationHotspot] {
        metricsService.getAllocationHotspots(for: timeRange)
    }
}

struct AllocationHotspotRow: View {
    let hotspot: AllocationHotspot
    
    var body: some View {
        HStack(spacing: 12) {
            // Severity indicator
            Circle()
                .fill(hotspot.severity.color)
                .frame(width: 12, height: 12)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(hotspot.location)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text("\(hotspot.allocationCount) allocs")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Text(hotspot.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                HStack {
                    Text("Total: \(formatBytes(hotspot.totalSize))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text("Avg: \(formatBytes(hotspot.averageSize))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Cache Performance Tab

struct CachePerformanceTab: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Cache hit/miss ratios
                CacheHitRatioChart(
                    timeRange: timeRange,
                    metricsService: metricsService
                )
                
                // Cache performance metrics
                CachePerformanceMetrics(
                    metricsService: metricsService
                )
                
                // Cache optimization suggestions
                CacheOptimizationSuggestions(
                    metricsService: metricsService
                )
            }
            .padding(20)
        }
    }
}

struct CacheHitRatioChart: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Cache Hit/Miss Ratios")
                .font(.headline)
                .fontWeight(.semibold)
            
            Chart(cacheData) { cache in
                BarMark(
                    x: .value("Cache", cache.name),
                    y: .value("Hit Rate", cache.hitRate),
                    stacking: .standard
                )
                .foregroundStyle(.green)
                
                BarMark(
                    x: .value("Cache", cache.name),
                    y: .value("Miss Rate", 1.0 - cache.hitRate),
                    stacking: .standard
                )
                .foregroundStyle(.red.opacity(0.6))
            }
            .frame(height: 200)
            .chartYScale(domain: 0...1)
            .chartYAxis {
                AxisMarks(values: .automatic) { value in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel {
                        if let rate = value.as(Double.self) {
                            Text("\(Int(rate * 100))%")
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var cacheData: [CacheMetrics] {
        metricsService.getCacheMetrics(for: timeRange)
    }
}

struct CachePerformanceMetrics: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Cache Performance")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 16) {
                CacheMetricCard(
                    title: "Overall Hit Rate",
                    value: String(format: "%.1f%%", metricsService.overallCacheHitRate * 100),
                    trend: metricsService.cacheHitRateTrend,
                    color: .green
                )
                
                CacheMetricCard(
                    title: "Cache Evictions",
                    value: "\(metricsService.cacheEvictions)",
                    trend: metricsService.cacheEvictionsTrend,
                    color: .orange
                )
                
                CacheMetricCard(
                    title: "Cache Size",
                    value: formatBytes(metricsService.totalCacheSize),
                    trend: metricsService.cacheSizeTrend,
                    color: .blue
                )
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct CacheMetricCard: View {
    let title: String
    let value: String
    let trend: TrendDirection
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                TrendIndicator(trend: trend)
            }
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(color)
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

struct CacheOptimizationSuggestions: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Cache Optimization Suggestions")
                .font(.headline)
                .fontWeight(.semibold)
            
            if cacheOptimizations.isEmpty {
                Text("No cache optimization suggestions available")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                ForEach(cacheOptimizations, id: \.id) { suggestion in
                    CacheOptimizationRow(suggestion: suggestion)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var cacheOptimizations: [CacheOptimizationSuggestion] {
        metricsService.getCacheOptimizationSuggestions()
    }
}

struct CacheOptimizationRow: View {
    let suggestion: CacheOptimizationSuggestion
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: suggestion.type.icon)
                .font(.title3)
                .foregroundColor(suggestion.type.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(suggestion.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(suggestion.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("Impact")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(suggestion.impact.displayName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(suggestion.impact.color)
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Flash Attention Memory Tab

struct FlashAttentionMemoryTab: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Flash attention savings
                FlashAttentionSavingsChart(
                    timeRange: timeRange,
                    metricsService: metricsService
                )
                
                // Memory optimization breakdown
                FlashAttentionOptimizationBreakdown(
                    metricsService: metricsService
                )
                
                // Optimization recommendations
                FlashAttentionRecommendations(
                    metricsService: metricsService
                )
            }
            .padding(20)
        }
    }
}

struct FlashAttentionSavingsChart: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Flash Attention Memory Savings")
                .font(.headline)
                .fontWeight(.semibold)
            
            Chart(savingsData) { point in
                LineMark(
                    x: .value("Time", point.timestamp),
                    y: .value("Standard Memory", point.standardMemory)
                )
                .foregroundStyle(.red)
                .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 5]))
                
                LineMark(
                    x: .value("Time", point.timestamp),
                    y: .value("Flash Attention", point.flashAttentionMemory)
                )
                .foregroundStyle(.green)
                .lineStyle(StrokeStyle(lineWidth: 2))
                
                AreaMark(
                    x: .value("Time", point.timestamp),
                    yStart: .value("Flash Memory", point.flashAttentionMemory),
                    yEnd: .value("Standard Memory", point.standardMemory)
                )
                .foregroundStyle(.green.opacity(0.2))
            }
            .frame(height: 200)
            .chartLegend(position: .top) {
                HStack {
                    Label("Standard Attention", systemImage: "line.diagonal")
                        .foregroundColor(.red)
                    
                    Spacer()
                    
                    Label("Flash Attention", systemImage: "line.diagonal")
                        .foregroundColor(.green)
                }
                .font(.caption)
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var savingsData: [FlashAttentionSavingsPoint] {
        metricsService.getFlashAttentionSavings(for: timeRange)
    }
}

struct FlashAttentionOptimizationBreakdown: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Optimization Breakdown")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                OptimizationMetricCard(
                    title: "Memory Saved",
                    value: formatBytes(metricsService.totalMemorySaved),
                    percentage: metricsService.memorySavingsPercentage,
                    color: .green
                )
                
                OptimizationMetricCard(
                    title: "Speed Improvement",
                    value: "\(String(format: "%.1f", metricsService.speedImprovement))x",
                    percentage: metricsService.speedImprovementPercentage,
                    color: .blue
                )
                
                OptimizationMetricCard(
                    title: "Attention Efficiency",
                    value: "\(String(format: "%.1f", metricsService.attentionEfficiency * 100))%",
                    percentage: metricsService.attentionEfficiencyImprovement,
                    color: .purple
                )
                
                OptimizationMetricCard(
                    title: "Power Savings",
                    value: "\(String(format: "%.1f", metricsService.powerSavings))W",
                    percentage: metricsService.powerSavingsPercentage,
                    color: .orange
                )
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct OptimizationMetricCard: View {
    let title: String
    let value: String
    let percentage: Double
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            HStack {
                Text("\(String(format: "%.1f", percentage))% improvement")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Image(systemName: "arrow.up")
                    .font(.caption2)
                    .foregroundColor(.green)
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

struct FlashAttentionRecommendations: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Flash Attention Recommendations")
                .font(.headline)
                .fontWeight(.semibold)
            
            if flashRecommendations.isEmpty {
                Text("No flash attention recommendations available")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                ForEach(flashRecommendations, id: \.id) { recommendation in
                    FlashAttentionRecommendationRow(recommendation: recommendation)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var flashRecommendations: [FlashAttentionRecommendation] {
        metricsService.getFlashAttentionRecommendations()
    }
}

struct FlashAttentionRecommendationRow: View {
    let recommendation: FlashAttentionRecommendation
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: recommendation.type.icon)
                .font(.title3)
                .foregroundColor(recommendation.type.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(recommendation.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(recommendation.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
                
                if !recommendation.implementationSteps.isEmpty {
                    Text("Steps: \(recommendation.implementationSteps.count)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("Savings")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text("\(String(format: "%.1f", recommendation.expectedSavings * 100))%")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.green)
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Memory Leaks Tab

struct MemoryLeaksTab: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Memory leak detection results
                MemoryLeakDetectionResults(
                    timeRange: timeRange,
                    metricsService: metricsService
                )
                
                // Leak trends
                MemoryLeakTrends(
                    timeRange: timeRange,
                    metricsService: metricsService
                )
                
                // Cleanup suggestions
                MemoryCleanupSuggestions(
                    metricsService: metricsService
                )
            }
            .padding(20)
        }
    }
}

struct MemoryLeakDetectionResults: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Memory Leak Detection")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                if metricsService.isRunningLeakDetection {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Button("Run Detection") {
                        Task { await metricsService.runMemoryLeakDetection() }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }
            }
            
            if detectedLeaks.isEmpty {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(.green)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("No Memory Leaks Detected")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        
                        Text("Memory usage appears stable")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color.green.opacity(0.1))
                .cornerRadius(8)
            } else {
                ForEach(detectedLeaks, id: \.id) { leak in
                    MemoryLeakRow(leak: leak)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var detectedLeaks: [MemoryLeak] {
        metricsService.getDetectedMemoryLeaks(for: timeRange)
    }
}

struct MemoryLeakRow: View {
    let leak: MemoryLeak
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: leak.severity.icon)
                .font(.title3)
                .foregroundColor(leak.severity.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(leak.location)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text(formatBytes(leak.leakedSize))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(leak.severity.color)
                }
                
                Text(leak.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
                
                HStack {
                    Text("Growth rate: \(formatBytes(leak.growthRate))/min")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text("First detected: \(leak.firstDetected.formatted(.relative(presentation: .named)))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct MemoryLeakTrends: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Memory Leak Trends")
                .font(.headline)
                .fontWeight(.semibold)
            
            Chart(leakTrends) { trend in
                LineMark(
                    x: .value("Time", trend.timestamp),
                    y: .value("Leaked Memory", trend.totalLeakedMemory)
                )
                .foregroundStyle(.red)
                .lineStyle(StrokeStyle(lineWidth: 2))
                
                AreaMark(
                    x: .value("Time", trend.timestamp),
                    y: .value("Leaked Memory", trend.totalLeakedMemory)
                )
                .foregroundStyle(.red.opacity(0.2))
            }
            .frame(height: 150)
            .chartXAxis {
                AxisMarks(values: .automatic) { _ in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel(format: .dateTime.hour().minute())
                }
            }
            .chartYAxis {
                AxisMarks(values: .automatic) { value in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel {
                        if let bytes = value.as(Int64.self) {
                            Text(formatBytes(bytes))
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var leakTrends: [MemoryLeakTrend] {
        metricsService.getMemoryLeakTrends(for: timeRange)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct MemoryCleanupSuggestions: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Memory Cleanup Suggestions")
                .font(.headline)
                .fontWeight(.semibold)
            
            if cleanupSuggestions.isEmpty {
                Text("No cleanup suggestions available")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                ForEach(cleanupSuggestions, id: \.id) { suggestion in
                    MemoryCleanupSuggestionRow(suggestion: suggestion)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var cleanupSuggestions: [MemoryCleanupSuggestion] {
        metricsService.getMemoryCleanupSuggestions()
    }
}

struct MemoryCleanupSuggestionRow: View {
    let suggestion: MemoryCleanupSuggestion
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: suggestion.type.icon)
                .font(.title3)
                .foregroundColor(suggestion.type.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(suggestion.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(suggestion.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text("Reclaim")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(formatBytes(suggestion.potentialSavings))
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.green)
                
                Button("Apply") {
                    Task { await metricsService.applyCleanupSuggestion(suggestion) }
                }
                .buttonStyle(.borderless)
                .controlSize(.mini)
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - System Resources Tab

struct SystemResourcesTab: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // System overview
                SystemResourcesOverview(metricsService: metricsService)
                
                // Resource usage charts
                SystemResourceCharts(
                    timeRange: timeRange,
                    metricsService: metricsService
                )
                
                // Resource recommendations
                SystemResourceRecommendations(metricsService: metricsService)
            }
            .padding(20)
        }
    }
}

struct SystemResourcesOverview: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("System Resources Overview")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 16) {
                SystemResourceCard(
                    title: "CPU Usage",
                    value: "\(String(format: "%.1f", metricsService.currentCPUUsage))%",
                    icon: "cpu",
                    color: .blue,
                    status: metricsService.cpuStatus
                )
                
                SystemResourceCard(
                    title: "Memory Usage",
                    value: "\(String(format: "%.1f", metricsService.memoryUsagePercentage))%",
                    icon: "memorychip",
                    color: .green,
                    status: metricsService.memoryStatus
                )
                
                SystemResourceCard(
                    title: "Disk I/O",
                    value: formatBytes(metricsService.diskIORate),
                    icon: "externaldrive",
                    color: .orange,
                    status: metricsService.diskIOStatus
                )
                
                SystemResourceCard(
                    title: "Network I/O",
                    value: formatBytes(metricsService.networkIORate),
                    icon: "network",
                    color: .purple,
                    status: metricsService.networkIOStatus
                )
                
                SystemResourceCard(
                    title: "GPU Usage",
                    value: "\(String(format: "%.1f", metricsService.gpuUsage))%",
                    icon: "externalgpu",
                    color: .red,
                    status: metricsService.gpuStatus
                )
                
                SystemResourceCard(
                    title: "Temperature",
                    value: "\(String(format: "%.1f", metricsService.systemTemperature))°C",
                    icon: "thermometer",
                    color: .mint,
                    status: metricsService.temperatureStatus
                )
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes) + "/s"
    }
}

struct SystemResourceCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    let status: ResourceStatus
    
    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                
                Spacer()
                
                Circle()
                    .fill(status.color)
                    .frame(width: 8, height: 8)
            }
            
            VStack(spacing: 4) {
                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(color)
                
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

struct SystemResourceCharts: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Resource Usage Over Time")
                .font(.headline)
                .fontWeight(.semibold)
            
            Chart(systemResourceHistory) { point in
                LineMark(
                    x: .value("Time", point.timestamp),
                    y: .value("CPU", point.cpuUsage)
                )
                .foregroundStyle(.blue)
                .lineStyle(StrokeStyle(lineWidth: 2))
                
                LineMark(
                    x: .value("Time", point.timestamp),
                    y: .value("Memory", point.memoryUsage)
                )
                .foregroundStyle(.green)
                .lineStyle(StrokeStyle(lineWidth: 2))
                
                LineMark(
                    x: .value("Time", point.timestamp),
                    y: .value("GPU", point.gpuUsage)
                )
                .foregroundStyle(.red)
                .lineStyle(StrokeStyle(lineWidth: 2))
            }
            .frame(height: 200)
            .chartYScale(domain: 0...100)
            .chartLegend(position: .top) {
                HStack {
                    Label("CPU", systemImage: "line.diagonal")
                        .foregroundColor(.blue)
                    
                    Label("Memory", systemImage: "line.diagonal")
                        .foregroundColor(.green)
                    
                    Label("GPU", systemImage: "line.diagonal")
                        .foregroundColor(.red)
                }
                .font(.caption)
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var systemResourceHistory: [SystemResourcePoint] {
        metricsService.getSystemResourceHistory(for: timeRange)
    }
}

struct SystemResourceRecommendations: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("System Optimization Recommendations")
                .font(.headline)
                .fontWeight(.semibold)
            
            if systemRecommendations.isEmpty {
                Text("No system optimization recommendations available")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 20)
            } else {
                ForEach(systemRecommendations, id: \.id) { recommendation in
                    SystemRecommendationRow(recommendation: recommendation)
                }
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
    
    private var systemRecommendations: [SystemOptimizationRecommendation] {
        metricsService.getSystemOptimizationRecommendations()
    }
}

struct SystemRecommendationRow: View {
    let recommendation: SystemOptimizationRecommendation
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: recommendation.type.icon)
                .font(.title3)
                .foregroundColor(recommendation.type.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(recommendation.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(recommendation.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("Priority")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text(recommendation.priority.displayName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(recommendation.priority.color)
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

// MARK: - Memory Pressure Indicator

struct MemoryPressureIndicator: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack {
            // Pressure level indicator
            HStack(spacing: 8) {
                Circle()
                    .fill(metricsService.memoryPressureLevel.color)
                    .frame(width: 8, height: 8)
                
                Text("Memory Pressure: \(metricsService.memoryPressureLevel.displayName)")
                    .font(.caption)
                    .fontWeight(.medium)
            }
            
            Spacer()
            
            // Quick actions
            HStack(spacing: 8) {
                if metricsService.memoryPressureLevel != .normal {
                    Button("Optimize") {
                        Task { await metricsService.runMemoryOptimization() }
                    }
                    .buttonStyle(.borderless)
                    .controlSize(.small)
                }
                
                Button("GC") {
                    Task { await metricsService.runMemoryGarbageCollection() }
                }
                .buttonStyle(.borderless)
                .controlSize(.small)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

// MARK: - Memory Optimization Side Panel

struct MemoryOptimizationSidePanel: View {
    @Binding var selectedSegment: MemorySegment?
    @Binding var showOptimizations: Bool
    let enableAlerts: Bool
    let autoOptimize: Bool
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Panel header
            HStack {
                Text(selectedSegment != nil ? "Segment Details" : "Memory Optimization")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: {
                    selectedSegment = nil
                    showOptimizations = false
                }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .medium))
                }
                .buttonStyle(.borderless)
            }
            
            if let segment = selectedSegment {
                // Memory segment details
                MemorySegmentDetails(
                    segment: segment,
                    metricsService: metricsService
                )
            } else if showOptimizations {
                // Optimization recommendations
                MemoryOptimizationRecommendations(
                    enableAlerts: enableAlerts,
                    autoOptimize: autoOptimize,
                    metricsService: metricsService
                )
            }
            
            Spacer()
        }
        .padding()
    }
}

struct MemorySegmentDetails: View {
    let segment: MemorySegment
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Segment overview
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Circle()
                        .fill(segment.color)
                        .frame(width: 12, height: 12)
                    
                    Text(segment.type.displayName)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                
                Text(formatBytes(segment.usage))
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(segment.color)
                
                Text("\(String(format: "%.1f", segment.percentage))% of total memory")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(NSColor.textBackgroundColor))
            .cornerRadius(8)
            
            // Segment-specific metrics
            if let metrics = metricsService.getSegmentMetrics(for: segment) {
                SegmentMetricsView(metrics: metrics)
            }
            
            // Optimization suggestions for this segment
            if let suggestions = metricsService.getSegmentOptimizationSuggestions(for: segment), !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Optimization Suggestions")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    ForEach(suggestions, id: \.id) { suggestion in
                        OptimizationSuggestionCompactRow(suggestion: suggestion)
                    }
                }
            }
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct SegmentMetricsView: View {
    let metrics: MemorySegmentMetrics
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Detailed Metrics")
                .font(.subheadline)
                .fontWeight(.medium)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                SegmentMetricItem(title: "Allocations", value: "\(metrics.allocationCount)")
                SegmentMetricItem(title: "Deallocations", value: "\(metrics.deallocationCount)")
                SegmentMetricItem(title: "Peak Usage", value: formatBytes(metrics.peakUsage))
                SegmentMetricItem(title: "Growth Rate", value: formatBytes(metrics.growthRate) + "/min")
            }
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct SegmentMetricItem: View {
    let title: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

struct MemoryOptimizationRecommendations: View {
    let enableAlerts: Bool
    let autoOptimize: Bool
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Quick optimization actions
            VStack(alignment: .leading, spacing: 12) {
                Text("Quick Actions")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                VStack(spacing: 8) {
                    OptimizationActionButton(
                        title: "Run Garbage Collection",
                        subtitle: "Clean up unused objects",
                        icon: "trash",
                        color: .orange,
                        action: { Task { await metricsService.runMemoryGarbageCollection() } }
                    )
                    
                    OptimizationActionButton(
                        title: "Optimize Flash Attention",
                        subtitle: "Reduce attention memory usage",
                        icon: "brain.head.profile",
                        color: .purple,
                        action: { Task { await metricsService.optimizeFlashAttention() } }
                    )
                    
                    OptimizationActionButton(
                        title: "Clear Caches",
                        subtitle: "Free up cached data",
                        icon: "externaldrive.connected.to.line.below",
                        color: .blue,
                        action: { Task { await metricsService.clearMemoryCaches() } }
                    )
                }
            }
            
            // Optimization recommendations
            VStack(alignment: .leading, spacing: 12) {
                Text("Recommendations")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                if optimizationRecommendations.isEmpty {
                    Text("No recommendations available")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.vertical, 8)
                } else {
                    ForEach(optimizationRecommendations, id: \.id) { recommendation in
                        OptimizationSuggestionCompactRow(suggestion: recommendation)
                    }
                }
            }
            
            // Auto-optimization status
            if autoOptimize {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Auto-Optimization")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                        
                        Text("Enabled - Memory will be optimized automatically")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color.green.opacity(0.1))
                .cornerRadius(8)
            }
        }
    }
    
    private var optimizationRecommendations: [OptimizationSuggestion] {
        metricsService.getMemoryOptimizationRecommendations()
    }
}

struct OptimizationActionButton: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
                    .frame(width: 24)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                    
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.textBackgroundColor))
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }
}

struct OptimizationSuggestionCompactRow: View {
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
                    .lineLimit(1)
                
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

// MARK: - Memory Efficiency Metrics

struct MemoryEfficiencyMetrics: View {
    let timeRange: MemoryTimeRange
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Memory Efficiency")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                EfficiencyMetricCard(
                    title: "Memory Efficiency",
                    value: String(format: "%.1f%%", metricsService.memoryEfficiency * 100),
                    trend: metricsService.memoryEfficiencyTrend,
                    color: .green
                )
                
                EfficiencyMetricCard(
                    title: "Allocation Efficiency",
                    value: String(format: "%.1f%%", metricsService.allocationEfficiency * 100),
                    trend: metricsService.allocationEfficiencyTrend,
                    color: .blue
                )
                
                EfficiencyMetricCard(
                    title: "Cache Efficiency",
                    value: String(format: "%.1f%%", metricsService.cacheEfficiency * 100),
                    trend: metricsService.cacheEfficiencyTrend,
                    color: .purple
                )
                
                EfficiencyMetricCard(
                    title: "Flash Attention Savings",
                    value: String(format: "%.1f%%", metricsService.flashAttentionSavings * 100),
                    trend: metricsService.flashAttentionSavingsTrend,
                    color: .orange
                )
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }
}

struct EfficiencyMetricCard: View {
    let title: String
    let value: String
    let trend: TrendDirection
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.leading)
                
                Spacer()
                
                TrendIndicator(trend: trend)
            }
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(color)
        }
        .padding()
        .background(Color(NSColor.textBackgroundColor))
        .cornerRadius(8)
    }
}

#Preview {
    MemoryOptimizationPanel(metricsService: PerformanceMetricsService())
        .frame(width: 1200, height: 800)
}