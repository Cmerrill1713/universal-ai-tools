// Health Check Handler with Database Coordinator Integration
package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"universal-ai-tools/go-api-gateway/internal/database"
)

type HealthHandler struct {
	coordinator *database.DatabaseCoordinator
	logger      *zap.Logger
}

type HealthResponse struct {
	Status    string                    `json:"status"`
	Timestamp time.Time                 `json:"timestamp"`
	Version   string                    `json:"version"`
	Service   string                    `json:"service"`
	Databases map[string]DatabaseHealth `json:"databases"`
	Metrics   *ServiceMetrics           `json:"metrics,omitempty"`
	Uptime    string                    `json:"uptime"`
}

type DatabaseHealth struct {
	Status       string        `json:"status"`
	ResponseTime time.Duration `json:"response_time_ms"`
	LastChecked  time.Time     `json:"last_checked"`
}

type ServiceMetrics struct {
	RequestCount    int64                     `json:"request_count"`
	ErrorCount      int64                     `json:"error_count"`
	AverageResponse time.Duration             `json:"average_response_ms"`
	DatabaseMetrics *database.DatabaseMetrics `json:"database_metrics,omitempty"`
}

var startTime = time.Now()

func NewHealthHandler(coordinator *database.DatabaseCoordinator, logger *zap.Logger) *HealthHandler {
	return &HealthHandler{
		coordinator: coordinator,
		logger:      logger,
	}
}

// Health returns comprehensive health status
func (h *HealthHandler) Health(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check database health using coordinator
	databaseHealth := h.checkDatabaseHealth(ctx)

	// Determine overall status
	overallStatus := "healthy"
	for _, dbHealth := range databaseHealth {
		if dbHealth.Status != "healthy" {
			overallStatus = "degraded"
			break
		}
	}

	// Get metrics from coordinator
	var metrics *ServiceMetrics
	if dbMetrics := h.coordinator.GetMetrics(); dbMetrics != nil {
		metrics = &ServiceMetrics{
			DatabaseMetrics: dbMetrics,
		}
	}

	response := HealthResponse{
		Status:    overallStatus,
		Timestamp: time.Now(),
		Version:   "1.0.0",
		Service:   "go-api-gateway",
		Databases: databaseHealth,
		Metrics:   metrics,
		Uptime:    time.Since(startTime).String(),
	}

	// Set appropriate HTTP status
	statusCode := http.StatusOK
	if overallStatus == "degraded" {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}

// Ready returns readiness status (lighter check for k8s)
func (h *HealthHandler) Ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Quick check - just verify coordinator is responsive
	health := h.coordinator.HealthCheck(ctx)

	// Service is ready if at least PostgreSQL is healthy
	postgresHealthy := health["postgres"]

	if postgresHealthy {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"timestamp": time.Now(),
		})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":    "not_ready",
			"reason":    "database_unavailable",
			"timestamp": time.Now(),
		})
	}
}

// Live returns liveness status (basic service check)
func (h *HealthHandler) Live(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "alive",
		"timestamp": time.Now(),
		"uptime":    time.Since(startTime).String(),
	})
}

// Metrics returns detailed metrics in Prometheus format
func (h *HealthHandler) Metrics(c *gin.Context) {
	metrics := h.coordinator.GetMetrics()
	if metrics == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "metrics unavailable",
		})
		return
	}

	// Convert to Prometheus-like format
	prometheusMetrics := h.formatPrometheusMetrics(metrics)

	c.Header("Content-Type", "text/plain")
	c.String(http.StatusOK, prometheusMetrics)
}

