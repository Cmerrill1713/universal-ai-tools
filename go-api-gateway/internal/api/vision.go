// Vision API endpoints for Universal AI Tools
// Integrates with Rust vision-bridge service for image analysis, generation, and reasoning

package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/models"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// VisionHandler handles vision-related requests
type VisionHandler struct {
	config       interface{} // Configuration interface
	logger       *zap.Logger
	visionService *services.VisionService
}

// NewVisionHandler creates a new vision handler
func NewVisionHandler(config interface{}, logger *zap.Logger, visionService *services.VisionService) *VisionHandler {
	return &VisionHandler{
		config:       config,
		logger:       logger,
		visionService: visionService,
	}
}

// RegisterRoutes registers vision API routes
func (h *VisionHandler) RegisterRoutes(router *gin.RouterGroup) {
	vision := router.Group("/vision")
	{
		// Core vision endpoints
		vision.POST("/analyze", h.AnalyzeImage)
		vision.POST("/analyze/", h.AnalyzeImage)
		vision.POST("/embedding", h.GetEmbedding)
		vision.POST("/embedding/", h.GetEmbedding)
		
		// Image generation endpoints
		vision.POST("/generate", h.GenerateImage)
		vision.POST("/generate/", h.GenerateImage)
		vision.POST("/refine", h.RefineImage)
		vision.POST("/refine/", h.RefineImage)
		
		// Visual reasoning endpoint
		vision.POST("/reason", h.ReasonAboutImage)
		vision.POST("/reason/", h.ReasonAboutImage)
		
		// Service management endpoints
		vision.GET("/stats", h.GetStats)
		vision.GET("/health", h.GetHealth)
	}
	
	h.logger.Info("Vision API routes registered")
}

// AnalyzeImage analyzes an uploaded image for objects, scene, and text
// @Summary Analyze image content
// @Description Analyze an image to detect objects, understand the scene, and optionally extract text (OCR)
// @Tags vision
// @Accept multipart/form-data
// @Accept json
// @Produce json
// @Param image formData file false "Image file to analyze"
// @Param image_base64 formData string false "Base64 encoded image"
// @Param image_url formData string false "URL to image"
// @Param options formData string false "JSON string with vision options"
// @Success 200 {object} models.VisionResponse
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/vision/analyze [post]
func (h *VisionHandler) AnalyzeImage(c *gin.Context) {
	startTime := time.Now()
	requestID := generateVisionRequestID()
	
	h.logger.Debug("Vision analyze request received", 
		zap.String("request_id", requestID),
		zap.String("client_ip", c.ClientIP()))

	// Parse the request
	visionReq, err := h.parseVisionRequest(c)
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error(), requestID)
		return
	}

	// Set default options if not provided
	if visionReq.Options == (models.VisionOptions{}) {
		visionReq.Options = models.DefaultVisionOptions()
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Call vision service
	response, err := h.visionService.AnalyzeImage(ctx, visionReq)
	if err != nil {
		h.logger.Error("Failed to analyze image", 
			zap.Error(err),
			zap.String("request_id", requestID))
		
		h.respondWithError(c, http.StatusInternalServerError, "failed to analyze image", requestID)
		return
	}

	// Update response metadata
	response.Metadata.RequestID = requestID
	response.Metadata.FetchTime = time.Since(startTime).String()
	response.Metadata.Timestamp = time.Now()

	h.logger.Info("Vision analyze request completed", 
		zap.String("request_id", requestID),
		zap.Bool("cache_hit", response.Cached),
		zap.Duration("duration", time.Since(startTime)))

	c.JSON(http.StatusOK, response)
}

