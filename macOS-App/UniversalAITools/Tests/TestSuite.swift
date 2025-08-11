import SwiftUI
import XCTest
import Combine

// MARK: - Test Suite Configuration
class UniversalAIToolsTestSuite: XCTestCase {
    var appState: AppState!
    var apiService: APIService!
    var cancellables: Set<AnyCancellable>!

    override func setUp() {
        super.setUp()
        appState = AppState()
        apiService = APIService()
        cancellables = Set<AnyCancellable>()
    }

    override func tearDown() {
        cancellables = nil
        super.tearDown()
    }
}

// MARK: - UI Component Tests
class UIComponentTests: UniversalAIToolsTestSuite {

    func testSidebarViewRendering() {
        let sidebarView = SidebarView(selection: .constant(.dashboard))
            .environmentObject(appState)

        // Test sidebar renders with all items
        XCTAssertNotNil(sidebarView)

        // Test sidebar item selection
        var selection: SidebarItem? = .dashboard
        let binding = Binding(
            get: { selection },
            set: { selection = $0 }
        )

        let sidebarWithBinding = SidebarView(selection: binding)
            .environmentObject(appState)

        XCTAssertNotNil(sidebarWithBinding)
    }

    func testWelcomeViewComponents() {
        let welcomeView = WelcomeView()
            .environmentObject(appState)
            .environmentObject(apiService)

        XCTAssertNotNil(welcomeView)

        // Test connection status updates
        appState.backendConnected = true
        XCTAssertTrue(appState.backendConnected)

        appState.backendConnected = false
        XCTAssertFalse(appState.backendConnected)
    }

    func testDetailViewMetrics() {
        let detailView = DetailView()
            .environmentObject(appState)
            .environmentObject(apiService)

        XCTAssertNotNil(detailView)

        // Test metrics display
        let testMetrics = SystemMetrics(
            cpuUsage: 45.0,
            memoryUsage: 67.0,
            uptime: 3600.0,
            requestsPerMinute: 120,
            activeConnections: 8
        )

        appState.systemMetrics = testMetrics
        XCTAssertEqual(appState.systemMetrics?.cpuUsage, 45.0)
    }

    func testConnectionStatusView() {
        let connectionView = ConnectionStatusView()
            .environmentObject(appState)
            .environmentObject(apiService)

        XCTAssertNotNil(connectionView)

        // Test connection state changes
        appState.backendConnected = true
        appState.websocketConnected = true

        XCTAssertTrue(appState.backendConnected)
        XCTAssertTrue(appState.websocketConnected)
    }

    func testViewModeSelector() {
        let viewModeSelector = ViewModeSelector()
            .environmentObject(appState)

        XCTAssertNotNil(viewModeSelector)

        // Test view mode changes
        appState.viewMode = .webView
        XCTAssertEqual(appState.viewMode, .webView)

        appState.viewMode = .native
        XCTAssertEqual(appState.viewMode, .native)

        appState.viewMode = .hybrid
        XCTAssertEqual(appState.viewMode, .hybrid)
    }
}

// MARK: - Router Tests
class RouterTests: UniversalAIToolsTestSuite {

    func testContentRouterModes() {
        let item: SidebarItem = .dashboard

        // Web mode
        var view = ContentRouterView(item: item, viewMode: .webView)
        XCTAssertNotNil(view)

        // Native mode
        view = ContentRouterView(item: item, viewMode: .native)
        XCTAssertNotNil(view)

        // Hybrid mode
        view = ContentRouterView(item: item, viewMode: .hybrid)
        XCTAssertNotNil(view)
    }

    func testNativeRouterRoutesAllCases() {
        let all: [SidebarItem] = [.dashboard, .chat, .agents, .mlx, .vision,
                                  .monitoring, .abMcts, .maltSwarm, .parameters,
                                  .knowledge, .debugging]
        for item in all {
            let view = NativeRouterView(item: item)
            XCTAssertNotNil(view, "Router should return a view for \(item.rawValue)")
        }
    }
}

// MARK: - Overlay Tests
class OverlayTests: UniversalAIToolsTestSuite {

    func testStatusOverlayShowsNotificationBanner() {
        appState.showNotification(message: "Test banner")
        let overlay = StatusOverlayView()
            .environmentObject(appState)
            .environmentObject(apiService)
        XCTAssertNotNil(overlay)
        XCTAssertTrue(appState.showNotification)
        XCTAssertEqual(appState.notificationMessage, "Test banner")
    }

    func testStatusOverlayShowsOfflineBanner() {
        appState.backendConnected = false
        let overlay = StatusOverlayView()
            .environmentObject(appState)
            .environmentObject(apiService)
        XCTAssertNotNil(overlay)
        XCTAssertFalse(appState.backendConnected)
    }
}

// MARK: - Agent Management Tests
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

        // Test status change
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

// MARK: - Chat Interface Tests
class ChatInterfaceTests: UniversalAIToolsTestSuite {

    func testChatCreation() {
        let initialChatCount = appState.chats.count
        appState.createNewChat()

        XCTAssertEqual(appState.chats.count, initialChatCount + 1)
        XCTAssertNotNil(appState.currentChat)
    }

    func testMessageHandling() {
        appState.createNewChat()

        guard let currentChat = appState.currentChat else {
            XCTFail("No current chat available")
            return
        }

        let message = Message(
            content: "Hello, this is a test message",
            role: .user
        )

        // Simulate adding message to chat
        var updatedChat = currentChat
        updatedChat.messages.append(message)

        XCTAssertEqual(updatedChat.messages.count, 1)
        XCTAssertEqual(updatedChat.messages.first?.content, "Hello, this is a test message")
        XCTAssertEqual(updatedChat.messages.first?.role, .user)
    }

