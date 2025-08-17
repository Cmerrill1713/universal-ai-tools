import SwiftUI
import Foundation

/// Integration layer for enhanced navigation with existing app architecture
struct NavigationIntegration {
    
    /// Updates AppState to include enhanced navigation service
    static func setupEnhancedNavigation(appState: AppState) {
        // This would be called during app initialization
        // The navigation service is already integrated as a StateObject in the sidebar
    }
    
    /// Generates breadcrumbs based on current app state
    static func generateBreadcrumbs(for appState: AppState) -> [NavigationBreadcrumb] {
        var breadcrumbs: [NavigationBreadcrumb] = []
        
        // Root breadcrumb
        breadcrumbs.append(NavigationBreadcrumb(
            id: "root",
            title: "Universal AI Tools",
            icon: "house.fill"
        ))
        
        // Current section breadcrumb
        if let sidebarItem = appState.selectedSidebarItem {
            breadcrumbs.append(NavigationBreadcrumb(
                id: sidebarItem.rawValue,
                title: sidebarItem.title,
                icon: sidebarItem.icon,
                action: {
                    appState.selectedSidebarItem = sidebarItem
                }
            ))
            
            // Sub-section breadcrumbs based on current view
            switch sidebarItem {
            case .chat:
                if let chat = appState.currentChat {
                    breadcrumbs.append(NavigationBreadcrumb(
                        id: "chat_\(chat.id)",
                        title: chat.title.isEmpty ? "New Chat" : chat.title,
                        icon: "message.fill"
                    ))
                }
            case .analytics:
                breadcrumbs.append(NavigationBreadcrumb(
                    id: "analytics_dashboard",
                    title: "Dashboard",
                    icon: "chart.bar.fill"
                ))
            case .orchestration:
                breadcrumbs.append(NavigationBreadcrumb(
                    id: "agent_orchestration",
                    title: "Orchestration",
                    icon: "network"
                ))
            case .knowledge:
                breadcrumbs.append(NavigationBreadcrumb(
                    id: "knowledge_graph",
                    title: "3D Graph",
                    icon: "point.3.connected.trianglepath.dotted"
                ))
            default:
                break
            }
        }
        
        return breadcrumbs
    }
    
    /// Maps existing SidebarItem to new NavigationFeature
    static func mapSidebarItemToFeature(_ item: SidebarItem) -> NavigationFeature? {
        switch item {
        case .chat:
            return NavigationFeature(
                id: "chat",
                title: "Chat Interface",
                description: "AI-powered conversation interface",
                icon: "text.bubble.fill",
                category: .core,
                level: .core,
                keywords: ["chat", "conversation", "ai"],
                shortcutKey: "⌘N",
                action: .showView("chat")
            )
        case .analytics:
            return NavigationFeature(
                id: "analytics",
                title: "Performance Analytics",
                description: "Real-time performance metrics and insights",
                icon: "chart.bar.doc.horizontal.fill",
                category: .analytics,
                level: .advanced,
                keywords: ["analytics", "performance", "metrics"],
                action: .showView("analytics")
            )
        case .orchestration:
            return NavigationFeature(
                id: "orchestration",
                title: "Agent Orchestration",
                description: "Coordinate multiple AI agents",
                icon: "network",
                category: .agents,
                level: .advanced,
                keywords: ["orchestration", "agents", "coordination"],
                action: .showView("orchestration")
            )
        case .knowledge:
            return NavigationFeature(
                id: "knowledge",
                title: "Knowledge Graph",
                description: "Interactive knowledge visualization",
                icon: "point.3.connected.trianglepath.dotted",
                category: .knowledge,
                level: .advanced,
                keywords: ["knowledge", "graph", "visualization"],
                action: .showView("knowledge")
            )
        case .tools:
            return NavigationFeature(
                id: "tools",
                title: "Tools & Utilities",
                description: "Collection of AI tools and utilities",
                icon: "wrench.and.screwdriver.fill",
                category: .tools,
                level: .core,
                keywords: ["tools", "utilities", "helpers"],
                action: .showView("tools")
            )
        case .claude:
            return NavigationFeature(
                id: "claude",
                title: "Claude AI Assistant",
                description: "Advanced AI assistant capabilities",
                icon: "brain.head.profile",
                category: .ai,
                level: .core,
                keywords: ["claude", "ai", "assistant"],
                action: .showView("claude")
            )
        case .objectives:
            return NavigationFeature(
                id: "objectives",
                title: "Objectives & Goals",
                description: "Manage your objectives and track progress",
                icon: "target",
                category: .core,
                level: .core,
                keywords: ["objectives", "goals", "tasks"],
                action: .showView("objectives")
            )
        }
    }
    
