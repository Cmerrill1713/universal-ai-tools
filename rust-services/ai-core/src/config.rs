//! Configuration for AI Core Service

use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
pub struct Config {
    pub port: u16,
    pub environment: String,
    pub ai: AIConfig,
    pub providers: ProvidersConfig,
    pub models: ModelsConfig,
    pub memory: MemoryConfig,
    #[serde(skip)]
    pub start_time: Instant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub max_context_length: u32,
    pub default_temperature: f32,
    pub max_tokens_per_request: u32,
    pub enable_streaming: bool,
    pub enable_caching: bool,
    pub cache_ttl_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvidersConfig {
    pub openai: Option<ProviderConfig>,
    pub anthropic: Option<ProviderConfig>,
    pub ollama: Option<ProviderConfig>,
    pub local: Option<ProviderConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub enabled: bool,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub timeout_seconds: u64,
    pub max_retries: u32,
    pub priority: u8, // 0-255, higher is better
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsConfig {
    pub auto_load: bool,
    pub max_loaded_models: usize,
    pub model_cache_size_mb: u64,
    pub offload_unused_after_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub max_memory_mb: u64,
    pub optimize_threshold_mb: u64,
    pub auto_optimize: bool,
    pub gc_interval_seconds: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: 8003,
            environment: "development".to_string(),
            ai: AIConfig::default(),
            providers: ProvidersConfig::default(),
            models: ModelsConfig::default(),
            memory: MemoryConfig::default(),
            start_time: Instant::now(),
        }
    }
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            max_context_length: 128000,
            default_temperature: 0.7,
            max_tokens_per_request: 4000,
            enable_streaming: true,
            enable_caching: true,
            cache_ttl_seconds: 3600, // 1 hour
        }
    }
}

impl Default for ProvidersConfig {
    fn default() -> Self {
        Self {
            openai: Some(ProviderConfig {
                enabled: true,
                api_key: None,
                base_url: Some("https://api.openai.com/v1".to_string()),
                timeout_seconds: 30,
                max_retries: 3,
                priority: 100,
            }),
            anthropic: Some(ProviderConfig {
                enabled: true,
                api_key: None,
                base_url: Some("https://api.anthropic.com".to_string()),
                timeout_seconds: 30,
                max_retries: 3,
                priority: 90,
            }),
            ollama: Some(ProviderConfig {
                enabled: true,
                api_key: None,
                base_url: Some("http://localhost:11434".to_string()),
                timeout_seconds: 60,
                max_retries: 2,
                priority: 80,
            }),
            local: Some(ProviderConfig {
                enabled: false,
                api_key: None,
                base_url: None,
                timeout_seconds: 120,
                max_retries: 1,
                priority: 70,
            }),
        }
    }
}

impl Default for ModelsConfig {
    fn default() -> Self {
        Self {
            auto_load: true,
            max_loaded_models: 5,
            model_cache_size_mb: 2048, // 2GB
            offload_unused_after_seconds: 1800, // 30 minutes
        }
    }
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            max_memory_mb: 4096, // 4GB
            optimize_threshold_mb: 3072, // 3GB
            auto_optimize: true,
            gc_interval_seconds: 300, // 5 minutes
        }
    }
}

impl Config {
    /// Load configuration from environment variables
    pub fn load() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let mut config = Config::default();

        // Override with environment variables
        if let Ok(port) = std::env::var("AI_CORE_PORT") {
            config.port = port.parse()?;
        }

        if let Ok(env) = std::env::var("NODE_ENV") {
            config.environment = env;
        }

        // AI configuration
        if let Ok(max_context) = std::env::var("AI_MAX_CONTEXT_LENGTH") {
            config.ai.max_context_length = max_context.parse()?;
        }

        if let Ok(temp) = std::env::var("AI_DEFAULT_TEMPERATURE") {
            config.ai.default_temperature = temp.parse()?;
        }

        // Provider configurations
        if let Ok(openai_key) = std::env::var("OPENAI_API_KEY") {
            if let Some(ref mut openai) = config.providers.openai {
                openai.api_key = Some(openai_key);
            }
        }

        if let Ok(anthropic_key) = std::env::var("ANTHROPIC_API_KEY") {
            if let Some(ref mut anthropic) = config.providers.anthropic {
                anthropic.api_key = Some(anthropic_key);
            }
        }

        if let Ok(ollama_url) = std::env::var("OLLAMA_URL") {
            if let Some(ref mut ollama) = config.providers.ollama {
                ollama.base_url = Some(ollama_url);
            }
        }

        // Memory configuration
        if let Ok(max_mem) = std::env::var("AI_MAX_MEMORY_MB") {
            config.memory.max_memory_mb = max_mem.parse()?;
        }

        if let Ok(threshold) = std::env::var("AI_OPTIMIZE_THRESHOLD_MB") {
            config.memory.optimize_threshold_mb = threshold.parse()?;
        }

        Ok(config)
    }
}