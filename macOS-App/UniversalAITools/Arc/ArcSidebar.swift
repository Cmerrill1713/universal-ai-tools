import SwiftUI

// MARK: - Arc Sidebar
// Vertical navigation sidebar inspired by Arc Browser

struct ArcSidebar: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    let width: CGFloat
    @Binding var isCollapsed: Bool
    @Binding var selectedSpace: ArcSpace
    @Binding var hoveredItem: SidebarItem?
    
    @State private var searchText = ""
    @State private var showNewChatMenu = false
    @State private var draggedChat: Chat?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            sidebarHeader
                .padding(ArcDesign.Spacing.md)
            
            ArcDivider()
            
            // Search bar (when not collapsed)
            if !isCollapsed {
                searchBar
                    .padding(ArcDesign.Spacing.md)
                
                ArcDivider()
            }
            
            // Space selector
            spaceSelector
                .padding(ArcDesign.Spacing.md)
            
            ArcDivider()
            
            // Main navigation items
            ScrollView {
                VStack(spacing: ArcDesign.Spacing.xs) {
                    ForEach(SidebarItem.mainItems, id: \.self) { item in
                        SidebarItemView(
                            item: item,
                            isSelected: appState.selectedSidebarItem == item,
                            isCollapsed: isCollapsed,
                            isHovered: hoveredItem == item
                        )
                        .onTapGesture {
                            selectItem(item)
                        }
                        .onHover { hovering in
                            hoveredItem = hovering ? item : nil
                        }
                    }
                }
                .padding(ArcDesign.Spacing.sm)
                
                // Recent Chats Section
                if !isCollapsed && appState.selectedSidebarItem == .chat {
                    recentChatsSection
                }
                
                // Active Agents Section
                if !isCollapsed && appState.selectedSidebarItem == .agents {
                    activeAgentsSection
                }
            }
            
            Spacer()
            
            ArcDivider()
            
            // Footer with settings and user info
            sidebarFooter
                .padding(ArcDesign.Spacing.md)
        }
        .frame(maxHeight: .infinity)
        .background(ArcDesign.Colors.primaryBackground.opacity(0.95))
        .overlay(
            // Right border
            Rectangle()
                .fill(Color.white.opacity(0.05))
                .frame(width: 1),
            alignment: .trailing
        )
    }
    
    // MARK: - Header
    private var sidebarHeader: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            // Logo/Brand
            Image(systemName: "cube.transparent.fill")
                .font(.system(size: 24))
                .foregroundColor(ArcDesign.Colors.accentBlue)
                .arcGlow(intensity: 0.2)
            
            if !isCollapsed {
                Text("Universal AI")
                    .font(ArcDesign.Typography.headline)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                
                Spacer()
                
                // Collapse button
                Button(action: { 
                    withAnimation(ArcDesign.Animation.spring) {
                        isCollapsed.toggle()
                    }
                }) {
                    Image(systemName: "sidebar.left")
                        .font(.system(size: 14))
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help("Toggle Sidebar")
            }
        }
    }
    
    // MARK: - Search Bar
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(ArcDesign.Colors.tertiaryText)
                .font(.system(size: 14))
            
            TextField("Search...", text: $searchText)
                .textFieldStyle(PlainTextFieldStyle())
                .font(ArcDesign.Typography.body)
                .foregroundColor(ArcDesign.Colors.primaryText)
        }
        .padding(ArcDesign.Spacing.sm)
        .background(ArcDesign.Colors.tertiaryBackground.opacity(0.3))
        .cornerRadius(ArcDesign.Radius.sm)
    }
    
    // MARK: - Space Selector
    private var spaceSelector: some View {
        Group {
            if isCollapsed {
                // Collapsed view - just show current space icon
                Image(systemName: selectedSpace.icon)
                    .font(.system(size: 18))
                    .foregroundColor(selectedSpace.color)
                    .frame(width: 32, height: 32)
                    .background(selectedSpace.color.opacity(0.1))
                    .cornerRadius(ArcDesign.Radius.sm)
            } else {
                // Expanded view - show space picker
                HStack(spacing: ArcDesign.Spacing.xs) {
                    ForEach(ArcSpace.allCases, id: \.self) { space in
                        SpaceBubble(
                            space: space,
                            isSelected: selectedSpace == space
                        )
                        .onTapGesture {
                            withAnimation(ArcDesign.Animation.spring) {
                                selectedSpace = space
                            }
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Recent Chats Section
    private var recentChatsSection: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
            HStack {
                Text("Recent Chats")
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.tertiaryText)
                    .textCase(.uppercase)
                
                Spacer()
                
                Button(action: { showNewChatMenu.toggle() }) {
                    Image(systemName: "plus")
                        .font(.system(size: 12))
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .popover(isPresented: $showNewChatMenu) {
                    NewChatMenu()
                        .environmentObject(appState)
                }
            }
            .padding(.horizontal, ArcDesign.Spacing.sm)
            .padding(.top, ArcDesign.Spacing.md)
            
            ForEach(appState.chats.filter { searchText.isEmpty || $0.title.localizedCaseInsensitiveContains(searchText) }) { chat in
                ChatItemView(chat: chat, isSelected: appState.currentChat?.id == chat.id)
                    .onTapGesture {
                        appState.selectChat(chat)
                    }
                    .onDrag {
                        self.draggedChat = chat
                        return NSItemProvider(object: chat.id as NSString)
                    }
            }
        }
        .padding(ArcDesign.Spacing.sm)
    }
    
    // MARK: - Active Agents Section
    private var activeAgentsSection: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
            Text("Active Agents")
                .font(ArcDesign.Typography.caption)
                .foregroundColor(ArcDesign.Colors.tertiaryText)
                .textCase(.uppercase)
                .padding(.horizontal, ArcDesign.Spacing.sm)
                .padding(.top, ArcDesign.Spacing.md)
            
            ForEach(appState.activeAgents) { agent in
                AgentItemView(agent: agent)
            }
        }
        .padding(ArcDesign.Spacing.sm)
    }
    
    // MARK: - Footer
    private var sidebarFooter: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            // Connection status
            Circle()
                .fill(apiService.isConnected ? ArcDesign.Colors.success : ArcDesign.Colors.error)
                .frame(width: 8, height: 8)
                .arcGlow(color: apiService.isConnected ? ArcDesign.Colors.success : ArcDesign.Colors.error, intensity: 0.5)
            
            if !isCollapsed {
                Text(apiService.isConnected ? "Connected" : "Offline")
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                
                Spacer()
                
                // Settings button
                Button(action: {
                    appState.selectedSidebarItem = .settings
                }) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 14))
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help("Settings")
            }
        }
    }
    
    // MARK: - Actions
    private func selectItem(_ item: SidebarItem) {
        withAnimation(ArcDesign.Animation.spring) {
            appState.selectedSidebarItem = item
        }
    }
}

