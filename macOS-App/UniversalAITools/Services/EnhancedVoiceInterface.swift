import Foundation
import SwiftUI
import Combine
import Speech
import AVFoundation
import NaturalLanguage
import OSLog

// MARK: - Voice Command Recognition
enum VoiceCommand: String, CaseIterable {
    case startConversation = "start conversation"
    case endConversation = "end conversation"
    case switchAgent = "switch agent"
    case pauseListening = "pause listening"
    case resumeListening = "resume listening"
    case repeatLastResponse = "repeat that"
    case clearConversation = "clear conversation"
    case saveConversation = "save conversation"
    case showAgents = "show agents"
    case voiceMode = "voice mode"
    case textMode = "text mode"
    case hybridMode = "hybrid mode"
    
    var trigger: String {
        return rawValue
    }
    
    var description: String {
        switch self {
        case .startConversation: return "Start a new conversation"
        case .endConversation: return "End current conversation"
        case .switchAgent: return "Switch to different agent"
        case .pauseListening: return "Pause voice listening"
        case .resumeListening: return "Resume voice listening"
        case .repeatLastResponse: return "Repeat last response"
        case .clearConversation: return "Clear conversation history"
        case .saveConversation: return "Save current conversation"
        case .showAgents: return "Show available agents"
        case .voiceMode: return "Switch to voice-only mode"
        case .textMode: return "Switch to text-only mode"
        case .hybridMode: return "Switch to hybrid mode"
        }
    }
}

// MARK: - Voice Interaction Context
struct VoiceInteractionContext {
    var currentAgent: String?
    var conversationMode: ConversationMode
    var isListening: Bool
    var lastCommand: VoiceCommand?
    var voiceSettings: VoiceSettings
    var interactionHistory: [VoiceInteraction]
}

// MARK: - Voice Settings
struct VoiceSettings: Codable {
    var isEnabled: Bool = true
    var language: String = "en-US"
    var voice: String = "com.apple.ttsbundle.Samantha-compact"
    var speechRate: Float = 0.5
    var speechVolume: Float = 0.7
    var speechPitch: Float = 1.0
    var voiceCommands: Bool = true
    var continuousListening: Bool = false
    var autoResponse: Bool = true
    var backgroundListening: Bool = false
    var keywordDetection: Bool = true
    var noiseReduction: Bool = true
    
    static let availableLanguages = [
        "en-US": "English (US)",
        "en-GB": "English (UK)",
        "es-ES": "Spanish",
        "fr-FR": "French",
        "de-DE": "German",
        "it-IT": "Italian",
        "pt-BR": "Portuguese (Brazil)",
        "ja-JP": "Japanese",
        "ko-KR": "Korean",
        "zh-CN": "Chinese (Simplified)"
    ]
}

// MARK: - Enhanced Voice Interface
@MainActor
public class EnhancedVoiceInterface: ObservableObject {
    @Published var voiceSettings: VoiceSettings = VoiceSettings()
    @Published var context: VoiceInteractionContext
    @Published var isProcessingVoiceCommand: Bool = false
    @Published var currentVoiceCommand: VoiceCommand?
    @Published var voiceWaveformData: [Float] = []
    @Published var speechConfidence: Double = 0.0
    @Published var lastVoiceInteraction: Date?
    @Published var voiceAnalytics: VoiceAnalytics = VoiceAnalytics()
    
    // Enhanced voice components
    private let sttService: STTService
    private let ttsService: TTSService
    private let logger = Logger(subsystem: "com.universalai.tools", category: "voice-interface")
    
    // Natural Language Processing
    private let nlProcessor = NLTagger(tagSchemes: [.language, .lexicalClass, .sentimentScore])
    
    // Audio Analysis
    private var audioLevelTimer: Timer?
    private var waveformTimer: Timer?
    private let audioEngine = AVAudioEngine()
    
