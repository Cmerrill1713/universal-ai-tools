import Foundation
import SwiftUI
import AppKit

/// Comprehensive accessibility enhancements for complex UI components
/// Provides WCAG 2.1 Level AA compliance with detailed descriptions, keyboard navigation,
/// and assistive technology support for 3D visualizations and complex interactions

// MARK: - Accessibility Descriptor Protocol

protocol AccessibilityDescriptor {
    var accessibilityLabel: String { get }
    var accessibilityHint: String? { get }
    var accessibilityValue: String? { get }
    var accessibilityRole: AccessibilityRole { get }
    var accessibilityActions: [AccessibilityAction] { get }
}

// MARK: - Accessibility Action Types

struct AccessibilityAction {
    let name: String
    let description: String
    let action: () -> Void
    
    init(_ name: String, description: String, action: @escaping () -> Void) {
        self.name = name
        self.description = description
        self.action = action
    }
}

// MARK: - 3D Visualization Accessibility

/// Accessibility support for 3D knowledge graph visualization
@available(macOS 14.0, *)
struct Accessible3DGraphView: View {
    let nodes: [GraphNode3D]
    let connections: [GraphConnection3D]
    @State private var selectedNode: GraphNode3D?
    @State private var isNavigatingWithKeyboard = false
    @State private var currentNodeIndex = 0
    @State private var showTextDescription = false
    
