import SwiftUI

/// Feature discovery panel with guided tours and feature exploration
struct FeatureDiscoveryPanel: View {
    @ObservedObject var navigationService: EnhancedNavigationService
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedTab: DiscoveryTab = .features
    @State private var selectedTour: GuidedTour?
    @State private var showTourDetail = false
    @State private var searchText = ""
    @State private var selectedCategory: FeatureCategory?
    
    enum DiscoveryTab: String, CaseIterable {
        case features = "Features"
        case tours = "Tours"
        case tips = "Tips"
        
        var icon: String {
            switch self {
            case .features: return "square.grid.2x2"
            case .tours: return "map"
            case .tips: return "lightbulb"
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            discoveryHeader
            
            // Tab navigation
            tabNavigation
            
            Divider()
                .background(AppTheme.separator)
            
            // Content area
            Group {
                switch selectedTab {
                case .features:
                    featuresDiscoveryView
                case .tours:
                    toursDiscoveryView
                case .tips:
                    tipsDiscoveryView
                }
            }
            
            // Footer
            discoveryFooter
        }
        .background(AppTheme.popupBackground)
        .cornerRadius(16)
        .shadow(color: AppTheme.heavyShadow, radius: 24, x: 0, y: 12)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(AppTheme.popupBorder, lineWidth: 1)
        )
        .sheet(isPresented: $showTourDetail) {
            if let tour = selectedTour {
                TourDetailView(tour: tour, navigationService: navigationService)
                    .frame(width: 500, height: 400)
            }
        }
    }
    
    // MARK: - Header
    private var discoveryHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Feature Discovery")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(AppTheme.primaryText)
                
