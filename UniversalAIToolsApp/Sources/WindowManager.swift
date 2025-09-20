import SwiftUI

class WindowManager: ObservableObject {
    @Published var activeWindows: Set<String> = []
    @Published var windowPositions: [String: CGPoint] = [:]
    
    private let baseOffset: CGFloat = 50
    
    func createWindow(id: String, title: String, content: AnyView) {
        let newWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        newWindow.title = title
        newWindow.contentView = NSHostingView(rootView: content)
        
        // Position window
        if let position = windowPositions[id] {
            newWindow.setFrameOrigin(position)
        } else {
            newWindow.center()
            
            // Offset from current window if available
            if let currentWindow = NSApp.keyWindow {
                let currentFrame = currentWindow.frame
                let offset = calculateOffset(for: id)
                newWindow.setFrameOrigin(NSPoint(
                    x: currentFrame.origin.x + offset.x,
                    y: currentFrame.origin.y + offset.y
                ))
            }
        }
        
        newWindow.makeKeyAndOrderFront(nil)
        activeWindows.insert(id)
        
        // Store position for future use
        windowPositions[id] = newWindow.frame.origin
    }
    
    func closeWindow(id: String) {
        activeWindows.remove(id)
        windowPositions.removeValue(forKey: id)
    }
    
    private func calculateOffset(for id: String) -> CGPoint {
        let activeCount = activeWindows.count
        let angle = Double(activeCount) * 0.5 // 0.5 radians between windows
        let radius: CGFloat = 100
        
        let x = cos(angle) * radius
        let y = sin(angle) * radius
        
        return CGPoint(x: x, y: y)
    }
}
