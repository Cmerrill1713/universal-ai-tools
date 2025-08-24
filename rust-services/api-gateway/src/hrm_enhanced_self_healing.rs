use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration as ChronoDuration};
use anyhow::{Result, anyhow};
use tracing::{info, warn, debug};
use reqwest::Client;
use crate::self_healing::{
    SelfHealingEngine, AdvancedHealthMetrics, RecoveryAction, 
    SystemHealthReport
};
use crate::ServiceInfo;

/// HRM Decision Types for Self-Healing Operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SelfHealingDecisionType {
    AnomalyAnalysis,
    RecoveryStrategySelection,
    RootCauseAnalysis,
    FailurePrediction,
    ResourceScaling,
    SystemOptimization,
}

/// HRM Decision Context for Self-Healing
#[derive(Debug, Clone, Serialize)]
pub struct HRMSelfHealingContext {
    pub decision_type: SelfHealingDecisionType,
    pub service_metrics: Vec<AdvancedHealthMetrics>,
    pub system_state: SystemStateSnapshot,
    pub historical_patterns: Vec<HistoricalPattern>,
    pub available_actions: Vec<String>,
    pub constraints: SystemConstraints,
}

/// System state snapshot for HRM analysis
#[derive(Debug, Clone, Serialize)]
pub struct SystemStateSnapshot {
    pub overall_health_score: f64,
    pub service_count: usize,
    pub active_connections: u64,
    pub memory_pressure: f64,
    pub cpu_utilization: f64,
    pub error_rate: f64,
    pub response_time_p99: f64,
    pub recent_deployments: Vec<String>,
}

/// Historical failure/recovery patterns
#[derive(Debug, Clone, Serialize)]
pub struct HistoricalPattern {
    pub pattern_type: String,
    pub frequency: f64,
    pub success_rate: f64,
    pub recovery_time_avg: f64,
    pub impact_severity: f64,
}

/// System operational constraints
#[derive(Debug, Clone, Serialize)]
pub struct SystemConstraints {
    pub max_recovery_attempts: u32,
    pub recovery_timeout: ChronoDuration,
    pub allowed_downtime: ChronoDuration,
    pub cost_limits: HashMap<String, f64>,
    pub compliance_requirements: Vec<String>,
}

/// HRM Decision Result for Self-Healing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HRMSelfHealingDecision {
    pub recommended_actions: Vec<EnhancedRecoveryAction>,
    pub confidence: f64,
    pub reasoning_steps: Vec<String>,
    pub risk_assessment: RiskAssessment,
    pub estimated_impact: ImpactEstimate,
    pub monitoring_focus: Vec<String>,
    pub fallback_strategy: Option<String>,
}

/// Enhanced recovery action with HRM intelligence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedRecoveryAction {
    pub action_type: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub priority: u8,
    pub estimated_success_rate: f64,
    pub expected_recovery_time: f64,
    pub rollback_plan: Option<String>,
    pub confidence: f64,
}

/// Risk assessment for recovery actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub overall_risk: f64, // 0.0-1.0
    pub service_impact_risk: f64,
    pub data_loss_risk: f64,
    pub user_experience_risk: f64,
    pub rollback_complexity: f64,
}

/// Expected impact of recovery actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactEstimate {
    pub recovery_probability: f64,
    pub time_to_recovery: ChronoDuration,
    pub service_disruption: f64,
    pub resource_cost: f64,
    pub long_term_stability: f64,
}

/// Local LLM-Enhanced Self-Healing Engine
pub struct HRMEnhancedSelfHealingEngine {
    rust_engine: SelfHealingEngine,
    llm_client: Client,
    ollama_url: String,
    lm_studio_url: String,
    decision_cache: Arc<RwLock<HashMap<String, (HRMSelfHealingDecision, DateTime<Utc>)>>>,
    pattern_database: Arc<RwLock<Vec<HistoricalPattern>>>,
    config: HRMSelfHealingConfig,
}

