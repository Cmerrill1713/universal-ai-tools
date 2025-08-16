import Foundation
import SwiftUI
import Combine
import OSLog

// MARK: - Agent Conversation Context
struct AgentConversationContext {
    var sessionId: String
    var agentType: String
    var capabilities: [String]
    var preferences: [String: Any]
    var conversationHistory: [Message]
    var metadata: [String: String]
    
    init(
        sessionId: String,
        agentType: String,
        capabilities: [String] = [],
        preferences: [String: Any] = [:],
        metadata: [String: String] = [:]
    ) {
        self.sessionId = sessionId
        self.agentType = agentType
        self.capabilities = capabilities
        self.preferences = preferences
        self.conversationHistory = []
        self.metadata = metadata
    }
}

// MARK: - Agent Capabilities
enum AgentCapability: String, CaseIterable {
    case textProcessing = "text_processing"
    case codeGeneration = "code_generation"
    case researchAnalysis = "research_analysis"
    case dataVisualization = "data_visualization"
    case voiceInteraction = "voice_interaction"
    case webBrowsing = "web_browsing"
    case fileProcessing = "file_processing"
    case imageAnalysis = "image_analysis"
    case realTimeData = "real_time_data"
    case workflowAutomation = "workflow_automation"
    
    var displayName: String {
        switch self {
        case .textProcessing: return "Text Processing"
        case .codeGeneration: return "Code Generation"
        case .researchAnalysis: return "Research & Analysis"
        case .dataVisualization: return "Data Visualization"
        case .voiceInteraction: return "Voice Interaction"
        case .webBrowsing: return "Web Browsing"
        case .fileProcessing: return "File Processing"
        case .imageAnalysis: return "Image Analysis"
        case .realTimeData: return "Real-time Data"
        case .workflowAutomation: return "Workflow Automation"
        }
    }
}

// MARK: - Specialized Agent Definitions
struct UniversalAIAgent {
    let id: String
    let name: String
    let type: AgentType
    let endpoint: String
    let capabilities: [AgentCapability]
    let description: String
    let isVoiceEnabled: Bool
    let maxContextLength: Int
    
