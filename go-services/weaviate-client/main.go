package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/auth"
	"github.com/weaviate/weaviate/entities/models"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/graphql"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/filters"
)

// Document represents a document to be stored in Weaviate
type Document struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Content     string                 `json:"content"`
	Category    string                 `json:"category"`
	Tags        []string               `json:"tags"`
	Metadata    map[string]interface{} `json:"metadata"`
	UserID      string                 `json:"user_id"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// SearchRequest represents a search query
type SearchRequest struct {
	Query      string                 `json:"query"`
	UserID     string                 `json:"user_id"`
	Category   string                 `json:"category,omitempty"`
	Limit      int                    `json:"limit,omitempty"`
	Offset     int                    `json:"offset,omitempty"`
	Filters    map[string]interface{} `json:"filters,omitempty"`
	UseHybrid  bool                   `json:"use_hybrid,omitempty"`
	Alpha      float32                `json:"alpha,omitempty"` // For hybrid search
}

// SearchResult represents a search result
type SearchResult struct {
	ID         string                 `json:"id"`
	Title      string                 `json:"title"`
	Content    string                 `json:"content"`
	Category   string                 `json:"category"`
	Score      float32                `json:"score"`
	Metadata   map[string]interface{} `json:"metadata"`
	Highlights map[string]string      `json:"highlights,omitempty"`
}

// Memory represents a memory/context item
type Memory struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	ConversationID string   `json:"conversation_id,omitempty"`
	Content       string    `json:"content"`
	Type          string    `json:"type"` // short_term, long_term, episodic, semantic
	Importance    float32   `json:"importance"`
	Embedding     []float32 `json:"embedding,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	AccessedAt    time.Time `json:"accessed_at"`
	AccessCount   int       `json:"access_count"`
}

// WeaviateService manages Weaviate operations
type WeaviateService struct {
	client *weaviate.Client
	ctx    context.Context
}

var weaviateService *WeaviateService

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize Weaviate client
	initWeaviate()
}

func initWeaviate() {
	scheme := getEnvOrDefault("WEAVIATE_SCHEME", "http")
	host := getEnvOrDefault("WEAVIATE_HOST", "localhost:8090")
	apiKey := os.Getenv("WEAVIATE_API_KEY")

	cfg := weaviate.Config{
		Host:   host,
		Scheme: scheme,
	}

	// Add authentication if API key is provided
	if apiKey != "" {
		cfg.AuthConfig = auth.ApiKey{Value: apiKey}
	}

	client, err := weaviate.NewClient(cfg)
	if err != nil {
		log.Printf("Failed to create Weaviate client: %v", err)
		return
	}

	// Test connection
	if err := client.Misc().ReadyChecker().Do(context.Background()); err != nil {
		log.Printf("Weaviate is not ready: %v", err)
		return
	}

	weaviateService = &WeaviateService{
		client: client,
		ctx:    context.Background(),
	}

	// Initialize schema
	if err := initSchema(client); err != nil {
		log.Printf("Failed to initialize schema: %v", err)
	}

	log.Println("Weaviate client initialized successfully")
}

