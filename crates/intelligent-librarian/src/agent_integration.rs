//! Agent integration for unlimited context across the agent ecosystem

use crate::models::*;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};
use uuid::Uuid;
use tokio::sync::RwLock;
use std::sync::Arc;

/// Agent integration for unlimited context traversal
pub struct AgentIntegration {
    agent_registry: Arc<RwLock<HashMap<Uuid, AgentInfo>>>,
    context_router: Arc<RwLock<ContextRouter>>,
    token_manager: Arc<RwLock<TokenManager>>,
    message_broker: Arc<RwLock<MessageBroker>>,
}

/// Agent information for context routing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: Uuid,
    pub name: String,
    pub agent_type: AgentType,
    pub capabilities: Vec<String>,
    pub context_endpoint: String,
    pub max_context_tokens: usize,
    pub current_context_tokens: usize,
    pub status: AgentStatus,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

/// Agent types from your system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentType {
    Coordinator,
    Worker,
    Specialist,
    Monitor,
    Optimizer,
    Learner,
    Hybrid,
    Librarian, // Our librarian agent
}

/// Agent status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentStatus {
    Available,
    Busy,
    Collaborating,
    Learning,
    Offline,
}

/// Context router for intelligent agent traversal
pub struct ContextRouter {
    routing_strategy: RoutingStrategy,
    context_cache: HashMap<String, CachedContext>,
    traversal_history: Vec<ContextTraversal>,
}

/// Routing strategies for context traversal
#[derive(Debug, Clone)]
pub enum RoutingStrategy {
    Semantic,      // Route based on semantic similarity
    Capability,    // Route based on agent capabilities
    LoadBalanced,  // Route based on agent load
    Collaborative, // Route for multi-agent collaboration
}

/// Cached context for performance
#[derive(Debug, Clone)]
pub struct CachedContext {
    pub context: String,
    pub tokens_used: usize,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub ttl_seconds: u64,
}

/// Context traversal record
#[derive(Debug, Clone)]
pub struct ContextTraversal {
    pub query: String,
    pub agents_visited: Vec<Uuid>,
    pub total_tokens: usize,
    pub traversal_time_ms: u64,
    pub success: bool,
}

/// Token manager for intelligent token usage
pub struct TokenManager {
    total_budget: usize,
    used_tokens: usize,
    agent_allocations: HashMap<Uuid, usize>,
    token_policies: Vec<TokenPolicy>,
}

/// Token usage policy
#[derive(Debug, Clone)]
pub struct TokenPolicy {
    pub agent_type: AgentType,
    pub max_tokens_per_request: usize,
    pub priority_weight: f64,
    pub burst_limit: usize,
}

/// Message broker for agent communication
pub struct MessageBroker {
    subscriptions: HashMap<String, Vec<Uuid>>,
    message_queue: Vec<AgentMessage>,
}

/// Agent message for context sharing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: Uuid,
    pub message_type: AgentMessageType,
    pub sender_id: Uuid,
    pub recipient_ids: Vec<Uuid>,
    pub content: String,
    pub context_data: Option<ContextData>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Agent message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentMessageType {
    ContextRequest,
    ContextResponse,
    ContextShare,
    CollaborationRequest,
    StatusUpdate,
}

/// Context data for sharing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextData {
    pub query: String,
    pub relevant_documents: Vec<DocumentId>,
    pub context_summary: String,
    pub tokens_used: usize,
    pub quality_score: f64,
}

impl AgentIntegration {
    pub async fn new() -> Result<Self> {
        let integration = Self {
            agent_registry: Arc::new(RwLock::new(HashMap::new())),
            context_router: Arc::new(RwLock::new(ContextRouter::new())),
            token_manager: Arc::new(RwLock::new(TokenManager::new())),
            message_broker: Arc::new(RwLock::new(MessageBroker::new())),
        };

        // Initialize with default agents
        integration.initialize_default_agents().await?;
        integration.initialize_token_policies().await?;

        Ok(integration)
    }

