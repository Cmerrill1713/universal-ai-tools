//! Enhanced Context Propagation for Recursive Orchestration
//!
//! This module provides sophisticated context management and propagation
//! for recursive agent orchestration scenarios.

use crate::{OrchestrationError, RecursiveContext};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use std::time::Duration;

/// Context propagation manager for recursive operations
pub struct ContextPropagationManager {
    pub context_store: Arc<RwLock<HashMap<Uuid, ContextSnapshot>>>,
    pub propagation_rules: Vec<PropagationRule>,
    pub context_optimizer: ContextOptimizer,
    pub inheritance_strategies: HashMap<String, InheritanceStrategy>,
}

/// Snapshot of context at a specific point in execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSnapshot {
    pub snapshot_id: Uuid,
    pub workflow_id: Uuid,
    pub depth: usize,
    pub timestamp: DateTime<Utc>,
    pub state: ContextState,
    pub metadata: ContextMetadata,
    pub dependencies: Vec<Uuid>,
    pub version: u32,
}

/// Rich context state for propagation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextState {
    pub variables: HashMap<String, serde_json::Value>,
    pub execution_history: Vec<ExecutionRecord>,
    pub resource_allocations: HashMap<String, ResourceAllocation>,
    pub performance_metrics: PerformanceSnapshot,
    pub agent_states: HashMap<Uuid, AgentStateSnapshot>,
    pub workflow_state: WorkflowStateSnapshot,
    pub custom_data: HashMap<String, serde_json::Value>,
}

/// Context metadata for tracking and optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMetadata {
    pub size_bytes: usize,
    pub compression_ratio: f64,
    pub last_accessed: DateTime<Utc>,
    pub access_count: u64,
    pub ttl_seconds: u64,
    pub priority: ContextPriority,
    pub tags: Vec<String>,
}

/// Context priority levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum ContextPriority {
    Critical = 1,
    High = 2,
    Medium = 3,
    Low = 4,
    Background = 5,
}

/// Individual execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRecord {
    pub record_id: Uuid,
    pub action: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub success: bool,
    pub input_data: serde_json::Value,
    pub output_data: serde_json::Value,
    pub error: Option<String>,
    pub resource_usage: ResourceUsage,
}

/// Resource allocation information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceAllocation {
    pub resource_type: String,
    pub allocated_amount: f64,
    pub used_amount: f64,
    pub available_amount: f64,
    pub cost_per_unit: f64,
    pub allocation_timestamp: DateTime<Utc>,
}

/// Performance snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSnapshot {
    pub throughput: f64,
    pub latency_ms: f64,
    pub error_rate: f64,
    pub resource_efficiency: f64,
    pub cache_hit_rate: f64,
    pub optimization_score: f64,
}

/// Agent state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStateSnapshot {
    pub agent_id: Uuid,
    pub status: AgentStatus,
    pub capabilities: Vec<String>,
    pub performance_metrics: AgentPerformanceMetrics,
    pub last_activity: DateTime<Utc>,
    pub resource_usage: ResourceUsage,
}

/// Agent status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentStatus {
    Active,
    Idle,
    Busy,
    Error,
    Terminated,
}

/// Agent performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPerformanceMetrics {
    pub success_rate: f64,
    pub average_response_time: Duration,
    pub throughput: f64,
    pub resource_efficiency: f64,
    pub error_count: u64,
    pub total_tasks: u64,
}

/// Workflow state snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStateSnapshot {
    pub workflow_id: Uuid,
    pub status: WorkflowStatus,
    pub current_phase: String,
    pub completed_nodes: Vec<String>,
    pub pending_nodes: Vec<String>,
    pub failed_nodes: Vec<String>,
    pub execution_plan: ExecutionPlanSnapshot,
}

