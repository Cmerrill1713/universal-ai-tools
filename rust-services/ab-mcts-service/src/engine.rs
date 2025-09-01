//! Main MCTS engine implementation
//! 
//! The core Monte Carlo Tree Search algorithm with Thompson Sampling,
//! UCB1 selection, and Bayesian learning integration.

use crate::cache::{MCTSCache, CacheConfig};
use crate::error::{MCTSError, MCTSResult};
use crate::models::AgentPerformanceModel;
use crate::sampling::{ThompsonSampler, ArmStatistics};
use crate::types::*;
use dashmap::DashMap;
use futures::future::try_join_all;
use instant::Instant;
use nalgebra::DVector;
use rand::prelude::*;
use rand::Rng;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info, trace, warn};
use uuid::Uuid;

/// Main MCTS engine configuration
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct MCTSConfig {
    pub max_iterations: u32,
    pub max_depth: u32,
    pub exploration_constant: f64,
    pub discount_factor: f64,
    pub time_limit: Duration,
    pub parallel_simulations: usize,
    pub node_pool_size: usize,
    pub checkpoint_interval: u32,
    pub enable_thompson_sampling: bool,
    pub enable_bayesian_learning: bool,
    pub enable_caching: bool,
    pub cache_config: Option<CacheConfig>,
}

impl Default for MCTSConfig {
    fn default() -> Self {
        Self {
            max_iterations: 1000,
            max_depth: 10,
            exploration_constant: std::f64::consts::SQRT_2,
            discount_factor: 0.95,
            time_limit: Duration::from_secs(30),
            parallel_simulations: 4,
            node_pool_size: 10000,
            checkpoint_interval: 100,
            enable_thompson_sampling: true,
            enable_bayesian_learning: true,
            enable_caching: true,
            cache_config: Some(CacheConfig::default()),
        }
    }
}

/// Main MCTS engine
pub struct MCTSEngine {
    config: MCTSConfig,
    nodes: Arc<DashMap<String, MCTSNode>>,
    thompson_sampler: Arc<RwLock<ThompsonSampler>>,
    performance_model: Arc<RwLock<AgentPerformanceModel>>,
    cache: Option<Arc<RwLock<MCTSCache>>>,
    search_stats: SearchStatistics,
    rng: StdRng,
}

impl MCTSEngine {
    /// Create a new MCTS engine
    pub async fn new(config: MCTSConfig) -> MCTSResult<Self> {
        let nodes = Arc::new(DashMap::new());
        let thompson_sampler = Arc::new(RwLock::new(ThompsonSampler::new()));
        let performance_model = Arc::new(RwLock::new(AgentPerformanceModel::new()?));
        
        // Initialize cache if enabled
        let cache = if config.enable_caching {
            if let Some(cache_config) = &config.cache_config {
                let mut cache = MCTSCache::new(cache_config.clone())?;
                cache.connect().await?;
                Some(Arc::new(RwLock::new(cache)))
            } else {
                None
            }
        } else {
            None
        };
        
        let search_stats = SearchStatistics {
            total_iterations: 0,
            nodes_explored: 0,
            average_depth: 0.0,
            search_time: Duration::default(),
            cache_hits: 0,
            cache_misses: 0,
            thompson_samples: 0,
            ucb_selections: 0,
        };
        
        let rng = StdRng::from_entropy();
        
        info!("Created MCTS engine with config: max_iterations={}, max_depth={}, exploration_constant={:.3}",
              config.max_iterations, config.max_depth, config.exploration_constant);
        
        Ok(Self {
            config,
            nodes,
            thompson_sampler,
            performance_model,
            cache,
            search_stats,
            rng,
        })
    }
    
