//! Memory Optimization Engine
//!
//! Intelligent memory management system with pressure detection,
//! garbage collection optimization, and resource allocation strategies.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error, instrument};
use uuid::Uuid;

pub mod monitor;
pub mod allocator;
pub mod gc_optimizer;
pub mod pressure_detector;
pub mod strategies;
pub mod metrics;

pub use monitor::{MemoryMonitor, SystemMemoryInfo};
pub use allocator::{SmartAllocator, AllocationStrategy};
pub use gc_optimizer::{GCOptimizer, GCStrategy};
pub use pressure_detector::{PressureDetector, MemoryPressureLevel};
pub use strategies::{OptimizationStrategy, MemoryStrategy};
pub use metrics::MemoryMetrics;

/// Main memory optimization engine
pub struct MemoryOptimizer {
    monitor: Arc<MemoryMonitor>,
    allocator: Arc<SmartAllocator>,
    gc_optimizer: Arc<GCOptimizer>,
    pressure_detector: Arc<PressureDetector>,
    strategies: Arc<RwLock<Vec<Box<dyn OptimizationStrategy>>>>,
    metrics: Arc<MemoryMetrics>,
    config: MemoryOptimizerConfig,
    state: Arc<RwLock<OptimizerState>>,
}

/// Configuration for the memory optimizer
#[derive(Debug, Clone, Deserialize)]
pub struct MemoryOptimizerConfig {
    /// Enable automatic memory optimization
    pub auto_optimization: bool,
    /// Memory pressure thresholds
    pub pressure_thresholds: PressureThresholds,
    /// Garbage collection configuration
    pub gc_config: GCConfig,
    /// Monitoring interval in seconds
    pub monitor_interval_seconds: u64,
    /// Maximum memory usage limit in MB
    pub max_memory_mb: Option<u64>,
    /// Strategies to enable
    pub enabled_strategies: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PressureThresholds {
    pub low_threshold_percent: f64,
    pub medium_threshold_percent: f64,
    pub high_threshold_percent: f64,
    pub critical_threshold_percent: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GCConfig {
    pub strategy: String, // "aggressive", "balanced", "conservative"
    pub trigger_threshold_percent: f64,
    pub force_gc_threshold_percent: f64,
    pub min_gc_interval_seconds: u64,
}

/// Current state of the memory optimizer
#[derive(Debug, Clone)]
struct OptimizerState {
    running: bool,
    last_optimization: Option<chrono::DateTime<chrono::Utc>>,
    current_pressure: MemoryPressureLevel,
    active_strategies: Vec<String>,
    optimization_history: Vec<OptimizationEvent>,
}

/// Memory optimization event record
#[derive(Debug, Clone, Serialize)]
pub struct OptimizationEvent {
    pub id: Uuid,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub event_type: OptimizationEventType,
    pub strategy: String,
    pub memory_before_mb: u64,
    pub memory_after_mb: u64,
    pub memory_freed_mb: u64,
    pub success: bool,
    pub duration_ms: u64,
    pub details: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub enum OptimizationEventType {
    PressureDetected,
    GarbageCollection,
    CacheEviction,
    MemoryReallocation,
    StrategyActivated,
    StrategyDeactivated,
    EmergencyCleanup,
}

/// Memory optimization result
#[derive(Debug, Clone, Serialize)]
pub struct OptimizationResult {
    pub success: bool,
    pub memory_freed_mb: u64,
    pub strategies_applied: Vec<String>,
    pub duration_ms: u64,
    pub pressure_level_before: MemoryPressureLevel,
    pub pressure_level_after: MemoryPressureLevel,
    pub events: Vec<OptimizationEvent>,
}

impl MemoryOptimizer {
    /// Create a new memory optimizer
    #[instrument(skip(config))]
    pub async fn new(config: MemoryOptimizerConfig) -> Result<Self> {
        info!("Initializing Memory Optimizer");

        let monitor = Arc::new(MemoryMonitor::new().await?);
        let allocator = Arc::new(SmartAllocator::new(config.clone()).await?);
        let gc_optimizer = Arc::new(GCOptimizer::new(config.gc_config.clone()).await?);
        let pressure_detector = Arc::new(PressureDetector::new(config.pressure_thresholds.clone())?);
        let metrics = Arc::new(MemoryMetrics::new()?);

        // Initialize strategies
        let mut strategies: Vec<Box<dyn OptimizationStrategy>> = Vec::new();
        for strategy_name in &config.enabled_strategies {
            match strategies::create_strategy(strategy_name) {
                Ok(strategy) => strategies.push(strategy),
                Err(e) => warn!("Failed to create strategy {}: {}", strategy_name, e),
            }
        }

        let state = Arc::new(RwLock::new(OptimizerState {
            running: false,
            last_optimization: None,
            current_pressure: MemoryPressureLevel::Low,
            active_strategies: Vec::new(),
            optimization_history: Vec::new(),
        }));

        Ok(Self {
            monitor,
            allocator,
            gc_optimizer,
            pressure_detector,
            strategies: Arc::new(RwLock::new(strategies)),
            metrics,
            config,
            state,
        })
    }

    /// Start the memory optimization engine
    #[instrument(skip(self))]
    pub async fn start(&self) -> Result<()> {
        info!("Starting Memory Optimizer");

        {
            let mut state = self.state.write().await;
            if state.running {
                return Ok(()); // Already running
            }
            state.running = true;
        }

        // Start monitoring task
        let monitor_handle = self.start_monitoring_task().await?;

        // Start optimization loop
        let optimization_handle = self.start_optimization_loop().await?;

        info!("Memory Optimizer started successfully");
        Ok(())
    }

    /// Stop the memory optimization engine
    pub async fn stop(&self) -> Result<()> {
        info!("Stopping Memory Optimizer");
        
        let mut state = self.state.write().await;
        state.running = false;
        
        info!("Memory Optimizer stopped");
        Ok(())
    }

    /// Perform immediate memory optimization
    #[instrument(skip(self))]
    pub async fn optimize_now(&self) -> Result<OptimizationResult> {
        info!("Starting immediate memory optimization");
        let start_time = std::time::Instant::now();

        // Get current memory state
        let memory_info_before = self.monitor.get_memory_info().await?;
        let pressure_before = self.pressure_detector.detect_pressure(&memory_info_before).await?;

        let mut events = Vec::new();
        let mut strategies_applied = Vec::new();

        // Execute optimization strategies based on pressure level
        let strategies = self.strategies.read().await;
        for strategy in strategies.iter() {
            if strategy.should_execute(&pressure_before, &memory_info_before).await? {
                match strategy.execute(&memory_info_before).await {
                    Ok(event) => {
                        strategies_applied.push(strategy.name().to_string());
                        events.push(event);
                        
                        // Update metrics
                        self.metrics.record_strategy_execution(strategy.name(), true).await;
                    }
                    Err(e) => {
                        error!("Strategy {} failed: {}", strategy.name(), e);
                        self.metrics.record_strategy_execution(strategy.name(), false).await;
                    }
                }
            }
        }

        // Force garbage collection if pressure is high
        if matches!(pressure_before, MemoryPressureLevel::High | MemoryPressureLevel::Critical) {
            if let Ok(gc_event) = self.gc_optimizer.force_gc().await {
                events.push(gc_event);
                strategies_applied.push("force_gc".to_string());
            }
        }

        // Get memory state after optimization
        let memory_info_after = self.monitor.get_memory_info().await?;
        let pressure_after = self.pressure_detector.detect_pressure(&memory_info_after).await?;

        let duration = start_time.elapsed().as_millis() as u64;
        let memory_freed = memory_info_before.used_mb.saturating_sub(memory_info_after.used_mb);

        let result = OptimizationResult {
            success: !events.is_empty(),
            memory_freed_mb: memory_freed,
            strategies_applied,
            duration_ms: duration,
            pressure_level_before: pressure_before,
            pressure_level_after: pressure_after,
            events,
        };

        // Update state
        {
            let mut state = self.state.write().await;
            state.last_optimization = Some(chrono::Utc::now());
            state.current_pressure = pressure_after;
            // Keep only last 100 events
            if state.optimization_history.len() >= 100 {
                state.optimization_history.remove(0);
            }
        }

        // Record metrics
        self.metrics.record_optimization(&result).await;

        info!(
            memory_freed_mb = memory_freed,
            strategies_count = result.strategies_applied.len(),
            duration_ms = duration,
            "Memory optimization completed"
        );

        Ok(result)
    }

    /// Get current memory status
    pub async fn get_memory_status(&self) -> Result<MemoryStatus> {
        let memory_info = self.monitor.get_memory_info().await?;
        let pressure_level = self.pressure_detector.detect_pressure(&memory_info).await?;
        let state = self.state.read().await;

        Ok(MemoryStatus {
            memory_info,
            pressure_level,
            optimizer_running: state.running,
            last_optimization: state.last_optimization,
            active_strategies: state.active_strategies.clone(),
            total_optimizations: state.optimization_history.len(),
        })
    }

    /// Get optimization history
    pub async fn get_optimization_history(&self, limit: Option<usize>) -> Result<Vec<OptimizationEvent>> {
        let state = self.state.read().await;
        let events = &state.optimization_history;
        
        let limit = limit.unwrap_or(50);
        if events.len() <= limit {
            Ok(events.clone())
        } else {
            Ok(events[events.len() - limit..].to_vec())
        }
    }

    /// Start monitoring task
    async fn start_monitoring_task(&self) -> Result<()> {
        let monitor = self.monitor.clone();
        let interval = self.config.monitor_interval_seconds;
        let metrics = self.metrics.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval));
            
            loop {
                interval.tick().await;
                
                match monitor.collect_metrics().await {
                    Ok(_) => {
                        if let Ok(memory_info) = monitor.get_memory_info().await {
                            metrics.record_memory_usage(&memory_info).await;
                        }
                    }
                    Err(e) => error!("Memory monitoring error: {}", e),
                }
            }
        });

