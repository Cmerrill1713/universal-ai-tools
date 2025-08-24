//! Configuration management for the LLM Router service

use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub port: u16,
    pub max_concurrent_requests: usize,
    pub default_timeout_seconds: u64,
    pub providers: Vec<ProviderConfig>,
    #[serde(skip, default = "Instant::now")]
    pub start_time: Instant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub name: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub weight: f64,
    pub max_requests_per_second: u32,
    pub timeout_seconds: u64,
    pub models: Vec<String>,
}

impl Config {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        // Load from environment variables with defaults
        let config = Config {
            port: std::env::var("LLM_ROUTER_PORT")
                .unwrap_or_else(|_| "8001".to_string())
                .parse()
                .unwrap_or(8001),
            max_concurrent_requests: std::env::var("MAX_CONCURRENT_REQUESTS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
            default_timeout_seconds: std::env::var("DEFAULT_TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
            providers: Self::load_providers()?,
            start_time: Instant::now(),
        };

        Ok(config)
    }

    fn load_providers() -> Result<Vec<ProviderConfig>, Box<dyn std::error::Error>> {
        // Default providers configuration
        let providers = vec![
            ProviderConfig {
                name: "ollama".to_string(),
                endpoint: std::env::var("OLLAMA_ENDPOINT")
                    .unwrap_or_else(|_| "http://localhost:11434".to_string()),
                api_key: None,
                weight: 1.0,
                max_requests_per_second: 10,
                timeout_seconds: 30,
                models: vec!["llama3.2:3b".to_string(), "qwen2.5:7b".to_string()],
            },
            ProviderConfig {
                name: "openai".to_string(),
                endpoint: "https://api.openai.com/v1".to_string(),
                api_key: std::env::var("OPENAI_API_KEY").ok(),
                weight: 0.5,
                max_requests_per_second: 20,
                timeout_seconds: 30,
                models: vec!["gpt-4".to_string(), "gpt-3.5-turbo".to_string()],
            },
            ProviderConfig {
                name: "anthropic".to_string(),
                endpoint: "https://api.anthropic.com".to_string(),
                api_key: std::env::var("ANTHROPIC_API_KEY").ok(),
                weight: 0.8,
                max_requests_per_second: 15,
                timeout_seconds: 45,
                models: vec!["claude-3-5-sonnet-20241022".to_string()],
            },
        ];

        Ok(providers)
    }
}