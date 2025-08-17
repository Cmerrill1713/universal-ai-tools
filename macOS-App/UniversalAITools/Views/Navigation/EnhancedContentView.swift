import SwiftUI
import Combine

/// Enhanced version of ContentView with improved navigation and feature discovery
struct EnhancedContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.openWindow) private var openWindow
    
    @StateObject private var navigationService = EnhancedNavigationService()
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var showCommandPalette = false
    
    // Keyboard shortcuts
    @State private var keyboardMonitor: AnyCancellable?
    
    private var sidebarSelectionBinding: Binding<SidebarItem?> {
        Binding<SidebarItem?>(
            get: { appState.selectedSidebarItem },
            set: { newValue in
                if let newValue = newValue {
                    appState.selectedSidebarItem = newValue
                    navigationService.recordFeatureUsage(newValue.rawValue)
                }
            }
        )
    }
    
    var body: some View {
        ZStack {
            // Main content with enhanced navigation
            NavigationSplitView(columnVisibility: $columnVisibility) {
                // Enhanced sidebar
                EnhancedNavigationSidebar()
                    .environmentObject(appState)
                    .navigationSplitViewColumnWidth(min: 260, ideal: 300, max: 400)
            } detail: {
                VStack(spacing: 0) {
                    // Contextual navigation bar
                    ContextualNavigationBar(navigationService: navigationService)
                        .environmentObject(appState)
                    
                    // Main content area
                    mainContentView
                        .navigationAware(
                            navigationService: navigationService,
                            appState: appState,
                            featureId: appState.selectedSidebarItem?.rawValue ?? "unknown"
                        )
                }
            }
            .navigationSplitViewStyle(.balanced)
            
            // Command palette overlay
            if showCommandPalette {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        showCommandPalette = false
                    }
                
                CommandPaletteView(navigationService: navigationService, appState: appState)
                    .frame(maxWidth: 600, maxHeight: 400)
                    .transition(.asymmetric(
                        insertion: .scale(scale: 0.95).combined(with: .opacity),
                        removal: .scale(scale: 0.95).combined(with: .opacity)
                    ))
            }
        }
        .onAppear {
            setupEnhancedNavigation()
        }
        .onChange(of: appState.selectedSidebarItem) { newItem in
            updateNavigationContext(for: newItem)
            updateColumnVisibility(for: newItem)
        }
        .onReceive(keyboardShortcuts) { shortcut in
            handleKeyboardShortcut(shortcut)
        }
        .overlay(
            // Onboarding overlay
            Group {
                if appState.showOnboarding {
                    OnboardingFlow {
                        appState.completeOnboarding()
                    }
                    .zIndex(1000)
                }
            }
        )
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: showCommandPalette)
    }
    
    // MARK: - Main Content View
    @ViewBuilder
    private var mainContentView: some View {
        switch appState.selectedSidebarItem {
        case .chat:
            ChatInterfaceView()
                .environmentObject(appState)
                .environmentObject(apiService)
        case .analytics:
            PerformanceAnalyticsView()
                .environmentObject(appState)
        case .orchestration:
            AgentOrchestrationView()
                .environmentObject(appState)
        case .knowledge:
            KnowledgeGraphView()
                .environmentObject(appState)
        case .tools:
            ToolsView()
                .environmentObject(appState)
        case .claude:
            ClaudeAssistantView()
                .environmentObject(appState)
        case .objectives:
            ObjectivesView()
                .environmentObject(appState)
        case .none:
            WelcomeView()
                .environmentObject(appState)
        }
    }
    
    // MARK: - Setup Methods
    private func setupEnhancedNavigation() {
        // Store navigation service reference
        appState.enhancedNavigationService = navigationService
        
        // Set up window opener
        appState.windowOpener = { windowId, value in
            openWindow(id: windowId, value: value)
        }
        
        // Initialize navigation context
        updateNavigationContext(for: appState.selectedSidebarItem)
        
        // Setup keyboard monitoring
        setupKeyboardMonitoring()
    }
    
    private func updateNavigationContext(for sidebarItem: SidebarItem?) {
        // Update breadcrumbs
        let breadcrumbs = NavigationIntegration.generateBreadcrumbs(for: appState)
        navigationService.updateBreadcrumbs(breadcrumbs)
        
        // Generate contextual suggestions
        let suggestions = NavigationIntegration.generateContextualSuggestions(
            for: appState,
            navigationService: navigationService
        )
        
        // Update suggestions with animation
        withAnimation(.easeInOut(duration: 0.3)) {
            navigationService.smartSuggestions = suggestions
        }
        
        // Track navigation analytics
        if let item = sidebarItem,
           let feature = NavigationIntegration.mapSidebarItemToFeature(item) {
            NavigationIntegration.trackNavigationEvent(
                event: .featureSelected,
                feature: feature,
                context: ["source": "sidebar_selection"]
            )
        }
    }
    
    private func updateColumnVisibility(for sidebarItem: SidebarItem?) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            if appState.sidebarVisible {
                columnVisibility = .all
            } else {
                columnVisibility = .detailOnly
            }
        }
    }
    
    // MARK: - Keyboard Shortcuts
    private func setupKeyboardMonitoring() {
        // This would be implemented with proper keyboard event monitoring
        // For now, we'll use a simple implementation
    }
    
    private var keyboardShortcuts: PassthroughSubject<KeyboardShortcut, Never> {
        PassthroughSubject()
    }
    
    private func handleKeyboardShortcut(_ shortcut: KeyboardShortcut) {
        switch shortcut {
        case KeyboardShortcut("k", modifiers: .command):
            showCommandPalette.toggle()
            NavigationIntegration.trackNavigationEvent(
                event: .commandPaletteUsed,
                context: ["trigger": "keyboard_shortcut"]
            )
        case KeyboardShortcut("f", modifiers: .command):
            appState.showGlobalSearch = true
        case KeyboardShortcut("n", modifiers: .command):
            let newChat = appState.createNewChat()
            navigationService.recordFeatureUsage("chat")
        case KeyboardShortcut("s", modifiers: [.command, .option]):
            appState.sidebarVisible.toggle()
        case KeyboardShortcut("d", modifiers: .command):
            appState.selectedSidebarItem = .objectives
        default:
            break
        }
    }
}

// MARK: - Placeholder Views (these would be replaced with actual implementations)
struct AgentOrchestrationView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack {
            Text("Agent Orchestration")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("Coordinate and manage multiple AI agents")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.primaryBackground)
    }
}

struct KnowledgeGraphView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack {
            Text("3D Knowledge Graph")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("Interactive visualization of knowledge relationships")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.primaryBackground)
    }
}

struct ClaudeAssistantView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack {
            Text("Claude AI Assistant")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("Advanced AI assistant capabilities")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.primaryBackground)
    }
}

struct ObjectivesView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack {
            Text("Objectives & Goals")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("Manage your objectives and track progress")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.primaryBackground)
    }
}

// MARK: - Preview Support
#if DEBUG
struct EnhancedContentView_Previews: PreviewProvider {
    static var previews: some View {
        EnhancedContentView()
            .environmentObject(AppState())
            .environmentObject(APIService())
    }
}
#endif