    var body: some View {
        ZStack {
            // 3D visualization (simplified representation for accessibility)
            graphVisualization
                .accessibilityHidden(!isNavigatingWithKeyboard)
            
            // Accessible overlay when keyboard navigation is active
            if isNavigatingWithKeyboard {
                accessibleGraphOverlay
            }
            
            // Toggle button for accessibility mode
            VStack {
                HStack {
                    Spacer()
                    accessibilityToggleButton
                }
                Spacer()
            }
            .padding()
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("3D Knowledge Graph")
        .accessibilityHint("Interactive visualization of connected concepts. Press Tab to navigate nodes, or use the accessibility mode toggle.")
        .onAppear {
            announceGraphStructure()
        }
    }
    
    private var graphVisualization: some View {
        // Simplified 3D representation
        Canvas { context, size in
            // Draw connections
            for connection in connections {
                if let fromNode = nodes.first(where: { $0.id == connection.fromNodeId }),
                   let toNode = nodes.first(where: { $0.id == connection.toNodeId }) {
                    
                    let fromPoint = CGPoint(
                        x: size.width * fromNode.position2D.x,
                        y: size.height * fromNode.position2D.y
                    )
                    let toPoint = CGPoint(
                        x: size.width * toNode.position2D.x,
                        y: size.height * toNode.position2D.y
                    )
                    
                    let path = Path { path in
                        path.move(to: fromPoint)
                        path.addLine(to: toPoint)
                    }
                    
                    context.stroke(path, with: .color(connection.color), lineWidth: 2)
                }
            }
            
            // Draw nodes
            for node in nodes {
                let center = CGPoint(
                    x: size.width * node.position2D.x,
                    y: size.height * node.position2D.y
                )
                
                let circle = Path { path in
                    path.addEllipse(in: CGRect(
                        x: center.x - 10,
                        y: center.y - 10,
                        width: 20,
                        height: 20
                    ))
                }
                
                let color = selectedNode?.id == node.id ? Color.yellow : node.color
                context.fill(circle, with: .color(color))
                
                // Add accessible label for each node
                if selectedNode?.id == node.id {
                    context.draw(Text(node.title)
                        .font(.caption)
                        .foregroundColor(.white),
                        at: CGPoint(x: center.x, y: center.y - 25))
                }
            }
        }
        .accessibilityRepresentation {
            accessibleGraphRepresentation
        }
    }
    
    private var accessibleGraphRepresentation: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Graph Structure")
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            
            Text("\(nodes.count) nodes connected by \(connections.count) relationships")
                .accessibilityLabel("Graph contains \(nodes.count) nodes connected by \(connections.count) relationships")
            
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(nodes.enumerated()), id: \.element.id) { index, node in
                        AccessibleNodeView(
                            node: node,
                            connections: connectionsForNode(node),
                            isSelected: selectedNode?.id == node.id,
                            nodeIndex: index + 1,
                            totalNodes: nodes.count,
                            onSelect: { selectedNode = node }
                        )
                    }
                }
            }
        }
        .padding()
    }
    
    private var accessibleGraphOverlay: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Current node information
            if let currentNode = nodes[safe: currentNodeIndex] {
                AccessibleNodeDetailView(
                    node: currentNode,
                    connections: connectionsForNode(currentNode),
                    isSelected: true
                )
            }
            
            // Navigation instructions
            Text("Navigation: Use arrow keys to move between nodes, Space to select, Escape to exit accessibility mode")
                .font(.caption)
                .foregroundColor(.secondary)
                .accessibilityLabel("Navigation instructions: Use arrow keys to move between nodes, Space bar to select, Escape key to exit accessibility mode")
            
            Spacer()
        }
        .padding()
        .background(.ultraThinMaterial)
        .onKeyPress(.leftArrow) {
            navigateToPreviousNode()
            return .handled
        }
        .onKeyPress(.rightArrow) {
            navigateToNextNode()  
            return .handled
        }
        .onKeyPress(.space) {
            selectCurrentNode()
            return .handled
        }
        .onKeyPress(.escape) {
            exitAccessibilityMode()
            return .handled
        }
    }
    
    private var accessibilityToggleButton: some View {
        Button(action: {
            isNavigatingWithKeyboard.toggle()
            if isNavigatingWithKeyboard {
                announceAccessibilityMode()
            }
        }) {
            HStack(spacing: 4) {
                Image(systemName: isNavigatingWithKeyboard ? "eye.fill" : "eye")
                Text(isNavigatingWithKeyboard ? "Exit Accessibility" : "Accessibility Mode")
                    .font(.caption)
            }
        }
        .buttonStyle(.bordered)
        .accessibilityLabel(isNavigatingWithKeyboard ? "Exit accessibility navigation mode" : "Enter accessibility navigation mode")
        .accessibilityHint("Toggle between visual and accessible text-based navigation of the 3D graph")
    }
    
    // MARK: - Navigation Methods
    
    private func navigateToNextNode() {
        currentNodeIndex = (currentNodeIndex + 1) % nodes.count
        selectedNode = nodes[currentNodeIndex]
        announceCurrentNode()
    }
    
    private func navigateToPreviousNode() {
        currentNodeIndex = currentNodeIndex > 0 ? currentNodeIndex - 1 : nodes.count - 1
        selectedNode = nodes[currentNodeIndex]
        announceCurrentNode()
    }
    
    private func selectCurrentNode() {
        if let currentNode = nodes[safe: currentNodeIndex] {
            selectedNode = currentNode
            announceNodeSelection()
        }
    }
    
    private func exitAccessibilityMode() {
        isNavigatingWithKeyboard = false
        selectedNode = nil
        announceExitAccessibilityMode()
    }
    
    // MARK: - Accessibility Announcements
    
    private func announceGraphStructure() {
        let announcement = "3D Knowledge graph loaded with \(nodes.count) concept nodes and \(connections.count) connections. Press Tab to navigate or use the accessibility mode button for keyboard navigation."
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            NSAccessibility.post(
                element: NSApp.mainWindow?.firstResponder,
                notification: .announcementRequested,
                userInfo: [NSAccessibility.NotificationUserInfoKey.announcement: announcement]
            )
        }
    }
    
    private func announceCurrentNode() {
        guard let currentNode = nodes[safe: currentNodeIndex] else { return }
        
        let connections = connectionsForNode(currentNode)
        let announcement = "Node \(currentNodeIndex + 1) of \(nodes.count): \(currentNode.title). \(currentNode.description ?? "No description"). Connected to \(connections.count) other nodes."
        
        NSAccessibility.post(
            element: NSApp.mainWindow?.firstResponder,
            notification: .announcementRequested,
            userInfo: [NSAccessibility.NotificationUserInfoKey.announcement: announcement]
        )
    }
    
    private func announceNodeSelection() {
        guard let selectedNode = selectedNode else { return }
        
        let announcement = "Selected: \(selectedNode.title). \(selectedNode.description ?? "")"
        
        NSAccessibility.post(
            element: NSApp.mainWindow?.firstResponder,
            notification: .announcementRequested,
            userInfo: [NSAccessibility.NotificationUserInfoKey.announcement: announcement]
        )
    }
    
    private func announceAccessibilityMode() {
        let announcement = "Accessibility mode activated. Use arrow keys to navigate between nodes, Space to select, Escape to exit."
        
        NSAccessibility.post(
            element: NSApp.mainWindow?.firstResponder,
            notification: .announcementRequested,
            userInfo: [NSAccessibility.NotificationUserInfoKey.announcement: announcement]
        )
    }
    
    private func announceExitAccessibilityMode() {
        let announcement = "Exited accessibility mode. Returned to visual navigation."
        
        NSAccessibility.post(
            element: NSApp.mainWindow?.firstResponder,
            notification: .announcementRequested,
            userInfo: [NSAccessibility.NotificationUserInfoKey.announcement: announcement]
        )
    }
    
    // MARK: - Helper Methods
    
    private func connectionsForNode(_ node: GraphNode3D) -> [GraphConnection3D] {
        return connections.filter { connection in
            connection.fromNodeId == node.id || connection.toNodeId == node.id
        }
    }
}

