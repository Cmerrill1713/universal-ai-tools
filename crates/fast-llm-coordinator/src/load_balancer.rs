use crate::routing::ServiceType;
use dashmap::DashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub weight: f64,
    pub current_load: u32,
    pub max_concurrent: u32,
    pub response_time_avg: f64,
    pub error_rate: f64,
    pub last_health_check: u64,
    pub is_healthy: bool,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            weight: 1.0,
            current_load: 0,
            max_concurrent: 10,
            response_time_avg: 0.0,
            error_rate: 0.0,
            last_health_check: 0,
            is_healthy: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct LoadBalancingDecision {
    pub selected_service: ServiceType,
    pub original_service: ServiceType,
    pub was_load_balanced: bool,
    pub load_factor: f64,
    pub reasoning: String,
}

#[derive(Clone)]
pub struct LoadBalancer {
    service_configs: Arc<DashMap<ServiceType, ServiceConfig>>,
    request_history: Arc<RwLock<Vec<RequestRecord>>>,
    load_balancing_strategy: LoadBalancingStrategy,
    health_check_interval: Duration,
}

#[derive(Debug, Clone)]
struct RequestRecord {
    service: ServiceType,
    timestamp: Instant,
    duration: Duration,
    success: bool,
}

#[derive(Debug, Clone)]
pub enum LoadBalancingStrategy {
    WeightedRoundRobin,
    LeastConnections,
    ResponseTimeBased,
    Hybrid, // Combines multiple strategies
}

impl LoadBalancer {
    pub fn new(strategy: LoadBalancingStrategy) -> Self {
        let load_balancer = Self {
            service_configs: Arc::new(DashMap::new()),
            request_history: Arc::new(RwLock::new(Vec::new())),
            load_balancing_strategy: strategy,
            health_check_interval: Duration::from_secs(30),
        };

        load_balancer.initialize_default_configs();
        load_balancer.start_background_tasks();
        load_balancer
    }

    fn initialize_default_configs(&self) {
        // LFM2 - Highest weight (fastest local model)
        self.service_configs.insert(ServiceType::LFM2, ServiceConfig {
            weight: 10.0,
            max_concurrent: 50, // Can handle many simple requests
            response_time_avg: 50.0, // Very fast
            ..Default::default()
        });

        // Ollama - High weight for local processing
        self.service_configs.insert(ServiceType::Ollama, ServiceConfig {
            weight: 8.0,
            max_concurrent: 20,
            response_time_avg: 200.0,
            ..Default::default()
        });

        // LM Studio - Good for technical tasks
        self.service_configs.insert(ServiceType::LMStudio, ServiceConfig {
            weight: 7.0,
            max_concurrent: 15,
            response_time_avg: 300.0,
            ..Default::default()
        });

        // OpenAI - Lower weight due to network latency
        self.service_configs.insert(ServiceType::OpenAI, ServiceConfig {
            weight: 5.0,
            max_concurrent: 10,
            response_time_avg: 1000.0, // Network latency
            ..Default::default()
        });

        // Anthropic - Similar to OpenAI
        self.service_configs.insert(ServiceType::Anthropic, ServiceConfig {
            weight: 5.0,
            max_concurrent: 10,
            response_time_avg: 1200.0,
            ..Default::default()
        });

        tracing::info!("Initialized load balancer with default service configurations");
    }

