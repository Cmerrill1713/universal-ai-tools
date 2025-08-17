import Foundation
import SwiftUI

// MARK: - Enhanced Navigation Models

/// Navigation feature item representing any discoverable feature in the app
struct NavigationFeature: Identifiable, Hashable, Codable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let category: FeatureCategory
    let level: FeatureLevel
    let keywords: [String]
    let shortcutKey: String?
    let isNew: Bool
    let isEnabled: Bool
    let requiresPro: Bool
    let action: NavigationAction
    
    init(
        id: String,
        title: String,
        description: String,
        icon: String,
        category: FeatureCategory,
        level: FeatureLevel = .core,
        keywords: [String] = [],
        shortcutKey: String? = nil,
        isNew: Bool = false,
        isEnabled: Bool = true,
        requiresPro: Bool = false,
        action: NavigationAction
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.icon = icon
        self.category = category
        self.level = level
        self.keywords = keywords
        self.shortcutKey = shortcutKey
        self.isNew = isNew
        self.isEnabled = isEnabled
        self.requiresPro = requiresPro
        self.action = action
    }
}

/// Feature categories for grouping navigation items
enum FeatureCategory: String, CaseIterable, Identifiable {
    case core = "core"
    case ai = "ai"
    case analytics = "analytics"
    case agents = "agents"
    case knowledge = "knowledge"
    case tools = "tools"
    case monitoring = "monitoring"
    case advanced = "advanced"
    case settings = "settings"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .core: return "Core Features"
        case .ai: return "AI & Chat"
        case .analytics: return "Analytics & Insights"
        case .agents: return "Agent System"
        case .knowledge: return "Knowledge Management"
        case .tools: return "Tools & Utilities"
        case .monitoring: return "System Monitoring"
        case .advanced: return "Advanced Features"
        case .settings: return "Settings & Preferences"
        }
    }
    
    var icon: String {
        switch self {
        case .core: return "star.fill"
        case .ai: return "brain.head.profile"
        case .analytics: return "chart.bar.fill"
        case .agents: return "network"
        case .knowledge: return "book.fill"
        case .tools: return "wrench.and.screwdriver.fill"
        case .monitoring: return "gauge.high"
        case .advanced: return "gearshape.2.fill"
        case .settings: return "gear"
        }
    }
    
    var color: Color {
        switch self {
        case .core: return .blue
        case .ai: return .purple
        case .analytics: return .orange
        case .agents: return .green
        case .knowledge: return .indigo
        case .tools: return .gray
        case .monitoring: return .red
        case .advanced: return .pink
        case .settings: return .secondary
        }
    }
}

/// Navigation actions that can be triggered
enum NavigationAction: Codable, Hashable {
    case showView(String)
    case openWindow(String)
    case executeCommand(String)
    case showSettings
    case startTour(String)
    case custom(String)
    
    var description: String {
        switch self {
        case .showView(let view): return "Show \(view)"
        case .openWindow(let window): return "Open \(window) window"
        case .executeCommand(let command): return "Execute \(command)"
        case .showSettings: return "Show settings"
        case .startTour(let tour): return "Start \(tour) tour"
        case .custom(let action): return action
        }
    }
}

/// Feature usage tracking for recommendations
struct FeatureUsage: Codable {
    let featureId: String
    var usageCount: Int
    var lastUsed: Date
    var averageSessionDuration: TimeInterval
    
    init(featureId: String) {
        self.featureId = featureId
        self.usageCount = 0
        self.lastUsed = Date()
        self.averageSessionDuration = 0
    }
    
    mutating func recordUsage(sessionDuration: TimeInterval = 0) {
        usageCount += 1
        lastUsed = Date()
        if sessionDuration > 0 {
            averageSessionDuration = (averageSessionDuration * Double(usageCount - 1) + sessionDuration) / Double(usageCount)
        }
    }
}

/// Tour step for guided feature discovery
struct TourStep: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let targetElement: String?
    let position: TourStepPosition
    let actions: [TourAction]
    
    enum TourStepPosition: String, Codable {
        case top, bottom, left, right, center, overlay
    }
    
    enum TourAction: String, Codable {
        case highlight, click, navigate, wait, custom
    }
}

