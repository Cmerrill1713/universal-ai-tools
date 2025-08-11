import SwiftUI

struct DetailView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    var body: some View {
        VStack(spacing: 0) {
            // Header
            detailHeader

            Divider()

            // Content based on selected item
            detailContent

            Spacer()

            // Footer
            detailFooter
        }
        .frame(minWidth: 300, maxWidth: 400)
        .background(Color(NSColor.controlBackgroundColor))
    }

    private var detailHeader: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Details")
                    .font(.headline)
                Spacer()
                Button("Close") {
                    // Close detail panel
                }
                .buttonStyle(.borderless)
            }

            // Quick stats
            HStack(spacing: 16) {
                StatCardMini(
                    title: "Agents",
                    value: "\(appState.activeAgents.count)",
                    icon: "person.3",
                    color: .green
                )

                StatCardMini(
                    title: "Chats",
                    value: "\(appState.chats.count)",
                    icon: "bubble.left.and.bubble.right",
                    color: .blue
                )

                StatCardMini(
                    title: "Status",
                    value: appState.backendConnected ? "Online" : "Offline",
                    icon: "circle.fill",
                    color: appState.backendConnected ? .green : .red
                )
            }
        }
        .padding()
    }

    private var detailContent: some View {
        ScrollView {
            VStack(spacing: 20) {
                // System Metrics
                if let metrics = appState.systemMetrics {
                    systemMetricsSection(metrics)
                }

                // Active Agents
                if !appState.activeAgents.isEmpty {
                    activeAgentsSection
                }

                // Recent Activity
                recentActivitySection

                // Quick Actions
                quickActionsSection
            }
            .padding()
        }
    }

    private func systemMetricsSection(_ metrics: SystemMetrics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("System Metrics")
                .font(.headline)

            VStack(spacing: 8) {
                MetricRow(
                    label: "CPU Usage",
                    value: "\(Int(metrics.cpuUsage))%",
                    color: metrics.cpuUsage > 80 ? .red : .green
                )

                MetricRow(
                    label: "Memory Usage",
                    value: "\(Int(metrics.memoryUsage))%",
                    color: metrics.memoryUsage > 80 ? .red : .green
                )

                MetricRow(
                    label: "Requests/min",
                    value: "\(metrics.requestsPerMinute)",
                    color: .blue
                )

                MetricRow(
                    label: "Active Connections",
                    value: "\(metrics.activeConnections)",
                    color: .orange
                )

                MetricRow(
                    label: "Uptime",
                    value: formatUptime(metrics.uptime),
                    color: .purple
                )
            }
            .padding()
            .background(Color(NSColor.windowBackgroundColor))
            .cornerRadius(8)
        }
    }

    private var activeAgentsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Active Agents")
                .font(.headline)

            VStack(spacing: 8) {
                ForEach(appState.activeAgents) { agent in
                    AgentRow(agent: agent)
                }
            }
        }
    }

    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.headline)

            VStack(spacing: 8) {
                ForEach(appState.chats.prefix(5)) { chat in
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
        }
    }

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)

            VStack(spacing: 8) {
                QuickActionRowButton(
                    title: "New Chat",
                    icon: "plus.bubble",
                    action: { appState.createNewChat() }
                )

                QuickActionRowButton(
                    title: "Agent Monitor",
                    icon: "chart.bar",
                    action: { appState.showAgentMonitor = true }
                )

                QuickActionRowButton(
                    title: "Settings",
                    icon: "gear",
                    action: { appState.showSettings = true }
                )

                QuickActionRowButton(
                    title: "Reconnect",
                    icon: "arrow.clockwise",
                    action: {
                        Task {
                            await apiService.connectToBackend()
                        }
                    }
                )
            }
        }
    }

    private var detailFooter: some View {
        VStack(spacing: 8) {
            Divider()

            HStack {
                Text("Universal AI Tools v1.0.0")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Button("Help") {
                    // Show help
                }
                .buttonStyle(.borderless)
                .font(.caption)
            }
        }
        .padding()
    }

    private func formatUptime(_ seconds: Double) -> String {
        let hours = Int(seconds) / 3600
        let minutes = (Int(seconds) % 3600) / 60
        return "\(hours)h \(minutes)m"
    }
}

private struct StatCardMini: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.headline)
                .fontWeight(.semibold)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(NSColor.windowBackgroundColor))
        .cornerRadius(8)
    }
}

private struct MetricRow: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(color)
        }
    }
}

private struct AgentRow: View {
    let agent: Agent

    var body: some View {
        HStack {
            Image(systemName: "person.3")
                .foregroundColor(.green)

            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(agent.type)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text(agent.status.rawValue.capitalized)
                .font(.caption)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(statusColor)
                .foregroundColor(.white)
                .clipShape(Capsule())
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch agent.status {
        case .active: return .green
        case .busy: return .orange
        case .error: return .red
        case .inactive: return .gray
        }
    }
}

private struct QuickActionRowButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(title)
                    .font(.subheadline)
                Spacer()
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(Color(NSColor.windowBackgroundColor))
            .cornerRadius(6)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    DetailView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
