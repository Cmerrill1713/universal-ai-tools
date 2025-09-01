use crate::cache::CacheManager;
use crate::types::*;
use crate::RedisServiceError;
use napi::{bindgen_prelude::*, JsObject};
use napi_derive::napi;
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::OnceCell;

static CACHE_MANAGER: OnceCell<Arc<CacheManager>> = OnceCell::const_new();

#[napi(object)]
pub struct JsRedisConfig {
    pub url: String,
    pub max_connections: Option<u32>,
    pub min_idle: Option<u32>,
    pub connection_timeout_ms: Option<u32>,
    pub command_timeout_ms: Option<u32>,
    pub max_retries: Option<u32>,
    pub retry_delay_ms: Option<u32>,
    pub enable_cluster: Option<bool>,
    pub cluster_nodes: Option<Vec<String>>,
    pub password: Option<String>,
    pub database: Option<u16>,
}

#[napi(object)]
pub struct JsCacheConfig {
    pub strategy: Option<String>,
    pub max_size_bytes: Option<u32>,
    pub max_entries: Option<u32>,
    pub default_ttl_seconds: Option<u32>,
    pub enable_compression: Option<bool>,
    pub compression_threshold: Option<u32>,
    pub enable_clustering: Option<bool>,
    pub enable_persistence: Option<bool>,
    pub persistence_interval_seconds: Option<u32>,
}

#[napi(object)]
pub struct JsCacheStatistics {
    pub total_entries: u32,
    pub total_size_bytes: u32,
    pub hit_count: f64,
    pub miss_count: f64,
    pub eviction_count: f64,
    pub compression_count: f64,
    pub decompression_count: f64,
    pub average_entry_size: f64,
    pub hit_rate: f64,
    pub miss_rate: f64,
    pub compression_ratio: f64,
    pub uptime_seconds: f64,
}

#[napi(object)]
pub struct JsConnectionStatus {
    pub connected: bool,
    pub url: String,
    pub active_connections: u32,
    pub idle_connections: u32,
    pub total_connections_created: f64,
    pub total_connections_closed: f64,
    pub last_error: Option<String>,
    pub reconnect_attempts: u32,
    pub using_fallback: bool,
}

#[napi(object)]
pub struct JsOperationMetrics {
    pub operation_type: String,
    pub count: f64,
    pub total_duration_ms: f64,
    pub min_duration_ms: f64,
    pub max_duration_ms: f64,
    pub avg_duration_ms: f64,
    pub success_count: f64,
    pub failure_count: f64,
    pub timeout_count: f64,
    pub success_rate: f64,
}

/// Initialize the Redis service with optional Redis and cache configurations
#[napi]
pub async fn initialize_redis_service(
    redis_config: Option<JsRedisConfig>,
    cache_config: Option<JsCacheConfig>,
) -> napi::Result<()> {
    let rust_redis_config = redis_config.map(|js_config| RedisConfig {
        url: js_config.url,
        max_connections: js_config.max_connections.unwrap_or(20),
        min_idle: js_config.min_idle.unwrap_or(5),
        connection_timeout: Duration::from_millis(js_config.connection_timeout_ms.unwrap_or(10000) as u64),
        command_timeout: Duration::from_millis(js_config.command_timeout_ms.unwrap_or(5000) as u64),
        max_retries: js_config.max_retries.unwrap_or(3),
        retry_delay: Duration::from_millis(js_config.retry_delay_ms.unwrap_or(100) as u64),
        enable_cluster: js_config.enable_cluster.unwrap_or(false),
        cluster_nodes: js_config.cluster_nodes.unwrap_or_default(),
        password: js_config.password,
        database: js_config.database.unwrap_or(0),
    });

    let rust_cache_config = cache_config.map(|js_config| {
        let mut config = CacheConfig::default();
        
        if let Some(strategy_str) = js_config.strategy {
            if let Some(strategy) = CacheStrategy::from_str(&strategy_str) {
                config.strategy = strategy;
            }
        }
        
        if let Some(max_size) = js_config.max_size_bytes {
            config.max_size_bytes = max_size as usize;
        }
        
        if let Some(max_entries) = js_config.max_entries {
            config.max_entries = max_entries as usize;
        }
        
        if let Some(ttl_seconds) = js_config.default_ttl_seconds {
            config.default_ttl = Some(Duration::from_secs(ttl_seconds as u64));
        }
        
        if let Some(enable_compression) = js_config.enable_compression {
            config.enable_compression = enable_compression;
        }
        
        if let Some(threshold) = js_config.compression_threshold {
            config.compression_threshold = threshold as usize;
        }
        
        config
    }).unwrap_or_default();

    let cache_manager = CacheManager::new(rust_redis_config, rust_cache_config)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to initialize cache manager: {}", e)))?;

    CACHE_MANAGER.set(Arc::new(cache_manager))
        .map_err(|_| napi::Error::from_reason("Cache manager already initialized".to_string()))?;

    Ok(())
}

