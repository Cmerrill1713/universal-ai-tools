import Foundation
import SwiftUI
import Combine
import OSLog

// MARK: - Conversation Monitoring Integration
@MainActor
public class ConversationMonitoringIntegration: ObservableObject {
    private let loggingService: LoggingService
    private let monitoringService: MonitoringService
    private let conversationAnalytics: ConversationAnalytics
    private let logger = Logger(subsystem: "com.universalai.tools", category: "conversation-integration")
    
    // Health check for conversation system
    private var conversationHealthCheck: ConversationHealthCheck?
    
    public init(
        loggingService: LoggingService = LoggingService.shared,
        monitoringService: MonitoringService = MonitoringService.shared,
        conversationAnalytics: ConversationAnalytics
    ) {
        self.loggingService = loggingService
        self.monitoringService = monitoringService
        self.conversationAnalytics = conversationAnalytics
        
        setupIntegration()
    }
    
    // MARK: - Setup Integration
    private func setupIntegration() {
        logger.info("Setting up conversation monitoring integration")
        
        // Add conversation health check to monitoring service
        conversationHealthCheck = ConversationHealthCheck(conversationAnalytics: conversationAnalytics)
        if let healthCheck = conversationHealthCheck {
            monitoringService.addHealthCheck(healthCheck)
        }
        
        // Setup periodic conversation metrics reporting
        setupMetricsReporting()
        
        // Setup conversation event logging
        setupEventLogging()
    }
    
