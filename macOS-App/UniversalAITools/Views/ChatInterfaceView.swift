import SwiftUI
import AppKit

struct ChatInterfaceView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var messageText = ""
    @State private var isGenerating = false
    @State private var sendError: String?
    @State private var selectedModel = "gpt-4"
    @State private var showModelPicker = false
    @State private var showSettings = false
    @State private var isDockHovering = false

    @FocusState private var isInputFocused: Bool

    let availableModels = [
        "gpt-4", "gpt-3.5-turbo", "claude-3-opus",
        "llama3.2:3b", "mixtral:8x7b", "deepseek-coder"
    ]

    var body: some View {
        ZStack {
            // Main Chat Interface
            VStack(spacing: 0) {
                ChatHeaderView(
                    selectedModel: $selectedModel,
                    showModelPicker: $showModelPicker,
                    showSettings: $showSettings,
                    availableModels: availableModels,
                    onModelSelect: { model in
                        selectedModel = model
                        showModelPicker = false
                        appState.currentChat?.model = model
                    },
                    onNewChat: startNewChat
                )
                .environmentObject(appState)

                MessageListView(
                    isGenerating: isGenerating,
                    onRegenerate: { regenerateLastMessage() }
                )
                .environmentObject(appState)
            }

            // Floating Composer anchored using safe area inset
            VStack { Spacer() }
                .safeAreaInset(edge: .bottom) {
                    VStack(spacing: 8) {
                        if let error = sendError {
                            errorBanner(error)
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                                .padding(.horizontal, 20)
                        }
                        ChatTabsView()
                            .padding(.horizontal, 20)
                            .environmentObject(appState)
                        inputArea
                            .transition(.asymmetric(
                                insertion: .move(edge: .bottom).combined(with: .opacity),
                                removal: .move(edge: .bottom).combined(with: .opacity)
                            ))
                    }
                    .padding(.bottom, 10)
                    .background(AppTheme.primaryBackground.opacity(0.001))
                }
        }
            // Left-side dock overlay on top of chat area
            HStack(alignment: .top, spacing: 0) {
                ZStack(alignment: .leading) {
                    // Hover zone to reveal dock
                    Rectangle()
                        .fill(Color.clear)
                        .frame(width: 10)
                        .contentShape(Rectangle())
                        .onHover { hovering in
                            withAnimation(.easeInOut(duration: 0.2)) {
                                isDockHovering = hovering
                            }
                        }

                    DockOverlay(onSelect: { item in
                        appState.selectedSidebarItem = item
                    })
                    .padding(.top, 52)
                    .opacity(isDockHovering ? 1.0 : 0.0)
                    .animation(.easeInOut(duration: 0.2), value: isDockHovering)
                }
                .zIndex(5)

                Spacer()
            }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.primaryBackground)
        .onAppear {
            setupChat()
            // Animate in the composer after a slight delay
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.2)) {
                isInputFocused = true
            }
        }
    }

    // MARK: - Chat Header

    private var chatHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(appState.currentChat?.title ?? "New Chat")
                    .font(.headline)

                HStack(spacing: 4) {
                    Image(systemName: "cpu")
                        .font(.caption)
                    Text(selectedModel)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Model Picker
            Button(action: { showModelPicker.toggle() }, label: {
                HStack(spacing: 4) {
                    Text(selectedModel)
                        .font(.subheadline)
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
            })
            .buttonStyle(BorderlessButtonStyle())
            .popover(isPresented: $showModelPicker, content: {
                ModelPickerView(
                    selectedModel: $selectedModel,
                    models: availableModels,
                    onSelect: { model in
                        selectedModel = model
                        showModelPicker = false
                        appState.currentChat?.model = model
                    }
                )
            })

            // Settings Button
            Button(action: { showSettings.toggle() }, label: {
                Image(systemName: "gearshape")
            })
            .buttonStyle(BorderlessButtonStyle())
            .popover(isPresented: $showSettings, content: {
                ChatSettingsView()
                    .frame(width: 300, height: 400)
            })

            // New Chat Button
            Button(action: startNewChat, label: {
                Image(systemName: "plus.square")
            })
            .buttonStyle(BorderlessButtonStyle())
        }
        .padding()
    }

    // MARK: - Input Area

    private var inputArea: some View {
        FloatingComposer(
            messageText: $messageText,
            isGenerating: $isGenerating,
            onSend: sendMessage,
            onAttach: attachFile,
            onStop: stopGenerating
        )
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 8)
    }

    // MARK: - Actions

    private func setupChat() {
        if appState.currentChat == nil {
            appState.currentChat = Chat(
                id: UUID().uuidString,
                title: "New Chat",
                model: selectedModel,
                messages: []
            )
        }
    }

    private func sendMessage() {
        guard !messageText.isEmpty else { return }

        let userMessage = Message(
            id: UUID().uuidString,
            content: messageText,
            role: .user,
            timestamp: Date()
        )

        appState.currentChat?.messages.append(userMessage)

        let currentMessage = messageText
        messageText = ""
        isGenerating = true

        Task {
            do {
                let response = try await apiService.sendChatMessage(
                    currentMessage,
                    chatId: appState.currentChat?.id ?? ""
                )

                await MainActor.run {
                    appState.currentChat?.messages.append(response)
                    isGenerating = false
                    sendError = nil

                    // Update chat title if it's the first exchange
                    if appState.currentChat?.messages.count == 2 {
                        appState.currentChat?.title = generateChatTitle(from: currentMessage)
                    }
                }
            } catch {
                await MainActor.run {
                    isGenerating = false
                    sendError = error.localizedDescription
                }
            }
        }
    }

    private func regenerateLastMessage() {
        guard let messages = appState.currentChat?.messages,
              messages.count >= 2 else { return }

        // Find the last user message and last assistant message
        var lastUserMessageIndex: Int?
        var lastAssistantMessageIndex: Int?

        for (index, message) in messages.enumerated().reversed() {
            if message.role == .assistant && lastAssistantMessageIndex == nil {
                lastAssistantMessageIndex = index
            } else if message.role == .user && lastUserMessageIndex == nil {
                lastUserMessageIndex = index
            }

            if lastUserMessageIndex != nil && lastAssistantMessageIndex != nil {
                break
            }
        }

        // Ensure we have both a user message and an assistant message to regenerate
        guard let userIndex = lastUserMessageIndex,
              let assistantIndex = lastAssistantMessageIndex,
              assistantIndex > userIndex else { return }

        let userMessage = messages[userIndex]

        // Remove the last assistant message
        appState.currentChat?.messages.remove(at: assistantIndex)

        // Resend the user message
        isGenerating = true
        sendError = nil

        Task {
            do {
                let response = try await apiService.sendChatMessage(
                    userMessage.content,
                    chatId: appState.currentChat?.id ?? ""
                )

                await MainActor.run {
                    appState.currentChat?.messages.append(response)
                    isGenerating = false
                    sendError = nil
                }
            } catch {
                await MainActor.run {
                    isGenerating = false
                    sendError = error.localizedDescription
                }
            }
        }
    }

    private func startNewChat() {
        appState.currentChat = Chat(
            id: UUID().uuidString,
            title: "New Chat",
            model: selectedModel,
            messages: []
        )
        messageText = ""
    }

    private func attachFile() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true

        if panel.runModal() == .OK,
           let url = panel.url {
            // Handle file attachment
            messageText += "\n[Attached: \(url.lastPathComponent)]"
        }
    }

    private func stopGenerating() {
        // Cancel the current generation task
        isGenerating = false
        // TODO: Implement actual API cancellation when backend supports it
    }

    private func generateChatTitle(from message: String) -> String {
        // Simple title generation - take first few words
        let words = message.split(separator: " ").prefix(5)
        return words.joined(separator: " ") + (words.count == 5 ? "..." : "")
    }

    private func showError(_ error: Error) {
        let alert = NSAlert()
        alert.messageText = "Error"
        alert.informativeText = error.localizedDescription
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    // MARK: - Chat Tabs (icon buttons)
    private var chatTabs: some View {
        HStack(spacing: 14) {
            Button(action: { appState.selectedSidebarItem = .chat }, label: {
                Image(systemName: "text.bubble").font(.subheadline)
            })
            Button(action: { appState.selectedSidebarItem = .agents }, label: {
                Image(systemName: "brain.head.profile").font(.subheadline)
            })
            Button(action: { appState.selectedSidebarItem = .tools }, label: {
                Image(systemName: "wrench.and.screwdriver").font(.subheadline)
            })
            Button(action: { appState.selectedSidebarItem = .monitoring }, label: {
                Image(systemName: "chart.line.uptrend.xyaxis").font(.subheadline)
            })
            Spacer()
        }
        .buttonStyle(BorderlessButtonStyle())
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    private var emptyChatState: some View {
        VStack(spacing: 8) {
            Image(systemName: "text.bubble").font(.title).foregroundColor(.secondary)
            Text("Start a new conversation").font(.headline)
            Text("Type a message below to begin.").font(.caption).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.vertical, 40)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.yellow)
            Text(message).font(.caption).lineLimit(2)
            Spacer()
            Button("Dismiss") { sendError = nil }.buttonStyle(.borderless).font(.caption)
            Button("Retry") { sendMessage() }.buttonStyle(.bordered).font(.caption)
        }
        .padding(12)
        .background(.thinMaterial)
        .cornerRadius(10)
        .padding([.horizontal, .bottom])
    }
}

