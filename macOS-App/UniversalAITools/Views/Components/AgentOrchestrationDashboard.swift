import SwiftUI
import Combine

/// Comprehensive Agent Orchestration Control Center Dashboard
struct AgentOrchestrationDashboard: View {
    @StateObject private var webSocketService = AgentWebSocketService()
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: OrchestrationTab = .overview
    @State private var showConnectionSettings = false
    @State private var showWorkflowCreator = false
    @State private var showAgentConfigurator = false
    @State private var selectedAgent: OrchestrationAgent?
    @State private var selectedWorkflow: AgentWorkflow?
    @State private var alertMessage: String?
    @State private var showAlert = false
    @State private var isConnecting = false
    @State private var autoRefreshEnabled = true
    @State private var refreshInterval: TimeInterval = 2.0
    
    // Real-time data refresh
    @State private var refreshTimer: Timer?
    
    var body: some View {
        VStack(spacing: 0) {
            // Connection status and dashboard header
            connectionStatusBanner
            
            // Main dashboard header
            dashboardHeader
            
            Divider()
                .background(AppTheme.separator)
            
            // Tab navigation
            tabNavigationBar
            
            Divider()
                .background(AppTheme.separator)
            
            // Main content area
            mainContentArea
            
            // Status footer
            statusFooter
        }
        .background(AnimatedGradientBackground())
        .onAppear {
            setupDashboard()
        }
        .onDisappear {
            cleanupDashboard()
        }
        .onReceive(webSocketService.$connectionStatus) { status in
            handleConnectionStatusChange(status)
        }
        .alert("Orchestration Alert", isPresented: $showAlert) {
            Button("OK") { showAlert = false }
        } message: {
            Text(alertMessage ?? "")
        }
        .sheet(isPresented: $showConnectionSettings) {
            ConnectionSettingsView(webSocketService: webSocketService)
                .frame(minWidth: 400, idealWidth: 500, maxWidth: 600,
                       minHeight: 300, idealHeight: 400, maxHeight: 500)
        }
        .sheet(isPresented: $showWorkflowCreator) {
            WorkflowCreatorView(webSocketService: webSocketService)
                .frame(minWidth: 600, idealWidth: 800, maxWidth: 1000,
                       minHeight: 500, idealHeight: 700, maxHeight: 900)
        }
        .sheet(isPresented: $showAgentConfigurator) {
            if let agent = selectedAgent {
                AgentConfiguratorView(agent: agent, webSocketService: webSocketService)
                    .frame(minWidth: 500, idealWidth: 600, maxWidth: 800,
                           minHeight: 400, idealHeight: 600, maxHeight: 800)
            }
        }
    }
    
    // MARK: - Connection Status Banner
    
    private var connectionStatusBanner: some View {
        HStack {
            ConnectionStatusIndicator(status: webSocketService.connectionStatus)
            
            if webSocketService.connectionStatus == .disconnected || webSocketService.connectionStatus == .failed {
                Spacer()
                Button("Connect") {
                    Task {
                        await webSocketService.connect()
                    }
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.regularMaterial)
        .opacity(webSocketService.isConnected ? 0 : 1)
        .animation(.easeInOut(duration: 0.3), value: webSocketService.isConnected)
    }
    
    // MARK: - Dashboard Header
    
    private var dashboardHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "brain.head.profile")
                        .font(.title2)
                        .foregroundColor(AppTheme.accentOrange)
                        .glow(color: AppTheme.accentOrange, radius: 4)
                    
                    Text("Agent Orchestration Control Center")
                        .font(.title2)
                        .fontWeight(.bold)
                }
                
