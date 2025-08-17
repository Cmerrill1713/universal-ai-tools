import Foundation
import SwiftUI
import Combine

/// Enhanced agent workflow service that connects objectives with real-time execution
/// Provides workflow orchestration, progress tracking, and agent coordination
@MainActor
class AgentWorkflowService: ObservableObject {
    @Published var activeWorkflows: [AgentWorkflow] = []
    @Published var workflowHistory: [WorkflowExecution] = []
    @Published var workflowTemplates: [AgentWorkflowTemplate] = []
    
    // Real-time workflow status
    @Published var executionStatus: [String: WorkflowStatus] = [:]
    @Published var workflowMetrics: WorkflowMetrics = WorkflowMetrics()
    
    // Dependencies
    private let apiService: APIService
    private let webSocketService: AgentWebSocketService
    private var cancellables = Set<AnyCancellable>()
    
    // Workflow execution engine
    private var executionEngine: WorkflowExecutionEngine
    
    init(apiService: APIService, webSocketService: AgentWebSocketService) {
        self.apiService = apiService
        self.webSocketService = webSocketService
        self.executionEngine = WorkflowExecutionEngine()
        
        setupWorkflowObservation()
        loadWorkflowTemplates()
    }
    
    // MARK: - Workflow Creation and Management
    
    /// Create workflow from objective with contextual steps
    func createWorkflow(from objective: Objective) -> AgentWorkflow {
        let workflowId = UUID().uuidString
        
        let steps = generateWorkflowSteps(for: objective)
        let requiredAgents = determineRequiredAgents(for: objective.title)
        
        let workflow = AgentWorkflow(
            name: "Workflow for \(objective.title)",
            steps: steps,
            executionState: .pending,
            priority: determinePriority(for: objective)
        )
        
        activeWorkflows.append(workflow)
        executionStatus[workflowId] = WorkflowStatus(
            workflowId: workflowId,
            state: .created,
            progress: 0.0,
            currentStep: 0,
            startTime: nil,
            estimatedCompletion: nil
        )
        
        return workflow
    }
    
    /// Execute workflow with real-time progress tracking
    func executeWorkflow(_ workflowId: String) async throws {
        guard let workflowIndex = activeWorkflows.firstIndex(where: { $0.id == workflowId }) else {
            throw WorkflowError.workflowNotFound
        }
        
        var workflow = activeWorkflows[workflowIndex]
        workflow.executionState = .running
        activeWorkflows[workflowIndex] = workflow
        
        // Update execution status
        executionStatus[workflowId] = WorkflowStatus(
            workflowId: workflowId,
            state: .running,
            progress: 0.0,
            currentStep: 0,
            startTime: Date(),
            estimatedCompletion: Date().addingTimeInterval(workflow.estimatedDuration)
        )
        
        // Create workflow execution record
        let execution = WorkflowExecution(
            id: UUID().uuidString,
            workflowId: workflowId,
            startTime: Date(),
            status: .running
        )
        workflowHistory.append(execution)
        
        // Execute workflow through engine
        try await executionEngine.execute(workflow) { [weak self] progress in
            Task { @MainActor in
                self?.updateWorkflowProgress(workflowId, progress: progress)
            }
        }
        
        // Send workflow to WebSocket service for real-time coordination
        await webSocketService.executeWorkflow(workflow)
        
        // Update metrics
        workflowMetrics.totalExecutions += 1
        workflowMetrics.activeWorkflows = activeWorkflows.filter { $0.executionState == .running }.count
    }
    
    /// Pause workflow execution
    func pauseWorkflow(_ workflowId: String) {
        guard let workflowIndex = activeWorkflows.firstIndex(where: { $0.id == workflowId }) else { return }
        
        activeWorkflows[workflowIndex].executionState = .paused
        executionStatus[workflowId]?.state = .paused
        
        executionEngine.pauseWorkflow(workflowId)
    }
    
    /// Resume workflow execution
    func resumeWorkflow(_ workflowId: String) async throws {
        guard let workflowIndex = activeWorkflows.firstIndex(where: { $0.id == workflowId }) else {
            throw WorkflowError.workflowNotFound
        }
        
        activeWorkflows[workflowIndex].executionState = .running
        executionStatus[workflowId]?.state = .running
        
        try await executionEngine.resumeWorkflow(workflowId)
    }
    
