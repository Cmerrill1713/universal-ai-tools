import Foundation
import Combine
import CoreData
import OSLog
import SwiftUI

// MARK: - Supabase Service
/// Comprehensive service for Supabase database operations, real-time subscriptions, and vector search
@MainActor
public final class SupabaseService: ObservableObject {
    static let shared = SupabaseService()
    
    // MARK: - Published Properties
    @Published public var isConnected: Bool = false
    @Published public var syncStatus: SyncStatus = .idle
    @Published public var lastSyncDate: Date?
    @Published public var pendingChanges: Int = 0
    @Published public var activeSubscriptions: Set<String> = []
    
    // MARK: - Configuration
    private let supabaseURL: String
    private let supabaseAnonKey: String
    private let supabaseServiceKey: String?
    
    // MARK: - Private Properties
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let logger = Logger(subsystem: "com.universalai.tools", category: "SupabaseService")
    
    // Real-time
    private var realtimeConnection: URLSessionWebSocketTask?
    private var heartbeatTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    
    // Sync management
    private let syncQueue = DispatchQueue(label: "SupabaseSync", qos: .background)
    private var syncTimer: Timer?
    private let offlineStore = OfflineStore()
    
    // Subscriptions
    private var subscriptions: [String: RealtimeSubscription] = [:]
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    private init() {
        // Load configuration
        self.supabaseURL = ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? "http://localhost:54321"
        self.supabaseAnonKey = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? ""
        self.supabaseServiceKey = ProcessInfo.processInfo.environment["SUPABASE_SERVICE_KEY"]
        
        // Setup session
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
        
        // Setup JSON coding
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        
        // Initialize connection
        Task {
            await connect()
            await setupPeriodicSync()
        }
    }
    
    // MARK: - Connection Management
    
