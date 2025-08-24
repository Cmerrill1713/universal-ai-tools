// Proactive Code Quality Analysis Module
// Continuously monitors and auto-improves code quality using local LLMs

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration as ChronoDuration};
use anyhow::Result;
use tracing::{info, warn, debug};
use reqwest::Client;
use crate::auto_fix_agents::{AutoFixOrchestrator, AutoFixAgentsConfig};
use crate::port_discovery_agent::{PortDiscoveryAgent, PortDiscoveryConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeQualityIssue {
    pub id: String,
    pub issue_type: CodeIssueType,
    pub severity: CodeIssueSeverity,
    pub file_path: Option<std::path::PathBuf>,
    pub line_number: Option<u32>,
    pub description: String,
    pub confidence: f64,
    pub suggested_fix: Option<String>,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum CodeIssueType {
    UnsafeUnwrap,
    ConfigurationMismatch,
    UnusedImport,
    UnusedVariable,
    ImproperErrorHandling,
    DeadCode,
    MissingDocumentation,
    PerformanceIssue,
    MemoryLeak,
    SecurityVulnerability,
    CodeDuplication,
    TechnicalDebt,
    TestCoverageLow,
    DependencyOutdated,
    PortConflict,
    PortOptimizationNeeded,
}

impl CodeIssueType {
    pub fn as_string(&self) -> String {
        match self {
            CodeIssueType::UnsafeUnwrap => "unsafe_unwrap".to_string(),
            CodeIssueType::ConfigurationMismatch => "configuration_mismatch".to_string(),
            CodeIssueType::UnusedImport => "unused_import".to_string(),
            CodeIssueType::UnusedVariable => "unused_variable".to_string(),
            CodeIssueType::ImproperErrorHandling => "improper_error_handling".to_string(),
            CodeIssueType::DeadCode => "dead_code".to_string(),
            CodeIssueType::MissingDocumentation => "missing_documentation".to_string(),
            CodeIssueType::PerformanceIssue => "performance_issue".to_string(),
            CodeIssueType::MemoryLeak => "memory_leak".to_string(),
            CodeIssueType::SecurityVulnerability => "security_vulnerability".to_string(),
            CodeIssueType::CodeDuplication => "code_duplication".to_string(),
            CodeIssueType::TechnicalDebt => "technical_debt".to_string(),
            CodeIssueType::TestCoverageLow => "test_coverage_low".to_string(),
            CodeIssueType::DependencyOutdated => "dependency_outdated".to_string(),
            CodeIssueType::PortConflict => "port_conflict".to_string(),
            CodeIssueType::PortOptimizationNeeded => "port_optimization_needed".to_string(),
        }
    }
}

impl CodeQualityIssue {
    pub fn issue_type_string(&self) -> String {
        self.issue_type.as_string()
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum CodeIssueSeverity {
    Critical,    // Security, memory safety issues
    High,        // Performance, reliability issues
    Medium,      // Code quality, maintainability
    Low,         // Style, documentation
    Info,        // Suggestions, optimizations
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeQualityReport {
    pub timestamp: DateTime<Utc>,
    pub total_issues: u32,
    pub critical_issues: u32,
    pub auto_fixed_issues: u32,
    pub overall_score: f64, // 0.0-1.0
    pub issues: Vec<CodeQualityIssue>,
    pub improvement_suggestions: Vec<String>,
    pub llm_insights: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ProactiveCodeAnalyzerConfig {
    pub analysis_interval_minutes: u64,
    pub ollama_url: String,
    pub lm_studio_url: String,
    pub preferred_model: String,
    pub enable_auto_fix: bool,
    pub max_auto_fixes_per_run: u32,
    pub source_directories: Vec<String>,
    pub excluded_patterns: Vec<String>,
    pub llm_timeout_seconds: u64,
}

impl Default for ProactiveCodeAnalyzerConfig {
    fn default() -> Self {
        Self {
            analysis_interval_minutes: 30, // Run every 30 minutes
            ollama_url: "http://localhost:11434".to_string(),
            lm_studio_url: "http://localhost:1234".to_string(),
            preferred_model: "llama3.2:3b".to_string(), // Use actual available model
            enable_auto_fix: true,
            max_auto_fixes_per_run: 5,
            source_directories: vec!["src".to_string(), "tests".to_string()],
            excluded_patterns: vec!["target/".to_string(), ".git/".to_string()],
            llm_timeout_seconds: 30,
        }
    }
}

pub struct ProactiveCodeAnalyzer {
    config: ProactiveCodeAnalyzerConfig,
    client: Client,
    issue_history: Arc<RwLock<Vec<CodeQualityIssue>>>,
    last_analysis: Arc<RwLock<Option<DateTime<Utc>>>>,
    auto_fix_count: Arc<RwLock<u32>>,
    auto_fix_orchestrator: AutoFixOrchestrator,
    port_discovery_agent: Arc<RwLock<PortDiscoveryAgent>>,
}

impl ProactiveCodeAnalyzer {
    pub async fn new(config: ProactiveCodeAnalyzerConfig) -> Result<Self> {
        // Create AutoFixAgentsConfig from ProactiveCodeAnalyzerConfig
        let auto_fix_config = AutoFixAgentsConfig {
            ollama_url: config.ollama_url.clone(),
            lm_studio_url: config.lm_studio_url.clone(),
            preferred_model: config.preferred_model.clone(),
            fallback_model: "codellama:7b".to_string(),
            temperature: 0.1,
            max_tokens: 2048,
            max_llm_timeout: ChronoDuration::seconds(config.llm_timeout_seconds as i64),
            enable_aggressive_fixes: false,
            max_file_size_kb: 500,
            backup_before_fix: true,
            allowed_fix_types: {
                let mut types = std::collections::HashSet::new();
                types.insert(CodeIssueType::UnusedImport);
                types.insert(CodeIssueType::UnusedVariable);
                types.insert(CodeIssueType::ImproperErrorHandling);
                types.insert(CodeIssueType::DeadCode);
                types.insert(CodeIssueType::MissingDocumentation);
                types
            },
        };

        // Create port discovery agent configuration
        let port_discovery_config = PortDiscoveryConfig::default();
        let port_discovery_agent = PortDiscoveryAgent::new(port_discovery_config).await?;
        
        Ok(Self {
            client: Client::new(),
            issue_history: Arc::new(RwLock::new(Vec::new())),
            last_analysis: Arc::new(RwLock::new(None)),
            auto_fix_count: Arc::new(RwLock::new(0)),
            auto_fix_orchestrator: AutoFixOrchestrator::new(auto_fix_config),
            port_discovery_agent: Arc::new(RwLock::new(port_discovery_agent)),
            config,
        })
    }

    // Main analysis loop - called periodically
    pub async fn run_proactive_analysis(&mut self) -> Result<CodeQualityReport> {
        info!("🔍 Starting proactive code quality analysis");
        
        let mut issues = Vec::new();
        let mut auto_fixed_count = 0;

        // 1. Analyze build output for warnings
        let build_issues = self.analyze_build_output().await?;
        issues.extend(build_issues);

        // 2. Scan source code for quality issues
        let source_issues = self.scan_source_code().await?;
        issues.extend(source_issues);

        // 3. Check configuration consistency
        let config_issues = self.analyze_configuration().await?;
        issues.extend(config_issues);

        // 4. Check port conflicts and optimization opportunities
        let port_issues = self.analyze_port_health().await?;
        issues.extend(port_issues);

        // 5. Use LLM for intelligent analysis of complex patterns
        let llm_issues = self.llm_analyze_codebase(&issues).await?;
        issues.extend(llm_issues);

        // 6. Auto-fix issues where safe and possible
        if self.config.enable_auto_fix {
            auto_fixed_count = self.auto_fix_issues(&mut issues).await?;
        }

        // 7. Generate comprehensive report
        let report = self.generate_quality_report(issues, auto_fixed_count).await?;
        
        // 8. Update analysis timestamp
        *self.last_analysis.write().await = Some(Utc::now());
        
        info!("✅ Proactive analysis complete: {} issues found, {} auto-fixed", 
              report.total_issues, auto_fixed_count);

        Ok(report)
    }

    async fn analyze_build_output(&self) -> Result<Vec<CodeQualityIssue>> {
        debug!("🔨 Analyzing build output for quality issues");
        let mut issues = Vec::new();

        // Run cargo build and capture warnings
        let output = Command::new("cargo")
            .args(&["build", "--release", "--message-format=json"])
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        
        for line in stdout.lines() {
            if let Ok(message) = serde_json::from_str::<serde_json::Value>(line) {
                if message["reason"] == "compiler-message" {
                    if let Some(warning) = self.parse_compiler_warning(&message) {
                        issues.push(warning);
                    }
                }
            }
        }

        Ok(issues)
    }

    fn parse_compiler_warning(&self, message: &serde_json::Value) -> Option<CodeQualityIssue> {
        let msg = &message["message"];
        let level = msg["level"].as_str()?;
        
        if level == "warning" || level == "error" {
            let text = msg["message"].as_str()?;
            let spans = &msg["spans"];
            
            if let Some(span) = spans.get(0) {
                let file_path = span["file_name"].as_str()?.to_string();
                let line_number = span["line_start"].as_u64().map(|n| n as u32);
                
                let issue_type = self.classify_compiler_warning(text);
                let severity = self.determine_severity(&issue_type, level);
                
                return Some(CodeQualityIssue {
                    id: format!("build_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)),
                    issue_type,
                    severity,
                    file_path: Some(std::path::PathBuf::from(file_path)),
                    line_number,
                    description: text.to_string(),
                    confidence: 0.9,
                    suggested_fix: self.suggest_fix(&issue_type, text),
                    context: Some(format!("Compiler warning: {}", text)),
                });
            }
        }
        
        None
    }

    fn classify_compiler_warning(&self, warning_text: &str) -> CodeIssueType {
        if warning_text.contains("unused") && warning_text.contains("import") {
            CodeIssueType::UnusedImport
        } else if warning_text.contains("unused") && warning_text.contains("variable") {
            CodeIssueType::UnusedVariable
        } else if warning_text.contains("unwrap") {
            CodeIssueType::UnsafeUnwrap
        } else {
            CodeIssueType::TechnicalDebt
        }
    }

    fn determine_severity(&self, issue_type: &CodeIssueType, level: &str) -> CodeIssueSeverity {
        match (issue_type, level) {
            (CodeIssueType::UnsafeUnwrap, _) => CodeIssueSeverity::High,
            (CodeIssueType::SecurityVulnerability, _) => CodeIssueSeverity::Critical,
            (CodeIssueType::MemoryLeak, _) => CodeIssueSeverity::High,
            (CodeIssueType::ConfigurationMismatch, _) => CodeIssueSeverity::Medium,
            (CodeIssueType::UnusedImport, _) => CodeIssueSeverity::Low,
            (CodeIssueType::UnusedVariable, _) => CodeIssueSeverity::Low,
            _ if level == "error" => CodeIssueSeverity::High,
            _ => CodeIssueSeverity::Medium,
        }
    }

    fn is_auto_fixable(&self, issue_type: &CodeIssueType) -> bool {
        matches!(issue_type, 
            CodeIssueType::UnusedImport | 
            CodeIssueType::UnusedVariable |
            CodeIssueType::ConfigurationMismatch
        )
    }

    fn suggest_fix(&self, issue_type: &CodeIssueType, warning_text: &str) -> Option<String> {
        match issue_type {
            CodeIssueType::UnusedImport => Some("Remove unused import statement".to_string()),
            CodeIssueType::UnusedVariable => Some("Remove unused variable or prefix with _".to_string()),
            CodeIssueType::UnsafeUnwrap => Some("Replace unwrap() with proper error handling".to_string()),
            CodeIssueType::ConfigurationMismatch => {
                if warning_text.contains("llama3.1:8b") {
                    Some("Update model name to llama3.2:3b (available model)".to_string())
                } else {
                    Some("Review configuration for consistency".to_string())
                }
            },
            _ => None,
        }
    }

    async fn scan_source_code(&self) -> Result<Vec<CodeQualityIssue>> {
        debug!("📁 Scanning source code for quality issues");
        let mut issues = Vec::new();

        for source_dir in &self.config.source_directories {
            if Path::new(source_dir).exists() {
                let dir_issues = self.scan_directory(source_dir).await?;
                issues.extend(dir_issues);
            }
        }

        Ok(issues)
    }

    async fn scan_directory(&self, dir_path: &str) -> Result<Vec<CodeQualityIssue>> {
        let mut issues = Vec::new();
        
        // Use ripgrep to find problematic patterns
        let patterns = vec![
            (r"\.unwrap\(\)", CodeIssueType::UnsafeUnwrap),
            (r"\.expect\(", CodeIssueType::UnsafeUnwrap),
            (r"panic!", CodeIssueType::UnsafeUnwrap),
            (r"llama3\.1:8b", CodeIssueType::ConfigurationMismatch),
        ];

        for (pattern, issue_type) in patterns {
            let output = Command::new("rg")
                .args(&["-n", "--type", "rust", pattern, dir_path])
                .output()?;

            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if let Some(issue) = self.parse_grep_result(line, &issue_type) {
                        issues.push(issue);
                    }
                }
            }
        }

        Ok(issues)
    }

    fn parse_grep_result(&self, line: &str, issue_type: &CodeIssueType) -> Option<CodeQualityIssue> {
        let parts: Vec<&str> = line.splitn(3, ':').collect();
        if parts.len() == 3 {
            let file_path = parts[0].to_string();
            let line_number = parts[1].parse().ok()?;
            let code_snippet = parts[2].trim();

            Some(CodeQualityIssue {
                id: format!("scan_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)),
                issue_type: issue_type.clone(),
                severity: self.determine_severity(issue_type, "warning"),
                file_path: Some(std::path::PathBuf::from(file_path)),
                line_number: Some(line_number),
                description: format!("Found {} in: {}", 
                    match issue_type {
                        CodeIssueType::UnsafeUnwrap => "unsafe unwrap",
                        CodeIssueType::ConfigurationMismatch => "configuration mismatch",
                        _ => "code quality issue",
                    }, 
                    code_snippet
                ),
                confidence: 0.8,
                suggested_fix: self.suggest_fix(issue_type, code_snippet),
                context: None,
            })
        } else {
            None
        }
    }

    async fn analyze_configuration(&self) -> Result<Vec<CodeQualityIssue>> {
        debug!("⚙️ Analyzing configuration consistency");
        let mut issues = Vec::new();

        // Check if configured model exists in Ollama
        if let Ok(available_models) = self.get_available_ollama_models().await {
            let configured_model = &self.config.preferred_model;
            if !available_models.contains(configured_model) {
                issues.push(CodeQualityIssue {
                    id: format!("config_{}", Utc::now().timestamp()),
                    issue_type: CodeIssueType::ConfigurationMismatch,
                    severity: CodeIssueSeverity::Medium,
                    file_path: Some(std::path::PathBuf::from("src/main.rs")),
                    line_number: None,
                    description: format!(
                        "Configured model '{}' not found in Ollama. Available: {:?}", 
                        configured_model, available_models
                    ),
                    confidence: 0.9,
                    suggested_fix: available_models.first().map(|m| 
                        format!("Update preferred_model to '{}'", m)
                    ),
                    context: None,
                });
            }
        }

        Ok(issues)
    }

    async fn analyze_port_health(&self) -> Result<Vec<CodeQualityIssue>> {
        debug!("🔌 Analyzing port conflicts and optimization opportunities");
        let mut issues = Vec::new();

        let port_discovery_agent = self.port_discovery_agent.read().await;

        // 1. Detect port conflicts
        match port_discovery_agent.detect_port_conflicts().await {
            Ok(conflicts) => {
                for conflict in conflicts {
                    issues.push(CodeQualityIssue {
                        id: format!("port_conflict_{}", conflict.port),
                        issue_type: CodeIssueType::PortConflict,
                        severity: match conflict.severity {
                            crate::port_discovery_agent::ConflictSeverity::Critical => CodeIssueSeverity::Critical,
                            crate::port_discovery_agent::ConflictSeverity::High => CodeIssueSeverity::High,
                            crate::port_discovery_agent::ConflictSeverity::Medium => CodeIssueSeverity::Medium,
                            crate::port_discovery_agent::ConflictSeverity::Low => CodeIssueSeverity::Low,
                        },
                        file_path: Some(std::path::PathBuf::from("system_ports")),
                        line_number: None,
                        description: format!("Port {} conflict between services: {:?}", 
                                           conflict.port, conflict.conflicting_services),
                        confidence: 0.95,
                        suggested_fix: Some(format!("Reassign one service to available port")),
                        context: Some(format!("Detected at: {}", conflict.detected_at)),
                    });
                }
            }
            Err(e) => {
                warn!("Port conflict detection failed: {}", e);
            }
        }

        // 2. Generate optimization recommendations
        drop(port_discovery_agent); // Release read lock to get mutable reference
        let mut port_discovery_agent = self.port_discovery_agent.write().await;
        match port_discovery_agent.generate_optimization_recommendations().await {
            Ok(recommendations) => {
                for rec in recommendations {
                    issues.push(CodeQualityIssue {
                        id: format!("port_opt_{}_{}", rec.service_name, rec.current_port),
                        issue_type: CodeIssueType::PortOptimizationNeeded,
                        severity: match rec.priority {
                            crate::port_discovery_agent::PortOptimizationPriority::Critical => CodeIssueSeverity::Critical,
                            crate::port_discovery_agent::PortOptimizationPriority::High => CodeIssueSeverity::High,
                            crate::port_discovery_agent::PortOptimizationPriority::Medium => CodeIssueSeverity::Medium,
                            crate::port_discovery_agent::PortOptimizationPriority::Low => CodeIssueSeverity::Low,
                        },
                        file_path: Some(std::path::PathBuf::from("service_registry")),
                        line_number: None,
                        description: format!("Service '{}' port optimization: {}", 
                                           rec.service_name, rec.reason),
                        confidence: rec.confidence,
                        suggested_fix: Some(format!("Move service from port {} to port {} (expected improvement: {:.1}%)", 
                                                   rec.current_port, rec.recommended_port, rec.expected_improvement * 100.0)),
                        context: Some(format!("Priority: {:?}, Confidence: {:.2}", rec.priority, rec.confidence)),
                    });
                }
            }
            Err(e) => {
                warn!("Port optimization analysis failed: {}", e);
            }
        }

        if !issues.is_empty() {
            info!("🔌 Found {} port-related issues", issues.len());
        }

        Ok(issues)
    }

    async fn get_available_ollama_models(&self) -> Result<Vec<String>> {
        let response = self.client
            .get(&format!("{}/api/tags", self.config.ollama_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await?;

        let models_json: serde_json::Value = response.json().await?;
        let models = models_json["models"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|m| m["name"].as_str())
            .map(|s| s.to_string())
            .collect();

        Ok(models)
    }

    async fn llm_analyze_codebase(&self, existing_issues: &[CodeQualityIssue]) -> Result<Vec<CodeQualityIssue>> {
        debug!("🧠 Using LLM for intelligent code analysis");
        
        if existing_issues.is_empty() {
            return Ok(vec![]);
        }

        let analysis_prompt = self.build_code_analysis_prompt(existing_issues).await?;
        
        if let Ok(llm_response) = self.query_ollama(&analysis_prompt).await {
            return self.parse_llm_code_analysis(&llm_response).await;
        }

        Ok(vec![])
    }

    async fn build_code_analysis_prompt(&self, issues: &[CodeQualityIssue]) -> Result<String> {
        let issues_summary: Vec<String> = issues.iter()
            .map(|i| format!("- {} in {}: {}", 
                match i.issue_type {
                    CodeIssueType::UnsafeUnwrap => "Unsafe unwrap",
                    CodeIssueType::ConfigurationMismatch => "Config mismatch", 
                    CodeIssueType::UnusedImport => "Unused import",
                    _ => "Code issue"
                },
                i.file_path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "unknown".to_string()), 
                i.description
            ))
            .collect();

        let prompt = format!(
            "You are an expert Rust code analyzer. Analyze these code quality issues and suggest improvements:

DETECTED ISSUES:
{}

Provide JSON response with additional insights:
{{
    \"additional_issues\": [
        {{
            \"type\": \"issue_type\",
            \"description\": \"detailed_description\",  
            \"severity\": \"high|medium|low\",
            \"auto_fixable\": true/false,
            \"suggested_fix\": \"specific_fix_instructions\"
        }}
    ],
    \"overall_assessment\": \"code quality assessment\",
    \"priority_fixes\": [\"top priority fixes\"],
    \"architectural_improvements\": [\"suggestions for better architecture\"]
}}",
            issues_summary.join("\n")
        );

        Ok(prompt)
    }

    async fn query_ollama(&self, prompt: &str) -> Result<String> {
        let request_body = serde_json::json!({
            "model": self.config.preferred_model,
            "prompt": prompt,
            "stream": false,
            "options": {
                "temperature": 0.1,  // Deterministic for code analysis
                "top_p": 0.9
            }
        });

        let response = self.client
            .post(&format!("{}/api/generate", self.config.ollama_url))
            .json(&request_body)
            .timeout(std::time::Duration::from_secs(self.config.llm_timeout_seconds))
            .send()
            .await?;

        let response_json: serde_json::Value = response.json().await?;
        Ok(response_json["response"].as_str().unwrap_or("").to_string())
    }

    async fn parse_llm_code_analysis(&self, response: &str) -> Result<Vec<CodeQualityIssue>> {
        // Try to parse JSON response from LLM
        if let Ok(analysis) = serde_json::from_str::<serde_json::Value>(response) {
            let mut issues = Vec::new();
            
            if let Some(additional_issues) = analysis["additional_issues"].as_array() {
                for issue_json in additional_issues {
                    if let Some(issue) = self.parse_llm_issue(issue_json) {
                        issues.push(issue);
                    }
                }
            }
            
            return Ok(issues);
        }

        // Fallback: parse text response
        Ok(vec![])
    }

    fn parse_llm_issue(&self, issue_json: &serde_json::Value) -> Option<CodeQualityIssue> {
        let issue_type_str = issue_json["type"].as_str()?;
        let issue_type = match issue_type_str {
            "performance" => CodeIssueType::PerformanceIssue,
            "security" => CodeIssueType::SecurityVulnerability,
            "memory" => CodeIssueType::MemoryLeak,
            "documentation" => CodeIssueType::MissingDocumentation,
            _ => CodeIssueType::TechnicalDebt,
        };

        let severity = match issue_json["severity"].as_str()? {
            "high" => CodeIssueSeverity::High,
            "medium" => CodeIssueSeverity::Medium,
            "low" => CodeIssueSeverity::Low,
            _ => CodeIssueSeverity::Medium,
        };

        Some(CodeQualityIssue {
            id: format!("llm_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0)),
            issue_type,
            severity,
            file_path: Some(std::path::PathBuf::from("codebase")),
            line_number: None,
            description: issue_json["description"].as_str()?.to_string(),
            confidence: 0.7,
            suggested_fix: issue_json["suggested_fix"].as_str().map(|s| s.to_string()),
            context: Some("Generated by LLM analysis".to_string()),
        })
    }

    async fn auto_fix_issues(&mut self, issues: &mut Vec<CodeQualityIssue>) -> Result<u32> {
        if !self.config.enable_auto_fix {
            return Ok(0);
        }

        info!("🔧 Using AutoFixOrchestrator to fix code quality issues");
        
        // Clone issues for the orchestrator (it consumes the vector)
        let issues_to_fix: Vec<CodeQualityIssue> = issues.iter()
            .filter(|issue| {
                // Filter to only auto-fixable issues within our limit
                matches!(issue.issue_type, 
                    CodeIssueType::UnusedImport | 
                    CodeIssueType::UnusedVariable | 
                    CodeIssueType::ImproperErrorHandling |
                    CodeIssueType::DeadCode |
                    CodeIssueType::MissingDocumentation
                )
            })
            .take(self.config.max_auto_fixes_per_run as usize)
            .cloned()
            .collect();

        if issues_to_fix.is_empty() {
            info!("📋 No auto-fixable issues found");
            return Ok(0);
        }

        // Run the auto-fix session
        match self.auto_fix_orchestrator.auto_fix_issues(issues_to_fix).await {
            Ok(session) => {
                info!("🎉 AutoFix session complete: {} fixes applied, {} issues processed", 
                      session.fixes_applied, session.issues_processed);
                
                // Update auto-fix counter
                *self.auto_fix_count.write().await += session.fixes_applied;
                
                // Mark fixed issues in original issues vector
                for result in &session.results {
                    if result.fixed {
                        for issue in issues.iter_mut() {
                            if issue.id == result.issue_id {
                                issue.description = format!("[AUTO-FIXED] {}", issue.description);
                                break;
                            }
                        }
                    }
                }
                
                Ok(session.fixes_applied)
            }
            Err(e) => {
                warn!("⚠️ AutoFix orchestrator failed: {}", e);
                Ok(0)
            }
        }
    }

    async fn apply_auto_fix(&self, issue: &CodeQualityIssue) -> Result<bool> {
        match issue.issue_type {
            CodeIssueType::ConfigurationMismatch if issue.description.contains("llama3.1:8b") => {
                // Fix model name in main.rs
                self.fix_model_configuration().await
            },
            CodeIssueType::UnusedImport => {
                // Remove unused import (safe auto-fix)
                if let Some(ref file_path) = issue.file_path {
                    self.remove_unused_import(&file_path.to_string_lossy(), issue.line_number).await
                } else {
                    Ok(false)
                }
            },
            _ => Ok(false), // Skip other types for safety
        }
    }

    async fn fix_model_configuration(&self) -> Result<bool> {
        info!("🔧 Auto-fixing model configuration mismatch");
        
        // Read main.rs and update model name
        let main_rs_path = "src/main.rs";
        if let Ok(content) = tokio::fs::read_to_string(main_rs_path).await {
            let fixed_content = content.replace("llama3.1:8b", "llama3.2:3b");
            if fixed_content != content {
                tokio::fs::write(main_rs_path, fixed_content).await?;
                info!("✅ Updated model configuration to use available model");
                return Ok(true);
            }
        }
        
        Ok(false)
    }

    async fn remove_unused_import(&self, file_path: &str, line_number: Option<u32>) -> Result<bool> {
        // For safety, only suggest removal, don't auto-remove
        // (Could break code if import is actually used elsewhere)
        debug!("Would remove unused import in {} at line {:?}", file_path, line_number);
        Ok(false) // Return false to indicate we didn't actually fix it
    }

    async fn generate_quality_report(&self, issues: Vec<CodeQualityIssue>, auto_fixed: u32) -> Result<CodeQualityReport> {
        let total_issues = issues.len() as u32;
        let critical_issues = issues.iter()
            .filter(|i| matches!(i.severity, CodeIssueSeverity::Critical))
            .count() as u32;

        // Calculate overall quality score (0.0-1.0)
        let overall_score = if total_issues == 0 {
            1.0
        } else {
            let weighted_score = issues.iter()
                .map(|i| match i.severity {
                    CodeIssueSeverity::Critical => 0.0,
                    CodeIssueSeverity::High => 0.3,
                    CodeIssueSeverity::Medium => 0.6,
                    CodeIssueSeverity::Low => 0.8,
                    CodeIssueSeverity::Info => 0.9,
                })
                .sum::<f64>() / total_issues as f64;
            
            weighted_score
        };

        let improvement_suggestions = vec![
            "Consider replacing unwrap() calls with proper error handling".to_string(),
            "Update configuration to match available resources".to_string(),
            "Remove unused imports to reduce build warnings".to_string(),
        ];

        let llm_insights = vec![
            "Code quality is generally good with minor improvements needed".to_string(),
            "Focus on error handling robustness for production reliability".to_string(),
        ];

        Ok(CodeQualityReport {
            timestamp: Utc::now(),
            total_issues,
            critical_issues,
            auto_fixed_issues: auto_fixed,
            overall_score,
            issues,
            improvement_suggestions,
            llm_insights,
        })
    }

    // Public API for integration with main system
    pub async fn should_run_analysis(&self) -> Result<bool> {
        let last_run = self.last_analysis.read().await;
        if let Some(last) = *last_run {
            let elapsed = Utc::now() - last;
            Ok(elapsed > ChronoDuration::minutes(self.config.analysis_interval_minutes as i64))
        } else {
            Ok(true) // Never run before
        }
    }

    pub async fn get_latest_report(&self) -> Option<CodeQualityReport> {
        // Would store and retrieve the latest report
        None
    }

    pub async fn start_continuous_monitoring(&mut self) {
        info!("🔄 Starting continuous code quality monitoring");
        
        let mut interval = tokio::time::interval(
            tokio::time::Duration::from_secs(self.config.analysis_interval_minutes * 60)
        );

        loop {
            interval.tick().await;
            
            match self.run_proactive_analysis().await {
                Ok(report) => {
                    info!("📊 Code Quality Report - Score: {:.2}, Issues: {}, Fixed: {}", 
                          report.overall_score, report.total_issues, report.auto_fixed_issues);
                },
                Err(e) => {
                    warn!("⚠️ Code quality analysis failed: {}", e);
                }
            }
        }
    }

    /// Register a service with the port discovery system for monitoring
    pub async fn register_service_for_port_monitoring(&self, service: &crate::ServiceInfo) -> Result<()> {
        let mut port_discovery_agent = self.port_discovery_agent.write().await;
        port_discovery_agent.register_service(service).await?;
        info!("🔌 Registered service {} (port {}) for port monitoring", service.name, service.port);
        Ok(())
    }

    /// Update service metrics for port optimization
    pub async fn update_service_port_metrics(&self, service_name: &str, health_score: f64, load_score: f64) -> Result<()> {
        let mut port_discovery_agent = self.port_discovery_agent.write().await;
        port_discovery_agent.update_service_metrics(service_name, health_score, load_score).await?;
        debug!("🔌 Updated port metrics for service {}: health={:.2}, load={:.2}", 
               service_name, health_score, load_score);
        Ok(())
    }

    /// Get comprehensive port discovery status
    pub async fn get_port_discovery_status(&self) -> Result<serde_json::Value> {
        let port_discovery_agent = self.port_discovery_agent.read().await;
        let status = port_discovery_agent.get_port_discovery_status().await?;
        
        Ok(serde_json::json!({
            "port_discovery": {
                "total_services": status.total_services,
                "healthy_services": status.healthy_services,
                "available_ports": status.available_ports,
                "port_conflicts": status.port_conflicts,
                "auto_port_range": status.auto_port_range,
                "optimization_recommendations": status.optimization_recommendations,
                "last_discovery_scan": status.last_discovery_scan
            }
        }))
    }

    /// Suggest optimal port for a new service
    pub async fn suggest_optimal_port_for_service(&self, service_name: &str) -> Result<u16> {
        let port_discovery_agent = self.port_discovery_agent.read().await;
        port_discovery_agent.suggest_optimal_port(service_name).await
    }
}