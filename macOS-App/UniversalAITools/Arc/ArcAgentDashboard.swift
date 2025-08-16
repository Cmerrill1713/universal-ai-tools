import SwiftUI
import Charts
import UniformTypeIdentifiers
import Foundation

// MARK: - Arc Agent Dashboard
/// Arc-inspired agent management dashboard with real-time monitoring, drag-and-drop workflows,
/// and comprehensive agent visualization
struct ArcAgentDashboard: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var dashboardViewModel = AgentDashboardViewModel()
    @State private var searchText = ""
    @State private var selectedFilter: AgentFilter = .all
    @State private var selectedAgent: Agent?
    @State private var showingAgentDetails = false
    @State private var isCreatingWorkflow = false
    @State private var workflowNodes: [WorkflowNode] = []
    @State private var draggedAgent: Agent?
    @State private var hoveredCard: UUID?
    @State private var showingMetrics = false
    @State private var animationTrigger = false
    
    private let gridColumns = [
        GridItem(.adaptive(minimum: 280, maximum: 320), spacing: ArcDesign.Spacing.lg)
    ]
    
    var body: some View {
        NavigationSplitView {
            // MARK: - Sidebar
            sidebar
                .navigationSplitViewColumnWidth(min: 250, ideal: 280)
        } detail: {
            // MARK: - Main Dashboard
            mainDashboard
        }
        .navigationTitle("Agent Dashboard")
        .navigationSubtitle("\(filteredAgents.count) agents")
        .onAppear {
            loadAgents()
            startPerformanceMonitoring()
        }
        .sheet(isPresented: $showingAgentDetails) {
            if let agent = selectedAgent {
                AgentDetailsSheet(agent: agent)
            }
        }
        .sheet(isPresented: $isCreatingWorkflow) {
            WorkflowCreationSheet(agents: appState.availableAgents, workflowNodes: $workflowNodes)
        }
    }
    
    // MARK: - Sidebar
    private var sidebar: some View {
        VStack(spacing: ArcDesign.Spacing.lg) {
            // Search and Filter
            searchAndFilterSection
            
            // Agent Type Filters
            agentTypeFilters
            
            // Quick Stats
            quickStatsSection
            
            // Active Workflows
            activeWorkflowsSection
            
            Spacer()
            
            // Actions
            actionButtons
        }
        .padding(ArcDesign.Spacing.lg)
        .background(ArcDesign.Colors.secondaryBackground)
    }
    
    // MARK: - Search and Filter Section
    private var searchAndFilterSection: some View {
        VStack(spacing: ArcDesign.Spacing.md) {
            ArcTextField(
                text: $searchText,
                placeholder: "Search agents...",
                icon: "magnifyingglass"
            )
            
            Picker("Filter", selection: $selectedFilter) {
                ForEach(AgentFilter.allCases, id: \.self) { filter in
                    Text(filter.displayName).tag(filter)
                }
            }
            .pickerStyle(SegmentedPickerStyle())
        }
    }
    
    // MARK: - Agent Type Filters
    private var agentTypeFilters: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
            Text("Agent Types")
                .font(ArcDesign.Typography.headline)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: ArcDesign.Spacing.sm) {
                ForEach(AgentType.allCases, id: \.self) { type in
                    agentTypeFilter(for: type)
                }
            }
        }
    }
    
    private func agentTypeFilter(for type: AgentType) -> some View {
        let count = filteredAgents.filter { $0.type == type }.count
        let isActive = count > 0
        
        return Button(action: {
            // Toggle type-specific filtering
            withAnimation(ArcDesign.Animation.spring) {
                if selectedFilter == .type(type) {
                    selectedFilter = .all
                } else {
                    selectedFilter = .type(type)
                }
            }
        }) {
            HStack(spacing: ArcDesign.Spacing.xs) {
                Image(systemName: type.icon)
                    .foregroundColor(isActive ? type.color : ArcDesign.Colors.tertiaryText)
                    .font(.system(size: 12))
                
                Text("\(count)")
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(isActive ? ArcDesign.Colors.primaryText : ArcDesign.Colors.tertiaryText)
            }
            .padding(.horizontal, ArcDesign.Spacing.sm)
            .padding(.vertical, ArcDesign.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                    .fill(isActive ? type.color.opacity(0.1) : ArcDesign.Colors.tertiaryBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                    .stroke(isActive ? type.color.opacity(0.3) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    // MARK: - Quick Stats Section
    private var quickStatsSection: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
            Text("Performance")
                .font(ArcDesign.Typography.headline)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: ArcDesign.Spacing.sm) {
                quickStatCard(
                    title: "Active",
                    value: "\(dashboardViewModel.activeAgentCount)",
                    color: ArcDesign.Colors.success,
                    icon: "play.circle.fill"
                )
                
                quickStatCard(
                    title: "Avg Response",
                    value: "\(Int(dashboardViewModel.averageResponseTime))ms",
                    color: ArcDesign.Colors.info,
                    icon: "speedometer"
                )
                
                quickStatCard(
                    title: "Success Rate",
                    value: "\(Int(dashboardViewModel.successRate))%",
                    color: ArcDesign.Colors.success,
                    icon: "checkmark.circle"
                )
                
                quickStatCard(
                    title: "Token Usage",
                    value: "\(dashboardViewModel.totalTokens)k",
                    color: ArcDesign.Colors.accentPurple,
                    icon: "text.bubble"
                )
            }
        }
    }
    
    private func quickStatCard(title: String, value: String, color: Color, icon: String) -> some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.xs) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.system(size: 12))
                Spacer()
            }
            
            Text(value)
                .font(ArcDesign.Typography.caption)
                .fontWeight(.semibold)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            Text(title)
                .font(ArcDesign.Typography.caption2)
                .foregroundColor(ArcDesign.Colors.secondaryText)
        }
        .padding(ArcDesign.Spacing.sm)
        .background(ArcDesign.Colors.tertiaryBackground)
        .cornerRadius(ArcDesign.Radius.sm)
    }
    
    // MARK: - Active Workflows Section
    private var activeWorkflowsSection: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
            HStack {
                Text("Active Workflows")
                    .font(ArcDesign.Typography.headline)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                
                Spacer()
                
                Text("\(dashboardViewModel.activeWorkflows.count)")
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
            }
            
            if dashboardViewModel.activeWorkflows.isEmpty {
                Text("No active workflows")
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.tertiaryText)
                    .padding(.vertical, ArcDesign.Spacing.md)
            } else {
                ForEach(dashboardViewModel.activeWorkflows.prefix(3), id: \.id) { workflow in
                    workflowCard(workflow)
                }
                
                if dashboardViewModel.activeWorkflows.count > 3 {
                    Button("View all workflows") {
                        // Navigate to workflows view
                    }
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.accentBlue)
                }
            }
        }
    }
    
    private func workflowCard(_ workflow: AgentWorkflow) -> some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.xs) {
            HStack {
                Circle()
                    .fill(workflow.status.color)
                    .frame(width: 6, height: 6)
                
                Text(workflow.name)
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                
                Spacer()
                
                Text(workflow.progress, format: .percent)
                    .font(ArcDesign.Typography.caption2)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
            }
            
            ProgressView(value: workflow.progress)
                .progressViewStyle(LinearProgressViewStyle())
                .scaleEffect(y: 0.5)
        }
        .padding(.vertical, ArcDesign.Spacing.xs)
    }
    
    // MARK: - Action Buttons
    private var actionButtons: some View {
        VStack(spacing: ArcDesign.Spacing.sm) {
            Button(action: {
                isCreatingWorkflow = true
            }) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text("Create Workflow")
                }
            }
            .buttonStyle(ArcButton(color: ArcDesign.Colors.accentBlue))
            
            Button(action: {
                showingMetrics = true
            }) {
                HStack {
                    Image(systemName: "chart.bar.xaxis")
                    Text("Performance Metrics")
                }
            }
            .buttonStyle(ArcButton(color: ArcDesign.Colors.accentGreen))
        }
    }
    
    // MARK: - Main Dashboard
    private var mainDashboard: some View {
        ScrollView {
            LazyVGrid(columns: gridColumns, spacing: ArcDesign.Spacing.lg) {
                ForEach(filteredAgents, id: \.id) { agent in
                    AgentCard(
                        agent: agent,
                        isHovered: hoveredCard == agent.id,
                        onTap: {
                            selectedAgent = agent
                            showingAgentDetails = true
                        },
                        onStart: {
                            startAgent(agent)
                        },
                        onStop: {
                            stopAgent(agent)
                        },
                        onConfigure: {
                            selectedAgent = agent
                            showingAgentDetails = true
                        }
                    )
                    .onHover { hovering in
                        withAnimation(ArcDesign.Animation.quick) {
                            hoveredCard = hovering ? agent.id : nil
                        }
                    }
                    .onDrag {
                        draggedAgent = agent
                        return NSItemProvider(object: agent.name as NSString)
                    }
                    .onDrop(of: [.text], delegate: WorkflowDropDelegate(
                        agent: agent,
                        workflowNodes: $workflowNodes,
                        draggedAgent: $draggedAgent
                    ))
                }
            }
            .padding(ArcDesign.Spacing.lg)
        }
        .background(ArcDesign.Colors.primaryBackground)
        .animation(ArcDesign.Animation.spring, value: filteredAgents.count)
    }
    
    // MARK: - Computed Properties
    private var filteredAgents: [Agent] {
        var agents = appState.availableAgents
        
        // Apply search filter
        if !searchText.isEmpty {
            agents = agents.filter { agent in
                agent.name.localizedCaseInsensitiveContains(searchText) ||
                agent.description.localizedCaseInsensitiveContains(searchText) ||
                agent.capabilities.contains { $0.localizedCaseInsensitiveContains(searchText) }
            }
        }
        
        // Apply type/status filter
        switch selectedFilter {
        case .all:
            break
        case .active:
            agents = agents.filter { $0.status == .active }
        case .idle:
            agents = agents.filter { $0.status == .idle }
        case .error:
            agents = agents.filter { $0.status == .error }
        case .type(let agentType):
            agents = agents.filter { $0.type == agentType }
        }
        
        return agents.sorted { $0.name < $1.name }
    }
    
    // MARK: - Methods
    private func loadAgents() {
        Task {
            do {
                let agents = try await appState.apiService.getAgents()
                await MainActor.run {
                    appState.availableAgents = agents
                }
            } catch {
                print("Failed to load agents: \(error)")
            }
        }
    }
    
    private func startPerformanceMonitoring() {
        dashboardViewModel.startMonitoring()
    }
    
    private func startAgent(_ agent: Agent) {
        Task {
            do {
                try await appState.apiService.activateAgent(id: agent.id.uuidString)
                await MainActor.run {
                    if let index = appState.availableAgents.firstIndex(where: { $0.id == agent.id }) {
                        appState.availableAgents[index].status = .active
                        appState.availableAgents[index].startTime = Date()
                    }
                    appState.activateAgent(agent)
                }
            } catch {
                print("Failed to start agent: \(error)")
            }
        }
    }
    
    private func stopAgent(_ agent: Agent) {
        Task {
            do {
                try await appState.apiService.deactivateAgent(id: agent.id.uuidString)
                await MainActor.run {
                    if let index = appState.availableAgents.firstIndex(where: { $0.id == agent.id }) {
                        appState.availableAgents[index].status = .idle
                        appState.availableAgents[index].startTime = nil
                    }
                    appState.removeActiveAgent(agent)
                }
            } catch {
                print("Failed to stop agent: \(error)")
            }
        }
    }
}

