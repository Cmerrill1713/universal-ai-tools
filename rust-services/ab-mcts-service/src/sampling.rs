//! Thompson Sampling implementation for AB-MCTS
//! 
//! Provides Bayesian bandit algorithm for exploration/exploitation balance
//! in agent selection. Uses Beta distribution sampling for optimal decision making.

use crate::error::{MCTSError, MCTSResult};
use rand::distributions::Distribution;
use rand::prelude::*;
use rand_distr::Beta;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, trace, warn};

/// Beta distribution parameters for an arm (agent)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BetaDistribution {
    pub alpha: f64,
    pub beta: f64,
    pub samples_count: u32,
    pub last_reward: Option<f64>,
    pub last_updated: std::time::SystemTime,
}

impl BetaDistribution {
    /// Create new Beta distribution with prior parameters
    pub fn new(alpha: f64, beta: f64) -> Self {
        Self {
            alpha,
            beta,
            samples_count: 0,
            last_reward: None,
            last_updated: std::time::SystemTime::now(),
        }
    }
    
    /// Sample from the Beta distribution
    pub fn sample<R: Rng + ?Sized>(&self, rng: &mut R) -> MCTSResult<f64> {
        if self.alpha <= 0.0 || self.beta <= 0.0 {
            return Err(MCTSError::sampling_error(
                format!("Invalid Beta parameters: alpha={}, beta={}", self.alpha, self.beta)
            ));
        }
        
        let beta_dist = Beta::new(self.alpha, self.beta)
            .map_err(|e| MCTSError::sampling_error(format!("Beta distribution creation failed: {}", e)))?;
        
        Ok(beta_dist.sample(rng))
    }
    
    /// Get the mean of the distribution (expected reward)
    pub fn mean(&self) -> f64 {
        self.alpha / (self.alpha + self.beta)
    }
    
    /// Get the variance of the distribution
    pub fn variance(&self) -> f64 {
        let sum = self.alpha + self.beta;
        (self.alpha * self.beta) / (sum * sum * (sum + 1.0))
    }
    
    /// Get the 95% credible interval
    pub fn credible_interval(&self) -> MCTSResult<(f64, f64)> {
        // Use Beta quantile approximation for 95% credible interval
        let mean = self.mean();
        let std = self.variance().sqrt();
        
        // Simple approximation - in practice, use proper quantile function
        let margin = 1.96 * std;
        Ok((
            (mean - margin).max(0.0),
            (mean + margin).min(1.0),
        ))
    }
    
    /// Update distribution with new reward
    pub fn update(&mut self, reward: f64) {
        self.samples_count += 1;
        self.last_reward = Some(reward);
        self.last_updated = std::time::SystemTime::now();
        
        // Bernoulli reward - binary outcome based on threshold
        if reward > 0.5 {
            self.alpha += 1.0;
        } else {
            self.beta += 1.0;
        }
    }
    
    /// Get the upper confidence bound for optimistic selection
    pub fn upper_confidence_bound(&self, _confidence: f64) -> MCTSResult<f64> {
        let (_, upper) = self.credible_interval()?;
        Ok(upper)
    }
}

/// Thompson Sampler for multi-armed bandit agent selection
#[derive(Clone, Debug)]
pub struct ThompsonSampler {
    arms: HashMap<String, BetaDistribution>,
    selection_history: Vec<(String, f64)>,
    total_selections: u32,
    exploration_bonus: f64,
    decay_factor: f64,
    rng: Option<StdRng>, // Optional for deterministic testing
}

impl ThompsonSampler {
    /// Create a new Thompson sampler
    pub fn new() -> Self {
        Self {
            arms: HashMap::new(),
            selection_history: Vec::new(),
            total_selections: 0,
            exploration_bonus: 0.1,
            decay_factor: 0.999, // Slight decay to prevent over-exploration
            rng: None,
        }
    }
    
    /// Create a new Thompson sampler with fixed seed for testing
    pub fn new_with_seed(seed: u64) -> Self {
        Self {
            arms: HashMap::new(),
            selection_history: Vec::new(),
            total_selections: 0,
            exploration_bonus: 0.1,
            decay_factor: 0.999,
            rng: Some(StdRng::seed_from_u64(seed)),
        }
    }
    
