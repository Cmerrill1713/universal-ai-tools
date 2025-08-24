use serde::{Deserialize, Serialize};
use std::env;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub ai: AIConfig,
    pub migration: MigrationConfig,
    pub risk: RiskConfig,
    pub integration: IntegrationConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub max_connections: u32,
    pub request_timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub connection_timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub model_path: String,
    pub decision_threshold: f64,
    pub confidence_threshold: f64,
    pub max_reasoning_steps: u32,
    pub temperature: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationConfig {
    pub templates_directory: String,
    pub output_directory: String,
    pub max_concurrent_migrations: u32,
    pub default_timeout_minutes: u32,
    pub backup_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskConfig {
    pub max_acceptable_risk_score: f64,
    pub require_manual_approval_above: f64,
    pub automatic_rollback_threshold: f64,
    pub monitoring_window_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationConfig {
    pub tech_scanner_url: String,
    pub go_api_gateway_url: String,
    pub auto_healing_webhook_url: String,
    pub prometheus_url: String,
    pub github_token: Option<String>,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            server: ServerConfig {
                port: env::var("ARCHITECTURE_AI_PORT")
                    .unwrap_or_else(|_| "8085".to_string())
                    .parse()?,
                host: env::var("ARCHITECTURE_AI_HOST")
                    .unwrap_or_else(|_| "0.0.0.0".to_string()),
                max_connections: env::var("ARCHITECTURE_AI_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "1000".to_string())
                    .parse()?,
                request_timeout_seconds: env::var("ARCHITECTURE_AI_REQUEST_TIMEOUT")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()?,
            },
            
            database: DatabaseConfig {
                url: env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgresql://postgres:postgres@127.0.0.1:54322/postgres".to_string()),
                max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "20".to_string())
                    .parse()?,
                connection_timeout_seconds: env::var("DATABASE_CONNECTION_TIMEOUT")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()?,
            },
            
            ai: AIConfig {
                model_path: env::var("AI_MODEL_PATH")
                    .unwrap_or_else(|_| "./models/architecture-decision-model".to_string()),
                decision_threshold: env::var("AI_DECISION_THRESHOLD")
                    .unwrap_or_else(|_| "0.7".to_string())
                    .parse()?,
                confidence_threshold: env::var("AI_CONFIDENCE_THRESHOLD")
                    .unwrap_or_else(|_| "0.8".to_string())
                    .parse()?,
                max_reasoning_steps: env::var("AI_MAX_REASONING_STEPS")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()?,
                temperature: env::var("AI_TEMPERATURE")
                    .unwrap_or_else(|_| "0.3".to_string())
                    .parse()?,
            },
            
            migration: MigrationConfig {
                templates_directory: env::var("MIGRATION_TEMPLATES_DIR")
                    .unwrap_or_else(|_| "./templates".to_string()),
                output_directory: env::var("MIGRATION_OUTPUT_DIR")
                    .unwrap_or_else(|_| "./generated".to_string()),
                max_concurrent_migrations: env::var("MAX_CONCURRENT_MIGRATIONS")
                    .unwrap_or_else(|_| "3".to_string())
                    .parse()?,
                default_timeout_minutes: env::var("MIGRATION_DEFAULT_TIMEOUT")
                    .unwrap_or_else(|_| "60".to_string())
                    .parse()?,
                backup_directory: env::var("MIGRATION_BACKUP_DIR")
                    .unwrap_or_else(|_| "./backups".to_string()),
            },
            
            risk: RiskConfig {
                max_acceptable_risk_score: env::var("MAX_ACCEPTABLE_RISK_SCORE")
                    .unwrap_or_else(|_| "0.6".to_string())
                    .parse()?,
                require_manual_approval_above: env::var("MANUAL_APPROVAL_RISK_THRESHOLD")
                    .unwrap_or_else(|_| "0.8".to_string())
                    .parse()?,
                automatic_rollback_threshold: env::var("AUTO_ROLLBACK_THRESHOLD")
                    .unwrap_or_else(|_| "0.9".to_string())
                    .parse()?,
                monitoring_window_minutes: env::var("RISK_MONITORING_WINDOW")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()?,
            },
            
            integration: IntegrationConfig {
                tech_scanner_url: env::var("TECH_SCANNER_URL")
                    .unwrap_or_else(|_| "http://127.0.0.1:8084".to_string()),
                go_api_gateway_url: env::var("GO_API_GATEWAY_URL")
                    .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string()),
                auto_healing_webhook_url: env::var("AUTO_HEALING_WEBHOOK_URL")
                    .unwrap_or_else(|_| "http://127.0.0.1:8080/api/evolution/alert".to_string()),
                prometheus_url: env::var("PROMETHEUS_URL")
                    .unwrap_or_else(|_| "http://127.0.0.1:9090".to_string()),
                github_token: env::var("GITHUB_TOKEN").ok(),
            },
        })
    }
    
    pub fn validate(&self) -> Result<()> {
        // Validate configuration values
        if self.ai.decision_threshold < 0.0 || self.ai.decision_threshold > 1.0 {
            anyhow::bail!("AI decision threshold must be between 0.0 and 1.0");
        }
        
        if self.ai.confidence_threshold < 0.0 || self.ai.confidence_threshold > 1.0 {
            anyhow::bail!("AI confidence threshold must be between 0.0 and 1.0");
        }
        
        if self.risk.max_acceptable_risk_score < 0.0 || self.risk.max_acceptable_risk_score > 1.0 {
            anyhow::bail!("Max acceptable risk score must be between 0.0 and 1.0");
        }
        
        if self.migration.max_concurrent_migrations == 0 {
            anyhow::bail!("Max concurrent migrations must be at least 1");
        }
        
        Ok(())
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            server: ServerConfig {
                port: 8085,
                host: "0.0.0.0".to_string(),
                max_connections: 1000,
                request_timeout_seconds: 300,
            },
            database: DatabaseConfig {
                url: "postgresql://postgres:postgres@127.0.0.1:54322/postgres".to_string(),
                max_connections: 20,
                connection_timeout_seconds: 30,
            },
            ai: AIConfig {
                model_path: "./models/architecture-decision-model".to_string(),
                decision_threshold: 0.7,
                confidence_threshold: 0.8,
                max_reasoning_steps: 10,
                temperature: 0.3,
            },
            migration: MigrationConfig {
                templates_directory: "./templates".to_string(),
                output_directory: "./generated".to_string(),
                max_concurrent_migrations: 3,
                default_timeout_minutes: 60,
                backup_directory: "./backups".to_string(),
            },
            risk: RiskConfig {
                max_acceptable_risk_score: 0.6,
                require_manual_approval_above: 0.8,
                automatic_rollback_threshold: 0.9,
                monitoring_window_minutes: 30,
            },
            integration: IntegrationConfig {
                tech_scanner_url: "http://127.0.0.1:8084".to_string(),
                go_api_gateway_url: "http://127.0.0.1:8080".to_string(),
                auto_healing_webhook_url: "http://127.0.0.1:8080/api/evolution/alert".to_string(),
                prometheus_url: "http://127.0.0.1:9090".to_string(),
                github_token: None,
            },
        }
    }
}