/// Workflow status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowStatus {
    Created,
    Planning,
    Scheduled,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// Execution plan snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPlanSnapshot {
    pub total_phases: usize,
    pub current_phase: usize,
    pub estimated_remaining_time: Duration,
    pub critical_path: Vec<String>,
    pub dependencies: HashMap<String, Vec<String>>,
}

/// Resource usage tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub cpu_cores: f64,
    pub memory_mb: usize,
    pub network_bandwidth_mbps: u64,
    pub storage_mb: usize,
    pub cost: f64,
}

/// Context propagation rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropagationRule {
    pub rule_id: Uuid,
    pub name: String,
    pub condition: PropagationCondition,
    pub action: PropagationAction,
    pub priority: u8,
    pub enabled: bool,
}

/// Propagation condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PropagationCondition {
    Always,
    DepthGreaterThan(usize),
    DepthLessThan(usize),
    ResourceUsageAbove(f64),
    PerformanceBelow(f64),
    Custom(String), // JSON expression
}

/// Propagation action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PropagationAction {
    InheritAll,
    InheritSelected(Vec<String>),
    Transform(TransformationRule),
    Filter(FilterRule),
    Merge(MergeStrategy),
    Custom(String), // Custom logic
}

/// Transformation rule for context data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransformationRule {
    pub input_path: String,
    pub output_path: String,
    pub transformation_type: TransformationType,
    pub parameters: HashMap<String, serde_json::Value>,
}

/// Types of transformations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransformationType {
    Scale(f64),
    Offset(f64),
    Map(HashMap<String, String>),
    Filter(Vec<String>),
    Aggregate(AggregationType),
    Custom(String),
}

/// Aggregation types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AggregationType {
    Sum,
    Average,
    Max,
    Min,
    Count,
    Custom(String),
}

/// Filter rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterRule {
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub max_size_bytes: Option<usize>,
    pub max_age_seconds: Option<u64>,
}

/// Merge strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MergeStrategy {
    Overwrite,
    Merge,
    Append,
    Prepend,
    Custom(String),
}

/// Inheritance strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InheritanceStrategy {
    pub strategy_name: String,
    pub inheritance_type: InheritanceType,
    pub depth_limit: Option<usize>,
    pub resource_threshold: Option<f64>,
    pub custom_logic: Option<String>,
}

/// Types of inheritance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InheritanceType {
    Full,           // Inherit everything
    Selective,      // Inherit based on rules
    Incremental,    // Only inherit changes
    Compressed,     // Compress before inheritance
    Custom,         // Custom inheritance logic
}

/// Context optimizer for managing context size and performance
#[derive(Clone)]
pub struct ContextOptimizer {
    pub compression_enabled: bool,
    pub max_context_size: usize,
    pub compression_threshold: usize,
    pub ttl_cleanup_interval: Duration,
    pub optimization_strategies: Vec<OptimizationStrategy>,
}

/// Optimization strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationStrategy {
    pub strategy_name: String,
    pub strategy_type: OptimizationType,
    pub parameters: HashMap<String, serde_json::Value>,
    pub enabled: bool,
}

/// Types of optimizations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OptimizationType {
    Compression,
    Deduplication,
    Archival,
    Pruning,
    Custom(String),
}

impl ContextPropagationManager {
    /// Create a new context propagation manager
    pub fn new() -> Self {
        Self {
            context_store: Arc::new(RwLock::new(HashMap::new())),
            propagation_rules: Vec::new(),
            context_optimizer: ContextOptimizer::new(),
            inheritance_strategies: HashMap::new(),
        }
    }

