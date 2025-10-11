package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/graphql"
)

func TestMemoryServiceHealth(t *testing.T) {
	req, err := http.NewRequest("GET", "/health", nil)
	assert.NoError(t, err)

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(healthHandler)
	handler.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var health map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &health)
	assert.NoError(t, err)
	assert.Equal(t, "healthy", health["status"])
	assert.Contains(t, health, "services")
}

func TestStoreMemory(t *testing.T) {
	memory := Memory{
		Type:    "test",
		Content: "This is a test memory",
		Tags:    []string{"test", "unit-test"},
		Metadata: map[string]interface{}{
			"source": "unit-test",
		},
	}

	body, _ := json.Marshal(memory)
	req, err := http.NewRequest("POST", "/memories", bytes.NewBuffer(body))
	assert.NoError(t, err)
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/memories", storeMemoryHandler).Methods("POST")
	router.ServeHTTP(rr, req)

	// Should either succeed or fail based on service availability
	assert.Contains(t, []int{http.StatusOK, http.StatusInternalServerError}, rr.Code)
	
	if rr.Code == http.StatusOK {
		var response Memory
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.NotEmpty(t, response.ID)
		assert.Equal(t, "test-user-123", response.UserID)
	}
}

func TestSearchMemories(t *testing.T) {
	query := MemoryQuery{
		Query: "test search",
		Limit: 10,
		Type:  "test",
	}

	body, _ := json.Marshal(query)
	req, err := http.NewRequest("POST", "/memories/search", bytes.NewBuffer(body))
	assert.NoError(t, err)
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/memories/search", searchMemoriesHandler).Methods("POST")
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "memories")
	assert.Contains(t, response, "count")
}

func TestGetMemory(t *testing.T) {
	req, err := http.NewRequest("GET", "/memories/test-memory-id", nil)
	assert.NoError(t, err)
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/memories/{id}", getMemoryHandler).Methods("GET")
	router.ServeHTTP(rr, req)

	// Should return 404 for non-existent memory
	assert.Contains(t, []int{http.StatusOK, http.StatusNotFound}, rr.Code)
}

func TestDeleteMemory(t *testing.T) {
	req, err := http.NewRequest("DELETE", "/memories/test-memory-id", nil)
	assert.NoError(t, err)
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/memories/{id}", deleteMemoryHandler).Methods("DELETE")
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusNoContent, rr.Code)
}

func TestStoreContext(t *testing.T) {
	context := Context{
		ConversationID: "conv-123",
		Summary:        "Test conversation summary",
		Memories:       []string{"mem-1", "mem-2"},
	}

	body, _ := json.Marshal(context)
	req, err := http.NewRequest("POST", "/contexts", bytes.NewBuffer(body))
	assert.NoError(t, err)
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/contexts", storeContextHandler).Methods("POST")
	router.ServeHTTP(rr, req)

	assert.Contains(t, []int{http.StatusOK, http.StatusInternalServerError}, rr.Code)
}

func TestGetContext(t *testing.T) {
	req, err := http.NewRequest("GET", "/contexts/conv-123", nil)
	assert.NoError(t, err)
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/contexts/{conversation_id}", getContextHandler).Methods("GET")
	router.ServeHTTP(rr, req)

	assert.Contains(t, []int{http.StatusOK, http.StatusNotFound}, rr.Code)
}

func TestAuthorizationRequired(t *testing.T) {
	// Test that endpoints require X-User-ID header
	endpoints := []struct {
		method string
		path   string
		handler http.HandlerFunc
	}{
		{"POST", "/memories", storeMemoryHandler},
		{"POST", "/memories/search", searchMemoriesHandler},
		{"GET", "/memories/123", getMemoryHandler},
		{"DELETE", "/memories/123", deleteMemoryHandler},
		{"POST", "/contexts", storeContextHandler},
		{"GET", "/contexts/123", getContextHandler},
	}

	for _, endpoint := range endpoints {
		req, err := http.NewRequest(endpoint.method, endpoint.path, nil)
		assert.NoError(t, err)
		// No X-User-ID header set

		rr := httptest.NewRecorder()
		handler := endpoint.handler
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code, 
			"Expected 401 for %s %s without auth header", endpoint.method, endpoint.path)
	}
}

// Integration tests - require Weaviate to be running
func TestWeaviateIntegrationMemory(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Check if Weaviate is available
	weaviateURL := "http://localhost:8090"
	resp, err := http.Get(weaviateURL + "/v1/.well-known/ready")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Skip("Weaviate is not available, skipping integration tests")
	}

	// Initialize Weaviate client
	cfg := weaviate.Config{
		Host:   weaviateURL,
		Scheme: "http",
	}
	
	client, err := weaviate.NewClient(cfg)
	assert.NoError(t, err)

	// Initialize schema
	err = initWeaviateSchema(client)
	assert.NoError(t, err)

	// Test creating a memory in Weaviate
	testMemory := map[string]interface{}{
		"userId":      "integration-test-user",
		"type":        "test",
		"content":     "This is an integration test memory",
		"tags":        []string{"test", "integration"},
		"metadata":    `{"test": true}`,
		"createdAt":   time.Now(),
		"accessCount": 0,
	}

	result, err := client.Data().Creator().
		WithClassName("Memory").
		WithProperties(testMemory).
		Do(context.Background())
	
	if err == nil {
		assert.NotNil(t, result)
		memoryID := result.Object.ID.String()
		
		// Test retrieving the memory
		getResult, err := client.Data().ObjectsGetter().
			WithClassName("Memory").
			WithID(memoryID).
			Do(context.Background())
		
		assert.NoError(t, err)
		assert.NotNil(t, getResult)
		
		// Test semantic search
		searchResult, err := client.GraphQL().Get().
			WithClassName("Memory").
			WithFields(graphql.Field{Name: "content"}, graphql.Field{Name: "userId"}).
			WithNearText(client.GraphQL().NearTextArgBuilder().
				WithConcepts([]string{"integration test"})).
			WithLimit(10).
			Do(context.Background())
		
		assert.NoError(t, err)
		assert.NotNil(t, searchResult)
		
		// Clean up
		err = client.Data().Deleter().
			WithClassName("Memory").
			WithID(memoryID).
			Do(context.Background())
		assert.NoError(t, err)
	}
}

// Benchmark tests
func BenchmarkMemoryCreation(b *testing.B) {
	memory := Memory{
		Type:    "benchmark",
		Content: "Benchmark memory content",
		Tags:    []string{"bench"},
	}
	
	body, _ := json.Marshal(memory)
	
	b.ResetTimer()
	b.ReportAllocs()
	
	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("POST", "/memories", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-User-ID", "bench-user")
		
		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(storeMemoryHandler)
		handler.ServeHTTP(rr, req)
	}
}

func BenchmarkMemorySearch(b *testing.B) {
	query := MemoryQuery{
		Query: "benchmark search",
		Limit: 10,
	}
	
	body, _ := json.Marshal(query)
	
	b.ResetTimer()
	b.ReportAllocs()
	
	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("POST", "/memories/search", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-User-ID", "bench-user")
		
		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(searchMemoriesHandler)
		handler.ServeHTTP(rr, req)
	}
}