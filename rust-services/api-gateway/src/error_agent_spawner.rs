use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use anyhow::{Result, anyhow};
use tracing::{info, warn, debug};
use reqwest::Client;

/// Error classification for intelligent agent spawning
#[derive(Debug, Clone, Serialize, Deserialize, Eq, Hash, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCategory {
    NetworkTimeout,
    DatabaseConnection,
    ServiceUnavailable,
    MemoryLeak,
    ConfigurationError,
    PermissionDenied,
    RateLimit,
    ValidationFailure,
    CacheError,
    SecurityBreach,
    PerformanceDegradation,
    UnknownError,
}

impl std::fmt::Display for ErrorCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        let name = match self {
            ErrorCategory::NetworkTimeout => "Network Timeout",
            ErrorCategory::DatabaseConnection => "Database Connection",
            ErrorCategory::ServiceUnavailable => "Service Unavailable",
            ErrorCategory::MemoryLeak => "Memory Leak",
            ErrorCategory::ConfigurationError => "Configuration Error",
            ErrorCategory::PermissionDenied => "Permission Denied",
            ErrorCategory::RateLimit => "Rate Limit",
            ErrorCategory::ValidationFailure => "Validation Failure",
            ErrorCategory::CacheError => "Cache Error",
            ErrorCategory::SecurityBreach => "Security Breach",
            ErrorCategory::PerformanceDegradation => "Performance Degradation",
            ErrorCategory::UnknownError => "Unknown Error",
        };
        write!(f, "{}", name)
    }
}

/// Error severity levels for prioritizing agent responses
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum ErrorSeverity {
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4,
    Emergency = 5,
}

/// Structured error context for agent decision-making
#[derive(Debug, Clone, Serialize)]
pub struct ErrorContext {
    pub timestamp: DateTime<Utc>,
    pub service_id: String,
    pub error_category: ErrorCategory,
    pub severity: ErrorSeverity,
    pub error_message: String,
    pub stack_trace: Option<String>,
    pub affected_endpoints: Vec<String>,
    pub system_context: SystemErrorContext,
    pub correlation_id: String,
    pub frequency: ErrorFrequency,
}

/// System context at time of error
#[derive(Debug, Clone, Serialize)]
pub struct SystemErrorContext {
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub disk_usage: f64,
    pub network_latency: f64,
    pub concurrent_requests: u64,
    pub recent_deployments: Vec<String>,
    pub active_incidents: Vec<String>,
}

/// Error frequency analysis
#[derive(Debug, Clone, Serialize)]
pub struct ErrorFrequency {
    pub count_last_minute: u32,
    pub count_last_hour: u32,
    pub is_recurring: bool,
    pub pattern_detected: Option<String>,
}

/// Agent specialization for different error types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSpecialization {
    pub agent_type: String,
    pub capabilities: Vec<String>,
    pub error_categories: Vec<ErrorCategory>,
    pub estimated_resolution_time: u32, // seconds
    pub success_rate: f64,
    pub resource_requirements: ResourceRequirements,
}

/// Resource requirements for spawning agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceRequirements {
    pub cpu_cores: f32,
    pub memory_mb: u32,
    pub network_bandwidth: u32, // mbps
    pub execution_timeout: u32, // seconds
}

/// Agent spawn request to HRM service
#[derive(Debug, Clone, Serialize)]
pub struct AgentSpawnRequest {
    pub error_context: ErrorContext,
    pub requested_agent_type: String,
    pub priority: u8, // 1-5, 5 being highest
    pub max_execution_time: u32,
    pub expected_outcome: String,
    pub rollback_plan: Option<String>,
}

/// Response from HRM when spawning an agent
#[derive(Debug, Clone, Deserialize)]
pub struct AgentSpawnResponse {
    pub agent_id: String,
    pub agent_type: String,
    pub estimated_completion: DateTime<Utc>,
    pub monitoring_endpoints: Vec<String>,
    pub progress_webhook: String,
    pub termination_command: String,
}

