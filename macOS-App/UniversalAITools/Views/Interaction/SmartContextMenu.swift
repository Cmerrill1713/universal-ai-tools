//
//  SmartContextMenu.swift
//  UniversalAITools
//
//  Context-aware right-click menus with dynamic items, nested structures,
//  keyboard shortcuts, and intelligent action suggestions
//

import SwiftUI
import AppKit

// MARK: - Menu Item Types
enum MenuItemType {
    case action
    case submenu
    case separator
    case header
    case custom
}

// MARK: - Menu Item
struct SmartMenuItem: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String?
    let icon: String?
    let type: MenuItemType
    let action: (() -> Void)?
    let keyboardShortcut: ContextMenuKeyboardShortcut?
    let isEnabled: Bool
    let isVisible: Bool
    let badge: String?
    let submenuItems: [SmartMenuItem]?
    let customView: AnyView?
    
    init(title: String, subtitle: String? = nil, icon: String? = nil, type: MenuItemType = .action,
         action: (() -> Void)? = nil, keyboardShortcut: ContextMenuKeyboardShortcut? = nil,
         isEnabled: Bool = true, isVisible: Bool = true, badge: String? = nil,
         submenuItems: [SmartMenuItem]? = nil, customView: AnyView? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.type = type
        self.action = action
        self.keyboardShortcut = keyboardShortcut
        self.isEnabled = isEnabled
        self.isVisible = isVisible
        self.badge = badge
        self.submenuItems = submenuItems
        self.customView = customView
    }
}

// MARK: - Context Menu Keyboard Shortcut
struct ContextMenuKeyboardShortcut {
    let key: String
    let modifiers: EventModifiers
    
    var displayString: String {
        var parts: [String] = []
        
        if modifiers.contains(.command) { parts.append("⌘") }
        if modifiers.contains(.option) { parts.append("⌥") }
        if modifiers.contains(.control) { parts.append("⌃") }
        if modifiers.contains(.shift) { parts.append("⇧") }
        
        parts.append(key.uppercased())
        return parts.joined()
    }
}

// MARK: - Context Information
struct ContextInformation {
    let selectedItems: [Any]
    let hoveredItem: Any?
    let viewType: String
    let applicationState: [String: Any]
    let recentActions: [String]
    let userPreferences: [String: Any]
    
    var selectionCount: Int {
        selectedItems.count
    }
    
    var hasSelection: Bool {
        !selectedItems.isEmpty
    }
    
    var isMultiSelection: Bool {
        selectedItems.count > 1
    }
}

// MARK: - Menu Provider Protocol
protocol SmartMenuProvider {
    func menuItems(for context: ContextInformation) -> [SmartMenuItem]
    func priority() -> Int
    func canHandle(context: ContextInformation) -> Bool
}

// MARK: - Smart Context Menu
struct SmartContextMenu: View {
    let context: ContextInformation
    let position: CGPoint
    let onDismiss: () -> Void
    
    @StateObject private var menuEngine = MenuEngine()
    @StateObject private var recentActions = RecentActionsManager()
    @StateObject private var searchController = MenuSearchController()
    
    @State private var menuItems: [SmartMenuItem] = []
    @State private var searchText: String = ""
    @State private var showSearch: Bool = false
    @State private var hoveredItemId: UUID?
    @State private var submenuPosition: CGPoint = .zero
    @State private var showSubmenu: Bool = false
    @State private var currentSubmenuItems: [SmartMenuItem] = []
    
    var body: some View {
        VStack(spacing: 0) {
            // Search bar (shown when activated)
            if showSearch {
                searchBar
            }
            
            // Menu items
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(filteredMenuItems) { item in
                        menuItemView(item)
                    }
                }
            }
            .frame(maxHeight: 400)
            
