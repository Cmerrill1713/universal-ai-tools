import Foundation
import SwiftUI

@MainActor
class GroundingSystemManager: ObservableObject {
    @Published var serviceStatuses: [ServiceStatus] = []
    @Published var aiMetrics: [AIMetric] = []
    @Published var systemAlerts: [SystemAlert] = []
    @Published var lastMetricsUpdate: Date?
    @Published var lastHealthUpdate: Date?
    
    // Service URLs
    private let prometheusURL = "http://localhost:9091"
    private let lokiURL = "http://localhost:3100"
    private let aiMetricsURL = "http://localhost:9092"
    private let healthMonitorURL = "http://localhost:8080"
    private let chatServiceURL = "http://localhost:8010"
    private let mlxServiceURL = "http://localhost:8001"
    private let knowledgeGatewayURL = "http://localhost:8088"
    private let knowledgeSyncURL = "http://localhost:8089"
    private let weaviateURL = "http://localhost:8080"
    
    // Update intervals
    private let metricsUpdateInterval: TimeInterval = 30.0
    private let healthUpdateInterval: TimeInterval = 10.0
    private nonisolated(unsafe) var metricsTimer: Timer?
    private nonisolated(unsafe) var healthTimer: Timer?
    
    init() {
        print("🔧 GroundingSystemManager initializing...")
        Task {
            await initializeGroundingSystem()
            startPeriodicUpdates()
        }
        print("🔧 GroundingSystemManager initialization complete")
    }
    
    deinit {
        metricsTimer?.invalidate()
        healthTimer?.invalidate()
        metricsTimer = nil
        healthTimer = nil
    }
    
    // MARK: - Initialization
    
    private func initializeGroundingSystem() async {
        print("🚀 Initializing grounding system connection...")
        await checkAllServices()
        await loadAIMetrics()
        await checkAlerts()
        await loadSystemHealth()
    }
    
    // MARK: - Service Health
    
    func checkAllServices() async {
        var statuses: [ServiceStatus] = []
        
        statuses.append(await checkServiceHealth(name: "Prometheus", urlString: "\(prometheusURL)/-/healthy"))
        statuses.append(await checkServiceHealth(name: "Loki", urlString: "\(lokiURL)/ready"))
        statuses.append(await checkServiceHealth(name: "AI Metrics Exporter", urlString: "\(aiMetricsURL)/metrics"))
        statuses.append(await checkServiceHealth(name: "Health Monitor", urlString: "\(healthMonitorURL)/status"))
        statuses.append(await checkServiceHealth(name: "Chat Service", urlString: "\(chatServiceURL)/health"))
        statuses.append(await checkServiceHealth(name: "MLX Service", urlString: "\(mlxServiceURL)/health"))
        statuses.append(await checkServiceHealth(name: "Knowledge Gateway", urlString: "\(knowledgeGatewayURL)/health"))
        statuses.append(await checkServiceHealth(name: "Knowledge Sync", urlString: "\(knowledgeSyncURL)/health"))
        statuses.append(await checkServiceHealth(name: "Weaviate", urlString: "\(weaviateURL)/v1/.well-known/ready"))
        
        DispatchQueue.main.async {
            self.serviceStatuses = statuses
            self.lastHealthUpdate = Date()
        }
    }
    
    private func checkServiceHealth(name: String, urlString: String) async -> ServiceStatus {
        guard let url = URL(string: urlString) else {
            print("❌ Could not create URL for \(name) health check: \(urlString)")
            return ServiceStatus(name: name, status: .error, url: urlString, lastCheck: Date())
        }
        
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            if let httpResponse = response as? HTTPURLResponse {
                let status: ServiceStatus.Status = httpResponse.statusCode == 200 ? .healthy : .warning
                return ServiceStatus(name: name, status: status, url: url.absoluteString, lastCheck: Date())
            }
        } catch {
            print("❌ \(name) health check failed: \(error.localizedDescription)")
        }
        
