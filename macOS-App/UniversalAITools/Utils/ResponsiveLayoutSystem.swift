import SwiftUI

/// Responsive layout system for adaptive UI across different window sizes and orientations
/// Provides breakpoint-based layouts, adaptive typography, and flexible grid systems
struct ResponsiveLayoutSystem {
    
    // MARK: - Breakpoint System
    enum Breakpoint: CaseIterable {
        case compact, medium, large, extraLarge
        
        var width: CGFloat {
            switch self {
            case .compact: return 0
            case .medium: return 768
            case .large: return 1024
            case .extraLarge: return 1440
            }
        }
        
        var description: String {
            switch self {
            case .compact: return "Compact (0-767px)"
            case .medium: return "Medium (768-1023px)"
            case .large: return "Large (1024-1439px)"
            case .extraLarge: return "Extra Large (1440px+)"
            }
        }
        
        static func current(for width: CGFloat) -> Breakpoint {
            for breakpoint in Breakpoint.allCases.reversed() {
                if width >= breakpoint.width {
                    return breakpoint
                }
            }
            return .compact
        }
    }
    
    // MARK: - Responsive Container
    struct ResponsiveContainer<Content: View>: View {
        let content: (Breakpoint, CGSize) -> Content
        
        @State private var size: CGSize = .zero
        @State private var currentBreakpoint: Breakpoint = .medium
        
        init(@ViewBuilder content: @escaping (Breakpoint, CGSize) -> Content) {
            self.content = content
        }
        
        var body: some View {
            GeometryReader { geometry in
                content(currentBreakpoint, geometry.size)
                    .onAppear {
                        updateLayout(for: geometry.size)
                    }
                    .onChange(of: geometry.size) { newSize in
                        updateLayout(for: newSize)
                    }
            }
        }
        
        private func updateLayout(for size: CGSize) {
            self.size = size
            self.currentBreakpoint = Breakpoint.current(for: size.width)
        }
    }
    
    // MARK: - Adaptive Grid System
    struct AdaptiveGrid<Content: View>: View {
        let items: [GridItem]
        let content: Content
        let spacing: CGFloat
        let horizontalPadding: CGFloat
        
        @State private var currentBreakpoint: Breakpoint = .medium
        @State private var adaptedColumns: [GridItem] = []
        
        init(
            columns: [GridItem],
            spacing: CGFloat = 16,
            horizontalPadding: CGFloat = 16,
            @ViewBuilder content: () -> Content
        ) {
            self.items = columns
            self.content = content()
            self.spacing = spacing
            self.horizontalPadding = horizontalPadding
        }
        
        var body: some View {
            ResponsiveContainer { breakpoint, size in
                ScrollView {
                    LazyVGrid(columns: adaptedColumns, spacing: spacing) {
                        content
                    }
                    .padding(.horizontal, horizontalPadding)
                }
                .onAppear {
                    updateGrid(for: breakpoint)
                }
                .onChange(of: breakpoint) { newBreakpoint in
                    updateGrid(for: newBreakpoint)
                }
            }
        }
        
        private func updateGrid(for breakpoint: Breakpoint) {
            currentBreakpoint = breakpoint
            
            switch breakpoint {
            case .compact:
                // Single column layout for compact screens
                adaptedColumns = [GridItem(.flexible())]
            case .medium:
                // Two columns for medium screens
                adaptedColumns = Array(repeating: GridItem(.flexible()), count: min(2, items.count))
            case .large:
                // Three columns for large screens
                adaptedColumns = Array(repeating: GridItem(.flexible()), count: min(3, items.count))
            case .extraLarge:
                // Use original grid or maximum 4 columns
                adaptedColumns = Array(repeating: GridItem(.flexible()), count: min(4, items.count))
            }
        }
    }
    
    // MARK: - Responsive Text Component
    struct ResponsiveText: View {
        let text: String
        let style: TextStyle
        let maxWidth: CGFloat?
        
        @State private var currentBreakpoint: Breakpoint = .medium
        @State private var adaptedFont: Font = .body
        @State private var adaptedLineLimit: Int? = nil
        
        enum TextStyle {
            case display, headline, title, body, caption
            
