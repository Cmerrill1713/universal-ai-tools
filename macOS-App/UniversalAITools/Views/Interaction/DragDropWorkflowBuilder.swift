//
//  DragDropWorkflowBuilder.swift
//  UniversalAITools
//
//  Intuitive drag-and-drop workflow creation interface with visual programming,
//  component library, and real-time validation
//

import SwiftUI
import UniformTypeIdentifiers

// MARK: - Workflow Component Types
enum WorkflowComponentType: String, CaseIterable {
    case agent = "agent"
    case dataProcessor = "data_processor"
    case filter = "filter"
    case transformer = "transformer"
    case aggregator = "aggregator"
    case output = "output"
    case input = "input"
    case condition = "condition"
    case loop = "loop"
    case timer = "timer"
}

// MARK: - Connection Point
struct ConnectionPoint: Identifiable, Equatable {
    let id = UUID()
    let type: ConnectionType
    let position: CGPoint
    let dataType: DataType
    
    enum ConnectionType {
        case input
        case output
    }
    
    enum DataType: String, CaseIterable {
        case text = "text"
        case number = "number"
        case boolean = "boolean"
        case array = "array"
        case object = "object"
        case any = "any"
    }
}

// MARK: - Workflow Component
struct WorkflowComponent: Identifiable, Equatable {
    let id = UUID()
    var type: WorkflowComponentType
    var title: String
    var description: String
    var position: CGPoint
    var size: CGSize
    var inputPorts: [ConnectionPoint]
    var outputPorts: [ConnectionPoint]
    var properties: [String: Any] = [:]
    var isSelected: Bool = false
    var validationErrors: [String] = []
    
    static func == (lhs: WorkflowComponent, rhs: WorkflowComponent) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Workflow Connection
struct WorkflowConnection: Identifiable, Equatable {
    let id = UUID()
    let fromComponent: UUID
    let fromPort: UUID
    let toComponent: UUID
    let toPort: UUID
    var path: Path = Path()
    var isValid: Bool = true
    var validationMessage: String?
    
    static func == (lhs: WorkflowConnection, rhs: WorkflowConnection) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Workflow Template
struct WorkflowTemplate: Identifiable {
    let id = UUID()
    let name: String
    let description: String
    let category: String
    let components: [WorkflowComponent]
    let connections: [WorkflowConnection]
    let thumbnail: String?
}

// MARK: - Drag Drop Workflow Builder
struct DragDropWorkflowBuilder: View {
    @StateObject private var workflowManager = WorkflowManager()
    @StateObject private var componentLibrary = ComponentLibrary()
    @StateObject private var validationEngine = WorkflowValidationEngine()
    
    @State private var canvasOffset: CGSize = .zero
    @State private var canvasScale: Double = 1.0
    @State private var showComponentLibrary: Bool = true
    @State private var showPropertyPanel: Bool = false
    @State private var selectedComponent: WorkflowComponent?
    @State private var isDraggingConnection: Bool = false
    @State private var connectionStart: ConnectionPoint?
    @State private var dragOffset: CGSize = .zero
    @State private var showTemplates: Bool = false
    @State private var gridSize: Double = 20
    @State private var snapToGrid: Bool = true
    
    private let canvasSize = CGSize(width: 2000, height: 1500)
    
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // Component Library Sidebar
                if showComponentLibrary {
                    componentLibrarySidebar
                        .frame(width: 250)
                        .background(Color(.controlBackgroundColor))
                }
                
                // Main Canvas Area
                VStack(spacing: 0) {
                    workflowToolbar
                    
                    ZStack {
                        canvasBackground
                        workflowCanvas
                        connectionLayer
                        
                        if isDraggingConnection {
                            connectionPreview
                        }
                    }
                    .clipped()
                    .background(Color(.textBackgroundColor))
                    .gesture(canvasGestures)
                    
                    // Status Bar
                    statusBar
                }
                
