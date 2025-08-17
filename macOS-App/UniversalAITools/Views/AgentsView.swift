import SwiftUI
import Combine

struct AgentsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @State private var selectedCategory = "All"
    @State private var searchText = ""
    @State private var showingCreateAgent = false
    
    // Enhanced orchestration state
    @State private var orchestrationStatus: AgentOrchestrationStatus?
    @State private var networkTopology: NetworkTopology?
    @State private var agentMetrics: AgentMetricsResponse?
    @State private var activeTasks: [AgentTask] = []
    @State private var resourceUsage: ResourceUsageResponse?
    @State private var isLoading = false
    @State private var lastError: APIError?
    @State private var selectedTab = 0
    @State private var autoRefresh = true
    @State private var refreshTimer: Timer?
    @State private var wsConnectionId: String?
    @State private var showingNetworkTopology = false
    @State private var showingMetricsDetail = false
    @State private var showingTaskManager = false
    @State private var showingOrchestrationPanel = false
    
    @StateObject private var cancellables = CancellableContainer()

    private let categories = ["All", "Research", "Memory", "Orchestration", "Specialized"]
    private let tabTitles = ["Agents", "Network", "Tasks", "Metrics", "Resources"]

    private var filteredAgents: [Agent] {
        let categoryFiltered = selectedCategory == "All"
            ? appState.availableAgents
            : appState.availableAgents.filter { $0.type.rawValue == selectedCategory.lowercased() }

        if searchText.isEmpty {
            return categoryFiltered
        } else {
            return categoryFiltered.filter {
                $0.name.localizedCaseInsensitiveContains(searchText)
                || $0.description.localizedCaseInsensitiveContains(searchText)
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Enhanced Header with Real-time Stats
            EnhancedAgentsHeaderView(
                showingCreateAgent: $showingCreateAgent,
                orchestrationStatus: orchestrationStatus,
                autoRefresh: $autoRefresh,
                onRefresh: loadOrchestrationData,
                onToggleNetworkView: { showingNetworkTopology.toggle() },
                onToggleOrchestration: { showingOrchestrationPanel.toggle() }
            )

            Divider()

            // Tab Selector
            Picker("View", selection: $selectedTab) {
                ForEach(0..<tabTitles.count, id: \.self) { index in
                    Text(tabTitles[index]).tag(index)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)

            Divider()

            // Content based on selected tab
            Group {
                switch selectedTab {
                case 0:
                    agentsGridView
                case 1:
                    networkTopologyView
                case 2:
                    tasksView
                case 3:
                    metricsView
                case 4:
                    resourcesView
                default:
                    agentsGridView
                }
            }
        }
        .background(Color(.windowBackgroundColor))
        .sheet(isPresented: $showingCreateAgent) {
            CreateAgentView()
                .environmentObject(appState)
                .environmentObject(apiService)
        }
        .sheet(isPresented: $showingNetworkTopology) {
            NetworkTopologySheet(topology: networkTopology)
        }
        .sheet(isPresented: $showingTaskManager) {
            AgentTaskManagerSheet(
                tasks: activeTasks,
                onCreateTask: createAgentTask,
                onRefresh: loadAgentTasks
            )
        }
        .sheet(isPresented: $showingOrchestrationPanel) {
            AgentOrchestrationPanel(
                orchestrationStatus: orchestrationStatus,
                onOrchestrate: orchestrateAgents,
                onCollaborate: requestCollaboration
            )
        }
        .onAppear {
            loadOrchestrationData()
            setupWebSocketConnection()
            startAutoRefresh()
        }
        .onDisappear {
            stopAutoRefresh()
            disconnectWebSocket()
        }
        .alert("Error", isPresented: .constant(lastError != nil)) {
            Button("OK") { lastError = nil }
        } message: {
            if let error = lastError {
                Text(error.localizedDescription)
            }
        }
    }

    // MARK: - Agent Grid View
    private var agentsGridView: some View {
        VStack(spacing: 0) {
            // Filters and Search
            FiltersAndSearchView(
                categories: categories,
                selectedCategory: $selectedCategory,
                searchText: $searchText
            )

            Divider()

            // Enhanced Agents Grid
            ScrollView {
                LazyVGrid(columns: gridColumns, spacing: 20) {
                    ForEach(filteredAgents) { agent in
                        EnhancedAgentCard(
                            agent: agent,
                            orchestrationStatus: orchestrationStatus
                        )
                        .environmentObject(appState)
                        .environmentObject(apiService)
                    }
                }
                .padding()
            }
        }
    }
    
    // MARK: - Network Topology View
    private var networkTopologyView: some View {
        VStack {
            if let topology = networkTopology {
                NetworkTopologyView(topology: topology)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ProgressView("Loading network topology...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    // MARK: - Tasks View
    private var tasksView: some View {
        VStack {
            HStack {
                Text("Agent Tasks")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("Task Manager") {
                    showingTaskManager = true
                }
                .buttonStyle(.bordered)
            }
            .padding()
            
            if activeTasks.isEmpty {
                VStack {
                    Image(systemName: "list.bullet.clipboard")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("No active tasks")
                        .font(.title2)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(activeTasks) { task in
                    AgentTaskRow(task: task)
                }
            }
        }
    }
    
    // MARK: - Metrics View
    private var metricsView: some View {
        VStack {
            if let metrics = agentMetrics {
                AgentMetricsView(metricsResponse: metrics)
            } else {
                ProgressView("Loading metrics...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    // MARK: - Resources View
    private var resourcesView: some View {
        VStack {
            if let resources = resourceUsage {
                AgentResourcesView(resourcesResponse: resources)
            } else {
                ProgressView("Loading resource usage...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    private var gridColumns: [GridItem] {
        [
            GridItem(.adaptive(minimum: 280, maximum: 320), spacing: 20)
        ]
    }
    
    // MARK: - Data Loading Functions
    
    private func loadOrchestrationData() {
        isLoading = true
        
        Task {
            do {
                // Load all orchestration data in parallel
                async let statusTask = apiService.getOrchestrationStatus()
                async let topologyTask = apiService.getOrchestrationTopology()
                async let metricsTask = apiService.getOrchestrationMetrics()
                async let tasksTask = apiService.getAgentTasks(limit: 50)
                async let resourcesTask = apiService.getAgentResources()
                
                let (status, topology, metrics, tasks, resources) = try await (
                    statusTask, topologyTask, metricsTask, tasksTask, resourcesTask
                )
                
                await MainActor.run {
                    self.orchestrationStatus = status
                    self.networkTopology = topology
                    self.agentMetrics = metrics
                    self.activeTasks = tasks.data.tasks
                    self.resourceUsage = resources
                    self.isLoading = false
                    self.lastError = nil
                }
            } catch {
                await MainActor.run {
                    self.isLoading = false
                    if let apiError = error as? APIError {
                        self.lastError = apiError
                    } else {
                        self.lastError = APIError.networkError(error)
                    }
                }
            }
        }
    }
    
    private func loadAgentTasks() {
        Task {
            do {
                let tasks = try await apiService.getAgentTasks(limit: 100)
                await MainActor.run {
                    self.activeTasks = tasks.data.tasks
                }
            } catch {
                print("Failed to load tasks: \(error)")
            }
        }
    }
    
    private func createAgentTask(agentName: String, type: String, context: [String: Any]) {
        Task {
            do {
                _ = try await apiService.createAgentTask(
                    agentName: agentName,
                    type: type,
                    context: context
                )
                // Refresh tasks after creation
                loadAgentTasks()
            } catch {
                await MainActor.run {
                    if let apiError = error as? APIError {
                        self.lastError = apiError
                    }
                }
            }
        }
    }
    
    private func orchestrateAgents(primaryAgent: String, supportingAgents: [String], context: [String: Any]) {
        Task {
            do {
                _ = try await apiService.orchestrateAgents(
                    primaryAgent: primaryAgent,
                    supportingAgents: supportingAgents,
                    context: context
                )
                // Refresh data after orchestration
                loadOrchestrationData()
            } catch {
                await MainActor.run {
                    if let apiError = error as? APIError {
                        self.lastError = apiError
                    }
                }
            }
        }
    }
    
    private func requestCollaboration(task: String, capabilities: [String]) {
        Task {
            do {
                _ = try await apiService.requestAgentCollaboration(
                    task: task,
                    requiredCapabilities: capabilities
                )
                // Refresh data after collaboration request
                loadOrchestrationData()
            } catch {
                await MainActor.run {
                    if let apiError = error as? APIError {
                        self.lastError = apiError
                    }
                }
            }
        }
    }
    
    // MARK: - WebSocket and Real-time Updates
    
    private func setupWebSocketConnection() {
        Task {
            do {
                let connectionId = try await apiService.connectOrchestrationWebSocket()
                await MainActor.run {
                    self.wsConnectionId = connectionId
                    self.subscribeToOrchestrationEvents(connectionId: connectionId)
                }
            } catch {
                print("Failed to connect to orchestration WebSocket: \(error)")
            }
        }
    }
    
    private func subscribeToOrchestrationEvents(connectionId: String) {
        apiService.subscribeToOrchestrationEvents(connectionId: connectionId)
            .receive(on: DispatchQueue.main)
            .sink { message in
                handleOrchestrationEvent(message)
            }
            .store(in: &cancellables.cancellables)
    }
    
    private func handleOrchestrationEvent(_ message: [String: Any]) {
        guard let type = message["type"] as? String else { return }
        
        switch type {
        case "periodic_update":
            // Refresh data on periodic updates
            if autoRefresh {
                loadOrchestrationData()
            }
        case "task_created", "task_completed", "task_failed":
            // Refresh tasks on task events
            loadAgentTasks()
        case "agent_loaded", "agent_unloaded":
            // Refresh status on agent state changes
            loadOrchestrationData()
        default:
            break
        }
    }
    
    private func disconnectWebSocket() {
        if let connectionId = wsConnectionId {
            Task {
                await EnhancedWebSocketManager.shared.disconnect(connectionId)
            }
        }
    }
    
    // MARK: - Auto-refresh
    
    private func startAutoRefresh() {
        guard autoRefresh else { return }
        
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            if autoRefresh {
                loadOrchestrationData()
            }
        }
    }
    
    private func stopAutoRefresh() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
}

// MARK: - Enhanced UI Components

/// Enhanced header with real-time orchestration stats
private struct EnhancedAgentsHeaderView: View {
    @Binding var showingCreateAgent: Bool
    let orchestrationStatus: AgentOrchestrationStatus?
    @Binding var autoRefresh: Bool
    let onRefresh: () -> Void
    let onToggleNetworkView: () -> Void
    let onToggleOrchestration: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // Main header row
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("AI Agent Orchestration")
                        .font(.title2)
                        .fontWeight(.semibold)

                    Text("Monitor, manage, and orchestrate your AI agents")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()
                
                // Control buttons
                HStack(spacing: 12) {
                    Toggle("Auto-refresh", isOn: $autoRefresh)
                        .toggleStyle(.switch)
                        .controlSize(.mini)
                    
                    Button(action: onRefresh) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    
                    Button("Network") {
                        onToggleNetworkView()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    
                    Button("Orchestrate") {
                        onToggleOrchestration()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)

                    Button(action: { showingCreateAgent = true }) {
                        HStack(spacing: 6) {
                            Image(systemName: "plus.circle.fill")
                            Text("Create Agent")
                                .fontWeight(.medium)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            
            // Real-time stats bar
            if let status = orchestrationStatus {
                RealTimeStatsBar(orchestrationStatus: status)
            }
        }
        .padding()
    }
}

/// Real-time stats bar showing orchestration metrics
private struct RealTimeStatsBar: View {
    let orchestrationStatus: AgentOrchestrationStatus
    
    var body: some View {
        HStack(spacing: 20) {
            StatItem(
                title: "Total Agents",
                value: "\(orchestrationStatus.data.summary.totalAgents)",
                color: .blue
            )
            
            StatItem(
                title: "Online",
                value: "\(orchestrationStatus.data.summary.onlineAgents)",
                color: .green
            )
            
            StatItem(
                title: "Busy",
                value: "\(orchestrationStatus.data.summary.busyAgents)",
                color: .orange
            )
            
            StatItem(
                title: "Collaborations",
                value: "\(orchestrationStatus.data.summary.totalCollaborations)",
                color: .purple
            )
            
            Spacer()
            
            // Mesh health indicator
            HStack(spacing: 6) {
                Circle()
                    .fill(meshHealthColor)
                    .frame(width: 8, height: 8)
                Text("Mesh Health: \(Int(orchestrationStatus.data.summary.meshHealth * 100))%")
                    .font(.caption)
                    .fontWeight(.medium)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.controlBackgroundColor))
        )
    }
    
    private var meshHealthColor: Color {
        let health = orchestrationStatus.data.summary.meshHealth
        if health > 0.8 {
            return .green
        } else if health > 0.5 {
            return .orange
        } else {
            return .red
        }
    }
}

/// Individual stat item for the stats bar
private struct StatItem: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

/// Enhanced agent card with orchestration data
private struct EnhancedAgentCard: View {
    let agent: Agent
    let orchestrationStatus: AgentOrchestrationStatus?
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @State private var showingDetails = false
    
    private var agentStatus: AgentStatus? {
        orchestrationStatus?.data.agents.first { $0.name == agent.name }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header with real-time status
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(agent.name)
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text(agent.type.displayName)
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

                // Enhanced status indicators
                VStack(spacing: 4) {
                    HStack(spacing: 4) {
                        // Status indicator
                        Circle()
                            .fill(statusColor)
                            .frame(width: 10, height: 10)
                        
                        Text(agentStatus?.status ?? agent.status.displayName)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    
                    if let status = agentStatus, status.queueLength > 0 {
                        Text("Queue: \(status.queueLength)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Description
            Text(agent.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(3)

            // Enhanced metrics if available
            if let status = agentStatus {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Performance")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("Trust: \(Int(status.trustLevel * 100))%")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    
                    if let metrics = status.metrics {
                        HStack(spacing: 16) {
                            MetricItem(
                                label: "Requests",
                                value: "\(metrics.totalRequests)",
                                color: .blue
                            )
                            MetricItem(
                                label: "Success",
                                value: "\(Int(metrics.successRate * 100))%",
                                color: .green
                            )
                            MetricItem(
                                label: "CPU",
                                value: "\(Int(metrics.cpuUsage))%",
                                color: .orange
                            )
                        }
                    }
                }
            }

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

            // Enhanced actions
            HStack(spacing: 12) {
                Button(action: { activateAgent() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "play.circle.fill")
                        Text("Activate")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.green)
                    )
                    .foregroundColor(.white)
                }
                .buttonStyle(.plain)
                .disabled(agentStatus?.status == "busy")

                Button(action: { showingDetails = true }) {
                    HStack(spacing: 4) {
                        Image(systemName: "info.circle")
                        Text("Details")
                    }
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(.controlBackgroundColor))
                    )
                    .foregroundColor(.primary)
                }
                .buttonStyle(.plain)

                Spacer()
                
                // Collaboration score
                if let status = agentStatus, status.collaborationScore > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "person.2.fill")
                            .font(.caption2)
                        Text("\(Int(status.collaborationScore))")
                            .font(.caption2)
                    }
                    .foregroundColor(.purple)
                }
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
            EnhancedAgentDetailView(agent: agent, agentStatus: agentStatus)
                .environmentObject(appState)
                .environmentObject(apiService)
        }
    }

    private var statusColor: Color {
        if let status = agentStatus {
            switch status.status {
            case "online": return .green
            case "busy": return .orange
            case "offline": return .gray
            default: return agent.status.color
            }
        }
        return agent.status.color
    }

    private var capabilityColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 60, maximum: 80))]
    }

    private func activateAgent() {
        Task {
            do {
                try await apiService.activateAgent(id: agent.id.uuidString)
                await MainActor.run { appState.activateAgent(agent) }
            } catch {
                await MainActor.run {
                    appState.showNotification(
                        message: "Failed to activate agent: \(error.localizedDescription)",
                        type: .error
                    )
                }
            }
        }
    }
}

/// Small metric item for agent cards
private struct MetricItem: View {
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(color)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

private struct FiltersAndSearchView: View {
    let categories: [String]
    @Binding var selectedCategory: String
    @Binding var searchText: String

    var body: some View {
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
                    Button(
                        action: { searchText = "" },
                        label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    )
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
}

// MARK: - Supporting View Components

/// Network topology visualization view
private struct NetworkTopologyView: View {
    let topology: NetworkTopology
    
    var body: some View {
        VStack {
            Text("Network Topology")
                .font(.headline)
                .padding()
            
            ScrollView([.horizontal, .vertical]) {
                VStack(spacing: 20) {
                    Text("Nodes: \(topology.nodes.count)")
                    Text("Connections: \(topology.edges.count)")
                    
                    // Simple visualization - in a real implementation, you'd use a graph library
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 20) {
                        ForEach(topology.nodes) { node in
                            VStack {
                                Circle()
                                    .fill(nodeColor(for: node.status))
                                    .frame(width: 40, height: 40)
                                    .overlay(
                                        Text(String(node.name.prefix(2)))
                                            .font(.caption)
                                            .fontWeight(.bold)
                                            .foregroundColor(.white)
                                    )
                                
                                Text(node.name)
                                    .font(.caption)
                                    .multilineTextAlignment(.center)
                            }
                        }
                    }
                }
                .padding()
            }
        }
    }
    
    private func nodeColor(for status: String) -> Color {
        switch status {
        case "online": return .green
        case "busy": return .orange
        case "offline": return .gray
        default: return .blue
        }
    }
}

/// Agent metrics view
private struct AgentMetricsView: View {
    let metricsResponse: AgentMetricsResponse
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Agent Metrics")
                .font(.headline)
                .padding(.horizontal)
            
            // Aggregate metrics
            HStack(spacing: 20) {
                MetricCard(
                    title: "Total Requests",
                    value: "\(metricsResponse.data.aggregates.totalRequests)",
                    color: .blue
                )
                MetricCard(
                    title: "Avg Response Time",
                    value: String(format: "%.1fms", metricsResponse.data.aggregates.averageResponseTime),
                    color: .green
                )
                MetricCard(
                    title: "Success Rate",
                    value: String(format: "%.1f%%", metricsResponse.data.aggregates.averageSuccessRate * 100),
                    color: .purple
                )
                MetricCard(
                    title: "Active Agents",
                    value: "\(metricsResponse.data.aggregates.totalActiveAgents)",
                    color: .orange
                )
            }
            .padding(.horizontal)
            
            // Individual agent metrics
            List(metricsResponse.data.metrics, id: \.agentName) { metric in
                AgentMetricRow(metric: metric)
            }
        }
    }
}

private struct MetricCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.controlBackgroundColor))
        )
    }
}

