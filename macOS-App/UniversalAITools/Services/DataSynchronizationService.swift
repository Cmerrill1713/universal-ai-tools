import Foundation
import Combine
import SwiftUI
import os.log

// MARK: - Data Synchronization Service
@MainActor
class DataSynchronizationService: ObservableObject {
    static let shared = DataSynchronizationService()
    
    // MARK: - Published Properties
    @Published var syncStatus: SyncStatus = .idle
    @Published var syncProgress: Double = 0.0
    @Published var lastSyncTime: Date?
    @Published var pendingChanges: Int = 0
    @Published var conflictCount: Int = 0
    
    // MARK: - Sync Metrics
    @Published var syncMetrics: SyncMetrics = SyncMetrics()
    @Published var componentSyncStates: [String: ComponentSyncState] = [:]
    
    // MARK: - Private Properties
    private let syncQueue = DispatchQueue(label: "DataSynchronization", qos: .userInitiated)
    private let conflictResolutionQueue = DispatchQueue(label: "ConflictResolution", qos: .utility)
    private var changeBuffer: ChangeBuffer = ChangeBuffer()
    private var versionVector: VersionVector = VersionVector()
    private var conflictResolver: ConflictResolver = ConflictResolver()
    private let logger = Logger(subsystem: "UniversalAITools", category: "DataSynchronizationService")
    
    // MARK: - Services
    private let realTimeDataService = RealTimeDataService.shared
    private let stateManagement = AdvancedStateManagement.shared
    
    // MARK: - Cancellables
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Timers
    private var syncTimer: Timer?
    private var batchTimer: Timer?
    private var healthCheckTimer: Timer?
    
    // MARK: - Configuration
    private let syncInterval: TimeInterval = 5.0
    private let batchInterval: TimeInterval = 1.0
    private let maxBatchSize: Int = 100
    private let maxRetries: Int = 3
    
    // MARK: - Delegates
    weak var syncDelegate: DataSyncDelegate?
    
    // MARK: - Initialization
    private init() {
        setupSyncObservers()
        setupPeriodicSync()
        setupBatchProcessing()
        setupHealthMonitoring()
        
        logger.info("DataSynchronizationService initialized")
    }
    
    deinit {
        syncTimer?.invalidate()
        batchTimer?.invalidate()
        healthCheckTimer?.invalidate()
    }
    
    // MARK: - Public Interface
    func startSynchronization() async {
        logger.info("Starting data synchronization")
        
        syncStatus = .syncing
        syncProgress = 0.0
        
        do {
            await performFullSync()
            syncStatus = .synced
            lastSyncTime = Date()
            updateSyncMetrics()
        } catch {
            logger.error("Synchronization failed: \(error.localizedDescription)")
            syncStatus = .error
            syncDelegate?.syncDidFail(error: error)
        }
    }
    
    func stopSynchronization() {
        logger.info("Stopping data synchronization")
        
        syncStatus = .idle
        syncTimer?.invalidate()
        batchTimer?.invalidate()
    }
    
    func requestSync(for component: String, priority: SyncPriority = .normal) async {
        logger.info("Requesting sync for component: \(component)")
        
        let syncRequest = SyncRequest(
            id: UUID(),
            component: component,
            priority: priority,
            timestamp: Date()
        )
        
        await enqueueSyncRequest(syncRequest)
    }
    
    func publishChange<T: Codable>(_ change: T, for component: String, changeType: ChangeType = .update) {
        let changeData = DataChange(
            id: UUID(),
            component: component,
            type: changeType,
            data: try! JSONEncoder().encode(change),
            timestamp: Date(),
            version: versionVector.increment(for: component)
        )
        
        changeBuffer.addChange(changeData)
        pendingChanges = changeBuffer.pendingCount
        
        // Notify other components immediately for critical changes
        if changeType == .urgent {
            Task {
                await propagateChangeImmediately(changeData)
            }
        }
        
        logger.debug("Published change for component: \(component)")
    }
    
    func subscribeToChanges<T: Codable>(for component: String, type: T.Type) -> AnyPublisher<T, Never> {
        return changeBuffer.changesPublisher
            .compactMap { change in
                guard change.component == component else { return nil }
                return try? JSONDecoder().decode(type, from: change.data)
            }
            .eraseToAnyPublisher()
    }
    
