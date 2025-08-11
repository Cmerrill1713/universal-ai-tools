import SwiftUI

struct ConnectionStatusView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @EnvironmentObject var mcpService: MCPService

    var body: some View {
        HStack(spacing: 8) {
            // Connection indicator
            Circle()
                .fill(connectionColor)
                .frame(width: 8, height: 8)

            // Status text
            Text(connectionText)
                .font(.caption)
                .foregroundColor(.secondary)

            Divider().frame(height: 10)

            Circle()
                .fill(mcpService.isConnected ? .green : .red)
                .frame(width: 8, height: 8)
            Text(mcpService.isConnected ? "MCP" : "MCP Off")
                .font(.caption)
                .foregroundColor(.secondary)
            if !mcpService.isConnected {
                Button("Connect MCP") {
                    Task {
                        do { try await mcpService.connectToServer() }
                        catch { appState.showNotification(message: "MCP connect failed", type: .error) }
                    }
                }
                .buttonStyle(.borderless)
                .font(.caption)
            }

            // Live metrics strip (compact)
            if let m = appState.systemMetrics {
                Divider().frame(height: 10)
                HStack(spacing: 6) {
                    Label("\(Int(m.cpuUsage))%", systemImage: "gauge.high")
                    Label("\(m.requestsPerMinute)", systemImage: "bolt.fill")
                }
                .labelStyle(.iconOnly)
                .font(.caption2)
                .foregroundColor(.secondary)
                .overlay(
                    HStack(spacing: 8) {
                        HStack(spacing: 4) {
                            Image(systemName: "gauge.high")
                            Text("\(Int(m.cpuUsage))%")
                        }
                        HStack(spacing: 4) {
                            Image(systemName: "bolt.fill")
                            Text("\(m.requestsPerMinute)")
                        }
                    }
                    .font(.caption2)
                    .foregroundColor(.secondary)
                )
            }

            // Reconnect button if disconnected
            if !appState.backendConnected {
                Button("Reconnect") {
                    Task { await apiService.connectToBackend() }
                }
                .buttonStyle(.borderless)
                .font(.caption)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(6)
    }

    private var connectionColor: Color {
        if appState.backendConnected && appState.websocketConnected {
            return .green
        } else if appState.backendConnected {
            return .orange
        } else {
            return .red
        }
    }

    private var connectionText: String {
        if appState.backendConnected && appState.websocketConnected {
            return "Connected"
        } else if appState.backendConnected {
            return "Partial"
        } else {
            return "Disconnected"
        }
    }
}

#Preview {
    ConnectionStatusView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
