package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/weaviate/weaviate-go-client/v4/weaviate"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/auth"
	"github.com/weaviate/weaviate-go-client/v4/weaviate/graphql"
)

func main() {
	testWeaviateConnection()
}

func testWeaviateConnection() {
	// Get configuration from environment
	weaviateURL := os.Getenv("WEAVIATE_URL")
	if weaviateURL == "" {
		weaviateURL = "http://localhost:8090"
	}

	weaviateAPIKey := os.Getenv("WEAVIATE_API_KEY")
	if weaviateAPIKey == "" {
		weaviateAPIKey = "universal-ai-key-change-me"
	}

	// Create Weaviate client
	cfg := weaviate.Config{
		Host:   "localhost:8090",
		Scheme: "http",
		AuthConfig: auth.ApiKey{Value: weaviateAPIKey},
	}

	client, err := weaviate.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to create Weaviate client: %v", err)
	}

	// Test connection
	isReady, err := client.Misc().ReadyChecker().Do(context.Background())
	if err != nil {
		log.Fatalf("Failed to check Weaviate readiness: %v", err)
	}

	if !isReady {
		log.Fatal("Weaviate is not ready")
	}

	log.Println("Successfully connected to Weaviate!")

	// Get schema
	schema, err := client.Schema().Getter().Do(context.Background())
	if err != nil {
		log.Printf("Failed to get schema: %v", err)
	} else {
		log.Printf("Schema has %d classes", len(schema.Classes))
		for _, class := range schema.Classes {
			log.Printf(" - Class: %s", class.Class)
		}
	}

	// Test creating a memory object
	memoryObject := map[string]interface{}{
		"userId":      "test-user-002",
		"type":        "note",
		"content":     "Testing memory service integration with Weaviate",
		"tags":        []string{"test", "integration"},
		"metadata":    "{\"source\": \"test-script\"}",
		"createdAt":   "2025-01-05T14:00:00Z",
		"accessCount": 1,
	}

	// Create the object
	created, err := client.Data().Creator().
		WithClassName("Memory").
		WithProperties(memoryObject).
		Do(context.Background())
	
	if err != nil {
		log.Printf("Failed to create memory object: %v", err)
	} else {
		log.Printf("Created memory object with ID: %s", created.Object.ID)
	}

	// Search for memories
	result, err := client.GraphQL().Get().
		WithClassName("Memory").
		WithFields(
			graphql.Field{Name: "userId"},
			graphql.Field{Name: "type"},
			graphql.Field{Name: "content"},
			graphql.Field{Name: "tags"},
		).
		WithLimit(5).
		Do(context.Background())
	
	if err != nil {
		log.Printf("Failed to search memories: %v", err)
	} else {
		data, _ := json.MarshalIndent(result, "", "  ")
		log.Printf("Search results: %s", data)
	}

	// Start simple HTTP server for testing
	http.HandleFunc("/test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "connected",
			"weaviate_url": weaviateURL,
			"ready": isReady,
		})
	})

	log.Println("Test server running on :8020")
	http.ListenAndServe(":8020", nil)
}