/// Agent execution result
#[derive(Debug, Clone, Deserialize)]
pub struct AgentExecutionResult {
    pub agent_id: String,
    pub status: AgentStatus,
    pub resolution_actions: Vec<String>,
    pub success: bool,
    pub execution_time: u32,
    pub error_resolved: bool,
    pub lessons_learned: Vec<String>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Spawning,
    Analyzing,
    Executing,
    Completed,
    Failed,
    Terminated,
}

/// Error-specific agent delegation system
pub struct ErrorAgentSpawner {
    hrm_client: Client,
    hrm_base_url: String,
    agent_specializations: HashMap<ErrorCategory, Vec<AgentSpecialization>>,
    active_agents: Arc<RwLock<HashMap<String, AgentExecutionResult>>>,
    error_patterns: Arc<RwLock<HashMap<String, ErrorFrequency>>>,
    config: ErrorAgentConfig,
}

#[derive(Debug, Clone)]
pub struct ErrorAgentConfig {
    pub ollama_url: String,
    pub lm_studio_url: String,
    pub max_concurrent_agents: u32,
    pub agent_spawn_timeout: u32,
    pub error_correlation_window: u32, // minutes
    pub auto_spawn_threshold: ErrorSeverity,
    pub enable_learning: bool,
}

impl Default for ErrorAgentConfig {
    fn default() -> Self {
        Self {
            ollama_url: "http://localhost:11434".to_string(),
            lm_studio_url: "http://localhost:1234".to_string(),
            max_concurrent_agents: 5,
            agent_spawn_timeout: 10, // seconds
            error_correlation_window: 15, // minutes
            auto_spawn_threshold: ErrorSeverity::Medium,
            enable_learning: true,
        }
    }
}

impl ErrorAgentSpawner {
    pub async fn new(config: ErrorAgentConfig) -> Result<Self> {
        let mut spawner = Self {
            hrm_client: Client::new(),
            hrm_base_url: config.ollama_url.clone(),
            agent_specializations: HashMap::new(),
            active_agents: Arc::new(RwLock::new(HashMap::new())),
            error_patterns: Arc::new(RwLock::new(HashMap::new())),
            config,
        };
        
        // Initialize agent specializations
        spawner.initialize_agent_specializations().await;
        
        Ok(spawner)
    }
    
