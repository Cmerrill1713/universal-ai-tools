import Foundation
import UIKit
import Darwin

// Temporary NetworkConfig
struct NetworkConfig {
    static let shared = NetworkConfig()
    let baseURL = "http://169.254.105.52:9999"
}

// MARK: - Data Models

struct ChatMessage: Identifiable, Codable {
    let id = UUID()
    let content: String
    let isUser: Bool
    let timestamp: Date
    let agentUsed: String?
    let processingTime: Double?
    let confidence: Double?
    
    init(content: String, isUser: Bool, agentUsed: String? = nil, processingTime: Double? = nil, confidence: Double? = nil) {
        self.content = content
        self.isUser = isUser
        self.timestamp = Date()
        self.agentUsed = agentUsed
        self.processingTime = processingTime
        self.confidence = confidence
    }
}

struct DeviceContext: Codable {
    let deviceId: String
    let deviceName: String
    let osVersion: String
    let appVersion: String
    let batteryLevel: Float
    let isLowPowerMode: Bool
    let connectionType: String
    let memoryPressure: String
    let thermalState: String
    let timestamp: String
    
    static func getCurrentContext() -> DeviceContext {
        let device = UIDevice.current
        device.isBatteryMonitoringEnabled = true
        
        return DeviceContext(
            deviceId: device.identifierForVendor?.uuidString ?? "unknown",
            deviceName: device.name,
            osVersion: device.systemVersion,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0",
            batteryLevel: device.batteryLevel >= 0 ? device.batteryLevel : 1.0,
            isLowPowerMode: ProcessInfo.processInfo.isLowPowerModeEnabled,
            connectionType: "wifi", // Simplified - could be enhanced with network detection
            memoryPressure: getMemoryPressure(),
            thermalState: getThermalState(),
            timestamp: ISO8601DateFormatter().string(from: Date())
        )
    }
    
    private static func getMemoryPressure() -> String {
        let info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &count) {
            $0.withMemoryRebound(to: mach_msg_type_number_t.self, capacity: 1) { count in
                withUnsafeMutablePointer(to: &info) {
                    $0.withMemoryRebound(to: integer_t.self, capacity: 1) { info in
                        task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), info, count)
                    }
                }
            }
        }
        
        if kerr == KERN_SUCCESS {
            let usedMemoryMB = Double(info.resident_size) / 1024.0 / 1024.0
            return usedMemoryMB > 500 ? "high" : usedMemoryMB > 200 ? "normal" : "low"
        }
        
        return "unknown"
    }
    
    private static func getThermalState() -> String {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "unknown"
        }
    }
}

struct SmartChatRequest: Codable {
    let userInput: String
    let deviceContext: DeviceContext
    let conversationHistory: [ChatMessage]
    let optimizationPreferences: OptimizationPreferences
    
    struct OptimizationPreferences: Codable {
        let prioritizeBattery: Bool
        let preferCachedResults: Bool
        let maxProcessingTime: Int
        let qualityLevel: String
        
        init(deviceContext: DeviceContext) {
            // Automatically configure based on device state
            self.prioritizeBattery = deviceContext.isLowPowerMode || deviceContext.batteryLevel < 0.2
            self.preferCachedResults = deviceContext.isLowPowerMode || deviceContext.connectionType == "cellular"
            self.maxProcessingTime = deviceContext.isLowPowerMode ? 15000 : 30000
            self.qualityLevel = deviceContext.batteryLevel < 0.1 ? "fast" : 
                               deviceContext.isLowPowerMode ? "balanced" : "high"
        }
    }
}

struct SmartChatResponse: Codable {
    let success: Bool
    let data: ChatResponseData?
    let error: String?
    let metadata: ResponseMetadata?
    
    struct ChatResponseData: Codable {
        let response: String
        let agentUsed: String
        let confidence: Double
        let processingTime: Double
        let cached: Bool
        let deviceOptimizations: [String]
    }
    
    struct ResponseMetadata: Codable {
        let requestId: String
        let timestamp: String
        let version: String
        let totalProcessingTime: Double
        let agentsConsidered: [String]
        let optimizations: OptimizationMetadata
        
        struct OptimizationMetadata: Codable {
            let battery: [String]
            let network: [String]
            let performance: [String]
        }
    }
}

// MARK: - Intelligent Chat Service

