//! Intelligent LLM request routing with OpenTelemetry tracing

use crate::{
    config::{Config, ProviderConfig},
    providers::{LlmProvider, LlmRequest, LlmResponse, OllamaProvider, MockProvider, RouterResult, RouterError},
    tracing_setup::{create_service_span, record_performance_metrics, record_error},
};
use dashmap::DashMap;
use std::{
    collections::HashMap,
    sync::{Arc, atomic::{AtomicBool, Ordering}},
    time::{Duration, Instant},
};
use tokio::time::timeout;
use tracing::{instrument, info, warn, error, Span};

/// Circuit breaker states
#[derive(Debug, Clone, PartialEq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

/// Circuit breaker for individual providers
pub struct CircuitBreaker {
    state: AtomicBool, // Simple binary state: false = closed/half-open, true = open
    failure_count: Arc<std::sync::atomic::AtomicU32>,
    last_failure: Arc<std::sync::Mutex<Option<Instant>>>,
    threshold: u32,
    recovery_timeout: Duration,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, recovery_timeout: Duration) -> Self {
        Self {
            state: AtomicBool::new(false), // Start closed
            failure_count: Arc::new(std::sync::atomic::AtomicU32::new(0)),
            last_failure: Arc::new(std::sync::Mutex::new(None)),
            threshold: failure_threshold,
            recovery_timeout,
        }
    }

    pub fn can_execute(&self) -> bool {
        if !self.state.load(Ordering::Relaxed) {
            return true; // Circuit is closed
        }

        // Circuit is open, check if we should attempt recovery
        if let Ok(last_failure) = self.last_failure.lock() {
            if let Some(failure_time) = *last_failure {
                if failure_time.elapsed() > self.recovery_timeout {
                    // Try to transition to half-open
                    self.state.store(false, Ordering::Relaxed);
                    return true;
                }
            }
        }

        false
    }

    pub fn record_success(&self) {
        self.failure_count.store(0, Ordering::Relaxed);
        self.state.store(false, Ordering::Relaxed);
    }

    pub fn record_failure(&self) {
        let failures = self.failure_count.fetch_add(1, Ordering::Relaxed) + 1;
        
        if failures >= self.threshold {
            self.state.store(true, Ordering::Relaxed); // Open the circuit
            if let Ok(mut last_failure) = self.last_failure.lock() {
                *last_failure = Some(Instant::now());
            }
        }
    }

    pub fn get_state(&self) -> CircuitState {
        if self.state.load(Ordering::Relaxed) {
            CircuitState::Open
        } else if self.failure_count.load(Ordering::Relaxed) > 0 {
            CircuitState::HalfOpen
        } else {
            CircuitState::Closed
        }
    }
}

/// Routing strategy types
#[derive(Debug, Clone)]
pub enum RoutingStrategy {
    LeastLatency,
    WeightedRoundRobin,
    ContentAware,
    Adaptive,
}

/// Provider health and performance metrics
#[derive(Debug, Clone)]
pub struct ProviderMetrics {
    pub average_latency: f64,
    pub success_rate: f64,
    pub current_load: u32,
    pub last_updated: Instant,
}

/// Main LLM router with intelligent routing and circuit breakers
pub struct LlmRouter {
    providers: Vec<Box<dyn LlmProvider>>,
    circuit_breakers: DashMap<String, CircuitBreaker>,
    provider_metrics: DashMap<String, ProviderMetrics>,
    routing_strategy: RoutingStrategy,
    config: Arc<Config>,
}

impl LlmRouter {
    #[instrument(skip(config))]
    pub async fn new(config: Arc<Config>) -> Result<Self, Box<dyn std::error::Error>> {
        let span = create_service_span("router_initialization");
        let _enter = span.enter();

        info!("Initializing LLM Router with {} providers", config.providers.len());

        let mut providers: Vec<Box<dyn LlmProvider>> = Vec::new();
        let circuit_breakers = DashMap::new();
        let provider_metrics = DashMap::new();

        // Initialize providers
        for provider_config in &config.providers {
            let provider = Self::create_provider(provider_config).await?;
            let provider_name = provider.name().to_string();

            // Initialize circuit breaker for this provider
            circuit_breakers.insert(
                provider_name.clone(),
                CircuitBreaker::new(3, Duration::from_secs(30)), // 3 failures, 30s recovery
            );

            // Initialize metrics
            provider_metrics.insert(
                provider_name.clone(),
                ProviderMetrics {
                    average_latency: 0.0,
                    success_rate: 1.0,
                    current_load: 0,
                    last_updated: Instant::now(),
                },
            );

            providers.push(provider);
            info!(provider = provider_name, "Provider initialized successfully");
        }

        Ok(Self {
            providers,
            circuit_breakers,
            provider_metrics,
            routing_strategy: RoutingStrategy::ContentAware,
            config,
        })
    }

