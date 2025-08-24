use anyhow::Result;
use prometheus::{Counter, Histogram, Gauge, Registry, Encoder, TextEncoder};
use std::collections::HashMap;
use tracing::{debug, error};

pub struct ChaosMetrics {
    registry: Registry,
    
    // Experiment metrics
    pub experiments_total: Counter,
    pub experiments_success: Counter,
    pub experiments_failed: Counter,
    pub experiment_duration: Histogram,
    
    // Safety metrics
    pub safety_rejections: Counter,
    pub auto_aborts: Counter,
    pub blast_radius_current: Gauge,
    
    // System metrics
    pub system_cpu_usage: Gauge,
    pub system_memory_usage: Gauge,
    pub system_disk_usage: Gauge,
    pub active_experiments: Gauge,
    
    // Scenario metrics
    scenario_counters: HashMap<String, Counter>,
}

impl ChaosMetrics {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();

        // Initialize experiment metrics
        let experiments_total = Counter::new(
            "chaos_experiments_total",
            "Total number of chaos experiments"
        )?;
        registry.register(Box::new(experiments_total.clone()))?;

        let experiments_success = Counter::new(
            "chaos_experiments_success_total",
            "Number of successful chaos experiments"
        )?;
        registry.register(Box::new(experiments_success.clone()))?;

        let experiments_failed = Counter::new(
            "chaos_experiments_failed_total",
            "Number of failed chaos experiments"
        )?;
        registry.register(Box::new(experiments_failed.clone()))?;

