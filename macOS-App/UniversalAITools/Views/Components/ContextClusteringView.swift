import SwiftUI
import simd

struct ContextClusteringView: View {
    let clusters: [ContextCluster]
    let nodes: [ContextNode]
    
    @State private var selectedCluster: ContextCluster?
    @State private var selectedNode: ContextNode?
    @State private var hoveredCluster: String?
    @State private var viewMode: ViewMode = .overview
    @State private var clusteringAlgorithm: ClusteringAlgorithm = .hierarchical
    @State private var showDendrogram = true
    @State private var showStatistics = true
    @State private var animateTransitions = true
    @State private var minClusterSize: Int = 3
    @State private var maxClusters: Int = 10
    @State private var coherenceThreshold: Float = 0.5
    @State private var evolutionTimeframe: EvolutionTimeframe = .lastHour
    
    // Animation state
    @State private var animationProgress: Double = 0
    @State private var isAnimating = false
    
    enum ViewMode: String, CaseIterable {
        case overview = "Overview"
        case dendrogram = "Dendrogram"
        case evolution = "Evolution"
        case statistics = "Statistics"
        
        var icon: String {
            switch self {
            case .overview: return "circles.hexagongrid"
            case .dendrogram: return "tree.tall"
            case .evolution: return "clock.arrow.circlepath"
            case .statistics: return "chart.bar"
            }
        }
    }
    
    enum ClusteringAlgorithm: String, CaseIterable {
        case hierarchical = "Hierarchical"
        case kmeans = "K-Means"
        case dbscan = "DBSCAN"
        case spectral = "Spectral"
        
        var description: String {
            switch self {
            case .hierarchical: return "Builds tree of clusters using similarity"
            case .kmeans: return "Partitions into K clusters by centroids"
            case .dbscan: return "Density-based clustering with noise detection"
            case .spectral: return "Graph-based clustering using eigenvalues"
            }
        }
    }
    
    enum EvolutionTimeframe: String, CaseIterable {
        case lastHour = "1h"
        case last6Hours = "6h"
        case lastDay = "24h"
        case lastWeek = "7d"
        
        var displayName: String {
            switch self {
            case .lastHour: return "Last Hour"
            case .last6Hours: return "Last 6 Hours"
            case .lastDay: return "Last Day"
            case .lastWeek: return "Last Week"
            }
        }
    }
    
    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                // Header with controls
                headerView
                
