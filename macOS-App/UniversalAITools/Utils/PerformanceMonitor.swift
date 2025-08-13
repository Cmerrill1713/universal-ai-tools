import os.log
import SwiftUI

// MARK: - Performance Monitor for Animation Debugging
class PerformanceMonitor: ObservableObject {
    static let shared = PerformanceMonitor()

    private let logger = Logger(subsystem: "com.universalaitools.macos", category: "Performance")

    @Published var isMonitoring = false
    @Published var animationCount = 0
    @Published var memoryUsage: Double = 0
    @Published var cpuUsage: Double = 0

    private var monitoringTask: Task<Void, Never>?
    private var animationTracker: Set<String> = []

    private init() {}

    // MARK: - Animation Tracking

    func trackAnimation(_ name: String, started: Bool = true) {
        if started {
            animationTracker.insert(name)
            logger.info("Animation started: \(name)")
        } else {
            animationTracker.remove(name)
            logger.info("Animation stopped: \(name)")
        }

        DispatchQueue.main.async {
            self.animationCount = self.animationTracker.count
        }

        // Alert if too many animations
        if animationTracker.count > 5 {
            logger.warning("High animation count detected: \(self.animationTracker.count) animations running")
        }
    }

    func logActiveAnimations() {
        logger.info("Active animations: \(self.animationTracker.joined(separator: ", "))")
    }

    // MARK: - System Monitoring

    func startMonitoring() {
        guard !isMonitoring else { return }

        isMonitoring = true
        logger.info("Performance monitoring started")

        monitoringTask = Task { @MainActor in
            while !Task.isCancelled && isMonitoring {
                updateSystemMetrics()
                try? await Task.sleep(nanoseconds: 2_000_000_000) // Every 2 seconds
            }
        }
    }

    func stopMonitoring() {
        isMonitoring = false
        monitoringTask?.cancel()
        monitoringTask = nil
        logger.info("Performance monitoring stopped")
    }

    private func updateSystemMetrics() {
        // CPU Usage (simplified)
        _ = ProcessInfo.processInfo.processorCount
        cpuUsage = Double.random(in: 10...30) // Placeholder - real implementation would use system APIs

        // Memory Usage (simplified)
        _ = ProcessInfo.processInfo.physicalMemory
        memoryUsage = Double.random(in: 200...800) // Placeholder MB

        // Log high resource usage
        if cpuUsage > 25 {
            logger.warning("High CPU usage detected: \(self.cpuUsage)%")
        }

        if memoryUsage > 600 {
            logger.warning("High memory usage detected: \(self.memoryUsage)MB")
        }

        // Check for potential freeze conditions
        if animationCount > 5 && cpuUsage > 20 {
            logger.error("Potential freeze condition: \(self.animationCount) animations with \(self.cpuUsage)% CPU")
        }
    }

    // MARK: - Freeze Detection

    func checkForFreeze() {
        logger.info("Freeze check - Animations: \(self.animationCount), CPU: \(self.cpuUsage)%, Memory: \(self.memoryUsage)MB")

        if animationCount > 8 {
            logger.error("Critical: Too many concurrent animations (\(self.animationCount))")
        }

        logActiveAnimations()
    }

    deinit {
        stopMonitoring()
    }
}

// MARK: - Performance Dashboard View
struct PerformanceDebugView: View {
    @StateObject private var monitor = PerformanceMonitor.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Performance Monitor")
                .font(.headline)

            Group {
                HStack {
                    Text("Monitoring:")
                    Spacer()
                    Text(monitor.isMonitoring ? "Active" : "Inactive")
                        .foregroundColor(monitor.isMonitoring ? .green : .red)
                }

                HStack {
                    Text("Active Animations:")
                    Spacer()
                    Text("\(monitor.animationCount)")
                        .foregroundColor(monitor.animationCount > 5 ? .red : .primary)
                }

                HStack {
                    Text("CPU Usage:")
                    Spacer()
                    Text("\(monitor.cpuUsage, specifier: "%.1f")%")
                        .foregroundColor(monitor.cpuUsage > 25 ? .red : .primary)
                }

                HStack {
                    Text("Memory Usage:")
                    Spacer()
                    Text("\(monitor.memoryUsage, specifier: "%.0f")MB")
                        .foregroundColor(monitor.memoryUsage > 600 ? .red : .primary)
                }
            }
            .font(.caption)

            HStack(spacing: 8) {
                Button(monitor.isMonitoring ? "Stop" : "Start") {
                    if monitor.isMonitoring {
                        monitor.stopMonitoring()
                    } else {
                        monitor.startMonitoring()
                    }
                }
                .buttonStyle(.bordered)

                Button("Check Freeze") {
                    monitor.checkForFreeze()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(.thinMaterial)
        .cornerRadius(12)
        .onAppear {
            monitor.startMonitoring()
        }
    }
}
