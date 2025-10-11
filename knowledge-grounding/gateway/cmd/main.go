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
    "github.com/google/uuid"
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
	SupabaseURL    string
	WeaviateURL    string
	RedisURL       string
	ChatServiceURL string
	MLXServiceURL  string
	PrometheusURL  string
	LogLevel       string
}

func LoadConfig() *Config {
	return &Config{
		SupabaseURL:    getEnv("SUPABASE_URL", "postgres://postgres:postgres@supabase-db:5432/postgres"),
		WeaviateURL:    getEnv("WEAVIATE_URL", "http://weaviate-grounded:8080"),
		RedisURL:       getEnv("REDIS_URL", "redis://redis-grounded:6379"),
		ChatServiceURL: getEnv("CHAT_SERVICE_URL", "http://chat-service-grounded:8010"),
		MLXServiceURL:  getEnv("MLX_SERVICE_URL", "http://mlx-service-grounded:8001"),
		PrometheusURL:  getEnv("PROMETHEUS_URL", "http://prometheus-grounded:9090"),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
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
	knowledgeRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "knowledge_gateway_requests_total",
			Help: "Total number of knowledge gateway requests",
		},
		[]string{"endpoint", "method", "status"},
	)

	knowledgeResponseTime = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "knowledge_gateway_response_time_seconds",
			Help:    "Response time for knowledge gateway requests",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 15),
		},
		[]string{"endpoint", "method"},
	)

	knowledgeCacheHits = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "knowledge_gateway_cache_hits_total",
			Help: "Total number of knowledge cache hits",
		},
		[]string{"cache_type"},
	)

	knowledgeDBQueries = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "knowledge_gateway_db_queries_total",
			Help: "Total number of database queries",
		},
		[]string{"operation", "table"},
	)
)

func init() {
	prometheus.MustRegister(knowledgeRequests, knowledgeResponseTime, knowledgeCacheHits, knowledgeDBQueries)
}

// =============================================================================
// DATA STRUCTURES
// =============================================================================

type KnowledgeQuery struct {
	Query     string                 `json:"query"`
	Filters   map[string]interface{} `json:"filters,omitempty"`
	Limit     int                    `json:"limit,omitempty"`
	Context   map[string]interface{} `json:"context,omitempty"`
	UserID    string                 `json:"user_id,omitempty"`
	SessionID string                 `json:"session_id,omitempty"`
}

type KnowledgeResult struct {
	ID         string                 `json:"id"`
	Title      string                 `json:"title"`
	Content    string                 `json:"content"`
	Source     string                 `json:"source"`
	Type       string                 `json:"type"`
	Metadata   map[string]interface{} `json:"metadata"`
	Timestamp  time.Time              `json:"timestamp"`
	Relevance  float64                `json:"relevance"`
	Embeddings []float32              `json:"embeddings,omitempty"`
}

type GroundedResponse struct {
	Answer     string                 `json:"answer"`
	Sources    []KnowledgeResult      `json:"sources"`
	Context    map[string]interface{} `json:"context"`
	Confidence float64                `json:"confidence"`
	Metadata   map[string]interface{} `json:"metadata"`
}

type ChatRequest struct {
	Message      string                 `json:"message"`
	UserID       string                 `json:"user_id,omitempty"`
	SessionID    string                 `json:"session_id,omitempty"`
	Context      map[string]interface{} `json:"context,omitempty"`
	UseKnowledge bool                   `json:"use_knowledge,omitempty"`
}

// =============================================================================
// KNOWLEDGE GATEWAY SERVICE
// =============================================================================

type KnowledgeGateway struct {
    config   *Config
    db       *sql.DB
    weaviate *weaviate.Client
    redis    *redis.Client
    logger   *logrus.Logger
}

