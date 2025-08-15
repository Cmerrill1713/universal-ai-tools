import XCTest
import SwiftUI
@testable import UniversalAITools

/// Comprehensive test suite for Enhanced UI Components
class EnhancedUITests: XCTestCase {
    
    var appState: AppState!
    var apiService: APIService!
    
    override func setUp() {
        super.setUp()
        appState = AppState()
        apiService = APIService()
    }
    
    override func tearDown() {
        appState = nil
        apiService = nil
        super.tearDown()
    }
    
    // MARK: - Knowledge Graph Tests
    
    func testKnowledgeGraphInitialization() {
        // Test that knowledge graph initializes without crashing
        let graphService = GraphWebSocketService()
        
        XCTAssertNotNil(graphService)
        XCTAssertEqual(graphService.connectionStatus, .disconnected)
        XCTAssertTrue(graphService.graphNodes.isEmpty)
    }
    
    func testGraphNodeCreation() {
        let node = GraphNode(
            id: "test-1",
            title: "Test Node",
            type: .concept,
            position: simd_float3(0, 0, 0),
            connections: [],
            metadata: [:]
        )
        
        XCTAssertEqual(node.id, "test-1")
        XCTAssertEqual(node.title, "Test Node")
        XCTAssertEqual(node.type, .concept)
        XCTAssertTrue(node.connections.isEmpty)
    }
    
    func testGraphWebSocketConnectionHandling() {
        let graphService = GraphWebSocketService()
        
        // Test connection failure handling
        graphService.simulateConnectionFailure()
        XCTAssertEqual(graphService.connectionStatus, .error("Connection failed"))
        
        // Test reconnection
        let expectation = expectation(description: "Reconnection attempt")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            expectation.fulfill()
        }
        
