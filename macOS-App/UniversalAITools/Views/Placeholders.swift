import SwiftUI

// MARK: - Missing View Components
// These are temporary placeholders to fix compilation issues

// KnowledgeGraphView3D is implemented in Views/Components/KnowledgeGraphView3D.swift

// AgentOrchestrationDashboard is implemented in Views/Components/AgentOrchestrationDashboard.swift

// ContextFlowDashboard is implemented in Views/Components/ContextFlowDashboard.swift

// ToolsView is defined in its own file

// SystemMonitoringView is implemented in Views/SystemMonitoringView.swift

// VisionProcessingView is defined in its own file

// ABMCTSOrchestrationView is defined in its own file

// MARK: - Chat Component Placeholders

struct EnhancedMessageBubble: View {
    let message: Message
    
    var body: some View {
        HStack(alignment: .top) {
            if message.role == .user {
                Spacer()
            }
            
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.system(size: 16))
                    .foregroundColor(.primary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(message.role == .user ? Color.blue : Color.gray.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .frame(maxWidth: 600, alignment: message.role == .user ? .trailing : .leading)
            }
            
            if message.role == .assistant {
                Spacer()
            }
        }
    }
}

struct EnhancedTypingIndicator: View {
    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 6, height: 6)
                        .scaleEffect(1.0)
                        .animation(
                            Animation.easeInOut(duration: 0.6)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.2),
                            value: true
                        )
                }
                Text("AI is thinking...")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.gray.opacity(0.2))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            
            Spacer()
        }
    }
}

struct ParticleButton<Content: View>: View {
    let action: () -> Void
    let content: Content
    
    init(action: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.action = action
        self.content = content()
    }
    
    var body: some View {
        Button(action: action) {
            content
        }
        .buttonStyle(.plain)
    }
}

struct SuccessParticles: View {
    @Binding var isTriggered: Bool
    
    var body: some View {
        EmptyView() // Placeholder for particle effects
    }
}

struct CompactVoiceButton: View {
    let voiceAgent: VoiceAgent
    
    var body: some View {
        Button(action: {}) {
            Image(systemName: "mic")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(Color.blue.gradient)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }
}

struct VoiceActivityIndicator: View {
    let voiceAgent: VoiceAgent
    
    var body: some View {
        Circle()
            .fill(Color.blue)
            .frame(width: 12, height: 12)
    }
}

// MARK: - Service Placeholders

public class TTSService: ObservableObject {
    public init() {}
}

public class STTService: ObservableObject {
    @Published public var partialTranscription = ""
    public var isAuthorized = false
    
    public init() {}
    
    public func requestAuthorization() async {
        isAuthorized = true
    }
}

public class VoiceAgent: ObservableObject {
    public enum State {
        case idle, listening, processing, responding, error
    }
    
    public enum InteractionMode {
        case conversational, manual
    }
    
    public struct Configuration {
        public let interactionMode: InteractionMode
        
        public init(interactionMode: InteractionMode = .manual) {
            self.interactionMode = interactionMode
        }
    }
    
    @Published public var state: State = .idle
    @Published public var isEnabled = true
    @Published public var currentInteraction: VoiceInteraction?
    
    public let configuration: Configuration
    
    public init(sttService: STTService, ttsService: TTSService, apiService: APIService) {
        self.configuration = Configuration()
    }
    
    public func cancelVoiceInteraction() {
        state = .idle
        currentInteraction = nil
    }
}

public struct VoiceInteraction {
    public let userInput: String
    
    public init(userInput: String) {
        self.userInput = userInput
    }
}

// MARK: - Visual Effects Note
// Visual effects (glow, neumorphism, glassMorphism, floating) are implemented in Extensions/VisualEffects.swift

// AnimatedGradientBackground is defined in Utils/AppTheme.swift

struct PlaceholderView: View {
    let title: String
    let icon: String
    let description: String

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(AppTheme.accentBlue)
                .glow(color: AppTheme.accentBlue, radius: 20)
                .floating(amplitude: 5, duration: 3)
                .padding(.top, 40)

            Text(title)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(AppTheme.primaryText)
                .glow(color: .white, radius: 5)

            Text(description)
                .font(.body)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AnimatedGradientBackground())
        .glassMorphism(cornerRadius: 0)
    }
}

// ABMCTSOrchestrationView is defined in Views/ABMCTSOrchestrationView.swift

// MALTSwarmControlView is defined in Views/MALTSwarmControlView.swift

struct IntelligentParametersView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 12) {
            Text("Intelligent Parameters")
                .font(.title2)
                .fontWeight(.bold)
            Text("Optimize and track parameter tuning runs.")
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding()
    }
}

