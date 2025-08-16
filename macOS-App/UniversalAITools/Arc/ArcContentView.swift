import SwiftUI
import Combine

// MARK: - Arc Content View
// Main container view with Arc-inspired sidebar navigation

struct ArcContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    @State private var sidebarWidth: CGFloat = 280
    @State private var isSidebarCollapsed = false
    @State private var showCommandPalette = false
    @State private var selectedSpace: ArcSpace = .main
    @State private var hoveredItem: SidebarItem?
    
    private let minSidebarWidth: CGFloat = 68
    private let maxSidebarWidth: CGFloat = 380
    
    var body: some View {
        ZStack {
            // Main content area
            HStack(spacing: 0) {
                // Sidebar
                ArcSidebar(
                    width: sidebarWidth,
                    isCollapsed: $isSidebarCollapsed,
                    selectedSpace: $selectedSpace,
                    hoveredItem: $hoveredItem
                )
                .frame(width: isSidebarCollapsed ? minSidebarWidth : sidebarWidth)
                .animation(ArcDesign.Animation.spring, value: isSidebarCollapsed)
                .animation(ArcDesign.Animation.spring, value: sidebarWidth)
                
                // Divider with resize handle
                sidebarDivider
                
                // Main content
                mainContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(ArcDesign.Colors.secondaryBackground)
            
            // Command Palette Overlay
            if showCommandPalette {
                ArcCommandPalette(isPresented: $showCommandPalette)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                    .zIndex(100)
            }
        }
        .onAppear {
            setupKeyboardShortcuts()
            loadInitialData()
        }
        .frame(minWidth: 900, minHeight: 600)
    }
    
    // MARK: - Sidebar Divider
    private var sidebarDivider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.1))
            .frame(width: 1)
            .overlay(
                // Resize handle
                Rectangle()
                    .fill(Color.clear)
                    .frame(width: 8)
                    .contentShape(Rectangle())
                    .cursor(NSCursor.resizeLeftRight)
                    .onDrag { value in
                        if !isSidebarCollapsed {
                            let newWidth = sidebarWidth + value.translation.width
                            sidebarWidth = min(max(newWidth, 200), maxSidebarWidth)
                        }
                    }
            )
    }
    
    // MARK: - Main Content
    @ViewBuilder
    private var mainContent: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    ArcDesign.Colors.secondaryBackground,
                    ArcDesign.Colors.tertiaryBackground.opacity(0.3)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            // Content based on selection
            Group {
                switch appState.selectedSidebarItem {
                case .chat:
                    ArcChatView()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                    
                case .agents:
                    ArcAgentDashboard()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                    
                case .tools:
                    ArcToolsView()
                        .environmentObject(appState)
                    
                case .dashboard:
                    ArcDashboardView()
                        .environmentObject(appState)
                    
                case .settings:
                    ArcSettingsView()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                    
                default:
                    ArcWelcomeView()
                }
            }
            .transition(.asymmetric(
                insertion: .move(edge: .trailing).combined(with: .opacity),
                removal: .move(edge: .leading).combined(with: .opacity)
            ))
            .animation(ArcDesign.Animation.spring, value: appState.selectedSidebarItem)
        }
    }
    
    // MARK: - Setup
    private func setupKeyboardShortcuts() {
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            // CMD+K for command palette
            if event.modifierFlags.contains(.command) && event.characters == "k" {
                showCommandPalette.toggle()
                return nil
            }
            
            // CMD+\ to toggle sidebar
            if event.modifierFlags.contains(.command) && event.characters == "\\" {
                withAnimation(ArcDesign.Animation.spring) {
                    isSidebarCollapsed.toggle()
                }
                return nil
            }
            
            // CMD+1-9 for quick navigation
            if event.modifierFlags.contains(.command),
               let number = event.characters?.first?.wholeNumberValue,
               number >= 1 && number <= 9 {
                navigateToItem(at: number - 1)
                return nil
            }
            
            return event
        }
    }
    
    private func navigateToItem(at index: Int) {
        let items: [SidebarItem] = [.chat, .agents, .tools, .dashboard, .settings]
        if index < items.count {
            withAnimation(ArcDesign.Animation.spring) {
                appState.selectedSidebarItem = items[index]
            }
        }
    }
    
    private func loadInitialData() {
        Task {
            await apiService.connectToBackend()
            
            // Load chats if we have any
            if appState.chats.isEmpty {
                appState.createNewChat()
            }
        }
    }
}

// MARK: - Arc Space
enum ArcSpace: String, CaseIterable {
    case main = "Main"
    case work = "Work"
    case research = "Research"
    case personal = "Personal"
    
    var color: Color {
        switch self {
        case .main: return ArcDesign.Colors.accentBlue
        case .work: return ArcDesign.Colors.accentPurple
        case .research: return ArcDesign.Colors.accentGreen
        case .personal: return ArcDesign.Colors.accentPink
        }
    }
    
    var icon: String {
        switch self {
        case .main: return "star.fill"
        case .work: return "briefcase.fill"
        case .research: return "magnifyingglass"
        case .personal: return "person.fill"
        }
    }
}

