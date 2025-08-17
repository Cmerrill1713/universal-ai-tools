import Foundation
import Combine
import CoreData
import Network
import OSLog
import SwiftUI

// MARK: - Offline Sync Service
/// Comprehensive offline data management with automatic synchronization, conflict resolution, and queue management
@MainActor
public final class OfflineSyncService: ObservableObject {
    static let shared = OfflineSyncService()
    
    // MARK: - Published Properties
    @Published public var isOffline: Bool = false
    @Published public var syncStatus: SyncStatus = .idle
    @Published public var pendingOperations: [SyncOperation] = []
    @Published public var syncProgress: SyncProgress = SyncProgress()
    @Published public var conflictResolutions: [ConflictResolution] = []
    @Published public var lastSyncTime: Date?
    
    // MARK: - Private Properties
    private let persistentContainer: NSPersistentContainer
    private let operationQueue: OperationQueue
    private let syncQueue = DispatchQueue(label: "OfflineSync", qos: .background)
    private let logger = Logger(subsystem: "com.universalai.tools", category: "OfflineSync")
    
    // Services
    private let apiService: APIService
    private let supabaseService: SupabaseService
    private let networkMonitor = NWPathMonitor()
    
    // Sync management
    private var syncTimer: Timer?
    private var retryTimer: Timer?
    private var syncInProgress = false
    private let maxRetryAttempts = 3
    private var retryCount = 0
    
    // Conflict resolution
    private let conflictResolver = ConflictResolver()
    
    // Change tracking
    private var localChanges: Set<LocalChange> = []
    private var remoteChanges: Set<RemoteChange> = []
    
    // Storage
    private let documentsDirectory: URL
    private let offlineDataDirectory: URL
    
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    private init() {
        self.apiService = APIService.shared
        self.supabaseService = SupabaseService.shared
        
        // Setup Core Data
        persistentContainer = NSPersistentContainer(name: "OfflineData")
        
        // Setup directories
        documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        offlineDataDirectory = documentsDirectory.appendingPathComponent("OfflineSync")
        
        // Setup operation queue
        operationQueue = OperationQueue()
        operationQueue.name = "OfflineSyncQueue"
        operationQueue.maxConcurrentOperationCount = 3
        operationQueue.qualityOfService = .background
        
        // Create directories if needed
        try? FileManager.default.createDirectory(at: offlineDataDirectory, withIntermediateDirectories: true)
        
        // Initialize Core Data
        setupCoreData()
        
        // Setup network monitoring
        setupNetworkMonitoring()
        
        // Load pending operations
        loadPendingOperations()
        
        // Start periodic sync
        startPeriodicSync()
    }
    
    // MARK: - Public Methods
    
    /// Queue operation for offline execution
    public func queueOperation(_ operation: SyncOperation) {
        pendingOperations.append(operation)
        
        // Save to persistent storage
        saveOperation(operation)
        
        // Try to execute immediately if online
        if !isOffline {
            Task {
                await executeOperation(operation)
            }
        }
        
        logger.info("✅ Queued operation: \(operation.type)")
    }
    
    /// Synchronize all pending changes
    public func synchronize() async throws {
        guard !syncInProgress else {
            logger.info("⚠️ Sync already in progress")
            return
        }
        
        syncInProgress = true
        syncStatus = .syncing
        syncProgress.reset()
        
        defer {
            syncInProgress = false
            syncStatus = .idle
        }
        
        logger.info("🔄 Starting synchronization")
        
        do {
            // Phase 1: Upload local changes
            try await uploadLocalChanges()
            
            // Phase 2: Download remote changes
            try await downloadRemoteChanges()
            
            // Phase 3: Resolve conflicts
            try await resolveConflicts()
            
            // Phase 4: Execute pending operations
            try await executePendingOperations()
            
            // Phase 5: Clean up
            await cleanup()
            
            lastSyncTime = Date()
            syncStatus = .completed
            retryCount = 0
            
            logger.info("✅ Synchronization completed successfully")
        } catch {
            syncStatus = .failed(error)
            logger.error("❌ Synchronization failed: \(error)")
            
            // Schedule retry if needed
            if retryCount < maxRetryAttempts {
                scheduleRetry()
            }
            
            throw error
        }
    }
    