    /// Add a new arm (agent) to the sampler
    pub fn add_arm(&mut self, arm_name: String, prior_alpha: f64, prior_beta: f64) {
        let distribution = BetaDistribution::new(prior_alpha, prior_beta);
        self.arms.insert(arm_name.clone(), distribution);
        trace!("Added arm '{}' with priors α={}, β={}", arm_name, prior_alpha, prior_beta);
    }
    
    /// Remove an arm from the sampler
    pub fn remove_arm(&mut self, arm_name: &str) -> bool {
        let removed = self.arms.remove(arm_name).is_some();
        if removed {
            debug!("Removed arm '{}'", arm_name);
        }
        removed
    }
    
    /// Get available arms
    pub fn get_arms(&self) -> Vec<String> {
        self.arms.keys().cloned().collect()
    }
    
    /// Select an arm using Thompson Sampling
    pub fn select_arm(&mut self) -> MCTSResult<String> {
        if self.arms.is_empty() {
            return Err(MCTSError::sampling_error("No arms available for selection"));
        }
        
        let mut best_arm = String::new();
        let mut best_sample = f64::NEG_INFINITY;
        
        // Create RNG for this selection
        let mut rng = if let Some(ref mut fixed_rng) = self.rng {
            // Use fixed RNG for testing
            Box::new(fixed_rng) as Box<dyn RngCore>
        } else {
            // Use thread RNG for production
            Box::new(thread_rng()) as Box<dyn RngCore>
        };
        
        // Sample from each arm's Beta distribution
        for (arm_name, distribution) in &self.arms {
            let mut sample = distribution.sample(&mut rng)?;
            
            // Apply exploration bonus for less-explored arms
            let exploration_bonus = self.exploration_bonus * 
                (1.0 / (distribution.samples_count as f64 + 1.0)).sqrt();
            sample += exploration_bonus;
            
            // Apply decay factor to reduce exploration over time
            sample *= self.decay_factor.powi(self.total_selections as i32);
            
            trace!("Arm '{}': sample={:.4}, bonus={:.4}", arm_name, sample, exploration_bonus);
            
            if sample > best_sample {
                best_sample = sample;
                best_arm = arm_name.clone();
            }
        }
        
        if best_arm.is_empty() {
            return Err(MCTSError::sampling_error("No valid arm selected"));
        }
        
        self.total_selections += 1;
        debug!("Selected arm '{}' with sample value {:.4}", best_arm, best_sample);
        
        Ok(best_arm)
    }
    
    /// Select multiple arms for parallel execution
    pub fn select_multiple_arms(&mut self, count: usize) -> MCTSResult<Vec<String>> {
        if count == 0 {
            return Ok(Vec::new());
        }
        
        if count >= self.arms.len() {
            return Ok(self.get_arms());
        }
        
        let mut selected_arms = Vec::new();
        let mut arm_samples = Vec::new();
        
        // Create RNG for this selection
        let mut rng = if let Some(ref mut fixed_rng) = self.rng {
            Box::new(fixed_rng) as Box<dyn RngCore>
        } else {
            Box::new(thread_rng()) as Box<dyn RngCore>
        };
        
        // Sample from all arms
        for (arm_name, distribution) in &self.arms {
            let mut sample = distribution.sample(&mut rng)?;
            
            // Apply exploration bonus
            let exploration_bonus = self.exploration_bonus * 
                (1.0 / (distribution.samples_count as f64 + 1.0)).sqrt();
            sample += exploration_bonus;
            
            arm_samples.push((arm_name.clone(), sample));
        }
        
        // Sort by sample value (descending)
        arm_samples.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Select top count arms
        for (arm_name, _) in arm_samples.into_iter().take(count) {
            selected_arms.push(arm_name);
        }
        
        self.total_selections += selected_arms.len() as u32;
        debug!("Selected {} arms: {:?}", selected_arms.len(), selected_arms);
        
        Ok(selected_arms)
    }
    
