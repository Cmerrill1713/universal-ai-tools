import Foundation
import SwiftUI
import Combine

// MARK: - Context Flow Data Models

/// Represents a path in the context flow from source to response
struct ContextPath: Identifiable, Codable, Hashable {
    let id: String
    let sourceId: String
    let intermediates: [String] // Intermediate processing steps
    let destinationId: String
    let relevanceScore: Float // 0.0 to 1.0
    let pathType: ContextPathType
    let timestamp: Date
    
    enum ContextPathType: String, Codable, CaseIterable {
        case semantic = "semantic"
        case hierarchical = "hierarchical"
        case temporal = "temporal"
        case similarity = "similarity"
        case causality = "causality"
        case dependency = "dependency"
        
        var color: Color {
            switch self {
            case .semantic: return AppTheme.accentBlue
            case .hierarchical: return AppTheme.accentGreen
            case .temporal: return AppTheme.accentOrange
            case .similarity: return .purple
            case .causality: return .red
            case .dependency: return .yellow
            }
        }
        
        var displayName: String {
            switch self {
            case .semantic: return "Semantic"
            case .hierarchical: return "Hierarchical"
            case .temporal: return "Temporal"
            case .similarity: return "Similarity"
            case .causality: return "Causality"
            case .dependency: return "Dependency"
            }
        }
    }
}

/// Represents a node in the context flow network
struct ContextNode: Identifiable, Codable, Hashable {
    let id: String
    let content: String
    let embedding: [Float]? // Optional vector embedding
    let type: ContextNodeType
    let timestamp: Date
    let metadata: ContextNodeMetadata
    let position: CGPoint // For visualization positioning
    
    // Computed properties for visualization
    var size: CGFloat { 
        metadata.importance * 40.0 + 10.0 
    }
    
    var color: Color { 
        type.color.opacity(Double(metadata.importance)) 
    }
    
    enum ContextNodeType: String, Codable, CaseIterable {
        case source = "source"
        case code = "code"
        case document = "document"
        case conversation = "conversation"
        case memory = "memory"
        case query = "query"
        case response = "response"
        case intermediate = "intermediate"
        
        var color: Color {
            switch self {
            case .source: return .blue
            case .code: return .green
            case .document: return .orange
            case .conversation: return .purple
            case .memory: return .pink
            case .query: return .cyan
            case .response: return .yellow
            case .intermediate: return .gray
            }
        }
        
        var icon: String {
            switch self {
            case .source: return "externaldrive.connected"
            case .code: return "curlybraces"
            case .document: return "doc.text"
            case .conversation: return "bubble.left.and.bubble.right"
            case .memory: return "brain.head.profile"
            case .query: return "magnifyingglass"
            case .response: return "text.bubble"
            case .intermediate: return "arrow.right.circle"
            }
        }
    }
}

struct ContextNodeMetadata: Codable, Hashable {
    let importance: Float // 0.0 to 1.0
    let accessCount: Int
    let lastAccessed: Date
    let tags: [String]
    let summary: String
    let confidence: Float // 0.0 to 1.0
}

/// Represents similarity relationships between contexts
struct SimilarityEdge: Identifiable, Codable, Hashable {
    let id: String
    let sourceId: String
    let targetId: String
    let similarityScore: Float // 0.0 to 1.0
    let relationshipType: SimilarityType
    let strength: Float // Visual thickness multiplier
    
    var color: Color { 
        relationshipType.color.opacity(Double(similarityScore)) 
    }
    
    enum SimilarityType: String, Codable, CaseIterable {
        case semantic = "semantic"
        case lexical = "lexical"
        case structural = "structural"
        case topical = "topical"
        case temporal = "temporal"
        case contextual = "contextual"
        
        var color: Color {
            switch self {
            case .semantic: return .blue
            case .lexical: return .green
            case .structural: return .orange
            case .topical: return .purple
            case .temporal: return .red
            case .contextual: return .cyan
            }
        }
    }
}

/// Represents context clusters
struct ContextCluster: Identifiable, Codable, Hashable {
    let id: String
    let centroid: CGPoint
    let members: [String] // Context node IDs
    let topic: String
    let coherenceScore: Float // 0.0 to 1.0
    let metadata: ContextClusterMetadata
    
    var radius: CGFloat { 
        sqrt(CGFloat(members.count)) * 15.0 + 20.0 
    }
    
