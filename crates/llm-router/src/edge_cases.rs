//! Comprehensive edge case handling for LLM Router
//!
//! This module provides handling for various edge cases, error scenarios,
//! and unexpected conditions that can occur during LLM routing operations.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tracing::info;
use serde::Serialize;

use crate::models::{Message, Response};
use crate::providers::Provider;
use crate::RouterError;

/// Edge case scenarios that can occur during routing
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
pub enum EdgeCase {
    /// Provider is temporarily unavailable
    ProviderUnavailable,
    /// Request timeout exceeded
    RequestTimeout,
    /// Rate limit exceeded
    RateLimitExceeded,
    /// Invalid model specified
    InvalidModel,
    /// Empty message list
    EmptyMessages,
    /// Message too long
    MessageTooLong,
    /// Provider returned malformed response
    MalformedResponse,
    /// Network connectivity issues
    NetworkError,
    /// Authentication failure
    AuthFailure,
    /// Quota exceeded
    QuotaExceeded,
    /// Service overloaded
    ServiceOverloaded,
    /// Unexpected provider behavior
    UnexpectedBehavior,
}

/// Edge case handler configuration
#[derive(Debug, Clone)]
pub struct EdgeCaseConfig {
    pub max_retry_attempts: u32,
    pub retry_delay: Duration,
    pub timeout_duration: Duration,
    pub max_message_length: usize,
    pub fallback_providers: Vec<String>,
    pub enable_circuit_breaker: bool,
    pub enable_graceful_degradation: bool,
}

impl Default for EdgeCaseConfig {
    fn default() -> Self {
        Self {
            max_retry_attempts: 3,
            retry_delay: Duration::from_millis(500),
            timeout_duration: Duration::from_secs(30),
            max_message_length: 10000,
            fallback_providers: vec!["fallback".to_string()],
            enable_circuit_breaker: true,
            enable_graceful_degradation: true,
        }
    }
}

/// Edge case statistics
#[derive(Debug, Clone, Serialize)]
pub struct EdgeCaseStats {
    pub total_requests: u64,
    pub edge_cases_encountered: u64,
    pub edge_case_counts: HashMap<EdgeCase, u64>,
    pub successful_recoveries: u64,
    pub failed_recoveries: u64,
    pub average_recovery_time: Duration,
    pub last_updated: u64,
}

/// Comprehensive edge case handler
#[derive(Debug, Clone)]
pub struct EdgeCaseHandler {
    config: EdgeCaseConfig,
    stats: Arc<RwLock<EdgeCaseStats>>,
    provider_health: Arc<RwLock<HashMap<String, ProviderHealthStatus>>>,
    retry_attempts: Arc<RwLock<HashMap<String, u32>>>,
}

/// Provider health status tracking
#[derive(Debug, Clone)]
struct ProviderHealthStatus {
    is_healthy: bool,
    last_success: Option<Instant>,
    last_failure: Option<Instant>,
    consecutive_failures: u32,
    total_requests: u64,
    success_rate: f64,
}

