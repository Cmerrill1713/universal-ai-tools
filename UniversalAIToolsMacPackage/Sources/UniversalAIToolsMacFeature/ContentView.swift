import SwiftUI
import Speech
import AVFoundation
import Foundation
import UniformTypeIdentifiers

// MARK: - HTTP Service for Backend Communication
@MainActor
@Observable
class BackendService {
    static let shared = BackendService()
    
    private let baseURL = "http://127.0.0.1:9999"
    private let session = URLSession.shared
    private let apiKey = "dev-universal-ai-tools-key-2025" // Default dev API key
    
    var isConnected = false
    var lastError: String?
    
    // Response caching system
    private struct CachedResponse {
        let data: Data
        let timestamp: Date
        let ttl: TimeInterval
        
        var isExpired: Bool {
            Date().timeIntervalSince(timestamp) > ttl
        }
    }
    
    private var cache: [String: CachedResponse] = [:]
    private let cacheQueue = DispatchQueue(label: "BackendService.cache", qos: .utility)
    
    private init() {
        checkConnection()
        // Periodically clean expired cache entries
        Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { _ in
            self.cleanExpiredCache()
        }
    }
    
    private func createAuthenticatedRequest(url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }
    
    private func generateCacheKey(url: String, method: String, body: Data? = nil) -> String {
        var key = "\(method):\(url)"
        if let body = body {
            let bodyHash = body.hashValue
            key += ":\(bodyHash)"
        }
        return key
    }
    
    private func getCachedResponse(for key: String) -> Data? {
        return cacheQueue.sync {
            guard let cached = cache[key], !cached.isExpired else {
                cache.removeValue(forKey: key)
                return nil
            }
            return cached.data
        }
    }
    
    private func setCachedResponse(_ data: Data, for key: String, ttl: TimeInterval = 300) {
        cacheQueue.async {
            self.cache[key] = CachedResponse(data: data, timestamp: Date(), ttl: ttl)
        }
    }
    
    private func cleanExpiredCache() {
        cacheQueue.async {
            let now = Date()
            self.cache = self.cache.filter { !$0.value.isExpired }
        }
    }
    
    private func performCachedRequest(
        url: URL,
        method: String = "GET",
        body: Data? = nil,
        cacheTTL: TimeInterval = 300,
        useCache: Bool = true
    ) async throws -> Data {
        let cacheKey = generateCacheKey(url: url.absoluteString, method: method, body: body)
        
        // Try cache first if enabled
        if useCache, let cachedData = getCachedResponse(for: cacheKey) {
            return cachedData
        }
        
        // Make network request
        var request = createAuthenticatedRequest(url: url)
        request.httpMethod = method
        if let body = body {
            request.httpBody = body
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw BackendError.requestFailed
        }
        
        // Cache successful responses
        if useCache {
            setCachedResponse(data, for: cacheKey, ttl: cacheTTL)
        }
        
        return data
    }
    
    func checkConnection() {
        Task {
            do {
                let url = URL(string: "\(baseURL)/api/v1/chat/conversations")!
                let request = createAuthenticatedRequest(url: url)
                let (_, response) = try await session.data(for: request)
                if let httpResponse = response as? HTTPURLResponse {
                    isConnected = (200...299).contains(httpResponse.statusCode)
                }
            } catch {
                isConnected = false
                lastError = error.localizedDescription
            }
        }
    }
    
    func sendChatMessage(_ message: String) async throws -> BackendChatResponse {
        let url = URL(string: "\(baseURL)/api/v1/chat")!
        var request = createAuthenticatedRequest(url: url)
        request.httpMethod = "POST"
        
        let body = ChatRequest(message: message, conversationId: nil)
        request.httpBody = try JSONEncoder().encode(body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw BackendError.requestFailed
        }
        
        let result = try JSONDecoder().decode(BackendChatAPIResponse.self, from: data)
        return BackendChatResponse(
            id: result.data.message.id,
            response: result.data.message.content,
            conversationId: result.data.conversationId
        )
    }
    
    func getConversations() async throws -> [BackendConversation] {
        let url = URL(string: "\(baseURL)/api/v1/chat/conversations")!
        let data = try await performCachedRequest(url: url, method: "GET", cacheTTL: 60) // Cache for 1 minute
        
        let result = try JSONDecoder().decode(BackendConversationsResponse.self, from: data)
        return result.data.conversations
    }
    
    func analyzeImage(imageBase64: String, analysisType: String = "general") async throws -> VisionAnalysisResponse {
        let url = URL(string: "\(baseURL)/api/v1/vision/analyze")!
        let body = VisionAnalysisRequest(imageBase64: imageBase64, analysisType: analysisType)
        let requestData = try JSONEncoder().encode(body)
        
        // Cache vision analysis for 30 minutes (same image + analysis type)
        let data = try await performCachedRequest(
            url: url,
            method: "POST",
            body: requestData,
            cacheTTL: 1800,
            useCache: true
        )
        
        return try JSONDecoder().decode(VisionAnalysisResponse.self, from: data)
    }
    
    func transcribeAudio(audioBase64: String) async throws -> TranscriptionResponse {
        let url = URL(string: "\(baseURL)/api/v1/voice/transcribe")!
        var request = createAuthenticatedRequest(url: url)
        request.httpMethod = "POST"
        
        let body = TranscriptionRequest(audioBase64: audioBase64)
        request.httpBody = try JSONEncoder().encode(body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw BackendError.requestFailed
        }
        
        return try JSONDecoder().decode(TranscriptionResponse.self, from: data)
    }
    
    func synthesizeSpeech(text: String, voice: String = "default") async throws -> SpeechSynthesisResponse {
        let url = URL(string: "\(baseURL)/api/v1/voice/synthesize")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = SpeechSynthesisRequest(text: text, voice: voice)
        request.httpBody = try JSONEncoder().encode(body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw BackendError.requestFailed
        }
        
        return try JSONDecoder().decode(SpeechSynthesisResponse.self, from: data)
    }
}

// MARK: - Data Models
struct ChatRequest: Codable {
    let message: String
    let conversationId: String?
}

struct BackendChatResponse: Codable {
    let id: String
    let response: String
    let conversationId: String
}