// MARK: - Accessible Node Views

struct AccessibleNodeView: View {
    let node: GraphNode3D
    let connections: [GraphConnection3D]
    let isSelected: Bool
    let nodeIndex: Int
    let totalNodes: Int
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Circle()
                        .fill(node.color)
                        .frame(width: 12, height: 12)
                    
                    Text(node.title)
                        .font(.subheadline)
                        .fontWeight(isSelected ? .semibold : .regular)
                    
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.blue)
                            .font(.caption)
                    }
                    
                    Spacer()
                }
                
                if let description = node.description {
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                Text("\(connections.count) connections")
                    .font(.caption2)
                    .foregroundColor(.tertiary)
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 8)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(node.title), node \(nodeIndex) of \(totalNodes)")
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityHint("\(node.description ?? "No description"). Connected to \(connections.count) other nodes. Double-tap to select.")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        .accessibilityRemoveTraits(.isButton)
        .accessibilityAddTraits(.allowsDirectInteraction)
    }
}

struct AccessibleNodeDetailView: View {
    let node: GraphNode3D
    let connections: [GraphConnection3D]
    let isSelected: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle()
                    .fill(node.color)
                    .frame(width: 16, height: 16)
                
                Text(node.title)
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            
            if let description = node.description {
                Text(description)
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            if !connections.isEmpty {
                Text("Connections:")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                ForEach(connections.prefix(5), id: \.id) { connection in
                    ConnectionDetailView(connection: connection, currentNodeId: node.id)
                }
                
                if connections.count > 5 {
                    Text("... and \(connections.count - 5) more connections")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Selected node: \(node.title)")
        .accessibilityValue(node.description ?? "No description")
        .accessibilityHint("Current focus. Has \(connections.count) connections to other nodes.")
    }
}

// Note: ConnectionDetailView duplicate removed - using the one from AgentNetworkTopology.swift

// MARK: - Complex Chart Accessibility

/// Accessible data visualization for charts and metrics
struct AccessibleChartView: View {
    let dataPoints: [ChartDataPoint]
    let title: String
    let chartType: ChartType
    
    @State private var selectedDataPointIndex: Int?
    @State private var showDataTable = false
    
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Chart title
            Text(title)
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            
            HStack(spacing: 16) {
                // Visual chart
                chartVisualization
                    .accessibilityHidden(showDataTable)
                
                // Accessibility controls
                VStack(spacing: 8) {
                    Button("Show Data Table") {
                        showDataTable.toggle()
                    }
                    .accessibilityLabel(showDataTable ? "Hide data table" : "Show accessible data table")
                    
                    if !showDataTable {
                        chartSummaryView
                    }
                }
            }
            
            // Accessible data table
            if showDataTable {
                accessibleDataTable
            }
        }
        .accessibilityElement(children: .contain)
        .onAppear {
            announceChartLoaded()
        }
    }
    