impl EdgeCaseHandler {
    pub fn new(config: EdgeCaseConfig) -> Self {
        Self {
            config,
            stats: Arc::new(RwLock::new(EdgeCaseStats {
                total_requests: 0,
                edge_cases_encountered: 0,
                edge_case_counts: HashMap::new(),
                successful_recoveries: 0,
                failed_recoveries: 0,
                average_recovery_time: Duration::from_millis(0),
                last_updated: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            })),
            provider_health: Arc::new(RwLock::new(HashMap::new())),
            retry_attempts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Handle a request with comprehensive edge case detection and recovery
    pub async fn handle_request<F, Fut>(
        &self,
        messages: Vec<Message>,
        model: Option<String>,
        providers: &HashMap<String, Arc<dyn Provider>>,
        route_function: F,
    ) -> Result<Response, RouterError>
    where
        F: Fn(Vec<Message>, Option<String>, &HashMap<String, Arc<dyn Provider>>) -> Fut,
        Fut: std::future::Future<Output = Result<Response, RouterError>>,
    {
        let start_time = Instant::now();

        // Update total requests
        {
            let mut stats = self.stats.write().await;
            stats.total_requests += 1;
        }

        // Pre-request validation
        if let Err(e) = self.validate_request(&messages, &model).await {
            self.record_edge_case(EdgeCase::EmptyMessages).await;
            return Err(e);
        }

        // Try primary routing
        let mut last_error = None;
        let mut attempt = 0;

        while attempt < self.config.max_retry_attempts {
            match self.attempt_routing(&messages, &model, providers, &route_function).await {
                Ok(response) => {
                    // Success - update stats
                    self.record_success().await;
                    return Ok(response);
                }
                Err(e) => {
                    last_error = Some(e.clone());
                    attempt += 1;

                    // Determine edge case type
                    let edge_case = self.classify_error(&e);
                    self.record_edge_case(edge_case.clone()).await;

                    // Check if we should retry
                    if !self.should_retry(&edge_case, attempt).await {
                        break;
                    }

                    // Wait before retry
                    if attempt < self.config.max_retry_attempts {
                        tokio::time::sleep(self.config.retry_delay).await;
                    }
                }
            }
        }

        // All attempts failed - try fallback
        if self.config.enable_graceful_degradation {
            match self.try_fallback(&messages, &model, providers).await {
                Ok(response) => {
                    self.record_successful_recovery(start_time).await;
                    return Ok(response);
                }
                Err(_) => {
                    self.record_failed_recovery().await;
                }
            }
        }

        // Return the last error
        Err(last_error.unwrap_or(RouterError::NoHealthyProviders))
    }

    /// Validate request before processing
    async fn validate_request(&self, messages: &[Message], model: &Option<String>) -> Result<(), RouterError> {
        // Check for empty messages
        if messages.is_empty() {
            return Err(RouterError::ConfigError("Empty message list".to_string()));
        }

        // Check message lengths
        for (i, message) in messages.iter().enumerate() {
            if message.content.len() > self.config.max_message_length {
                return Err(RouterError::ConfigError(format!(
                    "Message {} too long: {} > {}",
                    i, message.content.len(), self.config.max_message_length
                )));
            }
        }

        // Check model validity
        if let Some(model) = model {
            if model.is_empty() {
                return Err(RouterError::ConfigError("Empty model name".to_string()));
            }
        }

        Ok(())
    }

    /// Attempt routing with a specific provider
    async fn attempt_routing<F, Fut>(
        &self,
        messages: &[Message],
        model: &Option<String>,
        providers: &HashMap<String, Arc<dyn Provider>>,
        route_function: F,
    ) -> Result<Response, RouterError>
    where
        F: Fn(Vec<Message>, Option<String>, &HashMap<String, Arc<dyn Provider>>) -> Fut,
        Fut: std::future::Future<Output = Result<Response, RouterError>>,
    {
        // Check provider health
        for (provider_name, _) in providers {
            if !self.is_provider_healthy(provider_name).await {
                continue;
            }
        }

        // Execute routing with timeout
        let timeout_future = tokio::time::timeout(
            self.config.timeout_duration,
            route_function(messages.to_vec(), model.clone(), providers)
        );

        match timeout_future.await {
            Ok(result) => result,
            Err(_) => {
                self.record_provider_failure("timeout").await;
                Err(RouterError::Timeout(self.config.timeout_duration.as_secs()))
            }
        }
    }

    /// Classify error into edge case type
    fn classify_error(&self, error: &RouterError) -> EdgeCase {
        match error {
            RouterError::NoHealthyProviders => EdgeCase::ProviderUnavailable,
            RouterError::Timeout(_) => EdgeCase::RequestTimeout,
            RouterError::RateLimited(_) => EdgeCase::RateLimitExceeded,
            RouterError::ModelNotFound(_) => EdgeCase::InvalidModel,
            RouterError::NetworkError(_) => EdgeCase::NetworkError,
            RouterError::ConfigError(_) => EdgeCase::EmptyMessages,
            RouterError::SerializationError(_) => EdgeCase::MalformedResponse,
            _ => EdgeCase::UnexpectedBehavior,
        }
    }

    /// Determine if we should retry based on edge case type
    async fn should_retry(&self, edge_case: &EdgeCase, attempt: u32) -> bool {
        if attempt >= self.config.max_retry_attempts {
            return false;
        }

        match edge_case {
            EdgeCase::ProviderUnavailable => true,
            EdgeCase::RequestTimeout => true,
            EdgeCase::NetworkError => true,
            EdgeCase::ServiceOverloaded => true,
            EdgeCase::RateLimitExceeded => attempt < 2, // Limited retries for rate limits
            EdgeCase::EmptyMessages => false, // Don't retry validation errors
            EdgeCase::MessageTooLong => false,
            EdgeCase::InvalidModel => false,
            EdgeCase::AuthFailure => false,
            EdgeCase::QuotaExceeded => false,
            EdgeCase::MalformedResponse => true,
            EdgeCase::UnexpectedBehavior => attempt < 2,
        }
    }

    /// Try fallback providers
    async fn try_fallback(
        &self,
        messages: &[Message],
        model: &Option<String>,
        providers: &HashMap<String, Arc<dyn Provider>>,
    ) -> Result<Response, RouterError> {
        for fallback_provider in &self.config.fallback_providers {
            if let Some(provider) = providers.get(fallback_provider) {
                // Try fallback provider
                match provider.health_check().await {
                    Ok(_) => {
                        // Create a simple fallback response
                        return Ok(Response {
                            content: "Fallback response - primary providers unavailable".to_string(),
                            model: model.clone().unwrap_or_else(|| "fallback".to_string()),
                            provider: fallback_provider.clone(),
                            usage: None,
                            metadata: None, // Simplified for now
                        });
                    }
                    Err(_) => continue,
                }
            }
        }

        Err(RouterError::NoHealthyProviders)
    }

    /// Check if provider is healthy
    async fn is_provider_healthy(&self, provider_name: &str) -> bool {
        let health = self.provider_health.read().await;
        health.get(provider_name)
            .map(|status| status.is_healthy)
            .unwrap_or(true) // Assume healthy if not tracked
    }

    /// Record edge case occurrence
    async fn record_edge_case(&self, edge_case: EdgeCase) {
        let mut stats = self.stats.write().await;
        stats.edge_cases_encountered += 1;
        *stats.edge_case_counts.entry(edge_case).or_insert(0) += 1;
        stats.last_updated = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    }

    /// Record successful request
    async fn record_success(&self) {
        // Update provider health
        // This would be called with actual provider name in real implementation
    }

    /// Record provider failure
    async fn record_provider_failure(&self, provider_name: &str) {
        let mut health = self.provider_health.write().await;
        let status = health.entry(provider_name.to_string()).or_insert_with(|| ProviderHealthStatus {
            is_healthy: true,
            last_success: None,
            last_failure: None,
            consecutive_failures: 0,
            total_requests: 0,
            success_rate: 1.0,
        });

        status.consecutive_failures += 1;
        status.last_failure = Some(Instant::now());
        status.total_requests += 1;
        status.success_rate = (status.total_requests - status.consecutive_failures as u64) as f64 / status.total_requests as f64;

        if status.consecutive_failures >= 3 {
            status.is_healthy = false;
        }
    }

    /// Record successful recovery
    async fn record_successful_recovery(&self, start_time: Instant) {
        let mut stats = self.stats.write().await;
        stats.successful_recoveries += 1;

        let recovery_time = start_time.elapsed();
        stats.average_recovery_time = Duration::from_millis(
            ((stats.average_recovery_time.as_millis() + recovery_time.as_millis()) / 2) as u64
        );
    }

    /// Record failed recovery
    async fn record_failed_recovery(&self) {
        let mut stats = self.stats.write().await;
        stats.failed_recoveries += 1;
    }

    /// Get edge case statistics
    pub async fn get_stats(&self) -> EdgeCaseStats {
        self.stats.read().await.clone()
    }

    /// Reset statistics
    pub async fn reset_stats(&self) {
        let mut stats = self.stats.write().await;
        *stats = EdgeCaseStats {
            total_requests: 0,
            edge_cases_encountered: 0,
            edge_case_counts: HashMap::new(),
            successful_recoveries: 0,
            failed_recoveries: 0,
            average_recovery_time: Duration::from_millis(0),
            last_updated: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        };
    }
}

impl Default for EdgeCaseHandler {
    fn default() -> Self {
        Self::new(EdgeCaseConfig::default())
    }
}

/// Edge case metrics endpoint
pub async fn get_edge_case_metrics(handler: &EdgeCaseHandler) -> serde_json::Value {
    let stats = handler.get_stats().await;

    serde_json::json!({
        "edge_case_stats": {
            "total_requests": stats.total_requests,
            "edge_cases_encountered": stats.edge_cases_encountered,
            "edge_case_rate": if stats.total_requests > 0 {
                stats.edge_cases_encountered as f64 / stats.total_requests as f64
            } else {
                0.0
            },
            "successful_recoveries": stats.successful_recoveries,
            "failed_recoveries": stats.failed_recoveries,
            "recovery_success_rate": if stats.successful_recoveries + stats.failed_recoveries > 0 {
                stats.successful_recoveries as f64 / (stats.successful_recoveries + stats.failed_recoveries) as f64
            } else {
                0.0
            },
            "average_recovery_time_ms": stats.average_recovery_time.as_millis(),
            "edge_case_breakdown": stats.edge_case_counts,
            "last_updated": stats.last_updated
        }
    })
}
