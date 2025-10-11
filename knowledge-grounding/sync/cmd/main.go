package main

import (
    "context"
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "net/url"
    "os"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/go-redis/redis/v8"
    _ "github.com/lib/pq"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
    "github.com/sirupsen/logrus"
    "github.com/weaviate/weaviate-go-client/v4/weaviate"
)

// =============================================================================
// CONFIGURATION
// =============================================================================

type Config struct {
	SupabaseURL   string
	WeaviateURL   string
	RedisURL      string
	PrometheusURL string
	SyncInterval  time.Duration
	LogLevel      string
}

func LoadConfig() *Config {
	syncIntervalStr := getEnv("SYNC_INTERVAL", "300s")
	syncInterval, _ := time.ParseDuration(syncIntervalStr)

	return &Config{
		SupabaseURL:   getEnv("SUPABASE_URL", "postgres://postgres:postgres@supabase-db:5432/postgres"),
		WeaviateURL:   getEnv("WEAVIATE_URL", "http://weaviate-grounded:8080"),
		RedisURL:      getEnv("REDIS_URL", "redis://redis-grounded:6379"),
		PrometheusURL: getEnv("PROMETHEUS_URL", "http://prometheus-grounded:9090"),
		SyncInterval:  syncInterval,
		LogLevel:      getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// =============================================================================
// METRICS
// =============================================================================

var (
	syncOperations = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "knowledge_sync_operations_total",
			Help: "Total number of sync operations",
		},
		[]string{"operation", "status"},
	)

	syncDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "knowledge_sync_duration_seconds",
			Help:    "Time spent syncing knowledge",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 10),
		},
		[]string{"operation"},
	)

	syncErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "knowledge_sync_errors_total",
			Help: "Total number of sync errors",
		},
		[]string{"error_type"},
	)
)

func init() {
	prometheus.MustRegister(syncOperations, syncDuration, syncErrors)
}

// =============================================================================
// DATA STRUCTURES
// =============================================================================

type KnowledgeDocument struct {
	ID         string                 `json:"id" db:"id"`
	Title      string                 `json:"title" db:"title"`
	Content    string                 `json:"content" db:"content"`
	Source     string                 `json:"source" db:"source"`
	Type       string                 `json:"type" db:"type"`
	Metadata   map[string]interface{} `json:"metadata" db:"metadata"`
	Timestamp  time.Time              `json:"timestamp" db:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at" db:"updated_at"`
	Embeddings []float32              `json:"embeddings,omitempty"`
}

// =============================================================================
// KNOWLEDGE SYNC SERVICE
// =============================================================================

type KnowledgeSyncService struct {
    config   *Config
    db       *sql.DB
    weaviate *weaviate.Client
    redis    *redis.Client
    logger   *logrus.Logger
}

func NewKnowledgeSyncService(config *Config) (*KnowledgeSyncService, error) {
    logger := logrus.New()
    logger.SetLevel(logrus.InfoLevel)

    // DB (optional)
    var db *sql.DB
    if config.SupabaseURL != "" {
        d, err := sql.Open("postgres", config.SupabaseURL)
        if err != nil {
            logger.WithError(err).Warn("Database connection failed; continuing without DB")
        } else if err := d.Ping(); err != nil {
            logger.WithError(err).Warn("Database ping failed; continuing without DB")
        } else {
            db = d
        }
    }

    // Weaviate (optional)
    var weaviateClient *weaviate.Client
    if config.WeaviateURL != "" {
        weaviateClient = weaviate.New(weaviate.Config{
            Host:   strings.TrimPrefix(strings.TrimPrefix(config.WeaviateURL, "http://"), "https://"),
            Scheme: func() string { if strings.HasPrefix(config.WeaviateURL, "https://") { return "https" } ; return "http" }(),
        })
    }

    // Redis (optional, support redis://)
    redisAddr := config.RedisURL
    if strings.HasPrefix(redisAddr, "redis://") {
        if u, err := url.Parse(redisAddr); err == nil {
            redisAddr = u.Host
        }
    }
    var redisClient *redis.Client
    if redisAddr != "" {
        rc := redis.NewClient(&redis.Options{Addr: redisAddr})
        if err := rc.Ping(context.Background()).Err(); err != nil {
            logger.WithError(err).Warn("Redis not available; continuing without cache")
        } else {
            redisClient = rc
        }
    }

    return &KnowledgeSyncService{
        config:   config,
        db:       db,
        weaviate: weaviateClient,
        redis:    redisClient,
        logger:   logger,
    }, nil
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

func (ks *KnowledgeSyncService) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":        "healthy",
		"service":       "knowledge-sync",
		"timestamp":     time.Now().UTC(),
		"version":       "1.0.0",
		"sync_interval": ks.config.SyncInterval.String(),
	})
}

func (ks *KnowledgeSyncService) TriggerSync(c *gin.Context) {
	start := time.Now()

	if err := ks.performFullSync(); err != nil {
		syncOperations.WithLabelValues("full_sync", "error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	duration := time.Since(start)
	syncDuration.WithLabelValues("full_sync").Observe(duration.Seconds())
	syncOperations.WithLabelValues("full_sync", "success").Inc()

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "Sync completed successfully",
		"duration": duration.String(),
	})
}

