//
//  DashboardLayoutManager.swift
//  UniversalAITools
//
//  Created by Claude Code on 8/15/25.
//  Copyright © 2025 Christian Merrill. All rights reserved.
//

import Foundation
import SwiftUI
import AppKit
import Combine

@MainActor
class DashboardLayoutManager: ObservableObject {
    static let shared = DashboardLayoutManager()
    
    // MARK: - Published Properties
    @Published var currentLayout: DashboardLayout = .defaultLayout
    @Published var availableLayouts: [DashboardLayout] = []
    @Published var panels: [DashboardPanel] = []
    @Published var isDragActive: Bool = false
    @Published var draggedPanel: DashboardPanel?
    @Published var dropTarget: DropTarget?
    @Published var gridConfiguration = GridConfiguration()
    @Published var isFullScreenMode: Bool = false
    @Published var isPictureInPictureActive: Bool = false
    @Published var focusedPanel: DashboardPanel?
    @Published var windowConfiguration = WindowConfiguration()
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private var layoutProfiles: [String: DashboardLayout] = [:]
    private var panelAnimator = PanelAnimator()
    private var gridConstraints = GridConstraints()
    
    // MARK: - Initialization
    private init() {
        setupDefaultPanels()
        loadSavedLayouts()
        setupWindowObservers()
        setupGridSystem()
    }
    
    // MARK: - Public Interface
    
    /// Create a new dashboard panel
    func createPanel(
        id: String? = nil,
        type: PanelType,
        title: String,
        content: AnyView,
        initialFrame: CGRect = CGRect(x: 0, y: 0, width: 300, height: 200)
    ) -> DashboardPanel {
        
        let panel = DashboardPanel(
            id: id ?? UUID().uuidString,
            type: type,
            title: title,
            content: content,
            frame: initialFrame,
            isCollapsible: true,
            isResizable: true,
            isDraggable: true
        )
        
        panels.append(panel)
        arrangeInGrid()
        savePanelsConfiguration()
        
        return panel
    }
    
    /// Remove a panel from the dashboard
    func removePanel(_ panel: DashboardPanel) {
        panels.removeAll { $0.id == panel.id }
        arrangeInGrid()
        savePanelsConfiguration()
    }
    
    /// Toggle panel collapsed state
    func togglePanelCollapse(_ panel: DashboardPanel) {
        if let index = panels.firstIndex(where: { $0.id == panel.id }) {
            panels[index].isCollapsed.toggle()
            
            // Animate collapse/expand
            panelAnimator.animateCollapse(panel: panels[index]) {
                self.arrangeInGrid()
            }
        }
    }
    
    /// Resize panel to new dimensions
    func resizePanel(_ panel: DashboardPanel, to newSize: CGSize) {
        if let index = panels.firstIndex(where: { $0.id == panel.id }) {
            let newFrame = CGRect(
                origin: panels[index].frame.origin,
                size: newSize
            )
            
            panels[index].frame = newFrame
            
            // Validate against constraints
            if !validatePanelConstraints(panels[index]) {
                // Revert if invalid
                return
            }
            
            arrangeInGrid()
            savePanelsConfiguration()
        }
    }
    
    /// Move panel to new position
    func movePanel(_ panel: DashboardPanel, to position: CGPoint) {
        if let index = panels.firstIndex(where: { $0.id == panel.id }) {
            let newFrame = CGRect(
                origin: position,
                size: panels[index].frame.size
            )
            
            panels[index].frame = newFrame
            
            // Snap to grid
            panels[index].frame = snapToGrid(newFrame)
            
            arrangeInGrid()
            savePanelsConfiguration()
        }
    }
    
    /// Start drag operation
    func startDrag(_ panel: DashboardPanel, from point: CGPoint) {
        isDragActive = true
        draggedPanel = panel
        
        // Bring panel to front
        if let index = panels.firstIndex(where: { $0.id == panel.id }) {
            let draggedPanel = panels.remove(at: index)
            panels.append(draggedPanel)
        }
        
        // Start drag animation
        panelAnimator.startDragAnimation(panel)
    }
    