                Text("Explore powerful features and learn new workflows")
                    .font(.system(size: 13))
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Spacer()
            
            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .frame(width: 24, height: 24)
                    .background(
                        Circle()
                            .fill(AppTheme.sidebarItemHover)
                    )
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 20)
    }
    
    // MARK: - Tab Navigation
    private var tabNavigation: some View {
        HStack(spacing: 0) {
            ForEach(DiscoveryTab.allCases, id: \.self) { tab in
                Button(action: { 
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        selectedTab = tab
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(selectedTab == tab ? AppTheme.accentBlue : AppTheme.tertiaryText)
                        
                        Text(tab.rawValue)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(selectedTab == tab ? AppTheme.primaryText : AppTheme.tertiaryText)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(selectedTab == tab ? AppTheme.accentBlue.opacity(0.1) : Color.clear)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(selectedTab == tab ? AppTheme.accentBlue : Color.clear, lineWidth: 1)
                    )
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
    }
    
    // MARK: - Features Discovery View
    private var featuresDiscoveryView: some View {
        VStack(spacing: 16) {
            // Search and filters
            HStack(spacing: 12) {
                // Search bar
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.tertiaryText)
                    
                    TextField("Search features...", text: $searchText)
                        .textFieldStyle(PlainTextFieldStyle())
                        .font(.system(size: 13))
                        .foregroundColor(AppTheme.primaryText)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(AppTheme.inputBackground)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(AppTheme.inputBorder, lineWidth: 1)
                        )
                )
                
                // Category filter
                Menu {
                    Button("All Categories") { selectedCategory = nil }
                    Divider()
                    ForEach(FeatureCategory.allCases, id: \.self) { category in
                        Button(category.displayName) { selectedCategory = category }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text(selectedCategory?.displayName ?? "All Categories")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(AppTheme.primaryText)
                        
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10))
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(AppTheme.inputBackground)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(AppTheme.inputBorder, lineWidth: 1)
                            )
                    )
                }
                .menuStyle(BorderlessButtonMenuStyle())
            }
            .padding(.horizontal, 24)
            
            // Features grid
            ScrollView {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 2), spacing: 16) {
                    ForEach(filteredFeatures) { feature in
                        FeatureDiscoveryCard(
                            feature: feature,
                            onExplore: {
                                navigationService.executeNavigationAction(feature.action, appState: AppState())
                                dismiss()
                            }
                        )
                    }
                }
                .padding(.horizontal, 24)
            }
        }
    }
    
    // MARK: - Tours Discovery View
    private var toursDiscoveryView: some View {
        VStack(spacing: 16) {
            // Tours header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Guided Tours")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text("Step-by-step introductions to complex features")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
                
                // Progress indicator
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(completedToursCount)/\(navigationService.availableTours.count)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text("completed")
                        .font(.system(size: 10))
                        .foregroundColor(AppTheme.tertiaryText)
                }
            }
            .padding(.horizontal, 24)
            
            // Tours list
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(navigationService.availableTours) { tour in
                        TourDiscoveryCard(
                            tour: tour,
                            onStartTour: {
                                selectedTour = tour
                                showTourDetail = true
                            }
                        )
                    }
                }
                .padding(.horizontal, 24)
            }
        }
    }
    
    // MARK: - Tips Discovery View
    private var tipsDiscoveryView: some View {
        VStack(spacing: 16) {
            // Tips header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Tips & Tricks")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text("Productivity tips and hidden features")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
            }
            .padding(.horizontal, 24)
            
            // Tips list
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(productivityTips, id: \.title) { tip in
                        ProductivityTipCard(tip: tip)
                    }
                }
                .padding(.horizontal, 24)
            }
        }
    }
    
    // MARK: - Footer
    private var discoveryFooter: some View {
        HStack {
            // Quick stats
            HStack(spacing: 20) {
                StatIndicator(
                    value: "\(navigationService.navigationFeatures.filter { $0.isNew }.count)",
                    label: "New Features",
                    color: .green
                )
                
                StatIndicator(
                    value: "\(navigationService.navigationFeatures.filter { $0.level == .advanced }.count)",
                    label: "Advanced Features",
                    color: .orange
                )
                
                StatIndicator(
                    value: "\(completedToursCount)",
                    label: "Tours Completed",
                    color: .blue
                )
            }
            
            Spacer()
            
            // Action button
            Button("Close") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
        .background(AppTheme.tertiaryBackground.opacity(0.3))
    }
    
    // MARK: - Computed Properties
    private var filteredFeatures: [NavigationFeature] {
        var features = navigationService.navigationFeatures
        
        if let category = selectedCategory {
            features = features.filter { $0.category == category }
        }
        
        if !searchText.isEmpty {
            let lowercaseQuery = searchText.lowercased()
            features = features.filter { feature in
                feature.title.lowercased().contains(lowercaseQuery) ||
                feature.description.lowercased().contains(lowercaseQuery) ||
                feature.keywords.contains { $0.lowercased().contains(lowercaseQuery) }
            }
        }
        
        return features.sorted { feature1, feature2 in
            // New features first
            if feature1.isNew && !feature2.isNew { return true }
            if !feature1.isNew && feature2.isNew { return false }
            
            // Then by category
            if feature1.category != feature2.category {
                return feature1.category.rawValue < feature2.category.rawValue
            }
            
            // Finally by title
            return feature1.title < feature2.title
        }
    }
    
    private var completedToursCount: Int {
        navigationService.availableTours.filter { $0.isCompleted }.count
    }
    
    private var productivityTips: [ProductivityTip] {
        [
            ProductivityTip(
                title: "Keyboard Navigation",
                description: "Use ⌘K to open the command palette from anywhere in the app",
                category: "Navigation",
                icon: "keyboard"
            ),
            ProductivityTip(
                title: "Quick Chat Creation",
                description: "Press ⌘N to instantly start a new conversation",
                category: "Chat",
                icon: "message"
            ),
            ProductivityTip(
                title: "Agent Coordination",
                description: "Chain multiple agents together for complex multi-step tasks",
                category: "Agents",
                icon: "network"
            ),
            ProductivityTip(
                title: "Context Search",
                description: "Use the search bar in the sidebar to quickly find conversations by content",
                category: "Search",
                icon: "magnifyingglass"
            ),
            ProductivityTip(
                title: "Performance Monitoring",
                description: "Keep the system monitor open to track resource usage during intensive tasks",
                category: "Monitoring",
                icon: "gauge"
            )
        ]
    }
}

