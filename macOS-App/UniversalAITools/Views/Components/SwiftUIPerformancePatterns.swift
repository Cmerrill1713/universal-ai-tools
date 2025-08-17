import SwiftUI
import Foundation

/// SwiftUI performance optimization patterns for large datasets and complex UI
/// Implements lazy loading, efficient state management, and memory optimization

// MARK: - Lazy Loading Components

/// Efficient lazy loading for large lists with dynamic content
struct LazyPerformantList<Item: Identifiable, Content: View>: View {
    let items: [Item]
    let content: (Item) -> Content
    let itemHeight: CGFloat
    let bufferSize: Int
    
    @State private var visibleRange: Range<Int> = 0..<0
    @State private var scrollPosition: CGFloat = 0
    @State private var containerHeight: CGFloat = 0
    
    init(
        items: [Item],
        itemHeight: CGFloat = 44,
        bufferSize: Int = 10,
        @ViewBuilder content: @escaping (Item) -> Content
    ) {
        self.items = items
        self.itemHeight = itemHeight
        self.bufferSize = bufferSize
        self.content = content
    }
    
    var body: some View {
        GeometryReader { geometry in
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0) {
                        // Spacer for items above visible range
                        if visibleRange.lowerBound > 0 {
                            Spacer()
                                .frame(height: CGFloat(visibleRange.lowerBound) * itemHeight)
                        }
                        
                        // Visible items with buffer
                        ForEach(visibleItems, id: \.id) { item in
                            content(item)
                                .frame(height: itemHeight)
                                .onAppear {
                                    updateVisibleRangeIfNeeded()
                                }
                        }
                        
                        // Spacer for items below visible range
                        if visibleRange.upperBound < items.count {
                            Spacer()
                                .frame(height: CGFloat(items.count - visibleRange.upperBound) * itemHeight)
                        }
                    }
                    .background(
                        GeometryReader { scrollGeometry in
                            Color.clear
                                .preference(key: ScrollOffsetPreferenceKey.self,
                                          value: scrollGeometry.frame(in: .named("scroll")).minY)
                        }
                    )
                }
                .coordinateSpace(name: "scroll")
                .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
                    scrollPosition = -value
                    updateVisibleRange(geometry: geometry)
                }
                .onAppear {
                    containerHeight = geometry.size.height
                    updateVisibleRange(geometry: geometry)
                }
                .onChange(of: geometry.size) { size in
                    containerHeight = size.height
                    updateVisibleRange(geometry: geometry)
                }
            }
        }
    }
    
    private var visibleItems: ArraySlice<Item> {
        let start = max(0, visibleRange.lowerBound)
        let end = min(items.count, visibleRange.upperBound)
        return items[start..<end]
    }
    
    private func updateVisibleRange(geometry: GeometryProxy) {
        let viewportHeight = geometry.size.height
        let firstVisibleIndex = max(0, Int(scrollPosition / itemHeight))
        let lastVisibleIndex = min(items.count, Int((scrollPosition + viewportHeight) / itemHeight) + 1)
        
        // Add buffer
        let bufferedStart = max(0, firstVisibleIndex - bufferSize)
        let bufferedEnd = min(items.count, lastVisibleIndex + bufferSize)
        
        let newRange = bufferedStart..<bufferedEnd
        if newRange != visibleRange {
            visibleRange = newRange
        }
    }
    
    private func updateVisibleRangeIfNeeded() {
        // Trigger range update if needed during scrolling
    }
}

struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Efficient State Management

/// Optimized state container that minimizes SwiftUI updates
@MainActor
class PerformantStateContainer<T: Equatable>: ObservableObject {
    @Published private var _value: T
    private var lastPublishedValue: T
    private var updateThreshold: TimeInterval
    private var lastUpdateTime: Date = Date()
    
    var value: T {
        get { _value }
        set {
            let now = Date()
            let timeSinceLastUpdate = now.timeIntervalSince(lastUpdateTime)
            
            // Only publish if value changed and enough time has passed (debouncing)
            if newValue != lastPublishedValue && timeSinceLastUpdate >= updateThreshold {
                _value = newValue
                lastPublishedValue = newValue
                lastUpdateTime = now
            } else {
                _value = newValue
            }
        }
    }
    
    init(_ initialValue: T, updateThreshold: TimeInterval = 0.016) { // ~60fps
        self._value = initialValue
        self.lastPublishedValue = initialValue
        self.updateThreshold = updateThreshold
    }
    
    func forceUpdate() {
        lastPublishedValue = _value
        objectWillChange.send()
    }
}

