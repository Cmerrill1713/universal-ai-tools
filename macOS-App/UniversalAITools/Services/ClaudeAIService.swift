//
//  ClaudeAIService.swift
//  UniversalAITools
//
//  Created by Universal AI Tools
//

import Foundation
import SwiftAnthropic
import Combine

/// Service for integrating Claude AI capabilities into the app
@MainActor
class ClaudeAIService: ObservableObject {
    static let shared = ClaudeAIService()
    
    @Published var isConnected = false
    @Published var isProcessing = false
    @Published var currentModel: String = "claude-3-5-sonnet-20241022"
    @Published var streamingResponse = ""
    
    private var anthropicService: AnthropicService?
    private var cancellables = Set<AnyCancellable>()
    
    // Available Claude models
    let availableModels = [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229"
    ]
    
    private init() {
        setupService()
    }
    
    /// Initialize the Anthropic service with API key
    func setupService() {
        // Try to get API key from Keychain or environment
        if let apiKey = getAPIKey() {
            anthropicService = AnthropicService(apiKey: apiKey)
            isConnected = true
            print("✅ Claude AI Service initialized")
        } else {
            print("⚠️ No API key found for Claude AI")
            isConnected = false
        }
    }
    
    /// Get API key from Keychain or environment
    private func getAPIKey() -> String? {
        // First try Keychain
        if let keychainKey = KeychainService.shared.getAnthropicAPIKey() {
            return keychainKey
        }
        
        // Fallback to environment variable
        return ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"]
    }
    
    /// Update API key and reinitialize service
    func updateAPIKey(_ apiKey: String) {
        KeychainService.shared.saveAnthropicAPIKey(apiKey)
        setupService()
    }
    
    /// Send a message to Claude and get a response
    func sendMessage(_ message: String, systemPrompt: String? = nil) async throws -> String {
        guard let service = anthropicService else {
            throw ClaudeError.notInitialized
        }
        
        isProcessing = true
        defer { isProcessing = false }
        
        var messages = [Message]()
        
        // Add system message if provided
        if let systemPrompt = systemPrompt {
            messages.append(Message(role: .system, content: [.text(systemPrompt)]))
        }
        
        // Add user message
        messages.append(Message(role: .user, content: [.text(message)]))
        
        let parameters = MessageParameter(
            model: currentModel,
            messages: messages,
            maxTokens: 4096
        )
        
        let response = try await service.createMessage(parameters)
        
        // Extract text from response
        let responseText = response.content.compactMap { content -> String? in
            if case .text(let text) = content {
                return text
            }
            return nil
        }.joined(separator: "\n")
        
        return responseText
    }
    
    /// Stream a message response from Claude
    func streamMessage(_ message: String, systemPrompt: String? = nil) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                guard let service = anthropicService else {
                    continuation.finish(throwing: ClaudeError.notInitialized)
                    return
                }
                
                isProcessing = true
                streamingResponse = ""
                
                var messages = [Message]()
                
                if let systemPrompt = systemPrompt {
                    messages.append(Message(role: .system, content: [.text(systemPrompt)]))
                }
                
                messages.append(Message(role: .user, content: [.text(message)]))
                
                let parameters = MessageParameter(
                    model: currentModel,
                    messages: messages,
                    maxTokens: 4096,
                    stream: true
                )
                
                do {
                    let stream = try await service.streamMessage(parameters)
                    
                    for try await chunk in stream {
                        if let textDelta = chunk.delta?.text {
                            streamingResponse += textDelta
                            continuation.yield(textDelta)
                        }
                    }
                    
                    isProcessing = false
                    continuation.finish()
                } catch {
                    isProcessing = false
                    continuation.finish(throwing: error)
                }
            }
        }
    }
    
    /// Process code with Claude for analysis, refactoring, or documentation
    func processCode(_ code: String, action: CodeAction) async throws -> String {
        let systemPrompt = action.systemPrompt
        let userMessage = """
        \(action.instruction)
        
        Code:
        ```swift
        \(code)
        ```
        """
        
        return try await sendMessage(userMessage, systemPrompt: systemPrompt)
    }
    
    /// Analyze an image with Claude Vision
    func analyzeImage(data: Data, prompt: String) async throws -> String {
        guard let service = anthropicService else {
            throw ClaudeError.notInitialized
        }
        
        isProcessing = true
        defer { isProcessing = false }
        
        let base64Image = data.base64EncodedString()
        
        let imageContent = MessageContent.image(
            .init(
                type: .base64,
                mediaType: .png,
                data: base64Image
            )
        )
        
        let messages = [
            Message(
                role: .user,
                content: [
                    imageContent,
                    .text(prompt)
                ]
            )
        ]
        
        let parameters = MessageParameter(
            model: currentModel,
            messages: messages,
            maxTokens: 4096
        )
        
        let response = try await service.createMessage(parameters)
        
        return response.content.compactMap { content -> String? in
            if case .text(let text) = content {
                return text
            }
            return nil
        }.joined(separator: "\n")
    }
}

// MARK: - Supporting Types

enum ClaudeError: LocalizedError {
    case notInitialized
    case invalidResponse
    case apiKeyMissing
    
    var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Claude AI service is not initialized. Please provide an API key."
        case .invalidResponse:
            return "Received an invalid response from Claude AI."
        case .apiKeyMissing:
            return "API key is missing. Please add your Anthropic API key in settings."
        }
    }
}

enum CodeAction {
    case analyze
    case refactor
    case document
    case debug
    case optimize
    case test
    
    var systemPrompt: String {
        switch self {
        case .analyze:
            return "You are a Swift code analyzer. Provide detailed analysis of the code including potential issues, complexity, and suggestions."
        case .refactor:
            return "You are a Swift refactoring expert. Suggest improvements to make the code cleaner, more maintainable, and follow Swift best practices."
        case .document:
            return "You are a technical documentation writer. Add comprehensive documentation comments to the code following Swift documentation standards."
        case .debug:
            return "You are a debugging expert. Identify potential bugs, edge cases, and issues in the code."
        case .optimize:
            return "You are a performance optimization expert. Suggest optimizations to improve the code's performance and efficiency."
        case .test:
            return "You are a testing expert. Generate comprehensive unit tests for the provided code using XCTest framework."
        }
    }
    
    var instruction: String {
        switch self {
        case .analyze:
            return "Please analyze this Swift code:"
        case .refactor:
            return "Please refactor this Swift code to improve its quality:"
        case .document:
            return "Please add comprehensive documentation to this Swift code:"
        case .debug:
            return "Please identify bugs and issues in this Swift code:"
        case .optimize:
            return "Please optimize this Swift code for better performance:"
        case .test:
            return "Please generate unit tests for this Swift code:"
        }
    }
}

// MARK: - Keychain Extension

extension KeychainService {
    func getAnthropicAPIKey() -> String? {
        return getKey(for: "anthropic_api_key")
    }
    
    func saveAnthropicAPIKey(_ key: String) {
        saveKey(key, for: "anthropic_api_key")
    }
}