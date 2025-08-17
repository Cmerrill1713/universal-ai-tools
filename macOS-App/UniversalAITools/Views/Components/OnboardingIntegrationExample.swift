import SwiftUI

/// Onboarding Integration Example
/// Demonstrates how to integrate the progressive onboarding system throughout the Universal AI Tools app
struct OnboardingIntegrationExample: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    @State private var selectedTab: AppTab = .dashboard
    @State private var showSettings = false
    @State private var showAgentDetails = false
    
    enum AppTab: String, CaseIterable {
        case dashboard = "Dashboard"
        case agents = "Agents"
        case performance = "Performance"
        case settings = "Settings"
        
        var icon: String {
            switch self {
            case .dashboard: return "chart.bar.fill"
            case .agents: return "brain.head.profile"
            case .performance: return "speedometer"
            case .settings: return "gearshape.fill"
            }
        }
    }
    
    var body: some View {
        NavigationSplitView {
            // Sidebar with onboarding targets
            sidebarContent
                .onboardingTarget(id: "main_navigation")
        } detail: {
            // Main content area
            mainContent
                .progressiveOnboarding()
        }
        .sheet(isPresented: $showSettings) {
            OnboardingSettingsView()
        }
        .toolbar {
            toolbarContent
        }
    }
    
    // MARK: - Sidebar Content
    
    private var sidebarContent: some View {
        VStack(spacing: 0) {
            // App header
            VStack(spacing: 12) {
                Image(systemName: "brain.filled.head.profile")
                    .font(.system(size: 32))
                    .foregroundStyle(.blue.gradient)
                    .onboardingTarget(id: "app_logo")
                
                Text("Universal AI Tools")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                ModernUIComponentsLibrary.FeatureDiscoveryBadge(type: .new)
                    .onboardingTarget(id: "new_features_badge")
            }
            .padding()
            
            Divider()
            
            // Navigation tabs
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(AppTab.allCases, id: \.self) { tab in
                        NavigationTabRow(
                            tab: tab,
                            isSelected: selectedTab == tab,
                            onSelect: { selectedTab = tab }
                        )
                        .onboardingTarget(id: "nav_\(tab.rawValue.lowercased())")
                    }
                }
                .padding()
            }
            
            Spacer()
            
            // Quick actions
            VStack(spacing: 12) {
                ModernUIComponentsLibrary.EnhancedActionButton(
                    title: "Start Tour",
                    icon: "play.fill",
                    action: { onboardingManager.startOnboarding() },
                    style: .secondary
                )
                .onboardingTarget(id: "start_tour_button")
                
                ModernUIComponentsLibrary.EnhancedActionButton(
                    title: "Settings",
                    icon: "gearshape",
                    action: { showSettings = true },
                    style: .ghost
                )
                .onboardingTarget(id: "settings_button")
            }
            .padding()
        }
        .frame(minWidth: 250)
    }
    
    // MARK: - Main Content
    
    private var mainContent: some View {
        VStack(spacing: 0) {
            // Content header
            contentHeader
            
            // Tab content
            TabView(selection: $selectedTab) {
                ForEach(AppTab.allCases, id: \.self) { tab in
                    contentForTab(tab)
                        .tag(tab)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
    }
    
    private var contentHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(selectedTab.rawValue)
                    .font(.title)
                    .fontWeight(.bold)
                    .onboardingTarget(id: "page_title")
                
                Text(descriptionForTab(selectedTab))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Header actions
            HStack(spacing: 12) {
                Button(action: { /* Search action */ }) {
                    Image(systemName: "magnifyingglass")
                        .font(.title2)
                }
                .buttonStyle(.bordered)
                .onboardingTarget(id: "search_button")
                
                Button(action: { /* Notifications */ }) {
                    Image(systemName: "bell")
                        .font(.title2)
                }
                .buttonStyle(.bordered)
                .onboardingTarget(id: "notifications_button")
                
                ModernUIComponentsLibrary.MorphingIconButton(
                    primaryIcon: "plus",
                    secondaryIcon: "checkmark",
                    isToggled: false,
                    action: { /* Add new */ }
                )
                .onboardingTarget(id: "add_button")
            }
        }
        .padding()
        .background(.ultraThinMaterial)
    }
    
    @ViewBuilder
    private func contentForTab(_ tab: AppTab) -> some View {
        ScrollView {
            VStack(spacing: 24) {
                switch tab {
                case .dashboard:
                    dashboardContent
                case .agents:
                    agentsContent
                case .performance:
                    performanceContent
                case .settings:
                    settingsContent
                }
            }
            .padding()
        }
    }
    
    // MARK: - Tab Content
    
    private var dashboardContent: some View {
        VStack(spacing: 24) {
            // Key metrics cards
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 16) {
                ModernUIComponentsLibrary.ParticleDataCard(
                    title: "Active Agents",
                    value: "12",
                    trend: .rising,
                    color: .blue
                )
                .onboardingTarget(id: "active_agents_card")
                
                ModernUIComponentsLibrary.ParticleDataCard(
                    title: "Success Rate",
                    value: "98.5%",
                    trend: .rising,
                    color: .green
                )
                .onboardingTarget(id: "success_rate_card")
                
                ModernUIComponentsLibrary.ParticleDataCard(
                    title: "Avg Response",
                    value: "1.2s",
                    trend: .falling,
                    color: .orange
                )
                .onboardingTarget(id: "response_time_card")
            }
            
            // Network topology preview
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("Agent Network Topology")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Spacer()
                    
                    Button("View Details") {
                        // Show detailed topology
                    }
                    .buttonStyle(.bordered)
                }
                
                AdvancedVisualEffects.DataFlowVisualization(
                    nodes: createSampleNodes(),
                    connections: createSampleConnections()
                )
                .frame(height: 200)
                .background(.ultraThinMaterial)
                .cornerRadius(12)
                .onboardingTarget(id: "network_topology")
            }
            
            // Recent activity
            VStack(alignment: .leading, spacing: 16) {
                Text("Recent Activity")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 8) {
                    ForEach(0..<5, id: \.self) { index in
                        ActivityRow(
                            title: "Agent collaboration completed",
                            subtitle: "GPT-4 + Claude worked on data analysis",
                            timestamp: "2 min ago",
                            status: .success
                        )
                    }
                }
                .onboardingTarget(id: "activity_list")
            }
        }
    }
    
    private var agentsContent: some View {
        VStack(spacing: 24) {
            // Agent status overview
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                AgentStatusCard(
                    name: "GPT-4",
                    status: .online,
                    tasks: 5,
                    performance: 0.98
                )
                .onboardingTarget(id: "gpt4_agent")
                
                AgentStatusCard(
                    name: "Claude",
                    status: .busy,
                    tasks: 3,
                    performance: 0.96
                )
                .onboardingTarget(id: "claude_agent")
                
                AgentStatusCard(
                    name: "Local LLM",
                    status: .online,
                    tasks: 2,
                    performance: 0.89
                )
                .onboardingTarget(id: "local_llm_agent")
                
                AgentStatusCard(
                    name: "Specialist AI",
                    status: .offline,
                    tasks: 0,
                    performance: 0.94
                )
                .onboardingTarget(id: "specialist_agent")
            }
            
            // Collaboration history
            VStack(alignment: .leading, spacing: 16) {
                Text("Recent Collaborations")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    ForEach(0..<3, id: \.self) { index in
                        CollaborationCard(
                            title: "Data Analysis Project",
                            participants: ["GPT-4", "Claude"],
                            duration: "5.2 minutes",
                            status: .completed
                        )
                    }
                }
                .onboardingTarget(id: "collaboration_history")
            }
        }
    }
    
    private var performanceContent: some View {
        VStack(spacing: 24) {
            // Performance overview using our optimized views
            PerformanceMonitoringView()
                .onboardingTarget(id: "performance_monitor")
            
            // Optimization recommendations
            VStack(alignment: .leading, spacing: 16) {
                Text("Optimization Recommendations")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    RecommendationCard(
                        title: "Enable Aggressive Caching",
                        description: "Improve response times by 30%",
                        impact: .high,
                        action: "Enable"
                    )
                    .onboardingTarget(id: "cache_recommendation")
                    
                    RecommendationCard(
                        title: "Optimize Memory Usage",
                        description: "Reduce memory footprint by clearing unused data",
                        impact: .medium,
                        action: "Optimize"
                    )
                }
            }
        }
    }
    
    private var settingsContent: some View {
        VStack(spacing: 24) {
            // Settings categories
            VStack(alignment: .leading, spacing: 16) {
                Text("App Settings")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 8) {
                    SettingsRow(title: "General", icon: "gearshape", hasArrow: true)
                        .onboardingTarget(id: "general_settings")
                    
                    SettingsRow(title: "Agents", icon: "brain.head.profile", hasArrow: true)
                        .onboardingTarget(id: "agent_settings")
                    
                    SettingsRow(title: "Performance", icon: "speedometer", hasArrow: true)
                        .onboardingTarget(id: "performance_settings")
                    
                    SettingsRow(title: "Onboarding", icon: "graduationcap", hasArrow: true)
                        .onTapGesture { showSettings = true }
                        .onboardingTarget(id: "onboarding_settings")
                }
            }
        }
    }
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button("Help") {
                // Show help documentation
            }
            .buttonStyle(.bordered)
            .onboardingTarget(id: "help_button")
            
            ModernUIComponentsLibrary.MorphingIconButton(
                primaryIcon: "questionmark.circle",
                secondaryIcon: "info.circle.fill",
                isToggled: false,
                action: { onboardingManager.startOnboarding() }
            )
            .onboardingTarget(id: "tour_button")
        }
    }
    
    // MARK: - Helper Functions
    
    private func descriptionForTab(_ tab: AppTab) -> String {
        switch tab {
        case .dashboard:
            return "Monitor your AI agents and system performance"
        case .agents:
            return "Manage and coordinate your AI agents"
        case .performance:
            return "Optimize system performance and resource usage"
        case .settings:
            return "Configure app preferences and features"
        }
    }
    
    private func createSampleNodes() -> [AdvancedVisualEffects.DataFlowVisualization.DataNode] {
        [
            .init(position: CGPoint(x: 100, y: 100), label: "Input", color: .blue, size: 40),
            .init(position: CGPoint(x: 250, y: 80), label: "GPT-4", color: .green, size: 50),
            .init(position: CGPoint(x: 250, y: 150), label: "Claude", color: .orange, size: 45),
            .init(position: CGPoint(x: 400, y: 100), label: "Output", color: .purple, size: 40)
        ]
    }
    
    private func createSampleConnections() -> [AdvancedVisualEffects.DataFlowVisualization.DataConnection] {
        let nodes = createSampleNodes()
        return [
            .init(fromNodeId: nodes[0].id, toNodeId: nodes[1].id, strength: 0.8, isActive: true),
            .init(fromNodeId: nodes[0].id, toNodeId: nodes[2].id, strength: 0.6, isActive: true),
            .init(fromNodeId: nodes[1].id, toNodeId: nodes[3].id, strength: 0.9, isActive: true),
            .init(fromNodeId: nodes[2].id, toNodeId: nodes[3].id, strength: 0.7, isActive: false)
        ]
    }
}

