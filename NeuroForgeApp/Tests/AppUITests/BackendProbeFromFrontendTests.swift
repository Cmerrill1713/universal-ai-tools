import XCTest

/// Frontend-driven E2E test of ALL backend services (Go, Python, Rust)
/// Validates multi-language stack entirely from macOS SwiftUI UI
final class BackendProbeFromFrontendTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testBackendProbeViaFrontend() throws {
        try requireUITestHost()
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = "http://localhost:8888"  // Main Python API
        app.launchEnvironment["QA_MODE"] = "1"
        app.launch()

        // Navigate to Backend Probe tab
        let backendProbeTab = app.buttons["Backend Probe"]
        XCTAssertTrue(backendProbeTab.waitForExistence(timeout: 5), "Backend Probe tab not found")
        backendProbeTab.tap()

        // Tap probe button
        let probeButton = app.buttons["qa_backend_probe_button"]
        XCTAssertTrue(probeButton.waitForExistence(timeout: 5), "Probe button not found")
        
        // Capture before screenshot
        let beforeScreenshot = app.screenshot()
        let beforeAttachment = XCTAttachment(screenshot: beforeScreenshot)
        beforeAttachment.lifetime = .keepAlways
        beforeAttachment.name = "BackendProbe-Before"
        add(beforeAttachment)
        
        probeButton.tap()

        // Wait for results list to appear
        let resultsList = app.tables["qa_backend_results_list"]
        XCTAssertTrue(resultsList.waitForExistence(timeout: 15), "Results list did not appear within 15s")

        // Capture results screenshot
        let resultsScreenshot = resultsList.screenshot()
        let resultsAttachment = XCTAttachment(screenshot: resultsScreenshot)
        resultsAttachment.lifetime = .keepAlways
        resultsAttachment.name = "BackendProbe-Results"
        add(resultsAttachment)

        // Verify critical services are present
        let cells = resultsList.cells
        XCTAssertGreaterThan(cells.count, 5, "Should have at least 6 services")

        // Verify specific services appear (check for text containing service names)
        let allText = cells.allElementsBoundByIndex.map { $0.staticTexts.allElementsBoundByIndex.map { $0.label }.joined(separator: " ") }.joined(separator: "\n")
        
        XCTAssertTrue(allText.contains("chat"), "Chat service should be listed")
        XCTAssertTrue(allText.contains("weaviate"), "Weaviate service should be listed")
        XCTAssertTrue(allText.contains("grafana"), "Grafana service should be listed")

        // Log the probe results for debugging
        print("📊 Backend Probe Results:")
        print(allText)

        // Verify at least some services passed
        XCTAssertTrue(allText.contains("pass") || allText.contains("OK"), "At least some services should be healthy")
    }
}

