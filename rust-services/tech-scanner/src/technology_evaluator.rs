use crate::config::Config;
use crate::scanner::{ScanResults, MigrationRecommendation, NewLibrary};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TechnologyAlert {
    SecurityVulnerability {
        dependency: String,
        severity: String,
        fixed_version: String,
        cve_id: Option<String>,
    },
    NewLibrary {
        name: String,
        language: String,
        relevance_score: f64,
        github_url: String,
    },
    MigrationRecommendation {
        from_technology: String,
        to_technology: String,
        confidence_score: f64,
        estimated_effort_days: u32,
    },
    TechnologyUpdate {
        technology: String,
        current_version: String,
        latest_version: String,
        breaking_changes: bool,
    },
}

#[derive(Debug, Clone)]
pub struct TechnologyEvaluator {
    config: Config,
    migration_rules: HashMap<String, Vec<MigrationRule>>,
}

#[derive(Debug, Clone)]
struct MigrationRule {
    to_technology: String,
    triggers: Vec<MigrationTrigger>,
    benefits: Vec<String>,
    risks: Vec<String>,
    estimated_effort_days: u32,
    confidence_multiplier: f64,
}

#[derive(Debug, Clone)]
enum MigrationTrigger {
    SecurityVulnerabilities(u32), // Count threshold
    PerformanceBenefit(f64),      // Performance improvement percentage
    CommunityMomentum(u32),       // GitHub stars threshold
    MaintenanceBurden(f64),       // Maintenance cost score
    NewFeatures(Vec<String>),     // Required feature list
}

impl TechnologyEvaluator {
    pub async fn new(config: &Config) -> Result<Self> {
        let migration_rules = Self::build_migration_rules();

        Ok(Self {
            config: config.clone(),
            migration_rules,
        })
    }

    pub async fn evaluate_migrations(&self, results: &ScanResults) -> Result<Vec<MigrationRecommendation>> {
        info!("🤔 Evaluating technology migration opportunities");

        let mut recommendations = Vec::new();

        // Analyze current technology stack
        let current_stack = self.analyze_current_stack().await?;

        // Evaluate each technology for potential migrations
        for (current_tech, usage_info) in current_stack {
            if let Some(rules) = self.migration_rules.get(&current_tech) {
                for rule in rules {
                    let confidence = self.calculate_migration_confidence(
                        &current_tech,
                        &rule,
                        results,
                        &usage_info,
                    ).await?;

                    if confidence > 0.5 {
                        recommendations.push(MigrationRecommendation {
                            from_technology: current_tech.clone(),
                            to_technology: rule.to_technology.clone(),
                            confidence_score: confidence,
                            benefits: rule.benefits.clone(),
                            risks: rule.risks.clone(),
                            estimated_effort_days: rule.estimated_effort_days,
                        });
                    }
                }
            }
        }

        // Sort by confidence score
        recommendations.sort_by(|a, b| b.confidence_score.partial_cmp(&a.confidence_score).unwrap());

        info!("✅ Generated {} migration recommendations", recommendations.len());
        Ok(recommendations)
    }

    async fn analyze_current_stack(&self) -> Result<HashMap<String, TechnologyUsage>> {
        let mut stack = HashMap::new();

        // Analyze Rust usage
        if let Ok(rust_info) = self.analyze_rust_usage().await {
            stack.insert("Rust".to_string(), rust_info);
        }

        // Analyze Swift usage
        if let Ok(swift_info) = self.analyze_swift_usage().await {
            stack.insert("Swift".to_string(), swift_info);
        }

        // Analyze Go usage
        if let Ok(go_info) = self.analyze_go_usage().await {
            stack.insert("Go".to_string(), go_info);
        }

        // Analyze TypeScript usage
        if let Ok(ts_info) = self.analyze_typescript_usage().await {
            stack.insert("TypeScript".to_string(), ts_info);
        }

        Ok(stack)
    }

