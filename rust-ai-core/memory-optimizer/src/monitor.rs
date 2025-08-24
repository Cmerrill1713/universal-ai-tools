//! System memory monitoring and metrics collection

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tracing::{debug, instrument};

/// System memory information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMemoryInfo {
    pub total_mb: u64,
    pub available_mb: u64,
    pub used_mb: u64,
    pub free_mb: u64,
    pub usage_percent: f64,
    pub swap_total_mb: u64,
    pub swap_used_mb: u64,
    pub process_memory_mb: u64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Memory monitoring system
pub struct MemoryMonitor {
    #[cfg(feature = "system-info")]
    system: sysinfo::System,
    last_collection: Option<Instant>,
    collection_interval: Duration,
}

impl MemoryMonitor {
    /// Create a new memory monitor
    pub async fn new() -> Result<Self> {
        Ok(Self {
            #[cfg(feature = "system-info")]
            system: sysinfo::System::new_all(),
            last_collection: None,
            collection_interval: Duration::from_secs(1),
        })
    }

    /// Get current memory information
    #[instrument(skip(self))]
    pub async fn get_memory_info(&self) -> Result<SystemMemoryInfo> {
        #[cfg(feature = "system-info")]
        {
            // Use sysinfo for cross-platform memory information
            let mut system = sysinfo::System::new();
            system.refresh_memory();
            
            let total_memory = system.total_memory() / 1024 / 1024; // Convert to MB
            let available_memory = system.available_memory() / 1024 / 1024;
            let used_memory = system.used_memory() / 1024 / 1024;
            let free_memory = system.free_memory() / 1024 / 1024;
            let usage_percent = (used_memory as f64 / total_memory as f64) * 100.0;

            let swap_total = system.total_swap() / 1024 / 1024;
            let swap_used = system.used_swap() / 1024 / 1024;

            // Get current process memory usage
            let process_memory = self.get_process_memory().await.unwrap_or(0);

            Ok(SystemMemoryInfo {
                total_mb: total_memory,
                available_mb: available_memory,
                used_mb: used_memory,
                free_mb: free_memory,
                usage_percent,
                swap_total_mb: swap_total,
                swap_used_mb: swap_used,
                process_memory_mb: process_memory,
                timestamp: chrono::Utc::now(),
            })
        }

        #[cfg(not(feature = "system-info"))]
        {
            // Fallback implementation for testing
            Ok(SystemMemoryInfo {
                total_mb: 8192,
                available_mb: 4096,
                used_mb: 4096,
                free_mb: 4096,
                usage_percent: 50.0,
                swap_total_mb: 2048,
                swap_used_mb: 1024,
                process_memory_mb: 256,
                timestamp: chrono::Utc::now(),
            })
        }
    }

    /// Get current process memory usage
    async fn get_process_memory(&self) -> Result<u64> {
        #[cfg(all(feature = "system-info", target_os = "linux"))]
        {
            // Use procfs for detailed Linux process information
            if let Ok(process) = procfs::process::Process::myself() {
                if let Ok(stat) = process.stat() {
                    let rss_pages = stat.rss;
                    let page_size = procfs::page_size() as u64;
                    let memory_bytes = rss_pages as u64 * page_size;
                    return Ok(memory_bytes / 1024 / 1024); // Convert to MB
                }
            }
        }

        #[cfg(feature = "jemalloc")]
        {
            // Use jemalloc statistics if available
            use tikv_jemalloc_ctl::{stats, epoch};
            
            if let (Ok(e), Ok(allocated)) = (epoch::mib(), stats::allocated::mib()) {
                if e.advance().is_ok() {
                    if let Ok(allocated_bytes) = allocated.read() {
                        return Ok(allocated_bytes / 1024 / 1024); // Convert to MB
                    }
                }
            }
        }

        // Fallback: estimate based on system info
        #[cfg(feature = "system-info")]
        {
            let pid = sysinfo::get_current_pid().map_err(|e| anyhow::anyhow!("Failed to get PID: {}", e))?;
            let mut system = sysinfo::System::new();
            system.refresh_process(pid);
            
            if let Some(process) = system.process(pid) {
                return Ok(process.memory() / 1024 / 1024); // Convert to MB
            }
        }

        Ok(0) // Unable to determine
    }

    /// Collect and update metrics
    #[instrument(skip(self))]
    pub async fn collect_metrics(&mut self) -> Result<()> {
        let now = Instant::now();
        
        // Throttle collection to avoid overwhelming the system
        if let Some(last) = self.last_collection {
            if now.duration_since(last) < self.collection_interval {
                return Ok(());
            }
        }

        #[cfg(feature = "system-info")]
        {
            self.system.refresh_memory();
            self.system.refresh_processes();
        }

        self.last_collection = Some(now);
        
        debug!("Memory metrics collected");
        Ok(())
    }

    /// Get detailed memory breakdown
    #[instrument(skip(self))]
    pub async fn get_detailed_memory_info(&self) -> Result<DetailedMemoryInfo> {
        let basic_info = self.get_memory_info().await?;
        
        #[cfg(all(feature = "jemalloc", feature = "system-info"))]
        {
            let jemalloc_info = self.get_jemalloc_stats().await?;
            Ok(DetailedMemoryInfo {
                basic: basic_info,
                jemalloc: Some(jemalloc_info),
                gc_info: self.get_gc_info().await?,
            })
        }

        #[cfg(not(all(feature = "jemalloc", feature = "system-info")))]
        {
            Ok(DetailedMemoryInfo {
                basic: basic_info,
                jemalloc: None,
                gc_info: GCInfo::default(),
            })
        }
    }

