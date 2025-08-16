import SwiftUI
import OSLog

// MARK: - Arc Message Bubble
// Enhanced message bubble component with Arc-inspired design
struct ArcMessageBubble: View {
    let message: Message
    let isSelected: Bool
    @Binding var showingActions: Bool
    
    @State private var isHovered = false
    @State private var isVisible = false
    @State private var showCopyFeedback = false
    @State private var isSpeaking = false
    @State private var expandedCodeBlock: String?
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "arc-message-bubble")
    
    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            if message.role == .user {
                Spacer(minLength: 80)
                messageContainer
            } else {
                messageContainer
                Spacer(minLength: 80)
            }
        }
        .opacity(isVisible ? 1 : 0)
        .scaleEffect(isVisible ? 1 : 0.95)
        .onAppear {
            withAnimation(ArcDesign.Animation.spring.delay(0.1)) {
                isVisible = true
            }
        }
        .onHover { hovering in
            withAnimation(ArcDesign.Animation.quick) {
                isHovered = hovering
                showingActions = hovering
            }
        }
    }
    
    // MARK: - Message Container
    private var messageContainer: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: ArcDesign.Spacing.sm) {
            // Assistant header
            if message.role == .assistant {
                messageHeader
            }
            
            // Main message content
            HStack(alignment: .top, spacing: ArcDesign.Spacing.md) {
                if message.role == .assistant {
                    assistantAvatar
                }
                
                VStack(alignment: message.role == .user ? .trailing : .leading, spacing: ArcDesign.Spacing.xs) {
                    messageBubble
                    messageFooter
                    
                    // RAG metadata if available
                    if let ragMetadata = message.ragMetadata {
                        ragMetadataView(ragMetadata)
                    }
                }
                
                if message.role == .user {
                    userAvatar
                }
            }
            
            // Actions bar
            if showingActions {
                actionsBar
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .move(edge: .bottom).combined(with: .opacity)
                    ))
            }
        }
    }
    
    // MARK: - Message Header
    private var messageHeader: some View {
        HStack(spacing: ArcDesign.Spacing.xs) {
            HStack(spacing: 4) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(ArcDesign.Colors.accentBlue)
                
                Text("AI Assistant")
                    .font(ArcDesign.Typography.caption)
                    .fontWeight(.medium)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                
                if let model = message.model {
                    Text("•")
                        .font(ArcDesign.Typography.caption)
                        .foregroundColor(ArcDesign.Colors.tertiaryText)
                    
                    Text(model)
                        .font(ArcDesign.Typography.caption)
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                }
            }
            
            Spacer()
            
            Text(formatTimestamp(message.timestamp))
                .font(ArcDesign.Typography.caption)
                .foregroundColor(ArcDesign.Colors.tertiaryText)
        }
        .padding(.horizontal, ArcDesign.Spacing.xs)
    }
    
    // MARK: - Avatars
    private var assistantAvatar: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            ArcDesign.Colors.accentBlue.opacity(0.8),
                            ArcDesign.Colors.accentPurple.opacity(0.6)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 36, height: 36)
                .arcGlow(color: ArcDesign.Colors.accentBlue, intensity: 0.3)
            
            Image(systemName: "brain.head.profile")
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(.white)
        }
        .shadow(color: ArcDesign.Colors.accentBlue.opacity(0.3), radius: 4, x: 0, y: 2)
    }
    
    private var userAvatar: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            ArcDesign.Colors.secondaryText.opacity(0.8),
                            ArcDesign.Colors.tertiaryText.opacity(0.6)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 36, height: 36)
            
            Image(systemName: "person.fill")
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(.white)
        }
        .shadow(color: ArcDesign.Colors.shadowColor, radius: 2, x: 0, y: 1)
    }
    
    // MARK: - Message Bubble
    private var messageBubble: some View {
        VStack(alignment: .leading, spacing: 0) {
            if hasCodeBlocks {
                enhancedMarkdownContent
            } else {
                basicMessageContent
            }
        }
        .textSelection(.enabled)
        .background(bubbleBackground)
        .clipShape(bubbleShape)
        .overlay(
            bubbleShape
                .stroke(bubbleStroke, lineWidth: 1)
        )
        .shadow(color: ArcDesign.Colors.shadowColor, radius: isHovered ? 8 : 4, x: 0, y: isHovered ? 4 : 2)
        .scaleEffect(isHovered ? 1.02 : 1.0)
        .animation(ArcDesign.Animation.quick, value: isHovered)
    }
    
    private var basicMessageContent: some View {
        Text(message.content)
            .font(ArcDesign.Typography.body)
            .foregroundColor(message.role == .user ? .white : ArcDesign.Colors.primaryText)
            .multilineTextAlignment(.leading)
            .padding(.horizontal, ArcDesign.Spacing.lg)
            .padding(.vertical, ArcDesign.Spacing.md)
    }
    
    private var enhancedMarkdownContent: some View {
        // Simple markdown rendering without external dependencies
        SimpleMarkdownText(message.content)
            .font(ArcDesign.Typography.body)
            .foregroundColor(message.role == .user ? .white : ArcDesign.Colors.primaryText)
            .padding(.horizontal, ArcDesign.Spacing.lg)
            .padding(.vertical, ArcDesign.Spacing.md)
    }
    
    private var hasCodeBlocks: Bool {
        message.content.contains("```") || message.content.contains("`")
    }
    
    // MARK: - Bubble Styling
    private var bubbleBackground: some View {
        Group {
            if message.role == .user {
                LinearGradient(
                    colors: [
                        ArcDesign.Colors.accentBlue,
                        ArcDesign.Colors.accentPurple
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                ArcDesign.Colors.primaryBackground
                    .overlay(.ultraThinMaterial)
            }
        }
    }
    
    private var bubbleStroke: Color {
        if message.role == .user {
            return Color.white.opacity(0.2)
        } else if isSelected {
            return ArcDesign.Colors.accentBlue.opacity(0.5)
        } else {
            return Color.white.opacity(0.1)
        }
    }
    
    private var bubbleShape: some Shape {
        RoundedRectangle(cornerRadius: ArcDesign.Radius.lg)
    }
    
    // MARK: - Message Footer
    private var messageFooter: some View {
        HStack(spacing: ArcDesign.Spacing.xs) {
            if message.role == .user {
                Text(formatTimestamp(message.timestamp))
                    .font(ArcDesign.Typography.caption2)
                    .foregroundColor(ArcDesign.Colors.tertiaryText)
                
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(ArcDesign.Colors.success)
            }
        }
        .padding(.horizontal, ArcDesign.Spacing.xs)
    }
    
    // MARK: - RAG Metadata View
    private func ragMetadataView(_ metadata: RAGMetadata) -> some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.xs) {
            HStack {
                Image(systemName: "brain")
                    .font(.system(size: 12))
                    .foregroundColor(ArcDesign.Colors.accentGreen)
                
                Text("Enhanced with \(metadata.contextUsed) context sources")
                    .font(ArcDesign.Typography.caption2)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                
                Spacer()
                
                if metadata.graphPaths > 0 {
                    Text("\(metadata.graphPaths) graph paths")
                        .font(ArcDesign.Typography.caption2)
                        .foregroundColor(ArcDesign.Colors.tertiaryText)
                }
            }
            
            if !metadata.sources.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: ArcDesign.Spacing.xs) {
                        ForEach(metadata.sources.prefix(3)) { source in
                            ragSourceChip(source)
                        }
                        
                        if metadata.sources.count > 3 {
                            Text("+\(metadata.sources.count - 3) more")
                                .font(ArcDesign.Typography.caption2)
                                .foregroundColor(ArcDesign.Colors.tertiaryText)
                                .padding(.horizontal, ArcDesign.Spacing.sm)
                                .padding(.vertical, ArcDesign.Spacing.xs)
                                .background(ArcDesign.Colors.tertiaryBackground.opacity(0.5))
                                .cornerRadius(ArcDesign.Radius.xs)
                        }
                    }
                    .padding(.horizontal, ArcDesign.Spacing.xs)
                }
            }
        }
        .padding(ArcDesign.Spacing.sm)
        .background(ArcDesign.Colors.accentGreen.opacity(0.05))
        .cornerRadius(ArcDesign.Radius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                .stroke(ArcDesign.Colors.accentGreen.opacity(0.2), lineWidth: 1)
        )
    }
    
    private func ragSourceChip(_ source: RAGSource) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(source.type.capitalized)
                .font(ArcDesign.Typography.caption2)
                .fontWeight(.medium)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            Text(source.preview)
                .font(ArcDesign.Typography.caption2)
                .foregroundColor(ArcDesign.Colors.secondaryText)
                .lineLimit(2)
        }
        .padding(.horizontal, ArcDesign.Spacing.sm)
        .padding(.vertical, ArcDesign.Spacing.xs)
        .frame(width: 120)
        .background(ArcDesign.Colors.tertiaryBackground.opacity(0.7))
        .cornerRadius(ArcDesign.Radius.xs)
    }
    
    // MARK: - Actions Bar
    private var actionsBar: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            // Copy button with feedback
            ArcActionButton(
                icon: showCopyFeedback ? "checkmark" : "doc.on.doc",
                tooltip: "Copy message",
                color: showCopyFeedback ? ArcDesign.Colors.success : ArcDesign.Colors.secondaryText
            ) {
                copyMessage()
            }
            
            // Speak button (assistant messages only)
            if message.role == .assistant {
                ArcActionButton(
                    icon: isSpeaking ? "speaker.slash.fill" : "speaker.2.fill",
                    tooltip: isSpeaking ? "Stop speaking" : "Speak message",
                    color: isSpeaking ? ArcDesign.Colors.error : ArcDesign.Colors.secondaryText
                ) {
                    toggleSpeech()
                }
            }
            
            // Regenerate button (assistant messages only)
            if message.role == .assistant {
                ArcActionButton(
                    icon: "arrow.clockwise",
                    tooltip: "Regenerate response",
                    color: ArcDesign.Colors.secondaryText
                ) {
                    regenerateMessage()
                }
            }
            
            // Share button
            ArcActionButton(
                icon: "square.and.arrow.up",
                tooltip: "Share message",
                color: ArcDesign.Colors.secondaryText
            ) {
                shareMessage()
            }
            
            // Edit button (user messages only)
            if message.role == .user {
                ArcActionButton(
                    icon: "pencil",
                    tooltip: "Edit message",
                    color: ArcDesign.Colors.secondaryText
                ) {
                    editMessage()
                }
            }
        }
        .padding(.horizontal, ArcDesign.Spacing.md)
        .padding(.vertical, ArcDesign.Spacing.sm)
        .arcGlass()
    }
    
    // MARK: - Actions
    private func copyMessage() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(message.content, forType: .string)
        
        withAnimation(ArcDesign.Animation.quick) {
            showCopyFeedback = true
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(ArcDesign.Animation.quick) {
                showCopyFeedback = false
            }
        }
        
        logger.info("Message copied to clipboard")
    }
    
    private func toggleSpeech() {
        // TODO: Implement speech synthesis
        withAnimation(ArcDesign.Animation.quick) {
            isSpeaking.toggle()
        }
        
        if !isSpeaking {
            // Simulate speech duration
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                withAnimation(ArcDesign.Animation.quick) {
                    isSpeaking = false
                }
            }
        }
        
        logger.info("Speech toggled: \(isSpeaking)")
    }
    
    private func regenerateMessage() {
        // TODO: Implement message regeneration
        logger.info("Regenerate message requested")
    }
    
    private func shareMessage() {
        let sharingService = NSSharingService(named: .composeMessage)
        sharingService?.perform(withItems: [message.content])
        logger.info("Message shared")
    }
    
    private func editMessage() {
        // TODO: Implement message editing
        logger.info("Edit message requested")
    }
    
    // MARK: - Helpers
    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        
        if Calendar.current.isDateInToday(date) {
            formatter.timeStyle = .short
            formatter.dateStyle = .none
        } else {
            formatter.timeStyle = .short
            formatter.dateStyle = .short
        }
        
        return formatter.string(from: date)
    }
    
    // MARK: - Simple Markdown Text Component
    private struct SimpleMarkdownText: View {
        let content: String
        
        var body: some View {
            VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
                ForEach(parseMarkdown(content), id: \.id) { element in
                    switch element.type {
                    case .text:
                        Text(element.content)
                            .textSelection(.enabled)
                    case .code:
                        Text(element.content)
                            .font(ArcDesign.Typography.code)
                            .foregroundColor(ArcDesign.Colors.accentPurple)
                            .padding(.horizontal, ArcDesign.Spacing.xs)
                            .background(ArcDesign.Colors.tertiaryBackground.opacity(0.3))
                            .cornerRadius(ArcDesign.Radius.xs)
                            .textSelection(.enabled)
                    case .codeBlock:
                        ScrollView(.horizontal, showsIndicators: false) {
                            Text(element.content)
                                .font(ArcDesign.Typography.codeBlock)
                                .foregroundColor(ArcDesign.Colors.primaryText)
                                .textSelection(.enabled)
                                .padding(ArcDesign.Spacing.md)
                        }
                        .background(ArcDesign.Colors.tertiaryBackground)
                        .cornerRadius(ArcDesign.Radius.sm)
                        .overlay(
                            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                                .stroke(Color.white.opacity(0.1), lineWidth: 1)
                        )
                    }
                }
            }
        }
        
        private func parseMarkdown(_ text: String) -> [MarkdownElement] {
            var elements: [MarkdownElement] = []
            var currentText = text
            
            // Handle code blocks first (```)
            while let codeBlockRange = currentText.range(of: "```[\\s\\S]*?```", options: .regularExpression) {
                // Add text before code block
                let beforeText = String(currentText[..<codeBlockRange.lowerBound])
                if !beforeText.isEmpty {
                    elements.append(contentsOf: parseInlineMarkdown(beforeText))
                }
                
                // Add code block (remove ``` markers)
                let codeContent = String(currentText[codeBlockRange])
                let cleanedCode = codeContent
                    .replacingOccurrences(of: "```\\w*\n?", with: "", options: .regularExpression)
                    .replacingOccurrences(of: "\n```", with: "")
                
                elements.append(MarkdownElement(type: .codeBlock, content: cleanedCode))
                
                // Continue with remaining text
                currentText = String(currentText[codeBlockRange.upperBound...])
            }
            
            // Handle remaining text with inline markdown
            if !currentText.isEmpty {
                elements.append(contentsOf: parseInlineMarkdown(currentText))
            }
            
            return elements
        }
        
        private func parseInlineMarkdown(_ text: String) -> [MarkdownElement] {
            var elements: [MarkdownElement] = []
            var currentText = text
            
            // Handle inline code (`)
            while let codeRange = currentText.range(of: "`[^`]+`", options: .regularExpression) {
                // Add text before code
                let beforeText = String(currentText[..<codeRange.lowerBound])
                if !beforeText.isEmpty {
                    elements.append(MarkdownElement(type: .text, content: beforeText))
                }
                
                // Add inline code (remove ` markers)
                let codeContent = String(currentText[codeRange])
                let cleanedCode = codeContent.replacingOccurrences(of: "`", with: "")
                elements.append(MarkdownElement(type: .code, content: cleanedCode))
                
                // Continue with remaining text
                currentText = String(currentText[codeRange.upperBound...])
            }
            
            // Add remaining text
            if !currentText.isEmpty {
                elements.append(MarkdownElement(type: .text, content: currentText))
            }
            
            return elements
        }
    }
    
    private struct MarkdownElement {
        let id = UUID()
        let type: MarkdownType
        let content: String
    }
    
    private enum MarkdownType {
        case text
        case code
        case codeBlock
    }
}

