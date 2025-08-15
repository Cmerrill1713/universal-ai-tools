import Foundation
import SwiftUI
import Combine
import Network

/// **Performance Metrics Service**
/// 
/// Comprehensive service for collecting, processing, and providing flash attention
/// and performance analytics data. Handles real-time data streaming, historical
/// data aggregation, and optimization suggestions.

@MainActor
class PerformanceMetricsService: ObservableObject {
    // MARK: - Published Properties
    
    // Connection State
    @Published var isConnected = false
    @Published var isLoading = false
    @Published var isLoadingAttentionData = false
    @Published var isLoadingPerformanceData = false
    @Published var isLoadingMemoryData = false
    @Published var lastUpdate: Date?
    @Published var lastUpdateTime: Date?
    
    // Live Data Indicators
    @Published var hasLiveOverviewData = false
    @Published var hasLiveAttentionData = false
    @Published var hasLiveTokenData = false
    @Published var hasLivePerformanceData = false
    @Published var hasLiveMemoryData = false
    @Published var hasAdvancedAnalytics = false
    
    // Current Metrics
    @Published var currentMetrics = FlashAttentionMetrics()
    @Published var totalDataPoints = 0
    @Published var latestTokenSequence: String?
    
    // Memory Management
    @Published var isRunningLeakDetection = false
    @Published var currentMemoryUsage: Int64 = 0
    @Published var totalMemoryUsage: Int64 = 0
    @Published var availableMemory: Int64 = 0
    @Published var memoryPressureLevel: MemoryPressureLevel = .normal
    @Published var flashAttentionSavings: Double = 0.0
    
    // Performance Indicators
    @Published var averageProcessingTime: Double = 0.0
    @Published var currentThroughput = 0
    @Published var activeProcessingCount = 0
    @Published var queuedTokenCount = 0
    @Published var completedTokenCount = 0
    
    // Health Status
    @Published var flashAttentionHealth: HealthStatus = .good
    @Published var memoryOptimizationHealth: HealthStatus = .good
    @Published var tokenProcessingHealth: HealthStatus = .good
    @Published var modelPerformanceHealth: HealthStatus = .good
    
    // Trends
    @Published var attentionEfficiencyTrend: TrendDirection = .stable
    @Published var memoryUsageTrend: TrendDirection = .stable
    @Published var throughputTrend: TrendDirection = .stable
    @Published var cacheHitRateTrend: TrendDirection = .stable
    @Published var cacheEvictionsTrend: TrendDirection = .stable
    @Published var cacheSizeTrend: TrendDirection = .stable
    @Published var memoryEfficiencyTrend: TrendDirection = .stable
    @Published var allocationEfficiencyTrend: TrendDirection = .stable
    @Published var cacheEfficiencyTrend: TrendDirection = .stable
    @Published var flashAttentionSavingsTrend: TrendDirection = .stable
    
    // Memory Properties
    @Published var memoryUsagePercentage: Double = 0.0
    @Published var cpuStatus: ResourceStatus = .normal
    @Published var memoryStatus: ResourceStatus = .normal
    @Published var diskIOStatus: ResourceStatus = .normal
    @Published var networkIOStatus: ResourceStatus = .normal
    @Published var gpuStatus: ResourceStatus = .normal
    @Published var temperatureStatus: ResourceStatus = .normal
    @Published var currentCPUUsage: Double = 0.0
    @Published var diskIORate: Int64 = 0
    @Published var networkIORate: Int64 = 0
    @Published var gpuUsage: Double = 0.0
    @Published var systemTemperature: Double = 0.0
    @Published var overallCacheHitRate: Double = 0.0
    @Published var cacheEvictions = 0
    @Published var totalCacheSize: Int64 = 0
    @Published var memoryEfficiency: Double = 0.0
    @Published var allocationEfficiency: Double = 0.0
    @Published var cacheEfficiency: Double = 0.0
    
    // Computed Properties for Memory
    var totalMemorySaved: Int64 {
        Int64(Double(totalMemoryUsage) * flashAttentionSavings)
    }
    
    var memorySavingsPercentage: Double {
        flashAttentionSavings * 100
    }
    
    var speedImprovement: Double {
        1.0 + (flashAttentionSavings * 2.0) // Simplified calculation
    }
    
    var speedImprovementPercentage: Double {
        speedImprovement * 100 - 100
    }
    
    var attentionEfficiency: Double {
        currentMetrics.attentionEfficiency
    }
    
    var attentionEfficiencyImprovement: Double {
        (attentionEfficiency - 0.7) * 100 // Assuming 0.7 as baseline
    }
    
    var powerSavings: Double {
        Double(totalMemorySaved) / (1024 * 1024 * 1024) * 2.5 // Rough estimation
    }
    
    var powerSavingsPercentage: Double {
        flashAttentionSavings * 30 // Simplified calculation
    }
    
    // MARK: - Private Properties
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var session = URLSession.shared
    private var cancellables = Set<AnyCancellable>()
    private let apiService = APIService.shared
    
    // Data Storage
    private var attentionHistory: [FlashAttentionPoint] = []
    private var memoryHistory: [MemoryUsagePoint] = []
    private var availableLayers: [Int] = Array(0..<12) // Default 12 layers
    private var availableModels: [ModelInfo] = []
    private var recentOptimizations: [OptimizationSuggestion] = []
    private var identifiedBottlenecks: [ProcessingBottleneck] = []
    
    // MARK: - Initialization
    
