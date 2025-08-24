package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// GradingHandler handles MLX model grading API endpoints
type GradingHandler struct {
	gradingService *services.GradingService
}

// NewGradingHandler creates a new grading handler
func NewGradingHandler() *GradingHandler {
	return &GradingHandler{
		gradingService: services.NewGradingService(),
	}
}

// RegisterRoutes registers grading-related routes
func (gh *GradingHandler) RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api/v1")
	{
		// Model grading endpoints
		api.GET("/models/production/grade", gh.GetProductionModelGrade)
		api.GET("/models/status", gh.GetModelStatus)
		api.GET("/models/performance/history", gh.GetPerformanceHistory)
		api.GET("/models/grading/config", gh.GetGradingConfig)
		api.GET("/models/grading/insights", gh.GetGradingInsights)
		api.POST("/models/grading/validate", gh.ValidateModelGrade)
	}
}

// GetProductionModelGrade returns the current production model's performance grade
func (gh *GradingHandler) GetProductionModelGrade(c *gin.Context) {
	deployment, err := gh.gradingService.GetProductionModelGrade()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get production model grade",
			"message": err.Error(),
		})
		return
	}

	gh.gradingService.LogGradingEvent("production_grade_requested", map[string]interface{}{
		"grade": deployment.PerformanceGrade.Grade,
		"score": deployment.PerformanceGrade.Score,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    deployment,
	})
}

// GetModelStatus returns comprehensive status of models across all environments
func (gh *GradingHandler) GetModelStatus(c *gin.Context) {
	status, err := gh.gradingService.GetModelStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get model status",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

// GetPerformanceHistory returns historical performance data
func (gh *GradingHandler) GetPerformanceHistory(c *gin.Context) {
	// Get days parameter (default to 30)
	daysParam := c.Query("days")
	days := 30
	if daysParam != "" {
		if parsed, err := strconv.Atoi(daysParam); err == nil {
			days = parsed
		}
	}

	history, err := gh.gradingService.GetPerformanceHistory(days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get performance history",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"history":   history,
			"days":      days,
			"count":     len(history),
		},
	})
}

// GetGradingConfig returns the current grading system configuration
func (gh *GradingHandler) GetGradingConfig(c *gin.Context) {
	config, err := gh.gradingService.GetGradingConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get grading configuration",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    config,
	})
}

// GetGradingInsights returns insights and recommendations
func (gh *GradingHandler) GetGradingInsights(c *gin.Context) {
	insights, err := gh.gradingService.GetGradingInsights()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get grading insights",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    insights,
	})
}

// ValidateModelGrade validates a model grade for deployment
func (gh *GradingHandler) ValidateModelGrade(c *gin.Context) {
	var request struct {
		Grade string  `json:"grade" binding:"required"`
		Score float64 `json:"score" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request",
			"message": err.Error(),
		})
		return
	}

	approved, reason, err := gh.gradingService.ValidateModelGrade(request.Grade, request.Score)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to validate model grade",
			"message": err.Error(),
		})
		return
	}

	gh.gradingService.LogGradingEvent("grade_validation", map[string]interface{}{
		"grade":    request.Grade,
		"score":    request.Score,
		"approved": approved,
		"reason":   reason,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"grade":              request.Grade,
			"score":              request.Score,
			"deployment_approved": approved,
			"reason":             reason,
		},
	})
}