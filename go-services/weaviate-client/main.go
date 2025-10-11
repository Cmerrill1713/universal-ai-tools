package main

import (
	"log"
	"net/http"

	"weaviate-client/config"
	"weaviate-client/handlers"
	"weaviate-client/services"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.LoadConfig()

	// Initialize Weaviate service
	weaviateService, err := services.NewWeaviateService(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize Weaviate service: %v", err)
	}

	// Initialize handlers
	healthHandlers := handlers.NewHealthHandlers(weaviateService)
	documentHandlers := handlers.NewDocumentHandlers(weaviateService)
	memoryHandlers := handlers.NewMemoryHandlers(weaviateService)

	// Setup routes
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", healthHandlers.HealthHandler).Methods("GET")

	// Document endpoints
	router.HandleFunc("/documents", documentHandlers.IndexDocumentHandler).Methods("POST")
	router.HandleFunc("/documents/search", documentHandlers.SearchDocumentsHandler).Methods("POST")
	router.HandleFunc("/documents/{id}", documentHandlers.GetDocumentHandler).Methods("GET")
	router.HandleFunc("/documents", documentHandlers.ListDocumentsHandler).Methods("GET")
	router.HandleFunc("/documents/{id}", documentHandlers.DeleteDocumentHandler).Methods("DELETE")

	// Memory endpoints
	router.HandleFunc("/memory", memoryHandlers.StoreMemoryHandler).Methods("POST")
	router.HandleFunc("/memory/recall", memoryHandlers.RecallMemoriesHandler).Methods("POST")
	router.HandleFunc("/memory", memoryHandlers.ListMemoriesHandler).Methods("GET")
	router.HandleFunc("/memory/{id}", memoryHandlers.DeleteMemoryHandler).Methods("DELETE")

	// Start server
	log.Printf("Weaviate Client Service starting on port %s", cfg.ServerPort)
	log.Fatal(http.ListenAndServe(":"+cfg.ServerPort, router))
}
