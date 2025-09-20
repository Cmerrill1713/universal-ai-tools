//! Reinforcement learning for parameter optimization

use crate::types::*;
use crate::error::{ParameterError, Result};
use nalgebra::{DMatrix, DVector};
use std::collections::HashMap;
use rand::Rng;
use tracing::{debug, info};

/// Q-learning agent for parameter optimization
pub struct QLearningAgent {
    q_table: HashMap<String, HashMap<String, f64>>,
    learning_rate: f64,
    discount_factor: f64,
    epsilon: f64,
    action_space: Vec<ParameterAction>,
}

#[derive(Clone, Debug)]
pub struct ParameterAction {
    temperature_delta: f32,
    top_p_delta: f32,
    top_k_delta: i32,
    max_tokens_delta: i32,
}

impl QLearningAgent {
    /// Create a new Q-learning agent
    pub fn new(learning_rate: f64, epsilon: f64) -> Self {
        let action_space = Self::generate_action_space();
        
        Self {
            q_table: HashMap::new(),
            learning_rate,
            discount_factor: 0.95,
            epsilon,
            action_space,
        }
    }
    
    /// Generate discrete action space
    fn generate_action_space() -> Vec<ParameterAction> {
        let mut actions = Vec::new();
        
        for temp_delta in [-0.2, -0.1, 0.0, 0.1, 0.2] {
            for top_p_delta in [-0.1, -0.05, 0.0, 0.05, 0.1] {
                for top_k_delta in [-10, -5, 0, 5, 10] {
                    for tokens_delta in [-256, -128, 0, 128, 256] {
                        actions.push(ParameterAction {
                            temperature_delta: temp_delta,
                            top_p_delta: top_p_delta,
                            top_k_delta,
                            max_tokens_delta: tokens_delta,
                        });
                    }
                }
            }
        }
        
        actions
    }
    
    /// Select action using epsilon-greedy policy
    pub fn select_action(&self, state: &str) -> ParameterAction {
        let mut rng = rand::thread_rng();
        
        if rng.gen::<f64>() < self.epsilon {
            // Exploration: random action
            let idx = rng.gen_range(0..self.action_space.len());
            self.action_space[idx].clone()
        } else {
            // Exploitation: best known action
            self.get_best_action(state)
        }
    }
    
    /// Get best action for a state
    fn get_best_action(&self, state: &str) -> ParameterAction {
        if let Some(state_q_values) = self.q_table.get(state) {
            let mut best_action_idx = 0;
            let mut best_value = f64::NEG_INFINITY;
            
            for (i, action) in self.action_space.iter().enumerate() {
                let action_key = format!("{:?}", action);
                if let Some(&value) = state_q_values.get(&action_key) {
                    if value > best_value {
                        best_value = value;
                        best_action_idx = i;
                    }
                }
            }
            
            self.action_space[best_action_idx].clone()
        } else {
            // No knowledge, return neutral action
            ParameterAction {
                temperature_delta: 0.0,
                top_p_delta: 0.0,
                top_k_delta: 0,
                max_tokens_delta: 0,
            }
        }
    }
    
    /// Update Q-value based on feedback
    pub fn update(
        &mut self,
        state: &str,
        action: &ParameterAction,
        reward: f64,
        next_state: &str,
    ) {
        let action_key = format!("{:?}", action);
        
        // Get max Q-value for next state first
        let max_next_q = if let Some(next_q_values) = self.q_table.get(next_state) {
            next_q_values.values().fold(f64::NEG_INFINITY, |a, &b| a.max(b))
        } else {
            0.0
        };
        
        // Get current Q-value and update it
        let current_q = self.q_table
            .entry(state.to_string())
            .or_insert_with(HashMap::new)
            .entry(action_key.clone())
            .or_insert(0.0);
        
        // Q-learning update rule
        let new_value = *current_q + self.learning_rate * (reward + self.discount_factor * max_next_q - *current_q);
        *current_q = new_value;
        
        debug!("Updated Q-value for state {} action {:?}: {}", state, action, new_value);
    }
    
