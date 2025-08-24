use anyhow::{Context, Result};
use axum::{
    extract::{Query, State},
    response::Json,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc, Timelike};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use sysinfo::System;
use tokio::{sync::RwLock, time::interval};
use tower_http::cors::CorsLayer;
use tracing::{debug, error, info, warn, instrument};

mod config;
mod context_monitor;
mod suggestion_engine;
mod hrm_reasoning;

use config::ProactiveConfig;
use context_monitor::ContextMonitor;
use suggestion_engine::SuggestionEngine;
use hrm_reasoning::HRMReasoningEngine;

/// Proactive suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    pub id: String,
    pub suggestion_type: String,
    pub title: String,
    pub description: String,
    pub confidence: f32,
    pub priority: i32,
    pub context: HashMap<String, serde_json::Value>,
    pub actions: Vec<SuggestedAction>,
    pub generated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Suggested action that can be taken
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestedAction {
    pub action_id: String,
    pub action_type: String,
    pub description: String,
    pub parameters: HashMap<String, serde_json::Value>,
}

/// System context state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemContext {
    pub timestamp: DateTime<Utc>,
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub active_applications: Vec<String>,
    pub calendar_events: Vec<CalendarEvent>,
    pub user_activity_level: String, // "active", "idle", "away"
    pub time_of_day: String, // "morning", "afternoon", "evening", "night"
    pub current_tasks: Vec<String>,
}

/// Calendar event information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub title: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub participants: Vec<String>,
}

/// Proactive suggestion request
#[derive(Debug, Deserialize)]
pub struct SuggestionRequest {
    pub user_id: Option<String>,
    pub context_hint: Option<String>,
    pub limit: Option<usize>,
}

/// Health response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub proactive_engine: bool,
    pub context_monitor: bool,
    pub suggestion_engine: bool,
    pub database_connected: bool,
    pub uptime_seconds: u64,
    pub suggestions_generated: u64,
}

/// Service metrics
pub struct ProactiveMetrics {
    pub total_suggestions: AtomicU64,
    pub successful_suggestions: AtomicU64,
    pub context_updates: AtomicU64,
    pub system_scans: AtomicU64,
    pub uptime: Instant,
}

impl ProactiveMetrics {
    pub fn new() -> Self {
        Self {
            total_suggestions: AtomicU64::new(0),
            successful_suggestions: AtomicU64::new(0),
            context_updates: AtomicU64::new(0),
            system_scans: AtomicU64::new(0),
            uptime: Instant::now(),
        }
    }

    pub fn record_suggestion(&self, successful: bool) {
        self.total_suggestions.fetch_add(1, Ordering::Relaxed);
        if successful {
            self.successful_suggestions.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn record_context_update(&self) {
        self.context_updates.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_system_scan(&self) {
        self.system_scans.fetch_add(1, Ordering::Relaxed);
    }
}

/// Main application state
#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub context_monitor: ContextMonitor,
    pub suggestion_engine: SuggestionEngine,
    pub hrm_reasoning: HRMReasoningEngine,
    pub metrics: Arc<ProactiveMetrics>,
    pub config: ProactiveConfig,
    pub current_context: Arc<RwLock<SystemContext>>,
    pub active_suggestions: Arc<RwLock<Vec<Suggestion>>>,
}

impl AppState {
    pub async fn new(config: ProactiveConfig) -> Result<Self> {
        info!("🔧 Initializing Proactive Engine");

        // Connect to database
        let db_pool = sqlx::PgPool::connect(&config.database_url)
            .await
            .context("Failed to connect to database")?;

        // Test database connection
        sqlx::query("SELECT 1").fetch_one(&db_pool).await
            .context("Database health check failed")?;

        info!("✅ Connected to PostgreSQL database");

        // Initialize components
        let context_monitor = ContextMonitor::new(&config).await?;
        let suggestion_engine = SuggestionEngine::new(&config, db_pool.clone()).await?;
        let hrm_reasoning = HRMReasoningEngine::new(&config).await?;
        let metrics = Arc::new(ProactiveMetrics::new());

        let initial_context = SystemContext {
            timestamp: Utc::now(),
            cpu_usage: 0.0,
            memory_usage: 0.0,
            active_applications: vec![],
            calendar_events: vec![],
            user_activity_level: "unknown".to_string(),
            time_of_day: "unknown".to_string(),
            current_tasks: vec![],
        };

        Ok(Self {
            db_pool,
            context_monitor,
            suggestion_engine,
            hrm_reasoning,
            metrics,
            config,
            current_context: Arc::new(RwLock::new(initial_context)),
            active_suggestions: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Start background monitoring tasks
    pub async fn start_background_tasks(&self) {
        let state = self.clone();
        
        // Context monitoring task
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(30)); // Every 30 seconds
            
            loop {
                interval.tick().await;
                
                if let Err(e) = state.update_system_context().await {
                    error!("Failed to update system context: {}", e);
                }
            }
        });

        let state = self.clone();
        
        // Suggestion generation task
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(120)); // Every 2 minutes
            
            loop {
                interval.tick().await;
                
                if let Err(e) = state.generate_proactive_suggestions().await {
                    error!("Failed to generate proactive suggestions: {}", e);
                }
            }
        });

