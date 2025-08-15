import SwiftUI

/// Swarm Coordination and Multi-Agent Consensus View
struct SwarmCoordinationView: View {
    @ObservedObject var webSocketService: AgentWebSocketService
    @State private var selectedRule: CoordinationRule?
    @State private var selectedProtocol: CommunicationProtocol?
    @State private var showRuleEditor = false
    @State private var showProtocolEditor = false
    @State private var showConsensusDetails = false
    @State private var consensusThreshold: Double = 0.67
    @State private var emergencyMode = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            swarmHeader
            
            Divider()
            
            HSplitView {
                // Left panel - Configuration
                VStack(spacing: 0) {
                    configurationPanel
                }
                .frame(minWidth: 350, maxWidth: 400)
                
                Divider()
                
                // Center panel - Coordination visualization
                VStack(spacing: 0) {
                    coordinationVisualization
                }
                .frame(minWidth: 400)
                
                Divider()
                
                // Right panel - Consensus and metrics
                VStack(spacing: 0) {
                    consensusPanel
                }
                .frame(minWidth: 300, maxWidth: 350)
            }
        }
        .sheet(isPresented: $showRuleEditor) {
            CoordinationRuleEditor(
                rule: selectedRule,
                webSocketService: webSocketService
            )
            .frame(minWidth: 500, idealWidth: 600, maxWidth: 700,
                   minHeight: 400, idealHeight: 500, maxHeight: 600)
        }
        .sheet(isPresented: $showProtocolEditor) {
            CommunicationProtocolEditor(
                communicationProtocol: selectedProtocol,
                webSocketService: webSocketService
            )
            .frame(minWidth: 500, idealWidth: 600, maxWidth: 700,
                   minHeight: 400, idealHeight: 500, maxHeight: 600)
        }
        .sheet(isPresented: $showConsensusDetails) {
            ConsensusDetailView(
                swarmState: webSocketService.swarmCoordinationState,
                webSocketService: webSocketService
            )
            .frame(minWidth: 600, idealWidth: 800, maxWidth: 1000,
                   minHeight: 500, idealHeight: 700, maxHeight: 900)
        }
    }
    
    // MARK: - Header
    
    private var swarmHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: "hexagon.fill")
                        .foregroundColor(.purple)
                        .font(.title2)
                    
                    Text("Swarm Coordination")
                        .font(.title2)
                        .fontWeight(.bold)
                }
                
                HStack(spacing: 12) {
                    Text("\(webSocketService.swarmCoordinationState.activeAgents) Active Agents")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text("| Consensus: \(webSocketService.swarmCoordinationState.consensusLevel * 100, specifier: "%.0f")%")
                        .font(.caption)
                        .foregroundColor(consensusColor)
                    
                    Text("| Efficiency: \(webSocketService.swarmCoordinationState.coordinationEfficiency * 100, specifier: "%.0f")%")
                        .font(.caption)
                        .foregroundColor(efficiencyColor)
                }
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                // Emergency mode toggle
                Button(action: { emergencyMode.toggle() }) {
                    HStack(spacing: 4) {
                        Image(systemName: emergencyMode ? "exclamationmark.triangle.fill" : "exclamationmark.triangle")
                            .foregroundColor(emergencyMode ? .red : .gray)
                        Text("Emergency")
                            .font(.caption)
                    }
                }
                .buttonStyle(.bordered)
                .help("Emergency coordination mode")
                
                // Consensus threshold adjustment
                VStack(spacing: 2) {
                    Text("Threshold")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Slider(value: $consensusThreshold, in: 0.5...1.0, step: 0.01)
                        .frame(width: 80)
                }
                
                // Action buttons
                Button("Consensus Details") {
                    showConsensusDetails = true
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }
    
    // MARK: - Configuration Panel
    
    private var configurationPanel: some View {
        VStack(spacing: 0) {
            // Configuration header
            HStack {
                Text("Configuration")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Menu {
                    Button("New Rule") {
                        selectedRule = nil
                        showRuleEditor = true
                    }
                    
                    Button("New Protocol") {
                        selectedProtocol = nil
                        showProtocolEditor = true
                    }
                    
                    Divider()
                    
                    Button("Import Config") {
                        // Import configuration
                    }
                    
                    Button("Export Config") {
                        // Export configuration
                    }
                } label: {
                    Image(systemName: "plus.circle")
                }
                .menuStyle(.borderlessButton)
            }
            .padding()
            
            Divider()
            
            ScrollView {
                VStack(spacing: 16) {
                    // Coordination rules section
                    coordinationRulesSection
                    
                    // Communication protocols section
                    communicationProtocolsSection
                    
                    // Swarm objectives section
                    swarmObjectivesSection
                }
                .padding()
            }
        }
    }
    
    // MARK: - Coordination Rules
    
    private var coordinationRulesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Coordination Rules")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button("Add Rule") {
                    selectedRule = nil
                    showRuleEditor = true
                }
                .buttonStyle(.borderless)
                .font(.caption)
            }
            
            VStack(spacing: 4) {
                ForEach(webSocketService.agentNetwork.swarmConfig.coordinationRules) { rule in
                    CoordinationRuleRow(
                        rule: rule,
                        isSelected: selectedRule?.id == rule.id,
                        onSelect: { selectedRule = rule },
                        onEdit: {
                            selectedRule = rule
                            showRuleEditor = true
                        }
                    )
                }
                
                if webSocketService.agentNetwork.swarmConfig.coordinationRules.isEmpty {
                    Text("No coordination rules defined")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                }
            }
        }
    }
    
    // MARK: - Communication Protocols
    
    private var communicationProtocolsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Communication Protocols")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button("Add Protocol") {
                    selectedProtocol = nil
                    showProtocolEditor = true
                }
                .buttonStyle(.borderless)
                .font(.caption)
            }
            
            VStack(spacing: 4) {
                ForEach(webSocketService.agentNetwork.swarmConfig.communicationProtocols) { communicationProtocol in
                    CommunicationProtocolRow(
                        communicationProtocol: communicationProtocol,
                        isSelected: selectedProtocol?.id == communicationProtocol.id,
                        onSelect: { selectedProtocol = communicationProtocol },
                        onEdit: {
                            selectedProtocol = communicationProtocol
                            showProtocolEditor = true
                        }
                    )
                }
                
                if webSocketService.agentNetwork.swarmConfig.communicationProtocols.isEmpty {
                    Text("No communication protocols defined")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                }
            }
        }
    }
    
    // MARK: - Swarm Objectives
    
    private var swarmObjectivesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Swarm Objectives")
                .font(.subheadline)
                .fontWeight(.medium)
            
            VStack(spacing: 6) {
                ForEach(webSocketService.agentNetwork.swarmConfig.objectives) { objective in
                    SwarmObjectiveRow(objective: objective)
                }
                
                if webSocketService.agentNetwork.swarmConfig.objectives.isEmpty {
                    Text("No swarm objectives defined")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                }
            }
        }
    }
    
    // MARK: - Coordination Visualization
    
    private var coordinationVisualization: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Coordination Activity")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Text("Real-time swarm behavior")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            
            Divider()
            
            // Swarm visualization area
            SwarmVisualizationCanvas(
                agentNetwork: webSocketService.agentNetwork,
                swarmState: webSocketService.swarmCoordinationState,
                emergencyMode: emergencyMode
            )
        }
    }
    
    // MARK: - Consensus Panel
    
    private var consensusPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Consensus Status")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                ConsensusStatusIndicator(
                    level: webSocketService.swarmCoordinationState.consensusLevel,
                    threshold: consensusThreshold
                )
            }
            .padding()
            
            Divider()
            
            ScrollView {
                VStack(spacing: 16) {
                    // Consensus metrics
                    consensusMetrics
                    
                    // Pending decisions
                    pendingDecisions
                    
                    // Recent coordination events
                    recentCoordinationEvents
                }
                .padding()
            }
        }
    }
    
    // MARK: - Consensus Metrics
    
    private var consensusMetrics: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Consensus Metrics")
                .font(.subheadline)
                .fontWeight(.medium)
            
            VStack(spacing: 8) {
                ConsensusMetricRow(
                    label: "Current Level",
                    value: "\(webSocketService.swarmCoordinationState.consensusLevel * 100, specifier: "%.1f")%",
                    color: consensusColor
                )
                
                ConsensusMetricRow(
                    label: "Threshold",
                    value: "\(consensusThreshold * 100, specifier: "%.0f")%",
                    color: .blue
                )
                
                ConsensusMetricRow(
                    label: "Efficiency",
                    value: "\(webSocketService.swarmCoordinationState.coordinationEfficiency * 100, specifier: "%.1f")%",
                    color: efficiencyColor
                )
                
                ConsensusMetricRow(
                    label: "Pending Decisions",
                    value: "\(webSocketService.swarmCoordinationState.pendingDecisions)",
                    color: pendingDecisionsColor
                )
            }
        }
    }
    
    // MARK: - Pending Decisions
    
    private var pendingDecisions: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Pending Decisions")
                .font(.subheadline)
                .fontWeight(.medium)
            
            if webSocketService.swarmCoordinationState.pendingDecisions > 0 {
                VStack(spacing: 4) {
                    ForEach(0..<min(webSocketService.swarmCoordinationState.pendingDecisions, 5), id: \.self) { index in
                        PendingDecisionRow(
                            id: "decision-\(index + 1)",
                            description: "Resource allocation for agent cluster \(index + 1)",
                            votes: Int.random(in: 3...8),
                            required: Int.random(in: 5...10)
                        )
                    }
                    
                    if webSocketService.swarmCoordinationState.pendingDecisions > 5 {
                        Text("... and \(webSocketService.swarmCoordinationState.pendingDecisions - 5) more")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            } else {
                Text("No pending decisions")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
    }
    
    // MARK: - Recent Events
    
    private var recentCoordinationEvents: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent Events")
                .font(.subheadline)
                .fontWeight(.medium)
            
            VStack(spacing: 4) {
                CoordinationEventRow(
                    event: "Consensus reached for task distribution",
                    timestamp: Date().addingTimeInterval(-120),
                    type: .consensus
                )
                
                CoordinationEventRow(
                    event: "Agent cluster reorganization",
                    timestamp: Date().addingTimeInterval(-300),
                    type: .reorganization
                )
                
                CoordinationEventRow(
                    event: "Communication protocol updated",
                    timestamp: Date().addingTimeInterval(-450),
                    type: .protocolUpdate
                )
                
                CoordinationEventRow(
                    event: "Emergency coordination activated",
                    timestamp: Date().addingTimeInterval(-600),
                    type: .emergency
                )
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var consensusColor: Color {
        let level = webSocketService.swarmCoordinationState.consensusLevel
        if level >= consensusThreshold {
            return .green
        } else if level >= consensusThreshold * 0.8 {
            return .yellow
        } else {
            return .red
        }
    }
    
    private var efficiencyColor: Color {
        let efficiency = webSocketService.swarmCoordinationState.coordinationEfficiency
        if efficiency > 0.8 {
            return .green
        } else if efficiency > 0.6 {
            return .yellow
        } else {
            return .red
        }
    }
    
    private var pendingDecisionsColor: Color {
        let pending = webSocketService.swarmCoordinationState.pendingDecisions
        if pending == 0 {
            return .green
        } else if pending < 5 {
            return .yellow
        } else {
            return .red
        }
    }
}

// MARK: - Supporting Views

struct CoordinationRuleRow: View {
    let rule: CoordinationRule
    let isSelected: Bool
    let onSelect: () -> Void
    let onEdit: () -> Void
    
    var body: some View {
        HStack {
            // Rule status
            Circle()
                .fill(rule.isActive ? .green : .gray)
                .frame(width: 8, height: 8)
            
            // Rule info
            VStack(alignment: .leading, spacing: 2) {
                Text(rule.name)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)
                
                Text("Priority: \(rule.priority)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Edit button
            Button(action: onEdit) {
                Image(systemName: "pencil")
                    .font(.caption2)
            }
            .buttonStyle(.borderless)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(isSelected ? AppTheme.accentOrange.opacity(0.2) : .clear)
        .cornerRadius(6)
        .contentShape(Rectangle())
        .onTapGesture {
            onSelect()
        }
    }
}

struct CommunicationProtocolRow: View {
    let communicationProtocol: CommunicationProtocol
    let isSelected: Bool
    let onSelect: () -> Void
    let onEdit: () -> Void
    
    var body: some View {
        HStack {
            // Protocol icon
            Image(systemName: protocolIcon)
                .foregroundColor(.blue)
                .font(.caption)
                .frame(width: 12)
            
            // Protocol info
            VStack(alignment: .leading, spacing: 2) {
                Text(communicationProtocol.name)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)
                
                Text(communicationProtocol.messageFormat.rawValue)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Security indicator
            if communicationProtocol.encryptionEnabled {
                Image(systemName: "lock.fill")
                    .foregroundColor(.green)
                    .font(.caption2)
            }
            
            // Edit button
            Button(action: onEdit) {
                Image(systemName: "pencil")
                    .font(.caption2)
            }
            .buttonStyle(.borderless)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(isSelected ? AppTheme.accentOrange.opacity(0.2) : .clear)
        .cornerRadius(6)
        .contentShape(Rectangle())
        .onTapGesture {
            onSelect()
        }
    }
    
    private var protocolIcon: String {
        switch communicationProtocol.reliability {
        case .bestEffort: return "paperplane"
        case .atLeastOnce: return "paperplane.fill"
        case .exactlyOnce: return "checkmark.seal"
        }
    }
}

struct SwarmObjectiveRow: View {
    let objective: SwarmObjective
    
    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text(objective.name)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Spacer()
                
                Text("\(objective.progress * 100, specifier: "%.0f")%")
                    .font(.caption2)
                    .fontFamily(.monospaced)
                    .foregroundColor(objectiveColor)
            }
            
            ProgressView(value: objective.progress)
                .progressViewStyle(LinearProgressViewStyle(tint: objectiveColor))
                .scaleEffect(y: 0.5)
            
            HStack {
                Text(objective.targetMetric)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text("\(objective.currentValue, specifier: "%.1f") / \(objective.targetValue, specifier: "%.1f")")
                    .font(.caption2)
                    .fontFamily(.monospaced)
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
        .background(.ultraThinMaterial)
        .cornerRadius(6)
    }
    
    private var objectiveColor: Color {
        if objective.progress > 0.8 {
            return .green
        } else if objective.progress > 0.5 {
            return .yellow
        } else {
            return .red
        }
    }
}

struct ConsensusStatusIndicator: View {
    let level: Double
    let threshold: Double
    
    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(consensusColor)
                .frame(width: 12, height: 12)
                .overlay(
                    Circle()
                        .stroke(.white, lineWidth: 1)
                )
                .scaleEffect(level >= threshold ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: level >= threshold)
            
            Text(level >= threshold ? "Consensus Reached" : "Building Consensus")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(consensusColor)
        }
    }
    
    private var consensusColor: Color {
        if level >= threshold {
            return .green
        } else if level >= threshold * 0.8 {
            return .yellow
        } else {
            return .red
        }
    }
}

struct ConsensusMetricRow: View {
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .fontWeight(.medium)
            
            Spacer()
            
            Text(value)
                .font(.caption)
                .fontFamily(.monospaced)
                .foregroundColor(color)
        }
    }
}

