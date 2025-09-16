//! Enhanced Orchestrator with Recursive and Multi-Hop Capabilities
//!
//! This module provides a comprehensive orchestrator that integrates
//! recursive execution, context propagation, and dynamic workflow modification.

use crate::{
    OrchestrationError, WorkflowOrchestrator, WorkflowGraph,
    RecursiveExecutionManager, RecursiveContext, RecursionLimits,
    ContextPropagationManager, DynamicWorkflowModifier, PerformanceAnalyzer,
    PerformanceMetrics,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use std::time::Duration;

/// Enhanced orchestrator with advanced capabilities
pub struct EnhancedOrchestrator {
    pub base_orchestrator: WorkflowOrchestrator,
    pub recursion_manager: RecursiveExecutionManager,
    pub context_propagation: ContextPropagationManager,
    pub dynamic_modifier: DynamicWorkflowModifier,
    pub performance_analyzer: PerformanceAnalyzer,
    pub orchestration_config: EnhancedOrchestrationConfig,
    pub active_recursions: Arc<RwLock<HashMap<Uuid, RecursiveContext>>>,
    pub performance_history: Arc<RwLock<Vec<PerformanceMetrics>>>,
}

/// Enhanced orchestration configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedOrchestrationConfig {
    pub recursion_limits: RecursionLimits,
    pub context_propagation_enabled: bool,
    pub dynamic_modification_enabled: bool,
    pub performance_monitoring_enabled: bool,
    pub auto_adaptation_enabled: bool,
    pub max_concurrent_recursions: usize,
    pub performance_analysis_interval: Duration,
    pub adaptation_threshold: f64,
}

impl Default for EnhancedOrchestrationConfig {
    fn default() -> Self {
        Self {
            recursion_limits: RecursionLimits::default(),
            context_propagation_enabled: true,
            dynamic_modification_enabled: true,
            performance_monitoring_enabled: true,
            auto_adaptation_enabled: true,
            max_concurrent_recursions: 10,
            performance_analysis_interval: Duration::from_secs(30),
            adaptation_threshold: 0.7,
        }
    }
}

/// Orchestration result with enhanced metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedOrchestrationResult {
    pub result_id: Uuid,
    pub workflow_id: Uuid,
    pub success: bool,
    pub execution_path: Vec<Uuid>,
    pub max_depth_reached: usize,
    pub total_execution_time: Duration,
    pub performance_metrics: PerformanceMetrics,
    pub modifications_applied: Vec<WorkflowModification>,
    pub context_propagation_used: bool,
    pub recursion_statistics: crate::recursion::RecursionStatistics,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Workflow modification record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowModification {
    pub modification_id: Uuid,
    pub workflow_id: Uuid,
    pub action: String,
    pub reason: String,
    pub timestamp: DateTime<Utc>,
    pub success: bool,
    pub performance_impact: Option<f64>,
}

/// Recursion statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecursionStatistics {
    pub total_recursions: usize,
    pub max_depth: usize,
    pub average_depth: f64,
    pub success_rate: f64,
    pub performance_efficiency: f64,
}

impl EnhancedOrchestrator {
    /// Create a new enhanced orchestrator
    pub async fn new(config: EnhancedOrchestrationConfig) -> Result<Self, OrchestrationError> {
        let base_orchestrator = WorkflowOrchestrator::new(crate::workflow::OrchestratorConfig::default()).await?;
        let recursion_manager = RecursiveExecutionManager::new(config.recursion_limits.clone());
        let context_propagation = ContextPropagationManager::new();
        let dynamic_modifier = DynamicWorkflowModifier::new();
        let performance_analyzer = PerformanceAnalyzer::new();

        let orchestrator = Self {
            base_orchestrator,
            recursion_manager,
            context_propagation,
            dynamic_modifier,
            performance_analyzer,
            orchestration_config: config,
            active_recursions: Arc::new(RwLock::new(HashMap::new())),
            performance_history: Arc::new(RwLock::new(Vec::new())),
        };

        // Start background monitoring if enabled
        if orchestrator.orchestration_config.performance_monitoring_enabled {
            orchestrator.start_performance_monitoring().await?;
        }

        Ok(orchestrator)
    }

