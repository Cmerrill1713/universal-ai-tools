//! Memory Management - AI Core memory optimization and monitoring

use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};

use serde::Serialize;
use tokio::sync::RwLock;
use tracing::{info, warn, error, instrument};

/// Memory optimization result
#[derive(Debug, Clone, Serialize)]
pub struct MemoryOptimizationResult {
    pub memory_freed_mb: f64,
    pub duration_ms: u64,
    pub operations_performed: Vec<String>,
    pub memory_before_mb: f64,
    pub memory_after_mb: f64,
    pub optimization_level: OptimizationLevel,
}

/// Memory optimization level
#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum OptimizationLevel {
    Light,
    Standard,
    Aggressive,
    Emergency,
}

/// Memory usage statistics
#[derive(Debug, Clone, Serialize)]
pub struct MemoryStats {
    pub total_mb: f64,
    pub used_mb: f64,
    pub available_mb: f64,
    pub cache_mb: f64,
    pub buffers_mb: f64,
    pub swap_used_mb: f64,
    pub heap_size_mb: f64,
    pub gc_count: u64,
    pub last_gc_duration_ms: u64,
}

/// Memory pressure level
#[derive(Debug, Clone, PartialEq)]
pub enum MemoryPressure {
    Low,
    Moderate,
    High,
    Critical,
}

/// Memory threshold configuration
#[derive(Debug, Clone)]
struct MemoryThresholds {
    warning_mb: f64,
    critical_mb: f64,
    emergency_mb: f64,
}

/// Memory manager for AI Core service
pub struct MemoryManager {
    stats: Arc<RwLock<MemoryStats>>,
    thresholds: MemoryThresholds,
    last_optimization: Arc<RwLock<Option<Instant>>>,
    optimization_history: Arc<RwLock<Vec<MemoryOptimizationResult>>>,
}

