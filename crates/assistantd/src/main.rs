use axum::{
    extract::State,
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
    Json, Router,
};
use llm_router::{context::MessageRole, models::Message};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::{cors::{Any, CorsLayer}, trace::TraceLayer};
use futures_util::{Stream, StreamExt};
use tokio_stream::wrappers::ReceiverStream;
use std::{convert::Infallible, env};
use reqwest::Client;
mod rag;
mod rag_provider;
mod simple_memory;
mod simple_cache;
mod feedback;

use rag::{R1RagRequest, R1RagResponse};
use rag_provider::{RagProvider, RagProviderConfig, HybridSearchRow, RagMetrics};
use simple_memory::SimpleMemoryManager;
use simple_cache::SimpleCache;
use feedback::FeedbackManager;
// use serde_json::json;

#[derive(Clone)]
struct AppState {
    llm_router_url: String,
    client: Client,
    memory_manager: std::sync::Arc<SimpleMemoryManager>,
    cache: std::sync::Arc<SimpleCache>,
    feedback_manager: std::sync::Arc<FeedbackManager>,
    knowledge_context_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct LLMRouterRequest {
    messages: Vec<Message>,
    model: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct LLMRouterResponse {
    response: String,
    model: String,
    provider: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct ChatRequestMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatRequest {
    messages: Vec<ChatRequestMessage>,
    #[serde(default)]
    model: Option<String>,
    // Optional function-calling fields (pass-through to provider when supported)
    #[serde(default)]
    tools: Option<serde_json::Value>,
    #[serde(default)]
    tool_choice: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct ChatResponse {
    content: String,
    model: String,
    provider: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let llm_router_url = env::var("LLM_ROUTER_URL").unwrap_or_else(|_| "http://localhost:3033".to_string());
    println!("Connecting to LLM Router at: {}", llm_router_url);
    let client = Client::new();

    // Initialize advanced systems
    let memory_manager = std::sync::Arc::new(SimpleMemoryManager::new());
    let cache = std::sync::Arc::new(SimpleCache::new(
        500, // Max cache size
        std::time::Duration::from_secs(1800), // 30 minutes TTL
    ));
    let feedback_manager = std::sync::Arc::new(FeedbackManager::new());

    let state = AppState {
        llm_router_url,
        client,
        memory_manager,
        cache,
        feedback_manager,
        knowledge_context_url: std::env::var("KNOWLEDGE_CONTEXT_URL").ok(),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/chat", post(chat))
        .route("/chat/stream", post(chat_stream))
        .route("/chat/agentic", post(agentic_chat))
        .route("/chat/help", get(chat_help))
        .route("/rag/r1", post(r1_rag))
        .route("/memory/search", post(memory_search))
        .route("/rag/metrics", get(rag_metrics))
        .route("/rag/health", get(rag_health))
        .route("/tokens/stats/:user_id", get(get_user_token_stats))
        .route("/tokens/stats", get(get_all_token_stats))
        .route("/memory/user/:user_id", get(get_user_memory))
        .route("/memory/context", post(get_memory_context))
        .route("/feedback", post(submit_feedback))
        .route("/feedback/insights", get(get_feedback_insights))
        .route("/cache/stats", get(get_cache_stats))
        .with_state(state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any));

    let port: u16 = env::var("ASSISTANTD_PORT")
        .or_else(|_| env::var("PORT"))
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Starting assistantd server on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("assistantd listening on {}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}

// Helper function to call LLM Router via HTTP
async fn call_llm_router(
    state: &AppState,
    messages: Vec<Message>,
    model: Option<String>,
) -> Result<LLMRouterResponse, anyhow::Error> {
    let request = LLMRouterRequest {
        messages,
        model,
        temperature: Some(0.7),
        max_tokens: Some(2048),
    };

    let response = state.client
        .post(&format!("{}/chat", state.llm_router_url))
        .json(&request)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!("LLM Router returned status: {}", response.status()));
    }

    let router_response: LLMRouterResponse = response.json().await?;
    Ok(router_response)
}

// Helper function to get available models from LLM Router
async fn get_available_models(state: &AppState) -> Result<Vec<String>, anyhow::Error> {
    let response = state.client
        .get(&format!("{}/models", state.llm_router_url))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!("LLM Router models endpoint returned status: {}", response.status()));
    }

    let models_response: serde_json::Value = response.json().await?;
    let models = models_response["models"]
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("Invalid models response format"))?
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    Ok(models)
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "assistantd"
    }))
}