struct BackendChatAPIResponse: Codable {
    let success: Bool
    let data: BackendChatData
    let metadata: BackendMetadata
}

struct BackendChatData: Codable {
    let conversationId: String
    let message: BackendMessage
    let usage: BackendUsage
    let optimization: BackendOptimization?
}

struct BackendMessage: Codable {
    let id: String
    let role: String
    let content: String
    let timestamp: String
    let metadata: BackendMessageMetadata?
}

struct BackendMessageMetadata: Codable {
    let agentName: String?
    let confidence: Double?
    let tokens: Int?
    let error: String?
}

struct BackendUsage: Codable {
    let tokens: Int
    let executionTime: String
}

struct BackendOptimization: Codable {
    let fastMode: Bool?
    let cacheHit: Bool?
    let historyTruncated: Bool?
}

struct BackendMetadata: Codable {
    let timestamp: String
    let requestId: String
    let agentName: String?
    let performance: BackendPerformance?
}

struct BackendPerformance: Codable {
    let executionTime: Int?
    let optimization: String?
}

struct BackendConversationsResponse: Codable {
    let success: Bool
    let data: BackendConversationsData
    let metadata: BackendMetadata
}

struct BackendConversationsData: Codable {
    let conversations: [BackendConversation]
    let total: Int
}

struct BackendConversation: Codable {
    let id: String
    let title: String
    let messageCount: Int
    let lastMessage: String
    let createdAt: String
    let updatedAt: String
}

struct VisionAnalysisRequest: Codable {
    let imageBase64: String
    let analysisType: String
}

struct VisionAnalysisResponse: Codable {
    let success: Bool
    let data: VisionAnalysisData
    let metadata: BackendMetadata?
}

struct VisionAnalysisData: Codable {
    let analysis: String
    let objects: [DetectedObject]?
    let confidence: Double?
    let processingTime: String?
}

struct DetectedObject: Codable {
    let label: String
    let confidence: Double
    let bbox: BoundingBox?
}

struct BoundingBox: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct TranscriptionRequest: Codable {
    let audioBase64: String
}

struct TranscriptionResponse: Codable {
    let success: Bool
    let data: TranscriptionData
    let metadata: BackendMetadata?
}

struct TranscriptionData: Codable {
    let text: String
    let confidence: Double?
    let language: String?
    let processingTime: String?
}

struct SpeechSynthesisRequest: Codable {
    let text: String
    let voice: String
}

struct SpeechSynthesisResponse: Codable {
    let success: Bool
    let data: SpeechSynthesisData
    let metadata: BackendMetadata?
}

struct SpeechSynthesisData: Codable {
    let audioBase64: String
    let voice: String
    let processingTime: String?
}

enum BackendError: Error {
    case requestFailed
    case invalidResponse
    case networkError
}

// MARK: - Main Content View
public struct ContentView: View {
    @State private var backendService = BackendService.shared
    @State private var selectedTab = 0
    @State private var loadedTabs: Set<Int> = [0] // Only load first tab initially
    
    public var body: some View {
        TabView(selection: $selectedTab) {
            // Always load Chat view (primary tab)
            ChatView(backendService: backendService)
                .tabItem {
                    Image(systemName: "message.fill")
                    Text("Chat")
                }
                .tag(0)
            
            // Lazy load Vision tab
            Group {
                if loadedTabs.contains(1) {
                    VisionView(backendService: backendService)
                } else {
                    LazyTabPlaceholder(icon: "eye.fill", title: "Vision")
                }
            }
            .tabItem {
                Image(systemName: "eye.fill")
                Text("Vision")
            }
            .tag(1)
            
            // Lazy load Voice tab
            Group {
                if loadedTabs.contains(2) {
                    VoiceAssistantView(backendService: backendService)
                } else {
                    LazyTabPlaceholder(icon: "mic.fill", title: "Voice")
                }
            }
            .tabItem {
                Image(systemName: "mic.fill")
                Text("Voice")
            }
            .tag(2)
            
            // Lazy load Settings tab
            Group {
                if loadedTabs.contains(3) {
                    SettingsView(backendService: backendService)
                } else {
                    LazyTabPlaceholder(icon: "gear", title: "Settings")
                }
            }
            .tabItem {
                Image(systemName: "gear")
                Text("Settings")
            }
            .tag(3)
        }
        .frame(minWidth: 900, minHeight: 650)
        .onChange(of: selectedTab) { _, newTab in
            // Load tab when first accessed
            if !loadedTabs.contains(newTab) {
                loadedTabs.insert(newTab)
            }
        }
    }
    
    public init() {}
}

// MARK: - Chat View
struct ChatView: View {
    let backendService: BackendService
    @State private var conversations: [BackendConversation] = []
    @State private var selectedConversationId: String?
    @State private var messages: [ChatMessage] = []
    @State private var newMessage = ""
    @State private var isLoading = false
    @State private var loadingConversations = false
    @State private var searchText = ""
    @State private var showTypingIndicator = false
    @State private var selectedMessageForReaction: String?
    
    var filteredConversations: [BackendConversation] {
        if searchText.isEmpty {
            return conversations
        } else {
            return conversations.filter { conversation in
                conversation.title.localizedCaseInsensitiveContains(searchText) ||
                conversation.lastMessage.localizedCaseInsensitiveContains(searchText)
            }
        }
    }
    
