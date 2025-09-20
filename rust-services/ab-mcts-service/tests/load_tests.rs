//! Load testing suite for AB-MCTS service
//! 
//! Tests the service under realistic load conditions to validate
//! performance characteristics and identify bottlenecks.

use ab_mcts_service::bridge::*;
use ab_mcts_service::types::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, Instant};
use tokio::sync::Semaphore;
use tokio::time::{timeout, sleep};

/// Load testing configuration
#[derive(Clone)]
struct LoadTestConfig {
    pub concurrent_users: usize,
    pub requests_per_user: usize,
    pub ramp_up_time: Duration,
    pub test_duration: Duration,
    pub max_response_time: Duration,
}

impl Default for LoadTestConfig {
    fn default() -> Self {
        Self {
            concurrent_users: 10,
            requests_per_user: 5,
            ramp_up_time: Duration::from_secs(5),
            test_duration: Duration::from_secs(60),
            max_response_time: Duration::from_secs(5),
        }
    }
}

/// Performance metrics collection
#[derive(Debug, Clone)]
struct LoadTestMetrics {
    pub total_requests: usize,
    pub successful_requests: usize,
    pub failed_requests: usize,
    pub average_response_time: Duration,
    pub min_response_time: Duration,
    pub max_response_time: Duration,
    pub p95_response_time: Duration,
    pub requests_per_second: f64,
    pub concurrent_operations: usize,
    pub memory_usage_mb: f64,
}

/// Create realistic test scenarios with varying complexity
fn create_test_scenarios() -> Vec<(String, AgentContext, Vec<String>)> {
    vec![
        // Simple query scenario
        (
            "Simple Query".to_string(),
            AgentContext {
                task: "Answer a straightforward question about a specific topic".to_string(),
                requirements: vec![
                    "accurate information".to_string(),
                    "clear response".to_string(),
                ],
                constraints: vec![
                    "response under 200 words".to_string(),
                ],
                context_data: HashMap::new(),
                user_preferences: Some(UserPreferences {
                    preferred_agents: vec!["enhanced-retriever-agent".to_string()],
                    quality_vs_speed: 0.3, // Favor speed
                    max_cost: Some(10.0),
                    timeout: Some(Duration::from_secs(10)),
                }),
                execution_context: ExecutionContext {
                    session_id: "simple_query_session".to_string(),
                    user_id: Some("load_test_user".to_string()),
                    timestamp: SystemTime::now(),
                    budget: 50.0,
                    priority: Priority::Normal,
                },
            },
            vec![
                "enhanced-retriever-agent".to_string(),
                "enhanced-synthesizer-agent".to_string(),
            ],
        ),
        
        // Complex analysis scenario
        (
            "Complex Analysis".to_string(),
            AgentContext {
                task: "Perform comprehensive analysis of multi-faceted business problem with detailed recommendations".to_string(),
                requirements: vec![
                    "thorough market analysis".to_string(),
                    "financial projections".to_string(),
                    "risk assessment".to_string(),
                    "strategic recommendations".to_string(),
                    "implementation timeline".to_string(),
                ],
                constraints: vec![
                    "budget under $100k".to_string(),
                    "timeline within 6 months".to_string(),
                    "regulatory compliance required".to_string(),
                ],
                context_data: {
                    let mut data = HashMap::new();
                    for i in 0..20 {
                        data.insert(
                            format!("market_data_{}", i),
                            serde_json::json!(format!("complex_market_analysis_data_{}", i))
                        );
                        data.insert(
                            format!("financial_metric_{}", i),
                            serde_json::json!(i as f64 * 1.5 + 100.0)
                        );
                    }
                    data
                },
                user_preferences: Some(UserPreferences {
                    preferred_agents: vec![
                        "enhanced-planner-agent".to_string(),
                        "enhanced-synthesizer-agent".to_string(),
                    ],
                    quality_vs_speed: 0.8, // Favor quality
                    max_cost: Some(200.0),
                    timeout: Some(Duration::from_secs(60)),
                }),
                execution_context: ExecutionContext {
                    session_id: "complex_analysis_session".to_string(),
                    user_id: Some("load_test_user".to_string()),
                    timestamp: SystemTime::now(),
                    budget: 500.0,
                    priority: Priority::High,
                },
            },
            vec![
                "enhanced-planner-agent".to_string(),
                "enhanced-retriever-agent".to_string(),
                "enhanced-synthesizer-agent".to_string(),
                "enhanced-code-assistant-agent".to_string(),
            ],
        ),
        
        // Code development scenario
        (
            "Code Development".to_string(),
            AgentContext {
                task: "Design and implement a distributed system with microservices architecture".to_string(),
                requirements: vec![
                    "scalable architecture".to_string(),
                    "fault tolerance".to_string(),
                    "API design".to_string(),
                    "database schema".to_string(),
                    "deployment strategy".to_string(),
                    "monitoring setup".to_string(),
                ],
                constraints: vec![
                    "cloud-native deployment".to_string(),
                    "containerized services".to_string(),
                    "automated testing".to_string(),
                    "security compliance".to_string(),
                ],
                context_data: {
                    let mut data = HashMap::new();
                    data.insert("language".to_string(), serde_json::json!("TypeScript"));
                    data.insert("framework".to_string(), serde_json::json!("Node.js"));
                    data.insert("database".to_string(), serde_json::json!("PostgreSQL"));
                    data.insert("cloud_provider".to_string(), serde_json::json!("AWS"));
                    for i in 0..15 {
                        data.insert(
                            format!("service_requirement_{}", i),
                            serde_json::json!(format!("microservice_spec_{}", i))
                        );
                    }
                    data
                },
                user_preferences: Some(UserPreferences {
                    preferred_agents: vec![
                        "enhanced-code-assistant-agent".to_string(),
                        "enhanced-planner-agent".to_string(),
                    ],
                    quality_vs_speed: 0.7,
                    max_cost: Some(150.0),
                    timeout: Some(Duration::from_secs(45)),
                }),
                execution_context: ExecutionContext {
                    session_id: "code_development_session".to_string(),
                    user_id: Some("load_test_user".to_string()),
                    timestamp: SystemTime::now(),
                    budget: 300.0,
                    priority: Priority::High,
                },
            },
            vec![
                "enhanced-code-assistant-agent".to_string(),
                "enhanced-planner-agent".to_string(),
                "enhanced-retriever-agent".to_string(),
                "enhanced-synthesizer-agent".to_string(),
            ],
        ),
    ]
}

