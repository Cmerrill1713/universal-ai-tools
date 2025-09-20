import Foundation
import SwiftUI

@MainActor
class ChatManager: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isConnected = false
    @Published var connectionStatus: ConnectionStatus = .unknown
    @Published var isLoading = false
    
    // Service URLs
    private let chatServiceURL = "http://localhost:8010/chat"
    private let knowledgeGatewayURL = "http://localhost:8088/api/v1/chat"
    private let athenaServiceURL = "http://localhost:8010/chat"
    private let visionServiceURL = "http://localhost:8084"
    private let authServiceURL = "http://localhost:8015/auth"
    
    // Home Automation Service URLs
    private let browserAutomationURL = "http://localhost:8019/execute-command"
    private let deviceAuthURL = "http://localhost:9999/api/v1/device-auth"
    private let visionDebugURL = "http://localhost:9999/api/v1/vision-debug"
    private let smartPortManagerURL = "http://localhost:9999/api/v1/smart-devices"
    
    private let session = URLSession.shared
    
    init() {
        checkConnection()
    }
    
    func checkConnection() {
        Task {
            do {
                let url = URL(string: "http://localhost:8010/health")!
                let (_, response) = try await session.data(from: url)
                
                if let httpResponse = response as? HTTPURLResponse {
                    await MainActor.run {
                        self.isConnected = httpResponse.statusCode == 200
                        self.connectionStatus = self.isConnected ? ConnectionStatus.connected : ConnectionStatus.disconnected
                    }
                }
            } catch {
                await MainActor.run {
                    self.isConnected = false
                    self.connectionStatus = ConnectionStatus.disconnected
                }
            }
        }
    }
    
    func sendMessage(_ text: String, useKnowledge: Bool = true) async {
        let userMessage = ChatMessage(
            id: UUID().uuidString,
            content: text,
            isUser: true,
            timestamp: Date(),
            source: "user"
        )
        
        await MainActor.run {
            messages.append(userMessage)
            isLoading = true
        }
        
        do {
            let response: ChatResponse
            
            if useKnowledge {
                // Use knowledge-grounded chat
                response = try await sendKnowledgeGroundedMessage(text)
            } else {
                // Use regular chat service
                response = try await sendRegularMessage(text)
            }
            
            let aiMessage = ChatMessage(
                id: UUID().uuidString,
                content: response.message,
                isUser: false,
                timestamp: Date(),
                source: response.source ?? "ai",
                metadata: response.metadata
            )
            
            await MainActor.run {
                messages.append(aiMessage)
                isLoading = false
            }
            
        } catch {
            let errorMessage = ChatMessage(
                id: UUID().uuidString,
                content: "Error: \(error.localizedDescription)",
                isUser: false,
                timestamp: Date(),
                source: "error"
            )
            
            await MainActor.run {
                messages.append(errorMessage)
                isLoading = false
            }
        }
    }
    
    private func sendKnowledgeGroundedMessage(_ text: String) async throws -> ChatResponse {
        let url = URL(string: knowledgeGatewayURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "message": text,
            "user_id": "swift-app",
            "session_id": "main-session",
            "use_knowledge": true
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChatError.invalidResponse
        }
        
        let groundedResponse = try JSONDecoder().decode(GroundedChatResponse.self, from: data)
        
        return ChatResponse(
            message: groundedResponse.answer,
            source: "knowledge-grounded",
            metadata: [
                "confidence": groundedResponse.confidence,
                "sources_count": groundedResponse.sources.count,
                "context": groundedResponse.context
            ]
        )
    }
    
    private func sendRegularMessage(_ text: String) async throws -> ChatResponse {
        let url = URL(string: chatServiceURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "message": text
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ChatError.invalidResponse
        }
        
        let chatResponse = try JSONDecoder().decode(RegularChatResponse.self, from: data)
        
        return ChatResponse(
            message: chatResponse.response,
            source: "chat-service",
            metadata: chatResponse.metadata ?? [:]
        )
    }
    
    func clearMessages() {
        messages.removeAll()
    }
}

// MARK: - Data Models

struct ChatMessage: Identifiable {
    let id: String
    let content: String
    let isUser: Bool
    let timestamp: Date
    let source: String
    let metadata: [String: Any]?
    
    init(id: String, content: String, isUser: Bool, timestamp: Date, source: String, metadata: [String: Any]? = nil) {
        self.id = id
        self.content = content
        self.isUser = isUser
        self.timestamp = timestamp
        self.source = source
        self.metadata = metadata
    }
}

struct ChatResponse {
    let message: String
    let source: String?
    let metadata: [String: Any]
}

struct GroundedChatResponse: Decodable {
    let answer: String
    let sources: [KnowledgeSource]
    let context: [String: Any]
    let confidence: Double
    let metadata: [String: Any]
    
    enum CodingKeys: String, CodingKey {
        case answer, sources, context, confidence, metadata
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        answer = try container.decode(String.self, forKey: .answer)
        sources = try container.decode([KnowledgeSource].self, forKey: .sources)
        confidence = try container.decode(Double.self, forKey: .confidence)
        
        // Handle context and metadata as flexible JSON
        if let contextData = try? container.decode(Data.self, forKey: .context) {
            context = try JSONSerialization.jsonObject(with: contextData) as? [String: Any] ?? [:]
        } else {
            context = [:]
        }
        
        if let metadataData = try? container.decode(Data.self, forKey: .metadata) {
            metadata = try JSONSerialization.jsonObject(with: metadataData) as? [String: Any] ?? [:]
        } else {
            metadata = [:]
        }
    }
}

struct KnowledgeSource: Codable {
    let id: String
    let title: String
    let content: String
    let source: String
    let relevance: Double
}

struct RegularChatResponse: Decodable {
    let response: String
    let metadata: [String: Any]?
    
    enum CodingKeys: String, CodingKey {
        case response, metadata
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        response = try container.decode(String.self, forKey: .response)
        
        if let metadataData = try? container.decode(Data.self, forKey: .metadata) {
            metadata = try JSONSerialization.jsonObject(with: metadataData) as? [String: Any]
        } else {
            metadata = nil
        }
    }
}

enum ChatError: Error {
    case invalidResponse
    case networkError
    case decodingError
}