    /// Cancel workflow execution
    func cancelWorkflow(_ workflowId: String) {
        guard let workflowIndex = activeWorkflows.firstIndex(where: { $0.id == workflowId }) else { return }
        
        activeWorkflows[workflowIndex].executionState = .cancelled
        executionStatus[workflowId]?.state = .cancelled
        
        executionEngine.cancelWorkflow(workflowId)
        
        // Update history
        if let historyIndex = workflowHistory.firstIndex(where: { $0.workflowId == workflowId && $0.endTime == nil }) {
            workflowHistory[historyIndex].endTime = Date()
            workflowHistory[historyIndex].status = .cancelled
        }
    }
    
    // MARK: - Progress Tracking
    
    private func updateWorkflowProgress(_ workflowId: String, progress: WorkflowProgress) {
        guard let statusIndex = executionStatus.firstIndex(where: { $0.key == workflowId }) else { return }
        
        executionStatus[workflowId]?.progress = progress.completionPercentage
        executionStatus[workflowId]?.currentStep = progress.currentStepIndex
        
        if progress.completionPercentage >= 1.0 {
            completeWorkflow(workflowId)
        }
    }
    
    private func completeWorkflow(_ workflowId: String) {
        guard let workflowIndex = activeWorkflows.firstIndex(where: { $0.id == workflowId }) else { return }
        
        activeWorkflows[workflowIndex].executionState = .completed
        executionStatus[workflowId]?.state = .completed
        executionStatus[workflowId]?.progress = 1.0
        
        // Update history
        if let historyIndex = workflowHistory.firstIndex(where: { $0.workflowId == workflowId && $0.endTime == nil }) {
            workflowHistory[historyIndex].endTime = Date()
            workflowHistory[historyIndex].status = .completed
        }
        
        // Update metrics
        workflowMetrics.completedWorkflows += 1
        workflowMetrics.successRate = Double(workflowMetrics.completedWorkflows) / Double(workflowMetrics.totalExecutions)
        workflowMetrics.activeWorkflows = activeWorkflows.filter { $0.executionState == .running }.count
    }
    
    // MARK: - Workflow Generation
    
    private func generateWorkflowSteps(for objective: Objective) -> [AgentWorkflowStep] {
        // Determine objective type from title or description
        let objectiveType = determineObjectiveType(from: objective)
        
        switch objectiveType {
        case "Development":
            return generateDevelopmentSteps(for: objective)
        case "Creative":
            return generateCreativeSteps(for: objective)
        case "Analysis":
            return generateAnalysisSteps(for: objective)
        case "Organization":
            return generateOrganizationSteps(for: objective)
        case "Research":
            return generateResearchSteps(for: objective)
        default:
            return generateGenericSteps(for: objective)
        }
    }
    
    private func determineObjectiveType(from objective: Objective) -> String {
        let title = objective.title.lowercased()
        let description = objective.description.lowercased()
        
        if title.contains("develop") || title.contains("code") || title.contains("build") ||
           description.contains("develop") || description.contains("code") || description.contains("build") {
            return "Development"
        } else if title.contains("research") || title.contains("analyze") || title.contains("study") ||
                  description.contains("research") || description.contains("analyze") || description.contains("study") {
            return "Research"
        } else if title.contains("create") || title.contains("design") || title.contains("visual") ||
                  description.contains("create") || description.contains("design") || description.contains("visual") {
            return "Creative"
        } else if title.contains("organize") || title.contains("sort") || title.contains("clean") ||
                  description.contains("organize") || description.contains("sort") || description.contains("clean") {
            return "Organization"
        } else {
            return "Analysis"
        }
    }
    
    private func generateDevelopmentSteps(for objective: Objective) -> [AgentWorkflowStep] {
        return [
            AgentWorkflowStep(
                name: "Requirements Analysis",
                agentId: "analysis-agent",
                action: AgentAction(type: .analyzeData),
                order: 1
            ),
            AgentWorkflowStep(
                name: "Architecture Design",
                agentId: "orchestration-agent",
                action: AgentAction(type: .processWorkflow),
                order: 2
            ),
            AgentWorkflowStep(
                name: "Code Generation",
                agentId: "coding-agent",
                action: AgentAction(type: .executeTask),
                order: 3
            ),
            AgentWorkflowStep(
                name: "Testing & Validation",
                agentId: "monitoring-agent",
                action: AgentAction(type: .monitorSystem),
                order: 4
            )
        ]
    }
    
