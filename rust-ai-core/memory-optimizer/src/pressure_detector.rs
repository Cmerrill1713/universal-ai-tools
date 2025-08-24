//! Memory pressure detection and analysis

use crate::{monitor::SystemMemoryInfo, PressureThresholds};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use tracing::{debug, instrument};

/// Memory pressure levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryPressureLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl MemoryPressureLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryPressureLevel::Low => "low",
            MemoryPressureLevel::Medium => "medium", 
            MemoryPressureLevel::High => "high",
            MemoryPressureLevel::Critical => "critical",
        }
    }

    pub fn severity_score(&self) -> u8 {
        match self {
            MemoryPressureLevel::Low => 1,
            MemoryPressureLevel::Medium => 2,
            MemoryPressureLevel::High => 3,
            MemoryPressureLevel::Critical => 4,
        }
    }
}

/// Memory pressure detector
pub struct PressureDetector {
    thresholds: PressureThresholds,
    history: Vec<PressureReading>,
    max_history: usize,
}

/// Individual pressure reading
#[derive(Debug, Clone, Serialize)]
pub struct PressureReading {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub level: MemoryPressureLevel,
    pub usage_percent: f64,
    pub available_mb: u64,
    pub swap_usage_percent: f64,
    pub factors: Vec<PressureFactor>,
}

/// Factors contributing to memory pressure
#[derive(Debug, Clone, Serialize)]
pub struct PressureFactor {
    pub name: String,
    pub severity: f64, // 0.0 to 1.0
    pub description: String,
}

impl PressureDetector {
    /// Create a new pressure detector
    pub fn new(thresholds: PressureThresholds) -> Result<Self> {
        Ok(Self {
            thresholds,
            history: Vec::new(),
            max_history: 100,
        })
    }

    /// Detect current memory pressure level
    #[instrument(skip(self, memory_info))]
    pub async fn detect_pressure(&mut self, memory_info: &SystemMemoryInfo) -> Result<MemoryPressureLevel> {
        let usage_percent = memory_info.usage_percent;
        let swap_usage_percent = if memory_info.swap_total_mb > 0 {
            (memory_info.swap_used_mb as f64 / memory_info.swap_total_mb as f64) * 100.0
        } else {
            0.0
        };

        // Determine base pressure level from memory usage
        let base_level = if usage_percent >= self.thresholds.critical_threshold_percent {
            MemoryPressureLevel::Critical
        } else if usage_percent >= self.thresholds.high_threshold_percent {
            MemoryPressureLevel::High
        } else if usage_percent >= self.thresholds.medium_threshold_percent {
            MemoryPressureLevel::Medium
        } else {
            MemoryPressureLevel::Low
        };

        // Analyze contributing factors
        let factors = self.analyze_pressure_factors(memory_info).await?;
        
        // Adjust level based on factors
        let adjusted_level = self.adjust_pressure_level(base_level, &factors);

        // Record the reading
        let reading = PressureReading {
            timestamp: chrono::Utc::now(),
            level: adjusted_level,
            usage_percent,
            available_mb: memory_info.available_mb,
            swap_usage_percent,
            factors,
        };

        self.add_reading(reading);

        debug!(
            level = ?adjusted_level,
            usage_percent = usage_percent,
            available_mb = memory_info.available_mb,
            "Memory pressure detected"
        );

        Ok(adjusted_level)
    }

    /// Analyze factors contributing to memory pressure
    async fn analyze_pressure_factors(&self, memory_info: &SystemMemoryInfo) -> Result<Vec<PressureFactor>> {
        let mut factors = Vec::new();

        // High memory usage factor
        if memory_info.usage_percent > 80.0 {
            let severity = ((memory_info.usage_percent - 80.0) / 20.0).min(1.0);
            factors.push(PressureFactor {
                name: "high_memory_usage".to_string(),
                severity,
                description: format!("Memory usage at {:.1}%", memory_info.usage_percent),
            });
        }

        // Low available memory factor
        let available_percent = (memory_info.available_mb as f64 / memory_info.total_mb as f64) * 100.0;
        if available_percent < 20.0 {
            let severity = (20.0 - available_percent) / 20.0;
            factors.push(PressureFactor {
                name: "low_available_memory".to_string(),
                severity,
                description: format!("Only {:.1}% memory available", available_percent),
            });
        }

        // Swap usage factor
        if memory_info.swap_used_mb > 0 && memory_info.swap_total_mb > 0 {
            let swap_percent = (memory_info.swap_used_mb as f64 / memory_info.swap_total_mb as f64) * 100.0;
            if swap_percent > 10.0 {
                let severity = (swap_percent / 100.0).min(1.0);
                factors.push(PressureFactor {
                    name: "swap_usage".to_string(),
                    severity,
                    description: format!("Swap usage at {:.1}%", swap_percent),
                });
            }
        }

        // Process memory factor (if process is using too much memory)
        let process_percent = (memory_info.process_memory_mb as f64 / memory_info.total_mb as f64) * 100.0;
        if process_percent > 25.0 {
            let severity = ((process_percent - 25.0) / 50.0).min(1.0);
            factors.push(PressureFactor {
                name: "high_process_memory".to_string(),
                severity,
                description: format!("Process using {:.1}% of total memory", process_percent),
            });
        }

        // Memory fragmentation factor (estimated)
        let fragmentation_ratio = if memory_info.available_mb > 0 {
            memory_info.free_mb as f64 / memory_info.available_mb as f64
        } else {
            1.0
        };
        
        if fragmentation_ratio < 0.8 {
            let severity = (0.8 - fragmentation_ratio) / 0.8;
            factors.push(PressureFactor {
                name: "memory_fragmentation".to_string(),
                severity,
                description: "Memory appears fragmented".to_string(),
            });
        }

        Ok(factors)
    }