// MARK: - Arc Action Button
struct ArcActionButton: View {
    let icon: String
    let tooltip: String
    let color: Color
    let action: () -> Void
    
    @State private var isPressed = false
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(color)
                .frame(width: 24, height: 24)
                .background(
                    Circle()
                        .fill(isHovered ? Color.white.opacity(0.1) : Color.clear)
                )
                .scaleEffect(isPressed ? 0.9 : 1.0)
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            withAnimation(ArcDesign.Animation.quick) {
                isHovered = hovering
            }
        }
        .pressedAction {
            withAnimation(ArcDesign.Animation.quick) {
                isPressed = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(ArcDesign.Animation.quick) {
                    isPressed = false
                }
            }
        }
        .help(tooltip)
    }
}

// MARK: - Typing Indicator
struct ArcTypingIndicator: View {
    @State private var animationPhase: CGFloat = 0
    
    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            HStack(alignment: .top, spacing: ArcDesign.Spacing.md) {
                // Assistant avatar
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    ArcDesign.Colors.accentBlue.opacity(0.8),
                                    ArcDesign.Colors.accentPurple.opacity(0.6)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 36, height: 36)
                        .arcGlow(color: ArcDesign.Colors.accentBlue, intensity: 0.3)
                    
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.white)
                }
                
                // Typing animation
                HStack(spacing: 6) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(ArcDesign.Colors.accentBlue.opacity(0.6))
                            .frame(width: 8, height: 8)
                            .scaleEffect(1.0 + 0.5 * sin(animationPhase + Double(index) * 0.6))
                            .animation(
                                .easeInOut(duration: 1.2)
                                    .repeatForever(autoreverses: true)
                                    .delay(Double(index) * 0.2),
                                value: animationPhase
                            )
                    }
                }
                .padding(.horizontal, ArcDesign.Spacing.lg)
                .padding(.vertical, ArcDesign.Spacing.md)
                .background(ArcDesign.Colors.primaryBackground.overlay(.ultraThinMaterial))
                .clipShape(RoundedRectangle(cornerRadius: ArcDesign.Radius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: ArcDesign.Radius.lg)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
                .shadow(color: ArcDesign.Colors.shadowColor, radius: 4, x: 0, y: 2)
                
                Spacer(minLength: 80)
            }
        }
        .onAppear {
            animationPhase = .pi
        }
    }
}