struct PendingDecisionRow: View {
    let id: String
    let description: String
    let votes: Int
    let required: Int
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(description)
                    .font(.caption)
                    .lineLimit(1)
                
                Spacer()
                
                Text("\(votes)/\(required)")
                    .font(.caption2)
                    .fontFamily(.monospaced)
                    .foregroundColor(votesColor)
            }
            
            ProgressView(value: Double(votes) / Double(required))
                .progressViewStyle(LinearProgressViewStyle(tint: votesColor))
                .scaleEffect(y: 0.5)
        }
        .padding(6)
        .background(.ultraThinMaterial)
        .cornerRadius(4)
    }
    
    private var votesColor: Color {
        let ratio = Double(votes) / Double(required)
        if ratio >= 1.0 {
            return .green
        } else if ratio >= 0.7 {
            return .yellow
        } else {
            return .red
        }
    }
}

struct CoordinationEventRow: View {
    let event: String
    let timestamp: Date
    let type: CoordinationEventType
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: type.icon)
                .foregroundColor(type.color)
                .font(.caption)
                .frame(width: 12)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(event)
                    .font(.caption)
                    .lineLimit(2)
                
                Text(timeAgoString(from: timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(6)
    }
    
    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 {
            return "\(Int(interval))s ago"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else {
            return "\(Int(interval / 3600))h ago"
        }
    }
}