                // Property Panel
                if showPropertyPanel, let component = selectedComponent {
                    propertyPanelView(for: component)
                        .frame(width: 300)
                        .background(Color(.controlBackgroundColor))
                }
            }
        }
        .onAppear {
            setupWorkflowBuilder()
        }
    }
    
    // MARK: - Component Library Sidebar
    private var componentLibrarySidebar: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Components")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { showTemplates.toggle() }) {
                    Image(systemName: "doc.text.below.ecg")
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding(.horizontal)
            
            SearchField(text: $componentLibrary.searchText)
                .padding(.horizontal)
            
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(componentLibrary.filteredComponents) { component in
                        componentLibraryItem(component)
                    }
                }
                .padding(.horizontal)
            }
            
            if showTemplates {
                templateSection
            }
        }
        .padding(.vertical)
    }
    
    private func componentLibraryItem(_ component: WorkflowComponent) -> some View {
        HStack {
            componentIcon(component.type)
                .frame(width: 24, height: 24)
                .foregroundColor(colorForComponentType(component.type))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(component.title)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(component.description)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
        }
        .padding(8)
        .background(Color(.controlColor))
        .cornerRadius(8)
        .draggable(WorkflowComponentTransfer(component: component))
    }
    
    private var templateSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()
            
            Text("Templates")
                .font(.subheadline)
                .fontWeight(.medium)
                .padding(.horizontal)
            
            ScrollView {
                LazyVStack(spacing: 6) {
                    ForEach(componentLibrary.templates) { template in
                        templateItem(template)
                    }
                }
                .padding(.horizontal)
            }
            .frame(maxHeight: 200)
        }
    }
    
    private func templateItem(_ template: WorkflowTemplate) -> some View {
        Button(action: { loadTemplate(template) }) {
            HStack {
                Image(systemName: "doc.richtext")
                    .foregroundColor(.blue)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.name)
                        .font(.caption)
                        .fontWeight(.medium)
                    
                    Text(template.description)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                Spacer()
            }
            .padding(6)
            .background(Color(.controlColor))
            .cornerRadius(6)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    // MARK: - Workflow Toolbar
    private var workflowToolbar: some View {
        HStack {
            // File operations
            HStack(spacing: 8) {
                Button(action: newWorkflow) {
                    Image(systemName: "doc")
                }
                
                Button(action: saveWorkflow) {
                    Image(systemName: "square.and.arrow.down")
                }
                
                Button(action: loadWorkflow) {
                    Image(systemName: "folder")
                }
            }
            
            Divider()
                .frame(height: 20)
            
            // Edit operations
            HStack(spacing: 8) {
                Button(action: undo) {
                    Image(systemName: "arrow.uturn.backward")
                }
                .disabled(!workflowManager.canUndo)
                
                Button(action: redo) {
                    Image(systemName: "arrow.uturn.forward")
                }
                .disabled(!workflowManager.canRedo)
                
                Button(action: deleteSelected) {
                    Image(systemName: "trash")
                }
                .disabled(workflowManager.selectedComponents.isEmpty)
            }
            
            Divider()
                .frame(height: 20)
            
            // View controls
            HStack(spacing: 8) {
                Button(action: { showComponentLibrary.toggle() }) {
                    Image(systemName: "sidebar.left")
                        .foregroundColor(showComponentLibrary ? .blue : .secondary)
                }
                
                Button(action: { showPropertyPanel.toggle() }) {
                    Image(systemName: "sidebar.right")
                        .foregroundColor(showPropertyPanel ? .blue : .secondary)
                }
                
                Button(action: fitToCanvas) {
                    Image(systemName: "rectangle.compress.vertical")
                }
                
                Button(action: { snapToGrid.toggle() }) {
                    Image(systemName: "grid")
                        .foregroundColor(snapToGrid ? .blue : .secondary)
                }
            }
            
            Spacer()
            
            // Validation status
            HStack(spacing: 8) {
                validationIndicator
                
                Button(action: executeWorkflow) {
                    HStack(spacing: 4) {
                        Image(systemName: "play.fill")
                        Text("Run")
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(validationEngine.isValid ? Color.green : Color.gray)
                    .cornerRadius(6)
                }
                .disabled(!validationEngine.isValid)
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
    }
    
    private var validationIndicator: some View {
        HStack(spacing: 4) {
            Image(systemName: validationEngine.isValid ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundColor(validationEngine.isValid ? .green : .orange)
            
            Text(validationEngine.isValid ? "Valid" : "\(validationEngine.errors.count) errors")
                .font(.caption)
                .foregroundColor(validationEngine.isValid ? .green : .orange)
        }
    }
    
    // MARK: - Canvas
    private var canvasBackground: some View {
        ZStack {
            // Grid pattern
            if snapToGrid {
                gridPattern
            }
            
            // Canvas bounds
            Rectangle()
                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                .frame(width: canvasSize.width, height: canvasSize.height)
        }
        .scaleEffect(canvasScale)
        .offset(canvasOffset)
    }
    
    private var gridPattern: some View {
        Canvas { context, size in
            let scaledGridSize = gridSize * canvasScale
            
            context.stroke(
                Path { path in
                    // Vertical lines
                    var x: Double = 0
                    while x <= canvasSize.width {
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: canvasSize.height))
                        x += scaledGridSize
                    }
                    
                    // Horizontal lines
                    var y: Double = 0
                    while y <= canvasSize.height {
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: canvasSize.width, y: y))
                        y += scaledGridSize
                    }
                },
                with: .color(.gray.opacity(0.2)),
                lineWidth: 0.5
            )
        }
        .frame(width: canvasSize.width, height: canvasSize.height)
    }
    
    private var workflowCanvas: some View {
        ZStack {
            ForEach(workflowManager.components) { component in
                componentView(component)
                    .position(component.position)
                    .scaleEffect(canvasScale)
                    .offset(canvasOffset)
            }
        }
        .frame(width: canvasSize.width, height: canvasSize.height)
    }
    
    private var connectionLayer: some View {
        ZStack {
            ForEach(workflowManager.connections) { connection in
                connectionView(connection)
                    .scaleEffect(canvasScale)
                    .offset(canvasOffset)
            }
        }
        .frame(width: canvasSize.width, height: canvasSize.height)
    }
    
    private var connectionPreview: some View {
        Group {
            if let start = connectionStart {
                Path { path in
                    path.move(to: start.position)
                    path.addLine(to: CGPoint(
                        x: start.position.x + dragOffset.width,
                        y: start.position.y + dragOffset.height
                    ))
                }
                .stroke(Color.blue.opacity(0.6), style: StrokeStyle(lineWidth: 2, dash: [5]))
                .scaleEffect(canvasScale)
                .offset(canvasOffset)
            }
        }
    }
    
    // MARK: - Component View
    private func componentView(_ component: WorkflowComponent) -> some View {
        VStack(spacing: 8) {
            // Component header
            HStack {
                componentIcon(component.type)
                    .foregroundColor(colorForComponentType(component.type))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(component.title)
                        .font(.caption)
                        .fontWeight(.medium)
                    
                    if !component.validationErrors.isEmpty {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                            .font(.caption2)
                    }
                }
                
                Spacer()
            }
            .padding(.horizontal, 8)
            .padding(.top, 8)
            
            // Connection ports
            HStack {
                // Input ports
                VStack(spacing: 4) {
                    ForEach(component.inputPorts) { port in
                        connectionPortView(port, isInput: true)
                    }
                }
                
                Spacer()
                
                // Output ports
                VStack(spacing: 4) {
                    ForEach(component.outputPorts) { port in
                        connectionPortView(port, isInput: false)
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
        }
        .frame(width: component.size.width, height: component.size.height)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(component.isSelected ? Color.blue.opacity(0.2) : Color(.controlBackgroundColor))
                .stroke(
                    component.isSelected ? Color.blue :
                    component.validationErrors.isEmpty ? Color.gray.opacity(0.3) : Color.red,
                    lineWidth: component.isSelected ? 2 : 1
                )
        )
        .onTapGesture {
            selectComponent(component)
        }
        .gesture(componentDragGesture(component))
        .dropDestination(for: WorkflowComponentTransfer.self) { items, location in
            handleComponentDrop(items, at: location)
        }
    }
    
    private func connectionPortView(_ port: ConnectionPoint, isInput: Bool) -> some View {
        Circle()
            .fill(colorForDataType(port.dataType))
            .frame(width: 8, height: 8)
            .overlay(
                Circle()
                    .stroke(Color.white, lineWidth: 1)
            )
            .onTapGesture {
                handlePortTap(port)
            }
            .gesture(connectionDragGesture(port))
    }
    
    private func connectionView(_ connection: WorkflowConnection) -> some View {
        connection.path
            .stroke(
                connection.isValid ? Color.blue : Color.red,
                style: StrokeStyle(
                    lineWidth: 2,
                    dash: connection.isValid ? [] : [5]
                )
            )
    }
    
    // MARK: - Property Panel
    private func propertyPanelView(for component: WorkflowComponent) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Properties")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { showPropertyPanel = false }) {
                    Image(systemName: "xmark")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            // Component info
            VStack(alignment: .leading, spacing: 8) {
                Text(component.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(component.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Divider()
            
            // Properties editor
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(component.properties.keys), id: \.self) { key in
                        propertyEditor(key: key, value: component.properties[key])
                    }
                }
            }
            
            Spacer()
        }
        .padding()
    }
    
    private func propertyEditor(key: String, value: Any?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(key.capitalized)
                .font(.caption)
                .fontWeight(.medium)
            
            // Property value editor based on type
            if let stringValue = value as? String {
                TextField("Value", text: .constant(stringValue))
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .font(.caption)
            } else if let numberValue = value as? Double {
                TextField("Value", value: .constant(numberValue), format: .number)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .font(.caption)
            } else if let boolValue = value as? Bool {
                Toggle("Enabled", isOn: .constant(boolValue))
                    .font(.caption)
            } else {
                Text("Unsupported type")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
    
    // MARK: - Status Bar
    private var statusBar: some View {
        HStack {
            Text("Components: \(workflowManager.components.count)")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text("Scale: \(Int(canvasScale * 100))%")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            if !validationEngine.errors.isEmpty {
                Text("Errors: \(validationEngine.errors.count)")
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 4)
        .background(Color(.controlBackgroundColor))
    }
    
    // MARK: - Gestures
    private var canvasGestures: some Gesture {
        SimultaneousGesture(
            MagnificationGesture()
                .onChanged { value in
                    canvasScale = max(0.5, min(2.0, value))
                },
            DragGesture()
                .onChanged { value in
                    canvasOffset = value.translation
                }
        )
    }
    
    private func componentDragGesture(_ component: WorkflowComponent) -> some Gesture {
        DragGesture()
            .onChanged { value in
                workflowManager.moveComponent(component.id, to: value.location)
            }
            .onEnded { value in
                if snapToGrid {
                    let snappedPosition = snapToGridPosition(value.location)
                    workflowManager.moveComponent(component.id, to: snappedPosition)
                }
            }
    }
    
    private func connectionDragGesture(_ port: ConnectionPoint) -> some Gesture {
        DragGesture()
            .onChanged { value in
                if !isDraggingConnection {
                    isDraggingConnection = true
                    connectionStart = port
                }
                dragOffset = value.translation
            }
            .onEnded { value in
                // Handle connection completion
                isDraggingConnection = false
                connectionStart = nil
                dragOffset = .zero
            }
    }
    
    // MARK: - Helper Methods
    private func setupWorkflowBuilder() {
        componentLibrary.loadDefaultComponents()
        validationEngine.setWorkflowManager(workflowManager)
    }
    
    private func componentIcon(_ type: WorkflowComponentType) -> some View {
        Image(systemName: iconNameForComponentType(type))
    }
    
    private func iconNameForComponentType(_ type: WorkflowComponentType) -> String {
        switch type {
        case .agent: return "person.crop.circle"
        case .dataProcessor: return "cpu"
        case .filter: return "line.3.horizontal.decrease"
        case .transformer: return "arrow.triangle.2.circlepath"
        case .aggregator: return "sum"
        case .output: return "arrow.right.circle"
        case .input: return "arrow.left.circle"
        case .condition: return "questionmark.diamond"
        case .loop: return "arrow.clockwise"
        case .timer: return "timer"
        }
    }
    
    private func colorForComponentType(_ type: WorkflowComponentType) -> Color {
        switch type {
        case .agent: return .blue
        case .dataProcessor: return .green
        case .filter: return .orange
        case .transformer: return .purple
        case .aggregator: return .red
        case .output: return .gray
        case .input: return .gray
        case .condition: return .yellow
        case .loop: return .cyan
        case .timer: return .pink
        }
    }
    
    private func colorForDataType(_ type: ConnectionPoint.DataType) -> Color {
        switch type {
        case .text: return .blue
        case .number: return .green
        case .boolean: return .orange
        case .array: return .purple
        case .object: return .red
        case .any: return .gray
        }
    }
    
    private func snapToGridPosition(_ position: CGPoint) -> CGPoint {
        let x = round(position.x / gridSize) * gridSize
        let y = round(position.y / gridSize) * gridSize
        return CGPoint(x: x, y: y)
    }
    
    private func selectComponent(_ component: WorkflowComponent) {
        selectedComponent = component
        showPropertyPanel = true
        workflowManager.selectComponent(component.id)
    }
    
    private func handleComponentDrop(_ items: [WorkflowComponentTransfer], at location: CGPoint) -> Bool {
        guard let item = items.first else { return false }
        
        let position = snapToGrid ? snapToGridPosition(location) : location
        workflowManager.addComponent(item.component, at: position)
        return true
    }
    
    private func handlePortTap(_ port: ConnectionPoint) {
        // Handle connection creation
    }
    
    // MARK: - Actions
    private func newWorkflow() {
        workflowManager.clear()
        selectedComponent = nil
        showPropertyPanel = false
    }
    
    private func saveWorkflow() {
        // Implement save functionality
    }
    
    private func loadWorkflow() {
        // Implement load functionality
    }
    
    private func loadTemplate(_ template: WorkflowTemplate) {
        workflowManager.loadTemplate(template)
    }
    
    private func undo() {
        workflowManager.undo()
    }
    
    private func redo() {
        workflowManager.redo()
    }
    
    private func deleteSelected() {
        workflowManager.deleteSelectedComponents()
        selectedComponent = nil
        showPropertyPanel = false
    }
    
    private func fitToCanvas() {
        // Calculate bounds and adjust canvas view
        canvasScale = 1.0
        canvasOffset = .zero
    }
    
    private func executeWorkflow() {
        if validationEngine.isValid {
            workflowManager.executeWorkflow()
        }
    }
}

// MARK: - Supporting Classes and Structures

// Transferable component for drag and drop
struct WorkflowComponentTransfer: Transferable {
    let component: WorkflowComponent
    
    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .workflowComponent)
    }
}

