import Foundation
import Combine
import SwiftUI
import os.log

// MARK: - Advanced State Management
@MainActor
class AdvancedStateManagement: ObservableObject {
    static let shared = AdvancedStateManagement()
    
    // MARK: - Core State Publishers
    @Published var applicationState: ApplicationState = ApplicationState()
    @Published var dataState: DataState = DataState()
    @Published var uiState: UIState = UIState()
    @Published var performanceState: PerformanceState = PerformanceState()
    
    // MARK: - State Coordination
    @Published var stateVersion: Int = 0
    @Published var lastStateChange: Date = Date()
    @Published var isStateDirty: Bool = false
    
    // MARK: - Memory Management
    @Published var memoryPressure: MemoryPressureLevel = .normal
    @Published var cacheUtilization: Double = 0.0
    
    // MARK: - Private Properties
    private let stateQueue = DispatchQueue(label: "StateManagement", qos: .userInitiated)
    private let persistenceQueue = DispatchQueue(label: "StatePersistence", qos: .utility)
    private var stateHistory: [StateSnapshot] = []
    private let maxHistorySize: Int = 100
    private var cancellables = Set<AnyCancellable>()
    private let logger = Logger(subsystem: "UniversalAITools", category: "AdvancedStateManagement")
    
    // MARK: - State Persistence
    private let userDefaults = UserDefaults.standard
    private let statePersistenceKey = "AdvancedStateManagement.State"
    private var persistenceTimer: Timer?
    
    // MARK: - Memory Management
    private let memoryMonitor = MemoryMonitor()
    private var cleanupTimer: Timer?
    
    // MARK: - Event Sourcing
    private var eventStore: [StateEvent] = []
    private let maxEventStoreSize: Int = 1000
    
    // MARK: - Initialization
    private init() {
        setupStateObservers()
        setupMemoryMonitoring()
        setupStatePersistence()
        restorePersistedState()
        
        logger.info("AdvancedStateManagement initialized")
    }
    
    deinit {
        persistenceTimer?.invalidate()
        cleanupTimer?.invalidate()
        saveStateToPersistence()
    }
    
    // MARK: - Public Interface
    func updateApplicationState(_ update: @escaping (inout ApplicationState) -> Void) {
        performStateUpdate(statePath: \.applicationState, update: update, eventType: .applicationStateChanged)
    }
    
    func updateDataState(_ update: @escaping (inout DataState) -> Void) {
        performStateUpdate(statePath: \.dataState, update: update, eventType: .dataStateChanged)
    }
    
    func updateUIState(_ update: @escaping (inout UIState) -> Void) {
        performStateUpdate(statePath: \.uiState, update: update, eventType: .uiStateChanged)
    }
    
    func updatePerformanceState(_ update: @escaping (inout PerformanceState) -> Void) {
        performStateUpdate(statePath: \.performanceState, update: update, eventType: .performanceStateChanged)
    }
    
    // MARK: - State History Management
    func getStateHistory() -> [StateSnapshot] {
        return stateHistory
    }
    
    func restoreToSnapshot(_ snapshot: StateSnapshot) {
        logger.info("Restoring state to snapshot: \(snapshot.id)")
        
        applicationState = snapshot.applicationState
        dataState = snapshot.dataState
        uiState = snapshot.uiState
        performanceState = snapshot.performanceState
        
        recordEvent(.stateRestored, metadata: ["snapshotId": snapshot.id.uuidString])
        incrementStateVersion()
    }
    
    func createSnapshot(tag: String? = nil) -> StateSnapshot {
        let snapshot = StateSnapshot(
            id: UUID(),
            timestamp: Date(),
            applicationState: applicationState,
            dataState: dataState,
            uiState: uiState,
            performanceState: performanceState,
            tag: tag
        )
        
        stateHistory.append(snapshot)
        
        // Limit history size
        if stateHistory.count > maxHistorySize {
            stateHistory.removeFirst(stateHistory.count - maxHistorySize)
        }
        
        logger.debug("Created state snapshot: \(snapshot.id)")
        return snapshot
    }
    
