//! BMAD Workflow Management - Workflow state and step management
//! 
//! This module provides workflow state management, step tracking, and
//! workflow orchestration for BMAD processes.

use crate::{BMADPhase, BMADConfig, UserInput, ProjectArtifact};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// BMAD Workflow state management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BMADWorkflow {
    pub id: Uuid,
    pub name: String,
    pub config: BMADConfig,
    pub user_input: UserInput,
    pub current_phase: BMADPhase,
    pub current_step: WorkflowStep,
    pub artifacts: Vec<ProjectArtifact>,
    pub workflow_history: Vec<WorkflowStep>,
    pub status: WorkflowStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Workflow step tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub phase: BMADPhase,
    pub step_type: StepType,
    pub status: StepStatus,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub duration_seconds: Option<u64>,
    pub artifacts_created: Vec<Uuid>,
    pub agents_involved: Vec<Uuid>,
    pub progress_percentage: u8,
    pub notes: Vec<String>,
    pub errors: Vec<WorkflowError>,
}

/// Types of workflow steps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepType {
    Planning,
    ArtifactGeneration,
    AgentCollaboration,
    Review,
    Development,
    Testing,
    Deployment,
    Documentation,
}

/// Status of workflow steps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Skipped,
    Blocked,
}

/// Overall workflow status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowStatus {
    Created,
    Active,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// Workflow error tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowError {
    pub id: Uuid,
    pub error_type: ErrorType,
    pub message: String,
    pub step_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub severity: ErrorSeverity,
    pub resolved: bool,
    pub resolution: Option<String>,
}

/// Types of workflow errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorType {
    AgentError,
    ArtifactError,
    ConfigurationError,
    ValidationError,
    TimeoutError,
    ResourceError,
    NetworkError,
    Unknown,
}

/// Error severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Workflow metrics and analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowMetrics {
    pub total_duration_seconds: u64,
    pub planning_phase_duration: u64,
    pub development_phase_duration: u64,
    pub artifacts_generated: u32,
    pub agents_used: u32,
    pub success_rate: f32,
    pub average_step_duration: f32,
    pub error_count: u32,
    pub quality_score: f32,
}

impl BMADWorkflow {
    /// Create a new BMAD workflow
    pub fn new(name: String, config: BMADConfig, user_input: UserInput) -> Self {
        let initial_step = WorkflowStep {
            id: Uuid::new_v4(),
            name: "Workflow Initialization".to_string(),
            description: "Initialize BMAD workflow".to_string(),
            phase: BMADPhase::Planning,
            step_type: StepType::Planning,
            status: StepStatus::Completed,
            start_time: Some(Utc::now()),
            end_time: Some(Utc::now()),
            duration_seconds: Some(0),
            artifacts_created: vec![],
            agents_involved: vec![],
            progress_percentage: 100,
            notes: vec!["Workflow created successfully".to_string()],
            errors: vec![],
        };

        Self {
            id: Uuid::new_v4(),
            name,
            config,
            user_input,
            current_phase: BMADPhase::Planning,
            current_step: initial_step.clone(),
            artifacts: vec![],
            workflow_history: vec![initial_step],
            status: WorkflowStatus::Created,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            completed_at: None,
        }
    }
    
    /// Start the workflow
    pub fn start(&mut self) -> Result<(), WorkflowError> {
        if self.status != WorkflowStatus::Created {
            return Err(WorkflowError {
                id: Uuid::new_v4(),
                error_type: ErrorType::ValidationError,
                message: "Workflow can only be started from Created status".to_string(),
                step_id: self.current_step.id,
                timestamp: Utc::now(),
                severity: ErrorSeverity::Medium,
                resolved: false,
                resolution: None,
            });
        }
        
        self.status = WorkflowStatus::Active;
        self.updated_at = Utc::now();
        
        // Create initial planning step
        let planning_step = WorkflowStep {
            id: Uuid::new_v4(),
            name: "Planning Phase Start".to_string(),
            description: "Begin BMAD planning phase".to_string(),
            phase: BMADPhase::Planning,
            step_type: StepType::Planning,
            status: StepStatus::InProgress,
            start_time: Some(Utc::now()),
            end_time: None,
            duration_seconds: None,
            artifacts_created: vec![],
            agents_involved: vec![],
            progress_percentage: 0,
            notes: vec!["Planning phase initiated".to_string()],
            errors: vec![],
        };
        
        self.current_step = planning_step.clone();
        self.workflow_history.push(planning_step);
        
        Ok(())
    }
    
