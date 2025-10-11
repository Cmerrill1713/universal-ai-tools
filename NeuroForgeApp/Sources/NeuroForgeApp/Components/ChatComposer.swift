import SwiftUI

/// Reusable chat input component with proper Enter key handling
public struct ChatComposer: View {
    @Binding var text: String
    @State private var isSending = false
    
    var placeholder: String = "Type your message..."
    var onSend: (String) async -> Void
    var isEnabled: Bool = true
    
    public init(
        text: Binding<String>,
        placeholder: String = "Type your message...",
        isEnabled: Bool = true,
        onSend: @escaping (String) async -> Void
    ) {
        self._text = text
        self.placeholder = placeholder
        self.isEnabled = isEnabled
        self.onSend = onSend
    }
    
    public var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            // Input editor
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder)
                        .foregroundColor(.secondary)
                        .padding(.leading, 4)
                        .padding(.top, 8)
                        .allowsHitTesting(false)
                }
                
                KeyCatchingTextEditor(
                    text: $text,
                    onSubmit: { Task { await send() } },
                    focusOnAppear: true
                )
                .frame(minHeight: 60, maxHeight: 120)
                .background(Color(nsColor: .textBackgroundColor))  // ✅ Solid, non-vibrant
                .accessibilityIdentifier("chat_input")
            }
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
            )
            
            // Send button
            Button {
                Task { await send() }
            } label: {
                Image(systemName: isSending ? "stop.circle.fill" : "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundColor(canSend ? .accentColor : .secondary)
            }
            .disabled(!canSend || isSending)
            .keyboardShortcut(.return, modifiers: [])
            .accessibilityIdentifier("chat_send")
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }
    
    private var canSend: Bool {
        isEnabled && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    private func send() async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        
        isSending = true
        text = "" // Clear immediately for better UX
        
        await onSend(trimmed)
        
        isSending = false
    }
}

