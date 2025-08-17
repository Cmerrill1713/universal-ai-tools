import SwiftUI
import Foundation
import Combine

// MARK: - Main App
@main
struct ArcUIDemoApp: App {
    @StateObject private var appState = MockAppState()
    @StateObject private var apiService = MockAPIService()
    
    var body: some Scene {
        WindowGroup {
            ArcContentView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .frame(minWidth: 900, minHeight: 600)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified)
    }
}

// MARK: - Main Content View
struct ArcContentView: View {
    @EnvironmentObject var appState: MockAppState
    @EnvironmentObject var apiService: MockAPIService
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    
    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            ArcSidebar()
                .frame(minWidth: 260)
        } detail: {
            ArcDetailView()
        }
        .navigationSplitViewStyle(.balanced)
        .background(AppTheme.primaryBackground)
    }
}

// MARK: - Arc Sidebar
struct ArcSidebar: View {
    @EnvironmentObject var appState: MockAppState
    @State private var searchText = ""
    @State private var showNewChatMenu = false
    @State private var hoveredConversation: UUID?
    @State private var editingConversation: UUID?
    @State private var editingTitle = ""
    
    private var sidebarSelectionBinding: Binding<SidebarItem?> {
        Binding<SidebarItem?>(
            get: { appState.selectedSidebarItem },
            set: { newValue in
                if let newValue = newValue {
                    appState.selectedSidebarItem = newValue
                }
            }
        )
    }
    
    // Grouped conversations by date
    var groupedConversations: [(String, [Chat])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: appState.chats) { chat in
            if calendar.isDateInToday(chat.updatedAt) {
                return "Today"
            } else if calendar.isDateInYesterday(chat.updatedAt) {
                return "Yesterday"
            } else {
                return "This Week"
            }
        }
        