    var body: some View {
        NavigationSplitView {
            // Sidebar - Conversations List
            VStack(spacing: 0) {
                HStack {
                    Text("Conversations")
                        .font(.headline)
                        .foregroundColor(.primary)
                    Spacer()
                    Button {
                        startNewConversation()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.accentColor)
                    }
                    .buttonStyle(.plain)
                }
                
                HStack(spacing: 8) {
                    Circle()
                        .fill(backendService.isConnected ? Color.green : Color.red)
                        .frame(width: 8, height: 8)
                    Text(backendService.isConnected ? "Connected" : "Disconnected")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Spacer()
                    Button {
                        Task {
                            backendService.checkConnection()
                            await loadConversations()
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.secondary)
                }
                .padding(.horizontal)
                
                Divider()
                
                // Search Bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search conversations...", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(8)
                .padding(.horizontal)
                
                if loadingConversations {
                    ProgressView("Loading...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if conversations.isEmpty {
                    VStack {
                        Text("No conversations yet")
                            .foregroundColor(.secondary)
                        Text("Start a new chat to begin")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(filteredConversations, id: \.id, selection: $selectedConversationId) { conversation in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(conversation.title)
                                .font(.headline)
                                .lineLimit(1)
                            Text(conversation.lastMessage)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                            Text("\(conversation.messageCount) messages")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .frame(minWidth: 250)
        } detail: {
            // Main Chat Interface
            VStack(spacing: 0) {
                if selectedConversationId == nil {
                    // Welcome View
                    VStack(spacing: 20) {
                        Text("Universal AI Tools")
                            .font(.largeTitle)
                            .bold()
                        
                        Text("Select a conversation or start a new chat")
                            .font(.title2)
                            .foregroundColor(.secondary)
                        
                        Button("New Conversation") {
                            startNewConversation()
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    // Chat Toolbar
                    HStack {
                        Text("Chat")
                            .font(.headline)
                        
                        Spacer()
                        
                        HStack(spacing: 8) {
                            Button(action: {
                                exportConversation()
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "square.and.arrow.up")
                                    Text("Export")
                                }
                            }
                            .buttonStyle(.bordered)
                            .disabled(messages.isEmpty)
                            
                            Menu("Export Options") {
                                Button("Export as Text") {
                                    exportConversationAsText()
                                }
                                Button("Export as JSON") {
                                    exportConversationAsJSON()
                                }
                                Button("Export as PDF") {
                                    exportConversationAsPDF()
                                }
                                Divider()
                                Button("Copy All Messages") {
                                    copyAllMessages()
                                }
                            }
                            .disabled(messages.isEmpty)
                            
                            Button("Clear Chat") {
                                clearCurrentChat()
                            }
                            .buttonStyle(.bordered)
                            .disabled(messages.isEmpty)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(Color(NSColor.controlBackgroundColor))
                    
                    Divider()
                    
                    // Chat Messages
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(messages, id: \.id) { message in
                                    ChatMessageView(message: message, onReaction: { reaction in
                                        addReaction(to: message.id, reaction: reaction)
                                    }, onFavorite: {
                                        toggleFavorite(messageId: message.id)
                                    })
                                }
                                
                                if showTypingIndicator {
                                    TypingIndicatorView()
                                }
                            }
                            .padding()
                        }
                        .onChange(of: messages) { _, _ in
                            if let lastMessage = messages.last {
                                withAnimation {
                                    proxy.scrollTo(lastMessage.id, anchor: .bottom)
                                }
                            }
                        }
                    }
                    
                    Divider()
                    
                    // Message Input
                    HStack {
                        TextField("Type your message...", text: $newMessage, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(1...5)
                            .onSubmit {
                                if !newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                    sendMessage()
                                }
                            }
                        
                        Button {
                            sendMessage()
                        } label: {
                            Image(systemName: isLoading ? "stop.circle" : "arrow.up.circle.fill")
                                .font(.title2)
                                .foregroundColor(newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .secondary : .accentColor)
                        }
                        .disabled(newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading)
                        .buttonStyle(.plain)
                    }
                    .padding()
                }
            }
        }
        .task {
            backendService.checkConnection()
            await loadConversations()
        }
    }
    
    private func loadConversations() async {
        loadingConversations = true
        do {
            conversations = try await backendService.getConversations()
        } catch {
            print("Failed to load conversations: \(error)")
        }
        loadingConversations = false
    }
    
    private func startNewConversation() {
        selectedConversationId = "new"
        messages = []
        newMessage = ""
    }
    
    private func sendMessage() {
        guard !newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        var userMessage = ChatMessage(
            id: UUID().uuidString,
            role: "user",
            content: newMessage,
            timestamp: ISO8601DateFormatter().string(from: Date())
        )
        userMessage.status = .sending
        
        messages.append(userMessage)
        let messageToSend = newMessage
        newMessage = ""
        isLoading = true
        showTypingIndicator = true
        
        // Update user message status to sent
        if let index = messages.firstIndex(where: { $0.id == userMessage.id }) {
            messages[index].status = .sent
        }
        
        Task {
            do {
                let result = try await backendService.sendChatMessage(messageToSend)
                
                showTypingIndicator = false
                
                let assistantMessage = ChatMessage(
                    id: result.id,
                    role: "assistant",
                    content: result.response,
                    timestamp: ISO8601DateFormatter().string(from: Date())
                )
                
                messages.append(assistantMessage)
                selectedConversationId = result.conversationId
                
                // Update user message status to delivered
                if let index = messages.firstIndex(where: { $0.id == userMessage.id }) {
                    messages[index].status = .delivered
                }
                
                // Refresh conversations to show the new/updated conversation
                await loadConversations()
            } catch {
                showTypingIndicator = false
                
                let errorMessage = ChatMessage(
                    id: UUID().uuidString,
                    role: "assistant",
                    content: "Sorry, I encountered an error: \(error.localizedDescription)",
                    timestamp: ISO8601DateFormatter().string(from: Date())
                )
                messages.append(errorMessage)
                
                // Mark user message as failed
                if let index = messages.firstIndex(where: { $0.id == userMessage.id }) {
                    messages[index].status = .failed
                }
            }
            isLoading = false
        }
    }
    
    private func addReaction(to messageId: String, reaction: String) {
        if let index = messages.firstIndex(where: { $0.id == messageId }) {
            messages[index].reaction = reaction
        }
    }
    
    private func toggleFavorite(messageId: String) {
        if let index = messages.firstIndex(where: { $0.id == messageId }) {
            messages[index].isFavorite.toggle()
        }
    }
    
    // MARK: - Export Functions
    private func exportConversation() {
        exportConversationAsText()
    }
    
    private func exportConversationAsText() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "conversation.txt"
        panel.allowedContentTypes = [.plainText]
        
        if panel.runModal() == .OK, let url = panel.url {
            let exportText = generateTextExport()
            try? exportText.write(to: url, atomically: true, encoding: .utf8)
        }
    }
    
    private func exportConversationAsJSON() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "conversation.json"
        panel.allowedContentTypes = [.json]
        
        if panel.runModal() == .OK, let url = panel.url {
            let exportData = generateJSONExport()
            try? exportData.write(to: url, atomically: true, encoding: .utf8)
        }
    }
    
    private func exportConversationAsPDF() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "conversation.pdf"
        panel.allowedContentTypes = [.pdf]
        
        if panel.runModal() == .OK, let url = panel.url {
            generatePDFExport(url: url)
        }
    }
    
    private func copyAllMessages() {
        let allMessages = generateTextExport()
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(allMessages, forType: .string)
    }
    
    private func clearCurrentChat() {
        messages.removeAll()
        selectedConversationId = nil
    }
    
    private func generateTextExport() -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        
        var exportText = """
        Universal AI Tools - Conversation Export
        Generated: \(formatter.string(from: Date()))
        Total Messages: \(messages.count)
        
        ==========================================
        
        """
        
        for message in messages {
            let timestamp = ISO8601DateFormatter().date(from: message.timestamp) ?? Date()
            let formattedTime = formatter.string(from: timestamp)
            let roleName = message.role == "user" ? "You" : "AI Assistant"
            let statusIcon = getStatusIcon(for: message.status)
            let favoriteIcon = message.isFavorite ? " ⭐" : ""
            let reactionIcon = message.reaction != nil ? " \(message.reaction!)" : ""
            
            exportText += """
            [\(formattedTime)] \(roleName)\(statusIcon)\(favoriteIcon)\(reactionIcon)
            \(message.content)
            
            ==========================================
            
            """
        }
        
        return exportText
    }
    
    private func generateJSONExport() -> String {
        struct ExportMessage: Codable {
            let id: String
            let role: String
            let content: String
            let timestamp: String
            let status: String
            let isFavorite: Bool
            let reaction: String?
        }
        
        struct ConversationExport: Codable {
            let exportDate: String
            let totalMessages: Int
            let conversationId: String?
            let messages: [ExportMessage]
        }
        
        let exportMessages = messages.map { message in
            ExportMessage(
                id: message.id,
                role: message.role,
                content: message.content,
                timestamp: message.timestamp,
                status: statusToString(message.status),
                isFavorite: message.isFavorite,
                reaction: message.reaction
            )
        }
        
        let export = ConversationExport(
            exportDate: ISO8601DateFormatter().string(from: Date()),
            totalMessages: messages.count,
            conversationId: selectedConversationId,
            messages: exportMessages
        )
        
        if let jsonData = try? JSONEncoder().encode(export),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            return jsonString
        }
        
        return "{\"error\": \"Failed to encode conversation\"}"
    }
    
