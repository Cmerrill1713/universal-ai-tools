import AppKit
import SwiftUI

struct AgentManagementView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var searchText = ""
    @State private var selectedObjectiveType: String = "All"
    @State private var showCreateObjective = false
    @State private var selectedObjective: Objective?
    @State private var showObjectiveDetail = false

    private let objectiveTypes = ["All", "Development", "Creative", "Analysis", "Organization", "Research"]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerSection

            Divider()
                .background(AppTheme.separator)

            // Filters
            filterSection

            Divider()
                .background(AppTheme.separator)

            // Objectives List
            objectivesListSection
        }
        .background(AnimatedGradientBackground())
        .glassMorphism(cornerRadius: 0)
        .sheet(isPresented: $showCreateObjective) {
            CreateObjectiveView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .frame(width: 500, height: 450)
        }
        .sheet(isPresented: $showObjectiveDetail) {
            if let objective = selectedObjective {
                ObjectiveDetailView(objective: objective)
                    .environmentObject(appState)
                    .environmentObject(apiService)
                    .frame(width: 600, height: 500)
            }
        }
        .onAppear {
            loadObjectives()
        }
    }

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Objectives")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("\(appState.activeObjectives.count) active objectives")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button("Create Objective") {
                showCreateObjective = true
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
                TextField("Search objectives...", text: $searchText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            .frame(width: 200)

            // Type filter
            Picker("Type", selection: $selectedObjectiveType) {
                ForEach(objectiveTypes, id: \.self) { type in
                    Text(type).tag(type)
                }
            }
            .pickerStyle(MenuPickerStyle())

            Spacer()

            // Status filter
            HStack(spacing: 8) {
                StatusFilterButton(title: "All", count: appState.activeObjectives.count, isSelected: true)
                StatusFilterButton(title: "Active", count: activeObjectivesCount, isSelected: false)
                StatusFilterButton(title: "Planning", count: planningCount, isSelected: false)
                StatusFilterButton(title: "Complete", count: completeCount, isSelected: false)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private var objectivesListSection: some View {
        VStack(spacing: 20) {
            // Objective icons grid
            objectiveIconsGrid

            Spacer()
        }
    }

    private var objectiveIconsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 20), count: 5), spacing: 20) {
            ForEach(filteredObjectives) { objective in
                VStack(spacing: 8) {
                    MacOSAppIcon(
                        type: objective.type,
                        isActive: objective.status == .active
                    )
                    .onTapGesture {
                        selectedObjective = objective
                        showObjectiveDetail = true
                    }
                    .help(objectiveHoverDetail(for: objective))

                    Text(objective.title)
                        .font(.caption)
                        .foregroundColor(.primary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .frame(width: 80)
                }
            }
        }
        .padding()
    }

    private var filteredObjectives: [Objective] {
        var objectives = appState.activeObjectives

        // Filter by search text
        if !searchText.isEmpty {
            objectives = objectives.filter { objective in
                objective.title.localizedCaseInsensitiveContains(searchText) ||
                objective.type.localizedCaseInsensitiveContains(searchText) ||
                objective.description.localizedCaseInsensitiveContains(searchText)
            }
        }

        // Filter by type
        if selectedObjectiveType != "All" {
            objectives = objectives.filter { $0.type == selectedObjectiveType }
        }

        return objectives
    }

    private var activeObjectivesCount: Int { appState.activeObjectives.filter { $0.status == .active }.count }

    private var planningCount: Int { appState.activeObjectives.filter { $0.status == .planning }.count }

    private var completeCount: Int { appState.activeObjectives.filter { $0.status == .completed }.count }

    private func loadObjectives() {
        Task {
            do {
                let objectives = try await apiService.getObjectives()
                await MainActor.run {
                    appState.activeObjectives = objectives
                }
            } catch {
                print("Failed to load objectives: \(error)")
            }
        }
    }

    private func objectiveHoverDetail(for objective: Objective) -> String {
        let statusText = objective.status.rawValue.capitalized
        let progressText = "\(objective.progress)% complete"
        return "\(objective.description)\n\nStatus: \(statusText) • Progress: \(progressText)"
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

struct ObjectiveCard: View {
    let objective: Objective
    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            // Main content
            HStack(spacing: 12) {
                // Status indicator
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)

                // macOS-style app icon
                MacOSAppIcon(
                    type: objective.type,
                    isActive: objective.status == .active
                )
                .help(objectiveHoverDetail)

                // Objective info
                VStack(alignment: .leading, spacing: 4) {
                    Text(objective.title)
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text(objective.type)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    if isExpanded {
                        Text(objective.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(3)
                    }
                }

                Spacer()

                // Progress indicator
                VStack(spacing: 4) {
                    Text("\(objective.progress)%")
                        .font(.caption)
                        .fontWeight(.medium)

                    ProgressView(value: Double(objective.progress) / 100.0)
                        .frame(width: 60)
                        .scaleEffect(y: 0.5)
                }

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

                    // Tasks
                    if !objective.tasks.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Tasks")
                                .font(.subheadline)
                                .fontWeight(.medium)

                            ForEach(objective.tasks, id: \.self) { task in
                                HStack(spacing: 8) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(AppTheme.accentOrange.opacity(0.6))
                                        .font(.caption)

                                    Text(task)
                                        .font(.caption)
                                        .foregroundColor(.secondary)

                                    Spacer()
                                }
                            }
                        }
                    }

                    // Actions
                    HStack(spacing: 8) {
                        Button("Start") {
                            // Start objective
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(objective.status == .active)

                        Button("Pause") {
                            // Pause objective
                        }
                        .buttonStyle(.bordered)
                        .disabled(objective.status != .active)

                        Button("Edit") {
                            // Edit objective
                        }
                        .buttonStyle(.bordered)

                        Spacer()

                        Button("Archive") {
                            // Archive objective
                        }
                        .buttonStyle(.bordered)
                        .foregroundColor(.orange)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
        .glassMorphism(cornerRadius: 12)
        .glow(color: objective.status == .active ? AppTheme.accentOrange.opacity(0.2) : .clear, radius: objective.status == .active ? 1 : 0)
        .transition(.scale.combined(with: .opacity))
    }

    private var statusColor: Color {
        switch objective.status {
        case .active: return AppTheme.accentOrange
        case .planning: return AppTheme.accentBlue
        case .completed: return .green
        case .paused: return .orange
        case .cancelled: return .red
        }
    }

    private var objectiveIcon: String {
        switch objective.type {
        case "Development": return "hammer.fill"
        case "Creative": return "paintbrush.fill"
        case "Analysis": return "chart.bar.fill"
        case "Organization": return "folder.fill"
        case "Research": return "magnifyingglass"
        default: return "target"
        }
    }

    private var objectiveIconDescription: String {
        switch objective.type {
        case "Development": return "Build"
        case "Creative": return "Design"
        case "Analysis": return "Analyze"
        case "Organization": return "Organize"
        case "Research": return "Research"
        default: return "Goal"
        }
    }

    private var objectiveHoverDetail: String {
        switch objective.type {
        case "Development": return "Software development, coding, and building applications or systems"
        case "Creative": return "Creative projects, design work, content creation, and artistic endeavors"
        case "Analysis": return "Data analysis, research insights, performance metrics, and trend identification"
        case "Organization": return "File management, data sorting, workflow optimization, and system organization"
        case "Research": return "Information gathering, market research, competitive analysis, and knowledge discovery"
        default: return "General objective or goal achievement"
        }
    }
}

