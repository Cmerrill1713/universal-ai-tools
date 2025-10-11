//! Enhanced Orchestration Demo
//!
//! This example demonstrates the advanced orchestration capabilities including
//! recursive execution, context propagation, and dynamic workflow modification.

use agent_orchestrator::{
    EnhancedOrchestrator, EnhancedOrchestrationConfig, RecursionLimits,
    WorkflowGraph, WorkflowNode, WorkflowNodeType, WorkflowEdge,
    AgentRequirements, ResourceRequirements, RetryPolicy, ExecutionCondition,
    ConditionType, ConstraintSeverity, WorkflowConstraint, WorkflowConstraintType,
    PropagationRule, PropagationCondition, PropagationAction, InheritanceStrategy,
    InheritanceType, ModificationRule, ModificationTrigger, ModificationAction,
    AdaptationStrategy, AdaptationType,
};
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🚀 Enhanced Orchestration Demo");
    println!("=" * 50);

    // Create enhanced orchestration configuration
    let config = create_enhanced_config();

    // Create enhanced orchestrator
    let orchestrator = EnhancedOrchestrator::new(config).await?;

    // Create a complex workflow with recursive capabilities
    let workflow = create_complex_workflow().await?;

    // Execute the workflow
    println!("📋 Executing complex workflow...");
    let result = orchestrator.execute_enhanced_workflow(
        workflow,
        json!({
            "user_id": "user_123",
            "task": "complex_analysis",
            "priority": "high",
            "deadline": "2024-01-20T10:00:00Z"
        }),
        None, // No parent context (root execution)
    ).await?;

    // Display results
    display_results(&result).await?;

    // Get orchestration statistics
    let stats = orchestrator.get_orchestration_statistics().await?;
    display_statistics(&stats).await?;

    println!("✅ Demo completed successfully!");
    Ok(())
}

fn create_enhanced_config() -> EnhancedOrchestrationConfig {
    EnhancedOrchestrationConfig {
        recursion_limits: RecursionLimits {
            max_depth: 5,
            max_agents_per_level: 20,
            recursion_timeout: std::time::Duration::from_secs(300),
            cycle_detection: true,
            resource_escalation_threshold: 0.8,
            performance_degradation_threshold: 0.7,
        },
        context_propagation_enabled: true,
        dynamic_modification_enabled: true,
        performance_monitoring_enabled: true,
        auto_adaptation_enabled: true,
        max_concurrent_recursions: 10,
        performance_analysis_interval: std::time::Duration::from_secs(10),
        adaptation_threshold: 0.8,
    }
}

async fn create_complex_workflow() -> Result<WorkflowGraph, Box<dyn std::error::Error>> {
    let workflow_id = Uuid::new_v4();

    // Create workflow nodes
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

    // Decision node for recursive processing
    nodes.insert("recursive_decision".to_string(), WorkflowNode {
        id: "recursive_decision".to_string(),
        name: "Recursive Decision".to_string(),
        node_type: WorkflowNodeType::Decision {
            condition: "complexity > threshold".to_string(),
            branches: vec!["recursive_processing".to_string(), "final_analysis".to_string()],
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

    // Recursive processing subworkflow
    nodes.insert("recursive_processing".to_string(), WorkflowNode {
        id: "recursive_processing".to_string(),
        name: "Recursive Processing".to_string(),
        node_type: WorkflowNodeType::SubWorkflow {
            workflow_id: Uuid::new_v4(), // Would be a real subworkflow ID
            input_mapping: HashMap::from([
                ("data".to_string(), "processed_data".to_string()),
                ("depth".to_string(), "current_depth + 1".to_string()),
            ]),
        },
        agent_requirements: AgentRequirements {
            agent_type: Some(agent_orchestrator::AgentType::Hybrid),
            capabilities: vec!["recursive_processing".to_string(), "coordination".to_string()],
            min_performance_score: 0.8,
            preferred_agents: vec![],
            exclusion_list: vec![],
            resource_requirements: ResourceRequirements {
                cpu_cores: 3.0,
                memory_mb: 2048,
                network_bandwidth_mbps: 500,
                storage_mb: 1000,
                gpu_units: None,
            },
        },
        input_mapping: HashMap::new(),
        output_mapping: HashMap::new(),
        timeout_seconds: Some(120),
        retry_policy: RetryPolicy {
            max_attempts: 2,
            initial_delay_ms: 1000,
            backoff_multiplier: 2.0,
            max_delay_ms: 10000,
            retry_on_errors: vec!["timeout".to_string(), "resource_unavailable".to_string()],
        },
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

    // Create workflow edges
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
            to_node: "recursive_decision".to_string(),
            condition: None,
            data_mapping: HashMap::from([
                ("processed_data".to_string(), "data".to_string()),
                ("complexity_score".to_string(), "complexity".to_string()),
            ]),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "recursive_decision".to_string(),
            to_node: "recursive_processing".to_string(),
            condition: Some("complexity > 0.7".to_string()),
            data_mapping: HashMap::from([
                ("data".to_string(), "processed_data".to_string()),
            ]),
            priority: 2,
        },
        WorkflowEdge {
            from_node: "recursive_decision".to_string(),
            to_node: "final_analysis".to_string(),
            condition: Some("complexity <= 0.7".to_string()),
            data_mapping: HashMap::from([
                ("data".to_string(), "processed_data".to_string()),
            ]),
            priority: 1,
        },
        WorkflowEdge {
            from_node: "recursive_processing".to_string(),
            to_node: "final_analysis".to_string(),
            condition: None,
            data_mapping: HashMap::from([
                ("result_data".to_string(), "data".to_string()),
            ]),
            priority: 1,
        },
    ];

    // Create workflow constraints
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
        description: "A complex workflow with recursive processing capabilities".to_string(),
        version: "1.0.0".to_string(),
        nodes,
        edges,
        input_schema: json!({
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "task": {"type": "string"},
                "priority": {"type": "string"},
                "deadline": {"type": "string"}
            },
            "required": ["user_id", "task"]
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
            ("supports_recursion".to_string(), "true".to_string()),
        ]),
    })
}

