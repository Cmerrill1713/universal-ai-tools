// Memory monitoring API handler for Universal AI Tools Go API Gateway
// Provides system memory monitoring, optimization, and analytics

package api

import (
	"context"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/models"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// MemoryHandler handles memory monitoring and optimization requests
type MemoryHandler struct {
	services *services.Container
	logger   *zap.Logger
}

// NewMemoryHandler creates a new memory monitoring handler
func NewMemoryHandler(services *services.Container, logger *zap.Logger) *MemoryHandler {
	return &MemoryHandler{
		services: services,
		logger:   logger.With(zap.String("handler", "memory")),
	}
}

// RegisterRoutes registers memory monitoring routes
func (h *MemoryHandler) RegisterRoutes(rg *gin.RouterGroup) {
	memory := rg.Group("/memory-monitoring")
	{
		// System memory monitoring
		memory.GET("/status", h.GetMemoryStatus)
		memory.GET("/usage", h.GetMemoryUsage)
		memory.GET("/history", h.GetMemoryHistory)
		memory.GET("/metrics", h.GetMemoryMetrics)

		// Memory optimization
		memory.POST("/optimize", h.OptimizeMemory)
		memory.POST("/gc", h.TriggerGarbageCollection)
		memory.POST("/clear-cache", h.ClearCache)

		// Memory alerts and monitoring
		memory.GET("/alerts", h.GetMemoryAlerts)
		memory.POST("/alerts", h.CreateMemoryAlert)
		memory.PUT("/alerts/:id", h.UpdateMemoryAlert)
		memory.DELETE("/alerts/:id", h.DeleteMemoryAlert)

		// Memory analytics
		memory.GET("/analytics", h.GetMemoryAnalytics)
		memory.GET("/trends", h.GetMemoryTrends)
		memory.GET("/recommendations", h.GetMemoryRecommendations)
		
		// Service management endpoints
		memory.GET("/health", h.GetHealth)
	}

	h.logger.Info("Memory monitoring routes registered",
		zap.Int("route_count", 13))
}

// GetMemoryStatus returns current system memory status
func (h *MemoryHandler) GetMemoryStatus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get runtime memory stats
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Get system memory information from service
	systemMemory, err := h.services.Memory.GetSystemMemoryInfo(ctx)
	if err != nil {
		h.logger.Error("Failed to get system memory info", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve system memory information",
			"code":  "MEMORY_STATUS_ERROR",
		})
		return
	}

	status := &models.MemoryStatus{
		Timestamp: time.Now(),
		System: models.SystemMemory{
			Total:        systemMemory.Total,
			Available:    systemMemory.Available,
			Used:         systemMemory.Used,
			Free:         systemMemory.Free,
			UsagePercent: float64(systemMemory.Used) / float64(systemMemory.Total) * 100,
		},
		Application: models.ApplicationMemory{
			Allocated:  memStats.Alloc,
			TotalAlloc: memStats.TotalAlloc,
			Sys:        memStats.Sys,
			NumGC:      memStats.NumGC,
			HeapAlloc:  memStats.HeapAlloc,
			HeapSys:    memStats.HeapSys,
			HeapIdle:   memStats.HeapIdle,
			HeapInuse:  memStats.HeapInuse,
			StackInuse: memStats.StackInuse,
			StackSys:   memStats.StackSys,
		},
		Status: h.calculateMemoryStatus(systemMemory),
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   status,
	})
}

// GetMemoryUsage returns detailed memory usage information
func (h *MemoryHandler) GetMemoryUsage(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	// Parse query parameters
	includeHistory := c.DefaultQuery("include_history", "false") == "true"
	serviceName := c.Query("service")

	usage, err := h.services.Memory.GetDetailedUsage(ctx, &services.MemoryUsageRequest{
		IncludeHistory: includeHistory,
		ServiceName:    serviceName,
	})
	if err != nil {
		h.logger.Error("Failed to get memory usage", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve memory usage",
			"code":  "MEMORY_USAGE_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   usage,
	})
}

// GetMemoryHistory returns historical memory usage data
func (h *MemoryHandler) GetMemoryHistory(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	// Parse query parameters
	hours, _ := strconv.Atoi(c.DefaultQuery("hours", "24"))
	granularity := c.DefaultQuery("granularity", "hour") // minute, hour, day
	serviceName := c.Query("service")

	if hours > 168 { // Limit to 1 week
		hours = 168
	}

	history, err := h.services.Memory.GetMemoryHistory(ctx, &services.MemoryHistoryRequest{
		Hours:       hours,
		Granularity: granularity,
		ServiceName: serviceName,
	})
	if err != nil {
		h.logger.Error("Failed to get memory history", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve memory history",
			"code":  "MEMORY_HISTORY_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   history,
		"meta": gin.H{
			"hours":       hours,
			"granularity": granularity,
			"service":     serviceName,
		},
	})
}

