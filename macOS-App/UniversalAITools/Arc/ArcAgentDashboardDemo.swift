import SwiftUI

// MARK: - Arc Agent Dashboard Demo
/// A demo view to showcase the Arc Agent Dashboard
struct ArcAgentDashboardDemo: View {
    @StateObject private var mockAppState = MockAppState()
    
    var body: some View {
        NavigationView {
            ArcAgentDashboard()
                .environmentObject(mockAppState)
        }
        .frame(width: 1200, height: 800)
        .onAppear {
            setupMockData()
        }
    }
    
    private func setupMockData() {
        // Create sample agents for demo purposes
        let sampleAgents = [
            Agent(
                name: "Data Processor",
                type: .analysis,
                status: .active,
                description: "Processes large datasets and generates insights",
                capabilities: ["Data Analysis", "Statistics", "Visualization", "ETL"],
                currentTask: "Processing user behavior data",
                progress: 0.75,
                startTime: Date().addingTimeInterval(-3600)
            ),
            Agent(
                name: "Code Assistant",
                type: .coding,
                status: .active,
                description: "Helps with code generation and debugging",
                capabilities: ["Code Generation", "Debugging", "Testing", "Refactoring"],
                currentTask: "Generating unit tests",
                progress: 0.45
            ),
            Agent(
                name: "Research Bot",
                type: .research,
                status: .idle,
                description: "Conducts research and summarizes findings",
                capabilities: ["Web Search", "Summarization", "Fact Checking", "Citations"]
            ),
            Agent(
                name: "Chat Support",
                type: .chat,
                status: .busy,
                description: "Provides customer support and assistance",
                capabilities: ["Natural Language", "FAQ", "Escalation", "Sentiment Analysis"],
                currentTask: "Handling customer inquiries",
                progress: 0.90,
                startTime: Date().addingTimeInterval(-1800)
            ),
            Agent(
                name: "System Monitor",
                type: .monitoring,
                status: .active,
                description: "Monitors system health and performance",
                capabilities: ["Metrics Collection", "Alerting", "Logging", "Diagnostics"],
                currentTask: "Monitoring server health",
                progress: 1.0,
                startTime: Date().addingTimeInterval(-7200)
            ),
            Agent(
                name: "Workflow Orchestrator",
                type: .orchestration,
                status: .error,
                description: "Coordinates complex multi-agent workflows",
                capabilities: ["Task Scheduling", "Resource Management", "Load Balancing"],
                currentTask: "Recovering from error state"
            )
        ]
        
        mockAppState.availableAgents = sampleAgents
    }
}

// MARK: - Mock AppState for Demo
class MockAppState: ObservableObject {
    @Published var availableAgents: [Agent] = []
    @Published var activeAgents: [Agent] = []
    @Published var isConnectedToBackend: Bool = true
    @Published var connectionStatus: ConnectionStatus = .connected
    
    let apiService = MockAPIService()
    
    func activateAgent(_ agent: Agent) {
        if !activeAgents.contains(where: { $0.id == agent.id }) {
            activeAgents.append(agent)
        }
    }
    
    func removeActiveAgent(_ agent: Agent) {
        activeAgents.removeAll { $0.id == agent.id }
    }
}

// MARK: - Mock API Service for Demo
class MockAPIService {
    func activateAgent(id: String) async throws {
        // Simulate API call delay
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
    }
    
    func deactivateAgent(id: String) async throws {
        // Simulate API call delay
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
    }
}

// MARK: - Mock Connection Status
enum ConnectionStatus {
    case connected
    case disconnected
    case connecting
}

// MARK: - Preview
#if DEBUG
struct ArcAgentDashboardDemo_Previews: PreviewProvider {
    static var previews: some View {
        ArcAgentDashboardDemo()
    }
}
#endif