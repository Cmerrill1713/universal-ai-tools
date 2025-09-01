use crate::routing::ServiceType;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time: f64,
    pub fastest_response_time: f64,
    pub slowest_response_time: f64,
    pub requests_per_second: f64,
    pub error_rate: f64,
    pub service_metrics: HashMap<String, ServiceMetrics>,
    pub routing_metrics: RoutingMetrics,
    pub load_balancing_metrics: LoadBalancingMetrics,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMetrics {
    pub requests: u64,
    pub successful_requests: u64,
    pub average_response_time: f64,
    pub error_rate: f64,
    pub current_load: u32,
    pub health_status: bool,
    pub total_tokens_processed: u64,
    pub average_tokens_per_request: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingMetrics {
    pub routing_decisions_made: u64,
    pub average_routing_time: f64,
    pub routing_accuracy: f64,
    pub fallback_decisions: u64,
    pub complexity_distribution: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBalancingMetrics {
    pub load_balanced_requests: u64,
    pub load_balancing_effectiveness: f64,
    pub service_distribution: HashMap<String, f64>,
    pub avoided_overloads: u64,
}

struct MetricRecord {
    service: ServiceType,
    response_time: Duration,
    success: bool,
    tokens_used: u32,
    was_routed: bool,
    was_load_balanced: bool,
    timestamp: Instant,
}

pub struct MetricsCollector {
    records: Arc<RwLock<Vec<MetricRecord>>>,
    start_time: Instant,
    routing_times: Arc<RwLock<Vec<Duration>>>,
    service_health: Arc<RwLock<HashMap<ServiceType, bool>>>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            records: Arc::new(RwLock::new(Vec::new())),
            start_time: Instant::now(),
            routing_times: Arc::new(RwLock::new(Vec::new())),
            service_health: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    pub fn record_request(
        &self,
        service: ServiceType,
        response_time: Duration,
        success: bool,
        tokens_used: u32,
        was_routed: bool,
        was_load_balanced: bool,
    ) {
        let record = MetricRecord {
            service,
            response_time,
            success,
            tokens_used,
            was_routed,
            was_load_balanced,
            timestamp: Instant::now(),
        };
        
        let mut records = self.records.write();
        records.push(record);
        
        // Keep only recent records (last 10,000)
        if records.len() > 10_000 {
            records.drain(..1_000); // Remove oldest 1,000
        }
        
        tracing::trace!(
            service = %service.as_str(),
            response_time_ms = %response_time.as_millis(),
            success = %success,
            tokens_used = %tokens_used,
            "Recorded request metrics"
        );
    }
    
    pub fn record_routing_time(&self, routing_time: Duration) {
        let mut times = self.routing_times.write();
        times.push(routing_time);
        
        // Keep only recent routing times
        if times.len() > 1_000 {
            times.drain(..100);
        }
    }
    
    pub fn update_service_health(&self, service: ServiceType, is_healthy: bool) {
        let mut health = self.service_health.write();
        health.insert(service, is_healthy);
    }
    
    pub fn get_performance_metrics(&self) -> PerformanceMetrics {
        let records = self.records.read();
        let routing_times = self.routing_times.read();
        let service_health = self.service_health.read();
        
        let total_requests = records.len() as u64;
        let successful_requests = records.iter().filter(|r| r.success).count() as u64;
        let failed_requests = total_requests - successful_requests;
        
        let error_rate = if total_requests > 0 {
            failed_requests as f64 / total_requests as f64
        } else {
            0.0
        };
        
        // Calculate response time statistics
        let response_times: Vec<f64> = records.iter()
            .map(|r| r.response_time.as_millis() as f64)
            .collect();
        
        let average_response_time = if !response_times.is_empty() {
            response_times.iter().sum::<f64>() / response_times.len() as f64
        } else {
            0.0
        };
        
        let fastest_response_time = response_times.iter()
            .fold(f64::INFINITY, |a, &b| a.min(b));
        let slowest_response_time = response_times.iter()
            .fold(0.0, |a, &b| a.max(b));
        
        // Calculate requests per second
        let elapsed_seconds = self.start_time.elapsed().as_secs_f64();
        let requests_per_second = if elapsed_seconds > 0.0 {
            total_requests as f64 / elapsed_seconds
        } else {
            0.0
        };
        
        // Calculate service metrics
        let mut service_metrics = HashMap::new();
        
        // Group records by service
        let mut service_records: HashMap<ServiceType, Vec<&MetricRecord>> = HashMap::new();
        for record in records.iter() {
            service_records.entry(record.service.clone()).or_insert_with(Vec::new).push(record);
        }
        
        for (service, service_records) in service_records {
            let service_total = service_records.len() as u64;
            let service_successful = service_records.iter()
                .filter(|r| r.success)
                .count() as u64;
            
            let service_error_rate = if service_total > 0 {
                (service_total - service_successful) as f64 / service_total as f64
            } else {
                0.0
            };
            
            let service_avg_response_time = if !service_records.is_empty() {
                service_records.iter()
                    .map(|r| r.response_time.as_millis() as f64)
                    .sum::<f64>() / service_records.len() as f64
            } else {
                0.0
            };
            
            let total_tokens = service_records.iter()
                .map(|r| r.tokens_used as u64)
                .sum::<u64>();
            
            let avg_tokens_per_request = if service_total > 0 {
                total_tokens as f64 / service_total as f64
            } else {
                0.0
            };
            
            let health_status = service_health.get(&service).copied().unwrap_or(true);
            
            service_metrics.insert(service.as_str().to_string(), ServiceMetrics {
                requests: service_total,
                successful_requests: service_successful,
                average_response_time: service_avg_response_time,
                error_rate: service_error_rate,
                current_load: 0, // Would be updated by load balancer
                health_status,
                total_tokens_processed: total_tokens,
                average_tokens_per_request: avg_tokens_per_request,
            });
        }
        
        // Calculate routing metrics
        let routing_decisions_made = records.iter().filter(|r| r.was_routed).count() as u64;
        let fallback_decisions = 0; // Would track from routing engine
        
        let average_routing_time = if !routing_times.is_empty() {
            routing_times.iter()
                .map(|d| d.as_millis() as f64)
                .sum::<f64>() / routing_times.len() as f64
        } else {
            0.0
        };
        
        // Complexity distribution (would be tracked from routing decisions)
        let mut complexity_distribution = HashMap::new();
        complexity_distribution.insert("simple".to_string(), 0);
        complexity_distribution.insert("medium".to_string(), 0);
        complexity_distribution.insert("complex".to_string(), 0);
        
        let routing_metrics = RoutingMetrics {
            routing_decisions_made,
            average_routing_time,
            routing_accuracy: 0.85, // Would calculate based on routing success
            fallback_decisions,
            complexity_distribution,
        };
        
        // Calculate load balancing metrics
        let load_balanced_requests = records.iter()
            .filter(|r| r.was_load_balanced)
            .count() as u64;
        
        let load_balancing_effectiveness = if total_requests > 0 {
            load_balanced_requests as f64 / total_requests as f64
        } else {
            0.0
        };
        
        // Service distribution
        let mut service_distribution = HashMap::new();
        for (service, service_records) in &service_records {
            let percentage = if total_requests > 0 {
                service_records.len() as f64 / total_requests as f64 * 100.0
            } else {
                0.0
            };
            service_distribution.insert(service.as_str().to_string(), percentage);
        }
        
        let load_balancing_metrics = LoadBalancingMetrics {
            load_balanced_requests,
            load_balancing_effectiveness,
            service_distribution,
            avoided_overloads: 0, // Would track from load balancer
        };
        
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        
        PerformanceMetrics {
            total_requests,
            successful_requests,
            failed_requests,
            average_response_time,
            fastest_response_time: if fastest_response_time.is_infinite() { 0.0 } else { fastest_response_time },
            slowest_response_time,
            requests_per_second,
            error_rate,
            service_metrics,
            routing_metrics,
            load_balancing_metrics,
            timestamp,
        }
    }
    
    pub fn get_service_performance_comparison(&self) -> HashMap<String, ServicePerformanceComparison> {
        let records = self.records.read();
        let mut comparisons = HashMap::new();
        
        // Group records by service
        let mut service_records: HashMap<ServiceType, Vec<&MetricRecord>> = HashMap::new();
        for record in records.iter() {
            service_records.entry(record.service.clone()).or_insert_with(Vec::new).push(record);
        }
        
        // Calculate performance comparison for each service
        for (service, service_records) in service_records {
            let total_requests = service_records.len();
            let successful_requests = service_records.iter().filter(|r| r.success).count();
            
            let response_times: Vec<f64> = service_records.iter()
                .map(|r| r.response_time.as_millis() as f64)
                .collect();
            
            let avg_response_time = if !response_times.is_empty() {
                response_times.iter().sum::<f64>() / response_times.len() as f64
            } else {
                0.0
            };
            
            // Calculate percentiles
            let mut sorted_times = response_times.clone();
            sorted_times.sort_by(|a, b| a.partial_cmp(b).unwrap());
            
            let p50 = percentile(&sorted_times, 0.5);
            let p95 = percentile(&sorted_times, 0.95);
            let p99 = percentile(&sorted_times, 0.99);
            
            let success_rate = if total_requests > 0 {
                successful_requests as f64 / total_requests as f64
            } else {
                0.0
            };
            
            let total_tokens = service_records.iter()
                .map(|r| r.tokens_used as u64)
                .sum::<u64>();
            
            comparisons.insert(service.as_str().to_string(), ServicePerformanceComparison {
                service_name: service.as_str().to_string(),
                total_requests: total_requests as u64,
                success_rate,
                average_response_time: avg_response_time,
                p50_response_time: p50,
                p95_response_time: p95,
                p99_response_time: p99,
                total_tokens_processed: total_tokens,
                tokens_per_second: if avg_response_time > 0.0 {
                    total_tokens as f64 / (avg_response_time / 1000.0)
                } else {
                    0.0
                },
            });
        }
        
        comparisons
    }
    
    pub fn reset_metrics(&self) {
        let mut records = self.records.write();
        records.clear();
        
        let mut routing_times = self.routing_times.write();
        routing_times.clear();
        
        tracing::info!("Performance metrics reset");
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServicePerformanceComparison {
    pub service_name: String,
    pub total_requests: u64,
    pub success_rate: f64,
    pub average_response_time: f64,
    pub p50_response_time: f64,
    pub p95_response_time: f64,
    pub p99_response_time: f64,
    pub total_tokens_processed: u64,
    pub tokens_per_second: f64,
}

fn percentile(sorted_data: &[f64], p: f64) -> f64 {
    if sorted_data.is_empty() {
        return 0.0;
    }
    
    if p <= 0.0 {
        return sorted_data[0];
    }
    if p >= 1.0 {
        return sorted_data[sorted_data.len() - 1];
    }
    
    let index = p * (sorted_data.len() - 1) as f64;
    let lower_index = index.floor() as usize;
    let upper_index = index.ceil() as usize;
    
    if lower_index == upper_index {
        sorted_data[lower_index]
    } else {
        let weight = index - lower_index as f64;
        sorted_data[lower_index] * (1.0 - weight) + sorted_data[upper_index] * weight
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}