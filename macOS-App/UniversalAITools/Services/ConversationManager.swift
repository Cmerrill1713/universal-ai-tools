import Foundation
import SwiftUI
import Combine
import Speech
import AVFoundation
import OSLog

// MARK: - Conversation State
enum ConversationState: String, CaseIterable {
    case idle = "idle"
    case listening = "listening"
    case processing = "processing"
    case responding = "responding"
    case completed = "completed"
    case error = "error"
    
    var description: String {
        switch self {
        case .idle: return "Ready"
        case .listening: return "Listening..."
        case .processing: return "Processing..."
        case .responding: return "Responding..."
        case .completed: return "Completed"
        case .error: return "Error"
        }
    }
}

// ConversationMode and ConversationSession are now defined in ConversationModels.swift

// MARK: - Conversation Manager
@MainActor
public class ConversationManager: ObservableObject {
    @Published var currentSession: ConversationSession?
    @Published var state: ConversationState = .idle
    @Published var mode: ConversationMode = .hybrid
    @Published var isVoiceEnabled: Bool = true
    @Published var sessions: [ConversationSession] = []
    @Published var conversationHistory: [Message] = []
    @Published var currentAgent: String?
    @Published var errorMessage: String?
    
    // Voice components
    @Published var sttService: STTService
    @Published var ttsService: TTSService
    
