import SwiftUI
import AppKit

// MARK: - Floating Composer (ChatGPT-style)
struct FloatingComposer: View {
    @Binding var messageText: String
    @Binding var isGenerating: Bool
    @State private var isExpanded = false
    @State private var showAttachmentMenu = false
    @State private var textHeight: CGFloat = 40
    @FocusState private var isInputFocused: Bool

    var onSend: () -> Void
    var onAttach: () -> Void
    var onStop: (() -> Void)?

    // Dynamic height calculation
    private var composerHeight: CGFloat {
        min(max(textHeight + 24, 48), 120)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Attached files preview (if any)
            if isExpanded {
                attachedFilesPreview
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .move(edge: .bottom).combined(with: .opacity)
                    ))
            }

            // Main composer container
            HStack(spacing: 12) {
                // Attachment button
                attachmentButton

                // Input field container
                inputFieldContainer

                // Send/Stop button
                actionButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(composerBackground)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .shadow(color: AppTheme.composerShadow, radius: 20, x: 0, y: 10)
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(AppTheme.composerBorder, lineWidth: 1)
            )
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isExpanded)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: composerHeight)
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
    }

    // MARK: - Components

    private var attachmentButton: some View {
        Button(action: {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                showAttachmentMenu.toggle()
            }
            onAttach()
        }) {
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 24))
                .foregroundColor(AppTheme.secondaryText)
                .rotationEffect(.degrees(showAttachmentMenu ? 45 : 0))
                .scaleEffect(showAttachmentMenu ? 1.1 : 1.0)
        }
        .buttonStyle(PlainButtonStyle())
        .help("Attach files or add context")
        .popover(isPresented: $showAttachmentMenu) {
            AttachmentMenuView()
                .frame(width: 280, height: 320)
        }
    }

    private var inputFieldContainer: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Placeholder or input
            ZStack(alignment: .topLeading) {
                if messageText.isEmpty {
                    Text("Message Universal AI Tools...")
                        .font(.system(size: 15))
                        .foregroundColor(AppTheme.tertiaryText)
                        .padding(.top, 8)
                        .padding(.horizontal, 4)
                        .allowsHitTesting(false)
                }

                // Custom text editor with dynamic height
                DynamicTextEditor(
                    text: $messageText,
                    height: $textHeight,
                    isFocused: _isInputFocused
                )
                .font(.system(size: 15))
                .foregroundColor(AppTheme.primaryText)
                .frame(minHeight: 24, maxHeight: 150)
                .padding(.vertical, 6)
                .padding(.horizontal, 4)
            }

            // Character count (optional)
            if messageText.count > 500 {
                Text("\(messageText.count) characters")
                    .font(.caption2)
                    .foregroundColor(messageText.count > 4000 ? .red : AppTheme.tertiaryText)
                    .padding(.horizontal, 4)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var actionButton: some View {
        Group {
            if isGenerating {
                // Stop button
                Button(action: { onStop?() }) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Color.red.opacity(0.9))
                            .frame(width: 28, height: 28)

                        Image(systemName: "stop.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
                .buttonStyle(PlainButtonStyle())
                .help("Stop generating")
                .transition(.scale.combined(with: .opacity))
            } else {
                // Send button
                Button(action: onSend) {
                    ZStack {
                        Circle()
                            .fill(sendButtonBackground)
                            .frame(width: 32, height: 32)

                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(sendButtonForeground)
                            .rotationEffect(.degrees(messageText.isEmpty ? 0 : 360))
                            .animation(.spring(response: 0.3), value: messageText.isEmpty)
                    }
                }
                .buttonStyle(PlainButtonStyle())
                .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .help(messageText.isEmpty ? "Type a message" : "Send message (⌘↵)")
                .keyboardShortcut(.return, modifiers: .command)
                .scaleEffect(messageText.isEmpty ? 0.9 : 1.0)
                .animation(.spring(response: 0.2, dampingFraction: 0.6), value: messageText.isEmpty)
            }
        }
    }

    private var attachedFilesPreview: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Placeholder for attached files
                ForEach(0..<3, id: \.self) { _ in
                    AttachedFileChip(fileName: "document.pdf", onRemove: {})
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .frame(height: 44)
        .background(AppTheme.surfaceBackground.opacity(0.5))
    }

    // MARK: - Computed Properties

    private var composerBackground: some View {
        ZStack {
            // Base background
            AppTheme.composerBackground

            // Glass effect overlay
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.white.opacity(0.05),
                    Color.white.opacity(0.02)
                ]),
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    private var sendButtonBackground: Color {
        messageText.isEmpty ? AppTheme.secondaryText.opacity(0.3) : AppTheme.accentGreen
    }

    private var sendButtonForeground: Color {
        messageText.isEmpty ? AppTheme.tertiaryText : .white
    }
}

