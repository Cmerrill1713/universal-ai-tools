import SwiftUI

/// Workflow Management and Execution View
struct WorkflowManagementView: View {
    @ObservedObject var webSocketService: AgentWebSocketService
    @Binding var selectedWorkflow: AgentWorkflow?
    @Binding var showWorkflowCreator: Bool
    @State private var searchText = ""
    @State private var filterState: WorkflowExecutionState? = nil
    @State private var filterPriority: WorkflowPriority? = nil
    @State private var showExecutionDetails = false
    @State private var workflowToExecute: AgentWorkflow?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with controls
            workflowHeader
            
            Divider()
            
            // Filters
            workflowFilters
            
            Divider()
            
            // Workflow list
            workflowList
        }
        .sheet(isPresented: $showExecutionDetails) {
            if let workflow = workflowToExecute {
                WorkflowExecutionDetailView(workflow: workflow, webSocketService: webSocketService)
                    .frame(minWidth: 600, idealWidth: 800, maxWidth: 1000,
                           minHeight: 500, idealHeight: 700, maxHeight: 900)
            }
        }
    }
    
    // MARK: - Header
    
    private var workflowHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Workflow Management")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text("\(filteredWorkflows.count) workflows")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                Button("Create Workflow") {
                    showWorkflowCreator = true
                }
                .buttonStyle(.borderedProminent)
                
                Button("Refresh") {
                    // Refresh workflows from server
                    Task {
                        // Request workflow updates
                    }
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
    }
    
    // MARK: - Filters
    
    private var workflowFilters: some View {
        HStack(spacing: 16) {
            // Search
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search workflows...", text: $searchText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            .frame(width: 250)
            
            // State filter
            Picker("State", selection: $filterState) {
                Text("All States").tag(nil as WorkflowExecutionState?)
                ForEach(WorkflowExecutionState.allCases, id: \.self) { state in
                    Text(state.rawValue).tag(state as WorkflowExecutionState?)
                }
            }
            .pickerStyle(.menu)
            .frame(width: 120)
            
            // Priority filter
            Picker("Priority", selection: $filterPriority) {
                Text("All Priorities").tag(nil as WorkflowPriority?)
                ForEach(WorkflowPriority.allCases, id: \.self) { priority in
                    Text(priority.rawValue).tag(priority as WorkflowPriority?)
                }
            }
            .pickerStyle(.menu)
            .frame(width: 120)
            
            Spacer()
            
            // Quick action buttons
            HStack(spacing: 8) {
                Button("Pause All") {
                    pauseAllWorkflows()
                }
                .buttonStyle(.bordered)
                .foregroundColor(.orange)
                
                Button("Stop All") {
                    stopAllWorkflows()
                }
                .buttonStyle(.bordered)
                .foregroundColor(.red)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
    
    // MARK: - Workflow List
    
    private var workflowList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredWorkflows) { workflow in
                    WorkflowCard(
                        workflow: workflow,
                        webSocketService: webSocketService,
                        isSelected: selectedWorkflow?.id == workflow.id,
                        onSelect: { selectedWorkflow = workflow },
                        onExecute: { executeWorkflow(workflow) },
                        onShowDetails: { showWorkflowDetails(workflow) }
                    )
                }
                
                if filteredWorkflows.isEmpty {
                    EmptyWorkflowState(
                        showCreateButton: true,
                        onCreateWorkflow: { showWorkflowCreator = true }
                    )
                }
            }
            .padding()
        }
    }
    
    // MARK: - Helper Functions
    
    private var filteredWorkflows: [AgentWorkflow] {
        var workflows = webSocketService.activeWorkflows
        
        // Filter by search text
        if !searchText.isEmpty {
            workflows = workflows.filter { workflow in
                workflow.name.localizedCaseInsensitiveContains(searchText) ||
                workflow.steps.contains { $0.name.localizedCaseInsensitiveContains(searchText) }
            }
        }
        
        // Filter by state
        if let filterState = filterState {
            workflows = workflows.filter { $0.executionState == filterState }
        }
        
        // Filter by priority
        if let filterPriority = filterPriority {
            workflows = workflows.filter { $0.priority == filterPriority }
        }
        
        return workflows
    }
    
    private func executeWorkflow(_ workflow: AgentWorkflow) {
        Task {
            await webSocketService.executeWorkflow(workflow)
        }
    }
    
    private func showWorkflowDetails(_ workflow: AgentWorkflow) {
        workflowToExecute = workflow
        showExecutionDetails = true
    }
    
    private func pauseAllWorkflows() {
        // Implementation for pausing all workflows
    }
    
    private func stopAllWorkflows() {
        // Implementation for stopping all workflows
    }
}

