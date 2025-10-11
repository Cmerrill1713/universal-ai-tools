import XCTest

final class BootAndHealthTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }
    func testBootAndHealth() {
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = "http://localhost:8014"
        app.launchEnvironment["QA_MODE"] = "1"
        app.launch()

        let banner = app.staticTexts["health_banner"]
        XCTAssertTrue(banner.waitForExistence(timeout: 10), "Missing health_banner")
        XCTContext.runActivity(named: "screenshot") { _ in
            let att = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            att.lifetime = .keepAlways
            add(att)
        }
    }
}