enum CoordinationEventType {
    case consensus
    case reorganization
    case protocolUpdate
    case emergency
    
    var icon: String {
        switch self {
        case .consensus: return "checkmark.circle"
        case .reorganization: return "arrow.triangle.2.circlepath"
        case .protocolUpdate: return "gear"
        case .emergency: return "exclamationmark.triangle"
        }
    }
    
    var color: Color {
        switch self {
        case .consensus: return .green
        case .reorganization: return .blue
        case .protocolUpdate: return .orange
        case .emergency: return .red
        }
    }
}

// MARK: - Swarm Visualization Canvas

struct SwarmVisualizationCanvas: View {
    let agentNetwork: AgentNetwork
    let swarmState: SwarmCoordinationState
    let emergencyMode: Bool
    
    @State private var animationOffset: CGFloat = 0
    
    var body: some View {
        Canvas { context, size in
            // Draw swarm coordination patterns
            drawSwarmPatterns(context: context, size: size)
            
            // Draw agent positions and movements
            drawAgentSwarm(context: context, size: size)
            
            // Draw consensus indicators
            drawConsensusIndicators(context: context, size: size)
        }
        .onAppear {
            startSwarmAnimation()
        }
        .overlay(
            VStack {
                Spacer()
                HStack {
                    SwarmLegend()
                    Spacer()
                }
                .padding()
            }
        )
    }
    
