import SwiftUI

struct StatusOverlayView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    var body: some View {
        VStack(spacing: 8) {
            if appState.showNotification {
                NotificationBanner()
                    .transition(
                        .move(edge: .bottom).combined(with: .opacity)
                    )
                    .animation(.spring(), value: appState.showNotification)
            }

            if !appState.backendConnected {
                offlineBanner
                    .transition(
                        .move(edge: .bottom).combined(with: .opacity)
                    )
            }
        }
    }

    private var offlineBanner: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "wifi.exclamationmark")
                Text("Offline. Unable to reach backend.")
            }
            .font(.subheadline)

            HStack(spacing: 12) {
                Button("Retry") {
                    Task { await apiService.connectToBackend() }
                }
                .buttonStyle(.borderedProminent)

                Button("Settings") { appState.showSettings = true }
                .buttonStyle(.bordered)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(.thinMaterial)
        .cornerRadius(10)
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
    }
}

#Preview {
    StatusOverlayView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
