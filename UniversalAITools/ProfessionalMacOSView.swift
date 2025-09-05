import SwiftUI

#if os(macOS)
/// Professional Apple-quality macOS interface with backend integration
struct ProfessionalMacOSView: View {
    @State private var activeView: ActiveView = .home
    @State private var searchQuery: String = ""

    // Backend service integration
    @State private var backendService = MacOSBackendService.shared
    @State private var conversations: [Conversation] = []
    @State private var usageStats: UsageStats?
    @State private var isLoadingConversations = false
    @State private var isLoadingStats = false
    @State private var realTimeChatMessages: [String] = []

    // Family/user management
    @State private var familyMembers: [FamilyMember] = [
        FamilyMember(id: "1", name: "Dad", role: "Administrator", avatar: "👨‍💻"),
        FamilyMember(id: "2", name: "Mom", role: "Power User", avatar: "👩‍💼"),
        FamilyMember(id: "3", name: "Teen", role: "Student", avatar: "🧑‍🎓"),
        FamilyMember(id: "4", name: "Little One", role: "Beginner", avatar: "👶")
    ]
    @State private var currentUser: FamilyMember = FamilyMember(id: "1", name: "Dad", role: "Administrator", avatar: "👨‍💻")

    var body: some View {
        ZStack {
            mainContent
        }
        .task {
            await loadInitialData()
        }
    }

