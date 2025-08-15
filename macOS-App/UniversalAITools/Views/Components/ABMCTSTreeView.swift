import SwiftUI

/// Interactive AB-MCTS decision tree visualization component
struct ABMCTSTreeView: View {
    @ObservedObject var webSocketService: AgentWebSocketService
    @State private var selectedNode: ABMCTSNode?
    @State private var expandedNodes: Set<String> = []
    @State private var zoomScale: CGFloat = 1.0
    @State private var panOffset: CGSize = .zero
    @State private var showNodeDetails = false
    @State private var animateTreeUpdate = false
    @State private var viewportSize: CGSize = .zero
    
    // Tree layout configuration
    private let nodeRadius: CGFloat = 25
    private let levelSpacing: CGFloat = 100
    private let nodeSpacing: CGFloat = 60
    private let maxVisibleDepth = 6
    
    var body: some View {
        ZStack {
            // Background with grid pattern
            treeBackground
            
            // Main tree visualization
            if let rootNode = webSocketService.abmctsTree {
                ScrollView([.horizontal, .vertical]) {
                    ZStack {
                        // Tree connections (edges)
                        treeConnections(rootNode: rootNode)
                        
                        // Tree nodes
                        treeNodes(rootNode: rootNode)
                    }
                    .scaleEffect(zoomScale)
                    .offset(panOffset)
                    .onTapGesture(count: 2) {
                        withAnimation(.spring()) {
                            resetZoomAndPan()
                        }
                    }
                }
                .gesture(magnificationGesture)
                .gesture(dragGesture)
                .clipped()
            } else {
                // Empty state
                emptyTreeState
            }
            
            // Tree controls overlay
            VStack {
                HStack {
                    treeControls
                    Spacer()
                    treeStats
                }
                .padding()
                
                Spacer()
                
                // Bottom toolbar
                if selectedNode != nil {
                    nodeActionToolbar
                        .padding()
                }
            }
        }
        .background(.ultraThinMaterial)
        .onReceive(webSocketService.$abmctsTree) { _ in
            withAnimation(.easeInOut(duration: 0.5)) {
                animateTreeUpdate.toggle()
            }
        }
        .sheet(isPresented: $showNodeDetails) {
            if let node = selectedNode {
                NodeDetailView(node: node, webSocketService: webSocketService)
                    .frame(minWidth: 500, idealWidth: 600, maxWidth: 800,
                           minHeight: 400, idealHeight: 500, maxHeight: 700)
            }
        }
        .onAppear {
            initializeExpandedNodes()
        }
    }
    
    // MARK: - Tree Background
    
