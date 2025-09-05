import SwiftUI

/// Complete AI Agents management interface
@MainActor
struct AgentsManagementView: View {
    @State private var agents: [AIAgent] = AIAgent.sampleAgents
    @State private var selectedAgent: AIAgent?
    @State private var showingNewAgentSheet = false
    @State private var searchText = ""
    @State private var filterStatus: AgentStatus? = nil
    @State private var showingAgentDetail = false
    
    var filteredAgents: [AIAgent] {
        agents.filter { agent in
            let matchesSearch = searchText.isEmpty || agent.name.localizedCaseInsensitiveContains(searchText)
            let matchesStatus = filterStatus == nil || agent.status == filterStatus
            return matchesSearch && matchesStatus
        }
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Stats Overview
                    statsOverview
                    
                    // Filter Controls
                    filterControls
                    
                    // Agents Grid
                    agentsGrid
                }
                .padding()
            }
            .navigationTitle("AI Agents")
            .navigationBarTitleDisplayModeCompat(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailingCompat) {
                    Button {
                        showingNewAgentSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundColor(.blue)
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search agents...")
            .sheet(isPresented: $showingNewAgentSheet) {
                NewAgentCreationSheet(agents: $agents)
            }
            .sheet(item: $selectedAgent) { agent in
                AgentDetailView(agent: binding(for: agent))
            }
        }
    }
    
    // MARK: - Stats Overview
    private var statsOverview: some View {
        HStack(spacing: 16) {
            StatisticCard(
                title: "Total Agents",
                value: "\(agents.count)",
                icon: "cpu",
                color: .blue
            )
            
            StatisticCard(
                title: "Active",
                value: "\(agents.filter { $0.status == .active }.count)",
                icon: "circle.fill",
                color: .green
            )
            
            StatisticCard(
                title: "Processing",
                value: "\(agents.filter { $0.status == .processing }.count)",
                icon: "arrow.triangle.2.circlepath",
                color: .orange
            )
        }
    }
    
    // MARK: - Filter Controls
    private var filterControls: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                FilterChip(
                    title: "All",
                    isSelected: filterStatus == nil,
                    action: { filterStatus = nil }
                )
                
                ForEach(AgentStatus.allCases, id: \.self) { status in
                    FilterChip(
                        title: status.displayName,
                        isSelected: filterStatus == status,
                        color: status.color,
                        action: { filterStatus = status }
                    )
                }
            }
        }
    }
    
    // MARK: - Agents Grid
    private var agentsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            ForEach(filteredAgents) { agent in
                AgentCardView(agent: agent) {
                    selectedAgent = agent
                }
                .contextMenu {
                    agentContextMenu(for: agent)
                }
            }
        }
    }
    
    // MARK: - Context Menu
    @ViewBuilder
    private func agentContextMenu(for agent: AIAgent) -> some View {
        Button {
            toggleAgentStatus(agent)
        } label: {
            Label(
                agent.status == .active ? "Pause" : "Activate",
                systemImage: agent.status == .active ? "pause.circle" : "play.circle"
            )
        }
        
        Button {
            duplicateAgent(agent)
        } label: {
            Label("Duplicate", systemImage: "doc.on.doc")
        }
        
        Button(role: .destructive) {
            deleteAgent(agent)
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }
    
    // MARK: - Helper Methods
    private func binding(for agent: AIAgent) -> Binding<AIAgent> {
        Binding(
            get: { agent },
            set: { updatedAgent in
                if let index = agents.firstIndex(where: { $0.id == agent.id }) {
                    agents[index] = updatedAgent
                }
            }
        )
    }
    
    private func toggleAgentStatus(_ agent: AIAgent) {
        if let index = agents.firstIndex(where: { $0.id == agent.id }) {
            withAnimation {
                agents[index].status = agents[index].status == .active ? .idle : .active
            }
        }
    }
    
    private func duplicateAgent(_ agent: AIAgent) {
        var newAgent = agent
        newAgent.id = UUID()
        newAgent.name = "\(agent.name) (Copy)"
        withAnimation {
            agents.append(newAgent)
        }
    }
    
    private func deleteAgent(_ agent: AIAgent) {
        withAnimation {
            agents.removeAll { $0.id == agent.id }
        }
    }
}

// MARK: - AIAgent Model
struct AIAgent: Identifiable, Equatable {
    let id = UUID()
    var name: String
    var description: String
    var type: AgentType
    var status: AgentStatus
    var capabilities: [String]
    var lastActive: Date
    var tasksCompleted: Int
    var successRate: Double
    
