use std::env;
use std::sync::Arc;
use llm_router::LLMRouter;
use assistantd::rag::{R1RagRequest, run_r1_pipeline};

#[tokio::test]
async fn test_single_hop_rag() -> anyhow::Result<()> {
    // Set up environment variables
    env::set_var("RAG_PROVIDER", "supabase");
    env::set_var("SUPABASE_URL", "http://127.0.0.1:54321");
    env::set_var("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU");
    env::set_var("OLLAMA_URL", "http://localhost:11434");
    env::set_var("EMBEDDING_MODEL", "all-minilm:latest");

    // Initialize LLM router
    let router = Arc::new(LLMRouter::new(llm_router::config::RouterConfig::default()).await?);

    // Test single-hop RAG
    let request = R1RagRequest {
        query: "How do I optimize Supabase queries?".to_string(),
        k: Some(3),
        model: Some("llama3.1:8b".to_string()),
        max_iterations: None,
        enable_multi_hop: Some(false),
        traversal_depth: None,
        max_paths: None,
    };

    let response = run_r1_pipeline(router, request).await?;

    // Verify response
    assert!(!response.answer.is_empty());
    assert!(!response.used_multi_hop);
    assert!(response.reasoning_paths.is_none());

    println!("✅ Single-hop RAG test passed!");
    println!("   Answer: {}", response.answer);
    println!("   Citations: {}", response.citations.len());

    Ok(())
}

#[tokio::test]
async fn test_multi_hop_rag() -> anyhow::Result<()> {
    // Set up environment variables
    env::set_var("RAG_PROVIDER", "supabase");
    env::set_var("SUPABASE_URL", "http://127.0.0.1:54321");
    env::set_var("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU");
    env::set_var("OLLAMA_URL", "http://localhost:11434");
    env::set_var("EMBEDDING_MODEL", "all-minilm:latest");

    // Initialize LLM router
    let router = Arc::new(LLMRouter::new(llm_router::config::RouterConfig::default()).await?);

    // Test multi-hop RAG
    let request = R1RagRequest {
        query: "How do I optimize Supabase queries for real-time applications?".to_string(),
        k: Some(5),
        model: Some("llama3.1:8b".to_string()),
        max_iterations: None,
        enable_multi_hop: Some(true),
        traversal_depth: Some(3),
        max_paths: Some(5),
    };

    let response = run_r1_pipeline(router, request).await?;

    // Verify response
    assert!(!response.answer.is_empty());
    assert!(response.used_multi_hop);

    println!("✅ Multi-hop RAG test passed!");
    println!("   Answer: {}", response.answer);
    println!("   Citations: {}", response.citations.len());
    println!("   Used multi-hop: {}", response.used_multi_hop);

    if let Some(paths) = response.reasoning_paths {
        println!("   Reasoning paths: {}", paths.len());
        for (i, path) in paths.iter().enumerate() {
            println!("     Path {}: {} (strength: {:.2})",
                i + 1, path.path_description, path.total_strength);
        }
    }

    Ok(())
}
