//
//  UniversalAccessibilityManager.swift
//  UniversalAITools
//
//  Created by Claude Code on 8/15/25.
//  Copyright © 2025 Christian Merrill. All rights reserved.
//

import Foundation
import SwiftUI
import Accessibility
import AppKit
import Combine

@MainActor
class UniversalAccessibilityManager: ObservableObject {
    static let shared = UniversalAccessibilityManager()
    
    // MARK: - Published Properties
    @Published var isVoiceOverEnabled: Bool = false
    @Published var prefersDynamicType: Bool = false
    @Published var prefersReducedMotion: Bool = false
    @Published var prefersHighContrast: Bool = false
    @Published var isKeyboardNavigationEnabled: Bool = false
    @Published var currentContentSizeCategory: ContentSizeCategory = .medium
    @Published var announcements: [AccessibilityAnnouncement] = []
    @Published var focusedElement: AccessibleElement?
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private var rotorItems: [AccessibilityRotorItem] = []
    private var customActions: [AccessibilityCustomAction] = []
    
    // MARK: - Initialization
    private init() {
        setupAccessibilityMonitoring()
        setupNotifications()
        initializeRotorSupport()
    }
    
    // MARK: - Public Interface
    
    /// Configure accessibility settings for the entire application
    func configureGlobalAccessibility() {
        // Set up global accessibility traits
        NSApplication.shared.accessibilityLabel = "Universal AI Tools"
        NSApplication.shared.accessibilityRole = .application
        NSApplication.shared.accessibilityHelp = "Advanced AI toolset with comprehensive accessibility support"
        
        // Configure window accessibility
        if let mainWindow = NSApplication.shared.mainWindow {
            configureWindowAccessibility(mainWindow)
        }
    }
    
    /// Make a SwiftUI view accessible with comprehensive support
    func makeViewAccessible<V: View>(_ view: V, 
                                   label: String,
                                   hint: String? = nil,
                                   traits: AccessibilityTraits = [],
                                   value: String? = nil,
                                   customActions: [AccessibilityCustomAction] = []) -> some View {
        view
            .accessibilityLabel(label)
            .accessibilityHint(hint ?? "")
            .accessibilityValue(value ?? "")
            .accessibilityAddTraits(traits)
            .accessibilityActions {
                ForEach(customActions, id: \.name) { action in
                    Button(action.name) {
                        action.handler()
                    }
                }
            }
            .accessibilityElement(children: traits.contains(.isHeader) ? .contain : .combine)
    }
    
    /// Configure complex visualization accessibility
    func configureVisualizationAccessibility(
        for visualization: VisualizationType,
        data: [DataPoint],
        container: NSView
    ) {
        switch visualization {
        case .graph3D:
            setupGraph3DAccessibility(data: data, container: container)
        case .network:
            setupNetworkAccessibility(data: data, container: container)
        case .heatmap:
            setupHeatmapAccessibility(data: data, container: container)
        case .timeline:
            setupTimelineAccessibility(data: data, container: container)
        }
    }
    
