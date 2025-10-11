package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

// OrchestrationRequest represents a request to orchestrate multiple services
type OrchestrationRequest struct {
	UserRequest string                 `json:"userRequest"`
	Context     map[string]interface{} `json:"context,omitempty"`
	Services    []string               `json:"services,omitempty"`
	Priority    string                 `json:"priority,omitempty"`
}

// OrchestrationResponse represents the response from orchestration
type OrchestrationResponse struct {
	Success  bool                   `json:"success"`
	Data     map[string]interface{} `json:"data"`
	Metadata map[string]interface{} `json:"metadata"`
	Error    *ErrorResponse         `json:"error,omitempty"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// ServiceClient handles communication with individual services
type ServiceClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

// ServiceRegistry holds information about available services
type ServiceRegistry struct {
	ChatService        *ServiceClient
	MemoryService      *ServiceClient
	LLMRouter          *ServiceClient
	VisionService      *ServiceClient
	MLXService         *ServiceClient
	ParameterAnalytics *ServiceClient
}

var (
	serviceRegistry *ServiceRegistry
)

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize service clients
	serviceRegistry = &ServiceRegistry{
		ChatService: &ServiceClient{
			BaseURL:    getEnvOrDefault("CHAT_SERVICE_URL", "http://localhost:8016"),
			HTTPClient: &http.Client{Timeout: 30 * time.Second},
		},
		MemoryService: &ServiceClient{
			BaseURL:    getEnvOrDefault("MEMORY_SERVICE_URL", "http://localhost:8017"),
			HTTPClient: &http.Client{Timeout: 30 * time.Second},
		},
		LLMRouter: &ServiceClient{
			BaseURL:    getEnvOrDefault("LLM_ROUTER_URL", "http://localhost:3033"),
			HTTPClient: &http.Client{Timeout: 30 * time.Second},
		},
		VisionService: &ServiceClient{
			BaseURL:    getEnvOrDefault("VISION_SERVICE_URL", "http://localhost:8084"),
			HTTPClient: &http.Client{Timeout: 30 * time.Second},
		},
		MLXService: &ServiceClient{
			BaseURL:    getEnvOrDefault("MLX_SERVICE_URL", "http://localhost:8001"),
			HTTPClient: &http.Client{Timeout: 30 * time.Second},
		},
		ParameterAnalytics: &ServiceClient{
			BaseURL:    getEnvOrDefault("PARAMETER_ANALYTICS_URL", "http://localhost:8019"),
			HTTPClient: &http.Client{Timeout: 30 * time.Second},
		},
	}
}

// Health check endpoint
func healthHandler(w http.ResponseWriter, r *http.Request) {
	services := make(map[string]interface{})

	// Check each service health
	services["chat"] = checkServiceHealth(serviceRegistry.ChatService.BaseURL)
	services["memory"] = checkServiceHealth(serviceRegistry.MemoryService.BaseURL)
	services["llm_router"] = checkServiceHealth(serviceRegistry.LLMRouter.BaseURL)
	services["vision"] = checkServiceHealth(serviceRegistry.VisionService.BaseURL)
	services["mlx"] = checkServiceHealth(serviceRegistry.MLXService.BaseURL)
	services["analytics"] = checkServiceHealth(serviceRegistry.ParameterAnalytics.BaseURL)

	response := map[string]interface{}{
		"service":   "orchestration-service",
		"status":    "healthy",
		"timestamp": time.Now(),
		"services":  services,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func checkServiceHealth(url string) string {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url + "/health")
	if err != nil {
		return "unhealthy"
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return "healthy"
	}
	return "unhealthy"
}

// Main orchestration endpoint
func orchestrateHandler(w http.ResponseWriter, r *http.Request) {
	var req OrchestrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid JSON payload", err.Error())
		return
	}

	if req.UserRequest == "" {
		respondWithError(w, http.StatusBadRequest, "MISSING_REQUEST", "userRequest is required", "")
		return
	}

	// Determine which services to use based on the request
	servicesToUse := determineServices(req.UserRequest, req.Context)

	// Execute orchestration
	result, err := executeOrchestration(req, servicesToUse)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "ORCHESTRATION_ERROR", "Failed to orchestrate services", err.Error())
		return
	}

	// Respond with success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func determineServices(userRequest string, context map[string]interface{}) []string {
	services := []string{"llm_router"} // Always include LLM router

	requestLower := strings.ToLower(userRequest)

	// Determine services based on request content
	if strings.Contains(requestLower, "memory") || strings.Contains(requestLower, "remember") {
		services = append(services, "memory")
	}

	if strings.Contains(requestLower, "image") || strings.Contains(requestLower, "vision") || strings.Contains(requestLower, "picture") {
		services = append(services, "vision")
	}

	if strings.Contains(requestLower, "mlx") || strings.Contains(requestLower, "apple") {
		services = append(services, "mlx")
	}

	if strings.Contains(requestLower, "chat") || strings.Contains(requestLower, "conversation") {
		services = append(services, "chat")
	}

	if strings.Contains(requestLower, "analyze") || strings.Contains(requestLower, "parameter") {
		services = append(services, "analytics")
	}

	return services
}

func executeOrchestration(req OrchestrationRequest, services []string) (*OrchestrationResponse, error) {
	startTime := time.Now()
	results := make(map[string]interface{})

	// Execute each service
	for _, serviceName := range services {
		serviceResult, err := executeService(serviceName, req)
		if err != nil {
			log.Printf("Error executing service %s: %v", serviceName, err)
			results[serviceName] = map[string]interface{}{
				"error":  err.Error(),
				"status": "failed",
			}
		} else {
			results[serviceName] = serviceResult
		}
	}

	// Synthesize results
	synthesis := synthesizeResults(results, req.UserRequest)

	executionTime := time.Since(startTime)

	return &OrchestrationResponse{
		Success: true,
		Data: map[string]interface{}{
			"userRequest": req.UserRequest,
			"services":    results,
			"synthesis":   synthesis,
			"summary": map[string]interface{}{
				"servicesUsed":  len(services),
				"executionTime": executionTime.String(),
				"synthesized":   synthesis != "",
			},
		},
		Metadata: map[string]interface{}{
			"timestamp":     time.Now().Format(time.RFC3339),
			"requestId":     fmt.Sprintf("req_%d", time.Now().Unix()),
			"executionMode": "orchestrated",
		},
	}, nil
}

func executeService(serviceName string, req OrchestrationRequest) (interface{}, error) {
	var client *ServiceClient
	var endpoint string
	var payload interface{}

	switch serviceName {
	case "chat":
		client = serviceRegistry.ChatService
		endpoint = "/chat"
		payload = map[string]interface{}{
			"message": req.UserRequest,
			"user_id": "orchestration-user",
		}
	case "memory":
		client = serviceRegistry.MemoryService
		endpoint = "/memory"
		payload = map[string]interface{}{
			"query":   req.UserRequest,
			"user_id": "orchestration-user",
		}
	case "llm_router":
		client = serviceRegistry.LLMRouter
		endpoint = "/chat"
		payload = map[string]interface{}{
			"messages": []map[string]string{
				{"role": "user", "content": req.UserRequest},
			},
		}
	case "vision":
		client = serviceRegistry.VisionService
		endpoint = "/analyze"
		payload = map[string]interface{}{
			"query": req.UserRequest,
		}
	case "mlx":
		client = serviceRegistry.MLXService
		endpoint = "/v1/chat/completions"
		payload = map[string]interface{}{
			"model": "mlx-qwen2.5-0.5b", // Use instant model by default
			"messages": []map[string]interface{}{
				{
					"role":    "user",
					"content": req.UserRequest,
				},
			},
			"max_tokens": 200,
		}
	case "analytics":
		client = serviceRegistry.ParameterAnalytics
		endpoint = "/analyze"
		payload = map[string]interface{}{
			"request": req.UserRequest,
		}
	default:
		return nil, fmt.Errorf("unknown service: %s", serviceName)
	}

	// Make HTTP request
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	resp, err := client.HTTPClient.Post(client.BaseURL+endpoint, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

func synthesizeResults(results map[string]interface{}, userRequest string) string {
	// Simple synthesis - in a real implementation, this would use an LLM
	var synthesis strings.Builder
	synthesis.WriteString("Orchestration completed successfully. ")

	serviceCount := 0
	for _, result := range results {
		if resultMap, ok := result.(map[string]interface{}); ok {
			if _, hasError := resultMap["error"]; !hasError {
				serviceCount++
			}
		}
	}

	synthesis.WriteString(fmt.Sprintf("Executed %d services successfully. ", serviceCount))
	synthesis.WriteString("All requested functionality has been processed.")

	return synthesis.String()
}

func respondWithError(w http.ResponseWriter, statusCode int, code, message, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	errorResp := OrchestrationResponse{
		Success: false,
		Error: &ErrorResponse{
			Code:    code,
			Message: message,
			Details: details,
		},
		Metadata: map[string]interface{}{
			"timestamp": time.Now().Format(time.RFC3339),
		},
	}

	json.NewEncoder(w).Encode(errorResp)
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
	router.HandleFunc("/api/health", healthHandler).Methods("GET")

	// Orchestration endpoints
	router.HandleFunc("/api/v1/orchestrate", orchestrateHandler).Methods("POST")
	router.HandleFunc("/orchestrate", orchestrateHandler).Methods("POST")

	// Root endpoint
	router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "Universal AI Tools Orchestration Service",
			"version": "1.0.0",
			"status":  "running",
			"endpoints": map[string]interface{}{
				"health":      "/health",
				"orchestrate": "/api/v1/orchestrate",
			},
		})
	}).Methods("GET")

	// Start server
	port := getEnvOrDefault("ORCHESTRATION_PORT", "8080")
	log.Printf("Orchestration Service starting on port %s", port)
	log.Printf("Available services:")
	log.Printf("  Chat Service: %s", serviceRegistry.ChatService.BaseURL)
	log.Printf("  Memory Service: %s", serviceRegistry.MemoryService.BaseURL)
	log.Printf("  LLM Router: %s", serviceRegistry.LLMRouter.BaseURL)
	log.Printf("  Vision Service: %s", serviceRegistry.VisionService.BaseURL)
	log.Printf("  MLX Service: %s", serviceRegistry.MLXService.BaseURL)
	log.Printf("  Parameter Analytics: %s", serviceRegistry.ParameterAnalytics.BaseURL)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
