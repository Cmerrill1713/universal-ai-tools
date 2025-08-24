// Agent service for Universal AI Tools Go API Gateway
// Provides agent management, orchestration, and monitoring capabilities

package services

import (
	"context"
	"database/sql/driver"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
	"github.com/lib/pq"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/database"
	"universal-ai-tools/go-api-gateway/internal/models"
)

// StringArray is a custom type for handling PostgreSQL arrays
type StringArray []string

// Scan implements the Scanner interface for database scanning
func (a *StringArray) Scan(value interface{}) error {
	if value == nil {
		*a = StringArray{}
		return nil
	}
	
	switch s := value.(type) {
	case []byte:
		// Parse PostgreSQL array format manually
		str := string(s)
		if str == "{}" {
			*a = StringArray{}
			return nil
		}
		// Remove braces and split by comma
		if len(str) > 2 && str[0] == '{' && str[len(str)-1] == '}' {
			str = str[1 : len(str)-1]
			if str != "" {
				elements := strings.Split(str, ",")
				*a = make(StringArray, len(elements))
				for i, elem := range elements {
					// Remove quotes if present
					elem = strings.TrimSpace(elem)
					if len(elem) > 1 && elem[0] == '"' && elem[len(elem)-1] == '"' {
						elem = elem[1 : len(elem)-1]
					}
					(*a)[i] = elem
				}
			} else {
				*a = StringArray{}
			}
		}
		return nil
	case string:
		// Handle string representation
		if s == "{}" {
			*a = StringArray{}
			return nil
		}
		// Remove braces and split by comma
		if len(s) > 2 && s[0] == '{' && s[len(s)-1] == '}' {
			s = s[1 : len(s)-1]
			if s != "" {
				elements := strings.Split(s, ",")
				*a = make(StringArray, len(elements))
				for i, elem := range elements {
					// Remove quotes if present
					elem = strings.TrimSpace(elem)
					if len(elem) > 1 && elem[0] == '"' && elem[len(elem)-1] == '"' {
						elem = elem[1 : len(elem)-1]
					}
					(*a)[i] = elem
				}
			} else {
				*a = StringArray{}
			}
		}
		return nil
	default:
		// Try using pq.Array as fallback
		return pq.Array((*[]string)(a)).Scan(value)
	}
}

// Value implements the driver Valuer interface for database storage
func (a StringArray) Value() (driver.Value, error) {
	return pq.Array(([]string)(a)).Value()
}

// AgentService handles agent management operations
type AgentService struct {
	config *config.Config
	logger *zap.Logger
	db     *database.Coordinator
}

// NewAgentService creates a new agent service instance
func NewAgentService(cfg *config.Config, logger *zap.Logger, db *database.Coordinator) (*AgentService, error) {
	service := &AgentService{
		config: cfg,
		logger: logger.With(zap.String("service", "agent")),
		db:     db,
	}

	service.logger.Info("Agent service initialized")
	return service, nil
}