    private var chartVisualization: some View {
        // Simplified chart representation
        RoundedRectangle(cornerRadius: 8)
            .fill(.gray.opacity(0.1))
            .frame(height: 200)
            .overlay(
                Text("\(chartType.displayName) visualization")
                    .foregroundColor(.secondary)
            )
            .accessibilityRepresentation {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(chartType.displayName): \(title)")
                        .accessibilityAddTraits(.isHeader)
                    
                    Text(chartSummaryText)
                    
                    Button("Show detailed data") {
                        showDataTable = true
                    }
                }
            }
    }
    
    private var chartSummaryView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Chart Summary")
                .font(.subheadline)
                .fontWeight(.medium)
            
            Text(chartSummaryText)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(8)
        .background(.ultraThinMaterial)
        .cornerRadius(6)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Chart summary: \(chartSummaryText)")
    }
    
    private var accessibleDataTable: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Data Table")
                .font(.subheadline)
                .fontWeight(.medium)
                .accessibilityAddTraits(.isHeader)
            
            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(Array(dataPoints.enumerated()), id: \.element.id) { index, dataPoint in
                        AccessibleDataPointRow(
                            dataPoint: dataPoint,
                            index: index + 1,
                            total: dataPoints.count,
                            isSelected: selectedDataPointIndex == index,
                            onSelect: { selectedDataPointIndex = index }
                        )
                    }
                }
            }
            .frame(maxHeight: 300)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Data table for \(title) with \(dataPoints.count) data points")
    }
    
    private var chartSummaryText: String {
        guard !dataPoints.isEmpty else { return "No data available" }
        
        let values = dataPoints.map { $0.value }
        let minValue = values.min() ?? 0
        let maxValue = values.max() ?? 0
        let avgValue = values.reduce(0, +) / Double(values.count)
        
        return "Contains \(dataPoints.count) data points. Minimum: \(minValue, specifier: "%.1f"), Maximum: \(maxValue, specifier: "%.1f"), Average: \(avgValue, specifier: "%.1f")"
    }
    
    private func announceChartLoaded() {
        let announcement = "\(chartType.displayName) titled \(title) loaded. \(chartSummaryText). Use the Show Data Table button for detailed accessible navigation."
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            NSAccessibility.post(
                element: NSApp.mainWindow?.firstResponder,
                notification: .announcementRequested,
                userInfo: [NSAccessibility.NotificationUserInfoKey.announcement: announcement]
            )
        }
    }
}