    // MARK: - Event Sourcing
    func getEventHistory() -> [StateEvent] {
        return eventStore
    }
    
    func replayEventsFrom(_ timestamp: Date) {
        logger.info("Replaying events from: \(timestamp)")
        
        let eventsToReplay = eventStore.filter { $0.timestamp >= timestamp }
        
        for event in eventsToReplay {
            applyEvent(event)
        }
    }
    
    // MARK: - Memory Management
    func performMemoryCleanup() {
        logger.info("Performing memory cleanup")
        
        // Cleanup old state history
        let cutoffTime = Date().addingTimeInterval(-3600) // 1 hour ago
        stateHistory.removeAll { $0.timestamp < cutoffTime }
        
        // Cleanup old events
        eventStore.removeAll { $0.timestamp < cutoffTime }
        
        // Clear caches if memory pressure is high
        if memoryPressure == .high || memoryPressure == .critical {
            clearExpiredCaches()
        }
        
        // Force garbage collection
        autoreleasepool {
            // Trigger memory cleanup
        }
        
        updateCacheUtilization()
    }
    
    func optimizeForMemoryPressure(_ level: MemoryPressureLevel) {
        memoryPressure = level
        
        switch level {
        case .normal:
            // Normal operation
            break
        case .warning:
            // Reduce cache sizes
            reduceStateCaches(by: 0.25)
        case .high:
            // Aggressive cleanup
            reduceStateCaches(by: 0.5)
            clearNonEssentialState()
        case .critical:
            // Emergency cleanup
            clearAllCaches()
            performEmergencyCleanup()
        }
        
        logger.info("Optimized for memory pressure level: \(level)")
    }
    
    // MARK: - Thread Safety
    func performThreadSafeUpdate<T>(_ keyPath: WritableKeyPath<AdvancedStateManagement, T>, update: @escaping (inout T) -> Void) {
        Task { @MainActor in
            update(&self[keyPath: keyPath])
        }
    }
    
    // MARK: - State Validation
    func validateState() -> StateValidationResult {
        var issues: [StateValidationIssue] = []
        
        // Validate application state
        if applicationState.sessionId.isEmpty {
            issues.append(StateValidationIssue(type: .missingRequired, field: "sessionId", message: "Session ID is required"))
        }
        
        // Validate data state consistency
        if dataState.isConnected && dataState.lastUpdate.timeIntervalSinceNow < -300 {
            issues.append(StateValidationIssue(type: .staleData, field: "lastUpdate", message: "Data is stale"))
        }
        
        // Validate UI state
        if uiState.windowStates.isEmpty {
            issues.append(StateValidationIssue(type: .missingRequired, field: "windowStates", message: "At least one window state required"))
        }
        
        // Validate performance state
        if performanceState.memoryUsage > 0.9 {
            issues.append(StateValidationIssue(type: .performanceWarning, field: "memoryUsage", message: "High memory usage detected"))
        }
        
        return StateValidationResult(
            isValid: issues.isEmpty,
            issues: issues,
            validatedAt: Date()
        )
    }
    
    // MARK: - Private Methods
    private func performStateUpdate<T>(statePath: WritableKeyPath<AdvancedStateManagement, T>, update: @escaping (inout T) -> Void, eventType: StateEventType) {
        let oldValue = self[keyPath: statePath]
        update(&self[keyPath: statePath])
        
        // Record the change
        recordEvent(eventType, metadata: ["statePath": String(describing: statePath)])
        incrementStateVersion()
        
        // Create snapshot for significant changes
        if shouldCreateSnapshot(for: eventType) {
            _ = createSnapshot(tag: eventType.rawValue)
        }
    }
    
