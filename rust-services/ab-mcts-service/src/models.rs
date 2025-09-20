//! Bayesian models for AB-MCTS learning and prediction
//! 
//! Provides statistical models for agent performance prediction, reward estimation,
//! and continuous learning from execution results.

use crate::error::{MCTSError, MCTSResult};
use crate::types::{AgentType, MCTSReward, RewardComponents};
use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, trace, warn};

/// Bayesian linear regression model for reward prediction
#[derive(Clone, Debug)]
pub struct BayesianRewardModel {
    /// Model parameters (weights)
    pub weights: DVector<f64>,
    /// Covariance matrix of parameters
    pub covariance: DMatrix<f64>,
    /// Noise precision (inverse variance)
    pub noise_precision: f64,
    /// Prior precision for regularization
    pub prior_precision: f64,
    /// Number of observations used to train the model
    pub n_observations: usize,
    /// Feature names for interpretability
    pub feature_names: Vec<String>,
    /// Model performance metrics
    pub performance: ModelPerformance,
}

/// Performance metrics for a Bayesian model
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelPerformance {
    pub mse: f64,                    // Mean squared error
    pub mae: f64,                    // Mean absolute error
    pub r_squared: f64,              // R-squared coefficient
    pub log_likelihood: f64,         // Log likelihood of the model
    pub aic: f64,                    // Akaike Information Criterion
    pub bic: f64,                    // Bayesian Information Criterion
    pub predictive_accuracy: f64,    // Cross-validation accuracy
}

impl Default for ModelPerformance {
    fn default() -> Self {
        Self {
            mse: f64::INFINITY,
            mae: f64::INFINITY,
            r_squared: 0.0,
            log_likelihood: f64::NEG_INFINITY,
            aic: f64::INFINITY,
            bic: f64::INFINITY,
            predictive_accuracy: 0.0,
        }
    }
}

impl BayesianRewardModel {
    /// Create a new Bayesian reward model
    pub fn new(n_features: usize, prior_precision: f64, noise_precision: f64) -> MCTSResult<Self> {
        if n_features == 0 {
            return Err(MCTSError::bayesian_error("Number of features must be positive"));
        }
        
        if prior_precision <= 0.0 || noise_precision <= 0.0 {
            return Err(MCTSError::bayesian_error(
                "Prior and noise precision must be positive"
            ));
        }
        
        // Initialize with zero weights and prior covariance
        let weights = DVector::zeros(n_features);
        let covariance = DMatrix::identity(n_features, n_features) / prior_precision;
        
        // Default feature names
        let feature_names = (0..n_features)
            .map(|i| format!("feature_{}", i))
            .collect();
        
        Ok(Self {
            weights,
            covariance,
            noise_precision,
            prior_precision,
            n_observations: 0,
            feature_names,
            performance: ModelPerformance::default(),
        })
    }
    
    /// Create model with named features
    pub fn new_with_features(
        feature_names: Vec<String>,
        prior_precision: f64,
        noise_precision: f64,
    ) -> MCTSResult<Self> {
        let mut model = Self::new(feature_names.len(), prior_precision, noise_precision)?;
        model.feature_names = feature_names;
        Ok(model)
    }
    
    /// Update model with new observation (online Bayesian learning)
    pub fn update(&mut self, features: &DVector<f64>, target: f64) -> MCTSResult<()> {
        if features.len() != self.weights.len() {
            return Err(MCTSError::bayesian_error(
                format!("Feature vector length {} doesn't match model dimension {}", 
                        features.len(), self.weights.len())
            ));
        }
        
        // Bayesian linear regression update using Sherman-Morrison formula
        // for efficient online learning
        
        // Compute prediction and error
        let prediction = features.dot(&self.weights);
        let error = target - prediction;
        
        trace!("Bayesian update: prediction={:.4}, target={:.4}, error={:.4}", 
               prediction, target, error);
        
        // Update covariance matrix: S^{-1} = S^{-1} + β * x * x^T
        let s_x = &self.covariance * features;
        let x_s_x = features.dot(&s_x);
        let denominator = 1.0 + self.noise_precision * x_s_x;
        
        if denominator.abs() < 1e-12 {
            warn!("Near-singular update in Bayesian model, skipping");
            return Ok(());
        }
        
        // Sherman-Morrison formula for covariance update
        let outer_product = &s_x * s_x.transpose() * (self.noise_precision / denominator);
        self.covariance = &self.covariance - outer_product;
        
        // Update weights: μ = S * (S_0^{-1} * μ_0 + β * X^T * y)
        let weight_update = &self.covariance * features * (self.noise_precision * error);
        self.weights += weight_update;
        
        self.n_observations += 1;
        
        // Update performance metrics periodically
        if self.n_observations % 10 == 0 {
            self.update_performance_metrics();
        }
        
        debug!("Updated Bayesian model: {} observations, MSE={:.4}", 
               self.n_observations, self.performance.mse);
        
        Ok(())
    }
    
