import SwiftUI

struct EnhancedChatView: View {
    @StateObject private var chatService = ChatService()
    @ObservedObject var authManager: DeviceAuthenticationManager
    @State private var messageText = ""
    @State private var showingAgentSelector = false
    @State private var showingSearchSheet = false
    @State private var searchQuery = ""
    @State private var searchResults: [ChatMessage] = []
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Status and Agent Bar
                VStack(spacing: 8) {
                    // Connection Status
                    HStack {
                        Circle()
                            .fill(connectionStatusColor)
                            .frame(width: 12, height: 12)
                        
                        Text(connectionStatusText)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Button("Reconnect") {
                            Task {
                                await chatService.checkConnection()
                                await chatService.loadAvailableAgents()
                            }
                        }
                        .font(.caption)
                        .disabled(chatService.connectionState == .connecting)
                    }
                    
                    // Selected Agent Bar
                    HStack {
                        Button(action: {
                            showingAgentSelector = true
                        }) {
                            HStack {
                                Image(systemName: chatService.selectedAgent.categoryIcon)
                                    .foregroundColor(.blue)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(chatService.selectedAgent.displayName)
                                        .font(.headline)
                                        .foregroundColor(.primary)
                                    
                                    Text(chatService.selectedAgent.description)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .lineLimit(1)
                                }
                                
                                Spacer()
                                
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(12)
                }
                .padding(.horizontal)
                .padding(.top, 8)
                
                Divider()
                
                // Chat Messages
                ScrollViewReader { scrollProxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(chatService.messages) { message in
                                EnhancedChatBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: chatService.messages.count) { _ in
                        if let lastMessage = chatService.messages.last {
                            withAnimation(.easeOut(duration: 0.3)) {
                                scrollProxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                }
                
                Divider()
                
                // Message Input
                HStack {
                    TextField("Type your message...", text: $messageText)
                        .textFieldStyle(.roundedBorder)
                        .onSubmit {
                            sendMessage()
                        }
                    
                    Button(action: {
                        sendMessage()
                    }) {
                        Image(systemName: "paperplane.fill")
                            .foregroundColor(messageText.isEmpty ? .gray : .blue)
                            .font(.title2)
                    }
                    .disabled(messageText.isEmpty || chatService.connectionState != .connected)
                }
                .padding()
            }
            .navigationTitle("Universal AI Chat")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing:
                    Menu {
                        Button(action: {
                            showingSearchSheet = true
                        }) {
                            Label("Search Messages", systemImage: "magnifyingglass")
                        }
                        
                        Button(action: {
                            exportMessages()
                        }) {
                            Label("Export Chat", systemImage: "square.and.arrow.up")
                        }
                        
                        Button(role: .destructive, action: {
                            chatService.clearMessages()
                        }) {
                            Label("Clear Chat", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
            )
        }
        .sheet(isPresented: $showingAgentSelector) {
            AgentSelectorSheet(
                selectedAgent: $chatService.selectedAgent,
                availableAgents: chatService.availableAgents,
                onAgentSelected: { agent in
                    chatService.switchAgent(to: agent)
                }
            )
        }
        .sheet(isPresented: $showingSearchSheet) {
            ChatSearchSheet(
                searchQuery: $searchQuery,
                chatService: chatService,
                searchResults: $searchResults
            )
        }
        .onReceive(authManager.$authenticationState) { state in
            if state == .authenticated, let token = authManager.authToken {
                chatService.setAuthToken(token)
            }
        }
        .onAppear {
            if let token = authManager.authToken {
                chatService.setAuthToken(token)
            }
        }
    }
    
    private var connectionStatusColor: Color {
        switch chatService.connectionState {
        case .connected:
            return .green
        case .connecting:
            return .yellow
        case .disconnected, .error:
            return .red
        }
    }
    
    private var connectionStatusText: String {
        switch chatService.connectionState {
        case .connected:
            return "Connected to Universal AI Tools"
        case .connecting:
            return "Connecting..."
        case .disconnected:
            return "Disconnected"
        case .error:
            return "Connection Error"
        }
    }
    
    private func sendMessage() {
        let message = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }
        
        messageText = ""
        
        Task {
            await chatService.sendMessage(message)
        }
    }
    
    private func exportMessages() {
        let exportText = chatService.exportMessages()
        let activityView = UIActivityViewController(activityItems: [exportText], applicationActivities: nil)
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.rootViewController?.present(activityView, animated: true)
        }
    }
}

struct EnhancedChatBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isFromUser {
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text(message.text)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(18)
                    
                    HStack(spacing: 4) {
                        Text(message.timeText)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                .frame(maxWidth: UIScreen.main.bounds.width * 0.75, alignment: .trailing)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text(message.displayText)
                        .padding()
                        .background(Color.gray.opacity(0.15))
                        .foregroundColor(.primary)
                        .cornerRadius(18)
                    
                    HStack(spacing: 8) {
                        Text(message.timeText)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        if let confidenceText = message.confidenceText {
                            Text(confidenceText)
                                .font(.caption2)
                                .foregroundColor(.green)
                        }
                    }
                }
                .frame(maxWidth: UIScreen.main.bounds.width * 0.75, alignment: .leading)
                
                Spacer()
            }
        }
    }
}

