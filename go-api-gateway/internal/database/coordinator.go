// Database Coordinator for Supabase/Redis/Neo4j Operations
// Centralized database operations with connection pooling and failover

package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/lib/pq"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// DatabaseCoordinator manages all database connections and operations
type DatabaseCoordinator struct {
	postgres    *sql.DB
	pgxPool     *pgxpool.Pool  // For services that need pgxpool
	redis       *redis.Client
	neo4j       neo4j.DriverWithContext
	tracer      trace.Tracer
	metrics     *DatabaseMetrics
	mu          sync.RWMutex
	healthCheck map[string]bool
}

// Coordinator is an alias for DatabaseCoordinator to maintain API compatibility
type Coordinator = DatabaseCoordinator

// DatabaseConfig holds configuration for all databases
type DatabaseConfig struct {
	PostgresURL   string
	RedisURL      string
	Neo4jURI      string
	Neo4jUser     string
	Neo4jPassword string
	MaxRetries    int
	Timeout       time.Duration
}

// DatabaseMetrics tracks database operation metrics
type DatabaseMetrics struct {
	PostgresConnections int64
	RedisConnections    int64
	Neo4jConnections    int64
	QueryDuration       map[string]time.Duration
	ErrorCounts         map[string]int64
	mu                  sync.RWMutex
}

