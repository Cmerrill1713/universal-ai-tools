use std::time::{SystemTime, UNIX_EPOCH};
use tracing::info;
use std::env;
use warp::Filter;
use llm_router::{GuardrailsManager, LLMRouter, RouterConfig, models::{Message, GenerationOptions}, context::MessageRole};
use llm_router::smart_router::SmartLLMRouter;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use futures_util::StreamExt;
use tokio_stream::wrappers::UnboundedReceiverStream;

#[derive(Debug, Deserialize)]
struct ChatRequest {
    messages: Vec<ChatMessage>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
    #[allow(dead_code)]
    stream: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
struct ChatResponse {
    content: String,
    model: String,
    provider: String,
    usage: Option<Usage>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Serialize)]
struct ModelsResponse {
    models: Vec<String>,
}

// Global router instances
static ROUTER: std::sync::OnceLock<Arc<RwLock<LLMRouter>>> = std::sync::OnceLock::new();
static SMART_ROUTER: std::sync::OnceLock<Arc<RwLock<SmartLLMRouter>>> = std::sync::OnceLock::new();

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting LLM Router Service");

    // Initialize router
    let config = RouterConfig::default();
    let router = LLMRouter::new(config.clone()).await?;
    ROUTER.set(Arc::new(RwLock::new(router))).unwrap();

    // Initialize smart router
    let smart_router = SmartLLMRouter::new(config).await?;
    SMART_ROUTER.set(Arc::new(RwLock::new(smart_router))).unwrap();

    // Initialize guardrails
    let guardrails = GuardrailsManager::new();

    // Edge case handler disabled

    // Health check endpoint
    let health = warp::path("health")
        .and(warp::get())
        .map(|| {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            warp::reply::json(&serde_json::json!({
                "status": "healthy",
                "service": "llm-router",
                "timestamp": timestamp,
                "version": "1.0.0"
            }))
        });

    // Metrics endpoint
    let metrics = warp::path("metrics")
        .and(warp::get())
        .map(|| {
            warp::reply::with_header(
                "# HELP llm_router_requests_total Total requests\n# TYPE llm_router_requests_total counter\nllm_router_requests_total 0\n",
                "Content-Type",
                "text/plain"
            )
        });

    // Guardrails metrics endpoint
    let guardrails_clone = guardrails.clone();
    let guardrails_metrics = warp::path("guardrails")
        .and(warp::path("metrics"))
        .and(warp::get())
        .and_then(move || {
            let guardrails = guardrails_clone.clone();
            async move {
                let metrics = guardrails.get_metrics().await;
                Ok::<_, warp::Rejection>(warp::reply::json(&metrics))
            }
        });

    // Edge case metrics endpoint disabled

    // Chat endpoint
    let chat = warp::path("chat")
        .and(warp::post())
        .and(warp::body::json())
        .and_then(handle_chat);

    // Streaming chat endpoint
    let stream_chat = warp::path("stream")
        .and(warp::post())
        .and(warp::body::json())
        .and_then(handle_stream_chat);

    // Models endpoint
    let models = warp::path("models")
        .and(warp::get())
        .and_then(handle_models);

    // Provider health endpoint
    let provider_health = warp::path("providers")
        .and(warp::path("health"))
        .and(warp::get())
        .and_then(handle_provider_health);

    // Smart chat endpoint
    let smart_chat = warp::path("smart")
        .and(warp::post())
        .and(warp::body::json())
        .and_then(handle_smart_chat);

    // Root endpoint
    let root = warp::path::end()
        .map(|| {
            warp::reply::json(&serde_json::json!({
                "status": "healthy",
                "service": "llm-router",
                "port": 3033
            }))
        });

    // Combine all routes
    let routes = health
        .or(metrics)
        .or(guardrails_metrics)
        .or(chat)
        .or(stream_chat)
        .or(smart_chat)
        .or(models)
        .or(provider_health)
        .or(root)
        .with(warp::cors().allow_any_origin().allow_headers(vec!["content-type"]).allow_methods(vec!["GET", "POST", "OPTIONS"]));

    let port: u16 = env::var("LLM_ROUTER_PORT")
        .or_else(|_| env::var("PORT"))
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3033);
    info!("LLM Router listening on 0.0.0.0:{}", port);

    // Start the server
    warp::serve(routes)
        .run(([0, 0, 0, 0], port))
        .await;

    Ok(())
}


async fn handle_models() -> Result<impl warp::Reply, warp::Rejection> {
    let router = ROUTER.get().unwrap().read().await;

    match router.list_models().await {
        Ok(models) => {
            let response = ModelsResponse { models };
            Ok(warp::reply::json(&response))
        }
        Err(e) => {
            tracing::error!("Failed to list models: {}", e);
            Err(warp::reject::custom(ModelsError))
        }
    }
}

