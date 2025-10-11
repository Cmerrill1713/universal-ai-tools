package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

// EmbeddingService represents the embedding service
type EmbeddingService struct {
	ollamaURL string
}

// EmbeddingRequest represents an embedding request
type EmbeddingRequest struct {
	Text string `json:"text"`
	Model string `json:"model,omitempty"`
}

// EmbeddingResponse represents an embedding response
type EmbeddingResponse struct {
	Embedding []float64 `json:"embedding"`
	Model     string    `json:"model"`
	Tokens    int       `json:"tokens"`
	Duration  int64     `json:"duration_ms"`
}

// OllamaEmbeddingRequest represents the request to Ollama
type OllamaEmbeddingRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

// OllamaEmbeddingResponse represents the response from Ollama
type OllamaEmbeddingResponse struct {
	Embedding []float64 `json:"embedding"`
	Tokens    int       `json:"tokens"`
}

// NewEmbeddingService creates a new embedding service
func NewEmbeddingService() *EmbeddingService {
	ollamaURL := os.Getenv("OLLAMA_URL")
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}

	return &EmbeddingService{
		ollamaURL: ollamaURL,
	}
}

// healthHandler provides a health check endpoint
func (es *EmbeddingService) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "embedding-service",
		"timestamp": time.Now(),
		"ollama_url": es.ollamaURL,
	})
}

// embeddingHandler generates embeddings using Ollama
func (es *EmbeddingService) embeddingHandler(w http.ResponseWriter, r *http.Request) {
	var req EmbeddingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, "Text is required", http.StatusBadRequest)
		return
	}

	// Default model
	if req.Model == "" {
		req.Model = "nomic-embed-text:latest"
	}

	start := time.Now()

	// Call Ollama embedding API
	ollamaReq := OllamaEmbeddingRequest{
		Model:  req.Model,
		Prompt: req.Text,
	}

	reqBody, err := json.Marshal(ollamaReq)
	if err != nil {
		http.Error(w, "Failed to marshal request", http.StatusInternalServerError)
		return
	}

	resp, err := http.Post(es.ollamaURL+"/api/embeddings", "application/json",
		strings.NewReader(string(reqBody)))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to call Ollama: %v", err), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Ollama returned status %d", resp.StatusCode), http.StatusInternalServerError)
		return
	}

	var ollamaResp OllamaEmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		http.Error(w, "Failed to decode Ollama response", http.StatusInternalServerError)
		return
	}

	duration := time.Since(start).Milliseconds()

	response := EmbeddingResponse{
		Embedding: ollamaResp.Embedding,
		Model:     req.Model,
		Tokens:    ollamaResp.Tokens,
		Duration:  duration,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// modelsHandler lists available embedding models
func (es *EmbeddingService) modelsHandler(w http.ResponseWriter, r *http.Request) {
	models := []map[string]interface{}{
		{
			"name":        "nomic-embed-text:latest",
			"description": "Fast, efficient embeddings (274MB)",
			"dimensions":  768,
		},
		{
			"name":        "snowflake-arctic-embed2:latest",
			"description": "High-quality embeddings (1.1GB)",
			"dimensions":  1024,
		},
		{
			"name":        "mxbai-embed-large:latest",
			"description": "Large embedding model (669MB)",
			"dimensions":  1024,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"models": models,
	})
}

func main() {
	service := NewEmbeddingService()

	router := mux.NewRouter()
	router.HandleFunc("/health", service.healthHandler).Methods("GET")
	router.HandleFunc("/embed", service.embeddingHandler).Methods("POST")
	router.HandleFunc("/models", service.modelsHandler).Methods("GET")

	port := "8092"
	log.Printf("Embedding Service starting on port %s", port)
	log.Printf("Health check available at http://localhost:%s/health", port)
	log.Printf("Embedding endpoint available at http://localhost:%s/embed", port)
	log.Printf("Models endpoint available at http://localhost:%s/models", port)
	log.Fatal(http.ListenAndServe(":"+port, router))
}