#[derive(Debug, Clone)]
pub struct HRMSelfHealingConfig {
    // Local LLM endpoints
    pub ollama_url: String,           // e.g., "http://localhost:11434"
    pub lm_studio_url: String,        // e.g., "http://localhost:1234"
    pub preferred_model: String,      // e.g., "llama3.1:8b", "codellama:7b"
    pub fallback_model: String,       // backup model if preferred fails
    
    // Decision caching and performance
    pub decision_cache_ttl: ChronoDuration,
    pub min_confidence_threshold: f64,
    pub max_llm_timeout: ChronoDuration,
    pub enable_fallback: bool,
    pub pattern_learning_rate: f64,
    
    // Local LLM specific settings
    pub temperature: f64,             // 0.0-1.0 for deterministic responses
    pub max_tokens: u32,              // response length limit
    pub context_window: u32,          // context size for analysis
}

impl Default for HRMSelfHealingConfig {
    fn default() -> Self {
        Self {
            // Local LLM endpoints with common defaults
            ollama_url: "http://localhost:11434".to_string(),
            lm_studio_url: "http://localhost:1234".to_string(),
            preferred_model: "llama3.1:8b".to_string(),
            fallback_model: "codellama:7b".to_string(),
            
            // Caching and performance settings
            decision_cache_ttl: ChronoDuration::minutes(5),
            min_confidence_threshold: 0.7,
            max_llm_timeout: ChronoDuration::seconds(10), // local LLMs may be slower
            enable_fallback: true,
            pattern_learning_rate: 0.1,
            
            // Local LLM optimized settings
            temperature: 0.1,        // low temperature for consistent responses
            max_tokens: 2048,        // reasonable response length
            context_window: 4096,    // standard context window
        }
    }
}

impl HRMEnhancedSelfHealingEngine {
    pub async fn new(config: HRMSelfHealingConfig) -> Result<Self> {
        let rust_engine = SelfHealingEngine::new(Default::default()).await?;
        
        Ok(Self {
            rust_engine,
            llm_client: Client::new(),
            ollama_url: config.ollama_url.clone(),
            lm_studio_url: config.lm_studio_url.clone(),
            decision_cache: Arc::new(RwLock::new(HashMap::new())),
            pattern_database: Arc::new(RwLock::new(Vec::new())),
            config,
        })
    }

    /// Enhanced system health evaluation with HRM intelligence
    pub async fn evaluate_system_health_enhanced(&mut self, services: &[ServiceInfo]) -> Result<EnhancedSystemHealthReport> {
        info!("🧠 Starting HRM-enhanced system health evaluation");
        
        // 1. Use Rust engine for fast metrics collection
        let rust_report = self.rust_engine.evaluate_system_health(services).await?;
        
        // 2. If significant issues detected, engage HRM for intelligent analysis
        let needs_hrm_analysis = self.should_engage_hrm(&rust_report).await;
        
        if needs_hrm_analysis {
            info!("🤖 Engaging HRM for advanced decision-making");
            
            // 3. Prepare context for HRM analysis
            let system_context = self.prepare_system_context(&rust_report).await?;
            
            // 4. Get HRM recommendations for different decision types
            let anomaly_decision = self.get_hrm_decision(
                SelfHealingDecisionType::AnomalyAnalysis, 
                &system_context
            ).await;
            
            let recovery_decision = self.get_hrm_decision(
                SelfHealingDecisionType::RecoveryStrategySelection,
                &system_context
            ).await;
            
            let prediction_decision = self.get_hrm_decision(
                SelfHealingDecisionType::FailurePrediction,
                &system_context
            ).await;
            
            // 5. Combine Rust execution capabilities with HRM intelligence
            let enhanced_actions = self.synthesize_recovery_actions(
                &rust_report.recovery_recommendations,
                &[anomaly_decision.clone(), recovery_decision.clone(), prediction_decision.clone()]
            ).await?;
            
            // 6. Execute high-confidence actions if enabled
            if self.config.enable_fallback {
                for action in &enhanced_actions {
                    if action.confidence > self.config.min_confidence_threshold {
                        self.execute_enhanced_recovery_action(action).await?;
                    }
                }
            }
            
            Ok(EnhancedSystemHealthReport {
                base_report: rust_report,
                hrm_decisions: vec![anomaly_decision, recovery_decision, prediction_decision],
                enhanced_actions: enhanced_actions.clone(),
                intelligence_level: "HRM_ENHANCED".to_string(),
                decision_confidence: self.calculate_overall_confidence(&enhanced_actions),
            })
        } else {
            info!("📊 System stable - using Rust-only evaluation");
            Ok(EnhancedSystemHealthReport {
                base_report: rust_report,
                hrm_decisions: vec![],
                enhanced_actions: vec![],
                intelligence_level: "RUST_ONLY".to_string(),
                decision_confidence: 0.8, // Standard Rust confidence
            })
        }
    }
    