    async fn analyze_rust_usage(&self) -> Result<TechnologyUsage> {
        let project_root = std::env::var("PROJECT_ROOT")
            .unwrap_or_else(|_| "/Users/christianmerrill/Desktop/universal-ai-tools".to_string());

        let rust_services_path = format!("{}/rust-services", project_root);
        
        let mut service_count = 0;
        let mut total_loc = 0;
        
        if let Ok(mut entries) = tokio::fs::read_dir(&rust_services_path).await {
            while let Some(entry) = entries.next_entry().await? {
                if entry.path().is_dir() {
                    service_count += 1;
                    // Count lines of code (simplified)
                    if let Ok(loc) = self.count_rust_loc(&entry.path().to_string_lossy()).await {
                        total_loc += loc;
                    }
                }
            }
        }

        Ok(TechnologyUsage {
            service_count,
            lines_of_code: total_loc,
            last_updated: chrono::Utc::now(),
            performance_issues: 0, // Would be calculated from metrics
            security_issues: 0,    // From vulnerability scan
            maintenance_burden: 0.2, // Rust is generally low maintenance
        })
    }

    async fn analyze_swift_usage(&self) -> Result<TechnologyUsage> {
        let project_root = std::env::var("PROJECT_ROOT")
            .unwrap_or_else(|_| "/Users/christianmerrill/Desktop/universal-ai-tools".to_string());

        let swift_app_path = format!("{}/macOS-App", project_root);
        
        let mut lines_of_code = 0;
        if let Ok(loc) = self.count_swift_loc(&swift_app_path).await {
            lines_of_code = loc;
        }

        Ok(TechnologyUsage {
            service_count: 1, // One macOS app
            lines_of_code,
            last_updated: chrono::Utc::now(),
            performance_issues: 0,
            security_issues: 0,
            maintenance_burden: 0.4, // Swift UI changes frequently
        })
    }

    async fn analyze_go_usage(&self) -> Result<TechnologyUsage> {
        let project_root = std::env::var("PROJECT_ROOT")
            .unwrap_or_else(|_| "/Users/christianmerrill/Desktop/universal-ai-tools".to_string());

        let go_gateway_path = format!("{}/go-api-gateway", project_root);
        let go_services_path = format!("{}/rust-services/go-websocket", project_root);

        let mut lines_of_code = 0;
        if let Ok(loc) = self.count_go_loc(&go_gateway_path).await {
            lines_of_code += loc;
        }
        if let Ok(loc) = self.count_go_loc(&go_services_path).await {
            lines_of_code += loc;
        }

        Ok(TechnologyUsage {
            service_count: 2, // API Gateway + WebSocket service
            lines_of_code,
            last_updated: chrono::Utc::now(),
            performance_issues: 0,
            security_issues: 0,
            maintenance_burden: 0.3, // Go is fairly stable
        })
    }

    async fn analyze_typescript_usage(&self) -> Result<TechnologyUsage> {
        let project_root = std::env::var("PROJECT_ROOT")
            .unwrap_or_else(|_| "/Users/christianmerrill/Desktop/universal-ai-tools".to_string());

        let src_path = format!("{}/src", project_root);
        
        let mut lines_of_code = 0;
        if let Ok(loc) = self.count_typescript_loc(&src_path).await {
            lines_of_code = loc;
        }

        Ok(TechnologyUsage {
            service_count: 1, // Legacy server
            lines_of_code,
            last_updated: chrono::Utc::now(),
            performance_issues: 2, // Known performance issues
            security_issues: 1,    // Based on honest assessment
            maintenance_burden: 0.8, // High maintenance due to deprecation
        })
    }

