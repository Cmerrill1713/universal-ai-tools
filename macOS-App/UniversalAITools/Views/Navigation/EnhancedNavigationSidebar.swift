import SwiftUI
import Combine

/// Enhanced navigation sidebar with progressive disclosure and feature discovery
struct EnhancedNavigationSidebar: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var navigationService = EnhancedNavigationService()
    
    @State private var searchText = ""
    @State private var expandedSections: Set<String> = []
    @State private var hoveredFeature: String?
    @State private var showFeatureDiscovery = false
    @State private var showCommandPalette = false
    @State private var selectedFeature: NavigationFeature?
    
    // Animation state
    @State private var animateGradient = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            sidebarHeader
            
            // Search bar
            searchBar
            
            Divider()
                .background(AppTheme.separator)
            
            // Content area
            if searchText.isEmpty {
                mainNavigationContent
            } else {
                searchResultsContent
            }
            
            Divider()
                .background(AppTheme.separator)
            
            // Bottom actions
            bottomActions
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            ZStack {
                AppTheme.sidebarBackground
                
                // Subtle animated gradient overlay
                if !navigationService.preferences.compactMode {
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
        .onAppear {
            setupInitialState()
        }
    }
    
    // MARK: - Header
    private var sidebarHeader: some View {
        HStack(spacing: 12) {
            // App icon with glow effect
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
                    .frame(width: 40, height: 40)
                
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(AppTheme.accentBlue)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Universal AI")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText)
                
                if !navigationService.preferences.compactMode {
                    Text("Enhanced Navigation")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(AppTheme.tertiaryText)
                        .opacity(0.8)
                }
            }
            
            Spacer()
            
            // Action buttons
            HStack(spacing: 8) {
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
                
                // Settings button
                NavigationActionButton(
                    icon: "gear",
                    tooltip: "Navigation Settings",
                    action: { 
                        navigationService.preferences.compactMode.toggle()
                    }
                )
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 0)
                .fill(AppTheme.sidebarBackground.opacity(0.8))
        )
    }
    
    // MARK: - Search Bar
    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(AppTheme.tertiaryText)
            
            TextField("Search features...", text: $searchText)
                .textFieldStyle(PlainTextFieldStyle())
                .font(.system(size: 13))
                .foregroundColor(AppTheme.primaryText)
                .onSubmit {
                    if !searchText.isEmpty {
                        navigationService.searchFeatures(searchText)
                    }
                }
            
            if !searchText.isEmpty {
                Button(action: { 
                    searchText = ""
                    navigationService.searchResults = []
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.tertiaryText)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            if navigationService.isSearching {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle())
                    .scaleEffect(0.6)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(AppTheme.inputBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(AppTheme.inputBorder, lineWidth: 1)
                )
        )
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .onChange(of: searchText) { newValue in
            navigationService.searchFeatures(newValue)
        }
    }
    
    // MARK: - Main Navigation Content
    private var mainNavigationContent: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Smart suggestions
                if navigationService.preferences.enableSmartSuggestions && !navigationService.smartSuggestions.isEmpty {
                    smartSuggestionsSection
                }
                
                // Recently used features
                if navigationService.preferences.showRecentlyUsed && !navigationService.recentlyUsedFeatures.isEmpty {
                    recentFeaturesSection
                }
                
                // Navigation sections
                ForEach(navigationService.navigationSections) { section in
                    NavigationSectionView(
                        section: section,
                        isExpanded: expandedSections.contains(section.id),
                        preferences: navigationService.preferences,
                        hoveredFeature: hoveredFeature,
                        onToggleExpansion: { toggleSectionExpansion(section.id) },
                        onFeatureSelected: { feature in
                            selectFeature(feature)
                        },
                        onFeatureHover: { featureId in
                            hoveredFeature = featureId
                        }
                    )
                }
                
                // Bottom padding
                Rectangle()
                    .fill(Color.clear)
                    .frame(height: 20)
            }
            .padding(.vertical, 8)
        }
    }
    
    // MARK: - Search Results Content
    private var searchResultsContent: some View {
        ScrollView {
            LazyVStack(spacing: 4) {
                if navigationService.searchResults.isEmpty && !navigationService.isSearching {
                    // Empty state
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 24))
                            .foregroundColor(AppTheme.tertiaryText)
                        
                        Text("No results found")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(AppTheme.secondaryText)
                        
                        Text("Try different keywords")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                } else {
                    ForEach(navigationService.searchResults) { feature in
                        NavigationFeatureRow(
                            feature: feature,
                            preferences: navigationService.preferences,
                            isHovered: hoveredFeature == feature.id,
                            onSelected: { selectFeature(feature) },
                            onHover: { hoveredFeature = feature.id },
                            onHoverEnd: { hoveredFeature = nil }
                        )
                        .padding(.horizontal, 16)
                    }
                }
            }
            .padding(.vertical, 8)
        }
    }
    
    // MARK: - Smart Suggestions Section
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
            
            ForEach(Array(navigationService.smartSuggestions.prefix(3))) { suggestion in
                SmartSuggestionRow(
                    suggestion: suggestion,
                    preferences: navigationService.preferences,
                    onSelected: { selectFeature(suggestion.feature) }
                )
                .padding(.horizontal, 16)
            }
        }
        .padding(.vertical, 8)
    }
    
    // MARK: - Recent Features Section
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
                    onSelected: { selectFeature(feature) },
                    onHover: { hoveredFeature = feature.id },
                    onHoverEnd: { hoveredFeature = nil }
                )
                .padding(.horizontal, 16)
            }
        }
        .padding(.vertical, 8)
    }
    
    // MARK: - Bottom Actions
    private var bottomActions: some View {
        VStack(spacing: 8) {
            // User profile
            HStack {
                // User avatar
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
                
                if !navigationService.preferences.compactMode {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(NSFullUserName())
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(AppTheme.primaryText)
                            .lineLimit(1)
                        
                        Text("Premium Plan") // TODO: Get from app state
                            .font(.system(size: 11))
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                }
                
                Spacer()
                
                // Settings button
                Button(action: { appState.showSettings = true }) {
                    Image(systemName: "gear")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.tertiaryText)
                }
                .buttonStyle(PlainButtonStyle())
                .help("Settings")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(AppTheme.surfaceBackground.opacity(0.5))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
            )
            .padding(.horizontal, 12)
        }
        .padding(.vertical, 12)
    }
    
    // MARK: - Helper Methods
    private func setupInitialState() {
        // Set initial expanded sections based on preferences
        if navigationService.preferences.autoExpandSections {
            expandedSections = Set(navigationService.navigationSections
                .filter { $0.defaultExpanded }
                .map { $0.id })
        }
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
    
    private func selectFeature(_ feature: NavigationFeature) {
        selectedFeature = feature
        
        // Record usage
        navigationService.recordFeatureUsage(feature.id)
        
        // Execute navigation action
        navigationService.executeNavigationAction(feature.action, appState: appState)
        
        // Clear search if active
        if !searchText.isEmpty {
            searchText = ""
            navigationService.searchResults = []
        }
        
        // Haptic feedback
        let impactFeedback = NSHapticFeedbackManager.defaultPerformer
        impactFeedback.perform(.alignment, performanceTime: .default)
    }
}

// MARK: - Navigation Action Button
struct NavigationActionButton: View {
    let icon: String
    let tooltip: String
    let action: () -> Void
    var badge: Int? = nil
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            ZStack {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(isHovered ? AppTheme.primaryText : AppTheme.secondaryText)
                    .frame(width: 24, height: 24)
                
                if let badge = badge, badge > 0 {
                    VStack {
                        HStack {
                            Spacer()
                            Text("\(badge)")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(
                                    Capsule()
                                        .fill(Color.red)
                                )
                                .offset(x: 6, y: -6)
                        }
                        Spacer()
                    }
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isHovered ? AppTheme.sidebarItemHover : Color.clear)
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
        .help(tooltip)
    }
}