// MARK: - Supporting Views

struct NavigationTabRow: View {
    let tab: OnboardingIntegrationExample.AppTab
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Image(systemName: tab.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(isSelected ? .white : .blue)
                    .frame(width: 24)
                
                Text(tab.rawValue)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(isSelected ? .white : .primary)
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? .blue : .clear)
            )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

struct ActivityRow: View {
    let title: String
    let subtitle: String
    let timestamp: String
    let status: ActivityStatus
    
    enum ActivityStatus {
        case success, warning, error, info
        
        var color: Color {
            switch self {
            case .success: return .green
            case .warning: return .orange
            case .error: return .red
            case .info: return .blue
            }
        }
        
        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .error: return "xmark.circle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: status.icon)
                .foregroundColor(status.color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(timestamp)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.regularMaterial)
        .cornerRadius(8)
    }
}

struct AgentStatusCard: View {
    let name: String
    let status: AgentStatus
    let tasks: Int
    let performance: Double
    
    enum AgentStatus {
        case online, busy, offline
        
        var color: Color {
            switch self {
            case .online: return .green
            case .busy: return .orange
            case .offline: return .red
            }
        }
        
        var text: String {
            switch self {
            case .online: return "Online"
            case .busy: return "Busy"
            case .offline: return "Offline"
            }
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(name)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                ModernUIComponentsLibrary.EnhancedStatusBadge(
                    status: status.text,
                    type: status == .online ? .success : status == .busy ? .active : .error
                )
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text("Active Tasks: \(tasks)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("Performance: \(Int(performance * 100))%")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            ModernUIComponentsLibrary.ProgressRing(progress: performance)
                .frame(width: 40, height: 40)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

struct CollaborationCard: View {
    let title: String
    let participants: [String]
    let duration: String
    let status: CollaborationStatus
    
    enum CollaborationStatus {
        case active, completed, failed
        
        var color: Color {
            switch self {
            case .active: return .blue
            case .completed: return .green
            case .failed: return .red
            }
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Text(duration)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Text("Participants: \(participants.joined(separator: ", "))")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(8)
    }
}

struct RecommendationCard: View {
    let title: String
    let description: String
    let impact: RecommendationImpact
    let action: String
    
    enum RecommendationImpact {
        case low, medium, high
        
        var color: Color {
            switch self {
            case .low: return .green
            case .medium: return .orange
            case .high: return .red
            }
        }
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button(action) {
                // Perform recommendation action
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(8)
    }
}

struct SettingsRow: View {
    let title: String
    let icon: String
    let hasArrow: Bool
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 20)
            
            Text(title)
                .font(.subheadline)
            
            Spacer()
            
            if hasArrow {
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.regularMaterial)
        .cornerRadius(8)
    }
}

#Preview {
    OnboardingIntegrationExample()
        .frame(width: 1200, height: 800)
}