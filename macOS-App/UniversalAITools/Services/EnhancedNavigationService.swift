import Foundation
import SwiftUI
import Combine
import OSLog

/// Service managing enhanced navigation, feature discovery, and smart suggestions
@MainActor
class EnhancedNavigationService: ObservableObject {
    
    // MARK: - Published Properties
    @Published var navigationFeatures: [NavigationFeature] = []
    @Published var navigationSections: [NavigationSection] = []
    @Published var recentlyUsedFeatures: [NavigationFeature] = []
    @Published var smartSuggestions: [SmartSuggestion] = []
    @Published var availableTours: [GuidedTour] = []
    @Published var currentBreadcrumbs: [NavigationBreadcrumb] = []
    @Published var preferences: NavigationPreferences = NavigationPreferences()
    @Published var featureUsageStats: [String: FeatureUsage] = [:]
    @Published var searchResults: [NavigationFeature] = []
    @Published var isSearching: Bool = false
    
    // MARK: - Private Properties
    private let logger = Logger(subsystem: "com.universalai.tools", category: "navigation")
    private var cancellables = Set<AnyCancellable>()
    private let userDefaults = UserDefaults.standard
    
    // MARK: - Constants
    private enum UserDefaultsKeys {
        static let featureUsage = "feature_usage_stats"
        static let navigationPreferences = "navigation_preferences"
        static let completedTours = "completed_tours"
        static let recentFeatures = "recent_features"
    }
    
    // MARK: - Initialization
    init() {
        setupNavigationFeatures()
        loadPersistedData()
        generateSmartSuggestions()
        setupBindings()
        logger.info("Enhanced navigation service initialized")
    }
    