// MARK: - Sidebar Item View
struct SidebarItemView: View {
    let item: SidebarItem
    let isSelected: Bool
    let isCollapsed: Bool
    let isHovered: Bool
    
    var body: some View {
        HStack(spacing: ArcDesign.Spacing.md) {
            Image(systemName: item.icon)
                .font(.system(size: 18))
                .foregroundColor(iconColor)
                .frame(width: 24, height: 24)
            
            if !isCollapsed {
                Text(item.title)
                    .font(ArcDesign.Typography.body)
                    .foregroundColor(textColor)
                
                Spacer()
                
                if let badge = item.badge {
                    Text(badge)
                        .font(ArcDesign.Typography.caption2)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(ArcDesign.Colors.accentBlue)
                        .cornerRadius(ArcDesign.Radius.xs)
                }
            }
        }
        .padding(.horizontal, ArcDesign.Spacing.sm)
        .padding(.vertical, ArcDesign.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(backgroundView)
        .cornerRadius(ArcDesign.Radius.sm)
        .animation(ArcDesign.Animation.quick, value: isSelected)
        .animation(ArcDesign.Animation.quick, value: isHovered)
    }
    
    private var iconColor: Color {
        if isSelected {
            return ArcDesign.Colors.accentBlue
        } else if isHovered {
            return ArcDesign.Colors.primaryText
        } else {
            return ArcDesign.Colors.secondaryText
        }
    }
    
    private var textColor: Color {
        if isSelected {
            return ArcDesign.Colors.primaryText
        } else if isHovered {
            return ArcDesign.Colors.primaryText
        } else {
            return ArcDesign.Colors.secondaryText
        }
    }
    
    @ViewBuilder
    private var backgroundView: some View {
        if isSelected {
            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                .fill(ArcDesign.Colors.accentBlue.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                        .stroke(ArcDesign.Colors.accentBlue.opacity(0.3), lineWidth: 1)
                )
        } else if isHovered {
            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                .fill(Color.white.opacity(0.05))
        } else {
            Color.clear
        }
    }
}

// MARK: - Space Bubble
struct SpaceBubble: View {
    let space: ArcSpace
    let isSelected: Bool
    
    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(space.color.opacity(isSelected ? 0.2 : 0.1))
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: space.icon)
                        .font(.system(size: 14))
                        .foregroundColor(space.color)
                )
                .overlay(
                    Circle()
                        .stroke(space.color.opacity(isSelected ? 0.5 : 0), lineWidth: 2)
                )
            
            Text(space.rawValue)
                .font(ArcDesign.Typography.caption2)
                .foregroundColor(isSelected ? space.color : ArcDesign.Colors.tertiaryText)
        }
        .animation(ArcDesign.Animation.quick, value: isSelected)
    }
}

