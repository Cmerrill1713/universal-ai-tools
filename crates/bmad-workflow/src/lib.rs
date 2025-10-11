//! BMAD (Breakthrough Method for Agile AI-Driven Development) Workflow System
//! 
//! This crate implements the BMAD methodology for Universal AI Tools:
//! - Phase 1: Agentic Planning (Web UI) - AI agents collaborate to create project artifacts
//! - Phase 2: Context-Engineered Development (IDE) - AI agents guide development with context

pub mod planning;
pub mod development;
pub mod artifacts;
pub mod agents;
pub mod workflow;
pub mod context;

pub use planning::{PlanningPhase, PlanningAgent, ProjectArtifact};
pub use development::{DevelopmentPhase, DevelopmentAgent, ContextEngine};
pub use artifacts::{PRDGenerator, ArchitectureGenerator, UXBriefGenerator};
pub use agents::{BMADAgent, AgentCollaboration, AgentRole};
pub use workflow::{BMADWorkflow, WorkflowStep};
pub use context::{ContextPreservation, ContextArtifact, ContextEngineer};

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Main BMAD workflow orchestrator
#[derive(Debug)]
pub struct BMADOrchestrator {
    pub workflow_id: Uuid,
    pub current_phase: BMADPhase,
    pub planning_agents: Vec<PlanningAgent>,
    pub development_agents: Vec<DevelopmentAgent>,
    pub artifacts: Vec<ProjectArtifact>,
    pub context_engine: ContextEngine,
    pub created_at: DateTime<Utc>,
}

/// BMAD workflow phases
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BMADPhase {
    Planning,           // Phase 1: Agentic Planning
    Development,        // Phase 2: Context-Engineered Development
    Completed,
}

/// BMAD workflow configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BMADConfig {
    pub project_name: String,
    pub project_type: ProjectType,
    pub complexity_level: ComplexityLevel,
    pub target_platforms: Vec<String>,
    pub required_artifacts: Vec<ArtifactType>,
    pub collaboration_mode: CollaborationMode,
    pub context_preservation: bool,
}

/// Project types supported by BMAD
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProjectType {
    WebApplication,
    MobileApp,
    DesktopApp,
    ApiService,
    Microservice,
    DataPipeline,
    MLModel,
    DevOpsTool,
    Game,
    Other(String),
}

/// Project complexity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ComplexityLevel {
    Simple,     // Single developer, basic features
    Moderate,   // Small team, multiple features
    Complex,    // Large team, enterprise features
    Enterprise, // Multiple teams, complex architecture
}

/// Collaboration modes for AI agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CollaborationMode {
    Sequential,    // Agents work one after another
    Parallel,      // Agents work simultaneously
    Collaborative, // Agents collaborate and iterate
    Hierarchical,  // Lead agent coordinates others
}

/// Types of project artifacts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ArtifactType {
    PRD,                    // Product Requirements Document
    TechnicalArchitecture,   // System architecture diagrams
    UXBrief,               // User experience brief
    APISpecification,      // API design and documentation
    DatabaseSchema,        // Database design
    DeploymentPlan,        // Infrastructure and deployment
    TestingStrategy,       // Testing approach and plans
    SecurityPlan,          // Security requirements and measures
    PerformancePlan,       // Performance requirements
    DocumentationPlan,     // Documentation strategy
}

impl BMADOrchestrator {
    /// Create a new BMAD workflow
    pub fn new(config: BMADConfig) -> Self {
        Self {
            workflow_id: Uuid::new_v4(),
            current_phase: BMADPhase::Planning,
            planning_agents: Self::initialize_planning_agents(&config),
            development_agents: Self::initialize_development_agents(&config),
            artifacts: Vec::new(),
            context_engine: ContextEngine::new(),
            created_at: Utc::now(),
        }
    }
    
    /// Start the BMAD workflow
    pub async fn start_workflow(&mut self, user_input: UserInput) -> Result<WorkflowStep, BMADError> {
        match self.current_phase {
            BMADPhase::Planning => {
                self.start_planning_phase(user_input).await
            },
            BMADPhase::Development => {
                self.start_development_phase().await
            },
            BMADPhase::Completed => {
                Err(BMADError::WorkflowCompleted)
            }
        }
    }
    
    /// Execute the planning phase with AI agent collaboration
    async fn start_planning_phase(&mut self, user_input: UserInput) -> Result<WorkflowStep, BMADError> {
        tracing::info!("🚀 Starting BMAD Planning Phase for project: {}", user_input.project_name);
        
        // Initialize agent collaboration
        let collaboration = AgentCollaboration::new(self.planning_agents.clone());
        
        // Generate project artifacts through agent collaboration
        let artifacts = collaboration.generate_artifacts(user_input).await?;
        
        // Store artifacts
        self.artifacts.extend(artifacts);
        
        // Transition to development phase
        self.current_phase = BMADPhase::Development;
        
        Ok(WorkflowStep {
            phase: BMADPhase::Development,
            step_name: "Planning Complete".to_string(),
            artifacts_generated: self.artifacts.len(),
            next_actions: vec![
                "Review generated artifacts".to_string(),
                "Begin context-engineered development".to_string(),
                "Set up development environment".to_string(),
            ],
        })
    }
    
    /// Execute the development phase with context engineering
    async fn start_development_phase(&mut self) -> Result<WorkflowStep, BMADError> {
        tracing::info!("🔧 Starting BMAD Development Phase");
        
        // Initialize context engine with artifacts
        self.context_engine.load_artifacts(&self.artifacts);
        
        // Set up development agents
        let dev_collaboration = AgentCollaboration::new(self.development_agents.clone());
        
        // Generate development context
        let context = self.context_engine.generate_development_context().await?;
        
        Ok(WorkflowStep {
            phase: BMADPhase::Development,
            step_name: "Development Context Ready".to_string(),
            artifacts_generated: self.artifacts.len(),
            next_actions: vec![
                "Begin implementation".to_string(),
                "Set up project structure".to_string(),
                "Configure development tools".to_string(),
                "Start coding with AI assistance".to_string(),
            ],
        })
    }
    