async fn handle_provider_health() -> Result<impl warp::Reply, warp::Rejection> {
    let router = ROUTER.get().unwrap().read().await;

    let health_status = router.get_provider_health().await;
    let healthy_providers = router.get_healthy_providers().await;

    let response = serde_json::json!({
        "status": "healthy",
        "providers": health_status,
        "healthy_providers": healthy_providers,
        "total_providers": router.providers().len(),
        "healthy_count": healthy_providers.len(),
        "timestamp": SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });

    Ok(warp::reply::json(&response))
}

#[derive(Debug)]
struct ChatError;

impl warp::reject::Reject for ChatError {}

#[derive(Debug)]
struct ModelsError;

impl warp::reject::Reject for ModelsError {}

// Mathematical reasoning enhancement functions
fn is_mathematical_problem(content: &str) -> bool {
    let content_lower = content.to_lowercase();

    // Check for mathematical keywords and patterns
    let math_keywords = [
        "calculate", "compute", "solve", "find", "how many", "how much",
        "what is", "add", "subtract", "multiply", "divide", "sum", "total",
        "perimeter", "area", "volume", "percentage", "ratio", "proportion",
        "equation", "formula", "algebra", "geometry", "arithmetic"
    ];

    let has_math_keywords = math_keywords.iter().any(|&keyword| content_lower.contains(keyword));

    // Check for numbers and mathematical operations
    let has_numbers = content.chars().any(|c| c.is_ascii_digit());
    let has_operations = content.contains('+') || content.contains('-') ||
                        content.contains('*') || content.contains('/') ||
                        content.contains('=') || content.contains('%');

    // Check for question words that suggest calculation
    let has_question_words = content_lower.contains("how") || content_lower.contains("what");

    has_math_keywords && (has_numbers || has_operations || has_question_words)
}

fn enhance_math_prompting(content: &str) -> String {
    format!(
        "Think step by step to solve this mathematical problem:\n\n{}\n\nPlease:\n1. Identify what information is given\n2. Determine what you need to find\n3. Show your calculations step by step\n4. Provide your final answer\n\nLet's solve this step by step:",
        content
    )
}

fn is_logical_reasoning_problem(content: &str) -> bool {
    let content_lower = content.to_lowercase();

    // Check for logical reasoning keywords and patterns
    let logical_keywords = [
        "if", "then", "all", "some", "none", "can we conclude", "explain your reasoning",
        "logical", "reasoning", "deduce", "infer", "conclude", "therefore", "because",
        "sequence", "pattern", "next", "comes next", "logical puzzle", "word problem",
        "farmer", "sheep", "machines", "widgets", "bat and ball", "cost"
    ];

    let has_logical_keywords = logical_keywords.iter().any(|&keyword| content_lower.contains(keyword));

    // Check for logical structures
    let has_logical_structures = content_lower.contains("if ") && content_lower.contains("then") ||
                               content_lower.contains("all ") && content_lower.contains("are") ||
                               content_lower.contains("some ") && content_lower.contains("are") ||
                               content_lower.contains("explain") && content_lower.contains("reasoning");

    // Check for puzzle-like patterns
    let has_puzzle_patterns = content_lower.contains("sequence") ||
                             content_lower.contains("pattern") ||
                             content_lower.contains("comes next") ||
                             content_lower.contains("puzzle");

    has_logical_keywords && (has_logical_structures || has_puzzle_patterns)
}

fn enhance_logical_prompting(content: &str) -> String {
    format!(
        "Think through this logical reasoning problem step by step:\n\n{}\n\nPlease:\n1. Identify the given information and premises\n2. Determine what logical rules or patterns apply\n3. Work through the reasoning step by step\n4. State your conclusion clearly\n5. Explain why your conclusion follows from the premises\n\nLet's reason through this step by step:",
        content
    )
}

async fn handle_chat(req: ChatRequest) -> Result<impl warp::Reply, warp::Rejection> {
    // Convert chat messages to internal format and enhance for math problems
    let mut messages: Vec<Message> = req.messages
        .into_iter()
        .map(|msg| Message {
            role: match msg.role.as_str() {
                "system" => MessageRole::System,
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                _ => MessageRole::User,
            },
            content: msg.content,
            name: None,
        })
        .collect();

    // Enhance reasoning with chain-of-thought prompting
    if let Some(last_msg) = messages.last_mut() {
        if last_msg.role == MessageRole::User {
            let content = &last_msg.content;
            // Check if this is a mathematical problem
            if is_mathematical_problem(content) {
                last_msg.content = enhance_math_prompting(content);
            }
            // Check if this is a logical reasoning problem
            else if is_logical_reasoning_problem(content) {
                last_msg.content = enhance_logical_prompting(content);
            }
        }
    }

    // Get router
    let router = ROUTER.get().unwrap().read().await;

    // Create generation options
    let options = GenerationOptions {
        model: Some(req.model.unwrap_or_else(|| "default".to_string())),
        temperature: Some(req.temperature.unwrap_or(0.7)),
        max_tokens: Some(req.max_tokens.unwrap_or(100)),
        stream: Some(false),
        ..Default::default()
    };

    // Route the request
    match router.route_request(messages, Some(options)).await {
        Ok(response) => Ok(warp::reply::json(&serde_json::json!({
            "response": response.content,
            "model": response.model,
            "provider": response.provider,
            "status": "success"
        }))),
        Err(e) => {
            tracing::error!("Chat routing failed: {}", e);
            Err(warp::reject::custom(ChatError))
        }
    }
}

