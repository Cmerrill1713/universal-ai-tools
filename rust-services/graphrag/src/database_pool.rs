//! Database connection pooling configuration for production-grade performance
//! Optimizes connections for PostgreSQL, Neo4j, and Redis caching

use anyhow::{Result, Context};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;
use tracing::{info, warn};

/// Database pool configuration for production environments
#[derive(Debug, Clone)]
pub struct DatabasePoolConfig {
    pub postgres_max_connections: u32,
    pub postgres_min_connections: u32,
    pub postgres_acquire_timeout: Duration,
    pub postgres_idle_timeout: Duration,
    pub postgres_max_lifetime: Duration,
    pub redis_max_connections: u32,
    pub redis_connection_timeout: Duration,
}

impl Default for DatabasePoolConfig {
    fn default() -> Self {
        Self {
            // PostgreSQL/Supabase pool configuration
            postgres_max_connections: 20,
            postgres_min_connections: 5,
            postgres_acquire_timeout: Duration::from_secs(10),
            postgres_idle_timeout: Duration::from_secs(600), // 10 minutes
            postgres_max_lifetime: Duration::from_secs(1800), // 30 minutes
            
            // Redis pool configuration  
            redis_max_connections: 10,
            redis_connection_timeout: Duration::from_secs(5),
        }
    }
}

impl DatabasePoolConfig {
    /// Create production-optimized configuration
    pub fn production() -> Self {
        Self {
            postgres_max_connections: 50,
            postgres_min_connections: 10,
            postgres_acquire_timeout: Duration::from_secs(15),
            postgres_idle_timeout: Duration::from_secs(900), // 15 minutes
            postgres_max_lifetime: Duration::from_secs(3600), // 1 hour
            redis_max_connections: 20,
            redis_connection_timeout: Duration::from_secs(10),
        }
    }
    
    /// Create development configuration with lower limits
    pub fn development() -> Self {
        Self {
            postgres_max_connections: 10,
            postgres_min_connections: 2,
            postgres_acquire_timeout: Duration::from_secs(5),
            postgres_idle_timeout: Duration::from_secs(300), // 5 minutes  
            postgres_max_lifetime: Duration::from_secs(900), // 15 minutes
            redis_max_connections: 5,
            redis_connection_timeout: Duration::from_secs(3),
        }
    }
}

/// Enhanced PostgreSQL connection pool with production optimizations
pub async fn create_postgres_pool(
    database_url: &str, 
    config: &DatabasePoolConfig
) -> Result<PgPool> {
    info!("🔗 Configuring PostgreSQL connection pool...");
    info!("  Max connections: {}", config.postgres_max_connections);
    info!("  Min connections: {}", config.postgres_min_connections);
    info!("  Acquire timeout: {:?}", config.postgres_acquire_timeout);
    info!("  Idle timeout: {:?}", config.postgres_idle_timeout);
    info!("  Max lifetime: {:?}", config.postgres_max_lifetime);
    
    let pool = PgPoolOptions::new()
        .max_connections(config.postgres_max_connections)
        .min_connections(config.postgres_min_connections)
        .acquire_timeout(config.postgres_acquire_timeout)
        .idle_timeout(config.postgres_idle_timeout)
        .max_lifetime(config.postgres_max_lifetime)
        .test_before_acquire(true) // Validate connections before use
        .connect(database_url)
        .await
        .context("Failed to create PostgreSQL connection pool")?;
    
    // Test the connection pool
    let test_result = sqlx::query("SELECT 1 as test")
        .fetch_one(&pool)
        .await;
        
    match test_result {
        Ok(_) => {
            info!("✅ PostgreSQL connection pool created and tested successfully");
        }
        Err(e) => {
            warn!("⚠️ PostgreSQL connection test failed: {}", e);
            return Err(anyhow::anyhow!("PostgreSQL connection pool test failed: {}", e));
        }
    }
    
    Ok(pool)
}

/// Neo4j connection pool management
#[derive(Debug, Clone)]
pub struct Neo4jPoolConfig {
    pub max_connections: usize,
    pub connection_timeout: Duration,
    pub keep_alive_interval: Duration,
}

impl Default for Neo4jPoolConfig {
    fn default() -> Self {
        Self {
            max_connections: 10,
            connection_timeout: Duration::from_secs(10),
            keep_alive_interval: Duration::from_secs(30),
        }
    }
}

impl Neo4jPoolConfig {
    pub fn production() -> Self {
        Self {
            max_connections: 25,
            connection_timeout: Duration::from_secs(15),
            keep_alive_interval: Duration::from_secs(60),
        }
    }
}

/// Redis connection pool configuration
#[derive(Debug, Clone)]
pub struct RedisPoolConfig {
    pub max_pool_size: u32,
    pub min_idle: u32,
    pub connection_timeout: Duration,
    pub response_timeout: Duration,
}

