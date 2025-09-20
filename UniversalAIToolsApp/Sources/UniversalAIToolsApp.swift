import SwiftUI

@main
struct UniversalAIToolsApp: App {
    @StateObject private var windowManager = WindowManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(windowManager)
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        
        // Additional windows for different agent types
        WindowGroup("Agent Planner", id: "planner") {
            AgentPlannerView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        
        WindowGroup("Research Agent", id: "research") {
            ResearchAgentView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        
        WindowGroup("Implementation Agent", id: "implementation") {
            ImplementationAgentView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        
        WindowGroup("HRM Agent", id: "hrm") {
            HRMAgentView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        
        WindowGroup("System Monitoring", id: "monitoring") {
            MonitoringDashboard()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
    }
}

struct ContentView: View {
    @EnvironmentObject var windowManager: WindowManager
    @StateObject private var chatManager = ChatManager()
    @State private var showingSettings = false
    @State private var isDarkMode = false
    @AppStorage("selectedTheme") private var selectedTheme = "auto"
    
    var body: some View {
        VStack(spacing: 0) {
            // Enhanced Header with gradient background
            VStack(spacing: 0) {
                HStack(alignment: .center) {
                    // Enhanced logo with gradient
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [.blue, .purple]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 48, height: 48)
                            .shadow(color: .blue.opacity(0.3), radius: 4, x: 0, y: 2)
                        
                        Image(systemName: "brain.head.profile")
                            .font(.title2)
                            .foregroundColor(.white)
                            .fontWeight(.semibold)
                    }
                    
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Universal AI Tools")
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundStyle(.primary)
                        
                        Text("Integrated Knowledge Grounding System")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    
                    Spacer()
                    
                    // Theme toggle button
                    Button(action: {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                            selectedTheme = selectedTheme == "light" ? "dark" : selectedTheme == "dark" ? "auto" : "light"
                        }
                    }) {
                        Image(systemName: themeIcon)
                            .font(.title3)
                            .foregroundColor(.blue)
                            .rotationEffect(.degrees(selectedTheme == "dark" ? 180 : 0))
                            .animation(.spring(response: 0.4, dampingFraction: 0.7), value: selectedTheme)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .frame(width: 36, height: 36)
                    .background(
                        Circle()
                            .fill(.ultraThinMaterial)
                            .overlay(
                                Circle()
                                    .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                            )
                    )
                    .help(themeHelpText)
                    
                    // Enhanced settings button
                    Button(action: { 
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            showingSettings = true 
                        }
                    }) {
                        Image(systemName: "gearshape.fill")
                            .font(.title3)
                            .foregroundColor(.blue)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .frame(width: 36, height: 36)
                    .background(
                        Circle()
                            .fill(.ultraThinMaterial)
                            .overlay(
                                Circle()
                                    .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                            )
                    )
                    .scaleEffect(showingSettings ? 1.1 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: showingSettings)
                }
                .padding(.horizontal, 24)
                .padding(.top, 20)
                .padding(.bottom, 16)
            }
            .background(
                ZStack {
                    // Dynamic theme-based gradient
                    LinearGradient(
                        gradient: Gradient(colors: themeColors),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    
                    // Glassmorphism overlay
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .opacity(0.8)
                }
            )
            
            Divider()
            
            // Main Content
            VStack(spacing: 24) {
                // Agentic Task Pop-out Menu
                VStack(spacing: 8) {
                    Text("Agent Tasks")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    Menu {
                        Button("🤖 Agent Planner", action: { createAgentWindow(type: .planner) })
                        Button("🔬 Research Agent", action: { createAgentWindow(type: .research) })
                        Button("⚙️ Implementation Agent", action: { createAgentWindow(type: .implementation) })
                        Button("🧠 HRM Agent", action: { createAgentWindow(type: .hrm) })
                        Divider()
                        Button("📊 System Monitoring", action: { createMonitoringWindow() })
                        Button("📋 General Chat", action: { createPopOutWindow() })
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .font(.title3)
                            Text("Open Agent")
                                .font(.body)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(.blue)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                    }
                    .frame(maxWidth: .infinity)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(12)
                }
                
                // Quick Actions
                VStack(spacing: 12) {
                    Text("Quick Actions")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    HStack(spacing: 16) {
                        QuickActionButton(
                            title: "Chat",
                            icon: "message",
                            action: { createPopOutWindow() }
                        )
                        
                        QuickActionButton(
                            title: "Monitor",
                            icon: "chart.line.uptrend.xyaxis",
                            action: { createMonitoringWindow() }
                        )
                        
                        QuickActionButton(
                            title: "Knowledge",
                            icon: "brain.head.profile",
                            action: { createKnowledgeWindow() }
                        )
                    }
                }
                
                // Status Indicators
                VStack(spacing: 12) {
                    Text("Service Status")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    VStack(spacing: 8) {
                        StatusIndicator(
                            title: "Chat Service",
                            status: .unknown,
                            url: "http://localhost:8010"
                        )
                        
                        StatusIndicator(
                            title: "Knowledge Gateway",
                            status: .unknown,
                            url: "http://localhost:8088"
                        )
                        
                        StatusIndicator(
                            title: "Monitoring",
                            status: .unknown,
                            url: "http://localhost:9091"
                        )
                    }
                }
            }
            .padding()
            
            Spacer()
        }
        .frame(width: 400, height: 500)
        .preferredColorScheme(selectedTheme == "light" ? .light : selectedTheme == "dark" ? .dark : nil)
        .sheet(isPresented: $showingSettings) {
            SettingsView()
        }
    }
    
    // MARK: - Theme Support
    
    private var themeIcon: String {
        switch selectedTheme {
        case "light": return "sun.max.fill"
        case "dark": return "moon.fill"
        default: return "circle.lefthalf.filled"
        }
    }
    
    private var themeHelpText: String {
        switch selectedTheme {
        case "light": return "Switch to Dark Mode"
        case "dark": return "Switch to Auto Mode"
        default: return "Switch to Light Mode"
        }
    }
    
    private var themeColors: [Color] {
        switch selectedTheme {
        case "light":
            return [
                Color.blue.opacity(0.08),
                Color.purple.opacity(0.05),
                Color.clear
            ]
        case "dark":
            return [
                Color.blue.opacity(0.12),
                Color.purple.opacity(0.08),
                Color.black.opacity(0.1)
            ]
        default: // auto
            return [
                Color.blue.opacity(0.06),
                Color.purple.opacity(0.04),
                Color.clear
            ]
        }
    }
    
    private func createAgentWindow(type: AgentType) {
        let newWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        newWindow.title = "\(type.displayName) - Universal AI Tools"
        
        let contentView: AnyView
        switch type {
        case .planner:
            contentView = AnyView(AgentPlannerView())
        case .research:
            contentView = AnyView(ResearchAgentView())
        case .implementation:
            contentView = AnyView(ImplementationAgentView())
        case .hrm:
            contentView = AnyView(HRMAgentView())
        }
        
        newWindow.contentView = NSHostingView(rootView: contentView)
        newWindow.center()
        newWindow.makeKeyAndOrderFront(nil)
        
        // Add some offset so windows don't overlap
        if let currentWindow = NSApp.keyWindow {
            let currentFrame = currentWindow.frame
            newWindow.setFrameOrigin(NSPoint(
                x: currentFrame.origin.x + 50,
                y: currentFrame.origin.y - 50
            ))
        }
    }
    
    private func createMonitoringWindow() {
        let newWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1000, height: 700),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        newWindow.title = "📊 System Monitoring Dashboard"
        newWindow.contentView = NSHostingView(rootView: MonitoringDashboard())
        newWindow.center()
        newWindow.makeKeyAndOrderFront(nil)
        
        // Add some offset so windows don't overlap
        if let currentWindow = NSApp.keyWindow {
            let currentFrame = currentWindow.frame
            newWindow.setFrameOrigin(NSPoint(
                x: currentFrame.origin.x + 50,
                y: currentFrame.origin.y - 50
            ))
        }
    }
    
    private func createPopOutWindow() {
        let newWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        newWindow.title = "💬 Universal AI Chat"
        newWindow.contentView = NSHostingView(rootView: ChatView().environmentObject(chatManager))
        newWindow.center()
        newWindow.makeKeyAndOrderFront(nil)
        
        // Add some offset so windows don't overlap
        if let currentWindow = NSApp.keyWindow {
            let currentFrame = currentWindow.frame
            newWindow.setFrameOrigin(NSPoint(
                x: currentFrame.origin.x + 50,
                y: currentFrame.origin.y - 50
            ))
        }
    }
    
    private func createKnowledgeWindow() {
        let newWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 650),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        newWindow.title = "🧠 Knowledge Management"
        newWindow.contentView = NSHostingView(rootView: KnowledgeManagementView())
        newWindow.center()
        newWindow.makeKeyAndOrderFront(nil)
        
        // Add some offset so windows don't overlap
        if let currentWindow = NSApp.keyWindow {
            let currentFrame = currentWindow.frame
            newWindow.setFrameOrigin(NSPoint(
                x: currentFrame.origin.x + 50,
                y: currentFrame.origin.y - 50
            ))
        }
    }
}

// MARK: - Supporting Views

struct QuickActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void
    