// MARK: - Feature Discovery Card
struct FeatureDiscoveryCard: View {
    let feature: NavigationFeature
    let onExplore: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: feature.icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(feature.category.color)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle()
                            .fill(feature.category.color.opacity(0.1))
                    )
                
                Spacer()
                
                // Badges
                VStack(alignment: .trailing, spacing: 4) {
                    if feature.isNew {
                        FeatureBadge(text: "NEW", color: .green)
                    }
                    if feature.requiresPro {
                        FeatureBadge(text: "PRO", color: .orange)
                    }
                }
            }
            
            // Content
            VStack(alignment: .leading, spacing: 6) {
                Text(feature.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText)
                    .lineLimit(1)
                
                Text(feature.description)
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
            
            // Action
            Button(action: onExplore) {
                HStack {
                    Text("Explore")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Spacer()
                    
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(AppTheme.primaryText)
                }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(isHovered ? AppTheme.surfaceBackground.opacity(0.8) : AppTheme.surfaceBackground.opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            isHovered ? feature.category.color.opacity(0.3) : AppTheme.borderColor,
                            lineWidth: 1
                        )
                )
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
        .scaleEffect(isHovered ? 1.02 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
    }
}

// MARK: - Tour Discovery Card
struct TourDiscoveryCard: View {
    let tour: GuidedTour
    let onStartTour: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        HStack(spacing: 16) {
            // Status indicator
            ZStack {
                Circle()
                    .fill(tour.isCompleted ? AppTheme.accentGreen.opacity(0.2) : AppTheme.accentBlue.opacity(0.2))
                    .frame(width: 40, height: 40)
                
                Image(systemName: tour.isCompleted ? "checkmark" : "play.fill")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(tour.isCompleted ? AppTheme.accentGreen : AppTheme.accentBlue)
            }
            
            // Tour info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(tour.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Spacer()
                    
                    Text("\(Int(tour.estimatedDuration / 60)) min")
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.tertiaryText)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(AppTheme.sidebarItemHover)
                        )
                }
                
                Text(tour.description)
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(2)
                
                // Prerequisites
                if !tour.prerequisites.isEmpty && !tour.isCompleted {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.orange)
                        
                        Text("Requires: \(tour.prerequisites.joined(separator: ", "))")
                            .font(.system(size: 10))
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                }
            }
            
            // Action button
            Button(action: onStartTour) {
                Text(tour.isCompleted ? "Review" : "Start")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(tour.isCompleted ? AppTheme.accentGreen : AppTheme.accentBlue)
                    )
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(isHovered ? AppTheme.surfaceBackground.opacity(0.8) : AppTheme.surfaceBackground.opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Productivity Tip Card
struct ProductivityTipCard: View {
    let tip: ProductivityTip
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: tip.icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(AppTheme.accentOrange)
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(AppTheme.accentOrange.opacity(0.1))
                )
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(tip.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Spacer()
                    
                    Text(tip.category)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(AppTheme.tertiaryText)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(AppTheme.sidebarItemHover)
                        )
                }
                
                Text(tip.description)
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(2)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(AppTheme.surfaceBackground.opacity(0.3))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
        )
    }
}

// MARK: - Stat Indicator
struct StatIndicator: View {
    let value: String
    let label: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(color)
            
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(AppTheme.tertiaryText)
        }
    }
}

// MARK: - Supporting Types
struct ProductivityTip {
    let title: String
    let description: String
    let category: String
    let icon: String
}