            // Recent actions (if no search and space available)
            if !showSearch && searchText.isEmpty && !recentActions.recentActions.isEmpty {
                Divider()
                recentActionsSection
            }
        }
        .frame(minWidth: 200, maxWidth: 300)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.controlBackgroundColor))
                .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 2)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(.separatorColor), lineWidth: 0.5)
        )
        .onAppear {
            loadMenuItems()
        }
        .onExitCommand {
            onDismiss()
        }
    }
    
    // MARK: - Search Bar
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
                .font(.caption)
            
            TextField("Search actions...", text: $searchText)
                .textFieldStyle(PlainTextFieldStyle())
                .font(.caption)
                .onSubmit {
                    executeFirstFilteredAction()
                }
            
            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                        .font(.caption)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(8)
        .background(Color(.controlColor))
    }
    
    // MARK: - Menu Item View
    private func menuItemView(_ item: SmartMenuItem) -> some View {
        Group {
            switch item.type {
            case .separator:
                Divider()
                    .padding(.vertical, 4)
                
            case .header:
                headerView(item)
                
            case .custom:
                if let customView = item.customView {
                    customView
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                }
                
            default:
                actionItemView(item)
            }
        }
    }
    
    private func headerView(_ item: SmartMenuItem) -> some View {
        HStack {
            if let icon = item.icon {
                Image(systemName: icon)
                    .foregroundColor(.secondary)
                    .font(.caption)
            }
            
            Text(item.title)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
            
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(.controlColor))
    }
    
    private func actionItemView(_ item: SmartMenuItem) -> some View {
        Button(action: {
            executeAction(item)
        }) {
            HStack(spacing: 8) {
                // Icon
                if let icon = item.icon {
                    Image(systemName: icon)
                        .foregroundColor(item.isEnabled ? .primary : .secondary)
                        .font(.system(size: 14))
                        .frame(width: 16, height: 16)
                } else {
                    Spacer()
                        .frame(width: 16, height: 16)
                }
                
                // Title and subtitle
                VStack(alignment: .leading, spacing: 1) {
                    Text(item.title)
                        .font(.system(size: 13))
                        .foregroundColor(item.isEnabled ? .primary : .secondary)
                    
                    if let subtitle = item.subtitle {
                        Text(subtitle)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                // Badge
                if let badge = item.badge {
                    Text(badge)
                        .font(.caption2)
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.blue)
                        .cornerRadius(3)
                }
                
                // Keyboard shortcut
                if let shortcut = item.keyboardShortcut {
                    Text(shortcut.displayString)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color(.controlColor))
                        .cornerRadius(3)
                }
                
                // Submenu indicator
                if item.type == .submenu {
                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                        .font(.caption2)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(hoveredItemId == item.id ? Color(.selectedControlColor) : Color.clear)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(!item.isEnabled)
        .onHover { hovering in
            hoveredItemId = hovering ? item.id : nil
            
            if hovering && item.type == .submenu, let submenuItems = item.submenuItems {
                showSubmenuFor(item, items: submenuItems)
            } else if !hovering && showSubmenu {
                hideSubmenu()
            }
        }
    }
    
    // MARK: - Recent Actions Section
    private var recentActionsSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Recent Actions")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            
            ForEach(recentActions.recentActions.prefix(3), id: \.self) { action in
                recentActionView(action)
            }
        }
        .padding(.bottom, 8)
    }
    
    private func recentActionView(_ action: String) -> some View {
        Button(action: {
            recentActions.executeRecentAction(action)
            onDismiss()
        }) {
            HStack {
                Image(systemName: "clock")
                    .foregroundColor(.secondary)
                    .font(.caption)
                    .frame(width: 16)
                
                Text(action)
                    .font(.caption)
                    .foregroundColor(.primary)
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.clear)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            // Add hover effect for recent actions
        }
    }
    
    // MARK: - Computed Properties
    private var filteredMenuItems: [SmartMenuItem] {
        guard !searchText.isEmpty else { return menuItems }
        
        return searchController.filterItems(menuItems, searchText: searchText)
    }
    
    // MARK: - Methods
    private func loadMenuItems() {
        menuItems = menuEngine.generateMenuItems(for: context)
    }
    
    private func executeAction(_ item: SmartMenuItem) {
        if let action = item.action {
            action()
            recentActions.addAction(item.title)
        }
        onDismiss()
    }
    
    private func executeFirstFilteredAction() {
        if let firstItem = filteredMenuItems.first, firstItem.isEnabled {
            executeAction(firstItem)
        }
    }
    
    private func showSubmenuFor(_ item: SmartMenuItem, items: [SmartMenuItem]) {
        currentSubmenuItems = items
        showSubmenu = true
        // Calculate submenu position relative to the item
    }
    
    private func hideSubmenu() {
        showSubmenu = false
        currentSubmenuItems = []
    }
}

