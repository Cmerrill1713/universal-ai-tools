use crate::{ServiceInfo, ServiceStatus, Config};
use anyhow::Result;
use dashmap::DashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

pub struct ServiceRegistry {
    services: Arc<DashMap<String, ServiceInfo>>,
    config: Config,
}

impl ServiceRegistry {
    pub async fn new(config: &Config) -> Result<Self> {
        Ok(Self {
            services: Arc::new(DashMap::new()),
            config: config.clone(),
        })
    }

    pub async fn register_service(&self, mut service: ServiceInfo) -> Result<()> {
        service.status = ServiceStatus::Unknown;
        service.last_health_check = None;
        
        let service_id = service.id.clone();
        let service_name = service.name.clone();
        
        self.services.insert(service_id.clone(), service);
        
        info!("Registered service: {} ({})", service_name, service_id);
        Ok(())
    }

    pub async fn unregister_service(&self, service_id: &str) -> Result<()> {
        if let Some((_, service)) = self.services.remove(service_id) {
            info!("Unregistered service: {} ({})", service.name, service_id);
        } else {
            warn!("Attempted to unregister non-existent service: {}", service_id);
        }
        Ok(())
    }

    pub async fn get_service(&self, service_id: &str) -> Result<Option<ServiceInfo>> {
        Ok(self.services.get(service_id).map(|entry| entry.value().clone()))
    }

    pub async fn get_service_by_name(&self, service_name: &str) -> Result<Option<ServiceInfo>> {
        for entry in self.services.iter() {
            if entry.value().name == service_name {
                return Ok(Some(entry.value().clone()));
            }
        }
        Ok(None)
    }

    pub async fn list_services(&self) -> Result<Vec<ServiceInfo>> {
        let services: Vec<ServiceInfo> = self.services.iter()
            .map(|entry| entry.value().clone())
            .collect();
        Ok(services)
    }

    pub async fn list_healthy_services(&self) -> Result<Vec<ServiceInfo>> {
        let services: Vec<ServiceInfo> = self.services.iter()
            .filter(|entry| entry.value().status == ServiceStatus::Healthy)
            .map(|entry| entry.value().clone())
            .collect();
        Ok(services)
    }

    pub async fn list_services_by_name(&self, service_name: &str) -> Result<Vec<ServiceInfo>> {
        let services: Vec<ServiceInfo> = self.services.iter()
            .filter(|entry| entry.value().name == service_name)
            .map(|entry| entry.value().clone())
            .collect();
        Ok(services)
    }

    pub async fn update_service_status(
        &self,
        service_id: &str,
        status: ServiceStatus,
        response_time_ms: Option<u64>,
    ) -> Result<()> {
        if let Some(mut entry) = self.services.get_mut(service_id) {
            entry.status = status.clone();
            entry.last_health_check = Some(chrono::Utc::now());
            entry.response_time_ms = response_time_ms;

            // Update load score based on health and response time
            entry.load_score = self.calculate_load_score(&entry, response_time_ms);

            debug!("Updated service {} status to {:?}", service_id, status);
        } else {
            warn!("Attempted to update status of non-existent service: {}", service_id);
        }
        Ok(())
    }

    fn calculate_load_score(&self, service: &ServiceInfo, response_time_ms: Option<u64>) -> f64 {
        let mut score = 0.0;

        // Health status contributes to score
        match service.status {
            ServiceStatus::Healthy => score += 1.0,
            ServiceStatus::Unknown => score += 0.5,
            ServiceStatus::Unhealthy => score += 0.0,
        }

        // Response time contributes to score (lower is better)
        if let Some(response_time) = response_time_ms {
            let time_score = 1.0 - (response_time as f64 / 1000.0).min(1.0); // Normalize to 0-1
            score += time_score;
        }

        score / 2.0 // Normalize final score to 0-1 range
    }

    pub async fn get_service_count(&self) -> usize {
        self.services.len()
    }

    pub async fn get_healthy_service_count(&self) -> usize {
        self.services.iter()
            .filter(|entry| entry.value().status == ServiceStatus::Healthy)
            .count()
    }

    pub async fn cleanup_stale_services(&self, max_age_minutes: i64) -> Result<usize> {
        let cutoff = chrono::Utc::now() - chrono::Duration::minutes(max_age_minutes);
        let mut removed_count = 0;

        let stale_services: Vec<String> = self.services.iter()
            .filter_map(|entry| {
                let service = entry.value();
                if let Some(last_check) = service.last_health_check {
                    if last_check < cutoff && service.status == ServiceStatus::Unhealthy {
                        return Some(service.id.clone());
                    }
                }
                None
            })
            .collect();

        for service_id in stale_services {
            if let Some((_, service)) = self.services.remove(&service_id) {
                info!("Removed stale service: {} ({})", service.name, service_id);
                removed_count += 1;
            }
        }

        if removed_count > 0 {
            info!("Cleaned up {} stale services", removed_count);
        }

        Ok(removed_count)
    }

    pub async fn get_registry_stats(&self) -> Result<serde_json::Value> {
        let total_services = self.services.len();
        let healthy_services = self.get_healthy_service_count().await;
        let unhealthy_services = self.services.iter()
            .filter(|entry| entry.value().status == ServiceStatus::Unhealthy)
            .count();
        let unknown_services = total_services - healthy_services - unhealthy_services;

        let mut service_types = std::collections::HashMap::new();
        for entry in self.services.iter() {
            let service_name = &entry.value().name;
            *service_types.entry(service_name.clone()).or_insert(0) += 1;
        }

        Ok(serde_json::json!({
            "total_services": total_services,
            "healthy_services": healthy_services,
            "unhealthy_services": unhealthy_services,
            "unknown_services": unknown_services,
            "service_types": service_types,
            "last_updated": chrono::Utc::now()
        }))
    }
}