    init() {
        setupDefaultData()
        setupNetworkMonitoring()
        
        // Start periodic updates
        Timer.publish(every: 2.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task { await self?.updateLiveMetrics() }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Public Methods
    
    func initialize() async {
        isLoading = true
        
        // Load initial data
        await loadInitialMetrics()
        await loadAvailableModels()
        await generateSampleOptimizations()
        
        isLoading = false
        lastUpdate = Date()
    }
    
    func connectToRealTimeStream() async {
        guard let url = URL(string: "ws://localhost:9998/api/realtime/flash-attention") else {
            return
        }
        
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        
        isConnected = true
        receiveWebSocketMessage()
    }
    
    func refreshData() async {
        await updateLiveMetrics()
        await generateNewDataPoints()
        lastUpdate = Date()
    }
    
    func loadMetrics(for timeRange: TimeRange) async {
        isLoading = true
        
        // Simulate loading metrics for time range
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        
        // Generate data based on time range
        await generateHistoricalData(for: timeRange)
        
        isLoading = false
    }
    
    // MARK: - Attention Heatmap Methods
    
    func loadAttentionData(layer: Int, head: Int) async {
        isLoadingAttentionData = true
        
        // Simulate loading attention data
        try? await Task.sleep(nanoseconds: 300_000_000) // 0.3 seconds
        
        hasLiveAttentionData = true
        isLoadingAttentionData = false
    }
    
    func refreshAttentionData() async {
        await loadAttentionData(layer: 0, head: 0)
    }
    
    func getAttentionWeights(layer: Int, head: Int) -> [[Double]] {
        // Generate sample attention weights matrix
        let size = 64 // Token sequence length
        var weights: [[Double]] = []
        
        for i in 0..<size {
            var row: [Double] = []
            for j in 0..<size {
                // Create realistic attention patterns
                let distance = abs(i - j)
                let baseAttention = exp(-Double(distance) / 10.0)
                let noise = Double.random(in: 0.8...1.2)
                let attention = baseAttention * noise
                row.append(min(1.0, attention))
            }
            weights.append(row)
        }
        
        return weights
    }
    
    func getCurrentTokens() -> [String] {
        // Generate sample tokens
        let sampleTokens = [
            "The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog",
            "in", "a", "spectacular", "display", "of", "agility", "and", "grace",
            "while", "demonstrating", "advanced", "natural", "language", "processing",
            "capabilities", "through", "sophisticated", "attention", "mechanisms"
        ]
        
        return Array(sampleTokens.prefix(min(64, sampleTokens.count)))
    }
    
    func getHeadCount(for layer: Int) -> Int {
        return 12 // Standard transformer head count
    }
    
    // MARK: - Token Processing Methods
    
    func loadTokenProcessingData(timeRange: WaterfallTimeRange) async {
        isLoading = true
        
        // Simulate loading
        try? await Task.sleep(nanoseconds: 400_000_000) // 0.4 seconds
        
        hasLiveTokenData = true
        isLoading = false
    }
    
    func refreshTokenProcessingData() async {
        await updateProcessingMetrics()
    }
    
    func getTokenProcessingData(for timeRange: WaterfallTimeRange) -> [TokenProcessingSequence] {
        // Generate sample token processing sequences
        var sequences: [TokenProcessingSequence] = []
        let count = min(timeRange.tokenCount, 50) // Limit for performance
        
        for i in 0..<count {
            let sequence = TokenProcessingSequence(
                id: "seq_\(i)",
                stages: generateProcessingStages()
            )
            sequences.append(sequence)
        }
        
        return sequences
    }
    
    // MARK: - Model Performance Methods
    
    func loadModelPerformanceData(timeRange: ChartTimeRange) async {
        isLoadingPerformanceData = true
        
        // Simulate loading
        try? await Task.sleep(nanoseconds: 600_000_000) // 0.6 seconds
        
        hasLivePerformanceData = true
        isLoadingPerformanceData = false
        totalDataPoints = Int.random(in: 1000...5000)
    }
    
    func loadModelPerformanceData(models: [String]) async {
        // Load data for specific models
        await loadModelPerformanceData(timeRange: .last24Hours)
    }
    
    func refreshModelPerformanceData() async {
        await updatePerformanceMetrics()
    }
    
    func getModelPerformanceData(models: [String], metric: PerformanceMetric, timeRange: ChartTimeRange) -> [ModelPerformanceData] {
        return models.compactMap { modelId in
            guard let modelInfo = getModelInfo(modelId) else { return nil }
            
            return ModelPerformanceData(
                modelId: modelId,
                modelName: modelInfo.name,
                color: modelInfo.color,
                dataPoints: generatePerformanceDataPoints(for: metric, timeRange: timeRange),
                predictions: generatePredictionPoints(),
                averageValue: Double.random(in: 50...100)
            )
        }
    }
    
    func getCurrentMetricValue(_ metric: PerformanceMetric, models: [String]) -> Double {
        switch metric {
        case .throughput: return Double.random(in: 80...120)
        case .latency: return Double.random(in: 10...50)
        case .memoryUsage: return Double.random(in: 2...8)
        case .efficiency: return Double.random(in: 0.7...0.95)
        case .accuracy: return Double.random(in: 0.85...0.98)
        case .powerConsumption: return Double.random(in: 150...300)
        }
    }
    
    func getAverageMetricValue(_ metric: PerformanceMetric, models: [String]) -> Double {
        return getCurrentMetricValue(metric, models: models) * 0.9
    }
    
    func getMetricTrend(_ metric: PerformanceMetric, models: [String]) -> TrendDirection {
        let trends: [TrendDirection] = [.up(2.5), .down(1.8), .stable, .up(0.5)]
        return trends.randomElement() ?? .stable
    }
    
    func getModelInfo(_ modelId: String) -> ModelInfo? {
        return availableModels.first { $0.id == modelId }
    }
    
    func getModelRank(_ modelId: String, metric: PerformanceMetric) -> Int {
        return Int.random(in: 1...5)
    }
    
    func getRankedModels(_ models: [String], metric: PerformanceMetric) -> [(String, Int)] {
        return models.enumerated().map { ($0.element, $0.offset + 1) }
    }
    
    func getPerformanceGap(_ models: [String], metric: PerformanceMetric) -> PerformanceGap? {
        guard models.count > 1 else { return nil }
        
        return PerformanceGap(
            percentage: Double.random(in: 5...25),
            isSignificant: Bool.random(),
            recommendation: "Consider optimizing the lower-performing models or adjusting resource allocation."
        )
    }
    
    func getPerformanceInsights(for dataPoint: ModelDataPoint) -> [PerformanceInsight] {
        return [
            PerformanceInsight(
                id: "insight_1",
                type: .optimization,
                title: "Memory Usage Spike",
                description: "Detected increased memory usage during this period"
            ),
            PerformanceInsight(
                id: "insight_2",
                type: .warning,
                title: "Throughput Variation",
                description: "Throughput shows higher than normal variation"
            )
        ]
    }
    
    // MARK: - Memory Optimization Methods
    
    func loadMemoryOptimizationData(timeRange: MemoryTimeRange) async {
        isLoadingMemoryData = true
        
        // Simulate loading
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        
        await updateMemoryMetrics()
        
        hasLiveMemoryData = true
        isLoadingMemoryData = false
    }
    
    func refreshMemoryData() async {
        await updateMemoryMetrics()
    }
    
    func runMemoryGarbageCollection() async {
        // Simulate GC
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        await updateMemoryMetrics()
    }
    
    func runMemoryOptimization() async {
        // Simulate optimization
        try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
        flashAttentionSavings = min(0.9, flashAttentionSavings + 0.1)
        await updateMemoryMetrics()
    }
    
    func runMemoryLeakDetection() async {
        isRunningLeakDetection = true
        
        // Simulate detection
        try? await Task.sleep(nanoseconds: 3_000_000_000) // 3 seconds
        
        isRunningLeakDetection = false
    }
    
    func optimizeFlashAttention() async {
        // Simulate flash attention optimization
        try? await Task.sleep(nanoseconds: 1_500_000_000) // 1.5 seconds
        flashAttentionSavings = min(0.85, flashAttentionSavings + 0.05)
    }
    
    func clearMemoryCaches() async {
        // Simulate cache clearing
        try? await Task.sleep(nanoseconds: 800_000_000) // 0.8 seconds
        totalCacheSize = Int64(Double(totalCacheSize) * 0.7) // Reduce cache size
    }
    
    func getMemoryBreakdown() -> [MemorySegment] {
        let total = totalMemoryUsage
        
        return [
            MemorySegment(
                type: .attention,
                usage: Int64(Double(total) * 0.35),
                percentage: 35.0,
                color: .purple
            ),
            MemorySegment(
                type: .activations,
                usage: Int64(Double(total) * 0.25),
                percentage: 25.0,
                color: .blue
            ),
            MemorySegment(
                type: .weights,
                usage: Int64(Double(total) * 0.20),
                percentage: 20.0,
                color: .green
            ),
            MemorySegment(
                type: .cache,
                usage: Int64(Double(total) * 0.15),
                percentage: 15.0,
                color: .orange
            ),
            MemorySegment(
                type: .other,
                usage: Int64(Double(total) * 0.05),
                percentage: 5.0,
                color: .gray
            )
        ]
    }
    
    func getMemoryHistory(for timeRange: MemoryTimeRange) -> [MemoryUsagePoint] {
        return memoryHistory.suffix(50) // Return recent history
    }
    
    func getMemoryPools() -> [MemoryPool] {
        return [
            MemoryPool(
                id: "pool_1",
                name: "Attention Pool",
                type: .attention,
                totalSize: 2 * 1024 * 1024 * 1024, // 2GB
                allocatedSize: Int64(1.4 * 1024 * 1024 * 1024), // 1.4GB
                healthStatus: .good,
                segment: getMemoryBreakdown().first { $0.type == .attention }
            ),
            MemoryPool(
                id: "pool_2",
                name: "Activation Pool",
                type: .activations,
                totalSize: 1 * 1024 * 1024 * 1024, // 1GB
                allocatedSize: Int64(0.8 * 1024 * 1024 * 1024), // 0.8GB
                healthStatus: .good,
                segment: getMemoryBreakdown().first { $0.type == .activations }
            )
        ]
    }
    
    func getAllocationPatterns(for timeRange: MemoryTimeRange) -> [AllocationPattern] {
        return MemorySegmentType.allCases.map { type in
            AllocationPattern(
                type: type,
                count: Int.random(in: 100...1000),
                averageSize: Int64.random(in: 1024...1024*1024)
            )
        }
    }
    
    func getAllocationHotspots(for timeRange: MemoryTimeRange) -> [AllocationHotspot] {
        return [
            AllocationHotspot(
                id: "hotspot_1",
                location: "TokenEmbedding::forward",
                description: "High-frequency allocations in token embedding layer",
                allocationCount: 2847,
                totalSize: 128 * 1024 * 1024,
                averageSize: 45 * 1024,
                severity: .moderate
            ),
            AllocationHotspot(
                id: "hotspot_2",
                location: "AttentionMechanism::compute",
                description: "Memory pressure in attention computation",
                allocationCount: 1523,
                totalSize: 64 * 1024 * 1024,
                averageSize: 42 * 1024,
                severity: .high
            )
        ]
    }
    
    // MARK: - Cache Methods
    
    func getCacheMetrics(for timeRange: MemoryTimeRange) -> [CacheMetrics] {
        return [
            CacheMetrics(
                name: "Attention Cache",
                hitRate: Double.random(in: 0.75...0.95),
                missRate: Double.random(in: 0.05...0.25),
                size: 512 * 1024 * 1024
            ),
            CacheMetrics(
                name: "Weight Cache",
                hitRate: Double.random(in: 0.80...0.95),
                missRate: Double.random(in: 0.05...0.20),
                size: 256 * 1024 * 1024
            ),
            CacheMetrics(
                name: "Activation Cache",
                hitRate: Double.random(in: 0.70...0.90),
                missRate: Double.random(in: 0.10...0.30),
                size: 128 * 1024 * 1024
            )
        ]
    }
    
    func getCacheOptimizationSuggestions() -> [CacheOptimizationSuggestion] {
        return [
            CacheOptimizationSuggestion(
                id: "cache_opt_1",
                type: .increaseCacheSize,
                title: "Increase Attention Cache Size",
                description: "Current cache size appears to be limiting performance",
                impact: .high
            ),
            CacheOptimizationSuggestion(
                id: "cache_opt_2",
                type: .optimizeEviction,
                title: "Optimize Cache Eviction Policy",
                description: "LRU policy may not be optimal for current workload",
                impact: .medium
            )
        ]
    }
    
    // MARK: - Flash Attention Methods
    
    func getFlashAttentionSavings(for timeRange: MemoryTimeRange) -> [FlashAttentionSavingsPoint] {
        var points: [FlashAttentionSavingsPoint] = []
        let count = 100
        
        for i in 0..<count {
            let time = Date().addingTimeInterval(-Double(count - i) * 60) // 1 minute intervals
            let standardMemory = Int64.random(in: 4*1024*1024*1024...8*1024*1024*1024) // 4-8GB
            let flashMemory = Int64(Double(standardMemory) * (1.0 - flashAttentionSavings))
            
            points.append(FlashAttentionSavingsPoint(
                timestamp: time,
                standardMemory: standardMemory,
                flashAttentionMemory: flashMemory
            ))
        }
        
        return points
    }
    
    func getFlashAttentionRecommendations() -> [FlashAttentionRecommendation] {
        return [
            FlashAttentionRecommendation(
                id: "flash_rec_1",
                type: .optimizeBatchSize,
                title: "Optimize Batch Size",
                description: "Current batch size may not be optimal for flash attention",
                expectedSavings: 0.15,
                implementationSteps: ["Analyze current batch patterns", "Test smaller batch sizes", "Monitor memory usage"]
            ),
            FlashAttentionRecommendation(
                id: "flash_rec_2",
                type: .enableGradientCheckpointing,
                title: "Enable Gradient Checkpointing",
                description: "Gradient checkpointing can significantly reduce memory usage",
                expectedSavings: 0.25,
                implementationSteps: ["Enable checkpointing", "Monitor performance impact"]
            )
        ]
    }
    
    // MARK: - Memory Leak Detection
    
    func getDetectedMemoryLeaks(for timeRange: MemoryTimeRange) -> [MemoryLeak] {
        // Return empty array for good health, or sample leaks for testing
        if Bool.random() {
            return []
        } else {
            return [
                MemoryLeak(
                    id: "leak_1",
                    location: "AttentionCache::grow",
                    description: "Gradual memory growth in attention cache without corresponding cleanup",
                    leakedSize: 32 * 1024 * 1024, // 32MB
                    growthRate: 1024 * 1024, // 1MB/min
                    severity: .moderate,
                    firstDetected: Date().addingTimeInterval(-3600) // 1 hour ago
                )
            ]
        }
    }
    
    func getMemoryLeakTrends(for timeRange: MemoryTimeRange) -> [MemoryLeakTrend] {
        var trends: [MemoryLeakTrend] = []
        let count = 60
        
        for i in 0..<count {
            let time = Date().addingTimeInterval(-Double(count - i) * 60)
            let leakedMemory = Int64(i * 1024 * 1024) // Gradual increase
            
            trends.append(MemoryLeakTrend(
                timestamp: time,
                totalLeakedMemory: leakedMemory
            ))
        }
        
        return trends
    }
    
    func getMemoryCleanupSuggestions() -> [MemoryCleanupSuggestion] {
        return [
            MemoryCleanupSuggestion(
                id: "cleanup_1",
                type: .clearUnusedCache,
                title: "Clear Unused Cache Entries",
                description: "Remove cache entries that haven't been accessed recently",
                potentialSavings: 128 * 1024 * 1024 // 128MB
            ),
            MemoryCleanupSuggestion(
                id: "cleanup_2",
                type: .compactMemory,
                title: "Compact Memory Pools",
                description: "Defragment memory pools to reduce overhead",
                potentialSavings: 64 * 1024 * 1024 // 64MB
            )
        ]
    }
    
    func applyCleanupSuggestion(_ suggestion: MemoryCleanupSuggestion) async {
        // Simulate applying cleanup
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        currentMemoryUsage -= suggestion.potentialSavings
        await updateMemoryMetrics()
    }
    
    // MARK: - System Resources
    
    func getSystemResourceHistory(for timeRange: MemoryTimeRange) -> [SystemResourcePoint] {
        var points: [SystemResourcePoint] = []
        let count = 100
        
        for i in 0..<count {
            let time = Date().addingTimeInterval(-Double(count - i) * 60)
            
            points.append(SystemResourcePoint(
                timestamp: time,
                cpuUsage: Double.random(in: 20...80),
                memoryUsage: Double.random(in: 40...90),
                gpuUsage: Double.random(in: 10...70)
            ))
        }
        
        return points
    }
    
    func getSystemOptimizationRecommendations() -> [SystemOptimizationRecommendation] {
        return [
            SystemOptimizationRecommendation(
                id: "sys_opt_1",
                type: .reduceCPUUsage,
                title: "Optimize CPU Usage",
                description: "Consider reducing thread count or optimizing compute kernels",
                priority: .high
            ),
            SystemOptimizationRecommendation(
                id: "sys_opt_2",
                type: .optimizeMemoryAccess,
                title: "Optimize Memory Access Patterns",
                description: "Sequential memory access patterns could improve performance",
                priority: .medium
            )
        ]
    }
    
    // MARK: - Optimization and Suggestions
    
    func getOptimizationSuggestions(for stage: ProcessingStage) -> [OptimizationSuggestion] {
        return [
            OptimizationSuggestion(
                id: "opt_\(stage.rawValue)_1",
                type: .memoryOptimization,
                title: "Optimize \(stage.rawValue) Memory Usage",
                description: "Reduce memory allocation overhead in \(stage.rawValue.lowercased()) stage",
                expectedImprovement: Double.random(in: 0.1...0.3),
                timestamp: Date()
            )
        ]
    }
    
    func getStageMetrics(for stage: ProcessingStage, sequence: String?) -> StagePerformanceMetrics {
        return StagePerformanceMetrics(
            averageDuration: Double.random(in: 5...50),
            memoryUsage: Int64.random(in: 1024*1024...100*1024*1024),
            throughput: Int.random(in: 50...200),
            efficiency: Double.random(in: 0.7...0.95),
            durationTrend: TrendDirection.allCases.randomElement() ?? .stable,
            memoryTrend: TrendDirection.allCases.randomElement() ?? .stable,
            throughputTrend: TrendDirection.allCases.randomElement() ?? .stable,
            efficiencyTrend: TrendDirection.allCases.randomElement() ?? .stable
        )
    }
    
    func getStagePerformanceHistory(for stage: ProcessingStage) -> [StagePerformancePoint] {
        var points: [StagePerformancePoint] = []
        
        for i in 0..<50 {
            let time = Date().addingTimeInterval(-Double(50 - i) * 60)
            points.append(StagePerformancePoint(
                timestamp: time,
                duration: Double.random(in: 5...50)
            ))
        }
        
        return points
    }
    
    func getMemoryOptimizationRecommendations() -> [OptimizationSuggestion] {
        return recentOptimizations.prefix(5).map { $0 }
    }
    
    func getSegmentMetrics(for segment: MemorySegment) -> MemorySegmentMetrics? {
        return MemorySegmentMetrics(
            allocationCount: Int.random(in: 100...1000),
            deallocationCount: Int.random(in: 80...950),
            peakUsage: segment.usage + Int64.random(in: 0...segment.usage/2),
            growthRate: Int64.random(in: -1024*1024...1024*1024)
        )
    }
    
    func getSegmentOptimizationSuggestions(for segment: MemorySegment) -> [OptimizationSuggestion]? {
        return [
            OptimizationSuggestion(
                id: "seg_opt_\(segment.type.rawValue)",
                type: .memoryOptimization,
                title: "Optimize \(segment.type.displayName)",
                description: "Reduce memory usage in \(segment.type.displayName.lowercased()) segment",
                expectedImprovement: 0.15,
                timestamp: Date()
            )
        ]
    }
    
    // MARK: - Computed Properties
    
    var attentionEfficiencyHistory: [FlashAttentionPoint] {
        return attentionHistory
    }
    
    var memoryUsageHistory: [MemoryUsagePoint] {
        return memoryHistory
    }
    
    // MARK: - Private Methods
    
    private func setupDefaultData() {
        // Initialize with sample data
        currentMetrics = FlashAttentionMetrics(
            attentionEfficiency: 0.85,
            memoryUsage: 4 * 1024 * 1024 * 1024, // 4GB
            tokensPerSecond: 120
        )
        
        totalMemoryUsage = 6 * 1024 * 1024 * 1024 // 6GB
        availableMemory = 2 * 1024 * 1024 * 1024 // 2GB
        currentMemoryUsage = totalMemoryUsage - availableMemory
        flashAttentionSavings = 0.35
        
        // Generate initial history
        generateInitialHistory()
    }
    
    private func setupNetworkMonitoring() {
        // Monitor network connectivity for real-time updates
        Timer.publish(every: 5.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.checkConnectionStatus()
            }
            .store(in: &cancellables)
    }
    
    private func checkConnectionStatus() {
        // Simulate connection status
        let wasConnected = isConnected
        isConnected = Bool.random() ? true : isConnected // Occasional disconnections
        
        if isConnected != wasConnected {
            lastUpdate = Date()
        }
    }
    
    private func loadInitialMetrics() async {
        // Simulate loading initial metrics
        hasLiveOverviewData = true
        hasAdvancedAnalytics = true
        
        // Update health statuses
        flashAttentionHealth = [.excellent, .good, .fair].randomElement() ?? .good
        memoryOptimizationHealth = [.excellent, .good, .fair].randomElement() ?? .good
        tokenProcessingHealth = [.excellent, .good, .fair].randomElement() ?? .good
        modelPerformanceHealth = [.excellent, .good, .fair].randomElement() ?? .good
    }
    
    private func loadAvailableModels() async {
        availableModels = [
            ModelInfo(
                id: "gpt-4-turbo",
                name: "GPT-4 Turbo",
                description: "Advanced language model with flash attention",
                color: .blue
            ),
            ModelInfo(
                id: "claude-3-opus",
                name: "Claude 3 Opus",
                description: "High-performance reasoning model",
                color: .purple
            ),
            ModelInfo(
                id: "llama-2-70b",
                name: "Llama 2 70B",
                description: "Open-source large language model",
                color: .green
            ),
            ModelInfo(
                id: "mistral-large",
                name: "Mistral Large",
                description: "Efficient large language model",
                color: .orange
            ),
            ModelInfo(
                id: "gemini-pro",
                name: "Gemini Pro",
                description: "Google's advanced language model",
                color: .red
            )
        ]
    }
    
    private func generateSampleOptimizations() async {
        recentOptimizations = [
            OptimizationSuggestion(
                id: "opt_1",
                type: .flashAttentionOptimization,
                title: "Enable Flash Attention 2.0",
                description: "Upgrade to Flash Attention 2.0 for improved memory efficiency",
                expectedImprovement: 0.25,
                timestamp: Date().addingTimeInterval(-3600)
            ),
            OptimizationSuggestion(
                id: "opt_2",
                type: .memoryOptimization,
                title: "Optimize Memory Allocation",
                description: "Use memory pools to reduce allocation overhead",
                expectedImprovement: 0.15,
                timestamp: Date().addingTimeInterval(-1800)
            ),
            OptimizationSuggestion(
                id: "opt_3",
                type: .cacheOptimization,
                title: "Increase Cache Size",
                description: "Expand attention cache to improve hit rates",
                expectedImprovement: 0.12,
                timestamp: Date().addingTimeInterval(-900)
            )
        ]
        
        identifiedBottlenecks = [
            ProcessingBottleneck(
                id: "bottleneck_1",
                relativePosition: CGPoint(x: 0.3, y: 0.4),
                severity: 0.7
            ),
            ProcessingBottleneck(
                id: "bottleneck_2",
                relativePosition: CGPoint(x: 0.7, y: 0.6),
                severity: 0.5
            )
        ]
    }
    
    private func generateInitialHistory() {
        // Generate attention efficiency history
        for i in 0..<100 {
            let time = Date().addingTimeInterval(-Double(100 - i) * 60) // 1 minute intervals
            let efficiency = 0.75 + sin(Double(i) * 0.1) * 0.1 + Double.random(in: -0.05...0.05)
            
            attentionHistory.append(FlashAttentionPoint(
                timestamp: time,
                value: max(0, min(1, efficiency))
            ))
        }
        
        // Generate memory usage history
        for i in 0..<100 {
            let time = Date().addingTimeInterval(-Double(100 - i) * 60)
            let baseUsage = Int64(4 * 1024 * 1024 * 1024) // 4GB base
            let variation = Int64.random(in: -512*1024*1024...512*1024*1024) // ±512MB
            let usage = max(0, baseUsage + variation)
            let withoutFlash = Int64(Double(usage) / (1.0 - flashAttentionSavings))
            
            memoryHistory.append(MemoryUsagePoint(
                timestamp: time,
                totalUsage: usage,
                usageWithoutFlash: withoutFlash
            ))
        }
    }
    
    private func updateLiveMetrics() async {
        // Simulate real-time metric updates
        let newEfficiency = max(0.6, min(0.95, currentMetrics.attentionEfficiency + Double.random(in: -0.02...0.02)))
        let newMemoryUsage = max(Int64(2*1024*1024*1024), currentMetrics.memoryUsage + Int64.random(in: -100*1024*1024...100*1024*1024))
        let newThroughput = max(50, currentMetrics.tokensPerSecond + Int.random(in: -10...10))
        
        currentMetrics = FlashAttentionMetrics(
            attentionEfficiency: newEfficiency,
            memoryUsage: newMemoryUsage,
            tokensPerSecond: newThroughput
        )
        
        // Update trends
        attentionEfficiencyTrend = calculateTrend(for: attentionHistory.map { $0.value })
        
        // Add new data points
        let now = Date()
        attentionHistory.append(FlashAttentionPoint(timestamp: now, value: newEfficiency))
        memoryHistory.append(MemoryUsagePoint(
            timestamp: now,
            totalUsage: newMemoryUsage,
            usageWithoutFlash: Int64(Double(newMemoryUsage) / (1.0 - flashAttentionSavings))
        ))
        
        // Keep only recent history
        if attentionHistory.count > 100 {
            attentionHistory.removeFirst()
        }
        if memoryHistory.count > 100 {
            memoryHistory.removeFirst()
        }
        
        lastUpdateTime = now
    }
    
    private func generateNewDataPoints() async {
        // Generate new sample data points
        totalDataPoints += Int.random(in: 10...50)
        
        // Update processing metrics
        averageProcessingTime = Double.random(in: 8...25)
        currentThroughput = Int.random(in: 80...150)
        activeProcessingCount = Int.random(in: 0...5)
        queuedTokenCount = Int.random(in: 0...20)
        completedTokenCount += Int.random(in: 5...15)
    }
    
    private func generateHistoricalData(for timeRange: TimeRange) async {
        // Generate historical data based on time range
        let dataPoints = Int(timeRange.seconds / 60) // One point per minute
        
        for i in 0..<min(dataPoints, 500) { // Limit for performance
            let time = Date().addingTimeInterval(-timeRange.seconds + Double(i) * 60)
            let efficiency = 0.8 + sin(Double(i) * 0.05) * 0.1 + Double.random(in: -0.03...0.03)
            
            // Don't override recent data
            if time < Date().addingTimeInterval(-3600) { // Older than 1 hour
                attentionHistory.append(FlashAttentionPoint(
                    timestamp: time,
                    value: max(0, min(1, efficiency))
                ))
            }
        }
        
        // Sort by timestamp
        attentionHistory.sort { $0.timestamp < $1.timestamp }
        
        // Keep reasonable size
        if attentionHistory.count > 1000 {
            attentionHistory = Array(attentionHistory.suffix(1000))
        }
    }
    
    private func updateProcessingMetrics() async {
        // Update processing-related metrics
        averageProcessingTime = Double.random(in: 5...30)
        currentThroughput = Int.random(in: 60...180)
        
        // Generate new bottlenecks occasionally
        if Bool.random() && Double.random(in: 0...1) < 0.1 {
            identifiedBottlenecks.append(ProcessingBottleneck(
                id: "bottleneck_\(Date().timeIntervalSince1970)",
                relativePosition: CGPoint(
                    x: Double.random(in: 0.1...0.9),
                    y: Double.random(in: 0.1...0.9)
                ),
                severity: Double.random(in: 0.3...0.8)
            ))
        }
        
        // Keep only recent bottlenecks
        if identifiedBottlenecks.count > 5 {
            identifiedBottlenecks.removeFirst()
        }
    }
    
    private func updatePerformanceMetrics() async {
        // Update performance-related metrics
        hasLivePerformanceData = true
        totalDataPoints = Int.random(in: 1500...6000)
        lastUpdateTime = Date()
    }
    
    private func updateMemoryMetrics() async {
        // Update memory-related metrics
        let variation = Double.random(in: -0.1...0.1)
        currentMemoryUsage = max(Int64(1*1024*1024*1024), Int64(Double(currentMemoryUsage) * (1.0 + variation)))
        totalMemoryUsage = currentMemoryUsage + availableMemory
        
        // Update memory pressure
        let usagePercentage = Double(currentMemoryUsage) / Double(totalMemoryUsage)
        memoryUsagePercentage = usagePercentage * 100
        
        if usagePercentage > 0.9 {
            memoryPressureLevel = .critical
        } else if usagePercentage > 0.75 {
            memoryPressureLevel = .warning
        } else {
            memoryPressureLevel = .normal
        }
        
        // Update system resource metrics
        currentCPUUsage = Double.random(in: 15...85)
        diskIORate = Int64.random(in: 1024*1024...100*1024*1024) // 1MB-100MB/s
        networkIORate = Int64.random(in: 1024*512...50*1024*1024) // 512KB-50MB/s
        gpuUsage = Double.random(in: 5...75)
        systemTemperature = Double.random(in: 35...65)
        
        // Update cache metrics
        overallCacheHitRate = Double.random(in: 0.75...0.95)
        cacheEvictions = Int.random(in: 0...100)
        totalCacheSize = Int64.random(in: 512*1024*1024...2*1024*1024*1024) // 512MB-2GB
        
        // Update efficiency metrics
        memoryEfficiency = Double.random(in: 0.7...0.9)
        allocationEfficiency = Double.random(in: 0.75...0.95)
        cacheEfficiency = Double.random(in: 0.8...0.95)
        
        // Update resource statuses
        cpuStatus = statusForUsage(currentCPUUsage)
        memoryStatus = statusForUsage(memoryUsagePercentage)
        diskIOStatus = .normal // Simplified
        networkIOStatus = .normal // Simplified
        gpuStatus = statusForUsage(gpuUsage)
        temperatureStatus = statusForTemperature(systemTemperature)
        
        hasLiveMemoryData = true
        lastUpdateTime = Date()
    }
    
    private func statusForUsage(_ usage: Double) -> ResourceStatus {
        if usage > 85 {
            return .critical
        } else if usage > 70 {
            return .warning
        } else {
            return .normal
        }
    }
    
    private func statusForTemperature(_ temp: Double) -> ResourceStatus {
        if temp > 60 {
            return .critical
        } else if temp > 50 {
            return .warning
        } else {
            return .normal
        }
    }
    
    private func calculateTrend(for values: [Double]) -> TrendDirection {
        guard values.count >= 2 else { return .stable }
        
        let recent = values.suffix(10)
        let older = values.dropLast(10).suffix(10)
        
        guard !recent.isEmpty && !older.isEmpty else { return .stable }
        
        let recentAvg = recent.reduce(0, +) / Double(recent.count)
        let olderAvg = older.reduce(0, +) / Double(older.count)
        
        let change = (recentAvg - olderAvg) / olderAvg * 100
        
        if abs(change) < 1.0 {
            return .stable
        } else if change > 0 {
            return .up(abs(change))
        } else {
            return .down(abs(change))
        }
    }
    
    private func generateProcessingStages() -> [TokenStageData] {
        return ProcessingStage.allCases.enumerated().map { index, stage in
            let startTime = Date().addingTimeInterval(-Double(ProcessingStage.allCases.count - index) * 10)
            let duration = Double.random(in: 5...15)
            
            return TokenStageData(
                stage: stage,
                startTime: startTime,
                endTime: startTime.addingTimeInterval(duration),
                duration: duration
            )
        }
    }
    
    private func generatePerformanceDataPoints(for metric: PerformanceMetric, timeRange: ChartTimeRange) -> [ModelDataPoint] {
        var points: [ModelDataPoint] = []
        let count = min(Int(timeRange.seconds / 300), 100) // One point every 5 minutes, max 100
        
        for i in 0..<count {
            let time = Date().addingTimeInterval(-timeRange.seconds + Double(i) * 300)
            let point = ModelDataPoint(
                id: "point_\(i)",
                modelId: "model",
                timestamp: time,
                throughput: Double.random(in: 80...150),
                latency: Double.random(in: 10...50),
                memoryUsage: Double.random(in: 2...8),
                efficiency: Double.random(in: 0.7...0.95),
                accuracy: Double.random(in: 0.85...0.98),
                powerConsumption: Double.random(in: 150...300)
            )
            points.append(point)
        }
        
        return points
    }
    
    private func generatePredictionPoints() -> [ModelDataPoint] {
        // Generate a few prediction points for the future
        var points: [ModelDataPoint] = []
        
        for i in 1...5 {
            let futureTime = Date().addingTimeInterval(Double(i) * 300) // 5 minutes into future
            let point = ModelDataPoint(
                id: "pred_\(i)",
                modelId: "model",
                timestamp: futureTime,
                throughput: Double.random(in: 85...145),
                latency: Double.random(in: 12...48),
                memoryUsage: Double.random(in: 2.2...7.8),
                efficiency: Double.random(in: 0.72...0.93)
            )
            points.append(point)
        }
        
        return points
    }
    
    private func receiveWebSocketMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                Task { @MainActor in
                    self?.handleWebSocketMessage(message)
                    self?.receiveWebSocketMessage()
                }
            case .failure(let error):
                print("WebSocket error: \(error)")
                Task { @MainActor in
                    self?.isConnected = false
                }
            }
        }
    }
    
    private func handleWebSocketMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            // Parse real-time metrics from WebSocket
            if let data = text.data(using: .utf8) {
                do {
                    let metrics = try JSONDecoder().decode(FlashAttentionMetrics.self, from: data)
                    currentMetrics = metrics
                    lastUpdate = Date()
                } catch {
                    print("Failed to decode metrics: \(error)")
                }
            }
        case .data(let data):
            // Handle binary data if needed
            break
        @unknown default:
            break
        }
    }
    
    deinit {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
    }
}

