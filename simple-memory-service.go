package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
	"math/rand"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type Memory struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Type      string    `json:"type"`
	Content   string    `json:"content"`
	Tags      []string  `json:"tags"`
	Metadata  string    `json:"metadata"`
	CreatedAt time.Time `json:"created_at"`
	AccessCount int     `json:"access_count"`
}

type WeaviateObject struct {
	Class      string                 `json:"class"`
	Properties map[string]interface{} `json:"properties"`
	Vector     []float32              `json:"vector,omitempty"`
}

func generateRandomVector(size int) []float32 {
	vector := make([]float32, size)
	for i := range vector {
		vector[i] = rand.Float32()*2 - 1 // Random between -1 and 1
	}
	return vector
}

func storeInWeaviate(memory Memory) error {
	obj := WeaviateObject{
		Class: "Memory",
		Properties: map[string]interface{}{
			"userId":      memory.UserID,
			"type":        memory.Type,
			"content":     memory.Content,
			"tags":        memory.Tags,
			"metadata":    memory.Metadata,
			"createdAt":   memory.CreatedAt.Format(time.RFC3339),
			"accessCount": memory.AccessCount,
		},
		Vector: generateRandomVector(1536), // Simulate embedding vector
	}
	
	jsonData, err := json.Marshal(obj)
	if err != nil {
		return err
	}
	
	req, err := http.NewRequest("POST", "http://localhost:8090/v1/objects", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer universal-ai-key-change-me")
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 {
		return fmt.Errorf("weaviate error: %s", resp.Status)
	}
	
	return nil
}

func searchInWeaviate(userID, query string, limit int) ([]map[string]interface{}, error) {
	graphqlQuery := fmt.Sprintf(`{
		"query": "{ Get { Memory(where: { path: [\"userId\"] operator: Equal valueText: \"%s\" } limit: %d) { userId type content tags metadata createdAt accessCount _additional { id } } } }"
	}`, userID, limit)
	
	req, err := http.NewRequest("POST", "http://localhost:8090/v1/graphql", bytes.NewBufferString(graphqlQuery))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer universal-ai-key-change-me")
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	// Extract memories from GraphQL response
	data, ok := result["data"].(map[string]interface{})
	if !ok {
		return []map[string]interface{}{}, nil
	}
	
	get, ok := data["Get"].(map[string]interface{})
	if !ok {
		return []map[string]interface{}{}, nil
	}
	
	memories, ok := get["Memory"].([]interface{})
	if !ok {
		return []map[string]interface{}{}, nil
	}
	
	var results []map[string]interface{}
	for _, mem := range memories {
		if memMap, ok := mem.(map[string]interface{}); ok {
			results = append(results, memMap)
		}
	}
	
	return results, nil
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "memory-service",
		"weaviate":  "http://localhost:8090",
		"timestamp": time.Now().Unix(),
	})
}

func storeMemoryHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Missing X-User-ID header", http.StatusBadRequest)
		return
	}
	
	var req struct {
		Type     string   `json:"type"`
		Content  string   `json:"content"`
		Tags     []string `json:"tags"`
		Metadata string   `json:"metadata,omitempty"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	memory := Memory{
		ID:          uuid.New().String(),
		UserID:      userID,
		Type:        req.Type,
		Content:     req.Content,
		Tags:        req.Tags,
		Metadata:    req.Metadata,
		CreatedAt:   time.Now(),
		AccessCount: 0,
	}
	
	if err := storeInWeaviate(memory); err != nil {
		log.Printf("Failed to store in Weaviate: %v", err)
		http.Error(w, "Failed to store memory", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "stored",
		"memory": memory,
	})
}

func searchMemoriesHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Missing X-User-ID header", http.StatusBadRequest)
		return
	}
	
	query := r.URL.Query().Get("q")
	limit := 10
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := fmt.Sscanf(limitStr, "%d", &limit); err != nil || l != 1 {
			limit = 10
		}
	}
	
	memories, err := searchInWeaviate(userID, query, limit)
	if err != nil {
		log.Printf("Failed to search Weaviate: %v", err)
		http.Error(w, "Search failed", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"memories": memories,
		"count":    len(memories),
		"query":    query,
	})
}

func main() {
	rand.Seed(time.Now().UnixNano())
	
	r := mux.NewRouter()
	
	// Health check
	r.HandleFunc("/health", healthCheck).Methods("GET")
	
	// Memory endpoints
	r.HandleFunc("/memories", storeMemoryHandler).Methods("POST")
	r.HandleFunc("/memories/search", searchMemoriesHandler).Methods("GET")
	
	// Test endpoint
	r.HandleFunc("/test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service":   "memory-service",
			"connected": "weaviate",
			"status":    "ready",
		})
	}).Methods("GET")
	
	fmt.Println("Memory Service starting on :8017")
	log.Fatal(http.ListenAndServe(":8017", r))
}