    func resolveConflict(_ conflict: DataConflict, resolution: ConflictResolution) async {
        logger.info("Resolving conflict: \(conflict.id)")
        
        await conflictResolver.resolve(conflict, with: resolution)
        conflictCount = conflictResolver.pendingConflictCount
        
        // Apply resolved change
        if let resolvedChange = resolution.resolvedData {
            await applyResolvedChange(resolvedChange, for: conflict.component)
        }
    }
    
    func getConflicts() -> [DataConflict] {
        return conflictResolver.getPendingConflicts()
    }
    
    // MARK: - Component State Management
    func registerComponent(_ component: String, initialVersion: Int = 0) {
        componentSyncStates[component] = ComponentSyncState(
            component: component,
            lastSyncTime: nil,
            version: initialVersion,
            status: .idle,
            pendingChanges: 0
        )
        
        versionVector.setVersion(initialVersion, for: component)
        logger.info("Registered component: \(component)")
    }
    
    func unregisterComponent(_ component: String) {
        componentSyncStates.removeValue(forKey: component)
        versionVector.removeComponent(component)
        changeBuffer.removeChanges(for: component)
        
        logger.info("Unregistered component: \(component)")
    }
    
    func getComponentState(_ component: String) -> ComponentSyncState? {
        return componentSyncStates[component]
    }
    
    // MARK: - Optimistic Updates
    func performOptimisticUpdate<T: Codable>(_ update: T, for component: String, rollbackHandler: @escaping () -> Void) async -> Bool {
        logger.debug("Performing optimistic update for component: \(component)")
        
        // Apply update immediately
        publishChange(update, for: component, changeType: .optimistic)
        
        // Try to sync the change
        do {
            await requestSync(for: component, priority: .high)
            return true
        } catch {
            logger.warning("Optimistic update failed, rolling back: \(error.localizedDescription)")
            rollbackHandler()
            return false
        }
    }
    
    // MARK: - Batch Operations
    func performBatchUpdate(_ updates: [BatchUpdate]) async {
        logger.info("Performing batch update with \(updates.count) changes")
        
        syncStatus = .syncing
        
        for update in updates {
            publishChange(update.data, for: update.component, changeType: update.type)
        }
        
        // Process all changes in a single sync
        await processPendingChanges()
        
        syncStatus = .synced
        logger.info("Batch update completed")
    }
    
    // MARK: - Cross-Platform Compatibility
    func prepareForCrossPlatformSync() -> CrossPlatformSyncData {
        return CrossPlatformSyncData(
            versionVector: versionVector,
            pendingChanges: changeBuffer.getAllChanges(),
            componentStates: componentSyncStates,
            timestamp: Date()
        )
    }
    
    func applyCrossPlatformSync(_ data: CrossPlatformSyncData) async {
        logger.info("Applying cross-platform sync data")
        
        // Merge version vectors
        versionVector.merge(with: data.versionVector)
        
        // Apply changes that are newer than our local versions
        for change in data.pendingChanges {
            if shouldApplyChange(change) {
                await applyChange(change)
            }
        }
        
        // Update component states
        for (component, state) in data.componentStates {
            if let localState = componentSyncStates[component] {
                componentSyncStates[component] = mergeComponentStates(localState, state)
            } else {
                componentSyncStates[component] = state
            }
        }
        
        updateSyncMetrics()
    }
    
    // MARK: - Private Methods
    private func setupSyncObservers() {
        // Observe real-time data changes
        realTimeDataService.$graphData
            .compactMap { $0 }
            .sink { [weak self] graphData in
                self?.handleExternalDataChange(graphData, component: "graph")
            }
            .store(in: &cancellables)
        
        realTimeDataService.$agentData
            .compactMap { $0 }
            .sink { [weak self] agentData in
                self?.handleExternalDataChange(agentData, component: "agents")
            }
            .store(in: &cancellables)
        
        realTimeDataService.$analyticsData
            .compactMap { $0 }
            .sink { [weak self] analyticsData in
                self?.handleExternalDataChange(analyticsData, component: "analytics")
            }
            .store(in: &cancellables)
        
        // Observe state management changes
        stateManagement.$stateVersion
            .dropFirst()
            .sink { [weak self] version in
                self?.handleStateVersionChange(version)
            }
            .store(in: &cancellables)
    }
    