// MARK: - Supporting Types

struct FlashAttentionMetrics: Codable {
    let attentionEfficiency: Double
    let memoryUsage: Int64
    let tokensPerSecond: Int
    
    init(attentionEfficiency: Double = 0.8, memoryUsage: Int64 = 4*1024*1024*1024, tokensPerSecond: Int = 100) {
        self.attentionEfficiency = attentionEfficiency
        self.memoryUsage = memoryUsage
        self.tokensPerSecond = tokensPerSecond
    }
}

struct FlashAttentionPoint: Identifiable {
    let id = UUID()
    let timestamp: Date
    let value: Double
}

struct MemoryUsagePoint: Identifiable {
    let id = UUID()
    let timestamp: Date
    let totalUsage: Int64
    let usageWithoutFlash: Int64
}

struct ModelInfo: Identifiable {
    let id: String
    let name: String
    let description: String
    let color: Color
}

struct ModelDataPoint: Identifiable {
    let id: String
    let modelId: String
    let timestamp: Date
    let throughput: Double
    let latency: Double
    let memoryUsage: Double
    let efficiency: Double
    let accuracy: Double?
    let powerConsumption: Double?
    
    var normalizedValue: Double {
        // Normalize based on metric type for charts
        return efficiency // Simplified
    }
    
