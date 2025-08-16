import SwiftUI

struct ContextSankeyDiagram: View {
    let contextPaths: [ContextPath]
    let contextNodes: [ContextNode]
    
    @State private var selectedPath: ContextPath?
    @State private var hoveredNode: String?
    @State private var animationProgress: CGFloat = 0
    @State private var showDetails = false
    @State private var viewportScale: CGFloat = 1.0
    @State private var viewportOffset: CGSize = .zero
    
    // Layout parameters
    private let nodeWidth: CGFloat = 120
    private let nodeMinHeight: CGFloat = 20
    private let levelSpacing: CGFloat = 200
    private let verticalSpacing: CGFloat = 10
    private let flowAnimationDuration: Double = 2.0
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                AppTheme.primaryBackground
                    .ignoresSafeArea()
                
                // Main Sankey visualization
                ScrollView([.horizontal, .vertical]) {
                    ZStack {
                        // Background grid
                        backgroundGrid(size: geometry.size)
                        
                        // Sankey diagram
                        sankeyVisualization
                            .scaleEffect(viewportScale)
                            .offset(viewportOffset)
                    }
                    .frame(minWidth: max(geometry.size.width, sankeyWidth), 
                           minHeight: max(geometry.size.height, sankeyHeight))
                }
                
                // Controls overlay
                VStack {
                    HStack {
                        controlsPanel
                        Spacer()
                    }
                    Spacer()
                }
                .padding()
                
