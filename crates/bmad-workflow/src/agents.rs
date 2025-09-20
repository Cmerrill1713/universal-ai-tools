//! BMAD Agent System - AI Agent Collaboration and Orchestration
//! 
//! This module defines the agent roles, collaboration patterns, and orchestration
//! mechanisms for BMAD workflows.

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// BMAD Agent with specialized roles and capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BMADAgent {
    pub id: Uuid,
    pub name: String,
    pub role: AgentRole,
    pub expertise: Vec<String>,
    pub status: AgentStatus,
    pub performance_metrics: AgentMetrics,
    pub created_at: DateTime<Utc>,
}

/// Agent roles in BMAD workflows
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentRole {
    ProductManager,
    Architect,
    Designer,
    FrontendDeveloper,
    BackendDeveloper,
    MLEngineer,
    DevOpsEngineer,
    QAEngineer,
    CodeReviewer,
    TechnicalWriter,
    SecurityExpert,
    PerformanceExpert,
}

/// Agent status during workflow execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentStatus {
    Available,
    Working,
    Collaborating,
    Waiting,
    Completed,
    Error,
}

/// Performance metrics for agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetrics {
    pub tasks_completed: u32,
    pub success_rate: f32,
    pub average_completion_time: f32,
    pub collaboration_score: f32,
    pub quality_score: f32,
}

/// Agent collaboration orchestrator
#[derive(Debug)]
pub struct AgentCollaboration {
    pub agents: Vec<BMADAgent>,
    pub collaboration_strategy: CollaborationStrategy,
    pub communication_protocol: CommunicationProtocol,
    pub conflict_resolution: ConflictResolutionStrategy,
}

/// Collaboration strategies for agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CollaborationStrategy {
    Sequential,    // Agents work one after another
    Parallel,      // Agents work simultaneously
    Iterative,     // Agents iterate and refine together
    Hierarchical,  // Lead agent coordinates others
    Consensus,     // Agents reach consensus through discussion
}

/// Communication protocols for agent interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommunicationProtocol {
    Direct,        // Direct agent-to-agent communication
    Mediated,      // Communication through a mediator
    Broadcast,     // Broadcast messages to all agents
    Hierarchical,  // Communication through hierarchy
}

/// Conflict resolution strategies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolutionStrategy {
    MajorityVote,   // Resolve conflicts by majority vote
    ExpertOpinion,  // Defer to expert agent's opinion
    Compromise,     // Find compromise solution
    Arbitration,    // Use arbitrator to resolve conflicts
    Escalation,     // Escalate to higher authority
}

