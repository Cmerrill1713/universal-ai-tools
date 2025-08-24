use prometheus::{Counter, Gauge, Histogram, Registry, TextEncoder, Encoder};
use std::sync::Arc;
use anyhow::Result;

pub struct ArchitectureMetrics {
    registry: Registry,
    pub decisions_total: Counter,
    pub decision_duration_seconds: Histogram,
    pub approved_migrations: Counter,
    pub rejected_migrations: Counter,
    pub active_migrations: Gauge,
    pub migration_success_rate: Gauge,
    pub risk_assessments_total: Counter,
    pub rollbacks_total: Counter,
    pub code_generation_requests: Counter,
    pub code_generation_duration_seconds: Histogram,
}

impl ArchitectureMetrics {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();

        let decisions_total = Counter::new(
            "architecture_decisions_total",
            "Total number of architecture decisions made"
        )?;
        registry.register(Box::new(decisions_total.clone()))?;

        let decision_duration_seconds = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "architecture_decision_duration_seconds",
                "Duration of architecture decision making process"
            ).buckets(vec![1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0])
        )?;
        registry.register(Box::new(decision_duration_seconds.clone()))?;

        let approved_migrations = Counter::new(
            "architecture_approved_migrations_total",
            "Total number of approved migrations"
        )?;
        registry.register(Box::new(approved_migrations.clone()))?;

        let rejected_migrations = Counter::new(
            "architecture_rejected_migrations_total",
            "Total number of rejected migrations"
        )?;
        registry.register(Box::new(rejected_migrations.clone()))?;

        let active_migrations = Gauge::new(
            "architecture_active_migrations",
            "Number of currently active migrations"
        )?;
        registry.register(Box::new(active_migrations.clone()))?;

        let migration_success_rate = Gauge::new(
            "architecture_migration_success_rate",
            "Success rate of completed migrations"
        )?;
        registry.register(Box::new(migration_success_rate.clone()))?;

        let risk_assessments_total = Counter::new(
            "architecture_risk_assessments_total",
            "Total number of risk assessments performed"
        )?;
        registry.register(Box::new(risk_assessments_total.clone()))?;

        let rollbacks_total = Counter::new(
            "architecture_rollbacks_total",
            "Total number of migration rollbacks"
        )?;
        registry.register(Box::new(rollbacks_total.clone()))?;

        let code_generation_requests = Counter::new(
            "architecture_code_generation_requests_total",
            "Total number of code generation requests"
        )?;
        registry.register(Box::new(code_generation_requests.clone()))?;

        let code_generation_duration_seconds = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "architecture_code_generation_duration_seconds",
                "Duration of code generation process"
            ).buckets(vec![0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0])
        )?;
        registry.register(Box::new(code_generation_duration_seconds.clone()))?;

        Ok(Self {
            registry,
            decisions_total,
            decision_duration_seconds,
            approved_migrations,
            rejected_migrations,
            active_migrations,
            migration_success_rate,
            risk_assessments_total,
            rollbacks_total,
            code_generation_requests,
            code_generation_duration_seconds,
        })
    }

    pub fn export_metrics(&self) -> Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }

    pub fn update_migration_success_rate(&self, success_count: f64, total_count: f64) {
        if total_count > 0.0 {
            self.migration_success_rate.set(success_count / total_count);
        }
    }
}