// Improved Window Alignment Implementation
// This code can be integrated into UniversalAIToolsApp.swift

import SwiftUI
import AppKit

// Window Manager for better alignment and positioning
class WindowManager: ObservableObject {
    @Published var windowPositions: [String: NSPoint] = [:]
    @Published var windowSizes: [String: NSSize] = [:]
    
    private let screenPadding: CGFloat = 20
    private let windowSpacing: CGFloat = 30
    
    func getOptimalPosition(for windowType: String, size: NSSize) -> NSPoint {
        // Get screen dimensions
        guard let screen = NSScreen.main else {
            return NSPoint(x: 100, y: 100) // Fallback position
        }
        
        let screenFrame = screen.visibleFrame
        let screenWidth = screenFrame.width
        let screenHeight = screenFrame.height
        
        // Check if we have a saved position for this window type
        if let savedPosition = windowPositions[windowType] {
            // Validate that the saved position is still on screen
            if isPositionValid(savedPosition, size: size, screenFrame: screenFrame) {
                return savedPosition
            }
        }
        
        // Calculate optimal position based on existing windows
        let optimalPosition = calculateOptimalPosition(
            windowType: windowType,
            size: size,
            screenFrame: screenFrame
        )
        
        // Save the position for future use
        windowPositions[windowType] = optimalPosition
        
        return optimalPosition
    }
    
    private func isPositionValid(_ position: NSPoint, size: NSSize, screenFrame: NSRect) -> Bool {
        let windowRight = position.x + size.width
        let windowBottom = position.y + size.height
        
        return position.x >= screenFrame.minX &&
               position.y >= screenFrame.minY &&
               windowRight <= screenFrame.maxX &&
               windowBottom <= screenFrame.maxY
    }
    
    private func calculateOptimalPosition(
        windowType: String,
        size: NSSize,
        screenFrame: NSRect
    ) -> NSPoint {
        let screenWidth = screenFrame.width
        let screenHeight = screenFrame.height
        
        // Get all existing window positions
        let existingPositions = Array(windowPositions.values)
        
        // Try to find a position that doesn't overlap with existing windows
        for y in stride(from: screenHeight - size.height - screenPadding, 
                       to: screenPadding, 
                       by: -windowSpacing) {
            for x in stride(from: screenPadding, 
                           to: screenWidth - size.width - screenPadding, 
                           by: windowSpacing) {
                let candidatePosition = NSPoint(x: x, y: y)
                
                if !doesOverlapWithExistingWindows(candidatePosition, size: size, existingPositions: existingPositions) {
                    return candidatePosition
                }
            }
        }
        
        // If no non-overlapping position found, use cascade positioning
        return calculateCascadePosition(size: size, screenFrame: screenFrame)
    }
    
    private func doesOverlapWithExistingWindows(
        _ position: NSPoint,
        size: NSSize,
        existingPositions: [NSPoint]
    ) -> Bool {
        let newWindowRect = NSRect(origin: position, size: size)
        
        for existingPosition in existingPositions {
            if let existingSize = windowSizes.values.first(where: { _ in true }) {
                let existingWindowRect = NSRect(origin: existingPosition, size: existingSize)
                
                if newWindowRect.intersects(existingWindowRect) {
                    return true
                }
            }
        }
        
        return false
    }
    
    private func calculateCascadePosition(size: NSSize, screenFrame: NSRect) -> NSPoint {
        let cascadeOffset: CGFloat = 25
        let windowCount = windowPositions.count
        
        let x = screenPadding + CGFloat(windowCount) * cascadeOffset
        let y = screenFrame.height - size.height - screenPadding - CGFloat(windowCount) * cascadeOffset
        
        return NSPoint(x: x, y: y)
    }
    
    func saveWindowState(for windowType: String, position: NSPoint, size: NSSize) {
        windowPositions[windowType] = position
        windowSizes[windowType] = size
        
        // Persist to UserDefaults
        UserDefaults.standard.set(position.x, forKey: "\(windowType)_x")
        UserDefaults.standard.set(position.y, forKey: "\(windowType)_y")
        UserDefaults.standard.set(size.width, forKey: "\(windowType)_width")
        UserDefaults.standard.set(size.height, forKey: "\(windowType)_height")
    }
    
    func loadWindowState(for windowType: String) -> (position: NSPoint, size: NSSize)? {
        let x = UserDefaults.standard.double(forKey: "\(windowType)_x")
        let y = UserDefaults.standard.double(forKey: "\(windowType)_y")
        let width = UserDefaults.standard.double(forKey: "\(windowType)_width")
        let height = UserDefaults.standard.double(forKey: "\(windowType)_height")
        
        if x > 0 && y > 0 && width > 0 && height > 0 {
            return (NSPoint(x: x, y: y), NSSize(width: width, height: height))
        }
        
        return nil
    }
}

// Enhanced Window Creation Functions
extension ContentView {
    private func createAgentWindowWithImprovedAlignment(type: AgentWindowType) {
        let windowConfig = getAgentWindowConfig(for: type)
        let windowManager = WindowManager()
        
        // Get optimal position
        let size = NSSize(width: windowConfig.width, height: windowConfig.height)
        let position = windowManager.getOptimalPosition(for: windowConfig.title, size: size)
        
        let newWindow = NSWindow(
            contentRect: NSRect(origin: position, size: size),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        newWindow.title = windowConfig.title
        newWindow.contentView = NSHostingView(rootView: AgentSpecializedView(agentType: type))
        newWindow.makeKeyAndOrderFront(nil)
        
        // Set up window delegate to save state
        newWindow.delegate = WindowDelegate(windowType: windowConfig.title, windowManager: windowManager)
    }
    
    private func createWorkflowWindowWithImprovedAlignment(type: String, config: [String: Any]) {
        let windowManager = WindowManager()
        let size = NSSize(width: 1200, height: 800)
        let position = windowManager.getOptimalPosition(for: "\(type)_workflow", size: size)
        
        let newWindow = NSWindow(
            contentRect: NSRect(origin: position, size: size),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        newWindow.title = "🤖 \(type) Agent Workflow - Real-time Monitoring"
        newWindow.contentView = NSHostingView(rootView: AgentWorkflowView(workflowType: type, config: config))
        newWindow.makeKeyAndOrderFront(nil)
        
        // Set up window delegate to save state
        newWindow.delegate = WindowDelegate(windowType: "\(type)_workflow", windowManager: windowManager)
    }
}

// Window Delegate to handle window state changes
class WindowDelegate: NSObject, NSWindowDelegate {
    let windowType: String
    let windowManager: WindowManager
    
    init(windowType: String, windowManager: WindowManager) {
        self.windowType = windowType
        self.windowManager = windowManager
    }
    
    func windowDidMove(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        
        let position = window.frame.origin
        let size = window.frame.size
        
        windowManager.saveWindowState(for: windowType, position: position, size: size)
    }
    
    func windowDidResize(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        
        let position = window.frame.origin
        let size = window.frame.size
        
        windowManager.saveWindowState(for: windowType, position: position, size: size)
    }
}

// Multi-Monitor Support
extension WindowManager {
    func getOptimalMonitor(for windowType: String) -> NSScreen? {
        // For now, use the main screen
        // In the future, this could be enhanced to:
        // - Remember which monitor each window type was last used on
        // - Distribute windows across multiple monitors
        // - Respect user preferences for specific window types
        
        return NSScreen.main
    }
    
    func distributeWindowsAcrossMonitors() {
        let screens = NSScreen.screens
        guard screens.count > 1 else { return }
        
        // Distribute windows across available monitors
        // This is a placeholder for future multi-monitor support
    }
}
