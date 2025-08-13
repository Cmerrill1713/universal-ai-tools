import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var searchText = ""
    @State private var showQuickChat = false
    @State private var quickMessage = ""

    var body: some View {
        VStack(spacing: 0) {
            // Header with connection status
            headerSection

            Divider()

            // Quick Actions
            quickActionsSection

            Divider()

            // Active Agents
            if !appState.activeAgents.isEmpty {
                activeAgentsSection
                Divider()
            }

            // Recent Chats
            recentChatsSection

            Divider()

            // Quick Chat Input
            if showQuickChat {
                quickChatSection
                Divider()
            }

            // Footer Actions
            footerSection
        }
        .frame(width: 300)
        .background(Color(NSColor.windowBackgroundColor))
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            Image(systemName: "brain")
                .font(.title2)
                .foregroundColor(.accentColor)

            VStack(alignment: .leading, spacing: 2) {
                Text("Universal AI Tools")
                    .font(.headline)

                HStack(spacing: 4) {
                    Circle()
                        .fill(appState.backendConnected ? Color.green : Color.red)
                        .frame(width: 6, height: 6)

                    Text(appState.backendConnected ? "Connected" : "Disconnected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Settings Button
            Button(action: openSettings) {
                Image(systemName: "gearshape")
                    .foregroundColor(.secondary)
            }
            .buttonStyle(BorderlessButtonStyle())
        }
        .padding()
    }

    // MARK: - Quick Actions

    private var quickActionsSection: some View {
        VStack(spacing: 8) {
            HStack {
                TextField("Search or ask anything...", text: $searchText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .onSubmit {
                        performQuickSearch()
                    }

                Button(action: performQuickSearch) {
                    Image(systemName: "magnifyingglass")
                }
                .buttonStyle(BorderlessButtonStyle())
            }

            HStack(spacing: 8) {
                MenuQuickActionButton(
                    icon: "message",
                    title: "Chat",
                    action: { showQuickChat.toggle() }
                )

                MenuQuickActionButton(
                    icon: "cpu",
                    title: "Agents",
                    action: openAgentsPanel
                )

                MenuQuickActionButton(
                    icon: "doc.text",
                    title: "Context",
                    action: openContextManager
                )

                MenuQuickActionButton(
                    icon: "chart.line.uptrend.xyaxis",
                    title: "Monitor",
                    action: openMonitoring
                )
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // MARK: - Active Agents

    private var activeAgentsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Active Agents")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.horizontal)

            ForEach(appState.activeAgents.prefix(3)) { agent in
                ActiveAgentRow(agent: agent)
            }

            if appState.activeAgents.count > 3 {
                Button(action: openAgentsPanel) {
                    Text("View all \(appState.activeAgents.count) agents →")
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.horizontal)
            }
        }
        .padding(.vertical, 8)
    }

    // MARK: - Recent Chats

    private var recentChatsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Recent Chats")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Button(action: startNewChat) {
                    Image(systemName: "plus")
                        .font(.caption)
                }
                .buttonStyle(BorderlessButtonStyle())
            }
            .padding(.horizontal)

            ScrollView {
                VStack(spacing: 4) {
                    ForEach(appState.recentChats.prefix(5)) { chat in
                        RecentChatRow(chat: chat) {
                            openChat(chat)
                        }
                    }
                }
            }
            .frame(maxHeight: 150)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Quick Chat

    private var quickChatSection: some View {
        VStack(spacing: 8) {
            Text("Quick Chat")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack {
                TextField("Type a message...", text: $quickMessage)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .onSubmit {
                        sendQuickMessage()
                    }

                Button(action: sendQuickMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .foregroundColor(quickMessage.isEmpty ? .gray : .accentColor)
                }
                .buttonStyle(BorderlessButtonStyle())
                .disabled(quickMessage.isEmpty)
            }

            // Quick response area
            if let lastResponse = appState.lastQuickResponse {
                ScrollView {
                    Text(lastResponse)
                        .font(.caption)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(NSColor.controlBackgroundColor))
                        .cornerRadius(6)
                }
                .frame(maxHeight: 100)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // MARK: - Footer

    private var footerSection: some View {
        HStack {
            Button(action: openMainWindow) {
                Label("Open App", systemImage: "arrow.up.forward.app")
                    .font(.caption)
            }
            .buttonStyle(BorderlessButtonStyle())

            Spacer()

            Menu {
                Button("Preferences...", action: openPreferences)
                Button("Check for Updates...", action: checkForUpdates)
                Divider()
                Button("About", action: showAbout)
                Divider()
                Button("Quit", action: quitApp)
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.caption)
            }
            .menuStyle(BorderlessButtonMenuStyle())
        }
        .padding()
    }

    // MARK: - Actions

    private func performQuickSearch() {
        guard !searchText.isEmpty else { return }

        // Perform search/query
        Task {
            do {
                let response = try await apiService.sendChatMessage(
                    searchText,
                    chatId: "quick-search"
                )

                await MainActor.run {
                    appState.lastQuickResponse = response.content
                    searchText = ""
                }
            } catch {
                print("Quick search failed:", error)
            }
        }
    }

    private func sendQuickMessage() {
        guard !quickMessage.isEmpty else { return }

        Task {
            do {
                let response = try await apiService.sendChatMessage(
                    quickMessage,
                    chatId: "quick-chat"
                )

                await MainActor.run {
                    appState.lastQuickResponse = response.content
                    quickMessage = ""
                }
            } catch {
                print("Quick message failed:", error)
            }
        }
    }

    private func openMainWindow() {
        NSApplication.shared.activate(ignoringOtherApps: true)

        // Find and activate the main window safely
        for window in NSApplication.shared.windows {
            if window.title == "Universal AI Tools" || window.isMainWindow {
                window.makeKeyAndOrderFront(nil)
                return
            }
        }

        // If no main window found, just activate the app
        if let window = NSApplication.shared.windows.first {
            window.makeKeyAndOrderFront(nil)
        }
    }

    private func openSettings() {
        appState.showSettings = true
        openMainWindow()
    }

    private func openAgentsPanel() {
        appState.selectedSidebarItem = .objectives
        openMainWindow()
    }

    private func openContextManager() {
        appState.selectedSidebarItem = .tools
        appState.selectedTool = .knowledge
        openMainWindow()
    }

    private func openMonitoring() {
        appState.selectedSidebarItem = .tools
        appState.selectedTool = .monitoring
        openMainWindow()
    }

    private func startNewChat() {
        appState.currentChat = Chat(
            id: UUID().uuidString,
            title: "New Chat",
            model: "gpt-4",
            messages: []
        )
        appState.selectedSidebarItem = .chat
        openMainWindow()
    }

    private func openChat(_ chat: Chat) {
        appState.currentChat = chat
        appState.selectedSidebarItem = .chat
        openMainWindow()
    }

    private func openPreferences() {
        appState.showSettings = true
        openMainWindow()
    }

    private func checkForUpdates() {
        // Implement update check
        NSWorkspace.shared.open(URL(string: "https://github.com/Cmerrill1713/universal-ai-tools/releases")!)
    }

    private func showAbout() {
        NSApplication.shared.orderFrontStandardAboutPanel(nil)
    }

    private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}

// MARK: - Supporting Views

struct MenuQuickActionButton: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.title3)
                Text(title)
                    .font(.caption2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(6)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct ActiveAgentRow: View {
    let agent: Agent

    var statusColor: Color {
        switch agent.status {
        case .active: return .green
        case .busy: return .orange
        case .error: return .red
        case .inactive: return .gray
        }
    }

    var body: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)

            Text(agent.name)
                .font(.caption)
                .lineLimit(1)

            Spacer()

            Text(agent.type)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            // Open agent details
        }
    }
}

struct RecentChatRow: View {
    let chat: Chat
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: "message")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(chat.title)
                    .font(.caption)
                    .lineLimit(1)

                Spacer()

                if let lastMessage = chat.messages.last {
                    Text(formatTimestamp(lastMessage.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
