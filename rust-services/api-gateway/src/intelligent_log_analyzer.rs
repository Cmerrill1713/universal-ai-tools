use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc, Duration as ChronoDuration};
use anyhow::Result;
use tracing::{info, error, debug};
use regex::Regex;
use crate::error_agent_spawner::{ErrorAgentSpawner, ErrorCategory, ErrorSeverity};

/// Real-time log entry for analysis
#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub service_id: String,
    pub message: String,
    pub metadata: HashMap<String, serde_json::Value>,
    pub correlation_id: Option<String>,
    pub trace_id: Option<String>,
    pub span_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
    Fatal,
}

/// Pattern for intelligent log analysis
#[derive(Debug, Clone)]
pub struct LogAnalysisPattern {
    pub pattern_id: String,
    pub regex: Regex,
    pub error_category: ErrorCategory,
    pub base_severity: ErrorSeverity,
    pub trigger_threshold: u32, // Number of occurrences to trigger agent
    pub time_window: ChronoDuration, // Time window for counting occurrences
    pub escalation_factor: f32, // Multiplier for repeated patterns
    pub agent_type_hint: Option<String>,
}

/// Analysis result from log processing
#[derive(Debug, Clone, Serialize)]
pub struct LogAnalysisResult {
    pub analysis_id: String,
    pub timestamp: DateTime<Utc>,
    pub log_entries: Vec<LogEntry>,
    pub detected_patterns: Vec<DetectedPattern>,
    pub severity_score: f64, // 0.0-1.0
    pub agent_recommendations: Vec<AgentRecommendation>,
    pub correlation_insights: Vec<CorrelationInsight>,
    pub trend_analysis: TrendAnalysis,
}

/// Detected pattern instance
#[derive(Debug, Clone, Serialize)]
pub struct DetectedPattern {
    pub pattern_id: String,
    pub occurrences: u32,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub affected_services: Vec<String>,
    pub escalation_level: u32,
    pub confidence: f64,
}

/// Agent recommendation based on log analysis
#[derive(Debug, Clone, Serialize)]
pub struct AgentRecommendation {
    pub agent_type: String,
    pub priority: u8, // 1-5, 5 being urgent
    pub reasoning: String,
    pub confidence: f64,
    pub estimated_resolution_time: u32, // seconds
    pub risk_assessment: RiskLevel,
}

#[derive(Debug, Clone, Serialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Correlation insights between different log patterns
#[derive(Debug, Clone, Serialize)]
pub struct CorrelationInsight {
    pub correlation_type: CorrelationType,
    pub services_involved: Vec<String>,
    pub strength: f64, // 0.0-1.0
    pub description: String,
    pub potential_root_cause: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub enum CorrelationType {
    CascadingFailure,
    SharedResource,
    TemporalCluster,
    ServiceDependency,
    ConfigurationChange,
    ResourceExhaustion,
}

/// Trend analysis for predictive insights
#[derive(Debug, Clone, Serialize)]
pub struct TrendAnalysis {
    pub error_rate_trend: TrendDirection,
    pub severity_trend: TrendDirection,
    pub service_health_trend: HashMap<String, TrendDirection>,
    pub prediction_confidence: f64,
    pub projected_issues: Vec<ProjectedIssue>,
}

#[derive(Debug, Clone, Serialize)]
pub enum TrendDirection {
    Improving,
    Stable,
    Degrading,
    Critical,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectedIssue {
    pub issue_type: String,
    pub estimated_occurrence: DateTime<Utc>,
    pub confidence: f64,
    pub preventive_actions: Vec<String>,
}

/// Intelligent log analyzer with agent triggering
pub struct IntelligentLogAnalyzer {
    analysis_patterns: Vec<LogAnalysisPattern>,
    log_buffer: Arc<RwLock<VecDeque<LogEntry>>>,
    pattern_occurrences: Arc<RwLock<HashMap<String, VecDeque<DateTime<Utc>>>>>,
    correlation_cache: Arc<RwLock<HashMap<String, CorrelationInsight>>>,
    agent_spawner: ErrorAgentSpawner,
    config: LogAnalyzerConfig,
}

#[derive(Debug, Clone)]
pub struct LogAnalyzerConfig {
    pub buffer_size: usize,
    pub analysis_interval: u64, // seconds
    pub pattern_retention: u64, // hours
    pub correlation_window: u64, // minutes
    pub trend_analysis_window: u64, // hours
    pub auto_trigger_agents: bool,
    pub min_confidence_threshold: f64,
}

impl Default for LogAnalyzerConfig {
    fn default() -> Self {
        Self {
            buffer_size: 10000,
            analysis_interval: 30,
            pattern_retention: 24,
            correlation_window: 15,
            trend_analysis_window: 4,
            auto_trigger_agents: true,
            min_confidence_threshold: 0.75,
        }
    }
}

impl IntelligentLogAnalyzer {
    pub async fn new(config: LogAnalyzerConfig, agent_spawner: ErrorAgentSpawner) -> Result<Self> {
        let mut analyzer = Self {
            analysis_patterns: Vec::new(),
            log_buffer: Arc::new(RwLock::new(VecDeque::with_capacity(config.buffer_size))),
            pattern_occurrences: Arc::new(RwLock::new(HashMap::new())),
            correlation_cache: Arc::new(RwLock::new(HashMap::new())),
            agent_spawner,
            config,
        };
        
        // Initialize analysis patterns
        analyzer.initialize_analysis_patterns().await?;
        
        // Start background analysis task
        analyzer.start_background_analysis().await;
        
        Ok(analyzer)
    }
    
