import Foundation
import Combine
import OSLog

// MARK: - Voice Interaction Models
// Note: VoiceInteraction is defined in AppState.swift

// Note: VoiceInteractionMode and VoiceAgentState are defined in AppState.swift

// MARK: - Voice Agent Configuration
struct VoiceAgentConfiguration {
    var interactionMode: VoiceInteractionMode = .conversational
    var autoTTSResponse: Bool = true
    var contextRetention: Bool = true
    var maxContextMessages: Int = 10
    var responseTimeout: TimeInterval = 30.0
    var enableSmartPunctuation: Bool = true
    var enableEmotionalTone: Bool = false
    var voiceActivationPhrase: String? = nil
    var conversationPersonality: ConversationPersonality = .professional
}

enum ConversationPersonality: String, CaseIterable {
    case professional = "Professional"
    case friendly = "Friendly"
    case creative = "Creative"
    case analytical = "Analytical"
    case concise = "Concise"
    
    var systemPrompt: String {
        switch self {
        case .professional:
            return "You are a professional AI assistant. Provide clear, accurate, and helpful responses in a business-appropriate tone."
        case .friendly:
            return "You are a friendly and warm AI assistant. Be conversational, supportive, and engaging while remaining helpful."
        case .creative:
            return "You are a creative and imaginative AI assistant. Think outside the box and provide innovative solutions and ideas."
        case .analytical:
            return "You are an analytical AI assistant. Focus on logical reasoning, data-driven insights, and systematic problem-solving."
        case .concise:
            return "You are a concise AI assistant. Provide brief, direct, and to-the-point responses while maintaining helpfulness."
        }
    }
}

// MARK: - Voice Agent
@MainActor
class VoiceAgent: ObservableObject {
    // MARK: - Published Properties
    @Published var state: VoiceAgentState = .idle
    @Published var configuration: VoiceAgentConfiguration = VoiceAgentConfiguration()
    @Published var currentInteraction: VoiceInteraction?
    @Published var interactionHistory: [VoiceInteraction] = []
    @Published var isEnabled: Bool = true
    @Published var conversationContext: [Message] = []
    
    // MARK: - Services
    private let sttService: STTService
    private let ttsService: TTSService
    private let apiService: APIService
    private let logger = Logger(subsystem: "UniversalAITools", category: "VoiceAgent")
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private var currentSessionId: String = UUID().uuidString
    private var interactionStartTime: Date?
    
    // MARK: - Initialization
    init(sttService: STTService, ttsService: TTSService, apiService: APIService) {
        self.sttService = sttService
        self.ttsService = ttsService
        self.apiService = apiService
        
        setupSubscriptions()
        loadConfiguration()
        
        logger.info("🗣️ VoiceAgent initialized")
    }
    
    // MARK: - Public Methods
    func startVoiceInteraction() async {
        guard isEnabled else {
            logger.warning("VoiceAgent is disabled")
            return
        }
        
        guard state == .idle else {
            logger.warning("VoiceAgent is already active")
            return
        }
        
        logger.info("🎤 Starting voice interaction")
        state = .listening
        interactionStartTime = Date()
        
        do {
            try await sttService.startListening(
                onComplete: { [weak self] transcription in
                    Task { @MainActor in
                        await self?.handleTranscription(transcription)
                    }
                },
                onPartial: { [weak self] partial in
                    Task { @MainActor in
                        self?.handlePartialTranscription(partial)
                    }
                }
            )
        } catch {
            logger.error("Failed to start listening: \(error)")
            state = .error(error.localizedDescription)
        }
    }
    
    func stopVoiceInteraction() {
        logger.info("🛑 Stopping voice interaction")
        sttService.stopListening()
    }
    
    func cancelVoiceInteraction() {
        logger.info("❌ Canceling voice interaction")
        sttService.cancelListening()
        state = .idle
        currentInteraction = nil
    }
    
    func processTextInput(_ text: String) async {
        guard isEnabled else { return }
        
        logger.info("📝 Processing text input: \(text)")
        await handleTranscription(text)
    }
    
    func updateConfiguration(_ config: VoiceAgentConfiguration) {
        configuration = config
        saveConfiguration()
        
        // Update context retention
        if !config.contextRetention {
            clearConversationContext()
        } else {
            trimContextIfNeeded()
        }
        
        logger.info("⚙️ Voice agent configuration updated")
    }
    
    func clearConversationContext() {
        conversationContext.removeAll()
        currentSessionId = UUID().uuidString
        logger.info("🗑️ Conversation context cleared")
    }
    
