//! Recursive Orchestration Management
//!
//! This module provides sophisticated management of recursive agent orchestration
//! including depth limits, cycle detection, and context propagation.

use crate::OrchestrationError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use std::time::Duration;

/// Recursion limits and safety controls
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecursionLimits {
    pub max_depth: usize,
    pub max_agents_per_level: usize,
    pub recursion_timeout: Duration,
    pub cycle_detection: bool,
    pub resource_escalation_threshold: f64,
    pub performance_degradation_threshold: f64,
}

impl Default for RecursionLimits {
    fn default() -> Self {
        Self {
            max_depth: 10,
            max_agents_per_level: 50,
            recursion_timeout: Duration::from_secs(300), // 5 minutes
            cycle_detection: true,
            resource_escalation_threshold: 0.8,
            performance_degradation_threshold: 0.7,
        }
    }
}

/// Context for recursive execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecursiveContext {
    pub workflow_id: Uuid,
    pub depth: usize,
    pub parent_workflow_id: Option<Uuid>,
    pub root_workflow_id: Uuid,
    pub execution_path: Vec<Uuid>,
    pub inherited_state: HashMap<String, serde_json::Value>,
    pub execution_history: Vec<ExecutionStep>,
    pub resource_usage: ResourceUsage,
    pub performance_metrics: PerformanceMetrics,
    pub created_at: DateTime<Utc>,
    pub recursion_id: Uuid,
}

/// Individual execution step in recursion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionStep {
    pub step_id: Uuid,
    pub workflow_id: Uuid,
    pub depth: usize,
    pub action: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub success: bool,
    pub error: Option<String>,
    pub resource_consumed: ResourceUsage,
}

/// Resource usage tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub cpu_cores: f64,
    pub memory_mb: usize,
    pub network_bandwidth_mbps: u64,
    pub storage_mb: usize,
    pub agents_spawned: usize,
    pub total_cost: f64,
}

impl Default for ResourceUsage {
    fn default() -> Self {
        Self {
            cpu_cores: 0.0,
            memory_mb: 0,
            network_bandwidth_mbps: 0,
            storage_mb: 0,
            agents_spawned: 0,
            total_cost: 0.0,
        }
    }
}

/// Performance metrics for recursive operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub execution_time: Duration,
    pub throughput: f64,
    pub efficiency: f64,
    pub error_rate: f64,
    pub resource_utilization: f64,
    pub depth_efficiency: f64,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            execution_time: Duration::from_secs(0),
            throughput: 0.0,
            efficiency: 1.0,
            error_rate: 0.0,
            resource_utilization: 0.0,
            depth_efficiency: 1.0,
        }
    }
}

/// Recursive execution manager
pub struct RecursiveExecutionManager {
    pub limits: RecursionLimits,
    pub active_recursions: Arc<RwLock<HashMap<Uuid, RecursiveContext>>>,
    pub recursion_history: Arc<RwLock<Vec<RecursionRecord>>>,
    pub cycle_detector: CycleDetector,
    pub performance_monitor: RecursivePerformanceMonitor,
}

/// Cycle detection system
#[derive(Clone)]
pub struct CycleDetector {
    pub execution_graphs: Arc<RwLock<HashMap<Uuid, ExecutionGraph>>>,
    pub cycle_threshold: usize,
}

/// Execution graph for cycle detection
#[derive(Debug, Clone)]
pub struct ExecutionGraph {
    pub nodes: HashSet<Uuid>,
    pub edges: HashMap<Uuid, Vec<Uuid>>,
    pub timestamps: HashMap<Uuid, DateTime<Utc>>,
}

/// Recursion record for history tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecursionRecord {
    pub recursion_id: Uuid,
    pub root_workflow_id: Uuid,
    pub max_depth_reached: usize,
    pub total_execution_time: Duration,
    pub success: bool,
    pub error: Option<String>,
    pub resource_consumed: ResourceUsage,
    pub performance_metrics: PerformanceMetrics,
    pub created_at: DateTime<Utc>,
}

