import SwiftUI
import Combine

/// Global command palette for quick navigation and action execution
struct CommandPaletteView: View {
    @ObservedObject var navigationService: EnhancedNavigationService
    @ObservedObject var appState: AppState
    @Environment(\.dismiss) private var dismiss
    
    @State private var searchText = ""
    @State private var filteredCommands: [CommandPaletteItem] = []
    @State private var selectedIndex = 0
    @State private var isLoading = false
    @FocusState private var searchFieldFocused: Bool
    
    // Categories filter
    @State private var selectedCategory: CommandPaletteItem.CommandCategory?
    
    private let maxResults = 20
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            commandPaletteHeader
            
            // Search input
            searchInput
            
            // Category filters
            if searchText.isEmpty {
                categoryFilters
            }
            
            Divider()
                .background(AppTheme.separator)
            
            // Results
            commandResults
            
            // Footer with help
            commandPaletteFooter
        }
        .background(AppTheme.popupBackground)
        .cornerRadius(12)
        .shadow(color: AppTheme.heavyShadow, radius: 20, x: 0, y: 10)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(AppTheme.popupBorder, lineWidth: 1)
        )
        .onAppear {
            setupInitialCommands()
            searchFieldFocused = true
        }
        .onChange(of: searchText) { newValue in
            filterCommands(newValue)
        }
        .onReceive(keyboardEvents) { event in
            handleKeyboardEvent(event)
        }
    }
    
    // MARK: - Header
    private var commandPaletteHeader: some View {
        HStack {
            Image(systemName: "command")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(AppTheme.accentBlue)
            
            Text("Command Palette")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(AppTheme.primaryText)
            
            Spacer()
            
            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .frame(width: 20, height: 20)
                    .background(
                        Circle()
                            .fill(AppTheme.sidebarItemHover)
                    )
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }
    
    // MARK: - Search Input
    private var searchInput: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(AppTheme.tertiaryText)
            
            TextField("Search for features, commands, or actions...", text: $searchText)
                .focused($searchFieldFocused)
                .textFieldStyle(PlainTextFieldStyle())
                .font(.system(size: 16))
                .foregroundColor(AppTheme.primaryText)
                .onSubmit {
                    executeSelectedCommand()
                }
            
            if isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle())
                    .scaleEffect(0.8)
            } else if !searchText.isEmpty {
                Button(action: { 
                    searchText = ""
                    selectedIndex = 0
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(AppTheme.tertiaryText)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(AppTheme.inputBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.inputBorder, lineWidth: 1)
                )
        )
        .padding(.horizontal, 20)
        .padding(.bottom, 16)
    }
    
    // MARK: - Category Filters
    private var categoryFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                // All categories button
                CategoryFilterButton(
                    title: "All",
                    icon: "list.bullet",
                    isSelected: selectedCategory == nil,
                    action: { selectedCategory = nil }
                )
                
                ForEach(CommandPaletteItem.CommandCategory.allCases, id: \.self) { category in
                    CategoryFilterButton(
                        title: category.displayName,
                        icon: category.icon,
                        isSelected: selectedCategory == category,
                        action: { selectedCategory = category }
                    )
                }
            }
            .padding(.horizontal, 20)
        }
        .padding(.bottom, 8)
    }
    
    // MARK: - Command Results
    private var commandResults: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if filteredCommands.isEmpty && !isLoading {
                        emptyState
                    } else {
                        ForEach(Array(filteredCommands.enumerated()), id: \.element.id) { index, command in
                            CommandResultRow(
                                command: command,
                                isSelected: index == selectedIndex,
                                onSelected: {
                                    selectedIndex = index
                                    executeCommand(command)
                                }
                            )
                            .id(index)
                        }
                    }
                }
                .padding(.vertical, 8)
            }
            .onChange(of: selectedIndex) { newIndex in
                withAnimation(.easeInOut(duration: 0.2)) {
                    proxy.scrollTo(newIndex, anchor: .center)
                }
            }
        }
        .frame(maxHeight: 400)
    }
    
    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: searchText.isEmpty ? "command" : "magnifyingglass")
                .font(.system(size: 32))
                .foregroundColor(AppTheme.tertiaryText)
            
            Text(searchText.isEmpty ? "Type to search for commands" : "No commands found")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(AppTheme.secondaryText)
            
            if !searchText.isEmpty {
                Text("Try different keywords or check the categories")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.tertiaryText)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
    
    // MARK: - Footer
    private var commandPaletteFooter: some View {
        HStack(spacing: 16) {
            KeyboardShortcutHint(keys: ["↑", "↓"], description: "Navigate")
            KeyboardShortcutHint(keys: ["⏎"], description: "Execute")
            KeyboardShortcutHint(keys: ["⌘K"], description: "Focus search")
            KeyboardShortcutHint(keys: ["Esc"], description: "Close")
            
            Spacer()
            
            Text("\(filteredCommands.count) commands")
                .font(.system(size: 11))
                .foregroundColor(AppTheme.tertiaryText)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(AppTheme.tertiaryBackground.opacity(0.5))
    }
    
    // MARK: - Helper Methods
    private func setupInitialCommands() {
        filteredCommands = generateCommands()
    }
    
    private func filterCommands(_ searchQuery: String) {
        isLoading = true
        selectedIndex = 0
        
        // Debounce search
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            let allCommands = generateCommands()
            
            if searchQuery.isEmpty {
                if let category = selectedCategory {
                    filteredCommands = allCommands.filter { $0.category == category }
                } else {
                    filteredCommands = allCommands
                }
            } else {
                let lowercaseQuery = searchQuery.lowercased()
                filteredCommands = allCommands.filter { command in
                    command.title.lowercased().contains(lowercaseQuery) ||
                    command.subtitle?.lowercased().contains(lowercaseQuery) == true ||
                    command.searchKeywords.contains { $0.lowercased().contains(lowercaseQuery) }
                }.sorted { command1, command2 in
                    // Prioritize exact title matches
                    let title1Match = command1.title.lowercased().hasPrefix(lowercaseQuery)
                    let title2Match = command2.title.lowercased().hasPrefix(lowercaseQuery)
                    
                    if title1Match && !title2Match { return true }
                    if !title1Match && title2Match { return false }
                    
                    // Then by category priority
                    let categoryOrder: [CommandPaletteItem.CommandCategory] = [.recent, .navigation, .action, .window, .tool, .setting]
                    let index1 = categoryOrder.firstIndex(of: command1.category) ?? Int.max
                    let index2 = categoryOrder.firstIndex(of: command2.category) ?? Int.max
                    
                    return index1 < index2
                }
                
                // Limit results
                if filteredCommands.count > maxResults {
                    filteredCommands = Array(filteredCommands.prefix(maxResults))
                }
            }
            
            isLoading = false
        }
    }
    
    private func generateCommands() -> [CommandPaletteItem] {
        var commands: [CommandPaletteItem] = []
        
        // Recent commands
        for feature in navigationService.recentlyUsedFeatures.prefix(5) {
            commands.append(CommandPaletteItem(
                id: "recent_\(feature.id)",
                title: feature.title,
                subtitle: "Recently used",
                icon: feature.icon,
                category: .recent,
                shortcut: feature.shortcutKey,
                action: {
                    navigationService.executeNavigationAction(feature.action, appState: appState)
                    dismiss()
                },
                searchKeywords: feature.keywords
            ))
        }
        
        // Navigation commands from features
        for feature in navigationService.navigationFeatures {
            commands.append(CommandPaletteItem(
                id: "nav_\(feature.id)",
                title: feature.title,
                subtitle: feature.description,
                icon: feature.icon,
                category: .navigation,
                shortcut: feature.shortcutKey,
                action: {
                    navigationService.executeNavigationAction(feature.action, appState: appState)
                    dismiss()
                },
                searchKeywords: feature.keywords
            ))
        }
        
        // Action commands
        let actionCommands = [
            CommandPaletteItem(
                id: "new_chat",
                title: "New Chat",
                subtitle: "Start a new AI conversation",
                icon: "plus.message",
                category: .action,
                shortcut: "⌘N",
                action: {
                    appState.createNewChat()
                    dismiss()
                },
                searchKeywords: ["chat", "new", "conversation", "create"]
            ),
            CommandPaletteItem(
                id: "global_search",
                title: "Global Search",
                subtitle: "Search across all content",
                icon: "magnifyingglass",
                category: .action,
                shortcut: "⌘F",
                action: {
                    appState.showGlobalSearch = true
                    dismiss()
                },
                searchKeywords: ["search", "find", "global"]
            ),
            CommandPaletteItem(
                id: "toggle_sidebar",
                title: "Toggle Sidebar",
                subtitle: "Show or hide the navigation sidebar",
                icon: "sidebar.left",
                category: .action,
                shortcut: "⌘⌥S",
                action: {
                    appState.sidebarVisible.toggle()
                    dismiss()
                },
                searchKeywords: ["sidebar", "toggle", "navigation", "hide", "show"]
            )
        ]
        commands.append(contentsOf: actionCommands)
        
        // Window commands
        let windowCommands = [
            CommandPaletteItem(
                id: "agent_activity_window",
                title: "Agent Activity",
                subtitle: "Open agent monitoring window",
                icon: "network",
                category: .window,
                shortcut: "⌘⌥1",
                action: {
                    appState.openAgentActivityWindow()
                    dismiss()
                },
                searchKeywords: ["agent", "activity", "monitor", "window"]
            ),
            CommandPaletteItem(
                id: "system_monitor_window",
                title: "System Monitor",
                subtitle: "Open system monitoring window",
                icon: "gauge.high",
                category: .window,
                action: {
                    appState.openSystemMonitorWindow()
                    dismiss()
                },
                searchKeywords: ["system", "monitor", "performance", "window"]
            )
        ]
        commands.append(contentsOf: windowCommands)
        
        // Settings commands
        let settingCommands = [
            CommandPaletteItem(
                id: "preferences",
                title: "Preferences",
                subtitle: "Open application preferences",
                icon: "gear",
                category: .setting,
                shortcut: "⌘,",
                action: {
                    appState.showSettings = true
                    dismiss()
                },
                searchKeywords: ["preferences", "settings", "configuration"]
            ),
            CommandPaletteItem(
                id: "navigation_settings",
                title: "Navigation Settings",
                subtitle: "Configure navigation preferences",
                icon: "sidebar.squares.left",
                category: .setting,
                action: {
                    // Show navigation settings
                    dismiss()
                },
                searchKeywords: ["navigation", "sidebar", "settings", "preferences"]
            )
        ]
        commands.append(contentsOf: settingCommands)
        
        return commands.sorted { $0.category.rawValue < $1.category.rawValue }
    }
    
    private func executeSelectedCommand() {
        guard selectedIndex < filteredCommands.count else { return }
        executeCommand(filteredCommands[selectedIndex])
    }
    
    private func executeCommand(_ command: CommandPaletteItem) {
        command.action()
        
        // Add to recent if it's not already a recent command
        if command.category != .recent {
            // Track usage for suggestions
            // This would be implemented in the navigation service
        }
    }
    
    private func handleKeyboardEvent(_ event: KeyboardEvent) {
        switch event {
        case .arrowUp:
            selectedIndex = max(0, selectedIndex - 1)
        case .arrowDown:
            selectedIndex = min(filteredCommands.count - 1, selectedIndex + 1)
        case .enter:
            executeSelectedCommand()
        case .escape:
            dismiss()
        case .commandK:
            searchFieldFocused = true
        }
    }
    
    // Mock keyboard events - in real implementation, this would be handled by a keyboard monitor
    private var keyboardEvents: PassthroughSubject<KeyboardEvent, Never> {
        PassthroughSubject()
    }
    
    private enum KeyboardEvent {
        case arrowUp, arrowDown, enter, escape, commandK
    }
}

