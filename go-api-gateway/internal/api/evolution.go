package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// EvolutionHandler handles technology evolution and self-improvement endpoints
type EvolutionHandler struct {
	config    *config.Config
	logger    *zap.Logger
	evolution *services.EvolutionService
}

// NewEvolutionHandler creates a new evolution handler
func NewEvolutionHandler(cfg *config.Config, logger *zap.Logger, evolution *services.EvolutionService) *EvolutionHandler {
	return &EvolutionHandler{
		config:    cfg,
		logger:    logger,
		evolution: evolution,
	}
}

// RegisterRoutes registers evolution-related routes
func (h *EvolutionHandler) RegisterRoutes(rg *gin.RouterGroup) {
	evolution := rg.Group("/evolution")
	{
		evolution.POST("/alert", h.handleTechnologyAlert)
		evolution.GET("/scanner/status", h.getTechScannerStatus)
		evolution.GET("/scanner/results", h.getTechScannerResults)
		evolution.POST("/scanner/trigger", h.triggerTechScan)
		evolution.GET("/recommendations", h.getMigrationRecommendations)
		evolution.GET("/health", h.getEvolutionHealth)
	}
}

// handleTechnologyAlert processes incoming technology alerts from the scanner
func (h *EvolutionHandler) handleTechnologyAlert(c *gin.Context) {
	var alert services.TechnologyAlert
	if err := c.ShouldBindJSON(&alert); err != nil {
		h.logger.Error("Failed to parse technology alert", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid alert format",
			"details": err.Error(),
		})
		return
	}

	if err := h.evolution.HandleTechnologyAlert(c.Request.Context(), alert); err != nil {
		h.logger.Error("Failed to handle technology alert", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to process alert",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Technology alert processed successfully",
	})
}

// getTechScannerStatus retrieves the current status of the technology scanner
func (h *EvolutionHandler) getTechScannerStatus(c *gin.Context) {
	status, err := h.evolution.GetTechScannerStatus(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to get tech scanner status", zap.Error(err))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Technology scanner unavailable",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   status,
	})
}

// getTechScannerResults retrieves the latest scan results from the technology scanner
func (h *EvolutionHandler) getTechScannerResults(c *gin.Context) {
	results, err := h.evolution.GetTechScannerResults(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to get tech scanner results", zap.Error(err))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Technology scanner unavailable",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   results,
	})
}

// triggerTechScan manually triggers a technology scan
func (h *EvolutionHandler) triggerTechScan(c *gin.Context) {
	if err := h.evolution.TriggerTechScan(c.Request.Context()); err != nil {
		h.logger.Error("Failed to trigger tech scan", zap.Error(err))
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Failed to trigger technology scan",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Technology scan triggered successfully",
	})
}

// getMigrationRecommendations returns stored migration recommendations
func (h *EvolutionHandler) getMigrationRecommendations(c *gin.Context) {
	// This would retrieve stored recommendations from database
	// For now, return a sample response
	recommendations := []map[string]interface{}{
		{
			"from_technology":      "TypeScript",
			"to_technology":        "Rust",
			"confidence_score":     0.85,
			"estimated_effort":     "30 days",
			"benefits":            []string{"Memory safety", "Performance", "Concurrency"},
			"risks":               []string{"Learning curve", "Ecosystem differences"},
			"recommendation_date": "2025-01-15T10:00:00Z",
			"status":              "pending_review",
		},
		{
			"from_technology":      "Swift",
			"to_technology":        "React Native",
			"confidence_score":     0.72,
			"estimated_effort":     "45 days",
			"benefits":            []string{"Cross-platform", "Larger talent pool"},
			"risks":               []string{"Performance overhead", "Platform limitations"},
			"recommendation_date": "2025-01-15T10:00:00Z",
			"status":              "under_consideration",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"status":         "success",
		"recommendations": recommendations,
		"total":          len(recommendations),
	})
}

// getEvolutionHealth returns the health status of the evolution system
func (h *EvolutionHandler) getEvolutionHealth(c *gin.Context) {
	// Check tech scanner connectivity
	scannerHealthy := true
	if _, err := h.evolution.GetTechScannerStatus(c.Request.Context()); err != nil {
		scannerHealthy = false
	}

	health := map[string]interface{}{
		"status":         "healthy",
		"tech_scanner":   scannerHealthy,
		"evolution_api":  true,
		"auto_healing":   true, // Would check actual auto-healing system
		"last_check":     "2025-01-15T10:00:00Z",
		"components": map[string]bool{
			"technology_scanner":     scannerHealthy,
			"dependency_analyzer":    true,
			"migration_evaluator":    true,
			"auto_healing_integration": true,
		},
	}

	status := http.StatusOK
	if !scannerHealthy {
		health["status"] = "degraded"
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, health)
}