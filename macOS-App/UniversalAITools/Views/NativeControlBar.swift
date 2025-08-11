import SwiftUI

struct NativeControlBar: View {
    let item: SidebarItem
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 16) {
            // Section title and icon
            HStack(spacing: 8) {
                Image(systemName: item.icon)
                    .font(.title2)
                    .foregroundColor(.accentColor)

                Text(item.title)
                    .font(.headline)
                    .fontWeight(.semibold)
            }

            Spacer()

            // Quick actions based on section
            quickActions

            // View mode indicator
            HStack(spacing: 4) {
                Image(systemName: "rectangle")
                    .font(.caption)
                Text("Native")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(NSColor.controlBackgroundColor))
    }

    @ViewBuilder
    private var quickActions: some View {
        switch item {
        case .dashboard:
            dashboardActions
        case .chat:
            chatActions
        case .agents:
            agentActions
        case .tools:
            dashboardActions
        case .mlx:
            mlxActions
        case .vision:
            visionActions
        case .monitoring:
            monitoringActions
        case .abMcts:
            abMctsActions
        case .maltSwarm:
            maltSwarmActions
        case .parameters:
            parameterActions
        case .knowledge:
            knowledgeActions
        case .debugging:
            debuggingActions
        }
    }

    private var dashboardActions: some View {
        HStack(spacing: 8) {
            Button("Refresh") {
                // Refresh dashboard data
            }
            .buttonStyle(.bordered)

            Button("Export") {
                // Export dashboard data
            }
            .buttonStyle(.bordered)
        }
    }

    private var chatActions: some View {
        HStack(spacing: 8) {
            Button("New Chat") {
                appState.createNewChat()
            }
            .buttonStyle(.borderedProminent)

            Button("Clear") {
                // Clear current chat
            }
            .buttonStyle(.bordered)
        }
    }

    private var agentActions: some View {
        HStack(spacing: 8) {
            Button("Add Agent") {
                appState.showAgentSelector = true
            }
            .buttonStyle(.borderedProminent)

            Button("Monitor") {
                appState.showAgentMonitor = true
            }
            .buttonStyle(.bordered)
        }
    }

    private var mlxActions: some View {
        HStack(spacing: 8) {
            Button("New Model") {
                appState.showMLXInterface = true
            }
            .buttonStyle(.borderedProminent)

            Button("Models") {
                // Show model list
            }
            .buttonStyle(.bordered)
        }
    }

    private var visionActions: some View {
        HStack(spacing: 8) {
            Button("Process Image") {
                appState.showVisionInterface = true
            }
            .buttonStyle(.borderedProminent)

            Button("Gallery") {
                // Show image gallery
            }
            .buttonStyle(.bordered)
        }
    }

    private var monitoringActions: some View {
        HStack(spacing: 8) {
            Button("Refresh") {
                // Refresh metrics
            }
            .buttonStyle(.bordered)

            Button("Alerts") {
                // Show alerts
            }
            .buttonStyle(.bordered)
        }
    }

    private var abMctsActions: some View {
        HStack(spacing: 8) {
            Button("Start") {
                appState.showABMCTS = true
            }
            .buttonStyle(.borderedProminent)

            Button("Config") {
                // Show configuration
            }
            .buttonStyle(.bordered)
        }
    }

    private var maltSwarmActions: some View {
        HStack(spacing: 8) {
            Button("Deploy") {
                appState.showMALTSwarm = true
            }
            .buttonStyle(.borderedProminent)

            Button("Status") {
                // Show swarm status
            }
            .buttonStyle(.bordered)
        }
    }

    private var parameterActions: some View {
        HStack(spacing: 8) {
            Button("Optimize") {
                // Start optimization
            }
            .buttonStyle(.borderedProminent)

            Button("History") {
                // Show optimization history
            }
            .buttonStyle(.bordered)
        }
    }

    private var knowledgeActions: some View {
        HStack(spacing: 8) {
            Button("Add") {
                // Add knowledge
            }
            .buttonStyle(.borderedProminent)

            Button("Search") {
                // Search knowledge base
            }
            .buttonStyle(.bordered)
        }
    }

    private var debuggingActions: some View {
        HStack(spacing: 8) {
            Button("Patterns") {
                appState.selectedSidebarItem = .debugging
            }
            .buttonStyle(.bordered)

            Button("Resources") {
                appState.selectedSidebarItem = .debugging
            }
            .buttonStyle(.bordered)
        }
    }
}

#Preview {
    NativeControlBar(item: .dashboard)
        .environmentObject(AppState())
}