// GetMemoryMetrics returns comprehensive memory metrics
func (h *MemoryHandler) GetMemoryMetrics(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	metrics, err := h.services.Memory.GetMemoryMetrics(ctx)
	if err != nil {
		h.logger.Error("Failed to get memory metrics", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve memory metrics",
			"code":  "MEMORY_METRICS_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   metrics,
	})
}

// OptimizeMemory triggers memory optimization procedures
func (h *MemoryHandler) OptimizeMemory(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	var req models.MemoryOptimizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Warn("Invalid memory optimization request", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	// Set defaults
	if req.OptimizationType == "" {
		req.OptimizationType = "standard"
	}

	result, err := h.services.Memory.OptimizeMemory(ctx, &req)
	if err != nil {
		h.logger.Error("Memory optimization failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Memory optimization failed",
			"code":  "OPTIMIZATION_FAILED",
		})
		return
	}

	h.logger.Info("Memory optimization completed",
		zap.String("type", req.OptimizationType),
		zap.Uint64("memory_freed", result.MemoryFreed),
		zap.Duration("duration", result.Duration))

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Memory optimization completed",
		"data":    result,
	})
}

// TriggerGarbageCollection forces garbage collection
func (h *MemoryHandler) TriggerGarbageCollection(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var memStatsBefore runtime.MemStats
	runtime.ReadMemStats(&memStatsBefore)

	beforeAlloc := memStatsBefore.Alloc
	beforeHeap := memStatsBefore.HeapAlloc

	// Force garbage collection
	runtime.GC()
	runtime.GC() // Run twice for better cleanup

	var memStatsAfter runtime.MemStats
	runtime.ReadMemStats(&memStatsAfter)

	result := &models.GarbageCollectionResult{
		Timestamp:    time.Now(),
		MemoryBefore: beforeAlloc,
		MemoryAfter:  memStatsAfter.Alloc,
		MemoryFreed:  beforeAlloc - memStatsAfter.Alloc,
		HeapBefore:   beforeHeap,
		HeapAfter:    memStatsAfter.HeapAlloc,
		HeapFreed:    beforeHeap - memStatsAfter.HeapAlloc,
		NumGC:        memStatsAfter.NumGC,
	}

	// Store GC result if service is available
	if h.services.Memory != nil {
		if err := h.services.Memory.RecordGarbageCollection(ctx, result); err != nil {
			h.logger.Warn("Failed to record GC result", zap.Error(err))
		}
	}

	h.logger.Info("Garbage collection completed",
		zap.Uint64("memory_freed", result.MemoryFreed),
		zap.Uint64("heap_freed", result.HeapFreed))

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Garbage collection completed",
		"data":    result,
	})
}

// ClearCache clears various application caches
func (h *MemoryHandler) ClearCache(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	var req models.ClearCacheRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Warn("Invalid clear cache request", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	result, err := h.services.Memory.ClearCache(ctx, &req)
	if err != nil {
		h.logger.Error("Cache clearing failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cache clearing failed",
			"code":  "CACHE_CLEAR_FAILED",
		})
		return
	}

	h.logger.Info("Cache cleared successfully",
		zap.Strings("cache_types", req.CacheTypes),
		zap.Uint64("memory_freed", result.MemoryFreed))

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Cache cleared successfully",
		"data":    result,
	})
}

// GetMemoryAlerts returns active memory alerts
func (h *MemoryHandler) GetMemoryAlerts(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	alerts, err := h.services.Memory.GetMemoryAlerts(ctx)
	if err != nil {
		h.logger.Error("Failed to get memory alerts", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve memory alerts",
			"code":  "MEMORY_ALERTS_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   alerts,
		"count":  len(alerts),
	})
}

// CreateMemoryAlert creates a new memory alert
func (h *MemoryHandler) CreateMemoryAlert(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var req models.CreateMemoryAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Warn("Invalid create alert request", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	alert, err := h.services.Memory.CreateMemoryAlert(ctx, &req)
	if err != nil {
		h.logger.Error("Failed to create memory alert", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create memory alert",
			"code":  "ALERT_CREATE_FAILED",
		})
		return
	}

	h.logger.Info("Memory alert created", zap.String("alert_id", alert.ID))

	c.JSON(http.StatusCreated, gin.H{
		"status":  "success",
		"message": "Memory alert created successfully",
		"data":    alert,
	})
}

// UpdateMemoryAlert updates an existing memory alert
func (h *MemoryHandler) UpdateMemoryAlert(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	alertID := c.Param("id")
	if alertID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Alert ID is required",
			"code":  "MISSING_ALERT_ID",
		})
		return
	}

	var req models.UpdateMemoryAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Warn("Invalid update alert request", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"code":  "INVALID_REQUEST",
		})
		return
	}

	alert, err := h.services.Memory.UpdateMemoryAlert(ctx, alertID, &req)
	if err != nil {
		h.logger.Error("Failed to update memory alert", zap.String("alert_id", alertID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update memory alert",
			"code":  "ALERT_UPDATE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Memory alert updated successfully",
		"data":    alert,
	})
}

