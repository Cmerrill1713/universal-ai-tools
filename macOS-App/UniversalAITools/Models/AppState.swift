import Combine
// Import APIService
import Foundation
import SwiftUI

enum ViewMode {
  case webView
  case native
  case hybrid
}

// MARK: - Search Types
struct SearchResult: Identifiable {
  let id = UUID()
  let title: String
  let content: String
  let type: SearchResultType
  let action: () -> Void
}

enum SearchResultType {
  case chat
  case agent
  case tool
  case setting
}

enum SidebarItem: String, CaseIterable, Identifiable {
  case chat = "Chat"
  case objectives = "Objectives"
  case tools = "Tools"

  var id: String { rawValue }
  var title: String { rawValue }

  var icon: String {
    switch self {
    case .chat: return "bubble.left.and.bubble.right"
    case .objectives: return "target"
    case .tools: return "wrench.and.screwdriver"
    }
  }
}

enum ToolCategory: String, CaseIterable, Identifiable {
  case mlx = "MLX Fine-Tuning"
  case vision = "Vision"
  case monitoring = "Monitoring"
  case abMcts = "AB-MCTS"
  case maltSwarm = "MALT Swarm"
  case parameters = "Parameters"
  case knowledge = "Knowledge Base"
  case debugging = "Debugging"
  case guiGrounding = "GUI Grounding"

  var id: String { rawValue }
  var title: String { rawValue }

  var icon: String {
    switch self {
    case .mlx: return "cpu"
    case .vision: return "eye"
    case .monitoring: return "chart.line.uptrend.xyaxis"
    case .abMcts: return "tree"
    case .maltSwarm: return "network"
    case .parameters: return "slider.horizontal.3"
    case .knowledge: return "books.vertical"
    case .debugging: return "ladybug"
    case .guiGrounding: return "rectangle.3.group"
    }
  }

  var description: String {
    switch self {
    case .mlx: return "Fine-tune and train ML models"
    case .vision: return "Computer vision and image processing"
    case .monitoring: return "System monitoring and analytics"
    case .abMcts: return "AlphaBeta Monte Carlo Tree Search"
    case .maltSwarm: return "Multi-Agent Learning and Teaching"
    case .parameters: return "Intelligent parameter optimization"
    case .knowledge: return "Knowledge management and retrieval"
    case .debugging: return "Debug console and system diagnostics"
    case .guiGrounding: return "AI-powered UI element detection using region consistency"
    }
  }
}

extension SidebarItem {
  var defaultPath: String {
    switch self {
    case .chat: return "/chat"
    case .objectives: return "/objectives"
    case .tools: return "/tools"
    }
  }
}

extension ToolCategory {
  var defaultPath: String {
    switch self {
    case .mlx: return "/tools/mlx"
    case .vision: return "/tools/vision"
    case .monitoring: return "/tools/monitoring"
    case .abMcts: return "/tools/ab-mcts"
    case .maltSwarm: return "/tools/malt-swarm"
    case .parameters: return "/tools/parameters"
    case .knowledge: return "/tools/knowledge"
    case .debugging: return "/tools/debug"
    case .guiGrounding: return "/tools/gui-grounding"
    }
  }
}

@MainActor
class AppState: ObservableObject {
  // View state
  @Published var viewMode: ViewMode = .native
  @Published var sidebarVisible = true
  @Published var darkMode = true
  @Published var selectedSidebarItem: SidebarItem? = .chat

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
  @Published var showLayoutDebug = false
  @Published var showGlobalSearch = false

  // Notification state
  @Published var showNotification = false
  @Published var notificationMessage = ""
  @Published var notificationType: NotificationType = .info
  @Published var lastQuickResponse: String?
  @Published var shouldReloadWebView = false
  @Published var webViewState: String = ""

  // Tools state
  @Published var selectedTool: ToolCategory?

  // Search state
  @Published var globalSearchText = ""
  @Published var searchResults: [SearchResult] = []

  // Chat state
  @Published var chats: [Chat] = []
  @Published var currentChat: Chat?
  @Published var recentChats: [Chat] = []
  @Published var chatHistory: [Chat] = []
  @Published var chatMessages: [Message] = []

  // Agent state
  @Published var availableAgents: [Agent] = []
  @Published var activeAgents: [Agent] = []
  @Published var agentMetrics: [String: AgentMetrics] = [:]

  // Objectives state
  @Published var activeObjectives: [Objective] = []

  // Tools state
  @Published var availableTools: [AITool] = []
  @Published var recentToolUsage: [ToolUsage] = []

  // System metrics
  @Published var systemMetrics: SystemMetrics?
  @Published var apiServiceStatus: ServiceStatus = .unknown
  @Published var memoryUsage: Double = 0.0