private struct ControlPanel: View {
    let startAction: () -> Void
    let pauseAction: () -> Void
    let stopAction: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            ParticleButton(action: startAction) {
                Text("Start")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(AppTheme.accentOrange.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .glow(color: AppTheme.accentOrange, radius: 8)
            }

            Button("Pause", action: pauseAction)
                .buttonStyle(.bordered)
                .foregroundColor(AppTheme.accentBlue)

            Button("Stop", action: stopAction)
                .buttonStyle(.bordered)
                .foregroundColor(.red)
        }
    }
}

struct KnowledgeBaseView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var mcpService: MCPService
    @State private var query: String = ""
    @State private var results: [[String: Any]] = []
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    // Filters & pagination
    @State private var selectedCategoryFilter: String = ""
    @State private var fetchLimit: Int = 25
    private let categoryOptions: [String] = [
        "", "knowledge", "debug_logs", "project_overview", "code_patterns", "error_analysis"
    ]

    // Save new note
    @State private var newNoteText: String = ""
    @State private var newNoteCategory: String = "knowledge"

    var body: some View {
        VStack(spacing: 12) {
            header
            controls

            if let errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .font(.caption)
            }

            if isLoading {
                ProgressView().padding(.top, 8)
            }

            resultsList

            HStack {
                Button("Load More") { Task { await loadMore() } }
                    .disabled(isLoading)
                Spacer()
            }

            Divider().padding(.vertical, 4)

            saveNotePanel
        }
        .padding()
    }

    private var header: some View {
        HStack {
            Text("Knowledge Base")
                .font(.title2)
                .fontWeight(.bold)
            Spacer()
            if mcpService.isConnected {
                Text("MCP Connected")
                    .font(.caption)
                    .foregroundColor(AppTheme.accentOrange)
            } else {
                Text("MCP Disconnected")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var controls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                TextField("Search via MCP", text: $query)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .onSubmit { Task { await runSearch(resetLimit: true) } }

                Picker("Category", selection: $selectedCategoryFilter) {
                    ForEach(categoryOptions, id: \.self) { value in
                        Text(value.isEmpty ? "All Categories" : value).tag(value)
                    }
                }
                .frame(width: 180)

                Button("Search") { Task { await runSearch(resetLimit: true) } }
                    .disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                Button("Recent") { Task { await loadRecent(resetLimit: true) } }
                    .disabled(isLoading)
                Spacer()
            }
        }
    }

    private var resultsList: some View {
        List {
            ForEach(Array(results.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 4) {
                    Text((item["content"] as? String) ?? "<no content>")
                        .font(.subheadline)
                    HStack(spacing: 8) {
                        if let category = item["category"] as? String { TagView(text: category) }
                        if let createdAt = item["created_at"] as? String { TagView(text: createdAt) }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private var saveNotePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Save Note to MCP")
                .font(.headline)
            HStack(spacing: 8) {
                Picker("Category", selection: $newNoteCategory) {
                    ForEach(categoryOptions.filter { !$0.isEmpty }, id: \.self) { value in
                        Text(value).tag(value)
                    }
                }
                .frame(width: 180)
                Spacer()
            }
            TextEditor(text: $newNoteText)
                .frame(minHeight: 80)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                )
            HStack {
                Button("Save to MCP") { Task { await saveNote() } }
                    .disabled(newNoteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                Spacer()
            }
        }
    }

    private func runSearch(resetLimit: Bool) async {
        if resetLimit { fetchLimit = 25 }
        isLoading = true
        errorMessage = nil
        do {
            let _: String? = selectedCategoryFilter.isEmpty ? nil : selectedCategoryFilter
            let data = try await mcpService.searchContext(query)
            results = data
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadRecent(resetLimit: Bool) async {
        if resetLimit { fetchLimit = 25 }
        isLoading = true
        errorMessage = nil
        do {
            let _: String? = selectedCategoryFilter.isEmpty ? nil : selectedCategoryFilter
            let data = try await mcpService.getRecentContext()
            results = data
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadMore() async {
        fetchLimit += 25
        if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            await loadRecent(resetLimit: false)
        } else {
            await runSearch(resetLimit: false)
        }
    }

    private func saveNote() async {
        isLoading = true
        errorMessage = nil
        do {
            try await mcpService.saveContext([
                "content": newNoteText,
                "category": newNoteCategory,
                "metadata": ["source": "macOS-app", "timestamp": Date().timeIntervalSince1970]
            ])
            newNoteText = ""
            await loadRecent(resetLimit: true)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct TagView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.secondary.opacity(0.15))
            .cornerRadius(4)
    }
}

// KnowledgeBaseView definition moved up to avoid duplication

#Preview {
    Group {
        SystemMonitoringView.init()
        ABMCTSOrchestrationView.init()
        MALTSwarmControlView.init()
        IntelligentParametersView.init()
        KnowledgeBaseView.init()
    }
    .environmentObject(AppState.init())
    .environmentObject(APIService.init())
    .environmentObject(MCPService.init())
}
