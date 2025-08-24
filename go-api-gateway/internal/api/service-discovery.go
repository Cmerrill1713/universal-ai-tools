// Service Discovery API handlers for Go API Gateway
// Provides automated service health monitoring and discovery

package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// DiscoveredService represents information about a discovered service
type DiscoveredService struct {
	Name           string                 `json:"name"`
	URL            string                 `json:"url"`
	Port           int                    `json:"port"`
	Status         string                 `json:"status"`
	Type           string                 `json:"type"`
	LastCheck      time.Time              `json:"lastCheck"`
	ResponseTime   string                 `json:"responseTime"`
	Uptime         string                 `json:"uptime,omitempty"`
	Version        string                 `json:"version,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	HealthEndpoint string                 `json:"healthEndpoint"`
	Capabilities   []string               `json:"capabilities,omitempty"`
}

// ServiceRegistry maintains discovered services
type ServiceRegistry struct {
	services map[string]*DiscoveredService
	mu       sync.RWMutex
	logger   *zap.Logger
}

// ServiceDiscoveryHandler handles service discovery endpoints
type ServiceDiscoveryHandler struct {
	config   *config.Config
	logger   *zap.Logger
	registry *ServiceRegistry
	services *services.Container
}

// NewServiceDiscoveryHandler creates a new service discovery handler
func NewServiceDiscoveryHandler(cfg *config.Config, logger *zap.Logger, services *services.Container) *ServiceDiscoveryHandler {
	registry := &ServiceRegistry{
		services: make(map[string]*DiscoveredService),
		logger:   logger,
	}

	handler := &ServiceDiscoveryHandler{
		config:   cfg,
		logger:   logger,
		registry: registry,
		services: services,
	}

	// Start background service discovery
	go handler.startServiceDiscovery()

	return handler
}

// RegisterRoutes registers service discovery routes
func (h *ServiceDiscoveryHandler) RegisterRoutes(router *gin.RouterGroup) {
	discovery := router.Group("/discovery")
	{
		discovery.GET("/services", h.GetServices)
		discovery.GET("/services/health", h.GetServicesHealth)
		discovery.GET("/services/:serviceName", h.GetService)
		discovery.GET("/services/:serviceName/health", h.GetServiceHealth)
		discovery.POST("/services/refresh", h.RefreshServices)
		discovery.GET("/status", h.GetDiscoveryStatus)
		discovery.GET("/metrics", h.GetDiscoveryMetrics)
		discovery.POST("/services/register", h.RegisterService)
		discovery.DELETE("/services/:serviceName", h.UnregisterService)
	}

	h.logger.Info("Service Discovery routes registered", 
		zap.String("prefix", "/api/v1/discovery"), 
		zap.Int("endpoints", 9))
}

// startServiceDiscovery begins automated service discovery and monitoring
func (h *ServiceDiscoveryHandler) startServiceDiscovery() {
	// Define known services to discover
	knownServices := []struct {
		name           string
		url            string
		port           int
		serviceType    string
		healthEndpoint string
		capabilities   []string
	}{
		{"legacy-typescript", "http://localhost:9999", 9999, "legacy", "/health", []string{"chat", "api", "legacy-support"}},
		{"go-api-gateway", "http://localhost:8081", 8081, "gateway", "/health", []string{"chat", "agents", "redis-cache", "migration-compatibility"}},
		{"python-vision", "http://localhost:8000", 8000, "ml", "/health", []string{"image-analysis", "vision", "python"}},
		{"rust-vision-bridge", "http://localhost:8084", 8084, "bridge", "/health", []string{"vision-bridge", "rust", "performance"}},
		{"rust-llm-router", "http://localhost:8082", 8082, "llm", "/health", []string{"llm-routing", "rust", "performance"}},
		{"hrm-mlx-service", "http://localhost:8085", 8085, "ml", "/health", []string{"hierarchical-reasoning", "python", "mlx"}},
	}

	// Initial discovery
	for _, service := range knownServices {
		h.discoverService(service.name, service.url, service.port, service.serviceType, service.healthEndpoint, service.capabilities)
	}

	// Start periodic health checks every 30 seconds
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	h.logger.Info("🔍 Service discovery started - monitoring services every 30 seconds")

	for range ticker.C {
		h.refreshAllServices()
	}
}

// discoverService attempts to discover and register a service
func (h *ServiceDiscoveryHandler) discoverService(name, baseURL string, port int, serviceType, healthEndpoint string, capabilities []string) {
	start := time.Now()
	healthURL := baseURL + healthEndpoint

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", healthURL, nil)
	if err != nil {
		h.registerUnhealthyService(name, baseURL, port, serviceType, healthEndpoint, capabilities, "request_creation_failed")
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		h.registerUnhealthyService(name, baseURL, port, serviceType, healthEndpoint, capabilities, "connection_failed")
		return
	}
	defer resp.Body.Close()

	responseTime := time.Since(start)
	
	var healthData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&healthData); err != nil {
		// Service responds but not with JSON - still consider it healthy
		healthData = map[string]interface{}{"status": "healthy", "format": "non-json"}
	}

	status := "healthy"
	if resp.StatusCode != http.StatusOK {
		status = "unhealthy"
	}

	// Extract additional metadata from health response
	version, _ := healthData["version"].(string)
	uptime, _ := healthData["uptime"].(string)

	serviceInfo := &DiscoveredService{
		Name:           name,
		URL:            baseURL,
		Port:           port,
		Status:         status,
		Type:           serviceType,
		LastCheck:      time.Now(),
		ResponseTime:   responseTime.String(),
		Uptime:         uptime,
		Version:        version,
		Metadata:       healthData,
		HealthEndpoint: healthEndpoint,
		Capabilities:   capabilities,
	}

	h.registry.mu.Lock()
	h.registry.services[name] = serviceInfo
	h.registry.mu.Unlock()

	h.logger.Debug("Service discovered",
		zap.String("name", name),
		zap.String("status", status),
		zap.Duration("response_time", responseTime),
		zap.Int("status_code", resp.StatusCode))
}

// registerUnhealthyService registers a service that couldn't be reached
func (h *ServiceDiscoveryHandler) registerUnhealthyService(name, baseURL string, port int, serviceType, healthEndpoint string, capabilities []string, reason string) {
	serviceInfo := &DiscoveredService{
		Name:           name,
		URL:            baseURL,
		Port:           port,
		Status:         "unhealthy",
		Type:           serviceType,
		LastCheck:      time.Now(),
		ResponseTime:   "timeout",
		HealthEndpoint: healthEndpoint,
		Capabilities:   capabilities,
		Metadata: map[string]interface{}{
			"error": reason,
		},
	}

	h.registry.mu.Lock()
	h.registry.services[name] = serviceInfo
	h.registry.mu.Unlock()
}

// refreshAllServices refreshes health status of all registered services
func (h *ServiceDiscoveryHandler) refreshAllServices() {
	h.registry.mu.RLock()
	services := make([]*DiscoveredService, 0, len(h.registry.services))
	for _, service := range h.registry.services {
		services = append(services, service)
	}
	h.registry.mu.RUnlock()

	for _, service := range services {
		h.discoverService(service.Name, service.URL, service.Port, service.Type, service.HealthEndpoint, service.Capabilities)
	}
}

// GetServices returns all discovered services
func (h *ServiceDiscoveryHandler) GetServices(c *gin.Context) {
	h.registry.mu.RLock()
	services := make([]*DiscoveredService, 0, len(h.registry.services))
	for _, service := range h.registry.services {
		services = append(services, service)
	}
	h.registry.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"services": services,
		"total":    len(services),
		"healthy":  h.countHealthyServices(),
		"timestamp": time.Now(),
	})
}

// GetServicesHealth returns health summary of all services
func (h *ServiceDiscoveryHandler) GetServicesHealth(c *gin.Context) {
	h.registry.mu.RLock()
	defer h.registry.mu.RUnlock()

	healthy := 0
	unhealthy := 0
	serviceStatus := make(map[string]string)

	for name, service := range h.registry.services {
		serviceStatus[name] = service.Status
		if service.Status == "healthy" {
			healthy++
		} else {
			unhealthy++
		}
	}

	overallStatus := "healthy"
	if unhealthy > 0 {
		overallStatus = "degraded"
	}
	if healthy == 0 {
		overallStatus = "critical"
	}

	c.JSON(http.StatusOK, gin.H{
		"overall":        overallStatus,
		"healthy":        healthy,
		"unhealthy":      unhealthy,
		"total":          healthy + unhealthy,
		"services":       serviceStatus,
		"last_check":     time.Now(),
	})
}

// GetService returns information about a specific service
func (h *ServiceDiscoveryHandler) GetService(c *gin.Context) {
	serviceName := c.Param("serviceName")

	h.registry.mu.RLock()
	service, exists := h.registry.services[serviceName]
	h.registry.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Service not found",
			"service": serviceName,
		})
		return
	}

	c.JSON(http.StatusOK, service)
}

// GetServiceHealth checks health of a specific service in real-time
func (h *ServiceDiscoveryHandler) GetServiceHealth(c *gin.Context) {
	serviceName := c.Param("serviceName")

	h.registry.mu.RLock()
	service, exists := h.registry.services[serviceName]
	h.registry.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Service not found",
			"service": serviceName,
		})
		return
	}

	// Perform real-time health check
	h.discoverService(service.Name, service.URL, service.Port, service.Type, service.HealthEndpoint, service.Capabilities)

	h.registry.mu.RLock()
	updatedService := h.registry.services[serviceName]
	h.registry.mu.RUnlock()

	c.JSON(http.StatusOK, updatedService)
}

// RefreshServices forces a refresh of all service discovery
func (h *ServiceDiscoveryHandler) RefreshServices(c *gin.Context) {
	start := time.Now()
	h.refreshAllServices()
	duration := time.Since(start)

	h.registry.mu.RLock()
	total := len(h.registry.services)
	healthy := h.countHealthyServices()
	h.registry.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"message":      "Service discovery refresh completed",
		"duration":     duration.String(),
		"total":        total,
		"healthy":      healthy,
		"unhealthy":    total - healthy,
		"timestamp":    time.Now(),
	})
}

// GetDiscoveryStatus returns status of the discovery service itself
func (h *ServiceDiscoveryHandler) GetDiscoveryStatus(c *gin.Context) {
	h.registry.mu.RLock()
	total := len(h.registry.services)
	healthy := h.countHealthyServices()
	h.registry.mu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"discovery_service": "healthy",
		"monitoring":        true,
		"services": gin.H{
			"total":    total,
			"healthy":  healthy,
			"unhealthy": total - healthy,
		},
		"check_interval": "30s",
		"last_refresh":   time.Now(),
	})
}

// GetDiscoveryMetrics returns detailed metrics about service discovery
func (h *ServiceDiscoveryHandler) GetDiscoveryMetrics(c *gin.Context) {
	h.registry.mu.RLock()
	defer h.registry.mu.RUnlock()

	metrics := gin.H{
		"total_services": len(h.registry.services),
		"healthy_services": h.countHealthyServices(),
		"service_types": make(map[string]int),
		"average_response_time": h.calculateAverageResponseTime(),
		"uptime_summary": h.getUptimeSummary(),
	}

	// Count services by type
	serviceTypes := metrics["service_types"].(map[string]int)
	for _, service := range h.registry.services {
		serviceTypes[service.Type]++
	}

	c.JSON(http.StatusOK, metrics)
}

// RegisterService allows manual registration of a service
func (h *ServiceDiscoveryHandler) RegisterService(c *gin.Context) {
	var req struct {
		Name           string   `json:"name" binding:"required"`
		URL            string   `json:"url" binding:"required"`
		Port           int      `json:"port" binding:"required"`
		Type           string   `json:"type" binding:"required"`
		HealthEndpoint string   `json:"healthEndpoint"`
		Capabilities   []string `json:"capabilities"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.HealthEndpoint == "" {
		req.HealthEndpoint = "/health"
	}

	h.discoverService(req.Name, req.URL, req.Port, req.Type, req.HealthEndpoint, req.Capabilities)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Service registered and health check initiated",
		"service": req.Name,
	})
}

