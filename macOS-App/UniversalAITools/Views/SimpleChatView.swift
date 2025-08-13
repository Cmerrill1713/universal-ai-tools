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

    var body: some View {
        VStack(spacing: 0) {
            // Clean header
            chatHeader
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(.ultraThinMaterial)
                .glassMorphism(cornerRadius: 0)
                .overlay(
                    Rectangle()
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 1),
                    alignment: .bottom
                )

            // Message list
            messageList

            // Enhanced input area at bottom
            inputArea
                .background(.ultraThinMaterial)
                .glassMorphism(cornerRadius: 0)
        }
        .background(AnimatedGradientBackground())
        .overlay(
            SuccessParticles(isTriggered: $showSuccessParticles)
                .allowsHitTesting(false),
            alignment: .center
        )
        .onAppear {
            setupChat()
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
                    Circle()
                        .fill(apiService.isConnected ? Color.green : Color.red)
                        .frame(width: 6, height: 6)

                    Text(apiService.isConnected ? "Connected" : "Disconnected")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }

            Spacer()

            // Simple controls
            HStack(spacing: 12) {
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

            // Input field
            HStack(alignment: .bottom, spacing: 12) {
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

                // Enhanced Send button
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
                let response = try await apiService.sendChatMessage(
                    currentMessage,
                    chatId: appState.currentChat?.id ?? ""
                )
                print("Received response: \(response.content)")

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
