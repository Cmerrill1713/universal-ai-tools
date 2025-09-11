use serde::{Deserialize, Serialize};
use std::env;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub searcher: SearcherSettings,
    pub generator: GeneratorSettings,
    pub training: TrainingSettings,
    pub retriever: RetrieverSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub pool_size: u32,
    pub ttl_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearcherSettings {
    pub model_name: String,
    pub model_url: Option<String>,
    pub max_turns: usize,
    pub docs_per_turn: usize,
    pub temperature: f32,
    pub top_p: f32,
    pub stop_threshold: f32,
    pub cache_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratorSettings {
    pub models: Vec<GeneratorModel>,
    pub default_model: String,
    pub temperature: f32,
    pub max_tokens: usize,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratorModel {
    pub name: String,
    pub endpoint: String,
    pub api_key_env: Option<String>,
    pub max_context: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingSettings {
    pub dataset_size: usize,
    pub batch_size: usize,
    pub learning_rate: f32,
    pub ppo_epochs: usize,
    pub ppo_clip: f32,
    pub gamma: f32,
    pub checkpoint_dir: String,
    pub save_every: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrieverSettings {
    pub embedding_model: String,
    pub embedding_dim: usize,
    pub top_k: usize,
    pub similarity_threshold: f32,
    pub weaviate_url: Option<String>,
    pub use_postgres_vectors: bool,
}

impl Config {
    /// Load configuration from environment variables and config file
    pub fn load() -> Result<Self> {
        dotenv::dotenv().ok();
        
        Ok(Config {
            server: ServerConfig {
                host: env::var("S3_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: env::var("S3_PORT")
                    .unwrap_or_else(|_| "8091".to_string())
                    .parse()?,
                workers: env::var("S3_WORKERS")
                    .unwrap_or_else(|_| "4".to_string())
                    .parse()?,
            },
            database: DatabaseConfig {
                url: env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgresql://localhost/universal_ai_tools".to_string()),
                max_connections: 10,
                min_connections: 2,
            },
            redis: RedisConfig {
                url: env::var("REDIS_URL")
                    .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
                pool_size: 10,
                ttl_seconds: 3600,
            },
            searcher: SearcherSettings {
                model_name: env::var("S3_SEARCHER_MODEL")
                    .unwrap_or_else(|_| "llama-3.2:7b".to_string()),
                model_url: env::var("S3_SEARCHER_URL").ok(),
                max_turns: 4,
                docs_per_turn: 3,
                temperature: 0.7,
                top_p: 0.9,
                stop_threshold: 0.8,
                cache_enabled: true,
            },
            generator: GeneratorSettings {
                models: Self::load_generator_models(),
                default_model: env::var("S3_DEFAULT_GENERATOR")
                    .unwrap_or_else(|_| "ollama".to_string()),
                temperature: 0.3,
                max_tokens: 1024,
                timeout_ms: 30000,
            },
            training: TrainingSettings {
                dataset_size: 2400,
                batch_size: 32,
                learning_rate: 1e-5,
                ppo_epochs: 15,
                ppo_clip: 0.2,
                gamma: 0.99,
                checkpoint_dir: env::var("S3_CHECKPOINT_DIR")
                    .unwrap_or_else(|_| "./checkpoints".to_string()),
                save_every: 100,
            },
            retriever: RetrieverSettings {
                embedding_model: env::var("S3_EMBEDDING_MODEL")
                    .unwrap_or_else(|_| "e5-base-v2".to_string()),
                embedding_dim: 768,
                top_k: 10,
                similarity_threshold: 0.7,
                weaviate_url: env::var("WEAVIATE_URL").ok(),
                use_postgres_vectors: true,
            },
        })
    }
    
    fn load_generator_models() -> Vec<GeneratorModel> {
        let mut models = vec![];
        
        // Ollama models
        if let Ok(ollama_url) = env::var("OLLAMA_URL") {
            models.push(GeneratorModel {
                name: "ollama".to_string(),
                endpoint: ollama_url,
                api_key_env: None,
                max_context: 32768,
            });
        }
        
        // OpenAI
        if env::var("OPENAI_API_KEY").is_ok() {
            models.push(GeneratorModel {
                name: "gpt-4".to_string(),
                endpoint: "https://api.openai.com/v1".to_string(),
                api_key_env: Some("OPENAI_API_KEY".to_string()),
                max_context: 128000,
            });
        }
        
        // Anthropic
        if env::var("ANTHROPIC_API_KEY").is_ok() {
            models.push(GeneratorModel {
                name: "claude-3-haiku".to_string(),
                endpoint: "https://api.anthropic.com/v1".to_string(),
                api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
                max_context: 200000,
            });
        }
        
        // Default to local Ollama if nothing configured
        if models.is_empty() {
            models.push(GeneratorModel {
                name: "ollama".to_string(),
                endpoint: "http://localhost:11434".to_string(),
                api_key_env: None,
                max_context: 32768,
            });
        }
        
        models
    }
}