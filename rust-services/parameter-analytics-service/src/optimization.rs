//! ML-based parameter optimization and insight generation
//! 
//! Provides intelligent recommendations for parameter tuning based on historical performance

use crate::types::*;
use crate::error::{AnalyticsError, Result};
use std::collections::{HashMap, VecDeque};
use smartcore::linear::linear_regression::LinearRegression as SmartLinearRegression;
use smartcore::linalg::basic::matrix::DenseMatrix;
use tracing::{debug, info, warn};
use chrono::Utc;

/// ML-based optimization engine for parameter recommendations
pub struct OptimizationEngine {
    /// Trained models for each task type
    models: HashMap<TaskType, OptimizationModel>,
    /// Recent insights cache
    recent_insights: VecDeque<OptimizationInsight>,
    /// Configuration
    min_sample_size: usize,
    max_insights_cache: usize,
}

#[derive(Debug)]
struct OptimizationModel {
    /// Linear regression model for quality prediction
    quality_model: Option<SmartLinearRegression<f64, f64, DenseMatrix<f64>, Vec<f64>>>,
    /// Linear regression model for execution time prediction  
    performance_model: Option<SmartLinearRegression<f64, f64, DenseMatrix<f64>, Vec<f64>>>,
    /// Training data size
    training_samples: usize,
    /// Model accuracy metrics
    quality_r2: f64,
    performance_r2: f64,
    /// Last training timestamp
    last_trained: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone, Debug)]
pub struct ParameterRecommendation {
    pub task_type: TaskType,
    pub recommended_parameters: TaskParameters,
    pub expected_improvement: f64,
    pub confidence: f64,
    pub explanation: String,
}

#[derive(Clone, Debug)]
pub struct OptimizationResult {
    pub original_quality: f64,
    pub optimized_quality: f64,
    pub improvement_percent: f64,
    pub recommended_changes: Vec<ParameterChange>,
}

#[derive(Clone, Debug)]
pub struct ParameterChange {
    pub parameter_name: String,
    pub current_value: f64,
    pub recommended_value: f64,
    pub impact_score: f64,
}

impl OptimizationEngine {
    /// Create a new optimization engine
    pub fn new() -> Self {
        Self {
            models: HashMap::new(),
            recent_insights: VecDeque::new(),
            min_sample_size: 20, // Need at least 20 samples to train models
            max_insights_cache: 100,
        }
    }
    
    /// Generate optimization insights based on effectiveness data
    pub fn generate_insights(
        &mut self,
        effectiveness_data: &[ParameterEffectiveness],
        task_type: &TaskType,
    ) -> Result<Vec<OptimizationInsight>> {
        if effectiveness_data.len() < self.min_sample_size {
            return Ok(vec![]);
        }
        
        debug!("Generating insights for {:?} with {} data points", task_type, effectiveness_data.len());
        
        let mut insights = Vec::new();
        
        // Train or update model for this task type
        if let Err(e) = self.update_model(task_type, effectiveness_data) {
            warn!("Failed to update model for {:?}: {}", task_type, e);
            return self.generate_rule_based_insights(effectiveness_data, task_type);
        }
        
        // Generate ML-based insights
        if let Some(model) = self.models.get(task_type) {
            insights.extend(self.generate_ml_insights(effectiveness_data, task_type, model)?);
        }
        
        // Generate statistical insights
        insights.extend(self.generate_statistical_insights(effectiveness_data, task_type)?);
        
        // Generate comparative insights
        insights.extend(self.generate_comparative_insights(effectiveness_data, task_type)?);
        
        // Cache insights
        for insight in &insights {
            self.recent_insights.push_back(insight.clone());
            while self.recent_insights.len() > self.max_insights_cache {
                self.recent_insights.pop_front();
            }
        }
        
        info!("Generated {} insights for {:?}", insights.len(), task_type);
        Ok(insights)
    }
    