/// Recursive performance monitor
#[derive(Clone)]
pub struct RecursivePerformanceMonitor {
    pub depth_metrics: Arc<RwLock<HashMap<usize, DepthMetrics>>>,
    pub recursion_efficiency: Arc<RwLock<f64>>,
    pub resource_utilization_by_depth: Arc<RwLock<HashMap<usize, ResourceUtilization>>>,
    pub performance_alerts: Arc<RwLock<Vec<PerformanceAlert>>>,
}

/// Metrics for specific recursion depth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepthMetrics {
    pub depth: usize,
    pub execution_count: u64,
    pub average_execution_time: Duration,
    pub success_rate: f64,
    pub resource_efficiency: f64,
    pub error_rate: f64,
    pub last_execution: Option<DateTime<Utc>>,
}

impl DepthMetrics {
    pub fn new(depth: usize) -> Self {
        Self {
            depth,
            execution_count: 0,
            average_execution_time: Duration::from_secs(0),
            success_rate: 1.0,
            resource_efficiency: 1.0,
            error_rate: 0.0,
            last_execution: None,
        }
    }

    pub fn add_execution(&mut self, execution_time: Duration, success: bool, resource_usage: &ResourceUsage) {
        self.execution_count += 1;

        // Update average execution time
        let total_duration = self.average_execution_time.as_millis() as u64 * (self.execution_count - 1) as u64
            + execution_time.as_millis() as u64;
        self.average_execution_time = Duration::from_millis(total_duration / self.execution_count as u64);

        // Update success rate
        let success_count = if success { 1 } else { 0 };
        let total_successes = (self.success_rate * (self.execution_count - 1) as f64) + success_count as f64;
        self.success_rate = total_successes / self.execution_count as f64;

        // Update error rate
        self.error_rate = 1.0 - self.success_rate;

        // Update resource efficiency (simplified calculation)
        self.resource_efficiency = self.calculate_resource_efficiency(resource_usage);

        self.last_execution = Some(Utc::now());
    }

    fn calculate_resource_efficiency(&self, resource_usage: &ResourceUsage) -> f64 {
        // Calculate efficiency based on resource usage vs expected
        let expected_cpu = 1.0; // Expected CPU cores per execution
        let expected_memory = 100; // Expected memory in MB

        let cpu_efficiency = (expected_cpu / resource_usage.cpu_cores.max(0.1)).min(2.0);
        let memory_efficiency = (expected_memory as f64 / resource_usage.memory_mb.max(1) as f64).min(2.0);

        (cpu_efficiency + memory_efficiency) / 2.0
    }
}

/// Resource utilization by depth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUtilization {
    pub depth: usize,
    pub cpu_utilization: f64,
    pub memory_utilization: f64,
    pub network_utilization: f64,
    pub agent_utilization: f64,
    pub cost_efficiency: f64,
}

/// Performance alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAlert {
    pub alert_id: Uuid,
    pub alert_type: PerformanceAlertType,
    pub severity: AlertSeverity,
    pub message: String,
    pub depth: usize,
    pub workflow_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub resolved: bool,
}

/// Types of performance alerts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PerformanceAlertType {
    RecursionDepthExceeded,
    PerformanceDegradation,
    ResourceExhaustion,
    CycleDetected,
    ErrorRateHigh,
    EfficiencyLow,
}