        let order = ["Today", "Yesterday", "This Week"]
        return order.compactMap { key in
            if let chats = grouped[key] {
                return (key, chats.sorted { $0.updatedAt > $1.updatedAt })
            }
            return nil
        }
    }
    
    // Filtered conversations based on search
    var filteredConversations: [(String, [Chat])] {
        if searchText.isEmpty {
            return groupedConversations
        } else {
            return groupedConversations.compactMap { group, chats in
                let filtered = chats.filter { chat in
                    chat.title.localizedCaseInsensitiveContains(searchText) ||
                    chat.messages.contains { $0.content.localizedCaseInsensitiveContains(searchText) }
                }
                return filtered.isEmpty ? nil : (group, filtered)
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with New Chat button
            sidebarHeader
            
            // Search bar
            searchBar
            
            Divider()
                .background(AppTheme.separator)
            
            // Conversations list
            conversationsList
            
            Divider()
                .background(AppTheme.separator)
            
            // Bottom actions
            bottomActions
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.sidebarBackground)
    }
    
    // MARK: - Header
    private var sidebarHeader: some View {
        HStack(spacing: 12) {
            // Logo or brand
            Image(systemName: "cpu.fill")
                .font(.system(size: 18))
                .foregroundColor(AppTheme.accentBlue)
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(AppTheme.accentBlue.opacity(0.1))
                )
            
            Text("Arc UI Demo")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(AppTheme.primaryText)
            
            Spacer()
            
            // New chat button
            Button(action: { showNewChatMenu.toggle() }) {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.secondaryText)
                    .frame(width: 28, height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color.white.opacity(0.1))
                    )
            }
            .buttonStyle(PlainButtonStyle())
            .help("Start new chat")
            .popover(isPresented: $showNewChatMenu) {
                NewChatMenu(onSelect: startNewChat)
                    .frame(width: 220, height: 280)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
    
    // MARK: - Search Bar
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13))
                .foregroundColor(AppTheme.tertiaryText)
            
            TextField("Search conversations...", text: $searchText)
                .textFieldStyle(PlainTextFieldStyle())
                .font(.system(size: 13))
                .foregroundColor(AppTheme.primaryText)
            
            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.tertiaryText)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.white.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(AppTheme.separator, lineWidth: 1)
        )
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
    
    // MARK: - Conversations List
    private var conversationsList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: .sectionHeaders) {
                    ForEach(filteredConversations, id: \.0) { group, chats in
                        Section(header: sectionHeader(group)) {
                            ForEach(chats) { chat in
                                ConversationRow(
                                    chat: chat,
                                    isSelected: appState.currentChat?.id == chat.id,
                                    isHovered: hoveredConversation == chat.id,
                                    isEditing: editingConversation == chat.id,
                                    editingTitle: $editingTitle,
                                    onSelect: { selectChat(chat) },
                                    onDelete: { deleteChat(chat) },
                                    onRename: { startRenaming(chat) },
                                    onCommitRename: { commitRename(chat) },
                                    onDuplicate: { duplicateChat(chat) }
                                )
                                .onHover { hovering in
                                    withAnimation(.easeInOut(duration: 0.15)) {
                                        hoveredConversation = hovering ? chat.id : nil
                                    }
                                }
                                .id(chat.id)
                            }
                        }
                    }
                    
                    // Empty state
                    if filteredConversations.isEmpty {
                        emptyState
                    }
                }
                .padding(.vertical, 8)
            }
            .onChange(of: appState.currentChat?.id) { chatId in
                if let id = chatId {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        proxy.scrollTo(id, anchor: .center)
                    }
                }
            }
        }
    }
    
    // MARK: - Section Header
    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(AppTheme.tertiaryText)
                .textCase(.uppercase)
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(AppTheme.sidebarBackground.opacity(0.95))
    }
    
    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: searchText.isEmpty ? "message" : "magnifyingglass")
                .font(.system(size: 32))
                .foregroundColor(AppTheme.tertiaryText)
            
            Text(searchText.isEmpty ? "No conversations yet" : "No results found")
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(AppTheme.secondaryText)
            
            if searchText.isEmpty {
                Text("Start a new chat to begin")
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.tertiaryText)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    // MARK: - Bottom Actions
    private var bottomActions: some View {
        VStack(spacing: 8) {
            // User profile button
            Button(action: { }) {
                HStack {
                    Circle()
                        .fill(LinearGradient(
                            gradient: Gradient(colors: [AppTheme.accentOrange, AppTheme.accentOrange.opacity(0.8)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 28, height: 28)
                        .overlay(
                            Text("D")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.white)
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Demo User")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text("Free Plan")
                            .font(.system(size: 10))
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                    
                    Spacer()
                    
                    Image(systemName: "ellipsis")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.tertiaryText)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.white.opacity(0.05))
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
    
    // MARK: - Actions
    private func selectChat(_ chat: Chat) {
        appState.currentChat = chat
        appState.selectedSidebarItem = .chat
    }
    
    private func deleteChat(_ chat: Chat) {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chats.removeAll { $0.id == chat.id }
            if appState.currentChat?.id == chat.id {
                appState.currentChat = nil
            }
        }
    }
    
    private func startRenaming(_ chat: Chat) {
        editingTitle = chat.title
        editingConversation = chat.id
    }
    
    private func commitRename(_ chat: Chat) {
        if !editingTitle.isEmpty {
            if let index = appState.chats.firstIndex(where: { $0.id == chat.id }) {
                appState.chats[index].title = editingTitle
                if appState.currentChat?.id == chat.id {
                    appState.currentChat?.title = editingTitle
                }
            }
        }
        editingConversation = nil
        editingTitle = ""
    }
    
    private func duplicateChat(_ chat: Chat) {
        let newChat = Chat(
            title: "\(chat.title) (Copy)",
            messages: chat.messages
        )
        
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chats.insert(newChat, at: 0)
            appState.currentChat = newChat
        }
    }
    
    private func startNewChat(with template: ChatTemplate) {
        let newChat = Chat(
            title: template.title,
            messages: []
        )
        
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chats.insert(newChat, at: 0)
            appState.currentChat = newChat
            appState.selectedSidebarItem = .chat
        }
        
        showNewChatMenu = false
    }
}

// MARK: - Detail View
struct ArcDetailView: View {
    @EnvironmentObject var appState: MockAppState
    
    var body: some View {
        Group {
            switch appState.selectedSidebarItem ?? .chat {
            case .chat:
                ArcChatView()
            case .claude:
                ArcClaudeView()
            case .knowledge:
                ArcKnowledgeView()
            case .objectives:
                ArcObjectivesView()
            case .orchestration:
                ArcOrchestrationView()
            case .analytics:
                ArcAnalyticsView()
            case .tools:
                ArcToolsView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.primaryBackground)
    }
}

// MARK: - Chat View
struct ArcChatView: View {
    @EnvironmentObject var appState: MockAppState
    @State private var inputText = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Chat messages
            ScrollView {
                LazyVStack(spacing: 16) {
                    if let chat = appState.currentChat {
                        ForEach(chat.messages) { message in
                            MessageBubble(message: message)
                        }
                    } else {
                        EmptyChatState()
                    }
                }
                .padding()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // Input area
            VStack(spacing: 0) {
                Divider().background(AppTheme.separator)
                
                HStack {
                    TextField("Type a message...", text: $inputText, axis: .vertical)
                        .textFieldStyle(PlainTextFieldStyle())
                        .font(.system(size: 14))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(AppTheme.inputBackground)
                        .cornerRadius(12)
                        .onSubmit {
                            sendMessage()
                        }
                    
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(inputText.isEmpty ? AppTheme.tertiaryText : AppTheme.accentBlue)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding()
            }
            .background(AppTheme.secondaryBackground)
        }
    }
    
    private func sendMessage() {
        let content = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        
        if appState.currentChat == nil {
            appState.currentChat = Chat(title: "New Chat")
            appState.chats.insert(appState.currentChat!, at: 0)
        }
        
        let userMessage = Message(role: .user, content: content)
        appState.currentChat?.addMessage(userMessage)
        inputText = ""
        
        // Simulate AI response
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            let aiMessage = Message(role: .assistant, content: "This is a demo response to: \(content)")
            appState.currentChat?.addMessage(aiMessage)
        }
    }
}

// MARK: - Empty Chat State
struct EmptyChatState: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.tertiaryText)
            
            Text("Start a conversation")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(AppTheme.primaryText)
            
            Text("Choose a template or type your first message")
                .font(.body)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Message Bubble