    /// Get parameter recommendations for a task type
    pub fn get_parameter_recommendations(
        &self,
        task_type: &TaskType,
        current_parameters: &TaskParameters,
    ) -> Result<Vec<ParameterRecommendation>> {
        let model = self.models.get(task_type)
            .ok_or_else(|| AnalyticsError::computation("No model available for task type"))?;
            
        if model.quality_model.is_none() {
            return Err(AnalyticsError::computation("Quality model not trained"));
        }
        
        let mut recommendations = Vec::new();
        
        // Generate recommendations by varying parameters
        let variations = self.generate_parameter_variations(current_parameters);
        
        for (variation_name, varied_params) in variations {
            if let Ok(predicted_quality) = self.predict_quality(task_type, &varied_params) {
                let current_quality = self.predict_quality(task_type, current_parameters)
                    .unwrap_or(0.5);
                
                if predicted_quality > current_quality {
                    let improvement = predicted_quality - current_quality;
                    let confidence = model.quality_r2.min(0.95).max(0.1);
                    
                    recommendations.push(ParameterRecommendation {
                        task_type: task_type.clone(),
                        recommended_parameters: varied_params,
                        expected_improvement: improvement,
                        confidence,
                        explanation: format!(
                            "Adjusting {} could improve quality by {:.1}%",
                            variation_name,
                            improvement * 100.0
                        ),
                    });
                }
            }
        }
        
        // Sort by expected improvement
        recommendations.sort_by(|a, b| b.expected_improvement.partial_cmp(&a.expected_improvement).unwrap_or(std::cmp::Ordering::Equal));
        recommendations.truncate(5); // Return top 5 recommendations
        
        Ok(recommendations)
    }
    
    /// Optimize parameters for specific goals
    pub fn optimize_parameters(
        &self,
        task_type: &TaskType,
        current_parameters: &TaskParameters,
        optimization_goals: &OptimizationGoals,
    ) -> Result<OptimizationResult> {
        let _model = self.models.get(task_type)
            .ok_or_else(|| AnalyticsError::computation("No model available"))?;
            
        let current_quality = self.predict_quality(task_type, current_parameters)?;
        
        // Use gradient-free optimization to find better parameters
        let optimized_params = self.search_optimal_parameters(
            task_type,
            current_parameters,
            optimization_goals,
        )?;
        
        let optimized_quality = self.predict_quality(task_type, &optimized_params)?;
        let improvement_percent = ((optimized_quality - current_quality) / current_quality) * 100.0;
        
        let parameter_changes = self.identify_parameter_changes(current_parameters, &optimized_params);
        
        Ok(OptimizationResult {
            original_quality: current_quality,
            optimized_quality,
            improvement_percent,
            recommended_changes: parameter_changes,
        })
    }
    
    /// Get recent insights
    pub fn get_recent_insights(&self) -> Vec<OptimizationInsight> {
        self.recent_insights.iter().cloned().collect()
    }
    
    /// Get model statistics
    pub fn get_model_stats(&self) -> HashMap<TaskType, ModelStats> {
        self.models.iter()
            .map(|(task_type, model)| {
                let stats = ModelStats {
                    training_samples: model.training_samples,
                    quality_accuracy: model.quality_r2,
                    performance_accuracy: model.performance_r2,
                    last_trained: model.last_trained,
                };
                (task_type.clone(), stats)
            })
            .collect()
    }
    
    // Private implementation methods
    
    fn update_model(&mut self, task_type: &TaskType, data: &[ParameterEffectiveness]) -> Result<()> {
        debug!("Training model for {:?} with {} samples", task_type, data.len());
        
        // Extract features and targets
        let (features, quality_targets, performance_targets) = self.extract_training_data(data)?;
        
        if features.is_empty() {
            return Err(AnalyticsError::computation("No training features available"));
        }
        
        // Train quality model
        let quality_model = self.train_regression_model(&features, &quality_targets)?;
        let quality_r2 = self.calculate_r2(&features, &quality_targets, &quality_model);
        
        // Train performance model  
        let performance_model = self.train_regression_model(&features, &performance_targets)?;
        let performance_r2 = self.calculate_r2(&features, &performance_targets, &performance_model);
        
        // Update model
        let model = OptimizationModel {
            quality_model: Some(quality_model),
            performance_model: Some(performance_model),
            training_samples: data.len(),
            quality_r2,
            performance_r2,
            last_trained: Utc::now(),
        };
        
        self.models.insert(task_type.clone(), model);
        
        info!("Updated model for {:?}: Quality R² = {:.3}, Performance R² = {:.3}", 
              task_type, quality_r2, performance_r2);
              
        Ok(())
    }
    
