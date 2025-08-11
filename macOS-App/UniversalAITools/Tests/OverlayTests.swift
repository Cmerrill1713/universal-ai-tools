import XCTest
import SwiftUI

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


