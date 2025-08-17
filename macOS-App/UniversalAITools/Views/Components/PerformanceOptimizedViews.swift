import SwiftUI
import Combine

/// Performance-Optimized View Components
/// Implements lazy loading, efficient rendering, and memory-conscious patterns
struct PerformanceOptimizedViews {
    
    // MARK: - Lazy Loading List
    
    /// High-performance list with lazy loading and virtualization
    struct LazyOptimizedList<Item: Identifiable, Content: View>: View {
        let items: [Item]
        let content: (Item) -> Content
        let loadMoreThreshold: Int
        let onLoadMore: (() -> Void)?
        
        @State private var visibleRange: Range<Int> = 0..<20
        @State private var isLoadingMore = false
        @StateObject private var performanceService = PerformanceOptimizationService.shared
        
        private let itemHeight: CGFloat = 60
        private let bufferSize: Int = 10
        
        init(
            items: [Item],
            loadMoreThreshold: Int = 5,
            onLoadMore: (() -> Void)? = nil,
            @ViewBuilder content: @escaping (Item) -> Content
        ) {
            self.items = items
            self.content = content
            self.loadMoreThreshold = loadMoreThreshold
            self.onLoadMore = onLoadMore
        }
        
        var body: some View {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(visibleItems.enumerated()), id: \.element.id) { index, item in
                            LazyItemView(
                                item: item,
                                index: index,
                                content: content
                            )
                            .frame(height: itemHeight)
                            .onAppear {
                                handleItemAppear(at: index)
                            }
                        }
                        