    private func setupStateObservers() {
        // Observe state changes and trigger persistence
        Publishers.CombineLatest4(
            $applicationState,
            $dataState,
            $uiState,
            $performanceState
        )
        .dropFirst() // Skip initial values
        .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
        .sink { [weak self] _ in
            self?.markStateDirty()
        }
        .store(in: &cancellables)
        
        // Monitor state version changes
        $stateVersion
            .dropFirst()
            .sink { [weak self] version in
                self?.lastStateChange = Date()
                self?.logger.debug("State version updated to: \(version)")
            }
            .store(in: &cancellables)
    }
    
    private func setupMemoryMonitoring() {
        memoryMonitor.onMemoryPressureChange = { [weak self] level in
            Task { @MainActor in
                self?.optimizeForMemoryPressure(level)
            }
        }
        
        cleanupTimer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.performMemoryCleanup()
            }
        }
    }
    
    private func setupStatePersistence() {
        persistenceTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.saveStateToPersistenceIfNeeded()
        }
    }
    
    private func markStateDirty() {
        isStateDirty = true
    }
    
    private func incrementStateVersion() {
        stateVersion += 1
    }
    
    private func recordEvent(_ type: StateEventType, metadata: [String: String] = [:]) {
        let event = StateEvent(
            id: UUID(),
            type: type,
            timestamp: Date(),
            metadata: metadata
        )
        
        eventStore.append(event)
        
        // Limit event store size
        if eventStore.count > maxEventStoreSize {
            eventStore.removeFirst(eventStore.count - maxEventStoreSize)
        }
    }
    
    private func applyEvent(_ event: StateEvent) {
        // This is a simplified event replay - in a real implementation,
        // you'd store the actual state changes and replay them
        logger.debug("Applying event: \(event.type.rawValue)")
    }
    
    private func shouldCreateSnapshot(for eventType: StateEventType) -> Bool {
        switch eventType {
        case .applicationStateChanged, .dataStateChanged:
            return true
        case .uiStateChanged, .performanceStateChanged:
            return false
        case .stateRestored, .memoryPressureChanged:
            return true
        }
    }
    
    private func saveStateToPersistenceIfNeeded() {
        guard isStateDirty else { return }
        saveStateToPersistence()
    }
    
    private func saveStateToPersistence() {
        persistenceQueue.async { [weak self] in
            guard let self = self else { return }
            
            do {
                let stateData = StatePersistenceData(
                    version: self.stateVersion,
                    applicationState: self.applicationState,
                    dataState: self.dataState,
                    uiState: self.uiState,
                    performanceState: self.performanceState,
                    lastSaved: Date()
                )
                
                let data = try JSONEncoder().encode(stateData)
                self.userDefaults.set(data, forKey: self.statePersistenceKey)
                
                Task { @MainActor in
                    self.isStateDirty = false
                    self.logger.debug("State saved to persistence")
                }
            } catch {
                self.logger.error("Failed to save state: \(error.localizedDescription)")
            }
        }
    }
    
    private func restorePersistedState() {
        persistenceQueue.async { [weak self] in
            guard let self = self,
                  let data = self.userDefaults.data(forKey: self.statePersistenceKey) else {
                return
            }
            
            do {
                let persistedState = try JSONDecoder().decode(StatePersistenceData.self, from: data)
                
                Task { @MainActor in
                    self.stateVersion = persistedState.version
                    self.applicationState = persistedState.applicationState
                    self.dataState = persistedState.dataState
                    self.uiState = persistedState.uiState
                    self.performanceState = persistedState.performanceState
                    
                    self.logger.info("State restored from persistence (version: \(persistedState.version))")
                }
            } catch {
                self.logger.error("Failed to restore state: \(error.localizedDescription)")
            }
        }
    }
    
    private func clearExpiredCaches() {
        // Clear expired data from caches
        dataState.cachedResults.removeAll { (_, result) in
            result.expiresAt < Date()
        }
        
        // Clear old UI state
        uiState.cachedViews.removeAll { (_, view) in
            view.lastAccessed.timeIntervalSinceNow < -3600 // 1 hour
        }
    }
    
    private func reduceStateCaches(by fraction: Double) {
        let targetSize = Int(Double(dataState.cachedResults.count) * (1.0 - fraction))
        
        while dataState.cachedResults.count > targetSize {
            // Remove oldest entries
            if let oldestKey = dataState.cachedResults.min(by: { $0.value.createdAt < $1.value.createdAt })?.key {
                dataState.cachedResults.removeValue(forKey: oldestKey)
            }
        }
    }
    
    private func clearNonEssentialState() {
        // Clear non-essential cached data
        dataState.cachedResults.removeAll()
        uiState.cachedViews.removeAll()
        
        // Reduce state history
        stateHistory = Array(stateHistory.suffix(10))
        eventStore = Array(eventStore.suffix(100))
    }
    
    private func clearAllCaches() {
        dataState.cachedResults.removeAll()
        uiState.cachedViews.removeAll()
        stateHistory.removeAll()
        eventStore.removeAll()
    }
    
    private func performEmergencyCleanup() {
        clearAllCaches()
        
        // Reset to minimal state
        applicationState = ApplicationState()
        dataState = DataState()
        uiState = UIState()
        performanceState = PerformanceState()
        
        recordEvent(.memoryPressureChanged, metadata: ["level": "critical"])
    }
    
    private func updateCacheUtilization() {
        let totalCacheItems = dataState.cachedResults.count + uiState.cachedViews.count
        let maxCacheSize = 1000 // Configurable
        cacheUtilization = Double(totalCacheItems) / Double(maxCacheSize)
    }
}

