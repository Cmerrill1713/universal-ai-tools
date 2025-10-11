use actix_web::{web, HttpServer};
use env_logger::Env;
use std::env;
use ml_inference::{MLInferenceService, create_app};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logging
    env_logger::init_from_env(Env::default().default_filter_or("info"));

    // Get configuration from environment
    let host = env::var("ML_INFERENCE_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("ML_INFERENCE_PORT")
        .unwrap_or_else(|_| "8091".to_string())
        .parse::<u16>()
        .expect("ML_INFERENCE_PORT must be a valid port number");

    let bind_address = format!("{}:{}", host, port);

    // Create ML inference service instance
    let service = web::Data::new(MLInferenceService::new());

    println!("🚀 ML Inference Service starting on {}", bind_address);
    println!("📋 Available endpoints:");
    println!("   GET  /health           - Health check");
    println!("   POST /infer            - Perform ML inference");
    println!("   GET  /models           - List available models");
    println!("   POST /models/{{id}}/load   - Load a model");
    println!("   POST /models/{{id}}/unload - Unload a model");
    println!("   GET  /stats            - Service statistics");

    // Start HTTP server
    HttpServer::new(move || create_app(service.clone()))
        .bind(&bind_address)?
        .run()
        .await
}