// ContextData represents structured data for Supabase context storage
type ContextData struct {
	UserID    string                 `json:"user_id"`
	Category  string                 `json:"category"`
	Source    string                 `json:"source"`
	Content   map[string]interface{} `json:"content"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
}

// GraphNode represents a node in Neo4j
type GraphNode struct {
	ID         string                 `json:"id"`
	Labels     []string               `json:"labels"`
	Properties map[string]interface{} `json:"properties"`
}

// GraphRelationship represents a relationship in Neo4j
type GraphRelationship struct {
	Type       string                 `json:"type"`
	StartNode  string                 `json:"start_node"`
	EndNode    string                 `json:"end_node"`
	Properties map[string]interface{} `json:"properties"`
}

// NewDatabaseCoordinator creates a new database coordinator
func NewDatabaseCoordinator(config DatabaseConfig) (*DatabaseCoordinator, error) {
	coordinator := &DatabaseCoordinator{
		tracer: otel.Tracer("database-coordinator"),
		metrics: &DatabaseMetrics{
			QueryDuration: make(map[string]time.Duration),
			ErrorCounts:   make(map[string]int64),
		},
		healthCheck: make(map[string]bool),
	}

	// Initialize PostgreSQL (Supabase)
	if err := coordinator.initPostgreSQL(config.PostgresURL); err != nil {
		return nil, fmt.Errorf("failed to initialize PostgreSQL: %w", err)
	}

	// Initialize Redis
	if err := coordinator.initRedis(config.RedisURL); err != nil {
		return nil, fmt.Errorf("failed to initialize Redis: %w", err)
	}

	// Initialize Neo4j
	if err := coordinator.initNeo4j(config.Neo4jURI, config.Neo4jUser, config.Neo4jPassword); err != nil {
		return nil, fmt.Errorf("failed to initialize Neo4j: %w", err)
	}

	// Start health check routine
	go coordinator.startHealthCheck(config.Timeout)

	log.Println("Database coordinator initialized successfully")
	return coordinator, nil
}

// NewCoordinator creates a new database coordinator with config compatibility
func NewCoordinator(cfg interface{}, logger interface{}) (*Coordinator, error) {
	coordinator := &DatabaseCoordinator{
		tracer:      otel.Tracer("database-coordinator"),
		metrics:     &DatabaseMetrics{QueryDuration: make(map[string]time.Duration), ErrorCounts: make(map[string]int64)},
		healthCheck: make(map[string]bool),
	}

	// Initialize PostgreSQL connection to Supabase
	supabaseURL := "postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable"
	if err := coordinator.initPostgreSQL(supabaseURL); err != nil {
		log.Printf("Warning: PostgreSQL connection failed: %v", err)
		coordinator.healthCheck["postgres"] = false
	} else {
		coordinator.healthCheck["postgres"] = true
	}

	// Initialize Redis connection with optimized pool settings
	if err := coordinator.initRedisConnection(); err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
		coordinator.healthCheck["redis"] = false
	} else {
		coordinator.healthCheck["redis"] = true
	}

	// Neo4j is not available in development
	coordinator.healthCheck["neo4j"] = false

	return coordinator, nil
}

// GetPostgreSQL returns the PostgreSQL connection pool (pgxpool)
func (dc *DatabaseCoordinator) GetPostgreSQL() *pgxpool.Pool {
	dc.mu.RLock()
	defer dc.mu.RUnlock()
	// Return pgxPool if available, otherwise return nil
	// Services should handle nil connections gracefully
	return dc.pgxPool
}

// GetPostgreSQLDB returns the PostgreSQL database connection (sql.DB)
func (dc *DatabaseCoordinator) GetPostgreSQLDB() *sql.DB {
	dc.mu.RLock()
	defer dc.mu.RUnlock()
	return dc.postgres
}

// GetRedis returns the Redis client
func (dc *DatabaseCoordinator) GetRedis() *redis.Client {
	dc.mu.RLock()
	defer dc.mu.RUnlock()
	return dc.redis
}

// initRedisConnection initializes a real Redis connection with optimized pool settings
func (dc *DatabaseCoordinator) initRedisConnection() error {
	// Redis connection with optimized pool settings
	dc.redis = redis.NewClient(&redis.Options{
		Addr:         "localhost:6379",
		Password:     "", // no password for local dev
		DB:           0,  // default DB
		PoolSize:     20, // Maximum number of connections
		MinIdleConns: 5,  // Minimum number of idle connections
		ConnMaxLifetime: 30 * time.Minute,
		PoolTimeout:  4 * time.Second,
		ConnMaxIdleTime: 5 * time.Minute,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	
	_, err := dc.redis.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("redis connection test failed: %w", err)
	}
	
	log.Println("Redis connection pool initialized successfully")
	return nil
}

// initMockConnections initializes mock database connections for development
func (dc *DatabaseCoordinator) initMockConnections() {
	// For development, we'll use nil connections for postgres/neo4j
	// Redis is initialized with real connection above
	dc.postgres = nil
	dc.pgxPool = nil
	dc.neo4j = nil
}

// Initialize PostgreSQL connection
func (dc *DatabaseCoordinator) initPostgreSQL(postgresURL string) error {
	db, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("postgres ping failed: %w", err)
	}

	dc.postgres = db
	dc.healthCheck["postgres"] = true
	log.Println("PostgreSQL connection established")
	return nil
}

// Initialize Redis connection
func (dc *DatabaseCoordinator) initRedis(redisURL string) error {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return err
	}

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis ping failed: %w", err)
	}

	dc.redis = client
	dc.healthCheck["redis"] = true
	log.Println("Redis connection established")
	return nil
}

// Initialize Neo4j connection
func (dc *DatabaseCoordinator) initNeo4j(uri, username, password string) error {
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(username, password, ""))
	if err != nil {
		return err
	}

	// Verify connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := driver.VerifyConnectivity(ctx); err != nil {
		return fmt.Errorf("neo4j connectivity failed: %w", err)
	}

	dc.neo4j = driver
	dc.healthCheck["neo4j"] = true
	log.Println("Neo4j connection established")
	return nil
}

// Supabase Context Operations

// StoreContext stores context data in Supabase (PostgreSQL)
func (dc *DatabaseCoordinator) StoreContext(ctx context.Context, data ContextData) error {
	ctx, span := dc.tracer.Start(ctx, "store_context")
	defer span.End()

	span.SetAttributes(
		attribute.String("user_id", data.UserID),
		attribute.String("category", data.Category),
		attribute.String("source", data.Source),
	)

	start := time.Now()
	defer func() {
		dc.updateMetrics("store_context", time.Since(start))
	}()

	contentJSON, err := json.Marshal(data.Content)
	if err != nil {
		dc.incrementErrorCount("store_context")
		return fmt.Errorf("failed to marshal content: %w", err)
	}

	metadataJSON, err := json.Marshal(data.Metadata)
	if err != nil {
		dc.incrementErrorCount("store_context")
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		INSERT INTO context_storage (user_id, category, source, content, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, category, source) 
		DO UPDATE SET 
			content = EXCLUDED.content,
			metadata = EXCLUDED.metadata,
			created_at = EXCLUDED.created_at
	`

	_, err = dc.postgres.ExecContext(ctx, query,
		data.UserID,
		data.Category,
		data.Source,
		contentJSON,
		metadataJSON,
		data.CreatedAt,
	)

	if err != nil {
		dc.incrementErrorCount("store_context")
		span.RecordError(err)
		return fmt.Errorf("failed to store context: %w", err)
	}

	log.Printf("Stored context for user %s, category %s", data.UserID, data.Category)
	return nil
}

