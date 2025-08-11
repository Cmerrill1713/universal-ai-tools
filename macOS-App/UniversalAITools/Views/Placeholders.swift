import SwiftUI

struct SystemMonitoringPlaceholderView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("System Monitoring")
                    .font(.title2)
                    .fontWeight(.bold)
                Spacer()
                Button("Refresh") {
                    // Hook into metrics refresh when backend is ready
                }
                .buttonStyle(.bordered)
            }
            .padding(.horizontal)

            if let metrics = appState.systemMetrics {
                VStack(spacing: 8) {
                    HStack {
                        Text("CPU Usage")
                        Spacer()
                        Text("\(Int(metrics.cpuUsage))%")
                    }
                    HStack {
                        Text("Memory Usage")
                        Spacer()
                        Text("\(Int(metrics.memoryUsage))%")
                    }
                    HStack {
                        Text("Requests/min")
                        Spacer()
                        Text("\(metrics.requestsPerMinute)")
                    }
                    HStack {
                        Text("Active Connections")
                        Spacer()
                        Text("\(metrics.activeConnections)")
                    }
                }
                .padding()
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(8)
                .padding(.horizontal)
            } else {
                if #available(macOS 14.0, *) {
                    ContentUnavailableView(
                        "No metrics yet",
                        systemImage: "chart.xyaxis.line",
                        description: Text("Connect backend to view live system metrics.")
                    )
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "chart.xyaxis.line")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No metrics yet").font(.headline)
                        Text("Connect backend to view live system metrics.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }

            Spacer()
        }
    }
}

struct ABMCTSOrchestrationView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 12) {
            Text("AB-MCTS Orchestration")
                .font(.title2)
                .fontWeight(.bold)
            Text("Controller UI placeholder. Start/stop, config, and progress will appear here.")
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding()
    }
}

struct MALTSwarmControlView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 12) {
            Text("MALT Swarm Control")
                .font(.title2)
                .fontWeight(.bold)
            Text("Deployment and status controls will appear here.")
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding()
    }
}

struct IntelligentParametersView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 12) {
            Text("Intelligent Parameters")
                .font(.title2)
                .fontWeight(.bold)
            Text("Optimize and track parameter tuning runs.")
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding()
    }
}

struct KnowledgeBaseView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var mcpService: MCPService
    @State private var query: String = ""
    @State private var results: [[String: Any]] = []
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    // Filters & pagination
    @State private var selectedCategoryFilter: String = ""
    @State private var fetchLimit: Int = 25
    private let categoryOptions: [String] = [
        "", "knowledge", "debug_logs", "project_overview", "code_patterns", "error_analysis"
    ]

    // Save new note
    @State private var newNoteText: String = ""
    @State private var newNoteCategory: String = "knowledge"

    var body: some View {
        VStack(spacing: 12) {
            header
            controls

            if let errorMessage {
                Text(errorMessage)
                    .foregroundColor(.red)
                    .font(.caption)
            }

            if isLoading {
                ProgressView().padding(.top, 8)
            }

            resultsList

            HStack {
                Button("Load More") { Task { await loadMore() } }
                    .disabled(isLoading)
                Spacer()
            }

            Divider().padding(.vertical, 4)

            saveNotePanel
        }
        .padding()
    }

    private var header: some View {
        HStack {
            Text("Knowledge Base")
                .font(.title2)
                .fontWeight(.bold)
            Spacer()
            if mcpService.isConnected {
                Text("MCP Connected")
                    .font(.caption)
                    .foregroundColor(.green)
            } else {
                Text("MCP Disconnected")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var controls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                TextField("Search via MCP", text: $query)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .onSubmit { Task { await runSearch(resetLimit: true) } }

                Picker("Category", selection: $selectedCategoryFilter) {
                    ForEach(categoryOptions, id: \.self) { value in
                        Text(value.isEmpty ? "All Categories" : value).tag(value)
                    }
                }
                .frame(width: 180)

                Button("Search") { Task { await runSearch(resetLimit: true) } }
                    .disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                Button("Recent") { Task { await loadRecent(resetLimit: true) } }
                    .disabled(isLoading)
                Spacer()
            }
        }
    }

    private var resultsList: some View {
        List {
            ForEach(Array(results.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 4) {
                    Text((item["content"] as? String) ?? "<no content>")
                        .font(.subheadline)
                    HStack(spacing: 8) {
                        if let category = item["category"] as? String { TagView(text: category) }
                        if let createdAt = item["created_at"] as? String { TagView(text: createdAt) }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private var saveNotePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Save Note to MCP")
                .font(.headline)
            HStack(spacing: 8) {
                Picker("Category", selection: $newNoteCategory) {
                    ForEach(categoryOptions.filter { !$0.isEmpty }, id: \.self) { value in
                        Text(value).tag(value)
                    }
                }
                .frame(width: 180)
                Spacer()
            }
            TextEditor(text: $newNoteText)
                .frame(minHeight: 80)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                )
            HStack {
                Button("Save to MCP") { Task { await saveNote() } }
                    .disabled(newNoteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                Spacer()
            }
        }
    }

    private func runSearch(resetLimit: Bool) async {
        if resetLimit { fetchLimit = 25 }
        isLoading = true
        errorMessage = nil
        do {
            let category: String? = selectedCategoryFilter.isEmpty ? nil : selectedCategoryFilter
            let data = try await mcpService.searchContext(query: query, category: category, limit: fetchLimit)
            results = data
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadRecent(resetLimit: Bool) async {
        if resetLimit { fetchLimit = 25 }
        isLoading = true
        errorMessage = nil
        do {
            let category: String? = selectedCategoryFilter.isEmpty ? nil : selectedCategoryFilter
            let data = try await mcpService.getRecentContext(category: category, limit: fetchLimit)
            results = data
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func loadMore() async {
        fetchLimit += 25
        if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            await loadRecent(resetLimit: false)
        } else {
            await runSearch(resetLimit: false)
        }
    }

    private func saveNote() async {
        isLoading = true
        errorMessage = nil
        do {
            try await mcpService.saveContext(
                content: newNoteText,
                category: newNoteCategory,
                metadata: ["source": "macOS-app", "timestamp": Date().timeIntervalSince1970]
            )
            newNoteText = ""
            await loadRecent(resetLimit: true)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct TagView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.secondary.opacity(0.15))
            .cornerRadius(4)
    }
}

#Preview {
    Group {
        SystemMonitoringPlaceholderView()
        ABMCTSOrchestrationView()
        MALTSwarmControlView()
        IntelligentParametersView()
        KnowledgeBaseView()
    }
    .environmentObject(AppState())
    .environmentObject(APIService())
    .environmentObject(MCPService())
}

