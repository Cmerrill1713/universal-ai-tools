import SwiftUI

// MARK: - Modern Sidebar (ChatGPT-style)
struct ModernSidebar: View {
    @Binding var selection: SidebarItem?
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var searchText = ""
    @State private var showNewChatMenu = false
    @State private var hoveredConversation: String?
    @State private var editingConversation: String?
    @State private var editingTitle = ""

    // Grouped conversations by date
    var groupedConversations: [(String, [Chat])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: appState.chatHistory) { chat in
            let components = calendar.dateComponents([.year, .month, .day], from: chat.updatedAt)
            if calendar.isDateInToday(chat.updatedAt) {
                return "Today"
            } else if calendar.isDateInYesterday(chat.updatedAt) {
                return "Yesterday"
            } else if let date = calendar.date(from: components),
                      calendar.dateComponents([.weekOfYear], from: date, to: Date()).weekOfYear == 0 {
                return "This Week"
            } else if let date = calendar.date(from: components),
                      calendar.dateComponents([.month], from: date, to: Date()).month == 0 {
                return "This Month"
            } else {
                return "Older"
            }
        }

        let order = ["Today", "Yesterday", "This Week", "This Month", "Older"]
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

            Text("Universal AI")
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
            Button(action: { appState.showSettings = true }) {
                HStack {
                    Circle()
                        .fill(LinearGradient(
                            gradient: Gradient(colors: [AppTheme.accentOrange, AppTheme.accentOrange.opacity(0.8)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 28, height: 28)
                        .overlay(
                            Text(String(NSFullUserName().prefix(1).uppercased()))
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.white)
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(NSFullUserName())
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppTheme.primaryText)

                        Text(appState.planType.rawValue)
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
            .onHover { hovering in
                if hovering {
                    NSCursor.pointingHand.push()
                } else {
                    NSCursor.pop()
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Actions
    private func selectChat(_ chat: Chat) {
        appState.currentChat = chat
        selection = .chat
    }

    private func deleteChat(_ chat: Chat) {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chatHistory.removeAll { $0.id == chat.id }
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
            if let index = appState.chatHistory.firstIndex(where: { $0.id == chat.id }) {
                appState.chatHistory[index].title = editingTitle
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
            id: UUID().uuidString,
            title: "\(chat.title) (Copy)",
            model: chat.model,
            messages: chat.messages
        )

        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chatHistory.insert(newChat, at: 0)
            appState.currentChat = newChat
        }
    }

    private func startNewChat(with template: ChatTemplate) {
        let newChat = Chat(
            id: UUID().uuidString,
            title: template.title,
            model: template.defaultModel,
            messages: []
        )

        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chatHistory.insert(newChat, at: 0)
            appState.currentChat = newChat
            selection = .chat
        }

        showNewChatMenu = false
    }
}