    init(id: String, modelId: String, timestamp: Date, throughput: Double, latency: Double, memoryUsage: Double, efficiency: Double, accuracy: Double? = nil, powerConsumption: Double? = nil) {
        self.id = id
        self.modelId = modelId
        self.timestamp = timestamp
        self.throughput = throughput
        self.latency = latency
        self.memoryUsage = memoryUsage
        self.efficiency = efficiency
        self.accuracy = accuracy
        self.powerConsumption = powerConsumption
    }
}

struct ModelPerformanceData: Identifiable {
    let id = UUID()
    let modelId: String
    let modelName: String
    let color: Color
    let dataPoints: [ModelDataPoint]
    let predictions: [ModelDataPoint]
    let averageValue: Double
}

struct TokenProcessingSequence: Identifiable {
    let id: String
    let stages: [TokenStageData]
}

struct TokenStageData: Identifiable {
    let id = UUID()
    let stage: ProcessingStage
    let startTime: Date
    let endTime: Date
    let duration: TimeInterval
}

struct ProcessingBottleneck: Identifiable {
    let id: String
    let relativePosition: CGPoint
    let severity: Double
}

// OptimizationSuggestion and OptimizationType are defined in PerformanceOptimizer.swift

struct StagePerformanceMetrics {
    let averageDuration: Double
    let memoryUsage: Int64
    let throughput: Int
    let efficiency: Double
    let durationTrend: TrendDirection
    let memoryTrend: TrendDirection
    let throughputTrend: TrendDirection
    let efficiencyTrend: TrendDirection
}