extension UTType {
    static let workflowComponent = UTType(exportedAs: "com.universalaitools.workflow-component")
}

// Search field component
struct SearchField: View {
    @Binding var text: String
    
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)
            
            TextField("Search components...", text: $text)
                .textFieldStyle(PlainTextFieldStyle())
        }
        .padding(8)
        .background(Color(.controlColor))
        .cornerRadius(6)
    }
}

// MARK: - Component Library
@MainActor
class ComponentLibrary: ObservableObject {
    @Published var components: [WorkflowComponent] = []
    @Published var templates: [WorkflowTemplate] = []
    @Published var searchText: String = ""
    
    var filteredComponents: [WorkflowComponent] {
        if searchText.isEmpty {
            return components
        } else {
            return components.filter { component in
                component.title.localizedCaseInsensitiveContains(searchText) ||
                component.description.localizedCaseInsensitiveContains(searchText)
            }
        }
    }
    
    func loadDefaultComponents() {
        components = [
            WorkflowComponent(
                type: .agent,
                title: "AI Agent",
                description: "Configurable AI agent for processing",
                position: .zero,
                size: CGSize(width: 120, height: 80),
                inputPorts: [ConnectionPoint(type: .input, position: .zero, dataType: .text)],
                outputPorts: [ConnectionPoint(type: .output, position: .zero, dataType: .text)]
            ),
            WorkflowComponent(
                type: .dataProcessor,
                title: "Data Processor",
                description: "Process and transform data",
                position: .zero,
                size: CGSize(width: 120, height: 80),
                inputPorts: [ConnectionPoint(type: .input, position: .zero, dataType: .any)],
                outputPorts: [ConnectionPoint(type: .output, position: .zero, dataType: .any)]
            ),
            // Add more default components...
        ]
        
        loadDefaultTemplates()
    }
    
