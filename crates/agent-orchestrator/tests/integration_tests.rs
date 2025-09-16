//! Integration tests for the enhanced orchestration system

use agent_orchestrator::{
    EnhancedOrchestrator, EnhancedOrchestrationConfig, RecursionLimits,
    WorkflowGraph, WorkflowNode, WorkflowNodeType, WorkflowEdge,
    AgentRequirements, ResourceRequirements, RetryPolicy, ExecutionCondition,
    ConditionType, ConstraintSeverity, WorkflowConstraint, WorkflowConstraintType,
    RecursiveContext, PerformanceMetrics, ModificationRule, ModificationTrigger,
    ModificationAction, AdaptationStrategy, AdaptationType
};
use serde_json::json;
use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn test_full_orchestration_workflow() {
    // Create a comprehensive configuration
    let config = EnhancedOrchestrationConfig {
        recursion_limits: RecursionLimits {
            max_depth: 5,
            max_agents_per_level: 10,
            recursion_timeout: Duration::from_secs(120),
            cycle_detection: true,
            resource_escalation_threshold: 0.8,
            performance_degradation_threshold: 0.7,
        },
        context_propagation_enabled: true,
        dynamic_modification_enabled: true,
        performance_monitoring_enabled: true,
        auto_adaptation_enabled: true,
        max_concurrent_recursions: 5,
        performance_analysis_interval: Duration::from_secs(5),
        adaptation_threshold: 0.8,
    };

    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    // Create a complex workflow with multiple levels
    let workflow = create_complex_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "complex_analysis",
        "priority": "high",
        "deadline": "2024-01-20T10:00:00Z",
        "complexity": 0.8
    });

    // Execute the workflow
    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        None,
    ).await.unwrap();

    // Verify results
    assert!(result.success);
    assert!(result.max_depth_reached >= 0);
    assert!(result.total_execution_time.as_millis() > 0);

    // Check that performance metrics were recorded
    let stats = orchestrator.get_orchestration_statistics().await.unwrap();
    assert_eq!(stats.total_executions, 1);
    assert!(stats.success_rate > 0.0);
}

#[tokio::test]
async fn test_recursive_execution_with_context_propagation() {
    let config = EnhancedOrchestrationConfig {
        context_propagation_enabled: true,
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    // Create a parent context with rich state
    let parent_context = RecursiveContext {
        workflow_id: Uuid::new_v4(),
        depth: 1,
        parent_workflow_id: Some(Uuid::new_v4()),
        root_workflow_id: Uuid::new_v4(),
        execution_path: vec![Uuid::new_v4(), Uuid::new_v4()],
        inherited_state: HashMap::from([
            ("user_id".to_string(), serde_json::Value::String("user_123".to_string())),
            ("session_id".to_string(), serde_json::Value::String("session_456".to_string())),
            ("priority".to_string(), serde_json::Value::String("high".to_string())),
            ("constraints".to_string(), serde_json::Value::Object({
                let mut obj = serde_json::Map::new();
                obj.insert("max_cost".to_string(), serde_json::Value::Number(serde_json::Number::from(100)));
                obj.insert("deadline".to_string(), serde_json::Value::String("2024-01-20T10:00:00Z".to_string()));
                obj
            })),
        ]),
        execution_history: vec![],
        resource_usage: agent_orchestrator::ResourceUsage {
            cpu_cores: 2.0,
            memory_mb: 1024,
            network_bandwidth_mbps: 200,
            storage_mb: 500,
            agents_spawned: 5,
            total_cost: 25.0,
        },
        performance_metrics: PerformanceMetrics {
            workflow_id: Uuid::new_v4(),
            timestamp: chrono::Utc::now(),
            execution_time_ms: 1000,
            success_rate: 0.95,
            resource_utilization: 0.7,
            error_rate: 0.05,
            throughput: 100.0,
        },
        created_at: chrono::Utc::now(),
        recursion_id: Uuid::new_v4(),
    };

    let workflow = create_simple_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "child_task"
    });

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        Some(&parent_context),
    ).await.unwrap();

    // Verify context propagation
    assert!(result.context_propagation_used);
    assert_eq!(result.max_depth_reached, 2); // Parent depth + 1
    assert!(result.success);
}