impl BMADAgent {
    /// Create a new BMAD agent
    pub fn new(name: String, role: AgentRole, expertise: Vec<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            role,
            expertise,
            status: AgentStatus::Available,
            performance_metrics: AgentMetrics {
                tasks_completed: 0,
                success_rate: 1.0,
                average_completion_time: 0.0,
                collaboration_score: 0.8,
                quality_score: 0.8,
            },
            created_at: Utc::now(),
        }
    }
    
    /// Update agent status
    pub fn update_status(&mut self, status: AgentStatus) {
        self.status = status;
    }
    
    /// Record task completion
    pub fn record_task_completion(&mut self, success: bool, completion_time: f32) {
        self.performance_metrics.tasks_completed += 1;
        
        // Update success rate
        let total_tasks = self.performance_metrics.tasks_completed as f32;
        let current_successes = self.performance_metrics.success_rate * (total_tasks - 1.0);
        let new_successes = if success { current_successes + 1.0 } else { current_successes };
        self.performance_metrics.success_rate = new_successes / total_tasks;
        
        // Update average completion time
        let current_avg = self.performance_metrics.average_completion_time;
        let new_avg = (current_avg * (total_tasks - 1.0) + completion_time) / total_tasks;
        self.performance_metrics.average_completion_time = new_avg;
    }
    
    /// Check if agent can handle a specific task
    pub fn can_handle_task(&self, task_type: &str) -> bool {
        self.expertise.contains(&task_type.to_string()) || 
        self.is_generalist_for_task(task_type)
    }
    
    /// Check if agent is a generalist for the task type
    fn is_generalist_for_task(&self, task_type: &str) -> bool {
        match self.role {
            AgentRole::ProductManager => {
                matches!(task_type, "PRD" | "project_planning" | "requirements")
            },
            AgentRole::Architect => {
                matches!(task_type, "architecture" | "design" | "technical_spec")
            },
            AgentRole::Designer => {
                matches!(task_type, "UX" | "UI" | "design" | "user_experience")
            },
            AgentRole::FrontendDeveloper => {
                matches!(task_type, "frontend" | "UI" | "client_side")
            },
            AgentRole::BackendDeveloper => {
                matches!(task_type, "backend" | "API" | "server_side")
            },
            AgentRole::MLEngineer => {
                matches!(task_type, "ML" | "AI" | "data_science" | "modeling")
            },
            AgentRole::DevOpsEngineer => {
                matches!(task_type, "deployment" | "infrastructure" | "CI_CD")
            },
            AgentRole::QAEngineer => {
                matches!(task_type, "testing" | "quality" | "validation")
            },
            AgentRole::CodeReviewer => {
                matches!(task_type, "code_review" | "quality" | "standards")
            },
            AgentRole::TechnicalWriter => {
                matches!(task_type, "documentation" | "writing" | "communication")
            },
            AgentRole::SecurityExpert => {
                matches!(task_type, "security" | "vulnerability" | "compliance")
            },
            AgentRole::PerformanceExpert => {
                matches!(task_type, "performance" | "optimization" | "scalability")
            },
        }
    }
    
    /// Get agent's collaboration style
    pub fn get_collaboration_style(&self) -> CollaborationStyle {
        match self.role {
            AgentRole::ProductManager | AgentRole::Architect => {
                CollaborationStyle::Leadership
            },
            AgentRole::Designer | AgentRole::FrontendDeveloper => {
                CollaborationStyle::Creative
            },
            AgentRole::BackendDeveloper | AgentRole::MLEngineer => {
                CollaborationStyle::Technical
            },
            AgentRole::QAEngineer | AgentRole::CodeReviewer => {
                CollaborationStyle::Analytical
            },
            AgentRole::DevOpsEngineer | AgentRole::SecurityExpert => {
                CollaborationStyle::Operational
            },
            _ => CollaborationStyle::Supportive,
        }
    }
}

/// Collaboration styles for agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CollaborationStyle {
    Leadership,   // Takes lead in collaboration
    Creative,     // Focuses on creative solutions
    Technical,    // Focuses on technical implementation
    Analytical,   // Focuses on analysis and review
    Operational,  // Focuses on operations and deployment
    Supportive,  // Provides support to other agents
}

impl AgentCollaboration {
    /// Create new agent collaboration
    pub fn new(agents: Vec<BMADAgent>) -> Self {
        Self {
            agents,
            collaboration_strategy: CollaborationStrategy::Collaborative,
            communication_protocol: CommunicationProtocol::Direct,
            conflict_resolution: ConflictResolutionStrategy::Consensus,
        }
    }
    
    /// Set collaboration strategy
    pub fn with_strategy(mut self, strategy: CollaborationStrategy) -> Self {
        self.collaboration_strategy = strategy;
        self
    }
    
    /// Set communication protocol
    pub fn with_communication(mut self, protocol: CommunicationProtocol) -> Self {
        self.communication_protocol = protocol;
        self
    }
    
    /// Set conflict resolution strategy
    pub fn with_conflict_resolution(mut self, strategy: ConflictResolutionStrategy) -> Self {
        self.conflict_resolution = strategy;
        self
    }
    
    /// Find best agent for a specific task
    pub fn find_best_agent(&self, task_type: &str) -> Option<&BMADAgent> {
        self.agents.iter()
            .filter(|agent| agent.can_handle_task(task_type))
            .max_by(|a, b| {
                // Prioritize by expertise match, then by performance
                let a_expertise_match = a.expertise.contains(&task_type.to_string()) as u8;
                let b_expertise_match = b.expertise.contains(&task_type.to_string()) as u8;
                
                if a_expertise_match != b_expertise_match {
                    a_expertise_match.cmp(&b_expertise_match)
                } else {
                    a.performance_metrics.success_rate.partial_cmp(&b.performance_metrics.success_rate).unwrap_or(std::cmp::Ordering::Equal)
                }
            })
    }
    