    /// Connect to Supabase
    public func connect() async {
        guard !supabaseAnonKey.isEmpty else {
            logger.error("❌ Supabase credentials not configured")
            return
        }
        
        do {
            // Test connection
            let testURL = URL(string: "\(supabaseURL)/rest/v1/")!
            var request = URLRequest(url: testURL)
            request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
            
            let (_, response) = try await session.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                isConnected = true
                logger.info("✅ Connected to Supabase")
                
                // Start realtime connection
                await connectRealtime()
            }
        } catch {
            logger.error("❌ Failed to connect to Supabase: \(error)")
            isConnected = false
        }
    }
    
    /// Disconnect from Supabase
    public func disconnect() async {
        isConnected = false
        
        // Close realtime connection
        realtimeConnection?.cancel(with: .goingAway, reason: nil)
        realtimeConnection = nil
        
        // Stop timers
        heartbeatTimer?.invalidate()
        syncTimer?.invalidate()
        
        // Clear subscriptions
        subscriptions.removeAll()
        activeSubscriptions.removeAll()
        
        logger.info("✅ Disconnected from Supabase")
    }
    
    // MARK: - CRUD Operations
    
    /// Fetch records from table
    public func fetch<T: Codable>(
        from table: String,
        columns: [String]? = nil,
        filter: QueryFilter? = nil,
        order: OrderBy? = nil,
        limit: Int? = nil
    ) async throws -> [T] {
        var components = URLComponents(string: "\(supabaseURL)/rest/v1/\(table)")!
        var queryItems: [URLQueryItem] = []
        
        // Add columns selection
        if let columns = columns {
            queryItems.append(URLQueryItem(name: "select", value: columns.joined(separator: ",")))
        } else {
            queryItems.append(URLQueryItem(name: "select", value: "*"))
        }
        
        // Add filter
        if let filter = filter {
            queryItems.append(contentsOf: filter.toQueryItems())
        }
        
        // Add ordering
        if let order = order {
            queryItems.append(URLQueryItem(name: "order", value: "\(order.column).\(order.ascending ? "asc" : "desc")"))
        }
        
        // Add limit
        if let limit = limit {
            queryItems.append(URLQueryItem(name: "limit", value: String(limit)))
        }
        
        components.queryItems = queryItems
        
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw SupabaseError.fetchFailed
        }
        
        let records = try decoder.decode([T].self, from: data)
        
        logger.info("✅ Fetched \(records.count) records from \(table)")
        return records
    }
    
    /// Insert record into table
    public func insert<T: Codable>(
        into table: String,
        record: T,
        returning: Bool = true
    ) async throws -> T? {
        let url = URL(string: "\(supabaseURL)/rest/v1/\(table)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if returning {
            request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        }
        
        request.httpBody = try encoder.encode(record)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.insertFailed
        }
        
        if returning && !data.isEmpty {
            let inserted = try decoder.decode([T].self, from: data)
            logger.info("✅ Inserted record into \(table)")
            return inserted.first
        }
        
        logger.info("✅ Inserted record into \(table)")
        return nil
    }
    
    /// Update records in table
    public func update<T: Codable>(
        table: String,
        set values: [String: Any],
        filter: QueryFilter,
        returning: Bool = true
    ) async throws -> [T] {
        var components = URLComponents(string: "\(supabaseURL)/rest/v1/\(table)")!
        components.queryItems = filter.toQueryItems()
        
        var request = URLRequest(url: components.url!)
        request.httpMethod = "PATCH"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if returning {
            request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: values)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.updateFailed
        }
        
        if returning && !data.isEmpty {
            let updated = try decoder.decode([T].self, from: data)
            logger.info("✅ Updated \(updated.count) records in \(table)")
            return updated
        }
        
        logger.info("✅ Updated records in \(table)")
        return []
    }
    
    /// Delete records from table
    public func delete(
        from table: String,
        filter: QueryFilter
    ) async throws {
        var components = URLComponents(string: "\(supabaseURL)/rest/v1/\(table)")!
        components.queryItems = filter.toQueryItems()
        
        var request = URLRequest(url: components.url!)
        request.httpMethod = "DELETE"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.deleteFailed
        }
        
        logger.info("✅ Deleted records from \(table)")
    }
    
    // MARK: - RPC Functions
    
    /// Call Supabase RPC function
    public func rpc<T: Codable>(
        function: String,
        params: [String: Any]? = nil
    ) async throws -> T {
        let url = URL(string: "\(supabaseURL)/rest/v1/rpc/\(function)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let params = params {
            request.httpBody = try JSONSerialization.data(withJSONObject: params)
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw SupabaseError.rpcFailed
        }
        
        let result = try decoder.decode(T.self, from: data)
        
        logger.info("✅ Called RPC function: \(function)")
        return result
    }
    
    // MARK: - Vector Search
    
    /// Perform vector similarity search
    public func vectorSearch(
        table: String,
        embedding: [Float],
        column: String = "embedding",
        limit: Int = 10,
        threshold: Float? = nil
    ) async throws -> [VectorSearchResult] {
        let params: [String: Any] = [
            "query_embedding": embedding,
            "match_count": limit,
            "threshold": threshold ?? 0.0
        ]
        
        let results: [VectorSearchResult] = try await rpc(
            function: "\(table)_vector_search",
            params: params
        )
        
        logger.info("✅ Vector search returned \(results.count) results")
        return results
    }
    
    /// Store vector embedding
    public func storeEmbedding(
        table: String,
        id: String,
        embedding: [Float],
        metadata: [String: Any]? = nil
    ) async throws {
        var record: [String: Any] = [
            "id": id,
            "embedding": embedding
        ]
        
        if let metadata = metadata {
            record["metadata"] = metadata
        }
        
        let url = URL(string: "\(supabaseURL)/rest/v1/\(table)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: record)
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.insertFailed
        }
        
        logger.info("✅ Stored embedding for ID: \(id)")
    }
    
    // MARK: - Real-time Subscriptions
    
    /// Subscribe to table changes
    public func subscribe(
        to table: String,
        event: RealtimeEvent = .all,
        filter: String? = nil,
        handler: @escaping (RealtimeMessage) -> Void
    ) async -> String {
        let subscriptionId = UUID().uuidString
        
        let subscription = RealtimeSubscription(
            id: subscriptionId,
            table: table,
            event: event,
            filter: filter,
            handler: handler
        )
        
        subscriptions[subscriptionId] = subscription
        activeSubscriptions.insert(subscriptionId)
        
        // Send subscription message
        await sendRealtimeMessage([
            "event": "phx_join",
            "topic": "realtime:\(table)",
            "payload": [
                "config": [
                    "broadcast": ["self": true],
                    "presence": ["key": ""],
                    "postgres_changes": [[
                        "event": event.rawValue,
                        "schema": "public",
                        "table": table,
                        "filter": filter ?? ""
                    ]]
                ]
            ],
            "ref": subscriptionId
        ])
        
        logger.info("✅ Subscribed to \(table) changes")
        return subscriptionId
    }
    
    /// Unsubscribe from changes
    public func unsubscribe(subscriptionId: String) async {
        guard let subscription = subscriptions[subscriptionId] else { return }
        
        await sendRealtimeMessage([
            "event": "phx_leave",
            "topic": "realtime:\(subscription.table)",
            "ref": subscriptionId
        ])
        
        subscriptions.removeValue(forKey: subscriptionId)
        activeSubscriptions.remove(subscriptionId)
        
        logger.info("✅ Unsubscribed from subscription: \(subscriptionId)")
    }
    
    // MARK: - Storage
    
    /// Upload file to storage
    public func uploadFile(
        bucket: String,
        path: String,
        data: Data,
        contentType: String = "application/octet-stream"
    ) async throws -> StorageFile {
        let url = URL(string: "\(supabaseURL)/storage/v1/object/\(bucket)/\(path)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        
        let (responseData, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.uploadFailed
        }
        
        let file = try decoder.decode(StorageFile.self, from: responseData)
        
        logger.info("✅ Uploaded file to \(bucket)/\(path)")
        return file
    }
    
    /// Download file from storage
    public func downloadFile(
        bucket: String,
        path: String
    ) async throws -> Data {
        let url = URL(string: "\(supabaseURL)/storage/v1/object/\(bucket)/\(path)")!
        
        var request = URLRequest(url: url)
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw SupabaseError.downloadFailed
        }
        
        logger.info("✅ Downloaded file from \(bucket)/\(path)")
        return data
    }
    
    /// Get public URL for file
    public func getPublicURL(bucket: String, path: String) -> URL {
        return URL(string: "\(supabaseURL)/storage/v1/object/public/\(bucket)/\(path)")!
    }
    
    // MARK: - Sync Operations
    
    /// Sync local changes with Supabase
    public func syncChanges() async throws {
        syncStatus = .syncing
        
        do {
            // Get pending changes from offline store
            let pendingChanges = await offlineStore.getPendingChanges()
            self.pendingChanges = pendingChanges.count
            
            for change in pendingChanges {
                try await applyChange(change)
                await offlineStore.markSynced(change.id)
                self.pendingChanges -= 1
            }
            
            // Pull remote changes
            try await pullRemoteChanges()
            
            lastSyncDate = Date()
            syncStatus = .synced
            
            logger.info("✅ Sync completed successfully")
        } catch {
            syncStatus = .error(error)
            throw error
        }
    }
    
    /// Enable offline mode
    public func enableOfflineMode() {
        offlineStore.isEnabled = true
        logger.info("✅ Offline mode enabled")
    }
    
    /// Disable offline mode
    public func disableOfflineMode() {
        offlineStore.isEnabled = false
        logger.info("✅ Offline mode disabled")
    }
    
    // MARK: - Auth Integration
    
    /// Sign in with email and password
    public func signIn(email: String, password: String) async throws -> AuthResponse {
        let url = URL(string: "\(supabaseURL)/auth/v1/token?grant_type=password")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode([
            "email": email,
            "password": password
        ])
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw SupabaseError.authFailed
        }
        
        let authResponse = try decoder.decode(AuthResponse.self, from: data)
        
        logger.info("✅ Signed in user: \(email)")
        return authResponse
    }
    
    /// Sign out
    public func signOut(accessToken: String) async throws {
        let url = URL(string: "\(supabaseURL)/auth/v1/logout")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.signOutFailed
        }
        
        logger.info("✅ Signed out successfully")
    }
    
    // MARK: - Private Methods
    
    private func connectRealtime() async {
        let wsURL = URL(string: supabaseURL.replacingOccurrences(of: "http", with: "ws"))!
            .appendingPathComponent("realtime/v1/websocket")
            .appending(queryItems: [
                URLQueryItem(name: "apikey", value: supabaseAnonKey),
                URLQueryItem(name: "vsn", value: "1.0.0")
            ])
        
        realtimeConnection = session.webSocketTask(with: wsURL)
        realtimeConnection?.resume()
        
        // Start listening for messages
        Task {
            await listenForRealtimeMessages()
        }
        
        // Start heartbeat
        startHeartbeat()
        
        logger.info("✅ Connected to Supabase Realtime")
    }
    
    private func listenForRealtimeMessages() async {
        guard let connection = realtimeConnection else { return }
        
        do {
            while true {
                let message = try await connection.receive()
                
                switch message {
                case .string(let text):
                    await handleRealtimeMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        await handleRealtimeMessage(text)
                    }
                @unknown default:
                    break
                }
            }
        } catch {
            logger.error("❌ Realtime connection error: \(error)")
            await reconnectRealtime()
        }
    }
    
    private func handleRealtimeMessage(_ text: String) async {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let event = json["event"] as? String else {
            return
        }
        
        switch event {
        case "phx_reply":
            // Handle subscription confirmation
            if let ref = json["ref"] as? String {
                logger.debug("Subscription confirmed: \(ref)")
            }
            
        case "postgres_changes":
            // Handle database changes
            if let payload = json["payload"] as? [String: Any],
               let topic = json["topic"] as? String {
                await handleDatabaseChange(payload, topic: topic)
            }
            
        case "heartbeat":
            // Respond to heartbeat
            await sendRealtimeMessage([
                "event": "heartbeat",
                "topic": "phoenix",
                "ref": UUID().uuidString
            ])
            
        default:
            break
        }
    }
    
    private func handleDatabaseChange(_ payload: [String: Any], topic: String) async {
        // Find matching subscriptions
        let table = topic.replacingOccurrences(of: "realtime:", with: "")
        
        for (_, subscription) in subscriptions where subscription.table == table {
            let message = RealtimeMessage(
                table: table,
                event: subscription.event,
                payload: payload
            )
            
            subscription.handler(message)
        }
    }
    
    private func sendRealtimeMessage(_ message: [String: Any]) async {
        guard let connection = realtimeConnection,
              let data = try? JSONSerialization.data(withJSONObject: message),
              let text = String(data: data, encoding: .utf8) else {
            return
        }
        
        try? await connection.send(.string(text))
    }
    
    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            Task {
                await self.sendRealtimeMessage([
                    "event": "heartbeat",
                    "topic": "phoenix",
                    "ref": UUID().uuidString
                ])
            }
        }
    }
    
    private func reconnectRealtime() async {
        guard reconnectAttempts < maxReconnectAttempts else {
            logger.error("❌ Max reconnection attempts reached")
            return
        }
        
        reconnectAttempts += 1
        
        // Wait with exponential backoff
        let delay = pow(2.0, Double(reconnectAttempts))
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        
        await connectRealtime()
    }
    
    private func setupPeriodicSync() async {
        syncTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { _ in
            Task {
                if self.offlineStore.hasPendingChanges {
                    try? await self.syncChanges()
                }
            }
        }
    }
    
    private func applyChange(_ change: PendingChange) async throws {
        switch change.operation {
        case .insert:
            let _: EmptyResponse = try await insert(
                into: change.table,
                record: change.data,
                returning: false
            ) ?? EmptyResponse()
            
        case .update:
            let _: [EmptyResponse] = try await update(
                table: change.table,
                set: change.data,
                filter: QueryFilter.eq(column: "id", value: change.recordId ?? ""),
                returning: false
            )
            
        case .delete:
            try await delete(
                from: change.table,
                filter: QueryFilter.eq(column: "id", value: change.recordId ?? "")
            )
        }
    }
    
    private func pullRemoteChanges() async throws {
        // Implementation for pulling remote changes
        // This would typically use a timestamp or version field
    }
}

