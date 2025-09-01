//! Core data types for the AB-MCTS service
//! 
//! Defines the fundamental data structures used throughout the Monte Carlo Tree Search
//! implementation, including nodes, actions, rewards, and configuration types.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use uuid::Uuid;

/// Agent context information for MCTS operations
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentContext {
    pub task: String,
    pub requirements: Vec<String>,
    pub constraints: Vec<String>,
    pub context_data: HashMap<String, serde_json::Value>,
    pub user_preferences: Option<UserPreferences>,
    pub execution_context: ExecutionContext,
}

/// User preferences for agent selection
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserPreferences {
    pub preferred_agents: Vec<String>,
    pub quality_vs_speed: f64, // 0.0 = speed, 1.0 = quality
    pub max_cost: Option<f64>,
    pub timeout: Option<Duration>,
}

/// Execution context for the search
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub session_id: String,
    pub user_id: Option<String>,
    pub timestamp: SystemTime,
    pub budget: f64,
    pub priority: Priority,
}

/// Task priority levels
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Priority {
    Low,
    Normal,
    High,
    Critical,
}

/// Agent type classification
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AgentType {
    Planner,
    Retriever,
    Synthesizer,
    PersonalAssistant,
    CodeAssistant,
    Specialized(String),
}

/// MCTS node representing a state in the search tree
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MCTSNode {
    pub id: String,
    pub state: AgentContext,
    pub visits: u32,
    pub total_reward: f64,
    pub average_reward: f64,
    pub ucb_score: f64,
    pub thompson_sample: f64,
    pub prior_alpha: f64,
    pub prior_beta: f64,
    pub children: HashMap<String, String>, // action_id -> child_node_id
    pub parent_id: Option<String>,
    pub depth: u32,
    pub is_terminal: bool,
    pub is_expanded: bool,
    pub metadata: NodeMetadata,
}

/// Node metadata for additional information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NodeMetadata {
    pub agent: Option<String>,
    pub action: Option<String>,
    pub timestamp: u64,
    pub confidence_interval: (f64, f64),
    pub execution_time: Option<Duration>,
    pub resource_usage: Option<ResourceUsage>,
}

/// Resource usage tracking
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub tokens_used: u32,
    pub api_calls: u32,
    pub execution_time_ms: u64,
    pub memory_mb: f64,
}

/// Action that can be taken from a node
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MCTSAction {
    pub id: String,
    pub agent_name: String,
    pub agent_type: AgentType,
    pub estimated_cost: f64,
    pub estimated_time: u64, // milliseconds
    pub required_capabilities: Vec<String>,
    pub parameters: HashMap<String, serde_json::Value>,
    pub confidence: f64, // 0.0 to 1.0
}

/// Reward structure for MCTS backpropagation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MCTSReward {
    pub value: f64, // Normalized reward 0.0 to 1.0
    pub components: RewardComponents,
    pub metadata: RewardMetadata,
}

/// Components of the reward calculation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RewardComponents {
    pub quality: f64,        // Task completion quality
    pub speed: f64,          // Execution speed reward
    pub cost: f64,           // Cost efficiency
    pub user_satisfaction: Option<f64>, // User feedback if available
}

/// Metadata about reward calculation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RewardMetadata {
    pub tokens_used: u32,
    pub api_calls_made: u32,
    pub execution_time: Duration,
    pub agent_performance: HashMap<String, f64>,
    pub timestamp: SystemTime,
}

/// Search configuration options
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    pub max_iterations: u32,
    pub max_depth: u32,
    pub time_limit: Duration,
    pub exploration_constant: f64, // UCB1 exploration parameter
    pub discount_factor: f64,      // Future reward discount
    pub parallel_simulations: usize,
    pub checkpoint_interval: u32,
    pub enable_caching: bool,
    pub verbose_logging: bool,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            max_iterations: 1000,
            max_depth: 10,
            time_limit: Duration::from_secs(30),
            exploration_constant: std::f64::consts::SQRT_2,
            discount_factor: 0.95,
            parallel_simulations: 4,
            checkpoint_interval: 100,
            enable_caching: true,
            verbose_logging: false,
        }
    }
}