    private func setupPeriodicSync() {
        syncTimer = Timer.scheduledTimer(withTimeInterval: syncInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performPeriodicSync()
            }
        }
    }
    
    private func setupBatchProcessing() {
        batchTimer = Timer.scheduledTimer(withTimeInterval: batchInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.processPendingChanges()
            }
        }
    }
    
    private func setupHealthMonitoring() {
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.performHealthCheck()
            }
        }
    }
    
    private func performFullSync() async {
        logger.info("Performing full synchronization")
        
        let components = Array(componentSyncStates.keys)
        let totalComponents = components.count
        
        for (index, component) in components.enumerated() {
            await syncComponent(component)
            syncProgress = Double(index + 1) / Double(totalComponents)
        }
        
        await processPendingChanges()
        await resolveConflicts()
    }
    
    private func performPeriodicSync() async {
        guard syncStatus != .syncing else { return }
        
        if changeBuffer.pendingCount > 0 {
            await processPendingChanges()
        }
        
        // Check for stale components
        let staleComponents = componentSyncStates.filter { (_, state) in
            guard let lastSync = state.lastSyncTime else { return true }
            return Date().timeIntervalSince(lastSync) > syncInterval * 2
        }
        
        for (component, _) in staleComponents {
            await syncComponent(component)
        }
    }
    
    private func syncComponent(_ component: String) async {
        logger.debug("Syncing component: \(component)")
        
        guard var state = componentSyncStates[component] else { return }
        
        state.status = .syncing
        componentSyncStates[component] = state
        
        do {
            // Request latest data for component
            await realTimeDataService.sendMessage(
                WebSocketMessage(
                    type: "sync_request",
                    data: try JSONEncoder().encode(SyncRequestData(component: component, version: state.version)),
                    sessionId: realTimeDataService.currentSessionId
                ),
                to: .context
            )
            
            state.status = .synced
            state.lastSyncTime = Date()
            componentSyncStates[component] = state
            
        } catch {
            logger.error("Failed to sync component \(component): \(error.localizedDescription)")
            state.status = .error
            componentSyncStates[component] = state
        }
    }
    
    private func processPendingChanges() async {
        guard changeBuffer.pendingCount > 0 else { return }
        
        let changes = changeBuffer.getPendingChanges(limit: maxBatchSize)
        
        for change in changes {
            await processChange(change)
        }
        
        pendingChanges = changeBuffer.pendingCount
    }
    
    private func processChange(_ change: DataChange) async {
        logger.debug("Processing change: \(change.id) for component: \(change.component)")
        
        // Check for conflicts
        if let conflict = detectConflict(change) {
            await handleConflict(conflict)
            return
        }
        
        // Apply change
        await applyChange(change)
        
        // Update component state
        if var state = componentSyncStates[change.component] {
            state.version = max(state.version, change.version)
            state.pendingChanges = max(0, state.pendingChanges - 1)
            componentSyncStates[change.component] = state
        }
        
        // Mark as processed
        changeBuffer.markProcessed(change.id)
    }
    
    private func applyChange(_ change: DataChange) async {
        // Apply change to the appropriate component
        switch change.component {
        case "graph":
            if let graphData = try? JSONDecoder().decode(GraphContextData.self, from: change.data) {
                await realTimeDataService.updateGraphData(graphData)
            }
        case "agents":
            if let agentData = try? JSONDecoder().decode(AgentContextData.self, from: change.data) {
                await realTimeDataService.updateAgentData(agentData)
            }
        case "analytics":
            if let analyticsData = try? JSONDecoder().decode(AnalyticsContextData.self, from: change.data) {
                await realTimeDataService.updateAnalyticsData(analyticsData)
            }
        default:
            logger.warning("Unknown component for change: \(change.component)")
        }
    }
    
    private func detectConflict(_ change: DataChange) -> DataConflict? {
        // Check if there's a conflicting change
        let existingChanges = changeBuffer.getChanges(for: change.component)
        
        for existingChange in existingChanges {
            if existingChange.timestamp > change.timestamp && existingChange.version > change.version {
                return DataConflict(
                    id: UUID(),
                    component: change.component,
                    localChange: existingChange,
                    remoteChange: change,
                    conflictType: .versionMismatch,
                    detectedAt: Date()
                )
            }
        }
        
        return nil
    }
    
    private func handleConflict(_ conflict: DataConflict) async {
        logger.warning("Conflict detected for component: \(conflict.component)")
        
        conflictResolver.addConflict(conflict)
        conflictCount = conflictResolver.pendingConflictCount
        
        // Try automatic resolution
        if let autoResolution = conflictResolver.attemptAutoResolution(conflict) {
            await resolveConflict(conflict, resolution: autoResolution)
        } else {
            // Notify delegate for manual resolution
            syncDelegate?.conflictDetected(conflict)
        }
    }
    
    private func resolveConflicts() async {
        let conflicts = conflictResolver.getPendingConflicts()
        
        for conflict in conflicts {
            if let autoResolution = conflictResolver.attemptAutoResolution(conflict) {
                await resolveConflict(conflict, resolution: autoResolution)
            }
        }
    }
    
    private func enqueueSyncRequest(_ request: SyncRequest) async {
        // Handle sync request based on priority
        switch request.priority {
        case .urgent:
            await syncComponent(request.component)
        case .high:
            // Add to high priority queue
            break
        case .normal:
            // Add to normal queue
            break
        case .low:
            // Add to low priority queue
            break
        }
    }
    
    private func propagateChangeImmediately(_ change: DataChange) async {
        // Send change to all connected components immediately
        let message = WebSocketMessage(
            type: "change_propagation",
            data: try! JSONEncoder().encode(change),
            sessionId: realTimeDataService.currentSessionId
        )
        
        for endpoint in WebSocketConnectionManager.Endpoint.allCases {
            do {
                try await realTimeDataService.sendMessage(message, to: endpoint)
            } catch {
                logger.error("Failed to propagate change to \(endpoint.rawValue): \(error.localizedDescription)")
            }
        }
    }
    
    private func applyResolvedChange(_ data: Data, for component: String) async {
        let resolvedChange = DataChange(
            id: UUID(),
            component: component,
            type: .resolved,
            data: data,
            timestamp: Date(),
            version: versionVector.increment(for: component)
        )
        
        await applyChange(resolvedChange)
    }
    
    private func handleExternalDataChange<T: Codable>(_ data: T, component: String) {
        // Handle external data changes from real-time service
        publishChange(data, for: component, changeType: .external)
    }
    
    private func handleStateVersionChange(_ version: Int) {
        // Handle state version changes from state management
        logger.debug("State version changed to: \(version)")
        
        // Trigger sync if needed
        if changeBuffer.pendingCount > 0 {
            Task {
                await processPendingChanges()
            }
        }
    }
    
    private func performHealthCheck() async {
        logger.debug("Performing sync health check")
        
        // Check component health
        for (component, state) in componentSyncStates {
            if let lastSync = state.lastSyncTime,
               Date().timeIntervalSince(lastSync) > syncInterval * 3 {
                logger.warning("Component \(component) hasn't synced recently")
                await syncComponent(component)
            }
        }
        
        // Check conflict resolution health
        if conflictCount > 10 {
            logger.warning("High number of unresolved conflicts: \(conflictCount)")
        }
        
        updateSyncMetrics()
    }
    
    private func updateSyncMetrics() {
        syncMetrics = SyncMetrics(
            totalSyncs: syncMetrics.totalSyncs + 1,
            successfulSyncs: syncMetrics.successfulSyncs + (syncStatus == .synced ? 1 : 0),
            failedSyncs: syncMetrics.failedSyncs + (syncStatus == .error ? 1 : 0),
            averageSyncTime: calculateAverageSyncTime(),
            lastSyncDuration: calculateLastSyncDuration(),
            conflictsResolved: conflictResolver.resolvedConflictCount,
            dataTransferred: calculateDataTransferred()
        )
    }
    
    private func calculateAverageSyncTime() -> TimeInterval {
        // Calculate based on sync history
        return 0.5 // Placeholder
    }
    
    private func calculateLastSyncDuration() -> TimeInterval {
        // Calculate last sync duration
        return 0.2 // Placeholder
    }
    
    private func calculateDataTransferred() -> Int {
        // Calculate total data transferred
        return changeBuffer.totalDataSize
    }
    
    private func shouldApplyChange(_ change: DataChange) -> Bool {
        guard let localVersion = versionVector.getVersion(for: change.component) else {
            return true // No local version, apply change
        }
        
        return change.version > localVersion
    }
    
    private func mergeComponentStates(_ local: ComponentSyncState, _ remote: ComponentSyncState) -> ComponentSyncState {
        return ComponentSyncState(
            component: local.component,
            lastSyncTime: max(local.lastSyncTime ?? Date.distantPast, remote.lastSyncTime ?? Date.distantPast),
            version: max(local.version, remote.version),
            status: local.status,
            pendingChanges: local.pendingChanges + remote.pendingChanges
        )
    }
}

