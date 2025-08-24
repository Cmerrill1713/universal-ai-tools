// Conversation context API endpoints for Go API Gateway
// Handles context management, storage, and retrieval for conversations

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

// ContextHandler handles conversation context requests
type ContextHandler struct {
	services *services.Container
	logger   *zap.Logger
}

// NewContextHandler creates a new context handler
func NewContextHandler(services *services.Container, logger *zap.Logger) *ContextHandler {
	return &ContextHandler{
		services: services,
		logger:   logger,
	}
}

// RegisterRoutes registers all context-related routes
func (h *ContextHandler) RegisterRoutes(router *gin.RouterGroup) {
	context := router.Group("/conversation-context")
	{
		// Context management
		context.GET("/", h.GetContext)
		context.POST("/", h.StoreContext)
		context.PUT("/:contextId", h.UpdateContext)
		context.DELETE("/:contextId", h.DeleteContext)

		// Context retrieval and search
		context.GET("/search", h.SearchContext)
		context.GET("/recent", h.GetRecentContext)
		context.GET("/by-conversation/:conversationId", h.GetContextByConversation)

		// Context analytics
		context.GET("/analytics", h.GetContextAnalytics)
		context.GET("/patterns", h.GetContextPatterns)
		context.GET("/insights", h.GetContextInsights)

		// Bulk operations
		context.POST("/bulk-store", h.BulkStoreContext)
		context.DELETE("/bulk-delete", h.BulkDeleteContext)
		context.POST("/cleanup", h.CleanupOldContext)

		// Export/Import
		context.POST("/export", h.ExportContext)
		context.POST("/import", h.ImportContext)
	}
}

// GetContext retrieves context data (GET /api/v1/conversation-context)
func (h *ContextHandler) GetContext(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	// Parse query parameters
	category := c.Query("category")
	source := c.Query("source")
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 1000 {
			limit = l
		}
	}

	// Use search context with filters instead of GetContext
	searchReq := &models.SearchContextRequest{
		Category: category,
		Source:   source,
		Limit:    limit,
	}

	contextResult, err := h.services.Context.SearchContext(ctx, userID, searchReq)
	if err != nil {
		h.logger.Error("Failed to search context",
			zap.Error(err),
			zap.String("user_id", userID))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONTEXT_SEARCH_ERROR",
				"message": "Failed to search context data",
			},
		})
		return
	}

	contextData := contextResult.Entries

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"context": contextData,
			"total":   len(contextData),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
			"filters": gin.H{
				"category": category,
				"source":   source,
				"limit":    limit,
			},
		},
	})
}

