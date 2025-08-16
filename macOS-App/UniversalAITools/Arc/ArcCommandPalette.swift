import SwiftUI
import Foundation

// MARK: - Command Item Models
struct CommandItem: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let subtitle: String?
    let icon: String
    let category: CommandCategory
    let action: CommandAction
    let shortcut: String?
    let score: Double // For fuzzy search ranking
    
    init(title: String, subtitle: String? = nil, icon: String, category: CommandCategory, action: CommandAction, shortcut: String? = nil, score: Double = 0.0) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.category = category
        self.action = action
        self.shortcut = shortcut
        self.score = score
    }
}

enum CommandCategory: String, CaseIterable {
    case recent = "Recent"
    case actions = "Actions"
    case navigation = "Navigation"
    case chats = "Chats"
    case agents = "Agents"
    case tools = "Tools"
    
    var color: Color {
        switch self {
        case .recent: return ArcDesign.Colors.accentPurple
        case .actions: return ArcDesign.Colors.accentBlue
        case .navigation: return ArcDesign.Colors.accentGreen
        case .chats: return ArcDesign.Colors.accentOrange
        case .agents: return ArcDesign.Colors.accentPink
        case .tools: return ArcDesign.Colors.accentYellow
        }
    }
}

enum CommandAction {
    case createNewChat
    case openSettings
    case openDebugPanel
    case selectChat(Chat)
    case selectAgent(Agent)
    case openAgentSelector
    case openConversationWindow
    case openAgentActivityWindow
    case openMLXWindow
    case openVisionWindow
    case openABMCTSWindow
    case openMALTSwarmWindow
    case openSystemMonitorWindow
    case toggleSidebar
    case switchViewMode(ViewMode)
    case connectToBackend
    case disconnectFromBackend
    case selectModel(String)
    case toggleDebugPanel
    case clearError
    case showNotification(String, NotificationType)
    case custom(String, () -> Void)
}

// MARK: - Arc Command Palette
struct ArcCommandPalette: View {
    @StateObject private var viewModel = CommandPaletteViewModel()
    @EnvironmentObject private var appState: AppState
    @FocusState private var isSearchFocused: Bool
    @State private var selectedIndex: Int = 0
    
    let onDismiss: () -> Void
    
    var body: some View {
        ZStack {
            // Backdrop blur
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture {
                    onDismiss()
                }
            
            // Command palette container
            VStack(spacing: 0) {
                searchHeader
                resultsContent
            }
            .frame(width: 600, height: 500)
            .arcGlass(cornerRadius: ArcDesign.Radius.lg)
            .shadow(color: ArcDesign.Colors.shadowColor.opacity(0.3), radius: 20, x: 0, y: 10)
            .scaleEffect(viewModel.isVisible ? 1.0 : 0.95)
            .opacity(viewModel.isVisible ? 1.0 : 0.0)
            .animation(ArcDesign.Animation.spring, value: viewModel.isVisible)
        }
        .onAppear {
            viewModel.setupCommands(appState: appState)
            viewModel.isVisible = true
            isSearchFocused = true
        }
        .onKeyPress(.escape) {
            onDismiss()
            return .handled
        }
        .onKeyPress(.return) {
            executeSelectedCommand()
            return .handled
        }
        .onKeyPress(.upArrow) {
            moveSelection(-1)
            return .handled
        }
        .onKeyPress(.downArrow) {
            moveSelection(1)
            return .handled
        }
    }
    
