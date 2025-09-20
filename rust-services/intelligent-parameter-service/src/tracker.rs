//! Performance tracking and analytics

use crate::types::*;
use std::collections::{HashMap, VecDeque};
use chrono::Utc;
use tracing::debug;

/// Tracks performance of parameter configurations
pub struct PerformanceTracker {
    history: VecDeque<PerformanceFeedback>,
    max_history_size: usize,
    aggregated_metrics: HashMap<TaskType, AggregatedMetrics>,
    model_metrics: HashMap<String, ModelMetrics>,
}

#[derive(Clone, Debug)]
struct AggregatedMetrics {
    total_requests: u64,
    total_quality: f64,
    total_latency: f64,
    total_tokens: usize,
    total_cost: f64,
    error_count: u64,
    parameter_stats: HashMap<String, ParameterStats>,
}

#[derive(Clone, Debug)]
struct ParameterStats {
    sum: f64,
    count: u64,
    min: f64,
    max: f64,
}

impl PerformanceTracker {
    /// Create a new performance tracker
    pub fn new(max_history_size: usize) -> Self {
        Self {
            history: VecDeque::with_capacity(max_history_size),
            max_history_size,
            aggregated_metrics: HashMap::new(),
            model_metrics: HashMap::new(),
        }
    }
    
    /// Record performance feedback
    pub fn record(&mut self, feedback: PerformanceFeedback) {
        // Add to history
        if self.history.len() >= self.max_history_size {
            self.history.pop_front();
        }
        
        // Update aggregated metrics
        {
            let metrics = self.aggregated_metrics
                .entry(feedback.task_type.clone())
                .or_insert_with(|| AggregatedMetrics {
                    total_requests: 0,
                    total_quality: 0.0,
                    total_latency: 0.0,
                    total_tokens: 0,
                    total_cost: 0.0,
                    error_count: 0,
                    parameter_stats: HashMap::new(),
                });
            
            metrics.total_requests += 1;
            metrics.total_quality += feedback.quality_score as f64;
            metrics.total_latency += feedback.latency_ms as f64;
            metrics.total_tokens += feedback.token_count;
            metrics.total_cost += feedback.cost_estimate as f64;
            
            if feedback.error_occurred {
                metrics.error_count += 1;
            }
        }
        
        // Update parameter statistics
        let params = feedback.parameters_used.clone();
        if let Some(metrics) = self.aggregated_metrics.get_mut(&feedback.task_type) {
            Self::update_parameter_stats_impl(metrics, &params);
        }
        
        // Update model metrics
        self.update_model_metrics(&feedback);
        
        self.history.push_back(feedback);
        
        debug!("Recorded performance feedback, history size: {}", self.history.len());
    }
    
    /// Update parameter statistics
    fn update_parameter_stats_impl(metrics: &mut AggregatedMetrics, params: &OptimalParameters) {
        // Temperature stats
        let temp_stats = metrics.parameter_stats
            .entry("temperature".to_string())
            .or_insert_with(|| ParameterStats {
                sum: 0.0,
                count: 0,
                min: f64::MAX,
                max: f64::MIN,
            });
        
        temp_stats.sum += params.temperature as f64;
        temp_stats.count += 1;
        temp_stats.min = temp_stats.min.min(params.temperature as f64);
        temp_stats.max = temp_stats.max.max(params.temperature as f64);
        
        // Top-p stats
        let top_p_stats = metrics.parameter_stats
            .entry("top_p".to_string())
            .or_insert_with(|| ParameterStats {
                sum: 0.0,
                count: 0,
                min: f64::MAX,
                max: f64::MIN,
            });
        
        top_p_stats.sum += params.top_p as f64;
        top_p_stats.count += 1;
        top_p_stats.min = top_p_stats.min.min(params.top_p as f64);
        top_p_stats.max = top_p_stats.max.max(params.top_p as f64);
    }
    
    /// Update model-specific metrics
    fn update_model_metrics(&mut self, feedback: &PerformanceFeedback) {
        // This would normally extract the model from feedback
        // For now, using a placeholder
        let model_name = "default_model";
        
        let model_metric = self.model_metrics
            .entry(model_name.to_string())
            .or_insert_with(|| ModelMetrics {
                request_count: 0,
                avg_quality: 0.0,
                avg_latency_ms: 0.0,
                error_rate: 0.0,
                optimal_parameters: HashMap::new(),
            });
        
        let n = model_metric.request_count as f32;
        model_metric.avg_quality = (model_metric.avg_quality * n + feedback.quality_score) / (n + 1.0);
        model_metric.avg_latency_ms = (model_metric.avg_latency_ms * n as f64 + feedback.latency_ms as f64) / (n + 1.0) as f64;
        
        if feedback.error_occurred {
            model_metric.error_rate = (model_metric.error_rate * n + 1.0) / (n + 1.0);
        } else {
            model_metric.error_rate = (model_metric.error_rate * n) / (n + 1.0);
        }
        
        model_metric.request_count += 1;
        
        // Update optimal parameters if this is the best performance
        let current_best = model_metric.optimal_parameters
            .get(&feedback.task_type)
            .map(|p: &OptimalParameters| p.expected_quality)
            .unwrap_or(0.0);
        
        if feedback.quality_score > current_best {
            model_metric.optimal_parameters.insert(
                feedback.task_type.clone(),
                feedback.parameters_used.clone()
            );
        }
    }
    
