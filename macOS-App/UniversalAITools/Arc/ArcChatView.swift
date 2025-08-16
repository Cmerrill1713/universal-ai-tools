import SwiftUI
import Combine
import OSLog

// MARK: - Arc Chat View
// Main chat interface inspired by Arc Browser's clean, modern design
struct ArcChatView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    @State private var messageText = ""
    @State private var isComposing = false
    @State private var showVoiceRecording = false
    @State private var selectedMessage: Message?
    @State private var showingMessageActions: [UUID: Bool] = [:]
    @State private var scrollProxy: ScrollViewReader?
    @State private var keyboardHeight: CGFloat = 0
    
    // Chat management
    @State private var showChatSelector = false
    @State private var showNewChatSheet = false
    @State private var searchText = ""
    @State private var filteredChats: [Chat] = []
    
    // UI State
    @State private var sidebarWidth: CGFloat = 280
    @State private var showSidebar = true
    @State private var isLoadingResponse = false
    @State private var errorMessage: String?
    
    private let minSidebarWidth: CGFloat = 200
    private let maxSidebarWidth: CGFloat = 400
    private let logger = Logger(subsystem: "com.universalai.tools", category: "arc-chat-view")
    
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // Conversation sidebar (if space allows and enabled)
                if showSidebar && geometry.size.width > 800 {
                    conversationSidebar
                        .frame(width: sidebarWidth)
                        .transition(.move(edge: .leading))
                }
                
                // Main chat area
                mainChatArea
                    .frame(maxWidth: .infinity)
            }
        }
        .background(ArcDesign.Colors.secondaryBackground)
        .onAppear {
            setupInitialState()
        }
        .onChange(of: appState.chats) { _ in
            updateFilteredChats()
        }
        .onChange(of: searchText) { _ in
            updateFilteredChats()
        }
        .sheet(isPresented: $showNewChatSheet) {
            newChatSheet
        }
        .alert("Error", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }
    
    // MARK: - Conversation Sidebar
    private var conversationSidebar: some View {
        VStack(spacing: 0) {
            // Sidebar header
            sidebarHeader
            
            ArcDivider()
            
            // Search bar
            searchBar
                .padding(ArcDesign.Spacing.md)
            
            ArcDivider()
            
            // Conversations list
            conversationsList
        }
        .background(ArcDesign.Colors.primaryBackground.opacity(0.95))
        .overlay(
            // Resize handle
            Rectangle()
                .fill(Color.clear)
                .frame(width: 8)
                .contentShape(Rectangle())
                .cursor(NSCursor.resizeLeftRight)
                .onDrag { value in
                    let newWidth = sidebarWidth + value.translation.width
                    sidebarWidth = min(max(newWidth, minSidebarWidth), maxSidebarWidth)
                },
            alignment: .trailing
        )
    }
    
    private var sidebarHeader: some View {
        HStack {
            Text("Conversations")
                .font(ArcDesign.Typography.headline)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            Spacer()
            
            // New chat button
            Button(action: { showNewChatSheet = true }) {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                    .frame(width: 28, height: 28)
                    .background(
                        Circle()
                            .fill(ArcDesign.Colors.tertiaryBackground.opacity(0.5))
                    )
            }
            .buttonStyle(PlainButtonStyle())
            .help("New Conversation")
            
            // Toggle sidebar button
            Button(action: {
                withAnimation(ArcDesign.Animation.spring) {
                    showSidebar.toggle()
                }
            }) {
                Image(systemName: "sidebar.left")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(PlainButtonStyle())
            .help("Toggle Sidebar")
        }
        .padding(ArcDesign.Spacing.md)
    }
    
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(ArcDesign.Colors.tertiaryText)
                .font(.system(size: 14))
            
            TextField("Search conversations...", text: $searchText)
                .textFieldStyle(PlainTextFieldStyle())
                .font(ArcDesign.Typography.body)
                .foregroundColor(ArcDesign.Colors.primaryText)
        }
        .padding(ArcDesign.Spacing.sm)
        .background(ArcDesign.Colors.tertiaryBackground.opacity(0.3))
        .cornerRadius(ArcDesign.Radius.sm)
    }
    
    private var conversationsList: some View {
        ScrollView {
            LazyVStack(spacing: ArcDesign.Spacing.xs) {
                ForEach(filteredChats) { chat in
                    ConversationListItem(
                        chat: chat,
                        isSelected: appState.currentChat?.id == chat.id,
                        onSelect: { selectChat(chat) },
                        onDelete: { deleteChat(chat) }
                    )
                }
            }
            .padding(ArcDesign.Spacing.sm)
        }
    }
    
    // MARK: - Main Chat Area
    private var mainChatArea: some View {
        VStack(spacing: 0) {
            // Chat header
            chatHeader
            
            ArcDivider()
            
            // Messages area
            messagesArea
            
            // Input composer
            inputComposer
        }
        .background(
            LinearGradient(
                colors: [
                    ArcDesign.Colors.secondaryBackground,
                    ArcDesign.Colors.tertiaryBackground.opacity(0.3)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
    
    private var chatHeader: some View {
        HStack {
            // Sidebar toggle (when hidden)
            if !showSidebar {
                Button(action: {
                    withAnimation(ArcDesign.Animation.spring) {
                        showSidebar = true
                    }
                }) {
                    Image(systemName: "sidebar.left")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help("Show Sidebar")
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(appState.currentChat?.title ?? "New Conversation")
                    .font(ArcDesign.Typography.headline)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                
                HStack(spacing: 4) {
                    Circle()
                        .fill(apiService.isConnected ? ArcDesign.Colors.success : ArcDesign.Colors.error)
                        .frame(width: 6, height: 6)
                    
                    Text(apiService.isConnected ? "Connected" : "Offline")
                        .font(ArcDesign.Typography.caption)
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                    
                    if let model = appState.selectedModel {
                        Text("•")
                            .font(ArcDesign.Typography.caption)
                            .foregroundColor(ArcDesign.Colors.tertiaryText)
                        
                        Text(model)
                            .font(ArcDesign.Typography.caption)
                            .foregroundColor(ArcDesign.Colors.secondaryText)
                    }
                }
            }
            
            Spacer()
            
            // Chat actions
            HStack(spacing: ArcDesign.Spacing.sm) {
                Button(action: clearChat) {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help("Clear Conversation")
                
                Button(action: exportChat) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 14))
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help("Export Conversation")
            }
        }
        .padding(ArcDesign.Spacing.md)
    }
    
    private var messagesArea: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: ArcDesign.Spacing.lg) {
                    if let chat = appState.currentChat, !chat.messages.isEmpty {
                        ForEach(chat.messages) { message in
                            ArcMessageBubble(
                                message: message,
                                isSelected: selectedMessage?.id == message.id,
                                showingActions: Binding(
                                    get: { showingMessageActions[message.id] ?? false },
                                    set: { showingMessageActions[message.id] = $0 }
                                )
                            )
                            .id(message.id)
                            .onTapGesture {
                                selectedMessage = message
                            }
                        }
                        
                        // Typing indicator
                        if isLoadingResponse {
                            ArcTypingIndicator()
                                .id("typing-indicator")
                        }
                    } else {
                        // Empty state
                        emptyStateView
                    }
                }
                .padding(ArcDesign.Spacing.lg)
            }
            .onAppear {
                scrollProxy = proxy
                scrollToBottom()
            }
            .onChange(of: appState.messages) { _ in
                scrollToBottom()
            }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: ArcDesign.Spacing.xl) {
            Image(systemName: "message")
                .font(.system(size: 64))
                .foregroundColor(ArcDesign.Colors.accentBlue.opacity(0.6))
                .arcGlow(color: ArcDesign.Colors.accentBlue, intensity: 0.3)
            
            VStack(spacing: ArcDesign.Spacing.md) {
                Text("Start a new conversation")
                    .font(ArcDesign.Typography.title2)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                
                Text("Ask me anything, and I'll help you with information, analysis, creative tasks, and more.")
                    .font(ArcDesign.Typography.body)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
            
            // Suggested prompts
            VStack(spacing: ArcDesign.Spacing.sm) {
                Text("Try asking:")
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.tertiaryText)
                
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 200))], spacing: ArcDesign.Spacing.sm) {
                    ForEach(suggestedPrompts, id: \.self) { prompt in
                        Button(action: { setPrompt(prompt) }) {
                            Text(prompt)
                                .font(ArcDesign.Typography.callout)
                                .foregroundColor(ArcDesign.Colors.secondaryText)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .arcCard(padding: ArcDesign.Spacing.md)
                        .buttonStyle(PlainButtonStyle())
                    }
                }
            }
        }
        .frame(maxWidth: 600)
        .padding(.top, 100)
    }
    
    private var suggestedPrompts: [String] {
        [
            "Explain a complex topic in simple terms",
            "Help me write code for a project",
            "Analyze data and provide insights",
            "Help with creative writing",
            "Plan a project or workflow",
            "Debug an issue I'm facing"
        ]
    }
    
    // MARK: - Input Composer
    private var inputComposer: some View {
        VStack(spacing: 0) {
            if !messageText.isEmpty || isComposing {
                // Rich text toolbar (when composing)
                composerToolbar
                
                ArcDivider()
            }
            
            HStack(alignment: .bottom, spacing: ArcDesign.Spacing.md) {
                // Voice recording button
                Button(action: toggleVoiceRecording) {
                    Image(systemName: showVoiceRecording ? "mic.fill" : "mic")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(showVoiceRecording ? ArcDesign.Colors.error : ArcDesign.Colors.secondaryText)
                        .frame(width: 36, height: 36)
                        .background(
                            Circle()
                                .fill(showVoiceRecording ? ArcDesign.Colors.error.opacity(0.1) : ArcDesign.Colors.tertiaryBackground.opacity(0.5))
                        )
                        .arcGlow(
                            color: showVoiceRecording ? ArcDesign.Colors.error : ArcDesign.Colors.accentBlue,
                            intensity: showVoiceRecording ? 0.5 : 0
                        )
                }
                .buttonStyle(PlainButtonStyle())
                .help("Voice Input")
                
                // Text input field
                messageInput
                
                // Send button
                sendButton
            }
            .padding(ArcDesign.Spacing.md)
        }
        .background(.ultraThinMaterial)
        .overlay(
            Rectangle()
                .fill(Color.white.opacity(0.1))
                .frame(height: 1),
            alignment: .top
        )
    }
    
    private var composerToolbar: some View {
        HStack {
            Button(action: {}) {
                Image(systemName: "textformat.abc")
                    .font(.system(size: 14))
                    .foregroundColor(ArcDesign.Colors.secondaryText)
            }
            .buttonStyle(PlainButtonStyle())
            .help("Text Formatting")
            
            Button(action: {}) {
                Image(systemName: "paperclip")
                    .font(.system(size: 14))
                    .foregroundColor(ArcDesign.Colors.secondaryText)
            }
            .buttonStyle(PlainButtonStyle())
            .help("Attach File")
            
            Button(action: {}) {
                Image(systemName: "photo")
                    .font(.system(size: 14))
                    .foregroundColor(ArcDesign.Colors.secondaryText)
            }
            .buttonStyle(PlainButtonStyle())
            .help("Add Image")
            
            Spacer()
            
            Text("\(messageText.count)")
                .font(ArcDesign.Typography.caption2)
                .foregroundColor(ArcDesign.Colors.tertiaryText)
        }
        .padding(.horizontal, ArcDesign.Spacing.md)
        .padding(.vertical, ArcDesign.Spacing.sm)
    }
    
    private var messageInput: some View {
        ZStack(alignment: .topLeading) {
            if messageText.isEmpty && !isComposing {
                Text("Message AI Assistant...")
                    .font(ArcDesign.Typography.body)
                    .foregroundColor(ArcDesign.Colors.tertiaryText)
                    .padding(.horizontal, ArcDesign.Spacing.md)
                    .padding(.vertical, ArcDesign.Spacing.sm + 2)
            }
            
            TextEditor(text: $messageText)
                .font(ArcDesign.Typography.body)
                .foregroundColor(ArcDesign.Colors.primaryText)
                .scrollContentBackground(.hidden)
                .background(Color.clear)
                .padding(.horizontal, ArcDesign.Spacing.md)
                .padding(.vertical, ArcDesign.Spacing.sm)
                .onReceive(NotificationCenter.default.publisher(for: NSTextView.didBeginEditingNotification)) { _ in
                    isComposing = true
                }
                .onReceive(NotificationCenter.default.publisher(for: NSTextView.didEndEditingNotification)) { _ in
                    if messageText.isEmpty {
                        isComposing = false
                    }
                }
        }
        .frame(minHeight: 44)
        .frame(maxHeight: 120)
        .background(ArcDesign.Colors.tertiaryBackground.opacity(0.3))
        .cornerRadius(ArcDesign.Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.md)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
    }
    
    private var sendButton: some View {
        Button(action: sendMessage) {
            Image(systemName: "arrow.up")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(
                            canSendMessage ?
                            LinearGradient(
                                colors: [ArcDesign.Colors.accentBlue, ArcDesign.Colors.accentPurple],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ) :
                            LinearGradient(
                                colors: [ArcDesign.Colors.tertiaryText.opacity(0.3)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .scaleEffect(canSendMessage ? 1.0 : 0.8)
                .arcGlow(
                    color: ArcDesign.Colors.accentBlue,
                    intensity: canSendMessage ? 0.4 : 0
                )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(!canSendMessage)
        .help("Send Message")
        .animation(ArcDesign.Animation.spring, value: canSendMessage)
    }
    
    private var canSendMessage: Bool {
        !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoadingResponse
    }
    
    // MARK: - New Chat Sheet
    private var newChatSheet: some View {
        VStack(spacing: ArcDesign.Spacing.xl) {
            Text("Start New Conversation")
                .font(ArcDesign.Typography.largeTitle)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            VStack(spacing: ArcDesign.Spacing.md) {
                ForEach(conversationTemplates, id: \.title) { template in
                    Button(action: { createNewChat(with: template) }) {
                        HStack {
                            Image(systemName: template.icon)
                                .font(.system(size: 20))
                                .foregroundColor(template.color)
                                .frame(width: 40)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(template.title)
                                    .font(ArcDesign.Typography.headline)
                                    .foregroundColor(ArcDesign.Colors.primaryText)
                                
                                Text(template.description)
                                    .font(ArcDesign.Typography.caption)
                                    .foregroundColor(ArcDesign.Colors.secondaryText)
                            }
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12))
                                .foregroundColor(ArcDesign.Colors.tertiaryText)
                        }
                        .padding(ArcDesign.Spacing.md)
                        .frame(maxWidth: .infinity)
                        .arcCard()
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            
            HStack {
                Button("Cancel") {
                    showNewChatSheet = false
                }
                .buttonStyle(PlainButtonStyle())
                
                Spacer()
                
                Button("Blank Chat") {
                    createNewChat(with: nil)
                }
                .arcButton()
            }
        }
        .padding(ArcDesign.Spacing.xl)
        .frame(width: 480, height: 400)
    }
    
    private var conversationTemplates: [ConversationTemplate] {
        [
            ConversationTemplate(
                title: "General Assistant",
                description: "Get help with questions, analysis, and general tasks",
                icon: "brain.head.profile",
                color: ArcDesign.Colors.accentBlue
            ),
            ConversationTemplate(
                title: "Code Helper",
                description: "Programming assistance, debugging, and code review",
                icon: "laptopcomputer",
                color: ArcDesign.Colors.accentPurple
            ),
            ConversationTemplate(
                title: "Creative Writing",
                description: "Storytelling, content creation, and creative projects",
                icon: "pencil.and.outline",
                color: ArcDesign.Colors.accentPink
            ),
            ConversationTemplate(
                title: "Research & Analysis",
                description: "Data analysis, research assistance, and insights",
                icon: "chart.bar",
                color: ArcDesign.Colors.accentGreen
            )
        ]
    }
    
    // MARK: - Actions
    private func setupInitialState() {
        updateFilteredChats()
        
        // Create initial chat if none exists
        if appState.chats.isEmpty {
            _ = appState.createNewChat()
        }
    }
    
    private func updateFilteredChats() {
        if searchText.isEmpty {
            filteredChats = appState.chats
        } else {
            filteredChats = appState.chats.filter { chat in
                chat.title.localizedCaseInsensitiveContains(searchText) ||
                chat.messages.contains { message in
                    message.content.localizedCaseInsensitiveContains(searchText)
                }
            }
        }
    }
    
    private func selectChat(_ chat: Chat) {
        appState.selectChat(chat)
        selectedMessage = nil
        showingMessageActions.removeAll()
    }
    
    private func deleteChat(_ chat: Chat) {
        appState.deleteChat(chat)
    }
    
    private func sendMessage() {
        guard canSendMessage else { return }
        
        let content = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        messageText = ""
        isComposing = false
        isLoadingResponse = true
        errorMessage = nil
        
        Task {
            do {
                await appState.sendMessage(content)
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    logger.error("Failed to send message: \(error)")
                }
            }
            
            await MainActor.run {
                isLoadingResponse = false
            }
        }
    }
    
    private func setPrompt(_ prompt: String) {
        messageText = prompt
        isComposing = true
    }
    
    private func toggleVoiceRecording() {
        showVoiceRecording.toggle()
        // TODO: Implement voice recording functionality
    }
    
    private func clearChat() {
        guard let currentChat = appState.currentChat else { return }
        appState.deleteChat(currentChat)
        _ = appState.createNewChat()
    }
    
    private func exportChat() {
        // TODO: Implement chat export functionality
        logger.info("Export chat requested")
    }
    
    private func createNewChat(with template: ConversationTemplate?) {
        let newChat = appState.createNewChat()
        
        if let template = template {
            newChat.title = template.title
            // TODO: Add template-specific initialization
        }
        
        showNewChatSheet = false
    }
    
    private func scrollToBottom() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(ArcDesign.Animation.spring) {
                if isLoadingResponse {
                    scrollProxy?.scrollTo("typing-indicator", anchor: .bottom)
                } else if let lastMessage = appState.currentChat?.messages.last {
                    scrollProxy?.scrollTo(lastMessage.id, anchor: .bottom)
                }
            }
        }
    }
}