    @State private var isHovered = false
    @State private var isPressed = false
    
    private let hapticFeedback = NSHapticFeedbackManager.defaultPerformer
    
    var body: some View {
        Button(action: {
            // Haptic feedback
            hapticFeedback.perform(.alignment, performanceTime: .default)
            
            // Execute action with animation
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                action()
            }
        }) {
            VStack(spacing: 8) {
                // Icon with animated background
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.blue.opacity(isHovered ? 0.3 : 0.2),
                                    Color.purple.opacity(isHovered ? 0.2 : 0.1)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 32, height: 32)
                        .scaleEffect(isHovered ? 1.1 : 1.0)
                        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isHovered)
                    
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.blue)
                        .scaleEffect(isHovered ? 1.1 : 1.0)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
                }
                
                Text(title)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                    .scaleEffect(isHovered ? 1.05 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .padding(.horizontal, 12)
        }
        .buttonStyle(PlainButtonStyle())
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.blue.opacity(isHovered ? 0.12 : 0.06),
                            Color.purple.opacity(isHovered ? 0.08 : 0.04)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            LinearGradient(
                                gradient: Gradient(colors: [
                                    Color.blue.opacity(isHovered ? 0.4 : 0.2),
                                    Color.purple.opacity(isHovered ? 0.3 : 0.15)
                                ]),
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: isHovered ? 1.5 : 1
                        )
                )
        )
        .shadow(
            color: Color.blue.opacity(isHovered ? 0.15 : 0.08),
            radius: isHovered ? 6 : 3,
            x: 0,
            y: isHovered ? 3 : 1
        )
        .scaleEffect(isPressed ? 0.95 : (isHovered ? 1.03 : 1.0))
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isHovered)
        .animation(.spring(response: 0.2, dampingFraction: 0.8), value: isPressed)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            withAnimation(.easeInOut(duration: 0.1)) {
                isPressed = pressing
            }
        }, perform: {})
        .accessibilityLabel(title)
        .accessibilityHint("Double tap to \(title.lowercased())")
        .accessibilityAddTraits(.isButton)
    }
}

struct StatusIndicator: View {
    let title: String
    let status: ConnectionStatus
    let url: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: status.icon)
                .foregroundColor(status.color)
                .font(.system(size: 16))
                .frame(width: 20, height: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(url)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Text(status.text)
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(status.color)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(status.color.opacity(0.1))
                .cornerRadius(6)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Supporting Types

enum AgentType {
    case planner, research, implementation, hrm
    
    var displayName: String {
        switch self {
        case .planner: return "Agent Planner"
        case .research: return "Research Agent"
        case .implementation: return "Implementation Agent"
        case .hrm: return "HRM Agent"
        }
    }
}

enum ConnectionStatus {
    case connected, disconnected, unknown
    
    var icon: String {
        switch self {
        case .connected: return "checkmark.circle.fill"
        case .disconnected: return "xmark.circle.fill"
        case .unknown: return "questionmark.circle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .connected: return .green
        case .disconnected: return .red
        case .unknown: return .orange
        }
    }
    
    var text: String {
        switch self {
        case .connected: return "Connected"
        case .disconnected: return "Disconnected"
        case .unknown: return "Unknown"
        }
    }
}
