//! Redis-based caching and persistence for AB-MCTS trees
//! 
//! Provides efficient storage and retrieval of MCTS nodes, search results,
//! and model states using Redis as the backend storage system.

use crate::error::{MCTSError, MCTSResult};
use crate::types::{MCTSNode, SearchResult, SearchStatistics};
use redis::{Client, Connection, Commands};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use tokio::time::timeout;
use tracing::{debug, trace, warn, error};
use uuid::Uuid;

/// Configuration for Redis cache
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CacheConfig {
    pub redis_url: String,
    pub key_prefix: String,
    pub default_ttl: Duration,
    pub connection_timeout: Duration,
    pub max_retries: u32,
    pub retry_delay: Duration,
    pub enable_compression: bool,
    pub max_tree_size: usize,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            redis_url: "redis://localhost:6379".to_string(),
            key_prefix: "ab_mcts".to_string(),
            default_ttl: Duration::from_secs(3600), // 1 hour
            connection_timeout: Duration::from_secs(5),
            max_retries: 3,
            retry_delay: Duration::from_millis(100),
            enable_compression: true,
            max_tree_size: 10000, // Maximum nodes to cache
        }
    }
}

/// Redis-based cache for MCTS operations
pub struct MCTSCache {
    client: Client,
    config: CacheConfig,
    connection: Option<Connection>,
    cache_stats: CacheStatistics,
}

/// Cache performance statistics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CacheStatistics {
    pub hits: u64,
    pub misses: u64,
    pub writes: u64,
    pub errors: u64,
    pub total_operations: u64,
    pub average_response_time: Duration,
    pub last_updated: SystemTime,
}

impl Default for CacheStatistics {
    fn default() -> Self {
        Self {
            hits: 0,
            misses: 0,
            writes: 0,
            errors: 0,
            total_operations: 0,
            average_response_time: Duration::default(),
            last_updated: SystemTime::now(),
        }
    }
}

impl CacheStatistics {
    pub fn hit_ratio(&self) -> f64 {
        if self.hits + self.misses == 0 {
            0.0
        } else {
            self.hits as f64 / (self.hits + self.misses) as f64
        }
    }
    
    pub fn error_rate(&self) -> f64 {
        if self.total_operations == 0 {
            0.0
        } else {
            self.errors as f64 / self.total_operations as f64
        }
    }
}

/// Cached tree structure for efficient storage
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CachedTree {
    pub root_id: String,
    pub nodes: HashMap<String, MCTSNode>,
    pub search_stats: SearchStatistics,
    pub created_at: SystemTime,
    pub last_accessed: SystemTime,
    pub access_count: u64,
}

impl MCTSCache {
    /// Create a new MCTS cache
    pub fn new(config: CacheConfig) -> MCTSResult<Self> {
        let client = Client::open(config.redis_url.clone())
            .map_err(|e| MCTSError::cache_error(format!("Failed to create Redis client: {}", e)))?;
        
        debug!("Created MCTS cache with Redis URL: {}", config.redis_url);
        
        Ok(Self {
            client,
            config,
            connection: None,
            cache_stats: CacheStatistics::default(),
        })
    }
    
    /// Initialize the cache connection
    pub async fn connect(&mut self) -> MCTSResult<()> {
        let connection = timeout(
            self.config.connection_timeout,
            async { self.client.get_connection() }
        ).await
        .map_err(|_| MCTSError::cache_error("Redis connection timeout"))?
        .map_err(|e| MCTSError::cache_error(format!("Failed to connect to Redis: {}", e)))?;
        
        self.connection = Some(connection);
        debug!("Connected to Redis cache");
        Ok(())
    }
    
    /// Store an MCTS node in cache
    pub async fn store_node(&mut self, node: &MCTSNode) -> MCTSResult<()> {
        let key = format!("{}:node:{}", self.config.key_prefix, node.id);
        let value = self.serialize_with_compression(node)?;
        
        let start = SystemTime::now();
        let ttl_secs = self.config.default_ttl.as_secs() as usize;
        let result = self.with_retries(|conn| {
            let _: () = conn.set_ex(&key, &value, ttl_secs)?;
            Ok(())
        }).await;
        
        self.update_stats(start, result.is_ok(), false, true);
        
        match result {
            Ok(()) => {
                trace!("Stored node {} in cache", node.id);
                Ok(())
            }
            Err(e) => Err(MCTSError::cache_error(format!("Failed to store node: {}", e))),
        }
    }
    