    // MARK: - Search Header
    private var searchHeader: some View {
        VStack(spacing: ArcDesign.Spacing.md) {
            HStack(spacing: ArcDesign.Spacing.md) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(ArcDesign.Colors.accentBlue)
                    .font(.system(size: 18, weight: .medium))
                
                TextField("Search commands, chats, agents...", text: $viewModel.searchText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(ArcDesign.Typography.headline)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                    .focused($isSearchFocused)
                    .onChange(of: viewModel.searchText) { _, newValue in
                        viewModel.performSearch(query: newValue)
                        selectedIndex = 0
                    }
                
                if !viewModel.searchText.isEmpty {
                    Button(action: {
                        viewModel.searchText = ""
                        viewModel.performSearch(query: "")
                        selectedIndex = 0
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(ArcDesign.Colors.secondaryText)
                            .font(.system(size: 16))
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .padding(ArcDesign.Spacing.lg)
            
            // Keyboard hints
            HStack(spacing: ArcDesign.Spacing.lg) {
                keyboardHint("↑↓", "Navigate")
                keyboardHint("⏎", "Select")
                keyboardHint("⎋", "Close")
                
                Spacer()
                
                Text("\(viewModel.filteredCommands.count) results")
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.tertiaryText)
            }
            .padding(.horizontal, ArcDesign.Spacing.lg)
            .padding(.bottom, ArcDesign.Spacing.sm)
            
            ArcDivider()
        }
    }
    
    // MARK: - Results Content
    private var resultsContent: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if viewModel.filteredCommands.isEmpty {
                        emptyState
                    } else {
                        ForEach(Array(viewModel.groupedCommands.keys.sorted(by: { $0.rawValue < $1.rawValue })), id: \.self) { category in
                            if let commands = viewModel.groupedCommands[category], !commands.isEmpty {
                                categorySection(category: category, commands: commands)
                            }
                        }
                    }
                }
                .padding(.vertical, ArcDesign.Spacing.sm)
            }
            .onChange(of: selectedIndex) { _, newIndex in
                withAnimation(.easeInOut(duration: 0.2)) {
                    proxy.scrollTo("command-\(newIndex)", anchor: .center)
                }
            }
        }
    }
    
    // MARK: - Category Section
    private func categorySection(category: CommandCategory, commands: [CommandItem]) -> some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.xs) {
            // Category header
            HStack {
                Circle()
                    .fill(category.color)
                    .frame(width: 8, height: 8)
                
                Text(category.rawValue)
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                    .fontWeight(.medium)
                
                Spacer()
            }
            .padding(.horizontal, ArcDesign.Spacing.lg)
            .padding(.top, ArcDesign.Spacing.md)
            
            // Commands in category
            ForEach(Array(commands.enumerated()), id: \.element.id) { index, command in
                let globalIndex = viewModel.getGlobalIndex(for: command)
                commandRow(command: command, isSelected: globalIndex == selectedIndex)
                    .id("command-\(globalIndex)")
                    .onTapGesture {
                        selectedIndex = globalIndex
                        executeSelectedCommand()
                    }
            }
        }
    }
    
    // MARK: - Command Row
    private func commandRow(command: CommandItem, isSelected: Bool) -> some View {
        HStack(spacing: ArcDesign.Spacing.md) {
            // Icon
            Image(systemName: command.icon)
                .foregroundColor(command.category.color)
                .font(.system(size: 16, weight: .medium))
                .frame(width: 20, height: 20)
            
            // Content
            VStack(alignment: .leading, spacing: 2) {
                Text(command.title)
                    .font(ArcDesign.Typography.body)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                
                if let subtitle = command.subtitle {
                    Text(subtitle)
                        .font(ArcDesign.Typography.caption)
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            // Keyboard shortcut
            if let shortcut = command.shortcut {
                Text(shortcut)
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.tertiaryText)
                    .padding(.horizontal, ArcDesign.Spacing.sm)
                    .padding(.vertical, 2)
                    .background(ArcDesign.Colors.tertiaryBackground.opacity(0.5))
                    .cornerRadius(4)
            }
        }
        .padding(.horizontal, ArcDesign.Spacing.lg)
        .padding(.vertical, ArcDesign.Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                .fill(isSelected ? ArcDesign.Colors.accentBlue.opacity(0.1) : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                .stroke(isSelected ? ArcDesign.Colors.accentBlue.opacity(0.3) : Color.clear, lineWidth: 1)
        )
        .animation(ArcDesign.Animation.quick, value: isSelected)
    }
    
    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: ArcDesign.Spacing.lg) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 40))
                .foregroundColor(ArcDesign.Colors.tertiaryText)
            
            Text("No results found")
                .font(ArcDesign.Typography.headline)
                .foregroundColor(ArcDesign.Colors.secondaryText)
            
            Text("Try a different search term or browse by category")
                .font(ArcDesign.Typography.callout)
                .foregroundColor(ArcDesign.Colors.tertiaryText)
                .multilineTextAlignment(.center)
        }
        .padding(ArcDesign.Spacing.xxxl)
    }
    
    // MARK: - Keyboard Hint
    private func keyboardHint(_ key: String, _ description: String) -> some View {
        HStack(spacing: ArcDesign.Spacing.xs) {
            Text(key)
                .font(ArcDesign.Typography.caption)
                .foregroundColor(ArcDesign.Colors.primaryText)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(ArcDesign.Colors.tertiaryBackground.opacity(0.7))
                .cornerRadius(4)
            
            Text(description)
                .font(ArcDesign.Typography.caption)
                .foregroundColor(ArcDesign.Colors.secondaryText)
        }
    }
    
    // MARK: - Actions
    private func moveSelection(_ direction: Int) {
        let newIndex = selectedIndex + direction
        selectedIndex = max(0, min(newIndex, viewModel.filteredCommands.count - 1))
    }
    
    private func executeSelectedCommand() {
        guard selectedIndex < viewModel.filteredCommands.count else { return }
        let command = viewModel.filteredCommands[selectedIndex]
        viewModel.executeCommand(command, appState: appState)
        onDismiss()
    }
}

