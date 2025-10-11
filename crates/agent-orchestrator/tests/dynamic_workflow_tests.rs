//! Comprehensive tests for dynamic workflow modification

use agent_orchestrator::{
    DynamicWorkflowModifier, ModificationRule, ModificationTrigger, ModificationAction,
    AdaptationStrategy, AdaptationType, PerformanceAnalyzer, PerformanceMetrics,
    NodeModifications, ResourceRequirements, RetryPolicy, ExecutionCondition,
    ConditionType, AnalysisRule, AnalysisCondition, ModificationRecommendation,
    RiskLevel
};
use std::collections::HashMap;
use std::time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn test_dynamic_workflow_modifier_basic() {
    let modifier = DynamicWorkflowModifier::new();

    let workflow_id = Uuid::new_v4();
    let metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 1000,
        success_rate: 0.95,
        resource_utilization: 0.7,
        error_rate: 0.05,
        throughput: 100.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &metrics).await.unwrap();

    // Should return empty recommendations by default (no rules configured)
    assert_eq!(recommendations.len(), 0);
}

#[tokio::test]
async fn test_modification_rule_performance_degradation() {
    let mut modifier = DynamicWorkflowModifier::new();

    // Add rule for performance degradation
    let rule = ModificationRule {
        rule_id: Uuid::new_v4(),
        name: "Scale Resources on Poor Performance".to_string(),
        trigger: ModificationTrigger::PerformanceDegradation { threshold: 0.8 },
        action: ModificationAction::ScaleResources { factor: 1.5 },
        priority: 8,
        enabled: true,
    };
    modifier.modification_rules.push(rule);

    let workflow_id = Uuid::new_v4();
    let poor_metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 2000,
        success_rate: 0.7, // Below threshold
        resource_utilization: 0.6,
        error_rate: 0.3,
        throughput: 50.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &poor_metrics).await.unwrap();

    // Should recommend scaling resources
    assert_eq!(recommendations.len(), 1);
    assert!(matches!(recommendations[0].action, ModificationAction::ScaleResources { factor: 1.5 }));
    assert!(recommendations[0].confidence > 0.0);
}

#[tokio::test]
async fn test_modification_rule_resource_exhaustion() {
    let mut modifier = DynamicWorkflowModifier::new();

    // Add rule for resource exhaustion
    let rule = ModificationRule {
        rule_id: Uuid::new_v4(),
        name: "Scale Resources on High Load".to_string(),
        trigger: ModificationTrigger::ResourceExhaustion { threshold: 0.9 },
        action: ModificationAction::ScaleResources { factor: 2.0 },
        priority: 9,
        enabled: true,
    };
    modifier.modification_rules.push(rule);

    let workflow_id = Uuid::new_v4();
    let high_load_metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 1500,
        success_rate: 0.9,
        resource_utilization: 0.95, // Above threshold
        error_rate: 0.1,
        throughput: 80.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &high_load_metrics).await.unwrap();

    // Should recommend scaling resources
    assert_eq!(recommendations.len(), 1);
    assert!(matches!(recommendations[0].action, ModificationAction::ScaleResources { factor: 2.0 }));
    assert!(recommendations[0].confidence > 0.0);
}

#[tokio::test]
async fn test_modification_rule_error_rate() {
    let mut modifier = DynamicWorkflowModifier::new();

    // Add rule for high error rate
    let rule = ModificationRule {
        rule_id: Uuid::new_v4(),
        name: "Change Strategy on High Error Rate".to_string(),
        trigger: ModificationTrigger::ErrorRateHigh { threshold: 0.2 },
        action: ModificationAction::ChangeStrategy { strategy: "error_recovery".to_string() },
        priority: 7,
        enabled: true,
    };
    modifier.modification_rules.push(rule);

    let workflow_id = Uuid::new_v4();
    let high_error_metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 1200,
        success_rate: 0.6,
        resource_utilization: 0.5,
        error_rate: 0.4, // Above threshold
        throughput: 60.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &high_error_metrics).await.unwrap();

    // Should recommend changing strategy
    assert_eq!(recommendations.len(), 1);
    assert!(matches!(recommendations[0].action, ModificationAction::ChangeStrategy { strategy: ref s } if s == "error_recovery"));
    assert!(recommendations[0].confidence > 0.0);
}

#[tokio::test]
async fn test_adaptation_strategy_performance_based() {
    let mut modifier = DynamicWorkflowModifier::new();

    // Add performance-based adaptation strategy
    let strategy = AdaptationStrategy {
        strategy_id: Uuid::new_v4(),
        name: "Performance Based Adaptation".to_string(),
        strategy_type: AdaptationType::PerformanceBased,
        parameters: HashMap::new(),
        enabled: true,
    };
    modifier.adaptation_strategies.push(strategy);

    let workflow_id = Uuid::new_v4();
    let poor_performance_metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 2000,
        success_rate: 0.7, // Below 0.8 threshold
        resource_utilization: 0.6,
        error_rate: 0.3,
        throughput: 50.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &poor_performance_metrics).await.unwrap();

    // Should recommend scaling resources
    assert!(!recommendations.is_empty());
    assert!(recommendations.iter().any(|r| matches!(r.action, ModificationAction::ScaleResources { factor: 1.2 })));
}

