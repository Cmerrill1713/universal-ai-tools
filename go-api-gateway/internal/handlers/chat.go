package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"universal-ai-tools/go-api-gateway/internal/database"
)

type ChatHandler struct {
	coordinator *database.DatabaseCoordinator
	logger      *zap.Logger
}

type ChatRequest struct {
	Message        string                 `json:"message" binding:"required"`
	Model          string                 `json:"model"`
	Provider       string                 `json:"provider"`
	Temperature    float32                `json:"temperature"`
	MaxTokens      int                    `json:"max_tokens"`
	Stream         bool                   `json:"stream"`
	Context        map[string]interface{} `json:"context"`
	ConversationID string                 `json:"conversation_id"`
}

type ChatResponse struct {
	ID             string                 `json:"id"`
	Message        string                 `json:"message"`
	Model          string                 `json:"model"`
	Provider       string                 `json:"provider"`
	ConversationID string                 `json:"conversation_id"`
	Usage          Usage                  `json:"usage"`
	ResponseTime   int64                  `json:"response_time_ms"`
	Context        map[string]interface{} `json:"context,omitempty"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

func NewChatHandler(coordinator *database.DatabaseCoordinator, logger *zap.Logger) *ChatHandler {
	return &ChatHandler{
		coordinator: coordinator,
		logger:      logger,
	}
}

func (h *ChatHandler) Chat(c *gin.Context) {
	startTime := time.Now()

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Set defaults
	if req.Model == "" {
		req.Model = "gpt-4o-mini"
	}
	if req.Provider == "" {
		req.Provider = "openai"
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 1000
	}
	if req.ConversationID == "" {
		req.ConversationID = uuid.New().String()
	}

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	ctx := context.Background()

	// Store context in Supabase using coordinator
	contextData := database.ContextData{
		UserID:   userID,
		Category: "conversation",
		Source:   "go-api-gateway",
		Content: map[string]interface{}{
			"message":         req.Message,
			"model":           req.Model,
			"provider":        req.Provider,
			"conversation_id": req.ConversationID,
		},
		Metadata: map[string]interface{}{
			"temperature": req.Temperature,
			"max_tokens":  req.MaxTokens,
			"stream":      req.Stream,
		},
		CreatedAt: time.Now(),
	}

	if err := h.coordinator.StoreContext(ctx, contextData); err != nil {
		h.logger.Warn("Failed to store context", zap.Error(err))
	}

	// Retrieve relevant context from Supabase
	relevantContexts, err := h.coordinator.RetrieveContext(ctx, userID, "conversation", 5)
	if err != nil {
		h.logger.Warn("Failed to retrieve context", zap.Error(err))
	}

	// Check cache first using coordinator
	var cachedResponse *ChatResponse
	cacheKey := fmt.Sprintf("chat:%s:%s", userID, req.Message)
	if err := h.coordinator.CacheGet(ctx, cacheKey, &cachedResponse); err == nil {
		cachedResponse.ResponseTime = time.Since(startTime).Milliseconds()
		c.JSON(http.StatusOK, cachedResponse)
		return
	}

	// Forward to LLM Router service (Rust)
	response, err := h.callLLMRouter(ctx, req, relevantContexts)
	if err != nil {
		h.logger.Error("Failed to call LLM router", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to process chat request",
		})
		return
	}

	// Store conversation response in Supabase
	responseContextData := database.ContextData{
		UserID:   userID,
		Category: "conversation_response",
		Source:   "go-api-gateway",
		Content: map[string]interface{}{
			"response_id":     response.ID,
			"message":         response.Message,
			"conversation_id": response.ConversationID,
			"usage":           response.Usage,
		},
		Metadata: map[string]interface{}{
			"model":         response.Model,
			"provider":      response.Provider,
			"response_time": response.ResponseTime,
		},
		CreatedAt: time.Now(),
	}

	if err := h.coordinator.StoreContext(ctx, responseContextData); err != nil {
		h.logger.Warn("Failed to store conversation response", zap.Error(err))
	}

	// Cache response using coordinator
	if err := h.coordinator.CacheSet(ctx, cacheKey, response, 5*time.Minute); err != nil {
		h.logger.Warn("Failed to cache response", zap.Error(err))
	}

	response.ResponseTime = time.Since(startTime).Milliseconds()
	c.JSON(http.StatusOK, response)
}

func (h *ChatHandler) StreamChat(c *gin.Context) {
	// SSE implementation for streaming responses
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.SSEvent("error", gin.H{"error": "Invalid request"})
		return
	}

	req.Stream = true
	// Implementation would stream tokens from LLM router
	// For now, send a simple response
	c.SSEvent("message", gin.H{
		"content": "Streaming is being implemented",
		"done":    false,
	})
	c.SSEvent("done", gin.H{"done": true})
}

func (h *ChatHandler) GetHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	conversationID := c.Query("conversation_id")
	limit := 50 // Default limit

	ctx := context.Background()

	// Use coordinator to retrieve conversation history
	contexts, err := h.coordinator.RetrieveContext(ctx, userID, "conversation_response", limit)
	if err != nil {
		h.logger.Error("Failed to get chat history", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve chat history",
		})
		return
	}

	// Convert contexts to history format
	var history []map[string]interface{}
	for _, context := range contexts {
		// Filter by conversation ID if specified
		if conversationID != "" {
			if convID, ok := context.Content["conversation_id"].(string); !ok || convID != conversationID {
				continue
			}
		}

		history = append(history, map[string]interface{}{
			"id":              context.Content["response_id"],
			"user_id":         context.UserID,
			"conversation_id": context.Content["conversation_id"],
			"message":         context.Content["message"],
			"model":           context.Metadata["model"],
			"provider":        context.Metadata["provider"],
			"created_at":      context.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"history": history,
		"count":   len(history),
	})
}

func (h *ChatHandler) callLLMRouter(ctx context.Context, req ChatRequest, contexts []database.ContextData) (*ChatResponse, error) {
	// This would call the Rust LLM Router service
	// For now, return a mock response
	response := &ChatResponse{
		ID:             uuid.New().String(),
		Message:        fmt.Sprintf("Processing: %s", req.Message),
		Model:          req.Model,
		Provider:       req.Provider,
		ConversationID: req.ConversationID,
		Usage: Usage{
			PromptTokens:     100,
			CompletionTokens: 150,
			TotalTokens:      250,
		},
		Context: map[string]interface{}{
			"relevant_contexts": contexts,
		},
	}

	// In production, this would make an HTTP/gRPC call to the Rust service
	// client := &http.Client{Timeout: 30 * time.Second}
	// resp, err := client.Post("http://localhost:8003/api/chat", "application/json", ...)

	return response, nil
}