    private func loadDefaultTemplates() {
        templates = [
            WorkflowTemplate(
                name: "Simple Chat Flow",
                description: "Basic chat workflow with one agent",
                category: "Chat",
                components: [],
                connections: [],
                thumbnail: nil
            ),
            WorkflowTemplate(
                name: "Multi-Agent Pipeline",
                description: "Complex pipeline with multiple agents",
                category: "Advanced",
                components: [],
                connections: [],
                thumbnail: nil
            )
        ]
    }
}

// MARK: - Workflow Manager
@MainActor
class WorkflowManager: ObservableObject {
    @Published var components: [WorkflowComponent] = []
    @Published var connections: [WorkflowConnection] = []
    @Published var selectedComponents: Set<UUID> = []
    @Published var canUndo: Bool = false
    @Published var canRedo: Bool = false
    
    private var undoStack: [WorkflowState] = []
    private var redoStack: [WorkflowState] = []
    
    struct WorkflowState {
        let components: [WorkflowComponent]
        let connections: [WorkflowConnection]
    }
    
    func addComponent(_ component: WorkflowComponent, at position: CGPoint) {
        saveState()
        var newComponent = component
        newComponent.position = position
        components.append(newComponent)
    }
    
    func moveComponent(_ id: UUID, to position: CGPoint) {
        if let index = components.firstIndex(where: { $0.id == id }) {
            components[index].position = position
        }
    }
    