// MARK: - Memory-Efficient Image Loading

/// Async image loader with caching and memory management
struct PerformantAsyncImage: View {
    let url: URL?
    let placeholder: AnyView
    let maxSize: CGSize
    
    @StateObject private var loader: AsyncImageLoader = AsyncImageLoader()
    @State private var loadedImage: NSImage?
    
    init<Placeholder: View>(
        url: URL?,
        maxSize: CGSize = CGSize(width: 200, height: 200),
        @ViewBuilder placeholder: () -> Placeholder
    ) {
        self.url = url
        self.maxSize = maxSize
        self.placeholder = AnyView(placeholder())
    }
    
    var body: some View {
        Group {
            if let image = loadedImage {
                Image(nsImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
            } else {
                placeholder
            }
        }
        .onAppear {
            loadImage()
        }
        .onChange(of: url) { _ in
            loadImage()
        }
        .onDisappear {
            cancelImageLoad()
        }
    }
    
    private func loadImage() {
        guard let url = url else { return }
        
        Task {
            do {
                let image = try await loader.loadImage(from: url, maxSize: maxSize)
                await MainActor.run {
                    self.loadedImage = image
                }
            } catch {
                // Handle loading error silently or show error placeholder
            }
        }
    }
    
    private func cancelImageLoad() {
        // Cancel any ongoing loading tasks
        loader.cancelLoad(for: url)
    }
}

@MainActor
class AsyncImageLoader: ObservableObject {
    private var cache: NSCache<NSURL, NSImage> = NSCache<NSURL, NSImage>()
    private var loadingTasks: [URL: Task<NSImage, Error>] = [:]
    
    init() {
        cache.countLimit = 100 // Limit cache size
        cache.totalCostLimit = 50 * 1024 * 1024 // 50MB limit
    }
    
    func loadImage(from url: URL, maxSize: CGSize) async throws -> NSImage {
        // Check cache first
        if let cachedImage = cache.object(forKey: url as NSURL) {
            return cachedImage
        }
        
        // Check if already loading
        if let existingTask = loadingTasks[url] {
            return try await existingTask.value
        }
        
        // Create new loading task
        let task = Task<NSImage, Error> {
            let (data, _) = try await URLSession.shared.data(from: url)
            
            guard let image = NSImage(data: data) else {
                throw ImageLoadingError.invalidImageData
            }
            
            // Resize image to save memory
            let resizedImage = image.resized(to: maxSize)
            
            // Cache the resized image
            cache.setObject(resizedImage, forKey: url as NSURL)
            
            return resizedImage
        }
        
        loadingTasks[url] = task
        
        do {
            let image = try await task.value
            loadingTasks.removeValue(forKey: url)
            return image
        } catch {
            loadingTasks.removeValue(forKey: url)
            throw error
        }
    }
    
    func cancelLoad(for url: URL?) {
        guard let url = url else { return }
        loadingTasks[url]?.cancel()
        loadingTasks.removeValue(forKey: url)
    }
    
    func clearCache() {
        cache.removeAllObjects()
    }
}

enum ImageLoadingError: Error {
    case invalidImageData
    case networkError
    case cancelled
}

extension NSImage {
    func resized(to maxSize: CGSize) -> NSImage {
        let currentSize = self.size
        
        // Calculate new size maintaining aspect ratio
        let widthRatio = maxSize.width / currentSize.width
        let heightRatio = maxSize.height / currentSize.height
        let scaleFactor = min(widthRatio, heightRatio)
        
        if scaleFactor >= 1.0 {
            return self // Don't upscale
        }
        
        let newSize = CGSize(
            width: currentSize.width * scaleFactor,
            height: currentSize.height * scaleFactor
        )
        
        let resizedImage = NSImage(size: newSize)
        resizedImage.lockFocus()
        defer { resizedImage.unlockFocus() }
        
        self.draw(in: NSRect(origin: .zero, size: newSize),
                 from: NSRect(origin: .zero, size: currentSize),
                 operation: .sourceOver,
                 fraction: 1.0)
        
        return resizedImage
    }
}

// MARK: - Efficient Graph Rendering

/// High-performance graph component for large datasets
struct PerformantGraphView: View {
    let nodes: [PerformanceGraphNode]
    let connections: [GraphConnection]
    let maxVisibleNodes: Int
    
    @State private var visibleNodes: Set<UUID> = []
    @State private var viewportBounds: CGRect = .zero
    @State private var lastUpdateTime: Date = Date()
    @StateObject private var stateContainer = PerformantStateContainer<GraphViewState>(GraphViewState())
    