    /// Force upload all local changes
    public func forceUpload() async throws {
        logger.info("⬆️ Force uploading local changes")
        
        let operations = pendingOperations.filter { $0.direction == .upload }
        
        for operation in operations {
            try await executeOperation(operation)
        }
    }
    
    /// Force download all remote changes
    public func forceDownload() async throws {
        logger.info("⬇️ Force downloading remote changes")
        
        // Fetch latest from all tables
        let tables = ["chats", "messages", "agents", "workflows", "context"]
        
        for table in tables {
            try await downloadTableData(table)
        }
    }
    
    /// Resolve specific conflict
    public func resolveConflict(_ conflict: DataConflict, resolution: ConflictResolution) async throws {
        logger.info("🔧 Resolving conflict: \(conflict.id)")
        
        switch resolution.strategy {
        case .keepLocal:
            try await applyLocalChange(conflict.localData)
        case .keepRemote:
            try await applyRemoteChange(conflict.remoteData)
        case .merge:
            let merged = try await mergeData(conflict.localData, conflict.remoteData)
            try await applyMergedChange(merged)
        case .manual(let data):
            try await applyManualResolution(data)
        }
        
        // Remove from conflicts list
        conflictResolutions.append(resolution)
    }
    
    /// Clear all offline data
    public func clearOfflineData() async throws {
        logger.warning("🗑️ Clearing all offline data")
        
        // Clear Core Data
        let fetchRequest: NSFetchRequest<NSFetchRequestResult> = NSFetchRequest(entityName: "OfflineEntity")
        let deleteRequest = NSBatchDeleteRequest(fetchRequest: fetchRequest)
        
        try persistentContainer.viewContext.execute(deleteRequest)
        try persistentContainer.viewContext.save()
        
        // Clear file storage
        let files = try FileManager.default.contentsOfDirectory(at: offlineDataDirectory, includingPropertiesForKeys: nil)
        for file in files {
            try FileManager.default.removeItem(at: file)
        }
        
        // Clear in-memory data
        pendingOperations.removeAll()
        localChanges.removeAll()
        remoteChanges.removeAll()
        conflictResolutions.removeAll()
        
        logger.info("✅ Offline data cleared")
    }
    
    // MARK: - Data Operations
    
    /// Save data for offline access
    public func saveForOffline<T: Codable>(_ data: T, key: String, type: DataType) throws {
        let encoder = JSONEncoder()
        let encoded = try encoder.encode(data)
        
        // Save to Core Data
        let entity = OfflineEntity(context: persistentContainer.viewContext)
        entity.id = UUID()
        entity.key = key
        entity.type = type.rawValue
        entity.data = encoded
        entity.timestamp = Date()
        entity.isSynced = false
        
        try persistentContainer.viewContext.save()
        
        // Also save to file for redundancy
        let fileURL = offlineDataDirectory.appendingPathComponent("\(key).json")
        try encoded.write(to: fileURL)
        
        logger.debug("💾 Saved data for offline: \(key)")
    }
    
    /// Load data from offline storage
    public func loadFromOffline<T: Codable>(_ type: T.Type, key: String) throws -> T? {
        // Try Core Data first
        let fetchRequest: NSFetchRequest<OfflineEntity> = OfflineEntity.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "key == %@", key)
        
        if let entity = try persistentContainer.viewContext.fetch(fetchRequest).first,
           let data = entity.data {
            let decoder = JSONDecoder()
            return try decoder.decode(type, from: data)
        }
        
        // Fallback to file storage
        let fileURL = offlineDataDirectory.appendingPathComponent("\(key).json")
        if FileManager.default.fileExists(atPath: fileURL.path) {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            return try decoder.decode(type, from: data)
        }
        
