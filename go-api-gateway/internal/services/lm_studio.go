// LM Studio integration service for local LLM processing
package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
	"universal-ai-tools/go-api-gateway/internal/config"
)

// LMStudioClient handles communication with LM Studio
type LMStudioClient struct {
	config     *config.Config
	logger     *zap.Logger
	httpClient *http.Client
	endpoint   string
	model      string
}

// NewLMStudioClient creates a new LM Studio client
func NewLMStudioClient(cfg *config.Config, logger *zap.Logger) *LMStudioClient {
	endpoint := cfg.LMStudio.Endpoint
	if endpoint == "" {
		endpoint = "http://localhost:5901/v1"
	}
	
	model := cfg.LMStudio.Model
	if model == "" {
		model = "qwen/qwen3-30b-a3b-2507"
	}

	return &LMStudioClient{
		config: cfg,
		logger: logger,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		endpoint: endpoint,
		model:    model,
	}
}

// ChatCompletionRequest represents a request to LM Studio's chat completion API
type ChatCompletionRequest struct {
	Model       string                   `json:"model"`
	Messages    []ChatCompletionMessage  `json:"messages"`
	Temperature float32                  `json:"temperature,omitempty"`
	MaxTokens   int                      `json:"max_tokens,omitempty"`
	Stream      bool                     `json:"stream,omitempty"`
	TopP        float32                  `json:"top_p,omitempty"`
}

// ChatCompletionMessage represents a message in the chat
type ChatCompletionMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionResponse represents the response from LM Studio
type ChatCompletionResponse struct {
	ID      string                    `json:"id"`
	Object  string                    `json:"object"`
	Created int64                     `json:"created"`
	Model   string                    `json:"model"`
	Choices []ChatCompletionChoice    `json:"choices"`
	Usage   ChatCompletionUsage       `json:"usage"`
}

// ChatCompletionChoice represents a completion choice
type ChatCompletionChoice struct {
	Index        int                     `json:"index"`
	Message      ChatCompletionMessage   `json:"message"`
	FinishReason string                  `json:"finish_reason"`
}

// ChatCompletionUsage represents token usage information
type ChatCompletionUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ProcessChat sends a chat request to LM Studio
func (c *LMStudioClient) ProcessChat(ctx context.Context, message string, conversationHistory []ChatCompletionMessage) (*ChatResponse, error) {
	// Build messages array
	messages := []ChatCompletionMessage{}
	
	// Add system message if not present
	if len(conversationHistory) == 0 || conversationHistory[0].Role != "system" {
		messages = append(messages, ChatCompletionMessage{
			Role:    "system",
			Content: "You are a helpful AI assistant powered by Universal AI Tools, running locally via LM Studio.",
		})
	}
	
	// Add conversation history
	messages = append(messages, conversationHistory...)
	
	// Add current user message
	messages = append(messages, ChatCompletionMessage{
		Role:    "user",
		Content: message,
	})

	// Create request
	req := ChatCompletionRequest{
		Model:       c.model,
		Messages:    messages,
		Temperature: 0.7,
		MaxTokens:   2000,
		Stream:      false,
	}

	// Marshal request
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", 
		fmt.Sprintf("%s/chat/completions", c.endpoint), 
		bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// Send request
	startTime := time.Now()
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request to LM Studio: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LM Studio returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var completionResp ChatCompletionResponse
	err = json.Unmarshal(body, &completionResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Check if we got a response
	if len(completionResp.Choices) == 0 {
		return nil, fmt.Errorf("no completion choices returned")
	}

	processingTime := time.Since(startTime)

	// Log successful completion
	c.logger.Info("LM Studio chat completion successful",
		zap.String("model", c.model),
		zap.Int("prompt_tokens", completionResp.Usage.PromptTokens),
		zap.Int("completion_tokens", completionResp.Usage.CompletionTokens),
		zap.Duration("processing_time", processingTime),
	)

	// Return formatted response
	return &ChatResponse{
		Response:   completionResp.Choices[0].Message.Content,
		AgentName:  fmt.Sprintf("lm-studio-%s", c.model),
		Confidence: 0.95, // LM Studio is high confidence
		Tokens:     completionResp.Usage.TotalTokens,
	}, nil
}

// GetModels retrieves available models from LM Studio
func (c *LMStudioClient) GetModels(ctx context.Context) ([]string, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", 
		fmt.Sprintf("%s/models", c.endpoint), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get models: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var modelsResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	err = json.Unmarshal(body, &modelsResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse models response: %w", err)
	}

	models := make([]string, len(modelsResp.Data))
	for i, model := range modelsResp.Data {
		models[i] = model.ID
	}

	return models, nil
}

// HealthCheck checks if LM Studio is available
func (c *LMStudioClient) HealthCheck(ctx context.Context) error {
	models, err := c.GetModels(ctx)
	if err != nil {
		return fmt.Errorf("LM Studio health check failed: %w", err)
	}
	
	if len(models) == 0 {
		return fmt.Errorf("LM Studio has no models available")
	}
	
	c.logger.Info("LM Studio health check passed",
		zap.Int("models_available", len(models)),
		zap.String("endpoint", c.endpoint),
	)
	
	return nil
}