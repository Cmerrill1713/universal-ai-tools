import SwiftUI
import OSLog

// MARK: - Performance Optimized Message Bubble
struct OptimizedMessageBubble: View {
    let message: Message
    let agent: UniversalAIAgent?
    let voiceInterface: EnhancedVoiceInterface
    
    @State private var isVisible = false
    @State private var imageCache: [String: Data] = [:]
    @State private var hasPreloadedContent = false
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "optimized-message-bubble")
    
    // Performance: Only create expensive views when visible
    var body: some View {
        Group {
            if isVisible {
                MessageContentView(
                    message: message,
                    agent: agent,
                    voiceInterface: voiceInterface,
                    imageCache: $imageCache
                )
            } else {
                MessagePlaceholderView(message: message)
                    .onAppear {
                        // Lazy load content when it becomes visible
                        withAnimation(.easeIn(duration: 0.2)) {
                            isVisible = true
                        }
                        
                        // Preload content in background
                        if !hasPreloadedContent {
                            Task {
                                await preloadMessageContent()
                                hasPreloadedContent = true
                            }
                        }
                    }
            }
        }
        .id(message.id) // Ensure proper identity for efficient updates
    }
    
    private func preloadMessageContent() async {
        // Preload any expensive content (images, formatted text, etc.)
        // This runs in background to avoid blocking UI
        
        if !message.content.isEmpty {
            // Pre-process any markdown or formatted content
            await processFormattedContent()
        }
        
        // Preload any media content
        await preloadMediaContent()
    }
    
    private func processFormattedContent() async {
        // Process markdown, code highlighting, etc. in background
        // Store processed content in cache for immediate display
    }
    
    private func preloadMediaContent() async {
        // Load images, videos, etc. in background
        // Store in imageCache for immediate display
    }
}

// MARK: - Message Content View (Rendered when visible)
private struct MessageContentView: View {
    let message: Message
    let agent: UniversalAIAgent?
    let voiceInterface: EnhancedVoiceInterface
    @Binding var imageCache: [String: Data]
    
    @State private var isHovered = false
    @State private var showActions = false
    @State private var isSpeaking = false
    
    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            if message.role == .user {
                Spacer(minLength: 60)
                messageContent
            } else {
                messageContent
                Spacer(minLength: 60)
            }
        }
        .onHover { hovering in
            // Debounced hover to avoid excessive state changes
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                if hovering == isHovered { return } // Avoid redundant updates
                withAnimation(.easeInOut(duration: 0.15)) { // Shorter animation
                    isHovered = hovering
                    showActions = hovering
                }
            }
        }
        .drawingGroup() // Enable layer caching for complex content
    }
    
    private var messageContent: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 8) {
            if message.role == .assistant {
                CachedMessageHeader(agent: agent, timestamp: message.timestamp)
            }
            
            HStack(alignment: .top, spacing: 12) {
                if message.role == .assistant {
                    CachedAgentAvatar(agent: agent)
                }
                
                VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                    CachedMessageBubble(message: message)
                    CachedMessageFooter(message: message)
                }
                
                if message.role == .user {
                    CachedUserAvatar()
                }
            }
            
            if showActions {
                OptimizedMessageActions(
                    message: message,
                    voiceInterface: voiceInterface,
                    isSpeaking: $isSpeaking
                )
                .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }
        }
    }
}

// MARK: - Message Placeholder (Minimal view for off-screen messages)
private struct MessagePlaceholderView: View {
    let message: Message
    
    var body: some View {
        VStack {
            Rectangle()
                .fill(Color.clear)
                .frame(height: estimatedHeight)
        }
        .accessibilityLabel("Message from \(message.role == .user ? "user" : "assistant")")
    }
    
    private var estimatedHeight: CGFloat {
        // Estimate height based on content length to maintain scroll position
        let baseHeight: CGFloat = 60
        let contentHeight = CGFloat(message.content.count / 50) * 20 // Rough estimate
        return min(baseHeight + contentHeight, 200) // Cap at reasonable height
    }
}

// MARK: - Cached Components for Better Performance

private struct CachedMessageHeader: View {
    let agent: UniversalAIAgent?
    let timestamp: Date
    
    // Cache formatted timestamp to avoid repeated formatting
    @State private var formattedTime: String = ""
    
