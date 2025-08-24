use crate::config::Config;
use crate::github_monitor::GitHubMonitor;
use crate::dependency_analyzer::DependencyAnalyzer;
use crate::technology_evaluator::{TechnologyEvaluator, TechnologyAlert};
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{info, error, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanStatus {
    pub last_scan: Option<DateTime<Utc>>,
    pub next_scan: Option<DateTime<Utc>>,
    pub scan_count: u64,
    pub active_alerts: u32,
    pub scanning: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResults {
    pub timestamp: DateTime<Utc>,
    pub technology_updates: Vec<TechnologyUpdate>,
    pub dependency_vulnerabilities: Vec<DependencyVulnerability>,
    pub new_libraries: Vec<NewLibrary>,
    pub migration_recommendations: Vec<MigrationRecommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnologyUpdate {
    pub technology: String,
    pub current_version: String,
    pub latest_version: String,
    pub severity: UpdateSeverity,
    pub changelog_url: Option<String>,
    pub breaking_changes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyVulnerability {
    pub dependency: String,
    pub current_version: String,
    pub vulnerable_versions: Vec<String>,
    pub fixed_version: String,
    pub severity: VulnerabilitySeverity,
    pub cve_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewLibrary {
    pub name: String,
    pub language: String,
    pub description: String,
    pub github_url: String,
    pub stars: u32,
    pub weekly_downloads: Option<u64>,
    pub relevance_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationRecommendation {
    pub from_technology: String,
    pub to_technology: String,
    pub confidence_score: f64,
    pub benefits: Vec<String>,
    pub risks: Vec<String>,
    pub estimated_effort_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UpdateSeverity {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VulnerabilitySeverity {
    Critical,
    High,
    Medium,
    Low,
}

pub struct TechScanner {
    config: Config,
    github_monitor: GitHubMonitor,
    dependency_analyzer: DependencyAnalyzer,
    technology_evaluator: TechnologyEvaluator,
    status: Arc<RwLock<ScanStatus>>,
    latest_results: Arc<RwLock<Option<ScanResults>>>,
    scheduler: JobScheduler,
}

impl TechScanner {
    pub async fn new(config: Config) -> Result<Self> {
        let github_monitor = GitHubMonitor::new(&config).await?;
        let dependency_analyzer = DependencyAnalyzer::new(&config).await?;
        let technology_evaluator = TechnologyEvaluator::new(&config).await?;
        
        let status = Arc::new(RwLock::new(ScanStatus {
            last_scan: None,
            next_scan: None,
            scan_count: 0,
            active_alerts: 0,
            scanning: false,
        }));

        let latest_results = Arc::new(RwLock::new(None));

        let scheduler = JobScheduler::new().await?;

        Ok(Self {
            config,
            github_monitor,
            dependency_analyzer,
            technology_evaluator,
            status,
            latest_results,
            scheduler,
        })
    }

    pub async fn start_scanning(&self) -> Result<()> {
        info!("🔍 Starting technology scanning daemon");

        // Schedule periodic scans
        let scan_interval = format!("0 0 */{} * * *", self.config.scanner.scan_interval_hours);
        
        let scanner_clone = self.clone_for_task().await;
        let job = Job::new_async(scan_interval.as_str(), move |_uuid, _lock| {
            let scanner = scanner_clone.clone();
            Box::pin(async move {
                if let Err(e) = scanner.perform_scan().await {
                    error!("Scheduled scan failed: {}", e);
                }
            })
        })?;

        self.scheduler.add(job).await?;
        self.scheduler.start().await?;

        // Perform initial scan
        self.perform_scan().await?;

        // Keep the service running
        tokio::signal::ctrl_c().await?;
        Ok(())
    }

    async fn clone_for_task(&self) -> Arc<Self> {
        // Create a lightweight clone for background tasks
        // This is a simplified approach - in production, you'd want better sharing
        Arc::new(Self {
            config: self.config.clone(),
            github_monitor: self.github_monitor.clone(),
            dependency_analyzer: self.dependency_analyzer.clone(),
            technology_evaluator: self.technology_evaluator.clone(),
            status: Arc::clone(&self.status),
            latest_results: Arc::clone(&self.latest_results),
            scheduler: JobScheduler::new().await.unwrap(),
        })
    }

    pub async fn perform_scan(&self) -> Result<()> {
        info!("🔍 Starting comprehensive technology scan");

        // Update status
        {
            let mut status = self.status.write().await;
            status.scanning = true;
            status.last_scan = Some(Utc::now());
        }

        let mut results = ScanResults {
            timestamp: Utc::now(),
            technology_updates: Vec::new(),
            dependency_vulnerabilities: Vec::new(),
            new_libraries: Vec::new(),
            migration_recommendations: Vec::new(),
        };

        // 1. Monitor GitHub for trending repositories and updates
        match self.github_monitor.scan_trending_technologies().await {
            Ok(libraries) => {
                results.new_libraries.extend(libraries);
                info!("✅ GitHub trending scan completed");
            }
            Err(e) => {
                error!("GitHub trending scan failed: {}", e);
            }
        }

        // 2. Analyze project dependencies
        match self.dependency_analyzer.scan_project_dependencies().await {
            Ok(vulnerabilities) => {
                results.dependency_vulnerabilities.extend(vulnerabilities);
                info!("✅ Dependency vulnerability scan completed");
            }
            Err(e) => {
                error!("Dependency scan failed: {}", e);
            }
        }

        // 3. Evaluate technology migration opportunities
        match self.technology_evaluator.evaluate_migrations(&results).await {
            Ok(recommendations) => {
                results.migration_recommendations.extend(recommendations);
                info!("✅ Migration evaluation completed");
            }
            Err(e) => {
                error!("Migration evaluation failed: {}", e);
            }
        }

        // 4. Generate and send alerts
        let alerts = self.generate_alerts(&results).await?;
        if !alerts.is_empty() {
            self.send_alerts(&alerts).await?;
            info!("📢 Sent {} technology alerts", alerts.len());
        }

        // Update results and status
        *self.latest_results.write().await = Some(results);
        
        {
            let mut status = self.status.write().await;
            status.scanning = false;
            status.scan_count += 1;
            status.active_alerts = alerts.len() as u32;
            status.next_scan = Some(Utc::now() + chrono::Duration::hours(self.config.scanner.scan_interval_hours as i64));
        }

        info!("🎉 Technology scan completed successfully");
        Ok(())
    }

    async fn generate_alerts(&self, results: &ScanResults) -> Result<Vec<TechnologyAlert>> {
        let mut alerts = Vec::new();

        // Critical vulnerabilities
        for vuln in &results.dependency_vulnerabilities {
            if matches!(vuln.severity, VulnerabilitySeverity::Critical | VulnerabilitySeverity::High) {
                alerts.push(TechnologyAlert::SecurityVulnerability {
                    dependency: vuln.dependency.clone(),
                    severity: format!("{:?}", vuln.severity),
                    fixed_version: vuln.fixed_version.clone(),
                    cve_id: vuln.cve_id.clone(),
                });
            }
        }

        // High-impact new libraries
        for library in &results.new_libraries {
            if library.relevance_score > 0.8 && library.stars > 5000 {
                alerts.push(TechnologyAlert::NewLibrary {
                    name: library.name.clone(),
                    language: library.language.clone(),
                    relevance_score: library.relevance_score,
                    github_url: library.github_url.clone(),
                });
            }
        }

        // Migration recommendations with high confidence
        for recommendation in &results.migration_recommendations {
            if recommendation.confidence_score > 0.75 {
                alerts.push(TechnologyAlert::MigrationRecommendation {
                    from_technology: recommendation.from_technology.clone(),
                    to_technology: recommendation.to_technology.clone(),
                    confidence_score: recommendation.confidence_score,
                    estimated_effort_days: recommendation.estimated_effort_days,
                });
            }
        }

        Ok(alerts)
    }

    async fn send_alerts(&self, alerts: &[TechnologyAlert]) -> Result<()> {
        // Send to auto-healing system
        let client = reqwest::Client::new();
        
        for alert in alerts {
            let payload = serde_json::json!({
                "type": "technology_alert",
                "alert": alert,
                "timestamp": Utc::now(),
                "source": "tech-scanner"
            });

            match client.post(&self.config.notifications.auto_healing_endpoint)
                .json(&payload)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    info!("✅ Alert sent to auto-healing system");
                }
                Ok(response) => {
                    warn!("Auto-healing system responded with status: {}", response.status());
                }
                Err(e) => {
                    error!("Failed to send alert to auto-healing system: {}", e);
                }
            }
        }

        Ok(())
    }

    pub async fn trigger_manual_scan(&self) -> Result<()> {
        info!("🔍 Manual scan triggered");
        self.perform_scan().await
    }

    pub async fn get_status(&self) -> Result<ScanStatus> {
        Ok(self.status.read().await.clone())
    }

    pub async fn get_latest_results(&self) -> Result<Option<ScanResults>> {
        Ok(self.latest_results.read().await.clone())
    }
}