    /// Get agents by role
    pub fn get_agents_by_role(&self, role: AgentRole) -> Vec<&BMADAgent> {
        self.agents.iter()
            .filter(|agent| std::mem::discriminant(&agent.role) == std::mem::discriminant(&role))
            .collect()
    }
    
    /// Get available agents
    pub fn get_available_agents(&self) -> Vec<&BMADAgent> {
        self.agents.iter()
            .filter(|agent| matches!(agent.status, AgentStatus::Available))
            .collect()
    }
    
    /// Coordinate agent collaboration
    pub async fn coordinate_collaboration(&mut self, task: CollaborationTask) -> CollaborationResult {
        match self.collaboration_strategy {
            CollaborationStrategy::Sequential => {
                self.execute_sequential_collaboration(task).await
            },
            CollaborationStrategy::Parallel => {
                self.execute_parallel_collaboration(task).await
            },
            CollaborationStrategy::Iterative => {
                self.execute_iterative_collaboration(task).await
            },
            CollaborationStrategy::Hierarchical => {
                self.execute_hierarchical_collaboration(task).await
            },
            CollaborationStrategy::Consensus => {
                self.execute_consensus_collaboration(task).await
            },
        }
    }
    
    /// Execute sequential collaboration
    async fn execute_sequential_collaboration(&mut self, task: CollaborationTask) -> CollaborationResult {
        let mut results = Vec::new();
        
        for subtask in task.subtasks {
            if let Some(agent) = self.find_best_agent(&subtask.task_type) {
                let agent_id = agent.id;
                if let Some(agent_mut) = self.agents.iter_mut().find(|a| a.id == agent_id) {
                    agent_mut.update_status(AgentStatus::Working);
                    
                    let result = self.execute_agent_task(agent_mut, &subtask).await;
                    results.push(result);
                    
                    agent_mut.update_status(AgentStatus::Available);
                }
            }
        }
        
        CollaborationResult {
            success: results.iter().all(|r| r.success),
            results,
            collaboration_metrics: self.calculate_collaboration_metrics(&results),
        }
    }
    
    /// Execute parallel collaboration
    async fn execute_parallel_collaboration(&mut self, task: CollaborationTask) -> CollaborationResult {
        use tokio::task;
        
        let mut tasks = Vec::new();
        
        for subtask in task.subtasks {
            if let Some(agent) = self.find_best_agent(&subtask.task_type) {
                let agent_clone = agent.clone();
                let subtask_clone = subtask.clone();
                
                let task_handle = task::spawn(async move {
                    Self::execute_agent_task_static(agent_clone, subtask_clone).await
                });
                
                tasks.push(task_handle);
            }
        }
        
        let mut results = Vec::new();
        for task_handle in tasks {
            if let Ok(result) = task_handle.await {
                results.push(result);
            }
        }
        
        CollaborationResult {
            success: results.iter().all(|r| r.success),
            results,
            collaboration_metrics: self.calculate_collaboration_metrics(&results),
        }
    }
    
    /// Execute iterative collaboration
    async fn execute_iterative_collaboration(&mut self, task: CollaborationTask) -> CollaborationResult {
        let mut results = Vec::new();
        let max_iterations = 3;
        
        for iteration in 0..max_iterations {
            let iteration_results = self.execute_parallel_collaboration(task.clone()).await;
            results.extend(iteration_results.results);
            
            // Check for convergence
            if self.check_convergence(&results) {
                break;
            }
        }
        
        CollaborationResult {
            success: results.iter().all(|r| r.success),
            results,
            collaboration_metrics: self.calculate_collaboration_metrics(&results),
        }
    }
    
