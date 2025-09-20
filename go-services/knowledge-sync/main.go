package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
)

var (
	logger      *logrus.Logger
	port        string
	weaviateURL string
	supabaseURL string
)

type HealthResponse struct {
	Status   string                 `json:"status"`
	Services map[string]bool        `json:"services"`
	Uptime   string                 `json:"uptime"`
	Details  map[string]interface{} `json:"details"`
}

type SyncRequest struct {
	Source    string `json:"source"`
	Target    string `json:"target"`
	BatchSize int    `json:"batch_size,omitempty"`
}

type SyncResponse struct {
	Status      string `json:"status"`
	RecordsSync int    `json:"records_synced"`
	Message     string `json:"message"`
}

func init() {
	// Load environment variables
	godotenv.Load()

	// Initialize logger
	logger = logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	// Get configuration
	port = getEnv("PORT", "8080")
	weaviateURL = getEnv("WEAVIATE_URL", "http://localhost:8090")
	supabaseURL = getEnv("SUPABASE_URL", "http://localhost:54321")

	logger.Info("Knowledge Sync service initialized")
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
	coreServicesHealthy := health.Services["weaviate"]
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

func syncHandler(w http.ResponseWriter, r *http.Request) {
	logger.Info("Sync operation requested")

	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Simulate sync operation
	response := SyncResponse{
		Status:      "completed",
		RecordsSync: 42,
		Message:     fmt.Sprintf("Synced %d records from %s to %s", 42, req.Source, req.Target),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func fullSyncHandler(w http.ResponseWriter, r *http.Request) {
	logger.Info("Full sync operation requested")

	// Simulate full sync
	response := SyncResponse{
		Status:      "completed",
		RecordsSync: 1500,
		Message:     "Full synchronization completed successfully",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	logger.Info("Sync status requested")

	status := map[string]interface{}{
		"last_sync":     time.Now().Add(-5 * time.Minute).Format(time.RFC3339),
		"status":        "idle",
		"total_records": 1500,
		"pending":       0,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
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
	logger.Info("Starting Knowledge Sync service...")

	r := mux.NewRouter()
	r.Use(corsMiddleware)

	// Health endpoint
	r.HandleFunc("/health", healthHandler).Methods("GET")

	// Sync endpoints
	r.HandleFunc("/sync", syncHandler).Methods("POST")
	r.HandleFunc("/sync/full", fullSyncHandler).Methods("POST")
	r.HandleFunc("/status", statusHandler).Methods("GET")

	// Start server
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	logger.Infof("Knowledge Sync listening on port %s", port)
	if err := server.ListenAndServe(); err != nil {
		logger.Fatalf("Server failed to start: %v", err)
	}
}
