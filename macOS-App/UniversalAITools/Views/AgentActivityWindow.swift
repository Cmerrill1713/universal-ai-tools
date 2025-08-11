import SwiftUI
import Foundation
import Combine

struct AgentActivityWindow: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab = 0

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("Agent Activity")
                        .font(.title2)
                        .fontWeight(.semibold)

                    Spacer()

                    Button("Done") { dismiss() }
                        .keyboardShortcut(.escape)
                }
                .padding()
                .background(Color(.controlBackgroundColor))

                Divider()

                // Tab Selection
                Picker("View", selection: $selectedTab) {
                    Text("Active Agents").tag(0)
                    Text("Recent Tasks").tag(1)
                    Text("System Status").tag(2)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.top, 8)

                // Content
                TabView(selection: $selectedTab) {
                    ActiveAgentsView()
                        .tag(0)

                    RecentTasksView()
                        .tag(1)

                    SystemStatusView()
                        .tag(2)
                }
            }
        }
        .frame(width: 700, height: 600)
        .background(AppTheme.windowBackgroundGradient)
    }
}

// MARK: - Active Agents View
struct ActiveAgentsView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(appState.activeAgents) { agent in
                    AgentActivityCard(agent: agent)
                }

                if appState.activeAgents.isEmpty {
                    EmptyStateView(
                        icon: "person.3",
                        title: "No Active Agents",
                        description: "Agents will appear here when they're working on tasks"
                    )
                }
            }
            .padding()
        }
    }
}

// MARK: - Recent Tasks View
struct RecentTasksView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(appState.recentTasks) { task in
                    TaskHistoryCard(item: task)
                }

                if appState.recentTasks.isEmpty {
                    EmptyStateView(
                        icon: "clock.arrow.circlepath",
                        title: "No Recent Tasks",
                        description: "Completed tasks will appear here"
                    )
                }
            }
            .padding()
        }
    }
}

// MARK: - System Status View
struct SystemStatusView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Connection Status
                StatusCard(
                    title: "Backend Connection",
                    status: appState.backendConnected ? "Connected" : "Disconnected",
                    statusColor: appState.backendConnected ? .green : .red,
                    icon: appState.backendConnected ? "checkmark.circle.fill" : "xmark.circle.fill"
                )

                // API Status
                StatusCard(
                    title: "API Service",
                    status: appState.apiServiceStatus.rawValue,
                    statusColor: appState.apiServiceStatus.color,
                    icon: appState.apiServiceStatus.icon
                )

                // Agent Count
                StatusCard(
                    title: "Total Agents",
                    status: "\(appState.activeAgents.count) active",
                    statusColor: .orange,
                    icon: "person.3.fill"
                )

                // Memory Usage
                StatusCard(
                    title: "Memory Usage",
                    status: String(format: "%.1f%%", appState.memoryUsage),
                    statusColor: .purple,
                    icon: "memorychip"
                )
            }
            .padding()
        }
    }
}

// MARK: - Agent Activity Card
struct AgentActivityCard: View {
    let agent: Agent
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 8) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)

                    Text(agent.name)
                        .font(.headline)
                        .fontWeight(.semibold)
                }

                Spacer()

                Button(action: { isExpanded.toggle() }, label: {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.secondary)
                        .font(.caption)
                })
                .buttonStyle(.plain)
            }

            if let currentTask = agent.currentTask {
                Text(currentTask)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(isExpanded ? nil : 2)
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Status:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(agent.status.rawValue.capitalized)
                            .font(.caption)
                            .fontWeight(.medium)
                    }

                    if let progress = agent.progress {
                        HStack {
                        Text("Progress:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            ProgressView(value: progress)
                                .frame(width: 100)
                            Text(String(format: "%d%%", Int(progress * 100)))
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    if let startTime = agent.startTime {
                        HStack {
                            Text("Started:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(startTime, style: .relative)
                                .font(.caption)
                                .foregroundColor(.primary)
                        }
                    }
                }
                .padding(.leading, 16)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.separatorColor), lineWidth: 1)
        )
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

// MARK: - Task History Card
struct TaskHistoryCard: View {
    let item: TaskHistory

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: item.status == .completed ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(item.status == .completed ? .green : .red)
                .font(.title2)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.task)
                    .font(.headline)
                    .fontWeight(.medium)

                Text("")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                HStack {
                    Text(item.agentName)
                        .font(.caption)
                        .foregroundColor(.blue)

                    Spacer()

                    Text(item.timestamp, style: .relative)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.separatorColor), lineWidth: 1)
        )
    }
}

// MARK: - Status Card
struct StatusCard: View {
    let title: String
    let status: String
    let statusColor: Color
    let icon: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(statusColor)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.medium)

                Text(status)
                    .font(.subheadline)
                    .foregroundColor(statusColor)
                    .fontWeight(.semibold)
            }

            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.separatorColor), lineWidth: 1)
        )
    }
}

// MARK: - Empty State View
struct EmptyStateView: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text(title)
                .font(.headline)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)

            Text(description)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 60)
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    AgentActivityWindow()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
