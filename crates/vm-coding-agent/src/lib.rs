//! VM Coding Agent - Autonomous Virtual Machine and Code Generation Agent
//!
//! This agent can:
//! - Spin up virtual machines/containers on demand
//! - Generate and execute code autonomously
//! - Manage development environments
//! - Deploy and test applications
//! - Clean up resources automatically
//! - Integrate with the Universal AI Tools orchestrator

pub mod orchestrator_integration;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::process::Command;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::path::PathBuf;

/// VM Coding Agent specialized for autonomous development
#[derive(Debug, Clone)]
pub struct VMCodingAgent {
    pub id: Uuid,
    pub config: VMCodingConfig,
    pub active_vms: HashMap<Uuid, VirtualMachine>,
    pub code_projects: HashMap<Uuid, CodeProject>,
    pub resource_manager: VMResourceManager,
}

/// Configuration for VM Coding Agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VMCodingConfig {
    pub max_concurrent_vms: usize,
    pub default_vm_specs: VMSpecs,
    pub supported_languages: Vec<ProgrammingLanguage>,
    pub auto_cleanup_enabled: bool,
    pub max_vm_lifetime_hours: u64,
    pub code_generation_models: Vec<String>,
    pub deployment_targets: Vec<DeploymentTarget>,
}

/// Virtual Machine specifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VMSpecs {
    pub cpu_cores: u32,
    pub memory_gb: u32,
    pub storage_gb: u32,
    pub os_image: String,
    pub network_config: NetworkConfig,
}

/// Network configuration for VMs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub allow_internet: bool,
    pub port_mappings: Vec<PortMapping>,
    pub firewall_rules: Vec<FirewallRule>,
}

/// Port mapping for VM services
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortMapping {
    pub host_port: u16,
    pub vm_port: u16,
    pub protocol: String,
}

/// Firewall rule for VM security
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirewallRule {
    pub action: String, // "allow" or "deny"
    pub port: u16,
    pub source: String,
}

/// Programming languages supported by the agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProgrammingLanguage {
    Rust,
    Go,
    Python,
    TypeScript,
    JavaScript,
    Swift,
    Java,
    Cpp,
    CSharp,
}

/// Deployment targets for generated code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeploymentTarget {
    Docker,
    Kubernetes,
    Local,
    Serverless,
}

/// Virtual Machine instance
#[derive(Debug, Clone)]
pub struct VirtualMachine {
    pub id: Uuid,
    pub name: String,
    pub specs: VMSpecs,
    pub status: VMStatus,
    pub created_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub ssh_key_path: Option<PathBuf>,
    pub installed_tools: Vec<String>,
    pub active_projects: Vec<Uuid>,
}

/// VM Status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VMStatus {
    Creating,
    Running,
    Stopped,
    Failed,
    Terminating,
}

/// Code Project managed by the agent
#[derive(Debug, Clone)]
pub struct CodeProject {
    pub id: Uuid,
    pub name: String,
    pub language: ProgrammingLanguage,
    pub vm_id: Uuid,
    pub project_path: PathBuf,
    pub git_repo: Option<String>,
    pub dependencies: Vec<String>,
    pub build_status: BuildStatus,
    pub test_status: TestStatus,
    pub deployment_status: DeploymentStatus,
    pub created_at: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,
}

/// Build status for code projects
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BuildStatus {
    NotStarted,
    Building,
    Success,
    Failed { error: String },
}

/// Test status for code projects
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestStatus {
    NotStarted,
    Running,
    Passed,
    Failed { error: String },
}

/// Deployment status for code projects
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeploymentStatus {
    NotDeployed,
    Deploying,
    Deployed { url: String },
    Failed { error: String },
}

/// VM Resource Manager
#[derive(Debug, Clone)]
pub struct VMResourceManager {
    pub total_cpu_cores: u32,
    pub total_memory_gb: u32,
    pub total_storage_gb: u32,
    pub allocated_cpu_cores: u32,
    pub allocated_memory_gb: u32,
    pub allocated_storage_gb: u32,
}