/// Simulate a single user session with multiple requests
async fn simulate_user_session(
    bridge: Arc<MCTSBridge>,
    user_id: usize,
    config: LoadTestConfig,
    semaphore: Arc<Semaphore>,
) -> Vec<(Duration, Result<(), String>)> {
    let mut results = Vec::new();
    let scenarios = create_test_scenarios();
    
    // Spread requests over the test duration
    let delay_between_requests = config.test_duration / config.requests_per_user as u32;
    
    for request_id in 0..config.requests_per_user {
        // Acquire semaphore to control concurrency
        let _permit = semaphore.acquire().await.unwrap();
        
        // Select scenario (round-robin)
        let scenario_index = request_id % scenarios.len();
        let (_scenario_name, mut context, agents) = scenarios[scenario_index].clone();
        
        // Personalize the context for this user session
        context.execution_context.session_id = format!("user_{}_request_{}", user_id, request_id);
        context.execution_context.user_id = Some(format!("load_test_user_{}", user_id));
        
        let start_time = Instant::now();
        
        // Randomly choose between search and recommendations
        let result = if request_id % 2 == 0 {
            // Full search
            let search_options = Some(SearchOptions {
                max_iterations: 100,
                max_depth: 5,
                time_limit: Duration::from_millis(2000),
                exploration_constant: 1.0,
                discount_factor: 0.9,
                parallel_simulations: 1,
                checkpoint_interval: 50,
                enable_caching: false,
                verbose_logging: false,
            });
            
            match timeout(
                config.max_response_time,
                bridge.search_optimal_agents(&context, &agents, search_options)
            ).await {
                Ok(Ok(_)) => Ok(()),
                Ok(Err(e)) => Err(format!("Search failed: {}", e)),
                Err(_) => Err("Request timeout".to_string()),
            }
        } else {
            // Quick recommendations
            let rec_count = std::cmp::min(3, agents.len());
            match timeout(
                config.max_response_time,
                bridge.recommend_agents(&context, &agents, rec_count)
            ).await {
                Ok(Ok(_)) => Ok(()),
                Ok(Err(e)) => Err(format!("Recommendations failed: {}", e)),
                Err(_) => Err("Request timeout".to_string()),
            }
        };
        
        let duration = start_time.elapsed();
        results.push((duration, result));
        
        // Delay before next request (except for last request)
        if request_id < config.requests_per_user - 1 {
            sleep(delay_between_requests).await;
        }
    }
    
    results
}

