import Foundation
import SwiftUI
import Combine
import OSLog

/// Advanced Performance Optimization Service
/// Implements aggressive caching, lazy loading, and performance monitoring for Universal AI Tools
@MainActor
@Observable
class PerformanceOptimizationService {
    
    // MARK: - Singleton
    static let shared = PerformanceOptimizationService()
    
    // MARK: - Published Properties
    var isOptimizationEnabled: Bool = true
    var currentMemoryUsage: Double = 0.0
    var cacheHitRate: Double = 0.0
    var averageResponseTime: Double = 0.0
    var performanceMetrics: PerformanceMetrics = PerformanceMetrics()
    
    // MARK: - Private Properties
    private let logger = Logger(subsystem: "com.universalaitools.app", category: "Performance")
    private let memoryCache = NSCache<NSString, CacheItem>()
    private let diskCache = DiskCache()
    private let imageCache = ImageCache()
    private let dataLoader = OptimizedDataLoader()
    
    // Performance monitoring
    private var metricsTimer: Timer?
    private var performanceAnalyzer = PerformanceAnalyzer()
    private let cancellables = Set<AnyCancellable>()
    
    // Caching strategies
    private let cacheStrategies: [CacheStrategy] = [
        .memoryFirst,
        .diskFallback,
        .networkLast,
        .preemptiveLoading,
        .timeBasedEviction
    ]
    
    private init() {
        setupPerformanceMonitoring()
        configureCaching()
        setupMemoryPressureHandling()
    }
    
    // MARK: - Public API
    
    /// Optimize view loading with lazy initialization
    func optimizeViewLoading<T: View>(_ viewBuilder: @escaping () -> T) -> some View {
        LazyOptimizedView(
            optimizationService: self,
            viewBuilder: viewBuilder
        )
    }
    
    /// Cache data with intelligent eviction
    func cacheData<T: Codable>(_ data: T, forKey key: String, strategy: CacheStrategy = .memoryFirst) async {
        let cacheItem = CacheItem(
            data: try? JSONEncoder().encode(data),
            timestamp: Date(),
            strategy: strategy,
            accessCount: 0
        )
        
        switch strategy {
        case .memoryFirst:
            memoryCache.setObject(cacheItem, forKey: NSString(string: key))
            
        case .diskFallback:
            await diskCache.store(cacheItem, forKey: key)
            
        case .preemptiveLoading:
            memoryCache.setObject(cacheItem, forKey: NSString(string: key))
            await diskCache.store(cacheItem, forKey: key)
            
        default:
            memoryCache.setObject(cacheItem, forKey: NSString(string: key))
        }
        
        updateCacheMetrics()
    }
    
    /// Retrieve cached data with fallback strategy
    func getCachedData<T: Codable>(_ type: T.Type, forKey key: String) async -> T? {
        // Try memory cache first
        if let cacheItem = memoryCache.object(forKey: NSString(string: key)),
           let data = cacheItem.data {
            
            // Update access metrics
            cacheItem.accessCount += 1
            cacheItem.lastAccess = Date()
            
            performanceMetrics.cacheHits += 1
            updateCacheMetrics()
            
            return try? JSONDecoder().decode(type, from: data)
        }
        
        // Fallback to disk cache
        if let cacheItem = await diskCache.retrieve(forKey: key),
           let data = cacheItem.data {
            
            // Promote to memory cache
            memoryCache.setObject(cacheItem, forKey: NSString(string: key))
            
            performanceMetrics.cacheHits += 1
            updateCacheMetrics()
            
            return try? JSONDecoder().decode(type, from: data)
        }
        
        performanceMetrics.cacheMisses += 1
        updateCacheMetrics()
        
        return nil
    }
    
