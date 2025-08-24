use anyhow::Result;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::{error, info};

use crate::automation::TaskCategory;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    pub name: String,
    pub command: String,
    pub category: String,
    pub executions: u32,
    pub successes: u32,
    pub success_rate: f64,
    pub avg_execution_time_ms: u64,
    pub last_used: DateTime<Utc>,
    pub optimization_hints: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessMetrics {
    pub total_executions: u64,
    pub successful_executions: u64,
    pub average_time_ms: u64,
    pub success_rate: f64,
}

pub struct LearningEngine {
    pool: PgPool,
}

impl LearningEngine {
    pub async fn new(pool: PgPool) -> Result<Self> {
        // Create learning tables if they don't exist
        sqlx::query!(
            r#"
            CREATE TABLE IF NOT EXISTS learned_patterns (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                command TEXT NOT NULL,
                category VARCHAR(50) NOT NULL,
                executions INTEGER DEFAULT 0,
                successes INTEGER DEFAULT 0,
                success_rate FLOAT DEFAULT 0.0,
                avg_execution_time_ms BIGINT DEFAULT 0,
                last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                optimization_hints JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            "#
        )
        .execute(&pool)
        .await?;

        sqlx::query!(
            r#"
            CREATE TABLE IF NOT EXISTS learning_metrics (
                id SERIAL PRIMARY KEY,
                category VARCHAR(50) NOT NULL,
                total_executions BIGINT DEFAULT 0,
                successful_executions BIGINT DEFAULT 0,
                average_time_ms BIGINT DEFAULT 0,
                success_rate FLOAT DEFAULT 0.0,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            "#
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }

    pub async fn load_patterns(&self, patterns: &DashMap<String, Pattern>) -> Result<()> {
        let stored_patterns = sqlx::query_as!(
            Pattern,
            r#"
            SELECT 
                name,
                command,
                category,
                executions as "executions!",
                successes as "successes!",
                success_rate as "success_rate!",
                avg_execution_time_ms as "avg_execution_time_ms!",
                last_used as "last_used!",
                optimization_hints as "optimization_hints!"
            FROM learned_patterns
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        for pattern in stored_patterns {
            let key = sha2_hash(&pattern.command);
            patterns.insert(key, pattern);
        }

        info!("Loaded {} patterns from database", patterns.len());
        Ok(())
    }

    pub async fn save_patterns(&self, patterns: &DashMap<String, Pattern>) -> Result<()> {
        for entry in patterns.iter() {
            let pattern = entry.value();
            
            sqlx::query!(
                r#"
                INSERT INTO learned_patterns 
                    (name, command, category, executions, successes, success_rate, 
                     avg_execution_time_ms, last_used, optimization_hints)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (name) DO UPDATE SET
                    executions = EXCLUDED.executions,
                    successes = EXCLUDED.successes,
                    success_rate = EXCLUDED.success_rate,
                    avg_execution_time_ms = EXCLUDED.avg_execution_time_ms,
                    last_used = EXCLUDED.last_used,
                    optimization_hints = EXCLUDED.optimization_hints,
                    updated_at = NOW()
                "#,
                pattern.name,
                pattern.command,
                pattern.category,
                pattern.executions as i32,
                pattern.successes as i32,
                pattern.success_rate,
                pattern.avg_execution_time_ms as i64,
                pattern.last_used,
                serde_json::json!(pattern.optimization_hints)
            )
            .execute(&self.pool)
            .await?;
        }

        info!("Saved {} patterns to database", patterns.len());
        Ok(())
    }

    pub async fn learn_from_execution(
        &self,
        command: &str,
        category: &TaskCategory,
        success: bool,
        execution_time_ms: u64,
    ) -> Result<()> {
        let category_str = format!("{:?}", category);
        
        // Update category metrics
        sqlx::query!(
            r#"
            INSERT INTO learning_metrics (category, total_executions, successful_executions, average_time_ms)
            VALUES ($1, 1, $2, $3)
            ON CONFLICT (category) DO UPDATE SET
                total_executions = learning_metrics.total_executions + 1,
                successful_executions = learning_metrics.successful_executions + $2,
                average_time_ms = (
                    (learning_metrics.average_time_ms * learning_metrics.total_executions + $3) /
                    (learning_metrics.total_executions + 1)
                ),
                success_rate = CAST(learning_metrics.successful_executions AS FLOAT) / 
                              CAST(learning_metrics.total_executions AS FLOAT),
                updated_at = NOW()
            "#,
            category_str,
            if success { 1i64 } else { 0i64 },
            execution_time_ms as i64
        )
        .execute(&self.pool)
        .await?;

        info!("Learned from execution: {} (success: {})", command, success);
        Ok(())
    }

    pub async fn get_metrics(&self, category: &str) -> Result<SuccessMetrics> {
        let metrics = sqlx::query_as!(
            SuccessMetrics,
            r#"
            SELECT 
                total_executions as "total_executions!",
                successful_executions as "successful_executions!",
                average_time_ms as "average_time_ms!",
                success_rate as "success_rate!"
            FROM learning_metrics
            WHERE category = $1
            "#,
            category
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(metrics.unwrap_or(SuccessMetrics {
            total_executions: 0,
            successful_executions: 0,
            average_time_ms: 0,
            success_rate: 0.0,
        }))
    }

    pub async fn suggest_optimization(&self, category: &str) -> Result<Vec<String>> {
        let result = sqlx::query!(
            r#"
            SELECT optimization_hints
            FROM learned_patterns
            WHERE category = $1 AND success_rate > 0.8
            ORDER BY success_rate DESC
            LIMIT 5
            "#,
            category
        )
        .fetch_all(&self.pool)
        .await?;

        let mut hints = Vec::new();
        for row in result {
            if let Some(hints_json) = row.optimization_hints {
                if let Ok(pattern_hints) = serde_json::from_value::<Vec<String>>(hints_json) {
                    hints.extend(pattern_hints);
                }
            }
        }

        // Deduplicate hints
        hints.sort();
        hints.dedup();
        
        Ok(hints)
    }
}

fn sha2_hash(input: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(input.to_lowercase().as_bytes());
    hex::encode(hasher.finalize())
}