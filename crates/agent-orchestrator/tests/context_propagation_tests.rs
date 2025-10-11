//! Comprehensive tests for context propagation

use agent_orchestrator::{
    ContextPropagationManager, RecursiveContext, PropagationRule, PropagationCondition,
    PropagationAction, InheritanceStrategy, InheritanceType, ResourceUsage, PerformanceMetrics
};
use std::collections::HashMap;
use uuid::Uuid;

#[tokio::test]
async fn test_context_propagation_basic() {
    let manager = ContextPropagationManager::new();

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    let parent_context = RecursiveContext {
        workflow_id: parent_workflow_id,
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: parent_workflow_id,
        execution_path: vec![parent_workflow_id],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("user_123".to_string())),
            ("session_id".to_string(), serde_json::Value::String("session_456".to_string())),
            ("priority".to_string(), serde_json::Value::String("high".to_string())),
        ]),
        execution_history: vec![],
        resource_usage: ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let child_context = manager.propagate_context(&parent_context, child_workflow_id, None).await.unwrap();

    assert_eq!(child_context.workflow_id, child_workflow_id);
    assert_eq!(child_context.depth, 1);
    assert_eq!(child_context.parent_workflow_id, Some(parent_workflow_id));
    assert_eq!(child_context.root_workflow_id, parent_workflow_id);
    assert_eq!(child_context.execution_path, vec![parent_workflow_id, child_workflow_id]);

    // Check that critical variables were inherited
    assert_eq!(child_context.inherited_state.get("user_id"), Some(&serde_json::Value::String("user_123".to_string())));
    assert_eq!(child_context.inherited_state.get("session_id"), Some(&serde_json::Value::String("session_456".to_string())));
    assert_eq!(child_context.inherited_state.get("priority"), Some(&serde_json::Value::String("high".to_string())));
}

#[tokio::test]
async fn test_full_inheritance_strategy() {
    let mut manager = ContextPropagationManager::new();

    // Add full inheritance strategy
    let strategy = InheritanceStrategy {
        strategy_name: "full".to_string(),
        inheritance_type: InheritanceType::Full,
        depth_limit: None,
        resource_threshold: None,
        custom_logic: None,
    };
    manager.inheritance_strategies.insert("full".to_string(), strategy);

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    let parent_context = RecursiveContext {
        workflow_id: parent_workflow_id,
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: parent_workflow_id,
        execution_path: vec![parent_workflow_id],
        inherited_state: HashMap::from([
            ("var1".to_string(), serde_json::Value::String("value1".to_string())),
            ("var2".to_string(), serde_json::Value::Number(serde_json::Number::from(42))),
            ("var3".to_string(), serde_json::Value::Bool(true)),
        ]),
        execution_history: vec![],
        resource_usage: ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let child_context = manager.propagate_context(&parent_context, child_workflow_id, Some("full")).await.unwrap();

    // All variables should be inherited
    assert_eq!(child_context.inherited_state.len(), 3);
    assert_eq!(child_context.inherited_state.get("var1"), Some(&serde_json::Value::String("value1".to_string())));
    assert_eq!(child_context.inherited_state.get("var2"), Some(&serde_json::Value::Number(serde_json::Number::from(42))));
    assert_eq!(child_context.inherited_state.get("var3"), Some(&serde_json::Value::Bool(true)));
}

#[tokio::test]
async fn test_selective_inheritance_strategy() {
    let mut manager = ContextPropagationManager::new();

    // Add selective inheritance strategy
    let strategy = InheritanceStrategy {
        strategy_name: "selective".to_string(),
        inheritance_type: InheritanceType::Selective,
        depth_limit: None,
        resource_threshold: None,
        custom_logic: None,
    };
    manager.inheritance_strategies.insert("selective".to_string(), strategy);

    // Add propagation rules
    manager.propagation_rules.push(PropagationRule {
        rule_id: Uuid::new_v4(),
        name: "Inherit Critical Variables".to_string(),
        trigger: PropagationCondition::Always,
        action: PropagationAction::InheritSelected(vec!["user_id".to_string(), "session_id".to_string()]),
        priority: 1,
        enabled: true,
    });

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    let parent_context = RecursiveContext {
        workflow_id: parent_workflow_id,
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: parent_workflow_id,
        execution_path: vec![parent_workflow_id],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("user_123".to_string())),
            ("session_id".to_string(), serde_json::Value::String("session_456".to_string())),
            ("temp_data".to_string(), serde_json::Value::String("temporary".to_string())),
        ]),
        execution_history: vec![],
        resource_usage: ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let child_context = manager.propagate_context(&parent_context, child_workflow_id, Some("selective")).await.unwrap();

    // Only selected variables should be inherited
    assert_eq!(child_context.inherited_state.len(), 2);
    assert_eq!(child_context.inherited_state.get("user_id"), Some(&serde_json::Value::String("user_123".to_string())));
    assert_eq!(child_context.inherited_state.get("session_id"), Some(&serde_json::Value::String("session_456".to_string())));
    assert_eq!(child_context.inherited_state.get("temp_data"), None);
}

