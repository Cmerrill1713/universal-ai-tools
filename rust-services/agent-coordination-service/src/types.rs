use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Agent capability definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCapability {
    pub name: String,
    pub description: String,
    pub parameters: HashMap<String, serde_json::Value>,
}

/// Agent configuration and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDefinition {
    pub name: String,
    pub description: String,
    pub category: AgentCategory,
    pub capabilities: Vec<AgentCapability>,
    pub version: String,
    pub author: String,
    pub tags: Vec<String>,
    pub config: AgentConfig,
    pub status: AgentStatus,
}

/// Agent categories for organization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentCategory {
    #[serde(rename = "cognitive")]
    Cognitive,
    #[serde(rename = "personal")]
    Personal,
    #[serde(rename = "specialized")]
    Specialized,
    #[serde(rename = "system")]
    System,
}

/// Agent runtime status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentStatus {
    #[serde(rename = "available")]
    Available,
    #[serde(rename = "loaded")]
    Loaded,
    #[serde(rename = "busy")]
    Busy,
    #[serde(rename = "error")]
    Error,
    #[serde(rename = "unloaded")]
    Unloaded,
}

/// Agent configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub max_memory_mb: u32,
    pub timeout_seconds: u32,
    pub retry_attempts: u32,
    pub preferred_tier: Option<String>,
    pub enable_caching: bool,
    pub custom_config: HashMap<String, serde_json::Value>,
}

/// Response for agent loading operations
#[derive(Debug, Serialize)]
pub struct AgentLoadResponse {
    pub agent_id: Uuid,
    pub name: String,
    pub status: String,
    pub timestamp: DateTime<Utc>,
}

/// Collaboration request structure
#[derive(Debug, Deserialize)]
pub struct CollaborationRequest {
    pub task: String,
    pub required_capabilities: Vec<String>,
    pub team_size: Option<usize>,
    pub initiator: String,
    pub priority: CollaborationPriority,
    pub timeout_seconds: Option<u32>,
}

/// Collaboration priority levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CollaborationPriority {
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "normal")]
    Normal,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "urgent")]
    Urgent,
}

/// Collaboration response
#[derive(Debug, Serialize)]
pub struct CollaborationResponse {
    pub session_id: Uuid,
    pub status: String,
    pub assigned_agents: Vec<String>,
    pub estimated_duration: Option<u32>,
    pub created_at: DateTime<Utc>,
}

/// Collaboration session status
#[derive(Debug, Serialize)]
pub struct CollaborationStatus {
    pub session_id: Uuid,
    pub status: CollaborationSessionStatus,
    pub assigned_agents: Vec<String>,
    pub progress: f32, // 0.0 to 1.0
    pub messages: Vec<CollaborationMessage>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Collaboration session status enum
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CollaborationSessionStatus {
    #[serde(rename = "requested")]
    Requested,
    #[serde(rename = "active")]
    Active,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "cancelled")]
    Cancelled,
}

/// Message within a collaboration session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationMessage {
    pub id: Uuid,
    pub from_agent: String,
    pub to_agent: Option<String>, // None for broadcast
    pub message_type: MessageType,
    pub content: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

/// Types of messages in collaboration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    #[serde(rename = "task_assignment")]
    TaskAssignment,
    #[serde(rename = "progress_update")]
    ProgressUpdate,
    #[serde(rename = "result")]
    Result,
    #[serde(rename = "error")]
    Error,
    #[serde(rename = "coordination")]
    Coordination,
}

/// Agent execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContext {
    pub user_request: String,
    pub request_id: Uuid,
    pub session_id: Option<Uuid>,
    pub conversation_history: Vec<ConversationMessage>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub preferences: Option<UserPreferences>,
}

/// Conversation message for context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

/// User preferences for agent behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub preferred_agents: Vec<String>,
    pub response_style: String,
    pub verbosity_level: u8, // 1-10
    pub enable_explanations: bool,
}

/// Agent response structure
#[derive(Debug, Serialize)]
pub struct AgentResponse {
    pub agent_name: String,
    pub content: String,
    pub confidence: f32,
    pub execution_time_ms: u64,
    pub metadata: HashMap<String, serde_json::Value>,
    pub suggestions: Vec<String>,
    pub timestamp: DateTime<Utc>,
}

/// Error types for the agent coordination service
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Agent not found: {name}")]
    AgentNotFound { name: String },
    
    #[error("Agent already loaded: {name}")]
    AgentAlreadyLoaded { name: String },
    
    #[error("Agent loading failed: {name}, reason: {reason}")]
    AgentLoadingFailed { name: String, reason: String },
    
    #[error("Collaboration failed: {reason}")]
    CollaborationFailed { reason: String },
    
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    
    #[error("Redis error: {0}")]
    RedisError(#[from] redis::RedisError),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Internal error: {0}")]
    InternalError(String),
}

pub type AgentResult<T> = Result<T, AgentError>;