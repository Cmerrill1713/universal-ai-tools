import SwiftUI
import Pow

/// Enhanced network topology visualization with improved animations and interactivity
struct EnhancedNetworkTopologyView: View {
    @ObservedObject var orchestrationService: EnhancedAgentOrchestrationService
    @State private var selectedNodeId: String?
    @State private var hoveredNodeId: String?
    @State private var showNodeDetails = false
    @State private var networkScale: CGFloat = 1.0
    @State private var networkOffset: CGSize = .zero
    @State private var lastScaleValue: CGFloat = 1.0
    @State private var animationTrigger = false
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background
                networkBackground
                
                // Network visualization
                networkVisualization(in: geometry)
                    .scaleEffect(networkScale)
                    .offset(networkOffset)
                    .gesture(
                        SimultaneousGesture(
                            magnificationGesture,
                            dragGesture
                        )
                    )
                
                // Overlay information
                networkOverlay
            }
        }
        .background(
            LinearGradient(
                colors: [
                    Color.black.opacity(0.05),
                    Color.blue.opacity(0.02),
                    Color.purple.opacity(0.02)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .onReceive(orchestrationService.$orchestrationNetwork) { _ in
            withAnimation(.spring(response: 0.8, dampingFraction: 0.8)) {
                animationTrigger.toggle()
            }
        }
        .sheet(isPresented: $showNodeDetails) {
            if let nodeId = selectedNodeId,
               let node = orchestrationService.orchestrationNetwork.nodes.first(where: { $0.agentId == nodeId }) {
                NodeDetailsView(
                    node: node,
                    performanceMetrics: orchestrationService.agentPerformanceMetrics[nodeId],
                    orchestrationService: orchestrationService
                )
                .frame(minWidth: 400, idealWidth: 500, maxWidth: 600,
                       minHeight: 300, idealHeight: 400, maxHeight: 500)
            }
        }
    }
    
    // MARK: - Background
    
    private var networkBackground: some View {
        Canvas { context, size in
            // Draw animated grid
            let gridSpacing: CGFloat = 50
            let lineWidth: CGFloat = 0.5
            
            context.stroke(
                Path { path in
                    for x in stride(from: 0, through: size.width, by: gridSpacing) {
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: size.height))
                    }
                    for y in stride(from: 0, through: size.height, by: gridSpacing) {
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: size.width, y: y))
                    }
                },
                with: .color(.gray.opacity(0.1)),
                lineWidth: lineWidth
            )
        }
        .conditionalEffect(.breathe, value: animationTrigger, isEnabled: true)
    }
    
    // MARK: - Network Visualization
    
    private func networkVisualization(in geometry: GeometryProxy) -> some View {
        ZStack {
            // Connections
            ForEach(orchestrationService.orchestrationNetwork.connections, id: \.id) { connection in
                ConnectionView(
                    connection: connection,
                    nodes: orchestrationService.orchestrationNetwork.nodes,
                    geometrySize: geometry.size,
                    isHighlighted: selectedNodeId == connection.fromAgentId || selectedNodeId == connection.toAgentId
                )
                .conditionalEffect(.glow(color: .blue, radius: 4), 
                                 value: selectedNodeId == connection.fromAgentId || selectedNodeId == connection.toAgentId,
                                 isEnabled: selectedNodeId == connection.fromAgentId || selectedNodeId == connection.toAgentId)
            }
            
            // Nodes
            ForEach(orchestrationService.orchestrationNetwork.nodes, id: \.agentId) { node in
                NodeView(
                    node: node,
                    performanceMetric: orchestrationService.agentPerformanceMetrics[node.agentId],
                    isSelected: selectedNodeId == node.agentId,
                    isHovered: hoveredNodeId == node.agentId,
                    geometrySize: geometry.size
                )
                .conditionalEffect(.spray(origin: UnitPoint.center), 
                                 value: selectedNodeId == node.agentId,
                                 isEnabled: selectedNodeId == node.agentId)
                .conditionalEffect(.bounce, 
                                 value: hoveredNodeId == node.agentId,
                                 isEnabled: hoveredNodeId == node.agentId)
                .onTapGesture {
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                        selectedNodeId = selectedNodeId == node.agentId ? nil : node.agentId
                    }
                    if selectedNodeId == node.agentId {
                        showNodeDetails = true
                    }
                }
                .onHover { hovering in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        hoveredNodeId = hovering ? node.agentId : nil
                    }
                }
            }
        }
    }
    
    // MARK: - Network Overlay
    
    private var networkOverlay: some View {
        VStack {
            HStack {
                networkStats
                Spacer()
                networkControls
            }
            .padding()
            
            Spacer()
            
            if let selectedNodeId = selectedNodeId,
               let node = orchestrationService.orchestrationNetwork.nodes.first(where: { $0.agentId == selectedNodeId }) {
                selectedNodeInfo(node: node)
                    .transition(.movingParts.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }
    
    // MARK: - Network Stats
    
    private var networkStats: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Network Overview")
                .font(.headline)
                .foregroundColor(.primary)
            
            HStack(spacing: 16) {
                StatItem(title: "Nodes", value: "\\(orchestrationService.orchestrationNetwork.nodes.count)")
                StatItem(title: "Connections", value: "\\(orchestrationService.orchestrationNetwork.connections.count)")
                StatItem(title: "Health", value: String(format: "%.1f%%", orchestrationService.networkHealth.overallScore * 100))
                StatItem(title: "Latency", value: String(format: "%.1fms", orchestrationService.orchestrationNetwork.averageLatency))
            }
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Network Controls
    
    private var networkControls: some View {
        HStack(spacing: 8) {
            Button(action: resetView) {
                Image(systemName: "arrow.clockwise")
                    .font(.title3)
            }
            .help("Reset view")
            
            Button(action: zoomIn) {
                Image(systemName: "plus.magnifyingglass")
                    .font(.title3)
            }
            .help("Zoom in")
            
            Button(action: zoomOut) {
                Image(systemName: "minus.magnifyingglass")
                    .font(.title3)
            }
            .help("Zoom out")
            
            Button(action: centerView) {
                Image(systemName: "target")
                    .font(.title3)
            }
            .help("Center view")
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
    
    // MARK: - Selected Node Info
    
    private func selectedNodeInfo(node: AgentNode) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 8) {
                Text(node.agentId)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text("Type: \\(node.nodeType.rawValue.capitalized)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("Layer: \\(node.layer)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                if let metrics = orchestrationService.agentPerformanceMetrics[node.agentId] {
                    HStack(spacing: 16) {
                        MetricView(title: "Latency", value: String(format: "%.1fms", metrics.latency), color: .blue)
                        MetricView(title: "Success", value: String(format: "%.1f%%", metrics.successRate * 100), color: .green)
                        MetricView(title: "Throughput", value: String(format: "%.0f/min", metrics.throughput), color: .orange)
                    }
                }
            }
            
            Spacer()
            
            Button("Close") {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                    selectedNodeId = nil
                }
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .padding()
    }
    
    // MARK: - Control Actions
    
    private func resetView() {
        withAnimation(.spring(response: 0.8, dampingFraction: 0.8)) {
            networkScale = 1.0
            networkOffset = .zero
        }
    }
    
    private func zoomIn() {
        withAnimation(.easeInOut(duration: 0.3)) {
            networkScale = min(networkScale * 1.2, 3.0)
        }
    }
    
    private func zoomOut() {
        withAnimation(.easeInOut(duration: 0.3)) {
            networkScale = max(networkScale / 1.2, 0.3)
        }
    }
    
    private func centerView() {
        withAnimation(.spring(response: 0.8, dampingFraction: 0.8)) {
            networkOffset = .zero
        }
    }
    
    // MARK: - Gestures
    
    private var magnificationGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                let delta = value / lastScaleValue
                lastScaleValue = value
                networkScale = max(0.3, min(3.0, networkScale * delta))
            }
            .onEnded { _ in
                lastScaleValue = 1.0
            }
    }
    
    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                networkOffset = value.translation
            }
            .onEnded { _ in
                // Add some momentum or constraints if needed
            }
    }
}

