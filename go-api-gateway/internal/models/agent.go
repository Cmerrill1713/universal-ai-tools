// Agent models for Universal AI Tools Go API Gateway
// Defines data structures for agent management and orchestration

package models

import "time"

// Agent represents an AI agent in the system
type Agent struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description,omitempty"`
	Type            string                 `json:"type"`     // chat, task, analysis, creative, etc.
	Category        string                 `json:"category"` // general, specialized, custom
	Status          string                 `json:"status"`   // active, inactive, training, error
	Version         string                 `json:"version"`
	Provider        string                 `json:"provider"` // openai, anthropic, local, rust_llm
	Model           string                 `json:"model"`    // gpt-4, claude-3, llama-3, etc.
	Capabilities    []string               `json:"capabilities"`
	Configuration   map[string]interface{} `json:"configuration,omitempty"`
	Performance     AgentPerformance       `json:"performance"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	LastUsed        *time.Time             `json:"last_used,omitempty"`
	LastSeen        *time.Time             `json:"last_seen,omitempty"`
	CurrentLoad     float64                `json:"current_load"`
	IsAvailable     bool                   `json:"is_available"`
	UsageCount      int64                  `json:"usage_count"`
	ErrorCount      int64                  `json:"error_count"`
	AverageResponse float64                `json:"average_response_ms"`
}

// AgentPerformance tracks agent performance metrics
type AgentPerformance struct {
	RequestCount        int64     `json:"request_count"`
	SuccessCount        int64     `json:"success_count"`
	ErrorCount          int64     `json:"error_count"`
	AverageResponseTime float64   `json:"average_response_time_ms"`
	LastResponseTime    float64   `json:"last_response_time_ms"`
	SuccessRate         float64   `json:"success_rate"`
	TokensProcessed     int64     `json:"tokens_processed"`
	Cost                float64   `json:"cost_usd,omitempty"`
	LastUpdated         time.Time `json:"last_updated"`
}

// CreateAgentRequest represents a request to create a new agent
type CreateAgentRequest struct {
	Name          string                 `json:"name" binding:"required"`
	Description   string                 `json:"description,omitempty"`
	Type          string                 `json:"type" binding:"required"`
	Category      string                 `json:"category"`
	Provider      string                 `json:"provider" binding:"required"`
	Model         string                 `json:"model" binding:"required"`
	Capabilities  []string               `json:"capabilities"`
	Configuration map[string]interface{} `json:"configuration,omitempty"`
	Config        map[string]interface{} `json:"config,omitempty"` // Alias for Configuration
}

// UpdateAgentRequest represents a request to update an agent
type UpdateAgentRequest struct {
	Name          *string                 `json:"name,omitempty"`
	Description   *string                 `json:"description,omitempty"`
	Type          *string                 `json:"type,omitempty"`
	Category      *string                 `json:"category,omitempty"`
	Provider      *string                 `json:"provider,omitempty"`
	Model         *string                 `json:"model,omitempty"`
	Capabilities  *[]string               `json:"capabilities,omitempty"`
	Configuration *map[string]interface{} `json:"configuration,omitempty"`
	Status        *string                 `json:"status,omitempty"`
}

// AgentExecutionRequest represents a request to execute an agent
type AgentExecutionRequest struct {
	Input       string                 `json:"input" binding:"required"`
	Context     map[string]interface{} `json:"context,omitempty"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	StreamMode  bool                   `json:"stream_mode,omitempty"`
	MaxTokens   int                    `json:"max_tokens,omitempty"`
	Temperature float32                `json:"temperature,omitempty"`
}

