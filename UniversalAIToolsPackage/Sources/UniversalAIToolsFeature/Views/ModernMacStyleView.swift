import SwiftUI

/// Modern macOS-inspired interface for iOS/iPad that follows Apple's design language
/// Uses NavigationSplitView for iPad and adaptive navigation for iPhone
@MainActor
public struct ModernMacStyleView: View {
    @State private var selectedItem: NavigationItem?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var searchText = ""
    @State private var isSearching = false
    
    // Services
    @State private var supabaseService = SupabaseService.shared
    @State private var analyticsManager = AnalyticsManager.shared
    @StateObject private var cacheManager = OfflineCacheManager.shared
    
    public init() {
        // Set initial selection
        _selectedItem = State(initialValue: navigationItems.first)
    }
    
    private var navigationItems: [NavigationItem] {
        [
            NavigationItem(
                id: .home,
                name: "Dashboard",
                sfSymbol: "house.fill",
                description: "Overview and insights",
                color: .blue
            ),
            NavigationItem(
                id: .chat,
                name: "Conversations",
                sfSymbol: "bubble.left.and.bubble.right.fill",
                description: "AI chat assistant",
                color: .green,
                badge: "3"
            ),
            NavigationItem(
                id: .vision,
                name: "Vision",
                sfSymbol: "eye.fill",
                description: "Image analysis",
                color: .orange
            ),
            NavigationItem(
                id: .voice,
                name: "Voice",
                sfSymbol: "mic.fill",
                description: "Voice commands",
                color: .purple
            ),
            NavigationItem(
                id: .agents,
                name: "Agents",
                sfSymbol: "cpu",
                description: "AI automation",
                color: .red,
                badge: "New"
            ),
            NavigationItem(
                id: .analytics,
                name: "Analytics",
                sfSymbol: "chart.line.uptrend.xyaxis",
                description: "Usage insights",
                color: .mint
            ),
            NavigationItem(
                id: .settings,
                name: "Settings",
                sfSymbol: "gearshape.fill",
                description: "Preferences",
                color: .gray
            )
        ]
    }
    
    public var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // Sidebar
            sidebarContent
                .navigationTitle("Universal AI")
                .navigationBarTitleDisplayModeCompat(.large)
                #if os(iOS)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        EditButton()
                    }
                }
                #endif
        } detail: {
            // Detail View
            if let selectedItem = selectedItem {
                DetailView(for: selectedItem)
                    .id(selectedItem.id)
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
            } else {
                EmptyStateView()
            }
        }
        .navigationSplitViewStyle(.balanced)
        .searchable(text: $searchText, isPresented: $isSearching, prompt: "Search features...")
        .onChange(of: searchText) { newValue in
            handleSearch(newValue)
        }
        .tint(.blue)
        .preferredColorScheme(.dark)
        .environment(supabaseService)
        .environmentObject(cacheManager)
        .task {
            await setupInitialState()
        }
    }
    
    // MARK: - Sidebar Content
    private var sidebarContent: some View {
        List(selection: $selectedItem) {
            // User Profile Section
            Section {
                UserProfileRow()
                    .listRowSeparator(.hidden)
            }
            
            // Main Navigation
            Section("Navigation") {
                ForEach(navigationItems.filter { $0.id != .settings }, id: \.self) { item in
                    NavigationRow(item: item, isSelected: selectedItem?.id == item.id)
                        .tag(item)
                }
            }
            
            // Settings
            Section {
                if let settingsItem = navigationItems.first(where: { $0.id == .settings }) {
                    NavigationRow(item: settingsItem, isSelected: selectedItem?.id == settingsItem.id)
                        .tag(settingsItem)
                }
            }
        }
        .listStyle(.sidebar)
    }
    
    // MARK: - Detail View Builder
    @ViewBuilder
    private func DetailView(for item: NavigationItem) -> some View {
        switch item.id {
        case .home:
            ModernDashboardView()
        case .chat:
            ModernChatView()
        case .vision:
            ModernVisionView()
        case .voice:
            ModernVoiceView()
        case .agents:
            ModernAgentsView()
        case .analytics:
            ModernAnalyticsView()
        case .settings:
            ModernSettingsView()
        }
    }
    
    // MARK: - Helper Methods
    private func handleSearch(_ query: String) {
        // Implement search functionality
        if !query.isEmpty {
            print("Searching for: \(query)")
        }
    }
    
    private func setupInitialState() async {
        // Initialize services
        analyticsManager.trackEvent(.sessionStarted)
    }
}

// MARK: - Navigation Row
struct NavigationRow: View {
    let item: NavigationItem
    let isSelected: Bool
    @State private var isHovered = false
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.sfSymbol)
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(isSelected ? .white : item.color)
                .frame(width: 28, height: 28)
                .background {
                    if #available(iOS 26.0, *) {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(isSelected ? item.color : item.color.opacity(0.15))
                            .glassEffect(
                                isSelected ? .glossy : .subtle,
                                in: RoundedRectangle(cornerRadius: 8),
                                isEnabled: isSelected || isHovered
                            )
                    } else {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(isSelected ? item.color : item.color.opacity(0.15))
                    }
                }
                .scaleEffect(isHovered ? 1.05 : 1.0)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(item.name)
                        .font(.system(size: 15, weight: isSelected ? .semibold : .medium))
                        .foregroundColor(.primary)
                    
                    if let badge = item.badge {
                        Text(badge)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(item.color)
                            .cornerRadius(4)
                    }
                }
                
                Text(item.description)
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isSelected ? Color.accentColor.opacity(0.1) : (isHovered ? Color.gray.opacity(0.05) : Color.clear))
        )
        .contentShape(Rectangle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - User Profile Row
struct UserProfileRow: View {
    @State private var showingProfile = false
    
    var body: some View {
        Button(action: { showingProfile.toggle() }) {
            HStack(spacing: 12) {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.blue)
                    .symbolRenderingMode(.multicolor)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Christian M")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.primary)
                    
                    Text("Premium Account")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.tertiary)
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showingProfile) {
            ProfileSettingsView()
        }
    }
}