    var body: some View {
        HStack(spacing: 6) {
            if let agent = agent {
                Text(agent.name)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                
                Text("•")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(agent.type.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(formattedTime)
                .font(.caption)
                .foregroundColor(.tertiary)
        }
        .padding(.horizontal, 4)
        .onAppear {
            formattedTime = formatTimestamp(timestamp)
        }
    }
    
    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        
        if Calendar.current.isDateInToday(date) {
            return formatter.string(from: date)
        } else {
            formatter.dateStyle = .short
            return formatter.string(from: date)
        }
    }
}

private struct CachedAgentAvatar: View {
    let agent: UniversalAIAgent?
    
    var body: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [
                        (agent?.type.color ?? .blue).opacity(0.8),
                        (agent?.type.color ?? .blue).opacity(0.6)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: 32, height: 32)
            
            Image(systemName: agent?.type.icon ?? "brain.head.profile")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)
        }
        .shadow(color: (agent?.type.color ?? .blue).opacity(0.3), radius: 2, x: 0, y: 1)
        .drawingGroup() // Cache the avatar rendering
    }
}

private struct CachedUserAvatar: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [.gray.opacity(0.8), .gray.opacity(0.6)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: 32, height: 32)
            
            Image(systemName: "person.fill")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)
        }
        .shadow(color: .gray.opacity(0.3), radius: 2, x: 0, y: 1)
        .drawingGroup() // Cache the avatar rendering
    }
}

private struct CachedMessageBubble: View {
    let message: Message
    
    var body: some View {
        Text(message.content)
            .font(.body)
            .foregroundColor(.primary)
            .textSelection(.enabled)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(bubbleBackground)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
            .drawingGroup() // Cache the bubble rendering
    }
    
    private var bubbleBackground: some View {
        Group {
            if message.role == .user {
                LinearGradient(
                    colors: [.blue.opacity(0.8), .blue.opacity(0.6)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                Color(.controlBackgroundColor)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                    )
            }
        }
    }
}

private struct CachedMessageFooter: View {
    let message: Message
    
    var body: some View {
        HStack(spacing: 4) {
            if message.role == .user {
                Text(formatTimestamp(message.timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Image(systemName: "checkmark")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 4)
    }
    
    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: date)
    }
}

private struct OptimizedMessageActions: View {
    let message: Message
    let voiceInterface: EnhancedVoiceInterface
    @Binding var isSpeaking: Bool
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "message-actions")
    
    var body: some View {
        HStack(spacing: 8) {
            OptimizedActionButton(icon: "doc.on.doc", tooltip: "Copy") {
                copyMessage()
            }
            
            if message.role == .assistant && voiceInterface.voiceSettings.isEnabled {
                OptimizedActionButton(
                    icon: isSpeaking ? "speaker.slash" : "speaker.2",
                    tooltip: isSpeaking ? "Stop" : "Speak"
                ) {
                    toggleSpeech()
                }
            }
            
            if message.role == .assistant {
                OptimizedActionButton(icon: "arrow.clockwise", tooltip: "Regenerate") {
                    regenerateMessage()
                }
            }
            
            OptimizedActionButton(icon: "square.and.arrow.up", tooltip: "Share") {
                shareMessage()
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .drawingGroup() // Cache the actions bar
    }
    
    private func copyMessage() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(message.content, forType: .string)
        logger.info("Message copied")
    }
    
    private func toggleSpeech() {
        if isSpeaking {
            voiceInterface.ttsService.stopSpeaking()
            isSpeaking = false
        } else {
            Task {
                isSpeaking = true
                do {
                    try await voiceInterface.ttsService.speak(message.content)
                } catch {
                    logger.error("Speech failed: \(error)")
                }
                isSpeaking = false
            }
        }
    }
    
    private func regenerateMessage() {
        logger.info("Regenerate requested")
    }
    
    private func shareMessage() {
        let sharingService = NSSharingService(named: .composeMessage)
        sharingService?.perform(withItems: [message.content])
        logger.info("Message shared")
    }
}

private struct OptimizedActionButton: View {
    let icon: String
    let tooltip: String
    let action: () -> Void
    
