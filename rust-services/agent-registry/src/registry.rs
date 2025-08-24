//! Core agent registry implementation with database integration

use crate::agent::{
    Agent, AgentCapability, AgentConfig, AgentDefinition,
    AgentExecutionResult, AgentHealthCheck, AgentStatus, AgentStatusInfo, AgentType,
    ResourceUsage,
};
use crate::config::Config;
use anyhow::{anyhow, Result};
use chrono::Utc;
use dashmap::DashMap;
use sqlx::{postgres::PgPool, Row};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::time::timeout;
use tracing::{error, info, instrument, warn};
use uuid::Uuid;

/// Parameters for registering a new agent
#[derive(Debug)]
pub struct RegisterAgentParams {
    pub name: String,
    pub agent_type: AgentType,
    pub description: String,
    pub capabilities: Vec<AgentCapability>,
    pub config: AgentConfig,
    pub version: String,
    pub endpoint: Option<String>,
}

/// Agent registry statistics
#[derive(Debug, Clone)]
pub struct RegistryStats {
    pub total_agents: usize,
    pub active_agents: usize,
    pub inactive_agents: usize,
    pub busy_agents: usize,
    pub error_agents: usize,
    pub total_executions: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
    pub avg_response_time_ms: f64,
}

/// Core agent registry with high-performance in-memory operations
pub struct AgentRegistryCore {
    /// Database connection pool
    db_pool: PgPool,
    /// In-memory agent cache for fast lookups
    agents: DashMap<Uuid, Agent>,
    /// Agent type index for quick filtering
    type_index: DashMap<AgentType, Vec<Uuid>>,
    /// Capability index for feature discovery
    capability_index: DashMap<AgentCapability, Vec<Uuid>>,
    /// Configuration
    #[allow(dead_code)]
    config: Arc<Config>,
    /// HTTP client for remote agent communication
    http_client: reqwest::Client,
    /// Registry statistics
    stats: Arc<tokio::sync::RwLock<RegistryStats>>,
}

impl AgentRegistryCore {
    /// Create a new agent registry
    pub async fn new(config: Arc<Config>) -> Result<Self> {
        // Initialize database connection
        let db_pool = PgPool::connect(&config.database_url).await?;
        
        // Run database migrations
        sqlx::migrate!("./migrations").run(&db_pool).await?;

        // Create HTTP client with reasonable timeouts
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        let registry = Self {
            db_pool,
            agents: DashMap::new(),
            type_index: DashMap::new(),
            capability_index: DashMap::new(),
            config,
            http_client,
            stats: Arc::new(tokio::sync::RwLock::new(RegistryStats {
                total_agents: 0,
                active_agents: 0,
                inactive_agents: 0,
                busy_agents: 0,
                error_agents: 0,
                total_executions: 0,
                successful_executions: 0,
                failed_executions: 0,
                avg_response_time_ms: 0.0,
            })),
        };

        // Load existing agents from database
        registry.load_agents_from_database().await?;

        info!("Agent registry initialized with {} agents", registry.agents.len());
        Ok(registry)
    }

    /// Load all agents from database into memory
    #[instrument(skip(self))]
    async fn load_agents_from_database(&self) -> Result<()> {
        let rows = sqlx::query(
            r#"
            SELECT id, name, agent_type, description, capabilities, config, version,
                   endpoint, status, created_at, updated_at, last_seen, metadata,
                   execution_count, error_count, avg_execution_time_ms, health_score
            FROM agents
            "#,
        )
        .fetch_all(&self.db_pool)
        .await?;

        for row in rows {
            let id: Uuid = row.get("id");
            let capabilities_json: serde_json::Value = row.get("capabilities");
            let capabilities: Vec<AgentCapability> = serde_json::from_value(capabilities_json)?;
            let config_json: serde_json::Value = row.get("config");
            let config: AgentConfig = serde_json::from_value(config_json)?;
            let metadata_json: serde_json::Value = row.get("metadata");
            let metadata: HashMap<String, serde_json::Value> = serde_json::from_value(metadata_json)?;

            let definition = AgentDefinition {
                id,
                name: row.get("name"),
                agent_type: serde_json::from_value(row.get("agent_type"))?,
                description: row.get("description"),
                capabilities: capabilities.clone(),
                config,
                version: row.get("version"),
                endpoint: row.get("endpoint"),
                status: serde_json::from_value(row.get("status"))?,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                last_seen: row.get("last_seen"),
                metadata,
            };

            let mut agent = Agent::from_definition(definition);
            agent.execution_count = row.get::<i64, _>("execution_count") as u64;
            agent.error_count = row.get::<i64, _>("error_count") as u64;
            agent.avg_execution_time_ms = row.get("avg_execution_time_ms");
            agent.health_score = row.get("health_score");

            // Update indices
            self.update_agent_indices(&agent);

            // Store in memory
            self.agents.insert(id, agent);
        }

        self.update_stats().await?;
        Ok(())
    }

