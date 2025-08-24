//! Load testing suite for GraphRAG service performance validation
//! Tests database connection pooling, Redis caching, and overall system throughput

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tokio::{sync::Semaphore, time::sleep};
use tracing::{info, warn, debug};

/// Load test configuration for comprehensive performance testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadTestConfig {
    /// Base URL for the GraphRAG service
    pub service_url: String,
    /// Number of concurrent users to simulate
    pub concurrent_users: usize,
    /// Duration of the load test
    pub test_duration: Duration,
    /// Request rate per second per user
    pub requests_per_second: f64,
    /// Test scenarios to execute
    pub scenarios: Vec<TestScenario>,
    /// Connection timeout for HTTP requests
    pub request_timeout: Duration,
    /// Whether to enable detailed metrics
    pub detailed_metrics: bool,
}

impl Default for LoadTestConfig {
    fn default() -> Self {
        Self {
            service_url: "http://localhost:8000".to_string(),
            concurrent_users: 50,
            test_duration: Duration::from_secs(300), // 5 minutes
            requests_per_second: 2.0,
            scenarios: vec![
                TestScenario::EntityExtraction,
                TestScenario::VectorSearch,
                TestScenario::HybridSearch,
                TestScenario::CacheTest,
            ],
            request_timeout: Duration::from_secs(30),
            detailed_metrics: true,
        }
    }
}

/// Different test scenarios for comprehensive load testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestScenario {
    /// Test entity extraction performance
    EntityExtraction,
    /// Test vector search performance
    VectorSearch,
    /// Test hybrid search (vector + graph) performance
    HybridSearch,
    /// Test Redis caching effectiveness
    CacheTest,
    /// Test database connection pooling under load
    ConnectionPoolTest,
    /// Test end-to-end workflow performance
    EndToEndWorkflow,
}

/// Load test metrics and results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadTestResults {
    /// Total number of requests made
    pub total_requests: u64,
    /// Number of successful requests
    pub successful_requests: u64,
    /// Number of failed requests
    pub failed_requests: u64,
    /// Average response time in milliseconds
    pub avg_response_time_ms: f64,
    /// 95th percentile response time
    pub p95_response_time_ms: f64,
    /// 99th percentile response time
    pub p99_response_time_ms: f64,
    /// Requests per second achieved
    pub requests_per_second: f64,
    /// Error rate as percentage
    pub error_rate_percent: f64,
    /// Cache hit rate (if applicable)
    pub cache_hit_rate_percent: Option<f64>,
    /// Database connection pool stats
    pub pool_stats: Option<PoolPerformanceStats>,
    /// Individual scenario results
    pub scenario_results: Vec<ScenarioResult>,
}

/// Database connection pool performance statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolPerformanceStats {
    /// Average time to acquire connection (ms)
    pub avg_connection_acquire_time_ms: f64,
    /// Maximum connection pool utilization
    pub max_pool_utilization_percent: f64,
    /// Number of connection timeouts
    pub connection_timeouts: u64,
    /// Average active connections during test
    pub avg_active_connections: f64,
}

/// Results for individual test scenarios
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioResult {
    /// Scenario type
    pub scenario: TestScenario,
    /// Number of requests for this scenario
    pub requests: u64,
    /// Success rate for this scenario
    pub success_rate_percent: f64,
    /// Average response time for this scenario
    pub avg_response_time_ms: f64,
    /// Throughput for this scenario
    pub throughput_rps: f64,
}

/// Load test executor for running comprehensive performance tests
pub struct LoadTestExecutor {
    config: LoadTestConfig,
    client: reqwest::Client,
    metrics: Arc<LoadTestMetrics>,
}

/// Thread-safe metrics collection
#[derive(Debug)]
pub struct LoadTestMetrics {
    pub total_requests: AtomicU64,
    pub successful_requests: AtomicU64,
    pub failed_requests: AtomicU64,
    pub response_times: Arc<tokio::sync::Mutex<Vec<Duration>>>,
    pub cache_hits: AtomicU64,
    pub cache_misses: AtomicU64,
    pub connection_acquire_times: Arc<tokio::sync::Mutex<Vec<Duration>>>,
}

impl LoadTestMetrics {
    pub fn new() -> Self {
        Self {
            total_requests: AtomicU64::new(0),
            successful_requests: AtomicU64::new(0),
            failed_requests: AtomicU64::new(0),
            response_times: Arc::new(tokio::sync::Mutex::new(Vec::new())),
            cache_hits: AtomicU64::new(0),
            cache_misses: AtomicU64::new(0),
            connection_acquire_times: Arc::new(tokio::sync::Mutex::new(Vec::new())),
        }
    }

    pub async fn record_response_time(&self, duration: Duration) {
        let mut times = self.response_times.lock().await;
        times.push(duration);
    }

