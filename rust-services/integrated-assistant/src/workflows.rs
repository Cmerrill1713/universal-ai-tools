use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub steps: Vec<String>,
    pub usage_count: i32,
    pub success_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkflowExecution {
    pub workflow_id: Uuid,
    pub step_results: Vec<StepResult>,
    pub overall_success: bool,
    pub execution_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepResult {
    pub step_index: usize,
    pub command: String,
    pub success: bool,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
}

pub struct WorkflowEngine {
    pool: PgPool,
}

impl WorkflowEngine {
    pub async fn new(pool: PgPool) -> Result<Self> {
        // Create workflows table
        sqlx::query!(
            r#"
            CREATE TABLE IF NOT EXISTS workflows (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                steps JSONB NOT NULL,
                usage_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            "#
        )
        .execute(&pool)
        .await?;

        sqlx::query!(
            r#"
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
                step_results JSONB NOT NULL,
                overall_success BOOLEAN NOT NULL,
                execution_time_ms BIGINT NOT NULL,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            "#
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }

    pub async fn create_workflow(
        &self,
        name: String,
        description: Option<String>,
        steps: Vec<String>,
    ) -> Result<Workflow> {
        let workflow = sqlx::query_as!(
            Workflow,
            r#"
            INSERT INTO workflows (name, description, steps)
            VALUES ($1, $2, $3)
            RETURNING 
                id,
                name,
                description,
                steps as "steps!",
                usage_count as "usage_count!",
                success_count as "success_count!",
                created_at as "created_at!",
                updated_at as "updated_at!"
            "#,
            name,
            description,
            serde_json::json!(steps)
        )
        .fetch_one(&self.pool)
        .await?;

        info!("Created workflow: {} with {} steps", workflow.name, steps.len());
        Ok(workflow)
    }

    pub async fn execute_workflow(&self, workflow_id: Uuid) -> Result<WorkflowExecution> {
        let start = std::time::Instant::now();
        
        // Get workflow
        let workflow = sqlx::query_as!(
            Workflow,
            r#"
            SELECT 
                id,
                name,
                description,
                steps as "steps!",
                usage_count as "usage_count!",
                success_count as "success_count!",
                created_at as "created_at!",
                updated_at as "updated_at!"
            FROM workflows
            WHERE id = $1
            "#,
            workflow_id
        )
        .fetch_one(&self.pool)
        .await?;

        let mut step_results = Vec::new();
        let mut overall_success = true;

        // Execute each step
        for (index, step) in workflow.steps.iter().enumerate() {
            info!("Executing workflow step {}/{}: {}", index + 1, workflow.steps.len(), step);
            
            // Execute step using automation engine
            let result = execute_single_step(step).await;
            
            let step_result = match result {
                Ok(output) => StepResult {
                    step_index: index,
                    command: step.clone(),
                    success: true,
                    output: Some(output),
                    error: None,
                },
                Err(e) => {
                    overall_success = false;
                    StepResult {
                        step_index: index,
                        command: step.clone(),
                        success: false,
                        output: None,
                        error: Some(e.to_string()),
                    }
                }
            };
            
            step_results.push(step_result);
            
            // Stop on failure
            if !overall_success {
                break;
            }
        }

        let execution_time_ms = start.elapsed().as_millis() as u64;

        // Update workflow stats
        if overall_success {
            sqlx::query!(
                r#"
                UPDATE workflows 
                SET usage_count = usage_count + 1,
                    success_count = success_count + 1,
                    updated_at = NOW()
                WHERE id = $1
                "#,
                workflow_id
            )
            .execute(&self.pool)
            .await?;
        } else {
            sqlx::query!(
                r#"
                UPDATE workflows 
                SET usage_count = usage_count + 1,
                    updated_at = NOW()
                WHERE id = $1
                "#,
                workflow_id
            )
            .execute(&self.pool)
            .await?;
        }

        // Save execution record
        let execution = WorkflowExecution {
            workflow_id,
            step_results: step_results.clone(),
            overall_success,
            execution_time_ms,
        };

        sqlx::query!(
            r#"
            INSERT INTO workflow_executions (workflow_id, step_results, overall_success, execution_time_ms)
            VALUES ($1, $2, $3, $4)
            "#,
            workflow_id,
            serde_json::json!(step_results),
            overall_success,
            execution_time_ms as i64
        )
        .execute(&self.pool)
        .await?;

        Ok(execution)
    }

    pub async fn list_workflows(&self) -> Result<Vec<Workflow>> {
        let workflows = sqlx::query_as!(
            Workflow,
            r#"
            SELECT 
                id,
                name,
                description,
                steps as "steps!",
                usage_count as "usage_count!",
                success_count as "success_count!",
                created_at as "created_at!",
                updated_at as "updated_at!"
            FROM workflows
            ORDER BY updated_at DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(workflows)
    }

    pub async fn delete_workflow(&self, workflow_id: Uuid) -> Result<()> {
        sqlx::query!(
            r#"
            DELETE FROM workflows WHERE id = $1
            "#,
            workflow_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn count_workflows(&self) -> Result<usize> {
        let count = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) FROM workflows
            "#
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(count.unwrap_or(0) as usize)
    }
}

async fn execute_single_step(command: &str) -> Result<serde_json::Value> {
    use std::process::Command;
    
    // Use the ask.sh script as a general executor
    let output = Command::new("bash")
        .arg("ask.sh")
        .arg(command)
        .output()?;
    
    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout);
        Ok(serde_json::json!({
            "success": true,
            "output": result.to_string()
        }))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(anyhow::anyhow!("Step execution failed: {}", error))
    }
}