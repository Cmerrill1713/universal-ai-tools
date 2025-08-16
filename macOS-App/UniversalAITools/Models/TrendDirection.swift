import Foundation
import SwiftUI

// MARK: - Trend Direction (Enhanced)
public enum TrendDirection: Equatable, CustomStringConvertible {
    case up(Double)
    case down(Double)
    case stable
    
    public var description: String {
        switch self {
        case .up(let value):
            return "↗ +\(String(format: "%.1f", value))%"
        case .down(let value):
            return "↘ -\(String(format: "%.1f", value))%"
        case .stable:
            return "→ Stable"
        }
    }
    
    public var icon: String {
        switch self {
        case .up:
            return "arrow.up.right"
        case .down:
            return "arrow.down.right"
        case .stable:
            return "arrow.right"
        }
    }
    
    public var color: Color {
        switch self {
        case .up:
            return .green
        case .down:
            return .red
        case .stable:
            return .blue
        }
    }
    
    public var isPositive: Bool {
        switch self {
        case .up:
            return true
        case .down:
            return false
        case .stable:
            return true
        }
    }
    
    public var percentage: Double {
        switch self {
        case .up(let value), .down(let value):
            return value
        case .stable:
            return 0.0
        }
    }
    
    public static var allCases: [TrendDirection] {
        return [
            .up(2.5),
            .up(5.2),
            .up(1.8),
            .down(3.1),
            .down(1.2),
            .stable
        ]
    }
}

// MARK: - Processing Stage Types
public enum ProcessingStage: String, CaseIterable, Codable {
    case tokenization = "tokenization"
    case embedding = "embedding"
    case attention = "attention"
    case feedforward = "feedforward"
    case output = "output"
    case decoding = "decoding"
    
    public var displayName: String {
        switch self {
        case .tokenization: return "Tokenization"
        case .embedding: return "Embedding"
        case .attention: return "Attention"
        case .feedforward: return "Feed Forward"
        case .output: return "Output"
        case .decoding: return "Decoding"
        }
    }
    
    public var color: Color {
        switch self {
        case .tokenization: return .blue
        case .embedding: return .purple
        case .attention: return .green
        case .feedforward: return .orange
        case .output: return .red
        case .decoding: return .pink
        }
    }
    
    public var icon: String {
        switch self {
        case .tokenization: return "textformat"
        case .embedding: return "vector"
        case .attention: return "eye.fill"
        case .feedforward: return "arrow.forward"
        case .output: return "square.and.arrow.up"
        case .decoding: return "square.and.arrow.down"
        }
    }
}

// MARK: - System Health Status (Detailed)
public enum SystemHealthStatus: String, CaseIterable, Codable {
    case excellent = "excellent"
    case good = "good"
    case fair = "fair"
    case poor = "poor"
    case critical = "critical"
    
    public var displayName: String {
        switch self {
        case .excellent: return "Excellent"
        case .good: return "Good"
        case .fair: return "Fair"
        case .poor: return "Poor"
        case .critical: return "Critical"
        }
    }
    
    public var color: Color {
        switch self {
        case .excellent: return .green
        case .good: return .mint
        case .fair: return .yellow
        case .poor: return .orange
        case .critical: return .red
        }
    }
    
    public var icon: String {
        switch self {
        case .excellent: return "heart.fill"
        case .good: return "heart"
        case .fair: return "heart.slash"
        case .poor: return "exclamationmark.triangle"
        case .critical: return "exclamationmark.octagon"
        }
    }
    
    public var percentage: Double {
        switch self {
        case .excellent: return 0.9
        case .good: return 0.75
        case .fair: return 0.6
        case .poor: return 0.4
        case .critical: return 0.2
        }
    }
}

// MARK: - Time Range Types
public enum WaterfallTimeRange: String, CaseIterable {
    case last5Minutes = "5m"
    case last15Minutes = "15m"
    case last30Minutes = "30m"
    case lastHour = "1h"
    
    public var displayName: String {
        switch self {
        case .last5Minutes: return "Last 5 minutes"
        case .last15Minutes: return "Last 15 minutes"
        case .last30Minutes: return "Last 30 minutes"
        case .lastHour: return "Last hour"
        }
    }
    