    private func drawSwarmPatterns(context: GraphicsContext, size: CGSize) {
        // Draw coordinated movement patterns
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = min(size.width, size.height) / 3
        
        // Draw coordination circles
        for i in 1...3 {
            let circleRadius = radius * CGFloat(i) / 3
            let opacity = emergencyMode ? 0.8 : 0.3
            
            let circle = Path { path in
                path.addEllipse(in: CGRect(
                    x: center.x - circleRadius,
                    y: center.y - circleRadius,
                    width: circleRadius * 2,
                    height: circleRadius * 2
                ))
            }
            
            context.stroke(
                circle,
                with: .color(.purple.opacity(opacity)),
                style: StrokeStyle(
                    lineWidth: emergencyMode ? 3 : 1,
                    dash: [5, 5]
                )
            )
        }
    }
    
    private func drawAgentSwarm(context: GraphicsContext, size: CGSize) {
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        
        for (index, node) in agentNetwork.nodes.enumerated() {
            let angle = Double(index) * 2 * .pi / Double(agentNetwork.nodes.count) + Double(animationOffset) * 0.01
            let distance = 80.0 + sin(Double(index) + Double(animationOffset) * 0.02) * 20
            
            let position = CGPoint(
                x: center.x + distance * cos(angle),
                y: center.y + distance * sin(angle)
            )
            
            // Draw agent
            let agentCircle = Path { path in
                path.addEllipse(in: CGRect(
                    x: position.x - 6,
                    y: position.y - 6,
                    width: 12,
                    height: 12
                ))
            }
            
            context.fill(agentCircle, with: .color(node.nodeType.color))
            
            // Draw trails
            if !emergencyMode {
                drawAgentTrail(context: context, from: center, to: position, alpha: 0.3)
            }
        }
    }
    
