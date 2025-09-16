//! Advanced AI Agent Orchestration System
//!
//! This crate provides sophisticated agent orchestration capabilities including:
//! - AB-MCTS (Alpha-Beta Monte Carlo Tree Search) planning
//! - Hierarchical agent workflows
//! - Dynamic agent spawning and lifecycle management
//! - Advanced context preservation and memory systems
//! - Real-time performance optimization and learning
//! - Production-grade monitoring and observability

pub mod agent;
pub mod mcts;
pub mod workflow;
pub mod memory;
pub mod optimizer;
pub mod monitor;
pub mod strategy;
pub mod context;
pub mod execution;
pub mod recovery;
pub mod recursion;
pub mod context_propagation;
pub mod dynamic_workflow;
pub mod enhanced_orchestrator;

pub use agent::{Agent, AgentConfig, AgentCapability};
pub use mcts::{MCTSPlanner, MCTSNode, SearchStrategy, AgentState, AgentAction};
pub use workflow::{WorkflowOrchestrator, WorkflowGraph, ExecutionPlan};
pub use memory::{ContextStore, MemoryManager};
pub use optimizer::{PerformanceOptimizer, OptimizationStrategy, LearningEngine};
pub use monitor::{OrchestrationMonitor, MetricsCollector, AlertManager};
pub use strategy::{OrchestrationStrategy, AdaptiveStrategy};
pub use context::{ContextManager, ContextWindow, ContextOptimizer};
pub use execution::{ExecutionEngine, TaskExecutor, ResourceManager};
pub use recovery::{RecoveryManager, CircuitBreaker, ErrorRecovery};
pub use recursion::{RecursiveExecutionManager, RecursiveContext, RecursionLimits, RecursionStatistics};
pub use context_propagation::{ContextPropagationManager, ContextSnapshot, PropagationRule, InheritanceStrategy};
pub use dynamic_workflow::{DynamicWorkflowModifier, ModificationRule, AdaptationStrategy, PerformanceAnalyzer};
pub use enhanced_orchestrator::{EnhancedOrchestrator, EnhancedOrchestrationConfig, EnhancedOrchestrationResult};

use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;
use chrono;

#[derive(Error, Debug)]
pub enum OrchestrationError {
    #[error("Agent error: {0}")]
    AgentError(String),

    #[error("MCTS planning failed: {0}")]
    PlanningError(String),

    #[error("Workflow execution failed: {0}")]
    WorkflowError(String),

    #[error("Memory operation failed: {0}")]
    MemoryError(String),

    #[error("Resource exhausted: {0}")]
    ResourceExhausted(String),

    #[error("Timeout after {0} seconds")]
    Timeout(u64),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Recovery failed: {0}")]
    RecoveryError(String),

    #[error("Recursion limit exceeded: {0}")]
    RecursionLimitExceeded(String),

    #[error("Recursion cycle detected")]
    RecursionCycleDetected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationConfig {
    pub mcts_config: MCTSConfig,
    pub agent_config: AgentConfig,
    pub memory_config: MemoryConfig,
    pub optimization_config: OptimizationConfig,
    pub monitoring_config: MonitoringConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCTSConfig {
    pub max_depth: usize,
    pub simulations: usize,
    pub exploration_constant: f64,
    pub timeout_seconds: u64,
    pub parallel_simulations: usize,
    pub use_neural_guidance: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub max_context_length: usize,
    pub compression_threshold: usize,
    pub persistence_enabled: bool,
    pub cache_size: usize,
    pub ttl_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationConfig {
    pub learning_rate: f64,
    pub adaptation_threshold: f64,
    pub performance_window: usize,
    pub auto_scaling_enabled: bool,
    pub resource_limits: ResourceLimits,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_agents: usize,
    pub max_memory_mb: usize,
    pub max_cpu_percent: f64,
    pub max_concurrent_tasks: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub metrics_enabled: bool,
    pub tracing_enabled: bool,
    pub alerts_enabled: bool,
    pub dashboard_port: Option<u16>,
    pub export_interval_seconds: u64,
}

impl Default for MCTSConfig {
    fn default() -> Self {
        Self {
            max_depth: 10,
            simulations: 1000,
            exploration_constant: 1.414,
            timeout_seconds: 30,
            parallel_simulations: 4,
            use_neural_guidance: true,
        }
    }
}

impl Default for OrchestrationConfig {
    fn default() -> Self {
        Self {
            mcts_config: MCTSConfig::default(),
            agent_config: AgentConfig::default(),
            memory_config: MemoryConfig {
                max_context_length: 32768,
                compression_threshold: 16384,
                persistence_enabled: true,
                cache_size: 1000,
                ttl_seconds: 3600,
            },
            optimization_config: OptimizationConfig {
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
            },
            monitoring_config: MonitoringConfig {
                metrics_enabled: true,
                tracing_enabled: true,
                alerts_enabled: true,
                dashboard_port: Some(9090),
                export_interval_seconds: 60,
            },
        }
    }
}

/// Core orchestration result containing execution details and performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationResult {
    pub id: Uuid,
    pub success: bool,
    pub primary_result: String,
    pub supporting_results: Vec<String>,
    pub execution_path: Vec<String>,
    pub total_time_ms: u64,
    pub agents_used: Vec<String>,
    pub performance_metrics: PerformanceMetrics,
    pub optimization_applied: Vec<String>,
    pub context_preserved: bool,
    pub recovery_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub workflow_id: Uuid,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub execution_time_ms: u64,
    pub success_rate: f64,
    pub resource_utilization: f64,
    pub error_rate: f64,
    pub throughput: f64,
    pub throughput_ops_per_sec: f64,
    pub latency_p50_ms: f64,
    pub latency_p95_ms: f64,
    pub latency_p99_ms: f64,
    pub cache_hit_rate: f64,
    pub optimization_effectiveness: f64,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            workflow_id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            execution_time_ms: 0,
            success_rate: 1.0,
            resource_utilization: 0.0,
            error_rate: 0.0,
            throughput: 0.0,
            throughput_ops_per_sec: 0.0,
            latency_p50_ms: 0.0,
            latency_p95_ms: 0.0,
            latency_p99_ms: 0.0,
            cache_hit_rate: 0.0,
            optimization_effectiveness: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUtilization {
    pub cpu_percent: f64,
    pub memory_mb: usize,
    pub network_bytes_per_sec: u64,
    pub active_agents: usize,
    pub concurrent_tasks: usize,
}
