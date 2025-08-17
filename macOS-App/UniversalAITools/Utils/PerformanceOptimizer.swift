import Foundation
import SwiftUI
import Combine

/// Performance optimization utilities for the Universal AI Tools app
class PerformanceOptimizer: ObservableObject {
    static let shared = PerformanceOptimizer()
    
    // MARK: - Caching System
    
    private let cache = NSCache<NSString, AnyObject>()
    private let imageCache = NSCache<NSString, NSImage>()
    private let dataCache = NSCache<NSString, CacheableData>()
    
    // MARK: - Performance Monitoring
    
    @Published private(set) var performanceMetrics = PerformanceMetrics()
    private var renderTimeTracker: [String: CFTimeInterval] = [:]
    
    private init() {
        setupCache()
        setupPerformanceMonitoring()
    }
    
    // MARK: - Cache Configuration
    
    private func setupCache() {
        // Configure main cache
        cache.countLimit = 100
        cache.totalCostLimit = 50 * 1024 * 1024 // 50MB
        
        // Configure image cache
        imageCache.countLimit = 50
        imageCache.totalCostLimit = 25 * 1024 * 1024 // 25MB
        
        // Configure data cache
        dataCache.countLimit = 200
        dataCache.totalCostLimit = 25 * 1024 * 1024 // 25MB
    }
    
    private func setupPerformanceMonitoring() {
        // Monitor memory usage
        Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            Task { @MainActor in
                self.updatePerformanceMetrics()
            }
        }
    }
    
    // MARK: - Generic Caching
    
    func cacheObject<T: AnyObject>(_ object: T, forKey key: String, cost: Int = 0) {
        cache.setObject(object, forKey: NSString(string: key), cost: cost)
    }
    
    func cachedObject<T: AnyObject>(forKey key: String, type: T.Type) -> T? {
        return cache.object(forKey: NSString(string: key)) as? T
    }
    
    func removeCachedObject(forKey key: String) {
        cache.removeObject(forKey: NSString(string: key))
    }
    
    // MARK: - Image Caching
    
    func cacheImage(_ image: NSImage, forKey key: String) {
        let cost = Int(image.size.width * image.size.height * 4) // Estimate 4 bytes per pixel
        imageCache.setObject(image, forKey: NSString(string: key), cost: cost)
    }
    
    func cachedImage(forKey key: String) -> NSImage? {
        return imageCache.object(forKey: NSString(string: key))
    }
    
    func removeImageFromCache(forKey key: String) {
        imageCache.removeObject(forKey: NSString(string: key))
    }
    
    // MARK: - Data Caching
    
    func cacheData<T: Codable>(_ data: T, forKey key: String, expirationTime: TimeInterval = 300) {
        let cacheableData = CacheableData(data: data, expirationTime: Date().addingTimeInterval(expirationTime))
        let cost = MemoryLayout<T>.size
        dataCache.setObject(cacheableData, forKey: NSString(string: key), cost: cost)
    }
    
    func cachedData<T: Codable>(forKey key: String, type: T.Type) -> T? {
        guard let cacheableData = dataCache.object(forKey: NSString(string: key)) else {
            return nil
        }
        
        // Check if data has expired
        if Date() > cacheableData.expirationTime {
            dataCache.removeObject(forKey: NSString(string: key))
            return nil
        }
        
        return cacheableData.data as? T
    }
    
    func removeDataFromCache(forKey key: String) {
        dataCache.removeObject(forKey: NSString(string: key))
    }
    
    // MARK: - Performance Tracking
    
    func startRenderTimeTracking(for identifier: String) {
        renderTimeTracker[identifier] = CACurrentMediaTime()
    }
    
    func endRenderTimeTracking(for identifier: String) {
        guard let startTime = renderTimeTracker[identifier] else { return }
        let renderTime = CACurrentMediaTime() - startTime
        renderTimeTracker.removeValue(forKey: identifier)
        
        // Update performance metrics
        performanceMetrics.addRenderTime(renderTime, for: identifier)
    }
    
    // MARK: - Memory Management
    
    func clearAllCaches() {
        cache.removeAllObjects()
        imageCache.removeAllObjects()
        dataCache.removeAllObjects()
    }
    
    func clearExpiredData() {
        // This is automatically handled by the cache access methods
        // But we can force a cleanup here if needed
        let allKeys = dataCache.allKeys
        for key in allKeys {
            _ = cachedData(forKey: key.description, type: AnyObject.self)
        }
    }
    
    // MARK: - Performance Metrics
    
    private func updatePerformanceMetrics() {
        let memoryInfo = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let result: kern_return_t = withUnsafeMutablePointer(to: &memoryInfo) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }
        
        if result == KERN_SUCCESS {
            let memoryUsage = Double(memoryInfo.resident_size) / 1024.0 / 1024.0 // Convert to MB
            performanceMetrics.updateMemoryUsage(memoryUsage)
        }
        
        // Update cache statistics
        performanceMetrics.updateCacheStats(
            mainCacheCount: cache.totalCostLimit > 0 ? cache.totalCost : 0,
            imageCacheCount: imageCache.totalCostLimit > 0 ? imageCache.totalCost : 0,
            dataCacheCount: dataCache.totalCostLimit > 0 ? dataCache.totalCost : 0
        )
    }
}

// MARK: - Supporting Types

class CacheableData: NSObject {
    let data: Any
    let expirationTime: Date
    
    init(data: Any, expirationTime: Date) {
        self.data = data
        self.expirationTime = expirationTime
        super.init()
    }
}

struct PerformanceMetrics {
    private(set) var memoryUsage: Double = 0.0
    private(set) var renderTimes: [String: [CFTimeInterval]] = [:]
    private(set) var averageRenderTime: CFTimeInterval = 0.0
    private(set) var cacheHitRate: Double = 0.0
    
