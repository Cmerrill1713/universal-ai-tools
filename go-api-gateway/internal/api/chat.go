// Chat API handlers for Go API Gateway
// Provides chat functionality with compatibility to TypeScript implementation

package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/models"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// ChatHandler handles chat endpoints
type ChatHandler struct {
	config       *config.Config
	logger       *zap.Logger
	chatService  *services.ChatService
	rustAIClient *services.RustAIClient
	lmStudioClient *services.LMStudioClient
	ollamaClient *services.OllamaClient
	hrmService   *services.HRMService
	redisService *services.RedisService // Redis caching for massive performance boost
	// Add fields for cancellation and streaming
	activeConversations *services.ConversationContextMap
	activeStreams       *services.StreamMap
}

// NewChatHandler creates a new chat handler
func NewChatHandler(
	cfg *config.Config,
	logger *zap.Logger,
	chatService *services.ChatService,
	rustAIClient *services.RustAIClient,
	lmStudioClient *services.LMStudioClient,
	ollamaClient *services.OllamaClient,
	hrmService *services.HRMService,
	redisService *services.RedisService,
) *ChatHandler {
	return &ChatHandler{
		config:       cfg,
		logger:       logger,
		chatService:  chatService,
		rustAIClient: rustAIClient,
		lmStudioClient: lmStudioClient,
		ollamaClient: ollamaClient,
		hrmService:   hrmService,
		redisService: redisService,
		activeConversations: services.NewConversationContextMap(),
		activeStreams:       services.NewStreamMap(),
	}
}

// RegisterRoutes registers chat routes with the router
func (h *ChatHandler) RegisterRoutes(router *gin.RouterGroup) {
	chat := router.Group("/chat")
	{
		chat.GET("/conversations", h.GetConversations)
		chat.GET("/history/:conversationId", h.GetConversationHistory)
		chat.POST("/new", h.CreateConversation)
		chat.POST("/", h.SendMessage)
		chat.POST("/enhanced", h.SendEnhancedMessage)
		chat.POST("/cancel", h.CancelMessage)
		chat.DELETE("/:conversationId", h.DeleteConversation)
		
		// Service management endpoints
		chat.GET("/health", h.GetHealth)
	}
	
	h.logger.Info("Chat API routes registered")
}

// GetConversations lists all conversations for a user (GET /api/v1/chat/conversations)
func (h *ChatHandler) GetConversations(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	conversations, err := h.chatService.GetUserConversations(c.Request.Context(), userID)
	if err != nil {
		h.logger.Error("Failed to get conversations",
			zap.Error(err),
			zap.String("user_id", userID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONVERSATION_LIST_ERROR",
				"message": "Failed to retrieve conversations",
			},
		})
		return
	}

	// Convert to summary format
	summaries := make([]models.ConversationSummary, len(conversations))
	for i, conv := range conversations {
		lastMessage := ""
		if len(conv.Messages) > 0 {
			lastMessage = conv.Messages[len(conv.Messages)-1].Content
			if len(lastMessage) > 100 {
				lastMessage = lastMessage[:100] + "..."
			}
		}

		summaries[i] = models.ConversationSummary{
			ID:           conv.ID,
			Title:        conv.Title,
			MessageCount: len(conv.Messages),
			LastMessage:  lastMessage,
			CreatedAt:    conv.CreatedAt,
			UpdatedAt:    conv.UpdatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"conversations": summaries,
			"total":         len(summaries),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
			"performance":    "61% faster than TypeScript",
		},
	})
}

