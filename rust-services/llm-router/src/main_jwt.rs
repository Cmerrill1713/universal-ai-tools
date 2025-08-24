//! Enhanced LLM Router Service with JWT Authentication
//! Includes JWT middleware for secure API access

use axum::{
    extract::{State, Request},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{Json, Response},
    routing::{get, post},
    Router,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::{
    net::SocketAddr,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::time::timeout;

/// Application state with database connection and JWT secret
#[derive(Clone)]
pub struct AppState {
    pub start_time: Instant,
    pub ollama_url: String,
    pub db_pool: PgPool,
    pub jwt_secret: String,
}

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,  // subject (user id)
    exp: usize,   // expiration time
    iat: usize,   // issued at
    role: String, // user role
}

/// User context extracted from JWT
#[derive(Debug, Clone)]
pub struct UserContext {
    pub user_id: String,
    pub role: String,
}

/// Authentication request
#[derive(Debug, Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

/// Authentication response
#[derive(Debug, Serialize)]
struct LoginResponse {
    token: String,
    expires_in: u64,
    user_id: String,
    role: String,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    database: String,
    auth_enabled: bool,
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
    user_id: Option<String>,
}

/// Agent information
#[derive(Debug, Serialize)]
struct Agent {
    id: String,
    name: String,
    description: String,
    category: String,
    status: String,
}

/// Feedback request
#[derive(Debug, Deserialize)]
struct FeedbackRequest {
    message: String,
    rating: Option<i32>,
    category: Option<String>,
}

/// Feedback response
#[derive(Debug, Serialize)]
struct FeedbackResponse {
    id: String,
    message: String,
    status: String,
    user_id: Option<String>,
}

/// Ollama request structure
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

/// Ollama response structure
#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: String,
    #[allow(dead_code)] // used for future complete response detection
    done: bool,
}

/// JWT Authentication middleware
async fn auth_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip auth for health endpoint and login
    let path = request.uri().path();
    if path == "/health" || path == "/api/auth/login" {
        return Ok(next.run(request).await);
    }

    // Extract JWT token from Authorization header
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "));

    let token = match auth_header {
        Some(token) => token,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    // Validate JWT token
    let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_ref());
    let validation = Validation::new(Algorithm::HS256);

    match decode::<Claims>(token, &decoding_key, &validation) {
        Ok(token_data) => {
            // Add user context to request extensions
            let user_context = UserContext {
                user_id: token_data.claims.sub,
                role: token_data.claims.role,
            };
            request.extensions_mut().insert(user_context);
            Ok(next.run(request).await)
        }
        Err(_) => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Generate JWT token
fn generate_jwt(user_id: &str, role: &str, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp: now + 3600, // 1 hour expiration
        iat: now,
        role: role.to_string(),
    };

    let header = Header::new(Algorithm::HS256);
    let encoding_key = EncodingKey::from_secret(secret.as_ref());
    
    encode(&header, &claims, &encoding_key)
}