    // Services
    private let apiService: APIService
    private let loggingService: LoggingService
    private let monitoringService: MonitoringService
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "conversation")
    private var cancellables = Set<AnyCancellable>()
    
    // Conversation analytics
    @Published var conversationMetrics: ConversationMetrics = ConversationMetrics()
    
    public init(
        apiService: APIService,
        loggingService: LoggingService,
        monitoringService: MonitoringService
    ) {
        self.apiService = apiService
        self.loggingService = loggingService
        self.monitoringService = monitoringService
        self.sttService = STTService()
        self.ttsService = TTSService()
        
        setupConversationManager()
    }
    
    // MARK: - Setup
    private func setupConversationManager() {
        logger.info("Setting up ConversationManager")
        
        // Initialize voice services
        Task {
            await setupVoiceServices()
        }
        
        // Monitor conversation state changes
        $state
            .sink { [weak self] newState in
                self?.handleStateChange(newState)
            }
            .store(in: &cancellables)
    }
    
    private func setupVoiceServices() async {
        do {
            await sttService.requestAuthorization()
            logger.info("Voice services initialized successfully")
        } catch {
            logger.error("Failed to initialize voice services: \(error)")
            errorMessage = "Voice services unavailable: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Session Management
    func startConversation(
        title: String,
        agentType: String,
        mode: ConversationMode = .hybrid,
        context: [String: String] = [:]
    ) async {
        logger.info("Starting conversation with agent: \(agentType)")
        
        let session = ConversationSession(
            title: title,
            agentType: agentType,
            mode: mode,
            context: context
        )
        
        currentSession = session
        currentAgent = agentType
        self.mode = mode
        state = .idle
        conversationHistory = []
        
        sessions.append(session)
        
        // Log conversation start
        await loggingService.logEvent(
            category: "conversation",
            action: "session_start",
            metadata: [
                "agent_type": agentType,
                "mode": mode.rawValue,
                "session_id": session.id.uuidString
            ]
        )
        
        // Update metrics
        conversationMetrics.sessionsStarted += 1
    }
    
    func endConversation() async {
        guard var session = currentSession else { return }
        
        session.isActive = false
        session.endTime = Date()
        session.messageCount = conversationHistory.count
        
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
        }
        
        // Log conversation end
        await loggingService.logEvent(
            category: "conversation",
            action: "session_end",
            metadata: [
                "session_id": session.id.uuidString,
                "duration": "\(session.endTime?.timeIntervalSince(session.startTime) ?? 0)",
                "message_count": "\(session.messageCount)"
            ]
        )
        
        currentSession = nil
        currentAgent = nil
        state = .idle
        
        // Update metrics
        conversationMetrics.sessionsCompleted += 1
    }
    
    // MARK: - Message Processing
    func processUserInput(_ input: String, isVoiceInput: Bool = false) async {
        guard let session = currentSession else {
            logger.error("No active conversation session")
            return
        }
        
        state = .processing
        
        // Create user message
        let userMessage = Message(
            id: UUID(),
            role: .user,
            content: input,
            timestamp: Date()
        )
        
        conversationHistory.append(userMessage)
        
        // Log user input
        await loggingService.logEvent(
            category: "conversation",
            action: "user_input",
            metadata: [
                "session_id": session.id.uuidString,
                "input_type": isVoiceInput ? "voice" : "text",
                "agent": currentAgent ?? "unknown"
            ]
        )
        
        do {
            state = .responding
            
            // Send to appropriate agent
            let response = try await sendToAgent(input, agentType: session.agentType)
            
            // Create assistant message
            let assistantMessage = Message(
                id: UUID(),
                role: .assistant,
                content: response,
                timestamp: Date()
            )
            
            conversationHistory.append(assistantMessage)
            
            // Handle voice output if enabled
            if mode != .textOnly && isVoiceEnabled {
                await speakResponse(response)
            }
            
            state = .completed
            
            // Update metrics
            conversationMetrics.messagesProcessed += 1
            if isVoiceInput {
                conversationMetrics.voiceInteractions += 1
            }
            
        } catch {
            logger.error("Failed to process user input: \(error)")
            errorMessage = error.localizedDescription
            state = .error
        }
    }
    
    private func sendToAgent(_ input: String, agentType: String) async throws -> String {
        // Route to appropriate agent based on type
        switch agentType {
        case "chat":
            return try await apiService.sendChatMessage(
                input,
                chatId: currentSession?.id.uuidString ?? ""
            ).content
        case "research":
            return try await sendToSpecializedAgent(input, endpoint: "/api/v1/agents/research")
        case "coding":
            return try await sendToSpecializedAgent(input, endpoint: "/api/v1/agents/code_assistant")
        case "analysis":
            return try await sendToSpecializedAgent(input, endpoint: "/api/v1/agents/analysis")
        default:
            return try await apiService.sendChatMessage(
                input,
                chatId: currentSession?.id.uuidString ?? ""
            ).content
        }
    }
    
    private func sendToSpecializedAgent(_ input: String, endpoint: String) async throws -> String {
        // Implementation for specialized agent communication
        // This would connect to the backend's specialized agent endpoints
        let url = URL(string: "http://localhost:9999\(endpoint)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload = [
            "message": input,
            "session_id": currentSession?.id.uuidString ?? "",
            "context": currentSession?.context ?? [:]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        
        return response?["response"] as? String ?? "No response"
    }
    
    // MARK: - Voice Processing
    func startVoiceInput() async {
        guard mode != .textOnly, isVoiceEnabled else { return }
        
        state = .listening
        
        do {
            try await sttService.startListening(
                onComplete: { [weak self] transcription in
                    Task { @MainActor in
                        await self?.processUserInput(transcription, isVoiceInput: true)
                    }
                },
                onPartial: { [weak self] partial in
                    Task { @MainActor in
                        // Update UI with partial transcription
                        self?.logger.debug("Partial transcription: \(partial)")
                    }
                }
            )
        } catch {
            logger.error("Failed to start voice input: \(error)")
            errorMessage = error.localizedDescription
            state = .error
        }
    }
    
    func stopVoiceInput() {
        sttService.stopListening()
        if state == .listening {
            state = .idle
        }
    }
    
    private func speakResponse(_ response: String) async {
        guard ttsService.isEnabled else { return }
        
        do {
            try await ttsService.speak(response)
            conversationMetrics.speechOutputs += 1
        } catch {
            logger.error("Failed to speak response: \(error)")
        }
    }
    
    // MARK: - Agent Switching
    func switchAgent(to agentType: String) async {
        guard var session = currentSession else { return }
        
        logger.info("Switching agent from \(session.agentType) to \(agentType)")
        
        session.agentType = agentType
        currentAgent = agentType
        currentSession = session
        
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
        }
        
        // Log agent switch
        await loggingService.logEvent(
            category: "conversation",
            action: "agent_switch",
            metadata: [
                "session_id": session.id.uuidString,
                "new_agent": agentType
            ]
        )
        
        // Add system message about agent switch
        let systemMessage = Message(
            id: UUID(),
            role: .system,
            content: "Switched to \(agentType) agent",
            timestamp: Date()
        )
        
        conversationHistory.append(systemMessage)
    }
    
    // MARK: - Context Management
    func updateContext(_ key: String, value: String) {
        currentSession?.context[key] = value
        
        if let session = currentSession,
           let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
        }
    }
    
    func getContext(_ key: String) -> String? {
        return currentSession?.context[key]
    }
    
    // MARK: - State Handling
    private func handleStateChange(_ newState: ConversationState) {
        logger.info("Conversation state changed to: \(newState.rawValue)")
        
        Task {
            await monitoringService.updateMetric(
                name: "conversation_state",
                value: newState.rawValue
            )
        }
    }
    
    // MARK: - Error Handling
    func clearError() {
        errorMessage = nil
        if state == .error {
            state = .idle
        }
    }
    
    // MARK: - Session Restoration
    func restoreSession(_ sessionId: UUID) {
        if let session = sessions.first(where: { $0.id == sessionId }) {
            currentSession = session
            currentAgent = session.agentType
            mode = session.mode
            state = .idle
            
            // Restore conversation history if needed
            // This would typically load from persistent storage
            logger.info("Restored session: \(sessionId)")
        }
    }
}

// MARK: - Conversation Metrics
struct ConversationMetrics: Codable {
    var sessionsStarted: Int = 0
    var sessionsCompleted: Int = 0
    var messagesProcessed: Int = 0
    var voiceInteractions: Int = 0
    var speechOutputs: Int = 0
    var averageSessionDuration: Double = 0.0
    var errorCount: Int = 0
    
    var completionRate: Double {
        guard sessionsStarted > 0 else { return 0.0 }
        return Double(sessionsCompleted) / Double(sessionsStarted)
    }
    
    var voiceUsageRate: Double {
        guard messagesProcessed > 0 else { return 0.0 }
        return Double(voiceInteractions) / Double(messagesProcessed)
    }
}

// MARK: - Conversation Manager Extensions
extension ConversationManager {
    // Quick actions for common conversation patterns
    func startQuickChat() async {
        await startConversation(
            title: "Quick Chat",
            agentType: "chat",
            mode: .hybrid
        )
    }
    
    func startCodeAssistance() async {
        await startConversation(
            title: "Code Assistant",
            agentType: "coding",
            mode: .textOnly
        )
    }
    
    func startResearchSession() async {
        await startConversation(
            title: "Research Session",
            agentType: "research",
            mode: .hybrid
        )
    }
}