    private var mainContent: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            contentArea
        }
    }

    private var sidebar: some View {
        List(selection: $activeView) {
            navigationSection
            familySection
        }
        .navigationTitle("Universal AI Tools")
    }

    private var navigationSection: some View {
        Section("Navigation") {
            ForEach(ActiveView.allCases, id: \.self) { view in
                let item = NavigationItem(view)
                NavigationLink(value: view) {
                    HStack {
                        Text(item.icon)
                        Text(item.name)
                    }
                }
            }
        }
    }

    private var familySection: some View {
        Section("Family") {
            ForEach(familyMembers, id: \.id) { member in
                HStack {
                    Text(member.avatar)
                    VStack(alignment: .leading) {
                        Text(member.name)
                        Text(member.role)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .opacity(currentUser.id == member.id ? 1.0 : 0.6)
            }
        }
    }

    private var contentArea: some View {
        Group {
            switch activeView {
            case .home:
                HomeView(
                    conversations: $conversations,
                    usageStats: $usageStats,
                    isLoadingConversations: $isLoadingConversations,
                    isLoadingStats: $isLoadingStats,
                    backendService: backendService
                )
            case .chat:
                ChatView()
            case .vision:
                VisionView()
            case .voice:
                VoiceView()
            case .agents:
                AgentsView()
            case .analytics:
                AnalyticsView()
            case .settings:
                SettingsView()
            }
        }
    }
}

// MARK: - Supporting Views

struct HomeView: View {
    @Binding var conversations: [Conversation]
    @Binding var usageStats: UsageStats?
    @Binding var isLoadingConversations: Bool
    @Binding var isLoadingStats: Bool
    let backendService: MacOSBackendService

    private var connectionStatusView: some View {
        HStack {
            Circle()
                .fill(backendService.isConnected ? Color.green : Color.red)
                .frame(width: 12, height: 12)
            Text(backendService.isConnected ? "Connected to backend" : "Backend connection failed")
                .font(.subheadline)
                .foregroundColor(backendService.isConnected ? .green : .red)
            Spacer()
        }
        .padding(.horizontal)
    }

    private var greetingSection: some View {
        VStack(spacing: 8) {
            Text(getTimeBasedGreeting())
                .font(.largeTitle)
                .fontWeight(.bold)
            Text("Welcome to Universal AI Tools!")
                .font(.title2)
                .foregroundColor(.secondary)
        }
    }

    private var usageStatsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Usage Statistics")
                .font(.headline)

            if isLoadingStats {
                ProgressView("Loading stats...")
            } else {
                HStack(spacing: 40) {
                    if let stats = usageStats {
                        StatCard(number: "\(stats.totalConversations)", label: "Conversations", color: .blue)
                        StatCard(number: "\(stats.totalImagesAnalyzed)", label: "Images Analyzed", color: .green)
                        StatCard(number: "\(stats.totalVoiceCommands)", label: "Voice Commands", color: .purple)
                    } else {
                        StatCard(number: "--", label: "Conversations", color: .blue)
                        StatCard(number: "--", label: "Images Analyzed", color: .green)
                        StatCard(number: "--", label: "Voice Commands", color: .purple)
                    }
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Recent Activity")
                .font(.headline)

            if isLoadingConversations {
                ProgressView("Loading conversations...")
            } else if conversations.isEmpty {
                Text("No recent conversations")
                    .foregroundColor(.secondary)
                    .padding()
            } else {
                ForEach(conversations.prefix(3)) { conversation in
                    HStack {
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 8, height: 8)
                        VStack(alignment: .leading) {
                            Text(conversation.title)
                                .font(.subheadline)
                                .fontWeight(.medium)
                            Text(conversation.lastMessage.isEmpty ? "New conversation" : conversation.lastMessage.prefix(50) + "...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(conversation.updatedAt.formatted(.relative(presentation: .named)))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                connectionStatusView
                greetingSection

                usageStatsSection
                recentActivitySection

                Spacer()
            }
            .padding(.vertical)
        }
    }

    private func getTimeBasedGreeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning! 🌅"
        case 12..<17: return "Good afternoon! ☀️"
        case 17..<22: return "Good evening! 🌙"
        default: return "Good night! 🌙"
        }
    }
}

struct StatCard: View {
    let number: String
    let label: String
    let color: Color

    var body: some View {
        VStack {
            Text(number)
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

struct ChatView: View {
    @State private var message: String = ""

    var body: some View {
        VStack {
            Text("💬 AI Conversations")
                .font(.largeTitle)
                .padding()

            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Welcome! How can I help you today?")
                        .padding()
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(8)

                    // Add more chat messages here
                }
                .padding()
            }

            HStack {
                TextField("Type your message...", text: $message)
                    .textFieldStyle(.roundedBorder)
                Button("Send") {
                    // Handle send
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
    }
}

struct VisionView: View {
    var body: some View {
        VStack {
            Text("👁 Vision Analysis")
                .font(.largeTitle)
                .padding()

            Text("Upload an image to analyze with AI")
                .foregroundColor(.secondary)

            Button("Choose Image") {
                // Handle image selection
            }
            .buttonStyle(.borderedProminent)
            .padding()

            Spacer()
        }
    }
}

struct VoiceView: View {
    var body: some View {
        VStack {
            Text("🎤 Voice Assistant")
                .font(.largeTitle)
                .padding()

            Text("Click to start voice interaction")
                .foregroundColor(.secondary)

            Button("Start Recording") {
                // Handle voice recording
            }
            .buttonStyle(.borderedProminent)
            .padding()

            Spacer()
        }
    }
}

struct AgentsView: View {
    var body: some View {
        VStack {
            Text("🤖 AI Agents")
                .font(.largeTitle)
                .padding()

            Text("Create and manage automated workflows")
                .foregroundColor(.secondary)

            Button("Create New Agent") {
                // Handle agent creation
            }
            .buttonStyle(.borderedProminent)
            .padding()

            Spacer()
        }
    }
}

struct AnalyticsView: View {
    var body: some View {
        VStack {
            Text("📊 Analytics")
                .font(.largeTitle)
                .padding()

            Text("Usage insights and metrics")
                .foregroundColor(.secondary)

            HStack(spacing: 40) {
                VStack {
                    Text("1,234")
                        .font(.largeTitle)
                        .foregroundColor(.orange)
                    Text("Total Interactions")
                        .font(.caption)
                }
                VStack {
                    Text("45m")
                        .font(.largeTitle)
                        .foregroundColor(.red)
                    Text("Avg Response Time")
                        .font(.caption)
                }
            }
            .padding()
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))

            Spacer()
        }
        .padding()
    }
}

struct SettingsView: View {
    var body: some View {
        Form {
            Section("General") {
                Toggle("Dark Mode", isOn: .constant(true))
                Toggle("Notifications", isOn: .constant(true))
            }

            Section("AI Settings") {
                Picker("Model", selection: .constant("GPT-4")) {
                    Text("GPT-4").tag("GPT-4")
                    Text("GPT-3.5").tag("GPT-3.5")
                }
            }

            Section("Privacy") {
                Toggle("Analytics", isOn: .constant(false))
                Toggle("Crash Reporting", isOn: .constant(true))
            }
        }
        .formStyle(.grouped)
    }
}

// MARK: - Supporting Types

enum ActiveView: String, CaseIterable {
    case home = "Home"
    case chat = "Conversations"
    case vision = "Vision"
    case voice = "Voice"
    case agents = "Agents"
    case analytics = "Analytics"
    case settings = "Settings"

    var icon: String {
        switch self {
        case .home: return "🏠"
        case .chat: return "💬"
        case .vision: return "👁"
        case .voice: return "🎤"
        case .agents: return "🤖"
        case .analytics: return "📊"
        case .settings: return "⚙️"
        }
    }
}

struct FamilyMember: Identifiable {
    let id: String
    let name: String
    let role: String
    let avatar: String
}

struct NavigationItem: Identifiable {
    let id: ActiveView
    let name: String
    let icon: String

    init(_ view: ActiveView) {
        self.id = view
        self.name = view.rawValue
        self.icon = view.icon
    }
}

struct UsageStat: Identifiable {
    let id = UUID()
    let number: String
    let label: String

    init(number: String, label: String) {
        self.number = number
        self.label = label
    }
}

struct RecentActivity {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String
    let time: String
}

// MARK: - Helper Methods

extension ProfessionalMacOSView {
    private func getTimeBasedGreeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning, \(currentUser.name)"
        case 12..<17: return "Good afternoon, \(currentUser.name)"
        case 17..<22: return "Good evening, \(currentUser.name)"
        default: return "Good night, \(currentUser.name)"
        }
    }

    private func loadInitialData() async {
        // Set up real-time observers
        setupRealTimeObservers()

        // Load conversations
        isLoadingConversations = true
        do {
            conversations = try await backendService.getConversations()
        } catch {
            print("Failed to load conversations: \(error)")
        }
        isLoadingConversations = false

        // Load usage stats
        isLoadingStats = true
        do {
            usageStats = try await backendService.getUsageStats()
        } catch {
            print("Failed to load usage stats: \(error)")
        }
        isLoadingStats = false
    }

    private func setupRealTimeObservers() {
        // Observe real-time chat messages
        Task {
            for await message in backendService.chatMessageReceived.values {
                await MainActor.run {
                    realTimeChatMessages.append(message)
                }
            }
        }

        // Observe conversation updates
        Task {
            for await conversationString in backendService.conversationUpdated.values {
                await MainActor.run {
                    // For now, just log the conversation update
                    // TODO: Parse conversation updates from string format
                    print("Conversation update received: \(conversationString)")
                }
            }
        }

        // Observe system status updates
        Task {
            for await status in backendService.systemStatusUpdated.values {
                await MainActor.run {
                    // Handle system status updates if needed
                    print("System status updated: \(status)")
                }
            }
        }
    }

    private func getRecentActivity() -> [RecentActivity] {
        // Return recent conversations as activity
        return conversations.prefix(3).map { conv in
            RecentActivity(
                icon: "💬",
                iconColor: .blue,
                title: conv.title,
                subtitle: conv.lastMessage.isEmpty ? "New conversation" : "Last: \(conv.lastMessage.prefix(50))...",
                time: conv.updatedAt.formatted(.relative(presentation: .named))
            )
        }
    }
}
#endif
