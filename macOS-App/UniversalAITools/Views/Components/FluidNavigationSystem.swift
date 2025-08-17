import SwiftUI
import Pow

/// Fluid navigation system with smooth transitions, view morphing, and contextual animations
/// Provides Arc browser-inspired navigation with enhanced user experience
struct FluidNavigationSystem {
    
    // MARK: - Navigation Container with Smooth Transitions
    struct NavigationContainer<Content: View>: View {
        let content: Content
        @State private var currentView: AnyView = AnyView(EmptyView())
        @State private var transitionStyle: TransitionStyle = .slide
        @State private var isTransitioning = false
        
        enum TransitionStyle {
            case slide, fade, morph, scale, flip
            
            var transition: AnyTransition {
                switch self {
                case .slide:
                    return .asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    )
                case .fade:
                    return .opacity.combined(with: .scale(scale: 0.95))
                case .morph:
                    return .asymmetric(
                        insertion: .scale(scale: 0.8).combined(with: .opacity),
                        removal: .scale(scale: 1.2).combined(with: .opacity)
                    )
                case .scale:
                    return .scale.combined(with: .opacity)
                case .flip:
                    return .asymmetric(
                        insertion: .rotation3DEffect(.degrees(90), axis: (0, 1, 0)).combined(with: .opacity),
                        removal: .rotation3DEffect(.degrees(-90), axis: (0, 1, 0)).combined(with: .opacity)
                    )
                }
            }
            
            var duration: Double {
                switch self {
                case .slide: return 0.4
                case .fade: return 0.3
                case .morph: return 0.5
                case .scale: return 0.3
                case .flip: return 0.6
                }
            }
        }
        
        init(@ViewBuilder content: () -> Content) {
            self.content = content()
        }
        
        var body: some View {
            ZStack {
                content
                    .transition(transitionStyle.transition)
                    .blur(radius: isTransitioning ? 1 : 0)
                    .scaleEffect(isTransitioning ? 0.98 : 1.0)
                
                // Loading overlay during transitions
                if isTransitioning {
                    Rectangle()
                        .fill(.black.opacity(0.1))
                        .edgesIgnoringSafeArea(.all)
                        .transition(.opacity)
                }
            }
            .animation(.spring(response: transitionStyle.duration, dampingFraction: 0.8), value: isTransitioning)
        }
        