    /// Load data with optimized networking
    func loadData<T: Codable>(
        from url: URL,
        type: T.Type,
        cacheKey: String? = nil,
        priority: LoadPriority = .normal
    ) async throws -> T {
        let key = cacheKey ?? url.absoluteString
        
        // Check cache first
        if let cachedData = await getCachedData(type, forKey: key) {
            logger.info("Data loaded from cache for key: \(key)")
            return cachedData
        }
        
        // Load from network with optimization
        let startTime = Date()
        let data = try await dataLoader.loadData(from: url, priority: priority)
        let loadTime = Date().timeIntervalSince(startTime)
        
        // Update performance metrics
        performanceMetrics.networkRequests += 1
        performanceMetrics.totalLoadTime += loadTime
        performanceMetrics.averageLoadTime = performanceMetrics.totalLoadTime / Double(performanceMetrics.networkRequests)
        
        // Decode and cache
        let decodedData = try JSONDecoder().decode(type, from: data)
        await cacheData(decodedData, forKey: key)
        
        logger.info("Data loaded from network in \(String(format: "%.2f", loadTime))s for: \(url)")
        
        return decodedData
    }
    
    /// Preload data for anticipated use
    func preloadData<T: Codable>(
        from urls: [URL],
        type: T.Type,
        priority: LoadPriority = .low
    ) async {
        await withTaskGroup(of: Void.self) { group in
            for url in urls {
                group.addTask {
                    do {
                        _ = try await self.loadData(from: url, type: type, priority: priority)
                    } catch {
                        self.logger.error("Failed to preload data from \(url): \(error)")
                    }
                }
            }
        }
    }
    
    /// Optimize image loading with caching
    func loadImage(from url: URL, size: CGSize? = nil) async -> NSImage? {
        return await imageCache.loadImage(from: url, size: size)
    }
    
    /// Clear caches to free memory
    func clearCaches(type: CacheType = .all) {
        switch type {
        case .memory:
            memoryCache.removeAllObjects()
            
        case .disk:
            Task {
                await diskCache.clearAll()
            }
            
        case .images:
            imageCache.clearCache()
            
        case .all:
            memoryCache.removeAllObjects()
            imageCache.clearCache()
            Task {
                await diskCache.clearAll()
            }
        }
        
        updateCacheMetrics()
        logger.info("Cleared caches: \(type)")
    }
    
    /// Get performance recommendations
    func getPerformanceRecommendations() -> [PerformanceRecommendation] {
        return performanceAnalyzer.analyzePerformance(metrics: performanceMetrics)
    }
    
    // MARK: - Private Methods
    
    private func setupPerformanceMonitoring() {
        // Configure memory cache
        memoryCache.countLimit = 100
        memoryCache.totalCostLimit = 50 * 1024 * 1024 // 50MB
        
        // Start metrics collection
        metricsTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            Task { @MainActor in
                self.updatePerformanceMetrics()
            }
        }
    }
    
    private func configureCaching() {
        // Configure disk cache
        diskCache.configure(
            maxSize: 100 * 1024 * 1024, // 100MB
            maxAge: 24 * 60 * 60 // 24 hours
        )
        
        // Configure image cache
        imageCache.configure(
            maxMemorySize: 25 * 1024 * 1024, // 25MB
            maxDiskSize: 50 * 1024 * 1024 // 50MB
        )
    }
    
    private func setupMemoryPressureHandling() {
        NotificationCenter.default.addObserver(
            forName: NSApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { _ in
            self.handleMemoryPressure()
        }
    }
    
    private func handleMemoryPressure() {
        logger.warning("Memory pressure detected, clearing caches")
        
        // Clear memory caches aggressively
        memoryCache.removeAllObjects()
        imageCache.clearMemoryCache()
        
        // Force garbage collection
        performanceMetrics.memoryPressureEvents += 1
    }
    
    private func updatePerformanceMetrics() {
        // Update memory usage
        let memInfo = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let result = withUnsafeMutablePointer(to: &memInfo) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if result == KERN_SUCCESS {
            currentMemoryUsage = Double(memInfo.resident_size) / (1024 * 1024) // MB
            performanceMetrics.peakMemoryUsage = max(performanceMetrics.peakMemoryUsage, currentMemoryUsage)
        }
        
        updateCacheMetrics()
    }
    
    private func updateCacheMetrics() {
        let totalRequests = performanceMetrics.cacheHits + performanceMetrics.cacheMisses
        cacheHitRate = totalRequests > 0 ? Double(performanceMetrics.cacheHits) / Double(totalRequests) : 0.0
        averageResponseTime = performanceMetrics.averageLoadTime
    }
}