    /// Update drag position
    func updateDrag(to point: CGPoint) {
        guard let panel = draggedPanel else { return }
        
        let newPosition = CGPoint(
            x: point.x - panel.frame.width / 2,
            y: point.y - panel.frame.height / 2
        )
        
        movePanel(panel, to: newPosition)
        updateDropTarget(for: point)
    }
    
    /// End drag operation
    func endDrag(at point: CGPoint) {
        guard let panel = draggedPanel else { return }
        
        // Snap to final position
        let finalPosition = snapToGrid(CGRect(origin: point, size: panel.frame.size)).origin
        movePanel(panel, to: finalPosition)
        
        // Handle drop
        if let target = dropTarget {
            handleDrop(panel, on: target)
        }
        
        // Clean up
        isDragActive = false
        draggedPanel = nil
        dropTarget = nil
        
        panelAnimator.endDragAnimation(panel)
    }
    
    /// Apply layout template
    func applyLayout(_ layout: DashboardLayout) {
        currentLayout = layout
        
        // Clear existing panels if specified
        if layout.clearExisting {
            panels.removeAll()
        }
        
        // Create panels from layout
        for layoutPanel in layout.panels {
            let panel = DashboardPanel(
                id: layoutPanel.id,
                type: layoutPanel.type,
                title: layoutPanel.title,
                content: layoutPanel.contentProvider(),
                frame: layoutPanel.frame,
                isCollapsible: layoutPanel.isCollapsible,
                isResizable: layoutPanel.isResizable,
                isDraggable: layoutPanel.isDraggable
            )
            
            panels.append(panel)
        }
        
        arrangeInGrid()
        savePanelsConfiguration()
    }
    
    /// Save current layout as template
    func saveLayoutAsTemplate(name: String) -> DashboardLayout {
        let layoutPanels = panels.map { panel in
            LayoutPanel(
                id: panel.id,
                type: panel.type,
                title: panel.title,
                frame: panel.frame,
                isCollapsible: panel.isCollapsible,
                isResizable: panel.isResizable,
                isDraggable: panel.isDraggable,
                contentProvider: { panel.content }
            )
        }
        
        let layout = DashboardLayout(
            id: UUID().uuidString,
            name: name,
            panels: layoutPanels,
            gridConfiguration: gridConfiguration,
            clearExisting: false
        )
        
        availableLayouts.append(layout)
        layoutProfiles[name] = layout
        saveLayoutProfiles()
        
        return layout
    }
    
    /// Enter full screen mode for a panel
    func enterFullScreen(_ panel: DashboardPanel) {
        focusedPanel = panel
        isFullScreenMode = true
        
        panelAnimator.animateToFullScreen(panel) {
            // Animation complete
        }
    }
    
    /// Exit full screen mode
    func exitFullScreen() {
        guard let panel = focusedPanel else { return }
        
        isFullScreenMode = false
        focusedPanel = nil
        
        panelAnimator.animateFromFullScreen(panel) {
            self.arrangeInGrid()
        }
    }
    
    /// Enable Picture-in-Picture for a panel
    func enablePictureInPicture(_ panel: DashboardPanel) {
        isPictureInPictureActive = true
        panel.isPictureInPicture = true
        
        // Create floating window
        createFloatingWindow(for: panel)
    }
    
    /// Disable Picture-in-Picture
    func disablePictureInPicture(_ panel: DashboardPanel) {
        isPictureInPictureActive = false
        panel.isPictureInPicture = false
        
        // Close floating window
        closeFloatingWindow(for: panel)
    }
    
