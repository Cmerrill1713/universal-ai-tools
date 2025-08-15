import SwiftUI

/// Interactive agent network topology visualization
struct AgentNetworkTopology: View {
    @ObservedObject var webSocketService: AgentWebSocketService
    @State private var selectedNode: AgentNode?
    @State private var selectedConnection: AgentConnection?
    @State private var showNodeDetails = false
    @State private var showConnectionDetails = false
    @State private var zoomScale: CGFloat = 1.0
    @State private var panOffset: CGSize = .zero
    @State private var isDragging = false
    @State private var dragOffset: CGSize = .zero
    @State private var lastPanValue: CGSize = .zero
    @State private var viewportSize: CGSize = .zero
    @State private var layoutType: NetworkLayoutType = .force
    @State private var showMetricsOverlay = true
    @State private var animateLayout = false
    @State private var forceSimulationActive = false
    
    // Force simulation parameters
    @State private var nodePositions: [String: CGPoint] = [:]
    @State private var nodeVelocities: [String: CGVector] = [:]
    private let simulationTimer = Timer.publish(every: 0.016, on: .main, in: .common).autoconnect() // 60fps
    
    // Visual configuration
    private let minNodeRadius: CGFloat = 20
    private let maxNodeRadius: CGFloat = 40
    private let connectionWidth: CGFloat = 2
    private let labelFontSize: CGFloat = 10
    
    var body: some View {
        ZStack {
            // Background with pattern
            networkBackground
            
            GeometryReader { geometry in
                ZStack {
                    // Network connections (drawn first, behind nodes)
                    networkConnections
                    
                    // Network nodes
                    networkNodes
                    
                    // Network metrics overlay
                    if showMetricsOverlay {
                        networkMetricsOverlay
                    }
                }
                .scaleEffect(zoomScale)
                .offset(x: panOffset.width + dragOffset.width, y: panOffset.height + dragOffset.height)
                .clipped()
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            if !isDragging {
                                isDragging = true
                            }
                            dragOffset = CGSize(
                                width: value.translation.x - lastPanValue.width,
                                height: value.translation.y - lastPanValue.height
                            )
                        }
                        .onEnded { value in
                            panOffset.width += dragOffset.width
                            panOffset.height += dragOffset.height
                            dragOffset = .zero
                            lastPanValue = .zero
                            isDragging = false
                        }
                )
                .gesture(
                    MagnificationGesture()
                        .onChanged { value in
                            zoomScale = max(0.3, min(3.0, value))
                        }
                )
                .onTapGesture(count: 2) {
                    withAnimation(.spring()) {
                        resetView()
                    }
                }
                .onAppear {
                    viewportSize = geometry.size
                    initializeLayout()
                }
                .onChange(of: geometry.size) { newSize in
                    viewportSize = newSize
                }
                .onChange(of: webSocketService.agentNetwork) { _ in
                    updateLayout()
                }
            }
            
