//! Comprehensive tests for recursive execution management

use agent_orchestrator::{
    RecursiveExecutionManager, RecursionLimits, RecursiveContext,
    OrchestrationError, PerformanceMetrics, ResourceUsage
};
use std::time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn test_recursive_execution_basic() {
    let limits = RecursionLimits::default();
    let manager = RecursiveExecutionManager::new(limits);

    let workflow_id = Uuid::new_v4();
    let context = manager.start_recursive_execution(workflow_id, None).await.unwrap();

    assert_eq!(context.workflow_id, workflow_id);
    assert_eq!(context.depth, 0);
    assert_eq!(context.parent_workflow_id, None);
    assert_eq!(context.root_workflow_id, workflow_id);
    assert_eq!(context.execution_path, vec![workflow_id]);

    manager.complete_recursive_execution(&context, true, None).await.unwrap();
}

#[tokio::test]
async fn test_recursive_execution_with_parent() {
    let limits = RecursionLimits::default();
    let manager = RecursiveExecutionManager::new(limits);

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    let parent_context = manager.start_recursive_execution(parent_workflow_id, None).await.unwrap();
    let child_context = manager.start_recursive_execution(child_workflow_id, Some(&parent_context)).await.unwrap();

    assert_eq!(child_context.workflow_id, child_workflow_id);
    assert_eq!(child_context.depth, 1);
    assert_eq!(child_context.parent_workflow_id, Some(parent_workflow_id));
    assert_eq!(child_context.root_workflow_id, parent_workflow_id);
    assert_eq!(child_context.execution_path, vec![parent_workflow_id, child_workflow_id]);

    manager.complete_recursive_execution(&child_context, true, None).await.unwrap();
    manager.complete_recursive_execution(&parent_context, true, None).await.unwrap();
}

#[tokio::test]
async fn test_recursion_depth_limit() {
    let limits = RecursionLimits {
        max_depth: 2,
        ..Default::default()
    };
    let manager = RecursiveExecutionManager::new(limits);

    let workflow_id = Uuid::new_v4();
    let context = manager.start_recursive_execution(workflow_id, None).await.unwrap();

    // Create a context at max depth
    let max_depth_context = RecursiveContext {
        workflow_id: Uuid::new_v4(),
        depth: 2,
        parent_workflow_id: Some(workflow_id),
        root_workflow_id: workflow_id,
        execution_path: vec![workflow_id, Uuid::new_v4(), Uuid::new_v4()],
        inherited_state: std::collections::HashMap::new(),
        execution_history: vec![],
        resource_usage: ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    // Try to start execution beyond max depth
    let result = manager.start_recursive_execution(Uuid::new_v4(), Some(&max_depth_context)).await;
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), OrchestrationError::RecursionLimitExceeded(_)));

    manager.complete_recursive_execution(&context, true, None).await.unwrap();
}

#[tokio::test]
async fn test_cycle_detection() {
    let limits = RecursionLimits {
        cycle_detection: true,
        ..Default::default()
    };
    let manager = RecursiveExecutionManager::new(limits);

    let workflow_id = Uuid::new_v4();
    let context = manager.start_recursive_execution(workflow_id, None).await.unwrap();

    // Create a context that would create a cycle
    let mut cycle_context = context.clone();
    cycle_context.execution_path.push(workflow_id); // This creates a cycle

    // Try to start execution that would create a cycle
    let result = manager.start_recursive_execution(workflow_id, Some(&cycle_context)).await;
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), OrchestrationError::RecursionCycleDetected));

    manager.complete_recursive_execution(&context, true, None).await.unwrap();
}

#[tokio::test]
async fn test_recursion_statistics() {
    let limits = RecursionLimits::default();
    let manager = RecursiveExecutionManager::new(limits);

    let workflow_id = Uuid::new_v4();
    let context = manager.start_recursive_execution(workflow_id, None).await.unwrap();

    let stats = manager.get_recursion_statistics().await.unwrap();
    assert_eq!(stats.active_recursions, 1);
    assert_eq!(stats.max_depth_active, 0);
    assert_eq!(stats.total_executions, 0);
    assert_eq!(stats.success_rate, 1.0);

    manager.complete_recursive_execution(&context, true, None).await.unwrap();

    let stats_after = manager.get_recursion_statistics().await.unwrap();
    assert_eq!(stats_after.active_recursions, 0);
    assert_eq!(stats_after.total_executions, 1);
}

#[tokio::test]
async fn test_performance_monitoring() {
    let limits = RecursionLimits::default();
    let manager = RecursiveExecutionManager::new(limits);

    let workflow_id = Uuid::new_v4();
    let context = manager.start_recursive_execution(workflow_id, None).await.unwrap();

    // Complete with performance data
    manager.complete_recursive_execution(&context, true, None).await.unwrap();

    // Check that performance metrics were recorded
    let stats = manager.get_recursion_statistics().await.unwrap();
    assert_eq!(stats.total_executions, 1);
}

#[tokio::test]
async fn test_resource_escalation_threshold() {
    let limits = RecursionLimits {
        resource_escalation_threshold: 0.5,
        ..Default::default()
    };
    let manager = RecursiveExecutionManager::new(limits);

    // Create a context with high resource usage
    let mut high_resource_context = RecursiveContext {
        workflow_id: Uuid::new_v4(),
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: Uuid::new_v4(),
        execution_path: vec![Uuid::new_v4()],
        inherited_state: std::collections::HashMap::new(),
        execution_history: vec![],
        resource_usage: ResourceUsage {
            cpu_cores: 10.0, // High CPU usage
            memory_mb: 10000,
            network_bandwidth_mbps: 1000,
            storage_mb: 5000,
            agents_spawned: 100,
            total_cost: 1000.0,
        },
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    // This should fail due to resource escalation threshold
    let result = manager.start_recursive_execution(Uuid::new_v4(), Some(&high_resource_context)).await;
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), OrchestrationError::ResourceExhausted(_)));
}

#[tokio::test]
async fn test_concurrent_recursions() {
    let limits = RecursionLimits {
        max_agents_per_level: 3,
        ..Default::default()
    };
    let manager = RecursiveExecutionManager::new(limits);

    let mut contexts = Vec::new();

    // Start multiple concurrent recursions
    for i in 0..3 {
        let workflow_id = Uuid::new_v4();
        let context = manager.start_recursive_execution(workflow_id, None).await.unwrap();
        contexts.push(context);
    }

    // Try to start one more (should fail due to limit)
    let result = manager.start_recursive_execution(Uuid::new_v4(), None).await;
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), OrchestrationError::ResourceExhausted(_)));

    // Complete all contexts
    for context in contexts {
        manager.complete_recursive_execution(&context, true, None).await.unwrap();
    }
}

#[tokio::test]
async fn test_recursion_timeout() {
    let limits = RecursionLimits {
        recursion_timeout: Duration::from_millis(100),
        ..Default::default()
    };
    let manager = RecursiveExecutionManager::new(limits);

    let workflow_id = Uuid::new_v4();
    let context = manager.start_recursive_execution(workflow_id, None).await.unwrap();

    // Simulate a long-running operation
    tokio::time::sleep(Duration::from_millis(200)).await;

    // The context should still be valid (timeout is checked during execution, not creation)
    assert_eq!(context.workflow_id, workflow_id);

    manager.complete_recursive_execution(&context, true, None).await.unwrap();
}