        let state = self.clone();
        
        // Cleanup expired suggestions task
        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(300)); // Every 5 minutes
            
            loop {
                interval.tick().await;
                
                state.cleanup_expired_suggestions().await;
            }
        });

        info!("🚀 Background monitoring tasks started");
    }

    /// Update system context with current state
    async fn update_system_context(&self) -> Result<()> {
        debug!("🔄 Updating system context");

        let mut system = System::new_all();
        system.refresh_all();

        // Get CPU usage
        let cpu_usage = system.global_cpu_usage();

        // Get memory usage
        let memory_usage = (system.used_memory() as f32 / system.total_memory() as f32) * 100.0;

        // Get active applications
        let active_apps: Vec<String> = system
            .processes()
            .values()
            .filter(|process| process.cpu_usage() > 1.0) // Processes using more than 1% CPU
            .map(|process| process.name().to_string_lossy().to_string())
            .take(10)
            .collect();

        // Determine time of day
        let hour = Utc::now().hour();
        let time_of_day = match hour {
            5..=11 => "morning",
            12..=17 => "afternoon", 
            18..=22 => "evening",
            _ => "night",
        }.to_string();

        // Determine activity level based on CPU usage
        let user_activity_level = match cpu_usage as u32 {
            0..=10 => "idle",
            11..=50 => "active", 
            _ => "busy",
        }.to_string();

        let context = SystemContext {
            timestamp: Utc::now(),
            cpu_usage,
            memory_usage,
            active_applications: active_apps,
            calendar_events: vec![], // TODO: Integrate with calendar
            user_activity_level,
            time_of_day,
            current_tasks: vec![], // TODO: Integrate with task tracking
        };

        // Update current context
        {
            let mut current_context = self.current_context.write().await;
            *current_context = context;
        }

        self.metrics.record_context_update();
        self.metrics.record_system_scan();

        Ok(())
    }

    /// Generate proactive suggestions based on current context
    async fn generate_proactive_suggestions(&self) -> Result<()> {
        debug!("🧠 Generating proactive suggestions");

        let context = {
            let context = self.current_context.read().await;
            context.clone()
        };

        let raw_suggestions = self.suggestion_engine.generate_suggestions(&context).await?;

        if !raw_suggestions.is_empty() {
            info!("💡 Generated {} raw suggestions, applying HRM reasoning...", raw_suggestions.len());
            
            // Apply HRM reasoning to enhance suggestions
            let mut enhanced_suggestions = Vec::new();
            for suggestion in raw_suggestions {
                match self.hrm_reasoning.reason_about_suggestion(&suggestion, &context).await {
                    Ok(reasoned) => {
                        info!("🧠 Enhanced '{}' with reasoning - confidence: {:.2} → {:.2}", 
                              suggestion.title, suggestion.confidence, reasoned.base_suggestion.confidence);
                        enhanced_suggestions.push(reasoned.base_suggestion);
                    }
                    Err(e) => {
                        warn!("Failed to apply reasoning to suggestion '{}': {}", suggestion.title, e);
                        enhanced_suggestions.push(suggestion); // Fallback to original
                    }
                }
            }
            
            info!("✨ Applied HRM reasoning to {} suggestions", enhanced_suggestions.len());
            
            // Store enhanced suggestions in database for persistence first
            for suggestion in &enhanced_suggestions {
                if let Err(e) = self.store_suggestion(suggestion).await {
                    warn!("Failed to store enhanced suggestion: {}", e);
                }
            }
            
            // Add to active suggestions
            {
                let mut active = self.active_suggestions.write().await;
                active.extend(enhanced_suggestions);
                
                // Limit to 10 most recent suggestions
                if active.len() > 10 {
                    active.truncate(10);
                }
            }

            self.metrics.record_suggestion(true);
        }

        Ok(())
    }

    /// Store suggestion in database
    async fn store_suggestion(&self, suggestion: &Suggestion) -> Result<()> {
        let context_json = serde_json::to_value(&suggestion.context)?;
        let actions_json = serde_json::to_value(&suggestion.actions)?;

        sqlx::query(
            r#"
            INSERT INTO proactive_suggestions (
                id, suggestion_type, title, description, confidence, priority,
                context, actions, generated_at, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#
        )
        .bind(&suggestion.id)
        .bind(&suggestion.suggestion_type)
        .bind(&suggestion.title)
        .bind(&suggestion.description)
        .bind(suggestion.confidence)
        .bind(suggestion.priority)
        .bind(context_json)
        .bind(actions_json)
        .bind(suggestion.generated_at)
        .bind(suggestion.expires_at)
        .execute(&self.db_pool)
        .await?;

        Ok(())
    }

    /// Clean up expired suggestions
    async fn cleanup_expired_suggestions(&self) {
        let now = Utc::now();
        
        // Remove from active suggestions
        {
            let mut active = self.active_suggestions.write().await;
            active.retain(|s| s.expires_at.map_or(true, |exp| exp > now));
        }

        // Remove from database
        if let Err(e) = sqlx::query(
            "DELETE FROM proactive_suggestions WHERE expires_at < $1"
        )
        .bind(now)
        .execute(&self.db_pool)
        .await {
            warn!("Failed to cleanup expired suggestions: {}", e);
        }
    }
}