    /// Initialize intelligent log analysis patterns
    async fn initialize_analysis_patterns(&mut self) -> Result<()> {
        info!("🔍 Initializing intelligent log analysis patterns");
        
        // Network/Connection error patterns
        self.analysis_patterns.push(LogAnalysisPattern {
            pattern_id: "network_timeout".to_string(),
            regex: Regex::new(r"(?i)(timeout|connection\s+refused|connection\s+reset|network\s+unreachable)")?,
            error_category: ErrorCategory::NetworkTimeout,
            base_severity: ErrorSeverity::High,
            trigger_threshold: 3,
            time_window: ChronoDuration::minutes(5),
            escalation_factor: 1.5,
            agent_type_hint: Some("network-engineer".to_string()),
        });
        
        // Database connection patterns
        self.analysis_patterns.push(LogAnalysisPattern {
            pattern_id: "database_connection".to_string(),
            regex: Regex::new(r"(?i)(database|sql|connection\s+pool).*(error|failed|timeout|refused)")?,
            error_category: ErrorCategory::DatabaseConnection,
            base_severity: ErrorSeverity::High,
            trigger_threshold: 2,
            time_window: ChronoDuration::minutes(3),
            escalation_factor: 2.0,
            agent_type_hint: Some("database-optimizer".to_string()),
        });
        
        // Memory leak patterns
        self.analysis_patterns.push(LogAnalysisPattern {
            pattern_id: "memory_leak".to_string(),
            regex: Regex::new(r"(?i)(out\s+of\s+memory|memory\s+leak|heap\s+exhausted|gc\s+overhead)")?,
            error_category: ErrorCategory::MemoryLeak,
            base_severity: ErrorSeverity::Critical,
            trigger_threshold: 1, // Immediate trigger
            time_window: ChronoDuration::minutes(1),
            escalation_factor: 3.0,
            agent_type_hint: Some("performance-optimizer".to_string()),
        });
        
        // Security breach patterns
        self.analysis_patterns.push(LogAnalysisPattern {
            pattern_id: "security_breach".to_string(),
            regex: Regex::new(r"(?i)(unauthorized|security\s+violation|breach|intrusion|attack|malicious)")?,
            error_category: ErrorCategory::SecurityBreach,
            base_severity: ErrorSeverity::Emergency,
            trigger_threshold: 1, // Immediate trigger
            time_window: ChronoDuration::minutes(1),
            escalation_factor: 5.0,
            agent_type_hint: Some("security-auditor".to_string()),
        });
        
        // Performance degradation patterns
        self.analysis_patterns.push(LogAnalysisPattern {
            pattern_id: "performance_degradation".to_string(),
            regex: Regex::new(r"(?i)(slow|performance|latency|bottleneck|degradation).*(detected|warning|high)")?,
            error_category: ErrorCategory::PerformanceDegradation,
            base_severity: ErrorSeverity::Medium,
            trigger_threshold: 5,
            time_window: ChronoDuration::minutes(10),
            escalation_factor: 1.3,
            agent_type_hint: Some("performance-optimizer".to_string()),
        });
        
        // Configuration error patterns
        self.analysis_patterns.push(LogAnalysisPattern {
            pattern_id: "configuration_error".to_string(),
            regex: Regex::new(r"(?i)(config|configuration).*(error|invalid|missing|failed|wrong)")?,
            error_category: ErrorCategory::ConfigurationError,
            base_severity: ErrorSeverity::Medium,
            trigger_threshold: 2,
            time_window: ChronoDuration::minutes(5),
            escalation_factor: 1.8,
            agent_type_hint: Some("devops-troubleshooter".to_string()),
        });
        
        // Service unavailable patterns
        self.analysis_patterns.push(LogAnalysisPattern {
            pattern_id: "service_unavailable".to_string(),
            regex: Regex::new(r"(?i)(service\s+unavailable|503|downstream\s+error|circuit\s+breaker\s+open)")?,
            error_category: ErrorCategory::ServiceUnavailable,
            base_severity: ErrorSeverity::High,
            trigger_threshold: 3,
            time_window: ChronoDuration::minutes(2),
            escalation_factor: 2.5,
            agent_type_hint: Some("network-engineer".to_string()),
        });
        
        // Rate limit patterns
        self.analysis_patterns.push(LogAnalysisPattern {
            pattern_id: "rate_limit".to_string(),
            regex: Regex::new(r"(?i)(rate\s+limit|429|too\s+many\s+requests|throttled)")?,
            error_category: ErrorCategory::RateLimit,
            base_severity: ErrorSeverity::Medium,
            trigger_threshold: 10,
            time_window: ChronoDuration::minutes(5),
            escalation_factor: 1.2,
            agent_type_hint: Some("performance-optimizer".to_string()),
        });
        
        info!("✅ Initialized {} log analysis patterns", self.analysis_patterns.len());
        Ok(())
    }
    
