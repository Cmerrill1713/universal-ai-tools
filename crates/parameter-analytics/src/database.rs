use crate::types::*;
use crate::AnalyticsError;
use chrono::{DateTime, Utc};
use deadpool_postgres::{Config, Pool, Runtime};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use tokio_postgres::{NoTls, Row};
use tracing::{debug, error, info, warn};

pub struct DatabaseManager {
    pool: Pool,
}

impl DatabaseManager {
    pub async fn new(database_url: &str) -> Result<Self, AnalyticsError> {
        let mut cfg = Config::new();
        cfg.url = Some(database_url.to_string());
        
        let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to create connection pool: {}", e) 
            })?;

        let manager = Self { pool };
        manager.initialize_schema().await?;
        
        info!("Database manager initialized successfully");
        Ok(manager)
    }

    async fn initialize_schema(&self) -> Result<(), AnalyticsError> {
        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        // Create tables if they don't exist
        let create_table_sql = r#"
            CREATE TABLE IF NOT EXISTS parameter_executions (
                id VARCHAR PRIMARY KEY,
                task_type VARCHAR NOT NULL,
                user_input TEXT NOT NULL,
                parameters JSONB NOT NULL,
                model VARCHAR NOT NULL,
                provider VARCHAR NOT NULL,
                user_id VARCHAR,
                request_id VARCHAR NOT NULL,
                execution_time BIGINT NOT NULL,
                prompt_tokens INTEGER NOT NULL,
                completion_tokens INTEGER NOT NULL,
                total_tokens INTEGER NOT NULL,
                response_length INTEGER NOT NULL,
                response_quality REAL,
                user_satisfaction REAL,
                success BOOLEAN NOT NULL,
                error_type VARCHAR,
                retry_count INTEGER NOT NULL DEFAULT 0,
                complexity VARCHAR NOT NULL,
                domain VARCHAR,
                endpoint VARCHAR NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_parameter_executions_task_type ON parameter_executions(task_type);
            CREATE INDEX IF NOT EXISTS idx_parameter_executions_created_at ON parameter_executions(created_at);
            CREATE INDEX IF NOT EXISTS idx_parameter_executions_success ON parameter_executions(success);
            CREATE INDEX IF NOT EXISTS idx_parameter_executions_user_id ON parameter_executions(user_id);
            CREATE INDEX IF NOT EXISTS idx_parameter_executions_parameters ON parameter_executions USING GIN(parameters);
            
            CREATE TABLE IF NOT EXISTS parameter_effectiveness_cache (
                cache_key VARCHAR PRIMARY KEY,
                task_type VARCHAR NOT NULL,
                parameter_set VARCHAR NOT NULL,
                parameters JSONB NOT NULL,
                total_executions BIGINT NOT NULL,
                success_rate REAL NOT NULL,
                avg_execution_time REAL NOT NULL,
                avg_token_usage REAL NOT NULL,
                avg_response_quality REAL NOT NULL,
                avg_user_satisfaction REAL NOT NULL,
                quality_trend REAL NOT NULL,
                speed_trend REAL NOT NULL,
                cost_efficiency_trend REAL NOT NULL,
                execution_time_variance REAL NOT NULL,
                quality_variance REAL NOT NULL,
                p95_execution_time REAL NOT NULL,
                p99_execution_time REAL NOT NULL,
                confidence_score REAL NOT NULL,
                sample_size_adequacy BOOLEAN NOT NULL,
                last_updated TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_effectiveness_cache_task_type ON parameter_effectiveness_cache(task_type);
            CREATE INDEX IF NOT EXISTS idx_effectiveness_cache_expires_at ON parameter_effectiveness_cache(expires_at);
        "#;

        client.batch_execute(create_table_sql).await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to initialize schema: {}", e) 
            })?;

        debug!("Database schema initialized successfully");
        Ok(())
    }

    pub async fn insert_execution(&self, execution: &ParameterExecution) -> Result<(), AnalyticsError> {
        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        let parameters_json = serde_json::to_value(&execution.parameters)
            .map_err(|e| AnalyticsError::SerializationError { 
                error: format!("Failed to serialize parameters: {}", e) 
            })?;

        let sql = r#"
            INSERT INTO parameter_executions (
                id, task_type, user_input, parameters, model, provider, user_id, request_id,
                execution_time, prompt_tokens, completion_tokens, total_tokens, response_length,
                response_quality, user_satisfaction, success, error_type, retry_count, complexity,
                domain, endpoint, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            )
        "#;

        client.execute(
            sql,
            &[
                &execution.id,
                &execution.task_type.as_str(),
                &execution.user_input,
                &parameters_json,
                &execution.model,
                &execution.provider,
                &execution.user_id,
                &execution.request_id,
                &(execution.execution_time as i64),
                &(execution.token_usage.prompt_tokens as i32),
                &(execution.token_usage.completion_tokens as i32),
                &(execution.token_usage.total_tokens as i32),
                &(execution.response_length as i32),
                &execution.response_quality,
                &execution.user_satisfaction,
                &execution.success,
                &execution.error_type,
                &(execution.retry_count as i32),
                &execution.complexity.as_str(),
                &execution.domain,
                &execution.endpoint,
                &execution.timestamp,
            ],
        ).await
        .map_err(|e| AnalyticsError::DatabaseError { 
            error: format!("Failed to insert execution: {}", e) 
        })?;

        debug!("Inserted execution record: {}", execution.id);
        Ok(())
    }

    pub async fn batch_insert_executions(&self, executions: &[ParameterExecution]) -> Result<(), AnalyticsError> {
        if executions.is_empty() {
            return Ok(());
        }

        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        let transaction = client.transaction().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to start transaction: {}", e) 
            })?;

        let sql = r#"
            INSERT INTO parameter_executions (
                id, task_type, user_input, parameters, model, provider, user_id, request_id,
                execution_time, prompt_tokens, completion_tokens, total_tokens, response_length,
                response_quality, user_satisfaction, success, error_type, retry_count, complexity,
                domain, endpoint, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
            )
        "#;

        let stmt = transaction.prepare(sql).await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to prepare statement: {}", e) 
            })?;

        for execution in executions {
            let parameters_json = serde_json::to_value(&execution.parameters)
                .map_err(|e| AnalyticsError::SerializationError { 
                    error: format!("Failed to serialize parameters: {}", e) 
                })?;

            transaction.execute(
                &stmt,
                &[
                    &execution.id,
                    &execution.task_type.as_str(),
                    &execution.user_input,
                    &parameters_json,
                    &execution.model,
                    &execution.provider,
                    &execution.user_id,
                    &execution.request_id,
                    &(execution.execution_time as i64),
                    &(execution.token_usage.prompt_tokens as i32),
                    &(execution.token_usage.completion_tokens as i32),
                    &(execution.token_usage.total_tokens as i32),
                    &(execution.response_length as i32),
                    &execution.response_quality,
                    &execution.user_satisfaction,
                    &execution.success,
                    &execution.error_type,
                    &(execution.retry_count as i32),
                    &execution.complexity.as_str(),
                    &execution.domain,
                    &execution.endpoint,
                    &execution.timestamp,
                ],
            ).await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to insert execution in batch: {}", e) 
            })?;
        }

        transaction.commit().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to commit batch insert: {}", e) 
            })?;

        info!("Batch inserted {} execution records", executions.len());
        Ok(())
    }

    pub async fn get_executions_by_task_type(
        &self,
        task_type: TaskType,
        time_range: Option<&TimeRange>,
        limit: Option<i64>,
    ) -> Result<Vec<ParameterExecution>, AnalyticsError> {
        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        let mut sql = String::from(r#"
            SELECT id, task_type, user_input, parameters, model, provider, user_id, request_id,
                   execution_time, prompt_tokens, completion_tokens, total_tokens, response_length,
                   response_quality, user_satisfaction, success, error_type, retry_count, complexity,
                   domain, endpoint, created_at
            FROM parameter_executions
            WHERE task_type = $1
        "#);

        let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![&task_type.as_str()];
        let mut param_index = 2;

        if let Some(range) = time_range {
            sql.push_str(&format!(" AND created_at >= ${} AND created_at <= ${}", param_index, param_index + 1));
            params.push(&range.start);
            params.push(&range.end);
            param_index += 2;
        }

        sql.push_str(" ORDER BY created_at DESC");

        if let Some(limit_val) = limit {
            sql.push_str(&format!(" LIMIT ${}", param_index));
            params.push(&limit_val);
        }

        let rows = client.query(&sql, &params).await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to query executions: {}", e) 
            })?;

        let executions = rows.into_iter()
            .filter_map(|row| self.row_to_execution(&row).ok())
            .collect();

        Ok(executions)
    }

    pub async fn get_executions_in_time_range(
        &self,
        time_range: &TimeRange,
        limit: Option<i64>,
    ) -> Result<Vec<ParameterExecution>, AnalyticsError> {
        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        let mut sql = String::from(r#"
            SELECT id, task_type, user_input, parameters, model, provider, user_id, request_id,
                   execution_time, prompt_tokens, completion_tokens, total_tokens, response_length,
                   response_quality, user_satisfaction, success, error_type, retry_count, complexity,
                   domain, endpoint, created_at
            FROM parameter_executions
            WHERE created_at >= $1 AND created_at <= $2
            ORDER BY created_at DESC
        "#);

        let mut params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = vec![&time_range.start, &time_range.end];

        if let Some(limit_val) = limit {
            sql.push_str(" LIMIT $3");
            params.push(&limit_val);
        }

        let rows = client.query(&sql, &params).await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to query executions: {}", e) 
            })?;

        let executions = rows.into_iter()
            .filter_map(|row| self.row_to_execution(&row).ok())
            .collect();

        Ok(executions)
    }

    pub async fn update_execution_feedback(
        &self,
        execution_id: &str,
        satisfaction: Option<f32>,
        quality_rating: Option<f32>,
    ) -> Result<(), AnalyticsError> {
        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        let sql = r#"
            UPDATE parameter_executions 
            SET user_satisfaction = COALESCE($2, user_satisfaction),
                response_quality = COALESCE($3, response_quality),
                updated_at = NOW()
            WHERE id = $1
        "#;

        let rows_affected = client.execute(sql, &[&execution_id, &satisfaction, &quality_rating]).await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to update execution feedback: {}", e) 
            })?;

        if rows_affected == 0 {
            warn!("No execution found with id: {}", execution_id);
        } else {
            debug!("Updated feedback for execution: {}", execution_id);
        }

        Ok(())
    }

    pub async fn cache_effectiveness_data(
        &self,
        effectiveness: &ParameterEffectiveness,
        expires_at: DateTime<Utc>,
    ) -> Result<(), AnalyticsError> {
        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        let parameters_json = serde_json::to_value(&effectiveness.parameters)
            .map_err(|e| AnalyticsError::SerializationError { 
                error: format!("Failed to serialize parameters: {}", e) 
            })?;

        let cache_key = format!("{}_{}", effectiveness.task_type.as_str(), effectiveness.parameter_set);

        let sql = r#"
            INSERT INTO parameter_effectiveness_cache (
                cache_key, task_type, parameter_set, parameters, total_executions, success_rate,
                avg_execution_time, avg_token_usage, avg_response_quality, avg_user_satisfaction,
                quality_trend, speed_trend, cost_efficiency_trend, execution_time_variance,
                quality_variance, p95_execution_time, p99_execution_time, confidence_score,
                sample_size_adequacy, last_updated, expires_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            )
            ON CONFLICT (cache_key) DO UPDATE SET
                total_executions = EXCLUDED.total_executions,
                success_rate = EXCLUDED.success_rate,
                avg_execution_time = EXCLUDED.avg_execution_time,
                avg_token_usage = EXCLUDED.avg_token_usage,
                avg_response_quality = EXCLUDED.avg_response_quality,
                avg_user_satisfaction = EXCLUDED.avg_user_satisfaction,
                quality_trend = EXCLUDED.quality_trend,
                speed_trend = EXCLUDED.speed_trend,
                cost_efficiency_trend = EXCLUDED.cost_efficiency_trend,
                execution_time_variance = EXCLUDED.execution_time_variance,
                quality_variance = EXCLUDED.quality_variance,
                p95_execution_time = EXCLUDED.p95_execution_time,
                p99_execution_time = EXCLUDED.p99_execution_time,
                confidence_score = EXCLUDED.confidence_score,
                sample_size_adequacy = EXCLUDED.sample_size_adequacy,
                last_updated = EXCLUDED.last_updated,
                expires_at = EXCLUDED.expires_at
        "#;

        client.execute(
            sql,
            &[
                &cache_key,
                &effectiveness.task_type.as_str(),
                &effectiveness.parameter_set,
                &parameters_json,
                &(effectiveness.total_executions as i64),
                &effectiveness.success_rate,
                &effectiveness.avg_execution_time,
                &effectiveness.avg_token_usage,
                &effectiveness.avg_response_quality,
                &effectiveness.avg_user_satisfaction,
                &effectiveness.quality_trend,
                &effectiveness.speed_trend,
                &effectiveness.cost_efficiency_trend,
                &effectiveness.execution_time_variance,
                &effectiveness.quality_variance,
                &effectiveness.p95_execution_time,
                &effectiveness.p99_execution_time,
                &effectiveness.confidence_score,
                &effectiveness.sample_size_adequacy,
                &effectiveness.last_updated,
                &expires_at,
            ],
        ).await
        .map_err(|e| AnalyticsError::DatabaseError { 
            error: format!("Failed to cache effectiveness data: {}", e) 
        })?;

        debug!("Cached effectiveness data for task type: {}", effectiveness.task_type.as_str());
        Ok(())
    }

    pub async fn get_cached_effectiveness(
        &self,
        task_type: TaskType,
    ) -> Result<Vec<ParameterEffectiveness>, AnalyticsError> {
        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        let sql = r#"
            SELECT cache_key, task_type, parameter_set, parameters, total_executions, success_rate,
                   avg_execution_time, avg_token_usage, avg_response_quality, avg_user_satisfaction,
                   quality_trend, speed_trend, cost_efficiency_trend, execution_time_variance,
                   quality_variance, p95_execution_time, p99_execution_time, confidence_score,
                   sample_size_adequacy, last_updated
            FROM parameter_effectiveness_cache
            WHERE task_type = $1 AND expires_at > NOW()
            ORDER BY confidence_score DESC
        "#;

        let rows = client.query(sql, &[&task_type.as_str()]).await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to query cached effectiveness: {}", e) 
            })?;

        let effectiveness_list = rows.into_iter()
            .filter_map(|row| self.row_to_effectiveness(&row).ok())
            .collect();

        Ok(effectiveness_list)
    }

    pub async fn cleanup_expired_cache(&self) -> Result<u64, AnalyticsError> {
        let client = self.pool.get().await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to get database connection: {}", e) 
            })?;

        let sql = "DELETE FROM parameter_effectiveness_cache WHERE expires_at <= NOW()";
        
        let rows_deleted = client.execute(sql, &[]).await
            .map_err(|e| AnalyticsError::DatabaseError { 
                error: format!("Failed to cleanup expired cache: {}", e) 
            })?;

        if rows_deleted > 0 {
            info!("Cleaned up {} expired cache entries", rows_deleted);
        }

        Ok(rows_deleted)
    }

    fn row_to_execution(&self, row: &Row) -> Result<ParameterExecution, AnalyticsError> {
        let parameters_json: JsonValue = row.get("parameters");
        let parameters: TaskParameters = serde_json::from_value(parameters_json)
            .map_err(|e| AnalyticsError::SerializationError { 
                error: format!("Failed to deserialize parameters: {}", e) 
            })?;

        let task_type = TaskType::from_str(row.get("task_type"))
            .ok_or_else(|| AnalyticsError::InvalidParameter { 
                parameter: format!("task_type: {}", row.get::<_, String>("task_type")) 
            })?;

        let complexity = Complexity::from_str(row.get("complexity"))
            .ok_or_else(|| AnalyticsError::InvalidParameter { 
                parameter: format!("complexity: {}", row.get::<_, String>("complexity")) 
            })?;

        Ok(ParameterExecution {
            id: row.get("id"),
            task_type,
            user_input: row.get("user_input"),
            parameters,
            model: row.get("model"),
            provider: row.get("provider"),
            user_id: row.get("user_id"),
            request_id: row.get("request_id"),
            timestamp: row.get("created_at"),
            execution_time: row.get::<_, i64>("execution_time") as u64,
            token_usage: TokenUsage {
                prompt_tokens: row.get::<_, i32>("prompt_tokens") as u32,
                completion_tokens: row.get::<_, i32>("completion_tokens") as u32,
                total_tokens: row.get::<_, i32>("total_tokens") as u32,
            },
            response_length: row.get::<_, i32>("response_length") as u32,
            response_quality: row.get("response_quality"),
            user_satisfaction: row.get("user_satisfaction"),
            success: row.get("success"),
            error_type: row.get("error_type"),
            retry_count: row.get::<_, i32>("retry_count") as u32,
            complexity,
            domain: row.get("domain"),
            endpoint: row.get("endpoint"),
        })
    }

    fn row_to_effectiveness(&self, row: &Row) -> Result<ParameterEffectiveness, AnalyticsError> {
        let parameters_json: JsonValue = row.get("parameters");
        let parameters: TaskParameters = serde_json::from_value(parameters_json)
            .map_err(|e| AnalyticsError::SerializationError { 
                error: format!("Failed to deserialize parameters: {}", e) 
            })?;

        let task_type = TaskType::from_str(row.get("task_type"))
            .ok_or_else(|| AnalyticsError::InvalidParameter { 
                parameter: format!("task_type: {}", row.get::<_, String>("task_type")) 
            })?;

        Ok(ParameterEffectiveness {
            task_type,
            parameter_set: row.get("parameter_set"),
            parameters,
            total_executions: row.get::<_, i64>("total_executions") as u64,
            success_rate: row.get("success_rate"),
            avg_execution_time: row.get("avg_execution_time"),
            avg_token_usage: row.get("avg_token_usage"),
            avg_response_quality: row.get("avg_response_quality"),
            avg_user_satisfaction: row.get("avg_user_satisfaction"),
            quality_trend: row.get("quality_trend"),
            speed_trend: row.get("speed_trend"),
            cost_efficiency_trend: row.get("cost_efficiency_trend"),
            execution_time_variance: row.get("execution_time_variance"),
            quality_variance: row.get("quality_variance"),
            p95_execution_time: row.get("p95_execution_time"),
            p99_execution_time: row.get("p99_execution_time"),
            last_updated: row.get("last_updated"),
            confidence_score: row.get("confidence_score"),
            sample_size_adequacy: row.get("sample_size_adequacy"),
        })
    }
}