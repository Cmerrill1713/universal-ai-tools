import SwiftUI

struct ContextFlowDashboard: View {
    @StateObject private var contextFlowService = ContextFlowService.shared
    @State private var selectedTab: DashboardTab = .overview
    @State private var showSettings = false
    @State private var isExpanded = false
    
    enum DashboardTab: String, CaseIterable {
        case overview = "Overview"
        case sankey = "Flow Diagram"
        case network = "Similarity Network"
        case timeline = "Memory Timeline"
        case sources = "Source Attribution"
        case clusters = "Context Clusters"
        
        var icon: String {
            switch self {
            case .overview: return "chart.bar.doc.horizontal"
            case .sankey: return "arrow.right.arrow.left.circle"
            case .network: return "point.3.connected.trianglepath.dotted"
            case .timeline: return "clock.arrow.circlepath"
            case .sources: return "doc.text.magnifyingglass"
            case .clusters: return "circles.hexagongrid"
            }
        }
    }
    
    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                // Header
                headerView
                
                // Tab Navigation
                tabNavigationView
                
                // Main Content
                ZStack {
                    AppTheme.primaryBackground
                        .ignoresSafeArea()
                    
                    // Content based on selected tab
                    Group {
                        switch selectedTab {
                        case .overview:
                            overviewContent
                        case .sankey:
                            ContextSankeyDiagram(
                                contextPaths: contextFlowService.filteredContextPaths,
                                contextNodes: contextFlowService.filteredContextNodes
                            )
                        case .network:
                            SemanticSimilarityNetwork(
                                nodes: contextFlowService.filteredContextNodes,
                                edges: contextFlowService.filteredSimilarityEdges,
                                clusters: contextFlowService.filteredContextClusters
                            )
                        case .timeline:
                            MemoryTimelineView(
                                events: contextFlowService.filteredMemoryEvents,
                                contexts: contextFlowService.filteredContextNodes
                            )
                        case .sources:
                            RAGSourceAttributionView(
                                attributions: contextFlowService.sourceAttributions,
                                contexts: contextFlowService.filteredContextNodes
                            )
                        case .clusters:
                            ContextClusteringView(
                                clusters: contextFlowService.filteredContextClusters,
                                nodes: contextFlowService.filteredContextNodes
                            )
                        }
                    }
                    .transition(.opacity.combined(with: .slide))
                }
                
