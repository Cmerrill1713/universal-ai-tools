import SwiftUI
import Combine

// MARK: - Enhanced Modern Sidebar with Feature Discovery
struct ModernSidebar: View {
    @Binding var selection: SidebarItem?
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    @StateObject private var navigationService = EnhancedNavigationService()
    @State private var searchText = ""
    @State private var showNewChatMenu = false
    @State private var hoveredConversation: String?
    @State private var editingConversation: String?
    @State private var editingTitle = ""
    @State private var showFeatureDiscovery = false
    @State private var showCommandPalette = false
    @State private var expandedSections: Set<String> = ["core", "ai"]
    @State private var hoveredFeature: String?
    @State private var navigationMode: NavigationMode = .enhanced
    @State private var showOnboardingTour = false
    
    // Animation state
    @State private var animateGradient = false
    
    enum NavigationMode {
        case simple, enhanced, expert
        
        var displayName: String {
            switch self {
            case .simple: return "Simple"
            case .enhanced: return "Enhanced"
            case .expert: return "Expert"
            }
        }
    }
    
    // Grouped conversations by date
    private var groupedConversations: [(String, [Chat])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: appState.chatHistory) { chat in
            let components = calendar.dateComponents([.year, .month, .day], from: chat.updatedAt)
            if calendar.isDateInToday(chat.updatedAt) {
                return "Today"
            } else if calendar.isDateInYesterday(chat.updatedAt) {
                return "Yesterday"
            } else if let date = calendar.date(from: components),
                      calendar.dateComponents([.weekOfYear], from: date, to: Date()).weekOfYear == 0 {
                return "This Week"
            } else if let date = calendar.date(from: components),
                      calendar.dateComponents([.month], from: date, to: Date()).month == 0 {
                return "This Month"
            } else {
                return "Older"
            }
        }