    async fn calculate_migration_confidence(
        &self,
        from_tech: &str,
        rule: &MigrationRule,
        results: &ScanResults,
        usage: &TechnologyUsage,
    ) -> Result<f64> {
        let mut confidence = 0.0;

        // Base confidence from rule
        confidence += rule.confidence_multiplier * 0.3;

        // Factor in triggers
        for trigger in &rule.triggers {
            match trigger {
                MigrationTrigger::SecurityVulnerabilities(threshold) => {
                    let vuln_count = results.dependency_vulnerabilities
                        .iter()
                        .filter(|v| self.is_dependency_for_technology(&v.dependency, from_tech))
                        .count() as u32;
                    
                    if vuln_count >= *threshold {
                        confidence += 0.2;
                    }
                }
                MigrationTrigger::PerformanceBenefit(improvement) => {
                    if usage.performance_issues > 0 && *improvement > 0.2 {
                        confidence += 0.15;
                    }
                }
                MigrationTrigger::CommunityMomentum(stars_threshold) => {
                    let relevant_libs = results.new_libraries
                        .iter()
                        .filter(|lib| self.is_library_for_technology(lib, &rule.to_technology))
                        .count();
                    
                    if relevant_libs > 0 {
                        confidence += 0.1;
                    }
                }
                MigrationTrigger::MaintenanceBurden(threshold) => {
                    if usage.maintenance_burden > *threshold {
                        confidence += 0.2;
                    }
                }
                MigrationTrigger::NewFeatures(features) => {
                    // Check if new libraries provide required features
                    let feature_coverage = self.calculate_feature_coverage(results, features);
                    confidence += feature_coverage * 0.1;
                }
            }
        }

        // Reduce confidence based on migration effort
        let effort_penalty = (rule.estimated_effort_days as f64 / 30.0) * 0.1;
        confidence = (confidence - effort_penalty).max(0.0);

        // Reduce confidence for technologies with high usage
        let usage_penalty = (usage.lines_of_code as f64 / 10000.0) * 0.05;
        confidence = (confidence - usage_penalty).max(0.0);

        Ok(confidence.min(1.0))
    }

    fn is_dependency_for_technology(&self, dependency: &str, technology: &str) -> bool {
        match technology {
            "Rust" => dependency.contains("tokio") || dependency.contains("serde") || dependency.contains("axum"),
            "TypeScript" => dependency.contains("express") || dependency.contains("typescript") || dependency.contains("node"),
            "Swift" => dependency.contains("swift") || dependency.contains("swiftui"),
            "Go" => dependency.contains("gin") || dependency.contains("go"),
            _ => false,
        }
    }

    fn is_library_for_technology(&self, library: &NewLibrary, technology: &str) -> bool {
        let tech_lower = technology.to_lowercase();
        let lib_lang_lower = library.language.to_lowercase();
        let lib_name_lower = library.name.to_lowercase();
        
        lib_lang_lower.contains(&tech_lower) || 
        lib_name_lower.contains(&tech_lower) ||
        library.description.to_lowercase().contains(&tech_lower)
    }

    fn calculate_feature_coverage(&self, results: &ScanResults, required_features: &[String]) -> f64 {
        let mut covered_features = 0;
        
        for feature in required_features {
            let feature_lower = feature.to_lowercase();
            let found = results.new_libraries.iter().any(|lib| {
                lib.description.to_lowercase().contains(&feature_lower) ||
                lib.name.to_lowercase().contains(&feature_lower)
            });
            
            if found {
                covered_features += 1;
            }
        }

        covered_features as f64 / required_features.len() as f64
    }

    async fn count_rust_loc(&self, path: &str) -> Result<u32> {
        self.count_loc_by_extension(path, "rs").await
    }

    async fn count_swift_loc(&self, path: &str) -> Result<u32> {
        self.count_loc_by_extension(path, "swift").await
    }

    async fn count_go_loc(&self, path: &str) -> Result<u32> {
        self.count_loc_by_extension(path, "go").await
    }

    async fn count_typescript_loc(&self, path: &str) -> Result<u32> {
        let ts_count = self.count_loc_by_extension(path, "ts").await?;
        let js_count = self.count_loc_by_extension(path, "js").await?;
        Ok(ts_count + js_count)
    }

    async fn count_loc_by_extension(&self, path: &str, extension: &str) -> Result<u32> {
        let mut total_lines = 0;
        self.count_loc_recursive(path, extension, &mut total_lines).await?;
        Ok(total_lines)
    }

