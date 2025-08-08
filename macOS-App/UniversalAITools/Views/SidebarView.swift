import SwiftUI

struct SidebarView: View {
    @Binding var selection: SidebarItem?
    @EnvironmentObject var appState: AppState

    var body: some View {
        List(SidebarItem.allCases, id: \.self, selection: $selection) { item in
            SidebarItemView(item: item)
        }
        .listStyle(SidebarListStyle())
        .frame(minWidth: 200)
    }
}

struct SidebarItemView: View {
    let item: SidebarItem
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.accentColor)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 14, weight: .medium))

                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if let badge = badge {
                Text(badge)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(badgeColor)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 4)
    }

    private var subtitle: String? {
        switch item {
        case .dashboard:
            return appState.backendConnected ? "System Overview" : "Offline"
        case .chat:
            return "\(appState.chats.count) conversations"
        case .agents:
            return "\(appState.activeAgents.count) active"
        case .monitoring:
            return appState.systemMetrics != nil ? "Live" : "No data"
        default:
            return nil
        }
    }

    private var badge: String? {
        switch item {
        case .agents:
            let busyCount = appState.activeAgents.filter { $0.status == .busy }.count
            return busyCount > 0 ? "\(busyCount)" : nil
        case .monitoring:
            if let metrics = appState.systemMetrics, metrics.cpuUsage > 80 {
                return "High"
            }
            return nil
        default:
            return nil
        }
    }

    private var badgeColor: Color {
        switch item {
        case .agents:
            return .orange
        case .monitoring:
            return .red
        default:
            return .blue
        }
    }
}

#Preview {
    SidebarView(selection: .constant(.dashboard))
        .environmentObject(AppState())
}
