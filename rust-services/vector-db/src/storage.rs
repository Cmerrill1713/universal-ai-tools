// Storage backend implementations for the vector database
// Supports multiple storage backends: Memory, Local, Postgres, Qdrant, Hybrid

use anyhow::Result;
use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::fs;

use crate::config::{Config, StorageBackend as StorageBackendConfig};
use crate::types::{VectorDocument, VectorError};

/// Trait for storage backend implementations
#[async_trait]
pub trait StorageBackend {
    /// Insert a vector document
    async fn insert(&self, document: &VectorDocument) -> Result<String>;

    /// Insert multiple documents in batch
    async fn batch_insert(&self, documents: &[VectorDocument]) -> Result<Vec<String>>;

    /// Get a document by ID
    async fn get(&self, id: &str) -> Result<Option<VectorDocument>>;

    /// Update a document
    async fn update(&self, document: &VectorDocument) -> Result<()>;

    /// Delete a document by ID
    async fn delete(&self, id: &str) -> Result<bool>;

    /// Get all documents for building indexes
    async fn get_all(&self) -> Result<Vec<VectorDocument>>;

    /// Get documents by IDs for search results
    async fn get_by_ids(&self, ids: &[String]) -> Result<Vec<VectorDocument>>;

    /// Count total documents
    async fn count(&self) -> Result<usize>;

    /// Clear all documents
    async fn clear(&self) -> Result<()>;

    /// Create backup
    async fn backup(&self, path: &str) -> Result<()>;

    /// Restore from backup
    async fn restore(&self, path: &str) -> Result<()>;
}

/// In-memory storage backend for development and testing
pub struct MemoryStorage {
    documents: Arc<DashMap<String, VectorDocument>>,
}

impl MemoryStorage {
    pub fn new() -> Self {
        Self {
            documents: Arc::new(DashMap::new()),
        }
    }
}

#[async_trait]
impl StorageBackend for MemoryStorage {
    async fn insert(&self, document: &VectorDocument) -> Result<String> {
        let id = document.id.clone();
        self.documents.insert(id.clone(), document.clone());
        Ok(id)
    }

    async fn batch_insert(&self, documents: &[VectorDocument]) -> Result<Vec<String>> {
        let mut ids = Vec::with_capacity(documents.len());
        for doc in documents {
            let id = doc.id.clone();
            self.documents.insert(id.clone(), doc.clone());
            ids.push(id);
        }
        Ok(ids)
    }

    async fn get(&self, id: &str) -> Result<Option<VectorDocument>> {
        Ok(self.documents.get(id).map(|entry| entry.value().clone()))
    }

    async fn update(&self, document: &VectorDocument) -> Result<()> {
        if self.documents.contains_key(&document.id) {
            self.documents.insert(document.id.clone(), document.clone());
            Ok(())
        } else {
            Err(VectorError::StorageError(anyhow::anyhow!(
                "Document not found: {}", document.id
            )).into())
        }
    }

    async fn delete(&self, id: &str) -> Result<bool> {
        Ok(self.documents.remove(id).is_some())
    }

    async fn get_all(&self) -> Result<Vec<VectorDocument>> {
        Ok(self.documents.iter().map(|entry| entry.value().clone()).collect())
    }

    async fn get_by_ids(&self, ids: &[String]) -> Result<Vec<VectorDocument>> {
        let mut results = Vec::new();
        for id in ids {
            if let Some(doc) = self.documents.get(id) {
                results.push(doc.value().clone());
            }
        }
        Ok(results)
    }

    async fn count(&self) -> Result<usize> {
        Ok(self.documents.len())
    }

    async fn clear(&self) -> Result<()> {
        self.documents.clear();
        Ok(())
    }

    async fn backup(&self, path: &str) -> Result<()> {
        let documents: Vec<VectorDocument> = self.documents
            .iter()
            .map(|entry| entry.value().clone())
            .collect();

        let json = serde_json::to_string_pretty(&documents)?;
        fs::write(path, json).await?;
        Ok(())
    }