        Ok(())
    }

    /// Start optimization loop
    async fn start_optimization_loop(&self) -> Result<()> {
        let optimizer = Arc::new(self.clone());

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                let state = optimizer.state.read().await;
                if !state.running {
                    break;
                }
                drop(state);

                // Check if optimization is needed
                if let Ok(should_optimize) = optimizer.should_optimize().await {
                    if should_optimize {
                        if let Err(e) = optimizer.optimize_now().await {
                            error!("Automatic optimization failed: {}", e);
                        }
                    }
                }
            }
        });

        Ok(())
    }

    /// Check if optimization should be performed
    async fn should_optimize(&self) -> Result<bool> {
        if !self.config.auto_optimization {
            return Ok(false);
        }

        let memory_info = self.monitor.get_memory_info().await?;
        let pressure = self.pressure_detector.detect_pressure(&memory_info).await?;

        // Optimize if pressure is medium or higher
        Ok(matches!(
            pressure,
            MemoryPressureLevel::Medium | MemoryPressureLevel::High | MemoryPressureLevel::Critical
        ))
    }

    /// Get health information
    pub async fn health_check(&self) -> Result<MemoryOptimizerHealth> {
        let memory_status = self.get_memory_status().await?;
        let state = self.state.read().await;

        Ok(MemoryOptimizerHealth {
            status: "healthy".to_string(),
            memory_usage_mb: memory_status.memory_info.used_mb,
            memory_available_mb: memory_status.memory_info.available_mb,
            pressure_level: memory_status.pressure_level,
            optimizer_running: state.running,
            strategies_count: self.strategies.read().await.len(),
            total_optimizations: state.optimization_history.len(),
        })
    }
}