    /// Traverse context across agents with unlimited retrieval but token limits
    pub async fn traverse_context_across_agents(
        &self,
        query: &str,
        max_tokens: usize,
        target_agents: Option<Vec<Uuid>>,
    ) -> Result<AgentContextResult> {
        let start_time = std::time::Instant::now();
        let mut total_tokens_used = 0;
        let mut agents_visited = Vec::new();
        let mut context_parts = Vec::new();
        let mut errors = Vec::new();

        info!("Starting unlimited context traversal across agents for query: {}", query);

        // Get available agents
        let available_agents = if let Some(targets) = target_agents {
            self.filter_available_agents(targets).await?
        } else {
            self.get_available_agents().await?.into_iter().map(|agent| agent.id).collect()
        };

        // Route query to most relevant agents
        let routed_agents = self.route_query_to_agents(query, &available_agents, max_tokens).await?;

        // Traverse agents in parallel for unlimited context
        let mut tasks = Vec::new();
        for agent_id in routed_agents {
            let _agent_info = self.get_agent_info(agent_id).await?;
            let remaining_tokens = max_tokens - total_tokens_used;

            if remaining_tokens <= 0 {
                warn!("Token budget exhausted, stopping traversal");
                break;
            }

            let task = self.get_context_from_agent(agent_id, query, remaining_tokens);
            tasks.push(task);
        }

        // Execute all agent requests in parallel
        let results = futures::future::join_all(tasks).await;

        // Process results and build unlimited context
        for result in results {
            match result {
                Ok(agent_context) => {
                    total_tokens_used += agent_context.tokens_used;
                    agents_visited.push(agent_context.agent_id);
                    context_parts.push(agent_context);
                }
                Err(e) => {
                    errors.push(e.to_string());
                }
            }
        }

        // Combine all context parts into unlimited context
        let unlimited_context = self.combine_context_parts(&context_parts).await?;

        // Record traversal
        let traversal = ContextTraversal {
            query: query.to_string(),
            agents_visited: agents_visited.clone(),
            total_tokens: total_tokens_used,
            traversal_time_ms: start_time.elapsed().as_millis() as u64,
            success: errors.is_empty(),
        };

        self.record_traversal(traversal).await?;

        info!("Context traversal completed: {} agents, {} tokens, {}ms",
              agents_visited.len(), total_tokens_used, start_time.elapsed().as_millis());

        Ok(AgentContextResult {
            unlimited_context,
            agents_visited,
            total_tokens_used,
            traversal_time_ms: start_time.elapsed().as_millis() as u64,
            errors,
            quality_score: self.calculate_context_quality(&context_parts).await?,
        })
    }

    /// Get context from a specific agent with token limits
    pub async fn get_context_from_agent(
        &self,
        agent_id: Uuid,
        query: &str,
        max_tokens: usize,
    ) -> Result<AgentContext> {
        let agent_info = self.get_agent_info(agent_id).await?;

        // Check token budget
        let available_tokens = self.check_token_budget(agent_id, max_tokens).await?;

        if available_tokens <= 0 {
            return Err(anyhow::anyhow!("No token budget available for agent {}", agent_id));
        }

        // Request context from agent
        let context_request = ContextRequest {
            query: query.to_string(),
            max_tokens: available_tokens,
            include_metadata: true,
            quality_threshold: 0.7,
        };

        let response = self.send_context_request(agent_id, context_request).await?;

        Ok(AgentContext {
            agent_id,
            agent_name: agent_info.name,
            context: response.context,
            tokens_used: response.tokens_used,
            quality_score: response.quality_score,
            relevant_documents: response.relevant_documents,
            timestamp: chrono::Utc::now(),
        })
    }