private struct AgentMetricRow: View {
    let metric: AgentMetrics
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(metric.agentName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text("Last active: \(metric.lastActive)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(metric.totalRequests) requests")
                    .font(.caption)
                
                Text("\(Int(metric.successRate * 100))% success")
                    .font(.caption)
                    .foregroundColor(metric.successRate > 0.9 ? .green : .orange)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Agent resources view
private struct AgentResourcesView: View {
    let resourcesResponse: ResourceUsageResponse
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Resource Usage")
                .font(.headline)
                .padding(.horizontal)
            
            // System overview
            HStack(spacing: 20) {
                ResourceCard(
                    title: "Total CPU",
                    value: String(format: "%.1f%%", resourcesResponse.data.systemResources.averageCpuUsage),
                    color: .red
                )
                ResourceCard(
                    title: "Total Memory",
                    value: String(format: "%.1f%%", resourcesResponse.data.systemResources.averageMemoryUsage),
                    color: .blue
                )
                ResourceCard(
                    title: "Queue Length",
                    value: "\(resourcesResponse.data.systemResources.totalQueueLength)",
                    color: .orange
                )
            }
            .padding(.horizontal)
            
            // Individual agent resources
            List(resourcesResponse.data.resources, id: \.agentName) { resource in
                AgentResourceRow(resource: resource)
            }
        }
    }
}