// MARK: - Command Palette View Model
@MainActor
class CommandPaletteViewModel: ObservableObject {
    @Published var searchText: String = ""
    @Published var filteredCommands: [CommandItem] = []
    @Published var groupedCommands: [CommandCategory: [CommandItem]] = [:]
    @Published var isVisible: Bool = false
    
    private var allCommands: [CommandItem] = []
    
    func setupCommands(appState: AppState) {
        allCommands = generateCommands(appState: appState)
        performSearch(query: "")
    }
    
    func performSearch(query: String) {
        if query.isEmpty {
            filteredCommands = allCommands
        } else {
            filteredCommands = fuzzySearch(query: query.lowercased())
        }
        
        groupCommands()
    }
    
    private func fuzzySearch(query: String) -> [CommandItem] {
        let results = allCommands.compactMap { command -> CommandItem? in
            let score = calculateFuzzyScore(text: command.title.lowercased(), query: query)
            let subtitleScore = command.subtitle?.lowercased().fuzzyScore(query: query) ?? 0.0
            let maxScore = max(score, subtitleScore)
            
            if maxScore > 0.3 {
                return CommandItem(
                    title: command.title,
                    subtitle: command.subtitle,
                    icon: command.icon,
                    category: command.category,
                    action: command.action,
                    shortcut: command.shortcut,
                    score: maxScore
                )
            }
            return nil
        }
        
        return results.sorted { $0.score > $1.score }
    }
    
    private func calculateFuzzyScore(text: String, query: String) -> Double {
        return text.fuzzyScore(query: query)
    }
    
    private func groupCommands() {
        groupedCommands = Dictionary(grouping: filteredCommands) { $0.category }
    }
    
    func getGlobalIndex(for command: CommandItem) -> Int {
        return filteredCommands.firstIndex(where: { $0.id == command.id }) ?? 0
    }
    
    func executeCommand(_ command: CommandItem, appState: AppState) {
        switch command.action {
        case .createNewChat:
            _ = appState.createNewChat()
        case .openSettings:
            appState.showSettings = true
        case .openDebugPanel:
            appState.toggleDebugPanel()
        case .selectChat(let chat):
            appState.selectChat(chat)
        case .selectAgent(let agent):
            appState.activateAgent(agent)
        case .openAgentSelector:
            appState.showAgentSelector = true
        case .openConversationWindow:
            appState.openConversationWindow()
        case .openAgentActivityWindow:
            appState.openAgentActivityWindow()
        case .openMLXWindow:
            appState.openMLXWindow()
        case .openVisionWindow:
            appState.openVisionWindow()
        case .openABMCTSWindow:
            appState.openABMCTSWindow()
        case .openMALTSwarmWindow:
            appState.openMALTSwarmWindow()
        case .openSystemMonitorWindow:
            appState.openSystemMonitorWindow()
        case .toggleSidebar:
            appState.sidebarVisible.toggle()
        case .switchViewMode(let mode):
            appState.viewMode = mode
        case .connectToBackend:
            Task { await appState.connectToBackend() }
        case .disconnectFromBackend:
            appState.disconnectFromBackend()
        case .selectModel(let model):
            appState.setSelectedModel(model)
        case .toggleDebugPanel:
            appState.toggleDebugPanel()
        case .clearError:
            appState.clearError()
        case .showNotification(let message, let type):
            appState.showNotification(message: message, type: type)
        case .custom(_, let action):
            action()
        }
    }
    