    // MARK: - Metrics Integration
    private func setupMetricsReporting() {
        // Report conversation metrics every minute
        Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.reportConversationMetrics()
            }
        }
    }
    
    private func reportConversationMetrics() async {
        let metrics = conversationAnalytics.realtimeMetrics
        
        // Update monitoring service with conversation metrics
        await monitoringService.updateMetric(
            name: "conversation_active_sessions",
            value: Double(metrics.activeConversations)
        )
        
        await monitoringService.updateMetric(
            name: "conversation_total_interactions",
            value: Double(metrics.totalInteractions)
        )
        
        await monitoringService.updateMetric(
            name: "conversation_average_response_time",
            value: metrics.averageResponseTime
        )
        
        await monitoringService.updateMetric(
            name: "conversation_error_rate",
            value: Double(metrics.errorCount) / max(1.0, Double(metrics.totalInteractions))
        )
        
        await monitoringService.updateMetric(
            name: "conversation_voice_usage_rate",
            value: Double(metrics.voiceInteractions) / max(1.0, Double(metrics.totalInteractions))
        )
        
        // Check for performance issues
        if metrics.averageResponseTime > 5.0 {
            monitoringService.createAlert(
                type: .performance,
                title: "Slow Conversation Response",
                message: "Average conversation response time is \(String(format: "%.2f", metrics.averageResponseTime))s",
                severity: metrics.averageResponseTime > 10.0 ? .critical : .warning
            )
        }
        
        // Check for high error rates
        let errorRate = Double(metrics.errorCount) / max(1.0, Double(metrics.totalInteractions))
        if errorRate > 0.1 {
            monitoringService.createAlert(
                type: .system,
                title: "High Conversation Error Rate",
                message: "Conversation error rate is \(String(format: "%.1f", errorRate * 100))%",
                severity: errorRate > 0.25 ? .critical : .warning
            )
        }
    }
    
    // MARK: - Event Logging Integration
    private func setupEventLogging() {
        // Add conversation-specific log categories if needed
        logger.info("Conversation event logging integration configured")
    }
    
    // MARK: - Conversation-Specific Logging Methods
    func logConversationEvent(
        action: String,
        sessionId: UUID?,
        agentId: String?,
        metadata: [String: String] = [:]
    ) async {
        var enrichedMetadata = metadata
        enrichedMetadata["session_id"] = sessionId?.uuidString ?? "unknown"
        enrichedMetadata["agent_id"] = agentId ?? "unknown"
        enrichedMetadata["timestamp"] = ISO8601DateFormatter().string(from: Date())
        
        await loggingService.logEvent(
            category: "conversation",
            action: action,
            metadata: enrichedMetadata
        )
    }
    
    func logVoiceEvent(
        action: String,
        recognitionState: STTRecognitionState?,
        confidence: Double?,
        duration: TimeInterval?,
        metadata: [String: String] = [:]
    ) async {
        var enrichedMetadata = metadata
        
        if let state = recognitionState {
            enrichedMetadata["recognition_state"] = state.rawValue
        }
        
        if let confidence = confidence {
            enrichedMetadata["confidence"] = String(format: "%.2f", confidence)
        }
        
        if let duration = duration {
            enrichedMetadata["duration"] = String(format: "%.3f", duration)
        }
        
        await loggingService.logEvent(
            category: "voice",
            action: action,
            metadata: enrichedMetadata
        )
    }
    
    func logAgentEvent(
        action: String,
        agentId: String,
        responseTime: TimeInterval?,
        success: Bool,
        metadata: [String: String] = [:]
    ) async {
        var enrichedMetadata = metadata
        enrichedMetadata["agent_id"] = agentId
        enrichedMetadata["success"] = String(success)
        
        if let responseTime = responseTime {
            enrichedMetadata["response_time"] = String(format: "%.3f", responseTime)
        }
        
        await loggingService.logEvent(
            category: "agents",
            action: action,
            metadata: enrichedMetadata
        )
    }
    
    // MARK: - Analytics Integration
    func reportAnalyticsInsight(_ insight: ConversationInsight) async {
        // Log insight to logging service
        await loggingService.logEvent(
            category: "conversation",
            action: "insight_generated",
            metadata: [
                "insight_id": insight.id.uuidString,
                "category": insight.category.rawValue,
                "severity": insight.severity.rawValue,
                "title": insight.title,
                "actionable": String(insight.actionable)
            ]
        )
        
        // Create monitoring alert for high-severity insights
        if insight.severity == .high || insight.severity == .critical {
            monitoringService.createAlert(
                type: .system,
                title: "Conversation Insight: \(insight.title)",
                message: insight.description,
                severity: insight.severity == .critical ? .critical : .warning
            )
        }
    }
    
    func reportAgentPerformance(_ agentId: String, performance: AgentPerformanceAnalytics) async {
        // Track agent performance in monitoring service
        monitoringService.trackAPICall(
            endpoint: "/agents/\(agentId)",
            duration: performance.averageResponseTime,
            success: performance.successRate > 0.8
        )
        
        // Log performance summary
        await loggingService.logEvent(
            category: "agents",
            action: "performance_report",
            metadata: [
                "agent_id": agentId,
                "avg_response_time": String(format: "%.3f", performance.averageResponseTime),
                "success_rate": String(format: "%.2f", performance.successRate),
                "total_interactions": String(performance.totalInteractions),
                "error_rate": String(format: "%.2f", performance.errorRate)
            ]
        )
        
        // Create alerts for poor performance
        if performance.successRate < 0.7 {
            monitoringService.createAlert(
                type: .performance,
                title: "Agent Performance Issue",
                message: "Agent \(agentId) has a success rate of \(Int(performance.successRate * 100))%",
                severity: performance.successRate < 0.5 ? .critical : .warning
            )
        }
    }
    
    // MARK: - Health Check Integration
    func performConversationHealthCheck() async -> HealthCheckResult {
        guard let healthCheck = conversationHealthCheck else {
            return HealthCheckResult(
                name: "Conversation System",
                category: "conversation",
                status: .unknown,
                message: "Health check not available",
                duration: 0
            )
        }
        
        return await healthCheck.check()
    }
}

// MARK: - Conversation Health Check
class ConversationHealthCheck: HealthCheck {
    let name = "Conversation System"
    let category = "conversation"
    
