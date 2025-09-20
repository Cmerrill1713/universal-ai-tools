// Simple Window Alignment Improvements
// This code can be integrated into UniversalAIToolsApp.swift

// Enhanced window positioning with screen boundary checking
func getImprovedWindowPosition(for windowType: String, size: NSSize) -> NSPoint {
    guard let screen = NSScreen.main else {
        return NSPoint(x: 100, y: 100) // Fallback position
    }
    
    let screenFrame = screen.visibleFrame
    let screenWidth = screenFrame.width
    let screenHeight = screenFrame.height
    
    // Check if window fits on screen
    if size.width > screenWidth || size.height > screenHeight {
        // If window is too large, center it
        return NSPoint(
            x: (screenWidth - size.width) / 2,
            y: (screenHeight - size.height) / 2
        )
    }
    
    // Try to find a good position that doesn't go off-screen
    let padding: CGFloat = 20
    
    // Start from top-left with padding
    let x = max(padding, min(screenWidth - size.width - padding, padding))
    let y = max(padding, min(screenHeight - size.height - padding, screenHeight - size.height - padding))
    
    return NSPoint(x: x, y: y)
}

// Enhanced window creation with better positioning
func createImprovedAgentWindow(type: AgentWindowType) {
    let windowConfig = getAgentWindowConfig(for: type)
    let size = NSSize(width: windowConfig.width, height: windowConfig.height)
    let position = getImprovedWindowPosition(for: windowConfig.title, size: size)
    
    let newWindow = NSWindow(
        contentRect: NSRect(origin: position, size: size),
        styleMask: [.titled, .closable, .miniaturizable, .resizable],
        backing: .buffered,
        defer: false
    )
    
    newWindow.title = windowConfig.title
    newWindow.contentView = NSHostingView(rootView: AgentSpecializedView(agentType: type))
    newWindow.makeKeyAndOrderFront(nil)
}

// Enhanced workflow window creation
func createImprovedWorkflowWindow(type: String, config: [String: Any]) {
    let size = NSSize(width: 1200, height: 800)
    let position = getImprovedWindowPosition(for: "\(type)_workflow", size: size)
    
    let newWindow = NSWindow(
        contentRect: NSRect(origin: position, size: size),
        styleMask: [.titled, .closable, .miniaturizable, .resizable],
        backing: .buffered,
        defer: false
    )
    
    newWindow.title = "🤖 \(type) Agent Workflow - Real-time Monitoring"
    newWindow.contentView = NSHostingView(rootView: AgentWorkflowView(workflowType: type, config: config))
    newWindow.makeKeyAndOrderFront(nil)
}

// Enhanced new chat window creation
func createImprovedNewChatWindow() {
    let size = NSSize(width: 800, height: 600)
    let position = getImprovedWindowPosition(for: "new_chat", size: size)
    
    let newWindow = NSWindow(
        contentRect: NSRect(origin: position, size: size),
        styleMask: [.titled, .closable, .miniaturizable, .resizable],
        backing: .buffered,
        defer: false
    )
    
    newWindow.title = "Universal AI Tools - New Chat"
    newWindow.contentView = NSHostingView(rootView: ContentView())
    newWindow.makeKeyAndOrderFront(nil)
}
