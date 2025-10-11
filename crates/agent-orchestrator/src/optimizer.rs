//! Performance Optimization and Learning Engine
//!
//! This module provides performance optimization capabilities for agents
//! including learning engines and adaptive strategies.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Performance optimizer for agents and workflows
#[derive(Debug)]
pub struct PerformanceOptimizer {
    pub config: OptimizationConfig,
    pub learning_engine: LearningEngine,
}

/// Configuration for optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationConfig {
    pub learning_rate: f64,
    pub adaptation_threshold: f64,
    pub performance_window: usize,
    pub auto_scaling_enabled: bool,
    pub resource_limits: ResourceLimits,
}

/// Resource limits for optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_agents: usize,
    pub max_memory_mb: usize,
    pub max_cpu_percent: f64,
    pub max_concurrent_tasks: usize,
}

/// Learning engine for continuous improvement
#[derive(Debug)]
pub struct LearningEngine {
    pub agent_performance: HashMap<Uuid, PerformanceHistory>,
    pub optimization_strategies: Vec<OptimizationStrategy>,
}

/// Performance history for learning
#[derive(Debug, Clone)]
pub struct PerformanceHistory {
    pub agent_id: Uuid,
    pub execution_times: Vec<f64>,
    pub success_rates: Vec<f64>,
    pub resource_usage: Vec<f64>,
}

/// Optimization strategies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OptimizationStrategy {
    ResourceAllocation,
    TaskPrioritization,
    CacheOptimization,
    LoadBalancing,
}

impl PerformanceOptimizer {
    pub fn new(config: OptimizationConfig) -> Self {
        Self {
            config,
            learning_engine: LearningEngine::new(),
        }
    }
}

impl LearningEngine {
    pub fn new() -> Self {
        Self {
            agent_performance: HashMap::new(),
            optimization_strategies: vec![
                OptimizationStrategy::ResourceAllocation,
                OptimizationStrategy::TaskPrioritization,
            ],
        }
    }
}

impl Default for OptimizationConfig {
    fn default() -> Self {
        Self {
            learning_rate: 0.01,
            adaptation_threshold: 0.1,
            performance_window: 100,
            auto_scaling_enabled: true,
            resource_limits: ResourceLimits {
                max_agents: 50,
                max_memory_mb: 2048,
                max_cpu_percent: 80.0,
                max_concurrent_tasks: 100,
            },
        }
    }
}