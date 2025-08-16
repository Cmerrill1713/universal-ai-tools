import Combine
import Foundation
import Network
import OSLog
import SwiftUI

// MARK: - Backend Monitoring Integration Service
@MainActor
public class BackendMonitoringIntegration: ObservableObject {
    public static let shared = BackendMonitoringIntegration()
    
    @Published public var isConnected = false
    @Published public var lastSyncTime: Date?
    @Published public var syncStatus: SyncStatus = .idle
    @Published public var endpointHealth: [String: EndpointHealth] = [:]
    
    private let logger = LoggingService.shared
    private let monitoringService = MonitoringService.shared
    private let changeTracker = ChangeTracker.shared
    private let failurePreventionService = FailurePreventionService.shared
    
    private let baseURL: String
    private let session: URLSession
    private var syncTimer: Timer?
    private var healthCheckTimer: Timer?
    private var retryTimer: Timer?
    
    // Configuration
    public var syncInterval: TimeInterval = 60.0 // 1 minute
    public var healthCheckInterval: TimeInterval = 30.0 // 30 seconds
    public var enableRealTimeSync = true
    public var enableHealthMonitoring = true
    public var maxRetryAttempts = 3
    
    // State tracking
    private var retryCount = 0
    private var lastSyncAttempt: Date?
    private var pendingData: [PendingSync] = []
    
    private init() {
        self.baseURL = "http://localhost:9999"
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.session = URLSession(configuration: config)
        
        setupNotificationObservers()
        startBackgroundSync()
        
        logger.info("BackendMonitoringIntegration initialized", category: .monitoring)
    }
    
    // MARK: - Public API
    
    public func connect() async {
        logger.info("Connecting to backend monitoring service", category: .monitoring)
        
        do {
            let isHealthy = await checkBackendHealth()
            
            if isHealthy {
                await MainActor.run {
                    self.isConnected = true
                    self.retryCount = 0
                    self.syncStatus = .connected
                }
                
                // Start services
                startRealTimeSync()
                startHealthMonitoring()
                
                // Perform initial sync
                await performFullSync()
                
                logger.info("Successfully connected to backend monitoring service", category: .monitoring)
                
                NotificationCenter.default.post(name: .remoteLoggingConnected, object: nil)
            } else {
                await handleConnectionFailure()
            }
        } catch {
            logger.error("Failed to connect to backend monitoring service: \(error.localizedDescription)",
                        category: .monitoring)
            await handleConnectionFailure()
        }
    }
    
    public func disconnect() {
        logger.info("Disconnecting from backend monitoring service", category: .monitoring)
        
        isConnected = false
        syncStatus = .disconnected
        
        stopRealTimeSync()
        stopHealthMonitoring()
        
        NotificationCenter.default.post(name: .remoteLoggingDisconnected, object: nil)
    }
    
    public func forceSyncNow() async {
        guard isConnected else {
            logger.warning("Cannot sync - not connected to backend", category: .monitoring)
            return
        }
        
        logger.info("Forcing immediate sync to backend", category: .monitoring)
        await performFullSync()
    }
    
    public func clearPendingData() {
        pendingData.removeAll()
        logger.info("Cleared pending sync data", category: .monitoring)
    }
    
    // MARK: - Backend Health Check
    
