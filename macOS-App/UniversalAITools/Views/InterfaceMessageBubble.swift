import SwiftUI

struct InterfaceMessageBubble: View {
    let message: Message
    var onRegenerate: (() -> Void)?
    @State private var isHovered = false
    @State private var showActions = false
    @State private var animateIn = false

    var bubbleColor: some View {
        Group {
            if message.role == .user {
                LinearGradient(
                    gradient: Gradient(colors: [
                        AppTheme.accentGreen,
                        AppTheme.accentGreen.opacity(0.9)
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else {
                AppTheme.surfaceBackground
                    .opacity(isHovered ? 1.0 : 0.95)
            }
        }
    }

    var textColor: Color {
        message.role == .user ? .white : AppTheme.primaryText
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == .assistant {
                Circle()
                    .fill(LinearGradient(
                        gradient: Gradient(colors: [
                            AppTheme.accentBlue,
                            AppTheme.accentBlue.opacity(0.8)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: "cpu")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white)
                    )
                    .scaleEffect(animateIn ? 1.0 : 0.8)
                    .opacity(animateIn ? 1.0 : 0.0)
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 6) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(message.content)
                        .font(.system(size: 15))
                        .foregroundColor(textColor)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(bubbleColor)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .stroke(
                            message.role == .assistant ?
                            AppTheme.separator.opacity(0.5) :
                            Color.clear,
                            lineWidth: 1
                        )
                )
                .shadow(
                    color: AppTheme.composerShadow.opacity(0.1),
                    radius: isHovered ? 8 : 4,
                    x: 0,
                    y: 2
                )
                .scaleEffect(animateIn ? 1.0 : 0.95)
                .opacity(animateIn ? 1.0 : 0.0)

                if message.role == .assistant && (isHovered || showActions) {
                    HStack(spacing: 12) {
                        ActionButton(
                            icon: "doc.on.doc",
                            label: "Copy",
                            action: { copyToClipboard(message.content) }
                        )

                        ActionButton(
                            icon: "arrow.clockwise",
                            label: "Regenerate",
                            action: { onRegenerate?() }
                        )

                        ActionButton(
                            icon: "square.and.arrow.up",
                            label: "Share",
                            action: { shareMessage(message.content) }
                        )

                        Spacer()

                        Text(formatTimestamp(message.timestamp))
                            .font(.caption2)
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .frame(maxWidth: message.role == .user ? 480 : .infinity, alignment: message.role == .user ? .trailing : .leading)

            if message.role == .user {
                Circle()
                    .fill(LinearGradient(
                        gradient: Gradient(colors: [
                            Color.purple,
                            Color.purple.opacity(0.8)
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Text(String(NSFullUserName().prefix(1).uppercased()))
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white)
                    )
                    .scaleEffect(animateIn ? 1.0 : 0.8)
                    .opacity(animateIn ? 1.0 : 0.0)
            }

            if message.role == .assistant { Spacer(minLength: 40) }
        }
        .padding(.horizontal, message.role == .user ? 40 : 0)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
                if hovering {
                    showActions = true
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        if !isHovered {
                            showActions = false
                        }
                    }
                }
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7).delay(0.05)) {
                animateIn = true
            }
        }
    }

    private func copyToClipboard(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private func shareMessage(_ text: String) {
        let sharingServicePicker = NSSharingServicePicker(items: [text])
        if let window = NSApp.mainWindow,
           let contentView = window.contentView {
            let rect = NSRect(x: contentView.bounds.midX - 25,
                              y: contentView.bounds.midY - 25,
                              width: 50,
                              height: 50)
            sharingServicePicker.show(relativeTo: rect, of: contentView, preferredEdge: .minY)
        }
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
