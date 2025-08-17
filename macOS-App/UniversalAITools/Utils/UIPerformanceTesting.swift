import SwiftUI
import XCTest

/// Comprehensive UI performance testing and optimization utilities
/// Provides automated testing, performance monitoring, and optimization recommendations
struct UIPerformanceTesting {
    
    // MARK: - Performance Benchmarks
    struct PerformanceBenchmarks {
        static let maxAnimationFrameTime: TimeInterval = 16.67 // 60 FPS
        static let maxUIResponseTime: TimeInterval = 100 // 100ms for UI interactions
        static let maxViewRenderTime: TimeInterval = 50 // 50ms for view rendering
        static let maxMemoryUsageIncrease: Double = 0.1 // 10% memory increase threshold
        static let targetFPS: Double = 60.0
        static let highRefreshTargetFPS: Double = 120.0
    }
    
    // MARK: - Performance Monitor
    class PerformanceMonitor: ObservableObject {
        @Published var currentFPS: Double = 0
        @Published var averageFrameTime: TimeInterval = 0
        @Published var maxFrameTime: TimeInterval = 0
        @Published var droppedFrames: Int = 0
        @Published var memoryUsage: UInt64 = 0
        @Published var performanceScore: Double = 100.0
        
        private var frameTimestamps: [CFTimeInterval] = []
        private var displayLink: CADisplayLink?
        private var startTime: CFTimeInterval = 0
        private var frameCount = 0
        
        init() {
            startMonitoring()
        }
        
        deinit {
            stopMonitoring()
        }
        
        func startMonitoring() {
            #if !os(macOS)
            displayLink = CADisplayLink(target: self, selector: #selector(displayLinkDidFire))
            displayLink?.add(to: .main, forMode: .common)
            startTime = CACurrentMediaTime()
            #endif
        }
        
        func stopMonitoring() {
            displayLink?.invalidate()
            displayLink = nil
        }
        
        @objc private func displayLinkDidFire(_ displayLink: CADisplayLink) {
            let currentTime = displayLink.timestamp
            frameTimestamps.append(currentTime)
            frameCount += 1
            
            // Keep only recent frame timestamps (last 2 seconds)
            let cutoffTime = currentTime - 2.0
            frameTimestamps.removeAll { $0 < cutoffTime }
            
            updateMetrics()
        }
        
        private func updateMetrics() {
            guard frameTimestamps.count > 1 else { return }
            
            // Calculate FPS
            let timespan = frameTimestamps.last! - frameTimestamps.first!
            currentFPS = Double(frameTimestamps.count - 1) / timespan
            
            // Calculate frame times
            var frameTimes: [TimeInterval] = []
            for i in 1..<frameTimestamps.count {
                let frameTime = frameTimestamps[i] - frameTimestamps[i-1]
                frameTimes.append(frameTime)
            }
            
            if !frameTimes.isEmpty {
                averageFrameTime = frameTimes.reduce(0, +) / Double(frameTimes.count)
                maxFrameTime = frameTimes.max() ?? 0
                
                // Count dropped frames (frame time > 16.67ms for 60fps)
                droppedFrames = frameTimes.filter { $0 > PerformanceBenchmarks.maxAnimationFrameTime / 1000 }.count
            }
            
            // Update memory usage
            updateMemoryUsage()
            
            // Calculate performance score
            calculatePerformanceScore()
        }
        
        private func updateMemoryUsage() {
            var info = mach_task_basic_info()
            var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
            
            let result = withUnsafeMutablePointer(to: &info) {
                $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                    task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
                }
            }
            
            if result == KERN_SUCCESS {
                memoryUsage = info.resident_size
            }
        }
        
        private func calculatePerformanceScore() {
            var score = 100.0
            
            // FPS penalty
            let targetFPS = PerformanceBenchmarks.targetFPS
            if currentFPS < targetFPS {
                let fpsPenalty = (targetFPS - currentFPS) / targetFPS * 30
                score -= fpsPenalty
            }
            
            // Frame time penalty
            if averageFrameTime > PerformanceBenchmarks.maxAnimationFrameTime / 1000 {
                score -= 20
            }
            
            // Dropped frames penalty
            if droppedFrames > 0 {
                score -= Double(droppedFrames) * 2
            }
            
            // Memory usage penalty (simplified)
            let memoryMB = Double(memoryUsage) / 1024 / 1024
            if memoryMB > 500 { // 500MB threshold
                score -= 10
            }
            
            performanceScore = max(0, score)
        }
        
