import SwiftUI

// MARK: - Simple Chat View (ChatGPT-style)
struct SimpleChatView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @State private var messageText = ""
    @State private var isGenerating = false
    @State private var sendError: String?
    @FocusState private var isInputFocused: Bool
    @State private var showSuccessParticles = false
    @State private var showTTSControls = false
    @State private var ttsService: TTSService?
    @State private var sttService: STTService?
    @State private var voiceAgent: VoiceAgent?
    @State private var showVoiceControls = false
    @State private var showVoiceRecording = false
    @State private var isVoiceInputMode = false

    var body: some View {
        VStack(spacing: 0) {
            // Modern chat header with enhanced features
            ChatHeaderView()
                .environmentObject(appState)
                .environmentObject(apiService)

            // Enhanced message list with modern components
            MessageListView(messages: appState.messages, isGenerating: isGenerating)
                .environmentObject(appState)

            // Modern floating composer
            FloatingComposer(
                messageText: $messageText,
                isGenerating: $isGenerating,
                onSend: sendMessage,
                onVoiceToggle: { showVoiceRecording.toggle() }
            )
            .focused($isInputFocused)
        }
        .background(AnimatedGradientBackground())
        .overlay(
            SuccessParticles(isTriggered: $showSuccessParticles)
                .allowsHitTesting(false),
            alignment: .center
        )
        .onAppear {
            setupChat()
            // Initialize voice services
            if ttsService == nil {
                ttsService = TTSService()
            }
            if sttService == nil {
                sttService = STTService()
            }
            if voiceAgent == nil, let stt = sttService, let tts = ttsService {
                voiceAgent = VoiceAgent(sttService: stt, ttsService: tts, apiService: apiService)
            }
            // Focus input after a moment
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                isInputFocused = true
            }
        }
        .sheet(isPresented: $appState.showSettings) {
            SettingsView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .frame(width: 600, height: 500)
        }
    }

    // MARK: - Header
    private var chatHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(appState.currentChat?.title ?? "New Chat")
                    .font(.headline)
                    .foregroundColor(AppTheme.primaryText)

                HStack(spacing: 6) {
                    // Styled connection status indicator with glassmorphism
                    ZStack {
                        Circle()
                            .fill(AppTheme.tertiaryBackground.opacity(0.6))
                            .frame(width: 12, height: 12)
                            .overlay(
                                Circle()
                                    .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
                            )
                        
                        Circle()
                            .fill(connectionStatusColor)
                            .frame(width: 6, height: 6)
                            .shadow(color: connectionStatusColor.opacity(0.6), radius: 2)
                    }
                    .glassMorphism(cornerRadius: 6)

                    Text(apiService.isConnected ? "Connected" : "Disconnected")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }

            Spacer()

            // Simple controls
            HStack(spacing: 12) {
                // Voice Controls Button
                Button(action: { showVoiceControls.toggle() }) {
                    Image(systemName: voiceControlsIcon)
                        .font(.title2)
                        .foregroundColor(voiceControlsColor)
                }
                .buttonStyle(PlainButtonStyle())
                .help("Voice Controls")
                .accessibilityLabel("Voice controls")
                .accessibilityHint("Opens voice interaction settings and controls")
                .popover(isPresented: $showVoiceControls) {
                    if let sttService = sttService, let ttsService = ttsService, let voiceAgent = voiceAgent {
                        VoiceControlsPanel(sttService: sttService, ttsService: ttsService, voiceAgent: voiceAgent)
                            .frame(width: 600, height: 500)
                    } else {
                        Text("Voice Services Loading...")
                            .frame(width: 600, height: 500)
                    }
                }
                
                // Voice Input Toggle
                Button(action: { toggleVoiceInputMode() }) {
                    Image(systemName: isVoiceInputMode ? "keyboard" : "mic")
                        .font(.title2)
                        .foregroundColor(isVoiceInputMode ? AppTheme.accentGreen : AppTheme.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help(isVoiceInputMode ? "Switch to keyboard input" : "Switch to voice input")
                .accessibilityLabel(isVoiceInputMode ? "Switch to keyboard" : "Switch to voice")
                .disabled(voiceAgent?.isEnabled != true)
                
                Button(action: startNewChat) {
                    Image(systemName: "plus.square")
                        .font(.title2)
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help("New Chat")
                .accessibilityLabel("Start new chat")
                .accessibilityHint("Creates a new conversation")
                .keyboardShortcut("n", modifiers: .command)

                Button(action: { appState.showSettings = true }) {
                    Image(systemName: "gearshape")
                        .font(.title2)
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help("Settings")
                .accessibilityLabel("Open settings")
                .accessibilityHint("Opens the application settings panel")
                .keyboardShortcut(",", modifiers: .command)
            }
        }
    }

    // MARK: - Message List
    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 16) {
                    if let messages = appState.currentChat?.messages, !messages.isEmpty {
                        ForEach(messages) { message in
                            EnhancedMessageBubble(message: message)
                                .id(message.id)
                        }
                    } else {
                        emptyState
                    }

                    // Generating indicator
                    if isGenerating {
                        EnhancedTypingIndicator()
                            .id("generating")
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .padding(.vertical, 20)
                .padding(.horizontal, 20)
            }
            .onChange(of: appState.currentChat?.messages.count) { _ in
                if let lastMessage = appState.currentChat?.messages.last {
                    withAnimation(.easeOut(duration: 0.5)) {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
            .onChange(of: isGenerating) { generating in
                if generating {
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo("generating", anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Input Area
    private var inputArea: some View {
        VStack(spacing: 0) {
            // RAG Controls
            RAGControlsView(ragSettings: $appState.ragSettings)
                .padding(.horizontal, 20)
                .padding(.top, 12)
            
            // Error banner
            if let error = sendError {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    Text(error)
                        .font(.caption)
                        .foregroundColor(AppTheme.primaryText)
                    Spacer()
                    Button("Dismiss") { sendError = nil }
                        .font(.caption)
                        .buttonStyle(.borderless)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
                .background(Color.orange.opacity(0.1))
            }

            // Input field or voice recording
            HStack(alignment: .bottom, spacing: 12) {
                if isVoiceInputMode {
                    // Voice input mode
                    voiceInputArea
                } else {
                    // Text input mode
                    TextField("Message Universal AI Tools...", text: $messageText, axis: .vertical)
                        .textFieldStyle(.plain)
                        .font(.system(size: 16))
                        .lineLimit(1...6)
                        .focused($isInputFocused)
                        .disabled(isGenerating)
                        .accessibilityLabel("Message input field")
                        .accessibilityHint("Type your message to the AI assistant")
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(.ultraThinMaterial)
                        .glassMorphism(cornerRadius: 20)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .stroke(
                                    LinearGradient(
                                        colors: isInputFocused ? [AppTheme.accentGreen, .blue] : [Color.white.opacity(0.3)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    ),
                                    lineWidth: isInputFocused ? 2 : 1
                                )
                                .glow(color: isInputFocused ? AppTheme.accentGreen : .clear, radius: isInputFocused ? 8 : 0)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .onSubmit {
                            if NSEvent.modifierFlags.contains(.command) || messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
                                sendMessage()
                            }
                        }
                }

                // Send/Voice button
                if isVoiceInputMode {
                    // Voice input mode buttons
                    HStack(spacing: 8) {
                        // Voice recording button
                        if let voiceAgent = voiceAgent {
                            CompactVoiceButton(voiceAgent: voiceAgent)
                        }
                        
                        // Quick voice recording
                        Button(action: { showVoiceRecording.toggle() }) {
                            Image(systemName: "waveform.circle")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.white)
                                .frame(width: 32, height: 32)
                                .background(AppTheme.accentGreen.gradient)
                                .clipShape(Circle())
                                .glow(color: AppTheme.accentGreen, radius: 4)
                        }
                        .buttonStyle(.plain)
                        .help("Voice recording panel")
                        .popover(isPresented: $showVoiceRecording) {
                            if let sttService = sttService, let voiceAgent = voiceAgent {
                                VoiceRecordingView(
                                    sttService: sttService,
                                    voiceAgent: voiceAgent,
                                    onTranscriptionComplete: handleVoiceTranscription
                                )
                                .frame(width: 400, height: 350)
                            }
                        }
                    }
                } else {
                    // Text input mode button
                    ParticleButton(action: isGenerating ? stopGenerating : sendMessage) {
                        if isGenerating {
                            Image(systemName: "stop.fill")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.white)
                                .frame(width: 32, height: 32)
                                .background(Color.red.gradient)
                                .clipShape(Circle())
                                .glow(color: .red, radius: 4)
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(canSend ? .white : AppTheme.tertiaryText)
                                .frame(width: 32, height: 32)
                                .background(LinearGradient(
                                    colors: canSend ? [AppTheme.accentGreen, AppTheme.accentGreen.opacity(0.8)] : [AppTheme.secondaryText.opacity(0.3)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ))
                                .clipShape(Circle())
                                .glow(color: canSend ? AppTheme.accentGreen : .clear, radius: canSend ? 6 : 0)
                        }
                    }
                    .disabled(!canSend && !isGenerating)
                    .keyboardShortcut(.return, modifiers: .command)
                    .help(isGenerating ? "Stop generating" : "Send message (⌘↵)")
                    .scaleEffect(canSend ? 1.05 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: canSend)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
    }

    // MARK: - Helper Views
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "message.circle")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.tertiaryText)

            VStack(spacing: 8) {
                Text("Start a conversation")
                    .font(.title2)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.primaryText)

                Text("Type a message below to begin chatting with Universal AI Tools")
                    .font(.body)
                    .foregroundColor(AppTheme.secondaryText)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }

    private var generatingIndicator: some View {
        HStack {
            HStack(spacing: 8) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(AppTheme.accentGreen)
                        .frame(width: 6, height: 6)
                        .scaleEffect(isGenerating ? 1 : 0.5)
                        .animation(
                            Animation.easeInOut(duration: 0.6)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.2),
                            value: isGenerating
                        )
                }
                Text("AI is thinking...")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(AppTheme.surfaceBackground)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

            Spacer()
        }
        .id("generating")
    }

    // MARK: - Computed Properties
    private var canSend: Bool {
        !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isGenerating
    }
    
    private var voiceControlsIcon: String {
        if let voiceAgent = voiceAgent {
            switch voiceAgent.state {
            case .listening:
                return "mic.fill"
            case .processing:
                return "waveform"
            case .responding:
                return "speaker.wave.3.fill"
            case .error:
                return "exclamationmark.triangle.fill"
            default:
                return "mic.and.signal.meter"
            }
        }
        return "mic.slash"
    }
    
    private var voiceControlsColor: Color {
        if let voiceAgent = voiceAgent {
            switch voiceAgent.state {
            case .listening:
                return .red
            case .processing:
                return .orange
            case .responding:
                return AppTheme.accentGreen
            case .error:
                return .red
            default:
                return voiceAgent.isEnabled ? AppTheme.secondaryText : AppTheme.tertiaryText
            }
        }
        return AppTheme.tertiaryText
    }

    // MARK: - Actions
    private func setupChat() {
        if appState.currentChat == nil {
            startNewChat()
        }
    }

    private func startNewChat() {
        appState.currentChat = Chat(
            id: UUID().uuidString,
            title: "New Chat",
            model: "gpt-4",
            messages: []
        )
        messageText = ""
    }

    private func sendMessage() {
        guard canSend else { return }

        let userMessage = Message(
            content: messageText,
            role: .user
        )

        // Add user message immediately
        appState.currentChat?.messages.append(userMessage)

        let currentMessage = messageText
        messageText = ""
        isGenerating = true
        sendError = nil

        // Keep focus on input
        isInputFocused = true

        Task {
            do {
                print("Sending chat message: \(currentMessage)")
                
                // Try local LLM first (with RAG if enabled), then fallback to backend
                let response: Message
                if await apiService.checkLocalLLMServerAvailable() {
                    response = try await apiService.sendMessageToLocalLLM(
                        currentMessage,
                        ragSettings: appState.ragSettings.isEnabled ? appState.ragSettings : nil
                    )
                    print("Local LLM response: \(response.content)")
                } else {
                    response = try await apiService.sendChatMessageWithFallback(
                        currentMessage,
                        chatId: appState.currentChat?.id ?? ""
                    )
                    print("Backend response: \(response.content)")
                }

                await MainActor.run {
                    appState.currentChat?.messages.append(response)
                    isGenerating = false
                    sendError = nil  // Clear any previous errors

                    // Trigger success particles
                    showSuccessParticles = true

                    // Update chat title if it's the first exchange
                    if appState.currentChat?.messages.count == 2 {
                        appState.currentChat?.title = generateChatTitle(from: currentMessage)
                    }

                    // Keep focus
                    isInputFocused = true
                }
            } catch {
                await MainActor.run {
                    isGenerating = false

                    // Remove user message on error
                    if let lastMessage = appState.currentChat?.messages.last,
                       lastMessage.role == .user {
                        appState.currentChat?.messages.removeLast()
                    }

                    if error.localizedDescription.contains("401") {
                        sendError = "Authentication required. Please check your API settings."
                    } else {
                        sendError = "Failed to send message: \(error.localizedDescription)"
                        print("Chat error details: \(error)")
                    }
                    isInputFocused = true
                }
            }
        }
    }

    private func stopGenerating() {
        isGenerating = false
        isInputFocused = true
    }

    private func generateChatTitle(from message: String) -> String {
        let words = message.split(separator: " ").prefix(4)
        return words.joined(separator: " ") + (words.count == 4 ? "..." : "")
    }
    
    private var connectionStatusColor: Color {
        if apiService.isConnected {
            return AppTheme.accentGreen.opacity(0.8)
        } else {
            return AppTheme.accentOrange.opacity(0.8)
        }
    }
    
    // MARK: - Voice Input Area
    private var voiceInputArea: some View {
        HStack(spacing: 12) {
            // Voice activity indicator
            if let voiceAgent = voiceAgent {
                VoiceActivityIndicator(voiceAgent: voiceAgent)
            }
            
            // Current transcription or voice prompt
            VStack(alignment: .leading, spacing: 4) {
                if let voiceAgent = voiceAgent, !(voiceAgent.currentInteraction?.userInput.isEmpty ?? true) {
                    Text(voiceAgent.currentInteraction?.userInput ?? "")
                        .font(.system(size: 16))
                        .foregroundColor(AppTheme.primaryText)
                        .lineLimit(3)
                } else {
                    Text("Tap microphone to start voice input")
                        .font(.system(size: 16))
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                // Partial transcription
                if let sttService = sttService, !sttService.partialTranscription.isEmpty {
                    Text(sttService.partialTranscription)
                        .font(.system(size: 14))
                        .foregroundColor(AppTheme.tertiaryText)
                        .italic()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: voiceAgent?.state == .listening ? [AppTheme.accentGreen, .blue] : [Color.white.opacity(0.3)],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        lineWidth: voiceAgent?.state == .listening ? 2 : 1
                    )
                    .glow(color: voiceAgent?.state == .listening ? AppTheme.accentGreen : .clear, radius: voiceAgent?.state == .listening ? 8 : 0)
            )
        }
    }
    
    // MARK: - Voice Helper Methods
    private func toggleVoiceInputMode() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            isVoiceInputMode.toggle()
        }
        
        if isVoiceInputMode {
            // Request STT permission if needed
            Task {
                if let sttService = sttService, !sttService.isAuthorized {
                    await sttService.requestAuthorization()
                }
            }
        } else {
            // Cancel any active voice interaction
            voiceAgent?.cancelVoiceInteraction()
        }
    }
    
    private func handleVoiceTranscription(_ transcription: String) {
        // Update message text with transcription
        messageText = transcription
        
        // Close voice recording panel
        showVoiceRecording = false
        
        // Optionally send immediately or let user review
        if !transcription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            // Auto-send if voice agent is in conversational mode
            if voiceAgent?.configuration.interactionMode == .conversational {
                sendMessage()
            } else {
                // Switch back to text mode to let user review/edit
                isVoiceInputMode = false
                isInputFocused = true
            }
        }
    }
}

// MARK: - Simple Message Bubble
struct SimpleMessageBubble: View {
    let message: Message
    @State private var isHovered = false

    var body: some View {
        HStack(alignment: .top) {
            if message.role == .user {
                Spacer()
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.system(size: 16))
                    .foregroundColor(AppTheme.primaryText)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(messageBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .frame(maxWidth: 600, alignment: messageAlignment)

                // Timestamp (show on hover)
                if isHovered {
                    Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                        .font(.caption2)
                        .foregroundColor(AppTheme.tertiaryText)
                        .transition(.opacity)
                }
            }

            if message.role == .assistant {
                Spacer()
            }
        }
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
    }

    private var messageBackground: some View {
        Group {
            if message.role == .user {
                AppTheme.accentGreen
            } else {
                AppTheme.surfaceBackground
            }
        }
    }

    private var messageAlignment: Alignment {
        message.role == .user ? .trailing : .leading
    }
}

// MARK: - Preview
struct SimpleChatView_Previews: PreviewProvider {
    static var previews: some View {
        SimpleChatView()
            .environmentObject(AppState())
            .environmentObject(APIService())
            .frame(width: 800, height: 600)
    }
}
