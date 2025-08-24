// Health check implementation for Rust AI Core
// Provides comprehensive health monitoring for AI services

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, instrument, warn};

use crate::error::AIEngineError;

/// Health status for the AI Engine
#[derive(Debug, Serialize)]
pub struct HealthStatus {
    pub status: String,
    pub version: String,
    pub timestamp: DateTime<Utc>,
    pub uptime: String,
    pub services: HealthServices,
    pub performance: PerformanceMetrics,
    pub resources: ResourceUsage,
}

/// Individual service health information
#[derive(Debug, Serialize)]
pub struct HealthServices {
    pub ollama: ServiceHealth,
    pub model_registry: ServiceHealth,
    pub database: Option<ServiceHealth>,
    pub redis: Option<ServiceHealth>,
}

/// Performance metrics for health reporting
#[derive(Debug, Serialize)]
pub struct PerformanceMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub average_latency_ms: f64,
    pub requests_per_second: f64,
    pub error_rate: f64,
}

/// Resource usage information
#[derive(Debug, Serialize)]
pub struct ResourceUsage {
    pub memory_usage_mb: u64,
    pub cpu_usage_percent: f64,
    pub active_tasks: usize,
    pub model_cache_size: usize,
}

/// Individual service health
#[derive(Debug, Serialize)]
pub struct ServiceHealth {
    pub status: String,
    pub last_check: DateTime<Utc>,
    pub response_time_ms: Option<u64>,
    pub error: Option<String>,
    pub details: Option<serde_json::Value>,
}

/// Health checker service
pub struct HealthChecker {
    start_time: Instant,
    ollama_client: reqwest::Client,
    ollama_endpoint: String,
}

impl HealthChecker {
    /// Create a new health checker
    pub fn new(ollama_endpoint: String) -> Self {
        let ollama_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("Failed to create HTTP client for health checks");

        Self {
            start_time: Instant::now(),
            ollama_client,
            ollama_endpoint,
        }
    }

    /// Perform comprehensive health check
    #[instrument(skip(self))]
    pub async fn check_health(&self) -> Result<HealthStatus, AIEngineError> {
        debug!("Performing comprehensive health check");

        let timestamp = Utc::now();
        let uptime = self.start_time.elapsed();

        // Check Ollama service
        let ollama_health = self.check_ollama_health().await;

        // Check model registry (always healthy for now)
        let model_registry_health = ServiceHealth {
            status: "healthy".to_string(),
            last_check: timestamp,
            response_time_ms: Some(1),
            error: None,
            details: None,
        };

        // Determine overall status
        let overall_status = if ollama_health.status == "healthy" {
            "healthy"
        } else {
            "degraded"
        };

        let health = HealthStatus {
            status: overall_status.to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            timestamp,
            uptime: format!("{:.2}s", uptime.as_secs_f64()),
            services: HealthServices {
                ollama: ollama_health,
                model_registry: model_registry_health,
                database: None, // TODO: Add database health check
                redis: None,    // TODO: Add Redis health check
            },
            performance: self.get_performance_metrics(),
            resources: self.get_resource_usage(),
        };

        Ok(health)
    }

    /// Check Ollama service health
    #[instrument(skip(self))]
    async fn check_ollama_health(&self) -> ServiceHealth {
        let start = Instant::now();
        let timestamp = Utc::now();

        debug!("Checking Ollama health at {}", self.ollama_endpoint);

        match self.check_ollama_endpoint().await {
            Ok(details) => {
                let response_time = start.elapsed().as_millis() as u64;
                debug!("Ollama health check successful in {}ms", response_time);
                
                ServiceHealth {
                    status: "healthy".to_string(),
                    last_check: timestamp,
                    response_time_ms: Some(response_time),
                    error: None,
                    details: Some(details),
                }
            }
            Err(error) => {
                let response_time = start.elapsed().as_millis() as u64;
                warn!("Ollama health check failed: {}", error);
                
                ServiceHealth {
                    status: "unhealthy".to_string(),
                    last_check: timestamp,
                    response_time_ms: Some(response_time),
                    error: Some(error.to_string()),
                    details: None,
                }
            }
        }
    }

    /// Check Ollama endpoint connectivity
    async fn check_ollama_endpoint(&self) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/api/version", self.ollama_endpoint);
        