            func font(for breakpoint: Breakpoint) -> Font {
                switch (self, breakpoint) {
                case (.display, .compact):
                    return .system(size: 28, weight: .bold, design: .default)
                case (.display, .medium):
                    return .system(size: 36, weight: .bold, design: .default)
                case (.display, .large):
                    return .system(size: 48, weight: .bold, design: .default)
                case (.display, .extraLarge):
                    return .system(size: 64, weight: .bold, design: .default)
                    
                case (.headline, .compact):
                    return .system(size: 20, weight: .semibold, design: .default)
                case (.headline, .medium):
                    return .system(size: 24, weight: .semibold, design: .default)
                case (.headline, .large):
                    return .system(size: 28, weight: .semibold, design: .default)
                case (.headline, .extraLarge):
                    return .system(size: 32, weight: .semibold, design: .default)
                    
                case (.title, .compact):
                    return .system(size: 16, weight: .medium, design: .default)
                case (.title, .medium):
                    return .system(size: 18, weight: .medium, design: .default)
                case (.title, .large):
                    return .system(size: 20, weight: .medium, design: .default)
                case (.title, .extraLarge):
                    return .system(size: 22, weight: .medium, design: .default)
                    
                case (.body, .compact):
                    return .system(size: 14, weight: .regular, design: .default)
                case (.body, .medium):
                    return .system(size: 16, weight: .regular, design: .default)
                case (.body, .large):
                    return .system(size: 16, weight: .regular, design: .default)
                case (.body, .extraLarge):
                    return .system(size: 18, weight: .regular, design: .default)
                    
                case (.caption, .compact):
                    return .system(size: 12, weight: .regular, design: .default)
                case (.caption, .medium):
                    return .system(size: 13, weight: .regular, design: .default)
                case (.caption, .large):
                    return .system(size: 14, weight: .regular, design: .default)
                case (.caption, .extraLarge):
                    return .system(size: 15, weight: .regular, design: .default)
                }
            }
            
            func lineLimit(for breakpoint: Breakpoint) -> Int? {
                switch (self, breakpoint) {
                case (.display, .compact): return 2
                case (.headline, .compact): return 3
                default: return nil
                }
            }
        }
        
        init(_ text: String, style: TextStyle = .body, maxWidth: CGFloat? = nil) {
            self.text = text
            self.style = style
            self.maxWidth = maxWidth
        }
        
        var body: some View {
            ResponsiveContainer { breakpoint, size in
                Text(text)
                    .font(adaptedFont)
                    .lineLimit(adaptedLineLimit)
                    .frame(maxWidth: maxWidth ?? .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                    .onAppear {
                        updateTypography(for: breakpoint)
                    }
                    .onChange(of: breakpoint) { newBreakpoint in
                        updateTypography(for: newBreakpoint)
                    }
            }
        }
        
        private func updateTypography(for breakpoint: Breakpoint) {
            currentBreakpoint = breakpoint
            adaptedFont = style.font(for: breakpoint)
            adaptedLineLimit = style.lineLimit(for: breakpoint)
        }
    }
    
    // MARK: - Responsive Sidebar Layout
    struct ResponsiveSidebar<Sidebar: View, Content: View>: View {
        let sidebar: Sidebar
        let content: Content
        let sidebarWidth: CGFloat
        let showSidebarInCompact: Bool
        
        @State private var currentBreakpoint: Breakpoint = .medium
        @State private var showSidebar = true
        @State private var sidebarCollapsed = false
        
        init(
            sidebarWidth: CGFloat = 280,
            showSidebarInCompact: Bool = false,
            @ViewBuilder sidebar: () -> Sidebar,
            @ViewBuilder content: () -> Content
        ) {
            self.sidebarWidth = sidebarWidth
            self.showSidebarInCompact = showSidebarInCompact
            self.sidebar = sidebar()
            self.content = content()
        }
        
