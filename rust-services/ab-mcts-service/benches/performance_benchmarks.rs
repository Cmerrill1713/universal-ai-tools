//! Performance benchmarks for AB-MCTS service
//! 
//! Measures the performance of the Rust implementation against expected targets
//! and provides detailed metrics for comparison with the TypeScript version.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use ab_mcts_service::bridge::*;
use ab_mcts_service::engine::MCTSConfig;
use ab_mcts_service::types::*;
use std::collections::HashMap;
use std::time::{Duration, SystemTime, Instant};
use tokio::runtime::Runtime;

// Test data generation helpers
fn create_large_context(task_complexity: usize) -> AgentContext {
    let mut requirements = Vec::new();
    let mut constraints = Vec::new();
    let mut context_data = HashMap::new();
    
    // Generate complex requirements and constraints
    for i in 0..task_complexity {
        requirements.push(format!("requirement_{}_complex_analysis_with_detailed_specifications", i));
        constraints.push(format!("constraint_{}_performance_optimization_requirements", i));
        context_data.insert(
            format!("data_key_{}", i),
            serde_json::json!(format!("complex_data_value_{}_with_extensive_metadata", i))
        );
    }
    
    AgentContext {
        task: format!(
            "Complex multi-step task requiring analysis of {} components with detailed processing requirements and optimization constraints",
            task_complexity
        ),
        requirements,
        constraints,
        context_data,
        user_preferences: Some(UserPreferences {
            preferred_agents: vec![
                "enhanced-planner-agent".to_string(),
                "enhanced-retriever-agent".to_string(),
                "enhanced-synthesizer-agent".to_string(),
            ],
            quality_vs_speed: 0.7,
            max_cost: Some(100.0),
            timeout: Some(Duration::from_secs(30)),
        }),
        execution_context: ExecutionContext {
            session_id: format!("benchmark_session_{}", task_complexity),
            user_id: Some("benchmark_user".to_string()),
            timestamp: SystemTime::now(),
            budget: 500.0,
            priority: Priority::High,
        },
    }
}

fn create_many_agents(count: usize) -> Vec<String> {
    (0..count)
        .map(|i| format!("benchmark-agent-{:03}", i))
        .collect()
}

// Benchmark: Bridge initialization
fn benchmark_bridge_initialization(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    c.bench_function("bridge_initialization", |b| {
        b.iter(|| {
            rt.block_on(async {
                let config = MCTSConfig {
                    max_iterations: 100,
                    max_depth: 5,
                    exploration_constant: 1.0,
                    discount_factor: 0.9,
                    time_limit: Duration::from_millis(1000),
                    enable_thompson_sampling: true,
                    enable_bayesian_learning: true,
                    enable_caching: false,
                    parallel_simulations: 1,
                    node_pool_size: 200,
                    cache_config: None,
                    checkpoint_interval: 100,
                };
                
                let mut bridge = MCTSBridge::with_config(config);
                bridge.initialize().await.expect("Failed to initialize");
                black_box(bridge);
            });
        });
    });
}

// Benchmark: Simple search operations
fn benchmark_simple_search(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut bridge = rt.block_on(async {
        let mut bridge = MCTSBridge::new();
        bridge.initialize().await.expect("Failed to initialize");
        bridge
    });
    
    c.bench_function("simple_search", |b| {
        b.iter(|| {
            rt.block_on(async {
                let context = black_box(MCTSBridge::create_test_context(
                    "Simple benchmark task".to_string(),
                    "benchmark_session".to_string(),
                ));
                let agents = black_box(vec![
                    "agent1".to_string(),
                    "agent2".to_string(),
                    "agent3".to_string(),
                ]);
                
                let options = Some(SearchOptions {
                    max_iterations: 50,
                    max_depth: 3,
                    time_limit: Duration::from_millis(500),
                    exploration_constant: 1.0,
                    discount_factor: 0.9,
                    parallel_simulations: 1,
                    checkpoint_interval: 25,
                    enable_caching: false,
                    verbose_logging: false,
                });
                
                let result = bridge.search_optimal_agents(&context, &agents, options).await;
                black_box(result.expect("Search should succeed"));
            });
        });
    });
}

// Benchmark: Complex search operations
fn benchmark_complex_search(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut bridge = rt.block_on(async {
        let config = MCTSConfig {
            max_iterations: 500,
            max_depth: 8,
            exploration_constant: 1.4,
            discount_factor: 0.95,
            time_limit: Duration::from_secs(5),
            enable_thompson_sampling: true,
            enable_bayesian_learning: true,
            enable_caching: false,
            parallel_simulations: 2,
            node_pool_size: 1000,
            cache_config: None,
            checkpoint_interval: 100,
        };
        
        let mut bridge = MCTSBridge::with_config(config);
        bridge.initialize().await.expect("Failed to initialize");
        bridge
    });
    
    c.bench_function("complex_search", |b| {
        b.iter(|| {
            rt.block_on(async {
                let context = black_box(create_large_context(10));
                let agents = black_box(create_many_agents(15));
                
                let options = Some(SearchOptions {
                    max_iterations: 200,
                    max_depth: 6,
                    time_limit: Duration::from_millis(2000),
                    exploration_constant: 1.4,
                    discount_factor: 0.95,
                    parallel_simulations: 2,
                    checkpoint_interval: 50,
                    enable_caching: false,
                    verbose_logging: false,
                });
                
                let result = bridge.search_optimal_agents(&context, &agents, options).await;
                black_box(result.expect("Complex search should succeed"));
            });
        });
    });
}