    private func generatePDFExport(url: URL) {
        let textContent = generateTextExport()
        
        guard let pdfContext = CGContext(url as CFURL, mediaBox: nil, nil) else { return }
        
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
        let margin: CGFloat = 50
        let contentRect = CGRect(x: margin, y: margin, width: pageRect.width - 2*margin, height: pageRect.height - 2*margin)
        
        pdfContext.beginPDFPage(nil)
        
        let font = NSFont.systemFont(ofSize: 12)
        let titleFont = NSFont.boldSystemFont(ofSize: 16)
        
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = 4
        
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: NSColor.textColor
        ]
        
        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: titleFont,
            .foregroundColor: NSColor.textColor
        ]
        
        let title = "Universal AI Tools - Conversation Export"
        let titleSize = title.size(withAttributes: titleAttributes)
        
        // Draw title
        let titleRect = CGRect(x: contentRect.origin.x, y: contentRect.maxY - titleSize.height, width: contentRect.width, height: titleSize.height)
        title.draw(in: titleRect, withAttributes: titleAttributes)
        
        // Draw content
        let textRect = CGRect(x: contentRect.origin.x, y: contentRect.origin.y, width: contentRect.width, height: contentRect.height - titleSize.height - 20)
        textContent.draw(in: textRect, withAttributes: attributes)
        
        pdfContext.endPDFPage()
        pdfContext.closePDF()
    }
    
    private func getStatusIcon(for status: MessageStatus) -> String {
        switch status {
        case .sending:
            return " ⏳"
        case .sent:
            return " ✓"
        case .delivered:
            return " ✓✓"
        case .failed:
            return " ❌"
        }
    }
    
    private func statusToString(_ status: MessageStatus) -> String {
        switch status {
        case .sending:
            return "sending"
        case .sent:
            return "sent"
        case .delivered:
            return "delivered"
        case .failed:
            return "failed"
        }
    }
}

// MARK: - Vision View
struct VisionView: View {
    let backendService: BackendService
    @State private var selectedImages: [ImageData] = []
    @State private var analysisResults: [AnalysisResult] = []
    @State private var isAnalyzing = false
    @State private var dragOver = false
    @State private var selectedAnalysisType = "general"
    @State private var currentAnalysisIndex = 0
    @State private var imageProcessor = ImageProcessingActor()
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Vision Analysis")
                .font(.largeTitle)
                .bold()
                .padding(.top)
            