    /// Perform MCTS search to find optimal agent sequence
    pub async fn search(
        &mut self,
        initial_context: AgentContext,
        available_agents: Vec<String>,
        options: SearchOptions,
    ) -> MCTSResult<SearchResult> {
        let start_time = Instant::now();
        let session_id = initial_context.execution_context.session_id.clone();
        
        info!("Starting MCTS search for session {} with {} agents", 
              session_id, available_agents.len());
        
        // Check cache first
        if let Some(cached_result) = self.try_get_cached_result(&session_id).await? {
            info!("Found cached search result for session {}", session_id);
            return Ok(cached_result);
        }
        
        // Initialize agents in Thompson sampler
        self.initialize_agents(&available_agents).await?;
        
        // Initialize root node
        let root_id = self.initialize_root(initial_context.clone()).await?;
        
        // Main MCTS loop
        let mut iterations = 0;
        let mut total_depth = 0.0;
        
        while self.should_continue(iterations, start_time, &options) {
            // Selection: Navigate to a leaf node
            let leaf_id = self.select(&root_id).await?;
            
            // Expansion: Add new children if possible
            let expanded_nodes = self.expand(&leaf_id, &available_agents).await?;
            
            // Simulation: Run rollouts for expanded nodes
            let simulations = if expanded_nodes.is_empty() {
                vec![(leaf_id.clone(), self.simulate(&leaf_id, &available_agents).await?)]
            } else {
                self.simulate_batch(&expanded_nodes, &available_agents).await?
            };
            
            // Backpropagation: Update tree with results
            for (node_id, reward) in simulations {
                let depth = self.backpropagate(&node_id, reward.value).await?;
                total_depth += depth as f64;
                
                // Update performance model
                if let Some(node) = self.nodes.get(&node_id) {
                    if let Some(agent_name) = &node.metadata.agent {
                        let features = self.extract_features(&node.state, agent_name);
                        let mut model = self.performance_model.write().await;
                        model.update_with_reward(agent_name, &features, &reward)?;
                    }
                }
            }
            
            iterations += 1;
            
            // Checkpoint periodically
            if iterations % self.config.checkpoint_interval == 0 {
                self.checkpoint(&session_id).await?;
                debug!("Checkpoint at iteration {}", iterations);
            }
        }
        
        // Generate final result
        let search_time = start_time.elapsed();
        self.search_stats.total_iterations = iterations;
        self.search_stats.nodes_explored = self.nodes.len() as u32;
        self.search_stats.average_depth = if iterations > 0 {
            total_depth / iterations as f64
        } else {
            0.0
        };
        self.search_stats.search_time = search_time;
        
        let result = self.generate_result(&root_id).await?;
        
        // Cache the result
        if let Some(cache) = &self.cache {
            let mut cache_guard = cache.write().await;
            if let Err(e) = cache_guard.store_search_result(&session_id, &result).await {
                warn!("Failed to cache search result: {}", e);
            }
        }
        
        info!("MCTS search completed: {} iterations, {} nodes, {:.2}s", 
              iterations, self.nodes.len(), search_time.as_secs_f64());
        
        Ok(result)
    }
    
    /// Initialize agents in Thompson sampler
    async fn initialize_agents(&self, agents: &[String]) -> MCTSResult<()> {
        let mut sampler = self.thompson_sampler.write().await;
        
        for agent in agents {
            // Use cached performance data if available
            let (prior_alpha, prior_beta) = if let Some(cached_stats) = 
                self.get_cached_agent_stats(agent).await? {
                (cached_stats.alpha, cached_stats.beta)
            } else {
                (1.0, 1.0) // Uniform prior
            };
            
            sampler.add_arm(agent.clone(), prior_alpha, prior_beta);
        }
        
        debug!("Initialized {} agents in Thompson sampler", agents.len());
        Ok(())
    }
    
    /// Initialize root node
    async fn initialize_root(&self, context: AgentContext) -> MCTSResult<String> {
        let root = MCTSNode::new_root(context);
        let root_id = root.id.clone();
        
        self.nodes.insert(root_id.clone(), root);
        debug!("Initialized root node: {}", root_id);
        
        Ok(root_id)
    }
    
    /// Selection phase: navigate to leaf using UCB1 + Thompson Sampling
    async fn select(&mut self, root_id: &str) -> MCTSResult<String> {
        let mut current_id = root_id.to_string();
        
        loop {
            let (has_children, is_terminal) = {
                let node = self.nodes.get(&current_id).ok_or_else(|| {
                    MCTSError::node_not_found(&current_id)
                })?;
                (!node.children.is_empty(), node.is_terminal)
            };
            
            if !has_children || is_terminal {
                // Reached a leaf node
                break;
            }
            
            // Select best child using UCB1 + Thompson sampling
            let best_child_id = self.select_best_child(&current_id).await?;
            current_id = best_child_id;
        }
        
        trace!("Selected leaf node: {}", current_id);
        Ok(current_id)
    }
    
