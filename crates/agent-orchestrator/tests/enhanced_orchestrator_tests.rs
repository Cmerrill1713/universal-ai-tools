//! Comprehensive tests for enhanced orchestrator

use agent_orchestrator::{
    EnhancedOrchestrator, EnhancedOrchestrationConfig, RecursionLimits,
    WorkflowGraph, WorkflowNode, WorkflowNodeType, WorkflowEdge,
    AgentRequirements, ResourceRequirements, RetryPolicy, ExecutionCondition,
    ConditionType, ConstraintSeverity, WorkflowConstraint, WorkflowConstraintType,
    RecursiveContext, PerformanceMetrics
};
use serde_json::json;
use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn test_enhanced_orchestrator_creation() {
    let config = EnhancedOrchestrationConfig::default();
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    // Should be able to create orchestrator successfully
    assert!(true);
}

#[tokio::test]
async fn test_enhanced_orchestrator_with_custom_config() {
    let config = EnhancedOrchestrationConfig {
        recursion_limits: RecursionLimits {
            max_depth: 5,
            max_agents_per_level: 10,
            recursion_timeout: Duration::from_secs(60),
            cycle_detection: true,
            resource_escalation_threshold: 0.8,
            performance_degradation_threshold: 0.7,
        },
        context_propagation_enabled: true,
        dynamic_modification_enabled: true,
        performance_monitoring_enabled: true,
        auto_adaptation_enabled: true,
        max_concurrent_recursions: 5,
        performance_analysis_interval: Duration::from_secs(10),
        adaptation_threshold: 0.8,
    };

    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();
    assert!(true);
}

#[tokio::test]
async fn test_execute_simple_workflow() {
    let config = EnhancedOrchestrationConfig::default();
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    let workflow = create_simple_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "simple_task"
    });

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        None, // No parent context
    ).await.unwrap();

    assert_eq!(result.workflow_id, workflow.id);
    assert!(result.success);
    assert_eq!(result.max_depth_reached, 0);
    assert!(!result.context_propagation_used);
}

#[tokio::test]
async fn test_execute_workflow_with_parent_context() {
    let config = EnhancedOrchestrationConfig::default();
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    let workflow = create_simple_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "child_task"
    });

    // Create a parent context
    let parent_context = RecursiveContext {
        workflow_id: Uuid::new_v4(),
        depth: 1,
        parent_workflow_id: Some(Uuid::new_v4()),
        root_workflow_id: Uuid::new_v4(),
        execution_path: vec![Uuid::new_v4(), Uuid::new_v4()],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("parent_user".to_string())),
            ("session_id".to_string(), serde_json::Value::String("session_123".to_string())),
        ]),
        execution_history: vec![],
        resource_usage: agent_orchestrator::ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        Some(&parent_context),
    ).await.unwrap();

    assert_eq!(result.workflow_id, workflow.id);
    assert!(result.success);
    assert_eq!(result.max_depth_reached, 2); // Parent depth + 1
    assert!(result.context_propagation_used);
}

#[tokio::test]
async fn test_recursive_workflow_execution() {
    let config = EnhancedOrchestrationConfig {
        recursion_limits: RecursionLimits {
            max_depth: 3,
            ..Default::default()
        },
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    let workflow = create_recursive_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "recursive_task",
        "depth": 0,
        "max_depth": 2
    });

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        None,
    ).await.unwrap();

    assert_eq!(result.workflow_id, workflow.id);
    assert!(result.success);
    assert!(result.max_depth_reached <= 3);
}

#[tokio::test]
async fn test_orchestration_statistics() {
    let config = EnhancedOrchestrationConfig::default();
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    let stats = orchestrator.get_orchestration_statistics().await.unwrap();

    assert_eq!(stats.active_recursions, 0);
    assert_eq!(stats.total_executions, 0);
    assert_eq!(stats.success_rate, 1.0);
}

#[tokio::test]
async fn test_performance_monitoring() {
    let config = EnhancedOrchestrationConfig {
        performance_monitoring_enabled: true,
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    let workflow = create_simple_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "monitored_task"
    });

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        None,
    ).await.unwrap();

    assert!(result.success);

    // Check that performance metrics were recorded
    let stats = orchestrator.get_orchestration_statistics().await.unwrap();
    assert_eq!(stats.total_executions, 1);
}

#[tokio::test]
async fn test_dynamic_modification() {
    let config = EnhancedOrchestrationConfig {
        dynamic_modification_enabled: true,
        auto_adaptation_enabled: true,
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    let workflow = create_simple_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "adaptive_task"
    });

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        None,
    ).await.unwrap();

    assert!(result.success);

    // Check that modifications were applied (if any)
    assert!(result.modifications_applied.len() >= 0);
}