// MARK: - Dynamic Text Editor
struct DynamicTextEditor: NSViewRepresentable {
    @Binding var text: String
    @Binding var height: CGFloat
    @FocusState var isFocused: Bool

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        let textView = NSTextView()

        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.font = .systemFont(ofSize: 15)
        textView.textColor = NSColor.labelColor
        textView.backgroundColor = .clear
        textView.drawsBackground = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.allowsUndo = true

        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder
        scrollView.backgroundColor = .clear
        scrollView.drawsBackground = false

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? NSTextView else { return }

        if textView.string != text {
            textView.string = text
            updateHeight(textView: textView)
        }

        // Update focus state
        if isFocused && textView.window?.firstResponder != textView {
            textView.window?.makeFirstResponder(textView)
        }
    }

    private func updateHeight(textView: NSTextView) {
        let contentSize = textView.textStorage?.size() ?? .zero
        let newHeight = contentSize.height + 16 // Add padding

        DispatchQueue.main.async {
            self.height = newHeight
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: DynamicTextEditor

        init(_ parent: DynamicTextEditor) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            parent.text = textView.string
            parent.updateHeight(textView: textView)
        }

        func textView(_ textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            // Handle Cmd+Return for send
            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                if NSEvent.modifierFlags.contains(.command) {
                    // Trigger send action
                    return true
                }
            }
            return false
        }
    }
}

// MARK: - Attachment Menu
struct AttachmentMenuView: View {
    @Environment(\.dismiss) private var dismiss

    let attachmentOptions = [
        ("doc.text.fill", "Upload from computer", Color.blue),
        ("link", "Add a link", Color.green),
        ("camera.fill", "Take a screenshot", Color.orange),
        ("folder.fill", "Browse files", Color.purple),
        ("mic.fill", "Record audio", Color.red),
        ("photo.fill", "Add image", Color.cyan)
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Add to conversation")
                    .font(.headline)
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding()

            Divider()

            // Options grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(attachmentOptions, id: \.1) { icon, label, color in
                    AttachmentOptionButton(
                        icon: icon,
                        label: label,
                        color: color,
                        action: {
                            print("Selected: \(label)")
                            dismiss()
                        }
                    )
                }
            }
            .padding()

            Spacer()
        }
        .background(AppTheme.popupBackground)
    }
}

struct AttachmentOptionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(color.opacity(isHovered ? 0.2 : 0.1))
                        .frame(width: 50, height: 50)

                    Image(systemName: icon)
                        .font(.system(size: 22))
                        .foregroundColor(color)
                }

                Text(label)
                    .font(.caption)
                    .foregroundColor(AppTheme.primaryText)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Attached File Chip
struct AttachedFileChip: View {
    let fileName: String
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "doc.fill")
                .font(.caption)
                .foregroundColor(AppTheme.accentBlue)

            Text(fileName)
                .font(.caption)
                .foregroundColor(AppTheme.primaryText)
                .lineLimit(1)

            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(AppTheme.surfaceBackground)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(AppTheme.separator, lineWidth: 1)
        )
    }
}

// MARK: - Preview
struct FloatingComposer_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            AppTheme.primaryBackground
                .ignoresSafeArea()

            VStack {
                Spacer()

                FloatingComposer(
                    messageText: .constant(""),
                    isGenerating: .constant(false),
                    onSend: {},
                    onAttach: {}
                )
            }
        }
        .frame(width: 800, height: 600)
    }
}