// MARK: - View Extension for Pressed Action
extension View {
    func pressedAction(action: @escaping () -> Void) -> some View {
        self.simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    action()
                }
        )
    }
}

// MARK: - Preview
struct ArcMessageBubble_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: ArcDesign.Spacing.lg) {
            ArcMessageBubble(
                message: Message(
                    role: .assistant,
                    content: "Hello! I'm your AI assistant. I can help you with a variety of tasks including:\n\n• Answering questions\n• Writing code\n• Analyzing data\n• Creative tasks\n\nHow can I assist you today?",
                    model: "gpt-4"
                ),
                isSelected: false,
                showingActions: .constant(false)
            )
            
            ArcMessageBubble(
                message: Message(
                    role: .user,
                    content: "Can you help me write a Swift function to calculate the Fibonacci sequence?"
                ),
                isSelected: false,
                showingActions: .constant(false)
            )
            
            ArcMessageBubble(
                message: Message(
                    role: .assistant,
                    content: "Here's a Swift function to calculate the Fibonacci sequence:\n\n```swift\nfunc fibonacci(_ n: Int) -> Int {\n    if n <= 1 {\n        return n\n    }\n    return fibonacci(n - 1) + fibonacci(n - 2)\n}\n```\n\nThis is a recursive implementation. For better performance with larger numbers, you might want to use dynamic programming.",
                    ragMetadata: RAGMetadata(
                        contextUsed: 3,
                        sources: [
                            RAGSource(type: "documentation", preview: "Swift Programming Guide - Functions", score: 0.95),
                            RAGSource(type: "code", preview: "fibonacci implementation examples", score: 0.87)
                        ],
                        graphPaths: 2,
                        clusters: 1
                    )
                ),
                isSelected: false,
                showingActions: .constant(true)
            )
            
            ArcTypingIndicator()
        }
        .padding()
        .background(ArcDesign.Colors.secondaryBackground)
    }
}