        let order = ["Today", "Yesterday", "This Week", "This Month", "Older"]
        return order.compactMap { key in
            if let chats = grouped[key] {
                return (key, chats.sorted { $0.updatedAt > $1.updatedAt })
            }
            return nil
        }
    }

    // Filtered conversations based on search
    private var filteredConversations: [(String, [Chat])] {
        if searchText.isEmpty {
            return groupedConversations
        } else {
            return groupedConversations.compactMap { group, chats in
                let filtered = chats.filter { chat in
                    chat.title.localizedCaseInsensitiveContains(searchText) ||
                    chat.messages.contains { $0.content.localizedCaseInsensitiveContains(searchText) }
                }
                return filtered.isEmpty ? nil : (group, filtered)
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Enhanced header with navigation mode toggle
            enhancedSidebarHeader

            // Smart search bar with feature discovery
            enhancedSearchBar

            Divider()
                .background(AppTheme.separator)

            // Main content based on navigation mode
            mainContent

            Divider()
                .background(AppTheme.separator)

            // Enhanced bottom actions with user context
            enhancedBottomActions
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            ZStack {
                AppTheme.sidebarBackground
                
                // Subtle animated gradient for enhanced mode
                if navigationMode == .enhanced {
                    LinearGradient(
                        colors: [
                            Color.blue.opacity(0.02),
                            Color.purple.opacity(0.01),
                            Color.clear
                        ],
                        startPoint: animateGradient ? .topLeading : .bottomTrailing,
                        endPoint: animateGradient ? .bottomTrailing : .topLeading
                    )
                    .onAppear {
                        withAnimation(.easeInOut(duration: 4.0).repeatForever(autoreverses: true)) {
                            animateGradient.toggle()
                        }
                    }
                }
            }
        )
        .sheet(isPresented: $showFeatureDiscovery) {
            FeatureDiscoveryPanel(navigationService: navigationService)
                .frame(width: 600, height: 500)
        }
        .sheet(isPresented: $showCommandPalette) {
            CommandPaletteView(navigationService: navigationService, appState: appState)
                .frame(width: 600, height: 400)
        }
        .sheet(isPresented: $showOnboardingTour) {
            OnboardingFlow {
                showOnboardingTour = false
                appState.completeOnboarding()
            }
            .frame(width: 800, height: 600)
        }
        .onAppear {
            setupNavigationService()
            checkForFirstTimeUser()
        }
    }

    // MARK: - Enhanced Header
    private var enhancedSidebarHeader: some View {
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                // Enhanced app icon with glow effect
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    AppTheme.accentBlue.opacity(0.3),
                                    AppTheme.accentBlue.opacity(0.1),
                                    Color.clear
                                ],
                                center: .center,
                                startRadius: 5,
                                endRadius: 20
                            )
                        )
                        .frame(width: 36, height: 36)
                    
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(AppTheme.accentBlue)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Universal AI")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(navigationMode.displayName + " Mode")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(AppTheme.tertiaryText)
                        .opacity(0.8)
                }

                Spacer()

                // Action buttons
                HStack(spacing: 6) {
                    // Command palette button
                    NavigationActionButton(
                        icon: "command",
                        tooltip: "Command Palette (⌘K)",
                        action: { showCommandPalette = true }
                    )
                    
                    // Feature discovery button
                    NavigationActionButton(
                        icon: "lightbulb.fill",
                        tooltip: "Discover Features",
                        action: { showFeatureDiscovery = true },
                        badge: navigationService.availableTours.filter { !$0.isCompleted }.count
                    )
                    
                    // Navigation mode toggle
                    Menu {
                        ForEach([NavigationMode.simple, .enhanced, .expert], id: \.self) { mode in
                            Button(mode.displayName) {
                                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                                    navigationMode = mode
                                }
                            }
                        }
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.secondaryText)
                            .frame(width: 24, height: 24)
                    }
                    .menuStyle(BorderlessButtonMenuStyle())
                    .help("Navigation Mode")
                }
            }
            
            // Smart navigation hints
            if navigationMode == .enhanced && !navigationService.smartSuggestions.isEmpty {
                SmartNavigationHint(suggestions: Array(navigationService.smartSuggestions.prefix(1)))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 0)
                .fill(AppTheme.sidebarBackground.opacity(0.8))
        )
    }

    // MARK: - Enhanced Search Bar
    private var enhancedSearchBar: some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: searchText.isEmpty ? "magnifyingglass" : "magnifyingglass.circle.fill")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(searchText.isEmpty ? AppTheme.tertiaryText : AppTheme.accentBlue)
                    .animation(.easeInOut(duration: 0.2), value: searchText.isEmpty)

                TextField(placeholderText, text: $searchText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(.system(size: 13))
                    .foregroundColor(AppTheme.primaryText)
                    .onSubmit {
                        handleSearchSubmit()
                    }

                if !searchText.isEmpty {
                    Button(action: clearSearch) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .transition(.scale.combined(with: .opacity))
                }
                
                if navigationService.isSearching {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                        .scaleEffect(0.6)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(AppTheme.inputBackground)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(searchText.isEmpty ? AppTheme.inputBorder : AppTheme.accentBlue.opacity(0.5), lineWidth: 1)
                    )
            )
            .animation(.easeInOut(duration: 0.2), value: searchText.isEmpty)
            
            // Quick action pills
            if navigationMode != .simple && searchText.isEmpty {
                quickActionPills
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .onChange(of: searchText) { newValue in
            handleSearchChange(newValue)
        }
    }
    
    private var placeholderText: String {
        switch navigationMode {
        case .simple:
            return "Search conversations..."
        case .enhanced:
            return "Search features, conversations..."
        case .expert:
            return "Search everything (⌘F)"
        }
    }
    
    private var quickActionPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                QuickActionPill(title: "New Chat", icon: "plus.message", action: { showNewChatMenu = true })
                QuickActionPill(title: "Analytics", icon: "chart.bar", action: { selectFeature("analytics") })
                QuickActionPill(title: "Agents", icon: "network", action: { selectFeature("orchestration") })
                if navigationMode == .expert {
                    QuickActionPill(title: "Knowledge", icon: "brain", action: { selectFeature("knowledge") })
                    QuickActionPill(title: "Tools", icon: "wrench", action: { selectFeature("tools") })
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Main Content
    @ViewBuilder
    private var mainContent: some View {
        switch navigationMode {
        case .simple:
            simpleConversationsList
        case .enhanced:
            enhancedNavigationContent
        case .expert:
            expertNavigationContent
        }
    }
    
    // Simple mode - just conversations
    private var simpleConversationsList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: .sectionHeaders) {
                    ForEach(filteredConversations, id: \.0) { group, chats in
                        Section(header: sectionHeader(group)) {
                            ForEach(chats) { chat in
                                ConversationRow(
                                    chat: chat,
                                    isSelected: appState.currentChat?.id == chat.id,
                                    isHovered: hoveredConversation == chat.id,
                                    isEditing: editingConversation == chat.id,
                                    editingTitle: $editingTitle,
                                    onSelect: { selectChat(chat) },
                                    onDelete: { deleteChat(chat) },
                                    onRename: { startRenaming(chat) },
                                    onCommitRename: { commitRename(chat) },
                                    onDuplicate: { duplicateChat(chat) }
                                )
                                .onHover { hovering in
                                    withAnimation(.easeInOut(duration: 0.15)) {
                                        hoveredConversation = hovering ? chat.id : nil
                                    }
                                }
                                .id(chat.id)
                            }
                        }
                    }

                    if filteredConversations.isEmpty {
                        emptyState
                    }
                }
                .padding(.vertical, 8)
            }
            .onChange(of: appState.currentChat?.id) { chatId in
                if let id = chatId {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        proxy.scrollTo(id, anchor: .center)
                    }
                }
            }
        }
        .popover(isPresented: $showNewChatMenu) {
            NewChatMenu(onSelect: startNewChat)
                .frame(width: 220, height: 280)
        }
    }
    
    // Enhanced mode - features + conversations
    private var enhancedNavigationContent: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if searchText.isEmpty {
                    // Smart suggestions
                    if !navigationService.smartSuggestions.isEmpty {
                        smartSuggestionsSection
                    }
                    
                    // Recently used features
                    if !navigationService.recentlyUsedFeatures.isEmpty {
                        recentFeaturesSection
                    }
                    
                    // Navigation sections
                    ForEach(navigationService.navigationSections.filter { shouldShowSection($0) }) { section in
                        NavigationSectionView(
                            section: section,
                            isExpanded: expandedSections.contains(section.id),
                            preferences: navigationService.preferences,
                            hoveredFeature: hoveredFeature,
                            onToggleExpansion: { toggleSectionExpansion(section.id) },
                            onFeatureSelected: { feature in
                                selectNavigationFeature(feature)
                            },
                            onFeatureHover: { featureId in
                                hoveredFeature = featureId
                            }
                        )
                    }
                    
                    // Conversations section
                    if !appState.chatHistory.isEmpty {
                        conversationsSection
                    }
                } else {
                    searchResultsContent
                }
                
                Rectangle()
                    .fill(Color.clear)
                    .frame(height: 20)
            }
            .padding(.vertical, 8)
        }
    }
    
    // Expert mode - all features with advanced controls
    private var expertNavigationContent: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if searchText.isEmpty {
                    // Expert quick actions
                    expertQuickActions
                    
                    // All navigation sections
                    ForEach(navigationService.navigationSections) { section in
                        NavigationSectionView(
                            section: section,
                            isExpanded: expandedSections.contains(section.id),
                            preferences: navigationService.preferences,
                            hoveredFeature: hoveredFeature,
                            onToggleExpansion: { toggleSectionExpansion(section.id) },
                            onFeatureSelected: { feature in
                                selectNavigationFeature(feature)
                            },
                            onFeatureHover: { featureId in
                                hoveredFeature = featureId
                            }
                        )
                    }
                } else {
                    searchResultsContent
                }
                
                Rectangle()
                    .fill(Color.clear)
                    .frame(height: 20)
            }
            .padding(.vertical, 8)
        }
    }

    // MARK: - Enhanced Bottom Actions
    private var enhancedBottomActions: some View {
        VStack(spacing: 8) {
            // User profile with enhanced info
            Button(action: { appState.showSettings = true }) {
                HStack(spacing: 12) {
                    // Enhanced user avatar
                    Circle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    AppTheme.accentOrange,
                                    AppTheme.accentOrange.opacity(0.8)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 32, height: 32)
                        .overlay(
                            Text(String(NSFullUserName().prefix(1).uppercased()))
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white)
                        )
                        .overlay(
                            Circle()
                                .stroke(AppTheme.accentBlue.opacity(0.3), lineWidth: 2)
                                .scaleEffect(1.2)
                                .opacity(0.6)
                        )

                    if navigationMode != .simple {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(NSFullUserName())
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(AppTheme.primaryText)
                                .lineLimit(1)

                            HStack(spacing: 4) {
                                Text("Premium Plan")
                                    .font(.system(size: 10))
                                    .foregroundColor(AppTheme.tertiaryText)
                                
                                Circle()
                                    .fill(AppTheme.accentGreen)
                                    .frame(width: 4, height: 4)
                                
                                Text("\(navigationService.recentlyUsedFeatures.count) recent")
                                    .font(.system(size: 9))
                                    .foregroundColor(AppTheme.tertiaryText)
                            }
                        }
                    }

                    Spacer()

                    VStack(spacing: 2) {
                        Image(systemName: "gear")
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.tertiaryText)
                        
                        if navigationMode == .expert {
                            Image(systemName: "chevron.up")
                                .font(.system(size: 8))
                                .foregroundColor(AppTheme.tertiaryText)
                                .opacity(0.6)
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(AppTheme.surfaceBackground.opacity(0.5))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(AppTheme.borderColor.opacity(0.5), lineWidth: 1)
                    )
            )
            .shadow(color: AppTheme.lightShadow, radius: 2, x: 0, y: 1)
            
            // Navigation mode indicator
            if navigationMode != .simple {
                HStack {
                    Text("\(navigationService.navigationFeatures.count) features available")
                        .font(.system(size: 9))
                        .foregroundColor(AppTheme.tertiaryText)
                    
                    Spacer()
                    
                    Button("Tour") {
                        showOnboardingTour = true
                    }
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(AppTheme.accentBlue)
                    .buttonStyle(PlainButtonStyle())
                }
                .padding(.horizontal, 12)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
    }

    // MARK: - Section Header
    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(AppTheme.tertiaryText)
                .textCase(.uppercase)

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(AppTheme.sidebarBackground.opacity(0.95))
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: searchText.isEmpty ? "message.and.waveform" : "magnifyingglass")
                .font(.system(size: 32))
                .foregroundColor(AppTheme.tertiaryText)

            Text(searchText.isEmpty ? "Ready to start" : "No results found")
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(AppTheme.secondaryText)

            if searchText.isEmpty {
                VStack(spacing: 8) {
                    Text("Create your first conversation or explore advanced features")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.tertiaryText)
                        .multilineTextAlignment(.center)
                    
                    HStack(spacing: 12) {
                        Button("New Chat") {
                            showNewChatMenu = true
                        }
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(AppTheme.accentBlue)
                        .buttonStyle(PlainButtonStyle())
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(AppTheme.accentBlue.opacity(0.1))
                        )
                        
                        if navigationMode == .simple {
                            Button("Explore Features") {
                                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                                    navigationMode = .enhanced
                                }
                            }
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.accentOrange)
                            .buttonStyle(PlainButtonStyle())
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(AppTheme.accentOrange.opacity(0.1))
                            )
                        }
                    }
                }
            } else {
                Button("Clear search") {
                    clearSearch()
                }
                .font(.system(size: 11))
                .foregroundColor(AppTheme.accentBlue)
                .buttonStyle(PlainButtonStyle())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    // MARK: - Helper Methods
    
    private func setupNavigationService() {
        appState.enhancedNavigationService = navigationService
        
        // Set initial expanded sections for enhanced mode
        if navigationMode == .enhanced {
            expandedSections = Set(["core", "ai"])
        } else if navigationMode == .expert {
            expandedSections = Set(navigationService.navigationSections.map { $0.id })
        }
    }
    
    private func checkForFirstTimeUser() {
        if appState.isFirstTimeUser {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                showOnboardingTour = true
            }
        }
    }
    
    private func handleSearchChange(_ newValue: String) {
        if !newValue.isEmpty {
            navigationService.searchFeatures(newValue)
        } else {
            navigationService.searchResults = []
        }
    }
    
    private func handleSearchSubmit() {
        if !searchText.isEmpty && !navigationService.searchResults.isEmpty {
            selectNavigationFeature(navigationService.searchResults[0])
        }
    }
    
    private func clearSearch() {
        searchText = ""
        navigationService.searchResults = []
    }
    
    private func selectFeature(_ featureId: String) {
        if let feature = navigationService.navigationFeatures.first(where: { $0.id == featureId }) {
            selectNavigationFeature(feature)
        }
    }
    
    private func selectNavigationFeature(_ feature: NavigationFeature) {
        navigationService.recordFeatureUsage(feature.id)
        navigationService.executeNavigationAction(feature.action, appState: appState)
        
        // Clear search if active
        if !searchText.isEmpty {
            clearSearch()
        }
        
        // Haptic feedback
        let impactFeedback = NSHapticFeedbackManager.defaultPerformer
        impactFeedback.perform(.alignment, performanceTime: .default)
    }
    
    private func toggleSectionExpansion(_ sectionId: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            if expandedSections.contains(sectionId) {
                expandedSections.remove(sectionId)
            } else {
                expandedSections.insert(sectionId)
            }
        }
    }
    
    private func shouldShowSection(_ section: NavigationSection) -> Bool {
        switch navigationMode {
        case .simple:
            return false
        case .enhanced:
            return section.category == .core || section.category == .ai || section.category == .analytics
        case .expert:
            return true
        }
    }
    
    // MARK: - Chat Actions
    private func selectChat(_ chat: Chat) {
        appState.currentChat = chat
        selection = .chat
        navigationService.recordFeatureUsage("chat")
    }

    private func deleteChat(_ chat: Chat) {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chatHistory.removeAll { $0.id == chat.id }
            if appState.currentChat?.id == chat.id {
                appState.currentChat = nil
            }
        }
    }

    private func startRenaming(_ chat: Chat) {
        editingTitle = chat.title
        editingConversation = chat.id
    }

    private func commitRename(_ chat: Chat) {
        if !editingTitle.isEmpty {
            if let index = appState.chatHistory.firstIndex(where: { $0.id == chat.id }) {
                appState.chatHistory[index].title = editingTitle
                if appState.currentChat?.id == chat.id {
                    appState.currentChat?.title = editingTitle
                }
            }
        }
        editingConversation = nil
        editingTitle = ""
    }

    private func duplicateChat(_ chat: Chat) {
        let newChat = Chat(
            id: UUID().uuidString,
            title: "\(chat.title) (Copy)",
            model: chat.model,
            messages: chat.messages
        )

        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chatHistory.insert(newChat, at: 0)
            appState.currentChat = newChat
        }
    }

    private func startNewChat(with template: ChatTemplate) {
        let newChat = Chat(
            id: UUID().uuidString,
            title: template.title,
            model: template.defaultModel,
            messages: []
        )

        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            appState.chatHistory.insert(newChat, at: 0)
            appState.currentChat = newChat
            selection = .chat
        }

        showNewChatMenu = false
        navigationService.recordFeatureUsage("new_chat")
    }
}