        func navigate<NewContent: View>(
            to newContent: NewContent,
            style: TransitionStyle = .slide
        ) {
            transitionStyle = style
            
            withAnimation(.easeInOut(duration: 0.1)) {
                isTransitioning = true
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.spring(response: style.duration, dampingFraction: 0.8)) {
                    currentView = AnyView(newContent)
                    isTransitioning = false
                }
            }
        }
    }
    
    // MARK: - Tab Bar with Fluid Animations
    struct FluidTabBar: View {
        @Binding var selectedTab: Int
        let tabs: [TabItem]
        let accentColor: Color
        let backgroundColor: Color
        
        @State private var indicatorOffset: CGFloat = 0
        @State private var indicatorWidth: CGFloat = 0
        @State private var tabFrames: [CGRect] = []
        
        struct TabItem {
            let id: Int
            let title: String
            let icon: String
            let badge: Int?
            
            init(id: Int, title: String, icon: String, badge: Int? = nil) {
                self.id = id
                self.title = title
                self.icon = icon
                self.badge = badge
            }
        }
        
        var body: some View {
            HStack(spacing: 0) {
                ForEach(Array(tabs.enumerated()), id: \.element.id) { index, tab in
                    TabBarItem(
                        tab: tab,
                        isSelected: selectedTab == index,
                        accentColor: accentColor,
                        action: {
                            selectTab(index)
                        }
                    )
                    .background(
                        GeometryReader { geometry in
                            Color.clear
                                .onAppear {
                                    updateTabFrame(at: index, frame: geometry.frame(in: .named("TabBarCoordinate")))
                                }
                                .onChange(of: geometry.frame(in: .named("TabBarCoordinate"))) { frame in
                                    updateTabFrame(at: index, frame: frame)
                                }
                        }
                    )
                    .flex(1)
                }
            }
            .background(
                // Animated selection indicator
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(accentColor.opacity(0.15))
                    .frame(width: indicatorWidth, height: 40)
                    .offset(x: indicatorOffset)
                    .animation(.spring(response: 0.5, dampingFraction: 0.8), value: indicatorOffset)
                    .animation(.spring(response: 0.5, dampingFraction: 0.8), value: indicatorWidth)
            )
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(backgroundColor)
                    .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 5)
            )
            .coordinateSpace(name: "TabBarCoordinate")
            .onAppear {
                updateIndicatorPosition()
            }
            .onChange(of: selectedTab) { _ in
                updateIndicatorPosition()
            }
        }
        
        private func selectTab(_ index: Int) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                selectedTab = index
            }
        }
        
        private func updateTabFrame(at index: Int, frame: CGRect) {
            if tabFrames.count <= index {
                tabFrames.append(contentsOf: Array(repeating: .zero, count: index - tabFrames.count + 1))
            }
            tabFrames[index] = frame
            updateIndicatorPosition()
        }
        
        private func updateIndicatorPosition() {
            guard selectedTab < tabFrames.count else { return }
            
            let selectedFrame = tabFrames[selectedTab]
            indicatorWidth = selectedFrame.width - 16
            indicatorOffset = selectedFrame.midX - indicatorWidth / 2
        }
    }
    
    // MARK: - Tab Bar Item
    struct TabBarItem: View {
        let tab: FluidTabBar.TabItem
        let isSelected: Bool
        let accentColor: Color
        let action: () -> Void
        
        @State private var isPressed = false
        @State private var iconScale: CGFloat = 1.0
        @State private var badgeBounce = false
        
        var body: some View {
            Button(action: action) {
                VStack(spacing: 4) {
                    ZStack {
                        Image(systemName: tab.icon)
                            .font(.system(size: 18, weight: isSelected ? .semibold : .regular))
                            .foregroundColor(isSelected ? accentColor : .secondary)
                            .scaleEffect(iconScale)
                            .conditionalEffect(.bounce, condition: isSelected && iconScale > 1.0)
                        
                        // Badge
                        if let badge = tab.badge, badge > 0 {
                            Text("\(badge)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule()
                                        .fill(.red)
                                )
                                .offset(x: 12, y: -8)
                                .scaleEffect(badgeBounce ? 1.2 : 1.0)
                                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: badgeBounce)
                        }
                    }
                    
                    Text(tab.title)
                        .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                        .foregroundColor(isSelected ? accentColor : .secondary)
                        .opacity(isSelected ? 1.0 : 0.7)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .scaleEffect(isPressed ? 0.95 : 1.0)
            .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
                withAnimation(.easeOut(duration: 0.1)) {
                    isPressed = pressing
                }
            }, perform: {})
            .onChange(of: isSelected) { selected in
                if selected {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                        iconScale = 1.2
                    }
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            iconScale = 1.0
                        }
                    }
                    
                    // Badge bounce animation
                    if tab.badge != nil {
                        badgeBounce = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                            badgeBounce = false
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Smooth Page Transition
    struct PageTransition<Content: View>: View {
        let content: Content
        let direction: TransitionDirection
        let isActive: Bool
        
        @State private var offset: CGFloat = 0
        @State private var scale: CGFloat = 1.0
        @State private var opacity: Double = 1.0
        
        enum TransitionDirection {
            case left, right, up, down
            
            var offset: CGFloat {
                switch self {
                case .left: return -300
                case .right: return 300
                case .up: return -300
                case .down: return 300
                }
            }
        }
        
        init(direction: TransitionDirection, isActive: Bool, @ViewBuilder content: () -> Content) {
            self.content = content()
            self.direction = direction
            self.isActive = isActive
        }
        
        var body: some View {
            content
                .offset(
                    x: direction == .left || direction == .right ? offset : 0,
                    y: direction == .up || direction == .down ? offset : 0
                )
                .scaleEffect(scale)
                .opacity(opacity)
                .blur(radius: isActive ? 0 : 2)
                .onAppear {
                    if !isActive {
                        offset = direction.offset
                        scale = 0.9
                        opacity = 0
                    }
                }
                .onChange(of: isActive) { active in
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                        if active {
                            offset = 0
                            scale = 1.0
                            opacity = 1.0
                        } else {
                            offset = -direction.offset
                            scale = 0.9
                            opacity = 0
                        }
                    }
                }
        }
    }
    
    // MARK: - Contextual Menu with Smooth Animations
    struct ContextualMenu: View {
        let items: [MenuItem]
        let isVisible: Bool
        let position: CGPoint
        let onDismiss: () -> Void
        
        @State private var animationOffset: CGFloat = 20
        @State private var animationOpacity: Double = 0
        @State private var itemAnimationOffsets: [CGFloat] = []
        
        struct MenuItem {
            let id = UUID()
            let title: String
            let icon: String
            let action: () -> Void
            let isDestructive: Bool
            
            init(title: String, icon: String, isDestructive: Bool = false, action: @escaping () -> Void) {
                self.title = title
                self.icon = icon
                self.isDestructive = isDestructive
                self.action = action
            }
        }
        
        var body: some View {
            if isVisible {
                ZStack {
                    // Background overlay
                    Color.black.opacity(0.1)
                        .edgesIgnoringSafeArea(.all)
                        .onTapGesture {
                            onDismiss()
                        }
                    
                    // Menu content
                    VStack(spacing: 0) {
                        ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                            MenuItemView(
                                item: item,
                                animationOffset: index < itemAnimationOffsets.count ? itemAnimationOffsets[index] : 20
                            ) {
                                item.action()
                                onDismiss()
                            }
                            
                            if index < items.count - 1 {
                                Divider()
                                    .opacity(0.3)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(.ultraThinMaterial)
                            .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
                    )
                    .position(x: position.x, y: position.y)
                    .offset(y: animationOffset)
                    .opacity(animationOpacity)
                }
                .transition(.opacity)
                .onAppear {
                    animateIn()
                }
                .onDisappear {
                    animateOut()
                }
            }
        }
        
        private func animateIn() {
            // Initialize item offsets
            itemAnimationOffsets = Array(0..<items.count).map { index in
                20 + CGFloat(index) * 5
            }
            
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                animationOffset = 0
                animationOpacity = 1.0
            }
            
            // Stagger item animations
            for (index, _) in items.enumerated() {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.05) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        if index < itemAnimationOffsets.count {
                            itemAnimationOffsets[index] = 0
                        }
                    }
                }
            }
        }
        
        private func animateOut() {
            withAnimation(.easeOut(duration: 0.2)) {
                animationOffset = -10
                animationOpacity = 0
            }
        }
    }
    
    // MARK: - Menu Item View
    struct MenuItemView: View {
        let item: ContextualMenu.MenuItem
        let animationOffset: CGFloat
        let action: () -> Void
        
        @State private var isHovered = false
        @State private var isPressed = false
        
        var body: some View {
            Button(action: action) {
                HStack(spacing: 12) {
                    Image(systemName: item.icon)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(item.isDestructive ? .red : .primary)
                        .frame(width: 20)
                    
                    Text(item.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(item.isDestructive ? .red : .primary)
                    
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(isHovered ? .white.opacity(0.1) : .clear)
                )
                .scaleEffect(isPressed ? 0.98 : 1.0)
            }
            .buttonStyle(.plain)
            .onHover { hovering in
                withAnimation(.easeOut(duration: 0.2)) {
                    isHovered = hovering
                }
            }
            .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
                withAnimation(.easeOut(duration: 0.1)) {
                    isPressed = pressing
                }
            }, perform: {})
            .offset(x: animationOffset)
        }
    }
}