    /// Make prediction with uncertainty quantification
    pub fn predict(&self, features: &DVector<f64>) -> MCTSResult<PredictionResult> {
        if features.len() != self.weights.len() {
            return Err(MCTSError::bayesian_error(
                "Feature vector length doesn't match model dimension"
            ));
        }
        
        // Mean prediction
        let mean = features.dot(&self.weights);
        
        // Predictive variance: σ² = 1/β + x^T * S * x
        let predictive_variance = 1.0 / self.noise_precision + 
            features.dot(&(&self.covariance * features));
        
        let std_dev = predictive_variance.sqrt();
        
        // 95% credible interval
        let margin = 1.96 * std_dev;
        let lower_bound = mean - margin;
        let upper_bound = mean + margin;
        
        trace!("Bayesian prediction: mean={:.4}, std={:.4}, interval=[{:.4}, {:.4}]",
               mean, std_dev, lower_bound, upper_bound);
        
        Ok(PredictionResult {
            mean,
            variance: predictive_variance,
            std_dev,
            credible_interval: (lower_bound, upper_bound),
            confidence: self.calculate_confidence(std_dev),
        })
    }
    
    /// Batch prediction for multiple feature vectors
    pub fn predict_batch(&self, features: &DMatrix<f64>) -> MCTSResult<Vec<PredictionResult>> {
        let mut results = Vec::new();
        
        for i in 0..features.nrows() {
            let feature_vector = features.row(i).transpose();
            results.push(self.predict(&feature_vector)?);
        }
        
        Ok(results)
    }
    