// MARK: - Conversation List Item
struct ConversationListItem: View {
    let chat: Chat
    let isSelected: Bool
    let onSelect: () -> Void
    let onDelete: () -> Void
    
    @State private var isHovered = false
    @State private var showDeleteConfirmation = false
    
    var body: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            VStack(alignment: .leading, spacing: 4) {
                Text(chat.title)
                    .font(ArcDesign.Typography.callout)
                    .fontWeight(isSelected ? .medium : .regular)
                    .foregroundColor(isSelected ? ArcDesign.Colors.primaryText : ArcDesign.Colors.secondaryText)
                    .lineLimit(1)
                
                if let lastMessage = chat.messages.last {
                    Text(lastMessage.content)
                        .font(ArcDesign.Typography.caption)
                        .foregroundColor(ArcDesign.Colors.tertiaryText)
                        .lineLimit(2)
                }
                
                Text(formatChatDate(chat.updatedAt))
                    .font(ArcDesign.Typography.caption2)
                    .foregroundColor(ArcDesign.Colors.quaternaryText)
            }
            
            Spacer()
            
            if isHovered {
                Button(action: { showDeleteConfirmation = true }) {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .foregroundColor(ArcDesign.Colors.error)
                }
                .buttonStyle(PlainButtonStyle())
                .confirmationDialog("Delete Conversation", isPresented: $showDeleteConfirmation) {
                    Button("Delete", role: .destructive) {
                        onDelete()
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("This conversation will be permanently deleted.")
                }
            }
        }
        .padding(.horizontal, ArcDesign.Spacing.sm)
        .padding(.vertical, ArcDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                .fill(isSelected ? ArcDesign.Colors.accentBlue.opacity(0.1) : (isHovered ? Color.white.opacity(0.05) : Color.clear))
        )
        .overlay(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                .stroke(isSelected ? ArcDesign.Colors.accentBlue.opacity(0.3) : Color.clear, lineWidth: 1)
        )
        .onTapGesture {
            onSelect()
        }
        .onHover { hovering in
            isHovered = hovering
        }
    }
    
    private func formatChatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        
        if Calendar.current.isDateInToday(date) {
            formatter.timeStyle = .short
            formatter.dateStyle = .none
        } else if Calendar.current.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            formatter.dateStyle = .short
            formatter.timeStyle = .none
        }
        
        return formatter.string(from: date)
    }
}

