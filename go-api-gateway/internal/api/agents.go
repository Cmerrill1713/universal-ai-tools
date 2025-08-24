// Agent management API endpoints for Go API Gateway
// Handles agent lifecycle, capabilities, and routing

package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/models"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// AgentHandler handles agent-related requests
type AgentHandler struct {
	services *services.Container
	logger   *zap.Logger
}

// NewAgentHandler creates a new agent handler
func NewAgentHandler(services *services.Container, logger *zap.Logger) *AgentHandler {
	return &AgentHandler{
		services: services,
		logger:   logger,
	}
}

// RegisterRoutes registers all agent-related routes
func (h *AgentHandler) RegisterRoutes(router *gin.RouterGroup) {
	agents := router.Group("/agents")
	{
		agents.GET("/", h.ListAgents)
		agents.GET("/available", h.GetAvailableAgents)
		agents.GET("/status", h.GetAgentStatus)
		agents.POST("/", h.CreateAgent)
		agents.GET("/:agentId", h.GetAgent)
		agents.PUT("/:agentId", h.UpdateAgent)
		agents.DELETE("/:agentId", h.DeleteAgent)
		agents.POST("/:agentId/activate", h.ActivateAgent)
		agents.POST("/:agentId/deactivate", h.DeactivateAgent)
		agents.GET("/:agentId/performance", h.GetAgentPerformance)
		agents.POST("/registry/sync", h.SyncAgentRegistry)
		agents.POST("/bulk-update", h.BulkUpdateAgents)
	}
}

// ListAgents lists all available agents (GET /api/v1/agents)
func (h *AgentHandler) ListAgents(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get query parameters
	includeInactive := c.Query("include_inactive") == "true"
	category := c.Query("category")
	capability := c.Query("capability")

	agentResponse, err := h.services.Agent.ListAgents(ctx, &models.AgentFilter{
		IncludeInactive: includeInactive,
		Category:        category,
		Capability:      capability,
	})

	if err != nil {
		h.logger.Error("Failed to list agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_LIST_ERROR",
				"message": "Failed to retrieve agents",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"agents": agentResponse.Agents,
			"total":  agentResponse.TotalCount,
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
			"filtering": gin.H{
				"include_inactive": includeInactive,
				"category":         category,
				"capability":       capability,
			},
		},
	})
}

// GetAvailableAgents gets currently available agents with capabilities (GET /api/v1/agents/available)
func (h *AgentHandler) GetAvailableAgents(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	agents, err := h.services.Agent.GetAvailableAgents(ctx)
	if err != nil {
		h.logger.Error("Failed to get available agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_AVAILABILITY_ERROR",
				"message": "Failed to check agent availability",
			},
		})
		return
	}

	// Include agent capabilities and performance metrics
	enrichedAgents := make([]gin.H, len(agents))
	for i, agent := range agents {
		performance, _ := h.services.Agent.GetAgentPerformance(ctx, agent.ID)

		enrichedAgents[i] = gin.H{
			"id":           agent.ID,
			"name":         agent.Name,
			"type":         agent.Type,
			"category":     agent.Category,
			"capabilities": agent.Capabilities,
			"status":       agent.Status,
			"load":         agent.CurrentLoad,
			"performance":  performance,
			"lastSeen":     agent.LastSeen,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"agents":           enrichedAgents,
			"availableCount":   len(agents),
			"recommendedAgent": h.getRecommendedAgent(agents),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// GetAgentStatus gets overall agent system status (GET /api/v1/agents/status)
func (h *AgentHandler) GetAgentStatus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	status, err := h.services.Agent.GetSystemStatus(ctx)
	if err != nil {
		h.logger.Error("Failed to get agent status", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_STATUS_ERROR",
				"message": "Failed to retrieve agent system status",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// CreateAgent creates a new agent (POST /api/v1/agents)
func (h *AgentHandler) CreateAgent(c *gin.Context) {
	var req models.CreateAgentRequest
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

	// Validate required fields
	if req.Name == "" || req.Type == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Agent name and type are required",
			},
		})
		return
	}

	// Fix Config field mapping
	if req.Config != nil && req.Configuration == nil {
		req.Configuration = req.Config
	}

	createdAgent, err := h.services.Agent.CreateAgent(ctx, &req)
	if err != nil {
		h.logger.Error("Failed to create agent",
			zap.Error(err),
			zap.String("agent_name", req.Name),
			zap.String("agent_type", req.Type))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_CREATE_ERROR",
				"message": "Failed to create agent",
			},
		})
		return
	}

	h.logger.Info("Agent created successfully",
		zap.String("agent_id", createdAgent.ID),
		zap.String("agent_name", createdAgent.Name))

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    createdAgent,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// GetAgent retrieves a specific agent (GET /api/v1/agents/:agentId)
func (h *AgentHandler) GetAgent(c *gin.Context) {
	agentId := c.Param("agentId")
	if agentId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Agent ID is required",
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	agent, err := h.services.Agent.GetAgent(ctx, agentId)
	if err != nil {
		h.logger.Error("Failed to get agent", zap.Error(err), zap.String("agent_id", agentId))
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_NOT_FOUND",
				"message": "Agent not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    agent,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// UpdateAgent updates an existing agent (PUT /api/v1/agents/:agentId)
func (h *AgentHandler) UpdateAgent(c *gin.Context) {
	agentId := c.Param("agentId")
	if agentId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Agent ID is required",
			},
		})
		return
	}

	var req models.UpdateAgentRequest
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	updatedAgent, err := h.services.Agent.UpdateAgent(ctx, agentId, &req)
	if err != nil {
		h.logger.Error("Failed to update agent",
			zap.Error(err),
			zap.String("agent_id", agentId))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_UPDATE_ERROR",
				"message": "Failed to update agent",
			},
		})
		return
	}

	h.logger.Info("Agent updated successfully", zap.String("agent_id", agentId))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    updatedAgent,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// DeleteAgent deletes an agent (DELETE /api/v1/agents/:agentId)