struct MessageBubble: View {
    let message: Message
    
    var body: some View {
        HStack {
            if message.role == .user {
                Spacer(minLength: 60)
            }
            
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.primaryText)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(message.role == .user ? AppTheme.accentBlue.opacity(0.1) : AppTheme.secondaryBackground)
                    )
                
                Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundColor(AppTheme.tertiaryText)
                    .padding(.horizontal, 4)
            }
            
            if message.role == .assistant {
                Spacer(minLength: 60)
            }
        }
    }
}

// MARK: - Other Detail Views (Placeholders)
struct ArcClaudeView: View {
    var body: some View {
        PlaceholderView(
            icon: "brain.head.profile",
            title: "Claude AI",
            description: "Direct access to Claude AI assistant"
        )
    }
}

struct ArcKnowledgeView: View {
    var body: some View {
        PlaceholderView(
            icon: "point.3.connected.trianglepath.dotted",
            title: "Knowledge Graph",
            description: "Explore connected knowledge and insights"
        )
    }
}

struct ArcObjectivesView: View {
    var body: some View {
        PlaceholderView(
            icon: "target",
            title: "Objectives",
            description: "Manage goals and track progress"
        )
    }
}

struct ArcOrchestrationView: View {
    var body: some View {
        PlaceholderView(
            icon: "network",
            title: "Agent Orchestration",
            description: "Coordinate multiple AI agents"
        )
    }
}

