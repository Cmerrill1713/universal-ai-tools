//! Trend analysis for parameter performance over time
//! 
//! Implements real-time trend detection and forecasting algorithms

use crate::types::*;
use crate::error::{AnalyticsError, Result};
use std::collections::{HashMap, VecDeque};
use chrono::{DateTime, Utc};
use tracing::debug;

/// Real-time trend analyzer for parameter performance
pub struct TrendAnalyzer {
    /// Time series data for each task type
    time_series: HashMap<TaskType, TimeSeriesData>,
    /// Window size for trend calculation
    window_size: usize,
    /// Minimum data points needed for trend analysis
    min_data_points: usize,
}

#[derive(Clone, Debug)]
struct TimeSeriesData {
    timestamps: VecDeque<DateTime<Utc>>,
    execution_times: VecDeque<f64>,
    quality_scores: VecDeque<f64>,
    token_usages: VecDeque<f64>,
    last_updated: DateTime<Utc>,
}

#[derive(Clone, Debug)]
pub struct TrendResult {
    pub execution_time_trend: f64,
    pub quality_trend: f64,
    pub efficiency_trend: f64,
    pub volatility: f64,
    pub confidence: f64,
}

impl TrendAnalyzer {
    /// Create a new trend analyzer
    pub fn new() -> Self {
        Self {
            time_series: HashMap::new(),
            window_size: 100, // Analyze last 100 data points
            min_data_points: 10, // Need at least 10 points for trend analysis
        }
    }
    
    /// Add a new data point for trend analysis
    pub fn add_data_point(
        &mut self,
        task_type: &TaskType,
        execution_time: f64,
        quality_score: f64,
        token_usage: f64,
    ) -> Result<()> {
        let now = Utc::now();
        
        let data = self.time_series.entry(task_type.clone()).or_insert_with(|| {
            TimeSeriesData {
                timestamps: VecDeque::with_capacity(self.window_size),
                execution_times: VecDeque::with_capacity(self.window_size),
                quality_scores: VecDeque::with_capacity(self.window_size),
                token_usages: VecDeque::with_capacity(self.window_size),
                last_updated: now,
            }
        });
        
        // Add new data point
        data.timestamps.push_back(now);
        data.execution_times.push_back(execution_time);
        data.quality_scores.push_back(quality_score);
        data.token_usages.push_back(token_usage);
        data.last_updated = now;
        
        // Maintain window size
        while data.timestamps.len() > self.window_size {
            data.timestamps.pop_front();
            data.execution_times.pop_front();
            data.quality_scores.pop_front();
            data.token_usages.pop_front();
        }
        
        debug!("Added data point for {:?}, window size: {}", task_type, data.timestamps.len());
        Ok(())
    }
    
    /// Analyze trends for a specific task type
    pub fn analyze_trends(&self, task_type: &TaskType) -> Result<TrendResult> {
        let data = self.time_series.get(task_type)
            .ok_or_else(|| AnalyticsError::insufficient_data(1, 0))?;
            
        if data.timestamps.len() < self.min_data_points {
            return Err(AnalyticsError::insufficient_data(
                self.min_data_points as u64,
                data.timestamps.len() as u64,
            ));
        }
        
        // Convert timestamps to numeric values for regression
        let time_points: Vec<f64> = data.timestamps.iter()
            .enumerate()
            .map(|(i, _)| i as f64)
            .collect();
        
        // Calculate trends using linear regression
        let execution_times: Vec<f64> = data.execution_times.iter().copied().collect();
        let quality_scores: Vec<f64> = data.quality_scores.iter().copied().collect();
        let execution_time_trend = self.calculate_linear_trend(&time_points, &execution_times)?;
        let quality_trend = self.calculate_linear_trend(&time_points, &quality_scores)?;
        
        // Calculate efficiency trend (quality per token)
        let efficiencies: Vec<f64> = data.quality_scores.iter()
            .zip(data.token_usages.iter())
            .map(|(q, t)| if *t > 0.0 { q / t } else { 0.0 })
            .collect();
        let efficiency_trend = self.calculate_linear_trend(&time_points, &efficiencies)?;
        
        // Calculate volatility (standard deviation of recent changes)
        let volatility = self.calculate_volatility(&data.quality_scores);
        
        // Calculate confidence based on data quality
        let confidence = self.calculate_trend_confidence(data.timestamps.len());
        
        Ok(TrendResult {
            execution_time_trend,
            quality_trend,
            efficiency_trend,
            volatility,
            confidence,
        })
    }
    
