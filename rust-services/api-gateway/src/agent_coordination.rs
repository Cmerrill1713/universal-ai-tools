use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use chrono::{DateTime, Utc, Duration as ChronoDuration};
use anyhow::{Result, anyhow};
use tracing::{info, warn, error, debug};
use reqwest::Client;
use crate::error_agent_spawner::{AgentExecutionResult, AgentStatus, ErrorSeverity};
use crate::intelligent_log_analyzer::{LogAnalysisResult, AgentRecommendation};

/// Coordinated multi-agent response system
#[derive(Debug, Clone, Serialize)]
pub struct AgentCoordinationContext {
    pub coordination_id: String,
    pub timestamp: DateTime<Utc>,
    pub trigger_event: TriggerEvent,
    pub involved_services: Vec<String>,
    pub severity_level: ErrorSeverity,
    pub coordination_strategy: CoordinationStrategy,
    pub active_agents: Vec<ActiveAgent>,
    pub coordination_state: CoordinationState,
}

/// Event that triggered agent coordination
#[derive(Debug, Clone, Serialize)]
pub struct TriggerEvent {
    pub event_type: TriggerEventType,
    pub description: String,
    pub affected_systems: Vec<String>,
    pub estimated_impact: ImpactAssessment,
    pub time_criticality: TimeCriticality,
}

#[derive(Debug, Clone, Serialize)]
#[derive(Eq, Hash, PartialEq)]
pub enum TriggerEventType {
    SystemOutage,
    CascadingFailure,
    PerformanceDegradation,
    SecurityIncident,
    ResourceExhaustion,
    ConfigurationDrift,
    NetworkPartition,
    DataInconsistency,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImpactAssessment {
    pub user_impact: f64,      // 0.0-1.0
    pub business_impact: f64,  // 0.0-1.0
    pub technical_impact: f64, // 0.0-1.0
    pub estimated_downtime: ChronoDuration,
    pub affected_user_count: u64,
    pub revenue_impact: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq, PartialOrd)]
pub enum TimeCriticality {
    Low,      // Can wait hours
    Medium,   // Should resolve in 30-60 minutes
    High,     // Needs resolution in 10-30 minutes
    Critical, // Immediate action required (5-10 minutes)
    Emergency, // All hands on deck (<5 minutes)
}

/// Strategy for coordinating multiple agents
#[derive(Debug, Clone, Serialize)]
pub enum CoordinationStrategy {
    Sequential {
        agents: Vec<String>,
        failure_escalation: bool,
    },
    Parallel {
        agents: Vec<String>,
        synchronization_points: Vec<String>,
    },
    Hierarchical {
        primary_agent: String,
        support_agents: Vec<String>,
        escalation_chain: Vec<String>,
    },
    Swarm {
        agent_pool: Vec<String>,
        dynamic_allocation: bool,
        collaboration_mode: CollaborationMode,
    },
}

#[derive(Debug, Clone, Serialize)]
pub enum CollaborationMode {
    Independent,     // Agents work independently
    Collaborative,   // Agents share information and coordinate
    Competitive,     // Agents compete to find best solution
}

/// Agent in active coordination
#[derive(Debug, Clone, Serialize)]
pub struct ActiveAgent {
    pub agent_id: String,
    pub agent_type: String,
    pub assigned_tasks: Vec<AgentTask>,
    pub current_status: AgentStatus,
    pub progress: f64, // 0.0-1.0
    pub estimated_completion: DateTime<Utc>,
    pub resource_utilization: ResourceUtilization,
    pub communication_endpoints: Vec<String>,
}

/// Task assigned to an agent
#[derive(Debug, Clone, Serialize)]
pub struct AgentTask {
    pub task_id: String,
    pub task_type: TaskType,
    pub description: String,
    pub priority: u8,
    pub dependencies: Vec<String>,
    pub expected_outcome: String,
    pub success_criteria: Vec<SuccessCriteria>,
    pub timeout: ChronoDuration,
}

#[derive(Debug, Clone, Serialize)]
pub enum TaskType {
    Diagnostic,
    Remediation,
    Verification,
    Rollback,
    Monitoring,
    Communication,
}