    /// Update an arm with observed reward
    pub fn update_arm(&mut self, arm_name: &str, reward: f64) -> MCTSResult<()> {
        if reward < 0.0 || reward > 1.0 {
            warn!("Reward {} for arm '{}' is outside [0,1] range", reward, arm_name);
        }
        
        match self.arms.get_mut(arm_name) {
            Some(distribution) => {
                distribution.update(reward);
                self.selection_history.push((arm_name.to_string(), reward));
                
                debug!("Updated arm '{}' with reward {:.4} (α={:.2}, β={:.2})", 
                       arm_name, reward, distribution.alpha, distribution.beta);
                Ok(())
            }
            None => Err(MCTSError::sampling_error(
                format!("Arm '{}' not found in sampler", arm_name)
            ))
        }
    }
    
    /// Get arm statistics
    pub fn get_arm_stats(&self, arm_name: &str) -> MCTSResult<ArmStatistics> {
        match self.arms.get(arm_name) {
            Some(distribution) => {
                let (lower_ci, upper_ci) = distribution.credible_interval()?;
                Ok(ArmStatistics {
                    arm_name: arm_name.to_string(),
                    alpha: distribution.alpha,
                    beta: distribution.beta,
                    mean: distribution.mean(),
                    variance: distribution.variance(),
                    samples_count: distribution.samples_count,
                    credible_interval: (lower_ci, upper_ci),
                    last_reward: distribution.last_reward,
                })
            }
            None => Err(MCTSError::sampling_error(
                format!("Arm '{}' not found", arm_name)
            ))
        }
    }
    
    /// Get all arm statistics
    pub fn get_all_stats(&self) -> MCTSResult<Vec<ArmStatistics>> {
        let mut stats = Vec::new();
        for arm_name in self.arms.keys() {
            stats.push(self.get_arm_stats(arm_name)?);
        }
        // Sort by mean performance (descending)
        stats.sort_by(|a, b| b.mean.partial_cmp(&a.mean).unwrap_or(std::cmp::Ordering::Equal));
        Ok(stats)
    }
    
    /// Reset all arms to initial state
    pub fn reset_all_arms(&mut self) {
        for distribution in self.arms.values_mut() {
            *distribution = BetaDistribution::new(1.0, 1.0);
        }
        self.selection_history.clear();
        self.total_selections = 0;
        debug!("Reset all arms to initial state");
    }
    
    /// Get selection history
    pub fn get_selection_history(&self) -> &[(String, f64)] {
        &self.selection_history
    }
    
    /// Calculate regret (difference from optimal arm)
    pub fn calculate_regret(&self) -> f64 {
        if self.selection_history.is_empty() {
            return 0.0;
        }
        
        // Find the arm with highest mean reward
        let optimal_mean = self.arms.values()
            .map(|d| d.mean())
            .fold(f64::NEG_INFINITY, f64::max);
        
        // Calculate cumulative regret
        let total_reward: f64 = self.selection_history.iter()
            .map(|(_, reward)| reward)
            .sum();
        
        let expected_optimal_reward = optimal_mean * self.selection_history.len() as f64;
        
        (expected_optimal_reward - total_reward).max(0.0)
    }
}

impl Default for ThompsonSampler {
    fn default() -> Self {
        Self::new()
    }
}

