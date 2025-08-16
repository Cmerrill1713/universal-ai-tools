import Foundation
import SwiftUI

// MARK: - Conversation Session Model
struct ConversationSession: Identifiable, Codable {
    let id: UUID
    var title: String
    var agentType: String
    var mode: ConversationMode
    var isActive: Bool
    var startTime: Date
    var endTime: Date?
    var messageCount: Int
    var context: [String: String]
    
    init(
        id: UUID = UUID(),
        title: String,
        agentType: String,
        mode: ConversationMode = .hybrid,
        context: [String: String] = [:]
    ) {
        self.id = id
        self.title = title
        self.agentType = agentType
        self.mode = mode
        self.isActive = true
        self.startTime = Date()
        self.endTime = nil
        self.messageCount = 0
        self.context = context
    }
}

// MARK: - Conversation Mode
enum ConversationMode: String, Codable, CaseIterable {
    case textOnly = "text_only"
    case voiceOnly = "voice_only"
    case hybrid = "hybrid"
    case multimodal = "multimodal"
    
    var displayName: String {
        switch self {
        case .textOnly: return "Text Only"
        case .voiceOnly: return "Voice Only"
        case .hybrid: return "Hybrid"
        case .multimodal: return "Multimodal"
        }
    }
    
    var icon: String {
        switch self {
        case .textOnly: return "text.bubble"
        case .voiceOnly: return "mic"
        case .hybrid: return "text.bubble.fill"
        case .multimodal: return "camera.fill"
        }
    }
}