                // Status Bar
                statusBarView
            }
        }
        .background(AppTheme.primaryBackground)
        .onAppear {
            Task {
                await contextFlowService.connect()
            }
        }
        .sheet(isPresented: $showSettings) {
            contextFlowSettingsView
        }
    }
    
    // MARK: - Header View
    
    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Context Flow Visualization")
                    .font(AppTheme.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(AppTheme.primaryText)
                
                Text("Real-time RAG Context Analysis")
                    .font(AppTheme.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                // Connection status indicator
                connectionStatusView
                
                // Settings button
                Button(action: { showSettings = true }) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 16))
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
                
                // Expand/collapse button
                Button(action: { isExpanded.toggle() }) {
                    Image(systemName: isExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 16))
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(AppTheme.secondaryBackground)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.separator)
                .padding(.horizontal),
            alignment: .bottom
        )
    }
    
    private var connectionStatusView: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(contextFlowService.isConnected ? Color.green : Color.red)
                .frame(width: 8, height: 8)
                .scaleEffect(contextFlowService.isConnected ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: contextFlowService.isConnected)
            
            Text(contextFlowService.connectionStatus)
                .font(AppTheme.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
    }
    
    // MARK: - Tab Navigation
    
    private var tabNavigationView: some View {
        HStack(spacing: 0) {
            ForEach(DashboardTab.allCases, id: \.self) { tab in
                Button(action: {
                    withAnimation(AppTheme.normalAnimation) {
                        selectedTab = tab
                    }
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 14))
                        
                        if !isExpanded {
                            Text(tab.rawValue)
                                .font(AppTheme.callout)
                        }
                    }
                    .foregroundColor(selectedTab == tab ? AppTheme.primaryText : AppTheme.secondaryText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        selectedTab == tab ? AppTheme.surfaceBackground : Color.clear
                    )
                    .cornerRadius(6)
                }
                .buttonStyle(.plain)
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(AppTheme.tertiaryBackground)
    }
    
    // MARK: - Overview Content
    
    private var overviewContent: some View {
        ScrollView {
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: isExpanded ? 1 : 2),
                spacing: 16
            ) {
                // Real-time metrics
                metricsCard
                
                // Quick stats
                quickStatsCard
                
                // Recent activity
                recentActivityCard
                
                // Context flow summary
                contextFlowSummaryCard
            }
            .padding(20)
        }
    }
    
    private var metricsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundColor(AppTheme.accentBlue)
                Text("Real-Time Metrics")
                    .font(AppTheme.headline)
                    .foregroundColor(AppTheme.primaryText)
            }
            
            if let latestMetrics = contextFlowService.retrievalMetrics.first {
                VStack(spacing: 8) {
                    MetricRow(label: "Latency", value: String(format: "%.2fms", latestMetrics.latency * 1000), color: .orange)
                    MetricRow(label: "Relevance", value: String(format: "%.1f%%", latestMetrics.relevance * 100), color: .green)
                    MetricRow(label: "Diversity", value: String(format: "%.1f%%", latestMetrics.diversity * 100), color: .blue)
                    MetricRow(label: "Coverage", value: String(format: "%.1f%%", latestMetrics.coverage * 100), color: .purple)
                }
            } else {
                Text("No metrics available")
                    .foregroundColor(AppTheme.tertiaryText)
            }
        }
        .cardStyle()
    }
    
    private var quickStatsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "number")
                    .foregroundColor(AppTheme.accentGreen)
                Text("Quick Stats")
                    .font(AppTheme.headline)
                    .foregroundColor(AppTheme.primaryText)
            }
            
            VStack(spacing: 8) {
                StatRow(label: "Active Contexts", value: contextFlowService.filteredContextNodes.count)
                StatRow(label: "Context Paths", value: contextFlowService.filteredContextPaths.count)
                StatRow(label: "Similarity Links", value: contextFlowService.filteredSimilarityEdges.count)
                StatRow(label: "Context Clusters", value: contextFlowService.filteredContextClusters.count)
                StatRow(label: "Memory Events", value: contextFlowService.filteredMemoryEvents.count)
            }
        }
        .cardStyle()
    }
    
    private var recentActivityCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .foregroundColor(AppTheme.accentOrange)
                Text("Recent Activity")
                    .font(AppTheme.headline)
                    .foregroundColor(AppTheme.primaryText)
            }
            
            if contextFlowService.filteredMemoryEvents.isEmpty {
                Text("No recent activity")
                    .foregroundColor(AppTheme.tertiaryText)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(contextFlowService.filteredMemoryEvents.prefix(5)) { event in
                        HStack {
                            Image(systemName: event.action.icon)
                                .foregroundColor(event.action.color)
                                .frame(width: 14)
                            
                            Text(event.action.rawValue.capitalized)
                                .font(AppTheme.caption)
                                .foregroundColor(AppTheme.primaryText)
                            
                            Spacer()
                            
                            Text(timeAgoString(from: event.timestamp))
                                .font(AppTheme.caption)
                                .foregroundColor(AppTheme.tertiaryText)
                        }
                    }
                }
            }
        }
        .cardStyle()
    }
    
    private var contextFlowSummaryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "arrow.right.arrow.left.circle")
                    .foregroundColor(AppTheme.accentColor)
                Text("Context Flow Summary")
                    .font(AppTheme.headline)
                    .foregroundColor(AppTheme.primaryText)
            }
            
            if contextFlowService.filteredContextPaths.isEmpty {
                Text("No context flows to display")
                    .foregroundColor(AppTheme.tertiaryText)
            } else {
                let pathsByType = Dictionary(grouping: contextFlowService.filteredContextPaths) { $0.pathType }
                
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(ContextPath.ContextPathType.allCases, id: \.self) { pathType in
                        if let paths = pathsByType[pathType], !paths.isEmpty {
                            HStack {
                                Circle()
                                    .fill(pathType.color)
                                    .frame(width: 8, height: 8)
                                
                                Text(pathType.displayName)
                                    .font(AppTheme.caption)
                                    .foregroundColor(AppTheme.primaryText)
                                
                                Spacer()
                                
                                Text("\(paths.count)")
                                    .font(AppTheme.caption)
                                    .foregroundColor(AppTheme.secondaryText)
                            }
                        }
                    }
                }
            }
        }
        .cardStyle()
    }
    
    // MARK: - Status Bar
    
    private var statusBarView: some View {
        HStack {
            if let lastUpdate = contextFlowService.lastUpdate {
                Text("Last updated: \(lastUpdate.formatted(date: .omitted, time: .shortened))")
                    .font(AppTheme.caption)
                    .foregroundColor(AppTheme.tertiaryText)
            }
            
            Spacer()
            
            if contextFlowService.isLoading {
                HStack(spacing: 6) {
                    ProgressView()
                        .scaleEffect(0.7)
                    Text("Loading...")
                        .font(AppTheme.caption)
                        .foregroundColor(AppTheme.tertiaryText)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(AppTheme.tertiaryBackground)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.separator)
                .padding(.horizontal),
            alignment: .top
        )
    }
    
    // MARK: - Settings View
    
    private var contextFlowSettingsView: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Context Flow Settings")
                .font(AppTheme.title2)
                .fontWeight(.semibold)
                .foregroundColor(AppTheme.primaryText)
            
            VStack(alignment: .leading, spacing: 16) {
                // Time range selector
                VStack(alignment: .leading, spacing: 8) {
                    Text("Time Range")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Picker("Time Range", selection: $contextFlowService.selectedTimeRange) {
                        ForEach(ContextFlowService.TimeRange.allCases, id: \.self) { range in
                            Text(range.displayName).tag(range)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                
                // Node type filters
                VStack(alignment: .leading, spacing: 8) {
                    Text("Node Types")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                        ForEach(ContextNode.ContextNodeType.allCases, id: \.self) { nodeType in
                            Toggle(isOn: Binding(
                                get: { contextFlowService.selectedNodeTypes.contains(nodeType) },
                                set: { isSelected in
                                    if isSelected {
                                        contextFlowService.selectedNodeTypes.insert(nodeType)
                                    } else {
                                        contextFlowService.selectedNodeTypes.remove(nodeType)
                                    }
                                }
                            )) {
                                HStack {
                                    Image(systemName: nodeType.icon)
                                        .foregroundColor(nodeType.color)
                                    Text(nodeType.rawValue.capitalized)
                                        .font(AppTheme.caption)
                                }
                            }
                        }
                    }
                }
                
                // Relevance threshold
                VStack(alignment: .leading, spacing: 8) {
                    Text("Minimum Relevance: \(String(format: "%.1f%%", contextFlowService.minRelevanceThreshold * 100))")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Slider(value: $contextFlowService.minRelevanceThreshold, in: 0...1, step: 0.1)
                }
                
                // Visual options
                VStack(alignment: .leading, spacing: 8) {
                    Text("Visual Options")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Toggle("Show Context Clusters", isOn: $contextFlowService.showClusters)
                    Toggle("Show Similarity Edges", isOn: $contextFlowService.showSimilarityEdges)
                }
            }
            
            Spacer()
            
            HStack {
                Spacer()
                Button("Done") {
                    showSettings = false
                }
                .applyPrimaryButtonStyle()
            }
        }
        .padding(20)
        .frame(width: 500, height: 600)
        .background(AppTheme.primaryBackground)
    }
    
    // MARK: - Helper Functions
    
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
}

// MARK: - Helper Views

struct MetricRow: View {
    let label: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack {
            Text(label)
                .font(AppTheme.caption)
                .foregroundColor(AppTheme.secondaryText)
            
            Spacer()
            
            Text(value)
                .font(AppTheme.caption)
                .fontWeight(.medium)
                .foregroundColor(color)
        }
    }
}

struct StatRow: View {
    let label: String
    let value: Int
    
    var body: some View {
        HStack {
            Text(label)
                .font(AppTheme.caption)
                .foregroundColor(AppTheme.secondaryText)
            
            Spacer()
            
            Text("\(value)")
                .font(AppTheme.caption)
                .fontWeight(.medium)
                .foregroundColor(AppTheme.primaryText)
        }
    }
}

extension View {
    func cardStyle() -> some View {
        self
            .padding(16)
            .background(AppTheme.surfaceBackground)
            .cornerRadius(AppTheme.mediumRadius)
            .shadow(color: AppTheme.lightShadow, radius: 2, x: 0, y: 1)
    }
}

#Preview {
    ContextFlowDashboard.init()
        .frame(width: 1200, height: 800)
}