import Foundation

struct ChatMessage: Identifiable, Codable {
    let id: UUID
    let text: String
    let isFromUser: Bool
    let timestamp: Date
    let agentName: String?
    let confidence: Double?
    let metadata: [String: String]?
    
    init(text: String, isFromUser: Bool, agentName: String? = nil, confidence: Double? = nil, metadata: [String: String]? = nil) {
        self.id = UUID()
        self.text = text
        self.isFromUser = isFromUser
        self.timestamp = Date()
        self.agentName = agentName
        self.confidence = confidence
        self.metadata = metadata
    }
    
    var displayText: String {
        var result = text
        
        // Add agent name if available and not from user
        if !isFromUser, let agent = agentName {
            let displayAgent = agent.replacingOccurrences(of: "-", with: " ")
                .replacingOccurrences(of: "enhanced ", with: "")
                .capitalized
            result = "[\(displayAgent)] \(result)"
        }
        
        return result
    }
    
    var confidenceText: String? {
        guard let confidence = confidence else { return nil }
        return String(format: "%.0f%% confidence", confidence * 100)
    }
    
    var timeText: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: timestamp)
    }
    
    var dateText: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: timestamp)
    }
}