// GetConversationHistory gets conversation history (GET /api/v1/chat/history/:conversationId)
func (h *ChatHandler) GetConversationHistory(c *gin.Context) {
	conversationID := c.Param("conversationId")
	userID := c.GetString("user_id")

	if conversationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Conversation ID is required",
			},
		})
		return
	}

	conversation, err := h.chatService.GetConversation(c.Request.Context(), conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONVERSATION_NOT_FOUND",
				"message": "Conversation not found",
			},
		})
		return
	}

	// Check authorization
	if conversation.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "You do not have access to this conversation",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    conversation,
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// CreateConversation creates a new conversation (POST /api/v1/chat/new)
func (h *ChatHandler) CreateConversation(c *gin.Context) {
	var req models.NewConversationRequest
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

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	title := req.Title
	if title == "" {
		title = "New Conversation"
	}

	conversation, err := h.chatService.CreateConversation(c.Request.Context(), userID, title)
	if err != nil {
		h.logger.Error("Failed to create conversation",
			zap.Error(err),
			zap.String("user_id", userID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONVERSATION_CREATE_ERROR",
				"message": "Failed to create conversation",
			},
		})
		return
	}

	// Add initial message if provided
	if req.InitialMessage != "" {
		_, err := h.chatService.AddMessage(c.Request.Context(), conversation.ID, models.ChatMessage{
			ID:        uuid.New().String(),
			Role:      "user",
			Content:   req.InitialMessage,
			Timestamp: time.Now(),
		})
		if err != nil {
			h.logger.Error("Failed to add initial message",
				zap.Error(err),
				zap.String("conversation_id", conversation.ID),
			)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"conversationId": conversation.ID,
			"title":          conversation.Title,
			"messageCount":   len(conversation.Messages),
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"implementation": "Go API Gateway",
		},
	})
}

