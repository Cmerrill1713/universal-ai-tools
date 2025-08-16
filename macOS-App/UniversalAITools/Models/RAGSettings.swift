import Foundation
import SwiftUI

// MARK: - RAG Settings
struct RAGSettings: Codable, Hashable {
    var isEnabled: Bool = true
    var contextLength: Int = 4096
    var maxContext: Int = 4096
    var relevanceThreshold: Double = 0.7
    var maxSources: Int = 5
    var includeCodeContext: Bool = true
    var includeDocumentationContext: Bool = true
    var includeConversationContext: Bool = true
    var includeGraphPaths: Bool = true
    var graphTraversalDepth: Int = 3
    var useSemanticSearch: Bool = true
    var chunkSize: Int = 512
    var overlapSize: Int = 50
    var sessionId: String = ""
    var projectPath: String = ""
    
    static let defaultSettings = RAGSettings()
}
