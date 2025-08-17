import SwiftUI

// MARK: - Navigation Section View
struct NavigationSectionView: View {
    let section: NavigationSection
    let isExpanded: Bool
    let preferences: NavigationPreferences
    let hoveredFeature: String?
    let onToggleExpansion: () -> Void
    let onFeatureSelected: (NavigationFeature) -> Void
    let onFeatureHover: (String?) -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            // Section header
            if section.isCollapsible {
                Button(action: onToggleExpansion) {
                    HStack(spacing: 10) {
                        Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(AppTheme.tertiaryText)
                            .rotationEffect(.degrees(isExpanded ? 0 : -90))
                            .animation(.spring(response: 0.3), value: isExpanded)
                        
                        Image(systemName: section.icon)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(section.category.color)
                        
                        Text(section.title)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.secondaryText)
                            .textCase(.uppercase)
                        
                        Spacer()
                        
                        // Badge for new features
                        if section.showBadge, let count = section.badgeCount {
                            Text("\(count)")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule()
                                        .fill(Color.red)
                                )
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            } else {
                // Non-collapsible header
                HStack(spacing: 10) {
                    Image(systemName: section.icon)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(section.category.color)
                    
                    Text(section.title)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(AppTheme.secondaryText)
                        .textCase(.uppercase)
                    
                    Spacer()
                    
                    if section.showBadge, let count = section.badgeCount {
                        Text("\(count)")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(Color.red)
                            )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            
            // Features list
            if !section.isCollapsible || isExpanded {
                LazyVStack(spacing: 2) {
                    ForEach(section.features) { feature in
                        NavigationFeatureRow(
                            feature: feature,
                            preferences: preferences,
                            isHovered: hoveredFeature == feature.id,
                            onSelected: { onFeatureSelected(feature) },
                            onHover: { onFeatureHover(feature.id) },
                            onHoverEnd: { onFeatureHover(nil) }
                        )
                        .padding(.horizontal, 16)
                    }
                }
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .move(edge: .top)),
                    removal: .opacity.combined(with: .move(edge: .top))
                ))
            }
        }
    }
}

// MARK: - Navigation Feature Row
struct NavigationFeatureRow: View {
    let feature: NavigationFeature
    let preferences: NavigationPreferences
    let isHovered: Bool
    var compact: Bool = false
    let onSelected: () -> Void
    let onHover: () -> Void
    let onHoverEnd: () -> Void
    
    @State private var showTooltip = false
    
    var body: some View {
        Button(action: onSelected) {
            HStack(spacing: 12) {
                // Feature icon
                ZStack {
                    Circle()
                        .fill(
                            isHovered ? feature.category.color.opacity(0.2) : Color.clear
                        )
                        .frame(width: 32, height: 32)
                        .animation(.easeInOut(duration: 0.2), value: isHovered)
                    
                    Image(systemName: feature.icon)
                        .font(.system(size: compact ? 12 : 14, weight: .medium))
                        .foregroundColor(
                            isHovered ? feature.category.color : AppTheme.secondaryText
                        )
                        .animation(.easeInOut(duration: 0.2), value: isHovered)
                }
                
                // Feature info
                VStack(alignment: .leading, spacing: compact ? 1 : 2) {
                    HStack {
                        Text(feature.title)
                            .font(.system(size: compact ? 12 : 13, weight: .medium))
                            .foregroundColor(
                                isHovered ? AppTheme.primaryText : AppTheme.secondaryText
                            )
                            .lineLimit(1)
                        
                        Spacer()
                        
                        // Feature badges
                        HStack(spacing: 4) {
                            if feature.isNew {
                                FeatureBadge(text: "NEW", color: .green)
                            }
                            
                            if feature.requiresPro {
                                FeatureBadge(text: "PRO", color: .orange)
                            }
                            
                            if let badge = feature.level.badge {
                                FeatureBadge(text: badge, color: feature.level.color)
                            }
                        }
                    }
                    
                    if !compact && preferences.showDescriptions {
                        Text(feature.description)
                            .font(.system(size: 10))
                            .foregroundColor(AppTheme.tertiaryText)
                            .lineLimit(preferences.compactMode ? 1 : 2)
                            .opacity(isHovered ? 1.0 : 0.7)
                            .animation(.easeInOut(duration: 0.2), value: isHovered)
                    }
                    
                    // Keyboard shortcut
                    if !compact && preferences.showShortcuts, let shortcut = feature.shortcutKey {
                        HStack {
                            Spacer()
                            Text(shortcut)
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundColor(AppTheme.tertiaryText)
                                .opacity(0.8)
                        }
                    }
                }
                
                // Chevron indicator for hover
                if isHovered {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(AppTheme.tertiaryText)
                        .transition(.asymmetric(
                            insertion: .scale.combined(with: .opacity),
                            removal: .scale.combined(with: .opacity)
                        ))
                }
            }
            .padding(.vertical, compact ? 6 : 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(isHovered ? AppTheme.sidebarItemHover : Color.clear)
                .animation(.easeInOut(duration: 0.15), value: isHovered)
        )
        .disabled(!feature.isEnabled)
        .opacity(feature.isEnabled ? 1.0 : 0.5)
        .onHover { hovering in
            if hovering {
                onHover()
            } else {
                onHoverEnd()
            }
        }
        .help(feature.description)
    }
}

// MARK: - Smart Suggestion Row
struct SmartSuggestionRow: View {
    let suggestion: SmartSuggestion
    let preferences: NavigationPreferences
    let onSelected: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: onSelected) {
            HStack(spacing: 10) {
                // Suggestion reason icon
                Image(systemName: suggestion.reason.icon)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(suggestion.feature.category.color)
                    .frame(width: 16, height: 16)
                
                // Feature info
                VStack(alignment: .leading, spacing: 2) {
                    Text(suggestion.feature.title)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppTheme.primaryText)
                        .lineLimit(1)
                    
                    if let hint = suggestion.contextualHint {
                        Text(hint)
                            .font(.system(size: 10))
                            .foregroundColor(AppTheme.tertiaryText)
                            .lineLimit(1)
                    }
                }
                
                Spacer()
                
                // Confidence indicator
                Circle()
                    .fill(
                        LinearGradient(
                            colors: confidenceColors,
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: 6, height: 6)
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isHovered ? suggestion.feature.category.color.opacity(0.1) : Color.clear)
                .animation(.easeInOut(duration: 0.15), value: isHovered)
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
    
    private var confidenceColors: [Color] {
        let confidence = suggestion.confidence
        if confidence >= 0.8 {
            return [.green, .green.opacity(0.7)]
        } else if confidence >= 0.6 {
            return [.orange, .orange.opacity(0.7)]
        } else {
            return [.gray, .gray.opacity(0.7)]
        }
    }
}

// MARK: - Feature Badge
struct FeatureBadge: View {
    let text: String
    let color: Color
    
