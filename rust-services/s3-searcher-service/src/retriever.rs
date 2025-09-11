use anyhow::{Result, anyhow};
use async_trait::async_trait;
use serde_json::json;
use tracing::{info, debug, warn};

use crate::models::Document;

/// Trait for document retrieval implementations
#[async_trait]
pub trait DocumentRetriever: Send + Sync {
    /// Retrieve documents matching the query
    async fn retrieve(&self, query: &str, top_k: usize) -> Result<Vec<Document>>;
    
    /// Get document by ID
    async fn get_document(&self, id: &str) -> Result<Option<Document>>;
    
    /// Add documents to the retriever's index
    async fn add_documents(&self, documents: &[Document]) -> Result<()>;
    
    /// Clear all documents from the index
    async fn clear_index(&self) -> Result<()>;
}

/// PostgreSQL + pgvector implementation
pub struct PostgresVectorRetriever {
    pool: sqlx::PgPool,
    embedding_service_url: String,
    embedding_dim: usize,
}

impl PostgresVectorRetriever {
    pub async fn new(database_url: &str, embedding_service_url: &str) -> Result<Self> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await?;
        
        Ok(Self {
            pool,
            embedding_service_url: embedding_service_url.to_string(),
            embedding_dim: 1536, // Default for OpenAI embeddings
        })
    }
    
    /// Get embeddings from the embedding service
    async fn get_embeddings(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let client = reqwest::Client::new();
        
        // Call embedding service (could be OpenAI, local model, etc.)
        let response = client
            .post(&format!("{}/embed", self.embedding_service_url))
            .json(&json!({
                "texts": texts,
                "model": "e5-base-v2"
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Embedding service error: {}", response.status()));
        }
        
        let embeddings: Vec<Vec<f32>> = response.json().await?;
        Ok(embeddings)
    }
}

#[async_trait]
impl DocumentRetriever for PostgresVectorRetriever {
    async fn retrieve(&self, query: &str, top_k: usize) -> Result<Vec<Document>> {
        debug!("Retrieving {} documents for query: {}", top_k, query);
        
        // Get query embedding
        let query_embeddings = self.get_embeddings(&[query.to_string()]).await?;
        let query_embedding = query_embeddings.first()
            .ok_or_else(|| anyhow!("No embedding returned for query"))?;
        
        // Convert to PostgreSQL array format
        let embedding_str = format!("[{}]", 
            query_embedding.iter()
                .map(|f| f.to_string())
                .collect::<Vec<_>>()
                .join(",")
        );
        
        // Query with cosine similarity
        let sql = r#"
            SELECT 
                id::text,
                content,
                metadata,
                1 - (embedding <=> $1::vector) as similarity
            FROM ai_memories
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $2
        "#;
        
        let rows = sqlx::query(sql)
            .bind(&embedding_str)
            .bind(top_k as i32)
            .fetch_all(&self.pool)
            .await?;
        
        let mut documents = Vec::new();
        for row in rows {
            let id: String = row.try_get("id")?;
            let content: String = row.try_get("content")?;
            let metadata: serde_json::Value = row.try_get("metadata")
                .unwrap_or_else(|_| json!({}));
            let similarity: f32 = row.try_get("similarity")?;
            
            documents.push(Document {
                id,
                content,
                title: metadata.get("title")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                metadata,
                relevance_score: similarity,
                embedding: None, // Don't return embeddings to save memory
            });
        }
        
        info!("Retrieved {} documents with avg similarity: {:.3}", 
              documents.len(),
              documents.iter().map(|d| d.relevance_score).sum::<f32>() / documents.len() as f32);
        
        Ok(documents)
    }
    
    async fn get_document(&self, id: &str) -> Result<Option<Document>> {
        let sql = "SELECT id::text, content, metadata FROM ai_memories WHERE id = $1";
        
        let row = sqlx::query(sql)
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        
        match row {
            Some(row) => {
                let id: String = row.try_get("id")?;
                let content: String = row.try_get("content")?;
                let metadata: serde_json::Value = row.try_get("metadata")
                    .unwrap_or_else(|_| json!({}));
                
                Ok(Some(Document {
                    id,
                    content,
                    title: metadata.get("title")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    metadata,
                    relevance_score: 1.0,
                    embedding: None,
                }))
            },
            None => Ok(None),
        }
    }
    
    async fn add_documents(&self, documents: &[Document]) -> Result<()> {
        // Get embeddings for all documents
        let texts: Vec<String> = documents.iter()
            .map(|d| d.content.clone())
            .collect();
        
        let embeddings = self.get_embeddings(&texts).await?;
        
        // Insert documents with embeddings
        for (doc, embedding) in documents.iter().zip(embeddings.iter()) {
            let embedding_str = format!("[{}]", 
                embedding.iter()
                    .map(|f| f.to_string())
                    .collect::<Vec<_>>()
                    .join(",")
            );
            
            let sql = r#"
                INSERT INTO ai_memories (content, embedding, metadata)
                VALUES ($1, $2::vector, $3)
                ON CONFLICT (id) DO UPDATE
                SET content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata
            "#;
            
            sqlx::query(sql)
                .bind(&doc.content)
                .bind(&embedding_str)
                .bind(&doc.metadata)
                .execute(&self.pool)
                .await?;
        }
        
        info!("Added {} documents to index", documents.len());
        Ok(())
    }
    
    async fn clear_index(&self) -> Result<()> {
        sqlx::query("DELETE FROM ai_memories")
            .execute(&self.pool)
            .await?;
        
        info!("Cleared all documents from index");
        Ok(())
    }
}

/// Weaviate vector database implementation
pub struct WeaviateRetriever {
    client: reqwest::Client,
    weaviate_url: String,
    class_name: String,
}

impl WeaviateRetriever {
    pub fn new(weaviate_url: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            weaviate_url: weaviate_url.to_string(),
            class_name: "Document".to_string(),
        }
    }
}

