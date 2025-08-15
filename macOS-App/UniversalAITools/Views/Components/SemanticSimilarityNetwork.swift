import SwiftUI
import simd

struct SemanticSimilarityNetwork: View {
    let nodes: [ContextNode]
    let edges: [SimilarityEdge]
    let clusters: [ContextCluster]
    
    @State private var selectedNode: ContextNode?
    @State private var hoveredNode: String?
    @State private var selectedCluster: ContextCluster?
    @State private var is3DMode = false
    @State private var physicsEnabled = true
    @State private var showNodeLabels = true
    @State private var showClusters = true
    @State private var simulationRunning = true
    
    // Physics simulation state
    @State private var nodePositions: [String: SIMD3<Float>] = [:]
    @State private var nodeVelocities: [String: SIMD3<Float>] = [:]
    @State private var simulationTimer: Timer?
    
    // View state
    @State private var viewportScale: CGFloat = 1.0
    @State private var viewportOffset: CGSize = .zero
    @State private var rotationX: Float = 0
    @State private var rotationY: Float = 0
    
    // Simulation parameters
    private let repulsionStrength: Float = 50.0
    private let attractionStrength: Float = 0.5
    private let dampingFactor: Float = 0.9
    private let timeStep: Float = 0.016
    private let maxVelocity: Float = 5.0
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                AppTheme.primaryBackground
                    .ignoresSafeArea()
                
                // Network visualization
                networkView(size: geometry.size)
                
                // Controls overlay
                VStack {
                    HStack {
                        controlsPanel
                        Spacer()
                    }
                    Spacer()
                    HStack {
                        Spacer()
                        simulationControls
                    }
                }
                .padding()
                
                // Node details panel
                if let selectedNode = selectedNode {
                    nodeDetailsPanel(for: selectedNode, geometry: geometry)
                }
                
