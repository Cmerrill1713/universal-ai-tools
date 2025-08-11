import SwiftUI

struct NotificationBanner: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Image(systemName: appState.notificationType.icon)
                .foregroundColor(appState.notificationType.color)
                .font(.title3)

            // Message
            Text(appState.notificationMessage)
                .font(.subheadline)
                .foregroundColor(.primary)

            Spacer()

            // Close button
            Button("×") {
                withAnimation(.spring()) {
                    appState.showNotification = false
                }
            }
            .buttonStyle(.borderless)
            .font(.title2)
            .foregroundColor(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(AppTheme.separator, lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.08), radius: 6, x: 0, y: 3)
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }
}

#Preview {
    NotificationBanner()
        .environmentObject(AppState())
}
