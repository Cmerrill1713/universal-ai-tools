import XCTest

final class ChatBehaviorTests: XCTestCase {
    func testEnterAndShiftEnter() {
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = "http://localhost:8014"
        app.launchEnvironment["QA_MODE"] = "1"
        app.launch()

        let input = app.textViews["chat_input"]
        XCTAssertTrue(input.waitForExistence(timeout: 8), "chat_input not found")
        input.click()
        input.typeText("ping")
        app.typeKey(.return, modifierFlags: []) // ENTER → send

        let resp = app.staticTexts["chat_response"]
        XCTAssertTrue(resp.waitForExistence(timeout: 12), "chat_response not found")
        XCTAssertFalse((resp.value as? String ?? "").isEmpty, "empty response")

        input.click()
        input.typeText("line1")
        app.typeKey(.return, modifierFlags: .shift) // SHIFT+ENTER → newline
        input.typeText("line2")
        app.typeKey(.return, modifierFlags: [])     // send
    }
}