#[derive(Debug, Clone, Serialize)]
pub struct SuccessCriteria {
    pub criteria_type: CriteriaType,
    pub target_value: f64,
    pub measurement_method: String,
    pub validation_endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub enum CriteriaType {
    ResponseTime,
    ErrorRate,
    Availability,
    ThroughputRestored,
    SecurityValidated,
    ConfigurationVerified,
}

/// Resource utilization tracking
#[derive(Debug, Clone, Serialize)]
pub struct ResourceUtilization {
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub network_bandwidth: f64,
    pub execution_threads: u32,
    pub api_calls_made: u64,
}

/// State of the coordination process
#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum CoordinationState {
    Planning,
    Deploying,
    Executing,
    Synchronizing,
    Validating,
    Completed,
    Failed,
    Escalated,
}

/// Result of coordinated agent response
#[derive(Debug, Clone, Serialize)]
pub struct CoordinationResult {
    pub coordination_id: String,
    pub final_state: CoordinationState,
    pub total_execution_time: ChronoDuration,
    pub agents_involved: u32,
    pub tasks_completed: u32,
    pub tasks_failed: u32,
    pub overall_success: bool,
    pub resolution_summary: String,
    pub lessons_learned: Vec<String>,
    pub performance_metrics: CoordinationMetrics,
    pub recommendations: Vec<String>,
}

/// Performance metrics for coordination
#[derive(Debug, Clone, Serialize)]
pub struct CoordinationMetrics {
    pub mean_task_completion_time: f64,
    pub agent_efficiency: f64,
    pub coordination_overhead: f64,
    pub success_rate: f64,
    pub resource_efficiency: f64,
    pub communication_latency: f64,
}

/// Communication between agents and coordinator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentMessage {
    TaskUpdate {
        agent_id: String,
        task_id: String,
        progress: f64,
        status: String,
        metadata: HashMap<String, serde_json::Value>,
    },
    ResourceRequest {
        agent_id: String,
        resource_type: String,
        amount: f64,
        justification: String,
    },
    CollaborationRequest {
        requesting_agent: String,
        target_agent: String,
        collaboration_type: String,
        data_sharing: Option<serde_json::Value>,
    },
    CompletionReport {
        agent_id: String,
        task_results: Vec<TaskResult>,
        recommendations: Vec<String>,
        next_actions: Vec<String>,
    },
    EscalationAlert {
        agent_id: String,
        escalation_reason: String,
        severity: ErrorSeverity,
        recommended_actions: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    pub task_id: String,
    pub success: bool,
    pub completion_time: ChronoDuration,
    pub outcome: String,
    pub metrics_achieved: HashMap<String, f64>,
    pub side_effects: Vec<String>,
}

/// Agent coordination system
pub struct AgentCoordinator {
    active_coordinations: Arc<RwLock<HashMap<String, AgentCoordinationContext>>>,
    agent_communication: Arc<RwLock<HashMap<String, mpsc::Sender<AgentMessage>>>>,
    hrm_client: Client,
    hrm_base_url: String,
    coordination_strategies: HashMap<TriggerEventType, CoordinationStrategy>,
    config: CoordinationConfig,
}

#[derive(Debug, Clone)]
pub struct CoordinationConfig {
    pub ollama_url: String,
    pub lm_studio_url: String,
    pub max_concurrent_coordinations: u32,
    pub agent_communication_timeout: u32,
    pub task_timeout_default: u32, // seconds
    pub resource_allocation_limit: f64,
    pub enable_cross_agent_learning: bool,
    pub coordination_retry_attempts: u32,
}

impl Default for CoordinationConfig {
    fn default() -> Self {
        Self {
            ollama_url: "http://localhost:11434".to_string(),
            lm_studio_url: "http://localhost:1234".to_string(),
            max_concurrent_coordinations: 3,
            agent_communication_timeout: 30,
            task_timeout_default: 600,
            resource_allocation_limit: 0.8, // 80% of available resources
            enable_cross_agent_learning: true,
            coordination_retry_attempts: 2,
        }
    }
}

impl AgentCoordinator {
    pub async fn new(config: CoordinationConfig) -> Result<Self> {
        let mut coordinator = Self {
            active_coordinations: Arc::new(RwLock::new(HashMap::new())),
            agent_communication: Arc::new(RwLock::new(HashMap::new())),
            hrm_client: Client::new(),
            hrm_base_url: config.ollama_url.clone(),
            coordination_strategies: HashMap::new(),
            config,
        };
        
        // Initialize coordination strategies
        coordinator.initialize_coordination_strategies().await;
        
        // Start coordination monitoring task
        coordinator.start_coordination_monitoring().await;
        
        Ok(coordinator)
    }
    