    /// Process incoming log entry
    pub async fn process_log_entry(&mut self, log_entry: LogEntry) -> Result<()> {
        debug!("📝 Processing log entry from service: {}", log_entry.service_id);
        
        // Add to buffer
        {
            let mut buffer = self.log_buffer.write().await;
            if buffer.len() >= self.config.buffer_size {
                buffer.pop_front(); // Remove oldest entry
            }
            buffer.push_back(log_entry.clone());
        }
        
        // Immediate analysis for critical entries
        if matches!(log_entry.level, LogLevel::Error | LogLevel::Fatal) {
            self.analyze_critical_log(&log_entry).await?;
        }
        
        Ok(())
    }
    
    /// Analyze critical log entries immediately
    async fn analyze_critical_log(&mut self, log_entry: &LogEntry) -> Result<()> {
        info!("🚨 Analyzing critical log entry: {}", log_entry.message);
        
        for pattern in &self.analysis_patterns {
            if pattern.regex.is_match(&log_entry.message) {
                info!("🎯 Pattern '{}' matched in critical log", pattern.pattern_id);
                
                // Update pattern occurrences
                self.update_pattern_occurrence(&pattern.pattern_id, log_entry.timestamp).await;
                
                // Check if threshold is met for agent spawning
                if self.check_pattern_threshold(pattern).await? {
                    info!("🚀 Pattern '{}' threshold met - triggering agent spawn", pattern.pattern_id);
                    
                    if self.config.auto_trigger_agents {
                        // Create metadata for agent spawning
                        let metadata = serde_json::json!({
                            "pattern_id": pattern.pattern_id,
                            "log_level": log_entry.level,
                            "service_id": log_entry.service_id,
                            "timestamp": log_entry.timestamp,
                            "correlation_id": log_entry.correlation_id,
                            "trace_id": log_entry.trace_id
                        });
                        
                        // Spawn agent for this error
                        match self.agent_spawner.handle_error(&log_entry.message, &log_entry.service_id, Some(metadata)).await {
                            Ok(Some(spawn_response)) => {
                                info!("✅ Successfully spawned agent {} for pattern {}", 
                                      spawn_response.agent_id, pattern.pattern_id);
                            },
                            Ok(None) => {
                                debug!("📝 Agent not spawned - conditions not met");
                            },
                            Err(e) => {
                                error!("❌ Failed to spawn agent for pattern {}: {}", pattern.pattern_id, e);
                            }
                        }
                    }
                }
                
                break; // Only match first pattern to avoid duplicate triggers
            }
        }
        
        Ok(())
    }
    
