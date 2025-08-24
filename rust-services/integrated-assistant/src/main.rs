use anyhow::Result;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use fuzzy_matcher::FuzzyMatcher;
use fuzzy_matcher::skim::SkimMatcherV2;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::{
    collections::HashMap,
    sync::Arc,
    time::Duration,
};
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use uuid::Uuid;

mod learning;
mod automation;
mod workflows;

use learning::{LearningEngine, Pattern, SuccessMetrics};
use automation::{AutomationEngine, TaskCategory};
use workflows::{Workflow, WorkflowEngine};

#[derive(Debug, Clone)]
struct AppState {
    pool: PgPool,
    learning_engine: Arc<LearningEngine>,
    automation_engine: Arc<AutomationEngine>,
    workflow_engine: Arc<WorkflowEngine>,
    task_history: Arc<RwLock<Vec<TaskExecution>>>,
    patterns: Arc<DashMap<String, Pattern>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TaskExecution {
    id: Uuid,
    timestamp: DateTime<Utc>,
    command: String,
    category: TaskCategory,
    success: bool,
    execution_time_ms: u64,
    result: Option<serde_json::Value>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ExecuteRequest {
    command: String,
    #[serde(default)]
    learn: bool,
    #[serde(default)]
    workflow_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
struct ExecuteResponse {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    execution_time_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    learned_pattern: Option<String>,
}

#[derive(Debug, Serialize)]
struct StatsResponse {
    total_executions: usize,
    success_rate: f64,
    learned_patterns: usize,
    saved_workflows: usize,
    categories: HashMap<String, usize>,
    top_patterns: Vec<(String, f64)>,
    average_execution_time_ms: u64,
}

#[derive(Debug, Deserialize)]
struct WorkflowCreateRequest {
    name: String,
    description: Option<String>,
    steps: Vec<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("integrated_assistant=debug,tower_http=debug")
        .init();

    info!("Starting Integrated Assistant (Rust)");

    // Database connection
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:54322/postgres".to_string());
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    // Initialize engines
    let learning_engine = Arc::new(LearningEngine::new(pool.clone()).await?);
    let automation_engine = Arc::new(AutomationEngine::new());
    let workflow_engine = Arc::new(WorkflowEngine::new(pool.clone()).await?);

    // Load existing patterns from database
    let patterns = Arc::new(DashMap::new());
    learning_engine.load_patterns(&patterns).await?;

    let state = AppState {
        pool,
        learning_engine,
        automation_engine,
        workflow_engine,
        task_history: Arc::new(RwLock::new(Vec::new())),
        patterns,
    };

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/execute", post(execute_command))
        .route("/stats", get(get_statistics))
        .route("/workflow/create", post(create_workflow))
        .route("/workflow/execute", post(execute_workflow))
        .route("/workflow/list", get(list_workflows))
        .route("/patterns", get(get_patterns))
        .route("/learn", post(manual_learn))
        .with_state(state);

    let addr = "0.0.0.0:8086";
    info!("Integrated Assistant listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> StatusCode {
    StatusCode::OK
}

async fn execute_command(
    State(state): State<AppState>,
    Json(request): Json<ExecuteRequest>,
) -> Result<Json<ExecuteResponse>, StatusCode> {
    let start = std::time::Instant::now();
    let task_id = Uuid::new_v4();
    
    info!("Executing command: {} (ID: {})", request.command, task_id);

    // Analyze command
    let category = state.automation_engine.categorize_command(&request.command);
    
    // Check for learned patterns
    let pattern_key = hash_command(&request.command);
    let pattern_match = find_pattern_match(&state.patterns, &request.command);
    
    let mut learned_pattern = None;
    
    if let Some(pattern) = pattern_match {
        info!("Using learned pattern with {:.1}% success rate", pattern.success_rate * 100.0);
        learned_pattern = Some(pattern.name.clone());
    }

    // Execute command
    let result = match category {
        TaskCategory::Calendar | TaskCategory::Reminder | TaskCategory::SystemApp => {
            state.automation_engine.execute_system_automation(&request.command).await
        }
        TaskCategory::Database => {
            state.automation_engine.execute_database_operation(&request.command).await
        }
        TaskCategory::Deployment | TaskCategory::Project => {
            state.automation_engine.execute_deployment(&request.command).await
        }
        TaskCategory::General => {
            state.automation_engine.execute_general_query(&request.command).await
        }
    };

    let execution_time_ms = start.elapsed().as_millis() as u64;
    let success = result.is_ok();

    // Record execution
    let task_execution = TaskExecution {
        id: task_id,
        timestamp: Utc::now(),
        command: request.command.clone(),
        category,
        success,
        execution_time_ms,
        result: result.as_ref().ok().cloned(),
        error: result.as_ref().err().map(|e| e.to_string()),
    };

    // Save to history
    state.task_history.write().await.push(task_execution.clone());

    // Learn from execution if enabled
    if request.learn && success {
        if let Err(e) = state.learning_engine.learn_from_execution(
            &request.command,
            &category,
            success,
            execution_time_ms,
        ).await {
            warn!("Failed to save learning data: {}", e);
        }
    }

    // Persist to database periodically
    let history_len = state.task_history.read().await.len();
    if history_len % 10 == 0 {
        if let Err(e) = persist_history(&state).await {
            error!("Failed to persist history: {}", e);
        }
    }

    match result {
        Ok(data) => Ok(Json(ExecuteResponse {
            success: true,
            message: "Command executed successfully".to_string(),
            result: Some(data),
            error: None,
            execution_time_ms,
            learned_pattern,
        })),
        Err(e) => Ok(Json(ExecuteResponse {
            success: false,
            message: "Command execution failed".to_string(),
            result: None,
            error: Some(e.to_string()),
            execution_time_ms,
            learned_pattern: None,
        })),
    }
}

async fn get_statistics(State(state): State<AppState>) -> Result<Json<StatsResponse>, StatusCode> {
    let history = state.task_history.read().await;
    
    let total_executions = history.len();
    let successful = history.iter().filter(|t| t.success).count();
    let success_rate = if total_executions > 0 {
        successful as f64 / total_executions as f64
    } else {
        0.0
    };

    // Category distribution
    let mut categories = HashMap::new();
    for task in history.iter() {
        *categories.entry(format!("{:?}", task.category)).or_insert(0) += 1;
    }

    // Average execution time
    let avg_time = if !history.is_empty() {
        history.iter().map(|t| t.execution_time_ms).sum::<u64>() / history.len() as u64
    } else {
        0
    };

    // Top patterns
    let mut top_patterns: Vec<(String, f64)> = state.patterns
        .iter()
        .map(|entry| (entry.key().clone(), entry.value().success_rate))
        .collect();
    top_patterns.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    top_patterns.truncate(5);

    Ok(Json(StatsResponse {
        total_executions,
        success_rate,
        learned_patterns: state.patterns.len(),
        saved_workflows: state.workflow_engine.count_workflows().await.unwrap_or(0),
        categories,
        top_patterns,
        average_execution_time_ms: avg_time,
    }))
}

async fn create_workflow(
    State(state): State<AppState>,
    Json(request): Json<WorkflowCreateRequest>,
) -> Result<Json<Workflow>, StatusCode> {
    match state.workflow_engine.create_workflow(
        request.name,
        request.description,
        request.steps,
    ).await {
        Ok(workflow) => Ok(Json(workflow)),
        Err(e) => {
            error!("Failed to create workflow: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn execute_workflow(
    State(state): State<AppState>,
    Json(request): Json<ExecuteRequest>,
) -> Result<Json<ExecuteResponse>, StatusCode> {
    let workflow_id = request.workflow_id.ok_or(StatusCode::BAD_REQUEST)?;
    
    match state.workflow_engine.execute_workflow(workflow_id).await {
        Ok(results) => Ok(Json(ExecuteResponse {
            success: true,
            message: format!("Workflow {} executed successfully", workflow_id),
            result: Some(serde_json::json!(results)),
            error: None,
            execution_time_ms: 0, // TODO: Calculate actual time
            learned_pattern: None,
        })),
        Err(e) => Ok(Json(ExecuteResponse {
            success: false,
            message: "Workflow execution failed".to_string(),
            result: None,
            error: Some(e.to_string()),
            execution_time_ms: 0,
            learned_pattern: None,
        })),
    }
}

async fn list_workflows(State(state): State<AppState>) -> Result<Json<Vec<Workflow>>, StatusCode> {
    match state.workflow_engine.list_workflows().await {
        Ok(workflows) => Ok(Json(workflows)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_patterns(State(state): State<AppState>) -> Json<Vec<Pattern>> {
    let patterns: Vec<Pattern> = state.patterns
        .iter()
        .map(|entry| entry.value().clone())
        .collect();
    
    Json(patterns)
}

async fn manual_learn(
    State(state): State<AppState>,
    Json(pattern): Json<Pattern>,
) -> Result<StatusCode, StatusCode> {
    let key = hash_command(&pattern.command);
    state.patterns.insert(key, pattern);
    
    // Persist to database
    if let Err(e) = state.learning_engine.save_patterns(&state.patterns).await {
        error!("Failed to save pattern: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    Ok(StatusCode::CREATED)
}

fn hash_command(command: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(command.to_lowercase().as_bytes());
    hex::encode(hasher.finalize())
}

fn find_pattern_match(patterns: &DashMap<String, Pattern>, command: &str) -> Option<Pattern> {
    let command_hash = hash_command(command);
    
    // Exact match
    if let Some(pattern) = patterns.get(&command_hash) {
        if pattern.success_rate > 0.8 {
            return Some(pattern.clone());
        }
    }
    
    // Fuzzy match
    let matcher = SkimMatcherV2::default();
    let mut best_match = None;
    let mut best_score = 0i64;
    
    for entry in patterns.iter() {
        if let Some(score) = matcher.fuzzy_match(&entry.value().command, command) {
            if score > best_score && entry.value().success_rate > 0.7 {
                best_score = score;
                best_match = Some(entry.value().clone());
            }
        }
    }
    
    best_match
}

async fn persist_history(state: &AppState) -> Result<()> {
    let history = state.task_history.read().await;
    
    for task in history.iter() {
        sqlx::query!(
            r#"
            INSERT INTO task_history (id, timestamp, command, category, success, execution_time_ms, result, error)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
            "#,
            task.id,
            task.timestamp,
            task.command,
            format!("{:?}", task.category),
            task.success,
            task.execution_time_ms as i64,
            task.result,
            task.error
        )
        .execute(&state.pool)
        .await?;
    }
    
    Ok(())
}