    /// Select best child using combined UCB1 and Thompson sampling
    async fn select_best_child(&mut self, parent_id: &str) -> MCTSResult<String> {
        let parent = self.nodes.get(parent_id).ok_or_else(|| {
            MCTSError::node_not_found(parent_id)
        })?;
        
        if parent.children.is_empty() {
            return Err(MCTSError::node_not_found("No children to select from"));
        }
        
        let mut best_child_id = String::new();
        let mut best_score = f64::NEG_INFINITY;
        
        // Calculate UCB1 scores for all children
        for child_id in parent.children.values() {
            if let Some(child) = self.nodes.get(child_id) {
                let ucb_score = if child.visits == 0 {
                    f64::INFINITY
                } else {
                    child.average_reward + self.config.exploration_constant *
                        ((parent.visits as f64).ln() / (child.visits as f64)).sqrt()
                };
                
                // Add Thompson sampling bonus if enabled
                let final_score = if self.config.enable_thompson_sampling {
                    ucb_score + child.thompson_sample
                } else {
                    ucb_score
                };
                
                if final_score > best_score {
                    best_score = final_score;
                    best_child_id = child_id.clone();
                }
            }
        }
        
        if best_child_id.is_empty() {
            return Err(MCTSError::node_not_found("No valid child found"));
        }
        
        self.search_stats.ucb_selections += 1;
        trace!("Selected child {} with UCB score {:.4}", best_child_id, best_score);
        
        Ok(best_child_id)
    }
    
    /// Expansion phase: add new children to leaf nodes
    async fn expand(&mut self, leaf_id: &str, available_agents: &[String]) -> MCTSResult<Vec<String>> {
        // Extract needed data from leaf node before mutable operations
        let (leaf_state, is_terminal, depth) = {
            let leaf = self.nodes.get(leaf_id).ok_or_else(|| {
                MCTSError::node_not_found(leaf_id)
            })?;
            (leaf.state.clone(), leaf.is_terminal, leaf.depth)
        };
        
        if is_terminal || depth >= self.config.max_depth {
            return Ok(Vec::new()); // No expansion needed
        }
        
        // Generate possible actions using Thompson sampling
        let actions = self.generate_actions(&leaf_state, available_agents).await?;
        let mut expanded_nodes = Vec::new();
        
        for action in actions.into_iter().take(self.config.parallel_simulations) {
            let new_state = self.apply_action(&leaf_state, &action)?;
            // Get leaf reference for creating child
            let child = {
                let leaf_ref = self.nodes.get(leaf_id).ok_or_else(|| {
                    MCTSError::node_not_found(leaf_id)
                })?;
                MCTSNode::new_child(&leaf_ref, &action, new_state)
            };
            let child_id = child.id.clone();
            
            // Update parent's children map
            if let Some(mut parent) = self.nodes.get_mut(leaf_id) {
                parent.children.insert(action.id.clone(), child_id.clone());
            }
            
            self.nodes.insert(child_id.clone(), child);
            expanded_nodes.push(child_id);
        }
        
        // Mark leaf as expanded
        if let Some(mut leaf) = self.nodes.get_mut(leaf_id) {
            leaf.is_expanded = true;
        }
        
        debug!("Expanded {} children for node {}", expanded_nodes.len(), leaf_id);
        Ok(expanded_nodes)
    }
    
    /// Generate possible actions using agent selection
    async fn generate_actions(&mut self, state: &AgentContext, available_agents: &[String]) -> MCTSResult<Vec<MCTSAction>> {
        let mut actions = Vec::new();
        
        // Use Thompson sampling to select promising agents
        let selected_agents = if self.config.enable_thompson_sampling {
            let mut sampler = self.thompson_sampler.write().await;
            sampler.select_multiple_arms(self.config.parallel_simulations)?
        } else {
            // Simple round-robin selection
            available_agents.iter()
                .take(self.config.parallel_simulations)
                .cloned()
                .collect()
        };
        
        // Generate actions for selected agents
        for agent_name in selected_agents {
            let agent_type = self.infer_agent_type(&agent_name);
            
            // Get performance prediction if available
            let (confidence, estimated_cost, estimated_time) = 
                if self.config.enable_bayesian_learning {
                    let features = self.extract_features(state, &agent_name);
                    let model = self.performance_model.read().await;
                    
                    if let Ok(prediction) = model.predict_performance(&agent_name, &features) {
                        (
                            prediction.overall_performance.confidence,
                            prediction.cost_prediction.mean * 100.0,
                            (prediction.speed_prediction.mean * 10000.0) as u64,
                        )
                    } else {
                        (0.5, 10.0, 1000) // Default values
                    }
                } else {
                    (0.5, 10.0, 1000)
                };
            
            let action = MCTSAction {
                id: Uuid::new_v4().to_string(),
                agent_name: agent_name.clone(),
                agent_type,
                estimated_cost,
                estimated_time,
                required_capabilities: self.extract_required_capabilities(state),
                parameters: HashMap::new(),
                confidence,
            };
            
            actions.push(action);
        }
        
        if self.config.enable_thompson_sampling {
            self.search_stats.thompson_samples += actions.len() as u32;
        }
        
        trace!("Generated {} actions", actions.len());
        Ok(actions)
    }
    