    /// Execute hierarchical collaboration
    async fn execute_hierarchical_collaboration(&mut self, task: CollaborationTask) -> CollaborationResult {
        // Find lead agent (usually Product Manager or Architect)
        let lead_agent = self.agents.iter()
            .find(|agent| matches!(agent.role, AgentRole::ProductManager | AgentRole::Architect));
        
        if let Some(lead) = lead_agent {
            // Lead agent coordinates the collaboration
            let coordination_result = self.execute_agent_coordination(lead, &task).await;
            
            // Other agents execute subtasks
            let mut results = vec![coordination_result];
            let subtask_results = self.execute_parallel_collaboration(task).await;
            results.extend(subtask_results.results);
            
            CollaborationResult {
                success: results.iter().all(|r| r.success),
                results,
                collaboration_metrics: self.calculate_collaboration_metrics(&results),
            }
        } else {
            // Fallback to parallel collaboration
            self.execute_parallel_collaboration(task).await
        }
    }
    
    /// Execute consensus collaboration
    async fn execute_consensus_collaboration(&mut self, task: CollaborationTask) -> CollaborationResult {
        // All agents discuss and reach consensus
        let discussion_result = self.facilitate_agent_discussion(&task).await;
        
        // Execute based on consensus
        let execution_result = self.execute_parallel_collaboration(task).await;
        
        CollaborationResult {
            success: discussion_result.success && execution_result.success,
            results: execution_result.results,
            collaboration_metrics: self.calculate_collaboration_metrics(&execution_result.results),
        }
    }
    
    /// Execute a single agent task
    async fn execute_agent_task(&mut self, agent: &mut BMADAgent, subtask: &AgentTask) -> AgentTaskResult {
        let start_time = std::time::Instant::now();
        
        // Simulate task execution
        let success = self.simulate_task_execution(agent, subtask).await;
        
        let completion_time = start_time.elapsed().as_secs_f32();
        agent.record_task_completion(success, completion_time);
        
        AgentTaskResult {
            agent_id: agent.id,
            task_id: subtask.id,
            success,
            result: if success { "Task completed successfully".to_string() } else { "Task failed".to_string() },
            completion_time,
            quality_score: if success { 0.8 } else { 0.2 },
        }
    }
    
    /// Static version for parallel execution
    async fn execute_agent_task_static(agent: BMADAgent, subtask: AgentTask) -> AgentTaskResult {
        let start_time = std::time::Instant::now();
        
        // Simulate task execution
        let success = Self::simulate_task_execution_static(&agent, &subtask).await;
        
        let completion_time = start_time.elapsed().as_secs_f32();
        
        AgentTaskResult {
            agent_id: agent.id,
            task_id: subtask.id,
            success,
            result: if success { "Task completed successfully".to_string() } else { "Task failed".to_string() },
            completion_time,
            quality_score: if success { 0.8 } else { 0.2 },
        }
    }
    
    /// Simulate task execution
    async fn simulate_task_execution(&self, agent: &BMADAgent, subtask: &AgentTask) -> bool {
        // Simulate work based on agent expertise and task complexity
        let expertise_match = agent.expertise.contains(&subtask.task_type);
        let base_success_rate = if expertise_match { 0.9 } else { 0.7 };
        
        // Add some randomness
        let random_factor = (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() % 100) as f32 / 100.0;
        
        base_success_rate + random_factor > 0.5
    }
    
    /// Static version for parallel execution
    async fn simulate_task_execution_static(agent: &BMADAgent, subtask: &AgentTask) -> bool {
        // Same logic as above but static
        let expertise_match = agent.expertise.contains(&subtask.task_type);
        let base_success_rate = if expertise_match { 0.9 } else { 0.7 };
        
        let random_factor = (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() % 100) as f32 / 100.0;
        
        base_success_rate + random_factor > 0.5
    }
    
    /// Execute agent coordination (for hierarchical collaboration)
    async fn execute_agent_coordination(&self, lead_agent: &BMADAgent, task: &CollaborationTask) -> AgentTaskResult {
        AgentTaskResult {
            agent_id: lead_agent.id,
            task_id: Uuid::new_v4(),
            success: true,
            result: "Coordination completed successfully".to_string(),
            completion_time: 0.1,
            quality_score: 0.9,
        }
    }
    