impl MemoryManager {
    /// Create new memory manager
    pub fn new() -> Self {
        Self {
            stats: Arc::new(RwLock::new(MemoryStats {
                total_mb: 0.0,
                used_mb: 0.0,
                available_mb: 0.0,
                cache_mb: 0.0,
                buffers_mb: 0.0,
                swap_used_mb: 0.0,
                heap_size_mb: 0.0,
                gc_count: 0,
                last_gc_duration_ms: 0,
            })),
            thresholds: MemoryThresholds {
                warning_mb: 512.0,
                critical_mb: 768.0,
                emergency_mb: 1024.0,
            },
            last_optimization: Arc::new(RwLock::new(None)),
            optimization_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Get current memory usage in MB
    #[instrument(skip(self))]
    pub async fn get_current_usage_mb(&self) -> f64 {
        self.update_memory_stats().await;
        let stats = self.stats.read().await;
        stats.used_mb
    }

    /// Check if memory pressure is high
    pub async fn is_memory_pressure_high(&self) -> bool {
        let pressure = self.get_memory_pressure().await;
        matches!(pressure, MemoryPressure::High | MemoryPressure::Critical)
    }

    /// Get current memory pressure level
    pub async fn get_memory_pressure(&self) -> MemoryPressure {
        let current_usage = self.get_current_usage_mb().await;
        
        if current_usage >= self.thresholds.emergency_mb {
            MemoryPressure::Critical
        } else if current_usage >= self.thresholds.critical_mb {
            MemoryPressure::High
        } else if current_usage >= self.thresholds.warning_mb {
            MemoryPressure::Moderate
        } else {
            MemoryPressure::Low
        }
    }

    /// Optimize memory usage
    #[instrument(skip(self))]
    pub async fn optimize(&self) -> Result<MemoryOptimizationResult, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = Instant::now();
        let memory_before = self.get_current_usage_mb().await;
        let pressure = self.get_memory_pressure().await;
        
        let optimization_level = match pressure {
            MemoryPressure::Critical => OptimizationLevel::Emergency,
            MemoryPressure::High => OptimizationLevel::Aggressive,
            MemoryPressure::Moderate => OptimizationLevel::Standard,
            MemoryPressure::Low => OptimizationLevel::Light,
        };

        info!(
            memory_before_mb = memory_before,
            optimization_level = ?optimization_level,
            "Starting memory optimization"
        );

        let mut operations = Vec::new();

        // Perform optimization based on level
        match optimization_level {
            OptimizationLevel::Light => {
                self.light_optimization(&mut operations).await?;
            }
            OptimizationLevel::Standard => {
                self.light_optimization(&mut operations).await?;
                self.standard_optimization(&mut operations).await?;
            }
            OptimizationLevel::Aggressive => {
                self.light_optimization(&mut operations).await?;
                self.standard_optimization(&mut operations).await?;
                self.aggressive_optimization(&mut operations).await?;
            }
            OptimizationLevel::Emergency => {
                self.light_optimization(&mut operations).await?;
                self.standard_optimization(&mut operations).await?;
                self.aggressive_optimization(&mut operations).await?;
                self.emergency_optimization(&mut operations).await?;
            }
        }

        // Update last optimization time
        {
            let mut last_opt = self.last_optimization.write().await;
            *last_opt = Some(start_time);
        }

        let memory_after = self.get_current_usage_mb().await;
        let memory_freed = (memory_before - memory_after).max(0.0);
        let duration = start_time.elapsed().as_millis() as u64;

        let result = MemoryOptimizationResult {
            memory_freed_mb: memory_freed,
            duration_ms: duration,
            operations_performed: operations,
            memory_before_mb: memory_before,
            memory_after_mb: memory_after,
            optimization_level,
        };

        // Store in history
        {
            let mut history = self.optimization_history.write().await;
            history.push(result.clone());
            
            // Keep only last 10 optimization results
            if history.len() > 10 {
                history.remove(0);
            }
        }

        info!(
            memory_freed_mb = memory_freed,
            duration_ms = duration,
            operations_count = result.operations_performed.len(),
            "Memory optimization completed"
        );

        Ok(result)
    }

    /// Light optimization - safe operations
    async fn light_optimization(&self, operations: &mut Vec<String>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Force garbage collection
        self.force_garbage_collection().await?;
        operations.push("Force garbage collection".to_string());

        // Clear expired caches (would integrate with actual cache implementations)
        operations.push("Clear expired caches".to_string());

        Ok(())
    }

    /// Standard optimization - moderate impact
    async fn standard_optimization(&self, operations: &mut Vec<String>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Compact memory allocations
        self.compact_memory().await?;
        operations.push("Compact memory allocations".to_string());

        // Clear non-essential buffers
        operations.push("Clear non-essential buffers".to_string());

        // Optimize data structures
        operations.push("Optimize data structures".to_string());

        Ok(())
    }

    /// Aggressive optimization - higher impact
    async fn aggressive_optimization(&self, operations: &mut Vec<String>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Unload unused models (would integrate with model manager)
        operations.push("Unload unused models".to_string());

        // Clear all caches
        operations.push("Clear all caches".to_string());

        // Compress in-memory data
        operations.push("Compress in-memory data".to_string());

        Ok(())
    }

    /// Emergency optimization - maximum impact
    async fn emergency_optimization(&self, operations: &mut Vec<String>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Emergency garbage collection
        for _ in 0..3 {
            self.force_garbage_collection().await?;
        }
        operations.push("Emergency garbage collection (3x)".to_string());

        // Clear all caches and buffers
        operations.push("Clear all caches and buffers".to_string());

        // Reduce precision of floating point calculations
        operations.push("Reduce calculation precision".to_string());

        // Emergency compaction
        operations.push("Emergency memory compaction".to_string());

        warn!("Emergency memory optimization performed - system under severe memory pressure");

        Ok(())
    }

    /// Force garbage collection
    async fn force_garbage_collection(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let start_time = Instant::now();
        
        // In a real implementation, this would trigger actual GC
        // For now, we simulate the operation
        tokio::time::sleep(Duration::from_millis(10)).await;
        
        let duration = start_time.elapsed().as_millis() as u64;
        
        // Update GC stats
        {
            let mut stats = self.stats.write().await;
            stats.gc_count += 1;
            stats.last_gc_duration_ms = duration;
        }

        Ok(())
    }

    /// Compact memory allocations
    async fn compact_memory(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Simulate memory compaction
        tokio::time::sleep(Duration::from_millis(50)).await;
        Ok(())
    }

    /// Update memory statistics
    async fn update_memory_stats(&self) {
        // In a real implementation, this would use system APIs to get actual memory usage
        // For now, we simulate realistic values
        
        let mut stats = self.stats.write().await;
        
        // Simulate memory usage that varies over time
        let base_usage = 256.0; // Base 256MB
        let variation = (SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)
            .unwrap().as_secs() % 100) as f64 * 2.0;
        
        stats.used_mb = base_usage + variation;
        stats.total_mb = 8192.0; // 8GB total
        stats.available_mb = stats.total_mb - stats.used_mb;
        stats.cache_mb = stats.used_mb * 0.3;
        stats.buffers_mb = stats.used_mb * 0.1;
        stats.swap_used_mb = 0.0;
        stats.heap_size_mb = stats.used_mb * 0.8;
    }