    /// Simulation phase: estimate reward for a node
    async fn simulate(&self, node_id: &str, _available_agents: &[String]) -> MCTSResult<MCTSReward> {
        let node = self.nodes.get(node_id).ok_or_else(|| {
            MCTSError::node_not_found(node_id)
        })?;
        
        // Simple rollout simulation - in practice, this would be more sophisticated
        let quality = if let Some(agent_name) = &node.metadata.agent {
            // Use Bayesian prediction if available
            if self.config.enable_bayesian_learning {
                let features = self.extract_features(&node.state, agent_name);
                let model = self.performance_model.read().await;
                
                model.predict_performance(agent_name, &features)
                    .map(|pred| pred.quality_prediction.mean)
                    .unwrap_or(0.5)
            } else {
                // Simple heuristic based on agent type and context
                self.estimate_quality(&node.state, agent_name)
            }
        } else {
            0.5 // Default quality for root node
        };
        
        let speed = self.estimate_speed(&node.state);
        let cost = self.estimate_cost(&node.state);
        
        // Apply discount for depth
        let discount = self.config.discount_factor.powi(node.depth as i32);
        
        // Add exploration noise for better simulation diversity
        let noise = self.get_exploration_noise();
        let overall_reward = ((quality * 0.4 + speed * 0.3 + cost * 0.3) * discount + noise).clamp(0.0, 1.0);
        
        let reward = MCTSReward {
            value: overall_reward,
            components: RewardComponents {
                quality,
                speed,
                cost,
                user_satisfaction: None,
            },
            metadata: RewardMetadata {
                tokens_used: (100.0 * (1.0 - cost)) as u32,
                api_calls_made: 1,
                execution_time: Duration::from_millis((1000.0 * (1.0 - speed)) as u64),
                agent_performance: HashMap::new(),
                timestamp: std::time::SystemTime::now(),
            },
        };
        
        trace!("Simulated reward for node {}: {:.4}", node_id, reward.value);
        Ok(reward)
    }
    
    /// Batch simulation for multiple nodes
    async fn simulate_batch(&self, node_ids: &[String], available_agents: &[String]) -> MCTSResult<Vec<(String, MCTSReward)>> {
        let futures = node_ids.iter().map(|id| {
            let id = id.clone();
            let agents = available_agents.to_vec();
            async move {
                let reward = self.simulate(&id, &agents).await?;
                Ok::<(String, MCTSReward), MCTSError>((id, reward))
            }
        });
        
        let results = try_join_all(futures).await?;
        debug!("Completed batch simulation for {} nodes", results.len());
        Ok(results)
    }
    
    /// Backpropagation phase: update tree with simulation results
    async fn backpropagate(&self, leaf_id: &str, reward: f64) -> MCTSResult<u32> {
        let mut current_id = Some(leaf_id.to_string());
        let mut depth = 0;
        
        while let Some(node_id) = current_id {
            if let Some(mut node) = self.nodes.get_mut(&node_id) {
                node.update(reward);
                current_id = node.parent_id.clone();
                depth += 1;
                
                // Update Thompson sampling for the agent
                if let Some(agent_name) = &node.metadata.agent {
                    let mut sampler = self.thompson_sampler.write().await;
                    if let Err(e) = sampler.update_arm(agent_name, reward) {
                        warn!("Failed to update Thompson sampling for {}: {}", agent_name, e);
                    }
                }
            } else {
                break;
            }
        }
        
        trace!("Backpropagated reward {:.4} through {} nodes", reward, depth);
        Ok(depth)
    }
    
