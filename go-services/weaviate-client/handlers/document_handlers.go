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

// DocumentHandlers handles document-related HTTP requests
type DocumentHandlers struct {
	weaviateService *services.WeaviateService
}

// NewDocumentHandlers creates a new document handlers instance
func NewDocumentHandlers(ws *services.WeaviateService) *DocumentHandlers {
	return &DocumentHandlers{
		weaviateService: ws,
	}
}

// IndexDocumentHandler handles document indexing
func (dh *DocumentHandlers) IndexDocumentHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var doc models.Document
	if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Set required fields
	doc.ID = uuid.New().String()
	doc.UserID = userID
	now := time.Now()
	doc.CreatedAt = now
	doc.UpdatedAt = now

	// Index document
	indexedDoc, err := dh.weaviateService.IndexDocument(&doc)
	if err != nil {
		log.Printf("Failed to index document: %v", err)
		http.Error(w, "Failed to index document", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(indexedDoc)
}

// SearchDocumentsHandler handles document search
func (dh *DocumentHandlers) SearchDocumentsHandler(w http.ResponseWriter, r *http.Request) {
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

	// Search documents
	response, err := dh.weaviateService.SearchDocuments(&req)
	if err != nil {
		log.Printf("Search failed: %v", err)
		http.Error(w, "Search failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetDocumentHandler handles getting a specific document
func (dh *DocumentHandlers) GetDocumentHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	_ = vars["id"] // TODO: Use docID for specific document lookup

	// Create search request for this specific document
	req := &models.SearchRequest{
		Query:  "", // TODO: Implement specific document lookup by ID
		UserID: userID,
		Limit:  1,
	}

	// Search for the document
	response, err := dh.weaviateService.SearchDocuments(req)
	if err != nil {
		log.Printf("Failed to get document: %v", err)
		http.Error(w, "Document not found", http.StatusNotFound)
		return
	}

	if len(response.Results) == 0 {
		http.Error(w, "Document not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response.Results[0])
}

// ListDocumentsHandler handles listing user's documents
func (dh *DocumentHandlers) ListDocumentsHandler(w http.ResponseWriter, r *http.Request) {
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
		Query:  "", // Empty query to get all documents
		UserID: userID,
		Limit:  limit,
	}

	// Search documents
	response, err := dh.weaviateService.SearchDocuments(req)
	if err != nil {
		log.Printf("Failed to list documents: %v", err)
		http.Error(w, "Failed to list documents", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"documents": response.Results,
		"total":     response.Total,
	})
}

// DeleteDocumentHandler handles document deletion
func (dh *DocumentHandlers) DeleteDocumentHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	_ = vars["id"] // TODO: Use docID for document deletion

	// TODO: Implement document deletion
	// This would require implementing a delete method in the WeaviateService
	// For now, return success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