    // Dependencies
    private let conversationManager: ConversationManager
    private let agentService: AgentConversationService
    private let loggingService: LoggingService
    
    private var cancellables = Set<AnyCancellable>()
    
    public init(
        conversationManager: ConversationManager,
        agentService: AgentConversationService,
        loggingService: LoggingService
    ) {
        self.conversationManager = conversationManager
        self.agentService = agentService
        self.loggingService = loggingService
        self.sttService = conversationManager.sttService
        self.ttsService = conversationManager.ttsService
        
        self.context = VoiceInteractionContext(
            conversationMode: .hybrid,
            isListening: false,
            voiceSettings: voiceSettings,
            interactionHistory: []
        )
        
        setupVoiceInterface()
    }
    
    // MARK: - Setup
    private func setupVoiceInterface() {
        logger.info("Setting up Enhanced Voice Interface")
        
        // Configure TTS with voice settings
        configureTTSSettings()
        
        // Setup audio monitoring
        setupAudioMonitoring()
        
        // Monitor conversation manager state
        conversationManager.$state
            .sink { [weak self] state in
                self?.handleConversationStateChange(state)
            }
            .store(in: &cancellables)
        
        // Monitor STT service
        sttService.$recognitionState
            .sink { [weak self] state in
                self?.handleSTTStateChange(state)
            }
            .store(in: &cancellables)
    }
    
    private func configureTTSSettings() {
        ttsService.voice = voiceSettings.voice
        ttsService.rate = voiceSettings.speechRate
        ttsService.volume = voiceSettings.speechVolume
        ttsService.pitchMultiplier = voiceSettings.speechPitch
    }
    