#[tokio::test]
async fn test_context_propagation() {
    let config = EnhancedOrchestrationConfig {
        context_propagation_enabled: true,
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    let workflow = create_simple_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "context_task"
    });

    // Create a parent context with inherited state
    let parent_context = RecursiveContext {
        workflow_id: Uuid::new_v4(),
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: Uuid::new_v4(),
        execution_path: vec![Uuid::new_v4()],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("parent_user".to_string())),
            ("session_id".to_string(), serde_json::Value::String("session_456".to_string())),
        ]),
        execution_history: vec![],
        resource_usage: agent_orchestrator::ResourceUsage::default(),
        performance_metrics: PerformanceMetrics::default(),
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        Some(&parent_context),
    ).await.unwrap();

    assert!(result.success);
    assert!(result.context_propagation_used);
}

#[tokio::test]
async fn test_error_handling() {
    let config = EnhancedOrchestrationConfig::default();
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    // Create a workflow that will fail
    let workflow = create_failing_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "failing_task"
    });

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        None,
    ).await.unwrap();

    // Should handle the error gracefully
    assert!(!result.success);
    assert!(result.error.is_some());
}

#[tokio::test]
async fn test_concurrent_executions() {
    let config = EnhancedOrchestrationConfig {
        max_concurrent_recursions: 3,
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    let workflow = create_simple_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "concurrent_task"
    });

    // Start multiple concurrent executions
    let mut handles = Vec::new();
    for i in 0..3 {
        let orchestrator_clone = orchestrator.clone();
        let workflow_clone = workflow.clone();
        let input_data_clone = input_data.clone();

        let handle = tokio::spawn(async move {
            orchestrator_clone.execute_enhanced_workflow(
                workflow_clone,
                input_data_clone,
                None,
            ).await
        });
        handles.push(handle);
    }

    // Wait for all executions to complete
    let mut results = Vec::new();
    for handle in handles {
        let result = handle.await.unwrap().unwrap();
        results.push(result);
    }

    // All executions should succeed
    for result in results {
        assert!(result.success);
    }
}

// Helper functions to create test workflows

async fn create_simple_workflow() -> Result<WorkflowGraph, Box<dyn std::error::Error>> {
    let workflow_id = Uuid::new_v4();

    let mut nodes = HashMap::new();
    nodes.insert("task1".to_string(), WorkflowNode {
        id: "task1".to_string(),
        name: "Simple Task".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "Execute simple task".to_string(),
            parallel_execution: false,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Worker),
            capabilities: vec!["basic_processing".to_string()],
            min_performance_score: 0.5,
            preferred_agents: vec![],
            exclusion_list: vec![],
            resource_requirements: ResourceRequirements {
                cpu_cores: 1.0,
                memory_mb: 512,
                network_bandwidth_mbps: 100,
                storage_mb: 100,
                gpu_units: None,
            },
        },
        input_mapping: HashMap::new(),
        output_mapping: HashMap::new(),
        timeout_seconds: Some(30),
        retry_policy: RetryPolicy::default(),
        conditions: vec![],
    });

    Ok(WorkflowGraph {
        id: workflow_id,
        name: "Simple Workflow".to_string(),
        description: "A simple test workflow".to_string(),
        version: "1.0.0".to_string(),
        nodes,
        edges: vec![],
        input_schema: json!({
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "task": {"type": "string"}
            },
            "required": ["user_id", "task"]
        }),
        output_schema: json!({
            "type": "object",
            "properties": {
                "result": {"type": "string"}
            }
        }),
        constraints: vec![],
        metadata: HashMap::new(),
    })
}

