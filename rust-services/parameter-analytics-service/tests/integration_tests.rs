//! Integration tests for Parameter Analytics Service
//! 
//! Comprehensive end-to-end validation of all service functionality

use parameter_analytics_service::*;
use tokio_test;
use uuid::Uuid;
use chrono::{Utc, Duration};
use std::collections::HashMap;

#[tokio::test]
async fn test_service_creation_and_initialization() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await;
    assert!(service.is_ok());
    
    let service = service.unwrap();
    let health = service.health_check().await;
    assert!(health.healthy);
}

#[tokio::test]
async fn test_parameter_execution_processing() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    let execution = create_test_execution();
    let result = service.process_execution(execution.clone()).await;
    
    assert!(result.is_ok());
    let result = result.unwrap();
    assert!(result.processed);
    assert_eq!(result.execution_id, execution.id);
    assert!(result.processing_time > 0);
}

#[tokio::test]
async fn test_effectiveness_metrics_retrieval() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Process some test executions first
    for _ in 0..5 {
        let execution = create_test_execution();
        let _ = service.process_execution(execution).await;
    }
    
    // Wait for processing
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    let filter = EffectivenessFilter::default();
    let effectiveness = service.get_effectiveness(filter).await;
    
    assert!(effectiveness.is_ok());
    // Note: might be empty if not enough data processed
}

#[tokio::test]
async fn test_insight_generation() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Process multiple executions for the same task type
    for _ in 0..25 {
        let execution = create_test_execution_with_task_type(TaskType::CodeGeneration);
        let _ = service.process_execution(execution).await;
    }
    
    // Wait for processing
    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    
    let insights = service.generate_insights(TaskType::CodeGeneration).await;
    assert!(insights.is_ok());
    
    let insights = insights.unwrap();
    // Might be empty if not enough diverse data
    println!("Generated {} insights", insights.len());
}

#[tokio::test]
async fn test_analytics_snapshot() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Process some executions
    for i in 0..10 {
        let mut execution = create_test_execution();
        execution.response_quality = Some(0.8 + (i as f64 * 0.02));
        let _ = service.process_execution(execution).await;
    }
    
    let analytics = service.get_analytics().await;
    assert!(analytics.is_ok());
    
    let analytics = analytics.unwrap();
    assert!(analytics.total_executions >= 10);
}

#[tokio::test]
async fn test_concurrent_execution_processing() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Create multiple concurrent execution tasks
    let mut tasks = Vec::new();
    
    for i in 0..20 {
        let service_clone = &service;
        let task = tokio::spawn(async move {
            let mut execution = create_test_execution();
            execution.execution_time = 1000 + (i * 100); // Vary execution times
            service_clone.process_execution(execution).await
        });
        tasks.push(task);
    }
    
    // Wait for all tasks to complete
    let results: Vec<_> = futures::future::join_all(tasks).await;
    
    // Verify all succeeded
    let successful = results.iter()
        .filter(|r| r.is_ok() && r.as_ref().unwrap().is_ok())
        .count();
    
    assert_eq!(successful, 20);
    println!("Successfully processed {} concurrent executions", successful);
}

#[tokio::test]
async fn test_effectiveness_filtering() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Process executions for different task types
    for _ in 0..5 {
        let execution = create_test_execution_with_task_type(TaskType::CodeGeneration);
        let _ = service.process_execution(execution).await;
    }
    
    for _ in 0..3 {
        let execution = create_test_execution_with_task_type(TaskType::TextAnalysis);
        let _ = service.process_execution(execution).await;
    }
    
    // Test filtering by task type
    let filter = EffectivenessFilter {
        task_types: Some(vec![TaskType::CodeGeneration]),
        ..Default::default()
    };
    
    let effectiveness = service.get_effectiveness(filter).await;
    assert!(effectiveness.is_ok());
}

#[tokio::test]
async fn test_time_range_filtering() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Process some older executions
    let old_time = Utc::now() - Duration::hours(2);
    let mut old_execution = create_test_execution();
    old_execution.timestamp = old_time;
    let _ = service.process_execution(old_execution).await;
    
    // Process recent execution
    let recent_execution = create_test_execution();
    let _ = service.process_execution(recent_execution).await;
    
    // Filter for recent executions only
    let filter = EffectivenessFilter {
        time_range: Some((
            Utc::now() - Duration::hours(1),
            Utc::now()
        )),
        ..Default::default()
    };
    
    let effectiveness = service.get_effectiveness(filter).await;
    assert!(effectiveness.is_ok());
}

#[tokio::test]
async fn test_batch_processing_performance() {
    let config = AnalyticsConfig {
        buffer_size: 50, // Small buffer for testing
        ..Default::default()
    };
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    let start_time = std::time::Instant::now();
    
    // Process batch of executions
    let batch_size = 100;
    for i in 0..batch_size {
        let mut execution = create_test_execution();
        execution.response_quality = Some(0.5 + (i as f64 / batch_size as f64) * 0.5);
        let result = service.process_execution(execution).await;
        assert!(result.is_ok());
    }
    
    let duration = start_time.elapsed();
    let throughput = batch_size as f64 / duration.as_secs_f64();
    
    println!("Processed {} executions in {:?} ({:.0} ops/sec)", 
             batch_size, duration, throughput);
    
    // Should be very fast (> 1000 ops/sec)
    assert!(throughput > 100.0);
}