    public var tokenCount: Int {
        switch self {
        case .last5Minutes: return 10
        case .last15Minutes: return 30
        case .last30Minutes: return 60
        case .lastHour: return 120
        }
    }
    
    public var seconds: TimeInterval {
        switch self {
        case .last5Minutes: return 300
        case .last15Minutes: return 900
        case .last30Minutes: return 1800
        case .lastHour: return 3600
        }
    }
}

public enum MemoryTimeRange: String, CaseIterable {
    case last5Minutes = "5m"
    case last15Minutes = "15m"
    case last30Minutes = "30m"
    case lastHour = "1h"
    case last6Hours = "6h"
    case last24Hours = "24h"
    
    public var displayName: String {
        switch self {
        case .last5Minutes: return "Last 5 minutes"
        case .last15Minutes: return "Last 15 minutes"
        case .last30Minutes: return "Last 30 minutes"
        case .lastHour: return "Last hour"
        case .last6Hours: return "Last 6 hours"
        case .last24Hours: return "Last 24 hours"
        }
    }
    
    public var seconds: TimeInterval {
        switch self {
        case .last5Minutes: return 300
        case .last15Minutes: return 900
        case .last30Minutes: return 1800
        case .lastHour: return 3600
        case .last6Hours: return 21600
        case .last24Hours: return 86400
        }
    }
}

// MARK: - Optimization Types
public enum OptimizationType: String, CaseIterable {
    case flashAttentionOptimization = "flash_attention"
    case memoryOptimization = "memory"
    case cacheOptimization = "cache"
    case processingOptimization = "processing"
    case networkOptimization = "network"
    
    public var displayName: String {
        switch self {
        case .flashAttentionOptimization: return "Flash Attention"
        case .memoryOptimization: return "Memory"
        case .cacheOptimization: return "Cache"
        case .processingOptimization: return "Processing"
        case .networkOptimization: return "Network"
        }
    }
    
    public var icon: String {
        switch self {
        case .flashAttentionOptimization: return "bolt.fill"
        case .memoryOptimization: return "memorychip"
        case .cacheOptimization: return "internaldrive"
        case .processingOptimization: return "cpu"
        case .networkOptimization: return "network"
        }
    }
    
    public var color: Color {
        switch self {
        case .flashAttentionOptimization: return .yellow
        case .memoryOptimization: return .blue
        case .cacheOptimization: return .green
        case .processingOptimization: return .orange
        case .networkOptimization: return .purple
        }
    }
}

// MARK: - Optimization Suggestion
public struct OptimizationSuggestion: Identifiable, Codable {
    public let id: String
    public let type: OptimizationType
    public let title: String
    public let description: String
    public let expectedImprovement: Double
    public let timestamp: Date
    
    public init(
        id: String,
        type: OptimizationType,
        title: String,
        description: String,
        expectedImprovement: Double,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.description = description
        self.expectedImprovement = expectedImprovement
        self.timestamp = timestamp
    }
}

// MARK: - STT Recognition State
public enum STTRecognitionState: String, CaseIterable {
    case idle = "idle"
    case listening = "listening"
    case processing = "processing"
    case completed = "completed"
    case error = "error"
    
    public var description: String {
        switch self {
        case .idle: return "Ready"
        case .listening: return "Listening..."
        case .processing: return "Processing..."
        case .completed: return "Complete"
        case .error: return "Error"
        }
    }
    
    public var color: Color {
        switch self {
        case .idle: return .gray
        case .listening: return .red
        case .processing: return .orange
        case .completed: return .green
        case .error: return .red
        }
    }
}

// MARK: - Loading Overlay Helper
public struct LoadingOverlay: View {
    public init() {}
    
    public var body: some View {
        ZStack {
            Color.black.opacity(0.3)
            
            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.2)
                
                Text("Loading...")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            .padding(24)
            .background(Color.black.opacity(0.7))
            .cornerRadius(12)
        }
    }
}

// MARK: - Trend Indicator View
public struct TrendIndicator: View {
    public let trend: TrendDirection
    
    public init(trend: TrendDirection) {
        self.trend = trend
    }
    
    public var body: some View {
        HStack(spacing: 4) {
            Image(systemName: trend.icon)
                .font(.caption)
                .foregroundColor(trend.color)
            
            Text(trend.description)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(trend.color)
        }
    }
}