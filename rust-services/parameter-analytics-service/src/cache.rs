//! High-performance Redis-based caching for analytics data
//! 
//! Provides optimized caching layer with intelligent TTL management

use crate::types::*;
use crate::error::{AnalyticsError, Result};
use redis::{Client, AsyncCommands, RedisResult};
use tokio::sync::Mutex;
use std::time::{Duration, SystemTime};
use serde::{Serialize, Deserialize};
use tracing::{debug, warn};

/// High-performance analytics cache
pub struct AnalyticsCache {
    client: Client,
    connection: Mutex<redis::aio::MultiplexedConnection>,
    default_ttl: Duration,
    stats: Mutex<CacheStatistics>,
}

#[derive(Clone, Debug)]
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
            average_response_time: Duration::from_millis(0),
            last_updated: SystemTime::now(),
        }
    }
}

impl AnalyticsCache {
    /// Create a new analytics cache
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = Client::open(redis_url)?;
        let connection = client.get_multiplexed_async_connection().await?;
        
        Ok(Self {
            client,
            connection: Mutex::new(connection),
            default_ttl: Duration::from_secs(300), // 5 minutes default
            stats: Mutex::new(CacheStatistics::default()),
        })
    }
    
    /// Get cached effectiveness data
    pub async fn get_effectiveness(&self, cache_key: &str) -> Result<Option<Vec<ParameterEffectiveness>>> {
        let start_time = std::time::Instant::now();
        
        let result = self.get_json_data::<Vec<ParameterEffectiveness>>(&format!("analytics:effectiveness:{}", cache_key)).await;
        
        let duration = start_time.elapsed();
        self.update_stats(result.is_ok(), false, duration).await;
        
        match result {
            Ok(Some(data)) => {
                debug!("Cache hit for effectiveness key: {}", cache_key);
                Ok(Some(data))
            }
            Ok(None) => {
                debug!("Cache miss for effectiveness key: {}", cache_key);
                Ok(None)
            }
            Err(e) => {
                warn!("Cache error for effectiveness key {}: {}", cache_key, e);
                Ok(None) // Graceful degradation
            }
        }
    }
    
    /// Set cached effectiveness data
    pub async fn set_effectiveness(&self, cache_key: &str, data: &[ParameterEffectiveness]) -> Result<()> {
        let start_time = std::time::Instant::now();
        
        let result = self.set_json_data(
            &format!("analytics:effectiveness:{}", cache_key),
            data,
            self.default_ttl,
        ).await;
        
        let duration = start_time.elapsed();
        self.update_stats(result.is_ok(), true, duration).await;
        
        if result.is_ok() {
            debug!("Cached effectiveness data for key: {}", cache_key);
        } else {
            warn!("Failed to cache effectiveness data for key: {}", cache_key);
        }
        
        result
    }
    
    /// Get cached insights
    pub async fn get_insights(&self, task_type: &TaskType) -> Result<Option<Vec<OptimizationInsight>>> {
        let cache_key = format!("analytics:insights:{:?}", task_type);
        let start_time = std::time::Instant::now();
        
        let result = self.get_json_data::<Vec<OptimizationInsight>>(&cache_key).await;
        
        let duration = start_time.elapsed();
        self.update_stats(result.is_ok(), false, duration).await;
        
        match result {
            Ok(data) => Ok(data),
            Err(_) => Ok(None), // Graceful degradation
        }
    }
    
    /// Set cached insights
    pub async fn set_insights(&self, task_type: &TaskType, insights: &[OptimizationInsight]) -> Result<()> {
        let cache_key = format!("analytics:insights:{:?}", task_type);
        let start_time = std::time::Instant::now();
        
        let result = self.set_json_data(&cache_key, insights, Duration::from_secs(600)).await; // 10 minutes for insights
        
        let duration = start_time.elapsed();
        self.update_stats(result.is_ok(), true, duration).await;
        
        result
    }
    
    /// Cache parameter execution for batch processing
    pub async fn cache_execution(&self, execution: &ParameterExecution) -> Result<()> {
        let cache_key = format!("analytics:executions:{}", execution.id);
        let start_time = std::time::Instant::now();
        
        let result = self.set_json_data(&cache_key, execution, Duration::from_secs(3600)).await; // 1 hour
        
        let duration = start_time.elapsed();
        self.update_stats(result.is_ok(), true, duration).await;
        
        result
    }
    
    /// Get cached execution
    pub async fn get_execution(&self, execution_id: &uuid::Uuid) -> Result<Option<ParameterExecution>> {
        let cache_key = format!("analytics:executions:{}", execution_id);
        let start_time = std::time::Instant::now();
        
        let result = self.get_json_data::<ParameterExecution>(&cache_key).await;
        
        let duration = start_time.elapsed();
        self.update_stats(result.is_ok(), false, duration).await;
        
        match result {
            Ok(data) => Ok(data),
            Err(_) => Ok(None), // Graceful degradation
        }
    }
    
    /// Cache analytics snapshot
    pub async fn cache_snapshot(&self, snapshot: &AnalyticsSnapshot) -> Result<()> {
        let cache_key = "analytics:snapshot:latest";
        let start_time = std::time::Instant::now();
        
        let result = self.set_json_data(cache_key, snapshot, Duration::from_secs(60)).await; // 1 minute
        
        let duration = start_time.elapsed();
        self.update_stats(result.is_ok(), true, duration).await;
        
        result
    }
    
    /// Get cached analytics snapshot
    pub async fn get_snapshot(&self) -> Result<Option<AnalyticsSnapshot>> {
        let cache_key = "analytics:snapshot:latest";
        let start_time = std::time::Instant::now();
        
        let result = self.get_json_data::<AnalyticsSnapshot>(cache_key).await;
        
        let duration = start_time.elapsed();
        self.update_stats(result.is_ok(), false, duration).await;
        
        match result {
            Ok(data) => Ok(data),
            Err(_) => Ok(None), // Graceful degradation
        }
    }
    
    /// Increment counter for analytics tracking
    pub async fn increment_counter(&self, counter_name: &str) -> Result<u64> {
        let cache_key = format!("analytics:counters:{}", counter_name);
        
        let mut conn = self.connection.lock().await;
        let result: RedisResult<u64> = conn.incr(&cache_key, 1).await;
        
        match result {
            Ok(value) => {
                // Set expiry if this is a new counter
                if value == 1 {
                    let _: RedisResult<()> = conn.expire(&cache_key, 86400).await; // 24 hours
                }
                Ok(value)
            }
            Err(e) => Err(AnalyticsError::Cache(e)),
        }
    }
    
    /// Get counter value
    pub async fn get_counter(&self, counter_name: &str) -> Result<u64> {
        let cache_key = format!("analytics:counters:{}", counter_name);
        
        let mut conn = self.connection.lock().await;
        let result: RedisResult<Option<u64>> = conn.get(&cache_key).await;
        
        match result {
            Ok(Some(value)) => Ok(value),
            Ok(None) => Ok(0),
            Err(e) => Err(AnalyticsError::Cache(e)),
        }
    }
    
    /// Clear cache with pattern
    pub async fn clear_pattern(&self, pattern: &str) -> Result<u64> {
        let mut conn = self.connection.lock().await;
        
        // Get keys matching pattern
        let keys: RedisResult<Vec<String>> = conn.keys(pattern).await;
        
        match keys {
            Ok(key_list) if !key_list.is_empty() => {
                let result: RedisResult<u64> = conn.del(&key_list).await;
                match result {
                    Ok(deleted) => {
                        debug!("Cleared {} keys matching pattern: {}", deleted, pattern);
                        Ok(deleted)
                    }
                    Err(e) => Err(AnalyticsError::Cache(e)),
                }
            }
            Ok(_) => Ok(0), // No keys to delete
            Err(e) => Err(AnalyticsError::Cache(e)),
        }
    }
    
    /// Get cache statistics
    pub async fn get_statistics(&self) -> CacheStatistics {
        self.stats.lock().await.clone()
    }
    
    /// Health check
    pub async fn health_check(&self) -> Result<bool> {
        let mut conn = self.connection.lock().await;
        let result: RedisResult<String> = redis::cmd("PING").query_async(&mut *conn).await;
        Ok(result.is_ok())
    }
    
    /// Close cache connection
    pub async fn close(&self) -> Result<()> {
        // Connection will be dropped automatically
        debug!("Analytics cache connection closed");
        Ok(())
    }
    
    // Private helper methods
    
    async fn get_json_data<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: for<'de> Deserialize<'de>,
    {
        let mut conn = self.connection.lock().await;
        let result: RedisResult<Option<String>> = conn.get(key).await;
        
        match result {
            Ok(Some(json_str)) => {
                match serde_json::from_str(&json_str) {
                    Ok(data) => Ok(Some(data)),
                    Err(e) => {
                        warn!("Failed to deserialize cached data for key {}: {}", key, e);
                        Ok(None)
                    }
                }
            }
            Ok(None) => Ok(None),
            Err(e) => Err(AnalyticsError::Cache(e)),
        }
    }
    
    async fn set_json_data<T>(&self, key: &str, data: &T, ttl: Duration) -> Result<()>
    where
        T: Serialize + ?Sized,
    {
        let json_str = serde_json::to_string(data)?;
        
        let mut conn = self.connection.lock().await;
        let result: RedisResult<()> = conn.set_ex(key, json_str, ttl.as_secs()).await;
        
        match result {
            Ok(()) => Ok(()),
            Err(e) => Err(AnalyticsError::Cache(e)),
        }
    }
    
    async fn update_stats(&self, success: bool, is_write: bool, duration: std::time::Duration) {
        let mut stats = self.stats.lock().await;
        
        stats.total_operations += 1;
        
        if success {
            if is_write {
                stats.writes += 1;
            } else {
                stats.hits += 1;
            }
        } else {
            if !is_write {
                stats.misses += 1;
            }
            stats.errors += 1;
        }
        
        // Update rolling average response time
        let current_avg_ms = stats.average_response_time.as_millis() as f64;
        let new_duration_ms = duration.as_millis() as f64;
        let operations = stats.total_operations as f64;
        
        let new_avg_ms = (current_avg_ms * (operations - 1.0) + new_duration_ms) / operations;
        stats.average_response_time = Duration::from_millis(new_avg_ms as u64);
        
        stats.last_updated = SystemTime::now();
    }
}