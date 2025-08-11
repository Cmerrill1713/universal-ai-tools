import XCTest

class APIServiceTests: UniversalAIToolsTestSuite {
    func testConnectionState() {
        XCTAssertFalse(apiService.isConnected)
        apiService.isConnected = true
        XCTAssertTrue(apiService.isConnected)
    }

    func testAuthenticationFlow() {
        XCTAssertNil(apiService.authToken)
        apiService.authToken = "test-token-123"
        XCTAssertEqual(apiService.authToken, "test-token-123")
    }

    func testWebSocketConnection() {
        appState.websocketConnected = false
        XCTAssertFalse(appState.websocketConnected)
        appState.websocketConnected = true
        XCTAssertTrue(appState.websocketConnected)
    }
}