    /// Execute workflow with enhanced capabilities
    pub async fn execute_enhanced_workflow(
        &self,
        workflow_graph: WorkflowGraph,
        input_data: serde_json::Value,
        parent_context: Option<&RecursiveContext>,
    ) -> Result<EnhancedOrchestrationResult, OrchestrationError> {
        let result_id = Uuid::new_v4();
        let start_time = Utc::now();

        // Start recursive execution if parent context exists
        let recursive_context = if let Some(parent) = parent_context {
            self.recursion_manager.start_recursive_execution(
                workflow_graph.id,
                Some(parent),
            ).await?
        } else {
            self.recursion_manager.start_recursive_execution(
                workflow_graph.id,
                None,
            ).await?
        };

        // Register active recursion
        {
            let mut active = self.active_recursions.write().await;
            active.insert(recursive_context.recursion_id, recursive_context.clone());
        }

        // Execute workflow with monitoring
        let execution_result = self.execute_workflow_with_monitoring(
            &workflow_graph,
            &input_data,
            &recursive_context,
        ).await?;

        // Complete recursive execution
        self.recursion_manager.complete_recursive_execution(
            &recursive_context,
            execution_result.success,
            execution_result.error.clone(),
        ).await?;

        // Remove from active recursions
        {
            let mut active = self.active_recursions.write().await;
            active.remove(&recursive_context.recursion_id);
        }

        // Calculate recursion statistics before moving recursive_context
        let stats = self.calculate_recursion_statistics(&recursive_context).await?;
        let recursion_statistics = crate::recursion::RecursionStatistics {
            active_recursions: stats.total_recursions,
            max_depth_active: stats.max_depth,
            total_executions: stats.total_recursions,
            success_rate: stats.success_rate,
            average_execution_time: Duration::from_secs(0), // Not available in this struct
            performance_alerts: vec![], // Not available in this struct
        };

        // Create enhanced result
        let enhanced_result = EnhancedOrchestrationResult {
            result_id,
            workflow_id: workflow_graph.id,
            success: execution_result.success,
            execution_path: recursive_context.execution_path,
            max_depth_reached: recursive_context.depth,
            total_execution_time: Utc::now().signed_duration_since(start_time).to_std().unwrap_or_default(),
            performance_metrics: execution_result.performance_metrics,
            modifications_applied: execution_result.modifications_applied,
            context_propagation_used: recursive_context.parent_workflow_id.is_some(),
            recursion_statistics,
            error: execution_result.error,
            created_at: start_time,
        };

        // Store performance metrics
        if self.orchestration_config.performance_monitoring_enabled {
            self.store_performance_metrics(&enhanced_result.performance_metrics).await?;
        }

        tracing::info!(
            result_id = %result_id,
            workflow_id = %workflow_graph.id,
            success = %enhanced_result.success,
            max_depth = %enhanced_result.max_depth_reached,
            execution_time_ms = %enhanced_result.total_execution_time.as_millis(),
            "Enhanced workflow execution completed"
        );

        Ok(enhanced_result)
    }

