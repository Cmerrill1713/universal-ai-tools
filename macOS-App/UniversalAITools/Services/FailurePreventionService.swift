import Combine
import Foundation
import Network
import OSLog
import SwiftUI

// MARK: - Failure Types
public enum FailureType: String, Codable, CaseIterable {
    case memoryLeak = "memory_leak"
    case connectionTimeout = "connection_timeout"
    case apiFailure = "api_failure"
    case performanceDegradation = "performance_degradation"
    case resourceExhaustion = "resource_exhaustion"
    case dataCorruption = "data_corruption"
    case authenticationFailure = "authentication_failure"
    case networkInstability = "network_instability"
    case systemOverload = "system_overload"
    case concurrencyIssue = "concurrency_issue"
    case configurationError = "configuration_error"
    case dependencyFailure = "dependency_failure"
    
    var severity: FailureSeverity {
        switch self {
        case .memoryLeak, .dataCorruption, .systemOverload:
            return .critical
        case .connectionTimeout, .apiFailure, .resourceExhaustion, .authenticationFailure:
            return .high
        case .performanceDegradation, .networkInstability, .concurrencyIssue:
            return .medium
        case .configurationError, .dependencyFailure:
            return .low
        }
    }
    
    var description: String {
        switch self {
        case .memoryLeak:
            return "Memory usage is increasing without being released"
        case .connectionTimeout:
            return "Network connections are timing out frequently"
        case .apiFailure:
            return "API calls are failing at a high rate"
        case .performanceDegradation:
            return "Application performance is declining"
        case .resourceExhaustion:
            return "System resources are being exhausted"
        case .dataCorruption:
            return "Data integrity issues detected"
        case .authenticationFailure:
            return "Authentication attempts are failing"
        case .networkInstability:
            return "Network connection is unstable"
        case .systemOverload:
            return "System is experiencing high load"
        case .concurrencyIssue:
            return "Thread safety or race condition detected"
        case .configurationError:
            return "Configuration settings are invalid"
        case .dependencyFailure:
            return "External dependencies are unavailable"
        }
    }
}

// MARK: - Failure Severity
public enum FailureSeverity: String, Codable, CaseIterable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case critical = "critical"
    
    var color: Color {
        switch self {
        case .low: return .blue
        case .medium: return .orange
        case .high: return .red
        case .critical: return .purple
        }
    }
    
    var priority: Int {
        switch self {
        case .low: return 1
        case .medium: return 2
        case .high: return 3
        case .critical: return 4
        }
    }
}

// MARK: - Failure Prediction (using FailurePrediction from LoggingTypes.swift)

// MARK: - Recovery Strategy
public struct RecoveryStrategy: Codable {
    public let name: String
    public let description: String
    public let failureTypes: [FailureType]
    public let automaticRecovery: Bool
    public let steps: [RecoveryStep]
    public let estimatedTime: TimeInterval
    public let successRate: Double
    
    public struct RecoveryStep: Codable {
        public let order: Int
        public let action: String
        public let description: String
        public let timeout: TimeInterval
        public let critical: Bool
    }
}

// MARK: - Health Trend
public struct HealthTrend: Codable {
    public let metric: String
    public let values: [TrendValue]
    public let trend: TrendDirection
    public let severity: FailureSeverity
    public let prediction: String?
    
    public struct TrendValue: Codable {
        public let timestamp: Date
        public let value: Double
    }
    
    public enum TrendDirection: String, Codable {
        case improving = "improving"
        case stable = "stable"
        case degrading = "degrading"
        case critical = "critical"
    }
}

// MARK: - Proactive Monitor
public protocol ProactiveMonitor {
    var name: String { get }
    var monitoredFailureTypes: [FailureType] { get }
    
    func checkForFailureIndicators() async -> [FailurePrediction]
    func performPreventiveAction(for prediction: FailurePrediction) async -> Bool
}

// MARK: - Memory Monitor Implementation
public class MemoryMonitor: ProactiveMonitor {
    public let name = "Memory Monitor"
    public let monitoredFailureTypes: [FailureType] = [.memoryLeak, .resourceExhaustion]
    
