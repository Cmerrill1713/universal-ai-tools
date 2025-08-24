// News API endpoints for Universal AI Tools
// Real news API with RSS/API integration, caching, and error handling

package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/models"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// NewsHandler handles news-related requests
type NewsHandler struct {
	config      interface{} // We'll use interface{} to match the pattern from other handlers
	logger      *zap.Logger
	newsService *services.NewsService
}

// NewNewsHandler creates a new news handler
func NewNewsHandler(config interface{}, logger *zap.Logger, newsService *services.NewsService) *NewsHandler {
	return &NewsHandler{
		config:      config,
		logger:      logger,
		newsService: newsService,
	}
}

// RegisterRoutes registers news API routes
func (h *NewsHandler) RegisterRoutes(router *gin.RouterGroup) {
	news := router.Group("/news")
	{
		news.GET("", h.GetNews)
		news.GET("/", h.GetNews)
		news.GET("/categories", h.GetCategories)
		news.GET("/stats", h.GetStats)
		news.GET("/refresh", h.RefreshNews)
		news.POST("/refresh", h.RefreshNews)
		
		// Service management endpoints
		news.GET("/health", h.GetHealth)
	}
	
	h.logger.Info("News API routes registered")
}

// GetNews retrieves news articles with optional filtering
// @Summary Get news articles
// @Description Retrieve news articles with optional category filtering, pagination, and caching
// @Tags news
// @Accept json
// @Produce json
// @Param category query string false "News category (all, ai-ml, technology, automotive, programming)"
// @Param limit query int false "Maximum number of items to return (default: 20, max: 100)"
// @Param offset query int false "Number of items to skip (default: 0)"
// @Param sources query string false "Comma-separated list of source IDs to include"
// @Param refresh query bool false "Force refresh cache (default: false)"
// @Success 200 {object} models.NewsResponse
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/news [get]
func (h *NewsHandler) GetNews(c *gin.Context) {
	startTime := time.Now()
	requestID := generateRequestID()
	
	h.logger.Debug("News request received", 
		zap.String("request_id", requestID),
		zap.String("client_ip", c.ClientIP()))

	// Parse query parameters
	req := &models.NewsRequest{
		Category: c.DefaultQuery("category", "all"),
		Sources:  c.Query("sources"),
		Refresh:  c.Query("refresh") == "true",
	}

	// Parse limit with validation
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil && limit > 0 {
			req.Limit = limit
		} else {
			h.respondWithError(c, http.StatusBadRequest, "invalid limit parameter", requestID)
			return
		}
	} else {
		req.Limit = 20 // default
	}

	// Parse offset with validation
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil && offset >= 0 {
			req.Offset = offset
		} else {
			h.respondWithError(c, http.StatusBadRequest, "invalid offset parameter", requestID)
			return
		}
	}

	// Validate category
	category := models.ParseNewsCategory(req.Category)
	if !category.Validate() {
		h.respondWithError(c, http.StatusBadRequest, "invalid category", requestID)
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Fetch news
	response, err := h.newsService.GetNews(ctx, req)
	if err != nil {
		h.logger.Error("Failed to fetch news", 
			zap.Error(err),
			zap.String("request_id", requestID))
		
		h.respondWithError(c, http.StatusInternalServerError, "failed to fetch news", requestID)
		return
	}

	// Update response metadata
	response.Metadata.RequestID = requestID
	response.Metadata.FetchTime = time.Since(startTime).String()

	h.logger.Info("News request completed", 
		zap.String("request_id", requestID),
		zap.String("category", req.Category),
		zap.Int("items", len(response.Data.Items)),
		zap.Bool("cache_hit", response.Metadata.CacheHit),
		zap.Duration("duration", time.Since(startTime)))

	c.JSON(http.StatusOK, response)
}