    /// Get all available trends
    pub fn get_all_trends(&self) -> HashMap<TaskType, TrendResult> {
        let mut trends = HashMap::new();
        
        for task_type in self.time_series.keys() {
            if let Ok(trend) = self.analyze_trends(task_type) {
                trends.insert(task_type.clone(), trend);
            }
        }
        
        trends
    }
    
    /// Detect significant trend changes
    pub fn detect_trend_changes(&self) -> Result<Vec<TrendAlert>> {
        let mut alerts = Vec::new();
        
        for (task_type, data) in &self.time_series {
            if data.timestamps.len() < self.min_data_points {
                continue;
            }
            
            // Analyze recent vs historical trends
            let recent_trend = self.analyze_recent_trend(data)?;
            let historical_trend = self.analyze_historical_trend(data)?;
            
            // Detect significant changes
            let quality_change = (recent_trend.quality_trend - historical_trend.quality_trend).abs();
            let execution_time_change = (recent_trend.execution_time_trend - historical_trend.execution_time_trend).abs();
            
            if quality_change > 0.1 { // Significant quality change
                alerts.push(TrendAlert {
                    task_type: task_type.clone(),
                    alert_type: TrendAlertType::QualityChange,
                    severity: if quality_change > 0.2 { AlertSeverity::High } else { AlertSeverity::Medium },
                    message: format!(
                        "Quality trend changed by {:.2} for {:?}",
                        quality_change, task_type
                    ),
                    confidence: recent_trend.confidence,
                });
            }
            
            if execution_time_change > 100.0 { // Significant execution time change (ms)
                alerts.push(TrendAlert {
                    task_type: task_type.clone(),
                    alert_type: TrendAlertType::PerformanceChange,
                    severity: if execution_time_change > 500.0 { AlertSeverity::High } else { AlertSeverity::Medium },
                    message: format!(
                        "Execution time trend changed by {:.0}ms for {:?}",
                        execution_time_change, task_type
                    ),
                    confidence: recent_trend.confidence,
                });
            }
        }
        
        Ok(alerts)
    }
    
    /// Get average processing time across all task types
    pub fn get_avg_processing_time(&self) -> f64 {
        if self.time_series.is_empty() {
            return 0.0;
        }
        
        let total_sum: f64 = self.time_series.values()
            .map(|data| {
                if data.execution_times.is_empty() {
                    0.0
                } else {
                    data.execution_times.iter().sum::<f64>() / data.execution_times.len() as f64
                }
            })
            .sum();
            
        total_sum / self.time_series.len() as f64
    }
    
    /// Forecast future performance
    pub fn forecast_performance(&self, task_type: &TaskType, steps_ahead: usize) -> Result<PerformanceForecast> {
        let trend = self.analyze_trends(task_type)?;
        let data = self.time_series.get(task_type).unwrap();
        
        // Simple linear extrapolation
        let current_quality = data.quality_scores.back().copied().unwrap_or(0.5);
        let current_execution_time = data.execution_times.back().copied().unwrap_or(1000.0);
        
        let predicted_quality = current_quality + (trend.quality_trend * steps_ahead as f64);
        let predicted_execution_time = current_execution_time + (trend.execution_time_trend * steps_ahead as f64);
        
        Ok(PerformanceForecast {
            task_type: task_type.clone(),
            steps_ahead,
            predicted_quality: predicted_quality.max(0.0).min(1.0),
            predicted_execution_time: predicted_execution_time.max(0.0),
            confidence: trend.confidence * 0.8, // Reduce confidence for predictions
        })
    }
    
    // Private helper methods
    
    fn calculate_linear_trend(&self, x: &[f64], y: &[f64]) -> Result<f64> {
        if x.len() != y.len() || x.len() < 2 {
            return Ok(0.0);
        }
        
        let n = x.len() as f64;
        let sum_x: f64 = x.iter().sum();
        let sum_y: f64 = y.iter().sum();
        let sum_xy: f64 = x.iter().zip(y.iter()).map(|(xi, yi)| xi * yi).sum();
        let sum_x2: f64 = x.iter().map(|xi| xi * xi).sum();
        
        let denominator = n * sum_x2 - sum_x * sum_x;
        if denominator.abs() < 1e-10 {
            return Ok(0.0);
        }
        
        let slope = (n * sum_xy - sum_x * sum_y) / denominator;
        Ok(slope)
    }
    