    fn extract_training_data(&self, data: &[ParameterEffectiveness]) -> Result<(Vec<Vec<f64>>, Vec<f64>, Vec<f64>)> {
        let mut features = Vec::new();
        let mut quality_targets = Vec::new();
        let mut performance_targets = Vec::new();
        
        for effectiveness in data {
            // Extract features from parameters
            let feature_vec = vec![
                effectiveness.parameters.context_length as f64,
                effectiveness.parameters.temperature,
                effectiveness.parameters.max_tokens as f64,
                effectiveness.parameters.top_p.unwrap_or(0.9),
                effectiveness.parameters.presence_penalty.unwrap_or(0.0),
                effectiveness.parameters.frequency_penalty.unwrap_or(0.0),
            ];
            
            features.push(feature_vec);
            quality_targets.push(effectiveness.avg_response_quality);
            performance_targets.push(effectiveness.avg_execution_time);
        }
        
        if features.is_empty() {
            return Err(AnalyticsError::computation("No features extracted"));
        }
        
        Ok((features, quality_targets, performance_targets))
    }
    
    fn train_regression_model(&self, features: &[Vec<f64>], targets: &[f64]) -> Result<SmartLinearRegression<f64, f64, DenseMatrix<f64>, Vec<f64>>> {
        if features.len() != targets.len() || features.is_empty() {
            return Err(AnalyticsError::computation("Invalid training data dimensions"));
        }
        
        let feature_dim = features[0].len();
        let n_samples = features.len();
        
        // Convert to SmartCore matrix format
        let mut feature_matrix = vec![0.0; n_samples * feature_dim];
        for (i, feature_vec) in features.iter().enumerate() {
            for (j, &value) in feature_vec.iter().enumerate() {
                feature_matrix[i * feature_dim + j] = value;
            }
        }
        
        let x = DenseMatrix::new(n_samples, feature_dim, feature_matrix, false);
        let y = targets.to_vec();
        
        // Train model with default parameters
        let model = SmartLinearRegression::fit(&x, &y, Default::default())
            .map_err(|e| AnalyticsError::computation(format!("Model training failed: {}", e)))?;
            
        Ok(model)
    }
    
    fn calculate_r2(&self, features: &[Vec<f64>], targets: &[f64], model: &SmartLinearRegression<f64, f64, DenseMatrix<f64>, Vec<f64>>) -> f64 {
        if features.len() != targets.len() || features.is_empty() {
            return 0.0;
        }
        
        // Make predictions
        let predictions = self.predict_with_model(features, model).unwrap_or_default();
        
        if predictions.len() != targets.len() {
            return 0.0;
        }
        
        // Calculate R²
        let mean_target = targets.iter().sum::<f64>() / targets.len() as f64;
        
        let ss_tot: f64 = targets.iter()
            .map(|&y| (y - mean_target).powi(2))
            .sum();
            
        let ss_res: f64 = targets.iter()
            .zip(predictions.iter())
            .map(|(&y_true, &y_pred)| (y_true - y_pred).powi(2))
            .sum();
            
        if ss_tot == 0.0 {
            return 0.0;
        }
        
        1.0 - (ss_res / ss_tot)
    }
    
    fn predict_with_model(&self, features: &[Vec<f64>], model: &SmartLinearRegression<f64, f64, DenseMatrix<f64>, Vec<f64>>) -> Result<Vec<f64>> {
        if features.is_empty() {
            return Ok(vec![]);
        }
        
        let feature_dim = features[0].len();
        let n_samples = features.len();
        
        let mut feature_matrix = vec![0.0; n_samples * feature_dim];
        for (i, feature_vec) in features.iter().enumerate() {
            for (j, &value) in feature_vec.iter().enumerate() {
                feature_matrix[i * feature_dim + j] = value;
            }
        }
        
        let x = DenseMatrix::new(n_samples, feature_dim, feature_matrix, false);
        
        let predictions = model.predict(&x)
            .map_err(|e| AnalyticsError::computation(format!("Prediction failed: {}", e)))?;
            
        Ok(predictions)
    }
    
    fn predict_quality(&self, task_type: &TaskType, parameters: &TaskParameters) -> Result<f64> {
        let model = self.models.get(task_type)
            .ok_or_else(|| AnalyticsError::computation("No model available"))?;
            
        let quality_model = model.quality_model.as_ref()
            .ok_or_else(|| AnalyticsError::computation("Quality model not available"))?;
        
        let features = vec![vec![
            parameters.context_length as f64,
            parameters.temperature,
            parameters.max_tokens as f64,
            parameters.top_p.unwrap_or(0.9),
            parameters.presence_penalty.unwrap_or(0.0),
            parameters.frequency_penalty.unwrap_or(0.0),
        ]];
        
        let predictions = self.predict_with_model(&features, quality_model)?;
        Ok(predictions.get(0).copied().unwrap_or(0.5))
    }
    