// DeleteMemoryAlert deletes a memory alert
func (h *MemoryHandler) DeleteMemoryAlert(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	alertID := c.Param("id")
	if alertID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Alert ID is required",
			"code":  "MISSING_ALERT_ID",
		})
		return
	}

	err := h.services.Memory.DeleteMemoryAlert(ctx, alertID)
	if err != nil {
		h.logger.Error("Failed to delete memory alert", zap.String("alert_id", alertID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete memory alert",
			"code":  "ALERT_DELETE_FAILED",
		})
		return
	}

	h.logger.Info("Memory alert deleted", zap.String("alert_id", alertID))

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Memory alert deleted successfully",
	})
}

// GetMemoryAnalytics returns memory usage analytics
func (h *MemoryHandler) GetMemoryAnalytics(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	// Parse query parameters
	timeRange := c.DefaultQuery("time_range", "24h") // 1h, 24h, 7d, 30d
	groupBy := c.DefaultQuery("group_by", "hour")    // minute, hour, day

	analytics, err := h.services.Memory.GetMemoryAnalytics(ctx, &services.MemoryAnalyticsRequest{
		TimeRange: timeRange,
		GroupBy:   groupBy,
	})
	if err != nil {
		h.logger.Error("Failed to get memory analytics", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve memory analytics",
			"code":  "MEMORY_ANALYTICS_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   analytics,
		"meta": gin.H{
			"time_range": timeRange,
			"group_by":   groupBy,
		},
	})
}

// GetMemoryTrends returns memory usage trends and predictions
func (h *MemoryHandler) GetMemoryTrends(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	trends, err := h.services.Memory.GetMemoryTrends(ctx)
	if err != nil {
		h.logger.Error("Failed to get memory trends", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve memory trends",
			"code":  "MEMORY_TRENDS_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   trends,
	})
}

// GetMemoryRecommendations returns memory optimization recommendations
func (h *MemoryHandler) GetMemoryRecommendations(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	recommendations, err := h.services.Memory.GetMemoryRecommendations(ctx)
	if err != nil {
		h.logger.Error("Failed to get memory recommendations", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve memory recommendations",
			"code":  "MEMORY_RECOMMENDATIONS_ERROR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   recommendations,
	})
}

// Helper functions

// calculateMemoryStatus determines the overall memory status
func (h *MemoryHandler) calculateMemoryStatus(systemMemory *models.SystemMemoryInfo) string {
	usagePercent := float64(systemMemory.Used) / float64(systemMemory.Total) * 100

	switch {
	case usagePercent < 60:
		return "healthy"
	case usagePercent < 80:
		return "warning"
	case usagePercent < 95:
		return "critical"
	default:
		return "emergency"
	}
}

// GetHealth returns memory service health status
// @Summary Get memory service health
// @Description Check the health status of the memory monitoring service and its components
// @Tags memory
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Failure 503 {object} gin.H
// @Router /api/v1/memory-monitoring/health [get]
func (h *MemoryHandler) GetHealth(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	
	// Get runtime memory stats to check service health
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	// Check service dependencies
	memoryServiceHealthy := h.services != nil && h.services.Memory != nil
	systemHealthy := true
	
	// Try to get system memory info to verify service connectivity
	if memoryServiceHealthy {
		if _, err := h.services.Memory.GetSystemMemoryInfo(ctx); err != nil {
			systemHealthy = false
			h.logger.Warn("Memory service connection test failed", zap.Error(err))
		}
	}
	
	// Calculate health metrics
	currentUsage := float64(memStats.Sys) / (1024 * 1024 * 1024) // Convert to GB
	overallHealthy := memoryServiceHealthy && systemHealthy && currentUsage < 8.0 // Less than 8GB is healthy
	
	status := "healthy"
	if !overallHealthy {
		status = "unhealthy"
	} else if currentUsage > 4.0 {
		status = "warning"
	}
	
	response := gin.H{
		"success": overallHealthy,
		"status":  status,
		"data": gin.H{
			"memory_service":     memoryServiceHealthy,
			"system_accessible":  systemHealthy,
			"current_usage_gb":   currentUsage,
			"go_runtime_stats": gin.H{
				"alloc_mb":      float64(memStats.Alloc) / (1024 * 1024),
				"total_alloc_mb": float64(memStats.TotalAlloc) / (1024 * 1024),
				"sys_mb":        float64(memStats.Sys) / (1024 * 1024),
				"num_gc":        memStats.NumGC,
			},
		},
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"service":        "memory-monitoring",
			"component":      "memory-api",
			"version":        "1.0.0",
		},
	}
	
	statusCode := http.StatusOK
	if !overallHealthy {
		statusCode = http.StatusServiceUnavailable
	}
	
	c.JSON(statusCode, response)
}