// MARK: - Workflow Card

struct WorkflowCard: View {
    let workflow: AgentWorkflow
    let webSocketService: AgentWebSocketService
    let isSelected: Bool
    let onSelect: () -> Void
    let onExecute: () -> Void
    let onShowDetails: () -> Void
    
    @State private var isExpanded = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Main card content
            HStack(spacing: 12) {
                // Status indicator
                Circle()
                    .fill(workflow.executionState.color)
                    .frame(width: 12, height: 12)
                    .overlay(
                        Circle()
                            .stroke(.white, lineWidth: 1)
                    )
                
                // Priority indicator
                Image(systemName: priorityIcon)
                    .foregroundColor(workflow.priority.color)
                    .font(.caption)
                
                // Workflow info
                VStack(alignment: .leading, spacing: 4) {
                    Text(workflow.name)
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    HStack(spacing: 8) {
                        Text(workflow.executionState.rawValue)
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(workflow.executionState.color.opacity(0.2))
                            .foregroundColor(workflow.executionState.color)
                            .cornerRadius(4)
                        
                        Text("\(workflow.steps.count) steps")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        if let duration = workflow.estimatedDuration {
                            Text(formatDuration(duration))
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                Spacer()
                
                // Progress indicator
                VStack(spacing: 4) {
                    Text("\(workflow.progressPercentage, specifier: "%.0f")%")
                        .font(.caption)
                        .fontWeight(.medium)
                        .fontFamily(.monospaced)
                    
                    ProgressView(value: workflow.progressPercentage / 100.0)
                        .frame(width: 80)
                        .progressViewStyle(LinearProgressViewStyle(tint: workflow.priority.color))
                }
                
                // Actions
                HStack(spacing: 8) {
                    Button(action: { isExpanded.toggle() }) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.caption)
                    }
                    .buttonStyle(.borderless)
                    
                    Menu {
                        Button("Execute", action: onExecute)
                            .disabled(workflow.executionState == .running)
                        
                        Button("Show Details", action: onShowDetails)
                        
                        Divider()
                        
                        Button("Pause") {
                            // Pause workflow
                        }
                        .disabled(workflow.executionState != .running)
                        
                        Button("Stop") {
                            // Stop workflow
                        }
                        .disabled(workflow.executionState == .completed)
                        
                        Divider()
                        
                        Button("Duplicate") {
                            // Duplicate workflow
                        }
                        
                        Button("Delete", role: .destructive) {
                            // Delete workflow
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.caption)
                    }
                    .menuStyle(.borderlessButton)
                }
            }
            .padding()
            .contentShape(Rectangle())
            .onTapGesture {
                onSelect()
            }
            
            // Expanded content
            if isExpanded {
                VStack(spacing: 12) {
                    Divider()
                    
                    // Workflow steps
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Workflow Steps")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        ForEach(workflow.steps.sorted(by: { $0.order < $1.order })) { step in
                            WorkflowStepRow(step: step)
                        }
                    }
                    .padding(.horizontal)
                    
                    // Dependencies
                    if !workflow.dependencies.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Dependencies")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            ForEach(workflow.dependencies) { dependency in
                                DependencyRow(dependency: dependency)
                            }
                        }
                        .padding(.horizontal)
                    }
                    
                    // Results preview
                    if !workflow.results.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Recent Results")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            ForEach(Array(workflow.results.keys.prefix(3)), id: \.self) { key in
                                if let result = workflow.results[key] {
                                    ResultRow(stepId: key, result: result)
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.bottom)
            }
        }
        .background(isSelected ? AppTheme.accentOrange.opacity(0.1) : .clear)
        .glassMorphism(cornerRadius: 12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? AppTheme.accentOrange : .clear, lineWidth: 2)
        )
        .animation(.easeInOut(duration: 0.3), value: isExpanded)
    }
    
    private var priorityIcon: String {
        switch workflow.priority {
        case .low: return "arrow.down.circle"
        case .normal: return "circle"
        case .high: return "arrow.up.circle"
        case .critical: return "exclamationmark.triangle.fill"
        }
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return "\(minutes):\(String(format: "%02d", seconds))"
    }
}