    /// Get detailed memory statistics
    pub async fn get_memory_stats(&self) -> MemoryStats {
        self.update_memory_stats().await;
        let stats = self.stats.read().await;
        stats.clone()
    }

    /// Get optimization history
    pub async fn get_optimization_history(&self) -> Vec<MemoryOptimizationResult> {
        let history = self.optimization_history.read().await;
        history.clone()
    }

    /// Check if optimization is needed
    pub async fn should_optimize(&self) -> bool {
        let pressure = self.get_memory_pressure().await;
        
        // Always optimize if high pressure
        if matches!(pressure, MemoryPressure::High | MemoryPressure::Critical) {
            return true;
        }

        // Check if enough time has passed since last optimization
        let last_opt = self.last_optimization.read().await;
        if let Some(last_time) = *last_opt {
            let elapsed = last_time.elapsed();
            
            // Optimize every 5 minutes under moderate pressure
            if matches!(pressure, MemoryPressure::Moderate) && elapsed > Duration::from_secs(300) {
                return true;
            }
            
            // Optimize every 15 minutes under low pressure
            if matches!(pressure, MemoryPressure::Low) && elapsed > Duration::from_secs(900) {
                return true;
            }
        } else {
            // Never optimized before
            return true;
        }

        false
    }

    /// Set memory thresholds
    pub fn set_thresholds(&mut self, warning_mb: f64, critical_mb: f64, emergency_mb: f64) {
        self.thresholds = MemoryThresholds {
            warning_mb,
            critical_mb,
            emergency_mb,
        };
        
        info!(
            warning_mb = warning_mb,
            critical_mb = critical_mb,
            emergency_mb = emergency_mb,
            "Updated memory thresholds"
        );
    }

    /// Get memory thresholds
    pub fn get_thresholds(&self) -> (f64, f64, f64) {
        (
            self.thresholds.warning_mb,
            self.thresholds.critical_mb,
            self.thresholds.emergency_mb,
        )
    }

    /// Start automatic memory monitoring
    pub fn start_monitoring(&self) {
        let memory_manager = self.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                if memory_manager.should_optimize().await {
                    info!("Automatic memory optimization triggered");
                    
                    if let Err(e) = memory_manager.optimize().await {
                        error!(error = %e, "Automatic memory optimization failed");
                    }
                }
            }
        });
    }
}

impl Clone for MemoryManager {
    fn clone(&self) -> Self {
        Self {
            stats: self.stats.clone(),
            thresholds: self.thresholds.clone(),
            last_optimization: self.last_optimization.clone(),
            optimization_history: self.optimization_history.clone(),
        }
    }
}