async fn display_results(result: &agent_orchestrator::EnhancedOrchestrationResult) {
    println!("\n📊 Execution Results:");
    println!("  Result ID: {}", result.result_id);
    println!("  Workflow ID: {}", result.workflow_id);
    println!("  Success: {}", result.success);
    println!("  Max Depth Reached: {}", result.max_depth_reached);
    println!("  Total Execution Time: {}ms", result.total_execution_time.as_millis());
    println!("  Context Propagation Used: {}", result.context_propagation_used);
    println!("  Modifications Applied: {}", result.modifications_applied.len());

    if let Some(error) = &result.error {
        println!("  Error: {}", error);
    }

    println!("\n📈 Performance Metrics:");
    println!("  Execution Time: {}ms", result.performance_metrics.execution_time_ms);
    println!("  Success Rate: {:.2}%", result.performance_metrics.success_rate * 100.0);
    println!("  Resource Utilization: {:.2}%", result.performance_metrics.resource_utilization * 100.0);
    println!("  Error Rate: {:.2}%", result.performance_metrics.error_rate * 100.0);
    println!("  Throughput: {:.2} ops/sec", result.performance_metrics.throughput);

    println!("\n🔄 Recursion Statistics:");
    println!("  Total Recursions: {}", result.recursion_statistics.total_recursions);
    println!("  Max Depth: {}", result.recursion_statistics.max_depth);
    println!("  Average Depth: {:.2}", result.recursion_statistics.average_depth);
    println!("  Success Rate: {:.2}%", result.recursion_statistics.success_rate * 100.0);
    println!("  Performance Efficiency: {:.2}%", result.recursion_statistics.performance_efficiency * 100.0);

    if !result.modifications_applied.is_empty() {
        println!("\n🔧 Modifications Applied:");
        for (i, modification) in result.modifications_applied.iter().enumerate() {
            println!("  {}. {} - {} (Success: {})",
                i + 1,
                modification.action,
                modification.reason,
                modification.success
            );
            if let Some(impact) = modification.performance_impact {
                println!("     Performance Impact: {:.2}%", impact * 100.0);
            }
        }
    }
}

async fn display_statistics(stats: &agent_orchestrator::OrchestrationStatistics) {
    println!("\n📊 Orchestration Statistics:");
    println!("  Active Recursions: {}", stats.active_recursions);
    println!("  Total Executions: {}", stats.total_executions);
    println!("  Average Execution Time: {}ms", stats.average_execution_time.as_millis());
    println!("  Success Rate: {:.2}%", stats.success_rate * 100.0);

    println!("\n🔄 Recursion Statistics:");
    println!("  Active Recursions: {}", stats.recursion_statistics.active_recursions);
    println!("  Total Executions: {}", stats.recursion_statistics.total_executions);
    println!("  Success Rate: {:.2}%", stats.recursion_statistics.success_rate * 100.0);
    println!("  Average Execution Time: {}ms", stats.recursion_statistics.average_execution_time.as_millis());

    if !stats.performance_alerts.is_empty() {
        println!("\n⚠️  Performance Alerts:");
        for alert in &stats.performance_alerts {
            println!("  - {}: {} (Severity: {:?})",
                alert.alert_type,
                alert.message,
                alert.severity
            );
        }
    }
}