// MARK: - Workflow Step Row

struct WorkflowStepRow: View {
    let step: WorkflowStep
    
    var body: some View {
        HStack(spacing: 12) {
            // Step order
            Text("\(step.order)")
                .font(.caption)
                .fontWeight(.bold)
                .frame(width: 20, height: 20)
                .background(Circle().fill(step.status.color.opacity(0.2)))
                .foregroundColor(step.status.color)
            
            // Step status icon
            Image(systemName: step.status.icon)
                .foregroundColor(step.status.color)
                .font(.caption)
                .frame(width: 16)
            
            // Step info
            VStack(alignment: .leading, spacing: 2) {
                Text(step.name)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text("Agent: \(step.agentId)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Action type
            Text(step.action.type.rawValue)
                .font(.caption2)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(.ultraThinMaterial)
                .cornerRadius(4)
        }
    }
}

// MARK: - Dependency Row

struct DependencyRow: View {
    let dependency: WorkflowDependency
    
    var body: some View {
        HStack {
            Image(systemName: dependencyIcon)
                .foregroundColor(.blue)
                .font(.caption)
            
            Text("Step \(dependency.fromStepId) → Step \(dependency.toStepId)")
                .font(.caption)
            
            Spacer()
            
            Text(dependency.dependencyType.rawValue)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
    
    private var dependencyIcon: String {
        switch dependency.dependencyType {
        case .sequential: return "arrow.right"
        case .conditional: return "questionmark.diamond"
        case .parallel: return "arrow.up.arrow.down"
        }
    }
}

// MARK: - Result Row

struct ResultRow: View {
    let stepId: String
    let result: WorkflowResult
    
    var body: some View {
        HStack {
            Image(systemName: result.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(result.success ? .green : .red)
                .font(.caption)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Step \(stepId)")
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(result.output.prefix(50) + (result.output.count > 50 ? "..." : ""))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            Spacer()
            
            Text("\(result.duration, specifier: "%.1f")s")
                .font(.caption2)
                .fontFamily(.monospaced)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Empty State

struct EmptyWorkflowState: View {
    let showCreateButton: Bool
    let onCreateWorkflow: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "arrow.triangle.branch")
                .font(.system(size: 64))
                .foregroundColor(.secondary)
            
            Text("No Workflows")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Create your first workflow to orchestrate agent activities")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            if showCreateButton {
                Button("Create Workflow") {
                    onCreateWorkflow()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Workflow Execution Detail View

struct WorkflowExecutionDetailView: View {
    let workflow: AgentWorkflow
    let webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    @State private var selectedStep: WorkflowStep?
    @State private var executionLogs: [ExecutionLog] = []
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text("Workflow Execution")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text(workflow.name)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Execute") {
                        executeWorkflow()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(workflow.executionState == .running)
                    
                    Button("Close") {
                        dismiss()
                    }
                    .buttonStyle(.borderless)
                }
            }
            .padding()
            
            Divider()
            
            HSplitView {
                // Left side - workflow steps
                VStack(alignment: .leading, spacing: 0) {
                    Text("Workflow Steps")
                        .font(.headline)
                        .padding()
                    
                    Divider()
                    
                    ScrollView {
                        LazyVStack(spacing: 4) {
                            ForEach(workflow.steps.sorted(by: { $0.order < $1.order })) { step in
                                ExecutionStepRow(
                                    step: step,
                                    isSelected: selectedStep?.id == step.id,
                                    onSelect: { selectedStep = step }
                                )
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
                .frame(minWidth: 300)
                
                Divider()
                
                // Right side - step details and logs
                VStack(alignment: .leading, spacing: 0) {
                    if let selectedStep = selectedStep {
                        StepExecutionDetailView(
                            step: selectedStep,
                            workflow: workflow,
                            webSocketService: webSocketService
                        )
                    } else {
                        Text("Select a step to view details")
                            .font(.title3)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
                .frame(minWidth: 400)
            }
        }
        .onAppear {
            // Select first step by default
            selectedStep = workflow.steps.sorted(by: { $0.order < $1.order }).first
            loadExecutionLogs()
        }
    }
    
    private func executeWorkflow() {
        Task {
            await webSocketService.executeWorkflow(workflow)
        }
    }
    
    private func loadExecutionLogs() {
        // Load execution logs for this workflow
        // This would typically come from the WebSocket service
    }
}

// MARK: - Execution Step Row

struct ExecutionStepRow: View {
    let step: WorkflowStep
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            // Step order
            Text("\(step.order)")
                .font(.caption)
                .fontWeight(.bold)
                .frame(width: 24, height: 24)
                .background(Circle().fill(step.status.color))
                .foregroundColor(.white)
            
            // Step info
            VStack(alignment: .leading, spacing: 2) {
                Text(step.name)
                    .font(.body)
                    .fontWeight(.medium)
                
                Text(step.action.type.rawValue)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Status indicator
            Image(systemName: step.status.icon)
                .foregroundColor(step.status.color)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(isSelected ? AppTheme.accentOrange.opacity(0.1) : .clear)
        .contentShape(Rectangle())
        .onTapGesture {
            onSelect()
        }
    }
}

// MARK: - Step Execution Detail View

struct StepExecutionDetailView: View {
    let step: WorkflowStep
    let workflow: AgentWorkflow
    let webSocketService: AgentWebSocketService
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Step header
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(step.name)
                            .font(.title3)
                            .fontWeight(.bold)
                        
                        Spacer()
                        
                        StatusBadge(status: step.status)
                    }
                    
                    Text("Order: \(step.order) • Agent: \(step.agentId)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Divider()
                
                // Action details
                VStack(alignment: .leading, spacing: 8) {
                    Text("Action Configuration")
                        .font(.headline)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        DetailRow(label: "Type", value: step.action.type.rawValue)
                        DetailRow(label: "Estimated Cost", value: "\(step.action.estimatedCost, specifier: "%.2f")")
                        DetailRow(label: "Estimated Benefit", value: "\(step.action.estimatedBenefit, specifier: "%.2f")")
                        DetailRow(label: "Timeout", value: "\(step.timeout, specifier: "%.1f")s")
                        DetailRow(label: "Max Retries", value: "\(step.retryCount)")
                    }
                }
                
                // Parameters
                if !step.action.parameters.isEmpty {
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Parameters")
                            .font(.headline)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(Array(step.action.parameters.keys.sorted()), id: \.self) { key in
                                DetailRow(label: key, value: step.action.parameters[key] ?? "")
                            }
                        }
                    }
                }
                
                // Execution result
                if let result = step.action.result {
                    Divider()
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Execution Result")
                            .font(.headline)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            DetailRow(label: "Success", value: result.success ? "Yes" : "No")
                            DetailRow(label: "Duration", value: "\(result.duration, specifier: "%.3f")s")
                            
                            if !result.output.isEmpty {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Output:")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                    
                                    Text(result.output)
                                        .font(.caption)
                                        .fontFamily(.monospaced)
                                        .padding(8)
                                        .background(.ultraThinMaterial)
                                        .cornerRadius(4)
                                }
                            }
                            
                            if !result.metrics.isEmpty {
                                Text("Metrics:")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                
                                ForEach(Array(result.metrics.keys.sorted()), id: \.self) { key in
                                    DetailRow(
                                        label: key,
                                        value: "\(result.metrics[key] ?? 0, specifier: "%.3f")"
                                    )
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: StepStatus
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.icon)
                .font(.caption2)
            
            Text(status.rawValue)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(status.color.opacity(0.2))
        .foregroundColor(status.color)
        .cornerRadius(6)
    }
}

// MARK: - Supporting Types

struct ExecutionLog: Identifiable {
    let id = UUID()
    let timestamp: Date
    let level: LogLevel
    let message: String
    let stepId: String?
}

#Preview {
    WorkflowManagementView(
        webSocketService: AgentWebSocketService(),
        selectedWorkflow: .constant(nil),
        showWorkflowCreator: .constant(false)
    )
    .frame(width: 1000, height: 700)
}