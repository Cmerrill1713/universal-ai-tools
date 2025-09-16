//! Dynamic Workflow Modification System
//!
//! This module provides capabilities for runtime workflow modification
//! based on intermediate results and performance feedback.

use crate::{OrchestrationError, workflow::WorkflowNode, PerformanceMetrics};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Dynamic workflow modifier
pub struct DynamicWorkflowModifier {
    pub modification_rules: Vec<ModificationRule>,
    pub adaptation_strategies: Vec<AdaptationStrategy>,
    pub modification_history: Arc<RwLock<Vec<WorkflowModification>>>,
    pub performance_analyzer: PerformanceAnalyzer,
}

/// Workflow modification rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModificationRule {
    pub rule_id: Uuid,
    pub name: String,
    pub trigger: ModificationTrigger,
    pub action: ModificationAction,
    pub priority: u8,
    pub enabled: bool,
}

/// Modification trigger conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModificationTrigger {
    PerformanceDegradation { threshold: f64 },
    ResourceExhaustion { threshold: f64 },
    ErrorRateHigh { threshold: f64 },
    ExecutionTimeExceeded { threshold_ms: u64 },
    Custom { expression: String },
}

/// Modification actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModificationAction {
    AddNode { node: WorkflowNode },
    RemoveNode { node_id: String },
    ModifyNode { node_id: String, modifications: NodeModifications },
    AddEdge { from: String, to: String },
    RemoveEdge { from: String, to: String },
    ScaleResources { factor: f64 },
    ChangeStrategy { strategy: String },
}

/// Node modifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeModifications {
    pub timeout_seconds: Option<u64>,
    pub resource_requirements: Option<ResourceRequirements>,
    pub retry_policy: Option<RetryPolicy>,
    pub conditions: Option<Vec<ExecutionCondition>>,
}

/// Resource requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceRequirements {
    pub cpu_cores: f64,
    pub memory_mb: usize,
    pub network_bandwidth_mbps: u64,
    pub storage_mb: usize,
}

/// Retry policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
    pub backoff_multiplier: f64,
}

/// Execution condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionCondition {
    pub condition_type: String,
    pub expression: String,
}

/// Adaptation strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptationStrategy {
    pub strategy_id: Uuid,
    pub name: String,
    pub strategy_type: AdaptationType,
    pub parameters: HashMap<String, serde_json::Value>,
    pub enabled: bool,
}

/// Types of adaptation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AdaptationType {
    PerformanceBased,
    ResourceBased,
    ErrorBased,
    TimeBased,
    Custom(String),
}

/// Workflow modification record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowModification {
    pub modification_id: Uuid,
    pub workflow_id: Uuid,
    pub rule_id: Uuid,
    pub action: ModificationAction,
    pub reason: String,
    pub timestamp: DateTime<Utc>,
    pub success: bool,
    pub performance_impact: Option<f64>,
}

/// Performance analyzer
pub struct PerformanceAnalyzer {
    pub metrics_history: Arc<RwLock<Vec<PerformanceMetrics>>>,
    pub analysis_rules: Vec<AnalysisRule>,
}

/// Analysis rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisRule {
    pub rule_id: Uuid,
    pub name: String,
    pub condition: AnalysisCondition,
    pub recommendation: ModificationRecommendation,
}

/// Analysis condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisCondition {
    PerformanceBelow(f64),
    ResourceUsageAbove(f64),
    ErrorRateAbove(f64),
    ExecutionTimeAbove(u64),
}

/// Modification recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModificationRecommendation {
    pub action: ModificationAction,
    pub confidence: f64,
    pub expected_improvement: f64,
    pub risk_level: RiskLevel,
}