// AgentExecutionResponse represents the response from agent execution
type AgentExecutionResponse struct {
	ID            string                 `json:"id"`
	AgentID       string                 `json:"agent_id"`
	Status        string                 `json:"status"` // success, error, timeout
	Output        string                 `json:"output"`
	Context       map[string]interface{} `json:"context,omitempty"`
	ExecutionTime float64                `json:"execution_time_ms"`
	TokensUsed    int                    `json:"tokens_used,omitempty"`
	Cost          float64                `json:"cost_usd,omitempty"`
	Error         string                 `json:"error,omitempty"`
	StartedAt     time.Time              `json:"started_at"`
	CompletedAt   time.Time              `json:"completed_at"`
}

// AgentFilter represents filtering options for listing agents
type AgentFilter struct {
	Type            string   `json:"type,omitempty"`
	Category        string   `json:"category,omitempty"`
	Provider        string   `json:"provider,omitempty"`
	Status          string   `json:"status,omitempty"`
	Capabilities    []string `json:"capabilities,omitempty"`
	IncludeInactive bool     `json:"include_inactive,omitempty"`
	Capability      string   `json:"capability,omitempty"`
	SortBy          string   `json:"sort_by,omitempty"`    // name, created_at, usage_count, performance
	SortOrder       string   `json:"sort_order,omitempty"` // asc, desc
	Limit           int      `json:"limit,omitempty"`
	Offset          int      `json:"offset,omitempty"`
}

// BulkUpdateAgentsRequest represents a request to update multiple agents
type BulkUpdateAgentsRequest struct {
	AgentIDs []string           `json:"agent_ids" binding:"required"`
	Updates  UpdateAgentRequest `json:"updates" binding:"required"`
}

// AgentSystemStatus represents overall system status for agents
type AgentSystemStatus struct {
	TotalAgents     int                       `json:"total_agents"`
	ActiveAgents    int                       `json:"active_agents"`
	InactiveAgents  int                       `json:"inactive_agents"`
	ErrorAgents     int                       `json:"error_agents"`
	SystemLoad      float64                   `json:"system_load"`
	MemoryUsage     float64                   `json:"memory_usage_percent"`
	CPUUsage        float64                   `json:"cpu_usage_percent"`
	RequestsPerMin  int64                     `json:"requests_per_minute"`
	AverageResponse float64                   `json:"average_response_time_ms"`
	ProviderStatus  map[string]ProviderStatus `json:"provider_status"`
	TopAgents       []AgentPerformanceSummary `json:"top_agents"`
	RecentErrors    []AgentError              `json:"recent_errors,omitempty"`
	Timestamp       time.Time                 `json:"timestamp"`
}

// ProviderStatus represents the status of an AI provider
type ProviderStatus struct {
	Name         string    `json:"name"`
	Status       string    `json:"status"` // healthy, degraded, down
	ResponseTime float64   `json:"response_time_ms"`
	ErrorRate    float64   `json:"error_rate"`
	RequestCount int64     `json:"request_count"`
	LastChecked  time.Time `json:"last_checked"`
	Models       []string  `json:"models,omitempty"`
}

// AgentPerformanceSummary represents a summary of agent performance
type AgentPerformanceSummary struct {
	AgentID         string  `json:"agent_id"`
	Name            string  `json:"name"`
	RequestCount    int64   `json:"request_count"`
	SuccessRate     float64 `json:"success_rate"`
	ResponseTime    float64 `json:"average_response_time_ms"`
	TokensProcessed int64   `json:"tokens_processed"`
}

// AgentError represents an agent error
type AgentError struct {
	AgentID   string    `json:"agent_id"`
	AgentName string    `json:"agent_name"`
	Error     string    `json:"error"`
	Timestamp time.Time `json:"timestamp"`
	RequestID string    `json:"request_id,omitempty"`
	UserID    string    `json:"user_id,omitempty"`
}

// AgentCapability represents a capability that agents can have
type AgentCapability struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Providers   []string `json:"providers"`
	Models      []string `json:"models"`
}