async fn chat_help() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "title": "Universal AI Assistant Help",
        "description": "I'm your intelligent AI assistant that can help you with a wide variety of tasks!",
        "capabilities": {
            "general_chat": {
                "description": "Ask me anything - I can explain concepts, provide information, and have conversations",
                "examples": [
                    "What is machine learning?",
                    "How does photosynthesis work?",
                    "Tell me about the history of computers"
                ]
            },
            "calculations": {
                "description": "I can perform mathematical calculations for you",
                "examples": [
                    "What is 25 times 4?",
                    "Calculate 15 + 27",
                    "How much is 100 divided by 8?"
                ]
            },
            "information_search": {
                "description": "I can search through my knowledge base for specific information",
                "examples": [
                    "Search for information about artificial intelligence",
                    "Find details about cooking techniques",
                    "Look up information about computer troubleshooting"
                ]
            },
            "practical_help": {
                "description": "I can help with everyday tasks and problems",
                "examples": [
                    "My computer is running slowly, what should I do?",
                    "How do I learn to cook?",
                    "What are some good study techniques?"
                ]
            }
        },
        "how_to_use": {
            "regular_chat": "POST /chat - For general questions and conversations",
            "agentic_chat": "POST /chat/agentic - For tasks that need tools (calculations, searches, etc.)",
            "streaming": "POST /chat/stream - For real-time streaming responses"
        },
        "tips": [
            "Be specific in your questions for better answers",
            "Use the agentic chat for calculations and searches",
            "I automatically select the best AI model for your question",
            "I can search my knowledge base when you ask informational questions"
        ]
    }))
}

#[derive(Debug, Deserialize)]
struct OllamaStreamLine {
    #[serde(default)]
    done: bool,
    #[serde(default)]
    #[allow(dead_code)]
    model: Option<String>,
    #[serde(default)]
    message: Option<OllamaStreamMessage>,
    #[serde(default)]
    #[allow(dead_code)]
    prompt_eval_count: Option<u32>,
    #[serde(default)]
    #[allow(dead_code)]
    eval_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamMessage {
    #[allow(dead_code)]
    role: String,
    content: String,
}

async fn chat_stream(State(_state): State<AppState>, Json(req): Json<ChatRequest>) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, String)> {
    let base_url = env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let model = req.model.unwrap_or_else(|| "llama3.2:3b".to_string());

    // Map messages for Ollama
    #[derive(Serialize)]
    struct Msg<'a> { role: &'a str, content: &'a str }
    #[derive(Serialize)]
    struct Body<'a> {
        model: &'a str,
        messages: Vec<Msg<'a>>,
        stream: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        tools: Option<&'a serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        tool_choice: Option<&'a serde_json::Value>,
    }

    let mapped: Vec<Msg> = req.messages.iter().map(|m| Msg { role: match m.role.to_lowercase().as_str() { "user" => "user", "assistant" => "assistant", "system" => "system", _ => "user" }, content: &m.content }).collect();
    let body = Body {
        model: &model,
        messages: mapped,
        stream: true,
        tools: req.tools.as_ref(),
        tool_choice: req.tool_choice.as_ref(),
    };

    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let client = Client::new();
    let resp = client.post(&url).json(&body).send().await.map_err(|e| (StatusCode::BAD_GATEWAY, format!("ollama request failed: {}", e)))?;
    if !resp.status().is_success() {
        return Err((StatusCode::BAD_GATEWAY, format!("ollama returned status {}", resp.status())));
    }

    let mut buffer = Vec::<u8>::new();
    let mut stream = resp.bytes_stream();
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(64);

    tokio::spawn(async move {
        while let Some(next) = stream.next().await {
            match next {
                Ok(chunk) => {
                    buffer.extend_from_slice(&chunk);
                    // split on newlines
                    loop {
                        if let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
                            let line = buffer.drain(..=pos).collect::<Vec<u8>>();
                            let trimmed = line.iter().copied().filter(|b| *b != b'\n' && *b != b'\r').collect::<Vec<u8>>();
                            if trimmed.is_empty() { continue; }
                            if let Ok(parsed) = serde_json::from_slice::<OllamaStreamLine>(&trimmed) {
                                if parsed.done {
                                    let _ = tx.send(Ok(Event::default().event("done").data("true"))).await;
                                    break;
                                } else if let Some(msg) = parsed.message {
                                    if !msg.content.is_empty() {
                                        let _ = tx.send(Ok(Event::default().event("token").data(msg.content))).await;
                                    }
                                }
                            }
                        } else {
                            break;
                        }
                    }
                }
                Err(_) => {
                    let _ = tx.send(Ok(Event::default().event("error").data("stream_error"))).await;
                    break;
                }
            }
        }
        let _ = tx.send(Ok(Event::default().event("done").data("true"))).await;
    });

    let sse = Sse::new(ReceiverStream::new(rx)).keep_alive(KeepAlive::new());
    Ok(sse)
}

