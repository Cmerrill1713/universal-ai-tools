use serde::{Deserialize, Serialize};
use std::env;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct RagProviderConfig {
    pub provider: String, // supabase | weaviate | fallback
    pub supabase_url: String,
    pub supabase_key: String,
    pub weaviate_url: String,
    pub ollama_url: String,
    pub embedding_model: String,
}

impl RagProviderConfig {
    pub fn from_env() -> Self {
        Self {
            provider: env::var("RAG_PROVIDER").unwrap_or_else(|_| "supabase".to_string()),
            supabase_url: env::var("SUPABASE_URL").unwrap_or_else(|_| "http://127.0.0.1:54321".to_string()),
            supabase_key: env::var("SUPABASE_SERVICE_KEY").or_else(|_| env::var("SUPABASE_ANON_KEY")).unwrap_or_default(),
            weaviate_url: env::var("WEAVIATE_URL").unwrap_or_default(),
            ollama_url: env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string()),
            embedding_model: env::var("EMBEDDING_MODEL").unwrap_or_else(|_| "all-minilm:latest".to_string()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HybridSearchRow {
    pub id: String,
    pub table_name: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub semantic_score: Option<f32>,
    pub text_score: Option<f32>,
    pub combined_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time_ms: f64,
    pub provider_health: HashMap<String, bool>,
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_success_timestamp: Option<u64>,
}

impl Default for RagMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            average_response_time_ms: 0.0,
            provider_health: HashMap::new(),
            last_error: None,
            last_success_timestamp: None,
        }
    }
}

pub struct RagProvider {
    impls: RagProviderImpl,
    metrics: Arc<RwLock<RagMetrics>>,
}

enum RagProviderImpl {
    Supabase(SupabaseProvider),
    Weaviate(WeaviateProvider),
    Fallback(FallbackProvider),
}

impl RagProvider {
    pub fn from_env(cfg: RagProviderConfig) -> anyhow::Result<Self> {
        let impls = match cfg.provider.to_lowercase().as_str() {
            "supabase" | "pgvector" => RagProviderImpl::Supabase(SupabaseProvider { cfg }),
            "weaviate" => RagProviderImpl::Weaviate(WeaviateProvider { cfg }),
            _ => RagProviderImpl::Fallback(FallbackProvider {}),
        };
        Ok(Self {
            impls,
            metrics: Arc::new(RwLock::new(RagMetrics::default())),
        })
    }

    pub async fn search(&self, query: &str, k: usize, semantic_weight: f32) -> anyhow::Result<Vec<HybridSearchRow>> {
        let start_time = Instant::now();

        // Update metrics
        {
            let mut metrics = self.metrics.write().await;
            metrics.total_requests += 1;
        }

        let result = match &self.impls {
            RagProviderImpl::Supabase(p) => {
                self.search_with_retry(p, query, k, semantic_weight).await
            },
            RagProviderImpl::Weaviate(p) => {
                self.search_with_retry(p, query, k, semantic_weight).await
            },
            RagProviderImpl::Fallback(p) => {
                p.search(query, k, semantic_weight).await
            },
        };

        let duration = start_time.duration_since(start_time);

        // Update metrics based on result
        {
            let mut metrics = self.metrics.write().await;
            let response_time_ms = duration.as_millis() as f64;

            // Update average response time
            let total_requests = metrics.total_requests as f64;
            metrics.average_response_time_ms =
                (metrics.average_response_time_ms * (total_requests - 1.0) + response_time_ms) / total_requests;

            match &result {
                Ok(_) => {
                    metrics.successful_requests += 1;
                    metrics.last_success_timestamp = Some(
                        SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs()
                    );
                },
                Err(e) => {
                    metrics.failed_requests += 1;
                    metrics.last_error = Some(e.to_string());
                }
            }
        }

        result
    }

    pub async fn search_multi_hop(&self, query: &str, k: usize, semantic_weight: f32, traversal_depth: i32, max_paths: i32) -> anyhow::Result<(Vec<HybridSearchRow>, Vec<crate::rag::ReasoningPath>)> {
        let start_time = Instant::now();

        // Update metrics
        {
            let mut metrics = self.metrics.write().await;
            metrics.total_requests += 1;
        }

        let result = match &self.impls {
            RagProviderImpl::Supabase(p) => {
                self.search_multi_hop_with_retry(p, query, k, semantic_weight, traversal_depth, max_paths).await
            },
            RagProviderImpl::Weaviate(p) => {
                // Weaviate doesn't support multi-hop yet, fallback to single-hop
                let rows = self.search_with_retry(p, query, k, semantic_weight).await?;
                Ok((rows, Vec::new()))
            },
            RagProviderImpl::Fallback(p) => {
                // Fallback doesn't support multi-hop, use single-hop
                let rows = p.search(query, k, semantic_weight).await?;
                Ok((rows, Vec::new()))
            },
        };

        let duration = start_time.duration_since(start_time);

        // Update metrics based on result
        {
            let mut metrics = self.metrics.write().await;
            let response_time_ms = duration.as_millis() as f64;

            // Update average response time
            let total_requests = metrics.total_requests as f64;
            metrics.average_response_time_ms =
                (metrics.average_response_time_ms * (total_requests - 1.0) + response_time_ms) / total_requests;

            match &result {
                Ok(_) => {
                    metrics.successful_requests += 1;
                    metrics.last_success_timestamp = Some(
                        SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs()
                    );
                },
                Err(e) => {
                    metrics.failed_requests += 1;
                    metrics.last_error = Some(e.to_string());
                }
            }
        }

        result
    }

