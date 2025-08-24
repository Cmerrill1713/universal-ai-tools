//! Supabase context storage service for persistent knowledge management

use anyhow::{Result, Context as AnyhowContext};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgRow};
use tracing::{info, warn};
use uuid::Uuid;

/// Supabase context storage service
pub struct SupabaseContextService {
    pool: PgPool,
}

/// Context storage entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextEntry {
    pub id: String,
    pub user_id: String,
    pub category: String,
    pub source: String,
    pub content: serde_json::Value,
    pub metadata: Option<serde_json::Value>,
    pub embedding_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Knowledge base entry with enhanced metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub tags: Vec<String>,
    pub source_url: Option<String>,
    pub author: Option<String>,
    pub confidence_score: f32,
    pub entity_ids: Vec<String>,
    pub created_at: DateTime<Utc>,
}

impl SupabaseContextService {
    /// Create a new Supabase context service
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPool::connect(database_url)
            .await
            .context("Failed to connect to Supabase PostgreSQL")?;
        
        info!("Connected to Supabase context storage");
        
        // Initialize tables if they don't exist
        Self::initialize_tables(&pool).await?;
        
        Ok(Self { pool })
    }

    /// Initialize required tables
    async fn initialize_tables(pool: &PgPool) -> Result<()> {
        // Create context_storage table if it doesn't exist
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS context_storage (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL,
                category TEXT NOT NULL,
                source TEXT NOT NULL,
                content JSONB NOT NULL,
                metadata JSONB,
                embedding_id TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT unique_user_category_source UNIQUE (user_id, category, source)
            )"
        )
        .execute(pool)
        .await
        .context("Failed to create context_storage table")?;

        // Create knowledge_base table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS knowledge_base (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL,
                tags TEXT[] DEFAULT '{}',
                source_url TEXT,
                author TEXT,
                confidence_score REAL DEFAULT 0.5,
                entity_ids TEXT[] DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )"
        )
        .execute(pool)
        .await
        .context("Failed to create knowledge_base table")?;

        // Create indexes for better performance
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_context_user_category 
             ON context_storage(user_id, category)"
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_knowledge_category 
             ON knowledge_base(category)"
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_knowledge_tags 
             ON knowledge_base USING GIN(tags)"
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Store context entry
    pub async fn store_context(&self, entry: &ContextEntry) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        
        sqlx::query(
            "INSERT INTO context_storage 
             (id, user_id, category, source, content, metadata, embedding_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, category, source) 
             DO UPDATE SET 
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                embedding_id = EXCLUDED.embedding_id,
                updated_at = NOW()
             RETURNING id"
        )
        .bind(&id)
        .bind(&entry.user_id)
        .bind(&entry.category)
        .bind(&entry.source)
        .bind(&entry.content)
        .bind(&entry.metadata)
        .bind(&entry.embedding_id)
        .fetch_one(&self.pool)
        .await
        .context("Failed to store context")?;

        Ok(id)
    }

    /// Retrieve context entries for a user
    pub async fn get_user_context(
        &self,
        user_id: &str,
        category: Option<&str>,
        limit: usize
    ) -> Result<Vec<ContextEntry>> {
        let query = if let Some(cat) = category {
            sqlx::query_as::<_, ContextRow>(
                "SELECT * FROM context_storage 
                 WHERE user_id = $1 AND category = $2
                 ORDER BY updated_at DESC
                 LIMIT $3"
            )
            .bind(user_id)
            .bind(cat)
            .bind(limit as i64)
        } else {
            sqlx::query_as::<_, ContextRow>(
                "SELECT * FROM context_storage 
                 WHERE user_id = $1
                 ORDER BY updated_at DESC
                 LIMIT $2"
            )
            .bind(user_id)
            .bind(limit as i64)
        };

        let rows = query
            .fetch_all(&self.pool)
            .await
            .context("Failed to retrieve context")?;

        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    /// Store knowledge entry
    pub async fn store_knowledge(&self, entry: &KnowledgeEntry) -> Result<String> {
        let id = Uuid::new_v4().to_string();
        
        sqlx::query(
            "INSERT INTO knowledge_base 
             (id, title, content, category, tags, source_url, author, confidence_score, entity_ids)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id"
        )
        .bind(&id)
        .bind(&entry.title)
        .bind(&entry.content)
        .bind(&entry.category)
        .bind(&entry.tags)
        .bind(&entry.source_url)
        .bind(&entry.author)
        .bind(entry.confidence_score)
        .bind(&entry.entity_ids)
        .fetch_one(&self.pool)
        .await
        .context("Failed to store knowledge")?;

        Ok(id)
    }

    /// Search knowledge base
    pub async fn search_knowledge(
        &self,
        query: &str,
        category: Option<&str>,
        tags: Option<Vec<String>>,
        limit: usize
    ) -> Result<Vec<KnowledgeEntry>> {
        let mut sql = String::from(
            "SELECT * FROM knowledge_base WHERE 1=1"
        );
        
        let mut params = vec![];
        let mut param_count = 0;

        // Add full-text search
        param_count += 1;
        sql.push_str(&format!(" AND (title ILIKE ${} OR content ILIKE ${})", param_count, param_count));
        params.push(format!("%{}%", query));

        // Add category filter
        if let Some(cat) = category {
            param_count += 1;
            sql.push_str(&format!(" AND category = ${}", param_count));
            params.push(cat.to_string());
        }

        // Add tags filter
        if let Some(tag_list) = tags {
            param_count += 1;
            sql.push_str(&format!(" AND tags && ${}", param_count));
            // Convert to PostgreSQL array format
        }

        sql.push_str(&format!(" ORDER BY confidence_score DESC LIMIT {}", limit));

        // Execute query with dynamic parameters
        // Note: This is simplified - in production, use proper parameter binding
        
        let entries = sqlx::query_as::<_, KnowledgeRow>(&sql)
            .fetch_all(&self.pool)
            .await
            .context("Failed to search knowledge")?;

        Ok(entries.into_iter().map(|r| r.into()).collect())
    }

    /// Get related knowledge entries
    pub async fn get_related_knowledge(
        &self,
        entity_ids: &[String],
        limit: usize
    ) -> Result<Vec<KnowledgeEntry>> {
        let query = sqlx::query_as::<_, KnowledgeRow>(
            "SELECT * FROM knowledge_base 
             WHERE entity_ids && $1
             ORDER BY confidence_score DESC
             LIMIT $2"
        )
        .bind(entity_ids)
        .bind(limit as i64);

        let entries = query
            .fetch_all(&self.pool)
            .await
            .context("Failed to get related knowledge")?;

        Ok(entries.into_iter().map(|r| r.into()).collect())
    }

    /// Update knowledge confidence score
    pub async fn update_confidence_score(
        &self,
        knowledge_id: &str,
        new_score: f32
    ) -> Result<()> {
        sqlx::query(
            "UPDATE knowledge_base 
             SET confidence_score = $1, updated_at = NOW()
             WHERE id = $2"
        )
        .bind(new_score)
        .bind(knowledge_id)
        .execute(&self.pool)
        .await
        .context("Failed to update confidence score")?;

        Ok(())
    }

    /// Clean up old context entries
    pub async fn cleanup_old_context(&self, days_to_keep: i64) -> Result<u64> {
        let result = sqlx::query(
            "DELETE FROM context_storage 
             WHERE updated_at < NOW() - INTERVAL '$1 days'"
        )
        .bind(days_to_keep)
        .execute(&self.pool)
        .await
        .context("Failed to cleanup old context")?;

        Ok(result.rows_affected())
    }
}