/// Complete guided tour definition
struct GuidedTour: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let category: FeatureCategory
    let estimatedDuration: TimeInterval
    let prerequisites: [String]
    let steps: [TourStep]
    let isCompleted: Bool
    
    init(
        id: String,
        title: String,
        description: String,
        category: FeatureCategory,
        estimatedDuration: TimeInterval,
        prerequisites: [String] = [],
        steps: [TourStep],
        isCompleted: Bool = false
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.category = category
        self.estimatedDuration = estimatedDuration
        self.prerequisites = prerequisites
        self.steps = steps
        self.isCompleted = isCompleted
    }
}

/// Navigation breadcrumb for showing current location
struct NavigationBreadcrumb: Identifiable {
    let id: String
    let title: String
    let icon: String?
    let action: (() -> Void)?
    
    init(id: String, title: String, icon: String? = nil, action: (() -> Void)? = nil) {
        self.id = id
        self.title = title
        self.icon = icon
        self.action = action
    }
}

/// Smart suggestion based on context and usage patterns
struct SmartSuggestion: Identifiable {
    let id: String
    let feature: NavigationFeature
    let reason: SuggestionReason
    let confidence: Double // 0.0 to 1.0
    let contextualHint: String?
    
    enum SuggestionReason: String, CaseIterable {
        case frequentlyUsed = "frequently_used"
        case relatedToCurrentView = "related_to_current"
        case newFeature = "new_feature"
        case workflowOptimization = "workflow_optimization"
        case timeBasedPattern = "time_based"
        case similarUsersBehavior = "similar_users"
        
        var displayName: String {
            switch self {
            case .frequentlyUsed: return "Frequently Used"
            case .relatedToCurrentView: return "Related to Current View"
            case .newFeature: return "New Feature"
            case .workflowOptimization: return "Workflow Optimization"
            case .timeBasedPattern: return "Time-based Pattern"
            case .similarUsersBehavior: return "Popular Choice"
            }
        }
        
        var icon: String {
            switch self {
            case .frequentlyUsed: return "clock.fill"
            case .relatedToCurrentView: return "link"
            case .newFeature: return "sparkles"
            case .workflowOptimization: return "arrow.triangle.branch"
            case .timeBasedPattern: return "calendar"
            case .similarUsersBehavior: return "person.2.fill"
            }
        }
    }
}

/// Command palette item for global search and execution
struct CommandPaletteItem: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let icon: String
    let category: CommandCategory
    let shortcut: String?
    let action: () -> Void
    let searchKeywords: [String]
    
    enum CommandCategory: String, CaseIterable {
        case navigation = "navigation"
        case action = "action"
        case window = "window"
        case tool = "tool"
        case setting = "setting"
        case recent = "recent"
        
        var displayName: String {
            switch self {
            case .navigation: return "Navigation"
            case .action: return "Actions"
            case .window: return "Windows"
            case .tool: return "Tools"
            case .setting: return "Settings"
            case .recent: return "Recent"
            }
        }
        
        var icon: String {
            switch self {
            case .navigation: return "arrow.right.circle"
            case .action: return "play.circle"
            case .window: return "macwindow"
            case .tool: return "wrench"
            case .setting: return "gear"
            case .recent: return "clock"
            }
        }
    }
}

/// Enhanced sidebar section with progressive disclosure
struct NavigationSection: Identifiable {
    let id: String
    let title: String
    let icon: String
    let category: FeatureCategory
    let features: [NavigationFeature]
    let isCollapsible: Bool
    let defaultExpanded: Bool
    let showBadge: Bool
    let badgeCount: Int?
    
    init(
        id: String,
        title: String,
        icon: String,
        category: FeatureCategory,
        features: [NavigationFeature],
        isCollapsible: Bool = true,
        defaultExpanded: Bool = true,
        showBadge: Bool = false,
        badgeCount: Int? = nil
    ) {
        self.id = id
        self.title = title
        self.icon = icon
        self.category = category
        self.features = features
        self.isCollapsible = isCollapsible
        self.defaultExpanded = defaultExpanded
        self.showBadge = showBadge
        self.badgeCount = badgeCount
    }
}

/// User preference for navigation behavior
struct NavigationPreferences: Codable {
    var compactMode: Bool = false
    var showDescriptions: Bool = true
    var showShortcuts: Bool = true
    var showBadges: Bool = true
    var autoExpandSections: Bool = true
    var enableSmartSuggestions: Bool = true
    var enableTours: Bool = true
    var groupByCategory: Bool = true
    var showRecentlyUsed: Bool = true
    var maxRecentItems: Int = 5
    
    // Command palette preferences
    var commandPaletteMaxResults: Int = 20
    var enableFuzzySearch: Bool = true
    var showCommandShortcuts: Bool = true
}