    var color: Color {
        Color(hue: Double(abs(topic.hashValue) % 360) / 360.0,
              saturation: 0.6,
              brightness: 0.8,
              opacity: Double(coherenceScore))
    }
}

struct ContextClusterMetadata: Codable, Hashable {
    let keywords: [String]
    let dominantType: ContextNode.ContextNodeType
    let createdAt: Date
    let lastUpdated: Date
    let averageRelevance: Float
}

/// Memory event for timeline visualization
struct MemoryEvent: Identifiable, Codable, Hashable {
    let id: String
    let timestamp: Date
    let contextId: String
    let action: MemoryAction
    let sessionId: String?
    let metadata: MemoryEventMetadata
    
    enum MemoryAction: String, Codable, CaseIterable {
        case created = "created"
        case accessed = "accessed"
        case updated = "updated"
        case retrieved = "retrieved"
        case expired = "expired"
        case archived = "archived"
        
        var color: Color {
            switch self {
            case .created: return .green
            case .accessed: return .blue
            case .updated: return .orange
            case .retrieved: return .purple
            case .expired: return .red
            case .archived: return .gray
            }
        }
        
        var icon: String {
            switch self {
            case .created: return "plus.circle"
            case .accessed: return "eye"
            case .updated: return "pencil.circle"
            case .retrieved: return "arrow.down.circle"
            case .expired: return "clock.badge.xmark"
            case .archived: return "archivebox"
            }
        }
    }
}

struct MemoryEventMetadata: Codable, Hashable {
    let duration: TimeInterval?
    let userId: String?
    let details: String?
}

/// Source attribution information
struct SourceAttribution: Identifiable, Codable, Hashable {
    let id: String
    let sourceId: String
    let contributionScore: Float // 0.0 to 1.0
    let citationInfo: CitationInfo
    let qualityMetrics: SourceQualityMetrics
}

struct CitationInfo: Codable, Hashable {
    let type: String // "file", "web", "database", etc.
    let path: String?
    let url: String?
    let lineNumbers: [Int]?
    let title: String?
    let author: String?
}

struct SourceQualityMetrics: Codable, Hashable {
    let accuracy: Float // 0.0 to 1.0
    let completeness: Float // 0.0 to 1.0
    let freshness: Float // 0.0 to 1.0
    let reliability: Float // 0.0 to 1.0
    
    var overall: Float {
        (accuracy + completeness + freshness + reliability) / 4.0
    }
}

/// Retrieval metrics for performance analytics
struct RetrievalMetrics: Codable, Hashable {
    let latency: TimeInterval
    let relevance: Float // 0.0 to 1.0
    let diversity: Float // 0.0 to 1.0
    let coverage: Float // 0.0 to 1.0
    let timestamp: Date
    
    var efficiency: Float {
        let normalizedLatency = max(0, min(1, Float(1.0 - (latency / 5.0)))) // 5s max
        return (relevance + diversity + coverage + normalizedLatency) / 4.0
    }
}

// MARK: - Context Flow Service

@MainActor
class ContextFlowService: ObservableObject {
    // Published properties for real-time updates
    @Published var contextNodes: [ContextNode] = []
    @Published var contextPaths: [ContextPath] = []
    @Published var similarityEdges: [SimilarityEdge] = []
    @Published var contextClusters: [ContextCluster] = []
    @Published var memoryEvents: [MemoryEvent] = []
    @Published var sourceAttributions: [SourceAttribution] = []
    @Published var retrievalMetrics: [RetrievalMetrics] = []
    
    // Connection and state management
    @Published var isConnected = false
    @Published var isLoading = false
    @Published var connectionStatus = "Disconnected"
    @Published var lastUpdate: Date?
    
    // Filter and display settings
    @Published var selectedTimeRange: TimeRange = .lastHour
    @Published var selectedNodeTypes: Set<ContextNode.ContextNodeType> = Set(ContextNode.ContextNodeType.allCases)
    @Published var selectedPathTypes: Set<ContextPath.ContextPathType> = Set(ContextPath.ContextPathType.allCases)
    @Published var showClusters = true
    @Published var showSimilarityEdges = true
    @Published var minRelevanceThreshold: Float = 0.3
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var cancellables = Set<AnyCancellable>()
    private let session = URLSession.shared
    
    enum TimeRange: String, CaseIterable {
        case lastMinute = "1m"
        case last5Minutes = "5m"
        case last15Minutes = "15m"
        case lastHour = "1h"
        case last24Hours = "24h"
        case lastWeek = "7d"
        case lastMonth = "30d"
        