/// Risk levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl DynamicWorkflowModifier {
    /// Create a new dynamic workflow modifier
    pub fn new() -> Self {
        Self {
            modification_rules: Vec::new(),
            adaptation_strategies: Vec::new(),
            modification_history: Arc::new(RwLock::new(Vec::new())),
            performance_analyzer: PerformanceAnalyzer::new(),
        }
    }

    /// Analyze workflow and suggest modifications
    pub async fn analyze_workflow(
        &self,
        workflow_id: Uuid,
        current_metrics: &PerformanceMetrics,
    ) -> Result<Vec<ModificationRecommendation>, OrchestrationError> {
        let mut recommendations = Vec::new();

        // Analyze performance metrics
        let _analysis = self.performance_analyzer.analyze_metrics(current_metrics).await?;

        // Check modification rules
        for rule in &self.modification_rules {
            if !rule.enabled {
                continue;
            }

            if self.evaluate_trigger(&rule.trigger, current_metrics).await? {
                let recommendation = ModificationRecommendation {
                    action: rule.action.clone(),
                    confidence: self.calculate_confidence(&rule, current_metrics).await?,
                    expected_improvement: self.estimate_improvement(&rule, current_metrics).await?,
                    risk_level: self.assess_risk(&rule).await?,
                };

                recommendations.push(recommendation);
            }
        }

        // Apply adaptation strategies
        for strategy in &self.adaptation_strategies {
            if !strategy.enabled {
                continue;
            }

            let strategy_recommendations = self.apply_adaptation_strategy(
                strategy,
                workflow_id,
                current_metrics,
            ).await?;

            recommendations.extend(strategy_recommendations);
        }

        // Sort by confidence and expected improvement
        recommendations.sort_by(|a, b| {
            b.confidence.partial_cmp(&a.confidence).unwrap()
                .then(b.expected_improvement.partial_cmp(&a.expected_improvement).unwrap())
        });

        Ok(recommendations)
    }

    /// Apply workflow modifications
    pub async fn apply_modifications(
        &self,
        workflow_id: Uuid,
        modifications: Vec<ModificationAction>,
        reason: String,
    ) -> Result<WorkflowModification, OrchestrationError> {
        let modification_id = Uuid::new_v4();
        let mut success = true;
        let mut performance_impact = None;

        // Apply each modification
        for action in &modifications {
            match self.apply_modification_action(workflow_id, action).await {
                Ok(impact) => {
                    performance_impact = Some(impact);
                }
                Err(e) => {
                    tracing::error!(
                        workflow_id = %workflow_id,
                        action = ?action,
                        error = %e,
                        "Failed to apply modification"
                    );
                    success = false;
                }
            }
        }

        // Record modification
        let modification = WorkflowModification {
            modification_id,
            workflow_id,
            rule_id: Uuid::new_v4(), // Would be from the rule that triggered this
            action: modifications.first().cloned().unwrap_or_else(|| {
                ModificationAction::ChangeStrategy { strategy: "none".to_string() }
            }),
            reason,
            timestamp: Utc::now(),
            success,
            performance_impact,
        };

        // Store in history
        {
            let mut history = self.modification_history.write().await;
            history.push(modification.clone());
        }

        Ok(modification)
    }

    /// Evaluate trigger condition
    async fn evaluate_trigger(
        &self,
        trigger: &ModificationTrigger,
        metrics: &PerformanceMetrics,
    ) -> Result<bool, OrchestrationError> {
        match trigger {
            ModificationTrigger::PerformanceDegradation { threshold } => {
                Ok(metrics.success_rate < *threshold)
            }
            ModificationTrigger::ResourceExhaustion { threshold } => {
                Ok(metrics.resource_utilization > *threshold)
            }
            ModificationTrigger::ErrorRateHigh { threshold } => {
                Ok(metrics.error_rate > *threshold)
            }
            ModificationTrigger::ExecutionTimeExceeded { threshold_ms } => {
                Ok(metrics.execution_time_ms > *threshold_ms)
            }
            ModificationTrigger::Custom { expression: _ } => {
                // In a real implementation, this would evaluate the expression
                Ok(false)
            }
        }
    }

    /// Calculate confidence for a recommendation
    async fn calculate_confidence(
        &self,
        rule: &ModificationRule,
        metrics: &PerformanceMetrics,
    ) -> Result<f64, OrchestrationError> {
        // Base confidence on rule priority and metrics alignment
        let base_confidence = rule.priority as f64 / 10.0;

        // Adjust based on how well the trigger matches current conditions
        let trigger_match = match &rule.trigger {
            ModificationTrigger::PerformanceDegradation { threshold } => {
                if metrics.success_rate < *threshold {
                    1.0 - (metrics.success_rate - *threshold).abs() / *threshold
                } else {
                    0.0
                }
            }
            ModificationTrigger::ResourceExhaustion { threshold } => {
                if metrics.resource_utilization > *threshold {
                    (metrics.resource_utilization - *threshold) / (1.0 - *threshold)
                } else {
                    0.0
                }
            }
            _ => 0.5,
        };

        Ok((base_confidence + trigger_match) / 2.0)
    }

    /// Estimate improvement from a modification
    async fn estimate_improvement(
        &self,
        rule: &ModificationRule,
        _metrics: &PerformanceMetrics,
    ) -> Result<f64, OrchestrationError> {
        // Estimate based on the type of action
        match &rule.action {
            ModificationAction::ScaleResources { factor } => {
                Ok((*factor - 1.0) * 0.2) // 20% improvement per resource scaling
            }
            ModificationAction::AddNode { .. } => {
                Ok(0.1) // 10% improvement from additional processing
            }
            ModificationAction::RemoveNode { .. } => {
                Ok(0.05) // 5% improvement from reduced overhead
            }
            ModificationAction::ModifyNode { .. } => {
                Ok(0.15) // 15% improvement from optimization
            }
            _ => Ok(0.1), // Default 10% improvement
        }
    }

    /// Assess risk of a modification
    async fn assess_risk(&self, rule: &ModificationRule) -> Result<RiskLevel, OrchestrationError> {
        match &rule.action {
            ModificationAction::RemoveNode { .. } => Ok(RiskLevel::High),
            ModificationAction::RemoveEdge { .. } => Ok(RiskLevel::Medium),
            ModificationAction::ScaleResources { factor } => {
                if *factor < 0.5 {
                    Ok(RiskLevel::High)
                } else if *factor < 0.8 {
                    Ok(RiskLevel::Medium)
                } else {
                    Ok(RiskLevel::Low)
                }
            }
            _ => Ok(RiskLevel::Low),
        }
    }

    /// Apply adaptation strategy
    async fn apply_adaptation_strategy(
        &self,
        strategy: &AdaptationStrategy,
        _workflow_id: Uuid,
        metrics: &PerformanceMetrics,
    ) -> Result<Vec<ModificationRecommendation>, OrchestrationError> {
        let mut recommendations = Vec::new();

        match strategy.strategy_type {
            AdaptationType::PerformanceBased => {
                if metrics.success_rate < 0.8 {
                    recommendations.push(ModificationRecommendation {
                        action: ModificationAction::ScaleResources { factor: 1.2 },
                        confidence: 0.8,
                        expected_improvement: 0.15,
                        risk_level: RiskLevel::Low,
                    });
                }
            }
            AdaptationType::ResourceBased => {
                if metrics.resource_utilization > 0.9 {
                    recommendations.push(ModificationRecommendation {
                        action: ModificationAction::ScaleResources { factor: 1.5 },
                        confidence: 0.9,
                        expected_improvement: 0.25,
                        risk_level: RiskLevel::Medium,
                    });
                }
            }
            AdaptationType::ErrorBased => {
                if metrics.error_rate > 0.1 {
                    recommendations.push(ModificationRecommendation {
                        action: ModificationAction::ChangeStrategy {
                            strategy: "error_recovery".to_string()
                        },
                        confidence: 0.7,
                        expected_improvement: 0.2,
                        risk_level: RiskLevel::Low,
                    });
                }
            }
            _ => {}
        }

        Ok(recommendations)
    }

    /// Apply a single modification action
    async fn apply_modification_action(
        &self,
        workflow_id: Uuid,
        action: &ModificationAction,
    ) -> Result<f64, OrchestrationError> {
        match action {
            ModificationAction::ScaleResources { factor } => {
                // In a real implementation, this would scale resources
                tracing::info!(
                    workflow_id = %workflow_id,
                    factor = %factor,
                    "Scaling resources"
                );
                Ok(*factor)
            }
            ModificationAction::AddNode { node } => {
                // In a real implementation, this would add the node to the workflow
                tracing::info!(
                    workflow_id = %workflow_id,
                    node_id = %node.id,
                    "Adding node to workflow"
                );
                Ok(1.1) // 10% improvement
            }
            ModificationAction::RemoveNode { node_id } => {
                // In a real implementation, this would remove the node
                tracing::info!(
                    workflow_id = %workflow_id,
                    node_id = %node_id,
                    "Removing node from workflow"
                );
                Ok(1.05) // 5% improvement
            }
            _ => {
                tracing::info!(
                    workflow_id = %workflow_id,
                    action = ?action,
                    "Applying modification action"
                );
                Ok(1.0) // No change
            }
        }
    }
}

