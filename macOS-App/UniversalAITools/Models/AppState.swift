import Foundation
import SwiftUI
import Combine
import OSLog

// MARK: - API Service Status
enum APIServiceStatus: String, CaseIterable, Codable {
    case disconnected = "disconnected"
    case connecting = "connecting"
    case connected = "connected"
    case error = "error"
    
    var color: Color {
        switch self {
        case .disconnected: return .gray
        case .connecting: return .yellow
        case .connected: return .green
        case .error: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .disconnected: return "wifi.slash"
        case .connecting: return "wifi.exclamationmark"
        case .connected: return "wifi"
        case .error: return "xmark.circle"
        }
    }
}

// MARK: - Application State
@MainActor
class AppState: ObservableObject {
    // MARK: - Published Properties
    @Published var chats: [Chat] = []
    @Published var recentChats: [Chat] = []
    @Published var currentChat: Chat?
    @Published var selectedSidebarItem: SidebarItem? = .chat
    @Published var isConnectedToBackend: Bool = false
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var activeObjectives: [Objective] = []
    @Published var availableModels: [String] = []
    @Published var selectedModel: String = "gpt-oss:20b"
    @Published var isGeneratingResponse: Bool = false
    @Published var errorMessage: String?
    @Published var showSettings: Bool = false
    @Published var showDebugPanel: Bool = false
    
    // Window and UI State
    @Published var showAboutWindow: Bool = false
    @Published var darkMode: Bool = false
    @Published var viewMode: ViewMode = .native
    @Published var backendConnected: Bool = false
    
    // Onboarding and Feature Discovery
    @Published var showOnboarding: Bool = false
    @Published var hasCompletedOnboarding: Bool = UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")
    @Published var isFirstTimeUser: Bool = !UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")
    @Published var featureDiscoveryManager = FeatureDiscoveryManager()
    @Published var enhancedNavigationService: EnhancedNavigationService?
    @Published var showNotification: Bool = false
    @Published var notificationType: String = "info"
    @Published var sidebarVisible: Bool = true
    @Published var showAgentSelector: Bool = false
    @Published var showAgentSelectorWindow: Bool = false
    @Published var showGlobalSearch: Bool = false
    
    // System State
    @Published var isLoading: Bool = false
    @Published var systemMetrics: SystemMetrics?
    @Published var availableAgents: [Agent] = []
    @Published var apiServiceStatus: APIServiceStatus = .disconnected
    @Published var memoryUsage: Double = 0.0
    
    // Agent and Activity State
    @Published var activeAgents: [Agent] = []
    @Published var recentTasks: [TaskHistory] = []
    @Published var selectedTool: ToolCategory? = nil
    
    // Services
    @Published var apiService: APIService
    @Published var ttsService: TTSService?
    @Published var sttService: STTService?
    @Published var voiceAgent: VoiceAgent?
    
    // RAG Settings
    @Published var ragSettings: RAGSettings = RAGSettings()
    
