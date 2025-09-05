import SwiftUI

/// Apple Human Interface Guidelines 2025 - Native SwiftUI Design System
/// Enhanced with iOS 26 / macOS 26 Liquid Glass Effects and modern UI patterns
/// Matches the professional interface created in Electron but using native Apple components

// MARK: - Button Styles with iOS 26 Liquid Glass
public struct GlassButtonStyle: ButtonStyle {
    public enum Variant {
        case primary, secondary, compact, liquidGlass
    }
    
    let variant: Variant
    
    public init(_ variant: Variant = .primary) {
        self.variant = variant
    }
    
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, variant == .compact ? 12 : 16)
            .padding(.vertical, variant == .compact ? 6 : 10)
            .background {
                if #available(iOS 26.0, macOS 26.0, *), variant == .liquidGlass {
                    // iOS 26 Liquid Glass effect
                    RoundedRectangle(cornerRadius: 12)
                        .fill(.regularMaterial)
                        .glassEffect(
                            .glossy,
                            in: RoundedRectangle(cornerRadius: 12),
                            isEnabled: true
                        )
                } else {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(.regularMaterial)
                }
            }
            .cornerRadius(variant == .liquidGlass ? 12 : 8)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: - iOS 26 Enhanced Button Style
@available(iOS 26.0, macOS 26.0, *)
extension ButtonStyle where Self == GlassButtonStyle {
    public static var glass: GlassButtonStyle {
        GlassButtonStyle(.liquidGlass)
    }
}

// MARK: - Apple App Structure with iOS 26 Enhancements
public struct AppleApp<Content: View>: View {
    let content: Content
    @State private var enableLiquidGlass = true
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        content
            .background {
                if #available(iOS 26.0, macOS 26.0, *), enableLiquidGlass {
                    // iOS 26 Liquid Glass background with depth
                    Rectangle()
                        .fill(.regularMaterial)
                        .glassEffect(
                            .subtle,
                            in: Rectangle(),
                            isEnabled: true
                        )
                        .backgroundExtensionEffect()
                } else {
                    Rectangle()
                        .fill(.regularMaterial)
                }
            }
            .preferredColorScheme(.none) // Respect system setting
            .font(.system(.body, design: .default))
    }
}

// MARK: - Apple Toolbar with iOS 26 Liquid Glass
public struct AppleToolbar<Content: View>: View {
    let content: Content
    @State private var isHovering = false
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        HStack {
            content
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .frame(height: 52)
        .background {
            if #available(iOS 26.0, macOS 26.0, *) {
                // iOS 26 Liquid Glass toolbar with hover effect
                Rectangle()
                    .fill(.regularMaterial)
                    .glassEffect(
                        isHovering ? .glossy : .subtle,
                        in: Rectangle(),
                        isEnabled: true
                    )
                    .animation(.smooth(duration: 0.3), value: isHovering)
            } else {
                Rectangle()
                    .fill(.regularMaterial)
            }
        }
        .overlay(
            Rectangle()
                .frame(height: 0.5)
                .foregroundStyle(.separator),
            alignment: .bottom
        )
        #if os(macOS)
        .onHover { hovering in
            isHovering = hovering
        }
        #endif
    }
}

public struct AppleToolbarLeft<Content: View>: View {
    let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        HStack {
            content
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

public struct AppleToolbarCenter<Content: View>: View {
    let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        content
            .frame(maxWidth: 400)
    }
}

public struct AppleToolbarRight<Content: View>: View {
    let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        HStack {
            Spacer()
            content
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
}

// MARK: - Apple Search Bar
public struct AppleSearchBar: View {
    @Binding var text: String
    @Binding var isFocused: Bool
    let placeholder: String
    let shortcut: String
    @FocusState private var isTextFieldFocused: Bool
    
    public init(text: Binding<String>, isFocused: Binding<Bool>, placeholder: String, shortcut: String) {
        self._text = text
        self._isFocused = isFocused
        self.placeholder = placeholder
        self.shortcut = shortcut
    }
    
    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .font(.system(size: 13))
            
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .focused($isTextFieldFocused)
                .onChange(of: isTextFieldFocused) { newValue in
                    isFocused = newValue
                }
                .onChange(of: isFocused) { newValue in
                    isTextFieldFocused = newValue
                }
            