            HStack(spacing: 8) {
                Circle()
                    .fill(backendService.isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                Text(backendService.isConnected ? "Connected" : "Disconnected")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(selectedImages.count) images selected")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            // Multi-file Drop Zone
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(dragOver ? Color.accentColor.opacity(0.1) : Color.gray.opacity(0.1))
                    .stroke(dragOver ? Color.accentColor : Color.gray, style: StrokeStyle(lineWidth: 2, dash: [5]))
                    .frame(height: selectedImages.isEmpty ? 200 : 120)
                
                if selectedImages.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("Drop multiple images here or click to select")
                            .foregroundColor(.secondary)
                        Text("Supports: JPG, PNG, GIF, HEIC, WebP")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Button("Select Images") {
                            selectImages()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else {
                    VStack(spacing: 8) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            LazyHStack(spacing: 12) {
                                ForEach(selectedImages) { imageData in
                                    VStack(spacing: 4) {
                                        Image(nsImage: imageData.image)
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                            .frame(width: 80, height: 60)
                                            .clipped()
                                            .cornerRadius(8)
                                            .overlay(
                                                Button(action: {
                                                    removeImage(imageData.id)
                                                }) {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .foregroundColor(.white)
                                                        .background(Color.black.opacity(0.6))
                                                        .clipShape(Circle())
                                                }
                                                .buttonStyle(PlainButtonStyle())
                                                .frame(width: 20, height: 20),
                                                alignment: .topTrailing
                                            )
                                        Text(imageData.filename)
                                            .font(.caption2)
                                            .lineLimit(1)
                                            .frame(width: 80)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                        .frame(height: 80)
                        
                        HStack {
                            Button("Add More") { selectImages() }
                                .buttonStyle(.bordered)
                            Button("Clear All") { clearAllImages() }
                                .buttonStyle(.bordered)
                        }
                    }
                }
            }
            .onDrop(of: [.fileURL], isTargeted: $dragOver) { providers in
                handleMultiDrop(providers: providers)
            }
            .onTapGesture {
                if selectedImages.isEmpty {
                    selectImages()
                }
            }
            
            if !selectedImages.isEmpty {
                VStack(spacing: 12) {
                    HStack {
                        Menu("Analysis Type") {
                            Button("General Analysis") { selectedAnalysisType = "general" }
                            Button("Object Detection") { selectedAnalysisType = "objects" }
                            Button("Text Recognition (OCR)") { selectedAnalysisType = "text" }
                            Button("Scene Understanding") { selectedAnalysisType = "scene" }
                        }
                        .menuStyle(.borderlessButton)
                        
                        Text("Selected: \(selectedAnalysisType.capitalized)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                    }
                    
                    HStack {
                        Button("Analyze All Images (\(selectedImages.count))") {
                            analyzeAllImages()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isAnalyzing || !backendService.isConnected)
                        
                        if !analysisResults.isEmpty {
                            Button("Export Results") {
                                exportResults()
                            }
                            .buttonStyle(.bordered)
                            
                            Button("Copy All Results") {
                                copyAllResults()
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
            
            if isAnalyzing {
                VStack(spacing: 8) {
                    ProgressView(value: Double(currentAnalysisIndex), total: Double(selectedImages.count))
                        .frame(height: 8)
                    Text("Analyzing image \(currentAnalysisIndex + 1) of \(selectedImages.count)...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            if !analysisResults.isEmpty {
                GroupBox("Analysis Results (\(analysisResults.count))") {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 16) {
                            ForEach(analysisResults) { result in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Text(result.filename)
                                            .font(.headline)
                                            .bold()
                                        Spacer()
                                        Text(DateFormatter.localizedString(from: result.timestamp, dateStyle: .none, timeStyle: .short))
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                        Button(action: {
                                            copyResult(result)
                                        }) {
                                            Image(systemName: "doc.on.doc")
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                    }
                                    
                                    Text(result.analysisText)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    
                                    if !result.detectedObjects.isEmpty {
                                        Divider()
                                        Text("Detected Objects:")
                                            .font(.subheadline)
                                            .bold()
                                        
                                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                                            ForEach(result.detectedObjects, id: \.label) { object in
                                                HStack {
                                                    Text("• \(object.label)")
                                                        .font(.caption)
                                                    Spacer()
                                                    Text("\(Int(object.confidence * 100))%")
                                                        .font(.caption2)
                                                        .foregroundColor(.secondary)
                                                }
                                            }
                                        }
                                    }
                                }
                                .padding()
                                .background(Color(NSColor.controlBackgroundColor))
                                .cornerRadius(8)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
                .frame(maxHeight: 300)
            }
            
            Spacer()
        }
        .padding()
    }
    
    private func selectImages() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.image]
        panel.allowsMultipleSelection = true
        
        if panel.runModal() == .OK {
            loadImages(from: panel.urls)
        }
    }
    
    private func handleMultiDrop(providers: [NSItemProvider]) -> Bool {
        let group = DispatchGroup()
        var urls: [URL] = []
        
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier("public.file-url") {
                group.enter()
                provider.loadItem(forTypeIdentifier: "public.file-url", options: nil) { item, error in
                    defer { group.leave() }
                    if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                        urls.append(url)
                    }
                }
            }
        }
        
        group.notify(queue: .main) {
            self.loadImages(from: urls)
        }
        
        return !providers.isEmpty
    }
    
    private func loadImages(from urls: [URL]) {
        let supportedTypes = ["jpg", "jpeg", "png", "gif", "heic", "webp", "tiff", "bmp"]
        
        for url in urls {
            let fileExtension = url.pathExtension.lowercased()
            if supportedTypes.contains(fileExtension), let image = NSImage(contentsOf: url) {
                let imageData = ImageData(
                    image: image,
                    url: url,
                    filename: url.lastPathComponent
                )
                if !selectedImages.contains(where: { $0.filename == imageData.filename }) {
                    selectedImages.append(imageData)
                }
            }
        }
    }
    
    private func removeImage(_ imageId: UUID) {
        selectedImages.removeAll { $0.id == imageId }
        analysisResults.removeAll { $0.imageId == imageId }
        
        // Cancel processing for removed image
        Task {
            await imageProcessor.cancelProcessing(for: imageId)
        }
    }
    
    private func clearAllImages() {
        selectedImages.removeAll()
        analysisResults.removeAll()
        currentAnalysisIndex = 0
        
        // Cancel all ongoing processing
        Task {
            await imageProcessor.cancelAllProcessing()
        }
    }
    
    private func analyzeAllImages() {
        guard !selectedImages.isEmpty else { return }
        
        isAnalyzing = true
        currentAnalysisIndex = 0
        analysisResults.removeAll()
        
        Task {
            // Process images concurrently using the actor
            await withTaskGroup(of: (Int, AnalysisResult?).self) { group in
                for (index, imageData) in selectedImages.enumerated() {
                    group.addTask {
                        await MainActor.run {
                            currentAnalysisIndex = max(currentAnalysisIndex, index)
                        }
                        
                        do {
                            let result = try await imageProcessor.processImage(
                                imageData: imageData,
                                analysisType: selectedAnalysisType,
                                backendService: backendService
                            )
                            return (index, result)
                        } catch {
                            // Create error result if processing fails
                            let errorResult = AnalysisResult(
                                imageId: imageData.id,
                                filename: imageData.filename,
                                analysisText: "Error analyzing image: \(error.localizedDescription)",
                                detectedObjects: [],
                                analysisType: selectedAnalysisType,
                                timestamp: Date()
                            )
                            return (index, errorResult)
                        }
                    }
                }
                
                // Collect results and maintain order
                var results: [(Int, AnalysisResult)] = []
                for await result in group {
                    if let analysisResult = result.1 {
                        results.append((result.0, analysisResult))
                    }
                }
                
                // Sort by original index and update UI
                results.sort { $0.0 < $1.0 }
                await MainActor.run {
                    analysisResults = results.map { $0.1 }
                    isAnalyzing = false
                    currentAnalysisIndex = 0
                }
            }
        }
    }
    
    private func copyResult(_ result: AnalysisResult) {
        let text = """
        Filename: \(result.filename)
        Analysis Type: \(result.analysisType.capitalized)
        Timestamp: \(DateFormatter.localizedString(from: result.timestamp, dateStyle: .medium, timeStyle: .short))
        
        Analysis:
        \(result.analysisText)
        
        \(result.detectedObjects.isEmpty ? "" : """
        Detected Objects:
        \(result.detectedObjects.map { "• \($0.label) (\(Int($0.confidence * 100))%)" }.joined(separator: "\n"))
        """)
        """
        
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
    
    private func copyAllResults() {
        let allResults = analysisResults.map { result in
            """
            Filename: \(result.filename)
            Analysis Type: \(result.analysisType.capitalized)
            Timestamp: \(DateFormatter.localizedString(from: result.timestamp, dateStyle: .medium, timeStyle: .short))
            
            Analysis:
            \(result.analysisText)
            
            \(result.detectedObjects.isEmpty ? "" : """
            Detected Objects:
            \(result.detectedObjects.map { "• \($0.label) (\(Int($0.confidence * 100))%)" }.joined(separator: "\n"))
            """)
            """
        }.joined(separator: "\n\n---\n\n")
        
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(allResults, forType: .string)
    }
    
    private func exportResults() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "vision_analysis_results.txt"
        panel.allowedContentTypes = [.plainText]
        
        if panel.runModal() == .OK, let url = panel.url {
            let allResults = analysisResults.map { result in
                """
                Filename: \(result.filename)
                Analysis Type: \(result.analysisType.capitalized)
                Timestamp: \(DateFormatter.localizedString(from: result.timestamp, dateStyle: .medium, timeStyle: .short))
                
                Analysis:
                \(result.analysisText)
                
                \(result.detectedObjects.isEmpty ? "" : """
                Detected Objects:
                \(result.detectedObjects.map { "• \($0.label) (\(Int($0.confidence * 100))%)" }.joined(separator: "\n"))
                """)
                """
            }.joined(separator: "\n\n---\n\n")
            
            try? allResults.write(to: url, atomically: true, encoding: .utf8)
        }
    }
}

struct ChatMessage: Identifiable, Equatable {
    let id: String
    let role: String
    let content: String
    let timestamp: String
    var status: MessageStatus = .sent
    var isFavorite: Bool = false
    var reaction: String? = nil
}

enum MessageStatus {
    case sending
    case sent
    case delivered
    case failed
}

struct ChatMessageView: View {
    let message: ChatMessage
    let onReaction: ((String) -> Void)?
    let onFavorite: (() -> Void)?
    @State private var showReactionPicker = false
    
    init(message: ChatMessage, onReaction: ((String) -> Void)? = nil, onFavorite: (() -> Void)? = nil) {
        self.message = message
        self.onReaction = onReaction
        self.onFavorite = onFavorite
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == "user" {
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    VStack(alignment: .trailing, spacing: 4) {
                        HStack {
                            if message.isFavorite {
                                Image(systemName: "heart.fill")
                                    .foregroundColor(.red)
                                    .font(.caption2)
                            }
                            
                            Text(message.content)
                                .padding(12)
                                .background(Color.accentColor)
                                .foregroundColor(.white)
                                .cornerRadius(16)
                                .contextMenu {
                                    Button("Copy") {
                                        NSPasteboard.general.clearContents()
                                        NSPasteboard.general.setString(message.content, forType: .string)
                                    }
                                    Button(message.isFavorite ? "Remove Favorite" : "Add to Favorites") {
                                        onFavorite?()
                                    }
                                    Menu("React") {
                                        Button("👍") { onReaction?("👍") }
                                        Button("❤️") { onReaction?("❤️") }
                                        Button("😊") { onReaction?("😊") }
                                        Button("👏") { onReaction?("👏") }
                                        Button("🤔") { onReaction?("🤔") }
                                    }
                                }
                        }
                        
                        if let reaction = message.reaction {
                            Text(reaction)
                                .font(.title2)
                                .padding(4)
                                .background(Color.gray.opacity(0.2))
                                .cornerRadius(8)
                        }
                    }
                    
                    HStack(spacing: 4) {
                        Text(formattedTime)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        if message.role == "user" {
                            statusIcon
                        }
                    }
                }
                .frame(maxWidth: .infinity * 0.7, alignment: .trailing)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(message.content)
                                .padding(12)
                                .background(Color(NSColor.controlBackgroundColor))
                                .cornerRadius(16)
                                .contextMenu {
                                    Button("Copy") {
                                        NSPasteboard.general.clearContents()
                                        NSPasteboard.general.setString(message.content, forType: .string)
                                    }
                                    Button(message.isFavorite ? "Remove Favorite" : "Add to Favorites") {
                                        onFavorite?()
                                    }
                                    Menu("React") {
                                        Button("👍") { onReaction?("👍") }
                                        Button("❤️") { onReaction?("❤️") }
                                        Button("😊") { onReaction?("😊") }
                                        Button("👏") { onReaction?("👏") }
                                        Button("🤔") { onReaction?("🤔") }
                                    }
                                }
                            
                            if message.isFavorite {
                                Image(systemName: "heart.fill")
                                    .foregroundColor(.red)
                                    .font(.caption2)
                            }
                        }
                        
                        if let reaction = message.reaction {
                            Text(reaction)
                                .font(.title2)
                                .padding(4)
                                .background(Color.gray.opacity(0.2))
                                .cornerRadius(8)
                        }
                    }
                    
                    Text(formattedTime)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity * 0.7, alignment: .leading)
                Spacer()
            }
        }
    }
    
    @ViewBuilder
    private var statusIcon: some View {
        switch message.status {
        case .sending:
            Image(systemName: "clock")
                .foregroundColor(.gray)
                .font(.caption2)
        case .sent:
            Image(systemName: "checkmark")
                .foregroundColor(.gray)
                .font(.caption2)
        case .delivered:
            Image(systemName: "checkmark.circle")
                .foregroundColor(.blue)
                .font(.caption2)
        case .failed:
            Image(systemName: "exclamationmark.triangle")
                .foregroundColor(.red)
                .font(.caption2)
        }
    }
    
    private var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        
        let isoFormatter = ISO8601DateFormatter()
        if let date = isoFormatter.date(from: message.timestamp) {
            return formatter.string(from: date)
        }
        return ""
    }
}

// MARK: - Voice Assistant View
struct VoiceAssistantView: View {
    let backendService: BackendService
    @State private var isRecording = false
    @State private var recordedAudio: Data?
    @State private var transcriptionText = ""
    @State private var responseText = ""
    @State private var isProcessing = false
    @State private var audioEngine = AVAudioEngine()
    @State private var audioPlayer: AVAudioPlayer?
    @State private var inputNode: AVAudioInputNode?
    @State private var audioFile: AVAudioFile?
    