                        if isLoadingMore {
                            HStack {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("Loading more...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .frame(height: 40)
                        }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: NSApplication.didReceiveMemoryWarningNotification)) { _ in
                    optimizeForMemoryPressure()
                }
            }
        }
        
        private var visibleItems: ArraySlice<Item> {
            let endIndex = min(visibleRange.upperBound, items.count)
            return items[visibleRange.lowerBound..<endIndex]
        }
        
        private func handleItemAppear(at index: Int) {
            // Expand visible range if needed
            let globalIndex = visibleRange.lowerBound + index
            
            if globalIndex >= visibleRange.upperBound - bufferSize {
                expandVisibleRange()
            }
            
            // Trigger load more if near end
            if globalIndex >= items.count - loadMoreThreshold {
                loadMore()
            }
        }
        
        private func expandVisibleRange() {
            let newUpperBound = min(visibleRange.upperBound + 20, items.count)
            visibleRange = visibleRange.lowerBound..<newUpperBound
        }
        
        private func loadMore() {
            guard !isLoadingMore, let onLoadMore = onLoadMore else { return }
            
            isLoadingMore = true
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                onLoadMore()
                isLoadingMore = false
            }
        }
        
        private func optimizeForMemoryPressure() {
            // Reduce visible range during memory pressure
            let reducedRange = visibleRange.lowerBound..<min(visibleRange.lowerBound + 10, items.count)
            visibleRange = reducedRange
        }
    }
    
    struct LazyItemView<Item: Identifiable, Content: View>: View {
        let item: Item
        let index: Int
        let content: (Item) -> Content
        
        @State private var isLoaded = false
        
        var body: some View {
            Group {
                if isLoaded {
                    content(item)
                } else {
                    Rectangle()
                        .fill(.quaternary)
                        .opacity(0.1)
                        .overlay(
                            ProgressView()
                                .scaleEffect(0.5)
                        )
                }
            }
            .onAppear {
                loadContent()
            }
        }
        
        private func loadContent() {
            guard !isLoaded else { return }
            
            // Stagger loading to prevent UI freezes
            let delay = Double(index % 5) * 0.02
            
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isLoaded = true
                }
            }
        }
    }
    
    // MARK: - Optimized Image Grid
    
    /// Memory-efficient image grid with lazy loading
    struct OptimizedImageGrid: View {
        let imageUrls: [URL]
        let columns: Int
        let spacing: CGFloat
        
        @StateObject private var performanceService = PerformanceOptimizationService.shared
        @State private var loadedImages: [URL: NSImage] = [:]
        @State private var visibleImageIndices: Set<Int> = []
        
        private let gridColumns: [GridItem]
        
        init(imageUrls: [URL], columns: Int = 3, spacing: CGFloat = 10) {
            self.imageUrls = imageUrls
            self.columns = columns
            self.spacing = spacing
            self.gridColumns = Array(repeating: GridItem(.flexible(), spacing: spacing), count: columns)
        }
        
        var body: some View {
            ScrollView {
                LazyVGrid(columns: gridColumns, spacing: spacing) {
                    ForEach(Array(imageUrls.enumerated()), id: \.offset) { index, url in
                        OptimizedImageCell(
                            url: url,
                            isVisible: visibleImageIndices.contains(index),
                            performanceService: performanceService
                        )
                        .aspectRatio(1, contentMode: .fit)
                        .onAppear {
                            visibleImageIndices.insert(index)
                            preloadNearbyImages(around: index)
                        }
                        .onDisappear {
                            visibleImageIndices.remove(index)
                        }
                    }
                }
                .padding(spacing)
            }
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didReceiveMemoryWarningNotification)) { _ in
                handleMemoryPressure()
            }
        }
        
        private func preloadNearbyImages(around index: Int) {
            let preloadRange = max(0, index - 2)...min(imageUrls.count - 1, index + 6)
            
            Task {
                await performanceService.preloadData(
                    from: Array(imageUrls[preloadRange]),
                    type: Data.self,
                    priority: .low
                )
            }
        }
        
        private func handleMemoryPressure() {
            // Clear images that are not currently visible
            let imagesToRemove = loadedImages.keys.filter { url in
                !visibleImageIndices.contains(imageUrls.firstIndex(of: url) ?? -1)
            }
            
            for url in imagesToRemove {
                loadedImages.removeValue(forKey: url)
            }
        }
    }
    
    struct OptimizedImageCell: View {
        let url: URL
        let isVisible: Bool
        let performanceService: PerformanceOptimizationService
        
        @State private var image: NSImage?
        @State private var isLoading = false
        @State private var loadingProgress: Double = 0
        
        var body: some View {
            Group {
                if let image = image {
                    Image(nsImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .clipped()
                        .transition(.opacity.combined(with: .scale(scale: 0.8)))
                } else if isLoading {
                    ZStack {
                        Rectangle()
                            .fill(.quaternary.opacity(0.3))
                        
                        VStack(spacing: 8) {
                            ProgressView(value: loadingProgress)
                                .frame(width: 60)
                            
                            Text("\(Int(loadingProgress * 100))%")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                } else {
                    Rectangle()
                        .fill(.quaternary.opacity(0.1))
                        .overlay(
                            Image(systemName: "photo")
                                .foregroundColor(.secondary)
                        )
                }
            }
            .cornerRadius(8)
            .onChange(of: isVisible) { visible in
                if visible && image == nil && !isLoading {
                    loadImage()
                }
            }
        }
        
        private func loadImage() {
            guard !isLoading else { return }
            
            isLoading = true
            loadingProgress = 0
            
            Task {
                // Simulate progressive loading
                let progressUpdates = [0.2, 0.4, 0.6, 0.8, 1.0]
                for progress in progressUpdates {
                    await MainActor.run {
                        withAnimation(.easeInOut(duration: 0.1)) {
                            loadingProgress = progress
                        }
                    }
                    try? await Task.sleep(nanoseconds: 50_000_000) // 0.05 seconds
                }
                
                // Load actual image
                let loadedImage = await performanceService.loadImage(
                    from: url,
                    size: CGSize(width: 200, height: 200)
                )
                
                await MainActor.run {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        self.image = loadedImage
                        self.isLoading = false
                    }
                }
            }
        }
    }
    
    // MARK: - Efficient Data Table
    
    /// High-performance data table with virtualization
    struct OptimizedDataTable<Item: Identifiable>: View {
        let items: [Item]
        let columns: [TableColumn<Item>]
        let rowHeight: CGFloat
        
        @State private var visibleRange: Range<Int> = 0..<50
        @State private var scrollOffset: CGFloat = 0
        
        private let bufferSize: Int = 20
        
        init(
            items: [Item],
            columns: [TableColumn<Item>],
            rowHeight: CGFloat = 40
        ) {
            self.items = items
            self.columns = columns
            self.rowHeight = rowHeight
        }
        
        var body: some View {
            VStack(spacing: 0) {
                // Header
                tableHeader
                
                Divider()
                
                // Table content
                GeometryReader { geometry in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            // Spacer for items before visible range
                            if visibleRange.lowerBound > 0 {
                                Rectangle()
                                    .fill(.clear)
                                    .frame(height: CGFloat(visibleRange.lowerBound) * rowHeight)
                            }
                            
                            // Visible items
                            ForEach(Array(visibleItems.enumerated()), id: \.element.id) { index, item in
                                TableRow(
                                    item: item,
                                    columns: columns,
                                    height: rowHeight
                                )
                                .onAppear {
                                    updateVisibleRange(itemIndex: visibleRange.lowerBound + index, geometry: geometry)
                                }
                            }
                            
                            // Spacer for items after visible range
                            let remainingItems = items.count - visibleRange.upperBound
                            if remainingItems > 0 {
                                Rectangle()
                                    .fill(.clear)
                                    .frame(height: CGFloat(remainingItems) * rowHeight)
                            }
                        }
                    }
                    .coordinateSpace(name: "scroll")
                }
            }
        }
        
        private var tableHeader: some View {
            HStack(spacing: 0) {
                ForEach(columns.indices, id: \.self) { index in
                    Text(columns[index].title)
                        .font(.headline)
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                    
                    if index < columns.count - 1 {
                        Divider()
                    }
                }
            }
            .background(.ultraThinMaterial)
        }
        
        private var visibleItems: ArraySlice<Item> {
            let endIndex = min(visibleRange.upperBound, items.count)
            return items[visibleRange.lowerBound..<endIndex]
        }
        
        private func updateVisibleRange(itemIndex: Int, geometry: GeometryProxy) {
            let viewportHeight = geometry.size.height
            let itemsInViewport = Int(viewportHeight / rowHeight) + bufferSize * 2
            
            let newStart = max(0, itemIndex - bufferSize)
            let newEnd = min(items.count, newStart + itemsInViewport)
            
            let newRange = newStart..<newEnd
            
            if newRange != visibleRange {
                visibleRange = newRange
            }
        }
    }
    
    struct TableColumn<Item> {
        let title: String
        let content: (Item) -> AnyView
        let width: CGFloat?
        
        init<Content: View>(
            title: String,
            width: CGFloat? = nil,
            @ViewBuilder content: @escaping (Item) -> Content
        ) {
            self.title = title
            self.width = width
            self.content = { AnyView(content($0)) }
        }
    }
    
    struct TableRow<Item>: View {
        let item: Item
        let columns: [TableColumn<Item>]
        let height: CGFloat
        
        var body: some View {
            HStack(spacing: 0) {
                ForEach(columns.indices, id: \.self) { index in
                    columns[index].content(item)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(height: height)
                        .padding(.horizontal, 12)
                    
                    if index < columns.count - 1 {
                        Divider()
                    }
                }
            }
            .background(.background)
        }
    }
    
    // MARK: - Cached Web View
    
    /// Web view with intelligent caching and memory management
    struct CachedWebView: View {
        let url: URL
        let cachePolicy: CachePolicy
        
        @StateObject private var performanceService = PerformanceOptimizationService.shared
        @State private var isLoading = true
        @State private var loadingProgress: Double = 0
        @State private var error: Error?
        
        enum CachePolicy {
            case aggressive, normal, minimal
            
            var urlCachePolicy: URLRequest.CachePolicy {
                switch self {
                case .aggressive: return .returnCacheDataElseLoad
                case .normal: return .useProtocolCachePolicy
                case .minimal: return .reloadIgnoringLocalCacheData
                }
            }
        }
        
        init(url: URL, cachePolicy: CachePolicy = .normal) {
            self.url = url
            self.cachePolicy = cachePolicy
        }
        
        var body: some View {
            ZStack {
                if let error = error {
                    ErrorView(error: error) {
                        loadContent()
                    }
                } else if isLoading {
                    LoadingView(progress: loadingProgress)
                } else {
                    WebContentView(url: url, cachePolicy: cachePolicy.urlCachePolicy)
                }
            }
            .onAppear {
                loadContent()
            }
        }
        
        private func loadContent() {
            isLoading = true
            error = nil
            loadingProgress = 0
            
            Task {
                do {
                    // Simulate progressive loading
                    for progress in stride(from: 0.1, through: 1.0, by: 0.1) {
                        await MainActor.run {
                            loadingProgress = progress
                        }
                        try await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
                    }
                    
                    await MainActor.run {
                        isLoading = false
                    }
                } catch {
                    await MainActor.run {
                        self.error = error
                        isLoading = false
                    }
                }
            }
        }
    }
    
    struct WebContentView: View {
        let url: URL
        let cachePolicy: URLRequest.CachePolicy
        
        var body: some View {
            // Placeholder for actual web view implementation
            VStack {
                Text("Web Content")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text(url.absoluteString)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
                
                Text("Cache Policy: \(String(describing: cachePolicy))")
                    .font(.caption2)
                    .foregroundColor(.tertiary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.ultraThinMaterial)
            .cornerRadius(8)
        }
    }
    
    struct LoadingView: View {
        let progress: Double
        
        var body: some View {
            VStack(spacing: 16) {
                ProgressView(value: progress)
                    .frame(width: 200)
                
                Text("Loading... \(Int(progress * 100))%")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.ultraThinMaterial)
        }
    }
    
    struct ErrorView: View {
        let error: Error
        let retry: () -> Void
        
        var body: some View {
            VStack(spacing: 16) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.largeTitle)
                    .foregroundColor(.orange)
                
                Text("Failed to load content")
                    .font(.headline)
                
                Text(error.localizedDescription)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                
                Button("Retry", action: retry)
                    .buttonStyle(.borderedProminent)
            }
            .padding()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.ultraThinMaterial)
        }
    }
}

