use anyhow::{anyhow, Result};
use std::collections::HashMap;
use tracing::{debug, info, warn};

use crate::config::Config;
use crate::metrics_collector::{MetricsCollector, MetricsSnapshot};
use crate::{
    SystemPerformanceReport, ServicePerformance, PerformanceBottleneck, 
    OptimizationRecommendation, ImpactLevel, EffortLevel
};

pub struct PerformanceAnalyzer {
    config: Config,
    metrics_collector: std::sync::Arc<MetricsCollector>,
}

impl PerformanceAnalyzer {
    pub async fn new(config: &Config) -> Result<Self> {
        let metrics_collector = std::sync::Arc::new(MetricsCollector::new(config).await?);
        
        Ok(Self {
            config: config.clone(),
            metrics_collector,
        })
    }

    pub async fn analyze_system_performance(&self) -> Result<()> {
        debug!("🔍 Analyzing system performance");

        // Get recent metrics for analysis
        let recent_metrics = self.metrics_collector.get_metrics_history(1).await?;
        
        if recent_metrics.is_empty() {
            warn!("No recent metrics available for analysis");
            return Ok(());
        }

        // Perform various analysis tasks
        self.detect_performance_anomalies(&recent_metrics).await?;
        self.identify_resource_bottlenecks(&recent_metrics).await?;
        self.analyze_service_health_trends(&recent_metrics).await?;

        info!("✅ Performance analysis completed");
        Ok(())
    }

    pub async fn generate_system_report(&self) -> Result<SystemPerformanceReport> {
        info!("📊 Generating comprehensive system performance report");

        let current_metrics = self.metrics_collector.collect_all_metrics().await?;
        let historical_metrics = self.metrics_collector.get_metrics_history(24).await?;

        // Calculate overall performance score
        let overall_score = self.calculate_overall_performance_score(&current_metrics).await?;

        // Generate service performance summaries
        let service_performances = self.generate_service_performances(&current_metrics).await?;

        // Identify current bottlenecks
        let bottlenecks = self.identify_bottlenecks().await?;

        // Generate optimization recommendations
        let recommendations = self.get_optimization_recommendations().await?;

        let report = SystemPerformanceReport {
            timestamp: chrono::Utc::now(),
            overall_score,
            service_performances,
            bottlenecks,
            recommendations,
        };

        info!("✅ Performance report generated with score: {:.2}", overall_score);
        Ok(report)
    }

    async fn calculate_overall_performance_score(&self, metrics: &MetricsSnapshot) -> Result<f64> {
        let mut score = 100.0;

        // System metrics impact on score
        let cpu_usage = metrics.system_metrics.cpu_usage;
        if cpu_usage > self.config.thresholds.cpu_critical {
            score -= 30.0;
        } else if cpu_usage > self.config.thresholds.cpu_warning {
            score -= 15.0;
        }

        let memory_usage = metrics.system_metrics.memory_usage;
        if memory_usage > self.config.thresholds.memory_critical {
            score -= 25.0;
        } else if memory_usage > self.config.thresholds.memory_warning {
            score -= 10.0;
        }

        // Service health impact on score
        let unhealthy_services = metrics.service_metrics.values()
            .filter(|service| service.status != "healthy")
            .count();

        score -= (unhealthy_services as f64) * 10.0;

        // Response time impact on score
        let avg_response_time = metrics.service_metrics.values()
            .map(|service| service.response_time)
            .sum::<f64>() / metrics.service_metrics.len() as f64;

        if avg_response_time > self.config.thresholds.response_time_critical {
            score -= 20.0;
        } else if avg_response_time > self.config.thresholds.response_time_warning {
            score -= 10.0;
        }

        // Error rate impact on score
        for service_metrics in metrics.service_metrics.values() {
            if service_metrics.request_count > 0 {
                let error_rate = (service_metrics.error_count as f64 / service_metrics.request_count as f64) * 100.0;
                if error_rate > self.config.thresholds.error_rate_critical {
                    score -= 15.0;
                } else if error_rate > self.config.thresholds.error_rate_warning {
                    score -= 5.0;
                }
            }
        }

        Ok(score.max(0.0))
    }

    async fn generate_service_performances(&self, metrics: &MetricsSnapshot) -> Result<HashMap<String, ServicePerformance>> {
        let mut service_performances = HashMap::new();

        for (service_name, service_metrics) in &metrics.service_metrics {
            let error_rate = if service_metrics.request_count > 0 {
                (service_metrics.error_count as f64 / service_metrics.request_count as f64) * 100.0
            } else {
                0.0
            };

            let throughput = service_metrics.request_count as f64 / 60.0; // requests per second (simplified)

            let health_score = self.calculate_service_health_score(service_metrics, error_rate).await?;

            let performance = ServicePerformance {
                service_name: service_name.clone(),
                cpu_usage: service_metrics.cpu_usage,
                memory_usage: service_metrics.memory_usage,
                response_time: service_metrics.response_time,
                throughput,
                error_rate,
                health_score,
            };

            service_performances.insert(service_name.clone(), performance);
        }

        Ok(service_performances)
    }