// MARK: - Agent Card
struct AgentCard: View {
    let agent: Agent
    let isHovered: Bool
    let onTap: () -> Void
    let onStart: () -> Void
    let onStop: () -> Void
    let onConfigure: () -> Void
    
    @State private var performanceData: [AgentPerformancePoint] = []
    @State private var isAnimating = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            cardHeader
                .padding(ArcDesign.Spacing.md)
            
            ArcDivider()
            
            // Content
            cardContent
                .padding(ArcDesign.Spacing.md)
            
            // Performance Chart
            performanceChart
                .frame(height: 60)
                .padding(.horizontal, ArcDesign.Spacing.md)
            
            ArcDivider()
            
            // Controls
            cardControls
                .padding(ArcDesign.Spacing.md)
        }
        .arcGlass(cornerRadius: ArcDesign.Radius.lg)
        .scaleEffect(isHovered ? 1.02 : 1.0)
        .shadow(
            color: agent.type.color.opacity(isHovered ? 0.2 : 0.1),
            radius: isHovered ? 12 : 6,
            x: 0,
            y: isHovered ? 6 : 3
        )
        .animation(ArcDesign.Animation.spring, value: isHovered)
        .onTapGesture(perform: onTap)
        .onAppear {
            generatePerformanceData()
            startStatusAnimation()
        }
    }
    
    // MARK: - Card Header
    private var cardHeader: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            // Agent Type Icon
            ZStack {
                Circle()
                    .fill(agent.type.color.opacity(0.1))
                    .frame(width: 32, height: 32)
                
                Image(systemName: agent.type.icon)
                    .foregroundColor(agent.type.color)
                    .font(.system(size: 16, weight: .medium))
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(agent.name)
                    .font(ArcDesign.Typography.headline)
                    .foregroundColor(ArcDesign.Colors.primaryText)
                    .lineLimit(1)
                
                Text(agent.type.displayName)
                    .font(ArcDesign.Typography.caption)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
            }
            
            Spacer()
            
            // Status Indicator
            statusIndicator
        }
    }
    
    private var statusIndicator: some View {
        HStack(spacing: ArcDesign.Spacing.xs) {
            Circle()
                .fill(agent.status.color)
                .frame(width: 8, height: 8)
                .scaleEffect(isAnimating && agent.status == .active ? 1.2 : 1.0)
                .animation(
                    agent.status == .active
                        ? Animation.easeInOut(duration: 1.0).repeatForever(autoreverses: true)
                        : .default,
                    value: isAnimating
                )
            
            Text(agent.status.displayName)
                .font(ArcDesign.Typography.caption2)
                .foregroundColor(agent.status.color)
                .fontWeight(.medium)
        }
        .padding(.horizontal, ArcDesign.Spacing.xs)
        .padding(.vertical, 2)
        .background(
            Capsule()
                .fill(agent.status.color.opacity(0.1))
        )
    }
    
    // MARK: - Card Content
    private var cardContent: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
            // Description
            Text(agent.description.isEmpty ? "No description available" : agent.description)
                .font(ArcDesign.Typography.callout)
                .foregroundColor(ArcDesign.Colors.secondaryText)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            
            // Current Task
            if let currentTask = agent.currentTask {
                HStack(spacing: ArcDesign.Spacing.xs) {
                    Image(systemName: "gear")
                        .foregroundColor(ArcDesign.Colors.accentBlue)
                        .font(.system(size: 12))
                    
                    Text("Task: \(currentTask)")
                        .font(ArcDesign.Typography.caption)
                        .foregroundColor(ArcDesign.Colors.primaryText)
                        .lineLimit(1)
                }
                .padding(.horizontal, ArcDesign.Spacing.sm)
                .padding(.vertical, ArcDesign.Spacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: ArcDesign.Radius.xs)
                        .fill(ArcDesign.Colors.accentBlue.opacity(0.1))
                )
            }
            
            // Progress Bar
            if agent.progress > 0 {
                VStack(alignment: .leading, spacing: ArcDesign.Spacing.xs) {
                    HStack {
                        Text("Progress")
                            .font(ArcDesign.Typography.caption2)
                            .foregroundColor(ArcDesign.Colors.secondaryText)
                        
                        Spacer()
                        
                        Text("\(Int(agent.progress * 100))%")
                            .font(ArcDesign.Typography.caption2)
                            .foregroundColor(ArcDesign.Colors.primaryText)
                    }
                    
                    ProgressView(value: agent.progress)
                        .progressViewStyle(LinearProgressViewStyle(tint: agent.type.color))
                }
            }
            
            // Capabilities
            if !agent.capabilities.isEmpty {
                capabilitiesView
            }
        }
    }
    
    private var capabilitiesView: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.xs) {
            Text("Capabilities")
                .font(ArcDesign.Typography.caption2)
                .foregroundColor(ArcDesign.Colors.secondaryText)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: ArcDesign.Spacing.xs) {
                ForEach(agent.capabilities.prefix(4), id: \.self) { capability in
                    Text(capability)
                        .font(ArcDesign.Typography.caption2)
                        .foregroundColor(ArcDesign.Colors.primaryText)
                        .padding(.horizontal, ArcDesign.Spacing.xs)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: ArcDesign.Radius.xs)
                                .fill(ArcDesign.Colors.tertiaryBackground)
                        )
                        .lineLimit(1)
                }
            }
            
            if agent.capabilities.count > 4 {
                Text("+\(agent.capabilities.count - 4) more")
                    .font(ArcDesign.Typography.caption2)
                    .foregroundColor(ArcDesign.Colors.tertiaryText)
            }
        }
    }
    
    // MARK: - Performance Chart
    private var performanceChart: some View {
        Chart(performanceData, id: \.timestamp) { point in
            LineMark(
                x: .value("Time", point.timestamp),
                y: .value("Response Time", point.responseTime)
            )
            .foregroundStyle(agent.type.color.gradient)
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartPlotStyle { plotArea in
            plotArea.background(Color.clear)
        }
    }
    
    // MARK: - Card Controls
    private var cardControls: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            // Start/Stop Button
            Button(action: agent.status == .active ? onStop : onStart) {
                Image(systemName: agent.status == .active ? "stop.circle" : "play.circle")
                    .foregroundColor(agent.status == .active ? ArcDesign.Colors.warning : ArcDesign.Colors.success)
            }
            .buttonStyle(PlainButtonStyle())
            .frame(width: 24, height: 24)
            
            Spacer()
            
            // Metrics
            if agent.status == .active {
                HStack(spacing: ArcDesign.Spacing.sm) {
                    metricView(icon: "clock", value: formatUptime(), color: ArcDesign.Colors.info)
                    metricView(icon: "speedometer", value: "125ms", color: ArcDesign.Colors.accentGreen)
                    metricView(icon: "checkmark.circle", value: "98%", color: ArcDesign.Colors.success)
                }
            }
            
            // Configure Button
            Button(action: onConfigure) {
                Image(systemName: "gearshape")
                    .foregroundColor(ArcDesign.Colors.secondaryText)
            }
            .buttonStyle(PlainButtonStyle())
            .frame(width: 24, height: 24)
        }
    }
    
    private func metricView(icon: String, value: String, color: Color) -> some View {
        HStack(spacing: 2) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.system(size: 10))
            
            Text(value)
                .font(ArcDesign.Typography.caption2)
                .foregroundColor(ArcDesign.Colors.primaryText)
        }
    }
    
    private func formatUptime() -> String {
        guard let startTime = agent.startTime else { return "--" }
        let uptime = Date().timeIntervalSince(startTime)
        
        if uptime < 60 {
            return "\(Int(uptime))s"
        } else if uptime < 3600 {
            return "\(Int(uptime / 60))m"
        } else {
            return "\(Int(uptime / 3600))h"
        }
    }
    
    private func generatePerformanceData() {
        let now = Date()
        performanceData = (0..<20).map { i in
            AgentPerformancePoint(
                timestamp: now.addingTimeInterval(-Double(i * 30)),
                responseTime: Double.random(in: 50...200)
            )
        }.reversed()
    }
    
    private func startStatusAnimation() {
        withAnimation(Animation.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
            isAnimating = true
        }
    }
}

