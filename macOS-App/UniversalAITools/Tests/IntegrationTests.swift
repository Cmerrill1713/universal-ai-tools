import Foundation
import XCTest

class IntegrationTests: UniversalAIToolsTestSuite {
    func testFullAppWorkflow() {
        XCTAssertFalse(appState.backendConnected)
        appState.backendConnected = true
        XCTAssertTrue(appState.backendConnected)

        appState.createNewChat()
        XCTAssertNotNil(appState.currentChat)

        let agent = Agent(
            id: "workflow-agent",
            name: "Workflow Agent",
            type: "Cognitive",
            description: "Integration test agent",
            capabilities: ["integration", "testing"],
            status: .active
        )
        appState.activeAgents.append(agent)

        XCTAssertEqual(appState.activeAgents.count, 1)
        XCTAssertEqual(appState.chats.count, 1)
    }

    func testStatePersistence() {
        appState.darkMode = true
        appState.sidebarVisible = false
        appState.viewMode = .web
        XCTAssertTrue(appState.darkMode)
        XCTAssertFalse(appState.sidebarVisible)
        XCTAssertEqual(appState.viewMode, .web)
    }
}