/// Alert severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl RecursiveExecutionManager {
    /// Create a new recursive execution manager
    pub fn new(limits: RecursionLimits) -> Self {
        Self {
            limits: limits.clone(),
            active_recursions: Arc::new(RwLock::new(HashMap::new())),
            recursion_history: Arc::new(RwLock::new(Vec::new())),
            cycle_detector: CycleDetector::new(limits.cycle_detection),
            performance_monitor: RecursivePerformanceMonitor::new(),
        }
    }

    /// Start a new recursive execution
    pub async fn start_recursive_execution(
        &self,
        workflow_id: Uuid,
        parent_context: Option<&RecursiveContext>,
    ) -> Result<RecursiveContext, OrchestrationError> {
        let recursion_id = Uuid::new_v4();
        let depth = parent_context.map(|ctx| ctx.depth + 1).unwrap_or(0);
        let root_workflow_id = parent_context.map(|ctx| ctx.root_workflow_id).unwrap_or(workflow_id);

        // Check recursion limits
        self.validate_recursion_limits(depth, workflow_id).await?;

        // Create recursive context
        let context = RecursiveContext {
            workflow_id,
            depth,
            parent_workflow_id: parent_context.map(|ctx| ctx.workflow_id),
            root_workflow_id,
            execution_path: parent_context.map(|ctx| {
                let mut path = ctx.execution_path.clone();
                path.push(workflow_id);
                path
            }).unwrap_or_else(|| vec![workflow_id]),
            inherited_state: parent_context.map(|ctx| ctx.inherited_state.clone()).unwrap_or_default(),
            execution_history: parent_context.map(|ctx| ctx.execution_history.clone()).unwrap_or_default(),
            resource_usage: parent_context.map(|ctx| ctx.resource_usage.clone()).unwrap_or_default(),
            performance_metrics: PerformanceMetrics::default(),
            created_at: Utc::now(),
            recursion_id,
        };

        // Check for cycles
        if self.limits.cycle_detection {
            if self.cycle_detector.detect_cycle(&context).await? {
                return Err(OrchestrationError::RecursionCycleDetected);
            }
        }

        // Register active recursion
        {
            let mut active = self.active_recursions.write().await;
            active.insert(recursion_id, context.clone());
        }

        // Start performance monitoring
        self.performance_monitor.start_monitoring(&context).await?;

        tracing::info!(
            recursion_id = %recursion_id,
            workflow_id = %workflow_id,
            depth = %depth,
            "Started recursive execution"
        );

        Ok(context)
    }

    /// Complete a recursive execution
    pub async fn complete_recursive_execution(
        &self,
        context: &RecursiveContext,
        success: bool,
        error: Option<String>,
    ) -> Result<(), OrchestrationError> {
        let execution_time = Utc::now().signed_duration_since(context.created_at).to_std().unwrap_or_default();

        // Update performance metrics
        self.performance_monitor.record_execution(context, execution_time, success).await?;

        // Create recursion record
        let record = RecursionRecord {
            recursion_id: context.recursion_id,
            root_workflow_id: context.root_workflow_id,
            max_depth_reached: context.depth,
            total_execution_time: execution_time,
            success,
            error,
            resource_consumed: context.resource_usage.clone(),
            performance_metrics: context.performance_metrics.clone(),
            created_at: context.created_at,
        };

        // Store in history
        {
            let mut history = self.recursion_history.write().await;
            history.push(record);

            // Keep only recent history (last 1000 records)
            if history.len() > 1000 {
                let to_remove = history.len() - 1000;
                for _ in 0..to_remove {
                    history.remove(0);
                }
            }
        }

        // Remove from active recursions
        {
            let mut active = self.active_recursions.write().await;
            active.remove(&context.recursion_id);
        }

        // Check for performance alerts
        self.check_performance_alerts(context).await?;

        tracing::info!(
            recursion_id = %context.recursion_id,
            workflow_id = %context.workflow_id,
            depth = %context.depth,
            success = %success,
            execution_time_ms = %execution_time.as_millis(),
            "Completed recursive execution"
        );

        Ok(())
    }

    /// Validate recursion limits
    async fn validate_recursion_limits(&self, depth: usize, _workflow_id: Uuid) -> Result<(), OrchestrationError> {
        // Check depth limit
        if depth > self.limits.max_depth {
            return Err(OrchestrationError::RecursionLimitExceeded(format!(
                "Maximum recursion depth {} exceeded (current: {})",
                self.limits.max_depth, depth
            )));
        }

        // Check active recursions count
        let active_count = {
            let active = self.active_recursions.read().await;
            active.len()
        };

        if active_count > self.limits.max_agents_per_level {
            return Err(OrchestrationError::ResourceExhausted(format!(
                "Maximum concurrent recursions {} exceeded (current: {})",
                self.limits.max_agents_per_level, active_count
            )));
        }

        // Check resource escalation threshold
        let resource_usage = self.calculate_total_resource_usage().await?;
        if resource_usage > self.limits.resource_escalation_threshold {
            return Err(OrchestrationError::ResourceExhausted(format!(
                "Resource escalation threshold exceeded: {:.2} > {:.2}",
                resource_usage, self.limits.resource_escalation_threshold
            )));
        }

        Ok(())
    }

    /// Calculate total resource usage across all active recursions
    async fn calculate_total_resource_usage(&self) -> Result<f64, OrchestrationError> {
        let active = self.active_recursions.read().await;
        let mut total_usage = 0.0;

        for context in active.values() {
            let usage = context.resource_usage.cpu_cores +
                       (context.resource_usage.memory_mb as f64 / 1024.0) +
                       (context.resource_usage.network_bandwidth_mbps as f64 / 1000.0);
            total_usage += usage;
        }

        // Normalize to 0-1 scale
        let max_expected_usage = self.limits.max_agents_per_level as f64 * 10.0; // 10 units per agent
        Ok((total_usage / max_expected_usage).min(1.0))
    }

    /// Check for performance alerts
    async fn check_performance_alerts(&self, context: &RecursiveContext) -> Result<(), OrchestrationError> {
        let mut alerts = Vec::new();

        // Check depth efficiency
        let depth_metrics = self.performance_monitor.get_depth_metrics(context.depth).await?;
        if depth_metrics.resource_efficiency < self.limits.performance_degradation_threshold {
            alerts.push(PerformanceAlert {
                alert_id: Uuid::new_v4(),
                alert_type: PerformanceAlertType::EfficiencyLow,
                severity: AlertSeverity::Medium,
                message: format!("Low efficiency at depth {}: {:.2}", context.depth, depth_metrics.resource_efficiency),
                depth: context.depth,
                workflow_id: context.workflow_id,
                created_at: Utc::now(),
                resolved: false,
            });
        }

        // Check error rate
        if depth_metrics.error_rate > 0.3 {
            alerts.push(PerformanceAlert {
                alert_id: Uuid::new_v4(),
                alert_type: PerformanceAlertType::ErrorRateHigh,
                severity: AlertSeverity::High,
                message: format!("High error rate at depth {}: {:.2}", context.depth, depth_metrics.error_rate),
                depth: context.depth,
                workflow_id: context.workflow_id,
                created_at: Utc::now(),
                resolved: false,
            });
        }

        // Store alerts
        if !alerts.is_empty() {
            let mut performance_alerts = self.performance_monitor.performance_alerts.write().await;
            performance_alerts.extend(alerts);
        }

        Ok(())
    }

    /// Get recursion statistics
    pub async fn get_recursion_statistics(&self) -> Result<RecursionStatistics, OrchestrationError> {
        let active = self.active_recursions.read().await;
        let history = self.recursion_history.read().await;

        let active_count = active.len();
        let max_depth_active = active.values().map(|ctx| ctx.depth).max().unwrap_or(0);
        let total_executions = history.len();
        let successful_executions = history.iter().filter(|r| r.success).count();
        let success_rate = if total_executions > 0 {
            successful_executions as f64 / total_executions as f64
        } else {
            1.0
        };

        let average_execution_time = if !history.is_empty() {
            let total_time: Duration = history.iter().map(|r| r.total_execution_time).sum();
            total_time / history.len() as u32
        } else {
            Duration::from_secs(0)
        };

        Ok(RecursionStatistics {
            active_recursions: active_count,
            max_depth_active,
            total_executions,
            success_rate,
            average_execution_time,
            performance_alerts: self.performance_monitor.get_active_alerts().await?,
        })
    }
}