    static let availableAgents: [UniversalAIAgent] = [
        // Core Agents
        UniversalAIAgent(
            id: "planner",
            name: "Strategic Planner",
            type: .orchestration,
            endpoint: "/api/v1/agents/planner",
            capabilities: [.textProcessing, .workflowAutomation],
            description: "High-level planning and strategic thinking",
            isVoiceEnabled: true,
            maxContextLength: 8000
        ),
        UniversalAIAgent(
            id: "synthesizer",
            name: "Knowledge Synthesizer",
            type: .research,
            endpoint: "/api/v1/agents/synthesizer",
            capabilities: [.textProcessing, .researchAnalysis, .dataVisualization],
            description: "Synthesizes information from multiple sources",
            isVoiceEnabled: true,
            maxContextLength: 12000
        ),
        UniversalAIAgent(
            id: "retriever",
            name: "Information Retriever",
            type: .research,
            endpoint: "/api/v1/agents/retriever",
            capabilities: [.textProcessing, .webBrowsing, .realTimeData],
            description: "Retrieves and organizes information",
            isVoiceEnabled: false,
            maxContextLength: 6000
        ),
        UniversalAIAgent(
            id: "code_assistant",
            name: "Code Assistant",
            type: .coding,
            endpoint: "/api/v1/agents/code_assistant",
            capabilities: [.codeGeneration, .textProcessing, .fileProcessing],
            description: "Programming and development assistance",
            isVoiceEnabled: true,
            maxContextLength: 16000
        ),
        UniversalAIAgent(
            id: "graphrag_reasoning",
            name: "GraphRAG Reasoner",
            type: .analysis,
            endpoint: "/api/v1/agents/graphrag_reasoning",
            capabilities: [.researchAnalysis, .dataVisualization, .textProcessing],
            description: "Advanced reasoning using knowledge graphs",
            isVoiceEnabled: false,
            maxContextLength: 20000
        ),
        UniversalAIAgent(
            id: "workflow_orchestrator",
            name: "Workflow Orchestrator",
            type: .orchestration,
            endpoint: "/api/v1/agents/workflow_orchestrator",
            capabilities: [.workflowAutomation, .textProcessing],
            description: "Orchestrates complex multi-step workflows",
            isVoiceEnabled: true,
            maxContextLength: 10000
        ),
        UniversalAIAgent(
            id: "memory_layer",
            name: "Memory Layer",
            type: .analysis,
            endpoint: "/api/v1/agents/memory_layer",
            capabilities: [.textProcessing, .realTimeData],
            description: "Manages conversation memory and context",
            isVoiceEnabled: false,
            maxContextLength: 24000
        ),
        UniversalAIAgent(
            id: "web_search",
            name: "Web Search Agent",
            type: .research,
            endpoint: "/api/v1/agents/web_search",
            capabilities: [.webBrowsing, .textProcessing, .realTimeData],
            description: "Advanced web search and information gathering",
            isVoiceEnabled: false,
            maxContextLength: 8000
        ),
        UniversalAIAgent(
            id: "vision_processor",
            name: "Vision Processor",
            type: .analysis,
            endpoint: "/api/v1/agents/vision_processor",
            capabilities: [.imageAnalysis, .textProcessing],
            description: "Processes and analyzes visual content",
            isVoiceEnabled: true,
            maxContextLength: 6000
        ),
        UniversalAIAgent(
            id: "data_analyst",
            name: "Data Analyst",
            type: .analysis,
            endpoint: "/api/v1/agents/data_analyst",
            capabilities: [.dataVisualization, .textProcessing, .fileProcessing],
            description: "Analyzes and visualizes data",
            isVoiceEnabled: true,
            maxContextLength: 12000
        ),
        UniversalAIAgent(
            id: "task_executor",
            name: "Task Executor",
            type: .orchestration,
            endpoint: "/api/v1/agents/task_executor",
            capabilities: [.workflowAutomation, .textProcessing],
            description: "Executes specific tasks and operations",
            isVoiceEnabled: false,
            maxContextLength: 8000
        ),
        UniversalAIAgent(
            id: "context_manager",
            name: "Context Manager",
            type: .orchestration,
            endpoint: "/api/v1/agents/context_manager",
            capabilities: [.textProcessing, .realTimeData],
            description: "Manages conversation context and flow",
            isVoiceEnabled: false,
            maxContextLength: 16000
        ),
        UniversalAIAgent(
            id: "router",
            name: "Agent Router",
            type: .orchestration,
            endpoint: "/api/v1/agents/router",
            capabilities: [.textProcessing, .workflowAutomation],
            description: "Routes requests to appropriate agents",
            isVoiceEnabled: false,
            maxContextLength: 4000
        ),
        UniversalAIAgent(
            id: "summarizer",
            name: "Content Summarizer",
            type: .analysis,
            endpoint: "/api/v1/agents/summarizer",
            capabilities: [.textProcessing],
            description: "Summarizes and condenses content",
            isVoiceEnabled: true,
            maxContextLength: 16000
        ),
        UniversalAIAgent(
            id: "chat",
            name: "General Chat Agent",
            type: .chat,
            endpoint: "/api/v1/chat",
            capabilities: [.textProcessing, .voiceInteraction],
            description: "General purpose conversational agent",
            isVoiceEnabled: true,
            maxContextLength: 8000
        ),
        UniversalAIAgent(
            id: "mcp_bridge",
            name: "MCP Bridge",
            type: .orchestration,
            endpoint: "/api/v1/agents/mcp_bridge",
            capabilities: [.textProcessing, .workflowAutomation, .fileProcessing],
            description: "Bridges to Model Context Protocol services",
            isVoiceEnabled: false,
            maxContextLength: 8000
        )
    ]
}

