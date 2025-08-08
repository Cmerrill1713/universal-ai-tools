import SwiftUI

struct AgentManagementView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var searchText = ""
    @State private var selectedAgentType: String = "All"
    @State private var showAddAgent = false

    private let agentTypes = ["All", "Cognitive", "Memory", "Orchestration", "Specialized"]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerSection

            Divider()

            // Filters
            filterSection

            Divider()

            // Agent List
            agentListSection
        }
    }

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Agent Management")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("\(appState.activeAgents.count) active agents")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button("Add Agent") {
                showAddAgent = true
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private var filterSection: some View {
        HStack(spacing: 16) {
            // Search
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search agents...", text: $searchText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            .frame(width: 200)

            // Type filter
            Picker("Type", selection: $selectedAgentType) {
                ForEach(agentTypes, id: \.self) { type in
                    Text(type).tag(type)
                }
            }
            .pickerStyle(MenuPickerStyle())

            Spacer()

            // Status filter
            HStack(spacing: 8) {
                StatusFilterButton(title: "All", count: appState.activeAgents.count, isSelected: true)
                StatusFilterButton(title: "Active", count: activeCount, isSelected: false)
                StatusFilterButton(title: "Busy", count: busyCount, isSelected: false)
                StatusFilterButton(title: "Error", count: errorCount, isSelected: false)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private var agentListSection: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredAgents) { agent in
                    AgentCard(agent: agent)
                }
            }
            .padding()
        }
    }

    private var filteredAgents: [Agent] {
        var agents = appState.activeAgents

        // Filter by search text
        if !searchText.isEmpty {
            agents = agents.filter { agent in
                agent.name.localizedCaseInsensitiveContains(searchText) ||
                agent.type.localizedCaseInsensitiveContains(searchText) ||
                agent.description.localizedCaseInsensitiveContains(searchText)
            }
        }

        // Filter by type
        if selectedAgentType != "All" {
            agents = agents.filter { $0.type == selectedAgentType }
        }

        return agents
    }

    private var activeCount: Int {
        appState.activeAgents.filter { $0.status == .active }.count
    }

    private var busyCount: Int {
        appState.activeAgents.filter { $0.status == .busy }.count
    }

    private var errorCount: Int {
        appState.activeAgents.filter { $0.status == .error }.count
    }
}

struct StatusFilterButton: View {
    let title: String
    let count: Int
    let isSelected: Bool

    var body: some View {
        Button(action: {}) {
            HStack(spacing: 4) {
                Text(title)
                Text("(\(count))")
                    .foregroundColor(.secondary)
            }
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(isSelected ? Color.accentColor : Color.clear)
            .foregroundColor(isSelected ? .white : .primary)
            .cornerRadius(6)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct AgentCard: View {
    let agent: Agent
    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            // Main content
            HStack(spacing: 12) {
                // Status indicator
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)

                // Agent icon
                Image(systemName: agentIcon)
                    .font(.title2)
                    .foregroundColor(.accentColor)
                    .frame(width: 40)

                // Agent info
                VStack(alignment: .leading, spacing: 4) {
                    Text(agent.name)
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text(agent.type)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    if isExpanded {
                        Text(agent.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

                // Actions
                HStack(spacing: 8) {
                    Button(action: { isExpanded.toggle() }) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.caption)
                    }
                    .buttonStyle(.borderless)

                    Button(action: {}) {
                        Image(systemName: "ellipsis")
                            .font(.caption)
                    }
                    .buttonStyle(.borderless)
                }
            }
            .padding()

            // Expanded content
            if isExpanded {
                VStack(spacing: 12) {
                    Divider()

                    // Capabilities
                    if !agent.capabilities.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Capabilities")
                                .font(.subheadline)
                                .fontWeight(.medium)

                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ], spacing: 4) {
                                ForEach(agent.capabilities, id: \.self) { capability in
                                    Text(capability)
                                        .font(.caption)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.accentColor.opacity(0.1))
                                        .cornerRadius(4)
                                }
                            }
                        }
                    }

                    // Actions
                    HStack(spacing: 8) {
                        Button("Start") {
                            // Start agent
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(agent.status == .active)

                        Button("Stop") {
                            // Stop agent
                        }
                        .buttonStyle(.bordered)
                        .disabled(agent.status == .inactive)

                        Button("Configure") {
                            // Configure agent
                        }
                        .buttonStyle(.bordered)

                        Spacer()

                        Button("Remove") {
                            // Remove agent
                        }
                        .buttonStyle(.bordered)
                        .foregroundColor(.red)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    private var statusColor: Color {
        switch agent.status {
        case .active: return .green
        case .busy: return .orange
        case .error: return .red
        case .inactive: return .gray
        }
    }

    private var agentIcon: String {
        switch agent.type {
        case "Cognitive": return "brain"
        case "Memory": return "memorychip"
        case "Orchestration": return "network"
        case "Specialized": return "star"
        default: return "person.3"
        }
    }
}

#Preview {
    AgentManagementView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