@MainActor
class IntelligentChatService: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var lastError: String?
    @Published var connectionStatus: String = "Disconnected"
    
    private var baseURL: String {
        return NetworkConfig.shared.baseURL
    }
    private let maxRetries = 3
    private let timeoutInterval: TimeInterval = 30
    
    init() {
        // Add welcome message
        messages.append(ChatMessage(
            content: "Welcome to Universal AI Tools! I'm your intelligent assistant. I'll automatically choose the best AI agent for each of your requests based on context and your device capabilities.",
            isUser: false,
            agentUsed: "system"
        ))
    }
    
    // MARK: - Smart Chat
    
    func sendMessage(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        // Add user message
        let userMessage = ChatMessage(content: text, isUser: true)
        messages.append(userMessage)
        
        isLoading = true
        lastError = nil
        
        do {
            let response = try await performSmartChat(text)
            
            if response.success, let data = response.data {
                let assistantMessage = ChatMessage(
                    content: data.response,
                    isUser: false,
                    agentUsed: data.agentUsed,
                    processingTime: data.processingTime,
                    confidence: data.confidence
                )
                messages.append(assistantMessage)
                
                // Update connection status
                connectionStatus = "Connected (\(data.agentUsed))"
                
            } else {
                let errorMessage = ChatMessage(
                    content: "Sorry, I encountered an error: \(response.error ?? "Unknown error")",
                    isUser: false,
                    agentUsed: "error"
                )
                messages.append(errorMessage)
                lastError = response.error
            }
            
        } catch {
            let errorMessage = ChatMessage(
                content: "Connection error: \(error.localizedDescription)",
                isUser: false,
                agentUsed: "error"
            )
            messages.append(errorMessage)
            lastError = error.localizedDescription
            connectionStatus = "Connection Error"
        }
        
        isLoading = false
    }
    
    private func performSmartChat(_ userInput: String) async throws -> SmartChatResponse {
        let deviceContext = DeviceContext.getCurrentContext()
        let optimizationPreferences = SmartChatRequest.OptimizationPreferences(deviceContext: deviceContext)
        
        let request = SmartChatRequest(
            userInput: userInput,
            deviceContext: deviceContext,
            conversationHistory: Array(messages.suffix(10)), // Last 10 messages for context
            optimizationPreferences: optimizationPreferences
        )
        
        let url = URL(string: "\(baseURL)/api/v1/mobile-orchestration/smart-chat")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.timeoutInterval = timeoutInterval
        
        let requestData = try JSONEncoder().encode(request)
        urlRequest.httpBody = requestData
        
        // Retry logic
        var lastError: Error?
        for attempt in 1...maxRetries {
            do {
                let (data, response) = try await URLSession.shared.data(for: urlRequest)
                
                if let httpResponse = response as? HTTPURLResponse {
                    print("📡 Smart Chat Response: HTTP \(httpResponse.statusCode)")
                    
                    if httpResponse.statusCode == 200 {
                        let chatResponse = try JSONDecoder().decode(SmartChatResponse.self, from: data)
                        return chatResponse
                    } else {
                        // Try to parse error response
                        if let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                           let errorMessage = errorData["message"] as? String {
                            throw NSError(domain: "SmartChatError", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMessage])
                        } else {
                            throw NSError(domain: "HTTPError", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "HTTP Error \(httpResponse.statusCode)"])
                        }
                    }
                }
                
            } catch {
                lastError = error
                print("❌ Smart Chat Attempt \(attempt) failed: \(error.localizedDescription)")
                
                if attempt < maxRetries {
                    try await Task.sleep(nanoseconds: UInt64(1_000_000_000 * attempt)) // Exponential backoff
                }
            }
        }
        
        throw lastError ?? NSError(domain: "SmartChatError", code: -1, userInfo: [NSLocalizedDescriptionKey: "All retry attempts failed"])
    }
    
    // MARK: - Utility Methods
    
    func clearChat() {
        messages.removeAll()
        messages.append(ChatMessage(
            content: "Chat cleared. How can I help you today?",
            isUser: false,
            agentUsed: "system"
        ))
        lastError = nil
    }
    
    func testConnection() async {
        isLoading = true
        connectionStatus = "Testing..."
        
        do {
            let url = URL(string: "\(baseURL)/api/v1/mobile-orchestration/metrics")!
            let (_, response) = try await URLSession.shared.data(from: url)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                connectionStatus = "Connected"
            } else {
                connectionStatus = "Connection Error"
            }
        } catch {
            connectionStatus = "Offline"
            lastError = error.localizedDescription
        }
        
        isLoading = false
    }
    
    var isConnected: Bool {
        connectionStatus.contains("Connected")
    }
}