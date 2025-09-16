use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use anyhow::{Result, Context};
use rand::Rng;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi_derive::napi(object)]
pub struct GPUMetrics {
    pub total_vram_gb: f64,
    pub used_vram_gb: f64,
    pub available_vram_gb: f64,
    pub temperature_celsius: f32,
    pub utilization_percent: f32,
    pub memory_utilization_percent: f32,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GPUInfo {
    pub name: String,
    pub total_memory_gb: f64,
    pub driver_version: String,
    pub compute_capability: Option<String>,
    pub device_id: u32,
}

pub struct GPUMonitor {
    running: Arc<AtomicBool>,
    current_metrics: Arc<RwLock<Option<GPUMetrics>>>,
    gpu_info: Arc<RwLock<Option<GPUInfo>>>,
}

impl GPUMonitor {
    pub fn new() -> Result<Self> {
        Ok(Self {
            running: Arc::new(AtomicBool::new(false)),
            current_metrics: Arc::new(RwLock::new(None)),
            gpu_info: Arc::new(RwLock::new(None)),
        })
    }
    
    pub async fn start_monitoring(&self) -> Result<()> {
        self.running.store(true, Ordering::Relaxed);
        
        // Initialize GPU info
        let gpu_info = self.detect_gpu_info().await?;
        *self.gpu_info.write().await = Some(gpu_info);
        
        // Start metrics collection loop
        let running = Arc::clone(&self.running);
        let metrics = Arc::clone(&self.current_metrics);
        
        tokio::spawn(async move {
            while running.load(Ordering::Relaxed) {
                if let Ok(new_metrics) = Self::collect_gpu_metrics().await {
                    *metrics.write().await = Some(new_metrics);
                }
                
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
            }
        });
        
        // Wait for first metrics collection
        for _ in 0..50 { // 5 second timeout
            if self.current_metrics.read().await.is_some() {
                break;
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
        
        tracing::info!("GPU monitoring started");
        Ok(())
    }
    
    pub async fn stop_monitoring(&self) {
        self.running.store(false, Ordering::Relaxed);
        tracing::info!("GPU monitoring stopped");
    }
    
    pub async fn get_current_metrics(&self) -> Result<GPUMetrics> {
        self.current_metrics
            .read()
            .await
            .clone()
            .ok_or_else(|| anyhow::anyhow!("GPU metrics not available"))
    }
    
    pub async fn get_gpu_info(&self) -> Result<GPUInfo> {
        self.gpu_info
            .read()
            .await
            .clone()
            .ok_or_else(|| anyhow::anyhow!("GPU info not available"))
    }
    
    async fn detect_gpu_info(&self) -> Result<GPUInfo> {
        #[cfg(target_os = "macos")]
        {
            // Use Metal framework to detect Apple Silicon GPU
            self.detect_metal_gpu().await
        }
        
        #[cfg(target_os = "linux")]
        {
            // Try NVIDIA first, then fallback to generic
            if let Ok(info) = self.detect_nvidia_gpu().await {
                Ok(info)
            } else {
                self.detect_generic_gpu().await
            }
        }
        
        #[cfg(target_os = "windows")]
        {
            // Use NVML or D3D for Windows GPU detection
            self.detect_windows_gpu().await
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            self.detect_generic_gpu().await
        }
    }
    
    #[cfg(target_os = "macos")]
    async fn detect_metal_gpu(&self) -> Result<GPUInfo> {
        use metal::{Device, MTLResourceOptions};
        
        let device = Device::system_default()
            .ok_or_else(|| anyhow::anyhow!("No Metal device available"))?;
        
        let name = device.name().to_string();
        
        // For Apple Silicon, estimate memory based on chip
        let total_memory_gb = if name.contains("M1") {
            if name.contains("Max") { 32.0 } else if name.contains("Pro") { 16.0 } else { 8.0 }
        } else if name.contains("M2") {
            if name.contains("Ultra") { 64.0 } else if name.contains("Max") { 32.0 } else if name.contains("Pro") { 16.0 } else { 8.0 }
        } else if name.contains("M3") {
            if name.contains("Max") { 36.0 } else if name.contains("Pro") { 18.0 } else { 8.0 }
        } else {
            24.0 // Default assumption
        };
        
        Ok(GPUInfo {
            name,
            total_memory_gb,
            driver_version: "Metal".to_string(),
            compute_capability: Some("Apple Silicon".to_string()),
            device_id: 0,
        })
    }
    
    #[cfg(target_os = "linux")]
    async fn detect_nvidia_gpu(&self) -> Result<GPUInfo> {
        #[cfg(feature = "gpu-nvidia")]
        {
            use nvml_wrapper::Nvml;
            
            let nvml = Nvml::init().context("Failed to initialize NVML")?;
            let device = nvml.device_by_index(0).context("No NVIDIA GPU found")?;
            
            let name = device.name().context("Failed to get GPU name")?;
            let memory_info = device.memory_info().context("Failed to get memory info")?;
            let total_memory_gb = memory_info.total as f64 / 1024.0 / 1024.0 / 1024.0;
            
            let driver_version = nvml.sys_driver_version().unwrap_or_else(|_| "Unknown".to_string());
            
            Ok(GPUInfo {
                name,
                total_memory_gb,
                driver_version,
                compute_capability: device.cuda_compute_capability().ok()
                    .map(|cc| format!("{}.{}", cc.major, cc.minor)),
                device_id: 0,
            })
        }
        
        #[cfg(not(feature = "gpu-nvidia"))]
        {
            Err(anyhow::anyhow!("NVIDIA support not compiled in"))
        }
    }
    
    async fn detect_generic_gpu(&self) -> Result<GPUInfo> {
        // Fallback generic GPU detection using system info
        use sysinfo::{System, SystemExt};
        
        let mut sys = System::new();
        sys.refresh_system();
        
        // This is a simplified fallback - in production you'd want more sophisticated detection
        Ok(GPUInfo {
            name: "Generic GPU".to_string(),
            total_memory_gb: 24.0, // Assume our target 24GB system
            driver_version: "Unknown".to_string(),
            compute_capability: None,
            device_id: 0,
        })
    }
    
    #[cfg(target_os = "windows")]
    async fn detect_windows_gpu(&self) -> Result<GPUInfo> {
        // Windows-specific GPU detection would go here
        // For now, use generic fallback
        self.detect_generic_gpu().await
    }
    
    async fn collect_gpu_metrics() -> Result<GPUMetrics> {
        #[cfg(target_os = "macos")]
        {
            Self::collect_metal_metrics().await
        }
        
        #[cfg(target_os = "linux")]
        {
            if let Ok(metrics) = Self::collect_nvidia_metrics().await {
                Ok(metrics)
            } else {
                Self::collect_generic_metrics().await
            }
        }
        
        #[cfg(target_os = "windows")]
        {
            Self::collect_windows_metrics().await
        }
        
        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            Self::collect_generic_metrics().await
        }
    }
    
    #[cfg(target_os = "macos")]
    async fn collect_metal_metrics() -> Result<GPUMetrics> {
        use sysinfo::{System, SystemExt};
        
        let mut sys = System::new();
        sys.refresh_memory();
        
        // For Apple Silicon, GPU memory is shared with system memory
        let total_memory = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
        let used_memory = sys.used_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
        
        // Estimate GPU-specific usage (this is simplified)
        let total_vram_gb = 24.0; // Our target system
        let used_vram_gb = (used_memory * 0.3).min(total_vram_gb); // Estimate 30% GPU usage
        
        Ok(GPUMetrics {
            total_vram_gb,
            used_vram_gb,
            available_vram_gb: total_vram_gb - used_vram_gb,
            temperature_celsius: 45.0 + (rand::thread_rng().gen::<f32>() * 20.0), // Simulated
            utilization_percent: 10.0 + (rand::thread_rng().gen::<f32>() * 30.0), // Simulated
            memory_utilization_percent: (used_vram_gb / total_vram_gb * 100.0) as f32,
            timestamp: Utc::now().to_rfc3339(),
        })
    }
    
    #[cfg(target_os = "linux")]
    async fn collect_nvidia_metrics() -> Result<GPUMetrics> {
        #[cfg(feature = "gpu-nvidia")]
        {
            use nvml_wrapper::Nvml;
            
            let nvml = Nvml::init()?;
            let device = nvml.device_by_index(0)?;
            
            let memory_info = device.memory_info()?;
            let total_vram_gb = memory_info.total as f64 / 1024.0 / 1024.0 / 1024.0;
            let used_vram_gb = memory_info.used as f64 / 1024.0 / 1024.0 / 1024.0;
            
            let temperature = device.temperature(nvml_wrapper::enum_wrappers::device::TemperatureSensor::Gpu)
                .unwrap_or(50) as f32;
            
            let utilization = device.utilization_rates()
                .map(|u| u.gpu as f32)
                .unwrap_or(0.0);
            
            Ok(GPUMetrics {
                total_vram_gb,
                used_vram_gb,
                available_vram_gb: total_vram_gb - used_vram_gb,
                temperature_celsius: temperature,
                utilization_percent: utilization,
                memory_utilization_percent: (used_vram_gb / total_vram_gb * 100.0) as f32,
                timestamp: Utc::now().to_rfc3339(),
            })
        }
        
        #[cfg(not(feature = "gpu-nvidia"))]
        {
            Err(anyhow::anyhow!("NVIDIA support not available"))
        }
    }
    
    async fn collect_generic_metrics() -> Result<GPUMetrics> {
        // Fallback metrics collection - simulated for development
        let total_vram_gb = 24.0;
        
        // Simulate some realistic usage patterns
        let base_usage = 2.0; // Base OS usage
        let random_usage = rand::thread_rng().gen::<f64>() * 8.0; // Random application usage
        let used_vram_gb = (base_usage + random_usage).min(total_vram_gb);
        
        Ok(GPUMetrics {
            total_vram_gb,
            used_vram_gb,
            available_vram_gb: total_vram_gb - used_vram_gb,
            temperature_celsius: 40.0 + (rand::thread_rng().gen::<f32>() * 25.0),
            utilization_percent: (used_vram_gb / total_vram_gb * 80.0) as f32,
            memory_utilization_percent: (used_vram_gb / total_vram_gb * 100.0) as f32,
            timestamp: Utc::now().to_rfc3339(),
        })
    }
    
    #[cfg(target_os = "windows")]
    async fn collect_windows_metrics() -> Result<GPUMetrics> {
        // Windows-specific metrics collection
        // For now, use generic fallback
        Self::collect_generic_metrics().await
    }
}