struct ArcAnalyticsView: View {
    var body: some View {
        PlaceholderView(
            icon: "chart.bar.doc.horizontal",
            title: "Analytics",
            description: "Performance insights and metrics"
        )
    }
}

struct ArcToolsView: View {
    var body: some View {
        PlaceholderView(
            icon: "wrench.and.screwdriver",
            title: "Tools",
            description: "Available tools and utilities"
        )
    }
}

struct PlaceholderView: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(AppTheme.accentBlue)
            
            Text(title)
                .font(.title)
                .fontWeight(.semibold)
                .foregroundColor(AppTheme.primaryText)
            
            Text(description)
                .font(.body)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Models
struct Chat: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var messages: [Message]
    let createdAt: Date
    var updatedAt: Date
    
    init(id: UUID = UUID(), title: String = "New Chat", messages: [Message] = []) {
        self.id = id
        self.title = title
        self.messages = messages
        self.createdAt = Date()
        self.updatedAt = Date()
    }
    
    mutating func addMessage(_ message: Message) {
        messages.append(message)
        updatedAt = Date()
        
        // Auto-generate title from first user message if still default
        if title == "New Chat", message.role == .user, !message.content.isEmpty {
            title = String(message.content.prefix(30)) + (message.content.count > 30 ? "..." : "")
        }
    }
}

struct Message: Identifiable, Codable, Hashable {
    let id: UUID
    let role: MessageRole
    let content: String
    let timestamp: Date
    
    init(id: UUID = UUID(), role: MessageRole, content: String, timestamp: Date = Date()) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
    }
    
    enum MessageRole: String, Codable, CaseIterable {
        case user = "user"
        case assistant = "assistant"
        case system = "system"
    }
}

enum SidebarItem: String, CaseIterable, Identifiable, Hashable {
    case chat = "chat"
    case claude = "claude"
    case knowledge = "knowledge"
    case objectives = "objectives"
    case orchestration = "orchestration"
    case analytics = "analytics"
    case tools = "tools"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .chat: return "Chat"
        case .claude: return "Claude AI"
        case .knowledge: return "Knowledge"
        case .objectives: return "Objectives"
        case .orchestration: return "Orchestration"
        case .analytics: return "Analytics"
        case .tools: return "Tools"
        }
    }
    
    var icon: String {
        switch self {
        case .chat: return "text.bubble"
        case .claude: return "brain.head.profile"
        case .knowledge: return "point.3.connected.trianglepath.dotted"
        case .objectives: return "target"
        case .orchestration: return "network"
        case .analytics: return "chart.bar.doc.horizontal"
        case .tools: return "wrench.and.screwdriver"
        }
    }
}

// MARK: - Mock App State
@MainActor
class MockAppState: ObservableObject {
    @Published var chats: [Chat] = []
    @Published var currentChat: Chat?
    @Published var selectedSidebarItem: SidebarItem? = .chat
    
    init() {
        loadSampleData()
    }
    
    private func loadSampleData() {
        let sampleChats = [
            Chat(
                title: "SwiftUI Architecture Discussion",
                messages: [
                    Message(role: .user, content: "What are the best practices for SwiftUI architecture?"),
                    Message(role: .assistant, content: "Here are some key SwiftUI architecture best practices:\n\n1. Use MVVM pattern\n2. Leverage @StateObject and @ObservedObject properly\n3. Keep views simple and focused\n4. Use environment objects for shared state\n5. Implement proper data flow patterns")
                ]
            ),
            Chat(
                title: "macOS App Development",
                messages: [
                    Message(role: .user, content: "How do I create a native macOS app with SwiftUI?"),
                    Message(role: .assistant, content: "To create a native macOS app with SwiftUI, you'll want to:\n\n1. Use WindowGroup for basic windows\n2. Implement NavigationSplitView for sidebar layouts\n3. Use native macOS controls and behaviors\n4. Follow Apple's Human Interface Guidelines")
                ]
            ),
            Chat(
                title: "Performance Optimization",
                messages: [
                    Message(role: .user, content: "How can I optimize SwiftUI performance?")
                ]
            )
        ]
        
        self.chats = sampleChats
        self.currentChat = sampleChats.first
    }
}

