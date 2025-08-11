import Foundation
import MCP
import Logging

/// MCP Service for communicating with the Universal AI Tools MCP server
@MainActor
class MCPService: ObservableObject {
    @Published var isConnected = false
    @Published var connectionStatus = "Disconnected"
    @Published var lastError: String?

    private var client: Client?
    private var transport: Transport?
    private let logger: Logger

    // MCP server process management
    private var serverProcess: Process?
    private let serverPath = "/Users/christianmerrill/Desktop/universal-ai-tools/src/mcp/supabase-mcp-server.ts"

    init() {
        // Configure logger
        self.logger = Logger(label: "com.universalaitools.mcp")
        setupClient()
    }

    private func setupClient() {
        // Create MCP client
        client = Client(
            name: "UniversalAITools",
            version: "1.0.0",
            configuration: .default
        )
    }

    // Convert Foundation values into MCP `Value` recursively
    private func toValue(_ any: Any) -> Value? {
        switch any {
        case is NSNull:
            return .null
        case let b as Bool:
            return .bool(b)
        case let i as Int:
            return .int(i)
        case let d as Double:
            return .double(d)
        case let f as Float:
            return .double(Double(f))
        case let s as String:
            return .string(s)
        case let arr as [Any]:
            return .array(arr.compactMap { toValue($0) })
        case let dict as [String: Any]:
            var object: [String: Value] = [:]
            for (k, v) in dict { if let val = toValue(v) { object[k] = val } }
            return .object(object)
        default:
            return .string(String(describing: any))
        }
    }

    // MARK: - Connection Management

    /// Connect to the MCP server using stdio transport
    func connectToServer() async throws {
        guard let client = client else {
            throw MCPError.clientNotInitialized
        }

        // Start the MCP server process if not already running
        if serverProcess == nil || serverProcess?.isRunning == false {
            try await startServerProcess()
        }

        // Create stdio transport to communicate with the server
        let transport = StdioTransport(logger: logger)
        self.transport = transport

        // Connect client to server
        let result = try await client.connect(transport: transport)

        // Check capabilities
        logger.info("Connected to MCP server with capabilities: \(result.capabilities)")

        isConnected = true
        connectionStatus = "Connected"

        // Setup notification handlers
        await setupNotificationHandlers()
    }

    /// Start the MCP server process
    private func startServerProcess() async throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["tsx", serverPath]

        // Set environment variables
        var environment = ProcessInfo.processInfo.environment
        environment["SUPABASE_URL"] = UserDefaults.standard.string(forKey: "SUPABASE_URL") ?? ""
        // If you store the key in Keychain, fetch here; else rely on env defaults
        environment["SUPABASE_SERVICE_KEY"] = environment["SUPABASE_SERVICE_KEY"] ?? ""
        process.environment = environment

        // Setup pipes for stdio communication
        process.standardInput = Pipe()
        process.standardOutput = Pipe()
        process.standardError = Pipe()

