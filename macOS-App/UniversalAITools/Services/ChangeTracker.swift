import Combine
import Foundation
import OSLog
import SwiftUI

// MARK: - Change Event Types
// ChangeEventType is already defined in LoggingTypes.swift

// MARK: - Feature Usage
// FeatureUsage is already defined in LoggingTypes.swift

// MARK: - Change Event (Using from SharedTypes.swift)
// Note: ChangeEvent is defined in SharedTypes.swift to avoid conflicts

// MARK: - User Interaction Types
public enum UserInteractionType: String, Codable, CaseIterable {
    case click = "click"
    case keyPress = "key_press"
    case drag = "drag"
    case drop = "drop"
    case scroll = "scroll"
    case pinch = "pinch"
    case swipe = "swipe"
    case hover = "hover"
    case focus = "focus"
    case blur = "blur"
    case textInput = "text_input"
    case voiceInput = "voice_input"
    case gesture = "gesture"
}

// MARK: - Feature Usage Tracking
// Note: FeatureUsage is defined in LoggingTypes.swift to avoid conflicts

// MARK: - Workflow Step Tracking
public struct WorkflowStep: Codable, Identifiable {
    public let id: UUID
    public let workflowName: String
    public let stepName: String
    public let stepIndex: Int
    public let timestamp: Date
    public let duration: TimeInterval?
    public let success: Bool
    public let errorMessage: String?
    public let metadata: [String: String]
    
    public init(
        workflowName: String,
        stepName: String,
        stepIndex: Int,
        duration: TimeInterval? = nil,
        success: Bool = true,
        errorMessage: String? = nil,
        metadata: [String: String] = [:]
    ) {
        self.id = UUID()
        self.workflowName = workflowName
        self.stepName = stepName
        self.stepIndex = stepIndex
        self.timestamp = Date()
        self.duration = duration
        self.success = success
        self.errorMessage = errorMessage
        self.metadata = metadata
    }
}

// MARK: - Change Pattern Detection (Using from SharedTypes.swift)
// Note: ChangePattern is defined in SharedTypes.swift to avoid conflicts

public struct PatternCondition: Codable {
    public let eventType: ChangeEventType
    public let source: String?
    public let action: String?
    public let timeWindow: TimeInterval
    public let minOccurrences: Int
}

// MARK: - Analytics Data (Using from SharedTypes.swift)
// Note: AnalyticsSnapshot is defined in SharedTypes.swift to avoid conflicts

// Extended analytics data specific to ChangeTracker
public struct DetailedAnalyticsSnapshot: Codable {
    public let timestamp: Date
    public let sessionDuration: TimeInterval
    public let eventCounts: [ChangeEventType: Int]
    public let featureUsage: [String: FeatureUsage]
    public let userInteractionCounts: [UserInteractionType: Int]
    public let mostUsedFeatures: [String]
    public let commonWorkflows: [String]
    public let errorPatterns: [String]
    public let performanceMetrics: [String: Double]
}

// MARK: - Change Storage Protocol
public protocol ChangeStorage {
    func store(_ event: ChangeEvent) async
    func store(_ workflowStep: WorkflowStep) async
    func retrieve(
        since: Date?,
        type: ChangeEventType?,
        source: String?,
        limit: Int?
    ) async -> [ChangeEvent]
    func getAnalyticsSnapshot() async -> AnalyticsSnapshot
    func clear() async
    func export() async -> Data?
}

// MARK: - Memory Change Storage
public class MemoryChangeStorage: ChangeStorage {
    private var events: [ChangeEvent] = []
    private var workflowSteps: [WorkflowStep] = []
    private let maxEvents: Int = 10000
    private let queue = DispatchQueue(label: "com.universalai.changetracking.memory", qos: .utility)
    
    public func store(_ event: ChangeEvent) async {
        await withCheckedContinuation { continuation in
            queue.async {
                self.events.append(event)
                
                // Keep only recent events
                if self.events.count > self.maxEvents {
                    self.events.removeFirst(self.events.count - self.maxEvents)
                }
                
                continuation.resume()
            }
        }
    }
    