struct StagePerformancePoint: Identifiable {
    let id = UUID()
    let timestamp: Date
    let duration: Double
}

struct PerformanceGap {
    let percentage: Double
    let isSignificant: Bool
    let recommendation: String
}

struct PerformanceInsight: Identifiable {
    let id: String
    let type: InsightType
    let title: String
    let description: String
}

enum InsightType {
    case optimization
    case warning
    case info
    
    var icon: String {
        switch self {
        case .optimization: return "wand.and.stars"
        case .warning: return "exclamationmark.triangle"
        case .info: return "info.circle"
        }
    }
    
    var color: Color {
        switch self {
        case .optimization: return .green
        case .warning: return .orange
        case .info: return .blue
        }
    }
}

// Memory-related types
enum MemoryPressureLevel {
    case normal
    case warning
    case critical
    
    var displayName: String {
        switch self {
        case .normal: return "Normal"
        case .warning: return "Warning"
        case .critical: return "Critical"
        }
    }
    
    var color: Color {
        switch self {
        case .normal: return .green
        case .warning: return .orange
        case .critical: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .normal: return "checkmark.circle"
        case .warning: return "exclamationmark.triangle"
        case .critical: return "xmark.circle"
        }
    }
    
    var recommendation: String {
        switch self {
        case .normal: return "Memory usage is within normal parameters"
        case .warning: return "Consider running garbage collection or optimizing memory usage"
        case .critical: return "Immediate action required - run memory optimization"
        }
    }
}