// MARK: - Agent Conversation Service
@MainActor
public class AgentConversationService: ObservableObject {
    @Published var activeAgents: [String: UniversalAIAgent] = [:]
    @Published var agentContexts: [String: AgentConversationContext] = [:]
    @Published var currentAgent: UniversalAIAgent?
    @Published var availableAgents: [UniversalAIAgent] = UniversalAIAgent.availableAgents
    @Published var agentPerformanceMetrics: [String: AgentPerformanceMetrics] = [:]
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "agent-conversation")
    private let apiService: APIService
    private let loggingService: LoggingService
    private let monitoringService: MonitoringService
    
    private var cancellables = Set<AnyCancellable>()
    
    // Connection pooling and caching
    private let urlSession: URLSession
    private var responseCache: [String: (response: String, timestamp: Date)] = [:]
    private let cacheQueue = DispatchQueue(label: "agent-cache", qos: .utility)
    
    public init(
        apiService: APIService,
        loggingService: LoggingService,
        monitoringService: MonitoringService
    ) {
        self.apiService = apiService
        self.loggingService = loggingService
        self.monitoringService = monitoringService
        
        // Configure URL session for connection pooling
        let config = URLSessionConfiguration.default
        config.httpMaximumConnectionsPerHost = 4
        config.timeoutIntervalForRequest = 30
        config.requestCachePolicy = .useProtocolCachePolicy
        self.urlSession = URLSession(configuration: config)
        
        setupAgentService()
    }
    
    // MARK: - Setup
    private func setupAgentService() {
        logger.info("Setting up AgentConversationService with \(self.availableAgents.count) agents")
        
        // Initialize performance metrics for all agents
        for agent in availableAgents {
            agentPerformanceMetrics[agent.id] = AgentPerformanceMetrics()
        }
    }
    
    // MARK: - Agent Selection and Routing
    func selectOptimalAgent(for query: String, context: AgentConversationContext? = nil) async -> UniversalAIAgent {
        logger.info("Selecting optimal agent for query: \(String(query.prefix(50)))...")
        
        // Use router agent to determine best agent for query
        if let routerAgent = availableAgents.first(where: { $0.id == "router" }) {
            do {
                let routingResponse = try await sendToAgent(
                    routerAgent,
                    input: query,
                    context: context ?? AgentConversationContext(sessionId: UUID().uuidString, agentType: "router")
                )
                
                // Parse routing response to determine agent
                if let selectedAgentId = parseAgentSelection(from: routingResponse),
                   let selectedAgent = availableAgents.first(where: { $0.id == selectedAgentId }) {
                    logger.info("Router selected agent: \(selectedAgent.name)")
                    return selectedAgent
                }
            } catch {
                logger.error("Router agent failed: \(error)")
            }
        }
        
        // Fallback to heuristic-based selection
        return selectAgentByHeuristics(query: query)
    }
    
    private func selectAgentByHeuristics(query: String) -> UniversalAIAgent {
        let lowercaseQuery = query.lowercased()
        
        // Code-related queries
        if lowercaseQuery.contains("code") || lowercaseQuery.contains("programming") || 
           lowercaseQuery.contains("function") || lowercaseQuery.contains("debug") {
            return availableAgents.first(where: { $0.id == "code_assistant" }) ?? defaultAgent
        }
        
        // Research queries
        if lowercaseQuery.contains("research") || lowercaseQuery.contains("analyze") || 
           lowercaseQuery.contains("find") || lowercaseQuery.contains("search") {
            return availableAgents.first(where: { $0.id == "synthesizer" }) ?? defaultAgent
        }
        
        // Planning queries
        if lowercaseQuery.contains("plan") || lowercaseQuery.contains("strategy") || 
           lowercaseQuery.contains("organize") || lowercaseQuery.contains("workflow") {
            return availableAgents.first(where: { $0.id == "planner" }) ?? defaultAgent
        }
        
        // Data analysis
        if lowercaseQuery.contains("data") || lowercaseQuery.contains("chart") || 
           lowercaseQuery.contains("graph") || lowercaseQuery.contains("visualize") {
            return availableAgents.first(where: { $0.id == "data_analyst" }) ?? defaultAgent
        }
        
        // Default to chat agent for general queries
        return defaultAgent
    }
    
    private var defaultAgent: UniversalAIAgent {
        return availableAgents.first(where: { $0.id == "chat" }) ?? availableAgents.first!
    }
    
    private func parseAgentSelection(from response: String) -> String? {
        // Parse router response to extract selected agent ID
        // This would parse JSON or structured response from router agent
        let patterns = [
            "\"agent_id\":\\s*\"([^\"]+)\"",
            "agent:\\s*([a-zA-Z_]+)",
            "selected_agent:\\s*([a-zA-Z_]+)"
        ]
        
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: response, range: NSRange(response.startIndex..., in: response)),
               let range = Range(match.range(at: 1), in: response) {
                return String(response[range])
            }
        }
        
        return nil
    }
    
    // MARK: - Agent Communication
    func sendToAgent(
        _ agent: UniversalAIAgent,
        input: String,
        context: AgentConversationContext
    ) async throws -> String {
        logger.info("Sending message to agent: \(agent.name)")
        
        let startTime = Date()
        
        // Track agent usage
        activeAgents[agent.id] = agent
        updateAgentContext(agent.id, context: context)
        
        do {
            let response = try await performAgentRequest(agent, input: input, context: context)
            
            // Update performance metrics
            let duration = Date().timeIntervalSince(startTime)
            updateAgentMetrics(agent.id, duration: duration, success: true)
            
            // Log successful interaction
            await loggingService.logEvent(
                category: "agent_conversation",
                action: "agent_response_success",
                metadata: [
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "response_time": "\(duration)",
                    "session_id": context.sessionId
                ]
            )
            
            return response
            
        } catch {
            // Update performance metrics for failure
            let duration = Date().timeIntervalSince(startTime)
            updateAgentMetrics(agent.id, duration: duration, success: false)
            
            // Log failed interaction
            await loggingService.logEvent(
                category: "agent_conversation",
                action: "agent_response_error",
                metadata: [
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "error": error.localizedDescription,
                    "session_id": context.sessionId
                ]
            )
            
            throw error
        }
    }
    
    private func performAgentRequest(
        _ agent: UniversalAIAgent,
        input: String,
        context: AgentConversationContext
    ) async throws -> String {
        let url = URL(string: "http://localhost:9999\(agent.endpoint)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Prepare payload based on agent type
        var payload: [String: Any] = [
            "message": input,
            "session_id": context.sessionId,
            "agent_type": agent.type.rawValue
        ]
        
        // Add context if available
        if !context.conversationHistory.isEmpty {
            payload["history"] = context.conversationHistory.map { message in
                [
                    "role": message.role.rawValue,
                    "content": message.content,
                    "timestamp": ISO8601DateFormatter().string(from: message.timestamp)
                ]
            }
        }
        
        // Add agent-specific metadata
        if !context.metadata.isEmpty {
            payload["metadata"] = context.metadata
        }
        
        // Add preferences
        if !context.preferences.isEmpty {
            payload["preferences"] = context.preferences
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        // Check cache first for non-critical requests
        let cacheKey = "\(agent.id):\(input.hash)"
        if let cached = responseCache[cacheKey], 
           Date().timeIntervalSince(cached.timestamp) < 300 { // 5 minute cache
            return cached.response
        }
        
        let (data, response) = try await urlSession.data(for: request)
        
        // Check response status
        if let httpResponse = response as? HTTPURLResponse,
           httpResponse.statusCode != 200 {
            throw AgentConversationError.httpError(httpResponse.statusCode)
        }
        
        // Parse response
        guard let responseObject = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let responseText = responseObject["response"] as? String else {
            throw AgentConversationError.invalidResponse
        }
        
        // Cache successful responses
        Task { @MainActor in
            self.responseCache[cacheKey] = (response: responseText, timestamp: Date())
            
            // Clean old cache entries (keep last 100)
            if self.responseCache.count > 100 {
                let sortedKeys = self.responseCache.keys.sorted { 
                    self.responseCache[$0]!.timestamp > self.responseCache[$1]!.timestamp 
                }
                for key in sortedKeys.dropFirst(100) {
                    self.responseCache.removeValue(forKey: key)
                }
            }
        }
        
        return responseText
    }
    
    // MARK: - Context Management
    func updateAgentContext(_ agentId: String, context: AgentConversationContext) {
        agentContexts[agentId] = context
    }
    
    func getAgentContext(_ agentId: String) -> AgentConversationContext? {
        return agentContexts[agentId]
    }
    
    func addToConversationHistory(_ agentId: String, message: Message) {
        agentContexts[agentId]?.conversationHistory.append(message)
        
        // Trim history if it exceeds agent's context length
        if let agent = availableAgents.first(where: { $0.id == agentId }),
           let context = agentContexts[agentId],
           context.conversationHistory.count > agent.maxContextLength / 100 { // Rough estimate
            agentContexts[agentId]?.conversationHistory.removeFirst()
        }
    }
    
    // MARK: - Agent Orchestration
    func orchestrateMultiAgentWorkflow(
        query: String,
        requiredCapabilities: [AgentCapability],
        sessionId: String
    ) async throws -> String {
        logger.info("Orchestrating multi-agent workflow for capabilities: \(requiredCapabilities)")
        
        // Select agents based on required capabilities
        let selectedAgents = availableAgents.filter { agent in
            requiredCapabilities.allSatisfy { capability in
                agent.capabilities.contains(capability)
            }
        }
        
        guard !selectedAgents.isEmpty else {
            throw AgentConversationError.noCapableAgent
        }
        
        // Use workflow orchestrator to coordinate
        if let orchestrator = availableAgents.first(where: { $0.id == "workflow_orchestrator" }) {
            let context = AgentConversationContext(sessionId: sessionId, agentType: "workflow_orchestrator")
            
            return try await sendToAgent(
                orchestrator,
                input: query,
                context: context
            )
        }
        
        // Fallback to sequential execution
        var results: [String] = []
        
        for agent in selectedAgents.prefix(3) { // Limit to 3 agents to avoid excessive processing
            let context = AgentConversationContext(sessionId: sessionId, agentType: agent.id)
            let result = try await sendToAgent(agent, input: query, context: context)
            results.append("[\(agent.name)]: \(result)")
        }
        
        return results.joined(separator: "\n\n")
    }
    
    // MARK: - Performance Tracking
    private func updateAgentMetrics(_ agentId: String, duration: TimeInterval, success: Bool) {
        guard var metrics = agentPerformanceMetrics[agentId] else { return }
        
        metrics.totalRequests += 1
        metrics.totalResponseTime += duration
        
        if success {
            metrics.successfulRequests += 1
        } else {
            metrics.failedRequests += 1
        }
        
        metrics.averageResponseTime = metrics.totalResponseTime / Double(metrics.totalRequests)
        metrics.successRate = Double(metrics.successfulRequests) / Double(metrics.totalRequests)
        
        agentPerformanceMetrics[agentId] = metrics
        
        // Update monitoring service
        Task {
            await monitoringService.updateMetric(
                name: "agent_\(agentId)_response_time",
                value: duration
            )
            await monitoringService.updateMetric(
                name: "agent_\(agentId)_success_rate",
                value: metrics.successRate
            )
        }
    }
    
    // MARK: - Agent Discovery
    func getAgentsByCapability(_ capability: AgentCapability) -> [UniversalAIAgent] {
        return availableAgents.filter { $0.capabilities.contains(capability) }
    }
    
    func getVoiceEnabledAgents() -> [UniversalAIAgent] {
        return availableAgents.filter { $0.isVoiceEnabled }
    }
    
    func getAgentById(_ id: String) -> UniversalAIAgent? {
        return availableAgents.first(where: { $0.id == id })
    }
    
    // MARK: - Agent Health Monitoring
    func checkAgentHealth(_ agentId: String) async -> Bool {
        guard let agent = getAgentById(agentId) else { return false }
        
        do {
            let healthContext = AgentConversationContext(sessionId: "health_check", agentType: agent.id)
            _ = try await sendToAgent(agent, input: "health_check", context: healthContext)
            return true
        } catch {
            logger.error("Agent \(agentId) health check failed: \(error)")
            return false
        }
    }
    
    func getAgentStatus() -> [String: String] {
        var status: [String: String] = [:]
        
        for agent in availableAgents {
            if let metrics = agentPerformanceMetrics[agent.id] {
                if metrics.successRate > 0.9 {
                    status[agent.id] = "healthy"
                } else if metrics.successRate > 0.7 {
                    status[agent.id] = "degraded"
                } else {
                    status[agent.id] = "unhealthy"
                }
            } else {
                status[agent.id] = "unknown"
            }
        }
        
        return status
    }
}

// MARK: - Performance Metrics
struct AgentPerformanceMetrics {
    var totalRequests: Int = 0
    var successfulRequests: Int = 0
    var failedRequests: Int = 0
    var totalResponseTime: TimeInterval = 0.0
    var averageResponseTime: TimeInterval = 0.0
    var successRate: Double = 0.0
    var lastUsed: Date = Date()
}

// MARK: - Errors
enum AgentConversationError: LocalizedError {
    case noCapableAgent
    case invalidResponse
    case httpError(Int)
    case agentNotFound(String)
    case contextTooLarge
    
    var errorDescription: String? {
        switch self {
        case .noCapableAgent:
            return "No agent available with required capabilities"
        case .invalidResponse:
            return "Invalid response from agent"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .agentNotFound(let id):
            return "Agent not found: \(id)"
        case .contextTooLarge:
            return "Context exceeds agent's maximum capacity"
        }
    }
}