/// Statistics for a single arm
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ArmStatistics {
    pub arm_name: String,
    pub alpha: f64,
    pub beta: f64,
    pub mean: f64,
    pub variance: f64,
    pub samples_count: u32,
    pub credible_interval: (f64, f64),
    pub last_reward: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;
    
    #[test]
    fn test_beta_distribution() {
        let mut dist = BetaDistribution::new(2.0, 3.0);
        
        // Test mean calculation
        assert_relative_eq!(dist.mean(), 0.4, epsilon = 0.001);
        
        // Test update
        dist.update(0.8);
        assert_eq!(dist.alpha, 3.0);
        assert_eq!(dist.beta, 3.0);
        assert_eq!(dist.samples_count, 1);
        
        dist.update(0.2);
        assert_eq!(dist.alpha, 3.0);
        assert_eq!(dist.beta, 4.0);
        assert_eq!(dist.samples_count, 2);
    }
    
    #[test]
    fn test_thompson_sampler_basic() {
        let mut sampler = ThompsonSampler::new_with_seed(42);
        
        // Add arms
        sampler.add_arm("agent1".to_string(), 1.0, 1.0);
        sampler.add_arm("agent2".to_string(), 1.0, 1.0);
        sampler.add_arm("agent3".to_string(), 1.0, 1.0);
        
        // Test selection
        let selected = sampler.select_arm().unwrap();
        assert!(["agent1", "agent2", "agent3"].contains(&selected.as_str()));
        
        // Test update
        sampler.update_arm(&selected, 0.8).unwrap();
        
        // Test statistics
        let stats = sampler.get_arm_stats(&selected).unwrap();
        assert_eq!(stats.samples_count, 1);
        assert!(stats.mean > 0.4); // Should be higher due to positive update
    }
    
    #[test]
    fn test_multiple_arm_selection() {
        let mut sampler = ThompsonSampler::new_with_seed(42);
        
        // Add arms
        for i in 1..=5 {
            sampler.add_arm(format!("agent{}", i), 1.0, 1.0);
        }
        
        // Select multiple arms
        let selected = sampler.select_multiple_arms(3).unwrap();
        assert_eq!(selected.len(), 3);
        
        // All selected arms should be different
        let mut unique_arms = selected.clone();
        unique_arms.sort();
        unique_arms.dedup();
        assert_eq!(unique_arms.len(), 3);
    }
    
    #[test]
    fn test_arm_statistics() {
        let mut sampler = ThompsonSampler::new();
        sampler.add_arm("test_agent".to_string(), 2.0, 1.0);
        
        // Update with several rewards
        sampler.update_arm("test_agent", 0.9).unwrap();
        sampler.update_arm("test_agent", 0.7).unwrap();
        sampler.update_arm("test_agent", 0.3).unwrap();
        
        let stats = sampler.get_arm_stats("test_agent").unwrap();
        assert_eq!(stats.samples_count, 3);
        assert_eq!(stats.alpha, 4.0); // 2.0 + 2 successes
        assert_eq!(stats.beta, 2.0);  // 1.0 + 1 failure
        
        // Test credible interval
        assert!(stats.credible_interval.0 >= 0.0);
        assert!(stats.credible_interval.1 <= 1.0);
        assert!(stats.credible_interval.0 <= stats.credible_interval.1);
    }
    
    #[test]
    fn test_regret_calculation() {
        let mut sampler = ThompsonSampler::new_with_seed(42);
        
        // Add arms with different performance levels
        sampler.add_arm("good_agent".to_string(), 10.0, 2.0); // High performance
        sampler.add_arm("bad_agent".to_string(), 2.0, 10.0);  // Low performance
        
        // Simulate some selections and updates
        for _ in 0..10 {
            let selected = sampler.select_arm().unwrap();
            let reward = if selected == "good_agent" { 0.8 } else { 0.2 };
            sampler.update_arm(&selected, reward).unwrap();
        }
        
        let regret = sampler.calculate_regret();
        assert!(regret >= 0.0);
    }
    
    #[test]
    fn test_sampler_reset() {
        let mut sampler = ThompsonSampler::new();
        
        sampler.add_arm("agent1".to_string(), 1.0, 1.0);
        sampler.update_arm("agent1", 0.8).unwrap();
        
        // Verify arm has been updated
        let stats_before = sampler.get_arm_stats("agent1").unwrap();
        assert_eq!(stats_before.samples_count, 1);
        
        // Reset and verify
        sampler.reset_all_arms();
        let stats_after = sampler.get_arm_stats("agent1").unwrap();
        assert_eq!(stats_after.samples_count, 0);
        assert_eq!(stats_after.alpha, 1.0);
        assert_eq!(stats_after.beta, 1.0);
        
        assert!(sampler.get_selection_history().is_empty());
    }
    
    #[test]
    fn test_error_handling() {
        let mut sampler = ThompsonSampler::new();
        
        // Test selection with no arms
        assert!(sampler.select_arm().is_err());
        
        // Test update of non-existent arm
        assert!(sampler.update_arm("nonexistent", 0.5).is_err());
        
        // Test stats of non-existent arm
        assert!(sampler.get_arm_stats("nonexistent").is_err());
    }
}