use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use s3_searcher_service::{
    Config,
    S3Searcher,
    api::{AppState, create_router},
};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "s3_searcher_service=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    info!("Starting S3 Searcher Service");
    
    // Load configuration
    let config = Config::load()?;
    info!("Configuration loaded successfully");
    
    // Initialize Redis connection (optional)
    let redis_conn = match redis::Client::open(config.redis.url.clone()) {
        Ok(client) => {
            match redis::aio::ConnectionManager::new(client).await {
                Ok(conn) => {
                    info!("Redis connection established");
                    Some(conn)
                },
                Err(e) => {
                    error!("Failed to connect to Redis: {}. Continuing without cache.", e);
                    None
                }
            }
        },
        Err(e) => {
            error!("Failed to create Redis client: {}. Continuing without cache.", e);
            None
        }
    };
    
    // Initialize retriever
    let retriever: Box<dyn s3_searcher_service::DocumentRetriever> = 
        if config.retriever.use_postgres_vectors {
            info!("Using PostgreSQL with pgvector for document retrieval");
            let embedding_service_url = config.retriever.weaviate_url
                .clone()
                .unwrap_or_else(|| "http://localhost:8001".to_string());
            
            Box::new(
                s3_searcher_service::retriever::PostgresVectorRetriever::new(
                    &config.database.url,
                    &embedding_service_url,
                ).await?
            )
        } else if let Some(weaviate_url) = &config.retriever.weaviate_url {
            info!("Using Weaviate for document retrieval");
            Box::new(
                s3_searcher_service::retriever::WeaviateRetriever::new(weaviate_url)
            )
        } else {
            error!("No retriever configured!");
            return Err(anyhow::anyhow!("No retriever configured"));
        };
    
    // Initialize searcher
    let searcher_config = s3_searcher_service::models::SearcherConfig {
        model_name: config.searcher.model_name.clone(),
        max_turns: config.searcher.max_turns,
        docs_per_turn: config.searcher.docs_per_turn,
        temperature: config.searcher.temperature,
        top_p: config.searcher.top_p,
        stop_threshold: config.searcher.stop_threshold,
    };
    
    let searcher = S3Searcher::new(
        searcher_config,
        retriever,
        redis_conn,
    );
    
    // Create application state
    let app_state = Arc::new(AppState {
        searcher: Arc::new(searcher),
        sessions: Arc::new(RwLock::new(std::collections::HashMap::new())),
        config: config.clone(),
    });
    
    // Create router
    let app = create_router(app_state);
    
    // Start server
    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    
    info!("S3 Searcher Service listening on {}", addr);
    info!("Configuration:");
    info!("  - Max turns: {}", config.searcher.max_turns);
    info!("  - Docs per turn: {}", config.searcher.docs_per_turn);
    info!("  - Cache enabled: {}", config.searcher.cache_enabled);
    info!("  - Embedding model: {}", config.retriever.embedding_model);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}