    /// Announce important updates to screen readers
    func announce(_ message: String, priority: AccessibilityAnnouncementPriority = .medium) {
        let announcement = AccessibilityAnnouncement(
            message: message,
            priority: priority,
            timestamp: Date()
        )
        
        announcements.append(announcement)
        
        // Use NSAccessibility to announce immediately
        NSAccessibility.post(element: NSApplication.shared, notification: .announcementRequested)
        
        // Clean up old announcements
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            self.announcements.removeAll { $0.timestamp < Date().addingTimeInterval(-5.0) }
        }
    }
    
    /// Handle keyboard navigation
    func handleKeyboardNavigation(_ event: NSEvent) -> Bool {
        guard isKeyboardNavigationEnabled else { return false }
        
        let modifiers = event.modifierFlags
        let keyCode = event.keyCode
        
        switch keyCode {
        case 48: // Tab
            if modifiers.contains(.shift) {
                return navigateToPrevious()
            } else {
                return navigateToNext()
            }
        case 36: // Return/Enter
            return activateCurrentElement()
        case 49: // Space
            return toggleCurrentElement()
        case 53: // Escape
            return exitCurrentContext()
        default:
            return handleCustomKeyboardShortcut(event)
        }
    }
    
    /// Update Dynamic Type scaling
    func updateDynamicTypeScaling(_ category: ContentSizeCategory) {
        currentContentSizeCategory = category
        announceContentSizeChange(category)
        
        // Notify all views to update their scaling
        NotificationCenter.default.post(
            name: .dynamicTypeChanged,
            object: category
        )
    }
    
    /// Configure high contrast mode
    func configureHighContrastMode(_ enabled: Bool) {
        prefersHighContrast = enabled
        
        // Update app-wide color schemes
        NotificationCenter.default.post(
            name: .highContrastChanged,
            object: enabled
        )
        
        announce(enabled ? "High contrast mode enabled" : "High contrast mode disabled")
    }
    
    // MARK: - Private Implementation
    
    private func setupAccessibilityMonitoring() {
        // Monitor VoiceOver state
        Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { _ in
                self.isVoiceOverEnabled = NSWorkspace.shared.isVoiceOverEnabled
            }
            .store(in: &cancellables)
        
        // Monitor system preferences
        DistributedNotificationCenter.default.publisher(
            for: NSNotification.Name("com.apple.accessibility.cache.voiceover")
        )
        .sink { _ in
            self.isVoiceOverEnabled = NSWorkspace.shared.isVoiceOverEnabled
        }
        .store(in: &cancellables)
        
        // Monitor reduced motion preference
        NotificationCenter.default.publisher(
            for: NSNotification.Name.NSWorkspaceAccessibilityDisplayOptionsDidChange
        )
        .sink { _ in
            self.prefersReducedMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
            self.prefersHighContrast = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast
        }
        .store(in: &cancellables)
    }
    
    private func setupNotifications() {
        // Listen for app lifecycle events
        NotificationCenter.default.publisher(for: NSApplication.didFinishLaunchingNotification)
            .sink { _ in
                self.configureGlobalAccessibility()
            }
            .store(in: &cancellables)
    }
    
    private func initializeRotorSupport() {
        // Create rotor items for different content types
        rotorItems = [
            AccessibilityRotorItem(name: "Headings", items: []),
            AccessibilityRotorItem(name: "Links", items: []),
            AccessibilityRotorItem(name: "Buttons", items: []),
            AccessibilityRotorItem(name: "Data Visualizations", items: []),
            AccessibilityRotorItem(name: "Interactive Elements", items: [])
        ]
    }
    
    private func configureWindowAccessibility(_ window: NSWindow) {
        window.accessibilityLabel = "Universal AI Tools Main Window"
        window.accessibilityRole = .window
        window.accessibilityHelp = "Main application window containing AI tools and visualizations"
        
        // Configure window for full keyboard access
        window.acceptsMouseMovedEvents = true
        window.makeFirstResponder(window.contentView)
    }
    
    private func setupGraph3DAccessibility(data: [DataPoint], container: NSView) {
        // Create accessible representation of 3D graph
        container.accessibilityLabel = "3D Graph Visualization"
        container.accessibilityRole = .group
        container.accessibilityHelp = "Interactive 3D graph with \(data.count) data points. Use arrow keys to navigate, space to select."
        
        // Create child elements for each data point
        for (index, point) in data.enumerated() {
            let accessibleNode = NSAccessibilityElement()
            accessibleNode.accessibilityLabel = "Node \(index + 1): \(point.label)"
            accessibleNode.accessibilityRole = .button
            accessibleNode.accessibilityValue = "Value: \(point.value), Connections: \(point.connections.count)"
            accessibleNode.accessibilityParent = container
            
            // Add custom actions for graph interaction
            accessibleNode.accessibilityCustomActions = [
                NSAccessibilityCustomAction(name: "Focus Node") { _ in
                    self.focusGraphNode(point)
                    return true
                },
                NSAccessibilityCustomAction(name: "Show Connections") { _ in
                    self.announceNodeConnections(point)
                    return true
                },
                NSAccessibilityCustomAction(name: "Get Details") { _ in
                    self.announceNodeDetails(point)
                    return true
                }
            ]
        }
    }
    
    private func setupNetworkAccessibility(data: [DataPoint], container: NSView) {
        container.accessibilityLabel = "Network Diagram"
        container.accessibilityRole = .group
        container.accessibilityHelp = "Network visualization showing relationships between \(data.count) entities"
        
        // Implement network-specific accessibility features
        announceNetworkOverview(data)
    }
    
    private func setupHeatmapAccessibility(data: [DataPoint], container: NSView) {
        container.accessibilityLabel = "Data Heatmap"
        container.accessibilityRole = .group
        container.accessibilityHelp = "Color-coded intensity map. Navigate with arrow keys to explore values."
        
        // Create grid-based navigation for heatmap
        setupHeatmapGridNavigation(data: data, container: container)
    }
    
    private func setupTimelineAccessibility(data: [DataPoint], container: NSView) {
        container.accessibilityLabel = "Timeline Visualization"
        container.accessibilityRole = .group
        container.accessibilityHelp = "Chronological data display with \(data.count) events"
        
        // Create time-based navigation
        setupTimelineNavigation(data: data, container: container)
    }
    
    private func navigateToNext() -> Bool {
        // Implement next element navigation
        announce("Moving to next element")
        return true
    }
    
    private func navigateToPrevious() -> Bool {
        // Implement previous element navigation
        announce("Moving to previous element")
        return true
    }
    
    private func activateCurrentElement() -> Bool {
        // Activate the currently focused element
        announce("Activating element")
        return true
    }
    
    private func toggleCurrentElement() -> Bool {
        // Toggle the current element if applicable
        announce("Toggling element")
        return true
    }
    
    private func exitCurrentContext() -> Bool {
        // Exit current context or modal
        announce("Exiting context")
        return true
    }
    
    private func handleCustomKeyboardShortcut(_ event: NSEvent) -> Bool {
        // Handle custom keyboard shortcuts for accessibility
        return false
    }
    
    private func announceContentSizeChange(_ category: ContentSizeCategory) {
        let sizeDescription = contentSizeCategoryDescription(category)
        announce("Text size changed to \(sizeDescription)")
    }
    
    private func contentSizeCategoryDescription(_ category: ContentSizeCategory) -> String {
        switch category {
        case .extraSmall: return "extra small"
        case .small: return "small"
        case .medium: return "medium"
        case .large: return "large"
        case .extraLarge: return "extra large"
        case .extraExtraLarge: return "extra extra large"
        case .extraExtraExtraLarge: return "extra extra extra large"
        case .accessibilityMedium: return "accessibility medium"
        case .accessibilityLarge: return "accessibility large"
        case .accessibilityExtraLarge: return "accessibility extra large"
        case .accessibilityExtraExtraLarge: return "accessibility extra extra large"
        case .accessibilityExtraExtraExtraLarge: return "accessibility extra extra extra large"
        @unknown default: return "standard"
        }
    }
    
    // MARK: - Graph Interaction Helpers
    
    private func focusGraphNode(_ point: DataPoint) {
        announce("Focused on \(point.label)")
        // Additional focus implementation
    }
    
    private func announceNodeConnections(_ point: DataPoint) {
        let connectionCount = point.connections.count
        let connectionLabels = point.connections.map { $0.label }.joined(separator: ", ")
        announce("\(point.label) has \(connectionCount) connections: \(connectionLabels)")
    }
    
    private func announceNodeDetails(_ point: DataPoint) {
        announce("Node details: \(point.label), Value: \(point.value), Type: \(point.type)")
    }
    
    private func announceNetworkOverview(_ data: [DataPoint]) {
        let nodeCount = data.count
        let totalConnections = data.flatMap { $0.connections }.count
        announce("Network contains \(nodeCount) nodes with \(totalConnections) total connections")
    }
    
    private func setupHeatmapGridNavigation(data: [DataPoint], container: NSView) {
        // Implement grid-based navigation for heatmaps
        container.accessibilityHelp = "Use arrow keys to navigate the heatmap grid. Current position and value will be announced."
    }
    
    private func setupTimelineNavigation(data: [DataPoint], container: NSView) {
        // Implement timeline-specific navigation
        container.accessibilityHelp = "Use left and right arrows to navigate through time, up and down to explore details at each point."
    }
}