    /// Retrieve an MCTS node from cache
    pub async fn get_node(&mut self, node_id: &str) -> MCTSResult<Option<MCTSNode>> {
        let key = format!("{}:node:{}", self.config.key_prefix, node_id);
        
        let start = SystemTime::now();
        let result = self.with_retries(|conn| {
            let value: Option<Vec<u8>> = conn.get(&key)?;
            Ok(value)
        }).await;
        
        let found = result.as_ref().map(|v| v.is_some()).unwrap_or(false);
        self.update_stats(start, result.is_ok(), found, false);
        
        match result? {
            Some(data) => {
                let node = self.deserialize_with_decompression(&data)?;
                trace!("Retrieved node {} from cache", node_id);
                Ok(Some(node))
            }
            None => {
                trace!("Node {} not found in cache", node_id);
                Ok(None)
            }
        }
    }
    
    /// Store a complete MCTS tree
    pub async fn store_tree(
        &mut self, 
        session_id: &str, 
        root: &MCTSNode, 
        nodes: HashMap<String, MCTSNode>,
        stats: SearchStatistics
    ) -> MCTSResult<()> {
        if nodes.len() > self.config.max_tree_size {
            warn!("Tree size {} exceeds maximum {}, truncating", 
                  nodes.len(), self.config.max_tree_size);
        }
        
        let cached_tree = CachedTree {
            root_id: root.id.clone(),
            nodes: nodes.into_iter().take(self.config.max_tree_size).collect(),
            search_stats: stats,
            created_at: SystemTime::now(),
            last_accessed: SystemTime::now(),
            access_count: 0,
        };
        
        let key = format!("{}:tree:{}", self.config.key_prefix, session_id);
        let value = self.serialize_with_compression(&cached_tree)?;
        
        let start = SystemTime::now();
        let ttl_secs = (self.config.default_ttl.as_secs() * 2) as usize; // Longer TTL for trees
        let result = self.with_retries(|conn| {
            let _: () = conn.set_ex(&key, &value, ttl_secs)?;
            Ok(())
        }).await;
        
        self.update_stats(start, result.is_ok(), false, true);
        
        match result {
            Ok(()) => {
                debug!("Stored tree for session {} with {} nodes", session_id, cached_tree.nodes.len());
                Ok(())
            }
            Err(e) => Err(MCTSError::cache_error(format!("Failed to store tree: {}", e))),
        }
    }
    
    /// Retrieve a complete MCTS tree
    pub async fn get_tree(&mut self, session_id: &str) -> MCTSResult<Option<CachedTree>> {
        let key = format!("{}:tree:{}", self.config.key_prefix, session_id);
        
        let start = SystemTime::now();
        let result = self.with_retries(|conn| {
            let value: Option<Vec<u8>> = conn.get(&key)?;
            Ok(value)
        }).await;
        
        let found = result.as_ref().map(|v| v.is_some()).unwrap_or(false);
        self.update_stats(start, result.is_ok(), found, false);
        
        match result? {
            Some(data) => {
                let mut tree: CachedTree = self.deserialize_with_decompression(&data)?;
                tree.last_accessed = SystemTime::now();
                tree.access_count += 1;
                
                // Update access information
                let value = self.serialize_with_compression(&tree)?;
                let ttl_secs = (self.config.default_ttl.as_secs() * 2) as usize;
                let _ = self.with_retries(|conn| {
                    let _: () = conn.set_ex(&key, &value, ttl_secs)?;
                    Ok(())
                }).await;
                
                debug!("Retrieved tree for session {} with {} nodes", session_id, tree.nodes.len());
                Ok(Some(tree))
            }
            None => {
                trace!("Tree for session {} not found in cache", session_id);
                Ok(None)
            }
        }
    }
    
    /// Store search result for future reference
    pub async fn store_search_result(
        &mut self,
        session_id: &str,
        result: &SearchResult
    ) -> MCTSResult<()> {
        let key = format!("{}:result:{}", self.config.key_prefix, session_id);
        let value = self.serialize_with_compression(result)?;
        
        let start = SystemTime::now();
        let ttl_secs = self.config.default_ttl.as_secs() as usize;
        let cache_result = self.with_retries(|conn| {
            let _: () = conn.set_ex(&key, &value, ttl_secs)?;
            Ok(())
        }).await;
        
        self.update_stats(start, cache_result.is_ok(), false, true);
        
        match cache_result {
            Ok(()) => {
                debug!("Stored search result for session {}", session_id);
                Ok(())
            }
            Err(e) => Err(MCTSError::cache_error(format!("Failed to store search result: {}", e))),
        }
    }
    
    /// Retrieve search result
    pub async fn get_search_result(&mut self, session_id: &str) -> MCTSResult<Option<SearchResult>> {
        let key = format!("{}:result:{}", self.config.key_prefix, session_id);
        
        let start = SystemTime::now();
        let result = self.with_retries(|conn| {
            let value: Option<Vec<u8>> = conn.get(&key)?;
            Ok(value)
        }).await;
        
        let found = result.as_ref().map(|v| v.is_some()).unwrap_or(false);
        self.update_stats(start, result.is_ok(), found, false);
        
        match result? {
            Some(data) => {
                let search_result = self.deserialize_with_decompression(&data)?;
                debug!("Retrieved search result for session {}", session_id);
                Ok(Some(search_result))
            }
            None => {
                trace!("Search result for session {} not found in cache", session_id);
                Ok(None)
            }
        }
    }
    