        return ServiceStatus(name: name, status: .error, url: url.absoluteString, lastCheck: Date())
    }
    
    // MARK: - Metrics Loading
    
    func loadAIMetrics() async {
        guard let url = URL(string: "\(aiMetricsURL)/metrics") else { return }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let metricsString = String(data: data, encoding: .utf8) {
                let parsedMetrics = parsePrometheusMetrics(metricsString)
                DispatchQueue.main.async {
                    self.aiMetrics = parsedMetrics
                    self.lastMetricsUpdate = Date()
                }
            }
        } catch {
            print("❌ Failed to load AI metrics: \(error.localizedDescription)")
        }
    }
    
    private func parsePrometheusMetrics(_ metricsString: String) -> [AIMetric] {
        var metrics: [AIMetric] = []
        let lines = metricsString.split(separator: "\n")
        
        for line in lines {
            if line.starts(with: "#") || line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                continue // Skip comments and empty lines
            }
            
            // Example: ai_requests_total{endpoint="/chat",model="mlx-qwen2.5-0.5b",service="chat-service"} 10
            let parts = line.split(separator: " ")
            if parts.count >= 2 {
                let nameAndLabels = String(parts[0])
                let valueString = String(parts[1])
                
                if let value = Double(valueString) {
                    if let range = nameAndLabels.range(of: "{") {
                        let name = String(nameAndLabels[..<range.lowerBound])
                        let labelsString = nameAndLabels[range.upperBound..<nameAndLabels.endIndex].dropLast() // Remove trailing '}'
                        
                        var labels: [String: String] = [:]
                        let labelPairs = labelsString.split(separator: ",")
                        for pair in labelPairs {
                            let labelParts = pair.split(separator: "=", maxSplits: 1)
                            if labelParts.count == 2 {
                                let key = String(labelParts[0])
                                let value = String(labelParts[1]).trimmingCharacters(in: CharacterSet(charactersIn: "\""))
                                labels[key] = value
                            }
                        }
                        metrics.append(AIMetric(name: name, value: value, labels: labels))
                    } else {
                        // Metric without labels
                        metrics.append(AIMetric(name: nameAndLabels, value: value, labels: [:]))
                    }
                }
            }
        }
        return metrics
    }
    
    // MARK: - Alerting
    
    func checkAlerts() async {
        guard let url = URL(string: "\(prometheusURL)/api/v1/alerts") else { return }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let dataDict = json["data"] as? [String: Any],
               let alertsArray = dataDict["alerts"] as? [[String: Any]] {
                
                let activeAlerts = alertsArray.compactMap { SystemAlert.fromPrometheus($0) }
                DispatchQueue.main.async {
                    self.systemAlerts = activeAlerts
                }
            }
        } catch {
            print("❌ Failed to load alerts from Prometheus: \(error.localizedDescription)")
        }
    }
    
    // MARK: - System Health (CPU, Memory, Disk)
    
    func loadSystemHealth() async {
        // This would typically involve an endpoint on the health monitor or a custom exporter
        // For now, we'll simulate or use placeholder data
        DispatchQueue.main.async {
            // Placeholder for system health metrics
            // In a real scenario, these would be fetched from a dedicated endpoint
            // or derived from Prometheus metrics.
        }
    }
    
    // MARK: - Periodic Updates
    
    private func startPeriodicUpdates() {
        metricsTimer = Timer.scheduledTimer(withTimeInterval: metricsUpdateInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.loadAIMetrics()
                await self?.checkAlerts()
            }
        }
        
        healthTimer = Timer.scheduledTimer(withTimeInterval: healthUpdateInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.checkAllServices()
                await self?.loadSystemHealth()
            }
        }
    }
    
    private func stopPeriodicUpdates() {
        metricsTimer?.invalidate()
        healthTimer?.invalidate()
        metricsTimer = nil
        healthTimer = nil
    }
}

// MARK: - Data Models

struct ServiceStatus: Identifiable {
    let id = UUID()
    let name: String
    var status: Status
    let url: String
    let lastCheck: Date
    
    enum Status: String {
        case healthy = "Healthy"
        case warning = "Warning"
        case error = "Error"
        case unknown = "Unknown"
    }
    
    var statusColor: Color {
        switch status {
        case .healthy: return .green
        case .warning: return .orange
        case .error: return .red
        case .unknown: return .gray
        }
    }
}

struct AIMetric: Identifiable {
    let id = UUID()
    let name: String
    let value: Double
    let labels: [String: String]
    
    var description: String {
        let labelString = labels.map { "\($0.key)=\($0.value)" }.joined(separator: ", ")
        return "\(name){\(labelString)} = \(String(format: "%.2f", value))"
    }
}

struct SystemAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    let severity: Severity
    let activeSince: Date
    let labels: [String: String]
    
    enum Severity: String {
        case critical = "Critical"
        case warning = "Warning"
        case info = "Info"
        case unknown = "Unknown"
    }
    
    var severityColor: Color {
        switch severity {
        case .critical: return .red
        case .warning: return .orange
        case .info: return .blue
        case .unknown: return .gray
        }
    }
    
    static func fromPrometheus(_ data: [String: Any]) -> SystemAlert? {
        guard let labels = data["labels"] as? [String: Any],
              let title = labels["alertname"] as? String,
              let annotations = data["annotations"] as? [String: Any],
              let message = annotations["description"] as? String,
              let _ = data["state"] as? String else {
            return nil
        }
        
        let severity: Severity
        switch labels["severity"] as? String {
        case "critical": severity = .critical
        case "warning": severity = .warning
        case "info": severity = .info
        default: severity = .unknown
        }
        
        let activeSince: Date
        if let startsAtString = data["startsAt"] as? String,
           let date = ISO8601DateFormatter().date(from: startsAtString) {
            activeSince = date
        } else {
            activeSince = Date()
        }
        
        return SystemAlert(title: title, message: message, severity: severity, activeSince: activeSince, labels: labels as? [String: String] ?? [:])
    }
}
