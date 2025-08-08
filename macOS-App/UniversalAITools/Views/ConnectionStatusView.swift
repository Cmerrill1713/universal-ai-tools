import SwiftUI

struct ConnectionStatusView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

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

            // Reconnect button if disconnected
            if !appState.backendConnected {
                Button("Reconnect") {
                    Task {
                        await apiService.connectToBackend()
                    }
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