// MARK: - Chat Item View
struct ChatItemView: View {
    let chat: Chat
    let isSelected: Bool
    @State private var isHovered = false
    
    var body: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            Image(systemName: "message")
                .font(.system(size: 14))
                .foregroundColor(isSelected ? ArcDesign.Colors.accentBlue : ArcDesign.Colors.tertiaryText)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(chat.title)
                    .font(ArcDesign.Typography.subheadline)
                    .foregroundColor(isSelected ? ArcDesign.Colors.primaryText : ArcDesign.Colors.secondaryText)
                    .lineLimit(1)
                
                if let lastMessage = chat.messages.last {
                    Text(lastMessage.content)
                        .font(ArcDesign.Typography.caption)
                        .foregroundColor(ArcDesign.Colors.tertiaryText)
                        .lineLimit(1)
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, ArcDesign.Spacing.sm)
        .padding(.vertical, ArcDesign.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.xs)
                .fill(isSelected ? ArcDesign.Colors.accentBlue.opacity(0.1) : (isHovered ? Color.white.opacity(0.05) : Color.clear))
        )
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

// MARK: - Agent Item View
struct AgentItemView: View {
    let agent: Agent
    @State private var isHovered = false
    
    var body: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            Circle()
                .fill(agent.statusColor.opacity(0.2))
                .frame(width: 8, height: 8)
                .overlay(
                    Circle()
                        .fill(agent.statusColor)
                        .frame(width: 4, height: 4)
                )
            
            Text(agent.displayName)
                .font(ArcDesign.Typography.subheadline)
                .foregroundColor(ArcDesign.Colors.secondaryText)
            
            Spacer()
            
            if agent.isActive {
                ProgressView()
                    .scaleEffect(0.5)
                    .frame(width: 16, height: 16)
            }
        }
        .padding(.horizontal, ArcDesign.Spacing.sm)
        .padding(.vertical, ArcDesign.Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.xs)
                .fill(isHovered ? Color.white.opacity(0.05) : Color.clear)
        )
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

// MARK: - New Chat Menu
struct NewChatMenu: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.md) {
            Text("Start New Conversation")
                .font(ArcDesign.Typography.headline)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            VStack(spacing: ArcDesign.Spacing.sm) {
                MenuOption(title: "Blank Chat", icon: "message", action: {
                    _ = appState.createNewChat()
                    dismiss()
                })
                
                MenuOption(title: "With Template", icon: "doc.text", action: {
                    // TODO: Show template picker
                    dismiss()
                })
                
                MenuOption(title: "Import History", icon: "square.and.arrow.down", action: {
                    // TODO: Show import dialog
                    dismiss()
                })
            }
        }
        .padding(ArcDesign.Spacing.lg)
        .frame(width: 250)
    }
}

struct MenuOption: View {
    let title: String
    let icon: String
    let action: () -> Void
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                Text(title)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                Spacer()
            }
            .padding(ArcDesign.Spacing.sm)
            .background(isHovered ? ArcDesign.Colors.tertiaryBackground.opacity(0.5) : Color.clear)
            .cornerRadius(ArcDesign.Radius.xs)
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

// MARK: - SidebarItem Extension
extension SidebarItem {
    static let mainItems: [SidebarItem] = [.chat, .agents, .tools, .dashboard]
    
    var title: String {
        switch self {
        case .chat: return "Chat"
        case .agents: return "Agents"
        case .tools: return "Tools"
        case .dashboard: return "Dashboard"
        case .settings: return "Settings"
        default: return rawValue ?? "Unknown"
        }
    }
    
    var icon: String {
        switch self {
        case .chat: return "message.fill"
        case .agents: return "cpu"
        case .tools: return "wrench.and.screwdriver.fill"
        case .dashboard: return "chart.bar.fill"
        case .settings: return "gearshape.fill"
        default: return "questionmark.circle"
        }
    }
    
    var badge: String? {
        return nil // Can be extended to show counts
    }
}