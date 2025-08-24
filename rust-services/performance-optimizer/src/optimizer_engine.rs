use anyhow::{anyhow, Result};
use std::collections::HashMap;
use tracing::{debug, info, warn, error};

use crate::config::Config;
use crate::{
    PerformanceOptimizationRequest, OptimizationRecommendation, 
    ImpactLevel, EffortLevel, OptimizationType, OptimizationPriority
};

pub struct OptimizerEngine {
    config: Config,
    optimization_strategies: HashMap<OptimizationType, Vec<OptimizationStrategy>>,
}

#[derive(Debug, Clone)]
struct OptimizationStrategy {
    name: String,
    description: String,
    impact: ImpactLevel,
    effort: EffortLevel,
    steps: Vec<String>,
    conditions: Vec<OptimizationCondition>,
}

#[derive(Debug, Clone)]
struct OptimizationCondition {
    metric: String,
    operator: ComparisonOperator,
    threshold: f64,
}

#[derive(Debug, Clone)]
enum ComparisonOperator {
    GreaterThan,
    LessThan,
    Equals,
}

impl OptimizerEngine {
    pub async fn new(config: &Config) -> Result<Self> {
        let optimization_strategies = Self::build_optimization_strategies();

        Ok(Self {
            config: config.clone(),
            optimization_strategies,
        })
    }

    pub async fn optimize_service(&mut self, request: &PerformanceOptimizationRequest) -> Result<Vec<OptimizationRecommendation>> {
        info!("🔧 Starting optimization for service: {} (type: {:?})", 
              request.target_service, request.optimization_type);

        // Get applicable optimization strategies
        let strategies = self.get_applicable_strategies(request).await?;
        
        if strategies.is_empty() {
            warn!("No applicable optimization strategies found for request");
            return Ok(vec![]);
        }

        // Convert strategies to recommendations
        let mut recommendations = Vec::new();
        for strategy in strategies {
            let recommendation = self.strategy_to_recommendation(&strategy, &request.target_service).await?;
            recommendations.push(recommendation);
        }

        // Sort by impact and priority
        self.sort_recommendations_by_priority(&mut recommendations, &request.priority).await?;

        info!("✅ Generated {} optimization recommendations for {}", 
              recommendations.len(), request.target_service);

        Ok(recommendations)
    }

    async fn get_applicable_strategies(&self, request: &PerformanceOptimizationRequest) -> Result<Vec<OptimizationStrategy>> {
        let mut applicable_strategies = Vec::new();

        // Get strategies for the optimization type
        if let Some(strategies) = self.optimization_strategies.get(&request.optimization_type) {
            for strategy in strategies {
                if self.is_strategy_applicable(strategy, request).await? {
                    applicable_strategies.push(strategy.clone());
                }
            }
        }

        // For comprehensive optimization, include strategies from multiple types
        if matches!(request.optimization_type, OptimizationType::Comprehensive) {
            for strategies in self.optimization_strategies.values() {
                for strategy in strategies {
                    if self.is_strategy_applicable(strategy, request).await? && 
                       !applicable_strategies.iter().any(|s| s.name == strategy.name) {
                        applicable_strategies.push(strategy.clone());
                    }
                }
            }
        }

        Ok(applicable_strategies)
    }

    async fn is_strategy_applicable(&self, strategy: &OptimizationStrategy, request: &PerformanceOptimizationRequest) -> Result<bool> {
        // Check if strategy conditions are met
        for condition in &strategy.conditions {
            if !self.evaluate_condition(condition, request).await? {
                return Ok(false);
            }
        }
        
        // Additional service-specific checks
        if !self.is_service_eligible(&request.target_service, strategy).await? {
            return Ok(false);
        }

        Ok(true)
    }

    async fn evaluate_condition(&self, condition: &OptimizationCondition, request: &PerformanceOptimizationRequest) -> Result<bool> {
        // Get current metric value for the service
        let metric_value = self.get_service_metric_value(&request.target_service, &condition.metric).await?;
        
        match condition.operator {
            ComparisonOperator::GreaterThan => Ok(metric_value > condition.threshold),
            ComparisonOperator::LessThan => Ok(metric_value < condition.threshold),
            ComparisonOperator::Equals => Ok((metric_value - condition.threshold).abs() < 0.001),
        }
    }

    async fn get_service_metric_value(&self, service_name: &str, metric: &str) -> Result<f64> {
        // This would typically fetch real metrics from the metrics collector
        // For now, return mock values based on service and metric type
        let value = match metric {
            "cpu_usage" => match service_name {
                "api-gateway" => 75.0,
                "tech-scanner" => 45.0,
                "llm-router" => 60.0,
                "orchestration-hub" => 35.0,
                _ => 50.0,
            },
            "memory_usage" => match service_name {
                "api-gateway" => 80.0,
                "tech-scanner" => 55.0,
                "llm-router" => 70.0,
                "orchestration-hub" => 40.0,
                _ => 60.0,
            },
            "response_time" => match service_name {
                "api-gateway" => 250.0,
                "tech-scanner" => 180.0,
                "llm-router" => 400.0,
                "orchestration-hub" => 120.0,
                _ => 200.0,
            },
            "error_rate" => match service_name {
                "api-gateway" => 2.5,
                "tech-scanner" => 1.0,
                "llm-router" => 3.0,
                "orchestration-hub" => 0.5,
                _ => 2.0,
            },
            _ => 0.0,
        };

        Ok(value)
    }

