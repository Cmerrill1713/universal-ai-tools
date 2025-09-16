package services

import (
	"context"
	"log"
	"time"

	"weaviate-client/config"
	"weaviate-client/models"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/auth"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/filters"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/graphql"
	weaviateModels "github.com/weaviate/weaviate/entities/models"
)

// WeaviateService handles all Weaviate operations
type WeaviateService struct {
	client *weaviate.Client
	ctx    context.Context
	config *config.Config
}

// NewWeaviateService creates a new Weaviate service
func NewWeaviateService(cfg *config.Config) (*WeaviateService, error) {
	ctx := context.Background()

	// Configure Weaviate client
	cfgMap := weaviate.Config{
		Host:   cfg.WeaviateHost + ":" + cfg.WeaviatePort,
		Scheme: cfg.WeaviateScheme,
	}

	// Add API key if provided
	if cfg.WeaviateAPIKey != "" {
		cfgMap.AuthConfig = auth.ApiKey{Value: cfg.WeaviateAPIKey}
	}

	client := weaviate.New(cfgMap)

	service := &WeaviateService{
		client: client,
		ctx:    ctx,
		config: cfg,
	}

	// Initialize schema
	if err := service.initSchema(); err != nil {
		return nil, err
	}

	return service, nil
}

// initSchema initializes the Weaviate schema
func (ws *WeaviateService) initSchema() error {
	// Define Document class
	documentClass := &weaviateModels.Class{
		Class:       "Document",
		Description: "A document for vector search",
		Properties: []*weaviateModels.Property{
			{
				Name:        "title",
				DataType:    []string{"string"},
				Description: "Document title",
			},
			{
				Name:        "content",
				DataType:    []string{"text"},
				Description: "Document content",
			},
			{
				Name:        "category",
				DataType:    []string{"string"},
				Description: "Document category",
			},
			{
				Name:        "tags",
				DataType:    []string{"string[]"},
				Description: "Document tags",
			},
			{
				Name:        "userID",
				DataType:    []string{"string"},
				Description: "User ID who owns this document",
			},
			{
				Name:        "createdAt",
				DataType:    []string{"date"},
				Description: "Creation timestamp",
			},
			{
				Name:        "updatedAt",
				DataType:    []string{"date"},
				Description: "Last update timestamp",
			},
		},
		VectorIndexType: "hnsw",
		Vectorizer:      "none",
		InvertedIndexConfig: &weaviateModels.InvertedIndexConfig{
			IndexTimestamps: true,
		},
	}

	// Define Memory class
	memoryClass := &weaviateModels.Class{
		Class:       "Memory",
		Description: "A memory for vector search",
		Properties: []*weaviateModels.Property{
			{
				Name:        "content",
				DataType:    []string{"text"},
				Description: "Memory content",
			},
			{
				Name:        "memoryType",
				DataType:    []string{"string"},
				Description: "Type of memory",
			},
			{
				Name:        "importance",
				DataType:    []string{"int"},
				Description: "Importance level (1-10)",
			},
			{
				Name:        "userID",
				DataType:    []string{"string"},
				Description: "User ID who owns this memory",
			},
			{
				Name:        "createdAt",
				DataType:    []string{"date"},
				Description: "Creation timestamp",
			},
			{
				Name:        "updatedAt",
				DataType:    []string{"date"},
				Description: "Last update timestamp",
			},
		},
		VectorIndexType: "hnsw",
		Vectorizer:      "none",
		InvertedIndexConfig: &weaviateModels.InvertedIndexConfig{
			IndexTimestamps: true,
		},
	}

	// Create classes if they don't exist
	if err := ws.createClassIfNotExists(documentClass); err != nil {
		return err
	}
	if err := ws.createClassIfNotExists(memoryClass); err != nil {
		return err
	}

	log.Println("Weaviate schema initialized successfully")
	return nil
}

// createClassIfNotExists creates a class if it doesn't exist
func (ws *WeaviateService) createClassIfNotExists(class *weaviateModels.Class) error {
	// Check if class exists
	exists, err := ws.client.Schema().ClassExistenceChecker().WithClassName(class.Class).Do(ws.ctx)
	if err != nil {
		return err
	}

	if !exists {
		// Create class
		err = ws.client.Schema().ClassCreator().WithClass(class).Do(ws.ctx)
		if err != nil {
			return err
		}
		log.Printf("Created class: %s", class.Class)
	} else {
		log.Printf("Class already exists: %s", class.Class)
	}

	return nil
}

// HealthCheck checks if Weaviate is healthy
func (ws *WeaviateService) HealthCheck() bool {
	_, err := ws.client.Misc().ReadyChecker().Do(ws.ctx)
	return err == nil
}