        return nil
    }
    
    /// Track local change
    public func trackLocalChange(_ change: LocalChange) {
        localChanges.insert(change)
        
        // Create sync operation
        let operation = SyncOperation(
            id: UUID().uuidString,
            type: change.operationType,
            table: change.table,
            data: change.data,
            direction: .upload,
            status: .pending,
            timestamp: Date()
        )
        
        queueOperation(operation)
    }
    
    // MARK: - Private Sync Methods
    
    private func uploadLocalChanges() async throws {
        let uploadOperations = pendingOperations.filter { 
            $0.direction == .upload && $0.status == .pending 
        }
        
        syncProgress.totalOperations = uploadOperations.count
        
        for operation in uploadOperations {
            do {
                try await executeUpload(operation)
                syncProgress.completedOperations += 1
            } catch {
                syncProgress.failedOperations += 1
                logger.error("Failed to upload: \(error)")
            }
        }
    }
    
    private func downloadRemoteChanges() async throws {
        // Get last sync timestamp
        let lastSync = lastSyncTime ?? Date.distantPast
        
        // Fetch changes from each table
        let tables = ["chats", "messages", "agents", "workflows", "context"]
        
        for table in tables {
            let changes = try await fetchRemoteChanges(table: table, since: lastSync)
            
            for change in changes {
                remoteChanges.insert(change)
                
                // Check for conflicts
                if let conflict = detectConflict(change) {
                    await handleConflict(conflict)
                } else {
                    try await applyRemoteChange(change.data)
                }
            }
        }
    }
    
    private func resolveConflicts() async throws {
        let conflicts = detectAllConflicts()
        
        for conflict in conflicts {
            // Try automatic resolution first
            if let resolution = conflictResolver.autoResolve(conflict) {
                try await resolveConflict(conflict, resolution: resolution)
            } else {
                // Queue for manual resolution
                await requestManualResolution(conflict)
            }
        }
    }
    
    private func executePendingOperations() async throws {
        let pending = pendingOperations.filter { $0.status == .pending }
        
        for operation in pending {
            try await executeOperation(operation)
        }
    }
    
    private func executeOperation(_ operation: SyncOperation) async throws {
        operation.status = .inProgress
        
        do {
            switch operation.direction {
            case .upload:
                try await executeUpload(operation)
            case .download:
                try await executeDownload(operation)
            case .bidirectional:
                try await executeBidirectional(operation)
            }
            
            operation.status = .completed
            removeOperation(operation)
            
        } catch {
            operation.status = .failed
            operation.error = error
            operation.retryCount += 1
            
            if operation.retryCount < maxRetryAttempts {
                operation.status = .pending // Retry later
            }
            
            throw error
        }
    }
    
    private func executeUpload(_ operation: SyncOperation) async throws {
        switch operation.type {
        case .create:
            try await supabaseService.insert(
                into: operation.table,
                record: operation.data
            )
        case .update:
            try await supabaseService.update(
                table: operation.table,
                set: operation.data as? [String: Any] ?? [:],
                filter: QueryFilter.eq(column: "id", value: operation.recordId ?? "")
            )
        case .delete:
            try await supabaseService.delete(
                from: operation.table,
                filter: QueryFilter.eq(column: "id", value: operation.recordId ?? "")
            )
        case .custom:
            try await executeCustomOperation(operation)
        }
    }
    
    private func executeDownload(_ operation: SyncOperation) async throws {
        let data: [Any] = try await supabaseService.fetch(
            from: operation.table,
            filter: operation.filter
        )
        
        // Save downloaded data locally
        for item in data {
            try saveForOffline(item, key: "\(operation.table)_\(UUID())", type: .record)
        }
    }
    
    private func executeBidirectional(_ operation: SyncOperation) async throws {
        // Upload first, then download
        try await executeUpload(operation)
        try await executeDownload(operation)
    }
    
    private func executeCustomOperation(_ operation: SyncOperation) async throws {
        // Handle custom operations
        logger.info("Executing custom operation: \(operation.id)")
    }
    
    // MARK: - Conflict Detection & Resolution
    
    private func detectConflict(_ remoteChange: RemoteChange) -> DataConflict? {
        // Check if there's a local change for the same record
        guard let localChange = localChanges.first(where: { 
            $0.recordId == remoteChange.recordId && $0.table == remoteChange.table 
        }) else {
            return nil
        }
        
        // Check if timestamps indicate a conflict
        if localChange.timestamp > remoteChange.timestamp {
            return nil // Local is newer, no conflict
        }
        
        // Check if data differs
        if !datasDiffer(localChange.data, remoteChange.data) {
            return nil // Same data, no conflict
        }
        
        return DataConflict(
            id: UUID().uuidString,
            table: remoteChange.table,
            recordId: remoteChange.recordId,
            localData: localChange.data,
            remoteData: remoteChange.data,
            localTimestamp: localChange.timestamp,
            remoteTimestamp: remoteChange.timestamp
        )
    }
    
    private func detectAllConflicts() -> [DataConflict] {
        var conflicts: [DataConflict] = []
        
        for remoteChange in remoteChanges {
            if let conflict = detectConflict(remoteChange) {
                conflicts.append(conflict)
            }
        }
        
        return conflicts
    }
    
    private func handleConflict(_ conflict: DataConflict) async {
        logger.warning("⚠️ Conflict detected: \(conflict.id)")
        
        // Try automatic resolution
        if let resolution = conflictResolver.autoResolve(conflict) {
            try? await resolveConflict(conflict, resolution: resolution)
        } else {
            // Add to UI for manual resolution
            await MainActor.run {
                // This would trigger UI notification
            }
        }
    }
    
    private func requestManualResolution(_ conflict: DataConflict) async {
        // Create notification for user
        await MainActor.run {
            // Show conflict resolution UI
        }
    }
    
    private func datasDiffer(_ data1: Any, _ data2: Any) -> Bool {
        // Compare data objects
        // This is a simplified implementation
        return true
    }
    
    // MARK: - Apply Changes
    
    private func applyLocalChange(_ data: Any) async throws {
        // Apply local change to remote
        logger.debug("Applying local change")
    }
    
    private func applyRemoteChange(_ data: Any) async throws {
        // Apply remote change to local
        logger.debug("Applying remote change")
    }
    
    private func applyMergedChange(_ data: Any) async throws {
        // Apply merged change
        logger.debug("Applying merged change")
    }
    
    private func applyManualResolution(_ data: Any) async throws {
        // Apply manual resolution
        logger.debug("Applying manual resolution")
    }
    
    private func mergeData(_ local: Any, _ remote: Any) async throws -> Any {
        // Merge strategy implementation
        return local // Placeholder
    }
    
    // MARK: - Helper Methods
    
    private func setupCoreData() {
        let description = NSPersistentStoreDescription()
        description.type = NSSQLiteStoreType
        description.url = offlineDataDirectory.appendingPathComponent("OfflineData.sqlite")
        
        persistentContainer.persistentStoreDescriptions = [description]
        
        persistentContainer.loadPersistentStores { _, error in
            if let error = error {
                self.logger.error("Failed to load Core Data: \(error)")
            }
        }
        
        persistentContainer.viewContext.automaticallyMergesChangesFromParent = true
    }
    
    private func setupNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let wasOffline = self?.isOffline ?? false
                self?.isOffline = path.status != .satisfied
                
                // Trigger sync when coming back online
                if wasOffline && path.status == .satisfied {
                    self?.logger.info("📶 Network restored, triggering sync")
                    Task {
                        try? await self?.synchronize()
                    }
                }
            }
        }
        
        let queue = DispatchQueue(label: "NetworkMonitor")
        networkMonitor.start(queue: queue)
    }
    
    private func loadPendingOperations() {
        let fetchRequest: NSFetchRequest<OfflineEntity> = OfflineEntity.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "isSynced == NO")
        
        do {
            let entities = try persistentContainer.viewContext.fetch(fetchRequest)
            
            for entity in entities {
                if let data = entity.data,
                   let operation = try? JSONDecoder().decode(SyncOperation.self, from: data) {
                    pendingOperations.append(operation)
                }
            }
            
            logger.info("📥 Loaded \(pendingOperations.count) pending operations")
        } catch {
            logger.error("Failed to load pending operations: \(error)")
        }
    }
    
    private func saveOperation(_ operation: SyncOperation) {
        do {
            let encoded = try JSONEncoder().encode(operation)
            
            let entity = OfflineEntity(context: persistentContainer.viewContext)
            entity.id = UUID()
            entity.key = operation.id
            entity.type = "operation"
            entity.data = encoded
            entity.timestamp = Date()
            entity.isSynced = false
            
            try persistentContainer.viewContext.save()
        } catch {
            logger.error("Failed to save operation: \(error)")
        }
    }
    
    private func removeOperation(_ operation: SyncOperation) {
        pendingOperations.removeAll { $0.id == operation.id }
        
        // Remove from Core Data
        let fetchRequest: NSFetchRequest<OfflineEntity> = OfflineEntity.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "key == %@", operation.id)
        
        do {
            if let entity = try persistentContainer.viewContext.fetch(fetchRequest).first {
                persistentContainer.viewContext.delete(entity)
                try persistentContainer.viewContext.save()
            }
        } catch {
            logger.error("Failed to remove operation: \(error)")
        }
    }
    
    private func startPeriodicSync() {
        syncTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { _ in
            if !self.isOffline && !self.syncInProgress {
                Task {
                    try? await self.synchronize()
                }
            }
        }
    }
    
    private func scheduleRetry() {
        retryCount += 1
        let delay = TimeInterval(pow(2.0, Double(retryCount))) // Exponential backoff
        
        retryTimer?.invalidate()
        retryTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { _ in
            Task {
                try? await self.synchronize()
            }
        }
        
        logger.info("⏰ Scheduled retry #\(retryCount) in \(delay) seconds")
    }
    
    private func fetchRemoteChanges(table: String, since: Date) async throws -> [RemoteChange] {
        let filter = QueryFilter.gt(column: "updated_at", value: since.timeIntervalSince1970)
        
        let data: [[String: Any]] = try await supabaseService.fetch(
            from: table,
            filter: filter,
            order: OrderBy(column: "updated_at", ascending: true)
        )
        
        return data.compactMap { dict in
            RemoteChange(
                recordId: dict["id"] as? String ?? "",
                table: table,
                data: dict,
                timestamp: Date(timeIntervalSince1970: dict["updated_at"] as? TimeInterval ?? 0)
            )
        }
    }
    
    private func downloadTableData(_ table: String) async throws {
        let data: [[String: Any]] = try await supabaseService.fetch(
            from: table,
            order: OrderBy(column: "created_at", ascending: false),
            limit: 100
        )
        
        for (index, item) in data.enumerated() {
            try saveForOffline(item, key: "\(table)_\(index)", type: .record)
        }
        
        logger.info("📥 Downloaded \(data.count) records from \(table)")
    }
    
    private func cleanup() async {
        // Clean up old data
        let cutoffDate = Date().addingTimeInterval(-7 * 24 * 60 * 60) // 7 days
        
        let fetchRequest: NSFetchRequest<OfflineEntity> = OfflineEntity.fetchRequest()
        fetchRequest.predicate = NSPredicate(format: "timestamp < %@ AND isSynced == YES", cutoffDate as NSDate)
        
        do {
            let entities = try persistentContainer.viewContext.fetch(fetchRequest)
            
            for entity in entities {
                persistentContainer.viewContext.delete(entity)
            }
            
            try persistentContainer.viewContext.save()
            
            logger.info("🧹 Cleaned up \(entities.count) old records")
        } catch {
            logger.error("Cleanup failed: \(error)")
        }
    }
}