    public func store(_ workflowStep: WorkflowStep) async {
        await withCheckedContinuation { continuation in
            queue.async {
                self.workflowSteps.append(workflowStep)
                
                // Keep only recent workflow steps
                if self.workflowSteps.count > self.maxEvents {
                    self.workflowSteps.removeFirst(self.workflowSteps.count - self.maxEvents)
                }
                
                continuation.resume()
            }
        }
    }
    
    public func retrieve(
        since: Date? = nil,
        type: ChangeEventType? = nil,
        source: String? = nil,
        limit: Int? = nil
    ) async -> [ChangeEvent] {
        return await withCheckedContinuation { continuation in
            queue.async {
                var filtered = self.events
                
                if let since = since {
                    filtered = filtered.filter { $0.timestamp >= since }
                }
                
                if let type = type {
                    filtered = filtered.filter { $0.type == type }
                }
                
                if let source = source {
                    filtered = filtered.filter { $0.source == source }
                }
                
                // Sort by timestamp (newest first)
                filtered.sort { $0.timestamp > $1.timestamp }
                
                if let limit = limit {
                    filtered = Array(filtered.prefix(limit))
                }
                
                continuation.resume(returning: filtered)
            }
        }
    }
    
    public func getAnalyticsSnapshot() async -> AnalyticsSnapshot {
        return await withCheckedContinuation { continuation in
            queue.async {
                let now = Date()
                let sessionStart = self.events.first?.timestamp ?? now
                let sessionDuration = now.timeIntervalSince(sessionStart)
                
                // Event counts by type
                var eventCounts: [ChangeEventType: Int] = [:]
                for event in self.events {
                    eventCounts[event.type, default: 0] += 1
                }
                
                // Feature usage analysis
                let featureEvents = self.events.filter { $0.type == .featureUsage }
                var featureUsage: [String: FeatureUsage] = [:]
                
                for event in featureEvents {
                    let featureName = event.source
                    let duration = Double(event.metadata["duration"] ?? "0") ?? 0
                    
                    if var usage = featureUsage[featureName] {
                        let newUsageCount = usage.usageCount + 1
                        let newTotalDuration = usage.totalDuration + duration
                        let newAverageDuration = newTotalDuration / Double(newUsageCount)
                        
                        featureUsage[featureName] = FeatureUsage(
                            featureName: featureName,
                            usageCount: newUsageCount,
                            totalDuration: newTotalDuration,
                            averageDuration: newAverageDuration,
                            lastUsed: event.timestamp,
                            firstUsed: usage.firstUsed,
                            metadata: usage.metadata
                        )
                    } else {
                        featureUsage[featureName] = FeatureUsage(
                            featureName: featureName,
                            usageCount: 1,
                            totalDuration: duration,
                            averageDuration: duration,
                            lastUsed: event.timestamp,
                            firstUsed: event.timestamp,
                            metadata: [:]
                        )
                    }
                }
                
                // User interaction counts
                let interactionEvents = self.events.filter { $0.type == .userInteraction }
                var interactionCounts: [UserInteractionType: Int] = [:]
                
                for event in interactionEvents {
                    if let interactionType = UserInteractionType(rawValue: event.action) {
                        interactionCounts[interactionType, default: 0] += 1
                    }
                }
                
                // Most used features
                let mostUsedFeatures = featureUsage
                    .sorted { $0.value.usageCount > $1.value.usageCount }
                    .prefix(10)
                    .map { $0.key }
                
                // Common workflows
                let workflowNames = Set(self.workflowSteps.map { $0.workflowName })
                let commonWorkflows = Array(workflowNames.prefix(10))
                
                // Error patterns
                let errorEvents = self.events.filter { $0.type == .errorEvent }
                let errorPatterns = Array(Set(errorEvents.compactMap { $0.metadata["error_type"] }))
                
                // Performance metrics
                let performanceEvents = self.events.filter { $0.type == .performanceEvent }
                var performanceMetrics: [String: Double] = [:]
                
                for event in performanceEvents {
                    if let durationString = event.metadata["duration"],
                       let duration = Double(durationString) {
                        let metric = event.metadata["metric"] ?? event.action
                        performanceMetrics[metric] = (performanceMetrics[metric] ?? 0) + duration
                    }
                }
                
                // Create a simplified analytics snapshot using the shared type
                let snapshot = AnalyticsSnapshot(
                    timestamp: now,
                    metrics: ["total_events": Double(self.events.count)],
                    events: Array(self.events.suffix(10).map { $0.type.rawValue }),
                    healthStatus: .healthy
                )
                
                continuation.resume(returning: snapshot)
            }
        }
    }
    
