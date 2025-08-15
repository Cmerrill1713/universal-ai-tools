import SwiftUI

struct ConnectionStatusView: View {
  @EnvironmentObject var appState: AppState
  @EnvironmentObject var apiService: APIService
  @EnvironmentObject var mcpService: MCPService

  var body: some View {
    HStack(spacing: 8) {
      // Styled connection indicator
      ZStack {
        Circle()
          .fill(Color.white.opacity(0.1))
          .frame(width: 12, height: 12)
          .overlay(
            Circle()
              .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
          )
        
        Circle()
          .fill(connectionColor)
          .frame(width: 6, height: 6)
          .shadow(color: connectionColor.opacity(0.6), radius: 1)
      }

      // Status text
      Text(connectionText)
        .font(.caption)
        .foregroundColor(.secondary)

      Divider().frame(height: 10)

      // Styled MCP connection indicator
      ZStack {
        Circle()
          .fill(Color.white.opacity(0.1))
          .frame(width: 12, height: 12)
          .overlay(
            Circle()
              .stroke(Color.white.opacity(0.2), lineWidth: 0.5)
          )
        
        Circle()
          .fill(mcpService.isConnected ? connectionColor : Color.orange.opacity(0.8))
          .frame(width: 6, height: 6)
          .shadow(color: (mcpService.isConnected ? connectionColor : Color.orange.opacity(0.8)).opacity(0.6), radius: 1)
      }
      Text(mcpService.isConnected ? "MCP" : "MCP Off")
        .font(.caption)
        .foregroundColor(.secondary)
      if !mcpService.isConnected {
        Button("Connect MCP") {
          Task {
            await mcpService.connect()
          }
        }
        .buttonStyle(.borderless)
        .font(.caption)
      }

      // Live metrics strip (compact)
      if let metrics = appState.systemMetrics {
        Divider().frame(height: 10)
        HStack(spacing: 6) {
          Label("\(Int(metrics.cpuUsage))%", systemImage: "gauge.high")
          Label("\(metrics.requestsPerMinute)", systemImage: "bolt.fill")
        }
        .labelStyle(.iconOnly)
        .font(.caption2)
        .foregroundColor(.secondary)
        .overlay(
          HStack(spacing: 8) {
            HStack(spacing: 4) {
              Image(systemName: "gauge.high")
              Text("\(Int(metrics.cpuUsage))%")
            }
            HStack(spacing: 4) {
              Image(systemName: "bolt.fill")
              Text("\(metrics.requestsPerMinute)")
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