    /// Configure multi-monitor setup
    func configureMultiMonitorLayout() {
        let screens = NSScreen.screens
        
        if screens.count > 1 {
            // Distribute panels across screens
            distributeAcrossScreens(screens)
        }
        
        windowConfiguration.multiMonitorMode = screens.count > 1
    }
    
    /// Auto-arrange panels in optimal layout
    func autoArrangePanels() {
        // Use intelligent layout algorithm
        let arrangedPanels = calculateOptimalLayout(panels)
        
        for (index, panel) in arrangedPanels.enumerated() {
            panels[index].frame = panel.frame
        }
        
        panelAnimator.animateRearrangement(arrangedPanels) {
            self.savePanelsConfiguration()
        }
    }
    
    /// Update grid configuration
    func updateGridConfiguration(_ config: GridConfiguration) {
        gridConfiguration = config
        arrangeInGrid()
        savePanelsConfiguration()
    }
    
    /// Get available layout templates
    func getAvailableTemplates() -> [DashboardLayout] {
        return availableLayouts
    }
    
    // MARK: - Private Implementation
    
    private func setupDefaultPanels() {
        // Create default dashboard panels
        panels = []
        
        // Add system monitoring panel
        let systemPanel = createPanel(
            type: .systemMonitoring,
            title: "System Monitor",
            content: AnyView(SystemMonitoringView())
        )
        
        // Add chat panel
        let chatPanel = createPanel(
            type: .chat,
            title: "AI Chat",
            content: AnyView(SimpleChatView())
        )
        
        // Add tools panel
        let toolsPanel = createPanel(
            type: .tools,
            title: "AI Tools",
            content: AnyView(ToolsView())
        )
        
        arrangeInGrid()
    }
    
    private func loadSavedLayouts() {
        // Load saved layout profiles
        if let data = UserDefaults.standard.data(forKey: "DashboardLayouts"),
           let profiles = try? JSONDecoder().decode([String: DashboardLayout].self, from: data) {
            layoutProfiles = profiles
            availableLayouts = Array(profiles.values)
        } else {
            // Create default layouts
            createDefaultLayouts()
        }
    }
    
    private func createDefaultLayouts() {
        // Standard layout
        let standardLayout = DashboardLayout(
            id: "standard",
            name: "Standard",
            panels: [],
            gridConfiguration: GridConfiguration(columns: 3, rows: 2),
            clearExisting: false
        )
        
        // Analytics layout
        let analyticsLayout = DashboardLayout(
            id: "analytics",
            name: "Analytics Dashboard",
            panels: [],
            gridConfiguration: GridConfiguration(columns: 4, rows: 3),
            clearExisting: true
        )
        
        // Development layout
        let devLayout = DashboardLayout(
            id: "development",
            name: "Development",
            panels: [],
            gridConfiguration: GridConfiguration(columns: 2, rows: 3),
            clearExisting: false
        )
        
        availableLayouts = [standardLayout, analyticsLayout, devLayout]
        
        for layout in availableLayouts {
            layoutProfiles[layout.name] = layout
        }
    }
    
    private func setupWindowObservers() {
        // Observe window resize events
        NotificationCenter.default.publisher(for: NSWindow.didResizeNotification)
            .sink { _ in
                self.arrangeInGrid()
            }
            .store(in: &cancellables)
        
        // Observe screen configuration changes
        NotificationCenter.default.publisher(for: NSApplication.didChangeScreenParametersNotification)
            .sink { _ in
                self.configureMultiMonitorLayout()
            }
            .store(in: &cancellables)
    }
    
    private func setupGridSystem() {
        gridConfiguration = GridConfiguration(
            columns: 3,
            rows: 2,
            spacing: 10,
            margins: EdgeInsets(top: 20, leading: 20, bottom: 20, trailing: 20)
        )
        
        gridConstraints = GridConstraints(
            minPanelSize: CGSize(width: 200, height: 150),
            maxPanelSize: CGSize(width: 800, height: 600),
            aspectRatioLocked: false
        )
    }
    