// AgentListResponse represents the response from listing agents
type AgentListResponse struct {
	Agents       []Agent `json:"agents"`
	TotalCount   int     `json:"total_count"`
	UpdatedCount int     `json:"updated_count,omitempty"`
	FailedCount  int     `json:"failed_count,omitempty"`
	Page         int     `json:"page"`
	PageSize     int     `json:"page_size"`
	HasNext      bool    `json:"has_next"`
}

// AgentAnalytics represents analytics data for agents
type AgentAnalytics struct {
	TimeRange           string                       `json:"time_range"`
	TotalRequests       int64                        `json:"total_requests"`
	SuccessfulRequests  int64                        `json:"successful_requests"`
	FailedRequests      int64                        `json:"failed_requests"`
	AverageResponseTime float64                      `json:"average_response_time_ms"`
	TotalTokens         int64                        `json:"total_tokens"`
	TotalCost           float64                      `json:"total_cost_usd"`
	TopAgents           []AgentPerformanceSummary    `json:"top_agents"`
	ProviderBreakdown   map[string]ProviderAnalytics `json:"provider_breakdown"`
	UsageByHour         []HourlyUsage                `json:"usage_by_hour"`
	ErrorAnalysis       ErrorAnalysis                `json:"error_analysis"`
}

// ProviderAnalytics represents analytics for a specific provider
type ProviderAnalytics struct {
	Provider        string  `json:"provider"`
	RequestCount    int64   `json:"request_count"`
	SuccessRate     float64 `json:"success_rate"`
	AverageResponse float64 `json:"average_response_time_ms"`
	TokensUsed      int64   `json:"tokens_used"`
	Cost            float64 `json:"cost_usd"`
}

// HourlyUsage represents usage statistics for a specific hour
type HourlyUsage struct {
	Hour         time.Time `json:"hour"`
	RequestCount int64     `json:"request_count"`
	TokensUsed   int64     `json:"tokens_used"`
	Cost         float64   `json:"cost_usd"`
}

// ErrorAnalysis represents error analysis data
type ErrorAnalysis struct {
	TotalErrors   int64            `json:"total_errors"`
	ErrorRate     float64          `json:"error_rate"`
	TopErrors     []ErrorSummary   `json:"top_errors"`
	ErrorsByAgent map[string]int64 `json:"errors_by_agent"`
	ErrorsByType  map[string]int64 `json:"errors_by_type"`
}

// ErrorSummary represents a summary of an error type
type ErrorSummary struct {
	Error          string    `json:"error"`
	Count          int64     `json:"count"`
	LastOccurred   time.Time `json:"last_occurred"`
	AffectedAgents []string  `json:"affected_agents"`
}

// AgentConfiguration represents configuration options for agents
type AgentConfiguration struct {
	MaxTokens        int                    `json:"max_tokens,omitempty"`
	Temperature      float32                `json:"temperature,omitempty"`
	TopP             float32                `json:"top_p,omitempty"`
	FrequencyPenalty float32                `json:"frequency_penalty,omitempty"`
	PresencePenalty  float32                `json:"presence_penalty,omitempty"`
	StopSequences    []string               `json:"stop_sequences,omitempty"`
	SystemPrompt     string                 `json:"system_prompt,omitempty"`
	ContextWindow    int                    `json:"context_window,omitempty"`
	Timeout          int                    `json:"timeout_seconds,omitempty"`
	RetryAttempts    int                    `json:"retry_attempts,omitempty"`
	CustomParameters map[string]interface{} `json:"custom_parameters,omitempty"`
}

// AgentHealthCheck represents a health check for an agent
type AgentHealthCheck struct {
	AgentID      string    `json:"agent_id"`
	Status       string    `json:"status"` // healthy, degraded, down
	ResponseTime float64   `json:"response_time_ms"`
	LastChecked  time.Time `json:"last_checked"`
	ErrorMessage string    `json:"error_message,omitempty"`
	TestsPassed  int       `json:"tests_passed"`
	TestsFailed  int       `json:"tests_failed"`
}
