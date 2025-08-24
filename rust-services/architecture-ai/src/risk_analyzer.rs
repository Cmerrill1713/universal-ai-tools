use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn, debug};

#[derive(Debug, Clone)]
pub struct RiskAnalyzer {
    risk_models: HashMap<String, RiskModel>,
    historical_data: HashMap<String, Vec<MigrationOutcome>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskModel {
    pub model_id: String,
    pub model_name: String,
    pub risk_factors: Vec<RiskFactorWeight>,
    pub complexity_multipliers: HashMap<String, f64>,
    pub success_predictors: Vec<SuccessPredictor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactorWeight {
    pub factor_name: String,
    pub weight: f64,
    pub threshold_low: f64,
    pub threshold_medium: f64,
    pub threshold_high: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessPredictor {
    pub predictor_name: String,
    pub importance: f64,
    pub optimal_range: (f64, f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationOutcome {
    pub migration_id: String,
    pub from_technology: String,
    pub to_technology: String,
    pub success: bool,
    pub duration_days: u32,
    pub cost_actual: f64,
    pub cost_estimated: f64,
    pub issues_encountered: Vec<String>,
    pub team_size: u32,
    pub complexity_factors: HashMap<String, f64>,
    pub completed_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub overall_risk_score: f64,
    pub risk_level: RiskLevel,
    pub risk_factors: Vec<RiskFactor>,
    pub mitigation_strategies: Vec<String>,
    pub monitoring_points: Vec<String>,
    pub success_probability: f64,
    pub estimated_complications: Vec<EstimatedComplication>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RiskFactor {
    pub factor_name: String,
    pub factor_type: String,
    pub severity: String,
    pub probability: f64,
    pub impact_score: f64,
    pub description: String,
    pub mitigation: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EstimatedComplication {
    pub complication_type: String,
    pub probability: f64,
    pub potential_delay_days: u32,
    pub severity: String,
    pub prevention_measures: Vec<String>,
}

impl RiskAnalyzer {
    pub fn new() -> Self {
        let mut analyzer = Self {
            risk_models: HashMap::new(),
            historical_data: HashMap::new(),
        };

        // Initialize with default risk models
        analyzer.initialize_default_models();
        analyzer.load_historical_data();

        analyzer
    }

    pub fn assess_migration_risk(
        &self,
        from_tech: &str,
        to_tech: &str,
        complexity_factors: &HashMap<String, f64>,
        team_size: u32,
        available_time_days: u32,
    ) -> Result<RiskAssessment> {
        info!("🔍 Assessing migration risk: {} -> {}", from_tech, to_tech);

        let model_key = format!("{}->{}", from_tech, to_tech);
        let model = self.risk_models.get(&model_key)
            .or_else(|| self.risk_models.get("default"))
            .ok_or_else(|| anyhow::anyhow!("No risk model available"))?;

        // Calculate base risk score
        let base_risk = self.calculate_base_risk_score(model, complexity_factors)?;
        
        // Apply complexity multipliers
        let complexity_adjusted_risk = self.apply_complexity_multipliers(base_risk, model, complexity_factors)?;
        
        // Factor in team and time constraints
        let resource_adjusted_risk = self.apply_resource_adjustments(
            complexity_adjusted_risk,
            team_size,
            available_time_days,
            from_tech,
            to_tech,
        )?;

        let overall_risk_score = resource_adjusted_risk.min(1.0).max(0.0);
        let risk_level = self.determine_risk_level(overall_risk_score);

        // Generate detailed risk factors
        let risk_factors = self.generate_risk_factors(
            model,
            complexity_factors,
            team_size,
            available_time_days,
            from_tech,
            to_tech,
        )?;

        // Calculate success probability based on historical data
        let success_probability = self.calculate_success_probability(from_tech, to_tech, complexity_factors)?;

        // Generate mitigation strategies
        let mitigation_strategies = self.generate_mitigation_strategies(&risk_factors, from_tech, to_tech);

        // Generate monitoring points
        let monitoring_points = self.generate_monitoring_points(&risk_factors);

        // Estimate potential complications
        let estimated_complications = self.estimate_complications(from_tech, to_tech, &risk_factors)?;

        let assessment = RiskAssessment {
            overall_risk_score,
            risk_level,
            risk_factors,
            mitigation_strategies,
            monitoring_points,
            success_probability,
            estimated_complications,
        };

        debug!("Risk assessment completed: {:.2} risk score, {:.2} success probability", 
               overall_risk_score, success_probability);

        Ok(assessment)
    }

    fn calculate_base_risk_score(&self, model: &RiskModel, complexity_factors: &HashMap<String, f64>) -> Result<f64> {
        let mut risk_score = 0.0;
        let mut total_weight = 0.0;

        for factor_weight in &model.risk_factors {
            if let Some(factor_value) = complexity_factors.get(&factor_weight.factor_name) {
                let weighted_risk = factor_value * factor_weight.weight;
                risk_score += weighted_risk;
                total_weight += factor_weight.weight;
            }
        }

        if total_weight > 0.0 {
            Ok(risk_score / total_weight)
        } else {
            Ok(0.5) // Default moderate risk
        }
    }

    fn apply_complexity_multipliers(&self, base_risk: f64, model: &RiskModel, complexity_factors: &HashMap<String, f64>) -> Result<f64> {
        let mut multiplier = 1.0;

        for (factor_name, factor_value) in complexity_factors {
            if let Some(factor_multiplier) = model.complexity_multipliers.get(factor_name) {
                multiplier *= 1.0 + (factor_value * factor_multiplier);
            }
        }

        Ok(base_risk * multiplier)
    }

    fn apply_resource_adjustments(&self, risk: f64, team_size: u32, available_days: u32, from_tech: &str, to_tech: &str) -> Result<f64> {
        let mut adjusted_risk = risk;

        // Team size adjustment
        let optimal_team_size = self.get_optimal_team_size(from_tech, to_tech);
        if team_size < optimal_team_size {
            let team_penalty = (optimal_team_size - team_size) as f64 * 0.1;
            adjusted_risk += team_penalty;
        }

        // Time pressure adjustment
        let estimated_duration = self.get_estimated_duration(from_tech, to_tech);
        if available_days < estimated_duration {
            let time_pressure = ((estimated_duration - available_days) as f64 / estimated_duration as f64) * 0.3;
            adjusted_risk += time_pressure;
        }

        Ok(adjusted_risk)
    }

    fn determine_risk_level(&self, risk_score: f64) -> RiskLevel {
        match risk_score {
            x if x < 0.3 => RiskLevel::Low,
            x if x < 0.6 => RiskLevel::Medium,
            x if x < 0.8 => RiskLevel::High,
            _ => RiskLevel::Critical,
        }
    }

    fn generate_risk_factors(
        &self,
        model: &RiskModel,
        complexity_factors: &HashMap<String, f64>,
        team_size: u32,
        available_days: u32,
        from_tech: &str,
        to_tech: &str,
    ) -> Result<Vec<RiskFactor>> {
        let mut risk_factors = Vec::new();

        // Technology-specific risks
        risk_factors.extend(self.generate_technology_risks(from_tech, to_tech)?);

        // Complexity-based risks
        risk_factors.extend(self.generate_complexity_risks(complexity_factors)?);

        // Resource constraint risks
        risk_factors.extend(self.generate_resource_risks(team_size, available_days, from_tech, to_tech)?);

        // Historical pattern risks
        risk_factors.extend(self.generate_historical_pattern_risks(from_tech, to_tech)?);

        Ok(risk_factors)
    }

    fn generate_technology_risks(&self, from_tech: &str, to_tech: &str) -> Result<Vec<RiskFactor>> {
        let mut risks = Vec::new();

        match (from_tech, to_tech) {
            ("TypeScript", "Rust") => {
                risks.push(RiskFactor {
                    factor_name: "Language Paradigm Shift".to_string(),
                    factor_type: "technical".to_string(),
                    severity: "high".to_string(),
                    probability: 0.8,
                    impact_score: 0.7,
                    description: "Transition from garbage-collected to systems language requires significant mindset change".to_string(),
                    mitigation: "Provide comprehensive Rust training and pair programming with experienced developers".to_string(),
                });

                risks.push(RiskFactor {
                    factor_name: "Ecosystem Maturity".to_string(),
                    factor_type: "technical".to_string(),
                    severity: "medium".to_string(),
                    probability: 0.6,
                    impact_score: 0.5,
                    description: "Rust ecosystem for web services is less mature than Node.js ecosystem".to_string(),
                    mitigation: "Evaluate and select stable, well-maintained crates for core functionality".to_string(),
                });
            }

            ("Swift", "React Native") => {
                risks.push(RiskFactor {
                    factor_name: "Performance Regression".to_string(),
                    factor_type: "technical".to_string(),
                    severity: "medium".to_string(),
                    probability: 0.7,
                    impact_score: 0.6,
                    description: "React Native may introduce performance overhead compared to native Swift".to_string(),
                    mitigation: "Implement performance benchmarks and optimize critical paths".to_string(),
                });

                risks.push(RiskFactor {
                    factor_name: "Platform Feature Limitations".to_string(),
                    factor_type: "functional".to_string(),
                    severity: "medium".to_string(),
                    probability: 0.5,
                    impact_score: 0.4,
                    description: "Some native iOS features may not be available or require custom bridging".to_string(),
                    mitigation: "Audit current feature usage and plan custom native modules where needed".to_string(),
                });
            }

            _ => {
                risks.push(RiskFactor {
                    factor_name: "Unknown Migration Path".to_string(),
                    factor_type: "process".to_string(),
                    severity: "high".to_string(),
                    probability: 0.9,
                    impact_score: 0.8,
                    description: "Limited historical data for this specific migration path".to_string(),
                    mitigation: "Conduct thorough proof-of-concept and pilot migration".to_string(),
                });
            }
        }

        Ok(risks)
    }

    fn generate_complexity_risks(&self, complexity_factors: &HashMap<String, f64>) -> Result<Vec<RiskFactor>> {
        let mut risks = Vec::new();

        if let Some(learning_curve) = complexity_factors.get("learning_curve") {
            if *learning_curve > 0.7 {
                risks.push(RiskFactor {
                    factor_name: "High Learning Curve".to_string(),
                    factor_type: "team".to_string(),
                    severity: "high".to_string(),
                    probability: 0.8,
                    impact_score: 0.7,
                    description: "Target technology has steep learning curve for the team".to_string(),
                    mitigation: "Provide extensive training and mentoring support".to_string(),
                });
            }
        }

        if let Some(tooling_maturity) = complexity_factors.get("tooling_support") {
            if *tooling_maturity < 0.5 {
                risks.push(RiskFactor {
                    factor_name: "Immature Tooling".to_string(),
                    factor_type: "technical".to_string(),
                    severity: "medium".to_string(),
                    probability: 0.6,
                    impact_score: 0.5,
                    description: "Development and debugging tools for target technology are not mature".to_string(),
                    mitigation: "Invest in custom tooling development or alternative solutions".to_string(),
                });
            }
        }

        Ok(risks)
    }

    fn generate_resource_risks(&self, team_size: u32, available_days: u32, from_tech: &str, to_tech: &str) -> Result<Vec<RiskFactor>> {
        let mut risks = Vec::new();

        let optimal_team_size = self.get_optimal_team_size(from_tech, to_tech);
        if team_size < optimal_team_size / 2 {
            risks.push(RiskFactor {
                factor_name: "Insufficient Team Size".to_string(),
                factor_type: "resource".to_string(),
                severity: "high".to_string(),
                probability: 0.9,
                impact_score: 0.8,
                description: format!("Team size ({}) is significantly below optimal ({})", team_size, optimal_team_size),
                mitigation: "Consider hiring additional developers or extending timeline".to_string(),
            });
        }

        let estimated_duration = self.get_estimated_duration(from_tech, to_tech);
        if available_days < estimated_duration {
            let time_pressure = ((estimated_duration - available_days) as f64 / estimated_duration as f64) * 100.0;
            risks.push(RiskFactor {
                factor_name: "Timeline Pressure".to_string(),
                factor_type: "schedule".to_string(),
                severity: if time_pressure > 50.0 { "high" } else { "medium" }.to_string(),
                probability: 0.8,
                impact_score: 0.6,
                description: format!("Available time ({} days) is {:.0}% shorter than estimated ({} days)", 
                                   available_days, time_pressure, estimated_duration),
                mitigation: "Negotiate timeline extension or reduce scope".to_string(),
            });
        }

        Ok(risks)
    }

    fn generate_historical_pattern_risks(&self, from_tech: &str, to_tech: &str) -> Result<Vec<RiskFactor>> {
        let mut risks = Vec::new();

        let migration_key = format!("{}->{}", from_tech, to_tech);
        if let Some(historical_outcomes) = self.historical_data.get(&migration_key) {
            let failure_rate = historical_outcomes.iter()
                .map(|outcome| if outcome.success { 0.0 } else { 1.0 })
                .sum::<f64>() / historical_outcomes.len() as f64;

            if failure_rate > 0.3 {
                risks.push(RiskFactor {
                    factor_name: "Historical Failure Pattern".to_string(),
                    factor_type: "historical".to_string(),
                    severity: "high".to_string(),
                    probability: failure_rate,
                    impact_score: 0.9,
                    description: format!("Historical failure rate for this migration path is {:.1}%", failure_rate * 100.0),
                    mitigation: "Study failed migrations and implement preventive measures".to_string(),
                });
            }

            // Check for common issues
            let mut issue_frequency: HashMap<String, usize> = HashMap::new();
            for outcome in historical_outcomes {
                for issue in &outcome.issues_encountered {
                    *issue_frequency.entry(issue.clone()).or_insert(0) += 1;
                }
            }

            for (issue, frequency) in issue_frequency {
                if frequency > historical_outcomes.len() / 2 {
                    risks.push(RiskFactor {
                        factor_name: format!("Common Issue: {}", issue),
                        factor_type: "pattern".to_string(),
                        severity: "medium".to_string(),
                        probability: frequency as f64 / historical_outcomes.len() as f64,
                        impact_score: 0.4,
                        description: format!("This issue occurred in {}% of similar migrations", 
                                           (frequency * 100) / historical_outcomes.len()),
                        mitigation: "Plan specific mitigation for this known issue".to_string(),
                    });
                }
            }
        }

        Ok(risks)
    }

    fn calculate_success_probability(&self, from_tech: &str, to_tech: &str, complexity_factors: &HashMap<String, f64>) -> Result<f64> {
        let migration_key = format!("{}->{}", from_tech, to_tech);
        
        if let Some(historical_outcomes) = self.historical_data.get(&migration_key) {
            // Calculate base success rate from historical data
            let success_rate = historical_outcomes.iter()
                .map(|outcome| if outcome.success { 1.0 } else { 0.0 })
                .sum::<f64>() / historical_outcomes.len() as f64;

            // Adjust based on complexity factors
            let complexity_penalty = complexity_factors.values().sum::<f64>() / complexity_factors.len() as f64;
            let adjusted_probability = success_rate * (1.0 - (complexity_penalty - 0.5).max(0.0) * 0.5);

            Ok(adjusted_probability.max(0.1).min(0.95))
        } else {
            // Default probability for unknown migration paths
            let complexity_penalty = complexity_factors.values().sum::<f64>() / complexity_factors.len() as f64;
            Ok((0.6 - complexity_penalty * 0.3).max(0.2).min(0.8))
        }
    }

    fn generate_mitigation_strategies(&self, risk_factors: &[RiskFactor], from_tech: &str, to_tech: &str) -> Vec<String> {
        let mut strategies = Vec::new();

        // Add specific strategies based on risk factors
        for risk in risk_factors {
            if !strategies.contains(&risk.mitigation) {
                strategies.push(risk.mitigation.clone());
            }
        }

        // Add general migration strategies
        strategies.extend(vec![
            "Implement comprehensive automated testing".to_string(),
            "Set up continuous integration and deployment".to_string(),
            "Create detailed rollback procedures".to_string(),
            "Establish monitoring and alerting".to_string(),
            "Plan incremental migration phases".to_string(),
        ]);

        // Add technology-specific strategies
        match (from_tech, to_tech) {
            ("TypeScript", "Rust") => {
                strategies.push("Create Rust-TypeScript FFI bridge for gradual migration".to_string());
                strategies.push("Implement property-based testing for type safety verification".to_string());
            }
            ("Swift", "React Native") => {
                strategies.push("Maintain native modules for performance-critical components".to_string());
                strategies.push("Implement platform-specific optimizations".to_string());
            }
            _ => {}
        }

        strategies.sort();
        strategies.dedup();
        strategies
    }

    fn generate_monitoring_points(&self, risk_factors: &[RiskFactor]) -> Vec<String> {
        let mut monitoring_points = Vec::new();

        // Base monitoring points
        monitoring_points.extend(vec![
            "Build success rate and duration".to_string(),
            "Test coverage and pass rate".to_string(),
            "Performance benchmarks".to_string(),
            "Error rates and types".to_string(),
            "Team velocity and blockers".to_string(),
        ]);

        // Risk-specific monitoring
        for risk in risk_factors {
            match risk.factor_type.as_str() {
                "technical" => {
                    monitoring_points.push("Technical debt accumulation".to_string());
                    monitoring_points.push("Code quality metrics".to_string());
                }
                "team" => {
                    monitoring_points.push("Team confidence and satisfaction".to_string());
                    monitoring_points.push("Knowledge transfer completion".to_string());
                }
                "schedule" => {
                    monitoring_points.push("Milestone completion rate".to_string());
                    monitoring_points.push("Scope creep indicators".to_string());
                }
                _ => {}
            }
        }

        monitoring_points.sort();
        monitoring_points.dedup();
        monitoring_points
    }

    fn estimate_complications(&self, from_tech: &str, to_tech: &str, risk_factors: &[RiskFactor]) -> Result<Vec<EstimatedComplication>> {
        let mut complications = Vec::new();

        // Common complications based on technology pairs
        match (from_tech, to_tech) {
            ("TypeScript", "Rust") => {
                complications.push(EstimatedComplication {
                    complication_type: "Memory Management Issues".to_string(),
                    probability: 0.7,
                    potential_delay_days: 5,
                    severity: "medium".to_string(),
                    prevention_measures: vec![
                        "Comprehensive Rust ownership training".to_string(),
                        "Code review focus on memory safety".to_string(),
                    ],
                });

                complications.push(EstimatedComplication {
                    complication_type: "Performance Optimization Rabbit Holes".to_string(),
                    probability: 0.5,
                    potential_delay_days: 10,
                    severity: "high".to_string(),
                    prevention_measures: vec![
                        "Set clear performance targets upfront".to_string(),
                        "Time-box optimization efforts".to_string(),
                    ],
                });
            }

            ("Swift", "React Native") => {
                complications.push(EstimatedComplication {
                    complication_type: "Platform-Specific Feature Gaps".to_string(),
                    probability: 0.6,
                    potential_delay_days: 8,
                    severity: "medium".to_string(),
                    prevention_measures: vec![
                        "Audit native feature usage early".to_string(),
                        "Prepare native module bridging solutions".to_string(),
                    ],
                });
            }

            _ => {}
        }

        // Risk-factor-driven complications
        for risk in risk_factors {
            if risk.probability > 0.7 && risk.impact_score > 0.5 {
                complications.push(EstimatedComplication {
                    complication_type: format!("High-risk factor: {}", risk.factor_name),
                    probability: risk.probability,
                    potential_delay_days: ((risk.impact_score * 14.0) as u32).max(1),
                    severity: risk.severity.clone(),
                    prevention_measures: vec![risk.mitigation.clone()],
                });
            }
        }

        Ok(complications)
    }

    fn get_optimal_team_size(&self, from_tech: &str, to_tech: &str) -> u32 {
        // Technology-specific optimal team sizes based on complexity
        match (from_tech, to_tech) {
            ("TypeScript", "Rust") => 4,
            ("Swift", "React Native") => 3,
            ("Go", "Rust") => 3,
            _ => 3,
        }
    }

    fn get_estimated_duration(&self, from_tech: &str, to_tech: &str) -> u32 {
        // Estimated duration in days for typical migrations
        match (from_tech, to_tech) {
            ("TypeScript", "Rust") => 45,
            ("Swift", "React Native") => 35,
            ("Go", "Rust") => 25,
            _ => 30,
        }
    }

    fn initialize_default_models(&mut self) {
        // Default risk model
        let default_model = RiskModel {
            model_id: "default".to_string(),
            model_name: "Default Migration Risk Model".to_string(),
            risk_factors: vec![
                RiskFactorWeight {
                    factor_name: "learning_curve".to_string(),
                    weight: 0.25,
                    threshold_low: 0.3,
                    threshold_medium: 0.6,
                    threshold_high: 0.8,
                },
                RiskFactorWeight {
                    factor_name: "tooling_support".to_string(),
                    weight: 0.20,
                    threshold_low: 0.7,
                    threshold_medium: 0.5,
                    threshold_high: 0.3,
                },
                RiskFactorWeight {
                    factor_name: "community_support".to_string(),
                    weight: 0.15,
                    threshold_low: 0.8,
                    threshold_medium: 0.6,
                    threshold_high: 0.4,
                },
                RiskFactorWeight {
                    factor_name: "ecosystem_maturity".to_string(),
                    weight: 0.20,
                    threshold_low: 0.8,
                    threshold_medium: 0.6,
                    threshold_high: 0.4,
                },
                RiskFactorWeight {
                    factor_name: "language_barrier".to_string(),
                    weight: 0.20,
                    threshold_low: 0.3,
                    threshold_medium: 0.6,
                    threshold_high: 0.8,
                },
            ],
            complexity_multipliers: HashMap::from([
                ("breaking_changes".to_string(), 0.3),
                ("architecture_changes".to_string(), 0.4),
                ("team_experience".to_string(), -0.2),
            ]),
            success_predictors: vec![
                SuccessPredictor {
                    predictor_name: "team_experience".to_string(),
                    importance: 0.3,
                    optimal_range: (0.7, 1.0),
                },
                SuccessPredictor {
                    predictor_name: "preparation_time".to_string(),
                    importance: 0.2,
                    optimal_range: (0.8, 1.2),
                },
            ],
        };

        self.risk_models.insert("default".to_string(), default_model);

        // Technology-specific models would be added here
    }

    fn load_historical_data(&mut self) {
        // In a real implementation, this would load from a database
        // For now, add some sample historical data
        
        let ts_to_rust_outcomes = vec![
            MigrationOutcome {
                migration_id: "ts-rust-001".to_string(),
                from_technology: "TypeScript".to_string(),
                to_technology: "Rust".to_string(),
                success: true,
                duration_days: 52,
                cost_actual: 45000.0,
                cost_estimated: 40000.0,
                issues_encountered: vec![
                    "Memory management learning curve".to_string(),
                    "Async runtime differences".to_string(),
                ],
                team_size: 4,
                complexity_factors: HashMap::from([
                    ("learning_curve".to_string(), 0.8),
                    ("tooling_support".to_string(), 0.7),
                ]),
                completed_at: chrono::Utc::now() - chrono::Duration::days(90),
            },
            MigrationOutcome {
                migration_id: "ts-rust-002".to_string(),
                from_technology: "TypeScript".to_string(),
                to_technology: "Rust".to_string(),
                success: false,
                duration_days: 30,
                cost_actual: 35000.0,
                cost_estimated: 30000.0,
                issues_encountered: vec![
                    "Insufficient team training".to_string(),
                    "Underestimated complexity".to_string(),
                ],
                team_size: 2,
                complexity_factors: HashMap::from([
                    ("learning_curve".to_string(), 0.9),
                    ("team_experience".to_string(), 0.2),
                ]),
                completed_at: chrono::Utc::now() - chrono::Duration::days(60),
            },
        ];

        self.historical_data.insert("TypeScript->Rust".to_string(), ts_to_rust_outcomes);
    }
}