// MARK: - Supporting Types
enum SyncStatus: String, CaseIterable {
    case idle = "idle"
    case syncing = "syncing"
    case synced = "synced"
    case error = "error"
    case paused = "paused"
    
    var color: Color {
        switch self {
        case .idle: return .gray
        case .syncing: return .blue
        case .synced: return .green
        case .error: return .red
        case .paused: return .orange
        }
    }
    
    var icon: String {
        switch self {
        case .idle: return "pause.circle"
        case .syncing: return "arrow.triangle.2.circlepath"
        case .synced: return "checkmark.circle"
        case .error: return "xmark.circle"
        case .paused: return "pause.circle.fill"
        }
    }
}

enum SyncPriority: String, CaseIterable {
    case urgent = "urgent"
    case high = "high"
    case normal = "normal"
    case low = "low"
}

enum ChangeType: String, Codable, CaseIterable {
    case create = "create"
    case update = "update"
    case delete = "delete"
    case optimistic = "optimistic"
    case external = "external"
    case resolved = "resolved"
    case urgent = "urgent"
}

struct DataChange: Identifiable, Codable {
    let id: UUID
    let component: String
    let type: ChangeType
    let data: Data
    let timestamp: Date
    let version: Int
    
    var dataSize: Int {
        return data.count
    }
}

