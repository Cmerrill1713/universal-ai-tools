package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
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
	contextTTL  time.Duration
	maxSize     int
)

type HealthResponse struct {
	Status   string                 `json:"status"`
	Services map[string]bool        `json:"services"`
	Uptime   string                 `json:"uptime"`
	Details  map[string]interface{} `json:"details"`
}

type ContextRequest struct {
	SessionID string `json:"session_id"`
	Message   string `json:"message"`
	UserID    string `json:"user_id,omitempty"`
}

type ContextResponse struct {
	SessionID string      `json:"session_id"`
	Context   interface{} `json:"context"`
	Size      int         `json:"size"`
	TTL       int64       `json:"ttl_seconds"`
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

	// Parse context TTL
	ttlStr := getEnv("CONTEXT_TTL", "3600s")
	contextTTL, _ = time.ParseDuration(ttlStr)
	if contextTTL == 0 {
		contextTTL = time.Hour
	}

	// Parse max context size
	maxSizeStr := getEnv("MAX_CONTEXT_SIZE", "8192")
	maxSize, _ = strconv.Atoi(maxSizeStr)
	if maxSize == 0 {
		maxSize = 8192
	}

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

func storeContextHandler(w http.ResponseWriter, r *http.Request) {
	logger.Info("Store context requested")

	var req ContextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Store context in Redis
	ctx := context.Background()
	key := fmt.Sprintf("context:%s", req.SessionID)

	contextData := map[string]interface{}{
		"session_id": req.SessionID,
		"message":    req.Message,
		"user_id":    req.UserID,
		"timestamp":  time.Now().Unix(),
		"size":       len(req.Message),
	}

	contextJSON, _ := json.Marshal(contextData)
	err := redisClient.Set(ctx, key, contextJSON, contextTTL).Err()
	if err != nil {
		logger.Errorf("Failed to store context: %v", err)
		http.Error(w, "Failed to store context", http.StatusInternalServerError)
		return
	}

	response := ContextResponse{
		SessionID: req.SessionID,
		Context:   contextData,
		Size:      len(req.Message),
		TTL:       int64(contextTTL.Seconds()),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getContextHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionId"]

	logger.Infof("Get context requested for session: %s", sessionID)

	ctx := context.Background()
	key := fmt.Sprintf("context:%s", sessionID)

	val, err := redisClient.Get(ctx, key).Result()
	if err != nil {
		http.Error(w, "Context not found", http.StatusNotFound)
		return
	}

	var contextData map[string]interface{}
	if err := json.Unmarshal([]byte(val), &contextData); err != nil {
		http.Error(w, "Invalid context data", http.StatusInternalServerError)
		return
	}

	response := ContextResponse{
		SessionID: sessionID,
		Context:   contextData,
		Size:      len(val),
		TTL:       int64(contextTTL.Seconds()),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func deleteContextHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionId"]

	logger.Infof("Delete context requested for session: %s", sessionID)

	ctx := context.Background()
	key := fmt.Sprintf("context:%s", sessionID)

	err := redisClient.Del(ctx, key).Err()
	if err != nil {
		logger.Errorf("Failed to delete context: %v", err)
		http.Error(w, "Failed to delete context", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"status":     "deleted",
		"session_id": sessionID,
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
	logger.Info("Starting Knowledge Context service...")

	r := mux.NewRouter()
	r.Use(corsMiddleware)

	// Health endpoint
	r.HandleFunc("/health", healthHandler).Methods("GET")

	// Context endpoints
	r.HandleFunc("/context", storeContextHandler).Methods("POST")
	r.HandleFunc("/context/{sessionId}", getContextHandler).Methods("GET")
	r.HandleFunc("/context/{sessionId}", deleteContextHandler).Methods("DELETE")

	// Start server
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	logger.Infof("Knowledge Context listening on port %s", port)
	if err := server.ListenAndServe(); err != nil {
		logger.Fatalf("Server failed to start: %v", err)
	}
}
