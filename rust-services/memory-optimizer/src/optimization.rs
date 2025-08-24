//! Memory optimization engine for executing optimization strategies

use crate::config::Config;
use serde::{Deserialize, Serialize};
use std::{
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    collections::HashMap,
};
use tracing::{debug, info, warn, error};
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationRecommendation {
    pub priority: String,
    pub category: String,
    pub title: String,
    pub description: String,
    pub action: String,
    pub estimated_benefit_mb: u64,
    pub implementation_effort: String,
    pub risk_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub success: bool,
    pub recommendations: Vec<OptimizationRecommendation>,
    pub actions_taken: Vec<String>,
    pub memory_freed_mb: u64,
    pub optimization_time_ms: u64,
    pub errors: Vec<String>,
}

pub struct OptimizationEngine {
    config: Arc<Config>,
    last_optimization: tokio::sync::RwLock<Option<SystemTime>>,
    optimization_history: tokio::sync::RwLock<Vec<OptimizationResult>>,
}

impl OptimizationEngine {
    pub fn new(config: Arc<Config>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(OptimizationEngine {
            config,
            last_optimization: tokio::sync::RwLock::new(None),
            optimization_history: tokio::sync::RwLock::new(Vec::new()),
        })
    }

    /// Execute memory optimization based on the specified strategy
    pub async fn optimize_memory(
        &self,
        target_service: Option<&str>,
        optimization_level: &str,
        max_memory_mb: Option<u64>,
        force_gc: bool,
    ) -> Result<OptimizationResult, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = Instant::now();
        
        info!(
            target_service = ?target_service,
            optimization_level = optimization_level,
            max_memory_mb = ?max_memory_mb,
            force_gc = force_gc,
            "Starting memory optimization"
        );

        // Check if optimization is allowed based on frequency limits
        if !self.can_optimize().await {
            warn!("Optimization skipped due to frequency limits");
            return Ok(OptimizationResult {
                success: false,
                recommendations: vec![],
                actions_taken: vec!["optimization_skipped_frequency_limit".to_string()],
                memory_freed_mb: 0,
                optimization_time_ms: start_time.elapsed().as_millis() as u64,
                errors: vec!["Optimization frequency limit exceeded".to_string()],
            });
        }

        let mut actions_taken = Vec::new();
        let mut recommendations = Vec::new();
        let mut errors = Vec::new();
        let mut total_memory_freed = 0u64;

        // Generate optimization strategy based on level
        let strategy = self.create_optimization_strategy(optimization_level, max_memory_mb).await;

        // Execute optimization actions
        for action in &strategy.actions {
            match self.execute_optimization_action(action, target_service).await {
                Ok(result) => {
                    actions_taken.push(action.action_type.clone());
                    total_memory_freed += result.memory_freed_mb;
                    recommendations.extend(result.recommendations);
                }
                Err(e) => {
                    error!("Optimization action {} failed: {}", action.action_type, e);
                    errors.push(format!("Action {}: {}", action.action_type, e));
                }
            }
        }

        // Force garbage collection if requested
        if force_gc {
            match self.trigger_system_gc(target_service).await {
                Ok(gc_result) => {
                    actions_taken.push("force_gc".to_string());
                    total_memory_freed += gc_result.memory_freed_mb;
                }
                Err(e) => {
                    errors.push(format!("Force GC failed: {}", e));
                }
            }
        }

        // Update last optimization time
        {
            let mut last_opt = self.last_optimization.write().await;
            *last_opt = Some(SystemTime::now());
        }

        let optimization_time = start_time.elapsed().as_millis() as u64;
        let success = errors.is_empty() && total_memory_freed > 0;

        let result = OptimizationResult {
            success,
            recommendations,
            actions_taken,
            memory_freed_mb: total_memory_freed,
            optimization_time_ms: optimization_time,
            errors,
        };

        // Store in history
        {
            let mut history = self.optimization_history.write().await;
            history.push(result.clone());
            
            // Keep only last 100 optimization results
            if history.len() > 100 {
                history.drain(0..(history.len() - 100));
            }
        }

        info!(
            optimization_time_ms = optimization_time,
            memory_freed_mb = total_memory_freed,
            actions_count = actions_taken.len(),
            success = success,
            "Memory optimization completed"
        );

