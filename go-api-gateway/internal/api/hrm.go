// HRM API Handler
// Provides HTTP endpoints for Hierarchical Reasoning Model operations

package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// HRMHandler handles HRM-related HTTP requests
type HRMHandler struct {
	config     *config.Config
	logger     *zap.Logger
	hrmService *services.HRMService
}

// NewHRMHandler creates a new HRM API handler
func NewHRMHandler(config *config.Config, logger *zap.Logger, hrmService *services.HRMService) *HRMHandler {
	return &HRMHandler{
		config:     config,
		logger:     logger,
		hrmService: hrmService,
	}
}

// RegisterRoutes registers HRM routes
func (h *HRMHandler) RegisterRoutes(router *gin.RouterGroup) {
	hrm := router.Group("/hrm")
	{
		// Health and info endpoints
		hrm.GET("/health", h.GetHealth)
		hrm.GET("/model/info", h.GetModelInfo)
		
		// Generic reasoning endpoint
		hrm.POST("/reasoning", h.PerformReasoning)
		
		// Task-specific endpoints
		hrm.POST("/reasoning/sudoku", h.SolveSudoku)
		hrm.POST("/reasoning/maze", h.SolveMaze)
		hrm.POST("/reasoning/arc", h.SolveARC)
		hrm.POST("/reasoning/planning", h.PerformPlanning)
		
		// Hybrid reasoning endpoints for LLM enhancement
		hrm.POST("/reasoning/llm-enhancement", h.EnhanceLLMPrompt)
		hrm.POST("/reasoning/generic", h.PerformGenericReasoning)
	}

	h.logger.Info("HRM routes registered",
		zap.String("base_path", "/api/v1/hrm"))
}

// GetHealth godoc
// @Summary Get HRM service health
// @Description Check the health status of the HRM-MLX service
// @Tags HRM
// @Produce json
// @Success 200 {object} services.HRMHealthResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/health [get]
func (h *HRMHandler) GetHealth(c *gin.Context) {
	health, err := h.hrmService.Health(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to get HRM health", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "HRM service health check failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, health)
}

// GetModelInfo godoc
// @Summary Get HRM model information
// @Description Retrieve information about the loaded HRM model
// @Tags HRM
// @Produce json
// @Success 200 {object} services.HRMModelInfo
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/model/info [get]
func (h *HRMHandler) GetModelInfo(c *gin.Context) {
	modelInfo, err := h.hrmService.GetModelInfo(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to get HRM model info", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to retrieve model information",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, modelInfo)
}