  // Activity state
  @Published var recentActivities: [Activity] = []
  @Published var recentTasks: [TaskHistory] = []

  // User plan
  @Published var planType: PlanType = .free

  var cancellables = Set<AnyCancellable>()

  // MARK: - Window Management
  // Window opener closure for opening windows from AppState
  var windowOpener: ((String, String) -> Void)?

  func openAgentActivityWindow() {
    windowOpener?("agent-activity", "main")
  }

  func openAgentSelectorWindow() {
    windowOpener?("agent-selector", "main")
  }

  func openSystemMonitorWindow() {
    windowOpener?("system-monitor", "main")
  }

  func openMLXWindow() {
    windowOpener?("mlx-finetuning", "main")
  }

  func openVisionWindow() {
    windowOpener?("vision-processing", "main")
  }

  func openABMCTSWindow() {
    windowOpener?("ab-mcts", "main")
  }

  func openMALTSwarmWindow() {
    windowOpener?("malt-swarm", "main")
  }

  init() {
    loadInitialState()
    setupSubscriptions()
    loadSampleData()
  }

  private func loadInitialState() {
    // Load saved preferences
    if let savedViewMode = UserDefaults.standard.string(forKey: "viewMode") {
      viewMode = ViewMode(rawValue: savedViewMode) ?? .native
    }
    darkMode = UserDefaults.standard.bool(forKey: "darkMode")
    sidebarVisible = UserDefaults.standard.bool(forKey: "sidebarVisible")

    // Create default chat
    createNewChat()
  }

  private func loadSampleData() {
    loadSampleTools()
    loadSampleAgents()
    loadSampleTasks()

    // Set initial system status
    apiServiceStatus = .healthy
    memoryUsage = 45.2
  }

  private func loadSampleTools() {
    availableTools = [
      AITool(
        id: "1",
        name: "Text Analyzer",
        description: "Analyzes text for sentiment and key themes",
        category: "Text",
        status: .available,
        usageCount: 42
      ),
      AITool(
        id: "2",
        name: "Image Processor",
        description: "Processes and enhances images using AI",
        category: "Image",
        status: .available,
        usageCount: 28
      ),
      AITool(
        id: "3",
        name: "Data Summarizer",
        description: "Summarizes large datasets and documents",
        category: "Data",
        status: .available,
        usageCount: 35
      ),
      AITool(
        id: "4",
        name: "Code Generator",
        description: "Generates code based on natural language descriptions",
        category: "Code",
        status: .available,
        usageCount: 67
      ),
      AITool(
        id: "5",
        name: "Translation Tool",
        description: "Translates text between multiple languages",
        category: "Text",
        status: .available,
        usageCount: 89
      ),
      AITool(
        id: "6",
        name: "Voice Synthesizer",
        description: "Converts text to natural-sounding speech",
        category: "Audio",
        status: .available,
        usageCount: 23
      )
    ]
  }

  private func loadSampleAgents() {
    availableAgents = [
      Agent(
        id: "1",
        name: "Research Assistant",
        type: "Research",
        description: "Helps with research tasks and information gathering",
        capabilities: ["Web Search", "Document Analysis", "Data Collection"],
        status: .active
      ),
      Agent(
        id: "2",
        name: "Code Reviewer",
        type: "Development",
        description: "Reviews and analyzes code for quality and security",
        capabilities: ["Code Analysis", "Security Scanning", "Performance Review"],
        status: .active
      ),
      Agent(
        id: "3",
        name: "Content Writer",
        type: "Creative",
        description: "Generates high-quality written content",
        capabilities: ["Text Generation", "Style Adaptation", "Content Planning"],
        status: .inactive
      ),
      Agent(
        id: "4",
        name: "Data Analyst",
        type: "Analytics",
        description: "Analyzes data and generates insights",
        capabilities: ["Data Processing", "Statistical Analysis", "Visualization"],
        status: .busy
      )
    ]
  }

