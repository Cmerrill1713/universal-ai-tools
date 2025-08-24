use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::env;

/// Configuration for the Proactive Engine service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProactiveConfig {
    pub server: ServerConfig,
    pub database_url: String,
    pub monitoring: MonitoringConfig,
    pub suggestions: SuggestionConfig,
    pub integrations: IntegrationConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub max_connections: u32,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub system_scan_interval_seconds: u64,
    pub context_update_interval_seconds: u64,
    pub cleanup_interval_seconds: u64,
    pub cpu_activity_threshold: f32,
    pub memory_warning_threshold: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionConfig {
    pub generation_interval_seconds: u64,
    pub max_active_suggestions: usize,
    pub min_confidence_threshold: f32,
    pub suggestion_expiry_hours: i64,
    pub ai_service_url: String,
    pub ai_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationConfig {
    pub api_gateway_url: String,
    pub memory_service_url: String,
    pub tts_service_url: String,
    pub calendar_integration: bool,
    pub task_tracking_integration: bool,
}

impl Default for ProactiveConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                port: 8085,
                host: "0.0.0.0".to_string(),
                max_connections: 1000,
                timeout_seconds: 30,
            },
            database_url: "postgresql://localhost:5432/universal_ai_tools".to_string(),
            monitoring: MonitoringConfig {
                system_scan_interval_seconds: 30,
                context_update_interval_seconds: 30,
                cleanup_interval_seconds: 300,
                cpu_activity_threshold: 10.0,
                memory_warning_threshold: 80.0,
            },
            suggestions: SuggestionConfig {
                generation_interval_seconds: 120,
                max_active_suggestions: 10,
                min_confidence_threshold: 0.6,
                suggestion_expiry_hours: 24,
                ai_service_url: "http://localhost:8080/api/chat".to_string(),
                ai_model: "claude-3-sonnet".to_string(),
            },
            integrations: IntegrationConfig {
                api_gateway_url: "http://localhost:8080".to_string(),
                memory_service_url: "http://localhost:8087".to_string(),
                tts_service_url: "http://localhost:8086".to_string(),
                calendar_integration: false,
                task_tracking_integration: false,
            },
        }
    }
}

impl ProactiveConfig {
    /// Load configuration from environment variables and defaults
    pub fn load() -> Result<Self> {
        let mut config = Self::default();

        // Override with environment variables if present
        if let Ok(port) = env::var("PROACTIVE_ENGINE_PORT") {
            config.server.port = port.parse()
                .context("Invalid PROACTIVE_ENGINE_PORT")?;
        }

        if let Ok(host) = env::var("PROACTIVE_ENGINE_HOST") {
            config.server.host = host;
        }

        if let Ok(db_url) = env::var("DATABASE_URL") {
            config.database_url = db_url;
        }

        if let Ok(supabase_url) = env::var("SUPABASE_URL") {
            config.database_url = supabase_url;
        }

        if let Ok(gateway_url) = env::var("API_GATEWAY_URL") {
            config.integrations.api_gateway_url = gateway_url;
        }

        if let Ok(memory_url) = env::var("MEMORY_SERVICE_URL") {
            config.integrations.memory_service_url = memory_url;
        }

        if let Ok(tts_url) = env::var("TTS_SERVICE_URL") {
            config.integrations.tts_service_url = tts_url;
        }

        if let Ok(ai_url) = env::var("AI_SERVICE_URL") {
            config.suggestions.ai_service_url = ai_url;
        }

        if let Ok(ai_model) = env::var("AI_MODEL") {
            config.suggestions.ai_model = ai_model;
        }

        // Parse numeric environment variables
        if let Ok(scan_interval) = env::var("SYSTEM_SCAN_INTERVAL") {
            config.monitoring.system_scan_interval_seconds = scan_interval.parse()
                .context("Invalid SYSTEM_SCAN_INTERVAL")?;
        }

        if let Ok(generation_interval) = env::var("SUGGESTION_GENERATION_INTERVAL") {
            config.suggestions.generation_interval_seconds = generation_interval.parse()
                .context("Invalid SUGGESTION_GENERATION_INTERVAL")?;
        }

        if let Ok(threshold) = env::var("MIN_CONFIDENCE_THRESHOLD") {
            config.suggestions.min_confidence_threshold = threshold.parse()
                .context("Invalid MIN_CONFIDENCE_THRESHOLD")?;
        }

        if let Ok(cpu_threshold) = env::var("CPU_ACTIVITY_THRESHOLD") {
            config.monitoring.cpu_activity_threshold = cpu_threshold.parse()
                .context("Invalid CPU_ACTIVITY_THRESHOLD")?;
        }

        if let Ok(memory_threshold) = env::var("MEMORY_WARNING_THRESHOLD") {
            config.monitoring.memory_warning_threshold = memory_threshold.parse()
                .context("Invalid MEMORY_WARNING_THRESHOLD")?;
        }

        // Boolean flags
        if let Ok(calendar_flag) = env::var("ENABLE_CALENDAR_INTEGRATION") {
            config.integrations.calendar_integration = calendar_flag.to_lowercase() == "true";
        }

        if let Ok(task_flag) = env::var("ENABLE_TASK_TRACKING") {
            config.integrations.task_tracking_integration = task_flag.to_lowercase() == "true";
        }

        Ok(config)
    }

