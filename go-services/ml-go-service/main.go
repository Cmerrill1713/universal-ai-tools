package main

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// MLGoService provides ML inference capabilities in Go
type MLGoService struct {
	logger *zap.Logger
	port   int
}

// InferenceRequest represents a request for ML inference
type InferenceRequest struct {
	Model     string                 `json:"model"`
	Input     map[string]interface{} `json:"input"`
	Options   map[string]interface{} `json:"options,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
}

// InferenceResponse represents the response from ML inference
type InferenceResponse struct {
	Success   bool                   `json:"success"`
	Result    map[string]interface{} `json:"result,omitempty"`
	Error     string                 `json:"error,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
	Duration  string                 `json:"duration"`
	Model     string                 `json:"model"`
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Service   string    `json:"service"`
	Version   string    `json:"version"`
	Uptime    string    `json:"uptime"`
}

var startTime = time.Now()

// NewMLGoService creates a new ML Go service instance
func NewMLGoService(port int) *MLGoService {
	logger, _ := zap.NewProduction()
	return &MLGoService{
		logger: logger,
		port:   port,
	}
}

// Run starts the ML Go service
func (mgs *MLGoService) Run() error {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	
	// Middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(mgs.corsMiddleware())

	// Routes
	router.GET("/health", mgs.healthCheck)
	router.POST("/inference", mgs.handleInference)
	router.POST("/predict", mgs.handleInference) // Alias for inference
	router.GET("/models", mgs.listModels)
	router.GET("/metrics", mgs.getMetrics)

	mgs.logger.Info("Starting ML Go Service", zap.Int("port", mgs.port))
	
	return router.Run(fmt.Sprintf(":%d", mgs.port))
}

// corsMiddleware adds CORS headers
func (mgs *MLGoService) corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Requested-With")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		
		c.Next()
	}
}

// healthCheck handles health check requests
func (mgs *MLGoService) healthCheck(c *gin.Context) {
	uptime := time.Since(startTime)
	
	response := HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now(),
		Service:   "ml-go-service",
		Version:   "1.0.0",
		Uptime:    uptime.String(),
	}
	
	c.JSON(http.StatusOK, response)
}

// handleInference handles ML inference requests
func (mgs *MLGoService) handleInference(c *gin.Context) {
	startTime := time.Now()
	
	var req InferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		mgs.logger.Error("Invalid request", zap.Error(err))
		c.JSON(http.StatusBadRequest, InferenceResponse{
			Success: false,
			Error:   fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}
	
	// Validate request
	if req.Model == "" {
		c.JSON(http.StatusBadRequest, InferenceResponse{
			Success: false,
			Error:   "Model is required",
		})
		return
	}
	
	if req.Input == nil {
		c.JSON(http.StatusBadRequest, InferenceResponse{
			Success: false,
			Error:   "Input data is required",
		})
		return
	}
	
	// Simulate ML inference (in a real implementation, this would call actual ML models)
	result := mgs.performInference(req)
	duration := time.Since(startTime)
	
	response := InferenceResponse{
		Success:   true,
		Result:    result,
		RequestID: req.RequestID,
		Duration:  duration.String(),
		Model:     req.Model,
	}
	
	mgs.logger.Info("Inference completed", 
		zap.String("model", req.Model),
		zap.String("duration", duration.String()),
		zap.String("request_id", req.RequestID))
	
	c.JSON(http.StatusOK, response)
}

// performInference simulates ML inference
func (mgs *MLGoService) performInference(req InferenceRequest) map[string]interface{} {
	// Simulate processing time
	time.Sleep(100 * time.Millisecond)
	
	// Mock inference result based on model type
	result := make(map[string]interface{})
	
	switch req.Model {
	case "text-classification":
		result["predictions"] = []map[string]interface{}{
			{"label": "positive", "score": 0.85},
			{"label": "negative", "score": 0.15},
		}
	case "sentiment-analysis":
		result["sentiment"] = "positive"
		result["confidence"] = 0.87
	case "text-generation":
		result["generated_text"] = "This is a generated response based on the input."
		result["tokens"] = 15
	case "image-classification":
		result["predictions"] = []map[string]interface{}{
			{"label": "cat", "score": 0.92},
			{"label": "dog", "score": 0.08},
		}
	default:
		result["prediction"] = "unknown"
		result["confidence"] = 0.5
	}
	
	// Add metadata
	result["model_used"] = req.Model
	result["input_size"] = len(req.Input)
	result["processing_time_ms"] = 100
	
	return result
}

// listModels returns available models
func (mgs *MLGoService) listModels(c *gin.Context) {
	models := map[string]interface{}{
		"models": []map[string]interface{}{
			{
				"name":        "text-classification",
				"type":        "classification",
				"description": "Text classification model",
				"status":      "available",
			},
			{
				"name":        "sentiment-analysis",
				"type":        "analysis",
				"description": "Sentiment analysis model",
				"status":      "available",
			},
			{
				"name":        "text-generation",
				"type":        "generation",
				"description": "Text generation model",
				"status":      "available",
			},
			{
				"name":        "image-classification",
				"type":        "classification",
				"description": "Image classification model",
				"status":      "available",
			},
		},
		"total": 4,
	}
	
	c.JSON(http.StatusOK, models)
}

// getMetrics returns service metrics
func (mgs *MLGoService) getMetrics(c *gin.Context) {
	uptime := time.Since(startTime)
	
	metrics := map[string]interface{}{
		"service":     "ml-go-service",
		"uptime":      uptime.String(),
		"uptime_sec":  uptime.Seconds(),
		"status":      "healthy",
		"timestamp":   time.Now(),
		"version":     "1.0.0",
		"port":        mgs.port,
	}
	
	c.JSON(http.StatusOK, metrics)
}

func main() {
	port := 8086
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil {
			port = p
		}
	}
	
	service := NewMLGoService(port)
	if err := service.Run(); err != nil {
		fmt.Printf("Failed to start ML Go service: %v\n", err)
		os.Exit(1)
	}
}
