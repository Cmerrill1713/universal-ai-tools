import Foundation
import SwiftUI

// MARK: - Sidebar Item
enum SidebarItem: String, CaseIterable, Identifiable, Hashable {
    case chat = "chat"
    case knowledge = "knowledge"
    case objectives = "objectives"
    case orchestration = "orchestration"
    case analytics = "analytics"
    case tools = "tools"
    
    var id: String { rawValue }
    
    var title: String {
        switch self {
        case .chat: return "Chat"
        case .knowledge: return "Knowledge"
        case .objectives: return "Objectives"
        case .orchestration: return "Orchestration"
        case .analytics: return "Analytics"
        case .tools: return "Tools"
        }
    }
    
    var description: String {
        switch self {
        case .chat: return "AI conversations"
        case .knowledge: return "Knowledge graph"
        case .objectives: return "Goal management"
        case .orchestration: return "Agent coordination"
        case .analytics: return "Performance insights"
        case .tools: return "Available tools"
        }
    }
    
    var icon: String {
        switch self {
        case .chat: return "text.bubble"
        case .knowledge: return "point.3.connected.trianglepath.dotted"
        case .objectives: return "target"
        case .orchestration: return "brain.head.profile"
        case .analytics: return "chart.bar.doc.horizontal"
        case .tools: return "wrench.and.screwdriver"
        }
    }
    
    var featureLevel: FeatureLevel {
        switch self {
        case .chat: return .core
        case .knowledge: return .advanced
        case .objectives: return .core
        case .orchestration: return .advanced
        case .analytics: return .advanced
        case .tools: return .core
        }
    }
}

// MARK: - Feature Level
enum FeatureLevel: String, CaseIterable {
    case core = "core"
    case advanced = "advanced"
    case experimental = "experimental"
    
    var displayName: String {
        switch self {
        case .core: return "Core"
        case .advanced: return "Advanced"
        case .experimental: return "Experimental"
        }
    }
    
    var color: Color {
        switch self {
        case .core: return .blue
        case .advanced: return .orange
        case .experimental: return .purple
        }
    }
    
    var badge: String? {
        switch self {
        case .core: return nil
        case .advanced: return "PRO"
        case .experimental: return "BETA"
        }
    }
}

// MARK: - Tool Category
enum ToolCategory: String, CaseIterable, Identifiable {
    case text = "text"
    case code = "code"
    case data = "data"
    case media = "media"
    case system = "system"
    case web = "web"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .text: return "Text Tools"
        case .code: return "Code Tools"
        case .data: return "Data Tools"
        case .media: return "Media Tools"
        case .system: return "System Tools"
        case .web: return "Web Tools"
        }
    }
    
    var icon: String {
        switch self {
        case .text: return "text.alignleft"
        case .code: return "chevron.left.forwardslash.chevron.right"
        case .data: return "tablecells"
        case .media: return "photo.on.rectangle"
        case .system: return "gear"
        case .web: return "globe"
        }
    }
}