    private func arrangeInGrid() {
        guard !panels.isEmpty else { return }
        
        let availableSize = calculateAvailableSize()
        let grid = calculateGridLayout(for: availableSize)
        
        for (index, panel) in panels.enumerated() {
            if index < grid.cells.count {
                let cell = grid.cells[index]
                panels[index].frame = cell.frame
            }
        }
    }
    
    private func calculateAvailableSize() -> CGSize {
        guard let window = NSApplication.shared.mainWindow else {
            return CGSize(width: 1200, height: 800)
        }
        
        let contentSize = window.contentView?.bounds.size ?? CGSize(width: 1200, height: 800)
        return CGSize(
            width: contentSize.width - gridConfiguration.margins.leading - gridConfiguration.margins.trailing,
            height: contentSize.height - gridConfiguration.margins.top - gridConfiguration.margins.bottom
        )
    }
    
    private func calculateGridLayout(for size: CGSize) -> GridLayout {
        let cellWidth = (size.width - CGFloat(gridConfiguration.columns - 1) * gridConfiguration.spacing) / CGFloat(gridConfiguration.columns)
        let cellHeight = (size.height - CGFloat(gridConfiguration.rows - 1) * gridConfiguration.spacing) / CGFloat(gridConfiguration.rows)
        
        var cells: [GridCell] = []
        
        for row in 0..<gridConfiguration.rows {
            for col in 0..<gridConfiguration.columns {
                let x = gridConfiguration.margins.leading + CGFloat(col) * (cellWidth + gridConfiguration.spacing)
                let y = gridConfiguration.margins.top + CGFloat(row) * (cellHeight + gridConfiguration.spacing)
                
                let cell = GridCell(
                    row: row,
                    column: col,
                    frame: CGRect(x: x, y: y, width: cellWidth, height: cellHeight)
                )
                
                cells.append(cell)
            }
        }
        
        return GridLayout(cells: cells, gridSize: CGSize(width: cellWidth, height: cellHeight))
    }
    
    private func snapToGrid(_ frame: CGRect) -> CGRect {
        let gridSize = calculateGridLayout(for: calculateAvailableSize()).gridSize
        
        let snappedX = round(frame.origin.x / gridSize.width) * gridSize.width
        let snappedY = round(frame.origin.y / gridSize.height) * gridSize.height
        
        return CGRect(
            x: snappedX,
            y: snappedY,
            width: frame.width,
            height: frame.height
        )
    }
    
    private func validatePanelConstraints(_ panel: DashboardPanel) -> Bool {
        return panel.frame.width >= gridConstraints.minPanelSize.width &&
               panel.frame.height >= gridConstraints.minPanelSize.height &&
               panel.frame.width <= gridConstraints.maxPanelSize.width &&
               panel.frame.height <= gridConstraints.maxPanelSize.height
    }
    
    private func updateDropTarget(for point: CGPoint) {
        // Calculate potential drop targets
        for panel in panels {
            if panel.frame.contains(point) && panel != draggedPanel {
                dropTarget = DropTarget(panel: panel, position: .replace)
                return
            }
        }
        
        // Check for edge drop targets
        let edgeTarget = calculateEdgeDropTarget(for: point)
        dropTarget = edgeTarget
    }
    
    private func calculateEdgeDropTarget(for point: CGPoint) -> DropTarget? {
        let availableSize = calculateAvailableSize()
        let threshold: CGFloat = 50
        
        if point.x < threshold {
            return DropTarget(panel: nil, position: .left)
        } else if point.x > availableSize.width - threshold {
            return DropTarget(panel: nil, position: .right)
        } else if point.y < threshold {
            return DropTarget(panel: nil, position: .top)
        } else if point.y > availableSize.height - threshold {
            return DropTarget(panel: nil, position: .bottom)
        }
        
        return nil
    }
    