// RetrieveContext retrieves context data from Supabase
func (dc *DatabaseCoordinator) RetrieveContext(ctx context.Context, userID, category string, limit int) ([]ContextData, error) {
	ctx, span := dc.tracer.Start(ctx, "retrieve_context")
	defer span.End()

	span.SetAttributes(
		attribute.String("user_id", userID),
		attribute.String("category", category),
		attribute.Int("limit", limit),
	)

	start := time.Now()
	defer func() {
		dc.updateMetrics("retrieve_context", time.Since(start))
	}()

	query := `
		SELECT user_id, category, source, content, metadata, created_at
		FROM context_storage
		WHERE user_id = $1 AND category = $2
		ORDER BY created_at DESC
		LIMIT $3
	`

	rows, err := dc.postgres.QueryContext(ctx, query, userID, category, limit)
	if err != nil {
		dc.incrementErrorCount("retrieve_context")
		span.RecordError(err)
		return nil, fmt.Errorf("failed to query context: %w", err)
	}
	defer rows.Close()

	var contexts []ContextData
	for rows.Next() {
		var data ContextData
		var contentJSON, metadataJSON []byte

		err := rows.Scan(
			&data.UserID,
			&data.Category,
			&data.Source,
			&contentJSON,
			&metadataJSON,
			&data.CreatedAt,
		)
		if err != nil {
			dc.incrementErrorCount("retrieve_context")
			continue
		}

		if err := json.Unmarshal(contentJSON, &data.Content); err != nil {
			log.Printf("Failed to unmarshal content: %v", err)
			continue
		}

		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &data.Metadata); err != nil {
				log.Printf("Failed to unmarshal metadata: %v", err)
			}
		}

		contexts = append(contexts, data)
	}

	if err := rows.Err(); err != nil {
		dc.incrementErrorCount("retrieve_context")
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	log.Printf("Retrieved %d contexts for user %s, category %s", len(contexts), userID, category)
	return contexts, nil
}

// Redis Cache Operations

// CacheSet stores data in Redis with expiration
func (dc *DatabaseCoordinator) CacheSet(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	ctx, span := dc.tracer.Start(ctx, "cache_set")
	defer span.End()

	span.SetAttributes(attribute.String("cache_key", key))

	start := time.Now()
	defer func() {
		dc.updateMetrics("cache_set", time.Since(start))
	}()

	data, err := json.Marshal(value)
	if err != nil {
		dc.incrementErrorCount("cache_set")
		return fmt.Errorf("failed to marshal cache value: %w", err)
	}

	err = dc.redis.Set(ctx, key, data, expiration).Err()
	if err != nil {
		dc.incrementErrorCount("cache_set")
		span.RecordError(err)
		return fmt.Errorf("failed to set cache: %w", err)
	}

	return nil
}