// UnregisterService removes a service from discovery
func (h *ServiceDiscoveryHandler) UnregisterService(c *gin.Context) {
	serviceName := c.Param("serviceName")

	h.registry.mu.Lock()
	_, exists := h.registry.services[serviceName]
	if exists {
		delete(h.registry.services, serviceName)
	}
	h.registry.mu.Unlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Service not found",
			"service": serviceName,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Service unregistered",
		"service": serviceName,
	})
}

// Helper functions

func (h *ServiceDiscoveryHandler) countHealthyServices() int {
	count := 0
	for _, service := range h.registry.services {
		if service.Status == "healthy" {
			count++
		}
	}
	return count
}

func (h *ServiceDiscoveryHandler) calculateAverageResponseTime() string {
	if len(h.registry.services) == 0 {
		return "0ms"
	}

	totalMs := int64(0)
	validServices := 0

	for _, service := range h.registry.services {
		if duration, err := time.ParseDuration(service.ResponseTime); err == nil {
			totalMs += duration.Milliseconds()
			validServices++
		}
	}

	if validServices == 0 {
		return "0ms"
	}

	avgMs := totalMs / int64(validServices)
	return strconv.FormatInt(avgMs, 10) + "ms"
}

func (h *ServiceDiscoveryHandler) getUptimeSummary() map[string]interface{} {
	summary := map[string]interface{}{
		"services_with_uptime": 0,
		"average_uptime": "unknown",
	}

	servicesWithUptime := 0
	for _, service := range h.registry.services {
		if service.Uptime != "" {
			servicesWithUptime++
		}
	}

	summary["services_with_uptime"] = servicesWithUptime
	return summary
}