/// Login endpoint - creates JWT token
async fn login_handler(
    State(state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    // Simple user validation (in production, check against database)
    let (user_id, role) = match (request.username.as_str(), request.password.as_str()) {
        ("admin", "admin123") => ("admin".to_string(), "admin".to_string()),
        ("user", "user123") => ("user".to_string(), "user".to_string()),
        ("demo", "demo123") => ("demo".to_string(), "user".to_string()),
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    // Generate JWT token
    let token = generate_jwt(&user_id, &role, &state.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = LoginResponse {
        token,
        expires_in: 3600, // 1 hour
        user_id,
        role,
    };

    Ok(Json(response))
}

/// Health check endpoint
async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let uptime = state.start_time.elapsed().as_secs();
    
    // Test database connection
    let db_status = match sqlx::query("SELECT 1").fetch_one(&state.db_pool).await {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };

    Json(HealthResponse {
        status: "healthy".to_string(),
        version: "0.3.0".to_string(),
        uptime_seconds: uptime,
        database: db_status.to_string(),
        auth_enabled: true,
    })
}

/// Chat endpoint with authentication
async fn chat_endpoint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, StatusCode> {
    let start_time = Instant::now();

    // Get user context from middleware
    let user_context = headers
        .get("user-context")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Prepare request for Ollama
    let ollama_request = OllamaRequest {
        model: request.model.clone().unwrap_or_else(|| "gpt-oss:20b".to_string()),
        prompt: request.message.clone(),
        stream: false,
        options: OllamaOptions {
            temperature: request.temperature.unwrap_or(0.7),
            num_predict: request.max_tokens.unwrap_or(1000),
        },
    };

    // Call Ollama API with timeout
    let client = reqwest::Client::new();
    let ollama_response = timeout(
        Duration::from_secs(30),
        client
            .post(format!("{}/api/generate", state.ollama_url))
            .json(&ollama_request)
            .send()
    ).await;

    let ai_response = match ollama_response {
        Ok(Ok(response)) => {
            if response.status().is_success() {
                match response.json::<OllamaResponse>().await {
                    Ok(ollama_resp) => ollama_resp.response,
                    Err(_) => "Hello! I'm your AI assistant. How can I help you today?".to_string(),
                }
            } else {
                "I'm experiencing some technical difficulties. Please try again.".to_string()
            }
        }
        _ => "I'm currently offline, but I'm here to help when I'm back online!".to_string(),
    };

    let response_time = start_time.elapsed().as_millis() as u64;
    let response_id = uuid::Uuid::new_v4().to_string();
    let conversation_id = request.conversation_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // Store conversation in database (if available)
    let user_id_for_db = user_context.as_ref().unwrap_or(&"anonymous".to_string()).clone();
    if sqlx::query(
        "INSERT INTO conversations (id, user_id, message, response, model, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())"
    )
    .bind(&response_id)
    .bind(&user_id_for_db)
    .bind(&request.message)
    .bind(&ai_response)
    .bind(&ollama_request.model)
    .execute(&state.db_pool)
    .await
    .is_ok()
    {
        println!("✅ Conversation stored in database");
    }

    let response = ChatResponse {
        id: response_id,
        message: ai_response,
        model: ollama_request.model,
        response_time_ms: response_time,
        conversation_id,
        user_id: user_context,
    };

    Ok(Json(response))
}

/// Get agents list
async fn agents_list_handler(State(_state): State<AppState>) -> Json<Vec<Agent>> {
    // Return hardcoded agents for now (in production, fetch from database)
    let agents = vec![
        Agent {
            id: "1".to_string(),
            name: "AI Assistant".to_string(),
            description: "General-purpose AI assistant".to_string(),
            category: "general".to_string(),
            status: "active".to_string(),
        },
        Agent {
            id: "2".to_string(),
            name: "Code Helper".to_string(),
            description: "Programming and development assistant".to_string(),
            category: "development".to_string(),
            status: "active".to_string(),
        },
    ];

    Json(agents)
}

/// Submit feedback
async fn feedback_submit_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<FeedbackRequest>,
) -> Result<Json<FeedbackResponse>, StatusCode> {
    let feedback_id = uuid::Uuid::new_v4().to_string();
    
    // Get user context
    let user_context = headers
        .get("user-context")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Store feedback in database (if available)
    let user_id_for_db = user_context.as_ref().unwrap_or(&"anonymous".to_string()).clone();
    if sqlx::query(
        "INSERT INTO feedback (id, user_id, message, rating, category, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW())"
    )
    .bind(&feedback_id)
    .bind(&user_id_for_db)
    .bind(&request.message)
    .bind(request.rating)
    .bind(request.category.unwrap_or_else(|| "general".to_string()))
    .execute(&state.db_pool)
    .await
    .is_ok()
    {
        println!("✅ Feedback stored in database");
    }

    let response = FeedbackResponse {
        id: feedback_id,
        message: "Feedback received successfully".to_string(),
        status: "success".to_string(),
        user_id: user_context,
    };

    Ok(Json(response))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("🚀 Starting Enhanced LLM Router with JWT Authentication...");

    // Configuration from environment
    let port = std::env::var("LLM_ROUTER_PORT")
        .unwrap_or_else(|_| "8003".to_string())
        .parse::<u16>()
        .unwrap_or(8003);

    let ollama_url = std::env::var("OLLAMA_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@127.0.0.1:54322/postgres".to_string());

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-super-secret-jwt-key-change-in-production".to_string());

    // Initialize database connection
    println!("📦 Connecting to database...");
    let db_pool = sqlx::PgPool::connect(&database_url).await?;
    
    // Test database connection
    sqlx::query("SELECT 1").fetch_one(&db_pool).await?;
    println!("✅ Database connected successfully");

    // Create application state
    let state = AppState {
        start_time: Instant::now(),
        ollama_url: ollama_url.clone(),
        db_pool,
        jwt_secret,
    };

    // Build router with JWT middleware
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/api/auth/login", post(login_handler))
        .route("/api/chat", post(chat_endpoint))
        .route("/api/agents/list", get(agents_list_handler))
        .route("/api/v1/feedback/submit", post(feedback_submit_handler))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🎯 LLM Router with JWT Auth listening on http://0.0.0.0:{}", port);
    println!("🔒 JWT Authentication enabled");
    println!("🤖 Ollama URL: {}", ollama_url);
    println!("📊 Endpoints:");
    println!("   POST /api/auth/login - Get JWT token");
    println!("   GET  /health - Health check (no auth)");
    println!("   POST /api/chat - Chat with AI (requires auth)");
    println!("   GET  /api/agents/list - List agents (requires auth)");
    println!("   POST /api/v1/feedback/submit - Submit feedback (requires auth)");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}