// CacheGet retrieves data from Redis
func (dc *DatabaseCoordinator) CacheGet(ctx context.Context, key string, dest interface{}) error {
	ctx, span := dc.tracer.Start(ctx, "cache_get")
	defer span.End()

	span.SetAttributes(attribute.String("cache_key", key))

	start := time.Now()
	defer func() {
		dc.updateMetrics("cache_get", time.Since(start))
	}()

	data, err := dc.redis.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return fmt.Errorf("cache miss for key: %s", key)
		}
		dc.incrementErrorCount("cache_get")
		span.RecordError(err)
		return fmt.Errorf("failed to get cache: %w", err)
	}

	err = json.Unmarshal([]byte(data), dest)
	if err != nil {
		dc.incrementErrorCount("cache_get")
		return fmt.Errorf("failed to unmarshal cache value: %w", err)
	}

	return nil
}

// CacheDelete removes data from Redis
func (dc *DatabaseCoordinator) CacheDelete(ctx context.Context, keys ...string) error {
	ctx, span := dc.tracer.Start(ctx, "cache_delete")
	defer span.End()

	start := time.Now()
	defer func() {
		dc.updateMetrics("cache_delete", time.Since(start))
	}()

	err := dc.redis.Del(ctx, keys...).Err()
	if err != nil {
		dc.incrementErrorCount("cache_delete")
		span.RecordError(err)
		return fmt.Errorf("failed to delete cache keys: %w", err)
	}

	return nil
}

// Neo4j Graph Operations

// CreateGraphNode creates a node in Neo4j
func (dc *DatabaseCoordinator) CreateGraphNode(ctx context.Context, node GraphNode) error {
	ctx, span := dc.tracer.Start(ctx, "create_graph_node")
	defer span.End()

	span.SetAttributes(
		attribute.String("node_id", node.ID),
		attribute.StringSlice("labels", node.Labels),
	)

	start := time.Now()
	defer func() {
		dc.updateMetrics("create_graph_node", time.Since(start))
	}()

	session := dc.neo4j.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	labels := strings.Join(node.Labels, ":")
	query := fmt.Sprintf("CREATE (n:%s {id: $id}) SET n += $properties RETURN n", labels)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
		result, err := tx.Run(ctx, query, map[string]interface{}{
			"id":         node.ID,
			"properties": node.Properties,
		})
		if err != nil {
			return nil, err
		}
		return result.Consume(ctx)
	})

	if err != nil {
		dc.incrementErrorCount("create_graph_node")
		span.RecordError(err)
		return fmt.Errorf("failed to create graph node: %w", err)
	}

	log.Printf("Created graph node: %s", node.ID)
	return nil
}

// CreateGraphRelationship creates a relationship in Neo4j
func (dc *DatabaseCoordinator) CreateGraphRelationship(ctx context.Context, rel GraphRelationship) error {
	ctx, span := dc.tracer.Start(ctx, "create_graph_relationship")
	defer span.End()

	span.SetAttributes(
		attribute.String("relationship_type", rel.Type),
		attribute.String("start_node", rel.StartNode),
		attribute.String("end_node", rel.EndNode),
	)

	start := time.Now()
	defer func() {
		dc.updateMetrics("create_graph_relationship", time.Since(start))
	}()

	session := dc.neo4j.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	query := `
		MATCH (a {id: $start_id}), (b {id: $end_id})
		CREATE (a)-[r:%s]->(b)
		SET r += $properties
		RETURN r
	`
	query = fmt.Sprintf(query, rel.Type)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
		result, err := tx.Run(ctx, query, map[string]interface{}{
			"start_id":   rel.StartNode,
			"end_id":     rel.EndNode,
			"properties": rel.Properties,
		})
		if err != nil {
			return nil, err
		}
		return result.Consume(ctx)
	})

	if err != nil {
		dc.incrementErrorCount("create_graph_relationship")
		span.RecordError(err)
		return fmt.Errorf("failed to create graph relationship: %w", err)
	}

	log.Printf("Created relationship: %s -%s-> %s", rel.StartNode, rel.Type, rel.EndNode)
	return nil
}

