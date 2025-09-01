// Integration tests for AB-MCTS service
// These tests validate the complete functionality of the bridge and engine

use ab_mcts_service::bridge::*;
use ab_mcts_service::engine::MCTSConfig;
use ab_mcts_service::types::*;
use std::collections::HashMap;
use std::time::{Duration, SystemTime};

#[tokio::test]
async fn test_bridge_initialization() {
    let config = MCTSConfig {
        max_iterations: 10,
        max_depth: 3,
        exploration_constant: 1.0,
        discount_factor: 0.9,
        time_limit: Duration::from_millis(1000),
        enable_thompson_sampling: true,
        enable_bayesian_learning: false,
        enable_caching: false,
        parallel_simulations: 1,
        node_pool_size: 100,
        cache_config: None,
        checkpoint_interval: 100,
    };

    let mut bridge = MCTSBridge::with_config(config);
    
    // Test initialization
    assert!(!bridge.is_ready());
    
    let result = bridge.initialize().await;
    assert!(result.is_ok(), "Bridge initialization failed: {:?}", result);
    assert!(bridge.is_ready(), "Bridge should be ready after initialization");
}

#[tokio::test]
async fn test_bridge_health_check() {
    let mut bridge = MCTSBridge::new();
    
    // Health check before initialization
    let health = bridge.health_check().await;
    assert_eq!(health["bridge_status"], "healthy");
    assert_eq!(health["engine"]["status"], "not_initialized");
    
    // Initialize and check again
    bridge.initialize().await.expect("Failed to initialize");
    
    let health = bridge.health_check().await;
    assert_eq!(health["bridge_status"], "healthy");
    assert_eq!(health["engine"]["status"], "healthy");
    assert!(health["features"]["thompson_sampling"].as_bool().unwrap());
}

#[tokio::test]
async fn test_context_validation() {
    let bridge = MCTSBridge::new();
    
    // Valid context
    let valid_context = MCTSBridge::create_test_context(
        "Test task".to_string(),
        "test_session_123".to_string(),
    );
    
    assert!(bridge.validate_context(&valid_context));
    
    // Invalid context - empty task
    let invalid_context = AgentContext {
        task: "".to_string(),
        requirements: vec![],
        constraints: vec![],
        context_data: HashMap::new(),
        user_preferences: None,
        execution_context: ExecutionContext {
            session_id: "test_session".to_string(),
            user_id: Some("user123".to_string()),
            timestamp: SystemTime::now(),
            budget: 100.0,
            priority: Priority::Normal,
        },
    };
    
    assert!(!bridge.validate_context(&invalid_context));
}

#[tokio::test]
async fn test_session_id_generation() {
    let bridge = MCTSBridge::new();
    
    let session_id1 = bridge.generate_session_id();
    let session_id2 = bridge.generate_session_id();
    
    // Should generate unique IDs
    assert_ne!(session_id1, session_id2);
    assert!(session_id1.starts_with("session_"));
    assert!(session_id2.starts_with("session_"));
    
    // Should contain incremental counter
    assert!(session_id1.len() > 10);
    assert!(session_id2.len() > 10);
}

