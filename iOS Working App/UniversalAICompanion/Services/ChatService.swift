import Foundation

@MainActor
class ChatService: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var connectionState: ConnectionState = .disconnected
    @Published var selectedAgent: Agent = Agent.predefinedAgents[3] // Default to personal assistant
    @Published var availableAgents: [Agent] = Agent.predefinedAgents
    
    private var authToken: String?
    private let baseURL = "http://localhost:9999"
    
    init() {
        loadPersistedMessages()
        Task {
            await checkConnection()
            await loadAvailableAgents()
        }
    }
    
    func setAuthToken(_ token: String) {
        self.authToken = token
        Task {
            await checkConnection()
            await loadAvailableAgents()
        }
    }
    
    func checkConnection() async {
        connectionState = .connecting
        
        do {
            guard let url = URL(string: "\(baseURL)/health") else {
                connectionState = .error
                print("❌ Invalid health check URL")
                return
            }
            
            let (_, response) = try await URLSession.shared.data(from: url)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                connectionState = .connected
                print("✅ Connected to Universal AI Tools backend")
                
                // Add welcome message if no messages exist
                if messages.isEmpty {
                    let welcomeMessage = ChatMessage(
                        text: "Connected to Universal AI Tools! Select an agent and start chatting.",
                        isFromUser: false,
                        agentName: "system"
                    )
                    messages.append(welcomeMessage)
                    persistMessages()
                }
            } else {
                connectionState = .error
            }
        } catch {
            connectionState = .disconnected
            print("❌ Failed to connect: \(error)")
            
            // Add offline message if no messages exist
            if messages.isEmpty {
                let offlineMessage = ChatMessage(
                    text: "Cannot connect to Universal AI Tools backend. Make sure the server is running on localhost:9999",
                    isFromUser: false,
                    agentName: "system"
                )
                messages.append(offlineMessage)
                persistMessages()
            }
        }
    }
    
    func loadAvailableAgents() async {
        guard connectionState == .connected else {
            // Use predefined agents when offline
            availableAgents = Agent.predefinedAgents
            return
        }
        
        do {
            guard let url = URL(string: "\(baseURL)/api/v1/agents") else { return }
            
            var request = URLRequest(url: url)
            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200,
               let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let successData = responseData["data"] as? [String: Any],
               let agentsArray = successData["agents"] as? [[String: Any]] {
                
                let fetchedAgents = agentsArray.compactMap { agentData -> Agent? in
                    guard let name = agentData["name"] as? String,
                          let description = agentData["description"] as? String,
                          let category = agentData["category"] as? String,
                          let priority = agentData["priority"] as? Int,
                          let capabilities = agentData["capabilities"] as? [String],
                          let memoryEnabled = agentData["memoryEnabled"] as? Bool,
                          let maxLatencyMs = agentData["maxLatencyMs"] as? Int,
                          let loaded = agentData["loaded"] as? Bool else {
                        return nil
                    }
                    
                    return Agent(
                        name: name,
                        description: description,
                        category: category,
                        priority: priority,
                        capabilities: capabilities,
                        memoryEnabled: memoryEnabled,
                        maxLatencyMs: maxLatencyMs,
                        loaded: loaded
                    )
                }
                
                if !fetchedAgents.isEmpty {
                    availableAgents = fetchedAgents
                    // Update selected agent if it's not in the new list
                    if !availableAgents.contains(where: { $0.name == selectedAgent.name }) {
                        selectedAgent = availableAgents.first ?? Agent.predefinedAgents[0]
                    }
                }
            }
        } catch {
            print("❌ Failed to load agents: \(error)")
            // Keep using predefined agents
            availableAgents = Agent.predefinedAgents
        }
    }
    
    func sendMessage(_ messageText: String) async {
        guard !messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        let userMessage = ChatMessage(text: messageText, isFromUser: true)
        messages.append(userMessage)
        persistMessages()
        
        await sendToBackend(message: messageText)
    }
    
    private func sendToBackend(message: String) async {
        do {
            guard let url = URL(string: "\(baseURL)/api/v1/agents/execute") else {
                addErrorMessage("Configuration error: Invalid agent API URL")
                return
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let requestBody: [String: Any] = [
                "agentName": selectedAgent.name,
                "userRequest": message,
                "context": [
                    "platform": "ios",
                    "user_id": "ios_authenticated_user",
                    "conversation_history": messages.suffix(5).map { msg in
                        [
                            "role": msg.isFromUser ? "user" : "assistant",
                            "content": msg.text,
                            "timestamp": ISO8601DateFormatter().string(from: msg.timestamp)
                        ]
                    }
                ]
            ]
            
            let jsonData = try JSONSerialization.data(withJSONObject: requestBody)
            request.httpBody = jsonData
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200,
               let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let successData = responseData["data"] as? [String: Any] {
                
                // Extract response data
                let aiResponse = successData["response"] as? String ?? 
                                successData["content"] as? String ??
                                "I received your message but couldn't generate a proper response."
                
                let confidence = successData["confidence"] as? Double
                let metadata = successData["metadata"] as? [String: String]
                
                let aiMessage = ChatMessage(
                    text: aiResponse,
                    isFromUser: false,
                    agentName: selectedAgent.name,
                    confidence: confidence,
                    metadata: metadata
                )
                messages.append(aiMessage)
                persistMessages()
                
            } else {
                addErrorMessage("Sorry, I'm having trouble connecting to the server right now.")
            }
        } catch {
            addErrorMessage("Network error: \(error.localizedDescription)")
        }
    }
    
    private func addErrorMessage(_ text: String) {
        let errorMessage = ChatMessage(
            text: text,
            isFromUser: false,
            agentName: "system"
        )
        messages.append(errorMessage)
        persistMessages()
    }
    
    func clearMessages() {
        messages.removeAll()
        persistMessages()
    }
    
    func switchAgent(to agent: Agent) {
        selectedAgent = agent
        
        let switchMessage = ChatMessage(
            text: "Switched to \(agent.displayName). \(agent.description)",
            isFromUser: false,
            agentName: "system"
        )
        messages.append(switchMessage)
        persistMessages()
    }
    
    // MARK: - Persistence
    
    private func persistMessages() {
        do {
            let data = try JSONEncoder().encode(messages)
            UserDefaults.standard.set(data, forKey: "ChatMessages")
        } catch {
            print("❌ Failed to persist messages: \(error)")
        }
    }
    
    private func loadPersistedMessages() {
        guard let data = UserDefaults.standard.data(forKey: "ChatMessages") else { return }
        
        do {
            messages = try JSONDecoder().decode([ChatMessage].self, from: data)
        } catch {
            print("❌ Failed to load persisted messages: \(error)")
            messages = []
        }
    }
    
    // MARK: - Message History Management
    
    func exportMessages() -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .medium
        
        var export = "Universal AI Tools Chat Export\n"
        export += "Generated: \(formatter.string(from: Date()))\n"
        export += "Total Messages: \(messages.count)\n\n"
        
        for message in messages {
            let sender = message.isFromUser ? "User" : (message.agentName ?? "Assistant")
            export += "[\(formatter.string(from: message.timestamp))] \(sender):\n"
            export += "\(message.text)\n\n"
        }
        
        return export
    }
    
    func searchMessages(query: String) -> [ChatMessage] {
        let lowercaseQuery = query.lowercased()
        return messages.filter { message in
            message.text.lowercased().contains(lowercaseQuery) ||
            message.agentName?.lowercased().contains(lowercaseQuery) == true
        }
    }
}