    /// Get jemalloc-specific statistics
    #[cfg(feature = "jemalloc")]
    async fn get_jemalloc_stats(&self) -> Result<JemallocStats> {
        use tikv_jemalloc_ctl::{stats, epoch};

        let e = epoch::mib()?;
        e.advance()?;

        let allocated = stats::allocated::mib()?.read()? / 1024 / 1024; // MB
        let active = stats::active::mib()?.read()? / 1024 / 1024; // MB
        let metadata = stats::metadata::mib()?.read()? / 1024 / 1024; // MB
        let resident = stats::resident::mib()?.read()? / 1024 / 1024; // MB
        let mapped = stats::mapped::mib()?.read()? / 1024 / 1024; // MB
        let retained = stats::retained::mib()?.read()? / 1024 / 1024; // MB

        Ok(JemallocStats {
            allocated_mb: allocated,
            active_mb: active,
            metadata_mb: metadata,
            resident_mb: resident,
            mapped_mb: mapped,
            retained_mb: retained,
        })
    }

    /// Get garbage collection information (placeholder)
    async fn get_gc_info(&self) -> Result<GCInfo> {
        // In a real implementation, this would integrate with the runtime's GC
        // For Rust, this might involve custom allocator hooks or profiling tools
        Ok(GCInfo {
            collections_count: 0,
            last_collection: None,
            total_freed_mb: 0,
            average_pause_ms: 0.0,
        })
    }

    /// Get memory pressure indicators
    pub async fn get_pressure_indicators(&self) -> Result<MemoryPressureIndicators> {
        let memory_info = self.get_memory_info().await?;
        
        // Calculate various pressure indicators
        let memory_pressure = memory_info.usage_percent;
        let swap_pressure = if memory_info.swap_total_mb > 0 {
            (memory_info.swap_used_mb as f64 / memory_info.swap_total_mb as f64) * 100.0
        } else {
            0.0
        };

        // Process-specific pressure
        let process_pressure = if memory_info.total_mb > 0 {
            (memory_info.process_memory_mb as f64 / memory_info.total_mb as f64) * 100.0
        } else {
            0.0
        };

        // Available memory ratio
        let available_ratio = (memory_info.available_mb as f64 / memory_info.total_mb as f64) * 100.0;

        Ok(MemoryPressureIndicators {
            memory_pressure_percent: memory_pressure,
            swap_pressure_percent: swap_pressure,
            process_pressure_percent: process_pressure,
            available_memory_percent: available_ratio,
            low_memory_warning: available_ratio < 20.0,
            high_pressure_warning: memory_pressure > 85.0,
            critical_pressure_warning: memory_pressure > 95.0,
        })
    }
}

/// Detailed memory information including allocator-specific data
#[derive(Debug, Clone, Serialize)]
pub struct DetailedMemoryInfo {
    pub basic: SystemMemoryInfo,
    pub jemalloc: Option<JemallocStats>,
    pub gc_info: GCInfo,
}

/// jemalloc-specific memory statistics
#[derive(Debug, Clone, Serialize)]
pub struct JemallocStats {
    pub allocated_mb: u64,
    pub active_mb: u64,
    pub metadata_mb: u64,
    pub resident_mb: u64,
    pub mapped_mb: u64,
    pub retained_mb: u64,
}

/// Garbage collection information
#[derive(Debug, Clone, Serialize)]
pub struct GCInfo {
    pub collections_count: u64,
    pub last_collection: Option<chrono::DateTime<chrono::Utc>>,
    pub total_freed_mb: u64,
    pub average_pause_ms: f64,
}

impl Default for GCInfo {
    fn default() -> Self {
        Self {
            collections_count: 0,
            last_collection: None,
            total_freed_mb: 0,
            average_pause_ms: 0.0,
        }
    }
}

/// Memory pressure indicators
#[derive(Debug, Clone, Serialize)]
pub struct MemoryPressureIndicators {
    pub memory_pressure_percent: f64,
    pub swap_pressure_percent: f64,
    pub process_pressure_percent: f64,
    pub available_memory_percent: f64,
    pub low_memory_warning: bool,
    pub high_pressure_warning: bool,
    pub critical_pressure_warning: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_memory_monitor_creation() {
        let monitor = MemoryMonitor::new().await.unwrap();
        let info = monitor.get_memory_info().await.unwrap();
        
        assert!(info.total_mb > 0);
        assert!(info.usage_percent >= 0.0 && info.usage_percent <= 100.0);
    }

    #[tokio::test]
    async fn test_pressure_indicators() {
        let monitor = MemoryMonitor::new().await.unwrap();
        let indicators = monitor.get_pressure_indicators().await.unwrap();
        
        assert!(indicators.memory_pressure_percent >= 0.0);
        assert!(indicators.available_memory_percent >= 0.0);
    }

    #[tokio::test]
    async fn test_detailed_memory_info() {
        let monitor = MemoryMonitor::new().await.unwrap();
        let detailed = monitor.get_detailed_memory_info().await.unwrap();
        
        assert!(detailed.basic.total_mb > 0);
        // jemalloc stats may or may not be available depending on features
    }
}