func initSchema(client *weaviate.Client) error {
	ctx := context.Background()

	// Define Document class
	documentClass := &models.Class{
		Class:       "Document",
		Description: "A document with searchable content",
		Properties: []*models.Property{
			{
				Name:        "title",
				DataType:    []string{"text"},
				Description: "Document title",
			},
			{
				Name:        "content",
				DataType:    []string{"text"},
				Description: "Document content",
			},
			{
				Name:        "category",
				DataType:    []string{"text"},
				Description: "Document category",
			},
			{
				Name:        "tags",
				DataType:    []string{"text[]"},
				Description: "Document tags",
			},
			{
				Name:        "userID",
				DataType:    []string{"text"},
				Description: "User ID who created the document",
			},
			{
				Name:        "createdAt",
				DataType:    []string{"date"},
				Description: "Creation timestamp",
			},
			{
				Name:        "metadata",
				DataType:    []string{"object"},
				Description: "Additional metadata",
			},
		},
		VectorIndexType: "hnsw",
		Vectorizer:      "text2vec-openai",
		ModuleConfig: map[string]interface{}{
			"text2vec-openai": map[string]interface{}{
				"model": "text-embedding-ada-002",
			},
			"generative-openai": map[string]interface{}{
				"model": "gpt-3.5-turbo",
			},
		},
	}

	// Define Memory class
	memoryClass := &models.Class{
		Class:       "Memory",
		Description: "User memories and context",
		Properties: []*models.Property{
			{
				Name:        "userID",
				DataType:    []string{"text"},
				Description: "User ID",
			},
			{
				Name:        "conversationID",
				DataType:    []string{"text"},
				Description: "Conversation ID",
			},
			{
				Name:        "content",
				DataType:    []string{"text"},
				Description: "Memory content",
			},
			{
				Name:        "memoryType",
				DataType:    []string{"text"},
				Description: "Type of memory",
			},
			{
				Name:        "importance",
				DataType:    []string{"number"},
				Description: "Importance score",
			},
			{
				Name:        "createdAt",
				DataType:    []string{"date"},
				Description: "Creation timestamp",
			},
			{
				Name:        "accessedAt",
				DataType:    []string{"date"},
				Description: "Last access timestamp",
			},
			{
				Name:        "accessCount",
				DataType:    []string{"int"},
				Description: "Number of times accessed",
			},
		},
		VectorIndexType: "hnsw",
		Vectorizer:      "text2vec-openai",
	}

	// Check and create Document class
	exists, err := client.Schema().ClassExistenceChecker().WithClassName("Document").Do(ctx)
	if err != nil {
		return err
	}
	if !exists {
		if err := client.Schema().ClassCreator().WithClass(documentClass).Do(ctx); err != nil {
			return fmt.Errorf("failed to create Document class: %v", err)
		}
		log.Println("Created Document class")
	}

	// Check and create Memory class
	exists, err = client.Schema().ClassExistenceChecker().WithClassName("Memory").Do(ctx)
	if err != nil {
		return err
	}
	if !exists {
		if err := client.Schema().ClassCreator().WithClass(memoryClass).Do(ctx); err != nil {
			return fmt.Errorf("failed to create Memory class: %v", err)
		}
		log.Println("Created Memory class")
	}

	return nil
}

// API Handlers

func indexDocumentHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var doc Document
	if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	doc.ID = uuid.New().String()
	doc.UserID = userID
	doc.CreatedAt = time.Now()
	doc.UpdatedAt = time.Now()

	// Create Weaviate object
	dataSchema := map[string]interface{}{
		"title":      doc.Title,
		"content":    doc.Content,
		"category":   doc.Category,
		"tags":       doc.Tags,
		"userID":     doc.UserID,
		"createdAt":  doc.CreatedAt,
		"metadata":   doc.Metadata,
	}

	// Add to Weaviate
	_, err := weaviateService.client.Data().Creator().
		WithClassName("Document").
		WithID(doc.ID).
		WithProperties(dataSchema).
		Do(weaviateService.ctx)

	if err != nil {
		log.Printf("Failed to index document: %v", err)
		http.Error(w, "Failed to index document", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

func searchDocumentsHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.UserID = userID
	if req.Limit == 0 {
		req.Limit = 10
	}

	// Build the search query
	fields := []graphql.Field{
		{Name: "title"},
		{Name: "content"},
		{Name: "category"},
		{Name: "tags"},
		{Name: "_additional", Fields: []graphql.Field{
			{Name: "id"},
			{Name: "score"},
			{Name: "distance"},
		}},
	}

	// Create where filter for user's documents
	where := filters.Where().
		WithPath([]string{"userID"}).
		WithOperator(filters.Equal).
		WithValueText(userID)

	// Add category filter if provided
	if req.Category != "" {
		categoryFilter := filters.Where().
			WithPath([]string{"category"}).
			WithOperator(filters.Equal).
			WithValueText(req.Category)
		
		where = filters.Where().
			WithOperator(filters.And).
			WithOperands([]*filters.WhereBuilder{where, categoryFilter})
	}

	var result *models.GraphQLResponse
	var err error

	if req.UseHybrid {
		// Hybrid search (combines vector and keyword search)
		alpha := req.Alpha
		if alpha == 0 {
			alpha = 0.5 // Default to balanced
		}

		result, err = weaviateService.client.GraphQL().Get().
			WithClassName("Document").
			WithFields(fields...).
			WithHybrid(graphql.Hybrid{
				Query: req.Query,
				Alpha: &alpha,
			}).
			WithWhere(where).
			WithLimit(req.Limit).
			Do(weaviateService.ctx)
	} else {
		// Pure vector search
		result, err = weaviateService.client.GraphQL().Get().
			WithClassName("Document").
			WithFields(fields...).
			WithNearText(&graphql.NearTextArgumentBuilder{
				Concepts: []string{req.Query},
			}).
			WithWhere(where).
			WithLimit(req.Limit).
			Do(weaviateService.ctx)
	}

	if err != nil {
		log.Printf("Search failed: %v", err)
		http.Error(w, "Search failed", http.StatusInternalServerError)
		return
	}

	// Parse results
	results := parseSearchResults(result)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"results": results,
		"total":   len(results),
		"query":   req.Query,
	})
}

func storeMemoryHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var memory Memory
	if err := json.NewDecoder(r.Body).Decode(&memory); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	memory.ID = uuid.New().String()
	memory.UserID = userID
	memory.CreatedAt = time.Now()
	memory.AccessedAt = time.Now()
	memory.AccessCount = 0

	// Create Weaviate object
	dataSchema := map[string]interface{}{
		"userID":         memory.UserID,
		"conversationID": memory.ConversationID,
		"content":        memory.Content,
		"memoryType":     memory.Type,
		"importance":     memory.Importance,
		"createdAt":      memory.CreatedAt,
		"accessedAt":     memory.AccessedAt,
		"accessCount":    memory.AccessCount,
	}

	// Add to Weaviate
	_, err := weaviateService.client.Data().Creator().
		WithClassName("Memory").
		WithID(memory.ID).
		WithProperties(dataSchema).
		Do(weaviateService.ctx)

	if err != nil {
		log.Printf("Failed to store memory: %v", err)
		http.Error(w, "Failed to store memory", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(memory)
}

func recallMemoriesHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Query          string `json:"query"`
		ConversationID string `json:"conversation_id,omitempty"`
		Type           string `json:"type,omitempty"`
		Limit          int    `json:"limit,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Limit == 0 {
		req.Limit = 10
	}

	// Build query
	fields := []graphql.Field{
		{Name: "userID"},
		{Name: "content"},
		{Name: "memoryType"},
		{Name: "importance"},
		{Name: "createdAt"},
		{Name: "_additional", Fields: []graphql.Field{
			{Name: "id"},
			{Name: "score"},
			{Name: "distance"},
		}},
	}

	// Create filter
	where := filters.Where().
		WithPath([]string{"userID"}).
		WithOperator(filters.Equal).
		WithValueText(userID)

	// Search memories
	result, err := weaviateService.client.GraphQL().Get().
		WithClassName("Memory").
		WithFields(fields...).
		WithNearText(&graphql.NearTextArgumentBuilder{
			Concepts: []string{req.Query},
		}).
		WithWhere(where).
		WithLimit(req.Limit).
		Do(weaviateService.ctx)

	if err != nil {
		log.Printf("Memory recall failed: %v", err)
		http.Error(w, "Memory recall failed", http.StatusInternalServerError)
		return
	}

	// Parse and return results
	memories := parseMemoryResults(result)

	// Update access count and time for recalled memories
	go updateMemoryAccess(memories)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"memories": memories,
		"total":    len(memories),
	})
}

func deleteDocumentHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	docID := vars["id"]

	// Delete from Weaviate
	err := weaviateService.client.Data().Deleter().
		WithClassName("Document").
		WithID(docID).
		Do(weaviateService.ctx)

	if err != nil {
		log.Printf("Failed to delete document: %v", err)
		http.Error(w, "Failed to delete document", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Helper functions

func parseSearchResults(result *models.GraphQLResponse) []SearchResult {
	results := []SearchResult{}

	data, ok := result.Data["Get"].(map[string]interface{})
	if !ok {
		return results
	}

	documents, ok := data["Document"].([]interface{})
	if !ok {
		return results
	}

	for _, doc := range documents {
		docMap, ok := doc.(map[string]interface{})
		if !ok {
			continue
		}

		searchResult := SearchResult{
			Title:    getString(docMap, "title"),
			Content:  getString(docMap, "content"),
			Category: getString(docMap, "category"),
		}

		// Get additional fields (ID and score)
		if additional, ok := docMap["_additional"].(map[string]interface{}); ok {
			searchResult.ID = getString(additional, "id")
			if score, ok := additional["score"].(float64); ok {
				searchResult.Score = float32(score)
			}
		}

		results = append(results, searchResult)
	}

	return results
}

func parseMemoryResults(result *models.GraphQLResponse) []Memory {
	memories := []Memory{}

	data, ok := result.Data["Get"].(map[string]interface{})
	if !ok {
		return memories
	}

	memoryList, ok := data["Memory"].([]interface{})
	if !ok {
		return memories
	}

	for _, mem := range memoryList {
		memMap, ok := mem.(map[string]interface{})
		if !ok {
			continue
		}

		memory := Memory{
			UserID:  getString(memMap, "userID"),
			Content: getString(memMap, "content"),
			Type:    getString(memMap, "memoryType"),
		}

		if importance, ok := memMap["importance"].(float64); ok {
			memory.Importance = float32(importance)
		}

		// Get ID from additional
		if additional, ok := memMap["_additional"].(map[string]interface{}); ok {
			memory.ID = getString(additional, "id")
		}

		memories = append(memories, memory)
	}

	return memories
}

func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func updateMemoryAccess(memories []Memory) {
	for _, memory := range memories {
		// Update access count and timestamp
		update := map[string]interface{}{
			"accessedAt":  time.Now(),
			"accessCount": memory.AccessCount + 1,
		}

		weaviateService.client.Data().Updater().
			WithClassName("Memory").
			WithID(memory.ID).
			WithProperties(update).
			Do(context.Background())
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	// Check Weaviate connection
	weaviateHealthy := false
	if weaviateService != nil && weaviateService.client != nil {
		if err := weaviateService.client.Misc().ReadyChecker().Do(context.Background()); err == nil {
			weaviateHealthy = true
		}
	}

	response := map[string]interface{}{
		"status":    "healthy",
		"service":   "weaviate-client",
		"weaviate":  weaviateHealthy,
		"timestamp": time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// Document endpoints
	router.HandleFunc("/documents", indexDocumentHandler).Methods("POST")
	router.HandleFunc("/documents/search", searchDocumentsHandler).Methods("POST")
	router.HandleFunc("/documents/{id}", deleteDocumentHandler).Methods("DELETE")

	// Memory endpoints
	router.HandleFunc("/memory", storeMemoryHandler).Methods("POST")
	router.HandleFunc("/memory/recall", recallMemoriesHandler).Methods("POST")

	// Start server
	port := getEnvOrDefault("WEAVIATE_CLIENT_PORT", "8019")
	log.Printf("Weaviate Client Service starting on port %s", port)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}