    private var previousMemoryUsage: [Double] = []
    private let maxSamples = 10
    private let leakThreshold = 0.85 // 85% memory usage
    private let growthRateThreshold = 0.1 // 10% growth per minute
    
    public func checkForFailureIndicators() async -> [FailurePrediction] {
        var predictions: [FailurePrediction] = []
        
        let currentMemoryUsage = getCurrentMemoryUsage()
        previousMemoryUsage.append(currentMemoryUsage)
        
        if previousMemoryUsage.count > maxSamples {
            previousMemoryUsage.removeFirst()
        }
        
        // Check for memory leak
        if currentMemoryUsage > leakThreshold {
            let confidence = min(1.0, (currentMemoryUsage - leakThreshold) / (1.0 - leakThreshold))
            
            let prediction = FailurePrediction(
                failureType: .memoryLeak,
                severity: currentMemoryUsage > 0.95 ? .critical : .high,
                confidence: confidence,
                timeToFailure: estimateTimeToMemoryExhaustion(),
                indicators: [
                    "Memory usage: \(String(format: "%.1f", currentMemoryUsage * 100))%",
                    "Above threshold: \(String(format: "%.1f", leakThreshold * 100))%"
                ],
                recommendedActions: [
                    "Free unused memory",
                    "Close unnecessary processes",
                    "Review memory-intensive operations"
                ]
            )
            
            predictions.append(prediction)
        }
        
        // Check for memory growth rate
        if previousMemoryUsage.count >= 3 {
            let recentGrowth = calculateMemoryGrowthRate()
            
            if recentGrowth > growthRateThreshold {
                let prediction = FailurePrediction(
                    failureType: .memoryLeak,
                    severity: .medium,
                    confidence: min(1.0, recentGrowth / (growthRateThreshold * 2)),
                    indicators: [
                        "Memory growth rate: \(String(format: "%.2f", recentGrowth * 100))%/min",
                        "Above threshold: \(String(format: "%.1f", growthRateThreshold * 100))%/min"
                    ],
                    recommendedActions: [
                        "Monitor memory allocation patterns",
                        "Check for memory leaks in recent operations"
                    ]
                )
                
                predictions.append(prediction)
            }
        }
        
        return predictions
    }
    
    public func performPreventiveAction(for prediction: FailurePrediction) async -> Bool {
        switch prediction.failureType {
        case .memoryLeak, .resourceExhaustion:
            // Trigger garbage collection and cleanup
            await performMemoryCleanup()
            return true
        default:
            return false
        }
    }
    
    private func getCurrentMemoryUsage() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
        
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if result == KERN_SUCCESS {
            let totalMemory = ProcessInfo.processInfo.physicalMemory
            return Double(info.resident_size) / Double(totalMemory)
        }
        
        return 0.0
    }
    
    private func estimateTimeToMemoryExhaustion() -> TimeInterval? {
        guard previousMemoryUsage.count >= 2 else { return nil }
        
        let growthRate = calculateMemoryGrowthRate()
        guard growthRate > 0 else { return nil }
        
        let currentUsage = previousMemoryUsage.last ?? 0
        let remainingCapacity = 1.0 - currentUsage
        
        return remainingCapacity / growthRate * 60 // Convert to seconds
    }
    
    private func calculateMemoryGrowthRate() -> Double {
        guard previousMemoryUsage.count >= 2 else { return 0 }
        
        let latest = previousMemoryUsage.suffix(3)
        let growth = latest.last! - latest.first!
        let timeSpan = Double(latest.count - 1) // Number of intervals
        
        return growth / timeSpan // Growth per interval (assumed to be per minute)
    }
    
    private func performMemoryCleanup() async {
        // Force garbage collection and cleanup
        DispatchQueue.main.async {
            // Clear caches, temporary data, etc.
            URLCache.shared.removeAllCachedResponses()
        }
    }
}

