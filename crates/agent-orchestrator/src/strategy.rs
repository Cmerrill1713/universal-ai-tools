//! Orchestration Strategy Management
//!
//! This module provides strategic planning capabilities for orchestration
//! including adaptive strategies and decision making.

use serde::{Deserialize, Serialize};

/// Orchestration strategy interface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrchestrationStrategy {
    RoundRobin,
    LoadBalanced,
    PriorityBased,
    Adaptive { adaptation_rate: f64 },
    Custom { strategy_name: String },
}

/// Adaptive strategy implementation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptiveStrategy {
    pub adaptation_rate: f64,
    pub performance_threshold: f64,
    pub learning_enabled: bool,
    pub fallback_strategy: Box<OrchestrationStrategy>,
}

impl AdaptiveStrategy {
    pub fn new(adaptation_rate: f64) -> Self {
        Self {
            adaptation_rate,
            performance_threshold: 0.8,
            learning_enabled: true,
            fallback_strategy: Box::new(OrchestrationStrategy::LoadBalanced),
        }
    }
}

impl Default for OrchestrationStrategy {
    fn default() -> Self {
        OrchestrationStrategy::Adaptive { adaptation_rate: 0.1 }
    }
}