    /// Adjust pressure level based on contributing factors
    fn adjust_pressure_level(&self, base_level: MemoryPressureLevel, factors: &[PressureFactor]) -> MemoryPressureLevel {
        let base_score = base_level.severity_score();
        
        // Calculate adjustment based on factor severity
        let total_factor_severity: f64 = factors.iter().map(|f| f.severity).sum();
        let factor_adjustment = (total_factor_severity / 2.0).min(1.0); // Max +1 level adjustment

        let adjusted_score = base_score as f64 + factor_adjustment;
        
        if adjusted_score >= 4.0 {
            MemoryPressureLevel::Critical
        } else if adjusted_score >= 3.0 {
            MemoryPressureLevel::High
        } else if adjusted_score >= 2.0 {
            MemoryPressureLevel::Medium
        } else {
            MemoryPressureLevel::Low
        }
    }

    /// Add a pressure reading to history
    fn add_reading(&mut self, reading: PressureReading) {
        self.history.push(reading);
        
        // Trim history to max size
        if self.history.len() > self.max_history {
            self.history.remove(0);
        }
    }

    /// Get pressure trend over time
    pub fn get_pressure_trend(&self, minutes: u32) -> PressureTrend {
        let cutoff_time = chrono::Utc::now() - chrono::Duration::minutes(minutes as i64);
        
        let recent_readings: Vec<_> = self.history
            .iter()
            .filter(|r| r.timestamp >= cutoff_time)
            .collect();

        if recent_readings.len() < 2 {
            return PressureTrend::Stable;
        }

        let first_half = &recent_readings[..recent_readings.len() / 2];
        let second_half = &recent_readings[recent_readings.len() / 2..];

        let first_avg = first_half.iter().map(|r| r.level.severity_score()).sum::<u8>() as f64 / first_half.len() as f64;
        let second_avg = second_half.iter().map(|r| r.level.severity_score()).sum::<u8>() as f64 / second_half.len() as f64;

        let diff = second_avg - first_avg;
        
        if diff > 0.5 {
            PressureTrend::Increasing
        } else if diff < -0.5 {
            PressureTrend::Decreasing
        } else {
            PressureTrend::Stable
        }
    }

    /// Get recent pressure readings
    pub fn get_recent_readings(&self, count: usize) -> Vec<&PressureReading> {
        let start = if self.history.len() > count {
            self.history.len() - count
        } else {
            0
        };
        
        self.history[start..].iter().collect()
    }

    /// Check if pressure is persistently high
    pub fn is_persistently_high(&self, minutes: u32, min_level: MemoryPressureLevel) -> bool {
        let cutoff_time = chrono::Utc::now() - chrono::Duration::minutes(minutes as i64);
        
        let recent_readings: Vec<_> = self.history
            .iter()
            .filter(|r| r.timestamp >= cutoff_time)
            .collect();

        if recent_readings.len() < 3 {
            return false;
        }

        // Check if most recent readings are at or above the minimum level
        recent_readings.iter()
            .all(|r| r.level.severity_score() >= min_level.severity_score())
    }
}

/// Memory pressure trend
#[derive(Debug, Clone, Serialize)]
pub enum PressureTrend {
    Increasing,
    Stable, 
    Decreasing,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_thresholds() -> PressureThresholds {
        PressureThresholds {
            low_threshold_percent: 50.0,
            medium_threshold_percent: 70.0,
            high_threshold_percent: 85.0,
            critical_threshold_percent: 95.0,
        }
    }

    fn create_test_memory_info(usage_percent: f64) -> SystemMemoryInfo {
        let total_mb = 8192;
        let used_mb = (total_mb as f64 * usage_percent / 100.0) as u64;
        
        SystemMemoryInfo {
            total_mb,
            available_mb: total_mb - used_mb,
            used_mb,
            free_mb: total_mb - used_mb,
            usage_percent,
            swap_total_mb: 2048,
            swap_used_mb: 0,
            process_memory_mb: 256,
            timestamp: chrono::Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_pressure_detection() {
        let thresholds = create_test_thresholds();
        let mut detector = PressureDetector::new(thresholds).unwrap();

        // Test low pressure
        let memory_info = create_test_memory_info(40.0);
        let level = detector.detect_pressure(&memory_info).await.unwrap();
        assert_eq!(level, MemoryPressureLevel::Low);

        // Test high pressure
        let memory_info = create_test_memory_info(90.0);
        let level = detector.detect_pressure(&memory_info).await.unwrap();
        assert_eq!(level, MemoryPressureLevel::High);

        // Test critical pressure
        let memory_info = create_test_memory_info(98.0);
        let level = detector.detect_pressure(&memory_info).await.unwrap();
        assert_eq!(level, MemoryPressureLevel::Critical);
    }

    #[tokio::test]
    async fn test_pressure_factors() {
        let thresholds = create_test_thresholds();
        let mut detector = PressureDetector::new(thresholds).unwrap();

        // High usage should create factors
        let memory_info = create_test_memory_info(90.0);
        detector.detect_pressure(&memory_info).await.unwrap();

        let readings = detector.get_recent_readings(1);
        assert!(!readings.is_empty());
        assert!(!readings[0].factors.is_empty());
    }

    #[test]
    fn test_pressure_level_severity() {
        assert_eq!(MemoryPressureLevel::Low.severity_score(), 1);
        assert_eq!(MemoryPressureLevel::Medium.severity_score(), 2);
        assert_eq!(MemoryPressureLevel::High.severity_score(), 3);
        assert_eq!(MemoryPressureLevel::Critical.severity_score(), 4);
    }
}