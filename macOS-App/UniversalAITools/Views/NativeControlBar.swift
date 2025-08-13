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
        case .chat:
            chatActions
        case .objectives:
            objectivesActions
        case .tools:
            toolsActions
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

    private var objectivesActions: some View {
        HStack(spacing: 8) {
            Button("Add Objective") {
                appState.openAgentSelectorWindow()
            }
            .buttonStyle(.borderedProminent)

            Button("View All") {
                appState.selectedSidebarItem = .objectives
            }
            .buttonStyle(.bordered)
        }
    }

    private var toolsActions: some View {
        HStack(spacing: 8) {
            Button("Tools Overview") {
                // Show tools overview
            }
            .buttonStyle(.borderedProminent)

            Button("Debug") {
                appState.selectedSidebarItem = .tools
                appState.selectedTool = .debugging
            }
            .buttonStyle(.bordered)
        }
    }

}

#Preview {
    NativeControlBar(item: .chat)
        .environmentObject(AppState())
}
