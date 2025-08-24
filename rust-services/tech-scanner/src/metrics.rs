use prometheus::{Counter, Gauge, Histogram, Registry, TextEncoder, Encoder};
use std::sync::Arc;
use anyhow::Result;

pub struct TechScannerMetrics {
    registry: Registry,
    pub scans_total: Counter,
    pub scan_duration_seconds: Histogram,
    pub vulnerabilities_found: Gauge,
    pub new_libraries_found: Gauge,
    pub migration_recommendations: Gauge,
    pub github_api_requests: Counter,
    pub dependency_files_scanned: Counter,
}

impl TechScannerMetrics {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();

        let scans_total = Counter::new(
            "tech_scanner_scans_total",
            "Total number of technology scans performed"
        )?;
        registry.register(Box::new(scans_total.clone()))?;

        let scan_duration_seconds = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "tech_scanner_scan_duration_seconds",
                "Duration of technology scans in seconds"
            ).buckets(vec![1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0])
        )?;
        registry.register(Box::new(scan_duration_seconds.clone()))?;

        let vulnerabilities_found = Gauge::new(
            "tech_scanner_vulnerabilities_found",
            "Number of dependency vulnerabilities found in last scan"
        )?;
        registry.register(Box::new(vulnerabilities_found.clone()))?;

        let new_libraries_found = Gauge::new(
            "tech_scanner_new_libraries_found",
            "Number of new relevant libraries found in last scan"
        )?;
        registry.register(Box::new(new_libraries_found.clone()))?;

        let migration_recommendations = Gauge::new(
            "tech_scanner_migration_recommendations",
            "Number of technology migration recommendations generated"
        )?;
        registry.register(Box::new(migration_recommendations.clone()))?;

        let github_api_requests = Counter::new(
            "tech_scanner_github_api_requests_total",
            "Total number of GitHub API requests made"
        )?;
        registry.register(Box::new(github_api_requests.clone()))?;

        let dependency_files_scanned = Counter::new(
            "tech_scanner_dependency_files_scanned_total",
            "Total number of dependency files scanned"
        )?;
        registry.register(Box::new(dependency_files_scanned.clone()))?;

        Ok(Self {
            registry,
            scans_total,
            scan_duration_seconds,
            vulnerabilities_found,
            new_libraries_found,
            migration_recommendations,
            github_api_requests,
            dependency_files_scanned,
        })
    }

    pub fn export_metrics(&self) -> Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }
}