#[axum::debug_handler]
async fn chat(State(state): State<AppState>, Json(req): Json<ChatRequest>) -> Result<Json<ChatResponse>, (StatusCode, String)> {
    let start_time = std::time::Instant::now();

    let messages: Vec<Message> = req
        .messages
        .iter()
        .map(|m| Message {
            role: match m.role.to_lowercase().as_str() {
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                "system" => MessageRole::System,
                _ => MessageRole::User,
            },
            content: m.content.clone(),
            name: None,
        })
        .collect();

    // Check cache first for simple queries
    if let Some(last_message) = messages.last() {
        if matches!(last_message.role, MessageRole::User) {
            if let Some((cached_response, cached_model)) = state.cache.get(&last_message.content).await {
                tracing::info!("Cache hit for query: {}", last_message.content);
                return Ok(Json(ChatResponse {
                    content: cached_response,
                    model: cached_model,
                    provider: "cache".to_string(),
                }));
            }
        }
    }

    // If function tools are provided, attempt a direct call to the upstream
    // provider for non-stream requests (best-effort pass-through).
    if req.tools.is_some() || req.tool_choice.is_some() {
        return chat_with_tools_passthrough(req).await;
    }

    // Enhanced chat with RAG integration and intelligent model selection
    let enhanced_response = enhanced_chat_with_rag(&state, messages.clone(), req.model).await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("enhanced chat failed: {}", e)))?;

    // Cache the response
    if let Some(last_message) = messages.last() {
        if matches!(last_message.role, MessageRole::User) {
            if let Err(e) = state.cache.set(&last_message.content, &enhanced_response.content, &enhanced_response.model).await {
                tracing::warn!("Failed to cache response: {}", e);
            }
        }
    }

    // Store in memory (use a default user_id for now)
    let user_id = "default_user";
    if let Some(last_message) = messages.last() {
        if matches!(last_message.role, MessageRole::User) {
            if let Err(e) = state.memory_manager.add_conversation(user_id, &last_message.content, &enhanced_response.content).await {
                tracing::warn!("Failed to store conversation in memory: {}", e);
            }
        }
    }

    let duration = start_time.elapsed();
    tracing::info!("Chat completed in {:?}", duration);

    Ok(Json(enhanced_response))
}

// Enhanced chat function with RAG integration and intelligent model selection
async fn enhanced_chat_with_rag(
    state: &AppState,
    messages: Vec<Message>,
    requested_model: Option<String>
) -> Result<ChatResponse, anyhow::Error> {
    // Get the last user message for RAG context
    let last_user_message = messages
        .iter()
        .rev()
        .find(|m| matches!(m.role, MessageRole::User))
        .map(|m| m.content.clone())
        .unwrap_or_default();

    // Determine if we should use knowledge context or RAG based on the query
    let should_use_rag = should_use_rag_for_query(&last_user_message);

    let mut enhanced_messages = messages.clone();
    let _rag_context = String::new();
    let mut citations = Vec::new();

    // Try Knowledge Context service first if configured
    if let Some(kctx_url) = &state.knowledge_context_url {
        if !last_user_message.is_empty() {
            if let Ok((ctx, srcs)) = fetch_knowledge_context(&state.client, kctx_url, &last_user_message).await {
                if !ctx.is_empty() {
                    let sys = Message {
                        role: MessageRole::System,
                        content: format!(
                            "Use the following knowledge context to answer the user's question. Cite sources with [1], [2], etc. when referencing the context.\n\nCONTEXT:\n{}",
                            ctx
                        ),
                        name: None,
                    };
                    // Insert system context before the last user message when possible
                    if !enhanced_messages.is_empty() {
                        let insert_at = enhanced_messages.len() - 1;
                        enhanced_messages.insert(insert_at, sys);
                    } else {
                        enhanced_messages.push(sys);
                    }
                }
                if !srcs.is_empty() {
                    citations = srcs;
                }
            } else {
                tracing::warn!("Knowledge Context fetch failed, continuing without it");
            }
        }
    }

    // If RAG is needed, retrieve relevant context
    if should_use_rag && !last_user_message.is_empty() {
        match retrieve_rag_context(&last_user_message).await {
            Ok((_context, rag_citations)) => {
                citations = rag_citations;

                // Add RAG context to the conversation
                if !_context.is_empty() {
                    let rag_system_message = Message {
                        role: MessageRole::System,
                        content: format!(
                            "Use the following context to answer the user's question. Cite sources with [1], [2], etc. when referencing the context.\n\nCONTEXT:\n{}",
                            _context
                        ),
                        name: None,
                    };
                    enhanced_messages.insert(enhanced_messages.len() - 1, rag_system_message);
                }
            }
            Err(e) => {
                tracing::warn!("RAG context retrieval failed: {}", e);
                // Continue without RAG context
            }
        }
    }

    // Intelligent model selection
    let selected_model = select_optimal_model(state, &enhanced_messages, requested_model).await?;

    // Generate response with selected model
    let response = call_llm_router(state, enhanced_messages, Some(selected_model.clone())).await?;

    // Enhance response with citations if RAG was used
    let enhanced_content = if !citations.is_empty() {
        format!("{}\n\n**Sources:**\n{}",
            response.response,
            citations.iter().enumerate().map(|(i, citation)| {
                format!("[{}] {}", i + 1, citation)
            }).collect::<Vec<_>>().join("\n")
        )
    } else {
        response.response
    };

    Ok(ChatResponse {
        content: enhanced_content,
        model: selected_model,
        provider: response.provider,
    })
}

