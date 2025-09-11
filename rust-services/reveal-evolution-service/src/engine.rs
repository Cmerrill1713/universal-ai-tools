//! Core ReVeal Evolution Engine implementation

use crate::{
    cache::EvolutionCache,
    error::{EvolutionError, EvolutionResult},
    generator::{SolutionGenerator, GenerationStrategy},
    metrics::{CoEvolutionMetrics, EvolutionMetrics},
    types::*,
    verifier::{BayesianVerifier, VerificationResult},
    RevealConfig,
};
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use uuid::Uuid;
use std::time::{SystemTime, Duration};

/// Main ReVeal Evolution Engine
pub struct RevealEvolutionEngine {
    config: RevealConfig,
    verifier: Arc<BayesianVerifier>,
    generator: Arc<SolutionGenerator>,
    cache: Option<Arc<EvolutionCache>>,
    metrics: Arc<RwLock<CoEvolutionMetrics>>,
    evolution_history: Arc<DashMap<String, EvolutionResult>>,
}

impl RevealEvolutionEngine {
    /// Create a new evolution engine
    pub async fn new(config: RevealConfig) -> EvolutionResult<Self> {
        // Initialize cache if enabled
        let cache = if config.enable_caching {
            match EvolutionCache::new(config.redis_url.as_deref()).await {
                Ok(cache) => Some(Arc::new(cache)),
                Err(e) => {
                    warn!("Failed to initialize cache, proceeding without cache: {}", e);
                    None
                }
            }
        } else {
            None
        };
        
        // Initialize verifier
        let verifier = Arc::new(BayesianVerifier::new(
            config.verification_config.prior_alpha,
            config.verification_config.prior_beta,
            config.verification_config.learning_rate,
            config.verification_config.confidence_threshold,
        ));
        
        // Initialize generator
        let generator = Arc::new(SolutionGenerator::new(
            config.generation_config.strategy.clone(),
            config.generation_config.temperature,
            config.generation_config.max_tokens,
        ));
        
        // Initialize metrics
        let metrics = Arc::new(RwLock::new(CoEvolutionMetrics::new()));
        
        info!("ReVeal Evolution Engine initialized with max_turns={}, min_confidence={}", 
              config.max_turns, config.min_confidence);
        
        Ok(Self {
            config,
            verifier,
            generator,
            cache,
            metrics,
            evolution_history: Arc::new(DashMap::new()),
        })
    }
    
    /// Start evolution process
    pub async fn evolve(
        &mut self,
        problem: &str,
        context: EvolutionContext,
        constraints: Option<EvolutionConstraints>,
        options: EvolutionOptions,
    ) -> EvolutionResult<EvolutionResult> {
        let session_id = Uuid::new_v4().to_string();
        let start_time = SystemTime::now();
        
        info!("Starting evolution for session {}", session_id);
        debug!("Problem: {}", problem);
        
        // Check cache first
        if let Some(cache) = &self.cache {
            let cache_key = cache.generate_cache_key(problem, &context);
            if let Some(cached_result) = cache.get(&cache_key).await {
                info!("Returning cached result for session {}", session_id);
                return Ok(cached_result);
            }
        }
        
        let max_turns = options.max_turns.unwrap_or(self.config.max_turns);
        let min_confidence = options.min_confidence.unwrap_or(self.config.min_confidence);
        
        let mut current_solution = String::new();
        let mut verification_history = Vec::new();
        let mut generation_history = Vec::new();
        let mut final_confidence = 0.0;
        
        // Evolution loop
        for turn in 1..=max_turns {
            debug!("Evolution turn {} for session {}", turn, session_id);
            
            // Generate solution
            let generation_start = SystemTime::now();
            let feedback = if turn > 1 {
                verification_history.last().map(|v| v.feedback.as_str())
            } else {
                None
            };
            
            current_solution = self.generator.generate(problem, &context, feedback).await?;
            
            let generation_time = SystemTime::now()
                .duration_since(generation_start)
                .unwrap_or_default();
            
            generation_history.push(GenerationStep {
                turn,
                strategy_used: format!("{:?}", self.generator.strategy),
                improvements: vec!["Enhanced based on feedback".to_string()],
                execution_time_ms: generation_time.as_millis() as u64,
            });
            
            // Verify solution
            let verification_start = SystemTime::now();
            let verification_result = self.verifier.verify(&current_solution, problem).await?;
            
            let verification_time = SystemTime::now()
                .duration_since(verification_start)
                .unwrap_or_default();
            
            verification_history.push(VerificationStep {
                turn,
                confidence: verification_result.confidence,
                feedback: verification_result.feedback.clone(),
                execution_time_ms: verification_time.as_millis() as u64,
            });
            
            final_confidence = verification_result.confidence;
            
            info!("Turn {} completed with confidence: {}", turn, final_confidence);
            
            // Check if we've reached minimum confidence
            if final_confidence >= min_confidence {
                info!("Evolution completed successfully in {} turns", turn);
                break;
            }
            
            // Update co-evolution metrics
            if let Ok(mut metrics) = self.metrics.write().await {
                metrics.update(0.7, final_confidence); // Simple placeholder values
            }
        }
        
        let total_time = SystemTime::now()
            .duration_since(start_time)
            .unwrap_or_default();
        
        let result = EvolutionResult {
            solution: current_solution,
            final_confidence,
            turns_taken: verification_history.len() as u32,
            verification_history,
            generation_history,
            metrics: EvolutionResultMetrics {
                total_time_ms: total_time.as_millis() as u64,
                verification_time_ms: total_time.as_millis() as u64 / 2,
                generation_time_ms: total_time.as_millis() as u64 / 2,
                api_calls_made: 5, // Placeholder
                tokens_generated: 1000, // Placeholder
                tokens_verified: 500, // Placeholder
            },
            timestamp: SystemTime::now(),
        };
        
        // Store in cache if available
        if let Some(cache) = &self.cache {
            let cache_key = cache.generate_cache_key(problem, &context);
            let _ = cache.set(&cache_key, &result).await;
        }
        
        // Store in history
        self.evolution_history.insert(session_id, result.clone());
        
        Ok(result)
    }
    
    /// Verify a solution
    pub async fn verify_solution(&self, solution: &str, problem: &str) -> EvolutionResult<VerificationResult> {
        self.verifier.verify(solution, problem).await
    }
    
    /// Get evolution metrics
    pub async fn get_metrics(&self) -> EvolutionResult<CoEvolutionMetrics> {
        let metrics = self.metrics.read().await;
        Ok(metrics.clone())
    }
    
    /// Get evolution history
    pub fn get_history(&self) -> Vec<EvolutionResult> {
        self.evolution_history.iter().map(|entry| entry.value().clone()).collect()
    }
}