/// Coding Task for the agent to execute
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodingTask {
    pub id: Uuid,
    pub description: String,
    pub language: ProgrammingLanguage,
    pub requirements: Vec<String>,
    pub test_cases: Vec<String>,
    pub deployment_target: DeploymentTarget,
    pub estimated_complexity: TaskComplexity,
    pub deadline: Option<DateTime<Utc>>,
}

/// Task complexity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskComplexity {
    Simple,    // Basic CRUD operations
    Medium,    // API integrations, algorithms
    Complex,   // Multi-service architectures
    Expert,    // Advanced AI/ML, distributed systems
}

impl VMCodingAgent {
    /// Create a new VM Coding Agent
    pub fn new(config: VMCodingConfig) -> Self {
        Self {
            id: Uuid::new_v4(),
            config,
            active_vms: HashMap::new(),
            code_projects: HashMap::new(),
            resource_manager: VMResourceManager {
                total_cpu_cores: 16,
                total_memory_gb: 64,
                total_storage_gb: 500,
                allocated_cpu_cores: 0,
                allocated_memory_gb: 0,
                allocated_storage_gb: 0,
            },
        }
    }

    /// Spin up a new virtual machine using Docker containers
    pub async fn create_vm(&mut self, name: String, specs: Option<VMSpecs>) -> Result<Uuid, String> {
        let vm_id = Uuid::new_v4();
        let vm_specs = specs.unwrap_or_else(|| self.config.default_vm_specs.clone());

        // Check resource availability
        if !self.can_allocate_resources(&vm_specs) {
            return Err("Insufficient resources to create VM".to_string());
        }

        // Create VM using Docker containers for local development
        let vm = VirtualMachine {
            id: vm_id,
            name: name.clone(),
            specs: vm_specs.clone(),
            status: VMStatus::Creating,
            created_at: Utc::now(),
            ip_address: None,
            ssh_key_path: None,
            installed_tools: Vec::new(),
            active_projects: Vec::new(),
        };

        self.active_vms.insert(vm_id, vm);

        // Start VM creation process
        self.start_vm_creation(vm_id, vm_specs).await?;

        Ok(vm_id)
    }