    init(nodes: [PerformanceGraphNode], connections: [GraphConnection], maxVisibleNodes: Int = 500) {
        self.nodes = nodes
        self.connections = connections
        self.maxVisibleNodes = maxVisibleNodes
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background
                Color.clear
                
                // Connections (rendered efficiently)
                Canvas { context, size in
                    drawConnections(context: context, size: size)
                }
                
                // Nodes (lazy rendered)
                ForEach(visibleNodesList, id: \.id) { node in
                    NodeView(node: node)
                        .position(node.position)
                        .opacity(nodeOpacity(for: node))
                        .animation(.easeInOut(duration: 0.2), value: nodeOpacity(for: node))
                }
            }
            .clipped()
            .onAppear {
                updateVisibleNodes(in: geometry.frame(in: .local))
            }
            .onChange(of: geometry.size) { _ in
                updateVisibleNodes(in: geometry.frame(in: .local))
            }
        }
    }
    
    private var visibleNodesList: [PerformanceGraphNode] {
        nodes.filter { visibleNodes.contains($0.id) }
    }
    
    private func updateVisibleNodes(in bounds: CGRect) {
        let now = Date()
        guard now.timeIntervalSince(lastUpdateTime) > 0.1 else { return } // Throttle updates
        lastUpdateTime = now
        
        // Calculate visible nodes based on viewport
        let expandedBounds = bounds.insetBy(dx: -100, dy: -100) // Buffer area
        
        let nodesInView = nodes.filter { node in
            expandedBounds.contains(node.position)
        }
        
        // Limit to max visible nodes for performance
        let limitedNodes = Array(nodesInView.prefix(maxVisibleNodes))
        visibleNodes = Set(limitedNodes.map { $0.id })
    }
    
    private func drawConnections(context: GraphicsContext, size: CGSize) {
        // Only draw connections between visible nodes
        let visibleConnections = connections.filter { connection in
            visibleNodes.contains(connection.fromNodeId) && visibleNodes.contains(connection.toNodeId)
        }
        
        for connection in visibleConnections {
            guard let fromNode = nodes.first(where: { $0.id == connection.fromNodeId }),
                  let toNode = nodes.first(where: { $0.id == connection.toNodeId }) else {
                continue
            }
            
            let path = Path { path in
                path.move(to: fromNode.position)
                path.addLine(to: toNode.position)
            }
            
            context.stroke(path, with: .color(connection.color), lineWidth: connection.lineWidth)
        }
    }
    
    private func nodeOpacity(for node: PerformanceGraphNode) -> Double {
        visibleNodes.contains(node.id) ? 1.0 : 0.0
    }
}

struct GraphViewState: Equatable {
    var zoomLevel: CGFloat = 1.0
    var panOffset: CGPoint = .zero
    var selectedNodes: Set<UUID> = []
}

struct PerformanceGraphNode: Identifiable {
    let id = UUID()
    let position: CGPoint
    let title: String
    let nodeType: NodeType
    
    enum NodeType {
        case primary, secondary, tertiary
        
        var color: Color {
            switch self {
            case .primary: return .blue
            case .secondary: return .green  
            case .tertiary: return .orange
            }
        }
    }
}

struct GraphConnection {
    let fromNodeId: UUID
    let toNodeId: UUID
    let color: Color
    let lineWidth: CGFloat
    
    init(fromNodeId: UUID, toNodeId: UUID, color: Color = .gray, lineWidth: CGFloat = 1.0) {
        self.fromNodeId = fromNodeId
        self.toNodeId = toNodeId
        self.color = color
        self.lineWidth = lineWidth
    }
}

struct NodeView: View {
    let node: PerformanceGraphNode
    
    var body: some View {
        Circle()
            .fill(node.nodeType.color)
            .frame(width: 20, height: 20)
            .overlay(
                Circle()
                    .stroke(Color.white, lineWidth: 2)
            )
            .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Performance Monitoring

/// Performance monitoring utility for SwiftUI views
struct PerformanceMonitor: View {
    @StateObject private var monitor = ViewPerformanceMonitor()
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Performance")
                .font(.caption)
                .fontWeight(.semibold)
            
            HStack {
                Text("FPS:")
                    .font(.caption2)
                Text("\(monitor.currentFPS, specifier: "%.1f")")
                    .font(.caption2)
                    .fontFamily(.monospaced)
                    .foregroundColor(fpsColor)
            }
            
            HStack {
                Text("Memory:")
                    .font(.caption2)
                Text("\(monitor.memoryUsage, specifier: "%.1f") MB")
                    .font(.caption2)
                    .fontFamily(.monospaced)
            }
        }
        .padding(6)
        .background(.ultraThinMaterial)
        .cornerRadius(4)
    }
    