// MARK: - Supporting Views

struct InterfaceMessageBubble: View {
    let message: Message
    var onRegenerate: (() -> Void)? = nil
    @State private var isHovered = false
    @State private var showActions = false
    @State private var animateIn = false

    var bubbleColor: some View {
        Group {
            if message.role == .user {
                LinearGradient(
                    gradient: Gradient(colors: [
                        AppTheme.accentGreen,
                        AppTheme.accentGreen.opacity(0.9)
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                AppTheme.surfaceBackground
                    .opacity(isHovered ? 1.0 : 0.95)
            }
        }
    }

    var textColor: Color {
        message.role == .user ? .white : AppTheme.primaryText
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Assistant avatar
            if message.role == .assistant {
                Circle()
                    .fill(LinearGradient(
                        gradient: Gradient(colors: [
                            AppTheme.accentBlue,
                            AppTheme.accentBlue.opacity(0.8)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: "cpu")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white)
                    )
                    .scaleEffect(animateIn ? 1.0 : 0.8)
                    .opacity(animateIn ? 1.0 : 0.0)
            }

            // Message content
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 6) {
                // Message bubble
                VStack(alignment: .leading, spacing: 8) {
                    Text(message.content)
                        .font(.system(size: 15))
                        .foregroundColor(textColor)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(bubbleColor)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .stroke(
                            message.role == .assistant ?
                            AppTheme.separator.opacity(0.5) :
                            Color.clear,
                            lineWidth: 1
                        )
                )
                .shadow(
                    color: AppTheme.composerShadow.opacity(0.1),
                    radius: isHovered ? 8 : 4,
                    x: 0,
                    y: 2
                )
                .scaleEffect(animateIn ? 1.0 : 0.95)
                .opacity(animateIn ? 1.0 : 0.0)

                // Action buttons (fade in on hover)
                if message.role == .assistant && (isHovered || showActions) {
                    HStack(spacing: 12) {
                        // Copy Button
                        ActionButton(
                            icon: "doc.on.doc",
                            label: "Copy",
                            action: { copyToClipboard(message.content) }
                        )

                        // Regenerate Button
                        ActionButton(
                            icon: "arrow.clockwise",
                            label: "Regenerate",
                            action: { onRegenerate?() }
                        )

                        // Share Button
                        ActionButton(
                            icon: "square.and.arrow.up",
                            label: "Share",
                            action: { shareMessage(message.content) }
                        )

                        Spacer()

                        // Timestamp
                        Text(formatTimestamp(message.timestamp))
                            .font(.caption2)
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .opacity
                    ))
                }
            }
            .frame(maxWidth: message.role == .user ? 480 : .infinity, alignment: message.role == .user ? .trailing : .leading)

            // User avatar
            if message.role == .user {
                Circle()
                    .fill(LinearGradient(
                        gradient: Gradient(colors: [
                            Color.purple,
                            Color.purple.opacity(0.8)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Text(String(NSFullUserName().prefix(1).uppercased()))
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white)
                    )
                    .scaleEffect(animateIn ? 1.0 : 0.8)
                    .opacity(animateIn ? 1.0 : 0.0)
            }

            if message.role == .assistant { Spacer(minLength: 40) }
        }
        .padding(.horizontal, message.role == .user ? 40 : 0)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
                if hovering {
                    showActions = true
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        if !isHovered {
                            showActions = false
                        }
                    }
                }
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7).delay(0.05)) {
                animateIn = true
            }
        }
    }

    private func copyToClipboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private func shareMessage(_ text: String) {
        let sharingServicePicker = NSSharingServicePicker(items: [text])

        // Find a suitable view to present from (the main window's content view)
        if let window = NSApp.mainWindow,
           let contentView = window.contentView {
            let rect = NSRect(x: contentView.bounds.midX - 25,
                            y: contentView.bounds.midY - 25,
                            width: 50,
                            height: 50)
            sharingServicePicker.show(relativeTo: rect, of: contentView, preferredEdge: .minY)
        }
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct GeneratingIndicator: View {
    @State private var dots = 0

    let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Color.secondary)
                        .frame(width: 8, height: 8)
                        .opacity(index < dots ? 1.0 : 0.3)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)

            Spacer()
        }
        .onReceive(timer) { _ in
            withAnimation {
                dots = (dots + 1) % 4
            }
        }
    }
}