    /// Advance to next step
    pub fn advance_to_next_step(&mut self, step_name: String, step_type: StepType) -> Result<WorkflowStep, WorkflowError> {
        // Complete current step
        self.complete_current_step()?;
        
        // Create new step
        let new_step = WorkflowStep {
            id: Uuid::new_v4(),
            name: step_name,
            description: format!("Executing {}", step_type),
            phase: self.current_phase.clone(),
            step_type,
            status: StepStatus::InProgress,
            start_time: Some(Utc::now()),
            end_time: None,
            duration_seconds: None,
            artifacts_created: vec![],
            agents_involved: vec![],
            progress_percentage: 0,
            notes: vec![],
            errors: vec![],
        };
        
        self.current_step = new_step.clone();
        self.workflow_history.push(new_step.clone());
        self.updated_at = Utc::now();
        
        Ok(new_step)
    }
    
    /// Complete current step
    pub fn complete_current_step(&mut self) -> Result<(), WorkflowError> {
        if self.current_step.status != StepStatus::InProgress {
            return Err(WorkflowError {
                id: Uuid::new_v4(),
                error_type: ErrorType::ValidationError,
                message: "Can only complete steps that are in progress".to_string(),
                step_id: self.current_step.id,
                timestamp: Utc::now(),
                severity: ErrorSeverity::Medium,
                resolved: false,
                resolution: None,
            });
        }
        
        self.current_step.status = StepStatus::Completed;
        self.current_step.end_time = Some(Utc::now());
        
        if let (Some(start), Some(end)) = (self.current_step.start_time, self.current_step.end_time) {
            self.current_step.duration_seconds = Some((end - start).num_seconds() as u64);
        }
        
        self.current_step.progress_percentage = 100;
        self.updated_at = Utc::now();
        
        Ok(())
    }
    
    /// Add artifact to workflow
    pub fn add_artifact(&mut self, artifact: ProjectArtifact) {
        self.artifacts.push(artifact.clone());
        self.current_step.artifacts_created.push(artifact.id);
        self.updated_at = Utc::now();
    }
    
    /// Add agent to current step
    pub fn add_agent_to_step(&mut self, agent_id: Uuid) {
        if !self.current_step.agents_involved.contains(&agent_id) {
            self.current_step.agents_involved.push(agent_id);
            self.updated_at = Utc::now();
        }
    }
    
    /// Add note to current step
    pub fn add_note(&mut self, note: String) {
        self.current_step.notes.push(note);
        self.updated_at = Utc::now();
    }
    
    /// Add error to workflow
    pub fn add_error(&mut self, error: WorkflowError) {
        self.current_step.errors.push(error.clone());
        self.updated_at = Utc::now();
        
        // Update workflow status based on error severity
        match error.severity {
            ErrorSeverity::Critical => {
                self.status = WorkflowStatus::Failed;
            },
            ErrorSeverity::High => {
                if self.status == WorkflowStatus::Active {
                    self.status = WorkflowStatus::Paused;
                }
            },
            _ => {}
        }
    }
    
    /// Resolve error
    pub fn resolve_error(&mut self, error_id: Uuid, resolution: String) -> Result<(), WorkflowError> {
        if let Some(error) = self.current_step.errors.iter_mut().find(|e| e.id == error_id) {
            error.resolved = true;
            error.resolution = Some(resolution);
            self.updated_at = Utc::now();
            Ok(())
        } else {
            Err(WorkflowError {
                id: Uuid::new_v4(),
                error_type: ErrorType::ValidationError,
                message: "Error not found".to_string(),
                step_id: self.current_step.id,
                timestamp: Utc::now(),
                severity: ErrorSeverity::Medium,
                resolved: false,
                resolution: None,
            })
        }
    }
    
    /// Update step progress
    pub fn update_step_progress(&mut self, progress_percentage: u8) {
        self.current_step.progress_percentage = progress_percentage.min(100);
        self.updated_at = Utc::now();
    }
    
    /// Transition to next phase
    pub fn transition_to_phase(&mut self, new_phase: BMADPhase) -> Result<(), WorkflowError> {
        // Complete current step
        self.complete_current_step()?;
        
        // Update phase
        self.current_phase = new_phase.clone();
        
        // Create phase transition step
        let transition_step = WorkflowStep {
            id: Uuid::new_v4(),
            name: format!("Transition to {:?} Phase", new_phase),
            description: format!("Moving from {:?} to {:?}", self.current_phase, new_phase),
            phase: new_phase,
            step_type: StepType::Planning, // Default, will be updated based on phase
            status: StepStatus::Completed,
            start_time: Some(Utc::now()),
            end_time: Some(Utc::now()),
            duration_seconds: Some(0),
            artifacts_created: vec![],
            agents_involved: vec![],
            progress_percentage: 100,
            notes: vec![format!("Successfully transitioned to {:?} phase", new_phase)],
            errors: vec![],
        };
        
        self.current_step = transition_step.clone();
        self.workflow_history.push(transition_step);
        self.updated_at = Utc::now();
        
        Ok(())
    }
    
