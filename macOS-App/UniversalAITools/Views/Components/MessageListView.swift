import SwiftUI

struct MessageListView: View {
    let isGenerating: Bool
    let onRegenerate: () -> Void

    @EnvironmentObject var appState: AppState
    @State private var scrollViewProxy: ScrollViewProxy?
    @State private var lastMessageContent: String = ""
    @State private var scrollTimer: Timer?
    @Namespace private var scrollSpace

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 16, pinnedViews: []) {
                    if let chat = appState.currentChat {
                        if chat.messages.isEmpty {
                            emptyState
                                .id("empty")
                        } else {
                            ForEach(chat.messages, id: \.id) { message in
                                MessageBubble(message: message)
                                    .id(message.id)
                                    .transition(.identity)
                            }

                            if isGenerating {
                                LoadingMessageBubble()
                                    .id("loading")
                                    .transition(.identity)
                            }
                        }
                    } else {
                        emptyState
                            .id("empty")
                    }

                    // Invisible spacer to maintain scroll position
                    Color.clear
                        .frame(height: 1)
                        .id("bottom")
                }
                .padding()
                .frame(maxWidth: AppTheme.maxChatWidth)
                .frame(maxWidth: .infinity)
            }
            .onAppear {
                scrollViewProxy = proxy
                scrollToBottom()
            }
            .onChange(of: appState.currentChat?.messages.count ?? 0) { _ in
                scrollToBottom()
            }
            .onChange(of: isGenerating) { generating in
                if generating {
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo("loading", anchor: .bottom)
                    }
                    startContinuousScrolling()
                } else {
                    stopContinuousScrolling()
                    // Final scroll to ensure we're at the bottom
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        scrollToBottom()
                    }
                }
            }
            .onChange(of: appState.currentChat?.messages.last?.content ?? "") { newContent in
                // Detect when message content is changing during streaming
                if isGenerating && newContent != lastMessageContent {
                    lastMessageContent = newContent
                    scrollToBottomSmooth()
                }
            }
        }
        .background(AppTheme.primaryBackground)
        .onDisappear {
            stopContinuousScrolling()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundColor(AppTheme.quaternaryText)

            Text("Start a conversation")
                .font(.headline)
                .foregroundColor(AppTheme.secondaryText)

            Text("Type a message below to begin chatting")
                .font(.subheadline)
                .foregroundColor(AppTheme.tertiaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 100)
    }

    private func scrollToBottom() {
        guard let proxy = scrollViewProxy else { return }

        if isGenerating {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo("loading", anchor: .bottom)
            }
        } else if let lastMessage = appState.currentChat?.messages.last {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(lastMessage.id, anchor: .bottom)
            }
        }
    }

    private func scrollToBottomSmooth() {
        guard let proxy = scrollViewProxy else { return }

        if isGenerating {
            withAnimation(.easeOut(duration: 0.15)) {
                proxy.scrollTo("loading", anchor: .bottom)
            }
        } else if let lastMessage = appState.currentChat?.messages.last {
            withAnimation(.easeOut(duration: 0.15)) {
                proxy.scrollTo(lastMessage.id, anchor: .bottom)
            }
        }
    }

    private func startContinuousScrolling() {
        stopContinuousScrolling() // Ensure no duplicate timers

        scrollTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
            if self.isGenerating {
                self.scrollToBottomSmooth()
            } else {
                self.stopContinuousScrolling()
            }
        }
    }

    private func stopContinuousScrolling() {
        scrollTimer?.invalidate()
        scrollTimer = nil
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: Message
    @State private var isHovering = false

    private var avatarBackground: LinearGradient {
        message.role == .user ? AppTheme.userMessageBackground : AppTheme.assistantMessageBackground
    }

    private var messageBubbleBackground: AnyShapeStyle {
        if message.role == .user {
            return AnyShapeStyle(AppTheme.userMessageBackground.opacity(0.1))
        } else {
            return AnyShapeStyle(AppTheme.assistantMessageBackground)
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == .user {
                Spacer(minLength: 60)
            }

            // Avatar
            Circle()
                .fill(avatarBackground)
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: message.role == .user ? "person.fill" : "cpu")
                        .font(.system(size: 16))
                        .foregroundColor(.white)
                )

            // Message content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(message.role == .user ? "You" : "Assistant")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(AppTheme.secondaryText)

                    Spacer()

                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(AppTheme.tertiaryText)
                }

                Text(message.content)
                    .font(.body)
                    .foregroundColor(AppTheme.primaryText)
                    .textSelection(.enabled)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .background(
                        RoundedRectangle(cornerRadius: AppTheme.mediumRadius)
                            .fill(messageBubbleBackground)
                    )

                if isHovering {
                    messageActions
                        .transition(.opacity.combined(with: .scale))
                }
            }

            if message.role != .user {
                Spacer(minLength: 60)
            }
        }
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovering = hovering
            }
        }
    }

    private var messageActions: some View {
        HStack(spacing: 8) {
            Button(action: copyMessage) {
                Image(systemName: "doc.on.doc")
                    .font(.caption)
            }
            .buttonStyle(.borderless)
            .help("Copy message")

            if message.role == .assistant {
                Button(action: regenerateMessage) {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .help("Regenerate response")
            }
        }
        .padding(.top, 4)
    }

    private func copyMessage() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(message.content, forType: .string)
    }

    private func regenerateMessage() {
        // This would be handled by the parent view
        NotificationCenter.default.post(name: Notification.Name("RegenerateMessage"), object: message)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Loading Message Bubble

struct LoadingMessageBubble: View {
    @State private var dotCount = 0

    let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Avatar
            Circle()
                .fill(AppTheme.assistantMessageBackground)
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: "cpu")
                        .font(.system(size: 16))
                        .foregroundColor(.white)
                )

            // Loading indicator
            VStack(alignment: .leading, spacing: 4) {
                Text("Assistant")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.secondaryText)

                HStack(spacing: 4) {
                    ForEach(0..<3) { index in
                        Circle()
                            .fill(AppTheme.accentColor)
                            .frame(width: 8, height: 8)
                            .opacity(index < dotCount ? 1.0 : 0.3)
                    }
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 16)
                .background(
                    RoundedRectangle(cornerRadius: AppTheme.mediumRadius)
                        .fill(AppTheme.assistantMessageBackground)
                )
            }

            Spacer(minLength: 60)
        }
        .onReceive(timer) { _ in
            withAnimation {
                dotCount = (dotCount + 1) % 4
            }
        }
    }
}
