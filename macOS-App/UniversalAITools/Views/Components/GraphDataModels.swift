import Foundation
import SwiftUI
import simd

// MARK: - Core Graph Data Models

/// Represents a node in the knowledge graph
struct GraphNode: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let type: NodeType
    let position: SIMD3<Float>
    let connections: [String] // IDs of connected nodes
    let metadata: NodeMetadata
    
    // Visual properties
    var size: Float { metadata.importance * 2.0 + 1.0 }
    var color: Color { type.color }
    
    enum NodeType: String, Codable, CaseIterable {
        case concept = "concept"
        case entity = "entity"
        case document = "document"
        case code = "code"
        case project = "project"
        case person = "person"
        case organization = "organization"
        case location = "location"
        case event = "event"
        case topic = "topic"
        
        var color: Color {
            switch self {
            case .concept: return .blue
            case .entity: return .green
            case .document: return .orange
            case .code: return .purple
            case .project: return .red
            case .person: return .pink
            case .organization: return .yellow
            case .location: return .teal
            case .event: return .indigo
            case .topic: return .cyan
            }
        }
        
        var icon: String {
            switch self {
            case .concept: return "lightbulb"
            case .entity: return "cube"
            case .document: return "doc"
            case .code: return "curlybraces"
            case .project: return "folder"
            case .person: return "person"
            case .organization: return "building"
            case .location: return "location"
            case .event: return "calendar"
            case .topic: return "tag"
            }
        }
    }
}

struct NodeMetadata: Codable, Hashable {
    let content: String
    let summary: String
    let importance: Float // 0.0 to 1.0
    let centrality: Float // Graph centrality measure
    let clusterId: String?
    let tags: [String]
    let createdAt: Date
    let lastAccessed: Date
    let accessCount: Int
    
    static let empty = NodeMetadata(
        content: "",
        summary: "",
        importance: 0.5,
        centrality: 0.0,
        clusterId: nil,
        tags: [],
        createdAt: Date(),
        lastAccessed: Date(),
        accessCount: 0
    )
}

/// Represents an edge connecting two nodes
struct GraphEdge: Identifiable, Codable, Hashable {
    let id: String
    let source: String // Source node ID
    let target: String // Target node ID
    let weight: Float // 0.0 to 1.0
    let type: EdgeType
    let relationship: String
    let bidirectional: Bool
    let metadata: EdgeMetadata
    
    var color: Color { type.color.opacity(Double(weight)) }
    var thickness: Float { weight * 3.0 + 0.5 }
    
    enum EdgeType: String, Codable, CaseIterable {
        case semantic = "semantic"
        case hierarchical = "hierarchical"
        case temporal = "temporal"
        case causal = "causal"
        case spatial = "spatial"
        case functional = "functional"
        case dependency = "dependency"
        case similarity = "similarity"
        case reference = "reference"
        case collaboration = "collaboration"
        
        var color: Color {
            switch self {
            case .semantic: return .blue
            case .hierarchical: return .green
            case .temporal: return .orange
            case .causal: return .red
            case .spatial: return .purple
            case .functional: return .cyan
            case .dependency: return .yellow
            case .similarity: return .pink
            case .reference: return .gray
            case .collaboration: return .indigo
            }
        }
    }
}

struct EdgeMetadata: Codable, Hashable {
    let description: String
    let confidence: Float // 0.0 to 1.0
    let evidence: [String] // Supporting evidence
    let createdAt: Date
    let strength: Float // Relationship strength
    
    static let empty = EdgeMetadata(
        description: "",
        confidence: 0.5,
        evidence: [],
        createdAt: Date(),
        strength: 0.5
    )
}

/// Represents a cluster of related nodes
struct GraphCluster: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let nodes: [String] // Node IDs in this cluster
    let centroid: SIMD3<Float>
    let communityId: String
    let color: Color
    let density: Float // 0.0 to 1.0
    let coherence: Float // How well-connected nodes are
    let metadata: ClusterMetadata
    
    // Non-codable computed properties
    var radius: Float { sqrt(Float(nodes.count)) * 2.0 }
    
    enum CodingKeys: String, CodingKey {
        case id, name, nodes, centroid, communityId, density, coherence, metadata
    }
}