    private func generateCreativeSteps(for objective: Objective) -> [AgentWorkflowStep] {
        return [
            AgentWorkflowStep(
                name: "Content Planning",
                agentId: "orchestration-agent", 
                action: AgentAction(type: .executeTask),
                order: 1
            ),
            AgentWorkflowStep(
                name: "Asset Creation",
                agentId: "chat-agent",
                action: AgentAction(type: .executeTask),
                order: 2
            ),
            AgentWorkflowStep(
                name: "Style Application",
                agentId: "analysis-agent",
                action: AgentAction(type: .executeTask),
                order: 3
            )
        ]
    }
    
    private func generateAnalysisSteps(for objective: Objective) -> [AgentWorkflowStep] {
        return [
            AgentWorkflowStep(
                name: "Data Collection",
                agentId: "research-agent",
                action: AgentAction(type: .analyzeData),
                order: 1
            ),
            AgentWorkflowStep(
                name: "Statistical Analysis",
                agentId: "analysis-agent",
                action: AgentAction(type: .analyzeData),
                order: 2
            ),
            AgentWorkflowStep(
                name: "Report Generation",
                agentId: "chat-agent",
                action: AgentAction(type: .executeTask),
                order: 3
            )
        ]
    }
    
    private func generateOrganizationSteps(for objective: Objective) -> [AgentWorkflowStep] {
        return [
            AgentWorkflowStep(
                name: "Content Scanning",
                agentId: "analysis-agent",
                action: AgentAction(type: .analyzeData),
                order: 1
            ),
            AgentWorkflowStep(
                name: "Smart Sorting",
                agentId: "orchestration-agent",
                action: AgentAction(type: .processWorkflow),
                order: 2
            ),
            AgentWorkflowStep(
                name: "Duplicate Removal",
                agentId: "monitoring-agent",
                action: AgentAction(type: .executeTask),
                order: 3
            )
        ]
    }
    
    private func generateResearchSteps(for objective: Objective) -> [AgentWorkflowStep] {
        return [
            AgentWorkflowStep(
                name: "Source Discovery",
                agentId: "research-agent",
                action: AgentAction(type: .analyzeData),
                order: 1
            ),
            AgentWorkflowStep(
                name: "Information Synthesis",
                agentId: "analysis-agent",
                action: AgentAction(type: .analyzeData),
                order: 2
            ),
            AgentWorkflowStep(
                name: "Documentation",
                agentId: "chat-agent",
                action: AgentAction(type: .executeTask),
                order: 3
            )
        ]
    }
    
    private func generateGenericSteps(for objective: Objective) -> [AgentWorkflowStep] {
        return [
            AgentWorkflowStep(
                name: "Task Planning",
                agentId: "orchestration-agent",
                action: AgentAction(type: .processWorkflow),
                order: 1
            ),
            AgentWorkflowStep(
                name: "Execution",
                agentId: "chat-agent",
                action: AgentAction(type: .executeTask),
                order: 2
            )
        ]
    }
    
    private func determineRequiredAgents(for objectiveType: String) -> [AgentType] {
        switch objectiveType {
        case "Development":
            return [.analysis, .orchestration, .coding]
        case "Creative":
            return [.chat, .orchestration]
        case "Analysis":
            return [.analysis, .research]
        case "Organization":
            return [.analysis, .orchestration]
        case "Research":
            return [.research, .analysis]
        default:
            return [.chat]
        }
    }
    
    private func determinePriority(for objective: Objective) -> AgentWorkflowPriority {
        switch objective.status {
        case .active:
            return .high
        case .planning:
            return .normal
        default:
            return .low
        }
    }
    
    private func estimateDuration(for steps: [AgentWorkflowStep]) -> TimeInterval {
        // Since AgentWorkflowStep doesn't have estimatedDuration, use a default estimate
        return TimeInterval(steps.count * 300) // 5 minutes per step
    }
    
