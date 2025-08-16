import Foundation
import SwiftUI

// MARK: - Agent Model
struct Agent: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var type: AgentType
    var status: AgentStatus
    var description: String
    let createdAt: Date
    var updatedAt: Date
    var capabilities: [String]
    var currentTask: String?
    var progress: Double // 0.0 to 1.0
    var startTime: Date?
    
    init(
        id: UUID = UUID(),
        name: String,
        type: AgentType,
        status: AgentStatus = .idle,
        description: String = "",
        capabilities: [String] = [],
        currentTask: String? = nil,
        progress: Double = 0.0,
        startTime: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.status = status
        self.description = description
        self.createdAt = Date()
        self.updatedAt = Date()
        self.capabilities = capabilities
        self.currentTask = currentTask
        self.progress = progress
        self.startTime = startTime
    }
}

// MARK: - Agent Type
enum AgentType: String, CaseIterable, Codable {
    case chat = "chat"
    case research = "research"
    case coding = "coding"
    case analysis = "analysis"
    case orchestration = "orchestration"
    case monitoring = "monitoring"
    
    var displayName: String {
        switch self {
        case .chat: return "Chat Agent"
        case .research: return "Research Agent"
        case .coding: return "Coding Agent"
        case .analysis: return "Analysis Agent"
        case .orchestration: return "Orchestration Agent"
        case .monitoring: return "Monitoring Agent"
        }
    }
    
    var icon: String {
        switch self {
        case .chat: return "text.bubble"
        case .research: return "magnifyingglass"
        case .coding: return "chevron.left.forwardslash.chevron.right"
        case .analysis: return "chart.bar"
        case .orchestration: return "brain.head.profile"
        case .monitoring: return "eye"
        }
    }
    
    var color: Color {
        switch self {
        case .chat: return .blue
        case .research: return .green
        case .coding: return .purple
        case .analysis: return .orange
        case .orchestration: return .red
        case .monitoring: return .gray
        }
    }
}

// MARK: - Agent Status
enum AgentStatus: String, CaseIterable, Codable {
    case idle = "idle"
    case active = "active"
    case busy = "busy"
    case error = "error"
    case paused = "paused"
    case inactive = "inactive"
    
    var displayName: String {
        switch self {
        case .idle: return "Idle"
        case .active: return "Active"
        case .busy: return "Busy"
        case .error: return "Error"
        case .paused: return "Paused"
        case .inactive: return "Inactive"
        }
    }
    
    var color: Color {
        switch self {
        case .idle: return .gray
        case .active: return .green
        case .busy: return .orange
        case .error: return .red
        case .paused: return .yellow
        case .inactive: return .secondary
        }
    }
    
    var icon: String {
        switch self {
        case .idle: return "pause.circle"
        case .active: return "play.circle.fill"
        case .busy: return "hourglass"
        case .error: return "exclamationmark.triangle"
        case .paused: return "pause.circle.fill"
        case .inactive: return "circle"
        }
    }
}

// Note: TaskHistory and TaskStatus are defined in SharedTypes.swift to avoid conflicts