// MARK: - Supporting Types

enum CacheStrategy {
    case memoryFirst
    case diskFallback
    case networkLast
    case preemptiveLoading
    case timeBasedEviction
}

enum CacheType {
    case memory, disk, images, all
}

enum LoadPriority {
    case low, normal, high, critical
    
    var qualityOfService: QualityOfService {
        switch self {
        case .low: return .background
        case .normal: return .default
        case .high: return .userInitiated
        case .critical: return .userInteractive
        }
    }
}

class CacheItem: NSObject {
    let data: Data?
    let timestamp: Date
    let strategy: CacheStrategy
    var accessCount: Int
    var lastAccess: Date
    
    init(data: Data?, timestamp: Date, strategy: CacheStrategy, accessCount: Int) {
        self.data = data
        self.timestamp = timestamp
        self.strategy = strategy
        self.accessCount = accessCount
        self.lastAccess = timestamp
    }
}

@Observable
class PerformanceMetrics {
    var cacheHits: Int = 0
    var cacheMisses: Int = 0
    var networkRequests: Int = 0
    var totalLoadTime: TimeInterval = 0
    var averageLoadTime: TimeInterval = 0
    var peakMemoryUsage: Double = 0
    var memoryPressureEvents: Int = 0
    var viewRenderTime: TimeInterval = 0
    var backgroundTasksCompleted: Int = 0
}

struct PerformanceRecommendation: Identifiable {
    let id = UUID()
    let title: String
    let description: String
    let impact: Impact
    let action: RecommendationAction
    
    enum Impact {
        case low, medium, high, critical
        
        var color: Color {
            switch self {
            case .low: return .green
            case .medium: return .yellow
            case .high: return .orange
            case .critical: return .red
            }
        }
    }
    
    enum RecommendationAction {
        case clearCache
        case enableLazyLoading
        case reduceImageQuality
        case limitConcurrentRequests
        case preloadCriticalData
    }
}

// MARK: - Disk Cache Implementation

actor DiskCache {
    private var cacheDirectory: URL
    private var maxSize: Int = 100 * 1024 * 1024 // 100MB
    private var maxAge: TimeInterval = 24 * 60 * 60 // 24 hours
    
    init() {
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        self.cacheDirectory = cacheDir.appendingPathComponent("UniversalAITools")
        
        // Create cache directory if needed
        try? FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }
    
    func configure(maxSize: Int, maxAge: TimeInterval) {
        self.maxSize = maxSize
        self.maxAge = maxAge
    }
    
    func store(_ item: CacheItem, forKey key: String) async {
        let url = cacheDirectory.appendingPathComponent(key.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? key)
        
        do {
            let data = try JSONEncoder().encode(CacheEntry(item: item))
            try data.write(to: url)
        } catch {
            print("Failed to store cache item: \(error)")
        }
        
        await cleanupIfNeeded()
    }
    
    func retrieve(forKey key: String) async -> CacheItem? {
        let url = cacheDirectory.appendingPathComponent(key.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? key)
        
        do {
            let data = try Data(contentsOf: url)
            let entry = try JSONDecoder().decode(CacheEntry.self, from: data)
            
            // Check if item is expired
            if Date().timeIntervalSince(entry.item.timestamp) > maxAge {
                try? FileManager.default.removeItem(at: url)
                return nil
            }
            
            return entry.item
        } catch {
            return nil
        }
    }
    
    func clearAll() async {
        do {
            let files = try FileManager.default.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil)
            for file in files {
                try? FileManager.default.removeItem(at: file)
            }
        } catch {
            print("Failed to clear disk cache: \(error)")
        }
    }
    
    private func cleanupIfNeeded() async {
        do {
            let files = try FileManager.default.contentsOfDirectory(
                at: cacheDirectory,
                includingPropertiesForKeys: [.fileSizeKey, .creationDateKey]
            )
            
            var totalSize = 0
            var fileInfos: [(URL, Int, Date)] = []
            
            for file in files {
                let resources = try file.resourceValues(forKeys: [.fileSizeKey, .creationDateKey])
                let size = resources.fileSize ?? 0
                let date = resources.creationDate ?? Date.distantPast
                
                totalSize += size
                fileInfos.append((file, size, date))
            }
            
            // Remove files if over size limit
            if totalSize > maxSize {
                // Sort by creation date (oldest first)
                fileInfos.sort { $0.2 < $1.2 }
                
                var currentSize = totalSize
                for (file, size, _) in fileInfos {
                    if currentSize <= maxSize / 2 { break } // Remove until we're at 50% of limit
                    
                    try? FileManager.default.removeItem(at: file)
                    currentSize -= size
                }
            }
        } catch {
            print("Failed to cleanup disk cache: \(error)")
        }
    }
}