    /// Complete workflow
    pub fn complete(&mut self) -> Result<(), WorkflowError> {
        if self.status != WorkflowStatus::Active {
            return Err(WorkflowError {
                id: Uuid::new_v4(),
                error_type: ErrorType::ValidationError,
                message: "Workflow can only be completed from Active status".to_string(),
                step_id: self.current_step.id,
                timestamp: Utc::now(),
                severity: ErrorSeverity::Medium,
                resolved: false,
                resolution: None,
            });
        }
        
        // Complete current step
        self.complete_current_step()?;
        
        // Update status
        self.status = WorkflowStatus::Completed;
        self.current_phase = BMADPhase::Completed;
        self.completed_at = Some(Utc::now());
        self.updated_at = Utc::now();
        
        // Create completion step
        let completion_step = WorkflowStep {
            id: Uuid::new_v4(),
            name: "Workflow Completion".to_string(),
            description: "BMAD workflow completed successfully".to_string(),
            phase: BMADPhase::Completed,
            step_type: StepType::Planning, // Default
            status: StepStatus::Completed,
            start_time: Some(Utc::now()),
            end_time: Some(Utc::now()),
            duration_seconds: Some(0),
            artifacts_created: vec![],
            agents_involved: vec![],
            progress_percentage: 100,
            notes: vec![format!("Workflow completed with {} artifacts", self.artifacts.len())],
            errors: vec![],
        };
        
        self.current_step = completion_step.clone();
        self.workflow_history.push(completion_step);
        
        Ok(())
    }
    
    /// Get workflow metrics
    pub fn get_metrics(&self) -> WorkflowMetrics {
        let total_duration = if let Some(completed_at) = self.completed_at {
            (completed_at - self.created_at).num_seconds() as u64
        } else {
            (Utc::now() - self.created_at).num_seconds() as u64
        };
        
        let planning_duration = self.workflow_history
            .iter()
            .filter(|step| matches!(step.phase, BMADPhase::Planning))
            .map(|step| step.duration_seconds.unwrap_or(0))
            .sum();
        
        let development_duration = self.workflow_history
            .iter()
            .filter(|step| matches!(step.phase, BMADPhase::Development))
            .map(|step| step.duration_seconds.unwrap_or(0))
            .sum();
        
        let completed_steps = self.workflow_history
            .iter()
            .filter(|step| matches!(step.status, StepStatus::Completed))
            .count();
        
        let total_steps = self.workflow_history.len();
        let success_rate = if total_steps > 0 {
            completed_steps as f32 / total_steps as f32
        } else {
            0.0
        };
        
        let average_step_duration = if total_steps > 0 {
            self.workflow_history
                .iter()
                .map(|step| step.duration_seconds.unwrap_or(0) as f32)
                .sum::<f32>() / total_steps as f32
        } else {
            0.0
        };
        
        let error_count = self.workflow_history
            .iter()
            .map(|step| step.errors.len())
            .sum::<usize>() as u32;
        
        let quality_score = self.calculate_quality_score();
        
        WorkflowMetrics {
            total_duration_seconds: total_duration,
            planning_phase_duration: planning_duration,
            development_phase_duration: development_duration,
            artifacts_generated: self.artifacts.len() as u32,
            agents_used: self.workflow_history
                .iter()
                .flat_map(|step| &step.agents_involved)
                .collect::<std::collections::HashSet<_>>()
                .len() as u32,
            success_rate,
            average_step_duration,
            error_count,
            quality_score,
        }
    }
    
    /// Calculate workflow quality score
    fn calculate_quality_score(&self) -> f32 {
        let mut score = 1.0;
        
        // Reduce score for errors
        let error_count = self.workflow_history
            .iter()
            .map(|step| step.errors.len())
            .sum::<usize>() as f32;
        
        score -= error_count * 0.1;
        
        // Reduce score for failed steps
        let failed_steps = self.workflow_history
            .iter()
            .filter(|step| matches!(step.status, StepStatus::Failed))
            .count() as f32;
        
        score -= failed_steps * 0.2;
        
        // Increase score for completed artifacts
        let artifact_score = (self.artifacts.len() as f32 * 0.05).min(0.3);
        score += artifact_score;
        
        score.max(0.0).min(1.0)
    }
    