// MARK: - Supporting Types

enum AgentFilter: CaseIterable, Hashable {
    case all
    case active
    case idle
    case error
    case type(AgentType)
    
    static var allCases: [AgentFilter] {
        return [.all, .active, .idle, .error]
    }
    
    var displayName: String {
        switch self {
        case .all: return "All"
        case .active: return "Active"
        case .idle: return "Idle"
        case .error: return "Error"
        case .type(let agentType): return agentType.displayName
        }
    }
    
    // Implement Hashable manually to handle associated values
    func hash(into hasher: inout Hasher) {
        switch self {
        case .all:
            hasher.combine(0)
        case .active:
            hasher.combine(1)
        case .idle:
            hasher.combine(2)
        case .error:
            hasher.combine(3)
        case .type(let agentType):
            hasher.combine(4)
            hasher.combine(agentType)
        }
    }
    
    static func == (lhs: AgentFilter, rhs: AgentFilter) -> Bool {
        switch (lhs, rhs) {
        case (.all, .all), (.active, .active), (.idle, .idle), (.error, .error):
            return true
        case (.type(let lhsType), .type(let rhsType)):
            return lhsType == rhsType
        default:
            return false
        }
    }
}

struct AgentPerformancePoint {
    let timestamp: Date
    let responseTime: Double
}

