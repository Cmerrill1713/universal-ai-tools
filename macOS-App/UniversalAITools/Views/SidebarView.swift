import Foundation
import SwiftUI

struct SidebarView: View {
    @Binding var selection: SidebarItem?
    @EnvironmentObject var appState: AppState

    var body: some View {
        List(SidebarItem.allCases, id: \.self, selection: $selection) { item in
            OptimizedSidebarItemView(item: item)
        }
        .listStyle(SidebarListStyle())
        .frame(minWidth: 200)
        .background(AppTheme.windowBackgroundGradient)
        .animation(.easeInOut(duration: 0.2), value: selection)
    }
}

// Compact dock overlay used on top of chat content
struct DockOverlay: View {
    var onSelect: (SidebarItem) -> Void
    @State private var isHovered = false

    var body: some View {
        VStack(spacing: 12) {
            dockButton(.chat, icon: "text.bubble")
            dockButton(.knowledge, icon: "point.3.connected.trianglepath.dotted")
            dockButton(.objectives, icon: "target")
            dockButton(.orchestration, icon: "brain.head.profile")
            dockButton(.analytics, icon: "chart.bar.doc.horizontal")
            dockButton(.tools, icon: "wrench.and.screwdriver")
            Spacer()
        }
        .frame(width: isHovered ? 44 : 36)
        .padding(.vertical, 12)
        .background(AppTheme.tertiaryBackground.opacity(0.9))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppTheme.separator, lineWidth: 1)
        )
        .cornerRadius(8)
        .opacity(isHovered ? 1.0 : 0.6)
        .animation(.easeInOut(duration: 0.18), value: isHovered)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.18)) { isHovered = hovering }
        }
    }

    private func dockButton(_ item: SidebarItem, icon: String) -> some View {
        Button(action: { onSelect(item) }) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppTheme.primaryText)
                .frame(width: 28, height: 28)
        }
        .buttonStyle(.plain)
        .contentShape(RoundedRectangle(cornerRadius: 6))
        .background(RoundedRectangle(cornerRadius: 6).fill(AppTheme.secondaryBackground))
    }
}

// MARK: - Optimized Sidebar Item View
struct OptimizedSidebarItemView: View {
    let item: SidebarItem
    @EnvironmentObject var appState: AppState
    
    @State private var cachedSubtitle: String?
    @State private var cachedBadge: String?
    @State private var hasAppeared = false
    
    var body: some View {
        HStack(spacing: 12) {
            // Cached icon
            OptimizedSidebarIcon(item: item)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 14, weight: .medium))

                if hasAppeared, let subtitle = cachedSubtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .transition(.opacity)
                }
            }

            Spacer()

            if hasAppeared, let badge = cachedBadge {
                EnhancedUIComponents.EnhancedStatusBadge(
                    status: badge,
                    type: badgeType
                )
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.vertical, 4)
        .onAppear {
            if !hasAppeared {
                // Cache expensive computations
                cachedSubtitle = computeSubtitle()
                cachedBadge = computeBadge()
                
                withAnimation(.easeIn(duration: 0.2)) {
                    hasAppeared = true
                }
            }
        }
        .onChange(of: appState.chats.count) { _, _ in
            // Update cached values when relevant state changes
            updateCachedValues()
        }
        .onChange(of: appState.activeObjectives.count) { _, _ in
            updateCachedValues()
        }
        .drawingGroup() // Cache the entire item view
    }
    
    private func updateCachedValues() {
        cachedSubtitle = computeSubtitle()
        cachedBadge = computeBadge()
    }
    
    private func computeSubtitle() -> String? {
        return item.description
    }
    
    private func computeBadge() -> String? {
        switch item {
        case .chat:
            return !appState.chats.isEmpty ? "\(appState.chats.count)" : nil
        case .objectives:
            return !appState.activeObjectives.isEmpty ? "\(appState.activeObjectives.count)" : nil
        default:
            return item.featureLevel.badge
        }
    }
    
    private var badgeType: EnhancedUIComponents.EnhancedStatusBadge.BadgeType {
        if item.featureLevel == .advanced {
            return .active
        }
        
        switch item {
        case .chat, .objectives:
            return .info
        default:
            return .success
        }
    }
    
    private var badgeColor: Color {
        if item.featureLevel == .advanced {
            return item.featureLevel.color
        }
        
        switch item {
        case .chat, .objectives:
            return .blue
        default:
            return AppTheme.accentOrange
        }
    }
}

// MARK: - Optimized Sidebar Icon (Cached)
private struct OptimizedSidebarIcon: View {
    let item: SidebarItem
    
    var body: some View {
        Image(systemName: item.icon)
            .font(.system(size: 16, weight: .medium))
            .foregroundColor(.accentColor)
            .frame(width: 20)
            .drawingGroup() // Cache the icon rendering
    }
}

// MARK: - Original Sidebar Item View (Kept for compatibility)
struct SidebarItemView: View {
    let item: SidebarItem
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.accentColor)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 14, weight: .medium))

                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if let badge = badge {
                Text(badge)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(badgeColor)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 4)
    }

    private var subtitle: String? {
        return item.description
    }
    
    private var dynamicBadge: String? {
        switch item {
        case .chat:
            return !appState.chats.isEmpty ? "\(appState.chats.count)" : nil
        case .objectives:
            return !appState.activeObjectives.isEmpty ? "\(appState.activeObjectives.count)" : nil
        default:
            return item.featureLevel.badge
        }
    }
    
    private var oldSubtitle: String? {
        switch item {
        case .chat:
            return "\(appState.chats.count) conversations"
        case .knowledge:
            return "3D graph visualization"
        case .objectives:
            return "\(appState.activeObjectives.count) active"
        case .orchestration:
            return "AI agent coordination"
        case .analytics:
            return "Performance & memory analytics"
        case .tools:
            return "\(ToolCategory.allCases.count) tools"
        }
    }

    private var badge: String? {
        return dynamicBadge
    }
    
    private var oldBadge: String? {
        switch item {
        case .objectives:
            let activeCount = appState.activeObjectives.filter { $0.status == .active }.count
            return activeCount > 0 ? "\(activeCount)" : nil
        case .tools:
            return nil
        default:
            return nil
        }
    }

    private var badgeColor: Color {
        if item.featureLevel == .advanced {
            return item.featureLevel.color
        }
        
        switch item {
        case .chat, .objectives:
            return .blue
        default:
            return AppTheme.accentOrange
        }
    }
}

#Preview {
    SidebarView(selection: .constant(.chat))
        .environmentObject(AppState())
}