struct ComponentSyncState: Codable {
    let component: String
    var lastSyncTime: Date?
    var version: Int
    var status: SyncStatus
    var pendingChanges: Int
    
    init(component: String, lastSyncTime: Date? = nil, version: Int = 0, status: SyncStatus = .idle, pendingChanges: Int = 0) {
        self.component = component
        self.lastSyncTime = lastSyncTime
        self.version = version
        self.status = status
        self.pendingChanges = pendingChanges
    }
}

struct SyncMetrics {
    var totalSyncs: Int = 0
    var successfulSyncs: Int = 0
    var failedSyncs: Int = 0
    var averageSyncTime: TimeInterval = 0
    var lastSyncDuration: TimeInterval = 0
    var conflictsResolved: Int = 0
    var dataTransferred: Int = 0
    
    var successRate: Double {
        guard totalSyncs > 0 else { return 0 }
        return Double(successfulSyncs) / Double(totalSyncs)
    }
}

struct SyncRequest: Identifiable {
    let id: UUID
    let component: String
    let priority: SyncPriority
    let timestamp: Date
}

struct BatchUpdate {
    let component: String
    let type: ChangeType
    let data: Data
}

struct DataConflict: Identifiable {
    let id: UUID
    let component: String
    let localChange: DataChange
    let remoteChange: DataChange
    let conflictType: ConflictType
    let detectedAt: Date
    
    enum ConflictType: String, CaseIterable {
        case versionMismatch = "version_mismatch"
        case concurrent = "concurrent"
        case typeConflict = "type_conflict"
    }
}

struct ConflictResolution {
    let strategy: ResolutionStrategy
    let resolvedData: Data?
    let reason: String
    
    enum ResolutionStrategy: String, CaseIterable {
        case useLocal = "use_local"
        case useRemote = "use_remote"
        case merge = "merge"
        case manual = "manual"
    }
}

struct CrossPlatformSyncData: Codable {
    let versionVector: VersionVector
    let pendingChanges: [DataChange]
    let componentStates: [String: ComponentSyncState]
    let timestamp: Date
}

private struct SyncRequestData: Codable {
    let component: String
    let version: Int
}

// MARK: - Supporting Classes
private class ChangeBuffer {
    private var changes: [DataChange] = []
    private var processedIds: Set<UUID> = Set()
    private let lock = NSLock()
    private let changesSubject = PassthroughSubject<DataChange, Never>()
    
    var changesPublisher: AnyPublisher<DataChange, Never> {
        return changesSubject.eraseToAnyPublisher()
    }
    