func NewKnowledgeGateway(config *Config) (*KnowledgeGateway, error) {
    // Setup logger
    logger := logrus.New()
    logger.SetLevel(logrus.InfoLevel)

    // Connect to Supabase (optional)
    var db *sql.DB
    if config.SupabaseURL != "" {
        d, err := sql.Open("postgres", config.SupabaseURL)
        if err != nil {
            logger.WithError(err).Warn("Database connection failed; continuing without DB")
        } else {
            if err := d.Ping(); err != nil {
                logger.WithError(err).Warn("Database ping failed; continuing without DB")
            } else {
                db = d
            }
        }
    }

    // Connect to Weaviate (optional)
    var weaviateClient *weaviate.Client
    if config.WeaviateURL != "" {
        weaviateClient = weaviate.New(weaviate.Config{
            Host:   strings.TrimPrefix(strings.TrimPrefix(config.WeaviateURL, "http://"), "https://"),
            Scheme: func() string { if strings.HasPrefix(config.WeaviateURL, "https://") { return "https" } ; return "http" }(),
        })
    }

    // Parse Redis address (allow URL or host:port)
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

    return &KnowledgeGateway{
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

func (kg *KnowledgeGateway) HealthCheck(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{
        "status":    "healthy",
        "service":   "knowledge-gateway",
        "timestamp": time.Now().UTC(),
        "version":   "1.0.0",
        "connections": gin.H{
            "database": func() string { if kg.db != nil { return "available" } ; return "unavailable" }(),
            "weaviate": func() string { if kg.weaviate != nil { return "available" } ; return "unavailable" }(),
            "redis":    func() string { if kg.redis != nil { return "available" } ; return "unavailable" }(),
        },
    })
}

func (kg *KnowledgeGateway) SearchKnowledge(c *gin.Context) {
	start := time.Now()
	var query KnowledgeQuery

	if err := c.ShouldBindJSON(&query); err != nil {
		knowledgeRequests.WithLabelValues("search", "POST", "400").Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set defaults
	if query.Limit == 0 {
		query.Limit = 10
	}

	// Check cache first
	cacheKey := fmt.Sprintf("knowledge:search:%s", query.Query)
    if kg.redis != nil {
        cached, err := kg.redis.Get(context.Background(), cacheKey).Result()
        if err == nil {
            var results []KnowledgeResult
            if err := json.Unmarshal([]byte(cached), &results); err == nil {
                knowledgeCacheHits.WithLabelValues("search").Inc()
                c.JSON(http.StatusOK, gin.H{
                    "results": results,
                    "cached":  true,
                    "count":   len(results),
                })
                return
            }
        }
    }

	// Search in Weaviate
	results, err := kg.searchInWeaviate(query)
	if err != nil {
		knowledgeRequests.WithLabelValues("search", "POST", "500").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Cache results
    if len(results) > 0 && kg.redis != nil {
        resultsJSON, _ := json.Marshal(results)
        kg.redis.Set(context.Background(), cacheKey, resultsJSON, 5*time.Minute)
    }

	duration := time.Since(start)
	knowledgeResponseTime.WithLabelValues("search", "POST").Observe(duration.Seconds())
	knowledgeRequests.WithLabelValues("search", "POST", "200").Inc()

	c.JSON(http.StatusOK, gin.H{
		"results": results,
		"cached":  false,
		"count":   len(results),
		"query":   query.Query,
	})
}

func (kg *KnowledgeGateway) GroundedChat(c *gin.Context) {
	start := time.Now()
	var req ChatRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		knowledgeRequests.WithLabelValues("chat", "POST", "400").Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.UseKnowledge {
		// Get relevant knowledge first
		knowledgeQuery := KnowledgeQuery{
			Query:     req.Message,
			Limit:     5,
			UserID:    req.UserID,
			SessionID: req.SessionID,
		}

		sources, err := kg.searchInWeaviate(knowledgeQuery)
		if err != nil {
			kg.logger.WithError(err).Error("Failed to retrieve knowledge")
		}

		// Add knowledge context to the chat request
		if req.Context == nil {
			req.Context = make(map[string]interface{})
		}
		req.Context["knowledge_sources"] = sources
	}

	// Forward to chat service
	chatResponse, err := kg.forwardToChatService(req)
	if err != nil {
		knowledgeRequests.WithLabelValues("chat", "POST", "500").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Store conversation in database
	if req.UserID != "" {
		go kg.storeConversation(req.UserID, req.SessionID, req.Message, chatResponse)
	}

	duration := time.Since(start)
	knowledgeResponseTime.WithLabelValues("chat", "POST").Observe(duration.Seconds())
	knowledgeRequests.WithLabelValues("chat", "POST", "200").Inc()

	c.JSON(http.StatusOK, chatResponse)
}

func (kg *KnowledgeGateway) AddKnowledge(c *gin.Context) {
	start := time.Now()
	var doc KnowledgeResult

	if err := c.ShouldBindJSON(&doc); err != nil {
		knowledgeRequests.WithLabelValues("add", "POST", "400").Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if doc.ID == "" {
		doc.ID = uuid.New().String()
	}
	if doc.Timestamp.IsZero() {
		doc.Timestamp = time.Now()
	}

	// Store in database
	if err := kg.storeKnowledge(doc); err != nil {
		knowledgeRequests.WithLabelValues("add", "POST", "500").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Store in Weaviate
	if err := kg.storeInWeaviate(doc); err != nil {
		kg.logger.WithError(err).Error("Failed to store in Weaviate")
	}

	duration := time.Since(start)
	knowledgeResponseTime.WithLabelValues("add", "POST").Observe(duration.Seconds())
	knowledgeRequests.WithLabelValues("add", "POST", "200").Inc()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"id":      doc.ID,
		"message": "Knowledge added successfully",
	})
}

func (kg *KnowledgeGateway) GetMetrics(c *gin.Context) {
	c.Header("Content-Type", "text/plain")
	promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

func (kg *KnowledgeGateway) searchInWeaviate(query KnowledgeQuery) ([]KnowledgeResult, error) {
	// Implementation for Weaviate search
	// This is a simplified version - you'd implement actual vector search here
	return []KnowledgeResult{}, nil
}

func (kg *KnowledgeGateway) forwardToChatService(req ChatRequest) (*GroundedResponse, error) {
	// Implementation for forwarding to chat service
	// This would make an HTTP request to the chat service
	return &GroundedResponse{
		Answer:     "This is a placeholder response",
		Sources:    []KnowledgeResult{},
		Context:    req.Context,
		Confidence: 0.8,
		Metadata:   map[string]interface{}{},
	}, nil
}

func (kg *KnowledgeGateway) storeKnowledge(doc KnowledgeResult) error {
	// Implementation for storing knowledge in Supabase
	knowledgeDBQueries.WithLabelValues("insert", "knowledge").Inc()
	return nil
}

func (kg *KnowledgeGateway) storeInWeaviate(doc KnowledgeResult) error {
	// Implementation for storing in Weaviate
	return nil
}

func (kg *KnowledgeGateway) storeConversation(userID, sessionID, message string, response *GroundedResponse) {
	// Implementation for storing conversation history
	knowledgeDBQueries.WithLabelValues("insert", "conversations").Inc()
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

func main() {
	config := LoadConfig()

	gateway, err := NewKnowledgeGateway(config)
	if err != nil {
		log.Fatal("Failed to create knowledge gateway:", err)
	}

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// Health check endpoint
	r.GET("/health", gateway.HealthCheck)

	// Metrics endpoint
	r.GET("/metrics", gateway.GetMetrics)

	// Knowledge API endpoints
	api := r.Group("/api/v1")
	{
		api.POST("/search", gateway.SearchKnowledge)
		api.POST("/chat", gateway.GroundedChat)
		api.POST("/knowledge", gateway.AddKnowledge)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8088"
	}

	log.Printf("Knowledge Gateway starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