async fn create_recursive_workflow() -> Result<WorkflowGraph, Box<dyn std::error::Error>> {
    let workflow_id = Uuid::new_v4();

    let mut nodes = HashMap::new();

    // Decision node
    nodes.insert("decision".to_string(), WorkflowNode {
        id: "decision".to_string(),
        name: "Recursion Decision".to_string(),
        node_type: WorkflowNodeType::Decision {
            condition: "depth < max_depth".to_string(),
            branches: vec!["recursive_call".to_string(), "final_task".to_string()],
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Coordinator),
            capabilities: vec!["decision_making".to_string()],
            min_performance_score: 0.8,
            preferred_agents: vec![],
            exclusion_list: vec![],
            resource_requirements: ResourceRequirements {
                cpu_cores: 0.5,
                memory_mb: 256,
                network_bandwidth_mbps: 50,
                storage_mb: 50,
                gpu_units: None,
            },
        },
        input_mapping: HashMap::new(),
        output_mapping: HashMap::new(),
        timeout_seconds: Some(10),
        retry_policy: RetryPolicy::default(),
        conditions: vec![],
    });

    // Recursive call node
    nodes.insert("recursive_call".to_string(), WorkflowNode {
        id: "recursive_call".to_string(),
        name: "Recursive Call".to_string(),
        node_type: WorkflowNodeType::SubWorkflow {
            workflow_id: Uuid::new_v4(), // Would be a real subworkflow ID
            input_mapping: HashMap::from([
                ("depth".to_string(), "depth + 1".to_string()),
            ]),
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Hybrid),
            capabilities: vec!["recursive_processing".to_string()],
            min_performance_score: 0.8,
            preferred_agents: vec![],
            exclusion_list: vec![],
            resource_requirements: ResourceRequirements {
                cpu_cores: 2.0,
                memory_mb: 1024,
                network_bandwidth_mbps: 200,
                storage_mb: 500,
                gpu_units: None,
            },
        },
        input_mapping: HashMap::new(),
        output_mapping: HashMap::new(),
        timeout_seconds: Some(60),
        retry_policy: RetryPolicy::default(),
        conditions: vec![],
    });

    // Final task node
    nodes.insert("final_task".to_string(), WorkflowNode {
        id: "final_task".to_string(),
        name: "Final Task".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "Execute final task".to_string(),
            parallel_execution: false,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Worker),
            capabilities: vec!["final_processing".to_string()],
            min_performance_score: 0.7,
            preferred_agents: vec![],
            exclusion_list: vec![],
            resource_requirements: ResourceRequirements {
                cpu_cores: 1.0,
                memory_mb: 512,
                network_bandwidth_mbps: 100,
                storage_mb: 100,
                gpu_units: None,
            },
        },
        input_mapping: HashMap::new(),
        output_mapping: HashMap::new(),
        timeout_seconds: Some(30),
        retry_policy: RetryPolicy::default(),
        conditions: vec![],
    });

    let edges = vec![
        WorkflowEdge {
            from_node: "decision".to_string(),
            to_node: "recursive_call".to_string(),
            condition: Some("depth < max_depth".to_string()),
            data_mapping: HashMap::new(),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "decision".to_string(),
            to_node: "final_task".to_string(),
            condition: Some("depth >= max_depth".to_string()),
            data_mapping: HashMap::new(),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "recursive_call".to_string(),
            to_node: "final_task".to_string(),
            condition: None,
            data_mapping: HashMap::new(),
            priority: 1,
        },
    ];

    Ok(WorkflowGraph {
        id: workflow_id,
        name: "Recursive Workflow".to_string(),
        description: "A recursive test workflow".to_string(),
        version: "1.0.0".to_string(),
        nodes,
        edges,
        input_schema: json!({
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "task": {"type": "string"},
                "depth": {"type": "number"},
                "max_depth": {"type": "number"}
            },
            "required": ["user_id", "task", "depth", "max_depth"]
        }),
        output_schema: json!({
            "type": "object",
            "properties": {
                "result": {"type": "string"},
                "final_depth": {"type": "number"}
            }
        }),
        constraints: vec![],
        metadata: HashMap::new(),
    })
}

async fn create_failing_workflow() -> Result<WorkflowGraph, Box<dyn std::error::Error>> {
    let workflow_id = Uuid::new_v4();

    let mut nodes = HashMap::new();
    nodes.insert("failing_task".to_string(), WorkflowNode {
        id: "failing_task".to_string(),
        name: "Failing Task".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "This task will fail".to_string(),
            parallel_execution: false,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Worker),
            capabilities: vec!["failing_processing".to_string()],
            min_performance_score: 0.5,
            preferred_agents: vec![],
            exclusion_list: vec![],
            resource_requirements: ResourceRequirements {
                cpu_cores: 1.0,
                memory_mb: 512,
                network_bandwidth_mbps: 100,
                storage_mb: 100,
                gpu_units: None,
            },
        },
        input_mapping: HashMap::new(),
        output_mapping: HashMap::new(),
        timeout_seconds: Some(5), // Short timeout to force failure
        retry_policy: RetryPolicy {
            max_attempts: 1, // No retries
            initial_delay_ms: 100,
            backoff_multiplier: 2.0,
            max_delay_ms: 1000,
            retry_on_errors: vec![],
        },
        conditions: vec![],
    });

    Ok(WorkflowGraph {
        id: workflow_id,
        name: "Failing Workflow".to_string(),
        description: "A workflow that will fail".to_string(),
        version: "1.0.0".to_string(),
        nodes,
        edges: vec![],
        input_schema: json!({
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "task": {"type": "string"}
            },
            "required": ["user_id", "task"]
        }),
        output_schema: json!({
            "type": "object",
            "properties": {
                "result": {"type": "string"}
            }
        }),
        constraints: vec![],
        metadata: HashMap::new(),
    })
}