struct AgentWorkflow: Identifiable {
    let id = UUID()
    let name: String
    let status: WorkflowStatus
    let progress: Double
    let agents: [Agent]
    
    enum WorkflowStatus {
        case running
        case paused
        case completed
        case error
        
        var color: Color {
            switch self {
            case .running: return ArcDesign.Colors.success
            case .paused: return ArcDesign.Colors.warning
            case .completed: return ArcDesign.Colors.accentGreen
            case .error: return ArcDesign.Colors.error
            }
        }
    }
}

struct WorkflowNode: Identifiable {
    let id = UUID()
    let agent: Agent
    let position: CGPoint
    var connections: [UUID] = []
}

// MARK: - Drag and Drop
struct WorkflowDropDelegate: DropDelegate {
    let agent: Agent
    @Binding var workflowNodes: [WorkflowNode]
    @Binding var draggedAgent: Agent?
    
    func validateDrop(info: DropInfo) -> Bool {
        return draggedAgent != nil
    }
    
    func performDrop(info: DropInfo) -> Bool {
        guard let draggedAgent = draggedAgent else { return false }
        
        let newNode = WorkflowNode(
            agent: draggedAgent,
            position: CGPoint(x: info.location.x, y: info.location.y)
        )
        
        workflowNodes.append(newNode)
        self.draggedAgent = nil
        
        return true
    }
}

