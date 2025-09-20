import SwiftUI

// MARK: - Agent Planner View

struct AgentPlannerView: View {
    @StateObject private var chatManager = ChatManager()
    @State private var inputText = ""
    
    var body: some View {
        VStack {
            Text("🤖 Agent Planner")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding()
            
            Text("Strategic planning and task orchestration")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding(.bottom)
            
            ChatView()
                .environmentObject(chatManager)
        }
        .frame(minWidth: 800, minHeight: 600)
    }
}

// MARK: - Research Agent View

struct ResearchAgentView: View {
    @StateObject private var chatManager = ChatManager()
    
    var body: some View {
        VStack {
            Text("🔬 Research Agent")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding()
            
            Text("Research and information gathering")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding(.bottom)
            
            ChatView()
                .environmentObject(chatManager)
        }
        .frame(minWidth: 800, minHeight: 600)
    }
}

// MARK: - Implementation Agent View

struct ImplementationAgentView: View {
    @StateObject private var chatManager = ChatManager()
    
    var body: some View {
        VStack {
            Text("⚙️ Implementation Agent")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding()
            
            Text("Code generation and implementation")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding(.bottom)
            
            ChatView()
                .environmentObject(chatManager)
        }
        .frame(minWidth: 800, minHeight: 600)
    }
}

// MARK: - HRM Agent View

struct HRMAgentView: View {
    @StateObject private var chatManager = ChatManager()
    
    var body: some View {
        VStack {
            Text("🧠 HRM Agent")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding()
            
            Text("Human Reasoning Models")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding(.bottom)
            
            ChatView()
                .environmentObject(chatManager)
        }
        .frame(minWidth: 800, minHeight: 600)
    }
}

// MARK: - Knowledge Management View

struct KnowledgeManagementView: View {
    @State private var searchQuery = ""
    @State private var searchResults: [KnowledgeResult] = []
    @State private var isSearching = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            VStack(spacing: 8) {
                Text("🧠 Knowledge Management")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Search and manage your knowledge base")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding()
            
            // Search Section
            HStack {
                TextField("Search knowledge...", text: $searchQuery)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .onSubmit {
                        performSearch()
                    }
                
                Button("Search") {
                    performSearch()
                }
                .disabled(searchQuery.isEmpty || isSearching)
                
                Button("Add Knowledge") {
                    // TODO: Implement add knowledge functionality
                }
                .buttonStyle(.bordered)
            }
            .padding(.horizontal)
            
            // Results Section
            if isSearching {
                ProgressView("Searching...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if searchResults.isEmpty && !searchQuery.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)
                    
                    Text("No results found")
                        .font(.title2)
                        .foregroundColor(.secondary)
                    
                    Text("Try different search terms or add new knowledge")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if searchResults.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 48))
                        .foregroundColor(.blue)
                    
                    Text("Knowledge Base Ready")
                        .font(.title2)
                        .fontWeight(.medium)
                    
                    Text("Search for existing knowledge or add new content")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(searchResults) { result in
                            KnowledgeResultRow(result: result)
                        }
                    }
                    .padding()
                }
            }
            
            Spacer()
        }
        .frame(minWidth: 900, minHeight: 650)
    }
    
    private func performSearch() {
        guard !searchQuery.isEmpty else { return }
        
        isSearching = true
        
        Task {
            do {
                let results = try await searchKnowledge(query: searchQuery)
                await MainActor.run {
                    self.searchResults = results
                    self.isSearching = false
                }
            } catch {
                await MainActor.run {
                    self.searchResults = []
                    self.isSearching = false
                }
                print("Search failed: \(error)")
            }
        }
    }
    
    private func searchKnowledge(query: String) async throws -> [KnowledgeResult] {
        guard let url = URL(string: "http://localhost:8088/api/v1/search") else {
            throw KnowledgeError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "query": query,
            "limit": 10
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw KnowledgeError.invalidResponse
        }
        
        let searchResponse = try JSONDecoder().decode(KnowledgeSearchResponse.self, from: data)
        return searchResponse.results
    }
}

// MARK: - Knowledge Result Row

struct KnowledgeResultRow: View {
    let result: KnowledgeResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(result.title)
                    .font(.headline)
                
                Spacer()
                
                Text(result.type.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(4)
            }
            
            Text(result.content)
                .font(.body)
                .foregroundColor(.secondary)
                .lineLimit(3)
            