#[tokio::test]
async fn test_adaptation_strategy_resource_based() {
    let mut modifier = DynamicWorkflowModifier::new();

    // Add resource-based adaptation strategy
    let strategy = AdaptationStrategy {
        strategy_id: Uuid::new_v4(),
        name: "Resource Based Adaptation".to_string(),
        strategy_type: AdaptationType::ResourceBased,
        parameters: HashMap::new(),
        enabled: true,
    };
    modifier.adaptation_strategies.push(strategy);

    let workflow_id = Uuid::new_v4();
    let high_resource_metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 1500,
        success_rate: 0.9,
        resource_utilization: 0.95, // Above 0.9 threshold
        error_rate: 0.1,
        throughput: 80.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &high_resource_metrics).await.unwrap();

    // Should recommend scaling resources
    assert!(!recommendations.is_empty());
    assert!(recommendations.iter().any(|r| matches!(r.action, ModificationAction::ScaleResources { factor: 1.5 })));
}

#[tokio::test]
async fn test_adaptation_strategy_error_based() {
    let mut modifier = DynamicWorkflowModifier::new();

    // Add error-based adaptation strategy
    let strategy = AdaptationStrategy {
        strategy_id: Uuid::new_v4(),
        name: "Error Based Adaptation".to_string(),
        strategy_type: AdaptationType::ErrorBased,
        parameters: HashMap::new(),
        enabled: true,
    };
    modifier.adaptation_strategies.push(strategy);

    let workflow_id = Uuid::new_v4();
    let high_error_metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 1200,
        success_rate: 0.8,
        resource_utilization: 0.5,
        error_rate: 0.2, // Above 0.1 threshold
        throughput: 60.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &high_error_metrics).await.unwrap();

    // Should recommend changing strategy
    assert!(!recommendations.is_empty());
    assert!(recommendations.iter().any(|r| matches!(r.action, ModificationAction::ChangeStrategy { strategy: ref s } if s == "error_recovery")));
}

#[tokio::test]
async fn test_apply_modifications() {
    let modifier = DynamicWorkflowModifier::new();

    let workflow_id = Uuid::new_v4();
    let modifications = vec![
        ModificationAction::ScaleResources { factor: 1.5 },
        ModificationAction::ChangeStrategy { strategy: "optimized".to_string() },
    ];

    let result = modifier.apply_modifications(
        workflow_id,
        modifications,
        "Performance optimization".to_string(),
    ).await.unwrap();

    assert_eq!(result.workflow_id, workflow_id);
    assert_eq!(result.reason, "Performance optimization");
    assert!(result.success);
}

#[tokio::test]
async fn test_performance_analyzer() {
    let analyzer = PerformanceAnalyzer::new();

    let workflow_id = Uuid::new_v4();
    let metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 1000,
        success_rate: 0.95,
        resource_utilization: 0.7,
        error_rate: 0.05,
        throughput: 100.0,
    };

    let analysis = analyzer.analyze_metrics(&metrics).await.unwrap();

    assert_eq!(analysis.workflow_id, workflow_id);
    assert!(analysis.overall_health > 0.0);
    assert!(analysis.overall_health <= 1.0);
}

#[tokio::test]
async fn test_performance_analyzer_with_rules() {
    let mut analyzer = PerformanceAnalyzer::new();

    // Add analysis rule
    let rule = AnalysisRule {
        rule_id: Uuid::new_v4(),
        name: "Low Performance Alert".to_string(),
        condition: AnalysisCondition::PerformanceBelow(0.8),
        recommendation: ModificationRecommendation {
            action: ModificationAction::ScaleResources { factor: 1.2 },
            confidence: 0.8,
            expected_improvement: 0.15,
            risk_level: RiskLevel::Low,
        },
    };
    analyzer.analysis_rules.push(rule);

    let workflow_id = Uuid::new_v4();
    let poor_metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 2000,
        success_rate: 0.7, // Below threshold
        resource_utilization: 0.6,
        error_rate: 0.3,
        throughput: 50.0,
    };

    let analysis = analyzer.analyze_metrics(&poor_metrics).await.unwrap();

    assert_eq!(analysis.workflow_id, workflow_id);
    assert!(!analysis.issues.is_empty());
    assert!(analysis.issues.iter().any(|issue| matches!(issue.action, ModificationAction::ScaleResources { factor: 1.2 })));
}

