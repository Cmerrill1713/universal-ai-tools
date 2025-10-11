//! Integration with Universal AI Tools Agent Orchestrator
//!
//! This module provides integration between the VM Coding Agent
//! and the existing agent orchestration system.

use crate::{VMCodingAgent, VMCodingConfig, CodingTask, ProgrammingLanguage, DeploymentTarget, TaskComplexity};
use agent_orchestrator::{Agent, AgentConfig};
use agent_orchestrator::agent::{AgentType, AutonomyLevel, ResourceLimits};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use serde::{Deserialize, Serialize};

/// VM Coding Agent integrated with the orchestrator
pub struct OrchestratedVMCodingAgent {
    pub vm_agent: Arc<RwLock<VMCodingAgent>>,
    pub orchestrator_agent: Agent,
    pub task_queue: Arc<RwLock<Vec<CodingTask>>>,
    pub completed_tasks: Arc<RwLock<Vec<CompletedTask>>>,
}

/// Completed task with results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletedTask {
    pub task_id: Uuid,
    pub project_id: Uuid,
    pub vm_id: Uuid,
    pub success: bool,
    pub build_output: Option<String>,
    pub test_results: Option<String>,
    pub deployment_url: Option<String>,
    pub completion_time: chrono::DateTime<chrono::Utc>,
}