// Benchmark: Recommendation generation
fn benchmark_recommendations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut bridge = rt.block_on(async {
        let mut bridge = MCTSBridge::new();
        bridge.initialize().await.expect("Failed to initialize");
        bridge
    });
    
    c.bench_function("recommendations", |b| {
        b.iter(|| {
            rt.block_on(async {
                let context = black_box(create_large_context(5));
                let agents = black_box(create_many_agents(20));
                
                let result = bridge.recommend_agents(&context, &agents, 5).await;
                black_box(result.expect("Recommendations should succeed"));
            });
        });
    });
}

// Benchmark: Concurrent operations
fn benchmark_concurrent_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut bridge = rt.block_on(async {
        let mut bridge = MCTSBridge::new();
        bridge.initialize().await.expect("Failed to initialize");
        bridge
    });
    
    c.bench_function("concurrent_operations", |b| {
        b.iter(|| {
            rt.block_on(async {
                let contexts = (0..4)
                    .map(|i| black_box(MCTSBridge::create_test_context(
                        format!("Concurrent task {}", i),
                        format!("concurrent_session_{}", i),
                    )))
                    .collect::<Vec<_>>();
                
                let agents = black_box(vec![
                    "agent1".to_string(),
                    "agent2".to_string(),
                    "agent3".to_string(),
                ]);
                
                let futures = contexts.iter().map(|context| {
                    bridge.recommend_agents(context, &agents, 3)
                });
                
                let results = futures::future::join_all(futures).await;
                black_box(results);
            });
        });
    });
}

// Benchmark: Scalability with increasing agent count
fn benchmark_agent_scalability(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut bridge = rt.block_on(async {
        let mut bridge = MCTSBridge::new();
        bridge.initialize().await.expect("Failed to initialize");
        bridge
    });
    
    let mut group = c.benchmark_group("agent_scalability");
    
    for agent_count in [5, 10, 20, 50, 100].iter() {
        group.bench_with_input(
            criterion::BenchmarkId::new("agents", agent_count),
            agent_count,
            |b, &agent_count| {
                b.iter(|| {
                    rt.block_on(async {
                        let context = black_box(MCTSBridge::create_test_context(
                            "Scalability test".to_string(),
                            "scalability_session".to_string(),
                        ));
                        let agents = black_box(create_many_agents(agent_count));
                        
                        let options = Some(SearchOptions {
                            max_iterations: 100,
                            max_depth: 4,
                            time_limit: Duration::from_millis(1000),
                            exploration_constant: 1.0,
                            discount_factor: 0.9,
                            parallel_simulations: 1,
                            checkpoint_interval: 50,
                            enable_caching: false,
                            verbose_logging: false,
                        });
                        
                        let result = bridge.recommend_agents(&context, &agents, 3).await;
                        black_box(result.expect("Scalability test should succeed"));
                    });
                });
            },
        );
    }
    group.finish();
}

// Benchmark: Memory efficiency test
fn benchmark_memory_usage(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    c.bench_function("memory_usage_large_search_space", |b| {
        b.iter(|| {
            rt.block_on(async {
                let config = MCTSConfig {
                    max_iterations: 1000,
                    max_depth: 10,
                    exploration_constant: 1.0,
                    discount_factor: 0.95,
                    time_limit: Duration::from_secs(3),
                    enable_thompson_sampling: true,
                    enable_bayesian_learning: true,
                    enable_caching: false,
                    parallel_simulations: 1,
                    node_pool_size: 2000,
                    cache_config: None,
                    checkpoint_interval: 100,
                };
                
                let mut bridge = MCTSBridge::with_config(config);
                bridge.initialize().await.expect("Failed to initialize");
                
                let context = black_box(create_large_context(50));
                let agents = black_box(create_many_agents(100));
                
                let options = Some(SearchOptions {
                    max_iterations: 500,
                    max_depth: 8,
                    time_limit: Duration::from_millis(2500),
                    exploration_constant: 1.4,
                    discount_factor: 0.95,
                    parallel_simulations: 1,
                    checkpoint_interval: 100,
                    enable_caching: false,
                    verbose_logging: false,
                });
                
                let result = bridge.search_optimal_agents(&context, &agents, options).await;
                black_box(result.expect("Memory test should succeed"));
            });
        });
    });
}

criterion_group!(
    benches,
    benchmark_bridge_initialization,
    benchmark_simple_search,
    benchmark_complex_search,
    benchmark_recommendations,
    benchmark_concurrent_operations,
    benchmark_agent_scalability,
    benchmark_memory_usage
);

criterion_main!(benches);