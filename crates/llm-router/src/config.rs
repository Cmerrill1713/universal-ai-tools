use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterConfig {
    pub providers: HashMap<String, ProviderConfig>,
    pub models: Vec<ModelConfig>,
    pub cache: CacheConfig,
    pub health: HealthConfig,
    pub routing: RoutingConfig,
    pub context: ContextConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub enabled: bool,
    pub base_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    pub timeout_ms: u64,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rate_limit: Option<RateLimitConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub internal_name: String,
    pub provider: String,
    pub external_model: String,
    pub capabilities: Vec<String>,
    pub max_tokens: u32,
    pub temperature: f32,
    pub tier: u8,
    pub priority: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_per_token: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub enabled: bool,
    pub max_entries: usize,
    pub ttl_seconds: u64,
    pub max_memory_mb: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthConfig {
    pub check_interval_seconds: u64,
    pub timeout_ms: u64,
    pub unhealthy_threshold: u32,
    pub healthy_threshold: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingConfig {
    pub strategy: RoutingStrategy,
    pub fallback_enabled: bool,
    pub retry_on_failure: bool,
    pub load_balancing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextConfig {
    pub enabled: bool,
    pub max_context_tokens: u32,
    pub context_types: Vec<String>,
    pub relevance_threshold: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub tokens_per_minute: u32,
    pub burst_size: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoutingStrategy {
    RoundRobin,
    LeastLatency,
    WeightedRandom,
    HealthScore,
    CostOptimized,
    QualityFirst,
}

impl Default for RouterConfig {
    fn default() -> Self {
        let mut providers = HashMap::new();
        
        // Ollama configuration
        providers.insert(
            "ollama".to_string(),
            ProviderConfig {
                enabled: true,
                base_url: "http://localhost:11434".to_string(),
                api_key: None,
                timeout_ms: 30000,
                max_retries: 3,
                retry_delay_ms: 1000,
                rate_limit: None,
                custom_headers: None,
            },
        );
        
        // LM Studio configuration
        providers.insert(
            "lm_studio".to_string(),
            ProviderConfig {
                enabled: true,
                base_url: "http://localhost:5901".to_string(),
                api_key: None,
                timeout_ms: 45000,
                max_retries: 2,
                retry_delay_ms: 1500,
                rate_limit: None,
                custom_headers: None,
            },
        );
        
        // OpenAI configuration
        providers.insert(
            "openai".to_string(),
            ProviderConfig {
                enabled: false,
                base_url: "https://api.openai.com/v1".to_string(),
                api_key: None,
                timeout_ms: 60000,
                max_retries: 3,
                retry_delay_ms: 2000,
                rate_limit: Some(RateLimitConfig {
                    requests_per_minute: 60,
                    tokens_per_minute: 90000,
                    burst_size: 10,
                }),
                custom_headers: None,
            },
        );
        
        // Anthropic configuration
        providers.insert(
            "anthropic".to_string(),
            ProviderConfig {
                enabled: false,
                base_url: "https://api.anthropic.com/v1".to_string(),
                api_key: None,
                timeout_ms: 60000,
                max_retries: 3,
                retry_delay_ms: 2000,
                rate_limit: Some(RateLimitConfig {
                    requests_per_minute: 50,
                    tokens_per_minute: 100000,
                    burst_size: 5,
                }),
                custom_headers: None,
            },
        );
        
        Self {
            providers,
            models: Self::default_model_configs(),
            cache: CacheConfig {
                enabled: true,
                max_entries: 1000,
                ttl_seconds: 300,
                max_memory_mb: 512,
            },
            health: HealthConfig {
                check_interval_seconds: 120,
                timeout_ms: 5000,
                unhealthy_threshold: 3,
                healthy_threshold: 2,
            },
            routing: RoutingConfig {
                strategy: RoutingStrategy::HealthScore,
                fallback_enabled: true,
                retry_on_failure: true,
                load_balancing: true,
            },
            context: ContextConfig {
                enabled: true,
                max_context_tokens: 3000,
                context_types: vec![
                    "project_overview".to_string(),
                    "code_patterns".to_string(),
                ],
                relevance_threshold: 0.7,
            },
        }
    }
}

impl RouterConfig {
    fn default_model_configs() -> Vec<ModelConfig> {
        vec![
            ModelConfig {
                internal_name: "expert-reasoning".to_string(),
                provider: "dynamic".to_string(),
                external_model: "auto-select".to_string(),
                capabilities: vec![
                    "deep_reasoning".to_string(),
                    "complex_analysis".to_string(),
                    "multi_step_logic".to_string(),
                ],
                max_tokens: 8000,
                temperature: 0.3,
                tier: 4,
                priority: 1,
                context_window: Some(32000),
                cost_per_token: None,
            },
            ModelConfig {
                internal_name: "planner-pro".to_string(),
                provider: "dynamic".to_string(),
                external_model: "auto-select".to_string(),
                capabilities: vec![
                    "planning".to_string(),
                    "task_decomposition".to_string(),
                    "strategy".to_string(),
                ],
                max_tokens: 4000,
                temperature: 0.3,
                tier: 3,
                priority: 1,
                context_window: Some(16000),
                cost_per_token: None,
            },
            ModelConfig {
                internal_name: "code-expert".to_string(),
                provider: "dynamic".to_string(),
                external_model: "auto-select".to_string(),
                capabilities: vec![
                    "code_generation".to_string(),
                    "debugging".to_string(),
                    "refactoring".to_string(),
                ],
                max_tokens: 6000,
                temperature: 0.2,
                tier: 3,
                priority: 1,
                context_window: Some(16000),
                cost_per_token: None,
            },
            ModelConfig {
                internal_name: "assistant".to_string(),
                provider: "dynamic".to_string(),
                external_model: "auto-select".to_string(),
                capabilities: vec![
                    "conversation".to_string(),
                    "task_management".to_string(),
                    "general_help".to_string(),
                ],
                max_tokens: 3000,
                temperature: 0.7,
                tier: 2,
                priority: 1,
                context_window: Some(8000),
                cost_per_token: None,
            },
            ModelConfig {
                internal_name: "fast-response".to_string(),
                provider: "dynamic".to_string(),
                external_model: "auto-select".to_string(),
                capabilities: vec![
                    "quick_response".to_string(),
                    "simple_analysis".to_string(),
                    "basic_qa".to_string(),
                ],
                max_tokens: 1500,
                temperature: 0.5,
                tier: 1,
                priority: 1,
                context_window: Some(4000),
                cost_per_token: None,
            },
        ]
    }
    
    pub fn from_env() -> Self {
        let mut config = Self::default();
        
        // Override with environment variables
        if let Ok(ollama_url) = std::env::var("OLLAMA_URL") {
            if let Some(ollama) = config.providers.get_mut("ollama") {
                ollama.base_url = ollama_url;
            }
        }
        
        if let Ok(lm_studio_url) = std::env::var("LM_STUDIO_URL") {
            if let Some(lm_studio) = config.providers.get_mut("lm_studio") {
                lm_studio.base_url = lm_studio_url;
            }
        }
        
        if let Ok(openai_key) = std::env::var("OPENAI_API_KEY") {
            if let Some(openai) = config.providers.get_mut("openai") {
                openai.api_key = Some(openai_key);
                openai.enabled = true;
            }
        }
        
        if let Ok(anthropic_key) = std::env::var("ANTHROPIC_API_KEY") {
            if let Some(anthropic) = config.providers.get_mut("anthropic") {
                anthropic.api_key = Some(anthropic_key);
                anthropic.enabled = true;
            }
        }
        
        config
    }
}