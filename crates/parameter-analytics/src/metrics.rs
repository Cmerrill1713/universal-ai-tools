use crate::types::*;
use crate::AnalyticsError;
use ndarray::{Array1, Axis};
use ndarray_stats::QuantileExt;
use statistical::*;
use std::collections::HashMap;

pub struct MetricsCalculator;

impl MetricsCalculator {
    pub fn new() -> Self {
        Self
    }

    /// Calculate comprehensive performance metrics from execution data
    pub fn calculate_performance_metrics(&self, executions: &[ParameterExecution]) -> Result<PerformanceMetrics, AnalyticsError> {
        if executions.is_empty() {
            return Err(AnalyticsError::InsufficientData { 
                reason: "No executions provided".to_string() 
            });
        }

        let total_executions = executions.len() as u64;
        let successful_executions = executions.iter().filter(|e| e.success).count() as u64;
        let success_rate = successful_executions as f64 / total_executions as f64;

        // Response time statistics
        let response_times: Vec<f64> = executions.iter()
            .map(|e| e.execution_time as f64)
            .collect();

        let avg_response_time = mean(&response_times);
        let fastest_response_time = response_times.iter().copied().fold(f64::INFINITY, f64::min);
        let slowest_response_time = response_times.iter().copied().fold(0.0, f64::max);

        // Calculate percentiles using ndarray
        let response_array = Array1::from_vec(response_times.clone());
        let p50_response_time = response_array.quantile_axis_mut(Axis(0), 0.5, &ndarray_stats::interpolate::Linear)
            .map_err(|e| AnalyticsError::StatisticalError { 
                error: format!("Failed to calculate P50: {}", e) 
            })?.into_scalar();
        
        let p90_response_time = response_array.quantile_axis_mut(Axis(0), 0.90, &ndarray_stats::interpolate::Linear)
            .map_err(|e| AnalyticsError::StatisticalError { 
                error: format!("Failed to calculate P90: {}", e) 
            })?.into_scalar();

        let p95_response_time = response_array.quantile_axis_mut(Axis(0), 0.95, &ndarray_stats::interpolate::Linear)
            .map_err(|e| AnalyticsError::StatisticalError { 
                error: format!("Failed to calculate P95: {}", e) 
            })?.into_scalar();

        let p99_response_time = response_array.quantile_axis_mut(Axis(0), 0.99, &ndarray_stats::interpolate::Linear)
            .map_err(|e| AnalyticsError::StatisticalError { 
                error: format!("Failed to calculate P99: {}", e) 
            })?.into_scalar();

        // Token usage statistics
        let token_counts: Vec<f64> = executions.iter()
            .map(|e| e.token_usage.total_tokens as f64)
            .collect();
        let avg_tokens_per_request = mean(&token_counts);

        // Cost calculations (using average pricing)
        let total_cost = executions.iter()
            .map(|e| self.estimate_cost(&e.token_usage, &e.provider))
            .sum::<f64>();

        let cost_per_successful_request = if successful_executions > 0 {
            total_cost / successful_executions as f64
        } else {
            0.0
        };

        // Error and timeout rates
        let error_rate = 1.0 - success_rate;
        let timeout_executions = executions.iter()
            .filter(|e| e.error_type.as_ref().map_or(false, |t| t.contains("timeout")))
            .count() as f64;
        let timeout_rate = timeout_executions / total_executions as f64;

        Ok(PerformanceMetrics {
            total_executions,
            success_rate,
            avg_response_time,
            fastest_response_time: if fastest_response_time.is_infinite() { 0.0 } else { fastest_response_time },
            slowest_response_time,
            p50_response_time,
            p90_response_time,
            p95_response_time,
            p99_response_time,
            avg_tokens_per_request,
            total_cost,
            cost_per_successful_request,
            error_rate,
            timeout_rate,
            timestamp: chrono::Utc::now(),
        })
    }

