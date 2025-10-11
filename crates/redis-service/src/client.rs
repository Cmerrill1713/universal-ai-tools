use crate::types::*;
use crate::RedisServiceError;
use deadpool_redis::{Config, Pool, Runtime};
use redis::{aio::ConnectionManager, AsyncCommands, RedisResult};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

pub struct RedisClient {
    #[allow(dead_code)]
    pool: Pool,
    connection_manager: Arc<RwLock<Option<ConnectionManager>>>,
    config: RedisConfig,
    status: Arc<RwLock<ConnectionStatus>>,
    operation_metrics: Arc<RwLock<HashMap<OperationType, OperationMetrics>>>,
}

impl RedisClient {
    pub async fn new(config: RedisConfig) -> Result<Self, RedisServiceError> {
        let redis_config = Config::from_url(config.url.clone());
        let pool = redis_config
            .builder()
            .map_err(|e| RedisServiceError::ConnectionError {
                error: format!("Failed to create pool builder: {}", e),
            })?
            .max_size(config.max_connections as usize)
            .runtime(Runtime::Tokio1)
            .build()
            .map_err(|e| RedisServiceError::ConnectionError {
                error: format!("Failed to build connection pool: {}", e),
            })?;

        let status = Arc::new(RwLock::new(ConnectionStatus::new(config.url.clone())));
        let operation_metrics = Arc::new(RwLock::new(Self::init_operation_metrics()));

        let client = Self {
            pool,
            connection_manager: Arc::new(RwLock::new(None)),
            config,
            status,
            operation_metrics,
        };

        // Try to establish initial connection
        client.connect().await?;

        Ok(client)
    }

