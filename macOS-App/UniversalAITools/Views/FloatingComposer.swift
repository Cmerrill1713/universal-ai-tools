import AppKit
import SwiftUI

// MARK: - Floating Composer (ChatGPT-style)
struct FloatingComposer: View {
    @Binding var messageText: String
    @Binding var isGenerating: Bool
    @State private var isExpanded = false
    @State private var showAttachmentMenu = false
    @State private var textHeight: CGFloat = 40
    @State private var isRecording = false
    @State private var isPlayingResponse = false
    @State private var selectedVoice = "af_bella"
    @FocusState private var isInputFocused: Bool

    var attachedFiles: [URL] = []
    var onSend: () -> Void
    var onAttach: () -> Void
    var onStop: (() -> Void)?
    var onRemoveAttachment: ((URL) -> Void)?

    // Dynamic height calculation
    private var composerHeight: CGFloat {
        min(max(textHeight + 24, 48), 120)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Attached files preview (if any)
            if isExpanded || !attachedFiles.isEmpty {
                attachedFilesPreview
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // Main composer container
            HStack(spacing: 12) {
                // Attachment button
                attachmentButton

                // Microphone button
                microphoneButton

                // Input field container
                inputFieldContainer

                // Send/Stop button
                actionButton
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
            .glassMorphism(cornerRadius: 24)
            .glow(color: isInputFocused ? .blue : .clear, radius: isInputFocused ? 15 : 0)
            .floating(amplitude: 2, duration: 4)
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
                .glow(color: showAttachmentMenu ? .blue : .clear, radius: showAttachmentMenu ? 8 : 0)
        }
        .buttonStyle(PlainButtonStyle())
        .neumorphism(isPressed: showAttachmentMenu, cornerRadius: 12)
        .frame(width: 32, height: 32)
        .help("Attach files or add context")
        .popover(isPresented: $showAttachmentMenu) {
            AttachmentMenuView()
                .frame(width: 280, height: 320)
        }
    }

    private var microphoneButton: some View {
        Button(action: {
            toggleRecording()
        }) {
            ZStack {
                Circle()
                    .fill(isRecording ? Color.red.opacity(0.8) : AppTheme.surfaceBackground)
                    .frame(width: 32, height: 32)

                Image(systemName: isRecording ? "mic.fill" : "mic")
                    .font(.system(size: 16))
                    .foregroundColor(isRecording ? .white : AppTheme.secondaryText)
            }
        }
        .buttonStyle(PlainButtonStyle())
        .help(isRecording ? "Stop recording" : "Start voice input")
        .scaleEffect(isRecording ? 1.1 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isRecording)
    }

    private var inputFieldContainer: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Input hint or text
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
        ZStack {
            if isGenerating {
                // Enhanced Stop button with particles
                Button(action: { onStop?() }) {
                    ZStack {
                        Circle()
                            .fill(Color.red.gradient)
                            .frame(width: 32, height: 32)
                            .glow(color: .red, radius: 8)

                        Image(systemName: "stop.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
                .buttonStyle(PlainButtonStyle())
                .help("Stop generating")
                .transition(.scale.combined(with: .opacity))
            } else {
                // Enhanced Send button with particles
                ParticleButton(action: onSend) {
                    ZStack {
                        Circle()
                            .fill(LinearGradient(
                                colors: messageText.isEmpty ? [Color.gray.opacity(0.3)] : [AppTheme.accentGreen, AppTheme.accentGreen.opacity(0.8)],
                                startPoint: .top,
                                endPoint: .bottom
                            ))
                            .frame(width: 32, height: 32)
                            .glow(color: messageText.isEmpty ? .clear : AppTheme.accentGreen,
                                  radius: messageText.isEmpty ? 0 : 8)

                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(sendButtonForeground)
                            .rotationEffect(.degrees(messageText.isEmpty ? 0 : 360))
                            .animation(.spring(response: 0.3), value: messageText.isEmpty)
                    }
                }
                .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .help(messageText.isEmpty ? "Type a message" : "Send message (⌘↵)")
                .keyboardShortcut(.return, modifiers: .command)
                .scaleEffect(messageText.isEmpty ? 0.9 : 1.05)
                .animation(.spring(response: 0.2, dampingFraction: 0.6), value: messageText.isEmpty)
                .transition(.scale.combined(with: .opacity))
            }
        }
    }

    private var attachedFilesPreview: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(attachedFiles, id: \.self) { url in
                    AttachedFileChip(
                        fileName: url.lastPathComponent,
                        onRemove: { onRemoveAttachment?(url) }
                    )
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

    // MARK: - Voice Methods

    private func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }

    private func startRecording() {
        isRecording = true
        // Request microphone permission and start recording
        // For now, just simulate recording
        // This will be connected to the API service when properly configured
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.messageText = "Voice input simulated"
            self.isRecording = false
        }
    }

    private func stopRecording() {
        isRecording = false
        Task {
            // Voice functionality temporarily disabled
        }
    }

    func playVoiceResponse(_ text: String) {
        guard !isPlayingResponse else { return }
        isPlayingResponse = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.isPlayingResponse = false
        }
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
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.allowsUndo = true
        textView.isEditable = true
        textView.isSelectable = true
        textView.isContinuousSpellCheckingEnabled = false
        textView.isGrammarCheckingEnabled = false
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.heightTracksTextView = false
        textView.textContainer?.maximumNumberOfLines = 0
        textView.textContainer?.lineBreakMode = .byWordWrapping

        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder
        scrollView.backgroundColor = .clear
        scrollView.drawsBackground = false
        scrollView.contentView.postsBoundsChangedNotifications = true

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? NSTextView else { return }

        if textView.string != text {
            textView.string = text
            updateHeight(textView: textView)
        }

        // Update focus state
        DispatchQueue.main.async {
            if self.isFocused && textView.window?.firstResponder != textView {
                textView.window?.makeFirstResponder(textView)
            } else if !self.isFocused && textView.window?.firstResponder == textView {
                textView.window?.makeFirstResponder(nil)
            }
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