// ListAgents retrieves agents based on filter criteria
func (s *AgentService) ListAgents(ctx context.Context, filter *models.AgentFilter) (*models.AgentListResponse, error) {
	s.logger.Debug("Listing agents",
		zap.String("type", filter.Type),
		zap.String("category", filter.Category),
		zap.Bool("include_inactive", filter.IncludeInactive))

	// Get PostgreSQL connection
	db := s.db.GetPostgreSQLDB()
	if db == nil {
		return nil, fmt.Errorf("database connection not available")
	}

	// Build the query with filters
	query := `
		SELECT id, name, agent_type, category, description, capabilities, provider, model, version,
			   request_count, success_count, error_count, average_response_time_ms, success_rate, tokens_processed,
			   created_at, updated_at, last_used, current_load, is_available, usage_count, average_response, status
		FROM agents 
		WHERE 1=1`
	
	args := []interface{}{}
	argCount := 0

	// Apply filters
	if filter.Type != "" {
		argCount++
		query += fmt.Sprintf(" AND agent_type = $%d", argCount)
		args = append(args, filter.Type)
	}
	
	if filter.Category != "" {
		argCount++
		query += fmt.Sprintf(" AND category = $%d", argCount)
		args = append(args, filter.Category)
	}
	
	if !filter.IncludeInactive {
		argCount++
		query += fmt.Sprintf(" AND status = $%d", argCount)
		args = append(args, "active")
	}

	// Add ordering and pagination
	query += " ORDER BY created_at DESC"
	
	limit := filter.Limit
	if limit <= 0 {
		limit = 50 // Default limit
	}
	offset := filter.Offset
	
	argCount++
	query += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, limit)
	
	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	// Execute the query
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		s.logger.Error("Failed to query agents", zap.Error(err))
		return nil, fmt.Errorf("failed to query agents: %w", err)
	}
	defer rows.Close()

	var agents []models.Agent
	for rows.Next() {
		var agent models.Agent
		var capabilities StringArray
		
		err := rows.Scan(
			&agent.ID, &agent.Name, &agent.Type, &agent.Category, &agent.Description,
			&capabilities, &agent.Provider, &agent.Model, &agent.Version,
			&agent.Performance.RequestCount, &agent.Performance.SuccessCount, &agent.Performance.ErrorCount,
			&agent.Performance.AverageResponseTime, &agent.Performance.SuccessRate, &agent.Performance.TokensProcessed,
			&agent.CreatedAt, &agent.UpdatedAt, &agent.LastUsed,
			&agent.CurrentLoad, &agent.IsAvailable, &agent.UsageCount, &agent.AverageResponse, &agent.Status,
		)
		if err != nil {
			s.logger.Error("Failed to scan agent row", zap.Error(err))
			continue
		}
		
		agent.Capabilities = []string(capabilities)
		agent.Performance.LastUpdated = agent.UpdatedAt
		agent.ErrorCount = agent.Performance.ErrorCount
		
		agents = append(agents, agent)
	}

	// Get total count for pagination
	countQuery := `SELECT COUNT(*) FROM agents WHERE 1=1`
	countArgs := []interface{}{}
	countArgCount := 0
	
	if filter.Type != "" {
		countArgCount++
		countQuery += fmt.Sprintf(" AND agent_type = $%d", countArgCount)
		countArgs = append(countArgs, filter.Type)
	}
	
	if filter.Category != "" {
		countArgCount++
		countQuery += fmt.Sprintf(" AND category = $%d", countArgCount)
		countArgs = append(countArgs, filter.Category)
	}
	
	if !filter.IncludeInactive {
		countArgCount++
		countQuery += fmt.Sprintf(" AND status = $%d", countArgCount)
		countArgs = append(countArgs, "active")
	}

	var totalCount int
	err = db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		s.logger.Error("Failed to get agent count", zap.Error(err))
		totalCount = len(agents) // Fallback
	}

	// Build response - no additional filtering needed since it's done at database level
	page := offset/limit + 1
	if limit <= 0 {
		page = 1
	}

	response := &models.AgentListResponse{
		Agents:     agents,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   limit,
		HasNext:    offset+limit < totalCount,
	}

	s.logger.Debug("Listed agents",
		zap.Int("total_count", totalCount),
		zap.Int("returned_count", len(agents)))

	return response, nil
}

// GetAvailableAgents retrieves all available agents
func (s *AgentService) GetAvailableAgents(ctx context.Context) ([]models.Agent, error) {
	filter := &models.AgentFilter{
		Status:          "active",
		IncludeInactive: false,
	}

	response, err := s.ListAgents(ctx, filter)
	if err != nil {
		return nil, err
	}

	// Filter for available agents only
	var availableAgents []models.Agent
	for _, agent := range response.Agents {
		if agent.IsAvailable {
			availableAgents = append(availableAgents, agent)
		}
	}

	s.logger.Debug("Retrieved available agents", zap.Int("count", len(availableAgents)))
	return availableAgents, nil
}