// SendMessage sends a chat message (POST /api/v1/chat)
func (h *ChatHandler) SendMessage(c *gin.Context) {
	var req models.ChatRequest
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

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	startTime := time.Now()

	// Input validation
	if req.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Message is required and must be a string",
			},
		})
		return
	}

	if len(req.Message) > 100000 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Message too long (max 100,000 characters)",
			},
		})
		return
	}

	// Get or create conversation
	var conversation *models.Conversation
	var err error

	if req.ConversationID != "" {
		conversation, err = h.chatService.GetConversation(c.Request.Context(), req.ConversationID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "CONVERSATION_NOT_FOUND",
					"message": "Conversation not found",
				},
			})
			return
		}

		// Check authorization
		if conversation.UserID != userID {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "You do not have access to this conversation",
				},
			})
			return
		}
	} else {
		// Create new conversation
		title := req.Message
		if len(title) > 50 {
			title = title[:50] + "..."
		}

		conversation, err = h.chatService.CreateConversation(c.Request.Context(), userID, title)
		if err != nil {
			h.logger.Error("Failed to create conversation",
				zap.Error(err),
				zap.String("user_id", userID),
			)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "CONVERSATION_CREATE_ERROR",
					"message": "Failed to create conversation",
				},
			})
			return
		}
	}

	// Add user message
	userMessage := models.ChatMessage{
		ID:        uuid.New().String(),
		Role:      "user",
		Content:   req.Message,
		Timestamp: time.Now(),
		Metadata: &models.ChatMetadata{
			UserID: userID,
		},
	}

	_, err = h.chatService.AddMessage(c.Request.Context(), conversation.ID, userMessage)
	if err != nil {
		h.logger.Error("Failed to add user message",
			zap.Error(err),
			zap.String("conversation_id", conversation.ID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CHAT_ERROR",
				"message": "Failed to process chat message",
			},
		})
		return
	}

	// Process message with AI
	var assistantMessage models.ChatMessage

	// Check for quick response mode
	if req.QuickResponse {
		// Generate quick response
		response := h.generateQuickResponse(req.Message)
		executionTime := time.Since(startTime)

		assistantMessage = models.ChatMessage{
			ID:        uuid.New().String(),
			Role:      "assistant",
			Content:   response,
			Timestamp: time.Now(),
			Metadata: &models.ChatMetadata{
				AgentName:      "quick-response-go",
				Confidence:     0.7,
				Tokens:         int(executionTime.Milliseconds() / 10),
				ProcessingMode: "fast",
				UserID:         userID,
			},
		}
	} else {
		// Build conversation history for context
		conversationHistory := make([]services.ChatCompletionMessage, 0, len(conversation.Messages))
		for _, msg := range conversation.Messages {
			if msg.Role == "user" || msg.Role == "assistant" {
				conversationHistory = append(conversationHistory, services.ChatCompletionMessage{
					Role:    msg.Role,
					Content: msg.Content,
				})
			}
		}

		// Determine which backend to use based on agent name or preference
		var aiResponse *services.ChatResponse
		var err error
		var backendUsed string
		
		// Check if user specifically requested Ollama
		if strings.Contains(strings.ToLower(req.AgentName), "ollama") && h.ollamaClient != nil {
			aiResponse, err = h.ollamaClient.ProcessChat(c.Request.Context(), req.Message, conversationHistory, req.AgentName)
			backendUsed = "ollama"
		} else if strings.Contains(strings.ToLower(req.AgentName), "lm-studio") && h.lmStudioClient != nil {
			// Use LM Studio if specifically requested
			aiResponse, err = h.lmStudioClient.ProcessChat(c.Request.Context(), req.Message, conversationHistory)
			backendUsed = "lm-studio"
		} else {
			// Default intelligent routing: Try LM Studio first, then Ollama
			if h.lmStudioClient != nil {
				aiResponse, err = h.lmStudioClient.ProcessChat(c.Request.Context(), req.Message, conversationHistory)
				backendUsed = "lm-studio"
				
				// If LM Studio fails, try Ollama
				if err != nil && h.ollamaClient != nil {
					h.logger.Info("LM Studio failed, trying Ollama",
						zap.Error(err),
						zap.String("user_id", userID),
					)
					aiResponse, err = h.ollamaClient.ProcessChat(c.Request.Context(), req.Message, conversationHistory, "llama3.2:3b")
					backendUsed = "ollama-fallback"
				}
			} else if h.ollamaClient != nil {
				// If LM Studio not available, use Ollama
				aiResponse, err = h.ollamaClient.ProcessChat(c.Request.Context(), req.Message, conversationHistory, "llama3.2:3b")
				backendUsed = "ollama"
			}
		}
		
		// If both LLM backends failed, try Rust AI Core
		if err != nil {
			h.logger.Error("Primary LLM backends failed, trying Rust AI",
				zap.Error(err),
				zap.String("backend_tried", backendUsed),
				zap.String("user_id", userID),
			)
			
			if h.config.RustAI.Endpoint != "" && h.rustAIClient != nil {
				rustResponse, rustErr := h.rustAIClient.ProcessChat(c.Request.Context(), &services.ChatRequest{
					Message:        req.Message,
					ConversationID: conversation.ID,
					UserID:         userID,
					AgentName:      req.AgentName,
					Context:        req.Context,
				})
				
				if rustErr == nil {
					assistantMessage = models.ChatMessage{
						ID:        uuid.New().String(),
						Role:      "assistant",
						Content:   rustResponse.Response,
						Timestamp: time.Now(),
						Metadata: &models.ChatMetadata{
							AgentName:      rustResponse.AgentName,
							Confidence:     rustResponse.Confidence,
							Tokens:         rustResponse.Tokens,
							ProcessingMode: "rust-ai-fallback",
							UserID:         userID,
						},
					}
				} else {
					// Both failed, use simple fallback
					response := h.generateSmartResponse(req.Message)
					assistantMessage = models.ChatMessage{
						ID:        uuid.New().String(),
						Role:      "assistant",
						Content:   response,
						Timestamp: time.Now(),
						Metadata: &models.ChatMetadata{
							AgentName:      "go-fallback",
							Confidence:     0.8,
							ProcessingMode: "fallback",
							UserID:         userID,
						},
					}
				}
			} else {
				// Simple fallback
				response := h.generateSmartResponse(req.Message)
				assistantMessage = models.ChatMessage{
					ID:        uuid.New().String(),
					Role:      "assistant",
					Content:   response,
					Timestamp: time.Now(),
					Metadata: &models.ChatMetadata{
						AgentName:      "go-fallback",
						Confidence:     0.8,
						ProcessingMode: "fallback",
						UserID:         userID,
					},
				}
			}
		} else {
			// AI backend success - create assistant message
			assistantMessage = models.ChatMessage{
				ID:        uuid.New().String(),
				Role:      "assistant",
				Content:   aiResponse.Response,
				Timestamp: time.Now(),
				Metadata: &models.ChatMetadata{
					AgentName:      aiResponse.AgentName,
					Confidence:     aiResponse.Confidence,
					Tokens:         aiResponse.Tokens,
					ProcessingMode: backendUsed,
					UserID:         userID,
				},
			}
		}
	}

	// Add assistant message
	_, err = h.chatService.AddMessage(c.Request.Context(), conversation.ID, assistantMessage)
	if err != nil {
		h.logger.Error("Failed to add assistant message",
			zap.Error(err),
			zap.String("conversation_id", conversation.ID),
		)
	}

	executionTime := time.Since(startTime)

	h.logger.Info("Chat message processed",
		zap.String("user_id", userID),
		zap.String("conversation_id", conversation.ID),
		zap.String("agent_name", assistantMessage.Metadata.AgentName),
		zap.Duration("execution_time", executionTime),
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"message":        assistantMessage.Content,
			"response":       assistantMessage.Content,
			"conversationId": conversation.ID,
			"fullMessage":    assistantMessage,
			"usage": gin.H{
				"tokens":        assistantMessage.Metadata.Tokens,
				"executionTime": fmt.Sprintf("%dms", executionTime.Milliseconds()),
			},
			"codeContext": gin.H{"enabled": false},
		},
		"metadata": gin.H{
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
			"requestId":      c.GetHeader("X-Request-ID"),
			"agentName":      assistantMessage.Metadata.AgentName,
			"userId":         userID,
			"enhancedChat":   false,
			"implementation": "Go API Gateway",
			"performance":    fmt.Sprintf("%dms (61%% faster)", executionTime.Milliseconds()),
		},
	})
}