                HStack(spacing: 12) {
                    ConnectionStatusIndicator(status: webSocketService.connectionStatus)
                    
                    Text("|\(webSocketService.agentNetwork.nodes.count) Agents")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text("|\(webSocketService.activeWorkflows.count) Workflows")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    if let lastError = webSocketService.lastError {
                        Text("| Error: \(lastError)")
                            .font(.caption)
                            .foregroundColor(.red)
                            .lineLimit(1)
                    }
                }
            }
            
            Spacer()
            
            // Control buttons
            HStack(spacing: 12) {
                // Auto-refresh toggle
                Button(action: { autoRefreshEnabled.toggle() }) {
                    Image(systemName: autoRefreshEnabled ? "arrow.clockwise.circle.fill" : "arrow.clockwise.circle")
                        .font(.title3)
                        .foregroundColor(autoRefreshEnabled ? .green : .gray)
                }
                .help("Toggle auto-refresh")
                
                // Connection settings
                Button(action: { showConnectionSettings = true }) {
                    Image(systemName: "gearshape")
                        .font(.title3)
                }
                .help("Connection settings")
                
                // Create workflow
                Button(action: { showWorkflowCreator = true }) {
                    Image(systemName: "plus.circle")
                        .font(.title3)
                }
                .help("Create new workflow")
                
                // Emergency stop
                Button(action: { emergencyStopAllAgents() }) {
                    Image(systemName: "stop.circle.fill")
                        .font(.title3)
                        .foregroundColor(.red)
                }
                .help("Emergency stop all agents")
            }
        }
        .padding()
    }
    
    // MARK: - Tab Navigation
    
    private var tabNavigationBar: some View {
        HStack(spacing: 0) {
            ForEach(OrchestrationTab.allCases, id: \.self) { tab in
                TabButton(
                    tab: tab,
                    isSelected: selectedTab == tab,
                    action: { selectedTab = tab }
                )
            }
            
            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
    
    // MARK: - Main Content Area
    
    private var mainContentArea: some View {
        ZStack {
            switch selectedTab {
            case .overview:
                OverviewTabView(webSocketService: webSocketService)
            case .network:
                AgentNetworkTopology(webSocketService: webSocketService)
            case .decisionTree:
                ABMCTSTreeView(webSocketService: webSocketService)
            case .workflows:
                WorkflowManagementView(
                    webSocketService: webSocketService,
                    selectedWorkflow: $selectedWorkflow,
                    showWorkflowCreator: $showWorkflowCreator
                )
            case .performance:
                PerformanceMonitoringView(webSocketService: webSocketService)
            case .swarm:
                SwarmCoordinationView(webSocketService: webSocketService)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
    }
    
    // MARK: - Status Footer
    
    private var statusFooter: some View {
        HStack {
            // Left side - connection info
            HStack(spacing: 8) {
                Image(systemName: webSocketService.connectionStatus.icon)
                    .foregroundColor(webSocketService.connectionStatus.color)
                
                Text(webSocketService.connectionStatus.rawValue)
                    .font(.caption)
                    .foregroundColor(webSocketService.connectionStatus.color)
                
                if webSocketService.isConnected {
                    Text("• Real-time updates active")
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }
            
            Spacer()
            
            // Right side - performance summary
            HStack(spacing: 16) {
                FooterMetric(
                    label: "Avg Latency",
                    value: "\(webSocketService.agentNetwork.averageLatency, specifier: "%.1f")ms",
                    color: latencyColor
                )
                
                FooterMetric(
                    label: "Network Health",
                    value: "\(webSocketService.agentNetwork.healthScore * 100, specifier: "%.0f")%",
                    color: healthColor
                )
                
                FooterMetric(
                    label: "Active Tasks",
                    value: "\(activeTasks)",
                    color: .blue
                )
                
                Button(action: { connectToService() }) {
                    Text(webSocketService.isConnected ? "Reconnect" : "Connect")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(webSocketService.isConnected ? .orange : .blue)
                        .foregroundColor(.white)
                        .cornerRadius(4)
                }
                .disabled(isConnecting)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
    }
    
    // MARK: - Helper Functions
    
    private func setupDashboard() {
        // Connect to orchestration service
        connectToService()
        
        // Setup auto-refresh timer
        setupAutoRefresh()
        
        // Initialize sample data if needed
        if webSocketService.agentNetwork.nodes.isEmpty {
            loadSampleData()
        }
    }
    
    private func cleanupDashboard() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
    
    private func connectToService() {
        guard !isConnecting else { return }
        
        isConnecting = true
        Task {
            await webSocketService.connect()
            
            await MainActor.run {
                isConnecting = false
                if !webSocketService.isConnected {
                    // Load sample data for demo mode
                    loadSampleData()
                }
            }
        }
    }
    
    private func setupAutoRefresh() {
        refreshTimer?.invalidate()
        
        if autoRefreshEnabled {
            refreshTimer = Timer.scheduledTimer(withTimeInterval: refreshInterval, repeats: true) { _ in
                Task { @MainActor in
                    // Refresh data if connected
                    if webSocketService.isConnected {
                        // The WebSocket service handles real-time updates automatically
                        // This timer is just for fallback or additional polling if needed
                    }
                }
            }
        }
    }
    
    private func handleConnectionStatusChange(_ status: ConnectionStatus) {
        switch status {
        case .connected:
            alertMessage = "Successfully connected to agent orchestration service"
            showAlert = true
        case .failed:
            alertMessage = "Failed to connect to orchestration service. Please check your connection settings."
            showAlert = true
        case .disconnected:
            if webSocketService.lastError != nil {
                alertMessage = "Connection lost: \(webSocketService.lastError ?? "Unknown error")"
                showAlert = true
            }
        default:
            break
        }
    }
    
    private func emergencyStopAllAgents() {
        Task {
            for node in webSocketService.agentNetwork.nodes {
                await webSocketService.sendAgentCommand(node.agentId, command: .stop)
            }
            
            await MainActor.run {
                alertMessage = "Emergency stop sent to all agents"
                showAlert = true
            }
        }
    }
    
    private func loadSampleData() {
        // Create sample agent network for demonstration
        let sampleNodes = [
            AgentNode(
                agentId: "orchestrator-1",
                position: CGPoint(x: 400, y: 200),
                nodeType: .root,
                isRoot: true
            ),
            AgentNode(
                agentId: "coordinator-1",
                position: CGPoint(x: 200, y: 350),
                layer: 1,
                nodeType: .coordinator
            ),
            AgentNode(
                agentId: "coordinator-2",
                position: CGPoint(x: 600, y: 350),
                layer: 1,
                nodeType: .coordinator
            ),
            AgentNode(
                agentId: "worker-1",
                position: CGPoint(x: 100, y: 500),
                layer: 2,
                nodeType: .worker
            ),
            AgentNode(
                agentId: "worker-2",
                position: CGPoint(x: 300, y: 500),
                layer: 2,
                nodeType: .worker
            ),
            AgentNode(
                agentId: "worker-3",
                position: CGPoint(x: 500, y: 500),
                layer: 2,
                nodeType: .worker
            ),
            AgentNode(
                agentId: "worker-4",
                position: CGPoint(x: 700, y: 500),
                layer: 2,
                nodeType: .worker
            )
        ]
        
        let sampleConnections = [
            AgentConnection(fromAgentId: "orchestrator-1", toAgentId: "coordinator-1", strength: 1.0, latency: 5.2),
            AgentConnection(fromAgentId: "orchestrator-1", toAgentId: "coordinator-2", strength: 1.0, latency: 4.8),
            AgentConnection(fromAgentId: "coordinator-1", toAgentId: "worker-1", strength: 0.8, latency: 12.3),
            AgentConnection(fromAgentId: "coordinator-1", toAgentId: "worker-2", strength: 0.9, latency: 8.7),
            AgentConnection(fromAgentId: "coordinator-2", toAgentId: "worker-3", strength: 0.7, latency: 15.1),
            AgentConnection(fromAgentId: "coordinator-2", toAgentId: "worker-4", strength: 0.9, latency: 9.2)
        ]
        
        let sampleNetwork = AgentNetwork(
            nodes: sampleNodes,
            connections: sampleConnections,
            topology: .hierarchical,
            healthScore: 0.85
        )
        
        webSocketService.agentNetwork = sampleNetwork
        
        // Add sample performance metrics
        webSocketService.agentPerformanceMetrics = [
            "orchestrator-1": AgentPerformanceMetric(latency: 5.0, successRate: 0.98, throughput: 150.0),
            "coordinator-1": AgentPerformanceMetric(latency: 8.2, successRate: 0.95, throughput: 85.0),
            "coordinator-2": AgentPerformanceMetric(latency: 7.1, successRate: 0.97, throughput: 92.0),
            "worker-1": AgentPerformanceMetric(latency: 12.5, successRate: 0.89, throughput: 45.0),
            "worker-2": AgentPerformanceMetric(latency: 15.2, successRate: 0.91, throughput: 38.0),
            "worker-3": AgentPerformanceMetric(latency: 11.8, successRate: 0.93, throughput: 52.0),
            "worker-4": AgentPerformanceMetric(latency: 9.7, successRate: 0.96, throughput: 58.0)
        ]
        
        // Add sample workflows
        webSocketService.activeWorkflows = [
            AgentWorkflow(
                name: "Data Processing Pipeline",
                steps: [
                    WorkflowStep(name: "Data Ingestion", agentId: "worker-1", action: AgentAction(type: .executeTask), order: 1),
                    WorkflowStep(name: "Data Validation", agentId: "worker-2", action: AgentAction(type: .executeTask), order: 2),
                    WorkflowStep(name: "Data Analysis", agentId: "worker-3", action: AgentAction(type: .executeTask), order: 3)
                ],
                executionState: .running,
                priority: .high
            ),
            AgentWorkflow(
                name: "Model Training",
                steps: [
                    WorkflowStep(name: "Feature Engineering", agentId: "worker-4", action: AgentAction(type: .executeTask), order: 1),
                    WorkflowStep(name: "Model Training", agentId: "coordinator-1", action: AgentAction(type: .executeTask), order: 2)
                ],
                executionState: .pending,
                priority: .normal
            )
        ]
    }
    
    // MARK: - Computed Properties
    
    private var latencyColor: Color {
        let avgLatency = webSocketService.agentNetwork.averageLatency
        if avgLatency < 10 {
            return .green
        } else if avgLatency < 50 {
            return .yellow
        } else {
            return .red
        }
    }
    
    private var healthColor: Color {
        let health = webSocketService.agentNetwork.healthScore
        if health > 0.8 {
            return .green
        } else if health > 0.5 {
            return .yellow
        } else {
            return .red
        }
    }
    
    private var activeTasks: Int {
        webSocketService.activeWorkflows.reduce(0) { result, workflow in
            result + workflow.steps.filter { $0.status == .running }.count
        }
    }
}

// MARK: - Supporting Types

enum OrchestrationTab: String, CaseIterable {
    case overview = "Overview"
    case network = "Network"
    case decisionTree = "Decision Tree"
    case workflows = "Workflows"
    case performance = "Performance"
    case swarm = "Swarm"
    
    var icon: String {
        switch self {
        case .overview: return "rectangle.3.group"
        case .network: return "network"
        case .decisionTree: return "tree"
        case .workflows: return "arrow.triangle.branch"
        case .performance: return "chart.line.uptrend.xyaxis"
        case .swarm: return "hexagon.fill"
        }
    }
}

// MARK: - Tab Button

struct TabButton: View {
    let tab: OrchestrationTab
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: tab.icon)
                    .font(.system(size: 14, weight: .medium))
                
                Text(tab.rawValue)
                    .font(.system(size: 14, weight: .medium))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? AppTheme.accentOrange.opacity(0.2) : Color.clear)
            )
            .foregroundColor(isSelected ? AppTheme.accentOrange : .secondary)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? AppTheme.accentOrange : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

// MARK: - Footer Metric

struct FooterMetric: View {
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .center, spacing: 2) {
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

// MARK: - Overview Tab View

struct OverviewTabView: View {
    @ObservedObject var webSocketService: AgentWebSocketService
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Quick stats cards
                quickStatsSection
                
                // Recent activity
                recentActivitySection
                
                // Network topology preview
                networkTopologyPreview
                
                // Active workflows preview
                activeWorkflowsPreview
            }
            .padding()
        }
    }
    
    private var quickStatsSection: some View {
        HStack(spacing: 16) {
            QuickStatCard(
                title: "Active Agents",
                value: "\(webSocketService.agentNetwork.nodes.count)",
                icon: "brain.head.profile",
                color: .blue
            )
            
            QuickStatCard(
                title: "Network Health",
                value: "\(webSocketService.agentNetwork.healthScore * 100, specifier: "%.0f")%",
                icon: "heart.fill",
                color: .green
            )
            
            QuickStatCard(
                title: "Active Workflows",
                value: "\(webSocketService.activeWorkflows.filter { $0.executionState == .running }.count)",
                icon: "arrow.triangle.branch",
                color: .orange
            )
            
            QuickStatCard(
                title: "Avg Latency",
                value: "\(webSocketService.agentNetwork.averageLatency, specifier: "%.1f")ms",
                icon: "speedometer",
                color: .purple
            )
        }
    }
    
    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                ForEach(webSocketService.realtimeAgentUpdates.prefix(5)) { update in
                    ActivityRow(update: update)
                }
                
                if webSocketService.realtimeAgentUpdates.isEmpty {
                    Text("No recent activity")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                }
            }
            .padding()
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
    }
    
    private var networkTopologyPreview: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Network Topology")
                .font(.headline)
                .fontWeight(.semibold)
            
            // Mini network visualization
            MiniNetworkView(network: webSocketService.agentNetwork)
                .frame(height: 200)
                .background(.ultraThinMaterial)
                .cornerRadius(12)
        }
    }
    
    private var activeWorkflowsPreview: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Active Workflows")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                ForEach(webSocketService.activeWorkflows.prefix(3)) { workflow in
                    WorkflowSummaryRow(workflow: workflow)
                }
                
                if webSocketService.activeWorkflows.isEmpty {
                    Text("No active workflows")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                }
            }
            .padding()
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
    }
}