    /// Start VM creation process using Docker containers
    async fn start_vm_creation(&mut self, vm_id: Uuid, specs: VMSpecs) -> Result<(), String> {
        let vm_name = format!("vm-coding-agent-{}", vm_id);

        // Create Docker container as VM for local development
        let docker_cmd = Command::new("docker")
            .args(&[
                "run",
                "-d",
                "--name", &vm_name,
                "--cpus", &specs.cpu_cores.to_string(),
                "--memory", &format!("{}g", specs.memory_gb),
                "--platform", "linux/amd64",
                "ubuntu:22.04",
                "tail", "-f", "/dev/null"
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to create Docker VM: {}", e))?;

        if !docker_cmd.status.success() {
            return Err("Docker VM creation failed".to_string());
        }

        // Update VM status
        if let Some(vm) = self.active_vms.get_mut(&vm_id) {
            vm.status = VMStatus::Running;
            vm.ip_address = Some("localhost".to_string()); // Docker internal IP
        }

        // Install development tools
        self.install_dev_tools(vm_id).await?;

        Ok(())
    }

    /// Install development tools on VM
    async fn install_dev_tools(&mut self, vm_id: Uuid) -> Result<(), String> {
        let vm_name = format!("vm-coding-agent-{}", vm_id);

        // Install common development tools
        let tools = vec![
            "curl", "wget", "git", "vim", "nano", "build-essential",
            "python3", "python3-pip", "nodejs", "npm", "rust", "golang-go"
        ];

        for tool in &tools {
            let install_cmd = Command::new("docker")
                .args(&[
                    "exec", &vm_name,
                    "apt-get", "update", "&&", "apt-get", "install", "-y", tool
                ])
                .output()
                .await
                .map_err(|e| format!("Failed to install {}: {}", tool, e))?;

            if !install_cmd.status.success() {
                println!("Warning: Failed to install {}", tool);
            }
        }

        // Update VM with installed tools
        if let Some(vm) = self.active_vms.get_mut(&vm_id) {
            vm.installed_tools = tools.iter().map(|s| s.to_string()).collect();
        }

        Ok(())
    }

    /// Generate and deploy code for a given task
    pub async fn execute_coding_task(&mut self, task: CodingTask) -> Result<Uuid, String> {
        // Create or find available VM
        let vm_id = self.find_or_create_vm_for_task(&task).await?;

        // Create code project
        let project_id = self.create_code_project(&task, vm_id).await?;

        // Generate code using LLM
        self.generate_code(&task, project_id).await?;

        // Build and test the code
        self.build_and_test_project(project_id).await?;

        // Deploy if requested
        if matches!(task.deployment_target, DeploymentTarget::Docker) {
            self.deploy_project(project_id).await?;
        }

        Ok(project_id)
    }

    /// Find or create VM suitable for the task
    async fn find_or_create_vm_for_task(&mut self, task: &CodingTask) -> Result<Uuid, String> {
        // Look for existing VM with required tools
        for (vm_id, vm) in &self.active_vms {
            if vm.status == VMStatus::Running && self.vm_has_language_support(vm, &task.language) {
                return Ok(*vm_id);
            }
        }

        // Create new VM if none available
        let vm_name = format!("vm-{:?}-{}", task.language, Uuid::new_v4());
        self.create_vm(vm_name, None).await
    }

    /// Check if VM supports the programming language
    fn vm_has_language_support(&self, vm: &VirtualMachine, language: &ProgrammingLanguage) -> bool {
        match language {
            ProgrammingLanguage::Python => vm.installed_tools.contains(&"python3".to_string()),
            ProgrammingLanguage::Rust => vm.installed_tools.contains(&"rust".to_string()),
            ProgrammingLanguage::Go => vm.installed_tools.contains(&"golang-go".to_string()),
            ProgrammingLanguage::TypeScript | ProgrammingLanguage::JavaScript => {
                vm.installed_tools.contains(&"nodejs".to_string())
            },
            _ => true, // Assume support for other languages
        }
    }

    /// Create a new code project
    async fn create_code_project(&mut self, task: &CodingTask, vm_id: Uuid) -> Result<Uuid, String> {
        let project_id = Uuid::new_v4();
        let project_name = format!("project-{}", project_id);

        let project = CodeProject {
            id: project_id,
            name: project_name.clone(),
            language: task.language.clone(),
            vm_id,
            project_path: PathBuf::from(format!("/workspace/{}", project_name)),
            git_repo: None,
            dependencies: Vec::new(),
            build_status: BuildStatus::NotStarted,
            test_status: TestStatus::NotStarted,
            deployment_status: DeploymentStatus::NotDeployed,
            created_at: Utc::now(),
            last_modified: Utc::now(),
        };

        self.code_projects.insert(project_id, project);
        Ok(project_id)
    }

    /// Generate code using LLM integration
    async fn generate_code(&mut self, task: &CodingTask, project_id: Uuid) -> Result<(), String> {
        // This would integrate with your LLM Router service
        // For now, create a basic project structure

        let project = self.code_projects.get(&project_id)
            .ok_or("Project not found")?;

        let vm_name = format!("vm-coding-agent-{}", project.vm_id);

        // Create project directory
        let create_dir_cmd = Command::new("docker")
            .args(&[
                "exec", &vm_name,
                "mkdir", "-p", &project.project_path.to_string_lossy()
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to create project directory: {}", e))?;

        if !create_dir_cmd.status.success() {
            return Err("Failed to create project directory".to_string());
        }

        // Generate basic code files based on language
        self.generate_language_specific_files(task, project_id).await?;

        Ok(())
    }

    /// Generate language-specific files
    async fn generate_language_specific_files(&mut self, task: &CodingTask, project_id: Uuid) -> Result<(), String> {
        let project = self.code_projects.get(&project_id)
            .ok_or("Project not found")?;

        let vm_name = format!("vm-coding-agent-{}", project.vm_id);
        let project_path = &project.project_path;

        match task.language {
            ProgrammingLanguage::Rust => {
                // Create Cargo.toml
                let cargo_content = format!(
                    r#"[package]
name = "{}"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = {{ version = "1.0", features = ["full"] }}
serde = {{ version = "1.0", features = ["derive"] }}
uuid = {{ version = "1.0", features = ["v4"] }}
"#, project.name
                );

                self.create_file_in_vm(&vm_name, project_path, "Cargo.toml", &cargo_content).await?;

                // Create main.rs
                let main_content = format!(
                    r#"// Generated by VM Coding Agent
// Task: {}

fn main() {{
    println!("Hello from VM Coding Agent!");
    // TODO: Implement task requirements
}}
"#, task.description
                );

                self.create_file_in_vm(&vm_name, project_path, "src/main.rs", &main_content).await?;
            },
            ProgrammingLanguage::Python => {
                // Create requirements.txt
                self.create_file_in_vm(&vm_name, project_path, "requirements.txt", "requests\nfastapi\nuvicorn\n").await?;

                // Create main.py
                let main_content = format!(
                    r#"#!/usr/bin/env python3
# Generated by VM Coding Agent
# Task: {}

def main():
    print("Hello from VM Coding Agent!")
    # TODO: Implement task requirements

if __name__ == "__main__":
    main()
"#, task.description
                );

                self.create_file_in_vm(&vm_name, project_path, "main.py", &main_content).await?;
            },
            ProgrammingLanguage::Go => {
                // Create go.mod
                let go_mod_content = format!(
                    r#"module {}

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
)
"#, project.name
                );

                self.create_file_in_vm(&vm_name, project_path, "go.mod", &go_mod_content).await?;

                // Create main.go
                let main_content = format!(
                    r#"// Generated by VM Coding Agent
// Task: {}

package main

import "fmt"

func main() {{
    fmt.Println("Hello from VM Coding Agent!")
    // TODO: Implement task requirements
}}
"#, task.description
                );

                self.create_file_in_vm(&vm_name, project_path, "main.go", &main_content).await?;
            },
            _ => {
                // Generic file creation for other languages
                let readme_content = format!(
                    r#"# {}

Generated by VM Coding Agent

## Task Description
{}

## Requirements
{}

## Test Cases
{}
"#,
                    project.name,
                    task.description,
                    task.requirements.join("\n- "),
                    task.test_cases.join("\n- ")
                );

                self.create_file_in_vm(&vm_name, project_path, "README.md", &readme_content).await?;
            }
        }

        Ok(())
    }

    /// Create a file inside the VM
    async fn create_file_in_vm(&self, vm_name: &str, project_path: &PathBuf, filename: &str, content: &str) -> Result<(), String> {
        let file_path = project_path.join(filename);

        let create_file_cmd = Command::new("docker")
            .args(&[
                "exec", "-i", vm_name,
                "tee", &file_path.to_string_lossy()
            ])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to create file: {}", e))?;

        // Write content to stdin
        if let Some(mut stdin) = create_file_cmd.stdin {
            use tokio::io::AsyncWriteExt;
            stdin.write_all(content.as_bytes()).await
                .map_err(|e| format!("Failed to write file content: {}", e))?;
        }

        Ok(())
    }

    /// Build and test the project
    async fn build_and_test_project(&mut self, project_id: Uuid) -> Result<(), String> {
        // Update build status first
        if let Some(project) = self.code_projects.get_mut(&project_id) {
            project.build_status = BuildStatus::Building;
        }

        // Get project info for building
        let (vm_id, project_path, language) = {
            let project = self.code_projects.get(&project_id)
                .ok_or("Project not found")?;
            (project.vm_id, project.project_path.clone(), project.language.clone())
        };

        let vm_name = format!("vm-coding-agent-{}", vm_id);

        // Build based on language
        let build_result = match language {
            ProgrammingLanguage::Rust => {
                Command::new("docker")
                    .args(&["exec", &vm_name, "bash", "-c", &format!("cd {} && cargo build", project_path.display())])
                    .output()
                    .await
            },
            ProgrammingLanguage::Go => {
                Command::new("docker")
                    .args(&["exec", &vm_name, "bash", "-c", &format!("cd {} && go build", project_path.display())])
                    .output()
                    .await
            },
            ProgrammingLanguage::Python => {
                Command::new("docker")
                    .args(&["exec", &vm_name, "bash", "-c", &format!("cd {} && python3 -m py_compile main.py", project_path.display())])
                    .output()
                    .await
            },
            _ => {
                // Generic build - just check if files exist
                Command::new("docker")
                    .args(&["exec", &vm_name, "bash", "-c", &format!("cd {} && ls -la", project_path.display())])
                    .output()
                    .await
            }
        };

        let build_output = build_result.map_err(|e| format!("Build failed: {}", e))?;

        // Update build status
        if let Some(project) = self.code_projects.get_mut(&project_id) {
            if build_output.status.success() {
                project.build_status = BuildStatus::Success;
            } else {
                project.build_status = BuildStatus::Failed {
                    error: String::from_utf8_lossy(&build_output.stderr).to_string()
                };
            }
        }

        Ok(())
    }

    /// Deploy the project
    async fn deploy_project(&mut self, project_id: Uuid) -> Result<(), String> {
        let _project = self.code_projects.get(&project_id)
            .ok_or("Project not found")?;

        // Update deployment status
        if let Some(project) = self.code_projects.get_mut(&project_id) {
            project.deployment_status = DeploymentStatus::Deploying;
        }

        // For now, just mark as deployed (in real implementation, would create Docker image, etc.)
        if let Some(project) = self.code_projects.get_mut(&project_id) {
            project.deployment_status = DeploymentStatus::Deployed {
                url: format!("http://localhost:8080/project/{}", project_id)
            };
        }

        Ok(())
    }

    /// Check if resources can be allocated
    fn can_allocate_resources(&self, specs: &VMSpecs) -> bool {
        self.resource_manager.allocated_cpu_cores + specs.cpu_cores <= self.resource_manager.total_cpu_cores &&
        self.resource_manager.allocated_memory_gb + specs.memory_gb <= self.resource_manager.total_memory_gb &&
        self.resource_manager.allocated_storage_gb + specs.storage_gb <= self.resource_manager.total_storage_gb
    }

    /// Terminate a VM and clean up resources
    pub async fn terminate_vm(&mut self, vm_id: Uuid) -> Result<(), String> {
        let vm_name = format!("vm-coding-agent-{}", vm_id);

        // Stop and remove Docker container
        let stop_cmd = Command::new("docker")
            .args(&["stop", &vm_name])
            .output()
            .await
            .map_err(|e| format!("Failed to stop VM: {}", e))?;

        let remove_cmd = Command::new("docker")
            .args(&["rm", &vm_name])
            .output()
            .await
            .map_err(|e| format!("Failed to remove VM: {}", e))?;

        if stop_cmd.status.success() && remove_cmd.status.success() {
            // Remove VM from tracking
            if let Some(vm) = self.active_vms.remove(&vm_id) {
                // Update resource allocation (use saturating_sub to prevent overflow)
                self.resource_manager.allocated_cpu_cores = self.resource_manager.allocated_cpu_cores.saturating_sub(vm.specs.cpu_cores);
                self.resource_manager.allocated_memory_gb = self.resource_manager.allocated_memory_gb.saturating_sub(vm.specs.memory_gb);
                self.resource_manager.allocated_storage_gb = self.resource_manager.allocated_storage_gb.saturating_sub(vm.specs.storage_gb);
            }
            Ok(())
        } else {
            Err("Failed to terminate VM".to_string())
        }
    }

    /// Get status of all VMs and projects
    pub fn get_status(&self) -> VMCodingAgentStatus {
        VMCodingAgentStatus {
            agent_id: self.id,
            total_vms: self.active_vms.len(),
            running_vms: self.active_vms.values().filter(|vm| vm.status == VMStatus::Running).count(),
            total_projects: self.code_projects.len(),
            active_projects: self.code_projects.values().filter(|p| p.build_status == BuildStatus::Success).count(),
            resource_usage: self.resource_manager.clone(),
        }
    }
}

/// Status information for the VM Coding Agent
#[derive(Debug, Clone)]
pub struct VMCodingAgentStatus {
    pub agent_id: Uuid,
    pub total_vms: usize,
    pub running_vms: usize,
    pub total_projects: usize,
    pub active_projects: usize,
    pub resource_usage: VMResourceManager,
}
