import SwiftUI
import AppKit

/// Production-grade, IME-safe text editor with bulletproof color handling
public struct KeyCatchingTextEditor: NSViewRepresentable {
    @Binding var text: String
    var onSubmit: () -> Void
    var focusOnAppear: Bool = true

    public init(text: Binding<String>, onSubmit: @escaping () -> Void, focusOnAppear: Bool = true) {
        self._text = text
        self.onSubmit = onSubmit
        self.focusOnAppear = focusOnAppear
    }

    public func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        let textView = KeyCatchingTextView()
        
        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDataDetectionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticLinkDetectionEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = true
        textView.allowsUndo = true
        textView.font = .systemFont(ofSize: NSFont.systemFontSize)
        textView.string = text
        textView.onSubmit = onSubmit
        
        // ✅ CRITICAL: Apply safe colors immediately
        textView.applySafeColorsAndTypingAttributes()
        
        textView.minSize = NSSize(width: 0, height: 0)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.textContainer?.widthTracksTextView = true
        
        scrollView.hasVerticalScroller = true
        scrollView.documentView = textView
        scrollView.drawsBackground = true
        scrollView.backgroundColor = .textBackgroundColor
        
        if focusOnAppear {
            DispatchQueue.main.async {
                scrollView.window?.makeFirstResponder(textView)
                NSApp.activate(ignoringOtherApps: true)
            }
        }
        
        context.coordinator.textView = textView
        return scrollView
    }

    public func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = context.coordinator.textView else { return }
        if textView.string != text {
            textView.string = text
            textView.applySafeColorsAndTypingAttributes()
        }
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }
    
    public final class Coordinator: NSObject, NSTextViewDelegate {
        let parent: KeyCatchingTextEditor
        weak var textView: KeyCatchingTextView?
        
        init(parent: KeyCatchingTextEditor) {
            self.parent = parent
        }
        
        public func textDidChange(_ notification: Notification) {
            guard let tv = notification.object as? NSTextView else { return }
            parent.text = tv.string
        }
    }
}

// MARK: - KeyCatchingTextView (Safe Colors + IME-Safe Input)

final class KeyCatchingTextView: NSTextView {
    var onSubmit: (() -> Void)?
    
    /// Ensures text is visible in light/dark, and typing + existing text share sane attributes
    func applySafeColorsAndTypingAttributes() {
        // ✅ Ensure the view maps colors for dark mode automatically
        usesAdaptiveColorMappingForDarkAppearance = true
        drawsBackground = true

        // ✅ Safe, dynamic system colors
        let fg = NSColor.labelColor
        let bg = NSColor.textBackgroundColor
        let caret = NSColor.labelColor

        backgroundColor = bg
        insertionPointColor = caret
        textColor = fg

        // ✅ Ensure the *typing* attributes are sane
        let font = self.font ?? .systemFont(ofSize: NSFont.systemFontSize)
        let typing: [NSAttributedString.Key: Any] = [
            .foregroundColor: fg,
            .font: font
        ]
        typingAttributes = typing

        // ✅ Ensure *existing* text also has sane attributes
        if let storage = textStorage {
            let full = NSRange(location: 0, length: storage.length)
            storage.beginEditing()
            storage.removeAttribute(.foregroundColor, range: full)
            storage.removeAttribute(.font, range: full)
            storage.addAttributes(typing, range: full)
            storage.endEditing()
        }
    }

    override var string: String {
        didSet {
            applySafeColorsAndTypingAttributes()
        }
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        applySafeColorsAndTypingAttributes()
    }

    override func viewDidChangeEffectiveAppearance() {
        super.viewDidChangeEffectiveAppearance()
        applySafeColorsAndTypingAttributes()
    }

    override var acceptsFirstResponder: Bool { true }

    // ✅ IME-safe: translate key events into commands first
    override func keyDown(with event: NSEvent) {
        interpretKeyEvents([event])
    }

    // ✅ Map commands to actions (IME-safe)
    override func doCommand(by selector: Selector) {
        switch selector {
        case #selector(insertNewline(_:)),
             #selector(NSResponder.insertNewlineIgnoringFieldEditor(_:)):
            // ENTER / Keypad Enter → submit (no newline)
            onSubmit?()
            // Don't call super (prevents newline insertion)
            
        case #selector(insertLineBreak(_:)):
            // SHIFT+ENTER → actual newline
            super.doCommand(by: selector)
            
        default:
            super.doCommand(by: selector)
        }
    }
}