            Text(shortcut)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.tertiary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 4))
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(.quinary, in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(isFocused ? .blue : .clear, lineWidth: 1)
        )
    }
}

// MARK: - Apple Toolbar Components
public struct AppleToolbarButton: View {
    let icon: String
    let tooltip: String
    let action: (() -> Void)?
    
    public init(icon: String, tooltip: String, action: (() -> Void)? = nil) {
        self.icon = icon
        self.tooltip = tooltip
        self.action = action
    }
    
    public var body: some View {
        Button {
            action?()
        } label: {
            Text(icon)
                .font(.system(size: 13))
        }
        .buttonStyle(.plain)
        .frame(width: 28, height: 28)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 6))
        .help(tooltip)
    }
}

public struct AppleUserMenu<Content: View>: View {
    let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        Menu {
            Button("Profile Settings") { }
            Button("Sign Out") { }
        } label: {
            content
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Apple Main Layout
public struct AppleMain<Content: View>: View {
    let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        #if os(macOS)
        HSplitView {
            content
        }
        #else
        HStack {
            content
        }
        #endif
    }
}

// MARK: - Apple Sidebar
public struct AppleSidebar<Content: View>: View {
    let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .frame(minWidth: 280, maxWidth: 280)
        .background(.regularMaterial)
        .overlay(
            Rectangle()
                .frame(width: 0.5)
                .foregroundStyle(.separator),
            alignment: .trailing
        )
    }
}

public struct AppleSidebarSection<Content: View>: View {
    let title: String
    let content: Content
    
    public init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased())
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)
                .padding(.top, 20)
            
            content
        }
        .padding(.bottom, 16)
    }
}

// MARK: - Apple Navigation Item with iOS 26 Enhancements
public struct AppleNavItem: View {
    let icon: String
    let label: String
    let description: String
    let badge: String?
    let isActive: Bool
    let accentColor: Color
    let action: () -> Void
    
    @State private var isHovering = false
    @State private var isPressing = false
    
    public init(
        icon: String,
        label: String,
        description: String,
        badge: String? = nil,
        isActive: Bool,
        accentColor: Color,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.label = label
        self.description = description
        self.badge = badge
        self.isActive = isActive
        self.accentColor = accentColor
        self.action = action
    }
    
    public var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack {
                    Text(icon)
                        .font(.system(size: 16))
                        .scaleEffect(isActive || isHovering ? 1.1 : 1.0)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovering)
                    
                    if let badge = badge {
                        Text(badge)
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(isActive ? accentColor : .white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background {
                                if #available(iOS 26.0, macOS 26.0, *) {
                                    Capsule()
                                        .fill(isActive ? .white.opacity(0.9) : accentColor)
                                        .glassEffect(
                                            .glossy,
                                            in: Capsule(),
                                            isEnabled: true
                                        )
                                } else {
                                    Capsule()
                                        .fill(isActive ? .white.opacity(0.9) : accentColor)
                                }
                            }
                            .offset(x: 8, y: -8)
                    }
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(isActive ? .white : .primary)
                    
                    Text(description)
                        .font(.system(size: 12))
                        .foregroundStyle(isActive ? .white.opacity(0.8) : .secondary)
                }
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .background {
            if #available(iOS 26.0, macOS 26.0, *) {
                RoundedRectangle(cornerRadius: 10)
                    .fill(isActive ? accentColor : (isHovering ? accentColor.opacity(0.1) : .clear))
                    .glassEffect(
                        isActive ? .glossy : .subtle,
                        in: RoundedRectangle(cornerRadius: 10),
                        isEnabled: isActive || isHovering
                    )
                    .animation(.smooth(duration: 0.2), value: isHovering)
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(isActive ? accentColor : (isHovering ? accentColor.opacity(0.1) : .clear))
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: isActive || isHovering ? 10 : 8)
                .strokeBorder(isActive ? .white.opacity(0.6) : .clear, lineWidth: isActive ? 1 : 0)
        )
        .scaleEffect(isPressing ? 0.98 : 1.0)
        .animation(.spring(response: 0.2, dampingFraction: 0.8), value: isPressing)
        #if os(macOS)
        .onHover { hovering in
            isHovering = hovering
        }
        #endif
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressing = true }
                .onEnded { _ in isPressing = false }
        )
        .padding(.horizontal, 8)
    }
}