func (h *AgentHandler) DeleteAgent(c *gin.Context) {
	agentId := c.Param("agentId")
	if agentId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Agent ID is required",
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := h.services.Agent.DeleteAgent(ctx, agentId); err != nil {
		h.logger.Error("Failed to delete agent",
			zap.Error(err),
			zap.String("agent_id", agentId))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_DELETE_ERROR",
				"message": "Failed to delete agent",
			},
		})
		return
	}

	h.logger.Info("Agent deleted successfully", zap.String("agent_id", agentId))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"message": "Agent deleted successfully",
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// ActivateAgent activates an agent (POST /api/v1/agents/:agentId/activate)
func (h *AgentHandler) ActivateAgent(c *gin.Context) {
	agentId := c.Param("agentId")
	if agentId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Agent ID is required",
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := h.services.Agent.ActivateAgent(ctx, agentId); err != nil {
		h.logger.Error("Failed to activate agent",
			zap.Error(err),
			zap.String("agent_id", agentId))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_ACTIVATION_ERROR",
				"message": "Failed to activate agent",
			},
		})
		return
	}

	h.logger.Info("Agent activated successfully", zap.String("agent_id", agentId))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"message": "Agent activated successfully",
			"agentId": agentId,
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// DeactivateAgent deactivates an agent (POST /api/v1/agents/:agentId/deactivate)
func (h *AgentHandler) DeactivateAgent(c *gin.Context) {
	agentId := c.Param("agentId")
	if agentId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Agent ID is required",
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := h.services.Agent.DeactivateAgent(ctx, agentId); err != nil {
		h.logger.Error("Failed to deactivate agent",
			zap.Error(err),
			zap.String("agent_id", agentId))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_DEACTIVATION_ERROR",
				"message": "Failed to deactivate agent",
			},
		})
		return
	}

	h.logger.Info("Agent deactivated successfully", zap.String("agent_id", agentId))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"message": "Agent deactivated successfully",
			"agentId": agentId,
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// GetAgentPerformance gets agent performance metrics (GET /api/v1/agents/:agentId/performance)
func (h *AgentHandler) GetAgentPerformance(c *gin.Context) {
	agentId := c.Param("agentId")
	if agentId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Agent ID is required",
			},
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	performance, err := h.services.Agent.GetAgentPerformance(ctx, agentId)
	if err != nil {
		h.logger.Error("Failed to get agent performance",
			zap.Error(err),
			zap.String("agent_id", agentId))

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AGENT_PERFORMANCE_ERROR",
				"message": "Failed to retrieve agent performance",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    performance,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// SyncAgentRegistry syncs the agent registry (POST /api/v1/agents/registry/sync)
func (h *AgentHandler) SyncAgentRegistry(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := h.services.Agent.SyncRegistry(ctx)
	if err != nil {
		h.logger.Error("Failed to sync agent registry", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "REGISTRY_SYNC_ERROR",
				"message": "Failed to sync agent registry",
			},
		})
		return
	}

	h.logger.Info("Agent registry synced successfully", zap.Any("result", result))

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

// BulkUpdateAgents updates multiple agents (POST /api/v1/agents/bulk-update)
func (h *AgentHandler) BulkUpdateAgents(c *gin.Context) {
	var req models.BulkUpdateAgentsRequest
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

	result, err := h.services.Agent.BulkUpdateAgents(ctx, &req)
	if err != nil {
		h.logger.Error("Failed to bulk update agents", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "BULK_UPDATE_ERROR",
				"message": "Failed to update agents",
			},
		})
		return
	}

	h.logger.Info("Bulk agent update completed",
		zap.Int("updated_count", result.UpdatedCount),
		zap.Int("failed_count", result.FailedCount))

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

// Helper function to get recommended agent based on current load and performance
func (h *AgentHandler) getRecommendedAgent(agents []models.Agent) *models.Agent {
	if len(agents) == 0 {
		return nil
	}

	// Simple load-based recommendation
	var recommended *models.Agent
	lowestLoad := float64(1.0)

	for i := range agents {
		if agents[i].Status == "active" && agents[i].CurrentLoad < lowestLoad {
			lowestLoad = agents[i].CurrentLoad
			recommended = &agents[i]
		}
	}

	return recommended
}
