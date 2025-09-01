use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub key: String,
    pub value: Vec<u8>,
    pub ttl: Option<Duration>,
    pub created_at: DateTime<Utc>,
    pub accessed_at: DateTime<Utc>,
    pub access_count: u64,
    pub size_bytes: usize,
    pub compressed: bool,
}

impl CacheEntry {
    pub fn new(key: String, value: Vec<u8>, ttl: Option<Duration>) -> Self {
        let now = Utc::now();
        Self {
            key,
            size_bytes: value.len(),
            value,
            ttl,
            created_at: now,
            accessed_at: now,
            access_count: 0,
            compressed: false,
        }
    }

    pub fn is_expired(&self) -> bool {
        if let Some(ttl) = self.ttl {
            let elapsed = Utc::now() - self.created_at;
            elapsed > chrono::Duration::from_std(ttl).unwrap_or(chrono::Duration::seconds(0))
        } else {
            false
        }
    }

    pub fn update_access(&mut self) {
        self.accessed_at = Utc::now();
        self.access_count += 1;
    }

    pub fn age(&self) -> chrono::Duration {
        Utc::now() - self.created_at
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CacheStrategy {
    /// Least Recently Used
    LRU,
    /// Least Frequently Used
    LFU,
    /// First In First Out
    FIFO,
    /// Time-To-Live based
    TTL,
    /// Adaptive Replacement Cache
    ARC,
    /// Two-Queue
    TwoQueue,
}

impl CacheStrategy {
    pub fn as_str(&self) -> &'static str {
        match self {
            CacheStrategy::LRU => "lru",
            CacheStrategy::LFU => "lfu",
            CacheStrategy::FIFO => "fifo",
            CacheStrategy::TTL => "ttl",
            CacheStrategy::ARC => "arc",
            CacheStrategy::TwoQueue => "two_queue",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "lru" => Some(CacheStrategy::LRU),
            "lfu" => Some(CacheStrategy::LFU),
            "fifo" => Some(CacheStrategy::FIFO),
            "ttl" => Some(CacheStrategy::TTL),
            "arc" => Some(CacheStrategy::ARC),
            "two_queue" => Some(CacheStrategy::TwoQueue),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub strategy: CacheStrategy,
    pub max_size_bytes: usize,
    pub max_entries: usize,
    pub default_ttl: Option<Duration>,
    pub enable_compression: bool,
    pub compression_threshold: usize, // Compress if value > threshold bytes
    pub enable_clustering: bool,
    pub enable_persistence: bool,
    pub persistence_interval: Duration,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            strategy: CacheStrategy::LRU,
            max_size_bytes: 1024 * 1024 * 100, // 100MB
            max_entries: 10000,
            default_ttl: Some(Duration::from_secs(3600)), // 1 hour
            enable_compression: true,
            compression_threshold: 1024, // 1KB
            enable_clustering: false,
            enable_persistence: false,
            persistence_interval: Duration::from_secs(300), // 5 minutes
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_idle: u32,
    pub connection_timeout: Duration,
    pub command_timeout: Duration,
    pub max_retries: u32,
    pub retry_delay: Duration,
    pub enable_cluster: bool,
    pub cluster_nodes: Vec<String>,
    pub password: Option<String>,
    pub database: u16,
}

impl Default for RedisConfig {
    fn default() -> Self {
        Self {
            url: "redis://localhost:6379".to_string(),
            max_connections: 20,
            min_idle: 5,
            connection_timeout: Duration::from_secs(10),
            command_timeout: Duration::from_secs(5),
            max_retries: 3,
            retry_delay: Duration::from_millis(100),
            enable_cluster: false,
            cluster_nodes: vec![],
            password: None,
            database: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub session_id: String,
    pub user_id: Option<String>,
    pub data: HashMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

impl SessionData {
    pub fn new(session_id: String, ttl: Duration) -> Self {
        let now = Utc::now();
        Self {
            session_id,
            user_id: None,
            data: HashMap::new(),
            created_at: now,
            updated_at: now,
            expires_at: now + chrono::Duration::from_std(ttl).unwrap(),
            ip_address: None,
            user_agent: None,
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    pub fn extend(&mut self, ttl: Duration) {
        self.expires_at = Utc::now() + chrono::Duration::from_std(ttl).unwrap();
        self.updated_at = Utc::now();
    }

    pub fn set(&mut self, key: String, value: serde_json::Value) {
        self.data.insert(key, value);
        self.updated_at = Utc::now();
    }
    
    pub fn touch(&mut self) {
        self.updated_at = Utc::now();
    }

    pub fn get(&self, key: &str) -> Option<&serde_json::Value> {
        self.data.get(key)
    }

    pub fn remove(&mut self, key: &str) -> Option<serde_json::Value> {
        self.updated_at = Utc::now();
        self.data.remove(key)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStatistics {
    pub total_entries: usize,
    pub total_size_bytes: usize,
    pub hit_count: u64,
    pub miss_count: u64,
    pub eviction_count: u64,
    pub compression_count: u64,
    pub decompression_count: u64,
    pub average_entry_size: f64,
    pub hit_rate: f64,
    pub miss_rate: f64,
    pub compression_ratio: f64,
    pub oldest_entry_age: Option<chrono::Duration>,
    pub newest_entry_age: Option<chrono::Duration>,
    pub last_eviction: Option<DateTime<Utc>>,
    pub uptime: chrono::Duration,
}

impl CacheStatistics {
    pub fn new() -> Self {
        Self {
            total_entries: 0,
            total_size_bytes: 0,
            hit_count: 0,
            miss_count: 0,
            eviction_count: 0,
            compression_count: 0,
            decompression_count: 0,
            average_entry_size: 0.0,
            hit_rate: 0.0,
            miss_rate: 0.0,
            compression_ratio: 0.0,
            oldest_entry_age: None,
            newest_entry_age: None,
            last_eviction: None,
            uptime: chrono::Duration::seconds(0),
        }
    }

    pub fn record_hit(&mut self) {
        self.hit_count += 1;
        self.update_rates();
    }

    pub fn record_miss(&mut self) {
        self.miss_count += 1;
        self.update_rates();
    }

    pub fn record_eviction(&mut self) {
        self.eviction_count += 1;
        self.last_eviction = Some(Utc::now());
    }

    pub fn record_compression(&mut self, original_size: usize, compressed_size: usize) {
        self.compression_count += 1;
        if original_size > 0 {
            let ratio = compressed_size as f64 / original_size as f64;
            self.compression_ratio = (self.compression_ratio * (self.compression_count - 1) as f64 + ratio) 
                / self.compression_count as f64;
        }
    }

    pub fn record_decompression(&mut self) {
        self.decompression_count += 1;
    }

    fn update_rates(&mut self) {
        let total = (self.hit_count + self.miss_count) as f64;
        if total > 0.0 {
            self.hit_rate = self.hit_count as f64 / total;
            self.miss_rate = self.miss_count as f64 / total;
        }
    }
    
    pub fn recalculate_rates(&mut self) {
        self.update_rates();
    }

    pub fn update_entry_stats(&mut self, total_entries: usize, total_size: usize) {
        self.total_entries = total_entries;
        self.total_size_bytes = total_size;
        if total_entries > 0 {
            self.average_entry_size = total_size as f64 / total_entries as f64;
        }
    }
}

impl Default for CacheStatistics {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub connected: bool,
    pub url: String,
    pub active_connections: u32,
    pub idle_connections: u32,
    pub total_connections_created: u64,
    pub total_connections_closed: u64,
    pub last_error: Option<String>,
    pub last_error_time: Option<DateTime<Utc>>,
    pub uptime: chrono::Duration,
    pub reconnect_attempts: u32,
    pub using_fallback: bool,
}

impl ConnectionStatus {
    pub fn new(url: String) -> Self {
        Self {
            connected: false,
            url,
            active_connections: 0,
            idle_connections: 0,
            total_connections_created: 0,
            total_connections_closed: 0,
            last_error: None,
            last_error_time: None,
            uptime: chrono::Duration::seconds(0),
            reconnect_attempts: 0,
            using_fallback: false,
        }
    }

    pub fn record_error(&mut self, error: String) {
        self.last_error = Some(error);
        self.last_error_time = Some(Utc::now());
        self.connected = false;
    }

    pub fn record_connection(&mut self) {
        self.connected = true;
        self.total_connections_created += 1;
        self.reconnect_attempts = 0;
    }

    pub fn record_disconnection(&mut self) {
        self.connected = false;
        self.total_connections_closed += 1;
    }

    pub fn record_reconnect_attempt(&mut self) {
        self.reconnect_attempts += 1;
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OperationType {
    Get,
    Set,
    Delete,
    Exists,
    Expire,
    TTL,
    Keys,
    FlushAll,
    FlushDB,
    Ping,
    Info,
    Subscribe,
    Unsubscribe,
    Publish,
    Transaction,
}

impl OperationType {
    pub fn as_str(&self) -> &'static str {
        match self {
            OperationType::Get => "get",
            OperationType::Set => "set",
            OperationType::Delete => "delete",
            OperationType::Exists => "exists",
            OperationType::Expire => "expire",
            OperationType::TTL => "ttl",
            OperationType::Keys => "keys",
            OperationType::FlushAll => "flushall",
            OperationType::FlushDB => "flushdb",
            OperationType::Ping => "ping",
            OperationType::Info => "info",
            OperationType::Subscribe => "subscribe",
            OperationType::Unsubscribe => "unsubscribe",
            OperationType::Publish => "publish",
            OperationType::Transaction => "transaction",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationMetrics {
    pub operation_type: String,
    pub count: u64,
    pub total_duration: Duration,
    pub min_duration: Option<Duration>,
    pub max_duration: Option<Duration>,
    pub avg_duration: Option<Duration>,
    pub success_count: u64,
    pub failure_count: u64,
    pub timeout_count: u64,
    pub success_rate: f64,
}

impl OperationMetrics {
    pub fn new(operation_type: String) -> Self {
        Self {
            operation_type,
            count: 0,
            total_duration: Duration::from_secs(0),
            min_duration: None,
            max_duration: None,
            avg_duration: None,
            success_count: 0,
            failure_count: 0,
            timeout_count: 0,
            success_rate: 0.0,
        }
    }

    pub fn record(&mut self, duration: Duration, success: bool, timeout: bool) {
        self.count += 1;
        self.total_duration += duration;
        
        if self.min_duration.is_none() || duration < self.min_duration.unwrap() {
            self.min_duration = Some(duration);
        }
        if self.max_duration.is_none() || duration > self.max_duration.unwrap() {
            self.max_duration = Some(duration);
        }
        
        self.avg_duration = Some(self.total_duration / self.count as u32);
        
        if timeout {
            self.timeout_count += 1;
        } else if success {
            self.success_count += 1;
        } else {
            self.failure_count += 1;
        }
        
        self.recalculate_averages();
    }
    
    pub fn recalculate_averages(&mut self) {
        if self.count > 0 {
            self.avg_duration = Some(self.total_duration / self.count as u32);
            self.success_rate = self.success_count as f64 / self.count as f64;
        } else {
            self.avg_duration = None;
            self.success_rate = 0.0;
        }
    }
}