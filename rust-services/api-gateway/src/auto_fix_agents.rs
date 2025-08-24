use anyhow::{Result, anyhow};
use async_trait::async_trait;
use chrono::{DateTime, Utc, Duration as ChronoDuration};
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::{
    fs,
    sync::RwLock,
};
use tracing::{info, warn, error, debug};

use crate::proactive_code_analyzer::{CodeIssueType, CodeQualityIssue};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoFixAgentsConfig {
    pub ollama_url: String,
    pub lm_studio_url: String,
    pub preferred_model: String,
    pub fallback_model: String,
    pub temperature: f64,
    pub max_tokens: u32,
    pub max_llm_timeout: ChronoDuration,
    pub enable_aggressive_fixes: bool,
    pub max_file_size_kb: u32,
    pub backup_before_fix: bool,
    pub allowed_fix_types: HashSet<CodeIssueType>,
}

impl Default for AutoFixAgentsConfig {
    fn default() -> Self {
        let mut allowed_types = HashSet::new();
        allowed_types.insert(CodeIssueType::UnusedVariable);
        allowed_types.insert(CodeIssueType::UnusedImport);
        allowed_types.insert(CodeIssueType::DeadCode);
        allowed_types.insert(CodeIssueType::ImproperErrorHandling);
        allowed_types.insert(CodeIssueType::MissingDocumentation);
        
        Self {
            ollama_url: "http://localhost:11434".to_string(),
            lm_studio_url: "http://localhost:1234".to_string(),
            preferred_model: "llama3.2:3b".to_string(),
            fallback_model: "codellama:7b".to_string(),
            temperature: 0.1,
            max_tokens: 2048,
            max_llm_timeout: ChronoDuration::seconds(15),
            enable_aggressive_fixes: false,
            max_file_size_kb: 500,
            backup_before_fix: true,
            allowed_fix_types: allowed_types,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoFixResult {
    pub issue_id: String,
    pub fixed: bool,
    pub fix_description: String,
    pub confidence: f64,
    pub backup_created: bool,
    pub files_modified: Vec<PathBuf>,
    pub llm_reasoning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoFixSession {
    pub session_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub issues_processed: u32,
    pub fixes_applied: u32,
    pub fixes_skipped: u32,
    pub intelligence_mode: String,
    pub results: Vec<AutoFixResult>,
}

#[async_trait]
pub trait AutoFixAgent: Send + Sync {
    async fn can_fix(&self, issue: &CodeQualityIssue) -> bool;
    async fn apply_fix(&mut self, issue: &CodeQualityIssue) -> Result<AutoFixResult>;
    fn agent_name(&self) -> &str;
    fn confidence_level(&self) -> f64;
}

pub struct UnusedImportAgent {
    config: AutoFixAgentsConfig,
    client: Client,
}

impl UnusedImportAgent {
    pub fn new(config: AutoFixAgentsConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    async fn remove_unused_imports(&self, file_path: &Path, issue: &CodeQualityIssue) -> Result<AutoFixResult> {
        let content = fs::read_to_string(file_path).await?;
        let mut lines: Vec<&str> = content.lines().collect();
        
        // Extract line number from issue description if available
        let line_regex = Regex::new(r"line (\d+)")?;
        if let Some(captures) = line_regex.captures(&issue.description) {
            if let Ok(line_num) = captures[1].parse::<usize>() {
                if line_num > 0 && line_num <= lines.len() {
                    let line = lines[line_num - 1];
                    if line.trim_start().starts_with("use ") && line.contains(";") {
                        info!("🗑️ Removing unused import on line {}: {}", line_num, line.trim());
                        lines.remove(line_num - 1);
                        
                        let fixed_content = lines.join("\n");
                        fs::write(file_path, fixed_content).await?;
                        
                        return Ok(AutoFixResult {
                            issue_id: issue.id.clone(),
                            fixed: true,
                            fix_description: format!("Removed unused import: {}", line.trim()),
                            confidence: 0.95,
                            backup_created: false, // TODO: Implement backup
                            files_modified: vec![file_path.to_path_buf()],
                            llm_reasoning: None,
                        });
                    }
                }
            }
        }
        
        Ok(AutoFixResult {
            issue_id: issue.id.clone(),
            fixed: false,
            fix_description: "Could not determine which import to remove".to_string(),
            confidence: 0.0,
            backup_created: false,
            files_modified: vec![],
            llm_reasoning: None,
        })
    }
}

#[async_trait]
impl AutoFixAgent for UnusedImportAgent {
    async fn can_fix(&self, issue: &CodeQualityIssue) -> bool {
        issue.issue_type == CodeIssueType::UnusedImport && 
        self.config.allowed_fix_types.contains(&CodeIssueType::UnusedImport)
    }

    async fn apply_fix(&mut self, issue: &CodeQualityIssue) -> Result<AutoFixResult> {
        if let Some(file_path) = &issue.file_path {
            self.remove_unused_imports(file_path, issue).await
        } else {
            Ok(AutoFixResult {
                issue_id: issue.id.clone(),
                fixed: false,
                fix_description: "No file path specified".to_string(),
                confidence: 0.0,
                backup_created: false,
                files_modified: vec![],
                llm_reasoning: None,
            })
        }
    }

    fn agent_name(&self) -> &str {
        "UnusedImportAgent"
    }

    fn confidence_level(&self) -> f64 {
        0.9
    }
}

pub struct UnusedVariableAgent {
    config: AutoFixAgentsConfig,
    client: Client,
}

impl UnusedVariableAgent {
    pub fn new(config: AutoFixAgentsConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    async fn fix_unused_variable(&self, file_path: &Path, issue: &CodeQualityIssue) -> Result<AutoFixResult> {
        let content = fs::read_to_string(file_path).await?;
        
        // Extract variable name from issue description
        let var_regex = Regex::new(r"unused variable: `([^`]+)`")?;
        if let Some(captures) = var_regex.captures(&issue.description) {
            let var_name = &captures[1];
            
            // Simple fix: prefix with underscore to indicate intentionally unused
            let fixed_content = content.replace(
                &format!("let {}", var_name),
                &format!("let _{}", var_name)
            );
            
            if fixed_content != content {
                fs::write(file_path, fixed_content).await?;
                
                return Ok(AutoFixResult {
                    issue_id: issue.id.clone(),
                    fixed: true,
                    fix_description: format!("Prefixed unused variable '{}' with underscore", var_name),
                    confidence: 0.85,
                    backup_created: false,
                    files_modified: vec![file_path.to_path_buf()],
                    llm_reasoning: None,
                });
            }
        }
        
        Ok(AutoFixResult {
            issue_id: issue.id.clone(),
            fixed: false,
            fix_description: "Could not identify variable to fix".to_string(),
            confidence: 0.0,
            backup_created: false,
            files_modified: vec![],
            llm_reasoning: None,
        })
    }
}

#[async_trait]
impl AutoFixAgent for UnusedVariableAgent {
    async fn can_fix(&self, issue: &CodeQualityIssue) -> bool {
        issue.issue_type == CodeIssueType::UnusedVariable && 
        self.config.allowed_fix_types.contains(&CodeIssueType::UnusedVariable)
    }

    async fn apply_fix(&mut self, issue: &CodeQualityIssue) -> Result<AutoFixResult> {
        if let Some(file_path) = &issue.file_path {
            self.fix_unused_variable(file_path, issue).await
        } else {
            Ok(AutoFixResult {
                issue_id: issue.id.clone(),
                fixed: false,
                fix_description: "No file path specified".to_string(),
                confidence: 0.0,
                backup_created: false,
                files_modified: vec![],
                llm_reasoning: None,
            })
        }
    }

    fn agent_name(&self) -> &str {
        "UnusedVariableAgent"
    }

    fn confidence_level(&self) -> f64 {
        0.8
    }
}

pub struct ErrorHandlingAgent {
    config: AutoFixAgentsConfig,
    client: Client,
}

impl ErrorHandlingAgent {
    pub fn new(config: AutoFixAgentsConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    async fn query_local_llm(&self, prompt: &str) -> Result<String> {
        // Try Ollama first
        if let Ok(response) = self.query_ollama(prompt).await {
            return Ok(response);
        }
        
        // Fallback to LM Studio
        if let Ok(response) = self.query_lm_studio(prompt).await {
            return Ok(response);
        }
        
        Err(anyhow!("No local LLMs available"))
    }

    async fn query_ollama(&self, prompt: &str) -> Result<String> {
        let payload = serde_json::json!({
            "model": self.config.preferred_model,
            "prompt": prompt,
            "stream": false,
            "options": {
                "temperature": self.config.temperature,
                "num_predict": self.config.max_tokens
            }
        });

        let response = tokio::time::timeout(
            self.config.max_llm_timeout.to_std()?,
            self.client
                .post(&format!("{}/api/generate", self.config.ollama_url))
                .json(&payload)
                .send()
        ).await??;

        let result: serde_json::Value = response.json().await?;
        Ok(result["response"].as_str().unwrap_or("").to_string())
    }

    async fn query_lm_studio(&self, prompt: &str) -> Result<String> {
        let payload = serde_json::json!({
            "model": self.config.preferred_model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens
        });

        let response = tokio::time::timeout(
            self.config.max_llm_timeout.to_std()?,
            self.client
                .post(&format!("{}/v1/chat/completions", self.config.lm_studio_url))
                .json(&payload)
                .send()
        ).await??;

        let result: serde_json::Value = response.json().await?;
        Ok(result["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string())
    }

    async fn improve_error_handling(&self, file_path: &Path, issue: &CodeQualityIssue) -> Result<AutoFixResult> {
        let content = fs::read_to_string(file_path).await?;
        
        let prompt = format!(
            "You are a Rust expert. Analyze this code and fix the error handling issue described.
            
            ISSUE: {}
            
            CODE:
            ```rust
            {}
            ```
            
            Provide ONLY the corrected code without explanation. Replace `.unwrap()` with proper error handling using `?` operator or `match` statements.",
            issue.description,
            content
        );

        match self.query_local_llm(&prompt).await {
            Ok(llm_response) => {
                // Extract code from LLM response
                let code_regex = Regex::new(r"```rust\s*([\s\S]*?)```")?;
                let fixed_code = if let Some(captures) = code_regex.captures(&llm_response) {
                    captures[1].to_string()
                } else {
                    llm_response.clone()
                };

                if fixed_code.len() > 50 && fixed_code != content {
                    fs::write(file_path, &fixed_code).await?;
                    
                    Ok(AutoFixResult {
                        issue_id: issue.id.clone(),
                        fixed: true,
                        fix_description: "Improved error handling with LLM assistance".to_string(),
                        confidence: 0.75,
                        backup_created: false,
                        files_modified: vec![file_path.to_path_buf()],
                        llm_reasoning: Some(llm_response),
                    })
                } else {
                    Ok(AutoFixResult {
                        issue_id: issue.id.clone(),
                        fixed: false,
                        fix_description: "LLM provided insufficient response".to_string(),
                        confidence: 0.0,
                        backup_created: false,
                        files_modified: vec![],
                        llm_reasoning: Some(llm_response),
                    })
                }
            }
            Err(_) => {
                // Fallback to simple rule-based fix
                let fixed_content = content.replace(".unwrap()", "?");
                if fixed_content != content {
                    fs::write(file_path, fixed_content).await?;
                    
                    Ok(AutoFixResult {
                        issue_id: issue.id.clone(),
                        fixed: true,
                        fix_description: "Applied basic error handling fix (replaced .unwrap() with ?)".to_string(),
                        confidence: 0.6,
                        backup_created: false,
                        files_modified: vec![file_path.to_path_buf()],
                        llm_reasoning: None,
                    })
                } else {
                    Ok(AutoFixResult {
                        issue_id: issue.id.clone(),
                        fixed: false,
                        fix_description: "No error handling improvements needed".to_string(),
                        confidence: 0.0,
                        backup_created: false,
                        files_modified: vec![],
                        llm_reasoning: None,
                    })
                }
            }
        }
    }
}

#[async_trait]
impl AutoFixAgent for ErrorHandlingAgent {
    async fn can_fix(&self, issue: &CodeQualityIssue) -> bool {
        issue.issue_type == CodeIssueType::ImproperErrorHandling && 
        self.config.allowed_fix_types.contains(&CodeIssueType::ImproperErrorHandling)
    }

    async fn apply_fix(&mut self, issue: &CodeQualityIssue) -> Result<AutoFixResult> {
        if let Some(file_path) = &issue.file_path {
            self.improve_error_handling(file_path, issue).await
        } else {
            Ok(AutoFixResult {
                issue_id: issue.id.clone(),
                fixed: false,
                fix_description: "No file path specified".to_string(),
                confidence: 0.0,
                backup_created: false,
                files_modified: vec![],
                llm_reasoning: None,
            })
        }
    }

    fn agent_name(&self) -> &str {
        "ErrorHandlingAgent"
    }

    fn confidence_level(&self) -> f64 {
        0.7
    }
}

pub struct AutoFixOrchestrator {
    config: AutoFixAgentsConfig,
    agents: Vec<Box<dyn AutoFixAgent>>,
    session_history: Arc<RwLock<Vec<AutoFixSession>>>,
}

impl AutoFixOrchestrator {
    pub fn new(config: AutoFixAgentsConfig) -> Self {
        let mut agents: Vec<Box<dyn AutoFixAgent>> = Vec::new();
        
        // Register available agents
        agents.push(Box::new(UnusedImportAgent::new(config.clone())));
        agents.push(Box::new(UnusedVariableAgent::new(config.clone())));
        agents.push(Box::new(ErrorHandlingAgent::new(config.clone())));
        
        Self {
            config,
            agents,
            session_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn auto_fix_issues(&mut self, issues: Vec<CodeQualityIssue>) -> Result<AutoFixSession> {
        let session_id = uuid::Uuid::new_v4().to_string();
        let start_time = Utc::now();
        
        info!("🔧 Starting auto-fix session {} with {} issues", session_id, issues.len());
        
        let mut session = AutoFixSession {
            session_id: session_id.clone(),
            start_time,
            end_time: None,
            issues_processed: 0,
            fixes_applied: 0,
            fixes_skipped: 0,
            intelligence_mode: "AUTO_FIX_AGENTS".to_string(),
            results: Vec::new(),
        };

        for issue in issues {
            session.issues_processed += 1;
            
            debug!("🔍 Processing issue: {} - {}", issue.issue_type_string(), issue.description);
            
            let mut fix_applied = false;
            
            // Find an agent that can fix this issue
            for agent in &mut self.agents {
                if agent.can_fix(&issue).await {
                    info!("🤖 Agent {} attempting to fix issue {}", agent.agent_name(), issue.id);
                    
                    match agent.apply_fix(&issue).await {
                        Ok(result) => {
                            if result.fixed {
                                info!("✅ Successfully fixed: {}", result.fix_description);
                                session.fixes_applied += 1;
                                fix_applied = true;
                            } else {
                                warn!("⚠️ Fix attempt failed: {}", result.fix_description);
                            }
                            session.results.push(result);
                            break;
                        }
                        Err(e) => {
                            error!("❌ Agent {} failed to fix issue: {}", agent.agent_name(), e);
                            session.results.push(AutoFixResult {
                                issue_id: issue.id.clone(),
                                fixed: false,
                                fix_description: format!("Agent error: {}", e),
                                confidence: 0.0,
                                backup_created: false,
                                files_modified: vec![],
                                llm_reasoning: None,
                            });
                        }
                    }
                }
            }
            
            if !fix_applied {
                session.fixes_skipped += 1;
                debug!("⏭️ Skipped issue (no suitable agent): {}", issue.description);
                session.results.push(AutoFixResult {
                    issue_id: issue.id,
                    fixed: false,
                    fix_description: "No suitable auto-fix agent available".to_string(),
                    confidence: 0.0,
                    backup_created: false,
                    files_modified: vec![],
                    llm_reasoning: None,
                });
            }
        }

        session.end_time = Some(Utc::now());
        
        info!("🎉 Auto-fix session {} complete: {} issues processed, {} fixes applied, {} skipped",
            session_id, session.issues_processed, session.fixes_applied, session.fixes_skipped);

        // Store session in history
        self.session_history.write().await.push(session.clone());
        
        Ok(session)
    }

    pub async fn get_session_history(&self) -> Vec<AutoFixSession> {
        self.session_history.read().await.clone()
    }

    pub async fn get_agent_capabilities(&self) -> HashMap<String, f64> {
        let mut capabilities = HashMap::new();
        for agent in &self.agents {
            capabilities.insert(agent.agent_name().to_string(), agent.confidence_level());
        }
        capabilities
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_unused_import_agent() {
        let config = AutoFixAgentsConfig::default();
        let mut agent = UnusedImportAgent::new(config);
        
        let issue = CodeQualityIssue {
            id: "test-1".to_string(),
            issue_type: CodeIssueType::UnusedImport,
            severity: CodeIssueSeverity::Warning,
            description: "unused import: `std::collections::HashMap` on line 5".to_string(),
            file_path: None,
            line_number: Some(5),
            confidence: 0.9,
            suggested_fix: None,
            context: None,
        };
        
        assert!(agent.can_fix(&issue).await);
    }

    #[tokio::test]
    async fn test_unused_variable_agent() {
        let config = AutoFixAgentsConfig::default();
        let mut agent = UnusedVariableAgent::new(config);
        
        let issue = CodeQualityIssue {
            id: "test-2".to_string(),
            issue_type: CodeIssueType::UnusedVariable,
            severity: CodeIssueSeverity::Warning,
            description: "unused variable: `temp`".to_string(),
            file_path: None,
            line_number: Some(10),
            confidence: 0.85,
            suggested_fix: None,
            context: None,
        };
        
        assert!(agent.can_fix(&issue).await);
    }
}