impl Default for RedisPoolConfig {
    fn default() -> Self {
        Self {
            max_pool_size: 10,
            min_idle: 2,
            connection_timeout: Duration::from_secs(5),
            response_timeout: Duration::from_secs(3),
        }
    }
}

impl RedisPoolConfig {
    pub fn production() -> Self {
        Self {
            max_pool_size: 50,
            min_idle: 10,
            connection_timeout: Duration::from_secs(10),
            response_timeout: Duration::from_secs(5),
        }
    }
}

/// Database health monitoring
pub struct DatabaseHealthMonitor {
    postgres_pool: PgPool,
}

impl DatabaseHealthMonitor {
    pub fn new(postgres_pool: PgPool) -> Self {
        Self { postgres_pool }
    }
    
    /// Check PostgreSQL pool health
    pub async fn check_postgres_health(&self) -> Result<PoolHealthStats> {
        let pool_state = self.postgres_pool.size();
        let connections_idle = self.postgres_pool.num_idle();
        
        // Test connection with simple query
        let query_start = std::time::Instant::now();
        let test_result = sqlx::query("SELECT 1")
            .fetch_one(&self.postgres_pool)
            .await;
        let query_duration = query_start.elapsed();
        
        Ok(PoolHealthStats {
            total_connections: pool_state,
            active_connections: pool_state - connections_idle as u32,
            idle_connections: connections_idle as u32,
            is_healthy: test_result.is_ok(),
            response_time_ms: query_duration.as_millis() as u64,
            error_message: test_result.err().map(|e| e.to_string()),
        })
    }
}

/// Pool health statistics for monitoring
#[derive(Debug, serde::Serialize)]
pub struct PoolHealthStats {
    pub total_connections: u32,
    pub active_connections: u32, 
    pub idle_connections: u32,
    pub is_healthy: bool,
    pub response_time_ms: u64,
    pub error_message: Option<String>,
}

/// Connection pool metrics for Prometheus
pub struct PoolMetrics {
    pub postgres_active_connections: prometheus::Gauge,
    pub postgres_idle_connections: prometheus::Gauge,
    pub postgres_total_connections: prometheus::Gauge,
    pub postgres_response_time: prometheus::Histogram,
    pub neo4j_active_connections: prometheus::Gauge,
    pub redis_active_connections: prometheus::Gauge,
}

impl PoolMetrics {
    pub fn new() -> Result<Self> {
        Ok(Self {
            postgres_active_connections: prometheus::Gauge::with_opts(
                prometheus::Opts::new("postgres_active_connections", "Number of active PostgreSQL connections")
            )?,
            postgres_idle_connections: prometheus::Gauge::with_opts(
                prometheus::Opts::new("postgres_idle_connections", "Number of idle PostgreSQL connections")
            )?,
            postgres_total_connections: prometheus::Gauge::with_opts(
                prometheus::Opts::new("postgres_total_connections", "Total PostgreSQL connections in pool")
            )?,
            postgres_response_time: prometheus::Histogram::with_opts(
                prometheus::HistogramOpts::new("postgres_response_time", "PostgreSQL query response time")
            )?,
            neo4j_active_connections: prometheus::Gauge::with_opts(
                prometheus::Opts::new("neo4j_active_connections", "Number of active Neo4j connections")
            )?,
            redis_active_connections: prometheus::Gauge::with_opts(
                prometheus::Opts::new("redis_active_connections", "Number of active Redis connections")
            )?,
        })
    }
    
    /// Update metrics from pool health stats
    pub fn update_postgres_metrics(&self, stats: &PoolHealthStats) {
        self.postgres_active_connections.set(stats.active_connections as f64);
        self.postgres_idle_connections.set(stats.idle_connections as f64);
        self.postgres_total_connections.set(stats.total_connections as f64);
        self.postgres_response_time.observe(stats.response_time_ms as f64 / 1000.0);
    }
}

/// Periodic pool health check task
pub async fn start_pool_health_monitoring(
    monitor: DatabaseHealthMonitor,
    metrics: PoolMetrics,
    interval: Duration,
) {
    let mut interval_timer = tokio::time::interval(interval);
    
    loop {
        interval_timer.tick().await;
        
        match monitor.check_postgres_health().await {
            Ok(stats) => {
                if !stats.is_healthy {
                    warn!("🔴 PostgreSQL pool health check failed: {:?}", stats.error_message);
                } else {
                    info!("💚 PostgreSQL pool healthy - {} active, {} idle connections", 
                          stats.active_connections, stats.idle_connections);
                }
                metrics.update_postgres_metrics(&stats);
            }
            Err(e) => {
                warn!("❌ Pool health check error: {}", e);
            }
        }
    }
}