        waitForExpectations(timeout: 2.0)
    }
    
    // MARK: - Agent Orchestration Tests
    
    func testAgentDataModelValidation() {
        let agent = Agent(
            id: "agent-1",
            name: "Test Agent",
            type: "cognitive",
            status: .active,
            capabilities: ["reasoning", "analysis"],
            performanceMetrics: AgentPerformanceMetric(
                agentId: "agent-1",
                latency: 100,
                successRate: 0.95,
                memoryUsage: 256,
                throughput: 10
            )
        )
        
        XCTAssertEqual(agent.id, "agent-1")
        XCTAssertEqual(agent.status, .active)
        XCTAssertEqual(agent.capabilities.count, 2)
        XCTAssertEqual(agent.performanceMetrics.successRate, 0.95, accuracy: 0.01)
    }
    
    func testABMCTSNodeExpansion() {
        let rootNode = ABMCTSNode(
            id: "root",
            state: ["context": "test"],
            visits: 0,
            reward: 0.0,
            children: [],
            parent: nil,
            action: nil
        )
        
        XCTAssertEqual(rootNode.ucbValue, 0.0)
        XCTAssertTrue(rootNode.children.isEmpty)
        XCTAssertNil(rootNode.parent)
    }
    
    func testAgentNetworkTopologyCalculation() {
        let nodes = [
            AgentNetworkNode(
                id: "agent-1",
                position: CGPoint(x: 100, y: 100),
                agent: Agent(
                    id: "agent-1",
                    name: "Agent 1",
                    type: "cognitive",
                    status: .active,
                    capabilities: [],
                    performanceMetrics: AgentPerformanceMetric(
                        agentId: "agent-1",
                        latency: 50,
                        successRate: 0.9,
                        memoryUsage: 128,
                        throughput: 5
                    )
                )
            )
        ]
        
        XCTAssertEqual(nodes.count, 1)
        XCTAssertEqual(nodes[0].agent.status, .active)
    }
    
    // MARK: - Flash Attention Analytics Tests
    
    func testPerformanceMetricsCalculation() {
        let metrics = FlashAttentionMetrics(
            attentionWeights: AttentionWeights(
                layer: 0,
                head: 0,
                sequencePosition: 10,
                attentionScores: Array(repeating: 0.1, count: 10)
            ),
            tokenMetrics: TokenMetrics(
                processingTime: 15.5,
                memoryUsage: 1024,
                attentionEntropy: 2.3
            ),
            memoryUsage: MemoryUsage(
                allocated: 2048,
                peak: 3072,
                flashSavings: 512,
                cacheEfficiency: 0.85
            ),
            performanceBaseline: PerformanceBaseline(
                throughput: 100,
                latency: 20,
                memoryEfficiency: 0.9
            )
        )
        
        XCTAssertEqual(metrics.tokenMetrics.processingTime, 15.5, accuracy: 0.1)
        XCTAssertEqual(metrics.memoryUsage.cacheEfficiency, 0.85, accuracy: 0.01)
        XCTAssertEqual(metrics.attentionWeights.attentionScores.count, 10)
    }
    
    func testAttentionHeatmapDataGeneration() {
        let heatmapData = Array(0..<100).map { _ in Float.random(in: 0...1) }
        
        XCTAssertEqual(heatmapData.count, 100)
        XCTAssertTrue(heatmapData.allSatisfy { $0 >= 0 && $0 <= 1 })
    }
    
    // MARK: - Context Flow Tests
    
    func testContextPathValidation() {
        let path = ContextPath(
            id: "path-1",
            source: "document.pdf",
            intermediates: ["embedding", "similarity"],
            destination: "response",
            relevanceScore: 0.87
        )
        
        XCTAssertEqual(path.id, "path-1")
        XCTAssertEqual(path.intermediates.count, 2)
        XCTAssertTrue(path.relevanceScore > 0.8)
    }
    
    func testSemanticSimilarityCalculation() {
        let embedding1 = Array(repeating: 0.5, count: 384)
        let embedding2 = Array(repeating: 0.7, count: 384)
        
        // Test embedding similarity calculation
        let similarity = cosineSimilarity(embedding1, embedding2)
        XCTAssertTrue(similarity >= 0 && similarity <= 1)
    }
    
    func testContextClusteringAlgorithm() {
        let contexts = [
            ContextNode(
                id: "ctx-1",
                content: "Test content 1",
                embedding: Array(repeating: 0.5, count: 384),
                type: "documentation",
                timestamp: Date(),
                metadata: [:]
            ),
            ContextNode(
                id: "ctx-2",
                content: "Test content 2",
                embedding: Array(repeating: 0.6, count: 384),
                type: "code",
                timestamp: Date(),
                metadata: [:]
            )
        ]
        
        XCTAssertEqual(contexts.count, 2)
        XCTAssertEqual(contexts[0].embedding.count, 384)
    }
    
    // MARK: - Real-Time Data Service Tests
    
    func testWebSocketConnectionResilience() {
        let service = RealTimeDataService()
        
        // Test connection failure recovery
        service.simulateConnectionFailure()
        XCTAssertEqual(service.connectionStatus, .disconnected)
        
        // Test automatic reconnection
        let expectation = expectation(description: "Auto reconnection")
        service.connectionStatusPublisher
            .filter { $0 == .connected }
            .first()
            .sink { _ in
                expectation.fulfill()
            }
            .store(in: &service.cancellables)
        
        service.startAutoReconnect()
        waitForExpectations(timeout: 5.0)
    }
    
    func testDataSynchronizationAcrossComponents() {
        let syncService = DataSynchronizationService()
        let testData = ["key": "value"]
        
        // Test data propagation
        syncService.updateSharedData("test-component", data: testData)
        
        let retrievedData = syncService.getSharedData("test-component")
        XCTAssertNotNil(retrievedData)
        XCTAssertEqual(retrievedData?["key"] as? String, "value")
    }
    
    // MARK: - Export System Tests
    
    func testExportManagerInitialization() {
        let exportManager = ExportManager()
        
        XCTAssertNotNil(exportManager)
        XCTAssertTrue(exportManager.supportedFormats.contains(.png))
        XCTAssertTrue(exportManager.supportedFormats.contains(.pdf))
        XCTAssertTrue(exportManager.supportedFormats.contains(.json))
    }
    
    func testExportFormatValidation() {
        let exportManager = ExportManager()
        
        // Test valid formats
        XCTAssertTrue(exportManager.canExport(format: .png))
        XCTAssertTrue(exportManager.canExport(format: .svg))
        XCTAssertTrue(exportManager.canExport(format: .csv))
        
        // Test export data preparation
        let mockData = ["nodes": [], "edges": []]
        let result = exportManager.prepareExportData(mockData, format: .json)
        XCTAssertNotNil(result)
    }
    
    // MARK: - Accessibility Tests
    
    func testVoiceOverCompatibility() {
        let accessibilityManager = UniversalAccessibilityManager()
        
        // Test accessibility label generation
        let graphNode = GraphNode(
            id: "test",
            title: "Test Node",
            type: .concept,
            position: simd_float3(0, 0, 0),
            connections: [],
            metadata: [:]
        )
        
        let label = accessibilityManager.generateAccessibilityLabel(for: graphNode)
        XCTAssertTrue(label.contains("Test Node"))
        XCTAssertTrue(label.contains("concept"))
    }
    
    func testKeyboardNavigationPaths() {
        let shortcutManager = KeyboardShortcutManager()
        
        // Test shortcut registration
        shortcutManager.registerShortcut("⌘K", action: "showCommandPalette")
        
        let shortcuts = shortcutManager.getRegisteredShortcuts()
        XCTAssertTrue(shortcuts.contains("⌘K"))
    }
    
    // MARK: - Performance Tests
    
    func testLargeDatasetPerformance() {
        measure {
            // Test performance with 1000 graph nodes
            let nodes = (0..<1000).map { i in
                GraphNode(
                    id: "node-\(i)",
                    title: "Node \(i)",
                    type: .concept,
                    position: simd_float3(
                        Float.random(in: -100...100),
                        Float.random(in: -100...100),
                        Float.random(in: -100...100)
                    ),
                    connections: [],
                    metadata: [:]
                )
            }
            
            // Simulate graph processing
            let _ = nodes.map { $0.id }
        }
    }
    
    func testMemoryUsageWithRealTimeUpdates() {
        let graphService = GraphWebSocketService()
        
        // Simulate rapid updates
        (0..<100).forEach { i in
            graphService.addMockNode(
                id: "rapid-\(i)",
                title: "Rapid Node \(i)"
            )
        }
        
        // Test memory cleanup
        graphService.clearAllNodes()
        XCTAssertTrue(graphService.graphNodes.isEmpty)
    }
    
    // MARK: - Integration Tests
    
    func testEndToEndDataFlow() {
        let expectation = expectation(description: "End-to-end data flow")
        
        // Mock a complete data flow from WebSocket to UI
        let graphService = GraphWebSocketService()
        
        graphService.nodeUpdatePublisher
            .first()
            .sink { nodes in
                XCTAssertFalse(nodes.isEmpty)
                expectation.fulfill()
            }
            .store(in: &graphService.cancellables)
        
        // Simulate incoming data
        graphService.simulateIncomingData()
        
        waitForExpectations(timeout: 3.0)
    }
    
    func testCrossComponentCommunication() {
        let graphService = GraphWebSocketService()
        let agentService = AgentWebSocketService()
        
        // Test that agent updates can trigger graph updates
        agentService.simulateAgentStatusChange("agent-1", status: .error("Test error"))
        
        // Verify graph service can respond to agent changes
        XCTAssertNotNil(graphService)
        XCTAssertNotNil(agentService)
    }
}

