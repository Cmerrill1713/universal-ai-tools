use anyhow::{Context, Result};
use chrono::{DateTime, Utc, Timelike, Datelike};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::process::Command;
use std::time::{Duration, Instant};
use sysinfo::System;
use tracing::{debug, info, instrument};

use crate::config::ProactiveConfig;

/// Context monitor for system state tracking
#[derive(Clone)]
pub struct ContextMonitor {
    config: ProactiveConfig,
    client: Client,
    last_health_check: std::sync::Arc<std::sync::RwLock<Instant>>,
    system_info: std::sync::Arc<tokio::sync::RwLock<SystemSnapshot>>,
}

/// Snapshot of system state at a point in time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub timestamp: DateTime<Utc>,
    pub cpu_usage: f32,
    pub memory_usage: f32,
    pub memory_available: u64,
    pub memory_total: u64,
    pub disk_usage: HashMap<String, DiskInfo>,
    pub active_processes: Vec<ProcessInfo>,
    pub network_activity: NetworkInfo,
    pub user_activity: UserActivity,
    pub system_load: LoadInfo,
    pub battery_status: Option<BatteryInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub total_space: u64,
    pub available_space: u64,
    pub usage_percentage: f32,
    pub mount_point: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub start_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub bytes_received: u64,
    pub bytes_transmitted: u64,
    pub packets_received: u64,
    pub packets_transmitted: u64,
    pub active_connections: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserActivity {
    pub activity_level: String, // "active", "idle", "away", "locked"
    pub last_input_time: Option<DateTime<Utc>>,
    pub idle_duration: Option<Duration>,
    pub active_application: Option<String>,
    pub screen_locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadInfo {
    pub load_1min: f32,
    pub load_5min: f32,
    pub load_15min: f32,
    pub cpu_cores: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryInfo {
    pub percentage: f32,
    pub is_charging: bool,
    pub time_remaining: Option<Duration>,
    pub health: String,
}

/// Calendar and external context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalContext {
    pub calendar_events: Vec<CalendarEvent>,
    pub current_weather: Option<WeatherInfo>,
    pub time_context: TimeContext,
    pub location_context: Option<LocationInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub title: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub participants: Vec<String>,
    pub location: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherInfo {
    pub temperature: f32,
    pub condition: String,
    pub humidity: f32,
    pub location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeContext {
    pub time_of_day: String, // "morning", "afternoon", "evening", "night"
    pub day_of_week: String,
    pub is_weekend: bool,
    pub timezone: String,
    pub local_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationInfo {
    pub city: String,
    pub country: String,
    pub coordinates: (f64, f64),
}

impl ContextMonitor {
    pub async fn new(config: &ProactiveConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.server.timeout_seconds))
            .build()
            .context("Failed to create HTTP client")?;

        let initial_snapshot = SystemSnapshot::capture().await?;
        
        Ok(Self {
            config: config.clone(),
            client,
            last_health_check: std::sync::Arc::new(std::sync::RwLock::new(Instant::now())),
            system_info: std::sync::Arc::new(tokio::sync::RwLock::new(initial_snapshot)),
        })
    }

    /// Check if the context monitor is healthy
    pub async fn is_healthy(&self) -> bool {
        let last_check = {
            let guard = self.last_health_check.read().unwrap();
            *guard
        };
        
        // Consider healthy if we've updated within the last 2 minutes
        last_check.elapsed() < Duration::from_secs(120)
    }

    /// Get current system snapshot
    pub async fn get_current_snapshot(&self) -> SystemSnapshot {
        let snapshot = self.system_info.read().await;
        snapshot.clone()
    }

    /// Update system context with latest information
    #[instrument(skip(self))]
    pub async fn update_context(&self) -> Result<SystemSnapshot> {
        debug!("🔄 Updating system context");

        let snapshot = SystemSnapshot::capture().await?;
        
        {
            let mut system_info = self.system_info.write().await;
            *system_info = snapshot.clone();
        }

        // Update health check timestamp
        {
            let mut last_check = self.last_health_check.write().unwrap();
            *last_check = Instant::now();
        }

        info!("✅ System context updated - CPU: {:.1}%, Memory: {:.1}%", 
              snapshot.cpu_usage, snapshot.memory_usage);

        Ok(snapshot)
    }

    /// Get external context (calendar, weather, etc.)
    #[instrument(skip(self))]
    pub async fn get_external_context(&self) -> Result<ExternalContext> {
        let time_context = self.get_time_context();
        
        // TODO: Integrate with actual calendar and weather services
        let calendar_events = if self.config.integrations.calendar_integration {
            self.fetch_calendar_events().await.unwrap_or_default()
        } else {
            Vec::new()
        };

        Ok(ExternalContext {
            calendar_events,
            current_weather: None, // TODO: Implement weather integration
            time_context,
            location_context: None, // TODO: Implement location services
        })
    }

    /// Get time context information
    fn get_time_context(&self) -> TimeContext {
        let now = Utc::now();
        let hour = now.hour();
        
        let time_of_day = match hour {
            5..=11 => "morning",
            12..=17 => "afternoon",
            18..=22 => "evening",
            _ => "night",
        }.to_string();

        let day_of_week = now.format("%A").to_string();
        let is_weekend = matches!(now.weekday().num_days_from_monday(), 5 | 6);

        TimeContext {
            time_of_day,
            day_of_week,
            is_weekend,
            timezone: "UTC".to_string(), // TODO: Get actual timezone
            local_time: now,
        }
    }

    /// Fetch calendar events (placeholder implementation)
    async fn fetch_calendar_events(&self) -> Result<Vec<CalendarEvent>> {
        // TODO: Implement actual calendar integration
        // This could integrate with macOS Calendar, Google Calendar, etc.
        Ok(Vec::new())
    }

    /// Analyze system patterns and anomalies
    pub async fn analyze_patterns(&self) -> Result<Vec<SystemAlert>> {
        let snapshot = self.get_current_snapshot().await;
        let mut alerts = Vec::new();

        // Check for high CPU usage
        if snapshot.cpu_usage > 80.0 {
            alerts.push(SystemAlert {
                alert_type: "high_cpu_usage".to_string(),
                severity: AlertSeverity::Warning,
                message: format!("High CPU usage detected: {:.1}%", snapshot.cpu_usage),
                context: serde_json::json!({"cpu_usage": snapshot.cpu_usage}),
                timestamp: Utc::now(),
            });
        }

        // Check for high memory usage
        if snapshot.memory_usage > self.config.monitoring.memory_warning_threshold {
            alerts.push(SystemAlert {
                alert_type: "high_memory_usage".to_string(),
                severity: AlertSeverity::Warning,
                message: format!("High memory usage detected: {:.1}%", snapshot.memory_usage),
                context: serde_json::json!({"memory_usage": snapshot.memory_usage}),
                timestamp: Utc::now(),
            });
        }

        // Check for disk space issues
        for (mount_point, disk_info) in &snapshot.disk_usage {
            if disk_info.usage_percentage > 85.0 {
                alerts.push(SystemAlert {
                    alert_type: "low_disk_space".to_string(),
                    severity: AlertSeverity::Critical,
                    message: format!("Low disk space on {}: {:.1}% used", mount_point, disk_info.usage_percentage),
                    context: serde_json::json!({
                        "mount_point": mount_point,
                        "usage_percentage": disk_info.usage_percentage,
                        "available_space": disk_info.available_space
                    }),
                    timestamp: Utc::now(),
                });
            }
        }

        // Check for runaway processes
        for process in &snapshot.active_processes {
            if process.cpu_usage > 50.0 {
                alerts.push(SystemAlert {
                    alert_type: "high_process_cpu".to_string(),
                    severity: AlertSeverity::Info,
                    message: format!("Process {} using high CPU: {:.1}%", process.name, process.cpu_usage),
                    context: serde_json::json!({
                        "process_name": process.name,
                        "process_pid": process.pid,
                        "cpu_usage": process.cpu_usage
                    }),
                    timestamp: Utc::now(),
                });
            }
        }

        Ok(alerts)
    }
}

impl SystemSnapshot {
    /// Capture current system state
    pub async fn capture() -> Result<Self> {
        let mut system = System::new_all();
        system.refresh_all();

        // Get CPU usage  
        let cpu_usage = system.global_cpu_usage();

        // Get memory usage
        let memory_total = system.total_memory();
        let memory_used = system.used_memory();
        let memory_usage = (memory_used as f32 / memory_total as f32) * 100.0;

        // Get disk information (simplified for now)
        let mut disk_usage = HashMap::new();
        // TODO: Re-implement disk usage monitoring with updated sysinfo API
        disk_usage.insert("/".to_string(), DiskInfo {
            total_space: 1_000_000_000_000, // Placeholder
            available_space: 500_000_000_000, // Placeholder
            usage_percentage: 50.0, // Placeholder
            mount_point: "/".to_string(),
        });

        // Get active processes
        let active_processes: Vec<ProcessInfo> = system
            .processes()
            .values()
            .filter(|process| process.cpu_usage() > 0.5) // Processes using more than 0.5% CPU
            .take(20) // Limit to top 20 processes
            .map(|process| ProcessInfo {
                name: process.name().to_string_lossy().to_string(),
                pid: process.pid().as_u32(),
                cpu_usage: process.cpu_usage(),
                memory_usage: process.memory(),
                start_time: Utc::now(), // TODO: Get actual process start time
            })
            .collect();

        // Get user activity
        let user_activity = UserActivity::detect().await;

        // Get system load
        let load_info = LoadInfo::capture(&system);

        // Get battery info (macOS specific)
        let battery_status = BatteryInfo::get().await;

        Ok(Self {
            timestamp: Utc::now(),
            cpu_usage,
            memory_usage,
            memory_available: system.available_memory(),
            memory_total,
            disk_usage,
            active_processes,
            network_activity: NetworkInfo::capture(),
            user_activity,
            system_load: load_info,
            battery_status,
        })
    }
}

impl UserActivity {
    async fn detect() -> Self {
        // TODO: Implement proper user activity detection
        // This could use macOS APIs to detect user input, screen lock status, etc.
        
        Self {
            activity_level: "unknown".to_string(),
            last_input_time: None,
            idle_duration: None,
            active_application: Self::get_active_application().await,
            screen_locked: false,
        }
    }

    async fn get_active_application() -> Option<String> {
        // Try to get active application on macOS
        match Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get name of first application process whose frontmost is true")
            .output()
        {
            Ok(output) if output.status.success() => {
                let app_name = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .to_string();
                if !app_name.is_empty() {
                    Some(app_name)
                } else {
                    None
                }
            }
            _ => None,
        }
    }
}

impl LoadInfo {
    fn capture(system: &System) -> Self {
        // TODO: Implement proper system load detection
        // This might require platform-specific code
        Self {
            load_1min: 0.0,
            load_5min: 0.0,
            load_15min: 0.0,
            cpu_cores: system.cpus().len(),
        }
    }
}

impl NetworkInfo {
    fn capture() -> Self {
        // TODO: Implement network statistics gathering
        // This might require platform-specific code or additional libraries
        Self {
            bytes_received: 0,
            bytes_transmitted: 0,
            packets_received: 0,
            packets_transmitted: 0,
            active_connections: 0,
        }
    }
}

impl BatteryInfo {
    async fn get() -> Option<Self> {
        // Try to get battery info on macOS
        match Command::new("pmset")
            .arg("-g")
            .arg("batt")
            .output()
        {
            Ok(output) if output.status.success() => {
                let output_str = String::from_utf8_lossy(&output.stdout);
                // Parse pmset output to extract battery information
                // This is a simplified implementation
                if output_str.contains("%") {
                    Some(Self {
                        percentage: 50.0, // TODO: Parse actual percentage
                        is_charging: output_str.contains("AC Power"),
                        time_remaining: None,
                        health: "Good".to_string(),
                    })
                } else {
                    None
                }
            }
            _ => None,
        }
    }
}

/// System alert for monitoring anomalies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemAlert {
    pub alert_type: String,
    pub severity: AlertSeverity,
    pub message: String,
    pub context: Value,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ProactiveConfig;

    #[tokio::test]
    async fn test_context_monitor_creation() {
        let config = ProactiveConfig::default();
        let monitor = ContextMonitor::new(&config).await;
        assert!(monitor.is_ok());
    }

    #[tokio::test]
    async fn test_system_snapshot() {
        let snapshot = SystemSnapshot::capture().await;
        assert!(snapshot.is_ok());
        
        let snapshot = snapshot.unwrap();
        assert!(snapshot.cpu_usage >= 0.0);
        assert!(snapshot.memory_usage >= 0.0);
        assert!(!snapshot.disk_usage.is_empty());
    }

    #[tokio::test]
    async fn test_time_context() {
        let config = ProactiveConfig::default();
        let monitor = ContextMonitor::new(&config).await.unwrap();
        let time_context = monitor.get_time_context();
        
        assert!(!time_context.time_of_day.is_empty());
        assert!(!time_context.day_of_week.is_empty());
    }
}