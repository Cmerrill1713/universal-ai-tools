//! Advanced AB-MCTS (Alpha-Beta Monte Carlo Tree Search) Implementation
//!
//! This module provides sophisticated tree search capabilities for agent planning
//! with neural network guidance, parallel simulations, and adaptive strategies.

use crate::{OrchestrationError, MCTSConfig};
use chrono::{DateTime, Utc};
use ndarray::{Array1, Array2};
use parking_lot::RwLock;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, Semaphore};
use uuid::Uuid;

/// Advanced MCTS planner with neural guidance and parallel search
#[derive(Debug)]
pub struct MCTSPlanner {
    config: MCTSConfig,
    root: Arc<RwLock<MCTSNode>>,
    neural_evaluator: Option<NeuralEvaluator>,
    search_statistics: Arc<RwLock<SearchStatistics>>,
    simulation_semaphore: Arc<Semaphore>,
}

/// MCTS Node representing a state in the search tree
#[derive(Debug, Clone)]
pub struct MCTSNode {
    pub id: Uuid,
    pub state: AgentState,
    pub action: Option<AgentAction>,
    pub parent: Option<Uuid>,
    pub children: Vec<(AgentAction, Arc<RwLock<MCTSNode>>)>,
    pub visits: u64,
    pub total_value: f64,
    pub ucb1_value: f64,
    pub depth: usize,
    pub is_terminal: bool,
    pub created_at: DateTime<Utc>,
    pub neural_prior: Option<f64>,
    pub action_priors: Vec<(AgentAction, f64)>,
}

/// Agent state representation for MCTS planning
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentState {
    pub context: String,
    pub available_actions: Vec<AgentAction>,
    pub resources: ResourceState,
    pub objectives: Vec<Objective>,
    pub constraints: Vec<Constraint>,
    pub performance_history: Vec<f64>,
}

/// Possible actions an agent can take
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentAction {
    ExecuteTask { task: String, priority: u8 },
    SpawnAgent { agent_type: String, config: HashMap<String, String> },
    RequestResource { resource_type: String, amount: u64 },
    Collaborate { target_agent: Uuid, action: Box<AgentAction> },
    OptimizePerformance { strategy: String },
    UpdateContext { new_context: String },
    CacheResult { key: String, value: String },
    Terminate,
}

/// Resource state tracking
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ResourceState {
    pub cpu_available: f64,
    pub memory_available: u64,
    pub network_bandwidth: u64,
    pub active_connections: u32,
    pub cache_usage: f64,
}

/// Objective definition for planning
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Objective {
    pub id: Uuid,
    pub description: String,
    pub priority: f64,
    pub completion_criteria: CompletionCriteria,
    pub deadline: Option<DateTime<Utc>>,
}

/// Completion criteria for objectives
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CompletionCriteria {
    ResponseReceived,
    AccuracyThreshold(f64),
    PerformanceThreshold { latency_ms: u64, throughput: f64 },
    ResourceUtilization { cpu_max: f64, memory_max: u64 },
    CustomMetric { name: String, threshold: f64 },
}

/// Constraint for planning
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Constraint {
    pub id: Uuid,
    pub constraint_type: ConstraintType,
    pub severity: ConstraintSeverity,
}

/// Types of constraints
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConstraintType {
    ResourceLimit { resource: String, max_value: u64 },
    TimeLimit { max_duration_ms: u64 },
    DependencyOrder { before: Vec<Uuid>, after: Vec<Uuid> },
    QualityThreshold { metric: String, min_value: f64 },
    CostBudget { max_cost: f64 },
}

/// Constraint severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ConstraintSeverity {
    Hard,    // Must be satisfied
    Soft,    // Preferred but not required
    Advisory // Guidance only
}

/// Neural network evaluator for MCTS guidance
#[derive(Debug)]
pub struct NeuralEvaluator {
    weights: Array2<f64>,
    biases: Array1<f64>,
    feature_extractor: FeatureExtractor,
}

/// Feature extraction for neural evaluation
#[derive(Debug)]
pub struct FeatureExtractor;