    fn calculate_volatility(&self, values: &VecDeque<f64>) -> f64 {
        if values.len() < 2 {
            return 0.0;
        }
        
        let mean: f64 = values.iter().sum::<f64>() / values.len() as f64;
        let variance: f64 = values.iter()
            .map(|v| (v - mean).powi(2))
            .sum::<f64>() / values.len() as f64;
            
        variance.sqrt()
    }
    
    fn calculate_volatility_vec(&self, values: &[f64]) -> f64 {
        if values.len() < 2 {
            return 0.0;
        }
        
        let mean: f64 = values.iter().sum::<f64>() / values.len() as f64;
        let variance: f64 = values.iter()
            .map(|v| (v - mean).powi(2))
            .sum::<f64>() / values.len() as f64;
            
        variance.sqrt()
    }
    
    fn calculate_trend_confidence(&self, data_points: usize) -> f64 {
        // Confidence increases with more data points
        let base_confidence = 1.0 - (-0.1 * data_points as f64).exp();
        base_confidence.min(0.95).max(0.1)
    }
    
    fn analyze_recent_trend(&self, data: &TimeSeriesData) -> Result<TrendResult> {
        let window_size = (data.timestamps.len() / 3).max(5); // Recent third or minimum 5
        let recent_start = data.timestamps.len().saturating_sub(window_size);
        
        let recent_times: Vec<f64> = (recent_start..data.timestamps.len()).map(|i| i as f64).collect();
        let recent_quality: Vec<f64> = data.quality_scores.iter()
            .skip(recent_start)
            .copied()
            .collect();
        let recent_execution: Vec<f64> = data.execution_times.iter()
            .skip(recent_start)
            .copied()
            .collect();
        
        let quality_trend = self.calculate_linear_trend(&recent_times, &recent_quality)?;
        let execution_time_trend = self.calculate_linear_trend(&recent_times, &recent_execution)?;
        
        Ok(TrendResult {
            execution_time_trend,
            quality_trend,
            efficiency_trend: 0.0, // Not needed for comparison
            volatility: self.calculate_volatility_vec(&recent_quality),
            confidence: self.calculate_trend_confidence(window_size),
        })
    }
    
    fn analyze_historical_trend(&self, data: &TimeSeriesData) -> Result<TrendResult> {
        let window_size = (data.timestamps.len() / 3).max(5); // Historical third
        
        let historical_times: Vec<f64> = (0..window_size).map(|i| i as f64).collect();
        let historical_quality: Vec<f64> = data.quality_scores.iter()
            .take(window_size)
            .copied()
            .collect();
        let historical_execution: Vec<f64> = data.execution_times.iter()
            .take(window_size)
            .copied()
            .collect();
        
        let quality_trend = self.calculate_linear_trend(&historical_times, &historical_quality)?;
        let execution_time_trend = self.calculate_linear_trend(&historical_times, &historical_execution)?;
        
        Ok(TrendResult {
            execution_time_trend,
            quality_trend,
            efficiency_trend: 0.0,
            volatility: self.calculate_volatility_vec(&historical_quality),
            confidence: self.calculate_trend_confidence(window_size),
        })
    }
}

#[derive(Clone, Debug)]
pub struct TrendAlert {
    pub task_type: TaskType,
    pub alert_type: TrendAlertType,
    pub severity: AlertSeverity,
    pub message: String,
    pub confidence: f64,
}

#[derive(Clone, Debug)]
pub enum TrendAlertType {
    QualityChange,
    PerformanceChange,
    EfficiencyChange,
    VolatilitySpike,
}

#[derive(Clone, Debug)]
pub enum AlertSeverity {
    Low,
    Medium,
    High,
}

#[derive(Clone, Debug)]
pub struct PerformanceForecast {
    pub task_type: TaskType,
    pub steps_ahead: usize,
    pub predicted_quality: f64,
    pub predicted_execution_time: f64,
    pub confidence: f64,
}