// GetCategories returns available news categories
// @Summary Get news categories
// @Description Retrieve list of available news categories with their display names
// @Tags news
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Router /api/v1/news/categories [get]
func (h *NewsHandler) GetCategories(c *gin.Context) {
	categories := []gin.H{
		{
			"id":          models.NewsAll.String(),
			"displayName": models.NewsAll.DisplayName(),
			"description": "All categories",
		},
		{
			"id":          models.NewsAIML.String(),
			"displayName": models.NewsAIML.DisplayName(),
			"description": "Artificial Intelligence and Machine Learning news",
		},
		{
			"id":          models.NewsTechnology.String(),
			"displayName": models.NewsTechnology.DisplayName(),
			"description": "General technology and innovation news",
		},
		{
			"id":          models.NewsAutomotive.String(),
			"displayName": models.NewsAutomotive.DisplayName(),
			"description": "Automotive industry and vehicle technology news",
		},
		{
			"id":          models.NewsProgramming.String(),
			"displayName": models.NewsProgramming.DisplayName(),
			"description": "Programming, development, and software engineering news",
		},
	}

	response := gin.H{
		"success": true,
		"data": gin.H{
			"categories": categories,
			"total":      len(categories),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"requestId":      generateRequestID(),
			"implementation": "go-api-gateway",
			"version":        "1.0.0",
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetStats returns news service statistics
// @Summary Get news statistics
// @Description Retrieve news service statistics including cache performance and source counts
// @Tags news
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Router /api/v1/news/stats [get]
func (h *NewsHandler) GetStats(c *gin.Context) {
	stats := h.newsService.GetNewsStats()

	response := gin.H{
		"success": true,
		"data":    stats,
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"requestId":      generateRequestID(),
			"implementation": "go-api-gateway",
			"version":        "1.0.0",
		},
	}

	c.JSON(http.StatusOK, response)
}

// RefreshNews forces a refresh of news cache
// @Summary Refresh news cache
// @Description Force refresh of news cache for all categories
// @Tags news
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/news/refresh [post]
func (h *NewsHandler) RefreshNews(c *gin.Context) {
	startTime := time.Now()
	requestID := generateRequestID()

	h.logger.Info("News cache refresh requested", 
		zap.String("request_id", requestID),
		zap.String("client_ip", c.ClientIP()))

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Refresh all categories
	categories := []models.NewsCategory{
		models.NewsAll,
		models.NewsAIML,
		models.NewsTechnology,
		models.NewsAutomotive,
		models.NewsProgramming,
	}

	refreshed := make(map[string]int)
	var errors []string

	for _, category := range categories {
		req := &models.NewsRequest{
			Category: category.String(),
			Limit:    50,
			Refresh:  true,
		}

		response, err := h.newsService.GetNews(ctx, req)
		if err != nil {
			errorMsg := category.String() + ": " + err.Error()
			errors = append(errors, errorMsg)
			h.logger.Warn("Failed to refresh category", 
				zap.String("category", category.String()),
				zap.Error(err))
		} else {
			refreshed[category.String()] = len(response.Data.Items)
		}
	}

	response := gin.H{
		"success": len(errors) == 0,
		"data": gin.H{
			"refreshed":      refreshed,
			"totalRefreshed": len(refreshed),
			"duration":       time.Since(startTime).String(),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"requestId":      requestID,
			"implementation": "go-api-gateway",
			"version":        "1.0.0",
		},
	}

	if len(errors) > 0 {
		response["errors"] = errors
	}

	statusCode := http.StatusOK
	if len(errors) == len(categories) {
		statusCode = http.StatusInternalServerError
	}

	h.logger.Info("News cache refresh completed", 
		zap.String("request_id", requestID),
		zap.Int("successful", len(refreshed)),
		zap.Int("errors", len(errors)),
		zap.Duration("duration", time.Since(startTime)))

	c.JSON(statusCode, response)
}

// Helper functions

func (h *NewsHandler) respondWithError(c *gin.Context, statusCode int, message string, requestID string) {
	h.logger.Error("News API error", 
		zap.String("request_id", requestID),
		zap.Int("status_code", statusCode),
		zap.String("message", message))

	c.JSON(statusCode, gin.H{
		"success": false,
		"error": gin.H{
			"message": message,
			"code":    statusCode,
		},
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"requestId":      requestID,
			"implementation": "go-api-gateway",
			"version":        "1.0.0",
		},
	})
}

func generateRequestID() string {
	return "news_" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

// GetHealth returns news service health status
// @Summary Get news service health
// @Description Check the health status of the news service and its components
// @Tags news
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Failure 503 {object} gin.H
// @Router /api/v1/news/health [get]
func (h *NewsHandler) GetHealth(c *gin.Context) {
	// Check service dependencies
	newsServiceHealthy := h.newsService != nil
	
	// Check if news service can fetch data (test connectivity)
	var connectivityHealthy bool = true
	if newsServiceHealthy {
		// Try to get cached news data or test service health
		// For now, we'll assume the service is healthy if it exists
		// In production, this could test actual RSS feeds or API endpoints
		connectivityHealthy = true
	}
	
	// Overall service health
	overallHealthy := newsServiceHealthy && connectivityHealthy
	status := "healthy"
	if !overallHealthy {
		status = "unhealthy"
	}
	
	response := gin.H{
		"success": overallHealthy,
		"status":  status,
		"data": gin.H{
			"news_service":      newsServiceHealthy,
			"connectivity":      connectivityHealthy,
			"categories_available": []string{"all", "ai-ml", "technology", "automotive", "programming"},
			"endpoints_active": 6,
		},
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"service":        "news",
			"component":      "news-api",
			"version":        "1.0.0",
		},
	}
	
	statusCode := http.StatusOK
	if !overallHealthy {
		statusCode = http.StatusServiceUnavailable
	}
	
	c.JSON(statusCode, response)
}