    /// Delete cached data for a session
    pub async fn delete_session(&mut self, session_id: &str) -> MCTSResult<()> {
        let keys = vec![
            format!("{}:tree:{}", self.config.key_prefix, session_id),
            format!("{}:result:{}", self.config.key_prefix, session_id),
        ];
        
        let start = SystemTime::now();
        let result = self.with_retries(|conn| {
            let count: u32 = conn.del(&keys)?;
            Ok(count)
        }).await;
        
        self.update_stats(start, result.is_ok(), false, false);
        
        match result {
            Ok(count) => {
                debug!("Deleted {} cache entries for session {}", count, session_id);
                Ok(())
            }
            Err(e) => Err(MCTSError::cache_error(format!("Failed to delete session data: {}", e))),
        }
    }
    
    /// Clear all cache data with the configured prefix
    pub async fn clear_all(&mut self) -> MCTSResult<()> {
        let pattern = format!("{}:*", self.config.key_prefix);
        
        let start = SystemTime::now();
        let result = self.with_retries(|conn| {
            let keys: Vec<String> = conn.keys(&pattern)?;
            if !keys.is_empty() {
                let count: u32 = conn.del(&keys)?;
                Ok(count)
            } else {
                Ok(0)
            }
        }).await;
        
        self.update_stats(start, result.is_ok(), false, false);
        
        match result {
            Ok(count) => {
                debug!("Cleared {} cache entries", count);
                Ok(())
            }
            Err(e) => Err(MCTSError::cache_error(format!("Failed to clear cache: {}", e))),
        }
    }
    
    /// Get cache statistics
    pub fn get_stats(&self) -> CacheStatistics {
        self.cache_stats.clone()
    }
    
    /// Reset cache statistics
    pub fn reset_stats(&mut self) {
        self.cache_stats = CacheStatistics::default();
        debug!("Reset cache statistics");
    }
    
    /// Check if cache is available and healthy
    pub async fn health_check(&mut self) -> MCTSResult<bool> {
        let test_key = format!("{}:health_check:{}", self.config.key_prefix, Uuid::new_v4());
        let test_value = b"health_check";
        
        let result = self.with_retries(|conn| {
            let _: () = conn.set_ex(&test_key, test_value, 10)?; // 10 second TTL
            let retrieved: Vec<u8> = conn.get(&test_key)?;
            let _: u32 = conn.del(&test_key)?;
            Ok(retrieved == test_value)
        }).await;
        
        match result {
            Ok(success) => {
                if success {
                    debug!("Cache health check passed");
                } else {
                    warn!("Cache health check failed: data mismatch");
                }
                Ok(success)
            }
            Err(e) => {
                error!("Cache health check failed: {}", e);
                Ok(false)
            }
        }
    }
    
    /// Execute operation with retry logic
    async fn with_retries<F, R>(&mut self, mut operation: F) -> Result<R, redis::RedisError>
    where
        F: FnMut(&mut Connection) -> Result<R, redis::RedisError>,
    {
        let mut last_error = None;
        
        for attempt in 0..=self.config.max_retries {
            // Ensure we have a connection
            if self.connection.is_none() {
                match self.client.get_connection() {
                    Ok(conn) => self.connection = Some(conn),
                    Err(e) => {
                        last_error = Some(e);
                        if attempt < self.config.max_retries {
                            tokio::time::sleep(self.config.retry_delay).await;
                            continue;
                        } else {
                            break;
                        }
                    }
                }
            }
            
            if let Some(conn) = &mut self.connection {
                match operation(conn) {
                    Ok(result) => return Ok(result),
                    Err(e) => {
                        last_error = Some(e);
                        // Reset connection on error
                        self.connection = None;
                        
                        if attempt < self.config.max_retries {
                            tokio::time::sleep(self.config.retry_delay).await;
                        }
                    }
                }
            }
        }
        
        Err(last_error.unwrap_or_else(|| redis::RedisError::from((redis::ErrorKind::IoError, "Connection failed"))))
    }
    
    /// Serialize with optional compression
    fn serialize_with_compression<T: Serialize>(&self, value: &T) -> MCTSResult<Vec<u8>> {
        let json = serde_json::to_vec(value)
            .map_err(|e| MCTSError::cache_error(format!("Serialization failed: {}", e)))?;
        
        if self.config.enable_compression && json.len() > 1024 {
            // Use simple compression for large payloads
            // In practice, you'd use a proper compression library like flate2
            Ok(json) // Placeholder - implement compression
        } else {
            Ok(json)
        }
    }
    