    /// Route query to most relevant agents
    async fn route_query_to_agents(
        &self,
        query: &str,
        available_agents: &[Uuid],
        max_tokens: usize,
    ) -> Result<Vec<Uuid>> {
        let mut agent_scores = Vec::new();

        for &agent_id in available_agents {
        let agent_info = self.get_agent_info(agent_id).await?;
        let relevance_score = self.calculate_agent_relevance(query, &agent_info).await?;

            agent_scores.push((agent_id, relevance_score));
        }

        // Sort by relevance and select top agents
        agent_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Select agents based on token budget
        let mut selected_agents = Vec::new();
        let mut remaining_tokens = max_tokens;

        for (agent_id, _score) in agent_scores {
            let agent_info = self.get_agent_info(agent_id).await?;
            let agent_tokens = agent_info.max_context_tokens.min(remaining_tokens);

            if agent_tokens > 0 {
                selected_agents.push(agent_id);
                remaining_tokens -= agent_tokens;

                if remaining_tokens <= 0 {
                    break;
                }
            }
        }

        info!("Routed query to {} agents with {} total tokens",
              selected_agents.len(), max_tokens - remaining_tokens);

        Ok(selected_agents)
    }

    /// Send context request to agent
    async fn send_context_request(
        &self,
        agent_id: Uuid,
        request: ContextRequest,
    ) -> Result<ContextResponse> {
        // Create message for agent
        let message = AgentMessage {
            id: Uuid::new_v4(),
            message_type: AgentMessageType::ContextRequest,
            sender_id: Uuid::new_v4(), // Librarian ID
            recipient_ids: vec![agent_id],
            content: format!("{{\"query\":\"{}\",\"max_tokens\":{}}}", request.query, request.max_tokens),
            context_data: None,
            timestamp: chrono::Utc::now(),
        };

        // Send message through broker
        self.send_message(message).await?;

        // Wait for response (in real implementation, this would be async)
        // For now, simulate agent response
        let response = self.simulate_agent_response(agent_id, &request).await?;

        Ok(response)
    }

    /// Simulate agent response (placeholder for real agent communication)
    async fn simulate_agent_response(
        &self,
        agent_id: Uuid,
        request: &ContextRequest,
    ) -> Result<ContextResponse> {
        // In real implementation, this would communicate with actual agents
        // For now, simulate based on agent type
        let agent_info = self.get_agent_info(agent_id).await?;

        let context = match agent_info.agent_type {
            AgentType::Coordinator => {
                format!("Coordinator context for: {}", request.query)
            }
            AgentType::Worker => {
                format!("Worker execution context for: {}", request.query)
            }
            AgentType::Specialist => {
                format!("Specialist domain context for: {}", request.query)
            }
            AgentType::Monitor => {
                format!("System monitoring context for: {}", request.query)
            }
            AgentType::Optimizer => {
                format!("Performance optimization context for: {}", request.query)
            }
            AgentType::Learner => {
                format!("Learning and adaptation context for: {}", request.query)
            }
            AgentType::Hybrid => {
                format!("Multi-capability context for: {}", request.query)
            }
            AgentType::Librarian => {
                format!("Librarian knowledge context for: {}", request.query)
            }
        };

        Ok(ContextResponse {
            context,
            tokens_used: request.max_tokens.min(1000), // Simulate token usage
            quality_score: 0.8,
            relevant_documents: Vec::new(),
            agent_capabilities_used: vec!["context_retrieval".to_string()],
        })
    }

    /// Combine context parts into unlimited context
    async fn combine_context_parts(&self, parts: &[AgentContext]) -> Result<String> {
        let mut combined = String::new();

        for (i, part) in parts.iter().enumerate() {
            combined.push_str(&format!("\n\n--- Context from {} (Agent: {}) ---\n",
                                     part.agent_name, part.agent_id));
            combined.push_str(&part.context);

            if i < parts.len() - 1 {
                combined.push_str("\n\n--- End of Agent Context ---");
            }
        }

        info!("Combined context from {} agents: {} characters",
              parts.len(), combined.len());

        Ok(combined)
    }