// MARK: - Supporting Types

public enum SyncStatus: Equatable {
    case idle
    case syncing
    case synced
    case error(Error)
    
    public static func == (lhs: SyncStatus, rhs: SyncStatus) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.syncing, .syncing), (.synced, .synced):
            return true
        case (.error, .error):
            return true
        default:
            return false
        }
    }
}

public struct QueryFilter {
    let conditions: [Condition]
    
    public static func eq(column: String, value: Any) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "eq", value: value)])
    }
    
    public static func neq(column: String, value: Any) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "neq", value: value)])
    }
    
    public static func gt(column: String, value: Any) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "gt", value: value)])
    }
    
    public static func gte(column: String, value: Any) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "gte", value: value)])
    }
    
    public static func lt(column: String, value: Any) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "lt", value: value)])
    }
    
    public static func lte(column: String, value: Any) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "lte", value: value)])
    }
    
    public static func like(column: String, pattern: String) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "like", value: pattern)])
    }
    
    public static func ilike(column: String, pattern: String) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "ilike", value: pattern)])
    }
    
    public static func `in`(column: String, values: [Any]) -> QueryFilter {
        QueryFilter(conditions: [Condition(column: column, op: "in", value: values)])
    }
    
    func toQueryItems() -> [URLQueryItem] {
        conditions.map { condition in
            let value = String(describing: condition.value)
            return URLQueryItem(name: "\(condition.column)", value: "\(condition.op).\(value)")
        }
    }
    
    struct Condition {
        let column: String
        let op: String
        let value: Any
    }
}

