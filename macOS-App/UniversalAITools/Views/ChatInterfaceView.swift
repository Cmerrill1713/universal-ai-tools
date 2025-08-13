import AppKit
import SwiftUI

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
    @State private var attachedFiles: [URL] = []
    @State private var currentSendTask: Task<Void, Never>?

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
            VStack {
                Spacer()

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
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .padding(.bottom, 10)
                .background(AppTheme.primaryBackground.opacity(0.001))
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
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.primaryBackground)
        .onAppear {
            setupChat()
            // Focus input field after setup
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
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
            attachedFiles: attachedFiles,
            onSend: sendMessage,
            onAttach: attachFile,
            onStop: stopGenerating,
            onRemoveAttachment: { url in
                attachedFiles.removeAll { $0 == url }
            }
        )
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 8)
        .focused($isInputFocused)
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

        currentSendTask = Task {
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
        // Use async to prevent UI freeze during file panel
        DispatchQueue.main.async {
            let panel = NSOpenPanel()
            panel.allowsMultipleSelection = false
            panel.canChooseDirectories = false
            panel.canChooseFiles = true

            if panel.runModal() == .OK,
               let url = panel.url {
                self.attachedFiles.append(url)
            }
        }
    }

    private func stopGenerating() {
        // Cancel the current generation task (URLSession respects Task cancellation)
        currentSendTask?.cancel()
        currentSendTask = nil
        isGenerating = false
        if let conversationId = appState.currentChat?.id {
            Task { await apiService.cancelChat(conversationId: conversationId) }
        }
    }

    private func generateChatTitle(from message: String) -> String {
        // Simple title generation - take first few words
        let words = message.split(separator: " ").prefix(5)
        return words.joined(separator: " ") + (words.count == 5 ? "..." : "")
    }

    private func showError(_ error: Error) {
        // Use async dispatch to prevent freezing and ensure proper cleanup
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "Error"
            alert.informativeText = error.localizedDescription
            alert.alertStyle = .warning
            alert.addButton(withTitle: "OK")
            alert.runModal()
        }
    }

    // MARK: - Chat Tabs (icon buttons)
    private var chatTabs: some View {
        HStack(spacing: 14) {
            Button(action: { appState.selectedSidebarItem = .chat }, label: {
                Image(systemName: "text.bubble").font(.subheadline)
            })
            Button(action: { appState.selectedSidebarItem = .objectives }, label: {
                Image(systemName: "target").font(.subheadline)
            })
            Button(action: { appState.selectedSidebarItem = .tools }, label: {
                Image(systemName: "wrench.and.screwdriver").font(.subheadline)
            })
            Button(action: {
                appState.selectedSidebarItem = .tools
                appState.selectedTool = .monitoring
            }, label: {
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

// Moved subviews into separate files under Views/Components and Views/Chat