// MARK: - Performance Monitoring View

struct PerformanceMonitoringView: View {
    @StateObject private var performanceService = PerformanceOptimizationService.shared
    @State private var selectedMetric: MetricType = .memory
    
    enum MetricType: String, CaseIterable {
        case memory = "Memory"
        case cache = "Cache"
        case network = "Network"
        case recommendations = "Recommendations"
        
        var icon: String {
            switch self {
            case .memory: return "memorychip"
            case .cache: return "externaldrive"
            case .network: return "network"
            case .recommendations: return "lightbulb"
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            header
            
            // Metric selector
            metricSelector
            
            Divider()
            
            // Content
            metricContent
        }
        .background(.background)
    }
    
    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Performance Monitor")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text("Real-time system performance metrics")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Button("Clear Caches") {
                performanceService.clearCaches()
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }
    
    private var metricSelector: some View {
        HStack {
            ForEach(MetricType.allCases, id: \.self) { metric in
                Button(action: { selectedMetric = metric }) {
                    HStack(spacing: 8) {
                        Image(systemName: metric.icon)
                        Text(metric.rawValue)
                    }
                    .font(.subheadline)
                    .foregroundColor(selectedMetric == metric ? .white : .primary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(selectedMetric == metric ? .blue : .clear)
                    )
                }
                .buttonStyle(.plain)
            }
            
            Spacer()
        }
        .padding()
    }
    