    async fn search_with_retry<P>(&self, provider: &P, query: &str, k: usize, semantic_weight: f32) -> anyhow::Result<Vec<HybridSearchRow>>
    where
        P: RagProviderTrait,
    {
        let max_retries = 3;
        let mut last_error = None;

        for attempt in 0..max_retries {
            match provider.search(query, k, semantic_weight).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    last_error = Some(e);
                    if attempt < max_retries - 1 {
                        // Exponential backoff
                        let delay = Duration::from_millis(100 * (2_u64.pow(attempt)));
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }

        Err(last_error.unwrap())
    }

    async fn search_multi_hop_with_retry<P>(&self, provider: &P, query: &str, k: usize, semantic_weight: f32, traversal_depth: i32, max_paths: i32) -> anyhow::Result<(Vec<HybridSearchRow>, Vec<crate::rag::ReasoningPath>)>
    where
        P: RagProviderTrait,
    {
        let max_retries = 3;
        let mut last_error = None;

        for attempt in 0..max_retries {
            match provider.search_multi_hop(query, k, semantic_weight, traversal_depth, max_paths).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    last_error = Some(e);
                    if attempt < max_retries - 1 {
                        // Exponential backoff
                        let delay = Duration::from_millis(100 * (2_u64.pow(attempt)));
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }

        Err(last_error.unwrap())
    }

    pub async fn get_metrics(&self) -> RagMetrics {
        self.metrics.read().await.clone()
    }


    pub async fn health_check(&self) -> HashMap<String, bool> {
        let mut health = HashMap::new();

        match &self.impls {
            RagProviderImpl::Supabase(p) => {
                health.insert("supabase".to_string(), p.health_check().await);
            },
            RagProviderImpl::Weaviate(p) => {
                health.insert("weaviate".to_string(), p.health_check().await);
            },
            RagProviderImpl::Fallback(_) => {
                health.insert("fallback".to_string(), true);
            },
        }

        // Update metrics with health status
        {
            let mut metrics = self.metrics.write().await;
            metrics.provider_health = health.clone();
        }

        health
    }
}

trait RagProviderTrait {
    async fn search(&self, query: &str, k: usize, semantic_weight: f32) -> anyhow::Result<Vec<HybridSearchRow>>;
    async fn search_multi_hop(&self, query: &str, k: usize, semantic_weight: f32, traversal_depth: i32, max_paths: i32) -> anyhow::Result<(Vec<HybridSearchRow>, Vec<crate::rag::ReasoningPath>)>;
    async fn health_check(&self) -> bool;
}

struct SupabaseProvider { cfg: RagProviderConfig }
struct WeaviateProvider { cfg: RagProviderConfig }
struct FallbackProvider {}

impl SupabaseProvider {
    async fn check_ollama_health(&self) -> bool {
        let client = reqwest::Client::new();
        match client
            .get(format!("{}/api/tags", self.cfg.ollama_url.trim_end_matches('/')))
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    async fn check_supabase_health(&self) -> bool {
        if self.cfg.supabase_key.is_empty() {
            return false;
        }

        let client = reqwest::Client::new();
        match client
            .get(format!("{}/rest/v1/", self.cfg.supabase_url.trim_end_matches('/')))
            .header("apikey", &self.cfg.supabase_key)
            .header("Authorization", format!("Bearer {}", &self.cfg.supabase_key))
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }
}

impl RagProviderTrait for SupabaseProvider {
    async fn search(&self, query: &str, k: usize, semantic_weight: f32) -> anyhow::Result<Vec<HybridSearchRow>> {
        // 1) Embed query with improved error handling
        #[derive(Serialize)]
        struct EmbReq<'a> { model: &'a str, prompt: &'a str }
        #[derive(Deserialize)]
        struct EmbResp { embedding: Vec<f32> }

        let emb = reqwest::Client::new()
            .post(format!("{}/api/embeddings", self.cfg.ollama_url.trim_end_matches('/')))
            .json(&EmbReq { model: &self.cfg.embedding_model, prompt: query })
            .timeout(Duration::from_secs(10))
            .send().await
            .map_err(|e| anyhow::anyhow!("Failed to connect to Ollama embeddings: {}", e))?;

        if !emb.status().is_success() {
            anyhow::bail!("Ollama embedding request failed with status: {}", emb.status());
        }

        let emb: EmbResp = emb.json().await
            .map_err(|e| anyhow::anyhow!("Failed to parse embedding response: {}", e))?;

        // 2) Supabase RPC
        #[derive(Serialize)]
        struct RpcBody<'a> {
            query_text: &'a str,
            query_embedding: &'a Vec<f32>,
            match_limit: i32,
            semantic_weight: f32,
        }
        let body = RpcBody { query_text: query, query_embedding: &emb.embedding, match_limit: k as i32, semantic_weight };
        let rpc_url = format!("{}/rest/v1/rpc/hybrid_search", self.cfg.supabase_url.trim_end_matches('/'));
        let resp = reqwest::Client::new()
            .post(&rpc_url)
            .header("apikey", &self.cfg.supabase_key)
            .header("Authorization", format!("Bearer {}", &self.cfg.supabase_key))
            .header("Content-Type", "application/json")
            .timeout(Duration::from_secs(15))
            .json(&body)
            .send().await
            .map_err(|e| anyhow::anyhow!("Failed to connect to Supabase: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            tracing::warn!("Supabase hybrid_search failed with status {}: {}", status, error_text);
            return Ok(vec![]); // Gracefully return empty results
        }

        let rows: Vec<HybridSearchRow> = resp.json().await
            .map_err(|e| anyhow::anyhow!("Failed to parse Supabase response: {}", e))
            .unwrap_or_default();
        Ok(rows)
    }

    async fn search_multi_hop(&self, query: &str, k: usize, semantic_weight: f32, traversal_depth: i32, max_paths: i32) -> anyhow::Result<(Vec<HybridSearchRow>, Vec<crate::rag::ReasoningPath>)> {
        // 1) Embed query
        #[derive(Serialize)]
        struct EmbReq<'a> { model: &'a str, prompt: &'a str }
        #[derive(Deserialize)]
        struct EmbResp { embedding: Vec<f32> }
        let emb = reqwest::Client::new()
            .post(format!("{}/api/embeddings", self.cfg.ollama_url.trim_end_matches('/')))
            .json(&EmbReq { model: &self.cfg.embedding_model, prompt: query })
            .timeout(Duration::from_secs(10))
            .send().await
            .map_err(|e| anyhow::anyhow!("Failed to connect to Ollama embeddings for multi-hop: {}", e))?;

        if !emb.status().is_success() {
            anyhow::bail!("Ollama embedding request failed for multi-hop with status: {}", emb.status());
        }

        let emb: EmbResp = emb.json().await
            .map_err(|e| anyhow::anyhow!("Failed to parse embedding response for multi-hop: {}", e))?;

        // 2) Call knowledge graph traversal function
        #[derive(Serialize)]
        struct GraphRpcBody<'a> {
            start_query: &'a str,
            start_embedding: &'a Vec<f32>,
            traversal_depth: i32,
            max_paths: i32,
            connection_types: Option<Vec<&'a str>>,
        }
        let body = GraphRpcBody {
            start_query: query,
            start_embedding: &emb.embedding,
            traversal_depth,
            max_paths,
            connection_types: None, // Use all connection types
        };
        let rpc_url = format!("{}/rest/v1/rpc/search_knowledge_graph", self.cfg.supabase_url.trim_end_matches('/'));
        let resp = reqwest::Client::new()
            .post(&rpc_url)
            .header("apikey", &self.cfg.supabase_key)
            .header("Authorization", format!("Bearer {}", &self.cfg.supabase_key))
            .header("Content-Type", "application/json")
            .timeout(Duration::from_secs(15))
            .json(&body)
            .send().await
            .map_err(|e| anyhow::anyhow!("Failed to connect to Supabase knowledge graph: {}", e))?;

        if !resp.status().is_success() {
            // Fallback to single-hop search with better error logging
            let status = resp.status();
            let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            tracing::warn!("Multi-hop search failed with status {}: {}, falling back to single-hop", status, error_text);
            let rows = self.search(query, k, semantic_weight).await?;
            return Ok((rows, Vec::new()));
        }

        // 3) Parse knowledge graph results
        #[derive(Deserialize)]
        struct GraphPath {
            path_id: i32,
            memory_sequence: Vec<String>,
            content_sequence: Vec<String>,
            domain_sequence: Vec<String>,
            total_strength: f32,
            path_description: String,
        }
        let graph_paths: Vec<GraphPath> = resp.json().await.unwrap_or_default();

        // 4) Convert to HybridSearchRow and ReasoningPath
        let mut all_rows = Vec::new();
        let mut reasoning_paths = Vec::new();

        for path in graph_paths {
            // Clone sequences before moving them
            let memory_sequence = path.memory_sequence.clone();
            let content_sequence = path.content_sequence.clone();

            // Create reasoning path
            reasoning_paths.push(crate::rag::ReasoningPath {
                path_id: path.path_id as u32,
                memory_sequence: path.memory_sequence,
                content_sequence: path.content_sequence,
                domain_sequence: path.domain_sequence,
                total_strength: path.total_strength,
                path_description: path.path_description,
            });

            // Convert memory sequence to HybridSearchRow (simplified)
            // In a real implementation, you'd fetch the actual memory content
            for (i, memory_id) in memory_sequence.iter().enumerate() {
                if i < content_sequence.len() {
                    all_rows.push(HybridSearchRow {
                        id: memory_id.clone(),
                        table_name: "ai_memories".to_string(),
                        content: content_sequence[i].clone(),
                        title: None,
                        semantic_score: Some(path.total_strength),
                        text_score: Some(path.total_strength),
                        combined_score: path.total_strength,
                    });
                }
            }
        }

        // 5) Limit results to k
        all_rows.sort_by(|a, b| b.combined_score.partial_cmp(&a.combined_score).unwrap());
        all_rows.truncate(k);

        Ok((all_rows, reasoning_paths))
    }

    async fn health_check(&self) -> bool {
        // Check both Ollama embeddings and Supabase
        let ollama_healthy = self.check_ollama_health().await;
        let supabase_healthy = self.check_supabase_health().await;

        ollama_healthy && supabase_healthy
    }
}

impl RagProviderTrait for WeaviateProvider {
    async fn search(&self, query: &str, k: usize, _semantic_weight: f32) -> anyhow::Result<Vec<HybridSearchRow>> {
        if self.cfg.weaviate_url.is_empty() { return Ok(vec![]); }
        let graphql_query = format!(
            r#"{{ Get {{ Document (nearText: {{ concepts: [\"{}\"] }}, limit: {}) {{ id content title _additional {{ certainty }} }} }} }}"#,
            query.replace('"', "\""), k
        );
        let resp = reqwest::Client::new()
            .post(format!("{}/v1/graphql", self.cfg.weaviate_url.trim_end_matches('/')))
            .json(&serde_json::json!({"query": graphql_query}))
            .send().await?;
        if !resp.status().is_success() { return Ok(vec![]); }
        let val: serde_json::Value = resp.json().await?;
        let arr = val["data"]["Get"]["Document"].as_array().cloned().unwrap_or_default();
        let mut out = Vec::new();
        for obj in arr {
            let id = obj["id"].as_str().unwrap_or("").to_string();
            let content = obj["content"].as_str().unwrap_or("").to_string();
            let title = obj["title"].as_str().map(|s| s.to_string());
            let score = obj["_additional"]["certainty"].as_f64().unwrap_or(0.0) as f32;
            out.push(HybridSearchRow { id, table_name: "weaviate".into(), content, title, semantic_score: None, text_score: None, combined_score: score });
        }
        Ok(out)
    }

    async fn search_multi_hop(&self, query: &str, k: usize, semantic_weight: f32, _traversal_depth: i32, _max_paths: i32) -> anyhow::Result<(Vec<HybridSearchRow>, Vec<crate::rag::ReasoningPath>)> {
        // Weaviate doesn't support multi-hop yet, fallback to single-hop
        let rows = self.search(query, k, semantic_weight).await?;
        Ok((rows, Vec::new()))
    }

    async fn health_check(&self) -> bool {
        if self.cfg.weaviate_url.is_empty() {
            return false;
        }

        // Check if Weaviate is reachable
        match reqwest::Client::new()
            .get(format!("{}/v1/meta", self.cfg.weaviate_url.trim_end_matches('/')))
            .timeout(Duration::from_secs(5))
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }
}

impl RagProviderTrait for FallbackProvider {
    async fn search(&self, _query: &str, _k: usize, _semantic_weight: f32) -> anyhow::Result<Vec<HybridSearchRow>> {
        Ok(vec![])
    }

    async fn search_multi_hop(&self, _query: &str, _k: usize, _semantic_weight: f32, _traversal_depth: i32, _max_paths: i32) -> anyhow::Result<(Vec<HybridSearchRow>, Vec<crate::rag::ReasoningPath>)> {
        Ok((vec![], vec![]))
    }

    async fn health_check(&self) -> bool {
        true // Fallback is always "healthy" but returns empty results
    }
}
