// Ollama integration service for local LLM processing
package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
	"universal-ai-tools/go-api-gateway/internal/config"
)

// OllamaClient handles communication with Ollama
type OllamaClient struct {
	config     *config.Config
	logger     *zap.Logger
	httpClient *http.Client
	endpoint   string
}

// NewOllamaClient creates a new Ollama client
func NewOllamaClient(cfg *config.Config, logger *zap.Logger) *OllamaClient {
	endpoint := "http://localhost:11434"
	// Allow override via environment variable
	if envEndpoint := cfg.Migration.TypeScriptEndpoint; strings.Contains(envEndpoint, "11434") {
		endpoint = envEndpoint
	}

	return &OllamaClient{
		config: cfg,
		logger: logger,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		endpoint: endpoint,
	}
}

// OllamaGenerateRequest represents a request to Ollama's generate API
type OllamaGenerateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
	Options struct {
		Temperature float32 `json:"temperature,omitempty"`
		NumPredict  int     `json:"num_predict,omitempty"`
	} `json:"options,omitempty"`
}

// OllamaGenerateResponse represents the response from Ollama
type OllamaGenerateResponse struct {
	Model              string    `json:"model"`
	CreatedAt          time.Time `json:"created_at"`
	Response           string    `json:"response"`
	Done               bool      `json:"done"`
	Context            []int     `json:"context,omitempty"`
	TotalDuration      int64     `json:"total_duration,omitempty"`
	LoadDuration       int64     `json:"load_duration,omitempty"`
	PromptEvalCount    int       `json:"prompt_eval_count,omitempty"`
	PromptEvalDuration int64     `json:"prompt_eval_duration,omitempty"`
	EvalCount          int       `json:"eval_count,omitempty"`
	EvalDuration       int64     `json:"eval_duration,omitempty"`
}

// OllamaChatRequest represents a chat request to Ollama
type OllamaChatRequest struct {
	Model    string                   `json:"model"`
	Messages []ChatCompletionMessage  `json:"messages"`
	Stream   bool                     `json:"stream"`
	Options  map[string]interface{}   `json:"options,omitempty"`
}

// OllamaChatResponse represents the chat response from Ollama
type OllamaChatResponse struct {
	Model     string                  `json:"model"`
	CreatedAt time.Time               `json:"created_at"`
	Message   ChatCompletionMessage   `json:"message"`
	Done      bool                    `json:"done"`
	TotalDuration int64              `json:"total_duration,omitempty"`
	EvalCount     int                `json:"eval_count,omitempty"`
}

// ProcessChat sends a chat request to Ollama
func (c *OllamaClient) ProcessChat(ctx context.Context, message string, conversationHistory []ChatCompletionMessage, model string) (*ChatResponse, error) {
	// Default model if not specified
	if model == "" {
		model = "llama3.2:3b"
	}
	
	// Check if model string contains "ollama-" prefix and remove it
	if strings.HasPrefix(model, "ollama-") {
		model = strings.TrimPrefix(model, "ollama-")
	}

	// Build messages array
	messages := []ChatCompletionMessage{}
	
	// Add system message if not present
	if len(conversationHistory) == 0 || conversationHistory[0].Role != "system" {
		messages = append(messages, ChatCompletionMessage{
			Role:    "system",
			Content: "You are a helpful AI assistant powered by Universal AI Tools, running locally via Ollama.",
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
	req := OllamaChatRequest{
		Model:    model,
		Messages: messages,
		Stream:   false,
		Options: map[string]interface{}{
			"temperature": 0.7,
			"num_predict": 2000,
		},
	}

	// Marshal request
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", 
		fmt.Sprintf("%s/api/chat", c.endpoint), 
		bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// Send request
	startTime := time.Now()
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request to Ollama: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Ollama returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var chatResp OllamaChatResponse
	err = json.Unmarshal(body, &chatResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	processingTime := time.Since(startTime)

	// Calculate tokens (approximate)
	tokens := chatResp.EvalCount
	if tokens == 0 {
		// Estimate tokens based on response length
		tokens = len(chatResp.Message.Content) / 4
	}

	// Log successful completion
	c.logger.Info("Ollama chat completion successful",
		zap.String("model", model),
		zap.Int("tokens", tokens),
		zap.Duration("processing_time", processingTime),
	)

	// Return formatted response
	return &ChatResponse{
		Response:   chatResp.Message.Content,
		AgentName:  fmt.Sprintf("ollama-%s", model),
		Confidence: 0.9, // Ollama is high confidence for local processing
		Tokens:     tokens,
	}, nil
}

// GetModels retrieves available models from Ollama
func (c *OllamaClient) GetModels(ctx context.Context) ([]string, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", 
		fmt.Sprintf("%s/api/tags", c.endpoint), nil)
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
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}

	err = json.Unmarshal(body, &modelsResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse models response: %w", err)
	}

	models := make([]string, len(modelsResp.Models))
	for i, model := range modelsResp.Models {
		models[i] = model.Name
	}

	return models, nil
}

// HealthCheck checks if Ollama is available
func (c *OllamaClient) HealthCheck(ctx context.Context) error {
	// Check version endpoint
	httpReq, err := http.NewRequestWithContext(ctx, "GET", 
		fmt.Sprintf("%s/api/version", c.endpoint), nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("Ollama health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Ollama health check returned status %d", resp.StatusCode)
	}

	// Get models to ensure at least one is available
	models, err := c.GetModels(ctx)
	if err != nil {
		return fmt.Errorf("failed to get models: %w", err)
	}
	
	if len(models) == 0 {
		return fmt.Errorf("Ollama has no models available")
	}
	
	c.logger.Info("Ollama health check passed",
		zap.Int("models_available", len(models)),
		zap.String("endpoint", c.endpoint),
	)
	
	return nil
}