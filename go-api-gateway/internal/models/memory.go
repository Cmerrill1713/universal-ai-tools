// Memory models for Universal AI Tools Go API Gateway
// Defines data structures for memory monitoring and optimization

package models

import "time"

// MemoryStatus represents current system memory status
type MemoryStatus struct {
	Timestamp   time.Time         `json:"timestamp"`
	System      SystemMemory      `json:"system"`
	Application ApplicationMemory `json:"application"`
	Status      string            `json:"status"` // healthy, warning, critical, emergency
}

// SystemMemory represents system-level memory information
type SystemMemory struct {
	Total        uint64  `json:"total"`
	Available    uint64  `json:"available"`
	Used         uint64  `json:"used"`
	Free         uint64  `json:"free"`
	UsagePercent float64 `json:"usage_percent"`
}

// ApplicationMemory represents Go runtime memory statistics
type ApplicationMemory struct {
	Allocated  uint64 `json:"allocated"`
	TotalAlloc uint64 `json:"total_alloc"`
	Sys        uint64 `json:"sys"`
	NumGC      uint32 `json:"num_gc"`
	HeapAlloc  uint64 `json:"heap_alloc"`
	HeapSys    uint64 `json:"heap_sys"`
	HeapIdle   uint64 `json:"heap_idle"`
	HeapInuse  uint64 `json:"heap_inuse"`
	StackInuse uint64 `json:"stack_inuse"`
	StackSys   uint64 `json:"stack_sys"`
}

// SystemMemoryInfo detailed system memory information from service
type SystemMemoryInfo struct {
	Total     uint64 `json:"total"`
	Available uint64 `json:"available"`
	Used      uint64 `json:"used"`
	Free      uint64 `json:"free"`
	Cached    uint64 `json:"cached,omitempty"`
	Buffers   uint64 `json:"buffers,omitempty"`
}

// MemoryOptimizationRequest represents a memory optimization request
type MemoryOptimizationRequest struct {
	OptimizationType string   `json:"optimization_type"` // standard, aggressive, conservative
	TargetServices   []string `json:"target_services,omitempty"`
	MaxDuration      int      `json:"max_duration,omitempty"` // seconds
	ForceGC          bool     `json:"force_gc,omitempty"`
	ClearCaches      bool     `json:"clear_caches,omitempty"`
}

// MemoryOptimizationResult represents the result of memory optimization
type MemoryOptimizationResult struct {
	Timestamp         time.Time     `json:"timestamp"`
	MemoryFreed       uint64        `json:"memory_freed"`
	Duration          time.Duration `json:"duration"`
	OptimizationType  string        `json:"optimization_type"`
	ServicesOptimized []string      `json:"services_optimized"`
	GCTriggered       bool          `json:"gc_triggered"`
	CachesCleared     []string      `json:"caches_cleared,omitempty"`
}

// GarbageCollectionResult represents the result of garbage collection
type GarbageCollectionResult struct {
	Timestamp    time.Time `json:"timestamp"`
	MemoryBefore uint64    `json:"memory_before"`
	MemoryAfter  uint64    `json:"memory_after"`
	MemoryFreed  uint64    `json:"memory_freed"`
	HeapBefore   uint64    `json:"heap_before"`
	HeapAfter    uint64    `json:"heap_after"`
	HeapFreed    uint64    `json:"heap_freed"`
	NumGC        uint32    `json:"num_gc"`
}

// ClearCacheRequest represents a cache clearing request
type ClearCacheRequest struct {
	CacheTypes []string `json:"cache_types"` // api_cache, session_cache, file_cache, etc.
	Services   []string `json:"services,omitempty"`
	MaxAge     int      `json:"max_age,omitempty"` // seconds, clear items older than this
}

// ClearCacheResult represents the result of cache clearing
type ClearCacheResult struct {
	Timestamp     time.Time `json:"timestamp"`
	MemoryFreed   uint64    `json:"memory_freed"`
	CachesCleared []string  `json:"caches_cleared"`
	ItemsCleared  int       `json:"items_cleared"`
	Services      []string  `json:"services"`
}

// MemoryAlert represents a memory usage alert
type MemoryAlert struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Description   string     `json:"description,omitempty"`
	Threshold     float64    `json:"threshold"`  // percentage
	AlertType     string     `json:"alert_type"` // usage, leak, spike
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	LastTriggered *time.Time `json:"last_triggered,omitempty"`
}

// CreateMemoryAlertRequest represents a request to create a memory alert
type CreateMemoryAlertRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description,omitempty"`
	Threshold   float64 `json:"threshold" binding:"required,min=0,max=100"`
	AlertType   string  `json:"alert_type" binding:"required"` // usage, leak, spike
}

// UpdateMemoryAlertRequest represents a request to update a memory alert
type UpdateMemoryAlertRequest struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Threshold   *float64 `json:"threshold,omitempty"`
	AlertType   *string  `json:"alert_type,omitempty"`
	IsActive    *bool    `json:"is_active,omitempty"`
}