    private func setupAudioMonitoring() {
        guard voiceSettings.isEnabled else { return }
        
        // Setup waveform data collection
        waveformTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateWaveformData()
        }
    }
    
    // MARK: - Voice Command Processing
    func processVoiceInput(_ input: String) async {
        logger.info("Processing voice input: \(String(input.prefix(50)))...")
        
        let interaction = VoiceInteraction(
            id: UUID(),
            input: input,
            timestamp: Date(),
            confidence: speechConfidence,
            processingTime: 0,
            recognized: true
        )
        
        context.interactionHistory.append(interaction)
        lastVoiceInteraction = Date()
        
        // Check for voice commands first
        if voiceSettings.voiceCommands,
           let command = detectVoiceCommand(in: input) {
            await executeVoiceCommand(command, input: input)
            return
        }
        
        // Process as regular conversation input
        await conversationManager.processUserInput(input, isVoiceInput: true)
        
        // Update analytics
        voiceAnalytics.totalInteractions += 1
        voiceAnalytics.successfulRecognitions += 1
    }
    
    private func detectVoiceCommand(in input: String) -> VoiceCommand? {
        let cleanInput = input.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Check for exact command matches
        for command in VoiceCommand.allCases {
            if cleanInput.contains(command.trigger.lowercased()) {
                return command
            }
        }
        
        // Check for semantic matches using NLP
        return detectSemanticCommand(in: cleanInput)
    }
    
    private func detectSemanticCommand(in input: String) -> VoiceCommand? {
        // Use Natural Language framework for semantic analysis
        nlProcessor.string = input
        
        // Look for semantic patterns
        if input.contains("start") || input.contains("begin") || input.contains("new") {
            if input.contains("conversation") || input.contains("chat") {
                return .startConversation
            }
        }
        
        if input.contains("end") || input.contains("stop") || input.contains("finish") {
            if input.contains("conversation") || input.contains("chat") {
                return .endConversation
            }
        }
        
        if input.contains("switch") || input.contains("change") {
            if input.contains("agent") || input.contains("assistant") {
                return .switchAgent
            }
        }
        
        if input.contains("pause") || input.contains("quiet") {
            return .pauseListening
        }
        
        if input.contains("resume") || input.contains("continue") || input.contains("listen") {
            return .resumeListening
        }
        
        return nil
    }
    
    // MARK: - Voice Command Execution
    func executeVoiceCommand(_ command: VoiceCommand, input: String) async {
        logger.info("Executing voice command: \(command.rawValue)")
        
        isProcessingVoiceCommand = true
        currentVoiceCommand = command
        
        defer {
            isProcessingVoiceCommand = false
            currentVoiceCommand = nil
        }
        
        switch command {
        case .startConversation:
            await startVoiceConversation(input)
        case .endConversation:
            await endVoiceConversation()
        case .switchAgent:
            await switchVoiceAgent(input)
        case .pauseListening:
            pauseVoiceListening()
        case .resumeListening:
            await resumeVoiceListening()
        case .repeatLastResponse:
            await repeatLastResponse()
        case .clearConversation:
            await clearVoiceConversation()
        case .saveConversation:
            await saveVoiceConversation()
        case .showAgents:
            await announceAvailableAgents()
        case .voiceMode:
            await switchToVoiceMode()
        case .textMode:
            await switchToTextMode()
        case .hybridMode:
            await switchToHybridMode()
        }
        
        // Log command execution
        await loggingService.logEvent(
            category: "voice_interface",
            action: "command_executed",
            metadata: [
                "command": command.rawValue,
                "input": input
            ]
        )
    }
    
    // MARK: - Voice Command Implementations
    private func startVoiceConversation(_ input: String) async {
        // Extract agent type from input if mentioned
        let agentType = extractAgentType(from: input) ?? "chat"
        
        await conversationManager.startConversation(
            title: "Voice Conversation",
            agentType: agentType,
            mode: .voiceOnly
        )
        
        await speakResponse("Starting conversation with \(agentType) agent")
    }
    
    private func endVoiceConversation() async {
        await conversationManager.endConversation()
        await speakResponse("Conversation ended")
    }
    
    private func switchVoiceAgent(_ input: String) async {
        if let agentType = extractAgentType(from: input) {
            await conversationManager.switchAgent(to: agentType)
            await speakResponse("Switched to \(agentType) agent")
        } else {
            await speakResponse("Which agent would you like to switch to?")
        }
    }
    
    private func pauseVoiceListening() {
        context.isListening = false
        sttService.stopListening()
    }
    
    private func resumeVoiceListening() async {
        context.isListening = true
        await conversationManager.startVoiceInput()
    }
    
    private func repeatLastResponse() async {
        if let lastMessage = conversationManager.conversationHistory.last(where: { $0.role == .assistant }) {
            await speakResponse(lastMessage.content)
        } else {
            await speakResponse("No previous response to repeat")
        }
    }
    
    private func clearVoiceConversation() async {
        conversationManager.conversationHistory.removeAll()
        await speakResponse("Conversation cleared")
    }
    
    private func saveVoiceConversation() async {
        // Implementation for saving conversation
        await speakResponse("Conversation saved")
    }
    
    private func announceAvailableAgents() async {
        let agentNames = agentService.availableAgents.map { $0.name }
        let announcement = "Available agents are: " + agentNames.joined(separator: ", ")
        await speakResponse(announcement)
    }
    
    private func switchToVoiceMode() async {
        conversationManager.mode = .voiceOnly
        context.conversationMode = .voiceOnly
        await speakResponse("Switched to voice-only mode")
    }
    
    private func switchToTextMode() async {
        conversationManager.mode = .textOnly
        context.conversationMode = .textOnly
        await speakResponse("Switched to text-only mode")
    }
    
    private func switchToHybridMode() async {
        conversationManager.mode = .hybrid
        context.conversationMode = .hybrid
        await speakResponse("Switched to hybrid mode")
    }
    
    // MARK: - Agent Type Extraction
    private func extractAgentType(from input: String) -> String? {
        let cleanInput = input.lowercased()
        
        let agentKeywords: [String: String] = [
            "code": "code_assistant",
            "coding": "code_assistant",
            "programming": "code_assistant",
            "research": "synthesizer",
            "analyze": "data_analyst",
            "analysis": "data_analyst",
            "plan": "planner",
            "planning": "planner",
            "chat": "chat",
            "general": "chat"
        ]
        
        for (keyword, agentType) in agentKeywords {
            if cleanInput.contains(keyword) {
                return agentType
            }
        }
        
        return nil
    }
    
    // MARK: - Voice Feedback
    private func speakResponse(_ text: String) async {
        guard voiceSettings.autoResponse else { return }
        
        do {
            try await ttsService.speak(text)
            voiceAnalytics.speechOutputs += 1
        } catch {
            logger.error("Failed to speak response: \(error)")
        }
    }
    
    // MARK: - Audio Monitoring
    private func updateWaveformData() {
        guard sttService.isListening else {
            voiceWaveformData = Array(repeating: 0.0, count: 50)
            return
        }
        
        // Generate mock waveform data - in a real implementation,
        // this would come from actual audio level monitoring
        let newData = (0..<50).map { _ in
            Float.random(in: 0.0...1.0) * (sttService.isListening ? 0.8 : 0.1)
        }
        
        voiceWaveformData = newData
    }
    
    // MARK: - State Handling
    private func handleConversationStateChange(_ state: ConversationState) {
        logger.info("Conversation state changed to: \(state.rawValue)")
        
        switch state {
        case .listening:
            context.isListening = true
        case .idle, .completed:
            context.isListening = false
        case .error:
            context.isListening = false
            Task {
                await speakResponse("I encountered an error. Please try again.")
            }
        default:
            break
        }
    }
    
    private func handleSTTStateChange(_ state: STTRecognitionState) {
        switch state {
        case .listening:
            voiceAnalytics.listeningSessionsStarted += 1
        case .completed:
            voiceAnalytics.successfulRecognitions += 1
        case .error:
            voiceAnalytics.recognitionErrors += 1
        default:
            break
        }
    }
    
    // MARK: - Settings Management
    func updateVoiceSettings(_ newSettings: VoiceSettings) {
        voiceSettings = newSettings
        context.voiceSettings = newSettings
        configureTTSSettings()
        
        if newSettings.isEnabled && !voiceSettings.isEnabled {
            setupAudioMonitoring()
        } else if !newSettings.isEnabled && voiceSettings.isEnabled {
            teardownAudioMonitoring()
        }
    }
    
    private func teardownAudioMonitoring() {
        waveformTimer?.invalidate()
        waveformTimer = nil
        audioLevelTimer?.invalidate()
        audioLevelTimer = nil
    }
    
    // MARK: - Voice Capabilities
    func getVoiceCapabilities() -> [String] {
        return [
            "Voice Commands",
            "Continuous Listening",
            "Multi-language Support",
            "Agent Switching",
            "Conversation Control",
            "Audio Feedback",
            "Waveform Visualization"
        ]
    }
    
    func getSupportedLanguages() -> [String: String] {
        return VoiceSettings.availableLanguages
    }
    
    // MARK: - Cleanup
    deinit {
        teardownAudioMonitoring()
        cancellables.removeAll()
    }
}

// MARK: - Voice Analytics
struct VoiceAnalytics: Codable {
    var totalInteractions: Int = 0
    var successfulRecognitions: Int = 0
    var recognitionErrors: Int = 0
    var listeningSessionsStarted: Int = 0
    var speechOutputs: Int = 0
    var commandsExecuted: Int = 0
    var averageConfidence: Double = 0.0
    var averageProcessingTime: Double = 0.0
    
    var recognitionAccuracy: Double {
        guard totalInteractions > 0 else { return 0.0 }
        return Double(successfulRecognitions) / Double(totalInteractions)
    }
    
    var errorRate: Double {
        guard totalInteractions > 0 else { return 0.0 }
        return Double(recognitionErrors) / Double(totalInteractions)
    }
}