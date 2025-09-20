use std::{sync::Arc, time::Duration};

use anyhow::Result;
use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use once_cell::sync::OnceCell;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{error, info};
use url::Url;

#[derive(Clone)]
struct AppState {
    client: Client,
    services: Arc<RwLock<ServiceRegistry>>, 
}

#[derive(Clone, Debug, Serialize)]
struct HealthReport {
    status: &'static str,
    context_selected: Option<String>,
    gateway_selected: Option<String>,
    context_candidates: Vec<ServiceStatus>,
    gateway_candidates: Vec<ServiceStatus>,
}

#[derive(Clone, Debug, Serialize)]
struct ServiceStatus {
    url: String,
    healthy: bool,
    code: u16,
}

static STARTED: OnceCell<()> = OnceCell::new();

#[derive(Clone, Debug)]
struct ServiceRegistry {
    knowledge_context: Vec<String>,
    knowledge_gateway: Vec<String>,
    selected_context: Option<String>,
    selected_gateway: Option<String>,
}

impl ServiceRegistry {
    fn from_env() -> Self {
        let ctx = std::env::var("KNOWLEDGE_CONTEXT_URLS")
            .unwrap_or_else(|_| "http://localhost:8091,http://localhost:8083".to_string());
        let gw = std::env::var("KNOWLEDGE_GATEWAY_URLS")
            .unwrap_or_else(|_| "http://localhost:8088".to_string());
        Self {
            knowledge_context: ctx.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            knowledge_gateway: gw.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            selected_context: None,
            selected_gateway: None,
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    if STARTED.set(()).is_err() {}
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let state = AppState {
        client: Client::builder().timeout(Duration::from_secs(4)).build()?,
        services: Arc::new(RwLock::new(ServiceRegistry::from_env())),
    };

    // Initial probe
    refresh_selection(&state).await;

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/context/build", post(context_build))
        .route("/api/v1/knowledge/search", post(knowledge_search))
        .with_state(state.clone());

    let port: u16 = std::env::var("LIBRARIAN_COORDINATOR_PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(8055);
    info!("librarian-coordinator listening on :{}", port);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health(State(state): State<AppState>) -> Json<HealthReport> {
    let (ctx_status, gw_status, selected_ctx, selected_gw) = probe_all(&state).await;
    Json(HealthReport {
        status: "healthy",
        context_selected: selected_ctx,
        gateway_selected: selected_gw,
        context_candidates: ctx_status,
        gateway_candidates: gw_status,
    })
}

#[derive(Deserialize)]
struct ContextBuildReq { message: String, #[serde(default)] limit: Option<u32>, #[serde(default)] filters: Option<serde_json::Value> }

async fn context_build(State(state): State<AppState>, Json(body): Json<ContextBuildReq>) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let selected = refresh_selection(&state).await;
    let Some(base) = selected.0 else { return Err((StatusCode::SERVICE_UNAVAILABLE, "no context service available".into())); };
    let url = format!("{}/api/v1/context/build", trim_slash(&base));
    let payload = serde_json::json!({"message": body.message, "limit": body.limit.unwrap_or(5), "filters": body.filters});
    forward_json(&state.client, &url, &payload).await
}

#[derive(Deserialize)]
struct KnowledgeSearchReq { query: String, #[serde(default)] limit: Option<u32>, #[serde(default)] filters: Option<serde_json::Value> }

async fn knowledge_search(State(state): State<AppState>, Json(body): Json<KnowledgeSearchReq>) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let selected = refresh_selection(&state).await;
    let Some(base) = selected.1 else { return Err((StatusCode::SERVICE_UNAVAILABLE, "no knowledge gateway available".into())); };
    let url = format!("{}/api/v1/search", trim_slash(&base));
    let payload = serde_json::json!({"query": body.query, "limit": body.limit.unwrap_or(10), "filters": body.filters});
    forward_json(&state.client, &url, &payload).await
}

async fn forward_json(client: &Client, url: &str, payload: &serde_json::Value) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    match client.post(url).json(payload).send().await {
        Ok(resp) => {
            let code = resp.status();
            let txt = resp.text().await.unwrap_or_else(|_| "{}".into());
            if !code.is_success() {
                error!("upstream error {} {}", code, url);
                return Err((StatusCode::BAD_GATEWAY, format!("upstream {}", code))); 
            }
            match serde_json::from_str::<serde_json::Value>(&txt) {
                Ok(v) => Ok(Json(v)),
                Err(_) => Ok(Json(serde_json::json!({"raw": txt}))),
            }
        }
        Err(e) => {
            error!("forward_json request failed {}: {}", url, e);
            Err((StatusCode::BAD_GATEWAY, format!("request failed: {}", e)))
        }
    }
}

fn trim_slash(s: &str) -> String { s.trim_end_matches('/').to_string() }

async fn refresh_selection(state: &AppState) -> (Option<String>, Option<String>) {
    let (ctxs, gws, _, _) = probe_all(state).await;
    let mut svc = state.services.write().await;
    svc.selected_context = ctxs.iter().find(|s| s.healthy).map(|s| s.url.clone());
    svc.selected_gateway = gws.iter().find(|s| s.healthy).map(|s| s.url.clone());
    (svc.selected_context.clone(), svc.selected_gateway.clone())
}

async fn probe_all(state: &AppState) -> (Vec<ServiceStatus>, Vec<ServiceStatus>, Option<String>, Option<String>) {
    let svc = state.services.read().await.clone();
    let ctxs = probe_list(&state.client, &svc.knowledge_context, "/health").await;
    let gws = probe_list(&state.client, &svc.knowledge_gateway, "/health").await;
    (ctxs, gws, svc.selected_context.clone(), svc.selected_gateway.clone())
}

async fn probe_list(client: &Client, list: &[String], path: &str) -> Vec<ServiceStatus> {
    let mut out = Vec::new();
    for base in list {
        let url = join(base, path);
        let (healthy, code) = match client.get(&url).send().await {
            Ok(resp) => (resp.status().is_success(), resp.status().as_u16()),
            Err(_) => (false, 0),
        };
        out.push(ServiceStatus { url: base.clone(), healthy, code });
    }
    out
}

fn join(base: &str, path: &str) -> String {
    if let Ok(mut u) = Url::parse(base) { u.set_path(path); return u.into_string(); }
    format!("{}{}", base.trim_end_matches('/'), path)
}