    // MARK: - Navigation Features Setup
    private func setupNavigationFeatures() {
        navigationFeatures = [
            // Core Features
            NavigationFeature(
                id: "chat",
                title: "Chat Interface",
                description: "AI-powered conversation interface with multiple models",
                icon: "text.bubble.fill",
                category: .core,
                level: .core,
                keywords: ["chat", "conversation", "ai", "talk"],
                shortcutKey: "⌘N",
                action: .showView("chat")
            ),
            
            NavigationFeature(
                id: "dashboard",
                title: "Dashboard",
                description: "Overview of system status and key metrics",
                icon: "rectangle.3.group.fill",
                category: .core,
                level: .core,
                keywords: ["dashboard", "overview", "summary", "home"],
                shortcutKey: "⌘D",
                action: .showView("dashboard")
            ),
            
            // AI Features
            NavigationFeature(
                id: "knowledge_graph",
                title: "3D Knowledge Graph",
                description: "Interactive 3D visualization of knowledge relationships",
                icon: "point.3.connected.trianglepath.dotted",
                category: .knowledge,
                level: .advanced,
                keywords: ["graph", "knowledge", "3d", "visualization", "network"],
                isNew: true,
                action: .showView("knowledge_graph")
            ),
            
            NavigationFeature(
                id: "agent_orchestration",
                title: "Agent Orchestration",
                description: "Coordinate and manage multiple AI agents",
                icon: "network",
                category: .agents,
                level: .advanced,
                keywords: ["agents", "orchestration", "coordination", "swarm"],
                requiresPro: true,
                action: .openWindow("agent-activity")
            ),
            
            NavigationFeature(
                id: "voice_interface",
                title: "Voice Interface",
                description: "Speech-to-text and text-to-speech AI interaction",
                icon: "mic.fill",
                category: .ai,
                level: .core,
                keywords: ["voice", "speech", "audio", "stt", "tts"],
                shortcutKey: "⌘⇧V",
                action: .showView("voice")
            ),
            
            // Analytics Features
            NavigationFeature(
                id: "performance_analytics",
                title: "Performance Analytics",
                description: "Real-time performance metrics and analysis",
                icon: "chart.bar.doc.horizontal.fill",
                category: .analytics,
                level: .advanced,
                keywords: ["analytics", "performance", "metrics", "analysis"],
                action: .showView("performance_analytics")
            ),
            
            NavigationFeature(
                id: "flash_attention",
                title: "Flash Attention Analytics",
                description: "Advanced attention mechanism visualization and analysis",
                icon: "bolt.circle.fill",
                category: .analytics,
                level: .advanced,
                keywords: ["attention", "flash", "analytics", "visualization"],
                isNew: true,
                requiresPro: true,
                action: .showView("flash_attention")
            ),
            
            NavigationFeature(
                id: "context_flow",
                title: "Context Flow Visualization",
                description: "Visualize context flow and semantic relationships",
                icon: "arrow.triangle.branch",
                category: .analytics,
                level: .advanced,
                keywords: ["context", "flow", "semantic", "relationships"],
                action: .showView("context_flow")
            ),
            
            // Tools & Utilities
            NavigationFeature(
                id: "mlx_finetuning",
                title: "MLX Fine-Tuning",
                description: "Fine-tune machine learning models with MLX",
                icon: "cpu",
                category: .tools,
                level: .advanced,
                keywords: ["mlx", "fine-tuning", "training", "models"],
                requiresPro: true,
                action: .openWindow("mlx-finetuning")
            ),
            
            NavigationFeature(
                id: "vision_processing",
                title: "Vision Processing",
                description: "Computer vision and image processing tools",
                icon: "camera.fill",
                category: .tools,
                level: .advanced,
                keywords: ["vision", "image", "processing", "computer vision"],
                action: .openWindow("vision-processing")
            ),
            
            NavigationFeature(
                id: "workflow_management",
                title: "Workflow Management",
                description: "Create and manage automated workflows",
                icon: "arrow.triangle.branch",
                category: .tools,
                level: .core,
                keywords: ["workflow", "automation", "process", "management"],
                action: .showView("workflows")
            ),
            
            // Monitoring
            NavigationFeature(
                id: "system_monitoring",
                title: "System Monitoring",
                description: "Real-time system health and resource monitoring",
                icon: "gauge.high",
                category: .monitoring,
                level: .core,
                keywords: ["monitoring", "system", "health", "resources"],
                action: .openWindow("system-monitor")
            ),
            
            NavigationFeature(
                id: "debug_console",
                title: "Debug Console",
                description: "Advanced debugging and logging interface",
                icon: "terminal.fill",
                category: .monitoring,
                level: .core,
                keywords: ["debug", "console", "logging", "troubleshooting"],
                shortcutKey: "⌘⇧D",
                action: .showView("debug_console")
            ),
            
            // Advanced Features
            NavigationFeature(
                id: "ab_mcts",
                title: "AB-MCTS Orchestration",
                description: "Alpha-Beta Monte Carlo Tree Search orchestration",
                icon: "tree.fill",
                category: .advanced,
                level: .advanced,
                keywords: ["mcts", "alpha-beta", "tree search", "orchestration"],
                requiresPro: true,
                action: .openWindow("ab-mcts")
            ),
            
            NavigationFeature(
                id: "malt_swarm",
                title: "MALT Swarm Control",
                description: "Multi-Agent Learning and Training swarm coordination",
                icon: "hexagon.fill",
                category: .advanced,
                level: .advanced,
                keywords: ["malt", "swarm", "multi-agent", "learning"],
                requiresPro: true,
                action: .openWindow("malt-swarm")
            ),
            
            // Settings
            NavigationFeature(
                id: "settings",
                title: "Settings & Preferences",
                description: "Configure application settings and preferences",
                icon: "gear",
                category: .settings,
                level: .core,
                keywords: ["settings", "preferences", "configuration", "options"],
                shortcutKey: "⌘,",
                action: .showSettings
            )
        ]
        
        createNavigationSections()
    }
    
    private func createNavigationSections() {
        let groupedFeatures = Dictionary(grouping: navigationFeatures) { $0.category }
        
        navigationSections = FeatureCategory.allCases.compactMap { category in
            guard let features = groupedFeatures[category], !features.isEmpty else { return nil }
            
            let newFeatureCount = features.filter { $0.isNew }.count
            
            return NavigationSection(
                id: category.rawValue,
                title: category.displayName,
                icon: category.icon,
                category: category,
                features: features.sorted { $0.title < $1.title },
                isCollapsible: category != .core,
                defaultExpanded: category == .core || category == .ai,
                showBadge: newFeatureCount > 0,
                badgeCount: newFeatureCount > 0 ? newFeatureCount : nil
            )
        }.sorted { section1, section2 in
            let order: [FeatureCategory] = [.core, .ai, .analytics, .agents, .knowledge, .tools, .monitoring, .advanced, .settings]
            let index1 = order.firstIndex(of: section1.category) ?? Int.max
            let index2 = order.firstIndex(of: section2.category) ?? Int.max
            return index1 < index2
        }
    }
    