            // Control overlays
            VStack {
                HStack {
                    networkControls
                    Spacer()
                    networkStats
                }
                .padding()
                
                Spacer()
                
                // Bottom toolbar for selected items
                if selectedNode != nil || selectedConnection != nil {
                    selectionToolbar
                        .padding()
                }
            }
        }
        .onReceive(simulationTimer) { _ in
            if forceSimulationActive && layoutType == .force {
                updateForceSimulation()
            }
        }
        .sheet(isPresented: $showNodeDetails) {
            if let node = selectedNode {
                AgentNodeDetailView(node: node, webSocketService: webSocketService)
                    .frame(minWidth: 500, idealWidth: 600, maxWidth: 800,
                           minHeight: 400, idealHeight: 500, maxHeight: 700)
            }
        }
        .sheet(isPresented: $showConnectionDetails) {
            if let connection = selectedConnection {
                ConnectionDetailView(connection: connection, webSocketService: webSocketService)
                    .frame(minWidth: 400, idealWidth: 500, maxWidth: 600,
                           minHeight: 300, idealHeight: 400, maxHeight: 500)
            }
        }
    }
    
    // MARK: - Background
    
    private var networkBackground: some View {
        ZStack {
            // Gradient background
            RadialGradient(
                colors: [
                    Color.blue.opacity(0.1),
                    Color.purple.opacity(0.05),
                    Color.black.opacity(0.1)
                ],
                center: .center,
                startRadius: 100,
                endRadius: 500
            )
            
            // Animated grid pattern
            Canvas { context, size in
                let gridSpacing: CGFloat = 40 * zoomScale
                let offsetX = panOffset.width.truncatingRemainder(dividingBy: gridSpacing)
                let offsetY = panOffset.height.truncatingRemainder(dividingBy: gridSpacing)
                
                context.stroke(
                    Path { path in
                        for x in stride(from: offsetX, through: size.width + gridSpacing, by: gridSpacing) {
                            path.move(to: CGPoint(x: x, y: 0))
                            path.addLine(to: CGPoint(x: x, y: size.height))
                        }
                        for y in stride(from: offsetY, through: size.height + gridSpacing, by: gridSpacing) {
                            path.move(to: CGPoint(x: 0, y: y))
                            path.addLine(to: CGPoint(x: size.width, y: y))
                        }
                    },
                    with: .color(.white.opacity(0.1)),
                    lineWidth: 0.5
                )
            }
        }
    }
    
    // MARK: - Network Elements
    
    private var networkNodes: some View {
        ZStack {
            ForEach(webSocketService.agentNetwork.nodes) { node in
                if let position = nodePositions[node.id] {
                    NetworkNodeView(
                        node: node,
                        agentNetwork: webSocketService.agentNetwork,
                        performanceMetrics: webSocketService.agentPerformanceMetrics[node.agentId],
                        isSelected: selectedNode?.id == node.id,
                        position: position
                    )
                    .onTapGesture {
                        selectNode(node)
                    }
                    .onLongPressGesture {
                        showNodeDetails = true
                    }
                    .animation(.spring(response: 0.5, dampingFraction: 0.8), value: animateLayout)
                }
            }
        }
    }
    
    private var networkConnections: some View {
        Canvas { context, size in
            for connection in webSocketService.agentNetwork.connections {
                drawConnection(context: context, connection: connection)
            }
        }
        .allowsHitTesting(false)
    }
    
    private var networkMetricsOverlay: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                NetworkMetricsPanel(
                    network: webSocketService.agentNetwork,
                    connectionStatus: webSocketService.connectionStatus
                )
                .padding()
            }
        }
    }
    
    // MARK: - Controls
    
    private var networkControls: some View {
        HStack(spacing: 12) {
            // Layout controls
            Picker("Layout", selection: $layoutType) {
                ForEach(NetworkLayoutType.allCases, id: \.self) { type in
                    Text(type.rawValue).tag(type)
                }
            }
            .pickerStyle(.menu)
            .onChange(of: layoutType) { _ in
                updateLayout()
            }
            
            Divider()
                .frame(height: 20)
            
            // Zoom controls
            Button(action: { withAnimation { zoomScale = max(0.3, zoomScale - 0.2) } }) {
                Image(systemName: "minus.magnifyingglass")
            }
            .buttonStyle(.bordered)
            
            Button(action: { withAnimation { zoomScale = min(3.0, zoomScale + 0.2) } }) {
                Image(systemName: "plus.magnifyingglass")
            }
            .buttonStyle(.bordered)
            
            Button(action: { withAnimation(.spring()) { resetView() } }) {
                Image(systemName: "arrow.counterclockwise")
            }
            .buttonStyle(.bordered)
            
            Divider()
                .frame(height: 20)
            
            // View options
            Button(action: { showMetricsOverlay.toggle() }) {
                Image(systemName: showMetricsOverlay ? "chart.bar.fill" : "chart.bar")
            }
            .buttonStyle(.bordered)
            
            // Force simulation toggle
            if layoutType == .force {
                Button(action: { forceSimulationActive.toggle() }) {
                    Image(systemName: forceSimulationActive ? "pause.circle" : "play.circle")
                }
                .buttonStyle(.bordered)
                .help(forceSimulationActive ? "Pause simulation" : "Start simulation")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var networkStats: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text("Nodes: \(webSocketService.agentNetwork.nodes.count)")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text("Connections: \(webSocketService.agentNetwork.activeConnectionCount)")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text("Health: \(webSocketService.agentNetwork.healthScore, specifier: "%.1f%%")")
                .font(.caption)
                .foregroundColor(healthScoreColor)
            
            Text("Latency: \(webSocketService.agentNetwork.averageLatency, specifier: "%.1f")ms")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var selectionToolbar: some View {
        HStack(spacing: 16) {
            if let node = selectedNode {
                Button("Start Agent") {
                    Task {
                        await webSocketService.sendAgentCommand(node.agentId, command: .start)
                    }
                }
                .buttonStyle(.borderedProminent)
                
                Button("Stop Agent") {
                    Task {
                        await webSocketService.sendAgentCommand(node.agentId, command: .stop)
                    }
                }
                .buttonStyle(.bordered)
                
                Button("View Details") {
                    showNodeDetails = true
                }
                .buttonStyle(.bordered)
            }
            
            if selectedConnection != nil {
                Button("Connection Details") {
                    showConnectionDetails = true
                }
                .buttonStyle(.bordered)
            }
            
            Spacer()
            
            Button("Deselect") {
                withAnimation {
                    selectedNode = nil
                    selectedConnection = nil
                }
            }
            .buttonStyle(.borderless)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Helper Functions
    
    private func initializeLayout() {
        updateLayout()
    }
    
    private func updateLayout() {
        withAnimation(.easeInOut(duration: 1.0)) {
            animateLayout.toggle()
            calculateNodePositions()
        }
        
        if layoutType == .force {
            startForceSimulation()
        } else {
            forceSimulationActive = false
        }
    }
    
    private func calculateNodePositions() {
        let nodes = webSocketService.agentNetwork.nodes
        guard !nodes.isEmpty else { return }
        
        let centerX = viewportSize.width / 2
        let centerY = viewportSize.height / 2
        
        switch layoutType {
        case .circular:
            layoutCircular(nodes: nodes, center: CGPoint(x: centerX, y: centerY))
        case .hierarchical:
            layoutHierarchical(nodes: nodes, center: CGPoint(x: centerX, y: centerY))
        case .grid:
            layoutGrid(nodes: nodes, center: CGPoint(x: centerX, y: centerY))
        case .force:
            if nodePositions.isEmpty {
                layoutRandomInitial(nodes: nodes, center: CGPoint(x: centerX, y: centerY))
            }
        }
    }
    
    private func layoutCircular(nodes: [AgentNode], center: CGPoint) {
        let radius: CGFloat = min(viewportSize.width, viewportSize.height) / 3
        let angleStep = 2 * .pi / Double(nodes.count)
        
        for (index, node) in nodes.enumerated() {
            let angle = Double(index) * angleStep
            let x = center.x + radius * cos(angle)
            let y = center.y + radius * sin(angle)
            nodePositions[node.id] = CGPoint(x: x, y: y)
        }
    }
    
    private func layoutHierarchical(nodes: [AgentNode], center: CGPoint) {
        // Group nodes by layer
        let nodesByLayer = Dictionary(grouping: nodes) { $0.layer }
        let maxLayer = nodes.map { $0.layer }.max() ?? 0
        
        let layerSpacing: CGFloat = viewportSize.height / CGFloat(maxLayer + 2)
        
        for layer in 0...maxLayer {
            guard let layerNodes = nodesByLayer[layer] else { continue }
            
            let y = layerSpacing * CGFloat(layer + 1)
            let nodeSpacing = viewportSize.width / CGFloat(layerNodes.count + 1)
            
            for (index, node) in layerNodes.enumerated() {
                let x = nodeSpacing * CGFloat(index + 1)
                nodePositions[node.id] = CGPoint(x: x, y: y)
            }
        }
    }
    
    private func layoutGrid(nodes: [AgentNode], center: CGPoint) {
        let columns = Int(ceil(sqrt(Double(nodes.count))))
        let rows = Int(ceil(Double(nodes.count) / Double(columns)))
        
        let cellWidth = viewportSize.width / CGFloat(columns + 1)
        let cellHeight = viewportSize.height / CGFloat(rows + 1)
        
        for (index, node) in nodes.enumerated() {
            let row = index / columns
            let col = index % columns
            
            let x = cellWidth * CGFloat(col + 1)
            let y = cellHeight * CGFloat(row + 1)
            nodePositions[node.id] = CGPoint(x: x, y: y)
        }
    }
    
    private func layoutRandomInitial(nodes: [AgentNode], center: CGPoint) {
        for node in nodes {
            let x = center.x + CGFloat.random(in: -200...200)
            let y = center.y + CGFloat.random(in: -200...200)
            nodePositions[node.id] = CGPoint(x: x, y: y)
            nodeVelocities[node.id] = CGVector(dx: 0, dy: 0)
        }
    }
    
    private func startForceSimulation() {
        forceSimulationActive = true
        
        // Initialize velocities if needed
        for node in webSocketService.agentNetwork.nodes {
            if nodeVelocities[node.id] == nil {
                nodeVelocities[node.id] = CGVector(dx: 0, dy: 0)
            }
        }
    }
    
    private func updateForceSimulation() {
        let nodes = webSocketService.agentNetwork.nodes
        let connections = webSocketService.agentNetwork.connections
        
        var forces: [String: CGVector] = [:]
        
        // Initialize forces
        for node in nodes {
            forces[node.id] = CGVector(dx: 0, dy: 0)
        }
        
        // Repulsion forces between nodes
        for i in 0..<nodes.count {
            for j in (i+1)..<nodes.count {
                let node1 = nodes[i]
                let node2 = nodes[j]
                
                guard let pos1 = nodePositions[node1.id],
                      let pos2 = nodePositions[node2.id] else { continue }
                
                let dx = pos1.x - pos2.x
                let dy = pos1.y - pos2.y
                let distance = sqrt(dx * dx + dy * dy)
                
                if distance > 0 && distance < 150 {
                    let repulsionForce = 1000 / (distance * distance)
                    let fx = (dx / distance) * repulsionForce
                    let fy = (dy / distance) * repulsionForce
                    
                    forces[node1.id]?.dx += fx
                    forces[node1.id]?.dy += fy
                    forces[node2.id]?.dx -= fx
                    forces[node2.id]?.dy -= fy
                }
            }
        }
        
        // Attraction forces for connected nodes
        for connection in connections {
            guard let pos1 = nodePositions[connection.fromAgentId],
                  let pos2 = nodePositions[connection.toAgentId] else { continue }
            
            let dx = pos2.x - pos1.x
            let dy = pos2.y - pos1.y
            let distance = sqrt(dx * dx + dy * dy)
            
            if distance > 0 {
                let attractionForce = distance * 0.01
                let fx = (dx / distance) * attractionForce
                let fy = (dy / distance) * attractionForce
                
                forces[connection.fromAgentId]?.dx += fx
                forces[connection.fromAgentId]?.dy += fy
                forces[connection.toAgentId]?.dx -= fx
                forces[connection.toAgentId]?.dy -= fy
            }
        }
        
        // Update positions and velocities
        for node in nodes {
            guard var velocity = nodeVelocities[node.id],
                  var position = nodePositions[node.id],
                  let force = forces[node.id] else { continue }
            
            // Update velocity with damping
            velocity.dx = (velocity.dx + force.dx) * 0.9
            velocity.dy = (velocity.dy + force.dy) * 0.9
            
            // Update position
            position.x += velocity.dx
            position.y += velocity.dy
            
            // Keep nodes within bounds
            position.x = max(50, min(viewportSize.width - 50, position.x))
            position.y = max(50, min(viewportSize.height - 50, position.y))
            
            nodePositions[node.id] = position
            nodeVelocities[node.id] = velocity
        }
        
        // Stop simulation if forces are small
        let totalForce = forces.values.reduce(0) { result, force in
            result + abs(force.dx) + abs(force.dy)
        }
        
        if totalForce < 0.1 {
            forceSimulationActive = false
        }
    }
    
    private func drawConnection(context: GraphicsContext, connection: AgentConnection) {
        guard let fromPos = nodePositions[connection.fromAgentId],
              let toPos = nodePositions[connection.toAgentId] else { return }
        
        let path = Path { path in
            path.move(to: fromPos)
            
            if connection.connectionType == .bidirectional {
                // Straight line for bidirectional
                path.addLine(to: toPos)
            } else {
                // Curved line for unidirectional
                let midPoint = CGPoint(
                    x: (fromPos.x + toPos.x) / 2,
                    y: (fromPos.y + toPos.y) / 2 - 20
                )
                path.addQuadCurve(to: toPos, control: midPoint)
            }
        }
        
        // Connection styling based on status and performance
        let strokeColor = connectionStrokeColor(connection: connection)
        let strokeWidth = connectionStrokeWidth(connection: connection)
        
        context.stroke(
            path,
            with: .color(strokeColor),
            style: StrokeStyle(
                lineWidth: strokeWidth,
                lineCap: .round,
                lineJoin: .round,
                dash: connection.isActive ? [] : [5, 5]
            )
        )
        
        // Draw arrow for directional connections
        if connection.connectionType != .bidirectional {
            drawArrow(context: context, from: fromPos, to: toPos, color: strokeColor)
        }
        
        // Draw bandwidth indicator
        if connection.isActive && connection.bandwidth > 0 {
            drawBandwidthIndicator(context: context, connection: connection, from: fromPos, to: toPos)
        }
    }
    
    private func drawArrow(context: GraphicsContext, from: CGPoint, to: CGPoint, color: Color) {
        let angle = atan2(to.y - from.y, to.x - from.x)
        let arrowLength: CGFloat = 12
        let arrowAngle: CGFloat = .pi / 6
        
        // Calculate arrow points
        let arrowTip = CGPoint(
            x: to.x - (maxNodeRadius + 5) * cos(angle),
            y: to.y - (maxNodeRadius + 5) * sin(angle)
        )
        
        let arrowLeft = CGPoint(
            x: arrowTip.x - arrowLength * cos(angle - arrowAngle),
            y: arrowTip.y - arrowLength * sin(angle - arrowAngle)
        )
        
        let arrowRight = CGPoint(
            x: arrowTip.x - arrowLength * cos(angle + arrowAngle),
            y: arrowTip.y - arrowLength * sin(angle + arrowAngle)
        )
        
        let arrowPath = Path { path in
            path.move(to: arrowTip)
            path.addLine(to: arrowLeft)
            path.move(to: arrowTip)
            path.addLine(to: arrowRight)
        }
        
        context.stroke(arrowPath, with: .color(color), style: StrokeStyle(lineWidth: 2, lineCap: .round))
    }
    
    private func drawBandwidthIndicator(context: GraphicsContext, connection: AgentConnection, from: CGPoint, to: CGPoint) {
        let midPoint = CGPoint(
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2
        )
        
        let bandwidthNormalized = min(connection.bandwidth / 100.0, 1.0)
        let indicatorSize: CGFloat = 8 + bandwidthNormalized * 12
        
        let circle = Path { path in
            path.addEllipse(in: CGRect(
                x: midPoint.x - indicatorSize / 2,
                y: midPoint.y - indicatorSize / 2,
                width: indicatorSize,
                height: indicatorSize
            ))
        }
        
        context.fill(circle, with: .color(.green.opacity(0.7)))
    }
    
    private func connectionStrokeColor(connection: AgentConnection) -> Color {
        if !connection.isActive {
            return .gray
        } else if connection.latency < 10 {
            return .green
        } else if connection.latency < 50 {
            return .yellow
        } else {
            return .red
        }
    }
    
    private func connectionStrokeWidth(connection: AgentConnection) -> CGFloat {
        let baseWidth: CGFloat = 2
        let strengthMultiplier = connection.strength
        return baseWidth + strengthMultiplier * 3
    }
    
    private func selectNode(_ node: AgentNode) {
        withAnimation(.easeInOut(duration: 0.3)) {
            selectedNode = node
            selectedConnection = nil
        }
    }
    
    private func resetView() {
        zoomScale = 1.0
        panOffset = .zero
        dragOffset = .zero
        lastPanValue = .zero
    }
    
    private var healthScoreColor: Color {
        let score = webSocketService.agentNetwork.healthScore
        if score > 0.8 {
            return .green
        } else if score > 0.5 {
            return .yellow
        } else {
            return .red
        }
    }
}

// MARK: - Supporting Types

enum NetworkLayoutType: String, CaseIterable {
    case circular = "Circular"
    case hierarchical = "Hierarchical"
    case grid = "Grid"
    case force = "Force-Directed"
}

// MARK: - Network Node View

struct NetworkNodeView: View {
    let node: AgentNode
    let agentNetwork: AgentNetwork
    let performanceMetrics: AgentPerformanceMetric?
    let isSelected: Bool
    let position: CGPoint
    
    private var nodeRadius: CGFloat {
        let baseRadius: CGFloat = 25
        let performanceMultiplier = performanceMetrics?.throughput ?? 0
        return baseRadius + min(performanceMultiplier / 10, 15)
    }
    
    var body: some View {
        ZStack {
            // Node background with performance-based styling
            Circle()
                .fill(nodeGradient)
                .frame(width: nodeRadius * 2, height: nodeRadius * 2)
                .overlay(
                    Circle()
                        .stroke(isSelected ? .white : nodeStrokeColor, lineWidth: isSelected ? 3 : 1)
                )
                .shadow(color: .black.opacity(0.3), radius: isSelected ? 8 : 4)
            
            // Node type icon
            Image(systemName: node.nodeType.icon)
                .font(.system(size: nodeRadius * 0.6))
                .foregroundColor(.white)
            
            // Status indicator
            VStack {
                HStack {
                    Spacer()
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)
                        .overlay(
                            Circle()
                                .stroke(.white, lineWidth: 1)
                        )
                }
                Spacer()
            }
            .frame(width: nodeRadius * 2, height: nodeRadius * 2)
            
            // Performance metrics indicator
            if let metrics = performanceMetrics {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        PerformanceIndicator(metrics: metrics)
                    }
                }
                .frame(width: nodeRadius * 2, height: nodeRadius * 2)
            }
        }
        .position(position)
        .scaleEffect(isSelected ? 1.2 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isSelected)
    }
    
    private var nodeGradient: LinearGradient {
        LinearGradient(
            colors: [
                node.nodeType.color,
                node.nodeType.color.opacity(0.8)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
    
    private var nodeStrokeColor: Color {
        if let metrics = performanceMetrics {
            if metrics.errorCount > 0 {
                return .red
            } else if metrics.successRate > 0.9 {
                return .green
            } else {
                return .orange
            }
        }
        return .gray
    }
    
    private var statusColor: Color {
        // This would be determined by the actual agent status
        // For now, using node type color
        node.nodeType.color
    }
}

struct PerformanceIndicator: View {
    let metrics: AgentPerformanceMetric
    
    var body: some View {
        ZStack {
            Circle()
                .fill(.black.opacity(0.7))
                .frame(width: 16, height: 16)
            
            Circle()
                .trim(from: 0, to: metrics.successRate)
                .stroke(performanceColor, lineWidth: 2)
                .frame(width: 14, height: 14)
                .rotationEffect(.degrees(-90))
        }
    }
    
    private var performanceColor: Color {
        if metrics.successRate > 0.9 {
            return .green
        } else if metrics.successRate > 0.7 {
            return .yellow
        } else {
            return .red
        }
    }
}

// MARK: - Network Metrics Panel

struct NetworkMetricsPanel: View {
    let network: AgentNetwork
    let connectionStatus: ConnectionStatus
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: connectionStatus.icon)
                    .foregroundColor(connectionStatus.color)
                Text("Network Status")
                    .font(.headline)
            }
            
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    MetricItem(label: "Nodes", value: "\(network.nodes.count)")
                    MetricItem(label: "Active", value: "\(network.activeConnectionCount)")
                    MetricItem(label: "Health", value: "\(network.healthScore, specifier: "%.1f%%")")
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    MetricItem(label: "Latency", value: "\(network.averageLatency, specifier: "%.1f")ms")
                    MetricItem(label: "Topology", value: network.topology.rawValue)
                    MetricItem(label: "Updated", value: timeAgoString(from: network.lastUpdated))
                }
            }
        }
        .padding(12)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
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