    /// Initialize agent specializations for different error categories
    async fn initialize_agent_specializations(&mut self) {
        info!("🤖 Initializing agent specializations");
        
        // Network/Connection specialists
        self.agent_specializations.insert(ErrorCategory::NetworkTimeout, vec![
            AgentSpecialization {
                agent_type: "network-engineer".to_string(),
                capabilities: vec![
                    "network_diagnostics".to_string(),
                    "connection_pooling_optimization".to_string(),
                    "timeout_configuration".to_string(),
                    "load_balancer_adjustment".to_string(),
                ],
                error_categories: vec![ErrorCategory::NetworkTimeout, ErrorCategory::ServiceUnavailable],
                estimated_resolution_time: 300, // 5 minutes
                success_rate: 0.87,
                resource_requirements: ResourceRequirements {
                    cpu_cores: 1.0,
                    memory_mb: 512,
                    network_bandwidth: 10,
                    execution_timeout: 600,
                },
            }
        ]);
        
        // Database specialists
        self.agent_specializations.insert(ErrorCategory::DatabaseConnection, vec![
            AgentSpecialization {
                agent_type: "database-optimizer".to_string(),
                capabilities: vec![
                    "connection_pool_analysis".to_string(),
                    "query_optimization".to_string(),
                    "index_analysis".to_string(),
                    "transaction_deadlock_resolution".to_string(),
                ],
                error_categories: vec![ErrorCategory::DatabaseConnection, ErrorCategory::PerformanceDegradation],
                estimated_resolution_time: 420, // 7 minutes
                success_rate: 0.92,
                resource_requirements: ResourceRequirements {
                    cpu_cores: 2.0,
                    memory_mb: 1024,
                    network_bandwidth: 5,
                    execution_timeout: 900,
                },
            }
        ]);
        
        // Security specialists
        self.agent_specializations.insert(ErrorCategory::SecurityBreach, vec![
            AgentSpecialization {
                agent_type: "security-auditor".to_string(),
                capabilities: vec![
                    "intrusion_detection".to_string(),
                    "vulnerability_assessment".to_string(),
                    "access_control_validation".to_string(),
                    "incident_response".to_string(),
                ],
                error_categories: vec![ErrorCategory::SecurityBreach, ErrorCategory::PermissionDenied],
                estimated_resolution_time: 180, // 3 minutes (urgent)
                success_rate: 0.95,
                resource_requirements: ResourceRequirements {
                    cpu_cores: 2.5,
                    memory_mb: 2048,
                    network_bandwidth: 50,
                    execution_timeout: 300,
                },
            }
        ]);
        
        // Performance specialists
        self.agent_specializations.insert(ErrorCategory::PerformanceDegradation, vec![
            AgentSpecialization {
                agent_type: "performance-optimizer".to_string(),
                capabilities: vec![
                    "memory_leak_detection".to_string(),
                    "cpu_bottleneck_analysis".to_string(),
                    "cache_optimization".to_string(),
                    "scaling_recommendations".to_string(),
                ],
                error_categories: vec![ErrorCategory::PerformanceDegradation, ErrorCategory::MemoryLeak],
                estimated_resolution_time: 480, // 8 minutes
                success_rate: 0.85,
                resource_requirements: ResourceRequirements {
                    cpu_cores: 1.5,
                    memory_mb: 768,
                    network_bandwidth: 15,
                    execution_timeout: 720,
                },
            }
        ]);
        
        // Configuration specialists
        self.agent_specializations.insert(ErrorCategory::ConfigurationError, vec![
            AgentSpecialization {
                agent_type: "devops-troubleshooter".to_string(),
                capabilities: vec![
                    "configuration_validation".to_string(),
                    "environment_analysis".to_string(),
                    "deployment_verification".to_string(),
                    "rollback_execution".to_string(),
                ],
                error_categories: vec![ErrorCategory::ConfigurationError, ErrorCategory::ValidationFailure],
                estimated_resolution_time: 240, // 4 minutes
                success_rate: 0.90,
                resource_requirements: ResourceRequirements {
                    cpu_cores: 1.0,
                    memory_mb: 512,
                    network_bandwidth: 5,
                    execution_timeout: 480,
                },
            }
        ]);
        
        // General troubleshooting
        self.agent_specializations.insert(ErrorCategory::UnknownError, vec![
            AgentSpecialization {
                agent_type: "error-detective".to_string(),
                capabilities: vec![
                    "log_analysis".to_string(),
                    "pattern_recognition".to_string(),
                    "root_cause_analysis".to_string(),
                    "system_diagnostics".to_string(),
                ],
                error_categories: vec![ErrorCategory::UnknownError],
                estimated_resolution_time: 600, // 10 minutes
                success_rate: 0.75,
                resource_requirements: ResourceRequirements {
                    cpu_cores: 2.0,
                    memory_mb: 1024,
                    network_bandwidth: 20,
                    execution_timeout: 900,
                },
            }
        ]);
        
        info!("✅ Initialized {} agent specializations", self.agent_specializations.len());
    }
    