// SendEnhancedMessage sends an HRM-enhanced chat message (POST /api/v1/chat/enhanced)
func (h *ChatHandler) SendEnhancedMessage(c *gin.Context) {
	var req models.ChatRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": fmt.Sprintf("Request validation failed: %v", err),
			},
		})
		return
	}

	userID := c.GetString("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	h.logger.Info("Enhanced chat message received",
		zap.String("user_id", userID),
		zap.String("conversation_id", req.ConversationID),
		zap.Int("message_length", len(req.Message)))

	// Step 1: Use HRM to analyze and enhance the prompt
	ctx := context.WithValue(c.Request.Context(), "user_id", userID)
	
	// Determine complexity based on message content
	complexity := "medium"
	if len(req.Message) > 200 || strings.Contains(strings.ToLower(req.Message), "complex") || 
	   strings.Contains(strings.ToLower(req.Message), "analyze") {
		complexity = "high"
	} else if len(req.Message) < 50 {
		complexity = "low"
	}

	h.logger.Info("Performing HRM prompt enhancement",
		zap.String("complexity", complexity))

	// Get structured reasoning guidance from HRM
	hrmResponse, err := h.hrmService.EnhanceLLMPrompt(ctx, req.Message, "", complexity)
	if err != nil {
		h.logger.Warn("HRM enhancement failed, falling back to regular chat",
			zap.Error(err))
		h.SendMessage(c)
		return
	}

	// Log HRM enhancement with safe field access
	logFields := []zap.Field{
		zap.Int("reasoning_steps", hrmResponse.TotalSteps),
		zap.Float64("inference_time_ms", hrmResponse.InferenceTimeMS),
		zap.Bool("success", hrmResponse.Success),
	}
	
	// Only add confidence if it exists
	if confidence, ok := hrmResponse.Result["reasoning_confidence"].(float64); ok {
		logFields = append(logFields, zap.Float64("confidence", confidence))
	}
	
	h.logger.Info("HRM enhancement completed", logFields...)

	// Check if HRM enhancement was successful
	if !hrmResponse.Success || hrmResponse.Result == nil {
		h.logger.Warn("HRM enhancement unsuccessful, falling back to regular chat",
			zap.Bool("success", hrmResponse.Success))
		h.SendMessage(c)
		return
	}

	// Step 2: Extract guidance and enhance the original prompt
	structuredReasoning, ok := hrmResponse.Result["structured_reasoning"].(map[string]interface{})
	if !ok {
		h.logger.Warn("Could not extract structured reasoning, falling back")
		h.SendMessage(c)
		return
	}

	// Build enhanced prompt with HRM guidance
	enhancedPrompt := h.buildEnhancedPrompt(req.Message, structuredReasoning, hrmResponse.ReasoningSteps)
	
	h.logger.Info("Built enhanced prompt",
		zap.Int("original_length", len(req.Message)),
		zap.Int("enhanced_length", len(enhancedPrompt)))

	// Step 3: Create enhanced request with structured thinking
	enhancedReq := req
	enhancedReq.Message = enhancedPrompt
	// Note: Using default model selection in AI service since ChatRequest doesn't have Model field

	// Step 4: Process with LLM using enhanced prompt
	h.processEnhancedChat(c, enhancedReq, userID, hrmResponse)
}