// GenerateImage generates an image from a text prompt
// @Summary Generate image from prompt
// @Description Generate an image using AI based on a text prompt with optional parameters
// @Tags vision
// @Accept json
// @Produce json
// @Param request body object false "Generation request with prompt and parameters"
// @Success 200 {object} models.VisionResponse
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/vision/generate [post]
func (h *VisionHandler) GenerateImage(c *gin.Context) {
	startTime := time.Now()
	requestID := generateVisionRequestID()
	
	h.logger.Debug("Vision generate request received", 
		zap.String("request_id", requestID),
		zap.String("client_ip", c.ClientIP()))

	// Parse JSON request
	var req struct {
		Prompt     string                        `json:"prompt" binding:"required"`
		Parameters *models.GenerationParameters `json:"parameters,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, "invalid request body", requestID)
		return
	}

	// Set default parameters if not provided
	if req.Parameters == nil {
		defaultParams := models.DefaultGenerationParameters()
		req.Parameters = &defaultParams
	}

	// Create context with longer timeout for generation
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Call vision service
	response, err := h.visionService.GenerateImage(ctx, req.Prompt, req.Parameters)
	if err != nil {
		h.logger.Error("Failed to generate image", 
			zap.Error(err),
			zap.String("request_id", requestID),
			zap.String("prompt", req.Prompt))
		
		h.respondWithError(c, http.StatusInternalServerError, "failed to generate image", requestID)
		return
	}

	// Update response metadata
	response.Metadata.RequestID = requestID
	response.Metadata.FetchTime = time.Since(startTime).String()
	response.Metadata.Timestamp = time.Now()

	h.logger.Info("Vision generate request completed", 
		zap.String("request_id", requestID),
		zap.String("prompt", req.Prompt),
		zap.Duration("duration", time.Since(startTime)))

	c.JSON(http.StatusOK, response)
}

// RefineImage refines/enhances an uploaded image
// @Summary Refine image quality
// @Description Refine or enhance an image using AI-based image processing
// @Tags vision
// @Accept multipart/form-data
// @Produce json
// @Param image formData file true "Image file to refine"
// @Param parameters formData string false "JSON string with refinement parameters"
// @Success 200 {object} models.VisionResponse
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/vision/refine [post]
func (h *VisionHandler) RefineImage(c *gin.Context) {
	startTime := time.Now()
	requestID := generateVisionRequestID()
	
	h.logger.Debug("Vision refine request received", 
		zap.String("request_id", requestID),
		zap.String("client_ip", c.ClientIP()))

	// Get image data
	imageData, err := h.getImageFromRequest(c)
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error(), requestID)
		return
	}

	// Parse parameters
	var params *models.RefinementParameters
	if paramsStr := c.PostForm("parameters"); paramsStr != "" {
		if err := json.Unmarshal([]byte(paramsStr), &params); err != nil {
			h.respondWithError(c, http.StatusBadRequest, "invalid parameters", requestID)
			return
		}
	}

	// Set default parameters if not provided
	if params == nil {
		defaultParams := models.DefaultRefinementParameters()
		params = &defaultParams
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	// Call vision service
	response, err := h.visionService.RefineImage(ctx, imageData, params)
	if err != nil {
		h.logger.Error("Failed to refine image", 
			zap.Error(err),
			zap.String("request_id", requestID))
		
		h.respondWithError(c, http.StatusInternalServerError, "failed to refine image", requestID)
		return
	}

	// Update response metadata
	response.Metadata.RequestID = requestID
	response.Metadata.FetchTime = time.Since(startTime).String()
	response.Metadata.Timestamp = time.Now()

	h.logger.Info("Vision refine request completed", 
		zap.String("request_id", requestID),
		zap.Duration("duration", time.Since(startTime)))

	c.JSON(http.StatusOK, response)
}

// ReasonAboutImage performs visual reasoning on an image
// @Summary Visual reasoning about image
// @Description Ask questions about an image and get AI-powered visual reasoning responses
// @Tags vision
// @Accept multipart/form-data
// @Produce json
// @Param image formData file true "Image file to reason about"
// @Param question formData string true "Question to ask about the image"
// @Success 200 {object} models.VisionResponse
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/vision/reason [post]
func (h *VisionHandler) ReasonAboutImage(c *gin.Context) {
	startTime := time.Now()
	requestID := generateVisionRequestID()
	
	h.logger.Debug("Vision reasoning request received", 
		zap.String("request_id", requestID),
		zap.String("client_ip", c.ClientIP()))

	// Get image data
	imageData, err := h.getImageFromRequest(c)
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error(), requestID)
		return
	}

	// Get question
	question := c.PostForm("question")
	if question == "" {
		h.respondWithError(c, http.StatusBadRequest, "question is required", requestID)
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Call vision service
	response, err := h.visionService.ReasonAboutImage(ctx, imageData, question)
	if err != nil {
		h.logger.Error("Failed to reason about image", 
			zap.Error(err),
			zap.String("request_id", requestID),
			zap.String("question", question))
		
		h.respondWithError(c, http.StatusInternalServerError, "failed to reason about image", requestID)
		return
	}

	// Update response metadata
	response.Metadata.RequestID = requestID
	response.Metadata.FetchTime = time.Since(startTime).String()
	response.Metadata.Timestamp = time.Now()

	h.logger.Info("Vision reasoning request completed", 
		zap.String("request_id", requestID),
		zap.String("question", question),
		zap.Duration("duration", time.Since(startTime)))

	c.JSON(http.StatusOK, response)
}

// GetEmbedding generates an embedding vector for an image
// @Summary Generate image embedding
// @Description Generate a vector embedding for an image that can be used for similarity search
// @Tags vision
// @Accept multipart/form-data
// @Produce json
// @Param image formData file true "Image file to generate embedding for"
// @Success 200 {object} models.VisionResponse
// @Failure 400 {object} gin.H
// @Failure 500 {object} gin.H
// @Router /api/v1/vision/embedding [post]
func (h *VisionHandler) GetEmbedding(c *gin.Context) {
	startTime := time.Now()
	requestID := generateVisionRequestID()
	
	h.logger.Debug("Vision embedding request received", 
		zap.String("request_id", requestID),
		zap.String("client_ip", c.ClientIP()))

	// Get image data
	imageData, err := h.getImageFromRequest(c)
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, err.Error(), requestID)
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Call vision service
	response, err := h.visionService.GetEmbedding(ctx, imageData)
	if err != nil {
		h.logger.Error("Failed to generate embedding", 
			zap.Error(err),
			zap.String("request_id", requestID))
		
		h.respondWithError(c, http.StatusInternalServerError, "failed to generate embedding", requestID)
		return
	}

	// Update response metadata
	response.Metadata.RequestID = requestID
	response.Metadata.FetchTime = time.Since(startTime).String()
	response.Metadata.Timestamp = time.Now()

	h.logger.Info("Vision embedding request completed", 
		zap.String("request_id", requestID),
		zap.Duration("duration", time.Since(startTime)))

	c.JSON(http.StatusOK, response)
}

// GetStats returns vision service statistics
// @Summary Get vision service statistics
// @Description Retrieve vision service statistics including performance metrics and health status
// @Tags vision
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Router /api/v1/vision/stats [get]
func (h *VisionHandler) GetStats(c *gin.Context) {
	stats := h.visionService.GetVisionStats()

	response := gin.H{
		"success": true,
		"data":    stats,
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"requestId":      generateVisionRequestID(),
			"implementation": "go-api-gateway",
			"version":        "1.0.0",
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetHealth returns vision service health status
// @Summary Get vision service health
// @Description Check the health status of the vision service and its components
// @Tags vision
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Failure 503 {object} gin.H
// @Router /api/v1/vision/health [get]
func (h *VisionHandler) GetHealth(c *gin.Context) {
	stats := h.visionService.GetVisionStats()
	
	healthy := stats.RustServiceUp
	status := "healthy"
	if !healthy {
		status = "unhealthy"
	}

	response := gin.H{
		"success": healthy,
		"status":  status,
		"data": gin.H{
			"rust_service":    stats.RustServiceUp,
			"python_bridge":   stats.PythonBridgeUp,
			"models_loaded":   stats.ModelsLoaded,
			"requests_total":  stats.RequestsTotal,
			"success_rate":    float32(stats.RequestsSuccessful) / float32(max(stats.RequestsTotal, 1)),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"requestId":      generateVisionRequestID(),
			"implementation": "go-api-gateway",
			"version":        "1.0.0",
		},
	}

	statusCode := http.StatusOK
	if !healthy {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, response)
}

// Helper functions

func (h *VisionHandler) parseVisionRequest(c *gin.Context) (*models.VisionRequest, error) {
	req := &models.VisionRequest{}

	// Try to get image data in various formats
	imageData, err := h.getImageFromRequest(c)
	if err != nil {
		return nil, err
	}
	req.ImageData = imageData

	// Parse options if provided
	if optionsStr := c.PostForm("options"); optionsStr != "" {
		var options models.VisionOptions
		if err := json.Unmarshal([]byte(optionsStr), &options); err != nil {
			return nil, fmt.Errorf("invalid options: %w", err)
		}
		req.Options = options
	}

	return req, nil
}

func (h *VisionHandler) getImageFromRequest(c *gin.Context) ([]byte, error) {
	// Try multipart file first
	file, _, err := c.Request.FormFile("image")
	if err == nil {
		defer file.Close()
		return io.ReadAll(file)
	}

	// Try base64 encoded image
	if base64Str := c.PostForm("image_base64"); base64Str != "" {
		return base64.StdEncoding.DecodeString(base64Str)
	}

	// Try JSON body for base64
	var jsonBody struct {
		ImageBase64 string `json:"image_base64"`
		ImageData   []byte `json:"image_data"`
	}
	if err := c.ShouldBindJSON(&jsonBody); err == nil {
		if len(jsonBody.ImageData) > 0 {
			return jsonBody.ImageData, nil
		}
		if jsonBody.ImageBase64 != "" {
			return base64.StdEncoding.DecodeString(jsonBody.ImageBase64)
		}
	}

	return nil, fmt.Errorf("no image data provided")
}

func (h *VisionHandler) respondWithError(c *gin.Context, statusCode int, message string, requestID string) {
	h.logger.Error("Vision API error", 
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

func generateVisionRequestID() string {
	return "vision_" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}