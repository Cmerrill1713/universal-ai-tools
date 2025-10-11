package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// ServiceInfo represents a service in the discovery system
type ServiceInfo struct {
	Name     string            `json:"name"`
	Address  string            `json:"address"`
	Port     int               `json:"port"`
	Tags     []string          `json:"tags"`
	Meta     map[string]string `json:"meta"`
	Health   string            `json:"health"`
	Language string            `json:"language"`
	Type     string            `json:"type"`
}

// ServiceRegistry holds registered services
type ServiceRegistry struct {
	services map[string][]ServiceInfo
}

// NewServiceRegistry creates a new service registry
func NewServiceRegistry() *ServiceRegistry {
	return &ServiceRegistry{
		services: make(map[string][]ServiceInfo),
	}
}

// RegisterService adds a service to the registry
func (sr *ServiceRegistry) RegisterService(service ServiceInfo) {
	sr.services[service.Name] = append(sr.services[service.Name], service)
	log.Printf("Registered service: %s at %s:%d", service.Name, service.Address, service.Port)
}

// GetService returns the first healthy service of the given name
func (sr *ServiceRegistry) GetService(name string) (*ServiceInfo, error) {
	services, exists := sr.services[name]
	if !exists || len(services) == 0 {
		return nil, fmt.Errorf("service %s not found", name)
	}
	return &services[0], nil
}

// ListServices returns all registered services
func (sr *ServiceRegistry) ListServices() map[string][]ServiceInfo {
	return sr.services
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status            string            `json:"status"`
	RegisteredServices int               `json:"registered_services"`
	Services          map[string][]ServiceInfo `json:"services"`
	Timestamp         time.Time         `json:"timestamp"`
}

func main() {
	registry := NewServiceRegistry()
	
	// Register default services
	defaultServices := []ServiceInfo{
		{Name: "chat-service", Address: "localhost", Port: 8016, Language: "go", Type: "api", Health: "healthy"},
		{Name: "memory-service", Address: "localhost", Port: 8017, Language: "go", Type: "api", Health: "healthy"},
		{Name: "websocket-hub", Address: "localhost", Port: 8082, Language: "go", Type: "websocket", Health: "healthy"},
		{Name: "llm-router", Address: "localhost", Port: 3033, Language: "rust", Type: "ml", Health: "healthy"},
		{Name: "assistantd", Address: "localhost", Port: 8085, Language: "rust", Type: "ml", Health: "healthy"},
		{Name: "vector-db", Address: "localhost", Port: 8090, Language: "docker", Type: "vector", Health: "healthy"},
		{Name: "supabase", Address: "localhost", Port: 54321, Language: "docker", Type: "database", Health: "healthy"},
	}
	
	for _, service := range defaultServices {
		registry.RegisterService(service)
	}

	// HTTP handlers
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		response := HealthResponse{
			Status: "healthy",
			RegisteredServices: len(registry.ListServices()),
			Services: registry.ListServices(),
			Timestamp: time.Now(),
		}
		json.NewEncoder(w).Encode(response)
	})

	http.HandleFunc("/services", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(registry.ListServices())
	})

	http.HandleFunc("/service/", func(w http.ResponseWriter, r *http.Request) {
		serviceName := r.URL.Path[len("/service/"):]
		service, err := registry.GetService(serviceName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(service)
	})

	// Start server
	port := getEnvOrDefault("PORT", "8083")
	log.Printf("Service Discovery starting on port %s", port)
	log.Printf("Available endpoints:")
	log.Printf("  GET /health - Health check")
	log.Printf("  GET /services - List all services")
	log.Printf("  GET /service/{name} - Get specific service")
	
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Service Discovery failed to start: %v", err)
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
