import Foundation

// MARK: - Grounding System Configuration
struct GroundingConfig {
    // Service endpoints
    static let prometheusURL = "http://localhost:9091"
    static let grafanaURL = "http://localhost:3000"
    static let aiMetricsURL = "http://localhost:9092"
    static let healthMonitorURL = "http://localhost:8080"
    static let lokiURL = "http://localhost:3101"
    
    // AI Service endpoints
    static let chatServiceURL = "http://localhost:8010"
    static let mlxServiceURL = "http://localhost:8001"
    static let hrmServiceURL = "http://localhost:8002"
    static let implementationServiceURL = "http://localhost:8029"
    static let researchServiceURL = "http://localhost:8028"
    
    // Knowledge Grounding Service endpoints
    static let knowledgeGatewayURL = "http://localhost:8088"
    static let knowledgeSyncURL = "http://localhost:8089"
    static let knowledgeContextURL = "http://localhost:8090"
    static let weaviateURL = "http://localhost:8080"
    static let redisURL = "redis://localhost:6379"
    static let supabaseURL = "postgres://postgres:postgres@localhost:5432/postgres"
    
    // Update intervals
    static let metricsUpdateInterval: TimeInterval = 30.0
    static let healthUpdateInterval: TimeInterval = 10.0
    static let alertsCheckInterval: TimeInterval = 60.0
    static let knowledgeSyncInterval: TimeInterval = 300.0
    
    // Knowledge API endpoints
    static let knowledgeSearchEndpoint = "\(knowledgeGatewayURL)/api/v1/search"
    static let knowledgeChatEndpoint = "\(knowledgeGatewayURL)/api/v1/chat"
    static let knowledgeAddEndpoint = "\(knowledgeGatewayURL)/api/v1/knowledge"
    static let syncTriggerEndpoint = "\(knowledgeSyncURL)/api/v1/sync"
    static let syncStatusEndpoint = "\(knowledgeSyncURL)/api/v1/sync/status"
    
    // Alert thresholds
    static let errorRateThreshold: Double = 0.1
    static let responseTimeThreshold: Double = 5.0
    static let gpuUsageThreshold: Double = 0.9
    static let memoryUsageThreshold: Double = 0.8
    static let cpuUsageThreshold: Double = 0.8
    
    // Notification settings
    static let enableNotifications = true
    static let enableSoundNotifications = false
    static let enableVisualAlerts = true
    
    // Dashboard settings
    static let defaultDashboardRefresh = 30
    static let maxAlertsDisplay = 50
    static let chartDataPoints = 100
    
    // API timeouts
    static let requestTimeout: TimeInterval = 10.0
    static let connectionTimeout: TimeInterval = 5.0
    
    // Security settings
    static let enableTLS = false
    static let allowInsecureConnections = true
    static let apiKeyHeader = "X-API-Key"
    static let userAgent = "UniversalAITools/1.0"
    
    // Logging settings
    static let enableDebugLogging = true
    static let logLevel = "INFO"
    static let maxLogEntries = 1000
}

// MARK: - Environment Configuration
extension GroundingConfig {
    static func loadFromEnvironment() -> GroundingConfig {
        return GroundingConfig()
    }
    
    static func getEnvironmentVariable(_ key: String, defaultValue: String) -> String {
        return ProcessInfo.processInfo.environment[key] ?? defaultValue
    }
    
    static var isDevelopmentMode: Bool {
        return getEnvironmentVariable("ENVIRONMENT", defaultValue: "development") == "development"
    }
    
    static var isProductionMode: Bool {
        return getEnvironmentVariable("ENVIRONMENT", defaultValue: "development") == "production"
    }
}

// MARK: - Service Discovery
extension GroundingConfig {
    static func discoverServices() async -> [String: String] {
        var discoveredServices: [String: String] = [:]
        
        let services = [
            ("Prometheus", prometheusURL),
            ("Grafana", grafanaURL),
            ("AI Metrics", aiMetricsURL),
            ("Health Monitor", healthMonitorURL),
            ("Loki", lokiURL),
            ("Chat Service", chatServiceURL),
            ("MLX Service", mlxServiceURL),
            ("HRM Service", hrmServiceURL),
            ("Implementation Service", implementationServiceURL),
            ("Research Service", researchServiceURL),
            ("Knowledge Gateway", knowledgeGatewayURL),
            ("Knowledge Sync", knowledgeSyncURL),
            ("Knowledge Context", knowledgeContextURL),
            ("Weaviate", weaviateURL)
        ]
        
        for (name, url) in services {
            if await isServiceAvailable(url: url) {
                discoveredServices[name] = url
            }
        }
        
        return discoveredServices
    }
    
    private static func isServiceAvailable(url: String) async -> Bool {
        guard let url = URL(string: url) else { return false }
        
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = connectionTimeout
            request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
            
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
        } catch {
            print("❌ Service \(url) not available: \(error.localizedDescription)")
        }
        
