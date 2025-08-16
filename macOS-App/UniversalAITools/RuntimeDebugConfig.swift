import Foundation
import OSLog

/// Runtime debugging configuration for identifying and monitoring potential issues
struct RuntimeDebugConfig {
    static let shared = RuntimeDebugConfig()
    
    // MARK: - Debug Flags
    let enableMemoryMonitoring = true
    let enablePerformanceMonitoring = true
    let enableNetworkDebugging = true
    let enableUIDebugging = true
    
    // MARK: - Monitoring Thresholds
    let maxMemoryUsageMB: Double = 500
    let maxCPUUsagePercent: Double = 80
    let maxRenderTime: TimeInterval = 0.016 // 60 FPS target
    let maxWebSocketReconnectAttempts = 5
    
    // MARK: - Debug Loggers
    let memoryLogger = Logger(subsystem: "UniversalAITools", category: "Memory")
    let performanceLogger = Logger(subsystem: "UniversalAITools", category: "Performance")
    let networkLogger = Logger(subsystem: "UniversalAITools", category: "Network")
    let uiLogger = Logger(subsystem: "UniversalAITools", category: "UI")
    
    private init() {}
    
    // MARK: - Memory Monitoring
    func checkMemoryUsage() {
        guard enableMemoryMonitoring else { return }
        
        let memoryInfo = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let result = withUnsafeMutablePointer(to: &memoryInfo) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        if result == KERN_SUCCESS {
            let memoryUsageMB = Double(memoryInfo.resident_size) / 1024.0 / 1024.0
            if memoryUsageMB > maxMemoryUsageMB {
                memoryLogger.warning("🚨 High memory usage: \(memoryUsageMB, specifier: "%.1f")MB")
            } else {
                memoryLogger.debug("📊 Memory usage: \(memoryUsageMB, specifier: "%.1f")MB")
            }
        }
    }
    
    // MARK: - Performance Monitoring
    func measureRenderTime<T>(_ operation: () -> T) -> T {
        guard enablePerformanceMonitoring else { return operation() }
        
        let startTime = CFAbsoluteTimeGetCurrent()
        let result = operation()
        let renderTime = CFAbsoluteTimeGetCurrent() - startTime
        
        if renderTime > maxRenderTime {
            performanceLogger.warning("🐌 Slow render: \(renderTime * 1000, specifier: "%.2f")ms")
        }
        
        return result
    }
    
    // MARK: - Network Debugging
    func logWebSocketEvent(_ event: String, details: String = "") {
        guard enableNetworkDebugging else { return }
        networkLogger.info("🌐 WebSocket: \(event) \(details)")
    }
    
    func logAPICall(_ endpoint: String, duration: TimeInterval, success: Bool) {
        guard enableNetworkDebugging else { return }
        let status = success ? "✅" : "❌"
        networkLogger.info("\(status) API: \(endpoint) (\(duration * 1000, specifier: "%.0f")ms)")
    }
    
    // MARK: - UI Debugging
    func logViewTransition(_ from: String, to: String) {
        guard enableUIDebugging else { return }
        uiLogger.info("🔄 View transition: \(from) → \(to)")
    }
    
    // MARK: - Error Tracking
    func trackError(_ error: Error, context: String) {
        let errorLogger = Logger(subsystem: "UniversalAITools", category: "Errors")
        errorLogger.error("💥 Error in \(context): \(error.localizedDescription)")
    }
    
    // MARK: - Resource Leak Detection
    func validateResourceCleanup() {
        // Check for common resource leaks
        checkTimersCleanup()
        checkWebSocketConnections()
        checkMemoryLeaks()
    }
    
    private func checkTimersCleanup() {
        // This would be implemented with actual timer tracking
        memoryLogger.debug("🔍 Checking timer cleanup...")
    }
    
    private func checkWebSocketConnections() {
        // This would be implemented with actual connection tracking
        networkLogger.debug("🔍 Checking WebSocket connections...")
    }
    
    private func checkMemoryLeaks() {
        // This would be implemented with actual object tracking
        memoryLogger.debug("🔍 Checking for memory leaks...")
    }
}

// MARK: - Debug Extensions
extension RuntimeDebugConfig {
    /// Start periodic monitoring
    func startMonitoring() {
        Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            Task { @MainActor in
                checkMemoryUsage()
                validateResourceCleanup()
            }
        }
    }
    
    /// Generate debug report
    func generateDebugReport() -> String {
        var report = "🔍 Runtime Debug Report\n"
        report += "========================\n"
        report += "Memory Monitoring: \(enableMemoryMonitoring ? "ON" : "OFF")\n"
        report += "Performance Monitoring: \(enablePerformanceMonitoring ? "ON" : "OFF")\n"
        report += "Network Debugging: \(enableNetworkDebugging ? "ON" : "OFF")\n"
        report += "UI Debugging: \(enableUIDebugging ? "ON" : "OFF")\n"
        report += "Max Memory Threshold: \(maxMemoryUsageMB)MB\n"
        report += "Max CPU Threshold: \(maxCPUUsagePercent)%\n"
        return report
    }
}

// MARK: - Task Extensions for Memory Safety
extension Task {
    static func safeMainActor<Success>(
        priority: TaskPriority? = nil,
        operation: @escaping @MainActor () async throws -> Success
    ) -> Task<Success, Error> where Success: Sendable {
        Task(priority: priority) { @MainActor in
            try await operation()
        }
    }
}

// MARK: - Memory Helper
private struct mach_task_basic_info {
    var virtual_size: mach_vm_size_t = 0
    var resident_size: mach_vm_size_t = 0
    var resident_size_max: mach_vm_size_t = 0
    var user_time: time_value_t = time_value_t()
    var system_time: time_value_t = time_value_t()
    var policy: policy_t = 0
    var suspend_count: integer_t = 0
}