    /// Facilitate agent discussion (for consensus collaboration)
    async fn facilitate_agent_discussion(&self, task: &CollaborationTask) -> AgentTaskResult {
        AgentTaskResult {
            agent_id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            success: true,
            result: "Consensus reached".to_string(),
            completion_time: 0.2,
            quality_score: 0.8,
        }
    }
    
    /// Check if results have converged
    fn check_convergence(&self, results: &[AgentTaskResult]) -> bool {
        // Simple convergence check - all results have high quality scores
        results.iter().all(|result| result.quality_score > 0.8)
    }
    
    /// Calculate collaboration metrics
    fn calculate_collaboration_metrics(&self, results: &[AgentTaskResult]) -> CollaborationMetrics {
        let total_tasks = results.len() as f32;
        let successful_tasks = results.iter().filter(|r| r.success).count() as f32;
        let average_quality = results.iter().map(|r| r.quality_score).sum::<f32>() / total_tasks;
        let average_completion_time = results.iter().map(|r| r.completion_time).sum::<f32>() / total_tasks;
        
        CollaborationMetrics {
            success_rate: successful_tasks / total_tasks,
            average_quality_score: average_quality,
            average_completion_time,
            total_tasks: total_tasks as u32,
            collaboration_efficiency: successful_tasks / total_tasks * average_quality,
        }
    }
}

/// Collaboration task for agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationTask {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub subtasks: Vec<AgentTask>,
    pub priority: TaskPriority,
    pub deadline: Option<DateTime<Utc>>,
}

/// Individual agent task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTask {
    pub id: Uuid,
    pub task_type: String,
    pub description: String,
    pub requirements: Vec<String>,
    pub expected_output: String,
}

/// Task priority levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// Result of agent task execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTaskResult {
    pub agent_id: Uuid,
    pub task_id: Uuid,
    pub success: bool,
    pub result: String,
    pub completion_time: f32,
    pub quality_score: f32,
}

/// Result of agent collaboration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationResult {
    pub success: bool,
    pub results: Vec<AgentTaskResult>,
    pub collaboration_metrics: CollaborationMetrics,
}

/// Metrics for collaboration performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationMetrics {
    pub success_rate: f32,
    pub average_quality_score: f32,
    pub average_completion_time: f32,
    pub total_tasks: u32,
    pub collaboration_efficiency: f32,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_agent_creation() {
        let agent = BMADAgent::new(
            "Test Agent".to_string(),
            AgentRole::ProductManager,
            vec!["PRD".to_string(), "planning".to_string()]
        );
        
        assert_eq!(agent.name, "Test Agent");
        assert!(matches!(agent.role, AgentRole::ProductManager));
        assert_eq!(agent.expertise.len(), 2);
        assert!(matches!(agent.status, AgentStatus::Available));
    }
    
    #[test]
    fn test_agent_task_capability() {
        let agent = BMADAgent::new(
            "Test Agent".to_string(),
            AgentRole::ProductManager,
            vec!["PRD".to_string()]
        );
        
        assert!(agent.can_handle_task("PRD"));
        assert!(agent.can_handle_task("project_planning"));
        assert!(!agent.can_handle_task("architecture"));
    }
    
    #[tokio::test]
    async fn test_agent_collaboration() {
        let agents = vec![
            BMADAgent::new("PM".to_string(), AgentRole::ProductManager, vec!["PRD".to_string()]),
            BMADAgent::new("Architect".to_string(), AgentRole::Architect, vec!["architecture".to_string()]),
        ];
        
        let mut collaboration = AgentCollaboration::new(agents);
        
        let task = CollaborationTask {
            id: Uuid::new_v4(),
            name: "Test Task".to_string(),
            description: "Test task description".to_string(),
            subtasks: vec![
                AgentTask {
                    id: Uuid::new_v4(),
                    task_type: "PRD".to_string(),
                    description: "Create PRD".to_string(),
                    requirements: vec!["requirements".to_string()],
                    expected_output: "PRD document".to_string(),
                }
            ],
            priority: TaskPriority::Medium,
            deadline: None,
        };
        
        let result = collaboration.coordinate_collaboration(task).await;
        assert!(result.success);
        assert!(!result.results.is_empty());
    }
}