// Determine if a query should use RAG
fn should_use_rag_for_query(query: &str) -> bool {
    let rag_keywords = [
        "what is", "how does", "explain", "tell me about", "information about",
        "details about", "background", "history", "definition", "meaning",
        "who is", "when did", "where is", "why does", "how to",
        "research", "find", "search", "look up", "documentation",
        "help me", "i need", "i want to", "can you", "could you",
        "artificial intelligence", "machine learning", "technology",
        "computer", "software", "programming", "coding"
    ];

    let query_lower = query.to_lowercase();
    rag_keywords.iter().any(|keyword| query_lower.contains(keyword))
}

#[derive(Debug, Deserialize)]
struct KnowledgeContextResp {
    context: String,
    #[serde(default)]
    sources: Vec<String>,
}

async fn fetch_knowledge_context(client: &Client, base_url: &str, message: &str) -> Result<(String, Vec<String>), anyhow::Error> {
    let url = if base_url.ends_with('/') { format!("{}api/v1/context/build", base_url) } else { format!("{}/api/v1/context/build", base_url) };
    let body = serde_json::json!({
        "message": message,
        "limit": 5
    });
    let resp = client
        .post(&url)
        .json(&body)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(anyhow::anyhow!("knowledge context returned status: {}", resp.status()));
    }
    // Handle flexible payloads: try structured, then generic
    let text = resp.text().await?;
    if let Ok(parsed) = serde_json::from_str::<KnowledgeContextResp>(&text) {
        return Ok((parsed.context, parsed.sources));
    }
    // Fallback: try generic map
    let v: serde_json::Value = serde_json::from_str(&text)?;
    let ctx = v.get("context").and_then(|c| c.as_str()).unwrap_or("").to_string();
    let mut sources: Vec<String> = Vec::new();
    if let Some(srcs) = v.get("sources").and_then(|s| s.as_array()) {
        for s in srcs {
            if let Some(title) = s.get("title").and_then(|t| t.as_str()) {
                sources.push(title.to_string());
            } else if let Some(id) = s.get("id").and_then(|t| t.as_str()) {
                sources.push(id.to_string());
            }
        }
    }
    Ok((ctx, sources))
}

// Retrieve RAG context for a query
async fn retrieve_rag_context(query: &str) -> Result<(String, Vec<String>), anyhow::Error> {
    // Try to create RAG provider, but handle failures gracefully
    let provider = match RagProvider::from_env(RagProviderConfig::from_env()) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("Failed to create RAG provider: {}", e);
            return Ok((String::new(), Vec::new()));
        }
    };

    // Check if provider is healthy before attempting search
    let health_status = provider.health_check().await;
    let is_healthy = health_status.values().any(|&healthy| healthy);
    if !is_healthy {
        tracing::warn!("RAG provider is not healthy, skipping context retrieval");
        return Ok((String::new(), Vec::new()));
    }

    // Search for relevant context with timeout
    let search_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        provider.search(query, 5, 0.7)
    ).await;

    let rows = match search_result {
        Ok(Ok(rows)) => rows,
        Ok(Err(e)) => {
            tracing::warn!("RAG search failed: {}", e);
            return Ok((String::new(), Vec::new()));
        }
        Err(_) => {
            tracing::warn!("RAG search timed out");
            return Ok((String::new(), Vec::new()));
        }
    };

    if rows.is_empty() {
        return Ok((String::new(), Vec::new()));
    }

    // Build context string and citations
    let mut context_parts = Vec::new();
    let mut citations = Vec::new();

    for (i, row) in rows.iter().enumerate() {
        let citation = format!("{} - {}", row.title.as_deref().unwrap_or("Unknown"), row.table_name);
        citations.push(citation);

        context_parts.push(format!(
            "[{}] {}\n{}\n",
            i + 1,
            row.title.as_deref().unwrap_or("Unknown"),
            row.content.chars().take(500).collect::<String>()
        ));
    }

    Ok((context_parts.join("\n"), citations))
}

// Select optimal model based on query complexity and available models
async fn select_optimal_model(
    state: &AppState,
    messages: &[Message],
    requested_model: Option<String>,
) -> Result<String, anyhow::Error> {
    // Get available models with timeout
    let available_models = match get_available_models(state).await {
        Ok(models) => models,
        Err(e) => {
            tracing::warn!("Failed to get available models: {}", e);
            // Fallback to default models
            vec!["llama3.2:3b".to_string(), "llava:7b".to_string(), "llama3.1:8b".to_string()]
        }
    };

    // If a specific model is requested and available, use it
    if let Some(model) = requested_model {
        if available_models.contains(&model) {
            return Ok(model);
        }
    }

    // Analyze query complexity to select optimal model
    let last_message = messages.last().map(|m| m.content.as_str()).unwrap_or("");
    let query_complexity = analyze_query_complexity(last_message);

    let selected_model = match query_complexity {
        QueryComplexity::Simple => {
            // Prefer fast, smaller models for simple queries
            available_models.iter()
                .find(|m| m.contains("3b") || m.contains("2b") || m.contains("1b"))
                .or_else(|| available_models.first())
                .cloned()
        }
        QueryComplexity::Medium => {
            // Prefer medium-sized models for moderate complexity
            available_models.iter()
                .find(|m| m.contains("7b") || m.contains("8b"))
                .or_else(|| available_models.iter().find(|m| m.contains("3b")))
                .or_else(|| available_models.first())
                .cloned()
        }
        QueryComplexity::Complex => {
            // Prefer larger models for complex queries
            available_models.iter()
                .find(|m| m.contains("13b") || m.contains("14b") || m.contains("20b"))
                .or_else(|| available_models.iter().find(|m| m.contains("8b")))
                .or_else(|| available_models.first())
                .cloned()
        }
    };

    selected_model.ok_or_else(|| anyhow::anyhow!("No models available"))
}

