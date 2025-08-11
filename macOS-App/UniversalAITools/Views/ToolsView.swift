import SwiftUI

struct ToolsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @State private var selectedCategory = "All"
    @State private var searchText = ""
    @State private var showingToolDetails = false
    @State private var selectedTool: AITool?

    private let categories = ["All", "Text", "Image", "Code", "Data", "Analysis"]

    private var filteredTools: [AITool] {
        let categoryFiltered = selectedCategory == "All" ? appState.availableTools : appState.availableTools.filter { $0.category == selectedCategory }

        if searchText.isEmpty {
            return categoryFiltered
        } else {
            return categoryFiltered.filter { $0.name.localizedCaseInsensitiveContains(searchText) || $0.description.localizedCaseInsensitiveContains(searchText) }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            toolsHeader

            Divider()

            // Filters and Search
            filtersAndSearch

            Divider()

            // Tools Grid
            ScrollView {
                LazyVGrid(columns: gridColumns, spacing: 20) {
                    ForEach(filteredTools) { tool in
                        ToolCard(tool: tool) {
                            selectedTool = tool
                            showingToolDetails = true
                        }
                    }
                }
                .padding()
            }
        }
        .background(Color(.windowBackgroundColor))
        .sheet(isPresented: $showingToolDetails) {
            if let tool = selectedTool {
                ToolDetailView(tool: tool)
                    .environmentObject(appState)
                    .environmentObject(apiService)
            }
        }
    }

    private var toolsHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("AI Tools")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Powerful tools and utilities powered by AI")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Quick Stats
            HStack(spacing: 20) {
                StatItem(
                    icon: "checkmark.circle.fill",
                    value: "\(appState.availableTools.count)",
                    label: "Available",
                    color: .green
                )

                StatItem(
                    icon: "clock.fill",
                    value: "\(appState.recentToolUsage.count)",
                    label: "Recent",
                    color: .blue
                )
            }
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

                TextField("Search tools...", text: $searchText)
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
            GridItem(.adaptive(minimum: 300, maximum: 350), spacing: 20)
        ]
    }
}

// MARK: - Tool Card
struct ToolCard: View {
    let tool: AITool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 16) {
                // Header
                HStack {
                    Image(systemName: "wand.and.stars")
                        .font(.title2)
                        .foregroundColor(.accentColor)
                        .frame(width: 30)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(tool.name)
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)

                        Text(tool.category)
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
                    if tool.status == .available {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 8, height: 8)
                    }
                }

                // Description
                Text(tool.description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                // Features removed (not present on AITool model)

                // Usage Stats
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .font(.caption2)
                        Text("\(tool.usageCount) uses")
                            .font(.caption2)
                    }
                    .foregroundColor(.secondary)

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
        }
        .buttonStyle(.plain)
    }

    private var featureColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 70, maximum: 90))]
    }
}

// MARK: - Stat Item
struct StatItem: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)

            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.headline)
                    .fontWeight(.semibold)

                Text(label)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Tool Detail View
struct ToolDetailView: View {
    let tool: AITool
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss
    @State private var inputText = ""
    @State private var isProcessing = false
    @State private var result = ""

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(tool.name)
                            .font(.title2)
                            .fontWeight(.semibold)

                        Text(tool.description)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Button("Done") { dismiss() }
                        .keyboardShortcut(.escape)
                }
                .padding()
                .background(Color(.controlBackgroundColor))

                Divider()

                // Content
                ScrollView {
                    VStack(spacing: 20) {
                        // Tool Info
                        toolInfoSection

                        Divider()

                        // Usage Interface
                        usageInterface

                        if !result.isEmpty {
                            Divider()

                            // Results
                            resultsSection
                        }
                    }
                    .padding()
                }
            }
        }
        .frame(width: 700, height: 600)
        .background(Color(.windowBackgroundColor))
    }

    private var toolInfoSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Tool Information")
                .font(.headline)
                .fontWeight(.semibold)

            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    InfoRow(label: "Category", value: tool.category)
                    InfoRow(label: "Status", value: tool.status == .available ? "Active" : tool.status.rawValue.capitalized)
                    InfoRow(label: "Usage Count", value: "\(tool.usageCount)")
                }

                VStack(alignment: .leading, spacing: 8) {
                    // Rating removed: not present on AITool model
                    // InfoRow(label: "Rating", value: String(format: "%.1f/5.0", tool.rating))
                    // Last Used removed: not present on AITool model
                    // InfoRow(label: "Last Used", value: tool.lastUsed?.formatted() ?? "Never")
                }
            }

            // Features removed: not present on AITool model
        }
    }

    private var usageInterface: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Use Tool")
                .font(.headline)
                .fontWeight(.semibold)

            VStack(spacing: 12) {
                TextField("Enter your input...", text: $inputText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(3...6)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(.controlBackgroundColor))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.separatorColor), lineWidth: 1)
                    )

                HStack {
                    Button("Process") {
                        processTool()
                    }
                    .disabled(inputText.isEmpty || isProcessing)
                    .buttonStyle(.borderedProminent)

                    if isProcessing {
                        ProgressView()
                            .scaleEffect(0.8)
                    }

                    Spacer()
                }
            }
        }
    }

    private var resultsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Results")
                .font(.headline)
                .fontWeight(.semibold)

            Text(result)
                .font(.body)
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(.controlBackgroundColor))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(.separatorColor), lineWidth: 1)
                )

            HStack {
                Button("Copy") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(result, forType: .string)
                }
                .buttonStyle(.bordered)

                Button("Save") {
                    saveResult()
                }
                .buttonStyle(.bordered)

                Spacer()
            }
        }
    }

    private var featureColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 100, maximum: 150))]
    }

    private func processTool() {
        guard !inputText.isEmpty else { return }

        isProcessing = true

        // Simulate tool processing
        Task {
            try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds

            await MainActor.run {
                result = "Processed result for: \"\(inputText)\"\n\nThis is a simulated output from the \(tool.name) tool. " +
                    "In a real implementation, this would contain the actual processed result based on your input."
                isProcessing = false

                // Update usage stats
                appState.updateToolUsage(tool.id)
            }
        }
    }

    private func saveResult() {
        // Save result to app state or file system
        appState.saveToolResult(tool.id, result: result)
    }
}

#Preview {
    ToolsView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