    private func checkBackendHealth() async -> Bool {
        do {
            let healthEndpoint = "\(baseURL)/api/v1/monitoring/health"
            guard let url = URL(string: healthEndpoint) else { return false }
            
            let (data, response) = try await session.data(from: url)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return false
            }
            
            // Parse health response
            struct HealthResponse: Codable {
                let status: String
                let timestamp: String
                let services: ServiceStatus
                
                struct ServiceStatus: Codable {
                    let logging: Bool
                    let monitoring: Bool
                    let analytics: Bool
                }
            }
            
            let healthResponse = try JSONDecoder().decode(HealthResponse.self, from: data)
            
            // Update endpoint health status
            await MainActor.run {
                endpointHealth["monitoring"] = EndpointHealth(
                    isHealthy: healthResponse.services.monitoring,
                    lastCheck: Date(),
                    responseTime: 0, // Would measure actual response time
                    errorCount: 0
                )
                
                endpointHealth["logging"] = EndpointHealth(
                    isHealthy: healthResponse.services.logging,
                    lastCheck: Date(),
                    responseTime: 0,
                    errorCount: 0
                )
                
                endpointHealth["analytics"] = EndpointHealth(
                    isHealthy: healthResponse.services.analytics,
                    lastCheck: Date(),
                    responseTime: 0,
                    errorCount: 0
                )
            }
            
            return healthResponse.status == "healthy"
        } catch {
            logger.error("Backend health check failed: \(error.localizedDescription)", category: .monitoring)
            return false
        }
    }
    
    // MARK: - Data Synchronization
    
    private func performFullSync() async {
        guard isConnected else { return }
        
        await MainActor.run {
            syncStatus = .syncing
        }
        
        logger.debug("Starting full sync to backend", category: .monitoring)
        
        do {
            // Sync logs
            await syncLogs()
            
            // Sync monitoring data
            await syncMonitoringData()
            
            // Sync analytics
            await syncAnalytics()
            
            // Sync failure prevention data
            await syncFailurePreventionData()
            
            // Process pending data
            await processPendingSync()
            
            await MainActor.run {
                lastSyncTime = Date()
                syncStatus = .connected
            }
            
            logger.info("Full sync completed successfully", category: .monitoring)
        } catch {
            logger.error("Full sync failed: \(error.localizedDescription)", category: .monitoring)
            
            await MainActor.run {
                syncStatus = .error
            }
        }
    }
    
    private func syncLogs() async {
        logger.debug("Syncing logs to backend", category: .monitoring)
        
        do {
            // Get recent logs
            let logs = await logger.getLogs(
                since: lastSyncTime ?? Date().addingTimeInterval(-3600), // Last hour if no previous sync
                level: nil,
                category: nil,
                limit: 1000
            )
            
            guard !logs.isEmpty else {
                logger.debug("No logs to sync", category: .monitoring)
                return
            }
            
            // Send to backend
            let success = await sendLogsToBackend(logs)
            
            if success {
                logger.debug("Successfully synced \(logs.count) logs", category: .monitoring)
            } else {
                // Add to pending data
                pendingData.append(PendingSync(type: .logs, data: logs, timestamp: Date()))
                logger.warning("Failed to sync logs - added to pending queue", category: .monitoring)
            }
        } catch {
            logger.error("Error syncing logs: \(error.localizedDescription)", category: .monitoring)
        }
    }
    
    private func syncMonitoringData() async {
        logger.debug("Syncing monitoring data to backend", category: .monitoring)
        
        do {
            // Collect current monitoring state
            let monitoringData = MonitoringSyncData(
                timestamp: Date(),
                healthStatus: monitoringService.currentHealth,
                healthCheckResults: monitoringService.healthCheckResults,
                performanceMetrics: monitoringService.performanceMetrics,
                connectionHealth: monitoringService.connectionHealth,
                applicationHealth: monitoringService.applicationHealth,
                alerts: monitoringService.alerts
            )
            
            let success = await sendMonitoringDataToBackend(monitoringData)
            
            if success {
                logger.debug("Successfully synced monitoring data", category: .monitoring)
            } else {
                pendingData.append(PendingSync(type: .monitoring, data: monitoringData, timestamp: Date()))
                logger.warning("Failed to sync monitoring data - added to pending queue", category: .monitoring)
            }
        } catch {
            logger.error("Error syncing monitoring data: \(error.localizedDescription)", category: .monitoring)
        }
    }
    
    private func syncAnalytics() async {
        logger.debug("Syncing analytics to backend", category: .monitoring)
        
        do {
            // Get analytics snapshot
            guard let snapshot = changeTracker.analyticsSnapshot else {
                // Generate snapshot if not available
                await changeTracker.generateAnalyticsSnapshot()
                guard let snapshot = changeTracker.analyticsSnapshot else {
                    logger.debug("No analytics data to sync", category: .monitoring)
                    return
                }
            }
            
            // Get recent events
            let recentEvents = await changeTracker.getRecentEvents(
                since: lastSyncTime ?? Date().addingTimeInterval(-3600),
                type: nil,
                source: nil,
                limit: 500
            )
            
            let analyticsData = AnalyticsSyncData(
                snapshot: snapshot,
                recentEvents: recentEvents,
                patterns: changeTracker.detectedPatterns
            )
            
            let success = await sendAnalyticsToBackend(analyticsData)
            
            if success {
                logger.debug("Successfully synced analytics data", category: .monitoring)
            } else {
                pendingData.append(PendingSync(type: .analytics, data: analyticsData, timestamp: Date()))
                logger.warning("Failed to sync analytics - added to pending queue", category: .monitoring)
            }
        } catch {
            logger.error("Error syncing analytics: \(error.localizedDescription)", category: .monitoring)
        }
    }
    
    private func syncFailurePreventionData() async {
        logger.debug("Syncing failure prevention data to backend", category: .monitoring)
        
        do {
            let failureData = FailurePreventionSyncData(
                activePredictions: failurePreventionService.activePredictions,
                healthTrends: failurePreventionService.healthTrends,
                preventedFailures: failurePreventionService.preventedFailures,
                automaticRecoveries: failurePreventionService.automaticRecoveries
            )
            
            let success = await sendFailurePreventionDataToBackend(failureData)
            
            if success {
                logger.debug("Successfully synced failure prevention data", category: .monitoring)
            } else {
                pendingData.append(PendingSync(type: .failurePrevention, data: failureData, timestamp: Date()))
                logger.warning("Failed to sync failure prevention data - added to pending queue", category: .monitoring)
            }
        } catch {
            logger.error("Error syncing failure prevention data: \(error.localizedDescription)", category: .monitoring)
        }
    }
    
    // MARK: - Backend API Calls
    
    private func sendLogsToBackend(_ logs: [LogEntry]) async -> Bool {
        do {
            let endpoint = "\(baseURL)/api/v1/monitoring/logs/batch"
            guard let url = URL(string: endpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 30
            
            let payload = LogsBatchPayload(
                source: "universal-ai-tools-macos",
                deviceId: getDeviceId(),
                sessionId: changeTracker.sessionID,
                timestamp: Date(),
                logs: logs
            )
            
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(payload)
            
            let (_, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return false
            }
            
            return true
        } catch {
            logger.error("Failed to send logs to backend: \(error.localizedDescription)", category: .monitoring)
            return false
        }
    }
    
    private func sendMonitoringDataToBackend(_ data: MonitoringSyncData) async -> Bool {
        do {
            let endpoint = "\(baseURL)/api/v1/monitoring/metrics"
            guard let url = URL(string: endpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 30
            
            let payload = MonitoringPayload(
                source: "universal-ai-tools-macos",
                deviceId: getDeviceId(),
                sessionId: changeTracker.sessionID,
                data: data
            )
            
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(payload)
            
            let (_, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return false
            }
            
            return true
        } catch {
            logger.error("Failed to send monitoring data to backend: \(error.localizedDescription)", category: .monitoring)
            return false
        }
    }
    
    private func sendAnalyticsToBackend(_ data: AnalyticsSyncData) async -> Bool {
        do {
            let endpoint = "\(baseURL)/api/v1/monitoring/analytics"
            guard let url = URL(string: endpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 30
            
            let payload = AnalyticsPayload(
                source: "universal-ai-tools-macos",
                deviceId: getDeviceId(),
                sessionId: changeTracker.sessionID,
                data: data
            )
            
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(payload)
            
            let (_, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return false
            }
            
            return true
        } catch {
            logger.error("Failed to send analytics to backend: \(error.localizedDescription)", category: .monitoring)
            return false
        }
    }
    
    private func sendFailurePreventionDataToBackend(_ data: FailurePreventionSyncData) async -> Bool {
        do {
            let endpoint = "\(baseURL)/api/v1/monitoring/failure-prevention"
            guard let url = URL(string: endpoint) else { return false }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 30
            
            let payload = FailurePreventionPayload(
                source: "universal-ai-tools-macos",
                deviceId: getDeviceId(),
                sessionId: changeTracker.sessionID,
                data: data
            )
            
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(payload)
            
            let (_, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return false
            }
            
            return true
        } catch {
            logger.error("Failed to send failure prevention data to backend: \(error.localizedDescription)", category: .monitoring)
            return false
        }
    }
    
    // MARK: - Real-time Synchronization
    
    private func startRealTimeSync() {
        guard enableRealTimeSync else { return }
        
        syncTimer = Timer.scheduledTimer(withTimeInterval: syncInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performIncrementalSync()
            }
        }
        
        logger.debug("Started real-time sync with interval: \(syncInterval)s", category: .monitoring)
    }
    
    private func stopRealTimeSync() {
        syncTimer?.invalidate()
        syncTimer = nil
        
        logger.debug("Stopped real-time sync", category: .monitoring)
    }
    
    private func performIncrementalSync() async {
        guard isConnected, syncStatus != .syncing else { return }
        
        logger.debug("Performing incremental sync", category: .monitoring)
        
        // Only sync new data since last sync
        await syncLogs()
        
        // Always sync current monitoring state
        await syncMonitoringData()
        
        await MainActor.run {
            lastSyncTime = Date()
        }
    }
    
    // MARK: - Health Monitoring
    
    private func startHealthMonitoring() {
        guard enableHealthMonitoring else { return }
        
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: healthCheckInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performHealthCheck()
            }
        }
        
        logger.debug("Started health monitoring with interval: \(healthCheckInterval)s", category: .monitoring)
    }
    
    private func stopHealthMonitoring() {
        healthCheckTimer?.invalidate()
        healthCheckTimer = nil
        
        logger.debug("Stopped health monitoring", category: .monitoring)
    }
    
    private func performHealthCheck() async {
        let isHealthy = await checkBackendHealth()
        
        if !isHealthy && isConnected {
            logger.warning("Backend health check failed - connection may be lost", category: .monitoring)
            await handleConnectionFailure()
        } else if isHealthy && !isConnected {
            logger.info("Backend health restored - attempting reconnection", category: .monitoring)
            await connect()
        }
    }
    
    // MARK: - Error Handling and Retry Logic
    
    private func handleConnectionFailure() async {
        await MainActor.run {
            isConnected = false
            syncStatus = .error
        }
        
        logger.warning("Handling connection failure (attempt \(retryCount + 1)/\(maxRetryAttempts))", 
                      category: .monitoring)
        
        retryCount += 1
        
        if retryCount <= maxRetryAttempts {
            // Schedule retry with exponential backoff
            let delay = pow(2.0, Double(retryCount)) * 5.0 // 5s, 10s, 20s, etc.
            
            retryTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
                Task { @MainActor in
                    await self?.connect()
                }
            }
            
            logger.info("Scheduled reconnection attempt in \(delay)s", category: .monitoring)
        } else {
            logger.error("Max retry attempts reached - giving up", category: .monitoring)
            
            await MainActor.run {
                syncStatus = .disconnected
            }
        }
    }
    
    private func processPendingSync() async {
        guard !pendingData.isEmpty else { return }
        
        logger.info("Processing \(pendingData.count) pending sync items", category: .monitoring)
        
        var successfulItems: [PendingSync] = []
        
        for item in pendingData {
            var success = false
            
            switch item.type {
            case .logs:
                if let logs = item.data as? [LogEntry] {
                    success = await sendLogsToBackend(logs)
                }
            case .monitoring:
                if let data = item.data as? MonitoringSyncData {
                    success = await sendMonitoringDataToBackend(data)
                }
            case .analytics:
                if let data = item.data as? AnalyticsSyncData {
                    success = await sendAnalyticsToBackend(data)
                }
            case .failurePrevention:
                if let data = item.data as? FailurePreventionSyncData {
                    success = await sendFailurePreventionDataToBackend(data)
                }
            }
            
            if success {
                successfulItems.append(item)
            }
        }
        
        // Remove successful items
        pendingData.removeAll { item in
            successfulItems.contains { $0.id == item.id }
        }
        
        logger.info("Successfully synced \(successfulItems.count) pending items", category: .monitoring)
    }
    
    // MARK: - Notification Observers
    
    private func setupNotificationObservers() {
        // Listen for critical alerts
        NotificationCenter.default.addObserver(
            forName: .criticalMonitoringAlert,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let alert = notification.userInfo?[NotificationPayloadKeys.alertData] as? MonitoringAlert {
                Task {
                    await self?.sendCriticalAlert(alert)
                }
            }
        }
        
        // Listen for failure predictions
        NotificationCenter.default.addObserver(
            forName: .failurePredicted,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let prediction = notification.userInfo?[NotificationPayloadKeys.predictionData] as? FailurePrediction {
                Task {
                    await self?.sendFailurePrediction(prediction)
                }
            }
        }
    }
    
    private func sendCriticalAlert(_ alert: MonitoringAlert) async {
        guard isConnected else { return }
        
        do {
            let endpoint = "\(baseURL)/api/v1/monitoring/alerts/critical"
            guard let url = URL(string: endpoint) else { return }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let payload = CriticalAlertPayload(
                source: "universal-ai-tools-macos",
                deviceId: getDeviceId(),
                sessionId: changeTracker.sessionID,
                alert: alert
            )
            
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(payload)
            
            let (_, response) = try await session.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                logger.debug("Successfully sent critical alert to backend", category: .monitoring)
            } else {
                logger.warning("Failed to send critical alert to backend", category: .monitoring)
            }
        } catch {
            logger.error("Error sending critical alert: \(error.localizedDescription)", category: .monitoring)
        }
    }
    
    private func sendFailurePrediction(_ prediction: FailurePrediction) async {
        guard isConnected else { return }
        
        do {
            let endpoint = "\(baseURL)/api/v1/monitoring/predictions"
            guard let url = URL(string: endpoint) else { return }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let payload = PredictionPayload(
                source: "universal-ai-tools-macos",
                deviceId: getDeviceId(),
                sessionId: changeTracker.sessionID,
                prediction: prediction
            )
            
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(payload)
            
            let (_, response) = try await session.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                logger.debug("Successfully sent failure prediction to backend", category: .monitoring)
            } else {
                logger.warning("Failed to send failure prediction to backend", category: .monitoring)
            }
        } catch {
            logger.error("Error sending failure prediction: \(error.localizedDescription)", category: .monitoring)
        }
    }
    
    // MARK: - Utility Methods
    
    private func getDeviceId() -> String {
        // Generate a unique device identifier
        let key = "device_id"
        
        if let existingId = UserDefaults.standard.string(forKey: key) {
            return existingId
        }
        
        let newId = UUID().uuidString
        UserDefaults.standard.set(newId, forKey: key)
        return newId
    }
    
    private func startBackgroundSync() {
        // Start connection check
        Task {
            await connect()
        }
    }
    
    deinit {
        disconnect()
        retryTimer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - Supporting Types

// Note: SyncStatus and EndpointHealth are defined in LoggingTypes.swift to avoid duplication

private struct PendingSync: Identifiable {
    let id = UUID()
    let type: SyncType
    let data: Any
    let timestamp: Date
    
    enum SyncType {
        case logs
        case monitoring
        case analytics
        case failurePrevention
    }
}

// MARK: - Payload Types

private struct LogsBatchPayload: Codable {
    let source: String
    let deviceId: String
    let sessionId: String
    let timestamp: Date
    let logs: [LogEntry]
}

private struct MonitoringPayload: Codable {
    let source: String
    let deviceId: String
    let sessionId: String
    let data: MonitoringSyncData
}

private struct AnalyticsPayload: Codable {
    let source: String
    let deviceId: String
    let sessionId: String
    let data: AnalyticsSyncData
}

private struct FailurePreventionPayload: Codable {
    let source: String
    let deviceId: String
    let sessionId: String
    let data: FailurePreventionSyncData
}

private struct CriticalAlertPayload: Codable {
    let source: String
    let deviceId: String
    let sessionId: String
    let alert: MonitoringAlert
}

private struct PredictionPayload: Codable {
    let source: String
    let deviceId: String
    let sessionId: String
    let prediction: FailurePrediction
}

// MARK: - Sync Data Types

private struct MonitoringSyncData: Codable {
    let timestamp: Date
    let healthStatus: HealthStatus
    let healthCheckResults: [HealthCheckResult]
    let performanceMetrics: PerformanceMetrics?
    let connectionHealth: ConnectionHealth?
    let applicationHealth: ApplicationHealth?
    let alerts: [MonitoringAlert]
}

private struct AnalyticsSyncData: Codable {
    let snapshot: AnalyticsSnapshot
    let recentEvents: [ChangeEvent]
    let patterns: [ChangePattern]
}

private struct FailurePreventionSyncData: Codable {
    let activePredictions: [FailurePrediction]
    let healthTrends: [HealthTrend]
    let preventedFailures: Int
    let automaticRecoveries: Int
}