struct CreateObjectiveView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var description = ""
    @State private var type = "Development"

    private let types = ["Development", "Creative", "Analysis", "Organization", "Research"]

    var body: some View {
        VStack(spacing: 20) {
            HStack {
                Text("Create Objective")
                    .font(.title2)
                    .fontWeight(.bold)
                Spacer()
                Button("Cancel") { dismiss() }
                    .buttonStyle(.borderless)
            }

            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Title")
                        .font(.headline)
                    TextField("e.g., Create iOS photo organizer app", text: $title)
                        .textFieldStyle(.roundedBorder)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Type")
                        .font(.headline)
                    Picker("Type", selection: $type) {
                        ForEach(types, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }
                    .pickerStyle(.menu)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Description")
                        .font(.headline)
                    TextEditor(text: $description)
                        .frame(height: 100)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                        )
                }
            }

            HStack {
                Spacer()
                Button("Create") {
                    createObjective()
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .disabled(title.isEmpty)
            }
        }
        .padding()
        .frame(width: 500, height: 400)
    }

    private func createObjective() {
        let objective = Objective(
            id: UUID().uuidString,
            title: title,
            description: description,
            type: type,
            status: .planning,
            progress: 0,
            tasks: []
        )
        appState.activeObjectives.append(objective)
    }
}

