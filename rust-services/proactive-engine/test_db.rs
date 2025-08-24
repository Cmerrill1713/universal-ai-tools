use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Testing database connection...");
    
    let database_url = "postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable";
    println!("Connecting to: {}", database_url);
    
    let pool = PgPool::connect(database_url).await?;
    println!("✅ Connected to PostgreSQL successfully");
    
    let row: (i32,) = sqlx::query_as("SELECT 1")
        .fetch_one(&pool)
        .await?;
    
    println!("✅ Query executed successfully: {}", row.0);
    
    Ok(())
}