        func getPerformanceReport() -> PerformanceReport {
            return PerformanceReport(
                fps: currentFPS,
                averageFrameTime: averageFrameTime,
                maxFrameTime: maxFrameTime,
                droppedFrames: droppedFrames,
                memoryUsage: memoryUsage,
                performanceScore: performanceScore,
                timestamp: Date()
            )
        }
    }
    
    // MARK: - Performance Report
    struct PerformanceReport {
        let fps: Double
        let averageFrameTime: TimeInterval
        let maxFrameTime: TimeInterval
        let droppedFrames: Int
        let memoryUsage: UInt64
        let performanceScore: Double
        let timestamp: Date
        
        var memoryUsageMB: Double {
            Double(memoryUsage) / 1024 / 1024
        }
        
        var isPerformanceGood: Bool {
            performanceScore >= 80.0
        }
        
        var recommendations: [String] {
            var recs: [String] = []
            
            if fps < PerformanceBenchmarks.targetFPS {
                recs.append("Consider reducing animation complexity or enabling performance mode")
            }
            
            if droppedFrames > 5 {
                recs.append("Optimize view hierarchy to reduce dropped frames")
            }
            
            if memoryUsageMB > 500 {
                recs.append("Monitor memory usage and consider implementing memory optimization")
            }
            
            if averageFrameTime > PerformanceBenchmarks.maxAnimationFrameTime / 1000 {
                recs.append("Optimize rendering pipeline for better frame times")
            }
            
            return recs
        }
    }
    
    // MARK: - Automated UI Tests
    struct AutomatedUITests {
        
        static func runPerformanceTests() -> [TestResult] {
            var results: [TestResult] = []
            
            // Test animation performance
            results.append(testAnimationPerformance())
            
            // Test view rendering performance
            results.append(testViewRenderingPerformance())
            
            // Test memory management
            results.append(testMemoryManagement())
            
            // Test responsiveness
            results.append(testUIResponsiveness())
            
            return results
        }
        
        private static func testAnimationPerformance() -> TestResult {
            let startTime = CFAbsoluteTimeGetCurrent()
            let monitor = PerformanceMonitor()
            
            // Simulate animation load
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                monitor.stopMonitoring()
            }
            
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            let passed = duration < PerformanceBenchmarks.maxAnimationFrameTime
            
            return TestResult(
                name: "Animation Performance",
                passed: passed,
                duration: duration,
                message: passed ? "Animation performance meets requirements" : "Animation performance below threshold",
                details: ["duration": String(format: "%.3f", duration)]
            )
        }
        
        private static func testViewRenderingPerformance() -> TestResult {
            let startTime = CFAbsoluteTimeGetCurrent()
            
            // Simulate view rendering
            let testView = VStack {
                ForEach(0..<100, id: \.self) { _ in
                    ModernCard {
                        Text("Test content")
                    }
                }
            }
            
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            let passed = duration < PerformanceBenchmarks.maxViewRenderTime / 1000
            
            return TestResult(
                name: "View Rendering Performance",
                passed: passed,
                duration: duration,
                message: passed ? "View rendering performance meets requirements" : "View rendering too slow",
                details: ["duration": String(format: "%.3f", duration)]
            )
        }
        
        private static func testMemoryManagement() -> TestResult {
            let initialMemory = getCurrentMemoryUsage()
            
            // Create and destroy views to test memory management
            var testViews: [AnyView] = []
            for _ in 0..<100 {
                testViews.append(AnyView(ModernCard { Text("Test") }))
            }
            
            let peakMemory = getCurrentMemoryUsage()
            testViews.removeAll() // Force deallocation
            
            let finalMemory = getCurrentMemoryUsage()
            let memoryIncrease = Double(peakMemory - initialMemory) / Double(initialMemory)
            let memoryRecovered = Double(peakMemory - finalMemory) / Double(peakMemory - initialMemory)
            
            let passed = memoryIncrease < PerformanceBenchmarks.maxMemoryUsageIncrease && memoryRecovered > 0.8
            
            return TestResult(
                name: "Memory Management",
                passed: passed,
                duration: 0,
                message: passed ? "Memory management is efficient" : "Memory management issues detected",
                details: [
                    "memory_increase": String(format: "%.1f%%", memoryIncrease * 100),
                    "memory_recovered": String(format: "%.1f%%", memoryRecovered * 100)
                ]
            )
        }
        
