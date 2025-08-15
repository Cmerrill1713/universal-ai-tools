import Foundation
import SwiftUI
import OSLog

// MARK: - Voice Command Models
struct VoiceCommandMatch {
    let command: VoiceCommand
    let confidence: Double
    let parameters: [String: String]
}

enum VoiceCommandCategory {
    case navigation
    case chat
    case system
    case voice
    case application
}

struct VoiceCommandDefinition {
    let command: VoiceCommand
    let category: VoiceCommandCategory
    let patterns: [String]
    let description: String
    let parameters: [String]
    let requiresConfirmation: Bool
    let action: (VoiceCommandParameters) async -> VoiceCommandResult
}

struct VoiceCommandParameters {
    let originalText: String
    let extractedParameters: [String: String]
    let confidence: Double
    let context: VoiceCommandContext
}

struct VoiceCommandContext {
    let currentView: String?
    let isAuthenticated: Bool
    let hasActiveChat: Bool
    let appState: AppState?
}

struct VoiceCommandResult {
    let success: Bool
    let message: String
    let shouldSpeak: Bool
    let data: [String: Any]?
}

// MARK: - Voice Command Handler
@MainActor
class VoiceCommandHandler: ObservableObject {
    // MARK: - Published Properties
    @Published var isProcessingCommand = false
    @Published var lastCommandResult: VoiceCommandResult?
    @Published var recognizedCommands: [VoiceCommandMatch] = []
    
    // MARK: - Private Properties
    private let logger = Logger(subsystem: "UniversalAITools", category: "VoiceCommandHandler")
    private var appState: AppState?
    private var apiService: APIService?
    private var commandDefinitions: [VoiceCommandDefinition] = []
    
    // MARK: - Initialization
    init() {
        setupCommandDefinitions()
        logger.info("🎯 VoiceCommandHandler initialized with \(self.commandDefinitions.count) commands")
    }
    
    // MARK: - Public Methods
    func setAppState(_ appState: AppState) {
        self.appState = appState
    }
    
    func setAPIService(_ apiService: APIService) {
        self.apiService = apiService
    }
    
    func processVoiceInput(_ text: String) async -> VoiceCommandResult? {
        logger.info("🎯 Processing voice input: \(text)")
        
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        
        isProcessingCommand = true
        defer { isProcessingCommand = false }
        
        // Find matching commands
        let matches = findCommandMatches(in: text)
        recognizedCommands = matches
        
        // Execute the best match
        if let bestMatch = matches.first {
            logger.info("🎯 Executing command: \(bestMatch.command) with confidence: \(bestMatch.confidence)")
            
            let context = VoiceCommandContext(
                currentView: getCurrentView(),
                isAuthenticated: apiService?.isAuthenticated ?? false,
                hasActiveChat: appState?.currentChat != nil,
                appState: appState
            )
            
            let parameters = VoiceCommandParameters(
                originalText: text,
                extractedParameters: bestMatch.parameters,
                confidence: bestMatch.confidence,
                context: context
            )
            
            if let definition = commandDefinitions.first(where: { $0.command == bestMatch.command }) {
                let result = await definition.action(parameters)
                lastCommandResult = result
                return result
            }
        }
        
        return nil
    }
    
    func getAvailableCommands() -> [VoiceCommandDefinition] {
        return commandDefinitions
    }
    
    func getCommandsForCategory(_ category: VoiceCommandCategory) -> [VoiceCommandDefinition] {
        return commandDefinitions.filter { $0.category == category }
    }
    
    // MARK: - Private Methods
    private func findCommandMatches(in text: String) -> [VoiceCommandMatch] {
        let normalizedText = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        var matches: [VoiceCommandMatch] = []
        
        for definition in commandDefinitions {
            for pattern in definition.patterns {
                if let match = matchPattern(pattern, in: normalizedText) {
                    let commandMatch = VoiceCommandMatch(
                        command: definition.command,
                        confidence: match.confidence,
                        parameters: match.parameters
                    )
                    matches.append(commandMatch)
                }
            }
        }
        
        // Sort by confidence and return top matches
        return matches.sorted { $0.confidence > $1.confidence }.prefix(5).map { $0 }
    }
    