// DatabaseStatus returns detailed database status
func (h *HealthHandler) DatabaseStatus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	databaseHealth := h.checkDatabaseHealth(ctx)
	metrics := h.coordinator.GetMetrics()

	response := gin.H{
		"databases": databaseHealth,
		"metrics":   metrics,
		"timestamp": time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

// checkDatabaseHealth performs detailed health checks on all databases
func (h *HealthHandler) checkDatabaseHealth(ctx context.Context) map[string]DatabaseHealth {
	start := time.Now()
	health := h.coordinator.HealthCheck(ctx)
	checkDuration := time.Since(start)

	result := make(map[string]DatabaseHealth)

	for dbName, isHealthy := range health {
		status := "unhealthy"
		if isHealthy {
			status = "healthy"
		}

		result[dbName] = DatabaseHealth{
			Status:       status,
			ResponseTime: checkDuration,
			LastChecked:  time.Now(),
		}
	}

	// Add specific database checks
	result["supabase"] = result["postgres"] // Supabase uses PostgreSQL

	return result
}

// formatPrometheusMetrics converts metrics to Prometheus text format
func (h *HealthHandler) formatPrometheusMetrics(metrics *database.DatabaseMetrics) string {
	var output string

	// Service uptime
	output += "# HELP go_api_gateway_uptime_seconds Service uptime in seconds\n"
	output += "# TYPE go_api_gateway_uptime_seconds counter\n"
	output += fmt.Sprintf("go_api_gateway_uptime_seconds %d\n", int64(time.Since(startTime).Seconds()))

	// Database connections
	output += "# HELP go_api_gateway_db_connections Database connections\n"
	output += "# TYPE go_api_gateway_db_connections gauge\n"
	output += fmt.Sprintf("go_api_gateway_db_connections{database=\"postgres\"} %d\n", metrics.PostgresConnections)
	output += fmt.Sprintf("go_api_gateway_db_connections{database=\"redis\"} %d\n", metrics.RedisConnections)
	output += fmt.Sprintf("go_api_gateway_db_connections{database=\"neo4j\"} %d\n", metrics.Neo4jConnections)

	// Query durations
	output += "# HELP go_api_gateway_query_duration_seconds Query duration in seconds\n"
	output += "# TYPE go_api_gateway_query_duration_seconds histogram\n"

	for operation, duration := range metrics.QueryDuration {
		output += fmt.Sprintf("go_api_gateway_query_duration_seconds{operation=\"%s\"} %f\n",
			operation, duration.Seconds())
	}

	// Error counts
	output += "# HELP go_api_gateway_errors_total Total errors by operation\n"
	output += "# TYPE go_api_gateway_errors_total counter\n"

	for operation, count := range metrics.ErrorCounts {
		output += fmt.Sprintf("go_api_gateway_errors_total{operation=\"%s\"} %d\n",
			operation, count)
	}

	return output
}

// TestDatabase performs connectivity tests for debugging
func (h *HealthHandler) TestDatabase(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	dbType := c.Query("type") // postgres, redis, neo4j, or all

	results := make(map[string]interface{})

	if dbType == "" || dbType == "all" || dbType == "postgres" {
		results["postgres"] = h.testPostgreSQL(ctx)
	}

	if dbType == "" || dbType == "all" || dbType == "redis" {
		results["redis"] = h.testRedis(ctx)
	}

	if dbType == "" || dbType == "all" || dbType == "neo4j" {
		results["neo4j"] = h.testNeo4j(ctx)
	}

	c.JSON(http.StatusOK, gin.H{
		"test_results": results,
		"timestamp":    time.Now(),
	})
}

func (h *HealthHandler) testPostgreSQL(ctx context.Context) map[string]interface{} {
	start := time.Now()

	// Test basic context storage operation
	testData := database.ContextData{
		UserID:    "health_test",
		Category:  "health_check",
		Source:    "go-api-gateway",
		Content:   map[string]interface{}{"test": "connectivity"},
		CreatedAt: time.Now(),
	}

	err := h.coordinator.StoreContext(ctx, testData)
	duration := time.Since(start)

	if err != nil {
		return map[string]interface{}{
			"status":      "failed",
			"error":       err.Error(),
			"duration_ms": duration.Milliseconds(),
		}
	}

	return map[string]interface{}{
		"status":      "success",
		"duration_ms": duration.Milliseconds(),
		"operation":   "store_context",
	}
}

func (h *HealthHandler) testRedis(ctx context.Context) map[string]interface{} {
	start := time.Now()

	// Test cache operations
	testKey := "health_test_" + fmt.Sprintf("%d", time.Now().Unix())
	testValue := map[string]interface{}{"test": "redis_connectivity"}

	err := h.coordinator.CacheSet(ctx, testKey, testValue, 1*time.Minute)
	if err != nil {
		return map[string]interface{}{
			"status":      "failed",
			"error":       err.Error(),
			"duration_ms": time.Since(start).Milliseconds(),
		}
	}

	var retrieved map[string]interface{}
	err = h.coordinator.CacheGet(ctx, testKey, &retrieved)
	duration := time.Since(start)

	// Cleanup
	h.coordinator.CacheDelete(ctx, testKey)

	if err != nil {
		return map[string]interface{}{
			"status":      "failed",
			"error":       err.Error(),
			"duration_ms": duration.Milliseconds(),
		}
	}

	return map[string]interface{}{
		"status":      "success",
		"duration_ms": duration.Milliseconds(),
		"operation":   "set_get_delete",
	}
}

func (h *HealthHandler) testNeo4j(ctx context.Context) map[string]interface{} {
	start := time.Now()

	// Test basic query
	query := "RETURN 'health_check' as test, timestamp() as time"
	results, err := h.coordinator.QueryGraph(ctx, query, nil)
	duration := time.Since(start)

	if err != nil {
		return map[string]interface{}{
			"status":      "failed",
			"error":       err.Error(),
			"duration_ms": duration.Milliseconds(),
		}
	}

	return map[string]interface{}{
		"status":      "success",
		"duration_ms": duration.Milliseconds(),
		"operation":   "query",
		"results":     len(results),
	}
}