    func selectComponent(_ id: UUID) {
        selectedComponents.removeAll()
        selectedComponents.insert(id)
        
        for i in components.indices {
            components[i].isSelected = components[i].id == id
        }
    }
    
    func deleteSelectedComponents() {
        saveState()
        components.removeAll { selectedComponents.contains($0.id) }
        connections.removeAll { connection in
            selectedComponents.contains(connection.fromComponent) ||
            selectedComponents.contains(connection.toComponent)
        }
        selectedComponents.removeAll()
    }
    
    func clear() {
        saveState()
        components.removeAll()
        connections.removeAll()
        selectedComponents.removeAll()
    }
    
    func loadTemplate(_ template: WorkflowTemplate) {
        saveState()
        components = template.components
        connections = template.connections
        selectedComponents.removeAll()
    }
    
    func executeWorkflow() {
        // Implement workflow execution logic
        print("Executing workflow with \(components.count) components")
    }
    
    private func saveState() {
        let state = WorkflowState(components: components, connections: connections)
        undoStack.append(state)
        redoStack.removeAll()
        canUndo = true
        canRedo = false
    }
    
    func undo() {
        guard let lastState = undoStack.popLast() else { return }
        
        let currentState = WorkflowState(components: components, connections: connections)
        redoStack.append(currentState)
        
        components = lastState.components
        connections = lastState.connections
        
        canUndo = !undoStack.isEmpty
        canRedo = true
    }
    
