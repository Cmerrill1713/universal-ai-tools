use crate::{
    load_balancer::{LoadBalancer, LoadBalancingStrategy},
    metrics::{MetricsCollector, PerformanceMetrics},
    routing::{CoordinationContext, RoutingDecision, RoutingEngine, ServiceType},
    services::{ExecutionResult, ServiceExecutor},
    CoordinatorError,
};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::interval;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionMetadata {
    pub routing_decision: RoutingDecision,
    pub execution_time: u64,
    pub tokens_used: u32,
    pub service_used: String,
    pub was_load_balanced: bool,
    pub confidence: f64,
    pub performance_ratio: Option<f64>, // Compared to baseline
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinatedExecutionResult {
    pub response: ExecutionResult,
    pub metadata: ExecutionMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiAgentCoordinationResult {
    pub primary: ExecutionResult,
    pub supporting: Vec<ExecutionResult>,
    pub coordination: CoordinationSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationSummary {
    pub total_time: u64,
    pub fast_decisions: u32,
    pub services_used: Vec<String>,
    pub load_balancing_effectiveness: f64,
    pub total_tokens: u64,
}

#[derive(Debug, Clone)]
pub struct SystemStatus {
    pub fast_models: HashMap<String, bool>,
    pub services: HashMap<String, bool>,
    pub performance: PerformanceStatus,
    pub load_balancing: LoadBalancingStatus,
    pub resource_metrics: ResourceMetrics,
}

#[derive(Debug, Clone)]
pub struct PerformanceStatus {
    pub average_routing_time: f64,
    pub total_requests: u64,
    pub average_response_time: f64,
    pub requests_per_second: f64,
}

#[derive(Debug, Clone)]
pub struct LoadBalancingStatus {
    pub services: HashMap<String, ServiceHealth>,
    pub last_health_check: String,
}

#[derive(Debug, Clone)]
pub struct ServiceHealth {
    pub weight: f64,
    pub current_load: u32,
    pub is_healthy: bool,
}

#[derive(Debug, Clone)]
pub struct ResourceMetrics {
    pub service_loads: HashMap<String, u64>,
    pub healthy_services: u32,
    pub error_rates: HashMap<String, f64>,
}

pub struct FastLLMCoordinator {
    routing_engine: RoutingEngine,
    load_balancer: LoadBalancer,
    service_executor: ServiceExecutor,
    metrics_collector: MetricsCollector,
    baseline_performance: Arc<RwLock<HashMap<ServiceType, f64>>>,
    health_check_interval: Duration,
}

impl FastLLMCoordinator {
    pub fn new() -> Self {
        Self::with_load_balancing_strategy(LoadBalancingStrategy::Hybrid)
    }

    pub fn with_load_balancing_strategy(strategy: LoadBalancingStrategy) -> Self {
        let coordinator = Self {
            routing_engine: RoutingEngine::new(),
            load_balancer: LoadBalancer::new(strategy),
            service_executor: ServiceExecutor::new(),
            metrics_collector: MetricsCollector::new(),
            baseline_performance: Arc::new(RwLock::new(HashMap::new())),
            health_check_interval: Duration::from_secs(30),
        };

        // Start background tasks
        coordinator.start_background_tasks();
        coordinator
    }

    /// Make a fast routing decision for the given request
    pub async fn make_routing_decision(
        &self,
        user_request: &str,
        context: &CoordinationContext,
    ) -> Result<RoutingDecision, CoordinatorError> {
        let start_time = Instant::now();

        let decision = self.routing_engine
            .make_routing_decision(user_request, context)
            .await?;

        // Record routing time for metrics
        self.metrics_collector.record_routing_time(start_time.elapsed());

        tracing::info!(
            target_service = %decision.target_service.as_str(),
            complexity = %decision.complexity.as_str(),
            confidence = %decision.confidence,
            routing_time_ms = %decision.routing_time_ms,
            "Routing decision completed"
        );

        Ok(decision)
    }

    /// Execute a request with full coordination (routing + load balancing + execution)
    pub async fn execute_with_coordination(
        &self,
        user_request: &str,
        context: &CoordinationContext,
    ) -> Result<CoordinatedExecutionResult, CoordinatorError> {
        let overall_start_time = Instant::now();

        // Step 1: Make routing decision
        let routing_decision = self.make_routing_decision(user_request, context).await?;

        // Step 2: Apply load balancing
        let load_balancing_decision = self.load_balancer.select_service(
            routing_decision.target_service.clone(),
            routing_decision.priority > 3, // Force load balancing for high priority
        );

        let selected_service = ServiceType::from_str(&load_balancing_decision.selected_service.to_string())
            .unwrap_or(routing_decision.target_service.clone());

        // Step 3: Record request start for load balancing
        self.load_balancer.record_request_start(&selected_service);

        // Step 4: Execute the request
        let execution_start = Instant::now();
        let execution_result = self.service_executor
            .execute_request(&selected_service, user_request)
            .await;

        let execution_duration = execution_start.elapsed();

        // Step 5: Record request completion
        let success = execution_result.is_ok();
        self.load_balancer.record_request_end(&selected_service, execution_duration, success);

        // Step 6: Handle execution result
        let response = match execution_result {
            Ok(result) => result,
            Err(error) => {
                tracing::warn!(
                    service = %selected_service.as_str(),
                    error = %error,
                    "Service execution failed, attempting fallback"
                );

                // Try fallback execution
                self.execute_fallback(user_request, &selected_service).await?
            }
        };

        let total_execution_time = overall_start_time.elapsed();

        // Step 7: Calculate performance ratio
        let performance_ratio = self.calculate_performance_ratio(&selected_service, execution_duration);

        // Step 8: Record metrics
        self.metrics_collector.record_request(
            selected_service.clone(),
            execution_duration,
            success,
            response.tokens_used,
            true, // Was routed
            load_balancing_decision.was_load_balanced,
        );

        // Step 9: Create execution metadata
        let metadata = ExecutionMetadata {
            routing_decision,
            execution_time: total_execution_time.as_millis() as u64,
            tokens_used: response.tokens_used,
            service_used: selected_service.as_str().to_string(),
            was_load_balanced: load_balancing_decision.was_load_balanced,
            confidence: response.confidence,
            performance_ratio,
        };

        tracing::info!(
            service = %selected_service.as_str(),
            execution_time_ms = %total_execution_time.as_millis(),
            tokens_used = %response.tokens_used,
            was_load_balanced = %metadata.was_load_balanced,
            "Request execution completed"
        );

        Ok(CoordinatedExecutionResult { response, metadata })
    }

    /// Coordinate multiple agents for complex tasks
    pub async fn coordinate_multiple_agents(
        &self,
        primary_task: &str,
        supporting_tasks: &[String],
    ) -> Result<MultiAgentCoordinationResult, CoordinatorError> {
        let start_time = Instant::now();
        let mut services_used = Vec::new();
        let mut total_tokens = 0u64;

        // Create contexts for different task types
        let primary_context = CoordinationContext {
            task_type: "primary".to_string(),
            complexity: "medium".to_string(),
            urgency: crate::routing::UrgencyLevel::High,
            expected_response_length: crate::routing::ResponseLength::Medium,
            requires_creativity: false,
            requires_accuracy: true,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        };

        let supporting_context = CoordinationContext {
            task_type: "supporting".to_string(),
            complexity: "simple".to_string(),
            urgency: crate::routing::UrgencyLevel::Medium,
            expected_response_length: crate::routing::ResponseLength::Short,
            requires_creativity: false,
            requires_accuracy: false,
            timestamp: primary_context.timestamp,
        };

        // Execute primary task
        let primary_result = self.execute_with_coordination(primary_task, &primary_context).await?;
        services_used.push(primary_result.metadata.service_used.clone());
        total_tokens += primary_result.metadata.tokens_used as u64;

        // Execute supporting tasks in parallel
        let supporting_futures: Vec<_> = supporting_tasks.iter()
            .map(|task| self.execute_with_coordination(task, &supporting_context))
            .collect();

        let supporting_results = futures::future::join_all(supporting_futures).await;

        let mut supporting_responses = Vec::new();
        let mut fast_decisions = 1u32; // Primary task

        for result in supporting_results {
            match result {
                Ok(coordinated_result) => {
                    services_used.push(coordinated_result.metadata.service_used.clone());
                    total_tokens += coordinated_result.metadata.tokens_used as u64;
                    fast_decisions += 1;
                    supporting_responses.push(coordinated_result.response);
                }
                Err(error) => {
                    tracing::warn!(error = %error, "Supporting task failed, skipping");
                }
            }
        }

        // Calculate coordination effectiveness
        let unique_services: std::collections::HashSet<_> = services_used.iter().collect();
        let load_balancing_effectiveness = if services_used.len() > 1 {
            unique_services.len() as f64 / services_used.len() as f64
        } else {
            1.0
        };

        let coordination_summary = CoordinationSummary {
            total_time: start_time.elapsed().as_millis() as u64,
            fast_decisions,
            services_used: unique_services.into_iter().cloned().collect(),
            load_balancing_effectiveness,
            total_tokens,
        };

        tracing::info!(
            total_time_ms = %coordination_summary.total_time,
            fast_decisions = %fast_decisions,
            services_used = %coordination_summary.services_used.len(),
            total_tokens = %total_tokens,
            "Multi-agent coordination completed"
        );

        Ok(MultiAgentCoordinationResult {
            primary: primary_result.response,
            supporting: supporting_responses,
            coordination: coordination_summary,
        })
    }

    /// Get comprehensive system status
    pub async fn get_system_status(&self) -> SystemStatus {
        // Get service health status
        let mut services = HashMap::new();
        let service_types = [
            ServiceType::LFM2,
            ServiceType::Ollama,
            ServiceType::LMStudio,
            ServiceType::OpenAI,
            ServiceType::Anthropic,
        ];

        for service_type in &service_types {
            let is_healthy = self.service_executor.health_check(service_type).await;
            services.insert(service_type.as_str().to_string(), is_healthy);

            // Update load balancer with health status
            self.load_balancer.update_service_health(service_type, is_healthy);
        }

        // Fast models status (would check actual availability)
        let mut fast_models = HashMap::new();
        fast_models.insert("lfm2".to_string(), services.get("lfm2").copied().unwrap_or(false));
        fast_models.insert("kokoro".to_string(), true); // Would check actual availability

        // Get performance metrics
        let performance_metrics = self.metrics_collector.get_performance_metrics();
        let performance = PerformanceStatus {
            average_routing_time: performance_metrics.routing_metrics.average_routing_time,
            total_requests: performance_metrics.total_requests,
            average_response_time: performance_metrics.average_response_time,
            requests_per_second: performance_metrics.requests_per_second,
        };

        // Get load balancing status
        let service_status = self.load_balancer.get_service_status();
        let load_balancing_services: HashMap<String, ServiceHealth> = service_status
            .into_iter()
            .map(|(service, config)| {
                (service, ServiceHealth {
                    weight: config.weight,
                    current_load: config.current_load,
                    is_healthy: config.is_healthy,
                })
            })
            .collect();

        let load_balancing = LoadBalancingStatus {
            services: load_balancing_services,
            last_health_check: chrono::Utc::now().to_rfc3339(),
        };

        // Resource metrics
        let service_loads: HashMap<String, u64> = performance_metrics.service_metrics
            .iter()
            .map(|(service, metrics)| (service.clone(), metrics.requests))
            .collect();

        let error_rates: HashMap<String, f64> = performance_metrics.service_metrics
            .iter()
            .map(|(service, metrics)| (service.clone(), metrics.error_rate))
            .collect();

        let healthy_services = services.values().filter(|&&healthy| healthy).count() as u32;

        let resource_metrics = ResourceMetrics {
            service_loads,
            healthy_services,
            error_rates,
        };

        SystemStatus {
            fast_models,
            services,
            performance,
            load_balancing,
            resource_metrics,
        }
    }

    /// Get performance metrics
    pub fn get_performance_metrics(&self) -> PerformanceMetrics {
        self.metrics_collector.get_performance_metrics()
    }

    /// Get service performance comparison
    pub fn get_service_performance_comparison(&self) -> HashMap<String, crate::metrics::ServicePerformanceComparison> {
        self.metrics_collector.get_service_performance_comparison()
    }

    fn start_background_tasks(&self) {
        let load_balancer = self.load_balancer.clone();
        let metrics_collector = self.metrics_collector.clone();
        let service_executor = self.service_executor.clone();
        let health_check_interval = self.health_check_interval;

        tokio::spawn(async move {
            let mut interval = interval(health_check_interval);

            loop {
                interval.tick().await;

                // Health check all services
                let service_types = [
                    ServiceType::LFM2,
                    ServiceType::Ollama,
                    ServiceType::LMStudio,
                    ServiceType::OpenAI,
                    ServiceType::Anthropic,
                ];

                for service_type in &service_types {
                    let is_healthy = service_executor.health_check(service_type).await;
                    load_balancer.update_service_health(service_type, is_healthy);
                    metrics_collector.update_service_health(service_type.clone(), is_healthy);
                }

                tracing::debug!("Completed background health check cycle");
            }
        });
    }

    async fn execute_fallback(
        &self,
        user_request: &str,
        failed_service: &ServiceType,
    ) -> Result<ExecutionResult, CoordinatorError> {
        // Determine fallback service (prefer local services)
        let fallback_service = match failed_service {
            ServiceType::LFM2 => ServiceType::Ollama,
            ServiceType::Ollama => ServiceType::LMStudio,
            ServiceType::LMStudio => ServiceType::OpenAI,
            ServiceType::OpenAI => ServiceType::Anthropic,
            ServiceType::Anthropic => ServiceType::Ollama, // Cycle back to local
        };

        tracing::info!(
            failed_service = %failed_service.as_str(),
            fallback_service = %fallback_service.as_str(),
            "Attempting fallback execution"
        );

        self.service_executor
            .execute_request(&fallback_service, user_request)
            .await
            .map_err(|e| CoordinatorError::ServiceUnavailable {
                service: format!("Fallback service {} also failed: {}", fallback_service.as_str(), e)
            })
    }

    fn calculate_performance_ratio(
        &self,
        service: &ServiceType,
        execution_time: Duration,
    ) -> Option<f64> {
        let baseline_performance = self.baseline_performance.read();

        if let Some(&baseline_ms) = baseline_performance.get(service) {
            let current_ms = execution_time.as_millis() as f64;
            Some(baseline_ms / current_ms) // Higher ratio = better performance
        } else {
            // Update baseline if not set
            drop(baseline_performance);
            let mut baseline_performance = self.baseline_performance.write();
            baseline_performance.insert(service.clone(), execution_time.as_millis() as f64);
            None
        }
    }
}

impl Default for FastLLMCoordinator {
    fn default() -> Self {
        Self::new()
    }
}
