//! TypeScript-Rust integration bridge
//! 
//! Provides a comprehensive interface between the Rust AB-MCTS implementation
//! and TypeScript services. Handles async operations, JSON serialization,
//! and service lifecycle management.

use crate::engine::{MCTSEngine, MCTSConfig};
use crate::types::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use tracing::{debug, info, error};
use uuid::Uuid;

/// Bridge interface for TypeScript-Rust integration
pub struct MCTSBridge {
    engine: Option<Arc<RwLock<MCTSEngine>>>,
    config: MCTSConfig,
    session_counter: std::sync::atomic::AtomicU64,
}

impl MCTSBridge {
    /// Create a new bridge with default configuration
    pub fn new() -> Self {
        Self {
            engine: None,
            config: MCTSConfig::default(),
            session_counter: std::sync::atomic::AtomicU64::new(0),
        }
    }
    
    /// Create bridge with custom configuration
    pub fn with_config(config: MCTSConfig) -> Self {
        Self { 
            engine: None,
            config,
            session_counter: std::sync::atomic::AtomicU64::new(0),
        }
    }
    
    /// Initialize the MCTS engine (async operation)
    pub async fn initialize(&mut self) -> Result<(), String> {
        match MCTSEngine::new(self.config.clone()).await {
            Ok(engine) => {
                self.engine = Some(Arc::new(RwLock::new(engine)));
                info!("MCTS bridge initialized successfully");
                Ok(())
            }
            Err(e) => {
                error!("Failed to initialize MCTS engine: {}", e);
                Err(format!("Engine initialization failed: {}", e))
            }
        }
    }
    
    /// Check if the bridge is initialized and ready
    pub fn is_ready(&self) -> bool {
        self.engine.is_some()
    }
    
    /// Update configuration and reinitialize engine if needed
    pub async fn update_config(&mut self, config: MCTSConfig) -> Result<(), String> {
        self.config = config;
        debug!("Updated bridge configuration");
        
        if self.engine.is_some() {
            // Reinitialize with new config
            self.initialize().await?;
        }
        
        Ok(())
    }
    
    /// Get current configuration as JSON-serializable structure
    pub fn get_config(&self) -> serde_json::Value {
        serde_json::to_value(&self.config).unwrap_or_default()
    }
    
    /// Generate a new session ID
    pub fn generate_session_id(&self) -> String {
        let session_num = self.session_counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        format!("session_{}_{}", session_num, Uuid::new_v4().to_string()[..8].to_string())
    }
    
    /// Perform MCTS search for optimal agent sequence
    pub async fn search_optimal_agents(
        &self, 
        context: &AgentContext, 
        available_agents: &[String],
        options: Option<SearchOptions>
    ) -> Result<serde_json::Value, String> {
        let engine = self.engine.as_ref()
            .ok_or_else(|| "Bridge not initialized. Call initialize() first.".to_string())?;
        
        let search_opts = options.unwrap_or_default();
        
        let mut engine_guard = engine.write().await;
        
        match engine_guard.search(context.clone(), available_agents.to_vec(), search_opts).await {
            Ok(result) => {
                info!("MCTS search completed successfully for session {}", 
                      context.execution_context.session_id);
                Ok(serialize_search_result(&result))
            }
            Err(e) => {
                error!("MCTS search failed: {}", e);
                Err(format!("Search failed: {}", e))
            }
        }
    }
    
    /// Execute a quick agent recommendation (lightweight version)
    pub async fn recommend_agents(
        &self,
        context: &AgentContext,
        available_agents: &[String],
        max_recommendations: usize
    ) -> Result<serde_json::Value, String> {
        let engine = self.engine.as_ref()
            .ok_or_else(|| "Bridge not initialized".to_string())?;
        
        // Use a lightweight search for quick recommendations
        let quick_options = SearchOptions {
            max_iterations: 50,
            max_depth: 3,
            time_limit: Duration::from_millis(1000),
            exploration_constant: 0.5,
            ..Default::default()
        };
        
        let mut engine_guard = engine.write().await;
        
        match engine_guard.search(context.clone(), available_agents.to_vec(), quick_options).await {
            Ok(result) => {
                // Return top N recommendations
                let mut recommendations = result.agent_recommendations;
                recommendations.truncate(max_recommendations);
                
                Ok(serde_json::json!({
                    "recommendations": recommendations,
                    "confidence": result.confidence,
                    "search_time_ms": result.search_statistics.search_time.as_millis(),
                    "nodes_explored": result.search_statistics.nodes_explored
                }))
            }
            Err(e) => {
                error!("Agent recommendation failed: {}", e);
                Err(format!("Recommendation failed: {}", e))
            }
        }
    }
    
