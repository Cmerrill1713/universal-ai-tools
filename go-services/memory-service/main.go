package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/lib/pq"
	"github.com/jmoiron/sqlx"
	"github.com/go-redis/redis/v8"
	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/auth"
)

// Memory represents a stored memory/context
type Memory struct {
	ID          string                 `json:"id" db:"id"`
	UserID      string                 `json:"user_id" db:"user_id"`
	Type        string                 `json:"type" db:"type"`
	Content     string                 `json:"content" db:"content"`
	Embedding   []float32              `json:"embedding,omitempty" db:"embedding"`
	Metadata    map[string]interface{} `json:"metadata" db:"metadata"`
	Tags        []string               `json:"tags" db:"tags"`
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
	AccessCount int                    `json:"access_count" db:"access_count"`
	LastAccess  *time.Time             `json:"last_access" db:"last_access"`
}

// MemoryQuery represents search parameters
type MemoryQuery struct {
	UserID     string    `json:"user_id"`
	Type       string    `json:"type,omitempty"`
	Tags       []string  `json:"tags,omitempty"`
	Query      string    `json:"query,omitempty"`
	Limit      int       `json:"limit,omitempty"`
	Offset     int       `json:"offset,omitempty"`
	StartDate  time.Time `json:"start_date,omitempty"`
	EndDate    time.Time `json:"end_date,omitempty"`
}

