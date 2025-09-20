package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

var (
	redisClient *redis.Client
	logger      *logrus.Logger
	port        string
	redisURL    string
	weaviateURL string
	supabaseURL string
)

type HealthResponse struct {
	Status   string                 `json:"status"`
	Services map[string]bool        `json:"services"`
	Uptime   string                 `json:"uptime"`
	Details  map[string]interface{} `json:"details"`
}

type KnowledgeRequest struct {
	Query string `json:"query"`
	Limit int    `json:"limit,omitempty"`
}

type KnowledgeResponse struct {
	Results []interface{} `json:"results"`
	Count   int           `json:"count"`
}

func init() {
	// Load environment variables
	godotenv.Load()

	// Initialize logger
	logger = logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	// Get configuration
	port = getEnv("PORT", "8080")
	redisURL = getEnv("REDIS_URL", "redis://localhost:6379")
	weaviateURL = getEnv("WEAVIATE_URL", "http://localhost:8090")
	supabaseURL = getEnv("SUPABASE_URL", "http://localhost:54321")

	// Initialize Redis client
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		logger.Fatalf("Failed to parse Redis URL: %v", err)
	}
	redisClient = redis.NewClient(opt)

	// Test Redis connection
	ctx := context.Background()
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		logger.Warnf("Redis connection failed: %v", err)
	} else {
		logger.Info("Connected to Redis successfully")
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	logger.Info("Health check requested")

	health := HealthResponse{
		Status:   "healthy",
		Services: make(map[string]bool),
		Uptime:   fmt.Sprintf("%v", time.Since(startTime)),
		Details:  make(map[string]interface{}),
	}

	// Check Redis
	ctx := context.Background()
	_, err := redisClient.Ping(ctx).Result()
	health.Services["redis"] = err == nil
	if err != nil {
		health.Details["redis_error"] = err.Error()
	}

	// Check Weaviate
	weaviateHealthy := checkServiceHealth(weaviateURL + "/v1/meta")
	health.Services["weaviate"] = weaviateHealthy

	// Check Supabase (more tolerant - 404 is expected)
	supabaseHealthy := checkServiceHealth(supabaseURL + "/health")
	if !supabaseHealthy {
		// Try alternative endpoint
		supabaseHealthy = checkServiceHealth(supabaseURL + "/rest/v1/")
	}
	health.Services["supabase"] = supabaseHealthy

	// Determine overall health
	coreServicesHealthy := health.Services["redis"] && health.Services["weaviate"]
	if !coreServicesHealthy {
		health.Status = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func checkServiceHealth(url string) bool {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	// For Supabase, 404 is actually expected on /health endpoint
	if url == supabaseURL+"/health" && resp.StatusCode == 404 {
		return true
	}

	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
	logger.Info("Knowledge search requested")

	var req KnowledgeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// For now, return a simple response
	// In a real implementation, this would query Weaviate
	response := KnowledgeResponse{
		Results: []interface{}{
			map[string]interface{}{
				"id":      "1",
				"content": fmt.Sprintf("Search result for: %s", req.Query),
				"score":   0.95,
			},
		},
		Count: 1,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func storeHandler(w http.ResponseWriter, r *http.Request) {
	logger.Info("Knowledge store requested")

	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Store in Redis for caching
	ctx := context.Background()
	key := fmt.Sprintf("knowledge:%d", time.Now().Unix())
	dataJSON, _ := json.Marshal(data)
	err := redisClient.Set(ctx, key, dataJSON, time.Hour).Err()
	if err != nil {
		logger.Errorf("Failed to store in Redis: %v", err)
	}

	response := map[string]interface{}{
		"status": "stored",
		"key":    key,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

var startTime = time.Now()

func main() {
	logger.Info("Starting Knowledge Gateway service...")

	r := mux.NewRouter()
	r.Use(corsMiddleware)

	// Health endpoint
	r.HandleFunc("/health", healthHandler).Methods("GET")

	// Knowledge endpoints
	r.HandleFunc("/search", searchHandler).Methods("POST")
	r.HandleFunc("/store", storeHandler).Methods("POST")

	// Start server
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	logger.Infof("Knowledge Gateway listening on port %s", port)
	if err := server.ListenAndServe(); err != nil {
		logger.Fatalf("Server failed to start: %v", err)
	}
}