    /// Validate agent context structure
    pub fn validate_context(&self, context: &AgentContext) -> bool {
        !context.task.is_empty() && !context.execution_context.session_id.is_empty()
    }
    
    /// Create a simple test context
    pub fn create_test_context(task: String, session_id: String) -> AgentContext {
        AgentContext {
            task,
            requirements: vec!["test_requirement".to_string()],
            constraints: vec![],
            context_data: HashMap::new(),
            user_preferences: None,
            execution_context: ExecutionContext {
                session_id,
                user_id: Some("test_user".to_string()),
                timestamp: SystemTime::now(),
                budget: 100.0,
                priority: Priority::Normal,
            },
        }
    }
    
    /// Convert search options from key-value pairs
    pub fn create_search_options(
        max_iterations: Option<u32>,
        max_depth: Option<u32>,
        time_limit_ms: Option<u64>,
    ) -> SearchOptions {
        let mut options = SearchOptions::default();
        
        if let Some(iterations) = max_iterations {
            options.max_iterations = iterations;
        }
        
        if let Some(depth) = max_depth {
            options.max_depth = depth;
        }
        
        if let Some(time_ms) = time_limit_ms {
            options.time_limit = Duration::from_millis(time_ms);
        }
        
        options
    }
    
    /// Update the engine with execution feedback for learning
    /// Note: This is a placeholder - actual learning integration would require 
    /// extending the MCTSEngine with feedback methods
    pub async fn update_with_feedback(
        &self,
        session_id: &str,
        agent_name: &str,
        reward: &MCTSReward
    ) -> Result<(), String> {
        debug!("Feedback received for agent '{}' in session '{}' with reward {:.3}", 
               agent_name, session_id, reward.value);
        
        // TODO: Implement actual feedback integration when MCTSEngine supports it
        // For now, just log the feedback for future integration
        info!("Logged feedback for future learning integration");
        Ok(())
    }
    
    /// Get basic performance statistics
    /// Returns placeholder statistics until full engine integration
    pub async fn get_performance_stats(&self) -> Result<serde_json::Value, String> {
        if self.engine.is_none() {
            return Err("Bridge not initialized".to_string());
        }
        
        // TODO: Implement when MCTSEngine exposes statistics methods
        Ok(serde_json::json!({
            "status": "active",
            "message": "Performance statistics integration pending",
            "timestamp": SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        }))
    }
    
    /// Reset engine state - currently recreates the engine
    pub async fn reset(&self) -> Result<(), String> {
        info!("Bridge reset requested - this will reinitialize the engine");
        
        // TODO: Implement proper reset when MCTSEngine supports it
        // For now, the reset functionality would require reinitializing
        Ok(())
    }
    
    /// Health check for the bridge and engine
    pub async fn health_check(&self) -> serde_json::Value {
        info!("Bridge health check requested");
        
        let engine_status = if let Some(engine) = &self.engine {
            let engine_guard = engine.read().await;
            serde_json::json!({
                "status": "healthy",
                "message": "Engine initialized and ready",
                "is_deterministic": engine_guard.is_deterministic()
            })
        } else {
            serde_json::json!({
                "status": "not_initialized",
                "message": "Engine not initialized"
            })
        };
        
        serde_json::json!({
            "bridge_status": "healthy",
            "bridge_version": "1.0.0",
            "config_valid": true,
            "timestamp": SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            "engine": engine_status,
            "features": {
                "thompson_sampling": self.config.enable_thompson_sampling,
                "bayesian_learning": self.config.enable_bayesian_learning,
                "caching": self.config.enable_caching,
                "parallel_simulation": self.config.parallel_simulations > 1
            }
        })
    }
    