    private func matchPattern(_ pattern: String, in text: String) -> (confidence: Double, parameters: [String: String])? {
        let patternWords = pattern.lowercased().components(separatedBy: .whitespaces)
        let textWords = text.components(separatedBy: .whitespaces)
        
        var matchedWords = 0
        var parameters: [String: String] = [:]
        
        // Simple pattern matching - can be enhanced with regex or NLP
        for patternWord in patternWords {
            if patternWord.hasPrefix("{") && patternWord.hasSuffix("}") {
                // Parameter placeholder
                let paramName = String(patternWord.dropFirst().dropLast())
                // Try to extract parameter from nearby words
                if let extractedValue = extractParameter(paramName, from: textWords, around: matchedWords) {
                    parameters[paramName] = extractedValue
                    matchedWords += 1
                }
            } else {
                // Literal word match
                if textWords.contains(where: { $0.lowercased().contains(patternWord) }) {
                    matchedWords += 1
                }
            }
        }
        
        let confidence = Double(matchedWords) / Double(patternWords.count)
        
        // Require at least 60% match
        if confidence >= 0.6 {
            return (confidence, parameters)
        }
        
        return nil
    }
    
    private func extractParameter(_ paramName: String, from words: [String], around index: Int) -> String? {
        // Simple parameter extraction logic
        let searchRange = max(0, index - 2)..<min(words.count, index + 3)
        
        switch paramName {
        case "number":
            for i in searchRange {
                if let number = Int(words[i]) {
                    return String(number)
                }
            }
        case "text", "message":
            // Extract remaining text after command
            if index < words.count - 1 {
                return words[(index + 1)...].joined(separator: " ")
            }
        case "app", "application":
            for i in searchRange {
                if words[i].lowercased().contains("app") || words[i].lowercased().contains("application") {
                    return words[i]
                }
            }
        }
        
        return nil
    }
    
    private func getCurrentView() -> String? {
        // Determine current view based on app state
        if let selectedItem = appState?.selectedSidebarItem {
            return selectedItem.rawValue
        }
        return nil
    }
    