    /// Execute workflow with monitoring and adaptation
    async fn execute_workflow_with_monitoring(
        &self,
        workflow_graph: &WorkflowGraph,
        input_data: &serde_json::Value,
        _recursive_context: &RecursiveContext,
    ) -> Result<WorkflowExecutionResult, OrchestrationError> {
        let mut modifications_applied = Vec::new();
        let current_workflow = workflow_graph.clone();
        let mut performance_metrics = PerformanceMetrics {
            workflow_id: Uuid::new_v4(),
            timestamp: Utc::now(),
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
        };

        // Deploy workflow
        let workflow_id = self.base_orchestrator.deploy_workflow(
            current_workflow.clone(),
            input_data.clone(),
        ).await?;

        // Start execution
        self.base_orchestrator.start_workflow(workflow_id).await?;

        // Monitor and adapt during execution
        let mut last_analysis = Utc::now();
        let analysis_interval = self.orchestration_config.performance_analysis_interval;

        while self.is_workflow_running(workflow_id).await? {
            // Check if it's time for performance analysis
            if Utc::now().signed_duration_since(last_analysis) > chrono::Duration::from_std(analysis_interval).unwrap() {
                if self.orchestration_config.dynamic_modification_enabled {
                    // Analyze performance
                    let current_metrics = self.collect_current_metrics(workflow_id).await?;
                    performance_metrics = current_metrics.clone();

                    // Get modification recommendations
                    let recommendations = self.dynamic_modifier.analyze_workflow(
                        workflow_id,
                        &current_metrics,
                    ).await?;

                    // Apply high-confidence recommendations
                    let high_confidence_recommendations: Vec<_> = recommendations
                        .into_iter()
                        .filter(|r| r.confidence > self.orchestration_config.adaptation_threshold)
                        .collect();

                    if !high_confidence_recommendations.is_empty() {
                        let modifications: Vec<_> = high_confidence_recommendations
                            .iter()
                            .map(|r| r.action.clone())
                            .collect();

                        let modification = self.dynamic_modifier.apply_modifications(
                            workflow_id,
                            modifications,
                            "Performance optimization".to_string(),
                        ).await?;

                        modifications_applied.push(WorkflowModification {
                            modification_id: modification.modification_id,
                            workflow_id,
                            action: format!("{:?}", modification.action),
                            reason: modification.reason,
                            timestamp: modification.timestamp,
                            success: modification.success,
                            performance_impact: modification.performance_impact,
                        });
                    }
                }

                last_analysis = Utc::now();
            }

            // Small delay to prevent busy waiting
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        // Get final result
        let final_status = self.base_orchestrator.get_workflow_status(workflow_id).await?;
        let success = matches!(final_status, crate::workflow::WorkflowStatus::Completed { success: true });

        Ok(WorkflowExecutionResult {
            success,
            performance_metrics,
            modifications_applied,
            error: if success { None } else { Some("Workflow execution failed".to_string()) },
        })
    }

    /// Check if workflow is still running
    async fn is_workflow_running(&self, workflow_id: Uuid) -> Result<bool, OrchestrationError> {
        let status = self.base_orchestrator.get_workflow_status(workflow_id).await?;
        Ok(matches!(status, crate::workflow::WorkflowStatus::Running { .. }))
    }

    /// Collect current performance metrics
    async fn collect_current_metrics(&self, workflow_id: Uuid) -> Result<PerformanceMetrics, OrchestrationError> {
        // In a real implementation, this would collect actual metrics
        // For now, return simulated metrics
        Ok(PerformanceMetrics {
            workflow_id,
            timestamp: Utc::now(),
            execution_time_ms: 1000,
            success_rate: 0.95,
            resource_utilization: 0.7,
            error_rate: 0.05,
            throughput: 100.0,
            throughput_ops_per_sec: 100.0,
            latency_p50_ms: 50.0,
            latency_p95_ms: 100.0,
            latency_p99_ms: 200.0,
            cache_hit_rate: 0.8,
            optimization_effectiveness: 0.9,
        })
    }

    /// Calculate recursion statistics
    async fn calculate_recursion_statistics(
        &self,
        context: &RecursiveContext,
    ) -> Result<RecursionStatistics, OrchestrationError> {
        let recursion_stats = self.recursion_manager.get_recursion_statistics().await?;

        Ok(RecursionStatistics {
            total_recursions: recursion_stats.active_recursions,
            max_depth: context.depth,
            average_depth: context.depth as f64,
            success_rate: recursion_stats.success_rate,
            performance_efficiency: context.performance_metrics.efficiency,
        })
    }

    /// Store performance metrics
    async fn store_performance_metrics(
        &self,
        metrics: &PerformanceMetrics,
    ) -> Result<(), OrchestrationError> {
        let mut history = self.performance_history.write().await;
        history.push(metrics.clone());

        // Keep only recent history
        if history.len() > 1000 {
            let to_remove = history.len() - 1000;
            for _ in 0..to_remove {
                history.remove(0);
            }
        }

        Ok(())
    }

    /// Start background performance monitoring
    async fn start_performance_monitoring(&self) -> Result<(), OrchestrationError> {
        let orchestrator = self.clone();
        let interval = self.orchestration_config.performance_analysis_interval;

        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);

            loop {
                interval_timer.tick().await;

                if let Err(e) = orchestrator.perform_background_analysis().await {
                    tracing::error!("Background performance analysis failed: {}", e);
                }
            }
        });

        Ok(())
    }

    /// Perform background performance analysis
    async fn perform_background_analysis(&self) -> Result<(), OrchestrationError> {
        // Analyze performance trends
        let history = self.performance_history.read().await;
        if history.is_empty() {
            return Ok(());
        }

        // Get recent metrics
        let recent_metrics = history.last().unwrap();

        // Analyze trends
        let analysis = self.performance_analyzer.analyze_metrics(recent_metrics).await?;

        // Check for performance issues
        if analysis.overall_health < 0.5 {
            tracing::warn!(
                workflow_id = %recent_metrics.workflow_id,
                health_score = %analysis.overall_health,
                "Poor performance detected"
            );
        }

        // Log trends
        for trend in &analysis.trends {
            tracing::debug!(
                metric = %trend.metric,
                trend = ?trend.trend,
                "Performance trend detected"
            );
        }

        Ok(())
    }

    /// Get orchestration statistics
    pub async fn get_orchestration_statistics(&self) -> Result<OrchestrationStatistics, OrchestrationError> {
        let active_recursions = self.active_recursions.read().await;
        let performance_history = self.performance_history.read().await;
        let recursion_stats = self.recursion_manager.get_recursion_statistics().await?;

        Ok(OrchestrationStatistics {
            active_recursions: active_recursions.len(),
            total_executions: performance_history.len(),
            average_execution_time: if !performance_history.is_empty() {
                let total_time: u64 = performance_history.iter().map(|m| m.execution_time_ms).sum();
                Duration::from_millis(total_time / performance_history.len() as u64)
            } else {
                Duration::from_secs(0)
            },
            success_rate: if !performance_history.is_empty() {
                performance_history.iter().map(|m| m.success_rate).sum::<f64>() / performance_history.len() as f64
            } else {
                1.0
            },
            recursion_statistics: crate::recursion::RecursionStatistics {
                active_recursions: recursion_stats.active_recursions,
                max_depth_active: recursion_stats.max_depth_active,
                total_executions: recursion_stats.total_executions,
                success_rate: recursion_stats.success_rate,
                average_execution_time: recursion_stats.average_execution_time,
                performance_alerts: recursion_stats.performance_alerts,
            },
            performance_alerts: self.recursion_manager.performance_monitor.get_active_alerts().await?,
        })
    }
}