    pub async fn record_connection_acquire_time(&self, duration: Duration) {
        let mut times = self.connection_acquire_times.lock().await;
        times.push(duration);
    }

    pub async fn generate_results(&self, test_duration: Duration) -> LoadTestResults {
        let total_requests = self.total_requests.load(Ordering::Relaxed);
        let successful_requests = self.successful_requests.load(Ordering::Relaxed);
        let failed_requests = self.failed_requests.load(Ordering::Relaxed);

        let response_times = self.response_times.lock().await;
        let mut sorted_times: Vec<f64> = response_times
            .iter()
            .map(|d| d.as_millis() as f64)
            .collect();
        sorted_times.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let avg_response_time_ms = if !sorted_times.is_empty() {
            sorted_times.iter().sum::<f64>() / sorted_times.len() as f64
        } else {
            0.0
        };

        let p95_response_time_ms = if !sorted_times.is_empty() {
            let index = (sorted_times.len() as f64 * 0.95) as usize;
            sorted_times.get(index).copied().unwrap_or(0.0)
        } else {
            0.0
        };

        let p99_response_time_ms = if !sorted_times.is_empty() {
            let index = (sorted_times.len() as f64 * 0.99) as usize;
            sorted_times.get(index).copied().unwrap_or(0.0)
        } else {
            0.0
        };

        let requests_per_second = total_requests as f64 / test_duration.as_secs_f64();
        let error_rate_percent = if total_requests > 0 {
            (failed_requests as f64 / total_requests as f64) * 100.0
        } else {
            0.0
        };

        let cache_hits = self.cache_hits.load(Ordering::Relaxed);
        let cache_misses = self.cache_misses.load(Ordering::Relaxed);
        let cache_hit_rate_percent = if cache_hits + cache_misses > 0 {
            Some((cache_hits as f64 / (cache_hits + cache_misses) as f64) * 100.0)
        } else {
            None
        };

        LoadTestResults {
            total_requests,
            successful_requests,
            failed_requests,
            avg_response_time_ms,
            p95_response_time_ms,
            p99_response_time_ms,
            requests_per_second,
            error_rate_percent,
            cache_hit_rate_percent,
            pool_stats: None, // TODO: Implement pool stats collection
            scenario_results: Vec::new(), // TODO: Implement scenario-specific results
        }
    }
}

impl LoadTestExecutor {
    /// Create a new load test executor
    pub fn new(config: LoadTestConfig) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(config.request_timeout)
            .build()
            .context("Failed to create HTTP client")?;

        let metrics = Arc::new(LoadTestMetrics::new());

