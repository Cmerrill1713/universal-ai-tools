import SwiftUI

struct IntelligentChatView: View {
    @StateObject private var chatService = IntelligentChatService()
    @EnvironmentObject var connectionService: ConnectionStatusService
    @State private var newMessage: String = ""
    @State private var showingDetails = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Connection Status Header
                ConnectionHeaderView(
                    connectionService: connectionService,
                    chatService: chatService,
                    showingDetails: $showingDetails
                )
                
                // Messages List
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(chatService.messages) { message in
                                MessageBubbleView(message: message)
                                    .id(message.id)
                            }
                            
                            // Loading indicator
                            if chatService.isLoading {
                                LoadingMessageView()
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                    .onChange(of: chatService.messages.count) {
                        withAnimation(.easeOut(duration: 0.3)) {
                            if let lastMessage = chatService.messages.last {
                                proxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                }
                
                // Input Area
                MessageInputView(
                    newMessage: $newMessage,
                    isLoading: chatService.isLoading,
                    isConnected: connectionService.backendState == .connected
                ) {
                    await sendMessage()
                }
            }
            .navigationTitle("AI Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("Test Connection") {
                            Task {
                                await chatService.testConnection()
                            }
                        }
                        
                        Button("Clear Chat") {
                            chatService.clearChat()
                        }
                        
                        Button(showingDetails ? "Hide Details" : "Show Details") {
                            showingDetails.toggle()
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .task {
            await chatService.testConnection()
        }
    }
    
    private func sendMessage() async {
        let message = newMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        newMessage = ""
        
        await chatService.sendMessage(message)
    }
}

// MARK: - Connection Header

struct ConnectionHeaderView: View {
    @ObservedObject var connectionService: ConnectionStatusService
    @ObservedObject var chatService: IntelligentChatService
    @Binding var showingDetails: Bool
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Circle()
                    .fill(statusColor)
                    .frame(width: 10, height: 10)
                
                Text(chatService.connectionStatus)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if chatService.isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                }
                
                Button(showingDetails ? "Hide Details" : "Details") {
                    showingDetails.toggle()
                }
                .font(.caption2)
                .foregroundColor(.blue)
            }
            
            // Detailed Status
            if showingDetails {
                VStack(spacing: 4) {
                    Divider()
                    
                    HStack {
                        Text("Backend:")
                        Spacer()
                        Text(connectionService.backendStatusText)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    
                    if let error = chatService.lastError {
                        HStack {
                            Text("Last Error:")
                            Spacer()
                            Text(error)
                                .font(.caption2)
                                .foregroundColor(.red)
                                .lineLimit(1)
                                .truncationMode(.tail)
                        }
                    }
                }
                .font(.caption)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
    }
    
    private var statusColor: Color {
        if chatService.isLoading {
            return .orange
        } else if chatService.isConnected {
            return .green
        } else {
            return .red
        }
    }
}

// MARK: - Message Bubble

struct MessageBubbleView: View {
    let message: ChatMessage
    @State private var showingDetails = false
    
    var body: some View {
        HStack {
            if message.isUser {
                Spacer(minLength: 50)
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text(message.content)
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(18, corners: [.topLeft, .topRight, .bottomLeft])
                    
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        if let agent = message.agentUsed, agent != "system" && agent != "error" {
                            AgentBadge(agentName: agent, confidence: message.confidence)
                        }
                        Spacer()
                    }
                    
                    Text(message.content)
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)
                        .background(message.agentUsed == "error" ? Color.red.opacity(0.1) : Color(.systemGray5))
                        .foregroundColor(message.agentUsed == "error" ? .red : .primary)
                        .cornerRadius(18, corners: [.topLeft, .topRight, .bottomRight])
                    
                    HStack {
                        Text(formatTime(message.timestamp))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        if let processingTime = message.processingTime {
                            Text("• \(String(format: "%.1fs", processingTime / 1000))")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                    }
                }
                
                Spacer(minLength: 50)
            }
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Agent Badge

struct AgentBadge: View {
    let agentName: String
    let confidence: Double?
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: agentIcon)
                .font(.caption2)
                .foregroundColor(agentColor)
            
            Text(agentDisplayName)
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(agentColor)
            
            if let confidence = confidence {
                Text("\(Int(confidence * 100))%")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 2)
        .background(agentColor.opacity(0.1))
        .cornerRadius(8)
    }
    
    private var agentDisplayName: String {
        switch agentName.lowercased() {
        case "planner": return "Planner"
        case "synthesizer": return "Synthesizer"
        case "retriever": return "Researcher"
        case "personal_assistant": return "Assistant"
        case "code_assistant": return "Coder"
        case "athena": return "Athena"
        default: return agentName.capitalized
        }
    }
    
    private var agentIcon: String {
        switch agentName.lowercased() {
        case "planner": return "list.bullet.clipboard"
        case "synthesizer": return "wand.and.rays"
        case "retriever": return "magnifyingglass"
        case "personal_assistant": return "person.fill.checkmark"
        case "code_assistant": return "chevron.left.forwardslash.chevron.right"
        case "athena": return "brain.head.profile"
        default: return "cpu"
        }
    }
    
    private var agentColor: Color {
        switch agentName.lowercased() {
        case "planner": return .blue
        case "synthesizer": return .purple
        case "retriever": return .green
        case "personal_assistant": return .orange
        case "code_assistant": return .red
        case "athena": return .indigo
        default: return .gray
        }
    }
}

// MARK: - Loading Message

struct LoadingMessageView: View {
    @State private var animationOffset: CGFloat = -200
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "brain.head.profile")
                        .font(.caption2)
                        .foregroundColor(.blue)
                    
                    Text("Thinking...")
                        .font(.caption2)
                        .foregroundColor(.blue)
                }
                
                HStack(spacing: 4) {
                    ForEach(0..<3) { index in
                        Circle()
                            .fill(Color.gray.opacity(0.6))
                            .frame(width: 8, height: 8)
                            .scaleEffect(1.0)
                            .animation(
                                Animation.easeInOut(duration: 0.6)
                                    .repeatForever()
                                    .delay(Double(index) * 0.2),
                                value: animationOffset
                            )
                    }
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 16)
                .background(Color(.systemGray5))
                .cornerRadius(18, corners: [.topLeft, .topRight, .bottomRight])
            }
            
            Spacer(minLength: 50)
        }
        .onAppear {
            animationOffset = 200
        }
    }
}

// MARK: - Message Input

struct MessageInputView: View {
    @Binding var newMessage: String
    let isLoading: Bool
    let isConnected: Bool
    let sendAction: () async -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            Divider()
            
            HStack(spacing: 12) {
                TextField("Message...", text: $newMessage, axis: .vertical)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .lineLimit(1...5)
                    .disabled(isLoading || !isConnected)
                    .onSubmit {
                        Task {
                            await sendAction()
                        }
                    }
                
                Button {
                    Task {
                        await sendAction()
                    }
                } label: {
                    Image(systemName: isLoading ? "stop.circle.fill" : "paperplane.fill")
                        .font(.title2)
                        .foregroundColor(canSend ? .blue : .gray)
                }
                .disabled(!canSend)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Color(.systemBackground))
    }
    
    private var canSend: Bool {
        !newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && 
        !isLoading && 
        isConnected
    }
}

// MARK: - Corner Radius Extension

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

#Preview {
    IntelligentChatView()
        .environmentObject(ConnectionStatusService())
}