    /// Propagate context from parent to child
    pub async fn propagate_context(
        &self,
        parent_context: &RecursiveContext,
        child_workflow_id: Uuid,
        propagation_strategy: Option<&str>,
    ) -> Result<RecursiveContext, OrchestrationError> {
        // Create child context with inherited state
        let mut child_context = RecursiveContext {
            workflow_id: child_workflow_id,
            depth: parent_context.depth + 1,
            parent_workflow_id: Some(parent_context.workflow_id),
            root_workflow_id: parent_context.root_workflow_id,
            execution_path: {
                let mut path = parent_context.execution_path.clone();
                path.push(child_workflow_id);
                path
            },
            inherited_state: HashMap::new(),
            execution_history: parent_context.execution_history.clone(),
            resource_usage: parent_context.resource_usage.clone(),
            performance_metrics: parent_context.performance_metrics.clone(),
            created_at: Utc::now(),
            recursion_id: Uuid::new_v4(),
        };

        // Apply propagation rules
        let strategy_name = propagation_strategy.unwrap_or("default");
        if let Some(strategy) = self.inheritance_strategies.get(strategy_name) {
            self.apply_inheritance_strategy(&mut child_context, parent_context, strategy).await?;
        } else {
            // Default inheritance: selective based on depth and performance
            self.apply_default_inheritance(&mut child_context, parent_context).await?;
        }

        // Store context snapshot
        self.store_context_snapshot(&child_context).await?;

        // Optimize context if needed
        self.optimize_context(&mut child_context).await?;

        tracing::info!(
            child_workflow_id = %child_workflow_id,
            parent_workflow_id = %parent_context.workflow_id,
            depth = %child_context.depth,
            strategy = %strategy_name,
            "Context propagated successfully"
        );

        Ok(child_context)
    }

    /// Apply inheritance strategy
    async fn apply_inheritance_strategy(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
        strategy: &InheritanceStrategy,
    ) -> Result<(), OrchestrationError> {
        match strategy.inheritance_type {
            InheritanceType::Full => {
                child_context.inherited_state = parent_context.inherited_state.clone();
            }
            InheritanceType::Selective => {
                self.apply_selective_inheritance(child_context, parent_context).await?;
            }
            InheritanceType::Incremental => {
                self.apply_incremental_inheritance(child_context, parent_context).await?;
            }
            InheritanceType::Compressed => {
                self.apply_compressed_inheritance(child_context, parent_context).await?;
            }
            InheritanceType::Custom => {
                if let Some(ref logic) = strategy.custom_logic {
                    self.apply_custom_inheritance(child_context, parent_context, logic).await?;
                }
            }
        }

        // Apply depth limit if specified
        if let Some(depth_limit) = strategy.depth_limit {
            if child_context.depth > depth_limit {
                self.limit_context_by_depth(child_context, depth_limit).await?;
            }
        }

        // Apply resource threshold if specified
        if let Some(threshold) = strategy.resource_threshold {
            if child_context.resource_usage.cpu_cores > threshold {
                self.limit_context_by_resource(child_context, threshold).await?;
            }
        }

        Ok(())
    }

    /// Apply default inheritance strategy
    async fn apply_default_inheritance(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
    ) -> Result<(), OrchestrationError> {
        // Inherit critical state variables
        let critical_vars = vec![
            "user_id",
            "session_id",
            "request_id",
            "priority",
            "deadline",
            "constraints",
        ];

        for var in critical_vars {
            if let Some(value) = parent_context.inherited_state.get(var) {
                child_context.inherited_state.insert(var.to_string(), value.clone());
            }
        }

        // Inherit performance metrics with degradation
        child_context.performance_metrics.efficiency *= 0.95; // Slight degradation per level
        child_context.performance_metrics.depth_efficiency =
            1.0 / (child_context.depth as f64 + 1.0);

        // Inherit resource usage with scaling
        child_context.resource_usage.cpu_cores *= 0.9; // Reduce resource allocation
        child_context.resource_usage.memory_mb = (child_context.resource_usage.memory_mb as f64 * 0.9) as usize;

        Ok(())
    }

    /// Apply selective inheritance based on rules
    async fn apply_selective_inheritance(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
    ) -> Result<(), OrchestrationError> {
        for rule in &self.propagation_rules {
            if !rule.enabled {
                continue;
            }

            if self.evaluate_condition(&rule.condition, child_context, parent_context).await? {
                self.apply_action(&rule.action, child_context, parent_context).await?;
            }
        }

        Ok(())
    }

