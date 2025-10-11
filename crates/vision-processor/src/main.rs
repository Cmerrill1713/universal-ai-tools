use actix_web::{web, HttpServer, middleware::Logger};
use env_logger::Env;
use std::env;
use vision_processor::{VisionProcessor, create_app};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logging
    env_logger::init_from_env(Env::default().default_filter_or("info"));

    // Get configuration from environment
    let host = env::var("VISION_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("VISION_PORT")
        .unwrap_or_else(|_| "8090".to_string())
        .parse::<u16>()
        .expect("VISION_PORT must be a valid port number");

    let bind_address = format!("{}:{}", host, port);

    // Create vision processor instance
    let processor = web::Data::new(VisionProcessor::new());

    println!("🚀 Vision Processor Service starting on {}", bind_address);
    println!("📋 Available endpoints:");
    println!("   GET  /health  - Health check");
    println!("   POST /process - Process image");
    println!("   GET  /stats   - Service statistics");

    // Start HTTP server
    HttpServer::new(move || create_app(processor.clone()))
        .bind(&bind_address)?
        .run()
        .await
}