    // MARK: - Command Definitions
    private func setupCommandDefinitions() {
        commandDefinitions = [
            // Navigation Commands
            VoiceCommandDefinition(
                command: .newChat,
                category: .navigation,
                patterns: [
                    "new chat",
                    "start new chat",
                    "create new conversation",
                    "new conversation",
                    "start over"
                ],
                description: "Start a new chat conversation",
                parameters: [],
                requiresConfirmation: false,
                action: handleNewChatCommand
            ),
            
            VoiceCommandDefinition(
                command: .clearContext,
                category: .chat,
                patterns: [
                    "clear context",
                    "forget conversation",
                    "clear history",
                    "reset conversation",
                    "start fresh"
                ],
                description: "Clear the conversation context",
                parameters: [],
                requiresConfirmation: true,
                action: handleClearContextCommand
            ),
            
            VoiceCommandDefinition(
                command: .openSettings,
                category: .navigation,
                patterns: [
                    "open settings",
                    "show settings",
                    "preferences",
                    "open preferences",
                    "settings menu"
                ],
                description: "Open the settings panel",
                parameters: [],
                requiresConfirmation: false,
                action: handleOpenSettingsCommand
            ),
            
            // Voice Control Commands
            VoiceCommandDefinition(
                command: .enableTTS,
                category: .voice,
                patterns: [
                    "enable text to speech",
                    "turn on voice",
                    "enable speaking",
                    "turn on tts",
                    "start speaking"
                ],
                description: "Enable text-to-speech output",
                parameters: [],
                requiresConfirmation: false,
                action: handleEnableTTSCommand
            ),
            
            VoiceCommandDefinition(
                command: .disableTTS,
                category: .voice,
                patterns: [
                    "disable text to speech",
                    "turn off voice",
                    "disable speaking",
                    "turn off tts",
                    "stop speaking",
                    "mute voice"
                ],
                description: "Disable text-to-speech output",
                parameters: [],
                requiresConfirmation: false,
                action: handleDisableTTSCommand
            ),
            
            VoiceCommandDefinition(
                command: .stopListening,
                category: .voice,
                patterns: [
                    "stop listening",
                    "stop recording",
                    "end voice input",
                    "cancel recording",
                    "stop microphone"
                ],
                description: "Stop voice recording",
                parameters: [],
                requiresConfirmation: false,
                action: handleStopListeningCommand
            ),
            
            // System Commands
            VoiceCommandDefinition(
                command: .helpCommands,
                category: .system,
                patterns: [
                    "help",
                    "what can you do",
                    "show commands",
                    "available commands",
                    "voice commands",
                    "help me"
                ],
                description: "Show available voice commands",
                parameters: [],
                requiresConfirmation: false,
                action: handleHelpCommand
            ),
            
            VoiceCommandDefinition(
                command: .repeatLast,
                category: .system,
                patterns: [
                    "repeat that",
                    "say that again",
                    "repeat last",
                    "what did you say",
                    "repeat"
                ],
                description: "Repeat the last response",
                parameters: [],
                requiresConfirmation: false,
                action: handleRepeatLastCommand
            ),
            
            // Application Commands
            VoiceCommandDefinition(
                command: .exportChat,
                category: .application,
                patterns: [
                    "export chat",
                    "save conversation",
                    "export conversation",
                    "save chat",
                    "download chat"
                ],
                description: "Export the current chat",
                parameters: [],
                requiresConfirmation: false,
                action: handleExportChatCommand
            ),
            
            VoiceCommandDefinition(
                command: .switchMode,
                category: .application,
                patterns: [
                    "switch to {mode} mode",
                    "change to {mode}",
                    "set mode to {mode}",
                    "{mode} mode"
                ],
                description: "Switch voice interaction mode",
                parameters: ["mode"],
                requiresConfirmation: false,
                action: handleSwitchModeCommand
            )
        ]
    }
    
    // MARK: - Command Handlers
    private func handleNewChatCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        appState?.createNewChat()
        
