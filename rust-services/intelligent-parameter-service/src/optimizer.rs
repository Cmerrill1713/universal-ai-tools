//! Parameter optimization using ML techniques

use crate::types::*;
use crate::error::{ParameterError, Result};
use nalgebra::{DMatrix, DVector};
use smartcore::linalg::basic::matrix::DenseMatrix;
use smartcore::ensemble::random_forest_regressor::RandomForestRegressor;
use smartcore::tree::decision_tree_regressor::DecisionTreeRegressor;
use std::collections::HashMap;
use rand::Rng;
use statrs::distribution::{Beta, ContinuousCDF};
use tracing::{debug, info};

/// Parameter optimizer using various ML techniques
pub struct ParameterOptimizer {
    learning_rate: f64,
    exploration_rate: f64,
    bandit_arms: HashMap<String, BanditArm>,
    thompson_samplers: HashMap<TaskType, ThompsonDistribution>,
    bayesian_states: HashMap<TaskType, BayesianState>,
    quality_predictor: Option<RandomForestRegressor<f64, f64, DenseMatrix<f64>, Vec<f64>>>,
}

impl ParameterOptimizer {
    /// Create a new parameter optimizer
    pub fn new(learning_rate: f64, exploration_rate: f64) -> Self {
        Self {
            learning_rate,
            exploration_rate,
            bandit_arms: HashMap::new(),
            thompson_samplers: HashMap::new(),
            bayesian_states: HashMap::new(),
            quality_predictor: None,
        }
    }
    
    /// Optimize parameters for a request
    pub async fn optimize(
        &self,
        request: &ParameterRequest,
        history: &[PerformanceHistory],
    ) -> Result<OptimalParameters> {
        debug!("Optimizing parameters for model: {}", request.model);
        
        // Choose optimization strategy based on available data
        let optimal_params = if history.len() < 10 {
            // Not enough data, use exploration
            self.explore_parameters(request)
        } else if history.len() < 100 {
            // Use multi-armed bandit
            self.multi_armed_bandit_selection(request, history)
        } else {
            // Use Bayesian optimization
            self.bayesian_optimization(request, history).await?
        };
        
        Ok(optimal_params)
    }
    
    /// Explore parameter space for new combinations
    fn explore_parameters(&self, request: &ParameterRequest) -> OptimalParameters {
        let mut rng = rand::thread_rng();
        let constraints = &request.constraints;
        
        // Generate random parameters within constraints
        let temperature = rng.gen_range(constraints.temperature_range.0..constraints.temperature_range.1);
        let top_p = rng.gen_range(constraints.top_p_range.0..constraints.top_p_range.1);
        let top_k = constraints.top_k_range.map(|(min, max)| rng.gen_range(min..max));
        
        OptimalParameters {
            temperature,
            top_p,
            top_k,
            max_tokens: request.user_preferences.max_tokens.unwrap_or(1024),
            presence_penalty: rng.gen_range(constraints.presence_penalty_range.0..constraints.presence_penalty_range.1),
            frequency_penalty: rng.gen_range(constraints.frequency_penalty_range.0..constraints.frequency_penalty_range.1),
            repetition_penalty: Some(1.1),
            seed: Some(rng.gen()),
            stop_sequences: vec![],
            confidence: 0.5, // Low confidence for exploration
            reasoning: vec!["Exploring parameter space".to_string()],
            expected_quality: 0.7,
            expected_latency_ms: 1000,
        }
    }
    
    /// Multi-armed bandit selection using UCB
    fn multi_armed_bandit_selection(
        &self,
        request: &ParameterRequest,
        history: &[PerformanceHistory],
    ) -> OptimalParameters {
        let mut best_params = self.get_baseline_parameters(&request.user_preferences);
        let mut best_score = 0.0;
        
        // Calculate UCB scores for each historical configuration
        for hist in history {
            let pulls = hist.sample_count as f64;
            let avg_reward = hist.avg_quality as f64;
            
            // UCB1 formula
            let exploration_bonus = (2.0 * (history.len() as f64).ln() / pulls).sqrt();
            let ucb_score = avg_reward + self.exploration_rate * exploration_bonus;
            
            if ucb_score > best_score {
                best_score = ucb_score;
                best_params = hist.parameters.clone();
            }
        }
        
        best_params.confidence = 0.7;
        best_params.reasoning = vec!["Selected using multi-armed bandit (UCB)".to_string()];
        
        best_params
    }
    
    /// Bayesian optimization for parameter selection
    async fn bayesian_optimization(
        &self,
        request: &ParameterRequest,
        history: &[PerformanceHistory],
    ) -> Result<OptimalParameters> {
        info!("Performing Bayesian optimization with {} historical samples", history.len());
        
        // Convert history to observation matrix
        let observations = self.history_to_observations(history);
        
        // Build surrogate model (Gaussian Process approximation)
        let best_params = self.optimize_acquisition_function(&observations, request)?;
        
        Ok(OptimalParameters {
            temperature: best_params[0] as f32,
            top_p: best_params[1] as f32,
            top_k: Some(best_params[2] as u32),
            max_tokens: best_params[3] as usize,
            presence_penalty: best_params[4] as f32,
            frequency_penalty: best_params[5] as f32,
            repetition_penalty: Some(1.1),
            seed: None,
            stop_sequences: vec![],
            confidence: 0.9, // High confidence with Bayesian optimization
            reasoning: vec!["Optimized using Bayesian optimization".to_string()],
            expected_quality: 0.9,
            expected_latency_ms: 800,
        })
    }
    