        var displayName: String {
            switch self {
            case .lastMinute: return "Last Minute"
            case .last5Minutes: return "Last 5 Minutes"
            case .last15Minutes: return "Last 15 Minutes"
            case .lastHour: return "Last Hour"
            case .last24Hours: return "Last 24 Hours"
            case .lastWeek: return "Last Week"
            case .lastMonth: return "Last Month"
            }
        }
        
        var timeInterval: TimeInterval {
            switch self {
            case .lastMinute: return 60
            case .last5Minutes: return 300
            case .last15Minutes: return 900
            case .lastHour: return 3600
            case .last24Hours: return 86400
            case .lastWeek: return 604800
            case .lastMonth: return 2592000
            }
        }
    }
    
    static let shared = ContextFlowService()
    
    private init() {
        setupFiltering()
    }
    
    // MARK: - Connection Management
    
    func connect() async {
        isLoading = true
        connectionStatus = "Connecting..."
        
        do {
            // Connect to real-time context endpoint
            guard let url = URL(string: "ws://localhost:3000/api/realtime/context") else {
                throw ContextFlowError.invalidURL
            }
            
            webSocketTask = session.webSocketTask(with: url)
            webSocketTask?.resume()
            
            // Start listening for messages
            await startListening()
            
            // Load initial data
            await loadInitialData()
            
            isConnected = true
            connectionStatus = "Connected"
            lastUpdate = Date()
            
        } catch {
            connectionStatus = "Failed to connect: \(error.localizedDescription)"
            print("Context flow connection error: \(error)")
        }
        
        isLoading = false
    }
    
    func disconnect() {
        webSocketTask?.cancel()
        webSocketTask = nil
        isConnected = false
        connectionStatus = "Disconnected"
    }
    
    private func startListening() async {
        guard let webSocketTask = webSocketTask else { return }
        
        do {
            let message = try await webSocketTask.receive()
            
            switch message {
            case .string(let text):
                await handleMessage(text)
            case .data(let data):
                if let text = String(data: data, encoding: .utf8) {
                    await handleMessage(text)
                }
            @unknown default:
                break
            }
            
            // Continue listening
            if isConnected {
                await startListening()
            }
        } catch {
            print("WebSocket receive error: \(error)")
            isConnected = false
            connectionStatus = "Connection lost"
        }
    }
    
    private func handleMessage(_ message: String) async {
        guard let data = message.data(using: .utf8) else { return }
        
        do {
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            guard let type = json?["type"] as? String else { return }
            
            switch type {
            case "context_flow":
                if let flowData = json?["data"] as? [String: Any] {
                    await updateContextFlow(from: flowData)
                }
            case "similarity_update":
                if let similarityData = json?["data"] as? [String: Any] {
                    await updateSimilarityNetwork(from: similarityData)
                }
            case "memory_event":
                if let eventData = json?["data"] as? [String: Any] {
                    await addMemoryEvent(from: eventData)
                }
            case "cluster_update":
                if let clusterData = json?["data"] as? [String: Any] {
                    await updateClusters(from: clusterData)
                }
            case "metrics_update":
                if let metricsData = json?["data"] as? [String: Any] {
                    await updateMetrics(from: metricsData)
                }
            default:
                break
            }
            
            lastUpdate = Date()
            
        } catch {
            print("Failed to parse context flow message: \(error)")
        }
    }
    
    // MARK: - Data Loading and Updates
    
    private func loadInitialData() async {
        // Load current context flow data
        await loadContextFlow()
        await loadSimilarityNetwork()
        await loadContextClusters()
        await loadMemoryTimeline()
        await loadSourceAttributions()
        await loadRetrievalMetrics()
    }
    
    private func loadContextFlow() async {
        // Implementation would make HTTP request to /context/flow/current
        // For now, using mock data
        await generateMockContextFlow()
    }
    
    private func loadSimilarityNetwork() async {
        // Implementation would make HTTP request to /context/similarity/network
        await generateMockSimilarityNetwork()
    }
    
    private func loadContextClusters() async {
        // Implementation would make HTTP request to /context/clusters
        await generateMockClusters()
    }
    
    private func loadMemoryTimeline() async {
        // Implementation would make HTTP request to /context/timeline
        await generateMockMemoryEvents()
    }
    
    private func loadSourceAttributions() async {
        // Implementation would make HTTP request to /context/sources
        await generateMockSourceAttributions()
    }
    
