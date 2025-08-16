import SwiftUI
import Combine
import OSLog

// MARK: - Conversation View
struct ConversationView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @EnvironmentObject var loggingService: LoggingService
    @EnvironmentObject var monitoringService: MonitoringService
    @EnvironmentObject var serviceContainer: ServiceContainer
    
    @State private var messageText = ""
    @State private var showAgentSelector = false
    @State private var showVoiceSettings = false
    @State private var showConversationSettings = false
    @State private var selectedAgent: UniversalAIAgent?
    @State private var isRecording = false
    @State private var animationPhase: CGFloat = 0.0
    
    @FocusState private var isInputFocused: Bool
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "conversation-view")
    
    // Access services through ServiceContainer
    private var conversationManager: ConversationManager {
        serviceContainer.conversationManager
    }
    
    private var agentService: AgentConversationService {
        serviceContainer.agentService
    }
    
    private var voiceInterface: EnhancedVoiceInterface {
        serviceContainer.voiceInterface
    }
    
    var body: some View {
        GeometryReader { _ in
            ZStack {
                // Background
                AppTheme.primaryBackground
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Header
                    conversationHeader
                        .padding(.top, 8)
                    
                    // Conversation Content
                    conversationContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    
                    // Input Area
                    conversationInput
                        .padding(.bottom, 8)
                }
            }
        }
        .navigationTitle("Conversation")
        .onAppear {
            setupConversation()
        }
        .onChange(of: conversationManager.currentSession) { _, session in
            if let session = session {
                logger.info("Active conversation session: \(session.title)")
            }
        }
    }
    
    // MARK: - Header
    private var conversationHeader: some View {
        HStack {
            // Agent Selector
            AgentSelectorButton(
                selectedAgent: selectedAgent,
                showSelector: $showAgentSelector,
                agents: agentService.availableAgents
            ) { agent in
                selectAgent(agent)
            }
            
            Spacer()
            
            // Conversation Info
            if let session = conversationManager.currentSession {
                VStack(alignment: .center, spacing: 2) {
                    Text(session.title)
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    HStack(spacing: 8) {
                        ConversationStateDot(state: conversationManager.state)
                        
                        Text(conversationManager.state.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        if let agent = selectedAgent {
                            Text("• \(agent.name)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            
            Spacer()
            
            // Action Buttons
            HStack(spacing: 12) {
                VoiceControlButton(
                    isRecording: $isRecording,
                    voiceInterface: voiceInterface,
                    conversationManager: conversationManager
                )
                
                Button(action: { showVoiceSettings.toggle() }) {
                    Image(systemName: "speaker.wave.2")
                        .font(.title3)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .popover(isPresented: $showVoiceSettings) {
                    VoiceSettingsView(voiceInterface: voiceInterface)
                        .frame(width: 350, height: 400)
                }
                
                Button(action: { showConversationSettings.toggle() }) {
                    Image(systemName: "gearshape")
                        .font(.title3)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .popover(isPresented: $showConversationSettings) {
                    ConversationSettingsView(conversationManager: conversationManager)
                        .frame(width: 300, height: 350)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }
    
    // MARK: - Content (Performance Optimized)
    private var conversationContent: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 16) {
                    if conversationManager.conversationHistory.isEmpty {
                        emptyStateView
                            .onAppear {
                                // Preload common UI elements for better performance
                                Task { @MainActor in
                                    await preloadUIElements()
                                }
                            }
                    } else {
                        ForEach(conversationManager.conversationHistory) { message in
                            OptimizedMessageBubble(
                                message: message,
                                agent: selectedAgent,
                                voiceInterface: voiceInterface
                            )
                            .id(message.id)
                            .onAppear {
                                // Lazy load message attachments/media only when visible
                                if !message.attachments.isEmpty {
                                    Task {
                                        await preloadMessageAttachments(for: message)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .onChange(of: conversationManager.conversationHistory.count) { _, _ in
                // Optimize scroll animation - reduce duration and only animate when necessary
                if let lastMessage = conversationManager.conversationHistory.last,
                   !conversationManager.conversationHistory.isEmpty {
                    // Debounced scroll to avoid excessive animations
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation(.easeOut(duration: 0.3)) {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .memoryPressureWarning)) { _ in
            // Respond to memory pressure by clearing message caches
            Task { @MainActor in
                await clearMessageCaches()
            }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 24) {
            // Animated conversation icon
            ZStack {
                Circle()
                    .fill(LinearGradient(
                        colors: [.blue.opacity(0.1), .purple.opacity(0.1)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 120, height: 120)
                    .scaleEffect(1.0 + sin(animationPhase) * 0.05)
                
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 40, weight: .light))
                    .foregroundColor(.blue)
                    .rotationEffect(.degrees(sin(animationPhase) * 2))
            }
            .onAppear {
                withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                    animationPhase = .pi * 2
                }
            }
            
            VStack(spacing: 12) {
                Text("Start a Conversation")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                
                Text("Choose an AI agent and begin your conversation using voice or text")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
            }
            
            // Quick start buttons
            HStack(spacing: 16) {
                QuickStartButton(
                    title: "Quick Chat",
                    icon: "text.bubble",
                    color: .blue
                ) {
                    Task {
                        await conversationManager.startQuickChat()
                        selectedAgent = agentService.getAgentById("chat")
                    }
                }
                
                QuickStartButton(
                    title: "Code Help",
                    icon: "chevron.left.forwardslash.chevron.right",
                    color: .purple
                ) {
                    Task {
                        await conversationManager.startCodeAssistance()
                        selectedAgent = agentService.getAgentById("code_assistant")
                    }
                }
                
                QuickStartButton(
                    title: "Research",
                    icon: "magnifyingglass",
                    color: .green
                ) {
                    Task {
                        await conversationManager.startResearchSession()
                        selectedAgent = agentService.getAgentById("synthesizer")
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 60)
    }
    
    // MARK: - Input
    private var conversationInput: some View {
        VStack(spacing: 12) {
            // Voice Waveform (when recording)
            if isRecording && voiceInterface.voiceSettings.isEnabled {
                VoiceWaveformView(
                    waveformData: voiceInterface.voiceWaveformData,
                    isRecording: isRecording
                )
                .frame(height: 60)
                .padding(.horizontal, 20)
            }
            
            // Text Input
            HStack(spacing: 12) {
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(.ultraThinMaterial)
                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    
                    HStack(alignment: .bottom, spacing: 12) {
                        // Text Field
                        TextField("Type your message...", text: $messageText, axis: .vertical)
                            .textFieldStyle(.plain)
                            .focused($isInputFocused)
                            .font(.body)
                            .lineLimit(1...5)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .onSubmit {
                                sendMessage()
                            }
                        
                        // Voice Recording Button
                        VoiceInputButton(
                            isRecording: $isRecording,
                            voiceInterface: voiceInterface,
                            conversationManager: conversationManager
                        )
                        .padding(.trailing, 8)
                        .padding(.bottom, 8)
                    }
                }
                .frame(minHeight: 44)
                
                // Send Button
                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(messageText.isEmpty ? .gray : .blue)
                }
                .buttonStyle(.plain)
                .disabled(messageText.isEmpty || conversationManager.state == .processing)
            }
            .padding(.horizontal, 20)
        }
    }
    
    // MARK: - Actions
    private func setupConversation() {
        logger.info("Setting up conversation view")
        
        // Auto-focus input field
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            isInputFocused = true
        }
    }
    
    private func selectAgent(_ agent: UniversalAIAgent) {
        selectedAgent = agent
        showAgentSelector = false
        
        Task {
            if conversationManager.currentSession == nil {
                await conversationManager.startConversation(
                    title: "Conversation with \(agent.name)",
                    agentType: agent.id,
                    mode: conversationManager.mode
                )
            } else {
                await conversationManager.switchAgent(to: agent.id)
            }
        }
    }
    
    private func sendMessage() {
        guard !messageText.isEmpty else { return }
        
        let message = messageText
        messageText = ""
        
        Task {
            await conversationManager.processUserInput(message, isVoiceInput: false)
        }
    }
    
    // MARK: - Performance Optimization Methods
    
    @MainActor
    private func preloadUIElements() async {
        // Preload common UI elements to improve responsiveness
        await serviceContainer.conversationManager.preloadCommonResponses()
        await serviceContainer.voiceInterface.preloadVoiceSettings()
    }
    
    private func preloadMessageAttachments(for message: ConversationMessage) async {
        // Implement lazy loading for message attachments
        for attachment in message.attachments {
            await serviceContainer.attachmentManager.preloadAttachment(attachment.id)
        }
    }
    
    @MainActor
    private func clearMessageCaches() async {
        // Clear non-essential caches to free memory
        await serviceContainer.cacheManager.clearMessageImageCache()
        await serviceContainer.cacheManager.clearThumbnailCache()
        
        // Log memory cleanup
        logger.info("Message caches cleared due to memory pressure")
    }
}

// MARK: - Supporting Views

struct ConversationStateDot: View {
    let state: ConversationState
    
    var body: some View {
        Circle()
            .fill(stateColor)
            .frame(width: 8, height: 8)
            .scaleEffect(state == .listening ? 1.2 : 1.0)
            .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: state == .listening)
    }
    
    private var stateColor: Color {
        switch state {
        case .idle: return .gray
        case .listening: return .red
        case .processing: return .orange
        case .responding: return .blue
        case .completed: return .green
        case .error: return .red
        }
    }
}

struct AgentSelectorButton: View {
    let selectedAgent: UniversalAIAgent?
    @Binding var showSelector: Bool
    let agents: [UniversalAIAgent]
    let onSelect: (UniversalAIAgent) -> Void
    
    var body: some View {
        Button(action: { showSelector.toggle() }) {
            HStack(spacing: 8) {
                // Agent icon
                Image(systemName: selectedAgent?.type.icon ?? "brain.head.profile")
                    .font(.title3)
                    .foregroundColor(selectedAgent?.type.color ?? .gray)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(selectedAgent?.name ?? "Select Agent")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                    
                    if let agent = selectedAgent {
                        Text(agent.type.displayName)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Image(systemName: "chevron.down")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
        .popover(isPresented: $showSelector) {
            AgentSelectionView(
                agents: agents,
                selectedAgent: selectedAgent,
                onSelect: onSelect
            )
            .frame(width: 300, height: 400)
        }
    }
}

struct QuickStartButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
            }
            .frame(width: 80, height: 60)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

struct VoiceControlButton: View {
    @Binding var isRecording: Bool
    let voiceInterface: EnhancedVoiceInterface
    let conversationManager: ConversationManager
    
    var body: some View {
        Button(action: toggleVoiceRecording) {
            Image(systemName: isRecording ? "mic.fill" : "mic")
                .font(.title3)
                .foregroundColor(isRecording ? .red : .secondary)
                .scaleEffect(isRecording ? 1.1 : 1.0)
                .animation(.easeInOut(duration: 0.2), value: isRecording)
        }
        .buttonStyle(.plain)
        .disabled(!voiceInterface.voiceSettings.isEnabled)
    }
    
    private func toggleVoiceRecording() {
        if isRecording {
            conversationManager.stopVoiceInput()
        } else {
            Task {
                await conversationManager.startVoiceInput()
            }
        }
        isRecording.toggle()
    }
}

struct VoiceInputButton: View {
    @Binding var isRecording: Bool
    let voiceInterface: EnhancedVoiceInterface
    let conversationManager: ConversationManager
    
    var body: some View {
        Button(action: toggleVoiceInput) {
            ZStack {
                Circle()
                    .fill(isRecording ? Color.red.opacity(0.2) : Color.blue.opacity(0.1))
                    .frame(width: 32, height: 32)
                
                Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(isRecording ? .red : .blue)
            }
        }
        .buttonStyle(.plain)
        .disabled(!voiceInterface.voiceSettings.isEnabled)
        .scaleEffect(isRecording ? 1.1 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isRecording)
    }
    
    private func toggleVoiceInput() {
        if isRecording {
            conversationManager.stopVoiceInput()
        } else {
            Task {
                await conversationManager.startVoiceInput()
            }
        }
        isRecording.toggle()
    }
}

// MARK: - Preview
struct ConversationView_Previews: PreviewProvider {
    static var previews: some View {
        ConversationView()
            .environmentObject(AppState())
            .environmentObject(APIService())
            .environmentObject(LoggingService())
            .environmentObject(MonitoringService())
    }
}