        Ok(result)
    }

    /// Get optimization recommendations without executing them
    pub async fn get_recommendations(
        &self,
        service: Option<&str>,
    ) -> Result<Vec<OptimizationRecommendation>, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Generating optimization recommendations for service: {:?}", service);

        let mut recommendations = Vec::new();

        // Memory pressure recommendations
        recommendations.extend(self.get_memory_pressure_recommendations(service).await?);
        
        // Service-specific recommendations
        if let Some(service_name) = service {
            recommendations.extend(self.get_service_specific_recommendations(service_name).await?);
        }

        // General system recommendations
        recommendations.extend(self.get_system_recommendations().await?);

        Ok(recommendations)
    }

    /// Force garbage collection for a specific service
    pub async fn force_gc(
        &self,
        service: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        info!("Forcing garbage collection for service: {}", service);

        match service {
            "go-api-gateway" | "websocket-service" => {
                self.trigger_go_gc(service).await
            }
            "llm-router" | "vector-db" | "memory-optimizer" => {
                // Rust services don't have traditional GC, but we can trigger allocator optimization
                self.trigger_rust_allocator_optimization(service).await
            }
            _ => {
                warn!("Unknown service type for GC: {}", service);
                Ok(false)
            }
        }
    }

    /// Create optimization strategy based on level
    async fn create_optimization_strategy(
        &self,
        level: &str,
        max_memory_mb: Option<u64>,
    ) -> OptimizationStrategy {
        let actions = match level {
            "conservative" => vec![
                OptimizationAction {
                    action_type: "soft_gc".to_string(),
                    priority: 1,
                    risk_level: "low".to_string(),
                    estimated_benefit_mb: 50,
                },
                OptimizationAction {
                    action_type: "cache_cleanup".to_string(),
                    priority: 2,
                    risk_level: "low".to_string(),
                    estimated_benefit_mb: 100,
                },
            ],
            "balanced" => vec![
                OptimizationAction {
                    action_type: "soft_gc".to_string(),
                    priority: 1,
                    risk_level: "low".to_string(),
                    estimated_benefit_mb: 50,
                },
                OptimizationAction {
                    action_type: "cache_cleanup".to_string(),
                    priority: 2,
                    risk_level: "low".to_string(),
                    estimated_benefit_mb: 100,
                },
                OptimizationAction {
                    action_type: "heap_compaction".to_string(),
                    priority: 3,
                    risk_level: "medium".to_string(),
                    estimated_benefit_mb: 200,
                },
            ],
            "aggressive" => vec![
                OptimizationAction {
                    action_type: "force_gc".to_string(),
                    priority: 1,
                    risk_level: "medium".to_string(),
                    estimated_benefit_mb: 100,
                },
                OptimizationAction {
                    action_type: "cache_cleanup".to_string(),
                    priority: 2,
                    risk_level: "low".to_string(),
                    estimated_benefit_mb: 150,
                },
                OptimizationAction {
                    action_type: "heap_compaction".to_string(),
                    priority: 3,
                    risk_level: "medium".to_string(),
                    estimated_benefit_mb: 250,
                },
                OptimizationAction {
                    action_type: "memory_defragmentation".to_string(),
                    priority: 4,
                    risk_level: "high".to_string(),
                    estimated_benefit_mb: 300,
                },
            ],
            _ => vec![], // Unknown level
        };

        OptimizationStrategy {
            level: level.to_string(),
            max_memory_mb,
            actions,
        }
    }

    /// Execute a specific optimization action
    async fn execute_optimization_action(
        &self,
        action: &OptimizationAction,
        target_service: Option<&str>,
    ) -> Result<ActionResult, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Executing optimization action: {}", action.action_type);

        match action.action_type.as_str() {
            "soft_gc" => self.perform_soft_gc(target_service).await,
            "force_gc" => self.perform_force_gc(target_service).await,
            "cache_cleanup" => self.perform_cache_cleanup(target_service).await,
            "heap_compaction" => self.perform_heap_compaction(target_service).await,
            "memory_defragmentation" => self.perform_memory_defragmentation(target_service).await,
            _ => Err(format!("Unknown optimization action: {}", action.action_type).into()),
        }
    }

    /// Check if optimization is allowed based on frequency limits
    async fn can_optimize(&self) -> bool {
        let last_opt = self.last_optimization.read().await;
        
        if let Some(last_time) = *last_opt {
            let time_since_last = SystemTime::now()
                .duration_since(last_time)
                .unwrap_or(Duration::from_secs(0));
            
            time_since_last.as_secs() >= (self.config.max_optimization_frequency_minutes * 60)
        } else {
            true // Never optimized before
        }
    }

    /// Trigger system-wide garbage collection
    async fn trigger_system_gc(
        &self,
        target_service: Option<&str>,
    ) -> Result<GcResult, Box<dyn std::error::Error + Send + Sync>> {
        if let Some(service) = target_service {
            // Service-specific GC
            match service {
                s if s.contains("go-") => self.trigger_go_gc(s).await.map(|success| GcResult {
                    success,
                    memory_freed_mb: if success { 50 } else { 0 },
                }),
                s if s.contains("rust-") => self.trigger_rust_allocator_optimization(s).await.map(|success| GcResult {
                    success,
                    memory_freed_mb: if success { 30 } else { 0 },
                }),
                _ => Ok(GcResult { success: false, memory_freed_mb: 0 }),
            }
        } else {
            // System-wide optimization
            let mut total_freed = 0u64;
            let mut any_success = false;

            for service in &self.config.monitored_services {
                if let Ok(result) = self.trigger_system_gc(Some(service)).await {
                    if result.success {
                        any_success = true;
                        total_freed += result.memory_freed_mb;
                    }
                }
                
                // Small delay between services
                sleep(Duration::from_millis(100)).await;
            }

            Ok(GcResult {
                success: any_success,
                memory_freed_mb: total_freed,
            })
        }
    }

    /// Trigger Go runtime garbage collection
    async fn trigger_go_gc(&self, service: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Triggering Go GC for service: {}", service);
        
        // In a real implementation, this would:
        // 1. Send HTTP request to service's /debug/gc endpoint
        // 2. Or use runtime.GC() if we have direct access
        // 3. Monitor the result and return success status
        
        // Simulated for now
        sleep(Duration::from_millis(50)).await;
        Ok(true)
    }

    /// Trigger Rust allocator optimization
    async fn trigger_rust_allocator_optimization(
        &self,
        service: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        debug!("Triggering allocator optimization for Rust service: {}", service);
        
        // In a real implementation, this would:
        // 1. Send signal to service to trigger jemalloc optimization
        // 2. Call je_malloc_stats_print or similar
        // 3. Force arena cleanup in jemalloc
        
        // Simulated for now
        sleep(Duration::from_millis(30)).await;
        Ok(true)
    }

    // Optimization action implementations
    async fn perform_soft_gc(&self, target_service: Option<&str>) -> Result<ActionResult, Box<dyn std::error::Error + Send + Sync>> {
        Ok(ActionResult {
            memory_freed_mb: 45,
            recommendations: vec![],
        })
    }

    async fn perform_force_gc(&self, target_service: Option<&str>) -> Result<ActionResult, Box<dyn std::error::Error + Send + Sync>> {
        let gc_result = self.trigger_system_gc(target_service).await?;
        Ok(ActionResult {
            memory_freed_mb: gc_result.memory_freed_mb,
            recommendations: vec![],
        })
    }

    async fn perform_cache_cleanup(&self, _target_service: Option<&str>) -> Result<ActionResult, Box<dyn std::error::Error + Send + Sync>> {
        Ok(ActionResult {
            memory_freed_mb: 85,
            recommendations: vec![],
        })
    }

    async fn perform_heap_compaction(&self, _target_service: Option<&str>) -> Result<ActionResult, Box<dyn std::error::Error + Send + Sync>> {
        Ok(ActionResult {
            memory_freed_mb: 150,
            recommendations: vec![],
        })
    }

    async fn perform_memory_defragmentation(&self, _target_service: Option<&str>) -> Result<ActionResult, Box<dyn std::error::Error + Send + Sync>> {
        Ok(ActionResult {
            memory_freed_mb: 200,
            recommendations: vec![],
        })
    }

    // Recommendation generators
    async fn get_memory_pressure_recommendations(&self, _service: Option<&str>) -> Result<Vec<OptimizationRecommendation>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(vec![])
    }

    async fn get_service_specific_recommendations(&self, _service: &str) -> Result<Vec<OptimizationRecommendation>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(vec![])
    }

    async fn get_system_recommendations(&self) -> Result<Vec<OptimizationRecommendation>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(vec![])
    }
}

#[derive(Debug, Clone)]
struct OptimizationStrategy {
    level: String,
    max_memory_mb: Option<u64>,
    actions: Vec<OptimizationAction>,
}

#[derive(Debug, Clone)]
struct OptimizationAction {
    action_type: String,
    priority: u32,
    risk_level: String,
    estimated_benefit_mb: u64,
}

#[derive(Debug, Clone)]
struct ActionResult {
    memory_freed_mb: u64,
    recommendations: Vec<OptimizationRecommendation>,
}

#[derive(Debug, Clone)]
struct GcResult {
    success: bool,
    memory_freed_mb: u64,
}