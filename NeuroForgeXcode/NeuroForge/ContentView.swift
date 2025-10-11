import SwiftUI

struct ContentView: View {
    @StateObject private var chatService = ChatService()
    @State private var messageText = ""
    @State private var isLoading = false
    @FocusState private var isTextFieldFocused: Bool
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView
            
            Divider()
            
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        ForEach(chatService.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                        
                        if isLoading {
                            HStack {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .scaleEffect(0.7)
                                Text("AI is thinking...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                        }
                    }
                    .padding()
                }
                .onChange(of: chatService.messages.count) { _ in
                    if let lastMessage = chatService.messages.last {
                        withAnimation {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }
            
            Divider()
            
            // Input area
            inputView
        }
        .frame(minWidth: 600, minHeight: 400)
        .onAppear {
            isTextFieldFocused = true
            Task {
                await chatService.checkConnection()
            }
        }
    }
    
    private var headerView: some View {
        HStack {
            Image(systemName: "brain.head.profile")
                .font(.title)
                .foregroundColor(.purple)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("NeuroForge AI")
                    .font(.headline)
                HStack(spacing: 4) {
                    Circle()
                        .fill(chatService.isConnected ? Color.green : Color.red)
                        .frame(width: 8, height: 8)
                    Text(chatService.isConnected ? "Connected" : "Disconnected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Text("\(chatService.messages.count) messages")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.secondary.opacity(0.1))
                .cornerRadius(8)
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
    }
    
    private var inputView: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // Use TextEditor instead of TextField for better macOS compatibility
            ZStack(alignment: .topLeading) {
                if messageText.isEmpty {
                    Text("Ask NeuroForge anything...")
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .allowsHitTesting(false)
                }
                
                TextEditor(text: $messageText)
                    .font(.body)
                    .focused($isTextFieldFocused)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 40, maxHeight: 120)
                    .padding(8)
                    .background(Color(nsColor: .textBackgroundColor))
                    .cornerRadius(12)
                    .onAppear {
                        // Force focus on appear
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            isTextFieldFocused = true
                        }
                    }
            }
            
            Button(action: sendMessage) {
                Image(systemName: isLoading ? "stop.circle.fill" : "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundColor(messageText.isEmpty ? .gray : .purple)
            }
            .buttonStyle(.plain)
            .disabled(messageText.isEmpty || isLoading)
            .keyboardShortcut(.return, modifiers: [.command])
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
    }
    
    private func sendMessage() {
        print("🔔 Send button triggered")
        guard !messageText.isEmpty else {
            print("⚠️ Message is empty, ignoring")
            return
        }
        
        let text = messageText
        print("📝 Sending message: '\(text)'")
        messageText = ""
        isLoading = true
        
        Task {
            print("⏳ Starting async task to send message")
            await chatService.sendMessage(text)
            isLoading = false
            isTextFieldFocused = true
            print("✅ Message send complete, UI updated")
        }
    }
}

struct MessageBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isUser {
                Spacer()
            }
            
            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 4) {
                Text(message.text)
                    .padding(12)
                    .background(message.isUser ? Color.purple : Color.secondary.opacity(0.2))
                    .foregroundColor(message.isUser ? .white : .primary)
                    .cornerRadius(12)
                
                Text(formatDate(message.timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: 500, alignment: message.isUser ? .trailing : .leading)
            
            if !message.isUser {
                Spacer()
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

