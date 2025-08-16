import Foundation
import SwiftUI
import XCTest

class UIComponentTests: UniversalAIToolsTestSuite {
    func testSidebarViewRendering() {
        let sidebarView = SidebarView(selection: .constant(.analytics))
            .environmentObject(appState)
        XCTAssertNotNil(sidebarView)

        var selection: SidebarItem? = .analytics
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

        let testMetrics = SystemMetrics(
            cpuUsage: 45.0,
            memoryUsage: 67.0,
            uptime: 3600.0,
            requestsPerMinute: 120,
            activeConnections: 8,
            apiCalls: nil,
            avgResponseTime: nil,
            memoryBytes: nil,
            cpuHistory: nil,
            memoryHistory: nil,
            requestHistory: nil,
            responseTimeHistory: nil
        )
        appState.systemMetrics = testMetrics
        XCTAssertEqual(appState.systemMetrics?.cpuUsage, 45.0)
    }

    func testConnectionStatusView() {
        let connectionView = ConnectionStatusView()
            .environmentObject(appState)
            .environmentObject(apiService)
        XCTAssertNotNil(connectionView)

        appState.backendConnected = true
        appState.websocketConnected = true
        XCTAssertTrue(appState.backendConnected)
        XCTAssertTrue(appState.websocketConnected)
    }

    func testViewModeSelector() {
        let viewModeSelector = ViewModeSelector()
            .environmentObject(appState)
        XCTAssertNotNil(viewModeSelector)

        appState.viewMode = .web
        XCTAssertEqual(appState.viewMode, .web)
        appState.viewMode = .native
        XCTAssertEqual(appState.viewMode, .native)
        appState.viewMode = .hybrid
        XCTAssertEqual(appState.viewMode, .hybrid)
    }
}