impl PerformanceAnalyzer {
    /// Create a new performance analyzer
    pub fn new() -> Self {
        Self {
            metrics_history: Arc::new(RwLock::new(Vec::new())),
            analysis_rules: Vec::new(),
        }
    }

    /// Analyze performance metrics
    pub async fn analyze_metrics(
        &self,
        metrics: &PerformanceMetrics,
    ) -> Result<AnalysisResult, OrchestrationError> {
        // Store metrics
        {
            let mut history = self.metrics_history.write().await;
            history.push(metrics.clone());

            // Keep only recent history
            if history.len() > 1000 {
                let to_remove = history.len() - 1000;
                for _ in 0..to_remove {
                    history.remove(0);
                }
            }
        }

        // Analyze trends
        let trends = self.analyze_trends().await?;

        // Check analysis rules
        let mut issues = Vec::new();
        for rule in &self.analysis_rules {
            if self.evaluate_analysis_condition(&rule.condition, metrics).await? {
                issues.push(rule.recommendation.clone());
            }
        }

        Ok(AnalysisResult {
            workflow_id: metrics.workflow_id,
            timestamp: metrics.timestamp,
            trends,
            issues,
            overall_health: self.calculate_overall_health(metrics),
        })
    }

    /// Analyze performance trends
    async fn analyze_trends(&self) -> Result<Vec<PerformanceTrend>, OrchestrationError> {
        let history = self.metrics_history.read().await;
        let mut trends = Vec::new();

        if history.len() < 2 {
            return Ok(trends);
        }

        // Calculate trend for execution time
        let execution_time_trend = self.calculate_trend(
            history.iter().map(|m| m.execution_time_ms as f64).collect()
        );
        trends.push(PerformanceTrend {
            metric: "execution_time".to_string(),
            trend: execution_time_trend,
        });

        // Calculate trend for success rate
        let success_rate_trend = self.calculate_trend(
            history.iter().map(|m| m.success_rate).collect()
        );
        trends.push(PerformanceTrend {
            metric: "success_rate".to_string(),
            trend: success_rate_trend,
        });

        Ok(trends)
    }

