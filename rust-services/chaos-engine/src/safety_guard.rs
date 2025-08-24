use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn, error};
use crate::ChaosRequest;

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetyEvaluation {
    pub is_safe: bool,
    pub confidence: f64, // 0.0 to 1.0
    pub reason: String,
    pub risk_factors: Vec<RiskFactor>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RiskFactor {
    pub category: String,
    pub severity: String, // low, medium, high, critical
    pub description: String,
    pub mitigation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetyConfiguration {
    pub max_blast_radius: f64, // 0.0 to 1.0
    pub allowed_scenarios: Vec<String>,
    pub forbidden_targets: Vec<String>,
    pub max_concurrent_experiments: usize,
    pub business_hours_only: bool,
    pub require_approval_for_high_risk: bool,
    pub auto_abort_thresholds: SafetyThresholds,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetyThresholds {
    pub cpu_usage_percent: f64,
    pub memory_usage_percent: f64,
    pub disk_usage_percent: f64,
    pub response_time_ms: f64,
    pub error_rate_percent: f64,
}

pub struct SafetyGuard {
    config: SafetyConfiguration,
    active_experiments: HashMap<String, ExperimentRiskProfile>,
}

#[derive(Debug, Clone)]
struct ExperimentRiskProfile {
    risk_level: String,
    blast_radius: f64,
    target_criticality: String,
}

impl SafetyGuard {
    pub async fn new() -> Result<Self> {
        let config = SafetyConfiguration {
            max_blast_radius: 0.3, // 30% maximum impact
            allowed_scenarios: vec![
                "memory_pressure".to_string(),
                "network_latency".to_string(),
                "cpu_spike".to_string(),
                "connection_drop".to_string(),
                // "service_unavailable".to_string(), // Higher risk - requires approval
                // "disk_fill".to_string(),           // Higher risk - requires approval
            ],
            forbidden_targets: vec![
                "production-database".to_string(),
                "payment-service".to_string(),
                "auth-service".to_string(),
            ],
            max_concurrent_experiments: 3,
            business_hours_only: false, // Allow 24/7 for development
            require_approval_for_high_risk: true,
            auto_abort_thresholds: SafetyThresholds {
                cpu_usage_percent: 95.0,
                memory_usage_percent: 90.0,
                disk_usage_percent: 95.0,
                response_time_ms: 10000.0, // 10 seconds
                error_rate_percent: 50.0,
            },
        };

        info!("🛡️ Safety guard initialized with max blast radius: {}", config.max_blast_radius);
        
        Ok(SafetyGuard {
            config,
            active_experiments: HashMap::new(),
        })
    }

    pub async fn evaluate_safety(&self, request: &ChaosRequest) -> Result<SafetyEvaluation> {
        info!("🔍 Evaluating safety for chaos request: {} on {}", request.scenario, request.target);

        let mut risk_factors = Vec::new();
        let mut recommendations = Vec::new();
        let mut is_safe = true;
        let mut confidence = 1.0;

        // Check if scenario is allowed
        if !self.config.allowed_scenarios.contains(&request.scenario) {
            risk_factors.push(RiskFactor {
                category: "scenario_policy".to_string(),
                severity: "high".to_string(),
                description: format!("Scenario '{}' is not in allowed list", request.scenario),
                mitigation: Some("Use an approved scenario or request policy update".to_string()),
            });
            is_safe = false;
            confidence -= 0.8;
        }

        // Check if target is forbidden
        if self.config.forbidden_targets.contains(&request.target) {
            risk_factors.push(RiskFactor {
                category: "target_policy".to_string(),
                severity: "critical".to_string(),
                description: format!("Target '{}' is forbidden for chaos experiments", request.target),
                mitigation: Some("Choose a different target for experimentation".to_string()),
            });
            is_safe = false;
            confidence -= 1.0;
        }

        // Check concurrent experiments limit
        if self.active_experiments.len() >= self.config.max_concurrent_experiments {
            risk_factors.push(RiskFactor {
                category: "resource_limits".to_string(),
                severity: "medium".to_string(),
                description: format!(
                    "Maximum concurrent experiments reached: {}/{}",
                    self.active_experiments.len(),
                    self.config.max_concurrent_experiments
                ),
                mitigation: Some("Wait for current experiments to complete".to_string()),
            });
            is_safe = false;
            confidence -= 0.5;
        }

        // Evaluate duration risk
        if request.duration > 300_000 { // 5 minutes
            risk_factors.push(RiskFactor {
                category: "duration_risk".to_string(),
                severity: "medium".to_string(),
                description: format!("Long duration experiment: {}ms", request.duration),
                mitigation: Some("Consider shorter duration to reduce impact".to_string()),
            });
            confidence -= 0.2;
            recommendations.push("Consider reducing experiment duration to minimize risk".to_string());
        }

        // Evaluate intensity risk
        match request.intensity.as_str() {
            "high" => {
                risk_factors.push(RiskFactor {
                    category: "intensity_risk".to_string(),
                    severity: "high".to_string(),
                    description: "High intensity experiments carry elevated risk".to_string(),
                    mitigation: Some("Start with lower intensity and gradually increase".to_string()),
                });
                confidence -= 0.3;
                
                if !request.safety_mode.unwrap_or(true) {
                    risk_factors.push(RiskFactor {
                        category: "safety_mode".to_string(),
                        severity: "critical".to_string(),
                        description: "High intensity experiment without safety mode".to_string(),
                        mitigation: Some("Enable safety mode for high intensity experiments".to_string()),
                    });
                    is_safe = false;
                    confidence -= 0.7;
                }
            },
            "medium" => {
                confidence -= 0.1;
            },
            _ => {
                // Low intensity is generally safe
            }
        }

        // Scenario-specific risk assessment
        match request.scenario.as_str() {
            "service_unavailable" => {
                risk_factors.push(RiskFactor {
                    category: "scenario_impact".to_string(),
                    severity: "high".to_string(),
                    description: "Service unavailable can cause significant user impact".to_string(),
                    mitigation: Some("Ensure proper circuit breakers and fallbacks are in place".to_string()),
                });
                confidence -= 0.4;
                recommendations.push("Verify circuit breakers and monitoring are active".to_string());
            },
            "disk_fill" => {
                risk_factors.push(RiskFactor {
                    category: "scenario_impact".to_string(),
                    severity: "high".to_string(),
                    description: "Disk fill can cause system instability".to_string(),
                    mitigation: Some("Ensure automatic cleanup mechanisms are in place".to_string()),
                });
                confidence -= 0.3;
                recommendations.push("Monitor disk usage closely and have cleanup procedures ready".to_string());
            },
            _ => {
                // Other scenarios are generally safer
            }
        }

        // Business hours check (if enabled)
        if self.config.business_hours_only {
            let now = chrono::Utc::now();
            let hour = now.hour();
            let is_weekend = matches!(now.weekday(), chrono::Weekday::Sat | chrono::Weekday::Sun);
            
            if (hour < 9 || hour > 17) || is_weekend {
                recommendations.push("Consider running during business hours for better monitoring".to_string());
            }
        }

        // Final safety determination
        confidence = confidence.max(0.0).min(1.0);
        
        let reason = if is_safe {
            if confidence > 0.8 {
                "Experiment approved with high confidence".to_string()
            } else if confidence > 0.6 {
                "Experiment approved with moderate confidence - monitor closely".to_string()
            } else {
                "Experiment approved with low confidence - proceed with extreme caution".to_string()
            }
        } else {
            "Experiment rejected due to safety concerns".to_string()
        };

        if is_safe && confidence < 0.7 {
            recommendations.push("Enable enhanced monitoring for this experiment".to_string());
            recommendations.push("Have rollback procedures ready".to_string());
            recommendations.push("Consider shorter duration or lower intensity".to_string());
        }

        info!("🛡️ Safety evaluation completed: safe={}, confidence={:.2}", is_safe, confidence);

        Ok(SafetyEvaluation {
            is_safe,
            confidence,
            reason,
            risk_factors,
            recommendations,
        })
    }

    pub fn register_experiment(&mut self, experiment_id: String, scenario: &str, target: &str, intensity: &str) {
        let risk_level = match intensity {
            "high" => "high",
            "medium" => "medium",
            _ => "low",
        };

        let blast_radius = self.calculate_blast_radius(scenario, intensity);
        let target_criticality = self.assess_target_criticality(target);

        let profile = ExperimentRiskProfile {
            risk_level: risk_level.to_string(),
            blast_radius,
            target_criticality,
        };

        self.active_experiments.insert(experiment_id.clone(), profile);
        info!("📝 Registered experiment {} with risk level: {}", experiment_id, risk_level);
    }

    pub fn unregister_experiment(&mut self, experiment_id: &str) {
        if self.active_experiments.remove(experiment_id).is_some() {
            info!("📝 Unregistered experiment: {}", experiment_id);
        }
    }

    fn calculate_blast_radius(&self, scenario: &str, intensity: &str) -> f64 {
        let base_radius = match scenario {
            "memory_pressure" => 0.2,
            "cpu_spike" => 0.15,
            "network_latency" => 0.1,
            "connection_drop" => 0.25,
            "service_unavailable" => 0.8,
            "disk_fill" => 0.6,
            _ => 0.3,
        };

        let intensity_multiplier = match intensity {
            "low" => 0.5,
            "medium" => 1.0,
            "high" => 2.0,
            _ => 1.0,
        };

        (base_radius * intensity_multiplier).min(1.0)
    }

    fn assess_target_criticality(&self, target: &str) -> String {
        if self.config.forbidden_targets.contains(&target.to_string()) {
            "critical".to_string()
        } else if target.contains("prod") || target.contains("production") {
            "high".to_string()
        } else if target.contains("staging") || target.contains("test") {
            "low".to_string()
        } else {
            "medium".to_string()
        }
    }

    pub async fn should_abort_experiment(
        &self,
        _experiment_id: &str,
        current_metrics: &HashMap<String, f64>,
    ) -> Result<bool> {
        let thresholds = &self.config.auto_abort_thresholds;

        // Check CPU usage
        if let Some(cpu_usage) = current_metrics.get("cpu_usage") {
            if *cpu_usage > thresholds.cpu_usage_percent {
                warn!("🚨 Auto-abort trigger: CPU usage {}% > threshold {}%", 
                      cpu_usage, thresholds.cpu_usage_percent);
                return Ok(true);
            }
        }

        // Check memory usage
        if let Some(memory_usage) = current_metrics.get("memory_usage_percent") {
            if *memory_usage > thresholds.memory_usage_percent {
                warn!("🚨 Auto-abort trigger: Memory usage {}% > threshold {}%", 
                      memory_usage, thresholds.memory_usage_percent);
                return Ok(true);
            }
        }

        // Check disk usage
        if let Some(disk_usage) = current_metrics.get("disk_usage_percent") {
            if *disk_usage > thresholds.disk_usage_percent {
                warn!("🚨 Auto-abort trigger: Disk usage {}% > threshold {}%", 
                      disk_usage, thresholds.disk_usage_percent);
                return Ok(true);
            }
        }

        // Check response time
        if let Some(response_time) = current_metrics.get("response_time") {
            if *response_time > thresholds.response_time_ms {
                warn!("🚨 Auto-abort trigger: Response time {}ms > threshold {}ms", 
                      response_time, thresholds.response_time_ms);
                return Ok(true);
            }
        }

        // Check error rate
        if let Some(error_rate) = current_metrics.get("error_rate_percent") {
            if *error_rate > thresholds.error_rate_percent {
                warn!("🚨 Auto-abort trigger: Error rate {}% > threshold {}%", 
                      error_rate, thresholds.error_rate_percent);
                return Ok(true);
            }
        }

        Ok(false)
    }

    pub fn get_safety_status(&self) -> SafetyStatus {
        let total_blast_radius: f64 = self.active_experiments
            .values()
            .map(|profile| profile.blast_radius)
            .sum();

        let is_within_limits = total_blast_radius <= self.config.max_blast_radius;
        
        SafetyStatus {
            is_safe: is_within_limits,
            active_experiments: self.active_experiments.len(),
            total_blast_radius,
            max_blast_radius: self.config.max_blast_radius,
            safety_mode_enabled: true,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct SafetyStatus {
    pub is_safe: bool,
    pub active_experiments: usize,
    pub total_blast_radius: f64,
    pub max_blast_radius: f64,
    pub safety_mode_enabled: bool,
}