    static let sampleAgents: [AIAgent] = [
        AIAgent(
            name: "Data Processor",
            description: "Processes and analyzes incoming data streams in real-time",
            type: .dataAnalysis,
            status: .active,
            capabilities: ["Data parsing", "Pattern recognition", "Anomaly detection"],
            lastActive: Date(),
            tasksCompleted: 1247,
            successRate: 0.98
        ),
        AIAgent(
            name: "Content Generator",
            description: "Creates high-quality content based on templates and guidelines",
            type: .contentCreation,
            status: .processing,
            capabilities: ["Text generation", "Image captions", "SEO optimization"],
            lastActive: Date().addingTimeInterval(-3600),
            tasksCompleted: 856,
            successRate: 0.95
        ),
        AIAgent(
            name: "Email Assistant",
            description: "Manages email responses and categorization",
            type: .communication,
            status: .active,
            capabilities: ["Auto-reply", "Categorization", "Priority sorting"],
            lastActive: Date().addingTimeInterval(-1800),
            tasksCompleted: 3421,
            successRate: 0.99
        ),
        AIAgent(
            name: "Code Reviewer",
            description: "Analyzes code for quality, security, and best practices",
            type: .development,
            status: .idle,
            capabilities: ["Syntax checking", "Security scanning", "Performance tips"],
            lastActive: Date().addingTimeInterval(-7200),
            tasksCompleted: 567,
            successRate: 0.97
        ),
        AIAgent(
            name: "Research Bot",
            description: "Gathers and synthesizes information from multiple sources",
            type: .research,
            status: .active,
            capabilities: ["Web scraping", "Fact checking", "Summarization"],
            lastActive: Date().addingTimeInterval(-300),
            tasksCompleted: 2103,
            successRate: 0.96
        ),
        AIAgent(
            name: "Translation Service",
            description: "Provides real-time translation across 50+ languages",
            type: .translation,
            status: .error,
            capabilities: ["Multi-language", "Context aware", "Cultural adaptation"],
            lastActive: Date().addingTimeInterval(-86400),
            tasksCompleted: 8932,
            successRate: 0.94
        )
    ]
}

enum AgentType: String, CaseIterable {
    case dataAnalysis = "Data Analysis"
    case contentCreation = "Content Creation"
    case communication = "Communication"
    case development = "Development"
    case research = "Research"
    case translation = "Translation"
    
    var icon: String {
        switch self {
        case .dataAnalysis: return "chart.bar.fill"
        case .contentCreation: return "doc.text.fill"
        case .communication: return "envelope.fill"
        case .development: return "chevron.left.forwardslash.chevron.right"
        case .research: return "magnifyingglass"
        case .translation: return "globe"
        }
    }
}

enum AgentStatus: String, CaseIterable {
    case active = "Active"
    case idle = "Idle"
    case processing = "Processing"
    case error = "Error"
    
    var displayName: String { rawValue }
    
    var color: Color {
        switch self {
        case .active: return .green
        case .idle: return .gray
        case .processing: return .orange
        case .error: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .active: return "circle.fill"
        case .idle: return "moon.fill"
        case .processing: return "arrow.triangle.2.circlepath"
        case .error: return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Agent Card View
struct AgentCardView: View {
    let agent: AIAgent
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                // Header
                HStack {
                    Image(systemName: agent.type.icon)
                        .font(.title2)
                        .foregroundColor(.blue)
                    
                    Spacer()
                    
                    StatusBadge(status: agent.status)
                }
                
                // Name & Description
                VStack(alignment: .leading, spacing: 4) {
                    Text(agent.name)
                        .font(.headline)
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    
                    Text(agent.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                
                // Stats
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(agent.tasksCompleted)")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.primary)
                        Text("Tasks")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(Int(agent.successRate * 100))%")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.primary)
                        Text("Success")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                
                // Last Active
                HStack {
                    Image(systemName: "clock")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(agent.lastActive, style: .relative)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Supporting Views
struct StatisticCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
                Spacer()
            }
            
            Text(value)
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.primary)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct FilterChip: View {
    let title: String
    var isSelected: Bool
    var color: Color = .blue
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(isSelected ? .white : .primary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? color : Color(.tertiarySystemBackground))
                .cornerRadius(16)
        }
    }
}

struct StatusBadge: View {
    let status: AgentStatus
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.icon)
                .font(.caption2)
            Text(status.displayName)
                .font(.caption2)
                .fontWeight(.medium)
        }
        .foregroundColor(.white)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(status.color)
        .cornerRadius(6)
    }
}

// MARK: - New Agent Creation Sheet
struct NewAgentCreationSheet: View {
    @Binding var agents: [AIAgent]
    @Environment(\.dismiss) private var dismiss
    
    @State private var agentName = ""
    @State private var agentDescription = ""
    @State private var agentType: AgentType = .dataAnalysis
    @State private var selectedCapabilities: Set<String> = []
    