// MARK: - Helper Extensions
extension View {
    func flex(_ value: Int) -> some View {
        self.frame(maxWidth: .infinity)
    }
}

// MARK: - Preview
#Preview {
    struct PreviewContainer: View {
        @State private var selectedTab = 0
        @State private var showMenu = false
        @State private var menuPosition = CGPoint(x: 200, y: 200)
        
        let tabs = [
            FluidNavigationSystem.FluidTabBar.TabItem(id: 0, title: "Home", icon: "house.fill"),
            FluidNavigationSystem.FluidTabBar.TabItem(id: 1, title: "Chat", icon: "message.fill", badge: 3),
            FluidNavigationSystem.FluidTabBar.TabItem(id: 2, title: "Tools", icon: "wrench.and.screwdriver.fill"),
            FluidNavigationSystem.FluidTabBar.TabItem(id: 3, title: "Settings", icon: "gear.circle.fill")
        ]
        
        let menuItems = [
            FluidNavigationSystem.ContextualMenu.MenuItem(title: "Edit", icon: "pencil") { print("Edit") },
            FluidNavigationSystem.ContextualMenu.MenuItem(title: "Duplicate", icon: "doc.on.doc") { print("Duplicate") },
            FluidNavigationSystem.ContextualMenu.MenuItem(title: "Share", icon: "square.and.arrow.up") { print("Share") },
            FluidNavigationSystem.ContextualMenu.MenuItem(title: "Delete", icon: "trash", isDestructive: true) { print("Delete") }
        ]
        
        var body: some View {
            VStack(spacing: 40) {
                // Tab Bar Demo
                FluidNavigationSystem.FluidTabBar(
                    selectedTab: $selectedTab,
                    tabs: tabs,
                    accentColor: .blue,
                    backgroundColor: .white.opacity(0.8)
                )
                
                // Content based on selected tab
                FluidNavigationSystem.PageTransition(
                    direction: .right,
                    isActive: selectedTab == 0
                ) {
                    Text("Home Content")
                        .font(.title)
                        .padding()
                }
                
                // Contextual Menu Trigger
                Button("Show Context Menu") {
                    showMenu = true
                }
                .onTapGesture { location in
                    menuPosition = location
                    showMenu = true
                }
                
                Spacer()
            }
            .padding()
            .overlay(
                FluidNavigationSystem.ContextualMenu(
                    items: menuItems,
                    isVisible: showMenu,
                    position: menuPosition
                ) {
                    showMenu = false
                }
            )
        }
    }
    
    return PreviewContainer()
}