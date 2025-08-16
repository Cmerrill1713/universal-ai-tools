import Foundation
import SwiftUI

// MARK: - Chat Model
struct Chat: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var messages: [Message]
    let createdAt: Date
    var updatedAt: Date
    var isActive: Bool
    
    init(id: UUID = UUID(), title: String = "New Chat", messages: [Message] = [], createdAt: Date = Date()) {
        self.id = id
        self.title = title
        self.messages = messages
        self.createdAt = createdAt
        self.updatedAt = createdAt
        self.isActive = false
    }
    
    mutating func addMessage(_ message: Message) {
        messages.append(message)
        updatedAt = Date()
        
        // Auto-generate title from first user message if still default
        if title == "New Chat", message.role == .user, !message.content.isEmpty {
            title = String(message.content.prefix(30)) + (message.content.count > 30 ? "..." : "")
        }
    }
    
    mutating func updateMessage(withId messageId: UUID, content: String) {
        if let index = messages.firstIndex(where: { $0.id == messageId }) {
            let updatedMessage = Message(
                id: messageId,
                role: messages[index].role,
                content: content,
                timestamp: messages[index].timestamp,
                model: messages[index].model,
                ragMetadata: messages[index].ragMetadata
            )
            messages[index] = updatedMessage
            updatedAt = Date()
        }
    }
    
    mutating func deleteMessage(withId messageId: UUID) {
        messages.removeAll { $0.id == messageId }
        updatedAt = Date()
    }
    
    var lastMessage: Message? {
        return messages.last
    }
    
    var messageCount: Int {
        return messages.count
    }
    
    var hasUserMessages: Bool {
        return messages.contains { $0.role == .user }
    }
    
    var lastMessageTime: Date {
        return lastMessage?.timestamp ?? updatedAt
    }
}
