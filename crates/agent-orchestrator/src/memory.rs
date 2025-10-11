//! Agent Memory Management System
//!
//! This module provides memory management capabilities for agents including
//! context storage, retrieval, and optimization.

use crate::OrchestrationError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Memory manager for coordinating agent memory systems
#[derive(Debug)]
pub struct MemoryManager {
    pub config: MemoryConfig,
}

/// Configuration for memory management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub max_context_length: usize,
    pub compression_threshold: usize,
    pub persistence_enabled: bool,
    pub cache_size: usize,
    pub ttl_seconds: u64,
}

/// Context storage interface
pub trait ContextStore {
    async fn store_context(
        &self,
        agent_id: Uuid,
        context: AgentContext,
    ) -> Result<(), OrchestrationError>;
    
    async fn retrieve_context(
        &self,
        agent_id: Uuid,
        context_id: Uuid,
    ) -> Result<Option<AgentContext>, OrchestrationError>;
    
    async fn list_contexts(
        &self,
        agent_id: Uuid,
    ) -> Result<Vec<ContextSummary>, OrchestrationError>;
}

/// Agent context data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContext {
    pub id: Uuid,
    pub agent_id: Uuid,
    pub content: String,
    pub context_type: ContextType,
    pub created_at: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

/// Types of context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextType {
    Task,
    Conversation,
    Knowledge,
    State,
}

/// Summary of stored context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSummary {
    pub id: Uuid,
    pub context_type: ContextType,
    pub created_at: DateTime<Utc>,
    pub size: usize,
}

impl MemoryManager {
    pub fn new(config: MemoryConfig) -> Self {
        Self { config }
    }
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            max_context_length: 32768,
            compression_threshold: 16384,
            persistence_enabled: true,
            cache_size: 1000,
            ttl_seconds: 3600,
        }
    }
}