    /// Calculate parameter effectiveness from grouped executions
    pub fn calculate_parameter_effectiveness(
        &self, 
        executions: &[ParameterExecution],
        parameter_hash: &str,
    ) -> Result<ParameterEffectiveness, AnalyticsError> {
        if executions.is_empty() {
            return Err(AnalyticsError::InsufficientData { 
                reason: "No executions provided for effectiveness calculation".to_string() 
            });
        }

        let task_type = executions[0].task_type;
        let parameters = executions[0].parameters.clone();

        let total_executions = executions.len() as u64;
        let successful_executions = executions.iter().filter(|e| e.success).count() as u64;
        let success_rate = successful_executions as f64 / total_executions as f64;

        // Calculate averages
        let execution_times: Vec<f64> = executions.iter().map(|e| e.execution_time as f64).collect();
        let token_usages: Vec<f64> = executions.iter().map(|e| e.token_usage.total_tokens as f64).collect();
        let quality_scores: Vec<f64> = executions.iter()
            .filter_map(|e| e.response_quality.map(|q| q as f64))
            .collect();
        let satisfaction_scores: Vec<f64> = executions.iter()
            .filter_map(|e| e.user_satisfaction.map(|s| s as f64))
            .collect();

        let avg_execution_time = mean(&execution_times);
        let avg_token_usage = mean(&token_usages);
        let avg_response_quality = if quality_scores.is_empty() { 0.0 } else { mean(&quality_scores) };
        let avg_user_satisfaction = if satisfaction_scores.is_empty() { 0.0 } else { mean(&satisfaction_scores) };

        // Calculate trends
        let quality_trend = self.calculate_trend(&quality_scores)?;
        let speed_trend = self.calculate_trend(&execution_times)?;
        let cost_efficiency_trend = self.calculate_cost_efficiency_trend(executions)?;

        // Calculate variance and percentiles
        let execution_time_variance = variance(&execution_times);
        let quality_variance = if quality_scores.len() > 1 { variance(&quality_scores) } else { 0.0 };

        let execution_time_array = Array1::from_vec(execution_times);
        let p95_execution_time = execution_time_array
            .quantile_axis_mut(Axis(0), 0.95, &ndarray_stats::interpolate::Linear)
            .map_err(|e| AnalyticsError::StatisticalError { 
                error: format!("Failed to calculate P95 execution time: {}", e) 
            })?.into_scalar();

        let p99_execution_time = execution_time_array
            .quantile_axis_mut(Axis(0), 0.99, &ndarray_stats::interpolate::Linear)
            .map_err(|e| AnalyticsError::StatisticalError { 
                error: format!("Failed to calculate P99 execution time: {}", e) 
            })?.into_scalar();

        // Calculate confidence score based on sample size and variance
        let confidence_score = self.calculate_confidence_score(total_executions, execution_time_variance);
        let sample_size_adequacy = total_executions >= 30; // Generally accepted minimum for statistical significance

        Ok(ParameterEffectiveness {
            task_type,
            parameter_set: parameter_hash.to_string(),
            parameters,
            total_executions,
            success_rate,
            avg_execution_time,
            avg_token_usage,
            avg_response_quality,
            avg_user_satisfaction,
            quality_trend,
            speed_trend: -speed_trend, // Negative because lower execution time is better
            cost_efficiency_trend,
            execution_time_variance,
            quality_variance,
            p95_execution_time,
            p99_execution_time,
            last_updated: chrono::Utc::now(),
            confidence_score,
            sample_size_adequacy,
        })
    }

    /// Calculate dashboard metrics from recent executions
    pub fn calculate_dashboard_metrics(
        &self,
        executions: &[ParameterExecution],
        effectiveness_data: &[ParameterEffectiveness],
        insights: &[OptimizationInsight],
    ) -> Result<DashboardMetrics, AnalyticsError> {
        let performance_metrics = self.calculate_performance_metrics(executions)?;

        // Calculate top performing tasks
        let task_performance_map = self.calculate_task_performance_map(executions)?;
        let mut top_performing_tasks: Vec<TaskPerformance> = task_performance_map
            .into_iter()
            .map(|(task_type, (score, executions, trend))| TaskPerformance {
                task_type,
                score,
                executions,
                trend,
                confidence: (executions as f64 / 100.0).min(0.95),
            })
            .collect();

        top_performing_tasks.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        top_performing_tasks.truncate(5);

        // Calculate parameter trends
        let parameter_trends = self.calculate_parameter_trends(effectiveness_data);

        // Calculate cost efficiency metrics
        let cost_efficiency = self.calculate_cost_efficiency_metrics(executions)?;

        // Calculate system health
        let system_health = self.calculate_system_health(&performance_metrics, &parameter_trends);

        Ok(DashboardMetrics {
            total_executions: performance_metrics.total_executions,
            success_rate: performance_metrics.success_rate,
            avg_response_time: performance_metrics.avg_response_time,
            top_performing_tasks,
            recent_insights: insights.iter().take(10).cloned().collect(),
            parameter_trends,
            cost_efficiency,
            system_health,
        })
    }