/// Workflow execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
struct WorkflowExecutionResult {
    success: bool,
    performance_metrics: PerformanceMetrics,
    modifications_applied: Vec<WorkflowModification>,
    error: Option<String>,
}

/// Orchestration statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationStatistics {
    pub active_recursions: usize,
    pub total_executions: usize,
    pub average_execution_time: Duration,
    pub success_rate: f64,
    pub recursion_statistics: crate::recursion::RecursionStatistics,
    pub performance_alerts: Vec<crate::recursion::PerformanceAlert>,
}

// Implement Clone for EnhancedOrchestrator (needed for background tasks)
impl Clone for EnhancedOrchestrator {
    fn clone(&self) -> Self {
        Self {
            base_orchestrator: self.base_orchestrator.clone(),
            recursion_manager: self.recursion_manager.clone(),
            context_propagation: self.context_propagation.clone(),
            dynamic_modifier: self.dynamic_modifier.clone(),
            performance_analyzer: self.performance_analyzer.clone(),
            orchestration_config: self.orchestration_config.clone(),
            active_recursions: Arc::clone(&self.active_recursions),
            performance_history: Arc::clone(&self.performance_history),
        }
    }
}

// Add Clone implementations for the components
impl Clone for RecursiveExecutionManager {
    fn clone(&self) -> Self {
        Self {
            limits: self.limits.clone(),
            active_recursions: Arc::clone(&self.active_recursions),
            recursion_history: Arc::clone(&self.recursion_history),
            cycle_detector: self.cycle_detector.clone(),
            performance_monitor: self.performance_monitor.clone(),
        }
    }
}

impl Clone for ContextPropagationManager {
    fn clone(&self) -> Self {
        Self {
            context_store: Arc::clone(&self.context_store),
            propagation_rules: self.propagation_rules.clone(),
            context_optimizer: self.context_optimizer.clone(),
            inheritance_strategies: self.inheritance_strategies.clone(),
        }
    }
}

impl Clone for DynamicWorkflowModifier {
    fn clone(&self) -> Self {
        Self {
            modification_rules: self.modification_rules.clone(),
            adaptation_strategies: self.adaptation_strategies.clone(),
            modification_history: Arc::clone(&self.modification_history),
            performance_analyzer: self.performance_analyzer.clone(),
        }
    }
}

impl Clone for PerformanceAnalyzer {
    fn clone(&self) -> Self {
        Self {
            metrics_history: Arc::clone(&self.metrics_history),
            analysis_rules: self.analysis_rules.clone(),
        }
    }
}