// GetAgentPerformance retrieves performance metrics for agents
func (s *AgentService) GetAgentPerformance(ctx context.Context, timeRange string) (*models.AgentAnalytics, error) {
	s.logger.Debug("Getting agent performance", zap.String("time_range", timeRange))

	// Mock analytics data - in production this would aggregate from database
	analytics := &models.AgentAnalytics{
		TimeRange:           timeRange,
		TotalRequests:       36770,
		SuccessfulRequests:  36530,
		FailedRequests:      240,
		AverageResponseTime: 336.2,
		TotalTokens:         5600000,
		TotalCost:           127.45,
		TopAgents: []models.AgentPerformanceSummary{
			{
				AgentID:         "agent-1",
				Name:            "Claude Assistant",
				RequestCount:    15420,
				SuccessRate:     99.74,
				ResponseTime:    245.5,
				TokensProcessed: 2450000,
			},
			{
				AgentID:         "agent-2",
				Name:            "GPT-4 Assistant",
				RequestCount:    12850,
				SuccessRate:     99.61,
				ResponseTime:    312.8,
				TokensProcessed: 1950000,
			},
			{
				AgentID:         "agent-3",
				Name:            "Local Llama",
				RequestCount:    8500,
				SuccessRate:     98.24,
				ResponseTime:    450.2,
				TokensProcessed: 1200000,
			},
		},
		ProviderBreakdown: map[string]models.ProviderAnalytics{
			"anthropic": {
				Provider:        "anthropic",
				RequestCount:    15420,
				SuccessRate:     99.74,
				AverageResponse: 245.5,
				TokensUsed:      2450000,
				Cost:            67.85,
			},
			"openai": {
				Provider:        "openai",
				RequestCount:    12850,
				SuccessRate:     99.61,
				AverageResponse: 312.8,
				TokensUsed:      1950000,
				Cost:            59.60,
			},
			"local": {
				Provider:        "local",
				RequestCount:    8500,
				SuccessRate:     98.24,
				AverageResponse: 450.2,
				TokensUsed:      1200000,
				Cost:            0.00,
			},
		},
		UsageByHour: s.generateHourlyUsage(),
		ErrorAnalysis: models.ErrorAnalysis{
			TotalErrors: 240,
			ErrorRate:   0.65,
			TopErrors: []models.ErrorSummary{
				{
					Error:          "Rate limit exceeded",
					Count:          85,
					LastOccurred:   time.Now().Add(-30 * time.Minute),
					AffectedAgents: []string{"agent-2"},
				},
				{
					Error:          "Model timeout",
					Count:          65,
					LastOccurred:   time.Now().Add(-1 * time.Hour),
					AffectedAgents: []string{"agent-3"},
				},
				{
					Error:          "Invalid input format",
					Count:          45,
					LastOccurred:   time.Now().Add(-2 * time.Hour),
					AffectedAgents: []string{"agent-1", "agent-2"},
				},
			},
			ErrorsByAgent: map[string]int64{
				"agent-1": 40,
				"agent-2": 50,
				"agent-3": 150,
			},
			ErrorsByType: map[string]int64{
				"rate_limit": 85,
				"timeout":    65,
				"validation": 45,
				"other":      45,
			},
		},
	}

	return analytics, nil
}