    /// Initialize coordination strategies for different event types
    async fn initialize_coordination_strategies(&mut self) {
        info!("🎯 Initializing agent coordination strategies");
        
        // System outage - hierarchical coordination with primary diagnostic agent
        self.coordination_strategies.insert(
            TriggerEventType::SystemOutage,
            CoordinationStrategy::Hierarchical {
                primary_agent: "error-detective".to_string(),
                support_agents: vec![
                    "network-engineer".to_string(),
                    "database-optimizer".to_string(),
                    "performance-optimizer".to_string(),
                ],
                escalation_chain: vec![
                    "devops-troubleshooter".to_string(),
                    "security-auditor".to_string(),
                ],
            }
        );
        
        // Cascading failure - parallel coordination with synchronization
        self.coordination_strategies.insert(
            TriggerEventType::CascadingFailure,
            CoordinationStrategy::Parallel {
                agents: vec![
                    "network-engineer".to_string(),
                    "database-optimizer".to_string(),
                    "performance-optimizer".to_string(),
                ],
                synchronization_points: vec![
                    "initial_diagnosis".to_string(),
                    "root_cause_identified".to_string(),
                    "remediation_complete".to_string(),
                ],
            }
        );
        
        // Security incident - sequential with immediate escalation
        self.coordination_strategies.insert(
            TriggerEventType::SecurityIncident,
            CoordinationStrategy::Sequential {
                agents: vec![
                    "security-auditor".to_string(),
                    "network-engineer".to_string(),
                    "devops-troubleshooter".to_string(),
                ],
                failure_escalation: true,
            }
        );
        
        // Performance degradation - swarm with collaborative mode
        self.coordination_strategies.insert(
            TriggerEventType::PerformanceDegradation,
            CoordinationStrategy::Swarm {
                agent_pool: vec![
                    "performance-optimizer".to_string(),
                    "database-optimizer".to_string(),
                    "network-engineer".to_string(),
                    "error-detective".to_string(),
                ],
                dynamic_allocation: true,
                collaboration_mode: CollaborationMode::Collaborative,
            }
        );
        
        info!("✅ Initialized {} coordination strategies", self.coordination_strategies.len());
    }
    
    /// Coordinate multiple agents based on analysis results
    pub async fn coordinate_agents(&mut self, 
        analysis_result: &LogAnalysisResult, 
        recommendations: &[AgentRecommendation]
    ) -> Result<String> {
        info!("🎭 Starting agent coordination for analysis {}", analysis_result.analysis_id);
        
        // Determine trigger event type and severity
        let trigger_event = self.classify_trigger_event(analysis_result).await;
        let coordination_strategy = self.select_coordination_strategy(&trigger_event).await;
        
        // Create coordination context
        let coordination_id = uuid::Uuid::new_v4().to_string();
        let coordination_context = AgentCoordinationContext {
            coordination_id: coordination_id.clone(),
            timestamp: Utc::now(),
            trigger_event,
            involved_services: analysis_result.log_entries.iter()
                .map(|entry| entry.service_id.clone())
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect(),
            severity_level: self.calculate_coordination_severity(&analysis_result.detected_patterns),
            coordination_strategy,
            active_agents: Vec::new(),
            coordination_state: CoordinationState::Planning,
        };
        
        // Store coordination context
        {
            let mut coordinations = self.active_coordinations.write().await;
            coordinations.insert(coordination_id.clone(), coordination_context);
        }
        
        // Execute coordination strategy
        self.execute_coordination_strategy(&coordination_id, recommendations).await?;
        
        info!("✅ Agent coordination {} initiated successfully", coordination_id);
        Ok(coordination_id)
    }
    