    pub fn select_service(
        &self,
        target_service: ServiceType,
        force_load_balance: bool,
    ) -> LoadBalancingDecision {
        let original_service = target_service.clone();

        // If not forcing load balancing and target service is healthy, use it
        if !force_load_balance {
            if let Some(config) = self.service_configs.get(&target_service) {
                if config.is_healthy && config.current_load < config.max_concurrent {
                    return LoadBalancingDecision {
                        selected_service: target_service,
                        original_service,
                        was_load_balanced: false,
                        load_factor: config.current_load as f64 / config.max_concurrent as f64,
                        reasoning: "Target service available, no load balancing needed".to_string(),
                    };
                }
            }
        }

        // Apply load balancing strategy
        let selected_service = match self.load_balancing_strategy {
            LoadBalancingStrategy::WeightedRoundRobin => self.weighted_round_robin(),
            LoadBalancingStrategy::LeastConnections => self.least_connections(),
            LoadBalancingStrategy::ResponseTimeBased => self.response_time_based(),
            LoadBalancingStrategy::Hybrid => self.hybrid_selection(),
        };

        let was_load_balanced = selected_service != original_service;
        let load_factor = self.service_configs.get(&selected_service)
            .map(|config| config.current_load as f64 / config.max_concurrent as f64)
            .unwrap_or(1.0);

        LoadBalancingDecision {
            selected_service: selected_service.clone(),
            original_service,
            was_load_balanced,
            load_factor,
            reasoning: format!("Load balanced using {:?} strategy", self.load_balancing_strategy),
        }
    }

    fn weighted_round_robin(&self) -> ServiceType {
        let mut best_service = ServiceType::LFM2;
        let mut best_score = 0.0;

        for entry in self.service_configs.iter() {
            let service = entry.key();
            let config = entry.value();

            if !config.is_healthy {
                continue;
            }

            // Calculate weighted score (higher is better)
            let load_factor = if config.max_concurrent > 0 {
                1.0 - (config.current_load as f64 / config.max_concurrent as f64)
            } else {
                0.0
            };

            let score = config.weight * load_factor;

            if score > best_score {
                best_score = score;
                best_service = service.clone();
            }
        }

        tracing::debug!(
            service = %best_service.as_str(),
            score = %best_score,
            "Selected service using weighted round robin"
        );

        best_service
    }

    fn least_connections(&self) -> ServiceType {
        let mut best_service = ServiceType::LFM2;
        let mut least_load = u32::MAX;

        for entry in self.service_configs.iter() {
            let service = entry.key();
            let config = entry.value();

            if config.is_healthy && config.current_load < least_load {
                least_load = config.current_load;
                best_service = service.clone();
            }
        }

        tracing::debug!(
            service = %best_service.as_str(),
            load = %least_load,
            "Selected service using least connections"
        );

        best_service
    }

    fn response_time_based(&self) -> ServiceType {
        let mut best_service = ServiceType::LFM2;
        let mut best_response_time = f64::MAX;

        for entry in self.service_configs.iter() {
            let service = entry.key();
            let config = entry.value();

            if config.is_healthy && config.response_time_avg < best_response_time {
                best_response_time = config.response_time_avg;
                best_service = service.clone();
            }
        }

        tracing::debug!(
            service = %best_service.as_str(),
            response_time = %best_response_time,
            "Selected service using response time"
        );

        best_service
    }

    fn hybrid_selection(&self) -> ServiceType {
        let mut best_service = ServiceType::LFM2;
        let mut best_score = 0.0;

        for entry in self.service_configs.iter() {
            let service = entry.key();
            let config = entry.value();

            if !config.is_healthy {
                continue;
            }

            // Hybrid scoring: combine weight, load, response time, and error rate
            let load_factor = if config.max_concurrent > 0 {
                1.0 - (config.current_load as f64 / config.max_concurrent as f64)
            } else {
                0.0
            };

            let response_time_factor = 1.0 / (1.0 + config.response_time_avg / 1000.0);
            let error_rate_factor = 1.0 - config.error_rate.min(0.9);

            let score = config.weight * load_factor * response_time_factor * error_rate_factor;

            if score > best_score {
                best_score = score;
                best_service = service.clone();
            }
        }

        tracing::debug!(
            service = %best_service.as_str(),
            score = %best_score,
            "Selected service using hybrid strategy"
        );

        best_service
    }

    pub fn record_request_start(&self, service: &ServiceType) {
        if let Some(mut config) = self.service_configs.get_mut(service) {
            config.current_load += 1;
        }

        tracing::trace!(
            service = %service.as_str(),
            "Request started, incremented load"
        );
    }