                // Cluster details panel
                if let selectedCluster = selectedCluster {
                    clusterDetailsPanel(for: selectedCluster, geometry: geometry)
                }
            }
        }
        .onAppear {
            initializePhysicsSimulation(in: CGSize(width: 800, height: 600))
            startSimulation()
        }
        .onDisappear {
            stopSimulation()
        }
    }
    
    // MARK: - Network View
    
    private func networkView(size: CGSize) -> some View {
        ZStack {
            // Background grid
            if !is3DMode {
                backgroundGrid(size: size)
            }
            
            // Cluster visualization (behind edges and nodes)
            if showClusters {
                ForEach(clusters) { cluster in
                    clusterVisualization(cluster, in: size)
                }
            }
            
            // Similarity edges
            ForEach(edges) { edge in
                similarityEdge(edge, in: size)
            }
            
            // Context nodes
            ForEach(nodes) { node in
                contextNodeView(node, in: size)
            }
        }
        .scaleEffect(viewportScale)
        .offset(viewportOffset)
        .rotation3DEffect(
            .init(radians: is3DMode ? Double(rotationX) : 0),
            axis: (x: 1, y: 0, z: 0)
        )
        .rotation3DEffect(
            .init(radians: is3DMode ? Double(rotationY) : 0),
            axis: (x: 0, y: 1, z: 0)
        )
        .gesture(
            SimultaneousGesture(
                // Pan gesture
                DragGesture()
                    .onChanged { value in
                        if is3DMode {
                            rotationX += Float(value.translation.y) * 0.01
                            rotationY += Float(value.translation.x) * 0.01
                        } else {
                            viewportOffset = value.translation
                        }
                    },
                
                // Zoom gesture
                MagnificationGesture()
                    .onChanged { value in
                        viewportScale = max(0.5, min(3.0, value))
                    }
            )
        )
    }
    
    // MARK: - Node Visualization
    
    private func contextNodeView(_ node: ContextNode, in size: CGSize) -> some View {
        let position = getNodePosition(node, in: size)
        let isSelected = selectedNode?.id == node.id
        let isHovered = hoveredNode == node.id
        let isHighlighted = isSelected || isHovered || isConnectedToSelected(node)
        
        return ZStack {
            // Node circle
            Circle()
                .fill(node.color)
                .frame(width: node.size, height: node.size)
                .overlay(
                    Circle()
                        .stroke(
                            isHighlighted ? AppTheme.accentColor : AppTheme.borderColor,
                            lineWidth: isHighlighted ? 3 : 1
                        )
                )
                .shadow(
                    color: isHighlighted ? node.color.opacity(0.6) : AppTheme.lightShadow,
                    radius: isHighlighted ? 8 : 2
                )
            
            // Node icon
            Image(systemName: node.type.icon)
                .font(.system(size: node.size * 0.3))
                .foregroundColor(AppTheme.primaryText)
            
            // Node label
            if showNodeLabels && (isHighlighted || viewportScale > 1.5) {
                VStack {
                    Spacer()
                    Text(String(node.content.prefix(20)))
                        .font(AppTheme.caption2)
                        .foregroundColor(AppTheme.primaryText)
                        .padding(4)
                        .background(AppTheme.surfaceBackground.opacity(0.9))
                        .cornerRadius(4)
                        .offset(y: node.size / 2 + 10)
                }
            }
        }
        .position(position)
        .scaleEffect(isHighlighted ? 1.2 : 1.0)
        .animation(AppTheme.quickAnimation, value: isHighlighted)
        .onTapGesture {
            withAnimation(AppTheme.normalAnimation) {
                selectedNode = selectedNode?.id == node.id ? nil : node
                selectedCluster = nil
            }
        }
        .onHover { isHovering in
            hoveredNode = isHovering ? node.id : nil
        }
    }
    
    // MARK: - Edge Visualization
    
    private func similarityEdge(_ edge: SimilarityEdge, in size: CGSize) -> some View {
        guard let sourceNode = nodes.first(where: { $0.id == edge.sourceId }),
              let targetNode = nodes.first(where: { $0.id == edge.targetId }) else {
            return AnyView(EmptyView())
        }
        
        let sourcePosition = getNodePosition(sourceNode, in: size)
        let targetPosition = getNodePosition(targetNode, in: size)
        
        let isHighlighted = selectedNode?.id == edge.sourceId || 
                           selectedNode?.id == edge.targetId ||
                           hoveredNode == edge.sourceId ||
                           hoveredNode == edge.targetId
        
        return AnyView(
            Path { path in
                path.move(to: sourcePosition)
                
                // Create curved edge for better visualization
                let midPoint = CGPoint(
                    x: (sourcePosition.x + targetPosition.x) / 2,
                    y: (sourcePosition.y + targetPosition.y) / 2
                )
                let offset = CGFloat(edge.similarityScore * 50)
                let controlPoint = CGPoint(
                    x: midPoint.x + offset * sin(atan2(targetPosition.y - sourcePosition.y, targetPosition.x - sourcePosition.x) + .pi / 2),
                    y: midPoint.y - offset * cos(atan2(targetPosition.y - sourcePosition.y, targetPosition.x - sourcePosition.x) + .pi / 2)
                )
                
                path.addQuadCurve(to: targetPosition, control: controlPoint)
            }
            .stroke(
                edge.color.opacity(isHighlighted ? 1.0 : 0.4),
                style: StrokeStyle(
                    lineWidth: CGFloat(edge.strength * 3),
                    lineCap: .round
                )
            )
            .animation(AppTheme.quickAnimation, value: isHighlighted)
        )
    }
    
    // MARK: - Cluster Visualization
    
    private func clusterVisualization(_ cluster: ContextCluster, in size: CGSize) -> some View {
        let clusterNodes = nodes.filter { cluster.members.contains($0.id) }
        guard !clusterNodes.isEmpty else { return AnyView(EmptyView()) }
        
        let positions = clusterNodes.map { getNodePosition($0, in: size) }
        let center = CGPoint(
            x: positions.map { $0.x }.reduce(0, +) / CGFloat(positions.count),
            y: positions.map { $0.y }.reduce(0, +) / CGFloat(positions.count)
        )
        
        let isSelected = selectedCluster?.id == cluster.id
        
        return AnyView(
            ZStack {
                // Cluster boundary
                Circle()
                    .stroke(
                        cluster.color.opacity(isSelected ? 0.8 : 0.3),
                        style: StrokeStyle(lineWidth: isSelected ? 3 : 1, dash: [5, 3])
                    )
                    .frame(width: cluster.radius * 2, height: cluster.radius * 2)
                    .position(center)
                
                // Cluster fill
                Circle()
                    .fill(cluster.color.opacity(isSelected ? 0.2 : 0.1))
                    .frame(width: cluster.radius * 2, height: cluster.radius * 2)
                    .position(center)
                
                // Cluster label
                if isSelected || viewportScale > 1.2 {
                    VStack {
                        Text(cluster.topic)
                            .font(AppTheme.caption)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text("\(cluster.members.count) nodes")
                            .font(AppTheme.caption2)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .padding(6)
                    .background(AppTheme.surfaceBackground.opacity(0.9))
                    .cornerRadius(6)
                    .position(x: center.x, y: center.y - cluster.radius - 20)
                }
            }
            .onTapGesture {
                withAnimation(AppTheme.normalAnimation) {
                    selectedCluster = selectedCluster?.id == cluster.id ? nil : cluster
                    selectedNode = nil
                }
            }
        )
    }
    
    // MARK: - Controls
    
    private var controlsPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Network Controls")
                .font(AppTheme.headline)
                .foregroundColor(AppTheme.primaryText)
            
            VStack(alignment: .leading, spacing: 8) {
                // View mode toggle
                Toggle("3D Mode", isOn: $is3DMode)
                    .toggleStyle(.switch)
                
                // Display options
                Toggle("Show Node Labels", isOn: $showNodeLabels)
                    .toggleStyle(.switch)
                
                Toggle("Show Clusters", isOn: $showClusters)
                    .toggleStyle(.switch)
                
                // Physics toggle
                Toggle("Physics Simulation", isOn: $physicsEnabled)
                    .toggleStyle(.switch)
                    .onChange(of: physicsEnabled) { enabled in
                        if enabled {
                            startSimulation()
                        } else {
                            stopSimulation()
                        }
                    }
                
                // Zoom controls
                HStack {
                    Button("Zoom In") { zoomIn() }
                        .buttonStyle(.bordered)
                        .font(AppTheme.caption)
                    
                    Button("Zoom Out") { zoomOut() }
                        .buttonStyle(.bordered)
                        .font(AppTheme.caption)
                    
                    Button("Reset") { resetView() }
                        .buttonStyle(.bordered)
                        .font(AppTheme.caption)
                }
            }
            
            // Network statistics
            VStack(alignment: .leading, spacing: 4) {
                Text("Network Stats")
                    .font(AppTheme.caption)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.primaryText)
                
                Text("Nodes: \(nodes.count)")
                    .font(AppTheme.caption2)
                    .foregroundColor(AppTheme.secondaryText)
                
                Text("Edges: \(edges.count)")
                    .font(AppTheme.caption2)
                    .foregroundColor(AppTheme.secondaryText)
                
                Text("Clusters: \(clusters.count)")
                    .font(AppTheme.caption2)
                    .foregroundColor(AppTheme.secondaryText)
                
                if let avgSimilarity = calculateAverageSimilarity() {
                    Text("Avg Similarity: \(String(format: "%.1f%%", avgSimilarity * 100))")
                        .font(AppTheme.caption2)
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
        }
        .padding(12)
        .background(AppTheme.surfaceBackground.opacity(0.9))
        .cornerRadius(8)
        .shadow(color: AppTheme.lightShadow, radius: 4)
    }
    
    private var simulationControls: some View {
        VStack(alignment: .trailing, spacing: 8) {
            HStack {
                Button(simulationRunning ? "Pause" : "Start") {
                    if simulationRunning {
                        stopSimulation()
                    } else {
                        startSimulation()
                    }
                }
                .buttonStyle(.borderedProminent)
                .font(AppTheme.caption)
                
                Button("Reset Layout") {
                    resetLayout()
                }
                .buttonStyle(.bordered)
                .font(AppTheme.caption)
            }
            
            if simulationRunning {
                HStack {
                    Text("Simulating...")
                        .font(AppTheme.caption2)
                        .foregroundColor(AppTheme.secondaryText)
                    
                    ProgressView()
                        .scaleEffect(0.6)
                }
            }
        }
        .padding(8)
        .background(AppTheme.surfaceBackground.opacity(0.9))
        .cornerRadius(6)
    }
    
    // MARK: - Details Panels
    
    private func nodeDetailsPanel(for node: ContextNode, geometry: GeometryProxy) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Node Details")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    HStack {
                        Image(systemName: node.type.icon)
                            .foregroundColor(node.type.color)
                        Text(node.type.rawValue.capitalized)
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
                
                Spacer()
                
                Button(action: {
                    withAnimation(AppTheme.normalAnimation) {
                        selectedNode = nil
                    }
                }) {
                    Image(systemName: "xmark")
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                DetailRow(label: "Content", value: String(node.content.prefix(100)))
                DetailRow(label: "Importance", value: String(format: "%.1f%%", node.metadata.importance * 100))
                DetailRow(label: "Confidence", value: String(format: "%.1f%%", node.metadata.confidence * 100))
                DetailRow(label: "Access Count", value: "\(node.metadata.accessCount)")
                DetailRow(label: "Last Accessed", value: node.metadata.lastAccessed.formatted(date: .abbreviated, time: .shortened))
                
                if !node.metadata.tags.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Tags:")
                            .font(AppTheme.caption)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 4) {
                            ForEach(node.metadata.tags, id: \.self) { tag in
                                Text(tag)
                                    .font(AppTheme.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(AppTheme.tertiaryBackground)
                                    .cornerRadius(4)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                        }
                    }
                }
                
                // Connected nodes
                let connectedNodes = getConnectedNodes(to: node)
                if !connectedNodes.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Connected to \(connectedNodes.count) nodes:")
                            .font(AppTheme.caption)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        ForEach(connectedNodes.prefix(5), id: \.id) { connectedNode in
                            HStack {
                                Image(systemName: connectedNode.type.icon)
                                    .foregroundColor(connectedNode.type.color)
                                    .frame(width: 12)
                                
                                Text(String(connectedNode.content.prefix(30)))
                                    .font(AppTheme.caption2)
                                    .foregroundColor(AppTheme.secondaryText)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
        .shadow(color: AppTheme.mediumShadow, radius: 8)
        .frame(width: 320)
        .position(x: geometry.size.width - 180, y: geometry.size.height / 2)
    }
    
    private func clusterDetailsPanel(for cluster: ContextCluster, geometry: GeometryProxy) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Cluster Details")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(cluster.topic)
                        .font(AppTheme.caption)
                        .foregroundColor(cluster.color)
                }
                
                Spacer()
                
                Button(action: {
                    withAnimation(AppTheme.normalAnimation) {
                        selectedCluster = nil
                    }
                }) {
                    Image(systemName: "xmark")
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                DetailRow(label: "Members", value: "\(cluster.members.count) nodes")
                DetailRow(label: "Coherence", value: String(format: "%.1f%%", cluster.coherenceScore * 100))
                DetailRow(label: "Average Relevance", value: String(format: "%.1f%%", cluster.metadata.averageRelevance * 100))
                DetailRow(label: "Dominant Type", value: cluster.metadata.dominantType.rawValue.capitalized)
                DetailRow(label: "Created", value: cluster.metadata.createdAt.formatted(date: .abbreviated, time: .omitted))
                
                if !cluster.metadata.keywords.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Keywords:")
                            .font(AppTheme.caption)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 4) {
                            ForEach(cluster.metadata.keywords, id: \.self) { keyword in
                                Text(keyword)
                                    .font(AppTheme.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(cluster.color.opacity(0.2))
                                    .cornerRadius(4)
                                    .foregroundColor(AppTheme.primaryText)
                            }
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
        .shadow(color: AppTheme.mediumShadow, radius: 8)
        .frame(width: 300)
        .position(x: 170, y: geometry.size.height / 2)
    }
    
    // MARK: - Background Grid
    
    private func backgroundGrid(size: CGSize) -> some View {
        ZStack {
            // Major grid lines
            ForEach(0..<Int(size.width / 100), id: \.self) { index in
                Rectangle()
                    .fill(AppTheme.separator.opacity(0.3))
                    .frame(width: 1)
                    .position(x: CGFloat(index) * 100, y: size.height / 2)
            }
            
            ForEach(0..<Int(size.height / 100), id: \.self) { index in
                Rectangle()
                    .fill(AppTheme.separator.opacity(0.3))
                    .frame(height: 1)
                    .position(x: size.width / 2, y: CGFloat(index) * 100)
            }
            
            // Minor grid lines
            ForEach(0..<Int(size.width / 50), id: \.self) { index in
                Rectangle()
                    .fill(AppTheme.separator.opacity(0.1))
                    .frame(width: 1)
                    .position(x: CGFloat(index) * 50, y: size.height / 2)
            }
            
            ForEach(0..<Int(size.height / 50), id: \.self) { index in
                Rectangle()
                    .fill(AppTheme.separator.opacity(0.1))
                    .frame(height: 1)
                    .position(x: size.width / 2, y: CGFloat(index) * 50)
            }
        }
    }
    
    // MARK: - Physics Simulation
    
    private func initializePhysicsSimulation(in size: CGSize) {
        // Initialize random positions for nodes
        for node in nodes {
            let position = SIMD3<Float>(
                Float.random(in: 50...(Float(size.width) - 50)),
                Float.random(in: 50...(Float(size.height) - 50)),
                is3DMode ? Float.random(in: -100...100) : 0
            )
            nodePositions[node.id] = position
            nodeVelocities[node.id] = SIMD3<Float>(0, 0, 0)
        }
    }
    
    private func startSimulation() {
        simulationRunning = true
        simulationTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(timeStep), repeats: true) { _ in
            updatePhysicsSimulation()
        }
    }
    
    private func stopSimulation() {
        simulationRunning = false
        simulationTimer?.invalidate()
        simulationTimer = nil
    }
    
    private func updatePhysicsSimulation() {
        guard physicsEnabled && !nodePositions.isEmpty else { return }
        
        var forces: [String: SIMD3<Float>] = [:]
        
        // Initialize forces
        for node in nodes {
            forces[node.id] = SIMD3<Float>(0, 0, 0)
        }
        
        // Apply repulsion forces between all nodes
        for i in 0..<nodes.count {
            for j in (i+1)..<nodes.count {
                let node1 = nodes[i]
                let node2 = nodes[j]
                
                guard let pos1 = nodePositions[node1.id],
                      let pos2 = nodePositions[node2.id] else { continue }
                
                let delta = pos1 - pos2
                let distance = length(delta)
                
                if distance > 0.1 {
                    let repulsionForce = normalize(delta) * (repulsionStrength / (distance * distance))
                    forces[node1.id]! += repulsionForce
                    forces[node2.id]! -= repulsionForce
                }
            }
        }
        
        // Apply attraction forces along edges
        for edge in edges {
            guard let sourcePos = nodePositions[edge.sourceId],
                  let targetPos = nodePositions[edge.targetId] else { continue }
            
            let delta = targetPos - sourcePos
            let distance = length(delta)
            
            if distance > 0.1 {
                let attractionForce = normalize(delta) * (attractionStrength * edge.similarityScore * distance)
                forces[edge.sourceId]! += attractionForce
                forces[edge.targetId]! -= attractionForce
            }
        }
        
        // Update velocities and positions
        for node in nodes {
            guard var velocity = nodeVelocities[node.id],
                  var position = nodePositions[node.id],
                  let force = forces[node.id] else { continue }
            
            // Update velocity
            velocity += force * timeStep
            velocity *= dampingFactor
            
            // Limit velocity
            let speed = length(velocity)
            if speed > maxVelocity {
                velocity = normalize(velocity) * maxVelocity
            }
            
            // Update position
            position += velocity * timeStep
            
            // Apply boundary constraints (simple bounce)
            if position.x < 50 || position.x > 750 {
                velocity.x *= -0.8
                position.x = max(50, min(750, position.x))
            }
            if position.y < 50 || position.y > 550 {
                velocity.y *= -0.8
                position.y = max(50, min(550, position.y))
            }
            
            nodeVelocities[node.id] = velocity
            nodePositions[node.id] = position
        }
    }
    
    private func resetLayout() {
        guard let firstViewSize = UIApplication.shared.windows.first?.bounds.size else { return }
        initializePhysicsSimulation(in: CGSize(width: firstViewSize.width * 0.8, height: firstViewSize.height * 0.8))
    }
    
    // MARK: - Helper Methods
    
    private func getNodePosition(_ node: ContextNode, in size: CGSize) -> CGPoint {
        if let position = nodePositions[node.id] {
            return CGPoint(x: CGFloat(position.x), y: CGFloat(position.y))
        } else {
            // Fallback to static position based on node properties
            return CGPoint(
                x: size.width * 0.2 + CGFloat(node.content.hashValue % 500),
                y: size.height * 0.2 + CGFloat(node.id.hashValue % 300)
            )
        }
    }
    
    private func isConnectedToSelected(_ node: ContextNode) -> Bool {
        guard let selectedNode = selectedNode else { return false }
        
        return edges.contains { edge in
            (edge.sourceId == selectedNode.id && edge.targetId == node.id) ||
            (edge.targetId == selectedNode.id && edge.sourceId == node.id)
        }
    }
    
    private func getConnectedNodes(to node: ContextNode) -> [ContextNode] {
        let connectedIds = edges.compactMap { edge -> String? in
            if edge.sourceId == node.id {
                return edge.targetId
            } else if edge.targetId == node.id {
                return edge.sourceId
            }
            return nil
        }
        
        return nodes.filter { connectedIds.contains($0.id) }
    }
    
    private func calculateAverageSimilarity() -> Float? {
        guard !edges.isEmpty else { return nil }
        let total = edges.map { $0.similarityScore }.reduce(0, +)
        return total / Float(edges.count)
    }
    
    // MARK: - View Controls
    
    private func zoomIn() {
        withAnimation(AppTheme.normalAnimation) {
            viewportScale = min(viewportScale * 1.3, 3.0)
        }
    }
    
    private func zoomOut() {
        withAnimation(AppTheme.normalAnimation) {
            viewportScale = max(viewportScale / 1.3, 0.3)
        }
    }
    
    private func resetView() {
        withAnimation(AppTheme.normalAnimation) {
            viewportScale = 1.0
            viewportOffset = .zero
            rotationX = 0
            rotationY = 0
        }
    }
}

#Preview {
    SemanticSimilarityNetwork(
        nodes: [],
        edges: [],
        clusters: []
    )
    .frame(width: 1000, height: 700)
}