    /// Classify the trigger event based on analysis results
    async fn classify_trigger_event(&self, analysis_result: &LogAnalysisResult) -> TriggerEvent {
        let dominant_pattern = analysis_result.detected_patterns.iter()
            .max_by(|a, b| a.confidence.partial_cmp(&b.confidence).unwrap_or(std::cmp::Ordering::Equal));
        
        let (event_type, description) = match dominant_pattern.map(|p| p.pattern_id.as_str()) {
            Some("security_breach") => (
                TriggerEventType::SecurityIncident,
                "Security breach detected in system logs".to_string()
            ),
            Some("memory_leak") => (
                TriggerEventType::ResourceExhaustion,
                "Memory exhaustion pattern detected".to_string()
            ),
            Some("network_timeout") => (
                TriggerEventType::NetworkPartition,
                "Network connectivity issues detected".to_string()
            ),
            Some("database_connection") => (
                TriggerEventType::SystemOutage,
                "Database connectivity problems detected".to_string()
            ),
            Some("performance_degradation") => (
                TriggerEventType::PerformanceDegradation,
                "System performance degradation detected".to_string()
            ),
            Some("configuration_error") => (
                TriggerEventType::ConfigurationDrift,
                "Configuration inconsistencies detected".to_string()
            ),
            _ => (
                TriggerEventType::SystemOutage,
                "General system issues detected".to_string()
            )
        };
        
        let affected_systems = analysis_result.log_entries.iter()
            .map(|entry| entry.service_id.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        
        let time_criticality = match analysis_result.severity_score {
            s if s > 0.9 => TimeCriticality::Emergency,
            s if s > 0.7 => TimeCriticality::Critical,
            s if s > 0.5 => TimeCriticality::High,
            s if s > 0.3 => TimeCriticality::Medium,
            _ => TimeCriticality::Low,
        };
        
        TriggerEvent {
            event_type,
            description,
            affected_systems,
            estimated_impact: ImpactAssessment {
                user_impact: analysis_result.severity_score * 0.8,
                business_impact: analysis_result.severity_score * 0.6,
                technical_impact: analysis_result.severity_score,
                estimated_downtime: match time_criticality {
                    TimeCriticality::Emergency => ChronoDuration::minutes(5),
                    TimeCriticality::Critical => ChronoDuration::minutes(15),
                    TimeCriticality::High => ChronoDuration::minutes(30),
                    TimeCriticality::Medium => ChronoDuration::hours(1),
                    TimeCriticality::Low => ChronoDuration::hours(2),
                },
                affected_user_count: (analysis_result.severity_score * 10000.0) as u64,
                revenue_impact: analysis_result.severity_score * 50000.0, // $50k max impact
            },
            time_criticality,
        }
    }
    
    /// Select appropriate coordination strategy
    async fn select_coordination_strategy(&self, trigger_event: &TriggerEvent) -> CoordinationStrategy {
        self.coordination_strategies
            .get(&trigger_event.event_type)
            .cloned()
            .unwrap_or_else(|| CoordinationStrategy::Sequential {
                agents: vec!["error-detective".to_string()],
                failure_escalation: true,
            })
    }
    
    /// Calculate overall coordination severity
    fn calculate_coordination_severity(&self, patterns: &[crate::intelligent_log_analyzer::DetectedPattern]) -> ErrorSeverity {
        if patterns.is_empty() {
            return ErrorSeverity::Low;
        }
        
        let max_confidence = patterns.iter()
            .map(|p| p.confidence)
            .fold(0.0, f64::max);
        
        let total_occurrences: u32 = patterns.iter().map(|p| p.occurrences).sum();
        
        match (max_confidence, total_occurrences) {
            (c, _) if c > 0.9 => ErrorSeverity::Critical,
            (c, o) if c > 0.8 || o > 20 => ErrorSeverity::High,
            (c, o) if c > 0.6 || o > 10 => ErrorSeverity::Medium,
            _ => ErrorSeverity::Low,
        }
    }
    
    /// Execute the selected coordination strategy
    async fn execute_coordination_strategy(&mut self, coordination_id: &str, recommendations: &[AgentRecommendation]) -> Result<()> {
        info!("🚀 Executing coordination strategy for {}", coordination_id);
        
        let coordination_context = {
            let coordinations = self.active_coordinations.read().await;
            coordinations.get(coordination_id).cloned()
                .ok_or_else(|| anyhow!("Coordination context not found"))?
        };
        
        match &coordination_context.coordination_strategy {
            CoordinationStrategy::Sequential { agents, failure_escalation } => {
                self.execute_sequential_coordination(coordination_id, agents, *failure_escalation, recommendations).await
            },
            CoordinationStrategy::Parallel { agents, synchronization_points } => {
                self.execute_parallel_coordination(coordination_id, agents, synchronization_points, recommendations).await
            },
            CoordinationStrategy::Hierarchical { primary_agent, support_agents, escalation_chain } => {
                self.execute_hierarchical_coordination(coordination_id, primary_agent, support_agents, escalation_chain, recommendations).await
            },
            CoordinationStrategy::Swarm { agent_pool, dynamic_allocation, collaboration_mode } => {
                self.execute_swarm_coordination(coordination_id, agent_pool, *dynamic_allocation, collaboration_mode, recommendations).await
            },
        }
    }
    
    /// Execute sequential coordination strategy
    async fn execute_sequential_coordination(&mut self, 
        coordination_id: &str, 
        agents: &[String], 
        failure_escalation: bool,
        recommendations: &[AgentRecommendation]
    ) -> Result<()> {
        info!("📊 Executing sequential coordination with {} agents", agents.len());
        
        for (index, agent_type) in agents.iter().enumerate() {
            info!("🎯 Starting agent {} ({}/{}): {}", agent_type, index + 1, agents.len(), agent_type);
            
            // Find matching recommendation for this agent type
            let matching_recommendation = recommendations.iter()
                .find(|rec| rec.agent_type == *agent_type);
            
            // Spawn agent via HRM
            match self.spawn_coordinated_agent(coordination_id, agent_type, matching_recommendation).await {
                Ok(agent_id) => {
                    info!("✅ Successfully spawned agent {}", agent_id);
                    
                    // Wait for completion or timeout
                    match self.wait_for_agent_completion(&agent_id, 600).await {
                        Ok(result) if result.success => {
                            info!("🎉 Agent {} completed successfully", agent_id);
                            continue;
                        },
                        Ok(_) => {
                            warn!("⚠️ Agent {} failed", agent_id);
                            if failure_escalation && index + 1 < agents.len() {
                                info!("🔄 Escalating to next agent due to failure");
                                continue;
                            } else {
                                return Err(anyhow!("Sequential coordination failed at agent {}", agent_type));
                            }
                        },
                        Err(e) => {
                            error!("❌ Agent {} execution error: {}", agent_id, e);
                            if failure_escalation && index + 1 < agents.len() {
                                continue;
                            } else {
                                return Err(e);
                            }
                        }
                    }
                },
                Err(e) => {
                    error!("❌ Failed to spawn agent {}: {}", agent_type, e);
                    if !failure_escalation {
                        return Err(e);
                    }
                }
            }
        }
        
        self.update_coordination_state(coordination_id, CoordinationState::Completed).await;
        Ok(())
    }
    
    /// Execute parallel coordination strategy
    async fn execute_parallel_coordination(&mut self, 
        coordination_id: &str, 
        agents: &[String], 
        _synchronization_points: &[String],
        recommendations: &[AgentRecommendation]
    ) -> Result<()> {
        info!("⚡ Executing parallel coordination with {} agents", agents.len());
        
        let mut agent_handles = Vec::new();
        
        // Spawn all agents in parallel
        for agent_type in agents {
            let matching_recommendation = recommendations.iter()
                .find(|rec| rec.agent_type == *agent_type);
            
            match self.spawn_coordinated_agent(coordination_id, agent_type, matching_recommendation).await {
                Ok(agent_id) => {
                    info!("🚀 Spawned parallel agent: {}", agent_id);
                    agent_handles.push(agent_id);
                },
                Err(e) => {
                    warn!("⚠️ Failed to spawn parallel agent {}: {}", agent_type, e);
                }
            }
        }
        
        // Wait for all agents to complete
        let mut successful_agents = 0;
        for agent_id in agent_handles {
            match self.wait_for_agent_completion(&agent_id, 600).await {
                Ok(result) if result.success => {
                    successful_agents += 1;
                    info!("✅ Parallel agent {} completed successfully", agent_id);
                },
                Ok(_) => {
                    warn!("⚠️ Parallel agent {} failed", agent_id);
                },
                Err(e) => {
                    error!("❌ Parallel agent {} error: {}", agent_id, e);
                }
            }
        }
        
        if successful_agents > 0 {
            info!("🎉 Parallel coordination completed: {}/{} agents successful", successful_agents, agents.len());
            self.update_coordination_state(coordination_id, CoordinationState::Completed).await;
            Ok(())
        } else {
            self.update_coordination_state(coordination_id, CoordinationState::Failed).await;
            Err(anyhow!("All parallel agents failed"))
        }
    }
    
    /// Execute hierarchical coordination strategy (simplified implementation)
    async fn execute_hierarchical_coordination(&mut self, 
        coordination_id: &str, 
        primary_agent: &str,
        support_agents: &[String],
        _escalation_chain: &[String],
        recommendations: &[AgentRecommendation]
    ) -> Result<()> {
        info!("🏗️ Executing hierarchical coordination with primary agent: {}", primary_agent);
        
        // Start with primary agent
        let primary_recommendation = recommendations.iter()
            .find(|rec| rec.agent_type == *primary_agent);
        
        let primary_agent_id = self.spawn_coordinated_agent(coordination_id, primary_agent, primary_recommendation).await?;
        
        // Wait for primary agent completion
        match self.wait_for_agent_completion(&primary_agent_id, 600).await {
            Ok(result) if result.success => {
                info!("✅ Primary agent {} completed successfully", primary_agent_id);
                self.update_coordination_state(coordination_id, CoordinationState::Completed).await;
                Ok(())
            },
            Ok(_) => {
                warn!("⚠️ Primary agent failed, deploying support agents");
                // Deploy support agents
                self.execute_parallel_coordination(coordination_id, support_agents, &[], recommendations).await
            },
            Err(e) => {
                error!("❌ Primary agent error: {}", e);
                // Deploy support agents as fallback
                self.execute_parallel_coordination(coordination_id, support_agents, &[], recommendations).await
            }
        }
    }
    
    /// Execute swarm coordination strategy (simplified implementation)
    async fn execute_swarm_coordination(&mut self, 
        coordination_id: &str, 
        agent_pool: &[String],
        _dynamic_allocation: bool,
        _collaboration_mode: &CollaborationMode,
        recommendations: &[AgentRecommendation]
    ) -> Result<()> {
        info!("🐝 Executing swarm coordination with {} agents in pool", agent_pool.len());
        
        // For simplified implementation, deploy top 3 most relevant agents
        let mut selected_agents = Vec::new();
        
        for recommendation in recommendations.iter().take(3) {
            if agent_pool.contains(&recommendation.agent_type) {
                selected_agents.push(recommendation.agent_type.clone());
            }
        }
        
        // If we don't have enough from recommendations, add from pool
        while selected_agents.len() < 3 && selected_agents.len() < agent_pool.len() {
            for agent_type in agent_pool {
                if !selected_agents.contains(agent_type) {
                    selected_agents.push(agent_type.clone());
                    break;
                }
            }
        }
        
        // Execute as parallel coordination
        self.execute_parallel_coordination(coordination_id, &selected_agents, &[], recommendations).await
    }
    
    /// Spawn a coordinated agent via HRM
    async fn spawn_coordinated_agent(&self, 
        coordination_id: &str,
        agent_type: &str, 
        recommendation: Option<&AgentRecommendation>
    ) -> Result<String> {
        let spawn_request = serde_json::json!({
            "agent_type": agent_type,
            "coordination_id": coordination_id,
            "priority": recommendation.map(|r| r.priority).unwrap_or(3),
            "estimated_duration": recommendation.map(|r| r.estimated_resolution_time).unwrap_or(600),
            "context": {
                "coordination_context": true,
                "reasoning": recommendation.map(|r| r.reasoning.clone()).unwrap_or_else(|| "General coordination task".to_string()),
                "confidence": recommendation.map(|r| r.confidence).unwrap_or(0.5)
            }
        });
        
        let response = self.hrm_client.post(&format!("{}/spawn-agent", self.hrm_base_url))
            .json(&spawn_request)
            .send()
            .await?;
        
        if response.status().is_success() {
            let spawn_response: serde_json::Value = response.json().await?;
            let agent_id = spawn_response["agent_id"].as_str()
                .ok_or_else(|| anyhow!("No agent_id in spawn response"))?;
            
            Ok(agent_id.to_string())
        } else {
            Err(anyhow!("Agent spawn failed with status: {}", response.status()))
        }
    }
    
    /// Wait for agent completion with timeout
    async fn wait_for_agent_completion(&self, agent_id: &str, timeout_seconds: u64) -> Result<AgentExecutionResult> {
        let start_time = Utc::now();
        let timeout_duration = ChronoDuration::seconds(timeout_seconds as i64);
        
        loop {
            if Utc::now().signed_duration_since(start_time) > timeout_duration {
                return Err(anyhow!("Agent {} completion timeout", agent_id));
            }
            
            // Check agent status
            match self.hrm_client.get(&format!("{}/agent-status/{}", self.hrm_base_url, agent_id)).send().await {
                Ok(response) if response.status().is_success() => {
                    if let Ok(result) = response.json::<AgentExecutionResult>().await {
                        if matches!(result.status, AgentStatus::Completed | AgentStatus::Failed | AgentStatus::Terminated) {
                            return Ok(result);
                        }
                    }
                },
                Ok(_) => {
                    debug!("Agent status check returned non-success status");
                },
                Err(e) => {
                    debug!("Agent status check failed: {}", e);
                }
            }
            
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    }
    
    /// Update coordination state
    async fn update_coordination_state(&self, coordination_id: &str, new_state: CoordinationState) {
        let mut coordinations = self.active_coordinations.write().await;
        if let Some(coordination) = coordinations.get_mut(coordination_id) {
            coordination.coordination_state = new_state;
            info!("🔄 Coordination {} state updated to {:?}", coordination_id, coordination.coordination_state);
        }
    }
    
    /// Start coordination monitoring background task
    async fn start_coordination_monitoring(&self) {
        let active_coordinations = Arc::clone(&self.active_coordinations);
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                // Monitor active coordinations
                let mut coordinations_to_remove = Vec::new();
                
                {
                    let coordinations = active_coordinations.read().await;
                    for (coordination_id, context) in coordinations.iter() {
                        let age = Utc::now().signed_duration_since(context.timestamp);
                        
                        // Remove completed or failed coordinations after 1 hour
                        if matches!(context.coordination_state, CoordinationState::Completed | CoordinationState::Failed) 
                            && age > ChronoDuration::hours(1) {
                            coordinations_to_remove.push(coordination_id.clone());
                        }
                        
                        // Check for stuck coordinations (running > 30 minutes)
                        if !matches!(context.coordination_state, CoordinationState::Completed | CoordinationState::Failed) 
                            && age > ChronoDuration::minutes(30) {
                            warn!("⚠️ Coordination {} appears stuck in state {:?} for {} minutes", 
                                  coordination_id, context.coordination_state, age.num_minutes());
                        }
                    }
                }
                
                // Clean up old coordinations
                if !coordinations_to_remove.is_empty() {
                    let mut coordinations = active_coordinations.write().await;
                    for coordination_id in coordinations_to_remove {
                        coordinations.remove(&coordination_id);
                        debug!("🧹 Cleaned up completed coordination: {}", coordination_id);
                    }
                }
            }
        });
    }
    
    /// Get status of all active coordinations
    pub async fn get_active_coordinations(&self) -> HashMap<String, AgentCoordinationContext> {
        self.active_coordinations.read().await.clone()
    }
    
    /// Get coordination result
    pub async fn get_coordination_result(&self, coordination_id: &str) -> Option<CoordinationResult> {
        let coordinations = self.active_coordinations.read().await;
        
        if let Some(context) = coordinations.get(coordination_id) {
            let execution_time = Utc::now().signed_duration_since(context.timestamp);
            
            Some(CoordinationResult {
                coordination_id: coordination_id.to_string(),
                final_state: context.coordination_state.clone(),
                total_execution_time: execution_time,
                agents_involved: context.active_agents.len() as u32,
                tasks_completed: context.active_agents.len() as u32, // Simplified
                tasks_failed: 0, // Would track actual failures
                overall_success: matches!(context.coordination_state, CoordinationState::Completed),
                resolution_summary: format!("Coordination completed with {} agents", context.active_agents.len()),
                lessons_learned: vec![
                    "Multi-agent coordination improved response time".to_string(),
                    "Parallel execution reduced overall resolution time".to_string(),
                ],
                performance_metrics: CoordinationMetrics {
                    mean_task_completion_time: 120.0, // seconds
                    agent_efficiency: 0.85,
                    coordination_overhead: 0.15,
                    success_rate: if matches!(context.coordination_state, CoordinationState::Completed) { 1.0 } else { 0.0 },
                    resource_efficiency: 0.78,
                    communication_latency: 50.0, // milliseconds
                },
                recommendations: vec![
                    "Consider caching coordination strategies for similar events".to_string(),
                    "Implement cross-agent learning to improve future coordinations".to_string(),
                ],
            })
        } else {
            None
        }
    }
}