enum ResourceStatus {
    case normal
    case warning
    case critical
    
    var color: Color {
        switch self {
        case .normal: return .green
        case .warning: return .orange
        case .critical: return .red
        }
    }
}

struct MemorySegment: Identifiable {
    let id = UUID()
    let type: MemorySegmentType
    let usage: Int64
    let percentage: Double
    let color: Color
}

enum MemorySegmentType: String, CaseIterable {
    case attention = "attention"
    case activations = "activations"
    case weights = "weights"
    case cache = "cache"
    case other = "other"
    
    var displayName: String {
        switch self {
        case .attention: return "Attention"
        case .activations: return "Activations"
        case .weights: return "Model Weights"
        case .cache: return "Cache"
        case .other: return "Other"
        }
    }
    
    var color: Color {
        switch self {
        case .attention: return .purple
        case .activations: return .blue
        case .weights: return .green
        case .cache: return .orange
        case .other: return .gray
        }
    }
}

struct MemoryPool: Identifiable {
    let id: String
    let name: String
    let type: MemorySegmentType
    let totalSize: Int64
    let allocatedSize: Int64
    let healthStatus: HealthStatus
    let segment: MemorySegment?
    
    var utilizationPercentage: Double {
        guard totalSize > 0 else { return 0 }
        return Double(allocatedSize) / Double(totalSize) * 100
    }
    