// MARK: - Menu Engine
@MainActor
class MenuEngine: ObservableObject {
    private var providers: [SmartMenuProvider] = []
    
    init() {
        setupDefaultProviders()
    }
    
    func generateMenuItems(for context: ContextInformation) -> [SmartMenuItem] {
        var allItems: [SmartMenuItem] = []
        
        // Get items from all providers
        let sortedProviders = providers.filter { $0.canHandle(context: context) }
                                      .sorted { $0.priority() > $1.priority() }
        
        for provider in sortedProviders {
            let items = provider.menuItems(for: context)
            if !items.isEmpty {
                if !allItems.isEmpty {
                    allItems.append(SmartMenuItem(title: "", type: .separator))
                }
                allItems.append(contentsOf: items)
            }
        }
        
        // Add smart suggestions
        let suggestions = generateSmartSuggestions(for: context)
        if !suggestions.isEmpty {
            allItems.append(SmartMenuItem(title: "", type: .separator))
            allItems.append(SmartMenuItem(title: "Suggestions", type: .header))
            allItems.append(contentsOf: suggestions)
        }
        
        return allItems
    }
    
    private func setupDefaultProviders() {
        providers = [
            GraphNodeMenuProvider(),
            SelectionMenuProvider(),
            ClipboardMenuProvider(),
            NavigationMenuProvider(),
            ToolsMenuProvider(),
            DeveloperMenuProvider()
        ]
    }
    
    private func generateSmartSuggestions(for context: ContextInformation) -> [SmartMenuItem] {
        var suggestions: [SmartMenuItem] = []
        
        // AI-powered suggestions based on context
        if context.hasSelection {
            suggestions.append(SmartMenuItem(
                title: "Analyze Selection",
                subtitle: "AI-powered analysis",
                icon: "brain.head.profile",
                action: { /* AI analysis */ }
            ))
        }
        
        if context.recentActions.contains("copy") {
            suggestions.append(SmartMenuItem(
                title: "Smart Paste",
                subtitle: "Intelligent paste operation",
                icon: "doc.on.clipboard",
                action: { /* Smart paste */ }
            ))
        }
        
        return suggestions
    }
}

// MARK: - Menu Providers

struct GraphNodeMenuProvider: SmartMenuProvider {
    func menuItems(for context: ContextInformation) -> [SmartMenuItem] {
        guard context.viewType == "graph" else { return [] }
        
        var items: [SmartMenuItem] = []
        
        if context.hasSelection {
            items.append(SmartMenuItem(
                title: "Expand Node",
                icon: "plus.circle",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "E", modifiers: .command),
                action: { /* Expand node */ }
            ))
            
            items.append(SmartMenuItem(
                title: "Hide Node",
                icon: "eye.slash",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "H", modifiers: .command),
                action: { /* Hide node */ }
            ))
            
            items.append(SmartMenuItem(
                title: "Focus on Node",
                icon: "scope",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "F", modifiers: .command),
                action: { /* Focus on node */ }
            ))
        }
        
        items.append(SmartMenuItem(
            title: "Layout Options",
            icon: "rectangle.3.group",
            type: .submenu,
            submenuItems: [
                SmartMenuItem(title: "Force Layout", icon: "arrow.up.and.down.and.arrow.left.and.right", action: { /* Force layout */ }),
                SmartMenuItem(title: "Hierarchical", icon: "list.bullet.indent", action: { /* Hierarchical layout */ }),
                SmartMenuItem(title: "Circular", icon: "circle", action: { /* Circular layout */ }),
                SmartMenuItem(title: "Grid", icon: "grid", action: { /* Grid layout */ })
            ]
        ))
        
        return items
    }
    
    func priority() -> Int { return 100 }
    
    func canHandle(context: ContextInformation) -> Bool {
        return context.viewType == "graph"
    }
}