    async fn create_provider(config: &ProviderConfig) -> Result<Box<dyn LlmProvider>, Box<dyn std::error::Error>> {
        match config.name.as_str() {
            "ollama" => Ok(Box::new(OllamaProvider::new(
                config.name.clone(),
                config.endpoint.clone(),
                config.models.clone(),
            ))),
            name if name.starts_with("mock") => Ok(Box::new(MockProvider::new(
                config.name.clone(),
                100, // 100ms latency
                false, // Don't fail by default
            ))),
            _ => {
                // For other providers (OpenAI, Anthropic), create mock providers for now
                warn!(provider = config.name, "Using mock provider for unsupported provider type");
                Ok(Box::new(MockProvider::new(
                    config.name.clone(),
                    200, // 200ms latency
                    false,
                )))
            }
        }
    }

    #[instrument(skip(self, request), fields(model = %request.model, strategy = ?self.routing_strategy))]
    pub async fn route_request(&self, request: &LlmRequest) -> RouterResult<LlmResponse> {
        let span = Span::current();
        let start_time = Instant::now();

        span.record("llm.model", &request.model);
        span.record("routing.strategy", format!("{:?}", self.routing_strategy).as_str());

        info!(
            model = request.model,
            strategy = ?self.routing_strategy,
            "Routing LLM request"
        );

        // Select provider based on routing strategy
        let selected_provider = self.select_provider(request).await?;
        let provider_name = selected_provider.name().to_string();

        span.record("llm.provider.selected", &provider_name);

        // Check circuit breaker
        if let Some(circuit_breaker) = self.circuit_breakers.get(&provider_name) {
            if !circuit_breaker.can_execute() {
                record_error(&span, "Circuit breaker open", Some("circuit_breaker"));
                warn!(provider = provider_name, "Circuit breaker is open, request blocked");
                return Err(RouterError::ProviderError("Circuit breaker open".to_string()));
            }
        }

        // Execute request with timeout
        let request_timeout = Duration::from_secs(self.config.default_timeout_seconds);
        let result = timeout(request_timeout, selected_provider.execute(request)).await;

        let routing_duration = start_time.elapsed();

        match result {
            Ok(Ok(response)) => {
                // Record success
                if let Some(circuit_breaker) = self.circuit_breakers.get(&provider_name) {
                    circuit_breaker.record_success();
                }

                // Update metrics
                self.update_provider_metrics(&provider_name, routing_duration, true).await;

                record_performance_metrics(
                    &span,
                    routing_duration.as_millis() as u64,
                    Some(response.usage.total_tokens),
                    Some(&provider_name),
                );

                info!(
                    provider = provider_name,
                    model = request.model,
                    tokens = response.usage.total_tokens,
                    duration_ms = routing_duration.as_millis(),
                    "Request routed successfully"
                );

                Ok(response)
            }
            Ok(Err(e)) => {
                // Record failure
                if let Some(circuit_breaker) = self.circuit_breakers.get(&provider_name) {
                    circuit_breaker.record_failure();
                }

                self.update_provider_metrics(&provider_name, routing_duration, false).await;

                record_error(&span, &e.to_string(), Some("provider_error"));
                error!(
                    provider = provider_name,
                    error = %e,
                    duration_ms = routing_duration.as_millis(),
                    "Provider request failed"
                );

                Err(e)
            }
            Err(_) => {
                // Timeout occurred
                if let Some(circuit_breaker) = self.circuit_breakers.get(&provider_name) {
                    circuit_breaker.record_failure();
                }

                self.update_provider_metrics(&provider_name, routing_duration, false).await;

                record_error(&span, "Request timeout", Some("timeout"));
                warn!(
                    provider = provider_name,
                    timeout_seconds = self.config.default_timeout_seconds,
                    "Request timed out"
                );

                Err(RouterError::TimeoutError)
            }
        }
    }

    async fn select_provider(&self, request: &LlmRequest) -> RouterResult<&Box<dyn LlmProvider>> {
        match self.routing_strategy {
            RoutingStrategy::ContentAware => self.select_by_content_aware(request).await,
            RoutingStrategy::LeastLatency => self.select_by_least_latency(request).await,
            RoutingStrategy::WeightedRoundRobin => self.select_by_weighted_round_robin(request).await,
            RoutingStrategy::Adaptive => self.select_by_adaptive(request).await,
        }
    }