/// Result of a complete MCTS search
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub best_path: Vec<MCTSAction>,
    pub confidence: f64,
    pub expected_reward: f64,
    pub search_statistics: SearchStatistics,
    pub agent_recommendations: Vec<AgentRecommendation>,
    pub execution_plan: ExecutionPlan,
}

/// Statistics from the search process
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SearchStatistics {
    pub total_iterations: u32,
    pub nodes_explored: u32,
    pub average_depth: f64,
    pub search_time: Duration,
    pub cache_hits: u32,
    pub cache_misses: u32,
    pub thompson_samples: u32,
    pub ucb_selections: u32,
}

impl Default for SearchStatistics {
    fn default() -> Self {
        Self {
            total_iterations: 0,
            nodes_explored: 0,
            average_depth: 0.0,
            search_time: Duration::default(),
            cache_hits: 0,
            cache_misses: 0,
            thompson_samples: 0,
            ucb_selections: 0,
        }
    }
}

/// Agent recommendation with rationale
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentRecommendation {
    pub agent_name: String,
    pub agent_type: AgentType,
    pub confidence: f64,
    pub expected_performance: f64,
    pub estimated_cost: f64,
    pub rationale: String,
}

/// Execution plan derived from search results
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub steps: Vec<ExecutionStep>,
    pub total_estimated_time: Duration,
    pub total_estimated_cost: f64,
    pub risk_assessment: RiskAssessment,
    pub fallback_options: Vec<MCTSAction>,
}

/// Individual step in execution plan
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionStep {
    pub step_number: u32,
    pub action: MCTSAction,
    pub dependencies: Vec<u32>, // step numbers this depends on
    pub parallel_execution: bool,
    pub timeout: Duration,
    pub retry_policy: RetryPolicy,
}

/// Risk assessment for the execution plan
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub overall_risk: f64, // 0.0 = low risk, 1.0 = high risk
    pub risk_factors: Vec<RiskFactor>,
    pub mitigation_strategies: Vec<String>,
}

/// Individual risk factor
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RiskFactor {
    pub factor_type: String,
    pub severity: f64, // 0.0 to 1.0
    pub probability: f64, // 0.0 to 1.0
    pub description: String,
}

/// Retry policy for failed actions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_retries: u32,
    pub backoff_strategy: BackoffStrategy,
    pub retry_conditions: Vec<String>,
}

/// Backoff strategy for retries
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum BackoffStrategy {
    Linear(Duration),
    Exponential(Duration, f64), // base_delay, multiplier
    Fixed(Duration),
}