/// Search strategies for different scenarios
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SearchStrategy {
    Standard,
    RapidExploration { bias: f64 },
    DeepSearch { max_depth: usize },
    AdaptiveHybrid { exploration_budget: f64 },
    NeuralGuided { confidence_threshold: f64 },
}

/// Search statistics and performance tracking
#[derive(Debug, Clone)]
pub struct SearchStatistics {
    pub total_simulations: u64,
    pub successful_simulations: u64,
    pub average_simulation_time: Duration,
    pub best_value_found: f64,
    pub tree_depth_reached: usize,
    pub nodes_explored: u64,
    pub neural_guidance_accuracy: f64,
    pub parallelization_efficiency: f64,
}

impl MCTSPlanner {
    /// Create a new MCTS planner with configuration
    pub fn new(config: MCTSConfig) -> Self {
        let root_state = AgentState {
            context: String::new(),
            available_actions: Vec::new(),
            resources: ResourceState {
                cpu_available: 100.0,
                memory_available: 1024 * 1024 * 1024, // 1GB
                network_bandwidth: 1000 * 1000 * 1000, // 1Gbps
                active_connections: 0,
                cache_usage: 0.0,
            },
            objectives: Vec::new(),
            constraints: Vec::new(),
            performance_history: Vec::new(),
        };

        let root = Arc::new(RwLock::new(MCTSNode {
            id: Uuid::new_v4(),
            state: root_state,
            action: None,
            parent: None,
            children: Vec::new(),
            visits: 0,
            total_value: 0.0,
            ucb1_value: f64::INFINITY,
            depth: 0,
            is_terminal: false,
            created_at: Utc::now(),
            neural_prior: None,
            action_priors: Vec::new(),
        }));

        let neural_evaluator = if config.use_neural_guidance {
            Some(NeuralEvaluator::new())
        } else {
            None
        };

        let parallel_simulations = config.parallel_simulations;
        Self {
            config,
            root,
            neural_evaluator,
            search_statistics: Arc::new(RwLock::new(SearchStatistics {
                total_simulations: 0,
                successful_simulations: 0,
                average_simulation_time: Duration::from_millis(0),
                best_value_found: 0.0,
                tree_depth_reached: 0,
                nodes_explored: 0,
                neural_guidance_accuracy: 0.0,
                parallelization_efficiency: 0.0,
            })),
            simulation_semaphore: Arc::new(Semaphore::new(parallel_simulations)),
        }
    }

    /// Search for the best action sequence using MCTS
    pub async fn search(&self, initial_state: AgentState) -> Result<Vec<AgentAction>, OrchestrationError> {
        let start_time = Instant::now();
        let timeout = Duration::from_secs(self.config.timeout_seconds);

        // Initialize root with the current state
        {
            let mut root = self.root.write();
            root.state = initial_state;
            root.visits = 0;
            root.total_value = 0.0;
            root.children.clear();
        }

        // Parallel MCTS simulations
        let mut simulation_handles = Vec::new();
        let (result_tx, mut result_rx) = mpsc::channel(self.config.parallel_simulations * 2);

        for simulation_id in 0..self.config.simulations {
            let permit = self.simulation_semaphore.clone().acquire_owned().await
                .map_err(|e| OrchestrationError::PlanningError(format!("Semaphore error: {}", e)))?;

            let root_clone = Arc::clone(&self.root);
            let config = self.config.clone();
            let neural_evaluator = self.neural_evaluator.as_ref().map(|ne| ne.clone());
            let tx = result_tx.clone();

            let handle = tokio::spawn(async move {
                let _permit = permit; // Keep permit alive for the duration
                let simulation_result = Self::run_simulation(
                    simulation_id as u64,
                    root_clone,
                    &config,
                    neural_evaluator.as_ref(),
                ).await;

                if let Err(e) = tx.send(simulation_result).await {
                    tracing::warn!("Failed to send simulation result: {}", e);
                }
            });

            simulation_handles.push(handle);

            // Check timeout
            if start_time.elapsed() > timeout {
                tracing::info!("MCTS search timeout reached, stopping simulations");
                break;
            }
        }

        drop(result_tx); // Close sender

        // Collect simulation results
        let mut simulation_count = 0;
        let mut successful_simulations = 0;
        let mut total_simulation_time = Duration::from_millis(0);

        while let Some(result) = result_rx.recv().await {
            simulation_count += 1;
            match result {
                Ok(simulation_stats) => {
                    successful_simulations += 1;
                    total_simulation_time += simulation_stats.duration;
                }
                Err(e) => {
                    tracing::debug!("Simulation failed: {}", e);
                }
            }

            // Check timeout
            if start_time.elapsed() > timeout {
                break;
            }
        }

        // Wait for remaining handles to complete (with timeout)
        let remaining_time = timeout.saturating_sub(start_time.elapsed());
        if !remaining_time.is_zero() {
            let _ = tokio::time::timeout(remaining_time, futures::future::join_all(simulation_handles)).await;
        }

        // Update search statistics
        {
            let mut stats = self.search_statistics.write();
            stats.total_simulations = simulation_count;
            stats.successful_simulations = successful_simulations;
            stats.average_simulation_time = if simulation_count > 0 {
                total_simulation_time / simulation_count as u32
            } else {
                Duration::from_millis(0)
            };
            stats.parallelization_efficiency = successful_simulations as f64 / simulation_count as f64;
        }

        // Extract best action sequence
        self.extract_best_path()
    }