// PerformReasoning godoc
// @Summary Perform hierarchical reasoning
// @Description Execute hierarchical reasoning on a given task
// @Tags HRM
// @Accept json
// @Produce json
// @Param request body services.HRMReasoningRequest true "Reasoning request"
// @Success 200 {object} services.HRMReasoningResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/reasoning [post]
func (h *HRMHandler) PerformReasoning(c *gin.Context) {
	var req services.HRMReasoningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid reasoning request",
			"details": err.Error(),
		})
		return
	}

	response, err := h.hrmService.PerformReasoning(c.Request.Context(), &req)
	if err != nil {
		h.logger.Error("Failed to perform reasoning",
			zap.Error(err),
			zap.String("task_type", req.TaskType))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Reasoning failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// SudokuRequest represents a Sudoku solving request
type SudokuRequest struct {
	Puzzle [][]int `json:"puzzle" binding:"required"`
}

// SolveSudoku godoc
// @Summary Solve Sudoku puzzle
// @Description Solve a Sudoku puzzle using hierarchical reasoning
// @Tags HRM
// @Accept json
// @Produce json
// @Param request body SudokuRequest true "Sudoku puzzle"
// @Success 200 {object} services.HRMReasoningResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/reasoning/sudoku [post]
func (h *HRMHandler) SolveSudoku(c *gin.Context) {
	var req SudokuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid Sudoku request",
			"details": err.Error(),
		})
		return
	}

	// Validate puzzle dimensions
	if len(req.Puzzle) != 9 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid Sudoku puzzle: must have 9 rows",
		})
		return
	}

	for i, row := range req.Puzzle {
		if len(row) != 9 {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error":   "Invalid Sudoku puzzle: row " + strconv.Itoa(i) + " must have 9 columns",
			})
			return
		}
	}

	response, err := h.hrmService.SolveSudoku(c.Request.Context(), req.Puzzle)
	if err != nil {
		h.logger.Error("Failed to solve Sudoku", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Sudoku solving failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// MazeRequest represents a maze solving request
type MazeRequest struct {
	Maze  [][]int `json:"maze" binding:"required"`
	Start []int   `json:"start" binding:"required"`
	Goal  []int   `json:"goal" binding:"required"`
}

// SolveMaze godoc
// @Summary Solve maze navigation
// @Description Solve a maze navigation problem using hierarchical planning
// @Tags HRM
// @Accept json
// @Produce json
// @Param request body MazeRequest true "Maze navigation request"
// @Success 200 {object} services.HRMReasoningResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/reasoning/maze [post]
func (h *HRMHandler) SolveMaze(c *gin.Context) {
	var req MazeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid maze request",
			"details": err.Error(),
		})
		return
	}

	// Validate start and goal positions
	if len(req.Start) != 2 || len(req.Goal) != 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": "Invalid maze request: start and goal must have exactly 2 coordinates [x, y]",
		})
		return
	}

	response, err := h.hrmService.SolveMaze(c.Request.Context(), req.Maze, req.Start, req.Goal)
	if err != nil {
		h.logger.Error("Failed to solve maze", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Maze solving failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// ARCRequest represents an ARC task request
type ARCRequest struct {
	Train []interface{} `json:"train" binding:"required"`
	Test  interface{}   `json:"test" binding:"required"`
}

// SolveARC godoc
// @Summary Solve ARC task
// @Description Solve an ARC (Abstraction and Reasoning Corpus) task
// @Tags HRM
// @Accept json
// @Produce json
// @Param request body ARCRequest true "ARC task request"
// @Success 200 {object} services.HRMReasoningResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/reasoning/arc [post]
func (h *HRMHandler) SolveARC(c *gin.Context) {
	var req ARCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid ARC request",
			"details": err.Error(),
		})
		return
	}

	response, err := h.hrmService.SolveARC(c.Request.Context(), req.Train, req.Test)
	if err != nil {
		h.logger.Error("Failed to solve ARC task", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "ARC task solving failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// PlanningRequest represents a planning task request
type PlanningRequest struct {
	Goal        string                 `json:"goal" binding:"required"`
	Constraints []string               `json:"constraints"`
	Resources   map[string]interface{} `json:"resources"`
}

// PerformPlanning godoc
// @Summary Perform multi-step planning
// @Description Execute multi-step strategic planning and problem solving
// @Tags HRM
// @Accept json
// @Produce json
// @Param request body PlanningRequest true "Planning task request"
// @Success 200 {object} services.HRMReasoningResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/reasoning/planning [post]
func (h *HRMHandler) PerformPlanning(c *gin.Context) {
	var req PlanningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid planning request",
			"details": err.Error(),
		})
		return
	}

	response, err := h.hrmService.PerformPlanning(c.Request.Context(), req.Goal, req.Constraints, req.Resources)
	if err != nil {
		h.logger.Error("Failed to perform planning", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Planning failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// LLMEnhancementRequest represents a request to enhance LLM prompts
type LLMEnhancementRequest struct {
	Query      string `json:"query" binding:"required"`
	Context    string `json:"context"`
	Complexity string `json:"complexity"`
}

// EnhanceLLMPrompt godoc
// @Summary Enhance LLM prompts with hierarchical reasoning
// @Description Use HRM to structure and enhance LLM prompts with systematic reasoning guidance
// @Tags HRM
// @Accept json
// @Produce json
// @Param request body LLMEnhancementRequest true "LLM enhancement request"
// @Success 200 {object} services.HRMReasoningResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/reasoning/llm-enhancement [post]
func (h *HRMHandler) EnhanceLLMPrompt(c *gin.Context) {
	var req LLMEnhancementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid LLM enhancement request",
			"details": err.Error(),
		})
		return
	}

	response, err := h.hrmService.EnhanceLLMPrompt(c.Request.Context(), req.Query, req.Context, req.Complexity)
	if err != nil {
		h.logger.Error("Failed to enhance LLM prompt", 
			zap.Error(err),
			zap.String("query", req.Query))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "LLM prompt enhancement failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GenericReasoningRequest represents a generic reasoning request
type GenericReasoningRequest struct {
	Problem             string                 `json:"problem" binding:"required"`
	Constraints         []string               `json:"constraints"`
	AvailableResources  map[string]interface{} `json:"available_resources"`
}

// PerformGenericReasoning godoc
// @Summary Perform generic hierarchical reasoning
// @Description Execute hierarchical reasoning on general problem-solving tasks
// @Tags HRM
// @Accept json
// @Produce json
// @Param request body GenericReasoningRequest true "Generic reasoning request"
// @Success 200 {object} services.HRMReasoningResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/hrm/reasoning/generic [post]
func (h *HRMHandler) PerformGenericReasoning(c *gin.Context) {
	var req GenericReasoningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid generic reasoning request",
			"details": err.Error(),
		})
		return
	}

	response, err := h.hrmService.PerformGenericReasoning(c.Request.Context(), req.Problem, req.Constraints, req.AvailableResources)
	if err != nil {
		h.logger.Error("Failed to perform generic reasoning", 
			zap.Error(err),
			zap.String("problem", req.Problem))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Generic reasoning failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}