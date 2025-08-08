import SwiftUI
import Combine

enum ViewMode {
    case webView
    case native
    case hybrid
}

enum SidebarItem: String, CaseIterable, Identifiable {
    case dashboard = "Dashboard"
    case chat = "Chat"
    case agents = "Agents"
    case mlx = "MLX Fine-Tuning"
    case vision = "Vision"
    case monitoring = "Monitoring"
    case abMcts = "AB-MCTS"
    case maltSwarm = "MALT Swarm"
    case parameters = "Parameters"
    case knowledge = "Knowledge Base"
    
    var id: String { rawValue }
    
    var title: String { rawValue }
    
    var icon: String {
        switch self {
        case .dashboard: return "chart.bar.xaxis"
        case .chat: return "bubble.left.and.bubble.right"
        case .agents: return "person.3"
        case .mlx: return "cpu"
        case .vision: return "eye"
        case .monitoring: return "chart.line.uptrend.xyaxis"
        case .abMcts: return "tree"
        case .maltSwarm: return "network"
        case .parameters: return "slider.horizontal.3"
        case .knowledge: return "books.vertical"
        }
    }
}

@MainActor
class AppState: ObservableObject {
    // View state
    @Published var viewMode: ViewMode = .hybrid
    @Published var sidebarVisible = true
    @Published var darkMode = true
    
    // Connection state
    @Published var backendConnected = false
    @Published var websocketConnected = false
    
    // Window states
    @Published var showSettings = false
    @Published var showAboutWindow = false
    @Published var showAgentSelector = false
    @Published var showAgentMonitor = false
    @Published var showMLXInterface = false
    @Published var showVisionInterface = false
    @Published var showABMCTS = false
    @Published var showMALTSwarm = false
    
    // Notification state
    @Published var showNotification = false
    @Published var notificationMessage = ""
    @Published var notificationType: NotificationType = .info
    
    // Chat state
    @Published var chats: [Chat] = []
    @Published var currentChat: Chat?
    
    // Agent state
    @Published var availableAgents: [Agent] = []
    @Published var activeAgents: [Agent] = []
    @Published var agentMetrics: [String: AgentMetrics] = [:]
    
    // System metrics
    @Published var systemMetrics: SystemMetrics?
    
    var cancellables = Set<AnyCancellable>()
    
    init() {
        loadInitialState()
        setupSubscriptions()
    }
    
    private func loadInitialState() {
        // Load saved preferences
        if let savedViewMode = UserDefaults.standard.string(forKey: "viewMode") {
            viewMode = ViewMode(rawValue: savedViewMode) ?? .hybrid
        }
        darkMode = UserDefaults.standard.bool(forKey: "darkMode")
        sidebarVisible = UserDefaults.standard.bool(forKey: "sidebarVisible")
        
        // Create default chat
        createNewChat()
    }
    
    private func setupSubscriptions() {
        // Save preferences when they change
        $viewMode
            .dropFirst()
            .sink { mode in
                UserDefaults.standard.set(mode.rawValue, forKey: "viewMode")
            }
            .store(in: &cancellables)
        
        $darkMode
            .dropFirst()
            .sink { dark in
                UserDefaults.standard.set(dark, forKey: "darkMode")
                NSApplication.shared.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
            }
            .store(in: &cancellables)
        
        $sidebarVisible
            .dropFirst()
            .sink { visible in
                UserDefaults.standard.set(visible, forKey: "sidebarVisible")
            }
            .store(in: &cancellables)
    }
    
    func createNewChat() {
        let chat = Chat(id: UUID().uuidString, title: "New Chat", messages: [])
        chats.append(chat)
        currentChat = chat
    }
    
    func showNotification(message: String, type: NotificationType = .info) {
        notificationMessage = message
        notificationType = type
        showNotification = true
        
        // Auto-hide after 3 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            self.showNotification = false
        }
    }
    
    func updateFromWeb(_ data: [String: Any]) {
        // Update state based on web component changes
        if let agents = data["agents"] as? [[String: Any]] {
            updateAgents(from: agents)
        }
        
        if let metrics = data["metrics"] as? [String: Any] {
            updateMetrics(from: metrics)
        }
    }
    
    private func updateAgents(from data: [[String: Any]]) {
        availableAgents = data.compactMap { dict in
            guard let id = dict["id"] as? String,
                  let name = dict["name"] as? String,
                  let type = dict["type"] as? String else { return nil }
            
            return Agent(
                id: id,
                name: name,
                type: type,
                description: dict["description"] as? String ?? "",
                capabilities: dict["capabilities"] as? [String] ?? [],
                status: AgentStatus(rawValue: dict["status"] as? String ?? "inactive") ?? .inactive
            )
        }
    }
    
    private func updateMetrics(from data: [String: Any]) {
        if let cpu = data["cpu"] as? Double,
           let memory = data["memory"] as? Double,
           let uptime = data["uptime"] as? Double {
            systemMetrics = SystemMetrics(
                cpuUsage: cpu,
                memoryUsage: memory,
                uptime: uptime,
                requestsPerMinute: data["rpm"] as? Int ?? 0,
                activeConnections: data["connections"] as? Int ?? 0
            )
        }
    }
}

// Supporting Types
enum NotificationType {
    case info
    case success
    case warning
    case error
    
    var color: Color {
        switch self {
        case .info: return .blue
        case .success: return .green
        case .warning: return .orange
        case .error: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .info: return "info.circle"
        case .success: return "checkmark.circle"
        case .warning: return "exclamationmark.triangle"
        case .error: return "xmark.circle"
        }
    }
}

struct Chat: Identifiable, Codable {
    let id: String
    var title: String
    var messages: [Message]
    var createdAt = Date()
    var updatedAt = Date()
}

struct Message: Identifiable, Codable {
    let id = UUID().uuidString
    let content: String
    let role: MessageRole
    let timestamp = Date()
    var metadata: [String: String]?
}

enum MessageRole: String, Codable {
    case user
    case assistant
    case system
}

struct Agent: Identifiable, Codable {
    let id: String
    let name: String
    let type: String
    let description: String
    let capabilities: [String]
    var status: AgentStatus
}

enum AgentStatus: String, Codable {
    case active
    case inactive
    case busy
    case error
}

struct AgentMetrics: Codable {
    let agentId: String
    let requestCount: Int
    let successRate: Double
    let averageResponseTime: Double
    let lastActivity: Date?
}

struct SystemMetrics: Codable {
    let cpuUsage: Double
    let memoryUsage: Double
    let uptime: Double
    let requestsPerMinute: Int
    let activeConnections: Int
}

extension ViewMode: RawRepresentable {
    typealias RawValue = String
    
    init?(rawValue: String) {
        switch rawValue {
        case "webView": self = .webView
        case "native": self = .native
        case "hybrid": self = .hybrid
        default: return nil
        }
    }
    
    var rawValue: String {
        switch self {
        case .webView: return "webView"
        case .native: return "native"
        case .hybrid: return "hybrid"
        }
    }
}