#[tokio::test]
async fn test_performance_trend_analysis() {
    let analyzer = PerformanceAnalyzer::new();

    let workflow_id = Uuid::new_v4();

    // Add multiple metrics to test trend analysis
    for i in 0..5 {
        let metrics = PerformanceMetrics {
            workflow_id,
            timestamp: chrono::Utc::now() + chrono::Duration::seconds(i as i64),
            execution_time_ms: 1000 + (i * 100) as u64, // Increasing execution time
            success_rate: 0.95 - (i as f64 * 0.05), // Decreasing success rate
            resource_utilization: 0.7 + (i as f64 * 0.05), // Increasing resource usage
            error_rate: 0.05 + (i as f64 * 0.05), // Increasing error rate
            throughput: 100.0 - (i as f64 * 10.0), // Decreasing throughput
        };

        analyzer.analyze_metrics(&metrics).await.unwrap();
    }

    // The last analysis should show degrading trends
    let final_metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now() + chrono::Duration::seconds(5),
        execution_time_ms: 1500,
        success_rate: 0.7,
        resource_utilization: 0.9,
        error_rate: 0.3,
        throughput: 50.0,
    };

    let analysis = analyzer.analyze_metrics(&final_metrics).await.unwrap();

    assert_eq!(analysis.workflow_id, workflow_id);
    assert!(!analysis.trends.is_empty());

    // Check for degrading trends
    let degrading_trends: Vec<_> = analysis.trends.iter()
        .filter(|t| matches!(t.trend, agent_orchestrator::TrendDirection::Degrading))
        .collect();

    assert!(!degrading_trends.is_empty());
}

#[tokio::test]
async fn test_modification_confidence_calculation() {
    let mut modifier = DynamicWorkflowModifier::new();

    // Add rule with high priority
    let high_priority_rule = ModificationRule {
        rule_id: Uuid::new_v4(),
        name: "High Priority Rule".to_string(),
        trigger: ModificationTrigger::PerformanceDegradation { threshold: 0.8 },
        action: ModificationAction::ScaleResources { factor: 1.5 },
        priority: 9, // High priority
        enabled: true,
    };
    modifier.modification_rules.push(high_priority_rule);

    // Add rule with low priority
    let low_priority_rule = ModificationRule {
        rule_id: Uuid::new_v4(),
        name: "Low Priority Rule".to_string(),
        trigger: ModificationTrigger::PerformanceDegradation { threshold: 0.8 },
        action: ModificationAction::ChangeStrategy { strategy: "fallback".to_string() },
        priority: 3, // Low priority
        enabled: true,
    };
    modifier.modification_rules.push(low_priority_rule);

    let workflow_id = Uuid::new_v4();
    let metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 2000,
        success_rate: 0.7, // Triggers both rules
        resource_utilization: 0.6,
        error_rate: 0.3,
        throughput: 50.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &metrics).await.unwrap();

    // Should have two recommendations
    assert_eq!(recommendations.len(), 2);

    // High priority rule should have higher confidence
    let high_priority_rec = recommendations.iter()
        .find(|r| matches!(r.action, ModificationAction::ScaleResources { factor: 1.5 }))
        .unwrap();
    let low_priority_rec = recommendations.iter()
        .find(|r| matches!(r.action, ModificationAction::ChangeStrategy { strategy: ref s } if s == "fallback"))
        .unwrap();

    assert!(high_priority_rec.confidence > low_priority_rec.confidence);
}

#[tokio::test]
async fn test_risk_assessment() {
    let mut modifier = DynamicWorkflowModifier::new();

    // Add rules with different risk levels
    let low_risk_rule = ModificationRule {
        rule_id: Uuid::new_v4(),
        name: "Low Risk Rule".to_string(),
        trigger: ModificationTrigger::PerformanceDegradation { threshold: 0.8 },
        action: ModificationAction::ScaleResources { factor: 1.1 }, // Small scaling
        priority: 5,
        enabled: true,
    };
    modifier.modification_rules.push(low_risk_rule);

    let high_risk_rule = ModificationRule {
        rule_id: Uuid::new_v4(),
        name: "High Risk Rule".to_string(),
        trigger: ModificationTrigger::PerformanceDegradation { threshold: 0.8 },
        action: ModificationAction::RemoveNode { node_id: "critical_node".to_string() },
        priority: 5,
        enabled: true,
    };
    modifier.modification_rules.push(high_risk_rule);

    let workflow_id = Uuid::new_v4();
    let metrics = PerformanceMetrics {
        workflow_id,
        timestamp: chrono::Utc::now(),
        execution_time_ms: 2000,
        success_rate: 0.7,
        resource_utilization: 0.6,
        error_rate: 0.3,
        throughput: 50.0,
    };

    let recommendations = modifier.analyze_workflow(workflow_id, &metrics).await.unwrap();

    // Should have two recommendations
    assert_eq!(recommendations.len(), 2);

    // Find recommendations by action type
    let scaling_rec = recommendations.iter()
        .find(|r| matches!(r.action, ModificationAction::ScaleResources { factor: 1.1 }))
        .unwrap();
    let removal_rec = recommendations.iter()
        .find(|r| matches!(r.action, ModificationAction::RemoveNode { node_id: ref s } if s == "critical_node"))
        .unwrap();

    // Scaling should be low risk, removal should be high risk
    assert!(matches!(scaling_rec.risk_level, RiskLevel::Low));
    assert!(matches!(removal_rec.risk_level, RiskLevel::High));
}