    async fn is_service_eligible(&self, service_name: &str, strategy: &OptimizationStrategy) -> Result<bool> {
        // Check if the service is in our configuration
        if !self.config.services.contains_key(service_name) {
            return Ok(false);
        }

        // Check service priority vs strategy impact
        let service_config = &self.config.services[service_name];
        let is_critical_service = service_config.priority == "critical";
        
        // Allow high-impact optimizations only on critical services in safety mode
        if self.config.optimization.safety_mode && 
           matches!(strategy.impact, ImpactLevel::Critical) && 
           !is_critical_service {
            return Ok(false);
        }

        Ok(true)
    }

    async fn strategy_to_recommendation(&self, strategy: &OptimizationStrategy, service_name: &str) -> Result<OptimizationRecommendation> {
        let category = match strategy.name.as_str() {
            name if name.contains("memory") => "memory",
            name if name.contains("cpu") => "cpu", 
            name if name.contains("database") => "database",
            name if name.contains("cache") => "cache",
            name if name.contains("network") => "network",
            _ => "general",
        }.to_string();

        let expected_benefit = self.calculate_expected_benefit(strategy, service_name).await?;

        Ok(OptimizationRecommendation {
            category,
            description: format!("{} for service '{}'", strategy.description, service_name),
            impact: strategy.impact.clone(),
            effort_required: strategy.effort.clone(),
            implementation_steps: strategy.steps.clone(),
            expected_benefit,
        })
    }

    async fn calculate_expected_benefit(&self, strategy: &OptimizationStrategy, service_name: &str) -> Result<String> {
        let benefit = match strategy.impact {
            ImpactLevel::Critical => match strategy.name.as_str() {
                name if name.contains("memory") => "40-60% memory usage reduction",
                name if name.contains("cpu") => "30-50% CPU usage reduction", 
                name if name.contains("database") => "60-80% query performance improvement",
                _ => "Significant performance improvement",
            },
            ImpactLevel::High => match strategy.name.as_str() {
                name if name.contains("memory") => "20-40% memory usage reduction",
                name if name.contains("cpu") => "15-30% CPU usage reduction",
                name if name.contains("cache") => "25-40% response time improvement",
                _ => "High performance improvement",
            },
            ImpactLevel::Medium => "10-25% performance improvement",
            ImpactLevel::Low => "5-15% performance improvement",
        };

        Ok(benefit.to_string())
    }

    async fn sort_recommendations_by_priority(&self, recommendations: &mut Vec<OptimizationRecommendation>, priority: &OptimizationPriority) -> Result<()> {
        recommendations.sort_by(|a, b| {
            // Sort by impact first
            let impact_order = |impact: &ImpactLevel| match impact {
                ImpactLevel::Critical => 4,
                ImpactLevel::High => 3,
                ImpactLevel::Medium => 2,
                ImpactLevel::Low => 1,
            };

            let effort_order = |effort: &EffortLevel| match effort {
                EffortLevel::Minimal => 1,
                EffortLevel::Low => 2,
                EffortLevel::Medium => 3,
                EffortLevel::High => 4,
            };

            // Primary sort: impact (higher first)
            let impact_cmp = impact_order(&b.impact).cmp(&impact_order(&a.impact));
            if impact_cmp != std::cmp::Ordering::Equal {
                return impact_cmp;
            }

            // Secondary sort: effort (lower first for same impact)
            effort_order(&a.effort_required).cmp(&effort_order(&b.effort_required))
        });

        // Limit recommendations based on priority
        let max_recommendations = match priority {
            OptimizationPriority::Critical => 10,
            OptimizationPriority::High => 7,
            OptimizationPriority::Medium => 5,
            OptimizationPriority::Low => 3,
        };

        recommendations.truncate(max_recommendations);
        Ok(())
    }