    fn estimate_cost(&self, token_usage: &TokenUsage, provider: &str) -> f64 {
        // Simplified cost estimation based on common pricing
        let (prompt_cost_per_1k, completion_cost_per_1k) = match provider.to_lowercase().as_str() {
            "openai" => (0.01, 0.03), // GPT-3.5 Turbo pricing
            "anthropic" => (0.008, 0.024), // Claude pricing
            "ollama" | "lm-studio" | "lfm2" => (0.0, 0.0), // Local models
            _ => (0.005, 0.015), // Default/average pricing
        };

        token_usage.cost(prompt_cost_per_1k, completion_cost_per_1k)
    }

    fn calculate_trend(&self, values: &[f64]) -> Result<f64, AnalyticsError> {
        if values.len() < 5 {
            return Ok(0.0); // Not enough data for trend analysis
        }

        let n = values.len();
        let half = n / 2;
        
        let first_half: Vec<f64> = values.iter().take(half).copied().collect();
        let second_half: Vec<f64> = values.iter().skip(n - half).copied().collect();

        if first_half.is_empty() || second_half.is_empty() {
            return Ok(0.0);
        }

        let first_avg = mean(&first_half);
        let second_avg = mean(&second_half);

        if first_avg == 0.0 {
            return Ok(0.0);
        }

        Ok((second_avg - first_avg) / first_avg)
    }

    fn calculate_cost_efficiency_trend(&self, executions: &[ParameterExecution]) -> Result<f64, AnalyticsError> {
        if executions.len() < 5 {
            return Ok(0.0);
        }

        let costs: Vec<f64> = executions.iter()
            .map(|e| self.estimate_cost(&e.token_usage, &e.provider))
            .collect();

        // Invert the trend since lower cost is better
        Ok(-self.calculate_trend(&costs)?)
    }

    fn calculate_confidence_score(&self, sample_size: u64, variance: f64) -> f64 {
        // Confidence based on sample size and variance
        let size_factor = (sample_size as f64 / 100.0).min(1.0);
        let variance_factor = if variance > 0.0 { 
            1.0 / (1.0 + variance / 1000.0)
        } else { 
            1.0 
        };
        
        (size_factor * variance_factor).min(0.95)
    }

    fn calculate_task_performance_map(
        &self,
        executions: &[ParameterExecution],
    ) -> Result<HashMap<TaskType, (f64, u64, TrendDirection)>, AnalyticsError> {
        let mut task_groups: HashMap<TaskType, Vec<&ParameterExecution>> = HashMap::new();
        
        for execution in executions {
            task_groups.entry(execution.task_type).or_default().push(execution);
        }

        let mut result = HashMap::new();

        for (task_type, group_executions) in task_groups {
            let executions_count = group_executions.len() as u64;
            let success_rate = group_executions.iter().filter(|e| e.success).count() as f64 / executions_count as f64;
            
            // Calculate performance score
            let avg_execution_time = group_executions.iter()
                .map(|e| e.execution_time as f64)
                .sum::<f64>() / executions_count as f64;
            
            let avg_quality = group_executions.iter()
                .filter_map(|e| e.response_quality)
                .map(|q| q as f64)
                .sum::<f64>() / group_executions.len() as f64;

            let performance_score = success_rate * 0.5 + 
                (1.0 - (avg_execution_time / 30000.0).min(1.0)) * 0.3 +
                avg_quality * 0.2;

            // Calculate trend
            let response_times: Vec<f64> = group_executions.iter()
                .map(|e| e.execution_time as f64)
                .collect();
            
            let trend_value = self.calculate_trend(&response_times).unwrap_or(0.0);
            let trend = if trend_value > 0.1 {
                TrendDirection::Declining // Higher response time is worse
            } else if trend_value < -0.1 {
                TrendDirection::Improving
            } else {
                TrendDirection::Stable
            };

            result.insert(task_type, (performance_score, executions_count, trend));
        }

        Ok(result)
    }

