package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"weaviate-client/services"
)

// HealthHandlers handles health check requests
type HealthHandlers struct {
	weaviateService *services.WeaviateService
}

// NewHealthHandlers creates a new health handlers instance
func NewHealthHandlers(ws *services.WeaviateService) *HealthHandlers {
	return &HealthHandlers{
		weaviateService: ws,
	}
}

// HealthHandler handles health check requests
func (hh *HealthHandlers) HealthHandler(w http.ResponseWriter, r *http.Request) {
	weaviateHealthy := hh.weaviateService.HealthCheck()
	
	status := "healthy"
	if !weaviateHealthy {
		status = "unhealthy"
	}

	response := map[string]interface{}{
		"service":    "weaviate-client",
		"status":     status,
		"timestamp":  time.Now().Unix(),
		"weaviate":   weaviateHealthy,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