// Implement Clone for MemoryOptimizer (needed for the optimization loop)
impl Clone for MemoryOptimizer {
    fn clone(&self) -> Self {
        Self {
            monitor: self.monitor.clone(),
            allocator: self.allocator.clone(),
            gc_optimizer: self.gc_optimizer.clone(),
            pressure_detector: self.pressure_detector.clone(),
            strategies: self.strategies.clone(),
            metrics: self.metrics.clone(),
            config: self.config.clone(),
            state: self.state.clone(),
        }
    }
}

/// Memory status information
#[derive(Debug, Clone, Serialize)]
pub struct MemoryStatus {
    pub memory_info: SystemMemoryInfo,
    pub pressure_level: MemoryPressureLevel,
    pub optimizer_running: bool,
    pub last_optimization: Option<chrono::DateTime<chrono::Utc>>,
    pub active_strategies: Vec<String>,
    pub total_optimizations: usize,
}

/// Health information for the memory optimizer
#[derive(Debug, Serialize)]
pub struct MemoryOptimizerHealth {
    pub status: String,
    pub memory_usage_mb: u64,
    pub memory_available_mb: u64,
    pub pressure_level: MemoryPressureLevel,
    pub optimizer_running: bool,
    pub strategies_count: usize,
    pub total_optimizations: usize,
}

/// Default configuration for testing
impl Default for MemoryOptimizerConfig {
    fn default() -> Self {
        Self {
            auto_optimization: true,
            pressure_thresholds: PressureThresholds {
                low_threshold_percent: 50.0,
                medium_threshold_percent: 70.0,
                high_threshold_percent: 85.0,
                critical_threshold_percent: 95.0,
            },
            gc_config: GCConfig {
                strategy: "balanced".to_string(),
                trigger_threshold_percent: 75.0,
                force_gc_threshold_percent: 90.0,
                min_gc_interval_seconds: 30,
            },
            monitor_interval_seconds: 10,
            max_memory_mb: Some(2048), // 2GB default limit
            enabled_strategies: vec![
                "cache_eviction".to_string(),
                "buffer_cleanup".to_string(),
                "connection_pool_resize".to_string(),
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_memory_optimizer_creation() {
        let config = MemoryOptimizerConfig::default();
        let optimizer = MemoryOptimizer::new(config).await.unwrap();
        
        let health = optimizer.health_check().await.unwrap();
        assert_eq!(health.status, "healthy");
        assert!(!health.optimizer_running); // Should start stopped
    }

    #[tokio::test]
    async fn test_memory_status() {
        let config = MemoryOptimizerConfig::default();
        let optimizer = MemoryOptimizer::new(config).await.unwrap();
        
        let status = optimizer.get_memory_status().await.unwrap();
        assert!(status.memory_info.total_mb > 0);
        assert!(!status.optimizer_running);
    }
}