// Helper structs for SQLx mapping
#[derive(sqlx::FromRow)]
struct ContextRow {
    id: Uuid,
    user_id: String,
    category: String,
    source: String,
    content: serde_json::Value,
    metadata: Option<serde_json::Value>,
    embedding_id: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<ContextRow> for ContextEntry {
    fn from(row: ContextRow) -> Self {
        ContextEntry {
            id: row.id.to_string(),
            user_id: row.user_id,
            category: row.category,
            source: row.source,
            content: row.content,
            metadata: row.metadata,
            embedding_id: row.embedding_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(sqlx::FromRow)]
struct KnowledgeRow {
    id: Uuid,
    title: String,
    content: String,
    category: String,
    tags: Vec<String>,
    source_url: Option<String>,
    author: Option<String>,
    confidence_score: f32,
    entity_ids: Vec<String>,
    created_at: DateTime<Utc>,
}

impl From<KnowledgeRow> for KnowledgeEntry {
    fn from(row: KnowledgeRow) -> Self {
        KnowledgeEntry {
            id: row.id.to_string(),
            title: row.title,
            content: row.content,
            category: row.category,
            tags: row.tags,
            source_url: row.source_url,
            author: row.author,
            confidence_score: row.confidence_score,
            entity_ids: row.entity_ids,
            created_at: row.created_at,
        }
    }
}