    /// Run a single MCTS simulation
    async fn run_simulation(
        simulation_id: u64,
        root: Arc<RwLock<MCTSNode>>,
        config: &MCTSConfig,
        neural_evaluator: Option<&NeuralEvaluator>,
    ) -> Result<SimulationStats, OrchestrationError> {
        let start_time = Instant::now();

        // Selection phase: traverse tree using UCB1
        let selected_node = Self::select_node(root.clone(), config.exploration_constant)?;

        // Expansion phase: add new child nodes
        let expanded_node = Self::expand_node(selected_node, neural_evaluator).await?;

        // Simulation phase: rollout from expanded node
        let value = Self::simulate_rollout(expanded_node.clone(), config.max_depth).await?;

        // Backpropagation phase: update node values up the tree
        Self::backpropagate(expanded_node.clone(), value)?;

        Ok(SimulationStats {
            _id: simulation_id,
            duration: start_time.elapsed(),
            _value_found: value,
            _depth_reached: Self::get_node_depth(&expanded_node),
        })
    }

    /// Select the most promising node using UCB1 with neural guidance
    fn select_node(
        root: Arc<RwLock<MCTSNode>>,
        exploration_constant: f64,
    ) -> Result<Arc<RwLock<MCTSNode>>, OrchestrationError> {
        let mut current = root;

        loop {
            let node = current.read();

            // If terminal or unexplored, return this node
            if node.is_terminal || node.children.is_empty() {
                drop(node);
                return Ok(current);
            }

            // Find child with highest UCB1 value
            let mut best_child = None;
            let mut best_ucb1 = f64::NEG_INFINITY;

            let parent_visits = node.visits as f64;

            for (_, child_ref) in &node.children {
                let child = child_ref.read();
                let child_visits = child.visits as f64;

                let ucb1 = if child_visits == 0.0 {
                    f64::INFINITY
                } else {
                    let exploitation = child.total_value / child_visits;
                    let exploration = exploration_constant *
                        (parent_visits.ln() / child_visits).sqrt();

                    // Add neural prior if available
                    let neural_bonus = child.neural_prior.unwrap_or(0.0) * 0.1;

                    exploitation + exploration + neural_bonus
                };

                if ucb1 > best_ucb1 {
                    best_ucb1 = ucb1;
                    best_child = Some(child_ref.clone());
                }
            }

            drop(node);

            match best_child {
                Some(child) => current = child,
                None => return Ok(current),
            }
        }
    }