        Ok(Self {
            config,
            client,
            metrics,
        })
    }

    /// Execute the complete load test suite
    pub async fn execute(&self) -> Result<LoadTestResults> {
        info!("🚀 Starting load test with {} concurrent users", self.config.concurrent_users);
        info!("📊 Test duration: {:?}", self.config.test_duration);
        info!("🎯 Target RPS per user: {}", self.config.requests_per_second);

        let start_time = Instant::now();
        let semaphore = Arc::new(Semaphore::new(self.config.concurrent_users));
        let mut handles = Vec::new();

        // Calculate request interval for rate limiting
        let request_interval = Duration::from_secs_f64(1.0 / self.config.requests_per_second);

        // Spawn concurrent user sessions
        for user_id in 0..self.config.concurrent_users {
            let executor = self.clone_for_user();
            let semaphore = semaphore.clone();
            let scenarios = self.config.scenarios.clone();
            let test_duration = self.config.test_duration;

            let handle = tokio::spawn(async move {
                let _permit = semaphore.acquire().await.unwrap();
                executor.run_user_session(user_id, scenarios, test_duration, request_interval).await
            });

            handles.push(handle);
        }

        // Wait for all user sessions to complete
        for handle in handles {
            if let Err(e) = handle.await {
                warn!("User session failed: {}", e);
            }
        }

        let actual_duration = start_time.elapsed();
        let results = self.metrics.generate_results(actual_duration).await;

        info!("✅ Load test completed");
        info!("📈 Results: {} total requests, {:.2}% success rate", 
              results.total_requests, 
              100.0 - results.error_rate_percent);
        info!("⚡ Throughput: {:.2} RPS", results.requests_per_second);
        info!("⏱️  Average response time: {:.2}ms", results.avg_response_time_ms);
        info!("📊 P95 response time: {:.2}ms", results.p95_response_time_ms);

        if let Some(cache_hit_rate) = results.cache_hit_rate_percent {
            info!("🎯 Cache hit rate: {:.2}%", cache_hit_rate);
        }

        Ok(results)
    }

    /// Clone executor for individual user sessions
    fn clone_for_user(&self) -> LoadTestExecutor {
        LoadTestExecutor {
            config: self.config.clone(),
            client: self.client.clone(),
            metrics: self.metrics.clone(),
        }
    }

    /// Run a single user session with multiple scenarios
    async fn run_user_session(
        &self,
        user_id: usize,
        scenarios: Vec<TestScenario>,
        duration: Duration,
        request_interval: Duration,
    ) -> Result<()> {
        let start_time = Instant::now();
        let mut scenario_index = 0;

        debug!("User {} starting session", user_id);

        while start_time.elapsed() < duration {
            // Cycle through scenarios
            let scenario = &scenarios[scenario_index % scenarios.len()];
            scenario_index += 1;

            // Execute scenario
            if let Err(e) = self.execute_scenario(user_id, scenario).await {
                warn!("User {} scenario {:?} failed: {}", user_id, scenario, e);
                self.metrics.failed_requests.fetch_add(1, Ordering::Relaxed);
            } else {
                self.metrics.successful_requests.fetch_add(1, Ordering::Relaxed);
            }

            self.metrics.total_requests.fetch_add(1, Ordering::Relaxed);

            // Rate limiting
            sleep(request_interval).await;
        }

        debug!("User {} session completed", user_id);
        Ok(())
    }

    /// Execute a specific test scenario
    async fn execute_scenario(&self, user_id: usize, scenario: &TestScenario) -> Result<()> {
        let start_time = Instant::now();

        let result = match scenario {
            TestScenario::EntityExtraction => self.test_entity_extraction(user_id).await,
            TestScenario::VectorSearch => self.test_vector_search(user_id).await,
            TestScenario::HybridSearch => self.test_hybrid_search(user_id).await,
            TestScenario::CacheTest => self.test_cache_performance(user_id).await,
            TestScenario::ConnectionPoolTest => self.test_connection_pool(user_id).await,
            TestScenario::EndToEndWorkflow => self.test_end_to_end_workflow(user_id).await,
        };

        let response_time = start_time.elapsed();
        self.metrics.record_response_time(response_time).await;

        result
    }

    /// Test entity extraction performance
    async fn test_entity_extraction(&self, user_id: usize) -> Result<()> {
        let text_samples = vec![
            "Apple Inc. was founded by Steve Jobs in Cupertino, California.",
            "The artificial intelligence revolution is transforming how we work with data.",
            "Microsoft Azure provides cloud computing services to millions of users.",
            "Machine learning algorithms are becoming increasingly sophisticated.",
        ];

        let text = text_samples[user_id % text_samples.len()];
        let request_body = serde_json::json!({
            "text": text,
            "user_id": format!("load_test_user_{}", user_id)
        });

        let response = self.client
            .post(&format!("{}/api/extract", self.config.service_url))
            .json(&request_body)
            .send()
            .await
            .context("Entity extraction request failed")?;

        if response.status().is_success() {
            let _body: serde_json::Value = response.json().await
                .context("Failed to parse entity extraction response")?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Entity extraction failed with status: {}", response.status()))
        }
    }

    /// Test vector search performance
    async fn test_vector_search(&self, user_id: usize) -> Result<()> {
        let search_queries = vec![
            "artificial intelligence",
            "machine learning",
            "data science",
            "cloud computing",
            "software engineering",
        ];

        let query = search_queries[user_id % search_queries.len()];
        let request_body = serde_json::json!({
            "query": query,
            "user_id": format!("load_test_user_{}", user_id)
        });

        let response = self.client
            .post(&format!("{}/api/search", self.config.service_url))
            .json(&request_body)
            .send()
            .await
            .context("Vector search request failed")?;

        if response.status().is_success() {
            let _body: serde_json::Value = response.json().await
                .context("Failed to parse vector search response")?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Vector search failed with status: {}", response.status()))
        }
    }

    /// Test hybrid search performance
    async fn test_hybrid_search(&self, user_id: usize) -> Result<()> {
        let hybrid_queries = vec![
            "Find AI companies in Silicon Valley",
            "Machine learning research papers from 2024",
            "Cloud computing trends and innovations",
            "Data science tools and frameworks",
        ];

        let query = hybrid_queries[user_id % hybrid_queries.len()];
        let request_body = serde_json::json!({
            "query": query,
            "hybrid": true,
            "user_id": format!("load_test_user_{}", user_id)
        });

        let response = self.client
            .post(&format!("{}/api/search", self.config.service_url))
            .json(&request_body)
            .send()
            .await
            .context("Hybrid search request failed")?;

        if response.status().is_success() {
            let body: serde_json::Value = response.json().await
                .context("Failed to parse hybrid search response")?;
            
            // Check for cache hit indicators in response
            if let Some(cache_hit) = body.get("cache_hit").and_then(|v| v.as_bool()) {
                if cache_hit {
                    self.metrics.cache_hits.fetch_add(1, Ordering::Relaxed);
                } else {
                    self.metrics.cache_misses.fetch_add(1, Ordering::Relaxed);
                }
            }
            
            Ok(())
        } else {
            Err(anyhow::anyhow!("Hybrid search failed with status: {}", response.status()))
        }
    }

    /// Test cache performance by making repeated requests
    async fn test_cache_performance(&self, user_id: usize) -> Result<()> {
        // Use consistent data to test cache effectiveness
        let cache_test_text = "This is a cache performance test for Redis optimization validation.";
        let request_body = serde_json::json!({
            "text": cache_test_text,
            "user_id": "cache_test_user"
        });

        let response = self.client
            .post(&format!("{}/api/extract", self.config.service_url))
            .json(&request_body)
            .send()
            .await
            .context("Cache test request failed")?;

        if response.status().is_success() {
            let body: serde_json::Value = response.json().await
                .context("Failed to parse cache test response")?;
            
            // Track cache performance
            if let Some(cache_hit) = body.get("cache_hit").and_then(|v| v.as_bool()) {
                if cache_hit {
                    self.metrics.cache_hits.fetch_add(1, Ordering::Relaxed);
                } else {
                    self.metrics.cache_misses.fetch_add(1, Ordering::Relaxed);
                }
            }
            
            Ok(())
        } else {
            Err(anyhow::anyhow!("Cache test failed with status: {}", response.status()))
        }
    }

    /// Test database connection pool performance
    async fn test_connection_pool(&self, user_id: usize) -> Result<()> {
        let connection_start = Instant::now();
        
        // Make a request that exercises database connections
        let request_body = serde_json::json!({
            "query": "connection pool test",
            "user_id": format!("pool_test_user_{}", user_id)
        });

        let response = self.client
            .post(&format!("{}/api/search", self.config.service_url))
            .json(&request_body)
            .send()
            .await
            .context("Connection pool test request failed")?;

        let connection_time = connection_start.elapsed();
        self.metrics.record_connection_acquire_time(connection_time).await;

        if response.status().is_success() {
            let _body: serde_json::Value = response.json().await
                .context("Failed to parse connection pool test response")?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Connection pool test failed with status: {}", response.status()))
        }
    }

    /// Test end-to-end workflow performance
    async fn test_end_to_end_workflow(&self, user_id: usize) -> Result<()> {
        // Step 1: Extract entities
        self.test_entity_extraction(user_id).await?;
        
        // Step 2: Search for related content
        self.test_vector_search(user_id).await?;
        
        // Step 3: Perform hybrid search
        self.test_hybrid_search(user_id).await?;
        
        Ok(())
    }
}

