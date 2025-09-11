//! Parameter Analytics HTTP Server
//! 
//! High-performance HTTP server for parameter analytics service
//! Provides REST API endpoints for TypeScript integration

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;
use uuid::Uuid;

use parameter_analytics_service::{
    ParameterAnalyticsService, ParameterExecution, EffectivenessFilter, ParameterEffectiveness,
    OptimizationInsight, AnalyticsSnapshot, AnalyticsConfig, HealthStatus, TaskType,
};

#[derive(Clone)]
struct AppState {
    service: Arc<RwLock<ParameterAnalyticsService>>,
}

#[derive(Deserialize)]
struct ExecutionRequest {
    id: String,
    #[serde(rename = "taskType")]
    task_type: String,
    #[serde(rename = "userInput")]
    user_input: String,
    parameters: serde_json::Value,
    model: String,
    provider: String,
    #[serde(rename = "userId")]
    user_id: Option<String>,
    #[serde(rename = "requestId")]
    request_id: String,
    timestamp: String,
    #[serde(rename = "executionTime")]
    execution_time: u64,
    #[serde(rename = "tokenUsage")]
    token_usage: TokenUsageRequest,
    #[serde(rename = "responseLength")]
    response_length: u64,
    #[serde(rename = "responseQuality")]
    response_quality: Option<f64>,
    #[serde(rename = "userSatisfaction")]
    user_satisfaction: Option<f64>,
    success: bool,
    #[serde(rename = "errorType")]
    error_type: Option<String>,
    #[serde(rename = "retryCount")]
    retry_count: u32,
    complexity: String,
    domain: Option<String>,
    endpoint: String,
}

#[derive(Deserialize)]
struct TokenUsageRequest {
    #[serde(rename = "promptTokens")]
    prompt_tokens: u64,
    #[serde(rename = "completionTokens")]
    completion_tokens: u64,
    #[serde(rename = "totalTokens")]
    total_tokens: u64,
}

#[derive(Deserialize)]
struct EffectivenessRequest {
    #[serde(rename = "taskTypes")]
    task_types: Option<Vec<String>>,
    models: Option<Vec<String>>,
    providers: Option<Vec<String>>,
    complexity: Option<Vec<String>>,
    #[serde(rename = "timeRange")]
    time_range: Option<TimeRange>,
    #[serde(rename = "minExecutions")]
    min_executions: Option<u64>,
    #[serde(rename = "minConfidence")]
    min_confidence: Option<f64>,
}

#[derive(Deserialize)]
struct TimeRange {
    start: String,
    end: String,
}

#[derive(Deserialize)]
struct InsightRequest {
    #[serde(rename = "taskType")]
    task_type: String,
}

#[derive(Deserialize)]
struct PerformanceTestRequest {
    #[serde(rename = "testType")]
    test_type: String,
    operations: u64,
    #[serde(rename = "taskType")]
    task_type: String,
}

#[derive(Serialize)]
struct ExecutionResponse {
    processed: bool,
    #[serde(rename = "executionId")]
    execution_id: String,
    #[serde(rename = "processingTime")]
    processing_time: u64,
    #[serde(rename = "trendsUpdated")]
    trends_updated: u32,
}

#[derive(Serialize)]
struct PerformanceTestResponse {
    #[serde(rename = "testType")]
    test_type: String,
    #[serde(rename = "operationsCompleted")]
    operations_completed: u64,
    #[serde(rename = "totalOperations")]
    total_operations: u64,
    #[serde(rename = "durationMs")]
    duration_ms: u64,
    #[serde(rename = "throughputOpsPerSec")]
    throughput_ops_per_sec: f64,
    #[serde(rename = "avgLatencyMs")]
    avg_latency_ms: f64,
    #[serde(rename = "successRate")]
    success_rate: f64,
    timestamp: String,
}

/// Health check endpoint
async fn health_check(State(state): State<AppState>) -> Json<HealthStatus> {
    let service = state.service.read().await;
    let health = service.health_check().await;
    Json(health)
}