// MARK: - Supporting Views

struct StatItem: View {
    let title: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.primary)
                .contentTransition(.numericText())
        }
    }
}

struct MetricView: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(color)
                .contentTransition(.numericText())
        }
    }
}

struct ConnectionView: View {
    let connection: AgentConnection
    let nodes: [AgentNode]
    let geometrySize: CGSize
    let isHighlighted: Bool
    
    var body: some View {
        if let fromNode = nodes.first(where: { $0.agentId == connection.fromAgentId }),
           let toNode = nodes.first(where: { $0.agentId == connection.toAgentId }) {
            
            let fromPosition = adjustPosition(fromNode.position, in: geometrySize)
            let toPosition = adjustPosition(toNode.position, in: geometrySize)
            
            Path { path in
                path.move(to: fromPosition)
                path.addLine(to: toPosition)
            }
            .stroke(
                isHighlighted ? Color.blue : Color.gray.opacity(0.4),
                style: StrokeStyle(
                    lineWidth: isHighlighted ? 3 : max(1, connection.strength * 2),
                    lineCap: .round
                )
            )
            .opacity(connection.isActive ? 1.0 : 0.3)
            .animation(.easeInOut(duration: 0.3), value: isHighlighted)
        }
    }
    
    private func adjustPosition(_ position: CGPoint, in size: CGSize) -> CGPoint {
        CGPoint(
            x: min(max(position.x, 50), size.width - 50),
            y: min(max(position.y, 50), size.height - 50)
        )
    }
}