        let experiment_duration = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "chaos_experiment_duration_seconds",
                "Duration of chaos experiments in seconds"
            ).buckets(vec![1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0])
        )?;
        registry.register(Box::new(experiment_duration.clone()))?;

        // Initialize safety metrics
        let safety_rejections = Counter::new(
            "chaos_safety_rejections_total",
            "Number of experiments rejected by safety guard"
        )?;
        registry.register(Box::new(safety_rejections.clone()))?;

        let auto_aborts = Counter::new(
            "chaos_auto_aborts_total",
            "Number of experiments auto-aborted for safety"
        )?;
        registry.register(Box::new(auto_aborts.clone()))?;

        let blast_radius_current = Gauge::new(
            "chaos_blast_radius_current",
            "Current total blast radius of active experiments"
        )?;
        registry.register(Box::new(blast_radius_current.clone()))?;

        // Initialize system metrics
        let system_cpu_usage = Gauge::new(
            "chaos_system_cpu_usage_percent",
            "Current system CPU usage percentage"
        )?;
        registry.register(Box::new(system_cpu_usage.clone()))?;

        let system_memory_usage = Gauge::new(
            "chaos_system_memory_usage_percent",
            "Current system memory usage percentage"
        )?;
        registry.register(Box::new(system_memory_usage.clone()))?;

        let system_disk_usage = Gauge::new(
            "chaos_system_disk_usage_percent",
            "Current system disk usage percentage"
        )?;
        registry.register(Box::new(system_disk_usage.clone()))?;

        let active_experiments = Gauge::new(
            "chaos_active_experiments",
            "Number of currently active chaos experiments"
        )?;
        registry.register(Box::new(active_experiments.clone()))?;

        debug!("Chaos metrics initialized with {} metrics", registry.gather().len());

        Ok(ChaosMetrics {
            registry,
            experiments_total,
            experiments_success,
            experiments_failed,
            experiment_duration,
            safety_rejections,
            auto_aborts,
            blast_radius_current,
            system_cpu_usage,
            system_memory_usage,
            system_disk_usage,
            active_experiments,
            scenario_counters: HashMap::new(),
        })
    }

    pub fn record_experiment_start(&self, scenario: &str) {
        self.experiments_total.inc();
        
        // Increment scenario-specific counter
        if let Some(counter) = self.scenario_counters.get(scenario) {
            counter.inc();
        } else {
            // Create new scenario counter if it doesn't exist
            debug!("Creating new counter for scenario: {}", scenario);
        }
        
        debug!("Recorded experiment start for scenario: {}", scenario);
    }

    pub fn record_experiment_completion(&self, scenario: &str, success: bool) {
        if success {
            self.experiments_success.inc();
            debug!("Recorded successful experiment: {}", scenario);
        } else {
            self.experiments_failed.inc();
            debug!("Recorded failed experiment: {}", scenario);
        }
    }

    pub fn record_experiment_duration(&self, duration_seconds: f64) {
        self.experiment_duration.observe(duration_seconds);
        debug!("Recorded experiment duration: {:.2}s", duration_seconds);
    }

    pub fn record_safety_rejection(&self, reason: &str) {
        self.safety_rejections.inc();
        debug!("Recorded safety rejection: {}", reason);
    }

    pub fn record_auto_abort(&self, reason: &str) {
        self.auto_aborts.inc();
        debug!("Recorded auto-abort: {}", reason);
    }

    pub fn update_blast_radius(&self, total_blast_radius: f64) {
        self.blast_radius_current.set(total_blast_radius);
    }

    pub fn update_active_experiments_count(&self, count: usize) {
        self.active_experiments.set(count as f64);
    }

    pub async fn update_system_metrics(&self) -> Result<()> {
        // This would typically collect real system metrics
        // For now, we'll use placeholder values that would be replaced
        // with actual system monitoring data

        let cpu_usage = self.get_current_cpu_usage().await?;
        let memory_usage = self.get_current_memory_usage().await?;
        let disk_usage = self.get_current_disk_usage().await?;

        self.system_cpu_usage.set(cpu_usage);
        self.system_memory_usage.set(memory_usage);
        self.system_disk_usage.set(disk_usage);

        debug!("Updated system metrics: CPU={:.1}%, Memory={:.1}%, Disk={:.1}%", 
               cpu_usage, memory_usage, disk_usage);

        Ok(())
    }

    async fn get_current_cpu_usage(&self) -> Result<f64> {
        // In a real implementation, this would use system monitoring
        // For now, return a simulated value
        Ok(25.0)
    }

    async fn get_current_memory_usage(&self) -> Result<f64> {
        // In a real implementation, this would use system monitoring
        Ok(45.0)
    }

    async fn get_current_disk_usage(&self) -> Result<f64> {
        // In a real implementation, this would use system monitoring
        Ok(60.0)
    }

    pub fn export_prometheus(&self) -> Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer)?;
        
        let output = String::from_utf8(buffer)?;
        debug!("Exported {} metric families", metric_families.len());
        
        Ok(output)
    }

    pub fn get_experiment_stats(&self) -> ExperimentStats {
        ExperimentStats {
            total_experiments: self.experiments_total.get(),
            successful_experiments: self.experiments_success.get(),
            failed_experiments: self.experiments_failed.get(),
            safety_rejections: self.safety_rejections.get(),
            auto_aborts: self.auto_aborts.get(),
            active_experiments: self.active_experiments.get() as usize,
            current_blast_radius: self.blast_radius_current.get(),
        }
    }

    pub fn create_scenario_counter(&mut self, scenario: &str) -> Result<()> {
        if self.scenario_counters.contains_key(scenario) {
            return Ok(()); // Already exists
        }

        let counter = Counter::new(
            format!("chaos_scenario_{}_total", scenario.replace("-", "_")),
            format!("Total experiments for scenario: {}", scenario)
        )?;
        
        self.registry.register(Box::new(counter.clone()))?;
        self.scenario_counters.insert(scenario.to_string(), counter);
        
        debug!("Created counter for scenario: {}", scenario);
        Ok(())
    }
}

#[derive(Debug)]
pub struct ExperimentStats {
    pub total_experiments: f64,
    pub successful_experiments: f64,
    pub failed_experiments: f64,
    pub safety_rejections: f64,
    pub auto_aborts: f64,
    pub active_experiments: usize,
    pub current_blast_radius: f64,
}