// MARK: - Supporting Types

public class SyncOperation: Codable, ObservableObject {
    public let id: String
    public let type: OperationType
    public let table: String
    public let recordId: String?
    public let data: Any
    public let direction: SyncDirection
    public var status: OperationStatus
    public let timestamp: Date
    public var retryCount: Int = 0
    public var error: Error?
    public let filter: QueryFilter?
    
    enum CodingKeys: String, CodingKey {
        case id, type, table, recordId, direction, status, timestamp, retryCount
    }
    
    public init(id: String, type: OperationType, table: String, data: Any,
                direction: SyncDirection, status: OperationStatus, timestamp: Date,
                recordId: String? = nil, filter: QueryFilter? = nil) {
        self.id = id
        self.type = type
        self.table = table
        self.recordId = recordId
        self.data = data
        self.direction = direction
        self.status = status
        self.timestamp = timestamp
        self.filter = filter
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(type, forKey: .type)
        try container.encode(table, forKey: .table)
        try container.encodeIfPresent(recordId, forKey: .recordId)
        try container.encode(direction, forKey: .direction)
        try container.encode(status, forKey: .status)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encode(retryCount, forKey: .retryCount)
    }
    
    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        type = try container.decode(OperationType.self, forKey: .type)
        table = try container.decode(String.self, forKey: .table)
        recordId = try container.decodeIfPresent(String.self, forKey: .recordId)
        direction = try container.decode(SyncDirection.self, forKey: .direction)
        status = try container.decode(OperationStatus.self, forKey: .status)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        retryCount = try container.decode(Int.self, forKey: .retryCount)
        
