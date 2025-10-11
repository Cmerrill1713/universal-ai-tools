import XCTest

final class ChatBehaviorTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testEnterSendsShiftEnterCreatesNewline() throws {
        try requireUITestHost()
        let app = XCUIApplication()
        app.launchEnvironment["QA_MODE"] = "1"
        app.launch()

        let chatInput = app.textViews["chat_input"]
        XCTAssertTrue(chatInput.waitForExistence(timeout: 5), "Chat input not found")
        chatInput.click()

        chatInput.typeText("Line1")
        chatInput.typeKey(.return, modifierFlags: [])

        let enterValue = (chatInput.value as? String) ?? ""
        XCTAssertFalse(enterValue.contains("\n"), "Regular Enter should not insert newline: \(enterValue)")

        chatInput.typeKey(.return, modifierFlags: .shift)
        let shiftEnterValue = (chatInput.value as? String) ?? ""
        XCTAssertTrue(shiftEnterValue.contains("\n"), "Shift+Enter should insert newline: \(shiftEnterValue)")

        let attachment = XCTAttachment(string: shiftEnterValue)
        attachment.lifetime = .keepAlways
        attachment.name = "ChatInputValue"
        add(attachment)
    }
}