    /// Get relevant history for a task type
    pub fn get_relevant_history(&self, task_type: &TaskType) -> Vec<PerformanceHistory> {
        let mut history_map: HashMap<String, Vec<PerformanceFeedback>> = HashMap::new();
        
        // Group feedback by parameter configuration
        for feedback in &self.history {
            if &feedback.task_type == task_type {
                let key = format!(
                    "{:.1}_{:.1}_{}",
                    feedback.parameters_used.temperature,
                    feedback.parameters_used.top_p,
                    feedback.parameters_used.max_tokens
                );
                
                history_map.entry(key.clone())
                    .or_insert_with(Vec::new)
                    .push(feedback.clone());
            }
        }
        
        // Aggregate into performance history
        history_map.into_iter().map(|(key, feedbacks)| {
            let count = feedbacks.len();
            let avg_quality = feedbacks.iter().map(|f| f.quality_score).sum::<f32>() / count as f32;
            let avg_latency = feedbacks.iter().map(|f| f.latency_ms as f64).sum::<f64>() / count as f64;
            let success_rate = feedbacks.iter().filter(|f| !f.error_occurred).count() as f32 / count as f32;
            
            PerformanceHistory {
                task_type: task_type.clone(),
                model: "default".to_string(),
                parameters: feedbacks[0].parameters_used.clone(),
                avg_quality,
                avg_latency_ms: avg_latency,
                success_rate,
                sample_count: count,
                last_updated: Utc::now(),
            }
        }).collect()
    }
    
    /// Get performance analytics
    pub fn get_analytics(&self) -> PerformanceAnalytics {
        let total_requests = self.history.len() as u64;
        let avg_quality = if !self.history.is_empty() {
            self.history.iter().map(|f| f.quality_score).sum::<f32>() / self.history.len() as f32
        } else {
            0.0
        };
        
        let avg_latency = if !self.history.is_empty() {
            self.history.iter().map(|f| f.latency_ms as f64).sum::<f64>() / self.history.len() as f64
        } else {
            0.0
        };
        
        // Calculate task distribution
        let mut task_distribution = HashMap::new();
        for feedback in &self.history {
            *task_distribution.entry(feedback.task_type.clone()).or_insert(0) += 1;
        }
        
        // Calculate parameter effectiveness
        let parameter_effectiveness = self.calculate_parameter_effectiveness();
        
        // Calculate optimization improvements
        let optimization_improvements = self.calculate_optimization_improvements();
        
        PerformanceAnalytics {
            total_requests,
            cache_hit_rate: 0.0, // Would be updated by cache
            avg_quality_score: avg_quality,
            avg_latency_ms: avg_latency,
            optimization_improvements,
            task_distribution,
            parameter_effectiveness,
            model_performance: self.model_metrics.clone(),
        }
    }
    
    /// Calculate parameter effectiveness metrics
    fn calculate_parameter_effectiveness(&self) -> HashMap<String, ParameterMetrics> {
        let mut effectiveness = HashMap::new();
        
        for (task_type, metrics) in &self.aggregated_metrics {
            for (param_name, stats) in &metrics.parameter_stats {
                if stats.count > 0 {
                    let avg_value = stats.sum / stats.count as f64;
                    
                    effectiveness.insert(
                        format!("{:?}_{}", task_type, param_name),
                        ParameterMetrics {
                            avg_value: avg_value as f32,
                            optimal_range: (stats.min as f32, stats.max as f32),
                            correlation_with_quality: 0.0, // Would require correlation calculation
                            correlation_with_latency: 0.0,
                            usage_frequency: stats.count,
                        }
                    );
                }
            }
        }
        
        effectiveness
    }
    
    /// Calculate optimization improvements
    fn calculate_optimization_improvements(&self) -> OptimizationMetrics {
        if self.history.len() < 20 {
            return OptimizationMetrics {
                quality_improvement: 0.0,
                latency_reduction: 0.0,
                cost_reduction: 0.0,
                consistency_improvement: 0.0,
            };
        }
        
        let mid_point = self.history.len() / 2;
        let early_history: Vec<_> = self.history.iter().take(mid_point).collect();
        let recent_history: Vec<_> = self.history.iter().skip(mid_point).collect();
        
        let early_quality = early_history.iter().map(|f| f.quality_score).sum::<f32>() / early_history.len() as f32;
        let recent_quality = recent_history.iter().map(|f| f.quality_score).sum::<f32>() / recent_history.len() as f32;
        
        let early_latency = early_history.iter().map(|f| f.latency_ms as f64).sum::<f64>() / early_history.len() as f64;
        let recent_latency = recent_history.iter().map(|f| f.latency_ms as f64).sum::<f64>() / recent_history.len() as f64;
        
        OptimizationMetrics {
            quality_improvement: ((recent_quality - early_quality) / early_quality * 100.0).max(0.0),
            latency_reduction: ((early_latency - recent_latency) / early_latency * 100.0).max(0.0) as f32,
            cost_reduction: 0.0, // Would need cost tracking
            consistency_improvement: 0.0, // Would need variance calculation
        }
    }
}