public struct OrderBy {
    public let column: String
    public let ascending: Bool
    
    public init(column: String, ascending: Bool = true) {
        self.column = column
        self.ascending = ascending
    }
}

public struct VectorSearchResult: Codable {
    public let id: String
    public let similarity: Float
    public let metadata: [String: Any]?
    
    enum CodingKeys: String, CodingKey {
        case id
        case similarity
        case metadata
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        similarity = try container.decode(Float.self, forKey: .similarity)
        
        if let metadataData = try? container.decode(Data.self, forKey: .metadata),
           let metadata = try? JSONSerialization.jsonObject(with: metadataData) as? [String: Any] {
            self.metadata = metadata
        } else {
            self.metadata = nil
        }
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(similarity, forKey: .similarity)
        
        if let metadata = metadata,
           let data = try? JSONSerialization.data(withJSONObject: metadata) {
            try container.encode(data, forKey: .metadata)
        }
    }
}

public enum RealtimeEvent: String {
    case all = "*"
    case insert = "INSERT"
    case update = "UPDATE"
    case delete = "DELETE"
}

public struct RealtimeMessage {
    public let table: String
    public let event: RealtimeEvent
    public let payload: [String: Any]
}

struct RealtimeSubscription {
    let id: String
    let table: String
    let event: RealtimeEvent
    let filter: String?
    let handler: (RealtimeMessage) -> Void
}

