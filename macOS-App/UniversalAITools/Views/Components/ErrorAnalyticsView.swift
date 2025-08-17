import SwiftUI
import Charts
import Combine

/// Advanced Error Analytics and Reporting Interface
struct ErrorAnalyticsView: View {
    let errorHandler: ErrorHandler
    @State private var selectedTimeRange: TimeRange = .last24Hours
    @State private var selectedMetric: AnalyticsMetric = .errorCount
    @State private var showExportSheet = false
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Analytics header
                    analyticsHeader
                    
                    // Time range and metric selectors
                    controlsSection
                    
                    // Main analytics charts
                    chartsSection
                    
                    // Error breakdown
                    breakdownSection
                    
                    // Trends and insights
                    insightsSection
                    
                    // Recovery statistics
                    recoveryStatsSection
                }
                .padding()
            }
            .navigationTitle("Error Analytics")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                toolbarContent
            }
            .sheet(isPresented: $showExportSheet) {
                AnalyticsExportView(
                    errorHandler: errorHandler,
                    timeRange: selectedTimeRange
                )
            }
        }
        .frame(minWidth: 800, minHeight: 600)
    }
    
    // MARK: - Header
    
    private var analyticsHeader: some View {
        VStack(spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Error Analytics Dashboard")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("Comprehensive error tracking and system health insights")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                // System health indicator
                SystemHealthIndicator(status: errorHandler.systemStatus)
            }
            
            // Quick stats overview
            quickStatsGrid
        }
    }
    
    private var quickStatsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 16) {
            AnalyticsStatCard(
                title: "Total Errors",
                value: "\(errorHandler.errorStats.totalErrors)",
                trend: .neutral,
                icon: "exclamationmark.triangle"
            )
            
            AnalyticsStatCard(
                title: "Active Errors",
                value: "\(errorHandler.currentErrors.count)",
                trend: errorHandler.currentErrors.count > 5 ? .negative : .positive,
                icon: "clock"
            )
            
            AnalyticsStatCard(
                title: "Error Rate",
                value: String(format: "%.1f/min", errorHandler.errorStats.errorRate),
                trend: errorHandler.errorStats.errorRate > 2 ? .negative : .positive,
                icon: "speedometer"
            )
            
            AnalyticsStatCard(
                title: "Critical Errors",
                value: "\(errorHandler.errorStats.criticalErrorCount)",
                trend: errorHandler.errorStats.criticalErrorCount > 0 ? .negative : .positive,
                icon: "flame"
            )
        }
    }
    
    // MARK: - Controls
    
    private var controlsSection: some View {
        HStack {
            // Time range selector
            Menu {
                ForEach(TimeRange.allCases, id: \.self) { range in
                    Button(range.displayName) {
                        selectedTimeRange = range
                    }
                }
            } label: {
                HStack {
                    Text(selectedTimeRange.displayName)
                        .fontWeight(.medium)
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.quaternary)
                .cornerRadius(8)
            }
            .buttonStyle(.plain)
            
            Spacer()
            
            // Metric selector
            Picker("Metric", selection: $selectedMetric) {
                ForEach(AnalyticsMetric.allCases, id: \.self) { metric in
                    Text(metric.displayName).tag(metric)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 300)
        }
    }
    
    // MARK: - Charts
    
    private var chartsSection: some View {
        VStack(spacing: 20) {
            // Main time series chart
            errorTimeSeriesChart
            
            HStack(spacing: 20) {
                // Error severity distribution
                errorSeverityChart
                
                // Error category breakdown
                errorCategoryChart
            }
        }
    }
    
    private var errorTimeSeriesChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Error Trends Over Time")
                .font(.headline)
                .fontWeight(.semibold)
            
            Chart {
                ForEach(generateTimeSeriesData(), id: \.date) { dataPoint in
                    LineMark(
                        x: .value("Time", dataPoint.date),
                        y: .value("Count", dataPoint.count)
                    )
                    .foregroundStyle(.orange)
                    .symbol(.circle)
                    
                    AreaMark(
                        x: .value("Time", dataPoint.date),
                        y: .value("Count", dataPoint.count)
                    )
                    .foregroundStyle(.orange.opacity(0.1))
                }
            }
            .frame(height: 200)
            .chartXAxis {
                AxisMarks(preset: .aligned, position: .bottom)
            }
            .chartYAxis {
                AxisMarks(preset: .aligned, position: .leading)
            }
            .background(.ultraThinMaterial)
            .cornerRadius(12)
            .padding()
        }
    }
    
    private var errorSeverityChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Error Severity Distribution")
                .font(.headline)
                .fontWeight(.semibold)
            
            Chart {
                ForEach(ErrorSeverity.allCases, id: \.self) { severity in
                    let count = getErrorCount(for: severity)
                    
                    SectorMark(
                        angle: .value("Count", count),
                        innerRadius: .ratio(0.5),
                        angularInset: 2
                    )
                    .foregroundStyle(severity.color)
                    .opacity(count > 0 ? 1.0 : 0.3)
                }
            }
            .frame(height: 200)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
            .padding()
            
            // Legend
            VStack(alignment: .leading, spacing: 4) {
                ForEach(ErrorSeverity.allCases, id: \.self) { severity in
                    HStack {
                        Circle()
                            .fill(severity.color)
                            .frame(width: 8, height: 8)
                        
                        Text(severity.rawValue.capitalized)
                            .font(.caption)
                        
                        Spacer()
                        
                        Text("\(getErrorCount(for: severity))")
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                }
            }
            .padding(.horizontal)
        }
        .frame(maxWidth: .infinity)
    }
    
    private var errorCategoryChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Error Categories")
                .font(.headline)
                .fontWeight(.semibold)
            
            Chart {
                ForEach(ErrorCategory.allCases, id: \.self) { category in
                    let count = getErrorCount(for: category)
                    
                    BarMark(
                        x: .value("Category", category.rawValue.capitalized),
                        y: .value("Count", count)
                    )
                    .foregroundStyle(.blue)
                    .opacity(count > 0 ? 1.0 : 0.3)
                }
            }
            .frame(height: 200)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
            .padding()
        }
        .frame(maxWidth: .infinity)
    }
    
    // MARK: - Breakdown Section
    
    private var breakdownSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Detailed Breakdown")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                // Most frequent errors
                mostFrequentErrorsCard
                
                // Error patterns
                errorPatternsCard
                
                // Recovery success rates
                recoverySuccessCard
                
                // System impact analysis
                systemImpactCard
            }
        }
    }
    
    private var mostFrequentErrorsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Most Frequent Errors")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                let frequentErrors = getMostFrequentErrors()
                
                ForEach(frequentErrors.prefix(5), id: \.type) { errorInfo in
                    HStack {
                        Text(errorInfo.type.rawValue.capitalized)
                            .font(.caption)
                            .lineLimit(1)
                        
                        Spacer()
                        
                        Text("\(errorInfo.count)")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.secondary)
                    }
                }
                
                if frequentErrors.isEmpty {
                    Text("No frequent error patterns detected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var errorPatternsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Error Patterns")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 8) {
                PatternRow(
                    title: "Peak Error Time",
                    value: getPeakErrorTime(),
                    icon: "clock"
                )
                
                PatternRow(
                    title: "Most Affected Component",
                    value: getMostAffectedComponent(),
                    icon: "cpu"
                )
                
                PatternRow(
                    title: "Average Resolution Time",
                    value: getAverageResolutionTime(),
                    icon: "timer"
                )
                
                PatternRow(
                    title: "Error Correlation",
                    value: getErrorCorrelation(),
                    icon: "link"
                )
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var recoverySuccessCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recovery Success Rates")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                ForEach(RecoveryStrategy.allCases, id: \.self) { strategy in
                    let successRate = getRecoverySuccessRate(for: strategy)
                    
                    HStack {
                        Text(strategy.displayName)
                            .font(.caption)
                            .lineLimit(1)
                        
                        Spacer()
                        
                        ProgressView(value: successRate)
                            .frame(width: 60)
                        
                        Text("\(Int(successRate * 100))%")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.secondary)
                            .frame(width: 30, alignment: .trailing)
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var systemImpactCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("System Impact")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 8) {
                ImpactRow(
                    title: "Performance Impact",
                    severity: getPerformanceImpact(),
                    description: "Effect on system performance"
                )
                
                ImpactRow(
                    title: "User Experience Impact",
                    severity: getUserExperienceImpact(),
                    description: "Effect on user interactions"
                )
                
                ImpactRow(
                    title: "Data Integrity Impact",
                    severity: getDataIntegrityImpact(),
                    description: "Risk to data consistency"
                )
                
                ImpactRow(
                    title: "Service Availability",
                    severity: getServiceAvailabilityImpact(),
                    description: "Effect on service uptime"
                )
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Insights Section
    
    private var insightsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("AI-Powered Insights")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 1), spacing: 12) {
                ForEach(generateInsights(), id: \.id) { insight in
                    InsightCard(insight: insight)
                }
            }
        }
    }
    
    // MARK: - Recovery Stats
    
    private var recoveryStatsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Recovery Performance")
                .font(.headline)
                .fontWeight(.semibold)
            
            HStack(spacing: 20) {
                RecoveryMetricCard(
                    title: "Automatic Recovery Rate",
                    value: "85%",
                    trend: .positive,
                    description: "Errors resolved without user intervention"
                )
                
                RecoveryMetricCard(
                    title: "Average Recovery Time",
                    value: "2.3s",
                    trend: .positive,
                    description: "Time to resolve errors automatically"
                )
                
                RecoveryMetricCard(
                    title: "Manual Intervention Rate",
                    value: "15%",
                    trend: .neutral,
                    description: "Errors requiring user action"
                )
            }
        }
    }
    
    // MARK: - Toolbar
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button("Export Report") {
                showExportSheet = true
            }
            .buttonStyle(.bordered)
            
            Button("Close") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
        }
    }
    
    // MARK: - Data Generation
    
    private func generateTimeSeriesData() -> [TimeSeriesDataPoint] {
        let endDate = Date()
        let startDate = endDate.addingTimeInterval(-selectedTimeRange.timeInterval)
        let interval = selectedTimeRange.timeInterval / 20 // 20 data points
        
        var dataPoints: [TimeSeriesDataPoint] = []
        var currentDate = startDate
        
        while currentDate <= endDate {
            let count = Int.random(in: 0...10) // Simulated data
            dataPoints.append(TimeSeriesDataPoint(date: currentDate, count: count))
            currentDate = currentDate.addingTimeInterval(interval)
        }
        
        return dataPoints
    }
    
    private func getErrorCount(for severity: ErrorSeverity) -> Int {
        switch severity {
        case .low: return errorHandler.errorStats.lowSeverityCount
        case .medium: return errorHandler.errorStats.mediumSeverityCount
        case .high: return errorHandler.errorStats.highSeverityCount
        case .critical: return errorHandler.errorStats.criticalErrorCount
        }
    }
    
    private func getErrorCount(for category: ErrorCategory) -> Int {
        return errorHandler.errorStats.errorsByCategory[category] ?? 0
    }
    
    private func getMostFrequentErrors() -> [ErrorTypeInfo] {
        // Group errors by type and count
        var errorCounts: [ErrorType: Int] = [:]
        
        for error in errorHandler.currentErrors {
            errorCounts[error.type, default: 0] += 1
        }
        
        return errorCounts.map { ErrorTypeInfo(type: $0.key, count: $0.value) }
            .sorted { $0.count > $1.count }
    }
    
    private func getPeakErrorTime() -> String {
        // Analyze error timestamps to find peak time
        return "2:00 PM - 4:00 PM" // Simulated
    }
    
    private func getMostAffectedComponent() -> String {
        // Analyze error metadata to find most affected component
        return "WebSocket Service" // Simulated
    }
    
    private func getAverageResolutionTime() -> String {
        return "2.3 seconds" // Simulated
    }
    
    private func getErrorCorrelation() -> String {
        return "Network errors → UI failures" // Simulated
    }
    
    private func getRecoverySuccessRate(for strategy: RecoveryStrategy) -> Double {
        // Calculate success rate for each recovery strategy
        return Double.random(in: 0.6...0.95) // Simulated
    }
    
    private func getPerformanceImpact() -> ImpactSeverity {
        return errorHandler.errorStats.errorRate > 5 ? .high : .low
    }
    
    private func getUserExperienceImpact() -> ImpactSeverity {
        return errorHandler.errorStats.criticalErrorCount > 0 ? .high : .medium
    }
    
    private func getDataIntegrityImpact() -> ImpactSeverity {
        return .low // Simulated
    }
    
    private func getServiceAvailabilityImpact() -> ImpactSeverity {
        return errorHandler.systemStatus == .critical ? .high : .low
    }
    
    private func generateInsights() -> [ErrorInsight] {
        [
            ErrorInsight(
                id: UUID(),
                type: .trend,
                title: "Network Error Spike Detected",
                description: "Network errors increased by 40% in the last hour. This correlates with WebSocket connection issues.",
                severity: .medium,
                recommendation: "Consider implementing more robust connection retry logic."
            ),
            ErrorInsight(
                id: UUID(),
                type: .pattern,
                title: "Error Clustering Pattern",
                description: "Errors tend to occur in clusters, suggesting cascading failures from upstream services.",
                severity: .low,
                recommendation: "Implement circuit breaker pattern to prevent cascade failures."
            ),
            ErrorInsight(
                id: UUID(),
                type: .optimization,
                title: "Recovery Efficiency Opportunity",
                description: "Manual recovery is being used 25% of the time. Some patterns could be automated.",
                severity: .low,
                recommendation: "Implement automated recovery for common UI reset scenarios."
            )
        ]
    }
}