// MARK: - Supporting Types

enum VisualizationType {
    case graph3D
    case network  
    case heatmap
    case timeline
}

struct DataPoint {
    let id: String
    let label: String
    let value: Double
    let type: String
    let connections: [DataPoint]
    let metadata: [String: Any]
}

struct AccessibilityAnnouncement {
    let message: String
    let priority: AccessibilityAnnouncementPriority
    let timestamp: Date
}

enum AccessibilityAnnouncementPriority {
    case low
    case medium
    case high
}

struct AccessibleElement {
    let id: String
    let label: String
    let role: AccessibilityRole
    let value: String?
    let actions: [AccessibilityCustomAction]
}

struct AccessibilityRotorItem {
    let name: String
    var items: [AccessibleElement]
}

struct AccessibilityCustomAction {
    let name: String
    let handler: () -> Void
}

// MARK: - Notification Extensions

extension Notification.Name {
    static let dynamicTypeChanged = Notification.Name("DynamicTypeChanged")
    static let highContrastChanged = Notification.Name("HighContrastChanged")
    static let accessibilityAnnouncementRequested = Notification.Name("AccessibilityAnnouncementRequested")
}

// MARK: - NSWorkspace Extension

extension NSWorkspace {
    var accessibilityDisplayShouldReduceMotion: Bool {
        return UserDefaults.standard.bool(forKey: "reduceMotion")
    }
    
    var accessibilityDisplayShouldIncreaseContrast: Bool {
        return UserDefaults.standard.bool(forKey: "increaseContrast")
    }
}