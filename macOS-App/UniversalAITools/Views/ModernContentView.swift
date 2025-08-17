import SwiftUI
import Pow
import Vortex

/// Modern content view showcasing the complete UI transformation
/// Integrates all new design system components for a polished Arc-browser-level experience
struct ModernContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.openWindow) private var openWindow
    @Environment(\.colorScheme) private var colorScheme
    
    @StateObject private var accessibilityManager = AccessibilityEnhanced.shared
    @StateObject private var animationManager = PerformanceOptimizedAnimations.shared
    
    @State private var selectedTab = 0
    @State private var showParticles = true
    @State private var performanceMetrics = AdvancedParticleSystem.PerformanceParticles.PerformanceMetrics(
        cpuUsage: 0.45,
        memoryUsage: 0.32,
        networkActivity: 0.78,
        alertLevel: .normal
    )
    
    private let tabs = [
        FluidNavigationSystem.FluidTabBar.TabItem(id: 0, title: "Dashboard", icon: "square.grid.2x2.fill"),
        FluidNavigationSystem.FluidTabBar.TabItem(id: 1, title: "Chat", icon: "message.fill", badge: 3),
        FluidNavigationSystem.FluidTabBar.TabItem(id: 2, title: "Analytics", icon: "chart.bar.fill"),
        FluidNavigationSystem.FluidTabBar.TabItem(id: 3, title: "Tools", icon: "wrench.and.screwdriver.fill"),
        FluidNavigationSystem.FluidTabBar.TabItem(id: 4, title: "Settings", icon: "gear.circle.fill")
    ]
    
    var body: some View {
        ResponsiveLayoutSystem.ResponsiveContainer { breakpoint, size in
            VStack(spacing: 0) {
                // Modern header with performance indicators
                modernHeader(breakpoint: breakpoint)
                
                // Main content area with fluid navigation
                modernMainContent(breakpoint: breakpoint, size: size)
                
                // Modern tab bar
                modernTabBar(breakpoint: breakpoint)
            }
            .background(modernBackground)
            .overlay(modernOverlays)
        }
        .environmentObject(accessibilityManager)
        .environmentObject(animationManager)
        .task {
            await loadInitialData()
            startPerformanceMonitoring()
        }
    }
    
    // MARK: - Modern Header
    @ViewBuilder
    private func modernHeader(breakpoint: ResponsiveLayoutSystem.Breakpoint) -> some View {
        HStack(spacing: ResponsiveLayoutSystem.ResponsiveSpacing.spacing(for: breakpoint)) {
            // App logo with particle effects
            ZStack {
                Circle()
                    .fill(.ultraThinMaterial)
                    .frame(width: 44, height: 44)
                    .overlay(
                        Circle()
                            .stroke(.white.opacity(0.2), lineWidth: 1)
                    )
                
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.blue)
                    .glow(color: .blue, radius: 4)
                
                // Subtle particle effects around logo
                if showParticles {
                    AdvancedParticleSystem.CelebrationParticles(
                        isTriggered: true,
                        color: .blue.opacity(0.6),
                        intensity: 0.3
                    )
                    .frame(width: 60, height: 60)
                    .allowsHitTesting(false)
                }
            }
            .pulse(minScale: 0.98, maxScale: 1.02, duration: 2.0)
            
            if breakpoint != .compact {
                VStack(alignment: .leading, spacing: 2) {
                    ResponsiveLayoutSystem.ResponsiveText(
                        "Universal AI Tools",
                        style: .title
                    )
                    .foregroundColor(.primary)
                    
                    ResponsiveLayoutSystem.ResponsiveText(
                        "Intelligent AI Workbench",
                        style: .caption
                    )
                    .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Performance indicators
            modernPerformanceIndicators(breakpoint: breakpoint)
            
            // Action buttons
            modernHeaderActions(breakpoint: breakpoint)
        }
        .padding(ResponsiveLayoutSystem.ResponsiveSpacing.padding(for: breakpoint))
        .background(.ultraThinMaterial)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(.white.opacity(0.1)),
            alignment: .bottom
        )
    }
    
    @ViewBuilder
    private func modernPerformanceIndicators(breakpoint: ResponsiveLayoutSystem.Breakpoint) -> some View {
        if breakpoint != .compact {
            HStack(spacing: 12) {
                // Connection status
                EnhancedUIComponents.AnimatedConnectionStatus(
                    status: appState.backendConnected ? .connected : .disconnected
                )
                
                // Performance metrics
                AdvancedParticleSystem.PerformanceParticles(
                    metrics: performanceMetrics,
                    isMonitoring: true
                )
                .frame(width: 120, height: 40)
            }
            .gpuAccelerated()
        }
    }
    
    @ViewBuilder
    private func modernHeaderActions(breakpoint: ResponsiveLayoutSystem.Breakpoint) -> some View {
        HStack(spacing: 8) {
            // Feature tour button
            MicroInteractionSystem.InteractiveButton(
                "",
                icon: "questionmark.circle",
                style: .ghost,
                hapticStyle: .light
            ) {
                appState.showOnboarding = true
            }
            
            // Agent activity button
            MicroInteractionSystem.InteractiveButton(
                breakpoint == .compact ? "" : "Agents",
                icon: "brain.head.profile",
                style: .primary,
                hapticStyle: .medium
            ) {
                openWindow(id: "agent-activity", value: "main")
            }
        }
    }
    
    // MARK: - Main Content
    @ViewBuilder
    private func modernMainContent(breakpoint: ResponsiveLayoutSystem.Breakpoint, size: CGSize) -> some View {
        ZStack {
            // Page content with smooth transitions
            FluidNavigationSystem.PageTransition(
                direction: .right,
                isActive: true
            ) {
                modernContentForTab(selectedTab, breakpoint: breakpoint, size: size)
            }
            
            // Loading overlay
            if appState.isLoading {
                modernLoadingOverlay
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    @ViewBuilder
    private func modernContentForTab(_ tab: Int, breakpoint: ResponsiveLayoutSystem.Breakpoint, size: CGSize) -> some View {
        switch tab {
        case 0:
            modernDashboardView(breakpoint: breakpoint, size: size)
        case 1:
            modernChatView(breakpoint: breakpoint)
        case 2:
            modernAnalyticsView(breakpoint: breakpoint)
        case 3:
            modernToolsView(breakpoint: breakpoint)
        case 4:
            modernSettingsView(breakpoint: breakpoint)
        default:
            modernDashboardView(breakpoint: breakpoint, size: size)
        }
    }
    
    // MARK: - Dashboard View
    @ViewBuilder
    private func modernDashboardView(breakpoint: ResponsiveLayoutSystem.Breakpoint, size: CGSize) -> some View {
        ScrollView {
            ResponsiveLayoutSystem.AdaptiveGrid(
                columns: Array(repeating: GridItem(.flexible()), count: 2),
                spacing: 16
            ) {
                // Data flow visualization card
                ModernCard(hasGlow: true, glowColor: .blue) {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            ResponsiveLayoutSystem.ResponsiveText(
                                "Data Flow",
                                style: .headline
                            )
                            Spacer()
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .foregroundColor(.blue)
                        }
                        
                        AdvancedParticleSystem.DataFlowVisualization(
                            dataPoints: [
                                .init(position: CGPoint(x: 0.2, y: 0.3), intensity: 0.8, category: .input),
                                .init(position: CGPoint(x: 0.5, y: 0.5), intensity: 1.0, category: .processing),
                                .init(position: CGPoint(x: 0.8, y: 0.3), intensity: 0.6, category: .output),
                                .init(position: CGPoint(x: 0.5, y: 0.8), intensity: 0.4, category: .storage)
                            ],
                            isActive: true
                        )
                        .frame(height: 200)
                        .background(.black.opacity(0.05))
                        .cornerRadius(12)
                    }
                }
                
                // System metrics card
                ModernCard {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            ResponsiveLayoutSystem.ResponsiveText(
                                "System Health",
                                style: .headline
                            )
                            Spacer()
                            Image(systemName: "heart.fill")
                                .foregroundColor(.green)
                        }
                        
                        VStack(spacing: 12) {
                            ModernProgressIndicator(
                                progress: performanceMetrics.cpuUsage,
                                color: .blue,
                                showPercentage: true
                            )
                            
                            ModernProgressIndicator(
                                progress: performanceMetrics.memoryUsage,
                                color: .orange,
                                showPercentage: true
                            )
                            
                            ModernProgressIndicator(
                                progress: performanceMetrics.networkActivity,
                                color: .purple,
                                showPercentage: true
                            )
                        }
                    }
                }
                
                // Agent status card
                ModernCard {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            ResponsiveLayoutSystem.ResponsiveText(
                                "Active Agents",
                                style: .headline
                            )
                            Spacer()
                            Text("\(appState.availableAgents.count)")
                                .font(.title2.bold())
                                .foregroundColor(.blue)
                        }
                        
                        LazyVStack(spacing: 8) {
                            ForEach(appState.availableAgents.prefix(3), id: \.id) { agent in
                                HStack {
                                    Circle()
                                        .fill(.green)
                                        .frame(width: 8, height: 8)
                                        .pulse()
                                    
                                    Text(agent.name)
                                        .font(.caption)
                                    
                                    Spacer()
                                    
                                    Text("Active")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
                
                // Quick actions card
                ModernCard {
                    VStack(alignment: .leading, spacing: 16) {
                        ResponsiveLayoutSystem.ResponsiveText(
                            "Quick Actions",
                            style: .headline
                        )
                        
                        ResponsiveLayoutSystem.ResponsiveStack(axis: .adaptive, spacing: 8) {
                            ModernButton("New Chat", icon: "plus.message") {
                                selectedTab = 1
                            }
                            
                            ModernButton("Run Analysis", icon: "chart.bar", style: .secondary) {
                                selectedTab = 2
                            }
                        }
                    }
                }
            }
        }
        .responsivePadding()
    }
    
    // MARK: - Chat View
    @ViewBuilder
    private func modernChatView(breakpoint: ResponsiveLayoutSystem.Breakpoint) -> some View {
        VStack(spacing: 0) {
            ResponsiveLayoutSystem.ResponsiveText(
                "AI Chat Interface",
                style: .headline
            )
            .responsivePadding()
            
            Spacer()
            
            Text("Modern chat interface will be integrated here")
                .foregroundColor(.secondary)
            
            Spacer()
        }
    }
    
    // MARK: - Analytics View
    @ViewBuilder
    private func modernAnalyticsView(breakpoint: ResponsiveLayoutSystem.Breakpoint) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                ResponsiveLayoutSystem.ResponsiveText(
                    "Performance Analytics",
                    style: .headline
                )
                
                ModernCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Real-time Metrics")
                            .font(.title3.bold())
                        
                        AdvancedParticleSystem.PerformanceParticles(
                            metrics: performanceMetrics,
                            isMonitoring: true
                        )
                        .frame(height: 150)
                        .background(.black.opacity(0.05))
                        .cornerRadius(12)
                    }
                }
            }
        }
        .responsivePadding()
    }
    
    // MARK: - Tools View
    @ViewBuilder
    private func modernToolsView(breakpoint: ResponsiveLayoutSystem.Breakpoint) -> some View {
        ResponsiveLayoutSystem.ResponsiveCardGrid(cardMinWidth: 250) {
            ForEach(0..<6, id: \.self) { index in
                ModernCard {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "wrench.and.screwdriver")
                                .foregroundColor(.blue)
                            Text("Tool \(index + 1)")
                                .font(.headline)
                            Spacer()
                        }
                        
                        Text("Description of tool functionality and capabilities.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        ModernButton("Launch Tool", size: .small) {
                            print("Tool \(index + 1) launched")
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Settings View
    @ViewBuilder
    private func modernSettingsView(breakpoint: ResponsiveLayoutSystem.Breakpoint) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                ResponsiveLayoutSystem.ResponsiveText(
                    "Settings",
                    style: .headline
                )
                
                ModernCard {
                    VStack(spacing: 16) {
                        AccessibilityEnhanced.AccessibleToggle(
                            "Enable Animations",
                            isOn: $showParticles,
                            description: "Show particle effects and smooth animations"
                        )
                        
                        Divider()
                        
                        AccessibilityEnhanced.AccessibleToggle(
                            "High Performance Mode",
                            isOn: $animationManager.isHighPerformanceMode,
                            description: "Optimize for 120Hz displays"
                        )
                        
                        Divider()
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Accessibility")
                                .font(.headline)
                            
                            HStack {
                                Text("VoiceOver")
                                Spacer()
                                Text(accessibilityManager.isVoiceOverEnabled ? "Enabled" : "Disabled")
                                    .foregroundColor(.secondary)
                            }
                            
                            HStack {
                                Text("Reduce Motion")
                                Spacer()
                                Text(accessibilityManager.isReduceMotionEnabled ? "Enabled" : "Disabled")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .responsivePadding()
    }
    
    // MARK: - Tab Bar
    @ViewBuilder
    private func modernTabBar(breakpoint: ResponsiveLayoutSystem.Breakpoint) -> some View {
        FluidNavigationSystem.FluidTabBar(
            selectedTab: $selectedTab,
            tabs: tabs,
            accentColor: .blue,
            backgroundColor: .ultraThinMaterial
        )
        .padding(.horizontal, ResponsiveLayoutSystem.ResponsiveSpacing.spacing(for: breakpoint))
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(.white.opacity(0.1)),
            alignment: .top
        )
    }
    
    // MARK: - Background
    @ViewBuilder
    private var modernBackground: some View {
        ZStack {
            // Base background
            Color(NSColor.controlBackgroundColor)
                .edgesIgnoringSafeArea(.all)
            
            // Animated gradient overlay
            AnimatedGradientBackground()
                .opacity(0.6)
                .edgesIgnoringSafeArea(.all)
                .blendMode(.overlay)
            
            // Subtle particle field
            if showParticles {
                PerformanceOptimizedAnimations.OptimizedParticleView(
                    particleCount: 3,
                    color: .blue.opacity(0.1),
                    isActive: true
                )
                .edgesIgnoringSafeArea(.all)
                .allowsHitTesting(false)
                .blendMode(.plusLighter)
            }
        }
    }
    
    // MARK: - Overlays
    @ViewBuilder
    private var modernOverlays: some View {
        Group {
            // Onboarding overlay
            if appState.showOnboarding {
                OnboardingFlow {
                    appState.completeOnboarding()
                }
                .zIndex(1000)
                .transition(.opacity.combined(with: .scale))
            }
        }
    }
    
    // MARK: - Loading Overlay
    @ViewBuilder
    private var modernLoadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.3)
                .edgesIgnoringSafeArea(.all)
            
            ModernCard {
                VStack(spacing: 16) {
                    ModernLoadingSpinner(size: 32, color: .blue)
                    
                    ResponsiveLayoutSystem.ResponsiveText(
                        "Loading Universal AI Tools...",
                        style: .body
                    )
                    .foregroundColor(.secondary)
                }
                .padding(24)
            }
            .frame(width: 240, height: 120)
        }
        .transition(.opacity)
    }
    
    // MARK: - Data Loading
    private func loadInitialData() async {
        await MainActor.run {
            appState.isLoading = true
        }
        
        do {
            let agents = try await apiService.getAgents()
            await MainActor.run { 
                appState.availableAgents = agents
            }
        } catch { 
            print("Failed to load agents: \(error)")
        }

        do {
            let metrics = try await apiService.getMetrics()
            await MainActor.run {
                appState.systemMetrics = metrics
                appState.backendConnected = true
            }
        } catch { 
            print("Failed to load metrics: \(error)")
        }
        
        await MainActor.run {
            appState.isLoading = false
        }
    }
    
    private func startPerformanceMonitoring() {
        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
            // Simulate dynamic performance metrics
            performanceMetrics = AdvancedParticleSystem.PerformanceParticles.PerformanceMetrics(
                cpuUsage: Double.random(in: 0.2...0.8),
                memoryUsage: Double.random(in: 0.3...0.7),
                networkActivity: Double.random(in: 0.1...0.9),
                alertLevel: performanceMetrics.cpuUsage > 0.7 ? .warning : .normal
            )
        }
    }
}

#Preview {
    ModernContentView()
        .environmentObject(AppState())
        .environmentObject(APIService())
        .frame(minWidth: 900, minHeight: 600)
}