    private let conversationAnalytics: ConversationAnalytics
    
    init(conversationAnalytics: ConversationAnalytics) {
        self.conversationAnalytics = conversationAnalytics
    }
    
    func check() async -> HealthCheckResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        let metrics = conversationAnalytics.realtimeMetrics
        let qualityMetrics = conversationAnalytics.qualityMetrics
        
        // Calculate overall health score
        var healthScore: Double = 100.0
        var issues: [String] = []
        
        // Check response time
        if metrics.averageResponseTime > 5.0 {
            healthScore -= 20.0
            issues.append("Slow response times")
        }
        
        // Check error rate
        let errorRate = Double(metrics.errorCount) / max(1.0, Double(metrics.totalInteractions))
        if errorRate > 0.1 {
            healthScore -= 30.0
            issues.append("High error rate")
        }
        
        // Check conversation quality
        if qualityMetrics.coherenceScore < 0.7 {
            healthScore -= 15.0
            issues.append("Low conversation coherence")
        }
        
        if qualityMetrics.userEngagementScore < 0.6 {
            healthScore -= 10.0
            issues.append("Low user engagement")
        }
        
        // Check for critical insights
        let criticalInsights = conversationAnalytics.insights.filter { $0.severity == .critical }
        if !criticalInsights.isEmpty {
            healthScore -= 25.0
            issues.append("\(criticalInsights.count) critical insights")
        }
        
        // Determine status
        let status: HealthStatus
        if healthScore >= 90 {
            status = .healthy
        } else if healthScore >= 70 {
            status = .warning
        } else {
            status = .critical
        }
        
        let message: String
        if issues.isEmpty {
            message = "Conversation system is operating normally"
        } else {
            message = "Issues detected: \(issues.joined(separator: ", "))"
        }
        
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        
        return HealthCheckResult(
            name: name,
            category: category,
            status: status,
            message: message,
            metadata: [
                "health_score": String(format: "%.1f", healthScore),
                "active_sessions": String(metrics.activeConversations),
                "total_interactions": String(metrics.totalInteractions),
                "error_rate": String(format: "%.2f", errorRate),
                "avg_response_time": String(format: "%.3f", metrics.averageResponseTime),
                "coherence_score": String(format: "%.2f", qualityMetrics.coherenceScore),
                "engagement_score": String(format: "%.2f", qualityMetrics.userEngagementScore)
            ],
            duration: duration
        )
    }
}

// MARK: - Extension for LoggingService
extension LoggingService {
    /// Log conversation events with structured metadata
    func logEvent(
        category: String,
        action: String,
        metadata: [String: String] = [:]
    ) async {
        let logCategory: LogCategory
        switch category {
        case "conversation":
            logCategory = .chat
        case "voice":
            logCategory = .voice
        case "agents":
            logCategory = .agents
        default:
            logCategory = .app
        }
        
        info(
            "[\(category)] \(action)",
            category: logCategory,
            metadata: metadata
        )
    }
    
    /// Log conversation performance metrics
    func logConversationPerformance(
        operation: String,
        duration: TimeInterval,
        success: Bool,
        metadata: [String: String] = [:]
    ) {
        var enrichedMetadata = metadata
        enrichedMetadata["duration"] = String(format: "%.3f", duration)
        enrichedMetadata["success"] = String(success)
        
        if success {
            info(
                "Conversation operation completed: \(operation)",
                category: .performance,
                metadata: enrichedMetadata
            )
        } else {
            warning(
                "Conversation operation failed: \(operation)",
                category: .performance,
                metadata: enrichedMetadata
            )
        }
    }
}