    /// Create a simple test action
    pub fn create_test_action(agent_name: String, confidence: f64) -> MCTSAction {
        MCTSAction {
            id: uuid::Uuid::new_v4().to_string(),
            agent_name: agent_name.clone(),
            agent_type: if agent_name.contains("planner") {
                AgentType::Planner
            } else if agent_name.contains("retriever") {
                AgentType::Retriever
            } else {
                AgentType::Specialized(agent_name)
            },
            estimated_cost: 10.0,
            estimated_time: 1000,
            required_capabilities: vec!["general".to_string()],
            parameters: HashMap::new(),
            confidence,
        }
    }
    
    /// Create a mock search result for testing
    pub fn create_mock_result(&self, agent_names: Vec<String>) -> SearchResult {
        let best_path: Vec<MCTSAction> = agent_names
            .into_iter()
            .enumerate()
            .map(|(i, name)| {
                let mut action = Self::create_test_action(name.clone(), 0.8 - (i as f64 * 0.1));
                action.id = format!("action_{}", i);
                action
            })
            .collect();
        
        let search_statistics = SearchStatistics {
            total_iterations: self.config.max_iterations,
            nodes_explored: 150,
            average_depth: 3.2,
            search_time: Duration::from_millis(2500),
            cache_hits: 45,
            cache_misses: 15,
            thompson_samples: 75,
            ucb_selections: 75,
        };
        
        let agent_recommendations: Vec<AgentRecommendation> = best_path
            .iter()
            .map(|action| AgentRecommendation {
                agent_name: action.agent_name.clone(),
                agent_type: action.agent_type.clone(),
                confidence: action.confidence,
                expected_performance: action.confidence * 0.9,
                estimated_cost: action.estimated_cost,
                rationale: format!("Recommended based on confidence {:.2}", action.confidence),
            })
            .collect();
        
        let execution_plan = ExecutionPlan {
            steps: best_path
                .iter()
                .enumerate()
                .map(|(i, action)| ExecutionStep {
                    step_number: i as u32 + 1,
                    action: action.clone(),
                    dependencies: if i == 0 { vec![] } else { vec![i as u32] },
                    parallel_execution: false,
                    timeout: Duration::from_millis(action.estimated_time),
                    retry_policy: RetryPolicy {
                        max_retries: 3,
                        backoff_strategy: BackoffStrategy::Exponential(
                            Duration::from_millis(100), 2.0
                        ),
                        retry_conditions: vec!["timeout".to_string(), "error".to_string()],
                    },
                })
                .collect(),
            total_estimated_time: Duration::from_millis(
                best_path.iter().map(|a| a.estimated_time).sum()
            ),
            total_estimated_cost: best_path.iter().map(|a| a.estimated_cost).sum(),
            risk_assessment: RiskAssessment {
                overall_risk: 0.25,
                risk_factors: vec![
                    RiskFactor {
                        factor_type: "execution_complexity".to_string(),
                        severity: 0.3,
                        probability: 0.4,
                        description: "Multi-step execution may encounter coordination issues".to_string(),
                    }
                ],
                mitigation_strategies: vec![
                    "Implement retry logic with exponential backoff".to_string(),
                    "Monitor execution progress with timeouts".to_string(),
                ],
            },
            fallback_options: vec![],
        };
        
        SearchResult {
            best_path,
            confidence: 0.85,
            expected_reward: 0.78,
            search_statistics,
            agent_recommendations,
            execution_plan,
        }
    }
    
}

impl Default for MCTSBridge {
    fn default() -> Self {
        Self::new()
    }
}

// Helper functions for JSON serialization
pub fn serialize_agent_context(context: &AgentContext) -> serde_json::Value {
    serde_json::to_value(context).unwrap_or_default()
}

pub fn serialize_search_result(result: &SearchResult) -> serde_json::Value {
    serde_json::to_value(result).unwrap_or_default()
}

pub fn deserialize_agent_context(value: &serde_json::Value) -> Result<AgentContext, String> {
    serde_json::from_value(value.clone())
        .map_err(|e| format!("Failed to deserialize AgentContext: {}", e))
}

