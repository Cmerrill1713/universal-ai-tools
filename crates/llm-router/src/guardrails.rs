//! Comprehensive guardrails and edge case handling for LLM Router
//! 
//! This module provides safety mechanisms, rate limiting, input validation,
//! and error handling to ensure robust operation of the LLM Router service.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tracing::{error, info};
use serde::Serialize;

/// Rate limiting configuration
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub burst_size: u32,
    pub window_duration: Duration,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_minute: 100,
            burst_size: 20,
            window_duration: Duration::from_secs(60),
        }
    }
}

/// Rate limiter for individual clients
#[derive(Debug, Clone)]
struct ClientRateLimit {
    requests: Vec<Instant>,
    burst_tokens: u32,
    last_refill: Instant,
}

impl ClientRateLimit {
    fn new() -> Self {
        Self {
            requests: Vec::new(),
            burst_tokens: 20, // Default burst size
            last_refill: Instant::now(),
        }
    }

    fn can_make_request(&mut self, config: &RateLimitConfig) -> bool {
        let now = Instant::now();
        
        // Refill burst tokens
        let time_since_refill = now.duration_since(self.last_refill);
        let tokens_to_add = (time_since_refill.as_secs() * config.requests_per_minute as u64 / 60) as u32;
        self.burst_tokens = (self.burst_tokens + tokens_to_add).min(config.burst_size);
        self.last_refill = now;

        // Clean old requests outside the window
        let cutoff = now - config.window_duration;
        self.requests.retain(|&time| time > cutoff);

        // Check if we can make a request
        if self.burst_tokens > 0 {
            self.burst_tokens -= 1;
            self.requests.push(now);
            true
        } else if self.requests.len() < config.requests_per_minute as usize {
            self.requests.push(now);
            true
        } else {
            false
        }
    }
}

/// Input validation rules
#[derive(Debug, Clone)]
pub struct InputValidationRules {
    pub max_message_length: usize,
    pub max_messages_per_request: usize,
    pub max_total_tokens: usize,
    pub allowed_models: Vec<String>,
    pub blocked_patterns: Vec<String>,
}

impl Default for InputValidationRules {
    fn default() -> Self {
        Self {
            max_message_length: 10000,
            max_messages_per_request: 50,
            max_total_tokens: 100000,
            allowed_models: vec![
                "gpt-3.5-turbo".to_string(),
                "gpt-4".to_string(),
                "claude-3-sonnet".to_string(),
                "claude-3-haiku".to_string(),
            ],
            blocked_patterns: vec![
                "malicious".to_string(),
                "injection".to_string(),
                "script".to_string(),
            ],
        }
    }
}

/// Circuit breaker state
#[derive(Debug, Clone, PartialEq)]
pub enum CircuitBreakerState {
    Closed,    // Normal operation
    Open,      // Failing, blocking requests
    HalfOpen,  // Testing if service is back
}

/// Circuit breaker for provider health monitoring
#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    pub state: CircuitBreakerState,
    pub failure_count: u32,
    pub failure_threshold: u32,
    pub timeout: Duration,
    pub last_failure: Option<Instant>,
    pub success_count: u32,
    pub success_threshold: u32,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, timeout: Duration) -> Self {
        Self {
            state: CircuitBreakerState::Closed,
            failure_count: 0,
            failure_threshold,
            timeout,
            last_failure: None,
            success_count: 0,
            success_threshold: 3,
        }
    }

    pub fn can_execute(&self) -> bool {
        match self.state {
            CircuitBreakerState::Closed => true,
            CircuitBreakerState::Open => {
                if let Some(last_failure) = self.last_failure {
                    Instant::now().duration_since(last_failure) >= self.timeout
                } else {
                    true
                }
            }
            CircuitBreakerState::HalfOpen => true,
        }
    }

    pub fn record_success(&mut self) {
        self.failure_count = 0;
        self.success_count += 1;
        
        if self.state == CircuitBreakerState::HalfOpen && self.success_count >= self.success_threshold {
            self.state = CircuitBreakerState::Closed;
            self.success_count = 0;
            info!("Circuit breaker closed - service recovered");
        }
    }

    pub fn record_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure = Some(Instant::now());
        self.success_count = 0;

        if self.failure_count >= self.failure_threshold {
            self.state = CircuitBreakerState::Open;
            error!("Circuit breaker opened - too many failures");
        }
    }

    pub fn try_half_open(&mut self) {
        if self.state == CircuitBreakerState::Open {
            if let Some(last_failure) = self.last_failure {
                if Instant::now().duration_since(last_failure) >= self.timeout {
                    self.state = CircuitBreakerState::HalfOpen;
                    info!("Circuit breaker half-open - testing service");
                }
            }
        }
    }
}