/// HTTP Handlers

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let database_connected = sqlx::query("SELECT 1")
        .fetch_one(&state.db_pool)
        .await
        .is_ok();

    Json(HealthResponse {
        status: "healthy".to_string(),
        proactive_engine: true,
        context_monitor: state.context_monitor.is_healthy().await,
        suggestion_engine: state.suggestion_engine.is_healthy().await,
        database_connected,
        uptime_seconds: state.metrics.uptime.elapsed().as_secs(),
        suggestions_generated: state.metrics.total_suggestions.load(Ordering::Relaxed),
    })
}

/// Get current system context
#[instrument(skip(state))]
async fn get_context(State(state): State<AppState>) -> Json<SystemContext> {
    let context = state.current_context.read().await;
    Json(context.clone())
}

/// Get active suggestions
#[instrument(skip(state))]
async fn get_suggestions(
    State(state): State<AppState>,
    Query(params): Query<SuggestionRequest>,
) -> Json<Vec<Suggestion>> {
    let active_suggestions = state.active_suggestions.read().await;
    let mut suggestions = active_suggestions.clone();

    // Apply limit
    if let Some(limit) = params.limit {
        suggestions.truncate(limit);
    }

    Json(suggestions)
}

/// Get HRM reasoning statistics
#[instrument(skip(state))]
async fn get_hrm_statistics(State(state): State<AppState>) -> Json<serde_json::Value> {
    let stats = state.hrm_reasoning.get_reasoning_statistics();
    Json(serde_json::to_value(stats).unwrap_or(serde_json::json!({})))
}

/// Create database tables
async fn create_tables(pool: &PgPool) -> Result<()> {
    sqlx::query!(
        r#"
        CREATE TABLE IF NOT EXISTS proactive_suggestions (
            id VARCHAR PRIMARY KEY,
            suggestion_type VARCHAR NOT NULL,
            title VARCHAR NOT NULL,
            description TEXT NOT NULL,
            confidence REAL NOT NULL,
            priority INTEGER NOT NULL,
            context JSONB DEFAULT '{}',
            actions JSONB DEFAULT '[]',
            generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query!(
        "CREATE INDEX IF NOT EXISTS idx_suggestions_generated_at ON proactive_suggestions(generated_at)"
    )
    .execute(pool)
    .await?;

    sqlx::query!(
        "CREATE INDEX IF NOT EXISTS idx_suggestions_expires_at ON proactive_suggestions(expires_at)"
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "proactive_engine=info".into()),
        )
        .init();

    info!("🚀 Starting Proactive Engine Service");

    // Load configuration
    let config = ProactiveConfig::load()
        .context("Failed to load configuration")?;

    // Create database tables
    let db_pool = sqlx::PgPool::connect(&config.database_url)
        .await
        .context("Failed to connect to database")?;
    
    create_tables(&db_pool).await
        .context("Failed to create database tables")?;

    // Initialize application state
    let app_state = AppState::new(config.clone()).await
        .context("Failed to initialize application state")?;

    // Start background monitoring
    app_state.start_background_tasks().await;

    // Create router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/context", get(get_context))
        .route("/suggestions", get(get_suggestions))
        .route("/hrm-stats", get(get_hrm_statistics))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start server
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], config.server.port));
    info!("🌟 Proactive Engine listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .context("Failed to bind to address")?;
    
    axum::serve(listener, app)
        .await
        .context("Server error")?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_metrics() {
        let metrics = ProactiveMetrics::new();
        metrics.record_suggestion(true);
        metrics.record_context_update();
        
        assert_eq!(metrics.total_suggestions.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.successful_suggestions.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.context_updates.load(Ordering::Relaxed), 1);
    }
}