struct ModelPickerView: View {
    @Binding var selectedModel: String
    let models: [String]
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Select Model")
                .font(.headline)
                .padding()

            Divider()

            ScrollView {
                VStack(spacing: 0) {
                    ForEach(models, id: \.self) { model in
                        Button(action: { onSelect(model) }, label: {
                            HStack {
                                Image(systemName: "cpu")
                                    .foregroundColor(.secondary)

                                Text(model)
                                    .foregroundColor(.primary)

                                Spacer()

                                if model == selectedModel {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.accentColor)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 8)
                            .contentShape(Rectangle())
                        })
                        .buttonStyle(PlainButtonStyle())
                        .background(
                            model == selectedModel ?
                            Color.accentColor.opacity(0.1) : Color.clear
                        )
                    }
                }
            }
        }
        .frame(width: 250, height: 300)
    }
}

struct ChatSettingsView: View {
    @AppStorage("maxTokens") private var maxTokens = 2048
    @AppStorage("temperature") private var temperature = 0.7
    @AppStorage("systemPrompt") private var systemPrompt = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Chat Settings")
                .font(.headline)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Text("Max Tokens: \(maxTokens)")
                    .font(.subheadline)

                Slider(value: Binding(
                    get: { Double(maxTokens) },
                    set: { maxTokens = Int($0) }
                ), in: 256...8192, step: 256)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Temperature: \(String(format: "%.1f", temperature))")
                    .font(.subheadline)

                Slider(value: $temperature, in: 0...2, step: 0.1)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("System Prompt")
                    .font(.subheadline)

                TextEditor(text: $systemPrompt)
                    .font(.caption)
                    .frame(height: 100)
                    .padding(4)
                    .background(Color(NSColor.controlBackgroundColor))
                    .cornerRadius(4)
            }

            Spacer()
        }
        .padding()
    }
}