    /// Apply incremental inheritance (only changes)
    async fn apply_incremental_inheritance(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
    ) -> Result<(), OrchestrationError> {
        // Get the last context snapshot for this workflow
        if let Some(last_snapshot) = self.get_last_context_snapshot(parent_context.workflow_id).await? {
            // Only inherit variables that have changed
            for (key, value) in &parent_context.inherited_state {
                if last_snapshot.state.variables.get(key) != Some(value) {
                    child_context.inherited_state.insert(key.clone(), value.clone());
                }
            }
        } else {
            // No previous snapshot, inherit everything
            child_context.inherited_state = parent_context.inherited_state.clone();
        }

        Ok(())
    }

    /// Apply compressed inheritance
    async fn apply_compressed_inheritance(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
    ) -> Result<(), OrchestrationError> {
        // Compress parent context before inheritance
        let compressed_state = self.compress_context_state(&parent_context.inherited_state).await?;

        // Inherit compressed state
        child_context.inherited_state = compressed_state;

        // Add compression metadata
        child_context.inherited_state.insert(
            "_compression_applied".to_string(),
            serde_json::Value::Bool(true)
        );

        Ok(())
    }

    /// Apply custom inheritance logic
    async fn apply_custom_inheritance(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
        logic: &str,
    ) -> Result<(), OrchestrationError> {
        // In a real implementation, this would execute custom logic
        // For now, we'll implement a simple rule-based system
        match logic {
            "performance_aware" => {
                // Inherit based on performance metrics
                if parent_context.performance_metrics.efficiency > 0.8 {
                    child_context.inherited_state = parent_context.inherited_state.clone();
                } else {
                    self.apply_selective_inheritance(child_context, parent_context).await?;
                }
            }
            "resource_limited" => {
                // Inherit based on resource usage
                if parent_context.resource_usage.cpu_cores < 2.0 {
                    child_context.inherited_state = parent_context.inherited_state.clone();
                } else {
                    self.apply_compressed_inheritance(child_context, parent_context).await?;
                }
            }
            _ => {
                // Default to selective inheritance
                self.apply_selective_inheritance(child_context, parent_context).await?;
            }
        }

        Ok(())
    }

    /// Evaluate propagation condition
    async fn evaluate_condition(
        &self,
        condition: &PropagationCondition,
        child_context: &RecursiveContext,
        parent_context: &RecursiveContext,
    ) -> Result<bool, OrchestrationError> {
        match condition {
            PropagationCondition::Always => Ok(true),
            PropagationCondition::DepthGreaterThan(threshold) => Ok(child_context.depth > *threshold),
            PropagationCondition::DepthLessThan(threshold) => Ok(child_context.depth < *threshold),
            PropagationCondition::ResourceUsageAbove(threshold) => {
                Ok(parent_context.resource_usage.cpu_cores > *threshold)
            }
            PropagationCondition::PerformanceBelow(threshold) => {
                Ok(parent_context.performance_metrics.efficiency < *threshold)
            }
            PropagationCondition::Custom(_expression) => {
                // In a real implementation, this would evaluate the expression
                // For now, return true as a placeholder
                Ok(true)
            }
        }
    }

    /// Apply propagation action
    async fn apply_action(
        &self,
        action: &PropagationAction,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
    ) -> Result<(), OrchestrationError> {
        match action {
            PropagationAction::InheritAll => {
                child_context.inherited_state = parent_context.inherited_state.clone();
            }
            PropagationAction::InheritSelected(keys) => {
                for key in keys {
                    if let Some(value) = parent_context.inherited_state.get(key) {
                        child_context.inherited_state.insert(key.clone(), value.clone());
                    }
                }
            }
            PropagationAction::Transform(rule) => {
                self.apply_transformation(child_context, parent_context, rule).await?;
            }
            PropagationAction::Filter(rule) => {
                self.apply_filter(child_context, parent_context, rule).await?;
            }
            PropagationAction::Merge(strategy) => {
                self.apply_merge(child_context, parent_context, strategy).await?;
            }
            PropagationAction::Custom(_logic) => {
                // Custom logic would be executed here
            }
        }

        Ok(())
    }

