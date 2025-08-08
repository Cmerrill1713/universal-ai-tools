import SwiftUI

struct NativeStatusPanel: View {
    let item: SidebarItem
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Text("Status")
                    .font(.headline)
                Spacer()
                Button("Details") {
                    // Show detailed status
                }
                .buttonStyle(.borderless)
                .font(.caption)
            }

            // Status content based on section
            statusContent

            // Progress indicators
            if hasProgress {
                progressSection
            }
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
    }

    @ViewBuilder
    private var statusContent: some View {
        switch item {
        case .dashboard:
            dashboardStatus
        case .chat:
            chatStatus
        case .agents:
            agentStatus
        case .mlx:
            mlxStatus
        case .vision:
            visionStatus
        case .monitoring:
            monitoringStatus
        case .abMcts:
            abMctsStatus
        case .maltSwarm:
            maltSwarmStatus
        case .parameters:
            parameterStatus
        case .knowledge:
            knowledgeStatus
        }
    }

    private var dashboardStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("System Health:")
                Spacer()
                Text(appState.backendConnected ? "Good" : "Poor")
                    .foregroundColor(appState.backendConnected ? .green : .red)
            }

            if let metrics = appState.systemMetrics {
                HStack {
                    Text("CPU:")
                    Spacer()
                    Text("\(Int(metrics.cpuUsage))%")
                        .foregroundColor(metrics.cpuUsage > 80 ? .red : .green)
                }

                HStack {
                    Text("Memory:")
                    Spacer()
                    Text("\(Int(metrics.memoryUsage))%")
                        .foregroundColor(metrics.memoryUsage > 80 ? .red : .green)
                }
            }
        }
    }

    private var chatStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Active Chats:")
                Spacer()
                Text("\(appState.chats.count)")
            }

            if let currentChat = appState.currentChat {
                HStack {
                    Text("Current:")
                    Spacer()
                    Text(currentChat.title)
                        .lineLimit(1)
                }

                HStack {
                    Text("Messages:")
                    Spacer()
                    Text("\(currentChat.messages.count)")
                }
            }
        }
    }

    private var agentStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Active Agents:")
                Spacer()
                Text("\(appState.activeAgents.count)")
            }

            let busyCount = appState.activeAgents.filter { $0.status == .busy }.count
            if busyCount > 0 {
                HStack {
                    Text("Busy:")
                    Spacer()
                    Text("\(busyCount)")
                        .foregroundColor(.orange)
                }
            }

            let errorCount = appState.activeAgents.filter { $0.status == .error }.count
            if errorCount > 0 {
                HStack {
                    Text("Errors:")
                    Spacer()
                    Text("\(errorCount)")
                        .foregroundColor(.red)
                }
            }
        }
    }

    private var mlxStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("MLX Status:")
                Spacer()
                Text("Ready")
                    .foregroundColor(.green)
            }

            HStack {
                Text("Models:")
                Spacer()
                Text("3 Available")
            }

            HStack {
                Text("Training:")
                Spacer()
                Text("Idle")
                    .foregroundColor(.secondary)
            }
        }
    }

    private var visionStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Vision Status:")
                Spacer()
                Text("Ready")
                    .foregroundColor(.green)
            }

            HStack {
                Text("Models:")
                Spacer()
                Text("2 Loaded")
            }

            HStack {
                Text("Processing:")
                Spacer()
                Text("Idle")
                    .foregroundColor(.secondary)
            }
        }
    }

    private var monitoringStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Monitoring:")
                Spacer()
                Text("Active")
                    .foregroundColor(.green)
            }

            if let metrics = appState.systemMetrics {
                HStack {
                    Text("Requests/min:")
                    Spacer()
                    Text("\(metrics.requestsPerMinute)")
                }

                HStack {
                    Text("Connections:")
                    Spacer()
                    Text("\(metrics.activeConnections)")
                }
            }
        }
    }

    private var abMctsStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("AB-MCTS:")
                Spacer()
                Text("Stopped")
                    .foregroundColor(.secondary)
            }

            HStack {
                Text("Nodes:")
                Spacer()
                Text("0")
            }

            HStack {
                Text("Iterations:")
                Spacer()
                Text("0")
            }
        }
    }

    private var maltSwarmStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("MALT Swarm:")
                Spacer()
                Text("Stopped")
                    .foregroundColor(.secondary)
            }

            HStack {
                Text("Nodes:")
                Spacer()
                Text("0")
            }

            HStack {
                Text("Status:")
                Spacer()
                Text("Inactive")
            }
        }
    }

    private var parameterStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Optimization:")
                Spacer()
                Text("Idle")
                    .foregroundColor(.secondary)
            }

            HStack {
                Text("Parameters:")
                Spacer()
                Text("12 Configured")
            }

            HStack {
                Text("History:")
                Spacer()
                Text("5 Runs")
            }
        }
    }

    private var knowledgeStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Knowledge Base:")
                Spacer()
                Text("Ready")
                    .foregroundColor(.green)
            }

            HStack {
                Text("Entries:")
                Spacer()
                Text("1,247")
            }

            HStack {
                Text("Index:")
                Spacer()
                Text("Up to date")
                    .foregroundColor(.green)
            }
        }
    }

    private var hasProgress: Bool {
        switch item {
        case .mlx, .vision, .abMcts, .maltSwarm, .parameters:
            return true
        default:
            return false
        }
    }

    private var progressSection: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Progress")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
            }

            ProgressView(value: 0.0)
                .progressViewStyle(LinearProgressViewStyle())
                .scaleEffect(x: 1, y: 0.5, anchor: .center)
        }
    }
}

#Preview {
    NativeStatusPanel(item: .dashboard)
        .environmentObject(AppState())
}