    private func generateTags(for objective: Objective) -> [String] {
        let objectiveType = determineObjectiveType(from: objective)
        var tags = [objectiveType.lowercased()]
        
        if objective.status == .active {
            tags.append("active")
        }
        
        if objective.progress > 0.5 {
            tags.append("in-progress")
        }
        
        return tags
    }
    
    // MARK: - WebSocket Integration
    
    private func setupWorkflowObservation() {
        // Listen for workflow updates from WebSocket service
        webSocketService.$activeWorkflows
            .receive(on: DispatchQueue.main)
            .sink { [weak self] workflows in
                self?.syncWorkflowUpdates(workflows)
            }
            .store(in: &cancellables)
    }
    
    private func syncWorkflowUpdates(_ workflows: [AgentWorkflow]) {
        // Sync workflow updates from real-time service
        for workflow in workflows {
            if let index = activeWorkflows.firstIndex(where: { $0.id == workflow.id }) {
                activeWorkflows[index] = workflow
                
                // Update execution status
                if let status = executionStatus[workflow.id] {
                    var updatedStatus = status
                    updatedStatus.state = workflow.executionState
                    executionStatus[workflow.id] = updatedStatus
                }
            }
        }
    }
    
    // MARK: - Template Management
    
    private func loadWorkflowTemplates() {
        workflowTemplates = [
            AgentWorkflowTemplate(
                id: "dev-webapp",
                name: "Web Application Development",
                description: "Complete workflow for building web applications",
                objectiveTypes: ["Development"],
                stepTemplates: [
                    "Requirements Analysis",
                    "UI/UX Design",
                    "Backend Development",
                    "Frontend Development",
                    "Testing & Deployment"
                ]
            ),
            AgentWorkflowTemplate(
                id: "content-creation",
                name: "Content Creation Pipeline",
                description: "End-to-end content creation and optimization",
                objectiveTypes: ["Creative"],
                stepTemplates: [
                    "Content Planning",
                    "Asset Creation",
                    "Style Application",
                    "Quality Review",
                    "Publication"
                ]
            ),
            AgentWorkflowTemplate(
                id: "data-analysis",
                name: "Data Analysis Workflow",
                description: "Comprehensive data analysis and reporting",
                objectiveTypes: ["Analysis"],
                stepTemplates: [
                    "Data Collection",
                    "Data Cleaning",
                    "Statistical Analysis",
                    "Visualization",
                    "Report Generation"
                ]
            )
        ]
    }
    
    /// Get workflow template for objective type
    func getTemplate(for objectiveType: String) -> AgentWorkflowTemplate? {
        return workflowTemplates.first { $0.objectiveTypes.contains(objectiveType) }
    }
}

// MARK: - Data Models

// Note: AgentWorkflow is defined in Models/AgentTypes.swift

struct AgentWorkflowStepDefinition: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let requiredAgent: AgentType
    let estimatedDuration: TimeInterval
    let dependencies: [String]
    let tools: [String]
    var status: StepStatus = .pending
    var startTime: Date?
    var endTime: Date?
    var output: String?
}

struct WorkflowStatus {
    let workflowId: String
    var state: WorkflowExecutionState
    var progress: Double
    var currentStep: Int
    let startTime: Date?
    var estimatedCompletion: Date?
    var actualCompletion: Date?
    var errorMessage: String?
}

struct WorkflowExecution: Codable, Identifiable {
    let id: String
    let workflowId: String
    let startTime: Date
    var endTime: Date?
    var status: WorkflowExecutionState
    var steps: [StepExecution] = []
    var metrics: ExecutionMetrics?
}

struct StepExecution: Codable {
    let stepId: String
    let startTime: Date
    var endTime: Date?
    var status: StepStatus
    var output: String?
    var errorMessage: String?
}

struct WorkflowMetrics {
    var totalExecutions: Int = 0
    var completedWorkflows: Int = 0
    var failedWorkflows: Int = 0
    var activeWorkflows: Int = 0
    var averageExecutionTime: TimeInterval = 0
    var successRate: Double = 0
}