/// Comprehensive load test runner with reporting
pub struct LoadTestRunner {
    config: LoadTestConfig,
}

impl LoadTestRunner {
    pub fn new(config: LoadTestConfig) -> Self {
        Self { config }
    }

    /// Run the complete load test suite and generate reports
    pub async fn run(&self) -> Result<LoadTestResults> {
        let executor = LoadTestExecutor::new(self.config.clone())?;
        let results = executor.execute().await?;
        
        // Generate detailed report
        self.generate_report(&results).await?;
        
        Ok(results)
    }

    /// Generate comprehensive load test report
    async fn generate_report(&self, results: &LoadTestResults) -> Result<()> {
        let report = serde_json::to_string_pretty(results)
            .context("Failed to serialize load test results")?;

        // Write report to file
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let report_path = format!("load_test_report_{}.json", timestamp);
        
        tokio::fs::write(&report_path, report)
            .await
            .context("Failed to write load test report")?;

        info!("📋 Load test report saved to: {}", report_path);
        
        // Print summary to console
        self.print_summary(results);
        
        Ok(())
    }

    /// Print load test summary to console
    fn print_summary(&self, results: &LoadTestResults) {
        println!("\n🎯 LOAD TEST SUMMARY");
        println!("==================");
        println!("Total Requests: {}", results.total_requests);
        println!("Successful: {} ({:.2}%)", 
                 results.successful_requests,
                 (results.successful_requests as f64 / results.total_requests as f64) * 100.0);
        println!("Failed: {} ({:.2}%)", 
                 results.failed_requests,
                 results.error_rate_percent);
        println!("Throughput: {:.2} RPS", results.requests_per_second);
        println!("Avg Response Time: {:.2}ms", results.avg_response_time_ms);
        println!("P95 Response Time: {:.2}ms", results.p95_response_time_ms);
        println!("P99 Response Time: {:.2}ms", results.p99_response_time_ms);
        
        if let Some(cache_hit_rate) = results.cache_hit_rate_percent {
            println!("Cache Hit Rate: {:.2}%", cache_hit_rate);
        }
        
        println!("==================\n");
    }
}