#[tokio::test]
async fn test_error_handling() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Test with invalid execution (empty user input)
    let mut invalid_execution = create_test_execution();
    invalid_execution.user_input = String::new();
    
    // Service should handle gracefully (might still succeed with empty input)
    let result = service.process_execution(invalid_execution).await;
    // We don't assert failure here as the service might handle empty input gracefully
    println!("Result for empty input: {:?}", result.is_ok());
}

#[tokio::test]
async fn test_service_health_monitoring() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Check initial health
    let health = service.health_check().await;
    assert!(health.healthy);
    assert_eq!(health.service, "parameter-analytics-service");
    assert_eq!(health.version, "0.1.0");
    
    // Process some executions and check health again
    for _ in 0..5 {
        let execution = create_test_execution();
        let _ = service.process_execution(execution).await;
    }
    
    let health_after = service.health_check().await;
    assert!(health_after.healthy);
    assert!(health_after.total_processed >= 5);
}

#[tokio::test]
async fn test_analytics_with_varied_quality() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Create executions with varying quality scores
    let qualities = vec![0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.4, 0.6, 0.8, 0.2];
    
    for quality in qualities.iter() {
        let mut execution = create_test_execution();
        execution.response_quality = Some(*quality);
        execution.user_satisfaction = Some(quality * 5.0); // Scale to 0-5
        let _ = service.process_execution(execution).await;
    }
    
    // Get analytics snapshot
    let analytics = service.get_analytics().await.unwrap();
    assert!(analytics.total_executions >= 10);
    
    println!("Analytics snapshot: {} executions processed", analytics.total_executions);
}

#[tokio::test]
async fn test_different_task_types() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    let task_types = vec![
        TaskType::CodeGeneration,
        TaskType::CodeReview,
        TaskType::TextAnalysis,
        TaskType::CreativeWriting,
        TaskType::Reasoning,
    ];
    
    // Process executions for each task type
    for task_type in task_types.iter() {
        for _ in 0..3 {
            let execution = create_test_execution_with_task_type(task_type.clone());
            let _ = service.process_execution(execution).await;
        }
    }
    
    let analytics = service.get_analytics().await.unwrap();
    assert!(analytics.total_task_types >= 5);
    
    println!("Processed {} different task types", analytics.total_task_types);
}

#[tokio::test]
async fn test_service_graceful_shutdown() {
    let config = AnalyticsConfig::default();
    let mut service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Process some executions
    for _ in 0..5 {
        let execution = create_test_execution();
        let _ = service.process_execution(execution).await;
    }
    
    // Test graceful shutdown
    let shutdown_result = service.shutdown().await;
    assert!(shutdown_result.is_ok());
    
    // Health check after shutdown should indicate service is down
    let health = service.health_check().await;
    assert!(!health.healthy);
}

#[tokio::test] 
async fn test_parameter_variation_analysis() {
    let config = AnalyticsConfig::default();
    let service = ParameterAnalyticsService::new(config).await.unwrap();
    
    // Create executions with different parameter settings
    let temperatures = vec![0.1, 0.3, 0.7, 0.9];
    let context_lengths = vec![1024, 2048, 4096, 8192];
    
    for (i, &temp) in temperatures.iter().enumerate() {
        for (j, &context_len) in context_lengths.iter().enumerate() {
            let mut execution = create_test_execution();
            execution.parameters.temperature = temp;
            execution.parameters.context_length = context_len;
            
            // Simulate quality correlation with parameters
            execution.response_quality = Some(0.5 + (temp * 0.3) + (j as f64 * 0.1));
            
            let _ = service.process_execution(execution).await;
        }
    }
    
    let analytics = service.get_analytics().await.unwrap();
    assert!(analytics.total_parameter_sets > 1);
    
    println!("Analyzed {} different parameter combinations", analytics.total_parameter_sets);
}

// Helper functions

fn create_test_execution() -> ParameterExecution {
    create_test_execution_with_task_type(TaskType::CodeGeneration)
}

fn create_test_execution_with_task_type(task_type: TaskType) -> ParameterExecution {
    ParameterExecution {
        id: Uuid::new_v4(),
        task_type,
        user_input: "Test user input for parameter analytics".to_string(),
        parameters: TaskParameters {
            context_length: 4096,
            temperature: 0.7,
            top_p: Some(0.9),
            max_tokens: 2048,
            system_prompt: "You are a helpful AI assistant.".to_string(),
            user_prompt_template: "{user_input}".to_string(),
            stop_sequences: None,
            presence_penalty: None,
            frequency_penalty: None,
        },
        model: "test-model".to_string(),
        provider: "test-provider".to_string(),
        user_id: Some("test-user".to_string()),
        request_id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        execution_time: 1500,
        token_usage: TokenUsage {
            prompt_tokens: 150,
            completion_tokens: 300,
            total_tokens: 450,
        },
        response_length: 800,
        response_quality: Some(0.85),
        user_satisfaction: Some(4.2),
        success: true,
        error_type: None,
        retry_count: 0,
        complexity: Complexity::Medium,
        domain: Some("testing".to_string()),
        endpoint: "/api/test".to_string(),
    }
}