// MARK: - Conversation Template
struct ConversationTemplate {
    let title: String
    let description: String
    let icon: String
    let color: Color
}

// MARK: - Preview
struct ArcChatView_Previews: PreviewProvider {
    static var previews: some View {
        let appState = AppState()
        let apiService = APIService()
        
        // Add sample chat
        let sampleChat = appState.createNewChat()
        sampleChat.title = "Swift Programming Help"
        sampleChat.messages = [
            Message(role: .user, content: "How do I create a custom SwiftUI view with animations?"),
            Message(role: .assistant, content: "I'll help you create a custom SwiftUI view with animations. Here's a step-by-step approach:\n\n1. **Basic Structure**: Start with a basic view\n2. **Add State**: Use @State for animation triggers\n3. **Apply Animations**: Use .animation() modifier\n\nHere's an example:\n\n```swift\nstruct AnimatedButton: View {\n    @State private var isPressed = false\n    \n    var body: some View {\n        Button(\"Tap Me\") {\n            withAnimation(.spring()) {\n                isPressed.toggle()\n            }\n        }\n        .scaleEffect(isPressed ? 1.2 : 1.0)\n        .foregroundColor(isPressed ? .blue : .primary)\n    }\n}\n```\n\nThis creates a button that animates when tapped with a spring animation.", model: "gpt-4")
        ]
        
        return ArcChatView()
            .environmentObject(appState)
            .environmentObject(apiService)
            .frame(width: 1200, height: 800)
    }
}