// IndexDocument indexes a document in Weaviate
func (ws *WeaviateService) IndexDocument(doc *models.Document) (*models.Document, error) {
	// Convert to Weaviate format
	weaviateDoc := map[string]interface{}{
		"title":     doc.Title,
		"content":   doc.Content,
		"category":  doc.Category,
		"tags":      doc.Tags,
		"userID":    doc.UserID,
		"createdAt": doc.CreatedAt,
		"updatedAt": doc.UpdatedAt,
	}

	// Create document in Weaviate
	result, err := ws.client.Data().Creator().
		WithClassName("Document").
		WithProperties(weaviateDoc).
		Do(ws.ctx)

	if err != nil {
		return nil, err
	}

	// Update document with ID
	doc.ID = result.Object.ID.String()
	return doc, nil
}

// StoreMemory stores a memory in Weaviate
func (ws *WeaviateService) StoreMemory(memory *models.Memory) (*models.Memory, error) {
	// Convert to Weaviate format
	weaviateMemory := map[string]interface{}{
		"content":    memory.Content,
		"memoryType": memory.MemoryType,
		"importance": memory.Importance,
		"userID":     memory.UserID,
		"createdAt":  memory.CreatedAt,
		"updatedAt":  memory.UpdatedAt,
	}

	// Create memory in Weaviate
	result, err := ws.client.Data().Creator().
		WithClassName("Memory").
		WithProperties(weaviateMemory).
		Do(ws.ctx)

	if err != nil {
		return nil, err
	}

	// Update memory with ID
	memory.ID = result.Object.ID.String()
	return memory, nil
}

// SearchDocuments searches for documents
func (ws *WeaviateService) SearchDocuments(req *models.SearchRequest) (*models.SearchResponse, error) {
	// Build fields
	fields := []graphql.Field{
		{Name: "title"},
		{Name: "content"},
		{Name: "category"},
		{Name: "tags"},
		{Name: "createdAt"},
		{Name: "_additional", Fields: []graphql.Field{
			{Name: "id"},
			{Name: "score"},
		}},
	}

	// Build where clause
	where := filters.Where().
		WithPath([]string{"userID"}).
		WithOperator(filters.Equal).
		WithValueText(req.UserID)

	// Add category filter if specified
	if req.Category != "" {
		categoryFilter := filters.Where().
			WithPath([]string{"category"}).
			WithOperator(filters.Equal).
			WithValueText(req.Category)
		where = filters.Where().
			WithOperator(filters.And).
			WithOperands([]*filters.WhereBuilder{where, categoryFilter})
	}

	var result *weaviateModels.GraphQLResponse
	var err error

	if req.UseHybrid {
		// Hybrid search (combines vector and keyword search)
		alpha := req.Alpha
		if alpha == 0 {
			alpha = 0.5 // Default to balanced
		}

		hybrid := ws.client.GraphQL().HybridArgumentBuilder().
			WithQuery(req.Query).
			WithAlpha(alpha)

		result, err = ws.client.GraphQL().Get().
			WithClassName("Document").
			WithFields(fields...).
			WithHybrid(hybrid).
			WithWhere(where).
			WithLimit(req.Limit).
			Do(ws.ctx)
	} else if req.UseBM25 {
		// BM25 keyword search - fallback to hybrid with high alpha for keyword-like behavior
		hybrid := ws.client.GraphQL().HybridArgumentBuilder().
			WithQuery(req.Query).
			WithAlpha(0.9) // High alpha for keyword-like search

		result, err = ws.client.GraphQL().Get().
			WithClassName("Document").
			WithFields(fields...).
			WithHybrid(hybrid).
			WithWhere(where).
			WithLimit(req.Limit).
			Do(ws.ctx)
	} else {
		// Pure vector search with nearText for semantic search
		nearText := ws.client.GraphQL().NearTextArgBuilder().
			WithConcepts([]string{req.Query})

		result, err = ws.client.GraphQL().Get().
			WithClassName("Document").
			WithFields(fields...).
			WithNearText(nearText).
			WithWhere(where).
			WithLimit(req.Limit).
			Do(ws.ctx)
	}

	if err != nil {
		return nil, err
	}

	// Parse results
	results := ws.parseSearchResults(result)

	return &models.SearchResponse{
		Query:   req.Query,
		Results: results,
		Total:   len(results),
	}, nil
}