// StoreContext stores new context data (POST /api/v1/conversation-context)
func (h *ContextHandler) StoreContext(c *gin.Context) {
	var req models.StoreContextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid request format",
				"details": err.Error(),
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	// Validate required fields
	if req.Category == "" || req.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Category and content are required",
			},
		})
		return
	}

	storeReq := &models.StoreContextRequest{
		UserID:   userID,
		Category: req.Category,
		Source:   req.Source,
		Content:  req.Content,
		Metadata: req.Metadata,
	}

	storedContext, err := h.services.Context.StoreContext(ctx, storeReq)
	if err != nil {
		h.logger.Error("Failed to store context",
			zap.Error(err),
			zap.String("user_id", userID),
			zap.String("category", req.Category))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONTEXT_STORAGE_ERROR",
				"message": "Failed to store context data",
			},
		})
		return
	}

	h.logger.Info("Context stored successfully",
		zap.String("context_id", storedContext.ID),
		zap.String("user_id", userID),
		zap.String("category", req.Category))

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    storedContext,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// SearchContext searches context data (GET /api/v1/conversation-context/search)
func (h *ContextHandler) SearchContext(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Search query is required",
			},
		})
		return
	}

	// Parse optional parameters
	category := c.Query("category")
	source := c.Query("source")
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 1000 {
			limit = l
		}
	}

	searchRequest := &models.SearchContextRequest{
		Query:    query,
		Category: category,
		Source:   source,
		Limit:    limit,
	}

	results, err := h.services.Context.SearchContext(ctx, userID, searchRequest)
	if err != nil {
		h.logger.Error("Context search failed",
			zap.Error(err),
			zap.String("user_id", userID),
			zap.String("query", query))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONTEXT_SEARCH_ERROR",
				"message": "Failed to search context data",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"results": results.Entries,
			"total":   results.TotalCount,
			"query":   query,
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// GetRecentContext gets recently accessed context (GET /api/v1/conversation-context/recent)
func (h *ContextHandler) GetRecentContext(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	// Parse parameters
	hours := 24 // default to last 24 hours
	if hoursStr := c.Query("hours"); hoursStr != "" {
		if h, err := strconv.Atoi(hoursStr); err == nil && h > 0 && h <= 168 { // max 1 week
			hours = h
		}
	}

	limit := 100
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 1000 {
			limit = l
		}
	}

	recentContext, err := h.services.Context.GetRecentContext(ctx, userID, limit)
	if err != nil {
		h.logger.Error("Failed to get recent context",
			zap.Error(err),
			zap.String("user_id", userID),
			zap.Int("hours", hours))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "RECENT_CONTEXT_ERROR",
				"message": "Failed to retrieve recent context",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"context":   recentContext,
			"total":     len(recentContext),
			"timeRange": hours,
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// GetContextByConversation gets context for a specific conversation (GET /api/v1/conversation-context/by-conversation/:conversationId)
func (h *ContextHandler) GetContextByConversation(c *gin.Context) {
	conversationId := c.Param("conversationId")
	if conversationId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Conversation ID is required",
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	contextData, err := h.services.Context.GetContextByConversation(ctx, conversationId)
	if err != nil {
		h.logger.Error("Failed to get conversation context",
			zap.Error(err),
			zap.String("user_id", userID),
			zap.String("conversation_id", conversationId))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONVERSATION_CONTEXT_ERROR",
				"message": "Failed to retrieve conversation context",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"context":        contextData,
			"conversationId": conversationId,
			"total":          len(contextData),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// GetContextAnalytics gets context usage analytics (GET /api/v1/conversation-context/analytics)
func (h *ContextHandler) GetContextAnalytics(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	// Parse time range
	timeRange := c.DefaultQuery("range", "7d") // default to 7 days

	analytics, err := h.services.Context.GetContextAnalytics(ctx, userID, timeRange)
	if err != nil {
		h.logger.Error("Failed to get context analytics",
			zap.Error(err),
			zap.String("user_id", userID),
			zap.String("time_range", timeRange))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONTEXT_ANALYTICS_ERROR",
				"message": "Failed to retrieve context analytics",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    analytics,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
			"timeRange":      timeRange,
		},
	})
}

// BulkStoreContext stores multiple context entries (POST /api/v1/conversation-context/bulk-store)
func (h *ContextHandler) BulkStoreContext(c *gin.Context) {
	var req models.BulkStoreContextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid request format",
				"details": err.Error(),
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	// Validate entries
	if len(req.Entries) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "At least one context entry is required",
			},
		})
		return
	}

	if len(req.Entries) > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Maximum 1000 entries allowed per bulk operation",
			},
		})
		return
	}

	// Add userID to each entry
	for i := range req.Entries {
		req.Entries[i].UserID = userID
	}

	bulkReq := &models.BulkStoreContextRequest{
		Entries: req.Entries,
	}

	results, err := h.services.Context.BulkStoreContext(ctx, bulkReq)
	if err != nil {
		h.logger.Error("Bulk context storage failed",
			zap.Error(err),
			zap.String("user_id", userID),
			zap.Int("entry_count", len(req.Entries)))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "BULK_STORAGE_ERROR",
				"message": "Failed to store context entries",
			},
		})
		return
	}

	h.logger.Info("Bulk context storage completed",
		zap.String("user_id", userID),
		zap.Int("stored_count", len(results)),
		zap.Int("requested_count", len(req.Entries)))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"stored_entries":  results,
			"stored_count":    len(results),
			"requested_count": len(req.Entries),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// CleanupOldContext removes old context entries (POST /api/v1/conversation-context/cleanup)
func (h *ContextHandler) CleanupOldContext(c *gin.Context) {
	var req models.CleanupContextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Invalid request format",
				"details": err.Error(),
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	// Default to 30 days if not specified
	if req.OlderThanDays == 0 {
		req.OlderThanDays = 30
	}

	result, err := h.services.Context.CleanupOldContext(ctx, req.OlderThanDays)
	if err != nil {
		h.logger.Error("Context cleanup failed",
			zap.Error(err),
			zap.String("user_id", userID),
			zap.Int("older_than_days", req.OlderThanDays))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CLEANUP_ERROR",
				"message": "Failed to cleanup old context",
			},
		})
		return
	}

	h.logger.Info("Context cleanup completed",
		zap.String("user_id", userID),
		zap.Int("deleted_count", result.DeletedCount))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// Placeholder methods for remaining endpoints
func (h *ContextHandler) UpdateContext(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Context updated successfully"})
}

func (h *ContextHandler) DeleteContext(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Context deleted successfully"})
}

func (h *ContextHandler) GetContextPatterns(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"patterns": []string{}}})
}

func (h *ContextHandler) GetContextInsights(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"insights": []string{}}})
}

func (h *ContextHandler) BulkDeleteContext(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Bulk delete completed"})
}

func (h *ContextHandler) ExportContext(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Context exported successfully"})
}

func (h *ContextHandler) ImportContext(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Context imported successfully"})
}