    /// Apply action to parameters
    pub fn apply_action(
        &self,
        params: &OptimalParameters,
        action: &ParameterAction,
        constraints: &ParameterConstraints,
    ) -> OptimalParameters {
        let mut new_params = params.clone();
        
        // Apply deltas with constraints
        new_params.temperature = (params.temperature + action.temperature_delta)
            .max(constraints.temperature_range.0)
            .min(constraints.temperature_range.1);
        
        new_params.top_p = (params.top_p + action.top_p_delta)
            .max(constraints.top_p_range.0)
            .min(constraints.top_p_range.1);
        
        if let Some(top_k) = params.top_k {
            if let Some((min_k, max_k)) = constraints.top_k_range {
                new_params.top_k = Some(
                    ((top_k as i32 + action.top_k_delta) as u32)
                        .max(min_k)
                        .min(max_k)
                );
            }
        }
        
        new_params.max_tokens = ((params.max_tokens as i32 + action.max_tokens_delta) as usize)
            .max(256)
            .min(constraints.max_tokens_limit);
        
        new_params.reasoning.push(format!(
            "Applied RL action: temp{:+.1}, p{:+.2}, k{:+}, tok{:+}",
            action.temperature_delta,
            action.top_p_delta,
            action.top_k_delta,
            action.max_tokens_delta
        ));
        
        new_params
    }
    
    /// Decay epsilon for exploration
    pub fn decay_epsilon(&mut self, decay_rate: f64) {
        self.epsilon = (self.epsilon * decay_rate).max(0.01);
    }
}

/// Deep Q-Network for continuous parameter space
pub struct DeepQNetwork {
    state_dim: usize,
    action_dim: usize,
    hidden_dim: usize,
    weights: Vec<DMatrix<f64>>,
    biases: Vec<DVector<f64>>,
}

impl DeepQNetwork {
    /// Create a new DQN
    pub fn new(state_dim: usize, action_dim: usize, hidden_dim: usize) -> Self {
        let mut rng = rand::thread_rng();
        
        // Initialize weights with Xavier initialization
        let w1 = DMatrix::from_fn(hidden_dim, state_dim, |_, _| {
            rng.gen::<f64>() * (2.0 / state_dim as f64).sqrt() - (1.0 / state_dim as f64).sqrt()
        });
        
        let w2 = DMatrix::from_fn(hidden_dim, hidden_dim, |_, _| {
            rng.gen::<f64>() * (2.0 / hidden_dim as f64).sqrt() - (1.0 / hidden_dim as f64).sqrt()
        });
        
        let w3 = DMatrix::from_fn(action_dim, hidden_dim, |_, _| {
            rng.gen::<f64>() * (2.0 / hidden_dim as f64).sqrt() - (1.0 / hidden_dim as f64).sqrt()
        });
        
        let b1 = DVector::zeros(hidden_dim);
        let b2 = DVector::zeros(hidden_dim);
        let b3 = DVector::zeros(action_dim);
        
        Self {
            state_dim,
            action_dim,
            hidden_dim,
            weights: vec![w1, w2, w3],
            biases: vec![b1, b2, b3],
        }
    }
    
    /// Forward pass through the network
    pub fn forward(&self, state: &DVector<f64>) -> DVector<f64> {
        // Layer 1
        let z1 = &self.weights[0] * state + &self.biases[0];
        let a1 = z1.map(|x| x.max(0.0)); // ReLU
        
        // Layer 2
        let z2 = &self.weights[1] * a1 + &self.biases[1];
        let a2 = z2.map(|x| x.max(0.0)); // ReLU
        
        // Output layer
        &self.weights[2] * a2 + &self.biases[2]
    }
    
    /// Get best action from Q-values
    pub fn get_best_action(&self, state: &DVector<f64>) -> usize {
        let q_values = self.forward(state);
        
        let mut best_idx = 0;
        let mut best_value = q_values[0];
        
        for i in 1..self.action_dim {
            if q_values[i] > best_value {
                best_value = q_values[i];
                best_idx = i;
            }
        }
        
        best_idx
    }
}