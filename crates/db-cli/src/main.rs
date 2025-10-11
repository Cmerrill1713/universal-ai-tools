use anyhow::Result;
use chrono::{DateTime, Utc};
use std::env;
use tokio_postgres::NoTls;

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: db-cli <validate|seed|cleanup>");
        std::process::exit(1);
    }

    let cmd = args[1].as_str();
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "postgresql://postgres:postgres@127.0.0.1:54322/postgres".to_string());
    let (client, connection) = tokio_postgres::connect(&db_url, NoTls).await?;
    // Spawn connection driver
    tokio::spawn(async move {
        if let Err(e) = connection.await { eprintln!("db connection error: {}", e); }
    });

    match cmd {
        "validate" => validate(&client).await?,
        "seed" => seed(&client).await?,
        "cleanup" => cleanup(&client).await?,
        _ => {
            eprintln!("Unknown command: {}", cmd);
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn validate(client: &tokio_postgres::Client) -> Result<()> {
    // Check core tables/views
    let tables = client
        .query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('memories','knowledge_sources')", &[])
        .await?;
    println!("Tables present: {}", tables.len());

    // Check ai_memories view existence
    let views = client
        .query("SELECT table_name FROM information_schema.views WHERE table_schema='public' AND table_name='ai_memories'", &[])
        .await?;
    println!("ai_memories view: {}", if views.is_empty() { "missing" } else { "ok" });

    // Check hybrid_search function
    let funcs = client
        .query("SELECT proname FROM pg_proc WHERE proname='hybrid_search'", &[])
        .await?;
    println!("hybrid_search function: {}", if funcs.is_empty() { "missing" } else { "ok" });

    // Simple counts
    if !tables.is_empty() {
        if let Ok(rows) = client.query("SELECT COUNT(*) FROM memories", &[]).await {
            let cnt: i64 = rows[0].get(0);
            println!("memories count: {}", cnt);
        }
        if let Ok(rows) = client.query("SELECT COUNT(*) FROM knowledge_sources", &[]).await {
            let cnt: i64 = rows[0].get(0);
            println!("knowledge_sources count: {}", cnt);
        }
    }
    Ok(())
}

async fn seed(client: &tokio_postgres::Client) -> Result<()> {
    // Insert a minimal memory via the consolidated schema (memories table)
    let now: DateTime<Utc> = Utc::now();
    let content = "Seed memory from db-cli";
    let metadata = serde_json::json!({
        "service_id": "test_db_cli",
        "memory_type": "seed",
        "tags": ["db-cli","seed"],
    });
    client
        .execute(
            "INSERT INTO memories (user_id, agent_id, source_type, source_id, content, embedding, context, metadata, importance, access_count, last_accessed, expires_at, created_at, updated_at)
             VALUES (NULL, NULL, 'system', 'db-cli', $1, NULL, '{}'::jsonb, $2, 0.5, 0, NULL, NULL, $3, $3)",
            &[&content, &tokio_postgres::types::Json(&metadata), &now],
        )
        .await?;
    println!("Inserted seed memory (service_id=test_db_cli)");
    Ok(())
}

async fn cleanup(client: &tokio_postgres::Client) -> Result<()> {
    // Remove seed/test records created by this CLI
    let n = client
        .execute(
            "DELETE FROM memories WHERE (metadata->>'service_id') LIKE 'test_%' OR (metadata->>'service_id') = 'test_db_cli'",
            &[],
        )
        .await?;
    println!("Deleted {} test memories", n);
    Ok(())
}
