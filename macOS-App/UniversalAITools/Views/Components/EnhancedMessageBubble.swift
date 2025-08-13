import SwiftUI

// MARK: - Enhanced Message Bubble with Stunning Animations
struct EnhancedMessageBubble: View {
    let message: Message
    @State private var isHovered = false
    @State private var hasAppeared = false
    @State private var showTypingEffect = false
    @State private var displayedText = ""
    @State private var currentIndex = 0
    @State private var typingTimer: Timer?

    var body: some View {
        HStack(alignment: .top) {
            if message.role == .user {
                Spacer()
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 8) {
                // Message content
                messageBubble
                    .contextMenu {
                        Button("Copy Message") {
                            copyMessage()
                        }
                        .keyboardShortcut("c", modifiers: .command)

                        if message.role == .assistant {
                            Button("Regenerate Response") {
                                regenerateMessage()
                            }
                            .keyboardShortcut("r", modifiers: .command)
                        }

                        Divider()

                        Button("Share Message") {
                            shareMessage()
                        }
                    }

                // Timestamp and controls
                if isHovered {
                    messageControls
                        .transition(.scale.combined(with: .opacity))
                }
            }

            if message.role == .assistant {
                Spacer()
            }
        }
        .onHover { hovering in
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                isHovered = hovering
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.1)) {
                hasAppeared = true
            }

            if message.role == .assistant {
                startTypingAnimation()
            }
        }
        .onDisappear {
            // Clean up timer to prevent memory leaks
            typingTimer?.invalidate()
            typingTimer = nil
        }
    }

    // MARK: - Message Bubble
    private var messageBubble: some View {
        Text(message.role == .assistant && showTypingEffect ? displayedText : message.content)
            .font(.system(size: 16, weight: .regular, design: .rounded))
            .foregroundColor(textColor)
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(bubbleBackground)
            .clipShape(BubbleShape(isFromUser: message.role == .user))
            .frame(maxWidth: 500, alignment: bubbleAlignment)
            .scaleEffect(hasAppeared ? 1 : 0.8)
            .opacity(hasAppeared ? 1 : 0)
            .shadow(
                color: shadowColor,
                radius: isHovered ? 15 : 8,
                x: 0,
                y: isHovered ? 8 : 4
            )
            .animation(.easeInOut(duration: 0.3), value: isHovered)
    }

    // MARK: - Bubble Background
    private var bubbleBackground: some View {
        Group {
            if message.role == .user {
                // User message with glassmorphism
                LinearGradient(
                    colors: [
                        AppTheme.accentGreen,
                        AppTheme.accentGreen.opacity(0.8)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.3),
                                    Color.white.opacity(0.1)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
                .glow(color: AppTheme.accentGreen, radius: isHovered ? 10 : 0)
            } else {
                // Assistant message with liquid glass effect
                ZStack {
                    // Base material
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(.ultraThinMaterial)

                    // Animated gradient overlay
                    AnimatedMeshGradient()
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .opacity(0.3)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.4),
                                    Color.white.opacity(0.1)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
                .glow(color: .blue, radius: isHovered ? 8 : 0)
            }
        }
    }

    // MARK: - Message Controls
    private var messageControls: some View {
        HStack(spacing: 12) {
            // Timestamp
            Text(message.timestamp.formatted(date: .omitted, time: .shortened))
                .font(.caption2)
                .foregroundColor(AppTheme.tertiaryText)

            // Copy button
            Button(action: copyMessage) {
                Image(systemName: "doc.on.doc")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            .buttonStyle(.plain)
            .neumorphism(isPressed: false, cornerRadius: 8)
            .frame(width: 24, height: 24)

            // Regenerate button (for assistant messages)
            if message.role == .assistant {
                Button(action: regenerateMessage) {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
                .neumorphism(isPressed: false, cornerRadius: 8)
                .frame(width: 24, height: 24)
            }
        }
    }

    // MARK: - Computed Properties
    private var textColor: Color {
        message.role == .user ? .white : AppTheme.primaryText
    }

    private var bubbleAlignment: Alignment {
        message.role == .user ? .trailing : .leading
    }

    private var shadowColor: Color {
        if message.role == .user {
            return AppTheme.accentGreen.opacity(0.3)
        } else {
            return Color.blue.opacity(0.2)
        }
    }

    // MARK: - Actions
    private func copyMessage() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(message.content, forType: .string)
    }

    private func regenerateMessage() {
        // TODO: Implement message regeneration
        print("Regenerating message: \(message.id)")
    }

    private func shareMessage() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(message.content, forType: .string)

        // Could also implement proper share sheet here
    }

    // MARK: - Typing Animation
    private func startTypingAnimation() {
        // Clean up any existing timer first
        typingTimer?.invalidate()

        showTypingEffect = true
        displayedText = ""
        currentIndex = 0

        typingTimer = Timer.scheduledTimer(withTimeInterval: 0.03, repeats: true) { _ in
            guard currentIndex < message.content.count else {
                typingTimer?.invalidate()
                typingTimer = nil
                showTypingEffect = false
                displayedText = message.content
                return
            }

            let index = message.content.index(message.content.startIndex, offsetBy: currentIndex)
            displayedText = String(message.content[..<index])
            currentIndex += 1
        }
    }
}