    // MARK: - Feature Usage Tracking
    func recordFeatureUsage(_ featureId: String, sessionDuration: TimeInterval = 0) {
        var usage = featureUsageStats[featureId] ?? FeatureUsage(featureId: featureId)
        usage.recordUsage(sessionDuration: sessionDuration)
        featureUsageStats[featureId] = usage
        
        // Update recently used features
        updateRecentlyUsedFeatures(featureId)
        
        // Regenerate suggestions based on new usage pattern
        generateSmartSuggestions()
        
        // Persist usage data
        saveFeatureUsageStats()
        
        logger.info("Recorded usage for feature: \(featureId)")
    }
    
    private func updateRecentlyUsedFeatures(_ featureId: String) {
        guard let feature = navigationFeatures.first(where: { $0.id == featureId }) else { return }
        
        // Remove if already exists
        recentlyUsedFeatures.removeAll { $0.id == featureId }
        
        // Add to beginning
        recentlyUsedFeatures.insert(feature, at: 0)
        
        // Limit to max recent items
        if recentlyUsedFeatures.count > preferences.maxRecentItems {
            recentlyUsedFeatures = Array(recentlyUsedFeatures.prefix(preferences.maxRecentItems))
        }
        
        saveRecentFeatures()
    }
    
    // MARK: - Smart Suggestions
    private func generateSmartSuggestions() {
        var suggestions: [SmartSuggestion] = []
        
        // Frequently used features
        let frequentFeatures = featureUsageStats.values
            .filter { $0.usageCount >= 3 }
            .sorted { $0.usageCount > $1.usageCount }
            .prefix(3)
        
        for usage in frequentFeatures {
            if let feature = navigationFeatures.first(where: { $0.id == usage.featureId }) {
                suggestions.append(SmartSuggestion(
                    id: "freq_\(feature.id)",
                    feature: feature,
                    reason: .frequentlyUsed,
                    confidence: min(Double(usage.usageCount) / 10.0, 1.0),
                    contextualHint: "Used \(usage.usageCount) times"
                ))
            }
        }
        
        // New features
        let newFeatures = navigationFeatures.filter { $0.isNew && $0.isEnabled }
        for feature in newFeatures.prefix(2) {
            suggestions.append(SmartSuggestion(
                id: "new_\(feature.id)",
                feature: feature,
                reason: .newFeature,
                confidence: 0.8,
                contextualHint: "Just added"
            ))
        }
        
        // Time-based suggestions (e.g., monitoring tools during work hours)
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: Date())
        
        if hour >= 9 && hour <= 17 { // Work hours
            let workFeatures = navigationFeatures.filter {
                $0.category == .monitoring || $0.category == .analytics
            }
            
            for feature in workFeatures.prefix(1) {
                suggestions.append(SmartSuggestion(
                    id: "time_\(feature.id)",
                    feature: feature,
                    reason: .timeBasedPattern,
                    confidence: 0.6,
                    contextualHint: "Useful during work hours"
                ))
            }
        }
        