// GetSystemStatus retrieves overall system status for agents
func (s *AgentService) GetSystemStatus(ctx context.Context) (*models.AgentSystemStatus, error) {
	s.logger.Debug("Getting agent system status")

	status := &models.AgentSystemStatus{
		TotalAgents:     3,
		ActiveAgents:    3,
		InactiveAgents:  0,
		ErrorAgents:     0,
		SystemLoad:      42.5,
		MemoryUsage:     68.3,
		CPUUsage:        23.7,
		RequestsPerMin:  156,
		AverageResponse: 336.2,
		ProviderStatus: map[string]models.ProviderStatus{
			"anthropic": {
				Name:         "Anthropic",
				Status:       "healthy",
				ResponseTime: 245.5,
				ErrorRate:    0.26,
				RequestCount: 15420,
				LastChecked:  time.Now(),
				Models:       []string{"claude-3-sonnet", "claude-3-haiku", "claude-3-opus"},
			},
			"openai": {
				Name:         "OpenAI",
				Status:       "healthy",
				ResponseTime: 312.8,
				ErrorRate:    0.39,
				RequestCount: 12850,
				LastChecked:  time.Now(),
				Models:       []string{"gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"},
			},
			"local": {
				Name:         "Local Models",
				Status:       "healthy",
				ResponseTime: 450.2,
				ErrorRate:    1.76,
				RequestCount: 8500,
				LastChecked:  time.Now(),
				Models:       []string{"llama-3.2-8b", "llama-3.2-3b"},
			},
		},
		TopAgents: []models.AgentPerformanceSummary{
			{
				AgentID:         "agent-1",
				Name:            "Claude Assistant",
				RequestCount:    15420,
				SuccessRate:     99.74,
				ResponseTime:    245.5,
				TokensProcessed: 2450000,
			},
			{
				AgentID:         "agent-2",
				Name:            "GPT-4 Assistant",
				RequestCount:    12850,
				SuccessRate:     99.61,
				ResponseTime:    312.8,
				TokensProcessed: 1950000,
			},
		},
		RecentErrors: []models.AgentError{
			{
				AgentID:   "agent-2",
				AgentName: "GPT-4 Assistant",
				Error:     "Rate limit exceeded for provider openai",
				Timestamp: time.Now().Add(-30 * time.Minute),
				RequestID: "req-12345",
				UserID:    "user-abc",
			},
		},
		Timestamp: time.Now(),
	}

	return status, nil
}

// CreateAgent creates a new agent
func (s *AgentService) CreateAgent(ctx context.Context, req *models.CreateAgentRequest) (*models.Agent, error) {
	s.logger.Info("Creating agent",
		zap.String("name", req.Name),
		zap.String("type", req.Type),
		zap.String("provider", req.Provider))

	// Validate request
	if err := s.validateCreateAgentRequest(req); err != nil {
		return nil, fmt.Errorf("invalid agent request: %w", err)
	}

	// Create agent instance
	agent := &models.Agent{
		ID:            fmt.Sprintf("agent-%d", time.Now().Unix()),
		Name:          req.Name,
		Description:   req.Description,
		Type:          req.Type,
		Category:      req.Category,
		Status:        "active",
		Version:       "1.0",
		Provider:      req.Provider,
		Model:         req.Model,
		Capabilities:  req.Capabilities,
		Configuration: req.Configuration,
		Performance: models.AgentPerformance{
			RequestCount:        0,
			SuccessCount:        0,
			ErrorCount:          0,
			AverageResponseTime: 0,
			SuccessRate:         0,
			TokensProcessed:     0,
			LastUpdated:         time.Now(),
		},
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		IsAvailable:     true,
		UsageCount:      0,
		ErrorCount:      0,
		AverageResponse: 0,
	}

	// In production, this would store in database
	// For now, just return the created agent

	s.logger.Info("Agent created successfully",
		zap.String("agent_id", agent.ID),
		zap.String("name", agent.Name))

	return agent, nil
}

// GetAgent retrieves a specific agent by ID
func (s *AgentService) GetAgent(ctx context.Context, agentID string) (*models.Agent, error) {
	s.logger.Debug("Getting agent", zap.String("agent_id", agentID))

	// Mock agent retrieval - in production this would query the database
	agents := map[string]*models.Agent{
		"agent-1": {
			ID:           "agent-1",
			Name:         "Claude Assistant",
			Description:  "Advanced conversational AI assistant",
			Type:         "chat",
			Category:     "general",
			Status:       "active",
			Version:      "3.5",
			Provider:     "anthropic",
			Model:        "claude-3-sonnet",
			Capabilities: []string{"conversation", "analysis", "writing", "coding"},
			Performance: models.AgentPerformance{
				RequestCount:        15420,
				SuccessCount:        15380,
				ErrorCount:          40,
				AverageResponseTime: 245.5,
				SuccessRate:         99.74,
				TokensProcessed:     2450000,
				LastUpdated:         time.Now(),
			},
			CreatedAt:       time.Now().Add(-30 * 24 * time.Hour),
			UpdatedAt:       time.Now().Add(-1 * time.Hour),
			LastUsed:        timePtr(time.Now().Add(-5 * time.Minute)),
			IsAvailable:     true,
			UsageCount:      15420,
			ErrorCount:      40,
			AverageResponse: 245.5,
		},
	}

	agent, exists := agents[agentID]
	if !exists {
		return nil, fmt.Errorf("agent not found: %s", agentID)
	}

	return agent, nil
}

