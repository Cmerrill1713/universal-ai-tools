import Foundation
import SwiftUI
import Combine
import OSLog

// Import conversation models
// ConversationSession and ConversationMode are now in ConversationModels.swift

// MARK: - Conversation Analytics Data Models

struct ConversationInsight {
    let id: UUID
    let title: String
    let description: String
    let category: InsightCategory
    let severity: InsightSeverity
    let actionable: Bool
    let timestamp: Date
    let metadata: [String: Any]
    
    enum InsightCategory: String, CaseIterable {
        case performance = "performance"
        case usage = "usage"
        case quality = "quality"
        case errors = "errors"
        case optimization = "optimization"
        
        var displayName: String {
            switch self {
            case .performance: return "Performance"
            case .usage: return "Usage Patterns"
            case .quality: return "Quality Metrics"
            case .errors: return "Error Analysis"
            case .optimization: return "Optimization"
            }
        }
        
        var icon: String {
            switch self {
            case .performance: return "speedometer"
            case .usage: return "chart.bar"
            case .quality: return "star"
            case .errors: return "exclamationmark.triangle"
            case .optimization: return "wand.and.stars"
            }
        }
    }
    
    enum InsightSeverity: String, CaseIterable {
        case low = "low"
        case medium = "medium"
        case high = "high"
        case critical = "critical"
        
        var color: Color {
            switch self {
            case .low: return .green
            case .medium: return .yellow
            case .high: return .orange
            case .critical: return .red
            }
        }
    }
}

struct AgentPerformanceAnalytics {
    let agentId: String
    let averageResponseTime: TimeInterval
    let successRate: Double
    let totalInteractions: Int
    let errorRate: Double
    let userSatisfactionScore: Double
    let preferredContextLength: Int
    let peakUsageHours: [Int]
    let commonTopics: [String]
    let improvementSuggestions: [String]
}

struct ConversationQualityMetrics {
    let coherenceScore: Double
    let contextRelevanceScore: Double
    let responseCompletenessScore: Double
    let userEngagementScore: Double
    let conversationFlowScore: Double
    let averageMessageLength: Double
    let topicConsistencyScore: Double
    let clarificationRequestRate: Double
}

struct UsagePattern {
    let timeOfDay: Int // Hour of day (0-23)
    let dayOfWeek: Int // Day of week (1-7)
    let conversationMode: ConversationMode
    let preferredAgents: [String]
    let averageSessionDuration: TimeInterval
    let messageFrequency: Double
    let voiceUsageRate: Double
}

// MARK: - Conversation Analytics Service
@MainActor
public class ConversationAnalytics: ObservableObject {
    @Published var insights: [ConversationInsight] = []
    @Published var agentPerformance: [String: AgentPerformanceAnalytics] = [:]
    @Published var qualityMetrics: ConversationQualityMetrics
    @Published var usagePatterns: [UsagePattern] = []
    @Published var isAnalyzing: Bool = false
    @Published var lastAnalysisDate: Date?
    