    public func clear() async {
        await withCheckedContinuation { continuation in
            queue.async {
                self.events.removeAll()
                self.workflowSteps.removeAll()
                continuation.resume()
            }
        }
    }
    
    public func export() async -> Data? {
        let events = await retrieve(since: nil, type: nil, source: nil, limit: nil)
        let snapshot = await getAnalyticsSnapshot()
        
        let exportData = [
            "events": events,
            "analytics": snapshot
        ]
        
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = .prettyPrinted
            return try encoder.encode(exportData)
        } catch {
            return nil
        }
    }
}

// MARK: - Main Change Tracker Service
@MainActor
public class ChangeTracker: ObservableObject {
    public static let shared = ChangeTracker()
    
    @Published public var isEnabled = true
    @Published public var recentEvents: [ChangeEvent] = []
    @Published public var analyticsSnapshot: AnalyticsSnapshot?
    @Published public var detectedPatterns: [ChangePattern] = []
    
    public let sessionID: String
    private let logger = LoggingService.shared
    private let storage: ChangeStorage
    private let maxRecentEvents = 50
    private var activeWorkflows: [String: WorkflowSession] = [:]
    private var featureStartTimes: [String: Date] = [:]
    private var patternDetectionTimer: Timer?
    
    // Configuration
    public var trackUserInteractions = true
    public var trackPerformanceEvents = true
    public var trackFeatureUsage = true
    public var trackWorkflows = true
    public var anonymizeData = false
    
    private struct WorkflowSession {
        let name: String
        let startTime: Date
        var steps: [WorkflowStep]
        var currentStepIndex: Int
    }
    
    private init() {
        self.sessionID = UUID().uuidString
        self.storage = MemoryChangeStorage()
        
        startPatternDetection()
        setupSystemEventTracking()
        
        logger.info("ChangeTracker initialized with session ID: \(sessionID)", 
                   category: .monitoring)
    }
    
    // MARK: - Event Tracking
    
    public func track(
        type: ChangeEventType,
        source: String,
        action: String,
        previousValue: String? = nil,
        newValue: String? = nil,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled else { return }
        
        let userID = anonymizeData ? nil : getCurrentUserID()
        
        let event = ChangeEvent(
            type: type,
            description: "\(source): \(action)",
            timestamp: Date(),
            metadata: metadata,
            source: source,
            action: action
        )
        
        Task {
            await storage.store(event)
            
            DispatchQueue.main.async {
                self.recentEvents.append(event)
                if self.recentEvents.count > self.maxRecentEvents {
                    self.recentEvents.removeFirst(self.recentEvents.count - self.maxRecentEvents)
                }
            }
        }
        
        logger.debug("Tracked change event: \(type.rawValue) - \(source).\(action)", 
                    category: .monitoring,
                    metadata: ["session_id": sessionID])
    }
    
    // MARK: - Specific Tracking Methods
    
    public func trackUserInteraction(
        type: UserInteractionType,
        component: String,
        details: String? = nil,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled && trackUserInteractions else { return }
        
        var enrichedMetadata = metadata
        enrichedMetadata["interaction_type"] = type.rawValue
        if let details = details {
            enrichedMetadata["details"] = details
        }
        
        track(
            type: ChangeEventType.userInteraction,
            source: component,
            action: type.rawValue,
            metadata: enrichedMetadata
        )
        
        logger.logUserInteraction(action: type.rawValue, component: component, metadata: enrichedMetadata)
    }
    
