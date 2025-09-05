package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/auth"
)

// OldVectorData represents data from the old vector-db
type OldVectorData struct {
	ID        string                 `db:"id"`
	UserID    string                 `db:"user_id"`
	Content   string                 `db:"content"`
	Embedding []float32              `db:"embedding"`
	Metadata  map[string]interface{} `db:"metadata"`
	CreatedAt time.Time              `db:"created_at"`
}

// MigrationStats tracks migration progress
type MigrationStats struct {
	Total      int
	Migrated   int
	Failed     int
	StartTime  time.Time
	EndTime    time.Time
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Parse command line arguments
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run migrate-to-weaviate.go [memories|documents|all]")
		os.Exit(1)
	}

	migrationType := os.Args[1]
	
	// Initialize database connection
	dbURL := getEnvOrDefault("DATABASE_URL", "postgres://postgres:postgres@localhost/universal_ai_tools?sslmode=disable")
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Weaviate client
	weaviateURL := getEnvOrDefault("WEAVIATE_URL", "http://localhost:8090")
	weaviateAPIKey := getEnvOrDefault("WEAVIATE_API_KEY", "")
	
	cfg := weaviate.Config{
		Host:   weaviateURL,
		Scheme: "http",
	}

	if weaviateAPIKey != "" {
		cfg.AuthConfig = auth.ApiKey{Value: weaviateAPIKey}
	}

	client, err := weaviate.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to create Weaviate client: %v", err)
	}

	// Check Weaviate connectivity
	meta, err := client.Misc().MetaGetter().Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to connect to Weaviate: %v", err)
	}
	log.Printf("Connected to Weaviate version: %s", meta.Version)

	// Run migration based on type
	stats := &MigrationStats{
		StartTime: time.Now(),
	}

	switch migrationType {
	case "memories":
		migrateMemories(db, client, stats)
	case "documents":
		migrateDocuments(db, client, stats)
	case "all":
		migrateMemories(db, client, stats)
		migrateDocuments(db, client, stats)
	default:
		fmt.Printf("Unknown migration type: %s\n", migrationType)
		os.Exit(1)
	}

	stats.EndTime = time.Now()
	printStats(stats)
}

