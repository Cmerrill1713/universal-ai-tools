package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

// Message represents a chat message
type Message struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"user_id"`
	Role      string                 `json:"role"` // user, assistant, system
	Content   string                 `json:"content"`
	Model     string                 `json:"model,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Conversation represents a chat conversation
type Conversation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	Messages  []Message `json:"messages"`
	Model     string    `json:"model"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ChatRequest represents an incoming chat request
type ChatRequest struct {
	ConversationID string                 `json:"conversation_id,omitempty"`
	Message        string                 `json:"message"`
	Model          string                 `json:"model,omitempty"`
	Temperature    float32                `json:"temperature,omitempty"`
	MaxTokens      int                    `json:"max_tokens,omitempty"`
	Stream         bool                   `json:"stream,omitempty"`
	Context        map[string]interface{} `json:"context,omitempty"`
}

// ChatResponse represents a chat response
type ChatResponse struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
	Response       string `json:"response"`
	Model          string `json:"model"`
	Usage          *Usage `json:"usage,omitempty"`
}

// Usage represents token usage
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// LLMProvider interface for different LLM providers
type LLMProvider interface {
	Complete(ctx context.Context, messages []Message, options map[string]interface{}) (*ChatResponse, error)
	Stream(ctx context.Context, messages []Message, options map[string]interface{}, ch chan<- string) error
}

// ChatService manages chat operations
type ChatService struct {
	mu            sync.RWMutex
	conversations map[string]*Conversation
	providers     map[string]LLMProvider
	upgrader      websocket.Upgrader
}

// OpenAIProvider implements OpenAI API
type OpenAIProvider struct {
	apiKey  string
	baseURL string
}

// LocalLLMProvider implements local LLM API
type LocalLLMProvider struct {
	endpoint string
}

var chatService *ChatService

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found")
	}

	// Initialize chat service
	chatService = &ChatService{
		conversations: make(map[string]*Conversation),
		providers:     make(map[string]LLMProvider),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Configure for production
			},
		},
	}

	// Initialize LLM providers
	initProviders()
}

func initProviders() {
	// OpenAI provider
	if apiKey := os.Getenv("OPENAI_API_KEY"); apiKey != "" {
		chatService.providers["openai"] = &OpenAIProvider{
			apiKey:  apiKey,
			baseURL: getEnvOrDefault("OPENAI_BASE_URL", "https://api.openai.com/v1"),
		}
	}

	// Local LLM provider (LM Studio, Ollama, etc.)
	if endpoint := os.Getenv("LOCAL_LLM_ENDPOINT"); endpoint != "" {
		chatService.providers["local"] = &LocalLLMProvider{
			endpoint: endpoint,
		}
	}

	// Default to local if available
	if _, exists := chatService.providers["local"]; !exists {
		chatService.providers["local"] = &LocalLLMProvider{
			endpoint: "http://localhost:1234/v1",
		}
	}

	log.Printf("Initialized %d LLM providers", len(chatService.providers))
}

// OpenAI Provider Implementation
func (p *OpenAIProvider) Complete(ctx context.Context, messages []Message, options map[string]interface{}) (*ChatResponse, error) {
	// Convert messages to OpenAI format
	openAIMessages := make([]map[string]string, len(messages))
	for i, msg := range messages {
		openAIMessages[i] = map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		}
	}

	// Prepare request
	reqBody := map[string]interface{}{
		"model":       options["model"],
		"messages":    openAIMessages,
		"temperature": options["temperature"],
		"max_tokens":  options["max_tokens"],
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	// Make request
	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Parse response
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	return &ChatResponse{
		MessageID: uuid.New().String(),
		Response:  result.Choices[0].Message.Content,
		Model:     options["model"].(string),
		Usage: &Usage{
			PromptTokens:     result.Usage.PromptTokens,
			CompletionTokens: result.Usage.CompletionTokens,
			TotalTokens:      result.Usage.TotalTokens,
		},
	}, nil
}

func (p *OpenAIProvider) Stream(ctx context.Context, messages []Message, options map[string]interface{}, ch chan<- string) error {
	// Similar to Complete but with streaming
	defer close(ch)

	// Implementation would use SSE for streaming
	// Simplified for brevity
	response, err := p.Complete(ctx, messages, options)
	if err != nil {
		return err
	}

	// Simulate streaming
	words := strings.Split(response.Response, " ")
	for _, word := range words {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case ch <- word + " ":
			time.Sleep(50 * time.Millisecond)
		}
	}

	return nil
}

// Local LLM Provider Implementation
func (p *LocalLLMProvider) Complete(ctx context.Context, messages []Message, options map[string]interface{}) (*ChatResponse, error) {
	// Convert messages to local LLM format
	localMessages := make([]map[string]string, len(messages))
	for i, msg := range messages {
		localMessages[i] = map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		}
	}

	// Prepare request
	reqBody := map[string]interface{}{
		"messages":    localMessages,
		"temperature": options["temperature"],
		"max_tokens":  options["max_tokens"],
		"stream":      false,
	}

	if model, ok := options["model"].(string); ok {
		reqBody["model"] = model
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	// Get the last user message for Ollama
	var userMessage string
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			userMessage = messages[i].Content
			break
		}
	}

	if userMessage == "" {
		return nil, fmt.Errorf("no user message found")
	}

	// Prepare Ollama request
	reqBody = map[string]interface{}{
		"model":  "llama2",
		"prompt": userMessage,
		"stream": false,
	}

	if temp, ok := options["temperature"].(float64); ok {
		reqBody["temperature"] = temp
	}

	jsonData, marshalErr := json.Marshal(reqBody)
	if marshalErr != nil {
		return nil, marshalErr
	}

	// Make request to Ollama API
	req, requestErr := http.NewRequestWithContext(ctx, "POST", p.endpoint+"/generate", bytes.NewBuffer(jsonData))
	if requestErr != nil {
		return nil, requestErr
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, doErr := client.Do(req)
	if doErr != nil {
		return nil, doErr
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Ollama API error: %d - %s", resp.StatusCode, string(body))
	}

	var ollamaResponse struct {
		Response string `json:"response"`
		Done     bool   `json:"done"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&ollamaResponse); err != nil {
		return nil, fmt.Errorf("failed to parse Ollama response: %w", err)
	}

	if !ollamaResponse.Done {
		return nil, fmt.Errorf("response not complete")
	}

	return &ChatResponse{
		MessageID: uuid.New().String(),
		Response:  ollamaResponse.Response,
		Model:     "llama2",
	}, nil
}