    private func generateCommands(appState: AppState) -> [CommandItem] {
        var commands: [CommandItem] = []
        
        // Recent actions
        commands.append(CommandItem(
            title: "New Chat",
            subtitle: "Start a new conversation",
            icon: "plus.message",
            category: .recent,
            action: .createNewChat,
            shortcut: "⌘N"
        ))
        
        // Navigation commands
        commands.append(contentsOf: [
            CommandItem(
                title: "Open Settings",
                subtitle: "Configure application preferences",
                icon: "gear",
                category: .navigation,
                action: .openSettings,
                shortcut: "⌘,"
            ),
            CommandItem(
                title: "Toggle Sidebar",
                subtitle: "Show or hide the sidebar",
                icon: "sidebar.left",
                category: .navigation,
                action: .toggleSidebar,
                shortcut: "⌘⇧S"
            ),
            CommandItem(
                title: "Toggle Debug Panel",
                subtitle: "Show or hide debug information",
                icon: "ladybug",
                category: .navigation,
                action: .toggleDebugPanel,
                shortcut: "⌘D"
            )
        ])
        
        // Action commands
        commands.append(contentsOf: [
            CommandItem(
                title: "Connect to Backend",
                subtitle: "Establish connection to AI services",
                icon: "link",
                category: .actions,
                action: .connectToBackend
            ),
            CommandItem(
                title: "Open Agent Selector",
                subtitle: "Choose and manage AI agents",
                icon: "person.3",
                category: .actions,
                action: .openAgentSelector
            ),
            CommandItem(
                title: "Clear Error",
                subtitle: "Dismiss current error message",
                icon: "xmark.circle",
                category: .actions,
                action: .clearError
            )
        ])
        
        // Window commands
        commands.append(contentsOf: [
            CommandItem(
                title: "Conversation Window",
                subtitle: "Open dedicated chat interface",
                icon: "message",
                category: .navigation,
                action: .openConversationWindow
            ),
            CommandItem(
                title: "Agent Activity",
                subtitle: "Monitor agent performance",
                icon: "chart.line.uptrend.xyaxis",
                category: .navigation,
                action: .openAgentActivityWindow
            ),
            CommandItem(
                title: "MLX Fine-tuning",
                subtitle: "Train models locally",
                icon: "brain.head.profile",
                category: .tools,
                action: .openMLXWindow
            ),
            CommandItem(
                title: "Vision Processing",
                subtitle: "Image and video analysis",
                icon: "eye",
                category: .tools,
                action: .openVisionWindow
            ),
            CommandItem(
                title: "AB-MCTS Dashboard",
                subtitle: "Monte Carlo Tree Search",
                icon: "tree",
                category: .tools,
                action: .openABMCTSWindow
            ),
            CommandItem(
                title: "MALT Swarm Control",
                subtitle: "Multi-agent coordination",
                icon: "network",
                category: .tools,
                action: .openMALTSwarmWindow
            ),
            CommandItem(
                title: "System Monitor",
                subtitle: "Performance and resource usage",
                icon: "speedometer",
                category: .navigation,
                action: .openSystemMonitorWindow
            )
        ])
        
        // Chat commands
        for chat in appState.chats.prefix(10) {
            commands.append(CommandItem(
                title: chat.title,
                subtitle: "Last updated: \(formatDate(chat.updatedAt))",
                icon: "message.fill",
                category: .chats,
                action: .selectChat(chat)
            ))
        }
        
        // Agent commands
        for agent in appState.availableAgents.prefix(10) {
            commands.append(CommandItem(
                title: agent.name,
                subtitle: agent.description,
                icon: agent.type.icon,
                category: .agents,
                action: .selectAgent(agent)
            ))
        }
        
        // Model selection commands
        for model in appState.availableModels.prefix(8) {
            commands.append(CommandItem(
                title: "Switch to \(model)",
                subtitle: "Change the active AI model",
                icon: "cpu",
                category: .actions,
                action: .selectModel(model)
            ))
        }
        
        // View mode commands
        for mode in ViewMode.allCases {
            commands.append(CommandItem(
                title: "Switch to \(mode.displayName)",
                subtitle: "Change interface layout",
                icon: mode.icon,
                category: .actions,
                action: .switchViewMode(mode)
            ))
        }
        
        return commands
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Fuzzy Search Extension
extension String {
    func fuzzyScore(query: String) -> Double {
        guard !query.isEmpty else { return 1.0 }
        guard !self.isEmpty else { return 0.0 }
        
        let text = self.lowercased()
        let pattern = query.lowercased()
        
        // Exact match gets highest score
        if text == pattern {
            return 1.0
        }
        
        // Contains match
        if text.contains(pattern) {
            return 0.8
        }
        
        // Calculate fuzzy match score
        var score = 0.0
        var textIndex = text.startIndex
        var patternIndex = pattern.startIndex
        var matchCount = 0
        
        while textIndex < text.endIndex && patternIndex < pattern.endIndex {
            if text[textIndex] == pattern[patternIndex] {
                matchCount += 1
                patternIndex = pattern.index(after: patternIndex)
            }
            textIndex = text.index(after: textIndex)
        }
        
        if matchCount == pattern.count {
            score = Double(matchCount) / Double(text.count)
            return min(score * 0.7, 0.7) // Cap fuzzy matches at 0.7
        }
        
        return 0.0
    }
}