    fn build_optimization_strategies() -> HashMap<OptimizationType, Vec<OptimizationStrategy>> {
        let mut strategies = HashMap::new();

        // Memory optimization strategies
        strategies.insert(OptimizationType::Memory, vec![
            OptimizationStrategy {
                name: "memory_caching".to_string(),
                description: "Implement intelligent memory caching with TTL".to_string(),
                impact: ImpactLevel::High,
                effort: EffortLevel::Medium,
                steps: vec![
                    "Analyze memory usage patterns".to_string(),
                    "Implement LRU cache with appropriate size limits".to_string(),
                    "Add cache metrics and monitoring".to_string(),
                    "Configure cache eviction policies".to_string(),
                    "Test and validate cache effectiveness".to_string(),
                ],
                conditions: vec![
                    OptimizationCondition {
                        metric: "memory_usage".to_string(),
                        operator: ComparisonOperator::GreaterThan,
                        threshold: 70.0,
                    }
                ],
            },
            OptimizationStrategy {
                name: "garbage_collection_tuning".to_string(),
                description: "Optimize garbage collection parameters for better memory management".to_string(),
                impact: ImpactLevel::Medium,
                effort: EffortLevel::Low,
                steps: vec![
                    "Profile current GC behavior".to_string(),
                    "Adjust GC heap size parameters".to_string(),
                    "Configure GC algorithm selection".to_string(),
                    "Monitor GC performance impact".to_string(),
                ],
                conditions: vec![
                    OptimizationCondition {
                        metric: "memory_usage".to_string(),
                        operator: ComparisonOperator::GreaterThan,
                        threshold: 60.0,
                    }
                ],
            },
        ]);

        // CPU optimization strategies  
        strategies.insert(OptimizationType::Cpu, vec![
            OptimizationStrategy {
                name: "async_processing".to_string(),
                description: "Convert blocking operations to asynchronous processing".to_string(),
                impact: ImpactLevel::High,
                effort: EffortLevel::Medium,
                steps: vec![
                    "Identify CPU-intensive blocking operations".to_string(),
                    "Implement async/await patterns".to_string(),
                    "Add proper error handling for async operations".to_string(),
                    "Test concurrent processing capabilities".to_string(),
                ],
                conditions: vec![
                    OptimizationCondition {
                        metric: "cpu_usage".to_string(),
                        operator: ComparisonOperator::GreaterThan,
                        threshold: 75.0,
                    }
                ],
            },
            OptimizationStrategy {
                name: "load_balancing".to_string(),
                description: "Implement horizontal scaling with load balancing".to_string(),
                impact: ImpactLevel::Critical,
                effort: EffortLevel::High,
                steps: vec![
                    "Set up load balancer configuration".to_string(),
                    "Configure health checks for instances".to_string(),
                    "Implement session affinity if needed".to_string(),
                    "Monitor load distribution and performance".to_string(),
                ],
                conditions: vec![
                    OptimizationCondition {
                        metric: "cpu_usage".to_string(),
                        operator: ComparisonOperator::GreaterThan,
                        threshold: 80.0,
                    }
                ],
            },
        ]);

        // Database optimization strategies
        strategies.insert(OptimizationType::Database, vec![
            OptimizationStrategy {
                name: "query_optimization".to_string(),
                description: "Analyze and optimize slow database queries".to_string(),
                impact: ImpactLevel::High,
                effort: EffortLevel::Medium,
                steps: vec![
                    "Enable query logging and analysis".to_string(),
                    "Identify slow queries and bottlenecks".to_string(),
                    "Add appropriate database indexes".to_string(),
                    "Optimize query structure and joins".to_string(),
                    "Monitor query performance improvements".to_string(),
                ],
                conditions: vec![
                    OptimizationCondition {
                        metric: "response_time".to_string(),
                        operator: ComparisonOperator::GreaterThan,
                        threshold: 500.0,
                    }
                ],
            },
            OptimizationStrategy {
                name: "connection_pooling".to_string(),
                description: "Implement database connection pooling for better resource utilization".to_string(),
                impact: ImpactLevel::Medium,
                effort: EffortLevel::Low,
                steps: vec![
                    "Configure connection pool size".to_string(),
                    "Set appropriate timeout values".to_string(),
                    "Monitor connection usage patterns".to_string(),
                    "Implement connection health checks".to_string(),
                ],
                conditions: vec![
                    OptimizationCondition {
                        metric: "response_time".to_string(),
                        operator: ComparisonOperator::GreaterThan,
                        threshold: 300.0,
                    }
                ],
            },
        ]);

        // Network optimization strategies
        strategies.insert(OptimizationType::Network, vec![
            OptimizationStrategy {
                name: "response_compression".to_string(),
                description: "Enable response compression to reduce network overhead".to_string(),
                impact: ImpactLevel::Medium,
                effort: EffortLevel::Minimal,
                steps: vec![
                    "Enable gzip compression for responses".to_string(),
                    "Configure compression levels".to_string(),
                    "Test compression effectiveness".to_string(),
                    "Monitor bandwidth usage reduction".to_string(),
                ],
                conditions: vec![
                    OptimizationCondition {
                        metric: "response_time".to_string(),
                        operator: ComparisonOperator::GreaterThan,
                        threshold: 200.0,
                    }
                ],
            },
        ]);

        // Cache optimization strategies
        strategies.insert(OptimizationType::Cache, vec![
            OptimizationStrategy {
                name: "redis_caching".to_string(),
                description: "Implement Redis-based caching for frequently accessed data".to_string(),
                impact: ImpactLevel::High,
                effort: EffortLevel::Medium,
                steps: vec![
                    "Set up Redis cache infrastructure".to_string(),
                    "Identify cacheable data and operations".to_string(),
                    "Implement cache-aside pattern".to_string(),
                    "Configure cache expiration policies".to_string(),
                    "Monitor cache hit ratios and performance".to_string(),
                ],
                conditions: vec![
                    OptimizationCondition {
                        metric: "response_time".to_string(),
                        operator: ComparisonOperator::GreaterThan,
                        threshold: 400.0,
                    }
                ],
            },
        ]);

        strategies
    }
}