// MARK: - Custom Bubble Shape
struct BubbleShape: Shape {
    var isFromUser: Bool

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let cornerRadius: CGFloat = 20
        let tailSize: CGFloat = 8

        if isFromUser {
            // User bubble (tail on right)
            path.addRoundedRect(
                in: CGRect(
                    x: 0,
                    y: 0,
                    width: rect.width - tailSize,
                    height: rect.height
                ),
                cornerSize: CGSize(width: cornerRadius, height: cornerRadius)
            )

            // Add tail
            path.move(to: CGPoint(x: rect.width - tailSize, y: rect.height - 20))
            path.addLine(to: CGPoint(x: rect.width, y: rect.height - 8))
            path.addLine(to: CGPoint(x: rect.width - tailSize, y: rect.height - 8))
            path.closeSubpath()
        } else {
            // Assistant bubble (tail on left)
            path.addRoundedRect(
                in: CGRect(
                    x: tailSize,
                    y: 0,
                    width: rect.width - tailSize,
                    height: rect.height
                ),
                cornerSize: CGSize(width: cornerRadius, height: cornerRadius)
            )

            // Add tail
            path.move(to: CGPoint(x: tailSize, y: rect.height - 20))
            path.addLine(to: CGPoint(x: 0, y: rect.height - 8))
            path.addLine(to: CGPoint(x: tailSize, y: rect.height - 8))
            path.closeSubpath()
        }

        return path
    }
}

// MARK: - Animated Mesh Gradient
struct AnimatedMeshGradient: View {
    @State private var animationPhase: CGFloat = 0

    var body: some View {
        GeometryReader { _ in
            Canvas { context, size in
                let colors: [Color] = [
                    .blue.opacity(0.6),
                    .orange.opacity(0.5),
                    .blue.opacity(0.4),
                    .orange.opacity(0.3)
                ]

                for (index, color) in colors.enumerated() {
                    let angle = animationPhase + CGFloat(index) * .pi / 2
                    let center = CGPoint(
                        x: size.width * 0.5 + cos(angle) * 30,
                        y: size.height * 0.5 + sin(angle) * 20
                    )

                    let gradient = Gradient(colors: [color, Color.clear])
                    let ellipsePath = Path(ellipseIn: CGRect(
                        x: center.x - size.width * 0.4,
                        y: center.y - size.width * 0.4,
                        width: size.width * 0.8,
                        height: size.width * 0.8
                    ))

                    context.fill(ellipsePath, with: .radialGradient(
                        gradient,
                        center: center,
                        startRadius: 0,
                        endRadius: size.width * 0.4
                    ))
                }
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 8).repeatForever(autoreverses: false)) {
                animationPhase = .pi * 2
            }
        }
    }
}

// MARK: - Enhanced Typing Indicator
struct EnhancedTypingIndicator: View {
    @State private var neuralAnimation = false

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 4) {
                    // Neural network visualization
                    NeuralNetworkMini()
                        .frame(width: 40, height: 20)

                    Text("AI is thinking...")
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    ZStack {
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .fill(.ultraThinMaterial)

                        AnimatedMeshGradient()
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .opacity(0.2)
                    }
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(Color.white.opacity(0.3), lineWidth: 1)
                )
                .glow(color: .blue, radius: 6)
            }

            Spacer()
        }
        .transition(.scale.combined(with: .opacity))
    }
}

// MARK: - Mini Neural Network
struct NeuralNetworkMini: View {
    @State private var connectionProgress: CGFloat = 0

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Nodes
                ForEach(0..<6) { index in
                    Circle()
                        .fill(.blue.gradient)
                        .frame(width: 3, height: 3)
                        .position(miniNodePosition(for: index, in: geometry.size))
                        .glow(color: .blue, radius: 2)
                }

                // Connection line
                Path { path in
                    path.move(to: CGPoint(x: 10, y: geometry.size.height * 0.5))
                    path.addLine(to: CGPoint(x: 30, y: geometry.size.height * 0.5))
                }
                .trim(from: 0, to: connectionProgress)
                .stroke(.blue.opacity(0.8), lineWidth: 1)
                .glow(color: .blue, radius: 2)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) {
                connectionProgress = 1
            }
        }
    }

    private func miniNodePosition(for index: Int, in size: CGSize) -> CGPoint {
        let isLeft = index < 3
        let nodeInSide = index % 3

        let nodeX = isLeft ? size.width * 0.25 : size.width * 0.75
        let nodeY = CGFloat(nodeInSide) * (size.height / 2) + size.height * 0.25

        return CGPoint(x: nodeX, y: nodeY)
    }
}