    let availableCapabilities = [
        "Data parsing", "Pattern recognition", "Anomaly detection",
        "Text generation", "Image analysis", "Natural language processing",
        "Email management", "Task scheduling", "Report generation",
        "Code analysis", "Security scanning", "Performance monitoring"
    ]
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Basic Information") {
                    TextField("Agent Name", text: $agentName)
                    TextField("Description", text: $agentDescription, axis: .vertical)
                        .lineLimit(3...5)
                }
                
                Section("Configuration") {
                    Picker("Agent Type", selection: $agentType) {
                        ForEach(AgentType.allCases, id: \.self) { type in
                            Label(type.rawValue, systemImage: type.icon)
                                .tag(type)
                        }
                    }
                }
                
                Section("Capabilities") {
                    ForEach(availableCapabilities, id: \.self) { capability in
                        HStack {
                            Text(capability)
                                .font(.subheadline)
                            Spacer()
                            if selectedCapabilities.contains(capability) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.blue)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            if selectedCapabilities.contains(capability) {
                                selectedCapabilities.remove(capability)
                            } else {
                                selectedCapabilities.insert(capability)
                            }
                        }
                    }
                }
            }
            .navigationTitle("New Agent")
            .navigationBarTitleDisplayModeCompat(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeadingCompat) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailingCompat) {
                    Button("Create") {
                        createAgent()
                    }
                    .disabled(agentName.isEmpty || agentDescription.isEmpty)
                }
            }
        }
    }
    
    private func createAgent() {
        let newAgent = AIAgent(
            name: agentName,
            description: agentDescription,
            type: agentType,
            status: .idle,
            capabilities: Array(selectedCapabilities),
            lastActive: Date(),
            tasksCompleted: 0,
            successRate: 1.0
        )
        agents.append(newAgent)
        dismiss()
    }
}

// MARK: - Agent Detail View
struct AgentDetailView: View {
    @Binding var agent: AIAgent
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Status Section
                    statusSection
                    
                    // Performance Metrics
                    performanceSection
                    
                    // Capabilities
                    capabilitiesSection
                    
                    // Actions
                    actionsSection
                }
                .padding()
            }
            .navigationTitle(agent.name)
            .navigationBarTitleDisplayModeCompat(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailingCompat) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private var statusSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Status")
                .font(.headline)
            
            HStack {
                StatusBadge(status: agent.status)
                Spacer()
                Text("Last active: \(agent.lastActive, style: .relative)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Text(agent.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
    
    private var performanceSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Performance")
                .font(.headline)
            
            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(agent.tasksCompleted)")
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("Tasks Completed")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(Int(agent.successRate * 100))%")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.green)
                    Text("Success Rate")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(.tertiarySystemBackground))
                        .frame(height: 8)
                    
                    RoundedRectangle(cornerRadius: 4)
                        .fill(LinearGradient(
                            colors: [.blue, .green],
                            startPoint: .leading,
                            endPoint: .trailing
                        ))
                        .frame(width: geometry.size.width * agent.successRate, height: 8)
                }
            }
            .frame(height: 8)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
    
    private var capabilitiesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Capabilities")
                .font(.headline)
            
            FlowLayout(spacing: 8) {
                ForEach(agent.capabilities, id: \.self) { capability in
                    Text(capability)
                        .font(.caption)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.blue.opacity(0.1))
                        .foregroundColor(.blue)
                        .cornerRadius(16)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
    
    private var actionsSection: some View {
        VStack(spacing: 12) {
            Button {
                agent.status = agent.status == .active ? .idle : .active
            } label: {
                HStack {
                    Image(systemName: agent.status == .active ? "pause.circle" : "play.circle")
                    Text(agent.status == .active ? "Pause Agent" : "Activate Agent")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            
            Button {
                // Reset stats action
                agent.tasksCompleted = 0
                agent.successRate = 1.0
            } label: {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("Reset Statistics")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.tertiarySystemBackground))
                .foregroundColor(.primary)
                .cornerRadius(12)
            }
        }
    }
}

// MARK: - Flow Layout
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: result.frames[index].origin.x + bounds.minX,
                                     y: result.frames[index].origin.y + bounds.minY),
                         proposal: ProposedViewSize(result.frames[index].size))
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var frames: [CGRect] = []
        
        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var currentX: CGFloat = 0
            var currentY: CGFloat = 0
            var lineHeight: CGFloat = 0
            
            for subview in subviews {
                let viewSize = subview.sizeThatFits(.unspecified)
                
                if currentX + viewSize.width > maxWidth && currentX > 0 {
                    currentY += lineHeight + spacing
                    currentX = 0
                    lineHeight = 0
                }
                
                frames.append(CGRect(origin: CGPoint(x: currentX, y: currentY), size: viewSize))
                lineHeight = max(lineHeight, viewSize.height)
                currentX += viewSize.width + spacing
            }
            
            size = CGSize(width: maxWidth, height: currentY + lineHeight)
        }
    }
}

#Preview {
    AgentsManagementView()
}