    var healthColor: Color {
        if utilizationPercentage > 90 {
            return .red
        } else if utilizationPercentage > 75 {
            return .orange
        } else {
            return .green
        }
    }
}

struct AllocationPattern {
    let type: MemorySegmentType
    let count: Int
    let averageSize: Int64
}

struct AllocationHotspot: Identifiable {
    let id: String
    let location: String
    let description: String
    let allocationCount: Int
    let totalSize: Int64
    let averageSize: Int64
    let severity: HotspotSeverity
}

enum HotspotSeverity {
    case low
    case moderate
    case high
    case critical
    
    var color: Color {
        switch self {
        case .low: return .green
        case .moderate: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }
}

struct CacheMetrics {
    let name: String
    let hitRate: Double
    let missRate: Double
    let size: Int64
}

struct CacheOptimizationSuggestion: Identifiable {
    let id: String
    let type: CacheOptimizationType
    let title: String
    let description: String
    let impact: OptimizationImpact
}

enum CacheOptimizationType {
    case increaseCacheSize
    case optimizeEviction
    case adjustStrategy
    
    var icon: String {
        switch self {
        case .increaseCacheSize: return "plus.circle"
        case .optimizeEviction: return "arrow.clockwise"
        case .adjustStrategy: return "gear"
        }
    }
    
