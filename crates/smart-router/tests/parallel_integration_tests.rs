// Parallel Integration Tests for Smart Router
// Uses cargo-nextest for parallel test execution

use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::time::timeout;
use serde_json::json;
use reqwest::Client;

// Test configuration
const TEST_TIMEOUT: Duration = Duration::from_secs(30);
const BASE_URL: &str = "http://localhost:3033";
const PARALLEL_TEST_COUNT: usize = 10;

#[tokio::test]
async fn test_smart_routing_parallel() {
    // Test smart routing with multiple concurrent requests
    let client = Client::new();
    let mut handles = vec![];

    // Create multiple test requests
    let test_cases = vec![
        ("What is 2+2?", "simple"),
        ("Explain quantum computing", "complex"),
        ("Create a project plan", "orchestration"),
        ("What is AI?", "simple"),
        ("Analyze market trends", "expert"),
    ];

    for (i, (prompt, complexity)) in test_cases.iter().enumerate() {
        let client_clone = client.clone();
        let prompt = prompt.to_string();
        let complexity = complexity.to_string();

        let handle = tokio::spawn(async move {
            let start_time = Instant::now();

            let response = client_clone
                .post(&format!("{}/chat", BASE_URL))
                .json(&json!({
                    "messages": [{"role": "user", "content": prompt}],
                    "model": null,
                    "temperature": 0.7
                }))
                .send()
                .await;

            let response_time = start_time.elapsed();

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let data: serde_json::Value = resp.json().await.unwrap();
                        TestResult {
                            test_id: i,
                            prompt,
                            complexity,
                            success: true,
                            response_time: response_time.as_millis() as u64,
                            routing_decision: data.get("model").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                            error: None,
                        }
                    } else {
                        TestResult {
                            test_id: i,
                            prompt,
                            complexity,
                            success: false,
                            response_time: response_time.as_millis() as u64,
                            routing_decision: "error".to_string(),
                            error: Some(format!("HTTP {}", resp.status())),
                        }
                    }
                }
                Err(e) => TestResult {
                    test_id: i,
                    prompt,
                    complexity,
                    success: false,
                    response_time: response_time.as_millis() as u64,
                    routing_decision: "error".to_string(),
                    error: Some(e.to_string()),
                }
            }
        });

        handles.push(handle);
    }

    // Wait for all tests to complete
    let results: Vec<TestResult> = futures::future::join_all(handles)
        .await
        .into_iter()
        .map(|h| h.unwrap())
        .collect();

    // Analyze results
    let successful_tests = results.iter().filter(|r| r.success).count();
    let total_tests = results.len();
    let success_rate = (successful_tests as f64 / total_tests as f64) * 100.0;

    println!("Parallel Test Results:");
    println!("  Success Rate: {:.1}%", success_rate);
    println!("  Total Tests: {}", total_tests);
    println!("  Successful: {}", successful_tests);

    // Verify routing decisions
    let routing_decisions: HashMap<String, usize> = results
        .iter()
        .map(|r| (r.routing_decision.clone(), 1))
        .fold(HashMap::new(), |mut acc, (key, count)| {
            *acc.entry(key).or_insert(0) += count;
            acc
        });

    println!("  Routing Decisions: {:?}", routing_decisions);

    // Assertions
    assert!(success_rate >= 80.0, "Success rate should be at least 80%");
    assert!(successful_tests > 0, "At least one test should succeed");
}

#[tokio::test]
async fn test_cache_performance_parallel() {
    // Test caching with repeated requests
    let client = Client::new();
    let mut handles = vec![];

    let test_prompts = vec![
        "What is artificial intelligence?",
        "Explain machine learning",
        "What is artificial intelligence?", // Duplicate for cache test
        "Tell me about AI", // Similar for semantic cache
        "What is artificial intelligence?", // Another duplicate
    ];

    for (i, prompt) in test_prompts.iter().enumerate() {
        let client_clone = client.clone();
        let prompt = prompt.to_string();

        let handle = tokio::spawn(async move {
            let start_time = Instant::now();

            let response = client_clone
                .post(&format!("{}/chat", BASE_URL))
                .json(&json!({
                    "messages": [{"role": "user", "content": prompt}],
                    "model": null,
                    "temperature": 0.7
                }))
                .send()
                .await;

            let response_time = start_time.elapsed();

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let data: serde_json::Value = resp.json().await.unwrap();
                        let is_cached = response_time < Duration::from_millis(100);

                        CacheTestResult {
                            test_id: i,
                            prompt,
                            success: true,
                            response_time: response_time.as_millis() as u64,
                            is_cached,
                            error: None,
                        }
                    } else {
                        CacheTestResult {
                            test_id: i,
                            prompt,
                            success: false,
                            response_time: response_time.as_millis() as u64,
                            is_cached: false,
                            error: Some(format!("HTTP {}", resp.status())),
                        }
                    }
                }
                Err(e) => CacheTestResult {
                    test_id: i,
                    prompt,
                    success: false,
                    response_time: response_time.as_millis() as u64,
                    is_cached: false,
                    error: Some(e.to_string()),
                }
            }
        });

        handles.push(handle);
    }

    // Wait for all tests to complete
    let results: Vec<CacheTestResult> = futures::future::join_all(handles)
        .await
        .into_iter()
        .map(|h| h.unwrap())
        .collect();

    // Analyze cache performance
    let cache_hits = results.iter().filter(|r| r.is_cached).count();
    let total_tests = results.len();
    let cache_hit_rate = (cache_hits as f64 / total_tests as f64) * 100.0;

    println!("Cache Performance Results:");
    println!("  Cache Hit Rate: {:.1}%", cache_hit_rate);
    println!("  Cache Hits: {}", cache_hits);
    println!("  Total Tests: {}", total_tests);

    // Assertions
    assert!(cache_hit_rate >= 20.0, "Cache hit rate should be at least 20%");
}

