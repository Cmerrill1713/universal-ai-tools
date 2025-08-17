import Foundation
import SwiftUI

// MARK: - Note
// HealthStatus, MonitoringAlert, and SystemPerformanceMetrics are defined in SharedTypes.swift
// This file contains health-specific types that don't conflict with shared definitions

// MARK: - Service Connection Health
public struct ServiceConnectionHealth: Codable {
    public let databaseStatus: HealthConnectionStatus
    public let apiStatus: HealthConnectionStatus
    public let webSocketStatus: HealthConnectionStatus
    public let externalServices: [String: HealthConnectionStatus]
    public let lastHealthCheck: Date
    public let responseTime: TimeInterval
    
    public enum HealthConnectionStatus: String, Codable {
        case healthy = "healthy"
        case degraded = "degraded"
        case unhealthy = "unhealthy"
        case unknown = "unknown"
        
        public var color: Color {
            switch self {
            case .healthy: return .green
            case .degraded: return .orange
            case .unhealthy: return .red
            case .unknown: return .gray
            }
        }
    }
    
    public init(
        databaseStatus: HealthConnectionStatus,
        apiStatus: HealthConnectionStatus,
        webSocketStatus: HealthConnectionStatus,
        externalServices: [String: HealthConnectionStatus] = [:],
        lastHealthCheck: Date = Date(),
        responseTime: TimeInterval
    ) {
        self.databaseStatus = databaseStatus
        self.apiStatus = apiStatus
        self.webSocketStatus = webSocketStatus
        self.externalServices = externalServices
        self.lastHealthCheck = lastHealthCheck
        self.responseTime = responseTime
    }
}

// MARK: - Application Health
public struct ApplicationHealth: Codable {
    public let overallStatus: HealthStatus // References SharedTypes.HealthStatus
    public let version: String
    public let buildNumber: String
    public let activeUsers: Int
    public let errorRate: Double
    public let averageResponseTime: TimeInterval
    public let memoryLeaks: Bool
    public let criticalErrors: [ApplicationError]
    public let lastRestart: Date?
    
    public init(
        overallStatus: HealthStatus,
        version: String,
        buildNumber: String,
        activeUsers: Int,
        errorRate: Double,
        averageResponseTime: TimeInterval,
        memoryLeaks: Bool,
        criticalErrors: [ApplicationError] = [],
        lastRestart: Date? = nil
    ) {
        self.overallStatus = overallStatus
        self.version = version
        self.buildNumber = buildNumber
        self.activeUsers = activeUsers
        self.errorRate = errorRate
        self.averageResponseTime = averageResponseTime
        self.memoryLeaks = memoryLeaks
        self.criticalErrors = criticalErrors
        self.lastRestart = lastRestart
    }
}

// MARK: - Application Error
public struct ApplicationError: Codable, Identifiable {
    public let id: String
    public let message: String
    public let severity: ErrorSeverity
    public let timestamp: Date
    public let stackTrace: String?
    public let context: [String: String]
    
    public enum ErrorSeverity: String, Codable {
        case low = "low"
        case medium = "medium"
        case high = "high"
        case critical = "critical"
        
        public var color: Color {
            switch self {
            case .low: return .blue
            case .medium: return .orange
            case .high: return .red
            case .critical: return .purple
            }
        }
    }
    
    public init(
        id: String = UUID().uuidString,
        message: String,
        severity: ErrorSeverity,
        timestamp: Date = Date(),
        stackTrace: String? = nil,
        context: [String: String] = [:]
    ) {
        self.id = id
        self.message = message
        self.severity = severity
        self.timestamp = timestamp
        self.stackTrace = stackTrace
        self.context = context
    }
}

// MARK: - Health Check Result
public struct HealthCheckResult: Codable, Identifiable {
    public let id: String
    public let serviceName: String
    public let status: HealthStatus // References SharedTypes.HealthStatus
    public let responseTime: TimeInterval
    public let timestamp: Date
    public let details: [String: String]
    public let errorMessage: String?
    
    public init(
        id: String = UUID().uuidString,
        serviceName: String,
        status: HealthStatus,
        responseTime: TimeInterval,
        timestamp: Date = Date(),
        details: [String: String] = [:],
        errorMessage: String? = nil
    ) {
        self.id = id
        self.serviceName = serviceName
        self.status = status
        self.responseTime = responseTime
        self.timestamp = timestamp
        self.details = details
        self.errorMessage = errorMessage
    }
}

// MARK: - Endpoint Health
public struct EndpointHealth: Codable {
    public let endpoint: String
    public let status: HealthStatus // References SharedTypes.HealthStatus
    public let responseTime: TimeInterval
    public let lastCheck: Date
    public let errorCount: Int
    public let successRate: Double
    
    public init(
        endpoint: String,
        status: HealthStatus,
        responseTime: TimeInterval,
        lastCheck: Date = Date(),
        errorCount: Int = 0,
        successRate: Double = 1.0
    ) {
        self.endpoint = endpoint
        self.status = status
        self.responseTime = responseTime
        self.lastCheck = lastCheck
        self.errorCount = errorCount
        self.successRate = successRate
    }
}

// MARK: - Pending Sync
public struct PendingSync: Codable, Identifiable {
    public let id: String
    public let data: Data
    public let timestamp: Date
    public let retryCount: Int
    public let maxRetries: Int
    
    public init(
        id: String = UUID().uuidString,
        data: Data,
        timestamp: Date = Date(),
        retryCount: Int = 0,
        maxRetries: Int = 3
    ) {
        self.id = id
        self.data = data
        self.timestamp = timestamp
        self.retryCount = retryCount
        self.maxRetries = maxRetries
    }
}

// MARK: - Performance Metrics
public struct PerformanceMetrics: Codable {
    public let cpuUsage: Double
    public let memoryUsage: Double
    public let diskIORate: Double
    public let networkThroughput: Double
    public let responseTime: TimeInterval
    public let requestsPerSecond: Double
    public let errorRate: Double
    public let activeConnections: Int
    public let timestamp: Date
    
    public init(
        cpuUsage: Double,
        memoryUsage: Double,
        diskIORate: Double,
        networkThroughput: Double,
        responseTime: TimeInterval,
        requestsPerSecond: Double,
        errorRate: Double,
        activeConnections: Int,
        timestamp: Date = Date()
    ) {
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.diskIORate = diskIORate
        self.networkThroughput = networkThroughput
        self.responseTime = responseTime
        self.requestsPerSecond = requestsPerSecond
        self.errorRate = errorRate
        self.activeConnections = activeConnections
        self.timestamp = timestamp
    }
}
