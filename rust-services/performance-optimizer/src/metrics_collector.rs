use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use sysinfo::System;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::config::Config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub system_metrics: SystemMetrics,
    pub service_metrics: HashMap<String, ServiceMetrics>,
    pub network_metrics: NetworkMetrics,
    pub database_metrics: Option<DatabaseMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub memory_total: u64,
    pub memory_used: u64,
    pub disk_usage: f64,
    pub load_average: f64,
    pub processes_count: usize,
    pub uptime: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMetrics {
    pub service_name: String,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub response_time: f64,
    pub request_count: u64,
    pub error_count: u64,
    pub status: String,
    pub last_health_check: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub packets_sent: u64,
    pub packets_received: u64,
    pub connections_active: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMetrics {
    pub connection_count: u32,
    pub active_queries: u32,
    pub slow_queries: u32,
    pub cache_hit_ratio: f64,
    pub avg_query_time: f64,
}

pub struct MetricsCollector {
    config: Config,
    system: RwLock<System>,
    metrics_history: RwLock<Vec<MetricsSnapshot>>,
    http_client: reqwest::Client,
}

impl MetricsCollector {
    pub async fn new(config: &Config) -> Result<Self> {
        let system = System::new_all();
        
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()?;

        Ok(Self {
            config: config.clone(),
            system: RwLock::new(system),
            metrics_history: RwLock::new(Vec::new()),
            http_client,
        })
    }

    pub async fn collect_all_metrics(&self) -> Result<MetricsSnapshot> {
        debug!("📊 Collecting comprehensive system metrics");

        let timestamp = chrono::Utc::now();
        
        // Collect system metrics
        let system_metrics = self.collect_system_metrics().await?;
        
        // Collect service metrics
        let service_metrics = self.collect_service_metrics().await?;
        
        // Collect network metrics
        let network_metrics = self.collect_network_metrics().await?;
        
        // Collect database metrics (if available)
        let database_metrics = self.collect_database_metrics().await.ok();

        let snapshot = MetricsSnapshot {
            timestamp,
            system_metrics,
            service_metrics,
            network_metrics,
            database_metrics,
        };

        // Store in history
        self.store_metrics_snapshot(snapshot.clone()).await?;

        debug!("✅ Metrics collection completed");
        Ok(snapshot)
    }

    async fn collect_system_metrics(&self) -> Result<SystemMetrics> {
        let mut system = self.system.write().await;
        system.refresh_all();

        // Get CPU usage (average across all cores)
        let cpu_usage = system.global_cpu_info().cpu_usage() as f64;

        // Get memory information
        let memory_total = system.total_memory();
        let memory_used = system.used_memory();
        let memory_usage = (memory_used as f64 / memory_total as f64) * 100.0;

        // Get disk usage (simplified using mock data for now)
        let disk_usage = 75.0; // Mock disk usage percentage

        // Get load average (simplified using mock data for now)
        let load_average = 1.5; // Mock load average

        // Process count
        let processes_count = system.processes().len();

        // System uptime (mock for now)
        let uptime = 86400; // Mock uptime in seconds

        Ok(SystemMetrics {
            cpu_usage,
            memory_usage,
            memory_total,
            memory_used,
            disk_usage,
            load_average,
            processes_count,
            uptime,
        })
    }

    async fn collect_service_metrics(&self) -> Result<HashMap<String, ServiceMetrics>> {
        let mut service_metrics = HashMap::new();

        for (service_name, service_config) in &self.config.services {
            debug!("🔍 Collecting metrics for service: {}", service_name);

            let start_time = Instant::now();
            
            // Health check
            let health_status = match self.check_service_health(&service_config.health_check).await {
                Ok(status) => status,
                Err(e) => {
                    warn!("Health check failed for {}: {}", service_name, e);
                    "unhealthy".to_string()
                }
            };

            let response_time = start_time.elapsed().as_millis() as f64;

            // Get service-specific metrics if available
            let (cpu_usage, memory_usage, request_count, error_count) = 
                self.get_service_specific_metrics(service_config).await;

            let metrics = ServiceMetrics {
                service_name: service_name.clone(),
                cpu_usage,
                memory_usage,
                response_time,
                request_count,
                error_count,
                status: health_status,
                last_health_check: chrono::Utc::now(),
            };

            service_metrics.insert(service_name.clone(), metrics);
        }

        Ok(service_metrics)
    }

    async fn check_service_health(&self, health_url: &str) -> Result<String> {
        match self.http_client.get(health_url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    Ok("healthy".to_string())
                } else {
                    Ok(format!("unhealthy_{}", response.status().as_u16()))
                }
            }
            Err(e) => {
                Err(anyhow!("Health check request failed: {}", e))
            }
        }
    }

    async fn get_service_specific_metrics(
        &self, 
        service_config: &crate::config::ServiceConfig
    ) -> (f64, f64, u64, u64) {
        // Try to get metrics from service metrics endpoint if available
        if let Some(metrics_endpoint) = &service_config.metrics_endpoint {
            match self.fetch_service_metrics(metrics_endpoint).await {
                Ok((cpu, memory, requests, errors)) => return (cpu, memory, requests, errors),
                Err(e) => debug!("Failed to fetch metrics from {}: {}", metrics_endpoint, e),
            }
        }

        // Default values if metrics not available
        (0.0, 0.0, 0, 0)
    }

    async fn fetch_service_metrics(&self, metrics_url: &str) -> Result<(f64, f64, u64, u64)> {
        let response = self.http_client.get(metrics_url).send().await?;
        let metrics_text = response.text().await?;

        // Parse Prometheus-style metrics (simplified)
        let cpu_usage = self.parse_prometheus_metric(&metrics_text, "cpu_usage_percent").unwrap_or(0.0);
        let memory_usage = self.parse_prometheus_metric(&metrics_text, "memory_usage_percent").unwrap_or(0.0);
        let request_count = self.parse_prometheus_metric(&metrics_text, "http_requests_total").unwrap_or(0.0) as u64;
        let error_count = self.parse_prometheus_metric(&metrics_text, "http_errors_total").unwrap_or(0.0) as u64;

        Ok((cpu_usage, memory_usage, request_count, error_count))
    }

    fn parse_prometheus_metric(&self, metrics_text: &str, metric_name: &str) -> Option<f64> {
        // Simple Prometheus metric parser
        for line in metrics_text.lines() {
            if line.starts_with(metric_name) && !line.starts_with('#') {
                if let Some(value_part) = line.split_whitespace().last() {
                    return value_part.parse().ok();
                }
            }
        }
        None
    }

    async fn collect_network_metrics(&self) -> Result<NetworkMetrics> {
        // For now, return simplified mock network metrics
        // In a real implementation, this would collect actual network statistics
        Ok(NetworkMetrics {
            bytes_sent: 1024000,
            bytes_received: 2048000,
            packets_sent: 1000,
            packets_received: 2000,
            connections_active: 10,
        })
    }

    async fn collect_database_metrics(&self) -> Result<DatabaseMetrics> {
        // This would connect to actual databases and collect metrics
        // For now, return mock data
        Ok(DatabaseMetrics {
            connection_count: 5,
            active_queries: 2,
            slow_queries: 0,
            cache_hit_ratio: 95.5,
            avg_query_time: 12.3,
        })
    }

    async fn store_metrics_snapshot(&self, snapshot: MetricsSnapshot) -> Result<()> {
        let mut history = self.metrics_history.write().await;
        
        // Add to history
        history.push(snapshot);
        
        // Cleanup old entries (keep last 24 hours)
        let cutoff_time = chrono::Utc::now() - chrono::Duration::hours(self.config.monitoring.retention_hours as i64);
        history.retain(|s| s.timestamp > cutoff_time);
        
        debug!("📝 Metrics snapshot stored, history size: {}", history.len());
        Ok(())
    }

    pub async fn get_current_metrics(&self) -> Result<HashMap<String, serde_json::Value>> {
        let history = self.metrics_history.read().await;
        
        if let Some(latest) = history.last() {
            let mut metrics = HashMap::new();
            metrics.insert("timestamp".to_string(), serde_json::to_value(latest.timestamp)?);
            metrics.insert("system".to_string(), serde_json::to_value(&latest.system_metrics)?);
            metrics.insert("services".to_string(), serde_json::to_value(&latest.service_metrics)?);
            metrics.insert("network".to_string(), serde_json::to_value(&latest.network_metrics)?);
            if let Some(db_metrics) = &latest.database_metrics {
                metrics.insert("database".to_string(), serde_json::to_value(db_metrics)?);
            }
            Ok(metrics)
        } else {
            Err(anyhow!("No metrics available"))
        }
    }

    pub async fn get_metrics_history(&self, hours: u32) -> Result<Vec<MetricsSnapshot>> {
        let history = self.metrics_history.read().await;
        let cutoff_time = chrono::Utc::now() - chrono::Duration::hours(hours as i64);
        
        let filtered: Vec<MetricsSnapshot> = history
            .iter()
            .filter(|snapshot| snapshot.timestamp > cutoff_time)
            .cloned()
            .collect();
        
        Ok(filtered)
    }

    pub async fn get_prometheus_metrics(&self) -> Result<String> {
        let history = self.metrics_history.read().await;
        
        if let Some(latest) = history.last() {
            let mut prometheus_output = String::new();
            
            // System metrics
            prometheus_output.push_str(&format!("system_cpu_usage {}\n", latest.system_metrics.cpu_usage));
            prometheus_output.push_str(&format!("system_memory_usage {}\n", latest.system_metrics.memory_usage));
            prometheus_output.push_str(&format!("system_disk_usage {}\n", latest.system_metrics.disk_usage));
            
            // Service metrics
            for (service_name, metrics) in &latest.service_metrics {
                prometheus_output.push_str(&format!("service_cpu_usage{{service=\"{}\"}} {}\n", service_name, metrics.cpu_usage));
                prometheus_output.push_str(&format!("service_memory_usage{{service=\"{}\"}} {}\n", service_name, metrics.memory_usage));
                prometheus_output.push_str(&format!("service_response_time{{service=\"{}\"}} {}\n", service_name, metrics.response_time));
            }
            
            Ok(prometheus_output)
        } else {
            Ok("# No metrics available\n".to_string())
        }
    }
}