    private var fpsColor: Color {
        if monitor.currentFPS > 55 { return .green }
        else if monitor.currentFPS > 30 { return .yellow }
        else { return .red }
    }
}

@MainActor
class ViewPerformanceMonitor: ObservableObject {
    @Published var currentFPS: Double = 60.0
    @Published var memoryUsage: Double = 0.0
    
    private var frameCount: Int = 0
    private var lastFPSUpdate: Date = Date()
    private var fpsTimer: Timer?
    private var memoryTimer: Timer?
    
    init() {
        startMonitoring()
    }
    
    deinit {
        stopMonitoring()
    }
    
    private func startMonitoring() {
        // FPS monitoring
        fpsTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.updateFPS()
        }
        
        // Memory monitoring
        memoryTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.updateMemoryUsage()
        }
    }
    
    private func stopMonitoring() {
        fpsTimer?.invalidate()
        memoryTimer?.invalidate()
    }
    
    func recordFrame() {
        frameCount += 1
    }
    
    private func updateFPS() {
        let now = Date()
        let timeInterval = now.timeIntervalSince(lastFPSUpdate)
        currentFPS = Double(frameCount) / timeInterval
        frameCount = 0
        lastFPSUpdate = now
    }
    
    private func updateMemoryUsage() {
        let info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if kerr == KERN_SUCCESS {
            memoryUsage = Double(info.resident_size) / 1024.0 / 1024.0
        }
    }
}

// MARK: - Usage Examples and Integration Helpers

/// Example usage of performance patterns
struct PerformanceOptimizedView: View {
    @StateObject private var largeDataset = LargeDatasetManager()
    @StateObject private var imageCache = AsyncImageLoader()
    
    var body: some View {
        HStack(spacing: 0) {
            // High-performance list
            LazyPerformantList(
                items: largeDataset.items,
                itemHeight: 60
            ) { item in
                ItemRowView(item: item)
            }
            .frame(maxWidth: 300)
            
            Divider()
            
            // Performance-optimized graph
            PerformantGraphView(
                nodes: largeDataset.graphNodes,
                connections: largeDataset.connections,
                maxVisibleNodes: 200
            )
        }
        .overlay(
            PerformanceMonitor(),
            alignment: .topTrailing
        )
    }
}

struct ItemRowView: View {
    let item: DataItem
    
    var body: some View {
        HStack {
            PerformantAsyncImage(url: item.imageURL) {
                Rectangle()
                    .fill(.gray.opacity(0.3))
                    .frame(width: 40, height: 40)
            }
            .frame(width: 40, height: 40)
            
            VStack(alignment: .leading) {
                Text(item.title)
                    .font(.caption)
                    .lineLimit(1)
                
                Text(item.subtitle)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
    }
}

struct DataItem: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let imageURL: URL?
}

@MainActor
class LargeDatasetManager: ObservableObject {
    @Published var items: [DataItem] = []
    @Published var graphNodes: [PerformanceGraphNode] = []
    @Published var connections: [GraphConnection] = []
    
    init() {
        generateLargeDataset()
    }
    
    private func generateLargeDataset() {
        // Generate large dataset for testing
        items = (0..<10000).map { index in
            DataItem(
                title: "Item \(index)",
                subtitle: "Subtitle for item \(index)",
                imageURL: URL(string: "https://via.placeholder.com/40x40")
            )
        }
        
        // Generate graph nodes
        graphNodes = (0..<1000).map { index in
            PerformanceGraphNode(
                position: CGPoint(
                    x: Double.random(in: 0...2000),
                    y: Double.random(in: 0...2000)
                ),
                title: "Node \(index)",
                nodeType: [.primary, .secondary, .tertiary].randomElement() ?? .primary
            )
        }
        
        // Generate connections
        connections = (0..<500).compactMap { _ in
            guard let fromNode = graphNodes.randomElement(),
                  let toNode = graphNodes.randomElement(),
                  fromNode.id != toNode.id else {
                return nil
            }
            
            return GraphConnection(
                fromNodeId: fromNode.id,
                toNodeId: toNode.id,
                color: [.blue, .green, .orange, .purple].randomElement() ?? .gray
            )
        }
    }
}

#Preview {
    PerformanceOptimizedView()
        .frame(width: 800, height: 600)
}