    /// Register a new agent
    #[instrument(skip(self))]
    pub async fn register_agent(
        &self,
        params: RegisterAgentParams,
    ) -> Result<AgentDefinition> {
        let definition = AgentDefinition::new(
            params.name,
            params.agent_type.clone(),
            params.description,
            params.capabilities.clone(),
            params.config.clone(),
            params.version,
            params.endpoint,
        );

        // Store in database
        sqlx::query(
            r#"
            INSERT INTO agents (id, name, agent_type, description, capabilities, config, version,
                              endpoint, status, created_at, updated_at, metadata,
                              execution_count, error_count, avg_execution_time_ms, health_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            "#,
        )
        .bind(definition.id)
        .bind(&definition.name)
        .bind(serde_json::to_value(&definition.agent_type)?)
        .bind(&definition.description)
        .bind(serde_json::to_value(&definition.capabilities)?)
        .bind(serde_json::to_value(&definition.config)?)
        .bind(&definition.version)
        .bind(&definition.endpoint)
        .bind(serde_json::to_value(&definition.status)?)
        .bind(definition.created_at)
        .bind(definition.updated_at)
        .bind(serde_json::to_value(&definition.metadata)?)
        .bind(0i64) // execution_count
        .bind(0i64) // error_count
        .bind(0.0f64) // avg_execution_time_ms
        .bind(1.0f64) // health_score
        .execute(&self.db_pool)
        .await?;

        // Create agent instance
        let agent = Agent::from_definition(definition.clone());

        // Update indices
        self.update_agent_indices(&agent);

        // Store in memory
        self.agents.insert(definition.id, agent);

        self.update_stats().await?;

        info!("Registered new agent: {} ({})", definition.name, definition.id);
        Ok(definition)
    }

    /// Get agent by ID
    #[instrument(skip(self))]
    pub async fn get_agent(&self, id: Uuid) -> Result<Option<AgentDefinition>> {
        if let Some(agent) = self.agents.get(&id) {
            Ok(Some(agent.definition.clone()))
        } else {
            Ok(None)
        }
    }

    /// List agents with filtering
    #[instrument(skip(self))]
    pub async fn list_agents(
        &self,
        agent_type: Option<AgentType>,
        status: Option<AgentStatus>,
        capability: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<AgentDefinition>> {
        let mut agents: Vec<_> = self.agents.iter().collect();

        // Apply filters
        if let Some(filter_type) = agent_type {
            agents.retain(|entry| entry.definition.agent_type == filter_type);
        }

        if let Some(filter_status) = status {
            agents.retain(|entry| entry.definition.status == filter_status);
        }

        if let Some(filter_capability) = capability {
            if let Ok(cap) = serde_json::from_str::<AgentCapability>(&format!("\"{}\"", filter_capability)) {
                agents.retain(|entry| entry.definition.has_capability(&cap));
            }
        }

        // Sort by created_at descending
        agents.sort_by(|a, b| b.definition.created_at.cmp(&a.definition.created_at));

        // Apply pagination
        let result: Vec<AgentDefinition> = agents
            .into_iter()
            .skip(offset)
            .take(limit)
            .map(|entry| entry.definition.clone())
            .collect();

        Ok(result)
    }

    /// Update agent configuration
    #[instrument(skip(self))]
    pub async fn update_agent(
        &self,
        id: Uuid,
        description: Option<String>,
        capabilities: Option<Vec<AgentCapability>>,
        config: Option<AgentConfig>,
        status: Option<AgentStatus>,
    ) -> Result<AgentDefinition> {
        let mut agent = self.agents.get_mut(&id)
            .ok_or_else(|| anyhow!("Agent not found: {}", id))?;

        let now = Utc::now();

        // Update fields
        if let Some(desc) = description {
            agent.definition.description = desc;
        }
        if let Some(caps) = capabilities {
            agent.definition.capabilities = caps;
        }
        if let Some(cfg) = config {
            agent.definition.config = cfg;
        }
        if let Some(stat) = status {
            agent.definition.status = stat;
        }
        agent.definition.updated_at = now;

        // Update database
        sqlx::query(
            r#"
            UPDATE agents 
            SET description = $2, capabilities = $3, config = $4, status = $5, updated_at = $6
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(&agent.definition.description)
        .bind(serde_json::to_value(&agent.definition.capabilities)?)
        .bind(serde_json::to_value(&agent.definition.config)?)
        .bind(serde_json::to_value(&agent.definition.status)?)
        .bind(now)
        .execute(&self.db_pool)
        .await?;

        // Update indices
        self.update_agent_indices(&agent);

        let definition = agent.definition.clone();
        drop(agent);

        self.update_stats().await?;

        info!("Updated agent: {} ({})", definition.name, id);
        Ok(definition)
    }

    /// Unregister an agent
    #[instrument(skip(self))]
    pub async fn unregister_agent(&self, id: Uuid) -> Result<bool> {
        if let Some((_, agent)) = self.agents.remove(&id) {
            // Remove from database
            sqlx::query("DELETE FROM agents WHERE id = $1")
                .bind(id)
                .execute(&self.db_pool)
                .await?;

            // Remove from indices
            self.remove_from_indices(&agent);

            self.update_stats().await?;

            info!("Unregistered agent: {} ({})", agent.definition.name, id);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Execute an agent
    #[instrument(skip(self, input, context))]
    pub async fn execute_agent(
        &self,
        agent_id: Uuid,
        input: serde_json::Value,
        context: HashMap<String, serde_json::Value>,
        timeout_duration: Duration,
    ) -> Result<AgentExecutionResult> {
        let agent = self.agents.get(&agent_id)
            .ok_or_else(|| anyhow!("Agent not found: {}", agent_id))?;

        if !agent.definition.is_available() {
            return Err(anyhow!("Agent is not available: {:?}", agent.definition.status));
        }

        let agent_name = agent.definition.name.clone();
        let endpoint = agent.definition.endpoint.clone();
        drop(agent);

        let execution_id = Uuid::new_v4();
        let start_time = Instant::now();

        let result = if let Some(endpoint_url) = endpoint {
            // Execute remote agent
            self.execute_remote_agent(agent_id, &endpoint_url, input, context, timeout_duration).await
        } else {
            // Execute local agent (placeholder for now)
            self.execute_local_agent(agent_id, input, context).await
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        let execution_result = match result {
            Ok(output) => AgentExecutionResult {
                execution_id,
                agent_id,
                agent_name,
                success: true,
                output,
                error_message: None,
                execution_time_ms: execution_time,
                resource_usage: ResourceUsage {
                    cpu_time_ms: execution_time,
                    peak_memory_bytes: 0, // TODO: Implement actual tracking
                    network_bytes_sent: 0,
                    network_bytes_received: 0,
                    disk_bytes_read: 0,
                    disk_bytes_written: 0,
                },
                metadata: HashMap::new(),
                executed_at: Utc::now(),
            },
            Err(e) => AgentExecutionResult {
                execution_id,
                agent_id,
                agent_name,
                success: false,
                output: serde_json::Value::Null,
                error_message: Some(e.to_string()),
                execution_time_ms: execution_time,
                resource_usage: ResourceUsage {
                    cpu_time_ms: execution_time,
                    peak_memory_bytes: 0,
                    network_bytes_sent: 0,
                    network_bytes_received: 0,
                    disk_bytes_read: 0,
                    disk_bytes_written: 0,
                },
                metadata: HashMap::new(),
                executed_at: Utc::now(),
            },
        };

        // Update agent metrics
        if let Some(mut agent) = self.agents.get_mut(&agent_id) {
            agent.update_metrics(&execution_result);
            
            // Update database with new metrics
            self.update_agent_metrics_in_db(&agent).await?;
        }

        self.update_stats().await?;

        Ok(execution_result)
    }

    /// Execute remote agent via HTTP
    async fn execute_remote_agent(
        &self,
        agent_id: Uuid,
        endpoint: &str,
        input: serde_json::Value,
        context: HashMap<String, serde_json::Value>,
        timeout_duration: Duration,
    ) -> Result<serde_json::Value> {
        let request_body = serde_json::json!({
            "agent_id": agent_id,
            "input": input,
            "context": context
        });

        let response = timeout(timeout_duration, 
            self.http_client
                .post(endpoint)
                .json(&request_body)
                .send()
        ).await??;

        if response.status().is_success() {
            let result: serde_json::Value = response.json().await?;
            Ok(result)
        } else {
            Err(anyhow!("Remote agent execution failed with status: {}", response.status()))
        }
    }

    /// Execute local agent (placeholder implementation)
    async fn execute_local_agent(
        &self,
        _agent_id: Uuid,
        input: serde_json::Value,
        _context: HashMap<String, serde_json::Value>,
    ) -> Result<serde_json::Value> {
        // Placeholder for local agent execution
        // This would integrate with the actual agent runtime
        Ok(serde_json::json!({
            "status": "completed",
            "message": "Local agent execution placeholder",
            "input_received": input
        }))
    }

    /// Get agent status
    #[instrument(skip(self))]
    pub async fn get_agent_status(&self, agent_id: Uuid) -> Result<AgentStatusInfo> {
        let agent = self.agents.get(&agent_id)
            .ok_or_else(|| anyhow!("Agent not found: {}", agent_id))?;

        Ok(AgentStatusInfo {
            status: agent.definition.status.clone(),
            last_seen: agent.definition.last_seen.unwrap_or(agent.definition.updated_at),
            health_score: agent.health_score,
            execution_count: agent.execution_count,
            error_count: agent.error_count,
            metadata: HashMap::new(),
        })
    }

    /// Check agent health
    #[instrument(skip(self))]
    pub async fn check_agent_health(&self, agent_id: Uuid) -> Result<AgentHealthCheck> {
        let agent = self.agents.get(&agent_id)
            .ok_or_else(|| anyhow!("Agent not found: {}", agent_id))?;

        let start_time = Instant::now();
        let check_time = Utc::now();

        if let Some(endpoint) = &agent.definition.endpoint {
            // Check remote agent health
            match timeout(Duration::from_secs(10), 
                self.http_client.get(format!("{}/health", endpoint)).send()
            ).await {
                Ok(Ok(response)) => {
                    let response_time = start_time.elapsed().as_millis() as u64;
                    Ok(AgentHealthCheck {
                        healthy: response.status().is_success(),
                        response_time_ms: response_time,
                        last_check: check_time,
                        error_message: if response.status().is_success() {
                            None
                        } else {
                            Some(format!("HTTP {}", response.status()))
                        },
                        metadata: HashMap::new(),
                    })
                }
                Ok(Err(e)) => Ok(AgentHealthCheck {
                    healthy: false,
                    response_time_ms: start_time.elapsed().as_millis() as u64,
                    last_check: check_time,
                    error_message: Some(e.to_string()),
                    metadata: HashMap::new(),
                }),
                Err(_) => Ok(AgentHealthCheck {
                    healthy: false,
                    response_time_ms: 10000, // Timeout
                    last_check: check_time,
                    error_message: Some("Health check timeout".to_string()),
                    metadata: HashMap::new(),
                }),
            }
        } else {
            // Local agent - assume healthy if status is active
            Ok(AgentHealthCheck {
                healthy: matches!(agent.definition.status, AgentStatus::Active),
                response_time_ms: 0,
                last_check: check_time,
                error_message: None,
                metadata: HashMap::new(),
            })
        }
    }

    /// Search agents by query
    #[instrument(skip(self))]
    pub async fn search_agents(&self, query: &str) -> Result<Vec<AgentDefinition>> {
        let query_lower = query.to_lowercase();
        let results: Vec<AgentDefinition> = self.agents
            .iter()
            .filter(|entry| {
                let agent = &entry.definition;
                agent.name.to_lowercase().contains(&query_lower)
                    || agent.description.to_lowercase().contains(&query_lower)
                    || agent.capabilities.iter().any(|cap| {
                        format!("{:?}", cap).to_lowercase().contains(&query_lower)
                    })
            })
            .map(|entry| entry.definition.clone())
            .collect();

        Ok(results)
    }

    /// Get available agent types
    pub async fn get_agent_types(&self) -> Vec<AgentType> {
        self.type_index.iter().map(|entry| entry.key().clone()).collect()
    }

    /// Get available capabilities
    pub async fn get_capabilities(&self) -> Vec<AgentCapability> {
        self.capability_index.iter().map(|entry| entry.key().clone()).collect()
    }

    /// Execute workflow with multiple agents
    #[instrument(skip(self, workflow))]
    pub async fn execute_workflow(&self, workflow: serde_json::Value) -> Result<serde_json::Value> {
        // Placeholder for workflow orchestration
        // This would implement complex multi-agent workflows
        Ok(serde_json::json!({
            "status": "completed",
            "message": "Workflow execution placeholder",
            "workflow": workflow
        }))
    }

    /// Perform health checks on all agents
    #[instrument(skip(self))]
    pub async fn perform_health_checks(&self) -> Result<()> {
        let mut unhealthy_count = 0;

        for entry in self.agents.iter() {
            let agent_id = entry.key();
            match self.check_agent_health(*agent_id).await {
                Ok(health) => {
                    if !health.healthy {
                        unhealthy_count += 1;
                        warn!("Agent {} is unhealthy: {:?}", agent_id, health.error_message);
                    }
                }
                Err(e) => {
                    unhealthy_count += 1;
                    error!("Failed to check health for agent {}: {}", agent_id, e);
                }
            }
        }

        if unhealthy_count > 0 {
            warn!("Found {} unhealthy agents", unhealthy_count);
        }

        Ok(())
    }

    /// Clean up inactive agents
    #[instrument(skip(self))]
    pub async fn cleanup_inactive_agents(&self) -> Result<()> {
        let cutoff_time = Utc::now() - chrono::Duration::hours(24);
        let mut removed_count = 0;

        let inactive_agents: Vec<Uuid> = self.agents
            .iter()
            .filter(|entry| {
                let agent = &entry.definition;
                matches!(agent.status, AgentStatus::Inactive | AgentStatus::Error)
                    && agent.last_seen.is_none_or(|last_seen| last_seen < cutoff_time)
            })
            .map(|entry| *entry.key())
            .collect();

        for agent_id in inactive_agents {
            if self.unregister_agent(agent_id).await? {
                removed_count += 1;
            }
        }

        if removed_count > 0 {
            info!("Cleaned up {} inactive agents", removed_count);
        }

        Ok(())
    }

    /// Get registry statistics
    pub async fn get_stats(&self) -> RegistryStats {
        self.stats.read().await.clone()
    }

    /// Update agent indices
    fn update_agent_indices(&self, agent: &Agent) {
        // Update type index
        self.type_index
            .entry(agent.definition.agent_type.clone())
            .or_default()
            .push(agent.definition.id);

        // Update capability index
        for capability in &agent.definition.capabilities {
            self.capability_index
                .entry(capability.clone())
                .or_default()
                .push(agent.definition.id);
        }
    }

    /// Remove agent from indices
    fn remove_from_indices(&self, agent: &Agent) {
        // Remove from type index
        if let Some(mut type_agents) = self.type_index.get_mut(&agent.definition.agent_type) {
            type_agents.retain(|&id| id != agent.definition.id);
        }

        // Remove from capability index
        for capability in &agent.definition.capabilities {
            if let Some(mut cap_agents) = self.capability_index.get_mut(capability) {
                cap_agents.retain(|&id| id != agent.definition.id);
            }
        }
    }

    /// Update registry statistics
    async fn update_stats(&self) -> Result<()> {
        let mut stats = self.stats.write().await;
        
        stats.total_agents = self.agents.len();
        stats.active_agents = 0;
        stats.inactive_agents = 0;
        stats.busy_agents = 0;
        stats.error_agents = 0;
        stats.total_executions = 0;
        stats.successful_executions = 0;
        stats.failed_executions = 0;

        let mut total_response_time = 0.0;
        let mut agent_count = 0;

        for entry in self.agents.iter() {
            let agent = entry.value();
            
            match agent.definition.status {
                AgentStatus::Active => stats.active_agents += 1,
                AgentStatus::Inactive => stats.inactive_agents += 1,
                AgentStatus::Busy => stats.busy_agents += 1,
                AgentStatus::Error => stats.error_agents += 1,
                _ => {}
            }

            stats.total_executions += agent.execution_count;
            stats.successful_executions += agent.metrics.successful_executions;
            stats.failed_executions += agent.metrics.failed_executions;
            
            if agent.avg_execution_time_ms > 0.0 {
                total_response_time += agent.avg_execution_time_ms;
                agent_count += 1;
            }
        }

        stats.avg_response_time_ms = if agent_count > 0 {
            total_response_time / agent_count as f64
        } else {
            0.0
        };

        Ok(())
    }

    /// Update agent metrics in database
    async fn update_agent_metrics_in_db(&self, agent: &Agent) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE agents 
            SET execution_count = $2, error_count = $3, avg_execution_time_ms = $4, 
                health_score = $5, last_seen = $6, updated_at = $7
            WHERE id = $1
            "#,
        )
        .bind(agent.definition.id)
        .bind(agent.execution_count as i64)
        .bind(agent.error_count as i64)
        .bind(agent.avg_execution_time_ms)
        .bind(agent.health_score)
        .bind(Utc::now())
        .bind(Utc::now())
        .execute(&self.db_pool)
        .await?;

        Ok(())
    }
}