struct NodeView: View {
    let node: AgentNode
    let performanceMetric: AgentPerformanceMetric?
    let isSelected: Bool
    let isHovered: Bool
    let geometrySize: CGSize
    
    var body: some View {
        let position = adjustPosition(node.position, in: geometrySize)
        
        ZStack {
            // Node background
            Circle()
                .fill(nodeColor.opacity(0.1))
                .stroke(nodeColor, lineWidth: isSelected ? 3 : (isHovered ? 2 : 1))
                .frame(width: nodeSize, height: nodeSize)
                .scaleEffect(isSelected ? 1.2 : (isHovered ? 1.1 : 1.0))
            
            // Node icon
            Image(systemName: nodeIcon)
                .font(.system(size: nodeSize * 0.4))
                .foregroundColor(nodeColor)
            
            // Performance indicator
            if let metric = performanceMetric {
                Circle()
                    .fill(performanceColor(metric.successRate))
                    .frame(width: 8, height: 8)
                    .offset(x: nodeSize/2 - 4, y: -nodeSize/2 + 4)
            }
        }
        .position(position)
        .animation(.spring(response: 0.5, dampingFraction: 0.7), value: isSelected)
        .animation(.easeInOut(duration: 0.2), value: isHovered)
    }
    
    private var nodeSize: CGFloat {
        switch node.nodeType {
        case .root: return 60
        case .coordinator: return 50
        case .worker: return 40
        }
    }
    
    private var nodeColor: Color {
        switch node.nodeType {
        case .root: return .purple
        case .coordinator: return .blue
        case .worker: return .green
        }
    }
    
    private var nodeIcon: String {
        switch node.nodeType {
        case .root: return "crown.fill"
        case .coordinator: return "brain.head.profile"
        case .worker: return "gearshape.fill"
        }
    }
    
    private func performanceColor(_ successRate: Double) -> Color {
        if successRate >= 0.9 {
            return .green
        } else if successRate >= 0.7 {
            return .orange
        } else {
            return .red
        }
    }
    
    private func adjustPosition(_ position: CGPoint, in size: CGSize) -> CGPoint {
        CGPoint(
            x: min(max(position.x, 50), size.width - 50),
            y: min(max(position.y, 50), size.height - 50)
        )
    }
}

struct NodeDetailsView: View {
    let node: AgentNode
    let performanceMetrics: AgentPerformanceMetric?
    @ObservedObject var orchestrationService: EnhancedAgentOrchestrationService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: nodeIcon)
                    .font(.title)
                    .foregroundColor(nodeColor)
                
                VStack(alignment: .leading) {
                    Text(node.agentId)
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text("\\(node.nodeType.rawValue.capitalized) Agent")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            
            Divider()
            
            // Performance metrics
            if let metrics = performanceMetrics {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Performance Metrics")
                        .font(.headline)
                    
                    HStack(spacing: 20) {
                        MetricView(title: "Latency", value: String(format: "%.1f ms", metrics.latency), color: .blue)
                        MetricView(title: "Success Rate", value: String(format: "%.1f%%", metrics.successRate * 100), color: .green)
                        MetricView(title: "Throughput", value: String(format: "%.0f/min", metrics.throughput), color: .orange)
                    }
                }
            }
            
            Divider()
            
            // Control buttons
            HStack(spacing: 12) {
                Button("Start") {
                    Task {
                        await orchestrationService.sendAgentCommand(node.agentId, command: .start)
                    }
                }
                .buttonStyle(.borderedProminent)
                
                Button("Stop") {
                    Task {
                        await orchestrationService.sendAgentCommand(node.agentId, command: .stop)
                    }
                }
                .buttonStyle(.bordered)
                
                Button("Restart") {
                    Task {
                        await orchestrationService.sendAgentCommand(node.agentId, command: .restart)
                    }
                }
                .buttonStyle(.bordered)
            }
            
            Spacer()
        }
        .padding()
    }
    
    private var nodeColor: Color {
        switch node.nodeType {
        case .root: return .purple
        case .coordinator: return .blue
        case .worker: return .green
        }
    }
    
    private var nodeIcon: String {
        switch node.nodeType {
        case .root: return "crown.fill"
        case .coordinator: return "brain.head.profile"
        case .worker: return "gearshape.fill"
        }
    }
}

// MARK: - Preview

#Preview {
    EnhancedNetworkTopologyView(
        orchestrationService: EnhancedAgentOrchestrationService()
    )
}