#[derive(Debug)]
enum QueryComplexity {
    Simple,
    Medium,
    Complex,
}

fn analyze_query_complexity(query: &str) -> QueryComplexity {
    let query_lower = query.to_lowercase();
    let word_count = query.split_whitespace().count();

    // Complex query indicators
    let complex_indicators = [
        "analyze", "compare", "contrast", "evaluate", "synthesize",
        "complex", "detailed", "comprehensive", "thorough", "in-depth",
        "multiple", "various", "different", "relationship", "correlation",
        "algorithm", "implementation", "architecture", "design pattern"
    ];

    // Medium complexity indicators
    let medium_indicators = [
        "explain", "describe", "how", "why", "what if", "example",
        "process", "steps", "method", "approach", "technique"
    ];

    if word_count > 20 || complex_indicators.iter().any(|indicator| query_lower.contains(indicator)) {
        QueryComplexity::Complex
    } else if word_count > 10 || medium_indicators.iter().any(|indicator| query_lower.contains(indicator)) {
        QueryComplexity::Medium
    } else {
        QueryComplexity::Simple
    }
}

// Agentic chat with intelligent tool selection and execution
#[axum::debug_handler]
async fn agentic_chat(State(state): State<AppState>, Json(req): Json<ChatRequest>) -> Result<Json<ChatResponse>, (StatusCode, String)> {
    let messages: Vec<Message> = req
        .messages
        .iter()
        .map(|m| Message {
            role: match m.role.to_lowercase().as_str() {
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                "system" => MessageRole::System,
                _ => MessageRole::User,
            },
            content: m.content.clone(),
            name: None,
        })
        .collect();

    // Get the last user message for analysis
    let last_user_message = messages
        .iter()
        .rev()
        .find(|m| matches!(m.role, MessageRole::User))
        .map(|m| m.content.clone())
        .unwrap_or_default();

    // Determine if we need agentic tools
    let needs_tools = should_use_agentic_tools(&last_user_message);

    if needs_tools {
        // Use agentic chat with tool execution
        let agentic_response = execute_agentic_chat(&state, messages, req.model).await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("agentic chat failed: {}", e)))?;

        Ok(Json(agentic_response))
    } else {
        // Fall back to regular enhanced chat
        let enhanced_response = enhanced_chat_with_rag(&state, messages, req.model).await
            .map_err(|e| (StatusCode::BAD_GATEWAY, format!("enhanced chat failed: {}", e)))?;

        Ok(Json(enhanced_response))
    }
}

// Determine if a query needs agentic tools
fn should_use_agentic_tools(query: &str) -> bool {
    let tool_keywords = [
        "calculate", "compute", "math", "equation", "formula", "add", "subtract", "multiply", "divide",
        "search", "find", "lookup", "query", "database", "information", "research",
        "file", "read", "write", "create", "delete", "update", "save", "open",
        "web", "url", "http", "api", "request", "fetch", "browse", "internet",
        "schedule", "reminder", "calendar", "time", "date", "appointment", "meeting",
        "email", "send", "message", "notify", "alert", "contact", "communicate",
        "code", "program", "script", "function", "debug", "develop", "build",
        "analyze", "process", "transform", "convert", "format", "organize", "sort",
        "help me", "i need", "i want to", "can you", "could you", "please",
        "how much", "how many", "how long", "when", "where", "what time"
    ];

    let query_lower = query.to_lowercase();
    tool_keywords.iter().any(|keyword| query_lower.contains(keyword))
}