    /// Initialize planning agents based on project configuration
    fn initialize_planning_agents(config: &BMADConfig) -> Vec<PlanningAgent> {
        let mut agents = Vec::new();
        
        // Always include core planning agents
        agents.push(PlanningAgent::new(
            "PRD Specialist".to_string(),
            AgentRole::ProductManager,
            vec![ArtifactType::PRD],
        ));
        
        agents.push(PlanningAgent::new(
            "Architecture Expert".to_string(),
            AgentRole::Architect,
            vec![ArtifactType::TechnicalArchitecture, ArtifactType::APISpecification],
        ));
        
        agents.push(PlanningAgent::new(
            "UX Designer".to_string(),
            AgentRole::Designer,
            vec![ArtifactType::UXBrief],
        ));
        
        // Add specialized agents based on project type
        match config.project_type {
            ProjectType::WebApplication => {
                agents.push(PlanningAgent::new(
                    "Frontend Specialist".to_string(),
                    AgentRole::FrontendDeveloper,
                    vec![ArtifactType::UXBrief],
                ));
            },
            ProjectType::ApiService | ProjectType::Microservice => {
                agents.push(PlanningAgent::new(
                    "Backend Specialist".to_string(),
                    AgentRole::BackendDeveloper,
                    vec![ArtifactType::APISpecification, ArtifactType::DatabaseSchema],
                ));
            },
            ProjectType::MLModel => {
                agents.push(PlanningAgent::new(
                    "ML Engineer".to_string(),
                    AgentRole::MLEngineer,
                    vec![ArtifactType::PerformancePlan],
                ));
            },
            _ => {}
        }
        
        // Add complexity-based agents
        match config.complexity_level {
            ComplexityLevel::Complex | ComplexityLevel::Enterprise => {
                agents.push(PlanningAgent::new(
                    "DevOps Engineer".to_string(),
                    AgentRole::DevOpsEngineer,
                    vec![ArtifactType::DeploymentPlan, ArtifactType::SecurityPlan],
                ));
                
                agents.push(PlanningAgent::new(
                    "QA Specialist".to_string(),
                    AgentRole::QAEngineer,
                    vec![ArtifactType::TestingStrategy],
                ));
            },
            _ => {}
        }
        
        agents
    }
    
    /// Initialize development agents based on project configuration
    fn initialize_development_agents(config: &BMADConfig) -> Vec<DevelopmentAgent> {
        let mut agents = Vec::new();
        
        // Core development agents
        agents.push(DevelopmentAgent::new(
            "Code Generator".to_string(),
            AgentRole::Developer,
            vec!["code_generation".to_string(), "implementation".to_string()],
        ));
        
        agents.push(DevelopmentAgent::new(
            "Code Reviewer".to_string(),
            AgentRole::CodeReviewer,
            vec!["code_review".to_string(), "quality_assurance".to_string()],
        ));
        
        agents.push(DevelopmentAgent::new(
            "Test Generator".to_string(),
            AgentRole::QAEngineer,
            vec!["test_generation".to_string(), "testing".to_string()],
        ));
        
        // Add specialized development agents
        match config.project_type {
            ProjectType::WebApplication => {
                agents.push(DevelopmentAgent::new(
                    "Frontend Developer".to_string(),
                    AgentRole::FrontendDeveloper,
                    vec!["frontend".to_string(), "ui".to_string(), "react".to_string()],
                ));
            },
            ProjectType::ApiService | ProjectType::Microservice => {
                agents.push(DevelopmentAgent::new(
                    "Backend Developer".to_string(),
                    AgentRole::BackendDeveloper,
                    vec!["backend".to_string(), "api".to_string(), "database".to_string()],
                ));
            },
            _ => {}
        }
        
        agents
    }
}

/// User input for BMAD workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInput {
    pub project_name: String,
    pub project_description: String,
    pub target_users: Vec<String>,
    pub key_features: Vec<String>,
    pub constraints: Vec<String>,
    pub success_metrics: Vec<String>,
    pub timeline: Option<String>,
    pub budget: Option<String>,
    pub technical_preferences: Vec<String>,
}

/// BMAD workflow step result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub phase: BMADPhase,
    pub step_name: String,
    pub artifacts_generated: usize,
    pub next_actions: Vec<String>,
}

/// BMAD workflow errors
#[derive(Debug, thiserror::Error)]
pub enum BMADError {
    #[error("Workflow already completed")]
    WorkflowCompleted,
    #[error("Agent collaboration failed: {0}")]
    AgentCollaborationFailed(String),
    #[error("Context generation failed: {0}")]
    ContextGenerationFailed(String),
    #[error("Artifact generation failed: {0}")]
    ArtifactGenerationFailed(String),
    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bmad_orchestrator_creation() {
        let config = BMADConfig {
            project_name: "Test Project".to_string(),
            project_type: ProjectType::WebApplication,
            complexity_level: ComplexityLevel::Moderate,
            target_platforms: vec!["web".to_string()],
            required_artifacts: vec![ArtifactType::PRD, ArtifactType::TechnicalArchitecture],
            collaboration_mode: CollaborationMode::Collaborative,
            context_preservation: true,
        };
        
        let orchestrator = BMADOrchestrator::new(config);
        assert_eq!(orchestrator.current_phase, BMADPhase::Planning);
        assert!(!orchestrator.planning_agents.is_empty());
        assert!(!orchestrator.development_agents.is_empty());
    }
}