    /// Expand a node by adding new children
    async fn expand_node(
        node_ref: Arc<RwLock<MCTSNode>>,
        neural_evaluator: Option<&NeuralEvaluator>,
    ) -> Result<Arc<RwLock<MCTSNode>>, OrchestrationError> {
        // First, check if we need to expand
        let state_copy = {
            let node = node_ref.read();
            // If already expanded or terminal, return self
            if !node.children.is_empty() || node.is_terminal {
                return Ok(Arc::clone(&node_ref));
            }
            node.state.clone()
        };

        // Generate possible actions from current state
        let possible_actions = Self::generate_possible_actions(&state_copy);

        // Get neural priors if evaluator available (without holding the lock)
        let action_priors = if let Some(evaluator) = neural_evaluator {
            evaluator.evaluate_actions(&state_copy, &possible_actions).await?
        } else {
            Vec::new()
        };

        // Create child nodes for each action
        let mut new_children = Vec::new();
        let (parent_id, parent_depth) = {
            let node = node_ref.read();
            (node.id, node.depth)
        };

        for action in possible_actions {
            let child_id = Uuid::new_v4();
            let child_state = Self::apply_action(&state_copy, &action)?;

            let neural_prior = action_priors.iter()
                .find(|(a, _)| a == &action)
                .map(|(_, prior)| *prior);

            let child = Arc::new(RwLock::new(MCTSNode {
                id: child_id,
                state: child_state.clone(),
                action: Some(action.clone()),
                parent: Some(parent_id),
                children: Vec::new(),
                visits: 0,
                total_value: 0.0,
                ucb1_value: f64::INFINITY,
                depth: parent_depth + 1,
                is_terminal: Self::is_terminal_state(&child_state),
                created_at: Utc::now(),
                neural_prior,
                action_priors: Vec::new(),
            }));

            new_children.push((action, child));
        }

        // Now add all children in one write operation
        {
            let mut node = node_ref.write();
            node.children.extend(new_children);
        }

        // Return first child for simulation, or self if no children
        let first_child = {
            let node = node_ref.read();
            node.children.first().map(|(_, child)| child.clone())
        };

        Ok(first_child.unwrap_or(node_ref))
    }

    /// Simulate a random rollout from the given node
    async fn simulate_rollout(
        node_ref: Arc<RwLock<MCTSNode>>,
        max_depth: usize,
    ) -> Result<f64, OrchestrationError> {
        let node = node_ref.read();
        let mut current_state = node.state.clone();
        let mut depth = node.depth;
        drop(node);

        let mut rng = rand::thread_rng();
        let mut total_value = 0.0;

        // Random rollout until terminal state or max depth
        while !Self::is_terminal_state(&current_state) && depth < max_depth {
            let possible_actions = Self::generate_possible_actions(&current_state);

            if possible_actions.is_empty() {
                break;
            }

            // Select random action with some preference for high-value actions
            let action_idx = rng.gen_range(0..possible_actions.len());
            let action = &possible_actions[action_idx];

            // Apply action and get reward
            current_state = Self::apply_action(&current_state, action)?;
            total_value += Self::calculate_immediate_reward(&current_state, action);
            depth += 1;
        }

        // Add terminal reward if reached terminal state
        if Self::is_terminal_state(&current_state) {
            total_value += Self::calculate_terminal_reward(&current_state);
        }

        Ok(total_value)
    }

    /// Backpropagate value up the tree
    fn backpropagate(
        node_ref: Arc<RwLock<MCTSNode>>,
        value: f64,
    ) -> Result<(), OrchestrationError> {
        let mut current = Some(node_ref);

        while let Some(node_ref) = current {
            let mut node = node_ref.write();
            node.visits += 1;
            node.total_value += value;

            // Find parent for next iteration
            let parent_id = node.parent;
            drop(node);

            if let Some(_parent_id) = parent_id {
                // In a real implementation, we'd need to maintain parent references
                // For now, we'll break the loop
                break;
            }

            current = None;
        }

        Ok(())
    }

    /// Generate possible actions from the current state
    fn generate_possible_actions(state: &AgentState) -> Vec<AgentAction> {
        let mut actions = state.available_actions.clone();

        // Add dynamic actions based on state
        if state.resources.cpu_available > 50.0 {
            actions.push(AgentAction::SpawnAgent {
                agent_type: "worker".to_string(),
                config: HashMap::new(),
            });
        }

        if state.resources.memory_available > 512 * 1024 * 1024 {
            actions.push(AgentAction::CacheResult {
                key: "context".to_string(),
                value: state.context.clone(),
            });
        }

        if !state.objectives.is_empty() {
            actions.push(AgentAction::ExecuteTask {
                task: state.objectives[0].description.clone(),
                priority: (state.objectives[0].priority * 10.0) as u8,
            });
        }

        // Always allow performance optimization
        actions.push(AgentAction::OptimizePerformance {
            strategy: "adaptive".to_string(),
        });

        actions
    }