// MARK: - Command Result Row
struct CommandResultRow: View {
    let command: CommandPaletteItem
    let isSelected: Bool
    let onSelected: () -> Void
    
    var body: some View {
        Button(action: onSelected) {
            HStack(spacing: 12) {
                // Category indicator
                Rectangle()
                    .fill(command.category == .recent ? AppTheme.accentGreen : AppTheme.accentBlue)
                    .frame(width: 3, height: 40)
                    .opacity(isSelected ? 1.0 : 0.3)
                
                // Command icon
                Image(systemName: command.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(isSelected ? AppTheme.primaryText : AppTheme.secondaryText)
                    .frame(width: 24, height: 24)
                
                // Command info
                VStack(alignment: .leading, spacing: 2) {
                    Text(command.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(isSelected ? AppTheme.primaryText : AppTheme.secondaryText)
                        .lineLimit(1)
                    
                    if let subtitle = command.subtitle {
                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.tertiaryText)
                            .lineLimit(1)
                    }
                }
                
                Spacer()
                
                // Category badge
                Text(command.category.displayName.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(AppTheme.tertiaryText)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(AppTheme.sidebarItemHover)
                    )
                
                // Keyboard shortcut
                if let shortcut = command.shortcut {
                    Text(shortcut)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(AppTheme.tertiaryText)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: 4)
                                .fill(AppTheme.sidebarItemHover)
                        )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .background(
            Rectangle()
                .fill(isSelected ? AppTheme.sidebarItemSelected : Color.clear)
                .animation(.easeInOut(duration: 0.1), value: isSelected)
        )
    }
}

// MARK: - Category Filter Button
struct CategoryFilterButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(isSelected ? AppTheme.primaryText : AppTheme.tertiaryText)
                
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(isSelected ? AppTheme.primaryText : AppTheme.tertiaryText)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(isSelected ? AppTheme.accentBlue.opacity(0.2) : AppTheme.sidebarItemHover)
                    .overlay(
                        Capsule()
                            .stroke(isSelected ? AppTheme.accentBlue : Color.clear, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Keyboard Shortcut Hint
struct KeyboardShortcutHint: View {
    let keys: [String]
    let description: String
    
    var body: some View {
        HStack(spacing: 4) {
            HStack(spacing: 2) {
                ForEach(keys, id: \.self) { key in
                    Text(key)
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(AppTheme.tertiaryText)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: 3)
                                .fill(AppTheme.sidebarItemHover)
                        )
                }
            }
            
            Text(description)
                .font(.system(size: 10))
                .foregroundColor(AppTheme.tertiaryText)
        }
    }
}