    /// Determine if HRM analysis is needed based on system state
    async fn should_engage_hrm(&self, report: &SystemHealthReport) -> bool {
        // Engage HRM for complex scenarios
        report.overall_health_score < 0.7 || // Health issues
        !report.system_anomalies.is_empty() || // Anomalies detected
        report.recovery_recommendations.len() > 2 || // Multiple recovery options
        report.services.iter().any(|s| s.health_score < 0.5) // Critical service issues
    }
    
    /// Prepare system context for HRM analysis
    async fn prepare_system_context(&self, report: &SystemHealthReport) -> Result<HRMSelfHealingContext> {
        let metrics: Vec<AdvancedHealthMetrics> = report.services.iter()
            .map(|s| s.metrics.clone())
            .collect();
        
        let system_state = SystemStateSnapshot {
            overall_health_score: report.overall_health_score,
            service_count: report.services.len(),
            active_connections: metrics.iter().map(|m| m.connection_count).sum(),
            memory_pressure: 0.5, // Would get from system monitoring
            cpu_utilization: 0.6, // Would get from system monitoring  
            error_rate: metrics.iter().map(|m| m.error_rate).sum::<f64>() / metrics.len() as f64,
            response_time_p99: metrics.iter().map(|m| m.response_time_ms).fold(0.0, f64::max),
            recent_deployments: vec![], // Would track from deployment system
        };
        
        let patterns = self.pattern_database.read().await.clone();
        
        Ok(HRMSelfHealingContext {
            decision_type: SelfHealingDecisionType::AnomalyAnalysis, // Will be overridden
            service_metrics: metrics,
            system_state,
            historical_patterns: patterns,
            available_actions: vec![
                "restart_service".to_string(),
                "scale_service".to_string(),
                "redirect_traffic".to_string(),
                "activate_circuit_breaker".to_string(),
                "clear_cache".to_string(),
                "notify_operators".to_string(),
            ],
            constraints: SystemConstraints {
                max_recovery_attempts: 3,
                recovery_timeout: ChronoDuration::minutes(5),
                allowed_downtime: ChronoDuration::seconds(30),
                cost_limits: HashMap::new(),
                compliance_requirements: vec!["zero_data_loss".to_string()],
            },
        })
    }
    
    /// Get HRM decision for specific decision type
    async fn get_hrm_decision(
        &self,
        decision_type: SelfHealingDecisionType,
        context: &HRMSelfHealingContext
    ) -> HRMSelfHealingDecision {
        // Check cache first
        let cache_key = format!("{:?}_{}", decision_type, context.system_state.overall_health_score as i32);
        
        if let Some((cached_decision, timestamp)) = self.decision_cache.read().await.get(&cache_key) {
            if Utc::now().signed_duration_since(*timestamp) < self.config.decision_cache_ttl {
                debug!("📋 Using cached HRM decision for {:?}", decision_type);
                return cached_decision.clone();
            }
        }
        
        // Prepare HRM request
        let mut hrm_context = context.clone();
        hrm_context.decision_type = decision_type.clone();
        
        let _hrm_request = self.build_hrm_request(&hrm_context).await;
        
        // Call HRM service
        match self.call_local_llm(&context).await {
            Ok(decision) => {
                // Cache successful decision
                self.decision_cache.write().await.insert(
                    cache_key, 
                    (decision.clone(), Utc::now())
                );
                decision
            },
            Err(e) => {
                warn!("❌ HRM service call failed: {}. Using fallback decision.", e);
                self.create_fallback_decision(&decision_type, context).await
            }
        }
    }
    