    @State private var isPressed = false
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 16, height: 16)
        }
        .buttonStyle(.plain)
        .scaleEffect(isPressed ? 0.9 : 1.0)
        .onTapGesture {
            withAnimation(.easeInOut(duration: 0.1)) {
                isPressed = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.easeInOut(duration: 0.1)) {
                    isPressed = false
                }
            }
            action()
        }
        .help(tooltip)
    }
}

// MARK: - Original Message Bubble (Kept for compatibility)
struct ConversationMessageBubble: View {
    let message: Message
    let agent: UniversalAIAgent?
    let voiceInterface: EnhancedVoiceInterface
    
    @State private var isHovered = false
    @State private var showActions = false
    @State private var isSpeaking = false
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "message-bubble")
    
    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            if message.role == .user {
                Spacer(minLength: 60)
                messageContent
            } else {
                messageContent
                Spacer(minLength: 60)
            }
        }
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
                showActions = hovering
            }
        }
    }
    
    private var messageContent: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 8) {
            // Message Header (for assistant messages)
            if message.role == .assistant {
                messageHeader
            }
            
            // Message Bubble
            HStack(alignment: .top, spacing: 12) {
                if message.role == .assistant {
                    agentAvatar
                }
                
                VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                    // Message Content
                    messageBubble
                    
                    // Message Footer
                    messageFooter
                }
                
                if message.role == .user {
                    userAvatar
                }
            }
            
            // Message Actions (on hover)
            if showActions {
                messageActions
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
            }
        }
    }
    
    private var messageHeader: some View {
        HStack(spacing: 6) {
            if let agent = agent {
                Text(agent.name)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                
                Text("•")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(agent.type.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(formatTimestamp(message.timestamp))
                .font(.caption)
                .foregroundColor(.tertiary)
        }
        .padding(.horizontal, 4)
    }
    
    private var agentAvatar: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [
                        (agent?.type.color ?? .blue).opacity(0.8),
                        (agent?.type.color ?? .blue).opacity(0.6)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: 32, height: 32)
            
            Image(systemName: agent?.type.icon ?? "brain.head.profile")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)
        }
        .shadow(color: (agent?.type.color ?? .blue).opacity(0.3), radius: 2, x: 0, y: 1)
    }
    
    private var userAvatar: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [.gray.opacity(0.8), .gray.opacity(0.6)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: 32, height: 32)
            
            Image(systemName: "person.fill")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)
        }
        .shadow(color: .gray.opacity(0.3), radius: 2, x: 0, y: 1)
    }
    
    private var messageBubble: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Message Text
            Text(message.content)
                .font(.body)
                .foregroundColor(.primary)
                .textSelection(.enabled)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(bubbleBackground)
                .clipShape(bubbleShape)
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
    }
    
    private var bubbleBackground: some View {
        Group {
            if message.role == .user {
                LinearGradient(
                    colors: [.blue.opacity(0.8), .blue.opacity(0.6)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                Color(.controlBackgroundColor)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                    )
            }
        }
    }
    
    private var bubbleShape: some Shape {
        RoundedRectangle(cornerRadius: 16)
    }
    
    private var messageFooter: some View {
        HStack(spacing: 4) {
            if message.role == .user {
                Text(formatTimestamp(message.timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            // Delivery status for user messages
            if message.role == .user {
                Image(systemName: "checkmark")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 4)
    }
    
    private var messageActions: some View {
        HStack(spacing: 8) {
            // Copy button
            MessageActionButton(
                icon: "doc.on.doc",
                tooltip: "Copy message"
            ) {
                copyMessage()
            }
            
            // Speak button (for assistant messages)
            if message.role == .assistant && voiceInterface.voiceSettings.isEnabled {
                MessageActionButton(
                    icon: isSpeaking ? "speaker.slash" : "speaker.2",
                    tooltip: isSpeaking ? "Stop speaking" : "Speak message"
                ) {
                    toggleSpeech()
                }
            }
            
            // Regenerate button (for assistant messages)
            if message.role == .assistant {
                MessageActionButton(
                    icon: "arrow.clockwise",
                    tooltip: "Regenerate response"
                ) {
                    regenerateMessage()
                }
            }
            
            // Share button
            MessageActionButton(
                icon: "square.and.arrow.up",
                tooltip: "Share message"
            ) {
                shareMessage()
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Actions
    private func copyMessage() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(message.content, forType: .string)
        
        logger.info("Message copied to clipboard")
    }
    
    private func toggleSpeech() {
        if isSpeaking {
            // Stop speaking
            voiceInterface.ttsService.stopSpeaking()
            isSpeaking = false
        } else {
            // Start speaking
            Task {
                isSpeaking = true
                do {
                    try await voiceInterface.ttsService.speak(message.content)
                } catch {
                    logger.error("Failed to speak message: \(error)")
                }
                isSpeaking = false
            }
        }
    }
    
    private func regenerateMessage() {
        // This would trigger a regeneration in the parent view
        logger.info("Regenerate message requested")
        // Implementation would depend on parent view communication
    }
    
    private func shareMessage() {
        let sharingService = NSSharingService(named: .composeMessage)
        sharingService?.perform(withItems: [message.content])
        
        logger.info("Message shared")
    }
    
    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        
        if Calendar.current.isDateInToday(date) {
            return formatter.string(from: date)
        } else {
            formatter.dateStyle = .short
            return formatter.string(from: date)
        }
    }
}

// MARK: - Message Action Button
struct MessageActionButton: View {
    let icon: String
    let tooltip: String
    let action: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 16, height: 16)
        }
        .buttonStyle(.plain)
        .scaleEffect(isHovered ? 1.1 : 1.0)
        .animation(.easeInOut(duration: 0.15), value: isHovered)
        .onHover { hovering in
            isHovered = hovering
        }
        .help(tooltip)
    }
}

// MARK: - Typing Indicator
struct TypingIndicator: View {
    @State private var animationPhase: CGFloat = 0
    
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.gray.opacity(0.6))
                    .frame(width: 6, height: 6)
                    .scaleEffect(1.0 + 0.3 * sin(animationPhase + Double(index) * 0.5))
                    .animation(
                        .easeInOut(duration: 1.0)
                        .repeatForever(autoreverses: true)
                        .delay(Double(index) * 0.2),
                        value: animationPhase
                    )
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.controlBackgroundColor))
        .cornerRadius(16)
        .onAppear {
            animationPhase = .pi
        }
    }
}