// MemoryUsageHistoryPoint represents a point in memory usage history
type MemoryUsageHistoryPoint struct {
	Timestamp    time.Time `json:"timestamp"`
	TotalMemory  uint64    `json:"total_memory"`
	UsedMemory   uint64    `json:"used_memory"`
	FreeMemory   uint64    `json:"free_memory"`
	UsagePercent float64   `json:"usage_percent"`
	ServiceName  string    `json:"service_name,omitempty"`
}

// MemoryUsageHistory represents historical memory usage data
type MemoryUsageHistory struct {
	DataPoints  []MemoryUsageHistoryPoint `json:"data_points"`
	TimeRange   string                    `json:"time_range"`
	Granularity string                    `json:"granularity"`
	ServiceName string                    `json:"service_name,omitempty"`
	Summary     MemoryUsageSummary        `json:"summary"`
}

// MemoryUsageSummary provides statistical summary of memory usage
type MemoryUsageSummary struct {
	AverageUsage   float64 `json:"average_usage"`
	PeakUsage      float64 `json:"peak_usage"`
	MinUsage       float64 `json:"min_usage"`
	TrendDirection string  `json:"trend_direction"` // increasing, decreasing, stable
}

// MemoryMetrics provides comprehensive memory metrics
type MemoryMetrics struct {
	Timestamp            time.Time             `json:"timestamp"`
	SystemMetrics        SystemMemory          `json:"system_metrics"`
	ApplicationMetrics   ApplicationMemory     `json:"application_metrics"`
	ServiceMetrics       []ServiceMemoryMetric `json:"service_metrics"`
	AlertsActive         int                   `json:"alerts_active"`
	RecommendationsCount int                   `json:"recommendations_count"`
}

// ServiceMemoryMetric represents memory metrics for a specific service
type ServiceMemoryMetric struct {
	ServiceName  string  `json:"service_name"`
	MemoryUsage  uint64  `json:"memory_usage"`
	UsagePercent float64 `json:"usage_percent"`
	PeakUsage    uint64  `json:"peak_usage"`
	AverageUsage uint64  `json:"average_usage"`
	GCCount      uint32  `json:"gc_count"`
	Status       string  `json:"status"` // healthy, warning, critical
}

// MemoryAnalytics provides analytical data about memory usage patterns
type MemoryAnalytics struct {
	TimeRange      string                    `json:"time_range"`
	GroupBy        string                    `json:"group_by"`
	UsageTrends    []MemoryUsageHistoryPoint `json:"usage_trends"`
	PeakUsageTimes []time.Time               `json:"peak_usage_times"`
	Anomalies      []MemoryAnomaly           `json:"anomalies"`
	Efficiency     MemoryEfficiencyMetrics   `json:"efficiency"`
}

// MemoryAnomaly represents detected memory usage anomalies
type MemoryAnomaly struct {
	Timestamp   time.Time `json:"timestamp"`
	AnomalyType string    `json:"anomaly_type"` // spike, leak, drop
	Severity    string    `json:"severity"`     // low, medium, high
	Description string    `json:"description"`
	Value       uint64    `json:"value"`
	Expected    uint64    `json:"expected"`
}

// MemoryEfficiencyMetrics provides memory efficiency analysis
type MemoryEfficiencyMetrics struct {
	OverallScore       float64 `json:"overall_score"` // 0-100
	AllocationRate     float64 `json:"allocation_rate"`
	GCFrequency        float64 `json:"gc_frequency"`
	MemoryLeakScore    float64 `json:"memory_leak_score"`
	FragmentationScore float64 `json:"fragmentation_score"`
}

// MemoryTrends provides trend analysis and predictions
type MemoryTrends struct {
	CurrentTrend      string                  `json:"current_trend"` // increasing, decreasing, stable
	PredictedUsage    []MemoryPredictionPoint `json:"predicted_usage"`
	TrendConfidence   float64                 `json:"trend_confidence"`   // 0-1
	EstimatedCapacity time.Duration           `json:"estimated_capacity"` // time until memory full
}

// MemoryPredictionPoint represents a predicted memory usage point
type MemoryPredictionPoint struct {
	Timestamp      time.Time `json:"timestamp"`
	PredictedUsage uint64    `json:"predicted_usage"`
	Confidence     float64   `json:"confidence"`
}

// MemoryRecommendation represents a memory optimization recommendation
type MemoryRecommendation struct {
	ID              string    `json:"id"`
	Type            string    `json:"type"`     // optimization, alert, configuration
	Priority        string    `json:"priority"` // low, medium, high, critical
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Action          string    `json:"action"`
	EstimatedImpact string    `json:"estimated_impact"`
	CreatedAt       time.Time `json:"created_at"`
}

// MemoryRecommendations collection of memory recommendations
type MemoryRecommendations struct {
	Recommendations []MemoryRecommendation `json:"recommendations"`
	TotalCount      int                    `json:"total_count"`
	HighPriority    int                    `json:"high_priority"`
	ActionRequired  int                    `json:"action_required"`
}