    /// Generates smart suggestions based on current context
    static func generateContextualSuggestions(
        for appState: AppState,
        navigationService: EnhancedNavigationService
    ) -> [SmartSuggestion] {
        var suggestions: [SmartSuggestion] = []
        
        // Current view-based suggestions
        if let currentItem = appState.selectedSidebarItem {
            switch currentItem {
            case .chat:
                // Suggest related features for chat users
                if let voiceFeature = navigationService.navigationFeatures.first(where: { $0.id == "voice_interface" }) {
                    suggestions.append(SmartSuggestion(
                        id: "voice_from_chat",
                        feature: voiceFeature,
                        reason: .relatedToCurrentView,
                        confidence: 0.8,
                        contextualHint: "Try voice conversations"
                    ))
                }
                
                if let agentFeature = navigationService.navigationFeatures.first(where: { $0.id == "agent_orchestration" }) {
                    suggestions.append(SmartSuggestion(
                        id: "agents_from_chat",
                        feature: agentFeature,
                        reason: .workflowOptimization,
                        confidence: 0.7,
                        contextualHint: "Use multiple agents for complex tasks"
                    ))
                }
                
            case .analytics:
                // Suggest monitoring and optimization features
                if let monitoringFeature = navigationService.navigationFeatures.first(where: { $0.id == "system_monitoring" }) {
                    suggestions.append(SmartSuggestion(
                        id: "monitoring_from_analytics",
                        feature: monitoringFeature,
                        reason: .relatedToCurrentView,
                        confidence: 0.9,
                        contextualHint: "Monitor system performance"
                    ))
                }
                
            case .knowledge:
                // Suggest analytics and visualization features
                if let contextFlowFeature = navigationService.navigationFeatures.first(where: { $0.id == "context_flow" }) {
                    suggestions.append(SmartSuggestion(
                        id: "context_flow_from_knowledge",
                        feature: contextFlowFeature,
                        reason: .relatedToCurrentView,
                        confidence: 0.8,
                        contextualHint: "Visualize context relationships"
                    ))
                }
                
            default:
                break
            }
        }
        
        // Time-based suggestions
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: Date())
        
        if hour >= 9 && hour <= 17 { // Work hours
            if let debugFeature = navigationService.navigationFeatures.first(where: { $0.id == "debug_console" }) {
                suggestions.append(SmartSuggestion(
                    id: "debug_work_hours",
                    feature: debugFeature,
                    reason: .timeBasedPattern,
                    confidence: 0.6,
                    contextualHint: "Useful for development tasks"
                ))
            }
        }
        
        // Usage pattern-based suggestions
        let frequentFeatures = navigationService.featureUsageStats.values
            .filter { $0.usageCount >= 2 }
            .sorted { $0.lastUsed > $1.lastUsed }
            .prefix(2)
        
        for usage in frequentFeatures {
            if let feature = navigationService.navigationFeatures.first(where: { $0.id == usage.featureId }) {
                suggestions.append(SmartSuggestion(
                    id: "frequent_\(feature.id)",
                    feature: feature,
                    reason: .frequentlyUsed,
                    confidence: min(Double(usage.usageCount) / 5.0, 1.0),
                    contextualHint: "You use this often"
                ))
            }
        }
        
        return suggestions.sorted { $0.confidence > $1.confidence }
    }
    
    /// Updates navigation service with current app context
    static func updateNavigationContext(
        navigationService: EnhancedNavigationService,
        appState: AppState
    ) {
        // Update breadcrumbs
        let breadcrumbs = generateBreadcrumbs(for: appState)
        navigationService.updateBreadcrumbs(breadcrumbs)
        
        // Generate and update smart suggestions
        let suggestions = generateContextualSuggestions(for: appState, navigationService: navigationService)
        navigationService.smartSuggestions = suggestions
    }
    
    /// Keyboard shortcut handlers for enhanced navigation
    static func setupKeyboardShortcuts() -> [KeyboardShortcut] {
        return [
            KeyboardShortcut("k", modifiers: .command), // Command palette
            KeyboardShortcut("f", modifiers: .command), // Global search
            KeyboardShortcut("n", modifiers: .command), // New chat
            KeyboardShortcut("s", modifiers: [.command, .option]), // Toggle sidebar
            KeyboardShortcut("d", modifiers: .command), // Dashboard
            KeyboardShortcut("v", modifiers: [.command, .shift]), // Voice interface
            KeyboardShortcut("1", modifiers: [.command, .option]), // Agent activity
            KeyboardShortcut("2", modifiers: [.command, .option]), // MLX fine-tuning
            KeyboardShortcut("3", modifiers: [.command, .option]), // Vision processing
        ]
    }
    
    /// Feature flags for progressive rollout
    struct FeatureFlags {
        static let enhancedNavigationEnabled = true
        static let smartSuggestionsEnabled = true
        static let guidedToursEnabled = true
        static let commandPaletteEnabled = true
        static let contextualHelpEnabled = true
        static let workflowTrackingEnabled = false // Future feature
        static let aiNavigationAssistantEnabled = false // Future feature
    }
    
    /// Migration helper for existing users
    static func migrateExistingUserData() {
        let userDefaults = UserDefaults.standard
        
        // Migrate existing preferences
        if userDefaults.object(forKey: "sidebarVisible") != nil {
            let sidebarVisible = userDefaults.bool(forKey: "sidebarVisible")
            var preferences = NavigationPreferences()
            preferences.compactMode = !sidebarVisible
            
            if let data = try? JSONEncoder().encode(preferences) {
                userDefaults.set(data, forKey: "navigation_preferences")
            }
        }
        
        // Migrate chat history to feature usage
        if let chatData = userDefaults.data(forKey: "chats"),
           let chats = try? JSONDecoder().decode([Chat].self, from: chatData) {
            
            var featureUsage: [String: FeatureUsage] = [:]
            let chatUsage = FeatureUsage(featureId: "chat")
            // Set usage based on chat count
            featureUsage["chat"] = chatUsage
            
            if let data = try? JSONEncoder().encode(featureUsage) {
                userDefaults.set(data, forKey: "feature_usage_stats")
            }
        }
    }
    
    /// Analytics tracking for navigation usage
    static func trackNavigationEvent(
        event: NavigationEvent,
        feature: NavigationFeature? = nil,
        context: [String: Any] = [:]
    ) {
        // This would integrate with the existing analytics system
        // For now, we'll use the logging system
        let eventData: [String: Any] = [
            "event": event.rawValue,
            "feature_id": feature?.id ?? "unknown",
            "timestamp": Date().timeIntervalSince1970,
            "context": context
        ]
        
        print("Navigation Analytics: \(eventData)")
    }
    
    enum NavigationEvent: String {
        case featureSelected = "feature_selected"
        case searchPerformed = "search_performed"
        case tourStarted = "tour_started"
        case tourCompleted = "tour_completed"
        case suggestionAccepted = "suggestion_accepted"
        case commandPaletteUsed = "command_palette_used"
        case shortcutUsed = "shortcut_used"
    }
}