    async fn calculate_service_health_score(&self, metrics: &crate::metrics_collector::ServiceMetrics, error_rate: f64) -> Result<f64> {
        let mut score: f64 = 100.0;

        // Health status impact
        if metrics.status != "healthy" {
            score -= 50.0;
        }

        // Response time impact
        if metrics.response_time > self.config.thresholds.response_time_critical {
            score -= 30.0;
        } else if metrics.response_time > self.config.thresholds.response_time_warning {
            score -= 15.0;
        }

        // Error rate impact
        if error_rate > self.config.thresholds.error_rate_critical {
            score -= 25.0;
        } else if error_rate > self.config.thresholds.error_rate_warning {
            score -= 10.0;
        }

        // CPU usage impact
        if metrics.cpu_usage > 90.0 {
            score -= 15.0;
        } else if metrics.cpu_usage > 70.0 {
            score -= 5.0;
        }

        Ok(score.max(0.0))
    }

    pub async fn identify_bottlenecks(&self) -> Result<Vec<PerformanceBottleneck>> {
        debug!("🔍 Identifying performance bottlenecks");

        let current_metrics = self.metrics_collector.collect_all_metrics().await?;
        let mut bottlenecks = Vec::new();

        // System-level bottlenecks
        if current_metrics.system_metrics.cpu_usage > self.config.thresholds.cpu_critical {
            bottlenecks.push(PerformanceBottleneck {
                service: "system".to_string(),
                bottleneck_type: "cpu_exhaustion".to_string(),
                severity: ImpactLevel::Critical,
                description: format!("System CPU usage at {:.1}% (critical threshold: {:.1}%)", 
                    current_metrics.system_metrics.cpu_usage, self.config.thresholds.cpu_critical),
                suggested_fix: "Scale horizontally, optimize CPU-intensive operations, or implement load balancing".to_string(),
            });
        }

        if current_metrics.system_metrics.memory_usage > self.config.thresholds.memory_critical {
            bottlenecks.push(PerformanceBottleneck {
                service: "system".to_string(),
                bottleneck_type: "memory_exhaustion".to_string(),
                severity: ImpactLevel::Critical,
                description: format!("System memory usage at {:.1}% (critical threshold: {:.1}%)", 
                    current_metrics.system_metrics.memory_usage, self.config.thresholds.memory_critical),
                suggested_fix: "Increase memory, implement memory optimization, or add caching".to_string(),
            });
        }

        // Service-level bottlenecks
        for (service_name, service_metrics) in &current_metrics.service_metrics {
            if service_metrics.response_time > self.config.thresholds.response_time_critical {
                bottlenecks.push(PerformanceBottleneck {
                    service: service_name.clone(),
                    bottleneck_type: "slow_response".to_string(),
                    severity: ImpactLevel::High,
                    description: format!("Service {} response time: {:.1}ms (critical threshold: {:.1}ms)", 
                        service_name, service_metrics.response_time, self.config.thresholds.response_time_critical),
                    suggested_fix: "Optimize database queries, implement caching, or scale service instances".to_string(),
                });
            }

            if service_metrics.status != "healthy" {
                bottlenecks.push(PerformanceBottleneck {
                    service: service_name.clone(),
                    bottleneck_type: "service_unavailable".to_string(),
                    severity: ImpactLevel::Critical,
                    description: format!("Service {} is reporting unhealthy status: {}", service_name, service_metrics.status),
                    suggested_fix: "Check service logs, restart service, or investigate underlying issues".to_string(),
                });
            }

            if service_metrics.request_count > 0 {
                let error_rate = (service_metrics.error_count as f64 / service_metrics.request_count as f64) * 100.0;
                if error_rate > self.config.thresholds.error_rate_critical {
                    bottlenecks.push(PerformanceBottleneck {
                        service: service_name.clone(),
                        bottleneck_type: "high_error_rate".to_string(),
                        severity: ImpactLevel::High,
                        description: format!("Service {} error rate: {:.1}% (critical threshold: {:.1}%)", 
                            service_name, error_rate, self.config.thresholds.error_rate_critical),
                        suggested_fix: "Review error logs, fix application bugs, or improve error handling".to_string(),
                    });
                }
            }
        }

        info!("🔍 Identified {} performance bottlenecks", bottlenecks.len());
        Ok(bottlenecks)
    }

