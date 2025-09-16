package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

// FastLLMService represents the fast LLM service
type FastLLMService struct {
	models []string
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
	Models    []string  `json:"models"`
}

// LLMRequest represents an LLM inference request
type LLMRequest struct {
	Model     string `json:"model"`
	Prompt    string `json:"prompt"`
	MaxTokens int    `json:"max_tokens,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
}

// LLMResponse represents an LLM inference response
type LLMResponse struct {
	Model     string `json:"model"`
	Text      string `json:"text"`
	Tokens    int    `json:"tokens"`
	Duration  int64  `json:"duration_ms"`
	Timestamp time.Time `json:"timestamp"`
}

// NewFastLLMService creates a new FastLLM service
func NewFastLLMService() *FastLLMService {
	return &FastLLMService{
		models: []string{
			"fast-llm-v1",
			"fast-llm-v2",
			"fast-llm-turbo",
		},
	}
}

// Health check endpoint
func (s *FastLLMService) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(HealthResponse{
		Status:    "healthy",
		Service:   "fast-llm",
		Timestamp: time.Now().UTC(),
		Version:   "1.0.0",
		Models:    s.models,
	})
}

// LLM inference endpoint
func (s *FastLLMService) inferenceHandler(w http.ResponseWriter, r *http.Request) {
	var req LLMRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate model
	validModel := false
	for _, model := range s.models {
		if model == req.Model {
			validModel = true
			break
		}
	}

	if !validModel {
		http.Error(w, "Invalid model", http.StatusBadRequest)
		return
	}

	// Set defaults
	if req.MaxTokens == 0 {
		req.MaxTokens = 100
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}

	// Simulate LLM inference
	start := time.Now()

	// Mock response based on prompt
	responseText := "This is a mock response from the fast-llm service. "
	if len(req.Prompt) > 50 {
		responseText += "The prompt was quite long and complex, requiring advanced processing. "
	}
	responseText += "The model processed your request successfully."

	duration := time.Since(start)

	resp := LLMResponse{
		Model:     req.Model,
		Text:      responseText,
		Tokens:    len(responseText) / 4, // Rough token estimate
		Duration:  duration.Milliseconds(),
		Timestamp: time.Now().UTC(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// Models list endpoint
func (s *FastLLMService) modelsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"models": s.models,
		"count":  len(s.models),
	})
}

// Metrics endpoint
func (s *FastLLMService) metricsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"requests_total":    1234,
		"requests_per_second": 45.6,
		"average_latency_ms": 23.4,
		"active_models":     len(s.models),
		"uptime_seconds":    int64(time.Since(time.Now().Add(-24 * time.Hour)).Seconds()),
	})
}

func main() {
	service := NewFastLLMService()

	// Create router
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/v1/health", service.healthHandler)
	mux.HandleFunc("/api/v1/inference", service.inferenceHandler)
	mux.HandleFunc("/api/v1/models", service.modelsHandler)
	mux.HandleFunc("/api/v1/metrics", service.metricsHandler)

	// Health check for load balancer
	mux.HandleFunc("/health", service.healthHandler)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3030"
	}

	log.Printf("Fast LLM service starting on port %s", port)
	log.Printf("Health check available at http://localhost:%s/health", port)
	log.Printf("Available models: %v", service.models)

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
