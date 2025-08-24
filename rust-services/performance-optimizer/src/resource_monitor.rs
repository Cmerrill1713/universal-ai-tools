use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, warn, error, info};

use crate::config::Config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceAlert {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub resource_type: ResourceType,
    pub service: Option<String>,
    pub severity: AlertSeverity,
    pub message: String,
    pub current_value: f64,
    pub threshold: f64,
    pub recommended_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResourceType {
    #[serde(rename = "cpu")]
    Cpu,
    #[serde(rename = "memory")]
    Memory,
    #[serde(rename = "disk")]
    Disk,
    #[serde(rename = "network")]
    Network,
    #[serde(rename = "response_time")]
    ResponseTime,
    #[serde(rename = "error_rate")]
    ErrorRate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSeverity {
    #[serde(rename = "info")]
    Info,
    #[serde(rename = "warning")]
    Warning,
    #[serde(rename = "critical")]
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceThreshold {
    pub resource_type: ResourceType,
    pub warning_threshold: f64,
    pub critical_threshold: f64,
    pub check_interval_seconds: u64,
}

pub struct ResourceMonitor {
    config: Config,
    active_alerts: tokio::sync::RwLock<HashMap<String, ResourceAlert>>,
    alert_history: tokio::sync::RwLock<Vec<ResourceAlert>>,
    http_client: reqwest::Client,
}

impl ResourceMonitor {
    pub async fn new(config: &Config) -> Result<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?;

        Ok(Self {
            config: config.clone(),
            active_alerts: tokio::sync::RwLock::new(HashMap::new()),
            alert_history: tokio::sync::RwLock::new(Vec::new()),
            http_client,
        })
    }

    pub async fn monitor_resources(&self) -> Result<()> {
        debug!("🔍 Starting resource monitoring cycle");

        // Monitor system-level resources
        self.monitor_system_resources().await?;

        // Monitor service-specific resources
        self.monitor_service_resources().await?;

        // Process and handle alerts
        self.process_alerts().await?;

        debug!("✅ Resource monitoring cycle completed");
        Ok(())
    }

    async fn monitor_system_resources(&self) -> Result<()> {
        debug!("📊 Monitoring system-level resources");

        // Get current system metrics (simplified - would use actual metrics collector)
        let cpu_usage = self.get_system_cpu_usage().await?;
        let memory_usage = self.get_system_memory_usage().await?;
        let disk_usage = self.get_system_disk_usage().await?;

        // Check CPU usage
        self.check_resource_threshold(
            ResourceType::Cpu,
            None,
            cpu_usage,
            self.config.thresholds.cpu_warning,
            self.config.thresholds.cpu_critical,
            "System CPU usage",
        ).await?;

        // Check memory usage
        self.check_resource_threshold(
            ResourceType::Memory,
            None,
            memory_usage,
            self.config.thresholds.memory_warning,
            self.config.thresholds.memory_critical,
            "System memory usage",
        ).await?;

        // Check disk usage (if above 80%)
        self.check_resource_threshold(
            ResourceType::Disk,
            None,
            disk_usage,
            80.0,
            95.0,
            "System disk usage",
        ).await?;

        Ok(())
    }

    async fn monitor_service_resources(&self) -> Result<()> {
        debug!("🔍 Monitoring service-specific resources");

        for (service_name, service_config) in &self.config.services {
            // Check service health
            match self.check_service_health(&service_config.health_check).await {
                Ok(response_time) => {
                    // Check response time
                    self.check_resource_threshold(
                        ResourceType::ResponseTime,
                        Some(service_name.clone()),
                        response_time,
                        self.config.thresholds.response_time_warning,
                        self.config.thresholds.response_time_critical,
                        &format!("{} response time", service_name),
                    ).await?;
                }
                Err(e) => {
                    // Service is down - create critical alert
                    self.create_alert(
                        ResourceType::ResponseTime,
                        Some(service_name.clone()),
                        AlertSeverity::Critical,
                        format!("Service {} is unreachable: {}", service_name, e),
                        0.0,
                        1.0,
                        "Check service status, restart if necessary, investigate logs",
                    ).await?;
                }
            }

            // Get service-specific metrics if available
            if let Some(metrics_endpoint) = &service_config.metrics_endpoint {
                if let Ok(metrics) = self.fetch_service_metrics(metrics_endpoint).await {
                    // Check error rate
                    if let Some(error_rate) = metrics.get("error_rate") {
                        self.check_resource_threshold(
                            ResourceType::ErrorRate,
                            Some(service_name.clone()),
                            *error_rate,
                            self.config.thresholds.error_rate_warning,
                            self.config.thresholds.error_rate_critical,
                            &format!("{} error rate", service_name),
                        ).await?;
                    }

                    // Check service CPU usage
                    if let Some(cpu_usage) = metrics.get("cpu_usage") {
                        self.check_resource_threshold(
                            ResourceType::Cpu,
                            Some(service_name.clone()),
                            *cpu_usage,
                            self.config.thresholds.cpu_warning,
                            self.config.thresholds.cpu_critical,
                            &format!("{} CPU usage", service_name),
                        ).await?;
                    }

                    // Check service memory usage
                    if let Some(memory_usage) = metrics.get("memory_usage") {
                        self.check_resource_threshold(
                            ResourceType::Memory,
                            Some(service_name.clone()),
                            *memory_usage,
                            self.config.thresholds.memory_warning,
                            self.config.thresholds.memory_critical,
                            &format!("{} memory usage", service_name),
                        ).await?;
                    }
                }
            }
        }

        Ok(())
    }

    async fn check_resource_threshold(
        &self,
        resource_type: ResourceType,
        service: Option<String>,
        current_value: f64,
        warning_threshold: f64,
        critical_threshold: f64,
        description: &str,
    ) -> Result<()> {
        let alert_key = format!("{:?}_{}", resource_type, service.as_deref().unwrap_or("system"));

        if current_value > critical_threshold {
            self.create_alert(
                resource_type,
                service,
                AlertSeverity::Critical,
                format!("{} at critical level: {:.1}%", description, current_value),
                current_value,
                critical_threshold,
                "Immediate action required: scale resources, optimize performance, or restart services",
            ).await?;
        } else if current_value > warning_threshold {
            self.create_alert(
                resource_type,
                service,
                AlertSeverity::Warning,
                format!("{} above warning level: {:.1}%", description, current_value),
                current_value,
                warning_threshold,
                "Monitor closely and consider optimization or scaling",
            ).await?;
        } else {
            // Clear alert if it exists and resource is back to normal
            let mut active_alerts = self.active_alerts.write().await;
            if active_alerts.remove(&alert_key).is_some() {
                info!("✅ Cleared alert for {}: resource usage back to normal", description);
            }
        }

        Ok(())
    }

    async fn create_alert(
        &self,
        resource_type: ResourceType,
        service: Option<String>,
        severity: AlertSeverity,
        message: String,
        current_value: f64,
        threshold: f64,
        recommended_action: &str,
    ) -> Result<()> {
        let alert_key = format!("{:?}_{}", resource_type, service.as_deref().unwrap_or("system"));
        
        let alert = ResourceAlert {
            timestamp: chrono::Utc::now(),
            resource_type,
            service,
            severity: severity.clone(),
            message: message.clone(),
            current_value,
            threshold,
            recommended_action: recommended_action.to_string(),
        };

        // Check if this is a new alert or an update
        let mut active_alerts = self.active_alerts.write().await;
        let is_new_alert = !active_alerts.contains_key(&alert_key);
        
        active_alerts.insert(alert_key, alert.clone());

        if is_new_alert {
            match severity {
                AlertSeverity::Critical => error!("🚨 CRITICAL ALERT: {}", message),
                AlertSeverity::Warning => warn!("⚠️ WARNING ALERT: {}", message),
                AlertSeverity::Info => info!("ℹ️ INFO ALERT: {}", message),
            }

            // Add to alert history
            let mut history = self.alert_history.write().await;
            history.push(alert.clone());
            
            // Keep only last 1000 alerts in history
            if history.len() > 1000 {
                history.drain(0..100); // Remove oldest 100 alerts
            }
        }

        Ok(())
    }

    async fn process_alerts(&self) -> Result<()> {
        let active_alerts = self.active_alerts.read().await;
        
        if !active_alerts.is_empty() {
            debug!("📋 Processing {} active resource alerts", active_alerts.len());

            // Count alerts by severity
            let mut critical_count = 0;
            let mut warning_count = 0;
            let mut info_count = 0;

            for alert in active_alerts.values() {
                match alert.severity {
                    AlertSeverity::Critical => critical_count += 1,
                    AlertSeverity::Warning => warning_count += 1,
                    AlertSeverity::Info => info_count += 1,
                }
            }

            if critical_count > 0 {
                error!("🚨 {} critical alerts require immediate attention", critical_count);
            }
            if warning_count > 0 {
                warn!("⚠️ {} warning alerts need monitoring", warning_count);
            }
            if info_count > 0 {
                info!("ℹ️ {} informational alerts", info_count);
            }

            // Here you would typically send notifications, update dashboards, etc.
            self.send_alert_notifications().await?;
        }

        Ok(())
    }

    async fn send_alert_notifications(&self) -> Result<()> {
        // This would integrate with notification systems (email, Slack, PagerDuty, etc.)
        // For now, just log that notifications would be sent
        debug!("📧 Sending alert notifications to configured channels");
        Ok(())
    }

    async fn check_service_health(&self, health_url: &str) -> Result<f64> {
        let start_time = std::time::Instant::now();
        
        match self.http_client.get(health_url).send().await {
            Ok(response) => {
                let response_time = start_time.elapsed().as_millis() as f64;
                
                if response.status().is_success() {
                    Ok(response_time)
                } else {
                    Err(anyhow!("Health check failed with status: {}", response.status()))
                }
            }
            Err(e) => {
                Err(anyhow!("Health check request failed: {}", e))
            }
        }
    }

    async fn fetch_service_metrics(&self, metrics_url: &str) -> Result<HashMap<String, f64>> {
        let response = self.http_client.get(metrics_url).send().await?;
        let metrics_text = response.text().await?;

        let mut metrics = HashMap::new();
        
        // Parse Prometheus-style metrics (simplified)
        for line in metrics_text.lines() {
            if line.starts_with("cpu_usage_percent") && !line.starts_with('#') {
                if let Some(value) = self.parse_metric_value(line) {
                    metrics.insert("cpu_usage".to_string(), value);
                }
            } else if line.starts_with("memory_usage_percent") && !line.starts_with('#') {
                if let Some(value) = self.parse_metric_value(line) {
                    metrics.insert("memory_usage".to_string(), value);
                }
            } else if line.starts_with("error_rate_percent") && !line.starts_with('#') {
                if let Some(value) = self.parse_metric_value(line) {
                    metrics.insert("error_rate".to_string(), value);
                }
            }
        }

        Ok(metrics)
    }

    fn parse_metric_value(&self, line: &str) -> Option<f64> {
        line.split_whitespace().last()?.parse().ok()
    }

    async fn get_system_cpu_usage(&self) -> Result<f64> {
        // This would use sysinfo or similar to get actual CPU usage
        // For now, return mock data
        Ok(45.0)
    }

    async fn get_system_memory_usage(&self) -> Result<f64> {
        // This would use sysinfo or similar to get actual memory usage
        // For now, return mock data
        Ok(65.0)
    }

    async fn get_system_disk_usage(&self) -> Result<f64> {
        // This would use sysinfo or similar to get actual disk usage
        // For now, return mock data
        Ok(75.0)
    }

    pub async fn get_active_alerts(&self) -> Result<Vec<ResourceAlert>> {
        let active_alerts = self.active_alerts.read().await;
        Ok(active_alerts.values().cloned().collect())
    }

    pub async fn get_alert_history(&self, hours: u32) -> Result<Vec<ResourceAlert>> {
        let history = self.alert_history.read().await;
        let cutoff_time = chrono::Utc::now() - chrono::Duration::hours(hours as i64);
        
        let filtered: Vec<ResourceAlert> = history
            .iter()
            .filter(|alert| alert.timestamp > cutoff_time)
            .cloned()
            .collect();
        
        Ok(filtered)
    }

    pub async fn clear_alert(&self, alert_key: &str) -> Result<()> {
        let mut active_alerts = self.active_alerts.write().await;
        if active_alerts.remove(alert_key).is_some() {
            info!("✅ Manually cleared alert: {}", alert_key);
        }
        Ok(())
    }
}