import XCTest

class PerformanceTests: UniversalAIToolsTestSuite {
    func testLargeAgentListPerformance() {
        let startTime = CFAbsoluteTimeGetCurrent()
        for index in 1...1000 {
            let agent = Agent(
                id: "agent-\(index)",
                name: "Agent \(index)",
                type: "Cognitive",
                description: "Performance test agent \(index)",
                capabilities: ["capability1", "capability2"],
                status: .active
            )
            appState.activeAgents.append(agent)
        }
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        XCTAssertEqual(appState.activeAgents.count, 1000)
        XCTAssertLessThan(duration, 1.0, "Agent creation should complete within 1 second")
    }

    func testMemoryUsage() {
        let initialMemory = getMemoryUsage()
        for _ in 1...100 { appState.createNewChat() }
        let finalMemory = getMemoryUsage()
        let memoryIncrease = finalMemory - initialMemory
        XCTAssertLessThan(memoryIncrease, 50 * 1024 * 1024, "Memory usage should be reasonable")
    }

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
}