    /// Calculate feature importance based on weight magnitudes and uncertainties
    pub fn feature_importance(&self) -> Vec<FeatureImportance> {
        let mut importance = Vec::new();
        
        for (i, &weight) in self.weights.iter().enumerate() {
            let variance = self.covariance[(i, i)];
            let std_dev = variance.sqrt();
            
            // Importance based on |weight| / std_dev (signal-to-noise ratio)
            let importance_score = if std_dev > 1e-12 {
                weight.abs() / std_dev
            } else {
                weight.abs()
            };
            
            importance.push(FeatureImportance {
                feature_name: self.feature_names.get(i)
                    .cloned()
                    .unwrap_or_else(|| format!("feature_{}", i)),
                weight,
                std_dev,
                importance_score,
                confidence: self.calculate_confidence(std_dev),
            });
        }
        
        // Sort by importance score (descending)
        importance.sort_by(|a, b| {
            b.importance_score.partial_cmp(&a.importance_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        
        importance
    }
    
    /// Get model summary statistics
    pub fn summary(&self) -> ModelSummary {
        ModelSummary {
            n_features: self.weights.len(),
            n_observations: self.n_observations,
            prior_precision: self.prior_precision,
            noise_precision: self.noise_precision,
            weights: self.weights.clone(),
            weight_uncertainties: self.covariance.diagonal().map(|x| x.sqrt()),
            performance: self.performance.clone(),
            feature_names: self.feature_names.clone(),
        }
    }
    
    /// Reset model to initial state
    pub fn reset(&mut self) {
        let n_features = self.weights.len();
        self.weights = DVector::zeros(n_features);
        self.covariance = DMatrix::identity(n_features, n_features) / self.prior_precision;
        self.n_observations = 0;
        self.performance = ModelPerformance::default();
        debug!("Reset Bayesian model to initial state");
    }
    
    /// Private helper to calculate confidence from standard deviation
    fn calculate_confidence(&self, std_dev: f64) -> f64 {
        // Convert standard deviation to confidence score (0-1 scale)
        // Lower std_dev = higher confidence
        (-std_dev).exp()
    }
    
    /// Private helper to update performance metrics
    fn update_performance_metrics(&mut self) {
        // This is a placeholder - in practice, you'd maintain a validation set
        // and compute these metrics properly
        if self.n_observations > 0 {
            self.performance.predictive_accuracy = 
                (self.n_observations as f64 / (self.n_observations as f64 + 10.0)).min(1.0);
        }
    }
}

/// Result of a Bayesian prediction
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PredictionResult {
    pub mean: f64,
    pub variance: f64,
    pub std_dev: f64,
    pub credible_interval: (f64, f64),
    pub confidence: f64, // 0-1 scale
}

/// Feature importance information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FeatureImportance {
    pub feature_name: String,
    pub weight: f64,
    pub std_dev: f64,
    pub importance_score: f64,
    pub confidence: f64,
}

/// Model summary information
#[derive(Clone, Debug)]
pub struct ModelSummary {
    pub n_features: usize,
    pub n_observations: usize,
    pub prior_precision: f64,
    pub noise_precision: f64,
    pub weights: DVector<f64>,
    pub weight_uncertainties: DVector<f64>,
    pub performance: ModelPerformance,
    pub feature_names: Vec<String>,
}

/// Multi-objective Bayesian optimizer for agent performance
#[derive(Clone, Debug)]
pub struct AgentPerformanceModel {
    /// Individual models for each reward component
    pub quality_model: BayesianRewardModel,
    pub speed_model: BayesianRewardModel,
    pub cost_model: BayesianRewardModel,
    
    /// Weights for combining different objectives
    pub objective_weights: RewardComponents,
    
    /// Agent-specific models
    pub agent_models: HashMap<String, BayesianRewardModel>,
    
    /// Feature extractors for different agent types
    pub feature_extractors: HashMap<AgentType, Vec<String>>,
}

impl AgentPerformanceModel {
    /// Create a new agent performance model
    pub fn new() -> MCTSResult<Self> {
        let feature_names = vec![
            "agent_experience".to_string(),
            "task_complexity".to_string(),
            "context_similarity".to_string(),
            "recent_performance".to_string(),
            "resource_availability".to_string(),
            "time_pressure".to_string(),
        ];
        
        let quality_model = BayesianRewardModel::new_with_features(
            feature_names.clone(), 0.1, 1.0)?;
        let speed_model = BayesianRewardModel::new_with_features(
            feature_names.clone(), 0.1, 1.0)?;
        let cost_model = BayesianRewardModel::new_with_features(
            feature_names, 0.1, 1.0)?;
        
        Ok(Self {
            quality_model,
            speed_model,
            cost_model,
            objective_weights: RewardComponents {
                quality: 0.4,
                speed: 0.3,
                cost: 0.3,
                user_satisfaction: None,
            },
            agent_models: HashMap::new(),
            feature_extractors: Self::default_feature_extractors(),
        })
    }
    
    /// Update models with new reward observation
    pub fn update_with_reward(
        &mut self,
        agent_name: &str,
        features: &DVector<f64>,
        reward: &MCTSReward,
    ) -> MCTSResult<()> {
        // Update component models
        self.quality_model.update(features, reward.components.quality)?;
        self.speed_model.update(features, reward.components.speed)?;
        self.cost_model.update(features, reward.components.cost)?;
        
        // Update agent-specific model
        if !self.agent_models.contains_key(agent_name) {
            let agent_model = BayesianRewardModel::new(features.len(), 0.1, 1.0)?;
            self.agent_models.insert(agent_name.to_string(), agent_model);
        }
        
        if let Some(agent_model) = self.agent_models.get_mut(agent_name) {
            agent_model.update(features, reward.value)?;
        }
        
        debug!("Updated performance model for agent '{}'", agent_name);
        Ok(())
    }
    
    /// Predict agent performance with uncertainty
    pub fn predict_performance(
        &self,
        agent_name: &str,
        features: &DVector<f64>,
    ) -> MCTSResult<PerformancePrediction> {
        // Get component predictions
        let quality_pred = self.quality_model.predict(features)?;
        let speed_pred = self.speed_model.predict(features)?;
        let cost_pred = self.cost_model.predict(features)?;
        
        // Get agent-specific prediction if available
        let agent_pred = if let Some(agent_model) = self.agent_models.get(agent_name) {
            Some(agent_model.predict(features)?)
        } else {
            None
        };
        
        // Combine predictions
        let overall_mean = quality_pred.mean * self.objective_weights.quality +
                          speed_pred.mean * self.objective_weights.speed +
                          cost_pred.mean * self.objective_weights.cost;
        
        let overall_variance = (quality_pred.variance * self.objective_weights.quality.powi(2)) +
                              (speed_pred.variance * self.objective_weights.speed.powi(2)) +
                              (cost_pred.variance * self.objective_weights.cost.powi(2));
        
        let overall_std = overall_variance.sqrt();
        let overall_confidence = quality_pred.confidence * speed_pred.confidence * cost_pred.confidence;
        
        Ok(PerformancePrediction {
            agent_name: agent_name.to_string(),
            overall_performance: PredictionResult {
                mean: overall_mean,
                variance: overall_variance,
                std_dev: overall_std,
                credible_interval: (overall_mean - 1.96 * overall_std, 
                                  overall_mean + 1.96 * overall_std),
                confidence: overall_confidence,
            },
            quality_prediction: quality_pred,
            speed_prediction: speed_pred,
            cost_prediction: cost_pred,
            agent_specific_prediction: agent_pred,
        })
    }
    
    /// Set objective weights for multi-objective optimization
    pub fn set_objective_weights(&mut self, weights: RewardComponents) {
        debug!("Updated objective weights: quality={:.2}, speed={:.2}, cost={:.2}",
               weights.quality, weights.speed, weights.cost);
        self.objective_weights = weights;
    }
    
    /// Get feature importance across all models
    pub fn get_global_feature_importance(&self) -> Vec<FeatureImportance> {
        let quality_importance = self.quality_model.feature_importance();
        let speed_importance = self.speed_model.feature_importance();
        let cost_importance = self.cost_model.feature_importance();
        
        let mut combined_importance = HashMap::new();
        
        // Combine importance scores weighted by objective weights
        for imp in &quality_importance {
            combined_importance.insert(imp.feature_name.clone(), 
                imp.importance_score * self.objective_weights.quality);
        }
        
        for imp in &speed_importance {
            *combined_importance.entry(imp.feature_name.clone()).or_insert(0.0) +=
                imp.importance_score * self.objective_weights.speed;
        }
        
        for imp in &cost_importance {
            *combined_importance.entry(imp.feature_name.clone()).or_insert(0.0) +=
                imp.importance_score * self.objective_weights.cost;
        }
        
        let mut result: Vec<FeatureImportance> = combined_importance
            .into_iter()
            .map(|(name, score)| FeatureImportance {
                feature_name: name,
                weight: score,
                std_dev: 0.0, // Would need to compute properly
                importance_score: score,
                confidence: 1.0,
            })
            .collect();
        
        result.sort_by(|a, b| b.importance_score.partial_cmp(&a.importance_score)
                       .unwrap_or(std::cmp::Ordering::Equal));
        
        result
    }
    
    /// Default feature extractors for different agent types
    fn default_feature_extractors() -> HashMap<AgentType, Vec<String>> {
        let mut extractors = HashMap::new();
        
        extractors.insert(AgentType::Planner, vec![
            "task_complexity".to_string(),
            "planning_horizon".to_string(),
            "resource_constraints".to_string(),
        ]);
        
        extractors.insert(AgentType::Retriever, vec![
            "query_complexity".to_string(),
            "data_source_count".to_string(),
            "information_freshness".to_string(),
        ]);
        
        extractors.insert(AgentType::Synthesizer, vec![
            "input_diversity".to_string(),
            "synthesis_complexity".to_string(),
            "coherence_requirements".to_string(),
        ]);
        
        extractors
    }
}

/// Performance prediction for an agent
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PerformancePrediction {
    pub agent_name: String,
    pub overall_performance: PredictionResult,
    pub quality_prediction: PredictionResult,
    pub speed_prediction: PredictionResult,
    pub cost_prediction: PredictionResult,
    pub agent_specific_prediction: Option<PredictionResult>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;
    
    #[test]
    fn test_bayesian_model_creation() {
        let model = BayesianRewardModel::new(3, 0.1, 1.0).unwrap();
        assert_eq!(model.weights.len(), 3);
        assert_eq!(model.covariance.nrows(), 3);
        assert_eq!(model.covariance.ncols(), 3);
        assert_eq!(model.n_observations, 0);
    }
    
    #[test]
    fn test_bayesian_model_update() {
        let mut model = BayesianRewardModel::new(2, 0.1, 1.0).unwrap();
        let features = DVector::from_vec(vec![1.0, 0.5]);
        let target = 0.8;
        
        model.update(&features, target).unwrap();
        assert_eq!(model.n_observations, 1);
        
        // Weights should have changed
        assert_ne!(model.weights[0], 0.0);
    }
    
    #[test]
    fn test_bayesian_prediction() {
        let mut model = BayesianRewardModel::new(2, 0.1, 1.0).unwrap();
        
        // Train with some data
        let features1 = DVector::from_vec(vec![1.0, 0.0]);
        let features2 = DVector::from_vec(vec![0.0, 1.0]);
        
        model.update(&features1, 0.9).unwrap();
        model.update(&features2, 0.1).unwrap();
        
        // Test prediction
        let pred = model.predict(&features1).unwrap();
        assert!(pred.mean > 0.5); // Should predict high for features1
        assert!(pred.std_dev > 0.0); // Should have some uncertainty
        
        let pred2 = model.predict(&features2).unwrap();
        assert!(pred2.mean < 0.5); // Should predict low for features2
    }
    
    #[test]
    fn test_feature_importance() {
        let mut model = BayesianRewardModel::new_with_features(
            vec!["feature_a".to_string(), "feature_b".to_string()],
            0.1, 1.0
        ).unwrap();
        
        // Train model to make feature_a more important
        for _ in 0..10 {
            let features = DVector::from_vec(vec![1.0, 0.1]);
            model.update(&features, 0.9).unwrap();
        }
        
        let importance = model.feature_importance();
        assert_eq!(importance.len(), 2);
        assert_eq!(importance[0].feature_name, "feature_a");
    }
    
    #[test]
    fn test_agent_performance_model() {
        let mut model = AgentPerformanceModel::new().unwrap();
        let features = DVector::from_vec(vec![0.5, 0.7, 0.3, 0.8, 0.6, 0.4]);
        
        let reward = MCTSReward {
            value: 0.8,
            components: RewardComponents {
                quality: 0.9,
                speed: 0.7,
                cost: 0.8,
                user_satisfaction: None,
            },
            metadata: crate::types::RewardMetadata {
                tokens_used: 100,
                api_calls_made: 2,
                execution_time: std::time::Duration::from_millis(500),
                agent_performance: HashMap::new(),
                timestamp: std::time::SystemTime::now(),
            },
        };
        
        model.update_with_reward("test_agent", &features, &reward).unwrap();
        
        let prediction = model.predict_performance("test_agent", &features).unwrap();
        assert_eq!(prediction.agent_name, "test_agent");
        assert!(prediction.overall_performance.confidence > 0.0);
    }
    
    #[test]
    fn test_model_reset() {
        let mut model = BayesianRewardModel::new(2, 0.1, 1.0).unwrap();
        let features = DVector::from_vec(vec![1.0, 0.5]);
        
        model.update(&features, 0.8).unwrap();
        assert_eq!(model.n_observations, 1);
        
        model.reset();
        assert_eq!(model.n_observations, 0);
        assert_relative_eq!(model.weights[0], 0.0, epsilon = 1e-10);
        assert_relative_eq!(model.weights[1], 0.0, epsilon = 1e-10);
    }
}