        return false
    }
}

// MARK: - Configuration Validation
extension GroundingConfig {
    static func validateConfiguration() -> [String] {
        var issues: [String] = []
        
        // Check if URLs are valid
        let urls = [
            prometheusURL,
            grafanaURL,
            aiMetricsURL,
            healthMonitorURL,
            lokiURL,
            chatServiceURL,
            mlxServiceURL,
            knowledgeGatewayURL,
            knowledgeSyncURL,
            knowledgeContextURL,
            weaviateURL
        ]
        
        for url in urls {
            if URL(string: url) == nil {
                issues.append("Invalid URL: \(url)")
            }
        }
        
        // Check thresholds
        if errorRateThreshold < 0 || errorRateThreshold > 1 {
            issues.append("Error rate threshold must be between 0 and 1")
        }
        
        if responseTimeThreshold < 0 {
            issues.append("Response time threshold must be positive")
        }
        
        if gpuUsageThreshold < 0 || gpuUsageThreshold > 1 {
            issues.append("GPU usage threshold must be between 0 and 1")
        }
        
        if memoryUsageThreshold < 0 || memoryUsageThreshold > 1 {
            issues.append("Memory usage threshold must be between 0 and 1")
        }
        
        if cpuUsageThreshold < 0 || cpuUsageThreshold > 1 {
            issues.append("CPU usage threshold must be between 0 and 1")
        }
        
        // Check intervals
        if metricsUpdateInterval < 1 {
            issues.append("Metrics update interval must be at least 1 second")
        }
        
        if healthUpdateInterval < 1 {
            issues.append("Health update interval must be at least 1 second")
        }
        
        if alertsCheckInterval < 1 {
            issues.append("Alerts check interval must be at least 1 second")
        }
        
        // Check timeouts
        if requestTimeout < 1 {
            issues.append("Request timeout must be at least 1 second")
        }
        
        if connectionTimeout < 1 {
            issues.append("Connection timeout must be at least 1 second")
        }
        
        return issues
    }
    
    static func isValidConfiguration() -> Bool {
        return validateConfiguration().isEmpty
    }
}

// MARK: - Configuration Export
extension GroundingConfig {
    static func exportConfiguration() -> [String: Any] {
        return [
            "prometheusURL": prometheusURL,
            "grafanaURL": grafanaURL,
            "aiMetricsURL": aiMetricsURL,
            "healthMonitorURL": healthMonitorURL,
            "lokiURL": lokiURL,
            "chatServiceURL": chatServiceURL,
            "mlxServiceURL": mlxServiceURL,
            "hrmServiceURL": hrmServiceURL,
            "implementationServiceURL": implementationServiceURL,
            "researchServiceURL": researchServiceURL,
            "knowledgeGatewayURL": knowledgeGatewayURL,
            "knowledgeSyncURL": knowledgeSyncURL,
            "knowledgeContextURL": knowledgeContextURL,
            "weaviateURL": weaviateURL,
            "metricsUpdateInterval": metricsUpdateInterval,
            "healthUpdateInterval": healthUpdateInterval,
            "alertsCheckInterval": alertsCheckInterval,
            "knowledgeSyncInterval": knowledgeSyncInterval,
            "errorRateThreshold": errorRateThreshold,
            "responseTimeThreshold": responseTimeThreshold,
            "gpuUsageThreshold": gpuUsageThreshold,
            "memoryUsageThreshold": memoryUsageThreshold,
            "cpuUsageThreshold": cpuUsageThreshold,
            "enableNotifications": enableNotifications,
            "enableSoundNotifications": enableSoundNotifications,
            "enableVisualAlerts": enableVisualAlerts,
            "defaultDashboardRefresh": defaultDashboardRefresh,
            "maxAlertsDisplay": maxAlertsDisplay,
            "chartDataPoints": chartDataPoints,
            "requestTimeout": requestTimeout,
            "connectionTimeout": connectionTimeout,
            "enableTLS": enableTLS,
            "allowInsecureConnections": allowInsecureConnections,
            "apiKeyHeader": apiKeyHeader,
            "userAgent": userAgent,
            "enableDebugLogging": enableDebugLogging,
            "logLevel": logLevel,
            "maxLogEntries": maxLogEntries,
            "isDevelopmentMode": isDevelopmentMode,
            "isProductionMode": isProductionMode,
            "timestamp": Date().timeIntervalSince1970
        ]
    }
    
    static func saveConfigurationToFile() throws {
        let config = exportConfiguration()
        let data = try JSONSerialization.data(withJSONObject: config, options: .prettyPrinted)
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("grounding-config.json")
        try data.write(to: url)
        print("✅ Configuration saved to: \(url.path)")
    }
}