    // Real-time metrics
    @Published var realtimeMetrics: RealtimeMetrics = RealtimeMetrics()
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "conversation-analytics")
    private let loggingService: LoggingService
    private let monitoringService: MonitoringService
    private var cancellables = Set<AnyCancellable>()
    
    // Analytics storage
    private var conversationData: [ConversationSession] = []
    private var interactionHistory: [ConversationInteraction] = []
    
    public init(loggingService: LoggingService, monitoringService: MonitoringService) {
        self.loggingService = loggingService
        self.monitoringService = monitoringService
        self.qualityMetrics = ConversationQualityMetrics(
            coherenceScore: 0.0,
            contextRelevanceScore: 0.0,
            responseCompletenessScore: 0.0,
            userEngagementScore: 0.0,
            conversationFlowScore: 0.0,
            averageMessageLength: 0.0,
            topicConsistencyScore: 0.0,
            clarificationRequestRate: 0.0
        )
        
        setupAnalytics()
    }
    
    // MARK: - Setup
    private func setupAnalytics() {
        logger.info("Setting up ConversationAnalytics")
        
        // Use background queue for heavy analysis work
        let analysisQueue = DispatchQueue(label: "analytics", qos: .utility)
        
        // Schedule periodic analysis on background queue
        Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            analysisQueue.async {
                Task { @MainActor [weak self] in
                    await self?.performPeriodicAnalysis()
                }
            }
        }
        
        // Setup real-time monitoring
        startRealtimeMonitoring()
    }
    
    // MARK: - Data Collection
    func recordConversationStart(_ session: ConversationSession) async {
        conversationData.append(session)
        realtimeMetrics.activeConversations += 1
        
        await loggingService.logEvent(
            category: "conversation_analytics",
            action: "session_started",
            metadata: [
                "session_id": session.id.uuidString,
                "agent_type": session.agentType,
                "mode": session.mode.rawValue
            ]
        )
    }
    
    func recordConversationEnd(_ session: ConversationSession) async {
        if let index = conversationData.firstIndex(where: { $0.id == session.id }) {
            conversationData[index] = session
        }
        
        realtimeMetrics.activeConversations = max(0, realtimeMetrics.activeConversations - 1)
        realtimeMetrics.completedConversations += 1
        
        await analyzeCompletedSession(session)
    }
    
    func recordInteraction(
        sessionId: UUID,
        userInput: String,
        agentResponse: String,
        responseTime: TimeInterval,
        agentId: String,
        isVoiceInput: Bool = false
    ) async {
        let interaction = ConversationInteraction(
            id: UUID(),
            sessionId: sessionId,
            userInput: userInput,
            agentResponse: agentResponse,
            responseTime: responseTime,
            agentId: agentId,
            isVoiceInput: isVoiceInput,
            timestamp: Date()
        )
        
        interactionHistory.append(interaction)
        realtimeMetrics.totalInteractions += 1
        
        if isVoiceInput {
            realtimeMetrics.voiceInteractions += 1
        }
        
        // Update real-time response time
        updateAverageResponseTime(responseTime)
        
        await loggingService.logEvent(
            category: "conversation_analytics",
            action: "interaction_recorded",
            metadata: [
                "session_id": sessionId.uuidString,
                "agent_id": agentId,
                "response_time": "\(responseTime)",
                "is_voice": "\(isVoiceInput)"
            ]
        )
    }
    
    func recordError(
        sessionId: UUID?,
        agentId: String?,
        errorType: String,
        errorMessage: String
    ) async {
        realtimeMetrics.errorCount += 1
        
        await loggingService.logEvent(
            category: "conversation_analytics",
            action: "error_recorded",
            metadata: [
                "session_id": sessionId?.uuidString ?? "unknown",
                "agent_id": agentId ?? "unknown",
                "error_type": errorType,
                "error_message": errorMessage
            ]
        )
        
        // Generate error insight
        let insight = ConversationInsight(
            id: UUID(),
            title: "Conversation Error Detected",
            description: "Error in \(agentId ?? "unknown") agent: \(errorMessage)",
            category: .errors,
            severity: .high,
            actionable: true,
            timestamp: Date(),
            metadata: [
                "error_type": errorType,
                "agent_id": agentId ?? "unknown"
            ]
        )
        
        insights.append(insight)
    }
    
    // MARK: - Analysis
    func performComprehensiveAnalysis() async {
        isAnalyzing = true
        
        logger.info("Starting comprehensive conversation analysis")
        
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.analyzeAgentPerformance() }
            group.addTask { await self.analyzeConversationQuality() }
            group.addTask { await self.analyzeUsagePatterns() }
            group.addTask { await self.generateInsights() }
        }
        
        lastAnalysisDate = Date()
        isAnalyzing = false
        
        logger.info("Comprehensive analysis completed")
    }
    
    private func performPeriodicAnalysis() async {
        await analyzeRecentInteractions()
        await updateRealtimeMetrics()
    }
    
    private func analyzeAgentPerformance() async {
        logger.info("Analyzing agent performance")
        
        let agentIds = Set(interactionHistory.map { $0.agentId })
        
        for agentId in agentIds {
            let agentInteractions = interactionHistory.filter { $0.agentId == agentId }
            
            guard !agentInteractions.isEmpty else { continue }
            
            let totalInteractions = agentInteractions.count
            let averageResponseTime = agentInteractions.map { $0.responseTime }.reduce(0, +) / Double(totalInteractions)
            let successfulInteractions = agentInteractions.filter { $0.responseTime < 10.0 }.count // Assume <10s is successful
            let successRate = Double(successfulInteractions) / Double(totalInteractions)
            let errorRate = 1.0 - successRate
            
            // Analyze usage patterns for this agent
            let peakHours = analyzeAgentPeakHours(agentInteractions)
            let commonTopics = extractCommonTopics(agentInteractions)
            let improvements = generateImprovementSuggestions(agentId, interactions: agentInteractions)
            
            let analytics = AgentPerformanceAnalytics(
                agentId: agentId,
                averageResponseTime: averageResponseTime,
                successRate: successRate,
                totalInteractions: totalInteractions,
                errorRate: errorRate,
                userSatisfactionScore: calculateSatisfactionScore(agentInteractions),
                preferredContextLength: calculateOptimalContextLength(agentInteractions),
                peakUsageHours: peakHours,
                commonTopics: commonTopics,
                improvementSuggestions: improvements
            )
            
            agentPerformance[agentId] = analytics
        }
    }
    
    private func analyzeConversationQuality() async {
        logger.info("Analyzing conversation quality")
        
        guard !interactionHistory.isEmpty else { return }
        
        let coherenceScore = calculateCoherenceScore()
        let contextRelevanceScore = calculateContextRelevanceScore()
        let responseCompletenessScore = calculateResponseCompletenessScore()
        let userEngagementScore = calculateUserEngagementScore()
        let conversationFlowScore = calculateConversationFlowScore()
        let averageMessageLength = calculateAverageMessageLength()
        let topicConsistencyScore = calculateTopicConsistencyScore()
        let clarificationRequestRate = calculateClarificationRequestRate()
        
        qualityMetrics = ConversationQualityMetrics(
            coherenceScore: coherenceScore,
            contextRelevanceScore: contextRelevanceScore,
            responseCompletenessScore: responseCompletenessScore,
            userEngagementScore: userEngagementScore,
            conversationFlowScore: conversationFlowScore,
            averageMessageLength: averageMessageLength,
            topicConsistencyScore: topicConsistencyScore,
            clarificationRequestRate: clarificationRequestRate
        )
    }
    
    private func analyzeUsagePatterns() async {
        logger.info("Analyzing usage patterns")
        
        let groupedByHour = Dictionary(grouping: interactionHistory) { interaction in
            Calendar.current.component(.hour, from: interaction.timestamp)
        }
        
        let groupedByDay = Dictionary(grouping: interactionHistory) { interaction in
            Calendar.current.component(.weekday, from: interaction.timestamp)
        }
        
        usagePatterns = []
        
        for (hour, interactions) in groupedByHour {
            let pattern = UsagePattern(
                timeOfDay: hour,
                dayOfWeek: 0, // Will be updated with day analysis
                conversationMode: .hybrid, // Analyze from interactions
                preferredAgents: Array(Set(interactions.map { $0.agentId })),
                averageSessionDuration: calculateAverageSessionDuration(interactions),
                messageFrequency: Double(interactions.count),
                voiceUsageRate: Double(interactions.filter { $0.isVoiceInput }.count) / Double(interactions.count)
            )
            
            usagePatterns.append(pattern)
        }
    }
    
    private func generateInsights() async {
        logger.info("Generating conversation insights")
        
        var newInsights: [ConversationInsight] = []
        
        // Performance insights
        for (agentId, performance) in agentPerformance {
            if performance.successRate < 0.8 {
                let insight = ConversationInsight(
                    id: UUID(),
                    title: "Low Success Rate Detected",
                    description: "\(agentId) agent has a success rate of \(Int(performance.successRate * 100))%. Consider optimization.",
                    category: .performance,
                    severity: performance.successRate < 0.5 ? .critical : .high,
                    actionable: true,
                    timestamp: Date(),
                    metadata: ["agent_id": agentId, "success_rate": performance.successRate]
                )
                newInsights.append(insight)
            }
            
            if performance.averageResponseTime > 5.0 {
                let insight = ConversationInsight(
                    id: UUID(),
                    title: "Slow Response Time",
                    description: "\(agentId) agent has an average response time of \(String(format: "%.1f", performance.averageResponseTime))s.",
                    category: .performance,
                    severity: performance.averageResponseTime > 10.0 ? .high : .medium,
                    actionable: true,
                    timestamp: Date(),
                    metadata: ["agent_id": agentId, "response_time": performance.averageResponseTime]
                )
                newInsights.append(insight)
            }
        }
        
        // Quality insights
        if qualityMetrics.coherenceScore < 0.7 {
            let insight = ConversationInsight(
                id: UUID(),
                title: "Low Conversation Coherence",
                description: "Conversations show low coherence score (\(Int(qualityMetrics.coherenceScore * 100))%). Review context management.",
                category: .quality,
                severity: .medium,
                actionable: true,
                timestamp: Date(),
                metadata: ["coherence_score": qualityMetrics.coherenceScore]
            )
            newInsights.append(insight)
        }
        
        // Usage insights
        let voiceUsage = realtimeMetrics.voiceInteractions / max(1, realtimeMetrics.totalInteractions)
        if voiceUsage > 0.7 {
            let insight = ConversationInsight(
                id: UUID(),
                title: "High Voice Usage",
                description: "Voice interactions account for \(Int(voiceUsage * 100))% of conversations. Consider voice optimization.",
                category: .usage,
                severity: .low,
                actionable: true,
                timestamp: Date(),
                metadata: ["voice_usage_rate": voiceUsage]
            )
            newInsights.append(insight)
        }
        
        // Add new insights
        insights.append(contentsOf: newInsights)
        
        // Keep only recent insights (last 50)
        if insights.count > 50 {
            insights = Array(insights.suffix(50))
        }
    }
    
    // MARK: - Real-time Monitoring
    private func startRealtimeMonitoring() {
        Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.updateRealtimeMetrics()
            }
        }
    }
    
    private func updateRealtimeMetrics() async {
        // Update metrics from monitoring service
        await monitoringService.updateMetric(
            name: "conversation_active_sessions",
            value: Double(realtimeMetrics.activeConversations)
        )
        
        await monitoringService.updateMetric(
            name: "conversation_total_interactions",
            value: Double(realtimeMetrics.totalInteractions)
        )
        
        await monitoringService.updateMetric(
            name: "conversation_average_response_time",
            value: realtimeMetrics.averageResponseTime
        )
        
        await monitoringService.updateMetric(
            name: "conversation_error_rate",
            value: Double(realtimeMetrics.errorCount) / max(1.0, Double(realtimeMetrics.totalInteractions))
        )
    }
    
    // MARK: - Helper Methods
    private func analyzeCompletedSession(_ session: ConversationSession) async {
        // Analyze individual session for immediate insights
        if session.messageCount < 2 {
            let insight = ConversationInsight(
                id: UUID(),
                title: "Short Conversation",
                description: "Session ended with only \(session.messageCount) messages. User may not have found value.",
                category: .quality,
                severity: .low,
                actionable: true,
                timestamp: Date(),
                metadata: ["session_id": session.id.uuidString, "message_count": session.messageCount]
            )
            insights.append(insight)
        }
    }
    
    private func updateAverageResponseTime(_ newResponseTime: TimeInterval) {
        let totalTime = realtimeMetrics.averageResponseTime * Double(realtimeMetrics.totalInteractions - 1)
        realtimeMetrics.averageResponseTime = (totalTime + newResponseTime) / Double(realtimeMetrics.totalInteractions)
    }
    
    private func analyzeRecentInteractions() async {
        // Analyze interactions from the last hour
        let oneHourAgo = Date().addingTimeInterval(-3600)
        let recentInteractions = interactionHistory.filter { $0.timestamp > oneHourAgo }
        
        if !recentInteractions.isEmpty {
            let averageResponseTime = recentInteractions.map { $0.responseTime }.reduce(0, +) / Double(recentInteractions.count)
            realtimeMetrics.averageResponseTime = averageResponseTime
        }
    }
    
    // MARK: - Quality Calculation Methods
    private func calculateCoherenceScore() -> Double {
        // Simplified coherence calculation
        return Double.random(in: 0.7...0.95) // Placeholder implementation
    }
    
    private func calculateContextRelevanceScore() -> Double {
        return Double.random(in: 0.75...0.9) // Placeholder implementation
    }
    
    private func calculateResponseCompletenessScore() -> Double {
        return Double.random(in: 0.8...0.95) // Placeholder implementation
    }
    
    private func calculateUserEngagementScore() -> Double {
        let averageSessionLength = conversationData.map { 
            $0.endTime?.timeIntervalSince($0.startTime) ?? 0 
        }.reduce(0, +) / Double(max(1, conversationData.count))
        
        // Normalize to 0-1 scale (assuming 30 minutes is excellent engagement)
        return min(1.0, averageSessionLength / 1800.0)
    }
    
    private func calculateConversationFlowScore() -> Double {
        return Double.random(in: 0.7...0.9) // Placeholder implementation
    }
    
    private func calculateAverageMessageLength() -> Double {
        let allMessages = interactionHistory.flatMap { [$0.userInput, $0.agentResponse] }
        let totalLength = allMessages.map { $0.count }.reduce(0, +)
        return Double(totalLength) / Double(max(1, allMessages.count))
    }
    
    private func calculateTopicConsistencyScore() -> Double {
        return Double.random(in: 0.6...0.85) // Placeholder implementation
    }
    
    private func calculateClarificationRequestRate() -> Double {
        let clarificationRequests = interactionHistory.filter { interaction in
            interaction.agentResponse.localizedCaseInsensitiveContains("clarify") ||
            interaction.agentResponse.localizedCaseInsensitiveContains("understand") ||
            interaction.agentResponse.localizedCaseInsensitiveContains("explain")
        }
        
        return Double(clarificationRequests.count) / Double(max(1, interactionHistory.count))
    }
    
    // MARK: - Agent Analysis Helpers
    private func analyzeAgentPeakHours(_ interactions: [ConversationInteraction]) -> [Int] {
        let hourCounts = Dictionary(grouping: interactions) { interaction in
            Calendar.current.component(.hour, from: interaction.timestamp)
        }.mapValues { $0.count }
        
        return hourCounts.sorted { $0.value > $1.value }.prefix(3).map { $0.key }
    }
    
    private func extractCommonTopics(_ interactions: [ConversationInteraction]) -> [String] {
        // Simplified topic extraction - in production, use NLP
        let commonWords = ["code", "data", "analysis", "research", "help", "question"]
        return commonWords.filter { word in
            interactions.contains { interaction in
                interaction.userInput.localizedCaseInsensitiveContains(word)
            }
        }
    }
    
    private func generateImprovementSuggestions(_ agentId: String, interactions: [ConversationInteraction]) -> [String] {
        var suggestions: [String] = []
        
        let avgResponseTime = interactions.map { $0.responseTime }.reduce(0, +) / Double(interactions.count)
        if avgResponseTime > 3.0 {
            suggestions.append("Optimize response time - currently \(String(format: "%.1f", avgResponseTime))s")
        }
        
        let errorCount = interactions.filter { $0.responseTime > 10.0 }.count
        if errorCount > interactions.count / 10 {
            suggestions.append("Reduce timeout errors - \(errorCount) timeouts detected")
        }
        
        return suggestions
    }
    
    private func calculateSatisfactionScore(_ interactions: [ConversationInteraction]) -> Double {
        // Simplified satisfaction calculation based on interaction patterns
        let quickResponses = interactions.filter { $0.responseTime < 2.0 }.count
        return Double(quickResponses) / Double(max(1, interactions.count))
    }
    
    private func calculateOptimalContextLength(_ interactions: [ConversationInteraction]) -> Int {
        let averageInputLength = interactions.map { $0.userInput.count }.reduce(0, +) / interactions.count
        let averageOutputLength = interactions.map { $0.agentResponse.count }.reduce(0, +) / interactions.count
        
        return max(2000, averageInputLength + averageOutputLength)
    }
    
    private func calculateAverageSessionDuration(_ interactions: [ConversationInteraction]) -> TimeInterval {
        // Group by session and calculate duration
        let sessionGroups = Dictionary(grouping: interactions) { $0.sessionId }
        
        let durations = sessionGroups.compactMap { (sessionId, sessionInteractions) -> TimeInterval? in
            guard let first = sessionInteractions.min(by: { $0.timestamp < $1.timestamp }),
                  let last = sessionInteractions.max(by: { $0.timestamp < $1.timestamp }) else {
                return nil
            }
            return last.timestamp.timeIntervalSince(first.timestamp)
        }
        
        return durations.isEmpty ? 0 : durations.reduce(0, +) / Double(durations.count)
    }
    
    // MARK: - Public Interface
    func getInsightsByCategory(_ category: ConversationInsight.InsightCategory) -> [ConversationInsight] {
        return insights.filter { $0.category == category }
    }
    
    func getActionableInsights() -> [ConversationInsight] {
        return insights.filter { $0.actionable }
    }
    
    func markInsightAsResolved(_ insightId: UUID) {
        insights.removeAll { $0.id == insightId }
    }
    
    func exportAnalytics() -> [String: Any] {
        return [
            "insights": insights.count,
            "agent_performance": agentPerformance.keys.count,
            "quality_metrics": [
                "coherence": qualityMetrics.coherenceScore,
                "engagement": qualityMetrics.userEngagementScore,
                "flow": qualityMetrics.conversationFlowScore
            ],
            "realtime_metrics": [
                "active_conversations": realtimeMetrics.activeConversations,
                "total_interactions": realtimeMetrics.totalInteractions,
                "average_response_time": realtimeMetrics.averageResponseTime,
                "error_count": realtimeMetrics.errorCount
            ]
        ]
    }
}

// MARK: - Supporting Data Models

struct ConversationInteraction {
    let id: UUID
    let sessionId: UUID
    let userInput: String
    let agentResponse: String
    let responseTime: TimeInterval
    let agentId: String
    let isVoiceInput: Bool
    let timestamp: Date
}

struct RealtimeMetrics {
    var activeConversations: Int = 0
    var totalInteractions: Int = 0
    var completedConversations: Int = 0
    var voiceInteractions: Int = 0
    var averageResponseTime: TimeInterval = 0.0
    var errorCount: Int = 0
}

// MARK: - Analytics Extensions
extension ConversationAnalytics {
    // Convenience methods for common analytics queries
    
    func getTopPerformingAgents() -> [String] {
        return agentPerformance
            .sorted { $0.value.successRate > $1.value.successRate }
            .prefix(5)
            .map { $0.key }
    }
    
    func getPoorPerformingAgents() -> [String] {
        return agentPerformance
            .filter { $0.value.successRate < 0.7 }
            .map { $0.key }
    }
    
    func getHighPriorityInsights() -> [ConversationInsight] {
        return insights
            .filter { $0.severity == .high || $0.severity == .critical }
            .sorted { $0.timestamp > $1.timestamp }
    }
}