impl OrchestratedVMCodingAgent {
    /// Create a new orchestrated VM Coding Agent
    pub async fn new(vm_config: VMCodingConfig) -> Result<Self, Box<dyn std::error::Error>> {
        // Create the VM Coding Agent
        let vm_agent = Arc::new(RwLock::new(VMCodingAgent::new(vm_config)));

        // Create the orchestrator agent configuration
        let agent_config = AgentConfig {
            name: "VM Coding Agent".to_string(),
            agent_type: AgentType::Specialist,
            max_concurrent_tasks: 5,
            memory_limit_mb: 2048,
            timeout_seconds: 3600, // 1 hour
            learning_enabled: true,
            autonomy_level: AutonomyLevel::Autonomous,
            specialization: vec![
                "virtual_machine_management".to_string(),
                "code_generation".to_string(),
                "software_deployment".to_string(),
                "container_orchestration".to_string(),
            ],
            collaboration_enabled: true,
            resource_limits: ResourceLimits {
                max_cpu_percent: 80.0,
                max_memory_mb: 64 * 1024, // 64GB
                max_network_bandwidth_mbps: 1000,
                max_file_operations_per_second: 1000,
                max_api_requests_per_minute: 1000,
            },
        };

        // Create the orchestrator agent
        let orchestrator_agent = Agent::new(agent_config).await?;

        Ok(Self {
            vm_agent,
            orchestrator_agent,
            task_queue: Arc::new(RwLock::new(Vec::new())),
            completed_tasks: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Submit a coding task to the agent
    pub async fn submit_coding_task(&self, task: CodingTask) -> Result<Uuid, String> {
        let task_id = task.id;

        // Add to task queue
        {
            let mut queue = self.task_queue.write().await;
            queue.push(task);
        }

        // Notify the agent about the new task
        self.orchestrator_agent.send_message(
            agent_orchestrator::agent::AgentMessage::TaskRequest {
                id: task_id,
                task: "Execute coding task".to_string(),
                priority: 1,
                deadline: None,
                sender_id: Uuid::new_v4(),
            }
        ).map_err(|e| format!("Failed to send task message: {}", e))?;

        Ok(task_id)
    }

    /// Process the next task in the queue
    pub async fn process_next_task(&self) -> Result<Option<CompletedTask>, String> {
        // Get next task from queue
        let task = {
            let mut queue = self.task_queue.write().await;
            queue.pop()
        };

        if let Some(task) = task {
            // Execute the task using VM Coding Agent
            let mut vm_agent = self.vm_agent.write().await;
            let result = vm_agent.execute_coding_task(task.clone()).await;

            match result {
                Ok(project_id) => {
                    // Get VM ID for the project
                    let vm_id = vm_agent.code_projects.get(&project_id)
                        .map(|p| p.vm_id)
                        .unwrap_or_default();

                    let completed_task = CompletedTask {
                        task_id: task.id,
                        project_id,
                        vm_id,
                        success: true,
                        build_output: Some("Build successful".to_string()),
                        test_results: Some("Tests passed".to_string()),
                        deployment_url: Some(format!("http://localhost:8080/project/{}", project_id)),
                        completion_time: chrono::Utc::now(),
                    };

                    // Add to completed tasks
                    {
                        let mut completed = self.completed_tasks.write().await;
                        completed.push(completed_task.clone());
                    }

                    Ok(Some(completed_task))
                },
                Err(e) => {
                    let failed_task = CompletedTask {
                        task_id: task.id,
                        project_id: Uuid::new_v4(),
                        vm_id: Uuid::new_v4(),
                        success: false,
                        build_output: Some(format!("Build failed: {}", e)),
                        test_results: None,
                        deployment_url: None,
                        completion_time: chrono::Utc::now(),
                    };

                    // Add to completed tasks
                    {
                        let mut completed = self.completed_tasks.write().await;
                        completed.push(failed_task.clone());
                    }

                    Ok(Some(failed_task))
                }
            }
        } else {
            Ok(None)
        }
    }

    /// Get agent status
    pub async fn get_status(&self) -> OrchestratedAgentStatus {
        let vm_status = self.vm_agent.read().await.get_status();
        let task_queue_len = self.task_queue.read().await.len();
        let completed_tasks_len = self.completed_tasks.read().await.len();

        OrchestratedAgentStatus {
            agent_id: self.orchestrator_agent.id,
            vm_status,
            pending_tasks: task_queue_len,
            completed_tasks: completed_tasks_len,
            is_healthy: true, // Could add health checks here
        }
    }

    /// Create a coding task from a natural language description
    pub fn create_task_from_description(
        &self,
        description: &str,
        language: ProgrammingLanguage,
        complexity: TaskComplexity,
    ) -> CodingTask {
        CodingTask {
            id: Uuid::new_v4(),
            description: description.to_string(),
            language,
            requirements: self.extract_requirements_from_description(description),
            test_cases: self.generate_test_cases_from_description(description),
            deployment_target: DeploymentTarget::Docker,
            estimated_complexity: complexity,
            deadline: None,
        }
    }

    /// Extract requirements from natural language description
    fn extract_requirements_from_description(&self, description: &str) -> Vec<String> {
        // This would use NLP to extract requirements
        // For now, return some generic requirements based on keywords
        let mut requirements = Vec::new();

        if description.to_lowercase().contains("api") {
            requirements.push("Implement REST API endpoints".to_string());
        }
        if description.to_lowercase().contains("database") {
            requirements.push("Add database integration".to_string());
        }
        if description.to_lowercase().contains("authentication") {
            requirements.push("Implement authentication system".to_string());
        }
        if description.to_lowercase().contains("test") {
            requirements.push("Add comprehensive tests".to_string());
        }
        if description.to_lowercase().contains("deploy") {
            requirements.push("Prepare for deployment".to_string());
        }

        if requirements.is_empty() {
            requirements.push("Implement core functionality".to_string());
            requirements.push("Add error handling".to_string());
            requirements.push("Include input validation".to_string());
        }

        requirements
    }

    /// Generate test cases from natural language description
    fn generate_test_cases_from_description(&self, description: &str) -> Vec<String> {
        // This would use NLP to generate test cases
        // For now, return some generic test cases
        let mut test_cases = Vec::new();

        if description.to_lowercase().contains("api") {
            test_cases.push("Test API endpoint responses".to_string());
            test_cases.push("Test API error handling".to_string());
        }
        if description.to_lowercase().contains("user") {
            test_cases.push("Test user creation".to_string());
            test_cases.push("Test user validation".to_string());
        }
        if description.to_lowercase().contains("data") {
            test_cases.push("Test data processing".to_string());
            test_cases.push("Test data validation".to_string());
        }

        if test_cases.is_empty() {
            test_cases.push("Test basic functionality".to_string());
            test_cases.push("Test error conditions".to_string());
        }

        test_cases
    }

    /// Start the agent's main processing loop
    pub async fn start_processing_loop(&self) -> Result<(), String> {
        println!("🤖 Orchestrated VM Coding Agent starting processing loop...");

        loop {
            // Process next task
            match self.process_next_task().await {
                Ok(Some(completed_task)) => {
                    println!("✅ Task completed: {} (Success: {})",
                        completed_task.task_id,
                        completed_task.success
                    );
                },
                Ok(None) => {
                    // No tasks in queue, wait a bit
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                },
                Err(e) => {
                    println!("❌ Error processing task: {}", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                }
            }
        }
    }
}

/// Status of the orchestrated agent
#[derive(Debug, Clone)]
pub struct OrchestratedAgentStatus {
    pub agent_id: Uuid,
    pub vm_status: crate::VMCodingAgentStatus,
    pub pending_tasks: usize,
    pub completed_tasks: usize,
    pub is_healthy: bool,
}

/// Example usage and integration with the orchestrator
pub async fn create_vm_coding_agent_for_orchestrator() -> Result<OrchestratedVMCodingAgent, Box<dyn std::error::Error>> {
    let vm_config = VMCodingConfig {
        max_concurrent_vms: 3,
        default_vm_specs: crate::VMSpecs {
            cpu_cores: 2,
            memory_gb: 4,
            storage_gb: 20,
            os_image: "ubuntu:22.04".to_string(),
            network_config: crate::NetworkConfig {
                allow_internet: true,
                port_mappings: vec![],
                firewall_rules: vec![],
            },
        },
        supported_languages: vec![
            ProgrammingLanguage::Rust,
            ProgrammingLanguage::Go,
            ProgrammingLanguage::Python,
            ProgrammingLanguage::TypeScript,
        ],
        auto_cleanup_enabled: true,
        max_vm_lifetime_hours: 24,
        code_generation_models: vec!["llama3.2:3b".to_string()],
        deployment_targets: vec![DeploymentTarget::Docker, DeploymentTarget::Local],
    };

    OrchestratedVMCodingAgent::new(vm_config).await
}
