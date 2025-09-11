//! Metrics tracking for ReVeal Evolution Service

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, Duration};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

/// Evolution metrics tracker
#[derive(Debug)]
pub struct EvolutionMetrics {
    pub total_evolutions: AtomicU64,
    total_turns: AtomicU64,
    total_confidence: AtomicU64, // Stored as fixed-point (confidence * 1000)
    successful_evolutions: AtomicU64,
    failed_evolutions: AtomicU64,
    start_time: SystemTime,
}

impl EvolutionMetrics {
    pub fn new() -> Self {
        Self {
            total_evolutions: AtomicU64::new(0),
            total_turns: AtomicU64::new(0),
            total_confidence: AtomicU64::new(0),
            successful_evolutions: AtomicU64::new(0),
            failed_evolutions: AtomicU64::new(0),
            start_time: SystemTime::now(),
        }
    }
    
    pub fn record_evolution(&self, turns: u32, confidence: f64, success: bool) {
        self.total_evolutions.fetch_add(1, Ordering::Relaxed);
        self.total_turns.fetch_add(turns as u64, Ordering::Relaxed);
        self.total_confidence.fetch_add((confidence * 1000.0) as u64, Ordering::Relaxed);
        
        if success {
            self.successful_evolutions.fetch_add(1, Ordering::Relaxed);
        } else {
            self.failed_evolutions.fetch_add(1, Ordering::Relaxed);
        }
    }
    
    pub fn total_evolutions(&self) -> u64 {
        self.total_evolutions.load(Ordering::Relaxed)
    }
    
    pub fn average_turns(&self) -> f64 {
        let total = self.total_evolutions.load(Ordering::Relaxed);
        if total == 0 {
            0.0
        } else {
            self.total_turns.load(Ordering::Relaxed) as f64 / total as f64
        }
    }
    
    pub fn average_confidence(&self) -> f64 {
        let total = self.total_evolutions.load(Ordering::Relaxed);
        if total == 0 {
            0.0
        } else {
            self.total_confidence.load(Ordering::Relaxed) as f64 / (total as f64 * 1000.0)
        }
    }
    
    pub fn success_rate(&self) -> f64 {
        let total = self.total_evolutions.load(Ordering::Relaxed);
        if total == 0 {
            0.0
        } else {
            self.successful_evolutions.load(Ordering::Relaxed) as f64 / total as f64
        }
    }
    
    pub fn uptime(&self) -> Duration {
        SystemTime::now().duration_since(self.start_time).unwrap_or_default()
    }
}

impl Default for EvolutionMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Co-evolution metrics for tracking generation and verification quality
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoEvolutionMetrics {
    pub generation_quality: f64,
    pub verification_quality: f64,
    pub co_evolution_score: f64,
    pub improvement_rate: f64,
    pub convergence_indicator: f64,
}

impl CoEvolutionMetrics {
    pub fn new() -> Self {
        Self {
            generation_quality: 0.0,
            verification_quality: 0.0,
            co_evolution_score: 0.0,
            improvement_rate: 0.0,
            convergence_indicator: 0.0,
        }
    }
    
    pub fn update(&mut self, generation_quality: f64, verification_quality: f64) {
        self.generation_quality = generation_quality;
        self.verification_quality = verification_quality;
        
        // Calculate co-evolution score as geometric mean
        self.co_evolution_score = (generation_quality * verification_quality).sqrt();
        
        // Simple improvement rate calculation
        self.improvement_rate = (generation_quality + verification_quality) / 2.0;
        
        // Convergence indicator - higher when both qualities are balanced
        let quality_diff = (generation_quality - verification_quality).abs();
        self.convergence_indicator = 1.0 - (quality_diff / 2.0).min(1.0);
    }
}

impl Default for CoEvolutionMetrics {
    fn default() -> Self {
        Self::new()
    }
}