    private func loadRetrievalMetrics() async {
        // Implementation would make HTTP request to /context/metrics
        await generateMockRetrievalMetrics()
    }
    
    // MARK: - Data Update Handlers
    
    private func updateContextFlow(from data: [String: Any]) async {
        // Parse and update context flow data
        // Implementation would decode real server data
    }
    
    private func updateSimilarityNetwork(from data: [String: Any]) async {
        // Parse and update similarity network
    }
    
    private func addMemoryEvent(from data: [String: Any]) async {
        // Add new memory event to timeline
    }
    
    private func updateClusters(from data: [String: Any]) async {
        // Update cluster information
    }
    
    private func updateMetrics(from data: [String: Any]) async {
        // Update performance metrics
    }
    
    // MARK: - Filtering Setup
    
    private func setupFiltering() {
        // React to filter changes
        Publishers.CombineLatest4(
            $selectedNodeTypes,
            $selectedPathTypes,
            $selectedTimeRange,
            $minRelevanceThreshold
        )
        .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
        .sink { [weak self] _ in
            Task { @MainActor in
                self?.applyFilters()
            }
        }
        .store(in: &cancellables)
    }
    
    private func applyFilters() {
        // Apply current filters to data
        // This would filter the displayed data based on current settings
    }
    
    // MARK: - Mock Data Generation (for development)
    
    private func generateMockContextFlow() async {
        let mockNodes = (0..<20).map { i in
            ContextNode(
                id: "node_\(i)",
                content: "Context content \(i)",
                embedding: nil,
                type: ContextNode.ContextNodeType.allCases.randomElement()!,
                timestamp: Date().addingTimeInterval(-Double.random(in: 0...3600)),
                metadata: ContextNodeMetadata(
                    importance: Float.random(in: 0.2...1.0),
                    accessCount: Int.random(in: 1...50),
                    lastAccessed: Date(),
                    tags: ["tag\(i)", "sample"],
                    summary: "Summary for context \(i)",
                    confidence: Float.random(in: 0.5...1.0)
                ),
                position: CGPoint(
                    x: Double.random(in: 0...800),
                    y: Double.random(in: 0...600)
                )
            )
        }
        
        let mockPaths = (0..<15).map { i in
            ContextPath(
                id: "path_\(i)",
                sourceId: mockNodes.randomElement()!.id,
                intermediates: Array(mockNodes.prefix(Int.random(in: 1...3))).map(\.id),
                destinationId: mockNodes.randomElement()!.id,
                relevanceScore: Float.random(in: 0.3...1.0),
                pathType: ContextPath.ContextPathType.allCases.randomElement()!,
                timestamp: Date()
            )
        }
        
        contextNodes = mockNodes
        contextPaths = mockPaths
    }
    
    private func generateMockSimilarityNetwork() async {
        similarityEdges = (0..<25).compactMap { i in
            guard contextNodes.count > 1 else { return nil }
            let source = contextNodes.randomElement()!
            let target = contextNodes.filter { $0.id != source.id }.randomElement()!
            
            return SimilarityEdge(
                id: "edge_\(i)",
                sourceId: source.id,
                targetId: target.id,
                similarityScore: Float.random(in: 0.3...0.9),
                relationshipType: SimilarityEdge.SimilarityType.allCases.randomElement()!,
                strength: Float.random(in: 0.5...2.0)
            )
        }
    }
    
    private func generateMockClusters() async {
        contextClusters = (0..<5).map { i in
            let memberCount = Int.random(in: 3...8)
            let members = Array(contextNodes.shuffled().prefix(memberCount)).map(\.id)
            
            return ContextCluster(
                id: "cluster_\(i)",
                centroid: CGPoint(
                    x: Double.random(in: 100...700),
                    y: Double.random(in: 100...500)
                ),
                members: members,
                topic: "Topic \(i)",
                coherenceScore: Float.random(in: 0.4...0.9),
                metadata: ContextClusterMetadata(
                    keywords: ["keyword\(i)", "cluster", "topic\(i)"],
                    dominantType: ContextNode.ContextNodeType.allCases.randomElement()!,
                    createdAt: Date().addingTimeInterval(-Double.random(in: 0...86400)),
                    lastUpdated: Date(),
                    averageRelevance: Float.random(in: 0.5...0.9)
                )
            )
        }
    }
    