private struct CacheEntry: Codable {
    let item: CacheItem
}

extension CacheItem: Codable {
    enum CodingKeys: String, CodingKey {
        case data, timestamp, strategy, accessCount, lastAccess
    }
    
    convenience init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let data = try container.decodeIfPresent(Data.self, forKey: .data)
        let timestamp = try container.decode(Date.self, forKey: .timestamp)
        let strategy = try container.decode(CacheStrategy.self, forKey: .strategy)
        let accessCount = try container.decode(Int.self, forKey: .accessCount)
        
        self.init(data: data, timestamp: timestamp, strategy: strategy, accessCount: accessCount)
        
        self.lastAccess = try container.decode(Date.self, forKey: .lastAccess)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(data, forKey: .data)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encode(strategy, forKey: .strategy)
        try container.encode(accessCount, forKey: .accessCount)
        try container.encode(lastAccess, forKey: .lastAccess)
    }
}

extension CacheStrategy: Codable {}

// MARK: - Image Cache Implementation

@MainActor
class ImageCache: ObservableObject {
    private let memoryCache = NSCache<NSString, NSImage>()
    private let diskCache = NSCache<NSString, URL>()
    private var loadingTasks: [String: Task<NSImage?, Never>] = [:]
    
    func configure(maxMemorySize: Int, maxDiskSize: Int) {
        memoryCache.totalCostLimit = maxMemorySize
    }
    
    func loadImage(from url: URL, size: CGSize? = nil) async -> NSImage? {
        let cacheKey = cacheKey(for: url, size: size)
        
        // Check memory cache
        if let cachedImage = memoryCache.object(forKey: NSString(string: cacheKey)) {
            return cachedImage
        }
        
        // Check if already loading
        if let existingTask = loadingTasks[cacheKey] {
            return await existingTask.value
        }
        
        // Start loading task
        let task = Task<NSImage?, Never> {
            do {
                let (data, _) = try await URLSession.shared.data(from: url)
                guard let image = NSImage(data: data) else { return nil }
                
                let processedImage = size != nil ? resizeImage(image, to: size!) : image
                
                // Cache the image
                await MainActor.run {
                    self.memoryCache.setObject(processedImage, forKey: NSString(string: cacheKey))
                    self.loadingTasks.removeValue(forKey: cacheKey)
                }
                
                return processedImage
            } catch {
                await MainActor.run {
                    self.loadingTasks.removeValue(forKey: cacheKey)
                }
                return nil
            }
        }
        
        loadingTasks[cacheKey] = task
        return await task.value
    }
    
    func clearCache() {
        memoryCache.removeAllObjects()
        loadingTasks.removeAll()
    }
    
