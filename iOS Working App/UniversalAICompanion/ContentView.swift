import SwiftUI
import Foundation

struct ChatMessage: Identifiable {
    let id = UUID()
    let text: String
    let isFromUser: Bool
    let timestamp: Date = Date()
}

enum ConnectionState {
    case connecting
    case connected
    case disconnected
    case error
}

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var connectionState: ConnectionState = .disconnected
    @Published var messageText = ""
    
    private var authToken: String?
    
    init() {
        Task {
            await checkConnection()
        }
    }
    
    func setAuthToken(_ token: String) {
        self.authToken = token
        Task {
            await checkConnection()
        }
    }
    
    func checkConnection() async {
        connectionState = .connecting
        
        do {
            let url = URL(string: "http://localhost:9999/health")!
            let (_, response) = try await URLSession.shared.data(from: url)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                connectionState = .connected
                print("✅ Connected to Universal AI Tools backend")
                
                // Add welcome message
                let welcomeMessage = ChatMessage(
                    text: "Connected to Universal AI Tools! How can I help you today?",
                    isFromUser: false
                )
                messages.append(welcomeMessage)
            } else {
                connectionState = .error
            }
        } catch {
            connectionState = .disconnected
            print("❌ Failed to connect: \(error)")
            
            // Add offline message
            let offlineMessage = ChatMessage(
                text: "Cannot connect to Universal AI Tools backend. Make sure the server is running on localhost:9999",
                isFromUser: false
            )
            messages.append(offlineMessage)
        }
    }
    
    func sendMessage() {
        guard !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        let userMessage = ChatMessage(text: messageText, isFromUser: true)
        messages.append(userMessage)
        
        let currentMessage = messageText
        messageText = ""
        
        Task {
            await sendToBackend(message: currentMessage)
        }
    }
    
    private func sendToBackend(message: String) async {
        do {
            let url = URL(string: "http://localhost:9999/api/v1/chat")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            // Add authentication header if available
            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let requestBody = [
                "message": message,
                "user_id": "ios_authenticated_user"
            ]
            
            let jsonData = try JSONSerialization.data(withJSONObject: requestBody)
            request.httpBody = jsonData
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200,
               let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let successData = responseData["data"] as? [String: Any],
               let messageData = successData["message"] as? [String: Any],
               let aiResponse = messageData["content"] as? String {
                
                let aiMessage = ChatMessage(text: aiResponse, isFromUser: false)
                messages.append(aiMessage)
            } else {
                let errorMessage = ChatMessage(
                    text: "Sorry, I'm having trouble connecting to the server right now.",
                    isFromUser: false
                )
                messages.append(errorMessage)
            }
        } catch {
            let errorMessage = ChatMessage(
                text: "Network error: \(error.localizedDescription)",
                isFromUser: false
            )
            messages.append(errorMessage)
        }
    }
}

struct ContentView: View {
    @StateObject private var authManager = DeviceAuthenticationManager()
    @StateObject private var chatViewModel = ChatViewModel()
    
    var body: some View {
        TabView {
            // Authentication Tab
            AuthenticationView()
                .tabItem {
                    Image(systemName: "lock.shield")
                    Text("Authentication")
                }
                .environmentObject(authManager)
            
            // Chat Tab - Only available when authenticated
            if authManager.authenticationState == .authenticated {
                ChatView(viewModel: chatViewModel, authManager: authManager)
                    .tabItem {
                        Image(systemName: "message")
                        Text("Chat")
                    }
            }
        }
        .onReceive(authManager.$authenticationState) { state in
            // Pass auth token to chat when authenticated
            if state == .authenticated, let token = authManager.authToken {
                chatViewModel.setAuthToken(token)
            }
        }
    }
}

struct ChatView: View {
    @ObservedObject var viewModel: ChatViewModel
    @ObservedObject var authManager: DeviceAuthenticationManager
    
    var body: some View {
        NavigationView {
            VStack {
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
                            await viewModel.checkConnection()
                        }
                    }
                    .font(.caption)
                    .disabled(viewModel.connectionState == .connecting)
                }
                .padding(.horizontal)
                .padding(.top, 8)
                
                // Chat Messages
                ScrollViewReader { scrollProxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(viewModel.messages) { message in
                                ChatBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: viewModel.messages.count) { _ in
                        if let lastMessage = viewModel.messages.last {
                            withAnimation {
                                scrollProxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                }
                
                // Message Input
                HStack {
                    TextField("Type your message...", text: $viewModel.messageText)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .onSubmit {
                            viewModel.sendMessage()
                        }
                    
                    Button(action: {
                        viewModel.sendMessage()
                    }) {
                        Image(systemName: "paperplane.fill")
                            .foregroundColor(viewModel.messageText.isEmpty ? .gray : .blue)
                    }
                    .disabled(viewModel.messageText.isEmpty || viewModel.connectionState != .connected)
                }
                .padding()
            }
            .navigationTitle("Universal AI Tools")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
    
    private var connectionStatusColor: Color {
        switch viewModel.connectionState {
        case .connected:
            return .green
        case .connecting:
            return .yellow
        case .disconnected, .error:
            return .red
        }
    }
    
    private var connectionStatusText: String {
        switch viewModel.connectionState {
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
}

struct ChatBubble: View {
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
                    
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: UIScreen.main.bounds.width * 0.7, alignment: .trailing)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text(message.text)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .foregroundColor(.primary)
                        .cornerRadius(18)
                    
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: UIScreen.main.bounds.width * 0.7, alignment: .leading)
                
                Spacer()
            }
        }
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

#Preview {
    ContentView()
}