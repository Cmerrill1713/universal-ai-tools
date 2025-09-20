use crate::types::*;
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;
use tracing::{info, debug};

/// Core agent registry for managing agent lifecycle
pub struct AgentRegistry {
    /// Agent definitions available in the system
    agent_definitions: HashMap<String, AgentDefinition>,

    /// Currently loaded agents with their runtime info
    loaded_agents: HashMap<String, LoadedAgent>,

    /// Agent usage statistics
    usage_stats: HashMap<String, AgentUsageStats>,
}

/// Runtime information for a loaded agent
#[derive(Debug, Clone)]
struct LoadedAgent {
    id: Uuid,
    name: String,
    status: AgentStatus,
    loaded_at: chrono::DateTime<Utc>,
    last_used: chrono::DateTime<Utc>,
    memory_usage_mb: u32,
    execution_count: u64,
}

/// Usage statistics for an agent
#[derive(Debug, Clone)]
struct AgentUsageStats {
    total_executions: u64,
    total_execution_time_ms: u64,
    success_rate: f32,
    average_response_time_ms: f32,
    last_execution: chrono::DateTime<Utc>,
}

impl AgentRegistry {
    /// Create a new agent registry
    pub fn new() -> Self {
        let mut registry = Self {
            agent_definitions: HashMap::new(),
            loaded_agents: HashMap::new(),
            usage_stats: HashMap::new(),
        };

        // Register built-in agents
        registry.register_builtin_agents();

        info!("Agent Registry initialized with {} agent definitions",
              registry.agent_definitions.len());

        registry
    }

    /// Register built-in agent definitions
    fn register_builtin_agents(&mut self) {
        let builtin_agents = vec![
            AgentDefinition {
                name: "enhanced-planner-agent".to_string(),
                description: "Strategic planning agent with JSON-structured responses".to_string(),
                category: AgentCategory::Cognitive,
                capabilities: vec![
                    AgentCapability {
                        name: "strategic_planning".to_string(),
                        description: "Break down complex tasks into actionable steps".to_string(),
                        parameters: HashMap::new(),
                    },
                    AgentCapability {
                        name: "risk_assessment".to_string(),
                        description: "Evaluate potential risks and mitigation strategies".to_string(),
                        parameters: HashMap::new(),
                    },
                ],
                version: "1.0.0".to_string(),
                author: "Universal AI Tools".to_string(),
                tags: vec!["planning".to_string(), "strategy".to_string()],
                config: AgentConfig {
                    max_memory_mb: 512,
                    timeout_seconds: 30,
                    retry_attempts: 3,
                    preferred_tier: Some("tier2".to_string()),
                    enable_caching: true,
                    custom_config: HashMap::new(),
                },
                status: AgentStatus::Available,
            },
            AgentDefinition {
                name: "enhanced-retriever-agent".to_string(),
                description: "Information research and context gathering specialist".to_string(),
                category: AgentCategory::Cognitive,
                capabilities: vec![
                    AgentCapability {
                        name: "information_research".to_string(),
                        description: "Research and gather relevant information".to_string(),
                        parameters: HashMap::new(),
                    },
                    AgentCapability {
                        name: "context_synthesis".to_string(),
                        description: "Synthesize information from multiple sources".to_string(),
                        parameters: HashMap::new(),
                    },
                ],
                version: "1.0.0".to_string(),
                author: "Universal AI Tools".to_string(),
                tags: vec!["research".to_string(), "information".to_string()],
                config: AgentConfig {
                    max_memory_mb: 256,
                    timeout_seconds: 45,
                    retry_attempts: 2,
                    preferred_tier: Some("tier1".to_string()),
                    enable_caching: true,
                    custom_config: HashMap::new(),
                },
                status: AgentStatus::Available,
            },
            AgentDefinition {
                name: "enhanced-synthesizer-agent".to_string(),
                description: "Information synthesis and consensus building".to_string(),
                category: AgentCategory::Cognitive,
                capabilities: vec![
                    AgentCapability {
                        name: "information_synthesis".to_string(),
                        description: "Combine multiple sources into coherent analysis".to_string(),
                        parameters: HashMap::new(),
                    },
                    AgentCapability {
                        name: "consensus_building".to_string(),
                        description: "Find common ground between different viewpoints".to_string(),
                        parameters: HashMap::new(),
                    },
                ],
                version: "1.0.0".to_string(),
                author: "Universal AI Tools".to_string(),
                tags: vec!["synthesis".to_string(), "analysis".to_string()],
                config: AgentConfig {
                    max_memory_mb: 384,
                    timeout_seconds: 60,
                    retry_attempts: 2,
                    preferred_tier: Some("tier2".to_string()),
                    enable_caching: false,
                    custom_config: HashMap::new(),
                },
                status: AgentStatus::Available,
            },
            AgentDefinition {
                name: "enhanced-personal-assistant-agent".to_string(),
                description: "Personal AI assistant with conversational capabilities".to_string(),
                category: AgentCategory::Personal,
                capabilities: vec![
                    AgentCapability {
                        name: "conversation".to_string(),
                        description: "Natural conversation and assistance".to_string(),
                        parameters: HashMap::new(),
                    },
                    AgentCapability {
                        name: "task_management".to_string(),
                        description: "Help organize and manage tasks".to_string(),
                        parameters: HashMap::new(),
                    },
                ],
                version: "1.0.0".to_string(),
                author: "Universal AI Tools".to_string(),
                tags: vec!["personal".to_string(), "conversation".to_string()],
                config: AgentConfig {
                    max_memory_mb: 256,
                    timeout_seconds: 30,
                    retry_attempts: 3,
                    preferred_tier: Some("tier1".to_string()),
                    enable_caching: true,
                    custom_config: HashMap::new(),
                },
                status: AgentStatus::Available,
            },
            AgentDefinition {
                name: "enhanced-code-assistant-agent".to_string(),
                description: "Code generation, review, and development assistance".to_string(),
                category: AgentCategory::Specialized,
                capabilities: vec![
                    AgentCapability {
                        name: "code_generation".to_string(),
                        description: "Generate code in various programming languages".to_string(),
                        parameters: HashMap::new(),
                    },
                    AgentCapability {
                        name: "code_review".to_string(),
                        description: "Review code for quality and best practices".to_string(),
                        parameters: HashMap::new(),
                    },
                ],
                version: "1.0.0".to_string(),
                author: "Universal AI Tools".to_string(),
                tags: vec!["code".to_string(), "development".to_string()],
                config: AgentConfig {
                    max_memory_mb: 512,
                    timeout_seconds: 90,
                    retry_attempts: 2,
                    preferred_tier: Some("tier3".to_string()),
                    enable_caching: true,
                    custom_config: HashMap::new(),
                },
                status: AgentStatus::Available,
            },
        ];

        for agent in builtin_agents {
            self.agent_definitions.insert(agent.name.clone(), agent);
        }
    }

