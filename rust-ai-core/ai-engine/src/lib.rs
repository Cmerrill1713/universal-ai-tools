// AI Engine - Core LLM routing and model management for Universal AI Tools
// Handles model selection, request routing, and performance optimization

pub mod config;
pub mod error;
pub mod models;
pub mod router;
pub mod providers;
pub mod metrics;
pub mod health;

use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, instrument};

use crate::config::AIEngineConfig;
use crate::models::{Model, ModelRegistry};
use crate::router::LLMRouter;
use crate::providers::{ProviderManager, OllamaProvider};
use crate::metrics::AIMetrics;

/// Main AI Engine service that coordinates all AI operations
pub struct AIEngine {
    config: AIEngineConfig,
    model_registry: Arc<RwLock<ModelRegistry>>,
    llm_router: Arc<LLMRouter>,
    provider_manager: Arc<ProviderManager>,
    metrics: Arc<AIMetrics>,
}

impl AIEngine {
    /// Create a new AI Engine instance
    #[instrument]
    pub async fn new(config: AIEngineConfig) -> Result<Self> {
        info!("Initializing AI Engine");

        // Initialize metrics
        let metrics = Arc::new(AIMetrics::new()?);

        // Initialize model registry
        let model_registry = Arc::new(RwLock::new(ModelRegistry::new()));

        // Initialize provider manager
        let mut provider_manager = ProviderManager::new();
        
        // Add Ollama provider
        let ollama_provider = OllamaProvider::new(
            config.ollama_endpoint.clone(),
            config.ollama_timeout,
        ).await?;
        provider_manager.add_provider("ollama".to_string(), Box::new(ollama_provider)).await?;

        let provider_manager = Arc::new(provider_manager);

        // Initialize LLM router
        let llm_router = Arc::new(LLMRouter::new(
            model_registry.clone(),
            provider_manager.clone(),
            metrics.clone(),
            config.clone(),
        ));

        // Load initial models
        let engine = Self {
            config,
            model_registry,
            llm_router,
            provider_manager,
            metrics,
        };

        engine.refresh_models().await?;

        info!("AI Engine initialized successfully");
        Ok(engine)
    }

    /// Refresh the model registry from all providers
    #[instrument(skip(self))]
    pub async fn refresh_models(&self) -> Result<()> {
        info!("Refreshing model registry");

        let models = self.provider_manager.discover_models().await?;
        
        let mut registry = self.model_registry.write().await;
        registry.clear();
        
        for model in models {
            registry.register(model)?;
        }

        let model_count = registry.len();
        self.metrics.set_available_models(model_count as f64);
        
        info!("Model registry refreshed with {} models", model_count);
        Ok(())
    }

    /// Get the LLM router for request processing
    pub fn router(&self) -> Arc<LLMRouter> {
        self.llm_router.clone()
    }

    /// Get AI metrics
    pub fn metrics(&self) -> Arc<AIMetrics> {
        self.metrics.clone()
    }

    /// Get model registry (read-only access)
    pub async fn get_models(&self) -> Vec<Model> {
        let registry = self.model_registry.read().await;
        registry.list_models()
    }

    /// Get a specific model by ID
    pub async fn get_model(&self, model_id: &str) -> Option<Model> {
        let registry = self.model_registry.read().await;
        registry.get(model_id).cloned()
    }

    /// Health check for the AI Engine
    pub async fn health_check(&self) -> Result<serde_json::Value> {
        let registry = self.model_registry.read().await;
        let available_models = registry.len();
        let healthy_providers = self.provider_manager.health_check().await?;

        Ok(serde_json::json!({
            "status": if healthy_providers > 0 { "healthy" } else { "degraded" },
            "providers": {
                "total": self.provider_manager.provider_count(),
                "healthy": healthy_providers
            },
            "models": {
                "available": available_models,
                "total_requests": self.metrics.get_total_requests(),
                "average_latency_ms": self.metrics.get_average_latency()
            }
        }))
    }

    /// Shutdown the AI Engine gracefully
    #[instrument(skip(self))]
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down AI Engine");
        
        // Perform any cleanup here
        self.provider_manager.shutdown().await?;
        
        info!("AI Engine shutdown complete");
        Ok(())
    }
}