struct SelectionMenuProvider: SmartMenuProvider {
    func menuItems(for context: ContextInformation) -> [SmartMenuItem] {
        guard context.hasSelection else { return [] }
        
        var items: [SmartMenuItem] = []
        
        items.append(SmartMenuItem(
            title: "Copy",
            icon: "doc.on.doc",
            keyboardShortcut: ContextMenuKeyboardShortcut(key: "C", modifiers: .command),
            action: { /* Copy */ }
        ))
        
        items.append(SmartMenuItem(
            title: "Cut",
            icon: "scissors",
            keyboardShortcut: ContextMenuKeyboardShortcut(key: "X", modifiers: .command),
            action: { /* Cut */ }
        ))
        
        items.append(SmartMenuItem(
            title: "Delete",
            icon: "trash",
            keyboardShortcut: ContextMenuKeyboardShortcut(key: "Delete", modifiers: []),
            action: { /* Delete */ }
        ))
        
        if context.isMultiSelection {
            items.append(SmartMenuItem(
                title: "Group Selection",
                subtitle: "\(context.selectionCount) items",
                icon: "rectangle.3.group",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "G", modifiers: .command),
                action: { /* Group */ }
            ))
        }
        
        return items
    }
    
    func priority() -> Int { return 90 }
    
    func canHandle(context: ContextInformation) -> Bool {
        return context.hasSelection
    }
}

struct ClipboardMenuProvider: SmartMenuProvider {
    func menuItems(for context: ContextInformation) -> [SmartMenuItem] {
        var items: [SmartMenuItem] = []
        
        // Check if clipboard has content
        if NSPasteboard.general.string(forType: .string) != nil {
            items.append(SmartMenuItem(
                title: "Paste",
                icon: "doc.on.clipboard",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "V", modifiers: .command),
                action: { /* Paste */ }
            ))
            
            items.append(SmartMenuItem(
                title: "Paste Special",
                icon: "doc.on.clipboard.fill",
                type: .submenu,
                submenuItems: [
                    SmartMenuItem(title: "Paste as Text", action: { /* Paste as text */ }),
                    SmartMenuItem(title: "Paste as Link", action: { /* Paste as link */ }),
                    SmartMenuItem(title: "Paste and Match Style", action: { /* Paste and match */ })
                ]
            ))
        }
        
        return items
    }
    
    func priority() -> Int { return 70 }
    
    func canHandle(context: ContextInformation) -> Bool {
        return true
    }
}

struct NavigationMenuProvider: SmartMenuProvider {
    func menuItems(for context: ContextInformation) -> [SmartMenuItem] {
        return [
            SmartMenuItem(
                title: "Go Back",
                icon: "chevron.left",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "[", modifiers: .command),
                action: { /* Go back */ }
            ),
            
            SmartMenuItem(
                title: "Go Forward",
                icon: "chevron.right",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "]", modifiers: .command),
                action: { /* Go forward */ }
            ),
            
            SmartMenuItem(
                title: "Refresh",
                icon: "arrow.clockwise",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "R", modifiers: .command),
                action: { /* Refresh */ }
            )
        ]
    }
    
    func priority() -> Int { return 60 }
    
    func canHandle(context: ContextInformation) -> Bool {
        return true
    }
}

struct ToolsMenuProvider: SmartMenuProvider {
    func menuItems(for context: ContextInformation) -> [SmartMenuItem] {
        return [
            SmartMenuItem(
                title: "Tools",
                type: .header
            ),
            
            SmartMenuItem(
                title: "Search",
                icon: "magnifyingglass",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "F", modifiers: .command),
                action: { /* Search */ }
            ),
            
            SmartMenuItem(
                title: "Quick Actions",
                icon: "bolt",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "K", modifiers: .command),
                action: { /* Quick actions */ }
            ),
            