// MARK: - Supporting Types

enum TimeRange: CaseIterable {
    case lastHour
    case last24Hours
    case lastWeek
    case lastMonth
    
    var displayName: String {
        switch self {
        case .lastHour: return "Last Hour"
        case .last24Hours: return "Last 24 Hours"
        case .lastWeek: return "Last Week"
        case .lastMonth: return "Last Month"
        }
    }
    
    var timeInterval: TimeInterval {
        switch self {
        case .lastHour: return 3600
        case .last24Hours: return 86400
        case .lastWeek: return 604800
        case .lastMonth: return 2592000
        }
    }
}

enum AnalyticsMetric: CaseIterable {
    case errorCount
    case errorRate
    case recoveryTime
    case systemHealth
    
    var displayName: String {
        switch self {
        case .errorCount: return "Error Count"
        case .errorRate: return "Error Rate"
        case .recoveryTime: return "Recovery Time"
        case .systemHealth: return "System Health"
        }
    }
}

enum Trend {
    case positive
    case negative
    case neutral
    
    var color: Color {
        switch self {
        case .positive: return .green
        case .negative: return .red
        case .neutral: return .gray
        }
    }
    
    var icon: String {
        switch self {
        case .positive: return "arrow.up.right"
        case .negative: return "arrow.down.right"
        case .neutral: return "arrow.right"
        }
    }
}