  private func loadSampleTasks() {
    recentTasks = [
      TaskHistory(
        id: "1",
        agentName: "Research Assistant",
        task: "Market research for Q4",
        status: .completed,
        duration: "2h 15m",
        timestamp: Date().addingTimeInterval(-3600)
      ),
      TaskHistory(
        id: "2",
        agentName: "Code Reviewer",
        task: "Security audit of payment module",
        status: .inProgress,
        duration: "45m",
        timestamp: Date().addingTimeInterval(-1800)
      ),
      TaskHistory(
        id: "3",
        agentName: "Data Analyst",
        task: "Customer behavior analysis",
        status: .completed,
        duration: "1h 30m",
        timestamp: Date().addingTimeInterval(-7200)
      )
    ]
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

    $showLayoutDebug
      .dropFirst()
      .sink { enabled in
        UserDefaults.standard.set(enabled, forKey: "showLayoutDebug")
      }
      .store(in: &cancellables)

    // Observe websocket status events
    NotificationCenter.default.publisher(for: .init("websocketConnected"))
      .sink { [weak self] _ in self?.websocketConnected = true }
      .store(in: &cancellables)

    NotificationCenter.default.publisher(for: .init("websocketDisconnected"))
      .sink { [weak self] _ in self?.websocketConnected = false }
      .store(in: &cancellables)
  }

  var isDarkMode: Bool { darkMode }

  func createNewChat() {
    let chat = Chat(id: UUID().uuidString, title: "New Chat", model: "gpt-4", messages: [])
    chats.append(chat)
    currentChat = chat
    recentChats.insert(chat, at: 0)
  }

  // MARK: - Data Export
  func exportChatHistory() -> String {
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    encoder.outputFormatting = .prettyPrinted

    do {
      let data = try encoder.encode(chatHistory)
      return String(data: data, encoding: .utf8) ?? "{}"
    } catch {
      return "Error exporting chat history: \(error.localizedDescription)"
    }
  }

  func exportChatAsText(_ chat: Chat) -> String {
    var output = "Chat: \(chat.title)\n"
    output += "Created: \(chat.createdAt.formatted())\n"
    output += "Model: \(chat.model)\n\n"

    for message in chat.messages {
      let role = message.role == .user ? "User" : "Assistant"
      output += "[\(role)] \(message.timestamp.formatted(date: .omitted, time: .shortened))\n"
      output += "\(message.content)\n\n"
    }

    return output
  }

  func saveToFile(content: String, filename: String) {
    let savePanel = NSSavePanel()
    savePanel.nameFieldStringValue = filename
    savePanel.allowedContentTypes = [.plainText, .json]

    if savePanel.runModal() == .OK {
      guard let url = savePanel.url else { return }

      do {
        try content.write(to: url, atomically: true, encoding: .utf8)
        showNotification(message: "Exported successfully to \(url.lastPathComponent)")
      } catch {
        showNotification(
          message: "Export failed: \(error.localizedDescription)", type: NotificationType.error)
      }
    }
  }

  // MARK: - Chat Methods
  func addChatMessage(_ message: Message) {
    chatMessages.append(message)
  }

  func clearChatMessages() {
    chatMessages.removeAll()
  }

  // MARK: - Agent Methods
  func activateAgent(_ agent: Agent) {
    if let index = availableAgents.firstIndex(where: { $0.id == agent.id }) {
      availableAgents[index].status = .active
      if !activeAgents.contains(where: { $0.id == agent.id }) {
        activeAgents.append(availableAgents[index])
      }
    }
  }

  func deactivateAgent(_ agent: Agent) {
    if let index = availableAgents.firstIndex(where: { $0.id == agent.id }) {
      availableAgents[index].status = .inactive
      activeAgents.removeAll { $0.id == agent.id }
    }
  }

  func removeAgent(_ agent: Agent) {
    availableAgents.removeAll { $0.id == agent.id }
    activeAgents.removeAll { $0.id == agent.id }
  }

  // MARK: - Tool Methods
  func updateToolUsage(_ toolId: String) {
    if let index = availableTools.firstIndex(where: { $0.id == toolId }) {
      availableTools[index].usageCount += 1
    }
  }

