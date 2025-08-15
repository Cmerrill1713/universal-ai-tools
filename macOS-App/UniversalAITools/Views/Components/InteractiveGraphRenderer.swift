import SwiftUI
import SceneKit
import simd
import Combine
import OSLog

/// High-performance 3D graph renderer using SceneKit for macOS
struct InteractiveGraphRenderer: NSViewRepresentable {
    @ObservedObject var graphState: GraphState
    let onNodeSelected: (String) -> Void
    let onNodeDoubleClicked: (String) -> Void
    let onEdgeSelected: (String) -> Void
    
    func makeNSView(context: Context) -> SCNView {
        let scnView = SCNView()
        scnView.allowsCameraControl = true
        scnView.showsStatistics = false
        scnView.backgroundColor = NSColor.clear
        scnView.autoenablesDefaultLighting = true
        
        // Create scene
        let scene = SCNScene()
        scnView.scene = scene
        
        // Setup camera
        let cameraNode = SCNNode()
        cameraNode.camera = SCNCamera()
        cameraNode.position = SCNVector3(x: 0, y: 0, z: 10)
        scene.rootNode.addChildNode(cameraNode)
        
        // Setup the renderer
        let renderer = GraphRenderer(
            scnView: scnView,
            scene: scene,
            graphState: graphState,
            onNodeSelected: onNodeSelected,
            onNodeDoubleClicked: onNodeDoubleClicked,
            onEdgeSelected: onEdgeSelected
        )
        
        context.coordinator.renderer = renderer
        renderer.setupScene()
        
        return scnView
    }
    
    func updateNSView(_ nsView: SCNView, context: Context) {
        context.coordinator.renderer?.updateGraph()
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator {
        var renderer: GraphRenderer?
    }
}

/// Core graph rendering engine
@MainActor
class GraphRenderer: ObservableObject {
    private let logger = Logger(subsystem: "com.universalai.tools", category: "GraphRenderer")
    
    private let scnView: SCNView
    private let scene: SCNScene
    private let graphState: GraphState
    private let onNodeSelected: (String) -> Void
    private let onNodeDoubleClicked: (String) -> Void
    private let onEdgeSelected: (String) -> Void
    
    // Scene management
    private var nodesContainer: SCNNode
    private var edgesContainer: SCNNode
    private var clustersContainer: SCNNode
    
    // Entity tracking
    private var nodeNodes: [String: SCNNode] = [:]
    private var edgeNodes: [String: SCNNode] = [:]
    private var clusterNodes: [String: SCNNode] = [:]
    
    // Layout engine
    private var layoutEngine: LayoutEngine
    
    init(
        scnView: SCNView,
        scene: SCNScene,
        graphState: GraphState,
        onNodeSelected: @escaping (String) -> Void,
        onNodeDoubleClicked: @escaping (String) -> Void,
        onEdgeSelected: @escaping (String) -> Void
    ) {
        self.scnView = scnView
        self.scene = scene
        self.graphState = graphState
        self.onNodeSelected = onNodeSelected
        self.onNodeDoubleClicked = onNodeDoubleClicked
        self.onEdgeSelected = onEdgeSelected
        
        // Initialize containers
        self.nodesContainer = SCNNode()
        self.edgesContainer = SCNNode()
        self.clustersContainer = SCNNode()
        
        // Initialize subsystems
        self.layoutEngine = LayoutEngine()
        
        setupSceneHierarchy()
        setupObservers()
    }
    
    // MARK: - Scene Setup
    
    func setupScene() {
        // Configure lighting
        setupLighting()
        
        // Initial render
        updateGraph()
        
        logger.info("3D graph scene initialized")
    }
    
    private func setupSceneHierarchy() {
        nodesContainer.name = "NodesContainer"
        edgesContainer.name = "EdgesContainer"
        clustersContainer.name = "ClustersContainer"
        
        scene.rootNode.addChildNode(clustersContainer)
        scene.rootNode.addChildNode(edgesContainer)
        scene.rootNode.addChildNode(nodesContainer)
    }
    
    private func setupLighting() {
        // Ambient light
        let ambientLight = SCNLight()
        ambientLight.type = .ambient
        ambientLight.color = NSColor.white
        ambientLight.intensity = 200
        
        let ambientNode = SCNNode()
        ambientNode.light = ambientLight
        scene.rootNode.addChildNode(ambientNode)
        
        // Directional light
        let directionalLight = SCNLight()
        directionalLight.type = .directional
        directionalLight.color = NSColor.white
        directionalLight.intensity = 800
        
        let directionalNode = SCNNode()
        directionalNode.light = directionalLight
        directionalNode.position = SCNVector3(x: 5, y: 5, z: 5)
        directionalNode.look(at: SCNVector3Zero)
        scene.rootNode.addChildNode(directionalNode)
    }
    
    private func setupObservers() {
        // Observe graph state changes
        graphState.$nodes.sink { [weak self] _ in
            Task { @MainActor in
                self?.updateNodes()
            }
        }.store(in: &cancellables)
        
        graphState.$edges.sink { [weak self] _ in
            Task { @MainActor in
                self?.updateEdges()
            }
        }.store(in: &cancellables)
        
        graphState.$clusters.sink { [weak self] _ in
            Task { @MainActor in
                self?.updateClusters()
            }
        }.store(in: &cancellables)
    }
    
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Graph Updates
    
    func updateGraph() {
        updateNodes()
        updateEdges()
        updateClusters()
    }
    