    func clearMemoryCache() {
        memoryCache.removeAllObjects()
    }
    
    private func cacheKey(for url: URL, size: CGSize?) -> String {
        var key = url.absoluteString
        if let size = size {
            key += "_\(Int(size.width))x\(Int(size.height))"
        }
        return key
    }
    
    private func resizeImage(_ image: NSImage, to size: CGSize) -> NSImage {
        let resizedImage = NSImage(size: size)
        resizedImage.lockFocus()
        image.draw(in: NSRect(origin: .zero, size: size))
        resizedImage.unlockFocus()
        return resizedImage
    }
}

// MARK: - Optimized Data Loader

actor OptimizedDataLoader {
    private let session: URLSession
    private var activeTasks: [URL: Task<Data, Error>] = [:]
    
    init() {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 10 * 1024 * 1024, diskCapacity: 50 * 1024 * 1024)
        config.requestCachePolicy = .returnCacheDataElseLoad
        self.session = URLSession(configuration: config)
    }
    
    func loadData(from url: URL, priority: LoadPriority = .normal) async throws -> Data {
        // Check if already loading
        if let existingTask = activeTasks[url] {
            return try await existingTask.value
        }
        
        // Create new loading task
        let task = Task<Data, Error> {
            defer { activeTasks.removeValue(forKey: url) }
            
            var request = URLRequest(url: url)
            request.cachePolicy = .returnCacheDataElseLoad
            
            let (data, _) = try await session.data(for: request)
            return data
        }
        
        activeTasks[url] = task
        return try await task.value
    }
}

// MARK: - Performance Analyzer

class PerformanceAnalyzer {
    func analyzePerformance(metrics: PerformanceMetrics) -> [PerformanceRecommendation] {
        var recommendations: [PerformanceRecommendation] = []
        
        // Analyze cache hit rate
        let totalRequests = metrics.cacheHits + metrics.cacheMisses
        let hitRate = totalRequests > 0 ? Double(metrics.cacheHits) / Double(totalRequests) : 0
        
        if hitRate < 0.7 {
            recommendations.append(PerformanceRecommendation(
                title: "Low Cache Hit Rate",
                description: "Cache hit rate is \(Int(hitRate * 100))%. Consider preloading frequently accessed data.",
                impact: hitRate < 0.5 ? .high : .medium,
                action: .preloadCriticalData
            ))
        }
        
        // Analyze memory usage
        if metrics.peakMemoryUsage > 500 { // MB
            recommendations.append(PerformanceRecommendation(
                title: "High Memory Usage",
                description: "Peak memory usage is \(Int(metrics.peakMemoryUsage))MB. Consider clearing caches.",
                impact: metrics.peakMemoryUsage > 1000 ? .critical : .high,
                action: .clearCache
            ))
        }
        
        // Analyze load times
        if metrics.averageLoadTime > 2.0 {
            recommendations.append(PerformanceRecommendation(
                title: "Slow Load Times",
                description: "Average load time is \(String(format: "%.1f", metrics.averageLoadTime))s. Consider optimizing network requests.",
                impact: metrics.averageLoadTime > 5.0 ? .high : .medium,
                action: .limitConcurrentRequests
            ))
        }
        
        return recommendations
    }
}

// MARK: - Lazy Optimized View

struct LazyOptimizedView<Content: View>: View {
    let optimizationService: PerformanceOptimizationService
    let viewBuilder: () -> Content
    
    @State private var isLoaded = false
    @State private var loadingTask: Task<Void, Never>?
    
    var body: some View {
        Group {
            if isLoaded {
                viewBuilder()
            } else {
                ProgressView()
                    .frame(minHeight: 100)
            }
        }
        .onAppear {
            if !isLoaded {
                loadingTask = Task {
                    // Simulate lazy loading with slight delay
                    try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
                    
                    await MainActor.run {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            isLoaded = true
                        }
                    }
                }
            }
        }
        .onDisappear {
            loadingTask?.cancel()
        }
    }
}