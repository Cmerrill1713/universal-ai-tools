use anyhow::{Result, anyhow};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env};
use tracing::{info, warn, error, debug};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeDocument {
    pub id: Option<Uuid>,
    pub title: String,
    pub content: String,
    pub category: String,
    pub subcategory: Option<String>,
    pub source: String,
    pub source_url: Option<String>,
    pub file_path: Option<String>,
    pub metadata: serde_json::Value,
    pub tags: Vec<String>,
    pub language: String,
    pub relevance_score: f32,
    pub confidence_score: f32,
    pub created_by_user_id: Option<String>,
    pub session_id: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodePattern {
    pub id: Option<Uuid>,
    pub pattern_name: String,
    pub pattern_type: String,
    pub language: String,
    pub framework: Option<String>,
    pub problem_description: String,
    pub solution_code: String,
    pub example_usage: Option<String>,
    pub explanation: Option<String>,
    pub applicable_contexts: Vec<String>,
    pub success_rate: f32,
    pub performance_impact: Option<String>,
    pub difficulty_level: i32,
    pub metadata: serde_json::Value,
    pub tags: Vec<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIInsight {
    pub id: Option<Uuid>,
    pub insight_type: String,
    pub category: String,
    pub title: String,
    pub description: String,
    pub reasoning: Option<String>,
    pub recommendations: Vec<String>,
    pub confidence: f32,
    pub source_data: Option<serde_json::Value>,
    pub generated_by: String,
    pub model_used: Option<String>,
    pub validated: bool,
    pub effectiveness_score: Option<f32>,
    pub metadata: serde_json::Value,
    pub tags: Vec<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemKnowledge {
    pub id: Option<Uuid>,
    pub knowledge_type: String,
    pub system_component: String,
    pub name: String,
    pub description: String,
    pub current_value: Option<String>,
    pub recommended_value: Option<String>,
    pub documentation_url: Option<String>,
    pub configuration_path: Option<String>,
    pub environment: String,
    pub dependencies: Vec<String>,
    pub affects_components: Vec<String>,
    pub health_status: String,
    pub monitoring_enabled: bool,
    pub metadata: serde_json::Value,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationContext {
    pub id: Option<Uuid>,
    pub session_id: String,
    pub user_id: Option<String>,
    pub conversation_topic: Option<String>,
    pub context_summary: String,
    pub key_decisions: Vec<String>,
    pub action_items: Vec<String>,
    pub participants: Vec<String>,
    pub conversation_length: i32,
    pub complexity_level: i32,
    pub related_documents: Vec<Uuid>,
    pub related_patterns: Vec<Uuid>,
    pub followup_required: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult<T> {
    pub item: T,
    pub similarity: f32,
    pub rank: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub text: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
    pub model: String,
    pub usage: Option<serde_json::Value>,
}

pub struct SupabaseKnowledgeClient {
    client: Client,
    supabase_url: String,
    supabase_key: String,
    ollama_url: String,
    embedding_model: String,
}

impl SupabaseKnowledgeClient {
    pub fn new() -> Result<Self> {
        let supabase_url = env::var("SUPABASE_URL")
            .or_else(|_| Ok("http://127.0.0.1:54321".to_string()))?;
        let supabase_key = env::var("SUPABASE_SERVICE_KEY")
            .or_else(|_| env::var("SUPABASE_ANON_KEY"))
            .map_err(|_| anyhow!("SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY must be set"))?;
        let ollama_url = env::var("OLLAMA_URL")
            .unwrap_or_else(|_| "http://localhost:11434".to_string());
        let embedding_model = env::var("EMBEDDING_MODEL")
            .unwrap_or_else(|_| "mxbai-embed-large".to_string());

        Ok(Self {
            client: Client::new(),
            supabase_url,
            supabase_key,
            ollama_url,
            embedding_model,
        })
    }

    // Generate embeddings using local Ollama
    pub async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>> {
        let payload = serde_json::json!({
            "model": self.embedding_model,
            "prompt": text
        });

        debug!("Generating embedding for text: {}", text.chars().take(100).collect::<String>());

        let response = self
            .client
            .post(&format!("{}/api/embeddings", self.ollama_url))
            .json(&payload)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to connect to Ollama: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow!("Ollama API error: {}", response.status()));
        }

        let result: serde_json::Value = response.json().await?;
        let embedding = result["embedding"]
            .as_array()
            .ok_or_else(|| anyhow!("No embedding in response"))?
            .iter()
            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
            .collect();

        Ok(embedding)
    }

    // Store knowledge document with embedding
    pub async fn store_knowledge_document(&self, mut document: KnowledgeDocument) -> Result<Uuid> {
        // Generate embedding for the document
        let text_to_embed = format!("{} {}", document.title, document.content);
        let embedding = self.generate_embedding(&text_to_embed).await?;

        // Prepare the document data with embedding
        let mut document_data = serde_json::to_value(&document)?;
        document_data["embedding"] = serde_json::json!(format!("[{}]", 
            embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(",")));

        info!("Storing knowledge document: {} (category: {})", document.title, document.category);

        let response = self
            .client
            .post(&format!("{}/rest/v1/knowledge_documents", self.supabase_url))
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .json(&document_data)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to store document: {} - {}", response.status(), error_text));
        }

        let result: serde_json::Value = response.json().await?;
        let id = result[0]["id"]
            .as_str()
            .ok_or_else(|| anyhow!("No ID returned"))?;

        Ok(Uuid::parse_str(id)?)
    }

    // Semantic search for knowledge documents
    pub async fn search_knowledge_documents(
        &self, 
        query: &str,
        category_filter: Option<&str>,
        limit: Option<i32>
    ) -> Result<Vec<SearchResult<KnowledgeDocument>>> {
        info!("Searching knowledge documents for: {}", query);

        // Generate embedding for the query
        let query_embedding = self.generate_embedding(query).await?;

        // Prepare the search parameters
        let mut params = HashMap::new();
        params.insert("query_embedding", format!("[{}]", 
            query_embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(",")));
        params.insert("match_threshold", "0.5".to_string());
        params.insert("match_count", limit.unwrap_or(10).to_string());
        
        if let Some(category) = category_filter {
            params.insert("category_filter", category.to_string());
        }

        // Call the RPC function
        let response = self
            .client
            .post(&format!("{}/rest/v1/rpc/match_knowledge_documents", self.supabase_url))
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .json(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Search failed: {} - {}", response.status(), error_text));
        }

        let results: Vec<serde_json::Value> = response.json().await?;
        let mut search_results = Vec::new();

        for (index, result) in results.iter().enumerate() {
            let document: KnowledgeDocument = serde_json::from_value(result.clone())?;
            let similarity = result["similarity"].as_f64().unwrap_or(0.0) as f32;
            
            search_results.push(SearchResult {
                item: document,
                similarity,
                rank: index as i32 + 1,
            });
        }

        info!("Found {} matching documents", search_results.len());
        Ok(search_results)
    }

    // Store code pattern with embedding
    pub async fn store_code_pattern(&self, mut pattern: CodePattern) -> Result<Uuid> {
        let text_to_embed = format!("{} {} {}", 
            pattern.pattern_name, pattern.problem_description, pattern.solution_code);
        let embedding = self.generate_embedding(&text_to_embed).await?;

        let mut pattern_data = serde_json::to_value(&pattern)?;
        pattern_data["embedding"] = serde_json::json!(format!("[{}]", 
            embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(",")));

        info!("Storing code pattern: {} (language: {})", pattern.pattern_name, pattern.language);

        let response = self
            .client
            .post(&format!("{}/rest/v1/code_patterns", self.supabase_url))
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .json(&pattern_data)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to store pattern: {} - {}", response.status(), error_text));
        }

        let result: serde_json::Value = response.json().await?;
        let id = result[0]["id"]
            .as_str()
            .ok_or_else(|| anyhow!("No ID returned"))?;

        Ok(Uuid::parse_str(id)?)
    }

    // Search code patterns by similarity
    pub async fn search_code_patterns(
        &self, 
        query: &str,
        language_filter: Option<&str>,
        limit: Option<i32>
    ) -> Result<Vec<SearchResult<CodePattern>>> {
        info!("Searching code patterns for: {}", query);

        let query_embedding = self.generate_embedding(query).await?;

        let mut params = HashMap::new();
        params.insert("query_embedding", format!("[{}]", 
            query_embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(",")));
        params.insert("match_threshold", "0.6".to_string());
        params.insert("match_count", limit.unwrap_or(5).to_string());
        
        if let Some(language) = language_filter {
            params.insert("language_filter", language.to_string());
        }

        let response = self
            .client
            .post(&format!("{}/rest/v1/rpc/match_code_patterns", self.supabase_url))
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .json(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Pattern search failed: {} - {}", response.status(), error_text));
        }

        let results: Vec<serde_json::Value> = response.json().await?;
        let mut search_results = Vec::new();

        for (index, result) in results.iter().enumerate() {
            let pattern: CodePattern = serde_json::from_value(result.clone())?;
            let similarity = result["similarity"].as_f64().unwrap_or(0.0) as f32;
            
            search_results.push(SearchResult {
                item: pattern,
                similarity,
                rank: index as i32 + 1,
            });
        }

        info!("Found {} matching patterns", search_results.len());
        Ok(search_results)
    }

    // Store AI insight with embedding
    pub async fn store_ai_insight(&self, mut insight: AIInsight) -> Result<Uuid> {
        let text_to_embed = format!("{} {} {}", 
            insight.title, insight.description, 
            insight.reasoning.as_deref().unwrap_or(""));
        let embedding = self.generate_embedding(&text_to_embed).await?;

        let mut insight_data = serde_json::to_value(&insight)?;
        insight_data["embedding"] = serde_json::json!(format!("[{}]", 
            embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(",")));

        info!("Storing AI insight: {} (type: {})", insight.title, insight.insight_type);

        let response = self
            .client
            .post(&format!("{}/rest/v1/ai_insights", self.supabase_url))
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .json(&insight_data)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to store insight: {} - {}", response.status(), error_text));
        }

        let result: serde_json::Value = response.json().await?;
        let id = result[0]["id"]
            .as_str()
            .ok_or_else(|| anyhow!("No ID returned"))?;

        Ok(Uuid::parse_str(id)?)
    }

    // Store conversation context with embedding
    pub async fn store_conversation_context(&self, mut context: ConversationContext) -> Result<Uuid> {
        let text_to_embed = format!("{} {} {}", 
            context.conversation_topic.as_deref().unwrap_or(""),
            context.context_summary,
            context.key_decisions.join(" "));
        let embedding = self.generate_embedding(&text_to_embed).await?;

        let mut context_data = serde_json::to_value(&context)?;
        context_data["embedding"] = serde_json::json!(format!("[{}]", 
            embedding.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(",")));

        info!("Storing conversation context for session: {}", context.session_id);

        let response = self
            .client
            .post(&format!("{}/rest/v1/conversation_context", self.supabase_url))
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .json(&context_data)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to store context: {} - {}", response.status(), error_text));
        }

        let result: serde_json::Value = response.json().await?;
        let id = result[0]["id"]
            .as_str()
            .ok_or_else(|| anyhow!("No ID returned"))?;

        Ok(Uuid::parse_str(id)?)
    }

    // Get system knowledge by component
    pub async fn get_system_knowledge(&self, component: &str) -> Result<Vec<SystemKnowledge>> {
        info!("Retrieving system knowledge for component: {}", component);

        let response = self
            .client
            .get(&format!("{}/rest/v1/system_knowledge", self.supabase_url))
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .query(&[("system_component", format!("eq.{}", component))])
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("Failed to get system knowledge: {} - {}", response.status(), error_text));
        }

        let results: Vec<SystemKnowledge> = response.json().await?;
        info!("Retrieved {} system knowledge entries", results.len());
        
        Ok(results)
    }

    // Health check for the knowledge base connection
    pub async fn health_check(&self) -> Result<bool> {
        let response = self
            .client
            .get(&format!("{}/rest/v1/knowledge_documents", self.supabase_url))
            .header("apikey", &self.supabase_key)
            .header("Authorization", format!("Bearer {}", self.supabase_key))
            .query(&[("select", "count"), ("limit", "1")])
            .send()
            .await?;

        Ok(response.status().is_success())
    }

    // Get knowledge base statistics
    pub async fn get_statistics(&self) -> Result<serde_json::Value> {
        info!("Retrieving knowledge base statistics");

        // This would typically call a stored procedure that returns aggregate statistics
        let stats = serde_json::json!({
            "knowledge_documents_count": 0,
            "code_patterns_count": 0,
            "ai_insights_count": 0,
            "conversation_contexts_count": 0,
            "last_updated": chrono::Utc::now()
        });

        Ok(stats)
    }
}