struct MetricItem: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontFamily(.monospaced)
        }
    }
}

// MARK: - Detail Views

struct AgentNodeDetailView: View {
    let node: AgentNode
    let webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text("Agent Node Details")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text("Node ID: \(node.id)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button("Close") {
                    dismiss()
                }
                .buttonStyle(.borderless)
            }
            
            ScrollView {
                VStack(spacing: 16) {
                    // Node information
                    GroupBox("Node Information") {
                        VStack(spacing: 8) {
                            DetailRow(label: "Agent ID", value: node.agentId)
                            DetailRow(label: "Type", value: node.nodeType.rawValue)
                            DetailRow(label: "Layer", value: "\(node.layer)")
                            DetailRow(label: "Is Root", value: node.isRoot ? "Yes" : "No")
                            DetailRow(label: "Position", value: "\(Int(node.position.x)), \(Int(node.position.y))")
                        }
                    }
                    
                    // Performance metrics
                    if let metrics = webSocketService.agentPerformanceMetrics[node.agentId] {
                        GroupBox("Performance Metrics") {
                            VStack(spacing: 8) {
                                DetailRow(label: "Success Rate", value: "\(metrics.successRate * 100, specifier: "%.1f")%")
                                DetailRow(label: "Latency", value: "\(metrics.latency, specifier: "%.1f") ms")
                                DetailRow(label: "CPU Usage", value: "\(metrics.cpuUsage, specifier: "%.1f")%")
                                DetailRow(label: "Memory Usage", value: formatBytes(metrics.memoryUsage))
                                DetailRow(label: "Throughput", value: "\(metrics.throughput, specifier: "%.1f") tasks/min")
                                DetailRow(label: "Error Count", value: "\(metrics.errorCount)")
                            }
                        }
                    }
                    
                    // Connections
                    let connections = webSocketService.agentNetwork.connections.filter {
                        $0.fromAgentId == node.agentId || $0.toAgentId == node.agentId
                    }
                    
                    if !connections.isEmpty {
                        GroupBox("Connections (\(connections.count))") {
                            VStack(spacing: 4) {
                                ForEach(connections.prefix(5)) { connection in
                                    ConnectionRow(connection: connection, currentNodeId: node.agentId)
                                }
                                
                                if connections.count > 5 {
                                    Text("... and \(connections.count - 5) more")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            
            // Actions
            HStack {
                Button("Start Agent") {
                    Task {
                        await webSocketService.sendAgentCommand(node.agentId, command: .start)
                    }
                }
                .buttonStyle(.borderedProminent)
                
                Button("Stop Agent") {
                    Task {
                        await webSocketService.sendAgentCommand(node.agentId, command: .stop)
                    }
                }
                .buttonStyle(.bordered)
                
                Button("Restart") {
                    Task {
                        await webSocketService.sendAgentCommand(node.agentId, command: .restart)
                    }
                }
                .buttonStyle(.bordered)
                
                Spacer()
            }
        }
        .padding()
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: bytes)
    }
}

struct ConnectionDetailView: View {
    let connection: AgentConnection
    let webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Text("Connection Details")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Spacer()
                
                Button("Close") {
                    dismiss()
                }
                .buttonStyle(.borderless)
            }
            
            VStack(spacing: 16) {
                DetailRow(label: "From Agent", value: connection.fromAgentId)
                DetailRow(label: "To Agent", value: connection.toAgentId)
                DetailRow(label: "Type", value: connection.connectionType.rawValue)
                DetailRow(label: "Strength", value: "\(connection.strength, specifier: "%.2f")")
                DetailRow(label: "Latency", value: "\(connection.latency, specifier: "%.1f") ms")
                DetailRow(label: "Bandwidth", value: "\(connection.bandwidth, specifier: "%.1f") msg/s")
                DetailRow(label: "Active", value: connection.isActive ? "Yes" : "No")
                DetailRow(label: "Last Activity", value: timeAgoString(from: connection.lastActivity))
            }
            
            Spacer()
        }
        .padding()
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

struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .fontWeight(.medium)
            Spacer()
            Text(value)
                .foregroundColor(.secondary)
                .fontFamily(.monospaced)
        }
    }
}

struct ConnectionRow: View {
    let connection: AgentConnection
    let currentNodeId: String
    
    var body: some View {
        HStack {
            Image(systemName: connection.connectionType == .bidirectional ? "arrow.left.and.right" : "arrow.right")
                .foregroundColor(connection.isActive ? .green : .gray)
            
            Text(connection.fromAgentId == currentNodeId ? connection.toAgentId : connection.fromAgentId)
                .font(.caption)
            
            Spacer()
            
            Text("\(connection.latency, specifier: "%.0f")ms")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    AgentNetworkTopology(webSocketService: AgentWebSocketService())
        .frame(width: 1000, height: 700)
}