    /// Validate configuration values
    pub fn validate(&self) -> Result<()> {
        if self.server.port == 0 {
            anyhow::bail!("Server port cannot be 0");
        }

        if self.server.max_connections == 0 {
            anyhow::bail!("Max connections must be greater than 0");
        }

        if self.monitoring.system_scan_interval_seconds < 5 {
            anyhow::bail!("System scan interval must be at least 5 seconds");
        }

        if self.suggestions.min_confidence_threshold < 0.0 || self.suggestions.min_confidence_threshold > 1.0 {
            anyhow::bail!("Confidence threshold must be between 0.0 and 1.0");
        }

        if self.monitoring.cpu_activity_threshold < 0.0 || self.monitoring.cpu_activity_threshold > 100.0 {
            anyhow::bail!("CPU activity threshold must be between 0.0 and 100.0");
        }

        if self.monitoring.memory_warning_threshold < 0.0 || self.monitoring.memory_warning_threshold > 100.0 {
            anyhow::bail!("Memory warning threshold must be between 0.0 and 100.0");
        }

        Ok(())
    }

    /// Get service health check configuration
    pub fn health_check_config(&self) -> HealthCheckConfig {
        HealthCheckConfig {
            timeout_seconds: self.server.timeout_seconds,
            database_url: self.database_url.clone(),
            external_services: vec![
                self.integrations.api_gateway_url.clone(),
                self.integrations.memory_service_url.clone(),
                self.integrations.tts_service_url.clone(),
            ],
        }
    }
}

/// Health check configuration
#[derive(Debug, Clone)]
pub struct HealthCheckConfig {
    pub timeout_seconds: u64,
    pub database_url: String,
    pub external_services: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = ProactiveConfig::default();
        assert_eq!(config.server.port, 8085);
        assert_eq!(config.server.host, "0.0.0.0");
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_config_validation() {
        let mut config = ProactiveConfig::default();
        
        // Test invalid port
        config.server.port = 0;
        assert!(config.validate().is_err());
        
        // Test invalid confidence threshold
        config = ProactiveConfig::default();
        config.suggestions.min_confidence_threshold = 1.5;
        assert!(config.validate().is_err());
        
        // Test invalid CPU threshold
        config = ProactiveConfig::default();
        config.monitoring.cpu_activity_threshold = 150.0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_health_check_config() {
        let config = ProactiveConfig::default();
        let health_config = config.health_check_config();
        
        assert_eq!(health_config.timeout_seconds, 30);
        assert_eq!(health_config.external_services.len(), 3);
        assert!(health_config.external_services.contains(&"http://localhost:8080".to_string()));
    }
}