// Execute agentic chat with tool selection and execution
async fn execute_agentic_chat(
    state: &AppState,
    messages: Vec<Message>,
    requested_model: Option<String>,
) -> Result<ChatResponse, anyhow::Error> {
    let _last_message = messages.last().map(|m| m.content.as_str()).unwrap_or("");

    // Define available tools
    let available_tools = get_available_tools();

    // Create system message with tool definitions
    let _tool_definitions = serde_json::json!({
        "tools": available_tools,
        "tool_choice": "auto"
    });

    let mut enhanced_messages = messages.clone();

    // Add system message with tool instructions
    let system_message = Message {
        role: MessageRole::System,
        content: format!(
            "You are a helpful AI assistant that can use tools to provide better answers. \
            When a user asks for calculations, searches, or other tasks that require tools, \
            use them automatically and explain what you're doing in simple terms.\n\n\
            Available tools:\n\
            - calculate: For math problems and calculations\n\
            - search_memory: To find information in my knowledge base\n\
            - web_search: To search the internet for current information\n\
            - get_current_time: To get the current date and time\n\n\
            Always be friendly, helpful, and explain things clearly. \
            If you use a tool, show the user what you found or calculated.",
        ),
        name: None,
    };

    enhanced_messages.insert(0, system_message);

    // Select optimal model for agentic tasks
    let selected_model = select_optimal_model(state, &enhanced_messages, requested_model).await?;

    // Generate response with tool support
    let response = call_llm_router(state, enhanced_messages, Some(selected_model.clone())).await?;

    // Check if the response contains tool calls and execute them
    let final_response = if response.response.contains("tool_call") || response.response.contains("function") {
        execute_tool_calls(&response.response, state).await.unwrap_or(response.response)
    } else {
        response.response
    };

    Ok(ChatResponse {
        content: final_response,
        model: selected_model,
        provider: response.provider,
    })
}

// Get available tools for the agent
fn get_available_tools() -> serde_json::Value {
    serde_json::json!([
        {
            "type": "function",
            "function": {
                "name": "search_memory",
                "description": "Search through stored memories and knowledge base",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results",
                            "default": 5
                        }
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "calculate",
                "description": "Perform mathematical calculations",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "Mathematical expression to evaluate"
                        }
                    },
                    "required": ["expression"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": "Search the web for current information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        }
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_current_time",
                "description": "Get the current date and time",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }
    ])
}

// Execute tool calls found in the response
async fn execute_tool_calls(response_content: &str, _state: &AppState) -> Result<String, anyhow::Error> {
    let mut enhanced_response = response_content.to_string();

    // Check for calculation requests - improved pattern matching
    if response_content.contains("calculate") || response_content.contains("math") ||
       response_content.contains("+") || response_content.contains("-") ||
       response_content.contains("*") || response_content.contains("/") {

        // Try to extract mathematical expressions from the response
        let expressions = extract_math_expressions(response_content);
        for expression in expressions {
            match calculate_tool(&expression).await {
                Ok(result) => {
                    enhanced_response.push_str(&format!("\n\n**Calculation:** {} = {}", expression, result));
                }
                Err(e) => {
                    enhanced_response.push_str(&format!("\n\n**Calculation Error for '{}':** {}", expression, e));
                }
            }
        }
    }

    // Check for memory search requests
    if response_content.contains("search_memory") || response_content.contains("memory") ||
       response_content.contains("information") || response_content.contains("research") {

        // Extract search query (improved)
        let queries = extract_search_queries(response_content);
        for query in queries {
            match search_memory_tool(&query).await {
                Ok(results) => {
                    if !results.is_empty() {
                        enhanced_response.push_str(&format!("\n\n**Found Information:**\n{}", results));
                    } else {
                        enhanced_response.push_str("\n\n**No relevant information found in my knowledge base.**");
                    }
                }
                Err(e) => {
                    enhanced_response.push_str(&format!("\n\n**Search Error:** {}", e));
                }
            }
        }
    }

    // Check for time requests
    if response_content.contains("time") || response_content.contains("date") ||
       response_content.contains("when") || response_content.contains("current") {
        let current_time = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
        enhanced_response.push_str(&format!("\n\n**Current Time:** {}", current_time));
    }

    Ok(enhanced_response)
}

// Extract mathematical expressions from text
fn extract_math_expressions(text: &str) -> Vec<String> {
    let mut expressions = Vec::new();

    // Look for patterns like "25 * 4", "15 + 27", etc.
    let words: Vec<&str> = text.split_whitespace().collect();
    for i in 0..words.len().saturating_sub(2) {
        if let (Ok(_), Ok(_)) = (words[i].parse::<f64>(), words[i + 2].parse::<f64>()) {
            if ["+", "-", "*", "/", "times", "plus", "minus", "divided"].contains(&words[i + 1]) {
                let op = match words[i + 1] {
                    "times" => "*",
                    "plus" => "+",
                    "minus" => "-",
                    "divided" => "/",
                    _ => words[i + 1],
                };
                expressions.push(format!("{} {} {}", words[i], op, words[i + 2]));
            }
        }
    }

    expressions
}

// Extract search queries from text
fn extract_search_queries(text: &str) -> Vec<String> {
    let mut queries = Vec::new();

    // Look for quoted text or key phrases
    if let Some(start) = text.find('"') {
        if let Some(end) = text[start + 1..].find('"') {
            queries.push(text[start + 1..start + 1 + end].to_string());
        }
    }

    // Look for common search patterns
    let search_patterns = ["search for", "find information about", "look up", "research"];
    for pattern in search_patterns {
        if let Some(pos) = text.find(pattern) {
            let after_pattern = &text[pos + pattern.len()..];
            if let Some(end) = after_pattern.find(['.', '?', '!', '\n']) {
                queries.push(after_pattern[..end].trim().to_string());
            }
        }
    }

    queries
}