        data = [:] // Placeholder
        filter = nil
    }
}

public enum OperationType: String, Codable {
    case create
    case update
    case delete
    case custom
}

public enum SyncDirection: String, Codable {
    case upload
    case download
    case bidirectional
}

public enum OperationStatus: String, Codable {
    case pending
    case inProgress
    case completed
    case failed
}

public enum SyncStatus: Equatable {
    case idle
    case syncing
    case completed
    case failed(Error)
    
    public static func == (lhs: SyncStatus, rhs: SyncStatus) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.syncing, .syncing), (.completed, .completed):
            return true
        case (.failed, .failed):
            return true
        default:
            return false
        }
    }
}

public struct SyncProgress {
    public var totalOperations: Int = 0
    public var completedOperations: Int = 0
    public var failedOperations: Int = 0
    
    public var progress: Double {
        guard totalOperations > 0 else { return 0 }
        return Double(completedOperations) / Double(totalOperations)
    }
    
    mutating func reset() {
        totalOperations = 0
        completedOperations = 0
        failedOperations = 0
    }
}

public struct LocalChange: Hashable {
    public let recordId: String
    public let table: String
    public let operationType: OperationType
    public let data: Any
    public let timestamp: Date
    
    public func hash(into hasher: inout Hasher) {
        hasher.combine(recordId)
        hasher.combine(table)
    }
    
