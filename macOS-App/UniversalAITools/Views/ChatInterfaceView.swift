import SwiftUI

struct ChatInterfaceView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    @State private var messageText = ""
    @State private var isGenerating = false
    @State private var selectedModel = "gpt-4"
    @State private var showModelPicker = false
    @State private var showSettings = false
    
    @FocusState private var isInputFocused: Bool
    
    let availableModels = [
        "gpt-4", "gpt-3.5-turbo", "claude-3-opus",
        "llama3.2:3b", "mixtral:8x7b", "deepseek-coder"
    ]
    
    var body: some View {
        VStack(spacing: 0) {
            // Chat Header
            chatHeader
            
            Divider()
            
            // Messages Area
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(appState.currentChat?.messages ?? []) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                        
                        if isGenerating {
                            GeneratingIndicator()
                        }
                    }
                    .padding()
                }
                .background(Color(NSColor.textBackgroundColor))
                .onChange(of: appState.currentChat?.messages.count) { _ in
                    withAnimation {
                        proxy.scrollTo(appState.currentChat?.messages.last?.id, anchor: .bottom)
                    }
                }
            }
            
            Divider()
            
            // Input Area
            inputArea
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(NSColor.windowBackgroundColor))
        .onAppear {
            setupChat()
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
            Button(action: { showModelPicker.toggle() }) {
                HStack(spacing: 4) {
                    Text(selectedModel)
                        .font(.subheadline)
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
            }
            .buttonStyle(BorderlessButtonStyle())
            .popover(isPresented: $showModelPicker) {
                ModelPickerView(
                    selectedModel: $selectedModel,
                    models: availableModels,
                    onSelect: { model in
                        selectedModel = model
                        showModelPicker = false
                        appState.currentChat?.model = model
                    }
                )
            }
            
            // Settings Button
            Button(action: { showSettings.toggle() }) {
                Image(systemName: "gearshape")
            }
            .buttonStyle(BorderlessButtonStyle())
            .popover(isPresented: $showSettings) {
                ChatSettingsView()
                    .frame(width: 300, height: 400)
            }
            
            // New Chat Button
            Button(action: startNewChat) {
                Image(systemName: "plus.square")
            }
            .buttonStyle(BorderlessButtonStyle())
        }
        .padding()
    }
    
    // MARK: - Input Area
    
    private var inputArea: some View {
        HStack(spacing: 12) {
            // Attachment Button
            Button(action: attachFile) {
                Image(systemName: "paperclip")
                    .foregroundColor(.secondary)
            }
            .buttonStyle(BorderlessButtonStyle())
            
            // Text Input
            TextEditor(text: $messageText)
                .font(.body)
                .focused($isInputFocused)
                .frame(minHeight: 40, maxHeight: 120)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(8)
                .onSubmit {
                    if !messageText.isEmpty && !isGenerating {
                        sendMessage()
                    }
                }
            
            // Send Button
            Button(action: sendMessage) {
                if isGenerating {
                    ProgressView()
                        .scaleEffect(0.7)
                        .frame(width: 20, height: 20)
                } else {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(messageText.isEmpty ? .gray : .accentColor)
                }
            }
            .buttonStyle(BorderlessButtonStyle())
            .disabled(messageText.isEmpty || isGenerating)
            .keyboardShortcut(.return, modifiers: [])
        }
        .padding()
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
            role: .user,
            content: messageText,
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
                    
                    // Update chat title if it's the first exchange
                    if appState.currentChat?.messages.count == 2 {
                        appState.currentChat?.title = generateChatTitle(from: currentMessage)
                    }
                }
            } catch {
                await MainActor.run {
                    isGenerating = false
                    showError(error)
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
}

// MARK: - Supporting Views

struct MessageBubble: View {
    let message: Message
    
    var alignment: HorizontalAlignment {
        message.role == .user ? .trailing : .leading
    }
    
    var bubbleColor: Color {
        message.role == .user ? Color.accentColor : Color(NSColor.controlBackgroundColor)
    }
    
    var textColor: Color {
        message.role == .user ? .white : .primary
    }
    
    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 60) }
            
            VStack(alignment: alignment, spacing: 4) {
                Text(message.content)
                    .font(.body)
                    .foregroundColor(textColor)
                    .textSelection(.enabled)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(bubbleColor)
                    .cornerRadius(12)
                
                HStack(spacing: 8) {
                    if message.role == .assistant {
                        // Copy Button
                        Button(action: { copyToClipboard(message.content) }) {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                        }
                        .buttonStyle(BorderlessButtonStyle())
                        
                        // Regenerate Button
                        Button(action: { /* Regenerate */ }) {
                            Image(systemName: "arrow.clockwise")
                                .font(.caption)
                        }
                        .buttonStyle(BorderlessButtonStyle())
                    }
                    
                    Text(formatTimestamp(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            if message.role == .assistant { Spacer(minLength: 60) }
        }
    }
    
    private func copyToClipboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
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
                        Button(action: { onSelect(model) }) {
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
                        }
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