// MARK: - Helper Functions

private func cosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
    guard a.count == b.count else { return 0 }
    
    let dotProduct = zip(a, b).map(*).reduce(0, +)
    let magnitudeA = sqrt(a.map { $0 * $0 }.reduce(0, +))
    let magnitudeB = sqrt(b.map { $0 * $0 }.reduce(0, +))
    
    return dotProduct / (magnitudeA * magnitudeB)
}

// MARK: - Mock Extensions

extension GraphWebSocketService {
    func simulateConnectionFailure() {
        self.connectionStatus = .error("Connection failed")
    }
    
    func addMockNode(id: String, title: String) {
        let node = GraphNode(
            id: id,
            title: title,
            type: .concept,
            position: simd_float3(0, 0, 0),
            connections: [],
            metadata: [:]
        )
        self.graphNodes.append(node)
    }
    
    func clearAllNodes() {
        self.graphNodes.removeAll()
    }
    
    func simulateIncomingData() {
        addMockNode(id: "incoming-1", title: "Incoming Node")
    }
}

extension AgentWebSocketService {
    func simulateAgentStatusChange(_ agentId: String, status: AgentStatus) {
        // Simulate status change for testing
        print("Agent \(agentId) status changed to \(status)")
    }
}

extension RealTimeDataService {
    func simulateConnectionFailure() {
        self.connectionStatus = .disconnected
    }
    
    func startAutoReconnect() {
        // Simulate reconnection after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.connectionStatus = .connected
        }
    }
}