    public func trackViewNavigation(
        fromView: String,
        toView: String,
        navigationMethod: String = "unknown",
        metadata: [String: String] = [:]
    ) {
        guard isEnabled else { return }
        
        var enrichedMetadata = metadata
        enrichedMetadata["navigation_method"] = navigationMethod
        enrichedMetadata["from_view"] = fromView
        
        track(
            type: ChangeEventType.navigation,
            source: "navigation",
            action: "navigate",
            previousValue: fromView,
            newValue: toView,
            metadata: enrichedMetadata
        )
    }
    
    public func trackSettingsChange(
        setting: String,
        oldValue: String?,
        newValue: String,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled else { return }
        
        track(
            type: ChangeEventType.stateChange,
            source: "settings",
            action: "change",
            previousValue: oldValue,
            newValue: newValue,
            metadata: metadata.merging(["setting": setting]) { current, new in new }
        )
    }
    
    public func trackConnectionChange(
        service: String,
        connected: Bool,
        previousState: Bool?,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled else { return }
        
        var enrichedMetadata = metadata
        enrichedMetadata["service"] = service
        enrichedMetadata["connected"] = String(connected)
        
        track(
            type: ChangeEventType.stateChange,
            source: service,
            action: connected ? "connected" : "disconnected",
            previousValue: previousState.map(String.init),
            newValue: String(connected),
            metadata: enrichedMetadata
        )
    }
    
    public func trackAgentActivity(
        agentName: String,
        activity: String,
        success: Bool = true,
        duration: TimeInterval? = nil,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled else { return }
        
        var enrichedMetadata = metadata
        enrichedMetadata["agent_name"] = agentName
        enrichedMetadata["success"] = String(success)
        if let duration = duration {
            enrichedMetadata["duration"] = String(format: "%.3f", duration)
        }
        
        track(
            type: ChangeEventType.stateChange,
            source: agentName,
            action: activity,
            metadata: enrichedMetadata
        )
    }
    
    public func trackChatActivity(
        messageCount: Int,
        sessionDuration: TimeInterval,
        model: String? = nil,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled else { return }
        
        var enrichedMetadata = metadata
        enrichedMetadata["message_count"] = String(messageCount)
        enrichedMetadata["session_duration"] = String(format: "%.1f", sessionDuration)
        if let model = model {
            enrichedMetadata["model"] = model
        }
        
        track(
            type: ChangeEventType.userInteraction,
            source: "chat",
            action: "session_end",
            metadata: enrichedMetadata
        )
    }
    
    public func trackVoiceActivity(
        activity: String,
        duration: TimeInterval? = nil,
        success: Bool = true,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled else { return }
        
        var enrichedMetadata = metadata
        enrichedMetadata["success"] = String(success)
        if let duration = duration {
            enrichedMetadata["duration"] = String(format: "%.3f", duration)
        }
        
        track(
            type: ChangeEventType.userInteraction,
            source: "voice_system",
            action: activity,
            metadata: enrichedMetadata
        )
    }
    
    public func trackError(
        errorType: String,
        errorMessage: String,
        source: String,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled else { return }
        
        var enrichedMetadata = metadata
        enrichedMetadata["error_type"] = errorType
        enrichedMetadata["error_message"] = errorMessage
        
        track(
            type: ChangeEventType.error,
            source: source,
            action: "error_occurred",
            newValue: errorMessage,
            metadata: enrichedMetadata
        )
    }
    
    public func trackPerformanceEvent(
        metric: String,
        value: Double,
        source: String,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled && trackPerformanceEvents else { return }
        
        var enrichedMetadata = metadata
        enrichedMetadata["metric"] = metric
        enrichedMetadata["value"] = String(value)
        
        track(
            type: ChangeEventType.performance,
            source: source,
            action: "metric_recorded",
            newValue: String(value),
            metadata: enrichedMetadata
        )
    }
    
    // MARK: - Feature Usage Tracking
    
    public func startFeatureUsage(_ featureName: String) {
        guard isEnabled && trackFeatureUsage else { return }
        
        featureStartTimes[featureName] = Date()
        
        track(
            type: ChangeEventType.userInteraction,
            source: featureName,
            action: "feature_started"
        )
    }
    