    func exportInteractionHistory() -> String {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = .prettyPrinted
        
        do {
            let data = try encoder.encode(interactionHistory)
            return String(data: data, encoding: .utf8) ?? "{}"
        } catch {
            logger.error("Failed to export interaction history: \(error)")
            return "Error exporting history: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Private Methods
    private func setupSubscriptions() {
        // Monitor STT state changes
        sttService.$recognitionState
            .sink { [weak self] sttState in
                Task { @MainActor in
                    self?.handleSTTStateChange(sttState)
                }
            }
            .store(in: &cancellables)
        
        // Monitor TTS state changes
        ttsService.$playbackState
            .sink { [weak self] ttsState in
                Task { @MainActor in
                    self?.handleTTSStateChange(ttsState)
                }
            }
            .store(in: &cancellables)
    }
    
    private func handleSTTStateChange(_ sttState: STTRecognitionState) {
        switch sttState {
        case .idle:
            if state == .listening {
                // STT finished, move to processing
                state = .processing
            }
        case .listening:
            state = .listening
        case .processing:
            state = .processing
        case .completed:
            // Handled by onComplete callback
            break
        case .error(let message):
            state = .error("Speech recognition error: \(message)")
        }
    }
    
    private func handleTTSStateChange(_ ttsState: TTSPlaybackState) {
        switch ttsState {
        case .playing:
            if state == .processing {
                state = .responding
            }
        case .idle:
            if state == .responding {
                state = .idle
            }
        case .error(let message):
            if state == .responding {
                state = .error("Speech synthesis error: \(message)")
            }
        default:
            break
        }
    }
    
    private func handlePartialTranscription(_ partial: String) {
        // Update current interaction with partial results
        if var interaction = currentInteraction {
            interaction = VoiceInteraction(
                userInput: partial,
                transcriptionConfidence: 0.5, // Lower confidence for partial
                timestamp: interaction.timestamp
            )
            currentInteraction = interaction
        }
    }
    
    private func handleTranscription(_ transcription: String) async {
        guard !transcription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            logger.warning("Empty transcription received")
            state = .idle
            return
        }
        
        logger.info("📝 Processing transcription: \(transcription)")
        state = .processing
        
        // Create interaction record
        let startTime = interactionStartTime ?? Date()
        let interaction = VoiceInteraction(
            userInput: transcription,
            transcriptionConfidence: 1.0,
            timestamp: startTime,
            duration: Date().timeIntervalSince(startTime)
        )
        currentInteraction = interaction
        
        // Check for voice commands first
        if let command = parseVoiceCommand(transcription) {
            await executeVoiceCommand(command)
            return
        }
        
        // Process based on interaction mode
        switch configuration.interactionMode {
        case .conversational, .assistant:
            await processConversationalInput(transcription)
        case .command:
            await processCommandInput(transcription)
        case .dictation:
            await processDictationInput(transcription)
        }
    }
    
    private func processConversationalInput(_ input: String) async {
        do {
            // Add user message to context
            let userMessage = Message(content: input, role: .user)
            if configuration.contextRetention {
                conversationContext.append(userMessage)
                trimContextIfNeeded()
            }
            
            // Get AI response
            let aiResponse: Message
            if await apiService.checkLocalLLMServerAvailable() {
                aiResponse = try await apiService.sendMessageToLocalLLM(
                    createContextualPrompt(input),
                    model: "llama3.2:latest"
                )
            } else {
                aiResponse = try await apiService.sendChatMessageWithFallback(
                    createContextualPrompt(input),
                    chatId: currentSessionId
                )
            }
            
            // Add AI response to context
            if configuration.contextRetention {
                conversationContext.append(aiResponse)
            }
            
            // Update interaction
            let finalInteraction = VoiceInteraction(
                userInput: input,
                aiResponse: aiResponse.content,
                timestamp: currentInteraction?.timestamp ?? Date(),
                duration: Date().timeIntervalSince(currentInteraction?.timestamp ?? Date()),
                successful: true
            )
            
            currentInteraction = finalInteraction
            interactionHistory.append(finalInteraction)
            
            // Speak response if enabled
            if configuration.autoTTSResponse && ttsService.isEnabled {
                await ttsService.speak(text: aiResponse.content)
            } else {
                state = .idle
            }
            
            logger.info("✅ Conversational interaction completed")
            
        } catch {
            logger.error("❌ Failed to process conversational input: \(error)")
            await handleInteractionError(error, for: input)
        }
    }
    
    private func processCommandInput(_ input: String) async {
        // Process as a single command
        logger.info("🔧 Processing command: \(input)")
        
        do {
            let response = try await apiService.sendChatMessageWithFallback(
                "Execute this command: \(input)",
                chatId: currentSessionId
            )
            
            let interaction = VoiceInteraction(
                userInput: input,
                aiResponse: response.content,
                timestamp: currentInteraction?.timestamp ?? Date(),
                duration: Date().timeIntervalSince(currentInteraction?.timestamp ?? Date()),
                successful: true
            )
            
            currentInteraction = interaction
            interactionHistory.append(interaction)
            
            if configuration.autoTTSResponse && ttsService.isEnabled {
                await ttsService.speak(text: response.content)
            } else {
                state = .idle
            }
            
        } catch {
            await handleInteractionError(error, for: input)
        }
    }
    
    private func processDictationInput(_ input: String) async {
        // Pure dictation - just record the input
        logger.info("📄 Processing dictation: \(input)")
        
        let interaction = VoiceInteraction(
            userInput: input,
            aiResponse: nil,
            timestamp: currentInteraction?.timestamp ?? Date(),
            duration: Date().timeIntervalSince(currentInteraction?.timestamp ?? Date()),
            successful: true
        )
        
        currentInteraction = interaction
        interactionHistory.append(interaction)
        state = .idle
        
        // Post notification for dictation result
        NotificationCenter.default.post(
            name: NSNotification.Name("VoiceDictationComplete"),
            object: nil,
            userInfo: ["text": input]
        )
    }
    
    private func createContextualPrompt(_ input: String) -> String {
        var prompt = configuration.conversationPersonality.systemPrompt + "\n\n"
        
        if configuration.contextRetention && !conversationContext.isEmpty {
            prompt += "Context from previous conversation:\n"
            
            // Add recent context messages
            let recentMessages = conversationContext.suffix(min(4, configuration.maxContextMessages))
            for message in recentMessages {
                let role = message.role == .user ? "User" : "Assistant"
                prompt += "\(role): \(message.content)\n"
            }
            prompt += "\n"
        }
        
        prompt += "Current user input: \(input)"
        
        return prompt
    }
    
    private func handleInteractionError(_ error: Error, for input: String) async {
        logger.error("❌ Interaction error: \(error)")
        
        let errorInteraction = VoiceInteraction(
            userInput: input,
            aiResponse: "Sorry, I encountered an error: \(error.localizedDescription)",
            timestamp: currentInteraction?.timestamp ?? Date(),
            duration: Date().timeIntervalSince(currentInteraction?.timestamp ?? Date()),
            successful: false
        )
        
        currentInteraction = errorInteraction
        interactionHistory.append(errorInteraction)
        
        state = .error(error.localizedDescription)
        
        // Optionally speak error message
        if configuration.autoTTSResponse && ttsService.isEnabled {
            await ttsService.speak(text: "Sorry, I encountered an error processing your request.")
        }
    }
    
    private func trimContextIfNeeded() {
        if conversationContext.count > configuration.maxContextMessages {
            let excess = conversationContext.count - configuration.maxContextMessages
            conversationContext.removeFirst(excess)
        }
    }
    
    // MARK: - Voice Commands
    private func parseVoiceCommand(_ input: String) -> VoiceCommand? {
        let lowercased = input.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Check for activation phrase
        if let activationPhrase = configuration.voiceActivationPhrase,
           !activationPhrase.isEmpty,
           !lowercased.contains(activationPhrase.lowercased()) {
            return nil
        }
        
        // Parse common voice commands
        if lowercased.contains("new chat") || lowercased.contains("start new conversation") {
            return .newChat
        } else if lowercased.contains("clear context") || lowercased.contains("forget conversation") {
            return .clearContext
        } else if lowercased.contains("stop listening") || lowercased.contains("stop recording") {
            return .stopListening
        } else if lowercased.contains("enable tts") || lowercased.contains("turn on speech") {
            return .enableTTS
        } else if lowercased.contains("disable tts") || lowercased.contains("turn off speech") {
            return .disableTTS
        } else if lowercased.contains("settings") || lowercased.contains("preferences") {
            return .openSettings
        }
        
        return nil
    }
    
    private func executeVoiceCommand(_ command: VoiceCommand) async {
        logger.info("🎯 Executing voice command: \(command)")
        
        let commandResult: String
        
        switch command {
        case .newChat:
            clearConversationContext()
            commandResult = "Started a new conversation"
            
        case .clearContext:
            clearConversationContext()
            commandResult = "Conversation context cleared"
            
        case .stopListening:
            stopVoiceInteraction()
            commandResult = "Stopped listening"
            
        case .enableTTS:
            if !ttsService.isEnabled {
                ttsService.toggleEnabled()
            }
            commandResult = "Text-to-speech enabled"
            
        case .disableTTS:
            if ttsService.isEnabled {
                ttsService.toggleEnabled()
            }
            commandResult = "Text-to-speech disabled"
            
        case .openSettings:
            // Post notification to open settings
            NotificationCenter.default.post(name: NSNotification.Name("OpenVoiceSettings"), object: nil)
            commandResult = "Opening voice settings"
        }
        
        // Create command interaction
        let commandInteraction = VoiceInteraction(
            userInput: command.rawValue,
            aiResponse: commandResult,
            timestamp: currentInteraction?.timestamp ?? Date(),
            duration: Date().timeIntervalSince(currentInteraction?.timestamp ?? Date()),
            successful: true
        )
        
        currentInteraction = commandInteraction
        interactionHistory.append(commandInteraction)
        
        // Speak confirmation if enabled
        if configuration.autoTTSResponse && ttsService.isEnabled {
            await ttsService.speak(text: commandResult)
        } else {
            state = .idle
        }
    }
    
    // MARK: - Configuration Persistence
    private func loadConfiguration() {
        let defaults = UserDefaults.standard
        
        // Load interaction mode
        if let modeString = defaults.string(forKey: "voice_agent_interaction_mode") {
            switch modeString {
            case "conversational":
                configuration.interactionMode = .conversational
            case "command":
                configuration.interactionMode = .command
            case "dictation":
                configuration.interactionMode = .dictation
            case "assistant":
                configuration.interactionMode = .assistant
            default:
                break
            }
        }
        
        // Load other settings
        configuration.autoTTSResponse = defaults.bool(forKey: "voice_agent_auto_tts")
        configuration.contextRetention = defaults.bool(forKey: "voice_agent_context_retention")
        configuration.maxContextMessages = defaults.integer(forKey: "voice_agent_max_context")
        
        if configuration.maxContextMessages == 0 {
            configuration.maxContextMessages = 10
        }
        
        let timeout = defaults.double(forKey: "voice_agent_response_timeout")
        if timeout > 0 {
            configuration.responseTimeout = timeout
        }
        
        configuration.enableSmartPunctuation = defaults.bool(forKey: "voice_agent_smart_punctuation")
        configuration.enableEmotionalTone = defaults.bool(forKey: "voice_agent_emotional_tone")
        configuration.voiceActivationPhrase = defaults.string(forKey: "voice_agent_activation_phrase")
        
        if let personalityString = defaults.string(forKey: "voice_agent_personality"),
           let personality = ConversationPersonality(rawValue: personalityString) {
            configuration.conversationPersonality = personality
        }
        
        isEnabled = defaults.bool(forKey: "voice_agent_enabled")
    }
    
    private func saveConfiguration() {
        let defaults = UserDefaults.standard
        
        let modeString: String
        switch configuration.interactionMode {
        case .conversational:
            modeString = "conversational"
        case .command:
            modeString = "command"
        case .dictation:
            modeString = "dictation"
        case .assistant:
            modeString = "assistant"
        }
        
        defaults.set(modeString, forKey: "voice_agent_interaction_mode")
        defaults.set(configuration.autoTTSResponse, forKey: "voice_agent_auto_tts")
        defaults.set(configuration.contextRetention, forKey: "voice_agent_context_retention")
        defaults.set(configuration.maxContextMessages, forKey: "voice_agent_max_context")
        defaults.set(configuration.responseTimeout, forKey: "voice_agent_response_timeout")
        defaults.set(configuration.enableSmartPunctuation, forKey: "voice_agent_smart_punctuation")
        defaults.set(configuration.enableEmotionalTone, forKey: "voice_agent_emotional_tone")
        defaults.set(configuration.voiceActivationPhrase, forKey: "voice_agent_activation_phrase")
        defaults.set(configuration.conversationPersonality.rawValue, forKey: "voice_agent_personality")
        defaults.set(isEnabled, forKey: "voice_agent_enabled")
    }
}

// MARK: - Voice Commands
enum VoiceCommand: String, CaseIterable {
    case newChat = "New Chat"
    case clearContext = "Clear Context"
    case stopListening = "Stop Listening"
    case enableTTS = "Enable TTS"
    case disableTTS = "Disable TTS"
    case openSettings = "Open Settings"
}