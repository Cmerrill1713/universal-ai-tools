//! Agent definitions and core types for the Agent Registry Service

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Agent type categories for classification and routing
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AgentType {
    /// General-purpose conversational agent
    Conversational,
    /// Code analysis and generation
    CodeAssistant,
    /// Data processing and analysis
    DataProcessor,
    /// Content creation and editing
    ContentCreator,
    /// Research and information gathering
    Researcher,
    /// Task automation and workflows
    TaskAutomator,
    /// Security analysis and monitoring
    SecurityAnalyzer,
    /// Performance optimization
    PerformanceOptimizer,
    /// Custom or specialized agents
    Custom(String),
}

/// Agent capabilities for feature discovery and matching
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AgentCapability {
    /// Natural language processing
    NaturalLanguageProcessing,
    /// Code generation and analysis
    CodeGeneration,
    /// Image processing and analysis
    ImageProcessing,
    /// Audio processing and synthesis
    AudioProcessing,
    /// Video processing and analysis
    VideoProcessing,
    /// Web scraping and data extraction
    WebScraping,
    /// API integration and orchestration
    ApiIntegration,
    /// Database operations
    DatabaseOperations,
    /// File system operations
    FileSystemOperations,
    /// Network operations
    NetworkOperations,
    /// Real-time communication
    RealTimeCommunication,
    /// Scheduling and automation
    Scheduling,
    /// Monitoring and alerting
    Monitoring,
    /// Custom capability
    Custom(String),
}

/// Agent execution status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    /// Agent is active and available
    Active,
    /// Agent is temporarily inactive
    Inactive,
    /// Agent is currently executing a task
    Busy,
    /// Agent has encountered an error
    Error,
    /// Agent is being updated or maintained
    Maintenance,
    /// Agent is being decommissioned
    Decommissioning,
}

/// Agent configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Maximum concurrent executions
    pub max_concurrent_executions: u32,
    /// Default timeout in seconds
    pub default_timeout_seconds: u64,
    /// Resource limits
    pub memory_limit_mb: Option<u64>,
    pub cpu_limit_cores: Option<f64>,
    /// Environment variables
    pub environment: HashMap<String, String>,
    /// Custom configuration parameters
    pub parameters: HashMap<String, serde_json::Value>,
    /// Health check configuration
    pub health_check: Option<HealthCheckConfig>,
    /// Retry configuration
    pub retry_config: Option<RetryConfig>,
}

/// Health check configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckConfig {
    /// Health check endpoint
    pub endpoint: String,
    /// Health check interval in seconds
    pub interval_seconds: u64,
    /// Health check timeout in seconds
    pub timeout_seconds: u64,
    /// Number of failed checks before marking unhealthy
    pub failure_threshold: u32,
}

/// Retry configuration for agent executions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// Maximum number of retries
    pub max_retries: u32,
    /// Initial delay between retries in milliseconds
    pub initial_delay_ms: u64,
    /// Exponential backoff multiplier
    pub backoff_multiplier: f64,
    /// Maximum delay between retries in milliseconds
    pub max_delay_ms: u64,
}

/// Complete agent definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDefinition {
    /// Unique agent identifier
    pub id: Uuid,
    /// Human-readable agent name
    pub name: String,
    /// Agent type classification
    pub agent_type: AgentType,
    /// Detailed description
    pub description: String,
    /// List of agent capabilities
    pub capabilities: Vec<AgentCapability>,
    /// Agent configuration
    pub config: AgentConfig,
    /// Agent version
    pub version: String,
    /// Service endpoint (for remote agents)
    pub endpoint: Option<String>,
    /// Current status
    pub status: AgentStatus,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    /// Last seen timestamp
    pub last_seen: Option<DateTime<Utc>>,
    /// Agent metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Runtime agent instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    /// Agent definition
    pub definition: AgentDefinition,
    /// Current execution count
    pub execution_count: u64,
    /// Error count
    pub error_count: u64,
    /// Average execution time in milliseconds
    pub avg_execution_time_ms: f64,
    /// Last execution timestamp
    pub last_execution: Option<DateTime<Utc>>,
    /// Health score (0.0 to 1.0)
    pub health_score: f64,
    /// Performance metrics
    pub metrics: AgentMetrics,
}

/// Agent performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetrics {
    /// Total executions
    pub total_executions: u64,
    /// Successful executions
    pub successful_executions: u64,
    /// Failed executions
    pub failed_executions: u64,
    /// Average response time in milliseconds
    pub avg_response_time_ms: f64,
    /// 95th percentile response time
    pub p95_response_time_ms: f64,
    /// CPU usage percentage
    pub cpu_usage_percent: f64,
    /// Memory usage in MB
    pub memory_usage_mb: f64,
    /// Network I/O bytes
    pub network_io_bytes: u64,
    /// Disk I/O bytes
    pub disk_io_bytes: u64,
    /// Error rate (0.0 to 1.0)
    pub error_rate: f64,
    /// Uptime percentage
    pub uptime_percent: f64,
}