        var body: some View {
            ResponsiveContainer { breakpoint, size in
                Group {
                    switch breakpoint {
                    case .compact:
                        if showSidebarInCompact {
                            // Tab-based layout for compact screens
                            TabView {
                                NavigationView {
                                    content
                                }
                                .tabItem {
                                    Image(systemName: "house")
                                    Text("Main")
                                }
                                
                                NavigationView {
                                    sidebar
                                }
                                .tabItem {
                                    Image(systemName: "sidebar.left")
                                    Text("Menu")
                                }
                            }
                        } else {
                            // Full-width content only
                            content
                        }
                        
                    case .medium:
                        // Collapsible sidebar
                        HStack(spacing: 0) {
                            if showSidebar {
                                sidebar
                                    .frame(width: sidebarCollapsed ? 60 : sidebarWidth)
                                    .background(.ultraThinMaterial)
                                    .transition(.move(edge: .leading))
                            }
                            
                            content
                                .frame(maxWidth: .infinity)
                        }
                        .toolbar {
                            ToolbarItem(placement: .primaryAction) {
                                Button(action: toggleSidebar) {
                                    Image(systemName: "sidebar.left")
                                }
                            }
                        }
                        
                    case .large, .extraLarge:
                        // Always show sidebar
                        HStack(spacing: 0) {
                            sidebar
                                .frame(width: sidebarWidth)
                                .background(.ultraThinMaterial)
                            
                            content
                                .frame(maxWidth: .infinity)
                        }
                }
                .onAppear {
                    updateLayout(for: breakpoint)
                }
                .onChange(of: breakpoint) { newBreakpoint in
                    updateLayout(for: newBreakpoint)
                }
            }
        }
        
        private func updateLayout(for breakpoint: Breakpoint) {
            currentBreakpoint = breakpoint
            
            switch breakpoint {
            case .compact:
                showSidebar = showSidebarInCompact
            case .medium:
                showSidebar = true
                sidebarCollapsed = false
            case .large, .extraLarge:
                showSidebar = true
                sidebarCollapsed = false
            }
        }
        
        private func toggleSidebar() {
            withAnimation(.easeInOut(duration: 0.3)) {
                if currentBreakpoint == .medium {
                    sidebarCollapsed.toggle()
                } else {
                    showSidebar.toggle()
                }
            }
        }
    }
    
    // MARK: - Responsive Card Grid
    struct ResponsiveCardGrid<Content: View>: View {
        let content: Content
        let cardMinWidth: CGFloat
        let spacing: CGFloat
        let padding: CGFloat
        
        @State private var cardWidth: CGFloat = 300
        @State private var columns: Int = 1
        
        init(
            cardMinWidth: CGFloat = 280,
            spacing: CGFloat = 16,
            padding: CGFloat = 16,
            @ViewBuilder content: () -> Content
        ) {
            self.cardMinWidth = cardMinWidth
            self.spacing = spacing
            self.padding = padding
            self.content = content()
        }
        
        var body: some View {
            ResponsiveContainer { breakpoint, size in
                let availableWidth = size.width - (padding * 2)
                let calculatedColumns = max(1, Int(availableWidth / (cardMinWidth + spacing)))
                let calculatedCardWidth = (availableWidth - CGFloat(calculatedColumns - 1) * spacing) / CGFloat(calculatedColumns)
                
                ScrollView {
                    LazyVGrid(
                        columns: Array(repeating: GridItem(.fixed(calculatedCardWidth)), count: calculatedColumns),
                        spacing: spacing
                    ) {
                        content
                    }
                    .padding(padding)
                }
                .onAppear {
                    updateGrid(columns: calculatedColumns, cardWidth: calculatedCardWidth)
                }
                .onChange(of: calculatedColumns) { newColumns in
                    updateGrid(columns: newColumns, cardWidth: calculatedCardWidth)
                }
            }
        }
        
        private func updateGrid(columns: Int, cardWidth: CGFloat) {
            self.columns = columns
            self.cardWidth = cardWidth
        }
    }
    
    // MARK: - Responsive Stack
    struct ResponsiveStack<Content: View>: View {
        let content: Content
        let axis: Axis
        let spacing: CGFloat
        let alignment: Alignment
        
        @State private var currentAxis: Axis = .horizontal
        
        enum Axis {
            case horizontal, vertical, adaptive
        }
        
        init(
            axis: Axis = .adaptive,
            spacing: CGFloat = 16,
            alignment: Alignment = .center,
            @ViewBuilder content: () -> Content
        ) {
            self.axis = axis
            self.spacing = spacing
            self.alignment = alignment
            self.content = content()
        }
        