// Context represents a conversation context
type Context struct {
	ID            string    `json:"id" db:"id"`
	UserID        string    `json:"user_id" db:"user_id"`
	ConversationID string   `json:"conversation_id" db:"conversation_id"`
	Summary       string    `json:"summary" db:"summary"`
	Memories      []string  `json:"memories" db:"memories"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// MemoryService manages memory operations
type MemoryService struct {
	mu            sync.RWMutex
	db            *sqlx.DB
	redis         *redis.Client
	weaviateClient *weaviate.Client
}

var memoryService *MemoryService
var ctx = context.Background()

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize database connection
	dbURL := getEnvOrDefault("DATABASE_URL", "postgres://postgres:postgres@localhost/universal_ai_tools?sslmode=disable")
	db, err := sqlx.Connect("postgres", dbURL)
	if err != nil {
		log.Printf("Failed to connect to database: %v", err)
	}

	// Initialize Redis connection
	redisAddr := getEnvOrDefault("REDIS_ADDR", "localhost:6379")
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
		DB:   0,
	})

	// Test Redis connection
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Failed to connect to Redis: %v", err)
	}

	// Initialize Weaviate client
	weaviateURL := getEnvOrDefault("WEAVIATE_URL", "http://localhost:8080")
	weaviateAPIKey := getEnvOrDefault("WEAVIATE_API_KEY", "")
	
	cfg := weaviate.Config{
		Host:   weaviateURL,
		Scheme: "http",
	}

	if weaviateAPIKey != "" {
		cfg.AuthConfig = auth.ApiKey{Value: weaviateAPIKey}
	}

	weaviateClient, err := weaviate.NewClient(cfg)
	if err != nil {
		log.Printf("Failed to create Weaviate client: %v", err)
	}

	// Initialize memory service
	memoryService = &MemoryService{
		db:             db,
		redis:          redisClient,
		weaviateClient: weaviateClient,
	}

	// Create tables if they don't exist
	if db != nil {
		createTables(db)
	}

	// Initialize Weaviate schema
	if weaviateClient != nil {
		initWeaviateSchema(weaviateClient)
	}
}

func initWeaviateSchema(client *weaviate.Client) error {
	// Schema is already created via Weaviate API or migration scripts
	// Just verify it exists
	schema, err := client.Schema().Getter().Do(context.Background())
	if err != nil {
		return fmt.Errorf("failed to get schema: %w", err)
	}
	
	// Check if Memory class exists
	hasMemoryClass := false
	for _, class := range schema.Classes {
		if class.Class == "Memory" {
			hasMemoryClass = true
			break
		}
	}
	
	if !hasMemoryClass {
		log.Println("Warning: Memory class not found in Weaviate schema. Please run migration script.")
	}
	
	return nil
}

func createTables(db *sqlx.DB) {
	schema := `
	CREATE TABLE IF NOT EXISTS memories (
		id VARCHAR(36) PRIMARY KEY,
		user_id VARCHAR(255) NOT NULL,
		type VARCHAR(50) NOT NULL,
		content TEXT NOT NULL,
		embedding FLOAT4[],
		metadata JSONB DEFAULT '{}',
		tags TEXT[],
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		access_count INTEGER DEFAULT 0,
		last_access TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
	CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
	CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);

	CREATE TABLE IF NOT EXISTS contexts (
		id VARCHAR(36) PRIMARY KEY,
		user_id VARCHAR(255) NOT NULL,
		conversation_id VARCHAR(36) NOT NULL,
		summary TEXT NOT NULL,
		memories TEXT[],
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_contexts_user_id ON contexts(user_id);
	CREATE INDEX IF NOT EXISTS idx_contexts_conversation_id ON contexts(conversation_id);
	`

	if _, err := db.Exec(schema); err != nil {
		log.Printf("Failed to create tables: %v", err)
	}
}

// API Handlers

func storeMemoryHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var memory Memory
	if err := json.NewDecoder(r.Body).Decode(&memory); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	memory.ID = uuid.New().String()
	memory.UserID = userID
	memory.CreatedAt = time.Now()
	memory.UpdatedAt = time.Now()

	// Store in Weaviate for vector search
	if memoryService.weaviateClient != nil {
		metadataJSON, _ := json.Marshal(memory.Metadata)
		dataSchema := map[string]interface{}{
			"userId":      memory.UserID,
			"type":        memory.Type,
			"content":     memory.Content,
			"tags":        memory.Tags,
			"metadata":    string(metadataJSON),
			"createdAt":   memory.CreatedAt,
			"accessCount": memory.AccessCount,
		}

		_, err := memoryService.weaviateClient.Data().Creator().
			WithClassName("Memory").
			WithID(memory.ID).
			WithProperties(dataSchema).
			Do(context.Background())

		if err != nil {
			log.Printf("Failed to store memory in Weaviate: %v", err)
		}
	}

	// Store in PostgreSQL for structured queries
	if memoryService.db != nil {
		query := `
			INSERT INTO memories (id, user_id, type, content, metadata, tags, created_at, updated_at)
			VALUES (:id, :user_id, :type, :content, :metadata, :tags, :created_at, :updated_at)
		`
		if _, err := memoryService.db.NamedExec(query, memory); err != nil {
			log.Printf("Failed to store memory in database: %v", err)
			http.Error(w, "Failed to store memory", http.StatusInternalServerError)
			return
		}
	}

	// Cache in Redis for quick access
	if memoryService.redis != nil {
		cacheKey := fmt.Sprintf("memory:%s:%s", userID, memory.ID)
		memoryJSON, _ := json.Marshal(memory)
		memoryService.redis.Set(ctx, cacheKey, memoryJSON, 1*time.Hour)
		
		// Add to user's memory list
		listKey := fmt.Sprintf("user_memories:%s", userID)
		memoryService.redis.LPush(ctx, listKey, memory.ID)
		memoryService.redis.LTrim(ctx, listKey, 0, 99) // Keep last 100 memories
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(memory)
}

func searchMemoriesHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var query MemoryQuery
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	query.UserID = userID
	if query.Limit == 0 {
		query.Limit = 20
	}

	memories := []Memory{}

	// Search with Weaviate for semantic search
	if query.Query != "" && memoryService.weaviateClient != nil {
		result, err := memoryService.weaviateClient.GraphQL().Get().
			WithClassName("Memory").
			WithFields([]string{
				"userId",
				"type", 
				"content",
				"tags",
				"metadata",
				"createdAt",
				"accessCount",
				"_additional { id distance }",
			}).
			WithNearText(memoryService.weaviateClient.GraphQL().NearTextArgBuilder().
				WithConcepts([]string{query.Query})).
			WithWhere(memoryService.weaviateClient.GraphQL().WhereArgBuilder().
				WithPath([]string{"userId"}).
				WithOperator("Equal").
				WithValueText(userID)).
			WithLimit(query.Limit).
			Do(context.Background())

		if err != nil {
			log.Printf("Weaviate search failed: %v", err)
		} else {
			// Parse results
			data, _ := result.Data["Get"].(map[string]interface{})
			memoryResults, _ := data["Memory"].([]interface{})
			
			for _, item := range memoryResults {
				memoryData := item.(map[string]interface{})
				additional := memoryData["_additional"].(map[string]interface{})
				
				memory := Memory{
					ID:      additional["id"].(string),
					UserID:  memoryData["userId"].(string),
					Type:    memoryData["type"].(string),
					Content: memoryData["content"].(string),
				}
				
				if tags, ok := memoryData["tags"].([]interface{}); ok {
					for _, tag := range tags {
						memory.Tags = append(memory.Tags, tag.(string))
					}
				}
				
				memories = append(memories, memory)
			}
		}
	} else if memoryService.db != nil {
		// Fallback to PostgreSQL search
		sqlQuery := `
			SELECT id, user_id, type, content, metadata, tags, created_at, updated_at, access_count, last_access
			FROM memories
			WHERE user_id = $1
		`
		args := []interface{}{userID}
		argCount := 1

		if query.Type != "" {
			argCount++
			sqlQuery += fmt.Sprintf(" AND type = $%d", argCount)
			args = append(args, query.Type)
		}

		if len(query.Tags) > 0 {
			argCount++
			sqlQuery += fmt.Sprintf(" AND tags && $%d", argCount)
			args = append(args, pq.Array(query.Tags))
		}

		sqlQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT %d OFFSET %d", query.Limit, query.Offset)

		if err := memoryService.db.Select(&memories, sqlQuery, args...); err != nil {
			log.Printf("Database query failed: %v", err)
		}
	}

	// Update access counts
	for i := range memories {
		memories[i].AccessCount++
		now := time.Now()
		memories[i].LastAccess = &now

		// Update in database
		if memoryService.db != nil {
			updateQuery := `
				UPDATE memories 
				SET access_count = access_count + 1, last_access = $1 
				WHERE id = $2
			`
			memoryService.db.Exec(updateQuery, now, memories[i].ID)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"memories": memories,
		"count":    len(memories),
		"query":    query,
	})
}

func getMemoryHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	memoryID := vars["id"]

	// Check Redis cache first
	if memoryService.redis != nil {
		cacheKey := fmt.Sprintf("memory:%s:%s", userID, memoryID)
		cached, err := memoryService.redis.Get(ctx, cacheKey).Result()
		if err == nil {
			var memory Memory
			if json.Unmarshal([]byte(cached), &memory) == nil {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(memory)
				return
			}
		}
	}

	// Get from Weaviate
	if memoryService.weaviateClient != nil {
		result, err := memoryService.weaviateClient.Data().GetterById().
			WithClassName("Memory").
			WithID(memoryID).
			Do(context.Background())

		if err == nil && result != nil {
			props := result[0].Properties.(map[string]interface{})
			memory := Memory{
				ID:      memoryID,
				UserID:  props["userId"].(string),
				Type:    props["type"].(string),
				Content: props["content"].(string),
			}
			
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(memory)
			return
		}
	}

	// Fallback to database
	if memoryService.db != nil {
		var memory Memory
		query := "SELECT * FROM memories WHERE id = $1 AND user_id = $2"
		if err := memoryService.db.Get(&memory, query, memoryID, userID); err != nil {
			http.Error(w, "Memory not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(memory)
		return
	}

	http.Error(w, "Memory not found", http.StatusNotFound)
}

func deleteMemoryHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	memoryID := vars["id"]

	// Delete from Weaviate
	if memoryService.weaviateClient != nil {
		memoryService.weaviateClient.Data().Deleter().
			WithClassName("Memory").
			WithID(memoryID).
			Do(context.Background())
	}

	// Delete from database
	if memoryService.db != nil {
		query := "DELETE FROM memories WHERE id = $1 AND user_id = $2"
		memoryService.db.Exec(query, memoryID, userID)
	}

	// Delete from cache
	if memoryService.redis != nil {
		cacheKey := fmt.Sprintf("memory:%s:%s", userID, memoryID)
		memoryService.redis.Del(ctx, cacheKey)
	}

	w.WriteHeader(http.StatusNoContent)
}

func storeContextHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var context Context
	if err := json.NewDecoder(r.Body).Decode(&context); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	context.ID = uuid.New().String()
	context.UserID = userID
	context.CreatedAt = time.Now()
	context.UpdatedAt = time.Now()

	if memoryService.db != nil {
		query := `
			INSERT INTO contexts (id, user_id, conversation_id, summary, memories, created_at, updated_at)
			VALUES (:id, :user_id, :conversation_id, :summary, :memories, :created_at, :updated_at)
		`
		if _, err := memoryService.db.NamedExec(query, context); err != nil {
			log.Printf("Failed to store context: %v", err)
			http.Error(w, "Failed to store context", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(context)
}

func getContextHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	conversationID := vars["conversation_id"]

	var context Context
	if memoryService.db != nil {
		query := `
			SELECT * FROM contexts 
			WHERE user_id = $1 AND conversation_id = $2 
			ORDER BY created_at DESC 
			LIMIT 1
		`
		if err := memoryService.db.Get(&context, query, userID, conversationID); err != nil {
			http.Error(w, "Context not found", http.StatusNotFound)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(context)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status": "healthy",
		"services": map[string]bool{
			"database": memoryService.db != nil,
			"redis":    memoryService.redis != nil,
			"weaviate": memoryService.weaviateClient != nil,
		},
		"timestamp": time.Now().Unix(),
	}

	// Test database connection
	if memoryService.db != nil {
		if err := memoryService.db.Ping(); err != nil {
			health["services"].(map[string]bool)["database"] = false
		}
	}

	// Test Redis connection
	if memoryService.redis != nil {
		if err := memoryService.redis.Ping(ctx).Err(); err != nil {
			health["services"].(map[string]bool)["redis"] = false
		}
	}

	// Test Weaviate connection
	if memoryService.weaviateClient != nil {
		_, err := memoryService.weaviateClient.Misc().MetaGetter().Do(context.Background())
		if err != nil {
			health["services"].(map[string]bool)["weaviate"] = false
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// Memory endpoints
	router.HandleFunc("/memories", storeMemoryHandler).Methods("POST")
	router.HandleFunc("/memories/search", searchMemoriesHandler).Methods("POST")
	router.HandleFunc("/memories/{id}", getMemoryHandler).Methods("GET")
	router.HandleFunc("/memories/{id}", deleteMemoryHandler).Methods("DELETE")

	// Context endpoints
	router.HandleFunc("/contexts", storeContextHandler).Methods("POST")
	router.HandleFunc("/contexts/{conversation_id}", getContextHandler).Methods("GET")

	// CORS middleware
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "*")
			
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	})

	port := getEnvOrDefault("MEMORY_SERVICE_PORT", "8017")
	log.Printf("Memory Service starting on port %s", port)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}