// MARK: - Mock API Service
class MockAPIService: ObservableObject {
    @Published var isConnected = true
    @Published var availableModels: [String] = ["gpt-4", "claude-3", "local-llm"]
}

// MARK: - Conversation Row Component
struct ConversationRow: View {
    let chat: Chat
    let isSelected: Bool
    let isHovered: Bool
    let isEditing: Bool
    @Binding var editingTitle: String
    
    let onSelect: () -> Void
    let onDelete: () -> Void
    let onRename: () -> Void
    let onCommitRename: () -> Void
    let onDuplicate: () -> Void
    
    @State private var showActions = false
    
    var body: some View {
        HStack(spacing: 8) {
            // Icon
            Image(systemName: iconName)
                .font(.system(size: 13))
                .foregroundColor(iconColor)
                .frame(width: 20)
            
            // Title or editing field
            if isEditing {
                TextField("Chat title", text: $editingTitle, onCommit: onCommitRename)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(.system(size: 13))
                    .foregroundColor(AppTheme.primaryText)
                    .onExitCommand {
                        editingTitle = chat.title
                        onCommitRename()
                    }
            } else {
                Text(chat.title)
                    .font(.system(size: 13))
                    .foregroundColor(textColor)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            
            Spacer()
            
            // Action buttons (show on hover)
            if (isHovered || showActions) && !isEditing {
                HStack(spacing: 4) {
                    ActionButton(
                        icon: "pencil",
                        label: "Rename",
                        action: onRename
                    )
                    
                    ActionButton(
                        icon: "doc.on.doc",
                        label: "Duplicate",
                        action: onDuplicate
                    )
                    
                    ActionButton(
                        icon: "trash",
                        label: "Delete",
                        action: onDelete
                    )
                }
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(backgroundView)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
        .contextMenu {
            Button("Rename", action: onRename)
            Button("Duplicate", action: onDuplicate)
            Divider()
            Button("Delete", role: .destructive, action: onDelete)
        }
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                showActions = hovering
            }
        }
    }
    
    private var iconName: String {
        chat.messages.isEmpty ? "bubble.left" : "bubble.left.and.bubble.right"
    }
    
    private var iconColor: Color {
        isSelected ? AppTheme.accentBlue : AppTheme.secondaryText
    }
    
    private var textColor: Color {
        isSelected ? AppTheme.primaryText : AppTheme.secondaryText
    }
    
    @ViewBuilder
    private var backgroundView: some View {
        if isSelected {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(AppTheme.accentBlue.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(AppTheme.accentBlue.opacity(0.3), lineWidth: 1)
                )
        } else if isHovered {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.white.opacity(0.05))
        } else {
            Color.clear
        }
    }
}

// MARK: - Action Button
struct ActionButton: View {
    let icon: String
    let label: String
    let action: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(AppTheme.tertiaryText)
                .frame(width: 20, height: 20)
                .background(
                    Circle()
                        .fill(isHovered ? Color.white.opacity(0.1) : Color.clear)
                )
        }
        .buttonStyle(PlainButtonStyle())
        .help(label)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.1)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - New Chat Menu
struct NewChatMenu: View {
    let onSelect: (ChatTemplate) -> Void
    @Environment(\.dismiss) private var dismiss
    
    let templates = ChatTemplate.defaultTemplates
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Start New Chat")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding(12)
            
            Divider()
                .background(AppTheme.separator)
            