// Tool implementations
async fn search_memory_tool(query: &str) -> Result<String, anyhow::Error> {
    let provider = RagProvider::from_env(RagProviderConfig::from_env())?;
    let rows = provider.search(query, 3, 0.7).await?;

    if rows.is_empty() {
        return Ok("No relevant information found in memory.".to_string());
    }

    let results = rows.iter().map(|row| {
        format!("- {}: {}", row.title.as_deref().unwrap_or("Unknown"), row.content.chars().take(200).collect::<String>())
    }).collect::<Vec<_>>().join("\n");

    Ok(results)
}

async fn calculate_tool(expression: &str) -> Result<String, anyhow::Error> {
    // Simple calculation implementation - in production, use a proper math parser
    let cleaned_expr = expression.replace(" ", "");

    // Basic arithmetic operations
    if let Some(plus_pos) = cleaned_expr.find('+') {
        let left: f64 = cleaned_expr[..plus_pos].parse()?;
        let right: f64 = cleaned_expr[plus_pos + 1..].parse()?;
        return Ok((left + right).to_string());
    }

    if let Some(minus_pos) = cleaned_expr.find('-') {
        let left: f64 = cleaned_expr[..minus_pos].parse()?;
        let right: f64 = cleaned_expr[minus_pos + 1..].parse()?;
        return Ok((left - right).to_string());
    }

    if let Some(mult_pos) = cleaned_expr.find('*') {
        let left: f64 = cleaned_expr[..mult_pos].parse()?;
        let right: f64 = cleaned_expr[mult_pos + 1..].parse()?;
        return Ok((left * right).to_string());
    }

    if let Some(div_pos) = cleaned_expr.find('/') {
        let left: f64 = cleaned_expr[..div_pos].parse()?;
        let right: f64 = cleaned_expr[div_pos + 1..].parse()?;
        if right != 0.0 {
            return Ok((left / right).to_string());
        } else {
            return Err(anyhow::anyhow!("Division by zero"));
        }
    }

    // If no operation found, try to parse as a number
    let result: f64 = cleaned_expr.parse()?;
    Ok(result.to_string())
}

async fn chat_with_tools_passthrough(req: ChatRequest) -> Result<Json<ChatResponse>, (StatusCode, String)> {
    // Build request compatible with upstream (e.g., Ollama /api/chat stream:false)
    #[derive(serde::Serialize)]
    struct Msg<'a> { role: &'a str, content: &'a str }
    #[derive(serde::Serialize)]
    struct Body<'a> {
        model: &'a str,
        messages: Vec<Msg<'a>>,
        #[serde(skip_serializing_if = "Option::is_none")] tools: Option<&'a serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")] tool_choice: Option<&'a serde_json::Value>,
        #[serde(default)] stream: bool,
    }

    let base_url = std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
    let model = req.model.unwrap_or_else(|| "llama3.2:3b".to_string());
    let mapped: Vec<Msg> = req.messages.iter().map(|m| Msg {
        role: match m.role.to_lowercase().as_str() { "user" => "user", "assistant" => "assistant", "system" => "system", _ => "user" },
        content: &m.content,
    }).collect();
    let body = Body {
        model: &model,
        messages: mapped,
        tools: req.tools.as_ref(),
        tool_choice: req.tool_choice.as_ref(),
        stream: false,
    };

    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let client = Client::new();
    let resp = client.post(&url).json(&body).send().await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("provider request failed: {}", e)))?;
    if !resp.status().is_success() {
        return Err((StatusCode::BAD_GATEWAY, format!("provider returned status {}", resp.status())));
    }
    let json_val: serde_json::Value = resp.json().await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("invalid provider json: {}", e)))?;

    // Try common shapes
    let content = json_val.pointer("/message/content")
        .and_then(|v| v.as_str())
        .or_else(|| json_val.get("content").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

    Ok(Json(ChatResponse {
        content,
        model,
        provider: "provider-pass-through".to_string(),
    }))
}

#[axum::debug_handler]
async fn r1_rag(State(_state): State<AppState>, Json(_req): Json<R1RagRequest>) -> Result<Json<R1RagResponse>, (StatusCode, String)> {
    // TODO: Implement R1 RAG pipeline with HTTP client
    Err((StatusCode::NOT_IMPLEMENTED, "R1 RAG pipeline not yet implemented with HTTP client".to_string()))
}

#[derive(Debug, Deserialize)]
struct MemorySearchRequest {
    query: String,
    #[serde(default)]
    k: Option<usize>,
    #[serde(default)]
    semantic_weight: Option<f32>,
}

#[derive(Debug, Serialize)]
struct MemorySearchResponse {
    results: Vec<HybridSearchRow>,
}