    /// Generate final search result
    async fn generate_result(&self, root_id: &str) -> MCTSResult<SearchResult> {
        let root = self.nodes.get(root_id).ok_or_else(|| {
            MCTSError::node_not_found(root_id)
        })?;
        
        // Find best path through the tree
        let best_path = self.extract_best_path(root_id)?;
        
        // Calculate confidence based on visit counts and uncertainty
        let confidence = self.calculate_confidence(root_id)?;
        
        // Generate agent recommendations
        let agent_recommendations = self.generate_agent_recommendations().await?;
        
        // Create execution plan
        let execution_plan = self.create_execution_plan(&best_path)?;
        
        let result = SearchResult {
            best_path,
            confidence,
            expected_reward: root.average_reward,
            search_statistics: self.search_stats.clone(),
            agent_recommendations,
            execution_plan,
        };
        
        debug!("Generated search result with {} steps, confidence {:.3}", 
               result.best_path.len(), confidence);
        
        Ok(result)
    }
    
    /// Check if search should continue
    fn should_continue(&self, iterations: u32, start_time: Instant, options: &SearchOptions) -> bool {
        iterations < self.config.max_iterations.min(options.max_iterations) &&
        start_time.elapsed() < self.config.time_limit.min(options.time_limit) &&
        self.nodes.len() < self.config.node_pool_size
    }
    
    /// Extract best path from root to most promising leaf
    fn extract_best_path(&self, root_id: &str) -> MCTSResult<Vec<MCTSAction>> {
        let mut path = Vec::new();
        let mut current_id = root_id.to_string();
        
        loop {
            let node = self.nodes.get(&current_id).ok_or_else(|| {
                MCTSError::node_not_found(&current_id)
            })?;
            
            if node.children.is_empty() {
                break;
            }
            
            // Find child with highest average reward
            let mut best_child_id = String::new();
            let mut best_reward = f64::NEG_INFINITY;
            
            for child_id in node.children.values() {
                if let Some(child) = self.nodes.get(child_id) {
                    if child.average_reward > best_reward {
                        best_reward = child.average_reward;
                        best_child_id = child_id.clone();
                    }
                }
            }
            
            if best_child_id.is_empty() {
                break;
            }
            
            // Create action from the transition
            if let Some(best_child) = self.nodes.get(&best_child_id) {
                if let (Some(agent), Some(action_id)) = (&best_child.metadata.agent, &best_child.metadata.action) {
                    let action = MCTSAction {
                        id: action_id.clone(),
                        agent_name: agent.clone(),
                        agent_type: self.infer_agent_type(agent),
                        estimated_cost: 10.0, // Would be filled from actual action
                        estimated_time: 1000,
                        required_capabilities: Vec::new(),
                        parameters: HashMap::new(),
                        confidence: best_child.average_reward,
                    };
                    path.push(action);
                }
            }
            
            current_id = best_child_id;
        }
        
        Ok(path)
    }
    
    /// Calculate overall confidence in the search result
    fn calculate_confidence(&self, root_id: &str) -> MCTSResult<f64> {
        let root = self.nodes.get(root_id).ok_or_else(|| {
            MCTSError::node_not_found(root_id)
        })?;
        
        if root.visits == 0 {
            return Ok(0.0);
        }
        
        // Confidence based on exploration completeness and visit distribution
        let total_visits = root.visits as f64;
        let mut entropy = 0.0;
        let mut max_child_visits = 0;
        
        for child_id in root.children.values() {
            if let Some(child) = self.nodes.get(child_id) {
                let p = child.visits as f64 / total_visits;
                if p > 0.0 {
                    entropy -= p * p.ln();
                }
                max_child_visits = max_child_visits.max(child.visits);
            }
        }
        
        // Normalize entropy and combine with visit count confidence
        let exploration_confidence = if root.children.is_empty() { 1.0 } else { 
            1.0 - entropy / (root.children.len() as f64).ln() 
        };
        let visit_confidence = (total_visits / (total_visits + 10.0)).min(1.0);
        
        Ok((exploration_confidence * 0.6 + visit_confidence * 0.4).clamp(0.0, 1.0))
    }
    