// MARK: - Supporting Components

struct QuickStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}


struct MiniNetworkView: View {
    let network: AgentNetwork
    
    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let radius = min(size.width, size.height) / 3
            
            // Draw connections
            for connection in network.connections {
                if let fromNode = network.nodes.first(where: { $0.agentId == connection.fromAgentId }),
                   let toNode = network.nodes.first(where: { $0.agentId == connection.toAgentId }) {
                    
                    let fromAngle = Double(fromNode.layer) * 2 * .pi / 4
                    let toAngle = Double(toNode.layer) * 2 * .pi / 4
                    
                    let fromPos = CGPoint(
                        x: center.x + radius * cos(fromAngle),
                        y: center.y + radius * sin(fromAngle)
                    )
                    let toPos = CGPoint(
                        x: center.x + radius * cos(toAngle),
                        y: center.y + radius * sin(toAngle)
                    )
                    
                    let path = Path { path in
                        path.move(to: fromPos)
                        path.addLine(to: toPos)
                    }
                    
                    context.stroke(path, with: .color(.blue.opacity(0.3)), lineWidth: 1)
                }
            }
            
            // Draw nodes
            for (index, node) in network.nodes.enumerated() {
                let angle = Double(index) * 2 * .pi / Double(network.nodes.count)
                let nodePos = CGPoint(
                    x: center.x + radius * cos(angle),
                    y: center.y + radius * sin(angle)
                )
                
                let nodeCircle = Path { path in
                    path.addEllipse(in: CGRect(
                        x: nodePos.x - 8,
                        y: nodePos.y - 8,
                        width: 16,
                        height: 16
                    ))
                }
                
                context.fill(nodeCircle, with: .color(node.nodeType.color))
            }
        }
    }
}

struct WorkflowSummaryRow: View {
    let workflow: AgentWorkflow
    
    var body: some View {
        HStack {
            Image(systemName: "arrow.triangle.branch")
                .foregroundColor(workflow.priority.color)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(workflow.name)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text("\(workflow.executionState.rawValue) • \(workflow.steps.count) steps")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text("\(workflow.progressPercentage, specifier: "%.0f")%")
                .font(.caption2)
                .fontDesign(.monospaced)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    AgentOrchestrationDashboard()
        .environmentObject(AppState.init())
        .frame(width: 1200, height: 800)
}