                // Main content area
                ZStack {
                    AppTheme.primaryBackground
                        .ignoresSafeArea()
                    
                    switch viewMode {
                    case .overview:
                        clusterOverviewView(geometry: geometry)
                    case .dendrogram:
                        dendrogramView(geometry: geometry)
                    case .evolution:
                        clusterEvolutionView(geometry: geometry)
                    case .statistics:
                        clusterStatisticsView(geometry: geometry)
                    }
                }
            }
        }
        .onAppear {
            startInitialAnimation()
        }
    }
    
    // MARK: - Header View
    
    private var headerView: some View {
        VStack(spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Context Clustering")
                        .font(AppTheme.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text("\(filteredClusters.count) clusters • \(totalNodesInClusters) contexts")
                        .font(AppTheme.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    // Algorithm selector
                    Menu {
                        ForEach(ClusteringAlgorithm.allCases, id: \.self) { algorithm in
                            Button(action: {
                                withAnimation(AppTheme.normalAnimation) {
                                    clusteringAlgorithm = algorithm
                                }
                            }) {
                                VStack(alignment: .leading) {
                                    HStack {
                                        Text(algorithm.rawValue)
                                        if clusteringAlgorithm == algorithm {
                                            Spacer()
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                    Text(algorithm.description)
                                        .font(AppTheme.caption2)
                                        .foregroundColor(AppTheme.tertiaryText)
                                }
                            }
                        }
                    } label: {
                        HStack {
                            Image(systemName: "brain")
                            Text(clusteringAlgorithm.rawValue)
                        }
                        .font(AppTheme.caption)
                        .foregroundColor(AppTheme.primaryText)
                    }
                    .menuStyle(.borderlessButton)
                    
                    // Settings button
                    Button(action: {
                        // Settings modal would open here
                    }) {
                        Image(systemName: "slider.horizontal.3")
                            .font(.system(size: 16))
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .buttonStyle(.plain)
                    
                    // Refresh button
                    Button(action: {
                        refreshClusters()
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 16))
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .buttonStyle(.plain)
                    .rotationEffect(.degrees(isAnimating ? 360 : 0))
                    .animation(.linear(duration: 1.0), value: isAnimating)
                }
            }
            
            // View mode tabs
            HStack(spacing: 0) {
                ForEach(ViewMode.allCases, id: \.self) { mode in
                    Button(action: {
                        withAnimation(AppTheme.normalAnimation) {
                            viewMode = mode
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: mode.icon)
                                .font(.system(size: 14))
                            Text(mode.rawValue)
                                .font(AppTheme.callout)
                        }
                        .foregroundColor(viewMode == mode ? AppTheme.primaryText : AppTheme.secondaryText)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            viewMode == mode ? AppTheme.surfaceBackground : Color.clear
                        )
                        .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                }
                
                Spacer()
            }
            .padding(.horizontal, 4)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(AppTheme.secondaryBackground)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.separator),
            alignment: .bottom
        )
    }
    
    // MARK: - Cluster Overview View
    
    private func clusterOverviewView(geometry: GeometryProxy) -> some View {
        ZStack {
            ScrollView {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: max(1, Int(geometry.size.width / 350))),
                    spacing: 16
                ) {
                    ForEach(filteredClusters) { cluster in
                        clusterCard(cluster)
                    }
                }
                .padding(20)
            }
            
            // Selected cluster detail panel
            if let selectedCluster = selectedCluster {
                clusterDetailPanel(for: selectedCluster, geometry: geometry)
            }
        }
    }
    
    private func clusterCard(_ cluster: ContextCluster) -> some View {
        let isSelected = selectedCluster?.id == cluster.id
        let isHovered = hoveredCluster == cluster.id
        
        return VStack(alignment: .leading, spacing: 12) {
            // Cluster header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(cluster.topic)
                        .font(AppTheme.headline)
                        .fontWeight(.medium)
                        .foregroundColor(AppTheme.primaryText)
                        .lineLimit(2)
                    
                    Text("\(cluster.members.count) contexts")
                        .font(AppTheme.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
                
                // Coherence indicator
                CoherenceIndicator(coherence: cluster.coherenceScore)
            }
            
            // Cluster visualization
            clusterMiniVisualization(cluster)
            
            // Cluster metrics
            HStack {
                MetricPill(label: "Coherence", value: String(format: "%.1f%%", cluster.coherenceScore * 100), color: cluster.color)
                MetricPill(label: "Relevance", value: String(format: "%.1f%%", cluster.metadata.averageRelevance * 100), color: .blue)
                
                Spacer()
                
                Text("Updated: \(timeAgoString(from: cluster.metadata.lastUpdated))")
                    .font(AppTheme.caption2)
                    .foregroundColor(AppTheme.quaternaryText)
            }
            
            // Keywords
            if !cluster.metadata.keywords.isEmpty {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 4) {
                    ForEach(cluster.metadata.keywords.prefix(6), id: \.self) { keyword in
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
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(AppTheme.surfaceBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            isSelected ? AppTheme.accentColor : 
                            isHovered ? cluster.color : AppTheme.borderColor,
                            lineWidth: isSelected ? 2 : 1
                        )
                )
        )
        .scaleEffect(isSelected ? 1.02 : isHovered ? 1.01 : 1.0)
        .shadow(
            color: isSelected ? cluster.color.opacity(0.3) : AppTheme.lightShadow,
            radius: isSelected ? 8 : 2
        )
        .animation(AppTheme.quickAnimation, value: isSelected)
        .animation(AppTheme.quickAnimation, value: isHovered)
        .onTapGesture {
            withAnimation(AppTheme.normalAnimation) {
                selectedCluster = selectedCluster?.id == cluster.id ? nil : cluster
                selectedNode = nil
            }
        }
        .onHover { hovering in
            hoveredCluster = hovering ? cluster.id : nil
        }
    }
    
    private func clusterMiniVisualization(_ cluster: ContextCluster) -> some View {
        let clusterNodes = nodes.filter { cluster.members.contains($0.id) }
        
        return Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let radius = min(size.width, size.height) / 3
            
            // Draw cluster boundary
            let clusterPath = Path(ellipseIn: CGRect(
                x: center.x - radius,
                y: center.y - radius,
                width: radius * 2,
                height: radius * 2
            ))
            
            context.stroke(
                clusterPath,
                with: .color(cluster.color.opacity(0.5)),
                style: StrokeStyle(lineWidth: 2, dash: [5, 3])
            )
            
            context.fill(
                clusterPath,
                with: .color(cluster.color.opacity(0.1))
            )
            
            // Draw nodes
            for (index, node) in clusterNodes.prefix(8).enumerated() {
                let angle = Double(index) / Double(clusterNodes.count) * 2 * .pi
                let nodeX = center.x + cos(angle) * radius * 0.7
                let nodeY = center.y + sin(angle) * radius * 0.7
                let nodeSize = min(8.0, max(4.0, CGFloat(node.metadata.importance) * 10))
                
                let nodePath = Path(ellipseIn: CGRect(
                    x: nodeX - nodeSize / 2,
                    y: nodeY - nodeSize / 2,
                    width: nodeSize,
                    height: nodeSize
                ))
                
                context.fill(nodePath, with: .color(node.color))
            }
        }
        .frame(height: 80)
    }
    
    // MARK: - Dendrogram View
    
    private func dendrogramView(geometry: GeometryProxy) -> some View {
        ScrollView([.horizontal, .vertical]) {
            VStack(alignment: .leading, spacing: 20) {
                // Dendrogram explanation
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Hierarchical Clustering Dendrogram")
                            .font(AppTheme.headline)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text("Shows how clusters merge based on similarity")
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    
                    Spacer()
                    
                    Toggle("Show Labels", isOn: $showDendrogram)
                }
                .padding(.horizontal, 20)
                
                // Dendrogram visualization
                dendrogramCanvas
                    .frame(width: max(geometry.size.width - 40, 800), height: 500)
            }
        }
    }
    
    private var dendrogramCanvas: some View {
        Canvas { context, size in
            let dendrogramData = generateDendrogramData()
            drawDendrogram(context: context, size: size, data: dendrogramData)
        }
        .background(AppTheme.tertiaryBackground.opacity(0.3))
        .cornerRadius(8)
    }
    
    private func drawDendrogram(context: GraphicsContext, size: CGSize, data: DendrogramData) {
        let margin: CGFloat = 60
        let drawableWidth = size.width - 2 * margin
        let drawableHeight = size.height - 2 * margin
        
        // Draw cluster levels
        for (levelIndex, level) in data.levels.enumerated() {
            let y = margin + CGFloat(levelIndex) * (drawableHeight / CGFloat(data.levels.count - 1))
            
            for node in level.nodes {
                let x = margin + CGFloat(node.position) * drawableWidth
                
                // Draw node
                let nodeRect = CGRect(x: x - 4, y: y - 4, width: 8, height: 8)
                let nodePath = Path(ellipseIn: nodeRect)
                context.fill(nodePath, with: .color(node.cluster?.color ?? AppTheme.secondaryText))
                
                // Draw label
                if showDendrogram && levelIndex < 3 {
                    let text = Text(node.label)
                        .font(AppTheme.caption2)
                        .foregroundColor(AppTheme.primaryText)
                    
                    context.draw(text, at: CGPoint(x: x, y: y + 15))
                }
                
                // Draw connections to parent level
                if levelIndex > 0, let parent = node.parent {
                    let parentY = margin + CGFloat(levelIndex - 1) * (drawableHeight / CGFloat(data.levels.count - 1))
                    let parentX = margin + CGFloat(parent.position) * drawableWidth
                    
                    var path = Path()
                    path.move(to: CGPoint(x: x, y: y))
                    path.addLine(to: CGPoint(x: x, y: y - 15))
                    path.addLine(to: CGPoint(x: parentX, y: parentY + 15))
                    path.addLine(to: CGPoint(x: parentX, y: parentY))
                    
                    context.stroke(path, with: .color(AppTheme.separator), lineWidth: 1)
                }
            }
        }
    }
    
    // MARK: - Cluster Evolution View
    
    private func clusterEvolutionView(geometry: GeometryProxy) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Evolution controls
            HStack {
                Text("Cluster Evolution Over Time")
                    .font(AppTheme.headline)
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                Picker("Timeframe", selection: $evolutionTimeframe) {
                    ForEach(EvolutionTimeframe.allCases, id: \.self) { timeframe in
                        Text(timeframe.displayName).tag(timeframe)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 300)
            }
            .padding(.horizontal, 20)
            
            // Evolution timeline
            ScrollView(.horizontal) {
                evolutionTimelineView
                    .frame(width: max(geometry.size.width * 1.5, 1000), height: 400)
            }
            .padding(.horizontal, 20)
            
            // Evolution statistics
            evolutionStatisticsView
                .padding(.horizontal, 20)
        }
    }
    
    private var evolutionTimelineView: some View {
        Canvas { context, size in
            let evolutionData = generateEvolutionData()
            drawEvolution(context: context, size: size, data: evolutionData)
        }
        .background(AppTheme.tertiaryBackground.opacity(0.3))
        .cornerRadius(8)
    }
    
    private func drawEvolution(context: GraphicsContext, size: CGSize, data: EvolutionData) {
        let margin: CGFloat = 40
        let timelineWidth = size.width - 2 * margin
        let timelineHeight = size.height - 2 * margin
        
        // Draw time axis
        let timeAxis = Path { path in
            path.move(to: CGPoint(x: margin, y: size.height - margin))
            path.addLine(to: CGPoint(x: size.width - margin, y: size.height - margin))
        }
        context.stroke(timeAxis, with: .color(AppTheme.separator), lineWidth: 2)
        
        // Draw cluster evolution paths
        for cluster in data.clusterPaths {
            var clusterPath = Path()
            let points = cluster.timePoints.enumerated().map { (index, point) in
                CGPoint(
                    x: margin + CGFloat(index) * (timelineWidth / CGFloat(cluster.timePoints.count - 1)),
                    y: size.height - margin - CGFloat(point.size) * (timelineHeight / 100)
                )
            }
            
            if !points.isEmpty {
                clusterPath.move(to: points[0])
                for point in points.dropFirst() {
                    clusterPath.addLine(to: point)
                }
            }
            
            context.stroke(
                clusterPath,
                with: .color(cluster.color),
                style: StrokeStyle(lineWidth: 2)
            )
            
            // Draw points
            for point in points {
                let pointPath = Path(ellipseIn: CGRect(
                    x: point.x - 3,
                    y: point.y - 3,
                    width: 6,
                    height: 6
                ))
                context.fill(pointPath, with: .color(cluster.color))
            }
        }
    }
    
    // MARK: - Statistics View
    
    private func clusterStatisticsView(geometry: GeometryProxy) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Overall statistics
                clusterOverallStats
                
                // Cluster comparison chart
                clusterComparisonChart
                
                // Quality metrics
                clusterQualityMetrics
                
                // Clustering performance
                clusteringPerformanceMetrics
            }
            .padding(20)
        }
    }
    
    private var clusterOverallStats: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Overall Statistics")
                .font(AppTheme.headline)
                .foregroundColor(AppTheme.primaryText)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 16) {
                StatCard(title: "Total Clusters", value: "\(filteredClusters.count)", color: .blue)
                StatCard(title: "Avg Coherence", value: String(format: "%.1f%%", averageCoherence * 100), color: .green)
                StatCard(title: "Largest Cluster", value: "\(largestClusterSize)", color: .orange)
                StatCard(title: "Isolation Score", value: String(format: "%.2f", clusterIsolationScore), color: .purple)
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
    }
    
    private var clusterComparisonChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Cluster Size Distribution")
                .font(AppTheme.headline)
                .foregroundColor(AppTheme.primaryText)
            
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(filteredClusters.sorted { $0.members.count > $1.members.count }, id: \.id) { cluster in
                    VStack(spacing: 4) {
                        Rectangle()
                            .fill(cluster.color)
                            .frame(width: 20, height: CGFloat(cluster.members.count) * 10)
                            .cornerRadius(2)
                        
                        Text("\(cluster.members.count)")
                            .font(AppTheme.caption2)
                            .foregroundColor(AppTheme.secondaryText)
                            .rotationEffect(.degrees(-45))
                    }
                }
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
    }
    
    private var clusterQualityMetrics: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Clustering Quality")
                .font(AppTheme.headline)
                .foregroundColor(AppTheme.primaryText)
            
            VStack(spacing: 12) {
                QualityMetricBar(label: "Silhouette Score", value: 0.73, color: .blue)
                QualityMetricBar(label: "Davies-Bouldin Index", value: 0.45, color: .green)
                QualityMetricBar(label: "Calinski-Harabasz Score", value: 0.82, color: .orange)
                QualityMetricBar(label: "Adjusted Rand Index", value: 0.67, color: .purple)
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
    }
    
    private var clusteringPerformanceMetrics: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Performance Metrics")
                .font(AppTheme.headline)
                .foregroundColor(AppTheme.primaryText)
            
            VStack(spacing: 8) {
                PerformanceRow(label: "Clustering Time", value: "2.3s", icon: "clock")
                PerformanceRow(label: "Memory Usage", value: "45MB", icon: "memorychip")
                PerformanceRow(label: "Last Updated", value: timeAgoString(from: Date()), icon: "arrow.clockwise")
                PerformanceRow(label: "Update Frequency", value: "Every 5min", icon: "timer")
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
    }
    
    // MARK: - Detail Panels
    
    private func clusterDetailPanel(for cluster: ContextCluster, geometry: GeometryProxy) -> some View {
        VStack(alignment: .leading, spacing: 16) {
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
            
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    // Cluster metrics
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Metrics")
                            .font(AppTheme.body)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        DetailRow(label: "Members", value: "\(cluster.members.count)")
                        DetailRow(label: "Coherence", value: String(format: "%.1f%%", cluster.coherenceScore * 100))
                        DetailRow(label: "Avg Relevance", value: String(format: "%.1f%%", cluster.metadata.averageRelevance * 100))
                        DetailRow(label: "Dominant Type", value: cluster.metadata.dominantType.rawValue.capitalized)
                    }
                    
                    // Keywords
                    if !cluster.metadata.keywords.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Keywords")
                                .font(AppTheme.body)
                                .fontWeight(.medium)
                                .foregroundColor(AppTheme.primaryText)
                            
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 6) {
                                ForEach(cluster.metadata.keywords, id: \.self) { keyword in
                                    Text(keyword)
                                        .font(AppTheme.caption2)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(cluster.color.opacity(0.2))
                                        .cornerRadius(4)
                                        .foregroundColor(AppTheme.primaryText)
                                }
                            }
                        }
                    }
                    
                    // Member contexts
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Member Contexts (\(cluster.members.count))")
                            .font(AppTheme.body)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        let memberNodes = nodes.filter { cluster.members.contains($0.id) }
                        ForEach(memberNodes.prefix(8), id: \.id) { node in
                            HStack {
                                Image(systemName: node.type.icon)
                                    .foregroundColor(node.type.color)
                                    .frame(width: 16)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(String(node.content.prefix(40)))
                                        .font(AppTheme.caption)
                                        .foregroundColor(AppTheme.primaryText)
                                        .lineLimit(2)
                                    
                                    Text("Importance: \(String(format: "%.1f%%", node.metadata.importance * 100))")
                                        .font(AppTheme.caption2)
                                        .foregroundColor(AppTheme.tertiaryText)
                                }
                                
                                Spacer()
                            }
                            .padding(.vertical, 2)
                        }
                        
                        if memberNodes.count > 8 {
                            Text("... and \(memberNodes.count - 8) more")
                                .font(AppTheme.caption)
                                .foregroundColor(AppTheme.tertiaryText)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
        .shadow(color: AppTheme.mediumShadow, radius: 8)
        .frame(width: 350)
        .position(x: geometry.size.width - 195, y: geometry.size.height / 2)
    }
    
    // MARK: - Computed Properties
    
    private var filteredClusters: [ContextCluster] {
        clusters.filter { cluster in
            cluster.members.count >= minClusterSize &&
            cluster.coherenceScore >= coherenceThreshold
        }.prefix(maxClusters).map { $0 }
    }
    
    private var totalNodesInClusters: Int {
        filteredClusters.map { $0.members.count }.reduce(0, +)
    }
    
    private var averageCoherence: Float {
        guard !filteredClusters.isEmpty else { return 0 }
        let total = filteredClusters.map { $0.coherenceScore }.reduce(0, +)
        return total / Float(filteredClusters.count)
    }
    
    private var largestClusterSize: Int {
        filteredClusters.map { $0.members.count }.max() ?? 0
    }
    
    private var clusterIsolationScore: Float {
        // Simplified calculation - in real implementation would use proper isolation metrics
        return Float.random(in: 0.4...0.8)
    }
    
    // MARK: - Helper Methods
    
    private func startInitialAnimation() {
        withAnimation(.easeInOut(duration: 1.5)) {
            animationProgress = 1.0
        }
    }
    
    private func refreshClusters() {
        isAnimating = true
        
        // Simulate refresh delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            isAnimating = false
        }
    }
    
    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "\(Int(interval))s ago"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else if interval < 86400 {
            return "\(Int(interval / 3600))h ago"
        } else {
            return "\(Int(interval / 86400))d ago"
        }
    }
    
    // MARK: - Data Generation (Mock)
    
    private func generateDendrogramData() -> DendrogramData {
        // Generate mock dendrogram data
        return DendrogramData(levels: [])
    }
    
    private func generateEvolutionData() -> EvolutionData {
        // Generate mock evolution data
        let clusterPaths = filteredClusters.map { cluster in
            let timePoints = (0..<20).map { index in
                EvolutionTimePoint(
                    time: Date().addingTimeInterval(-Double(index) * 300), // Every 5 minutes
                    size: Float.random(in: 20...80)
                )
            }
            
            return ClusterEvolutionPath(
                clusterId: cluster.id,
                color: cluster.color,
                timePoints: timePoints.reversed()
            )
        }
        
        return EvolutionData(clusterPaths: clusterPaths)
    }
}