// MARK: - State Models
struct ApplicationState: Codable {
    var sessionId: String = UUID().uuidString
    var isInitialized: Bool = false
    var currentUser: String?
    var activeFeatures: Set<String> = []
    var preferences: [String: String] = [:]
    var lastActivity: Date = Date()
    
    mutating func addActiveFeature(_ feature: String) {
        activeFeatures.insert(feature)
        lastActivity = Date()
    }
    
    mutating func removeActiveFeature(_ feature: String) {
        activeFeatures.remove(feature)
        lastActivity = Date()
    }
}

struct DataState: Codable {
    var isConnected: Bool = false
    var lastUpdate: Date = Date()
    var pendingOperations: [String] = []
    var cachedResults: [String: CachedResult] = [:]
    var dataVersion: Int = 0
    
    struct CachedResult: Codable {
        let key: String
        let data: Data
        let createdAt: Date
        let expiresAt: Date
        
        init(key: String, data: Data, ttl: TimeInterval = 300) {
            self.key = key
            self.data = data
            self.createdAt = Date()
            self.expiresAt = Date().addingTimeInterval(ttl)
        }
    }
    
    mutating func addCachedResult(key: String, data: Data, ttl: TimeInterval = 300) {
        cachedResults[key] = CachedResult(key: key, data: data, ttl: ttl)
        dataVersion += 1
    }
    
    mutating func removeCachedResult(key: String) {
        cachedResults.removeValue(forKey: key)
        dataVersion += 1
    }
}

struct UIState: Codable {
    var activeWindows: [String] = []
    var windowStates: [String: WindowState] = [:]
    var navigationStack: [String] = []
    var cachedViews: [String: CachedView] = [:]
    var theme: String = "dark"
    
    struct WindowState: Codable {
        var isVisible: Bool = true
        var frame: CGRect = .zero
        var isMinimized: Bool = false
        var lastModified: Date = Date()
    }
    
    struct CachedView: Codable {
        let viewId: String
        let data: Data
        let lastAccessed: Date
        
        init(viewId: String, data: Data) {
            self.viewId = viewId
            self.data = data
            self.lastAccessed = Date()
        }
    }
    