private struct ResourceCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.controlBackgroundColor))
        )
    }
}

private struct AgentResourceRow: View {
    let resource: AgentResource
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(resource.agentName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(resource.status.capitalized)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 16) {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("CPU")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(String(format: "%.1f%%", resource.cpuUsage))
                        .font(.caption)
                        .fontWeight(.medium)
                }
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Memory")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(String(format: "%.1f%%", resource.memoryUsage))
                        .font(.caption)
                        .fontWeight(.medium)
                }
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Queue")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text("\(resource.queueLength)")
                        .font(.caption)
                        .fontWeight(.medium)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// Agent task row
private struct AgentTaskRow: View {
    let task: AgentTask
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(task.agentName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(task.type)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(task.status.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(taskStatusColor(task.status))
                    )
                    .foregroundColor(.white)
                
                if let startTime = task.startTime {
                    Text(startTime)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
    
    private func taskStatusColor(_ status: String) -> Color {
        switch status {
        case "completed": return .green
        case "failed": return .red
        case "running": return .blue
        case "pending": return .orange
        default: return .gray
        }
    }
}

// MARK: - Sheet Views (Stubs for now)

private struct NetworkTopologySheet: View {
    let topology: NetworkTopology?
    
    var body: some View {
        NavigationView {
            VStack {
                if let topology = topology {
                    NetworkTopologyView(topology: topology)
                } else {
                    Text("No topology data available")
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Network Topology")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        // Dismiss
                    }
                }
            }
        }
        .frame(width: 800, height: 600)
    }
}

private struct AgentTaskManagerSheet: View {
    let tasks: [AgentTask]
    let onCreateTask: (String, String, [String: Any]) -> Void
    let onRefresh: () -> Void
    