  func saveToolResult(_ toolId: String, result: String) {
    let usage = ToolUsage(
      id: UUID().uuidString,
      toolId: toolId,
      input: "",
      result: result,
      timestamp: Date()
    )
    recentToolUsage.insert(usage, at: 0)

    // Keep only last 50 results
    if recentToolUsage.count > 50 {
      recentToolUsage = Array(recentToolUsage.prefix(50))
    }
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
        let type = dict["type"] as? String
      else { return nil }

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

// MARK: - Supporting Types
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

enum ServiceStatus: String, CaseIterable {
  case healthy = "Healthy"
  case degraded = "Degraded"
  case down = "Down"
  case unknown = "Unknown"

  var color: Color {
    switch self {
    case .healthy: return .green
    case .degraded: return .orange
    case .down: return .red
    case .unknown: return .gray
    }
  }

  var icon: String {
    switch self {
    case .healthy: return "checkmark.circle.fill"
    case .degraded: return "exclamationmark.triangle.fill"
    case .down: return "xmark.circle.fill"
    case .unknown: return "questionmark.circle.fill"
    }
  }
}

struct Chat: Identifiable, Codable, Equatable {
  let id: String
  var title: String
  var model: String
  var messages: [Message]
  var createdAt = Date()
  var updatedAt = Date()

  static func == (lhs: Chat, rhs: Chat) -> Bool {
    lhs.id == rhs.id && lhs.title == rhs.title && lhs.model == rhs.model
      && lhs.messages == rhs.messages
  }
}

struct Message: Identifiable, Codable, Equatable {
  let id: String
  let content: String
  let role: MessageRole
  let timestamp: Date
  var metadata: [String: String]?

  init(
    id: String = UUID().uuidString,
    content: String,
    role: MessageRole,
    timestamp: Date = Date(),
    metadata: [String: String]? = nil
  ) {
    self.id = id
    self.content = content
    self.role = role
    self.timestamp = timestamp
    self.metadata = metadata
  }

  static func == (lhs: Message, rhs: Message) -> Bool {
    lhs.id == rhs.id && lhs.content == rhs.content && lhs.role == rhs.role
      && lhs.timestamp == rhs.timestamp
  }
}

struct ChatMessage: Identifiable, Codable {
  let id: String
  let content: String
  let role: MessageRole
  let timestamp: Date
  let model: String?

  init(
    id: String = UUID().uuidString,
    content: String,
    role: MessageRole,
    timestamp: Date = Date(),
    model: String? = nil
  ) {
    self.id = id
    self.content = content
    self.role = role
    self.timestamp = timestamp
    self.model = model
  }
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
  // Live activity (optional)
  var currentTask: String?
  var progress: Double?
  var startTime: Date?
}

enum AgentStatus: String, Codable {
  case active
  case inactive
  case busy
  case error
}

struct Objective: Identifiable, Codable {
  let id: String
  var title: String
  var description: String
  var type: String
  var status: ObjectiveStatus
  var progress: Int
  var tasks: [String]
  var createdAt = Date()
  var updatedAt = Date()
}

enum ObjectiveStatus: String, Codable {
  case planning
  case active
  case paused
  case completed
  case cancelled
}

struct AgentMetrics: Codable {
  let agentId: String
  let requestCount: Int
  let successRate: Double
  let averageResponseTime: Double
  let lastActivity: Date?
}

struct AITool: Identifiable, Codable {
  let id: String
  let name: String
  let description: String
  let category: String
  var status: ToolStatus
  var usageCount: Int
}

enum ToolStatus: String, Codable {
  case available
  case busy
  case offline
  case error
}

struct ToolUsage: Identifiable, Codable {
  let id: String
  let toolId: String
  let input: String
  let result: String
  let timestamp: Date
}

struct TaskHistory: Identifiable, Codable {
  let id: String
  let agentName: String
  let task: String
  let status: TaskStatus
  let duration: String
  let timestamp: Date
}

enum PlanType: String, Codable {
  case free = "Free"
  case pro = "Pro"
  case enterprise = "Enterprise"
}

enum TaskStatus: String, Codable {
  case pending
  case inProgress
  case completed
  case failed
  case cancelled

  var color: Color {
    switch self {
    case .pending: return .orange
    case .inProgress: return .blue
    case .completed: return .green
    case .failed: return .red
    case .cancelled: return .gray
    }
  }

  var icon: String {
    switch self {
    case .pending: return "clock"
    case .inProgress: return "arrow.clockwise"
    case .completed: return "checkmark.circle"
    case .failed: return "xmark.circle"
    case .cancelled: return "slash.circle"
    }
  }
}

struct SystemMetrics: Codable {
  let cpuUsage: Double
  let memoryUsage: Double
  let uptime: Double
  let requestsPerMinute: Int
  let activeConnections: Int

  // Optional fields used by some charts/views
  var cpuHistory: [CPUPoint]?
  var memoryBytes: Int64?
  var memoryHistory: [CPUPoint]?
  var requestHistory: [IntPoint]?
  var responseTimeHistory: [IntPoint]?
}

struct CPUPoint: Identifiable, Codable {
  let id: UUID
  let value: Double
  let timestamp: Date

  init(id: UUID = UUID(), value: Double, timestamp: Date) {
    self.id = id
    self.value = value
    self.timestamp = timestamp
  }
}

struct IntPoint: Identifiable, Codable {
  let id: UUID
  let value: Int
  let timestamp: Date

  init(id: UUID = UUID(), value: Int, timestamp: Date) {
    self.id = id
    self.value = value
    self.timestamp = timestamp
  }
}

struct Activity: Identifiable, Codable {
  let id: String
  let icon: String
  let colorHex: String
  let title: String
  let description: String
  let timestamp: String
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
