import SwiftUI
import Combine
import OSLog
import SceneKit
import simd
import AppKit

/// Sophisticated 3D Knowledge Graph Visualization with real-time updates
struct KnowledgeGraphView3D: View {
    @EnvironmentObject var apiService: APIService
    @Environment(\.colorScheme) var colorScheme
    @State private var isLoading = false
    @State private var nodeCount = 3
    @State private var edgeCount = 2
    @State private var isConnected = false
    @State private var showingSearchPanel = false
    @State private var showingFilterPanel = false
    @State private var showingLayoutPanel = false
    @State private var showingControls = false
    @StateObject private var graphState = GraphState()
    @StateObject private var webSocketService = GraphWebSocketService(baseURL: "ws://localhost:3000")
    @State private var isLoadingGraph = false
    @State private var errorMessage: String?
    @State private var selectedNode: GraphNode?
    @State private var showingNodeDetails = false
    @State private var controlsOffset: CGFloat = 0
    
    private let logger = Logger(subsystem: "com.universalai.tools", category: "KnowledgeGraph3D")
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text("3D Knowledge Graph")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Interactive visualization of knowledge relationships")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                // Connection status
                HStack(spacing: 8) {
                    Circle()
                        .fill(isConnected ? .green : .red)
                        .frame(width: 8, height: 8)
                    
                    Text(isConnected ? "Connected" : "Disconnected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            
            // Main content area
            ZStack {
                // Background
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(.primary.opacity(0.1), lineWidth: 1)
                    )
                
                if isLoading {
                    // Loading state
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.5)
                        
                        Text("Loading Knowledge Graph...")
                            .font(.headline)
                        
                        Text("Analyzing relationships and building 3D visualization")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                } else {
                    // Placeholder 3D view
                    VStack(spacing: 20) {
                        // Graph stats
                        HStack(spacing: 40) {
                            statView(title: "Nodes", value: "\(nodeCount)", color: .blue)
                            statView(title: "Edges", value: "\(edgeCount)", color: .green)
                            statView(title: "Clusters", value: "1", color: .purple)
                        }
                        
                        // Placeholder visualization
                        VStack(spacing: 12) {
                            Image(systemName: "point.3.connected.trianglepath.dotted")
                                .font(.system(size: 64))
                                .foregroundColor(.accentColor)
                                .symbolRenderingMode(.multicolor)
                            
                            Text("3D Graph Visualization")
                                .font(.title2)
                                .fontWeight(.semibold)
                            
                            Text("Advanced knowledge graph rendering coming soon")
                                .font(.body)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding()
                        
                        // Action buttons
                        HStack(spacing: 16) {
                            Button("Load Sample Data") {
                                createSampleGraphData()
                            }
                            .buttonStyle(.borderedProminent)
                            
                            Button("Connect to Backend") {
                                webSocketService.connect()
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            Spacer()
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AnimatedGradientBackground())
        .onAppear {
            setupGraph()
        }
    }
    
    // MARK: - Helper Views
    
    private func statView(title: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
    
    private var graphBackground: some View {
        AnimatedGradientBackground()
            .opacity(0.3)
            .overlay(
                // Subtle grid pattern
                Grid3DBackground()
                    .opacity(0.1)
            )
    }
    
    // MARK: - Controls Overlay
    
    private var controlsOverlay: some View {
        VStack(spacing: 0) {
            // Top controls
            topControlsBar
            
            Spacer()
            
            // Side controls
            HStack {
                VStack(spacing: 12) {
                    leftSideControls
                }
                .padding(.leading, 20)
                
                Spacer()
                
                VStack(spacing: 12) {
                    rightSideControls
                }
                .padding(.trailing, 20)
            }
            
            Spacer()
            
            // Bottom controls
            bottomControlsBar
        }
        .allowsHitTesting(true)
    }
    
    private var topControlsBar: some View {
        HStack(spacing: 16) {
            // Search button
            controlButton(
                icon: "magnifyingglass",
                isActive: showingSearchPanel,
                action: { toggleSearchPanel() }
            )
            .help("Search Graph")
            
            // Filter button
            controlButton(
                icon: "line.3.horizontal.decrease.circle",
                isActive: showingFilterPanel,
                action: { toggleFilterPanel() }
            )
            .help("Filter Nodes")
            
            // Layout button
            controlButton(
                icon: "grid",
                isActive: showingLayoutPanel,
                action: { toggleLayoutPanel() }
            )
            .help("Layout Options")
            
            Spacer()
            
            // Graph stats
            graphStatsView
            
            Spacer()
            
            // View controls
            controlButton(
                icon: "eye",
                isActive: showingControls,
                action: { toggleControlsVisibility() }
            )
            .help("Toggle Controls")
            
            // Reset view
            controlButton(
                icon: "arrow.clockwise",
                isActive: false,
                action: { resetGraphView() }
            )
            .help("Reset View")
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
    }
    
    private var leftSideControls: some View {
        VStack(spacing: 12) {
            // Zoom controls
            VStack(spacing: 8) {
                controlButton(
                    icon: "plus.magnifyingglass",
                    action: { zoomIn() }
                )
                .help("Zoom In")
                
                controlButton(
                    icon: "minus.magnifyingglass",
                    action: { zoomOut() }
                )
                .help("Zoom Out")
            }
            .glassMorphism(cornerRadius: 12)
            .padding(.vertical, 8)
            
            // Physics controls
            VStack(spacing: 8) {
                controlButton(
                    icon: graphState.enablePhysics ? "play.fill" : "play",
                    isActive: graphState.enablePhysics,
                    action: { togglePhysics() }
                )
                .help("Toggle Physics")
                
                controlButton(
                    icon: "gamecontroller",
                    action: { showInteractionHelp() }
                )
                .help("Interaction Help")
            }
            .glassMorphism(cornerRadius: 12)
            .padding(.vertical, 8)
        }
    }
    
    private var rightSideControls: some View {
        VStack(spacing: 12) {
            // Camera controls
            VStack(spacing: 8) {
                controlButton(
                    icon: "camera.rotate",
                    action: { resetCamera() }
                )
                .help("Reset Camera")
                
                controlButton(
                    icon: "target",
                    action: { focusOnSelection() }
                )
                .help("Focus on Selection")
            }
            .glassMorphism(cornerRadius: 12)
            .padding(.vertical, 8)
            
            // Performance controls
            VStack(spacing: 8) {
                controlButton(
                    icon: graphState.lodEnabled ? "speedometer" : "speedometer",
                    isActive: graphState.lodEnabled,
                    action: { toggleLOD() }
                )
                .help("Toggle Level of Detail")
                
                Text("\(graphState.visibleNodes.count)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .help("Visible Nodes")
            }
            .glassMorphism(cornerRadius: 12)
            .padding(.vertical, 8)
        }
    }
    
    private var bottomControlsBar: some View {
        HStack(spacing: 16) {
            // Layout selector
            layoutSelectorView
            
            Spacer()
            
            // Connection quality indicator
            connectionQualityView
            
            Spacer()
            
            // Performance metrics
            performanceMetricsView
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
    }
    
    // MARK: - Control Components
    
    private func controlButton(
        icon: String,
        isActive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(isActive ? .white : .primary)
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(isActive ? Color.accentColor : Color.clear)
                        .overlay(
                            Circle()
                                .stroke(Color.primary.opacity(0.2), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(isActive ? 1.1 : 1.0)
        .animation(.easeInOut(duration: 0.2), value: isActive)
    }
    
    private var graphStatsView: some View {
        HStack(spacing: 12) {
            statItem(icon: "circle", value: "\(graphState.nodes.count)", label: "Nodes")
            statItem(icon: "line.diagonal", value: "\(graphState.edges.count)", label: "Edges")
            statItem(icon: "circles.hexagongrid", value: "\(graphState.clusters.count)", label: "Clusters")
        }
        .glassMorphism(cornerRadius: 12)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
    
    private func statItem(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                Text(value)
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
    
    private var layoutSelectorView: some View {
        HStack(spacing: 8) {
            Text("Layout:")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Picker("Layout", selection: $graphState.currentLayout) {
                ForEach(GraphLayout.allCases, id: \.self) { layout in
                    Text(layout.displayName)
                        .tag(layout)
                }
            }
            .pickerStyle(.menu)
            .font(.caption)
        }
        .glassMorphism(cornerRadius: 8)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }
    
    private var connectionQualityView: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(webSocketService.isConnected ? .green : .red)
                .frame(width: 8, height: 8)
                .animation(.easeInOut(duration: 0.3), value: webSocketService.isConnected)
            
            Text(webSocketService.isConnected ? "Connected" : "Disconnected")
                .font(.caption2)
                .foregroundColor(.secondary)
            
            if webSocketService.isConnected {
                Text("\(Int(webSocketService.latency * 1000))ms")
                    .font(.caption2)
                    .foregroundColor(.green)
            }
        }
        .glassMorphism(cornerRadius: 8)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
    }
    
    private var performanceMetricsView: some View {
        HStack(spacing: 8) {
            Text("FPS: 60")
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Text("Visible: \(graphState.visibleNodes.count)/\(graphState.maxVisibleNodes)")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .glassMorphism(cornerRadius: 8)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
    }
    
    // MARK: - Panels
    
    private var searchPanel: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Search Knowledge Graph")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { toggleSearchPanel() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.plain)
            }
            
            // Search input
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                
                TextField("Search nodes, relationships, or concepts...", text: $graphState.searchQuery)
                    .textFieldStyle(.plain)
                    .onSubmit {
                        performSearch()
                    }
                
                if !graphState.searchQuery.isEmpty {
                    Button(action: { graphState.searchQuery = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.primary.opacity(0.1))
            .cornerRadius(8)
            
            // Quick search options
            VStack(alignment: .leading, spacing: 8) {
                Text("Quick Searches")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                    quickSearchButton("Recent Nodes", icon: "clock")
                    quickSearchButton("Central Nodes", icon: "target")
                    quickSearchButton("Isolated Nodes", icon: "circle")
                    quickSearchButton("High-Weight Edges", icon: "line.diagonal")
                }
            }
            
            Spacer()
        }
        .padding(20)
        .frame(width: 350, height: 250)
        .glassMorphism(cornerRadius: 16)
        .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
        .position(x: NSScreen.main?.frame.width ?? 800 / 2, y: 150)
    }
    
    private func quickSearchButton(_ title: String, icon: String) -> some View {
        Button(action: { performQuickSearch(title) }) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption)
                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.primary.opacity(0.1))
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }
    
    private var layoutPanel: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Layout Configuration")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { toggleLayoutPanel() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.plain)
            }
            
            // Layout options
            VStack(alignment: .leading, spacing: 12) {
                Text("Algorithm")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                ForEach(GraphLayout.allCases, id: \.self) { layout in
                    layoutOptionButton(layout)
                }
            }
            
            // Layout parameters
            VStack(alignment: .leading, spacing: 12) {
                Text("Parameters")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                VStack(spacing: 8) {
                    parameterSlider("Node Repulsion", value: .constant(0.5))
                    parameterSlider("Edge Attraction", value: .constant(0.7))
                    parameterSlider("Gravity", value: .constant(0.3))
                    parameterSlider("Iterations", value: .constant(0.8))
                }
            }
            
            Spacer()
        }
        .padding(20)
        .frame(width: 300, height: 400)
        .glassMorphism(cornerRadius: 16)
        .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
        .position(x: (NSScreen.main?.frame.width ?? 800) - 170, y: (NSScreen.main?.frame.height ?? 600) / 2)
    }
    
    private func layoutOptionButton(_ layout: GraphLayout) -> some View {
        Button(action: { graphState.updateLayout(layout) }) {
            HStack {
                Circle()
                    .fill(graphState.currentLayout == layout ? Color.accentColor : .clear)
                    .frame(width: 8, height: 8)
                    .overlay(
                        Circle()
                            .stroke(.primary.opacity(0.3), lineWidth: 1)
                    )
                
                Text(layout.displayName)
                    .font(.body)
                
                Spacer()
                
                if graphState.currentLayout == layout {
                    Image(systemName: "checkmark")
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(graphState.currentLayout == layout ? Color.accentColor.opacity(0.1) : Color.clear)
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
    
    private func parameterSlider(_ title: String, value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.caption)
                Spacer()
                Text("\(Int(value.wrappedValue * 100))%")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Slider(value: value, in: 0...1)
                .accentColor(.accentColor)
        }
    }
    
    private var filterPanel: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Filter Nodes")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { toggleFilterPanel() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.plain)
            }
            
            // Node type filters
            VStack(alignment: .leading, spacing: 12) {
                Text("Node Types")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                    ForEach(GraphNode.NodeType.allCases, id: \.self) { nodeType in
                        nodeTypeFilterButton(nodeType)
                    }
                }
            }
            
            // Range filters
            VStack(alignment: .leading, spacing: 12) {
                Text("Filters")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                VStack(spacing: 8) {
                    rangeFilter("Importance", range: .constant(0.0...1.0))
                    rangeFilter("Connections", range: .constant(0.0...1.0))
                    rangeFilter("Centrality", range: .constant(0.0...1.0))
                }
            }
            
            Spacer()
        }
        .padding(20)
        .frame(width: 300, height: 450)
        .glassMorphism(cornerRadius: 16)
        .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
        .position(x: 170, y: (NSScreen.main?.frame.height ?? 600) / 2)
    }
    
    private func nodeTypeFilterButton(_ nodeType: GraphNode.NodeType) -> some View {
        Button(action: { toggleNodeTypeFilter(nodeType) }) {
            HStack(spacing: 8) {
                Image(systemName: nodeType.icon)
                    .font(.caption)
                    .foregroundColor(nodeType.color)
                
                Text(nodeType.rawValue.capitalized)
                    .font(.caption)
                
                Spacer()
                
                if graphState.filterTypes.contains(nodeType) {
                    Image(systemName: "checkmark")
                        .font(.caption2)
                        .foregroundColor(.accentColor)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(graphState.filterTypes.contains(nodeType) ? nodeType.color.opacity(0.2) : Color.clear)
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }
    
    private func rangeFilter(_ title: String, range: Binding<ClosedRange<Double>>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
            
            // Custom range slider would go here
            Slider(value: .constant(0.5), in: 0...1)
                .accentColor(.accentColor)
        }
    }
    
    private func nodeDetailsPanel(node: GraphNode) -> some View {
        VStack(spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: node.type.icon)
                            .foregroundColor(node.type.color)
                        Text(node.title)
                            .font(.headline)
                            .fontWeight(.semibold)
                    }
                    
                    Text(node.type.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button(action: { closeNodeDetails() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.plain)
            }
            
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    // Node content
                    if !node.metadata.content.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Content")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Text(node.metadata.content)
                                .font(.body)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.primary.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                    
                    // Metadata
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Properties")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        propertyRow("Importance", value: "\(Int(node.metadata.importance * 100))%")
                        propertyRow("Centrality", value: "\(Int(node.metadata.centrality * 100))%")
                        propertyRow("Connections", value: "\(node.connections.count)")
                        propertyRow("Access Count", value: "\(node.metadata.accessCount)")
                    }
                    
                    // Tags
                    if !node.metadata.tags.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Tags")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            FlowLayout(spacing: 6) {
                                ForEach(node.metadata.tags, id: \.self) { tag in
                                    Text(tag)
                                        .font(.caption)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.accentColor.opacity(0.2))
                                        .cornerRadius(12)
                                }
                            }
                        }
                    }
                    