        var body: some View {
            ResponsiveContainer { breakpoint, size in
                Group {
                    if currentAxis == .vertical {
                        VStack(spacing: spacing) {
                            content
                        }
                        .frame(maxWidth: .infinity, alignment: alignment)
                    } else {
                        HStack(spacing: spacing) {
                            content
                        }
                        .frame(maxWidth: .infinity, alignment: alignment)
                    }
                }
                .onAppear {
                    updateAxis(for: breakpoint, size: size)
                }
                .onChange(of: breakpoint) { newBreakpoint in
                    updateAxis(for: newBreakpoint, size: size)
                }
                .onChange(of: size) { newSize in
                    updateAxis(for: breakpoint, size: newSize)
                }
            }
        }
        
        private func updateAxis(for breakpoint: Breakpoint, size: CGSize) {
            switch axis {
            case .horizontal:
                currentAxis = .horizontal
            case .vertical:
                currentAxis = .vertical
            case .adaptive:
                // Switch to vertical on compact screens or when width is very constrained
                currentAxis = (breakpoint == .compact || size.width < 600) ? .vertical : .horizontal
            }
        }
    }
    
    // MARK: - Responsive Spacing Helper
    struct ResponsiveSpacing {
        static func padding(for breakpoint: Breakpoint) -> EdgeInsets {
            switch breakpoint {
            case .compact:
                return EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)
            case .medium:
                return EdgeInsets(top: 16, leading: 24, bottom: 16, trailing: 24)
            case .large:
                return EdgeInsets(top: 20, leading: 32, bottom: 20, trailing: 32)
            case .extraLarge:
                return EdgeInsets(top: 24, leading: 40, bottom: 24, trailing: 40)
            }
        }
        
        static func spacing(for breakpoint: Breakpoint) -> CGFloat {
            switch breakpoint {
            case .compact: return 8
            case .medium: return 12
            case .large: return 16
            case .extraLarge: return 20
            }
        }
    }
}

// MARK: - View Extensions
extension View {
    func responsiveText(_ text: String, style: ResponsiveLayoutSystem.ResponsiveText.TextStyle = .body) -> some View {
        ResponsiveLayoutSystem.ResponsiveText(text, style: style)
    }
    
    func responsivePadding() -> some View {
        ResponsiveLayoutSystem.ResponsiveContainer { breakpoint, _ in
            self.padding(ResponsiveLayoutSystem.ResponsiveSpacing.padding(for: breakpoint))
        }
    }
    
    func responsiveFrame(minWidth: CGFloat? = nil, maxWidth: CGFloat? = nil) -> some View {
        ResponsiveLayoutSystem.ResponsiveContainer { breakpoint, size in
            let adaptedMaxWidth = maxWidth ?? {
                switch breakpoint {
                case .compact: return size.width - 32
                case .medium: return min(768, size.width - 64)
                case .large: return min(1024, size.width - 128)
                case .extraLarge: return min(1200, size.width - 160)
                }
            }()
            
            self.frame(
                minWidth: minWidth,
                maxWidth: adaptedMaxWidth
            )
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        ResponsiveLayoutSystem.ResponsiveText(
            "Responsive Headline",
            style: .headline
        )
        
        ResponsiveLayoutSystem.ResponsiveText(
            "This is body text that adapts its size based on the current breakpoint and available space.",
            style: .body
        )
        
        ResponsiveLayoutSystem.ResponsiveStack(axis: .adaptive, spacing: 16) {
            Rectangle()
                .fill(.blue)
                .frame(height: 100)
            
            Rectangle()
                .fill(.green)
                .frame(height: 100)
            
            Rectangle()
                .fill(.orange)
                .frame(height: 100)
        }
        
        ResponsiveLayoutSystem.AdaptiveGrid(
            columns: Array(repeating: GridItem(.flexible()), count: 3)
        ) {
            ForEach(0..<6, id: \.self) { index in
                Rectangle()
                    .fill(.purple.opacity(0.7))
                    .frame(height: 80)
                    .cornerRadius(8)
            }
        }
        .frame(height: 200)
    }
    .padding()
}