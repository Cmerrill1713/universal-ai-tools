//! Enhanced LLM Router Service with Database Integration
//! Includes core API endpoints: chat, agents, feedback

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::time::timeout;

/// Application state with database connection
#[derive(Clone)]
pub struct AppState {
    pub start_time: Instant,
    pub ollama_url: String,
    pub db_pool: PgPool,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    database: String,
}

/// Chat message request
#[derive(Debug, Deserialize)]
struct ChatRequest {
    message: String,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
    conversation_id: Option<String>,
}

/// Chat message response
#[derive(Debug, Serialize)]
struct ChatResponse {
    id: String,
    message: String,
    model: String,
    response_time_ms: u64,
    conversation_id: String,
    provider: String,
}

/// Agent management
#[derive(Debug, Serialize, Deserialize)]
struct Agent {
    id: String,
    name: String,
    description: String,
    model: String,
    temperature: f32,
    system_prompt: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

/// Agent list request
#[derive(Debug, Deserialize)]
struct AgentListQuery {
    limit: Option<i32>,
    offset: Option<i32>,
}

/// Feedback submission
#[derive(Debug, Deserialize)]
struct FeedbackRequest {
    user_id: Option<String>,
    content: String,
    rating: Option<i32>,
    category: Option<String>,
}

/// Ollama completion models (reused from simple version)
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

/// Health check endpoint with database connectivity
async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>, StatusCode> {
    let uptime = state.start_time.elapsed().as_secs();

    // Test database connection
    let db_status = match sqlx::query("SELECT 1").fetch_one(&state.db_pool).await {
        Ok(_) => "connected".to_string(),
        Err(e) => format!("error: {}", e.to_string().chars().take(50).collect::<String>()),
    };

    let response = HealthResponse {
        status: "healthy".to_string(),
        version: "0.2.0".to_string(),
        uptime_seconds: uptime,
        database: db_status,
    };

    Ok(Json(response))
}

/// Chat endpoint - handles conversation with LLM
async fn chat_endpoint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, StatusCode> {
    let start_time = Instant::now();
    
    println!(
        "Chat request - message length: {}, model: {}",
        request.message.len(),
        request.model.as_deref().unwrap_or("default")
    );

    // Generate conversation ID if not provided
    let conversation_id = request.conversation_id
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // Prepare Ollama request
    let ollama_request = OllamaRequest {
        model: request.model.clone().unwrap_or_else(|| "gpt-oss:20b".to_string()),
        prompt: request.message.clone(),
        stream: false,
        options: OllamaOptions {
            temperature: request.temperature.unwrap_or(0.7),
            num_predict: request.max_tokens.unwrap_or(1000),
        },
    };

    // Send request to Ollama
    let client = reqwest::Client::new();
    let url = format!("{}/api/generate", state.ollama_url);

    let ollama_result = timeout(
        Duration::from_secs(30),
        client.post(&url).json(&ollama_request).send()
    ).await;

    let response_text = match ollama_result {
        Ok(Ok(res)) => {
            if res.status().is_success() {
                match res.json::<OllamaResponse>().await {
                    Ok(ollama_resp) => ollama_resp.response,
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

    let response_time = start_time.elapsed().as_millis() as u64;
    let response_id = uuid::Uuid::new_v4().to_string();

    // Store conversation in database
    let _ = sqlx::query(r#"
        INSERT INTO context_storage (id, category, source, content, metadata, user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
    "#)
    .bind(&response_id)
    .bind("conversation")
    .bind("rust-llm-router")
    .bind(&format!("Human: {}\nAssistant: {}", request.message, response_text))
    .bind(serde_json::json!({
        "model": ollama_request.model,
        "temperature": ollama_request.options.temperature,
        "response_time_ms": response_time,
        "conversation_id": conversation_id
    }))
    .bind("system")
    .execute(&state.db_pool)
    .await;

    println!(
        "Chat response completed - response_time: {}ms, stored in DB: {}",
        response_time, response_id
    );

    let response = ChatResponse {
        id: response_id,
        message: response_text,
        model: ollama_request.model,
        response_time_ms: response_time,
        conversation_id,
        provider: "ollama".to_string(),
    };

    Ok(Json(response))
}

/// List agents endpoint
async fn list_agents(
    State(state): State<AppState>,
    Query(params): Query<AgentListQuery>,
) -> Result<Json<Vec<Agent>>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(100);
    let offset = params.offset.unwrap_or(0);

    let agents_result = sqlx::query(r#"
        SELECT id, name, content as description, 
               COALESCE(metadata->>'model', 'gpt-oss:20b') as model,
               COALESCE((metadata->>'temperature')::float, 0.7) as temperature,
               metadata->>'system_prompt' as system_prompt,
               created_at, updated_at
        FROM agent_templates
        WHERE is_active = true
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
    "#)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db_pool)
    .await;

    match agents_result {
        Ok(rows) => {
            let agents: Vec<Agent> = rows.iter().map(|row| {
                Agent {
                    id: row.get("id"),
                    name: row.get("name"),
                    description: row.get("description"),
                    model: row.get("model"),
                    temperature: row.get("temperature"),
                    system_prompt: row.get("system_prompt"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                }
            }).collect();
            
            println!("Retrieved {} agents", agents.len());
            Ok(Json(agents))
        }
        Err(e) => {
            eprintln!("Failed to fetch agents: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Submit feedback endpoint
async fn submit_feedback(
    State(state): State<AppState>,
    Json(request): Json<FeedbackRequest>,
) -> Result<Json<HashMap<String, String>>, StatusCode> {
    let feedback_id = uuid::Uuid::new_v4().to_string();
    let user_id = request.user_id.unwrap_or_else(|| "anonymous".to_string());

    let result = sqlx::query(r#"
        INSERT INTO user_feedback (id, user_id, content, rating, category, metadata)
        VALUES ($1::uuid, $2, $3, $4, $5, $6)
    "#)
    .bind(uuid::Uuid::parse_str(&feedback_id).unwrap())
    .bind(&user_id)
    .bind(&request.content)
    .bind(request.rating)
    .bind(request.category.as_deref().unwrap_or("general"))
    .bind(serde_json::json!({
        "source": "rust-llm-router",
        "submitted_at": chrono::Utc::now()
    }))
    .execute(&state.db_pool)
    .await;

    match result {
        Ok(_) => {
            println!("Feedback submitted: {}", feedback_id);
            let mut response = HashMap::new();
            response.insert("feedback_id".to_string(), feedback_id);
            response.insert("status".to_string(), "success".to_string());
            Ok(Json(response))
        }
        Err(e) => {
            eprintln!("Failed to submit feedback: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// System status endpoint
async fn system_status(State(state): State<AppState>) -> Result<Json<HashMap<String, serde_json::Value>>, StatusCode> {
    let mut status = HashMap::new();
    
    status.insert("service".to_string(), serde_json::json!("rust-llm-router"));
    status.insert("version".to_string(), serde_json::json!("0.2.0"));
    status.insert("uptime_seconds".to_string(), serde_json::json!(state.start_time.elapsed().as_secs()));
    
    // Check Ollama connectivity
    let ollama_status = match reqwest::Client::new()
        .get(&format!("{}/api/tags", state.ollama_url))
        .timeout(Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => "connected",
        _ => "disconnected",
    };
    status.insert("ollama".to_string(), serde_json::json!(ollama_status));
    
    // Check database connectivity
    let db_status = match sqlx::query("SELECT COUNT(*) FROM context_storage LIMIT 1")
        .fetch_one(&state.db_pool)
        .await
    {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };
    status.insert("database".to_string(), serde_json::json!(db_status));
    
    Ok(Json(status))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting Enhanced LLM Router service v0.2.0");

    // Get configuration from environment
    let port = std::env::var("LLM_ROUTER_PORT")
        .unwrap_or_else(|_| "8001".to_string())
        .parse()
        .unwrap_or(8001);
    
    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());
        
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@127.0.0.1:54322/postgres".to_string());

    println!("Configuration:");
    println!("  Port: {}", port);
    println!("  Ollama URL: {}", ollama_url);
    println!("  Database URL: {}", database_url.chars().take(50).collect::<String>() + "...");

    // Connect to database
    println!("Connecting to database...");
    let db_pool = PgPool::connect(&database_url).await?;
    
    // Test database connection
    sqlx::query("SELECT 1").fetch_one(&db_pool).await?;
    println!("Database connection established");

    // Create application state
    let app_state = AppState {
        start_time: Instant::now(),
        ollama_url,
        db_pool,
    };

    // Build the application routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/status", get(system_status))
        .route("/v1/completions", post(chat_endpoint)) // OpenAI API compatibility
        .route("/api/chat", post(chat_endpoint))
        .route("/api/agents/list", get(list_agents))
        .route("/api/v1/feedback/submit", post(submit_feedback))
        .with_state(app_state);

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("Enhanced LLM Router service listening on {}", addr);
    println!("Available endpoints:");
    println!("  GET  /health - Health check");
    println!("  GET  /status - System status");
    println!("  POST /v1/completions - OpenAI-compatible completions");
    println!("  POST /api/chat - Chat endpoint");
    println!("  GET  /api/agents/list - List agents");
    println!("  POST /api/v1/feedback/submit - Submit feedback");

    axum::serve(listener, app).await?;

    Ok(())
}