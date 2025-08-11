import SwiftUI

// MARK: - Conversation Row
struct ConversationRow: View {
    let chat: Chat
    let isSelected: Bool
    let isHovered: Bool
    let isEditing: Bool
    @Binding var editingTitle: String
    
    let onSelect: () -> Void
    let onDelete: () -> Void
    let onRename: () -> Void
    let onCommitRename: () -> Void
    let onDuplicate: () -> Void
    
    @State private var showActions = false
    
    var body: some View {
        HStack(spacing: 8) {
            // Icon
            Image(systemName: iconName)
                .font(.system(size: 13))
                .foregroundColor(iconColor)
                .frame(width: 20)
            
            // Title or editing field
            if isEditing {
                TextField("Chat title", text: $editingTitle, onCommit: onCommitRename)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(.system(size: 13))
                    .foregroundColor(AppTheme.primaryText)
                    .onExitCommand {
                        editingTitle = chat.title
                        onCommitRename()
                    }
            } else {
                Text(chat.title)
                    .font(.system(size: 13))
                    .foregroundColor(textColor)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            
            Spacer()
            
            // Action buttons (show on hover)
            if (isHovered || showActions) && !isEditing {
                HStack(spacing: 4) {
                    ActionButton(
                        icon: "pencil",
                        action: onRename,
                        help: "Rename"
                    )
                    
                    ActionButton(
                        icon: "doc.on.doc",
                        action: onDuplicate,
                        help: "Duplicate"
                    )
                    
                    ActionButton(
                        icon: "trash",
                        action: onDelete,
                        help: "Delete"
                    )
                }
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(backgroundView)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
        .contextMenu {
            Button("Rename", action: onRename)
            Button("Duplicate", action: onDuplicate)
            Divider()
            Button("Delete", role: .destructive, action: onDelete)
        }
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                showActions = hovering
            }
        }
    }
    
    private var iconName: String {
        chat.messages.isEmpty ? "bubble.left" : "bubble.left.and.bubble.right"
    }
    
    private var iconColor: Color {
        isSelected ? AppTheme.accentBlue : AppTheme.secondaryText
    }
    
    private var textColor: Color {
        isSelected ? AppTheme.primaryText : AppTheme.secondaryText
    }
    
    @ViewBuilder
    private var backgroundView: some View {
        if isSelected {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(AppTheme.accentBlue.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(AppTheme.accentBlue.opacity(0.3), lineWidth: 1)
                )
        } else if isHovered {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.white.opacity(0.05))
        } else {
            Color.clear
        }
    }
}

// MARK: - Action Button
struct ActionButton: View {
    let icon: String
    let action: () -> Void
    let help: String
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(isHovered ? AppTheme.primaryText : AppTheme.tertiaryText)
                .frame(width: 20, height: 20)
                .background(
                    Circle()
                        .fill(isHovered ? Color.white.opacity(0.1) : Color.clear)
                )
        }
        .buttonStyle(PlainButtonStyle())
        .help(help)
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

// MARK: - New Chat Menu
struct NewChatMenu: View {
    let onSelect: (ChatTemplate) -> Void
    @Environment(\.dismiss) private var dismiss
    
    let templates = ChatTemplate.defaultTemplates
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Start New Chat")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding(12)
            
            Divider()
                .background(AppTheme.separator)
            
            // Template list
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(templates) { template in
                        TemplateRow(
                            template: template,
                            onSelect: {
                                onSelect(template)
                                dismiss()
                            }
                        )
                    }
                }
                .padding(12)
            }
        }
        .background(AppTheme.popupBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppTheme.separator, lineWidth: 1)
        )
    }
}

// MARK: - Template Row
struct TemplateRow: View {
    let template: ChatTemplate
    let onSelect: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                // Icon
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(template.color.opacity(0.15))
                        .frame(width: 36, height: 36)
                    
                    Image(systemName: template.icon)
                        .font(.system(size: 16))
                        .foregroundColor(template.color)
                }
                
                // Text
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(template.description)
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.tertiaryText)
                        .lineLimit(1)
                }
                
                Spacer()
                
                // Arrow
                Image(systemName: "arrow.right")
                    .font(.system(size: 12))
                    .foregroundColor(AppTheme.tertiaryText)
                    .opacity(isHovered ? 1 : 0)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(isHovered ? Color.white.opacity(0.05) : Color.clear)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Chat Template
struct ChatTemplate: Identifiable {
    let id = UUID()
    let title: String
    let description: String
    let icon: String
    let color: Color
    let systemPrompt: String
    let defaultModel: String
    
    static let defaultTemplates = [
        ChatTemplate(
            title: "General Chat",
            description: "Start a general conversation",
            icon: "bubble.left.and.bubble.right",
            color: AppTheme.accentBlue,
            systemPrompt: "You are a helpful AI assistant.",
            defaultModel: "gpt-4"
        ),
        ChatTemplate(
            title: "Code Assistant",
            description: "Get help with programming",
            icon: "chevron.left.forwardslash.chevron.right",
            color: AppTheme.accentGreen,
            systemPrompt: "You are an expert programming assistant. Help with code, debugging, and software development best practices.",
            defaultModel: "deepseek-coder"
        ),
        ChatTemplate(
            title: "Creative Writing",
            description: "Generate creative content",
            icon: "pencil.and.outline",
            color: Color.purple,
            systemPrompt: "You are a creative writing assistant. Help with storytelling, creative ideas, and engaging content.",
            defaultModel: "claude-3-opus"
        ),
        ChatTemplate(
            title: "Research & Analysis",
            description: "Deep dive into topics",
            icon: "magnifyingglass.circle",
            color: Color.orange,
            systemPrompt: "You are a research assistant. Provide thorough analysis, cite sources when possible, and offer balanced perspectives.",
            defaultModel: "gpt-4"
        ),
        ChatTemplate(
            title: "Quick Question",
            description: "Fast, concise answers",
            icon: "bolt.fill",
            color: Color.yellow,
            systemPrompt: "You are a concise assistant. Provide brief, direct answers without unnecessary elaboration.",
            defaultModel: "gpt-3.5-turbo"
        ),
        ChatTemplate(
            title: "Translation",
            description: "Translate between languages",
            icon: "globe",
            color: Color.cyan,
            systemPrompt: "You are a professional translator. Provide accurate translations while preserving meaning and cultural context.",
            defaultModel: "gpt-4"
        ),
        ChatTemplate(
            title: "Math & Science",
            description: "Solve problems and explain concepts",
            icon: "function",
            color: Color.indigo,
            systemPrompt: "You are a math and science tutor. Explain concepts clearly, show your work, and help with problem-solving.",
            defaultModel: "gpt-4"
        ),
        ChatTemplate(
            title: "Brainstorming",
            description: "Generate ideas and solutions",
            icon: "lightbulb.fill",
            color: Color.mint,
            systemPrompt: "You are a brainstorming partner. Generate creative ideas, explore possibilities, and think outside the box.",
            defaultModel: "claude-3-opus"
        )
    ]
}