    // Messages for current chat
    var messages: [Message] {
        return currentChat?.messages ?? []
    }
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "appstate")
    var cancellables = Set<AnyCancellable>()
    
    // Window management closure - set by ContentView
    var windowOpener: ((String, String) -> Void)?
    
    // MARK: - Initialization
    init() {
        self.apiService = APIService()
        setupServices()
        setupBindings()
        loadPersistedData()
        setupOnboarding()
        
        logger.info("AppState initialized")
    }
    
    private func setupOnboarding() {
        featureDiscoveryManager.loadDiscoveredFeatures()
        
        // Show onboarding for new users
        if !hasCompletedOnboarding {
            showOnboarding = true
        }
    }
    
    func completeOnboarding() {
        hasCompletedOnboarding = true
        isFirstTimeUser = false
        showOnboarding = false
        UserDefaults.standard.set(true, forKey: "hasCompletedOnboarding")
    }
    
    // MARK: - Service Setup
    private func setupServices() {
        // Initialize voice services
        ttsService = TTSService()
        sttService = STTService()
        
        if let tts = ttsService, let stt = sttService {
            voiceAgent = VoiceAgent(sttService: stt, ttsService: tts, apiService: apiService)
        }
    }
    
    // MARK: - Bindings Setup
    private func setupBindings() {
        // Monitor API service connection
        apiService.$isConnected
            .sink { [weak self] connected in
                Task { @MainActor in
                    self?.isConnectedToBackend = connected
                    self?.connectionStatus = connected ? .connected : .disconnected
                }
            }
            .store(in: &cancellables)
        
        // Monitor API service errors
        apiService.$lastError
            .compactMap { $0 }
            .sink { [weak self] error in
                Task { @MainActor in
                    self?.errorMessage = error
                }
            }
            .store(in: &cancellables)
        
        // Monitor available models
        apiService.$availableModels
            .sink { [weak self] models in
                Task { @MainActor in
                    self?.availableModels = models
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Chat Management
    func createNewChat() -> Chat {
        let chat = Chat()
        chats.insert(chat, at: 0) // Add to beginning
        currentChat = chat
        saveChatsData()
        
        logger.info("Created new chat: \(chat.id)")
        return chat
    }
    
    func selectChat(_ chat: Chat) {
        currentChat = chat
        
        // Mark as active
        for index in chats.indices {
            chats[index].isActive = chats[index].id == chat.id
        }
        
        logger.info("Selected chat: \(chat.id)")
    }
    
    func deleteChat(_ chat: Chat) {
        chats.removeAll { $0.id == chat.id }
        
        if currentChat?.id == chat.id {
            currentChat = chats.first
        }
        
        saveChatsData()
        logger.info("Deleted chat: \(chat.id)")
    }
    
    func addMessage(to chat: Chat, message: Message) {
        if let index = chats.firstIndex(where: { $0.id == chat.id }) {
            chats[index].addMessage(message)
            
            if currentChat?.id == chat.id {
                currentChat = chats[index]
            }
            
            saveChatsData()
        }
    }
    
    func sendMessage(_ content: String) async {
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        // Ensure we have a current chat
        if currentChat == nil {
            currentChat = createNewChat()
        }
        
        guard let chat = currentChat else { return }
        
        // Add user message
        let userMessage = Message(role: .user, content: content)
        addMessage(to: chat, message: userMessage)
        
        // Set generating state
        isGeneratingResponse = true
        errorMessage = nil
        
        do {
            // Send to API service using the correct method signature
            let response = try await apiService.sendChatMessage(content, chatId: chat.id.uuidString)
            
            // Add assistant response
            addMessage(to: chat, message: response)
            
            logger.info("Message sent and response received for chat: \(chat.id)")
            
        } catch {
            logger.error("Failed to send message: \(error)")
            errorMessage = "Failed to send message: \(error.localizedDescription)"
            
            // Add error message
            let errorMsg = Message(
                role: .assistant,
                content: "Sorry, I encountered an error processing your request: \(error.localizedDescription)"
            )
            addMessage(to: chat, message: errorMsg)
        }
        
        isGeneratingResponse = false
    }
    
    // MARK: - Model Management
    func setSelectedModel(_ model: String) {
        selectedModel = model
        UserDefaults.standard.set(model, forKey: "selectedModel")
        logger.info("Selected model changed to: \(model)")
    }
    
    // MARK: - Objectives Management
    func addObjective(_ objective: Objective) {
        activeObjectives.append(objective)
        saveObjectivesData()
    }
    
    func updateObjective(_ objective: Objective) {
        if let index = activeObjectives.firstIndex(where: { $0.id == objective.id }) {
            activeObjectives[index] = objective
            saveObjectivesData()
        }
    }
    
    func removeObjective(_ objective: Objective) {
        activeObjectives.removeAll { $0.id == objective.id }
        saveObjectivesData()
    }
    
    // MARK: - Connection Management
    func connectToBackend() async {
        await apiService.connectToBackend()
    }
    
    func disconnectFromBackend() {
        // APIService doesn't have a disconnect method, so we'll handle this differently
        isConnectedToBackend = false
        connectionStatus = .disconnected
    }
    
    // MARK: - Error Handling
    func clearError() {
        errorMessage = nil
    }
    
    func showError(_ error: String) {
        errorMessage = error
        logger.error("App error: \(error)")
    }
    
    // MARK: - Data Persistence
    private func loadPersistedData() {
        loadChatsData()
        loadObjectivesData()
        loadSettings()
    }
    
    private func loadChatsData() {
        if let data = UserDefaults.standard.data(forKey: "chats"),
           let decodedChats = try? JSONDecoder().decode([Chat].self, from: data) {
            chats = decodedChats
            currentChat = chats.first { $0.isActive } ?? chats.first
        }
    }
    
    private func saveChatsData() {
        if let encoded = try? JSONEncoder().encode(chats) {
            UserDefaults.standard.set(encoded, forKey: "chats")
        }
    }
    
    private func loadObjectivesData() {
        if let data = UserDefaults.standard.data(forKey: "objectives"),
           let decodedObjectives = try? JSONDecoder().decode([Objective].self, from: data) {
            activeObjectives = decodedObjectives
        }
    }
    
    private func saveObjectivesData() {
        if let encoded = try? JSONEncoder().encode(activeObjectives) {
            UserDefaults.standard.set(encoded, forKey: "objectives")
        }
    }
    
    private func loadSettings() {
        selectedModel = UserDefaults.standard.string(forKey: "selectedModel") ?? "gpt-oss:20b"
        showDebugPanel = UserDefaults.standard.bool(forKey: "showDebugPanel")
    }
    
    // MARK: - Debug Functions
    func toggleDebugPanel() {
        showDebugPanel.toggle()
        UserDefaults.standard.set(showDebugPanel, forKey: "showDebugPanel")
    }
    
    // MARK: - UI State Functions
    func openAgentSelectorWindow() {
        showAgentSelectorWindow = true
    }
    
    func openConversationWindow() {
        windowOpener?("conversation", "main")
    }
    
    func openAgentActivityWindow() {
        windowOpener?("agent-activity", "main")
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
    
    func openSystemMonitorWindow() {
        windowOpener?("system-monitor", "main")
    }
    
    func showNotification(type: String, message: String) {
        notificationType = type
        errorMessage = message
        showNotification = true
    }
    
    // MARK: - Agent Management
    func addActiveAgent(_ agent: Agent) {
        activeAgents.append(agent)
    }
    
    func removeActiveAgent(_ agent: Agent) {
        activeAgents.removeAll { $0.id == agent.id }
    }
    
    func activateAgent(_ agent: Agent) {
        if !activeAgents.contains(where: { $0.id == agent.id }) {
            activeAgents.append(agent)
        }
    }
    
    func showNotification(message: String, type: NotificationType) {
        errorMessage = message
        showNotification = true
        notificationType = type.rawValue
    }
}

enum NotificationType: String {
    case info = "info"
    case warning = "warning"
    case error = "error"
    case success = "success"
}

// MARK: - Connection Status
// ConnectionStatus is defined in SharedTypes.swift

// MARK: - Objective Model
struct Objective: Identifiable, Codable, Hashable {
    let id: UUID
    var title: String
    var description: String
    var type: ObjectiveType
    var status: ObjectiveStatus
    var priority: Priority
    let createdAt: Date
    var updatedAt: Date
    var dueDate: Date?
    var progress: Double // 0.0 to 1.0
    var tags: [String]
    
    init(
        id: UUID = UUID(),
        title: String,
        description: String = "",
        type: ObjectiveType = .task,
        status: ObjectiveStatus = .active,
        priority: Priority = .medium,
        dueDate: Date? = nil,
        progress: Double = 0.0,
        tags: [String] = []
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.type = type
        self.status = status
        self.priority = priority
        self.createdAt = Date()
        self.updatedAt = Date()
        self.dueDate = dueDate
        self.progress = progress
        self.tags = tags
    }
    
    enum ObjectiveStatus: String, Codable, CaseIterable {
        case planning = "planning"
        case active = "active"
        case paused = "paused"
        case completed = "completed"
        case cancelled = "cancelled"
        
        var displayName: String {
            switch self {
            case .planning: return "Planning"
            case .active: return "Active"
            case .paused: return "Paused"
            case .completed: return "Completed"
            case .cancelled: return "Cancelled"
            }
        }
        
        var color: Color {
            switch self {
            case .planning: return .purple
            case .active: return .blue
            case .paused: return .orange
            case .completed: return .green
            case .cancelled: return .red
            }
        }
    }
    
    enum Priority: String, Codable, CaseIterable {
        case low = "low"
        case medium = "medium"
        case high = "high"
        case critical = "critical"
        
        var displayName: String {
            switch self {
            case .low: return "Low"
            case .medium: return "Medium"
            case .high: return "High"
            case .critical: return "Critical"
            }
        }
        
        var color: Color {
            switch self {
            case .low: return .gray
            case .medium: return .blue
            case .high: return .orange
            case .critical: return .red
            }
        }
    }
    
    enum ObjectiveType: String, Codable, CaseIterable {
        case task = "task"
        case goal = "goal"
        case milestone = "milestone"
        case research = "research"
        case maintenance = "maintenance"
        case optimization = "optimization"
        
        var displayName: String {
            switch self {
            case .task: return "Task"
            case .goal: return "Goal"
            case .milestone: return "Milestone"
            case .research: return "Research"
            case .maintenance: return "Maintenance"
            case .optimization: return "Optimization"
            }
        }
        
        var icon: String {
            switch self {
            case .task: return "checkmark.circle"
            case .goal: return "target"
            case .milestone: return "flag"
            case .research: return "magnifyingglass"
            case .maintenance: return "wrench"
            case .optimization: return "speedometer"
            }
        }
    }
}

// MARK: - Supporting Types
// TaskHistory is defined in SharedTypes.swift to avoid conflicts

enum ToolCategory: String, CaseIterable, Identifiable {
    case ai = "ai"
    case analysis = "analysis"
    case development = "development"
    case monitoring = "monitoring"
    case optimization = "optimization"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .ai: return "AI Tools"
        case .analysis: return "Analysis"
        case .development: return "Development"
        case .monitoring: return "Monitoring"
        case .optimization: return "Optimization"
        }
    }
    
    var icon: String {
        switch self {
        case .ai: return "brain.head.profile"
        case .analysis: return "chart.bar"
        case .development: return "hammer"
        case .monitoring: return "eye"
        case .optimization: return "speedometer"
        }
    }
}