/// Process parameter execution
async fn process_execution(
    State(state): State<AppState>,
    Json(request): Json<ExecutionRequest>,
) -> Result<Json<ExecutionResponse>, StatusCode> {
    // Convert request to internal format
    let execution = ParameterExecution {
        id: Uuid::parse_str(&request.id).map_err(|_| StatusCode::BAD_REQUEST)?,
        task_type: parse_task_type(&request.task_type),
        user_input: request.user_input,
        parameters: Default::default(), // Simplified for now
        model: request.model,
        provider: request.provider,
        user_id: request.user_id,
        request_id: request.request_id,
        timestamp: chrono::Utc::now(), // Use current time for simplicity
        execution_time: request.execution_time,
        token_usage: parameter_analytics_service::types::TokenUsage {
            prompt_tokens: request.token_usage.prompt_tokens as u32,
            completion_tokens: request.token_usage.completion_tokens as u32,
            total_tokens: request.token_usage.total_tokens as u32,
        },
        response_length: request.response_length as u32,
        response_quality: request.response_quality,
        user_satisfaction: request.user_satisfaction,
        success: request.success,
        error_type: request.error_type,
        retry_count: request.retry_count,
        complexity: parse_complexity(&request.complexity),
        domain: request.domain,
        endpoint: request.endpoint,
    };

    let service = state.service.write().await;
    match service.process_execution(execution).await {
        Ok(result) => Ok(Json(ExecutionResponse {
            processed: result.processed,
            execution_id: result.execution_id.to_string(),
            processing_time: result.processing_time,
            trends_updated: result.trends_updated,
        })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get effectiveness metrics
async fn get_effectiveness(
    State(state): State<AppState>,
    Json(request): Json<EffectivenessRequest>,
) -> Result<Json<Vec<ParameterEffectiveness>>, StatusCode> {
    let filter = EffectivenessFilter {
        task_types: request.task_types.map(|types| types.into_iter().map(|t| parse_task_type(&t)).collect()),
        models: request.models,
        providers: request.providers,
        complexity: request.complexity.map(|c| c.into_iter().map(|comp| parse_complexity(&comp)).collect()),
        time_range: request.time_range.map(|_range| (
            chrono::Utc::now(), // Simplified
            chrono::Utc::now(),
        )),
        min_executions: request.min_executions,
        min_confidence: request.min_confidence,
    };

    let service = state.service.read().await;
    match service.get_effectiveness(filter).await {
        Ok(effectiveness) => Ok(Json(effectiveness)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Generate optimization insights
async fn generate_insights(
    State(state): State<AppState>,
    Json(request): Json<InsightRequest>,
) -> Result<Json<Vec<OptimizationInsight>>, StatusCode> {
    let task_type = parse_task_type(&request.task_type);

    let service = state.service.write().await;
    match service.generate_insights(task_type).await {
        Ok(insights) => Ok(Json(insights)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Get real-time analytics
async fn get_analytics(State(state): State<AppState>) -> Result<Json<AnalyticsSnapshot>, StatusCode> {
    let service = state.service.read().await;
    match service.get_analytics().await {
        Ok(analytics) => Ok(Json(analytics)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Performance test endpoint
async fn performance_test(
    State(state): State<AppState>,
    Json(request): Json<PerformanceTestRequest>,
) -> Result<Json<PerformanceTestResponse>, StatusCode> {
    let start_time = std::time::Instant::now();
    
    // Simulate processing operations
    let mut total_processed = 0;
    for _ in 0..request.operations {
        // Simulate some computational work
        let _: Vec<u64> = (0..1000).collect();
        total_processed += 1;
    }
    
    let duration = start_time.elapsed();
    let duration_ms = duration.as_millis() as u64;
    let throughput = request.operations as f64 / duration.as_secs_f64();
    let avg_latency = duration.as_millis() as f64 / request.operations as f64;

    Ok(Json(PerformanceTestResponse {
        test_type: request.test_type,
        operations_completed: total_processed,
        total_operations: request.operations,
        duration_ms,
        throughput_ops_per_sec: throughput,
        avg_latency_ms: avg_latency,
        success_rate: 1.0,
        timestamp: chrono::Utc::now().to_rfc3339(),
    }))
}

/// Get service statistics
async fn get_stats(State(state): State<AppState>) -> Json<HashMap<String, serde_json::Value>> {
    let mut stats = HashMap::new();
    
    let health = {
        let service = state.service.read().await;
        service.health_check().await
    };
    
    stats.insert("service_status".to_string(), serde_json::json!(if health.healthy { "operational" } else { "degraded" }));
    stats.insert("total_processed".to_string(), serde_json::json!(health.total_processed));
    stats.insert("processing_queue_size".to_string(), serde_json::json!(health.processing_queue_size));
    stats.insert("cache_connected".to_string(), serde_json::json!(health.cache_connected));
    stats.insert("database_connected".to_string(), serde_json::json!(health.database_connected));
    stats.insert("uptime".to_string(), serde_json::json!("healthy"));
    stats.insert("rust_processing_available".to_string(), serde_json::json!(true));
    
    Json(stats)
}

/// Get service version
async fn get_version() -> Json<HashMap<String, String>> {
    let mut version = HashMap::new();
    version.insert("service".to_string(), "parameter-analytics-service".to_string());
    version.insert("version".to_string(), "0.1.0".to_string());
    version.insert("build_time".to_string(), chrono::Utc::now().to_rfc3339());
    version.insert("rust_version".to_string(), "1.75.0".to_string());
    Json(version)
}

fn parse_task_type(task_type: &str) -> TaskType {
    match task_type.to_lowercase().as_str() {
        "code_generation" => TaskType::CodeGeneration,
        "text_generation" => TaskType::ContentGeneration,
        "analysis" => TaskType::DataAnalysis,
        "reasoning" => TaskType::Reasoning,
        "creative" => TaskType::CreativeWriting,
        "text_analysis" => TaskType::TextAnalysis,
        "document_analysis" => TaskType::DocumentAnalysis,
        "research" => TaskType::Research,
        "factual_qa" => TaskType::FactualQa,
        "explanation" => TaskType::Explanation,
        "tutorial" => TaskType::Tutorial,
        "casual_chat" => TaskType::CasualChat,
        "translation" => TaskType::Translation,
        "summarization" => TaskType::Summarization,
        "classification" => TaskType::Classification,
        "extraction" => TaskType::Extraction,
        _ => TaskType::ContentGeneration,
    }
}

fn parse_complexity(complexity: &str) -> parameter_analytics_service::types::Complexity {
    match complexity.to_lowercase().as_str() {
        "simple" => parameter_analytics_service::types::Complexity::Simple,
        "complex" => parameter_analytics_service::types::Complexity::Complex,
        _ => parameter_analytics_service::types::Complexity::Medium,
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    info!("🚀 Starting Parameter Analytics HTTP Server");

    // Initialize service
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await
        .map_err(|e| format!("Failed to initialize service: {}", e))?;
    
    let state = AppState {
        service: Arc::new(RwLock::new(service)),
    };

    // Build our application with routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/execution", post(process_execution))
        .route("/effectiveness", post(get_effectiveness))
        .route("/insights", post(generate_insights))
        .route("/analytics", get(get_analytics))
        .route("/performance-test", post(performance_test))
        .route("/stats", get(get_stats))
        .route("/version", get(get_version))
        .with_state(state)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(
                    CorsLayer::new()
                        .allow_origin(Any)
                        .allow_headers(Any)
                        .allow_methods(Any),
                ),
        );

    // Run the server
    let port = std::env::var("PORT").unwrap_or_else(|_| "8028".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    info!("✅ Parameter Analytics HTTP Server listening on {}", addr);
    info!("📊 Endpoints available:");
    info!("   • GET  /health - Service health check");
    info!("   • POST /execution - Process parameter execution");
    info!("   • POST /effectiveness - Get effectiveness metrics");
    info!("   • POST /insights - Generate optimization insights");
    info!("   • GET  /analytics - Get real-time analytics");
    info!("   • POST /performance-test - Run performance test");
    info!("   • GET  /stats - Get service statistics");
    info!("   • GET  /version - Get service version");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}