/// Recursion statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecursionStatistics {
    pub active_recursions: usize,
    pub max_depth_active: usize,
    pub total_executions: usize,
    pub success_rate: f64,
    pub average_execution_time: Duration,
    pub performance_alerts: Vec<PerformanceAlert>,
}

impl CycleDetector {
    pub fn new(_enabled: bool) -> Self {
        Self {
            execution_graphs: Arc::new(RwLock::new(HashMap::new())),
            cycle_threshold: 3, // Minimum path length for cycle detection
        }
    }

    /// Detect cycles in execution path
    pub async fn detect_cycle(&self, context: &RecursiveContext) -> Result<bool, OrchestrationError> {
        if context.execution_path.len() < self.cycle_threshold {
            return Ok(false);
        }

        // Check for immediate cycles (same workflow called consecutively)
        for i in 1..context.execution_path.len() {
            if context.execution_path[i] == context.execution_path[i - 1] {
                tracing::warn!(
                    recursion_id = %context.recursion_id,
                    workflow_id = %context.workflow_id,
                    "Immediate cycle detected in execution path"
                );
                return Ok(true);
            }
        }

        // Check for longer cycles using graph analysis
        let mut graphs = self.execution_graphs.write().await;
        let graph = graphs.entry(context.root_workflow_id).or_insert_with(|| ExecutionGraph {
            nodes: HashSet::new(),
            edges: HashMap::new(),
            timestamps: HashMap::new(),
        });

        // Add current workflow to graph
        graph.nodes.insert(context.workflow_id);
        graph.timestamps.insert(context.workflow_id, Utc::now());

        // Add edges from parent
        if let Some(parent_id) = context.parent_workflow_id {
            graph.nodes.insert(parent_id);
            graph.edges.entry(parent_id).or_insert_with(Vec::new).push(context.workflow_id);
        }

        // Check for cycles using DFS
        let has_cycle = self.dfs_cycle_detection(&graph, context.workflow_id, &mut HashSet::new(), &mut Vec::new());

        if has_cycle {
            tracing::warn!(
                recursion_id = %context.recursion_id,
                workflow_id = %context.workflow_id,
                "Cycle detected in execution graph"
            );
        }

        Ok(has_cycle)
    }