    private func generateMockMemoryEvents() async {
        memoryEvents = (0..<50).map { i in
            MemoryEvent(
                id: "event_\(i)",
                timestamp: Date().addingTimeInterval(-Double.random(in: 0...86400)),
                contextId: contextNodes.randomElement()?.id ?? "unknown",
                action: MemoryEvent.MemoryAction.allCases.randomElement()!,
                sessionId: "session_\(Int.random(in: 1...5))",
                metadata: MemoryEventMetadata(
                    duration: Double.random(in: 0.1...5.0),
                    userId: "user_\(Int.random(in: 1...3))",
                    details: "Event details \(i)"
                )
            )
        }.sorted { $0.timestamp > $1.timestamp }
    }
    
    private func generateMockSourceAttributions() async {
        sourceAttributions = (0..<10).map { i in
            SourceAttribution(
                id: "attr_\(i)",
                sourceId: "source_\(i)",
                contributionScore: Float.random(in: 0.2...1.0),
                citationInfo: CitationInfo(
                    type: ["file", "web", "database"].randomElement()!,
                    path: "/path/to/source\(i).txt",
                    url: "https://example.com/source\(i)",
                    lineNumbers: [Int.random(in: 1...100)],
                    title: "Source Title \(i)",
                    author: "Author \(i)"
                ),
                qualityMetrics: SourceQualityMetrics(
                    accuracy: Float.random(in: 0.5...1.0),
                    completeness: Float.random(in: 0.4...1.0),
                    freshness: Float.random(in: 0.3...1.0),
                    reliability: Float.random(in: 0.6...1.0)
                )
            )
        }
    }
    
    private func generateMockRetrievalMetrics() async {
        let now = Date()
        retrievalMetrics = (0..<30).map { i in
            RetrievalMetrics(
                latency: Double.random(in: 0.05...2.0),
                relevance: Float.random(in: 0.3...1.0),
                diversity: Float.random(in: 0.2...0.9),
                coverage: Float.random(in: 0.4...1.0),
                timestamp: now.addingTimeInterval(-Double(i) * 300) // Every 5 minutes
            )
        }.sorted { $0.timestamp > $1.timestamp }
    }
}

// MARK: - Error Handling

enum ContextFlowError: Error {
    case invalidURL
    case connectionFailed
    case dataParsingError
    case unauthorized
    
    var localizedDescription: String {
        switch self {
        case .invalidURL:
            return "Invalid WebSocket URL"
        case .connectionFailed:
            return "Failed to connect to context flow service"
        case .dataParsingError:
            return "Failed to parse context flow data"
        case .unauthorized:
            return "Unauthorized access to context flow service"
        }
    }
}

// MARK: - Computed Properties for Filtering

extension ContextFlowService {
    var filteredContextNodes: [ContextNode] {
        let timeThreshold = Date().addingTimeInterval(-selectedTimeRange.timeInterval)
        
        return contextNodes.filter { node in
            selectedNodeTypes.contains(node.type) &&
            node.timestamp >= timeThreshold &&
            node.metadata.importance >= minRelevanceThreshold
        }
    }
    
    var filteredContextPaths: [ContextPath] {
        let timeThreshold = Date().addingTimeInterval(-selectedTimeRange.timeInterval)
        
        return contextPaths.filter { path in
            selectedPathTypes.contains(path.pathType) &&
            path.timestamp >= timeThreshold &&
            path.relevanceScore >= minRelevanceThreshold
        }
    }
    
    var filteredSimilarityEdges: [SimilarityEdge] {
        guard showSimilarityEdges else { return [] }
        
        let visibleNodeIds = Set(filteredContextNodes.map(\.id))
        
        return similarityEdges.filter { edge in
            visibleNodeIds.contains(edge.sourceId) &&
            visibleNodeIds.contains(edge.targetId) &&
            edge.similarityScore >= minRelevanceThreshold
        }
    }
    
    var filteredContextClusters: [ContextCluster] {
        guard showClusters else { return [] }
        
        let visibleNodeIds = Set(filteredContextNodes.map(\.id))
        
        return contextClusters.filter { cluster in
            !Set(cluster.members).isDisjoint(with: visibleNodeIds)
        }
    }
    
    var filteredMemoryEvents: [MemoryEvent] {
        let timeThreshold = Date().addingTimeInterval(-selectedTimeRange.timeInterval)
        let visibleContextIds = Set(filteredContextNodes.map(\.id))
        
        return memoryEvents.filter { event in
            event.timestamp >= timeThreshold &&
            visibleContextIds.contains(event.contextId)
        }
    }
}