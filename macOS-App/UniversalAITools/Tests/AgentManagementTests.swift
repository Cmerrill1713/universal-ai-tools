import XCTest

class AgentManagementTests: UniversalAIToolsTestSuite {
    func testAgentCreation() {
        let agent = Agent(
            id: "test-agent-1",
            name: "Test Agent",
            type: "Cognitive",
            description: "A test cognitive agent",
            capabilities: ["reasoning", "learning"],
            status: .active
        )
        appState.activeAgents.append(agent)
        XCTAssertEqual(appState.activeAgents.count, 1)
        XCTAssertEqual(appState.activeAgents.first?.name, "Test Agent")
        XCTAssertEqual(appState.activeAgents.first?.status, .active)
    }

    func testAgentStatusUpdates() {
        let agent = Agent(
            id: "test-agent-2",
            name: "Status Test Agent",
            type: "Memory",
            description: "Testing status updates",
            capabilities: ["memory", "retrieval"],
            status: .inactive
        )
        appState.activeAgents.append(agent)
        if let index = appState.activeAgents.firstIndex(where: { $0.id == "test-agent-2" }) {
            appState.activeAgents[index].status = .busy
            XCTAssertEqual(appState.activeAgents[index].status, .busy)
        }
    }

    func testAgentFiltering() {
        let agents = [
            Agent(id: "1", name: "Agent 1", type: "Cognitive", description: "", capabilities: [], status: .active),
            Agent(id: "2", name: "Agent 2", type: "Memory", description: "", capabilities: [], status: .busy),
            Agent(id: "3", name: "Agent 3", type: "Cognitive", description: "", capabilities: [], status: .active)
        ]
        appState.activeAgents = agents
        let cognitiveAgents = appState.activeAgents.filter { $0.type == "Cognitive" }
        XCTAssertEqual(cognitiveAgents.count, 2)
        let busyAgents = appState.activeAgents.filter { $0.status == .busy }
        XCTAssertEqual(busyAgents.count, 1)
    }
}