/// Get a value from the cache
#[napi]
pub async fn cache_get(key: String) -> napi::Result<Option<String>> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    match cache_manager.get::<serde_json::Value>(&key).await {
        Ok(Some(value)) => {
            let json_str = serde_json::to_string(&value)
                .map_err(|e| napi::Error::from_reason(format!("Serialization failed: {}", e)))?;
            Ok(Some(json_str))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!("Cache get failed: {}", e))),
    }
}

/// Set a value in the cache with optional TTL
#[napi]
pub async fn cache_set(key: String, value: String, ttl_seconds: Option<u32>) -> napi::Result<()> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    let json_value: serde_json::Value = serde_json::from_str(&value)
        .map_err(|e| napi::Error::from_reason(format!("Invalid JSON value: {}", e)))?;

    let ttl = ttl_seconds.map(|seconds| Duration::from_secs(seconds as u64));

    cache_manager.set(&key, &json_value, ttl)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Cache set failed: {}", e)))?;

    Ok(())
}

/// Delete a key from the cache
#[napi]
pub async fn cache_delete(key: String) -> napi::Result<bool> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    cache_manager.delete(&key)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Cache delete failed: {}", e)))
}

/// Check if a key exists in the cache
#[napi]
pub async fn cache_exists(key: String) -> napi::Result<bool> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    cache_manager.exists(&key)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Cache exists check failed: {}", e)))
}

/// Flush all data from the cache
#[napi]
pub async fn cache_flush_all() -> napi::Result<()> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    cache_manager.flush_all()
        .await
        .map_err(|e| napi::Error::from_reason(format!("Cache flush failed: {}", e)))
}

/// Get cache statistics
#[napi]
pub async fn get_cache_statistics() -> napi::Result<JsCacheStatistics> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    let stats = cache_manager.get_statistics().await;

    Ok(JsCacheStatistics {
        total_entries: stats.total_entries as u32,
        total_size_bytes: stats.total_size_bytes as u32,
        hit_count: stats.hit_count as f64,
        miss_count: stats.miss_count as f64,
        eviction_count: stats.eviction_count as f64,
        compression_count: stats.compression_count as f64,
        decompression_count: stats.decompression_count as f64,
        average_entry_size: stats.average_entry_size,
        hit_rate: stats.hit_rate,
        miss_rate: stats.miss_rate,
        compression_ratio: stats.compression_ratio,
        uptime_seconds: stats.uptime.num_seconds() as f64,
    })
}

/// Get connection status
#[napi]
pub async fn get_connection_status() -> napi::Result<JsConnectionStatus> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    let status = cache_manager.get_connection_status().await;

    Ok(JsConnectionStatus {
        connected: status.connected,
        url: status.url,
        active_connections: status.active_connections,
        idle_connections: status.idle_connections,
        total_connections_created: status.total_connections_created as f64,
        total_connections_closed: status.total_connections_closed as f64,
        last_error: status.last_error,
        reconnect_attempts: status.reconnect_attempts,
        using_fallback: status.using_fallback,
    })
}