// MARK: - Dashboard View Model
@MainActor
class AgentDashboardViewModel: ObservableObject {
    @Published var activeAgentCount = 0
    @Published var averageResponseTime: Double = 0
    @Published var successRate: Double = 0
    @Published var totalTokens: Int = 0
    @Published var activeWorkflows: [AgentWorkflow] = []
    
    private var monitoringTimer: Timer?
    
    func startMonitoring() {
        monitoringTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateMetrics()
            }
        }
        updateMetrics()
    }
    
    private func updateMetrics() {
        // Simulate performance metrics updates
        activeAgentCount = Int.random(in: 2...8)
        averageResponseTime = Double.random(in: 80...250)
        successRate = Double.random(in: 85...99)
        totalTokens = Int.random(in: 150...500)
        
        // Generate sample workflows
        if activeWorkflows.isEmpty {
            activeWorkflows = [
                AgentWorkflow(
                    name: "Data Processing Pipeline",
                    status: .running,
                    progress: 0.65,
                    agents: []
                ),
                AgentWorkflow(
                    name: "Content Generation Flow",
                    status: .paused,
                    progress: 0.42,
                    agents: []
                ),
                AgentWorkflow(
                    name: "Quality Assurance Check",
                    status: .completed,
                    progress: 1.0,
                    agents: []
                )
            ]
        }
    }
    
    deinit {
        monitoringTimer?.invalidate()
    }
}