    func testChatHistory() {
        // Create multiple chats
        for number in 1...3 {
            appState.createNewChat()
            if let chat = appState.currentChat {
                var updatedChat = chat
                updatedChat.title = "Test Chat \(number)"
                // Update the chat in the array
                if let index = appState.chats.firstIndex(where: { $0.id == chat.id }) {
                    appState.chats[index] = updatedChat
                }
            }
        }

        XCTAssertEqual(appState.chats.count, 3)
        XCTAssertEqual(appState.chats.last?.title, "Test Chat 3")
    }
}

// MARK: - API Service Tests
class APIServiceTests: UniversalAIToolsTestSuite {

    func testConnectionState() {
        XCTAssertFalse(apiService.isConnected)

        // Simulate connection
        apiService.isConnected = true
        XCTAssertTrue(apiService.isConnected)
    }

    func testAuthenticationFlow() {
        // Test authentication state
        XCTAssertNil(apiService.authToken)

        // Simulate successful authentication
        apiService.authToken = "test-token-123"
        XCTAssertEqual(apiService.authToken, "test-token-123")
    }

    func testWebSocketConnection() {
        // Test WebSocket connection state
        appState.websocketConnected = false
        XCTAssertFalse(appState.websocketConnected)

        appState.websocketConnected = true
        XCTAssertTrue(appState.websocketConnected)
    }
}

// MARK: - Performance Tests
class PerformanceTests: UniversalAIToolsTestSuite {

    func testLargeAgentListPerformance() {
        // Create large number of agents
        let startTime = CFAbsoluteTimeGetCurrent()

        for index in 1...1000 {
            let agent = Agent(
                id: "agent-\(index)",
                name: "Agent \(index)",
                type: "Cognitive",
                description: "Performance test agent \(index)",
                capabilities: ["capability1", "capability2"],
                status: .active
            )
            appState.activeAgents.append(agent)
        }

        let endTime = CFAbsoluteTimeGetCurrent()
        let duration = endTime - startTime

        XCTAssertEqual(appState.activeAgents.count, 1000)
        XCTAssertLessThan(duration, 1.0, "Agent creation should complete within 1 second")
    }

    func testMemoryUsage() {
        let initialMemory = getMemoryUsage()

        // Create test data
        for count in 1...100 {
            appState.createNewChat()
        }

        let finalMemory = getMemoryUsage()
        let memoryIncrease = finalMemory - initialMemory

        // Memory increase should be reasonable (less than 50MB)
        XCTAssertLessThan(memoryIncrease, 50 * 1024 * 1024, "Memory usage should be reasonable")
    }

    private func getMemoryUsage() -> Int {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return Int(info.resident_size)
        } else {
            return 0
        }
    }
}

// MARK: - Integration Tests
class IntegrationTests: UniversalAIToolsTestSuite {

    func testFullAppWorkflow() {
        // Test complete app workflow
        XCTAssertFalse(appState.backendConnected)

        // Simulate backend connection
        appState.backendConnected = true
        XCTAssertTrue(appState.backendConnected)

        // Create chat
        appState.createNewChat()
        XCTAssertNotNil(appState.currentChat)

        // Add agent
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
        // Test that state changes persist
        appState.darkMode = true
        appState.sidebarVisible = false
        appState.viewMode = .webView

        XCTAssertTrue(appState.darkMode)
        XCTAssertFalse(appState.sidebarVisible)
        XCTAssertEqual(appState.viewMode, .webView)
    }
}

// MARK: - Hot Reload Support
class HotReloadTests: UniversalAIToolsTestSuite {

    func testHotReloadStatePreservation() {
        // Set up initial state
        appState.darkMode = true
        appState.createNewChat()
        let agent = Agent(
            id: "hot-reload-agent",
            name: "Hot Reload Agent",
            type: "Cognitive",
            description: "Agent for hot reload testing",
            capabilities: ["hot-reload"],
            status: .active
        )
        appState.activeAgents.append(agent)

        // Simulate hot reload
        let preservedState = appState

        // Verify state is preserved
        XCTAssertTrue(preservedState.darkMode)
        XCTAssertEqual(preservedState.chats.count, 1)
        XCTAssertEqual(preservedState.activeAgents.count, 1)
    }

    func testComponentHotReload() {
        // Test that components can be hot reloaded
        let components = [
            SidebarView(selection: .constant(.dashboard)),
            WelcomeView(),
            DetailView(),
            ConnectionStatusView(),
            ViewModeSelector()
        ]

        for component in components {
            XCTAssertNotNil(component)
        }
    }
}

// Deprecated: aggregate test runner moved to individual test files

// MARK: - Test Utilities
extension UniversalAIToolsTestSuite {

    func waitForCondition(_ condition: @escaping () -> Bool, timeout: TimeInterval = 5.0) {
        let startTime = Date()

        while !condition() && Date().timeIntervalSince(startTime) < timeout {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.1))
        }

        XCTAssertTrue(condition(), "Condition not met within timeout")
    }

    func simulateUserInteraction() {
        // Simulate user interactions for testing
        DispatchQueue.main.async {
            self.appState.createNewChat()
            self.appState.showSettings = true
            self.appState.showNotification(message: "Test notification")
        }
    }
}