// QueryGraph executes a Cypher query against Neo4j
func (dc *DatabaseCoordinator) QueryGraph(ctx context.Context, query string, params map[string]interface{}) ([]map[string]interface{}, error) {
	ctx, span := dc.tracer.Start(ctx, "query_graph")
	defer span.End()

	start := time.Now()
	defer func() {
		dc.updateMetrics("query_graph", time.Since(start))
	}()

	session := dc.neo4j.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
		result, err := tx.Run(ctx, query, params)
		if err != nil {
			return nil, err
		}

		var records []map[string]interface{}
		for result.Next(ctx) {
			record := result.Record()
			recordMap := make(map[string]interface{})
			for _, key := range record.Keys {
				recordMap[key] = record.AsMap()[key]
			}
			records = append(records, recordMap)
		}

		return records, result.Err()
	})

	if err != nil {
		dc.incrementErrorCount("query_graph")
		span.RecordError(err)
		return nil, fmt.Errorf("failed to execute graph query: %w", err)
	}

	records := result.([]map[string]interface{})
	log.Printf("Graph query returned %d records", len(records))
	return records, nil
}

// Health and Metrics

// HealthCheck returns the health status of all databases
func (dc *DatabaseCoordinator) HealthCheck(ctx context.Context) map[string]bool {
	dc.mu.RLock()
	defer dc.mu.RUnlock()

	health := make(map[string]bool)
	for db, status := range dc.healthCheck {
		health[db] = status
	}

	return health
}

// GetMetrics returns current database metrics
func (dc *DatabaseCoordinator) GetMetrics() *DatabaseMetrics {
	dc.metrics.mu.RLock()
	defer dc.metrics.mu.RUnlock()

	return dc.metrics
}

// Close cleanly closes all database connections
func (dc *DatabaseCoordinator) Close() error {
	var errors []string

	if dc.postgres != nil {
		if err := dc.postgres.Close(); err != nil {
			errors = append(errors, fmt.Sprintf("postgres: %v", err))
		}
	}

	if dc.redis != nil {
		if err := dc.redis.Close(); err != nil {
			errors = append(errors, fmt.Sprintf("redis: %v", err))
		}
	}

	if dc.neo4j != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := dc.neo4j.Close(ctx); err != nil {
			errors = append(errors, fmt.Sprintf("neo4j: %v", err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("close errors: %s", strings.Join(errors, ", "))
	}

	log.Println("Database coordinator closed successfully")
	return nil
}

// Private helper methods

func (dc *DatabaseCoordinator) startHealthCheck(timeout time.Duration) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		dc.performHealthCheck(timeout)
	}
}

func (dc *DatabaseCoordinator) performHealthCheck(timeout time.Duration) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	dc.mu.Lock()
	defer dc.mu.Unlock()

	// Check PostgreSQL
	if dc.postgres != nil {
		dc.healthCheck["postgres"] = dc.postgres.PingContext(ctx) == nil
	}

	// Check Redis
	if dc.redis != nil {
		dc.healthCheck["redis"] = dc.redis.Ping(ctx).Err() == nil
	}

	// Check Neo4j
	if dc.neo4j != nil {
		dc.healthCheck["neo4j"] = dc.neo4j.VerifyConnectivity(ctx) == nil
	}
}

func (dc *DatabaseCoordinator) updateMetrics(operation string, duration time.Duration) {
	dc.metrics.mu.Lock()
	defer dc.metrics.mu.Unlock()
	dc.metrics.QueryDuration[operation] = duration
}

func (dc *DatabaseCoordinator) incrementErrorCount(operation string) {
	dc.metrics.mu.Lock()
	defer dc.metrics.mu.Unlock()
	dc.metrics.ErrorCounts[operation]++
}