    private var treeBackground: some View {
        ZStack {
            // Gradient background
            LinearGradient(
                colors: [
                    Color.black.opacity(0.1),
                    Color.blue.opacity(0.05),
                    Color.purple.opacity(0.05)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            // Grid pattern
            Canvas { context, size in
                let gridSpacing: CGFloat = 50 * zoomScale
                
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
                    with: .color(.white.opacity(0.1)),
                    lineWidth: 0.5
                )
            }
        }
    }
    
    // MARK: - Tree Nodes
    
    private func treeNodes(rootNode: ABMCTSNode) -> some View {
        let positions = calculateNodePositions(rootNode: rootNode)
        
        return ZStack {
            ForEach(positions.keys.sorted(), id: \.self) { nodeId in
                if let node = findNode(nodeId, in: rootNode),
                   let position = positions[nodeId],
                   node.depth <= maxVisibleDepth {
                    
                    TreeNodeView(
                        node: node,
                        isSelected: selectedNode?.id == node.id,
                        isExpanded: expandedNodes.contains(node.id),
                        position: position
                    )
                    .onTapGesture {
                        selectNode(node)
                    }
                    .onLongPressGesture {
                        toggleNodeExpansion(node)
                    }
                    .animation(.spring(response: 0.5, dampingFraction: 0.8), value: animateTreeUpdate)
                }
            }
        }
    }
    
    // MARK: - Tree Connections
    
    private func treeConnections(rootNode: ABMCTSNode) -> some View {
        let positions = calculateNodePositions(rootNode: rootNode)
        
        return Canvas { context, size in
            drawConnections(context: context, node: rootNode, positions: positions)
        }
        .allowsHitTesting(false)
    }
    
    private func drawConnections(context: GraphicsContext, node: ABMCTSNode, positions: [String: CGPoint]) {
        guard let nodePosition = positions[node.id],
              node.depth < maxVisibleDepth else { return }
        
        for child in node.children {
            guard let childPosition = positions[child.id] else { continue }
            
            let path = Path { path in
                path.move(to: nodePosition)
                
                // Calculate control points for smooth curve
                let controlY = nodePosition.y + (childPosition.y - nodePosition.y) * 0.6
                let control1 = CGPoint(x: nodePosition.x, y: controlY)
                let control2 = CGPoint(x: childPosition.x, y: controlY)
                
                path.addCurve(to: childPosition, control1: control1, control2: control2)
            }
            
            // Connection style based on child's performance
            let connectionColor = connectionColor(for: child)
            let lineWidth = connectionWidth(for: child)
            
            context.stroke(
                path,
                with: .color(connectionColor),
                style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
            )
            
            // Add arrow head
            drawArrowHead(context: context, from: nodePosition, to: childPosition, color: connectionColor)
        }
        
        // Recursively draw connections for children
        for child in node.children {
            drawConnections(context: context, node: child, positions: positions)
        }
    }
    
    private func drawArrowHead(context: GraphicsContext, from: CGPoint, to: CGPoint, color: Color) {
        let angle = atan2(to.y - from.y, to.x - from.x)
        let arrowLength: CGFloat = 8
        let arrowAngle: CGFloat = .pi / 6
        
        let arrowPoint1 = CGPoint(
            x: to.x - arrowLength * cos(angle - arrowAngle),
            y: to.y - arrowLength * sin(angle - arrowAngle)
        )
        
        let arrowPoint2 = CGPoint(
            x: to.x - arrowLength * cos(angle + arrowAngle),
            y: to.y - arrowLength * sin(angle + arrowAngle)
        )
        
        let arrowPath = Path { path in
            path.move(to: to)
            path.addLine(to: arrowPoint1)
            path.move(to: to)
            path.addLine(to: arrowPoint2)
        }
        
        context.stroke(arrowPath, with: .color(color), style: StrokeStyle(lineWidth: 2, lineCap: .round))
    }
    
    // MARK: - Helper Functions
    
    private func calculateNodePositions(rootNode: ABMCTSNode) -> [String: CGPoint] {
        var positions: [String: CGPoint] = [:]
        let centerX: CGFloat = viewportSize.width / 2
        let startY: CGFloat = 100
        
        // Calculate positions using a breadth-first approach
        var nodesByLevel: [Int: [ABMCTSNode]] = [:]
        collectNodesByLevel(node: rootNode, level: 0, nodesByLevel: &nodesByLevel)
        
        for (level, nodes) in nodesByLevel {
            let y = startY + CGFloat(level) * levelSpacing
            let totalWidth = max(CGFloat(nodes.count - 1) * nodeSpacing, 0)
            let startX = centerX - totalWidth / 2
            
            for (index, node) in nodes.enumerated() {
                let x = startX + CGFloat(index) * nodeSpacing
                positions[node.id] = CGPoint(x: x, y: y)
            }
        }
        
        return positions
    }
    
    private func collectNodesByLevel(node: ABMCTSNode, level: Int, nodesByLevel: inout [Int: [ABMCTSNode]]) {
        guard level <= maxVisibleDepth else { return }
        
        if nodesByLevel[level] == nil {
            nodesByLevel[level] = []
        }
        nodesByLevel[level]?.append(node)
        
        for child in node.children {
            collectNodesByLevel(node: child, level: level + 1, nodesByLevel: &nodesByLevel)
        }
    }
    
    private func findNode(_ id: String, in rootNode: ABMCTSNode) -> ABMCTSNode? {
        if rootNode.id == id { return rootNode }
        
        for child in rootNode.children {
            if let found = findNode(id, in: child) {
                return found
            }
        }
        
        return nil
    }
    
    private func selectNode(_ node: ABMCTSNode) {
        withAnimation(.easeInOut(duration: 0.3)) {
            selectedNode = node
        }
    }
    
    private func toggleNodeExpansion(_ node: ABMCTSNode) {
        withAnimation(.easeInOut(duration: 0.3)) {
            if expandedNodes.contains(node.id) {
                expandedNodes.remove(node.id)
            } else {
                expandedNodes.insert(node.id)
                
                // Request expansion from server if needed
                if !node.isExpanded {
                    Task {
                        await webSocketService.requestTreeExpansion(node.id)
                    }
                }
            }
        }
    }
    
    private func connectionColor(for node: ABMCTSNode) -> Color {
        if node.averageReward > 0.7 {
            return .green
        } else if node.averageReward > 0.4 {
            return .yellow
        } else {
            return .red
        }
    }
    
    private func connectionWidth(for node: ABMCTSNode) -> CGFloat {
        let baseWidth: CGFloat = 2
        let confidenceMultiplier = node.confidence
        return baseWidth + (confidenceMultiplier * 3)
    }
    
    private func initializeExpandedNodes() {
        guard let rootNode = webSocketService.abmctsTree else { return }
        expandedNodes.insert(rootNode.id)
        
        // Auto-expand first level
        for child in rootNode.children {
            expandedNodes.insert(child.id)
        }
    }
    
    private func resetZoomAndPan() {
        zoomScale = 1.0
        panOffset = .zero
    }
    
    // MARK: - Gestures
    
    private var magnificationGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                zoomScale = max(0.5, min(3.0, value))
            }
    }
    
    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                panOffset = value.translation
            }
    }
    
    // MARK: - UI Controls
    
    private var treeControls: some View {
        HStack(spacing: 12) {
            // Zoom controls
            Button(action: { withAnimation { zoomScale = max(0.5, zoomScale - 0.2) } }) {
                Image(systemName: "minus.magnifyingglass")
                    .font(.title2)
            }
            .buttonStyle(.bordered)
            .help("Zoom out")
            
            Button(action: { withAnimation { zoomScale = min(3.0, zoomScale + 0.2) } }) {
                Image(systemName: "plus.magnifyingglass")
                    .font(.title2)
            }
            .buttonStyle(.bordered)
            .help("Zoom in")
            
            // Reset view
            Button(action: { withAnimation(.spring()) { resetZoomAndPan() } }) {
                Image(systemName: "arrow.counterclockwise")
                    .font(.title2)
            }
            .buttonStyle(.bordered)
            .help("Reset view")
            
            Divider()
                .frame(height: 20)
            
            // Expand all
            Button(action: expandAllNodes) {
                Image(systemName: "arrow.down.right.and.arrow.up.left")
                    .font(.title2)
            }
            .buttonStyle(.bordered)
            .help("Expand all nodes")
            
            // Collapse all
            Button(action: collapseAllNodes) {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.title2)
            }
            .buttonStyle(.bordered)
            .help("Collapse all nodes")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var treeStats: some View {
        VStack(alignment: .trailing, spacing: 4) {
            if let rootNode = webSocketService.abmctsTree {
                Text("Nodes: \(countTotalNodes(rootNode))")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("Depth: \(getMaxDepth(rootNode))")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("Best Value: \(rootNode.averageReward, specifier: "%.3f")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var nodeActionToolbar: some View {
        HStack(spacing: 16) {
            Button("Expand Node") {
                if let node = selectedNode {
                    Task {
                        await webSocketService.requestTreeExpansion(node.id)
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(selectedNode?.isExpanded == true)
            
            Button("View Details") {
                showNodeDetails = true
            }
            .buttonStyle(.bordered)
            
            Button("Copy State") {
                if let node = selectedNode {
                    copyNodeToClipboard(node)
                }
            }
            .buttonStyle(.bordered)
            
            Spacer()
            
            Button("Deselect") {
                withAnimation {
                    selectedNode = nil
                }
            }
            .buttonStyle(.borderless)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var emptyTreeState: some View {
        VStack(spacing: 20) {
            Image(systemName: "tree.circle")
                .font(.system(size: 64))
                .foregroundColor(.secondary)
            
            Text("No Decision Tree Available")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Connect to the agent orchestration service to view AB-MCTS decision trees")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            if webSocketService.connectionStatus != .connected {
                Button("Connect to Service") {
                    Task {
                        webSocketService.connect()
                    }
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Helper Functions
    
    private func expandAllNodes() {
        guard let rootNode = webSocketService.abmctsTree else { return }
        withAnimation(.easeInOut(duration: 0.5)) {
            collectAllNodeIds(rootNode).forEach { expandedNodes.insert($0) }
        }
    }
    
    private func collapseAllNodes() {
        withAnimation(.easeInOut(duration: 0.5)) {
            expandedNodes.removeAll()
            if let rootNode = webSocketService.abmctsTree {
                expandedNodes.insert(rootNode.id)
            }
        }
    }
    
    private func collectAllNodeIds(_ node: ABMCTSNode) -> [String] {
        var ids = [node.id]
        for child in node.children {
            ids.append(contentsOf: collectAllNodeIds(child))
        }
        return ids
    }
    
    private func countTotalNodes(_ node: ABMCTSNode) -> Int {
        return 1 + node.children.reduce(0) { $0 + countTotalNodes($1) }
    }
    
    private func getMaxDepth(_ node: ABMCTSNode) -> Int {
        guard !node.children.isEmpty else { return node.depth }
        return node.children.map { getMaxDepth($0) }.max() ?? node.depth
    }
    
    private func copyNodeToClipboard(_ node: ABMCTSNode) {
        let nodeInfo = """
        Node ID: \(node.id)
        Depth: \(node.depth)
        Visits: \(node.visits)
        Average Reward: \(node.averageReward)
        Confidence: \(node.confidence)
        UCB Value: \(node.ucbValue)
        Is Expanded: \(node.isExpanded)
        Children: \(node.children.count)
        """
        
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(nodeInfo, forType: .string)
    }
}

// MARK: - Tree Node View

struct TreeNodeView: View {
    let node: ABMCTSNode
    let isSelected: Bool
    let isExpanded: Bool
    let position: CGPoint
    
    private let nodeRadius: CGFloat = 25
    
    var body: some View {
        ZStack {
            // Node background
            Circle()
                .fill(nodeBackgroundGradient)
                .frame(width: nodeRadius * 2, height: nodeRadius * 2)
                .overlay(
                    Circle()
                        .stroke(nodeStrokeColor, lineWidth: isSelected ? 3 : 1)
                )
                .shadow(color: .black.opacity(0.3), radius: isSelected ? 6 : 3)
            
            // Node content
            VStack(spacing: 2) {
                Text("\(node.visits)")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text(String(format: "%.2f", node.averageReward))
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.8))
            }
            
            // Expansion indicator
            if !node.children.isEmpty {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Image(systemName: isExpanded ? "minus.circle.fill" : "plus.circle.fill")
                            .font(.caption)
                            .foregroundColor(.white)
                            .background(Circle().fill(Color.blue))
                    }
                }
                .frame(width: nodeRadius * 2, height: nodeRadius * 2)
            }
        }
        .position(position)
        .scaleEffect(isSelected ? 1.2 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isSelected)
    }
    
    private var nodeBackgroundGradient: LinearGradient {
        let baseColor = rewardColor
        return LinearGradient(
            colors: [
                baseColor,
                baseColor.opacity(0.8)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
    
    private var rewardColor: Color {
        if node.averageReward > 0.7 {
            return .green
        } else if node.averageReward > 0.4 {
            return .orange
        } else {
            return .red
        }
    }
    
    private var nodeStrokeColor: Color {
        if isSelected {
            return .white
        } else if node.confidence > 0.8 {
            return .blue
        } else {
            return .gray
        }
    }
}

// MARK: - Node Detail View

struct NodeDetailView: View {
    let node: ABMCTSNode
    let webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text("Decision Node Details")
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
            
            Divider()
            
            // Node metrics
            VStack(spacing: 16) {
                MetricRow(title: "Visits", value: "\(node.visits)", icon: "eye.fill")
                MetricRow(title: "Average Reward", value: String(format: "%.4f", node.averageReward), icon: "chart.line.uptrend.xyaxis")
                MetricRow(title: "UCB Value", value: String(format: "%.4f", node.ucbValue), icon: "function")
                MetricRow(title: "Confidence", value: String(format: "%.2f%%", node.confidence * 100), icon: "checkmark.seal")
                MetricRow(title: "Depth", value: "\(node.depth)", icon: "tree")
                MetricRow(title: "Children", value: "\(node.children.count)", icon: "hierarchy")
            }
            
            // Agent state details
            if !node.state.context.isEmpty {
                Divider()
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Agent State Context")
                        .font(.headline)
                    
                    ScrollView {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(Array(node.state.context.keys.sorted()), id: \.self) { key in
                                HStack {
                                    Text(key)
                                        .fontWeight(.medium)
                                    Spacer()
                                    Text(node.state.context[key] ?? "")
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                    .frame(maxHeight: 100)
                }
            }
            
            // Action details
            if let action = node.action {
                Divider()
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Associated Action")
                        .font(.headline)
                    
                    HStack {
                        Image(systemName: "play.circle")
                            .foregroundColor(.blue)
                        Text(action.type.rawValue)
                            .fontWeight(.medium)
                        Spacer()
                        Text("Cost: \(action.estimatedCost, specifier: "%.2f")")
                            .foregroundColor(.secondary)
                    }
                    
                    Text("Benefit: \(action.estimatedBenefit, specifier: "%.2f")")
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Actions
            HStack {
                if !node.isExpanded && !node.children.isEmpty {
                    Button("Expand Node") {
                        Task {
                            await webSocketService.requestTreeExpansion(node.id)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }
                
                Button("Copy Details") {
                    copyNodeDetails()
                }
                .buttonStyle(.bordered)
                
                Spacer()
            }
        }
        .padding()
        .frame(width: 500, height: 600)
    }
    
    private func copyNodeDetails() {
        let details = """
        Decision Node Details
        
        Node ID: \(node.id)
        Depth: \(node.depth)
        Visits: \(node.visits)
        Average Reward: \(node.averageReward)
        UCB Value: \(node.ucbValue)
        Confidence: \(node.confidence)
        Children: \(node.children.count)
        Is Expanded: \(node.isExpanded)
        
        Agent State:
        Agent ID: \(node.state.agentId)
        Context: \(node.state.context)
        
        Action: \(node.action?.type.rawValue ?? "None")
        """
        
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(details, forType: .string)
    }
}


#Preview {
    ABMCTSTreeView(webSocketService: AgentWebSocketService())
        .frame(width: 800, height: 600)
}