//! Health monitoring for LLM providers

use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct ProviderHealth {
    pub provider_name: String,
    pub healthy: bool,
    pub last_check: Instant,
    pub consecutive_failures: u32,
    pub average_response_time: Duration,
}

impl ProviderHealth {
    pub fn new(provider_name: String) -> Self {
        Self {
            provider_name,
            healthy: true,
            last_check: Instant::now(),
            consecutive_failures: 0,
            average_response_time: Duration::from_millis(100),
        }
    }
}

pub struct HealthMonitor {
    providers: RwLock<HashMap<String, ProviderHealth>>,
    _check_interval: Duration,
}

impl Default for HealthMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl HealthMonitor {
    pub fn new() -> Self {
        Self {
            providers: RwLock::new(HashMap::new()),
            _check_interval: Duration::from_secs(30),
        }
    }

    pub async fn register_provider(&self, provider_name: String) {
        let mut providers = self.providers.write().await;
        providers.insert(provider_name.clone(), ProviderHealth::new(provider_name));
    }

    pub async fn get_health(&self, provider_name: &str) -> Option<ProviderHealth> {
        let providers = self.providers.read().await;
        providers.get(provider_name).cloned()
    }
}

