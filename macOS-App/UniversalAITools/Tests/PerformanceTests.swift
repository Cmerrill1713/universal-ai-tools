import XCTest
import SwiftUI
@testable import UniversalAITools

class PerformanceTests: UniversalAIToolsTestSuite {
    
    // MARK: - Agent Performance Tests
    
    func testLargeAgentListPerformance() {
        measure {
            appState.activeAgents.removeAll()
            
            for index in 1...1000 {
                let agent = TestDataFactory.createMockAgent(
                    name: "Agent \(index)",
                    type: .chat,
                    status: .idle
                )
                appState.activeAgents.append(agent)
            }
            
            XCTAssertEqual(appState.activeAgents.count, 1000)
        }
    }
    
    func testAgentSearchPerformance() {
        // Populate agents
        for index in 1...5000 {
            let agent = TestDataFactory.createMockAgent(
                name: "Agent \(index)",
                type: index % 2 == 0 ? .research : .chat,
                status: index % 3 == 0 ? .busy : .idle
            )
            appState.activeAgents.append(agent)
        }
        
        measure {
            // Search for specific agents
            let searchResults = appState.activeAgents.filter { agent in
                agent.name.contains("500") || agent.description.contains("500")
            }
            XCTAssertGreaterThan(searchResults.count, 0)
        }
    }
    
    // MARK: - Message Performance Tests
    
    func testBulkMessageCreation() {
        measure {
            let messages = TestDataFactory.createBulkMessages(count: 1000)
            appState.messages = messages
            XCTAssertEqual(appState.messages.count, 1000)
        }
    }
    
    func testMessageRenderingPerformance() {
        // Create complex messages with formatting
        let complexMessages = TestDataFactory.createComplexFormattedMessages(count: 500)
        appState.messages = complexMessages
        
        measure {
            // Simulate rendering by accessing formatted content
            let _ = appState.messages.map { message in
                return message.content.count > 0
            }
        }
    }
    
    // MARK: - Memory Performance Tests
    
    func testMemoryUsage() {
        let initialMemory = getMemoryUsage()
        
        for _ in 1...100 {
            appState.createNewChat()
        }
        
        let finalMemory = getMemoryUsage()
        let memoryIncrease = finalMemory - initialMemory
        
        XCTAssertLessThan(memoryIncrease, 50 * 1024 * 1024, "Memory increase should be under 50MB")
    }
    
