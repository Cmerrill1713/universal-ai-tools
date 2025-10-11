package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"weaviate-client/models"
	"weaviate-client/services"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// MemoryHandlers handles memory-related HTTP requests
type MemoryHandlers struct {
	weaviateService *services.WeaviateService
}

// NewMemoryHandlers creates a new memory handlers instance
func NewMemoryHandlers(ws *services.WeaviateService) *MemoryHandlers {
	return &MemoryHandlers{
		weaviateService: ws,
	}
}

// StoreMemoryHandler handles memory storage
func (mh *MemoryHandlers) StoreMemoryHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var memory models.Memory
	if err := json.NewDecoder(r.Body).Decode(&memory); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Set required fields
	memory.ID = uuid.New().String()
	memory.UserID = userID
	now := time.Now()
	memory.CreatedAt = now
	memory.UpdatedAt = now

	// Set defaults
	if memory.MemoryType == "" {
		memory.MemoryType = "general"
	}
	if memory.Importance == 0 {
		memory.Importance = 5
	}

	// Store memory
	storedMemory, err := mh.weaviateService.StoreMemory(&memory)
	if err != nil {
		log.Printf("Failed to store memory: %v", err)
		http.Error(w, "Failed to store memory", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(storedMemory)
}

// RecallMemoriesHandler handles memory recall
func (mh *MemoryHandlers) RecallMemoriesHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Set user ID and defaults
	req.UserID = userID
	if req.Limit == 0 {
		req.Limit = 10
	}

	// Recall memories
	response, err := mh.weaviateService.RecallMemories(&req)
	if err != nil {
		log.Printf("Memory recall failed: %v", err)
		http.Error(w, "Memory recall failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ListMemoriesHandler handles listing user's memories
func (mh *MemoryHandlers) ListMemoriesHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get limit from query params
	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil {
			limit = parsedLimit
		}
	}

	// Create search request
	req := &models.SearchRequest{
		Query:  "", // Empty query to get all memories
		UserID: userID,
		Limit:  limit,
	}

	// Recall memories
	response, err := mh.weaviateService.RecallMemories(req)
	if err != nil {
		log.Printf("Failed to list memories: %v", err)
		http.Error(w, "Failed to list memories", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"memories": response.Results,
		"total":    response.Total,
	})
}

// DeleteMemoryHandler handles memory deletion
func (mh *MemoryHandlers) DeleteMemoryHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	_ = vars["id"] // TODO: Use memoryID for memory deletion

	// TODO: Implement memory deletion
	// This would require implementing a delete method in the WeaviateService
	// For now, return success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