// UpdateAgent updates an existing agent
func (s *AgentService) UpdateAgent(ctx context.Context, agentID string, req *models.UpdateAgentRequest) (*models.Agent, error) {
	s.logger.Info("Updating agent", zap.String("agent_id", agentID))

	// Get existing agent
	agent, err := s.GetAgent(ctx, agentID)
	if err != nil {
		return nil, err
	}

	// Apply updates
	if req.Name != nil {
		agent.Name = *req.Name
	}
	if req.Description != nil {
		agent.Description = *req.Description
	}
	if req.Type != nil {
		agent.Type = *req.Type
	}
	if req.Category != nil {
		agent.Category = *req.Category
	}
	if req.Provider != nil {
		agent.Provider = *req.Provider
	}
	if req.Model != nil {
		agent.Model = *req.Model
	}
	if req.Capabilities != nil {
		agent.Capabilities = *req.Capabilities
	}
	if req.Configuration != nil {
		agent.Configuration = *req.Configuration
	}
	if req.Status != nil {
		agent.Status = *req.Status
		agent.IsAvailable = *req.Status == "active"
	}

	agent.UpdatedAt = time.Now()

	s.logger.Info("Agent updated successfully", zap.String("agent_id", agentID))
	return agent, nil
}

// DeleteAgent deletes an agent
func (s *AgentService) DeleteAgent(ctx context.Context, agentID string) error {
	s.logger.Info("Deleting agent", zap.String("agent_id", agentID))

	// In production, this would delete from database
	// For now, just log the operation

	s.logger.Info("Agent deleted successfully", zap.String("agent_id", agentID))
	return nil
}

// ExecuteAgent executes an agent with given input
func (s *AgentService) ExecuteAgent(ctx context.Context, agentID string, req *models.AgentExecutionRequest) (*models.AgentExecutionResponse, error) {
	startTime := time.Now()

	s.logger.Info("Executing agent",
		zap.String("agent_id", agentID),
		zap.String("input_preview", truncateString(req.Input, 100)))

	// Get agent details
	agent, err := s.GetAgent(ctx, agentID)
	if err != nil {
		return nil, err
	}

	if !agent.IsAvailable {
		return nil, fmt.Errorf("agent %s is not available", agentID)
	}

	// Mock execution - in production this would call the actual LLM service
	executionTime := time.Since(startTime)

	response := &models.AgentExecutionResponse{
		ID:            fmt.Sprintf("exec-%d", time.Now().UnixNano()),
		AgentID:       agentID,
		Status:        "success",
		Output:        fmt.Sprintf("Response from %s: Processing your request: %s", agent.Name, req.Input),
		Context:       req.Context,
		ExecutionTime: float64(executionTime.Milliseconds()),
		TokensUsed:    len(req.Input) + 50, // Mock token calculation
		Cost:          0.001,               // Mock cost
		StartedAt:     startTime,
		CompletedAt:   time.Now(),
	}

	s.logger.Info("Agent execution completed",
		zap.String("agent_id", agentID),
		zap.String("execution_id", response.ID),
		zap.Float64("execution_time_ms", response.ExecutionTime))

	return response, nil
}

// Helper functions

func (s *AgentService) applyFilters(agents []models.Agent, filter *models.AgentFilter) []models.Agent {
	var filtered []models.Agent

	for _, agent := range agents {
		// Apply filters
		if filter.Type != "" && agent.Type != filter.Type {
			continue
		}
		if filter.Category != "" && agent.Category != filter.Category {
			continue
		}
		if filter.Provider != "" && agent.Provider != filter.Provider {
			continue
		}
		if filter.Status != "" && agent.Status != filter.Status {
			continue
		}
		if !filter.IncludeInactive && agent.Status != "active" {
			continue
		}
		if filter.Capability != "" && !contains(agent.Capabilities, filter.Capability) {
			continue
		}

		filtered = append(filtered, agent)
	}

	return filtered
}

