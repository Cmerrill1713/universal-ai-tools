//! Test different Qdrant client creation methods

use qdrant_client::Qdrant;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Testing Qdrant client creation methods...");
    
    let qdrant_url = "http://localhost:6333";
    
    // Test 1: from_url returns config
    let config = Qdrant::from_url(qdrant_url);
    println!("Type of from_url: {:?}", std::any::type_name_of_val(&config));
    
    // Test 2: Try to create actual client from config
    let client = Qdrant::new(config)?;
    println!("Type of new(config): {:?}", std::any::type_name_of_val(&client));
    
    // Test 3: Try with Arc
    let arc_client = Arc::new(client);
    println!("Type of Arc<new(config)>: {:?}", std::any::type_name_of_val(&arc_client));
    
    Ok(())
}