    private func handleDrop(_ panel: DashboardPanel, on target: DropTarget) {
        switch target.position {
        case .replace:
            if let targetPanel = target.panel {
                // Swap positions
                swapPanels(panel, with: targetPanel)
            }
        case .left, .right, .top, .bottom:
            // Insert at edge
            insertPanelAtEdge(panel, position: target.position)
        }
    }
    
    private func swapPanels(_ panel1: DashboardPanel, with panel2: DashboardPanel) {
        guard let index1 = panels.firstIndex(where: { $0.id == panel1.id }),
              let index2 = panels.firstIndex(where: { $0.id == panel2.id }) else {
            return
        }
        
        let tempFrame = panels[index1].frame
        panels[index1].frame = panels[index2].frame
        panels[index2].frame = tempFrame
        
        panelAnimator.animateSwap(panels[index1], panels[index2]) {
            self.savePanelsConfiguration()
        }
    }
    
    private func insertPanelAtEdge(_ panel: DashboardPanel, position: DropPosition) {
        // Implementation for edge insertion
        arrangeInGrid()
    }
    
    private func calculateOptimalLayout(_ panels: [DashboardPanel]) -> [DashboardPanel] {
        // Intelligent layout algorithm
        var optimizedPanels = panels
        
        // Sort by importance/usage frequency
        optimizedPanels.sort { panel1, panel2 in
            panel1.priority > panel2.priority
        }
        
        // Apply golden ratio for sizing
        let availableSize = calculateAvailableSize()
        let goldenRatio: CGFloat = 1.618
        
        for (index, _) in optimizedPanels.enumerated() {
            let optimalWidth = availableSize.width / CGFloat(gridConfiguration.columns)
            let optimalHeight = optimalWidth / goldenRatio
            
            optimizedPanels[index].frame.size = CGSize(
                width: optimalWidth,
                height: min(optimalHeight, availableSize.height / CGFloat(gridConfiguration.rows))
            )
        }
        
        return optimizedPanels
    }
    
    private func distributeAcrossScreens(_ screens: [NSScreen]) {
        guard screens.count > 1 else { return }
        
        let panelsPerScreen = panels.count / screens.count
        
        for (screenIndex, screen) in screens.enumerated() {
            let startIndex = screenIndex * panelsPerScreen
            let endIndex = min(startIndex + panelsPerScreen, panels.count)
            
            for i in startIndex..<endIndex {
                // Move panel to specific screen
                movePanel(panels[i], to: screen.frame.origin)
            }
        }
    }
    
    private func createFloatingWindow(for panel: DashboardPanel) {
        let window = NSWindow(
            contentRect: panel.frame,
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        window.title = panel.title
        window.contentView = NSHostingView(rootView: panel.content)
        window.makeKeyAndOrderFront(nil)
        
        panel.floatingWindow = window
    }
    
    private func closeFloatingWindow(for panel: DashboardPanel) {
        panel.floatingWindow?.close()
        panel.floatingWindow = nil
    }
    
    private func savePanelsConfiguration() {
        let config = PanelConfiguration(
            panels: panels.map { PanelData(from: $0) },
            gridConfiguration: gridConfiguration,
            windowConfiguration: windowConfiguration
        )
        
        if let data = try? JSONEncoder().encode(config) {
            UserDefaults.standard.set(data, forKey: "DashboardPanelsConfig")
        }
    }
    
    private func saveLayoutProfiles() {
        if let data = try? JSONEncoder().encode(layoutProfiles) {
            UserDefaults.standard.set(data, forKey: "DashboardLayouts")
        }
    }
}

// MARK: - Supporting Types

enum PanelType: String, Codable, CaseIterable {
    case chat
    case systemMonitoring
    case tools
    case analytics
    case visualization
    case settings
    case debug
    case custom
}

enum DropPosition {
    case left, right, top, bottom, replace
}

class DashboardPanel: Identifiable, ObservableObject {
    let id: String
    let type: PanelType
    let title: String
    let content: AnyView
    @Published var frame: CGRect
    @Published var isCollapsed: Bool = false
    @Published var isResizing: Bool = false
    @Published var isDragging: Bool = false
    @Published var isPictureInPicture: Bool = false
    let isCollapsible: Bool
    let isResizable: Bool
    let isDraggable: Bool
    var priority: Int = 0
    var floatingWindow: NSWindow?
    