    mutating func addWindow(_ windowId: String, state: WindowState = WindowState()) {
        activeWindows.append(windowId)
        windowStates[windowId] = state
    }
    
    mutating func removeWindow(_ windowId: String) {
        activeWindows.removeAll { $0 == windowId }
        windowStates.removeValue(forKey: windowId)
    }
}

struct PerformanceState: Codable {
    var cpuUsage: Double = 0.0
    var memoryUsage: Double = 0.0
    var networkLatency: TimeInterval = 0.0
    var renderingFPS: Double = 60.0
    var lastMetricsUpdate: Date = Date()
    var performanceAlerts: [PerformanceAlert] = []
    
    struct PerformanceAlert: Codable, Identifiable {
        let id = UUID()
        let type: AlertType
        let message: String
        let severity: Severity
        let timestamp: Date
        
        enum AlertType: String, Codable {
            case highCPU, highMemory, lowFPS, highLatency
        }
        
        enum Severity: String, Codable {
            case info, warning, error, critical
        }
    }
    
    mutating func addAlert(_ alert: PerformanceAlert) {
        performanceAlerts.append(alert)
        
        // Keep only recent alerts
        let cutoff = Date().addingTimeInterval(-3600) // 1 hour
        performanceAlerts.removeAll { $0.timestamp < cutoff }
    }
}

// MARK: - Supporting Types
struct StateSnapshot: Identifiable, Codable {
    let id: UUID
    let timestamp: Date
    let applicationState: ApplicationState
    let dataState: DataState
    let uiState: UIState
    let performanceState: PerformanceState
    let tag: String?
}

struct StateEvent: Identifiable, Codable {
    let id: UUID
    let type: StateEventType
    let timestamp: Date
    let metadata: [String: String]
}

enum StateEventType: String, Codable, CaseIterable {
    case applicationStateChanged = "application_state_changed"
    case dataStateChanged = "data_state_changed"
    case uiStateChanged = "ui_state_changed"
    case performanceStateChanged = "performance_state_changed"
    case stateRestored = "state_restored"
    case memoryPressureChanged = "memory_pressure_changed"
}

enum MemoryPressureLevel: String, Codable, CaseIterable {
    case normal = "normal"
    case warning = "warning"
    case high = "high"
    case critical = "critical"
}

struct StateValidationResult {
    let isValid: Bool
    let issues: [StateValidationIssue]
    let validatedAt: Date
}

struct StateValidationIssue: Identifiable {
    let id = UUID()
    let type: IssueType
    let field: String
    let message: String
    
    enum IssueType: String, CaseIterable {
        case missingRequired = "missing_required"
        case invalidValue = "invalid_value"
        case staleData = "stale_data"
        case performanceWarning = "performance_warning"
    }
}

private struct StatePersistenceData: Codable {
    let version: Int
    let applicationState: ApplicationState
    let dataState: DataState
    let uiState: UIState
    let performanceState: PerformanceState
    let lastSaved: Date
}

// MARK: - Memory Monitor
private class MemoryMonitor {
    var onMemoryPressureChange: ((MemoryPressureLevel) -> Void)?
    
    private var dispatchSource: DispatchSourceMemoryPressure?
    
    init() {
        setupMemoryPressureMonitoring()
    }
    
    deinit {
        dispatchSource?.cancel()
    }
    
    private func setupMemoryPressureMonitoring() {
        dispatchSource = DispatchSource.makeMemoryPressureSource(eventMask: [.normal, .warning, .critical])
        
        dispatchSource?.setEventHandler { [weak self] in
            guard let data = self?.dispatchSource?.data else { return }
            
            let level: MemoryPressureLevel
            if data.contains(.critical) {
                level = .critical
            } else if data.contains(.warning) {
                level = .high
            } else {
                level = .normal
            }
            
            self?.onMemoryPressureChange?(level)
        }
        
        dispatchSource?.resume()
    }
}