        return VoiceCommandResult(
            success: true,
            message: "Started a new chat conversation",
            shouldSpeak: true,
            data: nil
        )
    }
    
    private func handleClearContextCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        // Clear chat messages
        appState?.currentChat?.messages.removeAll()
        
        return VoiceCommandResult(
            success: true,
            message: "Conversation context cleared",
            shouldSpeak: true,
            data: nil
        )
    }
    
    private func handleOpenSettingsCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        appState?.showSettings = true
        
        return VoiceCommandResult(
            success: true,
            message: "Opening settings",
            shouldSpeak: true,
            data: nil
        )
    }
    
    private func handleEnableTTSCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        // Post notification to enable TTS
        NotificationCenter.default.post(name: NSNotification.Name("EnableTTS"), object: nil)
        
        return VoiceCommandResult(
            success: true,
            message: "Text-to-speech enabled",
            shouldSpeak: true,
            data: nil
        )
    }
    
    private func handleDisableTTSCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        // Post notification to disable TTS
        NotificationCenter.default.post(name: NSNotification.Name("DisableTTS"), object: nil)
        
        return VoiceCommandResult(
            success: true,
            message: "Text-to-speech disabled",
            shouldSpeak: false, // Don't speak this since we're disabling TTS
            data: nil
        )
    }
    
    private func handleStopListeningCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        // Post notification to stop listening
        NotificationCenter.default.post(name: NSNotification.Name("StopVoiceListening"), object: nil)
        
        return VoiceCommandResult(
            success: true,
            message: "Stopped listening",
            shouldSpeak: true,
            data: nil
        )
    }
    
    private func handleHelpCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        let availableCommands = commandDefinitions.map { $0.description }.joined(separator: ", ")
        let helpMessage = "Available voice commands include: \(availableCommands)"
        
        return VoiceCommandResult(
            success: true,
            message: helpMessage,
            shouldSpeak: true,
            data: ["commands": commandDefinitions.map { $0.description }]
        )
    }
    
    private func handleRepeatLastCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        if let lastMessage = appState?.currentChat?.messages.last(where: { $0.role == .assistant }) {
            return VoiceCommandResult(
                success: true,
                message: lastMessage.content,
                shouldSpeak: true,
                data: nil
            )
        } else {
            return VoiceCommandResult(
                success: false,
                message: "No previous message to repeat",
                shouldSpeak: true,
                data: nil
            )
        }
    }
    
    private func handleExportChatCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        guard let currentChat = appState?.currentChat else {
            return VoiceCommandResult(
                success: false,
                message: "No active chat to export",
                shouldSpeak: true,
                data: nil
            )
        }
        
        let exportedText = appState?.exportChatAsText(currentChat) ?? ""
        appState?.saveToFile(content: exportedText, filename: "\(currentChat.title).txt")
        
        return VoiceCommandResult(
            success: true,
            message: "Chat exported successfully",
            shouldSpeak: true,
            data: nil
        )
    }
    
    private func handleSwitchModeCommand(_ params: VoiceCommandParameters) async -> VoiceCommandResult {
        guard let mode = params.extractedParameters["mode"] else {
            return VoiceCommandResult(
                success: false,
                message: "Please specify a mode: conversational, command, dictation, or assistant",
                shouldSpeak: true,
                data: nil
            )
        }
        
        let lowercaseMode = mode.lowercased()
        var newMode: VoiceInteractionMode?
        
        switch lowercaseMode {
        case "conversational", "conversation", "chat":
            newMode = .conversational
        case "command", "commands":
            newMode = .command
        case "dictation", "transcription":
            newMode = .dictation
        case "assistant", "ai":
            newMode = .assistant
        default:
            break
        }
        
        if let newMode = newMode {
            // Post notification to change voice mode
            NotificationCenter.default.post(
                name: NSNotification.Name("ChangeVoiceMode"),
                object: nil,
                userInfo: ["mode": newMode]
            )
            
            return VoiceCommandResult(
                success: true,
                message: "Switched to \(mode) mode",
                shouldSpeak: true,
                data: ["mode": newMode]
            )
        } else {
            return VoiceCommandResult(
                success: false,
                message: "Unknown mode. Available modes are: conversational, command, dictation, and assistant",
                shouldSpeak: true,
                data: nil
            )
        }
    }
}

// MARK: - Extended Voice Commands
extension VoiceCommand {
    static let helpCommands = VoiceCommand(rawValue: "Help Commands")!
    static let repeatLast = VoiceCommand(rawValue: "Repeat Last")!
    static let exportChat = VoiceCommand(rawValue: "Export Chat")!
    static let switchMode = VoiceCommand(rawValue: "Switch Mode")!
}

// MARK: - Voice Command Extensions
extension VoiceCommandHandler {
    func registerCustomCommand(
        name: String,
        category: VoiceCommandCategory,
        patterns: [String],
        description: String,
        parameters: [String] = [],
        requiresConfirmation: Bool = false,
        action: @escaping (VoiceCommandParameters) async -> VoiceCommandResult
    ) {
        let customCommand = VoiceCommand(rawValue: name)!
        let definition = VoiceCommandDefinition(
            command: customCommand,
            category: category,
            patterns: patterns,
            description: description,
            parameters: parameters,
            requiresConfirmation: requiresConfirmation,
            action: action
        )
        
        commandDefinitions.append(definition)
        logger.info("📝 Registered custom voice command: \(name)")
    }
    
    func removeCustomCommand(name: String) {
        commandDefinitions.removeAll { $0.command.rawValue == name }
        logger.info("🗑️ Removed custom voice command: \(name)")
    }
}

// MARK: - Notification Names
extension NSNotification.Name {
    static let enableTTS = NSNotification.Name("EnableTTS")
    static let disableTTS = NSNotification.Name("DisableTTS")
    static let stopVoiceListening = NSNotification.Name("StopVoiceListening")
    static let changeVoiceMode = NSNotification.Name("ChangeVoiceMode")
}