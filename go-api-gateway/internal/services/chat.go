// Chat service for managing conversations and messages
package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/models"
)

// ChatService handles chat conversations and messages
type ChatService struct {
	config      *config.Config
	logger      *zap.Logger
	redis       *redis.Client
	conversions sync.Map // In-memory cache for active conversations
}

// NewChatService creates a new chat service
func NewChatService(cfg *config.Config, logger *zap.Logger, redisClient *redis.Client) *ChatService {
	// Initialize Redis client if not provided
	if redisClient == nil {
		redisClient = redis.NewClient(&redis.Options{
			Addr:     fmt.Sprintf("%s:%d", cfg.Database.Redis.Host, cfg.Database.Redis.Port),
			Password: cfg.Database.Redis.Password,
			DB:       cfg.Database.Redis.Database,
		})
	}
	
	return &ChatService{
		config: cfg,
		logger: logger,
		redis:  redisClient,
	}
}

// CreateConversation creates a new conversation
func (s *ChatService) CreateConversation(ctx context.Context, userID, title string) (*models.Conversation, error) {
	conversation := &models.Conversation{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     title,
		Messages:  []models.ChatMessage{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Store in Redis
	key := fmt.Sprintf("conversation:%s", conversation.ID)
	data, err := json.Marshal(conversation)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal conversation: %w", err)
	}

	err = s.redis.Set(ctx, key, data, 24*time.Hour).Err()
	if err != nil {
		return nil, fmt.Errorf("failed to store conversation: %w", err)
	}

	// Also add to user's conversation list
	userKey := fmt.Sprintf("user:%s:conversations", userID)
	err = s.redis.SAdd(ctx, userKey, conversation.ID).Err()
	if err != nil {
		s.logger.Error("Failed to add conversation to user list", zap.Error(err))
	}

	return conversation, nil
}

// GetConversation retrieves a conversation by ID
func (s *ChatService) GetConversation(ctx context.Context, conversationID string) (*models.Conversation, error) {
	key := fmt.Sprintf("conversation:%s", conversationID)
	
	data, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("conversation not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}

	var conversation models.Conversation
	err = json.Unmarshal([]byte(data), &conversation)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal conversation: %w", err)
	}

	return &conversation, nil
}

// GetUserConversations retrieves all conversations for a user
func (s *ChatService) GetUserConversations(ctx context.Context, userID string) ([]models.Conversation, error) {
	userKey := fmt.Sprintf("user:%s:conversations", userID)
	
	conversationIDs, err := s.redis.SMembers(ctx, userKey).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get user conversations: %w", err)
	}

	conversations := make([]models.Conversation, 0, len(conversationIDs))
	for _, id := range conversationIDs {
		conversation, err := s.GetConversation(ctx, id)
		if err != nil {
			s.logger.Error("Failed to get conversation", 
				zap.String("conversation_id", id),
				zap.Error(err))
			continue
		}
		conversations = append(conversations, *conversation)
	}

	return conversations, nil
}

// AddMessage adds a message to a conversation
func (s *ChatService) AddMessage(ctx context.Context, conversationID string, message models.ChatMessage) (*models.Conversation, error) {
	conversation, err := s.GetConversation(ctx, conversationID)
	if err != nil {
		return nil, err
	}

	conversation.Messages = append(conversation.Messages, message)
	conversation.UpdatedAt = time.Now()

	// Store updated conversation
	key := fmt.Sprintf("conversation:%s", conversation.ID)
	data, err := json.Marshal(conversation)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal conversation: %w", err)
	}

	err = s.redis.Set(ctx, key, data, 24*time.Hour).Err()
	if err != nil {
		return nil, fmt.Errorf("failed to update conversation: %w", err)
	}

	return conversation, nil
}

// DeleteConversation deletes a conversation
func (s *ChatService) DeleteConversation(ctx context.Context, conversationID string) error {
	// Get conversation first to get userID
	conversation, err := s.GetConversation(ctx, conversationID)
	if err != nil {
		return err
	}

	// Remove from Redis
	key := fmt.Sprintf("conversation:%s", conversationID)
	err = s.redis.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to delete conversation: %w", err)
	}

	// Remove from user's conversation list
	userKey := fmt.Sprintf("user:%s:conversations", conversation.UserID)
	err = s.redis.SRem(ctx, userKey, conversationID).Err()
	if err != nil {
		s.logger.Error("Failed to remove conversation from user list", zap.Error(err))
	}

	return nil
}

// ConversationContextMap manages active conversation contexts for cancellation
type ConversationContextMap struct {
	sync.Map
}

// NewConversationContextMap creates a new conversation context map
func NewConversationContextMap() *ConversationContextMap {
	return &ConversationContextMap{}
}

// StreamMap manages active streaming connections
type StreamMap struct {
	sync.Map
}

// NewStreamMap creates a new stream map
func NewStreamMap() *StreamMap {
	return &StreamMap{}
}

// RustAIClient handles communication with Rust AI Core service
type RustAIClient struct {
	config   *config.Config
	logger   *zap.Logger
	endpoint string
}