    pub fn record_request_end(
        &self,
        service: &ServiceType,
        duration: Duration,
        success: bool,
    ) {
        // Update service config
        if let Some(mut config) = self.service_configs.get_mut(service) {
            config.current_load = config.current_load.saturating_sub(1);

            // Update rolling average response time
            let duration_ms = duration.as_millis() as f64;
            config.response_time_avg = (config.response_time_avg * 0.9) + (duration_ms * 0.1);

            // Update error rate (simple exponential moving average)
            let error_contribution = if success { 0.0 } else { 1.0 };
            config.error_rate = (config.error_rate * 0.95) + (error_contribution * 0.05);
        }

        // Record in history
        let record = RequestRecord {
            service: service.clone(),
            timestamp: Instant::now(),
            duration,
            success,
        };

        {
            let mut history = self.request_history.write();
            history.push(record);

            // Keep only recent history (last 1000 requests)
            if history.len() > 1000 {
                history.drain(..100); // Remove oldest 100
            }
        }

        tracing::trace!(
            service = %service.as_str(),
            duration_ms = %duration.as_millis(),
            success = %success,
            "Request ended, updated metrics"
        );
    }

    pub fn update_service_health(&self, service: &ServiceType, is_healthy: bool) {
        if let Some(mut config) = self.service_configs.get_mut(service) {
            config.is_healthy = is_healthy;
            config.last_health_check = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
        }

        tracing::info!(
            service = %service.as_str(),
            healthy = %is_healthy,
            "Service health updated"
        );
    }

    fn start_background_tasks(&self) {
        let service_configs = Arc::clone(&self.service_configs);
        let request_history = Arc::clone(&self.request_history);
        let health_check_interval = self.health_check_interval;

        // Start health monitoring task
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(health_check_interval);

            loop {
                interval.tick().await;

                // Clean up old request history
                {
                    let mut history = request_history.write();
                    let cutoff = Instant::now() - Duration::from_secs(300); // 5 minutes
                    history.retain(|record| record.timestamp > cutoff);
                }

                // Update service weights based on recent performance
                for entry in service_configs.iter() {
                    let service = entry.key();
                    let mut config = entry.value().clone();

                    // Adjust weights based on error rate and response time
                    let performance_factor = (1.0 - config.error_rate) *
                        (1000.0 / (1000.0 + config.response_time_avg));

                    // Don't let weight go below 0.1 or above 10.0
                    config.weight = (config.weight * 0.9 + performance_factor * 0.1)
                        .clamp(0.1, 10.0);

                    service_configs.insert(service.clone(), config);
                }

                tracing::debug!("Completed background health check and weight adjustment");
            }
        });
    }

    pub fn get_service_status(&self) -> HashMap<String, ServiceConfig> {
        self.service_configs
            .iter()
            .map(|entry| (entry.key().as_str().to_string(), entry.value().clone()))
            .collect()
    }

    pub fn get_load_balancing_stats(&self) -> LoadBalancingStats {
        let history = self.request_history.read();
        let total_requests = history.len();
        let successful_requests = history.iter().filter(|r| r.success).count();

        let avg_response_time = if !history.is_empty() {
            history.iter()
                .map(|r| r.duration.as_millis() as f64)
                .sum::<f64>() / history.len() as f64
        } else {
            0.0
        };

        let service_distribution = {
            let mut dist = HashMap::new();
            for record in history.iter() {
                *dist.entry(record.service.as_str().to_string()).or_insert(0) += 1;
            }
            dist
        };

        LoadBalancingStats {
            total_requests,
            successful_requests,
            success_rate: if total_requests > 0 {
                successful_requests as f64 / total_requests as f64
            } else {
                0.0
            },
            average_response_time: avg_response_time,
            service_distribution,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBalancingStats {
    pub total_requests: usize,
    pub successful_requests: usize,
    pub success_rate: f64,
    pub average_response_time: f64,
    pub service_distribution: HashMap<String, u32>,
}

impl Default for LoadBalancer {
    fn default() -> Self {
        Self::new(LoadBalancingStrategy::Hybrid)
    }
}