extension GraphCluster {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        nodes = try container.decode([String].self, forKey: .nodes)
        centroid = try container.decode(SIMD3<Float>.self, forKey: .centroid)
        communityId = try container.decode(String.self, forKey: .communityId)
        density = try container.decode(Float.self, forKey: .density)
        coherence = try container.decode(Float.self, forKey: .coherence)
        metadata = try container.decode(ClusterMetadata.self, forKey: .metadata)
        
        // Generate color from community ID for consistency
        color = Color(hue: Double(abs(communityId.hashValue) % 360) / 360.0,
                     saturation: 0.7,
                     brightness: 0.8)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(nodes, forKey: .nodes)
        try container.encode(centroid, forKey: .centroid)
        try container.encode(communityId, forKey: .communityId)
        try container.encode(density, forKey: .density)
        try container.encode(coherence, forKey: .coherence)
        try container.encode(metadata, forKey: .metadata)
    }
}

struct ClusterMetadata: Codable, Hashable {
    let description: String
    let keywords: [String]
    let dominantTypes: [GraphNode.NodeType]
    let createdAt: Date
    let size: Int
}

/// Layout algorithms for positioning nodes
enum GraphLayout: String, Codable, CaseIterable {
    case force = "force"
    case hierarchy = "hierarchy"
    case circular = "circular"
    case grid = "grid"
    case custom = "custom"
    case organic = "organic"
    case spring = "spring"
    case fruchtermanReingold = "fruchterman_reingold"
    
    var displayName: String {
        switch self {
        case .force: return "Force-Directed"
        case .hierarchy: return "Hierarchical"
        case .circular: return "Circular"
        case .grid: return "Grid"
        case .custom: return "Custom"
        case .organic: return "Organic"
        case .spring: return "Spring"
        case .fruchtermanReingold: return "Fruchterman-Reingold"
        }
    }
}

/// Query result containing graph paths and reasoning
struct GraphQueryResult: Codable {
    let paths: [GraphPath]
    let nodes: [GraphNode]
    let relationships: [GraphEdge]
    let reasoning: QueryReasoning
    let metadata: QueryMetadata
}

struct GraphPath: Identifiable, Codable {
    let id: String
    let nodeIds: [String]
    let edgeIds: [String]
    let weight: Float
    let semanticSimilarity: Float
    let pathType: PathType
    
    enum PathType: String, Codable {
        case shortest = "shortest"
        case semantic = "semantic"
        case temporal = "temporal"
        case causal = "causal"
        case influential = "influential"
    }
}

struct QueryReasoning: Codable {
    let explanation: String
    let confidence: Float
    let steps: [ReasoningStep]
    let assumptions: [String]
}

struct ReasoningStep: Codable {
    let description: String
    let evidence: [String]
    let confidence: Float
}

struct QueryMetadata: Codable {
    let query: String
    let executionTime: Double
    let nodesExamined: Int
    let pathsFound: Int
    let timestamp: Date
    let requestId: String
}

// MARK: - Graph State Management

@MainActor
class GraphState: ObservableObject {
    @Published var nodes: [GraphNode] = []
    @Published var edges: [GraphEdge] = []
    @Published var clusters: [GraphCluster] = []
    @Published var selectedNodes: Set<String> = []
    @Published var highlightedPath: [String] = []
    @Published var currentLayout: GraphLayout = .force
    @Published var isLoading = false
    @Published var searchQuery = ""
    @Published var filterTypes: Set<GraphNode.NodeType> = Set(GraphNode.NodeType.allCases)
    
    // Camera and interaction state
    @Published var cameraPosition: SIMD3<Float> = SIMD3<Float>(0, 0, 10)
    @Published var cameraRotation: simd_quatf = simd_quatf(ix: 0, iy: 0, iz: 0, r: 1)
    @Published var zoomLevel: Float = 1.0
    