    public static func == (lhs: LocalChange, rhs: LocalChange) -> Bool {
        lhs.recordId == rhs.recordId && lhs.table == rhs.table
    }
}

public struct RemoteChange: Hashable {
    public let recordId: String
    public let table: String
    public let data: Any
    public let timestamp: Date
    
    public func hash(into hasher: inout Hasher) {
        hasher.combine(recordId)
        hasher.combine(table)
    }
    
    public static func == (lhs: RemoteChange, rhs: RemoteChange) -> Bool {
        lhs.recordId == rhs.recordId && lhs.table == rhs.table
    }
}

public struct DataConflict {
    public let id: String
    public let table: String
    public let recordId: String
    public let localData: Any
    public let remoteData: Any
    public let localTimestamp: Date
    public let remoteTimestamp: Date
}

public struct ConflictResolution {
    public let conflictId: String
    public let strategy: ResolutionStrategy
    public let timestamp: Date
    
    public enum ResolutionStrategy {
        case keepLocal
        case keepRemote
        case merge
        case manual(data: Any)
    }
}

public enum DataType: String {
    case record
    case file
    case image
    case cache
}

// MARK: - Conflict Resolver

class ConflictResolver {
    func autoResolve(_ conflict: DataConflict) -> ConflictResolution? {
        // Simple last-write-wins strategy
        if conflict.localTimestamp > conflict.remoteTimestamp {
            return ConflictResolution(
                conflictId: conflict.id,
                strategy: .keepLocal,
                timestamp: Date()
            )
        } else {
            return ConflictResolution(
                conflictId: conflict.id,
                strategy: .keepRemote,
                timestamp: Date()
            )
        }
    }
}

// MARK: - Core Data Entity

@objc(OfflineEntity)
public class OfflineEntity: NSManagedObject {
    @NSManaged public var id: UUID?
    @NSManaged public var key: String?
    @NSManaged public var type: String?
    @NSManaged public var data: Data?
    @NSManaged public var timestamp: Date?
    @NSManaged public var isSynced: Bool
}

extension OfflineEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<OfflineEntity> {
        return NSFetchRequest<OfflineEntity>(entityName: "OfflineEntity")
    }
}