                    // Actions
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Actions")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        HStack(spacing: 12) {
                            actionButton("Explore", icon: "arrow.triangle.branch") {
                                exploreFromNode(node)
                            }
                            
                            actionButton("Similar", icon: "sparkles") {
                                findSimilarNodes(node)
                            }
                            
                            actionButton("Paths", icon: "point.topleft.down.curvedto.point.bottomright.up") {
                                showPathsFromNode(node)
                            }
                        }
                    }
                }
            }
            .frame(maxHeight: 200)
        }
        .padding(20)
        .frame(width: 400)
        .glassMorphism(cornerRadius: 16)
        .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
        .position(x: (NSScreen.main?.frame.width ?? 800) / 2, y: (NSScreen.main?.frame.height ?? 600) - 200)
    }
    
    private func propertyRow(_ title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
    
    private func actionButton(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.accentColor.opacity(0.2))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
    
    // MARK: - Overlays
    
    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()
            
            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)
                    .progressViewStyle(CircularProgressViewStyle(tint: .accentColor))
                
                Text("Loading Knowledge Graph...")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Analyzing relationships and clusters")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(30)
            .glassMorphism(cornerRadius: 20)
        }
    }
    
    private func errorOverlay(error: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title)
                .foregroundColor(.red)
            
            Text("Graph Error")
                .font(.headline)
                .fontWeight(.semibold)
            
            Text(error)
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
            
            Button("Dismiss") {
                errorMessage = nil
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(20)
        .frame(width: 300)
        .glassMorphism(cornerRadius: 16)
        .shadow(color: .black.opacity(0.2), radius: 20, x: 0, y: 10)
        .position(x: (NSScreen.main?.frame.width ?? 800) / 2, y: (NSScreen.main?.frame.height ?? 600) / 2)
    }
    
    private var connectionStatusIndicator: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(webSocketService.isConnected ? .green : .red)
                .frame(width: 6, height: 6)
            
            Text(webSocketService.isConnected ? "Live" : "Offline")
                .font(.caption2)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .position(x: 60, y: 30)
        .animation(.easeInOut(duration: 0.3), value: webSocketService.isConnected)
    }
    
    // MARK: - Actions
    
    private func setupGraph() {
        logger.info("Setting up 3D knowledge graph")
        
        // Setup WebSocket callbacks
        webSocketService.onNodeUpdate = { node in
            graphState.addNode(node)
        }
        
        webSocketService.onEdgeUpdate = { edge in
            graphState.addEdge(edge)
        }
        
        webSocketService.onClusterUpdate = { cluster in
            var clusters = graphState.clusters
            if let index = clusters.firstIndex(where: { $0.id == cluster.id }) {
                clusters[index] = cluster
            } else {
                clusters.append(cluster)
            }
            graphState.updateClusters(clusters)
        }
        
        webSocketService.onQueryResult = { result in
            handleQueryResult(result)
        }
        
        webSocketService.onLayoutUpdate = { positions in
            handleLayoutUpdate(positions)
        }
        
        // Connect to backend
        webSocketService.connect()
    }
    
    private func loadInitialGraphData() {
        isLoadingGraph = true
        
        Task {
            do {
                // Load initial graph data from backend
                try await loadGraphFromBackend()
                
                await MainActor.run {
                    isLoadingGraph = false
                    logger.info("Initial graph data loaded")
                }
            } catch {
                await MainActor.run {
                    isLoadingGraph = false
                    errorMessage = "Failed to load graph data: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func loadGraphFromBackend() async throws {
        // Load graph data via API
        // This would integrate with the GraphRAG backend
        // For now, create some sample data
        createSampleGraphData()
    }
    
    private func createSampleGraphData() {
        // Create sample nodes
        let sampleNodes = [
            GraphNode(
                id: "node1",
                title: "Machine Learning",
                type: .concept,
                position: SIMD3<Float>(0, 0, 0),
                connections: ["node2", "node3"],
                metadata: NodeMetadata(
                    content: "A method of data analysis that automates analytical model building.",
                    summary: "AI technique for pattern recognition",
                    importance: 0.9,
                    centrality: 0.8,
                    clusterId: "cluster1",
                    tags: ["AI", "Data Science", "Algorithms"],
                    createdAt: Date(),
                    lastAccessed: Date(),
                    accessCount: 42
                )
            ),
            GraphNode(
                id: "node2",
                title: "Neural Networks",
                type: .concept,
                position: SIMD3<Float>(3, 2, -1),
                connections: ["node1", "node3"],
                metadata: NodeMetadata(
                    content: "Computing systems inspired by biological neural networks.",
                    summary: "Brain-inspired computing models",
                    importance: 0.8,
                    centrality: 0.7,
                    clusterId: "cluster1",
                    tags: ["AI", "Deep Learning", "Networks"],
                    createdAt: Date(),
                    lastAccessed: Date(),
                    accessCount: 38
                )
            ),
            GraphNode(
                id: "node3",
                title: "SwiftUI Project",
                type: .project,
                position: SIMD3<Float>(-2, -1, 2),
                connections: ["node1"],
                metadata: NodeMetadata(
                    content: "A declarative UI framework for Swift applications.",
                    summary: "Modern UI development framework",
                    importance: 0.7,
                    centrality: 0.5,
                    clusterId: "cluster2",
                    tags: ["Swift", "UI", "iOS"],
                    createdAt: Date(),
                    lastAccessed: Date(),
                    accessCount: 25
                )
            )
        ]
        
        let sampleEdges = [
            GraphEdge(
                id: "edge1",
                source: "node1",
                target: "node2",
                weight: 0.8,
                type: .semantic,
                relationship: "related_to",
                bidirectional: true,
                metadata: EdgeMetadata(
                    description: "Strong conceptual relationship",
                    confidence: 0.9,
                    evidence: ["Academic papers", "Common usage"],
                    createdAt: Date(),
                    strength: 0.8
                )
            ),
            GraphEdge(
                id: "edge2",
                source: "node1",
                target: "node3",
                weight: 0.6,
                type: .functional,
                relationship: "applied_in",
                bidirectional: false,
                metadata: EdgeMetadata(
                    description: "ML concepts applied in SwiftUI project",
                    confidence: 0.7,
                    evidence: ["Code analysis"],
                    createdAt: Date(),
                    strength: 0.6
                )
            )
        ]
        
        let sampleClusters = [
            GraphCluster(
                id: "cluster1",
                name: "AI & Machine Learning",
                nodes: ["node1", "node2"],
                centroid: SIMD3<Float>(1.5, 1, -0.5),
                communityId: "ai_community",
                color: .blue,
                density: 0.8,
                coherence: 0.9,
                metadata: ClusterMetadata(
                    description: "Concepts related to artificial intelligence",
                    keywords: ["AI", "ML", "Neural Networks"],
                    dominantTypes: [.concept],
                    createdAt: Date(),
                    size: 2
                )
            )
        ]
        
        // Update graph state
        graphState.nodes = sampleNodes
        graphState.edges = sampleEdges
        graphState.clusters = sampleClusters
    }
    
    // Event handlers
    private func handleNodeSelection(_ nodeId: String) {
        graphState.selectNode(nodeId)
        selectedNode = graphState.nodes.first { $0.id == nodeId }
        showingNodeDetails = selectedNode != nil
    }
    
    private func handleNodeDoubleClick(_ nodeId: String) {
        // Zoom to node and show details
        if let node = graphState.nodes.first(where: { $0.id == nodeId }) {
            selectedNode = node
            showingNodeDetails = true
            focusOnNode(node)
        }
    }
    
    private func handleEdgeSelection(_ edgeId: String) {
        // Highlight edge and connected nodes
        if let edge = graphState.edges.first(where: { $0.id == edgeId }) {
            graphState.selectedNodes = Set([edge.source, edge.target])
        }
    }
    
    private func handleGraphDrag(_ value: DragGesture.Value) {
        // Handle camera movement
        let sensitivity: Float = 0.01
        let deltaX = Float(value.translation.width) * sensitivity
        let deltaY = Float(value.translation.height) * sensitivity
        
        // Update camera position
        graphState.cameraPosition.x += deltaX
        graphState.cameraPosition.y -= deltaY
    }
    
    private func handleQueryResult(_ result: GraphQueryResult) {
        // Process query results
        logger.info("Received query result with \(result.paths.count) paths")
        
        // Highlight paths
        if let firstPath = result.paths.first {
            graphState.highlightPath(firstPath.nodeIds)
        }
    }
    
    private func handleLayoutUpdate(_ positions: [String: SIMD3<Float>]) {
        // Update node positions
        for (nodeId, position) in positions {
            if let index = graphState.nodes.firstIndex(where: { $0.id == nodeId }) {
                var node = graphState.nodes[index]
                node = GraphNode(
                    id: node.id,
                    title: node.title,
                    type: node.type,
                    position: position,
                    connections: node.connections,
                    metadata: node.metadata
                )
                graphState.nodes[index] = node
            }
        }
    }
    
    // Control actions
    private func toggleSearchPanel() {
        withAnimation(.easeInOut(duration: 0.3)) {
            showingSearchPanel.toggle()
        }
    }
    
    private func toggleLayoutPanel() {
        withAnimation(.easeInOut(duration: 0.3)) {
            showingLayoutPanel.toggle()
        }
    }
    
    private func toggleFilterPanel() {
        withAnimation(.easeInOut(duration: 0.3)) {
            showingFilterPanel.toggle()
        }
    }
    
    private func toggleControlsVisibility() {
        withAnimation(.easeInOut(duration: 0.3)) {
            showingControls.toggle()
            controlsOffset = showingControls ? 0 : -100
        }
    }
    
    private func resetGraphView() {
        withAnimation(.easeInOut(duration: 1.0)) {
            graphState.cameraPosition = SIMD3<Float>(0, 0, 10)
            graphState.cameraRotation = simd_quatf(vector: SIMD4<Float>(0, 0, 0, 1))
            graphState.zoomLevel = 1.0
        }
    }
    
    private func zoomIn() {
        withAnimation(.easeInOut(duration: 0.3)) {
            graphState.zoomLevel = min(graphState.zoomLevel * 1.2, 5.0)
            graphState.cameraPosition.z = max(graphState.cameraPosition.z - 1, 2)
        }
    }
    
    private func zoomOut() {
        withAnimation(.easeInOut(duration: 0.3)) {
            graphState.zoomLevel = max(graphState.zoomLevel / 1.2, 0.2)
            graphState.cameraPosition.z = min(graphState.cameraPosition.z + 1, 50)
        }
    }
    
    private func togglePhysics() {
        graphState.enablePhysics.toggle()
        logger.info("Physics \(graphState.enablePhysics ? "enabled" : "disabled")")
    }
    
    private func toggleLOD() {
        graphState.lodEnabled.toggle()
        logger.info("Level of Detail \(graphState.lodEnabled ? "enabled" : "disabled")")
    }
    
    private func resetCamera() {
        withAnimation(.easeInOut(duration: 1.0)) {
            graphState.cameraPosition = SIMD3<Float>(0, 0, 10)
            graphState.cameraRotation = simd_quatf(vector: SIMD4<Float>(0, 0, 0, 1))
        }
    }
    
    private func focusOnSelection() {
        guard !graphState.selectedNodes.isEmpty else { return }
        
        // Calculate center of selected nodes
        let selectedNodePositions = graphState.nodes
            .filter { graphState.selectedNodes.contains($0.id) }
            .map { $0.position }
        
        if !selectedNodePositions.isEmpty {
            let center = selectedNodePositions.reduce(SIMD3<Float>(0, 0, 0), +) / Float(selectedNodePositions.count)
            
            withAnimation(.easeInOut(duration: 1.0)) {
                graphState.cameraPosition = center + SIMD3<Float>(0, 0, 5)
            }
        }
    }
    
    private func focusOnNode(_ node: GraphNode) {
        withAnimation(.easeInOut(duration: 1.0)) {
            graphState.cameraPosition = node.position + SIMD3<Float>(0, 0, 3)
        }
    }
    
    private func showInteractionHelp() {
        // Show help overlay with interaction instructions
    }
    
    private func performSearch() {
        guard !graphState.searchQuery.isEmpty else { return }
        
        webSocketService.sendQuery(graphState.searchQuery)
        logger.info("Performing search: \(graphState.searchQuery)")
    }
    
    private func performQuickSearch(_ type: String) {
        switch type {
        case "Recent Nodes":
            // Filter by recent access
            break
        case "Central Nodes":
            // Filter by high centrality
            break
        case "Isolated Nodes":
            // Filter by low connections
            break
        case "High-Weight Edges":
            // Filter by edge weight
            break
        default:
            break
        }
    }
    
    private func toggleNodeTypeFilter(_ nodeType: GraphNode.NodeType) {
        if graphState.filterTypes.contains(nodeType) {
            graphState.filterTypes.remove(nodeType)
        } else {
            graphState.filterTypes.insert(nodeType)
        }
    }
    
    private func closeNodeDetails() {
        withAnimation(.easeInOut(duration: 0.3)) {
            showingNodeDetails = false
            selectedNode = nil
        }
    }
    
    private func exploreFromNode(_ node: GraphNode) {
        // Explore connections from this node
        webSocketService.sendQuery("EXPLORE FROM \(node.id)")
    }
    
    private func findSimilarNodes(_ node: GraphNode) {
        // Find semantically similar nodes
        webSocketService.sendQuery("SIMILAR TO \(node.id)")
    }
    
    private func showPathsFromNode(_ node: GraphNode) {
        // Show paths from this node
        webSocketService.sendQuery("PATHS FROM \(node.id)")
    }
}

// MARK: - Supporting Views

struct Grid3DBackground: View {
    var body: some View {
        // Simple grid pattern overlay
        Rectangle()
            .fill(
                LinearGradient(
                    gradient: Gradient(stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .primary.opacity(0.05), location: 0.5),
                        .init(color: .clear, location: 1)
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
    }
}

struct FlowLayout: Layout {
    let spacing: CGFloat
    
    init(spacing: CGFloat = 8) {
        self.spacing = spacing
    }
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 300
        var height: CGFloat = 0
        var currentLineWidth: CGFloat = 0
        var lineHeight: CGFloat = 0
        
        for subview in subviews {
            let subviewSize = subview.sizeThatFits(.unspecified)
            
            if currentLineWidth + subviewSize.width > width {
                height += lineHeight + spacing
                currentLineWidth = subviewSize.width + spacing
                lineHeight = subviewSize.height
            } else {
                currentLineWidth += subviewSize.width + spacing
                lineHeight = max(lineHeight, subviewSize.height)
            }
        }
        
        height += lineHeight
        return CGSize(width: width, height: height)
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentPosition = CGPoint(x: bounds.minX, y: bounds.minY)
        var lineHeight: CGFloat = 0
        
        for subview in subviews {
            let subviewSize = subview.sizeThatFits(.unspecified)
            
            if currentPosition.x + subviewSize.width > bounds.maxX {
                currentPosition.x = bounds.minX
                currentPosition.y += lineHeight + spacing
                lineHeight = 0
            }
            
            subview.place(
                at: currentPosition,
                proposal: ProposedViewSize(subviewSize)
            )
            
            currentPosition.x += subviewSize.width + spacing
            lineHeight = max(lineHeight, subviewSize.height)
        }
    }
}

#Preview {
    KnowledgeGraphView3D()
        .environmentObject(APIService())
}