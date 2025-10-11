import AppKit

/// Helper to restore focus to the chat editor after sending
public enum FocusHelper {
    public static func focusChatEditor() {
        guard let window = NSApp.keyWindow else { return }
        
        func findTextView(_ v: NSView) -> NSTextView? {
            if let tv = v as? NSTextView { return tv }
            for s in v.subviews {
                if let tv = findTextView(s) { return tv }
            }
            return nil
        }
        
        if let tv = findTextView(window.contentView ?? NSView()) {
            window.makeFirstResponder(tv)
        }
    }
}