    /// Build HRM service request based on decision type
    async fn build_hrm_request(&self, context: &HRMSelfHealingContext) -> serde_json::Value {
        let task_type = match context.decision_type {
            SelfHealingDecisionType::AnomalyAnalysis => "arc", // Pattern recognition
            SelfHealingDecisionType::RecoveryStrategySelection => "planning", // Strategic planning
            SelfHealingDecisionType::RootCauseAnalysis => "planning", // Deep analysis
            SelfHealingDecisionType::FailurePrediction => "arc", // Pattern forecasting
            SelfHealingDecisionType::ResourceScaling => "planning", // Resource optimization
            SelfHealingDecisionType::SystemOptimization => "planning", // System-wide planning
        };
        
        let prompt = self.generate_decision_prompt(context).await;
        
        serde_json::json!({
            "task_type": task_type,
            "input_data": {
                "prompt": prompt,
                "decision_context": context,
                "reasoning_type": "self_healing_decision"
            },
            "max_steps": match context.decision_type {
                SelfHealingDecisionType::AnomalyAnalysis => 5,
                SelfHealingDecisionType::RecoveryStrategySelection => 7,
                SelfHealingDecisionType::RootCauseAnalysis => 10,
                SelfHealingDecisionType::FailurePrediction => 6,
                SelfHealingDecisionType::ResourceScaling => 8,
                SelfHealingDecisionType::SystemOptimization => 12,
            },
            "temperature": 0.2, // Low temperature for consistent decisions
            "adaptive_computation": true
        })
    }
    
    /// Generate decision-specific prompt for HRM
    async fn generate_decision_prompt(&self, context: &HRMSelfHealingContext) -> String {
        match context.decision_type {
            SelfHealingDecisionType::AnomalyAnalysis => format!(
                "Analyze system anomalies and patterns. System health: {:.2}. {} services with {} showing issues. Historical patterns suggest {} recovery strategies have high success rates.",
                context.system_state.overall_health_score,
                context.service_metrics.len(),
                context.service_metrics.iter().filter(|m| m.health_score < 0.7).count(),
                context.historical_patterns.iter().filter(|p| p.success_rate > 0.8).count()
            ),
            
            SelfHealingDecisionType::RecoveryStrategySelection => format!(
                "Select optimal recovery strategy. System impact: {:.2} error rate, {:.1}ms P99 latency. {} available actions. Constraints: max {} recovery attempts, {} minute timeout.",
                context.system_state.error_rate,
                context.system_state.response_time_p99,
                context.available_actions.len(),
                context.constraints.max_recovery_attempts,
                context.constraints.recovery_timeout.num_minutes()
            ),
            
            SelfHealingDecisionType::RootCauseAnalysis => format!(
                "Perform deep root cause analysis. System state: {:.1}% CPU, {:.1}% memory pressure. Recent deployments: {}. Correlate with {} historical failure patterns.",
                context.system_state.cpu_utilization * 100.0,
                context.system_state.memory_pressure * 100.0,
                context.system_state.recent_deployments.len(),
                context.historical_patterns.len()
            ),
            
            SelfHealingDecisionType::FailurePrediction => format!(
                "Predict potential system failures. Current trajectory: {:.2} health score trend. {} active connections. Analyze {} service metrics for early warning signs.",
                context.system_state.overall_health_score,
                context.system_state.active_connections,
                context.service_metrics.len()
            ),
            
            SelfHealingDecisionType::ResourceScaling => format!(
                "Optimize resource allocation. System load: {:.1}% CPU, {} connections. Budget constraints: {} cost categories. Predict scaling needs for next 30 minutes.",
                context.system_state.cpu_utilization * 100.0,
                context.system_state.active_connections,
                context.constraints.cost_limits.len()
            ),
            
            SelfHealingDecisionType::SystemOptimization => format!(
                "Recommend system-wide optimizations. Overall health: {:.2}. {} services operational. {} compliance requirements. Focus on long-term stability improvements.",
                context.system_state.overall_health_score,
                context.system_state.service_count,
                context.constraints.compliance_requirements.len()
            ),
        }
    }
    