    var body: some View {
        VStack(spacing: 24) {
            Text("Voice Assistant")
                .font(.largeTitle)
                .bold()
                .padding(.top)
            
            HStack(spacing: 8) {
                Circle()
                    .fill(backendService.isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                Text(backendService.isConnected ? "Connected" : "Disconnected")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            VStack(spacing: 20) {
                // Recording Controls
                VStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .fill(isRecording ? Color.red.opacity(0.2) : Color.gray.opacity(0.1))
                            .frame(width: 120, height: 120)
                        
                        Button {
                            if isRecording {
                                stopRecording()
                            } else {
                                startRecording()
                            }
                        } label: {
                            Image(systemName: isRecording ? "stop.circle.fill" : "mic.circle.fill")
                                .font(.system(size: 50))
                                .foregroundColor(isRecording ? .red : .accentColor)
                        }
                        .buttonStyle(.plain)
                        .disabled(isProcessing || !backendService.isConnected)
                        
                        if isRecording {
                            Circle()
                                .stroke(Color.red, lineWidth: 2)
                                .frame(width: 130, height: 130)
                                .scaleEffect(isRecording ? 1.1 : 1.0)
                                .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: isRecording)
                        }
                    }
                    
                    Text(isRecording ? "Tap to stop recording" : "Tap to start recording")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                if isProcessing {
                    ProgressView("Processing...")
                        .frame(height: 40)
                }
                
                // Transcription Results
                if !transcriptionText.isEmpty {
                    GroupBox("What you said:") {
                        ScrollView {
                            Text(transcriptionText)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 8)
                        }
                        .frame(maxHeight: 100)
                    }
                }
                
                // AI Response
                if !responseText.isEmpty {
                    GroupBox("AI Response:") {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 12) {
                                Text(responseText)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                
                                HStack {
                                    Button("Play Response") {
                                        playResponse()
                                    }
                                    .buttonStyle(.borderedProminent)
                                    .controlSize(.small)
                                    
                                    Button("Copy") {
                                        NSPasteboard.general.clearContents()
                                        NSPasteboard.general.setString(responseText, forType: .string)
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                }
                            }
                            .padding(.vertical, 8)
                        }
                        .frame(maxHeight: 200)
                    }
                }
            }
            
