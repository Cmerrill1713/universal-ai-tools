use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::sleep;
use tracing::{info, warn, error, debug};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScenarioDefinition {
    pub name: String,
    pub description: String,
    pub category: String,
    pub parameters: Vec<ParameterDefinition>,
    pub supported_targets: Vec<String>,
    pub risk_level: String, // low, medium, high
    pub recovery_time_estimate: u64, // seconds
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParameterDefinition {
    pub name: String,
    pub param_type: String, // string, number, boolean
    pub required: bool,
    pub default_value: Option<serde_json::Value>,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScenarioResults {
    pub scenario_id: String,
    pub execution_time: u64,
    pub metrics_during: HashMap<String, f64>,
    pub recovery_time: Option<u64>,
    pub lessons_learned: Vec<String>,
    pub artifacts: Vec<String>,
}

pub struct ChaosScenarios {
    scenarios: HashMap<String, ScenarioDefinition>,
}

impl ChaosScenarios {
    pub async fn new() -> Result<Self> {
        let mut scenarios = HashMap::new();

        // Memory pressure scenario
        scenarios.insert("memory_pressure".to_string(), ScenarioDefinition {
            name: "Memory Pressure".to_string(),
            description: "Gradually increase memory consumption to test memory management".to_string(),
            category: "resource_stress".to_string(),
            parameters: vec![
                ParameterDefinition {
                    name: "pressure_mb".to_string(),
                    param_type: "number".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(512))),
                    description: "Amount of memory to consume in MB".to_string(),
                },
                ParameterDefinition {
                    name: "ramp_up_time".to_string(),
                    param_type: "number".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(30))),
                    description: "Time to ramp up pressure in seconds".to_string(),
                },
            ],
            supported_targets: vec!["process".to_string(), "system".to_string()],
            risk_level: "medium".to_string(),
            recovery_time_estimate: 10,
        });

        // Network latency scenario
        scenarios.insert("network_latency".to_string(), ScenarioDefinition {
            name: "Network Latency".to_string(),
            description: "Introduce network latency to test timeout handling".to_string(),
            category: "network_chaos".to_string(),
            parameters: vec![
                ParameterDefinition {
                    name: "latency_ms".to_string(),
                    param_type: "number".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(1000))),
                    description: "Additional latency to introduce in milliseconds".to_string(),
                },
                ParameterDefinition {
                    name: "packet_loss_percent".to_string(),
                    param_type: "number".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(0))),
                    description: "Percentage of packets to drop (0-100)".to_string(),
                },
            ],
            supported_targets: vec!["port".to_string(), "interface".to_string()],
            risk_level: "low".to_string(),
            recovery_time_estimate: 5,
        });

        // CPU spike scenario
        scenarios.insert("cpu_spike".to_string(), ScenarioDefinition {
            name: "CPU Spike".to_string(),
            description: "Generate high CPU load to test performance under pressure".to_string(),
            category: "resource_stress".to_string(),
            parameters: vec![
                ParameterDefinition {
                    name: "cpu_percent".to_string(),
                    param_type: "number".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(80))),
                    description: "Target CPU usage percentage (1-100)".to_string(),
                },
                ParameterDefinition {
                    name: "thread_count".to_string(),
                    param_type: "number".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(4))),
                    description: "Number of threads to spawn for CPU load".to_string(),
                },
            ],
            supported_targets: vec!["system".to_string(), "process".to_string()],
            risk_level: "medium".to_string(),
            recovery_time_estimate: 3,
        });

        // Service unavailable scenario
        scenarios.insert("service_unavailable".to_string(), ScenarioDefinition {
            name: "Service Unavailable".to_string(),
            description: "Make service temporarily unavailable to test circuit breakers".to_string(),
            category: "service_disruption".to_string(),
            parameters: vec![
                ParameterDefinition {
                    name: "block_method".to_string(),
                    param_type: "string".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::String("port_block".to_string())),
                    description: "Method to block service (port_block, process_stop)".to_string(),
                },
            ],
            supported_targets: vec!["service".to_string(), "port".to_string()],
            risk_level: "high".to_string(),
            recovery_time_estimate: 15,
        });

        // Disk fill scenario
        scenarios.insert("disk_fill".to_string(), ScenarioDefinition {
            name: "Disk Fill".to_string(),
            description: "Fill disk space to test disk pressure handling".to_string(),
            category: "resource_stress".to_string(),
            parameters: vec![
                ParameterDefinition {
                    name: "fill_percentage".to_string(),
                    param_type: "number".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(85))),
                    description: "Target disk usage percentage".to_string(),
                },
                ParameterDefinition {
                    name: "target_path".to_string(),
                    param_type: "string".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::String("/tmp".to_string())),
                    description: "Path to fill with temporary data".to_string(),
                },
            ],
            supported_targets: vec!["filesystem".to_string()],
            risk_level: "high".to_string(),
            recovery_time_estimate: 20,
        });

        // Connection drop scenario
        scenarios.insert("connection_drop".to_string(), ScenarioDefinition {
            name: "Connection Drop".to_string(),
            description: "Drop network connections to test connection recovery".to_string(),
            category: "network_chaos".to_string(),
            parameters: vec![
                ParameterDefinition {
                    name: "drop_percentage".to_string(),
                    param_type: "number".to_string(),
                    required: false,
                    default_value: Some(serde_json::Value::Number(serde_json::Number::from(50))),
                    description: "Percentage of connections to drop".to_string(),
                },
            ],
            supported_targets: vec!["port".to_string(), "service".to_string()],
            risk_level: "medium".to_string(),
            recovery_time_estimate: 10,
        });

        info!("🎯 Loaded {} chaos scenarios", scenarios.len());
        
        Ok(ChaosScenarios { scenarios })
    }

    pub fn is_scenario_available(&self, scenario: &str) -> bool {
        self.scenarios.contains_key(scenario)
    }

    pub async fn list_available_scenarios(&self) -> Result<Vec<ScenarioDefinition>> {
        Ok(self.scenarios.values().cloned().collect())
    }

    pub async fn execute_scenario(
        &self,
        scenario: &str,
        target: &str,
        duration: u64, // milliseconds
        intensity: &str,
        parameters: &HashMap<String, serde_json::Value>,
    ) -> Result<ScenarioResults> {
        let scenario_def = self.scenarios.get(scenario)
            .ok_or_else(|| anyhow!("Unknown scenario: {}", scenario))?;

        info!("🔬 Executing chaos scenario: {} on {} for {}ms (intensity: {})", 
              scenario, target, duration, intensity);

        let start_time = SystemTime::now();
        let mut metrics_during = HashMap::new();
        let mut lessons_learned = Vec::new();
        let mut artifacts = Vec::new();

        match scenario {
            "memory_pressure" => {
                self.execute_memory_pressure(target, duration, intensity, parameters, &mut metrics_during).await?;
                lessons_learned.push("Memory pressure test completed - check garbage collection behavior".to_string());
            },
            "network_latency" => {
                self.execute_network_latency(target, duration, intensity, parameters, &mut metrics_during).await?;
                lessons_learned.push("Network latency test completed - verify timeout configurations".to_string());
            },
            "cpu_spike" => {
                self.execute_cpu_spike(target, duration, intensity, parameters, &mut metrics_during).await?;
                lessons_learned.push("CPU spike test completed - monitor CPU throttling and scaling".to_string());
            },
            "service_unavailable" => {
                self.execute_service_unavailable(target, duration, intensity, parameters, &mut metrics_during).await?;
                lessons_learned.push("Service unavailable test completed - verify circuit breaker behavior".to_string());
            },
            "disk_fill" => {
                artifacts = self.execute_disk_fill(target, duration, intensity, parameters, &mut metrics_during).await?;
                lessons_learned.push("Disk fill test completed - check disk cleanup procedures".to_string());
            },
            "connection_drop" => {
                self.execute_connection_drop(target, duration, intensity, parameters, &mut metrics_during).await?;
                lessons_learned.push("Connection drop test completed - verify reconnection logic".to_string());
            },
            _ => {
                return Err(anyhow!("Scenario implementation not found: {}", scenario));
            }
        }

        let execution_time = start_time.elapsed()?.as_millis() as u64;
        
        info!("✅ Chaos scenario {} completed in {}ms", scenario, execution_time);

        Ok(ScenarioResults {
            scenario_id: scenario.to_string(),
            execution_time,
            metrics_during,
            recovery_time: None, // Would be measured by monitoring system
            lessons_learned,
            artifacts,
        })
    }

    async fn execute_memory_pressure(
        &self,
        _target: &str,
        duration: u64,
        intensity: &str,
        parameters: &HashMap<String, serde_json::Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<()> {
        let pressure_mb = parameters.get("pressure_mb")
            .and_then(|v| v.as_u64())
            .unwrap_or(512) as usize;

        let intensity_multiplier = match intensity {
            "low" => 0.5,
            "medium" => 1.0,
            "high" => 2.0,
            _ => 1.0,
        };

        let actual_pressure = (pressure_mb as f64 * intensity_multiplier) as usize;
        
        info!("💾 Applying memory pressure: {}MB for {}ms", actual_pressure, duration);

        // Simulate memory pressure by allocating memory
        let mut memory_holder = Vec::new();
        let chunk_size = 1024 * 1024; // 1MB chunks
        let chunks_needed = actual_pressure;

        // Gradually allocate memory
        for i in 0..chunks_needed {
            let chunk = vec![0u8; chunk_size];
            memory_holder.push(chunk);
            
            if i % 100 == 0 {
                debug!("Allocated {}MB of memory", i);
                metrics.insert("memory_allocated_mb".to_string(), i as f64);
            }
            
            // Small delay to make it gradual
            sleep(Duration::from_millis(10)).await;
        }

        info!("💾 Memory pressure applied, holding for {}ms", duration);
        
        // Hold the memory for the specified duration
        sleep(Duration::from_millis(duration)).await;

        // Release memory gradually
        info!("💾 Releasing memory pressure...");
        memory_holder.clear();
        
        metrics.insert("final_memory_allocated_mb".to_string(), 0.0);

        Ok(())
    }

    async fn execute_network_latency(
        &self,
        target: &str,
        duration: u64,
        intensity: &str,
        parameters: &HashMap<String, serde_json::Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<()> {
        let latency_ms = parameters.get("latency_ms")
            .and_then(|v| v.as_u64())
            .unwrap_or(1000);

        let intensity_multiplier = match intensity {
            "low" => 0.5,
            "medium" => 1.0,
            "high" => 3.0,
            _ => 1.0,
        };

        let actual_latency = (latency_ms as f64 * intensity_multiplier) as u64;
        
        info!("🌐 Simulating network latency: {}ms for {}ms on {}", actual_latency, duration, target);

        // On macOS, we'll simulate latency effects rather than actually manipulating network
        // In production, this would use tc (traffic control) or similar tools
        
        metrics.insert("simulated_latency_ms".to_string(), actual_latency as f64);
        
        // Simulate the effect by adding delays to any network operations
        let start_time = SystemTime::now();
        while start_time.elapsed()?.as_millis() < duration as u128 {
            sleep(Duration::from_millis(actual_latency / 10)).await;
            
            // Log periodic status
            let elapsed = start_time.elapsed()?.as_millis();
            if elapsed % 5000 < 100 { // Every ~5 seconds
                debug!("Network latency simulation active: {}ms elapsed", elapsed);
            }
        }

        info!("🌐 Network latency simulation completed");
        Ok(())
    }

    async fn execute_cpu_spike(
        &self,
        _target: &str,
        duration: u64,
        intensity: &str,
        parameters: &HashMap<String, serde_json::Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<()> {
        let cpu_percent = parameters.get("cpu_percent")
            .and_then(|v| v.as_u64())
            .unwrap_or(80);

        let thread_count = parameters.get("thread_count")
            .and_then(|v| v.as_u64())
            .unwrap_or(4) as usize;

        let intensity_multiplier = match intensity {
            "low" => 0.6,
            "medium" => 1.0,
            "high" => 1.5,
            _ => 1.0,
        };

        let actual_cpu_percent = ((cpu_percent as f64 * intensity_multiplier) as u64).min(95);
        
        info!("🔥 Creating CPU spike: {}% usage with {} threads for {}ms", 
              actual_cpu_percent, thread_count, duration);

        let duration_per_thread = Duration::from_millis(duration);
        let mut handles = Vec::new();

        for i in 0..thread_count {
            let duration_clone = duration_per_thread.clone();
            let cpu_target = actual_cpu_percent;
            
            let handle = tokio::spawn(async move {
                let start_time = SystemTime::now();
                let mut iteration_count = 0u64;
                
                while start_time.elapsed().unwrap() < duration_clone {
                    // Busy work to consume CPU
                    for _ in 0..100000 {
                        iteration_count = iteration_count.wrapping_add(1);
                    }
                    
                    // Brief pause to control CPU usage
                    let usage_ratio = cpu_target as f64 / 100.0;
                    let sleep_ratio = 1.0 - usage_ratio;
                    if sleep_ratio > 0.0 {
                        sleep(Duration::from_millis((sleep_ratio * 10.0) as u64)).await;
                    }
                }
                
                debug!("CPU spike thread {} completed {} iterations", i, iteration_count);
                iteration_count
            });
            
            handles.push(handle);
        }

        // Wait for all CPU spike threads to complete
        let mut total_iterations = 0;
        for handle in handles {
            total_iterations += handle.await.unwrap_or(0);
        }

        metrics.insert("cpu_spike_threads".to_string(), thread_count as f64);
        metrics.insert("target_cpu_percent".to_string(), actual_cpu_percent as f64);
        metrics.insert("total_iterations".to_string(), total_iterations as f64);

        info!("🔥 CPU spike completed: {} total iterations across {} threads", 
              total_iterations, thread_count);

        Ok(())
    }

    async fn execute_service_unavailable(
        &self,
        target: &str,
        duration: u64,
        _intensity: &str,
        _parameters: &HashMap<String, serde_json::Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<()> {
        info!("🚫 Simulating service unavailable for {} ({}ms)", target, duration);

        // In a real implementation, this would:
        // - Block specific ports using iptables
        // - Stop specific processes
        // - Return error responses for HTTP endpoints
        
        // For this simulation, we'll just log the action
        metrics.insert("service_blocked".to_string(), 1.0);
        
        let start_time = SystemTime::now();
        while start_time.elapsed()?.as_millis() < duration as u128 {
            sleep(Duration::from_secs(1)).await;
            debug!("Service {} remains unavailable", target);
        }

        info!("🚫 Service unavailable simulation completed for {}", target);
        metrics.insert("service_blocked".to_string(), 0.0);

        Ok(())
    }

    async fn execute_disk_fill(
        &self,
        _target: &str,
        duration: u64,
        intensity: &str,
        parameters: &HashMap<String, serde_json::Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<Vec<String>> {
        let fill_percentage = parameters.get("fill_percentage")
            .and_then(|v| v.as_u64())
            .unwrap_or(85);

        let target_path = parameters.get("target_path")
            .and_then(|v| v.as_str())
            .unwrap_or("/tmp");

        let intensity_multiplier = match intensity {
            "low" => 0.5,
            "medium" => 1.0,
            "high" => 1.5,
            _ => 1.0,
        };

        let actual_fill_percentage = ((fill_percentage as f64 * intensity_multiplier) as u64).min(90);
        
        info!("💽 Filling disk space: {}% in {} for {}ms", 
              actual_fill_percentage, target_path, duration);

        let temp_file = format!("{}/chaos_disk_fill_{}.tmp", 
                               target_path, 
                               SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs());

        // Create a temporary large file
        let file_size_mb = 100; // Start with 100MB
        let command_result = Command::new("dd")
            .arg("if=/dev/zero")
            .arg(&format!("of={}", temp_file))
            .arg(&format!("bs=1m"))
            .arg(&format!("count={}", file_size_mb))
            .output();

        let mut artifacts = Vec::new();

        match command_result {
            Ok(_) => {
                info!("💽 Created temporary file: {}", temp_file);
                artifacts.push(temp_file.clone());
                metrics.insert("disk_filled_mb".to_string(), file_size_mb as f64);
                
                // Hold for duration
                sleep(Duration::from_millis(duration)).await;
                
                // Clean up
                if let Err(e) = std::fs::remove_file(&temp_file) {
                    warn!("Failed to clean up temporary file {}: {}", temp_file, e);
                } else {
                    info!("💽 Cleaned up temporary file: {}", temp_file);
                    artifacts.clear(); // File was successfully cleaned up
                }
            },
            Err(e) => {
                warn!("Failed to create disk fill file: {}", e);
                // Simulate disk fill without actually creating file
                sleep(Duration::from_millis(duration)).await;
                metrics.insert("disk_fill_simulated".to_string(), 1.0);
            }
        }

        Ok(artifacts)
    }

    async fn execute_connection_drop(
        &self,
        target: &str,
        duration: u64,
        intensity: &str,
        parameters: &HashMap<String, serde_json::Value>,
        metrics: &mut HashMap<String, f64>,
    ) -> Result<()> {
        let drop_percentage = parameters.get("drop_percentage")
            .and_then(|v| v.as_u64())
            .unwrap_or(50);

        let intensity_multiplier = match intensity {
            "low" => 0.5,
            "medium" => 1.0,
            "high" => 2.0,
            _ => 1.0,
        };

        let actual_drop_percentage = ((drop_percentage as f64 * intensity_multiplier) as u64).min(90);
        
        info!("🔌 Dropping connections: {}% for {} ({}ms)", 
              actual_drop_percentage, target, duration);

        // In production, this would use:
        // - iptables to drop packets
        // - tc (traffic control) for packet manipulation
        // - Application-level connection dropping

        metrics.insert("connection_drop_percentage".to_string(), actual_drop_percentage as f64);
        
        let start_time = SystemTime::now();
        while start_time.elapsed()?.as_millis() < duration as u128 {
            sleep(Duration::from_millis(1000)).await;
            debug!("Connection drop active: {}% on {}", actual_drop_percentage, target);
        }

        info!("🔌 Connection drop simulation completed");
        
        Ok(())
    }
}