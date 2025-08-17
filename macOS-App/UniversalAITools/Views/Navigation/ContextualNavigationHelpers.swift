import SwiftUI
import Combine

/// Contextual navigation helpers including breadcrumbs, smart suggestions, and workflow aids
struct ContextualNavigationBar: View {
    @ObservedObject var navigationService: EnhancedNavigationService
    @EnvironmentObject var appState: AppState
    
    @State private var showWorkflowSuggestions = false
    @State private var hoveredSuggestion: String?
    
    var body: some View {
        VStack(spacing: 0) {
            // Main navigation bar
            HStack(spacing: 16) {
                // Breadcrumbs
                if !navigationService.currentBreadcrumbs.isEmpty {
                    NavigationBreadcrumbs(breadcrumbs: navigationService.currentBreadcrumbs)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                
                Spacer()
                
                // Context actions
                contextActions
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(AppTheme.tertiaryBackground.opacity(0.3))
            
            // Smart suggestions bar (when applicable)
            if showWorkflowSuggestions && !navigationService.smartSuggestions.isEmpty {
                smartSuggestionsBar
            }
        }
    }
    
    // MARK: - Context Actions
    private var contextActions: some View {
        HStack(spacing: 12) {
            // Workflow suggestions toggle
            if !navigationService.smartSuggestions.isEmpty {
                Button(action: { 
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        showWorkflowSuggestions.toggle()
                    }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "lightbulb.fill")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(AppTheme.accentOrange)
                        
                        Text("\(navigationService.smartSuggestions.count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(AppTheme.primaryText)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill(showWorkflowSuggestions ? AppTheme.accentOrange.opacity(0.2) : AppTheme.sidebarItemHover)
                            .overlay(
                                Capsule()
                                    .stroke(showWorkflowSuggestions ? AppTheme.accentOrange : Color.clear, lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(PlainButtonStyle())
                .help("Smart suggestions based on your workflow")
            }
            
            // Quick help button
            Button(action: { /* Show contextual help */ }) {
                Image(systemName: "questionmark.circle")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .frame(width: 20, height: 20)
            }
            .buttonStyle(PlainButtonStyle())
            .help("Contextual help")
            
            // Settings for navigation
            Button(action: { /* Show navigation settings */ }) {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .frame(width: 20, height: 20)
            }
            .buttonStyle(PlainButtonStyle())
            .help("Navigation preferences")
        }
    }
    
    // MARK: - Smart Suggestions Bar
    private var smartSuggestionsBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(navigationService.smartSuggestions.prefix(5)) { suggestion in
                    ContextualSuggestionChip(
                        suggestion: suggestion,
                        isHovered: hoveredSuggestion == suggestion.id,
                        onSelected: {
                            navigationService.executeNavigationAction(suggestion.feature.action, appState: appState)
                            navigationService.recordFeatureUsage(suggestion.feature.id)
                        },
                        onHover: { hoveredSuggestion = suggestion.id },
                        onHoverEnd: { hoveredSuggestion = nil }
                    )
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.vertical, 8)
        .background(
            Rectangle()
                .fill(AppTheme.surfaceBackground.opacity(0.3))
        )
        .transition(.asymmetric(
            insertion: .move(edge: .top).combined(with: .opacity),
            removal: .move(edge: .top).combined(with: .opacity)
        ))
    }
}

// MARK: - Contextual Suggestion Chip
struct ContextualSuggestionChip: View {
    let suggestion: SmartSuggestion
    let isHovered: Bool
    let onSelected: () -> Void
    let onHover: () -> Void
    let onHoverEnd: () -> Void
    
    var body: some View {
        Button(action: onSelected) {
            HStack(spacing: 6) {
                // Reason icon
                Image(systemName: suggestion.reason.icon)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(suggestion.feature.category.color)
                
                // Feature title
                Text(suggestion.feature.title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.primaryText)
                    .lineLimit(1)
                
                // Confidence indicator
                Circle()
                    .fill(confidenceColor)
                    .frame(width: 6, height: 6)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(isHovered ? suggestion.feature.category.color.opacity(0.2) : AppTheme.sidebarItemHover)
                    .overlay(
                        Capsule()
                            .stroke(isHovered ? suggestion.feature.category.color.opacity(0.5) : Color.clear, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            if hovering {
                onHover()
            } else {
                onHoverEnd()
            }
        }
        .help(suggestionTooltip)
        .scaleEffect(isHovered ? 1.05 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
    }
    
    private var confidenceColor: Color {
        let confidence = suggestion.confidence
        if confidence >= 0.8 {
            return .green
        } else if confidence >= 0.6 {
            return .orange
        } else {
            return .gray
        }
    }
    
    private var suggestionTooltip: String {
        var tooltip = suggestion.feature.description
        if let hint = suggestion.contextualHint {
            tooltip += " • \(hint)"
        }
        tooltip += " • \(suggestion.reason.displayName)"
        return tooltip
    }
}

// MARK: - Workflow Progress Indicator
struct WorkflowProgressIndicator: View {
    let currentStep: String
    let totalSteps: [String]
    let completedSteps: Set<String>
    
    private var currentStepIndex: Int {
        totalSteps.firstIndex(of: currentStep) ?? 0
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: "arrow.triangle.branch")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.accentBlue)
                
                Text("Workflow Progress")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppTheme.secondaryText)
                
                Spacer()
                
                Text("\(completedSteps.count)/\(totalSteps.count)")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
            }
            
            // Progress steps
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(totalSteps.enumerated()), id: \.offset) { index, step in
                    WorkflowStepRow(
                        step: step,
                        isCompleted: completedSteps.contains(step),
                        isCurrent: step == currentStep,
                        isNext: index == currentStepIndex + 1
                    )
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(AppTheme.surfaceBackground.opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
        )
    }
}

// MARK: - Workflow Step Row
struct WorkflowStepRow: View {
    let step: String
    let isCompleted: Bool
    let isCurrent: Bool
    let isNext: Bool
    
    var body: some View {
        HStack(spacing: 8) {
            // Status indicator
            ZStack {
                Circle()
                    .fill(statusColor)
                    .frame(width: 16, height: 16)
                
                if isCompleted {
                    Image(systemName: "checkmark")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.white)
                } else if isCurrent {
                    Circle()
                        .fill(.white)
                        .frame(width: 6, height: 6)
                } else {
                    Text("\(stepNumber)")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            
            // Step title
            Text(step)
                .font(.system(size: 11, weight: isCurrent ? .semibold : .regular))
                .foregroundColor(stepTextColor)
                .strikethrough(isCompleted)
            
            Spacer()
            
            // Current indicator
            if isCurrent {
                Circle()
                    .fill(AppTheme.accentBlue)
                    .frame(width: 4, height: 4)
                    .scaleEffect(1.5)
                    .opacity(0.8)
                    .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isCurrent)
            }
        }
    }
    
    private var statusColor: Color {
        if isCompleted {
            return AppTheme.accentGreen
        } else if isCurrent {
            return AppTheme.accentBlue
        } else if isNext {
            return AppTheme.accentOrange.opacity(0.7)
        } else {
            return AppTheme.tertiaryText.opacity(0.5)
        }
    }
    
    private var stepTextColor: Color {
        if isCompleted {
            return AppTheme.tertiaryText
        } else if isCurrent {
            return AppTheme.primaryText
        } else {
            return AppTheme.secondaryText
        }
    }
    
    private var stepNumber: String {
        // This would be calculated based on the step position
        return "1" // Placeholder
    }
}

// MARK: - Feature Relationship Map
struct FeatureRelationshipMap: View {
    let currentFeature: NavigationFeature
    let relatedFeatures: [NavigationFeature]
    let onFeatureSelected: (NavigationFeature) -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.accentBlue)
                
                Text("Related Features")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
            }
            
            // Current feature
            RelatedFeatureNode(
                feature: currentFeature,
                isCurrent: true,
                onSelected: { onFeatureSelected(currentFeature) }
            )
            
            // Connections
            if !relatedFeatures.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(relatedFeatures.prefix(4)) { feature in
                        HStack {
                            // Connection line
                            VStack {
                                Rectangle()
                                    .fill(AppTheme.tertiaryText.opacity(0.3))
                                    .frame(width: 1, height: 12)
                                
                                Circle()
                                    .fill(AppTheme.tertiaryText.opacity(0.5))
                                    .frame(width: 4, height: 4)
                                
                                Rectangle()
                                    .fill(AppTheme.tertiaryText.opacity(0.3))
                                    .frame(width: 1, height: 12)
                            }
                            .frame(width: 20)
                            
                            // Related feature
                            RelatedFeatureNode(
                                feature: feature,
                                isCurrent: false,
                                onSelected: { onFeatureSelected(feature) }
                            )
                            
                            Spacer()
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(AppTheme.surfaceBackground.opacity(0.3))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
        )
    }
}

// MARK: - Related Feature Node
struct RelatedFeatureNode: View {
    let feature: NavigationFeature
    let isCurrent: Bool
    let onSelected: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: onSelected) {
            HStack(spacing: 8) {
                // Feature icon
                Image(systemName: feature.icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(isCurrent ? AppTheme.accentBlue : feature.category.color)
                    .frame(width: 20, height: 20)
                    .background(
                        Circle()
                            .fill(
                                isCurrent 
                                ? AppTheme.accentBlue.opacity(0.2)
                                : (isHovered ? feature.category.color.opacity(0.2) : Color.clear)
                            )
                    )
                
                // Feature info
                VStack(alignment: .leading, spacing: 2) {
                    Text(feature.title)
                        .font(.system(size: 11, weight: isCurrent ? .semibold : .medium))
                        .foregroundColor(isCurrent ? AppTheme.primaryText : AppTheme.secondaryText)
                        .lineLimit(1)
                    
                    if !isCurrent {
                        Text(relationshipReason)
                            .font(.system(size: 9))
                            .foregroundColor(AppTheme.tertiaryText)
                            .lineLimit(1)
                    }
                }
                
                Spacer()
                
                // Current indicator
                if isCurrent {
                    Text("CURRENT")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(AppTheme.accentBlue)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(
                            Capsule()
                                .fill(AppTheme.accentBlue.opacity(0.2))
                        )
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(isCurrent)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering && !isCurrent
            }
        }
    }
    
    private var relationshipReason: String {
        // This would be calculated based on feature relationships
        // For now, returning category-based relationships
        return "Same category"
    }
}

// MARK: - Quick Access Toolbar
struct QuickAccessToolbar: View {
    @ObservedObject var navigationService: EnhancedNavigationService
    @EnvironmentObject var appState: AppState
    
    let pinnedFeatures: [NavigationFeature]
    
    var body: some View {
        HStack(spacing: 8) {
            ForEach(pinnedFeatures.prefix(6)) { feature in
                QuickAccessButton(
                    feature: feature,
                    onSelected: {
                        navigationService.executeNavigationAction(feature.action, appState: appState)
                        navigationService.recordFeatureUsage(feature.id)
                    }
                )
            }
            
            Spacer()
            
            // More options
            Menu {
                ForEach(navigationService.recentlyUsedFeatures.prefix(5)) { feature in
                    Button(feature.title) {
                        navigationService.executeNavigationAction(feature.action, appState: appState)
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .frame(width: 24, height: 24)
                    .background(
                        Circle()
                            .fill(AppTheme.sidebarItemHover)
                    )
            }
            .menuStyle(BorderlessButtonMenuStyle())
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(AppTheme.tertiaryBackground.opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppTheme.borderColor, lineWidth: 1)
                )
        )
    }
}

// MARK: - Quick Access Button
struct QuickAccessButton: View {
    let feature: NavigationFeature
    let onSelected: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: onSelected) {
            VStack(spacing: 2) {
                Image(systemName: feature.icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(isHovered ? feature.category.color : AppTheme.secondaryText)
                    .frame(width: 20, height: 20)
                
                Text(feature.title)
                    .font(.system(size: 8, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .lineLimit(1)
                    .frame(maxWidth: 40)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isHovered ? feature.category.color.opacity(0.1) : Color.clear)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
        .help(feature.description)
    }
}