    pub async fn connect(&self) -> Result<(), RedisServiceError> {
        let start = Instant::now();

        match redis::Client::open(self.config.url.as_str()) {
            Ok(client) => {
                match ConnectionManager::new(client).await {
                    Ok(manager) => {
                        *self.connection_manager.write().await = Some(manager);

                        let mut status = self.status.write().await;
                        status.record_connection();

                        info!("Redis connection established in {:?}", start.elapsed());
                        Ok(())
                    }
                    Err(e) => {
                        let error_msg = format!("Failed to create connection manager: {}", e);

                        let mut status = self.status.write().await;
                        status.record_error(error_msg.clone());

                        error!("{}", error_msg);
                        Err(RedisServiceError::ConnectionError { error: error_msg })
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("Failed to open Redis client: {}", e);

                let mut status = self.status.write().await;
                status.record_error(error_msg.clone());

                error!("{}", error_msg);
                Err(RedisServiceError::ConnectionError { error: error_msg })
            }
        }
    }

    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Get;

        let result = self.execute_with_retry(|mut conn| async move {
            let data: Option<Vec<u8>> = conn.get(key).await?;
            Ok(data)
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;

        match result {
            Ok(Some(data)) => {
                let deserialized = bincode::deserialize(&data)
                    .map_err(|e| RedisServiceError::DeserializationError {
                        error: format!("Failed to deserialize value: {}", e),
                    })?;
                Ok(Some(deserialized))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub async fn get_raw(&self, key: &str) -> Result<Option<Vec<u8>>, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Get;

        let result = self.execute_with_retry(|mut conn| async move {
            let data: Option<Vec<u8>> = conn.get(key).await?;
            Ok(data)
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Option<Duration>) -> Result<(), RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Set;

        let serialized = bincode::serialize(value)
            .map_err(|e| RedisServiceError::SerializationError {
                error: format!("Failed to serialize value: {}", e),
            })?;

        let result = if let Some(ttl_duration) = ttl {
            let ttl_seconds = ttl_duration.as_secs() as i64;
            self.execute_with_retry(|mut conn| {
                let key = key.to_string();
                let data = serialized.clone();
                async move {
                    conn.set_ex::<_, _, ()>(key, data, ttl_seconds as u64).await?;
                    Ok(())
                }
            }).await
        } else {
            self.execute_with_retry(|mut conn| {
                let key = key.to_string();
                let data = serialized.clone();
                async move {
                    conn.set::<_, _, ()>(key, data).await?;
                    Ok(())
                }
            }).await
        };

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn set_raw(&self, key: &str, value: Vec<u8>, ttl: Option<Duration>) -> Result<(), RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Set;

        let result = if let Some(ttl_duration) = ttl {
            let ttl_seconds = ttl_duration.as_secs() as i64;
            self.execute_with_retry(|mut conn| {
                let key = key.to_string();
                let data = value.clone();
                async move {
                    conn.set_ex::<_, _, ()>(key, data, ttl_seconds as u64).await?;
                    Ok(())
                }
            }).await
        } else {
            self.execute_with_retry(|mut conn| {
                let key = key.to_string();
                let data = value.clone();
                async move {
                    conn.set::<_, _, ()>(key, data).await?;
                    Ok(())
                }
            }).await
        };

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn delete(&self, key: &str) -> Result<bool, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Delete;

        let result = self.execute_with_retry(|mut conn| {
            let key = key.to_string();
            async move {
                let deleted: u32 = conn.del(key).await?;
                Ok(deleted > 0)
            }
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn exists(&self, key: &str) -> Result<bool, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Exists;

        let result = self.execute_with_retry(|mut conn| {
            let key = key.to_string();
            async move {
                let exists: bool = conn.exists(key).await?;
                Ok(exists)
            }
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn expire(&self, key: &str, ttl: Duration) -> Result<bool, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Expire;

        let ttl_seconds = ttl.as_secs() as i64;
        let result = self.execute_with_retry(|mut conn| {
            let key = key.to_string();
            async move {
                let result: bool = conn.expire(key, ttl_seconds).await?;
                Ok(result)
            }
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn ttl(&self, key: &str) -> Result<Option<Duration>, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::TTL;

        let result = self.execute_with_retry(|mut conn| {
            let key = key.to_string();
            async move {
                let ttl: i64 = conn.ttl(key).await?;
                Ok(if ttl > 0 {
                    Some(Duration::from_secs(ttl as u64))
                } else {
                    None
                })
            }
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn keys(&self, pattern: &str) -> Result<Vec<String>, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Keys;

        let result = self.execute_with_retry(|mut conn| {
            let pattern = pattern.to_string();
            async move {
                let keys: Vec<String> = conn.keys(pattern).await?;
                Ok(keys)
            }
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn flush_all(&self) -> Result<(), RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::FlushAll;

        let result = self.execute_with_retry(|mut conn| async move {
            redis::cmd("FLUSHALL").query_async::<_, ()>(&mut conn).await?;
            Ok(())
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn flush_db(&self) -> Result<(), RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::FlushDB;

        let result = self.execute_with_retry(|mut conn| async move {
            redis::cmd("FLUSHDB").query_async::<_, ()>(&mut conn).await?;
            Ok(())
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn ping(&self) -> Result<bool, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Ping;

        let result = self.execute_with_retry(|mut conn| async move {
            let pong: String = redis::cmd("PING").query_async(&mut conn).await?;
            Ok(pong == "PONG")
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn info(&self) -> Result<String, RedisServiceError> {
        let start = Instant::now();
        let operation = OperationType::Info;

        let result = self.execute_with_retry(|mut conn| async move {
            let info: String = redis::cmd("INFO").query_async(&mut conn).await?;
            Ok(info)
        }).await;

        self.record_operation_metrics(operation, start, result.is_ok(), false).await;
        result
    }

    pub async fn get_status(&self) -> ConnectionStatus {
        self.status.read().await.clone()
    }

    pub async fn get_operation_metrics(&self) -> Vec<OperationMetrics> {
        self.operation_metrics.read().await.values().cloned().collect()
    }

    async fn execute_with_retry<F, Fut, T>(&self, f: F) -> Result<T, RedisServiceError>
    where
        F: Fn(ConnectionManager) -> Fut + Clone,
        Fut: std::future::Future<Output = RedisResult<T>>,
    {
        let mut retries = 0;
        let max_retries = self.config.max_retries;

        loop {
            // Check if we have a connection manager
            let mut conn_guard = self.connection_manager.write().await;

            if conn_guard.is_none() {
                drop(conn_guard);
                // Try to reconnect
                if let Err(e) = self.connect().await {
                    if retries >= max_retries {
                        return Err(e);
                    }
                    retries += 1;
                    tokio::time::sleep(self.config.retry_delay).await;
                    continue;
                }
                conn_guard = self.connection_manager.write().await;
            }

            if let Some(conn) = conn_guard.as_ref() {
                match tokio::time::timeout(self.config.command_timeout, f(conn.clone())).await {
                    Ok(Ok(result)) => return Ok(result),
                    Ok(Err(e)) => {
                        warn!("Redis operation failed: {}", e);
                        if retries >= max_retries {
                            return Err(RedisServiceError::ConnectionError {
                                error: format!("Operation failed after {} retries: {}", max_retries, e),
                            });
                        }
                    }
                    Err(_) => {
                        warn!("Redis operation timed out");
                        if retries >= max_retries {
                            return Err(RedisServiceError::OperationTimeout {
                                operation: "redis_command".to_string(),
                            });
                        }
                    }
                }
            }

            retries += 1;
            tokio::time::sleep(self.config.retry_delay).await;

            // Mark connection as disconnected and try to reconnect
            drop(conn_guard);
            let mut status = self.status.write().await;
            status.record_disconnection();
            status.record_reconnect_attempt();
            drop(status);

            *self.connection_manager.write().await = None;
        }
    }

    async fn record_operation_metrics(&self, operation: OperationType, start: Instant, success: bool, timeout: bool) {
        let duration = start.elapsed();
        let mut metrics = self.operation_metrics.write().await;

        metrics
            .entry(operation)
            .or_insert_with(|| OperationMetrics::new(operation.to_string()))
            .record(duration, success, timeout);
    }

    fn init_operation_metrics() -> HashMap<OperationType, OperationMetrics> {
        use OperationType::*;
        let operations = vec![
            Get, Set, Delete, Exists, Expire, TTL, Keys,
            FlushAll, FlushDB, Ping, Info, Subscribe, Unsubscribe, Publish, Transaction
        ];

        operations
            .into_iter()
            .map(|op| (op, OperationMetrics::new(op.to_string())))
            .collect()
    }
}

use std::collections::HashMap;