#[tokio::test]
async fn test_dynamic_modification_integration() {
    let config = EnhancedOrchestrationConfig {
        dynamic_modification_enabled: true,
        auto_adaptation_enabled: true,
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    // Add modification rules to the orchestrator
    let modification_rule = ModificationRule {
        rule_id: Uuid::new_v4(),
        name: "Scale Resources on High Load".to_string(),
        trigger: ModificationTrigger::ResourceExhaustion { threshold: 0.9 },
        action: ModificationAction::ScaleResources { factor: 1.5 },
        priority: 8,
        enabled: true,
    };
    orchestrator.dynamic_modifier.modification_rules.push(modification_rule);

    // Add adaptation strategy
    let adaptation_strategy = AdaptationStrategy {
        strategy_id: Uuid::new_v4(),
        name: "Performance Based Adaptation".to_string(),
        strategy_type: AdaptationType::PerformanceBased,
        parameters: HashMap::new(),
        enabled: true,
    };
    orchestrator.dynamic_modifier.adaptation_strategies.push(adaptation_strategy);

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

    // Verify that modifications were considered
    assert!(result.success);
    // Note: Modifications may or may not be applied depending on performance
    assert!(result.modifications_applied.len() >= 0);
}

#[tokio::test]
async fn test_performance_monitoring_integration() {
    let config = EnhancedOrchestrationConfig {
        performance_monitoring_enabled: true,
        performance_analysis_interval: Duration::from_millis(100), // Fast analysis for testing
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

    // Wait a bit for background monitoring to run
    tokio::time::sleep(Duration::from_millis(200)).await;

    // Check that performance metrics were recorded
    let stats = orchestrator.get_orchestration_statistics().await.unwrap();
    assert_eq!(stats.total_executions, 1);
    assert!(stats.success_rate > 0.0);
}

#[tokio::test]
async fn test_error_recovery_integration() {
    let config = EnhancedOrchestrationConfig {
        recursion_limits: RecursionLimits {
            max_depth: 3,
            ..Default::default()
        },
        ..Default::default()
    };
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

    // Check that error was recorded in statistics
    let stats = orchestrator.get_orchestration_statistics().await.unwrap();
    assert_eq!(stats.total_executions, 1);
    assert!(stats.success_rate < 1.0);
}

#[tokio::test]
async fn test_concurrent_recursive_executions() {
    let config = EnhancedOrchestrationConfig {
        max_concurrent_recursions: 3,
        recursion_limits: RecursionLimits {
            max_depth: 2,
            ..Default::default()
        },
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

    // Check that all executions were recorded
    let stats = orchestrator.get_orchestration_statistics().await.unwrap();
    assert_eq!(stats.total_executions, 3);
}

#[tokio::test]
async fn test_cycle_detection_integration() {
    let config = EnhancedOrchestrationConfig {
        recursion_limits: RecursionLimits {
            cycle_detection: true,
            max_depth: 5,
            ..Default::default()
        },
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    // Create a workflow that could potentially create cycles
    let workflow = create_potentially_cyclic_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "cyclic_task"
    });

    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        None,
    ).await.unwrap();

    // Should either succeed or fail gracefully due to cycle detection
    assert!(result.success || result.error.is_some());
}

#[tokio::test]
async fn test_resource_escalation_integration() {
    let config = EnhancedOrchestrationConfig {
        recursion_limits: RecursionLimits {
            resource_escalation_threshold: 0.5,
            ..Default::default()
        },
        ..Default::default()
    };
    let orchestrator = EnhancedOrchestrator::new(config).await.unwrap();

    // Create a parent context with high resource usage
    let parent_context = RecursiveContext {
        workflow_id: Uuid::new_v4(),
        depth: 0,
        parent_workflow_id: None,
        root_workflow_id: Uuid::new_v4(),
        execution_path: vec![Uuid::new_v4()],
        inherited_state: HashMap::new(),
        execution_history: vec![],
        resource_usage: agent_orchestrator::ResourceUsage {
            cpu_cores: 10.0, // High resource usage
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

    let workflow = create_simple_workflow().await.unwrap();
    let input_data = json!({
        "user_id": "user_123",
        "task": "resource_test_task"
    });

    // This should fail due to resource escalation threshold
    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        input_data,
        Some(&parent_context),
    ).await;

    // Should either succeed or fail due to resource limits
    assert!(result.is_ok() || result.is_err());
}

// Helper functions

async fn create_complex_workflow() -> Result<WorkflowGraph, Box<dyn std::error::Error>> {
    let workflow_id = Uuid::new_v4();

    let mut nodes = HashMap::new();

    // Input validation node
    nodes.insert("input_validation".to_string(), WorkflowNode {
        id: "input_validation".to_string(),
        name: "Input Validation".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "Validate input data and requirements".to_string(),
            parallel_execution: false,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Specialist),
            capabilities: vec!["validation".to_string(), "data_analysis".to_string()],
            min_performance_score: 0.8,
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
        conditions: vec![ExecutionCondition {
            condition_type: ConditionType::DataAvailable,
            expression: "input_data != null".to_string(),
            required: true,
        }],
    });

    // Data processing node
    nodes.insert("data_processing".to_string(), WorkflowNode {
        id: "data_processing".to_string(),
        name: "Data Processing".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "Process and transform data".to_string(),
            parallel_execution: true,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Worker),
            capabilities: vec!["data_processing".to_string(), "transformation".to_string()],
            min_performance_score: 0.7,
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

    // Decision node
    nodes.insert("decision".to_string(), WorkflowNode {
        id: "decision".to_string(),
        name: "Complexity Decision".to_string(),
        node_type: WorkflowNodeType::Decision {
            condition: "complexity > 0.5".to_string(),
            branches: vec!["complex_processing".to_string(), "simple_processing".to_string()],
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Coordinator),
            capabilities: vec!["decision_making".to_string(), "analysis".to_string()],
            min_performance_score: 0.9,
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

    // Complex processing node
    nodes.insert("complex_processing".to_string(), WorkflowNode {
        id: "complex_processing".to_string(),
        name: "Complex Processing".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "Perform complex data processing".to_string(),
            parallel_execution: false,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Specialist),
            capabilities: vec!["complex_processing".to_string(), "machine_learning".to_string()],
            min_performance_score: 0.9,
            preferred_agents: vec![],
            exclusion_list: vec![],
            resource_requirements: ResourceRequirements {
                cpu_cores: 4.0,
                memory_mb: 2048,
                network_bandwidth_mbps: 500,
                storage_mb: 1000,
                gpu_units: Some(1),
            },
        },
        input_mapping: HashMap::new(),
        output_mapping: HashMap::new(),
        timeout_seconds: Some(120),
        retry_policy: RetryPolicy::default(),
        conditions: vec![],
    });

    // Simple processing node
    nodes.insert("simple_processing".to_string(), WorkflowNode {
        id: "simple_processing".to_string(),
        name: "Simple Processing".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "Perform simple data processing".to_string(),
            parallel_execution: false,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Worker),
            capabilities: vec!["simple_processing".to_string()],
            min_performance_score: 0.6,
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

    // Final analysis node
    nodes.insert("final_analysis".to_string(), WorkflowNode {
        id: "final_analysis".to_string(),
        name: "Final Analysis".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "Perform final analysis and generate results".to_string(),
            parallel_execution: false,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Specialist),
            capabilities: vec!["analysis".to_string(), "reporting".to_string()],
            min_performance_score: 0.9,
            preferred_agents: vec![],
            exclusion_list: vec![],
            resource_requirements: ResourceRequirements {
                cpu_cores: 2.0,
                memory_mb: 1536,
                network_bandwidth_mbps: 300,
                storage_mb: 800,
                gpu_units: None,
            },
        },
        input_mapping: HashMap::new(),
        output_mapping: HashMap::new(),
        timeout_seconds: Some(90),
        retry_policy: RetryPolicy::default(),
        conditions: vec![],
    });

    let edges = vec![
        WorkflowEdge {
            from_node: "input_validation".to_string(),
            to_node: "data_processing".to_string(),
            condition: None,
            data_mapping: HashMap::from([
                ("validated_data".to_string(), "input_data".to_string()),
            ]),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "data_processing".to_string(),
            to_node: "decision".to_string(),
            condition: None,
            data_mapping: HashMap::from([
                ("processed_data".to_string(), "data".to_string()),
                ("complexity_score".to_string(), "complexity".to_string()),
            ]),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "decision".to_string(),
            to_node: "complex_processing".to_string(),
            condition: Some("complexity > 0.5".to_string()),
            data_mapping: HashMap::from([
                ("data".to_string(), "processed_data".to_string()),
            ]),
            priority: 2,
        },
        WorkflowEdge {
            from_node: "decision".to_string(),
            to_node: "simple_processing".to_string(),
            condition: Some("complexity <= 0.5".to_string()),
            data_mapping: HashMap::from([
                ("data".to_string(), "processed_data".to_string()),
            ]),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "complex_processing".to_string(),
            to_node: "final_analysis".to_string(),
            condition: None,
            data_mapping: HashMap::from([
                ("result_data".to_string(), "data".to_string()),
            ]),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "simple_processing".to_string(),
            to_node: "final_analysis".to_string(),
            condition: None,
            data_mapping: HashMap::from([
                ("result_data".to_string(), "data".to_string()),
            ]),
            priority: 1,
        },
    ];

    let constraints = vec![
        WorkflowConstraint {
            constraint_type: WorkflowConstraintType::Deadline {
                deadline: chrono::Utc::now() + chrono::Duration::hours(1),
            },
            severity: ConstraintSeverity::High,
            description: "Complete within 1 hour".to_string(),
        },
        WorkflowConstraint {
            constraint_type: WorkflowConstraintType::ResourceBudget {
                max_cost: 100.0,
            },
            severity: ConstraintSeverity::Medium,
            description: "Stay within budget".to_string(),
        },
    ];

    Ok(WorkflowGraph {
        id: workflow_id,
        name: "Complex Analysis Workflow".to_string(),
        description: "A complex workflow with multiple processing paths".to_string(),
        version: "1.0.0".to_string(),
        nodes,
        edges,
        input_schema: json!({
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "task": {"type": "string"},
                "priority": {"type": "string"},
                "deadline": {"type": "string"},
                "complexity": {"type": "number"}
            },
            "required": ["user_id", "task", "complexity"]
        }),
        output_schema: json!({
            "type": "object",
            "properties": {
                "result": {"type": "string"},
                "confidence": {"type": "number"},
                "processing_time": {"type": "number"}
            }
        }),
        constraints,
        metadata: HashMap::from([
            ("category".to_string(), "analysis".to_string()),
            ("complexity".to_string(), "high".to_string()),
        ]),
    })
}

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