    /// Apply transformation rule
    async fn apply_transformation(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
        rule: &TransformationRule,
    ) -> Result<(), OrchestrationError> {
        if let Some(input_value) = parent_context.inherited_state.get(&rule.input_path) {
            let transformed_value = self.transform_value(input_value, &rule.transformation_type, &rule.parameters).await?;
            child_context.inherited_state.insert(rule.output_path.clone(), transformed_value);
        }

        Ok(())
    }

    /// Transform a value based on transformation type
    async fn transform_value(
        &self,
        value: &serde_json::Value,
        transformation_type: &TransformationType,
        _parameters: &HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value, OrchestrationError> {
        match transformation_type {
            TransformationType::Scale(factor) => {
                if let Some(num) = value.as_f64() {
                    Ok(serde_json::Value::Number(serde_json::Number::from_f64(num * factor).unwrap()))
                } else {
                    Ok(value.clone())
                }
            }
            TransformationType::Offset(offset) => {
                if let Some(num) = value.as_f64() {
                    Ok(serde_json::Value::Number(serde_json::Number::from_f64(num + offset).unwrap()))
                } else {
                    Ok(value.clone())
                }
            }
            TransformationType::Map(mapping) => {
                if let Some(str_value) = value.as_str() {
                    Ok(serde_json::Value::String(mapping.get(str_value).cloned().unwrap_or_else(|| str_value.to_string())))
                } else {
                    Ok(value.clone())
                }
            }
            _ => Ok(value.clone()),
        }
    }

    /// Apply filter rule
    async fn apply_filter(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
        rule: &FilterRule,
    ) -> Result<(), OrchestrationError> {
        for (key, value) in &parent_context.inherited_state {
            let should_include = rule.include_patterns.is_empty() ||
                rule.include_patterns.iter().any(|pattern| key.contains(pattern));

            let should_exclude = rule.exclude_patterns.iter().any(|pattern| key.contains(pattern));

            if should_include && !should_exclude {
                // Check size limit
                if let Some(max_size) = rule.max_size_bytes {
                    let value_size = serde_json::to_string(value).unwrap_or_default().len();
                    if value_size <= max_size {
                        child_context.inherited_state.insert(key.clone(), value.clone());
                    }
                } else {
                    child_context.inherited_state.insert(key.clone(), value.clone());
                }
            }
        }

        Ok(())
    }

    /// Apply merge strategy
    async fn apply_merge(
        &self,
        child_context: &mut RecursiveContext,
        parent_context: &RecursiveContext,
        strategy: &MergeStrategy,
    ) -> Result<(), OrchestrationError> {
        match strategy {
            MergeStrategy::Overwrite => {
                child_context.inherited_state = parent_context.inherited_state.clone();
            }
            MergeStrategy::Merge => {
                for (key, value) in &parent_context.inherited_state {
                    child_context.inherited_state.insert(key.clone(), value.clone());
                }
            }
            MergeStrategy::Append => {
                for (key, value) in &parent_context.inherited_state {
                    if let Some(existing) = child_context.inherited_state.get_mut(key) {
                        if let (Some(existing_str), Some(value_str)) = (existing.as_str(), value.as_str()) {
                            *existing = serde_json::Value::String(format!("{}{}", existing_str, value_str));
                        }
                    } else {
                        child_context.inherited_state.insert(key.clone(), value.clone());
                    }
                }
            }
            _ => {
                // Default to merge
                for (key, value) in &parent_context.inherited_state {
                    child_context.inherited_state.insert(key.clone(), value.clone());
                }
            }
        }

        Ok(())
    }

    /// Store context snapshot
    async fn store_context_snapshot(&self, context: &RecursiveContext) -> Result<(), OrchestrationError> {
        let snapshot = ContextSnapshot {
            snapshot_id: Uuid::new_v4(),
            workflow_id: context.workflow_id,
            depth: context.depth,
            timestamp: Utc::now(),
            state: ContextState {
                variables: context.inherited_state.clone(),
                execution_history: context.execution_history.iter().map(|step| ExecutionRecord {
                    record_id: step.step_id,
                    action: step.action.clone(),
                    start_time: step.start_time,
                    end_time: step.end_time,
                    success: step.success,
                    input_data: serde_json::Value::Null,
                    output_data: serde_json::Value::Null,
                    error: step.error.clone(),
                    resource_usage: ResourceUsage {
                        cpu_cores: step.resource_consumed.cpu_cores,
                        memory_mb: step.resource_consumed.memory_mb,
                        network_bandwidth_mbps: step.resource_consumed.network_bandwidth_mbps,
                        storage_mb: step.resource_consumed.storage_mb,
                        cost: step.resource_consumed.total_cost,
                    },
                }).collect(),
                resource_allocations: HashMap::new(), // Would be populated from actual allocations
                performance_metrics: PerformanceSnapshot {
                    throughput: context.performance_metrics.throughput,
                    latency_ms: context.performance_metrics.execution_time.as_millis() as f64,
                    error_rate: context.performance_metrics.error_rate,
                    resource_efficiency: context.performance_metrics.resource_utilization,
                    cache_hit_rate: 0.0, // Would be calculated
                    optimization_score: context.performance_metrics.efficiency,
                },
                agent_states: HashMap::new(), // Would be populated from actual agent states
                workflow_state: WorkflowStateSnapshot {
                    workflow_id: context.workflow_id,
                    status: WorkflowStatus::Running,
                    current_phase: "execution".to_string(),
                    completed_nodes: Vec::new(),
                    pending_nodes: Vec::new(),
                    failed_nodes: Vec::new(),
                    execution_plan: ExecutionPlanSnapshot {
                        total_phases: 1,
                        current_phase: 0,
                        estimated_remaining_time: Duration::from_secs(0),
                        critical_path: Vec::new(),
                        dependencies: HashMap::new(),
                    },
                },
                custom_data: HashMap::new(),
            },
            metadata: ContextMetadata {
                size_bytes: serde_json::to_string(&context.inherited_state).unwrap_or_default().len(),
                compression_ratio: 1.0,
                last_accessed: Utc::now(),
                access_count: 1,
                ttl_seconds: 3600,
                priority: ContextPriority::Medium,
                tags: vec!["recursive".to_string()],
            },
            dependencies: context.execution_path.clone(),
            version: 1,
        };

        let mut store = self.context_store.write().await;
        store.insert(context.workflow_id, snapshot);

        Ok(())
    }

    /// Get last context snapshot for a workflow
    async fn get_last_context_snapshot(&self, workflow_id: Uuid) -> Result<Option<ContextSnapshot>, OrchestrationError> {
        let store = self.context_store.read().await;
        Ok(store.get(&workflow_id).cloned())
    }

    /// Compress context state
    async fn compress_context_state(&self, state: &HashMap<String, serde_json::Value>) -> Result<HashMap<String, serde_json::Value>, OrchestrationError> {
        // Simple compression: remove null values and empty strings
        let mut compressed = HashMap::new();

        for (key, value) in state {
            if !value.is_null() && value != &serde_json::Value::String(String::new()) {
                compressed.insert(key.clone(), value.clone());
            }
        }

        Ok(compressed)
    }

    /// Limit context by depth
    async fn limit_context_by_depth(&self, context: &mut RecursiveContext, depth_limit: usize) -> Result<(), OrchestrationError> {
        // Remove older execution history entries
        if context.execution_history.len() > depth_limit {
            let keep_count = depth_limit / 2; // Keep half of the limit
            context.execution_history.drain(0..context.execution_history.len() - keep_count);
        }

        // Remove less critical variables
        let critical_vars = vec!["user_id", "session_id", "request_id"];
        let mut filtered_state = HashMap::new();

        for (key, value) in &context.inherited_state {
            if critical_vars.contains(&key.as_str()) || key.starts_with("_") {
                filtered_state.insert(key.clone(), value.clone());
            }
        }

        context.inherited_state = filtered_state;

        Ok(())
    }

    /// Limit context by resource
    async fn limit_context_by_resource(&self, context: &mut RecursiveContext, threshold: f64) -> Result<(), OrchestrationError> {
        // Reduce resource allocation
        context.resource_usage.cpu_cores = context.resource_usage.cpu_cores.min(threshold);
        context.resource_usage.memory_mb = (context.resource_usage.memory_mb as f64 * 0.8) as usize;

        // Remove resource-intensive variables
        let mut filtered_state = HashMap::new();
        for (key, value) in &context.inherited_state {
            let value_size = serde_json::to_string(value).unwrap_or_default().len();
            if value_size < 1024 { // Keep only small values
                filtered_state.insert(key.clone(), value.clone());
            }
        }

        context.inherited_state = filtered_state;

        Ok(())
    }

    /// Optimize context
    async fn optimize_context(&self, context: &mut RecursiveContext) -> Result<(), OrchestrationError> {
        // Apply optimization strategies
        for strategy in &self.context_optimizer.optimization_strategies {
            if !strategy.enabled {
                continue;
            }

            match strategy.strategy_type {
                OptimizationType::Compression => {
                    context.inherited_state = self.compress_context_state(&context.inherited_state).await?;
                }
                OptimizationType::Deduplication => {
                    self.deduplicate_context(context).await?;
                }
                OptimizationType::Pruning => {
                    self.prune_context(context).await?;
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Deduplicate context
    async fn deduplicate_context(&self, context: &mut RecursiveContext) -> Result<(), OrchestrationError> {
        // Remove duplicate values
        let mut seen_values = HashSet::new();
        let mut deduplicated = HashMap::new();

        for (key, value) in &context.inherited_state {
            let value_str = serde_json::to_string(value).unwrap_or_default();
            if seen_values.insert(value_str) {
                deduplicated.insert(key.clone(), value.clone());
            }
        }

        context.inherited_state = deduplicated;
        Ok(())
    }

    /// Prune context
    async fn prune_context(&self, context: &mut RecursiveContext) -> Result<(), OrchestrationError> {
        // Remove old execution history entries
        if context.execution_history.len() > 10 {
            context.execution_history.drain(0..context.execution_history.len() - 10);
        }

        // Remove low-priority variables
        let mut pruned = HashMap::new();
        for (key, value) in &context.inherited_state {
            if !key.starts_with("temp_") && !key.starts_with("debug_") {
                pruned.insert(key.clone(), value.clone());
            }
        }

        context.inherited_state = pruned;
        Ok(())
    }
}

impl ContextOptimizer {
    /// Create a new context optimizer
    pub fn new() -> Self {
        Self {
            compression_enabled: true,
            max_context_size: 1024 * 1024, // 1MB
            compression_threshold: 512 * 1024, // 512KB
            ttl_cleanup_interval: Duration::from_secs(300), // 5 minutes
            optimization_strategies: vec![
                OptimizationStrategy {
                    strategy_name: "compression".to_string(),
                    strategy_type: OptimizationType::Compression,
                    parameters: HashMap::new(),
                    enabled: true,
                },
                OptimizationStrategy {
                    strategy_name: "deduplication".to_string(),
                    strategy_type: OptimizationType::Deduplication,
                    parameters: HashMap::new(),
                    enabled: true,
                },
            ],
        }
    }
}

impl Default for ContextPropagationManager {
    fn default() -> Self {
        Self::new()
    }
}
