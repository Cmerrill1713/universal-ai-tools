// Context models for Universal AI Tools Go API Gateway
// Defines data structures for conversation context management and analytics

package models

import "time"

// ContextEntry represents a stored conversation context entry
type ContextEntry struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"user_id"`
	Category  string                 `json:"category"`
	Source    string                 `json:"source"`
	Content   string                 `json:"content"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

// SaveContextRequest represents a request to save conversation context
type SaveContextRequest struct {
	UserID   string                 `json:"user_id" binding:"required"`
	Category string                 `json:"category" binding:"required"`
	Source   string                 `json:"source" binding:"required"`
	Content  string                 `json:"content" binding:"required"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// StoreContextRequest represents a request to store conversation context (alias for SaveContextRequest)
type StoreContextRequest = SaveContextRequest

// BulkStoreContextRequest represents a request to store multiple context entries
type BulkStoreContextRequest struct {
	Entries []StoreContextRequest `json:"entries" binding:"required"`
}

// CleanupContextRequest represents a request to cleanup old context entries
type CleanupContextRequest struct {
	RetentionDays int      `json:"retention_days" binding:"required"`
	OlderThanDays int      `json:"older_than_days,omitempty"` // Alias for RetentionDays
	Categories    []string `json:"categories,omitempty"`
	DryRun        bool     `json:"dry_run,omitempty"`
}

// SearchContextRequest represents a request to search conversation context
type SearchContextRequest struct {
	Query    string `json:"query,omitempty"`
	Category string `json:"category,omitempty"`
	Source   string `json:"source,omitempty"`
	Limit    int    `json:"limit,omitempty"`
	Offset   int    `json:"offset,omitempty"`
}

// ContextSearchResult represents the result of a context search
type ContextSearchResult struct {
	Entries    []ContextEntry `json:"entries"`
	TotalCount int            `json:"total_count"`
	Query      string         `json:"query,omitempty"`
	Category   string         `json:"category,omitempty"`
	Source     string         `json:"source,omitempty"`
	Timestamp  time.Time      `json:"timestamp"`
}

// UpdateContextRequest represents a request to update context entry
type UpdateContextRequest struct {
	Content  *string                 `json:"content,omitempty"`
	Category *string                 `json:"category,omitempty"`
	Source   *string                 `json:"source,omitempty"`
	Metadata *map[string]interface{} `json:"metadata,omitempty"`
}

// ContextAnalytics represents analytics data for context usage
type ContextAnalytics struct {
	TimeRange         string           `json:"time_range"`
	TotalEntries      int              `json:"total_entries"`
	NewEntries        int              `json:"new_entries"`
	UpdatedEntries    int              `json:"updated_entries"`
	DeletedEntries    int              `json:"deleted_entries"`
	CategoryBreakdown map[string]int   `json:"category_breakdown"`
	SourceBreakdown   map[string]int   `json:"source_breakdown"`
	PopularQueries    []QueryStat      `json:"popular_queries"`
	UserActivity      []HourlyActivity `json:"user_activity"`
	StorageUsage      StorageStats     `json:"storage_usage"`
	Timestamp         time.Time        `json:"timestamp"`
}

// QueryStat represents statistics for a search query
type QueryStat struct {
	Query    string    `json:"query"`
	Count    int       `json:"count"`
	LastUsed time.Time `json:"last_used"`
}

// HourlyActivity represents activity statistics for a specific hour
type HourlyActivity struct {
	Hour     time.Time `json:"hour"`
	Entries  int       `json:"entries"`
	Searches int       `json:"searches"`
	Updates  int       `json:"updates"`
}

// StorageStats represents storage usage statistics
type StorageStats struct {
	TotalSize    string  `json:"total_size"`
	AverageSize  string  `json:"average_size"`
	LargestEntry string  `json:"largest_entry"`
	Compression  float64 `json:"compression_ratio"`
}

// CleanupResult represents the result of a context cleanup operation
type CleanupResult struct {
	StartTime      time.Time      `json:"start_time"`
	EndTime        time.Time      `json:"end_time"`
	Duration       time.Duration  `json:"duration"`
	CutoffDate     time.Time      `json:"cutoff_date"`
	EntriesRemoved int            `json:"entries_removed"`
	DeletedCount   int            `json:"deleted_count"` // Alias for EntriesRemoved
	SpaceFreed     string         `json:"space_freed"`
	Categories     map[string]int `json:"categories"`
}