    fn calculate_parameter_trends(&self, effectiveness_data: &[ParameterEffectiveness]) -> Vec<ParameterTrend> {
        let mut task_trends: HashMap<TaskType, Vec<f64>> = HashMap::new();

        for effectiveness in effectiveness_data {
            task_trends.entry(effectiveness.task_type)
                .or_default()
                .push(effectiveness.performance_score());
        }

        task_trends
            .into_iter()
            .map(|(task_type, scores)| {
                let trend_value = self.calculate_trend(&scores).unwrap_or(0.0);
                let trend = if trend_value > 0.1 {
                    TrendDirection::Improving
                } else if trend_value < -0.1 {
                    TrendDirection::Declining
                } else {
                    TrendDirection::Stable
                };

                let confidence = (scores.len() as f64 / 10.0).min(0.95);

                ParameterTrend {
                    task_type,
                    trend,
                    change_percent: trend_value * 100.0,
                    confidence,
                }
            })
            .collect()
    }

    fn calculate_cost_efficiency_metrics(&self, executions: &[ParameterExecution]) -> Result<CostEfficiencyMetrics, AnalyticsError> {
        if executions.is_empty() {
            return Err(AnalyticsError::InsufficientData { 
                reason: "No executions for cost efficiency calculation".to_string() 
            });
        }

        let total_cost: f64 = executions.iter()
            .map(|e| self.estimate_cost(&e.token_usage, &e.provider))
            .sum();

        let cost_per_request = total_cost / executions.len() as f64;
        let total_tokens: u64 = executions.iter()
            .map(|e| e.token_usage.total_tokens as u64)
            .sum();
        let cost_per_token = if total_tokens > 0 { total_cost / total_tokens as f64 } else { 0.0 };

        // Calculate efficiency by task type
        let mut task_efficiency: HashMap<TaskType, f64> = HashMap::new();
        let mut task_groups: HashMap<TaskType, Vec<&ParameterExecution>> = HashMap::new();
        
        for execution in executions {
            task_groups.entry(execution.task_type).or_default().push(execution);
        }

        for (task_type, group_executions) in task_groups {
            let task_cost: f64 = group_executions.iter()
                .map(|e| self.estimate_cost(&e.token_usage, &e.provider))
                .sum();
            let success_rate = group_executions.iter().filter(|e| e.success).count() as f64 / group_executions.len() as f64;
            let efficiency = if task_cost > 0.0 { success_rate / task_cost } else { success_rate };
            
            task_efficiency.insert(task_type, efficiency);
        }

        let most_efficient_task = task_efficiency.iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(task_type, _)| *task_type);

        let least_efficient_task = task_efficiency.iter()
            .min_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(task_type, _)| *task_type);

        // Calculate efficiency trend
        let costs: Vec<f64> = executions.iter()
            .map(|e| self.estimate_cost(&e.token_usage, &e.provider))
            .collect();
        
        let efficiency_trend_value = -self.calculate_trend(&costs).unwrap_or(0.0); // Inverted because lower cost is better
        let efficiency_trend = if efficiency_trend_value > 0.1 {
            TrendDirection::Improving
        } else if efficiency_trend_value < -0.1 {
            TrendDirection::Declining
        } else {
            TrendDirection::Stable
        };

        Ok(CostEfficiencyMetrics {
            total_cost,
            cost_per_request,
            cost_per_token,
            most_efficient_task,
            least_efficient_task,
            efficiency_trend,
        })
    }

    fn calculate_system_health(&self, performance: &PerformanceMetrics, trends: &[ParameterTrend]) -> SystemHealth {
        // Overall performance score
        let latency_health = if performance.avg_response_time < 1000.0 {
            1.0
        } else if performance.avg_response_time < 5000.0 {
            1.0 - (performance.avg_response_time - 1000.0) / 4000.0
        } else {
            0.1
        };

        let error_rate_health = 1.0 - performance.error_rate;
        
        let cost_health = if performance.cost_per_successful_request < 0.01 {
            1.0
        } else if performance.cost_per_successful_request < 0.1 {
            1.0 - (performance.cost_per_successful_request - 0.01) / 0.09
        } else {
            0.1
        };

        // Trend health based on improving trends
        let improving_trends = trends.iter()
            .filter(|t| t.trend == TrendDirection::Improving)
            .count() as f64;
        let total_trends = trends.len() as f64;
        let trend_health = if total_trends > 0.0 {
            improving_trends / total_trends
        } else {
            0.5
        };

        let overall_score = (latency_health * 0.3 + error_rate_health * 0.3 + cost_health * 0.2 + trend_health * 0.2).max(0.0).min(1.0);

        SystemHealth {
            overall_score,
            latency_health,
            error_rate_health,
            cost_health,
            trend_health,
        }
    }
}

impl Default for MetricsCalculator {
    fn default() -> Self {
        Self::new()
    }
}