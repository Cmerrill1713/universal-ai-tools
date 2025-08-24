use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::process::Command;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum TaskCategory {
    Calendar,
    Reminder,
    Database,
    Deployment,
    Project,
    SystemApp,
    General,
}

pub struct AutomationEngine {
    client: Client,
    api_gateway_url: String,
}

impl AutomationEngine {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            api_gateway_url: "http://localhost:8080/api/v1".to_string(),
        }
    }

    pub fn categorize_command(&self, command: &str) -> TaskCategory {
        let command_lower = command.to_lowercase();
        
        if command_lower.contains("calendar") || 
           command_lower.contains("schedule") || 
           command_lower.contains("meeting") || 
           command_lower.contains("appointment") {
            TaskCategory::Calendar
        } else if command_lower.contains("todo") || 
                  command_lower.contains("task") || 
                  command_lower.contains("reminder") || 
                  command_lower.contains("remind") {
            TaskCategory::Reminder
        } else if command_lower.contains("optimize") || 
                  command_lower.contains("database") || 
                  command_lower.contains("supabase") || 
                  command_lower.contains("vacuum") {
            TaskCategory::Database
        } else if command_lower.contains("website") || 
                  command_lower.contains("deploy") || 
                  command_lower.contains("create site") || 
                  command_lower.contains("web app") {
            TaskCategory::Deployment
        } else if (command_lower.contains("create") || 
                   command_lower.contains("build") || 
                   command_lower.contains("make") || 
                   command_lower.contains("generate")) &&
                  (command_lower.contains("project") || 
                   command_lower.contains("app") || 
                   command_lower.contains("script") || 
                   command_lower.contains("program")) {
            TaskCategory::Project
        } else if (command_lower.contains("open") || 
                   command_lower.contains("launch") || 
                   command_lower.contains("start")) &&
                  (command_lower.contains("app") || 
                   command_lower.contains("application") || 
                   command_lower.contains("program")) {
            TaskCategory::SystemApp
        } else {
            TaskCategory::General
        }
    }

    pub async fn execute_system_automation(&self, command: &str) -> Result<serde_json::Value> {
        info!("Executing system automation: {}", command);
        
        // Call Python system automation script
        let output = Command::new("python3")
            .arg("system-automation.py")
            .arg(command)
            .output()?;
        
        if output.status.success() {
            let result = String::from_utf8_lossy(&output.stdout);
            Ok(json!({
                "success": true,
                "output": result.to_string()
            }))
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(anyhow!("System automation failed: {}", error))
        }
    }

    pub async fn execute_database_operation(&self, command: &str) -> Result<serde_json::Value> {
        info!("Executing database operation: {}", command);
        
        if command.to_lowercase().contains("optimize") {
            // Run Supabase optimization
            let output = Command::new("bash")
                .arg("supabase-optimizer.sh")
                .output()?;
            
            if output.status.success() {
                let result = String::from_utf8_lossy(&output.stdout);
                Ok(json!({
                    "success": true,
                    "output": result.to_string(),
                    "optimized": true
                }))
            } else {
                let error = String::from_utf8_lossy(&output.stderr);
                Err(anyhow!("Database optimization failed: {}", error))
            }
        } else {
            // General database query via action assistant
            let output = Command::new("python3")
                .arg("action-assistant.py")
                .arg("--command")
                .arg(command)
                .output()?;
            
            let result = String::from_utf8_lossy(&output.stdout);
            Ok(json!({
                "success": true,
                "output": result.to_string()
            }))
        }
    }

    pub async fn execute_deployment(&self, command: &str) -> Result<serde_json::Value> {
        info!("Executing deployment workflow: {}", command);
        
        // Call autonomous agent for complex deployments
        let output = Command::new("python3")
            .arg("autonomous-agent.py")
            .arg("--command")
            .arg(command)
            .output()?;
        
        if output.status.success() {
            let result = String::from_utf8_lossy(&output.stdout);
            
            // Try to parse as JSON, fallback to string
            if let Ok(json_result) = serde_json::from_str::<serde_json::Value>(&result) {
                Ok(json_result)
            } else {
                Ok(json!({
                    "success": true,
                    "output": result.to_string()
                }))
            }
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(anyhow!("Deployment failed: {}", error))
        }
    }

    pub async fn execute_general_query(&self, command: &str) -> Result<serde_json::Value> {
        info!("Executing general query via API Gateway: {}", command);
        
        // Send to Go API Gateway
        let response = self.client
            .post(format!("{}/chat/", self.api_gateway_url))
            .json(&json!({
                "message": command,
                "userId": "integrated-assistant"
            }))
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .await?;
        
        if response.status().is_success() {
            let data = response.json::<serde_json::Value>().await?;
            Ok(data)
        } else {
            Err(anyhow!("API Gateway returned status: {}", response.status()))
        }
    }

    pub async fn execute_project_creation(&self, command: &str) -> Result<serde_json::Value> {
        info!("Creating project: {}", command);
        
        // Determine project type
        let project_type = if command.to_lowercase().contains("react") {
            "react"
        } else if command.to_lowercase().contains("python") {
            "python"
        } else if command.to_lowercase().contains("node") || 
                  command.to_lowercase().contains("javascript") {
            "node"
        } else if command.to_lowercase().contains("rust") {
            "rust"
        } else if command.to_lowercase().contains("go") {
            "go"
        } else {
            "generic"
        };
        
        // Use build-anything.sh for project scaffolding
        let output = Command::new("bash")
            .arg("build-anything.sh")
            .arg(format!("create {} project", project_type))
            .output()?;
        
        if output.status.success() {
            let result = String::from_utf8_lossy(&output.stdout);
            Ok(json!({
                "success": true,
                "project_type": project_type,
                "output": result.to_string()
            }))
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(anyhow!("Project creation failed: {}", error))
        }
    }
}