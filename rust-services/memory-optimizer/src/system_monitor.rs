//! System monitoring module for Memory Optimization Service

use crate::config::Config;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use sysinfo::{System, SystemExt, ProcessExt, CpuExt, DiskExt};
use tokio::sync::RwLock;
use tracing::{debug, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_available_mb: u64,
    pub cache_memory_mb: u64,
    pub buffer_memory_mb: u64,
    pub swap_total_mb: u64,
    pub swap_used_mb: u64,
    pub memory_pressure: f64,
    pub cpu_usage_percent: f64,
    pub load_average: (f64, f64, f64),
    pub heap_allocated_mb: u64,
    pub heap_sys_mb: u64,
    pub num_goroutines: Option<u64>,
    pub gc_count: Option<u64>,
    pub process_count: u64,
    pub file_descriptors_used: u64,
    pub network_connections: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub memory_mb: u64,
    pub cpu_percent: f64,
    pub status: String,
    pub start_time: u64,
}

pub struct SystemMonitor {
    system: Arc<RwLock<System>>,
    config: Arc<Config>,
}

impl SystemMonitor {
    pub fn new(config: Arc<Config>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let mut system = System::new_all();
        system.refresh_all();
        
        Ok(SystemMonitor {
            system: Arc::new(RwLock::new(system)),
            config,
        })
    }

    /// Get comprehensive system information
    pub async fn get_system_info(&self) -> SystemInfo {
        let mut system = self.system.write().await;
        system.refresh_all();
        
        let total_memory = system.total_memory();
        let used_memory = system.used_memory();
        let available_memory = system.available_memory();
        
        // Calculate memory pressure (0.0 to 1.0)
        let memory_pressure = if total_memory > 0 {
            used_memory as f64 / total_memory as f64
        } else {
            0.0
        };
        
        // Get CPU information
        let cpu_usage = system.global_cpu_info().cpu_usage();
        
        // Get load averages (Linux/macOS)
        let load_avg = system.load_average();
        
        // Get swap information
        let swap_total = system.total_swap();
        let swap_used = system.used_swap();
        
        // Process information
        let process_count = system.processes().len() as u64;
        
        // Heap information (estimated from jemalloc stats if available)
        let (heap_allocated, heap_sys) = self.get_heap_stats().await;
        
        SystemInfo {
            memory_total_mb: total_memory / 1024 / 1024,
            memory_used_mb: used_memory / 1024 / 1024,
            memory_available_mb: available_memory / 1024 / 1024,
            cache_memory_mb: 0, // Would need to parse /proc/meminfo on Linux
            buffer_memory_mb: 0, // Would need to parse /proc/meminfo on Linux
            swap_total_mb: swap_total / 1024 / 1024,
            swap_used_mb: swap_used / 1024 / 1024,
            memory_pressure,
            cpu_usage_percent: cpu_usage as f64,
            load_average: (load_avg.one, load_avg.five, load_avg.fifteen),
            heap_allocated_mb: heap_allocated / 1024 / 1024,
            heap_sys_mb: heap_sys / 1024 / 1024,
            num_goroutines: None, // Would be populated for Go services
            gc_count: None, // Would be populated for GC-enabled services
            process_count,
            file_descriptors_used: 0, // Would need platform-specific implementation
            network_connections: 0, // Would need platform-specific implementation
        }
    }

    /// Get information about monitored services
    pub async fn get_monitored_services(&self) -> Vec<ProcessInfo> {
        let system = self.system.read().await;
        let mut services = Vec::new();
        
        for service_name in &self.config.monitored_services {
            // Find processes matching the service name
            for (pid, process) in system.processes() {
                if process.name().contains(service_name) {
                    services.push(ProcessInfo {
                        pid: *pid as u32,
                        name: process.name().to_string(),
                        memory_mb: process.memory() / 1024 / 1024,
                        cpu_percent: process.cpu_usage() as f64,
                        status: format!("{:?}", process.status()),
                        start_time: process.start_time(),
                    });
                }
            }
        }
        
        services
    }

    /// Get count of monitored services
    pub async fn get_monitored_services_count(&self) -> usize {
        self.get_monitored_services().await.len()
    }

    /// Get heap statistics (from jemalloc or other allocator)
    async fn get_heap_stats(&self) -> (u64, u64) {
        // This would integrate with jemalloc stats in a real implementation
        // For now, return estimated values
        let system = self.system.read().await;
        let current_process_memory = system.processes()
            .iter()
            .find(|(_, p)| p.pid() == sysinfo::get_current_pid().unwrap())
            .map(|(_, p)| p.memory())
            .unwrap_or(0);
        
        (current_process_memory, current_process_memory)
    }

    /// Check if system is under memory pressure
    pub async fn is_under_memory_pressure(&self) -> bool {
        let info = self.get_system_info().await;
        info.memory_pressure > self.config.memory_pressure_threshold
    }

    /// Get memory usage for a specific service
    pub async fn get_service_memory_usage(&self, service_name: &str) -> Option<u64> {
        let services = self.get_monitored_services().await;
        services
            .iter()
            .find(|service| service.name.contains(service_name))
            .map(|service| service.memory_mb)
    }

    /// Get system resource limits
    pub async fn get_resource_limits(&self) -> ResourceLimits {
        let system = self.system.read().await;
        
        ResourceLimits {
            max_memory_mb: system.total_memory() / 1024 / 1024,
            max_swap_mb: system.total_swap() / 1024 / 1024,
            max_file_descriptors: 65536, // Default limit, would get from ulimit
            max_processes: 32768, // Default limit, would get from ulimit
        }
    }

    /// Get disk usage information
    pub async fn get_disk_usage(&self) -> Vec<DiskUsage> {
        let system = self.system.read().await;
        let mut disk_usage = Vec::new();
        
        for disk in system.disks() {
            disk_usage.push(DiskUsage {
                mount_point: disk.mount_point().to_string_lossy().to_string(),
                total_space_gb: disk.total_space() / 1024 / 1024 / 1024,
                available_space_gb: disk.available_space() / 1024 / 1024 / 1024,
                usage_percent: if disk.total_space() > 0 {
                    ((disk.total_space() - disk.available_space()) as f64 / disk.total_space() as f64) * 100.0
                } else {
                    0.0
                },
            });
        }
        
        disk_usage
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: u64,
    pub max_swap_mb: u64,
    pub max_file_descriptors: u64,
    pub max_processes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskUsage {
    pub mount_point: String,
    pub total_space_gb: u64,
    pub available_space_gb: u64,
    pub usage_percent: f64,
}