    // Animation state
    @Published var isAnimating = false
    @Published var animationProgress: Float = 0.0
    
    // Performance settings
    @Published var maxVisibleNodes = 1000
    @Published var lodEnabled = true // Level of detail
    @Published var enablePhysics = true
    
    var visibleNodes: [GraphNode] {
        nodes.filter { node in
            filterTypes.contains(node.type) &&
            (searchQuery.isEmpty || 
             node.title.localizedCaseInsensitiveContains(searchQuery) ||
             node.metadata.tags.contains { $0.localizedCaseInsensitiveContains(searchQuery) })
        }.prefix(maxVisibleNodes).map { $0 }
    }
    
    var visibleEdges: [GraphEdge] {
        let visibleNodeIds = Set(visibleNodes.map { $0.id })
        return edges.filter { edge in
            visibleNodeIds.contains(edge.source) && visibleNodeIds.contains(edge.target)
        }
    }
    
    func selectNode(_ nodeId: String) {
        if selectedNodes.contains(nodeId) {
            selectedNodes.remove(nodeId)
        } else {
            selectedNodes.insert(nodeId)
        }
    }
    
    func clearSelection() {
        selectedNodes.removeAll()
        highlightedPath.removeAll()
    }
    
    func highlightPath(_ path: [String]) {
        highlightedPath = path
    }
    
    func updateLayout(_ layout: GraphLayout) {
        currentLayout = layout
        // Trigger layout algorithm recalculation
    }
    
    func addNode(_ node: GraphNode) {
        nodes.append(node)
    }
    
    func removeNode(_ nodeId: String) {
        nodes.removeAll { $0.id == nodeId }
        edges.removeAll { $0.source == nodeId || $0.target == nodeId }
    }
    
    func addEdge(_ edge: GraphEdge) {
        edges.append(edge)
    }
    
    func updateClusters(_ newClusters: [GraphCluster]) {
        clusters = newClusters
    }
}

// MARK: - Extensions for SIMD3<Float> Codable Support

extension SIMD3: Codable where Scalar: Codable {
    public init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        let x = try container.decode(Scalar.self)
        let y = try container.decode(Scalar.self)
        let z = try container.decode(Scalar.self)
        self.init(x, y, z)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.unkeyedContainer()
        try container.encode(self.x)
        try container.encode(self.y)
        try container.encode(self.z)
    }
}

// MARK: - Graph Analytics Extensions

extension GraphState {
    /// Calculate centrality measures for nodes
    func calculateCentrality() -> [String: Float] {
        var centrality: [String: Float] = [:]
        
        for node in nodes {
            let connections = edges.filter { $0.source == node.id || $0.target == node.id }
            centrality[node.id] = Float(connections.count) / Float(nodes.count)
        }
        
        return centrality
    }
    
    /// Find shortest path between two nodes
    func shortestPath(from sourceId: String, to targetId: String) -> [String]? {
        var queue: [(String, [String])] = [(sourceId, [sourceId])]
        var visited: Set<String> = [sourceId]
        
        while !queue.isEmpty {
            let (currentId, path) = queue.removeFirst()
            
            if currentId == targetId {
                return path
            }
            
            let neighbors = edges.compactMap { edge -> String? in
                if edge.source == currentId && !visited.contains(edge.target) {
                    return edge.target
                } else if edge.target == currentId && edge.bidirectional && !visited.contains(edge.source) {
                    return edge.source
                }
                return nil
            }
            
            for neighbor in neighbors {
                visited.insert(neighbor)
                queue.append((neighbor, path + [neighbor]))
            }
        }
        
        return nil
    }
    
    /// Get neighbors of a node
    func neighbors(of nodeId: String) -> [String] {
        return edges.compactMap { edge in
            if edge.source == nodeId {
                return edge.target
            } else if edge.target == nodeId && edge.bidirectional {
                return edge.source
            }
            return nil
        }
    }
}