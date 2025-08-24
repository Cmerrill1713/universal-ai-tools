use crate::{ServiceInfo, ServiceStatus, Config};
use anyhow::Result;
use reqwest::Client;
use std::time::{Duration, Instant};
use tracing::{debug, error, info, warn};

pub struct HealthChecker {
    client: Client,
    config: Config,
}

impl HealthChecker {
    pub async fn new(config: &Config, client: Client) -> Result<Self> {
        Ok(Self {
            client,
            config: config.clone(),
        })
    }

    pub async fn check_service_health(&self, service: &ServiceInfo) -> Result<ServiceHealthResult> {
        let health_url = format!(
            "http://{}:{}{}",
            service.address,
            service.port,
            service.health_endpoint
        );

        debug!("Checking health for service {} at {}", service.name, health_url);

        let start_time = Instant::now();
        
        let health_result = match self.perform_health_check(&health_url).await {
            Ok(response) => {
                let response_time = start_time.elapsed().as_millis() as u64;
                
                if response.status().is_success() {
                    info!("Service {} is healthy ({}ms)", service.name, response_time);
                    ServiceHealthResult {
                        service_id: service.id.clone(),
                        status: ServiceStatus::Healthy,
                        response_time_ms: Some(response_time),
                        error_message: None,
                        checked_at: chrono::Utc::now(),
                    }
                } else {
                    warn!("Service {} returned unhealthy status: {}", service.name, response.status());
                    ServiceHealthResult {
                        service_id: service.id.clone(),
                        status: ServiceStatus::Unhealthy,
                        response_time_ms: Some(response_time),
                        error_message: Some(format!("HTTP {}", response.status())),
                        checked_at: chrono::Utc::now(),
                    }
                }
            }
            Err(e) => {
                let response_time = start_time.elapsed().as_millis() as u64;
                error!("Health check failed for service {}: {}", service.name, e);
                ServiceHealthResult {
                    service_id: service.id.clone(),
                    status: ServiceStatus::Unhealthy,
                    response_time_ms: Some(response_time),
                    error_message: Some(e.to_string()),
                    checked_at: chrono::Utc::now(),
                }
            }
        };

        Ok(health_result)
    }

    async fn perform_health_check(&self, health_url: &str) -> Result<reqwest::Response, reqwest::Error> {
        self.client
            .get(health_url)
            .timeout(Duration::from_secs(self.config.health_checker.timeout_seconds))
            .send()
            .await
    }

    pub async fn check_multiple_services(&self, services: &[ServiceInfo]) -> Vec<ServiceHealthResult> {
        let mut results = Vec::new();

        // Check services concurrently
        let health_futures = services.iter().map(|service| {
            self.check_service_health(service)
        });

        let health_results = futures::future::join_all(health_futures).await;

        for result in health_results {
            match result {
                Ok(health_result) => results.push(health_result),
                Err(e) => error!("Failed to check service health: {}", e),
            }
        }

        results
    }

    pub async fn get_health_check_stats(&self) -> Result<serde_json::Value> {
        Ok(serde_json::json!({
            "health_checker": {
                "timeout_seconds": self.config.health_checker.timeout_seconds,
                "failure_threshold": self.config.health_checker.failure_threshold,
                "success_threshold": self.config.health_checker.success_threshold,
                "interval_seconds": self.config.health_checker.interval_seconds
            },
            "last_updated": chrono::Utc::now()
        }))
    }
}

#[derive(Debug, Clone)]
pub struct ServiceHealthResult {
    pub service_id: String,
    pub status: ServiceStatus,
    pub response_time_ms: Option<u64>,
    pub error_message: Option<String>,
    pub checked_at: chrono::DateTime<chrono::Utc>,
}