/// Check if Redis is available
#[napi]
pub async fn is_redis_available() -> napi::Result<bool> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    Ok(cache_manager.is_redis_available().await)
}

/// Ping Redis server
#[napi]
pub async fn ping_redis() -> napi::Result<bool> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    if cache_manager.is_redis_available().await {
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Reconnect to Redis
#[napi]
pub async fn reconnect_redis() -> napi::Result<()> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    cache_manager.reconnect_redis()
        .await
        .map_err(|e| napi::Error::from_reason(format!("Redis reconnection failed: {}", e)))
}

/// Session management functions

#[napi(object)]
pub struct JsSessionData {
    pub session_id: String,
    pub user_id: Option<String>,
    pub data: String, // JSON string
    pub created_at: String,
    pub updated_at: String,
    pub expires_at: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

/// Create a new session
#[napi]
pub async fn session_create(session_id: String, ttl_seconds: Option<u32>) -> napi::Result<JsSessionData> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    let ttl = Duration::from_secs(ttl_seconds.unwrap_or(3600) as u64);
    let session = SessionData::new(session_id.clone(), ttl);

    cache_manager.set(&format!("session:{}", session_id), &session, Some(ttl))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to create session: {}", e)))?;

    Ok(JsSessionData {
        session_id: session.session_id,
        user_id: session.user_id,
        data: serde_json::to_string(&session.data).unwrap_or_else(|_| "{}".to_string()),
        created_at: session.created_at.to_rfc3339(),
        updated_at: session.updated_at.to_rfc3339(),
        expires_at: session.expires_at.to_rfc3339(),
        ip_address: session.ip_address,
        user_agent: session.user_agent,
    })
}

/// Get a session by ID
#[napi]
pub async fn session_get(session_id: String) -> napi::Result<Option<JsSessionData>> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    match cache_manager.get::<SessionData>(&format!("session:{}", session_id)).await {
        Ok(Some(session)) => {
            if session.is_expired() {
                // Delete expired session
                let _ = cache_manager.delete(&format!("session:{}", session_id)).await;
                Ok(None)
            } else {
                Ok(Some(JsSessionData {
                    session_id: session.session_id,
                    user_id: session.user_id,
                    data: serde_json::to_string(&session.data).unwrap_or_else(|_| "{}".to_string()),
                    created_at: session.created_at.to_rfc3339(),
                    updated_at: session.updated_at.to_rfc3339(),
                    expires_at: session.expires_at.to_rfc3339(),
                    ip_address: session.ip_address,
                    user_agent: session.user_agent,
                }))
            }
        }
        Ok(None) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get session: {}", e))),
    }
}

/// Update session data
#[napi]
pub async fn session_update(session_id: String, key: String, value: String) -> napi::Result<()> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    let session_key = format!("session:{}", session_id);
    
    match cache_manager.get::<SessionData>(&session_key).await {
        Ok(Some(mut session)) => {
            let json_value: serde_json::Value = serde_json::from_str(&value)
                .map_err(|e| napi::Error::from_reason(format!("Invalid JSON value: {}", e)))?;
            
            session.set(key, json_value);
            
            let ttl = session.expires_at - chrono::Utc::now();
            let ttl_duration = Duration::from_secs(ttl.num_seconds().max(0) as u64);
            
            cache_manager.set(&session_key, &session, Some(ttl_duration))
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to update session: {}", e)))?;
            
            Ok(())
        }
        Ok(None) => Err(napi::Error::from_reason("Session not found".to_string())),
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get session: {}", e))),
    }
}

/// Delete a session
#[napi]
pub async fn session_delete(session_id: String) -> napi::Result<bool> {
    let cache_manager = CACHE_MANAGER.get()
        .ok_or_else(|| napi::Error::from_reason("Cache manager not initialized".to_string()))?;

    cache_manager.delete(&format!("session:{}", session_id))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to delete session: {}", e)))
}