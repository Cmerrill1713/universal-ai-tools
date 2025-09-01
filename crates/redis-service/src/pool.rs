use crate::types::*;
use crate::RedisServiceError;
use deadpool_redis::{Config, Pool as DeadPool, Runtime};
use redis::aio::ConnectionManager;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

pub struct ConnectionPool {
    pool: DeadPool,
    config: RedisConfig,
    metrics: Arc<RwLock<PoolMetrics>>,
}

#[derive(Debug, Clone)]
pub struct PoolMetrics {
    pub connections_created: u64,
    pub connections_closed: u64,
    pub connections_recycled: u64,
    pub wait_time_total: std::time::Duration,
    pub wait_count: u64,
    pub timeouts: u64,
}

impl ConnectionPool {
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

        info!("Connection pool created with max {} connections", config.max_connections);

        Ok(Self {
            pool,
            config,
            metrics: Arc::new(RwLock::new(PoolMetrics {
                connections_created: 0,
                connections_closed: 0,
                connections_recycled: 0,
                wait_time_total: std::time::Duration::from_secs(0),
                wait_count: 0,
                timeouts: 0,
            })),
        })
    }

    pub async fn get_connection(&self) -> Result<deadpool_redis::Connection, RedisServiceError> {
        let start = std::time::Instant::now();
        
        match tokio::time::timeout(self.config.connection_timeout, self.pool.get()).await {
            Ok(Ok(conn)) => {
                let wait_time = start.elapsed();
                
                let mut metrics = self.metrics.write().await;
                metrics.wait_time_total += wait_time;
                metrics.wait_count += 1;
                
                debug!("Got connection from pool in {:?}", wait_time);
                Ok(conn)
            }
            Ok(Err(e)) => {
                warn!("Failed to get connection from pool: {}", e);
                Err(RedisServiceError::PoolExhausted)
            }
            Err(_) => {
                let mut metrics = self.metrics.write().await;
                metrics.timeouts += 1;
                
                warn!("Connection pool timeout");
                Err(RedisServiceError::OperationTimeout {
                    operation: "get_connection".to_string(),
                })
            }
        }
    }

    pub async fn get_metrics(&self) -> PoolMetrics {
        self.metrics.read().await.clone()
    }

    pub fn status(&self) -> deadpool_redis::Status {
        self.pool.status()
    }

    pub async fn resize(&self, _new_max_size: usize) {
        // Note: DeadPool doesn't support dynamic resizing
        // This would require recreating the pool
        warn!("Pool resize requested but not supported by DeadPool");
    }
}