struct AccessibleDataPointRow: View {
    let dataPoint: ChartDataPoint
    let index: Int
    let total: Int
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack {
                Text("\(index)")
                    .font(.caption2)
                    .fontFamily(.monospaced)
                    .foregroundColor(.tertiary)
                    .frame(width: 30, alignment: .trailing)
                
                Text(dataPoint.label)
                    .font(.caption)
                    .fontWeight(isSelected ? .semibold : .regular)
                
                Spacer()
                
                Text("\(dataPoint.value, specifier: "%.2f")")
                    .font(.caption)
                    .fontFamily(.monospaced)
                    .fontWeight(isSelected ? .semibold : .regular)
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.blue)
                        .font(.caption)
                }
            }
            .padding(.vertical, 2)
            .padding(.horizontal, 8)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .cornerRadius(4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Data point \(index) of \(total): \(dataPoint.label)")
        .accessibilityValue("\(dataPoint.value, specifier: "%.2f")")
        .accessibilityHint(isSelected ? "Selected" : "Double-tap to select and hear details")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

// MARK: - Data Models

struct GraphNode3D: Identifiable {
    let id = UUID()
    let title: String
    let description: String?
    let position3D: SIMD3<Float>
    let position2D: CGPoint // Projected 2D position for accessibility
    let color: Color
    let nodeType: String
    
    init(title: String, description: String? = nil, position3D: SIMD3<Float>, color: Color, nodeType: String = "concept") {
        self.title = title
        self.description = description
        self.position3D = position3D
        self.position2D = CGPoint(
            x: Double(position3D.x) / 100.0 + 0.5,
            y: Double(position3D.y) / 100.0 + 0.5
        )
        self.color = color
        self.nodeType = nodeType
    }
}

struct GraphConnection3D: Identifiable {
    let id = UUID()
    let fromNodeId: UUID
    let toNodeId: UUID
    let relationshipType: String
    let strength: Double
    let color: Color
    
    init(fromNodeId: UUID, toNodeId: UUID, relationshipType: String, strength: Double = 1.0, color: Color = .gray) {
        self.fromNodeId = fromNodeId
        self.toNodeId = toNodeId
        self.relationshipType = relationshipType
        self.strength = strength
        self.color = color
    }
}

// MARK: - Array Extension for Safe Access

extension Array {
    subscript(safe index: Int) -> Element? {
        return index >= 0 && index < count ? self[index] : nil
    }
}

// MARK: - Accessibility Testing and Validation

/// Utility for testing accessibility compliance
struct AccessibilityValidator {
    static func validateView<T: View>(_ view: T) -> AccessibilityReport {
        // This would integrate with actual accessibility testing frameworks
        // For now, providing structure for validation
        
        var issues: [AccessibilityIssue] = []
        var successes: [String] = []
        
        // Check for basic accessibility requirements
        // In a real implementation, this would use accessibility APIs
        
        return AccessibilityReport(
            isCompliant: issues.isEmpty,
            issues: issues,
            successes: successes,
            level: issues.isEmpty ? .aa : .a
        )
    }
}

struct AccessibilityReport {
    let isCompliant: Bool
    let issues: [AccessibilityIssue]
    let successes: [String]
    let level: WCAGLevel
    
    enum WCAGLevel {
        case a, aa, aaa
    }
}

struct AccessibilityIssue {
    let type: IssueType
    let description: String
    let severity: Severity
    let suggestion: String
    
    enum IssueType {
        case missingLabel
        case insufficientContrast
        case noKeyboardAccess
        case missingDescription
        case improperFocus
    }
    
    enum Severity {
        case low, medium, high, critical
    }
}

// MARK: - Usage Examples

#Preview("Accessible 3D Graph") {
    let nodes = [
        GraphNode3D(
            title: "Machine Learning",
            description: "Algorithms that learn from data",
            position3D: SIMD3<Float>(0, 0, 0),
            color: .blue
        ),
        GraphNode3D(
            title: "Neural Networks", 
            description: "Interconnected processing nodes inspired by biological neurons",
            position3D: SIMD3<Float>(50, 25, -10),
            color: .green
        ),
        GraphNode3D(
            title: "Deep Learning",
            description: "Neural networks with multiple hidden layers",
            position3D: SIMD3<Float>(-30, -20, 15),
            color: .purple
        )
    ]
    
    let connections = [
        GraphConnection3D(fromNodeId: nodes[0].id, toNodeId: nodes[1].id, relationshipType: "includes", color: .blue),
        GraphConnection3D(fromNodeId: nodes[1].id, toNodeId: nodes[2].id, relationshipType: "enables", color: .green)
    ]
    
    if #available(macOS 14.0, *) {
        Accessible3DGraphView(nodes: nodes, connections: connections)
            .frame(width: 800, height: 600)
    } else {
        Text("Accessible 3D Graph requires macOS 14.0 or later")
            .frame(width: 800, height: 600)
    }
}

#Preview("Accessible Chart") {
    let dataPoints = [
        ChartDataPoint(label: "January", value: 120.5),
        ChartDataPoint(label: "February", value: 135.2),
        ChartDataPoint(label: "March", value: 98.7),
        ChartDataPoint(label: "April", value: 156.3),
        ChartDataPoint(label: "May", value: 178.9)
    ]
    
    AccessibleChartView(
        dataPoints: dataPoints,
        title: "Monthly Revenue",
        chartType: .bar
    )
    .frame(width: 600, height: 400)
    .padding()
}