// MARK: - Detail Sheets
struct AgentDetailsSheet: View {
    let agent: Agent
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: ArcDesign.Spacing.lg) {
                    // Agent Overview
                    agentOverview
                    
                    // Performance Metrics
                    performanceSection
                    
                    // Configuration
                    configurationSection
                    
                    // Activity Log
                    activityLogSection
                }
                .padding(ArcDesign.Spacing.lg)
            }
            .navigationTitle(agent.name)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .frame(width: 600, height: 500)
    }
    
    private var agentOverview: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.md) {
            Text("Overview")
                .font(ArcDesign.Typography.title3)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            HStack(spacing: ArcDesign.Spacing.lg) {
                // Agent Icon
                ZStack {
                    Circle()
                        .fill(agent.type.color.opacity(0.1))
                        .frame(width: 60, height: 60)
                    
                    Image(systemName: agent.type.icon)
                        .foregroundColor(agent.type.color)
                        .font(.system(size: 24))
                }
                
                VStack(alignment: .leading, spacing: ArcDesign.Spacing.xs) {
                    Text(agent.name)
                        .font(ArcDesign.Typography.title2)
                        .foregroundColor(ArcDesign.Colors.primaryText)
                    
                    Text(agent.type.displayName)
                        .font(ArcDesign.Typography.callout)
                        .foregroundColor(ArcDesign.Colors.secondaryText)
                    
                    HStack {
                        Circle()
                            .fill(agent.status.color)
                            .frame(width: 8, height: 8)
                        
                        Text(agent.status.displayName)
                            .font(ArcDesign.Typography.callout)
                            .foregroundColor(agent.status.color)
                    }
                }
                
                Spacer()
            }
            
            if !agent.description.isEmpty {
                Text(agent.description)
                    .font(ArcDesign.Typography.body)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
            }
        }
        .padding(ArcDesign.Spacing.lg)
        .arcCard()
    }
    
    private var performanceSection: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.md) {
            Text("Performance Metrics")
                .font(ArcDesign.Typography.title3)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: ArcDesign.Spacing.md) {
                metricCard(title: "Response Time", value: "125ms", icon: "speedometer", color: ArcDesign.Colors.accentGreen)
                metricCard(title: "Success Rate", value: "98.5%", icon: "checkmark.circle", color: ArcDesign.Colors.success)
                metricCard(title: "Tokens Used", value: "245k", icon: "text.bubble", color: ArcDesign.Colors.accentPurple)
            }
        }
        .padding(ArcDesign.Spacing.lg)
        .arcCard()
    }
    
    private func metricCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: ArcDesign.Spacing.sm) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.system(size: 20))
            
            Text(value)
                .font(ArcDesign.Typography.headline)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            Text(title)
                .font(ArcDesign.Typography.caption)
                .foregroundColor(ArcDesign.Colors.secondaryText)
        }
        .padding(ArcDesign.Spacing.md)
        .background(ArcDesign.Colors.tertiaryBackground)
        .cornerRadius(ArcDesign.Radius.md)
    }
    
    private var configurationSection: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.md) {
            Text("Configuration")
                .font(ArcDesign.Typography.title3)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
                configRow(label: "Created", value: DateFormatter.shortDate.string(from: agent.createdAt))
                configRow(label: "Last Updated", value: DateFormatter.shortDate.string(from: agent.updatedAt))
                if let startTime = agent.startTime {
                    configRow(label: "Started", value: DateFormatter.shortTime.string(from: startTime))
                }
            }
        }
        .padding(ArcDesign.Spacing.lg)
        .arcCard()
    }
    
    private func configRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(ArcDesign.Typography.callout)
                .foregroundColor(ArcDesign.Colors.secondaryText)
            
            Spacer()
            
            Text(value)
                .font(ArcDesign.Typography.callout)
                .foregroundColor(ArcDesign.Colors.primaryText)
        }
    }
    
    private var activityLogSection: some View {
        VStack(alignment: .leading, spacing: ArcDesign.Spacing.md) {
            Text("Recent Activity")
                .font(ArcDesign.Typography.title3)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            VStack(alignment: .leading, spacing: ArcDesign.Spacing.sm) {
                ForEach(0..<5, id: \.self) { i in
                    activityRow(
                        time: Date().addingTimeInterval(-Double(i * 300)),
                        event: sampleEvents[i % sampleEvents.count]
                    )
                }
            }
        }
        .padding(ArcDesign.Spacing.lg)
        .arcCard()
    }
    
    private func activityRow(time: Date, event: String) -> some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            Circle()
                .fill(ArcDesign.Colors.accentBlue)
                .frame(width: 6, height: 6)
            
            Text(DateFormatter.shortTime.string(from: time))
                .font(ArcDesign.Typography.caption)
                .foregroundColor(ArcDesign.Colors.tertiaryText)
                .frame(width: 60, alignment: .leading)
            
            Text(event)
                .font(ArcDesign.Typography.callout)
                .foregroundColor(ArcDesign.Colors.primaryText)
            
            Spacer()
        }
    }
    
    private let sampleEvents = [
        "Processing request completed",
        "Agent configuration updated",
        "New task assigned",
        "Performance metrics updated",
        "Connection established"
    ]
}