            SmartMenuItem(
                title: "Preferences",
                icon: "gearshape",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: ",", modifiers: .command),
                action: { /* Preferences */ }
            )
        ]
    }
    
    func priority() -> Int { return 50 }
    
    func canHandle(context: ContextInformation) -> Bool {
        return true
    }
}

struct DeveloperMenuProvider: SmartMenuProvider {
    func menuItems(for context: ContextInformation) -> [SmartMenuItem] {
        // Only show developer tools in debug builds or if developer mode is enabled
        guard isDebugMode() || isDeveloperModeEnabled() else { return [] }
        
        return [
            SmartMenuItem(
                title: "Developer",
                type: .header
            ),
            
            SmartMenuItem(
                title: "Inspect Element",
                icon: "magnifyingglass.circle",
                action: { /* Inspect */ }
            ),
            
            SmartMenuItem(
                title: "Console",
                icon: "terminal",
                keyboardShortcut: ContextMenuKeyboardShortcut(key: "J", modifiers: [.command, .option]),
                action: { /* Console */ }
            ),
            
            SmartMenuItem(
                title: "Performance Monitor",
                icon: "speedometer",
                action: { /* Performance monitor */ }
            )
        ]
    }
    
    func priority() -> Int { return 10 }
    
    func canHandle(context: ContextInformation) -> Bool {
        return isDebugMode() || isDeveloperModeEnabled()
    }
    
    private func isDebugMode() -> Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
    
    private func isDeveloperModeEnabled() -> Bool {
        return UserDefaults.standard.bool(forKey: "developerMode")
    }
}

// MARK: - Supporting Classes

@MainActor
class RecentActionsManager: ObservableObject {
    @Published var recentActions: [String] = []
    
    private let maxRecentActions = 10
    
    func addAction(_ action: String) {
        // Remove if already exists
        recentActions.removeAll { $0 == action }
        
        // Add to beginning
        recentActions.insert(action, at: 0)
        
        // Limit size
        if recentActions.count > maxRecentActions {
            recentActions.removeLast()
        }
    }
    
    func executeRecentAction(_ action: String) {
        // Move to top of recent actions
        addAction(action)
        
        // Execute the action (would need action registry)
        print("Executing recent action: \(action)")
    }
}

@MainActor
class MenuSearchController: ObservableObject {
    func filterItems(_ items: [SmartMenuItem], searchText: String) -> [SmartMenuItem] {
        let lowercasedSearch = searchText.lowercased()
        
        return items.compactMap { item in
            if item.type == .separator || item.type == .header {
                return nil
            }
            
            // Check title match
            if item.title.lowercased().contains(lowercasedSearch) {
                return item
            }
            
            // Check subtitle match
            if let subtitle = item.subtitle, subtitle.lowercased().contains(lowercasedSearch) {
                return item
            }
            
            // Check keyboard shortcut match
            if let shortcut = item.keyboardShortcut,
               shortcut.key.lowercased().contains(lowercasedSearch) {
                return item
            }
            
            return nil
        }
    }
}

// MARK: - Context Menu Modifier
extension View {
    func smartContextMenu(context: ContextInformation, at position: CGPoint? = nil) -> some View {
        self.overlay(
            SmartContextMenuOverlay(context: context, position: position)
        )
    }
}

struct SmartContextMenuOverlay: View {
    let context: ContextInformation
    let position: CGPoint?
    
    @State private var showMenu = false
    @State private var menuPosition: CGPoint = .zero
    
    var body: some View {
        Color.clear
            .contentShape(Rectangle())
            .onTapGesture(count: 2) {
                // Handle double-click
            }
            .onTapGesture { _ in
                // Handle single click
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onEnded { value in
                        if value.translation == .zero {
                            // Right-click simulation (could use actual right-click detection)
                            menuPosition = position ?? value.location
                            showMenu = true
                        }
                    }
            )
            .overlay(
                Group {
                    if showMenu {
                        SmartContextMenu(
                            context: context,
                            position: menuPosition,
                            onDismiss: { showMenu = false }
                        )
                        .position(menuPosition)
                        .zIndex(1000)
                    }
                }
            )
    }
}