    /// Update pattern occurrence tracking
    async fn update_pattern_occurrence(&self, pattern_id: &str, timestamp: DateTime<Utc>) {
        let mut occurrences = self.pattern_occurrences.write().await;
        let pattern_occurrences = occurrences.entry(pattern_id.to_string()).or_insert_with(VecDeque::new);
        
        pattern_occurrences.push_back(timestamp);
        
        // Clean old occurrences (beyond retention window)
        let retention_cutoff = Utc::now() - ChronoDuration::hours(self.config.pattern_retention as i64);
        while let Some(&front_time) = pattern_occurrences.front() {
            if front_time < retention_cutoff {
                pattern_occurrences.pop_front();
            } else {
                break;
            }
        }
    }
    
    /// Check if pattern threshold is met for triggering
    async fn check_pattern_threshold(&self, pattern: &LogAnalysisPattern) -> Result<bool> {
        let occurrences = self.pattern_occurrences.read().await;
        
        if let Some(pattern_occurrences) = occurrences.get(&pattern.pattern_id) {
            let cutoff_time = Utc::now() - pattern.time_window;
            let recent_count = pattern_occurrences.iter()
                .filter(|&&timestamp| timestamp > cutoff_time)
                .count() as u32;
            
            debug!("Pattern '{}': {} recent occurrences, threshold: {}", 
                   pattern.pattern_id, recent_count, pattern.trigger_threshold);
            
            Ok(recent_count >= pattern.trigger_threshold)
        } else {
            Ok(false)
        }
    }
    
    /// Start background analysis task
    async fn start_background_analysis(&self) {
        let log_buffer = Arc::clone(&self.log_buffer);
        let pattern_occurrences = Arc::clone(&self.pattern_occurrences);
        let correlation_cache = Arc::clone(&self.correlation_cache);
        let analysis_interval = self.config.analysis_interval;
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(analysis_interval));
            
