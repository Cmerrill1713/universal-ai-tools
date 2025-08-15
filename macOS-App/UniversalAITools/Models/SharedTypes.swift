import Foundation
import SwiftUI

// MARK: - Content Type (Unified)
enum ContentType: String, CaseIterable, Codable, Identifiable {
    // Search/Filter content types
    case chat = "chat"
    case visualization = "visualization" 
    case data = "data"
    case workflow = "workflow"
    case setting = "setting"
    
    // Performance content types
    case images = "images"
    case videos = "videos"
    case documents = "documents"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .chat: return "Chat"
        case .visualization: return "Visualization"
        case .data: return "Data"
        case .workflow: return "Workflow"
        case .setting: return "Setting"
        case .images: return "Images"
        case .videos: return "Videos"
        case .documents: return "Documents"
        }
    }
    
    var icon: String {
        switch self {
        case .chat: return "text.bubble"
        case .visualization: return "chart.bar"
        case .data: return "tablecells"
        case .workflow: return "arrow.triangle.branch"
        case .setting: return "gear"
        case .images: return "photo"
        case .videos: return "video"
        case .documents: return "doc.text"
        }
    }
}

// MARK: - Navigation Mode (Unified)
enum NavigationMode: String, CaseIterable, Codable {
    case standard = "standard"
    case orbit = "orbit"
    case free = "free"
    case guided = "guided"
    
    var displayName: String {
        switch self {
        case .standard: return "Standard"
        case .orbit: return "Orbit"
        case .free: return "Free Navigation"
        case .guided: return "Guided"
        }
    }
    
    var icon: String {
        switch self {
        case .standard: return "arrow.up.down.and.arrow.left.right"
        case .orbit: return "rotate.3d"
        case .free: return "hand.draw"
        case .guided: return "map"
        }
    }
}

// MARK: - Memory Pressure Level (Unified)
enum MemoryPressureLevel: String, CaseIterable, Codable {
    case normal = "normal"
    case warning = "warning"
    case critical = "critical"
    
    var displayName: String {
        switch self {
        case .normal: return "Normal"
        case .warning: return "Warning"
        case .critical: return "Critical"
        }
    }
    
    var color: Color {
        switch self {
        case .normal: return .green
        case .warning: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - JSON Value Helper
enum JSONValue: Codable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null
    
    var value: Any {
        switch self {
        case .string(let str): return str
        case .int(let num): return num
        case .double(let num): return num
        case .bool(let bool): return bool
        case .object(let dict): return dict.mapValues { $0.value }
        case .array(let arr): return arr.map { $0.value }
        case .null: return NSNull()
        }
    }
    
    init(from value: Any) {
        if let str = value as? String {
            self = .string(str)
        } else if let num = value as? Int {
            self = .int(num)
        } else if let num = value as? Double {
            self = .double(num)
        } else if let bool = value as? Bool {
            self = .bool(bool)
        } else if let dict = value as? [String: Any] {
            self = .object(dict.mapValues { JSONValue(from: $0) })
        } else if let arr = value as? [Any] {
            self = .array(arr.map { JSONValue(from: $0) })
        } else {
            self = .null
        }
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) {
            self = .string(str)
        } else if let num = try? container.decode(Int.self) {
            self = .int(num)
        } else if let num = try? container.decode(Double.self) {
            self = .double(num)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let dict = try? container.decode([String: JSONValue].self) {
            self = .object(dict)
        } else if let arr = try? container.decode([JSONValue].self) {
            self = .array(arr)
        } else if container.decodeNil() {
            self = .null
        } else {
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Invalid JSON value"))
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let str): try container.encode(str)
        case .int(let num): try container.encode(num)
        case .double(let num): try container.encode(num)
        case .bool(let bool): try container.encode(bool)
        case .object(let dict): try container.encode(dict)
        case .array(let arr): try container.encode(arr)
        case .null: try container.encodeNil()
        }
    }
}

// MARK: - WebSocket Message (Unified)
struct WebSocketMessage: Codable {
    let type: String
    let data: [String: Any]
    
    enum CodingKeys: String, CodingKey {
        case type
        case data
    }
    
    init(type: String, data: [String: Any]) {
        self.type = type
        self.data = data
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        
        // Be resilient: accept either a dictionary payload or any JSON value
        if let dataDict = try? container.decode([String: JSONValue].self, forKey: .data) {
            data = dataDict.mapValues { $0.value }
        } else {
            data = [:]
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(type, forKey: .type)
        
        // Convert data to JSONValue for encoding
        let jsonData = data.mapValues { JSONValue(from: $0) }
        try container.encode(jsonData, forKey: .data)
    }
}

// MARK: - Connection Status (Unified)
enum ConnectionStatus: String, CaseIterable, Codable {
    case connected = "connected"
    case connecting = "connecting"
    case disconnected = "disconnected"
    case error = "error"
    
    var displayName: String {
        switch self {
        case .connected: return "Connected"
        case .connecting: return "Connecting"
        case .disconnected: return "Disconnected"
        case .error: return "Error"
        }
    }
    
    var color: Color {
        switch self {
        case .connected: return .green
        case .connecting: return .orange
        case .disconnected: return .gray
        case .error: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .connected: return "wifi"
        case .connecting: return "wifi.slash"
        case .disconnected: return "wifi.exclamationmark"
        case .error: return "xmark.circle"
        }
    }
}

// MARK: - Optimization Priority (Unified)
enum OptimizationPriority: String, CaseIterable, Codable {
    case low = "low"
    case medium = "medium" 
    case high = "high"
    case critical = "critical"
    
    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }
    
    var color: Color {
        switch self {
        case .low: return .gray
        case .medium: return .blue
        case .high: return .orange
        case .critical: return .red
        }
    }
}

// MARK: - Trend Direction (Unified)
enum TrendDirection: String, CaseIterable, Codable {
    case improving = "improving"
    case stable = "stable"
    case declining = "declining"
    case neutral = "neutral"
    
    var displayName: String {
        switch self {
        case .improving: return "Improving"
        case .stable: return "Stable"
        case .declining: return "Declining"
        case .neutral: return "Neutral"
        }
    }
    
    var color: Color {
        switch self {
        case .improving: return .green
        case .stable: return .blue
        case .declining: return .red
        case .neutral: return .gray
        }
    }
    
    var icon: String {
        switch self {
        case .improving: return "arrow.up.right"
        case .stable: return "arrow.right"
        case .declining: return "arrow.down.right"
        case .neutral: return "minus"
        }
    }
}

// MARK: - Time Range (Unified)
enum TimeRange: String, CaseIterable, Codable {
    case lastHour = "1h"
    case last24Hours = "24h"
    case lastWeek = "7d"
    case lastMonth = "30d"
    case lastYear = "1y"
    
    var displayName: String {
        switch self {
        case .lastHour: return "Last Hour"
        case .last24Hours: return "Last 24 Hours"
        case .lastWeek: return "Last Week"
        case .lastMonth: return "Last Month"
        case .lastYear: return "Last Year"
        }
    }
    
    var duration: TimeInterval {
        switch self {
        case .lastHour: return 3600
        case .last24Hours: return 86400
        case .lastWeek: return 604800
        case .lastMonth: return 2592000
        case .lastYear: return 31536000
        }
    }
}