    var body: some View {
        NavigationView {
            VStack {
                Text("Task Manager")
                    .font(.title)
                    .padding()
                
                Text("Task management interface coming soon...")
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            .navigationTitle("Agent Tasks")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        // Dismiss
                    }
                }
            }
        }
        .frame(width: 600, height: 500)
    }
}

private struct AgentOrchestrationPanel: View {
    let orchestrationStatus: AgentOrchestrationStatus?
    let onOrchestrate: (String, [String], [String: Any]) -> Void
    let onCollaborate: (String, [String]) -> Void
    
    var body: some View {
        NavigationView {
            VStack {
                Text("Agent Orchestration")
                    .font(.title)
                    .padding()
                
                Text("Orchestration panel coming soon...")
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            .navigationTitle("Orchestration")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        // Dismiss
                    }
                }
            }
        }
        .frame(width: 600, height: 500)
    }
}

private struct EnhancedAgentDetailView: View {
    let agent: Agent
    let agentStatus: AgentStatus?
    
    var body: some View {
        NavigationView {
            VStack {
                Text("Enhanced Agent Details")
                    .font(.title)
                    .padding()
                
                Text("Detailed agent view coming soon...")
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            .navigationTitle(agent.name)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        // Dismiss
                    }
                }
            }
        }
        .frame(width: 600, height: 500)
    }
}