struct AgentSelectorSheet: View {
    @Binding var selectedAgent: Agent
    let availableAgents: [Agent]
    let onAgentSelected: (Agent) -> Void
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            List {
                ForEach(agentsByCategory.keys.sorted(), id: \.self) { category in
                    Section(category.capitalized) {
                        ForEach(agentsByCategory[category] ?? []) { agent in
                            AgentRow(
                                agent: agent,
                                isSelected: agent.name == selectedAgent.name,
                                onSelect: {
                                    selectedAgent = agent
                                    onAgentSelected(agent)
                                    dismiss()
                                }
                            )
                        }
                    }
                }
            }
            .navigationTitle("Select Agent")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing:
                    Button("Done") {
                        dismiss()
                    }
            )
        }
    }
    
    private var agentsByCategory: [String: [Agent]] {
        Dictionary(grouping: availableAgents, by: { $0.category })
    }
}

struct AgentRow: View {
    let agent: Agent
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack {
                Image(systemName: agent.categoryIcon)
                    .foregroundColor(.blue)
                    .frame(width: 24)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(agent.displayName)
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Text(agent.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                    
                    Text(agent.capabilityText)
                        .font(.caption2)
                        .foregroundColor(.blue)
                        .lineLimit(1)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundColor(.blue)
                        .font(.headline)
                }
                
                VStack {
                    Circle()
                        .fill(agent.loaded ? Color.green : Color.gray)
                        .frame(width: 8, height: 8)
                    
                    Text("\(agent.maxLatencyMs)ms")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

struct ChatSearchSheet: View {
    @Binding var searchQuery: String
    let chatService: ChatService
    @Binding var searchResults: [ChatMessage]
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack {
                SearchBar(text: $searchQuery, onSearchButtonClicked: {
                    searchResults = chatService.searchMessages(query: searchQuery)
                })
                
                if searchResults.isEmpty && !searchQuery.isEmpty {
                    VStack {
                        Spacer()
                        Image(systemName: "magnifyingglass")
                            .font(.largeTitle)
                            .foregroundColor(.gray)
                        Text("No Results")
                            .font(.headline)
                        Text("No messages found for '\(searchQuery)'")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                } else {
                    List(searchResults) { message in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(message.displayText)
                                .font(.body)
                            
                            HStack {
                                Text(message.dateText + " " + message.timeText)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                Text(message.isFromUser ? "You" : (message.agentName ?? "Assistant"))
                                    .font(.caption)
                                    .foregroundColor(.blue)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            .navigationTitle("Search Messages")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(trailing:
                    Button("Done") {
                        dismiss()
                    }
            )
        }
        .onChange(of: searchQuery) { _ in
            if !searchQuery.isEmpty {
                searchResults = chatService.searchMessages(query: searchQuery)
            } else {
                searchResults = []
            }
        }
    }
}

struct SearchBar: View {
    @Binding var text: String
    let onSearchButtonClicked: () -> Void
    
    var body: some View {
        HStack {
            TextField("Search messages...", text: $text)
                .textFieldStyle(.roundedBorder)
                .onSubmit {
                    onSearchButtonClicked()
                }
            
            Button("Search", action: onSearchButtonClicked)
                .disabled(text.isEmpty)
        }
        .padding()
    }
}

#Preview {
    EnhancedChatView(authManager: DeviceAuthenticationManager())
}