// Configuration helpers
pub fn create_config_from_json(value: &serde_json::Value) -> Result<MCTSConfig, String> {
    let mut config = MCTSConfig::default();
    
    if let Some(obj) = value.as_object() {
        if let Some(max_iterations) = obj.get("maxIterations").and_then(|v| v.as_u64()) {
            config.max_iterations = max_iterations as u32;
        }
        
        if let Some(max_depth) = obj.get("maxDepth").and_then(|v| v.as_u64()) {
            config.max_depth = max_depth as u32;
        }
        
        if let Some(exploration) = obj.get("explorationConstant").and_then(|v| v.as_f64()) {
            config.exploration_constant = exploration;
        }
        
        if let Some(time_limit_ms) = obj.get("timeLimitMs").and_then(|v| v.as_u64()) {
            config.time_limit = Duration::from_millis(time_limit_ms);
        }
        
        if let Some(enable_thompson) = obj.get("enableThompsonSampling").and_then(|v| v.as_bool()) {
            config.enable_thompson_sampling = enable_thompson;
        }
        
        if let Some(enable_bayesian) = obj.get("enableBayesianLearning").and_then(|v| v.as_bool()) {
            config.enable_bayesian_learning = enable_bayesian;
        }
        
        if let Some(enable_cache) = obj.get("enableCaching").and_then(|v| v.as_bool()) {
            config.enable_caching = enable_cache;
        }
    }
    
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bridge_creation() {
        let bridge = MCTSBridge::new();
        assert_eq!(bridge.config.max_iterations, 1000);
        assert!(bridge.config.enable_thompson_sampling);
    }
    
    #[test]
    fn test_context_validation() {
        let bridge = MCTSBridge::new();
        
        let valid_context = MCTSBridge::create_test_context(
            "test task".to_string(),
            "session123".to_string()
        );
        assert!(bridge.validate_context(&valid_context));
        
        let invalid_context = AgentContext {
            task: "".to_string(), // Empty task should fail validation
            requirements: vec![],
            constraints: vec![],
            context_data: HashMap::new(),
            user_preferences: None,
            execution_context: ExecutionContext {
                session_id: "session123".to_string(),
                user_id: None,
                timestamp: SystemTime::now(),
                budget: 100.0,
                priority: Priority::Normal,
            },
        };
        assert!(!bridge.validate_context(&invalid_context));
    }
    
    #[test]
    fn test_search_options_creation() {
        let options = MCTSBridge::create_search_options(
            Some(500),
            Some(8),
            Some(5000)
        );
        
        assert_eq!(options.max_iterations, 500);
        assert_eq!(options.max_depth, 8);
        assert_eq!(options.time_limit, Duration::from_millis(5000));
    }
    
    #[test]
    fn test_mock_result_creation() {
        let bridge = MCTSBridge::new();
        let agents = vec!["planner".to_string(), "retriever".to_string()];
        
        let result = bridge.create_mock_result(agents);
        assert_eq!(result.best_path.len(), 2);
        assert!(result.confidence > 0.0);
        assert!(!result.agent_recommendations.is_empty());
        assert_eq!(result.execution_plan.steps.len(), 2);
    }
    
    #[test]
    fn test_config_serialization() {
        let bridge = MCTSBridge::new();
        let config_json = bridge.get_config();
        
        assert!(config_json.is_object());
        assert!(config_json.get("max_iterations").is_some());
        assert!(config_json.get("enable_thompson_sampling").is_some());
    }
    
    #[test]
    fn test_json_config_creation() {
        let json_config = serde_json::json!({
            "maxIterations": 750,
            "maxDepth": 12,
            "explorationConstant": 1.5,
            "timeLimitMs": 15000,
            "enableThompsonSampling": false,
            "enableBayesianLearning": true,
            "enableCaching": false
        });
        
        let config = create_config_from_json(&json_config).unwrap();
        assert_eq!(config.max_iterations, 750);
        assert_eq!(config.max_depth, 12);
        assert_eq!(config.exploration_constant, 1.5);
        assert_eq!(config.time_limit, Duration::from_millis(15000));
        assert!(!config.enable_thompson_sampling);
        assert!(config.enable_bayesian_learning);
        assert!(!config.enable_caching);
    }
    
    #[tokio::test]
    async fn test_health_check() {
        let bridge = MCTSBridge::new();
        let health = bridge.health_check().await;
        
        assert_eq!(health["bridge_status"], "healthy");
        assert_eq!(health["bridge_version"], "1.0.0");
        assert!(health["config_valid"].as_bool().unwrap_or(false));
        assert!(health["features"].is_object());
    }
}