struct WorkflowCreationSheet: View {
    let agents: [Agent]
    @Binding var workflowNodes: [WorkflowNode]
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack {
                Text("Drag agents to create workflow connections")
                    .font(ArcDesign.Typography.callout)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                    .padding()
                
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: ArcDesign.Spacing.md) {
                        ForEach(agents, id: \.id) { agent in
                            AgentWorkflowCard(agent: agent)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Create Workflow")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        // Save workflow
                        dismiss()
                    }
                    .disabled(workflowNodes.isEmpty)
                }
            }
        }
        .frame(width: 600, height: 500)
    }
}

struct AgentWorkflowCard: View {
    let agent: Agent
    
    var body: some View {
        VStack(spacing: ArcDesign.Spacing.sm) {
            Image(systemName: agent.type.icon)
                .foregroundColor(agent.type.color)
                .font(.system(size: 24))
            
            Text(agent.name)
                .font(ArcDesign.Typography.callout)
                .foregroundColor(ArcDesign.Colors.primaryText)
                .lineLimit(1)
        }
        .padding(ArcDesign.Spacing.md)
        .arcCard(padding: ArcDesign.Spacing.md)
        .onDrag {
            NSItemProvider(object: agent.name as NSString)
        }
    }
}

// MARK: - Extensions

extension DateFormatter {
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .none
        return formatter
    }()
    
    static let shortTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()
}

// MARK: - Preview
#if DEBUG
struct ArcAgentDashboard_Previews: PreviewProvider {
    static var previews: some View {
        ArcAgentDashboard()
            .frame(width: 1200, height: 800)
    }
}
#endif