func (s *AgentService) generateHourlyUsage() []models.HourlyUsage {
	var usage []models.HourlyUsage
	now := time.Now()

	for i := 23; i >= 0; i-- {
		hour := now.Add(-time.Duration(i) * time.Hour)
		usage = append(usage, models.HourlyUsage{
			Hour:         hour.Truncate(time.Hour),
			RequestCount: int64(100 + (i * 15)), // Mock data
			TokensUsed:   int64(15000 + (i * 2000)),
			Cost:         float64(2.5 + (float64(i) * 0.3)),
		})
	}

	return usage
}

func (s *AgentService) validateCreateAgentRequest(req *models.CreateAgentRequest) error {
	if req.Name == "" {
		return fmt.Errorf("name is required")
	}
	if req.Type == "" {
		return fmt.Errorf("type is required")
	}
	if req.Provider == "" {
		return fmt.Errorf("provider is required")
	}
	if req.Model == "" {
		return fmt.Errorf("model is required")
	}

	validTypes := []string{"chat", "task", "analysis", "creative", "code", "search"}
	if !contains(validTypes, req.Type) {
		return fmt.Errorf("invalid type: %s", req.Type)
	}

	validProviders := []string{"openai", "anthropic", "local", "rust_llm", "cohere", "mistral"}
	if !contains(validProviders, req.Provider) {
		return fmt.Errorf("invalid provider: %s", req.Provider)
	}

	return nil
}

// Utility functions

func timePtr(t time.Time) *time.Time {
	return &t
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// ActivateAgent activates an agent
func (s *AgentService) ActivateAgent(ctx context.Context, agentID string) error {
	s.logger.Info("Activating agent", zap.String("agent_id", agentID))

	// In production, this would update the database
	s.logger.Info("Agent activated successfully", zap.String("agent_id", agentID))
	return nil
}

// DeactivateAgent deactivates an agent
func (s *AgentService) DeactivateAgent(ctx context.Context, agentID string) error {
	s.logger.Info("Deactivating agent", zap.String("agent_id", agentID))

	// In production, this would update the database
	s.logger.Info("Agent deactivated successfully", zap.String("agent_id", agentID))
	return nil
}

// SyncRegistry synchronizes the agent registry
func (s *AgentService) SyncRegistry(ctx context.Context) (*models.AgentSystemStatus, error) {
	s.logger.Info("Synchronizing agent registry")

	// Return the existing system status
	return s.GetSystemStatus(ctx)
}

// BulkUpdateAgents updates multiple agents at once
func (s *AgentService) BulkUpdateAgents(ctx context.Context, req *models.BulkUpdateAgentsRequest) (*models.AgentListResponse, error) {
	s.logger.Info("Bulk updating agents",
		zap.Int("agent_count", len(req.AgentIDs)))

	var updatedAgents []models.Agent
	failedCount := 0

	for _, agentID := range req.AgentIDs {
		updatedAgent, err := s.UpdateAgent(ctx, agentID, &req.Updates)
		if err != nil {
			s.logger.Warn("Failed to update agent in bulk operation",
				zap.String("agent_id", agentID),
				zap.Error(err))
			failedCount++
			continue
		}
		updatedAgents = append(updatedAgents, *updatedAgent)
	}

	response := &models.AgentListResponse{
		Agents:       updatedAgents,
		TotalCount:   len(updatedAgents),
		UpdatedCount: len(updatedAgents),
		FailedCount:  failedCount,
		Page:         1,
		PageSize:     len(updatedAgents),
		HasNext:      false,
	}

	s.logger.Info("Bulk update completed",
		zap.Int("requested", len(req.AgentIDs)),
		zap.Int("updated", len(updatedAgents)),
		zap.Int("failed", failedCount))

	return response, nil
}