            Spacer()
        }
        .padding()
        .onAppear {
            setupAudio()
        }
        .onDisappear {
            if isRecording {
                stopRecording()
            }
        }
    }
    
    private func setupAudio() {
        // macOS doesn't use AVAudioSession
        print("Audio setup for macOS")
    }
    
    private func startRecording() {
        guard !isRecording else { return }
        
        do {
            inputNode = audioEngine.inputNode
            let recordingFormat = inputNode?.outputFormat(forBus: 0)
            
            let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("recording.wav")
            audioFile = try AVAudioFile(forWriting: tempURL, settings: recordingFormat?.settings ?? [:])
            
            inputNode?.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
                try? self.audioFile?.write(from: buffer)
            }
            
            audioEngine.prepare()
            try audioEngine.start()
            
            isRecording = true
        } catch {
            print("Failed to start recording: \(error)")
        }
    }
    
    private func stopRecording() {
        guard isRecording else { return }
        
        audioEngine.stop()
        inputNode?.removeTap(onBus: 0)
        
        isRecording = false
        isProcessing = true
        
        Task {
            await processRecording()
        }
    }
    
    private func processRecording() async {
        guard let audioFile = audioFile else { return }
        
        do {
            let audioData = try Data(contentsOf: audioFile.url)
            let base64Audio = audioData.base64EncodedString()
            
            // Transcribe audio
            let transcriptionResult = try await backendService.transcribeAudio(audioBase64: base64Audio)
            
            await MainActor.run {
                transcriptionText = transcriptionResult.data.text
            }
            
            // Send to chat for AI response
            let chatResponse = try await backendService.sendChatMessage(transcriptionResult.data.text)
            
            await MainActor.run {
                responseText = chatResponse.response
                isProcessing = false
            }
            
        } catch {
            await MainActor.run {
                transcriptionText = "Error: \(error.localizedDescription)"
                isProcessing = false
            }
        }
    }
    
    private func playResponse() {
        guard !responseText.isEmpty else { return }
        
        Task {
            do {
                let synthesisResult = try await backendService.synthesizeSpeech(text: responseText)
                if let audioData = Data(base64Encoded: synthesisResult.data.audioBase64) {
                    await MainActor.run {
                        playAudio(data: audioData)
                    }
                }
            } catch {
                print("Failed to synthesize speech: \(error)")
            }
        }
    }
    
    private func playAudio(data: Data) {
        do {
            audioPlayer = try AVAudioPlayer(data: data)
            audioPlayer?.play()
        } catch {
            print("Failed to play audio: \(error)")
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    let backendService: BackendService
    @State private var serverURL = "http://127.0.0.1:9999"
    @State private var autoPlayResponse = true
    @State private var darkMode = false
    @State private var selectedVoice = "default"
    
    let availableVoices = ["default", "alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Settings")
                .font(.largeTitle)
                .bold()
                .padding(.top)
            
            GroupBox("Connection") {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(backendService.isConnected ? Color.green : Color.red)
                            .frame(width: 12, height: 12)
                        Text(backendService.isConnected ? "Connected to backend" : "Disconnected")
                            .font(.headline)
                    }
                    
                    HStack {
                        Text("Server URL:")
                            .frame(width: 100, alignment: .leading)
                        TextField("Server URL", text: $serverURL)
                            .textFieldStyle(.roundedBorder)
                        Button("Test Connection") {
                            backendService.checkConnection()
                        }
                        .buttonStyle(.bordered)
                    }
                    
                    if let error = backendService.lastError {
                        Text("Error: \(error)")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                .padding()
            }
            
            GroupBox("Voice Settings") {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text("Voice:")
                            .frame(width: 100, alignment: .leading)
                        Picker("Voice", selection: $selectedVoice) {
                            ForEach(availableVoices, id: \.self) { voice in
                                Text(voice.capitalized).tag(voice)
                            }
                        }
                        .pickerStyle(.menu)
                        .frame(width: 150)
                        Spacer()
                    }
                    
                    Toggle("Auto-play AI responses", isOn: $autoPlayResponse)
                }
                .padding()
            }
            
            GroupBox("Appearance") {
                VStack(alignment: .leading, spacing: 16) {
                    Toggle("Dark mode", isOn: $darkMode)
                    
                    Text("Note: System appearance setting takes precedence")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
            }
            
            GroupBox("About") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Universal AI Tools")
                        .font(.headline)
                    Text("Version 1.0.0")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("A comprehensive AI assistant with chat, vision, and voice capabilities.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
            }
            
            Spacer()
        }
        .padding()
    }
}

