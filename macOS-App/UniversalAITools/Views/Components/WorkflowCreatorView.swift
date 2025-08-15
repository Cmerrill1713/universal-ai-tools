import SwiftUI

/// Workflow Creator and Editor Interface
struct WorkflowCreatorView: View {
    let webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    
    @State private var workflowName = ""
    @State private var workflowDescription = ""
    @State private var workflowPriority: WorkflowPriority = .normal
    @State private var steps: [WorkflowStep] = []
    @State private var dependencies: [WorkflowDependency] = []
    @State private var showStepEditor = false
    @State private var editingStep: WorkflowStep?
    @State private var selectedAgents: [String] = []
    @State private var availableAgents: [String] = []
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Create New Workflow")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .buttonStyle(.borderless)
                    
                    Button("Create Workflow") {
                        createWorkflow()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(workflowName.isEmpty || steps.isEmpty)
                }
            }
            .padding()
            
            Divider()
            
            ScrollView {
                VStack(spacing: 20) {
                    // Basic workflow information
                    basicInfoSection
                    
                    // Workflow steps
                    stepsSection
                    
                    // Dependencies
                    dependenciesSection
                    
                    // Agent selection
                    agentSelectionSection
                }
                .padding()
            }
        }
        .onAppear {
            loadAvailableAgents()
        }
        .sheet(isPresented: $showStepEditor) {
            WorkflowStepEditor(
                step: editingStep,
                availableAgents: availableAgents,
                onSave: { step in
                    saveStep(step)
                }
            )
            .frame(minWidth: 500, idealWidth: 600, maxWidth: 700,
                   minHeight: 400, idealHeight: 500, maxHeight: 600)
        }
    }
    
    // MARK: - Basic Info Section
    
    private var basicInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Workflow Information")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 12) {
                HStack {
                    Text("Name:")
                        .frame(width: 100, alignment: .leading)
                    
                    TextField("Enter workflow name", text: $workflowName)
                        .textFieldStyle(.roundedBorder)
                }
                
                HStack {
                    Text("Description:")
                        .frame(width: 100, alignment: .leading)
                    
                    TextField("Enter workflow description", text: $workflowDescription)
                        .textFieldStyle(.roundedBorder)
                }
                
                HStack {
                    Text("Priority:")
                        .frame(width: 100, alignment: .leading)
                    
                    Picker("Priority", selection: $workflowPriority) {
                        ForEach(WorkflowPriority.allCases, id: \.self) { priority in
                            Text(priority.rawValue).tag(priority)
                        }
                    }
                    .pickerStyle(.menu)
                    
                    Spacer()
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Steps Section
    
    private var stepsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Workflow Steps")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("Add Step") {
                    editingStep = nil
                    showStepEditor = true
                }
                .buttonStyle(.borderedProminent)
            }
            
            if steps.isEmpty {
                Text("No steps defined. Add your first step to get started.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(8)
            } else {
                VStack(spacing: 8) {
                    ForEach(steps.sorted(by: { $0.order < $1.order })) { step in
                        WorkflowStepCard(
                            step: step,
                            onEdit: {
                                editingStep = step
                                showStepEditor = true
                            },
                            onDelete: {
                                deleteStep(step)
                            }
                        )
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Dependencies Section
    
    private var dependenciesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Step Dependencies")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("Add Dependency") {
                    addDependency()
                }
                .buttonStyle(.bordered)
                .disabled(steps.count < 2)
            }
            
            if dependencies.isEmpty {
                Text("No dependencies defined. Steps will execute independently.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(8)
            } else {
                VStack(spacing: 4) {
                    ForEach(dependencies) { dependency in
                        DependencyCard(
                            dependency: dependency,
                            steps: steps,
                            onDelete: {
                                deleteDependency(dependency)
                            }
                        )
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Agent Selection Section
    
    private var agentSelectionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Available Agents")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                ForEach(availableAgents, id: \.self) { agentId in
                    AgentSelectionCard(
                        agentId: agentId,
                        isSelected: selectedAgents.contains(agentId),
                        onToggle: {
                            toggleAgentSelection(agentId)
                        }
                    )
                }
            }
            
            if availableAgents.isEmpty {
                Text("No agents available. Connect to the orchestration service to view agents.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(8)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Helper Functions
    
    private func loadAvailableAgents() {
        availableAgents = webSocketService.agentNetwork.nodes.map { $0.agentId }
    }
    
    private func saveStep(_ step: WorkflowStep) {
        if let index = steps.firstIndex(where: { $0.id == step.id }) {
            steps[index] = step
        } else {
            steps.append(step)
        }
        showStepEditor = false
        editingStep = nil
    }
    
    private func deleteStep(_ step: WorkflowStep) {
        steps.removeAll { $0.id == step.id }
        // Remove any dependencies involving this step
        dependencies.removeAll { $0.fromStepId == step.id || $0.toStepId == step.id }
    }
    
    private func addDependency() {
        // This would open a dependency editor
        // For now, just add a sample dependency
        if steps.count >= 2 {
            let dependency = WorkflowDependency(
                fromStepId: steps[0].id,
                toStepId: steps[1].id,
                dependencyType: .sequential
            )
            dependencies.append(dependency)
        }
    }
    
    private func deleteDependency(_ dependency: WorkflowDependency) {
        dependencies.removeAll { $0.id == dependency.id }
    }
    
    private func toggleAgentSelection(_ agentId: String) {
        if selectedAgents.contains(agentId) {
            selectedAgents.removeAll { $0 == agentId }
        } else {
            selectedAgents.append(agentId)
        }
    }
    
    private func createWorkflow() {
        let workflow = AgentWorkflow(
            name: workflowName,
            steps: steps,
            dependencies: dependencies,
            priority: workflowPriority
        )
        
        Task {
            await webSocketService.executeWorkflow(workflow)
        }
        
        dismiss()
    }
}

// MARK: - Supporting Views

struct WorkflowStepCard: View {
    let step: WorkflowStep
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack {
            // Step order
            Text("\(step.order)")
                .font(.headline)
                .fontWeight(.bold)
                .frame(width: 30, height: 30)
                .background(Circle().fill(.blue.opacity(0.2)))
                .foregroundColor(.blue)
            
            // Step info
            VStack(alignment: .leading, spacing: 4) {
                Text(step.name)
                    .font(.body)
                    .fontWeight(.medium)
                
                Text("Agent: \(step.agentId)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(step.action.type.rawValue)
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.blue.opacity(0.1))
                    .foregroundColor(.blue)
                    .cornerRadius(4)
            }
            
            Spacer()
            
            // Actions
            HStack(spacing: 8) {
                Button("Edit") {
                    onEdit()
                }
                .buttonStyle(.borderless)
                .font(.caption)
                
                Button("Delete") {
                    onDelete()
                }
                .buttonStyle(.borderless)
                .font(.caption)
                .foregroundColor(.red)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}

struct DependencyCard: View {
    let dependency: WorkflowDependency
    let steps: [WorkflowStep]
    let onDelete: () -> Void
    
    var body: some View {
        HStack {
            // Dependency type icon
            Image(systemName: dependencyIcon)
                .foregroundColor(.orange)
                .font(.caption)
            
            // Dependency info
            Text("\(fromStepName) → \(toStepName)")
                .font(.caption)
            
            Text("(\(dependency.dependencyType.rawValue))")
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Button("Delete") {
                onDelete()
            }
            .buttonStyle(.borderless)
            .font(.caption2)
            .foregroundColor(.red)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.ultraThinMaterial)
        .cornerRadius(6)
    }
    
    private var fromStepName: String {
        steps.first { $0.id == dependency.fromStepId }?.name ?? "Unknown"
    }
    
    private var toStepName: String {
        steps.first { $0.id == dependency.toStepId }?.name ?? "Unknown"
    }
    
    private var dependencyIcon: String {
        switch dependency.dependencyType {
        case .sequential: return "arrow.right"
        case .conditional: return "questionmark.diamond"
        case .parallel: return "arrow.up.arrow.down"
        }
    }
}

struct AgentSelectionCard: View {
    let agentId: String
    let isSelected: Bool
    let onToggle: () -> Void
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "brain.head.profile")
                .font(.title2)
                .foregroundColor(isSelected ? .white : .blue)
            
            Text(agentId)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(isSelected ? .white : .primary)
                .lineLimit(1)
        }
        .frame(height: 60)
        .frame(maxWidth: .infinity)
        .background(isSelected ? .blue : .blue.opacity(0.1))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isSelected ? .blue : .clear, lineWidth: 2)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            onToggle()
        }
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

// MARK: - Workflow Step Editor

struct WorkflowStepEditor: View {
    let step: WorkflowStep?
    let availableAgents: [String]
    let onSave: (WorkflowStep) -> Void
    @Environment(\.dismiss) private var dismiss
    
    @State private var stepName = ""
    @State private var selectedAgent = ""
    @State private var actionType: ActionType = .executeTask
    @State private var stepOrder = 1
    @State private var timeout: Double = 30.0
    @State private var retryCount = 3
    @State private var parameters: [String: String] = [:]
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Text(step == nil ? "Create Step" : "Edit Step")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .buttonStyle(.borderless)
                    
                    Button("Save") {
                        saveStep()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(stepName.isEmpty || selectedAgent.isEmpty)
                }
            }
            
            // Step configuration
            VStack(spacing: 16) {
                HStack {
                    Text("Step Name:")
                        .frame(width: 100, alignment: .leading)
                    
                    TextField("Enter step name", text: $stepName)
                        .textFieldStyle(.roundedBorder)
                }
                
                HStack {
                    Text("Agent:")
                        .frame(width: 100, alignment: .leading)
                    
                    Picker("Agent", selection: $selectedAgent) {
                        ForEach(availableAgents, id: \.self) { agent in
                            Text(agent).tag(agent)
                        }
                    }
                    .pickerStyle(.menu)
                    
                    Spacer()
                }
                
                HStack {
                    Text("Action Type:")
                        .frame(width: 100, alignment: .leading)
                    
                    Picker("Action Type", selection: $actionType) {
                        ForEach(ActionType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.menu)
                    
                    Spacer()
                }
                
                HStack {
                    Text("Order:")
                        .frame(width: 100, alignment: .leading)
                    
                    Stepper("\(stepOrder)", value: $stepOrder, in: 1...100)
                        .frame(width: 120)
                    
                    Spacer()
                }
                
                HStack {
                    Text("Timeout:")
                        .frame(width: 100, alignment: .leading)
                    
                    Slider(value: $timeout, in: 5...300, step: 5)
                        .frame(width: 200)
                    
                    Text("\(timeout, specifier: "%.0f")s")
                        .frame(width: 40)
                    
                    Spacer()
                }
                
                HStack {
                    Text("Retry Count:")
                        .frame(width: 100, alignment: .leading)
                    
                    Stepper("\(retryCount)", value: $retryCount, in: 0...10)
                        .frame(width: 120)
                    
                    Spacer()
                }
            }
            
            Spacer()
        }
        .padding()
        .onAppear {
            loadStepData()
        }
    }
    
    private func loadStepData() {
        if let step = step {
            stepName = step.name
            selectedAgent = step.agentId
            actionType = step.action.type
            stepOrder = step.order
            timeout = step.timeout
            retryCount = step.retryCount
            parameters = step.action.parameters
        } else if !availableAgents.isEmpty {
            selectedAgent = availableAgents[0]
        }
    }
    
    private func saveStep() {
        let action = AgentAction(
            type: actionType,
            parameters: parameters
        )
        
        let newStep = WorkflowStep(
            id: step?.id ?? UUID().uuidString,
            name: stepName,
            agentId: selectedAgent,
            action: action,
            order: stepOrder,
            timeout: timeout,
            retryCount: retryCount
        )
        
        onSave(newStep)
        dismiss()
    }
}

#Preview {
    WorkflowCreatorView(webSocketService: AgentWebSocketService())
        .frame(width: 800, height: 700)
}