    private func drawAgentTrail(context: GraphicsContext, from: CGPoint, to: CGPoint, alpha: Double) {
        let trail = Path { path in
            path.move(to: from)
            path.addLine(to: to)
        }
        
        context.stroke(
            trail,
            with: .color(.blue.opacity(alpha)),
            style: StrokeStyle(lineWidth: 1, lineCap: .round)
        )
    }
    
    private func drawConsensusIndicators(context: GraphicsContext, size: CGSize) {
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        
        // Draw consensus level indicator
        let consensusRadius = CGFloat(swarmState.consensusLevel) * 30
        let consensusCircle = Path { path in
            path.addEllipse(in: CGRect(
                x: center.x - consensusRadius,
                y: center.y - consensusRadius,
                width: consensusRadius * 2,
                height: consensusRadius * 2
            ))
        }
        
        context.fill(
            consensusCircle,
            with: .color(.green.opacity(0.3))
        )
    }
    
    private func startSwarmAnimation() {
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            animationOffset += 1
        }
    }
}

struct SwarmLegend: View {
    var body: some View {
        HStack(spacing: 16) {
            LegendItem(color: .purple, label: "Coordination Rings")
            LegendItem(color: .blue, label: "Agent Movements")
            LegendItem(color: .green, label: "Consensus Area")
        }
        .padding(8)
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}

struct LegendItem: View {
    let color: Color
    let label: String
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Editor Views (Placeholder)

struct CoordinationRuleEditor: View {
    let rule: CoordinationRule?
    let webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack {
            Text("Coordination Rule Editor")
                .font(.title2)
                .fontWeight(.bold)
            
            Text("Edit coordination rules and conditions")
                .font(.body)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Button("Close") {
                dismiss()
            }
        }
        .padding()
    }
}

struct CommunicationProtocolEditor: View {
    let communicationProtocol: CommunicationProtocol?
    let webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack {
            Text("Communication Protocol Editor")
                .font(.title2)
                .fontWeight(.bold)
            
            Text("Configure communication protocols and message formats")
                .font(.body)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Button("Close") {
                dismiss()
            }
        }
        .padding()
    }
}

struct ConsensusDetailView: View {
    let swarmState: SwarmCoordinationState
    let webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack {
            Text("Consensus Details")
                .font(.title2)
                .fontWeight(.bold)
            
            Text("Detailed consensus analysis and voting history")
                .font(.body)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Button("Close") {
                dismiss()
            }
        }
        .padding()
    }
}

#Preview {
    SwarmCoordinationView(webSocketService: AgentWebSocketService())
        .frame(width: 1200, height: 800)
}