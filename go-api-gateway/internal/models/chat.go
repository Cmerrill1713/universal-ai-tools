// Chat models and structures
// Compatible with TypeScript chat API responses

package models

import "time"

// ChatMessage represents a chat message
type ChatMessage struct {
	ID        string        `json:"id" db:"id"`
	Role      string        `json:"role" db:"role"` // user, assistant, system
	Content   string        `json:"content" db:"content"`
	Timestamp time.Time     `json:"timestamp" db:"created_at"`
	Metadata  *ChatMetadata `json:"metadata,omitempty" db:"metadata"`
}

// ChatMetadata contains additional message metadata
type ChatMetadata struct {
	AgentName      string       `json:"agentName,omitempty"`
	Confidence     float64      `json:"confidence,omitempty"`
	Tokens         int          `json:"tokens,omitempty"`
	Error          string       `json:"error,omitempty"`
	ProcessingMode string       `json:"processingMode,omitempty"`
	UserID         string       `json:"userId,omitempty"`
	CodeContext    *CodeContext `json:"codeContext,omitempty"`
}

// CodeContext represents code context information
type CodeContext struct {
	Enabled          bool   `json:"enabled"`
	FilesIncluded    int    `json:"filesIncluded"`
	FilesScanned     int    `json:"filesScanned"`
	TotalTokens      int    `json:"totalTokens"`
	WorkspacePath    string `json:"workspacePath"`
	ContextTruncated bool   `json:"contextTruncated"`
}

// Conversation represents a chat conversation
type Conversation struct {
	ID        string               `json:"id" db:"id"`
	UserID    string               `json:"userId" db:"user_id"`
	Title     string               `json:"title" db:"title"`
	Messages  []ChatMessage        `json:"messages"`
	CreatedAt time.Time            `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time            `json:"updatedAt" db:"updated_at"`
	Metadata  ConversationMetadata `json:"metadata"`
}

// ConversationMetadata contains conversation statistics
type ConversationMetadata struct {
	TotalTokens int            `json:"totalTokens"`
	AgentUsage  map[string]int `json:"agentUsage"`
}

// ChatRequest represents an incoming chat request
type ChatRequest struct {
	Message            string                 `json:"message" binding:"required"`
	ConversationID     string                 `json:"conversationId,omitempty"`
	AgentName          string                 `json:"agentName,omitempty"`
	Context            map[string]interface{} `json:"context,omitempty"`
	IncludeCodeContext bool                   `json:"includeCodeContext,omitempty"`
	CodeContextOptions *CodeContextOptions    `json:"codeContextOptions,omitempty"`
	ForceRealAI        bool                   `json:"forceRealAI,omitempty"`
	QuickResponse      bool                   `json:"quickResponse,omitempty"`
}

// CodeContextOptions represents options for code context scanning
type CodeContextOptions struct {
	WorkspacePath    string `json:"workspacePath,omitempty"`
	MaxFiles         int    `json:"maxFiles,omitempty"`
	MaxTokensForCode int    `json:"maxTokensForCode,omitempty"`
}

// ChatResponse represents a chat API response
type ChatResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Message         string       `json:"message"`
		Response        string       `json:"response"`
		ConversationID  string       `json:"conversationId"`
		FullMessage     *ChatMessage `json:"fullMessage,omitempty"`
		Usage           Usage        `json:"usage"`
		CodeContext     *CodeContext `json:"codeContext"`
		SessionID       string       `json:"sessionId,omitempty"`
		StatusStreamURL string       `json:"statusStreamUrl,omitempty"`
	} `json:"data"`
	Metadata Metadata `json:"metadata"`
}

// Usage represents token and performance usage
type Usage struct {
	Tokens        int    `json:"tokens"`
	ExecutionTime string `json:"executionTime"`
}

// Metadata represents response metadata
type Metadata struct {
	Timestamp      string `json:"timestamp"`
	RequestID      string `json:"requestId"`
	AgentName      string `json:"agentName,omitempty"`
	UserID         string `json:"userId,omitempty"`
	EnhancedChat   bool   `json:"enhancedChat,omitempty"`
	Implementation string `json:"implementation,omitempty"`
	Performance    string `json:"performance,omitempty"`
}

// ConversationListResponse represents conversation list response
type ConversationListResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Conversations []ConversationSummary `json:"conversations"`
		Total         int                   `json:"total"`
	} `json:"data"`
	Metadata Metadata `json:"metadata"`
}

// ConversationSummary represents a conversation summary
type ConversationSummary struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	MessageCount int       `json:"messageCount"`
	LastMessage  string    `json:"lastMessage"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// NewConversationRequest represents new conversation request
type NewConversationRequest struct {
	Title          string `json:"title,omitempty"`
	InitialMessage string `json:"initialMessage,omitempty"`
}