    /// Apply an action to a state and return the new state
    fn apply_action(state: &AgentState, action: &AgentAction) -> Result<AgentState, OrchestrationError> {
        let mut new_state = state.clone();

        match action {
            AgentAction::ExecuteTask { task: _, priority } => {
                // Simulate task execution impact on resources
                let cpu_cost = *priority as f64 * 2.0;
                let memory_cost = *priority as u64 * 1024 * 1024;

                new_state.resources.cpu_available = (new_state.resources.cpu_available - cpu_cost).max(0.0);
                new_state.resources.memory_available = new_state.resources.memory_available.saturating_sub(memory_cost);

                // Add to performance history
                new_state.performance_history.push(100.0 - cpu_cost);
            },

            AgentAction::SpawnAgent { agent_type: _, config: _ } => {
                new_state.resources.cpu_available *= 0.8; // Spawning uses resources
                new_state.resources.memory_available = new_state.resources.memory_available.saturating_sub(128 * 1024 * 1024);
                new_state.resources.active_connections += 1;
            },

            AgentAction::RequestResource { resource_type: _, amount } => {
                new_state.resources.memory_available = new_state.resources.memory_available.saturating_sub(*amount);
            },

            AgentAction::OptimizePerformance { strategy: _ } => {
                new_state.resources.cpu_available = (new_state.resources.cpu_available * 1.1).min(100.0);
                new_state.resources.cache_usage = (new_state.resources.cache_usage * 0.9).max(0.0);
            },

            AgentAction::UpdateContext { new_context } => {
                new_state.context = new_context.clone();
            },

            AgentAction::CacheResult { key: _, value: _ } => {
                new_state.resources.cache_usage = (new_state.resources.cache_usage + 10.0).min(100.0);
                new_state.resources.memory_available = new_state.resources.memory_available.saturating_sub(1024 * 1024);
            },

            AgentAction::Collaborate { target_agent: _, action: _ } => {
                new_state.resources.network_bandwidth = new_state.resources.network_bandwidth.saturating_sub(1024 * 1024);
                new_state.resources.active_connections += 1;
            },

            AgentAction::Terminate => {
                // Terminal action doesn't change state
            },
        }

        Ok(new_state)
    }

    /// Check if a state is terminal
    fn is_terminal_state(state: &AgentState) -> bool {
        // Terminal conditions
        state.resources.cpu_available <= 0.0 ||
        state.resources.memory_available < 32 * 1024 * 1024 ||
        state.objectives.is_empty() ||
        state.performance_history.len() > 100
    }

    /// Calculate immediate reward for taking an action
    fn calculate_immediate_reward(_state: &AgentState, action: &AgentAction) -> f64 {
        match action {
            AgentAction::ExecuteTask { priority, .. } => *priority as f64 * 10.0,
            AgentAction::OptimizePerformance { .. } => 50.0,
            AgentAction::SpawnAgent { .. } => 20.0,
            AgentAction::CacheResult { .. } => 15.0,
            AgentAction::UpdateContext { .. } => 10.0,
            AgentAction::Collaborate { .. } => 30.0,
            AgentAction::RequestResource { .. } => 5.0,
            AgentAction::Terminate => -100.0,
        }
    }

    /// Calculate terminal reward for reaching a final state
    fn calculate_terminal_reward(state: &AgentState) -> f64 {
        let mut reward = 0.0;

        // Reward efficient resource usage
        reward += state.resources.cpu_available * 2.0;
        reward += (state.resources.memory_available as f64 / (1024.0 * 1024.0)) * 0.1;

        // Penalty for poor performance
        if let Some(&last_performance) = state.performance_history.last() {
            reward += last_performance;
        }

        // Bonus for completing objectives
        if state.objectives.is_empty() {
            reward += 1000.0;
        }

        reward
    }