    async fn restore(&self, path: &str) -> Result<()> {
        let content = fs::read_to_string(path).await?;
        let documents: Vec<VectorDocument> = serde_json::from_str(&content)?;

        self.documents.clear();
        for doc in documents {
            self.documents.insert(doc.id.clone(), doc);
        }
        Ok(())
    }
}

/// Local file-based storage using Sled embedded database
pub struct LocalStorage {
    db: sled::Db,
    path: String,
}

impl LocalStorage {
    pub async fn new(path: &str) -> Result<Self> {
        let db = sled::open(path)?;
        Ok(Self {
            db,
            path: path.to_string(),
        })
    }
}

#[async_trait]
impl StorageBackend for LocalStorage {
    async fn insert(&self, document: &VectorDocument) -> Result<String> {
        let id = document.id.clone();
        let value = serde_json::to_vec(document)?;
        self.db.insert(id.as_bytes(), value)?;
        Ok(id)
    }

    async fn batch_insert(&self, documents: &[VectorDocument]) -> Result<Vec<String>> {
        let mut batch = sled::Batch::default();
        let mut ids = Vec::with_capacity(documents.len());

        for doc in documents {
            let id = doc.id.clone();
            let value = serde_json::to_vec(doc)?;
            batch.insert(id.as_bytes(), value);
            ids.push(id);
        }

        self.db.apply_batch(batch)?;
        Ok(ids)
    }

    async fn get(&self, id: &str) -> Result<Option<VectorDocument>> {
        if let Some(value) = self.db.get(id.as_bytes())? {
            let document: VectorDocument = serde_json::from_slice(&value)?;
            Ok(Some(document))
        } else {
            Ok(None)
        }
    }

    async fn update(&self, document: &VectorDocument) -> Result<()> {
        if self.db.contains_key(document.id.as_bytes())? {
            let value = serde_json::to_vec(document)?;
            self.db.insert(document.id.as_bytes(), value)?;
            Ok(())
        } else {
            Err(VectorError::StorageError(anyhow::anyhow!(
                "Document not found: {}", document.id
            )).into())
        }
    }

    async fn delete(&self, id: &str) -> Result<bool> {
        Ok(self.db.remove(id.as_bytes())?.is_some())
    }

    async fn get_all(&self) -> Result<Vec<VectorDocument>> {
        let mut documents = Vec::new();
        for result in self.db.iter() {
            let (_, value) = result?;
            let document: VectorDocument = serde_json::from_slice(&value)?;
            documents.push(document);
        }
        Ok(documents)
    }

    async fn get_by_ids(&self, ids: &[String]) -> Result<Vec<VectorDocument>> {
        let mut results = Vec::new();
        for id in ids {
            if let Some(doc) = self.get(id).await? {
                results.push(doc);
            }
        }
        Ok(results)
    }

    async fn count(&self) -> Result<usize> {
        Ok(self.db.len())
    }

    async fn clear(&self) -> Result<()> {
        self.db.clear()?;
        Ok(())
    }

    async fn backup(&self, backup_path: &str) -> Result<()> {
        // Export to JSON backup
        let documents = self.get_all().await?;
        let json = serde_json::to_string_pretty(&documents)?;
        fs::write(backup_path, json).await?;
        Ok(())
    }

    async fn restore(&self, backup_path: &str) -> Result<()> {
        let content = fs::read_to_string(backup_path).await?;
        let documents: Vec<VectorDocument> = serde_json::from_str(&content)?;

        self.clear().await?;
        self.batch_insert(&documents).await?;
        Ok(())
    }
}

/// PostgreSQL storage backend for production use
pub struct PostgresStorage {
    pool: PgPool,
}

impl PostgresStorage {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPool::connect(database_url).await?;