    /// Main entry point: analyze error and potentially spawn agent
    pub async fn handle_error(&mut self, error_message: &str, service_id: &str, metadata: Option<serde_json::Value>) -> Result<Option<AgentSpawnResponse>> {
        // 1. Classify the error
        let error_context = self.classify_error(error_message, service_id, metadata).await?;
        
        info!("🔍 Classified error: {:?} with severity {:?}", error_context.error_category, error_context.severity);
        
        // 2. Update error patterns for learning
        self.update_error_patterns(&error_context).await;
        
        // 3. Determine if agent spawning is needed
        if self.should_spawn_agent(&error_context).await {
            info!("🚨 Error severity {:?} meets auto-spawn threshold {:?}", error_context.severity, self.config.auto_spawn_threshold);
            
            // 4. Select appropriate agent
            let agent_spec = self.select_optimal_agent(&error_context).await?;
            
            // 5. Check resource availability
            if self.can_spawn_agent(&agent_spec).await {
                // 6. Spawn the agent
                let spawn_result = self.spawn_agent(&error_context, &agent_spec).await?;
                
                info!("✅ Successfully spawned agent {} for error {}", spawn_result.agent_id, error_context.correlation_id);
                
                // 7. Start monitoring the agent
                self.monitor_agent(spawn_result.clone()).await;
                
                Ok(Some(spawn_result))
            } else {
                warn!("⚠️ Cannot spawn agent - resource constraints");
                Ok(None)
            }
        } else {
            debug!("📝 Error logged but doesn't meet auto-spawn criteria");
            Ok(None)
        }
    }
    