// MARK: - Legacy Components (kept for compatibility)

struct CreateAgentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss

    @State private var agentName = ""
    @State private var agentDescription = ""
    @State private var selectedCategory = "chat"
    @State private var capabilities: [String] = [""]

    private let categories = ["chat", "research", "coding", "analysis", "orchestration", "monitoring"]

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
                                Text(category.capitalized).tag(category)
                            }
                        }
                    }

                    Section("Capabilities") {
                        ForEach(capabilities.indices, id: \.self) { index in
                            HStack {
                                TextField("Capability", text: $capabilities[index])

                                if capabilities.count > 1 {
                                    Button(
                                        action: { removeCapability(at: index) },
                                        label: {
                                            Image(systemName: "minus.circle.fill")
                                                .foregroundColor(.red)
                                        }
                                    )
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
        let agentType = AgentType(rawValue: selectedCategory) ?? .chat
        let newAgent = Agent(
            name: agentName,
            type: agentType,
            description: agentDescription,
            capabilities: capabilities.filter { !$0.isEmpty }
        )

        appState.availableAgents.append(newAgent)
        dismiss()
    }
}

// MARK: - Supporting Classes

class CancellableContainer: ObservableObject {
    var cancellables = Set<AnyCancellable>()
}

#Preview {
    AgentsView()
        .environmentObject(AppState())
        .environmentObject(APIService.shared)
}