        do {
            try process.run()
            serverProcess = process

            // Wait a moment for the server to initialize
            try await Task.sleep(nanoseconds: 1_000_000_000) // 1 second

            logger.info("MCP server process started with PID: \(process.processIdentifier)")
        } catch {
            logger.error("Failed to start MCP server: \(error)")
            throw MCPError.serverStartFailed(error.localizedDescription)
        }
    }

    /// Disconnect from the MCP server
    func disconnect() async {
        await client?.disconnect()

        // Terminate server process if we started it
        if let process = serverProcess, process.isRunning {
            process.terminate()
            serverProcess = nil
        }

        isConnected = false
        connectionStatus = "Disconnected"
    }

    // MARK: - MCP Operations

    /// Save context to Supabase via MCP
    func saveContext(content: String, category: String, metadata: [String: Any]? = nil) async throws {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var args: [String: Value] = [
            "content": try Value(content),
            "category": try Value(category)
        ]
        if let metadata, let v = toValue(metadata) { args["metadata"] = v }
        let (result, isError) = try await client.callTool(
            name: "save_context",
            arguments: args
        )

        if (isError ?? false) {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        logger.info("Context saved successfully in category: \(category)")
    }

    /// Search saved context
    func searchContext(query: String, category: String? = nil, limit: Int = 10) async throws -> [[String: Any]] {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var arguments: [String: Value] = [
            "query": try Value(query),
            "limit": try Value(limit)
        ]

        if let category = category {
            arguments["category"] = try Value(category)
        }

        let (result, isError) = try await client.callTool(
            name: "search_context",
            arguments: arguments
        )

        if (isError ?? false) {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        // Parse the JSON response
        if case .text(let text) = result.first {
            if let data = text.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let results = json["results"] as? [[String: Any]] {
                return results
            }
        }

        return []
    }

    /// Get recent context entries
    func getRecentContext(category: String? = nil, limit: Int = 20) async throws -> [[String: Any]] {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var arguments: [String: Value] = ["limit": try Value(limit)]

        if let category = category {
            arguments["category"] = try Value(category)
        }

        let (result, isError) = try await client.callTool(
            name: "get_recent_context",
            arguments: arguments
        )

        if (isError ?? false) {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        // Parse the JSON response
        if case .text(let text) = result.first {
            if let data = text.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let results = json["results"] as? [[String: Any]] {
                return results
            }
        }

        return []
    }

    /// Save a code pattern for future reference
    func saveCodePattern(
        patternType: String,
        beforeCode: String,
        afterCode: String,
        description: String,
        errorTypes: [String],
        metadata: [String: Any]? = nil
    ) async throws {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var cpArgs: [String: Value] = [
            "pattern_type": try Value(patternType),
            "before_code": try Value(beforeCode),
            "after_code": try Value(afterCode),
            "description": try Value(description),
            "error_types": try Value(errorTypes)
        ]
        if let metadata, let v = toValue(metadata) { cpArgs["metadata"] = v }
        let (result, isError) = try await client.callTool(
            name: "save_code_pattern",
            arguments: cpArgs
        )

        if (isError ?? false) {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        logger.info("Code pattern saved: \(patternType)")
    }

    /// Get code patterns for similar errors
    func getCodePatterns(
        errorType: String? = nil,
        patternType: String? = nil,
        limit: Int = 10
    ) async throws -> [[String: Any]] {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var arguments: [String: Value] = ["limit": try Value(limit)]

        if let errorType = errorType {
            arguments["error_type"] = try Value(errorType)
        }

        if let patternType = patternType {
            arguments["pattern_type"] = try Value(patternType)
        }

        let (result, isError) = try await client.callTool(
            name: "get_code_patterns",
            arguments: arguments
        )

        if isError ?? false {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        // Parse the JSON response
        if case .text(let text) = result.first {
            if let data = text.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let patterns = json["patterns"] as? [[String: Any]] {
                return patterns
            }
        }

        return []
    }

    /// Get MCP task history
    func getTaskHistory(
        taskId: String? = nil,
        status: String? = nil,
        limit: Int = 50
    ) async throws -> [[String: Any]] {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var arguments: [String: Value] = ["limit": try Value(limit)]
        if let taskId = taskId, !taskId.isEmpty { arguments["task_id"] = try Value(taskId) }
        if let status = status, !status.isEmpty { arguments["status"] = try Value(status) }

        let (result, isError) = try await client.callTool(
            name: "get_task_history",
            arguments: arguments
        )

        if (isError ?? false) {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        if case .text(let text) = result.first {
            if let data = text.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let tasks = json["tasks"] as? [[String: Any]] {
                return tasks
            }
        }
        return []
    }

    // MARK: - Resources API

    func listResources() async throws -> [Resource] {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }
        let (resources, _) = try await client.listResources()
        return resources
    }

    func readResource(uri: String) async throws -> String {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }
        let contents = try await client.readResource(uri: uri)
        // Return first textual content if present
        for content in contents {
            if let text = content.text { return text }
        }
        return ""
    }

    /// Propose a database migration using local LLM
    func proposeMigration(request: String, notes: String? = nil, model: String? = nil) async throws -> String {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var arguments: [String: Value] = ["request": try Value(request)]

        if let notes = notes {
            arguments["notes"] = try Value(notes)
        }

        if let model = model {
            arguments["model"] = try Value(model)
        }

        let (result, isError) = try await client.callTool(
            name: "propose_migration",
            arguments: arguments
        )

        if (isError ?? false) {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        // Extract SQL from response
        if case .text(let text) = result.first {
            return text
        }

        return ""
    }

    /// Save or update task progress
    func saveTaskProgress(
        taskId: String,
        description: String,
        status: MCPTaskStatus,
        progressPercentage: Int? = nil,
        metadata: [String: Any]? = nil
    ) async throws {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var arguments: [String: Value] = [
            "task_id": try Value(taskId),
            "description": try Value(description),
            "status": try Value(status.rawValue)
        ]

        if let progress = progressPercentage {
            arguments["progress_percentage"] = try Value(progress)
        }

        if let metadata, let v = toValue(metadata) {
            arguments["metadata"] = v
        }

        let (result, isError) = try await client.callTool(
            name: "save_task_progress",
            arguments: arguments
        )

        if (isError ?? false) {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        logger.info("Task \(taskId) updated to status: \(status.rawValue)")
    }

    /// Analyze and store TypeScript error patterns
    func analyzeErrors(
        errorType: String,
        errorMessage: String,
        filePath: String? = nil,
        lineNumber: Int? = nil,
        solutionPattern: String? = nil,
        metadata: [String: Any]? = nil
    ) async throws {
        guard let client = client, isConnected else {
            throw MCPError.notConnected
        }

        var arguments: [String: Value] = [
            "error_type": try Value(errorType),
            "error_message": try Value(errorMessage)
        ]

        if let filePath = filePath {
            arguments["file_path"] = try Value(filePath)
        }

        if let lineNumber = lineNumber {
            arguments["line_number"] = try Value(lineNumber)
        }

        if let solutionPattern = solutionPattern {
            arguments["solution_pattern"] = try Value(solutionPattern)
        }

        if let metadata, let v = toValue(metadata) {
            arguments["metadata"] = v
        }

        let (result, isError) = try await client.callTool(
            name: "analyze_errors",
            arguments: arguments
        )

        if isError ?? false {
            throw MCPError.toolCallFailed(extractErrorMessage(from: result))
        }

        logger.info("Error analysis saved for type: \(errorType)")
    }

    // MARK: - Notification Handlers

    private func setupNotificationHandlers() async {
        guard let client = client else { return }

        // Handle resource updates if the server supports them
        await client.onNotification(ResourceUpdatedNotification.self) { [weak self] message in
            self?.logger.info("Resource updated: \(message.params.uri)")

            // Notify the UI or refresh data as needed
            Task { @MainActor in
                NotificationCenter.default.post(
                    name: .mcpResourceUpdated,
                    object: nil,
                    userInfo: ["uri": message.params.uri]
                )
            }
        }

        // Handle tool list changes
        await client.onNotification(ToolListChangedNotification.self) { [weak self] _ in
            self?.logger.info("Tool list changed")

            // Refresh available tools
            Task { @MainActor in
                NotificationCenter.default.post(name: .mcpToolListChanged, object: nil)
            }
        }
    }

    // MARK: - Helper Methods

    private func extractErrorMessage(from content: [Tool.Content]) -> String {
        for item in content {
            if case .text(let text) = item {
                return text
            }
        }
        return "Unknown error"
    }
}

// MARK: - Supporting Types

enum MCPTaskStatus: String {
    case pending = "pending"
    case inProgress = "in_progress"
    case completed = "completed"
    case failed = "failed"
}

enum MCPError: LocalizedError {
    case clientNotInitialized
    case notConnected
    case serverStartFailed(String)
    case toolCallFailed(String)

    var errorDescription: String? {
        switch self {
        case .clientNotInitialized:
            return "MCP client not initialized"
        case .notConnected:
            return "Not connected to MCP server"
        case .serverStartFailed(let reason):
            return "Failed to start MCP server: \(reason)"
        case .toolCallFailed(let reason):
            return "Tool call failed: \(reason)"
        }
    }
}

// MARK: - Notification Names

// Notification names are defined centrally in Utils/Notifications.swift