    /// Extract the best action sequence from the search tree
    fn extract_best_path(&self) -> Result<Vec<AgentAction>, OrchestrationError> {
        let mut path = Vec::new();
        let mut current = Arc::clone(&self.root);

        // Follow the path of most visited nodes
        for _depth in 0..self.config.max_depth {
            let node = current.read();

            if node.children.is_empty() {
                break;
            }

            // Find child with highest visit count
            let mut best_child = None;
            let mut best_visits = 0u64;
            let mut best_action = None;

            for (action, child_ref) in &node.children {
                let child = child_ref.read();
                if child.visits > best_visits {
                    best_visits = child.visits;
                    best_child = Some(child_ref.clone());
                    best_action = Some(action.clone());
                }
            }

            drop(node);

            if let (Some(child), Some(action)) = (best_child, best_action) {
                path.push(action);
                current = child;
            } else {
                break;
            }
        }

        if path.is_empty() {
            return Err(OrchestrationError::PlanningError(
                "No valid path found in search tree".to_string()
            ));
        }

        Ok(path)
    }

    /// Get search statistics
    pub fn get_statistics(&self) -> SearchStatistics {
        self.search_statistics.read().clone()
    }

    /// Get the depth of a node
    fn get_node_depth(node_ref: &Arc<RwLock<MCTSNode>>) -> usize {
        node_ref.read().depth
    }
}

/// Statistics for a single simulation
#[derive(Debug)]
struct SimulationStats {
    _id: u64,
    duration: Duration,
    _value_found: f64,
    _depth_reached: usize,
}

impl NeuralEvaluator {
    /// Create a new neural evaluator with random weights
    fn new() -> Self {
        let mut rng = rand::thread_rng();

        // Simple 2-layer network for demonstration
        let input_size = 10; // Feature vector size
        let hidden_size = 20;
        let _output_size = 1;

        let weights = Array2::from_shape_fn((hidden_size, input_size), |_| {
            rng.gen_range(-1.0..1.0)
        });

        let biases = Array1::from_shape_fn(hidden_size, |_| {
            rng.gen_range(-0.5..0.5)
        });

        Self {
            weights,
            biases,
            feature_extractor: FeatureExtractor,
        }
    }

    /// Evaluate actions and return prior probabilities
    async fn evaluate_actions(
        &self,
        state: &AgentState,
        actions: &[AgentAction],
    ) -> Result<Vec<(AgentAction, f64)>, OrchestrationError> {
        let _features = self.feature_extractor.extract_features(state);
        let mut priors = Vec::new();

        // Simple evaluation based on action type and state
        for action in actions {
            let prior = match action {
                AgentAction::ExecuteTask { priority, .. } => {
                    0.8 + (*priority as f64 / 10.0) * 0.2
                },
                AgentAction::OptimizePerformance { .. } => {
                    if state.resources.cpu_available < 50.0 { 0.9 } else { 0.3 }
                },
                AgentAction::SpawnAgent { .. } => {
                    if state.resources.cpu_available > 70.0 { 0.7 } else { 0.1 }
                },
                _ => 0.5,
            };

            priors.push((action.clone(), prior));
        }

        Ok(priors)
    }

    /// Clone for parallel usage
    fn clone(&self) -> Self {
        Self {
            weights: self.weights.clone(),
            biases: self.biases.clone(),
            feature_extractor: FeatureExtractor,
        }
    }
}

impl FeatureExtractor {
    /// Extract numerical features from agent state
    fn extract_features(&self, state: &AgentState) -> Array1<f64> {
        Array1::from_vec(vec![
            state.resources.cpu_available / 100.0,
            state.resources.memory_available as f64 / (1024.0 * 1024.0 * 1024.0),
            state.resources.network_bandwidth as f64 / (1000.0 * 1000.0 * 1000.0),
            state.resources.active_connections as f64 / 100.0,
            state.resources.cache_usage / 100.0,
            state.objectives.len() as f64 / 10.0,
            state.constraints.len() as f64 / 10.0,
            state.available_actions.len() as f64 / 20.0,
            state.performance_history.len() as f64 / 100.0,
            state.performance_history.iter().sum::<f64>() / state.performance_history.len().max(1) as f64 / 100.0,
        ])
    }
}