// MARK: - Navigation Content Sections
extension ModernSidebar {
    // Smart suggestions section
    private var smartSuggestionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "lightbulb.fill")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.accentOrange)
                
                Text("SMART SUGGESTIONS")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .textCase(.uppercase)
                
                Spacer()
            }
            .padding(.horizontal, 16)
            
            ForEach(Array(navigationService.smartSuggestions.prefix(2))) { suggestion in
                SmartSuggestionRow(
                    suggestion: suggestion,
                    preferences: navigationService.preferences,
                    onSelected: { selectNavigationFeature(suggestion.feature) }
                )
                .padding(.horizontal, 16)
            }
        }
        .padding(.vertical, 8)
    }
    
    // Recent features section
    private var recentFeaturesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "clock.fill")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.accentBlue)
                
                Text("RECENTLY USED")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .textCase(.uppercase)
                
                Spacer()
            }
            .padding(.horizontal, 16)
            
            ForEach(Array(navigationService.recentlyUsedFeatures.prefix(3))) { feature in
                NavigationFeatureRow(
                    feature: feature,
                    preferences: navigationService.preferences,
                    isHovered: hoveredFeature == feature.id,
                    compact: true,
                    onSelected: { selectNavigationFeature(feature) },
                    onHover: { hoveredFeature = feature.id },
                    onHoverEnd: { hoveredFeature = nil }
                )
                .padding(.horizontal, 16)
            }
        }
        .padding(.vertical, 8)
    }
    
    // Conversations section for enhanced mode
    private var conversationsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(action: {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    if expandedSections.contains("conversations") {
                        expandedSections.remove("conversations")
                    } else {
                        expandedSections.insert("conversations")
                    }
                }
            }) {
                HStack {
                    Image(systemName: expandedSections.contains("conversations") ? "chevron.down" : "chevron.right")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(AppTheme.tertiaryText)
                        .rotationEffect(.degrees(expandedSections.contains("conversations") ? 0 : -90))
                        .animation(.spring(response: 0.3), value: expandedSections.contains("conversations"))
                    
                    Image(systemName: "text.bubble.fill")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.accentBlue)
                    
                    Text("CONVERSATIONS")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(AppTheme.tertiaryText)
                        .textCase(.uppercase)
                    
                    Spacer()
                    
                    Text("\(appState.chatHistory.count)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(AppTheme.accentBlue)
                        )
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PlainButtonStyle())
            .padding(.horizontal, 16)
            
            if expandedSections.contains("conversations") {
                ForEach(Array(appState.chatHistory.prefix(5))) { chat in
                    ConversationRow(
                        chat: chat,
                        isSelected: appState.currentChat?.id == chat.id,
                        isHovered: hoveredConversation == chat.id,
                        isEditing: editingConversation == chat.id,
                        editingTitle: $editingTitle,
                        onSelect: { selectChat(chat) },
                        onDelete: { deleteChat(chat) },
                        onRename: { startRenaming(chat) },
                        onCommitRename: { commitRename(chat) },
                        onDuplicate: { duplicateChat(chat) }
                    )
                    .onHover { hovering in
                        withAnimation(.easeInOut(duration: 0.15)) {
                            hoveredConversation = hovering ? chat.id : nil
                        }
                    }
                    .padding(.horizontal, 16)
                }
                
                if appState.chatHistory.count > 5 {
                    Button("View all \(appState.chatHistory.count) conversations") {
                        navigationMode = .simple
                    }
                    .font(.system(size: 11))
                    .foregroundColor(AppTheme.accentBlue)
                    .buttonStyle(PlainButtonStyle())
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    // Search results content
    private var searchResultsContent: some View {
        VStack(spacing: 4) {
            if navigationService.searchResults.isEmpty && !navigationService.isSearching {
                VStack(spacing: 12) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 24))
                        .foregroundColor(AppTheme.tertiaryText)
                    
                    Text("No results found")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Text("Try different keywords or explore features")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.tertiaryText)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
            } else {
                ForEach(navigationService.searchResults) { feature in
                    NavigationFeatureRow(
                        feature: feature,
                        preferences: navigationService.preferences,
                        isHovered: hoveredFeature == feature.id,
                        onSelected: { selectNavigationFeature(feature) },
                        onHover: { hoveredFeature = feature.id },
                        onHoverEnd: { hoveredFeature = nil }
                    )
                    .padding(.horizontal, 16)
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    // Expert quick actions
    private var expertQuickActions: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.accentOrange)
                
                Text("QUICK ACTIONS")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .textCase(.uppercase)
                
                Spacer()
            }
            .padding(.horizontal, 16)
            
            QuickActionsBar(navigationService: navigationService, appState: appState)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Supporting Views
struct SmartNavigationHint: View {
    let suggestions: [SmartSuggestion]
    
    var body: some View {
        if let suggestion = suggestions.first {
            HStack(spacing: 8) {
                Image(systemName: suggestion.reason.icon)
                    .font(.system(size: 10))
                    .foregroundColor(suggestion.feature.category.color)
                
                Text(suggestion.contextualHint ?? "Suggested for you")
                    .font(.system(size: 10))
                    .foregroundColor(AppTheme.tertiaryText)
                
                Spacer()
                
                Circle()
                    .fill(AppTheme.accentGreen)
                    .frame(width: 4, height: 4)
                    .opacity(0.8)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(suggestion.feature.category.color.opacity(0.1))
            )
        }
    }
}

struct QuickActionPill: View {
    let title: String
    let icon: String
    let action: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 9))
                    .foregroundColor(isHovered ? AppTheme.primaryText : AppTheme.secondaryText)
                
                Text(title)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(isHovered ? AppTheme.primaryText : AppTheme.secondaryText)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(isHovered ? AppTheme.sidebarItemHover : AppTheme.surfaceBackground.opacity(0.3))
            )
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}