/// Comprehensive guardrails manager
#[derive(Debug, Clone)]
pub struct GuardrailsManager {
    rate_limits: Arc<RwLock<HashMap<String, ClientRateLimit>>>,
    rate_limit_config: RateLimitConfig,
    validation_rules: InputValidationRules,
    circuit_breakers: Arc<RwLock<HashMap<String, CircuitBreaker>>>,
    max_concurrent_requests: usize,
    current_requests: Arc<RwLock<usize>>,
}

impl GuardrailsManager {
    pub fn new() -> Self {
        Self {
            rate_limits: Arc::new(RwLock::new(HashMap::new())),
            rate_limit_config: RateLimitConfig::default(),
            validation_rules: InputValidationRules::default(),
            circuit_breakers: Arc::new(RwLock::new(HashMap::new())),
            max_concurrent_requests: 1000,
            current_requests: Arc::new(RwLock::new(0)),
        }
    }

    /// Check if a client can make a request (rate limiting)
    pub async fn check_rate_limit(&self, client_id: &str) -> Result<(), String> {
        let mut rate_limits = self.rate_limits.write().await;
        let client_limit = rate_limits.entry(client_id.to_string()).or_insert_with(ClientRateLimit::new);
        
        if client_limit.can_make_request(&self.rate_limit_config) {
            Ok(())
        } else {
            Err("Rate limit exceeded".to_string())
        }
    }

    /// Validate input parameters
    pub fn validate_input(&self, messages: &[String], model: &str) -> Result<(), String> {
        // Check message count
        if messages.len() > self.validation_rules.max_messages_per_request {
            return Err(format!("Too many messages: {} > {}", 
                messages.len(), self.validation_rules.max_messages_per_request));
        }

        // Check individual message lengths
        for (i, message) in messages.iter().enumerate() {
            if message.len() > self.validation_rules.max_message_length {
                return Err(format!("Message {} too long: {} > {}", 
                    i, message.len(), self.validation_rules.max_message_length));
            }
        }

        // Check total token count (rough estimation)
        let total_chars: usize = messages.iter().map(|m| m.len()).sum();
        let estimated_tokens = total_chars / 4; // Rough estimation
        if estimated_tokens > self.validation_rules.max_total_tokens {
            return Err(format!("Total tokens too high: {} > {}", 
                estimated_tokens, self.validation_rules.max_total_tokens));
        }

        // Check if model is allowed
        if !self.validation_rules.allowed_models.contains(&model.to_string()) {
            return Err(format!("Model not allowed: {}", model));
        }

        // Check for blocked patterns
        for message in messages {
            for pattern in &self.validation_rules.blocked_patterns {
                if message.to_lowercase().contains(pattern) {
                    return Err(format!("Blocked pattern detected: {}", pattern));
                }
            }
        }

        Ok(())
    }

    /// Check if we can handle more concurrent requests
    pub async fn check_concurrent_limit(&self) -> Result<(), String> {
        let current = *self.current_requests.read().await;
        if current >= self.max_concurrent_requests {
            return Err("Too many concurrent requests".to_string());
        }
        Ok(())
    }

    /// Increment concurrent request counter
    pub async fn increment_concurrent(&self) {
        let mut current = self.current_requests.write().await;
        *current += 1;
    }

    /// Decrement concurrent request counter
    pub async fn decrement_concurrent(&self) {
        let mut current = self.current_requests.write().await;
        if *current > 0 {
            *current -= 1;
        }
    }

