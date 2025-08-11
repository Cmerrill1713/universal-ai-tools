import SwiftUI

struct AgentsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @State private var selectedCategory = "All"
    @State private var searchText = ""
    @State private var showingCreateAgent = false

    private let categories = ["All", "Research", "Memory", "Orchestration", "Specialized"]

    private var filteredAgents: [Agent] {
        let categoryFiltered = selectedCategory == "All" ? appState.availableAgents : appState.availableAgents.filter { $0.type == selectedCategory }

        if searchText.isEmpty {
            return categoryFiltered
        } else {
            return categoryFiltered.filter { $0.name.localizedCaseInsensitiveContains(searchText) || $0.description.localizedCaseInsensitiveContains(searchText) }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            agentsHeader

            Divider()

            // Filters and Search
            filtersAndSearch

            Divider()

            // Agents Grid
            ScrollView {
                LazyVGrid(columns: gridColumns, spacing: 20) {
                    ForEach(filteredAgents) { agent in
                        AgentCard(agent: agent)
                            .environmentObject(appState)
                            .environmentObject(apiService)
                    }
                }
                .padding()
            }
        }
        .background(Color(.windowBackgroundColor))
        .sheet(isPresented: $showingCreateAgent) {
            CreateAgentView()
                .environmentObject(appState)
                .environmentObject(apiService)
        }
    }

    private var agentsHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("AI Agents")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Manage and monitor your AI agents")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: { showingCreateAgent = true }) {
                HStack(spacing: 8) {
                    Image(systemName: "plus.circle.fill")
                    Text("Create Agent")
                        .fontWeight(.medium)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.accentColor)
                )
                .foregroundColor(.white)
            }
            .buttonStyle(.plain)
        }
        .padding()
    }

    private var filtersAndSearch: some View {
        VStack(spacing: 16) {
            // Category Picker
            HStack {
                Text("Category:")
                    .font(.subheadline)
                    .fontWeight(.medium)

                Picker("Category", selection: $selectedCategory) {
                    ForEach(categories, id: \.self) { category in
                        Text(category).tag(category)
                    }
                }
                .pickerStyle(.segmented)

                Spacer()
            }

            // Search Bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)

                TextField("Search agents...", text: $searchText)
                    .textFieldStyle(.plain)

                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.controlBackgroundColor))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(.separatorColor), lineWidth: 1)
            )
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private var gridColumns: [GridItem] {
        [
            GridItem(.adaptive(minimum: 280, maximum: 320), spacing: 20)
        ]
    }
}

// MARK: - Agent Card
struct AgentCard: View {
    let agent: Agent
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @State private var showingDetails = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(agent.name)
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text(agent.type)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(Color(.controlBackgroundColor))
                        )
                }

                Spacer()

                // Status Indicator
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)
            }

            // Description
            Text(agent.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(3)

            // Capabilities
            if !agent.capabilities.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Capabilities:")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)

                    LazyVGrid(columns: capabilityColumns, spacing: 4) {
                        ForEach(agent.capabilities.prefix(6), id: \.self) { capability in
                            Text(capability)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.accentColor.opacity(0.1))
                                )
                                .foregroundColor(.accentColor)
                        }
                    }
                }
            }

            // Actions
            HStack(spacing: 12) {
                Button(action: { activateAgent() }) {
                    HStack(spacing: 6) {
                        Image(systemName: "play.circle.fill")
                        Text("Activate")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.green)
                    )
                    .foregroundColor(.white)
                }
                .buttonStyle(.plain)

                Button(action: { showingDetails = true }) {
                    HStack(spacing: 6) {
                        Image(systemName: "info.circle")
                        Text("Details")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color(.controlBackgroundColor))
                    )
                    .foregroundColor(.primary)
                }
                .buttonStyle(.plain)

                Spacer()
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.separatorColor), lineWidth: 1)
        )
        .sheet(isPresented: $showingDetails) {
            AgentDetailView(agent: agent)
                .environmentObject(appState)
                .environmentObject(apiService)
        }
    }

    private var statusColor: Color {
        switch agent.status {
        case .active: return .green
        case .busy: return .orange
        case .error: return .red
        case .inactive: return .gray
        }
    }

    private var capabilityColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 60, maximum: 80))]
    }

    private func activateAgent() {
        // Simulate agent activation
        appState.activateAgent(agent)
    }
}

