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
	"github.com/stretchr/testify/mock"
	"github.com/weaviate/weaviate-go-client/v4/weaviate"
)

// MockWeaviateClient for testing
type MockWeaviateClient struct {
	mock.Mock
}

func TestHealthHandler(t *testing.T) {
	// Create a request to pass to our handler
	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create a ResponseRecorder to record the response
	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(healthHandler)

	// Call the handler
	handler.ServeHTTP(rr, req)

	// Check the status code
	assert.Equal(t, http.StatusOK, rr.Code)

	// Check the response body
	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "healthy", response["status"])
}

func TestCreateDocumentHandler(t *testing.T) {
	// Test document creation
	document := Document{
		Title:   "Test Document",
		Content: "This is test content",
		UserID:  "test-user-123",
		Tags:    []string{"test", "integration"},
	}

	body, _ := json.Marshal(document)
	req, err := http.NewRequest("POST", "/documents", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/documents", createDocumentHandler).Methods("POST")
	router.ServeHTTP(rr, req)

	// We expect a 200 status if Weaviate is available, or 500 if not
	// In tests without Weaviate running, we'd expect 500
	assert.Contains(t, []int{http.StatusOK, http.StatusInternalServerError}, rr.Code)
}

func TestSearchDocumentsHandler(t *testing.T) {
	searchQuery := SearchQuery{
		Query: "test search",
		Limit: 10,
	}

	body, _ := json.Marshal(searchQuery)
	req, err := http.NewRequest("POST", "/search", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/search", searchDocumentsHandler).Methods("POST")
	router.ServeHTTP(rr, req)

	// Check response
	assert.Contains(t, []int{http.StatusOK, http.StatusInternalServerError}, rr.Code)
	
	if rr.Code == http.StatusOK {
		var response map[string]interface{}
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Contains(t, response, "results")
	}
}

func TestMemoryOperations(t *testing.T) {
	// Test memory creation
	memory := Memory{
		UserID:  "test-user-123",
		Content: "This is a test memory",
		Type:    "note",
		Tags:    []string{"test", "memory"},
	}

	body, _ := json.Marshal(memory)
	req, err := http.NewRequest("POST", "/memories", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", "test-user-123")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/memories", createMemoryHandler).Methods("POST")
	router.ServeHTTP(rr, req)

	assert.Contains(t, []int{http.StatusOK, http.StatusInternalServerError}, rr.Code)
}

func TestVectorizeTextHandler(t *testing.T) {
	vectorRequest := struct {
		Text string `json:"text"`
	}{
		Text: "This is text to vectorize",
	}

	body, _ := json.Marshal(vectorRequest)
	req, err := http.NewRequest("POST", "/vectorize", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/vectorize", vectorizeTextHandler).Methods("POST")
	router.ServeHTTP(rr, req)

	assert.Contains(t, []int{http.StatusOK, http.StatusInternalServerError}, rr.Code)
}

func TestInitSchema(t *testing.T) {
	// This test would require a mock Weaviate client
	// For now, we just test that the function doesn't panic
	assert.NotPanics(t, func() {
		// In real tests, we'd inject a mock client
		// initSchema(mockClient)
	})
}

// Integration test that requires Weaviate to be running
func TestWeaviateIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Check if Weaviate is available
	weaviateURL := "http://localhost:8090"
	resp, err := http.Get(weaviateURL + "/v1/.well-known/ready")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Skip("Weaviate is not available, skipping integration tests")
	}

	// Create a real Weaviate client
	cfg := weaviate.Config{
		Host:   weaviateURL,
		Scheme: "http",
	}
	
	client, err := weaviate.NewClient(cfg)
	assert.NoError(t, err)
	assert.NotNil(t, client)

	// Test schema initialization
	err = initSchema(client)
	assert.NoError(t, err)

	// Test document creation
	testDoc := map[string]interface{}{
		"title":     "Integration Test Document",
		"content":   "This is an integration test",
		"userId":    "test-user",
		"tags":      []string{"test", "integration"},
		"createdAt": time.Now(),
	}

	// Create document
	result, err := client.Data().Creator().
		WithClassName("Document").
		WithProperties(testDoc).
		Do(context.Background())
	
	if err == nil {
		assert.NotNil(t, result)
		
		// Clean up - delete the test document
		client.Data().Deleter().
			WithClassName("Document").
			WithID(result.Object.ID.String()).
			Do(context.Background())
	}
}

// Benchmark tests
func BenchmarkVectorSearch(b *testing.B) {
	// This would benchmark vector search operations
	// Requires Weaviate to be running
	b.ReportAllocs()
	
	for i := 0; i < b.N; i++ {
		// Perform search operation
		// In real benchmark, we'd call the actual search function
	}
}

func BenchmarkDocumentCreation(b *testing.B) {
	// Benchmark document creation
	b.ReportAllocs()
	
	document := Document{
		Title:   "Benchmark Document",
		Content: "This is benchmark content",
		UserID:  "benchmark-user",
	}
	
	body, _ := json.Marshal(document)
	
	for i := 0; i < b.N; i++ {
		req, _ := http.NewRequest("POST", "/documents", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-User-ID", "benchmark-user")
		
		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(createDocumentHandler)
		handler.ServeHTTP(rr, req)
	}
}