enum ImpactSeverity {
    case low, medium, high
    
    var color: Color {
        switch self {
        case .low: return .green
        case .medium: return .orange
        case .high: return .red
        }
    }
}

struct TimeSeriesDataPoint {
    let date: Date
    let count: Int
}

struct ErrorTypeInfo {
    let type: ErrorType
    let count: Int
}

struct ErrorInsight: Identifiable {
    let id: UUID
    let type: InsightType
    let title: String
    let description: String
    let severity: ErrorSeverity
    let recommendation: String
}

enum InsightType {
    case trend, pattern, optimization, warning
    
    var icon: String {
        switch self {
        case .trend: return "chart.line.uptrend.xyaxis"
        case .pattern: return "brain.head.profile"
        case .optimization: return "speedometer"
        case .warning: return "exclamationmark.triangle"
        }
    }
}

// MARK: - Supporting Views

struct SystemHealthIndicator: View {
    let status: SystemStatus
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: status.icon)
                .foregroundColor(status.color)
            
            Text(status.rawValue.capitalized)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(status.color)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(status.color.opacity(0.1))
        .cornerRadius(16)
    }
}

struct AnalyticsStatCard: View {
    let title: String
    let value: String
    let trend: Trend
    let icon: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.blue)
                
                Spacer()
                
                Image(systemName: trend.icon)
                    .foregroundColor(trend.color)
                    .font(.caption)
            }
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