// Helper functions for creating common knowledge entries
impl SupabaseKnowledgeClient {
    // Create a knowledge document from code analysis
    pub fn create_code_analysis_document(
        title: String,
        content: String,
        file_path: Option<String>,
        language: String,
        session_id: String
    ) -> KnowledgeDocument {
        KnowledgeDocument {
            id: None,
            title,
            content,
            category: "code_analysis".to_string(),
            subcategory: Some(language.clone()),
            source: "automated_analysis".to_string(),
            source_url: None,
            file_path,
            metadata: serde_json::json!({
                "language": language,
                "analysis_type": "automated",
                "generated_at": chrono::Utc::now()
            }),
            tags: vec![language, "code_analysis".to_string(), "automated".to_string()],
            language: "en".to_string(),
            relevance_score: 0.8,
            confidence_score: 0.7,
            created_by_user_id: Some("system".to_string()),
            session_id: Some(session_id),
            status: "active".to_string(),
        }
    }

    // Create an AI insight from system analysis
    pub fn create_system_insight(
        title: String,
        description: String,
        insight_type: String,
        recommendations: Vec<String>,
        confidence: f32,
        generated_by: String
    ) -> AIInsight {
        AIInsight {
            id: None,
            insight_type,
            category: "system_optimization".to_string(),
            title,
            description,
            reasoning: None,
            recommendations,
            confidence,
            source_data: None,
            generated_by,
            model_used: None,
            validated: false,
            effectiveness_score: None,
            metadata: serde_json::json!({
                "generated_at": chrono::Utc::now(),
                "auto_generated": true
            }),
            tags: vec!["system_optimization".to_string(), "automated".to_string()],
            status: "active".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_knowledge_client_creation() {
        // This test would only pass if environment variables are set
        // In a real scenario, you'd use test-specific configuration
        std::env::set_var("SUPABASE_SERVICE_KEY", "test_key");
        let client = SupabaseKnowledgeClient::new();
        assert!(client.is_ok());
    }

    #[test]
    fn test_knowledge_document_creation() {
        let doc = SupabaseKnowledgeClient::create_code_analysis_document(
            "Test Document".to_string(),
            "Test content".to_string(),
            Some("test.rs".to_string()),
            "rust".to_string(),
            "test_session".to_string()
        );
        
        assert_eq!(doc.title, "Test Document");
        assert_eq!(doc.category, "code_analysis");
        assert_eq!(doc.language, "en");
    }
}