    /// DFS-based cycle detection
    fn dfs_cycle_detection(
        &self,
        graph: &ExecutionGraph,
        current: Uuid,
        visited: &mut HashSet<Uuid>,
        rec_stack: &mut Vec<Uuid>,
    ) -> bool {
        visited.insert(current);
        rec_stack.push(current);

        if let Some(neighbors) = graph.edges.get(&current) {
            for &neighbor in neighbors {
                if !visited.contains(&neighbor) {
                    if self.dfs_cycle_detection(graph, neighbor, visited, rec_stack) {
                        return true;
                    }
                } else if rec_stack.contains(&neighbor) {
                    return true;
                }
            }
        }

        rec_stack.pop();
        false
    }
}

impl RecursivePerformanceMonitor {
    pub fn new() -> Self {
        Self {
            depth_metrics: Arc::new(RwLock::new(HashMap::new())),
            recursion_efficiency: Arc::new(RwLock::new(1.0)),
            resource_utilization_by_depth: Arc::new(RwLock::new(HashMap::new())),
            performance_alerts: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Start monitoring a recursive execution
    pub async fn start_monitoring(&self, context: &RecursiveContext) -> Result<(), OrchestrationError> {
        // Initialize depth metrics if not exists
        {
            let mut metrics = self.depth_metrics.write().await;
            metrics.entry(context.depth).or_insert_with(|| DepthMetrics::new(context.depth));
        }

        // Initialize resource utilization if not exists
        {
            let mut utilization = self.resource_utilization_by_depth.write().await;
            utilization.entry(context.depth).or_insert_with(|| ResourceUtilization {
                depth: context.depth,
                cpu_utilization: 0.0,
                memory_utilization: 0.0,
                network_utilization: 0.0,
                agent_utilization: 0.0,
                cost_efficiency: 1.0,
            });
        }

        Ok(())
    }

    /// Record execution metrics
    pub async fn record_execution(
        &self,
        context: &RecursiveContext,
        execution_time: Duration,
        success: bool,
    ) -> Result<(), OrchestrationError> {
        // Update depth metrics
        {
            let mut metrics = self.depth_metrics.write().await;
            if let Some(depth_metrics) = metrics.get_mut(&context.depth) {
                depth_metrics.add_execution(execution_time, success, &context.resource_usage);
            }
        }

        // Update resource utilization
        {
            let mut utilization = self.resource_utilization_by_depth.write().await;
            if let Some(resource_util) = utilization.get_mut(&context.depth) {
                resource_util.cpu_utilization = context.resource_usage.cpu_cores;
                resource_util.memory_utilization = context.resource_usage.memory_mb as f64 / 1024.0;
                resource_util.network_utilization = context.resource_usage.network_bandwidth_mbps as f64 / 1000.0;
                resource_util.agent_utilization = context.resource_usage.agents_spawned as f64;
                resource_util.cost_efficiency = 1.0 / (context.resource_usage.total_cost + 0.1);
            }
        }

        // Update overall recursion efficiency
        self.update_recursion_efficiency().await?;

        Ok(())
    }

    /// Update overall recursion efficiency
    async fn update_recursion_efficiency(&self) -> Result<(), OrchestrationError> {
        let metrics = self.depth_metrics.read().await;
        let total_efficiency: f64 = metrics.values().map(|m| m.resource_efficiency).sum();
        let count = metrics.len().max(1) as f64;

        let mut efficiency = self.recursion_efficiency.write().await;
        *efficiency = total_efficiency / count;

        Ok(())
    }

    /// Get depth-specific metrics
    pub async fn get_depth_metrics(&self, depth: usize) -> Result<DepthMetrics, OrchestrationError> {
        let metrics = self.depth_metrics.read().await;
        Ok(metrics.get(&depth).cloned().unwrap_or_else(|| DepthMetrics::new(depth)))
    }

    /// Get active performance alerts
    pub async fn get_active_alerts(&self) -> Result<Vec<PerformanceAlert>, OrchestrationError> {
        let alerts = self.performance_alerts.read().await;
        Ok(alerts.iter().filter(|a| !a.resolved).cloned().collect())
    }
}

// Add new error types to OrchestrationError
#[derive(Debug, thiserror::Error)]
pub enum RecursionError {
    #[error("Recursion limit exceeded: {0}")]
    RecursionLimitExceeded(String),

    #[error("Recursion cycle detected")]
    RecursionCycleDetected,

    #[error("Resource escalation threshold exceeded")]
    ResourceEscalationExceeded,

    #[error("Performance degradation detected")]
    PerformanceDegradation,
}

// Extend OrchestrationError to include recursion errors
impl From<RecursionError> for OrchestrationError {
    fn from(err: RecursionError) -> Self {
        match err {
            RecursionError::RecursionLimitExceeded(msg) => {
                OrchestrationError::RecursionLimitExceeded(msg)
            }
            RecursionError::RecursionCycleDetected => {
                OrchestrationError::RecursionCycleDetected
            }
            RecursionError::ResourceEscalationExceeded => {
                OrchestrationError::ResourceExhausted("Resource escalation threshold exceeded".to_string())
            }
            RecursionError::PerformanceDegradation => {
                OrchestrationError::PlanningError("Performance degradation detected".to_string())
            }
        }
    }
}