    init(id: String,
         type: PanelType,
         title: String,
         content: AnyView,
         frame: CGRect,
         isCollapsible: Bool = true,
         isResizable: Bool = true,
         isDraggable: Bool = true) {
        self.id = id
        self.type = type
        self.title = title
        self.content = content
        self.frame = frame
        self.isCollapsible = isCollapsible
        self.isResizable = isResizable
        self.isDraggable = isDraggable
    }
}

struct DashboardLayout: Codable, Identifiable {
    let id: String
    let name: String
    let panels: [LayoutPanel]
    let gridConfiguration: GridConfiguration
    let clearExisting: Bool
    
    static let defaultLayout = DashboardLayout(
        id: "default",
        name: "Default",
        panels: [],
        gridConfiguration: GridConfiguration(),
        clearExisting: false
    )
}

struct LayoutPanel: Codable {
    let id: String
    let type: PanelType
    let title: String
    let frame: CGRect
    let isCollapsible: Bool
    let isResizable: Bool
    let isDraggable: Bool
    let contentProvider: () -> AnyView
    
    enum CodingKeys: String, CodingKey {
        case id, type, title, frame, isCollapsible, isResizable, isDraggable
    }
    
    init(id: String,
         type: PanelType,
         title: String,
         frame: CGRect,
         isCollapsible: Bool,
         isResizable: Bool,
         isDraggable: Bool,
         contentProvider: @escaping () -> AnyView) {
        self.id = id
        self.type = type
        self.title = title
        self.frame = frame
        self.isCollapsible = isCollapsible
        self.isResizable = isResizable
        self.isDraggable = isDraggable
        self.contentProvider = contentProvider
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        type = try container.decode(PanelType.self, forKey: .type)
        title = try container.decode(String.self, forKey: .title)
        frame = try container.decode(CGRect.self, forKey: .frame)
        isCollapsible = try container.decode(Bool.self, forKey: .isCollapsible)
        isResizable = try container.decode(Bool.self, forKey: .isResizable)
        isDraggable = try container.decode(Bool.self, forKey: .isDraggable)
        
        // Provide default content provider
        contentProvider = { AnyView(Text("Panel Content")) }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(type, forKey: .type)
        try container.encode(title, forKey: .title)
        try container.encode(frame, forKey: .frame)
        try container.encode(isCollapsible, forKey: .isCollapsible)
        try container.encode(isResizable, forKey: .isResizable)
        try container.encode(isDraggable, forKey: .isDraggable)
    }
}

struct GridConfiguration: Codable {
    var columns: Int
    var rows: Int
    var spacing: CGFloat
    var margins: EdgeInsets
    var snapToGrid: Bool
    
    init(columns: Int = 3,
         rows: Int = 2,
         spacing: CGFloat = 10,
         margins: EdgeInsets = EdgeInsets(top: 20, leading: 20, bottom: 20, trailing: 20),
         snapToGrid: Bool = true) {
        self.columns = columns
        self.rows = rows
        self.spacing = spacing
        self.margins = margins
        self.snapToGrid = snapToGrid
    }
}

struct GridConstraints {
    let minPanelSize: CGSize
    let maxPanelSize: CGSize
    let aspectRatioLocked: Bool
    