async fn memory_search(Json(req): Json<MemorySearchRequest>) -> Result<Json<MemorySearchResponse>, (StatusCode, String)> {
    let provider = RagProvider::from_env(RagProviderConfig::from_env()).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let rows = provider.search(&req.query, req.k.unwrap_or(5), req.semantic_weight.unwrap_or(0.7)).await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;
    Ok(Json(MemorySearchResponse { results: rows }))
}

async fn rag_metrics() -> Json<RagMetrics> {
    let provider = RagProvider::from_env(RagProviderConfig::from_env()).unwrap_or_else(|_| {
        // Return default metrics if provider creation fails
        RagProvider::from_env(RagProviderConfig {
            provider: "fallback".to_string(),
            supabase_url: "".to_string(),
            supabase_key: "".to_string(),
            weaviate_url: "".to_string(),
            ollama_url: "".to_string(),
            embedding_model: "".to_string(),
        }).unwrap()
    });
    let metrics = provider.get_metrics().await;
    Json(metrics)
}

async fn rag_health() -> Json<serde_json::Value> {
    let provider = RagProvider::from_env(RagProviderConfig::from_env()).unwrap_or_else(|_| {
        // Return default provider if creation fails
        RagProvider::from_env(RagProviderConfig {
            provider: "fallback".to_string(),
            supabase_url: "".to_string(),
            supabase_key: "".to_string(),
            weaviate_url: "".to_string(),
            ollama_url: "".to_string(),
            embedding_model: "".to_string(),
        }).unwrap()
    });
    let health = provider.health_check().await;

    let response = serde_json::json!({
        "status": "healthy",
        "providers": health,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });

    Json(response)
}

#[derive(Debug, Serialize)]
struct TokenStatsResponse {
    user_id: String,
    tier: String,
    daily_used: u32,
    daily_limit: u32,
    hourly_used: u32,
    hourly_limit: u32,
    remaining_daily: u32,
    remaining_hourly: u32,
    total_requests: u64,
    average_tokens_per_request: f32,
}

#[derive(Debug, Serialize)]
struct AllTokenStatsResponse {
    users: Vec<TokenStatsResponse>,
    total_users: usize,
}

#[axum::debug_handler]
async fn get_user_token_stats(
    State(_state): State<AppState>,
    axum::extract::Path(user_id): axum::extract::Path<String>,
) -> Result<Json<TokenStatsResponse>, (StatusCode, String)> {
    // TODO: Implement token stats with HTTP client
        Ok(Json(TokenStatsResponse {
        user_id,
        tier: "free".to_string(),
        daily_used: 0,
        daily_limit: 1000,
        hourly_used: 0,
        hourly_limit: 100,
        remaining_daily: 1000,
        remaining_hourly: 100,
        total_requests: 0,
        average_tokens_per_request: 0.0,
    }))
}

#[axum::debug_handler]
async fn get_all_token_stats(
    State(_state): State<AppState>,
) -> Result<Json<AllTokenStatsResponse>, (StatusCode, String)> {
    // TODO: Implement token stats with HTTP client
    Ok(Json(AllTokenStatsResponse {
        users: vec![],
        total_users: 0,
    }))
}

// Memory Management Endpoints
#[axum::debug_handler]
async fn get_user_memory(
    State(state): State<AppState>,
    axum::extract::Path(user_id): axum::extract::Path<String>,
) -> Result<Json<simple_memory::UserMemory>, (StatusCode, String)> {
    match state.memory_manager.get_user_memory(&user_id).await {
        Some(memory) => Ok(Json(memory)),
        None => Err((StatusCode::NOT_FOUND, "User memory not found".to_string())),
    }
}

#[derive(Debug, Deserialize)]
struct MemoryContextRequest {
    user_id: String,
    query: String,
}

#[axum::debug_handler]
async fn get_memory_context(
    State(state): State<AppState>,
    Json(request): Json<MemoryContextRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let context = state.memory_manager.get_context_for_query(&request.user_id, &request.query).await;
    Ok(Json(serde_json::json!({
        "context": context,
        "user_id": request.user_id,
        "query": request.query
    })))
}

// Feedback Endpoints
#[axum::debug_handler]
async fn submit_feedback(
    State(state): State<AppState>,
    Json(feedback): Json<feedback::UserFeedback>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    match state.feedback_manager.submit_feedback(feedback).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "status": "success",
            "message": "Feedback submitted successfully"
        }))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

#[axum::debug_handler]
async fn get_feedback_insights(
    State(state): State<AppState>,
) -> Result<Json<feedback::FeedbackInsights>, (StatusCode, String)> {
    let insights = state.feedback_manager.get_insights().await;
    Ok(Json(insights))
}

// Cache Endpoints
#[axum::debug_handler]
async fn get_cache_stats(
    State(state): State<AppState>,
) -> Result<Json<simple_cache::CacheStats>, (StatusCode, String)> {
    let stats = state.cache.get_stats().await;
    Ok(Json(stats))
}