// MARK: - Placeholder Views (to be implemented)

struct ArcWelcomeView: View {
    var body: some View {
        VStack(spacing: ArcDesign.Spacing.xl) {
            Image(systemName: "sparkles")
                .font(.system(size: 64))
                .foregroundColor(ArcDesign.Colors.accentBlue)
                .arcGlow()
            
            Text("Welcome to Universal AI Tools")
                .font(ArcDesign.Typography.largeTitle)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            Text("Select an item from the sidebar to get started")
                .font(ArcDesign.Typography.body)
                .foregroundColor(ArcDesign.Colors.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ArcToolsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ArcDesign.Spacing.lg) {
                Text("Tools")
                    .font(ArcDesign.Typography.largeTitle)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                    .padding(.horizontal)
                
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 200))], spacing: ArcDesign.Spacing.md) {
                    ForEach(1...6, id: \.self) { index in
                        ToolCard(title: "Tool \(index)", icon: "wrench.and.screwdriver.fill")
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
    }
}

struct ToolCard: View {
    let title: String
    let icon: String
    @State private var isHovered = false
    
    var body: some View {
        VStack(spacing: ArcDesign.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 32))
                .foregroundColor(ArcDesign.Colors.accentBlue)
            
            Text(title)
                .font(ArcDesign.Typography.headline)
                .foregroundColor(ArcDesign.Colors.primaryText)
        }
        .frame(height: 120)
        .frame(maxWidth: .infinity)
        .arcCard()
        .arcHover($isHovered)
    }
}

struct ArcDashboardView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ArcDesign.Spacing.xl) {
                Text("Dashboard")
                    .font(ArcDesign.Typography.largeTitle)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                    .padding(.horizontal)
                
                // Metrics Cards
                HStack(spacing: ArcDesign.Spacing.md) {
                    MetricCard(title: "Active Chats", value: "\(appState.chats.count)", icon: "message.fill", color: ArcDesign.Colors.accentBlue)
                    MetricCard(title: "Agents", value: "\(appState.availableAgents.count)", icon: "cpu", color: ArcDesign.Colors.accentPurple)
                    MetricCard(title: "API Status", value: appState.apiService.isConnected ? "Connected" : "Offline", icon: "wifi", color: appState.apiService.isConnected ? ArcDesign.Colors.success : ArcDesign.Colors.error)
                }
                .padding(.horizontal)
                
                // Recent Activity
                VStack(alignment: .leading, spacing: ArcDesign.Spacing.md) {
                    Text("Recent Activity")
                        .font(ArcDesign.Typography.title2)
                        .foregroundColor(ArcDesign.Colors.primaryText)
                    
                    ForEach(appState.recentChats.prefix(5)) { chat in
                        HStack {
                            Image(systemName: "message")
                                .foregroundColor(ArcDesign.Colors.secondaryText)
                            
                            Text(chat.title)
                                .font(ArcDesign.Typography.body)
                                .foregroundColor(ArcDesign.Colors.primaryText)
                            
                            Spacer()
                            
                            Text(chat.lastMessageTime, style: .relative)
                                .font(ArcDesign.Typography.caption)
                                .foregroundColor(ArcDesign.Colors.tertiaryText)
                        }
                        .padding(ArcDesign.Spacing.sm)
                        .arcCard(padding: ArcDesign.Spacing.sm)
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
            }
            
            Text(value)
                .font(ArcDesign.Typography.title1)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            Text(title)
                .font(ArcDesign.Typography.caption)
                .foregroundColor(ArcDesign.Colors.secondaryText)
        }
        .padding(ArcDesign.Spacing.lg)
        .frame(maxWidth: .infinity)
        .arcGlass()
    }
}

struct ArcSettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ArcDesign.Spacing.xl) {
                Text("Settings")
                    .font(ArcDesign.Typography.largeTitle)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                    .padding(.horizontal)
                
                // Connection Settings
                VStack(alignment: .leading, spacing: ArcDesign.Spacing.md) {
                    Label("Connection", systemImage: "network")
                        .font(ArcDesign.Typography.headline)
                        .foregroundColor(ArcDesign.Colors.primaryText)
                    
                    ConnectionSettingsView()
                        .environmentObject(apiService)
                        .arcCard()
                }
                .padding(.horizontal)
                
                // Appearance Settings
                VStack(alignment: .leading, spacing: ArcDesign.Spacing.md) {
                    Label("Appearance", systemImage: "paintbrush")
                        .font(ArcDesign.Typography.headline)
                        .foregroundColor(ArcDesign.Colors.primaryText)
                    
                    Toggle("Dark Mode", isOn: $appState.darkMode)
                        .toggleStyle(SwitchToggleStyle())
                        .arcCard()
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
    }
}

struct ArcAgentDashboard: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: ArcDesign.Spacing.xl) {
                Text("Agent Dashboard")
                    .font(ArcDesign.Typography.largeTitle)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                    .padding(.horizontal)
                
                Text("Coming Soon")
                    .font(ArcDesign.Typography.title2)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                    .padding(.horizontal)
            }
            .padding(.vertical)
        }
    }
}