    init(minPanelSize: CGSize = CGSize(width: 200, height: 150),
         maxPanelSize: CGSize = CGSize(width: 800, height: 600),
         aspectRatioLocked: Bool = false) {
        self.minPanelSize = minPanelSize
        self.maxPanelSize = maxPanelSize
        self.aspectRatioLocked = aspectRatioLocked
    }
}

struct GridLayout {
    let cells: [GridCell]
    let gridSize: CGSize
}

struct GridCell {
    let row: Int
    let column: Int
    let frame: CGRect
}

struct DropTarget {
    let panel: DashboardPanel?
    let position: DropPosition
}

struct WindowConfiguration: Codable {
    var multiMonitorMode: Bool = false
    var preferredScreen: Int = 0
    var windowOpacity: Double = 1.0
    var alwaysOnTop: Bool = false
}

struct PanelConfiguration: Codable {
    let panels: [PanelData]
    let gridConfiguration: GridConfiguration
    let windowConfiguration: WindowConfiguration
}

struct PanelData: Codable {
    let id: String
    let type: PanelType
    let title: String
    let frame: CGRect
    let isCollapsed: Bool
    let priority: Int
    
    init(from panel: DashboardPanel) {
        self.id = panel.id
        self.type = panel.type
        self.title = panel.title
        self.frame = panel.frame
        self.isCollapsed = panel.isCollapsed
        self.priority = panel.priority
    }
}

class PanelAnimator {
    private let animationDuration: TimeInterval = 0.3
    
    func animateCollapse(panel: DashboardPanel, completion: @escaping () -> Void) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = animationDuration
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            
            // Animation implementation
        } completionHandler: {
            completion()
        }
    }
    
    func startDragAnimation(_ panel: DashboardPanel) {
        // Start drag visual feedback
    }
    
    func endDragAnimation(_ panel: DashboardPanel) {
        // End drag visual feedback
    }
    
    func animateToFullScreen(_ panel: DashboardPanel, completion: @escaping () -> Void) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = animationDuration
            // Animate to full screen
        } completionHandler: {
            completion()
        }
    }
    
    func animateFromFullScreen(_ panel: DashboardPanel, completion: @escaping () -> Void) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = animationDuration
            // Animate from full screen
        } completionHandler: {
            completion()
        }
    }
    
    func animateSwap(_ panel1: DashboardPanel, _ panel2: DashboardPanel, completion: @escaping () -> Void) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = animationDuration
            // Animate panel swap
        } completionHandler: {
            completion()
        }
    }
    
    func animateRearrangement(_ panels: [DashboardPanel], completion: @escaping () -> Void) {
        NSAnimationContext.runAnimationGroup { context in
            context.duration = animationDuration
            // Animate rearrangement
        } completionHandler: {
            completion()
        }
    }
}

// MARK: - CGRect Codable Extension

extension CGRect: Codable {
    enum CodingKeys: String, CodingKey {
        case x, y, width, height
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let x = try container.decode(CGFloat.self, forKey: .x)
        let y = try container.decode(CGFloat.self, forKey: .y)
        let width = try container.decode(CGFloat.self, forKey: .width)
        let height = try container.decode(CGFloat.self, forKey: .height)
        self.init(x: x, y: y, width: width, height: height)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(origin.x, forKey: .x)
        try container.encode(origin.y, forKey: .y)
        try container.encode(size.width, forKey: .width)
        try container.encode(size.height, forKey: .height)
    }
}

// MARK: - EdgeInsets Codable Extension

extension EdgeInsets: Codable {
    enum CodingKeys: String, CodingKey {
        case top, leading, bottom, trailing
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let top = try container.decode(CGFloat.self, forKey: .top)
        let leading = try container.decode(CGFloat.self, forKey: .leading)
        let bottom = try container.decode(CGFloat.self, forKey: .bottom)
        let trailing = try container.decode(CGFloat.self, forKey: .trailing)
        self.init(top: top, leading: leading, bottom: bottom, trailing: trailing)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(top, forKey: .top)
        try container.encode(leading, forKey: .leading)
        try container.encode(bottom, forKey: .bottom)
        try container.encode(trailing, forKey: .trailing)
    }
}