    // Helper methods for feature extraction and estimation
    fn extract_features(&self, state: &AgentContext, agent_name: &str) -> DVector<f64> {
        // Extract numerical features for Bayesian models
        let features = vec![
            self.estimate_agent_experience(agent_name),
            self.estimate_task_complexity(&state.task),
            self.estimate_context_similarity(state),
            0.5, // recent_performance placeholder
            0.8, // resource_availability placeholder
            self.estimate_time_pressure(state),
        ];
        
        DVector::from_vec(features)
    }
    
    fn infer_agent_type(&self, agent_name: &str) -> AgentType {
        // Simple heuristic based on agent name
        if agent_name.contains("planner") {
            AgentType::Planner
        } else if agent_name.contains("retriever") {
            AgentType::Retriever
        } else if agent_name.contains("synthesizer") {
            AgentType::Synthesizer
        } else if agent_name.contains("personal") {
            AgentType::PersonalAssistant
        } else if agent_name.contains("code") {
            AgentType::CodeAssistant
        } else {
            AgentType::Specialized(agent_name.to_string())
        }
    }
    
    // Placeholder implementations for estimation functions
    fn estimate_quality(&self, _state: &AgentContext, _agent: &str) -> f64 { 0.7 }
    fn estimate_speed(&self, _state: &AgentContext) -> f64 { 0.8 }
    fn estimate_cost(&self, _state: &AgentContext) -> f64 { 0.6 }
    fn estimate_agent_experience(&self, _agent: &str) -> f64 { 0.5 }
    fn estimate_task_complexity(&self, _task: &str) -> f64 { 0.6 }
    fn estimate_context_similarity(&self, _state: &AgentContext) -> f64 { 0.7 }
    fn estimate_time_pressure(&self, _state: &AgentContext) -> f64 { 0.4 }
    
    fn extract_required_capabilities(&self, _state: &AgentContext) -> Vec<String> {
        vec!["general".to_string()]
    }
    
    fn apply_action(&self, state: &AgentContext, _action: &MCTSAction) -> MCTSResult<AgentContext> {
        // Create new state after applying action
        let mut new_state = state.clone();
        new_state.execution_context.budget -= 10.0; // Reduce budget
        Ok(new_state)
    }
    
    async fn generate_agent_recommendations(&self) -> MCTSResult<Vec<AgentRecommendation>> {
        let sampler = self.thompson_sampler.read().await;
        let stats = sampler.get_all_stats()?;
        
        let mut recommendations = Vec::new();
        for stat in stats.into_iter().take(5) { // Top 5 agents
            recommendations.push(AgentRecommendation {
                agent_name: stat.arm_name.clone(),
                agent_type: self.infer_agent_type(&stat.arm_name),
                confidence: stat.credible_interval.0.max(0.0),
                expected_performance: stat.mean,
                estimated_cost: 10.0 + stat.mean * 20.0,
                rationale: format!("Based on {} samples, mean performance {:.3}", 
                                 stat.samples_count, stat.mean),
            });
        }
        
        Ok(recommendations)
    }
    
    fn create_execution_plan(&self, actions: &[MCTSAction]) -> MCTSResult<ExecutionPlan> {
        let steps: Vec<ExecutionStep> = actions.iter().enumerate().map(|(i, action)| {
            ExecutionStep {
                step_number: i as u32 + 1,
                action: action.clone(),
                dependencies: if i == 0 { vec![] } else { vec![i as u32] },
                parallel_execution: false,
                timeout: Duration::from_millis(action.estimated_time),
                retry_policy: RetryPolicy {
                    max_retries: 3,
                    backoff_strategy: BackoffStrategy::Exponential(
                        Duration::from_millis(100), 2.0
                    ),
                    retry_conditions: vec!["timeout".to_string(), "error".to_string()],
                },
            }
        }).collect();
        
        let total_estimated_time: Duration = actions.iter()
            .map(|a| Duration::from_millis(a.estimated_time))
            .sum();
        
        let total_estimated_cost: f64 = actions.iter()
            .map(|a| a.estimated_cost)
            .sum();
        
        Ok(ExecutionPlan {
            steps,
            total_estimated_time,
            total_estimated_cost,
            risk_assessment: RiskAssessment {
                overall_risk: 0.3, // Medium risk
                risk_factors: vec![],
                mitigation_strategies: vec![],
            },
            fallback_options: Vec::new(),
        })
    }
    