    public func endFeatureUsage(_ featureName: String, success: Bool = true) {
        guard isEnabled && trackFeatureUsage else { return }
        
        let duration = featureStartTimes[featureName]?.timeIntervalSinceNow.magnitude ?? 0
        featureStartTimes.removeValue(forKey: featureName)
        
        track(
            type: ChangeEventType.userInteraction,
            source: featureName,
            action: "feature_ended",
            metadata: [
                "duration": String(format: "%.3f", duration),
                "success": String(success)
            ]
        )
    }
    
    public func trackFeatureUsage<T>(
        _ featureName: String,
        operation: () async throws -> T
    ) async rethrows -> T {
        guard isEnabled && trackFeatureUsage else {
            return try await operation()
        }
        
        startFeatureUsage(featureName)
        
        do {
            let result = try await operation()
            endFeatureUsage(featureName, success: true)
            return result
        } catch {
            endFeatureUsage(featureName, success: false)
            throw error
        }
    }
    
    // MARK: - Workflow Tracking
    
    public func startWorkflow(_ workflowName: String) {
        guard isEnabled && trackWorkflows else { return }
        
        let session = WorkflowSession(
            name: workflowName,
            startTime: Date(),
            steps: [],
            currentStepIndex: 0
        )
        
        activeWorkflows[workflowName] = session
        
        track(
            type: ChangeEventType.stateChange,
            source: workflowName,
            action: "workflow_started"
        )
        
        logger.debug("Started workflow: \(workflowName)", category: .monitoring)
    }
    
    public func addWorkflowStep(
        workflowName: String,
        stepName: String,
        success: Bool = true,
        errorMessage: String? = nil,
        metadata: [String: String] = [:]
    ) {
        guard isEnabled && trackWorkflows,
              var session = activeWorkflows[workflowName] else { return }
        
        let step = WorkflowStep(
            workflowName: workflowName,
            stepName: stepName,
            stepIndex: session.currentStepIndex,
            success: success,
            errorMessage: errorMessage,
            metadata: metadata
        )
        
        session.steps.append(step)
        session.currentStepIndex += 1
        activeWorkflows[workflowName] = session
        
        Task {
            await storage.store(step)
        }
        
        track(
            type: ChangeEventType.stateChange,
            source: workflowName,
            action: "step_completed",
            newValue: stepName,
            metadata: metadata.merging([
                "step_index": String(step.stepIndex),
                "success": String(success)
            ]) { current, new in new }
        )
    }
    
    public func endWorkflow(_ workflowName: String, success: Bool = true) {
        guard isEnabled && trackWorkflows,
              let session = activeWorkflows.removeValue(forKey: workflowName) else { return }
        
        let duration = Date().timeIntervalSince(session.startTime)
        
        track(
            type: ChangeEventType.stateChange,
            source: workflowName,
            action: "workflow_ended",
            metadata: [
                "duration": String(format: "%.3f", duration),
                "step_count": String(session.steps.count),
                "success": String(success)
            ]
        )
        
        logger.debug("Ended workflow: \(workflowName) (\(session.steps.count) steps, \(String(format: "%.1f", duration))s)", 
                    category: .monitoring)
    }
    
    // MARK: - Analytics and Reporting
    
    public func generateAnalyticsSnapshot() async {
        let snapshot = await storage.getAnalyticsSnapshot()
        
        DispatchQueue.main.async {
            self.analyticsSnapshot = snapshot
        }
        
        logger.info("Generated analytics snapshot", 
                   category: .monitoring,
                   metadata: [
                    "session_duration": String(format: "%.1f", snapshot.sessionDuration),
                    "total_events": String(snapshot.eventCounts.values.reduce(0, +))
                   ])
    }
    
    public func getRecentEvents(
        since: Date? = nil,
        type: ChangeEventType? = nil,
        source: String? = nil,
        limit: Int? = nil
    ) async -> [ChangeEvent] {
        return await storage.retrieve(since: since, type: type, source: source, limit: limit)
    }
    
    public func exportData() async -> Data? {
        let data = await storage.export()
        
        if data != nil {
            logger.info("Exported change tracking data", category: .monitoring)
        } else {
            logger.error("Failed to export change tracking data", category: .monitoring)
        }
        
        return data
    }
    