    /// Classify error into category and assess severity
    async fn classify_error(&self, error_message: &str, service_id: &str, metadata: Option<serde_json::Value>) -> Result<ErrorContext> {
        let error_lower = error_message.to_lowercase();
        
        // Pattern matching for error classification
        let (category, severity) = if error_lower.contains("timeout") || error_lower.contains("connection refused") {
            (ErrorCategory::NetworkTimeout, ErrorSeverity::High)
        } else if error_lower.contains("database") || error_lower.contains("sql") || error_lower.contains("connection pool") {
            (ErrorCategory::DatabaseConnection, ErrorSeverity::High)
        } else if error_lower.contains("out of memory") || error_lower.contains("memory leak") {
            (ErrorCategory::MemoryLeak, ErrorSeverity::Critical)
        } else if error_lower.contains("permission denied") || error_lower.contains("unauthorized") {
            (ErrorCategory::PermissionDenied, ErrorSeverity::Medium)
        } else if error_lower.contains("rate limit") || error_lower.contains("too many requests") {
            (ErrorCategory::RateLimit, ErrorSeverity::Medium)
        } else if error_lower.contains("validation failed") || error_lower.contains("invalid") {
            (ErrorCategory::ValidationFailure, ErrorSeverity::Low)
        } else if error_lower.contains("config") || error_lower.contains("configuration") {
            (ErrorCategory::ConfigurationError, ErrorSeverity::Medium)
        } else if error_lower.contains("cache") || error_lower.contains("redis") {
            (ErrorCategory::CacheError, ErrorSeverity::Medium)
        } else if error_lower.contains("security") || error_lower.contains("breach") || error_lower.contains("attack") {
            (ErrorCategory::SecurityBreach, ErrorSeverity::Emergency)
        } else if error_lower.contains("slow") || error_lower.contains("performance") || error_lower.contains("latency") {
            (ErrorCategory::PerformanceDegradation, ErrorSeverity::Medium)
        } else if error_lower.contains("service unavailable") || error_lower.contains("503") {
            (ErrorCategory::ServiceUnavailable, ErrorSeverity::High)
        } else {
            (ErrorCategory::UnknownError, ErrorSeverity::Low)
        };
        
        // Get current system context
        let system_context = self.get_system_context().await;
        
        // Calculate error frequency
        let frequency = self.calculate_error_frequency(error_message, service_id).await;
        
        // Upgrade severity if error is recurring
        let final_severity = if frequency.is_recurring {
            match severity {
                ErrorSeverity::Low => ErrorSeverity::Medium,
                ErrorSeverity::Medium => ErrorSeverity::High,
                ErrorSeverity::High => ErrorSeverity::Critical,
                s => s,
            }
        } else {
            severity
        };
        
        Ok(ErrorContext {
            timestamp: Utc::now(),
            service_id: service_id.to_string(),
            error_category: category,
            severity: final_severity,
            error_message: error_message.to_string(),
            stack_trace: metadata.as_ref()
                .and_then(|m| m.get("stack_trace"))
                .and_then(|st| st.as_str())
                .map(|s| s.to_string()),
            affected_endpoints: metadata.as_ref()
                .and_then(|m| m.get("affected_endpoints"))
                .and_then(|ae| ae.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            system_context,
            correlation_id: uuid::Uuid::new_v4().to_string(),
            frequency,
        })
    }
    
    /// Get current system context for error analysis
    async fn get_system_context(&self) -> SystemErrorContext {
        // In production, this would query actual system metrics
        SystemErrorContext {
            cpu_usage: 45.2,  // Would get from system monitoring
            memory_usage: 68.7, // Would get from system monitoring
            disk_usage: 23.1,   // Would get from system monitoring
            network_latency: 12.5, // Would get from network monitoring
            concurrent_requests: 150, // Would get from active connection count
            recent_deployments: vec![], // Would get from deployment tracking
            active_incidents: vec![], // Would get from incident management
        }
    }
    
    /// Calculate error frequency and detect patterns
    async fn calculate_error_frequency(&self, error_message: &str, service_id: &str) -> ErrorFrequency {
        let pattern_key = format!("{}:{}", service_id, error_message.chars().take(100).collect::<String>());
        
        let mut patterns = self.error_patterns.write().await;
        
        if let Some(existing) = patterns.get_mut(&pattern_key) {
            existing.count_last_minute += 1;
            existing.count_last_hour += 1;
            existing.is_recurring = existing.count_last_hour > 3;
            existing.clone()
        } else {
            let frequency = ErrorFrequency {
                count_last_minute: 1,
                count_last_hour: 1,
                is_recurring: false,
                pattern_detected: None,
            };
            patterns.insert(pattern_key, frequency.clone());
            frequency
        }
    }
    
    /// Determine if agent spawning is warranted
    async fn should_spawn_agent(&self, error_context: &ErrorContext) -> bool {
        // Check severity threshold
        if error_context.severity < self.config.auto_spawn_threshold {
            return false;
        }
        
        // Always spawn for emergency/critical errors
        if error_context.severity >= ErrorSeverity::Critical {
            return true;
        }
        
        // Check if too many agents are already active
        let active_count = self.active_agents.read().await.len();
        if active_count >= self.config.max_concurrent_agents as usize {
            warn!("⚠️ Max concurrent agents ({}) reached", self.config.max_concurrent_agents);
            return false;
        }
        
        // Check if error is recurring
        if error_context.frequency.is_recurring {
            return true;
        }
        
        // Check system stress indicators
        if error_context.system_context.cpu_usage > 80.0 || 
           error_context.system_context.memory_usage > 85.0 {
            return true;
        }
        
        // Default to not spawning for lower severity single occurrences
        false
    }
    
    /// Select optimal agent for the error type
    async fn select_optimal_agent(&self, error_context: &ErrorContext) -> Result<AgentSpecialization> {
        let specializations = self.agent_specializations
            .get(&error_context.error_category)
            .ok_or_else(|| anyhow!("No agents available for error category: {:?}", error_context.error_category))?;
        
        // Select agent with highest success rate for this error type
        let best_agent = specializations.iter()
            .max_by(|a, b| a.success_rate.partial_cmp(&b.success_rate).unwrap())
            .unwrap();
        
        Ok(best_agent.clone())
    }
    
    /// Check if resources are available to spawn agent
    async fn can_spawn_agent(&self, _agent_spec: &AgentSpecialization) -> bool {
        // In production, this would check actual system resources
        let active_count = self.active_agents.read().await.len();
        active_count < self.config.max_concurrent_agents as usize
    }
    
    /// Spawn agent via HRM service
    async fn spawn_agent(&self, error_context: &ErrorContext, agent_spec: &AgentSpecialization) -> Result<AgentSpawnResponse> {
        let spawn_request = AgentSpawnRequest {
            error_context: error_context.clone(),
            requested_agent_type: agent_spec.agent_type.clone(),
            priority: match error_context.severity {
                ErrorSeverity::Emergency => 5,
                ErrorSeverity::Critical => 4,
                ErrorSeverity::High => 3,
                ErrorSeverity::Medium => 2,
                ErrorSeverity::Low => 1,
            },
            max_execution_time: agent_spec.resource_requirements.execution_timeout,
            expected_outcome: format!("Resolve {} error in service {}", error_context.error_category, error_context.service_id),
            rollback_plan: Some("Terminate agent if no progress after 50% of max execution time".to_string()),
        };
        
        // Call HRM service to spawn agent
        let response = tokio::time::timeout(
            std::time::Duration::from_secs(self.config.agent_spawn_timeout as u64),
            self.hrm_client.post(&format!("{}/spawn-agent", self.hrm_base_url))
                .json(&spawn_request)
                .send()
        ).await??;
        
        if response.status().is_success() {
            let spawn_response: AgentSpawnResponse = response.json().await?;
            info!("🎯 Agent {} spawned successfully", spawn_response.agent_id);
            Ok(spawn_response)
        } else {
            Err(anyhow!("Agent spawn request failed with status: {}", response.status()))
        }
    }
    
    /// Monitor spawned agent execution
    async fn monitor_agent(&self, spawn_response: AgentSpawnResponse) {
        let agent_id = spawn_response.agent_id.clone();
        let active_agents = Arc::clone(&self.active_agents);
        let hrm_client = self.hrm_client.clone();
        let hrm_base_url = self.hrm_base_url.clone();
        
        tokio::spawn(async move {
            info!("👁️ Starting monitoring for agent {}", agent_id);
            
            // Initialize agent in active list
            {
                let mut agents = active_agents.write().await;
                agents.insert(agent_id.clone(), AgentExecutionResult {
                    agent_id: agent_id.clone(),
                    status: AgentStatus::Spawning,
                    resolution_actions: vec![],
                    success: false,
                    execution_time: 0,
                    error_resolved: false,
                    lessons_learned: vec![],
                    recommendations: vec![],
                });
            }
            
            // Monitor agent progress
            let mut check_count = 0;
            let max_checks = 60; // Check for up to 10 minutes (every 10 seconds)
            
            while check_count < max_checks {
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                check_count += 1;
                
                // Check agent status
                match hrm_client.get(&format!("{}/agent-status/{}", hrm_base_url, agent_id)).send().await {
                    Ok(response) => {
                        if let Ok(result) = response.json::<AgentExecutionResult>().await {
                            let mut agents = active_agents.write().await;
                            agents.insert(agent_id.clone(), result.clone());
                            
                            if matches!(result.status, AgentStatus::Completed | AgentStatus::Failed | AgentStatus::Terminated) {
                                info!("🏁 Agent {} completed with status: {:?}", agent_id, result.status);
                                break;
                            }
                        }
                    },
                    Err(e) => {
                        warn!("❌ Failed to check agent {} status: {}", agent_id, e);
                    }
                }
            }
            
            info!("👁️ Monitoring ended for agent {}", agent_id);
        });
    }
    
    /// Get status of all active agents
    pub async fn get_active_agents(&self) -> HashMap<String, AgentExecutionResult> {
        self.active_agents.read().await.clone()
    }
    
    /// Get error pattern statistics
    pub async fn get_error_patterns(&self) -> HashMap<String, ErrorFrequency> {
        self.error_patterns.read().await.clone()
    }
    
    /// Update error patterns for learning
    async fn update_error_patterns(&mut self, _error_context: &ErrorContext) {
        if self.config.enable_learning {
            // This would implement more sophisticated pattern learning
            debug!("📈 Updated error patterns for learning");
        }
    }
}

// Helper trait for duration conversion
trait DurationExt {
    fn to_std(&self) -> Result<std::time::Duration>;
}

impl DurationExt for chrono::Duration {
    fn to_std(&self) -> Result<std::time::Duration> {
        self.to_std().map_err(|e| anyhow!("Duration conversion error: {}", e))
    }
}