            // Template list
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(templates) { template in
                        TemplateRow(
                            template: template,
                            onSelect: {
                                onSelect(template)
                                dismiss()
                            }
                        )
                    }
                }
                .padding(12)
            }
        }
        .background(AppTheme.popupBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppTheme.separator, lineWidth: 1)
        )
    }
}

// MARK: - Template Row
struct TemplateRow: View {
    let template: ChatTemplate
    let onSelect: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                // Icon
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(template.color.opacity(0.15))
                        .frame(width: 36, height: 36)
                    
                    Image(systemName: template.icon)
                        .font(.system(size: 16))
                        .foregroundColor(template.color)
                }
                
                // Text
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(template.description)
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.tertiaryText)
                        .lineLimit(1)
                }
                
                Spacer()
                
                // Arrow
                Image(systemName: "arrow.right")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.tertiaryText)
                    .opacity(isHovered ? 1 : 0)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(isHovered ? Color.white.opacity(0.05) : Color.clear)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Chat Template
struct ChatTemplate: Identifiable {
    let id = UUID()
    let title: String
    let description: String
    let icon: String
    let color: Color
    
    static let defaultTemplates = [
        ChatTemplate(
            title: "General Chat",
            description: "Start a general conversation",
            icon: "bubble.left.and.bubble.right",
            color: AppTheme.accentBlue
        ),
        ChatTemplate(
            title: "Code Assistant",
            description: "Get help with programming",
            icon: "chevron.left.forwardslash.chevron.right",
            color: AppTheme.accentGreen
        ),
        ChatTemplate(
            title: "Creative Writing",
            description: "Generate creative content",
            icon: "pencil.and.outline",
            color: Color.purple
        ),
        ChatTemplate(
            title: "Research & Analysis",
            description: "Deep dive into topics",
            icon: "magnifyingglass.circle",
            color: Color.orange
        )
    ]
}

// MARK: - App Theme
enum AppTheme {
    // MARK: - Core Colors (ChatGPT-inspired)
    static let primaryBackground = Color(hex: "343541") // Dark charcoal
    static let secondaryBackground = Color(hex: "444654") // Lighter charcoal
    static let tertiaryBackground = Color(hex: "202123") // Darker accent
    static let surfaceBackground = Color(hex: "40414F") // Card/surface color
    
    // Text colors
    static let primaryText = Color.white
    static let secondaryText = Color.white.opacity(0.7)
    static let tertiaryText = Color.white.opacity(0.5)
    static let quaternaryText = Color.white.opacity(0.3)
    
    // Accent colors
    static let accentGreen = Color(hex: "10A37F") // ChatGPT green
    static let accentOrange = Color(hex: "FF8C42") // Orange accent
    static let accentBlue = Color(hex: "19C3E6") // Blue accent
    static let accentColor = accentGreen // Default accent color
    static let destructiveColor = Color.red // Destructive actions
    static let borderColor = Color.white.opacity(0.1) // Border color
    
    // MARK: - Input & Interactive Elements
    static let inputBackground = Color(hex: "40414F")
    static let inputBorder = Color.white.opacity(0.1)
    static let buttonBackground = accentGreen
    static let buttonHover = accentGreen.opacity(0.8)
    
    // MARK: - Popup & Modal
    static let popupBackground = Color(hex: "202123")
    static let popupBorder = Color.white.opacity(0.1)
    static let overlayBackground = Color.black.opacity(0.5)
    
    // MARK: - Sidebar
    static let sidebarBackground = tertiaryBackground
    static let sidebarItemHover = Color.white.opacity(0.05)
    static let sidebarItemSelected = Color.white.opacity(0.1)
    
    // MARK: - Misc
    static let separator = Color.white.opacity(0.1)
    static let scrollbarBackground = Color.white.opacity(0.05)
    static let scrollbarThumb = Color.white.opacity(0.2)
}

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}