// MARK: - Apple Family Member
public struct AppleFamilyMember: View {
    let avatar: String
    let name: String
    let role: String
    let isActive: Bool
    let action: () -> Void
    
    public init(avatar: String, name: String, role: String, isActive: Bool, action: @escaping () -> Void) {
        self.avatar = avatar
        self.name = name
        self.role = role
        self.isActive = isActive
        self.action = action
    }
    
    public var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(avatar)
                    .font(.system(size: 20))
                    .frame(width: 32, height: 32)
                    .background(.quaternary, in: Circle())
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(isActive ? .white : .primary)
                    
                    Text(role)
                        .font(.system(size: 11))
                        .foregroundStyle(isActive ? .white.opacity(0.8) : .secondary)
                }
                
                Spacer()
                
                Circle()
                    .fill(isActive ? .green : .secondary)
                    .frame(width: 8, height: 8)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(isActive ? .blue : .clear)
        )
        .padding(.horizontal, 8)
    }
}

// MARK: - Apple Sidebar Footer
public struct AppleSidebarFooter<Content: View>: View {
    let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        VStack {
            Spacer()
            Rectangle()
                .frame(height: 0.5)
                .foregroundStyle(.separator)
            content
                .padding(16)
        }
    }
}

public struct AppleSettingsButton: View {
    let action: () -> Void
    
    public init(action: @escaping () -> Void) {
        self.action = action
    }
    
    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text("⚙️")
                    .font(.system(size: 14))
                Text("Settings")
                    .font(.system(size: 13, weight: .medium))
                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
            .background(.quinary, in: RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Apple Content Area
public struct AppleContent<Content: View>: View {
    let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.regularMaterial)
    }
}

public struct AppleContentContainer<Content: View>: View {
    @Binding var activeView: any Hashable
    let content: Content
    
    public init(activeView: Binding<any Hashable>, @ViewBuilder content: () -> Content) {
        self._activeView = activeView
        self.content = content()
    }
    
    public var body: some View {
        content
            .id(activeView as? AnyHashable)
            .animation(.easeInOut(duration: 0.3), value: activeView as? AnyHashable)
    }
}

// MARK: - Typography Extensions
extension Text {
    public func appleToolbarTitle() -> some View {
        self
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.primary)
    }
    
    public func appleToolbarSubtitle() -> some View {
        self
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
    }
    
    public func appleUserName() -> some View {
        self
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(.primary)
    }
    
    public func appleUserStatus() -> some View {
        self
            .font(.system(size: 10))
            .foregroundStyle(.green)
    }
    
    public func applePageTitle() -> some View {
        self
            .font(.system(size: 32, weight: .bold, design: .default))
            .foregroundStyle(.primary)
    }
    
    public func applePageSubtitle() -> some View {
        self
            .font(.system(size: 18))
            .foregroundStyle(.secondary)
    }
    
    public func appleSectionTitle() -> some View {
        self
            .font(.system(size: 20, weight: .semibold))
            .foregroundStyle(.primary)
    }
}

// MARK: - View Extensions
extension View {
    public func appleContentWrapper() -> some View {
        self
            .padding(24)
            .background(.thickMaterial, in: RoundedRectangle(cornerRadius: 12))
            .padding(32)
    }
}

// MARK: - Apple Page Views
public struct ApplePageView<Content: View>: View {
    let title: String
    let subtitle: String
    let primaryAction: String?
    let content: Content
    
    public init(
        title: String,
        subtitle: String,
        primaryAction: String? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.primaryAction = primaryAction
        self.content = content()
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text(title)
                        .applePageTitle()
                    Text(subtitle)
                        .applePageSubtitle()
                }
                
