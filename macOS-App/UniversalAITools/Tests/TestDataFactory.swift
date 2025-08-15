import Foundation
import SwiftUI
@testable import UniversalAITools

/// Factory for generating consistent test data across all test suites
class TestDataFactory {
    
    // MARK: - Chat & Messages
    
    static func createMockMessage(
        content: String = "Test message",
        role: Message.Role = .user,
        timestamp: Date = Date()
    ) -> Message {
        return Message(
            id: UUID(),
            content: content,
            role: role,
            timestamp: timestamp,
            metadata: [:]
        )
    }
    
    static func createMockChat(
        title: String = "Test Chat",
        messageCount: Int = 5
    ) -> Chat {
        var messages: [Message] = []
        for i in 0..<messageCount {
            let role: Message.Role = i % 2 == 0 ? .user : .assistant
            messages.append(createMockMessage(
                content: "Message \(i + 1)",
                role: role
            ))
        }
        
        return Chat(
            id: UUID(),
            title: title,
            messages: messages,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
    
    static func createBulkMessages(count: Int) -> [Message] {
        return (0..<count).map { i in
            createMockMessage(
                content: "Bulk message \(i)",
                role: i % 2 == 0 ? .user : .assistant
            )
        }
    }
    
    // MARK: - Agents
    
    static func createMockAgent(
        name: String = "Test Agent",
        type: AgentType = .chat,
        status: AgentStatus = .idle
    ) -> Agent {
        return Agent(
            name: name,
            type: type,
            status: status,
            description: "Mock agent for testing",
            capabilities: ["chat", "analysis", "research"],
            currentTask: status == .active ? "Processing test task" : nil,
            progress: status == .active ? 0.5 : 0.0
        )
    }
    
    static func createAgentTeam() -> [Agent] {
        return [
            createMockAgent(name: "Chat Agent", type: .chat, status: .idle),
            createMockAgent(name: "Research Agent", type: .research, status: .active),
            createMockAgent(name: "Code Agent", type: .coding, status: .busy),
            createMockAgent(name: "Analysis Agent", type: .analysis, status: .idle),
            createMockAgent(name: "Orchestrator", type: .orchestration, status: .active)
        ]
    }
    
    // MARK: - System Metrics
    
    static func createMockSystemMetrics(
        cpuUsage: Double = 45.0,
        memoryUsage: Double = 67.0
    ) -> SystemMetrics {
        return SystemMetrics(
            cpuUsage: cpuUsage,
            memoryUsage: memoryUsage,
            uptime: 3600.0,
            requestsPerMinute: Int.random(in: 50...200),
            activeConnections: Int.random(in: 1...20)
        )
    }
    
    static func createPerformanceHistory(points: Int = 20) -> [SystemMetrics] {
        return (0..<points).map { i in
            createMockSystemMetrics(
                cpuUsage: Double.random(in: 20...80),
                memoryUsage: Double.random(in: 40...90)
            )
        }
    }
    
    // MARK: - Graph Data
    
    static func createMockGraphNode(
        title: String = "Test Node",
        position: SIMD3<Float> = SIMD3<Float>(0, 0, 0)
    ) -> GraphNode {
        return GraphNode(
            id: UUID().uuidString,
            title: title,
            type: .concept,
            position: position,
            connections: [],
            metadata: [
                "description": "Test node for graph visualization",
                "weight": Double.random(in: 0.1...1.0)
            ]
        )
    }
    
    static func createGraphNetwork(nodeCount: Int = 10) -> ([GraphNode], [GraphConnection]) {
        var nodes: [GraphNode] = []
        var connections: [GraphConnection] = []
        
        // Create nodes
        for i in 0..<nodeCount {
            let position = SIMD3<Float>(
                Float.random(in: -100...100),
                Float.random(in: -100...100),
                Float.random(in: -100...100)
            )
            nodes.append(createMockGraphNode(
                title: "Node \(i + 1)",
                position: position
            ))
        }
        
        // Create connections (ensure graph is connected)
        for i in 1..<nodeCount {
            let fromIndex = Int.random(in: 0..<i)
            connections.append(GraphConnection(
                id: UUID().uuidString,
                fromNodeId: nodes[fromIndex].id,
                toNodeId: nodes[i].id,
                strength: Double.random(in: 0.3...1.0),
                type: ["related", "similar", "depends_on", "contains"].randomElement()!
            ))
        }
        
        // Add some extra connections for complexity
        for _ in 0..<nodeCount/2 {
            let fromIndex = Int.random(in: 0..<nodeCount)
            let toIndex = Int.random(in: 0..<nodeCount)
            if fromIndex != toIndex {
                connections.append(GraphConnection(
                    id: UUID().uuidString,
                    fromNodeId: nodes[fromIndex].id,
                    toNodeId: nodes[toIndex].id,
                    strength: Double.random(in: 0.1...0.5),
                    type: "weak_relation"
                ))
            }
        }
        
        return (nodes, connections)
    }
    
    // MARK: - Objectives & Tasks
    
    static func createMockObjective(
        title: String = "Test Objective",
        status: Objective.ObjectiveStatus = .pending
    ) -> Objective {
        return Objective(
            id: UUID(),
            title: title,
            description: "Mock objective for testing",
            status: status,
            priority: .medium,
            progress: status == .inProgress ? 0.5 : 0.0,
            agentIds: [],
            createdAt: Date(),
            updatedAt: Date()
        )
    }
    
    static func createTaskHistory(
        title: String = "Test Task",
        status: TaskStatus = .completed
    ) -> TaskHistory {
        let createdAt = Date().addingTimeInterval(-3600)
        let completedAt = status == .completed ? Date() : nil
        
        return TaskHistory(
            title: title,
            description: "Mock task for testing",
            agentType: .analysis,
            status: status,
            createdAt: createdAt,
            completedAt: completedAt,
            duration: completedAt != nil ? completedAt!.timeIntervalSince(createdAt) : nil
        )
    }
    
    // MARK: - Chart Data
    
    static func createChartDataPoints(count: Int = 10) -> [ChartDataPoint] {
        let labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return (0..<count).map { i in
            ChartDataPoint(
                label: labels[safe: i] ?? "Data \(i)",
                value: Double.random(in: 50...200),
                timestamp: Date().addingTimeInterval(Double(i) * 86400),
                category: ["Revenue", "Costs", "Profit"].randomElement()
            )
        }
    }
    
    // MARK: - RAG Settings
    
    static func createMockRAGSettings() -> RAGSettings {
        return RAGSettings(
            enabled: true,
            contextWindow: 4096,
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxTokens: 2048,
            similarityThreshold: 0.75,
            maxContext: 8192,
            includeGraphPaths: true,
            sessionId: UUID().uuidString,
            projectPath: "/test/project"
        )
    }
    
    // MARK: - User Personas
    
    enum UserPersona {
        case newUser
        case powerUser
        case developer
        case dataScientist
        case businessAnalyst
        
        var preferences: UserPreferences {
            switch self {
            case .newUser:
                return UserPreferences(
                    showTutorials: true,
                    simplifiedUI: true,
                    autoSaveEnabled: true,
                    theme: .light
                )
            case .powerUser:
                return UserPreferences(
                    showTutorials: false,
                    simplifiedUI: false,
                    autoSaveEnabled: true,
                    theme: .dark,
                    keyboardShortcutsEnabled: true
                )
            case .developer:
                return UserPreferences(
                    showTutorials: false,
                    simplifiedUI: false,
                    autoSaveEnabled: true,
                    theme: .dark,
                    showDebugInfo: true,
                    enabledFeatures: ["codeCompletion", "syntaxHighlighting"]
                )
            case .dataScientist:
                return UserPreferences(
                    showTutorials: false,
                    simplifiedUI: false,
                    autoSaveEnabled: true,
                    theme: .light,
                    enabledFeatures: ["dataVisualization", "statistics", "modeling"]
                )
            case .businessAnalyst:
                return UserPreferences(
                    showTutorials: true,
                    simplifiedUI: true,
                    autoSaveEnabled: true,
                    theme: .light,
                    enabledFeatures: ["reports", "dashboards"]
                )
            }
        }
    }
    
    // MARK: - Error Scenarios
    
    static func createMockError(type: ErrorType = .network) -> AppError {
        switch type {
        case .network:
            return AppError(
                code: "NETWORK_ERROR",
                message: "Failed to connect to server",
                details: "Connection timeout after 30 seconds",
                recoverable: true
            )
        case .authentication:
            return AppError(
                code: "AUTH_ERROR",
                message: "Authentication failed",
                details: "Invalid credentials or session expired",
                recoverable: true
            )
        case .validation:
            return AppError(
                code: "VALIDATION_ERROR",
                message: "Invalid input",
                details: "The provided data does not meet requirements",
                recoverable: true
            )
        case .system:
            return AppError(
                code: "SYSTEM_ERROR",
                message: "System error occurred",
                details: "An unexpected error occurred in the system",
                recoverable: false
            )
        }
    }
    
    enum ErrorType {
        case network, authentication, validation, system
    }
    
    // MARK: - Performance Test Data
    
    static func generateLargeDataset<T>(
        count: Int,
        generator: (Int) -> T
    ) -> [T] {
        return (0..<count).map(generator)
    }
    
    static func createStressTestMessages(count: Int = 10000) -> [Message] {
        return generateLargeDataset(count: count) { i in
            createMockMessage(
                content: String(repeating: "Lorem ipsum dolor sit amet. ", count: 10) + "Message \(i)",
                role: i % 2 == 0 ? .user : .assistant
            )
        }
    }
    
    static func createComplexGraphNetwork() -> ([GraphNode], [GraphConnection]) {
        // Create a complex network with 1000+ nodes
        return createGraphNetwork(nodeCount: 1000)
    }
}

// MARK: - Supporting Types

struct UserPreferences {
    let showTutorials: Bool
    let simplifiedUI: Bool
    let autoSaveEnabled: Bool
    let theme: Theme
    let keyboardShortcutsEnabled: Bool
    let showDebugInfo: Bool
    let enabledFeatures: [String]
    
    enum Theme {
        case light, dark, system
    }
    
    init(
        showTutorials: Bool = false,
        simplifiedUI: Bool = false,
        autoSaveEnabled: Bool = true,
        theme: Theme = .system,
        keyboardShortcutsEnabled: Bool = false,
        showDebugInfo: Bool = false,
        enabledFeatures: [String] = []
    ) {
        self.showTutorials = showTutorials
        self.simplifiedUI = simplifiedUI
        self.autoSaveEnabled = autoSaveEnabled
        self.theme = theme
        self.keyboardShortcutsEnabled = keyboardShortcutsEnabled
        self.showDebugInfo = showDebugInfo
        self.enabledFeatures = enabledFeatures
    }
}

struct AppError {
    let code: String
    let message: String
    let details: String?
    let recoverable: Bool
    let timestamp: Date = Date()
}

// MARK: - Array Extension

extension Array {
    subscript(safe index: Int) -> Element? {
        return index >= 0 && index < count ? self[index] : nil
    }
}