    var body: some View {
        Text(text)
            .font(.system(size: 7, weight: .bold))
            .foregroundColor(.white)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .background(
                Capsule()
                    .fill(color)
            )
    }
}

// MARK: - Navigation Breadcrumbs
struct NavigationBreadcrumbs: View {
    let breadcrumbs: [NavigationBreadcrumb]
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(breadcrumbs.enumerated()), id: \.element.id) { index, breadcrumb in
                    HStack(spacing: 6) {
                        if let icon = breadcrumb.icon {
                            Image(systemName: icon)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(AppTheme.tertiaryText)
                        }
                        
                        if let action = breadcrumb.action {
                            Button(breadcrumb.title) {
                                action()
                            }
                            .buttonStyle(PlainButtonStyle())
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(AppTheme.accentBlue)
                        } else {
                            Text(breadcrumb.title)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(
                                    index == breadcrumbs.count - 1 ? AppTheme.primaryText : AppTheme.secondaryText
                                )
                        }
                        
                        if index < breadcrumbs.count - 1 {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 8, weight: .medium))
                                .foregroundColor(AppTheme.tertiaryText)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
        }
        .frame(height: 32)
    }
}

// MARK: - Quick Actions Bar
struct QuickActionsBar: View {
    let navigationService: EnhancedNavigationService
    let appState: AppState
    
    var body: some View {
        HStack(spacing: 12) {
            ForEach(quickActions, id: \.title) { action in
                QuickActionButton(
                    title: action.title,
                    icon: action.icon,
                    shortcut: action.shortcut,
                    action: {
                        navigationService.executeNavigationAction(action.navigationAction, appState: appState)
                    }
                )
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            Rectangle()
                .fill(AppTheme.tertiaryBackground.opacity(0.5))
        )
    }
    
    private var quickActions: [QuickAction] {
        [
            QuickAction(
                title: "New Chat",
                icon: "plus.message",
                shortcut: "⌘N",
                navigationAction: .showView("chat")
            ),
            QuickAction(
                title: "Search",
                icon: "magnifyingglass",
                shortcut: "⌘F",
                navigationAction: .custom("global_search")
            ),
            QuickAction(
                title: "Commands",
                icon: "command",
                shortcut: "⌘K",
                navigationAction: .custom("command_palette")
            )
        ]
    }
}

struct QuickAction {
    let title: String
    let icon: String
    let shortcut: String
    let navigationAction: NavigationAction
}

struct QuickActionButton: View {
    let title: String
    let icon: String
    let shortcut: String
    let action: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.secondaryText)
                
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.secondaryText)
                
                Text(shortcut)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(AppTheme.tertiaryText)
                    .opacity(0.8)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isHovered ? AppTheme.sidebarItemHover : Color.clear)
                .animation(.easeInOut(duration: 0.15), value: isHovered)
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
        .help("\(title) (\(shortcut))")
    }
}