    fn generate_parameter_variations(&self, base_params: &TaskParameters) -> Vec<(String, TaskParameters)> {
        let mut variations = Vec::new();
        
        // Temperature variations
        for &temp_adj in &[-0.2, -0.1, 0.1, 0.2] {
            let new_temp = (base_params.temperature + temp_adj).max(0.1).min(2.0);
            if new_temp != base_params.temperature {
                let mut varied = base_params.clone();
                varied.temperature = new_temp;
                variations.push((format!("temperature_{:+.1}", temp_adj), varied));
            }
        }
        
        // Context length variations
        for &length_mult in &[0.8, 1.2, 1.5] {
            let new_length = ((base_params.context_length as f64 * length_mult) as u32).max(512).min(32768);
            if new_length != base_params.context_length {
                let mut varied = base_params.clone();
                varied.context_length = new_length;
                variations.push((format!("context_length_x{:.1}", length_mult), varied));
            }
        }
        
        // Max tokens variations
        for &token_mult in &[0.7, 1.3, 1.6] {
            let new_tokens = ((base_params.max_tokens as f64 * token_mult) as u32).max(256).min(8192);
            if new_tokens != base_params.max_tokens {
                let mut varied = base_params.clone();
                varied.max_tokens = new_tokens;
                variations.push((format!("max_tokens_x{:.1}", token_mult), varied));
            }
        }
        
        variations
    }
    
    fn generate_ml_insights(&self, _data: &[ParameterEffectiveness], task_type: &TaskType, model: &OptimizationModel) -> Result<Vec<OptimizationInsight>> {
        let mut insights = Vec::new();
        
        // Model accuracy insights
        if model.quality_r2 > 0.8 {
            insights.push(OptimizationInsight {
                task_type: task_type.clone(),
                insight: format!("High-confidence ML model available (R² = {:.3})", model.quality_r2),
                recommendation: "Parameter optimization recommendations are highly reliable".to_string(),
                impact: InsightImpact::Medium,
                confidence: model.quality_r2,
                supporting_data: SupportingData {
                    sample_size: model.training_samples as u64,
                    improvement_percent: 0.0,
                    current_metric: model.quality_r2,
                    optimized_metric: model.quality_r2,
                },
            });
        } else if model.quality_r2 > 0.5 {
            insights.push(OptimizationInsight {
                task_type: task_type.clone(),
                insight: format!("Moderate ML model accuracy (R² = {:.3})", model.quality_r2),
                recommendation: "Consider collecting more data to improve model accuracy".to_string(),
                impact: InsightImpact::Low,
                confidence: model.quality_r2,
                supporting_data: SupportingData {
                    sample_size: model.training_samples as u64,
                    improvement_percent: 0.0,
                    current_metric: model.quality_r2,
                    optimized_metric: 1.0,
                },
            });
        }
        
        Ok(insights)
    }
    
    fn generate_statistical_insights(&self, data: &[ParameterEffectiveness], task_type: &TaskType) -> Result<Vec<OptimizationInsight>> {
        let mut insights = Vec::new();
        
        // Find best performing parameter set
        if let Some(best) = data.iter().max_by(|a, b| a.avg_response_quality.partial_cmp(&b.avg_response_quality).unwrap_or(std::cmp::Ordering::Equal)) {
            if best.avg_response_quality > 0.8 && best.total_executions >= 10 {
                insights.push(OptimizationInsight {
                    task_type: task_type.clone(),
                    insight: format!("High-performing parameter set identified (quality: {:.2})", best.avg_response_quality),
                    recommendation: "Consider using similar parameter configuration for optimal results".to_string(),
                    impact: InsightImpact::High,
                    confidence: best.confidence_score,
                    supporting_data: SupportingData {
                        sample_size: best.total_executions,
                        improvement_percent: (best.avg_response_quality - 0.5) * 100.0,
                        current_metric: 0.5,
                        optimized_metric: best.avg_response_quality,
                    },
                });
            }
        }
        
        Ok(insights)
    }
    
