//! Simplified LLM Router Service for initial deployment
//! Focuses on core functionality without complex tracing

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::time::timeout;

/// Application state
#[derive(Clone)]
pub struct AppState {
    pub start_time: Instant,
    pub ollama_url: String,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
}

/// LLM completion request
#[derive(Debug, Deserialize)]
struct CompletionRequest {
    model: Option<String>,
    prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    stream: Option<bool>,
}

/// LLM completion response
#[derive(Debug, Serialize)]
struct CompletionResponse {
    id: String,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
    provider: String,
    response_time_ms: u64,
}

#[derive(Debug, Serialize)]
struct Choice {
    text: String,
    index: u32,
    finish_reason: String,
}

#[derive(Debug, Serialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

/// Ollama request format
#[derive(Debug, Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    temperature: f32,
    num_predict: u32,
}

/// Ollama response format
#[derive(Debug, Deserialize)]
struct OllamaResponse {
    model: String,
    response: String,
    done: bool,
    context: Option<Vec<i32>>,
    total_duration: Option<u64>,
    prompt_eval_count: Option<u32>,
    eval_count: Option<u32>,
}

/// Health check endpoint
async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>, StatusCode> {
    let uptime = state.start_time.elapsed().as_secs();

    let response = HealthResponse {
        status: "healthy".to_string(),
        version: "0.1.0".to_string(),
        uptime_seconds: uptime,
    };

    Ok(Json(response))
}

/// LLM completion endpoint
async fn llm_completion(
    State(state): State<AppState>,
    Json(request): Json<CompletionRequest>,
) -> Result<Json<CompletionResponse>, StatusCode> {
    let start_time = Instant::now();
    
    println!(
        "Processing LLM completion request - model: {}, prompt length: {}",
        request.model.as_deref().unwrap_or("default"),
        request.prompt.len()
    );

    // Prepare Ollama request
    let ollama_request = OllamaRequest {
        model: request.model.clone().unwrap_or_else(|| "llama3.2:3b".to_string()),
        prompt: request.prompt.clone(),
        stream: false,
        options: OllamaOptions {
            temperature: request.temperature.unwrap_or(0.7),
            num_predict: request.max_tokens.unwrap_or(1000),
        },
    };

    // Create HTTP client
    let client = reqwest::Client::new();
    let url = format!("{}/api/generate", state.ollama_url);

    // Send request to Ollama with timeout
    let ollama_result = timeout(
        Duration::from_secs(30),
        client.post(&url).json(&ollama_request).send()
    ).await;

    let response = match ollama_result {
        Ok(Ok(res)) => {
            if res.status().is_success() {
                match res.json::<OllamaResponse>().await {
                    Ok(ollama_resp) => {
                        let response_time = start_time.elapsed().as_millis() as u64;
                        
                        println!(
                            "LLM completion successful - provider: Ollama, response_time: {}ms",
                            response_time
                        );

                        CompletionResponse {
                            id: uuid::Uuid::new_v4().to_string(),
                            model: ollama_resp.model,
                            choices: vec![Choice {
                                text: ollama_resp.response,
                                index: 0,
                                finish_reason: "stop".to_string(),
                            }],
                            usage: Usage {
                                prompt_tokens: ollama_resp.prompt_eval_count.unwrap_or(0),
                                completion_tokens: ollama_resp.eval_count.unwrap_or(0),
                                total_tokens: ollama_resp.prompt_eval_count.unwrap_or(0) + ollama_resp.eval_count.unwrap_or(0),
                            },
                            provider: "ollama".to_string(),
                            response_time_ms: response_time,
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to parse Ollama response: {}", e);
                        return Err(StatusCode::INTERNAL_SERVER_ERROR);
                    }
                }
            } else {
                eprintln!("Ollama returned error status: {}", res.status());
                return Err(StatusCode::BAD_GATEWAY);
            }
        }
        Ok(Err(e)) => {
            eprintln!("Request to Ollama failed: {}", e);
            return Err(StatusCode::BAD_GATEWAY);
        }
        Err(_) => {
            eprintln!("Request to Ollama timed out");
            return Err(StatusCode::REQUEST_TIMEOUT);
        }
    };

    Ok(Json(response))
}

/// Metrics endpoint (simplified)
async fn metrics_endpoint() -> Result<String, StatusCode> {
    Ok("# Simplified metrics\nllm_router_up 1\n".to_string())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting Simplified LLM Router service v0.1.0");

    // Get configuration from environment
    let port = std::env::var("LLM_ROUTER_PORT")
        .unwrap_or_else(|_| "8001".to_string())
        .parse()
        .unwrap_or(8001);
    
    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

    println!("Configuration:");
    println!("  Port: {}", port);
    println!("  Ollama URL: {}", ollama_url);

    // Create application state
    let app_state = AppState {
        start_time: Instant::now(),
        ollama_url,
    };

    // Build the application routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_endpoint))
        .route("/v1/completions", post(llm_completion))
        .with_state(app_state);

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("LLM Router service listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}