struct MacOSAppIcon: View {
    let type: String
    let isActive: Bool

    var body: some View {
        ZStack {
            // Larger app icon background with rounded corners (macOS dock style)
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(iconGradient)
                .frame(width: 64, height: 64)
                .shadow(color: Color.black.opacity(0.3), radius: 4, x: 0, y: 2)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [Color.white.opacity(0.3), Color.white.opacity(0.1)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )

            // Larger, more prominent icon symbol
            Image(systemName: iconSymbol)
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(.white)
                .shadow(color: Color.black.opacity(0.4), radius: 2, x: 0, y: 1)
        }
        .scaleEffect(isActive ? 1.0 : 0.92)
        .opacity(isActive ? 1.0 : 0.75)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isActive)
    }

    private var iconGradient: LinearGradient {
        switch type {
        case "Development":
            // Xcode-like blue gradient
            return LinearGradient(
                colors: [
                    Color(hex: "1E9BFF"),
                    Color(hex: "007AFF"),
                    Color(hex: "0051D5")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "Creative":
            // Photoshop/Creative-like red-pink gradient
            return LinearGradient(
                colors: [
                    Color(hex: "FF6B6B"),
                    Color(hex: "FF3B30"),
                    Color(hex: "D70015")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "Analysis":
            // Numbers/Excel-like green gradient
            return LinearGradient(
                colors: [
                    Color(hex: "4ADB6A"),
                    Color(hex: "34C759"),
                    Color(hex: "248A3D")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "Organization":
            // Finder/FileManager-like orange gradient
            return LinearGradient(
                colors: [
                    Color(hex: "FFB340"),
                    Color(hex: "FF9500"),
                    Color(hex: "DB6700")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        case "Research":
            // Safari/Browser-like purple gradient
            return LinearGradient(
                colors: [
                    Color(hex: "7B68EE"),
                    Color(hex: "5856D6"),
                    Color(hex: "3634A3")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        default:
            return LinearGradient(
                colors: [
                    Color(hex: "A8A8A8"),
                    Color(hex: "8E8E93"),
                    Color(hex: "636366")
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var iconSymbol: String {
        switch type {
        case "Development": return "chevron.left.forwardslash.chevron.right"
        case "Creative": return "paintbrush.pointed.fill"
        case "Analysis": return "chart.bar.fill"
        case "Organization": return "folder.fill"
        case "Research": return "doc.text.magnifyingglass"
        default: return "target"
        }
    }
}

struct ObjectiveDetailView: View {
    let objective: Objective
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 20) {
            // Header with icon and title
            HStack(spacing: 16) {
                MacOSAppIcon(
                    type: objective.type,
                    isActive: objective.status == .active
                )

                VStack(alignment: .leading, spacing: 4) {
                    Text(objective.title)
                        .font(.title2)
                        .fontWeight(.bold)

                    Text(objective.type)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Status badge
                Text(objective.status.rawValue.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor.opacity(0.2))
                    .foregroundColor(statusColor)
                    .cornerRadius(8)
            }

            // Progress
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Progress")
                        .font(.headline)
                    Spacer()
                    Text("\(objective.progress)%")
                        .font(.headline)
                        .fontWeight(.medium)
                }

                ProgressView(value: Double(objective.progress) / 100.0)
                    .progressViewStyle(LinearProgressViewStyle())
            }

            // Description
            VStack(alignment: .leading, spacing: 8) {
                Text("Description")
                    .font(.headline)

                Text(objective.description)
                    .font(.body)
                    .foregroundColor(.secondary)
            }

            // Tasks
            if !objective.tasks.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Tasks")
                        .font(.headline)

                    ForEach(objective.tasks, id: \.self) { task in
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                                .font(.caption)

                            Text(task)
                                .font(.body)

                            Spacer()
                        }
                    }
                }
            }

            Spacer()

            // Context-aware tools
            if objective.status == .active {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Available Tools")
                        .font(.headline)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 12) {
                        ForEach(contextualTools(for: objective.type), id: \.title) { tool in
                            ContextualToolButton(tool: tool, objective: objective)
                        }
                    }
                }
            }

            Spacer()

            // Action buttons
            HStack(spacing: 12) {
                Button("Start") {
                    startObjective()
                }
                .buttonStyle(.borderedProminent)
                .disabled(objective.status == .active)

                Button("Gallery") {
                    openGalleryForObjective()
                }
                .buttonStyle(.bordered)
                .disabled(objective.type != "Creative" && objective.type != "Organization")

                Button("Edit") {
                    // Edit objective - could open create window in edit mode
                }
                .buttonStyle(.bordered)

                Spacer()

                Button("Archive") {
                    archiveObjective()
                }
                .buttonStyle(.bordered)
                .foregroundColor(.orange)
            }
        }
        .padding()
    }

    private var statusColor: Color {
        switch objective.status {
        case .active: return AppTheme.accentOrange
        case .planning: return AppTheme.accentBlue
        case .completed: return .green
        case .paused: return .orange
        case .cancelled: return .red
        }
    }

    private func startObjective() {
        // Start the objective and navigate to relevant tools
        if let index = appState.activeObjectives.firstIndex(where: { $0.id == objective.id }) {
            appState.activeObjectives[index].status = .active
        }

        // Navigate to the most relevant tool for this objective type
        appState.selectedSidebarItem = .tools
        switch objective.type {
        case "Creative":
            appState.selectedTool = .vision
        case "Organization":
            appState.selectedTool = .debugging // Could be file management
        case "Development":
            appState.selectedTool = .debugging // Code tools
        case "Analysis":
            appState.selectedTool = .monitoring // Analytics tools
        case "Research":
            appState.selectedTool = .knowledge // Research tools
        default:
            appState.selectedTool = .debugging
        }

        // Close the detail window
        dismissWindow()
    }

    private func openGalleryForObjective() {
        // Navigate to vision tool for photo/gallery management
        appState.selectedSidebarItem = .tools
        appState.selectedTool = .vision

        // Close the detail window
        dismissWindow()
    }

    private func archiveObjective() {
        if let index = appState.activeObjectives.firstIndex(where: { $0.id == objective.id }) {
            appState.activeObjectives[index].status = .completed
        }

        // Close the detail window
        dismissWindow()
    }

    private func dismissWindow() {
        dismiss()
    }

    private func contextualTools(for objectiveType: String) -> [ContextualTool] {
        switch objectiveType {
        case "Creative":
            return creativeTools()
        case "Organization":
            return organizationTools()
        case "Development":
            return developmentTools()
        case "Analysis":
            return analysisTools()
        case "Research":
            return researchTools()
        default:
            return []
        }
    }
    
    private func creativeTools() -> [ContextualTool] {
        return [
            ContextualTool(
                title: "Face Detection",
                subtitle: "Who is this?",
                icon: "person.crop.rectangle",
                action: "Identify people in photos and add name tags"
            ),
            ContextualTool(
                title: "Style Transfer",
                subtitle: "Apply filters",
                icon: "camera.filters",
                action: "Apply artistic styles to images"
            ),
            ContextualTool(
                title: "Background Remove",
                subtitle: "Clean images",
                icon: "person.crop.square",
                action: "Remove or replace image backgrounds"
            )
        ]
    }
    
    private func organizationTools() -> [ContextualTool] {
        return [
            ContextualTool(
                title: "Smart Sorting",
                subtitle: "Auto organize",
                icon: "folder.badge.gearshape",
                action: "Automatically sort files by type, date, or content"
            ),
            ContextualTool(
                title: "Duplicate Finder",
                subtitle: "Remove dupes",
                icon: "doc.on.doc",
                action: "Find and remove duplicate files"
            ),
            ContextualTool(
                title: "Metadata Extract",
                subtitle: "Get details",
                icon: "info.circle",
                action: "Extract metadata from photos and documents"
            )
        ]
    }
    
    private func developmentTools() -> [ContextualTool] {
        return [
            ContextualTool(
                title: "Code Generator",
                subtitle: "Write code",
                icon: "chevron.left.forwardslash.chevron.right",
                action: "Generate code based on requirements"
            ),
            ContextualTool(
                title: "Bug Finder",
                subtitle: "Debug issues",
                icon: "ladybug",
                action: "Analyze code for potential bugs"
            ),
            ContextualTool(
                title: "API Tester",
                subtitle: "Test endpoints",
                icon: "network",
                action: "Test and validate API endpoints"
            )
        ]
    }
    
    private func analysisTools() -> [ContextualTool] {
        return [
            ContextualTool(
                title: "Data Visualizer",
                subtitle: "Create charts",
                icon: "chart.bar",
                action: "Generate charts and graphs from data"
            ),
            ContextualTool(
                title: "Pattern Finder",
                subtitle: "Find trends",
                icon: "waveform.path.ecg",
                action: "Identify patterns and trends in data"
            ),
            ContextualTool(
                title: "Report Generator",
                subtitle: "Create reports",
                icon: "doc.text",
                action: "Generate analytical reports"
            )
        ]
    }
    
    private func researchTools() -> [ContextualTool] {
        return [
            ContextualTool(
                title: "Web Scraper",
                subtitle: "Gather data",
                icon: "globe",
                action: "Extract information from websites"
            ),
            ContextualTool(
                title: "Citation Finder",
                subtitle: "Find sources",
                icon: "quote.bubble",
                action: "Find and format academic citations"
            ),
            ContextualTool(
                title: "Summary Generator",
                subtitle: "Summarize text",
                icon: "doc.plaintext",
                action: "Create summaries of research materials"
            )
        ]
    }
}

struct ContextualTool {
    let title: String
    let subtitle: String
    let icon: String
    let action: String
}

struct ContextualToolButton: View {
    let tool: ContextualTool
    let objective: Objective
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: tool.icon)
                .font(.title2)
                .foregroundColor(.white)
                .frame(width: 40, height: 40)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(AppTheme.accentBlue)
                )

            VStack(spacing: 2) {
                Text(tool.title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(tool.subtitle)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
        }
        .onTapGesture {
            executeContextualTool()
        }
        .help(tool.action)
    }

    private func executeContextualTool() {
        // Navigate to the appropriate tool based on the contextual action
        appState.selectedSidebarItem = .tools

        switch tool.title {
        case "Face Detection", "Style Transfer", "Background Remove":
            appState.selectedTool = .vision
        case "Smart Sorting", "Duplicate Finder", "Metadata Extract":
            appState.selectedTool = .debugging // Or file management tool
        case "Code Generator", "Bug Finder", "API Tester":
            appState.selectedTool = .debugging
        case "Data Visualizer", "Pattern Finder", "Report Generator":
            appState.selectedTool = .monitoring
        case "Web Scraper", "Citation Finder", "Summary Generator":
            appState.selectedTool = .knowledge
        default:
            appState.selectedTool = .debugging
        }

        // Close the detail sheet and navigate to the tool
        dismiss()

        print("Navigating to \(tool.title) for \(objective.type) objective: \(objective.title)")
    }
}

#Preview {
    AgentManagementView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