func (p *LocalLLMProvider) Stream(ctx context.Context, messages []Message, options map[string]interface{}, ch chan<- string) error {
	defer close(ch)

	// Get the complete response first
	response, err := p.Complete(ctx, messages, options)
	if err != nil {
		return err
	}

	// Simulate streaming by splitting the response into words
	words := strings.Split(response.Response, " ")
	for _, word := range words {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case ch <- word + " ":
			time.Sleep(50 * time.Millisecond)
		}
	}

	return nil
}

// API Handlers

func chatHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from auth header
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Set defaults
	if req.Model == "" {
		req.Model = "local"
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 2000
	}

	// Get or create conversation
	var conv *Conversation
	if req.ConversationID != "" {
		chatService.mu.RLock()
		conv = chatService.conversations[req.ConversationID]
		chatService.mu.RUnlock()
	}

	if conv == nil {
		conv = &Conversation{
			ID:        uuid.New().String(),
			UserID:    userID,
			Title:     generateTitle(req.Message),
			Messages:  []Message{},
			Model:     req.Model,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
	}

	// Add user message
	userMessage := Message{
		ID:        uuid.New().String(),
		UserID:    userID,
		Role:      "user",
		Content:   req.Message,
		Timestamp: time.Now(),
	}
	conv.Messages = append(conv.Messages, userMessage)

	// Get provider
	provider, exists := chatService.providers[req.Model]
	if !exists {
		// Fallback to local
		provider = chatService.providers["local"]
		if provider == nil {
			http.Error(w, "No LLM provider available", http.StatusServiceUnavailable)
			return
		}
	}

	// Prepare options
	options := map[string]interface{}{
		"model":       req.Model,
		"temperature": req.Temperature,
		"max_tokens":  req.MaxTokens,
	}

	// Handle streaming
	if req.Stream {
		handleStreamingChat(w, r, conv, provider, options)
		return
	}

	// Get completion
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	response, err := provider.Complete(ctx, conv.Messages, options)
	if err != nil {
		log.Printf("LLM completion error: %v", err)
		http.Error(w, "Failed to generate response", http.StatusInternalServerError)
		return
	}

	// Add assistant message
	assistantMessage := Message{
		ID:        response.MessageID,
		UserID:    userID,
		Role:      "assistant",
		Content:   response.Response,
		Model:     req.Model,
		Timestamp: time.Now(),
	}
	conv.Messages = append(conv.Messages, assistantMessage)
	conv.UpdatedAt = time.Now()

	// Save conversation
	chatService.mu.Lock()
	chatService.conversations[conv.ID] = conv
	chatService.mu.Unlock()

	// Send response
	response.ConversationID = conv.ID

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleStreamingChat(w http.ResponseWriter, r *http.Request, conv *Conversation, provider LLMProvider, options map[string]interface{}) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Create channel for streaming
	ch := make(chan string, 100)

	// Start streaming in goroutine
	go func() {
		ctx := r.Context()
		if err := provider.Stream(ctx, conv.Messages, options, ch); err != nil {
			log.Printf("Streaming error: %v", err)
		}
	}()

	// Stream to client
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	for {
		select {
		case chunk, ok := <-ch:
			if !ok {
				// Stream complete
				fmt.Fprintf(w, "data: [DONE]\n\n")
				flusher.Flush()
				return
			}

			// Send chunk
			data := map[string]string{
				"chunk": chunk,
			}
			jsonData, _ := json.Marshal(data)
			fmt.Fprintf(w, "data: %s\n\n", jsonData)
			flusher.Flush()

		case <-r.Context().Done():
			// Client disconnected
			return
		}
	}
}

func conversationsHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	chatService.mu.RLock()
	defer chatService.mu.RUnlock()

	// Get user's conversations
	conversations := []*Conversation{}
	for _, conv := range chatService.conversations {
		if conv.UserID == userID {
			conversations = append(conversations, conv)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversations": conversations,
		"total":         len(conversations),
	})
}

func conversationHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	convID := vars["id"]

	chatService.mu.RLock()
	conv, exists := chatService.conversations[convID]
	chatService.mu.RUnlock()

	if !exists || conv.UserID != userID {
		http.Error(w, "Conversation not found", http.StatusNotFound)
		return
	}

	switch r.Method {
	case http.MethodGet:
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(conv)

	case http.MethodDelete:
		chatService.mu.Lock()
		delete(chatService.conversations, convID)
		chatService.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := chatService.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Handle WebSocket chat
	for {
		var req ChatRequest
		if err := conn.ReadJSON(&req); err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}

		// Process chat request
		// Similar to HTTP handler but send response via WebSocket
		// Implementation simplified for brevity
	}
}

func generateTitle(message string) string {
	// Generate a title from the first message
	if len(message) > 50 {
		return message[:47] + "..."
	}
	return message
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":    "healthy",
		"service":   "chat-service",
		"providers": len(chatService.providers),
		"timestamp": time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func main() {
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", healthHandler).Methods("GET")

	// Chat endpoints
	router.HandleFunc("/chat", chatHandler).Methods("POST")
	router.HandleFunc("/conversations", conversationsHandler).Methods("GET")
	router.HandleFunc("/conversations/{id}", conversationHandler).Methods("GET", "DELETE")
	router.HandleFunc("/ws/chat", wsHandler)

	// Start server
	port := getEnvOrDefault("CHAT_SERVICE_PORT", "8016")
	log.Printf("Chat Service starting on port %s", port)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