func (ks *KnowledgeSyncService) GetSyncStatus(c *gin.Context) {
	// Get last sync timestamp from Redis
	lastSync, err := ks.redis.Get(context.Background(), "knowledge_sync:last_sync").Result()
	if err != nil {
		lastSync = "Never"
	}

	// Get sync statistics
	stats, err := ks.getSyncStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"last_sync":     lastSync,
		"sync_interval": ks.config.SyncInterval.String(),
		"statistics":    stats,
		"status":        "running",
	})
}

func (ks *KnowledgeSyncService) GetMetrics(c *gin.Context) {
	c.Header("Content-Type", "text/plain")
	promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}

// =============================================================================
// SYNC OPERATIONS
// =============================================================================

func (ks *KnowledgeSyncService) performFullSync() error {
	ks.logger.Info("Starting full knowledge sync")

	// Get all knowledge documents from Supabase
	docs, err := ks.getKnowledgeFromSupabase()
	if err != nil {
		return fmt.Errorf("failed to get knowledge from Supabase: %v", err)
	}

	// Sync to Weaviate
	synced := 0
	for _, doc := range docs {
		if err := ks.syncToWeaviate(doc); err != nil {
			ks.logger.WithError(err).WithField("doc_id", doc.ID).Error("Failed to sync document")
			syncErrors.WithLabelValues("weaviate_sync").Inc()
		} else {
			synced++
		}
	}

	// Update last sync timestamp
	ks.redis.Set(context.Background(), "knowledge_sync:last_sync", time.Now().Format(time.RFC3339), 0)

	ks.logger.WithField("synced_count", synced).Info("Full sync completed")
	return nil
}

func (ks *KnowledgeSyncService) getKnowledgeFromSupabase() ([]KnowledgeDocument, error) {
	query := `
		SELECT id, title, content, source, type, metadata, created_at, updated_at
		FROM knowledge_documents
		WHERE deleted_at IS NULL
		ORDER BY updated_at DESC
	`

    if ks.db == nil {
        return []KnowledgeDocument{}, nil
    }
    rows, err := ks.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []KnowledgeDocument
	for rows.Next() {
		var doc KnowledgeDocument
		var metadataJSON string

		err := rows.Scan(
			&doc.ID,
			&doc.Title,
			&doc.Content,
			&doc.Source,
			&doc.Type,
			&metadataJSON,
			&doc.Timestamp,
			&doc.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Parse metadata JSON
		if err := json.Unmarshal([]byte(metadataJSON), &doc.Metadata); err != nil {
			doc.Metadata = make(map[string]interface{})
		}

		docs = append(docs, doc)
	}

	return docs, nil
}

func (ks *KnowledgeSyncService) syncToWeaviate(doc KnowledgeDocument) error {
	// Create document in Weaviate
	dataSchema := map[string]interface{}{
		"title":     doc.Title,
		"content":   doc.Content,
		"source":    doc.Source,
		"type":      doc.Type,
		"metadata":  doc.Metadata,
		"timestamp": doc.Timestamp.Format(time.RFC3339),
		"updatedAt": doc.UpdatedAt.Format(time.RFC3339),
	}

	_, err := ks.weaviate.Data().Creator().
		WithClassName("KnowledgeDocument").
		WithID(doc.ID).
		WithProperties(dataSchema).
		Do(context.Background())

	return err
}

func (ks *KnowledgeSyncService) getSyncStats() (map[string]interface{}, error) {
	// Get document count from Supabase
	var supabaseCount int
	err := ks.db.QueryRow("SELECT COUNT(*) FROM knowledge_documents WHERE deleted_at IS NULL").Scan(&supabaseCount)
	if err != nil {
		return nil, err
	}

	// Get document count from Weaviate (simplified)
	weaviateCount := 0 // You'd implement actual Weaviate count query here

	return map[string]interface{}{
		"supabase_documents": supabaseCount,
		"weaviate_documents": weaviateCount,
		"sync_difference":    supabaseCount - weaviateCount,
	}, nil
}

// =============================================================================
// BACKGROUND SYNC
// =============================================================================

func (ks *KnowledgeSyncService) startBackgroundSync() {
	ticker := time.NewTicker(ks.config.SyncInterval)
	go func() {
		for range ticker.C {
			if err := ks.performFullSync(); err != nil {
				ks.logger.WithError(err).Error("Background sync failed")
				syncOperations.WithLabelValues("background_sync", "error").Inc()
			} else {
				syncOperations.WithLabelValues("background_sync", "success").Inc()
			}
		}
	}()
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

func main() {
	config := LoadConfig()

	service, err := NewKnowledgeSyncService(config)
	if err != nil {
		log.Fatal("Failed to create knowledge sync service:", err)
	}

	// Start background sync
	service.startBackgroundSync()

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// Health check endpoint
	r.GET("/health", service.HealthCheck)

	// Metrics endpoint
	r.GET("/metrics", service.GetMetrics)

	// Sync API endpoints
	api := r.Group("/api/v1")
	{
		api.POST("/sync", service.TriggerSync)
		api.GET("/sync/status", service.GetSyncStatus)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8089"
	}

	log.Printf("Knowledge Sync Service starting on port %s", port)
	log.Printf("Sync interval: %s", config.SyncInterval.String())

	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