            loop {
                interval.tick().await;
                
                // Perform periodic analysis
                if let Err(e) = Self::perform_background_analysis(
                    &log_buffer,
                    &pattern_occurrences,
                    &correlation_cache,
                ).await {
                    error!("❌ Background analysis failed: {}", e);
                }
            }
        });
    }
    
    /// Perform comprehensive background analysis
    async fn perform_background_analysis(
        log_buffer: &Arc<RwLock<VecDeque<LogEntry>>>,
        _pattern_occurrences: &Arc<RwLock<HashMap<String, VecDeque<DateTime<Utc>>>>>,
        _correlation_cache: &Arc<RwLock<HashMap<String, CorrelationInsight>>>,
    ) -> Result<()> {
        debug!("🔄 Performing background log analysis");
        
        let buffer = log_buffer.read().await;
        let recent_logs: Vec<LogEntry> = buffer.iter()
            .filter(|log| Utc::now().signed_duration_since(log.timestamp) < ChronoDuration::hours(1))
            .cloned()
            .collect();
        
        if recent_logs.is_empty() {
            return Ok(());
        }
        
        // Analyze service correlation patterns
        let service_error_counts: HashMap<String, u32> = recent_logs.iter()
            .filter(|log| matches!(log.level, LogLevel::Error | LogLevel::Fatal))
            .fold(HashMap::new(), |mut acc, log| {
                *acc.entry(log.service_id.clone()).or_insert(0) += 1;
                acc
            });
        
        // Identify services with high error rates
        for (service_id, error_count) in service_error_counts {
            if error_count > 5 {
                info!("📊 Service {} has high error rate: {} errors in last hour", service_id, error_count);
            }
        }
        
        // Analyze temporal clustering
        let error_logs: Vec<&LogEntry> = recent_logs.iter()
            .filter(|log| matches!(log.level, LogLevel::Error | LogLevel::Fatal))
            .collect();
        
        if error_logs.len() > 10 {
            info!("⚠️ Detected error burst: {} errors in last hour", error_logs.len());
        }
        
        debug!("✅ Background analysis completed");
        Ok(())
    }
    
    /// Generate comprehensive analysis report
    pub async fn generate_analysis_report(&self) -> Result<LogAnalysisResult> {
        info!("📊 Generating comprehensive log analysis report");
        
        let buffer = self.log_buffer.read().await;
        let recent_logs: Vec<LogEntry> = buffer.iter()
            .filter(|log| Utc::now().signed_duration_since(log.timestamp) < ChronoDuration::hours(1))
            .cloned()
            .collect();
        
        // Analyze detected patterns
        let mut detected_patterns = Vec::new();
        let pattern_occurrences = self.pattern_occurrences.read().await;
        
        for pattern in &self.analysis_patterns {
            if let Some(occurrences) = pattern_occurrences.get(&pattern.pattern_id) {
                let recent_occurrences = occurrences.iter()
                    .filter(|&&timestamp| Utc::now().signed_duration_since(timestamp) < ChronoDuration::hours(1))
                    .count() as u32;
                
                if recent_occurrences > 0 {
                    let affected_services: Vec<String> = recent_logs.iter()
                        .filter(|log| pattern.regex.is_match(&log.message))
                        .map(|log| log.service_id.clone())
                        .collect::<std::collections::HashSet<_>>()
                        .into_iter()
                        .collect();
                    
                    detected_patterns.push(DetectedPattern {
                        pattern_id: pattern.pattern_id.clone(),
                        occurrences: recent_occurrences,
                        first_seen: occurrences.front().copied().unwrap_or_else(Utc::now),
                        last_seen: occurrences.back().copied().unwrap_or_else(Utc::now),
                        affected_services,
                        escalation_level: if recent_occurrences > pattern.trigger_threshold { 1 } else { 0 },
                        confidence: if recent_occurrences > 0 { 0.85 } else { 0.0 },
                    });
                }
            }
        }
        
        // Generate agent recommendations
        let agent_recommendations = self.generate_agent_recommendations(&detected_patterns).await;
        
        // Calculate severity score
        let severity_score = self.calculate_severity_score(&recent_logs, &detected_patterns).await;
        
        // Generate trend analysis
        let trend_analysis = self.generate_trend_analysis(&recent_logs).await;
        
        Ok(LogAnalysisResult {
            analysis_id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            log_entries: recent_logs.into_iter().take(100).collect(), // Latest 100 entries
            detected_patterns,
            severity_score,
            agent_recommendations,
            correlation_insights: vec![], // Would be populated with more sophisticated analysis
            trend_analysis,
        })
    }
    
    /// Generate agent recommendations based on detected patterns
    async fn generate_agent_recommendations(&self, patterns: &[DetectedPattern]) -> Vec<AgentRecommendation> {
        let mut recommendations = Vec::new();
        
        for pattern in patterns {
            if pattern.confidence > self.config.min_confidence_threshold {
                if let Some(analysis_pattern) = self.analysis_patterns.iter().find(|p| p.pattern_id == pattern.pattern_id) {
                    let priority = match analysis_pattern.base_severity {
                        ErrorSeverity::Emergency => 5,
                        ErrorSeverity::Critical => 4,
                        ErrorSeverity::High => 3,
                        ErrorSeverity::Medium => 2,
                        ErrorSeverity::Low => 1,
                    };
                    
                    if let Some(agent_type) = &analysis_pattern.agent_type_hint {
                        recommendations.push(AgentRecommendation {
                            agent_type: agent_type.clone(),
                            priority,
                            reasoning: format!("Pattern '{}' detected {} times in {} services", 
                                             pattern.pattern_id, pattern.occurrences, pattern.affected_services.len()),
                            confidence: pattern.confidence,
                            estimated_resolution_time: match analysis_pattern.base_severity {
                                ErrorSeverity::Emergency => 180,  // 3 minutes
                                ErrorSeverity::Critical => 300,   // 5 minutes
                                ErrorSeverity::High => 600,       // 10 minutes
                                ErrorSeverity::Medium => 900,     // 15 minutes
                                ErrorSeverity::Low => 1800,       // 30 minutes
                            },
                            risk_assessment: match analysis_pattern.base_severity {
                                ErrorSeverity::Emergency | ErrorSeverity::Critical => RiskLevel::Critical,
                                ErrorSeverity::High => RiskLevel::High,
                                ErrorSeverity::Medium => RiskLevel::Medium,
                                ErrorSeverity::Low => RiskLevel::Low,
                            },
                        });
                    }
                }
            }
        }
        
        // Sort by priority and confidence
        recommendations.sort_by(|a, b| {
            b.priority.cmp(&a.priority)
                .then_with(|| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal))
        });
        
        recommendations
    }
    
    /// Calculate overall severity score
    async fn calculate_severity_score(&self, logs: &[LogEntry], patterns: &[DetectedPattern]) -> f64 {
        let error_count = logs.iter().filter(|log| matches!(log.level, LogLevel::Error | LogLevel::Fatal)).count();
        let total_count = logs.len();
        
        if total_count == 0 {
            return 0.0;
        }
        
        let error_ratio = error_count as f64 / total_count as f64;
        let pattern_severity: f64 = patterns.iter()
            .map(|p| p.confidence * p.occurrences as f64)
            .sum::<f64>() / patterns.len().max(1) as f64;
        
        ((error_ratio * 0.6) + (pattern_severity * 0.4)).min(1.0)
    }
    
    /// Generate trend analysis
    async fn generate_trend_analysis(&self, logs: &[LogEntry]) -> TrendAnalysis {
        let error_logs: Vec<&LogEntry> = logs.iter()
            .filter(|log| matches!(log.level, LogLevel::Error | LogLevel::Fatal))
            .collect();
        
        let error_rate_trend = if error_logs.len() > logs.len() / 10 {
            TrendDirection::Degrading
        } else if error_logs.len() > logs.len() / 20 {
            TrendDirection::Stable
        } else {
            TrendDirection::Improving
        };
        
        let service_health_trend: HashMap<String, TrendDirection> = logs.iter()
            .fold(HashMap::new(), |mut acc, log| {
                let service_errors = acc.entry(log.service_id.clone()).or_insert(0);
                if matches!(log.level, LogLevel::Error | LogLevel::Fatal) {
                    *service_errors += 1;
                }
                acc
            })
            .into_iter()
            .map(|(service, error_count)| {
                let trend = if error_count > 5 {
                    TrendDirection::Degrading
                } else if error_count > 2 {
                    TrendDirection::Stable
                } else {
                    TrendDirection::Improving
                };
                (service, trend)
            })
            .collect();
        
        TrendAnalysis {
            error_rate_trend,
            severity_trend: TrendDirection::Stable,
            service_health_trend,
            prediction_confidence: 0.72,
            projected_issues: vec![],
        }
    }
    
    /// Get current buffer statistics
    pub async fn get_buffer_stats(&self) -> (usize, usize) {
        let buffer = self.log_buffer.read().await;
        (buffer.len(), self.config.buffer_size)
    }
    
    /// Get pattern occurrence statistics
    pub async fn get_pattern_stats(&self) -> HashMap<String, u32> {
        let occurrences = self.pattern_occurrences.read().await;
        occurrences.iter()
            .map(|(pattern_id, timestamps)| {
                let recent_count = timestamps.iter()
                    .filter(|&&timestamp| Utc::now().signed_duration_since(timestamp) < ChronoDuration::hours(1))
                    .count() as u32;
                (pattern_id.clone(), recent_count)
            })
            .collect()
    }
}

/// Helper function to create log entry from structured data
pub fn create_log_entry(
    level: LogLevel,
    service_id: &str,
    message: &str,
    metadata: Option<HashMap<String, serde_json::Value>>,
) -> LogEntry {
    LogEntry {
        timestamp: Utc::now(),
        level,
        service_id: service_id.to_string(),
        message: message.to_string(),
        metadata: metadata.unwrap_or_default(),
        correlation_id: None,
        trace_id: None,
        span_id: None,
    }
}