    func redo() {
        guard let nextState = redoStack.popLast() else { return }
        
        let currentState = WorkflowState(components: components, connections: connections)
        undoStack.append(currentState)
        
        components = nextState.components
        connections = nextState.connections
        
        canUndo = true
        canRedo = !redoStack.isEmpty
    }
}

// MARK: - Workflow Validation Engine
@MainActor
class WorkflowValidationEngine: ObservableObject {
    @Published var isValid: Bool = true
    @Published var errors: [String] = []
    
    private weak var workflowManager: WorkflowManager?
    
    func setWorkflowManager(_ manager: WorkflowManager) {
        self.workflowManager = manager
        validateWorkflow()
    }
    
    func validateWorkflow() {
        guard let manager = workflowManager else { return }
        
        errors.removeAll()
        
        // Validate components
        for component in manager.components {
            validateComponent(component)
        }
        
        // Validate connections
        for connection in manager.connections {
            validateConnection(connection, components: manager.components)
        }
        
        isValid = errors.isEmpty
    }
    
    private func validateComponent(_ component: WorkflowComponent) {
        // Component-specific validation rules
        switch component.type {
        case .agent:
            if component.properties["model"] == nil {
                errors.append("Agent '\(component.title)' missing model configuration")
            }
        case .input:
            if component.outputPorts.isEmpty {
                errors.append("Input component '\(component.title)' must have output ports")
            }
        case .output:
            if component.inputPorts.isEmpty {
                errors.append("Output component '\(component.title)' must have input ports")
            }
        default:
            break
        }
    }
    
    private func validateConnection(_ connection: WorkflowConnection, components: [WorkflowComponent]) {
        // Find connected components
        guard let fromComponent = components.first(where: { $0.id == connection.fromComponent }),
              let toComponent = components.first(where: { $0.id == connection.toComponent }) else {
            errors.append("Connection references non-existent components")
            return
        }
        
        // Find connected ports
        guard let fromPort = fromComponent.outputPorts.first(where: { $0.id == connection.fromPort }),
              let toPort = toComponent.inputPorts.first(where: { $0.id == connection.toPort }) else {
            errors.append("Connection references non-existent ports")
            return
        }
        
        // Validate data type compatibility
        if fromPort.dataType != .any && toPort.dataType != .any && fromPort.dataType != toPort.dataType {
            errors.append("Data type mismatch: \(fromPort.dataType.rawValue) → \(toPort.dataType.rawValue)")
        }
    }
}