/// Calculate performance metrics from test results
fn calculate_metrics(results: &[(Duration, Result<(), String>)], test_duration: Duration) -> LoadTestMetrics {
    let total_requests = results.len();
    let successful_requests = results.iter().filter(|(_, result)| result.is_ok()).count();
    let failed_requests = total_requests - successful_requests;
    
    let response_times: Vec<Duration> = results.iter().map(|(duration, _)| *duration).collect();
    
    let total_time: Duration = response_times.iter().sum();
    let average_response_time = if !response_times.is_empty() {
        total_time / response_times.len() as u32
    } else {
        Duration::default()
    };
    
    let min_response_time = response_times.iter().min().copied().unwrap_or_default();
    let max_response_time = response_times.iter().max().copied().unwrap_or_default();
    
    // Calculate 95th percentile
    let mut sorted_times = response_times.clone();
    sorted_times.sort();
    let p95_index = (sorted_times.len() as f64 * 0.95) as usize;
    let p95_response_time = sorted_times.get(p95_index).copied().unwrap_or_default();
    
    let requests_per_second = if test_duration.as_secs_f64() > 0.0 {
        successful_requests as f64 / test_duration.as_secs_f64()
    } else {
        0.0
    };
    
    // Estimate memory usage (simplified)
    let memory_usage_mb = (total_requests * 2) as f64; // Rough estimate: 2MB per request
    
    LoadTestMetrics {
        total_requests,
        successful_requests,
        failed_requests,
        average_response_time,
        min_response_time,
        max_response_time,
        p95_response_time,
        requests_per_second,
        concurrent_operations: 0, // Would need additional tracking
        memory_usage_mb,
    }
}

#[tokio::test]
async fn test_light_load() {
    let config = LoadTestConfig {
        concurrent_users: 3,
        requests_per_user: 2,
        ramp_up_time: Duration::from_secs(1),
        test_duration: Duration::from_secs(10),
        max_response_time: Duration::from_secs(3),
    };
    
    run_load_test("Light Load", config).await;
}

#[tokio::test]
async fn test_moderate_load() {
    let config = LoadTestConfig {
        concurrent_users: 5,
        requests_per_user: 3,
        ramp_up_time: Duration::from_secs(2),
        test_duration: Duration::from_secs(20),
        max_response_time: Duration::from_secs(4),
    };
    
    run_load_test("Moderate Load", config).await;
}

#[tokio::test]
async fn test_heavy_load() {
    let config = LoadTestConfig {
        concurrent_users: 10,
        requests_per_user: 5,
        ramp_up_time: Duration::from_secs(5),
        test_duration: Duration::from_secs(30),
        max_response_time: Duration::from_secs(5),
    };
    
    run_load_test("Heavy Load", config).await;
}