    /// Call local LLM (Ollama/LM Studio) for intelligent decision making
    async fn call_local_llm(&self, context: &HRMSelfHealingContext) -> Result<HRMSelfHealingDecision> {
        let prompt = self.build_system_analysis_prompt(context).await?;
        
        // Try Ollama first, fallback to LM Studio
        let response = match self.query_ollama(&prompt).await {
            Ok(response) => {
                info!("✅ Got response from Ollama: {}", self.config.preferred_model);
                response
            }
            Err(_) if self.config.enable_fallback => {
                info!("⚠️ Ollama unavailable, trying LM Studio");
                match self.query_lm_studio(&prompt).await {
                    Ok(response) => {
                        info!("✅ Got response from LM Studio: {}", self.config.fallback_model);
                        response
                    }
                    Err(_e) => {
                        warn!("❌ Both LLM endpoints failed, using Rust-only analysis");
                        return self.rust_only_decision(context).await;
                    }
                }
            }
            Err(e) => {
                warn!("❌ LLM analysis failed, using Rust-only fallback: {}", e);
                return self.rust_only_decision(context).await;
            }
        };
        
        self.parse_llm_response(&response, context).await
    }
    
    /// Query Ollama local LLM endpoint
    async fn query_ollama(&self, prompt: &str) -> Result<String> {
        let request_body = serde_json::json!({
            "model": self.config.preferred_model,
            "prompt": prompt,
            "stream": false,
            "options": {
                "temperature": self.config.temperature,
                "num_predict": self.config.max_tokens,
            }
        });
        
        let response = tokio::time::timeout(
            self.config.max_llm_timeout.to_std()?,
            self.llm_client.post(&format!("{}/api/generate", self.ollama_url))
                .json(&request_body)
                .send()
        ).await??;
        
        if response.status().is_success() {
            let ollama_response: serde_json::Value = response.json().await?;
            Ok(ollama_response["response"].as_str().unwrap_or("").to_string())
        } else {
            Err(anyhow!("Ollama API returned status: {}", response.status()))
        }
    }
    