    pub async fn get_optimization_recommendations(&self) -> Result<Vec<OptimizationRecommendation>> {
        debug!("💡 Generating optimization recommendations");

        let current_metrics = self.metrics_collector.collect_all_metrics().await?;
        let mut recommendations = Vec::new();

        // System-level recommendations
        if current_metrics.system_metrics.memory_usage > self.config.thresholds.memory_warning {
            recommendations.push(OptimizationRecommendation {
                category: "memory".to_string(),
                description: "Implement memory optimization and garbage collection tuning".to_string(),
                impact: if current_metrics.system_metrics.memory_usage > self.config.thresholds.memory_critical { 
                    ImpactLevel::Critical 
                } else { 
                    ImpactLevel::High 
                },
                effort_required: EffortLevel::Medium,
                implementation_steps: vec![
                    "Enable memory profiling on all services".to_string(),
                    "Implement memory caching with TTL".to_string(),
                    "Optimize data structures and algorithms".to_string(),
                    "Configure garbage collection parameters".to_string(),
                ],
                expected_benefit: "20-30% memory usage reduction, improved response times".to_string(),
            });
        }

        if current_metrics.system_metrics.cpu_usage > self.config.thresholds.cpu_warning {
            recommendations.push(OptimizationRecommendation {
                category: "cpu".to_string(),
                description: "Optimize CPU-intensive operations and implement load balancing".to_string(),
                impact: ImpactLevel::High,
                effort_required: EffortLevel::Medium,
                implementation_steps: vec![
                    "Profile CPU usage across all services".to_string(),
                    "Implement asynchronous processing for heavy operations".to_string(),
                    "Add horizontal scaling for CPU-bound services".to_string(),
                    "Optimize algorithms and reduce computational complexity".to_string(),
                ],
                expected_benefit: "25-40% CPU usage reduction, improved throughput".to_string(),
            });
        }

        // Service-specific recommendations
        for (service_name, service_metrics) in &current_metrics.service_metrics {
            if service_metrics.response_time > self.config.thresholds.response_time_warning {
                recommendations.push(OptimizationRecommendation {
                    category: "response_time".to_string(),
                    description: format!("Optimize response time for {}", service_name),
                    impact: ImpactLevel::Medium,
                    effort_required: EffortLevel::Low,
                    implementation_steps: vec![
                        "Implement response caching".to_string(),
                        "Optimize database queries".to_string(),
                        "Add connection pooling".to_string(),
                        "Enable compression for API responses".to_string(),
                    ],
                    expected_benefit: "50-70% response time improvement".to_string(),
                });
            }

            if service_metrics.status != "healthy" {
                recommendations.push(OptimizationRecommendation {
                    category: "reliability".to_string(),
                    description: format!("Improve reliability for {}", service_name),
                    impact: ImpactLevel::Critical,
                    effort_required: EffortLevel::High,
                    implementation_steps: vec![
                        "Implement comprehensive health checks".to_string(),
                        "Add circuit breaker patterns".to_string(),
                        "Implement graceful degradation".to_string(),
                        "Add proper logging and monitoring".to_string(),
                    ],
                    expected_benefit: "99.9% uptime improvement, reduced incident count".to_string(),
                });
            }
        }

        // Database optimization recommendations
        if let Some(db_metrics) = &current_metrics.database_metrics {
            if db_metrics.slow_queries > 5 {
                recommendations.push(OptimizationRecommendation {
                    category: "database".to_string(),
                    description: "Optimize database performance and query efficiency".to_string(),
                    impact: ImpactLevel::High,
                    effort_required: EffortLevel::Medium,
                    implementation_steps: vec![
                        "Analyze and optimize slow queries".to_string(),
                        "Add appropriate database indexes".to_string(),
                        "Implement query result caching".to_string(),
                        "Configure connection pooling".to_string(),
                    ],
                    expected_benefit: "60-80% query performance improvement".to_string(),
                });
            }

            if db_metrics.cache_hit_ratio < 90.0 {
                recommendations.push(OptimizationRecommendation {
                    category: "cache".to_string(),
                    description: "Improve database caching strategy".to_string(),
                    impact: ImpactLevel::Medium,
                    effort_required: EffortLevel::Low,
                    implementation_steps: vec![
                        "Increase cache size allocation".to_string(),
                        "Optimize cache eviction policies".to_string(),
                        "Implement application-level caching".to_string(),
                        "Add cache warming strategies".to_string(),
                    ],
                    expected_benefit: "15-25% database load reduction".to_string(),
                });
            }
        }

        info!("💡 Generated {} optimization recommendations", recommendations.len());
        Ok(recommendations)
    }

    pub async fn get_services_performance(&self) -> Result<HashMap<String, ServicePerformance>> {
        let current_metrics = self.metrics_collector.collect_all_metrics().await?;
        self.generate_service_performances(&current_metrics).await
    }

    async fn detect_performance_anomalies(&self, metrics: &[MetricsSnapshot]) -> Result<()> {
        // Implement anomaly detection logic
        // This could use statistical analysis, machine learning, or threshold-based detection
        debug!("🔍 Detecting performance anomalies in {} metric snapshots", metrics.len());
        Ok(())
    }

    async fn identify_resource_bottlenecks(&self, metrics: &[MetricsSnapshot]) -> Result<()> {
        // Analyze resource usage patterns to identify bottlenecks
        debug!("🔍 Identifying resource bottlenecks");
        Ok(())
    }

    async fn analyze_service_health_trends(&self, metrics: &[MetricsSnapshot]) -> Result<()> {
        // Analyze service health trends over time
        debug!("📈 Analyzing service health trends");
        Ok(())
    }
}