    public func clearData() async {
        await storage.clear()
        
        DispatchQueue.main.async {
            self.recentEvents.removeAll()
            self.analyticsSnapshot = nil
        }
        
        logger.info("Cleared change tracking data", category: .monitoring)
    }
    
    // MARK: - Pattern Detection
    
    private func startPatternDetection() {
        patternDetectionTimer = Timer.scheduledTimer(withTimeInterval: 300.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.detectPatterns()
            }
        }
    }
    
    private func detectPatterns() async {
        // Get recent events for pattern analysis
        let recentEvents = await getRecentEvents(
            since: Date().addingTimeInterval(-3600), // Last hour
            type: nil,
            source: nil,
            limit: 1000
        )
        
        // Detect common patterns
        var patterns: [ChangePattern] = []
        
        // Pattern 1: Frequent errors from the same source
        let errorEvents = recentEvents.filter { $0.type == .errorEvent }
        let errorsBySource = Dictionary(grouping: errorEvents) { $0.source }
        
        for (source, errors) in errorsBySource {
            if errors.count >= 5 {
                let pattern = ChangePattern(
                    pattern: "Frequent Errors from \(source)",
                    frequency: errors.count,
                    confidence: min(1.0, Double(errors.count) / 10.0),
                    lastSeen: errors.last?.timestamp ?? Date()
                )
                patterns.append(pattern)
            }
        }
        
        // Pattern 2: Performance degradation
        let performanceEvents = recentEvents.filter { $0.type == .performanceEvent }
        let slowEvents = performanceEvents.filter { event in
            if let valueString = event.metadata["value"],
               let value = Double(valueString) {
                return value > 5.0 // Slow operations
            }
            return false
        }
        
        if slowEvents.count >= 3 {
            let pattern = ChangePattern(
                pattern: "Performance Degradation",
                frequency: slowEvents.count,
                confidence: min(1.0, Double(slowEvents.count) / 5.0),
                lastSeen: slowEvents.last?.timestamp ?? Date()
            )
            patterns.append(pattern)
        }
        
        DispatchQueue.main.async {
            self.detectedPatterns = patterns
        }
        
        if !patterns.isEmpty {
            logger.warning("Detected \(patterns.count) change patterns", 
                          category: .monitoring,
                          metadata: ["patterns": patterns.map { $0.pattern }.joined(separator: ", ")])
        }
    }
    
    // MARK: - Configuration
    
    public func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        logger.info("Change tracking \(enabled ? "enabled" : "disabled")", category: .monitoring)
    }
    
    public func setTrackingOptions(
        userInteractions: Bool = true,
        performanceEvents: Bool = true,
        featureUsage: Bool = true,
        workflows: Bool = true,
        anonymizeData: Bool = false
    ) {
        self.trackUserInteractions = userInteractions
        self.trackPerformanceEvents = performanceEvents
        self.trackFeatureUsage = featureUsage
        self.trackWorkflows = workflows
        self.anonymizeData = anonymizeData
        
        logger.info("Updated tracking options", 
                   category: .monitoring,
                   metadata: [
                    "user_interactions": String(userInteractions),
                    "performance_events": String(performanceEvents),
                    "feature_usage": String(featureUsage),
                    "workflows": String(workflows),
                    "anonymize_data": String(anonymizeData)
                   ])
    }
    
    // MARK: - Private Methods
    
    private func setupSystemEventTracking() {
        // Listen for app lifecycle events
        NotificationCenter.default.addObserver(
            forName: NSApplication.willTerminateNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.track(
                type: ChangeEventType.systemEvent,
                source: "application",
                action: "will_terminate"
            )
        }
        
        NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.track(
                type: ChangeEventType.systemEvent,
                source: "application",
                action: "became_active"
            )
        }
        
        NotificationCenter.default.addObserver(
            forName: NSApplication.didResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.track(
                type: ChangeEventType.systemEvent,
                source: "application",
                action: "resigned_active"
            )
        }
    }
    
    private func getCurrentUserID() -> String? {
        // In a real app, this might return the actual user ID
        // For privacy, we might use a hashed or anonymized identifier
        return "anonymous_user"
    }
    
    deinit {
        patternDetectionTimer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}