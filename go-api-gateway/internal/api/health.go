// Health check endpoints for Go API Gateway
// Provides comprehensive health monitoring for all system components

package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/services"
)

// HealthRouter creates a dedicated router for health checks
func NewHealthRouter(services *services.Container, logger *zap.Logger) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()

	// Add minimal middleware for health checks
	router.Use(gin.Recovery())

	handler := &HealthHandler{
		services: services,
		logger:   logger,
	}

	// Health check endpoints
	router.GET("/health", handler.BasicHealth)
	router.GET("/health/detailed", handler.DetailedHealth)
	router.GET("/health/ready", handler.ReadinessCheck)
	router.GET("/health/live", handler.LivenessCheck)

	return router
}

// HealthHandler handles health check requests
type HealthHandler struct {
	services *services.Container
	logger   *zap.Logger
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(services *services.Container, logger *zap.Logger) *HealthHandler {
	return &HealthHandler{
		services: services,
		logger:   logger,
	}
}

// HealthStatus represents the overall system health
type HealthStatus struct {
	Status    string                 `json:"status"`
	Version   string                 `json:"version"`
	Timestamp time.Time              `json:"timestamp"`
	Uptime    string                 `json:"uptime"`
	Services  map[string]ServiceInfo `json:"services"`
	System    SystemInfo             `json:"system,omitempty"`
	Migration MigrationInfo          `json:"migration,omitempty"`
}

// ServiceInfo represents individual service health
type ServiceInfo struct {
	Status       string      `json:"status"`
	LastCheck    time.Time   `json:"last_check"`
	ResponseTime string      `json:"response_time,omitempty"`
	Error        string      `json:"error,omitempty"`
	Details      interface{} `json:"details,omitempty"`
}

// SystemInfo represents system-level information
type SystemInfo struct {
	MemoryUsage string `json:"memory_usage"`
	CPUUsage    string `json:"cpu_usage"`
	Goroutines  int    `json:"goroutines"`
	ActiveConns int64  `json:"active_connections"`
}

// MigrationInfo represents migration-specific health information
type MigrationInfo struct {
	Phase             int    `json:"phase"`
	CompatibilityMode bool   `json:"compatibility_mode"`
	TypeScriptHealthy bool   `json:"typescript_healthy"`
	RustAIHealthy     bool   `json:"rust_ai_healthy"`
	MigrationProgress string `json:"migration_progress"`
}

var startTime = time.Now()

// BasicHealth provides a simple health check
func (h *HealthHandler) BasicHealth(c *gin.Context) {
	h.logger.Debug("Basic health check requested")

	status := "healthy"

	// Quick database connectivity check
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := h.services.Database.HealthCheck(ctx); err != nil {
		h.logger.Warn("Database health check failed", zap.Error(err))
		status = "degraded"
	}

	response := gin.H{
		"status":    status,
		"timestamp": time.Now(),
		"uptime":    time.Since(startTime).String(),
	}

	statusCode := http.StatusOK
	if status != "healthy" {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}

// DetailedHealth provides comprehensive health information
func (h *HealthHandler) DetailedHealth(c *gin.Context) {
	h.logger.Debug("Detailed health check requested")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	health := HealthStatus{
		Version:   "0.1.0", // This should come from build-time configuration
		Timestamp: time.Now(),
		Uptime:    time.Since(startTime).String(),
		Services:  make(map[string]ServiceInfo),
	}

	overallHealthy := true

	// Check database health
	dbStart := time.Now()
	dbErr := h.services.Database.HealthCheck(ctx)
	dbResponseTime := time.Since(dbStart)

	health.Services["database"] = ServiceInfo{
		Status:       getStatusFromError(dbErr),
		LastCheck:    time.Now(),
		ResponseTime: dbResponseTime.String(),
		Error:        getErrorString(dbErr),
	}

	if dbErr != nil {
		overallHealthy = false
	}

	// Check Redis health
	redisStart := time.Now()
	redisErr := h.services.Database.RedisHealthCheck(ctx)
	redisResponseTime := time.Since(redisStart)

	health.Services["redis"] = ServiceInfo{
		Status:       getStatusFromError(redisErr),
		LastCheck:    time.Now(),
		ResponseTime: redisResponseTime.String(),
		Error:        getErrorString(redisErr),
	}

	if redisErr != nil {
		overallHealthy = false
	}

	// Check Rust AI service health (if configured)
	if h.services.Migration.IsCompatibilityMode() {
		rustStart := time.Now()
		rustErr := h.services.Migration.CheckRustAIHealth(ctx)
		rustResponseTime := time.Since(rustStart)

		health.Services["rust_ai"] = ServiceInfo{
			Status:       getStatusFromError(rustErr),
			LastCheck:    time.Now(),
			ResponseTime: rustResponseTime.String(),
			Error:        getErrorString(rustErr),
		}

		// Check TypeScript compatibility
		tsStart := time.Now()
		tsErr := h.services.Migration.CheckTypeScriptHealth(ctx)
		tsResponseTime := time.Since(tsStart)

		health.Services["typescript_compatibility"] = ServiceInfo{
			Status:       getStatusFromError(tsErr),
			LastCheck:    time.Now(),
			ResponseTime: tsResponseTime.String(),
			Error:        getErrorString(tsErr),
		}

		// Add migration-specific information
		health.Migration = MigrationInfo{
			Phase:             1,
			CompatibilityMode: true,
			TypeScriptHealthy: tsErr == nil,
			RustAIHealthy:     rustErr == nil,
			MigrationProgress: h.services.Migration.GetProgress(),
		}
	}

	// Add system information
	health.System = SystemInfo{
		MemoryUsage: h.services.Metrics.GetMemoryUsage(),
		CPUUsage:    h.services.Metrics.GetCPUUsage(),
		Goroutines:  h.services.Metrics.GetGoroutineCount(),
		ActiveConns: h.services.Metrics.GetActiveConnections(),
	}

	// Set overall status
	if overallHealthy {
		health.Status = "healthy"
	} else {
		health.Status = "degraded"
	}

	statusCode := http.StatusOK
	if !overallHealthy {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, health)
}

// ReadinessCheck indicates if the service is ready to accept traffic
func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	h.logger.Debug("Readiness check requested")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	ready := true
	checks := make(map[string]bool)

	// Check essential services
	if err := h.services.Database.HealthCheck(ctx); err != nil {
		ready = false
		checks["database"] = false
	} else {
		checks["database"] = true
	}

	if err := h.services.Database.RedisHealthCheck(ctx); err != nil {
		ready = false
		checks["redis"] = false
	} else {
		checks["redis"] = true
	}

	response := gin.H{
		"ready":     ready,
		"timestamp": time.Now(),
		"checks":    checks,
	}

	statusCode := http.StatusOK
	if !ready {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}

// LivenessCheck indicates if the service is alive (for Kubernetes)
func (h *HealthHandler) LivenessCheck(c *gin.Context) {
	h.logger.Debug("Liveness check requested")

	// Simple check - if we can respond, we're alive
	c.JSON(http.StatusOK, gin.H{
		"alive":     true,
		"timestamp": time.Now(),
		"uptime":    time.Since(startTime).String(),
	})
}

// Helper functions

func getStatusFromError(err error) string {
	if err == nil {
		return "healthy"
	}
	return "unhealthy"
}

func getErrorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