// MARK: - Enhanced Navigation Extensions for AppState
extension AppState {
    
    /// Updates navigation context when app state changes
    func updateNavigationContext(navigationService: EnhancedNavigationService) {
        NavigationIntegration.updateNavigationContext(
            navigationService: navigationService,
            appState: self
        )
    }
    
    /// Executes a navigation action with proper state management
    func executeNavigationAction(_ action: NavigationAction, navigationService: EnhancedNavigationService) {
        switch action {
        case .showView(let viewName):
            handleShowView(viewName)
        case .openWindow(let windowId):
            handleOpenWindow(windowId)
        case .executeCommand(let command):
            handleExecuteCommand(command)
        case .showSettings:
            showSettings = true
        case .startTour(let tourId):
            navigationService.startTour(tourId)
        case .custom(let customAction):
            handleCustomAction(customAction, navigationService: navigationService)
        }
        
        // Update navigation context after action
        updateNavigationContext(navigationService: navigationService)
    }
    
    private func handleShowView(_ viewName: String) {
        switch viewName {
        case "chat":
            selectedSidebarItem = .chat
        case "analytics":
            selectedSidebarItem = .analytics
        case "orchestration":
            selectedSidebarItem = .orchestration
        case "knowledge":
            selectedSidebarItem = .knowledge
        case "tools":
            selectedSidebarItem = .tools
        case "claude":
            selectedSidebarItem = .claude
        case "objectives":
            selectedSidebarItem = .objectives
        default:
            logger.warning("Unknown view: \(viewName)")
        }
    }
    
    private func handleOpenWindow(_ windowId: String) {
        switch windowId {
        case "agent-activity":
            openAgentActivityWindow()
        case "mlx-finetuning":
            openMLXWindow()
        case "vision-processing":
            openVisionWindow()
        case "system-monitor":
            openSystemMonitorWindow()
        case "ab-mcts":
            openABMCTSWindow()
        case "malt-swarm":
            openMALTSwarmWindow()
        default:
            logger.warning("Unknown window: \(windowId)")
        }
    }
    
    private func handleExecuteCommand(_ command: String) {
        logger.info("Executing command: \(command)")
        // Implement command execution logic
    }
    
    private func handleCustomAction(_ action: String, navigationService: EnhancedNavigationService) {
        switch action {
        case "global_search":
            showGlobalSearch = true
        case "command_palette":
            // Command palette would be shown by the parent view
            break
        default:
            logger.info("Executing custom action: \(action)")
        }
    }
}

// MARK: - Navigation-aware View Modifier
struct NavigationAwareModifier: ViewModifier {
    let navigationService: EnhancedNavigationService
    let appState: AppState
    let featureId: String
    
    func body(content: Content) -> some View {
        content
            .onAppear {
                // Record feature usage when view appears
                navigationService.recordFeatureUsage(featureId)
                
                // Update navigation context
                appState.updateNavigationContext(navigationService: navigationService)
                
                // Track analytics
                NavigationIntegration.trackNavigationEvent(
                    event: .featureSelected,
                    feature: navigationService.navigationFeatures.first { $0.id == featureId },
                    context: ["source": "view_appear"]
                )
            }
    }
}

extension View {
    func navigationAware(
        navigationService: EnhancedNavigationService,
        appState: AppState,
        featureId: String
    ) -> some View {
        self.modifier(NavigationAwareModifier(
            navigationService: navigationService,
            appState: appState,
            featureId: featureId
        ))
    }
}