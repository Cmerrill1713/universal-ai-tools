use rust_auth_service::{
    handlers::*,
    middleware::{auth_middleware, cors_middleware, require_admin},
};
use axum::{
    middleware::from_fn,
    routing::{get, post, put, delete},
    Router,
};
use std::env;
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;
use tracing_subscriber;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Get configuration from environment
    let jwt_secret = env::var("JWT_SECRET")
        .unwrap_or_else(|_| "development_secret_key_change_in_production".to_string());
    
    let port = env::var("PORT")
        .unwrap_or_else(|_| "8015".to_string());
    
    let host = env::var("HOST")
        .unwrap_or_else(|_| "0.0.0.0".to_string());

    // Create application state
    let state = AppState::new(jwt_secret);

    // Build the application routes with proper middleware layering
    
    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/login", post(login))
        .route("/register", post(register));
        
    // Protected routes (require authentication)
    let protected_routes = Router::new()
        .route("/verify", get(verify_token))
        .route("/profile", get(get_profile))
        .route("/profile", put(update_profile))
        .route_layer(from_fn(auth_middleware));
        
    // Admin-only routes (require authentication + admin role)
    let admin_routes = Router::new()
        .route("/users", get(list_users))
        .route("/users/:id", get(get_user))
        .route("/users/:id", put(update_user))
        .route("/users/:id", delete(delete_user))
        .route_layer(from_fn(require_admin))
        .route_layer(from_fn(auth_middleware));
    
    // Combine all routes
    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(admin_routes)
        // Global middleware
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(from_fn(cors_middleware))
        )
        .with_state(state);

    // Create server
    let addr = format!("{}:{}", host, port);
    let listener = TcpListener::bind(&addr).await.unwrap();
    
    tracing::info!("🚀 Rust Auth Service starting on {}", addr);
    tracing::info!("📋 Available endpoints:");
    tracing::info!("  GET  /health      - Health check");
    tracing::info!("  POST /login       - User login");
    tracing::info!("  POST /register    - User registration");
    tracing::info!("  GET  /verify      - Token verification [AUTH]");
    tracing::info!("  GET  /profile     - Get user profile [AUTH]");
    tracing::info!("  PUT  /profile     - Update user profile [AUTH]");
    tracing::info!("  GET  /users       - List all users [ADMIN]");
    tracing::info!("  GET  /users/:id   - Get user by ID [ADMIN]");
    tracing::info!("  PUT  /users/:id   - Update user [ADMIN]");
    tracing::info!("  DEL  /users/:id   - Delete user [ADMIN]");

    // Start the server
    axum::serve(listener, app).await.unwrap();
}