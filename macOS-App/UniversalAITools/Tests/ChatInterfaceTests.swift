import XCTest

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
        var updatedChat = currentChat
        updatedChat.messages.append(message)
        XCTAssertEqual(updatedChat.messages.count, 1)
        XCTAssertEqual(updatedChat.messages.first?.content, "Hello, this is a test message")
        XCTAssertEqual(updatedChat.messages.first?.role, .user)
    }

    func testChatHistory() {
        for number in 1...3 {
            appState.createNewChat()
            if let chat = appState.currentChat {
                var updatedChat = chat
                updatedChat.title = "Test Chat \(number)"
                if let index = appState.chats.firstIndex(where: { $0.id == chat.id }) {
                    appState.chats[index] = updatedChat
                }
            }
        }
        XCTAssertEqual(appState.chats.count, 3)
        XCTAssertEqual(appState.chats.last?.title, "Test Chat 3")
    }
}