// NewRustAIClient creates a new Rust AI client
func NewRustAIClient(cfg *config.Config, logger *zap.Logger, portManager *PortManager) *RustAIClient {
	endpoint := "http://localhost:8009" // Default endpoint
	
	// Try to allocate dynamic port for Rust AI Core if port manager is available
	if portManager != nil {
		if allocation := portManager.GetPortAllocation("rust-ai-core"); allocation != nil {
			endpoint = fmt.Sprintf("http://localhost:%d", allocation.Port)
			logger.Info("Using existing Rust AI Core port allocation",
				zap.Int("port", allocation.Port),
				zap.String("status", allocation.Status))
		} else {
			preferredPort := 8009
			allocation, err := portManager.AllocatePort("rust-ai-core", "microservice", &preferredPort)
			if err != nil {
				logger.Warn("Failed to allocate dynamic port for Rust AI Core, using default",
					zap.Error(err),
					zap.Int("default_port", 8009))
			} else {
				endpoint = fmt.Sprintf("http://localhost:%d", allocation.Port)
				logger.Info("Allocated dynamic port for Rust AI Core",
					zap.Int("port", allocation.Port),
					zap.String("service_type", allocation.ServiceType))
			}
		}
	}
	
	return &RustAIClient{
		config:   cfg,
		logger:   logger,
		endpoint: endpoint,
	}
}

// ChatRequest represents a request to the AI service
type ChatRequest struct {
	Message        string                 `json:"message"`
	ConversationID string                 `json:"conversationId"`
	UserID         string                 `json:"userId"`
	AgentName      string                 `json:"agentName"`
	Context        map[string]interface{} `json:"context"`
}

// ChatResponse represents a response from the AI service
type ChatResponse struct {
	Response   string  `json:"response"`
	AgentName  string  `json:"agentName"`
	Confidence float64 `json:"confidence"`
	Tokens     int     `json:"tokens"`
}

// ProcessChat sends a chat request to the Rust AI Core service
func (c *RustAIClient) ProcessChat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	// Use dynamically allocated endpoint for Rust AI Core service
	rustEndpoint := fmt.Sprintf("%s/v1/chat/completions", c.endpoint)
	
	// Prepare the request payload for Rust AI Core
	payload := map[string]interface{}{
		"model": "llama-3.2-8b", // Use a model that should be available
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": req.Message,
			},
		},
		"max_tokens":  500,
		"temperature": 0.7,
		"provider":    "ollama",
	}
	
	// Convert to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		c.logger.Error("Failed to marshal request", zap.Error(err))
		return c.fallbackToLMStudio(ctx, req)
	}
	
	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", rustEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		c.logger.Error("Failed to create request", zap.Error(err))
		return c.fallbackToLMStudio(ctx, req)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	
	// Send request with timeout
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.logger.Warn("Rust AI Core not available, falling back to LM Studio", zap.Error(err))
		return c.fallbackToLMStudio(ctx, req)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode != http.StatusOK {
		c.logger.Warn("Rust AI Core returned error, falling back to LM Studio", 
			zap.Int("status", resp.StatusCode))
		return c.fallbackToLMStudio(ctx, req)
	}
	
	// Parse response
	var rustResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
		Provider string `json:"provider"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&rustResp); err != nil {
		c.logger.Error("Failed to decode Rust response", zap.Error(err))
		return c.fallbackToLMStudio(ctx, req)
	}
	
	// Extract response
	responseText := "No response generated"
	if len(rustResp.Choices) > 0 {
		responseText = rustResp.Choices[0].Message.Content
	}
	
	return &ChatResponse{
		Response:   responseText,
		AgentName:  req.AgentName,
		Confidence: 0.95,
		Tokens:     rustResp.Usage.TotalTokens,
	}, nil
}

// fallbackToLMStudio uses LM Studio as a fallback when Rust AI Core is unavailable
func (c *RustAIClient) fallbackToLMStudio(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
	// Use configured LM Studio endpoint instead of hardcoded port
	lmStudioEndpoint := c.config.LMStudio.Endpoint + "/chat/completions"
	if lmStudioEndpoint == "/chat/completions" {
		// Fallback to default if no config
		lmStudioEndpoint = "http://localhost:1234/v1/chat/completions"
		c.logger.Warn("Using hardcoded LM Studio fallback endpoint - configure LM Studio endpoint for automated port management")
	}
	
	payload := map[string]interface{}{
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": req.Message,
			},
		},
		"temperature": 0.7,
		"max_tokens":  500,
		"stream":      false,
	}
	
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal LM Studio request: %w", err)
	}
	
	httpReq, err := http.NewRequestWithContext(ctx, "POST", lmStudioEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create LM Studio request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		// If even LM Studio fails, return a helpful error message
		return &ChatResponse{
			Response:   "AI services are currently unavailable. Please ensure LM Studio or Rust AI Core is running.",
			AgentName:  req.AgentName,
			Confidence: 0.0,
			Tokens:     0,
		}, nil
	}
	defer resp.Body.Close()
	
	var lmResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&lmResp); err != nil {
		return nil, fmt.Errorf("failed to decode LM Studio response: %w", err)
	}
	
	responseText := "No response generated"
	if len(lmResp.Choices) > 0 {
		responseText = lmResp.Choices[0].Message.Content
	}
	
	return &ChatResponse{
		Response:   responseText,
		AgentName:  req.AgentName,
		Confidence: 0.9,
		Tokens:     lmResp.Usage.TotalTokens,
	}, nil
}