// RecallMemories searches for memories
func (ws *WeaviateService) RecallMemories(req *models.SearchRequest) (*models.MemoryResponse, error) {
	// Build fields
	fields := []graphql.Field{
		{Name: "content"},
		{Name: "memoryType"},
		{Name: "importance"},
		{Name: "createdAt"},
		{Name: "_additional", Fields: []graphql.Field{
			{Name: "id"},
			{Name: "score"},
		}},
	}

	// Build where clause
	where := filters.Where().
		WithPath([]string{"userID"}).
		WithOperator(filters.Equal).
		WithValueText(req.UserID)

	// Search memories with vector search
	nearText := ws.client.GraphQL().NearTextArgBuilder().
		WithConcepts([]string{req.Query})

	result, err := ws.client.GraphQL().Get().
		WithClassName("Memory").
		WithFields(fields...).
		WithNearText(nearText).
		WithWhere(where).
		WithLimit(req.Limit).
		Do(ws.ctx)

	if err != nil {
		return nil, err
	}

	// Parse results
	memories := ws.parseMemoryResults(result)

	return &models.MemoryResponse{
		Query:   req.Query,
		Results: memories,
		Total:   len(memories),
	}, nil
}

// parseSearchResults parses GraphQL search results
func (ws *WeaviateService) parseSearchResults(result *weaviateModels.GraphQLResponse) []models.SearchResult {
	var results []models.SearchResult

	if result.Data != nil {
		if get, ok := result.Data["Get"].(map[string]interface{}); ok {
			if documents, ok := get["Document"].([]interface{}); ok {
				for _, doc := range documents {
					if docMap, ok := doc.(map[string]interface{}); ok {
						result := models.SearchResult{
							ID:        ws.getStringFromMap(docMap, "_additional", "id"),
							Title:     ws.getStringFromMap(docMap, "title"),
							Content:   ws.getStringFromMap(docMap, "content"),
							Category:  ws.getStringFromMap(docMap, "category"),
							CreatedAt: ws.getTimeFromMap(docMap, "createdAt"),
							UpdatedAt: ws.getTimeFromMap(docMap, "updatedAt"),
						}

						// Parse tags
						if tags, ok := docMap["tags"].([]interface{}); ok {
							for _, tag := range tags {
								if tagStr, ok := tag.(string); ok {
									result.Tags = append(result.Tags, tagStr)
								}
							}
						}

						// Parse score
						if additional, ok := docMap["_additional"].(map[string]interface{}); ok {
							if score, ok := additional["score"].(float64); ok {
								result.Score = float32(score)
							}
						}

						results = append(results, result)
					}
				}
			}
		}
	}

	return results
}

// parseMemoryResults parses GraphQL memory results
func (ws *WeaviateService) parseMemoryResults(result *weaviateModels.GraphQLResponse) []models.MemoryResult {
	var results []models.MemoryResult

	if result.Data != nil {
		if get, ok := result.Data["Get"].(map[string]interface{}); ok {
			if memories, ok := get["Memory"].([]interface{}); ok {
				for _, memory := range memories {
					if memoryMap, ok := memory.(map[string]interface{}); ok {
						result := models.MemoryResult{
							ID:         ws.getStringFromMap(memoryMap, "_additional", "id"),
							Content:    ws.getStringFromMap(memoryMap, "content"),
							MemoryType: ws.getStringFromMap(memoryMap, "memoryType"),
							Importance: ws.getIntFromMap(memoryMap, "importance"),
							CreatedAt:  ws.getTimeFromMap(memoryMap, "createdAt"),
							UpdatedAt:  ws.getTimeFromMap(memoryMap, "updatedAt"),
						}

						// Parse score
						if additional, ok := memoryMap["_additional"].(map[string]interface{}); ok {
							if score, ok := additional["score"].(float64); ok {
								result.Score = float32(score)
							}
						}

						results = append(results, result)
					}
				}
			}
		}
	}

	return results
}

// Helper functions for parsing
func (ws *WeaviateService) getStringFromMap(m map[string]interface{}, keys ...string) string {
	current := m
	for i, key := range keys {
		if i == len(keys)-1 {
			if val, ok := current[key].(string); ok {
				return val
			}
		} else {
			if next, ok := current[key].(map[string]interface{}); ok {
				current = next
			} else {
				return ""
			}
		}
	}
	return ""
}

func (ws *WeaviateService) getIntFromMap(m map[string]interface{}, key string) int {
	if val, ok := m[key].(float64); ok {
		return int(val)
	}
	return 0
}

func (ws *WeaviateService) getTimeFromMap(m map[string]interface{}, key string) time.Time {
	if val, ok := m[key].(string); ok {
		if t, err := time.Parse(time.RFC3339, val); err == nil {
			return t
		}
	}
	return time.Time{}
}