    var pendingCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return changes.filter { !processedIds.contains($0.id) }.count
    }
    
    var totalDataSize: Int {
        lock.lock()
        defer { lock.unlock() }
        return changes.reduce(0) { $0 + $1.dataSize }
    }
    
    func addChange(_ change: DataChange) {
        lock.lock()
        defer { lock.unlock() }
        
        changes.append(change)
        changesSubject.send(change)
        
        // Limit buffer size
        if changes.count > 1000 {
            changes.removeFirst(changes.count - 1000)
        }
    }
    
    func getPendingChanges(limit: Int = Int.max) -> [DataChange] {
        lock.lock()
        defer { lock.unlock() }
        
        let pending = changes.filter { !processedIds.contains($0.id) }
        return Array(pending.prefix(limit))
    }
    
    func getChanges(for component: String) -> [DataChange] {
        lock.lock()
        defer { lock.unlock() }
        
        return changes.filter { $0.component == component }
    }
    
    func getAllChanges() -> [DataChange] {
        lock.lock()
        defer { lock.unlock() }
        
        return changes
    }
    
    func markProcessed(_ id: UUID) {
        lock.lock()
        defer { lock.unlock() }
        
        processedIds.insert(id)
    }
    
    func removeChanges(for component: String) {
        lock.lock()
        defer { lock.unlock() }
        
        changes.removeAll { $0.component == component }
        // Note: We don't remove from processedIds to maintain history
    }
}

private class VersionVector: Codable {
    private var versions: [String: Int] = [:]
    private let lock = NSLock()
    
    func getVersion(for component: String) -> Int? {
        lock.lock()
        defer { lock.unlock() }
        return versions[component]
    }
    
    func setVersion(_ version: Int, for component: String) {
        lock.lock()
        defer { lock.unlock() }
        versions[component] = version
    }
    
    @discardableResult
    func increment(for component: String) -> Int {
        lock.lock()
        defer { lock.unlock() }
        
        let newVersion = (versions[component] ?? 0) + 1
        versions[component] = newVersion
        return newVersion
    }
    
    func merge(with other: VersionVector) {
        lock.lock()
        defer { lock.unlock() }
        
        for (component, version) in other.versions {
            versions[component] = max(versions[component] ?? 0, version)
        }
    }
    
    func removeComponent(_ component: String) {
        lock.lock()
        defer { lock.unlock() }
        versions.removeValue(forKey: component)
    }
}

private class ConflictResolver {
    private var conflicts: [DataConflict] = []
    private var resolvedConflicts: [DataConflict] = []
    private let lock = NSLock()
    
    var pendingConflictCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return conflicts.count
    }
    
    var resolvedConflictCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return resolvedConflicts.count
    }
    
    func addConflict(_ conflict: DataConflict) {
        lock.lock()
        defer { lock.unlock() }
        conflicts.append(conflict)
    }
    
    func getPendingConflicts() -> [DataConflict] {
        lock.lock()
        defer { lock.unlock() }
        return conflicts
    }
    
    func resolve(_ conflict: DataConflict, with resolution: ConflictResolution) async {
        lock.lock()
        defer { lock.unlock() }
        
        if let index = conflicts.firstIndex(where: { $0.id == conflict.id }) {
            conflicts.remove(at: index)
            resolvedConflicts.append(conflict)
        }
    }
    
    func attemptAutoResolution(_ conflict: DataConflict) -> ConflictResolution? {
        // Simple auto-resolution strategy: use the newer change
        if conflict.remoteChange.timestamp > conflict.localChange.timestamp {
            return ConflictResolution(
                strategy: .useRemote,
                resolvedData: conflict.remoteChange.data,
                reason: "Remote change is newer"
            )
        } else {
            return ConflictResolution(
                strategy: .useLocal,
                resolvedData: conflict.localChange.data,
                reason: "Local change is newer"
            )
        }
    }
}

// MARK: - Delegate Protocol
protocol DataSyncDelegate: AnyObject {
    func syncDidStart()
    func syncDidComplete()
    func syncDidFail(error: Error)
    func conflictDetected(_ conflict: DataConflict)
    func conflictResolved(_ conflict: DataConflict, resolution: ConflictResolution)
}

// MARK: - Extensions for RealTimeDataService
extension RealTimeDataService {
    func updateGraphData(_ data: GraphContextData) async {
        self.graphData = data
    }
    
    func updateAgentData(_ data: AgentContextData) async {
        self.agentData = data
    }
    
    func updateAnalyticsData(_ data: AnalyticsContextData) async {
        self.analyticsData = data
    }
}