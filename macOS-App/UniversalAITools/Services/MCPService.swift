import Foundation
import OSLog

/// MCP Service for communicating with the Universal AI Tools MCP server
/// Real implementation that connects to backend MCP endpoints
@MainActor
class MCPService: ObservableObject {
    @Published var isConnected = false
    @Published var connectionStatus = "Disconnected"
    @Published var lastError: String?

    private let logger: Logger
    private var serverProcess: Process?
    private let serverURL = URL(string: "http://localhost:9999/api/v1/mcp")!
    private let session = URLSession.shared

    init() {
        self.logger = Logger(subsystem: "com.universalai.tools", category: "mcp")
        Task {
            await connect()
        }
    }

    // MARK: - Connection Management

    func connect() async {
        connectionStatus = "Connecting..."
        logger.info("🔌 Attempting to connect to MCP server at: \(self.serverURL)")

        do {
            // Test MCP connection via status endpoint
            let statusURL = serverURL.appendingPathComponent("status")
            logger.debug("MCP Status endpoint: \(statusURL)")
            let (data, response) = try await session.data(from: statusURL)
            logger.debug("MCP Status response received - Data size: \(data.count) bytes")

            guard let httpResponse = response as? HTTPURLResponse else {
                logger.error("❌ Invalid MCP response type")
                throw MCPError.connectionFailed("Invalid response")
            }

            logger.debug("MCP HTTP Status: \(httpResponse.statusCode)")
            if httpResponse.statusCode == 200 {
                // Parse the response to get connection status
                struct MCPStatusResponse: Codable {
                    let success: Bool
                    let data: MCPStatusData
                }

                struct MCPStatusData: Codable {
                    let connected: Bool
                    let status: String
                    let uptime: Double?
                }

                let statusResponse = try JSONDecoder().decode(MCPStatusResponse.self, from: data)
                logger.debug("MCP Status parsed - Connected: \(statusResponse.data.connected), Status: \(statusResponse.data.status)")

                isConnected = statusResponse.data.connected
                connectionStatus = statusResponse.data.status

                if isConnected {
                    logger.info("✅ Successfully connected to MCP server")
                } else {
                    logger.warning("⚠️ MCP server reachable but not connected - Status: \(statusResponse.data.status)")
                }
            } else {
                logger.error("❌ MCP server returned HTTP status: \(httpResponse.statusCode)")
                throw MCPError.connectionFailed("Server returned status \(httpResponse.statusCode)")
            }
        } catch {
            isConnected = false
            connectionStatus = "Failed"
            lastError = error.localizedDescription
            logger.error("❌ Failed to connect to MCP server: \(error.localizedDescription)")
            if let urlError = error as? URLError {
                logger.error("MCP URL Error details: \(urlError.localizedDescription) (Code: \(urlError.code.rawValue))")
            }
        }
    }

    func disconnect() {
        isConnected = false
        connectionStatus = "Disconnected"
        logger.info("Disconnected from MCP server")
    }

    // MARK: - Resource Management

    func listResources() async throws -> [MCPResource] {
        guard isConnected else {
            throw MCPError.notConnected
        }

        let resourcesURL = serverURL.appendingPathComponent("resources")
        let (data, response) = try await session.data(from: resourcesURL)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw MCPError.invalidResponse
        }

        struct MCPResourcesResponse: Codable {
            let success: Bool
            let data: MCPResourcesData
        }

        struct MCPResourcesData: Codable {
            let resources: [MCPResource]
        }

