import XCTest

final class BootAndHealthTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testBootShowsHealthBanner() throws {
        try requireUITestHost()
        let app = XCUIApplication()
        app.launchEnvironment["QA_MODE"] = "1"
        app.launch()

        let banner = app.staticTexts["health_banner"]
        XCTAssertTrue(banner.waitForExistence(timeout: 10), "Health banner did not appear")

        let screenshot = banner.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.lifetime = .keepAlways
        attachment.name = "HealthBanner"
        add(attachment)
    }
}
