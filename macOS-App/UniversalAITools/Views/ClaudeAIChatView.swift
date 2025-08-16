//
//  ClaudeAIChatView.swift
//  UniversalAITools
//
//  Created by Universal AI Tools
//

import SwiftUI
import Combine

struct ClaudeAIChatView: View {
    @StateObject private var claudeService = ClaudeAIService.shared
    @State private var messageText = ""
    @State private var messages: [ChatMessage] = []
    @State private var isLoading = false
    @State private var showSettings = false
    @State private var selectedCodeAction: CodeAction = .analyze
    @State private var apiKey = ""
    @FocusState private var isInputFocused: Bool
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView
            
            Divider()
            
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(messages) { message in
                            MessageBubbleView(message: message)
                                .id(message.id)
                        }
                        
                        if isLoading {
                            LoadingMessageView()
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.count) { _ in
                    withAnimation {
                        proxy.scrollTo(messages.last?.id, anchor: .bottom)
                    }
                }
            }
            
            Divider()
            
            // Input
            inputView
        }
        .frame(minWidth: 600, minHeight: 400)
        .onAppear {
            checkAPIKey()
        }
        .sheet(isPresented: $showSettings) {
            ClaudeSettingsView(apiKey: $apiKey) { key in
                claudeService.updateAPIKey(key)
                showSettings = false
            }
        }
    }
    
    private var headerView: some View {
        HStack {
            Image(systemName: "brain.head.profile")
                .font(.title2)
                .foregroundColor(.accentColor)
            
            Text("Claude AI Assistant")
                .font(.headline)
            
            Spacer()
            
            // Model selector
            Picker("Model", selection: $claudeService.currentModel) {
                ForEach(claudeService.availableModels, id: \.self) { model in
                    Text(model.replacingOccurrences(of: "claude-", with: ""))
                        .tag(model)
                }
            }
            .pickerStyle(MenuPickerStyle())
            .frame(width: 200)
            
            // Connection status
            Circle()
                .fill(claudeService.isConnected ? Color.green : Color.red)
                .frame(width: 8, height: 8)
            
            Button(action: { showSettings = true }) {
                Image(systemName: "gear")
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding()
    }
    
    private var inputView: some View {
        HStack(spacing: 8) {
            // Code action selector
            Menu {
                ForEach([CodeAction.analyze, .refactor, .document, .debug, .optimize, .test], id: \.self) { action in
                    Button(actionLabel(for: action)) {
                        selectedCodeAction = action
                    }
                }
            } label: {
                Label(actionLabel(for: selectedCodeAction), systemImage: "chevron.down")
                    .frame(width: 120)
            }
            .menuStyle(BorderlessButtonMenuStyle())
            
            // Message input
            TextField("Ask Claude anything...", text: $messageText)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .focused($isInputFocused)
                .onSubmit {
                    sendMessage()
                }
            
            // Send button
            Button(action: sendMessage) {
                Image(systemName: "paperplane.fill")
                    .foregroundColor(messageText.isEmpty || !claudeService.isConnected ? .gray : .accentColor)
            }
            .buttonStyle(PlainButtonStyle())
            .disabled(messageText.isEmpty || !claudeService.isConnected || isLoading)
        }
        .padding()
    }
    
    private func actionLabel(for action: CodeAction) -> String {
        switch action {
        case .analyze: return "Analyze"
        case .refactor: return "Refactor"
        case .document: return "Document"
        case .debug: return "Debug"
        case .optimize: return "Optimize"
        case .test: return "Test"
        }
    }
    
    private func sendMessage() {
        guard !messageText.isEmpty, claudeService.isConnected else { return }
        
        let userMessage = ChatMessage(role: .user, content: messageText)
        messages.append(userMessage)
        
        let currentText = messageText
        messageText = ""
        isLoading = true
        
        Task {
            do {
                // Check if message contains code block
                if currentText.contains("```") {
                    // Extract code and process with selected action
                    let response = try await claudeService.processCode(
                        extractCode(from: currentText),
                        action: selectedCodeAction
                    )
                    await MainActor.run {
                        messages.append(ChatMessage(role: .assistant, content: response))
                        isLoading = false
                    }
                } else {
                    // Regular message
                    let response = try await claudeService.sendMessage(currentText)
                    await MainActor.run {
                        messages.append(ChatMessage(role: .assistant, content: response))
                        isLoading = false
                    }
                }
            } catch {
                await MainActor.run {
                    messages.append(ChatMessage(
                        role: .assistant,
                        content: "Error: \(error.localizedDescription)"
                    ))
                    isLoading = false
                }
            }
        }
    }
    
    private func extractCode(from text: String) -> String {
        // Simple code extraction from markdown code blocks
        let pattern = "```(?:swift)?\\n?([\\s\\S]*?)```"
        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let range = Range(match.range(at: 1), in: text) {
            return String(text[range])
        }
        return text
    }
    
    private func checkAPIKey() {
        if !claudeService.isConnected {
            showSettings = true
        }
    }
}

// MARK: - Message Bubble View

struct MessageBubbleView: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.role == .user {
                Spacer()
            }
            
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.role == .user ? "You" : "Claude")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(message.content)
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(message.role == .user ? Color.accentColor.opacity(0.2) : Color.gray.opacity(0.1))
                    )
                    .textSelection(.enabled)
            }
            .frame(maxWidth: 500, alignment: message.role == .user ? .trailing : .leading)
            
            if message.role == .assistant {
                Spacer()
            }
        }
    }
}

// MARK: - Loading View

struct LoadingMessageView: View {
    @State private var dots = ""
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Claude")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                HStack(spacing: 4) {
                    Text("Thinking")
                    Text(dots)
                        .frame(width: 20, alignment: .leading)
                }
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.gray.opacity(0.1))
                )
            }
            .frame(maxWidth: 500, alignment: .leading)
            
            Spacer()
        }
        .onAppear {
            animateDots()
        }
    }
    
    private func animateDots() {
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { timer in
            if dots.count >= 3 {
                dots = ""
            } else {
                dots += "."
            }
        }
    }
}

// MARK: - Settings View

struct ClaudeSettingsView: View {
    @Binding var apiKey: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Claude AI Settings")
                .font(.title2)
                .bold()
            
            VStack(alignment: .leading, spacing: 8) {
                Text("API Key")
                    .font(.headline)
                
                SecureField("sk-ant-...", text: $apiKey)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                Text("Get your API key from [console.anthropic.com](https://console.anthropic.com)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.escape)
                
                Spacer()
                
                Button("Save") {
                    onSave(apiKey)
                }
                .keyboardShortcut(.return)
                .buttonStyle(.borderedProminent)
                .disabled(apiKey.isEmpty)
            }
        }
        .padding()
        .frame(width: 400)
    }
}

// MARK: - Chat Message Model

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: MessageRole
    let content: String
    let timestamp = Date()
}

enum MessageRole {
    case user
    case assistant
    case system
}

// MARK: - Preview

struct ClaudeAIChatView_Previews: PreviewProvider {
    static var previews: some View {
        ClaudeAIChatView()
    }
}