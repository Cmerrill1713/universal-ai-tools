import Foundation
import SwiftUI

// MARK: - Note
// MonitoringAlert, SystemPerformanceMetrics are defined in SharedTypes.swift
// This file contains monitoring-specific types that don't conflict with shared definitions

// MARK: - Service Status
public enum ServiceStatus: String, CaseIterable, Codable {
    case connected = "connected"
    case connecting = "connecting"
    case disconnected = "disconnected"
    case error = "error"
    
    public var color: Color {
        switch self {
        case .connected: return .green
        case .connecting: return .yellow
        case .disconnected: return .gray
        case .error: return .red
        }
    }
    
    public var icon: String {
        switch self {
        case .connected: return "checkmark.circle.fill"
        case .connecting: return "clock.circle.fill"
        case .disconnected: return "xmark.circle.fill"
        case .error: return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Service Connection Health
public struct MonitoringServiceConnectionHealth: Codable {
    public let apiService: ServiceStatus
    public let websocket: ServiceStatus
    public let voiceService: ServiceStatus
    public let mlxService: ServiceStatus
    public let timestamp: Date
    
    public init(
        apiService: ServiceStatus = .disconnected,
        websocket: ServiceStatus = .disconnected,
        voiceService: ServiceStatus = .disconnected,
        mlxService: ServiceStatus = .disconnected,
        timestamp: Date = Date()
    ) {
        self.apiService = apiService
        self.websocket = websocket
        self.voiceService = voiceService
        self.mlxService = mlxService
        self.timestamp = timestamp
    }
}

// MARK: - Application Health
public struct MonitoringApplicationHealth: Codable {
    public let overallStatus: HealthStatus // References SharedTypes.HealthStatus
    public let memoryPressure: MemoryPressureLevel // References SharedTypes.MemoryPressureLevel
    public let errorRate: Double
    public let responseTime: Double
    public let uptime: TimeInterval
    public let activeAgents: Int
    public let timestamp: Date
    
    public init(
        overallStatus: HealthStatus = .healthy,
        memoryPressure: MemoryPressureLevel = .normal,
        errorRate: Double = 0.0,
        responseTime: Double = 0.0,
        uptime: TimeInterval = 0.0,
        activeAgents: Int = 0,
        timestamp: Date = Date()
    ) {
        self.overallStatus = overallStatus
        self.memoryPressure = memoryPressure
        self.errorRate = errorRate
        self.responseTime = responseTime
        self.uptime = uptime
        self.activeAgents = activeAgents
        self.timestamp = timestamp
    }
}

// MARK: - Monitoring Metrics
public struct MonitoringMetrics: Codable {
    public let cpuUsage: Double
    public let memoryUsage: Double
    public let diskUsage: Double
    public let networkLatency: Double
    public let batteryLevel: Double?
    public let thermalState: String
    public let timestamp: Date
    
    public init(
        cpuUsage: Double,
        memoryUsage: Double,
        diskUsage: Double,
        networkLatency: Double,
        batteryLevel: Double? = nil,
        thermalState: String = "nominal",
        timestamp: Date = Date()
    ) {
        self.cpuUsage = cpuUsage
        self.memoryUsage = memoryUsage
        self.diskUsage = diskUsage
        self.networkLatency = networkLatency
        self.batteryLevel = batteryLevel
        self.thermalState = thermalState
        self.timestamp = timestamp
    }
}

// MARK: - Monitor Configuration
public struct MonitorConfiguration: Codable {
    public let updateInterval: TimeInterval
    public let alertThresholds: AlertThresholds
    public let enabledMonitors: Set<MonitorType>
    public let retentionPeriod: TimeInterval
    
    public struct AlertThresholds: Codable {
        public let cpuWarning: Double
        public let cpuCritical: Double
        public let memoryWarning: Double
        public let memoryCritical: Double
        public let diskWarning: Double
        public let diskCritical: Double
        
        public init(
            cpuWarning: Double = 70.0,
            cpuCritical: Double = 90.0,
            memoryWarning: Double = 80.0,
            memoryCritical: Double = 95.0,
            diskWarning: Double = 85.0,
            diskCritical: Double = 95.0
        ) {
            self.cpuWarning = cpuWarning
            self.cpuCritical = cpuCritical
            self.memoryWarning = memoryWarning
            self.memoryCritical = memoryCritical
            self.diskWarning = diskWarning
            self.diskCritical = diskCritical
        }
    }
    
    public enum MonitorType: String, CaseIterable, Codable {
        case cpu = "cpu"
        case memory = "memory"
        case disk = "disk"
        case network = "network"
        case battery = "battery"
        case thermal = "thermal"
    }
    
    public init(
        updateInterval: TimeInterval = 5.0,
        alertThresholds: AlertThresholds = AlertThresholds(),
        enabledMonitors: Set<MonitorType> = Set(MonitorType.allCases),
        retentionPeriod: TimeInterval = 86400 // 24 hours
    ) {
        self.updateInterval = updateInterval
        self.alertThresholds = alertThresholds
        self.enabledMonitors = enabledMonitors
        self.retentionPeriod = retentionPeriod
    }
}

// MARK: - Monitoring Event
public struct MonitoringEvent: Codable, Identifiable {
    public let id: UUID
    public let type: EventType
    public let severity: AlertSeverity // References SharedTypes.AlertSeverity
    public let message: String
    public let details: [String: String]
    public let timestamp: Date
    public let source: String
    
    public enum EventType: String, Codable {
        case thresholdExceeded = "threshold_exceeded"
        case serviceDown = "service_down"
        case serviceUp = "service_up"
        case anomalyDetected = "anomaly_detected"
        case configurationChanged = "configuration_changed"
        case maintenanceStarted = "maintenance_started"
        case maintenanceCompleted = "maintenance_completed"
    }
    
    public init(
        id: UUID = UUID(),
        type: EventType,
        severity: AlertSeverity,
        message: String,
        details: [String: String] = [:],
        timestamp: Date = Date(),
        source: String = "MonitoringService"
    ) {
        self.id = id
        self.type = type
        self.severity = severity
        self.message = message
        self.details = details
        self.timestamp = timestamp
        self.source = source
    }
}

// MARK: - Monitoring Dashboard Data
public struct MonitoringDashboardData: Codable {
    public let metrics: MonitoringMetrics
    public let serviceHealth: MonitoringServiceConnectionHealth
    public let applicationHealth: MonitoringApplicationHealth
    public let recentEvents: [MonitoringEvent]
    public let alertsCount: AlertsCount
    public let lastUpdated: Date
    
    public struct AlertsCount: Codable {
        public let critical: Int
        public let warning: Int
        public let info: Int
        
        public init(critical: Int = 0, warning: Int = 0, info: Int = 0) {
            self.critical = critical
            self.warning = warning
            self.info = info
        }
    }
    
    public init(
        metrics: MonitoringMetrics,
        serviceHealth: MonitoringServiceConnectionHealth,
        applicationHealth: MonitoringApplicationHealth,
        recentEvents: [MonitoringEvent] = [],
        alertsCount: AlertsCount = AlertsCount(),
        lastUpdated: Date = Date()
    ) {
        self.metrics = metrics
        self.serviceHealth = serviceHealth
        self.applicationHealth = applicationHealth
        self.recentEvents = recentEvents
        self.alertsCount = alertsCount
        self.lastUpdated = lastUpdated
    }
}
