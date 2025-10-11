import Foundation

struct ChatMessage: Identifiable, Codable {
    let id: String
    let text: String
    let isUser: Bool
    let timestamp: Date
    
    init(id: String = UUID().uuidString, text: String, isUser: Bool, timestamp: Date = Date()) {
        self.id = id
        self.text = text
        self.isUser = isUser
        self.timestamp = timestamp
    }
}

struct ChatRequest: Codable {
    let message: String
    let model: String?
    let request_id: String?
    let context: [String: AnyCodable]?
    let user_id: String?
    let thread_id: String?
    
    init(message: String, model: String? = nil, request_id: String? = nil, context: [String: Any]? = nil, user_id: String? = nil, thread_id: String? = nil) {
        self.message = message
        self.model = model
        self.request_id = request_id
        self.user_id = user_id
        self.thread_id = thread_id
        if let ctx = context {
            self.context = ctx.mapValues { AnyCodable($0) }
        } else {
            self.context = nil
        }
    }
}

// AnyCodable helper for ChatRequest
struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else {
            value = ""
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let dict = value as? [String: Any] {
            try container.encode(dict.mapValues { AnyCodable($0) })
        } else if let array = value as? [Any] {
            try container.encode(array.map { AnyCodable($0) })
        }
    }
}

struct ChatResponse: Codable {
    let request_id: String
    let response: String
    let model_used: String
    let processing_time: Double?
    let status: String?
    
    enum CodingKeys: String, CodingKey {
        case request_id
        case response
        case model_used
        case processing_time
        case status
    }
}

@MainActor
class ChatService: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isConnected = false
    
    let baseURL = "http://localhost:8013"  // Made public for camera/voice features
    private let session: URLSession
    
    // Persistent user and thread IDs
    let userID: String
    let threadID: String
    
    init(userID: String, threadID: String) {
        self.userID = userID
        self.threadID = threadID
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)
        
        print("📱 ChatService initialized for user: \(userID)")
        print("🧵 Thread: \(threadID)")
        
        // Add welcome message
        messages.append(ChatMessage(
            text: "✨ Hi! I'm Athena, your AI assistant. How can I help you today?",
            isUser: false
        ))
    }
    
    func checkConnection() async {
        do {
            print("🔍 Checking connection to \(baseURL)/health")
            let url = URL(string: "\(baseURL)/health")!
            let (data, response) = try await session.data(from: url)
            
            if let httpResponse = response as? HTTPURLResponse {
                print("📡 Response status: \(httpResponse.statusCode)")
                if httpResponse.statusCode == 200 {
                    isConnected = true
                    print("✅ Connected to NeuroForge backend")
                    if let json = String(data: data, encoding: .utf8) {
                        print("Response: \(json)")
                    }
                } else {
                    isConnected = false
                    print("❌ HTTP \(httpResponse.statusCode)")
                }
            }
        } catch {
            isConnected = false
            print("❌ Failed to connect to \(baseURL): \(error.localizedDescription)")
            print("   Make sure backend is running: docker ps | grep unified-ai-assistant-api")
        }
    }
    
    func addSystemMessage(_ text: String) async {
        let systemMessage = ChatMessage(
            text: text,
            isUser: false
        )
        messages.append(systemMessage)
    }
    
    func sendMessage(_ text: String, context: [String: Any]? = nil) async {
        print("🚀 ChatService.sendMessage called with: '\(text)'")
        
        // Add user message
        let userMessage = ChatMessage(text: text, isUser: true)
        messages.append(userMessage)
        print("✅ Added user message to UI, total messages: \(messages.count)")
        
        do {
            let url = URL(string: "\(baseURL)/api/chat")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let chatRequest = ChatRequest(
                message: text,
                model: "llama3.2:3b",
                request_id: UUID().uuidString,
                context: context,
                user_id: userID,      // NEW: Persistent user ID
                thread_id: threadID   // NEW: Thread tracking
            )
            request.httpBody = try JSONEncoder().encode(chatRequest)
            
            print("📤 Sending POST to \(baseURL)/api/chat")
            
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw URLError(.badServerResponse)
            }
            
            print("📥 Received response: HTTP \(httpResponse.statusCode)")
            
            guard httpResponse.statusCode == 200 else {
                let errorText = String(data: data, encoding: .utf8) ?? "Unknown error"
                print("❌ Error response: \(errorText)")
                throw URLError(.badServerResponse)
            }
            
            let chatResponse = try JSONDecoder().decode(ChatResponse.self, from: data)
            
            // Add AI response
            let aiMessage = ChatMessage(
                id: chatResponse.request_id,
                text: chatResponse.response,
                isUser: false
            )
            messages.append(aiMessage)
            
            print("✅ Message received from model: \(chatResponse.model_used)")
            
            // Update connection status
            isConnected = true
            
        } catch {
            print("❌ Error sending message: \(error)")
            
            // Add detailed error message
            let errorDetails: String
            if let urlError = error as? URLError {
                errorDetails = "URL Error: \(urlError.localizedDescription) (Code: \(urlError.code.rawValue))"
            } else {
                errorDetails = error.localizedDescription
            }
            
            let errorMessage = ChatMessage(
                text: "❌ Error: \(errorDetails)\n\nBackend: \(baseURL)\nPlease check Console.app for details",
                isUser: false
            )
            messages.append(errorMessage)
            
            // Don't set disconnected - just show error
            // isConnected = false
        }
    }
}