impl MCTSNode {
    /// Create a new root node
    pub fn new_root(state: AgentContext) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            state,
            visits: 0,
            total_reward: 0.0,
            average_reward: 0.0,
            ucb_score: f64::INFINITY,
            thompson_sample: 0.0,
            prior_alpha: 1.0,
            prior_beta: 1.0,
            children: HashMap::new(),
            parent_id: None,
            depth: 0,
            is_terminal: false,
            is_expanded: false,
            metadata: NodeMetadata {
                agent: None,
                action: None,
                timestamp: SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
                confidence_interval: (0.0, 1.0),
                execution_time: None,
                resource_usage: None,
            },
        }
    }
    
    /// Create a child node
    pub fn new_child(parent: &Self, action: &MCTSAction, new_state: AgentContext) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            state: new_state,
            visits: 0,
            total_reward: 0.0,
            average_reward: 0.0,
            ucb_score: f64::INFINITY,
            thompson_sample: 0.0,
            prior_alpha: 1.0,
            prior_beta: 1.0,
            children: HashMap::new(),
            parent_id: Some(parent.id.clone()),
            depth: parent.depth + 1,
            is_terminal: false,
            is_expanded: false,
            metadata: NodeMetadata {
                agent: Some(action.agent_name.clone()),
                action: Some(action.id.clone()),
                timestamp: SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
                confidence_interval: (0.0, 1.0),
                execution_time: None,
                resource_usage: None,
            },
        }
    }
    
    /// Update node with new reward
    pub fn update(&mut self, reward: f64) {
        self.visits += 1;
        self.total_reward += reward;
        self.average_reward = self.total_reward / self.visits as f64;
        
        // Update Beta distribution parameters for Thompson Sampling
        if reward > 0.5 {
            self.prior_alpha += 1.0;
        } else {
            self.prior_beta += 1.0;
        }
        
        // Update confidence interval using Wilson score interval
        let n = self.visits as f64;
        let p = self.average_reward;
        let z = 1.96; // 95% confidence interval
        
        let denominator = 1.0 + z * z / n;
        let centre = (p + z * z / (2.0 * n)) / denominator;
        let half_width = z * (p * (1.0 - p) / n + z * z / (4.0 * n * n)).sqrt() / denominator;
        
        self.metadata.confidence_interval = (
            (centre - half_width).max(0.0),
            (centre + half_width).min(1.0),
        );
    }
    
    /// Check if node is fully expanded
    pub fn is_fully_expanded(&self, available_actions: &[MCTSAction]) -> bool {
        self.is_expanded && self.children.len() >= available_actions.len()
    }
    
    /// Get the most promising child for selection
    pub fn select_child(&self, _exploration_constant: f64) -> Option<&str> {
        let mut best_child = None;
        
        for child_id in self.children.values() {
            // UCB calculation would be done with child node data
            // For now, return the first child as placeholder
            if best_child.is_none() {
                best_child = Some(child_id.as_str());
                break;
            }
        }
        
        best_child
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_node_creation() {
        let context = AgentContext {
            task: "test task".to_string(),
            requirements: vec!["requirement1".to_string()],
            constraints: vec!["constraint1".to_string()],
            context_data: HashMap::new(),
            user_preferences: None,
            execution_context: ExecutionContext {
                session_id: "test_session".to_string(),
                user_id: None,
                timestamp: SystemTime::now(),
                budget: 100.0,
                priority: Priority::Normal,
            },
        };
        
        let root = MCTSNode::new_root(context.clone());
        assert_eq!(root.depth, 0);
        assert_eq!(root.visits, 0);
        assert!(root.parent_id.is_none());
        assert!(!root.is_terminal);
        assert!(!root.is_expanded);
        
        let action = MCTSAction {
            id: "test_action".to_string(),
            agent_name: "test_agent".to_string(),
            agent_type: AgentType::Planner,
            estimated_cost: 10.0,
            estimated_time: 1000,
            required_capabilities: vec!["planning".to_string()],
            parameters: HashMap::new(),
            confidence: 0.8,
        };
        
        let child = MCTSNode::new_child(&root, &action, context);
        assert_eq!(child.depth, 1);
        assert_eq!(child.parent_id, Some(root.id.clone()));
        assert_eq!(child.metadata.agent, Some("test_agent".to_string()));
    }
    
    #[test]
    fn test_node_update() {
        let context = AgentContext {
            task: "test task".to_string(),
            requirements: vec![],
            constraints: vec![],
            context_data: HashMap::new(),
            user_preferences: None,
            execution_context: ExecutionContext {
                session_id: "test_session".to_string(),
                user_id: None,
                timestamp: SystemTime::now(),
                budget: 100.0,
                priority: Priority::Normal,
            },
        };
        
        let mut node = MCTSNode::new_root(context);
        
        // Test reward updates
        node.update(0.8);
        assert_eq!(node.visits, 1);
        assert_eq!(node.total_reward, 0.8);
        assert_eq!(node.average_reward, 0.8);
        assert_eq!(node.prior_alpha, 2.0); // Should increment for reward > 0.5
        
        node.update(0.3);
        assert_eq!(node.visits, 2);
        assert_eq!(node.total_reward, 1.1);
        assert_eq!(node.average_reward, 0.55);
        assert_eq!(node.prior_beta, 2.0); // Should increment for reward <= 0.5
        
        // Check confidence interval is reasonable
        let (lower, upper) = node.metadata.confidence_interval;
        assert!(lower >= 0.0 && lower <= 1.0);
        assert!(upper >= 0.0 && upper <= 1.0);
        assert!(lower <= upper);
    }
    
    #[test]
    fn test_search_options_default() {
        let options = SearchOptions::default();
        assert_eq!(options.max_iterations, 1000);
        assert_eq!(options.max_depth, 10);
        assert_eq!(options.exploration_constant, std::f64::consts::SQRT_2);
        assert_eq!(options.discount_factor, 0.95);
        assert_eq!(options.parallel_simulations, 4);
        assert!(options.enable_caching);
        assert!(!options.verbose_logging);
    }
}