// MARK: - Connection Monitor Implementation
public class ConnectionMonitor: ProactiveMonitor {
    public let name = "Connection Monitor"
    public let monitoredFailureTypes: [FailureType] = [.connectionTimeout, .networkInstability, .apiFailure]
    
    private var connectionAttempts: [ConnectionAttempt] = []
    private let maxAttempts = 20
    private let failureRateThreshold = 0.3 // 30% failure rate
    private let latencyThreshold: TimeInterval = 5.0
    
    private struct ConnectionAttempt {
        let timestamp: Date
        let success: Bool
        let latency: TimeInterval?
        let endpoint: String
    }
    
    public func checkForFailureIndicators() async -> [FailurePrediction] {
        var predictions: [FailurePrediction] = []
        
        // Analyze recent connection attempts
        let recentAttempts = connectionAttempts.filter {
            $0.timestamp > Date().addingTimeInterval(-300) // Last 5 minutes
        }
        
        guard !recentAttempts.isEmpty else { return predictions }
        
        // Check failure rate
        let failureRate = Double(recentAttempts.filter { !$0.success }.count) / Double(recentAttempts.count)
        
        if failureRate > failureRateThreshold {
            let prediction = FailurePrediction(
                failureType: .apiFailure,
                severity: failureRate > 0.7 ? .critical : .high,
                confidence: min(1.0, failureRate / failureRateThreshold),
                indicators: [
                    "Failure rate: \(String(format: "%.1f", failureRate * 100))%",
                    "Recent attempts: \(recentAttempts.count)",
                    "Failed attempts: \(recentAttempts.filter { !$0.success }.count)"
                ],
                recommendedActions: [
                    "Check network connectivity",
                    "Verify API endpoints",
                    "Review authentication credentials"
                ]
            )
            
            predictions.append(prediction)
        }
        
        // Check latency
        let successfulAttempts = recentAttempts.filter { $0.success && $0.latency != nil }
        if !successfulAttempts.isEmpty {
            let averageLatency = successfulAttempts.compactMap { $0.latency }.reduce(0, +) / Double(successfulAttempts.count)
            
            if averageLatency > latencyThreshold {
                let prediction = FailurePrediction(
                    failureType: .networkInstability,
                    severity: averageLatency > latencyThreshold * 2 ? .high : .medium,
                    confidence: min(1.0, averageLatency / (latencyThreshold * 2)),
                    indicators: [
                        "Average latency: \(String(format: "%.2f", averageLatency))s",
                        "Threshold: \(String(format: "%.1f", latencyThreshold))s"
                    ],
                    recommendedActions: [
                        "Check network quality",
                        "Consider connection optimization",
                        "Monitor network bandwidth"
                    ]
                )
                
                predictions.append(prediction)
            }
        }
        
        return predictions
    }
    
    public func performPreventiveAction(for prediction: FailurePrediction) async -> Bool {
        switch prediction.failureType {
        case .connectionTimeout, .networkInstability:
            // Implement connection recovery strategies
            await performConnectionRecovery()
            return true
        case .apiFailure:
            // Implement API failure recovery
            await performAPIRecovery()
            return true
        default:
            return false
        }
    }
    
    public func recordConnectionAttempt(endpoint: String, success: Bool, latency: TimeInterval?) {
        let attempt = ConnectionAttempt(
            timestamp: Date(),
            success: success,
            latency: latency,
            endpoint: endpoint
        )
        
        connectionAttempts.append(attempt)
        
        if connectionAttempts.count > maxAttempts {
            connectionAttempts.removeFirst()
        }
    }
    
    private func performConnectionRecovery() async {
        // Implement connection recovery strategies
        // This could include resetting connections, switching endpoints, etc.
    }
    
    private func performAPIRecovery() async {
        // Implement API recovery strategies
        // This could include credential refresh, endpoint health checks, etc.
    }
}

// MARK: - Performance Monitor Implementation
public class PerformanceMonitor: ProactiveMonitor {
    public let name = "Performance Monitor"
    public let monitoredFailureTypes: [FailureType] = [.performanceDegradation, .systemOverload]
    
