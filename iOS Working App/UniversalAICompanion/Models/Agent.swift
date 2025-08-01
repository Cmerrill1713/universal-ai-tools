import Foundation

struct Agent: Identifiable, Codable {
    let id = UUID()
    let name: String
    let description: String
    let category: String
    let priority: Int
    let capabilities: [String]
    let memoryEnabled: Bool
    let maxLatencyMs: Int
    let loaded: Bool
    
    enum CodingKeys: String, CodingKey {
        case name, description, category, priority, capabilities, memoryEnabled, maxLatencyMs, loaded
    }
    
    // Predefined agents for offline use
    static let predefinedAgents = [
        Agent(
            name: "enhanced-planner-agent",
            description: "Strategic planning with JSON-structured responses",
            category: "cognitive",
            priority: 1,
            capabilities: ["planning", "strategy", "analysis"],
            memoryEnabled: true,
            maxLatencyMs: 3000,
            loaded: true
        ),
        Agent(
            name: "enhanced-retriever-agent",
            description: "Information research and context gathering",
            category: "cognitive",
            priority: 2,
            capabilities: ["research", "information_gathering", "context"],
            memoryEnabled: true,
            maxLatencyMs: 2000,
            loaded: true
        ),
        Agent(
            name: "enhanced-synthesizer-agent",
            description: "Information synthesis and consensus building",
            category: "cognitive",
            priority: 3,
            capabilities: ["synthesis", "analysis", "consensus"],
            memoryEnabled: true,
            maxLatencyMs: 2500,
            loaded: true
        ),
        Agent(
            name: "enhanced-personal-assistant-agent",
            description: "Personal AI with conversational capabilities",
            category: "personal",
            priority: 4,
            capabilities: ["conversation", "assistance", "personal"],
            memoryEnabled: true,
            maxLatencyMs: 1500,
            loaded: true
        ),
        Agent(
            name: "enhanced-code-assistant-agent",
            description: "Code generation, review, and development",
            category: "specialized",
            priority: 5,
            capabilities: ["code_generation", "code_review", "development"],
            memoryEnabled: true,
            maxLatencyMs: 4000,
            loaded: true
        )
    ]
    
    var displayName: String {
        return name.replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "enhanced ", with: "")
            .capitalized
    }
    
    var categoryIcon: String {
        switch category {
        case "cognitive":
            return "brain.head.profile"
        case "personal":
            return "person.circle"
        case "specialized":
            return "gear"
        default:
            return "questionmark.circle"
        }
    }
    
    var capabilityText: String {
        return capabilities.joined(separator: ", ")
    }
}