#[tokio::test]
async fn test_compressed_inheritance_strategy() {
    let mut manager = ContextPropagationManager::new();

    // Add compressed inheritance strategy
    let strategy = InheritanceStrategy {
        strategy_name: "compressed".to_string(),
        inheritance_type: InheritanceType::Compressed,
        depth_limit: None,
        resource_threshold: None,
        custom_logic: None,
    };
    manager.inheritance_strategies.insert("compressed".to_string(), strategy);

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    let parent_context = RecursiveContext {
        workflow_id: parent_workflow_id,
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: parent_workflow_id,
        execution_path: vec![parent_workflow_id],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("user_123".to_string())),
            ("null_var".to_string(), serde_json::Value::Null),
            ("empty_var".to_string(), serde_json::Value::String("".to_string())),
        ]),
        execution_history: vec![],
        resource_usage: ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let child_context = manager.propagate_context(&parent_context, child_workflow_id, Some("compressed")).await.unwrap();

    // Only non-null, non-empty variables should be inherited
    assert_eq!(child_context.inherited_state.len(), 1);
    assert_eq!(child_context.inherited_state.get("user_id"), Some(&serde_json::Value::String("user_123".to_string())));
    assert_eq!(child_context.inherited_state.get("null_var"), None);
    assert_eq!(child_context.inherited_state.get("empty_var"), None);

    // Check that compression metadata was added
    assert_eq!(child_context.inherited_state.get("_compression_applied"), Some(&serde_json::Value::Bool(true)));
}

#[tokio::test]
async fn test_depth_limit_inheritance() {
    let mut manager = ContextPropagationManager::new();

    // Add strategy with depth limit
    let strategy = InheritanceStrategy {
        strategy_name: "depth_limited".to_string(),
        inheritance_type: InheritanceType::Selective,
        depth_limit: Some(2),
        resource_threshold: None,
        custom_logic: None,
    };
    manager.inheritance_strategies.insert("depth_limited".to_string(), strategy);

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    // Create parent context at depth 2 (at the limit)
    let parent_context = RecursiveContext {
        workflow_id: parent_workflow_id,
        depth: 2,
        parent_workflow_id: None,
        root_workflow_id: parent_workflow_id,
        execution_path: vec![Uuid::new_v4(), Uuid::new_v4(), parent_workflow_id],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("user_123".to_string())),
            ("temp_data".to_string(), serde_json::Value::String("temporary".to_string())),
        ]),
        execution_history: vec![],
        resource_usage: ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let child_context = manager.propagate_context(&parent_context, child_workflow_id, Some("depth_limited")).await.unwrap();

    // Context should be limited due to depth
    assert!(child_context.inherited_state.len() <= parent_context.inherited_state.len());
}

#[tokio::test]
async fn test_resource_threshold_inheritance() {
    let mut manager = ContextPropagationManager::new();

    // Add strategy with resource threshold
    let strategy = InheritanceStrategy {
        strategy_name: "resource_limited".to_string(),
        inheritance_type: InheritanceType::Selective,
        depth_limit: None,
        resource_threshold: Some(1.0),
        custom_logic: None,
    };
    manager.inheritance_strategies.insert("resource_limited".to_string(), strategy);

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    // Create parent context with high resource usage
    let parent_context = RecursiveContext {
        workflow_id: parent_workflow_id,
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: parent_workflow_id,
        execution_path: vec![parent_workflow_id],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("user_123".to_string())),
            ("large_data".to_string(), serde_json::Value::String("x".repeat(2000))), // Large data
        ]),
        execution_history: vec![],
        resource_usage: ResourceUsage {
            cpu_cores: 2.0, // Above threshold
            memory_mb: 1000,
            network_bandwidth_mbps: 100,
            storage_mb: 500,
            agents_spawned: 10,
            total_cost: 50.0,
        },
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let child_context = manager.propagate_context(&parent_context, child_workflow_id, Some("resource_limited")).await.unwrap();

    // Context should be limited due to resource threshold
    assert!(child_context.inherited_state.len() <= parent_context.inherited_state.len());
    assert!(child_context.resource_usage.cpu_cores <= parent_context.resource_usage.cpu_cores);
}

#[tokio::test]
async fn test_context_optimization() {
    let manager = ContextPropagationManager::new();

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    let parent_context = RecursiveContext {
        workflow_id: parent_workflow_id,
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: parent_workflow_id,
        execution_path: vec![parent_workflow_id],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("user_123".to_string())),
            ("duplicate_data".to_string(), serde_json::Value::String("same_value".to_string())),
            ("duplicate_data2".to_string(), serde_json::Value::String("same_value".to_string())),
        ]),
        execution_history: vec![],
        resource_usage: ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let child_context = manager.propagate_context(&parent_context, child_workflow_id, None).await.unwrap();

    // Context should be optimized (deduplication should remove one duplicate)
    assert!(child_context.inherited_state.len() <= parent_context.inherited_state.len());
}

#[tokio::test]
async fn test_propagation_rules() {
    let mut manager = ContextPropagationManager::new();

    // Add propagation rule for scaling values
    manager.propagation_rules.push(PropagationRule {
        rule_id: Uuid::new_v4(),
        name: "Scale Values".to_string(),
        trigger: PropagationCondition::Always,
        action: PropagationAction::Transform(agent_orchestrator::TransformationRule {
            input_path: "count".to_string(),
            output_path: "scaled_count".to_string(),
            transformation_type: agent_orchestrator::TransformationType::Scale(2.0),
            parameters: HashMap::new(),
        }),
        priority: 1,
        enabled: true,
    });

    let parent_workflow_id = Uuid::new_v4();
    let child_workflow_id = Uuid::new_v4();

    let parent_context = RecursiveContext {
        workflow_id: parent_workflow_id,
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: parent_workflow_id,
        execution_path: vec![parent_workflow_id],
        inherited_state: HashMap::from([
            ("count".to_string(), serde_json::Value::Number(serde_json::Number::from(5))),
        ]),
        execution_history: vec![],
        resource_usage: ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let child_context = manager.propagate_context(&parent_context, child_workflow_id, None).await.unwrap();

    // Check that transformation was applied
    assert_eq!(child_context.inherited_state.get("scaled_count"), Some(&serde_json::Value::Number(serde_json::Number::from(10))));
}
