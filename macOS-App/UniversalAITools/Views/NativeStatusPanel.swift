import Foundation
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
        case .chat:
            chatStatus
        case .objectives:
            objectivesStatus
        case .tools:
            toolsStatus
        case .knowledge:
            knowledgeStatus
        }
    }

    private var toolsStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Active Tools:")
                Spacer()
                Text("\(ToolCategory.allCases.count)")
            }

            HStack {
                Text("Performance:")
                Spacer()
                Text("Good")
                    .foregroundColor(.green)
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

    private var objectivesStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Active Objectives:")
                Spacer()
                Text("\(appState.activeObjectives.count)")
            }

            let activeCount = appState.activeObjectives.filter { $0.status == .active }.count
            if activeCount > 0 {
                HStack {
                    Text("In Progress:")
                    Spacer()
                    Text("\(activeCount)")
                        .foregroundColor(.orange)
                }
            }

            let completedCount = appState.activeObjectives.filter { $0.status == .completed }.count
            if completedCount > 0 {
                HStack {
                    Text("Completed:")
                    Spacer()
                    Text("\(completedCount)")
                        .foregroundColor(.green)
                }
            }
        }
    }
    
    private var knowledgeStatus: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Graph Nodes:")
                Spacer()
                Text("Loading...")
                    .foregroundColor(.secondary)
            }

            HStack {
                Text("Connections:")
                Spacer()
                Text("0")
            }
            
            HStack {
                Text("Status:")
                Spacer()
                Text("Ready")
                    .foregroundColor(.green)
            }
        }
    }

    private var hasProgress: Bool {
        switch item {
        case .tools:
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
    NativeStatusPanel(item: .chat)
        .environmentObject(AppState())
}