// MARK: - Message Status Indicator
struct MessageStatusIndicator: View {
    enum Status {
        case sending
        case sent
        case delivered
        case failed
    }
    
    let status: Status
    
    var body: some View {
        Group {
            switch status {
            case .sending:
                ProgressView()
                    .scaleEffect(0.5)
                    .frame(width: 12, height: 12)
            case .sent:
                Image(systemName: "checkmark")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            case .delivered:
                Image(systemName: "checkmark.circle")
                    .font(.caption2)
                    .foregroundColor(.green)
            case .failed:
                Image(systemName: "exclamationmark.triangle")
                    .font(.caption2)
                    .foregroundColor(.red)
            }
        }
    }
}

// MARK: - Preview
struct ConversationMessageBubble_Previews: PreviewProvider {
    static var previews: some View {
        let apiService = APIService()
        let loggingService = LoggingService()
        let monitoringService = MonitoringService()
        
        let conversationManager = ConversationManager(
            apiService: apiService,
            loggingService: loggingService,
            monitoringService: monitoringService
        )
        
        let agentService = AgentConversationService(
            apiService: apiService,
            loggingService: loggingService,
            monitoringService: monitoringService
        )
        
        let voiceInterface = EnhancedVoiceInterface(
            conversationManager: conversationManager,
            agentService: agentService,
            loggingService: loggingService
        )
        
        VStack(spacing: 16) {
            ConversationMessageBubble(
                message: Message(
                    id: "1",
                    content: "Hello! How can I help you today?",
                    role: .assistant,
                    timestamp: Date()
                ),
                agent: UniversalAIAgent.availableAgents.first,
                voiceInterface: voiceInterface
            )
            
            ConversationMessageBubble(
                message: Message(
                    id: "2",
                    content: "I need help with a Swift programming question about async/await patterns.",
                    role: .user,
                    timestamp: Date()
                ),
                agent: nil,
                voiceInterface: voiceInterface
            )
        }
        .padding()
        .background(Color(.windowBackgroundColor))
    }
}