    /// Get workflow summary
    pub fn get_summary(&self) -> WorkflowSummary {
        WorkflowSummary {
            id: self.id,
            name: self.name.clone(),
            status: self.status.clone(),
            current_phase: self.current_phase.clone(),
            current_step: self.current_step.name.clone(),
            progress_percentage: self.current_step.progress_percentage,
            artifacts_count: self.artifacts.len(),
            total_steps: self.workflow_history.len(),
            completed_steps: self.workflow_history
                .iter()
                .filter(|step| matches!(step.status, StepStatus::Completed))
                .count(),
            error_count: self.workflow_history
                .iter()
                .map(|step| step.errors.len())
                .sum(),
            created_at: self.created_at,
            updated_at: self.updated_at,
            completed_at: self.completed_at,
        }
    }
}

/// Workflow summary for quick overview
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowSummary {
    pub id: Uuid,
    pub name: String,
    pub status: WorkflowStatus,
    pub current_phase: BMADPhase,
    pub current_step: String,
    pub progress_percentage: u8,
    pub artifacts_count: usize,
    pub total_steps: usize,
    pub completed_steps: usize,
    pub error_count: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_workflow_creation() {
        let config = BMADConfig {
            project_name: "Test Project".to_string(),
            project_type: crate::ProjectType::WebApplication,
            complexity_level: crate::ComplexityLevel::Moderate,
            target_platforms: vec!["web".to_string()],
            required_artifacts: vec![crate::ArtifactType::PRD],
            collaboration_mode: crate::CollaborationMode::Collaborative,
            context_preservation: true,
        };
        
        let user_input = UserInput {
            project_name: "Test Project".to_string(),
            project_description: "Test description".to_string(),
            target_users: vec!["developers".to_string()],
            key_features: vec!["feature1".to_string()],
            constraints: vec!["constraint1".to_string()],
            success_metrics: vec!["metric1".to_string()],
            timeline: Some("1 month".to_string()),
            budget: Some("$10k".to_string()),
            technical_preferences: vec!["TypeScript".to_string()],
        };
        
        let workflow = BMADWorkflow::new("Test Workflow".to_string(), config, user_input);
        
        assert_eq!(workflow.name, "Test Workflow");
        assert!(matches!(workflow.status, WorkflowStatus::Created));
        assert!(matches!(workflow.current_phase, BMADPhase::Planning));
    }
    
    #[test]
    fn test_workflow_start() {
        let config = BMADConfig {
            project_name: "Test Project".to_string(),
            project_type: crate::ProjectType::WebApplication,
            complexity_level: crate::ComplexityLevel::Moderate,
            target_platforms: vec!["web".to_string()],
            required_artifacts: vec![crate::ArtifactType::PRD],
            collaboration_mode: crate::CollaborationMode::Collaborative,
            context_preservation: true,
        };
        
        let user_input = UserInput {
            project_name: "Test Project".to_string(),
            project_description: "Test description".to_string(),
            target_users: vec!["developers".to_string()],
            key_features: vec!["feature1".to_string()],
            constraints: vec!["constraint1".to_string()],
            success_metrics: vec!["metric1".to_string()],
            timeline: Some("1 month".to_string()),
            budget: Some("$10k".to_string()),
            technical_preferences: vec!["TypeScript".to_string()],
        };
        
        let mut workflow = BMADWorkflow::new("Test Workflow".to_string(), config, user_input);
        
        let result = workflow.start();
        assert!(result.is_ok());
        assert!(matches!(workflow.status, WorkflowStatus::Active));
    }
    
    #[test]
    fn test_workflow_metrics() {
        let config = BMADConfig {
            project_name: "Test Project".to_string(),
            project_type: crate::ProjectType::WebApplication,
            complexity_level: crate::ComplexityLevel::Moderate,
            target_platforms: vec!["web".to_string()],
            required_artifacts: vec![crate::ArtifactType::PRD],
            collaboration_mode: crate::CollaborationMode::Collaborative,
            context_preservation: true,
        };
        
        let user_input = UserInput {
            project_name: "Test Project".to_string(),
            project_description: "Test description".to_string(),
            target_users: vec!["developers".to_string()],
            key_features: vec!["feature1".to_string()],
            constraints: vec!["constraint1".to_string()],
            success_metrics: vec!["metric1".to_string()],
            timeline: Some("1 month".to_string()),
            budget: Some("$10k".to_string()),
            technical_preferences: vec!["TypeScript".to_string()],
        };
        
        let workflow = BMADWorkflow::new("Test Workflow".to_string(), config, user_input);
        let metrics = workflow.get_metrics();
        
        assert_eq!(metrics.artifacts_generated, 0);
        assert_eq!(metrics.error_count, 0);
        assert!(metrics.success_rate >= 0.0 && metrics.success_rate <= 1.0);
    }
}