    // Cache statistics
    private(set) var mainCacheSize: Int = 0
    private(set) var imageCacheSize: Int = 0
    private(set) var dataCacheSize: Int = 0
    
    mutating func updateMemoryUsage(_ usage: Double) {
        memoryUsage = usage
    }
    
    mutating func addRenderTime(_ time: CFTimeInterval, for identifier: String) {
        if renderTimes[identifier] == nil {
            renderTimes[identifier] = []
        }
        renderTimes[identifier]?.append(time)
        
        // Keep only last 10 render times per identifier
        if let times = renderTimes[identifier], times.count > 10 {
            renderTimes[identifier] = Array(times.suffix(10))
        }
        
        // Update average
        updateAverageRenderTime()
    }
    
    private mutating func updateAverageRenderTime() {
        let allTimes = renderTimes.values.flatMap { $0 }
        averageRenderTime = allTimes.isEmpty ? 0.0 : allTimes.reduce(0, +) / Double(allTimes.count)
    }
    
    mutating func updateCacheStats(mainCacheCount: Int, imageCacheCount: Int, dataCacheCount: Int) {
        mainCacheSize = mainCacheCount
        imageCacheSize = imageCacheCount
        dataCacheSize = dataCacheCount
    }
}

// MARK: - Lazy Loading Utilities

/// Lazy loading container for expensive operations
class LazyLoader<T>: ObservableObject {
    @Published private(set) var value: T?
    @Published private(set) var isLoading = false
    @Published private(set) var error: Error?
    
    private let loader: () async throws -> T
    private var loadTask: Task<Void, Never>?
    
    init(loader: @escaping () async throws -> T) {
        self.loader = loader
    }
    
    @MainActor
    func load() {
        guard !isLoading && value == nil else { return }
        
        isLoading = true
        error = nil
        
        loadTask = Task {
            do {
                let result = try await loader()
                await MainActor.run {
                    self.value = result
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    self.isLoading = false
                }
            }
        }
    }
    
    @MainActor
    func reset() {
        loadTask?.cancel()
        value = nil
        isLoading = false
        error = nil
    }
}

// MARK: - View Modifiers for Performance

extension View {
    /// Tracks render time for performance monitoring
    func trackRenderTime(identifier: String) -> some View {
        self.onAppear {
            PerformanceOptimizer.shared.startRenderTimeTracking(for: identifier)
        }
        .onDisappear {
            PerformanceOptimizer.shared.endRenderTimeTracking(for: identifier)
        }
    }
    
    /// Enables view caching for expensive views
    func cached(key: String) -> some View {
        self.drawingGroup() // Cache the view rendering
    }
    
    /// Lazy loading for heavy content
    func lazyLoaded<Content: View>(
        threshold: CGFloat = 50,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        LazyLoadingView(threshold: threshold, content: content) {
            self
        }
    }
}

// MARK: - Lazy Loading View

struct LazyLoadingView<Content: View, Placeholder: View>: View {
    let threshold: CGFloat
    let content: () -> Content
    let placeholder: () -> Placeholder
    
    @State private var isVisible = false
    @State private var contentLoaded = false
    
    var body: some View {
        GeometryReader { geometry in
            if contentLoaded {
                content()
                    .transition(.opacity.combined(with: .scale))
            } else {
                placeholder()
                    .onAppear {
                        // Check if view is within threshold of being visible
                        if geometry.frame(in: .global).minY < UIScreen.main.bounds.height + threshold {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                contentLoaded = true
                            }
                        }
                    }
            }
        }
    }
}

// MARK: - Performance Monitoring View

struct PerformanceMonitorView: View {
    @ObservedObject private var optimizer = PerformanceOptimizer.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Performance Metrics")
                .font(.headline)
                .fontWeight(.semibold)
            
            Group {
                HStack {
                    Text("Memory Usage:")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(optimizer.performanceMetrics.memoryUsage, specifier: "%.1f") MB")
                        .fontWeight(.medium)
                        .foregroundColor(memoryColor)
                }
                
                HStack {
                    Text("Average Render Time:")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(optimizer.performanceMetrics.averageRenderTime * 1000, specifier: "%.1f") ms")
                        .fontWeight(.medium)
                        .foregroundColor(renderTimeColor)
                }
                
                HStack {
                    Text("Cache Usage:")
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(totalCacheSize, specifier: "%.1f") MB")
                        .fontWeight(.medium)
                }
            }
            .font(.caption)
            
            // Clear cache button
            Button("Clear Caches") {
                optimizer.clearAllCaches()
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var memoryColor: Color {
        if optimizer.performanceMetrics.memoryUsage > 500 {
            return .red
        } else if optimizer.performanceMetrics.memoryUsage > 250 {
            return .orange
        } else {
            return .green
        }
    }
    
    private var renderTimeColor: Color {
        let renderTimeMs = optimizer.performanceMetrics.averageRenderTime * 1000
        if renderTimeMs > 16.67 { // 60fps threshold
            return .red
        } else if renderTimeMs > 8.33 { // 120fps threshold
            return .orange
        } else {
            return .green
        }
    }
    
    private var totalCacheSize: Double {
        let mainSize = Double(optimizer.performanceMetrics.mainCacheSize) / 1024.0 / 1024.0
        let imageSize = Double(optimizer.performanceMetrics.imageCacheSize) / 1024.0 / 1024.0
        let dataSize = Double(optimizer.performanceMetrics.dataCacheSize) / 1024.0 / 1024.0
        return mainSize + imageSize + dataSize
    }
}

#Preview {
    PerformanceMonitorView()
        .frame(width: 300, height: 200)
}