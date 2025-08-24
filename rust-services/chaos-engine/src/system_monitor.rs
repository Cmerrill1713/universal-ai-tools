use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use sysinfo::{System, SystemExt, CpuExt, DiskExt, NetworkExt};
use tracing::{debug, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub memory_total: u64,
    pub memory_used: u64,
    pub disk_usage: HashMap<String, DiskMetrics>,
    pub network_stats: HashMap<String, NetworkMetrics>,
    pub load_average: Option<f64>,
    pub process_count: usize,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub total_space: u64,
    pub available_space: u64,
    pub usage_percentage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub bytes_received: u64,
    pub bytes_transmitted: u64,
    pub packets_received: u64,
    pub packets_transmitted: u64,
}

pub struct SystemMonitor {
    system: System,
}

impl SystemMonitor {
    pub async fn new() -> Result<Self> {
        let mut system = System::new_all();
        system.refresh_all();
        
        debug!("System monitor initialized");
        
        Ok(SystemMonitor { system })
    }

    pub async fn collect_metrics(&self) -> Result<HashMap<String, f64>> {
        let mut system = System::new_all();
        system.refresh_all();

        let mut metrics = HashMap::new();

        // CPU metrics
        let cpu_usage = system.global_cpu_info().cpu_usage() as f64;
        metrics.insert("cpu_usage".to_string(), cpu_usage);

        // Memory metrics
        let total_memory = system.total_memory();
        let used_memory = system.used_memory();
        let memory_usage_percent = if total_memory > 0 {
            (used_memory as f64 / total_memory as f64) * 100.0
        } else {
            0.0
        };
        
        metrics.insert("memory_usage_percent".to_string(), memory_usage_percent);
        metrics.insert("memory_total_mb".to_string(), (total_memory / 1024 / 1024) as f64);
        metrics.insert("memory_used_mb".to_string(), (used_memory / 1024 / 1024) as f64);

        // Load average (Unix systems)
        if let Some(load_avg) = system.load_average().one {
            metrics.insert("load_average_1min".to_string(), load_avg);
        }

        // Process count
        let process_count = system.processes().len();
        metrics.insert("process_count".to_string(), process_count as f64);

        // Disk usage for root filesystem
        for disk in system.disks() {
            let mount_point = disk.mount_point().to_string_lossy();
            if mount_point == "/" {
                let total_space = disk.total_space();
                let available_space = disk.available_space();
                let used_space = total_space - available_space;
                let usage_percent = if total_space > 0 {
                    (used_space as f64 / total_space as f64) * 100.0
                } else {
                    0.0
                };
                
                metrics.insert("disk_usage_percent".to_string(), usage_percent);
                metrics.insert("disk_total_gb".to_string(), (total_space / 1024 / 1024 / 1024) as f64);
                metrics.insert("disk_used_gb".to_string(), (used_space / 1024 / 1024 / 1024) as f64);
                break;
            }
        }

        // Network statistics (aggregate)
        let mut total_bytes_received = 0u64;
        let mut total_bytes_transmitted = 0u64;
        
        for (_interface_name, data) in system.networks() {
            total_bytes_received += data.received();
            total_bytes_transmitted += data.transmitted();
        }
        
        metrics.insert("network_bytes_received".to_string(), total_bytes_received as f64);
        metrics.insert("network_bytes_transmitted".to_string(), total_bytes_transmitted as f64);

        // Derived metrics
        metrics.insert("response_time".to_string(), 100.0); // Placeholder - would measure actual response times
        metrics.insert("throughput_rps".to_string(), 50.0);  // Placeholder - would measure actual throughput

        debug!("Collected {} system metrics", metrics.len());

        Ok(metrics)
    }

    pub async fn get_detailed_system_info(&self) -> Result<SystemMetrics> {
        let mut system = System::new_all();
        system.refresh_all();

        // CPU usage
        let cpu_usage = system.global_cpu_info().cpu_usage() as f64;

        // Memory info
        let memory_total = system.total_memory();
        let memory_used = system.used_memory();
        let memory_usage = if memory_total > 0 {
            (memory_used as f64 / memory_total as f64) * 100.0
        } else {
            0.0
        };

        // Disk info
        let mut disk_usage = HashMap::new();
        for disk in system.disks() {
            let mount_point = disk.mount_point().to_string_lossy().to_string();
            let total_space = disk.total_space();
            let available_space = disk.available_space();
            let usage_percentage = if total_space > 0 {
                ((total_space - available_space) as f64 / total_space as f64) * 100.0
            } else {
                0.0
            };

            disk_usage.insert(mount_point, DiskMetrics {
                total_space,
                available_space,
                usage_percentage,
            });
        }

        // Network info
        let mut network_stats = HashMap::new();
        for (interface_name, data) in system.networks() {
            network_stats.insert(interface_name.clone(), NetworkMetrics {
                bytes_received: data.received(),
                bytes_transmitted: data.transmitted(),
                packets_received: data.packets_received(),
                packets_transmitted: data.packets_transmitted(),
            });
        }

        // Load average
        let load_average = system.load_average().one;

        // Process count
        let process_count = system.processes().len();

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();

        Ok(SystemMetrics {
            cpu_usage,
            memory_usage,
            memory_total,
            memory_used,
            disk_usage,
            network_stats,
            load_average,
            process_count,
            timestamp,
        })
    }

    pub async fn check_system_health(&self) -> Result<SystemHealthStatus> {
        let metrics = self.collect_metrics().await?;

        let cpu_usage = metrics.get("cpu_usage").cloned().unwrap_or(0.0);
        let memory_usage = metrics.get("memory_usage_percent").cloned().unwrap_or(0.0);
        let disk_usage = metrics.get("disk_usage_percent").cloned().unwrap_or(0.0);

        let mut warnings = Vec::new();
        let mut critical_issues = Vec::new();

        // Check CPU usage
        if cpu_usage > 90.0 {
            critical_issues.push(format!("Critical CPU usage: {:.1}%", cpu_usage));
        } else if cpu_usage > 75.0 {
            warnings.push(format!("High CPU usage: {:.1}%", cpu_usage));
        }

        // Check memory usage
        if memory_usage > 95.0 {
            critical_issues.push(format!("Critical memory usage: {:.1}%", memory_usage));
        } else if memory_usage > 85.0 {
            warnings.push(format!("High memory usage: {:.1}%", memory_usage));
        }

        // Check disk usage
        if disk_usage > 95.0 {
            critical_issues.push(format!("Critical disk usage: {:.1}%", disk_usage));
        } else if disk_usage > 90.0 {
            warnings.push(format!("High disk usage: {:.1}%", disk_usage));
        }

        let health_status = if !critical_issues.is_empty() {
            "critical"
        } else if !warnings.is_empty() {
            "warning"
        } else {
            "healthy"
        };

        Ok(SystemHealthStatus {
            status: health_status.to_string(),
            warnings,
            critical_issues,
            metrics,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemHealthStatus {
    pub status: String, // healthy, warning, critical
    pub warnings: Vec<String>,
    pub critical_issues: Vec<String>,
    pub metrics: HashMap<String, f64>,
}