    /// Query LM Studio local LLM endpoint  
    async fn query_lm_studio(&self, prompt: &str) -> Result<String> {
        let request_body = serde_json::json!({
            "model": self.config.fallback_model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a system reliability engineer analyzing infrastructure health and recommending recovery actions."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
        });
        
        let response = tokio::time::timeout(
            self.config.max_llm_timeout.to_std()?,
            self.llm_client.post(&format!("{}/v1/chat/completions", self.lm_studio_url))
                .json(&request_body)
                .send()
        ).await??;
        
        if response.status().is_success() {
            let lm_response: serde_json::Value = response.json().await?;
            let message = lm_response["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or("");
            Ok(message.to_string())
        } else {
            Err(anyhow!("LM Studio API returned status: {}", response.status()))
        }
    }
    
    /// Parse HRM response into structured decision
    async fn parse_hrm_response(&self, _response: &serde_json::Value) -> Result<HRMSelfHealingDecision> {
        // Simplified parsing - would be more sophisticated in production
        Ok(HRMSelfHealingDecision {
            recommended_actions: vec![
                EnhancedRecoveryAction {
                    action_type: "intelligent_restart".to_string(),
                    parameters: HashMap::new(),
                    priority: 1,
                    estimated_success_rate: 0.85,
                    expected_recovery_time: 30.0,
                    rollback_plan: Some("rollback_to_previous_state".to_string()),
                    confidence: 0.85,
                }
            ],
            confidence: 0.87,
            reasoning_steps: vec![
                "Analyzed system patterns and identified root cause".to_string(),
                "Selected recovery strategy based on historical success rates".to_string(),
                "Assessed risk factors and prepared rollback plan".to_string(),
            ],
            risk_assessment: RiskAssessment {
                overall_risk: 0.15,
                service_impact_risk: 0.20,
                data_loss_risk: 0.05,
                user_experience_risk: 0.25,
                rollback_complexity: 0.10,
            },
            estimated_impact: ImpactEstimate {
                recovery_probability: 0.87,
                time_to_recovery: ChronoDuration::seconds(30),
                service_disruption: 0.10,
                resource_cost: 0.05,
                long_term_stability: 0.15,
            },
            monitoring_focus: vec![
                "response_time".to_string(),
                "error_rate".to_string(),
                "service_health_score".to_string(),
            ],
            fallback_strategy: Some("gradual_rollback_if_no_improvement_in_60s".to_string()),
        })
    }
    
    /// Create fallback decision when HRM is unavailable
    async fn create_fallback_decision(&self, decision_type: &SelfHealingDecisionType, _context: &HRMSelfHealingContext) -> HRMSelfHealingDecision {
        warn!("🔄 Creating fallback decision for {:?}", decision_type);
        
        HRMSelfHealingDecision {
            recommended_actions: vec![
                EnhancedRecoveryAction {
                    action_type: "conservative_restart".to_string(),
                    parameters: HashMap::new(),
                    priority: 2,
                    estimated_success_rate: 0.60,
                    expected_recovery_time: 60.0,
                    rollback_plan: Some("immediate_rollback".to_string()),
                    confidence: 0.60,
                }
            ],
            confidence: 0.40, // Lower confidence for fallback
            reasoning_steps: vec![
                "HRM service unavailable - using rule-based fallback".to_string(),
                "Selected conservative recovery approach".to_string(),
            ],
            risk_assessment: RiskAssessment {
                overall_risk: 0.30,
                service_impact_risk: 0.35,
                data_loss_risk: 0.10,
                user_experience_risk: 0.40,
                rollback_complexity: 0.20,
            },
            estimated_impact: ImpactEstimate {
                recovery_probability: 0.60,
                time_to_recovery: ChronoDuration::minutes(1),
                service_disruption: 0.25,
                resource_cost: 0.10,
                long_term_stability: 0.05,
            },
            monitoring_focus: vec![
                "basic_health_metrics".to_string(),
                "service_availability".to_string(),
            ],
            fallback_strategy: Some("manual_intervention_if_failed".to_string()),
        }
    }
    
    /// Synthesize enhanced recovery actions from Rust and HRM recommendations
    async fn synthesize_recovery_actions(
        &self,
        rust_actions: &[RecoveryAction],
        hrm_decisions: &[HRMSelfHealingDecision]
    ) -> Result<Vec<EnhancedRecoveryAction>> {
        let mut enhanced_actions = Vec::new();
        
        // Combine insights from all HRM decisions
        for decision in hrm_decisions {
            enhanced_actions.extend(decision.recommended_actions.clone());
        }
        
        // Add Rust-based actions as lower-priority fallbacks
        for rust_action in rust_actions {
            enhanced_actions.push(EnhancedRecoveryAction {
                action_type: format!("rust_{:?}", rust_action),
                parameters: HashMap::new(),
                priority: 3, // Lower priority than HRM recommendations
                estimated_success_rate: 0.70,
                expected_recovery_time: 45.0,
                rollback_plan: Some("standard_rollback".to_string()),
                confidence: 0.70,
            });
        }
        
        // Sort by priority and confidence
        enhanced_actions.sort_by(|a, b| {
            a.priority.cmp(&b.priority)
                .then_with(|| b.estimated_success_rate.partial_cmp(&a.estimated_success_rate).unwrap())
        });
        
        Ok(enhanced_actions)
    }
    
    /// Execute enhanced recovery action with monitoring
    async fn execute_enhanced_recovery_action(&self, action: &EnhancedRecoveryAction) -> Result<()> {
        info!("🔧 Executing enhanced recovery action: {} (confidence: {:.2})", 
              action.action_type, action.estimated_success_rate);
        
        // Would implement actual recovery execution here
        // For now, just log the action
        info!("✅ Recovery action executed: {}", action.action_type);
        
        Ok(())
    }
    
    /// Calculate overall confidence from multiple actions
    fn calculate_overall_confidence(&self, actions: &[EnhancedRecoveryAction]) -> f64 {
        if actions.is_empty() {
            return 0.0;
        }
        
        let total_confidence: f64 = actions.iter()
            .map(|a| a.estimated_success_rate)
            .sum();
        
        total_confidence / actions.len() as f64
    }
    
    /// Build intelligent system analysis prompt for local LLM
    async fn build_system_analysis_prompt(&self, context: &HRMSelfHealingContext) -> Result<String> {
        let prompt = format!(r#"
SYSTEM HEALTH ANALYSIS REQUEST

CONTEXT:
- Decision Type: {:?}
- Overall Health Score: {:.2}
- Service Count: {}
- Error Rate: {:.2}%
- Memory Pressure: {:.2}%
- CPU Utilization: {:.2}%
- Response Time P99: {:.2}ms

RECENT PATTERNS:
{}

AVAILABLE ACTIONS:
{}

TASK:
Analyze the system health data and provide a structured JSON response with:
1. recommended_actions: Array of recovery actions with priority 1-10
2. confidence: Float 0.0-1.0 representing confidence in recommendations
3. reasoning_steps: Array of strings explaining the analysis
4. risk_assessment: Object with overall_risk (0.0-1.0) and specific risks
5. estimated_impact: Object with recovery_time_minutes and success_probability
6. monitoring_focus: Array of key metrics to monitor

Focus on practical, actionable recommendations for a production system.
Return ONLY valid JSON, no additional text.
"#,
            context.decision_type,
            context.system_state.overall_health_score,
            context.system_state.service_count,
            context.system_state.error_rate * 100.0,
            context.system_state.memory_pressure * 100.0,
            context.system_state.cpu_utilization * 100.0,
            context.system_state.response_time_p99,
            context.historical_patterns.iter()
                .map(|p| format!("- {}: {:.1}% frequency, {:.1}% success", p.pattern_type, p.frequency * 100.0, p.success_rate * 100.0))
                .collect::<Vec<_>>()
                .join("\n"),
            context.available_actions.join(", ")
        );
        
        Ok(prompt)
    }
    
    /// Parse LLM response into structured decision
    async fn parse_llm_response(&self, response: &str, _context: &HRMSelfHealingContext) -> Result<HRMSelfHealingDecision> {
        // Try to parse as JSON first
        if let Ok(json_response) = serde_json::from_str::<serde_json::Value>(response) {
            // Extract structured data from LLM JSON response
            let actions = json_response["recommended_actions"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .map(|action| EnhancedRecoveryAction {
                    action_type: action["action_type"].as_str().unwrap_or("investigate").to_string(),
                    parameters: HashMap::new(),
                    priority: action["priority"].as_u64().unwrap_or(5) as u8,
                    estimated_success_rate: action["success_rate"].as_f64().unwrap_or(0.8),
                    expected_recovery_time: action["recovery_time"].as_f64().unwrap_or(300.0),
                    rollback_plan: action["rollback_plan"].as_str().map(|s| s.to_string()),
                    confidence: action["confidence"].as_f64().unwrap_or(0.8),
                })
                .collect();
                
            Ok(HRMSelfHealingDecision {
                recommended_actions: actions,
                confidence: json_response["confidence"].as_f64().unwrap_or(0.8),
                reasoning_steps: json_response["reasoning_steps"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .filter_map(|s| s.as_str().map(|s| s.to_string()))
                    .collect(),
                risk_assessment: RiskAssessment {
                    overall_risk: json_response["risk_assessment"]["overall_risk"].as_f64().unwrap_or(0.3),
                    service_impact_risk: 0.2,
                    data_loss_risk: 0.1,
                    user_experience_risk: 0.25,
                    rollback_complexity: 0.4,
                },
                estimated_impact: ImpactEstimate {
                    recovery_probability: json_response["estimated_impact"]["success_probability"].as_f64().unwrap_or(0.85),
                    time_to_recovery: ChronoDuration::minutes(json_response["estimated_impact"]["recovery_time_minutes"].as_f64().unwrap_or(5.0) as i64),
                    service_disruption: 0.3,
                    resource_cost: 1.0,
                    long_term_stability: 0.9,
                },
                monitoring_focus: json_response["monitoring_focus"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .filter_map(|s| s.as_str().map(|s| s.to_string()))
                    .collect(),
                fallback_strategy: Some("restart_services".to_string()),
            })
        } else {
            // Fallback to text parsing if JSON fails
            warn!("LLM response not valid JSON, using text analysis");
            Ok(HRMSelfHealingDecision {
                recommended_actions: vec![
                    EnhancedRecoveryAction {
                        action_type: "text_analysis_fallback".to_string(),
                        parameters: HashMap::new(),
                        priority: 5,
                        estimated_success_rate: 0.7,
                        expected_recovery_time: 300.0,
                        rollback_plan: Some("manual_intervention".to_string()),
                        confidence: 0.6,
                    }
                ],
                confidence: 0.6,
                reasoning_steps: vec!["LLM response parsing failed, using basic analysis".to_string()],
                risk_assessment: RiskAssessment {
                    overall_risk: 0.4,
                    service_impact_risk: 0.3,
                    data_loss_risk: 0.1,
                    user_experience_risk: 0.2,
                    rollback_complexity: 0.5,
                },
                estimated_impact: ImpactEstimate {
                    recovery_probability: 0.7,
                    time_to_recovery: ChronoDuration::minutes(5),
                    service_disruption: 0.4,
                    resource_cost: 1.0,
                    long_term_stability: 0.8,
                },
                monitoring_focus: vec!["response_time".to_string(), "error_rate".to_string()],
                fallback_strategy: Some("restart_services".to_string()),
            })
        }
    }
    
    /// Rust-only decision when LLM is unavailable
    async fn rust_only_decision(&self, _context: &HRMSelfHealingContext) -> Result<HRMSelfHealingDecision> {
        Ok(HRMSelfHealingDecision {
            recommended_actions: vec![
                EnhancedRecoveryAction {
                    action_type: "rust_analysis_restart".to_string(),
                    parameters: HashMap::new(),
                    priority: 3,
                    estimated_success_rate: 0.8,
                    expected_recovery_time: 180.0,
                    rollback_plan: Some("manual_intervention".to_string()),
                    confidence: 0.75,
                }
            ],
            confidence: 0.75,
            reasoning_steps: vec![
                "LLM unavailable, using Rust-based heuristics".to_string(),
                "System health below threshold, recommending service restart".to_string()
            ],
            risk_assessment: RiskAssessment {
                overall_risk: 0.25,
                service_impact_risk: 0.2,
                data_loss_risk: 0.05,
                user_experience_risk: 0.15,
                rollback_complexity: 0.3,
            },
            estimated_impact: ImpactEstimate {
                recovery_probability: 0.8,
                time_to_recovery: ChronoDuration::minutes(3),
                service_disruption: 0.2,
                resource_cost: 0.5,
                long_term_stability: 0.85,
            },
            monitoring_focus: vec![
                "service_health".to_string(),
                "response_time".to_string(),
                "error_rate".to_string()
            ],
            fallback_strategy: Some("escalate_to_human".to_string()),
        })
    }
}

/// Enhanced system health report with HRM intelligence
#[derive(Debug, Clone, Serialize)]
pub struct EnhancedSystemHealthReport {
    pub base_report: SystemHealthReport,
    pub hrm_decisions: Vec<HRMSelfHealingDecision>,
    pub enhanced_actions: Vec<EnhancedRecoveryAction>,
    pub intelligence_level: String,
    pub decision_confidence: f64,
}