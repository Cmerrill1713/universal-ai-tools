import SwiftUI

struct AgentSelectorView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss

    @State private var searchText = ""

    var filteredAgents: [Agent] {
        if searchText.isEmpty { return appState.availableAgents }
        return appState.availableAgents.filter { agent in
            agent.name.localizedCaseInsensitiveContains(searchText) ||
            agent.type.localizedCaseInsensitiveContains(searchText) ||
            agent.description.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Select Agent")
                    .font(.headline)
                Spacer()
                Button("Close") { dismiss() }
                    .buttonStyle(.borderless)
            }

            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search agents", text: $searchText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
            }

            List(filteredAgents) { agent in
                HStack(spacing: 8) {
                    Image(systemName: "cpu")
                        .foregroundColor(.accentColor)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(agent.name)
                            .font(.subheadline)
                        Text(agent.type)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Button("Activate") {
                        // Placeholder: mark as active
                        if !appState.activeAgents.contains(where: { $0.id == agent.id }) {
                            var a = agent
                            a.status = .active
                            appState.activeAgents.append(a)
                        }
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                }
            }
            .frame(height: 260)

            HStack {
                Spacer()
                Button("Done") { dismiss() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(width: 500, height: 360)
    }
}

#Preview {
    AgentSelectorView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}