    private var performanceMetrics: [PerformanceMetric] = []
    private let maxMetrics = 50
    
    private struct PerformanceMetric {
        let timestamp: Date
        let cpuUsage: Double
        let memoryUsage: Double
        let responseTime: TimeInterval
        let operation: String
    }
    
    public func checkForFailureIndicators() async -> [FailurePrediction] {
        var predictions: [FailurePrediction] = []
        
        let recentMetrics = performanceMetrics.filter {
            $0.timestamp > Date().addingTimeInterval(-600) // Last 10 minutes
        }
        
        guard recentMetrics.count >= 3 else { return predictions }
        
        // Check for performance degradation trend
        let responseTimes = recentMetrics.map { $0.responseTime }
        let trend = calculateTrend(responseTimes)
        
        if trend > 0.2 { // 20% increase in response times
            let prediction = FailurePrediction(
                failureType: .performanceDegradation,
                severity: trend > 0.5 ? .high : .medium,
                confidence: min(1.0, trend / 0.5),
                indicators: [
                    "Response time trend: +\(String(format: "%.1f", trend * 100))%",
                    "Recent operations: \(recentMetrics.count)"
                ],
                recommendedActions: [
                    "Optimize slow operations",
                    "Check system resources",
                    "Consider load balancing"
                ]
            )
            
            predictions.append(prediction)
        }
        
        // Check for system overload
        let averageCPU = recentMetrics.map { $0.cpuUsage }.reduce(0, +) / Double(recentMetrics.count)
        let averageMemory = recentMetrics.map { $0.memoryUsage }.reduce(0, +) / Double(recentMetrics.count)
        
        if averageCPU > 0.8 || averageMemory > 0.9 {
            let prediction = FailurePrediction(
                failureType: .systemOverload,
                severity: (averageCPU > 0.9 || averageMemory > 0.95) ? .critical : .high,
                confidence: max(averageCPU, averageMemory),
                indicators: [
                    "Average CPU: \(String(format: "%.1f", averageCPU * 100))%",
                    "Average Memory: \(String(format: "%.1f", averageMemory * 100))%"
                ],
                recommendedActions: [
                    "Reduce system load",
                    "Close unnecessary applications",
                    "Optimize resource usage"
                ]
            )
            
            predictions.append(prediction)
        }
        
        return predictions
    }
    
    public func performPreventiveAction(for prediction: FailurePrediction) async -> Bool {
        switch prediction.failureType {
        case .performanceDegradation:
            await optimizePerformance()
            return true
        case .systemOverload:
            await reduceSystemLoad()
            return true
        default:
            return false
        }
    }
    
    public func recordPerformanceMetric(
        cpuUsage: Double,
        memoryUsage: Double,
        responseTime: TimeInterval,
        operation: String
    ) {
        let metric = PerformanceMetric(
            timestamp: Date(),
            cpuUsage: cpuUsage,
            memoryUsage: memoryUsage,
            responseTime: responseTime,
            operation: operation
        )
        
        performanceMetrics.append(metric)
        
        if performanceMetrics.count > maxMetrics {
            performanceMetrics.removeFirst()
        }
    }
    
    private func calculateTrend(_ values: [TimeInterval]) -> Double {
        guard values.count >= 2 else { return 0 }
        
        let first = values.prefix(values.count / 2).reduce(0, +) / Double(values.count / 2)
        let last = values.suffix(values.count / 2).reduce(0, +) / Double(values.count / 2)
        
        return (last - first) / first
    }
    
    private func optimizePerformance() async {
        // Implement performance optimization strategies
    }
    
    private func reduceSystemLoad() async {
        // Implement system load reduction strategies
    }
}

// MARK: - Main Failure Prevention Service
@MainActor
public class FailurePreventionService: ObservableObject {
    public static let shared = FailurePreventionService()
    