async fn handle_stream_chat(req: ChatRequest) -> Result<impl warp::Reply, warp::Rejection> {
    // Convert chat messages to internal format
    let messages: Vec<Message> = req.messages
        .into_iter()
        .map(|msg| Message {
            role: match msg.role.as_str() {
                "system" => MessageRole::System,
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                _ => MessageRole::User,
            },
            content: msg.content,
            name: None,
        })
        .collect();

    // Create generation options for streaming
    let options = GenerationOptions {
        model: req.model.clone(),
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: Some(true), // Enable streaming
        ..Default::default()
    };

    // Get router and attempt to stream
    let router = ROUTER.get().unwrap().read().await;

    match router.route_stream(messages, Some(options)).await {
        Ok(stream) => {
            // Convert the stream to SSE format
            let sse_stream = stream.map(|chunk_result| {
                match chunk_result {
                    Ok(content) => {
                        if content.is_empty() {
                            "data: \n\n".to_string()
                        } else {
                            format!("data: {{\"content\": \"{}\"}}\n\n", content.replace('"', "\\\""))
                        }
                    }
                    Err(e) => {
                        format!("data: {{\"error\": \"{}\"}}\n\n", e.to_string().replace('"', "\\\""))
                    }
                }
            });

            // Create a proper async stream
            let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<Result<String, std::io::Error>>();

            tokio::spawn(async move {
                let mut stream = sse_stream;
                while let Some(chunk) = stream.next().await {
                    let _ = tx.send(Ok(chunk));
                }
                let _ = tx.send(Ok("data: [DONE]\n\n".to_string()));
            });

            Ok(warp::reply::with_header(
                warp::reply::with_header(
                    warp::reply::with_header(
                        warp::reply::with_header(
                            warp::reply::Response::new(
                                warp::hyper::Body::wrap_stream(
                                    UnboundedReceiverStream::new(rx)
                                )
                            ),
                            "Content-Type",
                            "text/event-stream"
                        ),
                        "Cache-Control",
                        "no-cache"
                    ),
                    "Connection",
                    "keep-alive"
                ),
                "Access-Control-Allow-Origin",
                "*"
            ))
        }
        Err(e) => {
            tracing::error!("Stream routing failed: {}", e);
            let error_response = format!("data: {{\"error\": \"{}\"}}\n\ndata: [DONE]\n\n", e.to_string().replace('"', "\\\""));
            Ok(warp::reply::with_header(
                warp::reply::with_header(
                    warp::reply::with_header(
                        warp::reply::with_header(
                            warp::reply::Response::new(
                                warp::hyper::Body::from(error_response)
                            ),
                            "Content-Type",
                            "text/event-stream"
                        ),
                        "Cache-Control",
                        "no-cache"
                    ),
                    "Connection",
                    "keep-alive"
                ),
                "Access-Control-Allow-Origin",
                "*"
            ))
        }
    }
}

async fn handle_smart_chat(req: ChatRequest) -> Result<impl warp::Reply, warp::Rejection> {
    // Convert chat messages to internal format
    let messages: Vec<Message> = req.messages
        .into_iter()
        .map(|msg| Message {
            role: match msg.role.as_str() {
                "system" => MessageRole::System,
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                _ => MessageRole::User,
            },
            content: msg.content,
            name: None,
        })
        .collect();

    // Get smart router and route request
    let smart_router = SMART_ROUTER.get().unwrap().read().await;

    match smart_router.route_request(&messages).await {
        Ok(response) => {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();

            Ok(warp::reply::json(&serde_json::json!({
                "response": response,
                "status": "success",
                "timestamp": timestamp,
                "routing_method": "smart"
            })))
        }
        Err(e) => {
            tracing::error!("Smart routing failed: {}", e);
            Err(warp::reject::custom(SmartChatError))
        }
    }
}

#[derive(Debug)]
struct SmartChatError;

impl warp::reject::Reject for SmartChatError {}