    async fn select_by_content_aware(&self, request: &LlmRequest) -> RouterResult<&Box<dyn LlmProvider>> {
        // Content-aware routing based on request characteristics
        let complexity_score = self.calculate_complexity_score(request);

        // Filter providers that support the requested model
        let suitable_providers: Vec<&Box<dyn LlmProvider>> = self
            .providers
            .iter()
            .filter(|p| p.supports_model(&request.model))
            .filter(|p| {
                // Check circuit breaker
                if let Some(cb) = self.circuit_breakers.get(p.name()) {
                    cb.can_execute()
                } else {
                    true
                }
            })
            .collect();

        if suitable_providers.is_empty() {
            return Err(RouterError::ProviderError("No suitable providers available".to_string()));
        }

        // Select based on complexity and provider capabilities
        let selected = if complexity_score > 0.7 {
            // High complexity - prefer powerful providers
            suitable_providers
                .iter()
                .find(|p| p.name().contains("anthropic") || p.name().contains("openai"))
                .unwrap_or(&suitable_providers[0])
        } else {
            // Low complexity - prefer fast local providers
            suitable_providers
                .iter()
                .find(|p| p.name().contains("ollama"))
                .unwrap_or(&suitable_providers[0])
        };

        Ok(*selected)
    }

    async fn select_by_least_latency(&self, _request: &LlmRequest) -> RouterResult<&Box<dyn LlmProvider>> {
        // Select provider with lowest average latency
        let mut best_provider = &self.providers[0];
        let mut best_latency = f64::MAX;

        for provider in &self.providers {
            if let Some(cb) = self.circuit_breakers.get(provider.name()) {
                if !cb.can_execute() {
                    continue;
                }
            }

            if let Some(metrics) = self.provider_metrics.get(provider.name()) {
                if metrics.average_latency < best_latency {
                    best_latency = metrics.average_latency;
                    best_provider = provider;
                }
            }
        }

        Ok(best_provider)
    }

    async fn select_by_weighted_round_robin(&self, _request: &LlmRequest) -> RouterResult<&Box<dyn LlmProvider>> {
        // Simple round-robin for now (could be enhanced with weights)
        static COUNTER: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let index = COUNTER.fetch_add(1, Ordering::Relaxed) % self.providers.len();
        Ok(&self.providers[index])
    }

    async fn select_by_adaptive(&self, request: &LlmRequest) -> RouterResult<&Box<dyn LlmProvider>> {
        // Adaptive strategy combining multiple factors
        let complexity = self.calculate_complexity_score(request);
        
        if complexity > 0.8 {
            self.select_by_content_aware(request).await
        } else {
            self.select_by_least_latency(request).await
        }
    }

    fn calculate_complexity_score(&self, request: &LlmRequest) -> f64 {
        let mut score = 0.0;

        // Prompt length factor
        score += (request.prompt.len() as f64 / 1000.0).min(0.5);

        // Token count factor
        score += (request.max_tokens as f64 / 4000.0).min(0.3);

        // Temperature factor (higher = more creative = more complex)
        score += (request.temperature as f64).min(0.2);

        score.min(1.0)
    }

    async fn update_provider_metrics(&self, provider_name: &str, duration: Duration, success: bool) {
        if let Some(mut metrics) = self.provider_metrics.get_mut(provider_name) {
            let latency_ms = duration.as_millis() as f64;
            
            // Update rolling average latency
            metrics.average_latency = (metrics.average_latency * 0.9) + (latency_ms * 0.1);
            
            // Update success rate
            let success_value = if success { 1.0 } else { 0.0 };
            metrics.success_rate = (metrics.success_rate * 0.9) + (success_value * 0.1);
            
            metrics.last_updated = Instant::now();
        }
    }

    #[instrument(skip(self))]
    pub async fn check_providers_health(&self) -> HashMap<String, bool> {
        let span = create_service_span("providers_health_check");
        let _enter = span.enter();

        let mut health_status = HashMap::new();

        for provider in &self.providers {
            let provider_name = provider.name().to_string();
            
            match provider.health_check().await {
                Ok(is_healthy) => {
                    health_status.insert(provider_name.clone(), is_healthy);
                    
                    if is_healthy {
                        // Reset circuit breaker on successful health check
                        if let Some(cb) = self.circuit_breakers.get(&provider_name) {
                            cb.record_success();
                        }
                    }
                }
                Err(e) => {
                    warn!(provider = provider_name, error = %e, "Health check failed");
                    health_status.insert(provider_name, false);
                }
            }
        }

        info!(
            healthy_providers = health_status.values().filter(|&&v| v).count(),
            total_providers = health_status.len(),
            "Provider health check completed"
        );

        health_status
    }
}