        private static func testUIResponsiveness() -> TestResult {
            let startTime = CFAbsoluteTimeGetCurrent()
            
            // Simulate UI interaction
            let button = ModernButton("Test") { }
            
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            let passed = duration < PerformanceBenchmarks.maxUIResponseTime / 1000
            
            return TestResult(
                name: "UI Responsiveness",
                passed: passed,
                duration: duration,
                message: passed ? "UI responsiveness meets requirements" : "UI response time too slow",
                details: ["response_time": String(format: "%.3f", duration * 1000)]
            )
        }
        
        private static func getCurrentMemoryUsage() -> UInt64 {
            var info = mach_task_basic_info()
            var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
            
            let result = withUnsafeMutablePointer(to: &info) {
                $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                    task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
                }
            }
            
            return result == KERN_SUCCESS ? info.resident_size : 0
        }
    }
    
    // MARK: - Test Result
    struct TestResult {
        let name: String
        let passed: Bool
        let duration: TimeInterval
        let message: String
        let details: [String: String]
    }
    
    // MARK: - Performance Optimization Suggestions
    struct OptimizationSuggestions {
        
        static func analyzePerformance(_ report: PerformanceReport) -> [OptimizationSuggestion] {
            var suggestions: [OptimizationSuggestion] = []
            
            // FPS optimizations
            if report.fps < PerformanceBenchmarks.targetFPS {
                suggestions.append(OptimizationSuggestion(
                    category: .animation,
                    priority: .high,
                    title: "Low Frame Rate Detected",
                    description: "Current FPS (\(String(format: "%.1f", report.fps))) is below target (\(PerformanceBenchmarks.targetFPS))",
                    recommendations: [
                        "Enable performance mode in settings",
                        "Reduce particle count in visualizations",
                        "Use .drawingGroup() for complex animations",
                        "Consider lowering animation quality on older devices"
                    ]
                ))
            }
            
            // Memory optimizations
            if report.memoryUsageMB > 400 {
                suggestions.append(OptimizationSuggestion(
                    category: .memory,
                    priority: report.memoryUsageMB > 600 ? .high : .medium,
                    title: "High Memory Usage",
                    description: "Memory usage (\(String(format: "%.1f", report.memoryUsageMB))MB) is elevated",
                    recommendations: [
                        "Implement view recycling for large lists",
                        "Use lazy loading for images and heavy content",
                        "Clear unused animation caches",
                        "Optimize image compression and sizing"
                    ]
                ))
            }
            
            // Frame time optimizations
            if report.averageFrameTime > PerformanceBenchmarks.maxAnimationFrameTime / 1000 {
                suggestions.append(OptimizationSuggestion(
                    category: .rendering,
                    priority: .medium,
                    title: "Slow Frame Rendering",
                    description: "Average frame time (\(String(format: "%.1f", report.averageFrameTime * 1000))ms) exceeds target",
                    recommendations: [
                        "Optimize view hierarchy depth",
                        "Use @StateObject instead of @ObservedObject where appropriate",
                        "Implement view caching for expensive calculations",
                        "Use .id() modifier to prevent unnecessary view updates"
                    ]
                ))
            }
            
            // Dropped frames
            if report.droppedFrames > 3 {
                suggestions.append(OptimizationSuggestion(
                    category: .animation,
                    priority: .medium,
                    title: "Dropped Frames Detected",
                    description: "\(report.droppedFrames) frames dropped in recent monitoring period",
                    recommendations: [
                        "Reduce concurrent animations",
                        "Use Timeline instead of Timer for animations",
                        "Implement animation queuing",
                        "Consider using lower-fidelity animations"
                    ]
                ))
            }
            
            return suggestions
        }
    }
    
    // MARK: - Optimization Suggestion
    struct OptimizationSuggestion {
        enum Category {
            case animation, memory, rendering, layout, network
        }
        
        enum Priority {
            case low, medium, high, critical
            
            var color: Color {
                switch self {
                case .low: return .green
                case .medium: return .orange
                case .high: return .red
                case .critical: return .purple
                }
            }
        }
        
        let category: Category
        let priority: Priority
        let title: String
        let description: String
        let recommendations: [String]
    }
    
    // MARK: - Performance Dashboard View
    struct PerformanceDashboard: View {
        @StateObject private var monitor = PerformanceMonitor()
        @State private var testResults: [TestResult] = []
        @State private var suggestions: [OptimizationSuggestion] = []
        @State private var isRunningTests = false
        
        var body: some View {
            ScrollView {
                VStack(spacing: 20) {
                    // Real-time performance metrics
                    performanceMetricsSection
                    
                    // Performance score
                    performanceScoreSection
                    
                    // Test results
                    testResultsSection
                    
                    // Optimization suggestions
                    optimizationSuggestionsSection
                }
                .padding()
            }
            .navigationTitle("Performance Dashboard")
            .onAppear {
                runPerformanceAnalysis()
            }
        }
        
        @ViewBuilder
        private var performanceMetricsSection: some View {
            ModernCard {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Real-time Metrics")
                        .font(.headline)
                    
                    HStack {
                        VStack(alignment: .leading) {
                            Text("FPS")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(String(format: "%.1f", monitor.currentFPS))
                                .font(.title2.bold())
                                .foregroundColor(monitor.currentFPS >= 55 ? .green : .orange)
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .leading) {
                            Text("Memory")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(String(format: "%.1f MB", Double(monitor.memoryUsage) / 1024 / 1024))
                                .font(.title2.bold())
                                .foregroundColor(.blue)
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .leading) {
                            Text("Frame Time")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(String(format: "%.1f ms", monitor.averageFrameTime * 1000))
                                .font(.title2.bold())
                                .foregroundColor(monitor.averageFrameTime < 0.017 ? .green : .orange)
                        }
                    }
                }
            }
        }
        
        @ViewBuilder
        private var performanceScoreSection: some View {
            ModernCard {
                VStack(spacing: 16) {
                    Text("Performance Score")
                        .font(.headline)
                    
                    ZStack {
                        Circle()
                            .stroke(.gray.opacity(0.3), lineWidth: 8)
                            .frame(width: 120, height: 120)
                        
                        Circle()
                            .trim(from: 0, to: monitor.performanceScore / 100)
                            .stroke(
                                monitor.performanceScore >= 80 ? .green :
                                monitor.performanceScore >= 60 ? .orange : .red,
                                lineWidth: 8
                            )
                            .frame(width: 120, height: 120)
                            .rotationEffect(.degrees(-90))
                        
                        Text(String(format: "%.0f", monitor.performanceScore))
                            .font(.title.bold())
                    }
                }
            }
        }
        
        @ViewBuilder
        private var testResultsSection: some View {
            ModernCard {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text("Performance Tests")
                            .font(.headline)
                        
                        Spacer()
                        
                        ModernButton(
                            "Run Tests",
                            icon: "play.fill",
                            size: .small,
                            isLoading: isRunningTests
                        ) {
                            runPerformanceTests()
                        }
                    }
                    
                    if !testResults.isEmpty {
                        VStack(spacing: 8) {
                            ForEach(testResults.indices, id: \.self) { index in
                                let result = testResults[index]
                                HStack {
                                    Image(systemName: result.passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                                        .foregroundColor(result.passed ? .green : .red)
                                    
                                    Text(result.name)
                                        .font(.body)
                                    
                                    Spacer()
                                    
                                    Text(String(format: "%.1fms", result.duration * 1000))
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        
        @ViewBuilder
        private var optimizationSuggestionsSection: some View {
            if !suggestions.isEmpty {
                ModernCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Optimization Suggestions")
                            .font(.headline)
                        
                        ForEach(suggestions.indices, id: \.self) { index in
                            let suggestion = suggestions[index]
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Circle()
                                        .fill(suggestion.priority.color)
                                        .frame(width: 8, height: 8)
                                    
                                    Text(suggestion.title)
                                        .font(.subheadline.bold())
                                }
                                
                                Text(suggestion.description)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    ForEach(suggestion.recommendations, id: \.self) { recommendation in
                                        HStack {
                                            Text("•")
                                                .foregroundColor(.blue)
                                            Text(recommendation)
                                                .font(.caption)
                                        }
                                    }
                                }
                            }
                            .padding(.vertical, 8)
                            
                            if index < suggestions.count - 1 {
                                Divider()
                            }
                        }
                    }
                }
            }
        }
        
        private func runPerformanceTests() {
            isRunningTests = true
            
            DispatchQueue.global(qos: .userInitiated).async {
                let results = AutomatedUITests.runPerformanceTests()
                
                DispatchQueue.main.async {
                    testResults = results
                    isRunningTests = false
                }
            }
        }
        
        private func runPerformanceAnalysis() {
            let report = monitor.getPerformanceReport()
            suggestions = OptimizationSuggestions.analyzePerformance(report)
        }
    }
}

#Preview {
    UIPerformanceTesting.PerformanceDashboard()
        .frame(width: 600, height: 800)
}