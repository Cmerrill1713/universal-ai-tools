use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

mod config;
mod documentation_engine;
mod code_analyzer;
mod template_generator;
mod export_manager;

use config::Config;
use documentation_engine::DocumentationEngine;
use code_analyzer::CodeAnalyzer;
use template_generator::TemplateGenerator;
use export_manager::ExportManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationRequest {
    pub project_path: String,
    pub output_format: OutputFormat,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub documentation_type: DocumentationType,
    pub template_style: TemplateStyle,
    pub include_private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OutputFormat {
    #[serde(rename = "markdown")]
    Markdown,
    #[serde(rename = "html")]
    Html,
    #[serde(rename = "pdf")]
    Pdf,
    #[serde(rename = "confluence")]
    Confluence,
    #[serde(rename = "docx")]
    Docx,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DocumentationType {
    #[serde(rename = "api")]
    Api,
    #[serde(rename = "architecture")]
    Architecture,
    #[serde(rename = "user_guide")]
    UserGuide,
    #[serde(rename = "developer_guide")]
    DeveloperGuide,
    #[serde(rename = "reference")]
    Reference,
    #[serde(rename = "comprehensive")]
    Comprehensive,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TemplateStyle {
    #[serde(rename = "modern")]
    Modern,
    #[serde(rename = "classic")]
    Classic,
    #[serde(rename = "minimal")]
    Minimal,
    #[serde(rename = "technical")]
    Technical,
    #[serde(rename = "corporate")]
    Corporate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationResponse {
    pub generation_id: String,
    pub status: GenerationStatus,
    pub output_path: Option<String>,
    pub progress: f64,
    pub estimated_completion: Option<chrono::DateTime<chrono::Utc>>,
    pub file_count: u32,
    pub total_lines: u32,
    pub documentation_sections: Vec<DocumentationSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum GenerationStatus {
    #[serde(rename = "queued")]
    Queued,
    #[serde(rename = "analyzing")]
    Analyzing,
    #[serde(rename = "generating")]
    Generating,
    #[serde(rename = "formatting")]
    Formatting,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationSection {
    pub title: String,
    pub content_type: String,
    pub word_count: u32,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAnalysis {
    pub project_name: String,
    pub languages: HashMap<String, LanguageStats>,
    pub architecture_overview: ArchitectureInfo,
    pub api_endpoints: Vec<ApiEndpoint>,
    pub dependencies: Vec<DependencyInfo>,
    pub complexity_metrics: ComplexityMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageStats {
    pub file_count: u32,
    pub line_count: u32,
    pub percentage: f64,
    pub complexity_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureInfo {
    pub pattern: String,
    pub layers: Vec<String>,
    pub components: Vec<ComponentInfo>,
    pub data_flow: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentInfo {
    pub name: String,
    pub component_type: String,
    pub responsibilities: Vec<String>,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiEndpoint {
    pub method: String,
    pub path: String,
    pub description: String,
    pub parameters: Vec<ApiParameter>,
    pub responses: Vec<ApiResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiParameter {
    pub name: String,
    pub param_type: String,
    pub required: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse {
    pub status_code: u16,
    pub description: String,
    pub content_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyInfo {
    pub name: String,
    pub version: String,
    pub dependency_type: String,
    pub license: Option<String>,
    pub security_vulnerabilities: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplexityMetrics {
    pub cyclomatic_complexity: f64,
    pub cognitive_complexity: f64,
    pub maintainability_index: f64,
    pub technical_debt_ratio: f64,
}

#[derive(Clone)]
struct AppState {
    config: Config,
    documentation_engine: Arc<DocumentationEngine>,
    code_analyzer: Arc<CodeAnalyzer>,
    template_generator: Arc<TemplateGenerator>,
    export_manager: Arc<RwLock<ExportManager>>,
    active_generations: Arc<RwLock<HashMap<String, DocumentationResponse>>>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .init();

    info!("🚀 Starting Documentation Generation Service");

    // Load configuration
    let config = Config::new().await?;
    info!("Configuration loaded successfully");

    // Initialize components
    let documentation_engine = Arc::new(DocumentationEngine::new(&config).await?);
    let code_analyzer = Arc::new(CodeAnalyzer::new(&config).await?);
    let template_generator = Arc::new(TemplateGenerator::new(&config).await?);
    let export_manager = Arc::new(RwLock::new(ExportManager::new(&config).await?));
    let active_generations = Arc::new(RwLock::new(HashMap::new()));

    let app_state = AppState {
        config: config.clone(),
        documentation_engine,
        code_analyzer,
        template_generator,
        export_manager,
        active_generations,
    };

    info!("📚 Documentation generation components initialized");

    // Start background tasks
    start_background_tasks(app_state.clone()).await;

    // Build the router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/documentation/generate", post(generate_documentation))
        .route("/api/documentation/status/:id", get(get_generation_status))
        .route("/api/documentation/history", get(get_generation_history))
        .route("/api/analysis/project", post(analyze_project))
        .route("/api/templates/list", get(list_templates))
        .route("/api/templates/create", post(create_custom_template))
        .route("/api/export/formats", get(get_supported_formats))
        .route("/api/export/download/:id", get(download_documentation))
        .route("/api/preview/:id", get(preview_documentation))
        .with_state(app_state);

    info!("📊 Background documentation tasks started");

    let addr = format!("{}:{}", config.server.host, config.server.port);
    info!("🌐 Documentation Generation Service starting on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn start_background_tasks(state: AppState) {
    // Start documentation queue processing task
    let queue_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            if let Err(e) = queue_state.documentation_engine.process_queue().await {
                error!("Documentation queue processing error: {}", e);
            }
        }
    });

    // Start template cache refresh task
    let template_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
        loop {
            interval.tick().await;
            if let Err(e) = template_state.template_generator.refresh_templates().await {
                error!("Template refresh error: {}", e);
            }
        }
    });

    // Start cleanup task for old generations
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(3600)); // 1 hour
        loop {
            interval.tick().await;
            cleanup_state.cleanup_old_generations().await;
        }
    });
}

impl AppState {
    async fn cleanup_old_generations(&self) {
        let mut generations = self.active_generations.write().await;
        let cutoff = chrono::Utc::now() - chrono::Duration::hours(24);
        
        generations.retain(|_id, response| {
            if let Some(completion_time) = response.estimated_completion {
                completion_time > cutoff
            } else {
                true // Keep ongoing generations
            }
        });
    }
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "Documentation Generation Service",
        "timestamp": chrono::Utc::now(),
        "version": "1.0.0",
        "components": {
            "documentation_engine": "operational",
            "code_analyzer": "operational",
            "template_generator": "operational",
            "export_manager": "operational"
        }
    }))
}

async fn generate_documentation(
    State(state): State<AppState>,
    Json(request): Json<DocumentationRequest>,
) -> Result<Json<DocumentationResponse>, StatusCode> {
    let generation_id = Uuid::new_v4().to_string();
    
    info!("📝 Starting documentation generation: {} for project: {}", generation_id, request.project_path);

    match state.documentation_engine.start_generation(&generation_id, &request).await {
        Ok(response) => {
            // Store in active generations
            let mut generations = state.active_generations.write().await;
            generations.insert(generation_id, response.clone());
            
            Ok(Json(response))
        },
        Err(e) => {
            error!("Documentation generation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_generation_status(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<DocumentationResponse>, StatusCode> {
    let generations = state.active_generations.read().await;
    match generations.get(&id) {
        Some(status) => Ok(Json(status.clone())),
        None => {
            warn!("Documentation generation status not found for ID: {}", id);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

async fn get_generation_history(
    State(state): State<AppState>,
) -> Result<Json<Vec<DocumentationResponse>>, StatusCode> {
    let generations = state.active_generations.read().await;
    let history: Vec<DocumentationResponse> = generations.values().cloned().collect();
    Ok(Json(history))
}

async fn analyze_project(
    State(state): State<AppState>,
    Json(request): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<ProjectAnalysis>, StatusCode> {
    let project_path = request.get("project_path")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;

    match state.code_analyzer.analyze_project(project_path).await {
        Ok(analysis) => Ok(Json(analysis)),
        Err(e) => {
            error!("Project analysis failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn list_templates(
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    match state.template_generator.list_available_templates().await {
        Ok(templates) => Ok(Json(templates)),
        Err(e) => {
            error!("Error listing templates: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn create_custom_template(
    State(state): State<AppState>,
    Json(request): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.template_generator.create_custom_template(&request).await {
        Ok(template) => Ok(Json(template)),
        Err(e) => {
            error!("Custom template creation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_supported_formats() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "formats": [
            {
                "name": "markdown",
                "extension": ".md",
                "description": "GitHub-flavored Markdown with syntax highlighting"
            },
            {
                "name": "html",
                "extension": ".html",
                "description": "Interactive HTML documentation with search"
            },
            {
                "name": "pdf",
                "extension": ".pdf",
                "description": "Professional PDF documentation"
            },
            {
                "name": "confluence",
                "extension": ".json",
                "description": "Confluence wiki format for export"
            },
            {
                "name": "docx",
                "extension": ".docx",
                "description": "Microsoft Word document format"
            }
        ]
    }))
}

async fn download_documentation(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.export_manager.write().await.get_download_info(&id).await {
        Ok(download_info) => Ok(Json(download_info)),
        Err(e) => {
            error!("Download preparation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn preview_documentation(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.documentation_engine.get_preview(&id).await {
        Ok(preview) => Ok(Json(preview)),
        Err(e) => {
            error!("Preview generation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}