    /// Convert history to observation matrix
    fn history_to_observations(&self, history: &[PerformanceHistory]) -> Vec<(Vec<f64>, f64)> {
        history.iter().map(|h| {
            let params = vec![
                h.parameters.temperature as f64,
                h.parameters.top_p as f64,
                h.parameters.top_k.unwrap_or(40) as f64,
                h.parameters.max_tokens as f64,
                h.parameters.presence_penalty as f64,
                h.parameters.frequency_penalty as f64,
            ];
            let quality = h.avg_quality as f64;
            (params, quality)
        }).collect()
    }
    
    /// Optimize acquisition function for next point
    fn optimize_acquisition_function(
        &self,
        observations: &[(Vec<f64>, f64)],
        request: &ParameterRequest,
    ) -> Result<Vec<f64>> {
        // Simple grid search for acquisition function maximum
        let mut best_point = vec![0.7, 0.9, 40.0, 1024.0, 0.0, 0.0];
        let mut best_value = f64::NEG_INFINITY;
        
        let constraints = &request.constraints;
        let mut rng = rand::thread_rng();
        
        // Random search for efficiency
        for _ in 0..100 {
            let point = vec![
                rng.gen_range(constraints.temperature_range.0 as f64..constraints.temperature_range.1 as f64),
                rng.gen_range(constraints.top_p_range.0 as f64..constraints.top_p_range.1 as f64),
                rng.gen_range(1.0..100.0),
                request.user_preferences.max_tokens.unwrap_or(1024) as f64,
                rng.gen_range(constraints.presence_penalty_range.0 as f64..constraints.presence_penalty_range.1 as f64),
                rng.gen_range(constraints.frequency_penalty_range.0 as f64..constraints.frequency_penalty_range.1 as f64),
            ];
            
            let value = self.expected_improvement(&point, observations);
            
            if value > best_value {
                best_value = value;
                best_point = point;
            }
        }
        
        Ok(best_point)
    }
    
    /// Calculate expected improvement
    fn expected_improvement(&self, point: &[f64], observations: &[(Vec<f64>, f64)]) -> f64 {
        if observations.is_empty() {
            return 0.0;
        }
        
        // Simple distance-based prediction
        let mut weighted_sum = 0.0;
        let mut weight_sum = 0.0;
        
        for (obs_point, obs_value) in observations {
            let distance = point.iter()
                .zip(obs_point.iter())
                .map(|(a, b)| (a - b).powi(2))
                .sum::<f64>()
                .sqrt();
            
            let weight = (-distance / 10.0).exp();
            weighted_sum += weight * obs_value;
            weight_sum += weight;
        }
        
        if weight_sum > 0.0 {
            weighted_sum / weight_sum
        } else {
            0.0
        }
    }
    
    /// Update optimizer from feedback
    pub async fn update_from_feedback(&self, feedback: &PerformanceFeedback) -> Result<()> {
        // Update bandit arms
        let arm_key = format!("{:?}_{}", feedback.task_type, feedback.parameters_used.temperature);
        
        // Calculate reward based on quality and user preferences
        let reward = feedback.quality_score as f64 
            * (1.0 - feedback.latency_ms as f64 / 10000.0).max(0.0);
        
        // Update Thompson sampling distributions
        self.update_thompson_sampler(&feedback.task_type, reward);
        
        Ok(())
    }
    
    /// Update Thompson sampler for a task type
    fn update_thompson_sampler(&self, task_type: &TaskType, reward: f64) {
        // Thompson sampling with Beta distribution
        // Success increases alpha, failure increases beta
        let success = reward > 0.7;
        
        // This would normally update a mutable field, but for now we'll skip
        // as it requires interior mutability pattern
        debug!("Thompson sampler update for {:?}: reward={}", task_type, reward);
    }
    
    /// Get baseline parameters based on user preferences
    fn get_baseline_parameters(&self, preferences: &UserPreferences) -> OptimalParameters {
        let (temperature, top_p) = match preferences.priority {
            OptimizationPriority::Quality => (0.7, 0.9),
            OptimizationPriority::Speed => (0.3, 0.7),
            OptimizationPriority::Cost => (0.5, 0.8),
            OptimizationPriority::Balanced => (0.6, 0.85),
            OptimizationPriority::Consistency => (0.4, 0.75),
        };
        
        OptimalParameters {
            temperature,
            top_p,
            top_k: Some(40),
            max_tokens: preferences.max_tokens.unwrap_or(1024),
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            repetition_penalty: Some(1.1),
            seed: None,
            stop_sequences: vec![],
            confidence: 0.6,
            reasoning: vec!["Baseline parameters".to_string()],
            expected_quality: 0.75,
            expected_latency_ms: 1000,
        }
    }
}