    async fn checkpoint(&self, session_id: &str) -> MCTSResult<()> {
        if let Some(cache) = &self.cache {
            let nodes: HashMap<String, MCTSNode> = self.nodes.iter()
                .map(|entry| (entry.key().clone(), entry.value().clone()))
                .collect();
            
            let root_node = nodes.values().find(|n| n.parent_id.is_none())
                .ok_or_else(|| MCTSError::node_not_found("root"))?
                .clone();
            
            let mut cache_guard = cache.write().await;
            cache_guard.store_tree(session_id, &root_node, nodes, self.search_stats.clone()).await?;
            
            debug!("Checkpointed search state for session {}", session_id);
        }
        Ok(())
    }
    
    async fn try_get_cached_result(&self, session_id: &str) -> MCTSResult<Option<SearchResult>> {
        if let Some(cache) = &self.cache {
            let mut cache_guard = cache.write().await;
            return cache_guard.get_search_result(session_id).await;
        }
        Ok(None)
    }
    
    async fn get_cached_agent_stats(&self, _agent_name: &str) -> MCTSResult<Option<ArmStatistics>> {
        // Placeholder for loading cached agent performance data
        Ok(None)
    }
    
    /// Reseed the internal RNG for deterministic testing
    /// This is useful for reproducible test runs and debugging
    pub fn reseed_rng(&mut self, seed: u64) {
        self.rng = StdRng::seed_from_u64(seed);
        debug!("Reseeded MCTS engine RNG with seed: {}", seed);
    }
    
    /// Generate random exploration noise for simulation diversity
    /// Used internally to add stochasticity to reward estimations
    fn get_exploration_noise(&self) -> f64 {
        // Since we can't mutate self in most methods, we'll create a thread-local RNG
        // The main RNG is primarily for testing/deterministic scenarios
        use rand::thread_rng;
        let mut rng = thread_rng();
        rng.gen_range(-0.1..0.1) // Small noise factor
    }
    
    /// Check if engine is configured for deterministic behavior
    pub fn is_deterministic(&self) -> bool {
        // We consider the engine deterministic if specific seeds are used
        // This can be extended with a config flag in the future
        false // Default to non-deterministic for better exploration
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_engine_creation() {
        let config = MCTSConfig::default();
        let engine = MCTSEngine::new(config).await;
        assert!(engine.is_ok());
    }
    
    #[tokio::test]
    async fn test_basic_search() {
        let config = MCTSConfig {
            max_iterations: 10,
            time_limit: Duration::from_secs(1),
            enable_caching: false,
            ..Default::default()
        };
        
        let mut engine = MCTSEngine::new(config).await.unwrap();
        
        let context = AgentContext {
            task: "test task".to_string(),
            requirements: vec!["req1".to_string()],
            constraints: vec![],
            context_data: HashMap::new(),
            user_preferences: None,
            execution_context: ExecutionContext {
                session_id: "test_session".to_string(),
                user_id: None,
                timestamp: std::time::SystemTime::now(),
                budget: 100.0,
                priority: Priority::Normal,
            },
        };
        
        let agents = vec!["agent1".to_string(), "agent2".to_string()];
        let options = SearchOptions::default();
        
        let result = engine.search(context, agents, options).await;
        assert!(result.is_ok());
        
        let search_result = result.unwrap();
        assert!(search_result.confidence >= 0.0 && search_result.confidence <= 1.0);
        assert!(!search_result.agent_recommendations.is_empty());
    }
    
    #[test]
    fn test_feature_extraction() {
        let engine = MCTSEngine {
            config: MCTSConfig::default(),
            nodes: Arc::new(DashMap::new()),
            thompson_sampler: Arc::new(RwLock::new(ThompsonSampler::new())),
            performance_model: Arc::new(RwLock::new(
                AgentPerformanceModel::new().unwrap()
            )),
            cache: None,
            search_stats: SearchStatistics::default(),
            rng: StdRng::from_entropy(),
        };
        
        let context = AgentContext {
            task: "complex analysis task".to_string(),
            requirements: vec![],
            constraints: vec![],
            context_data: HashMap::new(),
            user_preferences: None,
            execution_context: ExecutionContext {
                session_id: "test".to_string(),
                user_id: None,
                timestamp: std::time::SystemTime::now(),
                budget: 100.0,
                priority: Priority::High,
            },
        };
        
        let features = engine.extract_features(&context, "test_agent");
        assert_eq!(features.len(), 6);
        assert!(features.iter().all(|&f| f >= 0.0 && f <= 1.0));
    }
}