    /// Calculate agent relevance to query
    async fn calculate_agent_relevance(&self, query: &str, agent_info: &AgentInfo) -> Result<f64> {
        // Simple relevance calculation based on capabilities
        let query_lower = query.to_lowercase();
        let mut relevance: f32 = 0.0;

        for capability in &agent_info.capabilities {
            if query_lower.contains(&capability.to_lowercase()) {
                relevance += 0.3;
            }
        }

        // Boost relevance for certain agent types
        match agent_info.agent_type {
            AgentType::Coordinator => relevance += 0.2,
            AgentType::Specialist => relevance += 0.3,
            AgentType::Librarian => relevance += 0.4,
            _ => {}
        }

        Ok(relevance.min(1.0) as f64)
    }

    /// Check token budget for agent
    async fn check_token_budget(&self, agent_id: Uuid, requested_tokens: usize) -> Result<usize> {
        let token_manager = self.token_manager.read().await;
        let agent_info = self.get_agent_info(agent_id).await?;

        let available_tokens = agent_info.max_context_tokens - agent_info.current_context_tokens;
        let budget_tokens = token_manager.get_agent_budget(agent_id).await?;

        Ok(available_tokens.min(budget_tokens).min(requested_tokens))
    }

    /// Initialize default agents
    async fn initialize_default_agents(&self) -> Result<()> {
        let mut registry = self.agent_registry.write().await;

        // Add librarian agent
        let librarian_id = Uuid::new_v4();
        registry.insert(librarian_id, AgentInfo {
            id: librarian_id,
            name: "Intelligent Librarian".to_string(),
            agent_type: AgentType::Librarian,
            capabilities: vec![
                "document_retrieval".to_string(),
                "semantic_search".to_string(),
                "knowledge_graph".to_string(),
                "context_building".to_string(),
            ],
            context_endpoint: "http://localhost:3035".to_string(),
            max_context_tokens: 100000,
            current_context_tokens: 0,
            status: AgentStatus::Available,
            last_activity: chrono::Utc::now(),
        });

        // Add LLM Router agent
        let llm_router_id = Uuid::new_v4();
        registry.insert(llm_router_id, AgentInfo {
            id: llm_router_id,
            name: "LLM Router Agent".to_string(),
            agent_type: AgentType::Coordinator,
            capabilities: vec![
                "llm_routing".to_string(),
                "model_selection".to_string(),
                "load_balancing".to_string(),
            ],
            context_endpoint: "http://localhost:3033".to_string(),
            max_context_tokens: 50000,
            current_context_tokens: 0,
            status: AgentStatus::Available,
            last_activity: chrono::Utc::now(),
        });

        // Add Assistant Agent
        let assistant_id = Uuid::new_v4();
        registry.insert(assistant_id, AgentInfo {
            id: assistant_id,
            name: "Assistant Agent".to_string(),
            agent_type: AgentType::Specialist,
            capabilities: vec![
                "conversation".to_string(),
                "task_execution".to_string(),
                "context_understanding".to_string(),
            ],
            context_endpoint: "http://localhost:3034".to_string(),
            max_context_tokens: 30000,
            current_context_tokens: 0,
            status: AgentStatus::Available,
            last_activity: chrono::Utc::now(),
        });

        info!("Initialized {} default agents", registry.len());
        Ok(())
    }

    /// Initialize token policies
    async fn initialize_token_policies(&self) -> Result<()> {
        let mut token_manager = self.token_manager.write().await;

        token_manager.token_policies.extend(vec![
            TokenPolicy {
                agent_type: AgentType::Librarian,
                max_tokens_per_request: 50000,
                priority_weight: 1.0,
                burst_limit: 100000,
            },
            TokenPolicy {
                agent_type: AgentType::Coordinator,
                max_tokens_per_request: 30000,
                priority_weight: 0.9,
                burst_limit: 60000,
            },
            TokenPolicy {
                agent_type: AgentType::Specialist,
                max_tokens_per_request: 20000,
                priority_weight: 0.8,
                burst_limit: 40000,
            },
            TokenPolicy {
                agent_type: AgentType::Worker,
                max_tokens_per_request: 10000,
                priority_weight: 0.7,
                burst_limit: 20000,
            },
        ]);

        info!("Initialized token policies for {} agent types", token_manager.token_policies.len());
        Ok(())
    }

