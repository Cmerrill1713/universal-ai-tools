package models

import "time"

// Document represents a document to be stored in Weaviate
type Document struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Content     string                 `json:"content"`
	Category    string                 `json:"category"`
	Tags        []string               `json:"tags"`
	Metadata    map[string]interface{} `json:"metadata"`
	UserID      string                 `json:"user_id"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// Memory represents a memory to be stored in Weaviate
type Memory struct {
	ID          string                 `json:"id"`
	Content     string                 `json:"content"`
	MemoryType  string                 `json:"memory_type"`
	Importance  int                    `json:"importance"`
	Metadata    map[string]interface{} `json:"metadata"`
	UserID      string                 `json:"user_id"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// SearchRequest represents a search query
type SearchRequest struct {
	Query      string                 `json:"query"`
	UserID     string                 `json:"user_id"`
	Category   string                 `json:"category,omitempty"`
	Limit      int                    `json:"limit,omitempty"`
	Offset     int                    `json:"offset,omitempty"`
	Filters    map[string]interface{} `json:"filters,omitempty"`
	UseHybrid  bool                   `json:"use_hybrid,omitempty"`
	UseBM25    bool                   `json:"use_bm25,omitempty"` // For keyword search
	Alpha      float32                `json:"alpha,omitempty"` // For hybrid search
}

// SearchResult represents a search result
type SearchResult struct {
	ID         string                 `json:"id"`
	Title      string                 `json:"title"`
	Content    string                 `json:"content"`
	Category   string                 `json:"category"`
	Tags       []string               `json:"tags"`
	Metadata   map[string]interface{} `json:"metadata"`
	Score      float32                `json:"score"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

// MemoryResult represents a memory search result
type MemoryResult struct {
	ID         string                 `json:"id"`
	Content    string                 `json:"content"`
	MemoryType string                 `json:"memory_type"`
	Importance int                    `json:"importance"`
	Metadata   map[string]interface{} `json:"metadata"`
	Score      float32                `json:"score"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

// SearchResponse represents the response from a search operation
type SearchResponse struct {
	Query   string          `json:"query"`
	Results []SearchResult  `json:"results"`
	Total   int             `json:"total"`
}

// MemoryResponse represents the response from a memory search operation
type MemoryResponse struct {
	Query   string          `json:"query"`
	Results []MemoryResult  `json:"results"`
	Total   int             `json:"total"`
}
