//! Intelligent Parameter Service - ML-based LLM parameter optimization
//! 
//! Automatically selects optimal parameters for LLM calls based on:
//! - Historical performance data
//! - Task type classification
//! - Context analysis
//! - Multi-armed bandit optimization
//! - Reinforcement learning

pub mod types;
pub mod optimizer;
pub mod selector;
pub mod tracker;
pub mod cache;
pub mod learning;
pub mod error;
pub mod http_server;

#[cfg(feature = "ffi")]
pub mod ffi;

pub use types::*;
pub use error::{ParameterError, Result};
pub use optimizer::ParameterOptimizer;
pub use selector::ParameterSelector;

use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

/// Main service for intelligent parameter optimization
pub struct IntelligentParameterService {
    optimizer: Arc<ParameterOptimizer>,
    selector: Arc<ParameterSelector>,
    tracker: Arc<RwLock<tracker::PerformanceTracker>>,
    cache: Arc<cache::ParameterCache>,
    config: ServiceConfig,
}

/// Configuration for the parameter service
#[derive(Clone, Debug)]
pub struct ServiceConfig {
    /// Enable ML-based optimization
    pub enable_ml_optimization: bool,
    /// Learning rate for parameter updates
    pub learning_rate: f64,
    /// Exploration rate for multi-armed bandit
    pub exploration_rate: f64,
    /// Cache TTL in seconds
    pub cache_ttl_seconds: u64,
    /// Maximum parameter history
    pub max_history_size: usize,
    /// Enable reinforcement learning
    pub enable_reinforcement_learning: bool,
    /// Redis connection URL
    pub redis_url: Option<String>,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            enable_ml_optimization: true,
            learning_rate: 0.01,
            exploration_rate: 0.1,
            cache_ttl_seconds: 3600,
            max_history_size: 10000,
            enable_reinforcement_learning: false,
            redis_url: None,
        }
    }
}

impl IntelligentParameterService {
    /// Create a new intelligent parameter service
    pub async fn new(config: ServiceConfig) -> Result<Self> {
        info!("🧠 Initializing Intelligent Parameter Service");
        
        let optimizer = Arc::new(ParameterOptimizer::new(
            config.learning_rate,
            config.exploration_rate,
        ));
        
        let selector = Arc::new(ParameterSelector::new(config.enable_ml_optimization));
        
        let tracker = Arc::new(RwLock::new(
            tracker::PerformanceTracker::new(config.max_history_size)
        ));
        
        let cache = Arc::new(
            cache::ParameterCache::new(
                config.cache_ttl_seconds,
                config.redis_url.clone(),
            ).await?
        );
        
        Ok(Self {
            optimizer,
            selector,
            tracker,
            cache,
            config,
        })
    }
    
    /// Get optimal parameters for a task
    pub async fn get_optimal_parameters(
        &self,
        request: ParameterRequest,
    ) -> Result<OptimalParameters> {
        // Check cache first
        if let Some(cached) = self.cache.get(&request).await? {
            return Ok(cached);
        }
        
        // Classify task type
        let task_type = self.classify_task_type(&request);
        
        // Get historical performance data
        let history = self.tracker.read().await.get_relevant_history(&task_type);
        
        // Select optimal parameters
        let parameters = if self.config.enable_ml_optimization {
            self.optimizer.optimize(&request, &history).await?
        } else {
            self.selector.select_baseline(&task_type)
        };
        
        // Cache the result
        self.cache.set(&request, &parameters).await?;
        
        Ok(parameters)
    }
    
    /// Record performance feedback
    pub async fn record_feedback(
        &self,
        feedback: PerformanceFeedback,
    ) -> Result<()> {
        // Update tracker
        self.tracker.write().await.record(feedback.clone());
        
        // Update optimizer with feedback
        if self.config.enable_ml_optimization {
            self.optimizer.update_from_feedback(&feedback).await?;
        }
        
        // Invalidate relevant cache entries
        self.cache.invalidate_related(&feedback.task_id).await?;
        
        Ok(())
    }
    
    /// Get performance analytics
    pub async fn get_analytics(&self) -> PerformanceAnalytics {
        self.tracker.read().await.get_analytics()
    }
    
    /// Classify task type from request
    fn classify_task_type(&self, request: &ParameterRequest) -> TaskType {
        // Simple classification based on prompt characteristics
        let prompt_lower = request.prompt.to_lowercase();
        
        if prompt_lower.contains("code") || prompt_lower.contains("function") || prompt_lower.contains("implement") {
            TaskType::CodeGeneration
        } else if prompt_lower.contains("explain") || prompt_lower.contains("describe") || prompt_lower.contains("what is") {
            TaskType::Explanation
        } else if prompt_lower.contains("summarize") || prompt_lower.contains("summary") {
            TaskType::Summarization
        } else if prompt_lower.contains("translate") || prompt_lower.contains("translation") {
            TaskType::Translation
        } else if prompt_lower.contains("analyze") || prompt_lower.contains("analysis") {
            TaskType::Analysis
        } else if prompt_lower.contains("create") || prompt_lower.contains("write") || prompt_lower.contains("generate") {
            TaskType::Creative
        } else if prompt_lower.contains("?") || prompt_lower.contains("how") || prompt_lower.contains("why") {
            TaskType::QuestionAnswering
        } else {
            TaskType::General
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_service_creation() {
        let config = ServiceConfig::default();
        let service = IntelligentParameterService::new(config).await;
        assert!(service.is_ok());
    }
}