// MARK: - Create Agent View
struct CreateAgentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss

    @State private var agentName = ""
    @State private var agentDescription = ""
    @State private var selectedCategory = "Cognitive"
    @State private var capabilities: [String] = [""]

    private let categories = ["Cognitive", "Personal", "Specialized", "System"]

    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Form {
                    Section("Agent Details") {
                        TextField("Agent Name", text: $agentName)
                        TextField("Description", text: $agentDescription, axis: .vertical)
                            .lineLimit(3...6)

                        Picker("Category", selection: $selectedCategory) {
                            ForEach(categories, id: \.self) { category in
                                Text(category).tag(category)
                            }
                        }
                    }

                    Section("Capabilities") {
                        ForEach(capabilities.indices, id: \.self) { index in
                            HStack {
                                TextField("Capability", text: $capabilities[index])

                                if capabilities.count > 1 {
                                    Button(action: { removeCapability(at: index) }) {
                                        Image(systemName: "minus.circle.fill")
                                            .foregroundColor(.red)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        Button("Add Capability") {
                            capabilities.append("")
                        }
                    }
                }

                HStack {
                    Button("Cancel") { dismiss() }
                        .keyboardShortcut(.escape)

                    Spacer()

                    Button("Create Agent") {
                        createAgent()
                    }
                    .disabled(agentName.isEmpty || agentDescription.isEmpty)
                    .keyboardShortcut(.return)
                }
                .padding()
            }
            .navigationTitle("Create New Agent")
            // .navigationBarTitleDisplayMode(.inline) // unavailable on macOS
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .frame(width: 500, height: 600)
    }

    private func removeCapability(at index: Int) {
        capabilities.remove(at: index)
    }

    private func createAgent() {
        let newAgent = Agent(
            id: UUID().uuidString,
            name: agentName,
            type: selectedCategory,
            description: agentDescription,
            capabilities: capabilities.filter { !$0.isEmpty },
            status: .inactive
        )

        appState.availableAgents.append(newAgent)
        dismiss()
    }
}

// MARK: - Agent Detail View
struct AgentDetailView: View {
    let agent: Agent
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Basic Info
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Basic Information")
                            .font(.headline)
                            .fontWeight(.semibold)

                        InfoRow(label: "Name", value: agent.name)
                        InfoRow(label: "Category", value: agent.type)
                        InfoRow(label: "Status", value: agent.status.rawValue.capitalized)
                        InfoRow(label: "Description", value: agent.description)
                    }

                    Divider()

                    // Capabilities
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Capabilities")
                            .font(.headline)
                            .fontWeight(.semibold)

                        LazyVGrid(columns: capabilityColumns, spacing: 8) {
                            ForEach(agent.capabilities, id: \.self) { capability in
                                Text(capability)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(
                                        RoundedRectangle(cornerRadius: 6)
                                            .fill(Color.accentColor.opacity(0.1))
                                    )
                                    .foregroundColor(.accentColor)
                            }
                        }
                    }

                    Divider()

                    // Actions
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Actions")
                            .font(.headline)
                            .fontWeight(.semibold)

                        HStack(spacing: 12) {
                            Button("Activate") {
                                appState.activateAgent(agent)
                            }
                            .buttonStyle(.borderedProminent)

                            Button("Deactivate") {
                                appState.deactivateAgent(agent)
                            }
                            .buttonStyle(.bordered)

                            Button("Delete") {
                                appState.removeAgent(agent)
                                dismiss()
                            }
                            .buttonStyle(.bordered)
                            .foregroundColor(.red)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle(agent.name)
            // .navigationBarTitleDisplayMode(.inline) // unavailable on macOS
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .frame(width: 600, height: 500)
    }

    private var capabilityColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 100, maximum: 150))]
    }
}

// MARK: - Info Row
struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
                .frame(width: 80, alignment: .leading)

            Text(value)
                .font(.subheadline)
                .foregroundColor(.primary)

            Spacer()
        }
    }
}

#Preview {
    AgentsView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