// MARK: - Supporting Views

struct CoherenceIndicator: View {
    let coherence: Float
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(coherenceColor.opacity(0.3), lineWidth: 3)
                .frame(width: 24, height: 24)
            
            Circle()
                .trim(from: 0, to: CGFloat(coherence))
                .stroke(coherenceColor, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .frame(width: 24, height: 24)
                .rotationEffect(.degrees(-90))
            
            Text(String(format: "%.0f", coherence * 100))
                .font(.system(size: 8, weight: .medium))
                .foregroundColor(coherenceColor)
        }
    }
    
    private var coherenceColor: Color {
        if coherence > 0.8 { return .green }
        else if coherence > 0.6 { return .orange }
        else { return .red }
    }
}

struct MetricPill: View {
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(AppTheme.caption2)
                .fontWeight(.medium)
                .foregroundColor(color)
            
            Text(label)
                .font(AppTheme.caption2)
                .foregroundColor(AppTheme.tertiaryText)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Text(value)
                .font(AppTheme.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(title)
                .font(AppTheme.caption)
                .foregroundColor(AppTheme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .padding(16)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct QualityMetricBar: View {
    let label: String
    let value: Float
    let color: Color
    
    var body: some View {
        HStack {
            Text(label)
                .font(AppTheme.body)
                .foregroundColor(AppTheme.primaryText)
                .frame(width: 150, alignment: .leading)
            
            ProgressView(value: Double(value), total: 1.0)
                .progressViewStyle(.linear)
                .tint(color)
                .frame(height: 8)
            
            Text(String(format: "%.2f", value))
                .font(AppTheme.caption)
                .foregroundColor(AppTheme.secondaryText)
                .frame(width: 40, alignment: .trailing)
        }
    }
}

struct PerformanceRow: View {
    let label: String
    let value: String
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(AppTheme.accentColor)
                .frame(width: 16)
            
            Text(label)
                .font(AppTheme.body)
                .foregroundColor(AppTheme.primaryText)
            
            Spacer()
            
            Text(value)
                .font(AppTheme.body)
                .fontWeight(.medium)
                .foregroundColor(AppTheme.secondaryText)
        }
    }
}

// MARK: - Data Models

struct DendrogramData {
    let levels: [DendrogramLevel]
}

struct DendrogramLevel {
    let nodes: [DendrogramNode]
}

struct DendrogramNode {
    let id: String
    let label: String
    let position: Float // 0.0 to 1.0
    let cluster: ContextCluster?
    let parent: DendrogramNode?
}

struct EvolutionData {
    let clusterPaths: [ClusterEvolutionPath]
}

struct ClusterEvolutionPath {
    let clusterId: String
    let color: Color
    let timePoints: [EvolutionTimePoint]
}

struct EvolutionTimePoint {
    let time: Date
    let size: Float
}

#Preview {
    ContextClusteringView(
        clusters: [],
        nodes: []
    )
    .frame(width: 1200, height: 800)
}