#[tokio::test]
async fn test_search_optimal_agents() {
    let config = MCTSConfig {
        max_iterations: 20,
        max_depth: 3,
        exploration_constant: 1.0,
        discount_factor: 0.9,
        time_limit: Duration::from_millis(2000),
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
    
    let context = MCTSBridge::create_test_context(
        "Analyze user query and provide comprehensive response".to_string(),
        "search_test_session".to_string(),
    );
    
    let available_agents = vec![
        "enhanced-planner-agent".to_string(),
        "enhanced-retriever-agent".to_string(),
        "enhanced-synthesizer-agent".to_string(),
    ];
    
    // Test with default options
    let result = bridge.search_optimal_agents(&context, &available_agents, None).await;
    assert!(result.is_ok(), "Search should succeed: {:?}", result);
    
    let search_result = result.unwrap();
    assert!(search_result.is_object());
    
    // Verify result structure
    let result_obj = search_result.as_object().unwrap();
    assert!(result_obj.contains_key("best_path"));
    assert!(result_obj.contains_key("confidence"));
    assert!(result_obj.contains_key("expected_reward"));
    assert!(result_obj.contains_key("search_statistics"));
    
    // Test with custom options
    let custom_options = SearchOptions {
        max_iterations: 10,
        max_depth: 2,
        time_limit: Duration::from_millis(1000),
        exploration_constant: 0.5,
        discount_factor: 0.8,
        parallel_simulations: 1,
        checkpoint_interval: 50,
        enable_caching: false,
        verbose_logging: false,
    };
    
    let result2 = bridge.search_optimal_agents(&context, &available_agents, Some(custom_options)).await;
    assert!(result2.is_ok(), "Search with custom options should succeed: {:?}", result2);
}

#[tokio::test]
async fn test_recommend_agents() {
    let mut bridge = MCTSBridge::new();
    bridge.initialize().await.expect("Failed to initialize");
    
    let context = MCTSBridge::create_test_context(
        "Quick recommendation test".to_string(),
        "recommendation_test".to_string(),
    );
    
    let available_agents = vec![
        "agent1".to_string(),
        "agent2".to_string(),
        "agent3".to_string(),
        "agent4".to_string(),
    ];
    
    // Test getting 3 recommendations
    let result = bridge.recommend_agents(&context, &available_agents, 3).await;
    assert!(result.is_ok(), "Recommendation should succeed: {:?}", result);
    
    let recommendations = result.unwrap();
    assert!(recommendations.is_object());
    
    let rec_obj = recommendations.as_object().unwrap();
    assert!(rec_obj.contains_key("recommendations"));
    assert!(rec_obj.contains_key("confidence"));
    assert!(rec_obj.contains_key("search_time_ms"));
    
    // Test getting more recommendations than available agents
    let result2 = bridge.recommend_agents(&context, &available_agents, 10).await;
    assert!(result2.is_ok(), "Should handle excessive recommendation count");
}

#[tokio::test]
async fn test_feedback_integration() {
    let mut bridge = MCTSBridge::new();
    bridge.initialize().await.expect("Failed to initialize");
    
    let session_id = "feedback_test_session";
    let agent_name = "test_agent";
    
    let reward = MCTSReward {
        value: 0.85,
        components: RewardComponents {
            quality: 0.9,
            speed: 0.8,
            cost: 0.85,
            user_satisfaction: Some(0.9),
        },
        metadata: RewardMetadata {
            tokens_used: 150,
            api_calls_made: 2,
            execution_time: Duration::from_millis(1500),
            agent_performance: HashMap::new(),
            timestamp: SystemTime::now(),
        },
    };
    
    // Test feedback update (currently a placeholder)
    let result = bridge.update_with_feedback(session_id, agent_name, &reward).await;
    assert!(result.is_ok(), "Feedback update should succeed: {:?}", result);
}

#[tokio::test]
async fn test_performance_stats() {
    let mut bridge = MCTSBridge::new();
    bridge.initialize().await.expect("Failed to initialize");
    
    let result = bridge.get_performance_stats().await;
    assert!(result.is_ok(), "Getting performance stats should succeed: {:?}", result);
    
    let stats = result.unwrap();
    assert!(stats.is_object());
    
    let stats_obj = stats.as_object().unwrap();
    assert!(stats_obj.contains_key("status"));
    assert_eq!(stats_obj["status"], "active");
}

#[tokio::test]
async fn test_config_management() {
    let initial_config = MCTSConfig {
        max_iterations: 100,
        max_depth: 5,
        exploration_constant: 1.4,
        discount_factor: 0.95,
        time_limit: Duration::from_millis(5000),
        enable_thompson_sampling: true,
        enable_bayesian_learning: true,
        enable_caching: false,
        parallel_simulations: 2,
        node_pool_size: 500,
        cache_config: None,
        checkpoint_interval: 100,
    };
    
    let mut bridge = MCTSBridge::with_config(initial_config.clone());
    bridge.initialize().await.expect("Failed to initialize");
    
    // Test getting config
    let config_json = bridge.get_config();
    assert!(config_json.is_object());
    assert_eq!(config_json["max_iterations"], 100);
    assert_eq!(config_json["enable_thompson_sampling"], true);
    
    // Test updating config
    let new_config = MCTSConfig {
        max_iterations: 200,
        enable_thompson_sampling: false,
        ..initial_config
    };
    
    let result = bridge.update_config(new_config).await;
    assert!(result.is_ok(), "Config update should succeed: {:?}", result);
    
    // Verify config was updated
    let updated_config = bridge.get_config();
    assert_eq!(updated_config["max_iterations"], 200);
    assert_eq!(updated_config["enable_thompson_sampling"], false);
}

#[tokio::test]
async fn test_error_handling() {
    let bridge = MCTSBridge::new();
    
    // Test operations on uninitialized bridge
    let context = MCTSBridge::create_test_context("test".to_string(), "test".to_string());
    let agents = vec!["agent1".to_string()];
    
    let result = bridge.search_optimal_agents(&context, &agents, None).await;
    assert!(result.is_err(), "Should fail on uninitialized bridge");
    assert!(result.unwrap_err().contains("not initialized"));
    
    let result2 = bridge.recommend_agents(&context, &agents, 1).await;
    assert!(result2.is_err(), "Should fail on uninitialized bridge");
    
    let result3 = bridge.get_performance_stats().await;
    assert!(result3.is_err(), "Should fail on uninitialized bridge");
}

#[tokio::test]
async fn test_concurrent_operations() {
    let mut bridge = MCTSBridge::new();
    bridge.initialize().await.expect("Failed to initialize");
    
    let context1 = MCTSBridge::create_test_context("Concurrent test 1".to_string(), "session1".to_string());
    let context2 = MCTSBridge::create_test_context("Concurrent test 2".to_string(), "session2".to_string());
    
    let agents = vec!["agent1".to_string(), "agent2".to_string()];
    
    // Run multiple operations concurrently
    let (result1, result2, result3) = tokio::join!(
        bridge.recommend_agents(&context1, &agents, 2),
        bridge.recommend_agents(&context2, &agents, 2),
        bridge.get_performance_stats()
    );
    
    assert!(result1.is_ok(), "Concurrent operation 1 should succeed");
    assert!(result2.is_ok(), "Concurrent operation 2 should succeed");
    assert!(result3.is_ok(), "Concurrent stats should succeed");
}

#[tokio::test] 
async fn test_search_with_various_parameters() {
    let mut bridge = MCTSBridge::new();
    bridge.initialize().await.expect("Failed to initialize");
    
    let context = MCTSBridge::create_test_context(
        "Parameter variation test".to_string(),
        "param_test".to_string(),
    );
    
    let agents = vec!["agent1".to_string(), "agent2".to_string(), "agent3".to_string()];
    
    // Test different parameter combinations
    let test_cases = vec![
        // (max_iterations, max_depth, time_limit_ms, exploration_constant)
        (5, 2, 500, 0.5),
        (20, 4, 1000, 1.0),
        (50, 6, 2000, 1.4),
        (100, 8, 3000, 2.0),
    ];
    
    for (iterations, depth, time_ms, exploration) in test_cases {
        let options = SearchOptions {
            max_iterations: iterations,
            max_depth: depth,
            time_limit: Duration::from_millis(time_ms),
            exploration_constant: exploration,
            discount_factor: 0.9,
            parallel_simulations: 1,
            checkpoint_interval: 10,
            enable_caching: false,
            verbose_logging: false,
        };
        
        let result = bridge.search_optimal_agents(&context, &agents, Some(options)).await;
        assert!(
            result.is_ok(), 
            "Search should succeed with params: iter={}, depth={}, time={}ms, exp={}: {:?}",
            iterations, depth, time_ms, exploration, result
        );
        
        let search_result = result.unwrap();
        assert!(search_result.is_object());
        
        // Verify that search respects time limits (approximately)
        if let Some(stats) = search_result.get("search_statistics") {
            if let Some(search_time) = stats.get("search_time") {
                let search_time_ms = search_time.as_u64().unwrap_or(0);
                // Allow some overhead, but search should generally respect time limits
                assert!(
                    search_time_ms <= (time_ms + 1000) as u64,
                    "Search took {}ms but limit was {}ms", 
                    search_time_ms, time_ms
                );
            }
        }
    }
}

#[test]
fn test_helper_functions() {
    // Test config creation from JSON
    let json_config = serde_json::json!({
        "maxIterations": 150,
        "maxDepth": 7,
        "explorationConstant": 1.2,
        "timeLimitMs": 8000,
        "enableThompsonSampling": true,
        "enableBayesianLearning": false,
        "enableCaching": true
    });
    
    let config = create_config_from_json(&json_config);
    assert!(config.is_ok(), "Config creation should succeed: {:?}", config);
    
    let config = config.unwrap();
    assert_eq!(config.max_iterations, 150);
    assert_eq!(config.max_depth, 7);
    assert_eq!(config.exploration_constant, 1.2);
    assert_eq!(config.time_limit, Duration::from_millis(8000));
    assert_eq!(config.enable_thompson_sampling, true);
    assert_eq!(config.enable_bayesian_learning, false);
    assert_eq!(config.enable_caching, true);
}

#[test]
fn test_search_options_creation() {
    let options = MCTSBridge::create_search_options(
        Some(75),
        Some(6),
        Some(3000)
    );
    
    assert_eq!(options.max_iterations, 75);
    assert_eq!(options.max_depth, 6);
    assert_eq!(options.time_limit, Duration::from_millis(3000));
    
    // Test with None values
    let options2 = MCTSBridge::create_search_options(None, None, None);
    let default_options = SearchOptions::default();
    
    assert_eq!(options2.max_iterations, default_options.max_iterations);
    assert_eq!(options2.max_depth, default_options.max_depth);
    assert_eq!(options2.time_limit, default_options.time_limit);
}

#[test]
fn test_json_serialization_helpers() {
    let context = MCTSBridge::create_test_context(
        "Serialization test".to_string(),
        "serial_test".to_string(),
    );
    
    // Test context serialization
    let context_json = serialize_agent_context(&context);
    assert!(context_json.is_object());
    assert_eq!(context_json["task"], "Serialization test");
    
    // Test deserialization
    let deserialized = deserialize_agent_context(&context_json);
    assert!(deserialized.is_ok(), "Deserialization should succeed: {:?}", deserialized);
    
    let deserialized_context = deserialized.unwrap();
    assert_eq!(deserialized_context.task, "Serialization test");
    assert_eq!(deserialized_context.execution_context.session_id, "serial_test");
}

#[tokio::test]
async fn test_bridge_reset() {
    let mut bridge = MCTSBridge::new();
    bridge.initialize().await.expect("Failed to initialize");
    
    // Perform some operations first
    let context = MCTSBridge::create_test_context("Reset test".to_string(), "reset_session".to_string());
    let agents = vec!["agent1".to_string()];
    
    let _result = bridge.recommend_agents(&context, &agents, 1).await;
    
    // Test reset
    let reset_result = bridge.reset().await;
    assert!(reset_result.is_ok(), "Reset should succeed: {:?}", reset_result);
    
    // Bridge should still be operational after reset
    assert!(bridge.is_ready());
    
    let health = bridge.health_check().await;
    assert_eq!(health["bridge_status"], "healthy");
}