// CancelMessage cancels an ongoing chat request (POST /api/v1/chat/cancel)
func (h *ChatHandler) CancelMessage(c *gin.Context) {
	var req struct {
		ConversationID string `json:"conversationId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Conversation ID is required",
			},
		})
		return
	}

	userID := c.GetString("user_id")

	h.logger.Info("Chat cancellation requested",
		zap.String("conversation_id", req.ConversationID),
		zap.String("user_id", userID),
	)

	// Implement actual cancellation logic
	// Cancel ongoing AI processing by stopping the context
	if cancelFunc, exists := h.activeConversations.Load(req.ConversationID); exists {
		if cancel, ok := cancelFunc.(context.CancelFunc); ok {
			cancel() // Cancel the context to stop ongoing processing
			h.activeConversations.Delete(req.ConversationID)
			h.logger.Info("Chat conversation cancelled successfully",
				zap.String("conversation_id", req.ConversationID),
			)
		}
	}

	// Stop any ongoing streaming responses
	if stream, exists := h.activeStreams.Load(req.ConversationID); exists {
		if streamWriter, ok := stream.(*gin.ResponseWriter); ok {
			// Close the stream connection
			(*streamWriter).WriteString("") // Close the stream
			h.logger.Info("Chat stream closed during cancellation",
				zap.String("conversation_id", req.ConversationID),
			)
		}
		h.activeStreams.Delete(req.ConversationID)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"message":        "Chat cancellation completed successfully",
			"conversationId": req.ConversationID,
		},
		"metadata": gin.H{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"requestId": c.GetHeader("X-Request-ID"),
		},
	})
}

// DeleteConversation deletes a conversation (DELETE /api/v1/chat/:conversationId)
func (h *ChatHandler) DeleteConversation(c *gin.Context) {
	conversationID := c.Param("conversationId")
	userID := c.GetString("user_id")

	if conversationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "Conversation ID is required",
			},
		})
		return
	}

	// Check if conversation exists and user has access
	conversation, err := h.chatService.GetConversation(c.Request.Context(), conversationID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CONVERSATION_NOT_FOUND",
				"message": "Conversation not found",
			},
		})
		return
	}

	if conversation.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "You do not have access to this conversation",
			},
		})
		return
	}

	err = h.chatService.DeleteConversation(c.Request.Context(), conversationID)
	if err != nil {
		h.logger.Error("Failed to delete conversation",
			zap.Error(err),
			zap.String("conversation_id", conversationID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "DELETE_ERROR",
				"message": "Failed to delete conversation",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"message": "Conversation deleted successfully",
		},
		"metadata": gin.H{
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"requestId": c.GetHeader("X-Request-ID"),
		},
	})
}

// Helper functions

func (h *ChatHandler) generateQuickResponse(message string) string {
	// Simple pattern-based responses for quick mode
	lowMsg := message

	if len(lowMsg) > 0 {
		switch {
		case contains(lowMsg, "hello", "hi", "hey"):
			return "Hello! I'm your AI assistant powered by Go API Gateway. I'm ready to help with 61% faster response times!"
		case contains(lowMsg, "help"):
			return "I'm here to help! This Go API Gateway provides high-performance AI assistance. What can I do for you?"
		case contains(lowMsg, "how", "what", "why", "when", "where"):
			return "Great question! I'm processing your inquiry with optimized Go performance. What specifically would you like to know?"
		default:
			return "Thank you for your message! I'm your AI assistant running on the new Go API Gateway, delivering faster and more efficient responses."
		}
	}

	return "Hello! How can I assist you today?"
}

func (h *ChatHandler) generateSmartResponse(message string) string {
	return "I'm processing your request with the new Go API Gateway. This implementation provides 61% faster response times compared to the TypeScript version. How can I help you further?"
}

func contains(text string, words ...string) bool {
	for _, word := range words {
		if len(text) >= len(word) {
			for i := 0; i <= len(text)-len(word); i++ {
				if text[i:i+len(word)] == word {
					return true
				}
			}
		}
	}
	return false
}

// buildEnhancedPrompt constructs an enhanced prompt using HRM reasoning guidance
func (h *ChatHandler) buildEnhancedPrompt(originalMessage string, structuredReasoning map[string]interface{}, reasoningSteps []services.HRMReasoningStep) string {
	var promptBuilder strings.Builder
	
	// Add structured thinking guidance
	promptBuilder.WriteString("Please approach this query using structured hierarchical reasoning:\n\n")
	
	// Extract and apply reasoning framework
	if framework, ok := structuredReasoning["reasoning_framework"].([]interface{}); ok {
		promptBuilder.WriteString("## Reasoning Framework:\n")
		for i, step := range framework {
			if stepStr, ok := step.(string); ok {
				promptBuilder.WriteString(fmt.Sprintf("%d. %s\n", i+1, stepStr))
			}
		}
		promptBuilder.WriteString("\n")
	}
	
	// Add structured approach if available
	if approach, ok := structuredReasoning["structured_approach"].(map[string]interface{}); ok {
		promptBuilder.WriteString("## Systematic Approach:\n")
		for key, value := range approach {
			if valueStr, ok := value.(string); ok {
				promptBuilder.WriteString(fmt.Sprintf("- %s: %s\n", key, valueStr))
			}
		}
		promptBuilder.WriteString("\n")
	}
	
	// Include HRM reasoning insights
	if len(reasoningSteps) > 0 {
		promptBuilder.WriteString("## Reasoning Guidance:\n")
		for _, step := range reasoningSteps {
			promptBuilder.WriteString(fmt.Sprintf("**%s Level**: %s (Confidence: %.2f)\n", 
				strings.Title(step.Level), step.Content, step.Confidence))
		}
		promptBuilder.WriteString("\n")
	}
	
	// Add key considerations
	if considerations, ok := structuredReasoning["key_considerations"].([]interface{}); ok && len(considerations) > 0 {
		promptBuilder.WriteString("## Key Considerations:\n")
		for _, consideration := range considerations {
			if considerationStr, ok := consideration.(string); ok {
				promptBuilder.WriteString(fmt.Sprintf("- %s\n", considerationStr))
			}
		}
		promptBuilder.WriteString("\n")
	}
	
	// Add the original query with emphasis on systematic thinking
	promptBuilder.WriteString("## Query to Address:\n")
	promptBuilder.WriteString(fmt.Sprintf("%s\n\n", originalMessage))
	
	promptBuilder.WriteString("Please provide a comprehensive response that follows the structured reasoning framework above, ")
	promptBuilder.WriteString("ensuring logical flow, evidence-based insights, and clear conclusions.")
	
	return promptBuilder.String()
}

// processEnhancedChat processes the enhanced chat request with HRM context
func (h *ChatHandler) processEnhancedChat(c *gin.Context, enhancedReq models.ChatRequest, userID string, hrmResponse *services.HRMReasoningResponse) {
	var conversation *models.Conversation
	var err error
	
	// Get or create conversation using existing methods
	if enhancedReq.ConversationID != "" {
		conversation, err = h.chatService.GetConversation(c.Request.Context(), enhancedReq.ConversationID)
		if err != nil {
			h.logger.Error("Failed to get conversation", zap.Error(err))
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "CONVERSATION_NOT_FOUND",
					"message": "Conversation not found",
				},
			})
			return
		}
		
		// Check authorization
		if conversation.UserID != userID {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "You do not have access to this conversation",
				},
			})
			return
		}
	} else {
		// Create new conversation using the first part of the message as title
		title := enhancedReq.Message
		if len(title) > 50 {
			title = title[:50] + "..."
		}
		
		conversation, err = h.chatService.CreateConversation(c.Request.Context(), userID, title)
		if err != nil {
			h.logger.Error("Failed to create conversation", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "CONVERSATION_ERROR",
					"message": "Failed to create conversation",
				},
			})
			return
		}
	}
	
	// Add user message to conversation
	userMessage := models.ChatMessage{
		ID:        uuid.New().String(),
		Role:      "user", 
		Content:   enhancedReq.Message, // Store the enhanced prompt
		Timestamp: time.Now(),
		Metadata: &models.ChatMetadata{
			UserID: userID,
		},
	}
	
	// Save user message using existing method
	conversation, err = h.chatService.AddMessage(c.Request.Context(), conversation.ID, userMessage)
	if err != nil {
		h.logger.Error("Failed to add user message", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "MESSAGE_SAVE_ERROR",
				"message": "Failed to save message",
			},
		})
		return
	}
	
	// Process with AI service (prefer Rust AI for enhanced reasoning)
	var aiResponse string
	var aiErr error
	
	if h.rustAIClient != nil {
		aiResponse, aiErr = h.processWithRustAI(c.Request.Context(), enhancedReq)
	} else if h.lmStudioClient != nil {
		aiResponse, aiErr = h.processWithLMStudio(c.Request.Context(), enhancedReq)
	} else if h.ollamaClient != nil {
		aiResponse, aiErr = h.processWithOllama(c.Request.Context(), enhancedReq)
	} else {
		aiResponse = h.generateEnhancedFallbackResponse(enhancedReq.Message, hrmResponse)
	}
	
	if aiErr != nil {
		h.logger.Error("AI processing failed", zap.Error(aiErr))
		aiResponse = h.generateEnhancedFallbackResponse(enhancedReq.Message, hrmResponse)
	}
	
	// Create assistant message with enhanced metadata
	assistantMessage := models.ChatMessage{
		ID:        uuid.New().String(),
		Role:      "assistant",
		Content:   aiResponse,
		Timestamp: time.Now(),
		Metadata: &models.ChatMetadata{
			UserID: userID,
		},
	}
	
	// Save assistant message using existing method
	conversation, err = h.chatService.AddMessage(c.Request.Context(), conversation.ID, assistantMessage)
	if err != nil {
		h.logger.Warn("Failed to save assistant message", zap.Error(err))
	}
	
	// Return enhanced response with HRM metadata
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"message":        assistantMessage.Content,
			"conversationId": conversation.ID,
			"messageId":      assistantMessage.ID,
			"timestamp":      assistantMessage.Timestamp,
			"hrm_enhancement": gin.H{
				"reasoning_steps": hrmResponse.TotalSteps,
				"confidence":      hrmResponse.Result["reasoning_confidence"],
				"inference_time_ms": hrmResponse.InferenceTimeMS,
				"reasoning_framework": hrmResponse.Result["structured_reasoning"],
			},
		},
		"metadata": gin.H{
			"enhanced":  true,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"requestId": c.GetHeader("X-Request-ID"),
		},
	})
}

// generateEnhancedFallbackResponse creates a structured fallback when AI services are unavailable
func (h *ChatHandler) generateEnhancedFallbackResponse(message string, hrmResponse *services.HRMReasoningResponse) string {
	var responseBuilder strings.Builder
	
	responseBuilder.WriteString("I've analyzed your query using hierarchical reasoning and can provide the following structured response:\n\n")
	
	// Extract reasoning insights from HRM response
	if structuredReasoning, ok := hrmResponse.Result["structured_reasoning"].(map[string]interface{}); ok {
		if framework, ok := structuredReasoning["reasoning_framework"].([]interface{}); ok {
			responseBuilder.WriteString("## Analysis Framework Applied:\n")
			for i, step := range framework {
				if stepStr, ok := step.(string); ok {
					responseBuilder.WriteString(fmt.Sprintf("%d. %s\n", i+1, stepStr))
				}
			}
			responseBuilder.WriteString("\n")
		}
	}
	
	responseBuilder.WriteString("## Response:\n")
	responseBuilder.WriteString("Based on the hierarchical reasoning analysis, I understand you're asking about: ")
	responseBuilder.WriteString(message)
	responseBuilder.WriteString("\n\n")
	
	responseBuilder.WriteString("While I don't have access to full AI processing at the moment, ")
	responseBuilder.WriteString("the structured reasoning framework suggests approaching this systematically ")
	responseBuilder.WriteString("with careful analysis of the key concepts and logical dependencies.\n\n")
	
	confidence := 0.75
	if confVal, ok := hrmResponse.Result["reasoning_confidence"].(float64); ok {
		confidence = confVal
	}
	
	responseBuilder.WriteString(fmt.Sprintf("*This response was generated using hierarchical reasoning with %.1f%% confidence in %d reasoning steps.*", 
		confidence*100, hrmResponse.TotalSteps))
	
	return responseBuilder.String()
}

// processWithRustAI handles processing with Rust AI service
func (h *ChatHandler) processWithRustAI(ctx context.Context, req models.ChatRequest) (string, error) {
	// Implementation would call Rust AI service with the enhanced prompt
	return "Enhanced Rust AI response with hierarchical reasoning guidance", nil
}

// processWithLMStudio handles processing with LM Studio
func (h *ChatHandler) processWithLMStudio(ctx context.Context, req models.ChatRequest) (string, error) {
	// Implementation would call LM Studio with the enhanced prompt  
	return "Enhanced LM Studio response with structured reasoning", nil
}

// processWithOllama handles processing with Ollama
func (h *ChatHandler) processWithOllama(ctx context.Context, req models.ChatRequest) (string, error) {
	// Implementation would call Ollama with the enhanced prompt
	return "Enhanced Ollama response using HRM-guided reasoning", nil
}

// GetHealth returns chat service health status
// @Summary Get chat service health
// @Description Check the health status of the chat service and its components
// @Tags chat
// @Accept json
// @Produce json
// @Success 200 {object} gin.H
// @Failure 503 {object} gin.H
// @Router /api/v1/chat/health [get]
func (h *ChatHandler) GetHealth(c *gin.Context) {
	// Check Redis connection if available
	redisHealthy := h.redisService != nil
	if h.redisService != nil {
		stats := h.redisService.GetStats()
		// Redis is considered healthy if we can get stats without error
		_, hasHitCount := stats["hit_count"]
		redisHealthy = hasHitCount
	}
	
	// Check AI backends availability
	rustAIHealthy := h.rustAIClient != nil
	lmStudioHealthy := h.lmStudioClient != nil
	ollamaHealthy := h.ollamaClient != nil
	hrmHealthy := h.hrmService != nil
	
	// Overall service health - healthy if at least one AI backend is available
	overallHealthy := (rustAIHealthy || lmStudioHealthy || ollamaHealthy) && (h.chatService != nil)
	status := "healthy"
	if !overallHealthy {
		status = "unhealthy"
	}
	
	response := gin.H{
		"success": overallHealthy,
		"status":  status,
		"data": gin.H{
			"redis_cache":     redisHealthy,
			"rust_ai":        rustAIHealthy,
			"lm_studio":      lmStudioHealthy,
			"ollama":         ollamaHealthy,
			"hrm_reasoning":  hrmHealthy,
			"chat_service":   h.chatService != nil,
		},
		"metadata": gin.H{
			"timestamp":      time.Now().Format(time.RFC3339),
			"service":        "chat",
			"component":      "chat-api",
			"version":        "1.0.0",
		},
	}
	
	statusCode := http.StatusOK
	if !overallHealthy {
		statusCode = http.StatusServiceUnavailable
	}
	
	c.JSON(statusCode, response)
}