    /// Check circuit breaker for a provider
    pub async fn check_circuit_breaker(&self, provider: &str) -> Result<(), String> {
        let mut breakers = self.circuit_breakers.write().await;
        let breaker = breakers.entry(provider.to_string()).or_insert_with(|| {
            CircuitBreaker::new(5, Duration::from_secs(30))
        });

        if breaker.can_execute() {
            Ok(())
        } else {
            Err(format!("Circuit breaker open for provider: {}", provider))
        }
    }

    /// Record success for a provider
    pub async fn record_provider_success(&self, provider: &str) {
        let mut breakers = self.circuit_breakers.write().await;
        if let Some(breaker) = breakers.get_mut(provider) {
            breaker.record_success();
        }
    }

    /// Record failure for a provider
    pub async fn record_provider_failure(&self, provider: &str) {
        let mut breakers = self.circuit_breakers.write().await;
        if let Some(breaker) = breakers.get_mut(provider) {
            breaker.record_failure();
        }
    }

    /// Update circuit breaker states (call periodically)
    pub async fn update_circuit_breakers(&self) {
        let mut breakers = self.circuit_breakers.write().await;
        for breaker in breakers.values_mut() {
            breaker.try_half_open();
        }
    }

    /// Get current system metrics
    pub async fn get_metrics(&self) -> GuardrailsMetrics {
        let current_requests = *self.current_requests.read().await;
        let rate_limit_count = self.rate_limits.read().await.len();
        let circuit_breaker_count = self.circuit_breakers.read().await.len();

        GuardrailsMetrics {
            current_concurrent_requests: current_requests,
            max_concurrent_requests: self.max_concurrent_requests,
            active_rate_limits: rate_limit_count,
            active_circuit_breakers: circuit_breaker_count,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }
}

/// Metrics for guardrails
#[derive(Debug, Clone, Serialize)]
pub struct GuardrailsMetrics {
    pub current_concurrent_requests: usize,
    pub max_concurrent_requests: usize,
    pub active_rate_limits: usize,
    pub active_circuit_breakers: usize,
    pub timestamp: u64,
}

impl Default for GuardrailsManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Error types for guardrails
#[derive(Debug, thiserror::Error)]
pub enum GuardrailsError {
    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),
    
    #[error("Input validation failed: {0}")]
    InputValidationFailed(String),
    
    #[error("Concurrent request limit exceeded: {0}")]
    ConcurrentLimitExceeded(String),
    
    #[error("Circuit breaker open: {0}")]
    CircuitBreakerOpen(String),
    
    #[error("System overloaded: {0}")]
    SystemOverloaded(String),
}

/// Comprehensive request validation
pub async fn validate_request(
    guardrails: &GuardrailsManager,
    client_id: &str,
    messages: &[String],
    model: &str,
) -> Result<(), GuardrailsError> {
    // Check concurrent limit
    guardrails.check_concurrent_limit().await
        .map_err(GuardrailsError::ConcurrentLimitExceeded)?;

    // Check rate limit
    guardrails.check_rate_limit(client_id).await
        .map_err(GuardrailsError::RateLimitExceeded)?;

    // Validate input
    guardrails.validate_input(messages, model)
        .map_err(GuardrailsError::InputValidationFailed)?;

    Ok(())
}

/// Safe request execution with automatic cleanup
pub async fn execute_with_guardrails<F, T>(
    guardrails: &GuardrailsManager,
    client_id: &str,
    messages: &[String],
    model: &str,
    provider: &str,
    operation: F,
) -> Result<T, GuardrailsError>
where
    F: std::future::Future<Output = Result<T, String>>,
{
    // Validate request
    validate_request(guardrails, client_id, messages, model).await?;

    // Check circuit breaker
    guardrails.check_circuit_breaker(provider).await
        .map_err(GuardrailsError::CircuitBreakerOpen)?;

    // Increment concurrent counter
    guardrails.increment_concurrent().await;

    // Execute operation
    let result = operation.await;

    // Decrement concurrent counter
    guardrails.decrement_concurrent().await;

    // Record result
    match &result {
        Ok(_) => {
            guardrails.record_provider_success(provider).await;
        }
        Err(_) => {
            guardrails.record_provider_failure(provider).await;
        }
    }

    result.map_err(GuardrailsError::SystemOverloaded)
}