#[async_trait]
impl DocumentRetriever for WeaviateRetriever {
    async fn retrieve(&self, query: &str, top_k: usize) -> Result<Vec<Document>> {
        let graphql_query = format!(
            r#"{{
                Get {{
                    {} (
                        nearText: {{
                            concepts: ["{}"]
                        }}
                        limit: {}
                    ) {{
                        id
                        content
                        title
                        _additional {{
                            certainty
                            distance
                        }}
                    }}
                }}
            }}"#,
            self.class_name, query, top_k
        );
        
        let response = self.client
            .post(&format!("{}/v1/graphql", self.weaviate_url))
            .json(&json!({
                "query": graphql_query
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Weaviate query failed: {}", response.status()));
        }
        
        let result: serde_json::Value = response.json().await?;
        
        let documents = result["data"]["Get"][&self.class_name]
            .as_array()
            .ok_or_else(|| anyhow!("Invalid Weaviate response format"))?
            .iter()
            .map(|obj| {
                let certainty = obj["_additional"]["certainty"]
                    .as_f64()
                    .unwrap_or(0.0) as f32;
                
                Document {
                    id: obj["id"].as_str().unwrap_or("").to_string(),
                    content: obj["content"].as_str().unwrap_or("").to_string(),
                    title: obj["title"].as_str().map(|s| s.to_string()),
                    metadata: json!({}),
                    relevance_score: certainty,
                    embedding: None,
                }
            })
            .collect();
        
        Ok(documents)
    }
    
    async fn get_document(&self, id: &str) -> Result<Option<Document>> {
        let graphql_query = format!(
            r#"{{
                Get {{
                    {} (
                        where: {{
                            path: ["id"]
                            operator: Equal
                            valueString: "{}"
                        }}
                    ) {{
                        id
                        content
                        title
                    }}
                }}
            }}"#,
            self.class_name, id
        );
        
        let response = self.client
            .post(&format!("{}/v1/graphql", self.weaviate_url))
            .json(&json!({
                "query": graphql_query
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Ok(None);
        }
        
        let result: serde_json::Value = response.json().await?;
        let docs = result["data"]["Get"][&self.class_name]
            .as_array()
            .ok_or_else(|| anyhow!("Invalid Weaviate response"))?;
        
        if docs.is_empty() {
            return Ok(None);
        }
        
        let obj = &docs[0];
        Ok(Some(Document {
            id: obj["id"].as_str().unwrap_or("").to_string(),
            content: obj["content"].as_str().unwrap_or("").to_string(),
            title: obj["title"].as_str().map(|s| s.to_string()),
            metadata: json!({}),
            relevance_score: 1.0,
            embedding: None,
        }))
    }
    
    async fn add_documents(&self, documents: &[Document]) -> Result<()> {
        let objects: Vec<serde_json::Value> = documents.iter()
            .map(|doc| json!({
                "class": self.class_name,
                "properties": {
                    "content": doc.content,
                    "title": doc.title,
                }
            }))
            .collect();
        
        let response = self.client
            .post(&format!("{}/v1/batch/objects", self.weaviate_url))
            .json(&json!({
                "objects": objects
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Failed to add documents to Weaviate"));
        }
        
        Ok(())
    }
    
    async fn clear_index(&self) -> Result<()> {
        // Delete all objects of this class
        let response = self.client
            .delete(&format!("{}/v1/schema/{}", self.weaviate_url, self.class_name))
            .send()
            .await?;
        
        if !response.status().is_success() {
            warn!("Failed to clear Weaviate index: {}", response.status());
        }
        
        Ok(())
    }
}

/// Hybrid retriever that combines multiple retrieval strategies
pub struct HybridRetriever {
    retrievers: Vec<Box<dyn DocumentRetriever>>,
    weights: Vec<f32>,
}

impl HybridRetriever {
    pub fn new(retrievers: Vec<Box<dyn DocumentRetriever>>, weights: Vec<f32>) -> Self {
        assert_eq!(retrievers.len(), weights.len(), "Retrievers and weights must have same length");
        Self { retrievers, weights }
    }
}

#[async_trait]
impl DocumentRetriever for HybridRetriever {
    async fn retrieve(&self, query: &str, top_k: usize) -> Result<Vec<Document>> {
        let mut all_documents = Vec::new();
        
        // Retrieve from all sources
        for (retriever, weight) in self.retrievers.iter().zip(self.weights.iter()) {
            match retriever.retrieve(query, top_k).await {
                Ok(mut docs) => {
                    // Apply weight to relevance scores
                    for doc in &mut docs {
                        doc.relevance_score *= weight;
                    }
                    all_documents.extend(docs);
                },
                Err(e) => {
                    warn!("Retriever failed: {}", e);
                }
            }
        }
        
        // Sort by relevance and deduplicate
        all_documents.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
        
        // Deduplicate by ID, keeping highest score
        let mut seen_ids = std::collections::HashSet::new();
        let mut final_docs = Vec::new();
        
        for doc in all_documents {
            if seen_ids.insert(doc.id.clone()) {
                final_docs.push(doc);
                if final_docs.len() >= top_k {
                    break;
                }
            }
        }
        
        Ok(final_docs)
    }
    
    async fn get_document(&self, id: &str) -> Result<Option<Document>> {
        for retriever in &self.retrievers {
            if let Ok(Some(doc)) = retriever.get_document(id).await {
                return Ok(Some(doc));
            }
        }
        Ok(None)
    }
    
    async fn add_documents(&self, documents: &[Document]) -> Result<()> {
        for retriever in &self.retrievers {
            retriever.add_documents(documents).await?;
        }
        Ok(())
    }
    
    async fn clear_index(&self) -> Result<()> {
        for retriever in &self.retrievers {
            retriever.clear_index().await?;
        }
        Ok(())
    }
}