struct ExecutionMetrics: Codable {
    let totalDuration: TimeInterval
    let stepsCompleted: Int
    let stepsTotal: Int
    let resourceUsage: [String: Double]
}

struct AgentWorkflowTemplate {
    let id: String
    let name: String
    let description: String
    let objectiveTypes: [String]
    let stepTemplates: [String]
}

struct WorkflowProgress {
    let completionPercentage: Double
    let currentStepIndex: Int
    let currentStepName: String
    let timeRemaining: TimeInterval?
    let lastUpdate: Date
}

enum WorkflowExecutionState: String, Codable, CaseIterable {
    case created = "created"
    case running = "running"
    case paused = "paused"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
}

enum WorkflowPriority: String, Codable, CaseIterable {
    case low = "low"
    case normal = "normal"
    case high = "high"
    case urgent = "urgent"
}

enum StepStatus: String, Codable, CaseIterable {
    case pending = "pending"
    case running = "running"
    case completed = "completed"
    case failed = "failed"
    case skipped = "skipped"
}


enum WorkflowError: Error, LocalizedError {
    case workflowNotFound
    case invalidWorkflowState
    case executionFailed(String)
    case agentUnavailable
    
    var errorDescription: String? {
        switch self {
        case .workflowNotFound:
            return "Workflow not found"
        case .invalidWorkflowState:
            return "Invalid workflow state for this operation"
        case .executionFailed(let reason):
            return "Workflow execution failed: \(reason)"
        case .agentUnavailable:
            return "Required agent is not available"
        }
    }
}

// MARK: - Workflow Execution Engine

class WorkflowExecutionEngine {
    private var runningWorkflows: [String: Task<Void, Error>] = [:]
    
    func execute(_ workflow: AgentWorkflow, progressCallback: @escaping (WorkflowProgress) -> Void) async throws {
        let workflowId = workflow.id
        
        let task = Task {
            var completedSteps = 0
            let totalSteps = workflow.steps.count
            
            for (index, step) in workflow.steps.enumerated() {
                // Check for cancellation
                try Task.checkCancellation()
                
                // Execute step
                try await executeStep(step)
                
                // Update progress
                completedSteps += 1
                let progress = WorkflowProgress(
                    completionPercentage: Double(completedSteps) / Double(totalSteps),
                    currentStepIndex: index,
                    currentStepName: step.name,
                    timeRemaining: estimateRemainingTime(workflow, completedSteps: completedSteps),
                    lastUpdate: Date()
                )
                
                progressCallback(progress)
                
                // Artificial delay for demonstration
                try await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
            }
        }
        
        runningWorkflows[workflowId] = task
        
        do {
            try await task.value
            runningWorkflows.removeValue(forKey: workflowId)
        } catch {
            runningWorkflows.removeValue(forKey: workflowId)
            throw error
        }
    }
    
    private func executeStep(_ step: AgentWorkflowStep) async throws {
        // Simulate step execution
        // In a real implementation, this would delegate to appropriate agents
        print("Executing step: \(step.name)")
        
        // Simulate varying execution times (default 5 seconds per step)
        let executionTime = UInt64(5_000_000_000) // 5 seconds in nanoseconds
        try await Task.sleep(nanoseconds: executionTime)
        
        print("Completed step: \(step.name)")
    }
    
    func pauseWorkflow(_ workflowId: String) {
        runningWorkflows[workflowId]?.cancel()
        runningWorkflows.removeValue(forKey: workflowId)
    }
    
    func resumeWorkflow(_ workflowId: String) async throws {
        // In a real implementation, this would resume from the paused state
        // For now, this is a placeholder
        print("Resuming workflow: \(workflowId)")
    }
    
    func cancelWorkflow(_ workflowId: String) {
        runningWorkflows[workflowId]?.cancel()
        runningWorkflows.removeValue(forKey: workflowId)
    }
    
    private func estimateRemainingTime(_ workflow: AgentWorkflow, completedSteps: Int) -> TimeInterval {
        let remainingSteps = workflow.steps.count - completedSteps
        guard remainingSteps > 0 else { return 0 }
        
        let totalDuration = workflow.estimatedDuration
        let averageStepDuration = totalDuration / Double(workflow.steps.count)
        
        return averageStepDuration * Double(remainingSteps)
    }
}