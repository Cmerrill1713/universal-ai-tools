import SwiftUI

struct StandaloneWelcomeView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    var body: some View {
        VStack(spacing: 40) {
            // Header
            VStack(spacing: 16) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 80))
                    .foregroundColor(.accentColor)

                Text("Universal AI Tools")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Your comprehensive AI development and orchestration platform")
                    .font(.title3)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            // Connection Status
            connectionStatusSection

            // Quick Actions
            quickActionsSection

            // Recent Activity
            if !appState.chats.isEmpty || !appState.activeAgents.isEmpty {
                recentActivitySection
            }

            Spacer()

            // Footer
            footerSection
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var connectionStatusSection: some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                Circle()
                    .fill(appState.backendConnected ? Color.green : Color.red)
                    .frame(width: 12, height: 12)

                Text(appState.backendConnected ? "Connected to Backend" : "Backend Disconnected")
                    .font(.headline)
            }

            if !appState.backendConnected {
                Button("Reconnect") {
                    Task {
                        await apiService.connectToBackend()
                    }
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
    }

    private var quickActionsSection: some View {
        VStack(spacing: 16) {
            Text("Quick Actions")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 16) {
                QuickActionCard(
                    title: "New Chat",
                    subtitle: "Start a conversation",
                    icon: "bubble.left.and.bubble.right",
                    color: .blue
                ) {
                    appState.createNewChat()
                }

                QuickActionCard(
                    title: "Agent Tasks",
                    subtitle: "Manage AI agents",
                    icon: "person.3",
                    color: .green
                ) {
                    appState.showAgentSelector = true
                }

                QuickActionCard(
                    title: "System Monitor",
                    subtitle: "View performance",
                    icon: "chart.line.uptrend.xyaxis",
                    color: .orange
                ) {
                    // Navigate to monitoring
                }

                QuickActionCard(
                    title: "Settings",
                    subtitle: "Configure app",
                    icon: "gear",
                    color: .purple
                ) {
                    appState.showSettings = true
                }
            }
        }
    }

    private var recentActivitySection: some View {
        VStack(spacing: 16) {
            Text("Recent Activity")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 8) {
                if !appState.chats.isEmpty {
                    HStack {
                        Text("Recent Chats")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("\(appState.chats.count)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    ForEach(appState.chats.prefix(3)) { chat in
                        HStack {
                            Image(systemName: "bubble.left.and.bubble.right")
                                .foregroundColor(.blue)
                            Text(chat.title)
                                .lineLimit(1)
                            Spacer()
                            Text(chat.updatedAt, style: .relative)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }

                if !appState.activeAgents.isEmpty {
                    HStack {
                        Text("Active Agents")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("\(appState.activeAgents.count)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    ForEach(appState.activeAgents.prefix(3)) { agent in
                        HStack {
                            Image(systemName: "person.3")
                                .foregroundColor(.green)
                            Text(agent.name)
                                .lineLimit(1)
                            Spacer()
                            Text(agent.status.rawValue.capitalized)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)
        }
    }

    private var footerSection: some View {
        VStack(spacing: 8) {
            Text("Version 1.0.0")
                .font(.caption)
                .foregroundColor(.secondary)

            HStack(spacing: 16) {
                Button("Documentation") {
                    // Open documentation
                }
                .buttonStyle(.borderless)

                Button("Support") {
                    // Open support
                }
                .buttonStyle(.borderless)

                Button("About") {
                    appState.showAboutWindow = true
                }
                .buttonStyle(.borderless)
            }
            .font(.caption)
        }
    }
}

struct QuickActionCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 32))
                    .foregroundColor(color)

                VStack(spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.primary)

                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    StandaloneWelcomeView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
