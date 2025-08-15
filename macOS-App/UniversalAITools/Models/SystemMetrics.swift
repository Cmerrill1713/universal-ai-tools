import Foundation
import SwiftUI

// MARK: - System Metrics
struct SystemMetrics: Codable, Hashable {
    let timestamp: Date
    let cpuUsage: Double
    let memoryUsage: Double
    let diskUsage: Double
    let networkUsage: NetworkUsage
    let activeConnections: Int
    let queuedTasks: Int
    let completedTasks: Int
    let errorCount: Int
    
    init(
        timestamp: Date = Date(),
        cpuUsage: Double = 0.0,
        memoryUsage: Double = 0.0,
        diskUsage: Double = 0.0,
        networkUsage: NetworkUsage = NetworkUsage(),
        activeConnections: Int = 0,
        queuedTasks: Int = 0,
        completedTasks: Int = 0,
        errorCount: Int = 0
    ) {
        self.timestamp = timestamp
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.diskUsage = diskUsage
        self.networkUsage = networkUsage
        self.activeConnections = activeConnections
        self.queuedTasks = queuedTasks
        self.completedTasks = completedTasks
        self.errorCount = errorCount
    }
}

// MARK: - Network Usage
struct NetworkUsage: Codable, Hashable {
    let bytesReceived: Int64
    let bytesSent: Int64
    let requestsPerSecond: Double
    let latency: Double
    
    init(
        bytesReceived: Int64 = 0,
        bytesSent: Int64 = 0,
        requestsPerSecond: Double = 0.0,
        latency: Double = 0.0
    ) {
        self.bytesReceived = bytesReceived
        self.bytesSent = bytesSent
        self.requestsPerSecond = requestsPerSecond
        self.latency = latency
    }
}

// MARK: - Performance Metrics
struct PerformanceMetrics: Codable, Hashable {
    let timestamp: Date
    let responseTime: Double
    let throughput: Double
    let errorRate: Double
    let queueDepth: Int
    let activeUsers: Int
    
    init(
        timestamp: Date = Date(),
        responseTime: Double = 0.0,
        throughput: Double = 0.0,
        errorRate: Double = 0.0,
        queueDepth: Int = 0,
        activeUsers: Int = 0
    ) {
        self.timestamp = timestamp
        self.responseTime = responseTime
        self.throughput = throughput
        self.errorRate = errorRate
        self.queueDepth = queueDepth
        self.activeUsers = activeUsers
    }
}