func migrateMemories(db *sql.DB, client *weaviate.Client, stats *MigrationStats) {
	log.Println("Starting memory migration...")

	// Query all memories from PostgreSQL
	query := `
		SELECT id, user_id, type, content, embedding, metadata, tags, 
		       created_at, updated_at, access_count
		FROM memories
		ORDER BY created_at
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Failed to query memories: %v", err)
		return
	}
	defer rows.Close()

	batchSize := 100
	batch := make([]map[string]interface{}, 0, batchSize)

	for rows.Next() {
		var (
			id          string
			userID      string
			memType     string
			content     string
			embedding   []float32
			metadata    sql.NullString
			tags        []string
			createdAt   time.Time
			updatedAt   time.Time
			accessCount int
		)

		err := rows.Scan(&id, &userID, &memType, &content, &embedding, 
			&metadata, &tags, &createdAt, &updatedAt, &accessCount)
		if err != nil {
			log.Printf("Failed to scan row: %v", err)
			stats.Failed++
			continue
		}

		stats.Total++

		// Prepare data for Weaviate
		memoryData := map[string]interface{}{
			"userId":      userID,
			"type":        memType,
			"content":     content,
			"tags":        tags,
			"createdAt":   createdAt,
			"accessCount": accessCount,
		}

		if metadata.Valid {
			memoryData["metadata"] = metadata.String
		}

		batch = append(batch, memoryData)

		// Process batch when it reaches the size limit
		if len(batch) >= batchSize {
			if err := insertBatch(client, "Memory", batch); err != nil {
				log.Printf("Failed to insert batch: %v", err)
				stats.Failed += len(batch)
			} else {
				stats.Migrated += len(batch)
				log.Printf("Migrated %d memories (total: %d)", len(batch), stats.Migrated)
			}
			batch = batch[:0]
		}
	}

	// Process remaining items
	if len(batch) > 0 {
		if err := insertBatch(client, "Memory", batch); err != nil {
			log.Printf("Failed to insert final batch: %v", err)
			stats.Failed += len(batch)
		} else {
			stats.Migrated += len(batch)
			log.Printf("Migrated final %d memories (total: %d)", len(batch), stats.Migrated)
		}
	}

	log.Printf("Memory migration completed: %d migrated, %d failed out of %d total",
		stats.Migrated, stats.Failed, stats.Total)
}

func migrateDocuments(db *sql.DB, client *weaviate.Client, stats *MigrationStats) {
	log.Println("Starting document migration...")

	// Query all documents (if they exist in a documents table)
	query := `
		SELECT id, user_id, title, content, metadata, tags, created_at
		FROM documents
		ORDER BY created_at
	`

	rows, err := db.Query(query)
	if err != nil {
		// Documents table might not exist
		log.Printf("No documents table found or query failed: %v", err)
		return
	}
	defer rows.Close()

	batchSize := 100
	batch := make([]map[string]interface{}, 0, batchSize)

	for rows.Next() {
		var (
			id        string
			userID    string
			title     string
			content   string
			metadata  sql.NullString
			tags      []string
			createdAt time.Time
		)

		err := rows.Scan(&id, &userID, &title, &content, &metadata, &tags, &createdAt)
		if err != nil {
			log.Printf("Failed to scan document row: %v", err)
			stats.Failed++
			continue
		}

		stats.Total++

		// Prepare data for Weaviate
		docData := map[string]interface{}{
			"title":     title,
			"content":   content,
			"userId":    userID,
			"tags":      tags,
			"createdAt": createdAt,
		}

		if metadata.Valid {
			docData["metadata"] = metadata.String
		}

		batch = append(batch, docData)

		// Process batch when it reaches the size limit
		if len(batch) >= batchSize {
			if err := insertBatch(client, "Document", batch); err != nil {
				log.Printf("Failed to insert document batch: %v", err)
				stats.Failed += len(batch)
			} else {
				stats.Migrated += len(batch)
				log.Printf("Migrated %d documents (total: %d)", len(batch), stats.Migrated)
			}
			batch = batch[:0]
		}
	}

	// Process remaining items
	if len(batch) > 0 {
		if err := insertBatch(client, "Document", batch); err != nil {
			log.Printf("Failed to insert final document batch: %v", err)
			stats.Failed += len(batch)
		} else {
			stats.Migrated += len(batch)
			log.Printf("Migrated final %d documents (total: %d)", len(batch), stats.Migrated)
		}
	}

	log.Printf("Document migration completed: %d migrated, %d failed out of %d total",
		stats.Migrated, stats.Failed, stats.Total)
}

func insertBatch(client *weaviate.Client, className string, batch []map[string]interface{}) error {
	batcher := client.Batch().ObjectsBatcher()
	
	for _, item := range batch {
		// Generate a deterministic ID based on content (or use existing ID if available)
		id := uuid.New().String()
		if existingID, ok := item["id"].(string); ok {
			id = existingID
			delete(item, "id") // Remove ID from properties
		}

		batcher = batcher.WithObject(&models.Object{
			Class:      className,
			ID:         id,
			Properties: item,
		})
	}

	_, err := batcher.Do(context.Background())
	return err
}

func printStats(stats *MigrationStats) {
	duration := stats.EndTime.Sub(stats.StartTime)
	
	fmt.Println("\n=== Migration Statistics ===")
	fmt.Printf("Total items:     %d\n", stats.Total)
	fmt.Printf("Migrated:        %d (%.1f%%)\n", stats.Migrated, 
		float64(stats.Migrated)/float64(stats.Total)*100)
	fmt.Printf("Failed:          %d (%.1f%%)\n", stats.Failed,
		float64(stats.Failed)/float64(stats.Total)*100)
	fmt.Printf("Duration:        %s\n", duration.Round(time.Second))
	fmt.Printf("Rate:            %.1f items/second\n", 
		float64(stats.Total)/duration.Seconds())
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Verification function to check migrated data
func verifyMigration(client *weaviate.Client, className string) error {
	// Count objects in Weaviate
	result, err := client.GraphQL().Aggregate().
		WithClassName(className).
		WithFields("meta { count }").
		Do(context.Background())
	
	if err != nil {
		return fmt.Errorf("failed to get count: %v", err)
	}

	data, ok := result.Data["Aggregate"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("unexpected result format")
	}

	classData, ok := data[className].([]interface{})
	if !ok || len(classData) == 0 {
		return fmt.Errorf("no data for class %s", className)
	}

	meta := classData[0].(map[string]interface{})["meta"].(map[string]interface{})
	count := int(meta["count"].(float64))
	
	log.Printf("Verified %d objects in Weaviate class %s", count, className)
	return nil
}