    #[async_recursion::async_recursion]
    async fn count_loc_recursive(&self, dir: &str, extension: &str, total: &mut u32) -> Result<()> {
        if let Ok(mut entries) = tokio::fs::read_dir(dir).await {
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                
                if path.is_dir() {
                    // Skip certain directories
                    if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                        if matches!(dir_name, "node_modules" | "target" | ".git" | "dist" | "build") {
                            continue;
                        }
                    }
                    
                    if let Some(path_str) = path.to_str() {
                        self.count_loc_recursive(path_str, extension, total).await?;
                    }
                } else if let Some(file_ext) = path.extension().and_then(|ext| ext.to_str()) {
                    if file_ext == extension {
                        if let Ok(content) = tokio::fs::read_to_string(&path).await {
                            *total += content.lines().count() as u32;
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn build_migration_rules() -> HashMap<String, Vec<MigrationRule>> {
        let mut rules = HashMap::new();

        // Swift migration rules
        rules.insert("Swift".to_string(), vec![
            MigrationRule {
                to_technology: "React Native".to_string(),
                triggers: vec![
                    MigrationTrigger::NewFeatures(vec![
                        "cross-platform".to_string(),
                        "web-compatibility".to_string(),
                    ]),
                    MigrationTrigger::MaintenanceBurden(0.6),
                ],
                benefits: vec![
                    "Cross-platform development".to_string(),
                    "Larger developer pool".to_string(),
                    "Web compatibility".to_string(),
                ],
                risks: vec![
                    "Performance overhead".to_string(),
                    "Platform-specific limitations".to_string(),
                ],
                estimated_effort_days: 45,
                confidence_multiplier: 0.6,
            },
            MigrationRule {
                to_technology: "Flutter".to_string(),
                triggers: vec![
                    MigrationTrigger::NewFeatures(vec![
                        "cross-platform".to_string(),
                        "desktop-support".to_string(),
                    ]),
                    MigrationTrigger::CommunityMomentum(20000),
                ],
                benefits: vec![
                    "Single codebase for all platforms".to_string(),
                    "High performance".to_string(),
                    "Growing ecosystem".to_string(),
                ],
                risks: vec![
                    "Different language (Dart)".to_string(),
                    "Less mature than Swift".to_string(),
                ],
                estimated_effort_days: 60,
                confidence_multiplier: 0.5,
            },
        ]);

        // TypeScript migration rules
        rules.insert("TypeScript".to_string(), vec![
            MigrationRule {
                to_technology: "Rust".to_string(),
                triggers: vec![
                    MigrationTrigger::PerformanceBenefit(0.5),
                    MigrationTrigger::SecurityVulnerabilities(3),
                    MigrationTrigger::MaintenanceBurden(0.7),
                ],
                benefits: vec![
                    "Memory safety".to_string(),
                    "High performance".to_string(),
                    "Better concurrency".to_string(),
                ],
                risks: vec![
                    "Learning curve".to_string(),
                    "Smaller ecosystem for web".to_string(),
                ],
                estimated_effort_days: 30,
                confidence_multiplier: 0.8,
            },
            MigrationRule {
                to_technology: "Go".to_string(),
                triggers: vec![
                    MigrationTrigger::MaintenanceBurden(0.6),
                    MigrationTrigger::PerformanceBenefit(0.3),
                ],
                benefits: vec![
                    "Better concurrency".to_string(),
                    "Faster compilation".to_string(),
                    "Lower memory usage".to_string(),
                ],
                risks: vec![
                    "Less flexible than TypeScript".to_string(),
                    "Different paradigms".to_string(),
                ],
                estimated_effort_days: 20,
                confidence_multiplier: 0.7,
            },
        ]);

        rules
    }
}

#[derive(Debug, Clone)]
struct TechnologyUsage {
    service_count: u32,
    lines_of_code: u32,
    last_updated: chrono::DateTime<chrono::Utc>,
    performance_issues: u32,
    security_issues: u32,
    maintenance_burden: f64, // 0.0 to 1.0
}