// MARK: - Typing Indicator
struct TypingIndicatorView: View {
    @State private var animationPhase: Int = 0
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(Color.secondary)
                            .frame(width: 8, height: 8)
                            .scaleEffect(animationPhase == index ? 1.2 : 0.8)
                            .animation(.easeInOut(duration: 0.4).repeatForever(autoreverses: true).delay(Double(index) * 0.2), value: animationPhase)
                    }
                }
                .padding(12)
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(16)
                
                Text("AI is typing...")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity * 0.7, alignment: .leading)
            Spacer()
        }
        .onAppear {
            startAnimation()
        }
    }
    
    private func startAnimation() {
        Timer.scheduledTimer(withTimeInterval: 0.6, repeats: true) { _ in
            animationPhase = (animationPhase + 1) % 3
        }
    }
}

// MARK: - Image Processing Actor
@MainActor
actor ImageProcessingActor {
    private var currentProcessingTasks: [UUID: Task<AnalysisResult, Error>] = [:]
    
    func processImage(
        imageData: ImageData,
        analysisType: String,
        backendService: BackendService
    ) async throws -> AnalysisResult {
        // Cancel any existing task for this image
        if let existingTask = currentProcessingTasks[imageData.id] {
            existingTask.cancel()
        }
        
        let task = Task<AnalysisResult, Error> {
            defer {
                await MainActor.run {
                    currentProcessingTasks.removeValue(forKey: imageData.id)
                }
            }
            
            // Create autoreleasepool to manage memory for image processing
            return try await withUnsafeThrowingContinuation { continuation in
                autoreleasepool {
                    do {
                        guard let tiffData = imageData.image.tiffRepresentation,
                              let bitmap = NSBitmapImageRep(data: tiffData),
                              let pngData = bitmap.representation(using: .png, properties: [:]) else {
                            continuation.resume(throwing: NSError(domain: "ImageProcessing", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to convert image"]))
                            return
                        }
                        
                        let base64String = pngData.base64EncodedString()
                        
                        Task {
                            do {
                                let result = try await backendService.analyzeImage(imageBase64: base64String, analysisType: analysisType)
                                
                                let analysisResult = AnalysisResult(
                                    imageId: imageData.id,
                                    filename: imageData.filename,
                                    analysisText: result.data.analysis,
                                    detectedObjects: result.data.objects ?? [],
                                    analysisType: analysisType,
                                    timestamp: Date()
                                )
                                
                                continuation.resume(returning: analysisResult)
                            } catch {
                                let errorResult = AnalysisResult(
                                    imageId: imageData.id,
                                    filename: imageData.filename,
                                    analysisText: "Error analyzing image: \(error.localizedDescription)",
                                    detectedObjects: [],
                                    analysisType: analysisType,
                                    timestamp: Date()
                                )
                                
                                continuation.resume(returning: errorResult)
                            }
                        }
                    }
                }
            }
        }
        
        currentProcessingTasks[imageData.id] = task
        return try await task.value
    }
    
    func cancelAllProcessing() {
        for task in currentProcessingTasks.values {
            task.cancel()
        }
        currentProcessingTasks.removeAll()
    }
    
    func cancelProcessing(for imageId: UUID) {
        if let task = currentProcessingTasks[imageId] {
            task.cancel()
            currentProcessingTasks.removeValue(forKey: imageId)
        }
    }
}

// MARK: - Multi-file Vision Data Structures
struct ImageData: Identifiable, Equatable {
    let id = UUID()
    let image: NSImage
    let url: URL
    let filename: String
    
    static func == (lhs: ImageData, rhs: ImageData) -> Bool {
        lhs.id == rhs.id
    }
}

struct AnalysisResult: Identifiable, Equatable {
    let id = UUID()
    let imageId: UUID
    let filename: String
    let analysisText: String
    let detectedObjects: [DetectedObject]
    let analysisType: String
    let timestamp: Date
    
    static func == (lhs: AnalysisResult, rhs: AnalysisResult) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Lazy Tab Placeholder
struct LazyTabPlaceholder: View {
    let icon: String
    let title: String
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            VStack(spacing: 8) {
                Text("Loading \(title)...")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text("This tab will load when accessed")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            ProgressView()
                .scaleEffect(0.8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(NSColor.controlBackgroundColor).opacity(0.3))
    }
}

#Preview {
    ContentView()
}