    /// List all available agents
    pub async fn list_agents(&self) -> AgentResult<Vec<AgentDefinition>> {
        Ok(self.agent_definitions.values().cloned().collect())
    }

    /// Get agent definition by name
    pub async fn get_agent_definition(&self, name: &str) -> AgentResult<Option<AgentDefinition>> {
        Ok(self.agent_definitions.get(name).cloned())
    }

    /// Load an agent into memory
    pub async fn load_agent(&mut self, name: &str) -> AgentResult<Uuid> {
        // Check if agent definition exists
        let _agent_def = self.agent_definitions.get(name)
            .ok_or_else(|| AgentError::AgentNotFound { name: name.to_string() })?;

        // Check if already loaded
        if self.loaded_agents.contains_key(name) {
            return Err(AgentError::AgentAlreadyLoaded { name: name.to_string() });
        }

        // Create loaded agent instance
        let agent_id = Uuid::new_v4();
        let loaded_agent = LoadedAgent {
            id: agent_id,
            name: name.to_string(),
            status: AgentStatus::Loaded,
            loaded_at: Utc::now(),
            last_used: Utc::now(),
            memory_usage_mb: 0, // This would be updated based on actual usage
            execution_count: 0,
        };

        self.loaded_agents.insert(name.to_string(), loaded_agent);

        // Update agent definition status
        if let Some(agent_def) = self.agent_definitions.get_mut(name) {
            agent_def.status = AgentStatus::Loaded;
        }

        info!("Agent '{}' loaded successfully with ID: {}", name, agent_id);
        Ok(agent_id)
    }

    /// Unload an agent from memory
    pub async fn unload_agent(&mut self, name: &str) -> AgentResult<()> {
        // Check if agent is loaded
        let _loaded_agent = self.loaded_agents.remove(name)
            .ok_or_else(|| AgentError::AgentNotFound { name: name.to_string() })?;

        // Update agent definition status
        if let Some(agent_def) = self.agent_definitions.get_mut(name) {
            agent_def.status = AgentStatus::Available;
        }

        info!("Agent '{}' unloaded successfully", name);
        Ok(())
    }

    /// Get agent usage statistics
    pub async fn get_agent_stats(&self, name: &str) -> AgentResult<Option<AgentUsageStats>> {
        Ok(self.usage_stats.get(name).cloned())
    }

    /// Update agent usage statistics
    pub async fn update_agent_stats(&mut self, name: &str, execution_time_ms: u64, success: bool) -> AgentResult<()> {
        let stats = self.usage_stats.entry(name.to_string()).or_insert(AgentUsageStats {
            total_executions: 0,
            total_execution_time_ms: 0,
            success_rate: 1.0,
            average_response_time_ms: 0.0,
            last_execution: Utc::now(),
        });

        stats.total_executions += 1;
        stats.total_execution_time_ms += execution_time_ms;
        stats.average_response_time_ms = stats.total_execution_time_ms as f32 / stats.total_executions as f32;
        stats.last_execution = Utc::now();

        // Update success rate (simple running average)
        let success_weight = if success { 1.0 } else { 0.0 };
        stats.success_rate = (stats.success_rate * (stats.total_executions as f32 - 1.0) + success_weight) / stats.total_executions as f32;

        // Update loaded agent info if it exists
        if let Some(loaded_agent) = self.loaded_agents.get_mut(name) {
            loaded_agent.last_used = Utc::now();
            loaded_agent.execution_count += 1;
        }

        Ok(())
    }

    /// Find agents with specific capabilities
    pub async fn find_agents_with_capabilities(&self, capabilities: &[String]) -> AgentResult<Vec<String>> {
        let mut matching_agents = Vec::new();

        for (name, agent_def) in &self.agent_definitions {
            let agent_capabilities: Vec<String> = agent_def.capabilities.iter()
                .map(|cap| cap.name.clone())
                .collect();

            // Check if agent has any of the required capabilities
            for required_cap in capabilities {
                if agent_capabilities.iter().any(|cap| cap.contains(required_cap)) {
                    matching_agents.push(name.clone());
                    break;
                }
            }
        }

        debug!("Found {} agents with capabilities: {:?}", matching_agents.len(), capabilities);
        Ok(matching_agents)
    }

    /// Get currently loaded agents
    pub async fn get_loaded_agents(&self) -> AgentResult<Vec<String>> {
        Ok(self.loaded_agents.keys().cloned().collect())
    }
}