    private func updateNodes() {
        // Clear existing nodes
        nodesContainer.childNodes.forEach { $0.removeFromParentNode() }
        nodeNodes.removeAll()
        
        // Add new nodes
        for node in graphState.visibleNodes {
            addNode(node)
        }
    }
    
    private func addNode(_ node: GraphNode) {
        let nodeGeometry = SCNSphere(radius: CGFloat(max(node.size * 0.1, 0.05)))
        let nodeMaterial = SCNMaterial()
        nodeMaterial.diffuse.contents = NSColor(node.color)
        nodeGeometry.materials = [nodeMaterial]
        
        let nodeNode = SCNNode(geometry: nodeGeometry)
        nodeNode.position = SCNVector3(node.position.x, node.position.y, node.position.z)
        nodeNode.name = node.id
        
        nodeNodes[node.id] = nodeNode
        nodesContainer.addChildNode(nodeNode)
    }
    
    private func updateEdges() {
        // Clear existing edges
        edgesContainer.childNodes.forEach { $0.removeFromParentNode() }
        edgeNodes.removeAll()
        
        // Add new edges
        for edge in graphState.visibleEdges {
            addEdge(edge)
        }
    }
    
    private func addEdge(_ edge: GraphEdge) {
        guard let sourceNode = nodeNodes[edge.source],
              let targetNode = nodeNodes[edge.target] else {
            return
        }
        
        let distance = sourceNode.position.distance(to: targetNode.position)
        let edgeGeometry = SCNCylinder(radius: CGFloat(max(edge.thickness * 0.005, 0.001)), height: CGFloat(distance))
        let edgeMaterial = SCNMaterial()
        edgeMaterial.diffuse.contents = NSColor(edge.color)
        edgeGeometry.materials = [edgeMaterial]
        
        let edgeNode = SCNNode(geometry: edgeGeometry)
        
        // Position and orient the edge
        let midpoint = SCNVector3(
            (sourceNode.position.x + targetNode.position.x) / 2,
            (sourceNode.position.y + targetNode.position.y) / 2,
            (sourceNode.position.z + targetNode.position.z) / 2
        )
        edgeNode.position = midpoint
        
        // Orient the edge to point from source to target
        edgeNode.look(at: targetNode.position, up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 1, 0))
        
        edgeNode.name = edge.id
        edgeNodes[edge.id] = edgeNode
        edgesContainer.addChildNode(edgeNode)
    }
    
    private func updateClusters() {
        // Clear existing clusters
        clustersContainer.childNodes.forEach { $0.removeFromParentNode() }
        clusterNodes.removeAll()
        
        // Add new clusters
        for cluster in graphState.clusters {
            addCluster(cluster)
        }
    }
    
    private func addCluster(_ cluster: GraphCluster) {
        let clusterGeometry = SCNSphere(radius: CGFloat(cluster.radius))
        let clusterMaterial = SCNMaterial()
        clusterMaterial.diffuse.contents = NSColor(cluster.color).withAlphaComponent(0.1)
        clusterMaterial.transparency = 0.1
        clusterGeometry.materials = [clusterMaterial]
        
        let clusterNode = SCNNode(geometry: clusterGeometry)
        clusterNode.position = SCNVector3(cluster.centroid.x, cluster.centroid.y, cluster.centroid.z)
        clusterNode.name = cluster.id
        
        clusterNodes[cluster.id] = clusterNode
        clustersContainer.addChildNode(clusterNode)
    }
}

// MARK: - Supporting Systems

extension SCNVector3 {
    func distance(to vector: SCNVector3) -> Float {
        let dx = x - vector.x
        let dy = y - vector.y
        let dz = z - vector.z
        let dxSquared = dx * dx
        let dySquared = dy * dy
        let dzSquared = dz * dz
        return Float(sqrt(dxSquared + dySquared + dzSquared))
    }
}

class LayoutEngine {
    func applyLayout(
        layout: GraphLayout,
        nodes: [GraphNode],
        edges: [GraphEdge],
        onPositionsCalculated: @escaping ([String: SIMD3<Float>]) -> Void
    ) {
        // Simple layout implementations
        switch layout {
        case .force:
            applyForceDirectedLayout(nodes: nodes, completion: onPositionsCalculated)
        case .circular:
            applyCircularLayout(nodes: nodes, completion: onPositionsCalculated)
        default:
            applyCircularLayout(nodes: nodes, completion: onPositionsCalculated)
        }
    }
    
    private func applyForceDirectedLayout(
        nodes: [GraphNode],
        completion: @escaping ([String: SIMD3<Float>]) -> Void
    ) {
        var positions: [String: SIMD3<Float>] = [:]
        
        // Simple sphere distribution
        for (index, node) in nodes.enumerated() {
            let angle = Float(index) * 2 * .pi / Float(nodes.count)
            let radius: Float = 5.0
            positions[node.id] = SIMD3<Float>(
                cos(angle) * radius,
                sin(angle) * radius,
                Float.random(in: -2...2)
            )
        }
        
        completion(positions)
    }
    
    private func applyCircularLayout(
        nodes: [GraphNode],
        completion: @escaping ([String: SIMD3<Float>]) -> Void
    ) {
        var positions: [String: SIMD3<Float>] = [:]
        
        for (index, node) in nodes.enumerated() {
            let angle = Float(index) * 2 * .pi / Float(nodes.count)
            let radius: Float = 8.0
            positions[node.id] = SIMD3<Float>(
                cos(angle) * radius,
                sin(angle) * radius,
                0
            )
        }
        
        completion(positions)
    }
}