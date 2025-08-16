import Foundation
import SwiftUI

// MARK: - Message Model
struct Message: Identifiable, Codable, Hashable {
    let id: UUID
    let role: MessageRole
    let content: String
    let timestamp: Date
    var model: String?
    var ragMetadata: RAGMetadata?
    
    init(id: UUID = UUID(), role: MessageRole, content: String, timestamp: Date = Date(), model: String? = nil, ragMetadata: RAGMetadata? = nil) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.model = model
        self.ragMetadata = ragMetadata
    }
    
    enum MessageRole: String, Codable, CaseIterable {
        case user = "user"
        case assistant = "assistant"
        case system = "system"
        
        var displayName: String {
            switch self {
            case .user: return "You"
            case .assistant: return "AI"
            case .system: return "System"
            }
        }
        
        var color: Color {
            switch self {
            case .user: return .blue
            case .assistant: return .green
            case .system: return .gray
            }
        }
    }
}

// MARK: - RAG Metadata
struct RAGMetadata: Codable, Hashable {
    let contextUsed: Int
    let graphPaths: Int
    let clusters: Int
    let sources: [RAGSource]
    
    init(contextUsed: Int, sources: [RAGSource], graphPaths: Int = 0, clusters: Int = 0) {
        self.contextUsed = contextUsed
        self.sources = sources
        self.graphPaths = graphPaths
        self.clusters = clusters
    }
}

struct RAGSource: Identifiable, Codable, Hashable {
    let id: UUID
    let type: String
    let preview: String
    let score: Double
    
    init(id: UUID = UUID(), type: String, preview: String, score: Double) {
        self.id = id
        self.type = type
        self.preview = preview
        self.score = score
    }
}