// MARK: - Empty State View
struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "sparkles")
                .font(.system(size: 64))
                .foregroundColor(.blue)
                .symbolEffect(.pulse)
            
            Text("Welcome to Universal AI Tools")
                .font(.title2)
                .fontWeight(.bold)
            
            Text("Select an option from the sidebar to begin")
                .font(.body)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

// MARK: - Modern View Components
struct ModernDashboardView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Dashboard")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Your AI-powered workspace overview")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal)
                
                // Stats Grid
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 16) {
                    StatCard(title: "Conversations", value: "247", icon: "bubble.left.and.bubble.right.fill", color: .green)
                    StatCard(title: "Images Analyzed", value: "89", icon: "eye.fill", color: .orange)
                    StatCard(title: "Voice Commands", value: "156", icon: "mic.fill", color: .purple)
                    StatCard(title: "Active Agents", value: "12", icon: "cpu", color: .red)
                }
                .padding(.horizontal)
                
                // Quick Actions
                VStack(alignment: .leading, spacing: 16) {
                    Text("Quick Actions")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .padding(.horizontal)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            QuickActionButton(title: "New Chat", icon: "plus.bubble.fill", color: .green)
                            QuickActionButton(title: "Upload Image", icon: "photo.badge.plus.fill", color: .orange)
                            QuickActionButton(title: "Voice Note", icon: "mic.badge.plus", color: .purple)
                            QuickActionButton(title: "Create Agent", icon: "cpu.fill", color: .red)
                        }
                        .padding(.horizontal)
                    }
                }
                
                // Recent Activity
                VStack(alignment: .leading, spacing: 16) {
                    Text("Recent Activity")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .padding(.horizontal)
                    
                    VStack(spacing: 0) {
                        ActivityRow(icon: "bubble.left.fill", title: "Chat with AI", subtitle: "2 minutes ago", color: .green)
                        Divider()
                        ActivityRow(icon: "photo", title: "Image Analysis", subtitle: "15 minutes ago", color: .orange)
                        Divider()
                        ActivityRow(icon: "mic", title: "Voice Command", subtitle: "1 hour ago", color: .purple)
                    }
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(12)
                    .padding(.horizontal)
                }
                
                Spacer(minLength: 40)
            }
            .padding(.vertical)
        }
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayModeCompat(.large)
    }
}

struct ModernChatView: View {
    var body: some View {
        AIChatView()
            .navigationTitle("Conversations")
            .navigationBarTitleDisplayModeCompat(.large)
    }
}

struct ModernVisionView: View {
    var body: some View {
        VisionAnalysisView()
            .navigationTitle("Vision Analysis")
            .navigationBarTitleDisplayModeCompat(.large)
    }
}

struct ModernVoiceView: View {
    var body: some View {
        VoiceAssistantView()
            .navigationTitle("Voice Assistant")
            .navigationBarTitleDisplayModeCompat(.large)
    }
}

struct ModernAgentsView: View {
    var body: some View {
        AgentsManagementView()
    }
}

struct ModernAnalyticsView: View {
    var body: some View {
        AnalyticsDashboardView()
            .navigationTitle("Analytics")
            .navigationBarTitleDisplayModeCompat(.large)
    }
}

struct ModernSettingsView: View {
    var body: some View {
        AdvancedSettingsView()
            .navigationTitle("Settings")
            .navigationBarTitleDisplayModeCompat(.large)
    }
}

// MARK: - Supporting Components
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                
                Spacer()
            }
            
            Text(value)
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundColor(.primary)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background {
            if #available(iOS 26.0, *) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.secondarySystemBackground))
                    .glassEffect(
                        .subtle,
                        in: RoundedRectangle(cornerRadius: 12),
                        isEnabled: true
                    )
            } else {
                Color(.secondarySystemBackground)
            }
        }
        .cornerRadius(12)
    }
}

struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    @State private var isPressed = false
    
    var body: some View {
        Button(action: {}) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                    .frame(width: 50, height: 50)
                    .background(color.opacity(0.15))
                    .cornerRadius(12)
                
                Text(title)
                    .font(.caption)
                    .foregroundColor(.primary)
            }
            .frame(width: 80)
        }
        .buttonStyle(.plain)
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            withAnimation(.easeInOut(duration: 0.1)) {
                isPressed = pressing
            }
        }, perform: {})
    }
}

struct ActivityRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(color)
                .frame(width: 32, height: 32)
                .background(color.opacity(0.15))
                .cornerRadius(8)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.primary)
                
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.tertiary)
        }
        .padding()
    }
}

struct AgentCard: View {
    enum Status {
        case active, idle
        
        var color: Color {
            switch self {
            case .active: return .green
            case .idle: return .orange
            }
        }
        
        var text: String {
            switch self {
            case .active: return "Active"
            case .idle: return "Idle"
            }
        }
    }
    
    let name: String
    let status: Status
    let description: String
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(name)
                    .font(.headline)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 4) {
                Circle()
                    .fill(status.color)
                    .frame(width: 8, height: 8)
                
                Text(status.text)
                    .font(.caption)
                    .foregroundColor(status.color)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.color.opacity(0.15))
            .cornerRadius(6)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct ProfileSettingsView: View {
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            VStack {
                Text("Profile Settings")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Spacer()
            }
            .padding()
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailingCompat) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Preview
#Preview {
    ModernMacStyleView()
}