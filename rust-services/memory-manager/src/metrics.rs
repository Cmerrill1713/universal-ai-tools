//! Metrics for Memory Management Service

use prometheus::{
    Counter, Gauge, Histogram, IntCounter, Opts, Registry,
};
use std::sync::Arc;

pub struct Metrics {
    pub registry: Registry,
    
    // Memory metrics
    pub memory_usage_total: Gauge,
    pub memory_usage_percentage: Gauge,
    pub system_memory_total: Gauge,
    pub memory_freed_mb: Histogram,
    
    // Optimization metrics
    pub optimizations_total: IntCounter,
    pub optimization_errors_total: IntCounter,
    pub optimization_duration_seconds: Histogram,
    
    // Health metrics
    pub health_checks_total: IntCounter,
    
    // Process metrics
    pub monitored_processes_total: Gauge,
}

impl Metrics {
    pub fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let registry = Registry::new();

        // Memory metrics
        let memory_usage_total = Gauge::with_opts(Opts::new(
            "memory_usage_total_mb",
            "Total memory usage in megabytes"
        ))?;
        
        let memory_usage_percentage = Gauge::with_opts(Opts::new(
            "memory_usage_percentage",
            "Memory usage as percentage of total"
        ))?;
        
        let system_memory_total = Gauge::with_opts(Opts::new(
            "system_memory_total_mb",
            "Total system memory in megabytes"
        ))?;
        
        let memory_freed_mb = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "memory_freed_mb",
                "Amount of memory freed by optimization in megabytes"
            ).buckets(vec![1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0])
        )?;

        // Optimization metrics
        let optimizations_total = IntCounter::with_opts(Opts::new(
            "optimizations_total",
            "Total number of memory optimizations performed"
        ))?;
        
        let optimization_errors_total = IntCounter::with_opts(Opts::new(
            "optimization_errors_total",
            "Total number of optimization errors"
        ))?;
        
        let optimization_duration_seconds = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "optimization_duration_seconds",
                "Duration of memory optimization operations"
            ).buckets(vec![0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0])
        )?;

        // Health metrics
        let health_checks_total = IntCounter::with_opts(Opts::new(
            "health_checks_total",
            "Total number of health checks performed"
        ))?;

        // Process metrics
        let monitored_processes_total = Gauge::with_opts(Opts::new(
            "monitored_processes_total",
            "Total number of processes being monitored"
        ))?;

        // Register all metrics
        registry.register(Box::new(memory_usage_total.clone()))?;
        registry.register(Box::new(memory_usage_percentage.clone()))?;
        registry.register(Box::new(system_memory_total.clone()))?;
        registry.register(Box::new(memory_freed_mb.clone()))?;
        registry.register(Box::new(optimizations_total.clone()))?;
        registry.register(Box::new(optimization_errors_total.clone()))?;
        registry.register(Box::new(optimization_duration_seconds.clone()))?;
        registry.register(Box::new(health_checks_total.clone()))?;
        registry.register(Box::new(monitored_processes_total.clone()))?;

        Ok(Self {
            registry,
            memory_usage_total,
            memory_usage_percentage,
            system_memory_total,
            memory_freed_mb,
            optimizations_total,
            optimization_errors_total,
            optimization_duration_seconds,
            health_checks_total,
            monitored_processes_total,
        })
    }
}