    fn generate_comparative_insights(&self, data: &[ParameterEffectiveness], task_type: &TaskType) -> Result<Vec<OptimizationInsight>> {
        let mut insights = Vec::new();
        
        if data.len() < 2 {
            return Ok(insights);
        }
        
        // Compare temperature ranges
        let low_temp: Vec<_> = data.iter().filter(|d| d.parameters.temperature <= 0.3).collect();
        let high_temp: Vec<_> = data.iter().filter(|d| d.parameters.temperature >= 0.7).collect();
        
        if !low_temp.is_empty() && !high_temp.is_empty() {
            let low_avg = low_temp.iter().map(|d| d.avg_response_quality).sum::<f64>() / low_temp.len() as f64;
            let high_avg = high_temp.iter().map(|d| d.avg_response_quality).sum::<f64>() / high_temp.len() as f64;
            
            if (low_avg - high_avg).abs() > 0.1 {
                let better = if low_avg > high_avg { "lower" } else { "higher" };
                let improvement = ((low_avg.max(high_avg) - low_avg.min(high_avg)) / low_avg.min(high_avg)) * 100.0;
                
                insights.push(OptimizationInsight {
                    task_type: task_type.clone(),
                    insight: format!("{} temperature settings show better performance", better),
                    recommendation: format!("Consider using {} temperature values for improved quality", better),
                    impact: if improvement > 20.0 { InsightImpact::High } else { InsightImpact::Medium },
                    confidence: 0.7,
                    supporting_data: SupportingData {
                        sample_size: (low_temp.len() + high_temp.len()) as u64,
                        improvement_percent: improvement,
                        current_metric: low_avg.min(high_avg),
                        optimized_metric: low_avg.max(high_avg),
                    },
                });
            }
        }
        
        Ok(insights)
    }
    
    fn generate_rule_based_insights(&self, data: &[ParameterEffectiveness], task_type: &TaskType) -> Result<Vec<OptimizationInsight>> {
        // Fallback to statistical insights when ML models aren't available
        self.generate_statistical_insights(data, task_type)
    }
    
    fn search_optimal_parameters(
        &self,
        task_type: &TaskType,
        current_params: &TaskParameters,
        _goals: &OptimizationGoals,
    ) -> Result<TaskParameters> {
        // Simple grid search optimization
        // In a production system, you might use more sophisticated optimization algorithms
        
        let variations = self.generate_parameter_variations(current_params);
        let mut best_params = current_params.clone();
        let mut best_quality = self.predict_quality(task_type, current_params)?;
        
        for (_, params) in variations {
            if let Ok(quality) = self.predict_quality(task_type, &params) {
                if quality > best_quality {
                    best_quality = quality;
                    best_params = params;
                }
            }
        }
        
        Ok(best_params)
    }
    
    fn identify_parameter_changes(&self, original: &TaskParameters, optimized: &TaskParameters) -> Vec<ParameterChange> {
        let mut changes = Vec::new();
        
        if original.temperature != optimized.temperature {
            changes.push(ParameterChange {
                parameter_name: "temperature".to_string(),
                current_value: original.temperature,
                recommended_value: optimized.temperature,
                impact_score: (original.temperature - optimized.temperature).abs(),
            });
        }
        
        if original.context_length != optimized.context_length {
            changes.push(ParameterChange {
                parameter_name: "context_length".to_string(),
                current_value: original.context_length as f64,
                recommended_value: optimized.context_length as f64,
                impact_score: ((original.context_length as f64 - optimized.context_length as f64) / original.context_length as f64).abs(),
            });
        }
        
        if original.max_tokens != optimized.max_tokens {
            changes.push(ParameterChange {
                parameter_name: "max_tokens".to_string(),
                current_value: original.max_tokens as f64,
                recommended_value: optimized.max_tokens as f64,
                impact_score: ((original.max_tokens as f64 - optimized.max_tokens as f64) / original.max_tokens as f64).abs(),
            });
        }
        
        changes
    }
}

#[derive(Clone, Debug)]
pub struct OptimizationGoals {
    pub optimize_for_quality: bool,
    pub optimize_for_speed: bool,
    pub optimize_for_cost: bool,
    pub quality_weight: f64,
    pub speed_weight: f64,
    pub cost_weight: f64,
}

#[derive(Clone, Debug)]
pub struct ModelStats {
    pub training_samples: usize,
    pub quality_accuracy: f64,
    pub performance_accuracy: f64,
    pub last_trained: chrono::DateTime<chrono::Utc>,
}

impl Default for OptimizationGoals {
    fn default() -> Self {
        Self {
            optimize_for_quality: true,
            optimize_for_speed: false,
            optimize_for_cost: false,
            quality_weight: 0.7,
            speed_weight: 0.2,
            cost_weight: 0.1,
        }
    }
}