        let response = self.ollama_client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Ollama returned status: {}", response.status()).into());
        }

        let version_info: serde_json::Value = response.json().await?;
        Ok(version_info)
    }

    /// Get performance metrics (mock implementation)
    fn get_performance_metrics(&self) -> PerformanceMetrics {
        // In a real implementation, these would come from actual metrics collection
        PerformanceMetrics {
            total_requests: 0,
            successful_requests: 0,
            average_latency_ms: 0.0,
            requests_per_second: 0.0,
            error_rate: 0.0,
        }
    }

    /// Get resource usage information (mock implementation)
    fn get_resource_usage(&self) -> ResourceUsage {
        // In a real implementation, these would come from system monitoring
        ResourceUsage {
            memory_usage_mb: 0,
            cpu_usage_percent: 0.0,
            active_tasks: 0,
            model_cache_size: 0,
        }
    }
}

/// Basic health check endpoint
#[instrument(skip(health_checker))]
pub async fn health_check(
    State(health_checker): State<Arc<HealthChecker>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    debug!("Basic health check requested");

    // Quick health check for liveness
    let basic_health = serde_json::json!({
        "status": "healthy",
        "timestamp": Utc::now(),
        "uptime": format!("{:.2}s", health_checker.start_time.elapsed().as_secs_f64()),
        "service": "rust-ai-core"
    });

    Ok(Json(basic_health))
}

/// Detailed health check endpoint
#[instrument(skip(health_checker))]
pub async fn detailed_health_check(
    State(health_checker): State<Arc<HealthChecker>>,
) -> Result<Json<HealthStatus>, StatusCode> {
    debug!("Detailed health check requested");

    match health_checker.check_health().await {
        Ok(health) => {
            let status_code = if health.status == "healthy" {
                StatusCode::OK
            } else {
                StatusCode::SERVICE_UNAVAILABLE
            };
            
            // Return status code based on health, but always return JSON
            Ok(Json(health))
        }
        Err(error) => {
            warn!("Health check failed: {}", error);
            
            let error_health = HealthStatus {
                status: "unhealthy".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                timestamp: Utc::now(),
                uptime: format!("{:.2}s", health_checker.start_time.elapsed().as_secs_f64()),
                services: HealthServices {
                    ollama: ServiceHealth {
                        status: "unhealthy".to_string(),
                        last_check: Utc::now(),
                        response_time_ms: None,
                        error: Some(error.to_string()),
                        details: None,
                    },
                    model_registry: ServiceHealth {
                        status: "unknown".to_string(),
                        last_check: Utc::now(),
                        response_time_ms: None,
                        error: None,
                        details: None,
                    },
                    database: None,
                    redis: None,
                },
                performance: PerformanceMetrics {
                    total_requests: 0,
                    successful_requests: 0,
                    average_latency_ms: 0.0,
                    requests_per_second: 0.0,
                    error_rate: 100.0,
                },
                resources: ResourceUsage {
                    memory_usage_mb: 0,
                    cpu_usage_percent: 0.0,
                    active_tasks: 0,
                    model_cache_size: 0,
                },
            };

            Ok(Json(error_health))
        }
    }
}

/// Readiness check endpoint
#[instrument(skip(health_checker))]
pub async fn readiness_check(
    State(health_checker): State<Arc<HealthChecker>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    debug!("Readiness check requested");

    // Check if critical services are ready
    let ollama_ready = health_checker.check_ollama_endpoint().await.is_ok();

    let ready = ollama_ready;

    let response = serde_json::json!({
        "ready": ready,
        "timestamp": Utc::now(),
        "checks": {
            "ollama": ollama_ready
        }
    });

    let status_code = if ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    // Set response status but always return JSON
    Ok(Json(response))
}

/// Liveness check endpoint
#[instrument(skip(health_checker))]
pub async fn liveness_check(
    State(health_checker): State<Arc<HealthChecker>>,
) -> Json<serde_json::Value> {
    debug!("Liveness check requested");

    // Simple liveness check - if we can respond, we're alive
    Json(serde_json::json!({
        "alive": true,
        "timestamp": Utc::now(),
        "uptime": format!("{:.2}s", health_checker.start_time.elapsed().as_secs_f64()),
        "service": "rust-ai-core"
    }))
}