/// Agent execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentExecutionRequest {
    /// Agent ID to execute
    pub agent_id: Uuid,
    /// Input data for the agent
    pub input: serde_json::Value,
    /// Execution context
    pub context: HashMap<String, serde_json::Value>,
    /// Request timeout in seconds
    pub timeout_seconds: Option<u64>,
    /// Priority level (0-10, higher = more important)
    pub priority: Option<u8>,
    /// Request metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Agent execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentExecutionResult {
    /// Execution ID
    pub execution_id: Uuid,
    /// Agent ID that executed
    pub agent_id: Uuid,
    /// Agent name
    pub agent_name: String,
    /// Execution success status
    pub success: bool,
    /// Output data from the agent
    pub output: serde_json::Value,
    /// Error message (if failed)
    pub error_message: Option<String>,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
    /// Resource usage during execution
    pub resource_usage: ResourceUsage,
    /// Execution metadata
    pub metadata: HashMap<String, serde_json::Value>,
    /// Execution timestamp
    pub executed_at: DateTime<Utc>,
}

/// Resource usage tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    /// CPU time used in milliseconds
    pub cpu_time_ms: u64,
    /// Peak memory usage in bytes
    pub peak_memory_bytes: u64,
    /// Network bytes sent
    pub network_bytes_sent: u64,
    /// Network bytes received
    pub network_bytes_received: u64,
    /// Disk bytes read
    pub disk_bytes_read: u64,
    /// Disk bytes written
    pub disk_bytes_written: u64,
}

/// Agent status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatusInfo {
    /// Current status
    pub status: AgentStatus,
    /// Last seen timestamp
    pub last_seen: DateTime<Utc>,
    /// Health score (0.0 to 1.0)
    pub health_score: f64,
    /// Current execution count
    pub execution_count: u64,
    /// Current error count
    pub error_count: u64,
    /// Additional status metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Agent health check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentHealthCheck {
    /// Health check success
    pub healthy: bool,
    /// Response time in milliseconds
    pub response_time_ms: u64,
    /// Last check timestamp
    pub last_check: DateTime<Utc>,
    /// Error message (if unhealthy)
    pub error_message: Option<String>,
    /// Additional health metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            max_concurrent_executions: 10,
            default_timeout_seconds: 30,
            memory_limit_mb: None,
            cpu_limit_cores: None,
            environment: HashMap::new(),
            parameters: HashMap::new(),
            health_check: None,
            retry_config: None,
        }
    }
}

impl Default for AgentMetrics {
    fn default() -> Self {
        Self {
            total_executions: 0,
            successful_executions: 0,
            failed_executions: 0,
            avg_response_time_ms: 0.0,
            p95_response_time_ms: 0.0,
            cpu_usage_percent: 0.0,
            memory_usage_mb: 0.0,
            network_io_bytes: 0,
            disk_io_bytes: 0,
            error_rate: 0.0,
            uptime_percent: 100.0,
        }
    }
}

impl AgentDefinition {
    /// Create a new agent definition
    pub fn new(
        name: String,
        agent_type: AgentType,
        description: String,
        capabilities: Vec<AgentCapability>,
        config: AgentConfig,
        version: String,
        endpoint: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            agent_type,
            description,
            capabilities,
            config,
            version,
            endpoint,
            status: AgentStatus::Active,
            created_at: now,
            updated_at: now,
            last_seen: None,
            metadata: HashMap::new(),
        }
    }

    /// Check if agent has a specific capability
    pub fn has_capability(&self, capability: &AgentCapability) -> bool {
        self.capabilities.contains(capability)
    }

    /// Check if agent is available for execution
    pub fn is_available(&self) -> bool {
        matches!(self.status, AgentStatus::Active)
    }
}

impl Agent {
    /// Create a new agent from definition
    pub fn from_definition(definition: AgentDefinition) -> Self {
        Self {
            definition,
            execution_count: 0,
            error_count: 0,
            avg_execution_time_ms: 0.0,
            last_execution: None,
            health_score: 1.0,
            metrics: AgentMetrics::default(),
        }
    }

    /// Update agent metrics after execution
    pub fn update_metrics(&mut self, execution_result: &AgentExecutionResult) {
        self.execution_count += 1;
        self.metrics.total_executions += 1;
        self.last_execution = Some(execution_result.executed_at);

        if execution_result.success {
            self.metrics.successful_executions += 1;
        } else {
            self.error_count += 1;
            self.metrics.failed_executions += 1;
        }

        // Update average execution time
        let total_time = self.avg_execution_time_ms * (self.execution_count - 1) as f64
            + execution_result.execution_time_ms as f64;
        self.avg_execution_time_ms = total_time / self.execution_count as f64;

        // Update error rate
        self.metrics.error_rate = self.metrics.failed_executions as f64 / self.metrics.total_executions as f64;

        // Update health score based on recent performance
        self.update_health_score();
    }

    /// Calculate and update health score
    fn update_health_score(&mut self) {
        let error_penalty = self.metrics.error_rate * 0.5;
        let performance_score = if self.avg_execution_time_ms > 0.0 {
            (1000.0 / self.avg_execution_time_ms).min(1.0)
        } else {
            1.0
        };
        
        self.health_score = (performance_score - error_penalty).clamp(0.0, 1.0);
    }
}