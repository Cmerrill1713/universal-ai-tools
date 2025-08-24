use crate::config::Config;
use crate::{
    ArchitectureDecisionRequest, ArchitectureDecision, MigrationRecommendation,
    ApprovedMigration, RejectedMigration, ExecutionPlan, ExecutionPhase, 
    ExecutionTask, TaskType, AutomationLevel, MonitoringCheckpoint,
    RiskAssessment, RiskFactor, RollbackPlan, SystemConstraints, PriorityFactors
};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn, debug};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct DecisionEngine {
    config: Config,
    decision_matrix: DecisionMatrix,
    risk_weights: RiskWeights,
    migration_templates: HashMap<String, MigrationTemplate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DecisionMatrix {
    // Technology compatibility matrix
    compatibility_scores: HashMap<String, HashMap<String, f64>>,
    
    // Migration complexity scores
    complexity_factors: HashMap<String, ComplexityFactor>,
    
    // Success probability based on historical data
    historical_success_rates: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ComplexityFactor {
    language_barrier: f64,    // How different the languages are
    ecosystem_maturity: f64,  // How mature the target ecosystem is
    tooling_support: f64,     // Quality of migration tools
    community_support: f64,   // Community size and activity
    learning_curve: f64,      // Difficulty for developers
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RiskWeights {
    performance_risk: f64,
    security_risk: f64,
    maintenance_risk: f64,
    business_continuity_risk: f64,
    technical_debt_risk: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MigrationTemplate {
    template_id: String,
    from_technology: String,
    to_technology: String,
    phases: Vec<PhaseTemplate>,
    estimated_duration_multiplier: f64,
    resource_requirements: ResourceRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PhaseTemplate {
    phase_name: String,
    tasks: Vec<TaskTemplate>,
    dependencies: Vec<String>,
    validation_criteria: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TaskTemplate {
    task_name: String,
    task_type: TaskType,
    automation_level: AutomationLevel,
    estimated_duration_hours: f64,
    risk_level: String,
    success_criteria: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ResourceRequirements {
    cpu_cores: u32,
    memory_gb: u32,
    storage_gb: u32,
    network_bandwidth_mbps: u32,
}

impl DecisionEngine {
    pub async fn new(config: &Config) -> Result<Self> {
        info!("🧠 Initializing Architecture Decision Engine");

        let decision_matrix = Self::build_decision_matrix().await?;
        let risk_weights = Self::build_risk_weights();
        let migration_templates = Self::load_migration_templates().await?;

        info!("✅ Decision engine initialized with {} migration templates", 
              migration_templates.len());

        Ok(Self {
            config: config.clone(),
            decision_matrix,
            risk_weights,
            migration_templates,
        })
    }

    pub async fn make_decision(&self, request: ArchitectureDecisionRequest) -> Result<ArchitectureDecision> {
        info!("🤔 Analyzing {} migration recommendations", request.migration_recommendations.len());

        let decision_id = Uuid::new_v4().to_string();
        
        let mut approved_migrations = Vec::new();
        let mut rejected_migrations = Vec::new();

        // Evaluate each migration recommendation
        for recommendation in request.migration_recommendations {
            let evaluation = self.evaluate_migration(&recommendation, &request.system_constraints, &request.priority_factors).await?;
            
            debug!("Migration evaluation: {} -> {} = {}", 
                   recommendation.from_technology, 
                   recommendation.to_technology, 
                   evaluation.approval_score);

            if evaluation.should_approve {
                approved_migrations.push(ApprovedMigration {
                    migration: recommendation.clone(),
                    approval_score: evaluation.approval_score,
                    execution_priority: evaluation.priority,
                    prerequisites: evaluation.prerequisites,
                    success_criteria: evaluation.success_criteria,
                    rollback_plan: evaluation.rollback_plan,
                });
            } else {
                rejected_migrations.push(RejectedMigration {
                    migration: recommendation.clone(),
                    rejection_reasons: evaluation.rejection_reasons,
                    rejection_score: 1.0 - evaluation.approval_score,
                    reconsider_conditions: evaluation.reconsider_conditions,
                });
            }
        }

        // Sort approved migrations by priority
        approved_migrations.sort_by_key(|m| m.execution_priority);

        // Create execution plan
        let execution_plan = self.create_execution_plan(&approved_migrations, &request.system_constraints).await?;
        
        // Perform risk assessment
        let risk_assessment = self.assess_overall_risk(&approved_migrations, &execution_plan).await?;

        // Validate decision against risk thresholds
        if risk_assessment.overall_risk_score > self.config.risk.max_acceptable_risk_score {
            warn!("⚠️ Overall risk score ({:.2}) exceeds maximum acceptable risk ({:.2})", 
                  risk_assessment.overall_risk_score, 
                  self.config.risk.max_acceptable_risk_score);
            
            // Move high-risk migrations to rejected list
            let (safe_migrations, risky_migrations) = self.filter_by_risk(approved_migrations, &risk_assessment)?;
            approved_migrations = safe_migrations;
            
            for migration in risky_migrations {
                rejected_migrations.push(RejectedMigration {
                    migration: migration.migration,
                    rejection_reasons: vec!["Exceeds acceptable risk threshold".to_string()],
                    rejection_score: risk_assessment.overall_risk_score,
                    reconsider_conditions: vec!["Lower system load".to_string(), "Additional safeguards".to_string()],
                });
            }
        }

        let decision = ArchitectureDecision {
            decision_id,
            approved_migrations,
            rejected_migrations,
            execution_plan,
            risk_assessment,
            created_at: chrono::Utc::now(),
        };

        info!("✅ Architecture decision completed: {} approved, {} rejected, risk score: {:.2}", 
              decision.approved_migrations.len(), 
              decision.rejected_migrations.len(),
              decision.risk_assessment.overall_risk_score);

        Ok(decision)
    }

    async fn evaluate_migration(
        &self,
        recommendation: &MigrationRecommendation,
        constraints: &SystemConstraints,
        priorities: &PriorityFactors,
    ) -> Result<MigrationEvaluation> {
        debug!("🔍 Evaluating migration: {} -> {}", 
               recommendation.from_technology, 
               recommendation.to_technology);

        // Get compatibility score
        let compatibility_score = self.get_compatibility_score(&recommendation.from_technology, &recommendation.to_technology);
        
        // Calculate complexity factor
        let complexity_factor = self.get_complexity_factor(&recommendation.from_technology, &recommendation.to_technology);
        
        // Get historical success rate
        let historical_success = self.get_historical_success_rate(&recommendation.from_technology, &recommendation.to_technology);
        
        // Calculate priority-weighted score
        let priority_score = self.calculate_priority_score(recommendation, priorities);
        
        // Check resource constraints
        let resource_feasible = self.check_resource_constraints(recommendation, constraints);
        
        // Calculate final approval score
        let base_score = (recommendation.confidence_score * 0.3) + 
                        (compatibility_score * 0.2) + 
                        (historical_success * 0.2) + 
                        (priority_score * 0.2) + 
                        ((1.0 - complexity_factor.learning_curve) * 0.1);

        let approval_score = if resource_feasible { base_score } else { base_score * 0.5 };
        
        // Determine if should approve
        let should_approve = approval_score >= self.config.ai.decision_threshold && resource_feasible;
        
        // Generate prerequisites and success criteria
        let prerequisites = self.generate_prerequisites(recommendation);
        let success_criteria = self.generate_success_criteria(recommendation);
        let rollback_plan = self.generate_rollback_plan(recommendation);
        
        // Determine priority (lower number = higher priority)
        let priority = if approval_score > 0.9 { 1 }
                      else if approval_score > 0.8 { 2 }
                      else if approval_score > 0.7 { 3 }
                      else { 4 };

        let rejection_reasons = if !should_approve {
            let mut reasons = Vec::new();
            if approval_score < self.config.ai.decision_threshold {
                reasons.push(format!("Approval score ({:.2}) below threshold ({:.2})", 
                                   approval_score, self.config.ai.decision_threshold));
            }
            if !resource_feasible {
                reasons.push("Insufficient resources available".to_string());
            }
            if complexity_factor.learning_curve > 0.8 {
                reasons.push("High learning curve risk".to_string());
            }
            reasons
        } else {
            Vec::new()
        };

        let reconsider_conditions = if !should_approve {
            vec![
                "Increased resource allocation".to_string(),
                "Additional team training".to_string(),
                "Lower system complexity".to_string(),
            ]
        } else {
            Vec::new()
        };

        Ok(MigrationEvaluation {
            should_approve,
            approval_score,
            priority,
            prerequisites,
            success_criteria,
            rollback_plan,
            rejection_reasons,
            reconsider_conditions,
        })
    }

    fn get_compatibility_score(&self, from_tech: &str, to_tech: &str) -> f64 {
        self.decision_matrix.compatibility_scores
            .get(from_tech)
            .and_then(|scores| scores.get(to_tech))
            .copied()
            .unwrap_or(0.5) // Default neutral score
    }

    fn get_complexity_factor(&self, from_tech: &str, to_tech: &str) -> ComplexityFactor {
        let key = format!("{}->{}", from_tech, to_tech);
        self.decision_matrix.complexity_factors
            .get(&key)
            .cloned()
            .unwrap_or(ComplexityFactor {
                language_barrier: 0.5,
                ecosystem_maturity: 0.7,
                tooling_support: 0.5,
                community_support: 0.6,
                learning_curve: 0.6,
            })
    }

    fn get_historical_success_rate(&self, from_tech: &str, to_tech: &str) -> f64 {
        let key = format!("{}->{}", from_tech, to_tech);
        self.decision_matrix.historical_success_rates
            .get(&key)
            .copied()
            .unwrap_or(0.6) // Default moderate success rate
    }

    fn calculate_priority_score(&self, recommendation: &MigrationRecommendation, priorities: &PriorityFactors) -> f64 {
        // This is a simplified priority calculation
        // In a real system, you'd analyze the benefits/risks more thoroughly
        let performance_benefit = if recommendation.benefits.iter().any(|b| b.to_lowercase().contains("performance")) {
            1.0
        } else {
            0.5
        };
        
        let security_benefit = if recommendation.benefits.iter().any(|b| b.to_lowercase().contains("security")) {
            1.0
        } else {
            0.5
        };
        
        let maintenance_benefit = if recommendation.benefits.iter().any(|b| b.to_lowercase().contains("maintenance")) {
            1.0
        } else {
            0.5
        };

        priorities.performance_weight * performance_benefit +
        priorities.security_weight * security_benefit +
        priorities.maintenance_weight * maintenance_benefit +
        priorities.innovation_weight * 0.7 + // Assume moderate innovation benefit
        priorities.cost_weight * 0.6 // Assume moderate cost benefit
    }

    fn check_resource_constraints(&self, recommendation: &MigrationRecommendation, constraints: &SystemConstraints) -> bool {
        // Check if we have enough effort days available
        if recommendation.estimated_effort_days > constraints.available_effort_days {
            return false;
        }
        
        // Check if any critical services are affected
        let affects_critical_service = recommendation.affected_services.iter()
            .any(|service| constraints.critical_services.contains(service));
        
        if affects_critical_service && recommendation.dependency_impact.breaking_changes {
            return false;
        }
        
        true
    }

    async fn build_decision_matrix() -> Result<DecisionMatrix> {
        // This would normally be loaded from a database or configuration file
        let mut compatibility_scores = HashMap::new();
        
        // Swift compatibility scores
        let mut swift_scores = HashMap::new();
        swift_scores.insert("React Native".to_string(), 0.6);
        swift_scores.insert("Flutter".to_string(), 0.5);
        swift_scores.insert("Kotlin Multiplatform".to_string(), 0.4);
        compatibility_scores.insert("Swift".to_string(), swift_scores);
        
        // TypeScript compatibility scores
        let mut ts_scores = HashMap::new();
        ts_scores.insert("Rust".to_string(), 0.7);
        ts_scores.insert("Go".to_string(), 0.8);
        ts_scores.insert("Python".to_string(), 0.6);
        compatibility_scores.insert("TypeScript".to_string(), ts_scores);

        // Build complexity factors
        let mut complexity_factors = HashMap::new();
        complexity_factors.insert("Swift->React Native".to_string(), ComplexityFactor {
            language_barrier: 0.7,
            ecosystem_maturity: 0.8,
            tooling_support: 0.7,
            community_support: 0.9,
            learning_curve: 0.6,
        });
        
        complexity_factors.insert("TypeScript->Rust".to_string(), ComplexityFactor {
            language_barrier: 0.8,
            ecosystem_maturity: 0.9,
            tooling_support: 0.8,
            community_support: 0.8,
            learning_curve: 0.9,
        });

        complexity_factors.insert("TypeScript->Go".to_string(), ComplexityFactor {
            language_barrier: 0.6,
            ecosystem_maturity: 0.9,
            tooling_support: 0.9,
            community_support: 0.9,
            learning_curve: 0.5,
        });

        // Historical success rates (would be gathered from actual migration data)
        let mut historical_success_rates = HashMap::new();
        historical_success_rates.insert("Swift->React Native".to_string(), 0.72);
        historical_success_rates.insert("TypeScript->Rust".to_string(), 0.65);
        historical_success_rates.insert("TypeScript->Go".to_string(), 0.78);

        Ok(DecisionMatrix {
            compatibility_scores,
            complexity_factors,
            historical_success_rates,
        })
    }

    fn build_risk_weights() -> RiskWeights {
        RiskWeights {
            performance_risk: 0.25,
            security_risk: 0.30,
            maintenance_risk: 0.20,
            business_continuity_risk: 0.15,
            technical_debt_risk: 0.10,
        }
    }

    async fn load_migration_templates() -> Result<HashMap<String, MigrationTemplate>> {
        // This would normally load from template files
        // For now, return an empty map
        Ok(HashMap::new())
    }

    pub async fn get_decision_status(&self, decision_id: &str) -> Result<serde_json::Value> {
        // This would query the database for the decision status
        // For now, return a mock status
        Ok(serde_json::json!({
            "decision_id": decision_id,
            "status": "pending_execution",
            "created_at": chrono::Utc::now(),
            "progress": {
                "phase": "planning",
                "completion_percentage": 0
            }
        }))
    }

    pub async fn get_current_system_constraints(&self) -> Result<SystemConstraints> {
        // This would analyze the current system state
        // For now, return default constraints
        Ok(SystemConstraints {
            available_effort_days: 30,
            max_concurrent_migrations: self.config.migration.max_concurrent_migrations,
            critical_services: vec![
                "go-api-gateway".to_string(),
                "rust-llm-router".to_string(),
                "swift-macos-app".to_string(),
            ],
            deployment_windows: Vec::new(),
            resource_limits: crate::ResourceLimits {
                max_memory_gb: 32,
                max_cpu_cores: 16,
                max_storage_gb: 1000,
                network_bandwidth_mbps: 1000,
            },
        })
    }

    async fn create_execution_plan(&self, migrations: &[ApprovedMigration], constraints: &SystemConstraints) -> Result<ExecutionPlan> {
        // This would create a detailed execution plan
        // For now, return a simplified plan
        Ok(ExecutionPlan {
            phases: Vec::new(),
            estimated_duration_days: migrations.iter().map(|m| m.migration.estimated_effort_days).sum(),
            resource_requirements: crate::ResourceLimits {
                max_memory_gb: 16,
                max_cpu_cores: 8,
                max_storage_gb: 500,
                network_bandwidth_mbps: 500,
            },
            monitoring_checkpoints: Vec::new(),
        })
    }

    async fn assess_overall_risk(&self, migrations: &[ApprovedMigration], plan: &ExecutionPlan) -> Result<RiskAssessment> {
        // Calculate overall risk score based on individual migration risks
        let overall_risk_score = migrations.iter()
            .map(|m| self.calculate_migration_risk(&m.migration))
            .fold(0.0, |acc, risk| acc + risk) / migrations.len() as f64;

        Ok(RiskAssessment {
            overall_risk_score,
            risk_factors: vec![
                RiskFactor {
                    factor_type: "Migration Complexity".to_string(),
                    severity: "Medium".to_string(),
                    probability: 0.3,
                    impact: "Service disruption".to_string(),
                    mitigation: "Staged rollout with monitoring".to_string(),
                }
            ],
            mitigation_strategies: vec![
                "Implement blue-green deployment".to_string(),
                "Maintain rollback capabilities".to_string(),
                "Continuous monitoring during migration".to_string(),
            ],
            contingency_plans: vec![
                "Immediate rollback on critical failure".to_string(),
                "Manual intervention for edge cases".to_string(),
            ],
        })
    }

    fn calculate_migration_risk(&self, migration: &MigrationRecommendation) -> f64 {
        // Simple risk calculation based on confidence and breaking changes
        let base_risk = 1.0 - migration.confidence_score;
        let breaking_changes_penalty = if migration.dependency_impact.breaking_changes { 0.3 } else { 0.0 };
        (base_risk + breaking_changes_penalty).min(1.0)
    }

    fn filter_by_risk(&self, migrations: Vec<ApprovedMigration>, risk_assessment: &RiskAssessment) -> Result<(Vec<ApprovedMigration>, Vec<ApprovedMigration>)> {
        // This would filter migrations based on risk thresholds
        // For now, keep all migrations
        Ok((migrations, Vec::new()))
    }

    fn generate_prerequisites(&self, recommendation: &MigrationRecommendation) -> Vec<String> {
        vec![
            format!("Backup current {} implementation", recommendation.from_technology),
            "Set up monitoring for migration process".to_string(),
            "Prepare rollback procedures".to_string(),
        ]
    }

    fn generate_success_criteria(&self, recommendation: &MigrationRecommendation) -> Vec<String> {
        vec![
            "All existing functionality preserved".to_string(),
            "Performance metrics within acceptable range".to_string(),
            "No critical errors in production".to_string(),
        ]
    }

    fn generate_rollback_plan(&self, recommendation: &MigrationRecommendation) -> RollbackPlan {
        RollbackPlan {
            rollback_triggers: vec![
                "Critical failure rate > 5%".to_string(),
                "Performance degradation > 20%".to_string(),
                "Manual intervention required".to_string(),
            ],
            rollback_steps: vec![
                ExecutionTask {
                    task_id: Uuid::new_v4().to_string(),
                    name: "Stop new service".to_string(),
                    task_type: TaskType::Deployment,
                    parameters: HashMap::new(),
                    estimated_duration_minutes: 5,
                    automation_level: AutomationLevel::FullyAutomated,
                },
                ExecutionTask {
                    task_id: Uuid::new_v4().to_string(),
                    name: "Restore previous version".to_string(),
                    task_type: TaskType::Deployment,
                    parameters: HashMap::new(),
                    estimated_duration_minutes: 10,
                    automation_level: AutomationLevel::FullyAutomated,
                },
            ],
            rollback_duration_minutes: 15,
            data_recovery_required: false,
        }
    }
}

#[derive(Debug)]
struct MigrationEvaluation {
    should_approve: bool,
    approval_score: f64,
    priority: u32,
    prerequisites: Vec<String>,
    success_criteria: Vec<String>,
    rollback_plan: RollbackPlan,
    rejection_reasons: Vec<String>,
    reconsider_conditions: Vec<String>,
}