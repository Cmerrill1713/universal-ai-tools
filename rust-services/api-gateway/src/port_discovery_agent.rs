use serde::{Deserialize, Serialize};
use std::collections::{HashMap, BTreeSet};
use std::net::TcpListener;
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};
use anyhow::Result;
use tracing::{info, warn, debug};
use crate::ServiceInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortDiscoveryAgent {
    known_services: HashMap<String, ServicePortInfo>,
    port_usage_history: HashMap<u16, PortUsageHistory>,
    auto_port_range: (u16, u16),
    reserved_ports: BTreeSet<u16>,
    optimization_recommendations: Vec<PortOptimizationRecommendation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServicePortInfo {
    pub service_name: String,
    pub current_port: u16,
    pub preferred_port_range: (u16, u16),
    pub port_history: Vec<PortChange>,
    pub health_on_port: f64,
    pub load_score: f64,
    pub last_port_change: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortChange {
    pub from_port: Option<u16>,
    pub to_port: u16,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub reason: PortChangeReason,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PortChangeReason {
    Conflict,
    Optimization,
    ServiceRestart,
    LoadBalancing,
    SecurityPatch,
    AutoDiscovery,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortUsageHistory {
    pub port: u16,
    pub current_service: Option<String>,
    pub usage_frequency: u32,
    pub conflict_history: u32,
    pub performance_score: f64,
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortOptimizationRecommendation {
    pub service_name: String,
    pub current_port: u16,
    pub recommended_port: u16,
    pub reason: String,
    pub expected_improvement: f64,
    pub confidence: f64,
    pub priority: PortOptimizationPriority,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum PortOptimizationPriority {
    Low,
    Medium, 
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortDiscoveryConfig {
    pub scan_interval_seconds: u64,
    pub auto_port_min: u16,
    pub auto_port_max: u16,
    pub reserved_system_ports: Vec<u16>,
    pub enable_conflict_prevention: bool,
    pub enable_load_balancing: bool,
    pub performance_threshold: f64,
}

impl Default for PortDiscoveryConfig {
    fn default() -> Self {
        Self {
            scan_interval_seconds: 60,  // Scan every minute
            auto_port_min: 8080,       // Start of auto port range
            auto_port_max: 9000,       // End of auto port range
            reserved_system_ports: vec![
                80, 443, 22, 21, 25, 53, 110, 995, 993, 143, 
                3306, 5432, 6379, 27017  // Common database ports
            ],
            enable_conflict_prevention: true,
            enable_load_balancing: true,
            performance_threshold: 0.8,
        }
    }
}

impl PortDiscoveryAgent {
    pub async fn new(config: PortDiscoveryConfig) -> Result<Self> {
        let mut reserved_ports = BTreeSet::new();
        for port in config.reserved_system_ports {
            reserved_ports.insert(port);
        }

        Ok(Self {
            known_services: HashMap::new(),
            port_usage_history: HashMap::new(),
            auto_port_range: (config.auto_port_min, config.auto_port_max),
            reserved_ports,
            optimization_recommendations: Vec::new(),
        })
    }

    /// Discover available ports in the auto-port range
    pub async fn discover_available_ports(&self, count: u16) -> Result<Vec<u16>> {
        let mut available_ports = Vec::new();
        let (min_port, max_port) = self.auto_port_range;

        for port in min_port..=max_port {
            if self.reserved_ports.contains(&port) {
                continue;
            }

            if self.is_port_available(port).await? {
                available_ports.push(port);
                if available_ports.len() >= count as usize {
                    break;
                }
            }
        }

        debug!("Discovered {} available ports in range {}-{}", 
               available_ports.len(), min_port, max_port);
        Ok(available_ports)
    }

    /// Check if a specific port is available
    pub async fn is_port_available(&self, port: u16) -> Result<bool> {
        // Try to bind to the port - if successful, it's available
        match TcpListener::bind(("127.0.0.1", port)) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Register a service with its current port
    pub async fn register_service(&mut self, service: &ServiceInfo) -> Result<()> {
        let service_port_info = ServicePortInfo {
            service_name: service.name.clone(),
            current_port: service.port,
            preferred_port_range: self.auto_port_range,
            port_history: vec![PortChange {
                from_port: None,
                to_port: service.port,
                timestamp: chrono::Utc::now(),
                reason: PortChangeReason::AutoDiscovery,
                success: true,
            }],
            health_on_port: 1.0, // Start with perfect health
            load_score: service.load_score,
            last_port_change: Some(chrono::Utc::now()),
        };

        self.known_services.insert(service.name.clone(), service_port_info);
        
        // Update port usage history
        let usage_history = self.port_usage_history
            .entry(service.port)
            .or_insert_with(|| PortUsageHistory {
                port: service.port,
                current_service: None,
                usage_frequency: 0,
                conflict_history: 0,
                performance_score: 1.0,
                last_used: None,
            });

        usage_history.current_service = Some(service.name.clone());
        usage_history.usage_frequency += 1;
        usage_history.last_used = Some(chrono::Utc::now());

        info!("Registered service {} on port {}", service.name, service.port);
        Ok(())
    }

    /// Suggest optimal port for a new service
    pub async fn suggest_optimal_port(&self, service_name: &str) -> Result<u16> {
        let available_ports = self.discover_available_ports(10).await?;
        
        if available_ports.is_empty() {
            return Err(anyhow::anyhow!("No available ports in range"));
        }

        // Find the best port based on history and performance
        let mut best_port = available_ports[0];
        let mut best_score = 0.0;

        for &port in &available_ports {
            let score = self.calculate_port_score(port).await;
            if score > best_score {
                best_score = score;
                best_port = port;
            }
        }

        info!("Suggested optimal port {} for service {} (score: {:.2})", 
              best_port, service_name, best_score);
        Ok(best_port)
    }

    /// Calculate a score for how good a port is for assignment
    async fn calculate_port_score(&self, port: u16) -> f64 {
        let mut score = 1.0;

        // Check port usage history
        if let Some(history) = self.port_usage_history.get(&port) {
            // Lower score for ports with conflict history
            score -= (history.conflict_history as f64) * 0.1;
            
            // Higher score for ports with good performance
            score += history.performance_score * 0.2;
            
            // Lower score for frequently used ports (spread load)
            score -= (history.usage_frequency as f64) * 0.05;
        }

        // Prefer ports in the middle of the range (avoid edge cases)
        let (min_port, max_port) = self.auto_port_range;
        let range_size = max_port - min_port;
        let port_position = (port - min_port) as f64 / range_size as f64;
        let distance_from_middle = (port_position - 0.5).abs();
        score += (1.0 - distance_from_middle) * 0.1;

        score.max(0.0)
    }

    /// Detect port conflicts across all services
    pub async fn detect_port_conflicts(&self) -> Result<Vec<PortConflict>> {
        let mut conflicts = Vec::new();
        let mut port_to_services: HashMap<u16, Vec<String>> = HashMap::new();

        // Group services by port
        for (service_name, service_info) in &self.known_services {
            port_to_services
                .entry(service_info.current_port)
                .or_default()
                .push(service_name.clone());
        }

        // Find conflicts (multiple services on same port)
        for (port, services) in port_to_services {
            if services.len() > 1 {
                conflicts.push(PortConflict {
                    port,
                    conflicting_services: services,
                    detected_at: chrono::Utc::now(),
                    severity: ConflictSeverity::High,
                });
            }
        }

        if !conflicts.is_empty() {
            warn!("Detected {} port conflicts", conflicts.len());
        }

        Ok(conflicts)
    }

    /// Generate port optimization recommendations
    pub async fn generate_optimization_recommendations(&mut self) -> Result<Vec<PortOptimizationRecommendation>> {
        let mut recommendations = Vec::new();

        // Check for underperforming services
        for (service_name, service_info) in &self.known_services {
            if service_info.health_on_port < 0.8 {
                if let Ok(optimal_port) = self.suggest_optimal_port(service_name).await {
                    let expected_improvement = 0.9 - service_info.health_on_port;
                    
                    recommendations.push(PortOptimizationRecommendation {
                        service_name: service_name.clone(),
                        current_port: service_info.current_port,
                        recommended_port: optimal_port,
                        reason: format!("Service health on port {} is low ({:.1}%)", 
                                      service_info.current_port, 
                                      service_info.health_on_port * 100.0),
                        expected_improvement,
                        confidence: 0.8,
                        priority: if service_info.health_on_port < 0.5 {
                            PortOptimizationPriority::Critical
                        } else {
                            PortOptimizationPriority::High
                        },
                    });
                }
            }
        }

        // Check for load balancing opportunities
        let high_load_services: Vec<_> = self.known_services.iter()
            .filter(|(_, info)| info.load_score > 0.8)
            .collect();

        for (service_name, service_info) in high_load_services {
            if let Ok(optimal_port) = self.suggest_optimal_port(service_name).await {
                recommendations.push(PortOptimizationRecommendation {
                    service_name: service_name.clone(),
                    current_port: service_info.current_port,
                    recommended_port: optimal_port,
                    reason: format!("High load ({:.1}%) - consider port optimization", 
                                  service_info.load_score * 100.0),
                    expected_improvement: 0.2,
                    confidence: 0.6,
                    priority: PortOptimizationPriority::Medium,
                });
            }
        }

        self.optimization_recommendations = recommendations.clone();
        
        if !recommendations.is_empty() {
            info!("Generated {} port optimization recommendations", recommendations.len());
        }

        Ok(recommendations)
    }

    /// Update service health and performance metrics
    pub async fn update_service_metrics(&mut self, service_name: &str, health_score: f64, load_score: f64) -> Result<()> {
        if let Some(service_info) = self.known_services.get_mut(service_name) {
            service_info.health_on_port = health_score;
            service_info.load_score = load_score;

            // Update port usage history
            if let Some(usage_history) = self.port_usage_history.get_mut(&service_info.current_port) {
                // Calculate performance score as weighted average
                usage_history.performance_score = 
                    (usage_history.performance_score * 0.8) + (health_score * 0.2);
            }

            debug!("Updated metrics for service {}: health={:.2}, load={:.2}", 
                   service_name, health_score, load_score);
        }

        Ok(())
    }

    /// Get comprehensive port discovery status
    pub async fn get_port_discovery_status(&self) -> Result<PortDiscoveryStatus> {
        let available_ports = self.discover_available_ports(50).await?;
        let conflicts = self.detect_port_conflicts().await?;
        
        let total_services = self.known_services.len();
        let healthy_services = self.known_services.values()
            .filter(|s| s.health_on_port > 0.8)
            .count();

        Ok(PortDiscoveryStatus {
            total_services: total_services as u32,
            healthy_services: healthy_services as u32,
            available_ports: available_ports.len() as u32,
            port_conflicts: conflicts.len() as u32,
            auto_port_range: self.auto_port_range,
            optimization_recommendations: self.optimization_recommendations.len() as u32,
            last_discovery_scan: chrono::Utc::now(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortConflict {
    pub port: u16,
    pub conflicting_services: Vec<String>,
    pub detected_at: chrono::DateTime<chrono::Utc>,
    pub severity: ConflictSeverity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConflictSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortDiscoveryStatus {
    pub total_services: u32,
    pub healthy_services: u32,
    pub available_ports: u32,
    pub port_conflicts: u32,
    pub auto_port_range: (u16, u16),
    pub optimization_recommendations: u32,
    pub last_discovery_scan: chrono::DateTime<chrono::Utc>,
}

/// Check if a port can be reached (service is responding)
pub async fn check_port_connectivity(host: &str, port: u16, timeout_ms: u64) -> bool {
    let addr = format!("{}:{}", host, port);
    let timeout_duration = Duration::from_millis(timeout_ms);
    
    match timeout(timeout_duration, TcpStream::connect(&addr)).await {
        Ok(Ok(_)) => true,
        Ok(Err(_)) | Err(_) => false,
    }
}

/// Get system port usage statistics
pub async fn get_system_port_usage() -> Result<SystemPortUsage> {
    // This would integrate with system tools like `netstat` or `/proc/net/tcp`
    // For now, return basic statistics
    Ok(SystemPortUsage {
        total_open_ports: 0, // Would be filled by actual system scan
        listening_ports: Vec::new(),
        established_connections: 0,
        scan_timestamp: chrono::Utc::now(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemPortUsage {
    pub total_open_ports: u32,
    pub listening_ports: Vec<u16>,
    pub established_connections: u32,
    pub scan_timestamp: chrono::DateTime<chrono::Utc>,
}