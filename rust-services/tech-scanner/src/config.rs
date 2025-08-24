use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub github: GitHubConfig,
    pub database: DatabaseConfig,
    pub scanner: ScannerConfig,
    pub notifications: NotificationConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub address: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubConfig {
    pub token: Option<String>,
    pub api_url: String,
    pub rate_limit_per_hour: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerConfig {
    pub scan_interval_hours: u64,
    pub technologies: Vec<String>,
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub dependency_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    pub webhook_url: Option<String>,
    pub auto_healing_endpoint: String,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let config = Config {
            server: ServerConfig {
                address: env::var("TECH_SCANNER_ADDRESS")
                    .unwrap_or_else(|_| "127.0.0.1:8084".to_string()),
                port: env::var("TECH_SCANNER_PORT")
                    .unwrap_or_else(|_| "8084".to_string())
                    .parse()
                    .unwrap_or(8084),
            },
            github: GitHubConfig {
                token: env::var("GITHUB_TOKEN").ok(),
                api_url: "https://api.github.com".to_string(),
                rate_limit_per_hour: 5000,
            },
            database: DatabaseConfig {
                url: env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgresql://postgres:postgres@127.0.0.1:54322/postgres".to_string()),
            },
            scanner: ScannerConfig {
                scan_interval_hours: env::var("SCAN_INTERVAL_HOURS")
                    .unwrap_or_else(|_| "6".to_string())
                    .parse()
                    .unwrap_or(6),
                technologies: vec![
                    "Swift".to_string(),
                    "Rust".to_string(),
                    "Go".to_string(),
                    "TypeScript".to_string(),
                    "React Native".to_string(),
                    "Flutter".to_string(),
                    "SwiftUI".to_string(),
                    "Tauri".to_string(),
                    "Wasm".to_string(),
                ],
                languages: vec![
                    "swift".to_string(),
                    "rust".to_string(),
                    "go".to_string(),
                    "typescript".to_string(),
                ],
                frameworks: vec![
                    "swiftui".to_string(),
                    "react-native".to_string(),
                    "flutter".to_string(),
                    "tauri".to_string(),
                    "axum".to_string(),
                    "tokio".to_string(),
                    "gin".to_string(),
                ],
                dependency_files: vec![
                    "Cargo.toml".to_string(),
                    "go.mod".to_string(),
                    "package.json".to_string(),
                    "Podfile".to_string(),
                    "Package.swift".to_string(),
                    "pubspec.yaml".to_string(),
                ],
            },
            notifications: NotificationConfig {
                webhook_url: env::var("WEBHOOK_URL").ok(),
                auto_healing_endpoint: env::var("AUTO_HEALING_ENDPOINT")
                    .unwrap_or_else(|_| "http://127.0.0.1:8082/api/v1/evolution/alert".to_string()),
            },
        };

        Ok(config)
    }
}