        // Initialize table if it doesn't exist
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS vector_documents (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding REAL[] NOT NULL,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        "#)
        .execute(&pool)
        .await?;

        // Create index on embedding for vector operations
        sqlx::query(r#"
            CREATE INDEX IF NOT EXISTS idx_vector_documents_embedding
            ON vector_documents USING gin(embedding)
        "#)
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }
}

#[async_trait]
impl StorageBackend for PostgresStorage {
    async fn insert(&self, document: &VectorDocument) -> Result<String> {
        sqlx::query(r#"
            INSERT INTO vector_documents (id, content, embedding, metadata, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        "#)
        .bind(&document.id)
        .bind(&document.content)
        .bind(&document.embedding)
        .bind(&document.metadata)
        .bind(document.created_at)
        .bind(document.updated_at)
        .execute(&self.pool)
        .await?;

        Ok(document.id.clone())
    }

    async fn batch_insert(&self, documents: &[VectorDocument]) -> Result<Vec<String>> {
        let mut transaction = self.pool.begin().await?;
        let mut ids = Vec::with_capacity(documents.len());

        for doc in documents {
            sqlx::query(r#"
                INSERT INTO vector_documents (id, content, embedding, metadata, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            "#)
            .bind(&doc.id)
            .bind(&doc.content)
            .bind(&doc.embedding)
            .bind(&doc.metadata)
            .bind(doc.created_at)
            .bind(doc.updated_at)
            .execute(&mut *transaction)
            .await?;

            ids.push(doc.id.clone());
        }

        transaction.commit().await?;
        Ok(ids)
    }

    async fn get(&self, id: &str) -> Result<Option<VectorDocument>> {
        let row = sqlx::query(r#"
            SELECT id, content, embedding, metadata, created_at, updated_at
            FROM vector_documents WHERE id = $1
        "#)
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(VectorDocument {
                id: row.get("id"),
                content: row.get("content"),
                embedding: row.get("embedding"),
                metadata: row.get("metadata"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            }))
        } else {
            Ok(None)
        }
    }

    async fn update(&self, document: &VectorDocument) -> Result<()> {
        let result = sqlx::query(r#"
            UPDATE vector_documents
            SET content = $2, embedding = $3, metadata = $4, updated_at = $5
            WHERE id = $1
        "#)
        .bind(&document.id)
        .bind(&document.content)
        .bind(&document.embedding)
        .bind(&document.metadata)
        .bind(Utc::now())
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(VectorError::StorageError(anyhow::anyhow!(
                "Document not found: {}", document.id
            )).into());
        }

        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM vector_documents WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    async fn get_all(&self) -> Result<Vec<VectorDocument>> {
        let rows = sqlx::query(r#"
            SELECT id, content, embedding, metadata, created_at, updated_at
            FROM vector_documents ORDER BY created_at
        "#)
        .fetch_all(&self.pool)
        .await?;

        let documents = rows.into_iter().map(|row| VectorDocument {
            id: row.get("id"),
            content: row.get("content"),
            embedding: row.get("embedding"),
            metadata: row.get("metadata"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }).collect();

        Ok(documents)
    }

    async fn get_by_ids(&self, ids: &[String]) -> Result<Vec<VectorDocument>> {
        let rows = sqlx::query(r#"
            SELECT id, content, embedding, metadata, created_at, updated_at
            FROM vector_documents WHERE id = ANY($1)
        "#)
        .bind(ids)
        .fetch_all(&self.pool)
        .await?;

        let documents = rows.into_iter().map(|row| VectorDocument {
            id: row.get("id"),
            content: row.get("content"),
            embedding: row.get("embedding"),
            metadata: row.get("metadata"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }).collect();

        Ok(documents)
    }

    async fn count(&self) -> Result<usize> {
        let row = sqlx::query("SELECT COUNT(*) as count FROM vector_documents")
            .fetch_one(&self.pool)
            .await?;

        Ok(row.get::<i64, _>("count") as usize)
    }

    async fn clear(&self) -> Result<()> {
        sqlx::query("DELETE FROM vector_documents")
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    async fn backup(&self, path: &str) -> Result<()> {
        let documents = self.get_all().await?;
        let json = serde_json::to_string_pretty(&documents)?;
        fs::write(path, json).await?;
        Ok(())
    }

    async fn restore(&self, path: &str) -> Result<()> {
        let content = fs::read_to_string(path).await?;
        let documents: Vec<VectorDocument> = serde_json::from_str(&content)?;

        self.clear().await?;
        self.batch_insert(&documents).await?;
        Ok(())
    }
}

/// Qdrant vector database storage backend
pub struct QdrantStorage {
    client: qdrant_client::client::QdrantClient,
    collection_name: String,
}

impl QdrantStorage {
    pub async fn new(url: &str) -> Result<Self> {
        let client = qdrant_client::client::QdrantClient::new(Some(url.to_string()))?;

        // Ensure collection exists
        let collection_name = "vector_documents".to_string();
        let _ = client.create_collection(&collection_name, None).await;

        Ok(Self {
            client,
            collection_name,
        })
    }
}

#[async_trait]
impl StorageBackend for QdrantStorage {
    async fn insert(&self, document: &VectorDocument) -> Result<String> {
        let point = qdrant_client::models::PointStruct {
            id: qdrant_client::models::PointIdType::Uuid(document.id.clone()),
            vectors: Some(qdrant_client::models::Vectors::Vector(
                document.embedding.clone()
            )),
            payload: serde_json::to_value(document).map_err(|e| {
                anyhow::anyhow!("Failed to serialize document: {}", e)
            })?,
        };

        self.client.upsert_points(
            &self.collection_name,
            None,
            vec![point],
            None,
            None,
        ).await?;

        Ok(document.id.clone())
    }

    async fn batch_insert(&self, documents: &[VectorDocument]) -> Result<Vec<String>> {
        let points: Vec<qdrant_client::models::PointStruct> = documents
            .iter()
            .map(|doc| qdrant_client::models::PointStruct {
                id: qdrant_client::models::PointIdType::Uuid(doc.id.clone()),
                vectors: Some(qdrant_client::models::Vectors::Vector(
                    doc.embedding.clone()
                )),
                payload: serde_json::to_value(doc).unwrap_or_default(),
            })
            .collect();

        self.client.upsert_points(
            &self.collection_name,
            None,
            points,
            None,
            None,
        ).await?;

        Ok(documents.iter().map(|doc| doc.id.clone()).collect())
    }

    async fn get(&self, id: &str) -> Result<Option<VectorDocument>> {
        let response = self.client.get_points(
            &self.collection_name,
            None,
            qdrant_client::models::PointIdType::Uuid(id.to_string()),
            None,
            None,
        ).await?;

        if let Some(point) = response.result.first() {
            let document: VectorDocument = serde_json::from_value(point.payload.clone())?;
            Ok(Some(document))
        } else {
            Ok(None)
        }
    }

    async fn update(&self, document: &VectorDocument) -> Result<()> {
        self.insert(document).await?;
        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<bool> {
        let _ = self.client.delete_points(
            &self.collection_name,
            None,
            qdrant_client::models::PointIdType::Uuid(id.to_string()),
            None,
        ).await?;
        Ok(true)
    }

    async fn get_all(&self) -> Result<Vec<VectorDocument>> {
        let response = self.client.scroll_points(
            &self.collection_name,
            None,
            None,
            None,
            None,
            None,
        ).await?;

        let documents: Result<Vec<VectorDocument>> = response.result
            .points
            .into_iter()
            .map(|point| {
                serde_json::from_value(point.payload)
                    .map_err(|e| anyhow::anyhow!("Failed to deserialize document: {}", e))
            })
            .collect();

        documents
    }

    async fn get_by_ids(&self, ids: &[String]) -> Result<Vec<VectorDocument>> {
        let point_ids: Vec<qdrant_client::models::PointIdType> = ids
            .iter()
            .map(|id| qdrant_client::models::PointIdType::Uuid(id.clone()))
            .collect();

        let response = self.client.get_points(
            &self.collection_name,
            None,
            point_ids,
            None,
            None,
        ).await?;

        let documents: Result<Vec<VectorDocument>> = response.result
            .into_iter()
            .map(|point| {
                serde_json::from_value(point.payload)
                    .map_err(|e| anyhow::anyhow!("Failed to deserialize document: {}", e))
            })
            .collect();

        documents
    }

    async fn count(&self) -> Result<usize> {
        let response = self.client.get_collection_info(&self.collection_name).await?;
        Ok(response.result.vectors_count.unwrap_or(0) as usize)
    }

    async fn clear(&self) -> Result<()> {
        self.client.delete_collection(&self.collection_name).await?;
        let _ = self.client.create_collection(&self.collection_name, None).await;
        Ok(())
    }

    async fn backup(&self, path: &str) -> Result<()> {
        let documents = self.get_all().await?;
        let json = serde_json::to_string_pretty(&documents)?;
        fs::write(path, json).await?;
        Ok(())
    }

    async fn restore(&self, path: &str) -> Result<()> {
        let content = fs::read_to_string(path).await?;
        let documents: Vec<VectorDocument> = serde_json::from_str(&content)?;

        self.clear().await?;
        self.batch_insert(&documents).await?;
        Ok(())
    }
}

/// Hybrid storage backend combining multiple storage types
pub struct HybridStorage {
    primary: Arc<dyn StorageBackend + Send + Sync>,
    cache: Arc<dyn StorageBackend + Send + Sync>,
    backup: Option<Arc<dyn StorageBackend + Send + Sync>>,
}

impl HybridStorage {
    pub fn new(
        primary: Arc<dyn StorageBackend + Send + Sync>,
        cache: Arc<dyn StorageBackend + Send + Sync>,
        backup: Option<Arc<dyn StorageBackend + Send + Sync>>,
    ) -> Self {
        Self {
            primary,
            cache,
            backup,
        }
    }
}

#[async_trait]
impl StorageBackend for HybridStorage {
    async fn insert(&self, document: &VectorDocument) -> Result<String> {
        // Insert into primary storage
        let id = self.primary.insert(document).await?;

        // Cache for fast access
        let _ = self.cache.insert(document).await;

        // Backup if configured
        if let Some(ref backup) = self.backup {
            let _ = backup.insert(document).await;
        }

        Ok(id)
    }

    async fn batch_insert(&self, documents: &[VectorDocument]) -> Result<Vec<String>> {
        // Insert into primary storage
        let ids = self.primary.batch_insert(documents).await?;

        // Cache for fast access
        let _ = self.cache.batch_insert(documents).await;

        // Backup if configured
        if let Some(ref backup) = self.backup {
            let _ = backup.batch_insert(documents).await;
        }

        Ok(ids)
    }

    async fn get(&self, id: &str) -> Result<Option<VectorDocument>> {
        // Try cache first
        if let Ok(Some(doc)) = self.cache.get(id).await {
            return Ok(Some(doc));
        }

        // Fall back to primary storage
        let doc = self.primary.get(id).await?;

        // Update cache if found
        if let Some(ref document) = doc {
            let _ = self.cache.insert(document).await;
        }

        Ok(doc)
    }

    async fn update(&self, document: &VectorDocument) -> Result<()> {
        self.primary.update(document).await?;
        let _ = self.cache.update(document).await;

        if let Some(ref backup) = self.backup {
            let _ = backup.update(document).await;
        }

        Ok(())
    }

    async fn delete(&self, id: &str) -> Result<bool> {
        let deleted = self.primary.delete(id).await?;
        let _ = self.cache.delete(id).await;

        if let Some(ref backup) = self.backup {
            let _ = backup.delete(id).await;
        }

        Ok(deleted)
    }

    async fn get_all(&self) -> Result<Vec<VectorDocument>> {
        self.primary.get_all().await
    }

    async fn get_by_ids(&self, ids: &[String]) -> Result<Vec<VectorDocument>> {
        self.primary.get_by_ids(ids).await
    }

    async fn count(&self) -> Result<usize> {
        self.primary.count().await
    }

    async fn clear(&self) -> Result<()> {
        self.primary.clear().await?;
        let _ = self.cache.clear().await;

        if let Some(ref backup) = self.backup {
            let _ = backup.clear().await;
        }

        Ok(())
    }

    async fn backup(&self, path: &str) -> Result<()> {
        self.primary.backup(path).await
    }

    async fn restore(&self, path: &str) -> Result<()> {
        self.primary.restore(path).await?;
        let _ = self.cache.clear().await;
        Ok(())
    }
}

/// Storage factory for creating storage backends
pub struct StorageFactory;

impl StorageFactory {
    pub async fn create_storage(config: &Config) -> Result<Arc<dyn StorageBackend + Send + Sync>> {
        match config.storage.backend {
            StorageBackendConfig::Memory => {
                Ok(Arc::new(MemoryStorage::new()))
            }

            StorageBackendConfig::Local => {
                let path = config.storage.local_path
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("Local path not configured"))?;
                Ok(Arc::new(LocalStorage::new(path).await?))
            }

            StorageBackendConfig::Postgres => {
                let url = config.storage.postgres_url
                    .as_ref()
                    .ok_or_else(|| anyhow::anyhow!("Postgres URL not configured"))?;
                Ok(Arc::new(PostgresStorage::new(url).await?))
            }

            StorageBackendConfig::Hybrid => {
                // Primary: Postgres or Local
                let primary: Arc<dyn StorageBackend + Send + Sync> = if let Some(url) = &config.storage.postgres_url {
                    Arc::new(PostgresStorage::new(url).await?)
                } else if let Some(path) = &config.storage.local_path {
                    Arc::new(LocalStorage::new(path).await?)
                } else {
                    Arc::new(MemoryStorage::new())
                };

                // Cache: Memory
                let cache = Arc::new(MemoryStorage::new());

                // Backup: Local if path configured
                let backup = if let Some(backup_path) = &config.storage.local_path {
                    if backup_path != config.storage.local_path.as_ref().unwrap_or(&String::new()) {
                        Some(Arc::new(LocalStorage::new(&format!("{}_backup", backup_path)).await?) as Arc<dyn StorageBackend + Send + Sync>)
                    } else {
                        None
                    }
                } else {
                    None
                };

                Ok(Arc::new(HybridStorage::new(primary, cache, backup)))
            }

            StorageBackendConfig::Qdrant => {
                let qdrant_url = config.storage.qdrant_url.as_ref()
                    .ok_or_else(|| anyhow::anyhow!("Qdrant URL not configured"))?;

                let qdrant_storage = QdrantStorage::new(qdrant_url).await?;
                Ok(Arc::new(qdrant_storage))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_memory_storage() {
        let storage = MemoryStorage::new();
        let doc = VectorDocument::new(
            "test content".to_string(),
            vec![1.0, 2.0, 3.0],
            None,
        );

        let id = storage.insert(&doc).await.unwrap();
        assert_eq!(id, doc.id);

        let retrieved = storage.get(&id).await.unwrap().unwrap();
        assert_eq!(retrieved.content, doc.content);
        assert_eq!(retrieved.embedding, doc.embedding);

        assert_eq!(storage.count().await.unwrap(), 1);

        let deleted = storage.delete(&id).await.unwrap();
        assert!(deleted);
        assert_eq!(storage.count().await.unwrap(), 0);
    }

    #[tokio::test]
    async fn test_local_storage() -> Result<()> {
        let temp_dir = tempdir()?;
        let storage = LocalStorage::new(temp_dir.path().to_str().unwrap()).await?;

        let doc = VectorDocument::new(
            "test content".to_string(),
            vec![1.0, 2.0, 3.0],
            Some(serde_json::json!({"key": "value"})),
        );

        let id = storage.insert(&doc).await?;
        let retrieved = storage.get(&id).await?.unwrap();

        assert_eq!(retrieved.content, doc.content);
        assert_eq!(retrieved.embedding, doc.embedding);
        assert_eq!(retrieved.metadata, doc.metadata);

        Ok(())
    }

    #[tokio::test]
    async fn test_batch_operations() {
        let storage = MemoryStorage::new();
        let docs = vec![
            VectorDocument::new("doc1".to_string(), vec![1.0, 0.0], None),
            VectorDocument::new("doc2".to_string(), vec![0.0, 1.0], None),
            VectorDocument::new("doc3".to_string(), vec![1.0, 1.0], None),
        ];

        let ids = storage.batch_insert(&docs).await.unwrap();
        assert_eq!(ids.len(), 3);
        assert_eq!(storage.count().await.unwrap(), 3);

        let retrieved = storage.get_by_ids(&ids).await.unwrap();
        assert_eq!(retrieved.len(), 3);
    }
}