#[tokio::test]
async fn test_load_balancing_parallel() {
    // Test load balancing with high concurrent load
    let client = Client::new();
    let mut handles = vec![];

    // Create many concurrent requests
    for i in 0..PARALLEL_TEST_COUNT {
        let client_clone = client.clone();

        let handle = tokio::spawn(async move {
            let start_time = Instant::now();

            let response = client_clone
                .post(&format!("{}/chat", BASE_URL))
                .json(&json!({
                    "messages": [{"role": "user", "content": format!("Test request {}", i)}],
                    "model": null,
                    "temperature": 0.7
                }))
                .send()
                .await;

            let response_time = start_time.elapsed();

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let data: serde_json::Value = resp.json().await.unwrap();
                        LoadTestResult {
                            test_id: i,
                            success: true,
                            response_time: response_time.as_millis() as u64,
                            model: data.get("model").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                            error: None,
                        }
                    } else {
                        LoadTestResult {
                            test_id: i,
                            success: false,
                            response_time: response_time.as_millis() as u64,
                            model: "error".to_string(),
                            error: Some(format!("HTTP {}", resp.status())),
                        }
                    }
                }
                Err(e) => LoadTestResult {
                    test_id: i,
                    success: false,
                    response_time: response_time.as_millis() as u64,
                    model: "error".to_string(),
                    error: Some(e.to_string()),
                }
            }
        });

        handles.push(handle);
    }

    // Wait for all tests to complete
    let results: Vec<LoadTestResult> = futures::future::join_all(handles)
        .await
        .into_iter()
        .map(|h| h.unwrap())
        .collect();

    // Analyze load balancing
    let successful_tests = results.iter().filter(|r| r.success).count();
    let total_tests = results.len();
    let success_rate = (successful_tests as f64 / total_tests as f64) * 100.0;

    // Check model distribution
    let model_distribution: HashMap<String, usize> = results
        .iter()
        .filter(|r| r.success)
        .map(|r| (r.model.clone(), 1))
        .fold(HashMap::new(), |mut acc, (key, count)| {
            *acc.entry(key).or_insert(0) += count;
            acc
        });

    println!("Load Balancing Results:");
    println!("  Success Rate: {:.1}%", success_rate);
    println!("  Model Distribution: {:?}", model_distribution);

    // Assertions
    assert!(success_rate >= 70.0, "Success rate under load should be at least 70%");
    assert!(successful_tests > 0, "At least one test should succeed under load");
}

#[tokio::test]
async fn test_health_monitoring_parallel() {
    // Test health monitoring with concurrent health checks
    let client = Client::new();
    let mut handles = vec![];

    // Create multiple health check requests
    for i in 0..5 {
        let client_clone = client.clone();

        let handle = tokio::spawn(async move {
            let start_time = Instant::now();

            let response = client_clone
                .get(&format!("{}/health", BASE_URL))
                .send()
                .await;

            let response_time = start_time.elapsed();

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let data: serde_json::Value = resp.json().await.unwrap();
                        HealthTestResult {
                            test_id: i,
                            success: true,
                            response_time: response_time.as_millis() as u64,
                            status: data.get("status").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                            error: None,
                        }
                    } else {
                        HealthTestResult {
                            test_id: i,
                            success: false,
                            response_time: response_time.as_millis() as u64,
                            status: "error".to_string(),
                            error: Some(format!("HTTP {}", resp.status())),
                        }
                    }
                }
                Err(e) => HealthTestResult {
                    test_id: i,
                    success: false,
                    response_time: response_time.as_millis() as u64,
                    status: "error".to_string(),
                    error: Some(e.to_string()),
                }
            }
        });

        handles.push(handle);
    }

    // Wait for all tests to complete
    let results: Vec<HealthTestResult> = futures::future::join_all(handles)
        .await
        .into_iter()
        .map(|h| h.unwrap())
        .collect();

    // Analyze health monitoring
    let successful_tests = results.iter().filter(|r| r.success).count();
    let total_tests = results.len();
    let success_rate = (successful_tests as f64 / total_tests as f64) * 100.0;

    println!("Health Monitoring Results:");
    println!("  Success Rate: {:.1}%", success_rate);
    println!("  Total Tests: {}", total_tests);

    // Assertions
    assert!(success_rate >= 90.0, "Health monitoring success rate should be at least 90%");
    assert!(successful_tests > 0, "At least one health check should succeed");
}

// Test result structures
#[derive(Debug)]
struct TestResult {
    test_id: usize,
    prompt: String,
    complexity: String,
    success: bool,
    response_time: u64,
    routing_decision: String,
    error: Option<String>,
}

#[derive(Debug)]
struct CacheTestResult {
    test_id: usize,
    prompt: String,
    success: bool,
    response_time: u64,
    is_cached: bool,
    error: Option<String>,
}

#[derive(Debug)]
struct LoadTestResult {
    test_id: usize,
    success: bool,
    response_time: u64,
    model: String,
    error: Option<String>,
}

#[derive(Debug)]
struct HealthTestResult {
    test_id: usize,
    success: bool,
    response_time: u64,
    status: String,
    error: Option<String>,
}
