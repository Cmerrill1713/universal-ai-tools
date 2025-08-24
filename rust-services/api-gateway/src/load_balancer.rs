use crate::{ServiceInfo, Config};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, warn};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub enum LoadBalancingAlgorithm {
    RoundRobin,
    LeastConnections,
    Weighted,
}

pub struct LoadBalancer {
    algorithm: LoadBalancingAlgorithm,
    round_robin_counters: Arc<RwLock<HashMap<String, usize>>>,
    connection_counts: Arc<RwLock<HashMap<String, usize>>>,
    config: Config,
}

impl LoadBalancer {
    pub async fn new(config: &Config) -> Result<Self> {
        let algorithm = match config.load_balancer.algorithm.as_str() {
            "round_robin" => LoadBalancingAlgorithm::RoundRobin,
            "least_connections" => LoadBalancingAlgorithm::LeastConnections,
            "weighted" => LoadBalancingAlgorithm::Weighted,
            _ => {
                warn!("Unknown load balancing algorithm: {}, using round_robin", config.load_balancer.algorithm);
                LoadBalancingAlgorithm::RoundRobin
            }
        };

        Ok(Self {
            algorithm,
            round_robin_counters: Arc::new(RwLock::new(HashMap::new())),
            connection_counts: Arc::new(RwLock::new(HashMap::new())),
            config: config.clone(),
        })
    }

    pub async fn get_service(&self, service_name: &str) -> Result<Option<ServiceInfo>> {
        // This would normally get services from the service registry
        // For now, we'll simulate with known services
        let services = self.get_healthy_services(service_name).await?;
        
        if services.is_empty() {
            return Ok(None);
        }

        match self.algorithm {
            LoadBalancingAlgorithm::RoundRobin => {
                self.select_round_robin(service_name, &services).await
            }
            LoadBalancingAlgorithm::LeastConnections => {
                self.select_least_connections(&services).await
            }
            LoadBalancingAlgorithm::Weighted => {
                self.select_weighted(&services).await
            }
        }
    }

    async fn select_round_robin(
        &self,
        service_name: &str,
        services: &[ServiceInfo],
    ) -> Result<Option<ServiceInfo>> {
        let mut counters = self.round_robin_counters.write().await;
        let counter = counters.entry(service_name.to_string()).or_insert(0);
        
        let selected_index = *counter % services.len();
        *counter += 1;

        debug!("Round robin selected service {} index {}", service_name, selected_index);
        Ok(Some(services[selected_index].clone()))
    }

    async fn select_least_connections(
        &self,
        services: &[ServiceInfo],
    ) -> Result<Option<ServiceInfo>> {
        let connection_counts = self.connection_counts.read().await;
        
        let mut best_service = None;
        let mut min_connections = usize::MAX;

        for service in services {
            let connections = connection_counts.get(&service.id).unwrap_or(&0);
            if *connections < min_connections {
                min_connections = *connections;
                best_service = Some(service.clone());
            }
        }

        if let Some(ref service) = best_service {
            debug!("Least connections selected service {} with {} connections", 
                   service.name, min_connections);
        }

        Ok(best_service)
    }

    async fn select_weighted(&self, services: &[ServiceInfo]) -> Result<Option<ServiceInfo>> {
        // Weight based on load score (higher score = better, so invert for weight)
        let total_weight: f64 = services.iter()
            .map(|s| 1.0 - s.load_score.min(0.99)) // Avoid division by zero
            .sum();

        if total_weight <= 0.0 {
            return self.select_round_robin("", services).await;
        }

        // Simple weighted random selection
        let mut random_weight = rand::random::<f64>() * total_weight;
        
        for service in services {
            let weight = 1.0 - service.load_score.min(0.99);
            if random_weight <= weight {
                debug!("Weighted selection chose service {} with load score {}", 
                       service.name, service.load_score);
                return Ok(Some(service.clone()));
            }
            random_weight -= weight;
        }

        // Fallback to first service
        Ok(Some(services[0].clone()))
    }

    async fn get_healthy_services(&self, _service_name: &str) -> Result<Vec<ServiceInfo>> {
        // This is now handled by the main.rs proxy logic using the service registry
        // Return empty vector to indicate service registry should be used instead
        Ok(vec![])
    }

    pub async fn increment_connections(&self, service_id: &str) -> Result<()> {
        let mut connections = self.connection_counts.write().await;
        *connections.entry(service_id.to_string()).or_insert(0) += 1;
        Ok(())
    }

    pub async fn decrement_connections(&self, service_id: &str) -> Result<()> {
        let mut connections = self.connection_counts.write().await;
        if let Some(count) = connections.get_mut(service_id) {
            *count = count.saturating_sub(1);
        }
        Ok(())
    }

    pub async fn get_connection_count(&self, service_id: &str) -> usize {
        let connections = self.connection_counts.read().await;
        connections.get(service_id).unwrap_or(&0).clone()
    }

    pub async fn get_load_balancer_stats(&self) -> Result<serde_json::Value> {
        let connections = self.connection_counts.read().await;
        let counters = self.round_robin_counters.read().await;

        Ok(serde_json::json!({
            "algorithm": match self.algorithm {
                LoadBalancingAlgorithm::RoundRobin => "round_robin",
                LoadBalancingAlgorithm::LeastConnections => "least_connections", 
                LoadBalancingAlgorithm::Weighted => "weighted",
            },
            "active_connections": connections.clone(),
            "round_robin_counters": counters.clone(),
            "last_updated": chrono::Utc::now()
        }))
    }
}