async fn run_load_test(test_name: &str, config: LoadTestConfig) {
    println!("🚀 Starting {} Test", test_name);
    println!("Configuration: {} users, {} requests/user, {}s duration",
        config.concurrent_users, config.requests_per_user, config.test_duration.as_secs());
    
    // Initialize the bridge
    let mut bridge = MCTSBridge::new();
    bridge.initialize().await.expect("Failed to initialize bridge");
    let bridge = Arc::new(bridge);
    
    // Create semaphore to control peak concurrency
    let semaphore = Arc::new(Semaphore::new(config.concurrent_users));
    
    let test_start = Instant::now();
    
    // Spawn user sessions with ramp-up
    let mut session_handles = Vec::new();
    let ramp_up_delay = config.ramp_up_time / config.concurrent_users as u32;
    
    for user_id in 0..config.concurrent_users {
        let bridge_clone = bridge.clone();
        let config_clone = config.clone();
        let semaphore_clone = semaphore.clone();
        
        // Ramp up users gradually
        if user_id > 0 {
            sleep(ramp_up_delay).await;
        }
        
        session_handles.push(tokio::spawn(async move {
            simulate_user_session(bridge_clone, user_id, config_clone, semaphore_clone).await
        }));
    }
    
    // Wait for all sessions to complete
    let mut all_results = Vec::new();
    for handle in session_handles {
        match handle.await {
            Ok(session_results) => all_results.extend(session_results),
            Err(e) => eprintln!("Session failed: {}", e),
        }
    }
    
    let test_duration = test_start.elapsed();
    let metrics = calculate_metrics(&all_results, test_duration);
    
    // Print results
    println!("\n📊 {} Results:", test_name);
    println!("================");
    println!("Total Requests:       {}", metrics.total_requests);
    println!("Successful:           {} ({:.1}%)", 
        metrics.successful_requests,
        (metrics.successful_requests as f64 / metrics.total_requests as f64) * 100.0
    );
    println!("Failed:               {} ({:.1}%)", 
        metrics.failed_requests,
        (metrics.failed_requests as f64 / metrics.total_requests as f64) * 100.0
    );
    println!("Average Response:     {:?}", metrics.average_response_time);
    println!("Min Response:         {:?}", metrics.min_response_time);
    println!("Max Response:         {:?}", metrics.max_response_time);
    println!("95th Percentile:      {:?}", metrics.p95_response_time);
    println!("Requests/Second:      {:.2}", metrics.requests_per_second);
    println!("Test Duration:        {:?}", test_duration);
    println!("Est. Memory Usage:    {:.1} MB", metrics.memory_usage_mb);
    
    // Performance assertions
    let success_rate = metrics.successful_requests as f64 / metrics.total_requests as f64;
    assert!(success_rate >= 0.95, "Success rate should be at least 95%, got {:.1}%", success_rate * 100.0);
    assert!(metrics.average_response_time <= config.max_response_time, 
        "Average response time {:?} should be under {:?}", metrics.average_response_time, config.max_response_time);
    assert!(metrics.p95_response_time <= config.max_response_time * 2, 
        "95th percentile {:?} should be under {:?}", metrics.p95_response_time, config.max_response_time * 2);
    
    println!("✅ {} test passed all performance criteria!", test_name);
}

#[tokio::test]
async fn test_sustained_load() {
    let config = LoadTestConfig {
        concurrent_users: 8,
        requests_per_user: 10,
        ramp_up_time: Duration::from_secs(3),
        test_duration: Duration::from_secs(60),
        max_response_time: Duration::from_secs(6),
    };
    
    println!("🏃 Starting Sustained Load Test (1 minute)");
    println!("This test validates performance under extended load...");
    
    run_load_test("Sustained Load", config).await;
    
    println!("✅ Sustained load test completed successfully!");
}

#[tokio::test]
async fn test_stress_test() {
    let config = LoadTestConfig {
        concurrent_users: 15,
        requests_per_user: 7,
        ramp_up_time: Duration::from_secs(2),
        test_duration: Duration::from_secs(45),
        max_response_time: Duration::from_secs(10), // More lenient for stress test
    };
    
    println!("💥 Starting Stress Test");
    println!("This test pushes the system to its limits...");
    
    run_load_test("Stress Test", config).await;
    
    println!("✅ Stress test completed - system remained stable!");
}