    var color: Color {
        switch self {
        case .increaseCacheSize: return .blue
        case .optimizeEviction: return .orange
        case .adjustStrategy: return .purple
        }
    }
}

enum OptimizationImpact {
    case low
    case medium
    case high
    
    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        }
    }
    
    var color: Color {
        switch self {
        case .low: return .green
        case .medium: return .orange
        case .high: return .red
        }
    }
}

struct FlashAttentionSavingsPoint: Identifiable {
    let id = UUID()
    let timestamp: Date
    let standardMemory: Int64
    let flashAttentionMemory: Int64
}

struct FlashAttentionRecommendation: Identifiable {
    let id: String
    let type: FlashAttentionOptimizationType
    let title: String
    let description: String
    let expectedSavings: Double
    let implementationSteps: [String]
}

enum FlashAttentionOptimizationType {
    case optimizeBatchSize
    case enableGradientCheckpointing
    case adjustSequenceLength
    
    var icon: String {
        switch self {
        case .optimizeBatchSize: return "square.stack"
        case .enableGradientCheckpointing: return "checkmark.square"
        case .adjustSequenceLength: return "text.alignleft"
        }
    }
    
    var color: Color {
        switch self {
        case .optimizeBatchSize: return .blue
        case .enableGradientCheckpointing: return .green
        case .adjustSequenceLength: return .purple
        }
    }
}

struct MemoryLeak: Identifiable {
    let id: String
    let location: String
    let description: String
    let leakedSize: Int64
    let growthRate: Int64
    let severity: LeakSeverity
    let firstDetected: Date
}

enum LeakSeverity {
    case minor
    case moderate
    case severe
    case critical
    
    var icon: String {
        switch self {
        case .minor: return "drop"
        case .moderate: return "drop.fill"
        case .severe: return "exclamationmark.triangle"
        case .critical: return "exclamationmark.octagon"
        }
    }
    
    var color: Color {
        switch self {
        case .minor: return .blue
        case .moderate: return .yellow
        case .severe: return .orange
        case .critical: return .red
        }
    }
}

struct MemoryLeakTrend: Identifiable {
    let id = UUID()
    let timestamp: Date
    let totalLeakedMemory: Int64
}

struct MemoryCleanupSuggestion: Identifiable {
    let id: String
    let type: CleanupType
    let title: String
    let description: String
    let potentialSavings: Int64
}

enum CleanupType {
    case clearUnusedCache
    case compactMemory
    case releaseBuffers
    
    var icon: String {
        switch self {
        case .clearUnusedCache: return "trash"
        case .compactMemory: return "arrow.up.and.down.and.arrow.left.and.right"
        case .releaseBuffers: return "minus.circle"
        }
    }
    
    var color: Color {
        switch self {
        case .clearUnusedCache: return .orange
        case .compactMemory: return .blue
        case .releaseBuffers: return .purple
        }
    }
}

struct SystemResourcePoint: Identifiable {
    let id = UUID()
    let timestamp: Date
    let cpuUsage: Double
    let memoryUsage: Double
    let gpuUsage: Double
}

struct SystemOptimizationRecommendation: Identifiable {
    let id: String
    let type: SystemOptimizationType
    let title: String
    let description: String
    let priority: OptimizationPriority
}

enum SystemOptimizationType {
    case reduceCPUUsage
    case optimizeMemoryAccess
    case improveGPUUtilization
    
    var icon: String {
        switch self {
        case .reduceCPUUsage: return "cpu"
        case .optimizeMemoryAccess: return "memorychip"
        case .improveGPUUtilization: return "externalgpu"
        }
    }
    
    var color: Color {
        switch self {
        case .reduceCPUUsage: return .blue
        case .optimizeMemoryAccess: return .green
        case .improveGPUUtilization: return .red
        }
    }
}

enum OptimizationPriority {
    case low
    case medium
    case high
    case critical
    
    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }
    
    var color: Color {
        switch self {
        case .low: return .green
        case .medium: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }
}

struct MemorySegmentMetrics {
    let allocationCount: Int
    let deallocationCount: Int
    let peakUsage: Int64
    let growthRate: Int64
}

// Extension for TrendDirection if not already defined elsewhere
extension TrendDirection {
    static var allCases: [TrendDirection] {
        return [.up(2.5), .down(1.5), .stable, .up(0.8), .down(3.2)]
    }
}