struct PatternRow: View {
    let title: String
    let value: String
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 16)
            
            Text(title)
                .font(.caption)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
        }
    }
}

struct ImpactRow: View {
    let title: String
    let severity: ImpactSeverity
    let description: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Circle()
                    .fill(severity.color)
                    .frame(width: 8, height: 8)
                
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Spacer()
            }
            
            Text(description)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

struct InsightCard: View {
    let insight: ErrorInsight
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: insight.type.icon)
                    .foregroundColor(insight.severity.color)
                
                Text(insight.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Text(insight.severity.rawValue.uppercased())
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(insight.severity.color)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(insight.severity.color.opacity(0.1))
                    .cornerRadius(4)
            }
            
            Text(insight.description)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text("💡 \(insight.recommendation)")
                .font(.caption)
                .foregroundColor(.blue)
                .padding(.top, 4)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

struct RecoveryMetricCard: View {
    let title: String
    let value: String
    let trend: Trend
    let description: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Image(systemName: trend.icon)
                    .foregroundColor(trend.color)
                    .font(.caption)
            }
            
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(trend.color)
            
            Text(description)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct AnalyticsExportView: View {
    let errorHandler: ErrorHandler
    let timeRange: TimeRange
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Export Analytics Report")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Choose export format and options")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            // Export options would go here
            
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(.bordered)
                
                Button("Export") {
                    // Export logic
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(width: 400, height: 300)
    }
}

#Preview {
    ErrorAnalyticsView(errorHandler: ErrorHandler.shared)
}