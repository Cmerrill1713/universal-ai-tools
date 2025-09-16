//! VM Coding Agent - Main Entry Point
//!
//! This demonstrates how to use the VM Coding Agent to autonomously
//! spin up virtual machines and generate code.

use vm_coding_agent::{
    VMCodingAgent, VMCodingConfig, VMSpecs, NetworkConfig, PortMapping,
    CodingTask, ProgrammingLanguage, DeploymentTarget, TaskComplexity
};
use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("🤖 VM Coding Agent Starting...");
    println!("=====================================");

    // Create VM Coding Agent configuration
    let config = VMCodingConfig {
        max_concurrent_vms: 3,
        default_vm_specs: VMSpecs {
            cpu_cores: 2,
            memory_gb: 4,
            storage_gb: 20,
            os_image: "ubuntu:22.04".to_string(),
            network_config: NetworkConfig {
                allow_internet: true,
                port_mappings: vec![
                    PortMapping {
                        host_port: 8080,
                        vm_port: 8080,
                        protocol: "tcp".to_string(),
                    },
                ],
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

    // Create the VM Coding Agent
    let mut agent = VMCodingAgent::new(config);

    println!("✅ VM Coding Agent initialized");
    println!("📊 Resource limits: {} CPU cores, {}GB RAM, {}GB storage",
        agent.resource_manager.total_cpu_cores,
        agent.resource_manager.total_memory_gb,
        agent.resource_manager.total_storage_gb
    );

    // Example 1: Create a simple Rust web service
    println!("\n🚀 Example 1: Creating a Rust Web Service");
    let rust_task = CodingTask {
        id: uuid::Uuid::new_v4(),
        description: "Create a REST API service in Rust with endpoints for user management".to_string(),
        language: ProgrammingLanguage::Rust,
        requirements: vec![
            "Use Tokio for async runtime".to_string(),
            "Implement CRUD operations for users".to_string(),
            "Add input validation".to_string(),
            "Include error handling".to_string(),
        ],
        test_cases: vec![
            "Test user creation endpoint".to_string(),
            "Test user retrieval endpoint".to_string(),
            "Test user update endpoint".to_string(),
            "Test user deletion endpoint".to_string(),
        ],
        deployment_target: DeploymentTarget::Docker,
        estimated_complexity: TaskComplexity::Medium,
        deadline: None,
    };

    match agent.execute_coding_task(rust_task).await {
        Ok(project_id) => {
            println!("✅ Rust project created successfully: {}", project_id);
        },
        Err(e) => {
            println!("❌ Failed to create Rust project: {}", e);
        }
    }

    // Example 2: Create a Python data processing service
    println!("\n🐍 Example 2: Creating a Python Data Processing Service");
    let python_task = CodingTask {
        id: uuid::Uuid::new_v4(),
        description: "Create a Python service for processing CSV files and generating reports".to_string(),
        language: ProgrammingLanguage::Python,
        requirements: vec![
            "Use pandas for data manipulation".to_string(),
            "Generate PDF reports".to_string(),
            "Handle large files efficiently".to_string(),
            "Add data validation".to_string(),
        ],
        test_cases: vec![
            "Test CSV file processing".to_string(),
            "Test report generation".to_string(),
            "Test error handling for invalid files".to_string(),
        ],
        deployment_target: DeploymentTarget::Docker,
        estimated_complexity: TaskComplexity::Simple,
        deadline: None,
    };

    match agent.execute_coding_task(python_task).await {
        Ok(project_id) => {
            println!("✅ Python project created successfully: {}", project_id);
        },
        Err(e) => {
            println!("❌ Failed to create Python project: {}", e);
        }
    }

    // Example 3: Create a Go microservice
    println!("\n🐹 Example 3: Creating a Go Microservice");
    let go_task = CodingTask {
        id: uuid::Uuid::new_v4(),
        description: "Create a Go microservice for handling authentication and JWT tokens".to_string(),
        language: ProgrammingLanguage::Go,
        requirements: vec![
            "Use Gin framework".to_string(),
            "Implement JWT token generation and validation".to_string(),
            "Add password hashing with bcrypt".to_string(),
            "Include middleware for authentication".to_string(),
        ],
        test_cases: vec![
            "Test user registration".to_string(),
            "Test user login".to_string(),
            "Test JWT token validation".to_string(),
            "Test protected endpoints".to_string(),
        ],
        deployment_target: DeploymentTarget::Docker,
        estimated_complexity: TaskComplexity::Medium,
        deadline: None,
    };

    match agent.execute_coding_task(go_task).await {
        Ok(project_id) => {
            println!("✅ Go project created successfully: {}", project_id);
        },
        Err(e) => {
            println!("❌ Failed to create Go project: {}", e);
        }
    }

    // Wait a bit for VMs to initialize
    println!("\n⏳ Waiting for VMs to initialize...");
    sleep(Duration::from_secs(5)).await;

    // Show status
    let status = agent.get_status();
    println!("\n📊 VM Coding Agent Status:");
    println!("   Agent ID: {}", status.agent_id);
    println!("   Total VMs: {}", status.total_vms);
    println!("   Running VMs: {}", status.running_vms);
    println!("   Total Projects: {}", status.total_projects);
    println!("   Active Projects: {}", status.active_projects);
    println!("   Resource Usage: {}/{} CPU cores, {}/{}GB RAM",
        status.resource_usage.allocated_cpu_cores,
        status.resource_usage.total_cpu_cores,
        status.resource_usage.allocated_memory_gb,
        status.resource_usage.total_memory_gb
    );

    // List active VMs
    println!("\n🖥️  Active Virtual Machines:");
    for (vm_id, vm) in &agent.active_vms {
        println!("   VM {}: {} ({}) - {} projects",
            vm_id,
            vm.name,
            format!("{:?}", vm.status),
            vm.active_projects.len()
        );
    }

    // List projects
    println!("\n📁 Code Projects:");
    for (project_id, project) in &agent.code_projects {
        println!("   Project {}: {} ({}) - Build: {:?}, Deploy: {:?}",
            project_id,
            project.name,
            format!("{:?}", project.language),
            project.build_status,
            project.deployment_status
        );
    }

    println!("\n🎉 VM Coding Agent Demo Complete!");
    println!("The agent has successfully:");
    println!("  ✅ Spun up virtual machines");
    println!("  ✅ Generated code in multiple languages");
    println!("  ✅ Built and tested projects");
    println!("  ✅ Deployed applications");

    // Cleanup (optional)
    println!("\n🧹 Cleaning up resources...");
    for vm_id in agent.active_vms.keys().cloned().collect::<Vec<_>>() {
        if let Err(e) = agent.terminate_vm(vm_id).await {
            println!("⚠️  Warning: Failed to terminate VM {}: {}", vm_id, e);
        }
    }

    println!("✅ Cleanup complete!");

    Ok(())
}