    /// Calculate trend for a metric
    fn calculate_trend(&self, values: Vec<f64>) -> TrendDirection {
        if values.len() < 2 {
            return TrendDirection::Stable;
        }

        let first_half = &values[0..values.len() / 2];
        let second_half = &values[values.len() / 2..];

        let first_avg = first_half.iter().sum::<f64>() / first_half.len() as f64;
        let second_avg = second_half.iter().sum::<f64>() / second_half.len() as f64;

        let change = (second_avg - first_avg) / first_avg;

        if change > 0.1 {
            TrendDirection::Improving
        } else if change < -0.1 {
            TrendDirection::Degrading
        } else {
            TrendDirection::Stable
        }
    }

    /// Evaluate analysis condition
    async fn evaluate_analysis_condition(
        &self,
        condition: &AnalysisCondition,
        metrics: &PerformanceMetrics,
    ) -> Result<bool, OrchestrationError> {
        match condition {
            AnalysisCondition::PerformanceBelow(threshold) => {
                Ok(metrics.success_rate < *threshold)
            }
            AnalysisCondition::ResourceUsageAbove(threshold) => {
                Ok(metrics.resource_utilization > *threshold)
            }
            AnalysisCondition::ErrorRateAbove(threshold) => {
                Ok(metrics.error_rate > *threshold)
            }
            AnalysisCondition::ExecutionTimeAbove(threshold) => {
                Ok(metrics.execution_time_ms > *threshold)
            }
        }
    }

    /// Calculate overall health score
    fn calculate_overall_health(&self, metrics: &PerformanceMetrics) -> f64 {
        let success_weight = 0.4;
        let resource_weight = 0.3;
        let error_weight = 0.2;
        let throughput_weight = 0.1;

        let success_score = metrics.success_rate;
        let resource_score = 1.0 - metrics.resource_utilization;
        let error_score = 1.0 - metrics.error_rate;
        let throughput_score = (metrics.throughput / 1000.0).min(1.0); // Normalize throughput

        success_score * success_weight +
        resource_score * resource_weight +
        error_score * error_weight +
        throughput_score * throughput_weight
    }
}

/// Analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub workflow_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub trends: Vec<PerformanceTrend>,
    pub issues: Vec<ModificationRecommendation>,
    pub overall_health: f64,
}

/// Performance trend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceTrend {
    pub metric: String,
    pub trend: TrendDirection,
}

/// Trend direction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrendDirection {
    Improving,
    Stable,
    Degrading,
}

impl Default for DynamicWorkflowModifier {
    fn default() -> Self {
        Self::new()
    }
}