        let resourcesResponse = try JSONDecoder().decode(MCPResourcesResponse.self, from: data)
        return resourcesResponse.data.resources
    }

    func readResource(_ uri: String) async throws -> String {
        guard isConnected else {
            throw MCPError.notConnected
        }

        let encodedURI = uri.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? uri
        let resourceURL = serverURL.appendingPathComponent("resources").appendingPathComponent(encodedURI)
        let (data, response) = try await session.data(from: resourceURL)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw MCPError.resourceNotFound(uri)
        }

        struct MCPResourceContentResponse: Codable {
            let success: Bool
            let data: MCPResourceContent
        }

        struct MCPResourceContent: Codable {
            let content: String
        }

        let contentResponse = try JSONDecoder().decode(MCPResourceContentResponse.self, from: data)
        return contentResponse.data.content
    }

    // MARK: - Tool Management

    func listTools() async throws -> [MCPTool] {
        guard isConnected else {
            throw MCPError.notConnected
        }

        let toolsURL = serverURL.appendingPathComponent("tools")
        let (data, response) = try await session.data(from: toolsURL)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw MCPError.invalidResponse
        }

        struct MCPToolsResponse: Codable {
            let success: Bool
            let data: MCPToolsData
        }

        struct MCPToolsData: Codable {
            let tools: [MCPToolData]
        }

        struct MCPToolData: Codable {
            let name: String
            let description: String
            let schema: [String: Any]?

            enum CodingKeys: CodingKey {
                case name, description
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                name = try container.decode(String.self, forKey: .name)
                description = try container.decode(String.self, forKey: .description)
                schema = [:] // Simplified for now
            }
        }

        let toolsResponse = try JSONDecoder().decode(MCPToolsResponse.self, from: data)
        return toolsResponse.data.tools.map { toolData in
            MCPTool(name: toolData.name, description: toolData.description, schema: toolData.schema ?? [:])
        }
    }

    func callTool(_ name: String, arguments: [String: Any]) async throws -> String {
        guard isConnected else {
            throw MCPError.notConnected
        }

        logger.info("Calling tool: \(name) with arguments: \(arguments)")

        let callURL = serverURL.appendingPathComponent("tools/call")
        var request = URLRequest(url: callURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let requestBody = [
            "name": name,
            "arguments": arguments
        ] as [String: Any]

        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw MCPError.toolNotFound(name)
        }

        struct MCPToolCallResponse: Codable {
            let success: Bool
            let data: MCPToolCallResult
        }

        struct MCPToolCallResult: Codable {
            let result: String
        }

        let callResponse = try JSONDecoder().decode(MCPToolCallResponse.self, from: data)
        return callResponse.data.result
    }

    // MARK: - Prompt Management

    func listPrompts() async throws -> [MCPPrompt] {
        guard isConnected else {
            throw MCPError.notConnected
        }

        let promptsURL = serverURL.appendingPathComponent("prompts")
        let (data, response) = try await session.data(from: promptsURL)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw MCPError.invalidResponse
        }

        struct MCPPromptsResponse: Codable {
            let success: Bool
            let data: MCPPromptsData
        }

        struct MCPPromptsData: Codable {
            let prompts: [MCPPrompt]
        }

        let promptsResponse = try JSONDecoder().decode(MCPPromptsResponse.self, from: data)
        return promptsResponse.data.prompts
    }

    func getPrompt(_ name: String, arguments: [String: Any]) async throws -> String {
        guard isConnected else {
            throw MCPError.notConnected
        }

        logger.info("Getting prompt: \(name) with arguments: \(arguments)")

        let getPromptURL = serverURL.appendingPathComponent("prompts/get")
        var request = URLRequest(url: getPromptURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let requestBody = [
            "name": name,
            "arguments": arguments
        ] as [String: Any]

        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw MCPError.invalidResponse
        }

        struct MCPPromptResponse: Codable {
            let success: Bool
            let data: MCPPromptResult
        }

        struct MCPPromptResult: Codable {
            let prompt: String
        }

        let promptResponse = try JSONDecoder().decode(MCPPromptResponse.self, from: data)
        return promptResponse.data.prompt
    }

    // MARK: - Debug Methods (used by DebugConsoleView)

    func getCodePatterns(errorType: String, patternType: String?, limit: Int) async throws -> [String] {
        logger.debug("Getting code patterns for error type: \(errorType)")
        // Placeholder implementation for debug purposes
        return ["Sample pattern for \(errorType)", "Another pattern example"]
    }

    func getTaskHistory(limit: Int) async throws -> [String] {
        logger.debug("Getting task history with limit: \(limit)")
        // Placeholder implementation for debug purposes
        return ["Sample task 1", "Sample task 2", "Sample task 3"]
    }

    func saveContext(_ context: [String: Any]) async throws {
        logger.debug("Saving context: \(context.keys.joined(separator: ", "))")
        // Placeholder implementation for debug purposes
        // In a real implementation, this would save context to the MCP server
    }

    func searchContext(_ query: String) async throws -> [[String: Any]] {
        logger.debug("Searching context for: \(query)")
        // Placeholder implementation for debug purposes
        return [
            ["id": "1", "content": "Context result 1 for \(query)", "category": "search"],
            ["id": "2", "content": "Context result 2 for \(query)", "category": "search"]
        ]
    }

    func getRecentContext() async throws -> [[String: Any]] {
        logger.debug("Getting recent context")
        // Placeholder implementation for debug purposes
        return [
            ["id": "1", "content": "Recent context item 1", "category": "recent", "timestamp": Date().timeIntervalSince1970],
            ["id": "2", "content": "Recent context item 2", "category": "recent", "timestamp": Date().timeIntervalSince1970]
        ]
    }
}

// MARK: - Supporting Types

enum MCPError: LocalizedError {
    case notConnected
    case connectionFailed(String)
    case invalidResponse
    case toolNotFound(String)
    case resourceNotFound(String)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "MCP client is not connected"
        case .connectionFailed(let message):
            return "Connection failed: \(message)"
        case .invalidResponse:
            return "Invalid response from MCP server"
        case .toolNotFound(let name):
            return "Tool not found: \(name)"
        case .resourceNotFound(let uri):
            return "Resource not found: \(uri)"
        }
    }
}

struct MCPResource: Identifiable, Codable {
    let id: String
    let name: String
    let type: String
    let uri: String
}

struct MCPTool: Identifiable, Codable {
    var id: String { name }
    let name: String
    let description: String
    let schema: [String: Any]

    enum CodingKeys: CodingKey {
        case name, description
    }

    init(name: String, description: String, schema: [String: Any]) {
        self.name = name
        self.description = description
        self.schema = schema
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        description = try container.decode(String.self, forKey: .description)
        schema = [:]
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encode(description, forKey: .description)
    }
}

struct MCPPrompt: Identifiable, Codable {
    var id: String { name }
    let name: String
    let description: String
    let arguments: [String]
}
