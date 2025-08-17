import SwiftUI
import Pow

/// Enhanced navigation system with improved discoverability and search
struct EnhancedNavigationView: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""
    @State private var showingSearch = false
    @State private var selectedCategory: NavigationCategory = .all
    @State private var hoveredItem: NavigationItem?
    
    var body: some View {
        VStack(spacing: 0) {
            // Navigation header with search
            navigationHeader
            
            Divider()
            
            // Category filters
            categoryFilters
            
            Divider()
            
            // Navigation items list
            navigationItemsList
            
            Spacer()
            
            // Quick actions footer
            quickActionsFooter
        }
        .background(.ultraThinMaterial)
        .overlay(
            // Search overlay
            Group {
                if showingSearch {
                    searchOverlay
                        .zIndex(1000)
                }
            }
        )
    }
    
    // MARK: - Navigation Header
    
    private var navigationHeader: some View {
        HStack {
            Text("Universal AI Tools")
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(.primary)
            
            Spacer()
            
            // Search button
            Button(action: { 
                withAnimation(.spring()) {
                    showingSearch.toggle()
                }
            }) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .keyboardShortcut("k", modifiers: .command)
            .help("Search (⌘K)")
            
            // Settings button
            Button(action: { appState.showSettings = true }) {
                Image(systemName: "gearshape")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .help("Settings")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
    
    // MARK: - Category Filters
    
    private var categoryFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(NavigationCategory.allCases) { category in
                    CategoryFilterButton(
                        category: category,
                        isSelected: selectedCategory == category,
                        action: { selectedCategory = category }
                    )
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.vertical, 8)
    }
    
    // MARK: - Navigation Items List
    
    private var navigationItemsList: some View {
        ScrollView {
            LazyVStack(spacing: 4) {
                ForEach(filteredNavigationItems) { item in
                    EnhancedNavigationItemRow(
                        item: item,
                        isSelected: appState.selectedSidebarItem?.navigationItem?.id == item.id,
                        isHovered: hoveredItem?.id == item.id,
                        onSelect: { selectNavigationItem(item) }
                    )
                    .onHover { isHovered in
                        withAnimation(.easeInOut(duration: 0.2)) {
                            hoveredItem = isHovered ? item : nil
                        }
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
        }
    }
    
    // MARK: - Quick Actions Footer
    
    private var quickActionsFooter: some View {
        VStack(spacing: 8) {
            Divider()
            
            HStack(spacing: 12) {
                EnhancedUIComponents.EnhancedActionButton(
                    title: "New Chat",
                    icon: "plus.message",
                    action: { 
                        _ = appState.createNewChat()
                        appState.selectedSidebarItem = .chat
                    },
                    style: .primary
                )
                
                EnhancedUIComponents.EnhancedActionButton(
                    title: "Agent Activity",
                    icon: "brain.head.profile",
                    action: { appState.openAgentActivityWindow() },
                    style: .secondary
                )
            }
            
            // Connection status
            HStack {
                EnhancedUIComponents.AnimatedConnectionStatus(
                    status: appState.backendConnected ? .connected : .disconnected
                )
                
                Spacer()
                
                if appState.isLoading {
                    EnhancedUIComponents.EnhancedLoadingIndicator(
                        message: "Loading..."
                    )
                    .frame(width: 60, height: 30)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
    
    // MARK: - Search Overlay
    
    private var searchOverlay: some View {
        ZStack {
            // Background blur
            Color.black.opacity(0.3)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture { 
                    withAnimation(.spring()) {
                        showingSearch = false
                    }
                }
            
            // Search panel
            VStack(spacing: 0) {
                // Search input
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    
                    TextField("Search features, tools, and actions...", text: $searchText)
                        .textFieldStyle(.plain)
                        .font(.body)
                    
                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
                .background(.ultraThinMaterial)
                
                Divider()
                
                // Search results
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(searchResults) { result in
                            SearchResultRow(
                                result: result,
                                searchText: searchText,
                                onSelect: { 
                                    selectSearchResult(result)
                                    showingSearch = false
                                }
                            )
                        }
                        
                        if searchResults.isEmpty && !searchText.isEmpty {
                            Text("No results found")
                                .foregroundColor(.secondary)
                                .padding()
                        }
                    }
                    .padding(.vertical, 8)
                }
                .frame(maxHeight: 300)
            }
            .frame(width: 500)
            .background(.regularMaterial)
            .cornerRadius(12)
            .shadow(radius: 20)
            .conditionalEffect(.movingParts.bounce, condition: showingSearch)
        }
    }
    
    // MARK: - Computed Properties
    
    private var filteredNavigationItems: [NavigationItem] {
        let allItems = NavigationItem.allItems
        
        if selectedCategory == .all {
            return allItems
        }
        
        return allItems.filter { $0.category == selectedCategory }
    }
    
    private var searchResults: [SearchResult] {
        guard !searchText.isEmpty else { return [] }
        
        let navigationResults = NavigationItem.allItems
            .filter { item in
                item.title.localizedCaseInsensitiveContains(searchText) ||
                item.description.localizedCaseInsensitiveContains(searchText) ||
                item.keywords.contains { $0.localizedCaseInsensitiveContains(searchText) }
            }
            .map { SearchResult.navigationItem($0) }
        
        let actionResults = QuickAction.allActions
            .filter { action in
                action.title.localizedCaseInsensitiveContains(searchText) ||
                action.description.localizedCaseInsensitiveContains(searchText)
            }
            .map { SearchResult.quickAction($0) }
        
        return (navigationResults + actionResults).sorted { $0.relevanceScore(for: searchText) > $1.relevanceScore(for: searchText) }
    }
    
    // MARK: - Actions
    
    private func selectNavigationItem(_ item: NavigationItem) {
        withAnimation(.easeInOut(duration: 0.3)) {
            appState.selectedSidebarItem = item.sidebarItem
        }
        
        // Track navigation for analytics
        PerformanceOptimizer.shared.cacheObject(
            NSString(string: item.id),
            forKey: "last_selected_navigation_item"
        )
    }
    
    private func selectSearchResult(_ result: SearchResult) {
        switch result {
        case .navigationItem(let item):
            selectNavigationItem(item)
        case .quickAction(let action):
            action.perform(appState: appState)
        }
    }
}

// MARK: - Supporting Views

struct CategoryFilterButton: View {
    let category: NavigationCategory
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: category.icon)
                    .font(.system(size: 12, weight: .medium))
                
                Text(category.title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(isSelected ? .blue.opacity(0.2) : .clear)
            )
            .foregroundColor(isSelected ? .blue : .secondary)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? .blue : .clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

struct EnhancedNavigationItemRow: View {
    let item: NavigationItem
    let isSelected: Bool
    let isHovered: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                // Icon
                Image(systemName: item.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(item.iconColor)
                    .frame(width: 20)
                
                VStack(alignment: .leading, spacing: 2) {
                    // Title
                    Text(item.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.primary)
                    
                    // Description
                    Text(item.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                Spacer()
                
                // Status indicators
                HStack(spacing: 4) {
                    if item.isNew {
                        EnhancedUIComponents.EnhancedStatusBadge(
                            status: "New",
                            type: .success
                        )
                    }
                    
                    if item.isPro {
                        EnhancedUIComponents.EnhancedStatusBadge(
                            status: "Pro",
                            type: .active
                        )
                    }
                    
                    // Disclosure indicator
                    if isSelected || isHovered {
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .conditionalEffect(.movingParts.bounce, condition: isSelected)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? .blue.opacity(0.15) : (isHovered ? .gray.opacity(0.1) : .clear))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? .blue.opacity(0.3) : .clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
        .animation(.easeInOut(duration: 0.15), value: isHovered)
    }
}

struct SearchResultRow: View {
    let result: SearchResult
    let searchText: String
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Image(systemName: result.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(result.iconColor)
                    .frame(width: 20)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.primary)
                    
                    Text(result.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                Spacer()
                
                Text(result.category)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.gray.opacity(0.2))
                    .cornerRadius(4)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .background(.clear)
        .onHover { isHovered in
            // Add hover effect
        }
    }
}

// MARK: - Data Models

struct NavigationItem: Identifiable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let iconColor: Color
    let category: NavigationCategory
    let sidebarItem: SidebarItem
    let keywords: [String]
    let isNew: Bool
    let isPro: Bool
    
    static let allItems: [NavigationItem] = [
        NavigationItem(
            id: "chat",
            title: "AI Chat",
            description: "Interactive conversations with AI models",
            icon: "message",
            iconColor: .blue,
            category: .core,
            sidebarItem: .chat,
            keywords: ["conversation", "ai", "assistant", "talk"],
            isNew: false,
            isPro: false
        ),
        NavigationItem(
            id: "claude",
            title: "Claude AI",
            description: "Advanced conversations with Claude",
            icon: "brain.head.profile",
            iconColor: .purple,
            category: .core,
            sidebarItem: .claude,
            keywords: ["claude", "anthropic", "advanced", "ai"],
            isNew: true,
            isPro: true
        ),
        NavigationItem(
            id: "knowledge",
            title: "Knowledge Graph",
            description: "3D visualization of knowledge connections",
            icon: "point.3.connected.trianglepath.dotted",
            iconColor: .green,
            category: .visualization,
            sidebarItem: .knowledge,
            keywords: ["graph", "knowledge", "3d", "connections", "data"],
            isNew: false,
            isPro: false
        ),
        NavigationItem(
            id: "objectives",
            title: "Agent Management",
            description: "Manage AI agents and objectives",
            icon: "target",
            iconColor: .orange,
            category: .management,
            sidebarItem: .objectives,
            keywords: ["agents", "objectives", "management", "tasks"],
            isNew: false,
            isPro: false
        ),
        NavigationItem(
            id: "orchestration",
            title: "Agent Orchestration",
            description: "Coordinate multiple AI agents",
            icon: "brain.head.profile",
            iconColor: .red,
            category: .advanced,
            sidebarItem: .orchestration,
            keywords: ["orchestration", "coordination", "swarm", "multi-agent"],
            isNew: true,
            isPro: true
        ),
        NavigationItem(
            id: "analytics",
            title: "Context Analytics",
            description: "Performance and memory analytics",
            icon: "chart.bar.doc.horizontal",
            iconColor: .indigo,
            category: .analytics,
            sidebarItem: .analytics,
            keywords: ["analytics", "performance", "memory", "metrics"],
            isNew: false,
            isPro: false
        ),
        NavigationItem(
            id: "tools",
            title: "AI Tools",
            description: "Specialized AI-powered tools",
            icon: "wrench.and.screwdriver",
            iconColor: .teal,
            category: .tools,
            sidebarItem: .tools,
            keywords: ["tools", "utilities", "specialized", "ai"],
            isNew: false,
            isPro: false
        )
    ]
}

enum NavigationCategory: String, CaseIterable, Identifiable {
    case all = "all"
    case core = "core"
    case advanced = "advanced"
    case visualization = "visualization"
    case management = "management"
    case analytics = "analytics"
    case tools = "tools"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .all: return "All"
        case .core: return "Core"
        case .advanced: return "Advanced"
        case .visualization: return "Visualization"
        case .management: return "Management"
        case .analytics: return "Analytics"
        case .tools: return "Tools"
        }
    }
    
    var icon: String {
        switch self {
        case .all: return "square.grid.2x2"
        case .core: return "star"
        case .advanced: return "crown"
        case .visualization: return "eye"
        case .management: return "folder"
        case .analytics: return "chart.bar"
        case .tools: return "wrench"
        }
    }
}

enum SearchResult: Identifiable {
    case navigationItem(NavigationItem)
    case quickAction(QuickAction)
    
    var id: String {
        switch self {
        case .navigationItem(let item): return "nav_\(item.id)"
        case .quickAction(let action): return "action_\(action.id)"
        }
    }
    
    var title: String {
        switch self {
        case .navigationItem(let item): return item.title
        case .quickAction(let action): return action.title
        }
    }
    
    var description: String {
        switch self {
        case .navigationItem(let item): return item.description
        case .quickAction(let action): return action.description
        }
    }
    
    var icon: String {
        switch self {
        case .navigationItem(let item): return item.icon
        case .quickAction(let action): return action.icon
        }
    }
    
    var iconColor: Color {
        switch self {
        case .navigationItem(let item): return item.iconColor
        case .quickAction(let action): return action.iconColor
        }
    }
    
    var category: String {
        switch self {
        case .navigationItem(let item): return item.category.title
        case .quickAction(_): return "Action"
        }
    }
    
    func relevanceScore(for searchText: String) -> Double {
        let searchLower = searchText.lowercased()
        var score = 0.0
        
        // Title exact match
        if title.lowercased() == searchLower {
            score += 100
        } else if title.lowercased().hasPrefix(searchLower) {
            score += 50
        } else if title.lowercased().contains(searchLower) {
            score += 25
        }
        
        // Description match
        if description.lowercased().contains(searchLower) {
            score += 10
        }
        
        return score
    }
}

struct QuickAction: Identifiable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let iconColor: Color
    let perform: (AppState) -> Void
    
    static let allActions: [QuickAction] = [
        QuickAction(
            id: "new_chat",
            title: "New Chat",
            description: "Start a new AI conversation",
            icon: "plus.message",
            iconColor: .blue,
            perform: { appState in
                _ = appState.createNewChat()
                appState.selectedSidebarItem = .chat
            }
        ),
        QuickAction(
            id: "agent_activity",
            title: "Agent Activity",
            description: "View agent activity window",
            icon: "brain.head.profile",
            iconColor: .purple,
            perform: { appState in
                appState.openAgentActivityWindow()
            }
        ),
        QuickAction(
            id: "settings",
            title: "Settings",
            description: "Open application settings",
            icon: "gearshape",
            iconColor: .gray,
            perform: { appState in
                appState.showSettings = true
            }
        )
    ]
}

// MARK: - Extensions

extension SidebarItem {
    var navigationItem: NavigationItem? {
        return NavigationItem.allItems.first { $0.sidebarItem == self }
    }
}

#Preview {
    EnhancedNavigationView()
        .environmentObject(AppState())
        .frame(width: 300, height: 600)
}