        smartSuggestions = suggestions.sorted { $0.confidence > $1.confidence }
    }
    
    // MARK: - Search
    func searchFeatures(_ query: String) {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            searchResults = []
            isSearching = false
            return
        }
        
        isSearching = true
        let lowercaseQuery = query.lowercased()
        
        searchResults = navigationFeatures.filter { feature in
            feature.title.lowercased().contains(lowercaseQuery) ||
            feature.description.lowercased().contains(lowercaseQuery) ||
            feature.keywords.contains { $0.lowercased().contains(lowercaseQuery) }
        }.sorted { feature1, feature2 in
            // Prioritize exact title matches
            let title1Match = feature1.title.lowercased().hasPrefix(lowercaseQuery)
            let title2Match = feature2.title.lowercased().hasPrefix(lowercaseQuery)
            
            if title1Match && !title2Match { return true }
            if !title1Match && title2Match { return false }
            
            // Then by usage frequency
            let usage1 = featureUsageStats[feature1.id]?.usageCount ?? 0
            let usage2 = featureUsageStats[feature2.id]?.usageCount ?? 0
            
            return usage1 > usage2
        }
        
        // Delay to simulate search processing
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.isSearching = false
        }
    }
    
    // MARK: - Tours Management
    func startTour(_ tourId: String) {
        guard let tour = availableTours.first(where: { $0.id == tourId }) else {
            logger.warning("Tour not found: \(tourId)")
            return
        }
        
        logger.info("Starting tour: \(tour.title)")
        // Tour implementation would trigger the tour UI
        // This is a placeholder for the actual tour execution
    }
    
    func completeTour(_ tourId: String) {
        if let index = availableTours.firstIndex(where: { $0.id == tourId }) {
            availableTours[index] = GuidedTour(
                id: availableTours[index].id,
                title: availableTours[index].title,
                description: availableTours[index].description,
                category: availableTours[index].category,
                estimatedDuration: availableTours[index].estimatedDuration,
                prerequisites: availableTours[index].prerequisites,
                steps: availableTours[index].steps,
                isCompleted: true
            )
            
            saveCompletedTours()
            logger.info("Tour completed: \(tourId)")
        }
    }
    
    // MARK: - Breadcrumbs
    func updateBreadcrumbs(_ breadcrumbs: [NavigationBreadcrumb]) {
        currentBreadcrumbs = breadcrumbs
    }
    
    func addBreadcrumb(_ breadcrumb: NavigationBreadcrumb) {
        currentBreadcrumbs.append(breadcrumb)
    }
    
    func clearBreadcrumbs() {
        currentBreadcrumbs.removeAll()
    }
    
    // MARK: - Navigation Actions
    func executeNavigationAction(_ action: NavigationAction, appState: AppState) {
        switch action {
        case .showView(let viewName):
            handleShowView(viewName, appState: appState)
        case .openWindow(let windowId):
            handleOpenWindow(windowId, appState: appState)
        case .executeCommand(let command):
            handleExecuteCommand(command, appState: appState)
        case .showSettings:
            appState.showSettings = true
        case .startTour(let tourId):
            startTour(tourId)
        case .custom(let customAction):
            handleCustomAction(customAction, appState: appState)
        }
    }
    
    private func handleShowView(_ viewName: String, appState: AppState) {
        switch viewName {
        case "chat":
            appState.selectedSidebarItem = .chat
        case "dashboard":
            appState.selectedSidebarItem = .objectives
        case "knowledge_graph":
            appState.selectedSidebarItem = .knowledge
        case "performance_analytics":
            appState.selectedSidebarItem = .analytics
        case "workflows":
            appState.selectedSidebarItem = .orchestration
        case "debug_console":
            appState.showDebugPanel = true
        case "voice":
            appState.selectedSidebarItem = .claude
        default:
            logger.warning("Unknown view: \(viewName)")
        }
    }
    
    private func handleOpenWindow(_ windowId: String, appState: AppState) {
        switch windowId {
        case "agent-activity":
            appState.openAgentActivityWindow()
        case "mlx-finetuning":
            appState.openMLXWindow()
        case "vision-processing":
            appState.openVisionWindow()
        case "system-monitor":
            appState.openSystemMonitorWindow()
        case "ab-mcts":
            appState.openABMCTSWindow()
        case "malt-swarm":
            appState.openMALTSwarmWindow()
        default:
            logger.warning("Unknown window: \(windowId)")
        }
    }
    
    private func handleExecuteCommand(_ command: String, appState: AppState) {
        logger.info("Executing command: \(command)")
        // Implement command execution logic here
    }
    
    private func handleCustomAction(_ action: String, appState: AppState) {
        logger.info("Executing custom action: \(action)")
        // Implement custom action logic here
    }
    
    // MARK: - Data Persistence
    private func loadPersistedData() {
        loadFeatureUsageStats()
        loadNavigationPreferences()
        loadRecentFeatures()
        setupTours()
    }
    
    private func loadFeatureUsageStats() {
        if let data = userDefaults.data(forKey: UserDefaultsKeys.featureUsage),
           let stats = try? JSONDecoder().decode([String: FeatureUsage].self, from: data) {
            featureUsageStats = stats
        }
    }
    
    private func saveFeatureUsageStats() {
        if let data = try? JSONEncoder().encode(featureUsageStats) {
            userDefaults.set(data, forKey: UserDefaultsKeys.featureUsage)
        }
    }
    
    private func loadNavigationPreferences() {
        if let data = userDefaults.data(forKey: UserDefaultsKeys.navigationPreferences),
           let prefs = try? JSONDecoder().decode(NavigationPreferences.self, from: data) {
            preferences = prefs
        }
    }
    
    func saveNavigationPreferences() {
        if let data = try? JSONEncoder().encode(preferences) {
            userDefaults.set(data, forKey: UserDefaultsKeys.navigationPreferences)
        }
    }
    
    private func loadRecentFeatures() {
        if let data = userDefaults.data(forKey: UserDefaultsKeys.recentFeatures),
           let featureIds = try? JSONDecoder().decode([String].self, from: data) {
            recentlyUsedFeatures = featureIds.compactMap { id in
                navigationFeatures.first { $0.id == id }
            }
        }
    }
    
    private func saveRecentFeatures() {
        let featureIds = recentlyUsedFeatures.map { $0.id }
        if let data = try? JSONEncoder().encode(featureIds) {
            userDefaults.set(data, forKey: UserDefaultsKeys.recentFeatures)
        }
    }
    
    private func saveCompletedTours() {
        let completedTourIds = availableTours.filter { $0.isCompleted }.map { $0.id }
        if let data = try? JSONEncoder().encode(completedTourIds) {
            userDefaults.set(data, forKey: UserDefaultsKeys.completedTours)
        }
    }
    
    private func setupTours() {
        // Define available tours
        availableTours = [
            GuidedTour(
                id: "getting_started",
                title: "Getting Started with Universal AI Tools",
                description: "Learn the basics of the app and its core features",
                category: .core,
                estimatedDuration: 300, // 5 minutes
                steps: [
                    TourStep(
                        id: "welcome",
                        title: "Welcome to Universal AI Tools",
                        description: "This tour will guide you through the main features of the app.",
                        targetElement: nil,
                        position: .center,
                        actions: [.highlight]
                    ),
                    TourStep(
                        id: "sidebar",
                        title: "Navigation Sidebar",
                        description: "Use the sidebar to navigate between different features and tools.",
                        targetElement: "sidebar",
                        position: .right,
                        actions: [.highlight]
                    ),
                    TourStep(
                        id: "chat",
                        title: "Chat Interface",
                        description: "Start conversations with AI models using the chat interface.",
                        targetElement: "chat-button",
                        position: .bottom,
                        actions: [.highlight, .click]
                    )
                ]
            ),
            
            GuidedTour(
                id: "advanced_features",
                title: "Advanced AI Features",
                description: "Explore advanced features like agent orchestration and analytics",
                category: .advanced,
                estimatedDuration: 600, // 10 minutes
                prerequisites: ["getting_started"],
                steps: [
                    TourStep(
                        id: "knowledge_graph",
                        title: "3D Knowledge Graph",
                        description: "Visualize and explore knowledge relationships in 3D space.",
                        targetElement: "knowledge-graph-button",
                        position: .bottom,
                        actions: [.highlight, .navigate]
                    ),
                    TourStep(
                        id: "agent_orchestration",
                        title: "Agent Orchestration",
                        description: "Coordinate multiple AI agents for complex tasks.",
                        targetElement: "orchestration-button",
                        position: .bottom,
                        actions: [.highlight, .navigate]
                    )
                ]
            )
        ]
        
        // Load completed tours
        if let data = userDefaults.data(forKey: UserDefaultsKeys.completedTours),
           let completedIds = try? JSONDecoder().decode([String].self, from: data) {
            
            for (index, tour) in availableTours.enumerated() {
                if completedIds.contains(tour.id) {
                    availableTours[index] = GuidedTour(
                        id: tour.id,
                        title: tour.title,
                        description: tour.description,
                        category: tour.category,
                        estimatedDuration: tour.estimatedDuration,
                        prerequisites: tour.prerequisites,
                        steps: tour.steps,
                        isCompleted: true
                    )
                }
            }
        }
    }
    
    private func setupBindings() {
        // React to preference changes
        $preferences
            .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
            .sink { [weak self] _ in
                self?.saveNavigationPreferences()
            }
            .store(in: &cancellables)
    }
}