    /// Deserialize with optional decompression
    fn deserialize_with_decompression<T: for<'de> Deserialize<'de>>(&self, data: &[u8]) -> MCTSResult<T> {
        // Placeholder - implement decompression detection
        let json_data = data;
        
        serde_json::from_slice(json_data)
            .map_err(|e| MCTSError::cache_error(format!("Deserialization failed: {}", e)))
    }
    
    /// Update cache statistics
    fn update_stats(&mut self, start: SystemTime, success: bool, hit: bool, write: bool) {
        self.cache_stats.total_operations += 1;
        
        if success {
            if write {
                self.cache_stats.writes += 1;
            } else if hit {
                self.cache_stats.hits += 1;
            } else {
                self.cache_stats.misses += 1;
            }
        } else {
            self.cache_stats.errors += 1;
        }
        
        if let Ok(elapsed) = start.elapsed() {
            let total_time = self.cache_stats.average_response_time.as_nanos() as f64 * 
                            (self.cache_stats.total_operations - 1) as f64 + elapsed.as_nanos() as f64;
            self.cache_stats.average_response_time = Duration::from_nanos(
                (total_time / self.cache_stats.total_operations as f64) as u64
            );
        }
        
        self.cache_stats.last_updated = SystemTime::now();
    }
}

/// Cache key builder for consistent key naming
pub struct CacheKeyBuilder {
    prefix: String,
}

impl CacheKeyBuilder {
    pub fn new(prefix: String) -> Self {
        Self { prefix }
    }
    
    pub fn node_key(&self, node_id: &str) -> String {
        format!("{}:node:{}", self.prefix, node_id)
    }
    
    pub fn tree_key(&self, session_id: &str) -> String {
        format!("{}:tree:{}", self.prefix, session_id)
    }
    
    pub fn result_key(&self, session_id: &str) -> String {
        format!("{}:result:{}", self.prefix, session_id)
    }
    
    pub fn model_key(&self, model_type: &str, agent_name: &str) -> String {
        format!("{}:model:{}:{}", self.prefix, model_type, agent_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;
    use std::collections::HashMap;
    
    fn create_test_node() -> MCTSNode {
        let context = AgentContext {
            task: "test task".to_string(),
            requirements: vec!["req1".to_string()],
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
        
        MCTSNode::new_root(context)
    }
    
    #[test]
    fn test_cache_config_default() {
        let config = CacheConfig::default();
        assert_eq!(config.redis_url, "redis://localhost:6379");
        assert_eq!(config.key_prefix, "ab_mcts");
        assert_eq!(config.default_ttl, Duration::from_secs(3600));
        assert_eq!(config.max_retries, 3);
    }
    
    #[test]
    fn test_cache_statistics() {
        let mut stats = CacheStatistics::default();
        stats.hits = 8;
        stats.misses = 2;
        stats.errors = 1;
        stats.total_operations = 11;
        
        assert_eq!(stats.hit_ratio(), 0.8);
        assert!((stats.error_rate() - 0.090909).abs() < 0.001);
    }
    
    #[test]
    fn test_cached_tree_creation() {
        let root = create_test_node();
        let mut nodes = HashMap::new();
        nodes.insert(root.id.clone(), root.clone());
        
        let stats = SearchStatistics {
            total_iterations: 100,
            nodes_explored: 50,
            average_depth: 3.2,
            search_time: Duration::from_secs(5),
            cache_hits: 10,
            cache_misses: 5,
            thompson_samples: 25,
            ucb_selections: 25,
        };
        
        let tree = CachedTree {
            root_id: root.id.clone(),
            nodes,
            search_stats: stats,
            created_at: SystemTime::now(),
            last_accessed: SystemTime::now(),
            access_count: 0,
        };
        
        assert_eq!(tree.root_id, root.id);
        assert_eq!(tree.nodes.len(), 1);
        assert_eq!(tree.search_stats.total_iterations, 100);
    }
    
    #[test]
    fn test_cache_key_builder() {
        let builder = CacheKeyBuilder::new("test_prefix".to_string());
        
        assert_eq!(builder.node_key("node123"), "test_prefix:node:node123");
        assert_eq!(builder.tree_key("session456"), "test_prefix:tree:session456");
        assert_eq!(builder.result_key("session789"), "test_prefix:result:session789");
        assert_eq!(
            builder.model_key("reward", "agent1"), 
            "test_prefix:model:reward:agent1"
        );
    }
    
    // Integration tests would require a Redis instance
    // #[tokio::test]
    // async fn test_cache_operations() { ... }
}