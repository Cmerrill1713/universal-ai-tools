import SwiftUI
import AppKit

/// IME-safe text editor with proper Enter/Shift+Enter handling and visible colors
public struct KeyCatchingTextEditor: NSViewRepresentable {
    @Binding var text: String
    var onSubmit: () -> Void
    var focusOnAppear: Bool = true

    public init(text: Binding<String>, onSubmit: @escaping () -> Void, focusOnAppear: Bool = true) {
        self._text = text
        self.onSubmit = onSubmit
        self.focusOnAppear = focusOnAppear
    }

    public func makeNSView(context: Context) -> Wrapper {
        let w = Wrapper()
        w.textView.delegate = context.coordinator
        w.textView.isRichText = false
        w.textView.drawsBackground = true
        w.textView.backgroundColor = .textBackgroundColor       // ✅ visible
        w.textView.textColor = .labelColor                      // ✅ visible
        w.textView.insertionPointColor = .labelColor
        w.textView.usesAdaptiveColorMappingForDarkAppearance = true

        w.textView.isAutomaticQuoteSubstitutionEnabled = false
        w.textView.isAutomaticDataDetectionEnabled = false
        w.textView.isAutomaticDashSubstitutionEnabled = false
        w.textView.isAutomaticLinkDetectionEnabled = false
        w.textView.isAutomaticSpellingCorrectionEnabled = true
        w.textView.font = .monospacedSystemFont(ofSize: 13, weight: .regular)

        w.onSubmit = onSubmit
        w.getText = { text }
        w.setText = { [weak w] new in
            guard w?.textView.string != new else { return }
            w?.textView.string = new
        }

        if focusOnAppear {
            DispatchQueue.main.async {
                w.window?.makeFirstResponder(w.textView)
                NSApp.activate(ignoringOtherApps: true)
            }
        }
        return w
    }

    public func updateNSView(_ nsView: Wrapper, context: Context) {
        nsView.setText?(text)
    }

    public func makeCoordinator() -> Coordinator { Coordinator(self) }
    
    public final class Coordinator: NSObject, NSTextViewDelegate {
        let parent: KeyCatchingTextEditor
        init(_ parent: KeyCatchingTextEditor) { self.parent = parent }
        public func textDidChange(_ n: Notification) {
            guard let tv = n.object as? NSTextView else { return }
            parent.text = tv.string
        }
    }

    public final class Wrapper: NSView {
        let scroll = NSScrollView()
        let textView = InterceptingTextView()
        var onSubmit: (() -> Void)?
        var getText: (() -> String)?
        var setText: ((String) -> Void)?

        override init(frame frameRect: NSRect) {
            super.init(frame: frameRect)
            scroll.hasVerticalScroller = true
            scroll.documentView = textView
            scroll.drawsBackground = true
            scroll.backgroundColor = .textBackgroundColor  // ✅ match text view
            textView.minSize = NSSize(width: 0, height: 0)
            textView.isVerticallyResizable = true
            textView.isHorizontallyResizable = false
            textView.textContainer?.widthTracksTextView = true
            addSubview(scroll)
        }
        required init?(coder: NSCoder) { fatalError() }
        
        public override func layout() {
            super.layout()
            scroll.frame = bounds
        }

        final class InterceptingTextView: NSTextView {
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
                    (superview?.superview as? Wrapper)?.onSubmit?()
                    // Don't call super (prevents newline)
                    
                case #selector(insertLineBreak(_:)):
                    // SHIFT+ENTER → actual newline
                    super.doCommand(by: selector)
                    
                default:
                    super.doCommand(by: selector)
                }
            }
        }
    }
}