                // Path details panel
                if showDetails, let selectedPath = selectedPath {
                    pathDetailsPanel(for: selectedPath, geometry: geometry)
                }
            }
        }
        .onAppear {
            startFlowAnimation()
        }
    }
    
    // MARK: - Sankey Visualization
    
    private var sankeyVisualization: some View {
        ZStack {
            // Flow paths (behind nodes)
            ForEach(sankeyFlows, id: \.id) { flow in
                flowPath(flow)
            }
            
            // Node levels
            ForEach(Array(nodeLevels.enumerated()), id: \.offset) { levelIndex, nodes in
                VStack(alignment: .leading, spacing: verticalSpacing) {
                    ForEach(nodes) { nodeData in
                        sankeyNode(nodeData, level: levelIndex)
                    }
                }
                .position(x: CGFloat(levelIndex) * levelSpacing + nodeWidth / 2,
                         y: sankeyHeight / 2)
            }
            
            // Interactive overlay for path selection
            ForEach(sankeyFlows, id: \.id) { flow in
                flowInteractionArea(flow)
            }
        }
        .frame(width: sankeyWidth, height: sankeyHeight)
    }
    
    // MARK: - Flow Path Rendering
    
    private func flowPath(_ flow: SankeyFlow) -> some View {
        Path { path in
            let startPoint = flow.startPoint
            let endPoint = flow.endPoint
            let controlPoint1 = CGPoint(x: startPoint.x + levelSpacing * 0.3, y: startPoint.y)
            let controlPoint2 = CGPoint(x: endPoint.x - levelSpacing * 0.3, y: endPoint.y)
            
            // Create curved flow path
            path.move(to: startPoint)
            path.addCurve(to: endPoint, control1: controlPoint1, control2: controlPoint2)
        }
        .stroke(
            LinearGradient(
                colors: [
                    flow.pathType.color.opacity(flow.opacity),
                    flow.pathType.color.opacity(flow.opacity * 0.7)
                ],
                startPoint: .leading,
                endPoint: .trailing
            ),
            style: StrokeStyle(lineWidth: flow.thickness, lineCap: .round)
        )
        .overlay(
            // Animated flow particles
            flowParticles(for: flow)
        )
        .animation(.easeInOut(duration: 0.3), value: selectedPath?.id)
    }
    
    private func flowParticles(for flow: SankeyFlow) -> some View {
        ZStack {
            ForEach(0..<flow.particleCount, id: \.self) { index in
                Circle()
                    .fill(flow.pathType.color)
                    .frame(width: 4, height: 4)
                    .offset(x: flow.particleOffset(for: index, progress: animationProgress))
                    .opacity(flow.particleOpacity(for: index, progress: animationProgress))
            }
        }
    }
    
    private func flowInteractionArea(_ flow: SankeyFlow) -> some View {
        Path { path in
            let startPoint = flow.startPoint
            let endPoint = flow.endPoint
            let controlPoint1 = CGPoint(x: startPoint.x + levelSpacing * 0.3, y: startPoint.y)
            let controlPoint2 = CGPoint(x: endPoint.x - levelSpacing * 0.3, y: endPoint.y)
            
            path.move(to: startPoint)
            path.addCurve(to: endPoint, control1: controlPoint1, control2: controlPoint2)
        }
        .stroke(Color.clear, lineWidth: flow.thickness + 20) // Invisible wider area for interaction
        .contentShape(Path { path in
            let startPoint = flow.startPoint
            let endPoint = flow.endPoint
            let controlPoint1 = CGPoint(x: startPoint.x + levelSpacing * 0.3, y: startPoint.y)
            let controlPoint2 = CGPoint(x: endPoint.x - levelSpacing * 0.3, y: endPoint.y)
            
            path.move(to: startPoint)
            path.addCurve(to: endPoint, control1: controlPoint1, control2: controlPoint2)
        })
        .onTapGesture {
            withAnimation(AppTheme.normalAnimation) {
                if selectedPath?.id == flow.contextPath.id {
                    selectedPath = nil
                    showDetails = false
                } else {
                    selectedPath = flow.contextPath
                    showDetails = true
                }
            }
        }
    }
    
    // MARK: - Node Rendering
    
    private func sankeyNode(_ nodeData: SankeyNode, level: Int) -> some View {
        VStack(spacing: 4) {
            // Node rectangle
            RoundedRectangle(cornerRadius: 8)
                .fill(nodeData.gradient)
                .frame(width: nodeWidth, height: nodeData.height)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(
                            hoveredNode == nodeData.contextNode.id ? AppTheme.accentColor : AppTheme.borderColor,
                            lineWidth: hoveredNode == nodeData.contextNode.id ? 2 : 1
                        )
                )
                .overlay(
                    // Node icon and label
                    VStack(spacing: 2) {
                        Image(systemName: nodeData.contextNode.type.icon)
                            .font(.system(size: 16))
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text(nodeData.displayName)
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.primaryText)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                    }
                    .padding(8)
                )
            
            // Node metadata
            VStack(spacing: 2) {
                Text("Importance: \(String(format: "%.1f%%", nodeData.contextNode.metadata.importance * 100))")
                    .font(AppTheme.caption2)
                    .foregroundColor(AppTheme.tertiaryText)
                
                Text("\(nodeData.incomingFlows) in • \(nodeData.outgoingFlows) out")
                    .font(AppTheme.caption2)
                    .foregroundColor(AppTheme.tertiaryText)
            }
        }
        .scaleEffect(hoveredNode == nodeData.contextNode.id ? 1.05 : 1.0)
        .animation(AppTheme.quickAnimation, value: hoveredNode)
        .onHover { isHovering in
            hoveredNode = isHovering ? nodeData.contextNode.id : nil
        }
    }
    
    // MARK: - Controls Panel
    
    private var controlsPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sankey Controls")
                .font(AppTheme.headline)
                .foregroundColor(AppTheme.primaryText)
            
            VStack(alignment: .leading, spacing: 8) {
                // Zoom controls
                HStack {
                    Button(action: { zoomIn() }) {
                        Image(systemName: "plus.magnifyingglass")
                    }
                    .buttonStyle(.bordered)
                    
                    Button(action: { zoomOut() }) {
                        Image(systemName: "minus.magnifyingglass")
                    }
                    .buttonStyle(.bordered)
                    
                    Button(action: { resetZoom() }) {
                        Image(systemName: "arrow.up.left.and.down.right.magnifyingglass")
                    }
                    .buttonStyle(.bordered)
                }
                
                // Animation controls
                HStack {
                    Button(action: { startFlowAnimation() }) {
                        Image(systemName: "play.fill")
                    }
                    .buttonStyle(.bordered)
                    
                    Button(action: { pauseFlowAnimation() }) {
                        Image(systemName: "pause.fill")
                    }
                    .buttonStyle(.bordered)
                }
                
                // Filter info
                if !contextPaths.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Showing \(contextPaths.count) paths")
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.secondaryText)
                        
                        Text("\(contextNodes.count) contexts")
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
            }
        }
        .padding(12)
        .background(AppTheme.surfaceBackground.opacity(0.9))
        .cornerRadius(8)
        .shadow(color: AppTheme.lightShadow, radius: 4)
    }
    
    // MARK: - Path Details Panel
    
    private func pathDetailsPanel(for path: ContextPath, geometry: GeometryProxy) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Context Path Details")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(path.pathType.displayName)
                        .font(AppTheme.caption)
                        .foregroundColor(path.pathType.color)
                }
                
                Spacer()
                
                Button(action: {
                    withAnimation(AppTheme.normalAnimation) {
                        showDetails = false
                        selectedPath = nil
                    }
                }) {
                    Image(systemName: "xmark")
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
            }
            
            VStack(alignment: .leading, spacing: 12) {
                DetailRow(label: "Path ID", value: path.id)
                DetailRow(label: "Relevance Score", value: String(format: "%.1f%%", path.relevanceScore * 100))
                DetailRow(label: "Path Type", value: path.pathType.displayName)
                DetailRow(label: "Timestamp", value: path.timestamp.formatted())
                
                if !path.intermediates.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Intermediate Steps:")
                            .font(AppTheme.caption)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        ForEach(path.intermediates, id: \.self) { intermediate in
                            Text("• \(intermediate)")
                                .font(AppTheme.caption)
                                .foregroundColor(AppTheme.secondaryText)
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
        .position(x: geometry.size.width - 170, y: geometry.size.height / 2)
    }
    
    // MARK: - Background Grid
    
    private func backgroundGrid(size: CGSize) -> some View {
        ZStack {
            // Vertical lines
            ForEach(0..<Int(sankeyWidth / 50), id: \.self) { index in
                Rectangle()
                    .fill(AppTheme.separator.opacity(0.3))
                    .frame(width: 1)
                    .position(x: CGFloat(index) * 50, y: sankeyHeight / 2)
            }
            
            // Horizontal lines
            ForEach(0..<Int(sankeyHeight / 50), id: \.self) { index in
                Rectangle()
                    .fill(AppTheme.separator.opacity(0.3))
                    .frame(height: 1)
                    .position(x: sankeyWidth / 2, y: CGFloat(index) * 50)
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var sankeyWidth: CGFloat {
        CGFloat(max(nodeLevels.count, 3)) * levelSpacing + nodeWidth
    }
    
    private var sankeyHeight: CGFloat {
        let maxNodesInLevel = nodeLevels.map { $0.count }.max() ?? 1
        return CGFloat(maxNodesInLevel) * (nodeMinHeight + verticalSpacing) + 200
    }
    
    private var sankeyFlows: [SankeyFlow] {
        contextPaths.compactMap { path in
            guard let sourceNode = contextNodes.first(where: { $0.id == path.sourceId }),
                  let destinationNode = contextNodes.first(where: { $0.id == path.destinationId }),
                  let sourceData = findNodeData(for: sourceNode),
                  let destinationData = findNodeData(for: destinationNode) else {
                return nil
            }
            
            return SankeyFlow(
                contextPath: path,
                startPoint: sourceData.outputPoint,
                endPoint: destinationData.inputPoint,
                thickness: max(5, path.relevanceScore * 40),
                opacity: selectedPath == nil ? 0.7 : (selectedPath?.id == path.id ? 1.0 : 0.3),
                pathType: path.pathType
            )
        }
    }
    
    private var nodeLevels: [[SankeyNode]] {
        // Group nodes by their position in the flow
        let levels = createNodeLevels()
        return levels.map { levelNodes in
            levelNodes.map { contextNode in
                createSankeyNode(from: contextNode, in: levels)
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func createNodeLevels() -> [[ContextNode]] {
        // Simplified leveling - in a real implementation, this would use topological sorting
        var levels: [[ContextNode]] = [[], [], []]  // Source, Intermediate, Destination
        
        for node in contextNodes {
            switch node.type {
            case .source, .document, .code, .memory:
                levels[0].append(node)
            case .intermediate, .query:
                levels[1].append(node)
            case .response:
                levels[2].append(node)
            default:
                levels[1].append(node)
            }
        }
        
        return levels.filter { !$0.isEmpty }
    }
    
    private func createSankeyNode(from contextNode: ContextNode, in levels: [[ContextNode]]) -> SankeyNode {
        let incomingFlows = contextPaths.filter { $0.destinationId == contextNode.id }.count
        let outgoingFlows = contextPaths.filter { $0.sourceId == contextNode.id }.count
        let height = max(nodeMinHeight, CGFloat(incomingFlows + outgoingFlows) * 15 + 40)
        
        return SankeyNode(
            contextNode: contextNode,
            height: height,
            incomingFlows: incomingFlows,
            outgoingFlows: outgoingFlows
        )
    }
    
    private func findNodeData(for contextNode: ContextNode) -> SankeyNode? {
        for level in nodeLevels {
            if let node = level.first(where: { $0.contextNode.id == contextNode.id }) {
                return node
            }
        }
        return nil
    }
    
    // MARK: - Animation Methods
    
    private func startFlowAnimation() {
        withAnimation(.linear(duration: flowAnimationDuration).repeatForever(autoreverses: false)) {
            animationProgress = 1.0
        }
    }
    
    private func pauseFlowAnimation() {
        withAnimation(.linear(duration: 0)) {
            animationProgress = animationProgress
        }
    }
    
    // MARK: - Zoom Methods
    
    private func zoomIn() {
        withAnimation(AppTheme.normalAnimation) {
            viewportScale = min(viewportScale * 1.2, 3.0)
        }
    }
    
    private func zoomOut() {
        withAnimation(AppTheme.normalAnimation) {
            viewportScale = max(viewportScale / 1.2, 0.5)
        }
    }
    
    private func resetZoom() {
        withAnimation(AppTheme.normalAnimation) {
            viewportScale = 1.0
            viewportOffset = .zero
        }
    }
}

// MARK: - Supporting Data Structures

struct SankeyFlow: Identifiable {
    let id = UUID()
    let contextPath: ContextPath
    let startPoint: CGPoint
    let endPoint: CGPoint
    let thickness: CGFloat
    let opacity: Double
    let pathType: ContextPath.ContextPathType
    
    var particleCount: Int {
        max(1, Int(thickness / 10))
    }
    
    func particleOffset(for index: Int, progress: CGFloat) -> CGFloat {
        let pathLength = distance(from: startPoint, to: endPoint)
        let particleProgress = (progress + CGFloat(index) * 0.2).truncatingRemainder(dividingBy: 1.0)
        return pathLength * particleProgress - pathLength / 2
    }
    
    func particleOpacity(for index: Int, progress: CGFloat) -> Double {
        let particleProgress = (progress + CGFloat(index) * 0.2).truncatingRemainder(dividingBy: 1.0)
        return Double(max(0, min(1, sin(particleProgress * .pi))))
    }
    
    private func distance(from point1: CGPoint, to point2: CGPoint) -> CGFloat {
        sqrt(pow(point2.x - point1.x, 2) + pow(point2.y - point1.y, 2))
    }
}

struct SankeyNode: Identifiable {
    let id = UUID()
    let contextNode: ContextNode
    let height: CGFloat
    let incomingFlows: Int
    let outgoingFlows: Int
    
    var displayName: String {
        let maxLength = 15
        return contextNode.content.count > maxLength 
            ? String(contextNode.content.prefix(maxLength)) + "..." 
            : contextNode.content
    }
    
    var gradient: LinearGradient {
        LinearGradient(
            colors: [
                contextNode.type.color.opacity(0.8),
                contextNode.type.color.opacity(0.6)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
    
    var inputPoint: CGPoint {
        // This would be calculated based on actual layout position
        CGPoint(x: 0, y: height / 2)
    }
    
    var outputPoint: CGPoint {
        // This would be calculated based on actual layout position  
        CGPoint(x: 120, y: height / 2)
    }
}

// DetailRow is defined in SharedUIComponents.swift

#Preview {
    ContextSankeyDiagram(
        contextPaths: [],
        contextNodes: []
    )
    .frame(width: 1000, height: 600)
}