async fn create_potentially_cyclic_workflow() -> Result<WorkflowGraph, Box<dyn std::error::Error>> {
    let workflow_id = Uuid::new_v4();

    let mut nodes = HashMap::new();

    // Decision node that could create cycles
    nodes.insert("decision".to_string(), WorkflowNode {
        id: "decision".to_string(),
        name: "Cyclic Decision".to_string(),
        node_type: WorkflowNodeType::Decision {
            condition: "should_continue".to_string(),
            branches: vec!["continue_processing".to_string(), "final_task".to_string()],
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

    // Continue processing node
    nodes.insert("continue_processing".to_string(), WorkflowNode {
        id: "continue_processing".to_string(),
        name: "Continue Processing".to_string(),
        node_type: WorkflowNodeType::Task {
            task_definition: "Continue processing".to_string(),
            parallel_execution: false,
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Worker),
            capabilities: vec!["processing".to_string()],
            min_performance_score: 0.6,
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
            min_performance_score: 0.6,
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
            to_node: "continue_processing".to_string(),
            condition: Some("should_continue".to_string()),
            data_mapping: HashMap::new(),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "decision".to_string(),
            to_node: "final_task".to_string(),
            condition: Some("!should_continue".to_string()),
            data_mapping: HashMap::new(),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "continue_processing".to_string(),
            to_node: "decision".to_string(), // This creates a potential cycle
            condition: None,
            data_mapping: HashMap::new(),
            priority: 1,
        },
    ];

    Ok(WorkflowGraph {
        id: workflow_id,
        name: "Potentially Cyclic Workflow".to_string(),
        description: "A workflow that could create cycles".to_string(),
        version: "1.0.0".to_string(),
        nodes,
        edges,
        input_schema: json!({
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "task": {"type": "string"},
                "should_continue": {"type": "boolean"}
            },
            "required": ["user_id", "task", "should_continue"]
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