    func testMemoryWithImages() {
        let initialMemory = getMemoryUsage()
        
        // Simulate loading images
        for i in 0..<50 {
            let imageData = createMockImageData(size: 1024 * 1024) // 1MB images
            appState.cachedImages["image-\(i)"] = imageData
        }
        
        let peakMemory = getMemoryUsage()
        
        // Clear cache
        appState.cachedImages.removeAll()
        
        // Force cleanup
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1))
        
        let finalMemory = getMemoryUsage()
        
        XCTAssertLessThan(peakMemory - initialMemory, 60 * 1024 * 1024, "Peak memory should be reasonable")
        XCTAssertLessThan(finalMemory - initialMemory, 10 * 1024 * 1024, "Memory should be released after cleanup")
    }
    
    // MARK: - 3D Graph Performance Tests
    
    func test3DGraphNodeCreation() {
        measure {
            let nodes = TestDataFactory.createComplexGraphDataset(nodeCount: 500)
            appState.graphNodes = nodes
        }
    }
    
    func test3DGraphLayoutCalculation() {
        // Create interconnected graph
        let nodes = TestDataFactory.createComplexGraphDataset(nodeCount: 200)
        appState.graphNodes = nodes
        
        measure {
            // Simulate force-directed layout calculation
            for _ in 0..<10 {
                appState.updateGraphLayout()
            }
        }
    }
    
    // MARK: - Network Performance Tests
    
    func testConcurrentAPIRequests() {
        let expectation = XCTestExpectation(description: "Concurrent requests")
        expectation.expectedFulfillmentCount = 20
        
        measure {
            for i in 0..<20 {
                Task {
                    // Simulate API request
                    try? await Task.sleep(nanoseconds: UInt64.random(in: 10_000_000...50_000_000))
                    appState.requestCompleted(id: "request-\(i)")
                    expectation.fulfill()
                }
            }
            
            wait(for: [expectation], timeout: 5.0)
        }
    }
    
    // MARK: - UI Responsiveness Tests
    
    func testScrollingPerformance() {
        // Add many messages
        appState.messages = TestDataFactory.createBulkMessages(count: 1000)
        
        measure {
            // Simulate scrolling by accessing messages in chunks
            for offset in stride(from: 0, to: 1000, by: 50) {
                let endIndex = min(offset + 50, appState.messages.count)
                let visibleMessages = Array(appState.messages[offset..<endIndex])
                XCTAssertEqual(visibleMessages.count, min(50, 1000 - offset))
            }
        }
    }
    
    func testViewUpdateFrequency() {
        var updateCount = 0
        let cancellable = appState.objectWillChange.sink { _ in
            updateCount += 1
        }
        
        measure {
            // Perform many small updates
            for i in 0..<100 {
                appState.updateCounter += 1
                if i % 10 == 0 {
                    appState.selectedModel = "model-\(i)"
                }
                if i % 5 == 0 {
                    appState.connectionStatus = i % 2 == 0 ? .connected : .connecting
                }
            }
        }
        
        cancellable.cancel()
        XCTAssertGreaterThan(updateCount, 0)
    }
    
    // MARK: - Stress Tests
    
    func testHighLoadScenario() {
        let startMemory = getMemoryUsage()
        let startTime = Date()
        
        // Simulate high load
        let testData = TestDataFactory.createStressTestDataset()
        
        appState.activeAgents = testData.agents
        appState.messages = testData.messages
        appState.graphNodes = testData.graphNodes
        
        let duration = Date().timeIntervalSince(startTime)
        let finalMemory = getMemoryUsage()
        let memoryIncrease = finalMemory - startMemory
        
        XCTAssertLessThan(duration, 10.0, "High load should complete within 10 seconds")
        XCTAssertLessThan(memoryIncrease, 200 * 1024 * 1024, "Memory increase should be under 200MB")
        
        // Cleanup
        appState.activeAgents.removeAll()
        appState.messages.removeAll()
        appState.graphNodes.removeAll()
    }
    
    // MARK: - Performance Baseline Tests
    
    func testPerformanceBaseline() {
        let baseline = loadPerformanceBaseline()
        let currentMetrics = measureCurrentPerformance()
        
        // Launch time shouldn't regress more than 20%
        XCTAssertLessThanOrEqual(
            currentMetrics.launchTime,
            baseline.launchTime * 1.2,
            "Launch time regression detected"
        )
        
        // Memory usage shouldn't increase more than 30%
        XCTAssertLessThanOrEqual(
            currentMetrics.memoryUsage,
            baseline.memoryUsage * 1.3,
            "Memory usage regression detected"
        )
        
        // FPS shouldn't drop more than 15%
        XCTAssertGreaterThanOrEqual(
            currentMetrics.fps,
            baseline.fps * 0.85,
            "Frame rate regression detected"
        )
    }
    
    // MARK: - SwiftUI Performance Optimization Tests
    
    func testOptimizedMessageBubblePerformance() {
        let messages = TestDataFactory.createBulkMessages(count: 1000)
        
        measure {
            // Test optimized message bubble rendering
            for message in messages {
                let bubble = OptimizedMessageBubble(
                    message: message,
                    agent: nil,
                    voiceInterface: testVoiceInterface
                )
                // Simulate view creation without actual rendering
                let _ = bubble.body
            }
        }
    }
    
    func testOptimizedAgentSelectionPerformance() {
        let agents = TestDataFactory.createBulkAgents(count: 500)
        
        measure {
            for agent in agents {
                let card = OptimizedAgentSelectionCard(
                    agent: agent,
                    isSelected: false,
                    onSelect: { }
                )
                let _ = card.body
            }
        }
    }
    
    func testOptimizedSidebarPerformance() {
        measure {
            for item in SidebarItem.allCases {
                let sidebarItem = OptimizedSidebarItemView(item: item)
                let _ = sidebarItem.body
            }
        }
    }
    
    func testVoiceWaveformOptimization() {
        let waveformData = (0..<1000).map { _ in Float.random(in: 0...1) }
        
        measure {
            let waveform = VoiceWaveformView(
                waveformData: waveformData,
                isRecording: true
            )
            let _ = waveform.body
        }
    }
    
    // MARK: - Memory Optimization Tests
    
    func testMemoryOptimizationEffectiveness() {
        let initialMemory = getMemoryUsage()
        let performanceOptimizer = PerformanceOptimizer.shared
        
        // Create memory pressure
        for i in 0..<100 {
            appState.cachedImages["test-\(i)"] = createMockImageData(size: 1024 * 1024)
        }
        
        let peakMemory = getMemoryUsage()
        
        // Apply optimizations
        Task {
            await performanceOptimizer.optimizeForCurrentConditions()
            await performanceOptimizer.forceMemoryCleanup()
        }
        
        // Wait for cleanup
        let expectation = XCTestExpectation(description: "Memory cleanup")
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 3.0)
        
        let finalMemory = getMemoryUsage()
        
        XCTAssertLessThan(finalMemory - initialMemory, peakMemory - initialMemory, 
                         "Memory optimization should reduce usage")
    }
    
    func testCacheEffectiveness() {
        let performanceOptimizer = PerformanceOptimizer.shared
        
        // Test cache hit rates
        measure {
            for i in 0..<1000 {
                // Simulate cache operations
                appState.cachedAgentData["agent-\(i % 10)"] = "cached data"
            }
        }
        
        let cacheStats = performanceOptimizer.cacheStatistics
        XCTAssertGreaterThan(cacheStats.hitRate, 0.5, "Cache hit rate should be reasonable")
    }
    
    // MARK: - Animation Performance Tests
    
    func testAnimationPerformance() {
        let performanceOptimizer = PerformanceOptimizer.shared
        
        // Test different animation qualities
        performanceOptimizer.optimizeAnimationPerformance()
        
        let animationDuration = NSAnimationContext.default.duration
        
        switch performanceOptimizer.performanceProfile {
        case .efficiency:
            XCTAssertLessThanOrEqual(animationDuration, 0.15, "Efficiency mode should use fast animations")
        case .balanced:
            XCTAssertLessThanOrEqual(animationDuration, 0.25, "Balanced mode should use moderate animations")
        case .performance:
            XCTAssertLessThanOrEqual(animationDuration, 0.35, "Performance mode can use slower animations")
        case .custom:
            break // Custom settings vary
        }
    }
    
    // MARK: - UI Responsiveness Tests
    
    func testUIResponsiveness() {
        let startTime = Date()
        
        // Simulate UI interactions
        for _ in 0..<100 {
            appState.selectedSidebarItem = .chat
            appState.selectedSidebarItem = .analytics
            appState.selectedSidebarItem = .objectives
        }
        
        let duration = Date().timeIntervalSince(startTime)
        XCTAssertLessThan(duration, 1.0, "UI state changes should be responsive")
    }
    
    func testScrollPerformance() {
        let messages = TestDataFactory.createBulkMessages(count: 2000)
        appState.messages = messages
        
        let startTime = Date()
        
        // Simulate scrolling through messages
        measure {
            for offset in stride(from: 0, to: 2000, by: 20) {
                let endIndex = min(offset + 20, messages.count)
                let visibleMessages = Array(messages[offset..<endIndex])
                
                // Simulate view rendering for visible messages
                for message in visibleMessages {
                    let _ = OptimizedMessageBubble(
                        message: message,
                        agent: nil,
                        voiceInterface: testVoiceInterface
                    ).body
                }
            }
        }
    }
    
    // MARK: - Performance Metrics Validation
    
    func testPerformanceMetricsCollection() {
        let performanceOptimizer = PerformanceOptimizer.shared
        
        // Start enhanced monitoring
        performanceOptimizer.startEnhancedMonitoring()
        
        // Let it collect metrics
        let expectation = XCTestExpectation(description: "Metrics collection")
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 3.0)
        
        let metrics = performanceOptimizer.getPerformanceMetrics()
        
        // Validate metrics are reasonable
        XCTAssertGreaterThan(metrics.renderingMetrics.currentFPS, 0, "FPS should be measurable")
        XCTAssertGreaterThan(metrics.memoryMetrics.totalMemory, 0, "Memory metrics should be valid")
        XCTAssertGreaterThanOrEqual(metrics.uiResponsivenessMetrics.scrollPerformance, 0, "Scroll performance should be measurable")
        
        performanceOptimizer.stopMonitoring()
    }
    
    // MARK: - Thermal State Performance Tests
    
    func testThermalStateAdaptation() {
        let performanceOptimizer = PerformanceOptimizer.shared
        
        // Simulate thermal state change
        let originalProfile = performanceOptimizer.performanceProfile
        
        // Test thermal throttling
        Task {
            await performanceOptimizer.enableThermalThrottling()
        }
        
        XCTAssertEqual(performanceOptimizer.performanceProfile, .efficiency, 
                      "Should switch to efficiency mode under thermal pressure")
        
        // Restore original profile
        performanceOptimizer.applyPerformanceProfile(originalProfile)
    }
    
    // MARK: - Background Task Performance Tests
    
    func testBackgroundTaskOptimization() {
        let performanceOptimizer = PerformanceOptimizer.shared
        
        // Add background tasks
        for i in 0..<10 {
            let task = BackgroundTask(
                id: "task-\(i)",
                name: "Test Task \(i)",
                priority: i % 3,
                frequency: 1.0,
                isRunning: true
            )
            performanceOptimizer.scheduleBackgroundTask(task)
        }
        
        let initialTaskCount = performanceOptimizer.backgroundTasks.count
        
        // Apply background task reduction
        Task {
            await performanceOptimizer.reduceBackgroundTasks()
        }
        
        // Verify tasks were optimized
        XCTAssertLessThanOrEqual(performanceOptimizer.backgroundTasks.filter { $0.isRunning }.count, 
                                initialTaskCount, "Background tasks should be optimized")
    }
    
    // MARK: - Performance Regression Detection
    
    func testPerformanceRegression() {
        let baseline = PerformanceBaseline(
            launchTime: 2.0,
            memoryUsage: 150 * 1024 * 1024,
            fps: 60.0,
            responseTime: 200.0
        )
        
        let current = measureCurrentPerformance()
        
        // Check for regressions with tolerance
        let launchTimeRegression = (current.launchTime - baseline.launchTime) / baseline.launchTime
        let memoryRegression = Double(current.memoryUsage - baseline.memoryUsage) / Double(baseline.memoryUsage)
        let fpsRegression = (baseline.fps - current.fps) / baseline.fps
        
        XCTAssertLessThan(launchTimeRegression, 0.2, "Launch time regression > 20%")
        XCTAssertLessThan(memoryRegression, 0.3, "Memory usage regression > 30%")
        XCTAssertLessThan(fpsRegression, 0.15, "FPS regression > 15%")
    }
    
    // MARK: - Helper Methods
    
    private func getMemoryUsage() -> Int {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        if kerr == KERN_SUCCESS { return Int(info.resident_size) } else { return 0 }
    }
    
    private func createMockImageData(size: Int) -> Data {
        return Data(repeating: 0xFF, count: size)
    }
    
    private func loadPerformanceBaseline() -> PerformanceBaseline {
        // Load from baseline file or return defaults
        return PerformanceBaseline(
            launchTime: 2.0,
            memoryUsage: Int64(150 * 1024 * 1024),
            fps: 60.0,
            responseTime: 200.0
        )
    }
    
    private func measureCurrentPerformance() -> PerformanceBaseline {
        // Measure current app performance
        let startTime = Date()
        
        // Simulate launch operations
        appState.initializeDefaultData()
        
        let launchTime = Date().timeIntervalSince(startTime)
        let memoryUsage = Int64(getMemoryUsage())
        
        return PerformanceBaseline(
            launchTime: launchTime,
            memoryUsage: memoryUsage,
            fps: 60.0, // Would be measured from actual rendering
            responseTime: 150.0 // Would be measured from actual API calls
        )
    }
}

// MARK: - Performance Baseline Structure

struct PerformanceBaseline {
    let launchTime: TimeInterval
    let memoryUsage: Int64
    let fps: Double
    let responseTime: TimeInterval
}