    // Helper methods
    pub async fn get_agent_info(&self, agent_id: Uuid) -> Result<AgentInfo> {
        let registry = self.agent_registry.read().await;
        registry.get(&agent_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Agent {} not found", agent_id))
    }

    pub async fn get_available_agents(&self) -> Result<Vec<AgentInfo>> {
        let registry = self.agent_registry.read().await;
        Ok(registry.values()
            .filter(|agent| agent.status == AgentStatus::Available)
            .cloned()
            .collect())
    }

    async fn filter_available_agents(&self, target_agents: Vec<Uuid>) -> Result<Vec<Uuid>> {
        let registry = self.agent_registry.read().await;
        Ok(target_agents.into_iter()
            .filter(|id| registry.get(id)
                .map(|agent| agent.status == AgentStatus::Available)
                .unwrap_or(false))
            .collect())
    }

    async fn send_message(&self, message: AgentMessage) -> Result<()> {
        let mut broker = self.message_broker.write().await;
        broker.message_queue.push(message);
        Ok(())
    }

    async fn record_traversal(&self, traversal: ContextTraversal) -> Result<()> {
        let mut router = self.context_router.write().await;
        router.traversal_history.push(traversal);

        // Keep only last 100 traversals
        if router.traversal_history.len() > 100 {
            router.traversal_history.remove(0);
        }

        Ok(())
    }

    async fn calculate_context_quality(&self, parts: &[AgentContext]) -> Result<f64> {
        if parts.is_empty() {
            return Ok(0.0);
        }

        let total_quality: f64 = parts.iter().map(|p| p.quality_score).sum();
        Ok(total_quality / parts.len() as f64)
    }
}

// Additional structs and implementations
#[derive(Debug, Clone)]
pub struct ContextRequest {
    pub query: String,
    pub max_tokens: usize,
    pub include_metadata: bool,
    pub quality_threshold: f64,
}

#[derive(Debug, Clone)]
pub struct ContextResponse {
    pub context: String,
    pub tokens_used: usize,
    pub quality_score: f64,
    pub relevant_documents: Vec<DocumentId>,
    pub agent_capabilities_used: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct AgentContext {
    pub agent_id: Uuid,
    pub agent_name: String,
    pub context: String,
    pub tokens_used: usize,
    pub quality_score: f64,
    pub relevant_documents: Vec<DocumentId>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone)]
pub struct AgentContextResult {
    pub unlimited_context: String,
    pub agents_visited: Vec<Uuid>,
    pub total_tokens_used: usize,
    pub traversal_time_ms: u64,
    pub errors: Vec<String>,
    pub quality_score: f64,
}

impl ContextRouter {
    fn new() -> Self {
        Self {
            routing_strategy: RoutingStrategy::Semantic,
            context_cache: HashMap::new(),
            traversal_history: Vec::new(),
        }
    }
}

impl TokenManager {
    fn new() -> Self {
        Self {
            total_budget: 1000000, // 1M tokens total budget
            used_tokens: 0,
            agent_allocations: HashMap::new(),
            token_policies: Vec::new(),
        }
    }

    async fn get_agent_budget(&self, agent_id: Uuid) -> Result<usize> {
        Ok(self.agent_allocations.get(&agent_id).copied().unwrap_or(10000))
    }
}

impl MessageBroker {
    fn new() -> Self {
        Self {
            subscriptions: HashMap::new(),
            message_queue: Vec::new(),
        }
    }
}