public struct StorageFile: Codable {
    public let id: String
    public let path: String
    public let size: Int64
    public let contentType: String
    public let createdAt: Date
}

public struct AuthResponse: Codable {
    public let accessToken: String
    public let refreshToken: String?
    public let user: AuthUser
}

public struct AuthUser: Codable {
    public let id: String
    public let email: String
    public let metadata: [String: Any]?
    
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case metadata = "user_metadata"
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        email = try container.decode(String.self, forKey: .email)
        
        if let metadataData = try? container.decode(Data.self, forKey: .metadata),
           let metadata = try? JSONSerialization.jsonObject(with: metadataData) as? [String: Any] {
            self.metadata = metadata
        } else {
            self.metadata = nil
        }
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(email, forKey: .email)
        
        if let metadata = metadata,
           let data = try? JSONSerialization.data(withJSONObject: metadata) {
            try container.encode(data, forKey: .metadata)
        }
    }
}

public enum SupabaseError: LocalizedError {
    case fetchFailed
    case insertFailed
    case updateFailed
    case deleteFailed
    case rpcFailed
    case uploadFailed
    case downloadFailed
    case authFailed
    case signOutFailed
    case realtimeFailed
    
    public var errorDescription: String? {
        switch self {
        case .fetchFailed:
            return "Failed to fetch data from Supabase"
        case .insertFailed:
            return "Failed to insert record into Supabase"
        case .updateFailed:
            return "Failed to update record in Supabase"
        case .deleteFailed:
            return "Failed to delete record from Supabase"
        case .rpcFailed:
            return "Failed to execute RPC function"
        case .uploadFailed:
            return "Failed to upload file to storage"
        case .downloadFailed:
            return "Failed to download file from storage"
        case .authFailed:
            return "Authentication failed"
        case .signOutFailed:
            return "Failed to sign out"
        case .realtimeFailed:
            return "Realtime connection failed"
        }
    }
}

// MARK: - Offline Store

class OfflineStore {
    var isEnabled: Bool = false
    var hasPendingChanges: Bool {
        !pendingChanges.isEmpty
    }
    
    private var pendingChanges: [PendingChange] = []
    
    func getPendingChanges() async -> [PendingChange] {
        return pendingChanges
    }
    
    func addPendingChange(_ change: PendingChange) {
        pendingChanges.append(change)
    }
    
    func markSynced(_ id: String) async {
        pendingChanges.removeAll { $0.id == id }
    }
}

struct PendingChange {
    let id: String
    let table: String
    let operation: Operation
    let recordId: String?
    let data: [String: Any]
    let timestamp: Date
    
    enum Operation {
        case insert
        case update
        case delete
    }
}

struct EmptyResponse: Codable {}