// MARK: - Extension for MonitoringService
extension MonitoringService {
    /// Update a custom metric value
    func updateMetric(name: String, value: Double) async {
        // Store metric for later retrieval or send to monitoring backend
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .utility).async {
                // In a real implementation, this would store the metric
                // For now, we'll just log it
                let logger = LoggingService.shared
                logger.debug(
                    "Metric updated: \(name) = \(value)",
                    category: .monitoring,
                    metadata: [
                        "metric_name": name,
                        "metric_value": String(value),
                        "timestamp": ISO8601DateFormatter().string(from: Date())
                    ]
                )
                continuation.resume()
            }
        }
    }
    
    /// Track conversation-specific metrics
    func trackConversationMetric(
        name: String,
        value: Double,
        sessionId: UUID?,
        agentId: String?
    ) async {
        var metadata: [String: String] = [
            "metric_name": name,
            "metric_value": String(value)
        ]
        
        if let sessionId = sessionId {
            metadata["session_id"] = sessionId.uuidString
        }
        
        if let agentId = agentId {
            metadata["agent_id"] = agentId
        }
        
        await updateMetric(name: "conversation_\(name)", value: value)
        
        // Also log to logging service
        LoggingService.shared.debug(
            "Conversation metric: \(name) = \(value)",
            category: .monitoring,
            metadata: metadata
        )
    }
}

// MARK: - Conversation Monitoring Dashboard Data
struct ConversationMonitoringData: Codable {
    let timestamp: Date
    let activeConversations: Int
    let totalInteractions: Int
    let averageResponseTime: TimeInterval
    let errorRate: Double
    let voiceUsageRate: Double
    let topPerformingAgents: [String]
    let recentInsights: [ConversationInsight]
    let healthStatus: HealthStatus
    
    static func current(from analytics: ConversationAnalytics) -> ConversationMonitoringData {
        let metrics = analytics.realtimeMetrics
        
        return ConversationMonitoringData(
            timestamp: Date(),
            activeConversations: metrics.activeConversations,
            totalInteractions: metrics.totalInteractions,
            averageResponseTime: metrics.averageResponseTime,
            errorRate: Double(metrics.errorCount) / max(1.0, Double(metrics.totalInteractions)),
            voiceUsageRate: Double(metrics.voiceInteractions) / max(1.0, Double(metrics.totalInteractions)),
            topPerformingAgents: analytics.getTopPerformingAgents(),
            recentInsights: Array(analytics.insights.suffix(5)),
            healthStatus: determineHealthStatus(from: analytics)
        )
    }
    
    private static func determineHealthStatus(from analytics: ConversationAnalytics) -> HealthStatus {
        let metrics = analytics.realtimeMetrics
        let qualityMetrics = analytics.qualityMetrics
        
        let errorRate = Double(metrics.errorCount) / max(1.0, Double(metrics.totalInteractions))
        
        if errorRate > 0.25 || metrics.averageResponseTime > 10.0 || qualityMetrics.coherenceScore < 0.5 {
            return .critical
        } else if errorRate > 0.1 || metrics.averageResponseTime > 5.0 || qualityMetrics.coherenceScore < 0.7 {
            return .warning
        } else {
            return .healthy
        }
    }
}

// MARK: - Real-time Updates
@MainActor
class ConversationMonitoringPublisher: ObservableObject {
    @Published var monitoringData: ConversationMonitoringData?
    @Published var isConnected: Bool = false
    
    private let integration: ConversationMonitoringIntegration
    private let conversationAnalytics: ConversationAnalytics
    private var updateTimer: Timer?
    
    init(
        integration: ConversationMonitoringIntegration,
        conversationAnalytics: ConversationAnalytics
    ) {
        self.integration = integration
        self.conversationAnalytics = conversationAnalytics
        
        startPeriodicUpdates()
    }
    
    private func startPeriodicUpdates() {
        updateTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateMonitoringData()
            }
        }
    }
    
    private func updateMonitoringData() {
        monitoringData = ConversationMonitoringData.current(from: conversationAnalytics)
        isConnected = true
    }
    
    deinit {
        updateTimer?.invalidate()
    }
}