                Spacer()
                
                if let primaryAction = primaryAction {
                    Button(primaryAction) {
                        // Action handling
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            
            content
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Apple Home View Components
public struct AppleHomeView: View {
    let greeting: String
    let stats: [UsageStat]
    let quickActions: [NavigationItem]
    let recentActivity: [RecentActivity]
    let onQuickAction: (ActiveView) -> Void
    
    public init(
        greeting: String,
        stats: [UsageStat],
        quickActions: [NavigationItem],
        recentActivity: [RecentActivity],
        onQuickAction: @escaping (ActiveView) -> Void
    ) {
        self.greeting = greeting
        self.stats = stats
        self.quickActions = quickActions
        self.recentActivity = recentActivity
        self.onQuickAction = onQuickAction
    }
    
    public var body: some View {
        ScrollView {
            VStack(spacing: 40) {
                // Hero Section
                VStack(spacing: 24) {
                    Text(greeting)
                        .font(.system(size: 36, weight: .bold, design: .default))
                        .foregroundStyle(.primary)
                    
                    Text("Your intelligent assistant is ready to help with conversations, image analysis, voice commands, and automated workflows.")
                        .font(.system(size: 18))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 600)
                    
                    HStack(spacing: 40) {
                        ForEach(stats, id: \.number) { stat in
                            VStack(spacing: 4) {
                                Text(stat.number)
                                    .font(.system(size: 28, weight: .bold))
                                    .foregroundStyle(.blue)
                                Text(stat.label)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .padding(40)
                .frame(maxWidth: .infinity)
                
                // Quick Actions
                VStack(alignment: .leading, spacing: 20) {
                    Text("Quick Actions")
                        .appleSectionTitle()
                    
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 2), spacing: 16) {
                        ForEach(quickActions, id: \.id) { action in
                            Button {
                                onQuickAction(action.id)
                            } label: {
                                AppleActionCard(
                                    icon: action.sfSymbol,
                                    title: action.name,
                                    description: action.description,
                                    color: action.color,
                                    badge: action.badge
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                
                // Recent Activity
                VStack(alignment: .leading, spacing: 20) {
                    Text("Recent Activity")
                        .appleSectionTitle()
                    
                    VStack(spacing: 0) {
                        ForEach(recentActivity, id: \.title) { activity in
                            AppleActivityRow(
                                icon: activity.icon,
                                iconColor: activity.iconColor,
                                title: activity.title,
                                subtitle: activity.subtitle,
                                time: activity.time
                            )
                            
                            if activity.title != recentActivity.last?.title {
                                Divider()
                            }
                        }
                    }
                    .background(.thickMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(32)
        }
    }
}

public struct AppleActionCard: View {
    let icon: String
    let title: String
    let description: String
    let color: Color
    let badge: String?
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text(icon)
                    .font(.system(size: 32))
                    .foregroundStyle(color)
                
                Spacer()
                
                if let badge = badge {
                    Text(badge)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(color, in: Capsule())
                }
            }
            
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.primary)
                
                Text(description)
                    .font(.system(size: 14))
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
        .padding(20)
        .frame(height: 140)
        .background(.thickMaterial, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(.separator, lineWidth: 0.5)
        )
    }
}

public struct AppleActivityRow: View {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String
    let time: String
    
    public var body: some View {
        HStack(spacing: 16) {
            Text(icon)
                .font(.system(size: 16))
                .frame(width: 32, height: 32)
                .background(iconColor.opacity(0.2), in: RoundedRectangle(cornerRadius: 8))
                .foregroundStyle(iconColor)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.primary)
                
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Text(time)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.tertiary)
        }
        .padding(16)
    }
}

// MARK: - Agent Management Placeholder
struct AgentManagementView: View {
    var body: some View {
        VStack {
            Text("AI Agent Management")
                .font(.title)
            Text("Coming Soon - Connect to your Rust backend services")
                .foregroundStyle(.secondary)
        }
    }
}