    @Published public var isEnabled = true
    @Published public var activePredictions: [FailurePrediction] = []
    @Published public var healthTrends: [HealthTrend] = []
    @Published public var recoveryStrategies: [RecoveryStrategy] = []
    @Published public var preventedFailures: Int = 0
    @Published public var automaticRecoveries: Int = 0
    
    private let logger = LoggingService.shared
    private let changeTracker = ChangeTracker.shared
    private let monitoringService = MonitoringService.shared
    
    private var monitors: [ProactiveMonitor] = []
    private var monitoringTimer: Timer?
    private var trendAnalysisTimer: Timer?
    
    // Configuration
    public var monitoringInterval: TimeInterval = 60.0 // 1 minute
    public var trendAnalysisInterval: TimeInterval = 300.0 // 5 minutes
    public var automaticRecoveryEnabled = true
    public var predictionThreshold = 0.7 // Minimum confidence for action
    
    private init() {
        setupMonitors()
        setupRecoveryStrategies()
        startMonitoring()
        
        logger.info("FailurePreventionService initialized", category: .monitoring)
    }
    
    // MARK: - Configuration
    
    public func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        
        if enabled {
            startMonitoring()
            logger.info("Failure prevention enabled", category: .monitoring)
        } else {
            stopMonitoring()
            logger.info("Failure prevention disabled", category: .monitoring)
        }
    }
    
    public func setMonitoringInterval(_ interval: TimeInterval) {
        monitoringInterval = interval
        
        if isEnabled {
            stopMonitoring()
            startMonitoring()
        }
        
        logger.info("Monitoring interval set to \(interval)s", category: .monitoring)
    }
    
    public func setAutomaticRecoveryEnabled(_ enabled: Bool) {
        automaticRecoveryEnabled = enabled
        logger.info("Automatic recovery \(enabled ? "enabled" : "disabled")", category: .monitoring)
    }
    
    // MARK: - Monitor Management
    
    public func addMonitor(_ monitor: ProactiveMonitor) {
        monitors.append(monitor)
        logger.debug("Added monitor: \(monitor.name)", category: .monitoring)
    }
    
    public func removeMonitor(named name: String) {
        monitors.removeAll { $0.name == name }
        logger.debug("Removed monitor: \(name)", category: .monitoring)
    }
    
    // MARK: - Prediction and Prevention
    
    public func runFailurePrediction() async {
        guard isEnabled else { return }
        
        logger.debug("Running failure prediction with \(monitors.count) monitors", category: .monitoring)
        
        var allPredictions: [FailurePrediction] = []
        
        for monitor in monitors {
            do {
                let predictions = await monitor.checkForFailureIndicators()
                allPredictions.append(contentsOf: predictions)
                
                logger.debug("Monitor '\(monitor.name)' generated \(predictions.count) predictions", 
                           category: .monitoring)
            } catch {
                logger.error("Monitor '\(monitor.name)' failed: \(error.localizedDescription)",
                           category: .monitoring)
                
                changeTracker.trackError(
                    errorType: "monitor_failure",
                    errorMessage: error.localizedDescription,
                    source: monitor.name
                )
            }
        }
        
        // Filter predictions by confidence threshold
        let highConfidencePredictions = allPredictions.filter { $0.confidence >= predictionThreshold }
        
        DispatchQueue.main.async {
            self.activePredictions = highConfidencePredictions
        }
        
        // Take preventive actions for high-confidence predictions
        for prediction in highConfidencePredictions {
            await handleFailurePrediction(prediction)
        }
        
        if !allPredictions.isEmpty {
            logger.warning("Generated \(allPredictions.count) failure predictions (\(highConfidencePredictions.count) high-confidence)",
                          category: .monitoring)
        }
    }
    
    private func handleFailurePrediction(_ prediction: FailurePrediction) async {
        logger.warning("Handling failure prediction: \(prediction.failureType.rawValue) (confidence: \(String(format: "%.2f", prediction.confidence)))",
                      category: .monitoring)
        
        // Log the prediction for tracking
        changeTracker.track(
            type: .systemEvent,
            source: "failure_prevention",
            action: "prediction_generated",
            newValue: prediction.failureType.rawValue,
            metadata: [
                "severity": prediction.severity.rawValue,
                "confidence": String(format: "%.2f", prediction.confidence),
                "indicators": prediction.indicators.joined(separator: "; ")
            ]
        )
        
        // Create monitoring alert
        monitoringService.createAlert(
            type: .system,
            title: "Failure Predicted: \(prediction.failureType.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)",
            message: prediction.failureType.description,
            severity: mapSeverityToHealthStatus(prediction.severity)
        )
        
        // Attempt automatic recovery if enabled
        if automaticRecoveryEnabled && prediction.confidence >= predictionThreshold {
            await attemptAutomaticRecovery(for: prediction)
        }
    }
    
    private func attemptAutomaticRecovery(for prediction: FailurePrediction) async {
        logger.info("Attempting automatic recovery for \(prediction.failureType.rawValue)", 
                   category: .monitoring)
        
        // Find applicable monitors
        let applicableMonitors = monitors.filter { monitor in
            monitor.monitoredFailureTypes.contains(prediction.failureType)
        }
        
        var recoverySuccessful = false
        
        for monitor in applicableMonitors {
            do {
                let success = await monitor.performPreventiveAction(for: prediction)
                if success {
                    recoverySuccessful = true
                    logger.info("Monitor '\(monitor.name)' successfully performed preventive action",
                               category: .monitoring)
                    break
                }
            } catch {
                logger.error("Monitor '\(monitor.name)' failed to perform preventive action: \(error.localizedDescription)",
                           category: .monitoring)
            }
        }
        
        // Try recovery strategies
        if !recoverySuccessful {
            let applicableStrategies = recoveryStrategies.filter { strategy in
                strategy.failureTypes.contains(prediction.failureType)
            }
            
            for strategy in applicableStrategies.sorted(by: { $0.successRate > $1.successRate }) {
                let success = await executeRecoveryStrategy(strategy, for: prediction)
                if success {
                    recoverySuccessful = true
                    break
                }
            }
        }
        
        if recoverySuccessful {
            DispatchQueue.main.async {
                self.automaticRecoveries += 1
                self.preventedFailures += 1
            }
            
            changeTracker.track(
                type: .systemEvent,
                source: "failure_prevention",
                action: "automatic_recovery_successful",
                metadata: ["failure_type": prediction.failureType.rawValue]
            )
            
            logger.info("Automatic recovery successful for \(prediction.failureType.rawValue)",
                       category: .monitoring)
        } else {
            logger.warning("Automatic recovery failed for \(prediction.failureType.rawValue)",
                          category: .monitoring)
        }
    }
    
    private func executeRecoveryStrategy(_ strategy: RecoveryStrategy, for prediction: FailurePrediction) async -> Bool {
        logger.info("Executing recovery strategy: \(strategy.name)", category: .monitoring)
        
        let startTime = Date()
        
        for step in strategy.steps.sorted(by: { $0.order < $1.order }) {
            do {
                let success = await executeRecoveryStep(step)
                
                if !success && step.critical {
                    logger.error("Critical recovery step failed: \(step.action)", category: .monitoring)
                    return false
                }
                
                logger.debug("Recovery step completed: \(step.action)", category: .monitoring)
            } catch {
                logger.error("Recovery step error: \(step.action) - \(error.localizedDescription)",
                           category: .monitoring)
                
                if step.critical {
                    return false
                }
            }
        }
        
        let duration = Date().timeIntervalSince(startTime)
        logger.info("Recovery strategy '\(strategy.name)' completed in \(String(format: "%.2f", duration))s",
                   category: .monitoring)
        
        return true
    }
    
    private func executeRecoveryStep(_ step: RecoveryStrategy.RecoveryStep) async -> Bool {
        // This would implement the actual recovery actions
        // For now, we simulate the execution
        
        logger.debug("Executing recovery step: \(step.action)", category: .monitoring)
        
        // Simulate step execution time
        try? await Task.sleep(nanoseconds: UInt64(0.1 * 1_000_000_000))
        
        return true
    }
    
    // MARK: - Trend Analysis
    
    private func analyzeTrends() async {
        guard isEnabled else { return }
        
        logger.debug("Analyzing health trends", category: .monitoring)
        
        // Get recent performance metrics from monitoring service
        guard let metrics = monitoringService.performanceMetrics else { return }
        
        var trends: [HealthTrend] = []
        
        // Analyze memory usage trend
        let memoryTrend = analyzeMetricTrend(
            metric: "memory_usage",
            currentValue: metrics.memoryUsage,
            threshold: 85.0
        )
        trends.append(memoryTrend)
        
        // Analyze CPU usage trend
        let cpuTrend = analyzeMetricTrend(
            metric: "cpu_usage",
            currentValue: metrics.cpuUsage,
            threshold: 80.0
        )
        trends.append(cpuTrend)
        
        // Analyze disk usage trend
        let diskTrend = analyzeMetricTrend(
            metric: "disk_usage",
            currentValue: metrics.diskSpace.usagePercentage,
            threshold: 90.0
        )
        trends.append(diskTrend)
        
        DispatchQueue.main.async {
            self.healthTrends = trends
        }
        
        // Check for concerning trends
        let concerningTrends = trends.filter { $0.trend == .degrading || $0.trend == .critical }
        
        if !concerningTrends.isEmpty {
            logger.warning("Detected \(concerningTrends.count) concerning health trends",
                          category: .monitoring)
        }
    }
    
    private func analyzeMetricTrend(metric: String, currentValue: Double, threshold: Double) -> HealthTrend {
        // This is a simplified trend analysis
        // In a real implementation, you would analyze historical data
        
        let trend: HealthTrend.TrendDirection
        let severity: FailureSeverity
        
        if currentValue >= threshold {
            trend = .critical
            severity = .critical
        } else if currentValue >= threshold * 0.8 {
            trend = .degrading
            severity = .high
        } else if currentValue >= threshold * 0.6 {
            trend = .stable
            severity = .medium
        } else {
            trend = .improving
            severity = .low
        }
        
        let values = [
            HealthTrend.TrendValue(timestamp: Date(), value: currentValue)
        ]
        
        return HealthTrend(
            metric: metric,
            values: values,
            trend: trend,
            severity: severity,
            prediction: trend == .degrading ? "May exceed threshold in \(estimateTimeToThreshold(currentValue, threshold: threshold))" : nil
        )
    }
    
    private func estimateTimeToThreshold(_ currentValue: Double, threshold: Double) -> String {
        let remaining = threshold - currentValue
        let rate = 1.0 // Assume 1% per hour growth rate
        let hours = remaining / rate
        
        if hours < 24 {
            return "\(Int(hours)) hours"
        } else {
            return "\(Int(hours / 24)) days"
        }
    }
    
    // MARK: - Recovery Strategy Management
    
    public func addRecoveryStrategy(_ strategy: RecoveryStrategy) {
        recoveryStrategies.append(strategy)
        logger.debug("Added recovery strategy: \(strategy.name)", category: .monitoring)
    }
    
    public func removeRecoveryStrategy(named name: String) {
        recoveryStrategies.removeAll { $0.name == name }
        logger.debug("Removed recovery strategy: \(name)", category: .monitoring)
    }
    
    // MARK: - Public API
    
    public func dismissPrediction(_ prediction: FailurePrediction) {
        activePredictions.removeAll { $0.id == prediction.id }
        
        changeTracker.track(
            type: .userInteraction,
            source: "failure_prevention",
            action: "prediction_dismissed",
            metadata: ["failure_type": prediction.failureType.rawValue]
        )
    }
    
    public func manualRecovery(for prediction: FailurePrediction) async {
        await attemptAutomaticRecovery(for: prediction)
    }
    
    public func getHealthReport() -> String {
        let predictionCount = activePredictions.count
        let criticalPredictions = activePredictions.filter { $0.severity == .critical }.count
        let preventedCount = preventedFailures
        let recoveryCount = automaticRecoveries
        
        return """
        Failure Prevention Health Report
        ==============================
        
        Active Predictions: \(predictionCount)
        Critical Predictions: \(criticalPredictions)
        Prevented Failures: \(preventedCount)
        Automatic Recoveries: \(recoveryCount)
        
        Monitors Active: \(monitors.count)
        Recovery Strategies: \(recoveryStrategies.count)
        Health Trends: \(healthTrends.count)
        """
    }
    
    // MARK: - Private Methods
    
    private func setupMonitors() {
        monitors = [
            MemoryMonitor(),
            ConnectionMonitor(),
            PerformanceMonitor()
        ]
    }
    
    private func setupRecoveryStrategies() {
        recoveryStrategies = [
            RecoveryStrategy(
                name: "Memory Cleanup",
                description: "Clear caches and free unused memory",
                failureTypes: [.memoryLeak, .resourceExhaustion],
                automaticRecovery: true,
                steps: [
                    RecoveryStrategy.RecoveryStep(
                        order: 1,
                        action: "clear_caches",
                        description: "Clear system and application caches",
                        timeout: 30,
                        critical: false
                    ),
                    RecoveryStrategy.RecoveryStep(
                        order: 2,
                        action: "force_gc",
                        description: "Force garbage collection",
                        timeout: 10,
                        critical: false
                    )
                ],
                estimatedTime: 40,
                successRate: 0.8
            ),
            
            RecoveryStrategy(
                name: "Connection Reset",
                description: "Reset network connections and retry",
                failureTypes: [.connectionTimeout, .networkInstability, .apiFailure],
                automaticRecovery: true,
                steps: [
                    RecoveryStrategy.RecoveryStep(
                        order: 1,
                        action: "reset_connections",
                        description: "Reset all network connections",
                        timeout: 15,
                        critical: true
                    ),
                    RecoveryStrategy.RecoveryStep(
                        order: 2,
                        action: "retry_failed_requests",
                        description: "Retry failed network requests",
                        timeout: 30,
                        critical: false
                    )
                ],
                estimatedTime: 45,
                successRate: 0.75
            )
        ]
    }
    
    private func startMonitoring() {
        monitoringTimer = Timer.scheduledTimer(withTimeInterval: monitoringInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.runFailurePrediction()
            }
        }
        
        trendAnalysisTimer = Timer.scheduledTimer(withTimeInterval: trendAnalysisInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.analyzeTrends()
            }
        }
    }
    
    private func stopMonitoring() {
        monitoringTimer?.invalidate()
        monitoringTimer = nil
        
        trendAnalysisTimer?.invalidate()
        trendAnalysisTimer = nil
    }
    
    private func mapSeverityToHealthStatus(_ severity: FailureSeverity) -> HealthStatus {
        switch severity {
        case .low: return .healthy
        case .medium: return .warning
        case .high, .critical: return .critical
        }
    }
    
    deinit {
        stopMonitoring()
    }
}

// MARK: - Extension for Integration
extension FailurePreventionService {
    
    /// Record a connection attempt for monitoring
    public func recordConnectionAttempt(endpoint: String, success: Bool, latency: TimeInterval?) {
        if let connectionMonitor = monitors.first(where: { $0 is ConnectionMonitor }) as? ConnectionMonitor {
            connectionMonitor.recordConnectionAttempt(endpoint: endpoint, success: success, latency: latency)
        }
    }
    
    /// Record a performance metric for monitoring
    public func recordPerformanceMetric(
        cpuUsage: Double,
        memoryUsage: Double,
        responseTime: TimeInterval,
        operation: String
    ) {
        if let performanceMonitor = monitors.first(where: { $0 is PerformanceMonitor }) as? PerformanceMonitor {
            performanceMonitor.recordPerformanceMetric(
                cpuUsage: cpuUsage,
                memoryUsage: memoryUsage,
                responseTime: responseTime,
                operation: operation
            )
        }
    }
}