            HStack {
                Text("Source: \(result.source)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text("Relevance: \(Int(result.relevance * 100))%")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - Chat View

struct ChatView: View {
    @EnvironmentObject var chatManager: ChatManager
    @State private var messageText = ""
    @State private var useKnowledge = true
    
    var body: some View {
        VStack(spacing: 0) {
            // Chat Header
            HStack(alignment: .center) {
                Text("💬 Chat")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Toggle("Use Knowledge", isOn: $useKnowledge)
                        .toggleStyle(SwitchToggleStyle())
                        .scaleEffect(0.9)
                    
                    Button("Clear") {
                        chatManager.clearMessages()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(Color.gray.opacity(0.05))
            
            Divider()
            
            // Messages
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(chatManager.messages) { message in
                        MessageRow(message: message)
                    }
                    
                    if chatManager.isLoading {
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Thinking...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 16)
                    }
                }
                .padding(.vertical, 16)
            }
            
            Divider()
            
            // Enhanced Message Input
            VStack(spacing: 12) {
                HStack(alignment: .bottom, spacing: 12) {
                    // Enhanced text field
                    TextField("Type your message...", text: $messageText, axis: .vertical)
                        .textFieldStyle(PlainTextFieldStyle())
                        .lineLimit(1...4)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.gray.opacity(0.08))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                                )
                        )
                        .shadow(color: Color.gray.opacity(0.1), radius: 2, x: 0, y: 1)
                    
                    // Enhanced send button
                    Button(action: sendMessage) {
                        HStack(spacing: 6) {
                            Image(systemName: "paperplane.fill")
                                .font(.system(size: 14, weight: .medium))
                            Text("Send")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                    }
                    .disabled(messageText.isEmpty || chatManager.isLoading)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        messageText.isEmpty ? Color.gray : Color.blue,
                                        messageText.isEmpty ? Color.gray.opacity(0.8) : Color.blue.opacity(0.8)
                                    ]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .shadow(color: Color.blue.opacity(0.3), radius: 4, x: 0, y: 2)
                    )
                    .scaleEffect(messageText.isEmpty ? 0.95 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: messageText.isEmpty)
                }
                
                // Knowledge toggle with better styling
                HStack {
                    Toggle("Use Knowledge Base", isOn: $useKnowledge)
                        .toggleStyle(SwitchToggleStyle(tint: .blue))
                        .scaleEffect(0.9)
                    
                    Spacer()
                    
                    if chatManager.isLoading {
                        HStack(spacing: 6) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("Thinking...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.gray.opacity(0.03),
                        Color.clear
                    ]),
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
    }
    
    private func sendMessage() {
        guard !messageText.isEmpty else { return }
        
        let text = messageText
        messageText = ""
        
        Task {
            await chatManager.sendMessage(text, useKnowledge: useKnowledge)
        }
    }
}

struct MessageRow: View {
    let message: ChatMessage
    
    @State private var isVisible = false
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.isUser {
                Spacer(minLength: 60)
            }
            
            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 8) {
                // Message bubble with enhanced styling
                Text(message.content)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 14)
                    .background(
                        ZStack {
                            // Base background
                            RoundedRectangle(cornerRadius: 20)
                                .fill(
                                    message.isUser ? 
                                    LinearGradient(
                                        gradient: Gradient(colors: [.blue, .blue.opacity(0.8)]),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ) :
                                    LinearGradient(
                                        gradient: Gradient(colors: [
                                            Color.gray.opacity(0.12),
                                            Color.gray.opacity(0.08)
                                        ]),
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                            
                            // Subtle shadow
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(
                                    message.isUser ? 
                                    Color.blue.opacity(0.3) : 
                                    Color.gray.opacity(0.2),
                                    lineWidth: 1
                                )
                        }
                    )
                    .foregroundColor(message.isUser ? .white : .primary)
                    .shadow(
                        color: message.isUser ? 
                        Color.blue.opacity(0.2) : 
                        Color.gray.opacity(0.1),
                        radius: 2,
                        x: 0,
                        y: 1
                    )
                    .frame(maxWidth: .infinity * 0.75, alignment: message.isUser ? .trailing : .leading)
                    .scaleEffect(isVisible ? 1.0 : 0.8)
                    .opacity(isVisible ? 1.0 : 0.0)
                    .animation(.spring(response: 0.4, dampingFraction: 0.8).delay(0.1), value: isVisible)
                
                // Metadata row
                HStack(spacing: 8) {
                    if !message.isUser {
                        Text(message.source)
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundColor(.blue)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(Color.blue.opacity(0.1))
                                    .overlay(
                                        Capsule()
                                            .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                                    )
                            )
                    }
                    
                    Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .opacity(isVisible ? 1.0 : 0.0)
                        .animation(.easeInOut(duration: 0.3).delay(0.3), value: isVisible)
                }
            }
            
            if !message.isUser {
                Spacer(minLength: 60)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .onAppear {
            withAnimation {
                isVisible = true
            }
        }
    }
}

// MARK: - Data Models

struct KnowledgeResult: Identifiable, Codable {
    let id: String
    let title: String
    let content: String
    let source: String
    let type: String
    let relevance: Double
    let timestamp: Date
    
    enum CodingKeys: String, CodingKey {
        case id, title, content, source, type, relevance, timestamp
    }
}

struct KnowledgeSearchResponse: Decodable {
    let results: [KnowledgeResult]
    let count: Int
}

enum KnowledgeError: Error {
    case invalidURL
    case invalidResponse
    case networkError
}