    @ViewBuilder
    private var metricContent: some View {
        switch selectedMetric {
        case .memory:
            memoryMetrics
        case .cache:
            cacheMetrics
        case .network:
            networkMetrics
        case .recommendations:
            recommendationsView
        }
    }
    
    private var memoryMetrics: some View {
        VStack(spacing: 20) {
            MetricCard(
                title: "Current Memory Usage",
                value: "\(String(format: "%.1f", performanceService.currentMemoryUsage)) MB",
                trend: .stable,
                color: .blue
            )
            
            MetricCard(
                title: "Peak Memory Usage",
                value: "\(String(format: "%.1f", performanceService.performanceMetrics.peakMemoryUsage)) MB",
                trend: .rising,
                color: .orange
            )
            
            MetricCard(
                title: "Memory Pressure Events",
                value: "\(performanceService.performanceMetrics.memoryPressureEvents)",
                trend: .stable,
                color: .red
            )
        }
        .padding()
    }
    
    private var cacheMetrics: some View {
        VStack(spacing: 20) {
            MetricCard(
                title: "Cache Hit Rate",
                value: "\(String(format: "%.1f", performanceService.cacheHitRate * 100))%",
                trend: .rising,
                color: .green
            )
            
            MetricCard(
                title: "Cache Hits",
                value: "\(performanceService.performanceMetrics.cacheHits)",
                trend: .rising,
                color: .blue
            )
            
            MetricCard(
                title: "Cache Misses",
                value: "\(performanceService.performanceMetrics.cacheMisses)",
                trend: .stable,
                color: .orange
            )
        }
        .padding()
    }
    
    private var networkMetrics: some View {
        VStack(spacing: 20) {
            MetricCard(
                title: "Network Requests",
                value: "\(performanceService.performanceMetrics.networkRequests)",
                trend: .rising,
                color: .blue
            )
            
            MetricCard(
                title: "Average Load Time",
                value: "\(String(format: "%.2f", performanceService.averageResponseTime))s",
                trend: .falling,
                color: .green
            )
            
            MetricCard(
                title: "Total Load Time",
                value: "\(String(format: "%.1f", performanceService.performanceMetrics.totalLoadTime))s",
                trend: .rising,
                color: .purple
            )
        }
        .padding()
    }
    
    private var recommendationsView: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                let recommendations = performanceService.getPerformanceRecommendations()
                
                ForEach(recommendations) { recommendation in
                    RecommendationCard(recommendation: recommendation)
                }
                
                if recommendations.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.largeTitle)
                            .foregroundColor(.green)
                        
                        Text("Performance is Optimal")
                            .font(.headline)
                        
                        Text("No performance issues detected")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(.ultraThinMaterial)
                    .cornerRadius(12)
                }
            }
            .padding()
        }
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let trend: ModernUIComponentsLibrary.ParticleDataCard.TrendDirection
    let color: Color
    
    var body: some View {
        ModernUIComponentsLibrary.ParticleDataCard(
            title: title,
            value: value,
            trend: trend,
            color: color
        )
    }
}

struct RecommendationCard: View {
    let recommendation: PerformanceRecommendation
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "lightbulb.fill")
                    .foregroundColor(recommendation.impact.color)
                
                Text(recommendation.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Text(String(describing: recommendation.impact).uppercased())
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(recommendation.impact.color)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(recommendation.impact.color.opacity(0.1))
                    .cornerRadius(4)
            }
            
            Text(recommendation.description)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

#Preview {
    PerformanceMonitoringView()
        .frame(width: 600, height: 500)
}